import { useState } from "react";
import { RangeInput } from "../../components/RangeInput";
import { formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw } from "lucide-react";
import { useCommitRevealGame, fmt, errMsg } from "../gameCore";
import { BetPercents } from "../BetPercents";
import { PlinkoBoard, getBucketMultipliers } from "./plinkoVisuals";
import plinkoAbi from "../abi/PlinkoGameV3.json";

const ABI = (plinkoAbi as any).abi ?? (plinkoAbi as any);
const RISK = ["Low", "Medium", "High"];

import { ControlsTabs } from "../ControlsTabs";

export function PlinkoGame({ address }: { address: string }) {
  const g = useCommitRevealGame(address, ABI);
  const { meta, bal, phase, err, setErr, play, decimals, betError, maxBet } = g;
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState(12);
  const [risk, setRisk] = useState(1);
  const [resultBucket, setResultBucket] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [res, setRes] = useState<{ bucket: number; mult: number; won: boolean; payout: bigint } | null>(null);

  const busy = phase !== "idle" || animating;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const maxMult = Math.max(...getBucketMultipliers(rows, risk), 100) / 100;
  const be = betError(amountWei, (amountWei * BigInt(Math.round(maxMult * 100))) / 100n);

  async function drop() {
    setRes(null); setResultBucket(null); setAnimating(true);
    try {
      const s = await play({
        amountWei, gameLabel: "Plinko", gameKey: "plinko", commitFn: "commitDrop", commitArgs: [amountWei, rows, risk],
        committedEvent: "DropCommitted", revealFn: "revealDrop", settledEvent: "DropSettled",
      });
      if (s) {
        const bucket = Number(s[2]);
        setRes({ bucket, mult: Number(s[3]) / 100, won: s[4], payout: BigInt(s[5]) });
        setResultBucket(bucket); // board animates balls to this bucket
      } else { setAnimating(false); }
    } catch (e: any) { if (!["connect", "chain", "amount", "balance"].includes(e?.message)) setErr(errMsg(e)); setAnimating(false); }
  }

  function reset() { setRes(null); setResultBucket(null); setAnimating(false); }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* Board */}
      <div className="panel p-4 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1f1c 0%, #0a1512 60%, #060d0c 100%)" }}>
        <div className="flex justify-center">
          <PlinkoBoard rows={rows} riskLevel={risk} resultBucket={resultBucket} isAnimating={animating}
            tokenLogoUrl={undefined} onAnimDone={() => setAnimating(false)} />
        </div>
        {res && !animating && (
          <div className={`text-center mt-2 font-mono text-sm font-bold ${res.won ? "text-emerald-300" : "text-blood-300"}`}>
            {res.won ? `WON ${res.mult.toFixed(2)}× · +${fmt(res.payout, decimals)} ${meta?.symbol}` : `Bucket ${res.bucket} · ${res.mult.toFixed(2)}×`}
          </div>
        )}
        {busy && phase !== "idle" && (
          <div className="text-center mt-2 font-mono text-xs text-bone-300 inline-flex items-center gap-2 justify-center w-full">
            <Loader2 size={13} className="animate-spin" /> {phase === "approving" ? "approving…" : phase === "committing" ? "dropping…" : "revealing (waiting for block)…"}
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

          <div className="text-[10px] font-mono text-bone-500 mt-3 mb-1">Risk level · max {maxMult.toFixed(0)}×</div>
          <div className="grid grid-cols-3 gap-2">
            {RISK.map((r, i) => (
              <button key={r} onClick={() => !busy && setRisk(i)} className={`py-2 rounded-lg text-xs font-mono font-bold border ${risk === i ? "border-emerald-500 bg-emerald-900/20 text-emerald-300" : "border-ink-600 text-bone-400"}`}>{r}</button>
            ))}
          </div>

          <div className="flex justify-between text-[10px] font-mono text-bone-500 mt-3 mb-1"><span>Rows</span><span>{rows}</span></div>
          <RangeInput min={8} max={16} value={rows} onChange={(v) => !busy && setRows(v)} color="#10b981" disabled={busy} />

          {amountWei > 0n && (
            <div className="rounded-lg bg-emerald-900/10 border border-emerald-500/20 px-3 py-2 mt-3 font-mono text-xs flex justify-between">
              <span className="text-bone-500">max payout</span><span className="text-emerald-300 font-bold">{fmt((amountWei * BigInt(Math.round(maxMult * 100))) / 100n, decimals)} {meta?.symbol}</span>
            </div>
          )}
          {(be || err) && <div className="text-blood-200 text-xs mt-2">{be || err}</div>}
          {res && !animating ? (
            <button onClick={reset} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2"><RotateCw size={15} /> Drop again</button>
          ) : (
            <button onClick={drop} disabled={busy || amountWei <= 0n || !!be} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? "…" : "Drop"}
            </button>
          )}
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>
        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          commit + reveal ({meta?.revealBlocks ?? 1} block). 8–16 rows; the bucket comes from a future block hash. edges pay big, center pays little.
        </div>
      </ControlsTabs>
    </div>
  );
}
