import { supabase } from "./supabase";
import { ADDR, CHAIN, readRegistry } from "./chain";

/**
 * Midgard Live — data layer for the token-owner broadcast system.
 * Rooms + chat live in Supabase (realtime); LiveKit access tokens are minted by
 * the `livekit-token` edge function (wallet-signed, top-100-LP gated). Identity
 * is the connected wallet — no Supabase Auth.
 */

export const LIVEKIT_URL: string | undefined = (import.meta as any).env?.VITE_LIVEKIT_URL;
// Base of the Supabase edge functions, e.g. https://<proj>.supabase.co/functions/v1
// (only needed for the optional OBS-ingress / server-moderation functions).
export const LIVEKIT_API_BASE: string | undefined = (import.meta as any).env?.VITE_LIVEKIT_API_BASE;
// Tokens are minted by the in-database `livekit_token` RPC (no edge function
// needed), so Live is configured whenever Supabase is wired.
export const liveConfigured = !!supabase;

export type LiveMode = "video" | "audio";

export interface LiveRoomRow {
  id: string;
  host: string;                 // host wallet (lowercased)
  host_name: string | null;
  host_avatar: string | null;
  token_addr: string;           // the streamer's launchpad token
  token_symbol: string;
  token_logo: string | null;
  mode: LiveMode;
  title: string;
  status: "live" | "ended";
  livekit_room: string;
  peak_viewers: number;
  viewers: number;
  thumbnail: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface LiveMsg {
  id: string;
  room_id: string;
  wallet: string;
  name: string | null;
  avatar: string | null;
  body: string;
  created_at: string;
}

// ── Eligibility (top-100 launchpad token owners by MIDGARD LP) ───────────────
export interface LiveEligibility {
  eligible: boolean;
  founder: boolean;                  // protocol/registry owner — always may broadcast as MIDGARD
  rank: number | null;               // 1-based among eligible hosts (null for a pure founder)
  sharePct: number;                  // share of the top-100 LP pool
  estMinutes: number;                // this wallet's monthly allocation (share of the pool)
  usedMinutes: number;               // participant-minutes already spent this month
  remainingMinutes: number;          // estMinutes − usedMinutes (never < 0)
  poolMinutes: number;               // the whole monthly pool LiveKit gives (VITE_LIVE_POOL_MINUTES)
  tokens: { token: string; symbol: string; logo: string; lp: number }[]; // caller's streamable tokens
}

// Total monthly participant-minutes the LiveKit plan/API key provides. This is
// the number LiveKit gives you per month — set VITE_LIVE_POOL_MINUTES to your
// plan's minutes so the split below matches reality. It's divided among the
// top-N eligible hosts by LP share. Keep in sync with the token RPC's cap.
export const POOL_MINUTES: number = Number((import.meta as any).env?.VITE_LIVE_POOL_MINUTES) || 1000;
const POOL_MIN = POOL_MINUTES;
const TOP_N = 100;
const MIDGARD_LOGO = "./elcasino_logo.png";

// Fetch up to `limit` MIDGARD holders (address + raw balance), newest Blockscout
// v2 API, following one page of pagination so we can cover the top 100.
async function fetchTopHolders(limit: number): Promise<{ addr: string; bal: number }[]> {
  const base = `${CHAIN.explorer}/api/v2/tokens/${ADDR.token}/holders`;
  const out: { addr: string; bal: number }[] = [];
  let url = base;
  for (let page = 0; page < 3 && out.length < limit; page++) {
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const j: any = await res.json();
      for (const it of (j.items || [])) {
        const a = (it.address?.hash || it.address || "").toLowerCase();
        if (a) out.push({ addr: a, bal: Number(it.value || 0) });
      }
      const np = j.next_page_params;
      if (!np) break;
      const qs = new URLSearchParams(Object.entries(np).map(([k, v]) => [k, String(v)])).toString();
      url = `${base}?${qs}`;
    } catch { break; }
  }
  return out.slice(0, limit);
}

/** Compute whether a wallet may go live: gated to the **top-100 MIDGARD holders**,
 *  plus an always-on grant for the protocol founder (registry owner). The monthly
 *  LiveKit pool is split **equally** among the top 100 — everyone gets the same
 *  minute allocation regardless of balance. Everyone broadcasts as MIDGARD. */
export async function loadLiveEligibility(address: string): Promise<LiveEligibility> {
  const empty: LiveEligibility = { eligible: false, founder: false, rank: null, sharePct: 0, estMinutes: 0, usedMinutes: 0, remainingMinutes: 0, poolMinutes: POOL_MINUTES, tokens: [] };
  if (!address) return empty;
  const addr = address.toLowerCase();

  let founder = false;
  try { const o: string = await readRegistry().owner(); founder = !!o && o.toLowerCase() === addr; } catch {}

  const holders = await fetchTopHolders(TOP_N).catch(() => []);
  const idx = holders.findIndex((h) => h.addr === addr);
  const inTop = idx >= 0;
  if (!inTop && !founder) return empty;

  const totalTop = holders.reduce((s, h) => s + h.bal, 0) || 1;
  const bal = inTop ? holders[idx].bal : 0;
  const sharePct = (bal / totalTop) * 100;   // balance share (informational)

  // Equal split: every top-100 holder gets the same slice of the monthly pool.
  const estMinutes = Math.max(5, Math.floor(POOL_MIN / TOP_N));
  const usedMinutes = Math.round(await fetchMonthlyUsage(addr).catch(() => 0));
  const remainingMinutes = Math.max(0, estMinutes - usedMinutes);

  return {
    eligible: true,
    founder,
    rank: inTop ? idx + 1 : null,
    sharePct,
    estMinutes,
    usedMinutes,
    remainingMinutes,
    poolMinutes: POOL_MINUTES,
    tokens: [{ token: ADDR.token, symbol: "MIDGARD", logo: MIDGARD_LOGO, lp: bal }],
  };
}

// ── Rooms ────────────────────────────────────────────────────────────────────
export async function fetchLiveRooms(status: "live" | "ended" | "all" = "live"): Promise<LiveRoomRow[]> {
  if (!supabase) return [];
  let q = supabase.from("live_rooms").select("*").order("viewers", { ascending: false }).order("started_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return (data as LiveRoomRow[]) ?? [];
}

export async function fetchLiveRoom(id: string): Promise<LiveRoomRow | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("live_rooms").select("*").eq("id", id).maybeSingle();
  return (data as LiveRoomRow) ?? null;
}

export async function createLiveRoom(input: {
  host: string; hostName: string | null; hostAvatar: string | null;
  tokenAddr: string; tokenSymbol: string; tokenLogo: string | null;
  mode: LiveMode; title: string;
}): Promise<LiveRoomRow> {
  if (!supabase) throw new Error("Live backend not configured.");
  const row = {
    host: input.host.toLowerCase(),
    host_name: input.hostName, host_avatar: input.hostAvatar,
    token_addr: input.tokenAddr.toLowerCase(), token_symbol: input.tokenSymbol, token_logo: input.tokenLogo,
    mode: input.mode, title: input.title.trim().slice(0, 120) || `${input.tokenSymbol} live`,
    status: "live", livekit_room: `mg_${crypto.randomUUID()}`,
    peak_viewers: 1, viewers: 1,
  };
  const { data, error } = await supabase.from("live_rooms").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as LiveRoomRow;
}

export async function endLiveRoom(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_rooms").update({ status: "ended", ended_at: new Date().toISOString(), viewers: 0 }).eq("id", id);
}

export async function reportViewers(id: string, count: number): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_rooms").update({ viewers: count }).eq("id", id);
  await supabase.from("live_rooms").update({ peak_viewers: count }).eq("id", id).lt("peak_viewers", count);
}

export function subscribeLiveRooms(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`live:rooms:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "live_rooms" }, onChange)
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── Chat ─────────────────────────────────────────────────────────────────────
export async function fetchLiveMessages(roomId: string, limit = 100): Promise<LiveMsg[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("live_messages").select("*").eq("room_id", roomId)
    .order("created_at", { ascending: false }).limit(limit);
  return ((data as LiveMsg[]) ?? []).reverse();
}

export async function sendLiveMessage(m: { roomId: string; wallet: string; name: string | null; avatar: string | null; body: string }): Promise<void> {
  if (!supabase) throw new Error("Live backend not configured.");
  const body = (m.body || "").trim().slice(0, 500);
  if (!body) return;
  const { error } = await supabase.from("live_messages").insert({
    room_id: m.roomId, wallet: (m.wallet || "anon").toLowerCase(), name: m.name, avatar: m.avatar, body,
  });
  if (error) throw new Error(error.message);
}

export function subscribeLiveMessages(roomId: string, onInsert: (m: LiveMsg) => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`live:msg:${roomId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_messages", filter: `room_id=eq.${roomId}` },
      (p) => onInsert(p.new as LiveMsg))
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── LiveKit token (wallet-signed → edge function) ────────────────────────────
export interface LiveKitAuth { token: string; url: string; canPublish: boolean; allowedMinutes: number; rank: number | null; }

/**
 * Mint a LiveKit token via the in-database `livekit_token` RPC (HS256 JWT signed
 * server-side with the API secret stored in a private table). No edge function
 * or wallet signature needed — publish rights come from the room's host record /
 * approved-speaker rows; bans are enforced. Eligibility to CREATE a room is gated
 * client-side by `loadLiveEligibility` (top-100 LP).
 */
export async function getLiveKitToken(opts: {
  roomId: string; dbRoomId: string; role: "host" | "viewer"; mode: LiveMode;
  address: string; signMessage?: (msg: string) => Promise<string>;
  displayName?: string; avatar?: string | null;
}): Promise<LiveKitAuth> {
  if (!supabase) throw new Error("Live media isn't configured yet.");
  const { data, error } = await supabase.rpc("livekit_token", {
    p_room_id: opts.roomId, p_db_room: opts.dbRoomId, p_role: opts.role, p_mode: opts.mode,
    p_identity: opts.address.toLowerCase(), p_name: opts.displayName || null, p_avatar: opts.avatar || null,
  });
  if (error) throw new Error(error.message || "Could not get a live token.");
  const d = data as any;
  if (!d?.token) throw new Error(d?.error === "not_configured" ? "Live A/V not configured (LiveKit keys missing)." : (d?.error || "Could not get a live token."));
  return { token: d.token, url: d.url || LIVEKIT_URL!, canPublish: !!d.canPublish, allowedMinutes: d.allowedMinutes ?? 0, rank: d.rank ?? null };
}

// ── Speaker requests (audio rooms) ───────────────────────────────────────────
export interface LiveSpeaker { room_id: string; wallet: string; name: string | null; avatar: string | null; status: "requested" | "approved" | "removed"; }

export async function fetchSpeakers(roomId: string): Promise<LiveSpeaker[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("live_speakers").select("*").eq("room_id", roomId);
  return (data as LiveSpeaker[]) ?? [];
}
export async function requestSpeak(roomId: string, wallet: string, name: string | null, avatar: string | null): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("live_speakers").upsert({ room_id: roomId, wallet: wallet.toLowerCase(), name, avatar, status: "requested" });
  if (error) throw new Error(error.message);
}
export async function cancelSpeak(roomId: string, wallet: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_speakers").delete().eq("room_id", roomId).eq("wallet", wallet.toLowerCase());
}
export async function setSpeakerStatus(roomId: string, wallet: string, status: "approved" | "removed"): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("live_speakers").update({ status }).eq("room_id", roomId).eq("wallet", wallet.toLowerCase());
  if (error) throw new Error(error.message);
}
export function subscribeSpeakers(roomId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`live:spk:${roomId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "live_speakers", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── Bans ─────────────────────────────────────────────────────────────────────
export async function fetchBans(roomId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("live_room_bans").select("wallet").eq("room_id", roomId);
  return ((data as { wallet: string }[]) ?? []).map((r) => r.wallet);
}
export async function banWallet(roomId: string, wallet: string, by: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_room_bans").upsert({ room_id: roomId, wallet: wallet.toLowerCase(), by_wallet: by.toLowerCase() });
}
export async function unbanWallet(roomId: string, wallet: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_room_bans").delete().eq("room_id", roomId).eq("wallet", wallet.toLowerCase());
}

// ── OBS ingress + server moderation via LiveKit's HTTP API (admin token) ─────
// No edge function needed: an admin token (roomAdmin + ingressAdmin) is minted by
// the in-DB `livekit_admin_token` RPC (host-verified), and LiveKit's server APIs
// are plain Twirp/HTTP callable from the browser.
async function getAdminToken(dbRoomId: string, livekitRoom: string, address: string): Promise<{ token: string; url: string }> {
  if (!supabase) throw new Error("Live not configured.");
  const { data, error } = await supabase.rpc("livekit_admin_token", { p_room_id: livekitRoom, p_db_room: dbRoomId, p_identity: address.toLowerCase() });
  const d = data as any;
  if (error || !d?.token) throw new Error(d?.error === "not_host" ? "Only the host can do that." : (d?.error || error?.message || "admin token failed"));
  return d;
}
const httpFromWss = (u: string) => u.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
async function twirp(baseHttp: string, path: string, token: string, body: any): Promise<any> {
  const res = await fetch(`${baseHttp}/twirp/${path}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${(await res.text().catch(() => "")).slice(0, 140)}`);
  return res.json().catch(() => ({}));
}

export interface IngressInfo { rtmp_url: string; stream_key: string; ingress_id: string; }
export async function createIngress(o: { dbRoomId: string; livekitRoom: string; address: string; displayName?: string; signMessage?: (m: string) => Promise<string> }): Promise<IngressInfo> {
  const { token, url } = await getAdminToken(o.dbRoomId, o.livekitRoom, o.address);
  // LiveKit's Twirp JSON accepts either casing on input; send both so it works
  // across server versions.
  const d = await twirp(httpFromWss(url), "livekit.Ingress/CreateIngress", token, {
    inputType: "RTMP_INPUT", input_type: "RTMP_INPUT",
    name: `obs-${o.livekitRoom}`,
    roomName: o.livekitRoom, room_name: o.livekitRoom,
    participantIdentity: `obs-${o.address.toLowerCase()}`, participant_identity: `obs-${o.address.toLowerCase()}`,
    participantName: o.displayName || "OBS", participant_name: o.displayName || "OBS",
    bypassTranscoding: true, bypass_transcoding: true,
  });
  // The response may come back camelCase (protojson default) or snake_case
  // depending on the LiveKit version — read both. Never return undefined, or the
  // OBS dialog copies the literal string "undefined".
  const rtmp_url = d.url ?? d.rtmp_url ?? d.serverUrl ?? d.server_url ?? "";
  const stream_key = d.streamKey ?? d.stream_key ?? d.streamkey ?? "";
  const ingress_id = d.ingressId ?? d.ingress_id ?? "";
  if (!rtmp_url || !stream_key) {
    throw new Error("LiveKit did not return an RTMP URL + key (Ingress may be disabled on this project). Response: " + JSON.stringify(d).slice(0, 180));
  }
  return { rtmp_url, stream_key, ingress_id };
}

/** Real server-side kick (in addition to the data-channel signal). */
export async function removeParticipant(o: { dbRoomId: string; livekitRoom: string; identity: string; address: string }): Promise<void> {
  const { token, url } = await getAdminToken(o.dbRoomId, o.livekitRoom, o.address);
  await twirp(httpFromWss(url), "livekit.RoomService/RemoveParticipant", token, { room: o.livekitRoom, identity: o.identity });
}

// ── Live preview thumbnails (a frame captured from inside the stream) ─────────
export async function setThumbnail(id: string, dataUrl: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("live_rooms").update({ thumbnail: dataUrl }).eq("id", id).then(() => {}, () => {});
}

// ── Usage metering (cumulative monthly participant-minutes) ──────────────────
export async function addUsage(wallet: string, minutes: number): Promise<void> {
  if (!supabase || minutes <= 0) return;
  await supabase.rpc("live_add_usage", { p_wallet: wallet.toLowerCase(), p_minutes: minutes }).then(() => {}, () => {});
}
export async function fetchMonthlyUsage(wallet: string): Promise<number> {
  if (!supabase) return 0;
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const { data } = await supabase.from("live_usage").select("minutes").eq("wallet", wallet.toLowerCase()).eq("ym", ym).maybeSingle();
  return data ? Number((data as any).minutes) : 0;
}
