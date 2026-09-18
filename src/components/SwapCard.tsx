import { useState, useMemo, useEffect } from "react";
import { parseEther, parseUnits, formatEther } from "ethers";
import { ArrowDownUp, Wallet } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { ADDR, readProvider, TOKEN_SYMBOL } from "../lib/chain";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark, MidMark } from "./UnitMark";

// UniswapV2 getAmountOut (0.3% pool fee).
function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  const inWithFee = amountIn * 997;
  return (inWithFee * reserveOut) / (reserveIn * 1000 + inWithFee);
}

export function SwapCard({ poolEth, poolMid, buyFeeBps, sellFeeBps, price, balance, onSwapped }: {
  poolEth: number; poolMid: number; buyFeeBps: number; sellFeeBps: number;
  price: number;             // ETH per MIDGARD
  balance: number | null;    // wallet MIDGARD balance
  onSwapped: () => void;
}) {
  const w = useWallet();
  const [buy, setBuy] = useState(true);
  const [amount, setAmount] = useState("");
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Live ETH balance for the "You pay" side when buying.
  useEffect(() => {
    let live = true;
    if (!w.address) { setEthBalance(null); return; }
    readProvider.getBalance(w.address).then((v) => {
      if (live) setEthBalance(Number(formatEther(v)));
    }).catch(() => {});
    return () => { live = false; };
  }, [w.address, ok]);

  const amt = parseFloat(amount) || 0;
  const tokenFee = (buy ? buyFeeBps : sellFeeBps) / 10000;
  const payBal = buy ? ethBalance : balance;
  const paySym = buy ? "ETH" : TOKEN_SYMBOL;
  const recvSym = buy ? TOKEN_SYMBOL : "ETH";

  const estOut = useMemo(() => {
    if (!amt || !poolEth || !poolMid) return 0;
    if (buy) return getAmountOut(amt, poolEth, poolMid) * (1 - tokenFee);
    return getAmountOut(amt * (1 - tokenFee), poolMid, poolEth);
  }, [amt, buy, poolEth, poolMid, tokenFee]);

  function setPct(p: number) {
    const bal = buy ? ethBalance : balance;
    if (bal == null || bal <= 0) return;
    // On MAX: buying leaves a little ETH for gas; selling MIDGARD leaves a 0.1%
    // buffer because the balance keeps decaying — an exact-balance sell would
    // revert (settle-decay shrinks it below `amount` before the transfer check).
    const usable = p >= 1 ? (buy ? Math.max(0, bal - 0.001) : bal * 0.999) : bal;
    const v = usable * p;
    if (v <= 0) return;
    // Adaptive precision so small balances don't round to "0.00" and vanish.
    const dp = buy ? (v < 0.01 ? 8 : 6) : (v < 1 ? 6 : 2);
    setAmount(String(Number(v.toFixed(dp))));
  }

  async function swap() {
    setErr(null); setOk(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!amt) return;
    const router = w.routerWrite();
    if (!router) return;
    setBusy(true);
    try {
      const deadline = Math.floor(Date.now() / 1000) + 600;
      if (buy) {
        const path = [ADDR.weth, ADDR.token];
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0n, path, w.address, deadline, { value: parseEther(amount) });
        await tx.wait();
      } else {
        const amountIn = parseUnits(amount, 18);
        const token = w.tokenWrite()!;
        const cur: bigint = await token.allowance(w.address, ADDR.router);
        if (cur < amountIn) {
          const ap = await token.approve(ADDR.router, amountIn);
          await ap.wait();
        }
        const path = [ADDR.token, ADDR.weth];
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn, 0n, path, w.address, deadline);
        await tx.wait();
      }
      setOk("Swap complete.");
      setAmount("");
      onSwapped();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Swap failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="panel p-4 sm:p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold inline-flex items-center gap-1.5"><MidMark />Swap {TOKEN_SYMBOL}</h3>
        <span className="font-mono text-[11px] text-bone-600 inline-flex items-center gap-0.5">1 <MidMark />{TOKEN_SYMBOL} ≈ {fmtPrice(price)} <EthMark />ETH</span>
      </div>

      {/* Buy / Sell segmented control */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-900/70 border border-ink-700/70 p-1 mb-3">
        <button onClick={() => { setBuy(true); setAmount(""); }}
          className={`py-1.5 rounded-lg text-sm font-semibold transition ${buy ? "bg-emerald-600/90 text-white shadow-sm" : "text-bone-400 hover:text-bone-100"}`}>Buy</button>
        <button onClick={() => { setBuy(false); setAmount(""); }}
          className={`py-1.5 rounded-lg text-sm font-semibold transition ${!buy ? "bg-blood-600/90 text-white shadow-sm" : "text-bone-400 hover:text-bone-100"}`}>Sell</button>
      </div>

      {/* Pay */}
      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between text-xs text-bone-400 mb-1">
          <span>You pay</span>
          <span className="inline-flex items-center gap-1">
            <Wallet size={11} />
            {payBal === null ? "—" : buy ? payBal.toFixed(4) : fmtInt(payBal)} <span className="inline-flex items-center gap-0.5">{paySym === "ETH" ? <EthMark /> : <MidMark />}{paySym}</span>
          </span>
        </div>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal" placeholder="0.0"
          className="w-full bg-transparent outline-none text-2xl font-mono tabular-nums" />
        <div className="flex gap-1.5 mt-2">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <button key={p} onClick={() => setPct(p)} disabled={!payBal}
              className="flex-1 text-[11px] font-mono border border-ink-600 rounded-md py-1 hover:border-blood-500 hover:text-blood-400 transition disabled:opacity-40">
              {p === 1 ? "MAX" : `${p * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center -my-2.5 relative z-10">
        <button onClick={() => { setBuy((b) => !b); setAmount(""); }}
          className="rounded-full border border-ink-600 bg-ink-850 p-2 hover:border-blood-500 hover:text-blood-400 transition">
          <ArrowDownUp size={16} />
        </button>
      </div>

      {/* Receive */}
      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between text-xs text-bone-400 mb-1">
          <span>You receive (est.)</span><span className="inline-flex items-center gap-0.5">{recvSym === "ETH" ? <EthMark /> : <MidMark />}{recvSym}</span>
        </div>
        <div className="text-2xl font-mono tabular-nums text-bone-200">
          {estOut ? (buy ? fmtInt(estOut) : estOut.toFixed(6)) : "0.0"}
        </div>
      </div>

      <p className="text-[11px] text-bone-600 font-mono mt-2 leading-relaxed">
        includes the {(tokenFee * 100).toFixed(0)}% {buy ? "buy" : "sell"} fee (reflected to holders) + 0.3% pool fee.
        the pool burns faster than holders (φ-adaptive) → price↑. min received is 0 — expect slippage on a shallow pool.
      </p>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mt-3">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mt-3">{ok}</div>}

      <button onClick={swap} disabled={busy || !amt}
        className={`w-full mt-3 py-3 rounded-xl font-semibold text-white transition disabled:opacity-40 ${buy ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blood-600 hover:bg-blood-500"}`}>
        {busy ? "Confirm in wallet…" : !w.address ? "Connect wallet" : buy ? `Buy ${TOKEN_SYMBOL}` : `Sell ${TOKEN_SYMBOL}`}
      </button>
    </div>
  );
}
