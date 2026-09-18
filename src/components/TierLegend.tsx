import { useEffect, useState } from "react";
import { readMidgard } from "../lib/chain";
import { useWallet } from "../lib/wallet";
import { tierForBalance } from "../lib/holderTier";
import { TierBadge } from "./TierBadge";
import { RankProgress } from "./RankProgress";
import { fmtInt } from "../lib/util";

const LADDER = [
  tierForBalance(1_000_001),
  tierForBalance(250_001),
  tierForBalance(50_001),
  tierForBalance(5_001),
  tierForBalance(501),
];
const MINS = [1_000_000, 250_000, 50_000, 5_000, 500];

/**
 * Rank ladder shown on the Token page. When a wallet is connected we render
 * the full RankProgress card (own tier, next-threshold bar, checkable ladder);
 * otherwise show a static ladder so anonymous visitors still see the ranks.
 */
export function TierLegend() {
  const w = useWallet();
  const [bal, setBal] = useState<bigint | null>(null);

  useEffect(() => {
    if (!w.address) { setBal(null); return; }
    let live = true;
    readMidgard().balanceOf(w.address!).then((b: bigint) => { if (live) setBal(b); }).catch(() => {});
    return () => { live = false; };
  }, [w.address]);

  if (bal !== null) return <RankProgress bal={bal} showCTA />;

  // Anonymous fallback — the ranks still need to feel real without a wallet.
  return (
    <div className="panel p-4">
      <div className="text-[11px] font-mono text-bone-500 uppercase tracking-wider mb-3">Ranks of EL-Casino</div>
      <div className="grid gap-2">
        {LADDER.map((t, i) => (
          <div key={t.key} className="flex items-center gap-2.5 text-xs">
            <TierBadge tier={t} size="md" />
            <span className={`font-semibold text-sm ${t.ring}`}>{t.label}</span>
            <span className="ml-auto font-mono text-bone-500">{fmtInt(MINS[i])}+</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-ink-700/60 font-mono text-[11px] text-bone-500">
        connect a wallet to see your rank + next threshold.
      </div>
    </div>
  );
}
