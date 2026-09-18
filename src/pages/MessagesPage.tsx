import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MessageSquare, ArrowLeft, Send } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { messagesAddress, readMessages, toMessage, readProfile, toProfile, Message } from "../lib/chain";
import { useProfiles } from "../lib/profileCache";
import { Avatar } from "../components/Avatar";
import { Rich } from "../lib/emoji";
import { short, timeAgo } from "../lib/util";

type Peer = { addr: string; lastAt: number };

/**
 * On-chain DMs: inbox (peers list) + thread view. Text is public on chain (any
 * viewer of the contract can read it) — this is the honest trade-off for
 * "everything on-chain" over a private-but-off-chain backend.
 */
export default function MessagesPage() {
  const params = useParams();
  const w = useWallet();
  const nav = useNavigate();
  const peerAddr = params.peer as string | undefined;
  const [modAddr, setModAddr] = useState<string | null | undefined>(undefined);
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesAddress().then(setModAddr); }, []);

  // Inbox — peers list.
  const loadInbox = useCallback(async () => {
    if (!modAddr || !w.address) return;
    try {
      const c = readMessages(modAddr);
      const [addrs, lastAts] = await c.getPeersPaged(w.address, 0, 100);
      const rows: Peer[] = addrs.map((a: string, i: number) => ({ addr: a, lastAt: Number(lastAts[i]) }));
      rows.sort((a, b) => b.lastAt - a.lastAt);
      setPeers(rows);
    } catch { /* ignore */ }
  }, [modAddr, w.address]);

  // Thread — one conversation.
  const loadThread = useCallback(async () => {
    if (!modAddr || !w.address || !peerAddr) return;
    try {
      const c = readMessages(modAddr);
      const n = Number(await c.threadLength(w.address, peerAddr));
      const from = Math.max(0, n - 50);
      const raws = await c.getThread(w.address, peerAddr, from, 50);
      setThread(raws.map((r: any) => toMessage(r)));
      // mark read
      try { const wc = w.messagesWrite(modAddr); if (wc) await wc.markRead(peerAddr); } catch {}
      requestAnimationFrame(() => scrollAnchor.current?.scrollIntoView({ block: "end", behavior: "auto" }));
    } catch { /* ignore */ }
  }, [modAddr, w.address, peerAddr, w]);

  useEffect(() => { loadInbox(); const h = setInterval(loadInbox, 15_000); return () => clearInterval(h); }, [loadInbox]);
  useEffect(() => {
    if (!peerAddr) return;
    loadThread();
    const h = setInterval(loadThread, 10_000);
    return () => clearInterval(h);
  }, [peerAddr, loadThread]);

  const peerAddrs = (peers ?? []).map((p) => p.addr);
  const profiles = useProfiles(peerAddr ? [peerAddr, ...peerAddrs] : peerAddrs);

  // Fallback: resolve peer profile if it's not among our conversation list yet.
  useEffect(() => {
    if (!peerAddr) return;
    readProfile().getProfile(peerAddr).then(toProfile).catch(() => {});
  }, [peerAddr]);

  async function send() {
    setErr(null);
    if (!draft.trim() || !modAddr || !peerAddr || !w.address) return;
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.messagesWrite(modAddr); if (!c) return;
    setBusy(true);
    try {
      const tx = await c.sendMessage(peerAddr, draft.trim());
      await tx.wait();
      setDraft("");
      loadThread(); loadInbox();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Send failed.");
    } finally { setBusy(false); }
  }

  if (!w.address) {
    return (
      <div className="text-center py-24 animate-fade-up">
        <MessageSquare size={40} className="mx-auto text-bone-600" />
        <h1 className="text-2xl font-bold tracking-tight mt-4">Messages</h1>
        <p className="text-bone-400 text-sm mt-1 max-w-sm mx-auto">Connect your wallet to open your on-chain DMs.</p>
        <button onClick={w.connect} className="btn-primary mt-6">Connect wallet</button>
      </div>
    );
  }
  if (modAddr === undefined) return <div className="text-center text-bone-400 py-24">Loading…</div>;
  if (modAddr === null) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight mb-5">Messages</h1>
        <div className="panel text-center py-16 px-6">
          <div className="text-3xl mb-3">✉️</div>
          <div className="font-semibold text-lg">DM module not deployed yet</div>
          <p className="text-bone-400 text-sm mt-1">Once the messages contract is registered, this page lights up automatically.</p>
        </div>
      </div>
    );
  }

  // Thread view.
  if (peerAddr) {
    const p = profiles[peerAddr.toLowerCase()];
    const peerName = p?.displayName || p?.username || short(peerAddr);
    const peerHandle = p?.username;
    return (
      <div className="animate-fade-up -mx-4 sm:-mx-6 flex flex-col min-h-[70vh]">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-3 border-b border-ink-700/70 backdrop-blur bg-ink-900/60 sticky top-0 z-10">
          <button onClick={() => nav("/messages")} className="p-2 -ml-2 rounded-full hover:bg-ink-800 text-bone-200"><ArrowLeft size={18} /></button>
          <Avatar uri={p?.avatarURI} name={peerName} size={36} ring={false} />
          <div className="min-w-0">
            <div className="font-bold truncate">{peerName}</div>
            {peerHandle && <div className="font-mono text-xs text-blood-400 truncate">@{peerHandle}</div>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-2">
          {thread.length === 0 && (
            <div className="text-center text-bone-500 text-sm py-8">Say something. On-chain, forever.</div>
          )}
          {thread.map((m, i) => {
            const mine = m.from.toLowerCase() === w.address!.toLowerCase();
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] leading-snug ${mine ? "bg-blood-600 text-bone-50 rounded-br-md" : "bg-ink-800 text-bone-100 rounded-bl-md"}`}>
                  <Rich text={m.text} className="whitespace-pre-wrap break-words" />
                  <div className={`font-mono text-[10px] mt-1 ${mine ? "text-bone-50/70" : "text-bone-500"}`}>{timeAgo(m.ts)}</div>
                </div>
              </div>
            );
          })}
          <div ref={scrollAnchor} />
        </div>

        <div className="border-t border-ink-700/70 px-3 sm:px-4 py-3">
          {err && <div className="text-blood-200 text-xs bg-blood-900/20 border border-blood-500/40 rounded-lg px-2.5 py-1.5 mb-2">{err}</div>}
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Type a rune…"
              className="field flex-1" />
            <button onClick={send} disabled={busy || !draft.trim()} className="btn-primary py-2 px-3">
              <Send size={16} />
            </button>
          </div>
          <div className="text-[10px] font-mono text-bone-600 mt-1.5">on-chain · everyone with the contract can read</div>
        </div>
      </div>
    );
  }

  // Inbox view.
  return (
    <div className="animate-fade-up -mx-4 sm:-mx-6">
      <div className="px-4 sm:px-6 pb-3 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <span className="font-mono text-[11px] text-bone-500">on-chain · public</span>
      </div>
      <div className="panel !rounded-none !border-x-0 !border-t-0">
        {peers === null && <div className="text-center text-bone-400 text-sm py-8">Loading…</div>}
        {peers && peers.length === 0 && (
          <div className="text-center py-16 px-6 text-bone-400">
            <div className="text-3xl mb-2">✉️</div>
            No conversations yet. Open a profile and tap the message icon to start.
          </div>
        )}
        {peers?.map((p) => {
          const prof = profiles[p.addr.toLowerCase()];
          const name = prof?.displayName || prof?.username || short(p.addr);
          return (
            <Link key={p.addr} to={`/messages/${p.addr}`}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-ink-700/60 hover:bg-ink-850/40 transition">
              <Avatar uri={prof?.avatarURI} name={name} size={44} ring={false} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{name}</div>
                {prof?.username && <div className="font-mono text-xs text-blood-400 truncate">@{prof.username}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[11px] text-bone-500">{p.lastAt ? timeAgo(p.lastAt) : ""}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
