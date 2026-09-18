import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Coins, Dices, Loader2, Landmark } from "lucide-react";
import { CASINO_GAMES, loadFactoryStats, loadFactoryGames, tokenSymbol, tokenDecimals, loadCasinoTokens } from "../lib/casino";
import { loadDexMap, fmtUsdShort, type DexToken } from "../lib/dexscreener";
import { ADDR } from "../lib/chain";
import { Contract, formatUnits } from "ethers";
import { readProvider } from "../lib/chain";
import { short } from "../lib/util";
import type { TokenEmbed, GameEmbed } from "../lib/social";

// Read a room's live metrics for the embed — pool/volume/stakers/bets + RTP/fee.
const ROOM_ABI = [
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
  "function config() view returns (uint256 rtpBasisPoints, uint256 feeBasisPoints, uint256 maxWinBasisPoints, uint256 minBet, uint256 maxBetPoolRatio)",
];
async function readRoomEmbed(address: string, token: string) {
  let pool = 0n, volume = 0n, stakers = 0, bets = 0n, rtp = 0, fee = 0;
  try {
    const g = new Contract(address, ROOM_ABI, readProvider);
    const [gi, cfg] = await Promise.all([g.getGameInfo(), g.config().catch(() => null)]);
    pool = gi[4]; volume = gi[6]; bets = gi[5]; stakers = Number(gi[11]);
    if (cfg) { rtp = Number(cfg[0]); fee = Number(cfg[1]); }
  } catch {}
  const decimals = await tokenDecimals(token);
  return { pool, volume, stakers, bets, rtp, fee, decimals };
}

type Picked = { kind: "token"; meta: TokenEmbed } | { kind: "game"; meta: GameEmbed };

/**
 * Avalove-style attach picker for the composer — lets a user drop a token card
 * (live price/liq/mcap) or a casino room card (live pool/volume/stakers) straight
 * into a post without leaving the home feed. Metrics are captured at pick time.
 */
export function SharePicker({ onPick, onClose }: { onPick: (p: Picked) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"token" | "game">("token");

  // Lock body scroll and close on Escape while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Rendered through a portal to <body> so it escapes any transformed/overflow
  // ancestor (the composer's animate-fade-up) — a true full-screen popup.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg panel p-0 overflow-hidden animate-fade-up mt-[6vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700/60">
          <div className="font-semibold text-sm">Attach to post</div>
          <button onClick={onClose} className="text-bone-500 hover:text-blood-400"><X size={16} /></button>
        </div>
        <div className="flex gap-1 p-1 m-3 rounded-xl bg-ink-800/70 border border-ink-700/70">
          <TabBtn on={tab === "token"} onClick={() => setTab("token")} icon={<Coins size={14} />}>Token</TabBtn>
          <TabBtn on={tab === "game"} onClick={() => setTab("game")} icon={<Dices size={14} />}>Casino room</TabBtn>
        </div>
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          {tab === "token" ? <TokenPicker onPick={(meta) => onPick({ kind: "token", meta })} /> : <GamePicker onPick={(meta) => onPick({ kind: "game", meta })} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

function TabBtn({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${on ? "bg-ink-600 text-bone-50" : "text-bone-400 hover:text-bone-100"}`}>
      {icon}{children}
    </button>
  );
}

// ── Token picker — MIDGARD + casino tokens (no external/DEX-wide tokens) ───────
type PickTok = { address: string; symbol: string; name: string; logo?: string; priceUsd?: number; liqUsd?: number; mcapUsd?: number; isMid?: boolean };

function TokenPicker({ onPick }: { onPick: (m: TokenEmbed) => void }) {
  const [q, setQ] = useState("");
  const [toks, setToks] = useState<PickTok[] | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const addrs = await loadCasinoTokens().catch(() => []);
      const map = await loadDexMap(addrs).catch(() => new Map<string, DexToken>());
      if (!live) return;
      const list: PickTok[] = [{ address: ADDR.token, symbol: "ELCAS", name: "EL-Casino", logo: "./elcasino_logo.png", isMid: true }];
      for (const t of Array.from(map.values()).filter((t) => t.address.toLowerCase() !== ADDR.token.toLowerCase())) {
        list.push({ address: t.address, symbol: t.symbol, name: t.name, logo: t.logo, priceUsd: t.priceUsd ? Number(t.priceUsd) : undefined, liqUsd: t.liquidityUsd, mcapUsd: t.marketCap });
      }
      setToks(list);
    })();
    return () => { live = false; };
  }, []);

  const term = q.trim().toLowerCase();
  const list = toks === null ? null : toks.filter((t) =>
    !term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term) || t.address.toLowerCase().includes(term));

  const attach = (t: PickTok) => onPick(t.isMid
    ? { token: t.address, symbol: "ELCAS", logo: t.logo }
    : { token: t.address, symbol: t.symbol, logo: t.logo, priceUsd: t.priceUsd, liqUsd: t.liqUsd, mcapUsd: t.mcapUsd });

  return (
    <div>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search ELCAS & casino tokens…"
          className="w-full bg-ink-900/70 border border-ink-600 rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:border-blood-500 font-mono placeholder:font-sans placeholder:text-bone-600" />
      </div>
      {list === null && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 panel skeleton" />)}</div>}
      {list && list.length === 0 && <div className="text-center text-bone-500 text-sm py-6">no tokens match “{q}”.</div>}
      <div className="space-y-2">
        {list?.map((t) => (
          <button key={t.address} onClick={() => attach(t)}
            className="w-full text-left panel p-2.5 flex items-center gap-2.5 hover:border-blood-500/50 transition">
            {t.logo ? <img src={t.logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-blood-500/20 text-blood-300 shrink-0"><Coins size={16} /></span>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">${t.symbol}{t.isMid && <span className="ml-1.5 text-[8px] font-mono uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1 py-0.5">protocol</span>}</div>
              <div className="font-mono text-[10px] text-bone-500 truncate">{t.name || short(t.address)}</div>
            </div>
            <div className="text-right shrink-0 font-mono text-[10px] text-bone-400">
              {t.isMid ? <div className="text-bone-100">ETH pair</div> : t.priceUsd ? <><div className="text-bone-100">${t.priceUsd < 1 ? t.priceUsd.toPrecision(3) : t.priceUsd.toFixed(2)}</div>{t.liqUsd != null && <div>liq {fmtUsdShort(t.liqUsd)}</div>}</> : <div>—</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Casino room picker ───────────────────────────────────────────────────────
type GRow = { address: string; token: string; betName: string; logo: string; gameKey: string; symbol?: string; pool?: number; volume?: number; stakers?: number; bets?: number; rtp?: number; fee?: number };

function GamePicker({ onPick }: { onPick: (m: GameEmbed) => void }) {
  const [gk, setGk] = useState(CASINO_GAMES[0].key);
  const [rows, setRows] = useState<GRow[] | null>(null);
  const game = CASINO_GAMES.find((g) => g.key === gk)!;

  useEffect(() => {
    let live = true;
    setRows(null);
    (async () => {
      const fs = await loadFactoryStats(game.factory);
      if (!live) return;
      const start = Math.max(0, fs.total - 12);
      const games = await loadFactoryGames(game.factory, start, Math.min(12, fs.total - start));
      if (!live) return;
      const reversed = [...games].reverse();
      const base: GRow[] = reversed.map((g) => ({ address: g.address, token: g.token, betName: g.betName, logo: g.tokenLogoUrl, gameKey: game.key }));
      setRows(base);
      // enrich with symbol + live stats
      const syms = await Promise.all(reversed.map((r) => tokenSymbol(r.token)));
      if (!live) return;
      setRows((prev) => prev && prev.map((r, i) => ({ ...r, symbol: syms[i] })));
      const stats = await Promise.all(reversed.map((r) => readRoomEmbed(r.address, r.token)));
      if (!live) return;
      setRows((prev) => prev && prev.map((r, i) => ({
        ...r,
        pool: Number(formatUnits(stats[i].pool, stats[i].decimals)),
        volume: Number(formatUnits(stats[i].volume, stats[i].decimals)),
        stakers: stats[i].stakers,
        bets: Number(stats[i].bets),
        rtp: stats[i].rtp, fee: stats[i].fee,
      })));
    })().catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [gk]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {CASINO_GAMES.map((g) => (
          <button key={g.key} onClick={() => setGk(g.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border transition ${gk === g.key ? "border-current" : "border-ink-600 text-bone-500 hover:text-bone-200"}`}
            style={gk === g.key ? { color: g.color } : undefined}>
            {g.label}
          </button>
        ))}
      </div>
      {rows === null && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 panel skeleton" />)}</div>}
      {rows && rows.length === 0 && <div className="text-center text-bone-500 text-sm py-6">no {game.label} rooms yet.</div>}
      <div className="space-y-2">
        {rows?.map((r) => (
          <button key={r.address} onClick={() => onPick({
            gameKey: r.gameKey, address: r.address, label: r.betName || `${game.label} room`, token: r.token, symbol: r.symbol, logo: r.logo,
            pool: r.pool, volume: r.volume, stakers: r.stakers, bets: r.bets, rtp: r.rtp, fee: r.fee,
          })}
            className="w-full text-left panel p-2.5 flex items-center gap-2.5 hover:border-emerald-500/50 transition">
            {r.logo ? <img src={r.logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0"><Landmark size={16} /></span>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">{r.betName || `${game.label} room`}</div>
              <div className="font-mono text-[10px] text-bone-500 truncate capitalize">{r.gameKey}{r.symbol ? ` · $${r.symbol}` : ""}</div>
            </div>
            <div className="text-right shrink-0 font-mono text-[10px] text-bone-400">
              {r.pool != null ? <div className="text-emerald-300">pool {r.pool >= 1000 ? (r.pool / 1000).toFixed(1) + "K" : r.pool.toFixed(0)}</div> : <Loader2 size={11} className="animate-spin inline" />}
              {r.stakers != null && <div>{r.stakers} stakers</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
