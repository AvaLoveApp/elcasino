import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Contract } from "ethers";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readProvider } from "../lib/chain";
import { useProfiles } from "../lib/profileCache";
import { Avatar } from "../components/Avatar";
import { short, timeAgo } from "../lib/util";

// On-chain per-room chat — every V3 game exposes the same surface.
const CHAT_ABI = [
  "function getRecentMessages(uint256 count) view returns (tuple(address sender, string username, string message, uint256 timestamp)[])",
  "function sendMessage(string message, string username)",
];

type Msg = { sender: string; username: string; message: string; ts: number };

export function RoomChat({ address }: { address: string }) {
  const w = useWallet();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const c = new Contract(address, CHAT_ABI, readProvider);
      const rows = await c.getRecentMessages(60);
      const out: Msg[] = (rows as any[]).map((r) => ({
        sender: (r.sender ?? r[0]) as string, username: (r.username ?? r[1]) as string,
        message: (r.message ?? r[2]) as string, ts: Number(r.timestamp ?? r[3]),
      }));
      setMsgs(out);
    } catch { setMsgs([]); }
  }, [address]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const senders = useMemo(() => Array.from(new Set((msgs ?? []).map((m) => m.sender.toLowerCase()))), [msgs]);
  const profs = useProfiles(senders);
  const myProf = useProfiles(w.address ? [w.address] : []);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer) return;
    setSending(true);
    try {
      const uname = myProf[w.address.toLowerCase()]?.username || short(w.address);
      const c = new Contract(address, CHAT_ABI, w.signer);
      await (await c.sendMessage(body, uname)).wait();
      setText("");
      load();
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Send failed."); }
    finally { setSending(false); }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[60vh] panel p-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-ink-700/60 bg-black/30 flex items-center gap-2 font-mono text-xs text-bone-400">
        <MessageSquare size={13} className="text-cyan-400" /> Room chat · on-chain
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {msgs === null && <div className="text-center text-bone-500 text-sm py-8"><Loader2 className="animate-spin mx-auto" /></div>}
        {msgs && msgs.length === 0 && <div className="text-center text-bone-600 text-sm py-8 font-mono">no messages yet — say hi 👋</div>}
        {msgs?.map((m, i) => {
          const p = profs[m.sender.toLowerCase()];
          const name = p?.exists ? (p.displayName || p.username) : (m.username || short(m.sender));
          const mine = w.address && m.sender.toLowerCase() === w.address.toLowerCase();
          return (
            <div key={i} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar uri={p?.avatarURI} name={name} size={28} ring={false} />
              <div className={`min-w-0 max-w-[78%] ${mine ? "items-end text-right" : ""} flex flex-col`}>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-bone-500">
                  <span className={mine ? "text-blood-300" : "text-bone-300"}>{name}</span>
                  <span>· {timeAgo(m.ts)}</span>
                </div>
                <div className={`mt-0.5 px-2.5 py-1.5 rounded-xl text-sm break-words ${mine ? "bg-blood-900/30 border border-blood-500/30" : "bg-ink-800/70 border border-ink-700"}`}>{m.message}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-ink-700/60 p-2.5">
        {err && <div className="text-blood-300 text-[11px] mb-1.5">{err}</div>}
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={w.address ? "Message…" : "Connect wallet to chat"} maxLength={280}
            className="flex-1 min-w-0 bg-ink-900/70 border border-ink-600 rounded-full px-4 py-2 text-sm outline-none focus:border-cyan-500/50" />
          <button onClick={send} disabled={sending || !text.trim()}
            className="shrink-0 h-9 w-9 rounded-full bg-cyan-600 text-white grid place-items-center hover:bg-cyan-500 disabled:opacity-40">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <div className="text-[9px] font-mono text-bone-600 mt-1 text-center">messages are stored on-chain in the game contract</div>
      </div>
    </div>
  );
}
