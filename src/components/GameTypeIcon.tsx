import { GameKey } from "../lib/casino";

/**
 * Custom animated line-art icons for game types — ported 1:1 from Avlo's
 * GameTypeIcon so the casino uses the same stylized SVG marks (not emoji).
 * Colour comes from `currentColor`, so wrap in a span with the game tint.
 */
interface GameTypeIconProps {
  type: GameKey | "all";
  size?: number;
  className?: string;
  animate?: boolean;
}

export function GameTypeIcon({ type, size = 16, className = "", animate = true }: GameTypeIconProps) {
  const s = size;

  if (type === "roulette") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={deg} x1={12 + Math.cos(rad) * 7.5} y1={12 + Math.sin(rad) * 7.5}
              x2={12 + Math.cos(rad) * 10.5} y2={12 + Math.sin(rad) * 10.5}
              stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          );
        })}
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="2.5" r="1.5" fill="currentColor" opacity="0.9">
          {animate && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="4s" repeatCount="indefinite" />}
        </circle>
      </svg>
    );
  }

  if (type === "slots") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="3" width="20" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <rect x="4.5" y="6" width="15" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <line x1="9.5" y1="6" x2="9.5" y2="15" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
        <line x1="14.5" y1="6" x2="14.5" y2="15" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
        <text x="7" y="12" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="monospace" fill="currentColor" opacity="0.8">7
          {animate && <animate attributeName="y" values="12;8;12;14;12" dur="1.5s" repeatCount="indefinite" />}</text>
        <text x="12" y="12" textAnchor="middle" fontSize="5" fontWeight="bold" fontFamily="monospace" fill="currentColor" opacity="0.8">◆
          {animate && <animate attributeName="y" values="12;14;12;8;12" dur="1.8s" repeatCount="indefinite" />}</text>
        <text x="17" y="12" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="monospace" fill="currentColor" opacity="0.8">7
          {animate && <animate attributeName="y" values="12;10;12;14;12" dur="2s" repeatCount="indefinite" />}</text>
        <line x1="22" y1="8" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <circle cx="22" cy="7.5" r="1.2" fill="currentColor" opacity="0.5" />
        <line x1="4.5" y1="10.5" x2="19.5" y2="10.5" stroke="currentColor" strokeWidth="0.5" opacity="0.2" strokeDasharray="1.5 1" />
        {[7, 10, 12, 14, 17].map((x, i) => (
          <circle key={x} cx={x} cy="18.5" r="0.8" fill="currentColor" opacity="0.4">
            {animate && <animate attributeName="opacity" values="0.2;0.7;0.2" dur="0.8s" begin={`${i * 0.15}s`} repeatCount="indefinite" />}
          </circle>
        ))}
      </svg>
    );
  }

  if (type === "crash") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <line x1="3" y1="21" x2="3" y2="3" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        <line x1="3" y1="21" x2="21" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        <path d="M3 20 Q6 19 8 17 T12 12 Q14 8 16 5 L17 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7">
          {animate && <animate attributeName="stroke-dasharray" values="0 60;60 0" dur="2.5s" repeatCount="indefinite" />}
        </path>
        <g transform="translate(16,3) rotate(-30)">
          <path d="M0 -1.5 L-1.8 3 L0 2.2 L1.8 3 Z" fill="currentColor" opacity="0.8" />
          <path d="M-1 3 L0 5.5 L1 3" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5">
            {animate && <animate attributeName="d" values="M-1 3 L0 5.5 L1 3;M-0.8 3 L0 6 L0.8 3;M-1 3 L0 5.5 L1 3" dur="0.3s" repeatCount="indefinite" />}
          </path>
        </g>
        <path d="M3 20 Q6 19 8 17 T12 12 Q14 8 16 5 L17 3 L17 21 L3 21 Z" fill="currentColor" opacity="0.06" />
      </svg>
    );
  }

  if (type === "plinko") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        {[[12], [9, 15], [6, 12, 18], [3, 9, 15, 21]].map((row, ri) =>
          row.map((cx, ci) => <circle key={`${ri}-${ci}`} cx={cx} cy={6 + ri * 4.5} r="1" fill="currentColor" opacity="0.4" />)
        )}
        <circle cx="12" cy="4" r="1.8" fill="currentColor" opacity="0.85">
          {animate && (<><animate attributeName="cy" values="2;6;10;14;20" dur="2s" repeatCount="indefinite" /><animate attributeName="cx" values="12;10;13;10;12" dur="2s" repeatCount="indefinite" /></>)}
        </circle>
        <line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        {[4, 8, 12, 16, 20].map((x) => <line key={x} x1={x} y1="20" x2={x} y2="22" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />)}
      </svg>
    );
  }

  if (type === "mines") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        {[0, 1, 2].map((row) => [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`} x={3 + col * 6.5} y={3 + row * 6.5} width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.4" fill="none" />
        )))}
        <circle cx="12" cy="12" r="2.2" fill="currentColor" opacity="0.7" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return <line key={deg} x1={12 + Math.cos(rad) * 2.2} y1={12 + Math.sin(rad) * 2.2} x2={12 + Math.cos(rad) * 3.3} y2={12 + Math.sin(rad) * 3.3} stroke="currentColor" strokeWidth="0.7" opacity="0.5" />;
        })}
        <path d="M16.5 4.5 L18.5 6.5 L16.5 8.5 L14.5 6.5 Z" fill="currentColor" opacity="0.5">
          {animate && <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />}
        </path>
      </svg>
    );
  }

  if (type === "dice") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="9.5" width="20" height="5" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <defs><linearGradient id="rangeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="currentColor" stopOpacity="0.2" /><stop offset="50%" stopColor="currentColor" stopOpacity="0.35" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.5" /></linearGradient></defs>
        <rect x="2.5" y="10" width="19" height="4" rx="2" fill="url(#rangeGrad)" />
        {[6, 10, 14, 18].map((x) => <line key={x} x1={x} y1="9" x2={x} y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />)}
        <rect x="3" y="9.5" width="10" height="5" rx="2" fill="currentColor" opacity="0.12" />
        <line x1="13" y1="8" x2="13" y2="16" stroke="currentColor" strokeWidth="1.2" opacity="0.6" strokeDasharray="1.5 1" />
        <line x1="8" y1="7" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.85" strokeLinecap="round">
          {animate && <><animate attributeName="x1" values="4;20;4" dur="2.5s" repeatCount="indefinite" /><animate attributeName="x2" values="4;20;4" dur="2.5s" repeatCount="indefinite" /></>}
        </line>
        <circle cx="8" cy="12" r="2" fill="currentColor" opacity="0.6">
          {animate && <><animate attributeName="cx" values="4;20;4" dur="2.5s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite" /></>}
        </circle>
      </svg>
    );
  }

  if (type === "wheel") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <g>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return <line key={deg} x1="12" y1="12" x2={12 + Math.cos(rad) * 10} y2={12 + Math.sin(rad) * 10} stroke="currentColor" strokeWidth="0.6" opacity="0.3" />;
          })}
          {animate && <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="6s" repeatCount="indefinite" />}
        </g>
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.7" />
        <path d="M12 1 L10.5 3.5 L13.5 3.5 Z" fill="currentColor" opacity="0.8" />
      </svg>
    );
  }

  if (type === "coinflip") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        <g>
          <ellipse cx="12" cy="12" rx="9" ry="9" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          <ellipse cx="12" cy="12.5" rx="9" ry="2" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
          <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          <text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="monospace" fill="currentColor" opacity="0.7">H</text>
          {animate && <animateTransform attributeName="transform" type="rotate" values="0 12 12;-8 12 12;0 12 12;8 12 12;0 12 12" dur="1.5s" repeatCount="indefinite" />}
        </g>
      </svg>
    );
  }

  if (type === "blackjack") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Back card */}
        <rect x="7" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.1" opacity="0.35" transform="rotate(10 13 12)" />
        {/* Front card */}
        <rect x="4" y="5" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.6" fill="currentColor" fillOpacity="0.04" />
        {/* Spade pip */}
        <path d="M10 8.5 C7.5 11 7.5 13 10 13.5 C7.8 13.6 8 15.5 10 15.2 L10 17 L10 17 C12 15.5 12.2 13.6 10 13.5 C12.5 13 12.5 11 10 8.5 Z" fill="currentColor" opacity="0.75" transform="translate(0,-0.5)">
          {animate && <animate attributeName="opacity" values="0.5;0.85;0.5" dur="1.8s" repeatCount="indefinite" />}
        </path>
        <text x="6.2" y="9" fontSize="3.4" fontFamily="monospace" fontWeight="bold" fill="currentColor" opacity="0.6">A</text>
      </svg>
    );
  }

  if (type === "boxes") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
        {/* Grid of little boxes */}
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={3 + c * 6.5} y={3 + r * 6.5} width="5" height="5" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.35" fill="none" />
        )))}
        {/* One "prize" box lit */}
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.6">
          {animate && <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.4s" repeatCount="indefinite" />}
        </rect>
        {/* Ribbon on the lit box */}
        <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
      </svg>
    );
  }

  // "all" — generic gamepad icon
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="7" width="20" height="11" rx="5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="8" y1="10" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="5.5" y1="12.5" x2="10.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <circle cx="16" cy="11" r="1.2" fill="currentColor" opacity="0.5">
        {animate && <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.2s" repeatCount="indefinite" />}
      </circle>
      <circle cx="18.5" cy="13" r="1.2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
