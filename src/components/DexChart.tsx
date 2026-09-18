import { useEffect, useMemo, useState } from "react";
import { ExternalLink, BarChart3 } from "lucide-react";
import { dexTokenByAddress } from "../lib/dexscreener";
import { ROBINHOOD_CHAIN } from "../lib/dexscreener";

/**
 * CEX-style trading chart via the DexScreener embed — real candlesticks, timeframes,
 * volume and trade history for the token's pair, themed dark to match Midgard.
 * Resolves the token's best Robinhood pair, then embeds it. Falls back to `fallback`
 * (e.g. our MiniPriceChart) while resolving or when the token has no DEX pair yet.
 */
export function DexChart({ token, pair, height = 480, fallback }: {
  token?: string;
  pair?: string;            // pass a known pair address to skip resolution
  height?: number;
  fallback?: React.ReactNode;
}) {
  const [resolved, setResolved] = useState<{ pair: string | null; url: string | null }>(
    pair ? { pair, url: null } : { pair: null, url: null },
  );
  const [loading, setLoading] = useState(!pair);

  useEffect(() => {
    // A known pair was passed (e.g. on token switch) — sync it directly. The
    // useState initializer only runs on mount, so without this the iframe would
    // keep showing the previous token's pair.
    if (pair) { setResolved({ pair, url: null }); setLoading(false); return; }
    if (!token) return;
    let live = true;
    setLoading(true);
    dexTokenByAddress(token)
      .then((t) => { if (live) setResolved({ pair: t?.pairAddress ?? null, url: t?.url ?? null }); })
      .catch(() => { if (live) setResolved({ pair: null, url: null }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, pair]);

  const src = useMemo(() => {
    if (!resolved.pair) return null;
    // DexScreener embed — hide their info/trades panels so it reads as a pure chart;
    // the swap + stats live in our own UI beside it.
    const q = "embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15&info=0&trades=0&tabs=0";
    return `https://dexscreener.com/${ROBINHOOD_CHAIN}/${resolved.pair}?${q}`;
  }, [resolved.pair]);

  if (!src) {
    // No pair (or still resolving) → use the fallback chart if given.
    if (loading && !fallback) return <div className="panel grid place-items-center text-bone-500 text-sm" style={{ height }}>Loading chart…</div>;
    return <>{fallback ?? (
      <div className="panel grid place-items-center text-bone-500 text-sm gap-2" style={{ height }}>
        <BarChart3 size={22} className="text-bone-600" />
        No DEX chart yet — this token isn't on DexScreener.
      </div>
    )}</>;
  }

  const pageUrl = resolved.url || `https://dexscreener.com/${ROBINHOOD_CHAIN}/${resolved.pair}`;
  return (
    <div className="panel p-0 overflow-hidden relative" style={{ height }}>
      <iframe
        src={src}
        title="DexScreener chart"
        className="w-full h-full block border-0"
        loading="lazy"
        allow="clipboard-write"
      />
      <a href={pageUrl} target="_blank" rel="noreferrer"
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-ink-950/80 border border-ink-600 px-2 py-1 text-[10px] font-mono text-bone-300 hover:text-blood-300 backdrop-blur">
        DexScreener <ExternalLink size={10} />
      </a>
    </div>
  );
}
