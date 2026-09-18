import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Dices, Users, Coins, TrendingUp, Layers, RefreshCw, Trophy, Recycle, Rocket } from "lucide-react";
import { loadCasinoAnalytics, CasinoAnalytics as CA, GameKey } from "../lib/casino";
import { GameTypeIcon } from "./GameTypeIcon";
import { fmtInt } from "../lib/util";
import { fmtUsdShort } from "../lib/dexscreener";

const nf = (n: number, mx = 2) => n.toLocaleString(undefined, { maximumFractionDigits: mx });

/** On-chain casino analytics — mirrors Avlo's dashboard with no backend. */
export function CasinoAnalytics() {
  const [a, setA] = useState<CA | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (force = false) => {
    setBusy(true);
    loadCasinoAnalytics(20, force).then(setA).catch(() => {}).finally(() => setBusy(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const feeTokens = a
    ? a.byToken.filter((t) => t.platformFees > 0).sort((x, y) => (y.platformFeesUsd - x.platformFeesUsd) || (y.platformFees - x.platformFees))
    : [];

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-blood-400">
            <Dices size={16} /><span className="font-mono text-[10px] uppercase tracking-[0.24em]">Casino analytics · on-chain</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">The house, in numbers</h1>
          <p className="text-bone-400 text-sm">Live from every game contract — pools, wagers, payouts and stakers. No server.</p>
        </div>
        <button onClick={() => load(true)} disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-full border border-ink-600 text-bone-400 hover:text-bone-100 hover:border-blood-500/50 transition text-xs font-mono disabled:opacity-50">
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> refresh
        </button>
      </div>

      {!a ? (
        <div className="panel p-12 text-center text-bone-500">
          <Loader2 className="animate-spin mx-auto mb-2" /> scanning every game contract on-chain…
        </div>
      ) : (
        <>
          {/* Headline counts */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Dices size={13} />} label="Live rooms" value={fmtInt(a.rooms)} sub={`${a.kindsLive} game types`} accent="blood" />
            <Stat icon={<TrendingUp size={13} />} label="Total wagers" value={fmtInt(a.bets)} sub="bets settled on-chain" accent="amber" />
            <Stat icon={<Users size={13} />} label="Staker positions" value={fmtInt(a.stakers)} sub="house-side stakes" accent="emerald" />
            <Stat icon={<Layers size={13} />} label="Tokens in play" value={fmtInt(a.byToken.length)} sub="distinct pool assets" accent="cyan" />
          </div>

          {/* Platform fees → MIDGARD buyback + LP */}
          <section>
            <SectionTitle icon={<Recycle size={13} />} label="Platform fees → ELCAS buyback + LP" />
            <div className="panel p-4 mb-3 flex items-start gap-2.5 border-emerald-500/25 bg-emerald-900/10">
              <Recycle size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <p className="text-xs text-bone-300 leading-relaxed">
                Every <span className="text-bone-50 font-semibold">deploy fee</span> and the{" "}
                <span className="text-bone-50 font-semibold">{a.platformFeeBP > 0 ? `${(a.platformFeeBP / 100).toFixed(a.platformFeeBP % 100 ? 1 : 0)}%` : "3%"} per-bet platform fee</span>{" "}
                is collected by the protocol and used to <span className="text-emerald-300 font-semibold">buy back ELCAS</span> and <span className="text-emerald-300 font-semibold">add liquidity</span> — it flows straight back into the token.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat icon={<Recycle size={13} />} label="Total fee revenue" value={fmtUsdShort(a.feeRevenueUsd)} sub="→ buyback + LP" accent="emerald" />
              <Stat icon={<Rocket size={13} />} label="Deploy fees" value={a.deployFeeUsd > 0 ? fmtUsdShort(a.deployFeeUsd) : `${nf(a.deployFeeEth, 3)} ETH`} sub={`${nf(a.deployFeeEth, 3)} ETH · ${fmtInt(a.totalGames)} rooms`} accent="amber" />
              <Stat icon={<TrendingUp size={13} />} label="Per-bet fees" value={fmtUsdShort(a.platformFeesUsd)} sub={`${a.platformFeeBP > 0 ? (a.platformFeeBP / 100).toFixed(a.platformFeeBP % 100 ? 1 : 0) : "3"}% per bet · ${feeTokens.length} token${feeTokens.length === 1 ? "" : "s"}`} accent="blood" />
            </div>

            {feeTokens.length > 0 && (
              <div className="panel divide-y divide-ink-700/60 mt-3">
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-bone-500">
                  <Coins size={11} /> Per-bet fees collected by token
                </div>
                {feeTokens.map((t) => (
                  <div key={t.symbol} className="flex items-center gap-3 p-3">
                    <TokenLogo logo={t.logo} sym={t.symbol} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{t.symbol}</div>
                      <div className="font-mono text-[11px] text-bone-500 truncate">{nf(t.platformFees)} {t.symbol} · {t.rooms} room{t.rooms === 1 ? "" : "s"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold tabular-nums text-emerald-300">{t.priceUsd > 0 ? fmtUsdShort(t.platformFeesUsd) : "—"}</div>
                      <div className="font-mono text-[9px] text-bone-600 uppercase">fee value</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Value by token — honest cross-token aggregation */}
          {a.byToken.length > 0 && (
            <section>
              <SectionTitle icon={<Coins size={13} />} label="Volume by token" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {a.byToken.slice(0, 6).map((t) => {
                  const edge = t.volume > 0 ? ((t.volume - t.payouts) / t.volume) * 100 : 0;
                  return (
                    <div key={t.symbol} className="panel p-4">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <TokenLogo logo={t.logo} sym={t.symbol} size={20} />
                          <span className="font-mono font-semibold text-bone-100 truncate">{t.symbol}</span>
                        </span>
                        <span className="text-[10px] font-mono text-bone-600 shrink-0">{t.rooms} room{t.rooms === 1 ? "" : "s"}</span>
                      </div>
                      <div className="font-mono font-bold text-xl mt-1 tabular-nums">{nf(t.volume)}</div>
                      <div className="text-[10px] font-mono text-bone-600">total wagered</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <MiniStat k="TVL" v={nf(t.pool)} />
                        <MiniStat k="Payouts" v={nf(t.payouts)} />
                        <MiniStat k="Edge" v={`${edge.toFixed(1)}%`} tone={edge >= 0 ? "gain" : "loss"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Breakdown by game type */}
          {a.byKind.length > 0 && (
            <section>
              <SectionTitle icon={<Dices size={13} />} label="By game" />
              <div className="panel divide-y divide-ink-700/60">
                {a.byKind.map((k) => {
                  const maxBets = Math.max(...a.byKind.map((x) => x.bets), 1);
                  return (
                    <Link key={k.key} to={`/casino?g=${k.key}`} className="flex items-center gap-3 p-3 hover:bg-ink-850/40 transition">
                      <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ background: `linear-gradient(140deg, ${k.color}, rgba(0,0,0,0.55))` }}>
                        <GameTypeIcon type={k.key} size={18} className="text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{k.label}</span>
                          <span className="font-mono text-xs text-bone-400">{fmtInt(k.bets)} bets</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(k.bets / maxBets) * 100}%`, background: k.color }} />
                        </div>
                        <div className="flex gap-3 mt-1 text-[10px] font-mono text-bone-600">
                          <span>{k.rooms} rooms</span><span>{fmtInt(k.stakers)} stakers</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Top rooms leaderboard */}
          {a.topRooms.length > 0 && (
            <section>
              <SectionTitle icon={<Trophy size={13} />} label="Busiest rooms" />
              <div className="panel divide-y divide-ink-700/60">
                {a.topRooms.map((r, i) => (
                  <Link key={r.address} to={`/casino/room/${r.gameKey}/${r.address}`}
                    className="flex items-center gap-3 p-3 hover:bg-ink-850/40 transition">
                    <span className="w-5 text-right font-mono text-xs text-bone-600 tabular-nums">{i + 1}</span>
                    <GameTokenBadge color={r.color} gameKey={r.gameKey} logo={r.logo} sym={r.symbol} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate flex items-center gap-1.5">{r.betName}</div>
                      <div className="font-mono text-[11px] text-bone-500 truncate">
                        {r.label} · {r.symbol} · pool {nf(r.pool)}{r.paused && <span className="text-blood-400"> · paused</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold tabular-nums">{fmtInt(r.bets)}</div>
                      <div className="font-mono text-[9px] text-bone-600 uppercase">bets</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="text-center text-[10px] font-mono text-bone-600">
            scanned {a.rooms} rooms across {a.kindsLive} game types · everything read live from chain
          </div>
        </>
      )}
    </div>
  );
}

/** Busiest rooms across the whole casino — for the Explore hub. Cached scan. */
export function HotRooms({ limit = 5 }: { limit?: number }) {
  const [a, setA] = useState<CA | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { loadCasinoAnalytics().then((d) => { if (live) setA(d); }).catch(() => {}); }, 400);
    return () => { live = false; clearTimeout(t); };
  }, []);
  if (!a || a.topRooms.length === 0) return null;
  return (
    <div className="panel divide-y divide-ink-700/60">
      {a.topRooms.slice(0, limit).map((r, i) => (
        <Link key={r.address} to={`/casino/room/${r.gameKey}/${r.address}`}
          className="flex items-center gap-3 p-3 hover:bg-ink-850/40 transition">
          <span className="w-4 text-right font-mono text-xs text-bone-600 tabular-nums">{i + 1}</span>
          <GameTokenBadge color={r.color} gameKey={r.gameKey} logo={r.logo} sym={r.symbol} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{r.betName}</div>
            <div className="font-mono text-[11px] text-bone-500 truncate">{r.label} · {r.symbol}{r.paused && <span className="text-blood-400"> · paused</span>}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-sm font-bold tabular-nums">{fmtInt(r.bets)}</div>
            <div className="font-mono text-[9px] text-bone-600 uppercase">bets</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Compact live strip for the casino landing — non-blocking, cached, links to
 *  the full analytics view. Scans slightly after mount so the room list paints first. */
export function CasinoStatsStrip({ onOpen }: { onOpen?: () => void }) {
  const [a, setA] = useState<CA | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      loadCasinoAnalytics().then((d) => { if (live) setA(d); }).catch(() => {});
    }, 1200);
    return () => { live = false; clearTimeout(t); };
  }, []);
  if (!a) return null; // stay invisible until warm — never blocks the landing
  const cell = (label: string, value: string, c: string) => (
    <div className="flex flex-col items-center px-3 py-1.5 min-w-[70px]">
      <span className={`font-mono font-bold text-base tabular-nums ${c}`}>{value}</span>
      <span className="text-[9px] font-mono uppercase tracking-wider text-bone-600">{label}</span>
    </div>
  );
  return (
    <button onClick={onOpen}
      className="w-full mb-4 rounded-xl border border-ink-700/70 bg-ink-900/40 hover:border-blood-500/40 transition flex items-center justify-around flex-wrap gap-1 py-1.5 group">
      {cell("rooms", fmtInt(a.rooms), "text-blood-300")}
      <span className="h-6 w-px bg-ink-700" />
      {cell("wagers", fmtInt(a.bets), "text-amber-300")}
      <span className="h-6 w-px bg-ink-700" />
      {cell("stakers", fmtInt(a.stakers), "text-emerald-300")}
      <span className="h-6 w-px bg-ink-700" />
      {cell("tokens", fmtInt(a.byToken.length), "text-cyan-300")}
      <span className="ml-1 text-[10px] font-mono text-bone-500 group-hover:text-blood-300 transition inline-flex items-center gap-1 pr-2">
        analytics →
      </span>
    </button>
  );
}

function Stat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: "blood" | "emerald" | "amber" | "cyan" }) {
  const c = accent === "blood" ? "text-blood-400" : accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-cyan-400";
  const bar = accent === "blood" ? "before:bg-blood-500" : accent === "emerald" ? "before:bg-emerald-500" : accent === "amber" ? "before:bg-amber-500" : "before:bg-cyan-500";
  return (
    <div className={`panel p-4 relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${bar}`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono ${c}`}>{icon}{label}</div>
      <div className="font-mono font-semibold text-2xl mt-1 tabular-nums text-bone-50">{value}</div>
      {sub && <div className="text-[10px] text-bone-600 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ k, v, tone }: { k: string; v: string; tone?: "gain" | "loss" }) {
  const c = tone === "gain" ? "text-emerald-400" : tone === "loss" ? "text-danger-400" : "text-bone-200";
  return (
    <div className="rounded-lg bg-ink-900/60 border border-ink-700/60 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-bone-600">{k}</div>
      <div className={`font-mono text-xs font-semibold tabular-nums ${c}`}>{v}</div>
    </div>
  );
}

function TokenLogo({ logo, sym, size = 18 }: { logo: string; sym: string; size?: number }) {
  if (logo) return <img src={logo} alt="" style={{ width: size, height: size }} className="rounded-full ring-1 ring-ink-600 object-cover shrink-0"
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  return <span style={{ width: size, height: size, fontSize: size * 0.4 }} className="rounded-full bg-ink-700 flex items-center justify-center font-mono text-bone-300 shrink-0">{sym.slice(0, 2)}</span>;
}

/** Game-type square with the token's logo badged in the corner. */
function GameTokenBadge({ color, gameKey, logo, sym }: { color: string; gameKey: GameKey; logo: string; sym: string }) {
  return (
    <span className="relative h-9 w-9 shrink-0">
      <span className="h-9 w-9 rounded-lg flex items-center justify-center text-white" style={{ background: `linear-gradient(140deg, ${color}, rgba(0,0,0,0.55))` }}>
        <GameTypeIcon type={gameKey} size={16} className="text-white" />
      </span>
      <span className="absolute -bottom-1 -right-1">
        {logo ? <img src={logo} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-ink-900" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          : <span className="h-4 w-4 rounded-full ring-1 ring-ink-900 bg-ink-700 flex items-center justify-center text-[6px] font-mono text-bone-300">{sym.slice(0, 2)}</span>}
      </span>
    </span>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-blood-400">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
    </div>
  );
}
