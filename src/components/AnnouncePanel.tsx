import { useState } from "react";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { sendBroadcast } from "../lib/social";

/**
 * Admin → send a platform-wide announcement (with an optional image) to EVERYONE.
 * Inserts a `broadcasts` row → pg trigger → push-broadcast edge fn → web push to
 * all subscribers, and it shows up in everyone's Notifications feed.
 */
export function AnnouncePanel() {
  const w = useWallet();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!title.trim() && !body.trim()) { setErr("Enter a title or message."); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      await sendBroadcast({ sender: w.address || "", title: title.trim(), body: body.trim(), image: image.trim(), kind: "admin" });
      setOk("Announcement sent to everyone ✓");
      setTitle(""); setBody(""); setImage("");
    } catch (e: any) { setErr(e?.message || "Failed to send."); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2 text-blood-400">
        <Megaphone size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Broadcast announcement</span>
      </div>
      <p className="text-sm text-bone-400 mb-3">
        Push a message to <b className="text-bone-200">every subscriber</b> (browser/PWA push) — it also lands in everyone's Notifications.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Title (e.g. New feature live 🎉)"
        className="field w-full mb-2" />
      <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} rows={2} placeholder="Message…"
        className="field w-full resize-none mb-2" />
      <input value={image} onChange={(e) => setImage(e.target.value.trim())} placeholder="Image URL (optional, shown in the push)"
        className="field w-full font-mono text-xs mb-3" />

      {/* Preview */}
      <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-3 mb-3">
        <div className="font-mono text-[9px] uppercase tracking-wider text-bone-600 mb-1.5">Preview</div>
        <div className="flex items-start gap-2.5">
          <img src={image || "./elcasino_logo.png"} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-ink-600"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "./elcasino_logo.png"; }} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-bone-50">{title || "EL-Casino"}</div>
            <div className="text-[11px] text-bone-400">{body || "your message…"}</div>
          </div>
        </div>
      </div>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-2">{ok}</div>}
      <button onClick={send} disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send to everyone
      </button>
    </div>
  );
}
