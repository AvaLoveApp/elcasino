import { formatUnits } from "ethers";
import { Link } from "react-router-dom";
import { tierForBalance, TierKey } from "../lib/holderTier";
import { TierBadge } from "./TierBadge";
import { fmtInt } from "../lib/util";

const LADDER: { key: TierKey; min: number }[] = [
  { key: "thane", min: 500 },
  { key: "berserker", min: 5_000 },
  { key: "jarl", min: 50_000 },
  { key: "einherjar", min: 250_000 },
  { key: "aesir", min: 1_000_000 },
];

/**
 * Rich rank card — current tier, MIDGARD held, progress bar to the next
 * threshold, and the entire ladder with checkmarks. Drop-in for a profile
 * page hero row or a token dashboard side panel. No RPC of its own; caller
 * passes the balance (usually from `useTier`).
 */
export function RankProgress({ bal, hideLadder = false, showCTA = false }: {
  bal: bigint;
  hideLadder?: boolean;
  showCTA?: boolean;
}) {
  const whole = Number(formatUnits(bal, 18));
  const mine = tierForBalance(whole);
  const nextIdx = LADDER.findIndex((r) => whole < r.min);
  const next = nextIdx >= 0 ? LADDER[nextIdx] : null;
  const floor = nextIdx > 0 ? LADDER[nextIdx - 1].min : 0;
  const progress = next ? Math.min(1, Math.max(0, (whole - floor) / (next.min - floor))) : 1;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-3">
        {mine.key !== "none" ? (
          <>
            <TierBadge tier={mine} size="lg" />
            <div className="min-w-0">
              <div className={`font-semibold text-base ${mine.ring}`}>{mine.label}</div>
              <div className="font-mono text-[11px] text-bone-500">{fmtInt(whole)} ELCAS</div>
            </div>
          </>
        ) : (
          <>
            <div className="h-7 w-7 rounded-full border border-ink-600 bg-ink-900 flex items-center justify-center text-bone-600 text-xs font-mono">?</div>
            <div>
              <div className="font-semibold text-sm text-bone-300">Unranked</div>
              <div className="font-mono text-[11px] text-bone-500">{fmtInt(whole)} ELCAS</div>
            </div>
          </>
        )}
        {showCTA && next && (
          <Link to="/token" className="ml-auto btn-ghost py-1 px-2.5 text-[11px] font-mono">buy</Link>
        )}
      </div>

      {next && (
        <div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #B01B21, #f59e0b, #fbbf24)",
              }} />
          </div>
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-bone-500">
            <span>{mine.key === "none" ? "start" : mine.label}</span>
            <span className="text-blood-400">
              {fmtInt(next.min - whole)} ELCAS to <span className="text-bone-200">{tierForBalance(next.min).label}</span>
            </span>
          </div>
        </div>
      )}

      {!hideLadder && (
        <div className="grid gap-1.5 pt-2 border-t border-ink-700/50">
          {[...LADDER].reverse().map((r) => {
            const t = tierForBalance(r.min);
            const reached = whole >= r.min;
            return (
              <div key={r.key} className={`flex items-center gap-2.5 text-xs ${reached ? "" : "opacity-40"}`}>
                <TierBadge tier={t} />
                <span className={`font-semibold ${t.ring}`}>{t.label}</span>
                <span className="ml-auto font-mono text-bone-500">{fmtInt(r.min)}+</span>
                {reached && <span className="text-emerald-400 font-mono text-[10px]">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
