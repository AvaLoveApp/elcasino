import { useEffect, useState } from "react";
import { Bell, Download, X, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { pushSupported, pushConfigured, pushPermission, enablePush, isPushEnabled } from "../lib/push";

/**
 * Two dismissible nudges docked bottom-center:
 *  • "Install Midgard" — when the browser fires `beforeinstallprompt` (PWA not installed).
 *  • "Enable notifications" — when connected, push is supported and permission is
 *    still undecided and not yet subscribed.
 * Each remembers dismissal in localStorage so it isn't naggy.
 */
export function AppPrompts() {
  const w = useWallet();
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showPush, setShowPush] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBip = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
      const dismissed = safeGet("mg.install.dismiss");
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone;
      if (!dismissed && !standalone) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (!w.address || !pushSupported() || !pushConfigured) { setShowPush(false); return; }
    if (safeGet("mg.push.dismiss")) return;
    if (pushPermission() !== "default") { setShowPush(false); return; }
    let live = true;
    isPushEnabled().then((on) => { if (live) setShowPush(!on); }).catch(() => {});
    return () => { live = false; };
  }, [w.address]);

  async function enable() {
    setBusy(true);
    try { const ok = await enablePush(w.address!); if (ok) setShowPush(false); }
    finally { setBusy(false); }
  }
  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch {}
    setInstallEvt(null); setShowInstall(false);
  }

  if (!showInstall && !showPush) return null;
  return (
    <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[84px] lg:bottom-4 w-[92%] max-w-sm space-y-2">
      {showPush && (
        <Card icon={<Bell size={18} />} title="Enable notifications"
          body="Get pinged for likes, replies, follows, tips & new launches — even when the app is closed."
          cta={busy ? "…" : "Enable"} onCta={enable} disabled={busy}
          onClose={() => { safeSet("mg.push.dismiss", "1"); setShowPush(false); }} />
      )}
      {showInstall && (
        <Card icon={<Download size={18} />} title="Install EL-Casino"
          body="Add EL-Casino to your home screen — full-screen app + push notifications."
          cta="Install" onCta={install}
          onClose={() => { safeSet("mg.install.dismiss", "1"); setShowInstall(false); }} />
      )}
    </div>
  );
}

function Card({ icon, title, body, cta, onCta, onClose, disabled }: {
  icon: React.ReactNode; title: string; body: string; cta: string; onCta: () => void; onClose: () => void; disabled?: boolean;
}) {
  return (
    <div className="relative rounded-2xl border border-blood-500/40 bg-ink-900/95 p-3.5 pr-9 shadow-[0_0_0_1px_rgba(147,224,20,0.12),0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur animate-fade-up">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blood-400 to-transparent" />
      <button onClick={onClose} aria-label="Dismiss" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-bone-500 hover:text-blood-400 hover:bg-ink-800"><X size={14} /></button>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blood-500/20 text-blood-300">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-bone-50">{title}</div>
          <p className="text-[11px] text-bone-400 leading-relaxed mt-0.5">{body}</p>
          <button onClick={onCta} disabled={disabled} className="btn-primary mt-2 py-1.5 px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            {disabled && <Loader2 size={13} className="animate-spin" />}{cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function safeGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }
