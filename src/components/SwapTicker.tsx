import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatUnits, Contract, EventLog } from "ethers";
import { ArrowUpRight, ArrowDownRight, Zap } from "lucide-react";
import { readMidgard, readPair, readProvider, ADDR, CHAIN } from "../lib/chain";
import { fmtInt, fmtPrice, short, timeAgo } from "../lib/util";
import { loadProfilesMap, type Profile } from "../lib/midchat";
import { Avatar } from "./Avatar";
import { EthMark, MidMark } from "./UnitMark";

// Only the last N swaps are shown; scanning further is wasteful for a ticker.
const KEEP = 12;
const LOOKBACK_BLOCKS = 200_000;

type Swap = {
  key: string;
  side: "buy" | "sell";
  mid: number;
  eth: number;
  who: string;
  ts: number;
  tx: string;
  block: number;
};

/**
 * Live tape of recent MIDGARD swaps on the primary UniV2 pair.
 * Reads Swap events + Sync-driven price to render a rolling ticker. No
 * cache — each entry is derived from a fresh log query on mount + a 15s
 * poll for tail-catching. Robinhood RPC is polled, not subscribed to.
 */
export function SwapTicker() {
  const [swaps, setSwaps] = useState<Swap[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  // Resolve which traders are Midgard social users, so the tape shows who bought
  // and who sold (name + photo) instead of a bare address.
  useEffect(() => {
    if (!swaps || swaps.length === 0) return;
    let live = true;
    loadProfilesMap(swaps.map((s) => s.who).filter(Boolean))
      .then((m) => { if (live) setProfiles((prev) => (m.size ? new Map([...prev, ...m]) : prev)); })
      .catch(() => {});
    return () => { live = false; };
  }, [swaps]);

  useEffect(() => {
    let live = true;
    let timer: any = null;
    const seen = new Set<string>();

    async function tick() {
      try {
        const m = readMidgard();
        const pair = await m.primaryPair();
        if (!pair || pair === "0x0000000000000000000000000000000000000000") { setSwaps([]); return; }
        const pairR = readPair(pair);
        const t0: string = await pairR.token0();
        const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();

        const pairIface = new Contract(pair, [
          "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
        ], readProvider);

        const latest = await readProvider.getBlockNumber();
        const from = Math.max(0, latest - LOOKBACK_BLOCKS);
        const logs = (await pairIface.queryFilter(pairIface.filters.Swap(), from, "latest")) as EventLog[];

        // Only fetch timestamps for logs we haven't already surfaced.
        const fresh = logs.filter((l) => !seen.has(`${l.transactionHash}-${l.index}`));
        if (fresh.length === 0 && swaps !== null) return;

        const ts = await Promise.all(fresh.map(async (l) => {
          try { const b = await readProvider.getBlock(l.blockNumber); return b ? Number(b.timestamp) : 0; }
          catch { return 0; }
        }));

        const rows: Swap[] = fresh.map((l, i) => {
          const a0In = BigInt(l.args?.amount0In ?? l.args?.[1] ?? 0);
          const a1In = BigInt(l.args?.amount1In ?? l.args?.[2] ?? 0);
          const a0Out = BigInt(l.args?.amount0Out ?? l.args?.[3] ?? 0);
          const a1Out = BigInt(l.args?.amount1Out ?? l.args?.[4] ?? 0);
          // ETH in / MIDGARD out → buy; MIDGARD in / ETH out → sell.
          const midOut = midIs0 ? a0Out : a1Out;
          const midIn = midIs0 ? a0In : a1In;
          const ethIn = midIs0 ? a1In : a0In;
          const ethOut = midIs0 ? a1Out : a0Out;
          const isBuy = midOut > 0n && ethIn > 0n;
          return {
            key: `${l.transactionHash}-${l.index}`,
            side: isBuy ? "buy" : "sell",
            mid: Number(formatUnits(isBuy ? midOut : midIn, 18)),
            eth: Number(formatUnits(isBuy ? ethIn : ethOut, 18)),
            who: (l.args?.to ?? l.args?.[5] ?? l.args?.sender ?? "") as string,
            ts: ts[i],
            tx: l.transactionHash,
            block: l.blockNumber,
          };
        });

        for (const r of rows) seen.add(r.key);

        if (!live) return;
        setErr(null);
        setSwaps((prev) => {
          const merged = [...rows, ...(prev ?? [])].sort((a, b) => b.block - a.block);
          return merged.slice(0, KEEP);
        });
      } catch {
        // Robinhood duplicate-CORS burst — keep last successful state and retry.
        if (swaps === null) setErr("Waiting for the pair’s ticker…");
      } finally {
        if (live) timer = setTimeout(tick, 15_000);
      }
    }
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-amber-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-blood-400">Live tape</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
          <span className="mg-live-dot" /> streaming
        </span>
      </div>

      {err && !swaps && <div className="text-blood-200 text-xs">{err}</div>}
      {swaps === null && !err && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-8 rounded" />
          ))}
        </div>
      )}
      {swaps && swaps.length === 0 && (
        <div className="text-sm text-bone-500 italic">
          no swaps in the last {LOOKBACK_BLOCKS.toLocaleString()} blocks — deep silence.
        </div>
      )}
      {swaps && swaps.length > 0 && (
        <ul className="space-y-1.5">
          {swaps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 border border-ink-700/60 bg-ink-900/30 hover:border-blood-500/40 transition">
              {s.side === "buy" ? (
                <ArrowUpRight size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <ArrowDownRight size={13} className="text-blood-400 shrink-0" />
              )}
              <span className={`font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                s.side === "buy" ? "text-emerald-400" : "text-blood-400"
              }`}>{s.side}</span>
              <span className="font-mono tabular-nums truncate">
                <span className="text-bone-100">{fmtInt(s.mid)}</span>
                <span className="text-bone-500"> <MidMark />ELCAS ↔ </span>
                <span className="text-bone-100">{s.eth >= 0.001 ? s.eth.toFixed(4) : fmtPrice(s.eth, 3)}</span>
                <span className="text-bone-500"> <EthMark />ETH</span>
              </span>
              {(() => {
                const prof = profiles.get((s.who || "").toLowerCase());
                if (prof?.username) return (
                  <Link to={`/u/${prof.username}`} className="ml-auto inline-flex items-center gap-1.5 shrink-0 hover:opacity-80" title={s.who}>
                    <Avatar uri={prof.avatar_url} name={prof.username} size={18} ring={false} />
                    <span className="text-[11px] font-medium text-bone-200 truncate max-w-[90px]">{prof.username}</span>
                  </Link>
                );
                return (
                  <a href={`${CHAIN.explorer}/address/${s.who}`} target="_blank" rel="noreferrer"
                    className="ml-auto text-[10px] font-mono text-bone-500 hover:text-blood-400 shrink-0">
                    {short(s.who)}
                  </a>
                );
              })()}
              <a href={`${CHAIN.explorer}/tx/${s.tx}`} target="_blank" rel="noreferrer"
                className="text-[10px] font-mono text-bone-600 hover:text-bone-300 shrink-0"
                title={new Date(s.ts * 1000).toLocaleString()}>
                {s.ts ? timeAgo(s.ts) : "—"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
