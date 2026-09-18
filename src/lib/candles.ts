import { Contract, formatUnits } from "ethers";
import { readProvider } from "./chain";

/**
 * On-chain price series — derived from the pair's Sync events (reserves → spot
 * price at each block) across full history, so we can render a fully
 * theme-matched chart straight from chain data with no external chart API.
 * These pools trade infrequently, so a smooth area line reads better than sparse
 * candles.
 */
export type PricePoint = { time: number; value: number };

const PAIR_ABI = [
  "event Sync(uint112 reserve0, uint112 reserve1)",
  "function token0() view returns (address)",
];
const EARLIEST = 52_900_000; // all Midgard pairs deployed above this floor
const CHUNK = 500_000;

// Linear block→timestamp clock (2 RPC) — day/hour granularity needs no per-block ts.
async function clock() {
  const latest = await readProvider.getBlockNumber();
  const [a, b] = await Promise.all([readProvider.getBlock(EARLIEST), readProvider.getBlock(latest)]);
  const t0 = a ? Number(a.timestamp) : Math.floor(Date.now() / 1000) - (latest - EARLIEST) * 3;
  const t1 = b ? Number(b.timestamp) : Math.floor(Date.now() / 1000);
  const spb = t1 > t0 ? (t1 - t0) / Math.max(1, latest - EARLIEST) : 3;
  return { latest, t0, spb };
}

const _cache = new Map<string, { at: number; data: PricePoint[] }>();

/**
 * Full-history price points for `pair`, pricing `baseToken` in the other reserve
 * (ETH for the MIDGARD pair, MIDGARD for a launch pair). Cached 60s per pair.
 */
export async function loadPriceSeries(pair: string, baseToken: string): Promise<PricePoint[]> {
  if (!pair || pair === "0x0000000000000000000000000000000000000000") return [];
  const key = pair.toLowerCase();
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;

  const c = new Contract(pair, PAIR_ABI, readProvider);
  const [cl, t0addr] = await Promise.all([clock(), c.token0()]);
  const baseIs0 = String(t0addr).toLowerCase() === baseToken.toLowerCase();

  let logs: any[] = [];
  try {
    logs = await c.queryFilter(c.filters.Sync(), EARLIEST, "latest");
  } catch {
    for (let f = EARLIEST; f <= cl.latest; f += CHUNK) {
      try { logs.push(...await c.queryFilter(c.filters.Sync(), f, Math.min(cl.latest, f + CHUNK - 1))); } catch {}
    }
  }

  const byTime = new Map<number, number>(); // second → last price that second
  for (const l of logs) {
    const r0 = Number(formatUnits(l.args?.reserve0 ?? l.args?.[0] ?? 0, 18));
    const r1 = Number(formatUnits(l.args?.reserve1 ?? l.args?.[1] ?? 0, 18));
    const base = baseIs0 ? r0 : r1;
    const quote = baseIs0 ? r1 : r0;
    if (base <= 0 || quote <= 0) continue;
    const ts = Math.round(cl.t0 + (l.blockNumber - EARLIEST) * cl.spb);
    byTime.set(ts, quote / base);
  }
  const data = Array.from(byTime.entries()).map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
  _cache.set(key, { at: Date.now(), data });
  return data;
}
