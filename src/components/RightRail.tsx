import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatUnits } from "ethers";
import { ExternalLink, TrendingUp, Sparkles, Coins, Activity as ActivityIcon, Dices, Rocket, ArrowUpRight, ArrowDownRight, Search, Loader2 } from "lucide-react";
import { Radio, Users, Video, Mic } from "lucide-react";
import { fetchLiveRooms, subscribeLiveRooms, LiveRoomRow } from "../lib/live";
import { searchProfiles, searchPosts, type ProfileHit, type Post as SocialPost } from "../lib/social";
import { loadRobinhoodTokens, type DexToken } from "../lib/dexscreener";
import { Avatar } from "./Avatar";
import { readMidgard, readPair, CHAIN, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { loadTokenMeta, TokenMeta } from "../lib/tokenMeta";
import { loadRecentActivity, Activity } from "../lib/activity";
import { TrendingRail } from "./TrendingRail";
import { fmtInt, fmtPrice, timeAgo, short } from "../lib/util";
import { EthMark, MidMark } from "./UnitMark";

type MidgardSnap = { price: number; poolEth: number; burned: number; reflected: number; netAnnual: number };

const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnualPct = (persec: number) =>
  persec > 0 ? (1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR)) * 100 : 0;

export default function RightRail() {
  return (
    <div className="space-y-4 pt-1">
      <RailSearch />
      <TrendingRail />
      {/* ELCAS token ticker hidden for now — the token economy launches later. */}
      <RecentActivity />
    </div>
  );
}

// ── Recent activity — MIDGARD trades + launches + new casino rooms ────────────
// Platform-wide search with a live dropdown — results appear as you type
// (people · tokens/games · posts), no click needed. Enter / "See all" → /search.
function RailSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ people: ProfileHit[]; tokens: DexToken[]; posts: SocialPost[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    const term = q.trim();
    if (timer.current) clearTimeout(timer.current);
    if (!term) { setR(null); setBusy(false); return; }
    setBusy(true);
    timer.current = setTimeout(async () => {
      const lc = term.toLowerCase();
      const [people, posts, all] = await Promise.all([
        searchProfiles(term, 4).catch(() => [] as ProfileHit[]),
        searchPosts(term, 3).catch(() => [] as SocialPost[]),
        loadRobinhoodTokens().catch(() => [] as DexToken[]),
      ]);
      const tokens = all.filter((t) => t.symbol?.toLowerCase().includes(lc) || t.name?.toLowerCase().includes(lc)).slice(0, 4);
      setR({ people, tokens, posts }); setBusy(false); setOpen(true);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = () => { const t = q.trim(); if (t) { setOpen(false); nav(`/search?q=${encodeURIComponent(t)}`); } };
  const pick = (to: string) => { setOpen(false); setQ(""); nav(to); };
  const has = r && (r.people.length || r.tokens.length || r.posts.length);

  return (
    <div ref={box} className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500 pointer-events-none" />
      <input
        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => q.trim() && setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter") go(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Search people, tokens, games…"
        className="w-full bg-ink-900/70 border border-ink-700 rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:border-blood-500 placeholder:text-bone-600" />

      {open && q.trim() && (
        <div className="absolute z-30 mt-1.5 w-full max-h-[70vh] overflow-y-auto scrollbar-hide rounded-xl border border-ink-700 bg-ink-950/95 backdrop-blur shadow-xl p-1.5">
          {busy && !has && <div className="px-3 py-3 text-xs text-bone-500 inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> searching…</div>}
          {!busy && !has && <div className="px-3 py-3 text-xs text-bone-500">No matches for “{q.trim()}”.</div>}

          {r && r.people.length > 0 && <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-bone-600">People</div>}
          {r?.people.map((p) => (
            <button key={p.wallet} onClick={() => pick(`/a/${p.wallet}`)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-ink-800/70 text-left transition">
              <Avatar uri={p.avatar_url} name={p.username || short(p.wallet)} size={26} ring={false} />
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-bone-100 truncate">{p.username || short(p.wallet)}</div></div>
            </button>
          ))}

          {r && r.tokens.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-bone-600">Tokens & games</div>}
          {r?.tokens.map((t) => (
            <button key={t.address} onClick={() => pick("/casino")} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-ink-800/70 text-left transition">
              {t.logo ? <img src={t.logo} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-ink-600" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-blood-500/20 text-blood-300"><Coins size={12} /></span>}
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-bone-100 truncate">${t.symbol}</div></div>
              <Dices size={12} className="text-emerald-300 shrink-0" />
            </button>
          ))}

          {r && r.posts.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-bone-600">Posts</div>}
          {r?.posts.map((p) => (
            <button key={p.id} onClick={() => pick(`/a/${p.wallet}`)} className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-ink-800/70 text-left transition">
              <Avatar uri={p.avatar_url} name={p.username || short(p.wallet)} size={26} ring={false} />
              <div className="min-w-0 flex-1"><div className="text-[12px] text-bone-300 line-clamp-2">{p.text || "(media)"}</div></div>
            </button>
          ))}

          {has ? <button onClick={go} className="w-full mt-1 px-3 py-1.5 rounded-lg text-[11px] font-mono text-blood-300 hover:bg-ink-800/70 text-center">See all results →</button> : null}
        </div>
      )}
    </div>
  );
}

export function RecentActivity() {
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => loadRecentActivity().then((d) => { if (live) setItems(d); }).catch(() => { if (live) setItems([]); });
    load();
    const h = setInterval(() => { if (!document.hidden) loadRecentActivity(true).then((d) => { if (live) setItems(d); }).catch(() => {}); }, 60_000);
    return () => { live = false; clearInterval(h); };
  }, []);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-blood-400 mb-2.5">
        <ActivityIcon size={14} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Recent activity</span>
        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-emerald-400 ml-1">
          <span className="h-1 w-1 rounded-full bg-emerald-400 mg-live-dot" /> live
        </span>
      </div>
      {items === null ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 rounded-lg skeleton" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-bone-500 font-mono py-2">no activity yet — be the first.</div>
      ) : (
        <div className="space-y-0.5 -mx-1">
          {items.slice(0, 5).map((a) => <ActivityRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  return (
    <Link to={a.href} className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-ink-800/60 transition">
      <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0"
        style={{ background: `${a.color}1f`, border: `1px solid ${a.color}44` }}>
        <ActivityGlyph a={a} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[12px] font-semibold text-bone-100 truncate">{a.title}</div>
        <div className="font-mono text-[10px] text-bone-500 truncate">{a.sub}</div>
      </div>
      <span className="font-mono text-[9px] text-bone-600 shrink-0 tabular-nums">{a.ts ? timeAgo(a.ts) : ""}</span>
    </Link>
  );
}

function ActivityGlyph({ a }: { a: Activity }) {
  if (a.logo) return <img src={a.logo} alt="" className="h-6 w-6 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  if (a.kind === "buy") return <ArrowUpRight size={16} style={{ color: a.color }} />;
  if (a.kind === "sell") return <ArrowDownRight size={16} style={{ color: a.color }} />;
  if (a.kind === "launch") return <Rocket size={15} style={{ color: a.color }} />;
  return <Dices size={15} style={{ color: a.color }} />;
}


/** Live now — token-owner broadcasts with a video preview (the host's captured
 *  thumbnail, falling back to the token logo), sorted largest→smallest by viewers. */
function LiveRail() {
  const [rooms, setRooms] = useState<LiveRoomRow[]>([]);
  useEffect(() => {
    const load = () => fetchLiveRooms("live").then((r) => setRooms(r.slice(0, 3))).catch(() => {});
    load();
    const un = subscribeLiveRooms(load);
    const h = setInterval(load, 15000);
    return () => { un(); clearInterval(h); };
  }, []);
  if (rooms.length === 0) return null;
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Radio size={14} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blood-300">Live now</span>
        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-blood-400">
          <span className="h-1 w-1 rounded-full bg-blood-500 mg-live-dot" /> {rooms.length}
        </span>
        <Link to="/live" className="ml-auto text-[10px] font-mono text-bone-500 hover:text-blood-400">all →</Link>
      </div>
      <div className="space-y-2">
        {rooms.map((r) => (
          <Link key={r.id} to={`/live/${r.id}`}
            className="group block overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/40 transition hover:border-blood-500/50">
            {/* Preview — the host's live thumbnail, else the token logo centered */}
            <div className="relative aspect-video bg-gradient-to-br from-ink-800 to-ink-950">
              {r.thumbnail
                ? <img src={r.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                : r.token_logo
                  ? <img src={r.token_logo} alt="" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-90 ring-2 ring-ink-700" />
                  : <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blood-500 text-lg font-black text-ink-950">{r.token_symbol[0]}</span>}
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-blood-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-ink-950">● Live</span>
              <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-bone-100"><Users size={10} /> {r.viewers}</span>
              <span className="absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-bone-200">
                {r.mode === "audio" ? <Mic size={9} /> : <Video size={9} />} ${r.token_symbol}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[12px] font-semibold text-bone-100">{r.title}</div>
              <div className="truncate text-[10px] font-mono text-bone-500">{r.host_name || short(r.host)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
