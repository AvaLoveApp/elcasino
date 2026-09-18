import { Contract, Interface, formatUnits } from "ethers";
import { readProvider, ERC20_ABI, ADDR } from "./chain";
import { dexPricesUsd } from "./dexscreener";
import { aggregate3, encodeCall, decodeResult } from "./multicall";

/**
 * Midgard Casino — thin wrapper over the 10 Avlo/Robinhood game factories
 * that are already live on chain 4663. Every factory exposes the same core
 * surface: getTotalGames, getGames(offset, limit), createGame. We use just
 * the read paths here; create + play flows live in dedicated components.
 *
 * Factory addresses come from the Robinhood deployment JSON in the games
 * repo. No new contracts needed.
 */

export const CASINO_CHAIN_ID = 4663;
export const CASINO_TREASURY = "0x85228f9817798e97c599ec4b2bed0f1104b51273";

// External play URL — for now every game links to Avlo's hosted frontend.
// Later we render the play surface inline (mines, coinflip etc are simple).
export const AVLO_BASE = "https://avlo.games"; // placeholder — replace with the actual host

export type GameKey =
  | "roulette" | "crash" | "blackjack" | "coinflip" | "plinko"
  | "dice"    | "wheel" | "mines"     | "slots"    | "boxes";

export type CasinoGameKind = {
  key: GameKey;
  label: string;
  factory: string;
  color: string;
  desc: string;
  glyph: string;
};

export const CASINO_GAMES: CasinoGameKind[] = [
  { key: "roulette",  label: "Roulette",   factory: "0x44879d592851CD23853FA9802e01738E09b742eB", color: "#10b981", desc: "Classic wheel · 37 pockets · odds up to 35×", glyph: "🎰" },
  { key: "crash",     label: "Crash",      factory: "0x37B46a6c3ED48bb7024Aa5Ad263C9b09d5c5e14b", color: "#a855f7", desc: "Cash out before the multiplier crashes",       glyph: "🚀" },
  { key: "blackjack", label: "Blackjack",  factory: "0xC7632E38D3eeed5b057D984132F48A258c981DB0", color: "#0f766e", desc: "21 or bust · house dealer, chain shuffle",      glyph: "🃏" },
  { key: "coinflip",  label: "Coinflip",   factory: "0xB9409da5E0B3E290FA3482f439a9791aEA13DA57", color: "#f59e0b", desc: "Heads or tails · 1.98× payout",                 glyph: "🪙" },
  { key: "plinko",    label: "Plinko",     factory: "0x9AB72Fc99C13b02c7453378AEA431D9589A54F4B", color: "#eab308", desc: "Drop, bounce, land · adjustable risk",          glyph: "⚡" },
  { key: "dice",      label: "Range",      factory: "0x1548b370F7b09314A8cDEEf0fA030B2BF1cF22f1", color: "#3b82f6", desc: "Pick a number range · higher risk = higher pay", glyph: "🎯" },
  { key: "wheel",     label: "Wheel",      factory: "0x67BA9345D8e829034dd2341F3a95bEbBa4692718", color: "#ec4899", desc: "Spin the risk-tuned wheel",                     glyph: "🎡" },
  { key: "mines",     label: "Mines",      factory: "0x17D937E32ae4014dC53AACA1E7d7e1a4Db205D87", color: "#dc2626", desc: "Reveal tiles, avoid the mines",                 glyph: "💣" },
  { key: "slots",     label: "Slots",      factory: "0xe9e1967C2943b45c46Ba62538C9fA8C492CFEFB0", color: "#10b981", desc: "3-reel slot · classic symbols",                 glyph: "🍒" },
  { key: "boxes",     label: "100 Boxes",  factory: "0x842A87aed27d7449d8725480EFa0462557239C6E", color: "#6366f1", desc: "Pick a box, reveal its prize",                  glyph: "📦" },
];

// Every factory shares this surface — we only need the reads.
export const FACTORY_ABI = [
  "function getTotalGames() view returns (uint256)",
  "function getGames(uint256 offset, uint256 limit) view returns (tuple(address gameAddress, address owner, address creator, address token, string tokenLogoUrl, string betName, uint256 createdAt)[])",
  "function getGamesByOwner(address _owner) view returns (uint256[])",
  "function deployFee() view returns (uint256)",
  "function treasury() view returns (address)",
  "function createGame(address _token, string _tokenLogoUrl, string _betName, uint256 _rtpBP, uint256 _feeBP, uint256 _maxWinBP, uint256 _minBet, uint256 _maxBetPoolRatio, uint256 _initialPool) payable returns (address)",
  "event GameCreated(uint256 indexed gameId, address indexed gameAddress, address indexed owner, address token, string betName, uint256 createdAt)",
];

// Robinhood deploy fee (native ETH) — from the deployment JSON. Owner/treasury
// are exempt on-chain; everyone else pays this when creating a game.
export const DEPLOY_FEE_WEI = 5_000_000_000_000_000n; // 0.005 ETH

// ── Bet-token safety ────────────────────────────────────────────────────────
// MIDGARD-family tokens (the MIDGARD economy token + every launchpad token) run a
// decay + reflection engine: the balance a contract holds shrinks/relocates over
// time and on transfers. A casino room holds the bet token in a pool and pays out
// against flat internal accounting, so a decaying/fee-on-transfer token drifts the
// real balance below what the game owes — payouts revert and funds get stranded.
// Such tokens must never back a room.
const MIDGARD_BLOCKED = new Set<string>([
  ADDR.token.toLowerCase(),        // MIDGARD v3 economy token
  ADDR.tokenLegacy.toLowerCase(),  // MIDGARD v2 (kept for reference)
]);

/** Sync check against the known MIDGARD economy-token addresses (no RPC). Used to
 *  keep them out of the deploy shelf. */
export function isMidgardFamilyAddr(addr: string): boolean {
  return MIDGARD_BLOCKED.has(addr.toLowerCase());
}

// Owner-curated blocklist — bet tokens whose rooms/bets must never surface
// anywhere in the casino (live rooms, deploy shelves, and the recent-bets feed).
// Matched by token address AND by symbol, since some surfaces (the bet feed)
// only carry the symbol, not the token address.
const BLOCKED_CASINO_TOKENS = new Set<string>([
  "0x7e37298e240c1e644f6f9f96b6a3aa6c5aea9885",
  "0x7a7deb05c296156be23cf75597315b07aaa09f24",
  "0xe8fb470e0685437d7739bd2aacba60b228800335",
  "0x50832d74a7160e2f7d361f5e678e107d228b9aa6", // ARENA
  "0x49d8022cfa113dadb8cb1a5b22250524cf24b926",
  "0xe452B6e2D0eeECA50b6d51CDcaf340fE30DBb64D",
  "0xaB0B7C3D5572e715f66e604C65bC8E25d9A5d3b6",
].map((a) => a.toLowerCase()));
const BLOCKED_CASINO_SYMBOLS = new Set<string>(
  ["wol", "wolf", "pack", "avlo", "arena", "throbbin"],
);

/** True when a bet token is on the owner blocklist and should be hidden —
 *  matched by token address or (as a fallback) by token symbol. */
export function isBlockedCasinoToken(addr?: string, symbol?: string): boolean {
  if (addr && BLOCKED_CASINO_TOKENS.has(addr.toLowerCase())) return true;
  if (symbol && BLOCKED_CASINO_SYMBOLS.has(symbol.trim().toLowerCase())) return true;
  return false;
}

const DECAY_PROBE_ABI = ["function decayRatePerSecond() view returns (uint256)"];

/** True when a token is unsafe as a casino bet token — a known MIDGARD address, or
 *  any token exposing the decay engine (MIDGARD + all launchpad tokens share the
 *  same surface; a plain ERC-20 reverts on this call). */
export async function isCasinoUnsafeToken(addr: string): Promise<boolean> {
  if (isMidgardFamilyAddr(addr)) return true;
  try {
    await new Contract(addr, DECAY_PROBE_ABI, readProvider).decayRatePerSecond();
    return true; // responded → has the decay/reflection engine → unsafe
  } catch {
    return false; // reverted → plain ERC-20 → fine
  }
}

export type FactoryGame = {
  address: string;
  owner: string;
  creator: string;
  token: string;
  tokenLogoUrl: string;
  betName: string;
  createdAt: number;
};

export function readFactory(addr: string) {
  return new Contract(addr, FACTORY_ABI, readProvider);
}

// Per-factory single-flight + short cache. The casino page reads every factory's
// stats from several places at once (stats strip, tab totals, room columns,
// analytics) — without this each mount re-scans all 10 factories. Shared here so
// concurrent callers await ONE request and repeats within the TTL are free.
type FactoryStats = { total: number; deployFee: bigint };
const _fsCache = new Map<string, { at: number; data: FactoryStats }>();
const _fsInflight = new Map<string, Promise<FactoryStats>>();
const FS_TTL = 20_000;
export async function loadFactoryStats(f: string): Promise<FactoryStats> {
  const key = f.toLowerCase();
  const cached = _fsCache.get(key);
  if (cached && Date.now() - cached.at < FS_TTL) return cached.data;
  const flying = _fsInflight.get(key);
  if (flying) return flying;
  const c = readFactory(f);
  const p = Promise.all([
    c.getTotalGames().catch(() => 0n),
    c.deployFee().catch(() => 0n),
  ]).then(([total, deployFee]) => {
    const data: FactoryStats = { total: Number(total), deployFee: deployFee as bigint };
    _fsCache.set(key, { at: Date.now(), data });
    return data;
  }).finally(() => { _fsInflight.delete(key); });
  _fsInflight.set(key, p);
  return p;
}

export async function loadFactoryGames(f: string, offset: number, limit: number): Promise<FactoryGame[]> {
  const c = readFactory(f);
  try {
    const rows = await c.getGames(offset, limit);
    return rows.map((r: any) => ({
      address: r.gameAddress ?? r[0],
      owner: r.owner ?? r[1],
      creator: r.creator ?? r[2],
      token: r.token ?? r[3],
      tokenLogoUrl: r.tokenLogoUrl ?? r[4],
      betName: r.betName ?? r[5],
      createdAt: Number(r.createdAt ?? r[6]),
    }));
  } catch { return []; }
}

// Unique bet-token universe across every casino game type — the tokens people can
// trade on the Trade page. Scans the latest rooms of each factory, dedupes, and
// caches briefly (the Trade page then enriches these with DexScreener price data).
let _casinoTokCache: { at: number; data: string[] } | null = null;
let _casinoTokInflight: Promise<string[]> | null = null;
export async function loadCasinoTokens(perGame = 15): Promise<string[]> {
  if (_casinoTokCache && Date.now() - _casinoTokCache.at < 60_000) return _casinoTokCache.data;
  if (_casinoTokInflight) return _casinoTokInflight;
  const run = (async () => {
    const lists = await Promise.all(CASINO_GAMES.map(async (g) => {
      try {
        const fs = await loadFactoryStats(g.factory);
        if (fs.total <= 0) return [];
        const start = Math.max(0, fs.total - perGame);
        const rooms = await loadFactoryGames(g.factory, start, Math.min(perGame, fs.total - start));
        return rooms.map((r) => r.token);
      } catch { return []; }
    }));
    const uniq = Array.from(new Set(lists.flat().map((a) => a.toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a))));
    // Drop owner-blocked tokens at the source — resolve symbols (batched) so the
    // block catches them by symbol too, keeping Trade/Trending/analytics clean.
    const meta = await erc20MetaMany(uniq).catch(() => new Map());
    const clean = uniq.filter((a) => !isBlockedCasinoToken(a, meta.get(a)?.symbol));
    _casinoTokCache = { at: Date.now(), data: clean };
    return clean;
  })().finally(() => { _casinoTokInflight = null; });
  _casinoTokInflight = run;
  return run;
}

export type TokenRoom = {
  address: string; gameKey: string; gameLabel: string; color: string; betName: string;
  pool: number; volume: number; stakers: number; symbol: string;
};

/** Every open casino room that bets in `token`, across all game types, with live
 *  pool/volume/stakers — used by the Trade page's per-token "Rooms" tab. */
export async function loadRoomsForToken(token: string, perGame = 24): Promise<TokenRoom[]> {
  const tok = token.toLowerCase();
  const lists = await Promise.all(CASINO_GAMES.map(async (g) => {
    try {
      const fs = await loadFactoryStats(g.factory);
      if (fs.total <= 0) return [];
      const start = Math.max(0, fs.total - perGame);
      const rooms = await loadFactoryGames(g.factory, start, Math.min(perGame, fs.total - start));
      const mine = rooms.filter((r) => r.token.toLowerCase() === tok);
      return Promise.all(mine.map(async (r) => {
        const [st, symbol] = await Promise.all([readRoomStats(r.address, r.token), tokenSymbol(r.token)]);
        return {
          address: r.address, gameKey: g.key, gameLabel: g.label, color: g.color, betName: r.betName, symbol,
          pool: Number(formatUnits(st.pool, st.decimals)), volume: Number(formatUnits(st.volume, st.decimals)), stakers: st.stakers,
        } as TokenRoom;
      }));
    } catch { return []; }
  }));
  return lists.flat().sort((a, b) => b.pool - a.pool);
}

// Cache token symbol lookups so a page rendering 50 games doesn't do 50 RPC.
const symbolCache = new Map<string, string>();
export async function tokenSymbol(addr: string): Promise<string> {
  const key = addr.toLowerCase();
  if (symbolCache.has(key)) return symbolCache.get(key)!;
  try {
    const c = new Contract(addr, ERC20_ABI, readProvider);
    const s: string = await c.symbol();
    symbolCache.set(key, s);
    return s;
  } catch {
    const short = addr.slice(0, 6) + "…";
    symbolCache.set(key, short);
    return short;
  }
}

// Format the payout token amount when we have decimals (default 18).
export function fmtBet(v: bigint, decimals = 18): string {
  const n = Number(formatUnits(v, decimals));
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const decimalsCache = new Map<string, number>();
export async function tokenDecimals(addr: string): Promise<number> {
  const key = addr.toLowerCase();
  if (decimalsCache.has(key)) return decimalsCache.get(key)!;
  try {
    const d = Number(await new Contract(addr, ERC20_ABI, readProvider).decimals());
    decimalsCache.set(key, d);
    return d;
  } catch { decimalsCache.set(key, 18); return 18; }
}

// ── RWA lounge ────────────────────────────────────────────────────────────
// Rooms whose bet token is a real-world asset (RWA) get their own section, with
// live liquidity + volume surfaced up front so players can sort and pick.
const POOL_ABI = [
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
  // Platform-side fees (the cut that flows to the platform treasury → MIDGARD buyback + LP).
  "function getPlatformInfo() view returns (address platformTreasury, uint256 totalPlatformFees, uint256 platformFeeBP)",
];
// Shared interfaces for multicall encoding/decoding (built once).
const POOL_IFACE = new Interface(POOL_ABI);
const ERC20_IFACE = new Interface(ERC20_ABI);

/** Batch-read decimals + symbol for many tokens in one multicall, seeding the
 *  shared metadata caches so later individual reads are free. */
export async function erc20MetaMany(tokens: string[]): Promise<Map<string, { decimals: number; symbol: string }>> {
  const uniq = Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  const out = new Map<string, { decimals: number; symbol: string }>();
  const need = uniq.filter((t) => { const c = _tokMetaCache.get(t); if (c) out.set(t, c); return !c; });
  if (need.length === 0) return out;
  const calls = need.flatMap((t) => [
    encodeCall(ERC20_IFACE, t, "decimals"),
    encodeCall(ERC20_IFACE, t, "symbol"),
  ]);
  const res = await aggregate3(calls).catch(() => [] as any[]);
  for (let i = 0; i < need.length; i++) {
    const d = decodeResult(ERC20_IFACE, "decimals", res[i * 2]);
    const s = decodeResult(ERC20_IFACE, "symbol", res[i * 2 + 1]);
    const meta = { decimals: d ? Number(d[0]) : 18, symbol: s ? String(s[0]) : "TOK" };
    _tokMetaCache.set(need[i], meta);
    out.set(need[i], meta);
  }
  return out;
}
const _tokMetaCache = new Map<string, { decimals: number; symbol: string }>();

export type RoomStats = { pool: bigint; volume: bigint; stakers: number; decimals: number };

/** Live pool/volume for a single room — used to surface liquidity in listings. */
export async function readRoomStats(address: string, token: string): Promise<RoomStats> {
  let pool = 0n, volume = 0n, stakers = 0;
  try {
    const gi = await new Contract(address, POOL_ABI, readProvider).getGameInfo();
    pool = gi[4]; volume = gi[6]; stakers = Number(gi[11]);
  } catch {}
  const decimals = await tokenDecimals(token);
  return { pool, volume, stakers, decimals };
}

/** Batched room reader — one multicall for every room's getGameInfo, plus one
 *  multicall for their tokens' decimals/symbol. Replaces N×(getGameInfo +
 *  decimals + symbol) individual reads on the casino listings. */
export async function readRoomsBatch(rooms: { address: string; token: string }[]): Promise<{ symbol: string; stats: RoomStats }[]> {
  if (rooms.length === 0) return [];
  const calls = rooms.map((r) => encodeCall(POOL_IFACE, r.address, "getGameInfo"));
  const [res, metaMap] = await Promise.all([
    aggregate3(calls).catch(() => [] as any[]),
    erc20MetaMany(rooms.map((r) => r.token)).catch(() => new Map()),
  ]);
  return rooms.map((r, i) => {
    const gi = decodeResult(POOL_IFACE, "getGameInfo", res[i]);
    const meta = metaMap.get(r.token.toLowerCase()) ?? { decimals: 18, symbol: "TOK" };
    return {
      symbol: meta.symbol,
      stats: {
        pool: gi ? (gi[4] as bigint) : 0n,
        volume: gi ? (gi[6] as bigint) : 0n,
        stakers: gi ? Number(gi[11]) : 0,
        decimals: meta.decimals,
      },
    };
  });
}

// ── Your positions ─────────────────────────────────────────────────────────
const STAKER_ABI = [
  "function getStakerInfo(address staker) view returns (uint256 shares, uint256 stakeValue, uint256 pendingFees, uint256 sharePercent)",
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
];

export type UserPosition = {
  address: string; gameKey: GameKey; gameLabel: string; glyph: string; color: string;
  betName: string; symbol: string; decimals: number; logo: string;
  shares: bigint; value: bigint; pending: bigint; sharePct: number;
};

/** Scan every factory's recent rooms for pools the user has staked in. */
export async function loadUserPositions(user: string, perFactory = 20): Promise<UserPosition[]> {
  const matched: (FactoryGame & { gk: CasinoGameKind })[] = [];
  await Promise.all(CASINO_GAMES.map(async (gk) => {
    const stats = await loadFactoryStats(gk.factory).catch(() => ({ total: 0, deployFee: 0n }));
    if (!stats.total) return;
    const start = Math.max(0, stats.total - perFactory);
    const games = await loadFactoryGames(gk.factory, start, Math.min(perFactory, stats.total - start));
    for (const g of games) matched.push({ ...g, gk });
  }));

  // Check getStakerInfo in small chunks — firing ~60 parallel eth_calls at once
  // makes the RPC drop many (they'd all fall through to null → empty list).
  const out: (UserPosition | null)[] = [];
  const CHUNK = 6;
  for (let i = 0; i < matched.length; i += CHUNK) {
    const slice = matched.slice(i, i + CHUNK);
    const part = await Promise.all(slice.map(async (m) => {
      const read = async () => {
        const c = new Contract(m.address, STAKER_ABI, readProvider);
        return c.getStakerInfo(user);
      };
      let si: any = null;
      try { si = await read(); } catch { try { si = await read(); } catch { return null; } } // one retry
      try {
        const shares = BigInt(si[0]);
        if (shares <= 0n) return null;
        const decimals = await tokenDecimals(m.token);
        const symbol = await tokenSymbol(m.token);
        return {
          address: m.address, gameKey: m.gk.key, gameLabel: m.gk.label, glyph: m.gk.glyph, color: m.gk.color,
          betName: m.betName, symbol, decimals, logo: m.tokenLogoUrl,
          shares, value: BigInt(si[1]), pending: BigInt(si[2]), sharePct: Number(si[3]) / 100,
        } as UserPosition;
      } catch { return null; }
    }));
    out.push(...part);
  }
  return out.filter((x): x is UserPosition => x !== null);
}

export type RwaGame = FactoryGame & {
  gameKey: GameKey; gameLabel: string; glyph: string; color: string;
  rwaLabel: string; rwaLogo?: string; symbol: string;
  pool: bigint; volume: bigint; stakers: number; decimals: number;
};

/**
 * Scan every factory's most recent rooms and keep the ones launched with an RWA
 * token (from RWA_PRESETS), enriched with pool/volume for ranking.
 */
export async function loadRwaGames(rwaByAddr: Map<string, { label: string; logo?: string }>, perFactory = 20): Promise<RwaGame[]> {
  const matched: (FactoryGame & { gk: CasinoGameKind })[] = [];
  await Promise.all(CASINO_GAMES.map(async (gk) => {
    const stats = await loadFactoryStats(gk.factory).catch(() => ({ total: 0, deployFee: 0n }));
    if (!stats.total) return;
    const start = Math.max(0, stats.total - perFactory);
    const games = await loadFactoryGames(gk.factory, start, Math.min(perFactory, stats.total - start));
    for (const g of games) if (rwaByAddr.has(g.token.toLowerCase())) matched.push({ ...g, gk });
  }));

  return Promise.all(matched.map(async (m) => {
    const preset = rwaByAddr.get(m.token.toLowerCase())!;
    let pool = 0n, volume = 0n, stakers = 0;
    try {
      const gi = await new Contract(m.address, POOL_ABI, readProvider).getGameInfo();
      pool = gi[4]; volume = gi[6]; stakers = Number(gi[11]);
    } catch {}
    const decimals = await tokenDecimals(m.token);
    return {
      ...m, gameKey: m.gk.key, gameLabel: m.gk.label, glyph: m.gk.glyph, color: m.gk.color,
      rwaLabel: preset.label, rwaLogo: preset.logo, symbol: preset.label,
      pool, volume, stakers, decimals,
    };
  }));
}

// ============================================================================
//                          Casino analytics (on-chain)
// ============================================================================
// Mirrors Avlo's analytics dashboard but with NO backend — every number is read
// live from the game contracts via getGameInfo. Different rooms use different
// tokens, so value aggregates (volume/pool/payouts) are grouped BY TOKEN (honest),
// while counts (rooms/bets/stakers) aggregate globally.

export type RoomRow = {
  address: string; gameKey: GameKey; label: string; glyph: string; color: string;
  betName: string; token: string; symbol: string; logo: string; decimals: number;
  pool: number; volume: number; payouts: number; fees: number;
  platformFees: number; platformFeeBP: number;
  bets: number; stakers: number; paused: boolean;
};
export type KindAgg = { key: GameKey; label: string; glyph: string; color: string; rooms: number; bets: number; stakers: number; volume: number };
export type TokenAgg = {
  symbol: string; token: string; logo: string; rooms: number;
  volume: number; pool: number; payouts: number; fees: number;
  platformFees: number;    // platform's cut, in the bet token
  priceUsd: number;        // token price (DexScreener), 0 if unknown
  platformFeesUsd: number; // platformFees × priceUsd (0 when price unknown)
};
export type CasinoAnalytics = {
  rooms: number; bets: number; stakers: number; kindsLive: number;
  byKind: KindAgg[];
  byToken: TokenAgg[];
  topRooms: RoomRow[];
  // Platform revenue — all earmarked for MIDGARD buyback + LP.
  totalGames: number;      // rooms ever deployed (all factories)
  deployFeeEth: number;    // Σ deploy fees, in ETH
  deployFeeUsd: number;
  platformFeesUsd: number; // Σ per-bet platform fees, in $
  feeRevenueUsd: number;   // deployFeeUsd + platformFeesUsd
  platformFeeBP: number;   // representative per-bet platform fee, in basis points
  ethPriceUsd: number;
  scannedAt: number;
};

// Module-level cache so navigating in/out of the analytics view (or showing the
// landing stats strip) doesn't re-scan every contract each time.
let caCache: { at: number; data: CasinoAnalytics } | null = null;
let caInflight: Promise<CasinoAnalytics> | null = null;
const CA_TTL = 60_000;

/** Scan every factory's recent rooms and read live getGameInfo for each. Sequential
 *  per factory + chunked reads so Robinhood's RPC isn't flooded into 429s.
 *  Result is cached for 60s; pass force to bypass. */
export async function loadCasinoAnalytics(perFactory = 20, force = false): Promise<CasinoAnalytics> {
  if (!force && caCache && Date.now() - caCache.at < CA_TTL) return caCache.data;
  // Single-flight: many surfaces (stats strip, trending, analytics view) request
  // this at once — share ONE full scan instead of running it several times over.
  if (!force && caInflight) return caInflight;
  const run = _scanCasinoAnalytics(perFactory);
  caInflight = run;
  try { return await run; } finally { if (caInflight === run) caInflight = null; }
}

async function _scanCasinoAnalytics(perFactory: number): Promise<CasinoAnalytics> {
  // 1) Load every factory's recent room list in parallel. readProvider batches
  //    concurrent eth_calls (batchMaxCount 40) into a few HTTP requests, so
  //    parallel is both FASTER and gentler than the old sequential/chunked scan.
  let totalGames = 0;      // rooms ever deployed (all factories) → deploy-fee base
  let deployFeeWei = 0n;   // Σ (rooms × that factory's on-chain deploy fee)
  const perKind = await Promise.all(CASINO_GAMES.map(async (gk) => {
    const stats = await loadFactoryStats(gk.factory).catch(() => ({ total: 0, deployFee: 0n }));
    totalGames += stats.total;
    deployFeeWei += BigInt(stats.total) * stats.deployFee;
    if (!stats.total) return [] as (FactoryGame & { gk: CasinoGameKind })[];
    const start = Math.max(0, stats.total - perFactory);
    const games = await loadFactoryGames(gk.factory, start, Math.min(perFactory, stats.total - start)).catch(() => []);
    return games.map((g) => ({ ...g, gk }));
  }));
  const flat = perKind.flat();

  // 2) Read every room's live getGameInfo + getPlatformInfo — batched into ONE
  //    multicall (chunked) instead of 2 eth_calls per room. Hundreds of round
  //    trips collapse into a handful, which is what keeps the RPC from 429-ing.
  const infoCalls = flat.flatMap((g) => [
    encodeCall(POOL_IFACE, g.address, "getGameInfo"),
    encodeCall(POOL_IFACE, g.address, "getPlatformInfo"),
  ]);
  const infoRes = await aggregate3(infoCalls).catch(() => [] as any[]);
  const decoded = flat.map((g, i) => ({
    g,
    gi: decodeResult(POOL_IFACE, "getGameInfo", infoRes[i * 2]),
    pi: decodeResult(POOL_IFACE, "getPlatformInfo", infoRes[i * 2 + 1]),
  })).filter((d) => d.gi);

  // 2b) Batch every room token's decimals + symbol in one more multicall.
  const metaMap = await erc20MetaMany(decoded.map((d) => String(d.gi![1] ?? d.g.token))).catch(() => new Map());
  const rows: RoomRow[] = decoded.map(({ g, gi, pi }) => {
    const token = String(gi![1] ?? g.token);
    const meta = metaMap.get(token.toLowerCase()) ?? { decimals: 18, symbol: "TOK" };
    const decimals = meta.decimals;
    return {
      address: g.address, gameKey: g.gk.key, label: g.gk.label, glyph: g.gk.glyph, color: g.gk.color,
      betName: g.betName || g.gk.label, token, symbol: meta.symbol, logo: String(gi![2] || g.tokenLogoUrl || ""), decimals,
      pool: Number(formatUnits(gi![4] ?? 0n, decimals)),
      volume: Number(formatUnits(gi![6] ?? 0n, decimals)),
      payouts: Number(formatUnits(gi![9] ?? 0n, decimals)),
      fees: Number(formatUnits(gi![8] ?? 0n, decimals)),
      platformFees: pi ? Number(formatUnits(pi[1] ?? 0n, decimals)) : 0,
      platformFeeBP: pi ? Number(pi[2] ?? 0n) : 0,
      bets: Number(gi![5] ?? 0n),
      stakers: Number(gi![11] ?? 0n),
      paused: Boolean(gi![7]),
    } as RoomRow;
  }).filter((r) => !isBlockedCasinoToken(r.token, r.symbol)); // owner-blocked tokens never count

  const kindMap = new Map<GameKey, KindAgg>();
  const tokenMap = new Map<string, TokenAgg>();
  let bets = 0, stakers = 0, platformFeeBP = 0;
  for (const r of rows) {
    bets += r.bets; stakers += r.stakers;
    if (r.platformFeeBP > platformFeeBP) platformFeeBP = r.platformFeeBP;
    const k = kindMap.get(r.gameKey) ?? { key: r.gameKey, label: r.label, glyph: r.glyph, color: r.color, rooms: 0, bets: 0, stakers: 0, volume: 0 };
    k.rooms++; k.bets += r.bets; k.stakers += r.stakers; k.volume += r.volume;
    kindMap.set(r.gameKey, k);
    const t = tokenMap.get(r.symbol) ?? { symbol: r.symbol, token: r.token, logo: "", rooms: 0, volume: 0, pool: 0, payouts: 0, fees: 0, platformFees: 0, priceUsd: 0, platformFeesUsd: 0 };
    if (!t.logo && r.logo) t.logo = r.logo;
    t.volume += r.volume; t.pool += r.pool; t.payouts += r.payouts; t.fees += r.fees; t.platformFees += r.platformFees; t.rooms++;
    tokenMap.set(r.symbol, t);
  }

  // 3) Value the platform's fees in $ — token prices + ETH price from DexScreener.
  const priceMap = await dexPricesUsd([...[...tokenMap.values()].map((t) => t.token), ADDR.weth]).catch(() => new Map<string, number>());
  const ethPriceUsd = priceMap.get(ADDR.weth.toLowerCase()) ?? 0;
  let platformFeesUsd = 0;
  for (const t of tokenMap.values()) {
    t.priceUsd = priceMap.get(t.token.toLowerCase()) ?? 0;
    t.platformFeesUsd = t.platformFees * t.priceUsd;
    platformFeesUsd += t.platformFeesUsd;
  }
  const deployFeeEth = Number(formatUnits(deployFeeWei, 18));
  const deployFeeUsd = deployFeeEth * ethPriceUsd;

  const data: CasinoAnalytics = {
    rooms: rows.length, bets, stakers, kindsLive: kindMap.size,
    byKind: [...kindMap.values()].sort((a, b) => b.bets - a.bets),
    byToken: [...tokenMap.values()].sort((a, b) => b.volume - a.volume),
    topRooms: [...rows].sort((a, b) => b.bets - a.bets).slice(0, 12),
    totalGames, deployFeeEth, deployFeeUsd, platformFeesUsd,
    feeRevenueUsd: platformFeesUsd + deployFeeUsd, platformFeeBP, ethPriceUsd,
    scannedAt: Date.now(),
  };
  caCache = { at: Date.now(), data };
  return data;
}
