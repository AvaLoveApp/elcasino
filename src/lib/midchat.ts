import { formatUnits } from "ethers";
import { supabase } from "./supabase";
import { readMidgard } from "./chain";

/**
 * MidChat data layer — profiles + messages over Supabase, with realtime and an
 * AI helper that calls the `midgard-ai` Edge Function (the OpenRouter key lives
 * server-side, never in the browser).
 */

export type Profile = { wallet: string; username: string; avatar_url: string; bio?: string; banner?: string; social?: string; locked?: boolean; updated_at?: string };
export type MsgKind = "chat" | "game" | "ai";
export type ChatMessage = {
  id: string;
  wallet: string;
  username: string;
  avatar_url: string;
  text: string;
  kind: MsgKind;
  meta: any;
  created_at: string;
};

export const MSG_LIMIT = 50;   // show the last 50 messages
export const MAX_TEXT = 500;
export const AI_WALLET = "midgard-ai";

// ── Profiles ────────────────────────────────────────────────────────────────
export async function loadProfile(wallet: string): Promise<Profile | null> {
  if (!supabase || !wallet) return null;
  const { data } = await supabase.from("profiles").select("*").eq("wallet", wallet.toLowerCase()).maybeSingle();
  return (data as Profile) ?? null;
}

/** Resolve many wallets to profiles at once — a lowercased wallet→Profile map. */
export async function loadProfilesMap(wallets: string[]): Promise<Map<string, Profile>> {
  const m = new Map<string, Profile>();
  const uniq = Array.from(new Set(wallets.map((w) => w.toLowerCase()).filter(Boolean)));
  if (!supabase || uniq.length === 0) return m;
  const { data } = await supabase.from("profiles").select("*").in("wallet", uniq);
  for (const p of (data as Profile[]) ?? []) m.set(p.wallet.toLowerCase(), p);
  return m;
}

/** Directory of profiles, newest-active first (for Explore's People list). */
export async function loadProfilesPaged(offset = 0, limit = 30): Promise<Profile[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("profiles").select("*")
    .order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  return (data as Profile[]) ?? [];
}

/** Resolve a profile by its username (case-insensitive); first match wins. */
export async function loadProfileByUsername(username: string): Promise<Profile | null> {
  if (!supabase || !username) return null;
  const { data } = await supabase!.from("profiles").select("*").ilike("username", username).limit(1);
  return ((data as Profile[]) ?? [])[0] ?? null;
}

export async function saveProfile(p: Profile): Promise<Profile | null> {
  if (!supabase) throw new Error("MidChat is not configured yet.");
  const row = {
    wallet: p.wallet.toLowerCase(),
    username: (p.username || "").trim().slice(0, 32),
    avatar_url: (p.avatar_url || "").trim().slice(0, 400),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("profiles").upsert(row).select().maybeSingle();
  if (error) throw error;
  return data as Profile;
}

/** True when a PostgREST error means a column we tried to write doesn't exist. */
function isUnknownColumn(err: any): boolean {
  const c = String(err?.code || "");
  const m = String(err?.message || "").toLowerCase();
  return c === "PGRST204" || c === "42703" || m.includes("column") && m.includes("does not exist");
}

/**
 * Auto-provision the Supabase identity for a social (Google/X/…) login. The
 * embedded-wallet address is the stable user_id, so the same Google/X account
 * always maps to the same row. Name + username + avatar are pulled from the
 * social account and LOCKED (social users don't hand-edit them). Returns the
 * stored profile. Degrades gracefully if the `social`/`locked` columns aren't
 * migrated yet (writes only wallet/username/avatar_url in that case).
 */
export async function provisionSocialProfile(
  wallet: string,
  name: string | undefined,
  avatar: string | undefined,
  social: string | null,
): Promise<Profile | null> {
  if (!supabase || !wallet) return null;
  const w = wallet.toLowerCase();
  const existing = await loadProfile(w).catch(() => null);
  // Name comes from the social account; fall back to a short address handle.
  const username = (name || existing?.username || `user_${w.slice(2, 8)}`).trim().slice(0, 32);
  const avatar_url = (avatar || existing?.avatar_url || "").trim().slice(0, 400);
  const base = { wallet: w, username, avatar_url, updated_at: new Date().toISOString() };
  const rich = { ...base, social: social || "wallet", locked: true };

  // Try the rich row (with social/locked); fall back if those columns are absent.
  let res = await supabase.from("profiles").upsert(rich).select().maybeSingle();
  if (res.error && isUnknownColumn(res.error)) {
    res = await supabase.from("profiles").upsert(base).select().maybeSingle();
  }
  if (res.error) { console.warn("provisionSocialProfile:", res.error.message); return existing; }
  return res.data as Profile;
}

// ── Messages ────────────────────────────────────────────────────────────────
export async function loadMessages(limit = MSG_LIMIT): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as ChatMessage[]).reverse(); // oldest → newest for display
}

export async function sendMessage(msg: {
  wallet: string; username: string; avatar_url: string; text: string; kind?: MsgKind; meta?: any;
}): Promise<void> {
  if (!supabase) throw new Error("MidChat is not configured yet.");
  const text = (msg.text || "").slice(0, MAX_TEXT);
  if (!text.trim()) return;
  const row = {
    wallet: (msg.wallet || "anon").toLowerCase(),
    username: (msg.username || "").slice(0, 32),
    avatar_url: (msg.avatar_url || "").slice(0, 400),
    text,
    kind: msg.kind ?? "chat",
    meta: msg.meta ?? null,
  };
  const { error } = await supabase.from("messages").insert(row);
  if (error) throw error;
}

/** Live INSERT stream. Returns an unsubscribe fn. */
export function subscribeMessages(onInsert: (m: ChatMessage) => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase
    .channel("midchat-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      onInsert(payload.new as ChatMessage);
    })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch {} };
}

// ── MIDGARD balances (shown next to chatters) ───────────────────────────────
const balCache = new Map<string, number>();
export async function fetchMidgardBalances(wallets: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = [...new Set(wallets.map((w) => (w || "").toLowerCase()))].filter((w) => /^0x[a-f0-9]{40}$/.test(w));
  const m = readMidgard();
  await Promise.all(uniq.map(async (w) => {
    if (balCache.has(w)) { out.set(w, balCache.get(w)!); return; }
    try {
      const n = Number(formatUnits(await m.balanceOf(w), 18));
      balCache.set(w, n); out.set(w, n);
    } catch { /* leave unknown */ }
  }));
  return out;
}

export function fmtBalCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Midgard AI ──────────────────────────────────────────────────────────────
// Runs as a Postgres RPC (public.ask_midgard_ai): the OpenRouter key lives in a
// private table server-side and the function calls OpenRouter via the http
// extension — the key never reaches the browser.
// Client-side steer prepended to the AI context. The real system prompt lives in
// the server-side `ask_midgard_ai` function; this is a best-effort guardrail so
// the assistant stays on the EL-Casino product and does NOT pitch the ELCAS token
// or its tokenomics (the token isn't public yet — launching on Pons later).
const AI_STEER =
  "System: You are EL-Casino AI, the assistant for the EL-Casino platform on Robinhood Chain — provably-fair on-chain casino games (dice, slots, mines, wheel, blackjack), trading casino tokens, staking as the house, and the wallet. Do NOT discuss, promote, price, or explain the ELCAS token or any tokenomics/economy/yield/reflection model — it is not launched yet. If asked about the ELCAS token, tokenomics, price, or yield, say it isn't available yet and steer back to the games and platform. Keep answers short and helpful.";

export async function askMidgardAI(question: string, recent: string[] = []): Promise<string> {
  if (!supabase) throw new Error("MidChat is not configured yet.");
  const { data, error } = await supabase.rpc("ask_midgard_ai", {
    question: question.slice(0, 1000),
    recent: [AI_STEER, ...recent.slice(-8)],
  });
  if (error) throw error;
  const answer = typeof data === "string" ? data : (data as any)?.answer;
  if (!answer) throw new Error("Midgard AI had no answer.");
  return String(answer);
}

// ── Mini-games (Telegram-style, client-rolled) ──────────────────────────────
export type GameResult = { text: string; meta: any };

const DICE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const SLOT = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎"];
const rnd = (n: number) => Math.floor(Math.random() * n);

/** Parse a leading slash-command into a game result, or null if it isn't one. */
export function parseGameCommand(raw: string): GameResult | null {
  const t = raw.trim();
  if (!t.startsWith("/")) return null;
  const [cmd, ...rest] = t.slice(1).split(/\s+/);
  switch (cmd.toLowerCase()) {
    case "dice":
    case "roll": {
      if (cmd.toLowerCase() === "dice") {
        const v = rnd(6) + 1;
        return { text: `rolled a ${v} ${DICE[v]}`, meta: { game: "dice", value: v } };
      }
      const max = Math.max(2, Math.min(1_000_000, parseInt(rest[0] || "100", 10) || 100));
      const v = rnd(max) + 1;
      return { text: `rolled ${v} (1–${max})`, meta: { game: "roll", value: v, max } };
    }
    case "flip":
    case "coin": {
      const heads = rnd(2) === 0;
      return { text: `flipped ${heads ? "Heads 🪙" : "Tails 🪙"}`, meta: { game: "flip", value: heads ? "heads" : "tails" } };
    }
    case "slot":
    case "slots": {
      const reel = [SLOT[rnd(SLOT.length)], SLOT[rnd(SLOT.length)], SLOT[rnd(SLOT.length)]];
      const win = reel[0] === reel[1] && reel[1] === reel[2];
      return { text: `${reel.join(" ")} ${win ? "— JACKPOT! 🎉" : ""}`.trim(), meta: { game: "slot", reel, win } };
    }
    case "8ball": {
      const A = ["Yes.", "No.", "Definitely.", "Ask again later.", "Doubtful.", "Without a doubt.", "Not looking good.", "Signs point to yes."];
      return { text: `🎱 ${A[rnd(A.length)]}`, meta: { game: "8ball" } };
    }
    default:
      return null;
  }
}

export const GAME_HELP =
  "Mini-games: /dice · /flip · /roll [max] · /slot · /8ball. Ask the AI with the ✨ button or by starting a line with @ai.";
