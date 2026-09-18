import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatUnits } from "ethers";
import { Flame, Droplets, Scale, ArrowLeftRight, BarChart3, TrendingUp, TrendingDown, LineChart, Sparkles, Gauge, Zap } from "lucide-react";
import { readMidgard, readPair, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { useWallet } from "../lib/wallet";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark, MidMark } from "./UnitMark";
import { MiniPriceChart } from "./MiniPriceChart";
import { EconomyEngine, Eco } from "./EconomyEngine";
import { SwapCard } from "./SwapCard";
import { SwapTicker } from "./SwapTicker";

type SubTab = "overview" | "stats";
const SUBTABS: { key: SubTab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: LineChart },
  { key: "stats", label: "Stats", icon: BarChart3 },
];

const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnualPct = (persec: number) =>
  persec > 0 ? (1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR)) * 100 : 0;

type Hero = { eco: Eco; buyFee: number; sellFee: number; myBal: number | null };

/**
 * In-feed ELCAS tab — MM-terminal-style landing: big live price with a direction
 * arrow, hero tiles, the price chart, the economy-engine cards, and an inline
 * swap. Reads on-chain, refreshes every few seconds.
 */
export function MidgardTab() {
  const w = useWallet();
  const [h, setH] = useState<Hero | null>(null);
  const prevPrice = useRef<number | null>(null);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const [sub, setSub] = useState<SubTab>(() => {
    try { return (localStorage.getItem("midgard.feed.midtab") as SubTab) || "overview"; }
    catch { return "overview"; }
  });
  const pickSub = (s: SubTab) => { setSub(s); try { localStorage.setItem("midgard.feed.midtab", s); } catch {} };

  const load = useCallback(async () => {
    try {
      const m = readMidgard();
      const [supply, burned, reflected, phiRaw, rates, incSup, pair, buyF, sellF] = await Promise.all([
        m.totalSupply(), m.totalPoolBurned(), m.totalReflected(), m.currentPhi(),
        m.currentRates(), m.includedSupply(), m.primaryPair(),
        m.feeBuyBps().catch(() => 0n), m.feeSellBps().catch(() => 0n),
      ]);
      let poolMid = 0, poolEth = 0;
      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const p = readPair(pair);
        const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
        const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
        poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
        poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
      }
      const supplyN = Number(formatUnits(supply, 18));
      const price = poolMid ? poolEth / poolMid : 0;
      if (prevPrice.current !== null && price !== prevPrice.current) {
        setDir(price > prevPrice.current ? 1 : -1);
      }
      prevPrice.current = price;
      let myBal: number | null = null;
      if (w.address) myBal = Number(formatUnits(await m.balanceOf(w.address), 18));
      const eco: Eco = {
        supply: supplyN, burned: Number(formatUnits(burned, 18)),
        reflected: Number(formatUnits(reflected, 18)),
        poolMid, poolEth, price, circulating: Number(formatUnits(incSup, 18)),
        holderAnnual: perSecToAnnualPct(Number(rates[0])),
        poolAnnual: perSecToAnnualPct(Number(rates[1])),
        phi: Number(formatUnits(phiRaw, 18)),
        feeTotal: (Number(buyF) + Number(sellF)) / 100,
      };
      setH({ eco, buyFee: Number(buyF) / 100, sellFee: Number(sellF) / 100, myBal });
    } catch { /* keep last snapshot */ }
  }, [w.address]);

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  return (
    <div className="px-4 sm:px-6 py-4 space-y-4 animate-fade-up">
      <div className="panel p-5 bg-gradient-to-br from-blood-900/15 to-transparent">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src="./elcasino_logo.png" alt="" className="w-12 h-12 rounded-full ring-1 ring-ink-600 shadow-blood" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight leading-none">{TOKEN_SYMBOL}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mg-live-dot" /> live
                </span>
              </div>
              <span className="font-mono text-xs text-bone-400">the economy behind the network</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono font-bold text-2xl tabular-nums inline-flex items-center gap-1.5 transition-colors ${
              dir === 1 ? "text-emerald-400" : dir === -1 ? "text-blood-400" : "text-bone-50"}`}>
              {dir === 1 && <TrendingUp size={18} />}
              {dir === -1 && <TrendingDown size={18} />}
              {h ? fmtPrice(h.eco.price) : "…"}
            </div>
            <div className="text-[11px] font-mono text-bone-500 inline-flex items-center gap-0.5"><EthMark />ETH per <MidMark />{TOKEN_SYMBOL}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <MiniTile icon={<Droplets size={12} />} k="Liquidity" v={h ? <span className="inline-flex items-center gap-1">{h.eco.poolEth.toFixed(4)} <EthMark />ETH</span> : "…"} />
          <MiniTile icon={<Flame size={12} />} k="Pool burned" v={h ? fmtInt(h.eco.burned) : "…"} tone="loss" />
          <MiniTile icon={<Scale size={12} />} k="Supply" v={h ? fmtInt(h.eco.supply) : "…"} />
        </div>

        <div className="flex gap-1 mt-4 rounded-xl bg-ink-900/60 border border-ink-700/70 p-1">
          {SUBTABS.map((t) => {
            const Icon = t.icon;
            const on = sub === t.key;
            return (
              <button key={t.key} onClick={() => pickSub(t.key)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition ${
                  on ? "bg-blood-600/90 text-bone-50 shadow-blood" : "text-bone-400 hover:text-bone-100"}`}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {sub === "overview" && (
        <>
          <MiniPriceChart />
          {h ? <EconomyEngine eco={h.eco} /> : <div className="panel p-4 h-40 skeleton" />}
          {h && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-blood-400">
                <ArrowLeftRight size={14} />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Trade {TOKEN_SYMBOL}</span>
              </div>
              <SwapCard poolEth={h.eco.poolEth} poolMid={h.eco.poolMid}
                buyFeeBps={h.buyFee * 100} sellFeeBps={h.sellFee * 100}
                price={h.eco.price} balance={h.myBal} onSwapped={load} />
            </div>
          )}
          <SwapTicker />
        </>
      )}

      {sub === "stats" && (
        h ? <MidgardStats eco={h.eco} /> : <div className="panel p-8 text-center text-bone-500">loading stats…</div>
      )}
    </div>
  );
}

/** Compact economy stat grid for the ELCAS Stats sub-tab. */
function MidgardStats({ eco }: { eco: Eco }) {
  const net = Math.max(0, eco.poolAnnual - eco.holderAnnual);
  const cell = (icon: React.ReactNode, k: string, v: string, sub?: string, tone?: "gain" | "loss") => (
    <div className="panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bone-400 font-mono">{icon}{k}</div>
      <div className={`font-mono font-semibold text-lg mt-1 tabular-nums ${tone === "gain" ? "text-emerald-400" : tone === "loss" ? "text-danger-400" : "text-bone-50"}`}>{v}</div>
      {sub && <div className="text-[10px] text-bone-600 font-mono mt-0.5">{sub}</div>}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cell(<Sparkles size={12} />, "Reflected", fmtInt(eco.reflected), "paid to holders", "gain")}
        {cell(<TrendingDown size={12} />, "Holder decay", `~${eco.holderAnnual.toFixed(0)}%/yr`, "holders shrink")}
        {cell(<Flame size={12} />, "Pool burn", `~${eco.poolAnnual.toFixed(0)}%/yr`, "price↑", "loss")}
        {cell(<Zap size={12} />, "Holder net", `+${net.toFixed(0)}%/yr`, "pool − holder", "gain")}
        {cell(<Gauge size={12} />, "LP share (φ)", `${(eco.phi * 100).toFixed(1)}%`, "drives rates")}
        {cell(<Scale size={12} />, "Swap fee", `${eco.feeTotal.toFixed(0)}%`, "→ 100% reflection")}
      </div>
      <Link to="/analytics" className="btn-ghost w-full inline-flex items-center justify-center gap-1.5 py-2 text-sm">
        <TrendingUp size={14} /> Open full analytics terminal
      </Link>
    </div>
  );
}

function MiniTile({ icon, k, v, tone }: { icon: React.ReactNode; k: string; v: React.ReactNode; tone?: "loss" }) {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/50 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-bone-500 font-mono">{icon}{k}</div>
      <div className={`font-mono font-semibold text-base mt-1 tabular-nums ${tone === "loss" ? "text-danger-400" : "text-bone-50"}`}>{v}</div>
    </div>
  );
}
