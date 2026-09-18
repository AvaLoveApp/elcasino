import { Contract, EventLog, formatUnits } from "ethers";
import { readMidgard, readPair, readProvider, ADDR } from "./chain";
import { CASINO_GAMES, loadFactoryStats, loadFactoryGames, isBlockedCasinoToken, erc20MetaMany } from "./casino";
import { fmtInt } from "./util";

/**
 * Unified "recent activity" feed for the right rail — MIDGARD trades, launchpad
 * launches and new casino rooms, merged newest-first. Cached so the widget and
 * any explore surface share one scan.
 */
export type ActivityKind = "buy" | "sell" | "launch" | "casino";
export type Activity = {
  id: string; kind: ActivityKind;
  title: string; sub: string;
  ts: number; href: string; color: string; logo?: string;
};

const SWAP_LOOKBACK = 120_000;
const compact = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : fmtInt(n));

async function recentSwaps(limit = 6): Promise<Activity[]> {
  try {
    const m = readMidgard();
    const pair = await m.primaryPair();
    if (!pair || pair === "0x0000000000000000000000000000000000000000") return [];
    const pairR = readPair(pair);
    const t0: string = await pairR.token0();
    const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
    const iface = new Contract(pair, [
      "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
    ], readProvider);
    const latest = await readProvider.getBlockNumber();
    const logs = (await iface.queryFilter(iface.filters.Swap(), Math.max(0, latest - SWAP_LOOKBACK), "latest")) as EventLog[];
    const recent = logs.slice(-limit).reverse();
    return Promise.all(recent.map(async (l) => {
      const a: any = l.args;
      const midOut = (midIs0 ? a.amount0Out : a.amount1Out) as bigint;
      const midIn = (midIs0 ? a.amount0In : a.amount1In) as bigint;
      const ethIn = (midIs0 ? a.amount1In : a.amount0In) as bigint;
      const ethOut = (midIs0 ? a.amount1Out : a.amount0Out) as bigint;
      const isBuy = midOut > 0n;
      const mid = Number(formatUnits(isBuy ? midOut : midIn, 18));
      const eth = Number(formatUnits(isBuy ? ethIn : ethOut, 18));
      let ts = 0; try { const b = await readProvider.getBlock(l.blockNumber); ts = b ? Number(b.timestamp) : 0; } catch {}
      return {
        id: `${l.transactionHash}-${l.index}`, kind: (isBuy ? "buy" : "sell") as ActivityKind,
        title: `${isBuy ? "Bought" : "Sold"} ${compact(mid)} ELCAS`, sub: `${eth.toFixed(4)} ETH`,
        ts, href: "/token", color: isBuy ? "#93E014" : "#C8353B",
      };
    }));
  } catch { return []; }
}

async function recentCasino(perFactory = 2): Promise<Activity[]> {
  try {
    const per = await Promise.all(CASINO_GAMES.map(async (gk) => {
      const st = await loadFactoryStats(gk.factory).catch(() => ({ total: 0, deployFee: 0n }));
      const start = Math.max(0, st.total - perFactory);
      const games = st.total
        ? await loadFactoryGames(gk.factory, start, Math.min(perFactory, st.total - start)).catch(() => [])
        : [];
      return games.map((g) => ({ g, gk }));
    }));
    const flat = per.flat();
    // Hide owner-blocked tokens (by address or symbol) from the activity feed.
    const meta = await erc20MetaMany(flat.map((x) => x.g.token)).catch(() => new Map());
    return flat
      .filter(({ g }) => !isBlockedCasinoToken(g.token, meta.get(g.token.toLowerCase())?.symbol))
      .map(({ g, gk }) => ({
        id: `casino-${g.address}`, kind: "casino" as ActivityKind,
        title: `New ${gk.label} room`, sub: g.betName || gk.label,
        ts: g.createdAt, href: `/casino/room/${gk.key}/${g.address}`, color: gk.color, logo: g.tokenLogoUrl,
      }));
  } catch { return []; }
}

let cache: { at: number; data: Activity[] } | null = null;
const TTL = 45_000;

export async function loadRecentActivity(force = false): Promise<Activity[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  const [sw, ca] = await Promise.all([recentSwaps(6), recentCasino()]);
  const data = [...sw, ...ca].filter((a) => a.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 5);
  cache = { at: Date.now(), data };
  return data;
}
