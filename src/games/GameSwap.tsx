import { useEffect, useMemo, useRef, useState } from "react";
import { Contract, parseEther, parseUnits, formatEther, formatUnits, isAddress } from "ethers";
import { ArrowDownUp, Wallet, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { ADDR, CHAIN, readProvider, readRouter, erc20Meta } from "../lib/chain";
import { EthMark } from "../components/UnitMark";
import { fmtInt, short } from "../lib/util";

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
];

/** Small round token logo — image URL, or a first-letter fallback. */
function TokenLogo({ symbol, logo, size = 20 }: { symbol: string; logo?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken) {
    return (
      <img src={logo} alt="" onError={() => setBroken(true)}
        className="rounded-full object-cover ring-1 ring-ink-600 shrink-0"
        style={{ width: size, height: size }} draggable={false} />
    );
  }
  return (
    <div className="rounded-full bg-blood-500/20 border border-blood-500/30 flex items-center justify-center shrink-0 font-bold text-blood-300"
      style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {(symbol || "?").charAt(0)}
    </div>
  );
}

/**
 * Per-token swap for a casino room — the room's bet token ⇄ native ETH via the
 * Robinhood-chain UniswapV2 router (same one MIDGARD trades on). Ported from
 * Avlo's GameSwap tab; wired to our on-chain router instead of LI.FI (which
 * doesn't route Robinhood chain). Lives beside the game as the [Swap] tab.
 */
export function GameSwap({ token, symbol: symIn, decimals: decIn, logo }: {
  token: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
}) {
  const w = useWallet();
  const [meta, setMeta] = useState<{ symbol: string; decimals: number }>({
    symbol: symIn || "TOKEN", decimals: decIn ?? 18,
  });
  const [buy, setBuy] = useState(true);       // true = ETH→token, false = token→ETH
  const [amount, setAmount] = useState("");
  const [ethBal, setEthBal] = useState<number | null>(null);
  const [tokBal, setTokBal] = useState<number | null>(null);
  const [estOut, setEstOut] = useState<number>(0);
  const [quoting, setQuoting] = useState(false);
  const [noRoute, setNoRoute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const valid = isAddress(token);

  // Fill in symbol/decimals if the room didn't hand them over.
  useEffect(() => {
    if (!valid) return;
    if (symIn && decIn != null) { setMeta({ symbol: symIn, decimals: decIn }); return; }
    let live = true;
    erc20Meta(token).then((m) => { if (live) setMeta({ symbol: symIn || m.symbol, decimals: decIn ?? m.decimals }); }).catch(() => {});
    return () => { live = false; };
  }, [token, symIn, decIn, valid]);

  // Balances (refresh after a swap via `ok`).
  useEffect(() => {
    if (!w.address || !valid) { setEthBal(null); setTokBal(null); return; }
    let live = true;
    readProvider.getBalance(w.address).then((v) => { if (live) setEthBal(Number(formatEther(v))); }).catch(() => {});
    new Contract(token, ERC20, readProvider).balanceOf(w.address)
      .then((v: bigint) => { if (live) setTokBal(Number(formatUnits(v, meta.decimals))); }).catch(() => {});
    return () => { live = false; };
  }, [w.address, token, valid, meta.decimals, ok]);

  const amt = parseFloat(amount) || 0;
  const payBal = buy ? ethBal : tokBal;

  // Live quote from the router — debounced. getAmountsOut reverts when no pair
  // exists, which we surface as "no route".
  const quoteReq = useRef(0);
  useEffect(() => {
    if (!valid || !amt) { setEstOut(0); setNoRoute(false); return; }
    const id = ++quoteReq.current;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const path = buy ? [ADDR.weth, token] : [token, ADDR.weth];
        const inWei = buy ? parseEther(String(amt)) : parseUnits(String(amt), meta.decimals);
        const outs: bigint[] = await readRouter().getAmountsOut(inWei, path);
        const out = outs[outs.length - 1];
        const outDec = buy ? meta.decimals : 18;
        if (id === quoteReq.current) { setEstOut(Number(formatUnits(out, outDec))); setNoRoute(false); }
      } catch {
        if (id === quoteReq.current) { setEstOut(0); setNoRoute(true); }
      } finally {
        if (id === quoteReq.current) setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [amt, buy, token, valid, meta.decimals]);

  function setPct(p: number) {
    const bal = buy ? ethBal : tokBal;
    if (bal == null || bal <= 0) return;
    // Buying leaves a little ETH for gas; selling leaves a hair for rounding.
    const usable = p >= 1 ? (buy ? Math.max(0, bal - 0.001) : bal * 0.999) : bal;
    const v = usable * p;
    if (v <= 0) return;
    const dp = buy ? (v < 0.01 ? 8 : 6) : (v < 1 ? 6 : 2);
    setAmount(String(Number(v.toFixed(dp))));
  }

  async function swap() {
    setErr(null); setOk(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!amt || !valid) return;
    const router = w.routerWrite();
    if (!router) return;
    setBusy(true);
    try {
      const deadline = Math.floor(Date.now() / 1000) + 600;
      if (buy) {
        const path = [ADDR.weth, token];
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0n, path, w.address, deadline, { value: parseEther(amount) });
        await tx.wait();
      } else {
        const amountIn = parseUnits(amount, meta.decimals);
        const erc = new Contract(token, ERC20, w.signer);
        const cur: bigint = await erc.allowance(w.address, ADDR.router);
        if (cur < amountIn) {
          const ap = await erc.approve(ADDR.router, amountIn);
          await ap.wait();
        }
        const path = [token, ADDR.weth];
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn, 0n, path, w.address, deadline);
        await tx.wait();
      }
      setOk(`Swapped ${amount} ${buy ? "ETH" : meta.symbol}.`);
      setAmount("");
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Swap failed.");
    } finally { setBusy(false); }
  }

  const rate = useMemo(() => (amt && estOut ? estOut / amt : 0), [amt, estOut]);

  if (!valid) {
    return <div className="text-sm text-bone-500 text-center py-8">No swappable token for this room.</div>;
  }

  const EthChip = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-sm">
      <EthMark /> ETH
    </span>
  );
  const TokChip = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-sm min-w-0">
      <TokenLogo symbol={meta.symbol} logo={logo} /> <span className="truncate max-w-[90px]">{meta.symbol}</span>
    </span>
  );

  return (
    <div className="space-y-2.5">
      {/* Risk note — ported from Avlo */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[10px] leading-relaxed text-amber-200/80">
          <span className="font-bold text-amber-300 uppercase tracking-wider">Swap at your own risk.</span>{" "}
          Robinhood-chain token, swapped against ETH via the on-chain router. Anyone can launch a token — verify the contract first.
        </div>
      </div>

      {/* Pay */}
      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between items-center text-xs text-bone-400 mb-1.5">
          <span>You pay {buy ? EthChip : TokChip}</span>
          <span className="inline-flex items-center gap-1">
            <Wallet size={11} />
            {payBal === null ? "—" : buy ? payBal.toFixed(4) : fmtInt(payBal)}
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

      <div className="flex justify-center -my-1.5 relative z-10">
        <button onClick={() => { setBuy((b) => !b); setAmount(""); setEstOut(0); }}
          className="rounded-full border border-ink-600 bg-ink-850 p-2 hover:border-blood-500 hover:text-blood-400 transition">
          <ArrowDownUp size={15} />
        </button>
      </div>

      {/* Receive */}
      <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-3">
        <div className="flex justify-between items-center text-xs text-bone-400 mb-1.5">
          <span className="inline-flex items-center gap-1">You receive (est.) {quoting && <Loader2 size={11} className="animate-spin" />}</span>
          {buy ? TokChip : EthChip}
        </div>
        <div className="text-2xl font-mono tabular-nums text-bone-200">
          {noRoute ? "—" : estOut ? (buy ? fmtInt(estOut) : estOut.toFixed(6)) : "0.0"}
        </div>
      </div>

      {noRoute && (
        <div className="text-[11px] text-amber-300 font-mono">
          No route on the router for this pair — it may only trade on a different DEX.
        </div>
      )}
      {!noRoute && rate > 0 && (
        <div className="text-[11px] text-bone-600 font-mono">
          1 {buy ? "ETH" : meta.symbol} ≈ {buy ? fmtInt(rate) : rate.toFixed(8)} {buy ? meta.symbol : "ETH"}
        </div>
      )}

      <p className="text-[10px] text-bone-600 font-mono leading-relaxed">
        min received is 0 — pools can be shallow, expect slippage. Fee-on-transfer tokens are supported.
      </p>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2">{ok}</div>}

      <button onClick={swap} disabled={busy || !amt || noRoute} className="btn-primary w-full">
        {busy ? "Confirm in wallet…" : !w.address ? "Connect wallet" : buy ? `Buy ${meta.symbol}` : `Sell ${meta.symbol}`}
      </button>

      <a href={`${CHAIN.explorer}/token/${token}`} target="_blank" rel="noreferrer"
        className="flex items-center justify-center gap-1 font-mono text-[10px] text-bone-600 hover:text-blood-400 pt-0.5">
        {short(token)} <ExternalLink size={9} />
      </a>
    </div>
  );
}
