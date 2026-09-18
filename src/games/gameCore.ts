import { useCallback, useEffect, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useWallet } from "../lib/wallet";
import { readProvider } from "../lib/chain";
import { GAME_ERC20_ABI } from "../lib/casinoGame";
import { logBet } from "../lib/betfeed";

/**
 * Shared commit-reveal engine for every V3 game (Dice, Crash, Wheel, Slot,
 * Plinko, Mines …). They all follow the same on-chain shape: commit locks the
 * bet + choice and emits a *Committed event carrying an id; after
 * revealExtraBlocks blocks a reveal settles using a future block hash and emits
 * a *Settled event with the outcome. This hook drives meta/approve/commit/reveal
 * so each game only supplies its choice inputs and result rendering.
 */
export type GameMeta = {
  symbol: string; decimals: number; token: string;
  pool: bigint; minBet: bigint; revealBlocks: number; rtpBps: number;
  cfg: bigint[]; // full config() tuple for game-specific fields
};

export type PlayArgs = {
  amountWei: bigint;
  commitFn: string; commitArgs: any[]; committedEvent: string;
  revealFn: string; settledEvent: string;
  gameLabel?: string; gameKey?: string; // optional, for the live bet feed
};

export function fmt(v: bigint, d = 18, mx = 2) {
  return Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: mx });
}
export function errMsg(e: any) { return e?.shortMessage || e?.reason || e?.message || "Transaction failed."; }

/**
 * Send a reveal (or any game write) with an EXPLICIT gas limit estimated on the
 * fast app RPC — the single most important thing for a reveal that doesn't hang.
 *
 * Without a gas limit, ethers/the wallet run their own eth_estimateGas on the
 * WALLET's RPC node, which lags a block behind the sequencer on Robinhood, so it
 * reverts ("Wait one block" / "Snapshot block hash first") and the tx never
 * fires — the classic "stuck at revealing…". Passing gas makes the wallet skip
 * that pre-sign simulation entirely; the tx is signed and sent immediately and
 * succeeds once mined a block later. Mirrors Avlo's recoverReveal `send()`.
 *
 * `signer` is the wallet-connected Contract; we build a read-only twin on the
 * fast RPC for the estimate. Receipt status is checked — a reverted tx does NOT
 * throw on its own.
 */
export async function sendGameTx(
  signerContract: Contract, address: string, abi: any, fn: string, args: any[], from?: string | null,
): Promise<any> {
  let gas = 1_500_000n;
  try {
    const read = new Contract(address, abi, readProvider);
    const est: bigint = await read[fn].estimateGas(...args, from ? { from } : {});
    gas = (est * 3n) / 2n;
  } catch { /* keep fallback */ }
  // Pass an explicit LEGACY gasPrice from the fast RPC too. Without it, the wallet
  // (esp. the Privy embedded wallet) runs its own getFeeData on Robinhood, whose
  // EIP-1559 fee responses ethers can't parse → "could not coalesce error" and the
  // tx never fires. Forcing gasPrice (type-0) makes the wallet skip all fee calls.
  const fee = await legacyFee();
  const tx = await signerContract[fn](...args, { gasLimit: gas, ...fee });
  const rc = await tx.wait();
  if (rc?.status === 0) throw new Error("Transaction reverted on-chain.");
  return rc;
}

// Cached legacy gas price from the fast RPC (2s), shared by every game write.
let _feeAt = 0; let _fee: { gasPrice: bigint } | {} = {};
export async function legacyFee(): Promise<{ gasPrice: bigint } | {}> {
  if (Date.now() - _feeAt < 2000) return _fee;
  try {
    const fd = await readProvider.getFeeData();
    // Prefer gasPrice; bump 15% so a slightly stale price still lands.
    const gp = fd.gasPrice ?? (fd.maxFeePerGas ?? null);
    _fee = gp ? { gasPrice: (gp * 115n) / 100n } : {};
  } catch { _fee = {}; }
  _feeAt = Date.now();
  return _fee;
}

/**
 * Wait until a reveal is actually ready by simulating it (staticCall) until it
 * stops reverting, then return so the caller can send the real tx. This is the
 * robust cross-chain gate Avlo uses — a fixed block wait misfires on Robinhood
 * where block.number is L1-based. If the commit block hash has aged out of range
 * and the contract exposes snapshotBlockHash, we snapshot it once and keep going.
 */
export async function waitRevealReady(
  address: string, abi: any, fnName: string, arg: any,
  commitBlock?: number, signer?: any, timeoutMs = 90000,
): Promise<void> {
  // Simulate on the app's fast RPC (like Avlo's publicClient.simulateContract) —
  // NOT the wallet's RPC, which lags and would never clear, so the reveal tx
  // would never fire. Once this simulates cleanly the caller sends via the wallet.
  const read = new Contract(address, abi, readProvider);
  // Simulate as the actual player (like Avlo's `account: address`) so a reveal
  // that checks msg.sender doesn't revert from the zero address forever.
  let from: string | undefined;
  try { from = signer ? await signer.getAddress() : undefined; } catch {}
  const start = Date.now();
  let snapped = false;
  while (Date.now() - start < timeoutMs) {
    try {
      await read[fnName].staticCall(arg, from ? { from } : {});
      return; // ready to send
    } catch (e: any) {
      const msg = (e?.shortMessage || e?.reason || e?.message || "").toLowerCase();
      // Block hash aged out of the 256-block window → snapshot it once (needs a signer).
      if (!snapped && commitBlock != null && signer && /snapshot|block ?hash/.test(msg)) {
        snapped = true;
        try { await (await new Contract(address, abi, signer).snapshotBlockHash(BigInt(commitBlock))).wait(); } catch {}
      }
      await new Promise((r) => setTimeout(r, 1800));
    }
  }
}

export function useCommitRevealGame(address: string, abi: any) {
  const w = useWallet();
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState(0n);
  const [phase, setPhase] = useState<"idle" | "approving" | "committing" | "revealing">("idle");
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const g = new Contract(address, abi, readProvider);
      const [gi, cfg, rb] = await Promise.all([g.getGameInfo(), g.config(), g.revealExtraBlocks().catch(() => 1n)]);
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      setMeta({
        symbol, decimals: Number(decimals), token, pool: gi[4], minBet: cfg[3],
        revealBlocks: Number(rb), rtpBps: Number(cfg[0]), cfg: (cfg as any[]).map((x) => BigInt(x)),
      });
      if (w.address) {
        const [b, a] = await Promise.all([erc.balanceOf(w.address), erc.allowance(w.address, address)]);
        setBal(b); setAllowance(a);
      } else { setBal(null); }
    } catch { setErr("Could not load game."); }
  }, [address, abi, w.address]);

  useEffect(() => { reload(); }, [reload]);

  /** Runs the full flow. Returns the *Settled event args, or throws. */
  async function play(p: PlayArgs): Promise<any> {
    setErr(null);
    if (!w.address) { w.connect(); throw new Error("connect"); }
    if (!w.chainOk) { await w.switchChain(); throw new Error("chain"); }
    if (!w.signer || !meta) throw new Error("not ready");
    if (p.amountWei <= 0n) { setErr("Enter a bet."); throw new Error("amount"); }
    if (bal !== null && p.amountWei > bal) { setErr("Not enough balance."); throw new Error("balance"); }

    if (allowance < p.amountWei) {
      setPhase("approving");
      const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
      // Route through sendGameTx so approve also gets explicit gas + legacy fee
      // (prevents the "could not coalesce error" on the embedded wallet).
      await sendGameTx(erc, meta.token, GAME_ERC20_ABI, "approve", [address, p.amountWei], w.address);
      setAllowance(p.amountWei);
    }
    setPhase("committing");
    const g = new Contract(address, abi, w.signer);
    const rc = await sendGameTx(g, address, abi, p.commitFn, p.commitArgs, w.address);
    let id: bigint | null = null;
    for (const log of rc.logs) {
      try {
        const parsed = g.interface.parseLog(log);
        if (parsed?.name === p.committedEvent) { id = BigInt(parsed.args[0]); break; }
      } catch {}
    }
    if (id === null) { setPhase("idle"); throw new Error("commit id missing"); }

    // Log to the live bet feed (fire-and-forget) — powers the avalove-style home ticker.
    try {
      logBet({
        wallet: w.address, name: w.profile?.name || undefined, avatar: w.profile?.avatar || undefined,
        game: p.gameLabel || "", gameKey: p.gameKey || "", address,
        symbol: meta.symbol, amount: Number(formatUnits(p.amountWei, decimals)),
      });
    } catch {}

    setPhase("revealing");
    // Robinhood's block.number is L1-based, so a fixed block wait is unreliable.
    // Instead simulate the reveal until it stops reverting ("wait one block"),
    // then fire it — mirrors Avlo's reveal gate. Snapshot the commit block hash
    // first if the contract exposes it (needed once the block ages out of range).
    await waitRevealReady(address, abi, p.revealFn, id, rc.blockNumber, w.signer);
    const rrc = await sendGameTx(g, address, abi, p.revealFn, [id], w.address);
    let settled: any = null;
    for (const log of rrc.logs) {
      try {
        const parsed = g.interface.parseLog(log);
        if (parsed?.name === p.settledEvent) { settled = parsed.args; break; }
      } catch {}
    }
    setPhase("idle");
    reload();
    return settled;
  }

  const decimals = meta?.decimals ?? 18;

  // ── Bet limits (mirror the contract's on-chain checks so bets never revert) ──
  // config tuple: [rtpBps, feeBps, maxWinBps, minBet, maxBetPoolRatioBps, ...]
  const poolRatioBps = meta ? Number(meta.cfg[4] ?? 0n) : 0;
  const maxWinBps = meta ? Number(meta.cfg[2] ?? 0n) : 0;
  const maxBet = meta && poolRatioBps > 0 ? (meta.pool * BigInt(poolRatioBps)) / 10000n : 0n;
  const maxWin = meta && maxWinBps > 0 ? (meta.pool * BigInt(maxWinBps)) / 10000n : 0n;

  /** Returns a human reason the bet is invalid, or null if OK. `potentialPayout`
   *  is the gross payout on a win (stake × multiplier) — used for the max-win cap. */
  function betError(amountWei: bigint, potentialPayout?: bigint): string | null {
    if (!meta) return null;
    // Empty pool → nothing to bet against (this is why a bet on a dry room reverts).
    if (meta.pool <= 0n) return "Pool is empty — fund the pool first";
    if (amountWei <= 0n) return null;
    if (bal !== null && amountWei > bal) return "Not enough balance";
    if (amountWei < meta.minBet) return `Min bet ${fmt(meta.minBet, decimals, 4)} ${meta.symbol}`;
    if (maxBet > 0n && amountWei > maxBet) return `Max bet ${(poolRatioBps / 100).toFixed(0)}% of pool · ${fmt(maxBet, decimals)} ${meta.symbol}`;
    if (potentialPayout != null && maxWin > 0n && potentialPayout - amountWei > maxWin) return `Max win ${(maxWinBps / 100).toFixed(0)}% of pool`;
    return null;
  }

  return { w, meta, bal, allowance, phase, setPhase, err, setErr, reload, play, decimals, maxBet, maxWin, poolRatioBps, maxWinBps, betError };
}
