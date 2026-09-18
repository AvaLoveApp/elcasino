import { useCallback, useEffect, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { Loader2, Clock } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readProvider } from "../lib/chain";
import { GAME_ERC20_ABI } from "../lib/casinoGame";
import { fmtAmount } from "../lib/util";
import { waitRevealReady, errMsg, sendGameTx } from "./gameCore";
import { GameKey } from "../lib/casino";
import rouletteAbi from "./abi/RouletteGameV3.json";
import diceAbi from "./abi/DiceGameV3.json";
import crashAbi from "./abi/CrashGameV3.json";
import wheelAbi from "./abi/WheelGameV3.json";
import slotAbi from "./abi/SlotGameV3.json";
import plinkoAbi from "./abi/PlinkoGameV3.json";
import minesAbi from "./abi/MinesGameV3.json";

const raw = (j: any) => (j.abi ?? j);
// Per-game noun → derives getUser{Noun}Count / getUser{Noun}s / user{Noun}s / reveal{Noun} / forfeit{Noun}
const CFG: Partial<Record<GameKey, { abi: any; noun: string }>> = {
  roulette: { abi: raw(rouletteAbi), noun: "Bet" },
  dice: { abi: raw(diceAbi), noun: "Roll" },
  crash: { abi: raw(crashAbi), noun: "Bet" },
  wheel: { abi: raw(wheelAbi), noun: "Spin" },
  slots: { abi: raw(slotAbi), noun: "Spin" },
  plinko: { abi: raw(plinkoAbi), noun: "Drop" },
  mines: { abi: raw(minesAbi), noun: "Game" },
};

// Reveal must land within ~256 blocks of the commit block or the block hash ages
// out; past that the bet can only be forfeited (stake returned minus fee).
const FORFEIT_AFTER = 256;

type Row = { id: bigint; settled: boolean; won: boolean; amount: bigint; payout: bigint; commitBlock: number };

export function PendingBets({ gameKey, address, reloadSignal }: { gameKey: GameKey; address: string; reloadSignal?: string }) {
  const cfg = CFG[gameKey];
  const w = useWallet();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<{ symbol: string; decimals: number } | null>(null);
  const [curBlock, setCurBlock] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cfg || !w.address) { setRows([]); return; }
    try {
      const g = new Contract(address, cfg.abi, readProvider);
      const n = cfg.noun, plural = n + "s";
      if (!meta) {
        try { const gi = await g.getGameInfo(); const erc = new Contract(gi[1], GAME_ERC20_ABI, readProvider); const [sym, dec] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]); setMeta({ symbol: sym, decimals: Number(dec) }); } catch {}
      }
      const count = Number(await g[`getUser${n}Count`](w.address));
      if (!count) { setRows([]); return; }
      const N = Math.min(15, count);
      const offset = count - N;
      const structs = await g[`getUser${plural}`](w.address, offset, N);
      const ids = await Promise.all(Array.from({ length: N }, (_, i) => g[`user${plural}`](w.address, offset + i)));
      setCurBlock(await readProvider.getBlockNumber());
      const out: Row[] = structs.map((s: any, i: number) => ({
        id: BigInt(ids[i]), settled: !!(s.settled), won: !!(s.won),
        amount: BigInt(s.amount ?? 0), payout: BigInt(s.payout ?? 0), commitBlock: Number(s.commitBlock ?? 0),
      })).reverse();
      setRows(out);
    } catch { setRows([]); }
  }, [address, w.address, cfg, meta]);

  useEffect(() => { load(); }, [load, reloadSignal]);

  if (!cfg || rows === null) return null;
  const pending = rows.filter((r) => !r.settled);
  const history = rows.filter((r) => r.settled).slice(0, 6);
  if (pending.length === 0 && history.length === 0) return null;
  const d = meta?.decimals ?? 18;
  const sym = meta?.symbol ?? "";
  const fmtA = (v: bigint) => fmtAmount(Number(formatUnits(v, d)));

  async function reveal(id: bigint, commitBlock: number) {
    if (!w.signer || !cfg) return;
    setErr(null); setBusy(id.toString());
    try {
      await waitRevealReady(address, cfg.abi, `reveal${cfg.noun}`, id, commitBlock, w.signer);
      const g = new Contract(address, cfg.abi, w.signer);
      await sendGameTx(g, address, cfg.abi, `reveal${cfg.noun}`, [id], w.address);
      load();
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(null); }
  }
  async function forfeit(id: bigint) {
    if (!w.signer || !cfg) return;
    setErr(null); setBusy(id.toString());
    try {
      const g = new Contract(address, cfg.abi, w.signer);
      await sendGameTx(g, address, cfg.abi, `forfeit${cfg.noun}`, [id], w.address);
      load();
    }
    catch (e: any) { setErr(errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <div className="panel p-4 max-w-3xl mx-auto mt-4">
      {pending.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 inline-flex items-center gap-1 mb-2"><Loader2 size={11} className="animate-spin" /> Pending reveals · {pending.length}</div>
          <div className="space-y-1.5">
            {pending.map((p) => {
              const age = curBlock - p.commitBlock;
              const expired = age > FORFEIT_AFTER;
              const b = busy === p.id.toString();
              return (
                <div key={p.id.toString()} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-bone-400">#{p.id.toString()}</span>
                  <span className="text-bone-300">{fmtA(p.amount)} {sym}</span>
                  <span className="text-bone-600 inline-flex items-center gap-1"><Clock size={9} /> {age < 0 ? 0 : age} blk</span>
                  <div className="ml-auto flex gap-1.5">
                    {expired ? (
                      <button onClick={() => forfeit(p.id)} disabled={b} className="px-2.5 py-1 rounded bg-blood-500/15 text-blood-300 border border-blood-500/30 hover:bg-blood-500/25 disabled:opacity-50 inline-flex items-center gap-1">
                        {b && <Loader2 size={10} className="animate-spin" />} Forfeit
                      </button>
                    ) : (
                      <button onClick={() => reveal(p.id, p.commitBlock)} disabled={b} className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 inline-flex items-center gap-1">
                        {b && <Loader2 size={10} className="animate-spin" />} Reveal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {err && <div className="text-blood-200 text-[11px] mt-1.5">{err}</div>}
          <div className="text-[9px] font-mono text-bone-600 mt-1.5">Reveal within {FORFEIT_AFTER} blocks of the commit, or forfeit to reclaim your stake.</div>
        </div>
      )}
      {history.length > 0 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2">Your recent bets</div>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id.toString()} className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-bone-400">#{h.id.toString()} · {fmtA(h.amount)} {sym}</span>
                <span className={h.won ? "text-emerald-400" : "text-bone-600"}>{h.won ? `+${fmtA(h.payout)}` : `−${fmtA(h.amount)}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
