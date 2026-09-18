import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatUnits, formatEther, Contract } from "ethers";
import { Wallet, Coins, Dices, Loader2, ExternalLink, TrendingUp, Sparkles, ArrowDownToLine, CreditCard, Rocket } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readMidgard, readProvider, CHAIN, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { useTier } from "../lib/holderTier";
import { TierBadge } from "../components/TierBadge";
import { loadUserPositions, UserPosition, fmtBet } from "../lib/casino";
import { GameTypeIcon } from "../components/GameTypeIcon";
import { RwaHoldings } from "../components/RwaHoldings";
import { CopyButton } from "../components/CopyButton";
import { short, fmtInt } from "../lib/util";
import { EthMark, MidMark } from "../components/UnitMark";
import { DepositView, WithdrawView, WithdrawAsset } from "../components/AccountModal";
import { privyFund, privyExport, privyEnabled } from "../lib/privy";
import { KeyRound } from "lucide-react";

/**
 * Wallet / portfolio — the user's Midgard footprint on one tabbed page. Claiming
 * lives on the MIDGARD hub (not duplicated here). Each tab loads its own data
 * only when opened, and long lists page in batches of 10 ("Load more") so we
 * never fan out dozens of eth_calls at once.
 */
type Tab = "bag" | "casino";

export default function WalletPage() {
  const w = useWallet();
  const tier = useTier(w.address);
  const [bal, setBal] = useState<bigint | null>(null);
  const [ethBal, setEthBal] = useState<bigint | null>(null);
  const [acct, setAcct] = useState<"none" | "deposit" | "withdraw">("none");
  const [wAsset, setWAsset] = useState<WithdrawAsset>({ kind: "eth" });
  // Open the withdraw panel pre-selected to the tapped asset.
  const withdrawAsset = (a: WithdrawAsset) => { setWAsset(a); setAcct("withdraw"); };
  const [tab, setTab] = useState<Tab>(() => {
    try { return (localStorage.getItem("mg-wallet-tab") as Tab) || "bag"; } catch { return "bag"; }
  });
  const pickTab = (t: Tab) => { setTab(t); try { localStorage.setItem("mg-wallet-tab", t); } catch {} };

  useEffect(() => {
    if (!w.address) { setBal(null); setEthBal(null); return; }
    let live = true;
    const load = async () => {
      try {
        const [b, e] = await Promise.all([
          readMidgard().balanceOf(w.address).catch(() => 0n),
          readProvider.getBalance(w.address!).catch(() => 0n),
        ]);
        if (live) { setBal(b); setEthBal(e); }
      } catch {}
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { live = false; clearInterval(t); };
  }, [w.address]);

  if (!w.address) {
    return (
      <div className="animate-fade-up max-w-md mx-auto text-center py-20">
        <span className="mg-logo-rings h-16 w-16 mx-auto mb-5 block">
          <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
          <img src="./elcasino_logo.png" alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-ink-600" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Your EL-Casino wallet</h1>
        <p className="text-bone-400 text-sm mt-2 mb-6">Connect to see your ELCAS balance, rank, your token bag, and every casino pool you back. No wallet? Sign in with email, Google or X.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={w.connect} disabled={w.connecting} className="btn-primary px-6 py-2.5">
            <Wallet size={18} /> {w.connecting ? "Connecting…" : "Connect wallet"}
          </button>
          <button onClick={w.connectSocial} disabled={w.connecting}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-600 bg-ink-800 px-6 py-2.5 text-sm font-medium text-bone-200 hover:border-blood-500/50 hover:text-bone-50 transition">
            <Sparkles size={16} /> Email / Google / X
          </button>
        </div>
      </div>
    );
  }

  const balN = bal !== null ? Number(formatUnits(bal, 18)) : null;

  return (
    <div className="animate-fade-up space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="mg-logo-rings h-12 w-12 shrink-0">
          <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
          <img src={w.profile?.avatar || "./elcasino_logo.png"} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-ink-600" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{w.profile?.name || "Wallet"}</h1>
            {tier && <TierBadge tier={tier.tier} size="md" />}
            {w.isSocial && <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-300 border border-emerald-500/40 bg-emerald-900/15 rounded-full px-2 py-0.5"><Sparkles size={10} /> social</span>}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <a href={`${CHAIN.explorer}/address/${w.address}`} target="_blank" rel="noreferrer"
              className="font-mono text-xs text-bone-400 hover:text-blood-400 inline-flex items-center gap-1">
              {short(w.address)} <ExternalLink size={11} />
            </a>
            <CopyButton value={w.address} title="Copy your address" />
          </div>
        </div>
        <button onClick={w.disconnect} className="ml-auto btn-ghost text-xs py-1.5 px-3">Disconnect</button>
      </div>

      {/* Wallet — assets + inline deposit / withdraw / buy / export (no popup) */}
      <div className="panel p-0 overflow-hidden">
        {/* Assets */}
        <div className="p-4 border-b border-ink-700/60">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-500 mb-2">Assets</div>
          <div className="space-y-1.5">
            <AssetRow icon={<EthMark />} name="ETH" sub="native gas" amount={ethBal !== null ? Number(formatEther(ethBal)).toFixed(4) : "…"}
              onWithdraw={ethBal && ethBal > 0n ? () => withdrawAsset({ kind: "eth" }) : undefined} />
            <AssetRow icon={<MidMark />} name="ELCAS" sub="economy token" amount={balN !== null ? fmtInt(balN) : "…"}
              onWithdraw={bal && bal > 0n ? () => withdrawAsset({ kind: "token", address: ADDR.token, symbol: TOKEN_SYMBOL, decimals: 18, balance: bal }) : undefined} />
          </div>
          <div className="font-mono text-[10px] text-bone-600 mt-2">Tap an asset to withdraw it.</div>
        </div>
        {/* Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
          <WalletAction icon={<ArrowDownToLine size={16} />} label="Deposit" active={acct === "deposit"} onClick={() => setAcct(acct === "deposit" ? "none" : "deposit")} />
          <WalletAction icon={<ArrowDownToLine size={16} className="rotate-180" />} label="Withdraw" active={acct === "withdraw"} onClick={() => { if (acct === "withdraw") { setAcct("none"); } else { setWAsset({ kind: "eth" }); setAcct("withdraw"); } }} />
          <WalletAction icon={<CreditCard size={16} />} label="Buy" onClick={() => (privyEnabled && w.isSocial && w.address ? privyFund(w.address) : w.openOnRamp())} />
          {privyEnabled && w.isSocial
            ? <WalletAction icon={<KeyRound size={16} />} label="Export" onClick={() => w.address && privyExport(w.address)} />
            : <a href={`${CHAIN.explorer}/address/${w.address}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850 py-3 text-bone-200 hover:border-blood-500/50 transition"><ExternalLink size={16} className="text-blood-300" /><span className="text-xs font-semibold">Explorer</span></a>}
        </div>
        {/* Inline sub-view */}
        {acct === "deposit" && w.address && (
          <div className="border-t border-ink-700/60 bg-ink-950/40">
            <DepositView addr={w.address} canBuy={privyEnabled && w.isSocial} onBuy={() => w.address && privyFund(w.address)} />
          </div>
        )}
        {acct === "withdraw" && (
          <div className="border-t border-ink-700/60 bg-ink-950/40">
            <WithdrawView ethBal={ethBal !== null ? Number(formatEther(ethBal)) : null} asset={wAsset} onDone={() => setAcct("none")} />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/token" className="panel p-3 flex flex-col items-center gap-1 hover:border-amber-500/50 transition group">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white mb-0.5 group-hover:scale-110 transition" style={{ background: "linear-gradient(140deg, #f59e0b, rgba(0,0,0,0.55))" }}><Coins size={18} /></span>
          <span className="font-semibold text-sm">Trade</span>
          <span className="font-mono text-[10px] text-bone-500">buy · sell · claim</span>
        </Link>
        <Link to="/casino" className="panel p-3 flex flex-col items-center gap-1 hover:border-emerald-500/50 transition group">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white mb-0.5 group-hover:scale-110 transition" style={{ background: "linear-gradient(140deg, #10b981, rgba(0,0,0,0.55))" }}><Dices size={18} /></span>
          <span className="font-semibold text-sm">Casino</span>
          <span className="font-mono text-[10px] text-bone-500">play · stake</span>
        </Link>
        <Link to="/analytics" className="panel p-3 flex flex-col items-center gap-1 hover:border-blood-500/50 transition group">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white mb-0.5 group-hover:scale-110 transition" style={{ background: "linear-gradient(140deg, #B01B21, rgba(0,0,0,0.55))" }}><TrendingUp size={18} /></span>
          <span className="font-semibold text-sm">Analytics</span>
          <span className="font-mono text-[10px] text-bone-500">live terminal</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-ink-800/80 border border-ink-700/70 p-1">
        {([["bag", "Your bag", Wallet], ["casino", "Casino positions", Dices]] as const).map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => pickTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-ink-600 text-bone-50 shadow-sm" : "text-bone-400 hover:text-bone-100 hover:bg-ink-700/50"}`}>
              <Icon size={15} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-blood-400" : ""} />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "bag" ? <BagTab user={w.address} midBal={balN} tierLabel={tier?.tier.label} /> : <CasinoTab user={w.address} />}
    </div>
  );
}

/** Reusable token avatar with an initials fallback. */
function TokenLogo({ url, sym, size = 36 }: { url?: string; sym: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const s = { width: size, height: size };
  if (url && !broken) return <img src={url} alt="" onError={() => setBroken(true)} className="rounded-full border border-ink-600 object-cover shrink-0 bg-ink-900" style={s} />;
  return <div className="rounded-full border border-ink-600 bg-ink-850 flex items-center justify-center text-[10px] font-mono text-bone-500 shrink-0" style={s}>{sym.slice(0, 4)}</div>;
}

// ─── Your bag: MIDGARD + launchpad tokens (paged) + RWA holdings ──────────────
function BagTab({ user, midBal, tierLabel }: { user: string; midBal: number | null; tierLabel?: string }) {
  return (
    <div className="space-y-4">
      <div className="panel p-3 flex items-center gap-3">
        <img src="./elcasino_logo.png" alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-ink-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">ELCAS</div>
          <div className="font-mono text-[11px] text-bone-500 truncate">{tierLabel || "economy token"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm font-bold text-bone-100">{midBal !== null ? fmtInt(midBal) : "…"}</div>
          <div className="font-mono text-[10px] text-bone-500">ELCAS</div>
        </div>
      </div>

      <div>
        <SectionTitle icon={<Coins size={13} />} label="RWA holdings" />
        <RwaHoldings />
      </div>
    </div>
  );
}

// ─── Casino positions — loaded only when this tab is open, shown 10 at a time ──
function CasinoTab({ user }: { user: string }) {
  const [positions, setPositions] = useState<UserPosition[] | null>(null);
  const [shown, setShown] = useState(10);
  useEffect(() => {
    let live = true; setPositions(null); setShown(10);
    loadUserPositions(user).then((r) => { if (live) setPositions(r); }).catch(() => { if (live) setPositions([]); });
    return () => { live = false; };
  }, [user]);

  if (positions === null) return <div className="panel p-8 text-center text-bone-500"><Loader2 className="animate-spin mx-auto mb-2" /> scanning pools for your stake…</div>;
  if (positions.length === 0) return (
    <div className="panel p-8 text-center text-bone-500">
      <Coins size={26} className="mx-auto mb-2 opacity-50" />
      You haven't staked in any pool yet. Open a room's <Link to="/casino" className="text-emerald-300">Earn</Link> tab to become the house.
    </div>
  );
  const visible = positions.slice(0, shown);
  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <Link key={p.address} to={`/casino/room/${p.gameKey}/${p.address}`} className="panel p-3 flex items-center gap-3 hover:border-purple-500/50 transition">
          <span className="relative shrink-0">
            <TokenLogo url={p.logo} sym={p.symbol} size={40} />
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-ink-900" style={{ background: p.color }}>
              <GameTypeIcon type={p.gameKey} size={11} className="text-white" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{p.betName || `${p.gameLabel} room`}</div>
            <div className="font-mono text-[11px] text-bone-500 truncate">{p.gameLabel} · {p.symbol} · {p.sharePct.toFixed(2)}% of pool</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[9px] text-bone-500 uppercase tracking-wider">Value</div>
            <div className="font-mono text-sm font-bold text-emerald-300">{fmtBet(p.value, p.decimals)} {p.symbol}</div>
          </div>
        </Link>
      ))}
      {shown < positions.length && (
        <button onClick={() => setShown((s) => s + 10)} className="btn-ghost w-full py-2 mt-1 text-xs">Load more ({positions.length - shown})</button>
      )}
    </div>
  );
}

function SectionTitle({ icon, label, to, cta }: { icon: React.ReactNode; label: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-blood-400">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
      {to && <Link to={to} className="font-mono text-[10px] text-bone-500 hover:text-blood-300 shrink-0">{cta} →</Link>}
    </div>
  );
}

/** One asset row in the wallet's Assets list. Tap to withdraw when there's a balance. */
function AssetRow({ icon, name, sub, amount, onWithdraw }: { icon: React.ReactNode; name: string; sub: string; amount: string; onWithdraw?: () => void }) {
  const inner = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-800 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-bone-50">{name}</div>
        <div className="font-mono text-[10px] text-bone-500">{sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm font-bold tabular-nums text-bone-100">{amount}</div>
        {onWithdraw && <div className="font-mono text-[9px] uppercase tracking-wider text-blood-300/80 inline-flex items-center gap-0.5"><ArrowDownToLine size={9} className="rotate-180" /> withdraw</div>}
      </div>
    </>
  );
  if (onWithdraw) {
    return (
      <button onClick={onWithdraw} title={`Withdraw ${name}`}
        className="w-full flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 py-2.5 text-left transition hover:border-blood-500/50 hover:bg-ink-800/60">
        {inner}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 py-2.5">
      {inner}
    </div>
  );
}

/** A wallet action tile (Deposit / Withdraw / Buy / Export). */
function WalletAction({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition ${
        active ? "border-blood-500/70 bg-blood-500/10 text-blood-200" : "border-ink-600 bg-ink-850 text-bone-200 hover:border-blood-500/50 hover:text-blood-200"}`}>
      <span className="text-blood-300">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
