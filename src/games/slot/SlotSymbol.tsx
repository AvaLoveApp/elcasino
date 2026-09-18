/**
 * Platform-style SVG slot symbols — crisp linework / neon-stroke aesthetic.
 * Stroke-first design: thick outlined paths with neon glow, minimal fill.
 * Index: 0=Cherry, 1=Lemon, 2=Orange, 3=Grape, 4=Bell, 5=Star, 6=Diamond, 7=Seven, 8=Bar, 9=Crown
 */

const SYMBOL_CONFIGS = [
  { color: "#ff4d6a", glow: "rgba(255,77,106,0.55)", label: "Cherry" },
  { color: "#fbbf24", glow: "rgba(251,191,36,0.55)", label: "Lemon" },
  { color: "#f97316", glow: "rgba(249,115,22,0.55)", label: "Orange" },
  { color: "#a855f7", glow: "rgba(168,85,247,0.55)", label: "Grape" },
  { color: "#22d3ee", glow: "rgba(34,211,238,0.55)", label: "Bell" },
  { color: "#fcd34d", glow: "rgba(252,211,77,0.65)", label: "Star" },
  { color: "#60a5fa", glow: "rgba(96,165,250,0.65)", label: "Diamond" },
  { color: "#00ff88", glow: "rgba(0,255,136,0.75)", label: "Seven" },
  { color: "#e2e8f0", glow: "rgba(226,232,240,0.45)", label: "Bar" },
  { color: "#f472b6", glow: "rgba(244,114,182,0.65)", label: "Crown" },
] as const;

/* shared filter defs injected once per symbol */
function Defs({ id, color, blur = 2.5 }: { id: string; color: string; blur?: number }) {
  return (
    <defs>
      <filter id={`g-${id}`} x="-35%" y="-35%" width="170%" height="170%">
        <feGaussianBlur stdDeviation={blur} result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`gs-${id}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={blur * 1.8} result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function CherrySVG({ size }: { size: number }) {
  const c = "#ff4d6a", g = "#4ade80";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="ch" color={c} blur={2.5} />
      {/* Stems */}
      <path d="M32 10 C30 16 26 22 22 30" stroke={g} strokeWidth="2.5" strokeLinecap="round" filter="url(#g-ch)" />
      <path d="M32 10 C34 16 38 22 42 30" stroke={g} strokeWidth="2.5" strokeLinecap="round" filter="url(#g-ch)" />
      {/* Leaf */}
      <path d="M32 10 C36 5 42 8 40 12 C38 10 35 9 32 10Z" fill={g} opacity="0.9" />
      {/* Left cherry — outline + fill */}
      <circle cx="21" cy="42" r="12" fill={c} fillOpacity="0.18" stroke={c} strokeWidth="2.5" filter="url(#gs-ch)" />
      <circle cx="21" cy="42" r="12" fill="none" stroke={c} strokeWidth="2.5" />
      <ellipse cx="17" cy="38" rx="4" ry="2.5" fill="white" opacity="0.22" />
      {/* Right cherry */}
      <circle cx="43" cy="42" r="12" fill={c} fillOpacity="0.18" stroke={c} strokeWidth="2.5" filter="url(#gs-ch)" />
      <circle cx="43" cy="42" r="12" fill="none" stroke={c} strokeWidth="2.5" />
      <ellipse cx="39" cy="38" rx="4" ry="2.5" fill="white" opacity="0.22" />
    </svg>
  );
}

function LemonSVG({ size }: { size: number }) {
  const c = "#fbbf24";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="le" color={c} />
      <ellipse cx="32" cy="32" rx="21" ry="17" fill={c} fillOpacity="0.15" stroke={c} strokeWidth="2.8" filter="url(#gs-le)" transform="rotate(-15 32 32)" />
      <ellipse cx="32" cy="32" rx="21" ry="17" fill="none" stroke={c} strokeWidth="2.8" transform="rotate(-15 32 32)" />
      {/* Segment lines */}
      <g stroke={c} strokeWidth="1.2" strokeOpacity="0.4" transform="rotate(-15 32 32)">
        <line x1="32" y1="17" x2="32" y2="47" />
        <line x1="13" y1="32" x2="51" y2="32" />
        <line x1="18" y1="20" x2="46" y2="44" />
        <line x1="18" y1="44" x2="46" y2="20" />
      </g>
      {/* Tips */}
      <ellipse cx="12" cy="35" rx="5" ry="3" fill={c} stroke={c} strokeWidth="1.5" transform="rotate(-15 12 35)" />
      <ellipse cx="52" cy="29" rx="5" ry="3" fill={c} stroke={c} strokeWidth="1.5" transform="rotate(-15 52 29)" />
      {/* Shine */}
      <ellipse cx="25" cy="25" rx="5" ry="3.5" fill="white" opacity="0.25" transform="rotate(-15 25 25)" />
    </svg>
  );
}

function OrangeSVG({ size }: { size: number }) {
  const c = "#f97316", g = "#4ade80";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="or" color={c} />
      <circle cx="32" cy="35" r="20" fill={c} fillOpacity="0.15" stroke={c} strokeWidth="2.8" filter="url(#gs-or)" />
      <circle cx="32" cy="35" r="20" fill="none" stroke={c} strokeWidth="2.8" />
      {/* Segment lines */}
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="32" y1="35"
          x2={32 + 18 * Math.cos((a * Math.PI) / 180)}
          y2={35 + 18 * Math.sin((a * Math.PI) / 180)}
          stroke={c} strokeWidth="1.2" strokeOpacity="0.4" />
      ))}
      {/* Inner ring */}
      <circle cx="32" cy="35" r="8" fill="none" stroke={c} strokeWidth="1.2" strokeOpacity="0.35" />
      {/* Shine */}
      <ellipse cx="25" cy="28" rx="5" ry="3.5" fill="white" opacity="0.2" />
      {/* Stem */}
      <rect x="30.5" y="11" width="3" height="6" rx="1.5" fill={g} />
      <ellipse cx="36" cy="12" rx="4" ry="2" fill={g} opacity="0.8" />
    </svg>
  );
}

function GrapeSVG({ size }: { size: number }) {
  const c = "#a855f7", g = "#4ade80";
  const berries: [number, number][] = [
    [32, 22], [23, 30], [41, 30],
    [18, 40], [32, 38], [46, 40],
    [23, 50], [41, 50], [32, 58],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="gr" color={c} blur={2.2} />
      {/* Stem */}
      <path d="M32 7 L32 17" stroke={g} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 10 Q32 5 36 10" stroke={g} strokeWidth="2" fill="none" />
      {berries.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="8" fill={c} fillOpacity="0.18" stroke={c} strokeWidth="2" filter="url(#gs-gr)" />
          <circle cx={cx} cy={cy} r="8" fill="none" stroke={c} strokeWidth="2" />
          <ellipse cx={cx - 3} cy={cy - 3} rx="2.5" ry="1.8" fill="white" opacity="0.22" />
        </g>
      ))}
    </svg>
  );
}

function BellSVG({ size }: { size: number }) {
  const c = "#22d3ee";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="be" color={c} />
      {/* Bell outline */}
      <path d="M32 9 C20 9 11 23 11 38 L11 45 Q11 49 16 49 L48 49 Q53 49 53 45 L53 38 C53 23 44 9 32 9Z"
        fill={c} fillOpacity="0.12" stroke={c} strokeWidth="2.8" strokeLinejoin="round" filter="url(#gs-be)" />
      <path d="M32 9 C20 9 11 23 11 38 L11 45 Q11 49 16 49 L48 49 Q53 49 53 45 L53 38 C53 23 44 9 32 9Z"
        fill="none" stroke={c} strokeWidth="2.8" strokeLinejoin="round" />
      {/* Horizontal band */}
      <line x1="11" y1="42" x2="53" y2="42" stroke={c} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Clapper */}
      <circle cx="32" cy="55" r="4.5" fill="none" stroke={c} strokeWidth="2.5" filter="url(#g-be)" />
      <line x1="32" y1="49" x2="32" y2="51" stroke={c} strokeWidth="2" />
      {/* Top knob */}
      <circle cx="32" cy="7" r="3.5" fill="none" stroke={c} strokeWidth="2.5" />
      {/* Shine */}
      <path d="M19 20 Q23 14 31 11" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

function StarSVG({ size }: { size: number }) {
  const c = "#fcd34d";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="st" color={c} blur={3} />
      <polygon
        points="32,4 38.5,22 58,22 43,34 49,52 32,42 15,52 21,34 6,22 25.5,22"
        fill={c} fillOpacity="0.15"
        stroke={c} strokeWidth="2.5" strokeLinejoin="round"
        filter="url(#gs-st)"
      />
      <polygon
        points="32,4 38.5,22 58,22 43,34 49,52 32,42 15,52 21,34 6,22 25.5,22"
        fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round"
      />
      {/* Inner star */}
      <polygon
        points="32,14 36,25 47,25 38,32 41,43 32,37 23,43 26,32 17,25 28,25"
        fill="none" stroke={c} strokeWidth="1.2" strokeOpacity="0.5" strokeLinejoin="round"
      />
      {/* Center dot */}
      <circle cx="32" cy="32" r="3" fill={c} opacity="0.6" />
    </svg>
  );
}

function DiamondSVG({ size }: { size: number }) {
  const c = "#60a5fa";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="di" color={c} blur={2.5} />
      {/* Main gem */}
      <polygon points="32,4 10,22 54,22" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="2.5" strokeLinejoin="round" filter="url(#gs-di)" />
      <polygon points="10,22 54,22 32,60" fill={c} fillOpacity="0.1" stroke={c} strokeWidth="2.5" strokeLinejoin="round" filter="url(#gs-di)" />
      <polygon points="32,4 10,22 54,22" fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="10,22 54,22 32,60" fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Facet lines */}
      <line x1="32" y1="4" x2="22" y2="22" stroke={c} strokeWidth="1.2" strokeOpacity="0.5" />
      <line x1="32" y1="4" x2="42" y2="22" stroke={c} strokeWidth="1.2" strokeOpacity="0.5" />
      <line x1="22" y1="22" x2="32" y2="60" stroke={c} strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="42" y1="22" x2="32" y2="60" stroke={c} strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="10" y1="22" x2="54" y2="22" stroke={c} strokeWidth="1.8" strokeOpacity="0.6" />
      {/* Crown highlight */}
      <polygon points="32,4 22,22 32,17 42,22" fill="white" opacity="0.2" />
    </svg>
  );
}

function SevenSVG({ size }: { size: number }) {
  const c = "#00ff88";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="se" color={c} blur={3} />
      {/* Bold stroke "7" */}
      <path
        d="M14 10 L50 10 L50 19 L33 57 L23 57 L38 22 L14 22 Z"
        fill={c} fillOpacity="0.12"
        stroke={c} strokeWidth="2.8" strokeLinejoin="round"
        filter="url(#gs-se)"
      />
      <path
        d="M14 10 L50 10 L50 19 L33 57 L23 57 L38 22 L14 22 Z"
        fill="none" stroke={c} strokeWidth="2.8" strokeLinejoin="round"
      />
      {/* Mid-stroke cross bar */}
      <line x1="20" y1="35" x2="36" y2="35" stroke={c} strokeWidth="2" strokeOpacity="0.6" />
      {/* Sparkles */}
      <circle cx="52" cy="7" r="2.5" fill={c} opacity="0.7" filter="url(#g-se)" />
      <circle cx="56" cy="15" r="1.8" fill={c} opacity="0.4" />
      <circle cx="10" cy="13" r="1.5" fill={c} opacity="0.35" />
    </svg>
  );
}

function BarSVG({ size }: { size: number }) {
  const c = "#e2e8f0";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="ba" color={c} blur={1.5} />
      {[11, 27, 43].map((y, i) => (
        <g key={y}>
          <rect x="7" y={y} width="50" height="11" rx="3.5"
            fill={c} fillOpacity="0.1" stroke={c} strokeWidth="2.2"
            filter="url(#gs-ba)" />
          <rect x="7" y={y} width="50" height="11" rx="3.5"
            fill="none" stroke={c} strokeWidth="2.2" />
          <text x="32" y={y + 8.5} textAnchor="middle" fill={c} fontSize="7.5" fontWeight="800"
            fontFamily="'Courier New', monospace" letterSpacing="2" opacity="0.85">BAR</text>
          <rect x="7" y={y} width="50" height="3" rx="2" fill="white" opacity="0.12" />
        </g>
      ))}
    </svg>
  );
}

function CrownSVG({ size }: { size: number }) {
  const c = "#f472b6", gold = "#fbbf24";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs id="cr" color={c} blur={2.5} />
      {/* Crown shape */}
      <path d="M8 47 L8 20 L20 32 L32 10 L44 32 L56 20 L56 47 Z"
        fill={c} fillOpacity="0.14" stroke={c} strokeWidth="2.8" strokeLinejoin="round"
        filter="url(#gs-cr)" />
      <path d="M8 47 L8 20 L20 32 L32 10 L44 32 L56 20 L56 47 Z"
        fill="none" stroke={c} strokeWidth="2.8" strokeLinejoin="round" />
      {/* Base band */}
      <rect x="8" y="47" width="48" height="9" rx="2.5" fill="none" stroke={c} strokeWidth="2.5" />
      {/* Jewels on tips */}
      <circle cx="8"  cy="20" r="3.5" fill={gold} stroke={gold} strokeWidth="1" filter="url(#g-cr)" />
      <circle cx="32" cy="10" r="4"   fill={gold} stroke={gold} strokeWidth="1" filter="url(#g-cr)" />
      <circle cx="56" cy="20" r="3.5" fill={gold} stroke={gold} strokeWidth="1" filter="url(#g-cr)" />
      {/* Band jewels */}
      <circle cx="32" cy="51.5" r="3" fill={gold} filter="url(#g-cr)" />
      <circle cx="20" cy="51.5" r="2" fill="#60a5fa" />
      <circle cx="44" cy="51.5" r="2" fill="#60a5fa" />
      {/* Highlight */}
      <path d="M14 22 Q18 29 20 32 L32 12 Q27 20 14 22Z" fill="white" opacity="0.15" />
    </svg>
  );
}

const SYMBOL_COMPONENTS = [
  CherrySVG,
  LemonSVG,
  OrangeSVG,
  GrapeSVG,
  BellSVG,
  StarSVG,
  DiamondSVG,
  SevenSVG,
  BarSVG,
  CrownSVG,
];

export const SYMBOL_COLORS = SYMBOL_CONFIGS.map((c) => c.color);
export const SYMBOL_GLOWS = SYMBOL_CONFIGS.map((c) => c.glow);
export const SYMBOL_LABELS = SYMBOL_CONFIGS.map((c) => c.label);

interface SlotSymbolProps {
  index: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  tokenLogoUrl?: string;
  tokenSymbol?: string;
}

const SIZE_MAP = {
  xs: 18,
  sm: 26,
  md: 40,
  lg: 58,
  xl: 80,
  "2xl": 108,
};

export function SlotSymbol({ index, size = "md", tokenLogoUrl, tokenSymbol }: SlotSymbolProps) {
  const px = SIZE_MAP[size];
  if (index === 7 && tokenLogoUrl) {
    return (
      <span className="inline-flex items-center justify-center" style={{ width: px, height: px }}>
        <img src={tokenLogoUrl} alt={tokenSymbol || "Token"} width={px} height={px} className="rounded-sm" />
      </span>
    );
  }
  const safeIndex = Math.min(Math.max(index, 0), 9);
  const Component = SYMBOL_COMPONENTS[safeIndex];
  return (
    <span className="inline-flex items-center justify-center" style={{ width: px, height: px }}>
      <Component size={px} />
    </span>
  );
}

export function SlotSymbolStrip({ count = 20, size = "md", tokenLogoUrl, tokenSymbol }: {
  count?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  tokenLogoUrl?: string;
  tokenSymbol?: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="block py-1">
          <SlotSymbol index={i % 10} size={size} tokenLogoUrl={tokenLogoUrl} tokenSymbol={tokenSymbol} />
        </span>
      ))}
    </>
  );
}
