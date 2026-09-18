import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { readMidgard, readPair, ADDR } from "./chain";

/**
 * Streams live EL-Casino ($ELCAS) contract state on a fast interval so the
 * token page (and any panel that opts in) feels alive — like the old MM
 * terminal. Every poll pulls the freshest on-chain numbers; reflections and the
 * pool burn appear as they happen.
 *
 * `pulseKey` bumps every poll so consumers can key-swap a small animation.
 */
const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnual = (persec: number) =>
  persec > 0 ? 1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR) : 0;

export type MidgardStream = {
  supply: number;
  burned: number;        // cumulative pool burn (totalPoolBurned)
  reflected: number;     // cumulative reflected to holders
  phi: number;           // LP share of float, 0..1
  holderAnnual: number;  // current holder decay rate, annualized
  poolAnnual: number;    // current pool burn rate, annualized
  includedSupply: number;
  poolMid: number;
  poolEth: number;
  price: number;
  lastAt: number;   // ms
  pulseKey: number; // increments each poll
};

export function useMidgardStream(intervalMs = 3000): MidgardStream | null {
  const [s, setS] = useState<MidgardStream | null>(null);

  useEffect(() => {
    let live = true;
    let pulse = 0;
    async function poll() {
      try {
        const m = readMidgard();
        const [supply, burned, reflected, phiRaw, rates, incSup, pair] = await Promise.all([
          m.totalSupply(),
          m.totalPoolBurned(),
          m.totalReflected(),
          m.currentPhi(),
          m.currentRates(),
          m.includedSupply(),
          m.primaryPair(),
        ]);
        let poolEth = 0, poolMid = 0;
        if (pair && pair !== "0x0000000000000000000000000000000000000000") {
          const p = readPair(pair);
          const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
          const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
          poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
          poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
        }
        if (!live) return;
        pulse += 1;
        setS({
          supply: Number(formatUnits(supply, 18)),
          burned: Number(formatUnits(burned, 18)),
          reflected: Number(formatUnits(reflected, 18)),
          phi: Number(formatUnits(phiRaw, 18)),
          holderAnnual: perSecToAnnual(Number(rates[0])),
          poolAnnual: perSecToAnnual(Number(rates[1])),
          includedSupply: Number(formatUnits(incSup, 18)),
          poolMid, poolEth,
          price: poolMid ? poolEth / poolMid : 0,
          lastAt: Date.now(),
          pulseKey: pulse,
        });
      } catch { /* ignore transient RPC errors, next tick tries again */ }
    }
    poll();
    const h = setInterval(poll, intervalMs);
    return () => { live = false; clearInterval(h); };
  }, [intervalMs]);

  return s;
}

/** Tiny "LIVE" pulse dot — green when the stream is fresh, dim otherwise. */
export function livePulseFresh(lastAt: number): boolean {
  return Date.now() - lastAt < 8000;
}
