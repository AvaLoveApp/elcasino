// Create an RTMP ingress so a host can broadcast from OBS. Host-only, wallet-signed.
// Deploy: supabase functions deploy livekit-ingress --no-verify-jwt
import { IngressClient, IngressInput } from "npm:livekit-server-sdk@2";
import { verifyMessage } from "npm:ethers@6";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function sb(path: string): Promise<any[]> {
  if (!SB_URL || !SB_KEY) return [];
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  return res.ok ? await res.json().catch(() => []) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = Deno.env.get("LIVEKIT_API_KEY");
  const secret = Deno.env.get("LIVEKIT_API_SECRET");
  const wsUrl = Deno.env.get("LIVEKIT_URL");
  if (!key || !secret || !wsUrl) return json({ error: "missing LiveKit env vars" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const { address, dbRoomId, livekitRoom, message, signature, displayName } = body;
  if (!address || !dbRoomId || !livekitRoom || !message || !signature) return json({ error: "missing fields" }, 400);

  const prefix = `Midgard Live · obs · ${livekitRoom} · `;
  if (!message.startsWith(prefix)) return json({ error: "bad message" }, 400);
  const ts = Number(message.slice(prefix.length));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return json({ error: "message too old" }, 400);
  let recovered: string;
  try { recovered = verifyMessage(message, signature); } catch { return json({ error: "bad signature" }, 400); }
  if (recovered.toLowerCase() !== String(address).toLowerCase()) return json({ error: "signature mismatch" }, 401);

  const rooms = await sb(`live_rooms?id=eq.${dbRoomId}&select=host,livekit_room`);
  if (!rooms.length || String(rooms[0].host).toLowerCase() !== String(address).toLowerCase() || rooms[0].livekit_room !== livekitRoom) {
    return json({ error: "not_host" }, 403);
  }

  const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const client = new IngressClient(httpUrl, key, secret);
  try {
    const info = await client.createIngress(IngressInput.RTMP_INPUT, {
      name: `obs-${livekitRoom}`,
      roomName: livekitRoom,
      participantIdentity: `obs-${String(address).toLowerCase()}`,
      participantName: displayName || "OBS",
    });
    return json({ ok: true, rtmp_url: info.url, stream_key: info.streamKey, ingress_id: info.ingressId });
  } catch (e) {
    return json({ error: "ingress_failed", detail: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
}
