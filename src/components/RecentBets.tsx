import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dices, TrendingUp } from "lucide-react";
import { loadRecentBets, loadOnchainRecentBets, subscribeBets, type Bet } from "../lib/betfeed";
import { isBlockedCasinoToken } from "../lib/casino";
import { short, timeAgo } from "../lib/util";

// Merge UI-logged bets with on-chain bets, dropping duplicate wagers (UI wins).
function mergeBets(ui: Bet[], onchain: Bet[]): Bet[] {
  const seen = new Set<string>();
  const key = (b: Bet) => `${b.wallet.toLowerCase()}-${b.game_key}-${Math.round(b.amount)}-${b.won}`;
  const out: Bet[] = [];
  for (const b of ui) { seen.add(key(b)); out.push(b); }
  for (const b of onchain) { if (!seen.has(key(b))) { seen.add(key(b)); out.push(b); } }
  out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return out;
}

function fmtAmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

function Avatar({ b }: { b: Bet }) {
  if (b.avatar) return <img src={b.avatar} alt="" className="h-8 w-8 rounded-full object-cover border border-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  return <div className="h-8 w-8 rounded-full bg-ink-800 border border-ink-600 flex items-center justify-center text-[10px] font-mono text-bone-400 shrink-0">{(b.name || b.wallet).slice(2, 4).toUpperCase()}</div>;
}

/** Avalove-style card feed of the latest casino bets — new bets slide in live. */
export function RecentBets({ limit = 12 }: { limit?: number }) {
  const [bets, setBets] = useState<Bet[] | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadRecentBets(limit).catch(() => []), loadOnchainRecentBets(limit).catch(() => [])])
      .then(([ui, oc]) => { if (live) setBets(mergeBets(ui, oc).filter((b) => !isBlockedCasinoToken(b.address, b.symbol)).slice(0, limit)); })
      .catch(() => { if (live) setBets([]); });
    const un = subscribeBets((b) => { if (!isBlockedCasinoToken(b.address, b.symbol) && live) setBets((cur) => [b, ...(cur ?? []).filter((x) => x.id !== b.id)].slice(0, limit)); });
    return () => { live = false; un(); };
  }, [limit]);

  if (bets && bets.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 text-bone-400">
        <Dices size={13} className="text-emerald-400" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Recent bets · live</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {bets === null
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="panel h-[62px] skeleton" />)
          : bets.map((b) => {
              const who = b.name || short(b.wallet);
              const to = b.address && b.game_key ? `/casino/room/${b.game_key}/${b.address}` : "/casino";
              const win = b.won === true && b.payout != null;
              return (
                <Link key={b.id} to={to}
                  className="panel p-2.5 flex items-center gap-2.5 hover:border-blood-500/50 transition animate-fade-up">
                  <Avatar b={b} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{who}</div>
                    <div className="font-mono text-[10px] text-bone-500 truncate">
                      {fmtAmt(b.amount)} {b.symbol}{b.game ? ` · ${b.game}` : ""} · {timeAgo(new Date(b.created_at).getTime() / 1000)}
                    </div>
                  </div>
                  {win ? (
                    <span className="shrink-0 inline-flex items-center gap-0.5 font-mono text-[11px] font-bold text-emerald-300">
                      <TrendingUp size={11} /> +{fmtAmt(b.payout!)}
                    </span>
                  ) : b.won === false ? (
                    <span className="shrink-0 font-mono text-[10px] text-bone-600">lost</span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] text-amber-300/80">bet</span>
                  )}
                </Link>
              );
            })}
      </div>
    </div>
  );
}
