import { supabase } from "./supabase";

/**
 * SocialFi data layer — X-like posts over Supabase. Identity is the connected
 * wallet. Posts can carry a rich embed (a launchpad/RWA token, or a casino game)
 * via `kind` + `meta`. Degrades gracefully when the `posts` table isn't migrated
 * yet (feed just shows empty).
 */

export type PostKind = "post" | "token" | "game" | "reply";

export type TokenEmbed = {
  token: string; symbol: string; logo?: string;
  // live metrics captured at share time (avalove-style rich card)
  priceEth?: number; priceUsd?: number; liqEth?: number; liqUsd?: number; mcapUsd?: number; changePct?: number;
  // launchpad tokens are priced/quoted in MIDGARD, not ETH/USD
  priceMid?: number; liqMid?: number; supply?: number;
};
export type GameEmbed = {
  gameKey: string; address: string; label?: string; token?: string; symbol?: string; logo?: string;
  // live room metrics captured at share time
  pool?: number; volume?: number; stakers?: number; apr?: number; bets?: number; rtp?: number; fee?: number;
};

export type Post = {
  id: string;
  wallet: string;
  username: string;
  avatar_url: string;
  text: string;
  kind: PostKind;
  meta: (TokenEmbed | GameEmbed | Record<string, any>) | null;
  reply_to: string | null;
  like_count: number;
  reply_count: number;
  created_at: string;
};

export const socialEnabled = !!supabase;

/** Exact row counts (head-only) for the home stats strip. */
export async function countPosts(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from("posts").select("*", { count: "exact", head: true });
  return count ?? 0;
}
export async function countMembers(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** Newest-first feed page. `before` is an ISO cursor for "load more". */
export async function loadFeed(limit = 30, before?: string): Promise<Post[]> {
  if (!supabase) return [];
  let q = supabase.from("posts").select("*").is("reply_to", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) return [];
  return (data as Post[]) ?? [];
}

/** Most-liked recent posts (for the Trending rail). */
export async function loadTrendingPosts(limit = 6): Promise<Post[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("posts").select("*").is("reply_to", null)
    .order("like_count", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  return (data as Post[]) ?? [];
}

/** Posts by one author (their profile timeline). */
export async function loadUserPosts(wallet: string, limit = 30): Promise<Post[]> {
  if (!supabase || !wallet) return [];
  const { data } = await supabase.from("posts").select("*")
    .eq("wallet", wallet.toLowerCase()).is("reply_to", null)
    .order("created_at", { ascending: false }).limit(limit);
  return (data as Post[]) ?? [];
}

/** Replies to a post, oldest-first. */
export async function loadReplies(postId: string): Promise<Post[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("posts").select("*")
    .eq("reply_to", postId).order("created_at", { ascending: true }).limit(100);
  return (data as Post[]) ?? [];
}

export async function createPost(input: {
  wallet: string; username: string; avatar_url: string;
  text: string; kind?: PostKind; meta?: any; replyTo?: string | null;
}): Promise<Post | null> {
  if (!supabase) throw new Error("Social backend not configured.");
  const text = (input.text || "").trim().slice(0, 2000);
  const kind: PostKind = input.replyTo ? "reply" : (input.kind || "post");
  if (!text && kind === "post") return null;
  const row: any = {
    wallet: input.wallet.toLowerCase(),
    username: (input.username || "").slice(0, 40),
    avatar_url: (input.avatar_url || "").slice(0, 400),
    text, kind, meta: input.meta ?? null, reply_to: input.replyTo ?? null,
  };
  const { data, error } = await supabase.from("posts").insert(row).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data as Post;
}

export async function deletePost(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("posts").delete().eq("id", id);
}

/** Which of these post ids the wallet has liked. */
export async function likedByMe(postIds: string[], wallet: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supabase || !wallet || postIds.length === 0) return out;
  const { data } = await supabase.from("post_likes").select("post_id")
    .eq("wallet", wallet.toLowerCase()).in("post_id", postIds);
  for (const r of (data as { post_id: string }[]) ?? []) out.add(r.post_id);
  return out;
}

/** Toggle a like; returns the new liked state. */
export async function toggleLike(postId: string, wallet: string, liked: boolean): Promise<boolean> {
  if (!supabase || !wallet) return liked;
  const w = wallet.toLowerCase();
  if (liked) { await supabase.from("post_likes").delete().eq("post_id", postId).eq("wallet", w); return false; }
  await supabase.from("post_likes").upsert({ post_id: postId, wallet: w });
  return true;
}

/** One post by id (used to render a quoted post inside another). */
export async function loadPost(id: string): Promise<Post | null> {
  if (!supabase || !id) return null;
  const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  return (data as Post) ?? null;
}

/** Search profiles by handle or bio (platform-wide people search). */
export type ProfileHit = { wallet: string; username: string; avatar_url: string; bio?: string };
export async function searchProfiles(term: string, limit = 20): Promise<ProfileHit[]> {
  if (!supabase) return [];
  const t = term.replace(/^@/, "").trim();
  if (!t) return [];
  const esc = t.replace(/[%,]/g, " ");
  const { data } = await supabase.from("profiles").select("wallet,username,avatar_url,bio")
    .or(`username.ilike.%${esc}%,bio.ilike.%${esc}%`).limit(limit);
  return (data as ProfileHit[]) ?? [];
}

/** Full-text-ish search over post bodies, newest-first. */
export async function searchPosts(term: string, limit = 30): Promise<Post[]> {
  if (!supabase) return [];
  const t = term.trim();
  if (!t) return [];
  const { data } = await supabase.from("posts").select("*")
    .ilike("text", `%${t}%`).order("created_at", { ascending: false }).limit(limit);
  return (data as Post[]) ?? [];
}

// ── Bookmarks (gas-free, per-wallet) ─────────────────────────────────────────
/** Which of these post ids the wallet has bookmarked. */
export async function bookmarkedByMe(postIds: string[], wallet: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supabase || !wallet || postIds.length === 0) return out;
  const { data } = await supabase.from("bookmarks").select("post_id")
    .eq("wallet", wallet.toLowerCase()).in("post_id", postIds);
  for (const r of (data as { post_id: string }[]) ?? []) out.add(r.post_id);
  return out;
}

/** Toggle a bookmark; returns the new saved state. */
export async function toggleBookmark(postId: string, wallet: string, saved: boolean): Promise<boolean> {
  if (!supabase || !wallet) return saved;
  const w = wallet.toLowerCase();
  if (saved) { await supabase.from("bookmarks").delete().eq("post_id", postId).eq("wallet", w); return false; }
  await supabase.from("bookmarks").upsert({ post_id: postId, wallet: w });
  return true;
}

/** The wallet's saved posts, newest-saved first. */
export async function loadBookmarks(wallet: string, limit = 50): Promise<Post[]> {
  if (!supabase || !wallet) return [];
  const { data: rows } = await supabase.from("bookmarks").select("post_id, created_at")
    .eq("wallet", wallet.toLowerCase()).order("created_at", { ascending: false }).limit(limit);
  const ids = ((rows as { post_id: string }[]) ?? []).map((r) => r.post_id);
  if (ids.length === 0) return [];
  const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
  const byId = new Map((posts as Post[] ?? []).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Post[];
}

export function subscribeFeed(onInsert: (p: Post) => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`social:feed:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" },
      (p) => { const row = p.new as Post; if (!row.reply_to) onInsert(row); })
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── Broadcasts (platform-wide announcements) ─────────────────────────────────
export type Broadcast = { id: string; sender: string; title: string; body: string; image: string; url: string; kind: string; created_at: string };

export async function sendBroadcast(b: { sender: string; title: string; body: string; image?: string; url?: string; kind?: string }): Promise<void> {
  if (!supabase) throw new Error("Not configured.");
  const { error } = await supabase.from("broadcasts").insert({
    sender: (b.sender || "").toLowerCase(), title: (b.title || "").slice(0, 120), body: (b.body || "").slice(0, 500),
    image: (b.image || "").slice(0, 400), url: b.url || "./#/notifications", kind: b.kind || "admin",
  });
  if (error) throw new Error(error.message);
}

export async function loadBroadcasts(limit = 12): Promise<Broadcast[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data as Broadcast[]) ?? [];
}

export function subscribeBroadcasts(onInsert: (b: Broadcast) => void): () => void {
  if (!supabase) return () => {};
  const ch = supabase.channel(`social:bc:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcasts" }, (p) => onInsert(p.new as Broadcast))
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── Notifications ────────────────────────────────────────────────────────────
export type NotifType = "like" | "reply" | "follow" | "tip";
export type Notification = {
  id: string; recipient: string; actor: string; actor_name: string; actor_avatar: string;
  type: NotifType; post_id: string | null; meta: any; read: boolean; created_at: string;
};

/** Fire-and-forget: record a notification for `recipient` (skips self). */
export async function notify(n: {
  recipient: string; actor: string; actorName?: string; actorAvatar?: string;
  type: NotifType; postId?: string | null; meta?: any;
}): Promise<void> {
  if (!supabase || !n.recipient || !n.actor) return;
  const r = n.recipient.toLowerCase(), a = n.actor.toLowerCase();
  if (r === a) return;
  await supabase.from("notifications").insert({
    recipient: r, actor: a, actor_name: n.actorName || "", actor_avatar: n.actorAvatar || "",
    type: n.type, post_id: n.postId ?? null, meta: n.meta ?? null,
  }).then(() => {}, () => {});
}

export async function loadNotifications(wallet: string, limit = 40): Promise<Notification[]> {
  if (!supabase || !wallet) return [];
  const { data } = await supabase.from("notifications").select("*")
    .eq("recipient", wallet.toLowerCase()).order("created_at", { ascending: false }).limit(limit);
  return (data as Notification[]) ?? [];
}

export async function countUnread(wallet: string): Promise<number> {
  if (!supabase || !wallet) return 0;
  const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true })
    .eq("recipient", wallet.toLowerCase()).eq("read", false);
  return count ?? 0;
}

export async function markAllRead(wallet: string): Promise<void> {
  if (!supabase || !wallet) return;
  await supabase.from("notifications").update({ read: true }).eq("recipient", wallet.toLowerCase()).eq("read", false);
}

export function subscribeNotifications(wallet: string, onInsert: (n: Notification) => void): () => void {
  if (!supabase || !wallet) return () => {};
  const w = wallet.toLowerCase();
  const ch = supabase.channel(`social:notif:${w}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${w}` },
      (p) => onInsert(p.new as Notification))
    .subscribe();
  return () => { try { supabase!.removeChannel(ch); } catch {} };
}

// ── Follows ──────────────────────────────────────────────────────────────────
export async function followCounts(wallet: string): Promise<{ followers: number; following: number }> {
  if (!supabase || !wallet) return { followers: 0, following: 0 };
  const w = wallet.toLowerCase();
  const [f1, f2] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following", w),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower", w),
  ]);
  return { followers: f1.count ?? 0, following: f2.count ?? 0 };
}

export async function isFollowing(follower: string, target: string): Promise<boolean> {
  if (!supabase || !follower || !target) return false;
  const { data } = await supabase.from("follows").select("follower")
    .eq("follower", follower.toLowerCase()).eq("following", target.toLowerCase()).maybeSingle();
  return !!data;
}

/** Toggle follow; returns the new following state. */
export async function toggleFollow(follower: string, target: string, following: boolean): Promise<boolean> {
  if (!supabase || !follower || !target) return following;
  const a = follower.toLowerCase(), b = target.toLowerCase();
  if (a === b) return following; // can't follow yourself
  if (following) { await supabase.from("follows").delete().eq("follower", a).eq("following", b); return false; }
  await supabase.from("follows").upsert({ follower: a, following: b });
  return true;
}

/** Wallets `wallet` follows (for the Following feed filter). */
export async function loadFollowing(wallet: string): Promise<string[]> {
  if (!supabase || !wallet) return [];
  const { data } = await supabase.from("follows").select("following").eq("follower", wallet.toLowerCase());
  return ((data as { following: string }[]) ?? []).map((r) => r.following);
}

/** Feed of posts from the wallets you follow (+ your own), newest first. */
export async function loadFollowingFeed(wallet: string, limit = 30): Promise<Post[]> {
  if (!supabase || !wallet) return [];
  const following = await loadFollowing(wallet);
  const authors = [...new Set([wallet.toLowerCase(), ...following])];
  if (authors.length === 0) return [];
  const { data } = await supabase.from("posts").select("*").is("reply_to", null)
    .in("wallet", authors).order("created_at", { ascending: false }).limit(limit);
  return (data as Post[]) ?? [];
}

// ── Cross-component "share to feed" bus ──────────────────────────────────────
// A token/game page calls shareToFeed({...}) then navigates to the feed; the
// composer picks up the pending share (prefilled text + embed) on mount.
export type PendingShare = { kind: PostKind; meta: any; text?: string };
let _pendingShare: PendingShare | null = null;
const _shareSubs = new Set<() => void>();
export function shareToFeed(s: PendingShare) { _pendingShare = s; _shareSubs.forEach((f) => f()); }
export function takePendingShare(): PendingShare | null { const s = _pendingShare; _pendingShare = null; return s; }
export function onShare(cb: () => void): () => void { _shareSubs.add(cb); return () => { _shareSubs.delete(cb); }; }

/** Update the caller's profile bio/banner (avatar/username handled in midchat). */
export async function saveBio(wallet: string, bio: string, banner?: string): Promise<void> {
  if (!supabase || !wallet) return;
  const row: any = { wallet: wallet.toLowerCase(), bio: (bio || "").slice(0, 280), updated_at: new Date().toISOString() };
  if (banner != null) row.banner = banner.slice(0, 400);
  await supabase.from("profiles").upsert(row);
}
