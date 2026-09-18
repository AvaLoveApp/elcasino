import { TierDef } from "../lib/holderTier";

/**
 * Bespoke Midgard sigils — one per tier. Symbols are Norse-inspired but drawn
 * for the app; each is a compact SVG on a dark disc with a tier-tinted ring
 * so it reads at 16px next to a display name. Tooltip carries the tier name.
 */
function AesirSigil() {
  // Valknut — three interlocking triangles, Odin's sigil.
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <polygon points="12,3 4,17 20,17" />
      <polygon points="6,7 20,7 13,20" />
      <polygon points="18,7 4,7 11,20" />
    </svg>
  );
}

function EinherjarSigil() {
  // Crossed war-axes above a shield line.
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
      <path d="M4 6 Q6 3 8 6 L6 8 Z" fill="currentColor" stroke="none" />
      <path d="M20 6 Q18 3 16 6 L18 8 Z" fill="currentColor" stroke="none" />
      <path d="M4 18 Q6 21 8 18 L6 16 Z" fill="currentColor" stroke="none" />
      <path d="M20 18 Q18 21 16 18 L18 16 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function JarlSigil() {
  // Simplified Norse crown — bold arch with three sharp peaks.
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M3 18 L4 8 L9 13 L12 5 L15 13 L20 8 L21 18 Z" />
      <rect x="3" y="18" width="18" height="2" rx="0.5" />
    </svg>
  );
}

function BerserkerSigil() {
  // Bear paw — heel pad + four toes.
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" stroke="none">
      <ellipse cx="12" cy="16" rx="6" ry="5" />
      <ellipse cx="6"  cy="9" rx="2" ry="2.5" />
      <ellipse cx="10" cy="6" rx="2" ry="2.5" />
      <ellipse cx="14" cy="6" rx="2" ry="2.5" />
      <ellipse cx="18" cy="9" rx="2" ry="2.5" />
    </svg>
  );
}

function ThaneSigil() {
  // Tiwaz rune — Tyr's spear, upward arrow.
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="12" y1="4" x2="6" y2="10" />
      <line x1="12" y1="4" x2="18" y2="10" />
    </svg>
  );
}

const SIGILS: Record<string, () => JSX.Element> = {
  aesir: AesirSigil,
  einherjar: EinherjarSigil,
  jarl: JarlSigil,
  berserker: BerserkerSigil,
  thane: ThaneSigil,
};

export function TierBadge({ tier, size = "sm" }: { tier?: TierDef | null; size?: "sm" | "md" | "lg" }) {
  if (!tier || tier.key === "none") return null;
  const Sigil = SIGILS[tier.key];
  if (!Sigil) return null;

  const d = size === "lg" ? 28 : size === "md" ? 22 : 18;
  const iconD = Math.round(d * 0.62);

  return (
    <span
      title={tier.label}
      aria-label={tier.label}
      className={`relative inline-flex items-center justify-center rounded-full border ${tier.bg} ${tier.border} ${tier.ring}`}
      style={{ width: d, height: d, boxShadow: "inset 0 1px 1px rgba(255,255,255,0.16), inset 0 0 7px rgba(0,0,0,0.55), 0 0 8px -1px currentColor" }}
    >
      {/* glossy top highlight */}
      <span className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.24), transparent 62%)" }} />
      <span className={tier.ring}
        style={{ width: iconD, height: iconD, display: "inline-flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 0 2.5px currentColor)" }}>
        <Sigil />
      </span>
    </span>
  );
}
