import { useMemo, useState } from "react";
import { Zap, TrendingUp, TrendingDown, Flame, Sparkles, RotateCcw } from "lucide-react";
import { RangeInput } from "./RangeInput";
import { TOKEN_SYMBOL } from "../lib/chain";
import { simulateMiga, type MigaRow as Row } from "../lib/migaSim";

/**
 * Live economy simulator for the token Yield tab — drives the SHARED on-chain
 * model (lib/migaSim) so its default output equals the "year-end estimate"
 * badges. Seeded from live φ / decay rates; adjust the sliders to explore.
 */

export function EconomySimulator({ supply, poolMid, circulating, holderAnnual, poolAnnual, phi, feeTotal }: {
  supply: number; poolMid: number; circulating: number; holderAnnual: number; poolAnnual: number; phi: number; feeTotal: number;
}) {
  const liveLpPct = supply > 0 ? (poolMid / supply) * 100 : 0;

  const [lp, setLp] = useState(Math.max(1, Math.min(95, Math.round(phi * 100) || 40)));
  const [hbase, setHbase] = useState(Math.round(holderAnnual) || 40);
  const [spread, setSpread] = useState(Math.max(0, Math.round(poolAnnual - holderAnnual)) || 25);
  const [volumeX, setVolumeX] = useState(12);
  const [shock, setShock] = useState(0);

  const rows = useMemo(() => simulateMiga({
    lpPct: lp / 100, hbase: hbase / 100, target: spread / 100, heal: 0.15,
    fee: (feeTotal || 4) / 100, volumeX, months: 24, shockPct: shock / 100, shockMonth: 6,
  }), [lp, hbase, spread, volumeX, feeTotal, shock]);

  const y1 = rows[12] ?? rows[rows.length - 1];
  const last = rows[rows.length - 1];
  const priceYr = y1.price - 1;
  const burnYr = y1.cumBurn;                       // fraction of initial pool burned
  const holderYr = y1.holder - 1;                  // passive holder ELCAS change (decay only)
  const holderValueYr = y1.holder * y1.price - 1;  // holder value in ETH terms
  const reset = () => { setLp(Math.max(1, Math.min(95, Math.round(phi * 100) || 40))); setHbase(Math.round(holderAnnual) || 40); setSpread(Math.max(0, Math.round(poolAnnual - holderAnnual)) || 25); setVolumeX(12); setShock(0); };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1 text-blood-400">
        <Zap size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Economy simulator · live</span>
        <button onClick={reset} className="ml-auto btn-ghost text-[11px] py-1 px-2 inline-flex items-center gap-1"><RotateCcw size={11} /> reset</button>
      </div>
      <p className="text-[12px] text-bone-500 mb-3">Live pool holds {liveLpPct < 0.01 ? liveLpPct.toFixed(3) : liveLpPct.toFixed(1)}% of supply (φ={(phi * 100).toFixed(1)}%). Drag to explore a year of the differential-decay economy.</p>

      <div className="grid sm:grid-cols-3 gap-x-6 gap-y-3 mb-4">
        <Ctl label="LP share (φ)" value={lp} set={setLp} min={1} max={95} suffix="%" />
        <Ctl label="Holder decay" value={hbase} set={setHbase} min={0} max={95} suffix="%/yr" />
        <Ctl label="Target spread" value={spread} set={setSpread} min={0} max={60} suffix="%/yr" />
        <Ctl label="Swap volume" value={volumeX} set={setVolumeX} min={0} max={60} suffix="× pool" />
        <Ctl label="Shock buy (mo. 6)" value={shock} set={setShock} min={0} max={60} suffix="% pool" />
      </div>

      <SimChart rows={rows} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <Out icon={<TrendingUp size={13} />} label="Price · 1yr" value={pct(priceYr)} tone={priceYr >= 0 ? "gain" : "loss"} sub={`${last.price.toFixed(2)}× at 2yr`} />
        <Out icon={<Flame size={13} />} label="Pool burned · 1yr" value={pct(burnYr)} tone="loss" sub="out of the pool" />
        <Out icon={<Sparkles size={13} />} label="Holder value · 1yr" value={pct(holderValueYr)} tone={holderValueYr >= 0 ? "gain" : "loss"} sub="in ETH (price − decay)" />
        <Out icon={<TrendingDown size={13} />} label="Holder tokens · 1yr" value={pct(holderYr)} tone={holderYr >= 0 ? "gain" : "loss"} sub="count (decay only)" />
      </div>
      <p className="text-[10px] font-mono text-bone-600 mt-3">A teaching model — real outcomes depend on live volume. No ETH is minted; price rises as the pool's {TOKEN_SYMBOL} is burned. In a sustained sell-off, holders still lose ETH — only new buyers fund gains.</p>
    </div>
  );
}

const pct = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(Math.abs(n) < 0.1 ? 1 : 0) + "%";

function Ctl({ label, value, set, min, max, step = 1, suffix }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step?: number; suffix: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5"><span className="text-[11px] text-bone-400">{label}</span><span className="font-mono text-xs text-bone-100">{value}{suffix}</span></div>
      <RangeInput min={min} max={max} step={step} value={value} onChange={set} />
    </div>
  );
}

function Out({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: "gain" | "loss" }) {
  const c = tone === "gain" ? "text-emerald-400" : "text-blood-400";
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/50 p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-bone-500 truncate">{icon}{label}</div>
      <div className={`font-mono font-bold text-lg mt-0.5 tabular-nums truncate ${c}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-bone-600 truncate">{sub}</div>}
    </div>
  );
}

function SimChart({ rows }: { rows: Row[] }) {
  const w = 720, h = 170, padT = 8, padB = 8;
  const plotH = h - padT - padB;
  const xs = (m: number) => (m / (rows.length - 1)) * w;
  const series = [
    { color: "#10b981", label: "Price", vals: rows.map((r) => r.price) },
    { color: "#B01B21", label: `Pool ${TOKEN_SYMBOL}`, vals: rows.map((r) => r.poolMid) },
    { color: "#f59e0b", label: "Holder tokens", vals: rows.map((r) => r.holder) },
  ];
  const path = (vals: number[]) => {
    const lo = Math.min(...vals), hi = Math.max(...vals), rng = Math.max(hi - lo, 1e-9);
    return "M" + vals.map((v, i) => `${xs(i).toFixed(1)},${(padT + plotH - ((v - lo) / rng) * plotH).toFixed(1)}`).join(" L");
  };
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full block" style={{ height: h }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={padT + plotH * f} y2={padT + plotH * f} stroke="currentColor" className="text-ink-700" strokeWidth={0.5} strokeDasharray="3 4" />)}
        {series.map((sr) => <path key={sr.label} d={path(sr.vals)} stroke={sr.color} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] font-mono">
        {series.map((sr) => <span key={sr.label} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: sr.color }} />{sr.label}</span>)}
        <span className="ml-auto text-bone-600">24 months →</span>
      </div>
    </div>
  );
}
