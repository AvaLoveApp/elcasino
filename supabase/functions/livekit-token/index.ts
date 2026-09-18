// LiveKit access-token issuer for Midgard Live (Supabase edge function).
//
// The STATIC Netlify frontend calls this at
//   https://<project>.supabase.co/functions/v1/livekit-token
// Set VITE_LIVEKIT_API_BASE to that /functions/v1 base in the frontend build.
//
// Auth is wallet-signature (no Supabase user): the caller signs a room-scoped,
// timestamped message; we recover the signer. HOST rights are gated on-chain —
// only creators of the TOP 100 launchpad tokens by MIDGARD LP may broadcast, and
// the monthly minute pool is split between them largest→smallest (by LP share),
// minus what they've already used this month. Viewers get subscribe-only tokens;
// an APPROVED speaker (audio room) is upgraded to publish. Banned wallets are
// refused.
//
// Deploy:
//   supabase functions deploy livekit-token --no-verify-jwt
//   supabase secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
import { AccessToken, VideoGrant } from "npm:livekit-server-sdk@2";
import { verifyMessage, JsonRpcProvider, Contract, formatUnits } from "npm:ethers@6";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const CHAIN_RPC = "https://rpc.mainnet.chain.robinhood.com/";
const CHAIN_ID = 4663;
const LAUNCHPAD = Deno.env.get("LAUNCHPAD_ADDR") ?? "0xFfcbeE4C9A0c1e27b1A848e135AbD62CA7270b72";
const LAUNCHPAD_ABI = [
  "function getLaunches(uint256 offset, uint256 limit) view returns (tuple(address token,address pair,address creator,string name,string symbol,string logoURI,uint256 supply,uint256 tokenForLp,uint256 midgardForLp,uint256 createdAt)[] out)",
];
const PAIR_ABI = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
];

const POOL_MIN = Number(Deno.env.get("LIVE_POOL_MINUTES") ?? 1000);
const TOP_N = Number(Deno.env.get("LIVE_TOP_N") ?? 100);
const MIN_MINUTES = Number(Deno.env.get("LIVE_MIN_MINUTES") ?? 5);
const MAX_MINUTES = Number(Deno.env.get("LIVE_MAX_MINUTES") ?? 240);
const VIEWER_MINUTES = Number(Deno.env.get("LIVE_VIEWER_MINUTES") ?? 240);

const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function sb(path: string): Promise<any[]> {
  if (!SB_URL || !SB_KEY) return [];
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
  });
  return res.ok ? await res.json().catch(() => []) : [];
}

let rankCache: { at: number; agg: { creator: string; lp: number }[]; totalTop: number } | null = null;
async function launchLpRanking() {
  if (rankCache && Date.now() - rankCache.at < 60_000) return rankCache;
  const provider = new JsonRpcProvider(CHAIN_RPC, CHAIN_ID, { staticNetwork: true });
  const lp = new Contract(LAUNCHPAD, LAUNCHPAD_ABI, provider);
  const launches: any[] = await lp.getLaunches(0, 300).catch(() => []);
  const rows = await Promise.all(launches.map(async (r: any) => {
    const token = (r.token ?? r[0]).toLowerCase();
    const pair = r.pair ?? r[1];
    const creator = (r.creator ?? r[2]).toLowerCase();
    let midLp = 0;
    try {
      const p = new Contract(pair, PAIR_ABI, provider);
      const [res, t0] = await Promise.all([p.getReserves(), p.token0()]);
      midLp = Number(formatUnits(String(t0).toLowerCase() === token ? res[1] : res[0], 18));
    } catch { midLp = 0; }
    return { creator, lp: midLp };
  }));
  const top = rows.filter((r) => r.lp > 0).sort((a, b) => b.lp - a.lp).slice(0, TOP_N);
  const byCreator = new Map<string, number>();
  for (const t of top) byCreator.set(t.creator, (byCreator.get(t.creator) ?? 0) + t.lp);
  const agg = [...byCreator.entries()].map(([creator, lp]) => ({ creator, lp })).sort((a, b) => b.lp - a.lp);
  const totalTop = top.reduce((s, t) => s + t.lp, 0) || 1;
  rankCache = { at: Date.now(), agg, totalTop };
  return rankCache;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = Deno.env.get("LIVEKIT_API_KEY");
  const secret = Deno.env.get("LIVEKIT_API_SECRET");
  const wsUrl = Deno.env.get("LIVEKIT_URL");
  if (!key || !secret || !wsUrl) return json({ error: "server missing LiveKit env vars" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const { address, roomId, dbRoomId, role, mode, message, signature, displayName, avatar } = body;
  if (!address || !roomId || !message || !signature || !role || !mode) return json({ error: "missing fields" }, 400);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) return json({ error: "bad roomId" }, 400);
  if (role !== "host" && role !== "viewer") return json({ error: "bad role" }, 400);
  if (mode !== "audio" && mode !== "video") return json({ error: "bad mode" }, 400);

  const expectedPrefix = `Midgard Live · ${role} · ${roomId} · `;
  if (!message.startsWith(expectedPrefix)) return json({ error: "bad message prefix" }, 400);
  const ts = Number(message.slice(expectedPrefix.length));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return json({ error: "message too old" }, 400);
  let recovered: string;
  try { recovered = verifyMessage(message, signature); } catch { return json({ error: "bad signature" }, 400); }
  if (recovered.toLowerCase() !== String(address).toLowerCase()) return json({ error: "signature mismatch" }, 401);

  const addr = String(address).toLowerCase();

  // Ban check (per-room).
  if (dbRoomId) {
    const banned = await sb(`live_room_bans?room_id=eq.${dbRoomId}&wallet=eq.${addr}&select=wallet`);
    if (banned.length) return json({ error: "banned", detail: "You've been removed from this room." }, 403);
  }

  let allowedMinutes = VIEWER_MINUTES;
  let canPublish = false;
  let rank = -1;

  if (role === "host") {
    try {
      const { agg, totalTop } = await launchLpRanking();
      rank = agg.findIndex((r) => r.creator === addr);
      if (rank < 0) return json({ error: "not_eligible", detail: "Only the top-100 launchpad token owners (by MIDGARD LP) can go live." }, 403);
      const share = agg[rank].lp / totalTop;
      const allocation = Math.max(MIN_MINUTES, Math.floor(share * POOL_MIN));
      // Subtract what they've already used this month.
      const ym = new Date().toISOString().slice(0, 7).replace("-", "");
      const used = await sb(`live_usage?wallet=eq.${addr}&ym=eq.${ym}&select=minutes`);
      const usedMin = used.length ? Number(used[0].minutes) : 0;
      const remaining = allocation - usedMin;
      if (remaining < MIN_MINUTES) return json({ error: "quota_exhausted", detail: `Monthly stream quota used (${Math.round(usedMin)}/${allocation} min).` }, 403);
      allowedMinutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.floor(remaining)));
      canPublish = true;
    } catch (e) {
      return json({ error: "eligibility_check_failed", detail: String(e) }, 502);
    }
  } else if (dbRoomId) {
    // Viewer — an APPROVED speaker (audio room) is upgraded to publish.
    const spk = await sb(`live_speakers?room_id=eq.${dbRoomId}&wallet=eq.${addr}&status=eq.approved&select=wallet`);
    if (spk.length) canPublish = true;
  }

  const meta = JSON.stringify({ av: avatar || null, ho: role === "host", sp: canPublish && role !== "host" });
  const at = new AccessToken(key, secret, {
    identity: addr, name: (displayName || addr.slice(0, 8)), metadata: meta, ttl: `${allowedMinutes * 60}s`,
  });
  const grant: VideoGrant = { room: roomId, roomJoin: true, canPublish, canSubscribe: true, canPublishData: true, roomCreate: role === "host" };
  at.addGrant(grant);
  const token = await at.toJwt();
  return json({ token, url: wsUrl, allowedMinutes, role, mode, canPublish, rank: rank >= 0 ? rank + 1 : null });
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
}
