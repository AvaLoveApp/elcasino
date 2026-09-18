import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Contract, parseUnits } from "ethers";
import {
  ArrowLeft, Users, Send, Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, Loader2, Radio,
  Volume2, Maximize2, Minimize2, MessageSquare, ShieldAlert, X, HandCoins, Hand, Check, Copy, VolumeX, UserX, Crown,
} from "lucide-react";
import { useWallet } from "../lib/wallet";
import { useLivePlayer, LiveParticipant } from "../lib/livePlayer";
import {
  fetchLiveRoom, fetchLiveMessages, sendLiveMessage, subscribeLiveMessages, liveConfigured, endLiveRoom,
  fetchSpeakers, subscribeSpeakers, requestSpeak, cancelSpeak, setSpeakerStatus,
  fetchBans, banWallet, unbanWallet, createIngress, removeParticipant, fetchMonthlyUsage,
  loadLiveEligibility,
  LiveRoomRow, LiveMsg, LiveSpeaker, LiveEligibility,
} from "../lib/live";
import { loadProfile } from "../lib/midchat";
import { readProvider } from "../lib/chain";
import { short, timeAgo, fmtInt } from "../lib/util";
import { CasinoTokenSwap } from "../components/CasinoSwap";

// Tip messages ride the normal chat stream with a marker prefix, so every viewer
// sees them in chat AND we can pop an on-screen toast when one arrives.
const TIP_PREFIX = "::tip::";
type TipMeta = { a: number; s: string; l: string; from: string };
function parseTip(body: string): TipMeta | null {
  if (!body.startsWith(TIP_PREFIX)) return null;
  try { return JSON.parse(body.slice(TIP_PREFIX.length)); } catch { return null; }
}

const ERC20 = [
  "function transfer(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export default function LiveRoomPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const w = useWallet();
  const lp = useLivePlayer();

  const [room, setRoom] = useState<LiveRoomRow | null | "notfound">(null);
  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"chat" | "people">("chat");
  const [isFs, setIsFs] = useState(false);
  const [speakers, setSpeakers] = useState<LiveSpeaker[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [obs, setObs] = useState<{ rtmp_url: string; stream_key: string } | null>(null);
  const [obsBusy, setObsBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);   // in-app "End stream?" modal
  const [notice, setNotice] = useState<string | null>(null); // in-app toast (replaces alert)
  const [usedMin, setUsedMin] = useState<number | null>(null);
  const [allow, setAllow] = useState<LiveEligibility | null>(null); // host's monthly allocation
  const [sessionSec, setSessionSec] = useState(0);                  // this session's elapsed seconds
  const [buyOpen, setBuyOpen] = useState(false);                    // chat-side swap panel
  const [tipToast, setTipToast] = useState<TipMeta | null>(null);   // on-screen tip pop
  const lastTipId = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const approvedRef = useRef(false);

  const isHost = !!(room && room !== "notfound" && w.address && room.host.toLowerCase() === w.address.toLowerCase());
  const addr = (w.address || "").toLowerCase();
  const mySpeaker = speakers.find((s) => s.wallet === addr);
  const pending = speakers.filter((s) => s.status === "requested");

  // Load room meta + chat.
  useEffect(() => {
    let alive = true;
    fetchLiveRoom(id).then((r) => alive && setRoom(r ?? "notfound")).catch(() => alive && setRoom("notfound"));
    fetchLiveMessages(id).then((m) => alive && setMessages(m)).catch(() => {});
    const un = subscribeLiveMessages(id, (m) => setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m])));
    return () => { alive = false; un(); };
  }, [id]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Pop an on-screen toast whenever a new tip message lands in chat.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastTipId.current) return;
    const tip = parseTip(last.body);
    if (tip) {
      lastTipId.current = last.id;
      setTipToast(tip);
      const h = setTimeout(() => setTipToast(null), 6000);
      return () => clearTimeout(h);
    }
  }, [messages]);

  // Speaker requests (audio rooms) + bans (host) + monthly usage (host).
  useEffect(() => {
    if (!id) return;
    fetchSpeakers(id).then(setSpeakers).catch(() => {});
    const un = subscribeSpeakers(id, () => fetchSpeakers(id).then(setSpeakers).catch(() => {}));
    return () => un();
  }, [id]);
  useEffect(() => {
    if (!isHost) { setBans([]); setUsedMin(null); setAllow(null); return; }
    fetchBans(id).then(setBans).catch(() => {});
    if (w.address) {
      fetchMonthlyUsage(w.address).then(setUsedMin).catch(() => {});
      loadLiveEligibility(w.address).then(setAllow).catch(() => {});
    }
  }, [isHost, id, w.address]);

  // Live session timer — starts counting once the host's stream is connected, so
  // the remaining-minutes figure ticks down in real time while broadcasting.
  const connected = isHost && lp.canPublish && lp.status === "connected";
  useEffect(() => {
    if (!connected) { setSessionSec(0); return; }
    const t0 = Date.now();
    const iv = setInterval(() => setSessionSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [connected]);

  // A viewer who just got approved to speak re-mints a publish token.
  const approved = mySpeaker?.status === "approved";
  useEffect(() => {
    if (approved && !approvedRef.current && lp.room?.id === id && !lp.canPublish) {
      approvedRef.current = true; lp.regrant();
    }
    if (!approved) approvedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, lp.room?.id, lp.canPublish]);

  // Dock the persistent media node into this page's stage; on unmount it pops to
  // the floating PiP (we DON'T leave — the stream keeps playing while you browse).
  useEffect(() => {
    if (!room || room === "notfound") return;
    lp.registerStage(stageRef.current);
    // Join only when a wallet is present (A/V needs a signed token). Non-connected
    // visitors see the room shell + chat and a "connect to watch" prompt.
    if (w.address && lp.room?.id !== room.id) lp.join(room, isHost ? "host" : "viewer");
    return () => lp.registerStage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room === "notfound" ? "nf" : (room as LiveRoomRow | null)?.id, isHost, w.address]);

  // Fullscreen (landscape lock on mobile).
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = async () => {
    const el = mediaRef.current; if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch {}
      } else { try { (screen.orientation as any)?.unlock?.(); } catch {} await document.exitFullscreen(); }
    } catch {}
  };

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    if (!w.address) { w.connect(); return; }
    setDraft("");
    try {
      const prof = await loadProfile(w.address).catch(() => null);
      await sendLiveMessage({ roomId: id, wallet: w.address, name: prof?.username || short(w.address), avatar: prof?.avatar_url || null, body });
    } catch { setDraft(body); }
  }, [draft, w.address, id]);

  const sign = (m: string) => w.signer!.signMessage(m);
  async function openObs() {
    if (obs || room === "notfound" || !room) return;
    setObsBusy(true);
    try {
      const info = await createIngress({ dbRoomId: id, livekitRoom: room.livekit_room, address: w.address!, displayName: room.host_name || undefined, signMessage: sign });
      setObs({ rtmp_url: info.rtmp_url, stream_key: info.stream_key });
    } catch (e: any) { setNotice((e?.message || "OBS ingress failed") + " — OBS needs the optional livekit-ingress function. Browser camera + screen share work without it."); }
    finally { setObsBusy(false); }
  }
  // Moderation runs over LiveKit's data channel (host → target enforces it) plus a
  // DB ban so a removed wallet can't mint a fresh token to rejoin.
  function mod(p: LiveParticipant, action: "mute" | "remove") {
    if (room === "notfound" || !room) return;
    if (action === "mute") { lp.muteRemote(p.identity); return; }
    lp.kick(p.identity); // data-channel signal (instant)
    removeParticipant({ dbRoomId: id, livekitRoom: room.livekit_room, identity: p.identity, address: w.address! }).catch(() => {}); // real server kick
  }
  async function ban(p: LiveParticipant) {
    if (!w.address || room === "notfound" || !room) return;
    await banWallet(id, p.identity, w.address).catch(() => {});
    lp.kick(p.identity);
    removeParticipant({ dbRoomId: id, livekitRoom: room.livekit_room, identity: p.identity, address: w.address }).catch(() => {});
    setBans((b) => (b.includes(p.identity) ? b : [...b, p.identity]));
  }
  async function endStream() {
    setConfirmEnd(false);
    setEnding(true);
    try { if (lp.room?.id === id) await lp.leave(); else await endLiveRoom(id); }
    catch { await endLiveRoom(id).catch(() => {}); }
    finally { nav("/live"); }
  }

  if (room === null) return <div className="grid h-[60vh] place-items-center"><Loader2 className="animate-spin text-bone-600" /></div>;
  if (room === "notfound") return (
    <div className="grid h-[60vh] place-items-center text-center text-bone-500">
      <div><Radio className="mx-auto h-12 w-12 text-ink-600 mb-3" /><p>This stream isn't live anymore.</p>
        <button onClick={() => nav("/live")} className="btn-ghost mt-4">Back to Live</button></div>
    </div>
  );

  const r = room;
  const isThis = lp.room?.id === r.id;

  return (
    <div className="flex flex-col h-dvh lg:flex-row lg:overflow-hidden animate-fade-up bg-ink-950">
      {/* Video + controls */}
      <div className="flex min-w-0 flex-1 flex-col bg-ink-950">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-2.5">
          <button onClick={() => nav("/live")} className="text-bone-300 hover:text-bone-50" aria-label="Back"><ArrowLeft size={18} /></button>
          <span className="inline-flex items-center gap-1 rounded-full bg-blood-600 px-2 py-0.5 text-[10px] font-black uppercase text-ink-950">● Live</span>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-bone-50">{r.title}</p>
          {isHost && (
            <button onClick={() => setConfirmEnd(true)} disabled={ending}
              className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-3 py-1 text-xs font-bold text-white hover:bg-danger-500 disabled:opacity-50">
              {ending ? <Loader2 size={13} className="animate-spin" /> : <PhoneOff size={13} />} End
            </button>
          )}
          <TipButton room={r} />
          <button onClick={() => nav(`/token`)} className="hidden sm:inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-mono text-blood-300 hover:text-blood-200" title="Trade this token">
            ${r.token_symbol}
          </button>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-bone-200"><Users size={15} className="text-blood-400" /> {lp.count}</span>
          <button onClick={() => setChatOpen((o) => !o)} className="lg:hidden text-bone-300 hover:text-blood-400"><MessageSquare size={18} /></button>
        </div>

        {/* Media stage — the persistent LiveKit node docks here */}
        <div ref={mediaRef} className="group relative flex-1 min-h-[46vw] lg:min-h-[280px] bg-black">
          {/* Poster behind the video: keeps the stage looking like a screen even
              before a track arrives (connecting, audio room, or A/V not wired). */}
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-900 via-ink-950 to-black">
            {r.token_logo
              ? <img src={r.token_logo} alt="" className="h-24 w-24 rounded-full object-cover opacity-25 blur-[1px]" />
              : <Radio className="h-16 w-16 text-ink-700" />}
          </div>
          <div ref={stageRef} className="absolute inset-0" />

          {/* Overlay chat (over the video, right side) */}
          {chatOpen && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-[300px] xl:flex flex-col justify-end p-3 gap-2">
              <div className="pointer-events-auto max-h-[70%] overflow-y-auto no-scrollbar space-y-1.5 rounded-xl bg-ink-950/40 p-2 backdrop-blur-[2px]">
                {messages.slice(-40).map((m) => <OverlayMsg key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {/* Connect-to-watch prompt (no wallet yet) */}
          {!w.address && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-center p-6">
              <div className="max-w-xs text-bone-300">
                <Radio className="mx-auto h-10 w-10 text-blood-400 mb-2" />
                <p className="text-sm mb-3">Connect your wallet to watch <b className="text-bone-50">{r.host_name || short(r.host)}</b>'s stream and join the chat.</p>
                <button onClick={() => w.connect()} className="btn-primary">Connect to watch</button>
              </div>
            </div>
          )}

          {/* Status layer */}
          {w.address && isThis && lp.status !== "connected" && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-center p-6">
              {lp.status === "connecting" && <div className="text-bone-300"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />Connecting…</div>}
              {lp.status === "error" && (
                <div className="max-w-xs text-bone-300">
                  <ShieldAlert className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                  <p className="text-sm">{lp.err}</p>
                  <button onClick={() => lp.join(r, isHost ? "host" : "viewer")} className="btn-ghost mt-3">Retry</button>
                </div>
              )}
            </div>
          )}
          {!liveConfigured && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-center p-6">
              <div className="max-w-sm text-bone-300"><ShieldAlert className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                <p className="text-sm">Live media isn't configured yet — chat and the room work. Add the LiveKit env vars to enable A/V.</p></div>
            </div>
          )}

          {/* Sound unlock */}
          {lp.needAudio && isThis && lp.status === "connected" && (
            <button onClick={lp.unlockAudio} className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-blood-600 px-4 py-2 text-sm font-bold text-ink-950">
              <Volume2 size={15} /> Tap for sound
            </button>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFs} className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-bone-100 backdrop-blur hover:bg-black/70">
            {isFs ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* Host control bar */}
        {isThis && lp.canPublish && lp.status === "connected" && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-ink-800 bg-ink-950/70 px-4 py-3">
            {isHost && r.mode === "video" && (
              <>
                <Ctrl active={lp.camOn} onClick={lp.toggleCam} on={<Video size={18} />} off={<VideoOff size={18} />} label="Camera" />
                <Ctrl active={lp.screenOn} onClick={lp.toggleScreen} on={<MonitorUp size={18} />} off={<MonitorUp size={18} />} label="Screen" />
                <button onClick={openObs} disabled={obsBusy} className="inline-flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-bone-300 hover:bg-ink-800 disabled:opacity-50" title="Broadcast from OBS">
                  {obsBusy ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}<span className="text-[10px] font-semibold">OBS</span>
                </button>
              </>
            )}
            <Ctrl active={lp.micOn} onClick={lp.toggleMic} on={<Mic size={18} />} off={<MicOff size={18} />} label="Mic" />
            {isHost && (
              <button onClick={() => setConfirmEnd(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-4 py-2 text-sm font-bold text-white hover:bg-danger-500">
                <PhoneOff size={15} /> End
              </button>
            )}
            {isHost && allow && allow.estMinutes > 0 && (() => {
              const used = (usedMin ?? allow.usedMinutes) + sessionSec / 60;
              const remaining = Math.max(0, allow.estMinutes - used);
              const pct = Math.min(100, (used / allow.estMinutes) * 100);
              const low = remaining <= Math.max(2, allow.estMinutes * 0.1);
              const mm = String(Math.floor(sessionSec / 60)).padStart(2, "0");
              const ss = String(sessionSec % 60).padStart(2, "0");
              return (
                <div className={`flex flex-col gap-1 rounded-xl border px-3 py-1.5 ${low ? "border-amber-500/50 bg-amber-500/10" : "border-ink-700 bg-ink-900/60"}`}
                  title="Your monthly minute allocation (your LP share of the LiveKit pool). It ticks down live while you stream.">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={low ? "text-amber-300" : "text-emerald-300"}>⏳ {Math.floor(remaining)} min left</span>
                    <span className="text-bone-600">/ {allow.estMinutes} mo</span>
                    <span className="text-bone-400">· ⏱ {mm}:{ss}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
                    <div className={`h-full ${low ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Viewer: request the mic (audio rooms) */}
        {isThis && !lp.canPublish && !isHost && r.mode === "audio" && lp.status === "connected" && (
          <div className="flex items-center justify-center gap-2 border-t border-ink-800 bg-ink-950/70 px-4 py-3">
            {mySpeaker?.status === "requested" ? (
              <button onClick={() => cancelSpeak(id, addr)} className="btn-ghost">
                <Hand size={15} className="text-amber-400" /> Cancel request
              </button>
            ) : (
              <button onClick={async () => { const p = await loadProfile(addr).catch(() => null); requestSpeak(id, addr, p?.username || short(addr), p?.avatar_url || null).catch(() => {}); }} className="btn-primary">
                <Hand size={15} /> Request to speak
              </button>
            )}
          </div>
        )}

        {/* Host: pending speaker requests */}
        {isHost && pending.length > 0 && (
          <div className="border-t border-ink-800 bg-amber-500/5 px-4 py-2.5">
            <p className="mb-2 text-xs font-semibold text-amber-300">Wants to speak ({pending.length})</p>
            <div className="flex flex-wrap gap-2">
              {pending.map((s) => (
                <div key={s.wallet} className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-1 pr-2">
                  <Avatar url={s.avatar} name={s.name || s.wallet} />
                  <span className="max-w-[7rem] truncate text-xs font-semibold text-bone-200">{s.name || short(s.wallet)}</span>
                  <button onClick={() => setSpeakerStatus(id, s.wallet, "approved")} className="text-emerald-400 hover:text-emerald-300" title="Approve"><Check size={15} /></button>
                  <button onClick={() => setSpeakerStatus(id, s.wallet, "removed")} className="text-bone-500 hover:text-danger-400" title="Reject"><X size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat / People column (desktop) */}
      <div className={`flex min-h-0 flex-col border-t border-ink-800 lg:w-[340px] lg:flex-none lg:border-l lg:border-t-0 ${chatOpen ? "" : "hidden lg:flex"}`}>
        <div className="flex items-stretch border-b border-ink-800 text-sm font-bold">
          <button onClick={() => setRightTab("chat")} className={`flex flex-1 items-center justify-center gap-1.5 py-3 ${rightTab === "chat" ? "border-b-2 border-blood-500 text-bone-50" : "text-bone-400 hover:text-bone-200"}`}>
            <MessageSquare size={15} /> Chat
          </button>
          <button onClick={() => setRightTab("people")} className={`flex flex-1 items-center justify-center gap-1.5 py-3 ${rightTab === "people" ? "border-b-2 border-blood-500 text-bone-50" : "text-bone-400 hover:text-bone-200"}`}>
            <Users size={15} /> People <span className="rounded-full bg-ink-700 px-1.5 text-[11px] text-bone-200">{lp.count}</span>
          </button>
        </div>

        {rightTab === "people" ? (
          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3 min-h-[220px]">
            {lp.participants.length === 0 && <p className="py-10 text-center text-sm text-bone-600">No one here yet.</p>}
            {lp.participants.map((p) => (
              <RosterRow key={p.identity} p={p} canMod={isHost && !p.isLocal}
                onMute={() => mod(p, "mute")} onRemove={() => mod(p, "remove")} onBan={() => ban(p)} />
            ))}
            {isHost && bans.length > 0 && (
              <div className="mt-3 border-t border-ink-800 pt-2">
                <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-bone-600 mb-1">Banned ({bans.length})</p>
                {bans.map((b) => (
                  <div key={b} className="flex items-center gap-2 px-2 py-1 text-xs text-bone-400">
                    <span className="font-mono truncate flex-1">{short(b)}</span>
                    <button onClick={() => { unbanWallet(id, b); setBans((x) => x.filter((y) => y !== b)); }} className="text-bone-500 hover:text-emerald-400">unban</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 min-h-[220px]">
              {messages.length === 0
                ? <p className="py-10 text-center text-sm text-bone-600">Say gm to {r.host_name || short(r.host)} 👋</p>
                : messages.map((m) => <ChatRow key={m.id} m={m} host={m.wallet.toLowerCase() === r.host.toLowerCase()} />)}
              <div ref={chatEnd} />
            </div>
            {/* Buy the streamer's token right from chat */}
            <div className="border-t border-ink-800">
              <button onClick={() => setBuyOpen((o) => !o)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 transition">
                <ArrowLeft size={13} className="rotate-90" /> Buy ${r.token_symbol}
              </button>
              {buyOpen && (
                <div className="px-2 pb-2 max-h-[60vh] overflow-y-auto">
                  <CasinoTokenSwap token={r.token_addr} symbol={r.token_symbol} />
                </div>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-ink-800 p-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500}
                placeholder={w.address ? "Message…" : "Connect to chat…"}
                className="h-10 flex-1 rounded-full border border-ink-600 bg-ink-900 px-4 text-sm outline-none focus:border-blood-500 placeholder:text-bone-600" />
              <button type="submit" disabled={!draft.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-blood-500 text-ink-950 hover:bg-blood-400 disabled:opacity-40">
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>

      {obs && <ObsModal rtmpUrl={obs.rtmp_url} streamKey={obs.stream_key} onClose={() => setObs(null)} />}

      {/* In-app "End stream?" confirm — replaces the browser's native confirm() */}
      {confirmEnd && (
        <ConfirmModal
          title="End this stream?"
          body={isHost ? "Your broadcast will stop and the room will close for everyone." : "You'll leave this room."}
          confirmLabel={ending ? "Ending…" : "End stream"}
          busy={ending}
          onConfirm={endStream}
          onClose={() => setConfirmEnd(false)}
        />
      )}

      {/* On-screen tip pop — token logo + who + amount, auto-dismisses. */}
      {tipToast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-fade-up">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/50 bg-ink-900/95 px-4 py-3 shadow-[0_0_40px_-8px_rgba(16,185,129,0.8)] backdrop-blur">
            {tipToast.l
              ? <img src={tipToast.l} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500/60" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              : <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"><HandCoins size={20} /></span>}
            <div>
              <div className="text-sm"><b className="text-emerald-300">{tipToast.from}</b> <span className="text-bone-300">tipped</span></div>
              <div className="font-mono text-lg font-bold text-bone-50">{fmtInt(tipToast.a)} {tipToast.s} 🎁</div>
            </div>
          </div>
        </div>
      )}

      {/* In-app toast — replaces alert() for OBS / moderation errors */}
      <Toast msg={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, busy, onConfirm, onClose }: {
  title: string; body: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[96] grid place-items-center p-4">
      <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm panel p-5 animate-fade-up">
        <div className="mb-1 inline-flex items-center gap-2 text-danger-300"><ShieldAlert size={16} /><span className="text-sm font-bold text-bone-50">{title}</span></div>
        <p className="text-sm text-bone-400 mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="btn-ghost text-sm disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-4 py-2 text-sm font-bold text-white hover:bg-danger-500 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <PhoneOff size={14} />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[97] w-[min(92vw,26rem)] -translate-x-1/2 animate-fade-up">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-ink-900/95 px-4 py-3 shadow-2xl backdrop-blur">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="flex-1 text-[13px] leading-snug text-bone-200">{msg}</p>
        <button onClick={onClose} className="shrink-0 text-bone-500 hover:text-bone-200"><X size={15} /></button>
      </div>
    </div>
  );
}

function OverlayMsg({ m }: { m: LiveMsg }) {
  return (
    <div className="text-[13px] leading-snug drop-shadow">
      <span className="font-bold text-blood-300">{m.name || short(m.wallet)}</span>
      <span className="text-bone-500">: </span>
      <span className="text-bone-50">{m.body}</span>
    </div>
  );
}

function ChatRow({ m, host }: { m: LiveMsg; host: boolean }) {
  const tip = parseTip(m.body);
  if (tip) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-transparent px-2.5 py-2">
        {tip.l
          ? <img src={tip.l} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-emerald-500/50 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          : <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0"><HandCoins size={14} /></span>}
        <div className="min-w-0 text-sm">
          <b className="text-emerald-300">{tip.from}</b> <span className="text-bone-300">tipped</span> <b className="text-bone-50">{fmtInt(tip.a)} {tip.s}</b> 🎁
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <Avatar url={m.avatar} name={m.name || m.wallet} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${host ? "bg-blood-500 text-ink-950" : "bg-ink-700 text-bone-200"}`}>{m.name || short(m.wallet)}</span>
          <span className="shrink-0 text-[10px] text-bone-600">{timeAgo(new Date(m.created_at).getTime() / 1000)}</span>
        </div>
        <p className="mt-0.5 break-words text-sm text-bone-200">{m.body}</p>
      </div>
    </div>
  );
}

function Ctrl({ active, onClick, on, off, label }: { active: boolean; onClick: () => void; on: React.ReactNode; off: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-bone-50 text-ink-950" : "bg-ink-800 text-bone-200 hover:bg-ink-700"}`}>
      {active ? on : off} {label}
    </button>
  );
}

// Tip the streamer in THEIR token (0.1% decay slippage applies on transfer).
function TipButton({ room }: { room: LiveRoomRow }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const self = w.address && w.address.toLowerCase() === room.host.toLowerCase();
  if (self) return null;

  async function tip() {
    setMsg(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const n = parseFloat(amt); if (!(n > 0)) return;
    setBusy(true);
    try {
      const dec: number = await new Contract(room.token_addr, ERC20, readProvider).decimals().catch(() => 18);
      const tx = await new Contract(room.token_addr, ERC20, w.signer).transfer(room.host, parseUnits(amt, dec));
      await tx.wait();
      setMsg(`Tipped ${fmtInt(n)} ${room.token_symbol} ✓`); setAmt(""); setOpen(false);
      // Announce the tip in chat (marker) → shows as a tip card + on-screen toast.
      const from = w.profile?.name || short(w.address);
      const meta: TipMeta = { a: n, s: room.token_symbol, l: room.token_logo || "", from };
      sendLiveMessage({ roomId: room.id, wallet: w.address, name: w.profile?.name || null, avatar: w.profile?.avatar || null, body: `${TIP_PREFIX}${JSON.stringify(meta)}` }).catch(() => {});
    } catch (e: any) { setMsg(e?.shortMessage || e?.reason || e?.message || "Tip failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 px-3.5 py-1.5 text-xs font-bold text-ink-950 shadow-[0_0_18px_-4px_rgba(16,185,129,0.7)] hover:from-emerald-400 hover:to-emerald-500 transition active:scale-95">
        <HandCoins size={14} /> Tip
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-ink-600 bg-ink-850 p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-bone-100">Tip {room.host_name || short(room.host)}</span>
              <button onClick={() => setOpen(false)} className="text-bone-500 hover:text-bone-200"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.0"
                className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-blood-500" />
              <span className="text-xs font-mono text-bone-400">{room.token_symbol}</span>
            </div>
            <div className="mt-1 flex gap-1">
              {[100, 1000, 10000].map((v) => (
                <button key={v} onClick={() => setAmt(String(v))} className="flex-1 rounded-md bg-ink-800 py-1 text-[11px] font-mono text-bone-300 hover:bg-ink-700">{v >= 1000 ? v / 1000 + "K" : v}</button>
              ))}
            </div>
            <button onClick={tip} disabled={busy} className="w-full mt-2 py-2 text-sm inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 font-bold text-ink-950 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 transition">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />} Send tip
            </button>
            {msg && <div className="mt-1.5 text-[11px] font-mono text-bone-300">{msg}</div>}
            <p className="mt-1.5 text-[10px] text-bone-600 leading-snug">Sent in ${room.token_symbol}. A ~0.1% decay slippage applies on transfer.</p>
          </div>
        </>
      )}
    </div>
  );
}

function RosterRow({ p, canMod, onMute, onRemove, onBan }: {
  p: LiveParticipant; canMod: boolean; onMute: () => void; onRemove: () => void; onBan: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-800/60">
      <span className="relative">
        <Avatar url={p.avatar} name={p.name} />
        {p.speaking && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-ink-900" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-bone-100 truncate">
          {p.host && <Crown size={11} className="text-amber-400 shrink-0" />}{p.name}
          {p.isLocal && <span className="text-[9px] text-bone-600">(you)</span>}
        </span>
        {p.speaker && <span className="text-[10px] font-mono text-emerald-400">speaker</span>}
      </span>
      {p.micOn ? <Mic size={13} className="text-emerald-400 shrink-0" /> : <MicOff size={13} className="text-bone-600 shrink-0" />}
      {canMod && (
        <span className="flex items-center gap-1 shrink-0">
          <button onClick={onMute} title="Mute" className="text-bone-500 hover:text-amber-400"><VolumeX size={14} /></button>
          <button onClick={onRemove} title="Remove" className="text-bone-500 hover:text-danger-400"><UserX size={14} /></button>
          <button onClick={onBan} title="Ban" className="text-bone-500 hover:text-danger-500"><X size={14} /></button>
        </span>
      )}
    </div>
  );
}

function ObsModal({ rtmpUrl, streamKey, onClose }: { rtmpUrl: string; streamKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState<"url" | "key" | null>(null);
  const [showKey, setShowKey] = useState(false);
  // Never write an empty/undefined value to the clipboard — that copies the
  // literal "undefined". createIngress guarantees both are set, but guard anyway.
  const copy = (t: string, w: "url" | "key") => {
    if (!t) return;
    navigator.clipboard?.writeText(t).then(() => { setCopied(w); setTimeout(() => setCopied(null), 1500); });
  };
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md panel p-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-bone-50"><Radio size={18} className="text-blood-400" /> Stream with OBS</h2>
          <button onClick={onClose} className="text-bone-500 hover:text-bone-200"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-bone-400">OBS → <b>Settings → Stream</b>: Service <b>Custom</b>. Paste the Server + Key below, then <b>Start Streaming</b>. Tick "share system/tab audio" to send PC sound.</p>
        <label className="mb-1 block text-xs font-semibold text-bone-300">Server (RTMP URL)</label>
        <div className="mb-3 flex gap-2">
          <input readOnly value={rtmpUrl} className="h-11 min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm" />
          <button onClick={() => copy(rtmpUrl, "url")} className="btn-ghost shrink-0 text-xs">{copied === "url" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Copy</button>
        </div>
        <label className="mb-1 block text-xs font-semibold text-bone-300">Stream key</label>
        <div className="flex gap-2">
          <input readOnly value={streamKey} type={showKey ? "text" : "password"} className="h-11 min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm" />
          <button onClick={() => setShowKey((s) => !s)} className="btn-ghost shrink-0 text-xs" title={showKey ? "Hide" : "Show"}>{showKey ? "Hide" : "Show"}</button>
          <button onClick={() => copy(streamKey, "key")} className="btn-ghost shrink-0 text-xs">{copied === "key" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Copy</button>
        </div>
        <p className="mt-3 text-[11px] text-bone-600">Keep the key private. OBS appears in the room automatically once connected.</p>
      </div>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const [bad, setBad] = useState(false);
  if (url && !bad) return <img src={url} alt="" onError={() => setBad(true)} className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-ink-600" />;
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-700 text-[9px] font-bold text-bone-200">{(name || "?").replace(/^0x/, "").slice(0, 2).toUpperCase()}</span>;
}
