import { useEffect } from "react";
import { X, Wallet, Mail, ChevronRight, ShieldCheck, Zap } from "lucide-react";
import { useInjectedWallets } from "../lib/wallets6963";

/**
 * Branded connect surface — a compact, LANDSCAPE (rectangular) modal in Midgard's
 * yellow-green neon. It's the single entry point for every "connect" in the app:
 * social logins (Google / X / email) delegate to Reown AppKit, while the browser
 * wallet connects directly. Reown's own modal is themed to the same neon, so the
 * two feel like one flow.
 */
export function ConnectModal({
  open, connecting, onClose, onInjected, onWallet, onSocial,
}: {
  open: boolean;
  connecting: boolean;
  onClose: () => void;
  onInjected: () => void | Promise<void>;
  onWallet?: (provider: any) => void | Promise<void>;
  onSocial: () => void | Promise<void>;
}) {
  const wallets = useInjectedWallets();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-ink-950/80 backdrop-blur-md" />

      {/* Landscape card */}
      <div
        role="dialog" aria-modal="true" aria-label="Connect to EL-Casino"
        className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-blood-500/30
                   bg-ink-900/95 shadow-[0_0_0_1px_rgba(147,224,20,0.15),0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(147,224,20,0.35)]
                   animate-fade-up grid md:grid-cols-[minmax(0,240px)_1fr]">
        {/* Neon top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blood-400 to-transparent" />

        <button onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-bone-400 hover:text-blood-400 hover:bg-ink-800 transition">
          <X size={17} />
        </button>

        {/* LEFT — brand rail */}
        <div className="relative hidden md:flex flex-col justify-between p-6 bg-gradient-to-b from-blood-900/25 via-ink-900 to-ink-900 border-r border-ink-700/70">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-blood-500/15 blur-3xl" />
          <div className="relative">
            <span className="mg-logo-rings h-16 w-16 inline-block">
              <img src="./elcasino_logo.png" alt="" className="rounded-full object-cover" draggable={false} />
            </span>
            <h2 className="mt-4 text-2xl font-bold leading-tight text-bone-50">
              Enter <span className="mg-neon">EL-Casino</span>
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-bone-400">
              One login for the ELCAS economy and the on-chain casino.
            </p>
          </div>
          <ul className="relative mt-6 space-y-2 text-[11px] font-mono text-bone-400">
            <li className="flex items-center gap-2"><Zap size={13} className="text-blood-400" /> Instant, non-custodial</li>
            <li className="flex items-center gap-2"><ShieldCheck size={13} className="text-blood-400" /> Your keys, your funds</li>
          </ul>
        </div>

        {/* RIGHT — options */}
        <div className="p-5 sm:p-6">
          {/* Mobile brand header */}
          <div className="mb-4 flex items-center gap-3 md:hidden">
            <span className="mg-logo-rings h-11 w-11 inline-block">
              <img src="./elcasino_logo.png" alt="" className="rounded-full object-cover" draggable={false} />
            </span>
            <div>
              <div className="text-lg font-bold leading-none">Enter <span className="mg-neon">EL-Casino</span></div>
              <div className="text-[11px] text-bone-500 mt-1">Pick how you'd like to sign in</div>
            </div>
          </div>

          <div className="hidden md:block text-[10px] font-mono uppercase tracking-[0.25em] text-bone-500 mb-3">
            Sign in
          </div>

          {/* Social row — compact, side by side */}
          <div className="grid grid-cols-3 gap-2">
            <SocialTile label="Google" onClick={onSocial} disabled={connecting}>
              <GoogleIcon />
            </SocialTile>
            <SocialTile label="X" onClick={onSocial} disabled={connecting}>
              <XIcon />
            </SocialTile>
            <SocialTile label="Email" onClick={onSocial} disabled={connecting}>
              <Mail size={20} className="text-bone-100" />
            </SocialTile>
          </div>

          <div className="my-4 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-bone-600">
            <span className="h-px flex-1 bg-ink-700" /> or <span className="h-px flex-1 bg-ink-700" />
          </div>

          {/* Detected wallets — each with its REAL name + logo (EIP-6963). */}
          {wallets.length > 0 ? (
            <div className="space-y-2">
              {wallets.map((wal) => (
                <button
                  key={wal.uuid} onClick={() => onWallet?.(wal.provider)} disabled={connecting}
                  className="group flex w-full items-center gap-3 rounded-xl border border-ink-600 bg-ink-850 px-4 py-3
                             text-left transition hover:border-blood-500/60 hover:bg-ink-800 disabled:opacity-60">
                  <img src={wal.icon} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain bg-ink-900 p-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-bone-50">{wal.name}</span>
                    <span className="block text-[11px] text-bone-400">Detected · click to connect</span>
                  </span>
                  <ChevronRight size={16} className="text-bone-500 transition group-hover:translate-x-0.5 group-hover:text-blood-400" />
                </button>
              ))}
            </div>
          ) : (
            /* No injected wallet detected — generic action. */
            <button
              onClick={onInjected} disabled={connecting}
              className="group flex w-full items-center gap-3 rounded-xl border border-blood-500/40 bg-blood-500/10 px-4 py-3
                         text-left transition hover:bg-blood-500/20 hover:border-blood-400/70 disabled:opacity-60">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blood-500/20 text-blood-300">
                <Wallet size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-bone-50">Browser wallet</span>
                <span className="block text-[11px] text-bone-400">MetaMask, Rabby, or any injected wallet</span>
              </span>
              <ChevronRight size={16} className="text-bone-500 transition group-hover:translate-x-0.5 group-hover:text-blood-400" />
            </button>
          )}

          {/* WalletConnect / more */}
          <button
            onClick={onSocial} disabled={connecting}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-ink-600 bg-ink-850 px-4 py-2.5
                       text-left transition hover:border-blood-500/50 disabled:opacity-60">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-bone-300">
              <WalletConnectIcon />
            </span>
            <span className="min-w-0 flex-1 text-sm text-bone-200">WalletConnect &amp; more</span>
            <ChevronRight size={15} className="text-bone-500" />
          </button>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-bone-600">
            {connecting ? "Opening secure login…" : "Social logins create a self-custodial wallet — no seed phrase to manage."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SocialTile({ label, onClick, disabled, children }: {
  label: string; onClick: () => void | Promise<void>; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={`Continue with ${label}`}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850 py-3
                 transition hover:border-blood-500/60 hover:bg-ink-800 hover:shadow-[0_0_18px_-6px_rgba(147,224,20,0.6)]
                 disabled:opacity-60">
      <span className="grid h-7 w-7 place-items-center">{children}</span>
      <span className="text-[11px] font-medium text-bone-200">{label}</span>
    </button>
  );
}

// ── Brand glyphs (inline so nothing loads over the network) ──────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.7 2.5-7.6 2.5-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.8 35.9 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-bone-50" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function WalletConnectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden>
      <path fill="#B4FF2E" d="M11.6 15.4c4.6-4.5 12.1-4.5 16.8 0l.5.6c.2.2.2.6 0 .8l-1.9 1.9c-.1.1-.3.1-.4 0l-.8-.8c-3.2-3.1-8.4-3.1-11.6 0l-.9.8c-.1.1-.3.1-.4 0l-1.9-1.9c-.2-.2-.2-.6 0-.8zm20.7 3.9l1.7 1.7c.2.2.2.6 0 .8l-7.7 7.5c-.2.2-.6.2-.8 0l-5.4-5.3c-.1-.1-.2-.1-.3 0l-5.4 5.3c-.2.2-.6.2-.8 0l-7.6-7.5c-.2-.2-.2-.6 0-.8l1.7-1.7c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.3 0l5.4-5.3c.2-.2.6-.2.8 0l5.4 5.3c.1.1.2.1.3 0l5.4-5.3c.4-.2.8-.2 1 0z" />
    </svg>
  );
}
