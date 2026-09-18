import { Contract, formatUnits } from "ethers";
import { readProvider } from "./chain";

/**
 * On-chain game surface (V3 factories from the Avlo/Robinhood deployment).
 * Games use a commit-reveal scheme: commit locks the bet + choice, then after
 * `revealExtraBlocks` blocks a reveal settles using a future block hash for
 * randomness. This module exposes the shared reads/writes; the per-game UI
 * components drive the flow.
 */

// Human-readable ABI for CoinflipGameV3 (superset works for the shared surface).
export const COINFLIP_ABI = [
  "function config() view returns (uint256 rtpBasisPoints, uint256 feeBasisPoints, uint256 maxWinBasisPoints, uint256 minBet, uint256 maxBetPoolRatio)",
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
  "function token() view returns (address)",
  "function poolBalance() view returns (uint256)",
  "function revealExtraBlocks() view returns (uint256)",
  "function MULTIPLIER_BP() view returns (uint256)",
  "function flips(uint256) view returns (address player, uint256 amount, bool settled, bool won, uint256 payout, uint256 timestamp, bytes32 seedHash, uint8 choice, uint8 result, uint256 commitBlock)",
  "function getRecentFlips(uint256 count) view returns (tuple(address player, uint256 amount, bool settled, bool won, uint256 payout, uint256 timestamp, bytes32 seedHash, uint8 choice, uint8 result, uint256 commitBlock)[])",
  "function getUserFlips(address user, uint256 offset, uint256 limit) view returns (tuple(address player, uint256 amount, bool settled, bool won, uint256 payout, uint256 timestamp, bytes32 seedHash, uint8 choice, uint8 result, uint256 commitBlock)[])",
  "function commitFlip(uint256 amount, uint8 choice) returns (uint256 flipId)",
  "function revealFlip(uint256 flipId) returns (uint8 result, bool won, uint256 payout)",
  "function snapshotBlockHash(uint256 blockNum)",
  "event FlipCommitted(uint256 indexed flipId, address indexed player, uint256 amount, uint8 choice)",
  "event FlipSettled(uint256 indexed flipId, address indexed player, uint8 result, bool won, uint256 payout)",
];

export const GAME_ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
];

export type GameInfo = {
  owner: string;
  token: string;
  tokenLogoUrl: string;
  betName: string;
  poolBalance: bigint;
  totalFlips: number;
  totalVolume: bigint;
  paused: boolean;
};

export type GameConfig = {
  rtpBps: number;
  feeBps: number;
  maxWinBps: number;
  minBet: bigint;
  maxBetPoolRatio: bigint;
};

export type Flip = {
  player: string;
  amount: bigint;
  settled: boolean;
  won: boolean;
  payout: bigint;
  timestamp: number;
  choice: number;
  result: number;
  commitBlock: number;
};

export function readGame(addr: string) {
  return new Contract(addr, COINFLIP_ABI, readProvider);
}

export async function loadGameInfo(addr: string): Promise<{ info: GameInfo; config: GameConfig; revealBlocks: number }> {
  const c = readGame(addr);
  const [gi, cfg, rb] = await Promise.all([
    c.getGameInfo(),
    c.config(),
    c.revealExtraBlocks().catch(() => 1n),
  ]);
  return {
    info: {
      owner: gi[0], token: gi[1], tokenLogoUrl: gi[2], betName: gi[3],
      poolBalance: gi[4], totalFlips: Number(gi[5]), totalVolume: gi[6], paused: gi[7],
    },
    config: {
      rtpBps: Number(cfg[0]), feeBps: Number(cfg[1]), maxWinBps: Number(cfg[2]),
      minBet: cfg[3], maxBetPoolRatio: cfg[4],
    },
    revealBlocks: Number(rb),
  };
}

export function toFlip(raw: any): Flip {
  return {
    player: raw.player ?? raw[0],
    amount: raw.amount ?? raw[1],
    settled: raw.settled ?? raw[2],
    won: raw.won ?? raw[3],
    payout: raw.payout ?? raw[4],
    timestamp: Number(raw.timestamp ?? raw[5]),
    choice: Number(raw.choice ?? raw[7]),
    result: Number(raw.result ?? raw[8]),
    commitBlock: Number(raw.commitBlock ?? raw[9]),
  };
}

export async function recentFlips(addr: string, count = 10): Promise<Flip[]> {
  try {
    const rows = await readGame(addr).getRecentFlips(count);
    return rows.map(toFlip);
  } catch { return []; }
}

export function fmtToken(v: bigint, decimals = 18, maxFrac = 4): string {
  const n = Number(formatUnits(v, decimals));
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}
