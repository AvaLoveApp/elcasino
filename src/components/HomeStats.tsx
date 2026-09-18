import { useEffect, useState } from "react";
import { Dices, Coins, MessageSquare, Users } from "lucide-react";
import { loadCasinoAnalytics } from "../lib/casino";
import { countPosts, countMembers } from "../lib/social";

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

/**
 * Home stats bar — avalove-style Games / Bets / Posts / Members strip that sits
 * atop the MIDGARD feed. Casino aggregates come from the cached analytics scan;
 * post/member counts are cheap head-only Supabase counts.
 */
export function HomeStats() {
  const [s, setS] = useState<{ games: number; bets: number; posts: number; members: number } | null>(null);

  useEffect(() => {
    let live = true;
    // Defer so it doesn't compete with the feed's first paint.
    const t = setTimeout(async () => {
      const [ca, posts, members] = await Promise.all([
        loadCasinoAnalytics().catch(() => null),
        countPosts().catch(() => 0),
        countMembers().catch(() => 0),
      ]);
      if (live) setS({ games: ca?.totalGames ?? ca?.rooms ?? 0, bets: ca?.bets ?? 0, posts, members });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, []);

  const tiles: { k: string; v?: number; icon: React.ReactNode }[] = [
    { k: "Games", v: s?.games, icon: <Dices size={12} /> },
    { k: "Bets", v: s?.bets, icon: <Coins size={12} /> },
    { k: "Posts", v: s?.posts, icon: <MessageSquare size={12} /> },
    { k: "Members", v: s?.members, icon: <Users size={12} /> },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div key={t.k} className="rounded-xl border border-ink-700/70 bg-ink-900/40 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wider text-bone-500 inline-flex items-center gap-1">{t.icon}{t.k}</div>
          <div className="text-lg font-bold tabular-nums text-bone-50 leading-tight mt-0.5">{t.v == null ? "…" : fmt(t.v)}</div>
        </div>
      ))}
    </div>
  );
}
