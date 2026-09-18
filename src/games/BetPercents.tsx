import { formatUnits } from "ethers";

/**
 * Quick bet-size buttons (10% / 25% / 50% / MAX of balance), clamped to the
 * room's max bet (10% of pool). Shared across all single-bet games.
 */
export function BetPercents({ bal, maxBet, decimals, onPick, disabled }: {
  bal: bigint | null; maxBet: bigint; decimals: number; onPick: (v: string) => void; disabled?: boolean;
}) {
  function pick(pct: number) {
    if (bal == null) return;
    // MAX leaves a 0.1% buffer: economy tokens keep decaying, so an exact-balance
    // bet can revert (settle-decay shrinks the balance before the transfer check).
    let amt = pct >= 100 ? (bal * 999n) / 1000n : (bal * BigInt(pct)) / 100n;
    if (maxBet > 0n && amt > maxBet) amt = maxBet; // never exceed the max-bet cap
    onPick(formatUnits(amt, decimals));
  }
  return (
    <div className="flex gap-1.5 mt-2">
      {[10, 25, 50, 100].map((p) => (
        <button key={p} onClick={() => pick(p)} disabled={disabled || bal == null}
          className="flex-1 text-[11px] font-mono rounded-lg py-1.5 border border-ink-600 text-bone-400 hover:border-blood-500/50 hover:text-blood-300 disabled:opacity-40">
          {p === 100 ? "MAX" : `${p}%`}
        </button>
      ))}
    </div>
  );
}
