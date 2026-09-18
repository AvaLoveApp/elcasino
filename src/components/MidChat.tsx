import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Pencil, X, Loader2, Dice5, MessageSquare, Link2, Trophy } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { short, timeAgo } from "../lib/util";
import { supabaseEnabled } from "../lib/supabase";
import { TopHoldersMini } from "./TopHoldersMini";
import {
  Profile, ChatMessage, MSG_LIMIT, AI_WALLET, GAME_HELP,
  loadProfile, saveProfile, loadMessages, sendMessage, subscribeMessages, askMidgardAI, parseGameCommand,
  fetchMidgardBalances, fmtBalCompact,
} from "../lib/midchat";

/**
 * MidChat — a Telegram-style social layer for Midgard. Last 50 messages (older
 * ones expire server-side), realtime, per-wallet profiles (name + avatar URL),
 * in-chat mini-games, and a tag-able EL-Casino AI that knows the platform.
 */
export function MidChat() {
  const w = useWallet();
  const addr = (w.address || "").toLowerCase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [showHolders, setShowHolders] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Load this wallet's profile.
  useEffect(() => {
    if (!addr) { setProfile(null); return; }
    loadProfile(addr).then(setProfile).catch(() => {});
  }, [addr]);

  // Load messages + subscribe to live inserts.
  useEffect(() => {
    if (!supabaseEnabled) { setMessages([]); return; }
    let live = true;
    loadMessages().then((m) => { if (live) setMessages(m); }).catch(() => { if (live) setMessages([]); });
    const unsub = subscribeMessages((m) => {
      setMessages((prev) => {
        const base = prev ?? [];
        if (base.some((x) => x.id === m.id)) return base;
        return [...base, m].slice(-MSG_LIMIT);
      });
    });
    return () => { live = false; unsub(); };
  }, []);

  // Keep pinned to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, aiThinking]);

  // Fetch each chatter's MIDGARD balance (cached) so it can sit next to their name.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const wallets = messages.map((m) => m.wallet).filter((w) => w && w !== AI_WALLET && w !== "anon");
    if (wallets.length === 0) return;
    let live = true;
    fetchMidgardBalances(wallets).then((got) => {
      if (!live || got.size === 0) return;
      setBalances((prev) => { const next = new Map(prev); got.forEach((v, k) => next.set(k, v)); return next; });
    }).catch(() => {});
    return () => { live = false; };
  }, [messages]);

  const displayName = (profile?.username || "").trim() || (addr ? short(addr) : "guest");
  const avatar = profile?.avatar_url || "";
  const me = () => ({ wallet: addr, username: displayName, avatar_url: avatar });

  async function handleSend(forceAI = false) {
    setErr(null);
    const raw = text.trim();
    if (!raw) return;
    if (!addr) { w.connect(); return; }

    // Mini-game command?
    const game = !forceAI ? parseGameCommand(raw) : null;
    if (game) {
      setText("");
      try { await sendMessage({ ...me(), text: game.text, kind: "game", meta: game.meta }); }
      catch (e: any) { setErr(e?.message || "Failed to send"); }
      return;
    }

    // /help
    if (!forceAI && /^\/help\b/i.test(raw)) { setText(""); setErr(GAME_HELP); return; }

    // AI ask — via the ✨ button, or a line starting with @ai / @midgard.
    const aiPrefix = /^@(ai|midgard(\s*ai)?)\b[:,]?/i;
    const isAI = forceAI || aiPrefix.test(raw);
    if (isAI) {
      const question = raw.replace(aiPrefix, "").trim() || raw;
      setText("");
      setAiThinking(true);
      try {
        await sendMessage({ ...me(), text: raw, kind: "chat" });          // show the question
        const recent = (messages ?? []).slice(-8).map((m) => `${m.username}: ${m.text}`);
        const answer = await askMidgardAI(question, recent);
        await sendMessage({ wallet: AI_WALLET, username: "EL-Casino AI", avatar_url: "", text: answer, kind: "ai" });
      } catch (e: any) {
        setErr(e?.message || "EL-Casino AI is unavailable right now.");
      } finally { setAiThinking(false); }
      return;
    }

    // Normal chat.
    setText("");
    setBusy(true);
    try { await sendMessage({ ...me(), text: raw, kind: "chat" }); }
    catch (e: any) { setErr(e?.message || "Failed to send"); }
    finally { setBusy(false); }
  }

  if (!supabaseEnabled) {
    return (
      <div className="panel p-8 text-center text-bone-400">
        <MessageSquare size={28} className="mx-auto mb-2 opacity-60" />
        <div className="font-semibold text-bone-200">ELCAS Chat is being set up</div>
        <div className="text-xs font-mono text-bone-500 mt-1">The chat backend isn’t configured yet. Check back soon.</div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden flex flex-col h-[70vh] min-h-[440px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700/70 bg-ink-900/50">
        <span className="mg-logo-rings h-[52px] w-[52px] shrink-0"><img src="./elcasino_logo.png" alt="" className="rounded-full object-cover" draggable={false} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold tracking-tight leading-none">ELCAS Chat</div>
          <div className="text-[10px] font-mono text-bone-500 mt-0.5">Telegram-style · last {MSG_LIMIT} messages · mini-games + EL-Casino AI</div>
        </div>
        <button onClick={() => setShowHolders((s) => !s)} title="Top holders"
          className={`inline-flex items-center gap-1.5 text-xs font-mono rounded-full px-2.5 py-1.5 border transition ${showHolders ? "border-amber-500/50 text-amber-300 bg-amber-900/15" : "border-ink-600 text-bone-300 hover:text-bone-50 hover:border-amber-500/40"}`}>
          <Trophy size={13} /> <span className="hidden sm:inline">Holders</span>
        </button>
        {addr ? (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-mono text-bone-300 hover:text-bone-50 border border-ink-600 hover:border-blood-500/50 rounded-full px-3 py-1.5 transition">
            <Avatar url={avatar} name={displayName} size={18} /> <span className="max-w-[80px] truncate">{displayName}</span> <Pencil size={11} />
          </button>
        ) : (
          <button onClick={() => w.connect()} className="btn-primary py-1.5 px-3 text-xs">Connect</button>
        )}
      </div>

      {/* Top holders (toggle) */}
      {showHolders && (
        <div className="px-3 pt-3 border-b border-ink-700/70 bg-ink-900/40">
          <TopHoldersMini limit={5} />
          <div className="h-3" />
        </div>
      )}

      {/* Profile editor */}
      {editing && <ProfileEditor wallet={addr} initial={profile} locked={w.isSocial} social={w.profile?.social ?? null} onClose={() => setEditing(false)} onSaved={(p) => { setProfile(p); setEditing(false); }} />}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-ink-950/40">
        {messages === null ? (
          <div className="h-full grid place-items-center text-bone-500"><Loader2 className="animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-bone-500 text-sm px-6">
            <div>
              <Dice5 size={26} className="mx-auto mb-2 opacity-60" />
              No messages yet — say gm, roll a <span className="font-mono text-bone-300">/dice</span>, or tap ✨ to ask EL-Casino AI.
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} m={m} mine={m.wallet === addr} bal={balances.get(m.wallet)} />)
        )}
        {aiThinking && (
          <div className="flex items-center gap-2 text-emerald-300/90 text-xs font-mono pl-1">
            <Sparkles size={13} className="animate-pulse" /> EL-Casino AI is thinking…
          </div>
        )}
      </div>

      {/* Error / hint line */}
      {err && <div className="px-4 py-1.5 text-[11px] font-mono text-amber-200 bg-amber-900/20 border-t border-amber-500/30">{err}</div>}

      {/* Composer */}
      <div className="border-t border-ink-700/70 bg-ink-900/50 p-2.5">
        <div className="flex items-end gap-2">
          <button
            onClick={() => handleSend(true)}
            disabled={aiThinking || !text.trim()}
            title="Ask EL-Casino AI"
            className="shrink-0 h-10 px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 transition shadow-[0_0_0_1px_rgba(16,185,129,0.3)]">
            <Sparkles size={15} /> <span className="hidden sm:inline">Ask AI</span>
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(false); } }}
            rows={1}
            placeholder={addr ? "Message, /dice, or @ai <question>…" : "Connect your wallet to chat…"}
            className="flex-1 resize-none max-h-28 bg-ink-900/70 border border-ink-600 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blood-500 placeholder:text-bone-600" />
          <button onClick={() => handleSend(false)} disabled={busy || aiThinking || !text.trim()}
            className="shrink-0 h-10 w-10 rounded-xl grid place-items-center text-white bg-blood-600 hover:bg-blood-500 disabled:opacity-40 transition">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[10px] font-mono text-bone-600">
          {GAME_HELP}
        </div>
      </div>
    </div>
  );
}

// ── Message row ─────────────────────────────────────────────────────────────
function MessageRow({ m, mine, bal }: { m: ChatMessage; mine: boolean; bal?: number }) {
  if (m.kind === "ai") return <AiMessage m={m} />;
  const isGame = m.kind === "game";
  return (
    <div className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar url={m.avatar_url} name={m.username} size={32} />
      <div className={`min-w-0 max-w-[78%] ${mine ? "items-end text-right" : ""} flex flex-col`}>
        <div className={`flex items-center gap-1.5 text-[11px] font-mono text-bone-500 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="font-semibold text-bone-300 truncate max-w-[110px]">{m.username || short(m.wallet)}</span>
          {bal !== undefined && bal > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-px rounded bg-blood-900/30 text-blood-300 border border-blood-500/30 shrink-0" title={`${bal.toLocaleString()} ELCAS`}>
              {fmtBalCompact(bal)} ELCAS
            </span>
          )}
          <span className="opacity-70">{timeAgo(new Date(m.created_at).getTime() / 1000)}</span>
        </div>
        <div className={`mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-sm break-words ${
          isGame
            ? "bg-amber-900/25 border border-amber-500/30 text-amber-100 font-mono"
            : mine
              ? "bg-blood-600/30 border border-blood-500/30 text-bone-50"
              : "bg-ink-800/70 border border-ink-700/70 text-bone-100"}`}>
          {isGame ? <><Dice5 size={13} className="inline mb-0.5 mr-1 opacity-80" />{m.text}</> : m.text}
        </div>
      </div>
    </div>
  );
}

function AiMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="flex gap-2.5">
      <span className="h-8 w-8 rounded-full grid place-items-center text-white shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600"><Sparkles size={15} /></span>
      <div className="min-w-0 max-w-[82%]">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="font-semibold text-emerald-300">EL-Casino AI</span>
          <span className="text-[8px] uppercase tracking-wider text-emerald-400/70 border border-emerald-500/40 rounded px-1 py-0.5">AI</span>
          <span className="text-bone-500 opacity-70">{timeAgo(new Date(m.created_at).getTime() / 1000)}</span>
        </div>
        <div className="mt-0.5 inline-block rounded-2xl px-3 py-2 text-sm bg-emerald-900/20 border border-emerald-500/30 text-bone-100 whitespace-pre-wrap break-words">
          {m.text}
        </div>
      </div>
    </div>
  );
}

// ── Profile editor ──────────────────────────────────────────────────────────
function ProfileEditor({ wallet, initial, locked, social, onClose, onSaved }: {
  wallet: string; initial: Profile | null; locked?: boolean; social?: string | null; onClose: () => void; onSaved: (p: Profile) => void;
}) {
  const [username, setUsername] = useState(initial?.username || "");
  const [avatar, setAvatar] = useState(initial?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Social logins carry a verified name from Google/X — the display name is locked.
  const nameLocked = !!locked;
  const socialLabel = social === "x" ? "X" : social === "google" ? "Google" : social ? social[0].toUpperCase() + social.slice(1) : "your account";

  async function save() {
    setErr(null); setSaving(true);
    try {
      // Never let a locked (social) name be overwritten from the client.
      const finalName = nameLocked ? (initial?.username || username) : username;
      const p = await saveProfile({ wallet, username: finalName, avatar_url: avatar });
      if (p) onSaved(p);
    } catch (e: any) { setErr(e?.message || "Couldn’t save profile."); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-4 py-3 border-b border-ink-700/70 bg-ink-900/70 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-bone-400">Edit profile</span>
        <button onClick={onClose} className="text-bone-500 hover:text-bone-100"><X size={15} /></button>
      </div>
      <div className="flex items-center gap-3">
        <Avatar url={avatar} name={username || wallet} size={44} />
        <div className="flex-1 space-y-2">
          <div className="relative">
            <input value={username} onChange={(e) => setUsername(e.target.value.slice(0, 32))} placeholder="Display name"
              disabled={nameLocked} readOnly={nameLocked}
              className={`w-full bg-ink-900/70 border border-ink-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blood-500 ${nameLocked ? "opacity-70 cursor-not-allowed pr-20" : ""}`} />
            {nameLocked && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-blood-300 bg-blood-900/30 border border-blood-500/30 rounded px-1.5 py-0.5">
                {socialLabel}
              </span>
            )}
          </div>
          <div className="relative">
            <Link2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bone-500" />
            <input value={avatar} onChange={(e) => setAvatar(e.target.value.slice(0, 400))} placeholder="Avatar image URL (https://…)"
              className="w-full bg-ink-900/70 border border-ink-600 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-blood-500 font-mono" />
          </div>
        </div>
      </div>
      {err && <div className="text-[11px] font-mono text-amber-200">{err}</div>}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-bone-600">
          {nameLocked ? <>Name locked to {socialLabel}. Identity: {short(wallet)}</> : <>Paste an image URL — no upload. Identity: {short(wallet)}</>}
        </span>
        <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-4 text-xs inline-flex items-center gap-1.5">
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ── Avatar with URL + initials fallback ─────────────────────────────────────
function hueFromStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function Avatar({ url, name, size = 36 }: { url?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)}
      style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 ring-1 ring-ink-600 bg-ink-800" />;
  }
  const initials = (name || "?").replace(/^0x/i, "").slice(0, 2).toUpperCase();
  return (
    <span style={{ width: size, height: size, background: `hsl(${hueFromStr(name || "x")} 45% 32%)`, fontSize: size * 0.36 }}
      className="rounded-full grid place-items-center font-bold text-white shrink-0 ring-1 ring-ink-600">{initials}</span>
  );
}
