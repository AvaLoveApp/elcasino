import { useEffect, useState, useCallback } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { Loader2, TrendingUp, Coins } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readProvider } from "../lib/chain";
import { GAME_ERC20_ABI } from "../lib/casinoGame";
import { sendGameTx } from "./gameCore";
import { short, fmtAmount } from "../lib/util";

// Shared staking surface — every V3 game is an LP vault: stake the bet token to
// earn a share of the house fees. Ported from Avlo's Earn tab.
const STAKE_ABI = [
  "function stake(uint256 amount)",
  "function unstake(uint256 shares)",
  "function claimFees()",
  "function getStakerInfo(address staker) view returns (uint256 shares, uint256 stakeValue, uint256 pendingFees, uint256 sharePercent)",
  "function poolBalance() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function totalVolume() view returns (uint256)",
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
];

type Info = {
  symbol: string; decimals: number; token: string; logo: string;
  pool: bigint; totalShares: bigint; totalVolume: bigint; stakerCount: number;
  bal: bigint | null; allowance: bigint;
  myShares: bigint; myValue: bigint; myPending: bigint; mySharePct: bigint;
};

export function GameEarnTab({ address }: { address: string }) {
  const w = useWallet();
  const [info, setInfo] = useState<Info | null>(null);
  const [stakeAmt, setStakeAmt] = useState("");
  const [unstakeShares, setUnstakeShares] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const g = new Contract(address, STAKE_ABI, readProvider);
      const gi = await g.getGameInfo();
      const token = gi[1];
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const [symbol, decimals] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      let bal: bigint | null = null, allowance = 0n, myShares = 0n, myValue = 0n, myPending = 0n, mySharePct = 0n;
      if (w.address) {
        const [b, a, si] = await Promise.all([
          erc.balanceOf(w.address), erc.allowance(w.address, address),
          g.getStakerInfo(w.address).catch(() => [0n, 0n, 0n, 0n]),
        ]);
        bal = b; allowance = a;
        myShares = si[0]; myValue = si[1]; myPending = si[2]; mySharePct = si[3];
      }
      setInfo({
        symbol, decimals: Number(decimals), token, logo: gi[2],
        pool: gi[4], totalShares: gi[10], totalVolume: gi[6], stakerCount: Number(gi[11]),
        bal, allowance, myShares, myValue, myPending, mySharePct,
      });
    } catch { setErr("Could not load staking info."); }
  }, [address, w.address]);

  useEffect(() => { load(); }, [load]);

  if (!info) return <div className="panel p-6 text-center text-bone-500"><Loader2 className="animate-spin mx-auto" /></div>;
  const d = info.decimals;
  const stakeWei = (() => { try { return stakeAmt ? parseUnits(stakeAmt, d) : 0n; } catch { return 0n; } })();
  const needsApprove = stakeWei > 0n && info.allowance < stakeWei;

  async function doStake() {
    setErr(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer || !info) return;
    if (stakeWei <= 0n) { setErr("Enter an amount."); return; }
    try {
      if (needsApprove) {
        setBusy("approving…");
        const erc = new Contract(info.token, GAME_ERC20_ABI, w.signer);
        await sendGameTx(erc, info.token, GAME_ERC20_ABI, "approve", [address, stakeWei], w.address);
      }
      setBusy("staking…");
      const g = new Contract(address, STAKE_ABI, w.signer);
      await sendGameTx(g, address, STAKE_ABI, "stake", [stakeWei], w.address);
      setStakeAmt(""); setBusy(null); load();
    } catch (e: any) { setErr(errMsg(e)); setBusy(null); }
  }

  async function doUnstake() {
    setErr(null);
    if (!w.signer || !info) return;
    let sharesWei = 0n;
    try { sharesWei = parseUnits(unstakeShares || "0", d); } catch { return; }
    if (sharesWei <= 0n) { setErr("Enter shares."); return; }
    try {
      setBusy("unstaking…");
      const g = new Contract(address, STAKE_ABI, w.signer);
      await sendGameTx(g, address, STAKE_ABI, "unstake", [sharesWei], w.address);
      setUnstakeShares(""); setBusy(null); load();
    } catch (e: any) { setErr(errMsg(e)); setBusy(null); }
  }

  async function doClaim() {
    setErr(null);
    if (!w.signer) return;
    try {
      setBusy("claiming…");
      const g = new Contract(address, STAKE_ABI, w.signer);
      await sendGameTx(g, address, STAKE_ABI, "claimFees", [], w.address);
      setBusy(null); load();
    } catch (e: any) { setErr(errMsg(e)); setBusy(null); }
  }

  const estUnstake = (() => {
    try {
      const s = parseUnits(unstakeShares || "0", d);
      if (info.totalShares > 0n) return (s * info.pool) / info.totalShares;
    } catch {}
    return 0n;
  })();

  return (
    <div className="space-y-4">
      {/* header stats */}
      <div className="panel p-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-bone-500 font-mono mb-1">Total volume</div>
          <div className="text-2xl font-bold font-mono text-bone-50">{fmt(info.totalVolume, d)} <span className="text-sm text-bone-500">{info.symbol}</span></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-bone-500 font-mono mb-1">Stakers</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{info.stakerCount}</div>
        </div>
      </div>

      {/* your position */}
      {info.myShares > 0n && (
        <div className="panel p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Your position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Shares" value={fmt(info.myShares, d)} />
            <Stat label="Value" value={`${fmt(info.myValue, d)} ${info.symbol}`} accent="emerald" />
            <Stat label="Pool share" value={`${(Number(info.mySharePct) / 100).toFixed(2)}%`} />
            <div className="rounded-lg bg-amber-900/10 border border-amber-500/20 p-3">
              <div className="text-[10px] text-bone-500 uppercase tracking-wider mb-1">Pending fees</div>
              <div className="text-base font-bold text-amber-300 font-mono">{fmt(info.myPending, d)} {info.symbol}</div>
              {info.myPending > 0n && (
                <button onClick={doClaim} disabled={!!busy}
                  className="w-full mt-2 py-1.5 text-[11px] font-mono uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
                  Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* stake + unstake */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Stake tokens</h3>
          <div className="relative">
            <input value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00" inputMode="decimal"
              className="w-full bg-ink-900 border border-ink-600 rounded-xl px-4 py-3 font-mono text-lg outline-none focus:border-emerald-500/50" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bone-400 text-sm font-mono">{info.symbol}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-bone-500 mt-2 font-mono">
            <span>Balance: {info.bal !== null ? fmt(info.bal, d) : "—"}</span>
            <button onClick={() => info.bal && setStakeAmt(formatUnits(info.bal, d))} className="text-emerald-400 hover:underline">[max]</button>
          </div>
          {err && <div className="text-blood-200 text-xs mt-2">{err}</div>}
          <button onClick={doStake} disabled={!!busy}
            className="w-full mt-3 py-3 font-mono uppercase font-bold text-sm rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy || (needsApprove ? "Approve & stake" : "Stake")}
          </button>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Unstake</h3>
          {info.myShares > 0n ? (
            <>
              <div className="relative">
                <input value={unstakeShares} onChange={(e) => setUnstakeShares(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00" inputMode="decimal"
                  className="w-full bg-ink-900 border border-ink-600 rounded-xl px-4 py-3 font-mono text-lg outline-none focus:border-blood-500/50" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bone-400 text-sm font-mono">shares</span>
              </div>
              <div className="flex items-center justify-between text-xs text-bone-500 mt-2 font-mono">
                <span>Your shares: {fmt(info.myShares, d)}</span>
                <button onClick={() => setUnstakeShares(formatUnits(info.myShares, d))} className="text-emerald-400 hover:underline">[max]</button>
              </div>
              {estUnstake > 0n && (
                <div className="rounded-lg bg-emerald-900/10 border border-emerald-500/20 px-3 py-2 mt-2 font-mono text-xs">
                  <span className="text-bone-500">≈ receive </span>
                  <span className="text-emerald-300 font-bold">{fmt(estUnstake, d)} {info.symbol}</span>
                </div>
              )}
              <button onClick={doUnstake} disabled={!!busy}
                className="w-full mt-3 py-3 font-mono uppercase font-bold text-sm rounded-xl bg-blood-500/10 text-blood-400 border border-blood-500/20 hover:bg-blood-500/20 disabled:opacity-50">
                Unstake
              </button>
            </>
          ) : (
            <div className="text-bone-500 text-sm text-center py-8 font-mono">No staked position.</div>
          )}
        </div>
      </div>

      {/* pool info */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Pool information</h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pool balance" value={`${fmt(info.pool, d)} ${info.symbol}`} />
          <Stat label="Total shares" value={fmt(info.totalShares, d)} />
          <Stat label="Stakers" value={String(info.stakerCount)} />
        </div>
        <p className="mt-3 font-mono text-[10px] text-bone-500 leading-relaxed">
          Stake the bet token to become the house. You earn a pro-rata share of every fee the game collects. Unstake anytime for your share of the pool.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" }) {
  return (
    <div className="rounded-lg bg-ink-900/50 border border-ink-700/70 p-3">
      <div className="text-[10px] text-bone-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-base font-bold font-mono ${accent === "emerald" ? "text-emerald-400" : "text-bone-100"}`}>{value}</div>
    </div>
  );
}

function fmt(v: bigint, d = 18, _mx = 2) { return fmtAmount(Number(formatUnits(v, d))); }
function errMsg(e: any) { return e?.shortMessage || e?.reason || e?.message || "Failed."; }
