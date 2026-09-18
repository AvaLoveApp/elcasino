import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Sparkles, Gauge, TrendingDown, TrendingUp, Droplets, Zap, ArrowRight, RotateCcw, Shield } from "lucide-react";
import { RangeInput } from "../components/RangeInput";
import { TOKEN_SYMBOL } from "../lib/chain";

/**
 * EL-Casino ($ELCAS) Tokenomics — interactive explainer + simulator of the
 * on-chain autonomous differential-decay economy (MidgardFinance.sol):
 *   • price = ETH ÷ ELCAS-in-pool   (constant-product)
 *   • swap fee → 100% reflection to holders (pool & excluded excluded)
 *   • holders decay at h(φ); the pool burns at p(φ) = h + spread(φ), FASTER →
 *     holder net value grows at roughly (p − h)
 *   • φ = pool's share of the float drives the rates: thick pool burns faster,
 *     thin pool self-heals (holders decay faster) so the pool can never brick
 * No ETH is ever minted. Teaching model, monthly steps.
 */

type Row = { m: number; price: number; poolMid: number; holder: number; cumBurn: number };
const pct = (n: number) => (n >= 0 ? "+" : "") + (n * 100).toFixed(n > 0.1 || n < -0.1 ? 0 : 1) + "%";
function smoothstep(x: number, lo: number, hi: number) {
  if (x <= lo) return 0; if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo); return t * t * (3 - 2 * t);
}
function simulateMiga(o: { lpPct: number; hbase: number; target: number; heal: number; fee: number; volumeX: number; months: number; shockPct: number; shockMonth: number }): Row[] {
  const phiFloor = 0.08, phiHi = 0.35;
  let R = Math.max(0.001, o.lpPct), H = Math.max(0.001, 1 - o.lpPct), E = 1;
  const price0 = E / R; let cumBurn = 0, holder = 1;
  const rows: Row[] = [{ m: 0, price: 1, poolMid: R, holder: 1, cumBurn: 0 }];
  const perMonthVol = o.volumeX / 12;
  for (let m = 1; m <= o.months; m++) {
    const phi = R / (R + H);
    const s = smoothstep(phi, phiFloor, phiHi);
    const spread = -o.heal + (o.target + o.heal) * s;
    const hRaw = o.hbase * (1 - phi);
    let hRate: number, pRate: number;
    if (spread >= 0) { hRate = hRaw; pRate = hRaw + spread; } else { hRate = hRaw + (-spread); pRate = hRaw; }
    const hMo = 1 - Math.pow(1 - hRate, 1 / 12), pMo = 1 - Math.pow(1 - pRate, 1 / 12);
    const burn = R * pMo; R -= burn; cumBurn += burn;
    H *= (1 - hMo); holder *= (1 - hMo);
    let vol = E * perMonthVol; if (m === o.shockMonth) vol += E * o.shockPct;
    const buy = vol * 0.52, sell = vol * 0.48;
    if (buy > 0) { const dR = R * buy / (E + buy); R -= dR; E += buy; const f = dR * o.fee; H += dR - f; }
    if (sell > 0 && E > 0) { const price = E / R; const mi = Math.min(sell / price, H * 0.5); const f = mi * o.fee; const ma = mi - f; const eo = E * ma / (R + ma); R += ma; E -= eo; H -= mi; }
    rows.push({ m, price: (E / R) / price0, poolMid: R / Math.max(rows[0].poolMid, 1e-9), holder, cumBurn });
  }
  return rows;
}

export default function TokenomicsPage() {
  const [lp, setLp] = useState(40);
  const [hbase, setHbase] = useState(40);
  const [spread, setSpread] = useState(25);
  const [volumeX, setVolumeX] = useState(12);
  const [shock, setShock] = useState(0);

  const rows = useMemo(() => simulateMiga({
    lpPct: lp / 100, hbase: hbase / 100, target: spread / 100, heal: 0.15,
    fee: 0.04, volumeX, months: 24, shockPct: shock / 100, shockMonth: 6,
  }), [lp, hbase, spread, volumeX, shock]);

  const y1 = rows[12] ?? rows[rows.length - 1];
  const last = rows[rows.length - 1];
  const priceYr = y1.price - 1;
  const burnYr = y1.cumBurn;
  const holderTokensYr = y1.holder - 1;
  const holderValueYr = y1.holder * y1.price - 1;

  const reset = () => { setLp(40); setHbase(40); setSpread(25); setVolumeX(12); setShock(0); };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-blood-400">${TOKEN_SYMBOL} · tokenomics</div>
        <h1 className="text-2xl font-bold tracking-tight">How the economy works</h1>
        <p className="text-bone-400 text-sm mt-1 max-w-2xl leading-relaxed">
          {TOKEN_SYMBOL}'s price rises without printing a single wei of ETH — the pool simply burns faster than
          holders. Here's the machine, then a live simulator you can push to see the numbers yourself.
        </p>
      </div>

      <section className="panel p-5">
        <SectionLabel icon={<Droplets size={13} />} label="The one idea" />
        <div className="grid md:grid-cols-[220px_1fr] gap-5 items-center">
          <PoolViz />
          <div className="text-sm text-bone-300 leading-relaxed space-y-2">
            <p>A DEX pool holds two sides: <b className="text-cyan-300">ETH</b> and <b className="text-blood-300">{TOKEN_SYMBOL}</b>. The price is simply</p>
            <div className="font-mono text-center text-bone-100 bg-ink-900/60 border border-ink-700 rounded-lg py-2">
              price = ETH ÷ {TOKEN_SYMBOL}-in-pool
            </div>
            <p>Both holders and the pool <b className="text-blood-300">decay</b> — but the pool decays <b className="text-emerald-300">faster</b>. With the ETH side unchanged and less {TOKEN_SYMBOL} backing it, each token is worth more. Holder net value grows at roughly <span className="font-mono">(pool rate − holder rate)</span>. No ETH is minted; the denominator just shrinks.</p>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel icon={<RotateCcw size={13} />} label="The levers" />
        <Flywheel />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Lever icon={<Sparkles size={14} />} tone="emerald" title="Reflection"
            body="100% of every swap fee grows holders in place, instantly. Real yield straight from volume — the pool and excluded wallets get none." />
          <Lever icon={<Flame size={14} />} tone="blood" title="Differential decay"
            body="Holders decay slowly; the primary pool burns faster. The gap lifts real price — paid by the LP, captured by holders." />
          <Lever icon={<Gauge size={14} />} tone="cyan" title="φ-adaptive"
            body="Rates track φ = the pool's share of the float. Thick pool → burn faster; thin pool → holders decay faster so the pool's share regrows." />
          <Lever icon={<Shield size={14} />} tone="amber" title="Can't brick"
            body="The pool burn is a % of the reserve, so it can never remove more than exists. Depth can thin, never zero." />
        </div>
      </section>

      <section>
        <SectionLabel icon={<Zap size={13} />} label="Live simulator" />
        <div className="panel p-5">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
            <Slider label="LP share (φ)" value={lp} set={setLp} min={5} max={95} suffix="% of float" />
            <Slider label="Holder decay" value={hbase} set={setHbase} min={0} max={90} suffix="% / yr" />
            <Slider label="Target spread" value={spread} set={setSpread} min={0} max={60} suffix="% / yr" />
            <Slider label="Annual swap volume" value={volumeX} set={setVolumeX} min={0} max={60} suffix="× the pool" />
            <Slider label="Shock buy (month 6)" value={shock} set={setShock} min={0} max={60} suffix={`% of pool ${TOKEN_SYMBOL}`} />
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-bone-500">24-month projection · price starts at 1.00×</span>
            <button onClick={reset} className="btn-ghost text-[11px] py-1 px-2.5 inline-flex items-center gap-1"><RotateCcw size={11} /> reset</button>
          </div>
          <SimChart rows={rows} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <Out label="Price · 1yr" value={pct(priceYr)} tone={priceYr >= 0 ? "gain" : "loss"} sub={`${last.price.toFixed(2)}× at 2yr`} />
            <Out label={`Pool ${TOKEN_SYMBOL} burned · 1yr`} value={pct(burnYr)} tone="loss" sub="out of the pool" />
            <Out label="Holder value · 1yr" value={pct(holderValueYr)} tone={holderValueYr >= 0 ? "gain" : "loss"} sub="in ETH (price − decay)" />
            <Out label="Holder tokens · 1yr" value={pct(holderTokensYr)} tone={holderTokensYr >= 0 ? "gain" : "loss"} sub="count (decay only)" />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel icon={<Flame size={13} />} label="Worked example" />
        <div className="panel p-5 text-sm text-bone-300 leading-relaxed space-y-2.5">
          <p><b className="text-bone-50">Setup:</b> holders decay 40%/yr, the pool burns ~65%/yr (spread +25%) while it's thick.</p>
          <p><b className="text-emerald-300">Holder net:</b> value grows at roughly pool − holder = <span className="font-mono">65% − 40% ≈ +25%/yr</span> in ETH terms, on top of reflection from volume — even though your token count falls with decay.</p>
          <p><b className="text-cyan-300">Self-balancing:</b> as the pool burns, φ falls; once thin, the spread reverses (holders decay faster than the pool) so the pool's share regrows. It oscillates around a healthy depth instead of draining.</p>
          <p className="text-bone-500 text-[13px]">The honest catch: no ETH is minted, so realizable ETH equals ETH ever deposited. In a sustained sell-off holders still lose in ETH — only new buyers fund gains. Push the sliders (try a low volume + shock) to feel it.</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/audit" className="btn-ghost inline-flex items-center gap-1.5 py-2 px-4 text-sm"><ArrowRight size={14} /> Read the security notes</Link>
        <Link to="/token" className="btn-primary inline-flex items-center gap-1.5 py-2 px-4 text-sm">Trade {TOKEN_SYMBOL}</Link>
      </div>
      <p className="text-[11px] font-mono text-bone-600">This is a teaching model, not financial advice or a promise of returns. Real outcomes depend on live volume, holdings and market conditions.</p>
    </div>
  );
}

// ---------------------------------------------------------------- pieces --

function PoolViz() {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-950/60 p-4">
      <div className="flex items-end justify-center gap-4 h-40">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 rounded-t-lg bg-gradient-to-t from-cyan-700 to-cyan-400" style={{ height: 120 }} />
          <span className="font-mono text-[10px] text-cyan-300">ETH</span>
          <span className="font-mono text-[9px] text-bone-600">fixed</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 rounded-t-lg bg-gradient-to-t from-blood-700 to-blood-400 tok-mid-bar" style={{ height: 120 }} />
          <span className="font-mono text-[10px] text-blood-300">{TOKEN_SYMBOL}</span>
          <span className="font-mono text-[9px] text-bone-600">burning ↓</span>
        </div>
      </div>
      <div className="mt-2 text-center tok-rise">
        <div className="font-mono text-[9px] uppercase tracking-wider text-bone-500">price</div>
        <div className="font-mono text-emerald-300 font-bold inline-flex items-center gap-1"><TrendingUp size={13} /> rising</div>
      </div>
    </div>
  );
}

function Flywheel() {
  const nodes = [
    { x: 250, y: 24, label: "Swap volume", c: "#f59e0b" },
    { x: 452, y: 96, label: "Fee → reflection", c: "#10b981" },
    { x: 452, y: 208, label: "Holders grow", c: "#10b981" },
    { x: 250, y: 280, label: "Pool burns faster", c: "#B01B21" },
    { x: 48, y: 208, label: "Price ↑", c: "#10b981" },
    { x: 48, y: 96, label: "φ adapts", c: "#22d3ee" },
  ];
  return (
    <div className="panel p-3 overflow-x-auto">
      <svg viewBox="0 0 560 320" className="w-full" style={{ minWidth: 460, height: 300 }}>
        {nodes.map((n, i) => {
          const nx = nodes[(i + 1) % nodes.length];
          return <line key={i} x1={n.x} y1={n.y} x2={nx.x} y2={nx.y} stroke="#6b2b30" strokeWidth={2} className="tok-flow" />;
        })}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={7} fill={n.c} className="tok-spark" style={{ animationDelay: `${i * 0.3}s` }} />
            <text x={n.x} y={n.y - 14} textAnchor="middle" fill="#c9cdd6" fontSize="12" fontFamily="ui-monospace,monospace">{n.label}</text>
          </g>
        ))}
        <text x={250} y={168} textAnchor="middle" fill="#7a808c" fontSize="11" fontFamily="ui-monospace,monospace">self-reinforcing</text>
      </svg>
    </div>
  );
}

function SimChart({ rows }: { rows: Row[] }) {
  const w = 720, h = 200, padL = 6, padR = 6, padT = 10, padB = 18;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xs = (m: number) => padL + (m / (rows.length - 1)) * plotW;
  const series = [
    { key: "price", color: "#10b981", label: "Price", vals: rows.map((r) => r.price) },
    { key: "lpMid", color: "#B01B21", label: `Pool ${TOKEN_SYMBOL}`, vals: rows.map((r) => r.poolMid) },
    { key: "holder", color: "#f59e0b", label: "Holder tokens", vals: rows.map((r) => r.holder) },
  ];
  const path = (vals: number[]) => {
    const lo = Math.min(...vals), hi = Math.max(...vals), rng = Math.max(hi - lo, 1e-9);
    return "M" + vals.map((v, i) => `${xs(i).toFixed(1)},${(padT + plotH - ((v - lo) / rng) * plotH).toFixed(1)}`).join(" L");
  };
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full block" style={{ height: h }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} x2={w - padR} y1={padT + plotH * f} y2={padT + plotH * f} stroke="currentColor" className="text-ink-700" strokeWidth={0.5} strokeDasharray="3 4" />
        ))}
        {series.map((s) => <path key={s.key} d={path(s.vals)} stroke={s.color} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] font-mono">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-bone-400">{s.label}</span>
          </span>
        ))}
        <span className="ml-auto text-bone-600">each line auto-scaled · 24 months →</span>
      </div>
    </div>
  );
}

function Slider({ label, value, set, min, max, step = 1, suffix }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step?: number; suffix: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-bone-300">{label}</span>
        <span className="font-mono text-sm text-bone-100 tabular-nums">{value} <span className="text-bone-500 text-[11px]">{suffix}</span></span>
      </div>
      <RangeInput min={min} max={max} step={step} value={value} onChange={set} />
    </div>
  );
}

function Out({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "gain" | "loss" | "cyan" }) {
  const c = tone === "gain" ? "text-emerald-400" : tone === "loss" ? "text-danger-400" : "text-cyan-400";
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/50 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500">{label}</div>
      <div className={`font-mono font-bold text-xl mt-0.5 tabular-nums ${c}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-bone-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function Lever({ icon, title, body, tone }: { icon: React.ReactNode; title: string; body: string; tone: "blood" | "emerald" | "amber" | "cyan" }) {
  const c = tone === "blood" ? "text-blood-400" : tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-cyan-400";
  return (
    <div className="panel p-4">
      <div className={`flex items-center gap-1.5 font-semibold text-sm ${c}`}>{icon}<span className="text-bone-50">{title}</span></div>
      <p className="text-[12px] text-bone-400 leading-relaxed mt-1.5">{body}</p>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-blood-400">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
    </div>
  );
}
