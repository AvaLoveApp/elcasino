import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Loader2, Send, X, Coins, Dices, Trash2, Quote, Bookmark } from "lucide-react";
import { SharePicker } from "./SharePicker";
import { useWallet } from "../lib/wallet";
import { loadProfile } from "../lib/midchat";
import {
  loadFeed, loadFollowingFeed, loadUserPosts, loadReplies, createPost, toggleLike, likedByMe, subscribeFeed, deletePost,
  takePendingShare, onShare, socialEnabled, notify, loadPost, bookmarkedByMe, toggleBookmark,
  type Post, type TokenEmbed, type GameEmbed,
} from "../lib/social";
import { short, timeAgo } from "../lib/util";
import { Avatar } from "./Avatar";
import { LivePinned } from "./LivePinned";
import { ActivityTicker } from "./ActivityTicker";
import { TipButton } from "./TipButton";
import { PostMedia } from "./PostMedia";
import { Rich } from "../lib/emoji";
import { ImagePlus } from "lucide-react";

/** Pull a media URL out of a post's meta (plain posts store it as meta.media). */
function postMedia(p: Post): string | null {
  const m = (p.meta as any)?.media;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

/**
 * SocialFi feed — X-like posts backed by Supabase. Composer at the top (with an
 * attached token/game embed when shared from elsewhere), then the live feed.
 */
export function Feed() {
  const w = useWallet();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [quoting, setQuoting] = useState<Post | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [end, setEnd] = useState(false);

  const refreshLikes = useCallback(async (list: Post[]) => {
    if (!w.address) { setLiked(new Set()); setSaved(new Set()); return; }
    const ids = list.map((p) => p.id);
    const [lk, bm] = await Promise.all([likedByMe(ids, w.address), bookmarkedByMe(ids, w.address)]);
    setLiked((s) => new Set([...s, ...lk]));
    setSaved((s) => new Set([...s, ...bm]));
  }, [w.address]);

  async function bookmark(p: Post) {
    if (!w.address) { w.connect(); return; }
    const isSaved = saved.has(p.id);
    setSaved((s) => { const n = new Set(s); isSaved ? n.delete(p.id) : n.add(p.id); return n; });
    try { await toggleBookmark(p.id, w.address, isSaved); } catch {}
  }

  useEffect(() => {
    let live = true;
    setPosts(null); setEnd(false);
    const loader = tab === "following" && w.address ? loadFollowingFeed(w.address) : loadFeed();
    loader.then((list) => { if (!live) return; setPosts(list); refreshLikes(list); }).catch(() => setPosts([]));
    // Realtime only augments the "For you" firehose; Following is filtered on load.
    const un = tab === "foryou"
      ? subscribeFeed((p) => setPosts((cur) => (cur && !cur.some((x) => x.id === p.id) ? [p, ...cur] : cur)))
      : () => {};
    return () => { live = false; un(); };
  }, [refreshLikes, tab, w.address]);

  const onPosted = (p: Post) => { setQuoting(null); setPosts((cur) => (cur ? [p, ...cur.filter((x) => x.id !== p.id)] : [p])); };

  async function like(p: Post) {
    if (!w.address) { w.connect(); return; }
    const isLiked = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); isLiked ? n.delete(p.id) : n.add(p.id); return n; });
    setPosts((cur) => cur?.map((x) => x.id === p.id ? { ...x, like_count: x.like_count + (isLiked ? -1 : 1) } : x) ?? cur);
    try {
      await toggleLike(p.id, w.address, isLiked);
      if (!isLiked) notify({ recipient: p.wallet, actor: w.address, type: "like", postId: p.id, actorName: w.profile?.name, actorAvatar: w.profile?.avatar });
    } catch {}
  }

  async function remove(p: Post) {
    setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? cur);
    await deletePost(p.id).catch(() => {});
  }

  async function more() {
    if (!posts || posts.length === 0 || loadingMore || end) return;
    setLoadingMore(true);
    const next = await loadFeed(30, posts[posts.length - 1].created_at).catch(() => []);
    setPosts((cur) => [...(cur ?? []), ...next]);
    if (next.length < 30) setEnd(true);
    refreshLikes(next);
    setLoadingMore(false);
  }

  if (!socialEnabled) {
    return <div className="panel p-6 text-center text-bone-500 text-sm">Social feed is being set up.</div>;
  }

  return (
    <div className="space-y-3">
      <ActivityTicker />
      <LivePinned />
      <Composer onPosted={onPosted} quoting={quoting} onClearQuote={() => setQuoting(null)} />
      {/* For you / Following */}
      <div className="flex gap-1 rounded-xl bg-ink-800/70 border border-ink-700/70 p-1">
        {(["foryou", "following"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${tab === t ? "bg-ink-600 text-bone-50" : "text-bone-400 hover:text-bone-100"}`}>
            {t === "foryou" ? "For you" : "Following"}
          </button>
        ))}
      </div>
      {posts === null && <div className="panel p-8 text-center text-bone-500"><Loader2 className="animate-spin mx-auto" size={18} /></div>}
      {posts && posts.length === 0 && (
        <div className="panel p-8 text-center text-bone-500 text-sm">
          {tab === "following" ? (w.address ? "No posts from people you follow yet — find some in Explore." : "Connect to see who you follow.") : "No posts yet — be the first to say something."}
        </div>
      )}
      {posts?.map((p) => (
        <PostCard key={p.id} post={p} liked={liked.has(p.id)} saved={saved.has(p.id)}
          mine={!!w.address && p.wallet.toLowerCase() === w.address.toLowerCase()}
          onLike={() => like(p)} onDelete={() => remove(p)} onBookmark={() => bookmark(p)} onQuote={() => setQuoting(p)} />
      ))}
      {tab === "foryou" && posts && posts.length >= 30 && !end && (
        <button onClick={more} disabled={loadingMore} className="btn-ghost w-full py-2.5 text-sm border border-ink-700">
          {loadingMore ? <Loader2 size={14} className="animate-spin" /> : "Load more"}
        </button>
      )}
    </div>
  );
}

// ── A single wallet's posts (profile timeline) ───────────────────────────────
export function UserPosts({ wallet }: { wallet: string }) {
  const w = useWallet();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    loadUserPosts(wallet).then(async (list) => {
      if (!live) return;
      setPosts(list);
      if (w.address) setLiked(await likedByMe(list.map((p) => p.id), w.address));
    }).catch(() => setPosts([]));
    return () => { live = false; };
  }, [wallet, w.address]);

  async function like(p: Post) {
    if (!w.address) { w.connect(); return; }
    const isLiked = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); isLiked ? n.delete(p.id) : n.add(p.id); return n; });
    setPosts((cur) => cur?.map((x) => x.id === p.id ? { ...x, like_count: x.like_count + (isLiked ? -1 : 1) } : x) ?? cur);
    try { await toggleLike(p.id, w.address, isLiked); } catch {}
  }
  async function remove(p: Post) { setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? cur); await deletePost(p.id).catch(() => {}); }

  if (!socialEnabled) return null;
  if (posts === null) return <div className="panel p-8 text-center text-bone-500"><Loader2 className="animate-spin mx-auto" size={18} /></div>;
  if (posts.length === 0) return <div className="panel p-8 text-center text-bone-500 text-sm">No posts yet.</div>;
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={liked.has(p.id)} mine={!!w.address && p.wallet.toLowerCase() === w.address.toLowerCase()}
          onLike={() => like(p)} onDelete={() => remove(p)} />
      ))}
    </div>
  );
}

// ── Saved posts (Bookmarks page) ─────────────────────────────────────────────
export function SavedPosts({ wallet }: { wallet: string }) {
  const w = useWallet();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    import("../lib/social").then(({ loadBookmarks }) => loadBookmarks(wallet)).then(async (list) => {
      if (!live) return;
      setPosts(list);
      setSaved(new Set(list.map((p) => p.id)));
      if (w.address) setLiked(await likedByMe(list.map((p) => p.id), w.address));
    }).catch(() => setPosts([]));
    return () => { live = false; };
  }, [wallet, w.address]);

  async function like(p: Post) {
    if (!w.address) { w.connect(); return; }
    const isLiked = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); isLiked ? n.delete(p.id) : n.add(p.id); return n; });
    setPosts((cur) => cur?.map((x) => x.id === p.id ? { ...x, like_count: x.like_count + (isLiked ? -1 : 1) } : x) ?? cur);
    try { await toggleLike(p.id, w.address, isLiked); } catch {}
  }
  async function unsave(p: Post) {
    if (!w.address) return;
    setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? cur); // remove from the saved list on un-bookmark
    try { await toggleBookmark(p.id, w.address, true); } catch {}
  }
  async function remove(p: Post) { setPosts((cur) => cur?.filter((x) => x.id !== p.id) ?? cur); await deletePost(p.id).catch(() => {}); }

  if (!socialEnabled) return null;
  if (posts === null) return <div className="panel p-8 text-center text-bone-500"><Loader2 className="animate-spin mx-auto" size={18} /></div>;
  if (posts.length === 0) return <div className="panel p-8 text-center text-bone-500 text-sm">No bookmarks yet — tap the bookmark icon on a post to save it.</div>;
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={liked.has(p.id)} saved={saved.has(p.id)}
          mine={!!w.address && p.wallet.toLowerCase() === w.address.toLowerCase()}
          onLike={() => like(p)} onDelete={() => remove(p)} onBookmark={() => unsave(p)} />
      ))}
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────
function Composer({ onPosted, quoting, onClearQuote }: { onPosted: (p: Post) => void; quoting?: Post | null; onClearQuote?: () => void }) {
  const w = useWallet();
  const [text, setText] = useState("");
  const [embed, setEmbed] = useState<{ kind: "token" | "game"; meta: any } | null>(null);
  const [media, setMedia] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [prof, setProf] = useState<{ username: string; avatar_url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!w.address) { setProf(null); return; }
    loadProfile(w.address).then((p) => setProf(p ? { username: p.username, avatar_url: p.avatar_url } : null)).catch(() => {});
  }, [w.address]);

  // Pick up a pending "share to feed" (from a token/game page). Only consume it
  // once connected, so a not-connected user who tapped Share still gets the embed
  // after they connect (rather than it being silently swallowed on mount).
  useEffect(() => {
    if (!w.address) return;
    const pull = () => {
      const s = takePendingShare();
      if (s) { setEmbed(s.kind === "token" || s.kind === "game" ? { kind: s.kind, meta: s.meta } : null); if (s.text) setText(s.text); }
    };
    pull();
    return onShare(pull);
  }, [w.address]);

  const name = prof?.username || (w.address ? short(w.address) : "");
  const canPost = !!w.address && (text.trim().length > 0 || !!embed || !!media.trim() || !!quoting);

  async function submit() {
    if (!w.address) { w.connect(); return; }
    if (!canPost) return;
    setBusy(true); setErr(null);
    try {
      // Quote owns meta.quote; a token/game embed owns meta; else a plain post may carry media.
      const meta = quoting
        ? { quote: quoting.id, ...(media.trim() ? { media: media.trim() } : {}) }
        : (embed?.meta ?? (media.trim() ? { media: media.trim() } : null));
      const p = await createPost({
        wallet: w.address, username: name, avatar_url: prof?.avatar_url || w.profile?.avatar || "",
        text, kind: quoting ? "post" : (embed?.kind ?? "post"), meta,
      });
      if (p) onPosted(p);
      setText(""); setEmbed(null); setMedia(""); setShowMedia(false);
    } catch (e: any) { setErr(e?.message || "Could not post."); }
    finally { setBusy(false); }
  }

  if (!w.address) {
    return (
      <div className="panel p-4 flex items-center justify-between gap-3">
        <span className="text-sm text-bone-400">Connect to post to the feed.</span>
        <button onClick={w.connect} className="btn-primary py-2 px-4 text-sm">Connect</button>
      </div>
    );
  }

  return (
    <div className="panel p-3">
      <div className="flex gap-3">
        <Avatar uri={prof?.avatar_url || w.profile?.avatar} name={name} size={40} ring={false} />
        <div className="flex-1 min-w-0">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={2}
            placeholder="What's happening on-chain?"
            className="w-full bg-transparent outline-none resize-none text-[15px] placeholder:text-bone-600" />
          {quoting && (
            <div className="relative mt-1 rounded-xl border border-ink-600 bg-ink-900/60 p-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-blood-400 mb-0.5">Quoting {quoting.username || short(quoting.wallet)}</div>
              <div className="text-xs text-bone-400 line-clamp-2 break-words">{quoting.text || "(no text)"}</div>
              <button onClick={onClearQuote} className="absolute right-1.5 top-1.5 text-bone-500 hover:text-blood-400"><X size={13} /></button>
            </div>
          )}
          {embed && (
            <div className="relative mt-1">
              {embed.kind === "token" ? <TokenEmbedCard e={embed.meta} /> : <GameEmbedCard e={embed.meta} />}
              <button onClick={() => setEmbed(null)} className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink-950/80 text-bone-400 hover:text-blood-400"><X size={13} /></button>
            </div>
          )}
          {!embed && showMedia && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <input value={media} onChange={(e) => setMedia(e.target.value)} placeholder="Image, video, or YouTube URL"
                  className="field flex-1 font-mono text-xs py-2" />
                <button onClick={() => { setShowMedia(false); setMedia(""); }} className="text-bone-400 hover:text-blood-500"><X size={16} /></button>
              </div>
              {media.trim() && <PostMedia uri={media.trim()} compact />}
            </div>
          )}
          {err && <div className="text-blood-300 text-xs mt-1">{err}</div>}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <button onClick={() => setShowMedia((s) => !s)} title="Add image / video / YouTube" disabled={!!embed}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono transition disabled:opacity-40 ${showMedia ? "border-blood-500/60 text-blood-300" : "border-ink-600 text-bone-400 hover:border-blood-500/50 hover:text-blood-300"}`}>
                <ImagePlus size={12} /> Media
              </button>
              <button onClick={() => setPicking(true)} title="Attach a token or casino room"
                className="inline-flex items-center gap-1 rounded-full border border-ink-600 px-2.5 py-1 text-[11px] font-mono text-bone-400 hover:border-blood-500/50 hover:text-blood-300 transition">
                <Coins size={12} /> Token
              </button>
              <button onClick={() => setPicking(true)} title="Attach a casino room"
                className="inline-flex items-center gap-1 rounded-full border border-ink-600 px-2.5 py-1 text-[11px] font-mono text-bone-400 hover:border-emerald-500/50 hover:text-emerald-300 transition">
                <Dices size={12} /> Room
              </button>
              <span className="font-mono text-[10px] text-bone-600 ml-1.5">{text.length}/2000</span>
            </div>
            <button onClick={submit} disabled={busy || !canPost} className="btn-primary py-1.5 px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post
            </button>
          </div>
        </div>
      </div>
      {picking && <SharePicker onClose={() => setPicking(false)} onPick={(p) => { setEmbed({ kind: p.kind, meta: p.meta }); setPicking(false); }} />}
    </div>
  );
}

// ── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, liked, saved, mine, onLike, onDelete, onBookmark, onQuote }: {
  post: Post; liked: boolean; saved?: boolean; mine: boolean;
  onLike: () => void; onDelete: () => void; onBookmark?: () => void; onQuote?: () => void;
}) {
  const to = `/a/${post.wallet}`;
  const [showReplies, setShowReplies] = useState(false);
  const [replyCount, setReplyCount] = useState(post.reply_count || 0);
  const quoteId = (post.meta as any)?.quote as string | undefined;
  return (
    <div className="panel p-3.5">
      <div className="flex gap-3">
        <Link to={to}><Avatar uri={post.avatar_url} name={post.username || short(post.wallet)} size={40} ring={false} /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <Link to={to} className="font-semibold text-bone-50 hover:underline truncate">{post.username || short(post.wallet)}</Link>
            <span className="font-mono text-[11px] text-bone-600 truncate">{short(post.wallet)}</span>
            <span className="text-bone-600">·</span>
            <span className="font-mono text-[11px] text-bone-600">{timeAgo(Math.floor(new Date(post.created_at).getTime() / 1000))}</span>
            {mine && <button onClick={onDelete} className="ml-auto text-bone-600 hover:text-blood-400" title="Delete"><Trash2 size={13} /></button>}
          </div>
          {post.text && <Rich text={post.text} className="text-[15px] text-bone-100 mt-0.5 whitespace-pre-wrap break-words block" />}
          {postMedia(post) && <PostMedia uri={postMedia(post)!} />}
          {quoteId && <QuotedInline id={quoteId} />}
          {post.kind === "token" && post.meta && <div className="mt-2"><TokenEmbedCard e={post.meta as TokenEmbed} /></div>}
          {post.kind === "game" && post.meta && <div className="mt-2"><GameEmbedCard e={post.meta as GameEmbed} /></div>}
          <div className="flex items-center gap-5 mt-2 text-bone-500">
            <button onClick={onLike} className={`inline-flex items-center gap-1.5 text-xs transition hover:text-blood-400 ${liked ? "text-blood-400" : ""}`}>
              <Heart size={15} fill={liked ? "currentColor" : "none"} /> {post.like_count || 0}
            </button>
            <button onClick={() => setShowReplies((v) => !v)} className={`inline-flex items-center gap-1.5 text-xs transition hover:text-blood-400 ${showReplies ? "text-blood-400" : ""}`}>
              <MessageCircle size={15} /> {replyCount}
            </button>
            {onQuote && (
              <button onClick={onQuote} title="Quote" className="inline-flex items-center text-xs transition hover:text-blood-400">
                <Quote size={15} />
              </button>
            )}
            {onBookmark && (
              <button onClick={onBookmark} title={saved ? "Saved" : "Bookmark"}
                className={`inline-flex items-center text-xs transition hover:text-blood-400 ${saved ? "text-blood-400" : ""}`}>
                <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
              </button>
            )}
            <span className="ml-auto"><TipButton to={post.wallet} /></span>
          </div>
          {showReplies && <Replies postId={post.id} parentAuthor={post.wallet} onReplied={() => setReplyCount((c) => c + 1)} />}
        </div>
      </div>
    </div>
  );
}

// ── Quoted post (compact card inside a quote-post) ───────────────────────────
function QuotedInline({ id }: { id: string }) {
  const [q, setQ] = useState<Post | null | "missing">(null);
  useEffect(() => {
    let live = true;
    loadPost(id).then((p) => { if (live) setQ(p ?? "missing"); }).catch(() => { if (live) setQ("missing"); });
    return () => { live = false; };
  }, [id]);
  if (q === null) return <div className="mt-2 rounded-xl border border-ink-700/60 bg-ink-900/40 p-2.5 text-xs text-bone-600">loading quote…</div>;
  if (q === "missing") return <div className="mt-2 rounded-xl border border-ink-700/60 bg-ink-900/40 p-2.5 text-xs text-bone-600 italic">quoted post unavailable</div>;
  return (
    <Link to={`/a/${q.wallet}`} className="mt-2 block rounded-xl border border-ink-600 bg-ink-900/50 p-2.5 hover:border-blood-500/40 transition">
      <div className="flex items-center gap-1.5 text-xs">
        <Avatar uri={q.avatar_url} name={q.username || short(q.wallet)} size={20} ring={false} />
        <span className="font-semibold text-bone-100 truncate">{q.username || short(q.wallet)}</span>
        <span className="font-mono text-[10px] text-bone-600">{timeAgo(Math.floor(new Date(q.created_at).getTime() / 1000))}</span>
      </div>
      {q.text && <Rich text={q.text} className="text-[13px] text-bone-300 mt-1 line-clamp-3 block break-words" />}
      {postMedia(q) && <PostMedia uri={postMedia(q)!} compact />}
    </Link>
  );
}

// ── Replies (inline thread) ──────────────────────────────────────────────────
function Replies({ postId, parentAuthor, onReplied }: { postId: string; parentAuthor: string; onReplied: () => void }) {
  const w = useWallet();
  const [rows, setRows] = useState<Post[] | null>(null);
  const [prof, setProf] = useState<{ username: string; avatar_url: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadReplies(postId).then(setRows).catch(() => setRows([])); }, [postId]);
  useEffect(() => { if (w.address) loadProfile(w.address).then((p) => setProf(p ? { username: p.username, avatar_url: p.avatar_url } : null)).catch(() => {}); }, [w.address]);

  async function send() {
    if (!w.address) { w.connect(); return; }
    const body = text.trim(); if (!body) return;
    setBusy(true);
    try {
      const p = await createPost({ wallet: w.address, username: prof?.username || short(w.address), avatar_url: prof?.avatar_url || w.profile?.avatar || "", text: body, replyTo: postId });
      if (p) {
        setRows((r) => [...(r ?? []), p]); onReplied();
        notify({ recipient: parentAuthor, actor: w.address, type: "reply", postId, meta: { text: body.slice(0, 80) }, actorName: prof?.username, actorAvatar: prof?.avatar_url || w.profile?.avatar });
      }
      setText("");
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="mt-2.5 border-l-2 border-ink-700/60 pl-3 space-y-2.5">
      {rows === null && <div className="text-bone-600 text-xs"><Loader2 size={12} className="animate-spin inline" /> loading…</div>}
      {rows?.map((r) => (
        <div key={r.id} className="flex gap-2">
          <Link to={`/a/${r.wallet}`}><Avatar uri={r.avatar_url} name={r.username || short(r.wallet)} size={28} ring={false} /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs">
              <Link to={`/a/${r.wallet}`} className="font-semibold text-bone-100 hover:underline truncate">{r.username || short(r.wallet)}</Link>
              <span className="font-mono text-[10px] text-bone-600">{timeAgo(Math.floor(new Date(r.created_at).getTime() / 1000))}</span>
            </div>
            {r.text && <Rich text={r.text} className="text-sm text-bone-200 whitespace-pre-wrap break-words block" />}
            {postMedia(r) && <PostMedia uri={postMedia(r)!} compact />}
          </div>
        </div>
      ))}
      {w.address ? (
        <div className="flex items-center gap-2 pt-0.5">
          <Avatar uri={prof?.avatar_url || w.profile?.avatar} name={prof?.username || short(w.address)} size={26} ring={false} />
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Reply…" className="field flex-1 py-1.5 text-sm" />
          <button onClick={send} disabled={busy || !text.trim()} className="btn-primary py-1.5 px-3 text-xs disabled:opacity-40">{busy ? "…" : "Reply"}</button>
        </div>
      ) : (
        <button onClick={w.connect} className="text-xs text-blood-300 hover:underline">Connect to reply</button>
      )}
    </div>
  );
}

function embFmt(n?: number): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  if (a > 0 && a < 1) return n.toFixed(a < 0.001 ? 6 : 4);
  return String(Math.round(n));
}
function Metric({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" | "brand" }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-wider text-bone-500">{k}</div>
      <div className={`font-mono text-xs font-bold tabular-nums truncate ${tone === "up" ? "text-emerald-300" : tone === "down" ? "text-blood-300" : tone === "brand" ? "text-blood-300" : "text-bone-100"}`}>{v}</div>
    </div>
  );
}

function TokenEmbedCard({ e }: { e: TokenEmbed }) {
  const isMid = !!(e.priceMid != null || e.liqMid != null || e.supply != null);
  const price = e.priceUsd ? "$" + embFmt(e.priceUsd) : e.priceEth ? embFmt(e.priceEth) + " Ξ" : e.priceMid ? embFmt(e.priceMid) + " MID" : "—";
  const liq = e.liqUsd ? "$" + embFmt(e.liqUsd) : e.liqEth ? embFmt(e.liqEth) + " Ξ" : e.liqMid ? embFmt(e.liqMid) + " MID" : "—";
  const third = isMid ? { k: "Supply", v: e.supply ? embFmt(e.supply) : "—" } : { k: "Mkt cap", v: e.mcapUsd ? "$" + embFmt(e.mcapUsd) : "—" };
  const hasMetrics = price !== "—" || liq !== "—" || third.v !== "—";
  return (
    <Link to="/trade" className="block rounded-xl border border-ink-600 bg-ink-900/60 p-3 hover:border-blood-500/50 transition">
      <div className="flex items-center gap-3">
        {e.logo ? <img src={e.logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600" onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-blood-500/20 text-blood-300"><Coins size={16} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-bone-50">${e.symbol}</div>
          <div className="font-mono text-[10px] text-bone-500 truncate">{short(e.token)}</div>
        </div>
        {e.changePct != null && <span className={`text-[11px] font-mono ${e.changePct >= 0 ? "text-emerald-300" : "text-blood-300"}`}>{e.changePct >= 0 ? "+" : ""}{e.changePct.toFixed(1)}%</span>}
        <span className="text-[11px] font-mono text-blood-300 shrink-0">Trade →</span>
      </div>
      {hasMetrics && (
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-ink-700/60">
          <Metric k="Price" v={price} />
          <Metric k="Liquidity" v={liq} />
          <Metric k={third.k} v={third.v} />
        </div>
      )}
    </Link>
  );
}

function GameEmbedCard({ e }: { e: GameEmbed }) {
  const sym = e.symbol || "";
  const suffix = sym ? " " + sym : "";
  // Build the metric row from whatever the room actually reported, so a shared
  // card always shows its live numbers (pool, volume, bets, stakers, RTP, fee).
  const metrics: { k: string; v: string; tone?: "up" | "down" | "brand" }[] = [];
  if (e.pool != null) metrics.push({ k: "Pool", v: embFmt(e.pool) + suffix, tone: "up" });
  if (e.volume != null) metrics.push({ k: "Volume", v: embFmt(e.volume) + suffix });
  if (e.bets != null) metrics.push({ k: "Bets", v: embFmt(e.bets) });
  if (e.stakers != null) metrics.push({ k: "Stakers", v: embFmt(e.stakers) });
  if (e.rtp != null && e.rtp > 0) metrics.push({ k: "RTP", v: (e.rtp / 100).toFixed(1) + "%" });
  if (e.fee != null && e.fee > 0) metrics.push({ k: "Fee", v: (e.fee / 100).toFixed(1) + "%" });
  else if (e.apr != null) metrics.push({ k: "APR", v: e.apr.toFixed(0) + "%", tone: "up" });
  return (
    <Link to={`/casino/room/${e.gameKey}/${e.address}`} className="block rounded-xl border border-ink-600 bg-ink-900/60 p-3 hover:border-emerald-500/50 transition">
      <div className="flex items-center gap-3">
        {e.logo ? <img src={e.logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600" onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"><Dices size={16} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-bone-50 truncate">{e.label || `${e.gameKey} room`}</div>
          <div className="font-mono text-[10px] text-bone-500 truncate capitalize">{e.gameKey}{sym ? ` · $${sym}` : ""} · {short(e.address)}</div>
        </div>
        <span className="text-[11px] font-mono text-emerald-300 shrink-0">Play →</span>
      </div>
      {metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-ink-700/60">
          {metrics.map((m) => <Metric key={m.k} k={m.k} v={m.v} tone={m.tone} />)}
        </div>
      )}
    </Link>
  );
}
