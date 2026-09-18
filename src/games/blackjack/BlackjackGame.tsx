import { useEffect, useState, useCallback, useRef } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, Plus, Hand as HandIcon, Square, CopyPlus, XCircle } from "lucide-react";
import { useWallet } from "../../lib/wallet";
import { readProvider } from "../../lib/chain";
import { GAME_ERC20_ABI } from "../../lib/casinoGame";
import { short, fmtAmount } from "../../lib/util";
import { waitRevealReady, sendGameTx } from "../gameCore";
import { logBet } from "../../lib/betfeed";
import { BetPercents } from "../BetPercents";
import { playSound } from "../sound";
import { Hand } from "./PlayingCard";
import blackjackAbiJson from "../abi/BlackjackGameV3.json";

const ABI = blackjackAbiJson as any;
const HAND_STATUS = { NONE: 0, DEAL_COMMITTED: 1, PLAYER_TURN: 2, ACTION_COMMITTED: 3, SETTLED: 4 };

type HandView = {
  status: number; settled: boolean; payout: bigint; betAmount: bigint;
  playerCards: number[]; playerCardCount: number; playerTotal: number;
  dealerCards: number[]; dealerCardCount: number; dealerTotal: number; dealerVisibleTotal: number;
  hasDoubledDown: boolean; pendingAction: number;
};

type Phase = "bet" | "approving" | "dealing" | "revealing" | "player" | "acting" | "settled";

function parseHand(v: any): HandView {
  return {
    status: Number(v.status ?? v[6]),
    pendingAction: Number(v.pendingAction ?? v[7]),
    settled: v.settled ?? v[8],
    payout: v.payout ?? v[9],
    betAmount: v.betAmount ?? v[1],
    playerCardCount: Number(v.playerCardCount ?? v[10]),
    dealerCardCount: Number(v.dealerCardCount ?? v[12]),
    hasDoubledDown: v.hasDoubledDown ?? v[14],
    playerCards: (v.playerCards ?? v[19]).map((x: any) => Number(x)),
    dealerCards: (v.dealerCards ?? v[21]).map((x: any) => Number(x)),
    playerTotal: Number(v.playerTotal ?? v[22]),
    dealerTotal: Number(v.dealerTotal ?? v[24]),
    dealerVisibleTotal: Number(v.dealerVisibleTotal ?? v[25]),
  };
}

import { ControlsTabs } from "../ControlsTabs";

export function BlackjackGame({ address }: { address: string }) {
  const w = useWallet();
  const [meta, setMeta] = useState<{ symbol: string; decimals: number; token: string; pool: bigint; minBet: bigint; revealBlocks: number; maxWinBps: number; maxBetRatioBps: number } | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState(0n);
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("bet");
  const [handId, setHandId] = useState<bigint | null>(null);
  const [hand, setHand] = useState<HandView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  const loadMeta = useCallback(async () => {
    try {
      const game = new Contract(address, ABI, readProvider);
      const [gi, cfg, rb] = await Promise.all([game.getGameInfo(), game.config(), game.revealExtraBlocks().catch(() => 1n)]);
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      setMeta({ symbol, decimals: Number(decimals), token, pool: gi[4], minBet: cfg[3], revealBlocks: Number(rb), maxWinBps: Number(cfg[2]), maxBetRatioBps: Number(cfg[4]) });
      if (w.address) {
        const [b, a] = await Promise.all([erc.balanceOf(w.address), erc.allowance(w.address, address)]);
        setBal(b); setAllowance(a);
      }
    } catch { setErr("Could not load game."); }
  }, [address, w.address]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Resume an in-progress hand after a refresh (F5). React state is lost on reload,
  // so we reconnect to the player's most recent UNSETTLED hand — restoring the
  // cards and the player's turn instead of stranding the live hand.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !w.address || !meta || handId !== null || phase !== "bet") return;
    resumedRef.current = true;
    (async () => {
      try {
        const game = new Contract(address, ABI, readProvider);
        const count: bigint = await game.getUserHandCount(w.address!).catch(() => 0n);
        if (count <= 0n) return;
        const id: bigint = await game.userHands(w.address!, count - 1n);
        const v = parseHand(await game.getHand(id));
        const active = !v.settled && v.status !== HAND_STATUS.SETTLED && v.status !== HAND_STATUS.NONE;
        // Resume ANY unsettled hand — not just a clean player turn. A hand stuck in
        // DEAL_COMMITTED / ACTION_COMMITTED (reveal aged out) would otherwise block
        // a new deal with no escape; surfacing it lets the player forfeit & deal again.
        if (active) {
          setHandId(id); setHand(v); setOutcome(null); setPhase("player");
          if (v.playerCardCount < 2 || v.status !== HAND_STATUS.PLAYER_TURN) {
            setErr("Your last hand is stuck (it sat too long). Forfeit it below to deal a new one.");
          }
        }
      } catch { /* nothing to resume */ }
    })();
  }, [w.address, meta, handId, phase, address]);

  const decimals = meta?.decimals ?? 18;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const needsApprove = amountWei > 0n && allowance < amountWei;
  const maxBet = meta && meta.maxBetRatioBps > 0 ? (meta.pool * BigInt(meta.maxBetRatioBps)) / 10000n : 0n;
  const betLimitErr: string | null = (() => {
    if (!meta) return null;
    if (meta.pool <= 0n) return "Pool is empty — fund the pool first";
    if (amountWei <= 0n) return null;
    if (bal !== null && amountWei > bal) return "Not enough balance";
    if (amountWei < meta.minBet) return `Min bet ${fmt(meta.minBet, decimals, 4)} ${meta.symbol}`;
    if (maxBet > 0n && amountWei > maxBet) return `Max bet ${(meta.maxBetRatioBps / 100).toFixed(0)}% of pool · ${fmt(maxBet, decimals)} ${meta.symbol}`;
    return null;
  })();

  // Poll the active hand while it's live.
  const refreshHand = useCallback(async (id: bigint) => {
    try {
      const game = new Contract(address, ABI, readProvider);
      const v = parseHand(await game.getHand(id));
      setHand(v);
      return v;
    } catch { return null; }
  }, [address]);

  // Generic reveal helper: call reveal fn, wait, refresh.
  async function doReveal(fnName: string, id: bigint) {
    if (!w.signer) return;
    const game = new Contract(address, ABI, w.signer);
    // Explicit gas (estimated on the fast RPC) so the wallet doesn't re-simulate
    // on its lagging node and hang — see sendGameTx.
    await sendGameTx(game, address, ABI, fnName, [id], w.address);
  }

  async function deal() {
    setErr(null); setOutcome(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer || !meta) return;
    if (amountWei <= 0n) { setErr("Enter a bet."); return; }
    if (bal !== null && amountWei > bal) { setErr("Not enough balance."); return; }
    try {
      playSound("chip");
      if (needsApprove) {
        setPhase("approving");
        const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
        await (await erc.approve(address, amountWei)).wait();
        setAllowance(amountWei);
      }
      setPhase("dealing");
      const game = new Contract(address, ABI, w.signer);
      const tx = await game.dealHand(amountWei);
      const rc = await tx.wait();
      let id: bigint | null = null;
      for (const log of rc.logs) {
        try { const p = game.interface.parseLog(log); if (p?.name === "HandCommitted") { id = p.args.handId ?? p.args[0]; break; } } catch {}
      }
      if (id === null) { setErr("Deal committed but handId missing."); setPhase("bet"); return; }
      logBet({ wallet: w.address!, name: w.profile?.name, avatar: w.profile?.avatar, game: "Blackjack", gameKey: "blackjack", address, symbol: meta?.symbol, amount: Number(formatUnits(amountWei, decimals)) });
      setHandId(id);
      setPhase("revealing");
      await waitRevealReady(address, ABI, "revealDeal", id, rc.blockNumber, w.signer);
      await doReveal("revealDeal", id);
      const v = await refreshHand(id);
      finishOrContinue(v);
    } catch (e: any) { setErr(errMsg(e)); setPhase("bet"); }
  }

  function finishOrContinue(v: HandView | null) {
    if (!v) { setPhase("player"); return; }
    if (v.settled || v.status === HAND_STATUS.SETTLED) { settle(v); return; }
    setPhase("player");
  }

  function settle(v: HandView) {
    const won = v.payout > 0n;
    const isBJ = v.playerTotal === 21 && v.playerCardCount === 2;
    playSound(isBJ && won ? "blackjack" : won ? "win" : "lose");
    setOutcome(won ? (isBJ ? `BLACKJACK! +${fmt(v.payout, decimals)} ${meta?.symbol}` : `WON +${fmt(v.payout, decimals)} ${meta?.symbol}`) : "Dealer wins");
    setPhase("settled");
    loadMeta();
  }

  async function action(commitFn: string, revealFn: string) {
    if (!w.signer || handId === null) return;
    setErr(null);
    try {
      playSound("hit");
      setPhase("acting");
      const game = new Contract(address, ABI, w.signer);
      const tx = await game[commitFn](handId);
      const rc = await tx.wait();
      setPhase("revealing");
      await waitRevealReady(address, ABI, revealFn, handId, rc.blockNumber, w.signer);
      await doReveal(revealFn, handId);
      const v = await refreshHand(handId);
      finishOrContinue(v);
    } catch (e: any) { setErr(errMsg(e)); setPhase("player"); }
  }

  function newHand() {
    setHand(null); setHandId(null); setOutcome(null); setPhase("bet");
  }

  // Escape a stuck / stale hand. A resumed hand often can't proceed — the commit
  // block hash aged out of the 256-block window, so the reveal reverts (ethers
  // shows "missing revert data"). The contract can't start a new hand while one
  // is unsettled, so we FORFEIT it on-chain (the fn depends on the hand's status,
  // mirroring Avlo), which settles it and frees the player to deal again.
  const [forfeiting, setForfeiting] = useState(false);
  async function forfeit() {
    if (!w.signer || handId === null) return;
    setErr(null); setForfeiting(true);
    try {
      const hv = hand ?? (await refreshHand(handId));
      const st = hv?.status ?? HAND_STATUS.PLAYER_TURN;
      const fn = st === HAND_STATUS.DEAL_COMMITTED ? "forfeitCommitted"
        : st === HAND_STATUS.ACTION_COMMITTED ? "forfeitAction"
        : "forfeitInactive";
      const game = new Contract(address, ABI, w.signer);
      await sendGameTx(game, address, ABI, fn, [handId], w.address);
      playSound("lose");
      newHand();
      loadMeta();
    } catch (e: any) {
      // forfeitInactive needs the timeout window to pass — say so instead of stranding.
      const m = (e?.shortMessage || e?.reason || e?.message || "").toLowerCase();
      setErr(/inactive|too early|not.*expired|wait/.test(m)
        ? "Can't forfeit yet — the inactivity window hasn't passed. Try again shortly."
        : errMsg(e));
    } finally { setForfeiting(false); }
  }

  const busy = ["approving", "dealing", "revealing", "acting"].includes(phase);
  const playerCards = hand?.playerCards ?? [];
  const dealerCards = hand?.dealerCards ?? [];
  const dealerFaceDown = phase === "player" || phase === "acting" || (phase === "revealing" && hand && !hand.settled);
  const canDouble = phase === "player" && hand?.playerCardCount === 2 && !hand?.hasDoubledDown;

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      {/* felt table */}
      <div className="panel p-5 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, #14532d 0%, #0f3d22 45%, #0a2417 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 8px)" }} />
        {/* Table arc + rules (classic blackjack layout) */}
        <svg className="absolute inset-x-0 top-1/2 -translate-y-[10%] mx-auto pointer-events-none opacity-90" width="100%" height="150" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 460 }}>
          <defs>
            <path id="bjArcTop" d="M 40 130 A 160 160 0 0 1 360 130" fill="none" />
            <path id="bjArcBot" d="M 70 138 A 135 135 0 0 1 330 138" fill="none" />
          </defs>
          <path d="M 40 130 A 160 160 0 0 1 360 130" fill="none" stroke="rgba(212,184,90,0.5)" strokeWidth="2" />
          <path d="M 55 134 A 148 148 0 0 1 345 134" fill="none" stroke="rgba(212,184,90,0.2)" strokeWidth="1" />
          <text fill="rgba(240,225,170,0.75)" style={{ fontFamily: "Georgia, serif", letterSpacing: "2px" }} fontSize="13" fontWeight={700}>
            <textPath href="#bjArcTop" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath>
          </text>
          <text fill="rgba(212,184,90,0.5)" style={{ fontFamily: "Georgia, serif", letterSpacing: "1.5px" }} fontSize="9">
            <textPath href="#bjArcBot" startOffset="50%" textAnchor="middle">DEALER MUST STAND ON 17 · INSURANCE PAYS 2 TO 1</textPath>
          </text>
        </svg>
        <div className="relative">
          {/* dealer */}
          <div className="mb-6">
            <Hand cards={dealerCards} count={hand?.dealerCardCount ?? 0}
              faceDownIndex={dealerFaceDown ? 1 : undefined}
              total={dealerFaceDown ? (hand?.dealerVisibleTotal ?? 0) : (hand?.dealerTotal ?? 0)}
              label="Dealer" />
          </div>

          {/* outcome banner */}
          {outcome && (
            <div className={`text-center py-2 mb-4 rounded-xl font-mono font-bold ${outcome.includes("WON") || outcome.includes("BLACKJACK") ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/40" : "bg-blood-900/30 text-blood-300 border border-blood-500/40"}`}>
              {outcome}
            </div>
          )}

          {/* player */}
          <div>
            <Hand cards={playerCards} count={hand?.playerCardCount ?? 0}
              total={hand?.playerTotal ?? 0} label="You" />
          </div>
        </div>

        {/* status line */}
        {busy && (
          <div className="relative mt-4 flex items-center gap-2 font-mono text-xs text-bone-300">
            <Loader2 size={14} className="animate-spin" />
            {phase === "approving" ? "approving token…" : phase === "dealing" ? "dealing…" : phase === "acting" ? "committing action…" : "revealing (waiting for block)…"}
          </div>
        )}
      </div>

      {/* controls */}
      <ControlsTabs>
        {phase === "bet" || phase === "settled" ? (
          <div className="panel p-4">
            <div className="flex justify-between text-xs text-bone-500 mb-1">
              <span>Bet</span>
              <span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal" placeholder="0.0" className="flex-1 min-w-0 w-full bg-transparent outline-none text-xl font-mono tabular-nums" />
              <button onClick={() => bal && setAmount(formatUnits(bal, decimals))}
                className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
            </div>
            <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setAmount} disabled={busy} />
            {(betLimitErr || err) &&<div className="text-blood-200 text-xs mt-2">{betLimitErr || err}</div>}
            <button onClick={deal} disabled={busy || !!betLimitErr} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              <Plus size={15} /> {phase === "settled" ? "Deal again" : needsApprove ? "Approve & deal" : "Deal"}
            </button>
            {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
          </div>
        ) : (
          <div className="panel p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2">Your move</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => action("hit", "revealHit")} disabled={phase !== "player" || forfeiting}
                className="btn-primary py-3 inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
                <HandIcon size={15} /> Hit
              </button>
              <button onClick={() => action("stand", "revealStand")} disabled={phase !== "player" || forfeiting}
                className="btn-ghost py-3 inline-flex items-center justify-center gap-1.5 disabled:opacity-40 border border-ink-600">
                <Square size={14} /> Stand
              </button>
              {canDouble && (
                <button onClick={() => action("doubleDown", "revealDouble")} disabled={phase !== "player" || forfeiting}
                  className="col-span-2 btn-ghost py-2.5 inline-flex items-center justify-center gap-1.5 disabled:opacity-40 border border-amber-500/40 text-amber-300">
                  <CopyPlus size={14} /> Double down
                </button>
              )}
            </div>
            {err && <div className="text-blood-200 text-xs mt-2">{err}</div>}
            {/* Escape hatch — a resumed/stale hand whose reveal reverts ("missing
                revert data") can always be forfeited on-chain to free up a new deal. */}
            {handId !== null && (
              <div className="mt-3 border-t border-ink-700/60 pt-3">
                <button onClick={forfeit} disabled={forfeiting || busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900 py-2 text-xs font-medium text-bone-400 hover:border-blood-500 hover:text-blood-300 transition disabled:opacity-40">
                  {forfeiting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                  {forfeiting ? "Forfeiting…" : "Stuck? Forfeit & new hand"}
                </button>
                <div className="mt-1 text-center font-mono text-[9px] text-bone-600">if a resumed hand won't respond, forfeit it to deal again</div>
              </div>
            )}
          </div>
        )}

        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          each move is 2 on-chain txs (commit + reveal after {meta?.revealBlocks ?? 1} block). blackjack pays 3:2, dealer stands on 17. randomness from future block hash.
        </div>
      </ControlsTabs>
    </div>
  );
}

function fmt(v: bigint, d = 18, _mx = 2) { return fmtAmount(Number(formatUnits(v, d))); }
function errMsg(e: any) { return e?.shortMessage || e?.reason || e?.message || "Transaction failed."; }
