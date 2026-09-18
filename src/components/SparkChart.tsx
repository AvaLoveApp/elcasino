import { DayBucket } from "../lib/analytics";
import { fmtInt } from "../lib/util";

/**
 * Dependency-free line/area chart. Draws inline SVG so it themes cleanly and
 * costs no runtime library. Range: latest 90 days, or all if fewer.
 *
 * Renders as a wide row-style chart with subtle horizontal gridlines, min/max
 * markers, and a "now" tick. Header shows the latest value; footer shows the
 * period total and endpoints. Designed to stack vertically on Analytics — one
 * per row, big enough to actually read.
 */
export function SparkChart({ series, height = 160, tone = "blood", fmt, area = true, log = false }: {
  series: DayBucket[];
  height?: number;
  tone?: "blood" | "emerald" | "amber" | "bone";
  fmt?: (n: number) => string;
  area?: boolean;
  log?: boolean;
}) {
  const tail = series.slice(-90);
  const format = fmt ?? ((n: number) => fmtInt(n));

  if (tail.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-bone-600 font-mono">
        no data yet
      </div>
    );
  }

  const w = 1000, h = height, padL = 72, padR = 12, padT = 12, padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const values = tail.map((d) => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);

  // Log mode compresses tall spikes and lifts the floor so tiny values stay
  // legible — useful when a single big day drowns out the rest. Only meaningful
  // for strictly positive series; we clamp non-positives to a tiny floor.
  const LOG_FLOOR = 1e-12;
  const t = (v: number) => log ? Math.log10(Math.max(v, LOG_FLOOR)) : v;

  const nearFlat = rawMax > 0 && !log && (rawMax - rawMin) / rawMax < 0.05;
  const minLin = nearFlat ? rawMin * 0.98 : 0;
  const maxLin = rawMax > 0 ? (nearFlat ? rawMax * 1.02 : rawMax) : 1;

  const min = log ? t(rawMin > 0 ? rawMin : LOG_FLOOR) : minLin;
  const max = log ? t(Math.max(rawMax, LOG_FLOOR * 10)) : maxLin;

  const step = tail.length > 1 ? plotW / (tail.length - 1) : 0;
  const y = (v: number) => padT + plotH - ((t(v) - min) / Math.max(max - min, 1e-30)) * plotH;
  const x = (i: number) => padL + i * step;

  const pts = tail.map((d, i) => `${x(i)},${y(d.value)}`);
  const line = "M" + pts.join(" L");
  const areaPath = area
    ? `${line} L${x(tail.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`
    : "";

  const stroke = tone === "blood" ? "#B01B21"
    : tone === "emerald" ? "#10b981"
    : tone === "amber" ? "#f59e0b"
    : "#a1a1aa";
  const fill = tone === "blood" ? "rgba(176,27,33,0.14)"
    : tone === "emerald" ? "rgba(16,185,129,0.14)"
    : tone === "amber" ? "rgba(245,158,11,0.14)"
    : "rgba(161,161,170,0.14)";

  const first = tail[0], last = tail[tail.length - 1];
  const total = tail.reduce((s, d) => s + d.value, 0);
  const peak = tail.reduce((best, d) => (d.value > best.value ? d : best), tail[0]);

  // Compact axis ticks — 4 gridlines evenly spaced across the plotted range.
  // In log mode the tick VALUES are exponentiated back so labels read as the
  // actual quantity, not log10(x).
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = min + (max - min) * f;
    return log ? Math.pow(10, v) : v;
  });
  const yForTick = (v: number) => padT + plotH - (((log ? Math.log10(Math.max(v, LOG_FLOOR)) : v) - min) / Math.max(max - min, 1e-30)) * plotH;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-mono text-[11px] text-bone-500">
          latest <span className="text-bone-100 font-semibold text-sm ml-1">{format(last.value)}</span>
        </div>
        <div className="font-mono text-[10px] text-bone-600">
          peak {format(peak.value)} · {peak.day}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
        {/* gridlines */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={yForTick(v)} y2={yForTick(v)}
              stroke="#26313a" strokeWidth={1} vectorEffect="non-scaling-stroke"
              strokeDasharray={i === 0 ? "0" : "3 4"} />
            <text x={padL - 6} y={yForTick(v) + 3} textAnchor="end"
              fontSize={9} fontFamily="ui-monospace, monospace" fill="#556069">
              {format(v)}
            </text>
          </g>
        ))}
        {/* area + line */}
        {area && <path d={areaPath} fill={fill} />}
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {/* peak marker */}
        {(() => {
          const pi = tail.indexOf(peak);
          return <circle cx={x(pi)} cy={y(peak.value)} r={2.5} fill={stroke} opacity={0.6} />;
        })()}
        {/* now marker */}
        <circle cx={x(tail.length - 1)} cy={y(last.value)} r={3.5} fill={stroke} />
        <circle cx={x(tail.length - 1)} cy={y(last.value)} r={7} fill={stroke} opacity={0.25}>
          <animate attributeName="r" from="3.5" to="9" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.35" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="flex justify-between mt-1 font-mono text-[10px] text-bone-600">
        <span>{first.day}</span>
        <span>total {format(total)} · {tail.length}d window</span>
        <span>{last.day}</span>
      </div>
    </div>
  );
}
