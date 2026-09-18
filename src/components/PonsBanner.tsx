import { Rocket, ExternalLink } from "lucide-react";
import { useAppConfig, creatorFeePct } from "../lib/appConfig";

/**
 * ELCAS-on-Pons launch banner. ELCAS is a flat platform token launched on Pons —
 * fees are buyback & burn (no decay). All details (launchpad link, logo, creator
 * fee, token address) come from the admin launch config, so once the owner fills
 * them in the banner goes live everywhere with no redeploy.
 *
 * `compact` renders a slimmer variant for dense pages (e.g. the trade rail).
 */
export function PonsBanner({ compact = false }: { compact?: boolean }) {
  const { config } = useAppConfig();
  const live = /^0x[a-fA-F0-9]{40}$/.test(config.elcasToken);
  const hasLink = !!config.ponsLaunchpadUrl;
  const feePct = creatorFeePct(config);
  const feeStr = feePct % 1 ? feePct.toFixed(1) : feePct.toFixed(0);

  return (
    <div className={`panel relative overflow-hidden border-emerald-500/30 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className={`relative flex gap-3 ${compact ? "flex-col" : "flex-col sm:flex-row sm:items-center gap-4"}`}>
        <div className="flex items-center gap-3 min-w-0">
          {config.ponsLogoUrl
            ? <img src={config.ponsLogoUrl} alt="Pons" className={`rounded-xl object-cover ring-1 ring-ink-600 shrink-0 ${compact ? "h-9 w-9" : "h-11 w-11"}`} />
            : <span className={`rounded-xl grid place-items-center bg-emerald-500/15 ring-1 ring-emerald-500/40 shrink-0 ${compact ? "h-9 w-9" : "h-11 w-11"}`}><Rocket size={compact ? 16 : 20} className="text-emerald-300" /></span>}
          <div className="min-w-0">
            <div className="font-bold tracking-tight leading-tight">ELCAS {live ? "is live on Pons" : "launches on Pons"}</div>
            <div className={`text-bone-400 ${compact ? "text-[11px]" : "text-[13px]"}`}>
              Flat platform token — <span className="text-emerald-300 font-semibold">buyback &amp; burn</span>, no decay. Creator fee {feeStr}%.
            </div>
          </div>
        </div>
        <div className={compact ? "" : "sm:ml-auto shrink-0"}>
          {hasLink
            ? <a href={config.ponsLaunchpadUrl} target="_blank" rel="noreferrer" className={`btn-primary inline-flex items-center gap-2 ${compact ? "w-full justify-center py-2 text-sm" : "px-5 py-2.5"}`}><Rocket size={16} /> {live ? "View on Pons" : "Go to Pons launch"} <ExternalLink size={13} /></a>
            : <span className={`inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-900/60 font-mono text-bone-400 ${compact ? "w-full justify-center px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`}><Rocket size={15} /> Pons link coming soon</span>}
        </div>
      </div>
    </div>
  );
}
