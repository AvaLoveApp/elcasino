import { useMemo, useState } from "react";
import { DayBucket } from "../lib/analytics";

export type OverlaySeries = { key: string; label: string; color: string; data: DayBucket[]; fmt: (n: number) => string };

/**
 * MM-terminal-style multi-series overlay: several economy metrics on ONE plot,
 * each normalized to its own range so different units share the frame. Toggle
 * chips show/hide series; the legend shows each one's latest real value. This is
 * the signature "everything at a glance" view from the Market Maker terminal.
 */
export function OverlayChart({ series, height = 200 }: { series: OverlaySeries[]; height?: number }) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(series.map((s, i) => [s.key, i < 2])) // default: first two enabled
  );
  const active = series.filter((s) => on[s.key] && s.data.length > 1);

  const domain = useMemo(() => {
    let tMin = Infinity, tMax = -Infinity;
    for (const s of active) for (const d of s.data) { if (d.ts < tMin) tMin = d.ts; if (d.ts > tMax) tMax = d.ts; }
    return { tMin, tMax };
  }, [active]);

  const w = 700, padL = 6, padR = 6, padT = 8, padB = 8;
  const plotW = w - padL - padR, plotH = height - padT - padB;
  const spanT = Math.max(1, domain.tMax - domain.tMin);
  const x = (ts: number) => padL + ((ts - domain.tMin) / spanT) * plotW;

  const paths = active.map((s) => {
    const vals = s.data.map((d) => d.value);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const range = Math.max(hi - lo, 1e-30);
    const y = (v: number) => padT + plotH - ((v - lo) / range) * plotH;
    const pts = [...s.data].sort((a, b) => a.ts - b.ts);
    const d = "M" + pts.map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(" L");
    return { key: s.key, color: s.color, d };
  });

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">Economy overlay</span>
        <div className="flex flex-wrap gap-1.5">
          {series.map((s) => {
            const enabled = on[s.key];
            const latest = s.data.length ? s.data[s.data.length - 1].value : 0;
            return (
              <button key={s.key} onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono transition ${
                  enabled ? "border-transparent text-bone-100" : "border-ink-600 text-bone-500 hover:text-bone-300"}`}
                style={enabled ? { background: s.color + "22", borderColor: s.color + "66" } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ background: enabled ? s.color : "#555" }} />
                {s.label}
                {enabled && <span className="text-bone-400">{s.fmt(latest)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {active.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-bone-600 font-mono text-xs">select a series to plot</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={padL} x2={w - padR} y1={padT + plotH * f} y2={padT + plotH * f}
              stroke="currentColor" className="text-ink-700" strokeWidth={0.5} strokeDasharray="3 4" />
          ))}
          {paths.map((p) => (
            <path key={p.key} d={p.d} stroke={p.color} strokeWidth={1.75} fill="none" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}
      <div className="text-[9px] font-mono text-bone-600 mt-2">each line normalized to its own range · toggle to compare shapes over time</div>
    </div>
  );
}
