const WORD = "EL-Casino";

/** Animated blood-red gothic wordmark (letter-by-letter colour wave). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`mg-word wordmark ${className}`} aria-label="EL-Casino">
      {WORD.split("").map((ch, i) => (
        <span key={i} aria-hidden className="mg-letter" style={{ animationDelay: `${i * 0.14}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src="./elcasino_logo.png" alt="EL-Casino" draggable={false}
        className="h-[52px] w-[52px] rounded-lg object-cover ring-1 ring-blood-500/30 shadow-blood" />
      {!compact && (
        <div className="leading-none">
          <Wordmark className="text-[2.1rem]" />
        </div>
      )}
    </div>
  );
}
