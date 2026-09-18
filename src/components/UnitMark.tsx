/**
 * Tiny inline coin marks for currency units — an ETH glyph and the MIDGARD
 * token logo. Sized in `em` so they scale with the surrounding text and sit on
 * the baseline. Drop one right before the "ETH" / "MIDGARD" label wherever an
 * amount is shown.
 */
export function EthMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="./eth.svg"
      alt=""
      aria-hidden
      className={`inline-block h-[0.95em] w-[0.95em] align-[-0.12em] ${className}`}
      draggable={false}
    />
  );
}

export function MidMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="./elcasino_logo.png"
      alt=""
      aria-hidden
      className={`inline-block h-[0.95em] w-[0.95em] rounded-full object-cover align-[-0.12em] ring-1 ring-ink-600 ${className}`}
      draggable={false}
    />
  );
}
