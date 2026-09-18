import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { CHAIN, ADDR } from "../lib/chain";
import { Wordmark } from "./Logo";
import { CopyButton } from "./CopyButton";
import { short } from "../lib/util";

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
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm">
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bone-600 mb-1">Protocol</div>
            <FLink to="/token" label="ELCAS" />
            <FLink to="/analytics" label="Analytics" />
            <FLink to="/casino" label="Casino" />
            <FLink to="/wallet" label="Wallet" />
            <FLink to="/audit" label="Audit" />
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-bone-600">
        <span className="inline-flex items-center gap-1.5">
          ELCAS <span className="text-bone-500">{short(ADDR.token)}</span>
          <CopyButton value={ADDR.token} title="Copy token address" />
        </span>
        <span>{CHAIN.name} · chain {CHAIN.id}</span>
      </div>
    </footer>
  );
}

function FLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="block text-bone-400 hover:text-blood-400 transition">{label}</Link>;
}
