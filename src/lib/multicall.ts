import { Contract, Interface } from "ethers";
import { readProvider } from "./chain";

// Canonical Multicall3, deployed at the same address on Robinhood Chain (verified
// on-chain). Batching hundreds of view reads into ONE eth_call is the single
// biggest lever against the RPC rate-limit flood: the casino aggregation used to
// fire ~4 calls per room (getGameInfo, getPlatformInfo, decimals, symbol) — many
// hundreds of round-trips — and now resolves in a handful of multicall requests.
export const MULTICALL3_ADDR = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MC3_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)",
];

export type Call3 = { target: string; callData: string; allowFailure?: boolean };
export type Call3Result = { success: boolean; returnData: string };

let _mc: Contract | null = null;
function mc(): Contract {
  return (_mc ??= new Contract(MULTICALL3_ADDR, MC3_ABI, readProvider));
}

/** Run many view calls in a single eth_call (chunked so no response gets huge).
 *  Every call defaults to allowFailure so one bad room never sinks the batch. */
export async function aggregate3(calls: Call3[], chunkSize = 50): Promise<Call3Result[]> {
  if (calls.length === 0) return [];
  const out: Call3Result[] = [];
  for (let i = 0; i < calls.length; i += chunkSize) {
    const chunk = calls.slice(i, i + chunkSize).map((c) => ({
      target: c.target, allowFailure: c.allowFailure ?? true, callData: c.callData,
    }));
    const res: any[] = await mc().aggregate3(chunk);
    for (const r of res) out.push({ success: r[0] ?? r.success, returnData: r[1] ?? r.returnData });
  }
  return out;
}

/** Encode a call from an Interface + args, ready for aggregate3. */
export function encodeCall(iface: Interface, target: string, fn: string, args: any[] = []): Call3 {
  return { target, callData: iface.encodeFunctionData(fn, args) };
}

/** Decode an aggregate3 result; returns null on a failed/empty read. */
export function decodeResult(iface: Interface, fn: string, r: Call3Result): any | null {
  if (!r || !r.success || !r.returnData || r.returnData === "0x") return null;
  try { return iface.decodeFunctionResult(fn, r.returnData); } catch { return null; }
}
