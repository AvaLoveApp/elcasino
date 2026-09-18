import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { readMidgard } from "./chain";

/**
 * MIDGARD holder tiers — Norse-flavored rank based on token holdings. The
 * balance-only view (member gate is separate) drives the tier badge shown
 * next to display names across the feed and on profiles.
 *
 * Thresholds are static and generous at the low end so the ladder is visible
 * even in early liquidity; tune these once holder distribution settles.
 */
export type TierKey = "none" | "thane" | "berserker" | "jarl" | "einherjar" | "aesir";

export type TierDef = {
  key: TierKey;
  label: string;
  min: number;          // MIDGARD (whole tokens) needed
  ring: string;         // tailwind text color for the glyph
  bg: string;           // tailwind bg color for pill
  border: string;       // tailwind border color for pill
  glyph: string;        // single character emblem
};

const TIERS: TierDef[] = [
  { key: "aesir",     label: "Æsir",     min: 1_000_000, ring: "text-amber-300",  bg: "bg-amber-900/40",  border: "border-amber-500/60", glyph: "☉" },
  { key: "einherjar", label: "Einherjar", min: 250_000,  ring: "text-orange-300", bg: "bg-orange-900/30", border: "border-orange-500/50", glyph: "⚔" },
  { key: "jarl",      label: "Jarl",     min: 50_000,    ring: "text-blood-300",  bg: "bg-blood-900/30",  border: "border-blood-500/50",  glyph: "♛" },
  { key: "berserker", label: "Berserker", min: 5_000,   ring: "text-purple-300", bg: "bg-purple-900/30", border: "border-purple-500/50", glyph: "☾" },
  { key: "thane",     label: "Thane",    min: 500,       ring: "text-emerald-300", bg: "bg-emerald-900/25", border: "border-emerald-500/40", glyph: "▲" },
];

const NONE: TierDef = {
  key: "none", label: "", min: 0, ring: "", bg: "", border: "", glyph: "",
};

export function tierForBalance(midWhole: number): TierDef {
  for (const t of TIERS) if (midWhole >= t.min) return t;
  return NONE;
}

// ---- shared cache -------------------------------------------------------

const balCache = new Map<string, { bal: bigint; at: number }>();
const inflight = new Map<string, Promise<bigint>>();
const TTL = 60_000; // 1 minute — balances move but not fast enough to poll

async function fetchBal(addr: string): Promise<bigint> {
  const key = addr.toLowerCase();
  const hit = balCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL) return hit.bal;
  const infl = inflight.get(key);
  if (infl) return infl;
  const p = readMidgard().balanceOf(addr).then((b: bigint) => {
    balCache.set(key, { bal: b, at: Date.now() });
    inflight.delete(key);
    return b;
  }).catch(() => {
    inflight.delete(key);
    return 0n;
  });
  inflight.set(key, p);
  return p;
}

/** Batch tier lookup — pairs each address with a TierDef and raw bigint balance. */
export function useTiers(addresses: string[]): Record<string, { tier: TierDef; bal: bigint }> {
  const [map, setMap] = useState<Record<string, { tier: TierDef; bal: bigint }>>({});
  const keySig = addresses.map((a) => a.toLowerCase()).sort().join(",");
  useEffect(() => {
    let live = true;
    const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase()))).filter(Boolean);
    Promise.all(uniq.map(async (a) => {
      const bal = await fetchBal(a);
      const whole = Number(formatUnits(bal, 18));
      return [a, { tier: tierForBalance(whole), bal }] as const;
    })).then((pairs) => {
      if (!live) return;
      setMap((prev) => {
        const n = { ...prev };
        for (const [a, v] of pairs) n[a] = v;
        return n;
      });
    });
    return () => { live = false; };
  }, [keySig]);
  return map;
}

/** Single-address hook. */
export function useTier(address?: string | null): { tier: TierDef; bal: bigint } | null {
  const [out, setOut] = useState<{ tier: TierDef; bal: bigint } | null>(null);
  useEffect(() => {
    if (!address) { setOut(null); return; }
    let live = true;
    fetchBal(address).then((bal) => {
      if (!live) return;
      const whole = Number(formatUnits(bal, 18));
      setOut({ tier: tierForBalance(whole), bal });
    });
    return () => { live = false; };
  }, [address]);
  return out;
}
