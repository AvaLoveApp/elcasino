import { useEffect, useState } from "react";
import { Contract, formatUnits, parseUnits, parseEther, formatEther, MaxUint256 } from "ethers";
import { ArrowDownUp, Wallet, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readProvider } from "../lib/chain";
import { tokenDecimals } from "../lib/casino";
import { fmtInt } from "../lib/util";
import { EthMark } from "./UnitMark";
import { lifiQuote, lifiImpactPct, LIFI_NATIVE, type LifiQuote } from "../lib/lifi";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const SLIPPAGES = [0.5, 1, 3] as const;

/**
 * ETH ↔ token swap for Robinhood-chain casino tokens, routed through the LI.FI
 * aggregator. These tokens' liquidity sits on Uniswap v4 / v3 / KyberSwap etc.
 * which a plain V2 router can't reach, so LI.FI finds the best venue and hands
 * back both a quote and a ready-to-send transaction. Real quote, slippage,
 * min-received and price impact — for any casino token.
 */
export function CasinoTokenSwap({ token, symbol, priceUsd, onSwapped }: {
  token: string; symbol: string; priceUsd?: number; onSwapped?: () => void;
}) {
  const w = useWallet();
  const [buy, setBuy] = useState(true); // buy = ETH → token
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState(1);
  const [dec, setDec] = useState(18);
  const [ethBal, setEthBal] = useState<number | null>(null);
  const [tokBal, setTokBal] = useState<number | null>(null);
  const [quote, setQuote] = useState<LifiQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const recvSym = buy ? symbol : "ETH";
  const outDec = buy ? dec : 18;               // output token's decimals
  const fromToken = buy ? LIFI_NATIVE : token; // ETH → token, or token → ETH
  const toToken = buy ? token : LIFI_NATIVE;

  useEffect(() => { let live = true; tokenDecimals(token).then((d) => { if (live) setDec(d); }); return () => { live = false; }; }, [token]);

  useEffect(() => {
    let live = true;
    const addr = w.address;
    if (!addr) { setEthBal(null); setTokBal(null); return; }
    (async () => {
      try {
        const [eb, tb] = await Promise.all([
          readProvider.getBalance(addr),
          new Contract(token, ERC20_ABI, readProvider).balanceOf(addr),
        ]);
        if (live) { setEthBal(Number(formatEther(eb))); setTokBal(Number(formatUnits(tb, dec))); }
      } catch {}
    })();
    return () => { live = false; };
  }, [w.address, token, dec, ok]);

  const amt = parseFloat(amount) || 0;
  // Live LI.FI quote (debounced). Works without a connected wallet (uses a
  // placeholder address for the estimate); the swap re-quotes with the real one.
  useEffect(() => {
    let live = true;
    setErr(null);
    if (amt <= 0) { setQuote(null); setQuoting(false); return; }
    setQuoting(true);
    const h = setTimeout(async () => {
      try {
        const fromAmount = buy ? parseEther(amount) : parseUnits(amount, dec);
        const q = await lifiQuote({ fromToken, toToken, fromAmount, fromAddress: w.address || undefined, slippage: slip / 100 });
        if (live) { setQuote(q); setQuoting(false); }
      } catch (e: any) {
        if (live) { setQuote(null); setQuoting(false); setErr(e?.message || "No route for this pair right now."); }
      }
    }, 400);
    return () => { live = false; clearTimeout(h); };
  }, [amount, buy, dec, token, slip, w.address]);

  const outN = quote ? Number(formatUnits(quote.toAmount, outDec)) : 0;
  const minOutN = quote ? Number(formatUnits(quote.toAmountMin, outDec)) : 0;
  const impact = quote ? lifiImpactPct(quote) : null;
  const payBal = buy ? ethBal : tokBal;

  function setPct(p: number) {
    if (payBal == null || payBal <= 0) return;
    const usable = p >= 1 ? (buy ? Math.max(0, payBal - 0.001) : payBal * 0.999) : payBal;
    const v = usable * p;
    if (v <= 0) return;
    setAmount(String(Number(v.toFixed(buy ? 6 : (dec < 6 ? dec : 6)))));
  }

  async function swap() {
    setErr(null); setOk(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (amt <= 0) return;
    if (!w.signer) { setErr("Wallet not ready."); return; }
    setBusy(true);
    try {
      const fromAmount = buy ? parseEther(amount) : parseUnits(amount, dec);
      // Re-quote with the real sender so the transactionRequest is valid for them.
      const q = await lifiQuote({ fromToken, toToken, fromAmount, fromAddress: w.address, slippage: slip / 100 });
      // ERC-20 sell → ensure the LI.FI spender is approved.
      if (!buy) {
        const erc = new Contract(token, ERC20_ABI, w.signer);
        const cur: bigint = await erc.allowance(w.address, q.approvalAddress);
        if (cur < fromAmount) { const ap = await erc.approve(q.approvalAddress, MaxUint256); await ap.wait(); }
      }
      if (!q.tx.to || !q.tx.data) throw new Error("LI.FI returned no transaction.");
      const tx = await w.signer.sendTransaction({
        to: q.tx.to,
        data: q.tx.data,
        value: q.tx.value ? BigInt(q.tx.value) : 0n,
      });
      await tx.wait();
      setOk(`Swapped ${buy ? "ETH → " + symbol : symbol + " → ETH"}`);
      setAmount(""); setQuote(null); onSwapped?.();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Swap failed");
    } finally { setBusy(false); }
  }

  const receiveStr = quote ? (buy ? fmtInt(outN) : outN.toFixed(6)) : quoting ? "…" : "0.0";

  return (
    <div className="panel p-4 sm:p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Buy / Sell {symbol}</h3>
        {priceUsd ? <span className="font-mono text-[11px] text-bone-600">${priceUsd < 1 ? priceUsd.toPrecision(3) : priceUsd.toFixed(2)}</span> : null}
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between text-xs text-bone-400 mb-1">
          <span>You pay ({buy ? "ETH" : symbol})</span>
          <span className="inline-flex items-center gap-1"><Wallet size={11} />{payBal === null ? "—" : buy ? payBal.toFixed(4) : fmtInt(payBal)}</span>
        </div>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal" placeholder="0.0" className="w-full bg-transparent outline-none text-2xl font-mono tabular-nums text-bone-50" />
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
        <button onClick={() => { setBuy((b) => !b); setAmount(""); setQuote(null); }}
          className="rounded-full border border-ink-600 bg-ink-850 p-2 hover:border-blood-500 hover:text-blood-400 transition"><ArrowDownUp size={16} /></button>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between text-xs text-bone-400 mb-1"><span>You receive (est.)</span><span className="inline-flex items-center gap-0.5">{buy ? symbol : <><EthMark />ETH</>}</span></div>
        <div className="text-2xl font-mono tabular-nums text-bone-200 inline-flex items-center gap-2">
          {receiveStr}{quoting && <Loader2 size={14} className="animate-spin text-bone-500" />}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-ink-700/70 bg-ink-900/50 p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-bone-500">Slippage</span>
          <div className="inline-flex rounded-md border border-ink-600 overflow-hidden">
            {SLIPPAGES.map((sv) => (
              <button key={sv} onClick={() => setSlip(sv)} className={`px-2 py-0.5 ${slip === sv ? "bg-ink-700 text-bone-100" : "text-bone-400 hover:text-bone-100"}`}>{sv}%</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono"><span className="text-bone-500">Min received</span><span className="text-bone-200">{minOutN > 0 ? (buy ? fmtInt(minOutN) : minOutN.toFixed(6)) : "—"} {recvSym}</span></div>
        <div className="flex items-center justify-between text-[11px] font-mono"><span className="text-bone-500">Price impact</span><span className={impact != null && impact >= 5 ? "text-danger-300" : impact != null && impact >= 1 ? "text-amber-300" : "text-emerald-300"}>{impact != null ? impact.toFixed(2) + "%" : "—"}</span></div>
        <div className="flex items-center justify-between text-[11px] font-mono"><span className="text-bone-500">Route</span><span className="text-bone-400 capitalize">{quote ? quote.tool : "—"}</span></div>
      </div>

      {err && <div className="text-[11px] font-mono text-danger-300 bg-danger-900/20 border border-danger-500/30 rounded-lg px-3 py-2 mt-3">{err}</div>}
      {ok && <div className="text-[11px] font-mono text-emerald-300 bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mt-3">{ok}</div>}
      <button onClick={swap} disabled={busy || (!!w.address && (amt <= 0 || !quote))} className="btn-primary w-full mt-3">
        {busy ? <><Loader2 size={16} className="animate-spin" /> Swapping…</> : !w.address ? "Connect to trade" : buy ? `Buy ${symbol}` : `Sell ${symbol}`}
      </button>
      <p className="text-[10px] text-bone-600 font-mono text-center mt-2">Routed via LI.FI · best price across Robinhood DEXs.</p>
    </div>
  );
}
