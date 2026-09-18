import { useState } from "react";
import { RangeInput } from "../../components/RangeInput";
import { formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw } from "lucide-react";
import { useCommitRevealGame, fmt, errMsg } from "../gameCore";
import { BetPercents } from "../BetPercents";
import diceAbi from "../abi/DiceGameV3.json";

const ABI = (diceAbi as any).abi ?? (diceAbi as any);

/** Range (dice) — roll over/under a target on a 0-100 bar. Mirrors Avlo's range
 *  page: gradient bar, gold target thumb, over/under shaded zone, result marker. */
import { ControlsTabs } from "../ControlsTabs";

export function DiceGame({ address }: { address: string }) {
  const g = useCommitRevealGame(address, ABI);
  const { meta, bal, phase, err, setErr, play, decimals, betError, maxBet } = g;
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState(5000); // basis points, 100-9900 → 1.00-99.00%
  const [isOver, setIsOver] = useState(true);
  const [res, setRes] = useState<{ result: number; won: boolean; mult: number; payout: bigint } | null>(null);

  const busy = phase !== "idle";
  const chanceBp = isOver ? (10000 - target) : target;      // winning outcomes / 10000
  const winChance = chanceBp / 100;                          // %
  const mult = chanceBp > 0 ? (10000 / chanceBp) * ((meta?.rtpBps ?? 9700) / 10000) : 0;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const potentialWei = (amountWei * BigInt(Math.round(mult * 100))) / 100n;
  const be = betError(amountWei, potentialWei);
  const targetDisplay = (target / 100).toFixed(2);

  async function roll() {
    setRes(null);
    try {
      const s = await play({
        amountWei, gameLabel: "Range", gameKey: "dice", commitFn: "commitRoll", commitArgs: [amountWei, target, isOver],
        committedEvent: "RollCommitted", revealFn: "revealRoll", settledEvent: "RollSettled",
      });
      if (s) setRes({ result: Number(s[2]), won: s[3], mult: Number(s[4]) / 100, payout: BigInt(s[5]) });
    } catch (e: any) { if (!["connect", "chain", "amount", "balance"].includes(e?.message)) setErr(errMsg(e)); }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* Bar */}
      <div className="panel p-5 sm:p-8 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, #131b26 0%, #0b111a 60%, #06090e 100%)" }}>
        <div className="flex flex-col items-center justify-center min-h-[260px] gap-8">
          {/* result readout */}
          <div className="text-center">
            {res ? (
              <>
                <div className={`text-5xl font-bold font-mono tabular-nums ${res.won ? "text-emerald-400" : "text-blood-500"}`}>{(res.result / 100).toFixed(2)}</div>
                <div className={`mt-1 font-mono text-sm font-bold ${res.won ? "text-emerald-300" : "text-blood-300"}`}>{res.won ? `WON ${res.mult.toFixed(2)}× · +${fmt(res.payout, decimals)} ${meta?.symbol}` : "No win"}</div>
              </>
            ) : busy ? (
              <div className="font-mono text-sm text-bone-300 inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> {phase === "approving" ? "approving…" : phase === "committing" ? "rolling…" : "revealing (waiting for block)…"}</div>
            ) : (
              <div className="font-mono text-[11px] text-bone-400">Roll {isOver ? "over" : "under"} {targetDisplay} to win</div>
            )}
          </div>

          {/* the bar */}
          <div className="relative w-full max-w-xl h-14 mt-4">
            <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ background: "linear-gradient(90deg, #dc2626 0%, #ef4444 15%, #f59e0b 35%, #eab308 50%, #84cc16 65%, #22c55e 85%, #16a34a 100%)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 40%, transparent 50%, rgba(0,0,0,0.15) 100%)" }} />
              {/* shaded losing zone */}
              {isOver ? (
                <div className="absolute top-0 bottom-0 left-0 transition-all" style={{ width: `${target / 100}%`, background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 100%)" }} />
              ) : (
                <div className="absolute top-0 bottom-0 right-0 transition-all" style={{ width: `${100 - target / 100}%`, background: "linear-gradient(270deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 100%)" }} />
              )}
              {[25, 50, 75].map((pct) => (
                <div key={pct} className="absolute top-0 bottom-0 w-px z-[5]" style={{ left: `${pct}%`, background: "rgba(255,255,255,0.15)" }}>
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-bone-600">{pct}</div>
                </div>
              ))}
            </div>

            {/* gold target thumb */}
            <div className="absolute top-0 bottom-0 z-10 flex items-center" style={{ left: `${target / 100}%` }}>
              <div className="absolute -translate-x-1/2">
                <div className="w-[3px] h-14 rounded-full" style={{ background: "linear-gradient(180deg,#f0d878,#c8a84e 70%,#a0862e)", boxShadow: "0 0 12px rgba(212,184,90,0.5)" }} />
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono text-black" style={{ background: "linear-gradient(180deg,#f0d878,#c8a84e)", boxShadow: "0 2px 8px rgba(200,168,78,0.4)" }}>{targetDisplay}</div>
              </div>
            </div>

            {/* result marker */}
            {res && (
              <div className="absolute top-0 h-14 z-20 transition-all duration-500" style={{ left: `${res.result / 10000 * 100}%` }}>
                <div className="w-1 h-full -translate-x-1/2" style={{ background: res.won ? "linear-gradient(180deg,#4ade80,#16a34a)" : "linear-gradient(180deg,#f87171,#dc2626)", boxShadow: `0 0 12px ${res.won ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"}`, borderRadius: 2 }} />
                <div className={`absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md whitespace-nowrap ${res.won ? "text-black" : "text-white"}`} style={{ background: res.won ? "linear-gradient(180deg,#4ade80,#22c55e)" : "linear-gradient(180deg,#f87171,#ef4444)" }}>{(res.result / 100).toFixed(2)}%</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Bet</span><span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} disabled={busy}
              inputMode="decimal" placeholder="0.0" className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
            <button onClick={() => bal && setAmount(formatUnits(bal, decimals))} className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
          </div>
          <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setAmount} disabled={busy} />

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => setIsOver(false)} disabled={busy} className={`py-2 rounded-lg text-xs font-mono font-bold border ${!isOver ? "border-blood-500 bg-blood-900/20 text-blood-300" : "border-ink-600 text-bone-400"}`}>Roll under</button>
            <button onClick={() => setIsOver(true)} disabled={busy} className={`py-2 rounded-lg text-xs font-mono font-bold border ${isOver ? "border-emerald-500 bg-emerald-900/20 text-emerald-300" : "border-ink-600 text-bone-400"}`}>Roll over</button>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-mono text-bone-500 mb-1"><span>Target {targetDisplay}</span><span>chance {winChance.toFixed(2)}%</span></div>
            <RangeInput min={100} max={9900} step={100} value={target} onChange={setTarget} disabled={busy} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-[11px]">
            <div className="rounded-lg bg-ink-900/50 border border-ink-700/70 p-2"><div className="text-[9px] text-bone-500 uppercase">Multiplier</div><div className="text-bone-100 font-bold">{mult.toFixed(2)}×</div></div>
            <div className="rounded-lg bg-ink-900/50 border border-ink-700/70 p-2"><div className="text-[9px] text-bone-500 uppercase">Win chance</div><div className="text-bone-100 font-bold">{winChance.toFixed(2)}%</div></div>
          </div>

          {(be || err) && <div className="text-blood-200 text-xs mt-2">{be || err}</div>}
          <button onClick={roll} disabled={busy || amountWei <= 0n || !!be} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <><Loader2 size={15} className="animate-spin" /> …</> : res ? <><RotateCw size={15} /> Roll again</> : "Roll"}
          </button>
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>
        <div className="panel p-3 font-mono text-[11px] text-bone-500"><div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>commit + reveal ({meta?.revealBlocks ?? 1} block). result 0.00–99.99 from a future block hash. payout = bet × multiplier.</div>
      </ControlsTabs>
    </div>
  );
}
