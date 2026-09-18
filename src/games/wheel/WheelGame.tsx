import { useCallback, useEffect, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw } from "lucide-react";
import { readProvider } from "../../lib/chain";
import { useCommitRevealGame, fmt, errMsg } from "../gameCore";
import { BetPercents } from "../BetPercents";
import { WheelVisual, WheelParticles } from "./wheelVisuals";
import wheelAbi from "../abi/WheelGameV3.json";

const ABI = (wheelAbi as any).abi ?? (wheelAbi as any);
const RISK = ["Low", "Medium", "High"];
const FALLBACK_SEG = [50, 100, 150, 200, 0, 50, 100, 300, 0, 500];

import { ControlsTabs } from "../ControlsTabs";

export function WheelGame({ address }: { address: string }) {
  const g = useCommitRevealGame(address, ABI);
  const { meta, bal, phase, err, setErr, play, decimals, betError, maxBet } = g;
  const [amount, setAmount] = useState("");
  const [risk, setRisk] = useState(1);
  const [segments, setSegments] = useState<number[]>(FALLBACK_SEG);
  const [spinning, setSpinning] = useState(false);
  const [resultSeg, setResultSeg] = useState<number | null>(null);
  const [res, setRes] = useState<{ segment: number; mult: number; won: boolean; payout: bigint } | null>(null);
  const [showParticles, setShowParticles] = useState(false);

  // Load the segment multiplier table for the selected risk level.
  const loadSegs = useCallback(async () => {
    try {
      const c = new Contract(address, ABI, readProvider);
      const raw = await c.getSegments(risk);
      setSegments((raw as any[]).map((s) => Number(s)));
    } catch { setSegments(FALLBACK_SEG); }
  }, [address, risk]);
  useEffect(() => { loadSegs(); }, [loadSegs]);

  const busy = phase !== "idle" || spinning;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const maxMult = Math.max(...segments, 100) / 100;
  const be = betError(amountWei, (amountWei * BigInt(Math.round(maxMult * 100))) / 100n);

  async function spin() {
    setRes(null); setResultSeg(null); setShowParticles(false); setSpinning(true);
    try {
      const s = await play({
        amountWei, gameLabel: "Wheel", gameKey: "wheel", commitFn: "commitSpin", commitArgs: [amountWei, risk],
        committedEvent: "SpinCommitted", revealFn: "revealSpin", settledEvent: "SpinSettled",
      });
      if (s) {
        const segment = Number(s[2]);
        setRes({ segment, mult: Number(s[3]) / 100, won: s[4], payout: BigInt(s[5]) });
        setResultSeg(segment); // wheel decelerates to this segment
      } else { setSpinning(false); }
    } catch (e: any) { if (!["connect", "chain", "amount", "balance"].includes(e?.message)) setErr(errMsg(e)); setSpinning(false); }
  }

  function onLand() {
    setSpinning(false);
    if (res) { setShowParticles(true); setTimeout(() => setShowParticles(false), 1500); }
  }

  function reset() { setRes(null); setResultSeg(null); setSpinning(false); setShowParticles(false); }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* Wheel */}
      <div className="panel p-4 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 40%, #171326 0%, #0d0a18 60%, #060409 100%)" }}>
        {showParticles && res && <WheelParticles type={res.won ? (res.mult >= 5 ? "bigwin" : "win") : "lose"} />}
        <div className="flex justify-center">
          <WheelVisual segments={segments} resultSegment={resultSeg} isSpinning={spinning} onLand={onLand} />
        </div>
        {res && !spinning && (
          <div className={`text-center mt-2 font-mono text-sm font-bold ${res.won ? "text-emerald-300" : "text-blood-300"}`}>
            {res.won ? `WON ${res.mult.toFixed(2)}× · +${fmt(res.payout, decimals)} ${meta?.symbol}` : `Landed ${res.mult.toFixed(2)}× — no win`}
          </div>
        )}
      </div>

      {/* Controls */}
      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Bet</span>
            <span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} disabled={busy}
              inputMode="decimal" placeholder="0.0" className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
            <button onClick={() => bal && setAmount(formatUnits(bal, decimals))} className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
          </div>
          <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setAmount} disabled={busy} />

          <div className="text-[10px] font-mono text-bone-500 mt-3 mb-1">Risk level · max {maxMult.toFixed(1)}×</div>
          <div className="grid grid-cols-3 gap-2">
            {RISK.map((r, i) => (
              <button key={r} onClick={() => !busy && setRisk(i)} className={`py-2 rounded-lg text-xs font-mono font-bold border ${risk === i ? "border-purple-500 bg-purple-900/20 text-purple-300" : "border-ink-600 text-bone-400"}`}>{r}</button>
            ))}
          </div>

          {/* segment chips */}
          <div className="flex flex-wrap gap-1 mt-3">
            {segments.map((s, i) => (
              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-ink-600 text-bone-400">{(s / 100).toFixed(1)}×</span>
            ))}
          </div>

          {amountWei > 0n && (
            <div className="rounded-lg bg-emerald-900/10 border border-emerald-500/20 px-3 py-2 mt-3 font-mono text-xs flex justify-between">
              <span className="text-bone-500">max payout</span><span className="text-emerald-300 font-bold">{fmt((amountWei * BigInt(Math.round(maxMult * 100))) / 100n, decimals)} {meta?.symbol}</span>
            </div>
          )}
          {(be || err) && <div className="text-blood-200 text-xs mt-2">{be || err}</div>}
          {res && !spinning ? (
            <button onClick={reset} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2"><RotateCw size={15} /> Spin again</button>
          ) : (
            <button onClick={spin} disabled={busy || amountWei <= 0n || !!be} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {phase === "approving" ? "approving…" : phase === "committing" ? "spinning…" : phase === "revealing" ? "revealing…" : spinning ? "spinning…" : "Spin"}
            </button>
          )}
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>
        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          commit + reveal ({meta?.revealBlocks ?? 1} block). 10 equal segments; higher risk = bigger top multipliers and more 0× misses. randomness from a future block hash.
        </div>
      </ControlsTabs>
    </div>
  );
}
