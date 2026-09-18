import { useState, useEffect } from "react";
import { formatUnits } from "ethers";
import { Calculator, ArrowRight, Wallet } from "lucide-react";
import { readMidgard, readPair, ADDR } from "../lib/chain";
import { tierForBalance } from "../lib/holderTier";
import { TierBadge } from "./TierBadge";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark, MidMark } from "./UnitMark";
import { useWallet } from "../lib/wallet";

const LADDER = [500, 5_000, 50_000, 250_000, 1_000_000];

/**
 * ETH → MIDGARD → tier hint. Reads current pair price live so users can plan
 * how much ETH to spend to hit their target rank. Ignores slippage — for the
 * pool depths we have, that's fine at the calculator resolution.
 */
export function TierCalculator() {
  const w = useWallet();
  const [price, setPrice] = useState<number | null>(null);
  const [eth, setEth] = useState<string>("0.01");
  const [balHint, setBalHint] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const m = readMidgard();
        const pair = await m.primaryPair();
        if (pair && pair !== "0x0000000000000000000000000000000000000000") {
          const p = readPair(pair);
          const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
          const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
          const mid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
          const wei = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
          if (live && mid > 0) setPrice(wei / mid);
        }
        if (w.address) {
          const bal: bigint = await m.balanceOf(w.address);
          if (live) setBalHint(Number(formatUnits(bal, 18)));
        }
      } catch { /* keep whatever we had */ }
    })();
    return () => { live = false; };
  }, [w.address]);

  const ethN = Number(eth || "0");
  const midOut = price && price > 0 ? ethN / price : 0;
  // After a buy the wallet holds current balance + purchase (rough — ignores
  // the 2% fee taken from the buy side, so this over-estimates slightly).
  const totalAfter = (balHint ?? 0) + midOut;
  const reachedTier = tierForBalance(totalAfter);
  const nextThreshold = LADDER.find((m) => totalAfter < m) ?? null;
  const nextEth = nextThreshold != null && price && price > 0
    ? (nextThreshold - totalAfter) * price
    : null;

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={14} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-blood-400">Rank calculator</span>
        <span className="ml-auto text-[10px] font-mono text-bone-600">
          {price ? <span className="inline-flex items-center gap-0.5">{fmtPrice(price)} <EthMark />ETH / <MidMark />ELCAS</span> : "price loading…"}
        </span>
      </div>

      <label className="block mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-1">
          spend
        </div>
        <div className="rounded-xl border border-ink-600 bg-ink-900/70 px-3 py-2 flex items-center gap-2">
          <input value={eth} onChange={(e) => setEth(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal" placeholder="0.0"
            className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums" />
          <span className="font-mono text-sm text-bone-500 inline-flex items-center gap-1"><EthMark />ETH</span>
        </div>
        <div className="flex gap-1.5 mt-2">
          {["0.001", "0.01", "0.1", "1"].map((v) => (
            <button key={v} onClick={() => setEth(v)}
              className="flex-1 text-[11px] font-mono border border-ink-600 rounded-md py-1 hover:border-blood-500 hover:text-blood-400 transition">
              {v}
            </button>
          ))}
        </div>
      </label>

      <div className="flex items-center justify-between text-sm font-mono mb-3">
        <span className="text-bone-500">gets you</span>
        <span className="text-bone-100 tabular-nums">{fmtInt(midOut)} ELCAS</span>
      </div>

      {balHint !== null && (
        <div className="flex items-center justify-between text-[11px] font-mono mb-3 text-bone-500">
          <span className="inline-flex items-center gap-1"><Wallet size={11} /> already hold</span>
          <span className="tabular-nums">{fmtInt(balHint)} ELCAS</span>
        </div>
      )}

      <div className="rounded-xl border border-blood-500/40 bg-blood-900/15 px-3 py-2.5 flex items-center gap-3">
        <ArrowRight size={13} className="text-blood-400 shrink-0" />
        <span className="text-xs text-bone-400 shrink-0">post-buy total</span>
        <span className="ml-auto flex items-center gap-2 min-w-0">
          <TierBadge tier={reachedTier} />
          <span className="font-mono text-sm tabular-nums text-bone-100 truncate">{fmtInt(totalAfter)}</span>
        </span>
      </div>

      {reachedTier.key === "none" && LADDER[0] > totalAfter && price && price > 0 && (
        <div className="mt-2 text-[11px] font-mono text-bone-500">
          need <span className="text-blood-400">{((LADDER[0] - totalAfter) * price).toFixed(4)} ETH</span> more to reach the first rank
        </div>
      )}
      {nextThreshold && reachedTier.key !== "none" && nextEth !== null && (
        <div className="mt-2 text-[11px] font-mono text-bone-500">
          add <span className="text-blood-400">{nextEth.toFixed(4)} ETH</span> more →{" "}
          <TierBadge tier={tierForBalance(nextThreshold)} />{" "}
          <span className={`${tierForBalance(nextThreshold).ring} font-semibold`}>{tierForBalance(nextThreshold).label}</span>
        </div>
      )}
    </div>
  );
}
