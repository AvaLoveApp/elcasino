import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Heart, TrendingUp } from "lucide-react";
import { loadTrendSummary, TrendSummary } from "../lib/analytics";
import { useProfiles } from "../lib/profileCache";
import { short } from "../lib/util";

/**
 * Discovery strip for Explore — trending posts (by likes in the last window) and
 * the most active authors. Everything derived on-chain from PostCreated / Liked
 * events, no backend. Mirrors the "what's happening" panels in social apps.
 */
export function TrendingStrip() {
  const [t, setT] = useState<TrendSummary | null>(null);
  useEffect(() => {
    let live = true;
    loadTrendSummary(72).then((d) => { if (live) setT(d); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const authorAddrs = t ? [...t.trendingPosts.map((p) => p.author), ...t.activeAuthors.map((a) => a.author)] : [];
  const profiles = useProfiles(authorAddrs);
  const name = (a: string) => {
    const p = profiles[a.toLowerCase()];
    return p?.displayName || (p?.username ? `@${p.username}` : short(a));
  };
  const to = (a: string) => {
    const p = profiles[a.toLowerCase()];
    return p?.username ? `/u/${p.username}` : `/a/${a}`;
  };

  if (!t || (t.trendingPosts.length === 0 && t.activeAuthors.length === 0)) return null;

  return (
    <div className="mb-5 grid gap-3 lg:grid-cols-2">
      {/* Trending posts */}
      {t.trendingPosts.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-blood-400 mb-2">
            <Flame size={12} /> Trending · {t.windowHours}h
          </div>
          <div className="divide-y divide-ink-700/60">
            {t.trendingPosts.slice(0, 4).map((p, i) => (
              <Link key={p.id} to={`/p/${p.id}`} className="flex items-start gap-2.5 py-2 group">
                <span className="w-4 text-right font-mono text-xs text-bone-600 tabular-nums shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-bone-200 line-clamp-2 group-hover:text-bone-50">{p.text || "(media / quote)"}</div>
                  <div className="font-mono text-[11px] text-bone-500 mt-0.5 inline-flex items-center gap-2">
                    <span className="text-blood-400">{name(p.author)}</span>
                    <span className="inline-flex items-center gap-1"><Heart size={9} /> {p.likes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active authors */}
      {t.activeAuthors.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 mb-2">
            <TrendingUp size={12} /> Most active · {t.windowHours}h
          </div>
          <div className="divide-y divide-ink-700/60">
            {t.activeAuthors.slice(0, 5).map((a, i) => (
              <Link key={a.author} to={to(a.author)} className="flex items-center gap-3 py-2 hover:text-bone-50">
                <span className="w-4 text-right font-mono text-xs text-bone-600 tabular-nums">{i + 1}</span>
                <span className="flex-1 font-medium truncate">{name(a.author)}</span>
                <span className="font-mono text-xs text-bone-400 tabular-nums">{a.count} post{a.count === 1 ? "" : "s"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
