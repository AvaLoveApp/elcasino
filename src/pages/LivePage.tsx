import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Radio, Users, Video, Mic, Loader2, Rocket, Sparkles, X, Crown, Clock } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { loadProfile } from "../lib/midchat";
import {
  fetchLiveRooms, subscribeLiveRooms, createLiveRoom, loadLiveEligibility,
  liveConfigured, LiveRoomRow, LiveEligibility, LiveMode,
} from "../lib/live";
import { short } from "../lib/util";

export default function LivePage() {
  const w = useWallet();
  const nav = useNavigate();
  const [rooms, setRooms] = useState<LiveRoomRow[] | null>(null);
  const [ended, setEnded] = useState<LiveRoomRow[]>([]);
  const [elig, setElig] = useState<LiveEligibility | null>(null);
  const [dialog, setDialog] = useState(false);

  const refresh = () => {
    // Live now — most-watched first.
    fetchLiveRooms("live").then((r) => setRooms([...r].sort((a, b) => b.viewers - a.viewers))).catch(() => setRooms([]));
    // Recently ended (discovery when nobody's live).
    fetchLiveRooms("ended").then((r) => setEnded(r.slice(0, 10))).catch(() => {});
  };
  useEffect(() => { refresh(); const un = subscribeLiveRooms(refresh); const t = setInterval(refresh, 15000); return () => { un(); clearInterval(t); }; }, []);

  useEffect(() => {
    if (!w.address) { setElig(null); return; }
    loadLiveEligibility(w.address).then(setElig).catch(() => setElig(null));
  }, [w.address]);

  const live = rooms ?? [];

  return (
    <div className="animate-fade-up space-y-5">
      {/* Hero */}
      <div className="panel p-5 bg-gradient-to-br from-blood-900/20 to-transparent border-blood-500/25">
        <div className="flex items-center gap-2 text-blood-300 mb-1">
          <Radio size={16} /><span className="font-mono text-[10px] uppercase tracking-[0.22em]">EL-Casino Live</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Holders, on air</h1>
            <p className="text-bone-400 text-sm mt-1 max-w-lg">
              The top 100 ELCAS holders can go live in audio or video — the monthly airtime is split equally among them.
              Viewers watch, chat, and tip the streamer.
            </p>
          </div>
          {w.address && (
            <button onClick={() => setDialog(true)} disabled={!elig?.eligible}
              className="btn-primary disabled:opacity-50" title={elig?.eligible ? "Start a broadcast" : "Only top-100 ELCAS holders can go live"}>
              <Radio size={16} /> {elig?.eligible ? "Go Live" : "Go Live (top-100 holders)"}
            </button>
          )}
        </div>
        {w.address && elig && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {elig.eligible ? (
              <>
                {elig.founder
                  ? <Pill icon={<Crown size={11} />} tone="gold">Founder · stream as ELCAS</Pill>
                  : <Pill icon={<Crown size={11} />} tone="gold">Eligible · rank #{elig.rank}</Pill>}
                <Pill icon={<Clock size={11} />} tone={elig.remainingMinutes <= Math.max(2, elig.estMinutes * 0.1) ? "warn" : undefined}>
                  <b className="text-bone-50">{elig.remainingMinutes} min left</b> · {elig.estMinutes}/mo{!elig.founder && ` · ${elig.sharePct.toFixed(1)}% of pool`}
                </Pill>
              </>
            ) : (
              <Pill>Be a top-100 ELCAS holder to unlock streaming.</Pill>
            )}
          </div>
        )}
        {!liveConfigured && (
          <div className="mt-3 text-[11px] font-mono text-amber-300/90 bg-amber-900/15 border border-amber-500/25 rounded-lg px-3 py-2">
            Live A/V backend not configured yet (LiveKit env vars). Rooms + chat still work.
          </div>
        )}
      </div>

      {/* Live now */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blood-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-blood-500" /></span>
        <h2 className="font-bold text-bone-50">Live now</h2>
        <span className="text-xs font-mono text-bone-500">{live.length}</span>
      </div>

      {rooms === null ? (
        <div className="grid place-items-center py-16 text-bone-500"><Loader2 className="animate-spin" /></div>
      ) : live.length === 0 ? (
        <div className="panel p-10 text-center text-bone-500">
          <Radio className="mx-auto h-10 w-10 text-ink-600 mb-2" />
          <div className="font-semibold text-bone-300">No one's live right now</div>
          <div className="text-xs font-mono mt-1">Top-100 token owners can start the first stream.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {live.map((r) => <LiveCard key={r.id} r={r} onOpen={() => nav(`/live/${r.id}`)} />)}
        </div>
      )}

      {/* Recently live — discovery of past broadcasts when the grid is quiet. */}
      {ended.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <Clock size={14} className="text-bone-500" />
            <h2 className="font-bold text-bone-300">Recently live</h2>
            <span className="text-xs font-mono text-bone-600">{ended.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {ended.map((r) => <LiveCard key={r.id} r={r} ended onOpen={() => nav(`/live/${r.id}`)} />)}
          </div>
        </>
      )}

      {dialog && elig?.eligible && <GoLiveDialog elig={elig} onClose={() => setDialog(false)} />}
    </div>
  );
}

function Pill({ children, icon, tone }: { children: React.ReactNode; icon?: React.ReactNode; tone?: "gold" | "warn" }) {
  const c = tone === "gold" ? "text-amber-300 border-amber-500/40 bg-amber-900/15"
    : tone === "warn" ? "text-amber-200 border-amber-500/50 bg-amber-500/10"
    : "text-bone-300 border-ink-600 bg-ink-800";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${c}`}>{icon}{children}</span>;
}

export function LiveCard({ r, onOpen, ended }: { r: LiveRoomRow; onOpen: () => void; ended?: boolean }) {
  return (
    <button onClick={onOpen} className="panel group text-left overflow-hidden p-0 transition hover:border-blood-500/50">
      <div className="relative aspect-video bg-gradient-to-br from-ink-800 to-ink-950 grid place-items-center overflow-hidden">
        {r.thumbnail
          ? <img src={r.thumbnail} alt="" className={`absolute inset-0 h-full w-full object-cover transition group-hover:scale-105 ${ended ? "grayscale opacity-60" : ""}`} />
          : r.token_logo
            ? <img src={r.token_logo} alt="" className={`h-16 w-16 rounded-full object-cover opacity-90 ring-2 ring-ink-700 transition group-hover:scale-105 ${ended ? "grayscale opacity-50" : ""}`} />
            : <span className="grid h-16 w-16 place-items-center rounded-full bg-blood-500 text-2xl font-black text-ink-950">{r.token_symbol[0]}</span>}
        {ended
          ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-ink-700/90 px-1.5 py-0.5 text-[10px] font-black uppercase text-bone-300">Ended</span>
          : <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-blood-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-ink-950">● Live</span>}
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-bone-100"><Users size={11} /> {r.viewers}</span>
        <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-bone-200">
          {r.mode === "audio" ? <Mic size={10} /> : <Video size={10} />} {r.token_symbol}
        </span>
      </div>
      <div className="p-3">
        <div className="truncate font-semibold text-bone-50">{r.title}</div>
        <div className="truncate text-[12px] font-mono text-bone-500 mt-0.5">{r.host_name || short(r.host)}</div>
      </div>
    </button>
  );
}

// ── Go Live dialog (eligible owners) ─────────────────────────────────────────
function GoLiveDialog({ elig, onClose }: { elig: LiveEligibility; onClose: () => void }) {
  const w = useWallet();
  const nav = useNavigate();
  const [tokIdx, setTokIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<LiveMode>("video");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tok = elig.tokens[tokIdx];

  async function start() {
    if (!w.address || !tok) { setErr("Connect your wallet."); return; }
    setBusy(true); setErr(null);
    try {
      const prof = await loadProfile(w.address).catch(() => null);
      const room = await createLiveRoom({
        host: w.address, hostName: prof?.username || short(w.address), hostAvatar: prof?.avatar_url || null,
        tokenAddr: tok.token, tokenSymbol: tok.symbol, tokenLogo: tok.logo || null,
        mode, title: title.trim() || `${tok.symbol} live`,
      });
      onClose();
      nav(`/live/${room.id}`);
    } catch (e: any) { setErr(e?.message || "Couldn't start the stream."); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:py-10">
      <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md panel p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-bone-50"><Radio size={18} className="text-blood-400" /> Go Live</h2>
          <button onClick={onClose} className="text-bone-500 hover:text-bone-200"><X size={18} /></button>
        </div>

        {/* Clear, prominent time budget so the host knows exactly how long they can stream. */}
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-300">
              <Crown size={13} /> {elig.founder ? "Founder" : `Rank #${elig.rank}`}
            </span>
            <span className="text-[10px] font-mono text-bone-500">
              {elig.founder ? "10% of pool" : `${elig.sharePct.toFixed(1)}% of pool`}
            </span>
          </div>
          <div className="mt-1.5 flex items-end gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${elig.remainingMinutes <= Math.max(2, elig.estMinutes * 0.1) ? "text-amber-300" : "text-emerald-300"}`}>{elig.remainingMinutes}</span>
            <span className="text-sm text-bone-400 mb-0.5">min left this month</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, (elig.remainingMinutes / Math.max(1, elig.estMinutes)) * 100)}%` }} />
          </div>
          <div className="mt-1 font-mono text-[10px] text-bone-500">
            {elig.usedMinutes} used · {elig.estMinutes} allocated · {elig.poolMinutes} min total pool
          </div>
        </div>

        {elig.tokens.length > 1 && (
          <div className="mb-3">
            <label className="text-[10px] font-mono uppercase tracking-wider text-bone-500">Stream as</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {elig.tokens.map((t, i) => (
                <button key={t.token} onClick={() => setTokIdx(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${i === tokIdx ? "bg-blood-500 text-ink-950" : "bg-ink-800 text-bone-300"}`}>
                  {t.logo && <img src={t.logo} alt="" className="h-4 w-4 rounded-full object-cover" />} {t.symbol}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="text-[10px] font-mono uppercase tracking-wider text-bone-500">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder={`${tok?.symbol || "Token"} live — ask me anything`}
          className="field mt-1 mb-3" />

        <label className="text-[10px] font-mono uppercase tracking-wider text-bone-500">Mode</label>
        <div className="mt-1 mb-4 grid grid-cols-2 gap-2">
          <ModeBtn active={mode === "video"} onClick={() => setMode("video")} icon={<Video size={16} />} label="Video" />
          <ModeBtn active={mode === "audio"} onClick={() => setMode("audio")} icon={<Mic size={16} />} label="Audio room" />
        </div>

        {err && <div className="text-[11px] font-mono text-danger-300 mb-2">{err}</div>}
        <button onClick={start} disabled={busy} className="btn-primary w-full">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Starting…</> : <><Sparkles size={16} /> Start broadcast</>}
        </button>
        <p className="mt-2 text-[10px] text-bone-600 text-center">You'll be asked to sign a message to mint your stream key (no gas).</p>
      </div>
    </div>,
    document.body,
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${active ? "border-blood-500 bg-blood-500/15 text-bone-50" : "border-ink-600 bg-ink-850 text-bone-300 hover:border-blood-500/40"}`}>
      {icon} {label}
    </button>
  );
}
