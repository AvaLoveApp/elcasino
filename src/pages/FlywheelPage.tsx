import { useEffect, useState } from "react";
import { Contract, formatUnits, formatEther } from "ethers";
import { Recycle, Flame, Coins, ExternalLink, Loader2, ArrowRight, Wallet } from "lucide-react";
import { ADDR, CHAIN, ERC20_ABI, erc20Meta, readProvider } from "../lib/chain";
import { dexPricesUsd, fmtUsdShort } from "../lib/dexscreener";
import { loadCasinoTokens, isBlockedCasinoToken } from "../lib/casino";
import { EthMark } from "../components/UnitMark";
import { fmtInt, short } from "../lib/util";
import { CopyButton } from "../components/CopyButton";
import { useAppConfig, hasElcasToken as cfgHasToken } from "../lib/appConfig";
import { PonsBanner } from "../components/PonsBanner";

/**
 * ELCAS Flywheel — the self-reinforcing loop that turns casino activity into
 * permanent ELCAS scarcity:
 *
 *   casino fees ($)  →  buy back ELCAS  →  burn ELCAS  →  ↺
 *
 * The fee-collector wallet gathers every deploy fee + per-bet fee, converts them
 * to ELCAS, and burns it. This page shows the live totals and animates the loop.
 */

// Wallet that gathers all platform fees (deploy + per-bet) before buyback/burn.
const FEE_COLLECTOR = "0x85228f9817798E97c599ec4B2BEd0F1104b51273";
// ELCAS token comes from the admin launch config (set it in Admin → ELCAS launch
// config once the token is live on Pons). Until then the ELCAS side reads pending.
// Standard burn sinks — ELCAS sent here is out of circulation for good.
const BURN_ADDRS = [
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000000",
];

// One asset actually sitting in the fee collector — ETH or a bet token.
type Holding = { symbol: string; addr: string; amount: number; usd: number; isEth?: boolean; priceKnown: boolean };

type Data = {
  totalUsd: number;      // real value of everything in the collector (ETH + tokens)
  holdings: Holding[];   // per-token breakdown, biggest first
  tokenLive: boolean;    // is the ELCAS token address set + readable?
  elcasPrice: number;    // ELCAS price in USD (0 if unknown)
  heldElcas: number;     // ELCAS held by the collector (bought back, pending burn)
  heldElcasUsd: number;
  burnedElcas: number;   // ELCAS sent to burn sinks
  burnedElcasUsd: number;
};

export default function FlywheelPage() {
  const { config } = useAppConfig();
  const elcasToken = config.elcasToken;
  const tokenSet = cfgHasToken(config);
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        // The real "fees collected" is whatever the collector wallet actually
        // holds on-chain: ETH + the casino bet tokens it has gathered. We value
        // each with live DexScreener prices — no theoretical fee assumptions.
        const tokenList = await loadCasinoTokens().catch(() => [] as string[]);
        const tokens = tokenList.filter((t) => !isBlockedCasinoToken(t)); // drop owner-blocked (e.g. wolf)
        const [collectorWei, priceMap] = await Promise.all([
          readProvider.getBalance(FEE_COLLECTOR).catch(() => 0n),
          dexPricesUsd([...tokens, ADDR.weth]).catch(() => new Map<string, number>()),
        ]);
        const ethUsd = priceMap.get(ADDR.weth.toLowerCase()) ?? 0;
        const ethAmt = Number(formatEther(collectorWei as bigint));

        const holdings: Holding[] = [];
        if (ethAmt > 0) holdings.push({ symbol: "ETH", addr: ADDR.weth, amount: ethAmt, usd: ethAmt * ethUsd, isEth: true, priceKnown: ethUsd > 0 });

        // Read each token's balance in the collector (+ symbol/decimals) — the
        // casino token set is small, so per-token reads are cheap and batched.
        await Promise.all(tokens.map(async (t) => {
          try {
            const c = new Contract(t, ERC20_ABI, readProvider);
            const [balWei, meta] = await Promise.all([
              c.balanceOf(FEE_COLLECTOR),
              erc20Meta(t).catch(() => ({ symbol: short(t), decimals: 18 })),
            ]);
            if (isBlockedCasinoToken(t, meta.symbol)) return; // block by symbol too
            const amt = Number(formatUnits(balWei as bigint, meta.decimals));
            if (amt <= 0) return;
            const price = priceMap.get(t.toLowerCase()) ?? 0;
            holdings.push({ symbol: meta.symbol, addr: t, amount: amt, usd: amt * price, priceKnown: price > 0 });
          } catch { /* skip token */ }
        }));
        holdings.sort((a, b) => b.usd - a.usd);
        const totalUsd = holdings.reduce((s, h) => s + h.usd, 0);

        // ELCAS side only reads once the token address is set — pending until launch.
        let elcasPrice = 0, heldElcas = 0, burnedElcas = 0;
        if (tokenSet) {
          const elcas = new Contract(elcasToken, ERC20_ABI, readProvider);
          const [heldWei, burnWeis, ep] = await Promise.all([
            elcas.balanceOf(FEE_COLLECTOR).catch(() => 0n),
            Promise.all(BURN_ADDRS.map((a) => elcas.balanceOf(a).catch(() => 0n))),
            dexPricesUsd([elcasToken]).catch(() => new Map<string, number>()),
          ]);
          elcasPrice = ep.get(elcasToken.toLowerCase()) ?? 0;
          heldElcas = Number(formatUnits(heldWei as bigint, 18));
          burnedElcas = (burnWeis as bigint[]).reduce((s, b) => s + Number(formatUnits(b, 18)), 0);
        }
        if (!live) return;
        setD({
          totalUsd, holdings,
          tokenLive: tokenSet,
          elcasPrice,
          heldElcas,
          heldElcasUsd: heldElcas * elcasPrice,
          burnedElcas,
          burnedElcasUsd: burnedElcas * elcasPrice,
        });
      } catch { /* keep last */ }
      finally { if (live) setLoading(false); }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [elcasToken, tokenSet]);

  return (
    <div className="animate-fade-up max-w-5xl mx-auto space-y-6">
      <style>{FLYWHEEL_CSS}</style>

      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center gap-2.5">
          <span className="mg-logo-rings h-11 w-11">
            <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
            <img src="./elcasino_logo.png" alt="ELCAS" className="h-11 w-11 rounded-full object-cover ring-1 ring-ink-600" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">ELCAS Flywheel</h1>
        </div>
        <p className="text-bone-400 text-sm max-w-xl mx-auto">
          Every casino fee is collected, used to <span className="text-emerald-300 font-semibold">buy back ELCAS</span>, and then{" "}
          <span className="text-blood-300 font-semibold">burned</span> — a self-reinforcing loop that makes ELCAS scarcer as the casino grows.
        </p>
      </div>

      {/* Pons launch banner */}
      <PonsBanner />

      {/* Flywheel animation */}
      <Flywheel data={d} loading={loading} />

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={<Coins size={16} />} accent="#22d3ee" label="Fees collected"
          value={d ? fmtUsdShort(d.totalUsd) : "…"} sub="held in collector · on-chain" />
        <StatCard icon={<Recycle size={16} />} accent="#10b981" label="ELCAS held"
          value={!d ? "…" : d.tokenLive ? fmtInt(d.heldElcas) : "—"}
          sub={d && d.tokenLive ? (d.elcasPrice > 0 ? `${fmtUsdShort(d.heldElcasUsd)} · bought back` : "bought back, pending burn") : "pending token launch"} />
        <StatCard icon={<Flame size={16} />} accent="#dc2626" label="ELCAS burned"
          value={!d ? "…" : d.tokenLive ? fmtInt(d.burnedElcas) : "—"}
          sub={d && d.tokenLive ? (d.elcasPrice > 0 ? `${fmtUsdShort(d.burnedElcasUsd)} removed forever` : "removed forever") : "pending token launch"} />
      </div>

      {/* Per-token breakdown — what's actually in the collector, so the totals are self-evident */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={14} className="text-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">Collected fees — by asset</span>
          <div className="h-px flex-1 bg-ink-700/70" />
          <span className="font-mono text-[10px] text-bone-500">{d ? fmtUsdShort(d.totalUsd) : "…"}</span>
        </div>
        {!d ? (
          <div className="py-6 text-center text-bone-500 text-sm"><Loader2 size={16} className="animate-spin inline" /></div>
        ) : d.holdings.length === 0 ? (
          <div className="py-6 text-center text-bone-500 text-sm">No fees in the collector yet.</div>
        ) : (
          <div className="space-y-1.5">
            {d.holdings.map((h) => (
              <div key={h.addr + (h.isEth ? "-eth" : "")} className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 py-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-800 text-sm shrink-0">
                  {h.isEth ? <EthMark /> : <span className="font-bold text-[11px] text-bone-300">{(h.symbol || "?").slice(0, 3).toUpperCase()}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-bone-50">{h.symbol}</div>
                  <div className="font-mono text-[10px] text-bone-500 truncate">{h.isEth ? "native · gas" : short(h.addr)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-bold tabular-nums text-bone-100">{h.amount >= 1 ? fmtInt(h.amount) : h.amount.toPrecision(3)}</div>
                  <div className="font-mono text-[10px] text-emerald-300">{h.priceKnown ? fmtUsdShort(h.usd) : "price n/a"}</div>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-bone-600 leading-relaxed pt-1.5">
              These are the exact balances the fee collector holds right now — casino fees waiting to be swapped to ELCAS and burned. The dollar total is the live value of these assets, nothing theoretical.
            </p>
          </div>
        )}
      </div>

      {/* On-chain sources */}
      <div className="panel p-4 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-500">On-chain</div>
        <AddrRow label="Fee collector" addr={FEE_COLLECTOR} />
        {tokenSet
          ? <AddrRow label="ELCAS token" addr={elcasToken} isToken />
          : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-bone-400 w-24 shrink-0">ELCAS token</span>
              <span className="font-mono text-xs text-amber-400/80">not launched yet — set it in Admin → ELCAS launch config</span>
            </div>
          )}
        <p className="text-[11px] text-bone-600 leading-relaxed pt-1">
          Totals are read live from chain: fees from the casino factories, ELCAS held by the collector, and ELCAS sent to the burn sinks
          (<span className="font-mono">0x…dEaD</span> / <span className="font-mono">0x0</span>). USD values use the current ELCAS and ETH prices.
        </p>
      </div>
    </div>
  );
}

// ── The animated wheel ────────────────────────────────────────────────────────
function Flywheel({ data, loading }: { data: Data | null; loading: boolean }) {
  const stages = [
    { key: "fees", label: "Casino fees", icon: Coins, color: "#22d3ee", value: data ? fmtUsdShort(data.totalUsd) : "" },
    { key: "buy", label: "Buy ELCAS", icon: Recycle, color: "#10b981", value: !data ? "" : !data.tokenLive ? "pending" : data.heldElcas > 0 ? fmtInt(data.heldElcas) + " ELCAS" : "—" },
    { key: "burn", label: "Burn", icon: Flame, color: "#dc2626", value: !data ? "" : !data.tokenLive ? "pending" : fmtInt(data.burnedElcas) + " ELCAS" },
  ];
  return (
    <div className="panel p-6 sm:p-8 overflow-hidden relative">
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-52 w-52 rounded-full bg-emerald-600/10 blur-3xl" />
      <div className="relative mx-auto flywheel-stage">
        {/* rotating ring */}
        <div className="flywheel-ring" />
        <div className="flywheel-ring flywheel-ring--rev" />
        {/* flowing dots around the loop */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="flywheel-dot" style={{ animationDelay: `${(i / 6) * 6}s` }} />
        ))}
        {/* center ELCAS logo */}
        <div className="flywheel-center">
          <span className="mg-logo-rings h-20 w-20 block">
            <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
            <img src="./elcasino_logo.png" alt="ELCAS" className="h-20 w-20 rounded-full object-cover ring-1 ring-ink-600" />
          </span>
          <div className="text-center mt-2">
            <div className="font-bold text-sm tracking-tight">ELCAS</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-emerald-400">buyback &amp; burn</div>
          </div>
        </div>
        {/* three stage nodes at 12 / 4 / 8 o'clock */}
        {stages.map((s, i) => {
          const Icon = s.icon;
          const angle = -90 + i * 120; // degrees
          const r = 132;
          const x = Math.cos((angle * Math.PI) / 180) * r;
          const y = Math.sin((angle * Math.PI) / 180) * r;
          return (
            <div key={s.key} className="flywheel-node" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
              <span className="grid h-12 w-12 place-items-center rounded-full ring-2 ring-ink-900 shadow-lg" style={{ background: `linear-gradient(140deg, ${s.color}, rgba(0,0,0,0.5))` }}>
                <Icon size={20} className="text-white" />
              </span>
              <div className="text-center mt-1.5">
                <div className="text-[12px] font-semibold text-bone-100 whitespace-nowrap">{s.label}</div>
                <div className="font-mono text-[10px] text-bone-400 whitespace-nowrap h-3">{loading ? <Loader2 size={10} className="animate-spin inline" /> : s.value}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* linear caption under the wheel */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap text-[11px] font-mono text-bone-500">
        <span className="text-cyan-300">fees</span> <ArrowRight size={12} />
        <span className="text-emerald-300">buy ELCAS</span> <ArrowRight size={12} />
        <span className="text-blood-300">burn</span> <ArrowRight size={12} />
        <span className="text-bone-400">price floor rises</span>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="panel p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
      <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>{icon}{label}</div>
      <div className="font-mono text-xl font-bold tabular-nums text-bone-50 mt-1.5">{value}</div>
      <div className="font-mono text-[10px] text-bone-500 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function AddrRow({ label, addr, note, isToken }: { label: string; addr: string; note?: string; isToken?: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[11px] text-bone-400 w-24 shrink-0">{label}</span>
      <a href={`${CHAIN.explorer}/${isToken ? "token" : "address"}/${addr}`} target="_blank" rel="noreferrer"
        className="font-mono text-xs text-bone-200 hover:text-blood-400 inline-flex items-center gap-1">
        {short(addr)} <ExternalLink size={11} />
      </a>
      <CopyButton value={addr} title={`Copy ${label}`} />
      {note && <span className="font-mono text-[10px] text-amber-400/80">{note}</span>}
    </div>
  );
}

const FLYWHEEL_CSS = `
.flywheel-stage { position: relative; width: 320px; height: 320px; }
@media (max-width: 480px) { .flywheel-stage { width: 300px; height: 300px; } }
.flywheel-ring {
  position: absolute; inset: 26px; border-radius: 9999px;
  border: 2px dashed rgba(16,185,129,0.35);
  animation: fw-spin 18s linear infinite;
}
.flywheel-ring--rev {
  inset: 44px; border-color: rgba(220,38,38,0.22);
  animation: fw-spin 26s linear infinite reverse;
}
.flywheel-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; z-index: 3;
}
.flywheel-node { position: absolute; top: 50%; left: 50%; z-index: 4; display: flex; flex-direction: column; align-items: center; }
.flywheel-dot {
  position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px;
  border-radius: 9999px; background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.8);
  offset-path: circle(120px at center); animation: fw-orbit 6s linear infinite; z-index: 2;
}
@keyframes fw-spin { to { transform: rotate(360deg); } }
@keyframes fw-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@media (prefers-reduced-motion: reduce) {
  .flywheel-ring, .flywheel-ring--rev, .flywheel-dot { animation: none; }
}
`;
