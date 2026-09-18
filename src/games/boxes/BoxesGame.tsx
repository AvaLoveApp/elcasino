import { useCallback, useEffect, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { Loader2, Wallet, Gift, Trophy } from "lucide-react";
import { useWallet } from "../../lib/wallet";
import { readProvider } from "../../lib/chain";
import { GAME_ERC20_ABI } from "../../lib/casinoGame";
import { logBet } from "../../lib/betfeed";
import { fmt, errMsg } from "../gameCore";
import boxesAbi from "../abi/BoxesGameV3.json";

const ABI = (boxesAbi as any).abi ?? (boxesAbi as any);
const TOTAL = 100;

type Round = { roundId: bigint; boxPrice: bigint; prizePool: bigint; boxesSold: number; settled: boolean };
type Meta = { symbol: string; decimals: number; token: string; logo: string };

import { ControlsTabs } from "../ControlsTabs";

export function BoxesGame({ address }: { address: string }) {
  const w = useWallet();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [myBoxes, setMyBoxes] = useState<Set<number>>(new Set());
  const [bal, setBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState(0n);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<"idle" | "approving" | "buying" | "claiming">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<{ revealed: boolean; winners: number[]; payouts: bigint[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const g = new Contract(address, ABI, readProvider);
      const [cr, gi] = await Promise.all([g.getCurrentRound(), g.getGameInfo()]);
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      const r: Round = { roundId: BigInt(cr[0]), boxPrice: BigInt(cr[1]), prizePool: BigInt(cr[2]), boxesSold: Number(cr[3]), settled: cr[4] };
      setMeta({ symbol, decimals: Number(decimals), token, logo: gi[2] });
      setRound(r);
      const own = await g.getBoxOwners(r.roundId).catch(() => []);
      setOwners((own as string[]).map((a) => (a || "").toLowerCase()));
      if (w.address) {
        const [b, a, mine] = await Promise.all([
          erc.balanceOf(w.address), erc.allowance(w.address, address),
          g.getUserBoxes(r.roundId, w.address).catch(() => []),
        ]);
        setBal(b); setAllowance(a);
        setMyBoxes(new Set((mine as any[]).map((x) => Number(x))));
      }
      if (r.settled) {
        const ri = await g.getRoundInfo(r.roundId).catch(() => null);
        if (ri) setInfo({ revealed: ri[4], winners: (ri[5] as any[]).map((x) => Number(x)), payouts: (ri[6] as any[]).map((x) => BigInt(x)) });
      } else setInfo(null);
    } catch { setErr("Could not load round."); }
  }, [address, w.address]);

  useEffect(() => { load(); }, [load]);

  const decimals = meta?.decimals ?? 18;
  const busy = phase !== "idle";
  const totalCost = round ? round.boxPrice * BigInt(sel.size) : 0n;
  const needsApprove = totalCost > 0n && allowance < totalCost;

  function toggle(i: number) {
    if (busy || !round || round.settled) return;
    const taken = owners[i] && owners[i] !== "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 42) && owners[i] !== "0x0000000000000000000000000000000000000000";
    if (taken) return;
    setSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  async function buy() {
    setErr(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer || !meta || !round) return;
    if (sel.size === 0) { setErr("Pick at least one box."); return; }
    if (bal !== null && totalCost > bal) { setErr("Not enough balance."); return; }
    try {
      if (needsApprove) {
        setPhase("approving");
        const erc = new Contract(meta.token, GAME_ERC20_ABI, w.signer);
        await (await erc.approve(address, totalCost)).wait();
        setAllowance(totalCost);
      }
      setPhase("buying");
      const g = new Contract(address, ABI, w.signer);
      await (await g.buyBoxes(Array.from(sel).sort((a, b) => a - b))).wait();
      logBet({ wallet: w.address!, name: w.profile?.name, avatar: w.profile?.avatar, game: "100 Boxes", gameKey: "boxes", address, symbol: meta?.symbol, amount: Number(formatUnits(totalCost, decimals)) });
      setSel(new Set()); setPhase("idle"); load();
    } catch (e: any) { setErr(errMsg(e)); setPhase("idle"); }
  }

  async function claim() {
    if (!w.signer || !round) return;
    setErr(null);
    try {
      setPhase("claiming");
      const g = new Contract(address, ABI, w.signer);
      await (await g.claimPrize(round.roundId)).wait();
      setPhase("idle"); load();
    } catch (e: any) { setErr(errMsg(e)); setPhase("idle"); }
  }

  const isZero = (a: string) => !a || /^0x0+$/.test(a);
  const soldPct = round ? (round.boxesSold / TOTAL) * 100 : 0;
  const myWin = info?.revealed ? info.winners.some((wb) => myBoxes.has(wb)) : false;

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <div className="panel p-4 sm:p-5 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 10%, #0e2a33 0%, #0a1a20 55%, #050d10 100%)" }}>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="font-mono text-xs text-bone-400">Round #{round ? round.roundId.toString() : "—"} · {round?.boxesSold ?? 0}/{TOTAL} sold</div>
            <div className="font-mono text-xs text-cyan-300">pool {round ? fmt(round.prizePool, decimals) : "—"} {meta?.symbol}</div>
          </div>
          <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden mb-4"><div className="h-full bg-cyan-500" style={{ width: `${soldPct}%` }} /></div>

          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => {
              const taken = !isZero(owners[i] || "");
              const mine = myBoxes.has(i);
              const picked = sel.has(i);
              const placement = info?.revealed ? info.winners.indexOf(i) : -1;
              return (
                <button key={i} onClick={() => toggle(i)} disabled={busy || taken || (round?.settled ?? false)}
                  className={`relative aspect-square rounded-lg text-[8px] font-mono grid place-items-center border transition-all overflow-hidden ${
                    placement >= 0 ? "bg-yellow-400/25 border-yellow-400/60" :
                    picked ? "bg-accent-green/25 border-accent-green/60 text-accent-green" :
                    mine ? "bg-blue-500/20 border-blue-400/40 text-blue-300" :
                    taken ? "bg-purple-500/15 border-purple-400/25 text-purple-300/70" :
                    "bg-black/60 border-ink-600 hover:border-accent-green/50 hover:scale-105 text-bone-600"}`}>
                  {placement >= 0 ? <span className="text-sm relative z-10">{["🥇", "🥈", "🥉"][placement]}</span>
                    : (mine || picked || taken) && meta?.logo ? (
                      <img src={meta.logo} alt="" className={`absolute inset-0 w-full h-full object-cover ${mine ? "opacity-90 ring-2 ring-blue-400/60" : picked ? "opacity-90 ring-2 ring-accent-green/60" : "opacity-40"}`}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : picked ? "✓" : mine ? "YOU" : taken ? (owners[i] || "").slice(2, 5) : i}
                </button>
              );
            })}
          </div>

          {/* legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[10px] text-bone-500 font-mono">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500/30 border border-blue-400/30" /> Yours</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-500/20 border border-purple-400/20" /> Others</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-accent-green/20 border border-accent-green/50" /> Selected</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-400/30 border border-yellow-400/50" /> Winner</span>
          </div>

          {/* prize distribution */}
          <div className="mt-3 rounded-xl border border-ink-700/60 bg-black/40 p-2.5 flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="text-[10px] text-bone-500 uppercase tracking-wider font-bold">Prizes</span>
            <span className="flex items-center gap-1">🥇 50%</span>
            <span className="flex items-center gap-1">🥈 25%</span>
            <span className="flex items-center gap-1">🥉 10%</span>
            <span className="flex items-center gap-1 text-bone-500">📦 Others 15%</span>
          </div>

          {info?.revealed && (
            <div className="mt-3 flex items-center gap-2 font-mono text-xs">
              <Trophy size={14} className="text-amber-300" />
              <span className="text-amber-300">🥇 #{info.winners[0]} · 🥈 #{info.winners[1]} · 🥉 #{info.winners[2]}</span>
            </div>
          )}
        </div>
      </div>

      <ControlsTabs>
        <div className="panel p-4">
          <div className="flex justify-between text-xs text-bone-500 mb-1">
            <span>Box price</span>
            <span className="inline-flex items-center gap-1 font-mono"><Wallet size={11} /> {bal !== null ? fmt(bal, decimals) : "—"} {meta?.symbol}</span>
          </div>
          <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-2.5 font-mono text-lg">
            {round ? fmt(round.boxPrice, decimals, 4) : "—"} <span className="text-bone-500 text-sm">{meta?.symbol}</span>
          </div>

          <div className="border-t border-ink-700 mt-3 pt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between"><span className="text-bone-500">Selected</span><span className="text-bone-100">{sel.size} boxes</span></div>
            <div className="flex justify-between"><span className="text-bone-500">Total cost</span><span className="text-cyan-300">{fmt(totalCost, decimals)} {meta?.symbol}</span></div>
          </div>

          {!round?.settled && (
            <div className="flex items-center gap-1.5 mt-3">
              <button onClick={() => { const a = new Set<number>(); for (let i = 0; i < TOTAL; i++) if (isZero(owners[i] || "")) a.add(i); setSel(a); }}
                className="text-[10px] font-mono px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20">All</button>
              {[5, 10].map((n) => (
                <button key={n} onClick={() => { const av: number[] = []; for (let i = 0; i < TOTAL; i++) if (isZero(owners[i] || "")) av.push(i); setSel(new Set([...av].sort(() => Math.random() - 0.5).slice(0, Math.min(n, av.length)))); }}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20">Rnd {n}</button>
              ))}
              {sel.size > 0 && <button onClick={() => setSel(new Set())} className="text-[10px] font-mono px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">Clear</button>}
            </div>
          )}

          {err && <div className="text-blood-200 text-xs mt-2">{err}</div>}

          {info?.revealed && myWin ? (
            <button onClick={claim} disabled={busy} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2">
              {busy && <Loader2 size={15} className="animate-spin" />}<Trophy size={15} /> Claim prize
            </button>
          ) : round?.settled ? (
            <div className="text-center text-bone-500 text-xs font-mono py-3">Round settled — next round opening.</div>
          ) : (
            <button onClick={buy} disabled={busy || sel.size === 0} className="btn-primary w-full py-3 mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy && <Loader2 size={15} className="animate-spin" />}<Gift size={15} /> {busy ? "…" : needsApprove ? "Approve & buy" : `Buy ${sel.size || ""} box${sel.size === 1 ? "" : "es"}`}
            </button>
          )}
        </div>

        <div className="panel p-3 font-mono text-[11px] text-bone-500">
          <div className="uppercase tracking-wider text-[10px] mb-1.5">How it works</div>
          buy boxes in the current round of 100. when all boxes sell, three winning boxes are drawn on-chain from a future block hash — 1st / 2nd / 3rd split the pool. own a winning box → claim.
        </div>
      </ControlsTabs>
    </div>
  );
}
