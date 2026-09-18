import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { CHAIN, ADDR } from "../lib/chain";
import { Wordmark } from "./Logo";
import { CopyButton } from "./CopyButton";
import { short } from "../lib/util";
import { SOCIALS, TelegramIcon, XIcon } from "../lib/socials";

/** Global footer — protocol identity, contract, chain, and quick links. */
export function Footer() {
  return (
    <footer className="mt-10 border-t border-ink-700/70 pt-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="mg-logo-rings h-8 w-8">
              <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
              <img src="./elcasino_logo.png" alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-600" />
            </span>
            <div className="leading-none">
              <Wordmark className="text-xl" />
            </div>
          </div>
          <p className="text-[11px] text-bone-500 font-mono mt-2 max-w-xs leading-relaxed">
            On-chain casino on {CHAIN.name}. Provably-fair games and the ELCAS economy — no servers, no custodians.
          </p>
          {/* Social / community */}
          <div className="flex items-center gap-2 mt-3">
            <SocialButton href={SOCIALS.telegram} label="Telegram"><TelegramIcon size={16} /></SocialButton>
            <SocialButton href={SOCIALS.x} label="X (Twitter)"><XIcon size={14} /></SocialButton>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1.5 text-sm">
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-600 mb-1">Protocol</div>
            <FLink to="/casino" label="Casino" />
            <FLink to="/token" label="Trade" />
            <FLink to="/flywheel" label="Flywheel" />
            <FLink to="/wallet" label="Wallet" />
            <FLink to="/audit" label="Audit" />
          </div>
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-600 mb-1">Community</div>
            <a href={SOCIALS.telegram} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-bone-400 hover:text-blood-400 transition">Telegram <ExternalLink size={11} /></a>
            <a href={SOCIALS.x} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-bone-400 hover:text-blood-400 transition">X / Twitter <ExternalLink size={11} /></a>
            <FLink to="/faq" label="FAQ" />
          </div>
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-600 mb-1">Legal</div>
            <FLink to="/legal/terms" label="Terms of Service" />
            <FLink to="/legal/privacy" label="Privacy Policy" />
            <FLink to="/legal/responsible" label="Responsible Gaming" />
            <FLink to="/legal/disclaimer" label="Risk Disclaimer" />
          </div>
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-600 mb-1">On-chain</div>
            <a href={`${CHAIN.explorer}/token/${ADDR.token}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-bone-400 hover:text-blood-400 transition">Token <ExternalLink size={11} /></a>
            <a href={`${CHAIN.explorer}/address/${ADDR.router}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-bone-400 hover:text-blood-400 transition">Router <ExternalLink size={11} /></a>
            <a href={CHAIN.explorer} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-bone-400 hover:text-blood-400 transition">Explorer <ExternalLink size={11} /></a>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-ink-800/70 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-bone-600">
        <span className="inline-flex items-center gap-1.5">
          ELCAS <span className="text-bone-500">{short(ADDR.token)}</span>
          <CopyButton value={ADDR.token} title="Copy token address" />
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-blood-500/40 text-blood-300 px-1.5 py-0.5">18+</span>
          Play responsibly · {CHAIN.name}
        </span>
        <span>© {new Date().getFullYear()} EL-Casino</span>
      </div>
    </footer>
  );
}

function SocialButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={label} aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 bg-ink-850 text-bone-300 hover:text-emerald-300 hover:border-emerald-500/50 transition">
      {children}
    </a>
  );
}

function FLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="block text-bone-400 hover:text-blood-400 transition">{label}</Link>;
}
