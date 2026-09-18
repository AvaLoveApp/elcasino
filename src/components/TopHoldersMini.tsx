import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Trophy } from "lucide-react";
import { CHAIN, ADDR, readMidgard } from "../lib/chain";
import { fmtInt, short } from "../lib/util";
import { tierForBalance } from "../lib/holderTier";
import { TierBadge } from "./TierBadge";

const CACHE_MS = 10 * 60_000;
let cache: { at: number; rows: Row[] } | null = null;

type Row = { addr: string; balance: number; excluded: boolean };

/**
 * Compact top-holders widget for the right rail. Same Blockscout source as
 * HoldersCard, but only pulls the top 5 and skips the yearly-decay column so
 * it fits comfortably in a narrow column. Uses a 10-minute shared cache.
 */
export function TopHoldersMini({ limit = 5 }: { limit?: number }) {
  const [rows, setRows] = useState<Row[] | null>(cache ? cache.rows.slice(0, limit) : null);

  useEffect(() => {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      setRows(cache.rows.slice(0, limit));
      return;
    }
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${CHAIN.explorer}/api/v2/tokens/${ADDR.token}/holders`);
        if (!res.ok) throw new Error("blockscout " + res.status);
        const j: any = await res.json();
        const items: any[] = j.items || [];
        const m = readMidgard();
        const parsed: Row[] = items.slice(0, 10).map((it) => ({
          addr: it.address?.hash || it.address,
          balance: Number(formatUnits(it.value ?? "0", 18)),
          excluded: false,
        }));
        const excl = await Promise.all(parsed.map((h) => m.isExcluded(h.addr).catch(() => false)));
        parsed.forEach((h, i) => (h.excluded = !!excl[i]));
        cache = { at: Date.now(), rows: parsed };
        if (live) setRows(parsed.slice(0, limit));
      } catch { /* keep previous */ }
    })();
    return () => { live = false; };
  }, [limit]);


  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-blood-400 mb-3">
        <Trophy size={14} className="text-amber-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Top holders</span>
      </div>
      {!rows && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-7 rounded" />
          ))}
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="text-xs text-bone-500 font-mono">no holders yet.</div>
      )}
      {rows && rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const tier = tierForBalance(r.balance);
            return (
              <li key={r.addr} className="flex items-center gap-2 text-sm">
                <span className={`shrink-0 w-4 text-right font-mono text-[10px] tabular-nums ${
                  i === 0 ? "text-amber-300" : i === 1 ? "text-bone-300" : i === 2 ? "text-orange-300" : "text-bone-600"
                }`}>{i + 1}</span>
                <a href={`${CHAIN.explorer}/address/${r.addr}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 min-w-0 flex-1 hover:text-bone-50">
                  <span className="font-mono text-xs truncate">{short(r.addr)}</span>
                  <TierBadge tier={tier} />
                </a>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-bone-400 shrink-0">
                  {fmtInt(r.balance)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
