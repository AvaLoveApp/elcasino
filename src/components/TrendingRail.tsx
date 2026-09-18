import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Coins, Dices, Users, MessageSquare, Heart, Loader2 } from "lucide-react";
import { loadCasinoAnalytics, loadCasinoTokens, isBlockedCasinoToken, type RoomRow } from "../lib/casino";
import { loadDexMap, type DexToken } from "../lib/dexscreener";
import { ADDR } from "../lib/chain";
import { loadProfilesPaged, type Profile } from "../lib/midchat";
import { loadTrendingPosts, type Post } from "../lib/social";
import { short } from "../lib/util";
import { Avatar } from "./Avatar";

type Tab = "tokens" | "games" | "users" | "posts";
const TABS: { key: Tab; label: string; icon: typeof Coins }[] = [
  { key: "tokens", label: "Tokens", icon: Coins },
  { key: "games", label: "Games", icon: Dices },
];

function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

/** Avalove-style TRENDING card — Tokens / Games / Users / Posts, lazy per tab. */
export function TrendingRail() {
  const [tab, setTab] = useState<Tab>("tokens");
  const [tokens, setTokens] = useState<DexToken[] | null>(null);
  const [games, setGames] = useState<RoomRow[] | null>(null);
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    let live = true;
    if (tab === "tokens" && tokens === null)
      loadCasinoTokens().then(async (addrs) => {
        const map = await loadDexMap(addrs).catch(() => new Map<string, DexToken>());
        if (!live) return;
        setTokens(Array.from(map.values()).filter((t) => t.address.toLowerCase() !== ADDR.token.toLowerCase() && !isBlockedCasinoToken(t.address, t.symbol) && !!t.pairAddress).sort((a, b) => (b.priceChangeH24 ?? -999) - (a.priceChangeH24 ?? -999)).slice(0, 6));
      }).catch(() => setTokens([]));
    if (tab === "games" && games === null)
      loadCasinoAnalytics().then((a) => { if (live) setGames((a.topRooms || []).filter((r) => !isBlockedCasinoToken(r.token, r.symbol)).slice(0, 6)); }).catch(() => setGames([]));
    if (tab === "users" && users === null)
      loadProfilesPaged(0, 6).then((r) => { if (live) setUsers(r); }).catch(() => setUsers([]));
    if (tab === "posts" && posts === null)
      loadTrendingPosts(6).then((r) => { if (live) setPosts(r); }).catch(() => setPosts([]));
    return () => { live = false; };
  }, [tab, tokens, games, users, posts]);

  const loading =
    (tab === "tokens" && tokens === null) || (tab === "games" && games === null) ||
    (tab === "users" && users === null) || (tab === "posts" && posts === null);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-blood-400 mb-2">
        <TrendingUp size={13} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Trending</span>
      </div>
      <div className="flex gap-1 rounded-lg bg-ink-900/70 border border-ink-700/60 p-0.5 mb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition ${tab === t.key ? "bg-ink-600 text-bone-50" : "text-bone-400 hover:text-bone-100"}`}>
              <Icon size={12} />{t.label}
            </button>
          );
        })}
      </div>

      {loading && <div className="py-6 text-center text-bone-600"><Loader2 size={16} className="animate-spin mx-auto" /></div>}

      {tab === "tokens" && tokens && (
        <List empty={tokens.length === 0 ? "No casino tokens yet." : null}>
          {tokens.map((t, i) => (
            <Row key={t.address} to="/trade" i={i} logo={t.logo} sym={t.symbol}
              title={t.symbol} sub={t.priceUsd ? "$" + (Number(t.priceUsd) < 1 ? Number(t.priceUsd).toPrecision(3) : Number(t.priceUsd).toFixed(2)) : undefined}
              right={t.priceChangeH24 != null ? (t.priceChangeH24 >= 0 ? "+" : "") + t.priceChangeH24.toFixed(1) + "%" : "—"} rightSub="24h" />
          ))}
        </List>
      )}
      {tab === "games" && games && (
        <List empty={games.length === 0 ? "No live rooms." : null}>
          {games.map((g, i) => (
            <Row key={g.address} to={`/casino/room/${g.gameKey}/${g.address}`} i={i} logo={g.logo} sym={g.symbol}
              title={g.betName || `${g.label}`} sub={`${g.label} · ${g.bets} bets`} right={fmt(g.pool)} rightSub={g.symbol} />
          ))}
        </List>
      )}
      {tab === "users" && users && (
        <List empty={users.length === 0 ? "No members yet." : null}>
          {users.map((u, i) => (
            <Row key={u.wallet} to={`/a/${u.wallet}`} i={i} logo={u.avatar_url} sym={u.username}
              title={u.username || short(u.wallet)} sub={short(u.wallet)} avatar />
          ))}
        </List>
      )}
      {tab === "posts" && posts && (
        <List empty={posts.length === 0 ? "No posts yet." : null}>
          {posts.map((p, i) => (
            <Link key={p.id} to={`/a/${p.wallet}`} className="flex items-start gap-2 py-1.5 group">
              <span className="w-4 text-right font-mono text-[10px] text-bone-600 tabular-nums pt-0.5">{i + 1}</span>
              <Avatar uri={p.avatar_url} name={p.username || short(p.wallet)} size={22} ring={false} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-bone-100 truncate group-hover:text-blood-300">{p.username || short(p.wallet)}</div>
                <div className="text-[11px] text-bone-400 line-clamp-2 leading-snug">{p.text || (p.kind === "token" ? "shared a token" : p.kind === "game" ? "shared a game" : "")}</div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono text-bone-500 pt-0.5"><Heart size={10} />{p.like_count}</span>
            </Link>
          ))}
        </List>
      )}
    </div>
  );
}

function List({ children, empty }: { children: React.ReactNode; empty: string | null }) {
  if (empty) return <div className="py-4 text-center text-bone-600 text-xs">{empty}</div>;
  return <div className="space-y-1">{children}</div>;
}

function Row({ to, i, logo, sym, title, sub, right, rightSub, avatar }: {
  to: string; i: number; logo?: string; sym: string; title: string; sub?: string; right?: string; rightSub?: string; avatar?: boolean;
}) {
  return (
    <Link to={to} className="flex items-center gap-2 py-1.5 group">
      <span className="w-4 text-right font-mono text-[10px] text-bone-600 tabular-nums">{i + 1}</span>
      {avatar
        ? <Avatar uri={logo} name={sym} size={24} ring={false} />
        : logo
          ? <img src={logo} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
          : <span className="grid h-6 w-6 place-items-center rounded-full bg-blood-500 text-ink-950 text-[10px] font-bold shrink-0">{(sym || "?")[0]}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-bone-100 truncate group-hover:text-blood-300">{title}</div>
        {sub && <div className="font-mono text-[10px] text-bone-500 truncate">{sub}</div>}
      </div>
      {right && (
        <div className="text-right shrink-0">
          <div className="font-mono text-[11px] text-bone-200 tabular-nums">{right}</div>
          {rightSub && <div className="font-mono text-[9px] text-bone-600">{rightSub}</div>}
        </div>
      )}
    </Link>
  );
}
