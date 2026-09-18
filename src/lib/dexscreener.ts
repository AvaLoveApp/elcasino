// DexScreener token search — used by the create dialog (pick a token by name or
// address, auto-lock its name + logo) and by game pages (link to the pool).
export type DexToken = {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  chainId: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidityUsd?: number;
  marketCap?: number;
  priceChangeH24?: number;  // 24h price change %
  volumeH24?: number;       // 24h volume USD
  url?: string; // dexscreener pair page
};

const SEARCH = "https://api.dexscreener.com/latest/dex/search?q=";
const TOKENS = "https://api.dexscreener.com/latest/dex/tokens/";

// This app lives entirely on the Robinhood chain — DexScreener tags those pairs
// with chainId "robinhood". We keep every search/list scoped to it so the create
// dialog and the deploy shelf never surface a token from another chain.
export const ROBINHOOD_CHAIN = "robinhood";

function pairToToken(p: any): DexToken {
  return {
    address: p.baseToken?.address ?? "",
    name: p.baseToken?.name ?? "",
    symbol: p.baseToken?.symbol ?? "",
    logo: p.info?.imageUrl,
    chainId: p.chainId ?? "",
    pairAddress: p.pairAddress,
    priceUsd: p.priceUsd,
    liquidityUsd: p.liquidity?.usd,
    marketCap: p.marketCap ?? p.fdv,
    priceChangeH24: p.priceChange?.h24 != null ? Number(p.priceChange.h24) : undefined,
    volumeH24: p.volume?.h24 != null ? Number(p.volume.h24) : undefined,
    url: p.url,
  };
}

/** Search by token name/symbol or paste a contract address. Robinhood-chain only.
 *  Returns the best pair per unique base-token, ranked by liquidity. */
export async function searchDexTokens(query: string, limit = 8): Promise<DexToken[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const isAddr = /^0x[a-fA-F0-9]{40}$/.test(q);
    const url = isAddr ? `${TOKENS}${q}` : `${SEARCH}${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];
    return bestPerToken(pairs, (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)).slice(0, limit);
  } catch { return []; }
}

/** Collapse a pair list to the best pair per unique Robinhood base-token
 *  (highest market cap wins the dedupe), then sort with `cmp`. */
function bestPerToken(pairs: any[], cmp: (a: DexToken, b: DexToken) => number): DexToken[] {
  const byToken = new Map<string, DexToken>();
  for (const p of pairs) {
    const t = pairToToken(p);
    if (!t.address || t.chainId !== ROBINHOOD_CHAIN) continue;
    const key = t.address.toLowerCase();
    const prev = byToken.get(key);
    if (!prev || (t.marketCap ?? 0) > (prev.marketCap ?? 0)) byToken.set(key, t);
  }
  return Array.from(byToken.values()).sort(cmp);
}

async function fetchPairs(url: string): Promise<any[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // /latest/dex/* returns {pairs:[…]}; /tokens/v1/* returns a bare array.
    return Array.isArray(data) ? data : (data.pairs ?? []);
  } catch { return []; }
}

// Seed queries whose results, merged, surface the biggest Robinhood tokens.
// DexScreener has no "top tokens on a chain" endpoint and its search matches
// token name/symbol only, so we union a few high-signal queries and rank the
// merged set by market cap ourselves.
const DEPLOY_SEEDS = ["Robinhood Token", "robinhood", "arena", "coin", "inu"];

let deployCache: { at: number; data: DexToken[] } | null = null;
const DEPLOY_TTL = 120_000;

/**
 * The deploy shelf's token universe: the top Robinhood tokens by market cap.
 * Merges several name searches with any `extraAddresses` (e.g. the RWA stock
 * tokens, which don't surface via name search) and returns one entry per token,
 * ranked by market cap. Cached for 2 min; pass force to bypass.
 */
export async function loadRobinhoodTokens(extraAddresses: string[] = [], force = false): Promise<DexToken[]> {
  if (!force && deployCache && Date.now() - deployCache.at < DEPLOY_TTL) return deployCache.data;

  const jobs: Promise<any[]>[] = DEPLOY_SEEDS.map((q) => fetchPairs(`${SEARCH}${encodeURIComponent(q)}`));
  // The tokens endpoint takes up to 30 comma-separated addresses in one call.
  const addrs = extraAddresses.filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
  if (addrs.length) jobs.push(fetchPairs(`https://api.dexscreener.com/tokens/v1/${ROBINHOOD_CHAIN}/${addrs.slice(0, 30).join(",")}`));

  const merged = (await Promise.all(jobs)).flat();
  const data = bestPerToken(merged, (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  deployCache = { at: Date.now(), data };
  return data;
}

// Enrichment cache for the RWA universe — keyed by the sorted address set so a
// different request key busts it. 2-min TTL, same as the deploy shelf.
let dexMapCache: { key: string; at: number; data: Map<string, DexToken> } | null = null;

/**
 * Best DexScreener pair per address, for a (possibly large) address list. The
 * tokens endpoint takes up to 30 addresses per call, so we chunk. Returns a
 * Map keyed by lowercased address; tokens without a Robinhood-chain pair are
 * simply absent (the caller falls back to its static metadata). Cached 2 min.
 */
export async function loadDexMap(addresses: string[], force = false): Promise<Map<string, DexToken>> {
  const addrs = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => /^0x[a-f0-9]{40}$/.test(a)).sort();
  const out = new Map<string, DexToken>();
  if (!addrs.length) return out;
  const key = addrs.join(",");
  if (!force && dexMapCache && dexMapCache.key === key && Date.now() - dexMapCache.at < DEPLOY_TTL) return dexMapCache.data;

  const jobs: Promise<any[]>[] = [];
  for (let i = 0; i < addrs.length; i += 30) {
    jobs.push(fetchPairs(`https://api.dexscreener.com/tokens/v1/${ROBINHOOD_CHAIN}/${addrs.slice(i, i + 30).join(",")}`));
  }
  const merged = (await Promise.all(jobs)).flat();
  for (const t of bestPerToken(merged, (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))) {
    out.set(t.address.toLowerCase(), t);
  }
  dexMapCache = { key, at: Date.now(), data: out };
  return out;
}

/** Look up a single token's best pair by address (for game-page pool link). */
export async function dexTokenByAddress(address: string): Promise<DexToken | null> {
  const list = await searchDexTokens(address, 1);
  return list[0] ?? null;
}

/** USD price per token address (lowercased), via the batched tokens endpoint
 *  (up to 30 addresses per call). Used to value casino fees in $. */
export async function dexPricesUsd(addresses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const addrs = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => /^0x[a-f0-9]{40}$/.test(a));
  if (!addrs.length) return out;
  const jobs: Promise<any[]>[] = [];
  for (let i = 0; i < addrs.length; i += 30) {
    jobs.push(fetchPairs(`https://api.dexscreener.com/tokens/v1/${ROBINHOOD_CHAIN}/${addrs.slice(i, i + 30).join(",")}`));
  }
  const merged = (await Promise.all(jobs)).flat();
  for (const t of bestPerToken(merged, () => 0)) {
    const p = Number(t.priceUsd ?? 0);
    if (p > 0) out.set(t.address.toLowerCase(), p);
  }
  return out;
}

export function fmtUsdShort(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}
