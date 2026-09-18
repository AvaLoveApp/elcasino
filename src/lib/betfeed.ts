import { formatUnits } from "ethers";
import { supabase } from "./supabase";
import { CASINO_GAMES, loadFactoryStats, loadFactoryGames, tokenSymbol, tokenDecimals } from "./casino";
import { recentFlips } from "./casinoGame";

/**
 * Live bet feed — avalove-style casino activity. Bets are logged client-side when
 * a Midgard user plays (fire-and-forget), then streamed to the home ticker in
 * realtime. Covers bets placed through the Midgard UI.
 */
export type Bet = {
  id: string; wallet: string; name: string; avatar: string;
  game: string; game_key: string; address: string; symbol: string;
  amount: number; won: boolean | null; payout: number | null; created_at: string;
};

export async function logBet(b: {
  wallet: string; name?: string; avatar?: string; game?: string; gameKey?: string;
  address?: string; symbol?: string; amount: number; won?: boolean | null; payout?: number | null;
}): Promise<void> {
  if (!supabase || !b.wallet) return;
  await supabase.from("bets").insert({
    wallet: b.wallet.toLowerCase(), name: (b.name || "").slice(0, 40), avatar: (b.avatar || "").slice(0, 400),
    game: b.game || "", game_key: b.gameKey || "", address: b.address || "", symbol: b.symbol || "",
    amount: isFinite(b.amount) ? b.amount : 0, won: b.won ?? null, payout: b.payout ?? null,
  }).then(() => {}, () => {});
}

export async function loadRecentBets(limit = 20): Promise<Bet[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("bets").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data as Bet[]) ?? [];
}

export function subscribeBets(onInsert: (b: Bet) => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`casino:bets:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, (p) => onInsert(p.new as Bet))
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

export type RoomRef = {
  address: string; token: string; betName: string; creator: string; createdAt: number;
  gameKey: string; gameLabel: string;
};

// Scan the latest few rooms of every game type — shared by the bet + deploy feeds
// so the home ticker only pays for one factory sweep. Cached briefly to avoid
// re-scanning when both feeds mount together.
let _roomCache: { at: number; rooms: RoomRef[] } | null = null;
export async function scanRecentRooms(perGame = 2): Promise<RoomRef[]> {
  if (_roomCache && Date.now() - _roomCache.at < 20_000) return _roomCache.rooms;
  const roomLists = await Promise.all(CASINO_GAMES.map(async (g) => {
    try {
      const fs = await loadFactoryStats(g.factory);
      if (fs.total <= 0) return [];
      const start = Math.max(0, fs.total - perGame);
      const rooms = await loadFactoryGames(g.factory, start, Math.min(perGame, fs.total - start));
      return rooms.map((r) => ({
        address: r.address, token: r.token, betName: r.betName, creator: r.creator, createdAt: r.createdAt,
        gameKey: g.key, gameLabel: g.label,
      }));
    } catch { return []; }
  }));
  const rooms = roomLists.flat();
  _roomCache = { at: Date.now(), rooms };
  return rooms;
}

/** Recent room deploys — "NVDA Roulette · deployed by <creator>", newest first. */
export async function loadRecentDeploys(limit = 8): Promise<RoomRef[]> {
  const rooms = await scanRecentRooms(2).catch(() => []);
  return [...rooms].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/**
 * On-chain recent bets — reads getRecentFlips() straight from the busiest rooms so
 * the feed shows real settled bets even when nobody has played through the Midgard
 * UI yet. Best-effort and resilient: each room is read independently, empty rooms
 * contribute nothing, and any RPC failure is skipped.
 */
export async function loadOnchainRecentBets(limit = 15): Promise<Bet[]> {
  const rooms = await scanRecentRooms(2).catch(() => []);

  const out: Bet[] = [];
  await Promise.all(rooms.map(async (r) => {
    try {
      const flips = await recentFlips(r.address, 3);
      const settled = flips.filter((f) => f.settled && f.timestamp > 0);
      if (settled.length === 0) return;
      const [symbol, decimals] = await Promise.all([tokenSymbol(r.token), tokenDecimals(r.token)]);
      for (const f of settled) {
        out.push({
          id: `oc-${r.address}-${f.commitBlock}-${f.player}`,
          wallet: f.player, name: "", avatar: "",
          game: r.gameLabel, game_key: r.gameKey, address: r.address, symbol,
          amount: Number(formatUnits(f.amount, decimals)),
          won: f.won, payout: f.won ? Number(formatUnits(f.payout, decimals)) : null,
          created_at: new Date(f.timestamp * 1000).toISOString(),
        });
      }
    } catch {}
  }));

  out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return out.slice(0, limit);
}
