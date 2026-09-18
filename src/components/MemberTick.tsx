/**
 * Small runic mark shown next to a name when the wallet holds enough MIDGARD
 * to be a platform member (per the current registry gate). Bronze/blood so
 * it reads on the dark theme; hidden when the gate is off or the wallet is
 * below the threshold.
 */
export function MemberTick({ ok, size = 13 }: { ok?: boolean | null; size?: number }) {
  if (!ok) return null;
  return (
    <span title="Holds ELCAS" aria-label="member"
      className="inline-flex items-center shrink-0 text-blood-500">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* runic star-of-Midgard: 4-point compass rose */}
        <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" fillOpacity="0.25" />
      </svg>
    </span>
  );
}
