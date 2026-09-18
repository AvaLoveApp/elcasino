import { useEffect, useState } from "react";
import { readRegistry } from "./chain";

/**
 * Cached membership check — is this wallet holding enough MIDGARD to be a
 * platform member (per the current registry gate)? Registry.isMember() does
 * the balance-vs-minHold comparison in the contract, so a single call is
 * authoritative regardless of what the admin flips the gate to.
 */
const cache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();
let gateOpen: boolean | null = null;

async function checkGateOpen(): Promise<boolean> {
  if (gateOpen !== null) return gateOpen;
  try {
    const r = readRegistry();
    const [gate, min] = await Promise.all([r.gateToken(), r.minHold()]);
    gateOpen = !gate || gate === "0x0000000000000000000000000000000000000000" || min === 0n;
  } catch { gateOpen = true; }
  return gateOpen;
}

async function fetchOne(addr: string): Promise<boolean> {
  const key = addr.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    try {
      const v: boolean = await readRegistry().isMember(addr);
      cache.set(key, v);
      inflight.delete(key);
      return v;
    } catch { inflight.delete(key); return false; }
  })();
  inflight.set(key, p);
  return p;
}

/** Resolve membership for a batch of addresses; re-renders as results arrive. */
export function useMembership(addresses: string[]): Record<string, boolean> {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [gateActive, setGateActive] = useState<boolean>(false);
  const keySig = addresses.map((a) => a.toLowerCase()).sort().join(",");
  useEffect(() => {
    let live = true;
    (async () => {
      const open = await checkGateOpen();
      if (!live) return;
      setGateActive(!open);
      if (open) return; // gate is off → no badge needed
      const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase()))).filter(Boolean);
      const pairs = await Promise.all(uniq.map(async (a) => [a, await fetchOne(a)] as const));
      if (!live) return;
      setMap((prev) => {
        const n = { ...prev };
        for (const [a, ok] of pairs) n[a] = ok;
        return n;
      });
    })();
    return () => { live = false; };
  }, [keySig]);
  return gateActive ? map : {};
}

/** Single-address version for cards that render one profile. */
export function useIsMember(address?: string | null): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!address) { setOk(null); return; }
    let live = true;
    (async () => {
      const open = await checkGateOpen();
      if (!live) return;
      if (open) { setOk(null); return; } // no gate → no badge
      const v = await fetchOne(address);
      if (live) setOk(v);
    })();
    return () => { live = false; };
  }, [address]);
  return ok;
}
