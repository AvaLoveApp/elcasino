import { JsonRpcProvider, Contract } from "ethers";

// ---- Robinhood Chain + Midgard Social deployment (2026-09-03) ----
export const CHAIN = {
  id: 4663,
  hexId: "0x1237",
  name: "Robinhood Chain",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  currency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

export const ADDR = {
  registry: "0xcCA063508757A8284fF8BD809490E035F5162C6D",
  profile: "0xf9D3940B1ae1CA4E583F79a1Ea73035bD6BfB757",
  token: "0x1A100a323fC64Ce03A2c057A9C4Ccf1C842Aed47", // EL-Casino ($ELCAS) — final autonomous economy token (2026-09-13)
  tokenLegacy: "0xC682a30aF73C719f4033574DfC16A3CA012bE8A6", // MIDGARD v3, kept for reference only
  router: "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba", // UniswapV2Router02
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
};

// Token display symbol. The on-chain symbol() returns "ELCAS"; use this for
// hardcoded labels so the whole UI reads consistently.
export const TOKEN_SYMBOL = "ELCAS";

// Minimal ABIs — only what the app calls.
export const PROFILE_ABI = [
  "function createProfile(string username,string displayName,string bio,string avatarURI,string coverURI)",
  "function editProfile(string displayName,string bio,string avatarURI,string coverURI)",
  "function setAvatar(string avatarURI)",
  "function setCover(string coverURI)",
  "function getProfile(address account) view returns (tuple(string username,string displayName,string bio,string avatarURI,string coverURI,uint64 createdAt,uint64 updatedAt,bool exists))",
  "function getByUsername(string username) view returns (tuple(string username,string displayName,string bio,string avatarURI,string coverURI,uint64 createdAt,uint64 updatedAt,bool exists))",
  "function ownerOfUsername(string username) view returns (address)",
  "function hasProfile(address account) view returns (bool)",
  "function isUsernameAvailable(string username) view returns (bool)",
  "function totalProfiles() view returns (uint256)",
  "function getProfilesPaged(uint256 offset,uint256 limit) view returns (address[] accounts, tuple(string username,string displayName,string bio,string avatarURI,string coverURI,uint64 createdAt,uint64 updatedAt,bool exists)[] data)",
  "event ProfileCreated(address indexed account, string username)",
  "event ProfileUpdated(address indexed account)",
];

export const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function gateToken() view returns (address)",
  "function minHold() view returns (uint256)",
  "function paused() view returns (bool)",
  "function isMember(address user) view returns (bool)",
  "function getModule(string key) view returns (address)",
  "function moduleCount() view returns (uint256)",
  "function moduleAt(uint256 i) view returns (string label, address impl)",
  "function setGateToken(address token, uint256 minHold_)",
  "function setMinHold(uint256 minHold_)",
  "function setPaused(bool paused_)",
  "function setModule(string key, address impl)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// EL-Casino ($ELCAS) economy-token surface. Autonomous differential-decay
// model: fee -> reflection (holders), pool burns faster than holders at a
// phi-adaptive rate, realized on p2p transfers + poke(). No claim/auto-LP/mirror.
export const MIDGARD_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
  // economy
  "function totalReflected() view returns (uint256)",
  "function totalPoolBurned() view returns (uint256)",
  "function currentPhi() view returns (uint256)",
  "function currentRates() view returns (uint256 holderPerSec, uint256 poolPerSec)",
  "function includedSupply() view returns (uint256)",
  "function hIndex() view returns (uint256)",
  "function feeBuyBps() view returns (uint256)",
  "function feeSellBps() view returns (uint256)",
  "function hbaseRatePerSec() view returns (uint256)",
  "function targetRatePerSec() view returns (uint256)",
  "function healRatePerSec() view returns (uint256)",
  "function phiFloor() view returns (uint256)",
  "function phiHi() view returns (uint256)",
  "function maxBurnBps() view returns (uint256)",
  "function isExcluded(address) view returns (bool)",
  "function isPair(address) view returns (bool)",
  // engine + roles
  "function poke()",
  "function primaryPair() view returns (address)",
  "function pairManager() view returns (address)",
  "function addPair(address pair)",
  "function renouncePairManager()",
  "event Reflect(uint256 amount, uint256 newHIndex)",
  "event PoolBurn(uint256 amount, uint256 newReserveMiGa)",
  "event PairAdded(address indexed pair, bool primary)",
  "event PairManagerRenounced()",
];

export const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 ts)",
  "function token0() view returns (address)",
];

export const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
  "function factory() view returns (address)",
];

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address)",
];

export function readMidgard() { return new Contract(ADDR.token, MIDGARD_ABI, readProvider); }
export function readPair(pair: string) { return new Contract(pair, PAIR_ABI, readProvider); }
export function readRouter() { return new Contract(ADDR.router, ROUTER_ABI, readProvider); }

const POST_TUPLE =
  "tuple(address author,string text,string mediaURI,uint64 createdAt,uint64 editedAt,uint256 replyTo,uint32 likeCount,bool deleted)";
export const POSTS_ABI = [
  "function createPost(string text,string mediaURI,uint256 replyTo) returns (uint256)",
  "function editPost(uint256 id,string text,string mediaURI)",
  "function deletePost(uint256 id)",
  "function toggleLike(uint256 id) returns (bool)",
  "function totalPosts() view returns (uint256)",
  `function getPost(uint256 id) view returns (${POST_TUPLE})`,
  `function getFeedPaged(uint256 offset,uint256 limit) view returns (uint256[] ids, ${POST_TUPLE}[] data)`,
  `function getByAuthorPaged(address author,uint256 offset,uint256 limit) view returns (uint256[] ids, ${POST_TUPLE}[] data)`,
  "function likedBy(uint256[] ids,address user) view returns (bool[])",
  "function authorPostCount(address author) view returns (uint256)",
  "event PostCreated(uint256 indexed id, address indexed author, uint256 indexed replyTo)",
  "event Liked(uint256 indexed id, address indexed user, bool liked, uint32 count)",
];

// Read RPC endpoint. Robinhood's public RPC intermittently returns a duplicated
// `Access-Control-Allow-Origin: *,*` header that the browser rejects, breaking
// direct reads. We default to a SAME-ORIGIN `/rpc` path (proxied by the Vite dev
// server locally and by Netlify in prod) so the browser never runs a CORS check.
// Override with VITE_RPC_URL to point at the RPC directly on a host without a proxy.
export const RPC_READ_URL: string =
  ((import.meta as any).env?.VITE_RPC_URL as string | undefined) ||
  (typeof window !== "undefined" ? new URL("/rpc", window.location.origin).href : CHAIN.rpc);

// A read-only provider so the app renders profiles without a wallet. Ethers
// coalesces concurrent reads into batched JSON-RPC payloads; batchMaxCount caps
// each batch so one HTTP request never carries too many calls.
export const readProvider = new JsonRpcProvider(RPC_READ_URL, CHAIN.id, {
  staticNetwork: true,
  // A wider stall window lets more concurrent reads coalesce into ONE bigger
  // batch — fewer HTTP round-trips is the cheapest way to stay under the limit.
  batchStallTime: 260,
  batchMaxCount: 40,
});

// ── Paced, rate-limited transport ───────────────────────────────────────────
// EVERY RPC round-trip (batched payloads included) funnels through _send — the
// one choke point. Robinhood's public RPC rate-limits hard and 429s on bursts,
// and ethers' built-in throttle doesn't reliably pace retries, so we own the
// pacing here: cap in-flight requests, enforce a minimum gap between dispatches,
// and treat 429/503 as "slow down" with exponential backoff + jitter. Excess
// reads queue and wait a few ms instead of hammering the endpoint — the app
// stays responsive and the RPC never sees a flood, however many users are on.
const MAX_CONCURRENT = 1;  // one read in flight — the RPC's rate limit is low
const MIN_SPACING = 200;   // ms between dispatches (~5 req/s ceiling) — stays under the limit
const MAX_RETRIES = 8;
const REQ_TIMEOUT = 20_000;
let _active = 0;
let _lastDispatch = 0;
const _queue: (() => void)[] = [];
function _pump() {
  if (_active >= MAX_CONCURRENT || _queue.length === 0) return;
  const wait = MIN_SPACING - (Date.now() - _lastDispatch);
  if (wait > 0) { setTimeout(_pump, wait); return; }
  _lastDispatch = Date.now();
  _active++;
  _queue.shift()!();
}
function _acquire(): Promise<() => void> {
  return new Promise((resolve) => {
    _queue.push(() => resolve(() => { _active--; _pump(); }));
    _pump();
  });
}
async function _rpcFetch(body: string): Promise<any> {
  let attempt = 0;
  for (;;) {
    const release = await _acquire();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    try {
      const resp = await fetch(RPC_READ_URL, {
        method: "POST", headers: { "content-type": "application/json" }, body, signal: ctrl.signal,
      });
      if (resp.status === 429 || resp.status === 503 || resp.status === 502) {
        if (++attempt > MAX_RETRIES) throw new Error(`RPC ${resp.status}`);
        const backoff = Math.min(2500, 120 * 2 ** attempt) + Math.random() * 150;
        clearTimeout(timer); release();
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      const json = await resp.json();
      clearTimeout(timer); release();
      return json;
    } catch (e) {
      clearTimeout(timer); release();
      if (++attempt > MAX_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, Math.min(2500, 120 * 2 ** attempt) + Math.random() * 150));
    }
  }
}
(readProvider as any)._send = async (payload: any) => {
  const json = await _rpcFetch(JSON.stringify(payload));
  return Array.isArray(json) ? json : [json];
};

// ── Read single-flight + micro-cache ────────────────────────────────────────
// Chain state only changes per block (a few seconds), but the UI mounts many
// components that each read the SAME view functions (primaryPair, currentRates,
// getReserves, factory totals, token symbol/decimals…). Without deduping, every
// component fires its own eth_call and Robinhood's public RPC 429s under the
// burst. We wrap provider.call so identical reads within a short window share a
// SINGLE in-flight request (and its result) — transparent to every caller, and
// the single biggest lever against the rate-limit flood as usage grows.
const _CALL_TTL = 2500; // ms — one result reused across a burst; refreshes ~every block
const _callCache = new Map<string, { at: number; p: Promise<string> }>();
const _origCall = readProvider.call.bind(readProvider);
readProvider.call = ((tx: any) => {
  // Only dedupe plain latest-block reads (no pending/historical or state overrides).
  const bt = tx?.blockTag;
  if (tx?.blockOverride || (bt != null && bt !== "latest")) return _origCall(tx);
  const key = `${(tx?.to ?? "").toLowerCase()}|${tx?.data ?? ""}|${tx?.from ?? ""}`;
  const now = Date.now();
  const hit = _callCache.get(key);
  if (hit && now - hit.at < _CALL_TTL) return hit.p;
  const p = _origCall(tx);
  _callCache.set(key, { at: now, p });
  // Drop failed reads so they retry immediately; prune stale entries opportunistically.
  p.catch(() => { if (_callCache.get(key)?.p === p) _callCache.delete(key); });
  if (_callCache.size > 400) for (const [k, v] of _callCache) if (now - v.at > _CALL_TTL) _callCache.delete(k);
  return p;
}) as typeof readProvider.call;

/**
 * Shared cache for immutable ERC-20 metadata (symbol/decimals never change).
 * Deduped platform-wide so no page re-fetches the same token's metadata — reads
 * resolve instantly after the first hit, and concurrent callers share one call.
 */
const _erc20MetaCache = new Map<string, Promise<{ symbol: string; decimals: number }>>();
export function erc20Meta(token: string): Promise<{ symbol: string; decimals: number }> {
  const key = token.toLowerCase();
  let p = _erc20MetaCache.get(key);
  if (!p) {
    const c = new Contract(token, ERC20_ABI, readProvider);
    p = Promise.all([c.symbol().catch(() => "TOKEN"), c.decimals().catch(() => 18)])
      .then(([symbol, decimals]) => ({ symbol: String(symbol), decimals: Number(decimals) }))
      .catch((e) => { _erc20MetaCache.delete(key); throw e; });
    _erc20MetaCache.set(key, p);
  }
  return p;
}

export function readProfile() {
  return new Contract(ADDR.profile, PROFILE_ABI, readProvider);
}
export function readRegistry() {
  return new Contract(ADDR.registry, REGISTRY_ABI, readProvider);
}
export function readToken() {
  return new Contract(ADDR.token, ERC20_ABI, readProvider);
}

// POSTS module address is resolved from the registry (getModule), so the app
// needs no hardcoded address — it lights up the moment POSTS is registered.
let _postsAddr: string | null | undefined;
export async function postsAddress(): Promise<string | null> {
  if (_postsAddr !== undefined) return _postsAddr ?? null;
  try {
    const a: string = await readRegistry().getModule("POSTS");
    _postsAddr = a && a !== "0x0000000000000000000000000000000000000000" ? a : null;
  } catch { _postsAddr = null; }
  return _postsAddr;
}
export function readPosts(addr: string) {
  return new Contract(addr, POSTS_ABI, readProvider);
}

export const BOOKMARKS_ABI = [
  "function bookmark(uint256 postId)",
  "function unbookmark(uint256 postId)",
  "function isBookmarked(address user,uint256 postId) view returns (bool)",
  "function bookmarkCount(address user) view returns (uint256)",
  "function getBookmarksPaged(address user,uint256 offset,uint256 limit) view returns (uint256[])",
  "event Bookmarked(address indexed user, uint256 indexed postId)",
  "event Unbookmarked(address indexed user, uint256 indexed postId)",
];

let _bookmarksAddr: string | null | undefined;
export async function bookmarksAddress(): Promise<string | null> {
  if (_bookmarksAddr !== undefined) return _bookmarksAddr ?? null;
  try {
    const a: string = await readRegistry().getModule("BOOKMARKS");
    _bookmarksAddr = a && a !== "0x0000000000000000000000000000000000000000" ? a : null;
  } catch { _bookmarksAddr = null; }
  return _bookmarksAddr;
}
export function readBookmarks(addr: string) {
  return new Contract(addr, BOOKMARKS_ABI, readProvider);
}

const MSG_TUPLE = "tuple(address from,uint64 ts,string text)";
export const MESSAGES_ABI = [
  "function sendMessage(address to,string text) returns (uint256)",
  "function markRead(address peer)",
  `function getThread(address a,address b,uint256 offset,uint256 limit) view returns (${MSG_TUPLE}[])`,
  "function threadLength(address a,address b) view returns (uint256)",
  "function getPeersPaged(address user,uint256 offset,uint256 limit) view returns (address[] peers, uint64[] lastAt)",
  "function peerCount(address user) view returns (uint256)",
  "function unread(address user) view returns (uint256)",
  "event MessageSent(address indexed from, address indexed to, uint256 index)",
];

let _messagesAddr: string | null | undefined;
export async function messagesAddress(): Promise<string | null> {
  if (_messagesAddr !== undefined) return _messagesAddr ?? null;
  try {
    const a: string = await readRegistry().getModule("MESSAGES");
    _messagesAddr = a && a !== "0x0000000000000000000000000000000000000000" ? a : null;
  } catch { _messagesAddr = null; }
  return _messagesAddr;
}
export function readMessages(addr: string) {
  return new Contract(addr, MESSAGES_ABI, readProvider);
}
export type Message = { from: string; ts: number; text: string };
export function toMessage(raw: any): Message {
  return {
    from: raw.from ?? raw[0],
    ts: Number(raw.ts ?? raw[1]),
    text: raw.text ?? raw[2],
  };
}

export const FOLLOW_ABI = [
  "function follow(address target)",
  "function unfollow(address target)",
  "function isFollowing(address a,address b) view returns (bool)",
  "function followingCount(address a) view returns (uint256)",
  "function followerCount(address a) view returns (uint256)",
  "function getFollowingPaged(address a,uint256 offset,uint256 limit) view returns (address[])",
  "function getFollowersPaged(address a,uint256 offset,uint256 limit) view returns (address[])",
  "event Followed(address indexed follower, address indexed target)",
  "event Unfollowed(address indexed follower, address indexed target)",
];

let _followAddr: string | null | undefined;
export async function followAddress(): Promise<string | null> {
  if (_followAddr !== undefined) return _followAddr ?? null;
  try {
    const a: string = await readRegistry().getModule("FOLLOW");
    _followAddr = a && a !== "0x0000000000000000000000000000000000000000" ? a : null;
  } catch { _followAddr = null; }
  return _followAddr;
}
export function readFollow(addr: string) {
  return new Contract(addr, FOLLOW_ABI, readProvider);
}

export type Post = {
  id: number;
  author: string;
  text: string;
  mediaURI: string;
  createdAt: number;
  editedAt: number;
  replyTo: number;
  likeCount: number;
  deleted: boolean;
};

export function toPost(id: bigint | number, raw: any): Post {
  return {
    id: Number(id),
    author: raw.author ?? raw[0],
    text: raw.text ?? raw[1],
    mediaURI: raw.mediaURI ?? raw[2],
    createdAt: Number(raw.createdAt ?? raw[3]),
    editedAt: Number(raw.editedAt ?? raw[4]),
    replyTo: Number(raw.replyTo ?? raw[5]),
    likeCount: Number(raw.likeCount ?? raw[6]),
    deleted: raw.deleted ?? raw[7],
  };
}

export type Profile = {
  username: string;
  displayName: string;
  bio: string;
  avatarURI: string;
  coverURI: string;
  createdAt: number;
  updatedAt: number;
  exists: boolean;
};

export function toProfile(raw: any): Profile {
  return {
    username: raw.username ?? raw[0],
    displayName: raw.displayName ?? raw[1],
    bio: raw.bio ?? raw[2],
    avatarURI: raw.avatarURI ?? raw[3],
    coverURI: raw.coverURI ?? raw[4],
    createdAt: Number(raw.createdAt ?? raw[5]),
    updatedAt: Number(raw.updatedAt ?? raw[6]),
    exists: raw.exists ?? raw[7],
  };
}
