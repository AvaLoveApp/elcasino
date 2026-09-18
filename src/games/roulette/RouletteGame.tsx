import { useCallback, useEffect, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw, Trash2 } from "lucide-react";
import { useWallet } from "../../lib/wallet";
import { readProvider } from "../../lib/chain";
import { GAME_ERC20_ABI } from "../../lib/casinoGame";
import { logBet } from "../../lib/betfeed";
import { waitRevealReady, sendGameTx } from "../gameCore";
import { BetPercents } from "../BetPercents";
import rouletteAbiJson from "../abi/RouletteGameV3.json";
import { BET_TYPES, BET_TYPE_LABELS, getNumberColor } from "./rouletteConstants";
import { BettingTable } from "./BettingTable";
import { RouletteWheel } from "./RouletteWheel";
import GameResultCard from "./GameResultCard";

const ABI = (rouletteAbiJson as any).abi ?? (rouletteAbiJson as any);

// Contract _calculatePayout gross multipliers.
function multiplier(betType: number) {
  if (betType === 0) return 36;
  if (betType >= 1 && betType <= 6) return 2;
  return 3;
}

type SelBet = { type: number; number: number; amount: string };
type Phase = "bet" | "approving" | "spinning" | "revealing" | "settled";
type Meta = { symbol: string; decimals: number; token: string; logo: string; pool: bigint; minBet: bigint; revealBlocks: number; rtpBps: number; maxWinBps: number; maxBetRatioBps: number };

import { ControlsTabs } from "../ControlsTabs";

export function RouletteGame({ address }: { address: string }) {
  const w = useWallet();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState(0n);
  const [chip, setChip] = useState("1");
  const [bets, setBets] = useState<Map<string, SelBet>>(new Map());
  const [phase, setPhase] = useState<Phase>("bet");
  const [err, setErr] = useState<string | null>(null);

  const [wheelResult, setWheelResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<{ won: boolean; payout: bigint; number: number } | null>(null);
  const [showCard, setShowCard] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const g = new Contract(address, ABI, readProvider);
      const [gi, cfg, rb] = await Promise.all([g.getGameInfo(), g.config(), g.revealExtraBlocks().catch(() => 1n)]);
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      setMeta({ symbol, decimals: Number(decimals), token, logo: gi[2], pool: gi[4], minBet: cfg[3], revealBlocks: Number(rb), rtpBps: Number(cfg[0]), maxWinBps: Number(cfg[2]), maxBetRatioBps: Number(cfg[4]) });
      if (w.address) {
        const [b, a] = await Promise.all([erc.balanceOf(w.address), erc.allowance(w.address, address)]);
        setBal(b); setAllowance(a);
      }
    } catch { setErr("Could not load game."); }
  }, [address, w.address]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const decimals = meta?.decimals ?? 18;
  const chipNum = Number(chip) || 0;
  const chipWei = (() => { try { return chip ? parseUnits(chip, decimals) : 0n; } catch { return 0n; } })();
  const totalWei = Array.from(bets.values()).reduce((a, b) => { try { return a + parseUnits(b.amount || "0", decimals); } catch { return a; } }, 0n);
  const needsApprove = totalWei > 0n && allowance < totalWei;
  const potential = Array.from(bets.values()).reduce((a, b) => {
    try { return a + (parseUnits(b.amount || "0", decimals) * BigInt(multiplier(b.type)) * BigInt(meta?.rtpBps ?? 9700)) / 10000n; } catch { return a; }
  }, 0n);
  const busy = ["approving", "spinning", "revealing"].includes(phase);

  // Bet limits — mirror the contract so a bet never reverts on-chain.
  const grossPotential = Array.from(bets.values()).reduce((a, b) => {
    try { return a + parseUnits(b.amount || "0", decimals) * BigInt(multiplier(b.type)); } catch { return a; }
  }, 0n);
  const maxBet = meta && meta.maxBetRatioBps > 0 ? (meta.pool * BigInt(meta.maxBetRatioBps)) / 10000n : 0n;
  const maxWin = meta && meta.maxWinBps > 0 ? (meta.pool * BigInt(meta.maxWinBps)) / 10000n : 0n;
  const betLimitErr: string | null = (() => {
    if (!meta || bets.size === 0) return null;
    if (meta.pool <= 0n) return "Pool is empty — fund the pool first";
    if (bal !== null && totalWei > bal) return "Not enough balance";
    if (totalWei < meta.minBet) return `Min bet ${fmt(meta.minBet, decimals, 4)} ${meta.symbol}`;
    if (maxBet > 0n && totalWei > maxBet) return `Max bet ${(meta.maxBetRatioBps / 100).toFixed(0)}% of pool · ${fmt(maxBet, decimals)} ${meta.symbol}`;
    if (maxWin > 0n && grossPotential - totalWei > maxWin) return `Max win ${(meta.maxWinBps / 100).toFixed(0)}% of pool`;
    return null;
  })();

  // BettingTable click handler — stack chips of the current size.
  const onBet = useCallback((betType: number, number: number) => {
    if (busy || chipNum <= 0) { if (chipNum <= 0) setErr("Set a chip amount first."); return; }
    setErr(null);
    setBets((prev) => {
      const next = new Map(prev);
      const key = `${betType}-${number}`;
      const cur = next.get(key);
      const amount = cur ? String((Number(cur.amount) || 0) + chipNum) : String(chipNum);
      next.set(key, { type: betType, number, amount });
      return next;
    });
  }, [busy, chipNum]);

  function clearBets() { setBets(new Map()); }

  async function spin() {
    setErr(null); setOutcome(null); setShowCard(false); setWheelResult(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer || !meta) return;
    if (bets.size === 0) { setErr("Place at least one bet."); return; }
    if (bal !== null && totalWei > bal) { setErr("Not enough balance."); return; }
    const arr = Array.from(bets.values());
    try {
      if (needsApprove) {
        setPhase("approving");
        const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
        await (await erc.approve(address, totalWei)).wait();
        setAllowance(totalWei);
      }
      setPhase("spinning");
      setSpinning(true); // wheel starts idle-spinning
      const g = new Contract(address, ABI, w.signer);
      const types = arr.map((b) => b.type);
      const numbers = arr.map((b) => b.number);
      const amounts = arr.map((b) => parseUnits(b.amount || "0", decimals));
      const tx = await g.commitMultiBet(types, numbers, amounts);
      const rc = await tx.wait();
      // commitMultiBet emits BetCommitted PER bet AND one MultiBetCommitted with
      // the full list. Prefer the multi list — collecting both would duplicate
      // ids, and revealMultiBet([id,id]) reverts "Already settled" (never clears).
      let multiIds: bigint[] | null = null;
      const singleIds: bigint[] = [];
      for (const log of rc.logs) {
        try {
          const p = g.interface.parseLog(log);
          if (p?.name === "MultiBetCommitted") multiIds = (p.args.betIds ?? p.args[1]).map((x: any) => BigInt(x));
          else if (p?.name === "BetCommitted") singleIds.push(BigInt(p.args.betId ?? p.args[0]));
        } catch {}
      }
      const ids: bigint[] = multiIds ?? singleIds;
      logBet({ wallet: w.address!, name: w.profile?.name, avatar: w.profile?.avatar, game: "Roulette", gameKey: "roulette", address, symbol: meta?.symbol, amount: Number(formatUnits(totalWei, decimals)) });
      setPhase("revealing");
      if (ids.length >= 1) {
        const revealFn = ids.length > 1 ? "revealMultiBet" : "revealBet";
        const revealArg: any = ids.length > 1 ? ids : ids[0];
        await waitRevealReady(address, ABI, revealFn, revealArg, rc.blockNumber, w.signer);
        await sendGameTx(g, address, ABI, revealFn, [revealArg], w.address);
      }
      const gr = new Contract(address, ABI, readProvider);
      let payout = 0n; let resultNum = 0;
      for (const id of ids) {
        try { const b = await gr.bets(id); resultNum = Number(b.result ?? b[9]); payout += BigInt(b.payout ?? b[6]); } catch {}
      }
      setOutcome({ won: payout > 0n, payout, number: resultNum });
      setPhase("settled");
      setWheelResult(resultNum); // triggers the wheel to spin to the pocket
      loadMeta();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Transaction failed.");
      setPhase("bet"); setSpinning(false);
    }
  }

  // Wheel finished landing → reveal the result card.
  const onSpinComplete = useCallback(() => {
    setSpinning(false);
    if (outcome) setShowCard(true);
  }, [outcome]);

  function reset() { setBets(new Map()); setOutcome(null); setShowCard(false); setWheelResult(null); setPhase("bet"); }

  const betAmountForMult = arrMinBet(bets, decimals);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* ── Wheel + Board ── */}
      <div className="min-w-0 space-y-3">
        <div className="panel p-4 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 30%, #0a0a0a 0%, #050505 60%, #000 100%)" }}>
          {/* Result card overlay */}
          <GameResultCard
            show={showCard && !!outcome}
            won={!!outcome?.won}
            amount={outcome?.won ? fmt(outcome.payout, decimals) : undefined}
            tokenLogoUrl={meta?.logo || undefined}
            tokenSymbol={meta?.symbol || "TOKEN"}
            subtitle={outcome ? `Number ${outcome.number} · ${getNumberColor(outcome.number).toUpperCase()}` : ""}
            multiplier={outcome?.won && betAmountForMult > 0 ? Number(formatUnits(outcome.payout, decimals)) / betAmountForMult : 0}
            theme="emerald"
            icon={outcome ? (
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-lg font-bold font-mono border-2 ${
                getNumberColor(outcome.number) === "red" ? "bg-red-600 border-red-400/50" :
                getNumberColor(outcome.number) === "green" ? "bg-green-600 border-green-400/50" : "bg-gray-800 border-gray-600/50"}`}>
                {outcome.number}
              </div>
            ) : undefined}
          />
          <div className="rw-wrap">
            <div className="rw-inner">
              <RouletteWheel result={wheelResult} spinning={spinning} onSpinComplete={onSpinComplete} />
            </div>
          </div>
        </div>

        <BettingTable onBet={onBet} selectedBets={bets} disabled={busy} tokenLogo={meta?.logo} />
      </div>

      {/* ── Controls ── */}
      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Chip size</span>
            <span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
            <input value={chip} onChange={(e) => setChip(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal" placeholder="0.0" className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
            <span className="text-[11px] font-mono text-bone-500">{meta?.symbol}</span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {["1", "5", "25", "100"].map((v) => (
              <button key={v} onClick={() => setChip(v)}
                className={`flex-1 text-[11px] font-mono rounded-lg py-1.5 border ${chip === v ? "border-accent-green text-accent-green bg-accent-green/10" : "border-ink-600 text-bone-400 hover:border-accent-green/50"}`}>{v}</button>
            ))}
          </div>
          <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setChip} disabled={busy} />
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-bone-500">Bet slip · {bets.size}</span>
            {bets.size > 0 && <button onClick={clearBets} disabled={busy} className="text-bone-500 hover:text-blood-400"><Trash2 size={13} /></button>}
          </div>
          {bets.size === 0 ? (
            <div className="text-bone-600 text-xs font-mono py-3 text-center">tap the table to place chips</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {Array.from(bets.entries()).map(([k, b]) => (
                <div key={k} className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-bone-300">{BET_TYPE_LABELS[b.type]}{b.type === 0 ? ` #${b.number}` : ""}
                    <span className="text-bone-600"> · {coveragePct(b.type)}%</span></span>
                  <span className="text-bone-400">{b.amount} {meta?.symbol}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-ink-700 mt-2 pt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between"><span className="text-bone-500">Total bet</span><span className="text-bone-100">{fmt(totalWei, decimals)} {meta?.symbol}</span></div>
            <div className="flex justify-between"><span className="text-bone-500">Max win</span><span className="text-accent-green">{fmt(potential, decimals)} {meta?.symbol}</span></div>
          </div>
          {(betLimitErr || err) && <div className="text-blood-200 text-xs mt-2">{betLimitErr || err}</div>}
          {phase === "settled" ? (
            <button onClick={reset} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2"><RotateCw size={15} /> New round</button>
          ) : (
            <button onClick={spin} disabled={busy || bets.size === 0 || !!betLimitErr}
              className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {phase === "approving" ? "approving…" : phase === "spinning" ? "placing bets…" : phase === "revealing" ? "revealing…" : needsApprove ? "Approve & spin" : "Spin"}
            </button>
          )}
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>

        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          each spin is commit + reveal ({meta?.revealBlocks ?? 1} block). Straight 35:1, dozens/columns 2:1, red/black/even/odd/low/high 1:1. randomness from a future block hash.
        </div>
      </ControlsTabs>
    </div>
  );
}

// Smallest single bet in token units — used to derive the win multiplier for the card.
function arrMinBet(bets: Map<string, SelBet>, _d: number): number {
  let min = Infinity;
  bets.forEach((b) => { const a = Number(b.amount) || 0; if (a > 0 && a < min) min = a; });
  // Card multiplier compares payout to total staked, so return total here.
  let total = 0; bets.forEach((b) => { total += Number(b.amount) || 0; });
  return total || (min === Infinity ? 0 : min);
}

// Share of the 37 pockets each bet type covers (win chance).
function coveragePct(type: number): string {
  const pockets = type === 0 ? 1 : type >= 1 && type <= 6 ? 18 : 12;
  return ((pockets / 37) * 100).toFixed(1);
}

function fmt(v: bigint, d = 18, mx = 2) { return Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: mx }); }
