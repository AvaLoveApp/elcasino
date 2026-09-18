import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Radio, Dices, TrendingUp } from "lucide-react";
import { loadBroadcasts } from "../lib/social";
import { loadRecentBets, loadOnchainRecentBets, loadRecentDeploys, subscribeBets, type Bet } from "../lib/betfeed";
import { loadProfilesMap } from "../lib/midchat";
import { fetchLiveRooms } from "../lib/live";
import { short } from "../lib/util";
import { Avatar } from "./Avatar";

type Ev = {
  key: string;
  ts: number;
  avatar?: string;         // profile photo (bets) — otherwise an icon badge
  icon?: React.ReactNode;  // fallback glyph when there's no avatar
  who: string;             // actor / subject
  action: React.ReactNode; // what they did
  to: string;
  fresh?: boolean;         // animate in when streamed live
};

function fmtAmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

function betEvent(b: Bet, fresh = false): Ev {
  const who = b.name || short(b.wallet);
  const won = b.won === true && b.payout != null;
  const to = b.address && b.game_key ? `/casino/room/${b.game_key}/${b.address}` : "/casino";
  const action = won ? (
    <span className="inline-flex items-center gap-1">won <span className="text-emerald-300 font-semibold inline-flex items-center gap-0.5"><TrendingUp size={11} />+{fmtAmt(b.payout!)}</span> · {b.game}</span>
  ) : (
    <span>bet {fmtAmt(b.amount)} {b.symbol}{b.game ? ` · ${b.game}` : ""}</span>
  );
  return { key: "bet" + b.id, ts: new Date(b.created_at).getTime(), avatar: b.avatar || undefined, icon: <Dices size={13} className="text-emerald-400" />, who, action, to, fresh };
}

// Merge UI-logged bets (rich name/avatar) with on-chain bets, dropping duplicates
// of the same wager. UI rows win so we keep the profile photo/name.
function mergeBets(ui: Bet[], onchain: Bet[]): Bet[] {
  const seen = new Set<string>();
  const key = (b: Bet) => `${b.wallet.toLowerCase()}-${b.game_key}-${Math.round(b.amount)}-${b.won}`;
  const out: Bet[] = [];
  for (const b of ui) { seen.add(key(b)); out.push(b); }
  for (const b of onchain) { if (!seen.has(key(b))) { seen.add(key(b)); out.push(b); } }
  return out;
}

/**
 * Live activity feed on the home — an event strip where the newest event sits at
 * the front and each new bet slides in from the right (no continuous marquee).
 * Shows who did what, with their profile photo. On-chain casino bets, live
 * streams, new launches (and who launched them) and admin announcements — no post
 * shares (those live in the feed).
 */
export function ActivityTicker() {
  const [rest, setRest] = useState<Ev[]>([]);
  const [bets, setBets] = useState<Ev[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [casts, rooms, uiBets, onchainBets, deploys] = await Promise.all([
        loadBroadcasts(3).catch(() => []),
        fetchLiveRooms("live").catch(() => []),
        loadRecentBets(20).catch(() => []),
        loadOnchainRecentBets(20).catch(() => []),
        loadRecentDeploys(8).catch(() => []),
      ]);
      if (!live) return;

      const merged = mergeBets(uiBets, onchainBets);
      // Resolve profile name/photo for room deployers + on-chain bettors (who
      // arrive without one) in a single query.
      const need = [
        ...deploys.map((d) => d.creator).filter(Boolean),
        ...merged.filter((b) => !b.name || !b.avatar).map((b) => b.wallet),
      ];
      const profs = await loadProfilesMap(need).catch(() => new Map());
      if (!live) return;

      const betEvents = merged.slice(0, 20).map((b) => {
        const p = profs.get(b.wallet.toLowerCase());
        return betEvent({ ...b, name: b.name || p?.username || "", avatar: b.avatar || p?.avatar_url || "" });
      });
      setBets(betEvents);

      const out: Ev[] = [];
      for (const r of rooms.slice(0, 4)) out.push({ key: "live" + r.id, ts: Date.now(), icon: <Radio size={13} className="text-blood-400" />, who: r.title || r.token_symbol || "Live", action: <span className="text-blood-300">is live now</span>, to: `/live/${r.id}` });
      for (const b of casts.slice(0, 3)) out.push({ key: "bc" + b.id, ts: new Date((b as any).created_at || Date.now()).getTime(), icon: <Megaphone size={13} className="text-amber-400" />, who: "Announcement", action: b.title, to: b.url?.replace(/^\.\/#/, "") || "/notifications" });
      for (const d of deploys.slice(0, 6)) {
        const cp = profs.get((d.creator || "").toLowerCase());
        const by = cp?.username || short(d.creator);
        out.push({ key: "dep" + d.address, ts: d.createdAt * 1000 || Date.now(), icon: <Dices size={13} className="text-purple-400" />, who: d.betName || `${d.gameLabel} room`, action: <span>deployed by <span className="text-bone-200 font-medium">{by}</span></span>, to: `/casino/room/${d.gameKey}/${d.address}` });
      }
      setRest(out);
    })();
    // New bets stream in — prepend to the front with a slide-in animation.
    const un = subscribeBets((b) => { if (live) setBets((cur) => [betEvent(b, true), ...cur.filter((x) => x.key !== "bet" + b.id)].slice(0, 30)); });
    return () => { live = false; un(); };
  }, []);

  // Newest first: live bets lead, then the rest ordered by time.
  const items = [...bets, ...rest].sort((a, b) => b.ts - a.ts).slice(0, 40);
  if (items.length === 0) return null;

  return (
    <div className="panel p-0 overflow-hidden">
      <div className="flex items-stretch">
        <span className="shrink-0 inline-flex items-center gap-1.5 bg-blood-500/15 text-blood-300 px-3 font-mono text-[10px] uppercase tracking-wider border-r border-ink-700/60">
          <span className="h-1.5 w-1.5 rounded-full bg-blood-500 mg-live-dot" /> Live
        </span>
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 py-2 px-2 w-max">
            {items.map((it) => (
              <Link key={it.key} to={it.to}
                className={`inline-flex items-center gap-2 rounded-full border border-ink-700/70 bg-ink-900/60 pl-1 pr-3 py-1 hover:border-blood-500/50 transition whitespace-nowrap ${it.fresh ? "mg-feed-in" : ""}`}>
                {it.avatar
                  ? <Avatar uri={it.avatar} name={it.who} size={24} ring={false} />
                  : <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-800 border border-ink-600">{it.icon}</span>}
                <span className="text-[12px] text-bone-200"><span className="font-semibold text-bone-50">{it.who}</span> <span className="text-bone-400">{it.action}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
