import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, Coins, Dices, Activity, Flame, Users, ChevronRight } from "lucide-react";
import { Profile, loadProfilesPaged, loadProfileByUsername } from "../lib/midchat";
import { Avatar } from "../components/Avatar";
import { MemberTick } from "../components/MemberTick";
import { useIsMember } from "../lib/memberCache";
import { TrendingStrip } from "../components/TrendingStrip";
import { HotRooms } from "../components/CasinoAnalytics";
import { RWA_PRESETS } from "../lib/rwa";
import { Landmark } from "lucide-react";

const PAGE = 12;

export default function ExplorePage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<{ addr: string; p: Profile }[]>([]);
  const [end, setEnd] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [exactHandle, setExactHandle] = useState<null | { addr: string; p: Profile }>(null);
  const [handleChecking, setHandleChecking] = useState(false);
  const debounce = useRef<any>(null);

  // People come from Supabase now — the social profiles created on connect/login
  // (both wallet and Google/X social logins), replacing the old on-chain registry.
  const load = useCallback(async (off: number) => {
    setLoading(true); setErr(null);
    try {
      const data = await loadProfilesPaged(off, PAGE);
      const next = data.map((p) => ({ addr: p.wallet, p }));
      setRows((prev) => (off === 0 ? next : [...prev, ...next]));
      setEnd(data.length < PAGE);
    } catch {
      setErr("Could not load profiles.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(0); }, [load]);

  // Debounced exact-handle probe against Supabase, so a handle beyond the loaded
  // page still surfaces as a "jump to profile" hit.
  useEffect(() => {
    clearTimeout(debounce.current);
    setExactHandle(null);
    const term = q.replace(/^@/, "").trim();
    if (term.length < 2) { setHandleChecking(false); return; }
    setHandleChecking(true);
    debounce.current = setTimeout(async () => {
      try {
        const p = await loadProfileByUsername(term);
        if (p) setExactHandle({ addr: p.wallet, p });
      } catch { /* ignore */ }
      finally { setHandleChecking(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q]);

  // Local filter of loaded rows by handle / bio.
  const filtered = useMemo(() => {
    const term = q.replace(/^@/, "").trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(({ p }) =>
      p.username?.toLowerCase().includes(term) ||
      p.bio?.toLowerCase().includes(term)
    );
  }, [rows, q]);

  const canMore = !end && !q;

  return (
    <div className="animate-fade-up">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
        <span className="font-mono text-xs text-bone-600">
          {rows.length ? `${rows.length}${end ? "" : "+"} members` : "…"}
        </span>
      </div>

      {/* search */}
      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search handle, name, or bio…"
          className="w-full bg-ink-900/70 border border-ink-600 rounded-full pl-9 pr-9 py-2.5 text-sm outline-none focus:border-blood-500 font-mono placeholder:text-bone-600 placeholder:font-sans" />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-bone-500 hover:text-bone-100">
            <X size={14} />
          </button>
        )}
      </div>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-xl px-4 py-3 mb-4">{err}</div>}

      {/* ── Discovery hub — the whole platform at a glance (hidden while searching) ── */}
      {!q && (
        <div className="space-y-5 mb-6">
          {/* Quick shortcuts across the platform */}
          <div className="grid grid-cols-3 gap-3">
            <ShortcutCard to="/token" icon={<Coins size={18} />} label="ELCAS" sub="trade · earn" color="#f59e0b" />
            <ShortcutCard to="/casino" icon={<Dices size={18} />} label="Casino" sub="10 games" color="#10b981" />
            <ShortcutCard to="/analytics" icon={<Activity size={18} />} label="Analytics" sub="live terminal" color="#B01B21" />
          </div>

          {/* Trending posts + most active authors */}
          <TrendingStrip />

          {/* RWA markets — tokenized real-world assets you can build casino pools around */}
          <section>
            <SectionHeader icon={<Landmark size={13} />} label="RWA markets" to="/casino" cta="play RWA" />
            <RwaMarkets />
          </section>

          {/* Busiest casino rooms platform-wide */}
          <section>
            <SectionHeader icon={<Flame size={13} />} label="Hot rooms" to="/casino?view=analytics" cta="casino analytics" />
            <HotRooms limit={5} />
          </section>

          {/* People header (the directory below) */}
          <SectionHeader icon={<Users size={13} />} label="People on Midgard" />
        </div>
      )}

      {/* exact handle hit */}
      {exactHandle && !filtered.some((r) => r.addr === exactHandle.addr) && (
        <div className="mb-3">
          <div className="text-[11px] font-mono text-bone-500 uppercase tracking-wider mb-1">Exact handle</div>
          <ProfileRow addr={exactHandle.addr} p={exactHandle.p} />
        </div>
      )}
      {q && handleChecking && !exactHandle && (
        <div className="text-xs font-mono text-bone-500 mb-3">checking @{q.replace(/^@/, "")}…</div>
      )}

      {filtered.length === 0 && !loading && !exactHandle && !err ? (
        q ? (
          <div className="text-center py-16 px-6 text-bone-400 border border-dashed border-ink-600 rounded-2xl">
            <div className="text-3xl mb-2">🔍</div>
            No match for <span className="font-mono text-blood-400">"{q}"</span> on the loaded page.
            <div className="text-xs mt-1 text-bone-500">Try scrolling more of the list, or use a full handle.</div>
          </div>
        ) : <EmptyState />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(({ addr, p }) => (
            <ProfileRow key={addr} addr={addr} p={p} />
          ))}
        </div>
      )}

      {loading && (
        <div className="grid sm:grid-cols-2 gap-3 mt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-4 flex gap-3.5 items-center">
              <div className="skeleton h-[52px] w-[52px] rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-1/2 rounded" />
                <div className="skeleton h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {canMore && !loading && (
        <div className="text-center mt-6">
          <button onClick={() => { const n = offset + PAGE; setOffset(n); load(n); }} className="btn-ghost">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function RwaMarkets() {
  // Showcase the tokenized RWAs (skip the utility tokens MIDGARD/WETH).
  const assets = RWA_PRESETS.filter((p) => p.address && p.key !== "midgard" && p.key !== "weth");
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {assets.map((a) => (
        <Link key={a.key} to="/casino"
          className="shrink-0 panel px-3 py-2 flex items-center gap-2 hover:border-emerald-500/50 transition min-w-[92px]">
          {a.logo ? (
            <img src={a.logo} alt="" className="h-7 w-7 rounded-full ring-1 ring-ink-600 object-cover"
              onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; const fb = el.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }} />
          ) : null}
          <span className={`h-7 w-7 rounded-full items-center justify-center text-[10px] font-bold text-bone-50 ${a.logo ? "hidden" : "flex"}`}
            style={{ background: `linear-gradient(140deg, ${a.color}, rgba(0,0,0,0.5))` }}>{a.short}</span>
          <span className="font-mono text-xs font-semibold">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

function ShortcutCard({ to, icon, label, sub, color }: { to: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <Link to={to}
      className="panel p-3 flex flex-col items-center text-center gap-1 hover:border-blood-500/50 transition group">
      <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white mb-0.5 transition group-hover:scale-110"
        style={{ background: `linear-gradient(140deg, ${color}, rgba(0,0,0,0.55))` }}>
        {icon}
      </span>
      <span className="font-semibold text-sm">{label}</span>
      <span className="font-mono text-[10px] text-bone-500">{sub}</span>
    </Link>
  );
}

function SectionHeader({ icon, label, to, cta }: { icon: React.ReactNode; label: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-blood-400">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
      {to && (
        <Link to={to} className="font-mono text-[10px] text-bone-500 hover:text-blood-300 inline-flex items-center gap-0.5 shrink-0">
          {cta} <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

function ProfileRow({ addr, p }: { addr: string; p: Profile }) {
  const isMember = useIsMember(addr);
  return (
    <Link to={`/a/${addr}`}
      className="panel p-4 flex gap-3.5 items-center hover:border-blood-500/60 transition">
      <Avatar uri={p.avatar_url} name={p.username} size={52} ring={false} />
      <div className="min-w-0">
        <div className="font-semibold truncate inline-flex items-center gap-1.5">
          {p.username || addr.slice(0, 8)}
          {p.social && p.social !== "wallet" && <span className="font-mono text-[9px] uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1 py-0.5">{p.social}</span>}
          <MemberTick ok={isMember} />
        </div>
        <div className="font-mono text-xs text-blood-400 truncate">@{p.username}</div>
        {p.bio && <div className="text-sm text-bone-400 truncate mt-0.5">{p.bio}</div>}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="panel text-center py-16 px-6">
      <img src="./elcasino_logo.png" alt="" className="w-14 h-14 rounded-full mx-auto mb-4 ring-1 ring-ink-600 opacity-90" />
      <div className="font-semibold text-lg">No one has arrived yet</div>
      <p className="text-bone-400 text-sm mt-1 max-w-sm mx-auto">
        Be the first to carve your name into Midgard. Connect your wallet and claim a handle.
      </p>
    </div>
  );
}
