import { Contract, EventLog, formatUnits, id as topicId } from "ethers";
import {
  readProvider, readMidgard, readPair, readPosts, readRegistry, followAddress, readFollow,
  postsAddress, ADDR, toPost,
} from "./chain";

// All modules live above this floor; older ranges have no logs.
const EARLIEST = 52_900_000;
const CHUNK = 100_000;

/** Query filter with chunked fallback for RPCs that reject large ranges. */
async function safeQuery(c: Contract, filter: any, from = EARLIEST): Promise<EventLog[]> {
  try {
    return (await c.queryFilter(filter, from, "latest")) as EventLog[];
  } catch {
    const latest = await readProvider.getBlockNumber();
    const out: EventLog[] = [];
    for (let f = from; f <= latest; f += CHUNK) {
      const to = Math.min(latest, f + CHUNK - 1);
      try { out.push(...((await c.queryFilter(filter, f, to)) as EventLog[])); } catch {}
    }
    return out;
  }
}

// ── Block → timestamp WITHOUT a getBlock per event ──────────────────────────
// The old path called getBlock() for every single log (thousands on an active
// pair) which floods Robinhood's RPC into 429s and blanks the page. Instead we
// calibrate a linear clock ONCE from two real blocks (an early one and the
// latest), then convert any block number to a timestamp with pure arithmetic.
// Daily bucketing only needs day-level accuracy, so a constant block time is
// more than precise enough — and it costs 2 RPC calls total instead of N.
let clock: { b0: number; t0: number; spb: number } | null = null;
async function calibrateClock(): Promise<void> {
  if (clock) return;
  try {
    const latest = await readProvider.getBlockNumber();
    const b0 = Math.max(1, Math.min(EARLIEST, latest - 1));
    const [early, tip] = await Promise.all([
      readProvider.getBlock(b0),
      readProvider.getBlock(latest),
    ]);
    const t0 = early ? Number(early.timestamp) : 0;
    const t1 = tip ? Number(tip.timestamp) : t0;
    const span = Math.max(1, latest - b0);
    // Robinhood ≈ a few seconds/block; guard against a zero/negative slope.
    const spb = t1 > t0 ? (t1 - t0) / span : 3;
    clock = { b0, t0, spb };
  } catch {
    // Fall back to a fixed ~3s/block anchored at now if calibration fails.
    clock = { b0: 0, t0: Math.floor(Date.now() / 1000), spb: 3 };
  }
}
function blockTs(bn: number): number {
  if (!clock) return 0;
  return Math.round(clock.t0 + (bn - clock.b0) * clock.spb);
}

/** Group events into daily buckets keyed by "YYYY-MM-DD" (UTC). */
export type DayBucket = { day: string; ts: number; value: number };
export function toDaily(points: { ts: number; v?: number }[]): DayBucket[] {
  const m = new Map<string, { ts: number; value: number }>();
  for (const p of points) {
    if (!p.ts) continue;
    const d = new Date(p.ts * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const cur = m.get(key) ?? { ts: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000, value: 0 };
    cur.value += p.v ?? 1;
    m.set(key, cur);
  }
  return [...m.entries()].map(([day, v]) => ({ day, ts: v.ts, value: v.value })).sort((a, b) => a.ts - b.ts);
}

/** Same daily bucketing but keeps the LATEST value per day instead of summing.
 * Used for gauge-like series (price, reserves) where "sum of today's ticks"
 * is meaningless but "where it ended today" is what a reader wants to see. */
export function toDailyLast(points: { ts: number; v: number }[]): DayBucket[] {
  const m = new Map<string, { ts: number; value: number; latestTs: number }>();
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  for (const p of sorted) {
    if (!p.ts) continue;
    const d = new Date(p.ts * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const dayTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
    const cur = m.get(key);
    if (!cur || p.ts >= cur.latestTs) m.set(key, { ts: dayTs, value: p.v, latestTs: p.ts });
  }
  return [...m.entries()].map(([day, v]) => ({ day, ts: v.ts, value: v.value })).sort((a, b) => a.ts - b.ts);
}

/** Turn any daily series into a running cumulative total. */
export function cumulative(daily: DayBucket[]): DayBucket[] {
  let sum = 0;
  return daily.map((d) => ({ ...d, value: (sum += d.value) }));
}

// ============================================================================
//                             Platform analytics
// ============================================================================

export type PlatformStats = {
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  totalFollows: number;
  totalProfiles: number;
  activeAuthors: number;
  postsPerDay: DayBucket[];
  likesPerDay: DayBucket[];
  followsPerDay: DayBucket[];
  cumulativeProfiles: DayBucket[];
  topPosters: { author: string; count: number }[];
};

/** Compact rail summary: trending posts (last N hours) + top posters this window. */
export type TrendSummary = {
  trendingPosts: { id: number; author: string; likes: number; text: string }[];
  activeAuthors: { author: string; count: number }[];
  windowHours: number;
};

export async function loadTrendSummary(hours = 72): Promise<TrendSummary> {
  await calibrateClock();
  const addr = await postsAddress();
  if (!addr) return { trendingPosts: [], activeAuthors: [], windowHours: hours };
  const p = readPosts(addr);
  const since = Math.floor(Date.now() / 1000) - hours * 3600;

  // Pull recent post creations + likes.
  const [creates, likes] = await Promise.all([
    safeQuery(p, p.filters.PostCreated()),
    safeQuery(p, p.filters.Liked()),
  ]);

  // Score posts by like-count within the window.
  const likeCount = new Map<number, number>();
  for (const l of likes) {
    const ts = blockTs(l.blockNumber);
    if (ts < since) continue;
    const on = Boolean(l.args?.liked ?? l.args?.[2]);
    if (!on) continue;
    const id = Number(l.args?.id ?? l.args?.[0]);
    likeCount.set(id, (likeCount.get(id) ?? 0) + 1);
  }
  // Active authors by post volume in window.
  const authorCount = new Map<string, number>();
  const postAuthor = new Map<number, string>();
  const postText = new Map<number, string>();
  for (const c of creates) {
    const ts = blockTs(c.blockNumber);
    const author = String(c.args?.author ?? c.args?.[1]);
    const id = Number(c.args?.id ?? c.args?.[0]);
    const replyTo = Number(c.args?.replyTo ?? c.args?.[2]);
    postAuthor.set(id, author);
    if (ts >= since && replyTo === 0) {
      authorCount.set(author, (authorCount.get(author) ?? 0) + 1);
    }
  }

  // For top scored ids we don't have text — pull those.
  const scored = [...likeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const trending = await Promise.all(scored.map(async ([id, count]) => {
    let text = ""; let author = postAuthor.get(id) ?? "";
    try {
      const raw = await p.getPost(id);
      const post = toPost(id, raw);
      author = post.author;
      const { decodeQuote } = await import("./quote");
      text = decodeQuote(post.text).text.slice(0, 100);
    } catch {}
    return { id, author, likes: count, text };
  }));

  const active = [...authorCount.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { trendingPosts: trending, activeAuthors: active, windowHours: hours };
}

export async function loadPlatformStats(): Promise<PlatformStats> {
  await calibrateClock();
  const [pAddr, fAddr] = await Promise.all([postsAddress(), followAddress()]);
  let totalProfiles = 0;
  try {
    const { readProfile } = await import("./chain");
    totalProfiles = Number(await readProfile().totalProfiles());
  } catch {}

  const posts: { author: string; ts: number; replyTo: number }[] = [];
  const likesLogs: { ts: number; liked: boolean }[] = [];
  if (pAddr) {
    const p = readPosts(pAddr);
    const created = await safeQuery(p, p.filters.PostCreated());
    for (const l of created) {
      const author = String(l.args?.author ?? l.args?.[1]);
      const replyTo = Number(l.args?.replyTo ?? l.args?.[2]);
      const ts = blockTs(l.blockNumber);
      posts.push({ author, ts, replyTo });
    }
    const liked = await safeQuery(p, p.filters.Liked());
    for (const l of liked) {
      const isLiked = Boolean(l.args?.liked ?? l.args?.[2]);
      const ts = blockTs(l.blockNumber);
      likesLogs.push({ ts, liked: isLiked });
    }
  }

  const followsLogs: { ts: number }[] = [];
  let totalFollows = 0;
  if (fAddr) {
    const f = readFollow(fAddr);
    const flogs = await safeQuery(f, f.filters.Followed());
    totalFollows = flogs.length;
    for (const l of flogs) {
      const ts = blockTs(l.blockNumber);
      followsLogs.push({ ts });
    }
  }

  const totalPosts = posts.filter((p) => p.replyTo === 0).length;
  const totalReplies = posts.filter((p) => p.replyTo > 0).length;
  const totalLikes = likesLogs.filter((l) => l.liked).length;

  const authorCounts = new Map<string, number>();
  for (const p of posts) {
    if (p.replyTo === 0) authorCounts.set(p.author, (authorCounts.get(p.author) ?? 0) + 1);
  }
  const topPosters = [...authorCounts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalPosts, totalReplies, totalLikes, totalFollows,
    totalProfiles, activeAuthors: authorCounts.size,
    postsPerDay: toDaily(posts.filter((p) => p.replyTo === 0).map((p) => ({ ts: p.ts }))),
    likesPerDay: toDaily(likesLogs.filter((l) => l.liked).map((l) => ({ ts: l.ts }))),
    followsPerDay: toDaily(followsLogs),
    cumulativeProfiles: cumulative(toDaily(posts.filter((p) => p.replyTo === 0).map((p) => ({ ts: p.ts })))),
    topPosters,
  };
}

// ============================================================================
//                             Token analytics
// ============================================================================

export type TokenStats = {
  price: number;
  poolEth: number;
  poolMid: number;
  totalBurned: number;
  totalReflected: number;
  supply: number;
  burnsPerDay: DayBucket[];       // MIDGARD burned per day (mirror-burns)
  reflectsPerDay: DayBucket[];    // MIDGARD reflected per day
  swapVolumeEthPerDay: DayBucket[]; // ETH volume from pair swaps
  cumulativeBurn: DayBucket[];
  cumulativeReflect: DayBucket[];
  priceHistory: DayBucket[];        // ETH/MIDGARD at the last Sync of each day
  liquidityHistory: DayBucket[];    // ETH liquidity in the primary pair per day
  // Fine-grained per-event series (one point per Sync/swap/burn) so the composite
  // chart is a FILLED line even for a young token with only a day or two of data.
  priceSeries: DayBucket[];         // price at every Sync
  liqSeries: DayBucket[];           // ETH reserve at every Sync
  volCumSeries: DayBucket[];        // cumulative swap volume (ETH), per swap
  burnCumSeries: DayBucket[];       // cumulative pool burn, per burn event
  reflectCumSeries: DayBucket[];    // cumulative reflected, per reflect event
};

// Session cache — the analytics page + the hero sparklines both call this, and
// re-visiting the page shouldn't re-scan the whole log range. 60s is fresh enough
// for a daily-bucketed history and makes navigation feel instant.
let _statsCache: { at: number; data: TokenStats } | null = null;
let _statsInflight: Promise<TokenStats> | null = null;

export async function loadTokenStats(force = false): Promise<TokenStats> {
  if (!force && _statsCache && Date.now() - _statsCache.at < 60_000) return _statsCache.data;
  if (_statsInflight) return _statsInflight;      // de-dupe concurrent callers
  _statsInflight = _loadTokenStats().then((d) => { _statsCache = { at: Date.now(), data: d }; return d; })
    .finally(() => { _statsInflight = null; });
  return _statsInflight;
}

async function _loadTokenStats(): Promise<TokenStats> {
  await calibrateClock();
  const m = readMidgard();
  const [supply, burned, reflected, pair] = await Promise.all([
    m.totalSupply(), m.totalPoolBurned(), m.totalReflected(), m.primaryPair(),
  ]);
  const hasPair = pair && pair !== "0x0000000000000000000000000000000000000000";

  // Fire every log scan + the pair reserves/orientation in ONE parallel round so
  // the whole history is one batch of RPC instead of four sequential waits.
  const pairIface = hasPair ? new Contract(pair, [
    "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
    "event Sync(uint112 reserve0, uint112 reserve1)",
  ], readProvider) : null;
  const pairR = hasPair ? readPair(pair) : null;
  const [burnLogs, reflectLogs, reserves, t0raw, swaps, syncs] = await Promise.all([
    safeQuery(m, m.filters.PoolBurn()),
    safeQuery(m, m.filters.Reflect()),
    pairR ? pairR.getReserves() : Promise.resolve(null),
    pairR ? pairR.token0() : Promise.resolve(""),
    pairIface ? safeQuery(pairIface, pairIface.filters.Swap()) : Promise.resolve([] as EventLog[]),
    pairIface ? safeQuery(pairIface, pairIface.filters.Sync()) : Promise.resolve([] as EventLog[]),
  ]);

  let poolEth = 0, poolMid = 0;
  const midIs0 = (t0raw || "").toLowerCase() === ADDR.token.toLowerCase();
  if (reserves) {
    poolMid = Number(formatUnits(midIs0 ? reserves[0] : reserves[1], 18));
    poolEth = Number(formatUnits(midIs0 ? reserves[1] : reserves[0], 18));
  }
  const price = poolMid ? poolEth / poolMid : 0;

  const burnPoints: { ts: number; v: number }[] = [];
  for (const l of burnLogs) {
    const amt = Number(formatUnits(l.args?.amount ?? l.args?.[0] ?? 0n, 18));
    const ts = blockTs(l.blockNumber);
    burnPoints.push({ ts, v: amt });
  }
  const reflectPoints: { ts: number; v: number }[] = [];
  for (const l of reflectLogs) {
    const amt = Number(formatUnits(l.args?.amount ?? l.args?.[0] ?? 0n, 18));
    const ts = blockTs(l.blockNumber);
    reflectPoints.push({ ts, v: amt });
  }

  // Swap volume + price/liquidity history from the pair events (already fetched
  // above in the parallel round). `midIs0` orients WETH vs MIDGARD.
  const swapPoints: { ts: number; v: number }[] = [];
  const pricePoints: { ts: number; v: number }[] = [];
  const liqPoints: { ts: number; v: number }[] = [];
  for (const l of swaps) {
    const a0In = BigInt(l.args?.amount0In ?? l.args?.[1] ?? 0);
    const a1In = BigInt(l.args?.amount1In ?? l.args?.[2] ?? 0);
    const a0Out = BigInt(l.args?.amount0Out ?? l.args?.[3] ?? 0);
    const a1Out = BigInt(l.args?.amount1Out ?? l.args?.[4] ?? 0);
    const ethIn = midIs0 ? a1In : a0In;
    const ethOut = midIs0 ? a1Out : a0Out;
    const vol = Number(formatUnits(ethIn + ethOut, 18));
    swapPoints.push({ ts: blockTs(l.blockNumber), v: vol });
  }
  for (const l of syncs) {
    const r0 = BigInt(l.args?.reserve0 ?? l.args?.[0] ?? 0);
    const r1 = BigInt(l.args?.reserve1 ?? l.args?.[1] ?? 0);
    const mid = Number(formatUnits(midIs0 ? r0 : r1, 18));
    const eth = Number(formatUnits(midIs0 ? r1 : r0, 18));
    if (mid <= 0 || eth <= 0) continue;
    const ts = blockTs(l.blockNumber);
    pricePoints.push({ ts, v: eth / mid });
    liqPoints.push({ ts, v: eth });
  }

  const burnsPerDay = toDaily(burnPoints);
  const reflectsPerDay = toDaily(reflectPoints);
  // Per-event series builders (raw points / running totals) for the filled composite.
  const rawSeries = (pts: { ts: number; v: number }[], cap = 500): DayBucket[] =>
    [...pts].filter((p) => p.ts > 0).sort((a, b) => a.ts - b.ts).slice(-cap).map((p) => ({ day: "", ts: p.ts, value: p.v }));
  const cumSeries = (pts: { ts: number; v: number }[]): DayBucket[] => {
    let run = 0;
    return [...pts].filter((p) => p.ts > 0).sort((a, b) => a.ts - b.ts).map((p) => ({ day: "", ts: p.ts, value: (run += p.v) }));
  };
  return {
    price, poolEth, poolMid,
    totalBurned: Number(formatUnits(burned, 18)),
    totalReflected: Number(formatUnits(reflected, 18)),
    supply: Number(formatUnits(supply, 18)),
    burnsPerDay, reflectsPerDay,
    swapVolumeEthPerDay: toDaily(swapPoints),
    cumulativeBurn: cumulative(burnsPerDay),
    cumulativeReflect: cumulative(reflectsPerDay),
    priceHistory: toDailyLast(pricePoints),
    liquidityHistory: toDailyLast(liqPoints),
    priceSeries: rawSeries(pricePoints),
    liqSeries: rawSeries(liqPoints),
    volCumSeries: cumSeries(swapPoints),
    burnCumSeries: cumSeries(burnPoints),
    reflectCumSeries: cumSeries(reflectPoints),
  };
}
