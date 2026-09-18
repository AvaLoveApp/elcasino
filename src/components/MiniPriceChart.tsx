import { useEffect, useState } from "react";
import { formatUnits, Contract, EventLog } from "ethers";
import { TrendingUp, TrendingDown } from "lucide-react";
import { readMidgard, readPair, readProvider, ADDR } from "../lib/chain";
import { fmtPrice } from "../lib/util";
import { EthMark } from "./UnitMark";

// Robinhood blocks are fast (~1-2s), so a "24h" window in blocks is large and,
// worse, the token is only days old — most Sync events sit near launch, outside
// a tight window. Scan wide (covers the token's whole life; Robinhood accepts
// wide ranges) and downsample for the sparkline. Matches the analytics chart so
// the two never disagree ("not enough history" while analytics shows a full line).
const LOOKBACK_BLOCKS = 5_000_000;
const MAX_POINTS = 120;
const REFRESH_MS = 60_000;

type Point = { block: number; price: number };

/**
 * Compact ~24-hour price sparkline for the Trade tab. Rebuilds price from the
 * pair's Sync events (each Sync = a reserve snapshot). No polling loop other
 * than a slow refresh — every swap already fires a Sync so intra-day precision
 * comes free.
 */
export function MiniPriceChart() {
  const [pts, setPts] = useState<Point[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let timer: any = null;
    async function load() {
      try {
        const pair = await readMidgard().primaryPair();
        if (!pair || pair === "0x0000000000000000000000000000000000000000") {
          setPts([]); return;
        }
        const p = readPair(pair);
        const t0 = await p.token0();
        const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
        const iface = new Contract(pair, [
          "event Sync(uint112 reserve0, uint112 reserve1)",
        ], readProvider);
        const latest = await readProvider.getBlockNumber();
        const from = Math.max(0, latest - LOOKBACK_BLOCKS);
        const logs = (await iface.queryFilter(iface.filters.Sync(), from, "latest")) as EventLog[];
        const rows: Point[] = [];
        for (const l of logs) {
          const r0 = BigInt(l.args?.reserve0 ?? l.args?.[0] ?? 0);
          const r1 = BigInt(l.args?.reserve1 ?? l.args?.[1] ?? 0);
          const mid = Number(formatUnits(midIs0 ? r0 : r1, 18));
          const eth = Number(formatUnits(midIs0 ? r1 : r0, 18));
          if (mid > 0 && eth > 0) rows.push({ block: l.blockNumber, price: eth / mid });
        }
        // Fallback: include the current live price at the end so the chart
        // reflects the pool's latest state even between Sync events.
        try {
          const [r, ] = await Promise.all([p.getReserves()]);
          const mid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
          const eth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
          if (mid > 0 && eth > 0) rows.push({ block: latest, price: eth / mid });
        } catch { /* ignore — Sync data alone is fine */ }

        // Downsample to keep the sparkline light when there are many Syncs.
        let out = rows;
        if (rows.length > MAX_POINTS) {
          const step = rows.length / MAX_POINTS;
          out = Array.from({ length: MAX_POINTS }, (_, i) => rows[Math.floor(i * step)]);
          out.push(rows[rows.length - 1]);
        }
        if (live) { setErr(null); setPts(out); }
      } catch {
        if (live && pts === null) setErr("Waiting on the pair…");
      } finally {
        if (live) timer = setTimeout(load, REFRESH_MS);
      }
    }
    load();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);

  if (err && !pts) return null;
  if (!pts) {
    return (
      <div className="panel px-4 py-3 flex items-center gap-3">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-8 flex-1 rounded" />
      </div>
    );
  }
  if (pts.length < 2) {
    return (
      <div className="panel px-4 py-3 text-[11px] font-mono text-bone-500">
        not enough swap history yet — this fills in as swaps happen
      </div>
    );
  }

  const first = pts[0].price;
  const last = pts[pts.length - 1].price;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const up = changePct >= 0;
  const stroke = up ? "#10b981" : "#B01B21";
  const fill = up ? "rgba(16,185,129,0.15)" : "rgba(176,27,33,0.15)";

  const w = 600, h = 44, padL = 4, padR = 4, padT = 4, padB = 4;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const min = Math.min(...pts.map((p) => p.price));
  const max = Math.max(...pts.map((p) => p.price));
  const range = Math.max(max - min, 1e-30);
  const x = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - min) / range) * plotH;
  const line = "M" + pts.map((p, i) => `${x(i)},${y(p.price)}`).join(" L");
  const area = `${line} L${x(pts.length - 1)},${padT + plotH} L${padL},${padT + plotH} Z`;

  return (
    <div className="panel px-4 py-3 flex items-center gap-3">
      <div className="shrink-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500">price trend</div>
        <div className="font-mono text-sm text-bone-100 tabular-nums">{fmtPrice(last)} <span className="text-bone-500 inline-flex items-center gap-0.5"><EthMark />ETH</span></div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="flex-1 block" style={{ height: h }}>
        <path d={area} fill={fill} />
        <path d={line} stroke={stroke} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" opacity={0.45} />
        <path d={line} stroke={stroke} strokeWidth={1.75} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" className="mg-flowln" />
      </svg>
      <div className={`shrink-0 inline-flex items-center gap-1 font-mono text-sm tabular-nums ${up ? "text-emerald-400" : "text-blood-400"}`}>
        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {up ? "+" : ""}{changePct.toFixed(2)}%
      </div>
    </div>
  );
}
