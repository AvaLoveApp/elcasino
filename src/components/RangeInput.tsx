/**
 * Range slider with a filled red track + a prominent thumb — the same look on PC
 * as on mobile (native `accent-color` renders washed-out on desktop). The fill
 * is a CSS gradient up to the current value; the thumb colour is set per-use.
 */
export function RangeInput({ min, max, step = 1, value, onChange, color = "#B01B21", disabled, className = "" }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; color?: string; disabled?: boolean; className?: string;
}) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`mg-range w-full ${className}`}
      style={{
        background: `linear-gradient(90deg, ${color} ${pct}%, #26304a ${pct}%)`,
        ["--mg-thumb" as any]: color,
      }} />
  );
}
