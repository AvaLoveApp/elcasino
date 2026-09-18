import { useEffect, useState } from "react";
import { formatEther } from "ethers";
import { readProvider } from "./chain";

// Rough on-chain cost per typical action, in gas units.
export const TYPICAL_GAS = {
  follow: 130_000n,
  unfollow: 90_000n,
  like: 65_000n,
  post: 220_000n,
  edit: 55_000n,
  del: 45_000n,
  profile: 260_000n,
} as const;

let cached: bigint | null = null;
let cachedAt = 0;

async function currentGasPrice(): Promise<bigint> {
  const now = Date.now();
  if (cached && now - cachedAt < 30_000) return cached;
  try {
    const fd = await readProvider.getFeeData();
    cached = (fd.gasPrice ?? fd.maxFeePerGas ?? 1_000_000_000n);
    cachedAt = now;
  } catch { cached = 1_000_000_000n; }
  return cached;
}

/** Show ≈ N ETH tag next to an action button so users see the real cost upfront. */
export function useGasHint(action: keyof typeof TYPICAL_GAS): string | null {
  const [txt, setTxt] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    currentGasPrice().then((gp) => {
      const wei = gp * TYPICAL_GAS[action];
      const eth = Number(formatEther(wei));
      if (!live) return;
      if (eth < 1e-6) setTxt("~0 ETH gas");
      else if (eth < 0.001) setTxt(`~${eth.toFixed(6)} ETH gas`);
      else setTxt(`~${eth.toFixed(4)} ETH gas`);
    });
    return () => { live = false; };
  }, [action]);
  return txt;
}
