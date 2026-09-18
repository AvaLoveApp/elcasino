import { useEffect, useRef, useState } from "react";
import { parseUnits, formatUnits, Contract } from "ethers";
import { HandCoins, X } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { ADDR, readMidgard, ERC20_ABI, readProvider } from "../lib/chain";
import { RWA_PRESETS } from "../lib/rwa";
import { notify } from "../lib/social";
import { fmtInt } from "../lib/util";

// Suggested MIDGARD amounts. Chips render only when the selected token is
// MIDGARD; for RWAs we fall back to the raw amount input (varied decimals).
const MID_CHIPS = [100, 1_000, 10_000, 100_000];

/**
 * Tip a post's author with MIDGARD (default) or any RWA the wallet holds.
 * Just a raw ERC-20 transfer — no new contract, no gate. Opens a lightweight
 * inline sheet from the PostCard action row so it feels like a native action.
 */
export function TipButton({ to }: { to: string }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(ADDR.token);
  const [amount, setAmount] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [symbol, setSymbol] = useState("ELCAS");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!sheetRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Refresh symbol/decimals/balance whenever the selected token or wallet changes.
  useEffect(() => {
    if (!open || !w.address) return;
    (async () => {
      try {
        const c = new Contract(token, ERC20_ABI, readProvider);
        const [sym, dec, bal] = await Promise.all([
          c.symbol().catch(() => "TOKEN"),
          c.decimals().catch(() => 18),
          c.balanceOf(w.address!),
        ]);
        setSymbol(sym); setDecimals(Number(dec)); setBalance(bal);
      } catch { setBalance(null); }
    })();
  }, [open, token, w.address]);

  if (!w.address || w.address.toLowerCase() === to.toLowerCase()) return null;

  async function send() {
    setErr(null); setOk(null);
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!amount || !w.signer) return;
    setBusy(true);
    try {
      const wei = parseUnits(amount, decimals);
      const c = new Contract(token, ERC20_ABI.concat(["function transfer(address,uint256) returns (bool)"]), w.signer);
      const tx = await c.transfer(to, wei);
      await tx.wait();
      setOk(`Sent ${amount} ${symbol}.`);
      notify({ recipient: to, actor: w.address!, type: "tip", meta: { amount, symbol }, actorName: w.profile?.name, actorAvatar: w.profile?.avatar });
      setAmount("");
      // Refresh balance so the chip greying / MAX button reflects the new state.
      try {
        const c2 = new Contract(token, ERC20_ABI, readProvider);
        const bal = await c2.balanceOf(w.address!);
        setBalance(bal);
      } catch { /* keep previous */ }
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Tip failed.");
    } finally { setBusy(false); }
  }

  const balN = balance !== null ? Number(formatUnits(balance, decimals)) : 0;
  const isMidgard = token.toLowerCase() === ADDR.token.toLowerCase();
  const amtN = Number(amount || "0");
  const short = balance !== null && amtN > 0 && amtN > balN;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen(true)} title="Tip"
        className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition hover:bg-blood-900/25 hover:text-blood-400">
        <HandCoins size={17} strokeWidth={2} />
      </button>

      {open && (
        <div ref={sheetRef}
          className="absolute z-20 right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-ink-600 bg-ink-900 shadow-blood p-3">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={14} className="text-blood-400" />
            <span className="font-semibold text-sm">Tip this post</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-bone-500 hover:text-blood-400"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-6 gap-1 mb-2">
            {RWA_PRESETS.slice(0, 12).filter((p) => p.address).map((p) => {
              const selected = p.address!.toLowerCase() === token.toLowerCase();
              return (
                <button key={p.key} onClick={() => setToken(p.address!)}
                  title={p.label}
                  className={`h-8 w-8 rounded-full overflow-hidden ring-1 transition ${selected ? "ring-blood-500" : "ring-ink-600 hover:ring-blood-500/50"}`}
                  style={{ background: `linear-gradient(140deg, ${p.color}, rgba(0,0,0,0.5))` }}>
                  {p.logo
                    ? <img src={p.logo} alt={p.label} className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    : <span className="text-[10px] font-bold text-bone-50">{p.short}</span>}
                </button>
              );
            })}
          </div>

          {isMidgard && (
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {MID_CHIPS.map((n) => {
                const disabled = balance !== null && n > balN;
                return (
                  <button key={n} onClick={() => setAmount(String(n))} disabled={disabled}
                    className={`py-1.5 rounded-lg text-xs font-mono border transition ${
                      disabled
                        ? "border-ink-700 text-bone-700 cursor-not-allowed"
                        : "border-ink-600 text-bone-300 hover:border-blood-500 hover:text-blood-300"
                    }`}>
                    {n >= 1000 ? `${n / 1000}K` : n}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-ink-600 bg-ink-900/70 p-2.5 mb-2">
            <div className="flex justify-between text-[11px] text-bone-500 mb-1">
              <span>Amount</span>
              <span className="font-mono">{balance !== null ? `${fmtInt(balN)} ${symbol}` : "…"}</span>
            </div>
            <div className="flex items-center gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal" placeholder="0.0"
                className="flex-1 bg-transparent outline-none text-lg font-mono" />
              <button onClick={() => setAmount(balN ? balN.toString() : "")}
                className="text-[10px] font-mono border border-ink-600 rounded-md px-2 py-1 hover:border-blood-500 hover:text-blood-400">
                MAX
              </button>
            </div>
          </div>

          {err && <div className="text-blood-200 text-xs bg-blood-900/20 border border-blood-500/40 rounded-lg px-2.5 py-1.5 mb-2">{err}</div>}
          {ok && <div className="text-emerald-300 text-xs bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 mb-2">{ok}</div>}

          <button onClick={send} disabled={busy || !amount || short}
            className="btn-primary w-full py-2 text-sm">
            {busy ? "Sending…"
              : short ? `Not enough ${symbol}`
              : `Tip ${amount || "0"} ${symbol}`}
          </button>
          <p className="text-[10px] font-mono text-bone-600 mt-2 leading-relaxed">
            Wallet-to-wallet transfer, no intermediary. Confirmed on-chain the moment your tx lands.
          </p>
        </div>
      )}
    </div>
  );
}
