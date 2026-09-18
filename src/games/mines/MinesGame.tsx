import { useState } from "react";
import { RangeInput } from "../../components/RangeInput";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw } from "lucide-react";
import { readProvider } from "../../lib/chain";
import { useCommitRevealGame, fmt, errMsg } from "../gameCore";
import { BetPercents } from "../BetPercents";
import minesAbi from "../abi/MinesGameV3.json";

const ABI = (minesAbi as any).abi ?? (minesAbi as any);

function gridSizeFor(mineCount: number) { return mineCount <= 3 ? 9 : mineCount <= 8 ? 16 : 25; }
function gridColsFor(size: number) { return size === 9 ? 3 : size === 16 ? 4 : 5; }

// ── Ported SVG icons (mine / gem / pick) ──
const MineSVG = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    {[["16","2","16","8"],["16","24","16","30"],["2","16","8","16"],["24","16","30","16"]].map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />)}
    {[["6.1","6.1","10.2","10.2"],["21.8","21.8","25.9","25.9"],["25.9","6.1","21.8","10.2"],["10.2","21.8","6.1","25.9"]].map((l, i) => <line key={"d"+i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />)}
    <circle cx="16" cy="16" r="8" fill="#991b1b" stroke="#ef4444" strokeWidth="1.5" />
    <circle cx="13" cy="13" r="2.5" fill="#fca5a5" opacity="0.6" />
  </svg>
);
const GemSVG = ({ size = 28, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <polygon points="16,2 28,12 16,30 4,12" fill="url(#gemGrad)" stroke="#34d399" strokeWidth="1.2" />
    <polygon points="16,2 28,12 16,14 4,12" fill="url(#gemTopGrad)" opacity="0.7" />
    <line x1="4" y1="12" x2="28" y2="12" stroke="#34d399" strokeWidth="0.8" opacity="0.5" />
    <defs>
      <linearGradient id="gemGrad" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#6ee7b7" /><stop offset="100%" stopColor="#059669" /></linearGradient>
      <linearGradient id="gemTopGrad" x1="16" y1="2" x2="16" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#a7f3d0" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
    </defs>
  </svg>
);
const PickSVG = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M7 3v18" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 3l10 5-10 5" fill="#f97316" opacity="0.85" />
  </svg>
);

type TileState = "default" | "selected" | "mine" | "mine-unselected" | "safe-win" | "safe-lose" | "empty-revealed";

import { ControlsTabs } from "../ControlsTabs";

export function MinesGame({ address }: { address: string }) {
  const g = useCommitRevealGame(address, ABI);
  const { meta, bal, phase, err, setErr, play, decimals, betError, maxBet, w } = g;
  const [amount, setAmount] = useState("");
  const [mineCount, setMineCount] = useState(3);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [res, setRes] = useState<{ won: boolean; mult: number; payout: bigint } | null>(null);
  const [mineTiles, setMineTiles] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState(false);

  const size = gridSizeFor(mineCount);
  const cols = gridColsFor(size);
  const maxPicks = size - mineCount;
  const busy = phase !== "idle";
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();

  // Client-side multiplier estimate for N safe picks (mirrors contract, ×0.96 RTP).
  function calcMult(n: number): number {
    if (n <= 0) return 1;
    let num = 1, den = 1;
    for (let i = 0; i < n; i++) { num *= (size - i); den *= (size - mineCount - i); }
    return (num / den) * 0.96;
  }

  function toggle(i: number) {
    if (busy || revealed) return;
    setRes(null);
    setPicks((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : (n.size < maxPicks && n.add(i)); return n; });
  }
  function setMines(n: number) { setMineCount(n); setPicks(new Set()); setRes(null); setRevealed(false); setMineTiles(new Set()); }

  async function playGame() {
    setRes(null); setRevealed(false); setMineTiles(new Set());
    if (picks.size < 1) { setErr("Pick at least one tile."); return; }
    let bitmask = 0;
    picks.forEach((i) => { bitmask |= (1 << i); });
    try {
      const s = await play({
        amountWei, gameLabel: "Mines", gameKey: "mines", commitFn: "commitGame", commitArgs: [amountWei, mineCount, bitmask >>> 0],
        committedEvent: "GameCommitted", revealFn: "revealGame", settledEvent: "GameSettled",
      });
      if (s) {
        setRes({ won: s[2], mult: Number(s[3]) / 100, payout: BigInt(s[4]) });
        // Read the resolved game to reveal the actual mine positions.
        try {
          const gr = new Contract(address, ABI, readProvider);
          const count = Number(await gr.getUserGameCount(w.address));
          const rows = await gr.getUserGames(w.address, Math.max(0, count - 1), 1);
          const mt = Number(rows[0].mineTiles ?? rows[0][9]);
          const set = new Set<number>();
          for (let i = 0; i < size; i++) if (mt & (1 << i)) set.add(i);
          setMineTiles(set);
        } catch {}
        setRevealed(true);
      }
    } catch (e: any) { if (!["connect", "chain", "amount", "balance"].includes(e?.message)) setErr(errMsg(e)); }
  }

  function reset() { setRes(null); setRevealed(false); setMineTiles(new Set()); setPicks(new Set()); }

  function tileState(i: number): TileState {
    if (!revealed) return picks.has(i) ? "selected" : "default";
    if (mineTiles.has(i)) return picks.has(i) ? "mine" : "mine-unselected";
    if (picks.has(i)) return res?.won ? "safe-win" : "safe-lose";
    return "empty-revealed";
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* Board */}
      <div className="panel p-4 sm:p-5 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 15%, #201319 0%, #150c11 55%, #0d0709 100%)" }}>
        <div className={`grid gap-2.5 mx-auto ${revealed && !res?.won ? "mines-shake" : ""}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, maxWidth: 340 }}>
          {Array.from({ length: size }).map((_, i) => {
            const state = tileState(i);
            const isRevealed = state !== "default" && state !== "selected";
            const baseStagger = (i % cols) * 0.06 + Math.floor(i / cols) * 0.06;
            const flipDelay = isRevealed ? (state === "mine" ? "0s" : (res && !res.won ? `${0.6 + baseStagger}s` : `${baseStagger}s`)) : "0s";
            const revealAt = isRevealed ? `${parseFloat(flipDelay) + 0.6}s` : "0s";
            const multLabel = !isRevealed ? (picks.has(i) ? calcMult(picks.size) : calcMult(picks.size + 1)) : null;
            return (
              <div key={i} className="flex flex-col items-center">
                <button onClick={() => toggle(i)} disabled={busy || revealed} className="mines-tile aspect-square rounded-xl relative w-full" style={{ perspective: "800px" }}>
                  <div className={`mines-card w-full h-full rounded-xl ${isRevealed ? "mines-card-flipped" : ""}`}
                    style={{ transformStyle: "preserve-3d", position: "relative", ["--flip-delay" as any]: flipDelay, ["--reveal-at" as any]: revealAt }}>
                    {/* FRONT */}
                    <div className={`mines-card-face rounded-xl ${picks.has(i) ? "mines-face-selected" : "mines-face-default"}`}>
                      {picks.has(i) ? <PickSVG size={22} /> : <div className="w-2 h-2 rounded-full bg-gray-700/50" />}
                    </div>
                    {/* BACK */}
                    <div className={`mines-card-face mines-card-face-back rounded-xl ${
                      state === "mine" ? "mines-back-mine" : state === "mine-unselected" ? "mines-back-mine-quiet" :
                      state === "safe-win" ? "mines-back-win" : state === "safe-lose" ? "mines-back-safe" : "mines-back-empty"}`}>
                      {state === "mine" && (<div className="relative mines-mine-container">
                        <div className="mines-shockwave" />
                        {Array.from({ length: 12 }, (_, pi) => <div key={pi} className={`mines-fire-particle mines-fire-p${pi}`} />)}
                        {Array.from({ length: 8 }, (_, di) => <div key={di} className={`mines-debris mines-debris-p${di}`} />)}
                        <div className="mines-smoke mines-smoke-1" /><div className="mines-smoke mines-smoke-2" /><div className="mines-smoke mines-smoke-3" />
                        <MineSVG size={30} className="mines-mine-icon" />
                      </div>)}
                      {state === "mine-unselected" && <div className="mines-mine-quiet"><MineSVG size={22} className="mines-mine-icon-quiet" /></div>}
                      {state === "safe-win" && <GemSVG size={26} className="mines-gem-icon" />}
                      {state === "safe-lose" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" /></svg>}
                      {state === "empty-revealed" && <div style={{ opacity: 0.25, filter: "grayscale(0.6)" }}><GemSVG size={18} /></div>}
                    </div>
                  </div>
                </button>
                {multLabel != null && <span className={`text-[9px] font-mono font-bold mt-0.5 leading-none ${picks.has(i) ? "text-orange-400" : "text-gray-500"}`}>{multLabel.toFixed(2)}x</span>}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-4">
          {res && revealed ? (
            <div className={`font-mono text-sm font-bold ${res.won ? "text-emerald-300" : "text-blood-300"}`}>{res.won ? `SAFE ${res.mult.toFixed(2)}× · +${fmt(res.payout, decimals)} ${meta?.symbol}` : "Hit a mine"}</div>
          ) : busy ? (
            <div className="font-mono text-xs text-bone-300 inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> {phase === "approving" ? "approving…" : phase === "committing" ? "placing…" : "revealing (waiting for block)…"}</div>
          ) : <div className="font-mono text-[11px] text-bone-400">Pick tiles ({picks.size}/{maxPicks}). Avoid the {mineCount} mines.</div>}
        </div>
      </div>

      {/* Controls */}
      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Bet</span><span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} disabled={busy || revealed}
              inputMode="decimal" placeholder="0.0" className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
            <button onClick={() => bal && setAmount(formatUnits(bal, decimals))} className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
          </div>
          <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setAmount} disabled={busy || revealed} />

          <div className="flex justify-between text-[10px] font-mono text-bone-500 mt-3 mb-1"><span>Mines</span><span>{mineCount} · {size === 9 ? "3×3" : size === 16 ? "4×4" : "5×5"}</span></div>
          <RangeInput min={1} max={24} value={mineCount} onChange={setMines} disabled={busy || revealed} />

          {(betError(amountWei) || err) && <div className="text-blood-200 text-xs mt-2">{betError(amountWei) || err}</div>}
          {revealed ? (
            <button onClick={reset} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2"><RotateCw size={15} /> New game</button>
          ) : (
            <button onClick={playGame} disabled={busy || amountWei <= 0n || picks.size < 1 || !!betError(amountWei)} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? "…" : "Reveal"}
            </button>
          )}
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>
        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          commit + reveal ({meta?.revealBlocks ?? 1} block). pick your tiles up front; mines are drawn from a future block hash. all picks safe = win, scaled by risk.
        </div>
      </ControlsTabs>
    </div>
  );
}
