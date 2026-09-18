import { useEffect, useState, useCallback, useRef } from "react";
import { formatUnits } from "ethers";
import { Flame, Sparkles, TrendingDown, Coins, Droplets, Scale, ArrowLeftRight, BarChart3, Waves, Zap, MessageSquare, LayoutGrid, Gauge } from "lucide-react";
import { MidChat } from "../components/MidChat";
import { readMidgard, readPair, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { useWallet } from "../lib/wallet";
import { HoldersCard } from "../components/HoldersCard";
import { RwaHoldings } from "../components/RwaHoldings";
import { EconomySimulator } from "../components/EconomySimulator";
import { PoolHealth } from "../components/PoolHealth";
import { EconomyEngine } from "../components/EconomyEngine";
import { TokenChartsSection } from "../components/TokenCharts";
import { LiveSpark } from "../components/LiveSpark";
import { CoverShowcase } from "../components/CoverShowcase";
import { AppsTab } from "../components/AppsTab";
import { Feed } from "../components/Feed";
import { SectionTabs } from "../components/SectionTabs";
import { TradeTerminal } from "../components/TradeTerminal";
import { TrendingRail } from "../components/TrendingRail";
import { RecentActivity } from "../components/RightRail";
import { loadTokenStats, TokenStats } from "../lib/analytics";
import { EthMark, MidMark } from "../components/UnitMark";
import { fmtInt, fmtPrice } from "../lib/util";

const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnualPct = (persec: number) =>
  persec > 0 ? (1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR)) * 100 : 0;

// Placeholder economy stats for the trade terminal while ELCAS is hidden — the
// terminal runs as a casino-token exchange and never reads these values.
const ZERO_MIDGARD = {
  price: 0, poolEth: 0, poolMid: 0, supply: 0, burned: 0, buyFee: 0, sellFee: 0,
  myBal: null as number | null, mcapEth: 0, pair: "", holderAnnual: 0, poolAnnual: 0,
  phi: 0, circulating: 0, reflected: 0,
};

/**
 * EL-Casino ($ELCAS) — autonomous differential-decay economy.
 * Fee -> reflection (holders); the primary pool burns FASTER than holders at a
 * phi-adaptive rate (holder net gain = pool rate - holder rate); pool burn is a
 * % of reserve so it can never brick. No claim pool, no auto-LP, no mirror-debt.
 */
export type Stats = {
  supply: number; burned: number; reflected: number;
  poolMid: number; poolEth: number; price: number;
  phi: number;              // LP share of float, 0..1
  holderAnnual: number;     // current holder decay %/yr
  poolAnnual: number;       // current pool burn %/yr
  buyFee: number; sellFee: number; myBal: number | null;
  circulating: number;      // public holder float (includedSupply)
  mcapEth: number;
  pair: string;
  maxBurnBps: number;
  fetchedAt: number;
};

function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(3) + "B";
  if (a >= 1e6) { const m = n / 1e6; return (m >= 999.995 ? m.toFixed(3) : m.toFixed(2)) + "M"; }
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtWithDecimals(n: number, decimals: number): string {
  const [i, f] = n.toFixed(decimals).split(".");
  return Number(i).toLocaleString("en-US") + (decimals > 0 ? "." + f : "");
}

/** Count-up / count-down intro for the hero numbers. */
function AnimatedNumber({ value, from = 0, format, duration = 1100, className }: {
  value: number; from?: number; format: (n: number) => string; duration?: number; className?: string;
}) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [txt, setTxt] = useState(() => format(reduce ? value : from));
  const dispRef = useRef(reduce ? value : from);
  const startedRef = useRef(false);
  const rafRef = useRef(0);
  useEffect(() => {
    if (reduce) { dispRef.current = value; setTxt(format(value)); return; }
    const a0 = startedRef.current ? dispRef.current : from;
    const dur = startedRef.current ? 450 : duration;
    startedRef.current = true;
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    let last = "";
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = a0 + (value - a0) * e;
      dispRef.current = v;
      const s = format(v);
      if (s !== last) { last = s; setTxt(s); }
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else { dispRef.current = value; setTxt(format(value)); }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{txt}</span>;
}

type Tab = "trade" | "apps" | "yield" | "midchat";
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "trade", label: "Trade", icon: ArrowLeftRight },
  { key: "apps", label: "Apps", icon: LayoutGrid },
  { key: "yield", label: "Yield", icon: Zap },
  { key: "midchat", label: "MidChat", icon: MessageSquare },
];

// Yield groups the economy detail behind its own sub-tabs. No "Claim" sub any
// more — ELCAS pays holders via instant reflection, nothing to claim.
type YieldSub = "yield" | "stats" | "pools";
const YIELD_SUBS: { key: YieldSub; label: string; icon: any }[] = [
  { key: "yield", label: "Yield", icon: Zap },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "pools", label: "Pools", icon: Waves },
];

export default function TokenPage({ section }: { section?: Tab } = {}) {
  const w = useWallet();
  const [s, setS] = useState<Stats | null>(null);
  const [hist, setHist] = useState<TokenStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const stored = localStorage.getItem("midgard.token.tab");
      return (stored as Tab) || "trade";
    } catch { return "trade"; }
  });
  const retryRef = useRef(0);
  const activeTab: Tab = section ?? tab;

  const load = useCallback(async () => {
    try {
      const m = readMidgard();
      const [supply, burned, reflected, phiRaw, rates, incSup, pair, buyF, sellF, maxBurn] = await Promise.all([
        m.totalSupply(), m.totalPoolBurned(), m.totalReflected(), m.currentPhi(),
        m.currentRates(), m.includedSupply(), m.primaryPair(), m.feeBuyBps(), m.feeSellBps(), m.maxBurnBps(),
      ]);
      let poolEth = 0, poolMid = 0;
      if (pair && pair !== "0x0000000000000000000000000000000000000000") {
        const p = readPair(pair);
        const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
        const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
        poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
        poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
      }
      let myBal: number | null = null;
      if (w.address) myBal = Number(formatUnits(await m.balanceOf(w.address), 18));
      const supplyN = Number(formatUnits(supply, 18));
      const circulating = Number(formatUnits(incSup, 18));  // public holder float
      const price = poolMid ? poolEth / poolMid : 0;
      setS({
        supply: supplyN,
        burned: Number(formatUnits(burned, 18)),
        reflected: Number(formatUnits(reflected, 18)),
        poolMid, poolEth, price,
        phi: Number(formatUnits(phiRaw, 18)),
        holderAnnual: perSecToAnnualPct(Number(rates[0])),
        poolAnnual: perSecToAnnualPct(Number(rates[1])),
        buyFee: Number(buyF) / 100, sellFee: Number(sellF) / 100, myBal,
        circulating, mcapEth: circulating * price,
        pair: (pair && pair !== "0x0000000000000000000000000000000000000000") ? pair : "",
        maxBurnBps: Number(maxBurn),
        fetchedAt: Date.now(),
      });
      retryRef.current = 0;
      setErr(null);
    } catch {
      setS((prev) => {
        if (prev) return prev;
        retryRef.current += 1;
        if (retryRef.current <= 5) { setTimeout(() => load(), 1200); }
        else { setErr("Network is busy — retrying…"); }
        return prev;
      });
    }
  }, [w.address]);

  // Only the Yield section reads the ELCAS economy; the Trade terminal is a
  // casino-token exchange now, so we don't poll the (unlaunched) ELCAS token there.
  const needsEconomy = section === "yield";

  useEffect(() => {
    if (!needsEconomy) return;
    load();
    // Pause polling while the tab is hidden (backgrounded), and refresh once on
    // return — idle background tabs otherwise keep hammering the RPC for nothing.
    const h = setInterval(() => { if (!document.hidden) load(); }, 12000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", onVis); };
  }, [load, needsEconomy]);

  useEffect(() => {
    if (!needsEconomy) return;
    let live = true;
    const t = setTimeout(() => { loadTokenStats().then((h) => { if (live) setHist(h); }).catch(() => {}); }, 1500);
    return () => { live = false; clearTimeout(t); };
  }, [needsEconomy]);

  return (
    <div className="animate-fade-up">
      {!section && <CoverShowcase onRefresh={() => load()} />}

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-xl px-4 py-3 my-4">{err}</div>}

      {section && section !== "trade" && <div className="mt-1"><SectionTabs /></div>}

      {s && section === "yield" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <Tile k="Price" sub={<><EthMark />ETH per <MidMark />{TOKEN_SYMBOL}</>}
            v={<AnimatedNumber value={s.price} format={fmtPrice} />}
            spark={<LiveSpark value={s.price} color="#f59e0b" seed={hist?.priceHistory.map((d) => d.value)} />} />
          <Tile k="Liquidity" icon={<Droplets size={13} />} sub={<><MidMark />{fmtCompact(s.poolMid)} {TOKEN_SYMBOL}</>}
            v={<span className="inline-flex items-center gap-1"><AnimatedNumber value={s.poolEth} format={(n) => n.toFixed(4)} /> <EthMark />ETH</span>}
            spark={<LiveSpark value={s.poolEth} color="#10b981" seed={hist?.liquidityHistory.map((d) => d.value)} />} />
          <Tile k="Pool burned" icon={<Flame size={13} />} sub="differential burn → price↑" tone="loss"
            v={<AnimatedNumber value={s.burned} format={fmtCompact} />}
            spark={<LiveSpark value={s.burned} color="#B01B21" seed={hist?.cumulativeBurn.map((d) => d.value)} />} />
          <Tile k="Supply" icon={<Scale size={13} />} sub="deflating live" valueClass="text-base sm:text-lg"
            v={<AnimatedNumber value={s.supply} from={1e9} format={(n) => fmtWithDecimals(n, 0)} />}
            spark={<LiveSpark value={s.supply} color="#b4ff2e" />} />
        </div>
      )}

      {!section && <div className="mt-4"><Feed /></div>}

      {section === "apps" && <div className="mt-4"><AppsTab /></div>}

      {section === "trade" && (
        <div className="mt-1">
          {/* ELCAS token hidden for now — the trade terminal is a casino-token
              exchange until the ELCAS economy launches. */}
          <TradeTerminal hideMidgard midgard={s ? {
            price: s.price, poolEth: s.poolEth, poolMid: s.poolMid, supply: s.supply, burned: s.burned,
            buyFee: s.buyFee, sellFee: s.sellFee, myBal: s.myBal, mcapEth: s.mcapEth, pair: s.pair,
            holderAnnual: s.holderAnnual, poolAnnual: s.poolAnnual, phi: s.phi,
            circulating: s.circulating, reflected: s.reflected,
          } : ZERO_MIDGARD} onSwapped={load} />
          {/* Trending + Recent activity — moved here from the old Home rail. */}
          <div className="grid gap-4 mt-4 lg:grid-cols-2">
            <TrendingRail />
            <RecentActivity />
          </div>
        </div>
      )}

      {section === "yield" && s && (
        <div className="space-y-4 mt-4">
          <YieldTabs s={s} />
        </div>
      )}

      {section === "yield" && !s && !err && (
        <div className="text-center text-bone-400 py-16">Loading token data…</div>
      )}
    </div>
  );
}

/** Yield hub — economy detail behind sub-tabs (Yield sim · Stats · Pools). */
function YieldTabs({ s }: { s: Stats }) {
  const [sub, setSub] = useState<YieldSub>(() => {
    try { return (localStorage.getItem("midgard.yield.sub") as YieldSub) || "yield"; } catch { return "yield"; }
  });
  const pick = (k: YieldSub) => { setSub(k); try { localStorage.setItem("midgard.yield.sub", k); } catch {} };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl bg-ink-900/70 border border-ink-700/70 p-1">
        {YIELD_SUBS.map((y) => {
          const Icon = y.icon; const active = sub === y.key;
          return (
            <button key={y.key} onClick={() => pick(y.key)}
              className={`flex-1 min-w-[64px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition ${
                active ? "bg-ink-700 text-bone-50" : "text-bone-400 hover:text-bone-100 hover:bg-ink-800/60"
              }`}>
              <Icon size={13} className={active ? "text-blood-400" : ""} /> {y.label}
            </button>
          );
        })}
      </div>

      {sub === "yield" && <EconomySimulator supply={s.supply} poolMid={s.poolMid} circulating={s.circulating}
        holderAnnual={s.holderAnnual} poolAnnual={s.poolAnnual} phi={s.phi} feeTotal={s.buyFee + s.sellFee} />}

      {sub === "stats" && (
        <>
          <EconomyEngine eco={{
            supply: s.supply, burned: s.burned, reflected: s.reflected,
            poolMid: s.poolMid, poolEth: s.poolEth, price: s.price, circulating: s.circulating,
            holderAnnual: s.holderAnnual, poolAnnual: s.poolAnnual, phi: s.phi,
            feeTotal: s.buyFee + s.sellFee,
          }} />
          <FullStatsGrid s={s} />
          <TokenChartsSection />
          <HoldersCard totalSupply={s.supply} annualDecayPct={s.holderAnnual} />
          <HowItWorks s={s} />
        </>
      )}

      {sub === "pools" && (
        <>
          <PoolHealth />
          <RwaHoldings />
        </>
      )}
    </div>
  );
}

/** Full stat wall — only mounted under Stats. Real chain values only. */
function FullStatsGrid({ s }: { s: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Tile k="Reflected" v={fmtCompact(s.reflected)} icon={<Sparkles size={13} />} sub="paid to holders" tone="gain" />
      <Tile k="Holder decay" v={`~${s.holderAnnual.toFixed(0)}%/yr`} icon={<TrendingDown size={13} />} sub="holders shrink" />
      <Tile k="Pool burn" v={`~${s.poolAnnual.toFixed(0)}%/yr`} icon={<Flame size={13} />} sub="pool shrinks → price↑" tone="loss" />
      <Tile k="Holder net" v={`+${Math.max(0, s.poolAnnual - s.holderAnnual).toFixed(0)}%/yr`} icon={<Zap size={13} />} sub="pool − holder (before reflection)" tone="gain" />
      <Tile k="LP share (φ)" v={`${(s.phi * 100).toFixed(1)}%`} icon={<Gauge size={13} />} sub="pool ÷ float — drives the rates" />
      <Tile k="Swap fee" v={`${s.buyFee.toFixed(0)}% / ${s.sellFee.toFixed(0)}%`} sub="buy / sell → 100% reflection" />
    </div>
  );
}

function HowItWorks({ s }: { s: Stats }) {
  const net = Math.max(0, s.poolAnnual - s.holderAnnual);
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-blood-400 mb-2">
        <Coins size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">How {TOKEN_SYMBOL} works</span>
      </div>
      <ul className="text-sm text-bone-300 leading-relaxed space-y-1.5 list-disc list-inside marker:text-bone-600">
        <li>Every swap pays <b className="text-bone-50">{s.buyFee.toFixed(0)}% buy / {s.sellFee.toFixed(0)}% sell</b> — <b className="text-bone-50">100% reflected</b> to holders instantly (pool & excluded excluded).</li>
        <li>Holders decay <b className="text-bone-50">~{s.holderAnnual.toFixed(0)}%/yr</b>; the pool burns <b className="text-bone-50">~{s.poolAnnual.toFixed(0)}%/yr</b> — faster, so real price rises. Holder net ≈ <b className="text-emerald-400">+{net.toFixed(0)}%/yr</b> before reflection.</li>
        <li>Rates are <b className="text-bone-50">φ-adaptive</b>: thick pool (φ={(s.phi * 100).toFixed(0)}%) → burn faster; thin pool → self-heals so it <b className="text-bone-50">can never brick</b>.</li>
        <li>The pool burn is realized on transfers and via permissionless <span className="font-mono">poke()</span>. No claim, no auto-LP, no mirror-debt — fully autonomous.</li>
      </ul>
    </div>
  );
}

function Tile({ k, v, sub, icon, tone, flash, valueClass, spark }: { k: string; v: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "gain" | "loss"; flash?: boolean; valueClass?: string; spark?: React.ReactNode }) {
  const c = tone === "gain" ? "text-emerald-400" : tone === "loss" ? "text-danger-400" : "text-bone-50";
  const prev = useRef(v);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!flash || typeof v !== "string") return;
    if (prev.current !== v) {
      prev.current = v; setLit(true);
      const t = setTimeout(() => setLit(false), 750);
      return () => clearTimeout(t);
    }
  }, [v, flash]);
  return (
    <div className="panel p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bone-400 font-mono truncate">
        {icon}{k}
      </div>
      <div className={`font-mono font-semibold mt-1.5 tabular-nums truncate ${valueClass || "text-lg sm:text-xl"} ${c} ${lit ? "mg-flash" : ""}`}>{v}</div>
      {sub && <div className="text-[11px] text-bone-600 font-mono mt-0.5 truncate">{sub}</div>}
      {spark}
    </div>
  );
}
