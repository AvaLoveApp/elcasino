import { useEffect, useState } from "react";

/** Re-render every `ms` so animated projections tick between real polls. */
export function useLiveTick(ms = 1000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(h);
  }, [ms]);
  return n;
}

/**
 * Project the "included" (non-excluded) supply forward from the last measured
 * value using continuous decay so users see the number tick down smoothly
 * between real 3s polls. `dtSeconds` is time since the last real read.
 */
export function projectDecayed(startTokens: number, annualDecayFraction: number, dtSeconds: number): number {
  if (startTokens <= 0 || annualDecayFraction <= 0 || dtSeconds <= 0) return startTokens;
  const perSec = Math.pow(1 - annualDecayFraction, 1 / 31_536_000);
  return startTokens * Math.pow(perSec, dtSeconds);
}
