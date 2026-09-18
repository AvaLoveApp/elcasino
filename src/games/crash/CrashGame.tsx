import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, Wallet, RotateCw } from "lucide-react";
import { useWallet } from "../../lib/wallet";
import { readProvider } from "../../lib/chain";
import { GAME_ERC20_ABI } from "../../lib/casinoGame";
import { fmtAmount } from "../../lib/util";
import { logBet } from "../../lib/betfeed";
import { waitRevealReady, sendGameTx } from "../gameCore";
import { BetPercents } from "../BetPercents";
import crashAbi from "../abi/CrashGameV3.json";
import GameResultCard from "../roulette/GameResultCard";
import { StarsCanvas, RocketSVG, LaunchPlatform, ExplosionEffect, FallingTokens, PendulumToken, playSound, playEngineSound, stopEngineSound } from "./crashVisuals";

const ABI = (crashAbi as any).abi ?? (crashAbi as any);

type Phase = "idle" | "approving" | "committing" | "revealing" | "climbing" | "settled";
type Meta = { symbol: string; decimals: number; token: string; logo: string; pool: bigint; minBet: bigint; revealBlocks: number; maxMult: number; maxWinBps: number; maxBetRatioBps: number };

import { ControlsTabs } from "../ControlsTabs";

export function CrashGame({ address }: { address: string }) {
  const w = useWallet();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState(0n);
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("2.00");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);

  const [animMult, setAnimMult] = useState(1);
  const [explode, setExplode] = useState(false);
  const [outcome, setOutcome] = useState<{ won: boolean; crashPoint: number; target: number; payout: bigint } | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const raf = useRef(0);

  const loadMeta = useCallback(async () => {
    try {
      const g = new Contract(address, ABI, readProvider);
      const [gi, cfg, rb] = await Promise.all([g.getGameInfo(), g.config(), g.revealExtraBlocks().catch(() => 1n)]);
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      setMeta({ symbol, decimals: Number(decimals), token, logo: gi[2], pool: gi[4], minBet: cfg[3], revealBlocks: Number(rb), maxMult: Number(cfg[5] ?? 100000n) / 100, maxWinBps: Number(cfg[2]), maxBetRatioBps: Number(cfg[4]) });
      if (w.address) {
        const [b, a] = await Promise.all([erc.balanceOf(w.address), erc.allowance(w.address, address)]);
        setBal(b); setAllowance(a);
      }
      // Recent crash points (bets are settled → crashPoint at struct[8]).
      try {
        const total = Number(gi[5]);
        if (total > 0) {
          const N = Math.min(14, total);
          const rows = await Promise.all(Array.from({ length: N }, (_, i) => g.bets(BigInt(total - 1 - i)).catch(() => null)));
          const pts = rows.filter((r) => r && (r.settled ?? r[2])).map((r: any) => Number(r.crashPoint ?? r[8]) / 100).filter((n) => n > 0);
          if (pts.length) setHistory(pts);
        }
      } catch {}
    } catch { setErr("Could not load game."); }
  }, [address, w.address]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); stopEngineSound(); }, []);

  const decimals = meta?.decimals ?? 18;
  const maxMult = meta?.maxMult ?? 1000;
  const targetX = Math.max(1.01, Math.min(maxMult, Number(target) || 0));
  const targetBP = Math.round(targetX * 100);
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const potential = amountWei > 0n ? (amountWei * BigInt(targetBP)) / 100n : 0n;
  const busy = ["approving", "committing", "revealing", "climbing"].includes(phase);
  const maxBet = meta && meta.maxBetRatioBps > 0 ? (meta.pool * BigInt(meta.maxBetRatioBps)) / 10000n : 0n;
  const maxWin = meta && meta.maxWinBps > 0 ? (meta.pool * BigInt(meta.maxWinBps)) / 10000n : 0n;
  const betLimitErr: string | null = (() => {
    if (!meta) return null;
    if (meta.pool <= 0n) return "Pool is empty — fund the pool first";
    if (amountWei <= 0n) return null;
    if (bal !== null && amountWei > bal) return "Not enough balance";
    if (amountWei < meta.minBet) return `Min bet ${fmt(meta.minBet, decimals, 4)} ${meta.symbol}`;
    if (maxBet > 0n && amountWei > maxBet) return `Max bet ${(meta.maxBetRatioBps / 100).toFixed(0)}% of pool · ${fmt(maxBet, decimals)} ${meta.symbol}`;
    if (maxWin > 0n && potential - amountWei > maxWin) return `Max win ${(meta.maxWinBps / 100).toFixed(0)}% of pool — lower your target or bet`;
    return null;
  })();

  // Replay the round: climb the multiplier to where the player's round ended.
  function runClimb(won: boolean, crashPoint: number, tgt: number, payout: bigint) {
    const end = won ? tgt : crashPoint;
    const dur = Math.min(6000, 1400 + Math.log2(Math.max(end, 1.01)) * 1400);
    const t0 = performance.now();
    playSound("launch");
    playEngineSound(dur, end);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      const m = 1 + (end - 1) * eased;
      setAnimMult(m);
      if (p < 1) { raf.current = requestAnimationFrame(step); }
      else {
        stopEngineSound();
        if (won) { playSound("cashout"); setOutcome({ won, crashPoint, target: tgt, payout }); setShowCard(true); setPhase("settled"); }
        else { playSound("crash"); setExplode(true); setOutcome({ won, crashPoint, target: tgt, payout }); setTimeout(() => { setShowCard(true); setPhase("settled"); }, 700); }
      }
    };
    raf.current = requestAnimationFrame(step);
  }

  async function launch() {
    setErr(null); setOutcome(null); setShowCard(false); setExplode(false); setAnimMult(1);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer || !meta) return;
    if (amountWei <= 0n) { setErr("Enter a bet."); return; }
    if (bal !== null && amountWei > bal) { setErr("Not enough balance."); return; }
    try {
      if (allowance < amountWei) {
        setPhase("approving");
        const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
        await (await erc.approve(address, amountWei)).wait();
        setAllowance(amountWei);
      }
      setPhase("committing");
      const g = new Contract(address, ABI, w.signer);
      const rc = await (await g.commitBet(amountWei, targetBP)).wait();
      let id: bigint | null = null;
      for (const log of rc.logs) { try { const p = g.interface.parseLog(log); if (p?.name === "BetCommitted") { id = BigInt(p.args[0]); break; } } catch {} }
      if (id === null) throw new Error("commit id missing");
      logBet({ wallet: w.address!, name: w.profile?.name, avatar: w.profile?.avatar, game: "Crash", gameKey: "crash", address, symbol: meta?.symbol, amount: Number(formatUnits(amountWei, decimals)) });
      setPhase("revealing");
      await waitRevealReady(address, ABI, "revealBet", id, rc.blockNumber, w.signer);
      await sendGameTx(g, address, ABI, "revealBet", [id], w.address);
      const b = await new Contract(address, ABI, readProvider).bets(id);
      const crashPoint = Number(b.crashPoint ?? b[8]) / 100;
      const won = (b.won ?? b[5]);
      const payout = BigInt(b.payout ?? b[6]);
      setPhase("climbing");
      loadMeta();
      runClimb(won, crashPoint || targetX, targetX, payout);
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Transaction failed."); setPhase("idle"); stopEngineSound(); }
  }

  function reset() { setOutcome(null); setShowCard(false); setExplode(false); setAnimMult(1); setPhase("idle"); }

  // Rocket rise fraction from the climb.
  const endVal = outcome ? (outcome.won ? outcome.target : outcome.crashPoint) : targetX;
  const flying = phase === "climbing" || (phase === "settled" && !!outcome?.won);
  const flame = phase === "climbing" ? 1 : 0.15;
  const multColor = phase === "settled" ? (outcome?.won ? "#10b981" : "#ef4444") : "#f59e0b";

  // Live multiplier curve (rocket flies ALONG this arc — Avlo-style).
  const showCurve = phase === "climbing" || phase === "settled";
  const { curvePoints, areaPoints, rocketPos, rocketAngle, trailPoints } = useMemo(
    () => computeCurve(animMult, Math.max(endVal, 1.02)), [animMult, endVal]);
  const curveColor = explode ? "#ff4444" : (phase === "settled" && outcome?.won) ? "#00ff88" : "#00ffaa";

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* ── Scene ── */}
      <div className="panel p-0 relative overflow-hidden" style={{ minHeight: 380, background: "linear-gradient(180deg, #0a0e1a 0%, #0a0a12 60%, #050507 100%)" }}>
        <StarsCanvas />

        {/* recent crash points */}
        {history.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-30 flex gap-1 overflow-x-auto scrollbar-hide">
            {history.map((c, i) => (
              <span key={i} className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${c >= 10 ? "bg-fuchsia-500/20 text-fuchsia-300" : c >= 2 ? "bg-emerald-500/15 text-emerald-300" : "bg-blood-500/15 text-blood-300"}`}>{c.toFixed(2)}×</span>
            ))}
          </div>
        )}

        {/* Result card overlay */}
        <div className="absolute top-3 left-3 right-3 z-30">
          <GameResultCard
            show={showCard && !!outcome}
            won={!!outcome?.won}
            amount={outcome?.won ? fmt(outcome.payout, decimals) : undefined}
            tokenLogoUrl={meta?.logo || undefined}
            tokenSymbol={meta?.symbol || "TOKEN"}
            subtitle={outcome ? `Crashed at ${outcome.crashPoint.toFixed(2)}× · target ${outcome.target.toFixed(2)}×` : ""}
            multiplier={outcome?.won ? outcome.target : 0}
            theme="amber"
            winTitle="CASHED OUT!"
            loseTitle="CRASHED"
          />
        </div>

        {/* Big multiplier */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-8 z-20 pointer-events-none">
          <div className="font-mono font-black tabular-nums" style={{ fontSize: 54, color: multColor, textShadow: `0 0 30px ${multColor}80` }}>
            {animMult.toFixed(2)}×
          </div>
        </div>

        {/* ── Multiplier curve + area fill (rocket flies ALONG this arc) ── */}
        <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 400 300" preserveAspectRatio="none">
          {[1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1="20" y1={280 - i * 48} x2="380" y2={280 - i * 48} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          ))}
          <line x1="20" y1="280" x2="380" y2="280" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          {showCurve && areaPoints && <polygon points={areaPoints} fill="url(#crAreaFill)" opacity={explode ? 0.15 : 0.5} />}
          {showCurve && curvePoints && <polyline points={curvePoints} fill="none" stroke={explode ? "#ff4444" : "url(#crCurveGrad)"} strokeWidth="2.5" strokeLinecap="round" />}
          {showCurve && !explode && trailPoints.length > 0 && (
            <g style={{ mixBlendMode: "screen" }}>
              {trailPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.size} fill="url(#crSmoke)" opacity={p.opacity} />)}
            </g>
          )}
          <defs>
            <linearGradient id="crCurveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={curveColor} /><stop offset="100%" stopColor="#00ccaa" />
            </linearGradient>
            <linearGradient id="crAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={explode ? "#ff4444" : "#00ff88"} stopOpacity="0.35" />
              <stop offset="100%" stopColor={explode ? "#ff4444" : "#00ff88"} stopOpacity="0.02" />
            </linearGradient>
            <radialGradient id="crSmoke" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="rgba(255,210,160,0.85)" /><stop offset="35%" stopColor="rgba(200,200,210,0.55)" />
              <stop offset="75%" stopColor="rgba(120,120,130,0.25)" /><stop offset="100%" stopColor="rgba(60,60,70,0)" />
            </radialGradient>
          </defs>
        </svg>

        {/* Falling tokens while rising */}
        {flying && !explode && meta?.logo && animMult > 1.05 && (
          <div className="absolute inset-0 z-10 pointer-events-none"><FallingTokens logoUrl={meta.logo} intensity={animMult} /></div>
        )}

        {/* Launch platform + idle rocket (pre-flight, bottom-left where the curve starts) */}
        {!showCurve && (
          <>
            <div className="absolute z-[12]" style={{ left: "2%", bottom: "4%" }}><LaunchPlatform /></div>
            <div className="absolute z-[13]" style={{ left: "calc(2% + 18px)", bottom: "calc(4% + 34px)" }}><RocketSVG flameIntensity={0.15} size={64} /></div>
          </>
        )}

        {/* Flying rocket — rides the curve tip. Position updates every frame with
            NO transition so it tracks the fast-moving tip exactly (a CSS transition
            here makes the rocket lag behind the line and look frozen). Rotation is
            on a separate inner element so it doesn't fight the centering translate. */}
        {showCurve && !explode && (
          <div className="absolute z-[14]" style={{
            left: `${(rocketPos.x / 400) * 100}%`, top: `${(rocketPos.y / 300) * 100}%`,
            transform: "translate(-50%,-50%)",
            transition: "none",
            filter: `drop-shadow(0 0 20px ${curveColor}${Math.round(Math.min(animMult / 5, 0.7) * 255).toString(16).padStart(2, "0")})`,
          }}>
            <div className="relative" style={{ transform: `rotate(${rocketAngle}deg)`, transition: "transform 0.15s ease-out" }}>
              <RocketSVG flameIntensity={flame} size={64} />
            </div>
            {meta?.logo && flying && (
              <div className="absolute" style={{ left: "50%", top: "40%", transform: "translate(-50%,0)" }}>
                <PendulumToken logoUrl={meta.logo} multiplier={animMult} />
              </div>
            )}
          </div>
        )}

        {/* Explosion at the crash point */}
        {explode && (
          <div className="absolute z-[15]" style={{ left: `${(rocketPos.x / 400) * 100}%`, top: `${(rocketPos.y / 300) * 100}%`, transform: "translate(-50%,-50%)" }}>
            <ExplosionEffect />
          </div>
        )}

        {/* status line */}
        {busy && phase !== "climbing" && (
          <div className="absolute bottom-2 left-3 z-30 font-mono text-xs text-bone-300 inline-flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> {phase === "approving" ? "approving…" : phase === "committing" ? "igniting…" : "revealing (waiting for block)…"}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
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

          <div className="mt-3">
            <div className="text-[10px] font-mono text-bone-500 mb-1">Cash-out target (×)</div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5">
              <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal" className="flex-1 bg-transparent outline-none text-lg font-mono tabular-nums w-full" />
              <span className="text-bone-500 font-mono text-sm">×</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              {["1.50", "2.00", "5.00", "10.00"].map((v) => (
                <button key={v} onClick={() => setTarget(v)} className={`flex-1 text-[11px] font-mono rounded-lg py-1.5 border ${target === v ? "border-amber-500 text-amber-300 bg-amber-900/20" : "border-ink-600 text-bone-400 hover:border-amber-500/50"}`}>{v}×</button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-emerald-900/10 border border-emerald-500/20 px-3 py-2 mt-3 font-mono text-xs flex justify-between">
            <span className="text-bone-500">payout if hit</span><span className="text-emerald-300 font-bold">{fmt(potential, decimals)} {meta?.symbol}</span>
          </div>

          {(betLimitErr || err) && <div className="text-blood-200 text-xs mt-2">{betLimitErr || err}</div>}
          {phase === "settled" ? (
            <button onClick={reset} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2"><RotateCw size={15} /> New round</button>
          ) : (
            <button onClick={launch} disabled={busy || amountWei <= 0n || !!betLimitErr} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}{busy ? "…" : "Launch 🚀"}
            </button>
          )}
          {meta && <div className="mt-2 font-mono text-[10px] text-bone-500 text-center">min {fmt(meta.minBet, decimals, 4)} · max {maxMult.toFixed(0)}× · pool {fmt(meta.pool, decimals, 1)} {meta.symbol}</div>}
        </div>

        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it settles</div>
          commit + reveal ({meta?.revealBlocks ?? 1} block). the crash point is drawn from a future block hash; you win your target × bet if the rocket reaches your target before it crashes.
        </div>
      </ControlsTabs>
    </div>
  );
}

function fmt(v: bigint, d = 18, _mx = 2) { return fmtAmount(Number(formatUnits(v, d))); }

// ── Multiplier curve + area fill + rocket position (ported 1:1 from Avlo) ──
// viewBox space is 0 0 400 300; the curve rises from the launch pad (20,280)
// toward the upper-right. The rocket sits at the curve tip with a tangent angle,
// and a fixed-length smoke plume trails behind it along the flown arc.
type Trail = { x: number; y: number; size: number; opacity: number };
function computeCurve(animMultiplier: number, animTarget: number) {
  if (animMultiplier <= 1.01) return { curvePoints: "", areaPoints: "", rocketPos: { x: 20, y: 280 }, rocketAngle: 0, trailPoints: [] as Trail[] };
  const maxY = Math.max(animTarget * 1.15, animMultiplier * 1.15, 2.5);
  const progress = animTarget > 1.01 ? Math.min((animMultiplier - 1) / (animTarget - 1), 1) : 0;
  const maxX = 20 + Math.max(progress, 0.05) * 350;
  const steps = 80;
  const curvePts: string[] = [];
  const areaPts: string[] = ["20,280"];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = 20 + t * (maxX - 20);
    const m = 1 + (animMultiplier - 1) * Math.pow(t, 1.3);
    const yNorm = Math.min((m - 1) / (maxY - 1), 1);
    const y = 280 - yNorm * 240;
    curvePts.push(`${x},${y}`); areaPts.push(`${x},${y}`);
  }
  areaPts.push(`${maxX},280`);
  const rocketYNorm = Math.min((animMultiplier - 1) / (maxY - 1), 1);
  const rocketY = 280 - rocketYNorm * 240;
  let rocketAngle = 0;
  if (curvePts.length >= 2) {
    const last = curvePts[curvePts.length - 1].split(",").map(Number);
    const prev = curvePts[curvePts.length - 2].split(",").map(Number);
    rocketAngle = Math.atan2(last[1] - prev[1], last[0] - prev[0]) * (180 / Math.PI) + 90;
  }
  const trail: Trail[] = [];
  const TAIL_LENGTH = 95, PUFF_SPACING = 7;
  let accumulated = 0, nextEmit = PUFF_SPACING * 0.5, puffIdx = 0;
  let prevX = Number(curvePts[curvePts.length - 1].split(",")[0]);
  let prevY = Number(curvePts[curvePts.length - 1].split(",")[1]);
  for (let i = curvePts.length - 2; i >= 0 && accumulated < TAIL_LENGTH; i--) {
    const pt = curvePts[i].split(",").map(Number);
    accumulated += Math.sqrt((pt[0] - prevX) ** 2 + (pt[1] - prevY) ** 2);
    if (accumulated >= nextEmit) {
      const age = Math.min(accumulated / TAIL_LENGTH, 1);
      trail.push({ x: pt[0] + (((puffIdx * 37) % 9) - 4) * age, y: pt[1] + (((puffIdx * 53) % 7) - 3) * age + age * 4, size: 3 + age * 16, opacity: Math.max(0, 0.65 * (1 - age * age)) });
      nextEmit += PUFF_SPACING; puffIdx++;
    }
    prevX = pt[0]; prevY = pt[1];
  }
  return { curvePoints: curvePts.join(" "), areaPoints: areaPts.join(" "), rocketPos: { x: maxX, y: rocketY }, rocketAngle, trailPoints: trail };
}
