import { useEffect, useRef, useState } from "react";

/**
 * A tiny live "flow" sparkline (MM-terminal style). It samples the given value
 * as it changes over the session and draws the trend, with a bright dash that
 * streams along the line so a moving/eroding number (like the decaying supply)
 * reads as visibly alive. Purely client-accumulated — no extra RPC.
 */
export function LiveSpark({ value, color = "#B01B21", height = 22, max = 60, seed }: {
  value: number | null | undefined; color?: string; height?: number; max?: number;
  seed?: number[];   // optional real history to prefill the trend (e.g. price/liq/burn)
}) {
  const [pts, setPts] = useState<number[]>(() => (seed && seed.length ? seed.slice(-max) : []));
  const last = useRef<number | undefined>(seed && seed.length ? seed[seed.length - 1] : undefined);
  const seededRef = useRef(!!(seed && seed.length));

  // Prefill from history once it arrives (loads async, after mount).
  useEffect(() => {
    if (seededRef.current) return;
    if (seed && seed.length) {
      seededRef.current = true;
      setPts(seed.slice(-max));
      last.current = seed[seed.length - 1];
    }
  }, [seed, max]);

  useEffect(() => {
    if (value == null || !isFinite(value)) return;
    if (last.current === value) return;      // only record real changes
    last.current = value;
    setPts((p) => {
      const n = p.length ? [...p, value] : [value, value]; // seed a flat pair so it paints on the first change
      return n.length > max ? n.slice(n.length - max) : n;
    });
  }, [value, max]);

  if (pts.length < 2) return <div style={{ height }} className="mt-1.5" aria-hidden />;

  const w = 100;
  const lo = Math.min(...pts), hi = Math.max(...pts), rng = Math.max(hi - lo, 1e-9);
  const y = (v: number) => height - 2 - ((v - lo) / rng) * (height - 4);
  const coords = pts.map((v, i) => `${((i / (pts.length - 1)) * w).toFixed(2)},${y(v).toFixed(2)}`);
  const line = coords.join(" ");
  const area = `0,${height} ${line} ${w},${height}`;
  const tip = coords[coords.length - 1].split(",").map(Number);
  const gid = `spk${Math.round(y(pts[0]))}${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full block mt-1.5" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.25} vectorEffect="non-scaling-stroke" opacity={0.4} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="mg-flowln" strokeLinecap="round" />
      <circle cx={tip[0]} cy={tip[1]} r={1.8} fill={color} vectorEffect="non-scaling-stroke">
        <animate attributeName="r" values="1.5;2.6;1.5" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
