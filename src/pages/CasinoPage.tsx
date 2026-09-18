import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ExternalLink, Clock, Plus, Landmark, Droplets, TrendingUp, Dices, Rocket, ChevronLeft, ChevronRight } from "lucide-react";
import { CASINO_GAMES, CasinoGameKind, GameKey, loadFactoryStats, loadFactoryGames, FactoryGame, readRoomsBatch, RoomStats, fmtBet, loadUserPositions, UserPosition, DEPLOY_FEE_WEI, isMidgardFamilyAddr, isBlockedCasinoToken } from "../lib/casino";
import { useWallet } from "../lib/wallet";
import { Wallet, ArrowLeft, Loader2, Coins, BarChart3 } from "lucide-react";
import { CasinoAnalytics, CasinoStatsStrip } from "../components/CasinoAnalytics";
import { RWA_PRESETS } from "../lib/rwa";
import { RWA_TOKENS, RWA_ADDRESS_SET } from "../lib/rwaTokens";
import { CHAIN } from "../lib/chain";
import { fmtInt, short, timeAgo } from "../lib/util";
import { GameTypeIcon } from "../components/GameTypeIcon";
import { CreateGameDialog } from "../components/CreateGameDialog";
import { loadRobinhoodTokens, loadDexMap, DexToken, fmtUsdShort, ROBINHOOD_CHAIN } from "../lib/dexscreener";
import { RecentBets } from "../components/RecentBets";
import { PonsBanner } from "../components/PonsBanner";

const PAGE = 24;
const DEPLOY_PAGE = 10;   // RWA / Other deploy shelves paginate at 10 per page

// Every tokenized asset (the full 192-token rh-scan registry) plus the curated
// presets counts as a Real World Asset for classification + column routing.
const RWA_SET = (() => {
  const s = new Set<string>(RWA_ADDRESS_SET);
  for (const p of RWA_PRESETS) if (p.address) s.add(p.address.toLowerCase());
  return s;
})();

// RWA stock tokens carry no DexScreener logo, so we fill them from our presets.
const RWA_META = (() => {
  const m = new Map<string, { logo?: string; label: string }>();
  for (const p of RWA_PRESETS) if (p.address) m.set(p.address.toLowerCase(), { logo: p.logo, label: p.label });
  return m;
})();

// Existing on-chain rooms are noisy; we surface only these curated tokens as
// live rooms. Everything else is offered as a fresh deploy instead.
const LIVE_ROOM_WHITELIST = new Set<string>([
  "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec", // NVDA
]);

const isBlockedTok = (addr?: string, symbol?: string) => isBlockedCasinoToken(addr, symbol);

const DEPLOY_FEE_ETH = formatUnits(DEPLOY_FEE_WEI, 18);

// Animated hero: slow Ken-Burns on back.png, floating glow orbs, and a periodic
// light sheen sweeping across. Respects prefers-reduced-motion.
const CASINO_HERO_CSS = `
.casino-hero { min-height: 200px; }
.casino-hero-img { opacity: .45; transform: scale(1.08); animation: casino-zoom 26s ease-in-out infinite alternate; }
.casino-orb { animation: casino-float 9s ease-in-out infinite; }
.casino-orb--2 { animation-duration: 13s; animation-direction: reverse; }
.casino-sheen { background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.06) 50%, transparent 60%); background-size: 250% 100%; animation: casino-sheen 7s ease-in-out infinite; }
.casino-cta { transition: transform .15s ease, box-shadow .15s ease; }
.casino-cta:hover { transform: translateY(-1px) scale(1.02); }
@keyframes casino-zoom { from { transform: scale(1.08); } to { transform: scale(1.18); } }
@keyframes casino-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
@keyframes casino-sheen { 0% { background-position: 180% 0; } 55%,100% { background-position: -80% 0; } }
@media (prefers-reduced-motion: reduce) {
  .casino-hero-img, .casino-orb, .casino-sheen { animation: none; }
}
`;

/**
 * EL-Casino — a persistent game-type tab bar (Roulette, Crash, …). The
 * selected game shows its rooms split 50/50: All rooms on the left, RWA-token
 * rooms on the right. Everything on-chain; we only read the factories.
 */
export default function CasinoPage() {
  const [sp, setSp] = useSearchParams();
  const activeKey = (CASINO_GAMES.find((g) => g.key === sp.get("g"))?.key) ?? "roulette";
  const game = CASINO_GAMES.find((g) => g.key === activeKey)!;
  const [creating, setCreating] = useState(false);
  const [deployToken, setDeployToken] = useState<DexToken | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [deployables, setDeployables] = useState<DexToken[] | null>(null);
  const [rwaDex, setRwaDex] = useState<Map<string, DexToken> | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const pairs = await Promise.all(CASINO_GAMES.map(async (g) => [g.key, (await loadFactoryStats(g.factory)).total] as const));
      if (!live) return;
      const m: Record<string, number> = {};
      for (const [k, n] of pairs) m[k] = n;
      setTotals(m);
    })().catch(() => {});
    return () => { live = false; };
  }, []);

  // "Other" deploy universe — top Robinhood memecoins by market cap (name search).
  useEffect(() => {
    let live = true;
    loadRobinhoodTokens().then((list) => { if (live) setDeployables(list); })
      .catch(() => { if (live) setDeployables([]); });
    return () => { live = false; };
  }, []);

  // RWA deploy universe — the full 192-token tokenized-asset registry, enriched
  // with any DexScreener pair (logo + liquidity) in batched calls. Non-blocking:
  // the registry renders immediately; logos/liquidity fill in when this resolves.
  useEffect(() => {
    let live = true;
    loadDexMap(RWA_TOKENS.map((t) => t.address)).then((m) => { if (live) setRwaDex(m); })
      .catch(() => { if (live) setRwaDex(new Map()); });
    return () => { live = false; };
  }, []);

  const openDeploy = (t: DexToken) => { setDeployToken(t); setCreating(true); };

  if (creating) return <CreateGameDialog defaultGame={activeKey} defaultToken={deployToken} onClose={() => { setCreating(false); setDeployToken(null); }} />;
  if (sp.get("view") === "position") return <PositionsView onBack={() => setSp({})} />;
  if (sp.get("view") === "analytics") return (
    <div className="animate-fade-up">
      <button onClick={() => setSp({})} className="btn-ghost mb-4 py-1 px-3 text-xs inline-flex items-center gap-1"><ArrowLeft size={13} /> Back to games</button>
      <CasinoAnalytics />
    </div>
  );

  return (
    <div className="animate-fade-up">
      <style>{CASINO_HERO_CSS}</style>
      {/* Hero — back.png with animated glow + neon title */}
      <div className="casino-hero relative overflow-hidden rounded-2xl mb-4 border border-ink-700/60">
        <img src="./back.png" alt="" aria-hidden className="casino-hero-img absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/70 to-ink-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-transparent" />
        <div className="casino-orb pointer-events-none absolute -top-16 -left-10 h-52 w-52 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="casino-orb casino-orb--2 pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-blood-500/25 blur-3xl" />
        <div className="casino-sheen pointer-events-none absolute inset-0" />
        <div className="relative px-5 sm:px-8 py-9 sm:py-14">
          <div className="inline-flex items-center gap-2 text-emerald-300">
            <span className="mg-live-dot h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.32em]">EL-Casino · on-chain</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight mg-neon leading-none">Play the halls</h1>
          <p className="text-bone-300 text-sm sm:text-base mt-3 max-w-lg">Provably-fair games on any token — or stake a pool's <span className="text-emerald-300 font-semibold">Earn</span> tab and become the house.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setCreating(true)} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 casino-cta">
              <Plus size={16} /> Create a room
            </button>
            <button onClick={() => setSp({ view: "analytics" })} className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-900/60 px-5 py-2.5 text-sm font-semibold text-bone-100 hover:border-emerald-500/50 hover:text-emerald-200 backdrop-blur transition">
              <BarChart3 size={16} /> Analytics
            </button>
          </div>
        </div>
      </div>

      {/* ELCAS-on-Pons launch banner */}
      <div className="mb-4"><PonsBanner /></div>

      {/* Top action tabs — Analytics · Your positions · Create room, side by side */}
      <div className="grid grid-cols-3 gap-1.5 p-1 mb-4 rounded-xl border border-ink-700/60 bg-ink-900/40">
        <ActionTab icon={BarChart3} label="Analytics" accent="blood" onClick={() => setSp({ view: "analytics" })} />
        <ActionTab icon={Wallet} label="Your positions" shortLabel="Positions" accent="purple" onClick={() => setSp({ view: "position" })} />
        <ActionTab icon={Plus} label="Create room" shortLabel="Create" accent="red" onClick={() => setCreating(true)} />
      </div>

      {/* Live casino stats — non-blocking, links to full analytics */}
      <CasinoStatsStrip onOpen={() => setSp({ view: "analytics" })} />

      {/* Live bet feed — avalove-style card strip, streams new bets in realtime */}
      <RecentBets />

      {/* Game-type tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-ink-700/60 mb-4 pb-px">
        {CASINO_GAMES.map((g) => {
          const on = g.key === activeKey;
          return (
            <button key={g.key} onClick={() => setSp({ g: g.key })}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                on ? "border-current" : "border-transparent text-bone-500 hover:text-bone-200"}`}
              style={on ? { color: g.color } : undefined}>
              <GameTypeIcon type={g.key} size={16} animate={on} />
              {g.label}
              {totals[g.key] != null && <span className="text-[9px] opacity-60">{fmtInt(totals[g.key])}</span>}
            </button>
          );
        })}
      </div>

      {/* Live rooms (curated) + a market-cap-ranked shelf of deployable tokens */}
      <CategoryRooms key={game.key} game={game} deployables={deployables} rwaDex={rwaDex} onDeploy={openDeploy} />

    </div>
  );
}

function ActionTab({ icon: Icon, label, shortLabel, accent, onClick }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; shortLabel?: string; accent: "blood" | "purple" | "red"; onClick: () => void;
}) {
  const tint = {
    blood: "text-blood-300 hover:bg-blood-900/30 hover:text-blood-200",
    purple: "text-purple-300 hover:bg-purple-900/30 hover:text-purple-200",
    red: "text-bone-50 bg-gradient-to-b from-blood-600/35 to-blood-700/20 hover:from-blood-600/55 hover:to-blood-700/35 shadow-[inset_0_0_0_1px_rgba(255,45,61,0.25)]",
  }[accent];
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition ${tint}`}>
      <Icon size={16} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel ?? label}</span>
    </button>
  );
}

function PositionsView({ onBack }: { onBack: () => void }) {
  const w = useWallet();
  const [rows, setRows] = useState<UserPosition[] | null>(null);

  useEffect(() => {
    let live = true;
    if (!w.address) { setRows([]); return; }
    setRows(null);
    loadUserPositions(w.address).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [w.address]);

  const fmtV = (v: bigint, d: number) => fmtBet(v, d);

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="btn-ghost mb-4 py-1 px-3 text-xs inline-flex items-center gap-1"><ArrowLeft size={13} /> Back to games</button>
      <div className="flex items-center gap-3 mb-4">
        <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-fuchsia-700 text-white"><Coins size={20} /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your positions</h1>
          <p className="text-xs text-bone-500 font-mono">every pool you've staked in — value, pending fees, and pool share</p>
        </div>
      </div>

      {!w.address && <div className="panel p-10 text-center text-bone-500">Connect your wallet to see your positions.</div>}
      {w.address && rows === null && <div className="panel p-10 text-center text-bone-500"><Loader2 className="animate-spin mx-auto mb-2" /> scanning pools for your stake…</div>}
      {w.address && rows && rows.length === 0 && (
        <div className="panel p-10 text-center text-bone-500">
          <Coins size={30} className="mx-auto mb-2 opacity-50" />
          you haven't staked in any pool yet. Open a room's <span className="text-purple-300">Earn</span> tab to become the house.
        </div>
      )}
      {w.address && rows && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link key={p.address} to={`/casino/room/${p.gameKey}/${p.address}`} className="panel p-3 flex items-center gap-3 hover:border-purple-500/50 transition">
              <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: `linear-gradient(140deg, ${p.color}, rgba(0,0,0,0.6))` }}>
                <GameTypeIcon type={p.gameKey} size={22} className="text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{p.betName || `${p.gameLabel} room`}</div>
                <div className="font-mono text-[11px] text-bone-500 truncate">{p.gameLabel} · {p.symbol} · {p.sharePct.toFixed(2)}% of pool</div>
              </div>
              <div className="hidden sm:block text-right shrink-0 w-28">
                <div className="font-mono text-[9px] text-bone-500 uppercase tracking-wider">Staked value</div>
                <div className="font-mono text-sm font-bold text-emerald-300">{fmtV(p.value, p.decimals)} {p.symbol}</div>
              </div>
              <div className="text-right shrink-0 w-24">
                <div className="font-mono text-[9px] text-bone-500 uppercase tracking-wider">Pending</div>
                <div className={`font-mono text-sm font-bold ${p.pending > 0n ? "text-amber-300" : "text-bone-500"}`}>{fmtV(p.pending, p.decimals)}</div>
              </div>
              <span className="btn-primary py-1.5 px-3 text-xs shrink-0">Manage</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type Row = FactoryGame & { symbol: string; stats?: RoomStats; isRwa: boolean };

// Short-TTL cache of loaded rooms per game so switching category tabs is instant
// (re-render shows the last list immediately, then a background refresh updates it).
const _roomsCache = new Map<string, { at: number; rows: Row[] }>();

function CategoryRooms({ game, deployables, rwaDex, onDeploy }: { game: CasinoGameKind; deployables: DexToken[] | null; rwaDex: Map<string, DexToken> | null; onDeploy: (t: DexToken) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"mcap" | "liquidity">("mcap");
  const [cat, setCat] = useState<"rwa" | "other">("rwa");

  useEffect(() => {
    let live = true;
    // Show cached rooms instantly (tab switches feel instant), then refresh in bg.
    const cached = _roomsCache.get(game.key);
    setRows(cached ? cached.rows : null);
    const fresh = cached && Date.now() - cached.at < 30_000;
    (async () => {
      const fs = await loadFactoryStats(game.factory);
      if (!live) return;
      const start = Math.max(0, fs.total - PAGE);
      const games = await loadFactoryGames(game.factory, start, Math.min(PAGE, fs.total - start));
      if (!live) return;
      const reversed = [...games].reverse();
      const base: Row[] = reversed.map((g) => ({ ...g, symbol: short(g.token), isRwa: RWA_SET.has(g.token.toLowerCase()) }));
      if (!cached) setRows(base); // only replace with placeholders when we had nothing cached
      // One multicall for every room's stats + one for their token metadata,
      // instead of 3 individual reads per room — far fewer RPC round-trips.
      const batch = await readRoomsBatch(reversed.map((r) => ({ address: r.address, token: r.token })));
      if (!live) return;
      const full = base.map((r, i) => ({ ...r, symbol: batch[i]?.symbol ?? r.symbol, stats: batch[i]?.stats }));
      _roomsCache.set(game.key, { at: Date.now(), rows: full });
      setRows(full);
    })().catch(() => { if (live && !fresh) setRows((prev) => prev ?? []); });
    return () => { live = false; };
  }, [game.key]);

  const term = q.trim().toLowerCase();
  const matchTok = (t: DexToken) => !term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term) || t.address.toLowerCase().includes(term);
  const byMetric = (a: DexToken, b: DexToken) =>
    sort === "liquidity" ? (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0) : (b.marketCap ?? 0) - (a.marketCap ?? 0);

  const liveRooms = rows
    ? rows.filter((row) => !isBlockedTok(row.token, row.symbol) && (!term || row.betName.toLowerCase().includes(term) || row.token.toLowerCase().includes(term) || row.symbol.toLowerCase().includes(term)))
    : null;

  const isRwaTok = (t: DexToken) => RWA_SET.has(t.address.toLowerCase());

  // RWA column: the full tokenized-asset registry, enriched with any DexScreener
  // pair (logo + liquidity) — every asset is deployable even without a pool, so
  // we DON'T require a logo here (a symbol glyph stands in). Renders immediately.
  const rwaBase: DexToken[] = useMemo(() => RWA_TOKENS.map((rt) => {
    const dx = rwaDex?.get(rt.address);
    const presetLogo = RWA_META.get(rt.address)?.logo;
    return {
      address: rt.address, name: rt.name, symbol: rt.symbol, chainId: ROBINHOOD_CHAIN,
      logo: dx?.logo || presetLogo,
      pairAddress: dx?.pairAddress, priceUsd: dx?.priceUsd, liquidityUsd: dx?.liquidityUsd,
      marketCap: dx?.marketCap ?? rt.mcap, url: dx?.url,
    };
  }), [rwaDex]);
  const deRwa = rwaBase.filter((t) => !isMidgardFamilyAddr(t.address) && !isBlockedTok(t.address, t.symbol) && matchTok(t)).sort(byMetric);

  // "Other" column: memecoins from name search. These are noise-prone, so we keep
  // the logo requirement and drop anything already classified RWA.
  const deOther = deployables
    ? deployables.filter((t) => !!t.logo && !isRwaTok(t) && !isMidgardFamilyAddr(t.address) && !isBlockedTok(t.address, t.symbol) && matchTok(t)).sort(byMetric)
    : null;

  const liveRwa = liveRooms ? liveRooms.filter((r) => r.isRwa) : null;
  const liveOther = liveRooms ? liveRooms.filter((r) => !r.isRwa) : null;

  return (
    <div>
      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens by name, symbol or paste an address…"
            className="w-full bg-ink-900/70 border border-ink-600 rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:border-blood-500 font-mono placeholder:text-bone-600 placeholder:font-sans" />
        </div>
        <div className="inline-flex rounded-full border border-ink-600 overflow-hidden">
          {([["mcap", "Market cap"], ["liquidity", "Liquidity"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 text-xs font-mono ${sort === k ? "bg-ink-700 text-bone-100" : "text-bone-400 hover:text-bone-100"}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Mobile: a Real World Assets | Other tab switcher. Desktop shows both
          columns 50/50, so the switcher is hidden there. */}
      <div className="lg:hidden flex items-center gap-1 border-b border-ink-700/60 mb-4">
        <CatTabBtn active={cat === "rwa"} rwa onClick={() => setCat("rwa")} count={deRwa?.length}>Real World Assets</CatTabBtn>
        <CatTabBtn active={cat === "other"} onClick={() => setCat("other")} count={deOther?.length}>Other</CatTabBtn>
      </div>

      <p className="text-[11px] font-mono text-bone-500 mb-4">Top Robinhood tokens by market cap — spin up a fresh {game.label} room. Deploy fee <span className="text-bone-300">{DEPLOY_FEE_ETH} ETH</span>.</p>

      {/* Desktop: 50/50 columns, both categories visible at once. Mobile: only the
          tab-selected column shows. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-5">
        <div className={cat === "rwa" ? "" : "hidden lg:block"}>
          <CategoryColumn game={game} rwa liveRooms={liveRwa} deploy={deRwa} onDeploy={onDeploy} q={q} />
        </div>
        <div className={cat === "other" ? "" : "hidden lg:block"}>
          <CategoryColumn game={game} liveRooms={liveOther} deploy={deOther} onDeploy={onDeploy} q={q} />
        </div>
      </div>
    </div>
  );
}

function CatTabBtn({ active, rwa, onClick, count, children }: { active: boolean; rwa?: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  // The Real World Assets tab carries an emerald diagonal weave when active so
  // tokenized stocks read apart from the plain "Other" memecoins at a glance.
  const weave = "repeating-linear-gradient(45deg, rgba(16,185,129,0.18) 0 5px, rgba(16,185,129,0.03) 5px 11px)";
  return (
    <button onClick={onClick}
      style={rwa && active ? { backgroundImage: weave } : undefined}
      className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-mono uppercase tracking-wider border-b-2 -mb-px rounded-t-lg transition ${
        active
          ? rwa ? "border-emerald-500 text-emerald-100" : "border-blood-500 text-bone-50"
          : rwa ? "border-transparent text-emerald-300/70 hover:text-emerald-200" : "border-transparent text-bone-500 hover:text-bone-200"
      }`}>
      {rwa ? <Landmark size={13} /> : <Coins size={13} />}
      {children}
      {count != null && <span className="opacity-60">· {count}</span>}
    </button>
  );
}

function ColHeading({ rwa, count }: { rwa?: boolean; count?: number }) {
  // The Real World Assets heading carries an emerald diagonal weave so tokenized
  // stocks read apart from the plain "Other" memecoins at a glance.
  const weave = "repeating-linear-gradient(45deg, rgba(16,185,129,0.18) 0 5px, rgba(16,185,129,0.03) 5px 11px)";
  return (
    <div className="hidden lg:flex items-center gap-2.5 mb-3">
      <span style={rwa ? { backgroundImage: weave } : undefined}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider border ${
          rwa ? "border-emerald-500/50 text-emerald-100" : "border-ink-600 text-bone-300 bg-ink-800/50"}`}>
        {rwa ? <Landmark size={13} /> : <Coins size={13} />}
        {rwa ? "Real World Assets" : "Other"}
        {count != null && <span className="opacity-60">· {count}</span>}
      </span>
      <span className={`h-px flex-1 bg-gradient-to-r to-transparent ${rwa ? "from-emerald-500/40" : "from-ink-500/50"}`} />
    </div>
  );
}

function CategoryColumn({ game, rwa, liveRooms, deploy, onDeploy, q }: { game: CasinoGameKind; rwa?: boolean; liveRooms: Row[] | null; deploy: DexToken[] | null; onDeploy: (t: DexToken) => void; q: string }) {
  const hasLive = !!(liveRooms && liveRooms.length > 0);
  const [page, setPage] = useState(0);
  const total = deploy?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / DEPLOY_PAGE));
  // Reset to the first page whenever the search term, category or game changes.
  useEffect(() => { setPage(0); }, [q, rwa, game.key]);
  useEffect(() => { if (page > pageCount - 1) setPage(0); }, [page, pageCount]);
  const shown = deploy ? deploy.slice(page * DEPLOY_PAGE, page * DEPLOY_PAGE + DEPLOY_PAGE) : null;
  return (
    <div>
      <ColHeading rwa={rwa} count={deploy?.length} />
      {liveRooms === null ? (
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2 inline-flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Loading live rooms…</div>
          <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="panel h-[64px] skeleton" />)}</div>
        </div>
      ) : hasLive && (
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2 inline-flex items-center gap-1.5"><Dices size={11} /> Live · {liveRooms!.length}</div>
          <div className="space-y-2.5">{liveRooms!.map((r) => <RoomRow key={r.address} game={game} r={r} />)}</div>
        </div>
      )}
      {hasLive && <div className="text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-2 inline-flex items-center gap-1.5"><Rocket size={11} /> Ready to deploy</div>}
      {deploy === null ? (
        <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="panel h-[92px] skeleton" />)}</div>
      ) : deploy.length === 0 ? (
        <div className="panel p-8 text-center text-bone-500 text-sm">{q ? `no tokens match “${q}”.` : rwa ? "no RWA tokens available." : "no tokens available."}</div>
      ) : (
        <>
          <div className="space-y-2.5">{shown!.map((t) => <DeployCard key={t.address} game={game} t={t} onDeploy={onDeploy} />)}</div>
          {pageCount > 1 && <Pager page={page} pageCount={pageCount} total={total} onPage={setPage} />}
        </>
      )}
    </div>
  );
}

function Pager({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (p: number) => void }) {
  const from = page * DEPLOY_PAGE + 1;
  const to = Math.min(total, (page + 1) * DEPLOY_PAGE);
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0}
        className="inline-flex items-center gap-1 rounded-full border border-ink-600 px-3 py-1.5 text-xs font-mono text-bone-300 hover:border-blood-500/60 hover:text-bone-100 disabled:opacity-40 disabled:cursor-not-allowed">
        <ChevronLeft size={13} /> Prev
      </button>
      <span className="font-mono text-[11px] text-bone-500 tabular-nums">
        {from}–{to} <span className="text-bone-600">of {total}</span> · pg {page + 1}/{pageCount}
      </span>
      <button onClick={() => onPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}
        className="inline-flex items-center gap-1 rounded-full border border-ink-600 px-3 py-1.5 text-xs font-mono text-bone-300 hover:border-blood-500/60 hover:text-bone-100 disabled:opacity-40 disabled:cursor-not-allowed">
        Next <ChevronRight size={13} />
      </button>
    </div>
  );
}

// Real-world-asset logos: rh-scan ships only a generic icon, so we pull the
// actual stock/ETF logo by ticker. Financial Modeling Prep covers ~all Robinhood
// tickers (stocks + ETFs); parqet is the fallback, then the DexScreener pair
// logo, then a ticker glyph. Advances through the chain on each load error.
const FMP_LOGO = (t: string) => `https://financialmodelingprep.com/image-stock/${encodeURIComponent(t)}.png`;
const PARQET_LOGO = (t: string) => `https://assets.parqet.com/logos/symbol/${encodeURIComponent(t)}?format=png`;

function AssetLogo({ symbol, dexLogo, isRwa, size = 40, className = "" }: { symbol: string; dexLogo?: string; isRwa?: boolean; size?: number; className?: string }) {
  const candidates = useMemo(() => {
    const sym = (symbol || "").replace(/[^A-Za-z0-9.]/g, "");
    const list: string[] = [];
    if (isRwa && sym) list.push(FMP_LOGO(sym), PARQET_LOGO(sym));
    if (dexLogo) list.push(dexLogo);
    return list;
  }, [symbol, dexLogo, isRwa]);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [candidates.join("|")]);
  const dim = { width: size, height: size };
  const url = candidates[i];
  if (!url) return (
    <div style={dim} className={`rounded-full border border-ink-600 bg-ink-850 flex items-center justify-center text-[11px] font-mono text-bone-400 shrink-0 ${className}`}>{(symbol || "?").slice(0, 4)}</div>
  );
  return <img src={url} alt={symbol} loading="lazy" style={dim} onError={() => setI((n) => n + 1)}
    className={`rounded-full border border-ink-600 bg-ink-900 object-cover shrink-0 ${className}`} />;
}

function DeployCard({ game, t, onDeploy }: { game: CasinoGameKind; t: DexToken; onDeploy: (t: DexToken) => void }) {
  const isRwa = RWA_SET.has(t.address.toLowerCase());
  return (
    <div className="panel p-3.5 flex flex-col gap-2.5 hover:border-blood-500/50 transition">
      <div className="flex items-center gap-2.5">
        <AssetLogo symbol={t.symbol} dexLogo={t.logo} isRwa={isRwa} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[15px] leading-tight truncate flex items-center gap-1.5">
            {t.symbol}
            {isRwa && <span className="text-[8px] font-mono uppercase tracking-wider text-emerald-300 border border-emerald-500/40 rounded px-1 py-0.5">RWA</span>}
          </div>
          <div className="font-mono text-[11px] text-bone-500 truncate">{t.name || short(t.address)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[11px] text-bone-400 whitespace-nowrap">
          mc {fmtUsdShort(t.marketCap)} <span className="text-bone-600">· fee {DEPLOY_FEE_ETH} ETH</span>
        </div>
        <button onClick={() => onDeploy(t)} title={`Deploy a ${game.label} room for ${t.symbol}`}
          className="btn-primary py-1.5 px-3.5 text-xs shrink-0 inline-flex items-center gap-1"><Rocket size={13} /> Deploy</button>
      </div>
    </div>
  );
}

function RoomRow({ game, r }: { game: CasinoGameKind; r: Row }) {
  const d = r.stats?.decimals ?? 18;
  return (
    <Link to={`/casino/room/${game.key}/${r.address}`} className="panel p-3 flex items-center gap-3 hover:border-blood-500/50 transition">
      {r.tokenLogoUrl ? (
        <img src={r.tokenLogoUrl} alt="" className="h-9 w-9 rounded-full border border-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="h-9 w-9 rounded-full border border-ink-600 bg-ink-850 flex items-center justify-center text-[10px] font-mono text-bone-500 shrink-0">{r.symbol.slice(0, 4)}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
          {r.betName || "unnamed room"}
          {r.isRwa && <span className="text-[8px] font-mono uppercase tracking-wider text-emerald-300 border border-emerald-500/40 rounded px-1 py-0.5">RWA</span>}
        </div>
        <div className="font-mono text-[11px] text-bone-500 truncate">{r.symbol} · <Clock size={9} className="inline" /> {timeAgo(r.createdAt)}</div>
      </div>
      <div className="hidden sm:block text-right shrink-0">
        <div className="font-mono text-[9px] text-bone-500 uppercase tracking-wider inline-flex items-center gap-1 justify-end"><Droplets size={9} /> liq</div>
        <div className="font-mono text-xs font-bold text-emerald-300">{r.stats ? fmtBet(r.stats.pool, d) : "…"}</div>
      </div>
      <span className="btn-primary py-1.5 px-3 text-xs shrink-0">Play</span>
    </Link>
  );
}
