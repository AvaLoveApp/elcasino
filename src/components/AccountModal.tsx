import { useEffect, useState } from "react";
import { formatEther, formatUnits, parseEther, parseUnits, isAddress, Contract } from "ethers";
import {
  X, Copy, Check, ArrowUpRight, ArrowDownToLine, KeyRound, CreditCard, Loader2, ExternalLink, LogOut,
} from "lucide-react";
import { useWallet } from "../lib/wallet";
import { CHAIN, readProvider } from "../lib/chain";
import { short } from "../lib/util";
import { EthMark } from "./UnitMark";
import { privyFund, privyExport, privyEnabled } from "../lib/privy";

/**
 * Our own account panel — deposit / withdraw / buy / export — replacing Reown's
 * account modal. Withdraw sends native ETH via the active ethers signer (works
 * for both the Privy embedded wallet and an injected wallet). Buy-with-card and
 * secure key export use Privy (embedded/social wallets only).
 */
export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWallet();
  const [view, setView] = useState<"home" | "deposit" | "withdraw">("home");
  const [eth, setEth] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) { setView("home"); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !w.address) return;
    let live = true;
    readProvider.getBalance(w.address).then((v) => { if (live) setEth(Number(formatEther(v))); }).catch(() => {});
    return () => { live = false; };
  }, [open, w.address, view]);

  if (!open || !w.address) return null;
  const addr = w.address;
  const copy = () => { navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const canBuyExport = privyEnabled && w.isSocial;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-ink-950/80 backdrop-blur-md" />
      <div role="dialog" aria-modal="true"
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-blood-500/30 bg-ink-900/95
                   shadow-[0_0_0_1px_rgba(147,224,20,0.12),0_30px_80px_-20px_rgba(0,0,0,0.9)] animate-fade-up">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blood-400 to-transparent" />
        <button onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-bone-400 hover:text-blood-400 hover:bg-ink-800 transition">
          <X size={17} />
        </button>

        {/* Header — identity + balance */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3">
            {w.profile?.avatar
              ? <img src={w.profile.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-ink-600" />
              : <span className="mg-logo-rings h-11 w-11 inline-block"><img src="./elcasino_logo.png" alt="" className="rounded-full object-cover" /></span>}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-bone-50 truncate">
                {w.profile?.name || "Your wallet"}
                {w.isSocial && w.profile?.social && (
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1 py-0.5">{w.profile.social}</span>
                )}
              </div>
              <button onClick={copy} className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-bone-500 hover:text-blood-400">
                {short(addr)} {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-ink-700/70 bg-ink-900/60 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-500">Balance</div>
            <div className="text-2xl font-bold tabular-nums text-bone-50 inline-flex items-center gap-1.5">
              {eth === null ? "—" : eth.toFixed(4)} <EthMark /><span className="text-base text-bone-400">ETH</span>
            </div>
          </div>
        </div>

        {/* Body */}
        {view === "home" && (
          <div className="px-5 pb-5">
            <div className={`grid ${canBuyExport ? "grid-cols-2" : "grid-cols-2"} gap-2`}>
              <Action icon={<ArrowDownToLine size={17} />} label="Deposit" onClick={() => setView("deposit")} />
              <Action icon={<ArrowUpRight size={17} />} label="Withdraw" onClick={() => setView("withdraw")} />
              {canBuyExport && <Action icon={<CreditCard size={17} />} label="Buy with card" onClick={() => privyFund(addr)} />}
              {canBuyExport && <Action icon={<KeyRound size={17} />} label="Export key" onClick={() => privyExport(addr)} />}
            </div>
            <a href={`${CHAIN.explorer}/address/${addr}`} target="_blank" rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-1 font-mono text-[11px] text-bone-500 hover:text-blood-400">
              View on explorer <ExternalLink size={11} />
            </a>
            <button onClick={() => { onClose(); w.disconnect(); }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850 py-2.5 text-sm font-medium text-bone-300 hover:border-blood-500/50 hover:text-blood-300 transition">
              <LogOut size={14} /> Disconnect
            </button>
          </div>
        )}

        {view === "deposit" && (
          <DepositView addr={addr} canBuy={canBuyExport} onBack={() => setView("home")} onBuy={() => privyFund(addr)} />
        )}
        {view === "withdraw" && (
          <WithdrawView ethBal={eth} onBack={() => setView("home")} onDone={onClose} />
        )}
      </div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850 py-3.5
                 text-bone-100 transition hover:border-blood-500/60 hover:bg-ink-800 hover:text-blood-200">
      <span className="text-blood-300">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

export function DepositView({ addr, canBuy, onBack, onBuy }: { addr: string; canBuy: boolean; onBack?: () => void; onBuy: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&color=E5E0D8&bgcolor=0D0D0D&data=${encodeURIComponent(addr)}`;
  return (
    <div className="px-5 pb-5">
      <BackRow onBack={onBack} title="Deposit ETH" />
      <p className="text-[11px] text-bone-500 mb-3">Send ETH on <b className="text-bone-300">{CHAIN.name}</b> to this address. Only send assets on this network.</p>
      <div className="flex justify-center mb-3">
        <img src={qr} alt="deposit QR" className="rounded-xl border border-ink-700 bg-ink-950 p-1" width={180} height={180}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      </div>
      <div className="rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 mb-2">
        <code className="block break-all font-mono text-xs text-bone-100 leading-relaxed">{addr}</code>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={copy} className="py-2.5 rounded-xl border border-ink-600 text-bone-200 hover:bg-ink-800 text-sm font-semibold transition inline-flex items-center justify-center gap-1.5">
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? "Copied" : "Copy address"}
        </button>
        {canBuy
          ? <button onClick={onBuy} className="py-2.5 rounded-xl bg-blood-500/15 text-blood-300 border border-blood-500/30 hover:bg-blood-500/25 text-sm font-bold transition inline-flex items-center justify-center gap-1.5"><CreditCard size={14} /> Buy with card</button>
          : <a href={`${CHAIN.explorer}/address/${addr}`} target="_blank" rel="noreferrer" className="py-2.5 rounded-xl border border-ink-600 text-bone-200 hover:bg-ink-800 text-sm font-semibold transition inline-flex items-center justify-center gap-1.5">Explorer <ExternalLink size={13} /></a>}
      </div>
    </div>
  );
}

/** Which asset a withdrawal moves. ETH is native; a token carries its ERC-20 address. */
export type WithdrawAsset =
  | { kind: "eth"; symbol?: string }
  | { kind: "token"; address: string; symbol: string; decimals: number; balance: bigint };

const TRANSFER_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

export function WithdrawView({ ethBal, asset = { kind: "eth" }, onBack, onDone }: {
  ethBal: number | null; asset?: WithdrawAsset; onBack?: () => void; onDone: () => void;
}) {
  const w = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const isEth = asset.kind === "eth";
  const decimals = isEth ? 18 : asset.decimals;
  const symbol = isEth ? "ETH" : asset.symbol;
  // Available balance, as a number, for the MAX button and the over-balance guard.
  const bal = isEth ? ethBal : Number(formatUnits(asset.balance, asset.decimals));
  const amt = parseFloat(amount) || 0;
  const valid = isAddress(to) && amt > 0 && (bal == null || amt <= bal);

  async function send() {
    setErr(null); setOk(null);
    if (!isAddress(to)) { setErr("Enter a valid recipient address."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer) { setErr("Wallet not ready."); return; }
    setBusy(true);
    try {
      let tx;
      if (isEth) {
        tx = await w.signer.sendTransaction({ to, value: parseEther(amount) });
      } else {
        const c = new Contract(asset.address, TRANSFER_ABI, w.signer);
        tx = await c.transfer(to, parseUnits(amount, decimals));
      }
      await tx.wait();
      setOk("Sent.");
      setAmount(""); setTo("");
      setTimeout(onDone, 900);
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Withdraw failed."); }
    finally { setBusy(false); }
  }

  const balStr = bal == null ? "—" : (isEth ? bal.toFixed(4) : (bal >= 1 ? bal.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(bal)));

  return (
    <div className="px-5 pb-5">
      <BackRow onBack={onBack} title={`Withdraw ${symbol}`} />
      <label className="block text-[11px] font-semibold text-bone-400 mb-1">Recipient address</label>
      <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…"
        className="field font-mono text-xs py-2.5 mb-3 w-full" />
      <label className="block text-[11px] font-semibold text-bone-400 mb-1">Amount ({symbol})</label>
      <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5 mb-1">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.0"
          className="flex-1 bg-transparent outline-none text-xl font-mono tabular-nums w-full" />
        <button onClick={() => bal != null && setAmount(isEth ? String(Math.max(0, bal - 0.0005)) : String(bal))} className="text-[10px] font-mono border border-ink-600 rounded px-2 py-1 hover:border-blood-500">MAX</button>
      </div>
      <div className="font-mono text-[10px] text-bone-500 mb-3">balance {balStr} {symbol}{isEth ? " · a little is kept for gas" : ""}</div>
      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-2">{ok}</div>}
      <button onClick={send} disabled={busy || !valid} className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
        {busy ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : `Withdraw ${symbol}`}
      </button>
    </div>
  );
}

function BackRow({ onBack, title }: { onBack?: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {onBack && <button onClick={onBack} className="text-bone-400 hover:text-blood-400 text-sm">←</button>}
      <span className="text-sm font-bold text-bone-50">{title}</span>
    </div>
  );
}
