import { CHAIN, ADDR } from "./chain";

/**
 * Blockscout-backed token metadata that isn't cheap to derive from RPC:
 * total holder count, market metadata, transaction totals. This is a REST
 * API call (not RPC) so it doesn't count against Robinhood's flaky quota.
 *
 * Result is memoised for 10 min — holder count moves slowly and re-fetching
 * on every mount would be wasteful.
 */
export type TokenMeta = {
  holders: number | null;
  transfers: number | null;
};

let cache: { at: number; data: TokenMeta } | null = null;
const TTL = 10 * 60_000;

export async function loadTokenMeta(): Promise<TokenMeta> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.data;
  try {
    // Two endpoints: the token doc has `holders_count`, the counters endpoint
    // has `transfers_count`. Fetch in parallel so the round-trip is one wave.
    const [tokRes, cntRes] = await Promise.all([
      fetch(`${CHAIN.explorer}/api/v2/tokens/${ADDR.token}`).catch(() => null),
      fetch(`${CHAIN.explorer}/api/v2/tokens/${ADDR.token}/counters`).catch(() => null),
    ]);
    const tokJson: any = tokRes && tokRes.ok ? await tokRes.json() : {};
    const cntJson: any = cntRes && cntRes.ok ? await cntRes.json() : {};
    const holders = tokJson.holders_count ?? tokJson.holders ?? cntJson.token_holders_count;
    const transfers = cntJson.transfers_count ?? tokJson.transfers_count;
    const data: TokenMeta = {
      holders: holders != null ? Number(holders) : null,
      transfers: transfers != null ? Number(transfers) : null,
    };
    cache = { at: now, data };
    return data;
  } catch {
    // Return whatever we last saw so the UI doesn't blank on a transient fetch.
    return cache?.data ?? { holders: null, transfers: null };
  }
}
