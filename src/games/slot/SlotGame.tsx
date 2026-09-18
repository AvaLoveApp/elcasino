import { useState } from "react";
import { formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet } from "lucide-react";
import { useCommitRevealGame, fmt, errMsg } from "../gameCore";
import { BetPercents } from "../BetPercents";
import { SlotReel } from "./SlotReel";
import { SYMBOL_GLOWS } from "./SlotSymbol";
import { playSound } from "../sound";
import { ControlsTabs } from "../ControlsTabs";
import slotAbi from "../abi/SlotGameV3.json";

const ABI = (slotAbi as any).abi ?? (slotAbi as any);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Reels = [number, number, number];

export function SlotGame({ address }: { address: string }) {
  const g = useCommitRevealGame(address, ABI);
  const { meta, bal, phase, err, setErr, play, decimals, betError, maxBet } = g;
  const [amount, setAmount] = useState("");
  const [reels, setReels] = useState<Reels>([0, 0, 0]);
  const [animating, setAnimating] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [res, setRes] = useState<{ won: boolean; payout: bigint; reels: Reels; mult: number } | null>(null);

  const spinning = animating.some(Boolean);
  const busy = phase !== "idle" || spinning;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();

  async function spin() {
    setRes(null);
    setAnimating([true, true, true]);
    playSound("chip");
    try {
      const s = await play({
        amountWei, gameLabel: "Slots", gameKey: "slots", commitFn: "commitSpin", commitArgs: [amountWei],
        committedEvent: "SpinCommitted", revealFn: "revealSpin", settledEvent: "SpinSettled",
      });
      if (!s) { setAnimating([false, false, false]); return; }
      const r1 = Number(s[2]), r2 = Number(s[3]), r3 = Number(s[4]);
      const won = Boolean(s[5]); const payout = BigInt(s[6]);
      const mult = amountWei > 0n ? Number((payout * 100n) / amountWei) / 100 : 0;

      // Staggered, dramatic stop — reel 1, then 2, suspense ticks, then reel 3.
      await sleep(250);
      setReels((p) => [r1, p[1], p[2]]); setAnimating([false, true, true]); playSound("hit");
      await sleep(650);
      setReels((p) => [r1, r2, p[2]]); setAnimating([false, false, true]); playSound("tick");
      await sleep(320); playSound("tick");
      await sleep(320); playSound("tick");
      await sleep(220);
      setReels([r1, r2, r3]); setAnimating([false, false, false]); playSound("hit");
      setRes({ won, payout, reels: [r1, r2, r3], mult });
      playSound(won ? (mult >= 10 ? "blackjack" : "win") : "lose");
    } catch (e: any) {
      setAnimating([false, false, false]);
      if (!["connect", "chain", "amount", "balance"].includes(e?.message)) setErr(errMsg(e));
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      {/* slot machine */}
      <div className="panel p-5 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 15%, #142a20 0%, #0c1712 55%, #05090a 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 9px)" }} />

        <div className="relative">
          {/* status bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${spinning ? "bg-emerald-400 animate-pulse" : "bg-ink-600"}`} style={{ animationDelay: `${i * 200}ms` }} />
              ))}
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-bone-500 ml-1.5">{spinning ? "processing" : "ready"}</span>
            </div>
            <span className="text-[10px] font-mono text-bone-700 tracking-wider">SEED::SHA256</span>
          </div>

          {/* reels */}
          <div className="flex justify-center gap-3 sm:gap-4 mb-3">
            {[0, 1, 2].map((i) => {
              const isLast = i === 2 && !animating[0] && !animating[1] && animating[2];
              const glow = SYMBOL_GLOWS[reels[i]];
              return (
                <div key={i}
                  className={`relative w-[104px] h-[132px] sm:w-[150px] sm:h-[190px] rounded-xl border overflow-hidden flex items-center justify-center transition-all duration-500 ${
                    isLast ? "border-emerald-400/50 scale-105" : animating[i] ? "border-ink-500" : "border-ink-600/60"
                  }`}
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(0,0,0,0.92) 0%, rgba(0,0,0,1) 100%)",
                    boxShadow: isLast
                      ? "inset 0 0 40px rgba(0,0,0,0.6), 0 0 24px rgba(52,211,153,0.22)"
                      : !animating[i]
                        ? `inset 0 0 30px rgba(0,0,0,0.5), 0 0 12px ${glow}`
                        : "inset 0 0 30px rgba(0,0,0,0.5)",
                  }}>
                  <SlotReel spinning={animating[i]} target={reels[i]} sym={meta?.symbol} />
                  <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-emerald-400/20" />
                  <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-emerald-400/20" />
                  <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-emerald-400/20" />
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-emerald-400/20" />
                </div>
              );
            })}
          </div>

          {/* win line */}
          <div className="pointer-events-none relative h-[1px] -mt-[70px] mb-[70px] mx-6 bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

          {/* result / status */}
          <div className="flex justify-center min-h-[34px]">
            {res && !spinning ? (
              <div className={`font-mono text-sm font-bold px-4 py-1.5 rounded-full inline-flex items-center gap-2 ${res.won ? "bg-emerald-900/40 text-emerald-300 border border-emerald-500/40" : "bg-blood-900/30 text-blood-300 border border-blood-500/40"}`}>
                {res.won
                  ? <>{res.mult >= 10 ? "JACKPOT!" : "WON"} +{fmt(res.payout, decimals)} {meta?.symbol}{res.mult > 0 && <span className="text-[10px] opacity-70">{res.mult}×</span>}</>
                  : "No match"}
              </div>
            ) : busy ? (
              <div className="font-mono text-xs text-bone-300 inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> {phase === "approving" ? "approving…" : phase === "committing" ? "spinning…" : phase === "revealing" ? "revealing (waiting for block)…" : "rolling…"}</div>
            ) : <div className="font-mono text-[11px] text-bone-400">Match 3 symbols to win big · 2 pays 2×</div>}
          </div>
        </div>
      </div>

      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Bet</span>
            <span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal" placeholder="0.0" className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
            <button onClick={() => bal && setAmount(formatUnits(bal, decimals))} className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
          </div>
          <BetPercents bal={bal} maxBet={maxBet} decimals={decimals} onPick={setAmount} disabled={busy} />
          {(betError(amountWei) || err) && <div className="text-blood-200 text-xs mt-2">{betError(amountWei) || err}</div>}
          <button onClick={spin} disabled={busy || amountWei <= 0n || !!betError(amountWei)} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
            {busy && <Loader2 size={15} className="animate-spin" />}{busy ? "…" : "Spin"}
          </button>
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>
        <div className="panel p-3 font-mono text-[11px] text-bone-500"><div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>commit + reveal ({meta?.revealBlocks ?? 1} block). three reels from a future block hash; matches pay per the on-chain table.</div>
      </ControlsTabs>
    </div>
  );
}
