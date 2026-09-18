import { useCallback, useEffect, useRef, useState } from "react";
import { SlotSymbol, SYMBOL_COLORS, SYMBOL_LABELS } from "./SlotSymbol";

// ─────────────────────────────────────────────────────────────
//  SlotReel — a real, physically-decelerating reel (ported 1:1 from Avlo).
//  During the spin phase it scrolls a fast, motion-blurred symbol strip; when
//  the result is known it eases the EXACT target symbol up from below to a slow,
//  readable stop (with a subtle settle bounce) instead of snapping it in.
//  Driven by the Web Animations API so the transform stays on the compositor —
//  smooth even on mobile.
//
//  The strip is the fixed repeating sequence symbol(k) = k % 10, so we never
//  mutate cells: to land on `target` we simply pick a resting cell L (a few
//  cells ahead, always moving upward) whose value equals the target.
// ─────────────────────────────────────────────────────────────
const REEL_STRIP = 30;      // cells rendered (must exceed the max landing travel)
const REEL_LOOP_MS = 520;   // time for the fast loop to travel 10 symbols
const REEL_LAND_MS = 1150;  // deceleration duration — long, so the result reads
const REEL_MIN_TRAVEL = 6;  // min cells to travel before landing

export function SlotReel({ spinning, target, tokenLogoUrl, sym }: {
  spinning: boolean; target: number; tokenLogoUrl?: string | null; sym?: string;
}) {
  const winRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const kindRef = useRef<"idle" | "spin" | "land">("idle");
  const prevSpin = useRef(false);
  const [cellH, setCellH] = useState(0);
  const [showLabel, setShowLabel] = useState(true);

  // Each strip cell is exactly one reel-window tall, so a symbol always lands
  // perfectly centred. Re-measure on resize (responsive reel sizes).
  useEffect(() => {
    const el = winRef.current; if (!el) return;
    const measure = () => setCellH(el.clientHeight || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const norm = (i: number) => ((i % 10) + 10) % 10;

  const setStatic = useCallback((idx: number) => {
    const strip = stripRef.current; if (!strip || cellH <= 0) return;
    animRef.current?.cancel();
    kindRef.current = "idle";
    strip.style.filter = "none";
    strip.style.transform = `translateY(${-norm(idx) * cellH}px)`;
    setShowLabel(true);
  }, [cellH]);

  const startSpin = useCallback(() => {
    const strip = stripRef.current; if (!strip || cellH <= 0) return;
    if (reduced()) { kindRef.current = "spin"; setShowLabel(false); return; }
    animRef.current?.cancel();
    kindRef.current = "spin";
    setShowLabel(false);
    strip.style.filter = "blur(4px)";
    // Loop travels exactly 10 cells → seamless, since symbol(k) === symbol(k+10).
    animRef.current = strip.animate(
      [{ transform: "translateY(0px)" }, { transform: `translateY(${-10 * cellH}px)` }],
      { duration: REEL_LOOP_MS, iterations: Infinity, easing: "linear" },
    );
  }, [cellH]);

  const land = useCallback((idx: number) => {
    const strip = stripRef.current;
    if (!strip || cellH <= 0 || reduced()) { setStatic(idx); return; }
    // Freeze wherever the fast loop currently is, then decelerate onto the target.
    let curY = 0;
    try { curY = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42; } catch { curY = 0; }
    animRef.current?.cancel();
    strip.style.transform = `translateY(${curY}px)`;
    const startCell = Math.ceil(-curY / cellH) + REEL_MIN_TRAVEL;
    const t = norm(idx);
    const L = startCell + ((((t - (startCell % 10)) % 10) + 10) % 10); // next cell ≥ start whose symbol is the target
    const finalY = -L * cellH;
    kindRef.current = "land";
    const a = strip.animate(
      [
        { transform: `translateY(${curY}px)`, filter: "blur(5px)" },
        { transform: `translateY(${finalY - cellH * 0.045}px)`, filter: "blur(0px)", offset: 0.9 }, // slight overshoot
        { transform: `translateY(${finalY}px)`, filter: "blur(0px)" },                              // settle back
      ],
      { duration: REEL_LAND_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
    animRef.current = a;
    a.onfinish = () => {
      strip.style.filter = "none";
      strip.style.transform = `translateY(${finalY}px)`;
      try { a.cancel(); } catch {}
      kindRef.current = "idle";
      setShowLabel(true);
    };
  }, [cellH, setStatic]);

  // React to spin start / result landing / idle refresh.
  useEffect(() => {
    if (cellH <= 0) return;
    if (spinning) { if (kindRef.current !== "spin") startSpin(); }
    else if (prevSpin.current) land(target);                 // just stopped → decelerate onto result
    else if (kindRef.current === "idle") setStatic(target);  // initial / idle value
    prevSpin.current = spinning;
  }, [spinning, target, cellH, startSpin, land, setStatic]);

  useEffect(() => () => { animRef.current?.cancel(); }, []);

  const t = norm(target);
  const labelText = t === 7 ? (sym || SYMBOL_LABELS[t]) : SYMBOL_LABELS[t];
  const labelColor = SYMBOL_COLORS[t];

  return (
    <div ref={winRef} className="absolute inset-0 overflow-hidden">
      <div ref={stripRef} className="absolute left-0 top-0 w-full will-change-transform">
        {Array.from({ length: REEL_STRIP }).map((_, k) => (
          <div key={k} className="flex items-center justify-center" style={{ height: cellH || undefined }}>
            <SlotSymbol index={k % 10} size="xl" tokenLogoUrl={tokenLogoUrl || undefined} tokenSymbol={sym} />
          </div>
        ))}
      </div>
      {showLabel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center md:bottom-2.5">
          <span className="font-mono text-[8px] uppercase tracking-wider md:text-[10px]" style={{ color: labelColor }}>{labelText}</span>
        </div>
      )}
    </div>
  );
}
