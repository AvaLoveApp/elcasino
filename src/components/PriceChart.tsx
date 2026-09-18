import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineStyle, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { BarChart3, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { loadPriceSeries, type PricePoint } from "../lib/candles";
import { DexChart } from "./DexChart";

const LINE = "#22c55e";

function precisionFor(p: number): { precision: number; minMove: number } {
  if (p <= 0) return { precision: 6, minMove: 0.000001 };
  if (p < 0.0001) return { precision: 9, minMove: 1e-9 };
  if (p < 0.01) return { precision: 7, minMove: 1e-7 };
  if (p < 1) return { precision: 5, minMove: 1e-5 };
  if (p < 100) return { precision: 3, minMove: 0.001 };
  return { precision: 2, minMove: 0.01 };
}
function fmtP(p: number): string {
  if (!p) return "—";
  if (p < 0.0001) return p.toExponential(2);
  if (p < 1) return p.toPrecision(4);
  return p.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Theme-matched price chart (TradingView lightweight-charts) built from on-chain
 * Sync-derived price history — an area line, since these pools trade rarely.
 * Falls back to the DexScreener embed when there isn't enough history to plot.
 */
export function PriceChart({ token, pair, quoteLabel, height = 440 }: {
  token: string; pair?: string; quoteLabel: string; height?: number;
}) {
  const [pts, setPts] = useState<PricePoint[] | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    let live = true;
    setPts(null);
    if (!pair) { setPts([]); return; }
    loadPriceSeries(pair, token).then((p) => { if (live) setPts(p); }).catch(() => { if (live) setPts([]); });
    return () => { live = false; };
  }, [pair, token]);

  const hasData = !!(pts && pts.length >= 2);
  useEffect(() => {
    if (!hasData || !wrapRef.current) return;
    const el = wrapRef.current;
    const last = pts![pts!.length - 1].value;
    const { precision, minMove } = precisionFor(last);
    const chart = createChart(el, {
      width: el.clientWidth, height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b8b93", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.05)" } },
      crosshair: { mode: 0, vertLine: { style: LineStyle.Dashed, color: "rgba(255,255,255,0.2)" }, horzLine: { style: LineStyle.Dashed, color: "rgba(255,255,255,0.2)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      handleScale: { axisPressedMouseMove: false },
    });
    const series = chart.addAreaSeries({
      lineColor: LINE, topColor: "rgba(34,197,94,0.28)", bottomColor: "rgba(34,197,94,0.02)", lineWidth: 2,
      priceFormat: { type: "price", precision, minMove },
    });
    series.setData(pts!.map((p) => ({ time: p.time as any, value: p.value })));
    chart.timeScale().fitContent();
    chartRef.current = chart; seriesRef.current = series;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, height]);

  useEffect(() => {
    if (seriesRef.current && pts && pts.length >= 2) {
      seriesRef.current.setData(pts.map((p) => ({ time: p.time as any, value: p.value })));
      chartRef.current?.timeScale().fitContent();
    }
  }, [pts]);

  // Not enough on-chain history → DexScreener embed fallback.
  if (pts !== null && pts.length < 2) {
    return <DexChart token={token} pair={pair} height={height}
      fallback={<div className="panel grid place-items-center text-bone-500 text-sm gap-2" style={{ height }}><BarChart3 size={22} className="text-bone-600" /> Not enough trade history to chart yet.</div>} />;
  }

  const first = pts && pts.length ? pts[0].value : 0;
  const last = pts && pts.length ? pts[pts.length - 1].value : 0;
  const chg = first > 0 ? ((last - first) / first) * 100 : 0;
  const up = chg >= 0;

  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-ink-700/60">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-500">Price · {quoteLabel}</span>
        <div className="flex items-center gap-3 font-mono text-[12px]">
          <span className="text-bone-100 tabular-nums">{fmtP(last)}</span>
          {pts && pts.length >= 2 && (
            <span className={`inline-flex items-center gap-0.5 ${up ? "text-emerald-400" : "text-blood-400"}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : ""}{chg.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative" style={{ height }}>
        {pts === null && <div className="absolute inset-0 grid place-items-center text-bone-500 text-sm"><Loader2 size={16} className="animate-spin" /></div>}
        <div ref={wrapRef} className="w-full h-full" />
      </div>
    </div>
  );
}
