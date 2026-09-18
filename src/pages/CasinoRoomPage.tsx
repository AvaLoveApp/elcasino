import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Contract, formatUnits, isAddress } from "ethers";
import { ExternalLink, ShieldCheck, Dices, ArrowLeft, Share2, MessageSquare } from "lucide-react";
import { CASINO_GAMES, CasinoGameKind, GameKey, loadFactoryStats } from "../lib/casino";
import { CHAIN, readProvider, erc20Meta } from "../lib/chain";
import { GAME_ERC20_ABI } from "../lib/casinoGame";
import { short } from "../lib/util";
import { GameTypeIcon } from "../components/GameTypeIcon";
import { CoinflipGame } from "../components/games/CoinflipGame";
import { BlackjackGame } from "../games/blackjack/BlackjackGame";
import { RouletteGame } from "../games/roulette/RouletteGame";
import { DiceGame } from "../games/dice/DiceGame";
import { CrashGame } from "../games/crash/CrashGame";
import { WheelGame } from "../games/wheel/WheelGame";
import { SlotGame } from "../games/slot/SlotGame";
import { PlinkoGame } from "../games/plinko/PlinkoGame";
import { MinesGame } from "../games/mines/MinesGame";
import { BoxesGame } from "../games/boxes/BoxesGame";
import { GameEarnTab } from "../games/GameEarnTab";
import { PendingBets } from "../games/PendingBets";
import { RoomChat } from "../games/RoomChat";
import { GameSwap } from "../games/GameSwap";
import { ShareToFeed } from "../components/ShareToFeed";
import { ChatSlotProvider } from "../games/ControlsTabs";
import { useCompose } from "../lib/compose";
import { dexTokenByAddress } from "../lib/dexscreener";

// Games with an inline play surface built. Others fall back to the verify page.
const PLAYABLE: Partial<Record<GameKey, (p: { address: string }) => JSX.Element>> = {
  coinflip: CoinflipGame,
  blackjack: BlackjackGame,
  roulette: RouletteGame,
  dice: DiceGame,
  crash: CrashGame,
  wheel: WheelGame,
  slots: SlotGame,
  plinko: PlinkoGame,
  mines: MinesGame,
  boxes: BoxesGame,
};

type PageView = "bet" | "stake" | "info" | "about";

/**
 * Individual game room — one unified surface, exchange-style. A single tab bar
 * (Bet / Earn / Analytics) switches views: Bet is the on-chain play surface,
 * Earn is the LP staking vault, Analytics is the live pool stats. Mirrors Avlo's
 * game page 1:1 — no modals, no small panels.
 */
export default function CasinoRoomPage() {
  const { gameKey, address } = useParams<{ gameKey: string; address: string }>();
  const game = CASINO_GAMES.find((g) => g.key === gameKey as GameKey);
  const [pageView, setPageView] = useState<PageView>("bet");
  const [factoryOk, setFactoryOk] = useState<boolean | null>(null);
  const [dexUrl, setDexUrl] = useState<string | null>(null);
  const [tokMeta, setTokMeta] = useState<{ logo: string; betName: string; token: string; symbol: string; decimals: number; pool: number; volume: number; stakers: number; bets: number; rtp: number; fee: number } | null>(null);
  const { openCompose } = useCompose();

  useEffect(() => {
    let live = true;
    if (game) {
      loadFactoryStats(game.factory).then((s) => { if (live) setFactoryOk(s.total >= 0); }).catch(() => {
        if (live) setFactoryOk(false);
      });
    }
    return () => { live = false; };
  }, [game]);

  // Resolve the room's bet token and its DexScreener pool page.
  useEffect(() => {
    let live = true;
    if (!address) return;
    (async () => {
      try {
        const g = new Contract(address, [
          "function getGameInfo() view returns (address,address,string,string,uint256,uint256,uint256,bool,uint256,uint256,uint256,uint256)",
          "function config() view returns (uint256 rtpBasisPoints, uint256 feeBasisPoints, uint256 maxWinBasisPoints, uint256 minBet, uint256 maxBetPoolRatio)",
        ], readProvider);
        const [gi, cfg] = await Promise.all([g.getGameInfo(), g.config().catch(() => null)]);
        const tokenAddr = String(gi[1] || "");
        let symbol = ""; let decimals = 18;
        try { const m = await erc20Meta(tokenAddr); symbol = m.symbol; decimals = m.decimals; } catch {}
        const pool = Number(formatUnits(gi[4] ?? 0n, decimals));
        const volume = Number(formatUnits(gi[6] ?? 0n, decimals));
        const stakers = Number(gi[11] ?? 0n);
        const bets = Number(gi[5] ?? 0n);
        const rtp = cfg ? Number(cfg[0]) : 0;
        const fee = cfg ? Number(cfg[1]) : 0;
        if (live) setTokMeta({ logo: String(gi[2] || ""), betName: String(gi[3] || ""), token: tokenAddr, symbol, decimals, pool, volume, stakers, bets, rtp, fee });
        const t = await dexTokenByAddress(tokenAddr);
        if (live) setDexUrl(t?.url ?? `https://dexscreener.com/search?q=${tokenAddr}`);
      } catch {}
    })();
    return () => { live = false; };
  }, [address]);

  if (!game || !address) {
    return <div className="text-center text-bone-400 py-16">unknown game.</div>;
  }

  const Play = PLAYABLE[game.key as GameKey];

  const TABS: { key: PageView; label: string; active: string }[] = [
    { key: "bet",   label: "Bet",       active: "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/[0.06]" },
    { key: "stake", label: "Earn",      active: "text-purple-400 border-b-2 border-purple-400 bg-purple-500/[0.06]" },
    { key: "info",  label: "Analytics", active: "text-blue-400 border-b-2 border-blue-400 bg-blue-500/[0.06]" },
    { key: "about", label: "Info",      active: "text-amber-400 border-b-2 border-amber-400 bg-amber-500/[0.06]" },
  ];

  return (
    // Bleed to the edges of the center column so the game uses the whole surface.
    <div className="animate-fade-up -mx-4 sm:-mx-6 -mt-6 min-h-dvh flex flex-col bg-ink-950">
      {/* ── Room header ── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-ink-700/60 bg-black/40">
        <Link to={`/casino?g=${game.key}`} title={`Back to ${game.label}`}
          className="shrink-0 text-bone-400 hover:text-blood-400 transition"><ArrowLeft size={18} /></Link>
        <span className="relative h-9 w-9 shrink-0">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(140deg, ${game.color}, rgba(0,0,0,0.6))` }}>
            <GameTypeIcon type={game.key} size={20} className="text-white" />
          </span>
          {tokMeta?.logo && (
            <img src={tokMeta.logo} alt="" className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full object-cover ring-1 ring-black"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight truncate">{tokMeta?.betName || `${game.label} room`}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-emerald-400">
              <ShieldCheck size={10} /> verified
            </span>
          </div>
          <a href={`${CHAIN.explorer}/address/${address}`} target="_blank" rel="noreferrer"
            className="font-mono text-[11px] text-bone-500 hover:text-blood-400 inline-flex items-center gap-1">
            {short(address)} <ExternalLink size={9} />
          </a>
        </div>
        <ShareToFeed share={{ kind: "game", text: `Playing ${tokMeta?.betName || game.label} on EL-Casino 🎲`,
          meta: { gameKey: game.key, address, label: tokMeta?.betName || `${game.label} room`, token: tokMeta?.token, symbol: tokMeta?.symbol, logo: tokMeta?.logo,
            pool: tokMeta?.pool, volume: tokMeta?.volume, stakers: tokMeta?.stakers, bets: tokMeta?.bets, rtp: tokMeta?.rtp, fee: tokMeta?.fee } }} />
        {dexUrl && (
          <a href={dexUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-emerald-500/30 text-emerald-300 hover:border-emerald-400/60">
            DexScreener pool <ExternalLink size={9} />
          </a>
        )}
        <a href={`${CHAIN.explorer}/address/${game.factory}`} target="_blank" rel="noreferrer"
          className={`hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-ink-600 hover:border-blood-500/40 ${factoryOk === false ? "text-blood-400" : "text-bone-500"}`}>
          factory {short(game.factory)}{factoryOk === false ? " · unreachable" : ""} <ExternalLink size={9} />
        </a>
      </div>

      {/* ── View tabs ── */}
      <div className="flex flex-wrap gap-0 border-b border-ink-700/60 bg-black/50">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setPageView(tab.key)}
            className={`flex-1 min-w-[90px] py-3 text-xs sm:text-sm font-mono uppercase tracking-wider transition-all text-center whitespace-nowrap ${
              pageView === tab.key ? tab.active : "text-bone-500 hover:text-bone-200 hover:bg-white/[0.02] border-b-2 border-transparent"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Pool info bar (always visible under the tabs) ── */}
      <RoomPoolBar address={address} />

      {/* ── Content ── */}
      <div className="flex-1 p-4 sm:p-6">
        {pageView === "bet" && (
          <>
            {Play ? (
              // Chat is provided via context so it appears as a [Bet | Chat] tab
              // inside the game's own controls column (beside the wheel).
              <ChatSlotProvider
                chat={<RoomChat address={address} />}
                swap={tokMeta?.token && isAddress(tokMeta.token)
                  ? <GameSwap token={tokMeta.token} symbol={tokMeta.symbol} decimals={tokMeta.decimals} logo={tokMeta.logo} />
                  : undefined}>
                <Play address={address} />
              </ChatSlotProvider>
            ) : (
              <div className="panel p-6 text-center max-w-lg mx-auto">
                <Dices size={32} className="mx-auto text-blood-400 mb-3" />
                <h2 className="text-lg font-bold">Inline {game.label.toLowerCase()} — porting</h2>
                <p className="text-sm text-bone-400 mt-1">
                  {game.label} plays on-chain and is being ported inline. Bets on this contract are still verifiable.
                </p>
                <a href={`${CHAIN.explorer}/address/${address}?tab=contract`} target="_blank" rel="noreferrer"
                  className="btn-primary inline-flex items-center gap-2 mt-4 py-2 px-4">
                  Interact via explorer <ExternalLink size={13} />
                </a>
              </div>
            )}
            <div className="mt-4"><PendingBets gameKey={game.key} address={address} reloadSignal={pageView} /></div>
          </>
        )}

        {pageView === "stake" && <GameEarnTab address={address} />}

        {pageView === "info" && <RoomAnalytics address={address} />}

        {pageView === "about" && <RoomInfo game={game} address={address} dexUrl={dexUrl} factoryOk={factoryOk} />}
      </div>
    </div>
  );
}

/** Live pool + volume stats read straight from the game's getGameInfo(). */
const INFO_ABI = [
  "function getGameInfo() view returns (address owner, address token, string tokenLogoUrl, string betName, uint256 poolBalance, uint256 totalFlips, uint256 totalVolume, bool paused, uint256 totalFeesCollected, uint256 totalPayouts, uint256 totalShares, uint256 stakerCount)",
  "function config() view returns (uint256 rtpBasisPoints, uint256 feeBasisPoints, uint256 maxWinBasisPoints, uint256 minBet, uint256 maxBetPoolRatio)",
];

/** Always-visible pool bar under the tabs — so players see the liquidity. */
function RoomPoolBar({ address }: { address: string }) {
  const [d, setD] = useState<{ symbol: string; dec: number; pool: bigint; volume: bigint; bets: bigint; stakers: number; rtp: number; fee: number; maxBet: bigint; paused: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const g = new Contract(address, INFO_ABI, readProvider);
        const [gi, cfg] = await Promise.all([g.getGameInfo(), g.config().catch(() => null)]);
        const erc = new Contract(gi[1], GAME_ERC20_ABI, readProvider);
        const [symbol, dec] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
        if (!live) return;
        const pool = gi[4] as bigint;
        const ratio = cfg ? BigInt(cfg[4]) : 0n;
        setD({ symbol, dec: Number(dec), pool, volume: gi[6], bets: gi[5], stakers: Number(gi[11]),
          rtp: cfg ? Number(cfg[0]) : 0, fee: cfg ? Number(cfg[1]) : 0, maxBet: ratio > 0n ? (pool * ratio) / 10000n : 0n, paused: gi[7] });
      } catch {}
    })();
    const t = setInterval(() => { if (live && !document.hidden) (async () => { try { const g = new Contract(address, INFO_ABI, readProvider); const gi = await g.getGameInfo(); setD((p) => p && { ...p, pool: gi[4], volume: gi[6], bets: gi[5], stakers: Number(gi[11]) }); } catch {} })(); }, 15000);
    return () => { live = false; clearInterval(t); };
  }, [address]);

  const f = (v: bigint) => d ? Number(formatUnits(v, d.dec)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "…";
  const item = (label: string, val: string, cls = "text-bone-100") => (
    <div className="shrink-0">
      <div className="text-[8px] font-mono uppercase tracking-wider text-bone-500">{label}</div>
      <div className={`text-xs font-mono font-bold ${cls}`}>{val}</div>
    </div>
  );
  return (
    <div className="flex items-center gap-5 px-4 sm:px-6 py-2.5 border-b border-ink-700/60 bg-black/30 overflow-x-auto scrollbar-hide">
      {item("Pool liquidity", d ? `${f(d.pool)} ${d.symbol}` : "…", "text-emerald-300")}
      {item("Max bet", d && d.maxBet > 0n ? `${f(d.maxBet)} ${d.symbol}` : "—", "text-blood-300")}
      {item("Volume", d ? f(d.volume) : "…")}
      {item("Bets", d ? d.bets.toLocaleString() : "…")}
      {item("Stakers", d ? String(d.stakers) : "…", "text-purple-300")}
      {item("RTP", d ? `${(d.rtp / 100).toFixed(1)}%` : "…")}
      {item("Fee", d ? `${(d.fee / 100).toFixed(1)}%` : "…", "text-amber-300")}
      {d?.paused && item("Status", "Paused", "text-blood-400")}
    </div>
  );
}

const RULES: Partial<Record<GameKey, string[]>> = {
  roulette: ["Place chips on numbers, colours, dozens or columns, then spin.", "Straight number pays 35:1 · dozens/columns 2:1 · red/black/even/odd/low/high 1:1.", "The winning pocket (0–36) is drawn on-chain from a future block hash."],
  crash: ["Set a cash-out target and launch. Win your target × bet if the rocket reaches it before it crashes.", "The crash point is drawn on-chain from a future block hash."],
  blackjack: ["Beat the dealer without going over 21. Hit, stand or double down.", "Blackjack pays 3:2 · dealer stands on 17. Cards are shuffled on-chain."],
  coinflip: ["Pick heads or tails. A win pays ~1.98×.", "The result is drawn on-chain from a future block hash."],
  plinko: ["Choose rows (8–16) and a risk level, then drop. The landing bucket sets your multiplier — edges pay big, centre pays little."],
  dice: ["Pick a target and roll over or under it. Lower win chance = higher multiplier.", "The result (0.00–99.99) is drawn on-chain from a future block hash."],
  wheel: ["Choose a risk level and spin. 10 equal segments; higher risk = bigger top multipliers and more 0× misses."],
  mines: ["Pick your safe tiles and set the mine count. All picks safe = win, scaled by risk. Hit a mine = lose.", "Mines are drawn on-chain from a future block hash."],
  slots: ["Spin three reels. Matching symbols pay per the on-chain table."],
  boxes: ["Buy boxes in a round of 100. When all sell, three winning boxes are drawn on-chain — 1st/2nd/3rd split the pool 50/25/10%, others share 15%."],
};

function RoomInfo({ game, address, dexUrl, factoryOk }: { game: CasinoGameKind; address: string; dexUrl: string | null; factoryOk: boolean | null }) {
  const rules = RULES[game.key] ?? [];
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="panel p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: `linear-gradient(140deg, ${game.color}, rgba(0,0,0,0.6))` }}>
            <GameTypeIcon type={game.key} size={24} className="text-white" />
          </span>
          <div><h2 className="text-lg font-bold tracking-tight">{game.label}</h2><p className="text-sm text-bone-400">{game.desc}</p></div>
        </div>
        <ul className="space-y-1.5 text-sm text-bone-300 list-disc list-inside marker:text-bone-600">
          {rules.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      <div className="panel p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-bone-500 mb-2">Contracts · provably fair</div>
        <div className="grid sm:grid-cols-2 gap-2 font-mono text-[11px]">
          <a href={`${CHAIN.explorer}/address/${address}`} target="_blank" rel="noreferrer" className="rounded-lg border border-ink-600 bg-ink-900/50 px-3 py-2 hover:border-blood-500/40">
            <div className="text-bone-500 uppercase tracking-wider text-[9px]">game contract</div>
            <div className="text-bone-100 inline-flex items-center gap-1 mt-0.5">{short(address)} <ExternalLink size={10} /></div>
          </a>
          <a href={`${CHAIN.explorer}/address/${game.factory}`} target="_blank" rel="noreferrer" className={`rounded-lg border border-ink-600 bg-ink-900/50 px-3 py-2 hover:border-blood-500/40 ${factoryOk === false ? "text-blood-400" : ""}`}>
            <div className="text-bone-500 uppercase tracking-wider text-[9px]">factory (verified)</div>
            <div className="inline-flex items-center gap-1 mt-0.5 text-emerald-400">{short(game.factory)} <ExternalLink size={10} /></div>
          </a>
          {dexUrl && (
            <a href={dexUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-500/30 bg-emerald-900/10 px-3 py-2 hover:border-emerald-400/60 sm:col-span-2 text-emerald-300">
              <div className="text-bone-500 uppercase tracking-wider text-[9px]">liquidity</div>
              <div className="inline-flex items-center gap-1 mt-0.5">DexScreener pool <ExternalLink size={10} /></div>
            </a>
          )}
        </div>
        <p className="mt-3 font-mono text-[10px] text-bone-500 leading-relaxed">
          Every outcome is derived from a future block hash the operator can't predict or change — fully on-chain and verifiable. The house never owns the roll.
        </p>
      </div>
    </div>
  );
}

function RoomAnalytics({ address }: { address: string }) {
  const [d, setD] = useState<{
    symbol: string; dec: number; owner: string; pool: bigint; flips: bigint;
    volume: bigint; fees: bigint; payouts: bigint; stakers: number; paused: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const g = new Contract(address, INFO_ABI, readProvider);
      const gi = await g.getGameInfo();
      const erc = new Contract(gi[1], GAME_ERC20_ABI, readProvider);
      const [symbol, dec] = await Promise.all([erc.symbol().catch(() => "TOK"), erc.decimals().catch(() => 18)]);
      if (!live) return;
      setD({
        symbol, dec: Number(dec), owner: gi[0], pool: gi[4], flips: gi[5],
        volume: gi[6], paused: gi[7], fees: gi[8], payouts: gi[9], stakers: Number(gi[11]),
      });
    })().catch(() => {});
    return () => { live = false; };
  }, [address]);

  if (!d) return <div className="panel p-8 text-center text-bone-500">loading analytics…</div>;
  const f = (v: bigint, mx = 2) => Number(formatUnits(v, d.dec)).toLocaleString(undefined, { maximumFractionDigits: mx });

  const volN = Number(formatUnits(d.volume, d.dec));
  const payN = Number(formatUnits(d.payouts, d.dec));
  const edge = volN > 0 ? ((volN - payN) / volN) * 100 : 0;      // house edge realized so far
  const net = volN - payN;                                        // net to the house (staker pool)
  const rtpRealized = volN > 0 ? (payN / volN) * 100 : 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AStat label="Pool balance" value={`${f(d.pool)} ${d.symbol}`} accent="emerald" />
        <AStat label="Total volume" value={`${f(d.volume)} ${d.symbol}`} />
        <AStat label="Total bets" value={d.flips.toLocaleString()} />
        <AStat label="Stakers" value={String(d.stakers)} accent="purple" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AStat label="Fees collected" value={`${f(d.fees)} ${d.symbol}`} accent="amber" />
        <AStat label="Total payouts" value={`${f(d.payouts)} ${d.symbol}`} />
        <AStat label="House edge (realized)" value={`${edge.toFixed(1)}%`} accent={edge >= 0 ? "emerald" : "blood"} />
        <AStat label="Net to house" value={`${net >= 0 ? "" : "−"}${Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${d.symbol}`} accent={net >= 0 ? "emerald" : "blood"} />
      </div>

      {/* Realized RTP vs edge bar — how much of wagered volume flowed back to players */}
      {volN > 0 && (
        <div className="panel p-4">
          <div className="flex items-baseline justify-between text-[11px] font-mono text-bone-500 mb-2">
            <span>Realized payout ratio</span>
            <span className="text-bone-300">{rtpRealized.toFixed(1)}% to players · {edge.toFixed(1)}% to house</span>
          </div>
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-ink-800 ring-1 ring-ink-700">
            <span className="h-full bg-emerald-500/70" style={{ width: `${Math.min(100, rtpRealized)}%` }} title="paid to players" />
            <span className="h-full bg-blood-500/70" style={{ width: `${Math.max(0, Math.min(100, edge))}%` }} title="kept by house" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <AStat label="Status" value={d.paused ? "Paused" : "Live"} accent={d.paused ? "blood" : "emerald"} />
        <AStat label="Avg bet" value={`${d.flips > 0n ? (volN / Number(d.flips)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"} ${d.symbol}`} />
      </div>
      <div className="panel p-4 font-mono text-[11px] text-bone-500 flex items-center justify-between gap-2 flex-wrap">
        <span>owner {short(d.owner)}</span>
        <a href={`${CHAIN.explorer}/address/${address}`} target="_blank" rel="noreferrer"
          className="hover:text-blood-400 inline-flex items-center gap-1">contract {short(address)} <ExternalLink size={9} /></a>
      </div>
    </div>
  );
}

function AStat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "purple" | "amber" | "blood" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "purple" ? "text-purple-400"
    : accent === "amber" ? "text-amber-300" : accent === "blood" ? "text-blood-400" : "text-bone-100";
  return (
    <div className="panel p-4">
      <div className="text-[10px] text-bone-500 uppercase tracking-wider mb-1 font-mono">{label}</div>
      <div className={`text-lg font-bold font-mono tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
