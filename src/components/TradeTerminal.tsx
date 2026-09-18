import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { formatUnits } from "ethers";
import { Search, Users, ArrowLeftRight, MessageSquare, ExternalLink, Globe, Droplets, Scale, Coins, Star, Dices, BarChart3, TrendingUp, TrendingDown, Zap, Gift, Flame, Activity } from "lucide-react";
import { ADDR, CHAIN, TOKEN_SYMBOL } from "../lib/chain";
import { GameTypeIcon } from "./GameTypeIcon";
import { fmtPrice, fmtInt, short } from "../lib/util";
import { PriceChart } from "./PriceChart";
import { SwapCard } from "./SwapCard";
import { SwapTicker } from "./SwapTicker";
import { CasinoTokenSwap } from "./CasinoSwap";
import { EconomyEngine } from "./EconomyEngine";
import { EconomySimulator } from "./EconomySimulator";
import { projectYearEnd } from "../lib/migaSim";
import { MidChat } from "./MidChat";
import { Avatar } from "./Avatar";
import { loadCasinoTokens, loadRoomsForToken, type TokenRoom } from "../lib/casino";
import { loadDexMap, fmtUsdShort, type DexToken } from "../lib/dexscreener";
import { loadProfilesMap, type Profile } from "../lib/midchat";
import { PokeButton } from "./PokeButton";

const AnalyticsInline = lazy(() => import("../pages/AnalyticsPage"));

export type MidgardMini = {
  price: number; poolEth: number; poolMid: number; supply: number; burned: number;
  buyFee: number; sellFee: number; myBal: number | null; mcapEth: number; pair: string;
  holderAnnual: number; poolAnnual: number; phi: number;
  circulating: number; reflected: number;
};

function compact(n: number): string {
  const a = Math.abs(n);
  // Keep precision near a billion so a deflating ~1B supply reads as "999.994M"
  // (deflation visible) instead of rounding up to "1000.00M".
  if (a >= 1e9) return (n / 1e9).toFixed(3) + "B";
  if (a >= 1e6) { const m = n / 1e6; return (m >= 999.995 ? m.toFixed(3) : m.toFixed(2)) + "M"; }
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Trade terminal (fomo.family-style 3-pane): a searchable token list on the left
 * (MIDGARD pinned first, then every casino token, sorted by momentum), the themed
 * chart + live trades + Holders/Chat/Stats in the centre, and a Buy/Sell + claim
 * panel on the right. MIDGARD trades against ETH; casino tokens against ETH via
 * the Robinhood DEX.
 */
export function TradeTerminal({ midgard, onSwapped, hideMidgard = false }: { midgard: MidgardMini; onSwapped: () => void; hideMidgard?: boolean }) {
  const [tokens, setTokens] = useState<DexToken[] | null>(null);
  const [sel, setSel] = useState<string>(() => {
    try { const st = localStorage.getItem("midgard.token.sel") || "midgard"; return hideMidgard && st === "midgard" ? "" : st; } catch { return ""; }
  });
  const pick = (s: string) => { setSel(s); try { localStorage.setItem("midgard.token.sel", s); } catch {} };
  const isMid = !hideMidgard && sel === "midgard";

  useEffect(() => {
    let live = true;
    (async () => {
      const addrs = await loadCasinoTokens().catch(() => []);
      if (!live) return;
      const map = await loadDexMap(addrs).catch(() => new Map<string, DexToken>());
      if (!live) return;
      const list = Array.from(map.values())
        .filter((t) => t.address.toLowerCase() !== ADDR.token.toLowerCase() && !!t.pairAddress)
        .sort((a, b) => (b.priceChangeH24 ?? -999) - (a.priceChangeH24 ?? -999));
      setTokens(list);
    })();
    return () => { live = false; };
  }, []);

  const selTok = !isMid ? tokens?.find((t) => t.address.toLowerCase() === sel.toLowerCase()) : undefined;

  // Resolve the selection once the token list loads. When ELCAS is hidden, an
  // empty/stale selection lands on the top casino token; otherwise it falls back
  // to ELCAS as before.
  useEffect(() => {
    if (!isMid && tokens && tokens.length > 0 && !selTok) pick(hideMidgard ? tokens[0].address : "midgard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMid, tokens, selTok, hideMidgard]);

  // No token selected yet (ELCAS hidden and the casino list is still loading or empty).
  const noSelection = hideMidgard && !isMid && !selTok;

  return (
    <div className="lg:grid lg:grid-cols-[clamp(230px,18vw,290px)_minmax(0,1fr)_clamp(300px,23vw,360px)] lg:gap-3 lg:items-start">
      <TokenListPane sel={sel} onSelect={pick} tokens={tokens} hideMidgard={hideMidgard} midgardApr={Math.max(0, midgard.poolAnnual - midgard.holderAnnual)} midgardPrice={midgard.price} />

      {noSelection ? (
        <div className="min-w-0 panel p-10 text-center text-bone-500 mt-3 lg:mt-0">
          {tokens === null ? "Loading casino tokens…" : "No casino tokens yet — deploy a game to start trading its token."}
        </div>
      ) : (
        <>
          <div className="min-w-0 space-y-3 mt-3 lg:mt-0">
            {isMid ? <MidgardHeader s={midgard} onPoked={onSwapped} /> : <CasinoHeader t={selTok} addr={sel} />}
            <PriceChart token={isMid ? ADDR.token : sel} pair={isMid ? midgard.pair : selTok?.pairAddress} quoteLabel="ETH" height={430} />
            <CenterTabs token={isMid ? ADDR.token : sel} isMid={isMid} midgard={midgard} />
          </div>

          <div className="min-w-0 space-y-3 mt-3 lg:mt-0">
            <TradeSidePanel>
              {isMid
                ? <MidgardTradeCard midgard={midgard} onSwapped={onSwapped} />
                : <CasinoTokenSwap token={sel} symbol={selTok?.symbol || short(sel)} priceUsd={selTok?.priceUsd ? Number(selTok.priceUsd) : undefined} onSwapped={onSwapped} />}
            </TradeSidePanel>
          </div>
        </>
      )}
    </div>
  );
}

// ── Right column: Swap / Chat tabs ────────────────────────────────────────────
function TradeSidePanel({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<"swap" | "chat">("swap");
  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex border-b border-ink-700/60">
        {([["swap", "Swap", ArrowLeftRight], ["chat", "Chat", MessageSquare]] as const).map(([k, label, Icon]) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition ${on ? "border-blood-500 text-bone-50" : "border-transparent text-bone-500 hover:text-bone-200"}`}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>
      {/* Keep the swap card mounted (preserves the entered amount / quote) and just
          hide it when Chat is open, so switching tabs doesn't reset a pending trade. */}
      <div className={tab === "swap" ? "block" : "hidden"}>{children}</div>
      {tab === "chat" && <div className="p-0"><MidChat /></div>}
    </div>
  );
}

// ── Right: ELCAS Buy/Sell card ────────────────────────────────────────────────
function MidgardTradeCard({ midgard, onSwapped }: { midgard: MidgardMini; onSwapped: () => void }) {
  return (
    <div>
      <SwapCard poolEth={midgard.poolEth} poolMid={midgard.poolMid} buyFeeBps={midgard.buyFee * 100} sellFeeBps={midgard.sellFee * 100} price={midgard.price} balance={midgard.myBal} onSwapped={onSwapped} />
    </div>
  );
}

// ── Left: token list ─────────────────────────────────────────────────────────
function TokenListPane({ sel, onSelect, tokens, hideMidgard, midgardApr, midgardPrice }: {
  sel: string; onSelect: (s: string) => void; tokens: DexToken[] | null; hideMidgard?: boolean; midgardApr: number; midgardPrice: number;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = (tokens ?? []).filter((t) => !term || t.symbol.toLowerCase().includes(term) || (t.name || "").toLowerCase().includes(term) || t.address.toLowerCase().includes(term));
  const midMatch = !hideMidgard && (!term || "elcas el-casino midgard".includes(term));
  return (
    <aside className="lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] panel p-0 overflow-hidden flex flex-col">
      <div className="p-2.5 border-b border-ink-700/60">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bone-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens…"
            className="w-full bg-ink-900/70 border border-ink-600 rounded-lg pl-8 pr-2 py-1.5 text-sm outline-none focus:border-blood-500 placeholder:text-bone-600" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide p-1.5 space-y-1 max-h-72 lg:max-h-none">
        {/* MIDGARD pinned first */}
        {midMatch && (
          <button onClick={() => onSelect("midgard")}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${sel === "midgard" ? "bg-ink-700/80 ring-1 ring-blood-500/40" : "hover:bg-ink-800/60"}`}>
            <TokLogo uri="./elcasino_logo.png" sym="ELCAS" size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate flex items-center gap-1">ELCAS <Star size={10} className="text-amber-400 fill-amber-400" /></div>
              <div className="font-mono text-[10px] text-bone-500 truncate">Protocol · ETH pair</div>
            </div>
            <div className="text-right shrink-0"><Pct v={midgardApr} suffix="/yr" /></div>
          </button>
        )}
        {tokens === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        {tokens && filtered.map((t) => {
          const active = sel.toLowerCase() === t.address.toLowerCase();
          return (
            <button key={t.address} onClick={() => onSelect(t.address)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${active ? "bg-ink-700/80 ring-1 ring-blood-500/40" : "hover:bg-ink-800/60"}`}>
              <TokLogo uri={t.logo} sym={t.symbol} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{t.symbol}</div>
                <div className="font-mono text-[10px] text-bone-500 truncate">{t.priceUsd ? "$" + (Number(t.priceUsd) < 1 ? Number(t.priceUsd).toPrecision(3) : Number(t.priceUsd).toFixed(2)) : short(t.address)}</div>
              </div>
              <div className="text-right shrink-0"><Pct v={t.priceChangeH24} /></div>
            </button>
          );
        })}
        {tokens && filtered.length === 0 && !midMatch && <div className="text-center text-bone-600 text-xs py-6">no tokens match “{q}”.</div>}
        <Link to="/casino" className="block px-2 py-2.5 text-center text-[11px] font-mono text-bone-500 hover:text-blood-300 inline-flex items-center justify-center gap-1 w-full">
          <Dices size={11} /> Launch a casino
        </Link>
      </div>
    </aside>
  );
}

function Pct({ v, suffix }: { v?: number; suffix?: string }) {
  if (v == null) return <span className="font-mono text-[10px] text-bone-600">—</span>;
  const up = v >= 0;
  return <span className={`font-mono text-[11px] font-bold inline-flex items-center gap-0.5 ${up ? "text-emerald-400" : "text-blood-400"}`}>{up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{up ? "+" : ""}{v.toFixed(v >= 100 ? 0 : 1)}%{suffix || ""}</span>;
}

// ── Center header ────────────────────────────────────────────────────────────
function StatChip({ k, v, tone, icon }: { k: string; v: React.ReactNode; tone?: "up" | "down"; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-bone-500 truncate inline-flex items-center gap-1">{icon}{k}</div>
      <div className={`font-mono text-[13px] font-bold tabular-nums truncate mt-0.5 ${tone === "up" ? "text-emerald-300" : tone === "down" ? "text-blood-300" : "text-bone-50"}`}>{v}</div>
    </div>
  );
}

function MidgardHeader({ s, onPoked }: { s: MidgardMini; onPoked?: () => void }) {
  const net = Math.max(0, s.poolAnnual - s.holderAnnual);
  // Live year-end estimate (neutral scenario) — same model as the Yield simulator.
  const ye = projectYearEnd(s.phi, s.holderAnnual, s.poolAnnual, s.buyFee + s.sellFee);
  return (
    <div className="panel p-0 overflow-hidden relative">
      {/* accent glow */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-blood-600/15 blur-3xl" />
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-700/50 bg-gradient-to-r from-blood-900/15 via-transparent to-transparent relative">
        <div className="relative shrink-0">
          <TokLogo uri="./elcasino_logo.png" sym={TOKEN_SYMBOL} size={42} />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900 mg-live-dot" title="live" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-bone-50 text-lg leading-none tracking-tight">{TOKEN_SYMBOL}</span>
            <span className="text-bone-500 font-mono text-[11px]">EL-Casino</span>
          </div>
          <a href={`${CHAIN.explorer}/token/${ADDR.token}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-bone-500 hover:text-blood-400 inline-flex items-center gap-1 mt-1">{short(ADDR.token)} <ExternalLink size={9} /></a>
        </div>
        <div className="ml-auto text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="font-mono font-bold text-xl sm:text-2xl tabular-nums text-bone-50 leading-none">{fmtPrice(s.price)} <span className="text-bone-500 text-sm">Ξ</span></div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span title="Instant holder edge right now: pool burn − holder decay" className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
              <Zap size={11} /> +{net.toFixed(0)}%/yr net
            </span>
            <span title="Estimated year-end holder value (neutral scenario, live model)" className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-900/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
              <TrendingUp size={11} /> ~{ye.holderValueX.toFixed(2)}x/yr est
            </span>
            <PokeButton compact onPoked={onPoked} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-ink-700/50">
        <StatChip k="Liquidity" icon={<Droplets size={10} className="text-cyan-400" />} v={`${s.poolEth.toFixed(3)} Ξ`} />
        <StatChip k="Market cap" icon={<Coins size={10} className="text-amber-400" />} v={`${s.mcapEth.toFixed(2)} Ξ`} />
        <StatChip k="Supply" icon={<Scale size={10} className="text-bone-400" />} v={fmtInt(s.supply)} />
        <StatChip k="Pool burn" icon={<Flame size={10} className="text-blood-400" />} v={`~${s.poolAnnual.toFixed(0)}%/yr`} tone="down" />
        <StatChip k="Burned" icon={<Activity size={10} className="text-blood-400" />} v={compact(s.burned)} tone="down" />
      </div>
    </div>
  );
}

function CasinoHeader({ t, addr }: { t?: DexToken; addr: string }) {
  if (!t) return <div className="panel h-[92px] skeleton" />;
  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-ink-700/50">
        <TokLogo uri={t.logo} sym={t.symbol} size={34} />
        <div className="min-w-0">
          <div className="font-bold text-bone-50 leading-tight truncate">{t.name || t.symbol} <span className="text-bone-500 font-mono text-xs">{t.symbol}</span></div>
          <a href={`${CHAIN.explorer}/token/${addr}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-bone-500 hover:text-blood-400 inline-flex items-center gap-1">{short(addr)} <ExternalLink size={9} /></a>
        </div>
        <span className="ml-auto"><Pct v={t.priceChangeH24} /></span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-ink-700/50">
        <StatChip k="Price" v={t.priceUsd ? "$" + (Number(t.priceUsd) < 1 ? Number(t.priceUsd).toPrecision(3) : Number(t.priceUsd).toFixed(2)) : "—"} />
        <StatChip k="Liquidity" v={t.liquidityUsd ? fmtUsdShort(t.liquidityUsd) : "—"} />
        <StatChip k="Mkt cap" v={t.marketCap ? fmtUsdShort(t.marketCap) : "—"} />
        <StatChip k="24h Vol" v={t.volumeH24 ? fmtUsdShort(t.volumeH24) : "—"} />
        <StatChip k="24h" v={t.priceChangeH24 != null ? (t.priceChangeH24 >= 0 ? "+" : "") + t.priceChangeH24.toFixed(1) + "%" : "—"} tone={(t.priceChangeH24 ?? 0) >= 0 ? "up" : "down"} />
      </div>
    </div>
  );
}

// ── Center bottom tabs — Swaps / Holders / Rooms|Yield / Chat ────────────────
type CTab = "swaps" | "holders" | "chat" | "yield" | "rooms" | "analytics";
function CenterTabs({ token, isMid, midgard }: { token: string; isMid: boolean; midgard: MidgardMini }) {
  const [tab, setTab] = useState<CTab>("swaps");
  useEffect(() => { setTab("swaps"); }, [isMid, token]); // reset when switching token
  const TABS: { k: CTab; label: string; icon: any }[] = [
    { k: "swaps", label: "Swaps", icon: ArrowLeftRight },
    { k: "holders", label: "Holders", icon: Users },
    ...(isMid ? [{ k: "yield" as CTab, label: "Yield", icon: Zap }] : [{ k: "rooms" as CTab, label: "Rooms", icon: Dices }]),
    ...(isMid ? [{ k: "analytics" as CTab, label: "Analytics", icon: BarChart3 }] : []),
  ];
  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex border-b border-ink-700/60">
        {TABS.map((t) => {
          const Icon = t.icon; const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition ${on ? "border-blood-500 text-bone-50" : "border-transparent text-bone-500 hover:text-bone-200"}`}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="p-2">
        {tab === "swaps" && (isMid ? <SwapTicker /> : <div className="text-center text-bone-500 text-sm py-8 inline-flex flex-col items-center gap-2 w-full"><BarChart3 size={20} className="text-bone-600" /> Live trades stream on the chart above.</div>)}
        {tab === "holders" && <HoldersList token={token} />}
        {tab === "rooms" && !isMid && <RoomsForToken token={token} />}
        {tab === "yield" && isMid && (
          <div className="p-1 space-y-3">
            <div className="rounded-xl border border-blood-500/25 bg-gradient-to-br from-blood-900/15 to-transparent p-3">
              <div className="flex items-center gap-2 text-blood-300 mb-1"><Zap size={14} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Your slice of every trade</span></div>
              <p className="text-[13px] text-bone-400 leading-relaxed">Every {TOKEN_SYMBOL} swap fee is <b className="text-bone-200">reflected to holders</b> instantly. Holders decay slowly while the pool burns faster (φ-adaptive) — the gap lifts real price. No claim, no lock-ups; your balance just grows from volume.</p>
            </div>
            <EconomyEngine eco={{
              supply: midgard.supply, burned: midgard.burned, reflected: midgard.reflected,
              poolMid: midgard.poolMid, poolEth: midgard.poolEth, price: midgard.price, circulating: midgard.circulating,
              holderAnnual: midgard.holderAnnual, poolAnnual: midgard.poolAnnual, phi: midgard.phi,
              feeTotal: midgard.buyFee + midgard.sellFee,
            }} />
            {/* Year-end yield calculator — seeded from the live φ / decay rates. */}
            <EconomySimulator supply={midgard.supply} poolMid={midgard.poolMid} circulating={midgard.circulating}
              holderAnnual={midgard.holderAnnual} poolAnnual={midgard.poolAnnual} phi={midgard.phi}
              feeTotal={midgard.buyFee + midgard.sellFee} />
          </div>
        )}
        {tab === "analytics" && isMid && (
          <Suspense fallback={<div className="py-12 text-center text-bone-500 text-sm">Loading analytics…</div>}>
            <div className="-mx-2 -mb-2"><AnalyticsInline /></div>
          </Suspense>
        )}
      </div>
    </div>
  );
}

// Open casino rooms that bet in the selected token — quick entry with live liq.
function RoomsForToken({ token }: { token: string }) {
  const [rooms, setRooms] = useState<TokenRoom[] | null>(null);
  useEffect(() => {
    let live = true; setRooms(null);
    loadRoomsForToken(token).then((r) => { if (live) setRooms(r); }).catch(() => { if (live) setRooms([]); });
    return () => { live = false; };
  }, [token]);
  if (rooms === null) return <div className="text-center text-bone-500 text-sm py-8">Loading rooms…</div>;
  if (rooms.length === 0) return (
    <div className="text-center text-bone-500 text-sm py-8 flex flex-col items-center gap-2">
      <Dices size={20} className="text-bone-600" /> No casino rooms for this token yet.
      <Link to="/casino" className="text-blood-300 hover:underline text-xs">Open a room →</Link>
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-2 p-1">
      {rooms.map((r) => (
        <Link key={r.address} to={`/casino/room/${r.gameKey}/${r.address}`}
          className="panel p-3 flex items-center gap-3 hover:border-emerald-500/50 transition">
          <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(140deg, ${r.color}, rgba(0,0,0,0.6))` }}>
            <GameTypeIcon type={r.gameKey as any} size={18} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{r.betName || `${r.gameLabel} room`}</div>
            <div className="font-mono text-[10px] text-bone-500 truncate capitalize">{r.gameLabel} · {r.stakers} stakers</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[9px] text-bone-500 uppercase tracking-wider inline-flex items-center gap-1 justify-end"><Droplets size={9} /> liq</div>
            <div className="font-mono text-xs font-bold text-emerald-300">{fmtInt(r.pool)} {r.symbol}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Generic top-holders list — loads once per token; social holders show a profile.
function HoldersList({ token }: { token: string }) {
  const [rows, setRows] = useState<{ address: string; balance: number; share: number }[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  useEffect(() => {
    let live = true;
    setRows(null); setProfiles(new Map()); setCount(null);
    (async () => {
      try {
        const res = await fetch(`${CHAIN.explorer}/api/v2/tokens/${token}/holders`);
        if (!res.ok) throw new Error(String(res.status));
        const j: any = await res.json();
        const items: any[] = j.items || [];
        const total = items.reduce((a, it) => a + Number(formatUnits(it.value ?? "0", 18)), 0);
        const parsed = items.slice(0, 20).map((it) => {
          const addr = it.address?.hash || it.address;
          const bal = Number(formatUnits(it.value ?? "0", 18));
          return { address: addr, balance: bal, share: total > 0 ? (bal / total) * 100 : 0 };
        });
        if (!live) return;
        setRows(parsed);
        if (typeof j.next_page_params?.items_count === "number") setCount(j.next_page_params.items_count);
        const map = await loadProfilesMap(parsed.map((p) => p.address)).catch(() => new Map<string, Profile>());
        if (live) setProfiles(map);
      } catch { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [token]);

  if (rows === null) return <div className="text-center text-bone-500 text-sm py-8">Loading holders…</div>;
  if (rows.length === 0) return <div className="text-center text-bone-500 text-sm py-8">No holder data available.</div>;
  return (
    <div className="divide-y divide-ink-700/50">
      {rows.map((h, i) => {
        const prof = profiles.get(h.address.toLowerCase());
        const social = !!prof?.username;
        const name = prof?.username || short(h.address);
        const to = prof?.username ? `/u/${prof.username}` : `/a/${h.address}`;
        return (
          <div key={h.address} className="flex items-center gap-2.5 px-1.5 py-2 text-sm">
            <span className="w-5 text-right font-mono text-xs text-bone-600 tabular-nums shrink-0">{i + 1}</span>
            {social
              ? <Link to={to} className="shrink-0"><Avatar uri={prof!.avatar_url} name={name} size={28} ring={false} /></Link>
              : <span className="h-7 w-7 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-[9px] font-mono text-bone-500 shrink-0">{h.address.slice(2, 4).toUpperCase()}</span>}
            <Link to={to} className="min-w-0 flex-1">
              <div className="font-medium truncate hover:text-blood-300 flex items-center gap-1.5">{name}{social && <span className="text-[8px] font-mono uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1 py-0.5 shrink-0">social</span>}</div>
              {social && <div className="font-mono text-[10px] text-bone-600 truncate">{short(h.address)}</div>}
            </Link>
            <div className="text-right shrink-0">
              <div className="font-mono font-semibold tabular-nums text-[13px]">{fmtInt(h.balance)}</div>
              <div className="text-[10px] text-bone-600 font-mono">{h.share.toFixed(2)}%</div>
            </div>
          </div>
        );
      })}
      {count !== null && <div className="text-center pt-2 font-mono text-[11px] text-bone-600">{fmtInt(count)} holders on-chain</div>}
    </div>
  );
}

// ── About panels ─────────────────────────────────────────────────────────────
function MidgardAbout() {
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-blood-400"><Coins size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">About {TOKEN_SYMBOL}</span></div>
      <p className="text-[13px] text-bone-400 leading-relaxed">The protocol token — ETH-paired. Every swap reflects to holders instantly; holders decay slowly while the pool burns faster at a φ-adaptive rate, pushing real price up. Fully autonomous — no claim, no auto-LP, no mirror-debt.</p>
      <div className="grid grid-cols-2 gap-2">
        <AboutLink href="/analytics" icon={<Scale size={13} />} label="Analytics" internal />
        <AboutLink href="/yield" icon={<Droplets size={13} />} label="Yield" internal />
        <AboutLink href={`${CHAIN.explorer}/token/${ADDR.token}`} icon={<ExternalLink size={13} />} label="Explorer" />
        <AboutLink href="/tokenomics" icon={<Coins size={13} />} label="Tokenomics" internal />
      </div>
    </div>
  );
}

function CasinoAbout({ t, addr }: { t?: DexToken; addr: string }) {
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-blood-400"><Dices size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">About {t?.symbol || "token"}</span></div>
      <p className="text-[13px] text-bone-400 leading-relaxed">A Robinhood-chain token used across EL-Casino. Trade it ETH ↔ {t?.symbol || "token"} here, or open a casino room for it.</p>
      <div className="grid grid-cols-2 gap-2">
        <AboutLink href="/casino" icon={<Dices size={13} />} label="Casino rooms" internal />
        {t?.url && <AboutLink href={t.url} icon={<BarChart3 size={13} />} label="DexScreener" />}
        <AboutLink href={`${CHAIN.explorer}/token/${addr}`} icon={<Globe size={13} />} label="Explorer" />
      </div>
    </div>
  );
}

function AboutLink({ href, icon, label, internal }: { href: string; icon: React.ReactNode; label: string; internal?: boolean }) {
  const cls = "inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900/50 px-2.5 py-2 text-xs text-bone-300 hover:border-blood-500/50 hover:text-blood-200 transition";
  if (internal) return <Link to={href} className={cls}>{icon}{label}</Link>;
  return <a href={href} target="_blank" rel="noreferrer" className={cls}>{icon}{label}</a>;
}

function TokLogo({ uri, sym, size }: { uri?: string; sym: string; size: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [uri]);
  if (uri && !bad) return <img src={uri} alt="" onError={() => setBad(true)} style={{ width: size, height: size }} className="rounded-full object-cover ring-1 ring-ink-600 bg-ink-800 shrink-0" />;
  return <span style={{ width: size, height: size, fontSize: size * 0.4 }} className="rounded-full grid place-items-center font-bold text-ink-950 bg-blood-500 shrink-0">{(sym || "?")[0]}</span>;
}
