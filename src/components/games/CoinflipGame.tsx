import { useEffect, useState, useCallback } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Coins, Loader2, Check, X, Wallet } from "lucide-react";
import { useWallet } from "../../lib/wallet";
import { readProvider } from "../../lib/chain";
import { COINFLIP_ABI, GAME_ERC20_ABI, loadGameInfo, recentFlips, Flip, fmtToken } from "../../lib/casinoGame";
import { logBet } from "../../lib/betfeed";
import { short } from "../../lib/util";
import { waitRevealReady, sendGameTx } from "../../games/gameCore";
import { CoinVisual } from "./CoinVisual";

type Phase = "idle" | "approving" | "committing" | "waiting" | "revealing" | "done";

/**
 * Full on-chain Coinflip. Commit-reveal flow:
 *   1. approve (if allowance < bet)
 *   2. commitFlip(amount, choice) → flipId (read from FlipCommitted event)
 *   3. wait revealBlocks blocks
 *   4. revealFlip(flipId) → result + payout (FlipSettled event)
 */
import { ControlsTabs } from "../../games/ControlsTabs";

export function CoinflipGame({ address }: { address: string }) {
  const w = useWallet();
  const [meta, setMeta] = useState<{ symbol: string; decimals: number; token: string; logo: string; pool: bigint; minBet: bigint; multiplierBp: number; revealBlocks: number; paused: boolean; maxBetRatioBps: number; maxWinBps: number } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [coinResult, setCoinResult] = useState<number | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [choice, setChoice] = useState<0 | 1>(0); // 0 heads, 1 tails
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ won: boolean; payout: bigint; result: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<Flip[]>([]);
  const [waitInfo, setWaitInfo] = useState<string>("");

  const loadAll = useCallback(async () => {
    try {
      const gi = await loadGameInfo(address);
      const erc = new Contract(gi.info.token, GAME_ERC20_ABI, readProvider);
      const game = new Contract(address, COINFLIP_ABI, readProvider);
      const [symbol, decimals, multiplierBp] = await Promise.all([
        erc.symbol().catch(() => "TOK"),
        erc.decimals().catch(() => 18),
        game.MULTIPLIER_BP().catch(() => 19800n),
      ]);
      setMeta({
        symbol, decimals: Number(decimals), token: gi.info.token, logo: gi.info.tokenLogoUrl, pool: gi.info.poolBalance,
        minBet: gi.config.minBet, multiplierBp: Number(multiplierBp), revealBlocks: gi.revealBlocks,
        paused: gi.info.paused, maxBetRatioBps: Number(gi.config.maxBetPoolRatio), maxWinBps: gi.config.maxWinBps,
      });
      if (w.address) {
        const [b, a] = await Promise.all([
          erc.balanceOf(w.address),
          erc.allowance(w.address, address),
        ]);
        setBal(b); setAllowance(a);
      }
      setRecent(await recentFlips(address, 8));
    } catch (e: any) {
      setErr("Could not load game from chain.");
    }
  }, [address, w.address]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const decimals = meta?.decimals ?? 18;
  const amountWei = (() => { try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; } })();
  const needsApprove = amountWei > 0n && allowance < amountWei;
  const multiplier = meta ? meta.multiplierBp / 10000 : 1.98;
  const potentialWin = amountWei > 0n ? Number(formatUnits(amountWei, decimals)) * multiplier : 0;
  const maxBet = meta && meta.maxBetRatioBps > 0 ? (meta.pool * BigInt(meta.maxBetRatioBps)) / 10000n : 0n;
  const maxWin = meta && meta.maxWinBps > 0 ? (meta.pool * BigInt(meta.maxWinBps)) / 10000n : 0n;
  const potentialWei = meta ? (amountWei * BigInt(meta.multiplierBp)) / 10000n : 0n;
  const betLimitErr: string | null = (() => {
    if (!meta) return null;
    if (meta.pool <= 0n) return "Pool is empty — fund the pool first";
    if (amountWei <= 0n) return null;
    if (bal !== null && amountWei > bal) return "Not enough balance";
    if (amountWei < meta.minBet) return `Min bet ${fmtToken(meta.minBet, decimals, 4)} ${meta.symbol}`;
    if (maxBet > 0n && amountWei > maxBet) return `Max bet ${(meta.maxBetRatioBps / 100).toFixed(0)}% of pool · ${fmtToken(maxBet, decimals)} ${meta.symbol}`;
    if (maxWin > 0n && potentialWei - amountWei > maxWin) return `Max win ${(meta.maxWinBps / 100).toFixed(0)}% of pool`;
    return null;
  })();

  async function play() {
    setErr(null); setResult(null); setCoinResult(null); setSpinning(true);
    if (!w.address) { w.connect(); setSpinning(false); return; }
    if (!w.chainOk) { await w.switchChain(); setSpinning(false); return; }
    if (!w.signer || !meta) { setSpinning(false); return; }
    if (amountWei <= 0n) { setErr("Enter a bet amount."); setSpinning(false); return; }
    if (bal !== null && amountWei > bal) { setErr("Not enough balance."); setSpinning(false); return; }

    try {
      // 1) approve if needed
      if (needsApprove) {
        setPhase("approving");
        const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
        const tx = await erc.approve(address, amountWei);
        await tx.wait();
        setAllowance(amountWei);
      }

      // 2) commit
      setPhase("committing");
      const game = new Contract(address, COINFLIP_ABI, w.signer);
      const commitTx = await game.commitFlip(amountWei, choice);
      const rc = await commitTx.wait();
      // pull flipId from FlipCommitted event
      let flipId: bigint | null = null;
      for (const log of rc.logs) {
        try {
          const parsed = game.interface.parseLog(log);
          if (parsed?.name === "FlipCommitted") { flipId = parsed.args.flipId; break; }
        } catch { /* not ours */ }
      }
      if (flipId === null) { setErr("Commit landed but flipId not found — try reveal from history."); setPhase("idle"); setSpinning(false); return; }
      logBet({ wallet: w.address!, name: w.profile?.name, avatar: w.profile?.avatar, game: "Coinflip", gameKey: "coinflip", address, symbol: meta?.symbol, amount: Number(formatUnits(amountWei, decimals)) });

      // 3) wait until the reveal actually simulates cleanly on the fast RPC, then send.
      setPhase("waiting");
      setWaitInfo("");
      await waitRevealReady(address, COINFLIP_ABI, "revealFlip", flipId, rc.blockNumber as number, w.signer);

      // 4) reveal — explicit gas (fast-RPC estimate) so the wallet doesn't
      // re-simulate on its lagging node and hang. See sendGameTx.
      setPhase("revealing");
      const rrc = await sendGameTx(game, address, COINFLIP_ABI, "revealFlip", [flipId], w.address);
      let settled: { won: boolean; payout: bigint; result: number } | null = null;
      for (const log of rrc.logs) {
        try {
          const parsed = game.interface.parseLog(log);
          if (parsed?.name === "FlipSettled") {
            settled = { won: parsed.args.won, payout: parsed.args.payout, result: Number(parsed.args.result) };
            break;
          }
        } catch { /* not ours */ }
      }
      setResult(settled);
      if (settled) setCoinResult(settled.result); // coin decelerates to this face
      setPhase("done");
      loadAll();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Transaction failed.");
      setPhase("idle");
      setSpinning(false);
    }
  }

  const busy = phase !== "idle" && phase !== "done";

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      {/* main */}
      <div className="panel p-5">
        {/* coin */}
        <div className="flex flex-col items-center py-6">
          <CoinVisual spinning={spinning} result={coinResult} choice={choice}
            tokenLogoUrl={meta?.logo || ""} tokenSymbol={meta?.symbol || ""}
            onLand={() => setSpinning(false)} />
          {result && !spinning && (
            <div className={`mt-3 font-mono text-sm font-bold ${result.won ? "text-emerald-400" : "text-blood-400"}`}>
              {result.won ? `WON +${fmtToken(result.payout, decimals)} ${meta?.symbol}` : "LOST"}
            </div>
          )}
          {busy && <div className="mt-3 font-mono text-xs text-bone-500">{phaseLabel(phase)} {waitInfo && phase === "waiting" ? `· ${waitInfo}` : ""}</div>}
        </div>

        {/* choice */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([[0, "Heads"], [1, "Tails"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setChoice(v)} disabled={busy}
              className={`py-3 rounded-xl border font-semibold transition ${
                choice === v ? "border-blood-500 bg-blood-900/25 text-bone-100" : "border-ink-600 text-bone-400 hover:border-blood-500/50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* bet */}
        <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3 mb-3">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Bet</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Wallet size={11} /> {bal !== null ? fmtToken(bal, decimals) : "—"} {meta?.symbol}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal" placeholder="0.0" disabled={busy}
              className="flex-1 min-w-0 w-full bg-transparent outline-none text-xl font-mono tabular-nums" />
            <button onClick={() => bal && setAmount(formatUnits(bal, decimals))} disabled={busy || !bal}
              className="text-[10px] font-mono border border-ink-600 rounded-md px-2 py-1 hover:border-blood-500 hover:text-blood-400">MAX</button>
          </div>
          <div className="flex gap-1.5 mt-2">
            {["0.25", "0.5", "0.75", "1"].map((f) => (
              <button key={f} onClick={() => bal && setAmount(formatUnits(BigInt(Math.floor(Number(bal) * Number(f))), decimals))}
                disabled={busy || !bal}
                className="flex-1 text-[11px] font-mono border border-ink-600 rounded-md py-1 hover:border-blood-500 hover:text-blood-400 disabled:opacity-40">
                {f === "1" ? "MAX" : `${Number(f) * 100}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-bone-500 mb-3">
          <span>win pays {multiplier.toFixed(2)}×</span>
          <span>potential <span className="text-emerald-400">{potentialWin.toLocaleString(undefined, { maximumFractionDigits: 4 })} {meta?.symbol}</span></span>
        </div>

        {(betLimitErr || err) && <div className="text-blood-200 text-xs bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-3">{betLimitErr || err}</div>}

        <button onClick={play} disabled={busy || !!meta?.paused || !!betLimitErr}
          className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {meta?.paused ? "Game paused" :
            phase === "approving" ? "Approving…" :
            phase === "committing" ? "Placing bet…" :
            phase === "waiting" ? "Waiting for reveal block…" :
            phase === "revealing" ? "Revealing…" :
            needsApprove ? `Approve & flip` : "Flip the coin"}
        </button>
        <p className="mt-2 text-[10px] font-mono text-bone-600 text-center">
          two on-chain txs: bet, then reveal after {meta?.revealBlocks ?? 1} block. randomness = future block hash.
        </p>
      </div>

      {/* recent flips + chat tab */}
      <ControlsTabs>
      <div className="panel p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2">Recent flips</div>
        {recent.length === 0 && <div className="text-xs text-bone-600 font-mono">no flips yet.</div>}
        <div className="space-y-1.5">
          {recent.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {f.settled ? (
                f.won ? <Check size={13} className="text-emerald-400 shrink-0" /> : <X size={13} className="text-blood-400 shrink-0" />
              ) : <Loader2 size={12} className="text-bone-600 shrink-0" />}
              <span className="font-mono text-bone-400 truncate">{short(f.player)}</span>
              <span className="font-mono text-bone-500">{f.choice === 0 ? "H" : "T"}</span>
              <span className="ml-auto font-mono tabular-nums text-bone-300">{fmtToken(f.amount, decimals, 2)}</span>
              {f.settled && f.won && <span className="font-mono text-emerald-400 text-[10px]">+{fmtToken(f.payout, decimals, 1)}</span>}
            </div>
          ))}
        </div>
        {meta && (
          <div className="mt-3 pt-3 border-t border-ink-700/60 font-mono text-[11px] text-bone-500 space-y-1">
            <div className="flex justify-between"><span>pool</span><span className="text-bone-300">{fmtToken(meta.pool, decimals, 2)} {meta.symbol}</span></div>
            <div className="flex justify-between"><span>min bet</span><span className="text-bone-300">{fmtToken(meta.minBet, decimals, 4)}</span></div>
          </div>
        )}
      </div>
      </ControlsTabs>
    </div>
  );
}

function phaseLabel(p: Phase): string {
  switch (p) {
    case "approving": return "approving token…";
    case "committing": return "placing bet…";
    case "waiting": return "waiting for reveal block…";
    case "revealing": return "revealing result…";
    default: return "";
  }
}
