import { useEffect, useState } from "react";
import { Flame, Sparkles, TrendingUp, Droplets, ArrowLeftRight } from "lucide-react";
import { loadTokenStats, TokenStats } from "../lib/analytics";
import { SparkChart } from "./SparkChart";
import { OverlayChart, OverlaySeries } from "./OverlayChart";
import { fmtInt, fmtPrice } from "../lib/util";

/**
 * The MIDGARD historical charts — the composite MM-style overlay plus the
 * per-metric plots (price, liquidity, volume, mirror-burn, reflections,
 * cumulatives), reconstructed from on-chain events. Shared by the Analytics
 * terminal and the token page's Stats tab so both show the same charts.
 */

function overlaySeries(s: TokenStats): OverlaySeries[] {
  const eth = (n: number) => n.toFixed(4);
  // Prefer the fine-grained per-event series (filled even on a young token);
  // fall back to the daily series if the raw ones are somehow empty.
  const pick = (raw: any[], daily: any[]) => (raw && raw.length > 1 ? raw : daily);
  return [
    { key: "price", label: "Price", color: "#f59e0b", data: pick(s.priceSeries, s.priceHistory), fmt: fmtPrice },
    { key: "liq", label: "Liquidity", color: "#10b981", data: pick(s.liqSeries, s.liquidityHistory), fmt: eth },
    { key: "vol", label: "Volume", color: "#3b82f6", data: pick(s.volCumSeries, s.swapVolumeEthPerDay), fmt: eth },
    { key: "burn", label: "Burn", color: "#B01B21", data: pick(s.burnCumSeries, s.cumulativeBurn), fmt: (n) => fmtInt(n) },
    { key: "reflect", label: "Reflected", color: "#a855f7", data: pick(s.reflectCumSeries, s.cumulativeReflect), fmt: (n) => fmtInt(n) },
  ];
}

export function ChartRow({ icon, title, subtitle, tone, series, fmt, log }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  tone: "blood" | "emerald" | "amber" | "bone";
  series: ReturnType<typeof Array>; fmt?: (n: number) => string; log?: boolean;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-bone-400 font-mono">
            <span className={tone === "blood" ? "text-blood-400" : tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-bone-400"}>{icon}</span>
            {title}
          </div>
          {subtitle && <div className="text-[11px] text-bone-600 font-mono mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <SparkChart series={series as any} tone={tone} fmt={fmt} height={170} log={log} />
    </div>
  );
}

/** A single composite chart — price · liquidity · volume · burn · reflected on one
 *  normalized plot, filled from every on-chain event. Toggle series with the chips. */
export function TokenCharts({ s }: { s: TokenStats; log?: boolean }) {
  const hasAny = [s.priceSeries, s.liqSeries, s.volCumSeries, s.burnCumSeries, s.reflectCumSeries].some((a) => a && a.length > 1);
  if (!hasAny) {
    return <div className="panel p-10 text-center text-bone-500 text-sm">No chart data yet — it fills in as {`$`}ELCAS trades on-chain.</div>;
  }
  return <OverlayChart series={overlaySeries(s)} height={300} />;
}

/**
 * Self-loading charts section for the token page's Stats tab — loads TokenStats
 * on its own (with retry, since Robinhood's RPC drops under load) and carries a
 * linear/log toggle. Drop it in and it paints the same charts as the terminal.
 */
export function TokenChartsSection() {
  const [tok, setTok] = useState<TokenStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<boolean>(() => {
    try { return localStorage.getItem("midgard.analytics.log") === "1"; } catch { return false; }
  });
  const toggleLog = () => setLog((v) => {
    const next = !v;
    try { localStorage.setItem("midgard.analytics.log", next ? "1" : "0"); } catch {}
    return next;
  });

  useEffect(() => {
    let live = true;
    (async () => {
      for (let i = 0; i < 5 && live; i++) {
        try { const v = await loadTokenStats(); if (live) { setTok(v); setErr(null); } return; }
        catch { if (i === 4 && live) setErr("Failed to load charts"); await new Promise((r) => setTimeout(r, 2500)); }
      }
    })();
    return () => { live = false; };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blood-400"><TrendingUp size={14} /></span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">Charts · on-chain history</span>
        <div className="h-px flex-1 bg-ink-700/70" />
        <div className="inline-flex text-[10px] font-mono uppercase tracking-wider rounded-full border border-ink-600 overflow-hidden shrink-0">
          <button onClick={toggleLog} className={`px-3 py-1 transition ${!log ? "bg-blood-900/40 text-blood-200" : "text-bone-500 hover:text-bone-200"}`}>linear</button>
          <button onClick={toggleLog} className={`px-3 py-1 transition ${log ? "bg-blood-900/40 text-blood-200" : "text-bone-500 hover:text-bone-200"}`}>log</button>
        </div>
      </div>
      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-xl px-4 py-3 mb-3">{err}</div>}
      {tok ? <TokenCharts s={tok} log={log} /> : (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="panel p-4 h-40 skeleton" />)}</div>
      )}
    </div>
  );
}
