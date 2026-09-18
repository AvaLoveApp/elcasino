import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Activity, Droplets, Flame, AlertTriangle, ShieldCheck, Gauge } from "lucide-react";
import { readMidgard, readPair, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { fmtInt, fmtPrice } from "../lib/util";

type Snap = {
  poolMid: number;
  poolEth: number;
  supply: number;
  phi: number;
  holderAnnual: number;
  poolAnnual: number;
  price: number;
};

const HEALTHY_ETH_MIN = 1;
const HEALTHY_LP_FRAC = 0.05;
const THIN_SLIPPAGE_TEST_ETH = 0.05;
const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnualPct = (persec: number) =>
  persec > 0 ? (1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR)) * 100 : 0;

/**
 * Pair health snapshot for the primary ELCAS pair — depth (ETH + ELCAS), slippage
 * estimate for a small buy, LP share of supply, and the live differential-decay
 * state (φ, pool burn rate, holder net). The pool burn is a % of reserve so it
 * can never brick — health degrades to "thin" but never to zero.
 */
export function PoolHealth() {
  const [s, setS] = useState<Snap | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const m = readMidgard();
        const [pair, supply, phiRaw, rates] = await Promise.all([
          m.primaryPair(), m.totalSupply(), m.currentPhi(), m.currentRates(),
        ]);
        if (pair && pair !== "0x0000000000000000000000000000000000000000") {
          const p = readPair(pair);
          const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
          const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
          const poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
          const poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
          if (live) setS({
            poolMid, poolEth,
            supply: Number(formatUnits(supply, 18)),
            phi: Number(formatUnits(phiRaw, 18)),
            holderAnnual: perSecToAnnualPct(Number(rates[0])),
            poolAnnual: perSecToAnnualPct(Number(rates[1])),
            price: poolMid > 0 ? poolEth / poolMid : 0,
          });
        }
      } catch { /* keep last snap */ }
    })();
    return () => { live = false; };
  }, []);

  if (!s) {
    return <div className="panel p-4"><div className="skeleton h-32 rounded" /></div>;
  }

  const k = s.poolMid * s.poolEth;
  const newEth = s.poolEth + THIN_SLIPPAGE_TEST_ETH;
  const newMid = newEth > 0 ? k / newEth : s.poolMid;
  const midOut = Math.max(0, s.poolMid - newMid);
  const impliedPrice = midOut > 0 ? THIN_SLIPPAGE_TEST_ETH / midOut : s.price;
  const slippagePct = s.price > 0 ? ((impliedPrice - s.price) / s.price) * 100 : 0;

  const circulating = Math.max(1, s.supply - s.poolMid);
  const lpFracOfSupply = s.poolMid / Math.max(1, s.supply);
  const holderNet = Math.max(0, s.poolAnnual - s.holderAnnual);

  const healthy = s.poolEth >= HEALTHY_ETH_MIN
    && lpFracOfSupply >= HEALTHY_LP_FRAC
    && Math.abs(slippagePct) < 5;
  const thin = s.poolEth < 0.01 || Math.abs(slippagePct) > 20;

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-blood-400">Pair health</span>
        <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider ${
          healthy ? "text-emerald-400" : thin ? "text-blood-400" : "text-amber-400"
        }`}>
          {healthy ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
          {healthy ? "healthy" : thin ? "thin" : "growing"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <MiniStat k="ETH depth" v={s.poolEth.toFixed(4)} sub="in the pool" icon={<Droplets size={11} />} />
        <MiniStat k={`${TOKEN_SYMBOL} depth`} v={fmtInt(s.poolMid)} sub="in the pool" />
        <MiniStat k="LP / supply" v={(lpFracOfSupply * 100).toFixed(2) + "%"} sub={`${fmtInt(circulating)} circulating`} />
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-bone-400">
            buying <b className="text-bone-100">{THIN_SLIPPAGE_TEST_ETH} ETH</b> right now
          </span>
          <span className="font-mono text-bone-500 tabular-nums">
            → {fmtInt(midOut)} {TOKEN_SYMBOL}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-ink-800 overflow-hidden">
            <div className={`h-full rounded-full ${
              slippagePct < 2 ? "bg-emerald-500" :
              slippagePct < 10 ? "bg-amber-500" :
              "bg-blood-500"
            }`} style={{ width: `${Math.min(100, slippagePct * 5)}%` }} />
          </div>
          <span className={`font-mono text-xs shrink-0 ${
            slippagePct < 2 ? "text-emerald-400" :
            slippagePct < 10 ? "text-amber-400" :
            "text-blood-400"
          }`}>
            {slippagePct.toFixed(2)}% slip
          </span>
        </div>
      </div>

      {/* Differential-decay engine state */}
      <div className="rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-bone-400 inline-flex items-center gap-1">
            <Gauge size={11} /> LP share (φ)
          </span>
          <span className="font-mono text-bone-500 tabular-nums">
            {(s.phi * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-ink-800 overflow-hidden">
          <div className="h-full rounded-full bg-cyan-500"
            style={{ width: `${Math.min(100, s.phi * 100)}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <span className="text-bone-500 inline-flex items-center gap-1"><Flame size={10} className="text-blood-400" /> burn ~{s.poolAnnual.toFixed(0)}%/yr</span>
          <span className="text-bone-500">holder ~{s.holderAnnual.toFixed(0)}%/yr</span>
          <span className="text-emerald-400 text-right">net +{holderNet.toFixed(0)}%/yr</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-ink-700/60 text-[11px] font-mono text-bone-500 leading-relaxed">
        current price {fmtPrice(s.price)} ETH · the pool burns faster than holders (φ-adaptive) so
        real price rises. Thin pool → self-heals; burn is a % of reserve, so it
        <span className="text-bone-200"> can never brick</span>.
      </div>
    </div>
  );
}

function MiniStat({ k, v, sub, icon }: { k: string; v: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-bone-500 font-mono inline-flex items-center gap-1">{icon}{k}</div>
      <div className="font-mono text-sm text-bone-100 tabular-nums mt-0.5">{v}</div>
      {sub && <div className="text-[10px] text-bone-600 font-mono">{sub}</div>}
    </div>
  );
}
