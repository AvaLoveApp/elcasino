import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ────────────────────────────────────────────────
 *  Theme palette per-game
 * ──────────────────────────────────────────────── */
const THEMES = {
  purple:  { main: "#a855f7", light: "#c084fc", rgb: "168,85,247",  glow: "rgba(168,85,247,0.35)", border: "rgba(168,85,247,0.4)", bgWin: "rgba(168,85,247,0.08)" },
  emerald: { main: "#10b981", light: "#34d399", rgb: "16,185,129",  glow: "rgba(16,185,129,0.35)", border: "rgba(16,185,129,0.4)", bgWin: "rgba(16,185,129,0.08)" },
  amber:   { main: "#f59e0b", light: "#fbbf24", rgb: "245,158,11",  glow: "rgba(245,158,11,0.35)", border: "rgba(245,158,11,0.4)", bgWin: "rgba(245,158,11,0.08)" },
  orange:  { main: "#f97316", light: "#fb923c", rgb: "249,115,22",  glow: "rgba(249,115,22,0.35)", border: "rgba(249,115,22,0.4)", bgWin: "rgba(249,115,22,0.08)" },
  green:   { main: "#22c55e", light: "#4ade80", rgb: "34,197,94",   glow: "rgba(34,197,94,0.35)",  border: "rgba(34,197,94,0.4)",  bgWin: "rgba(34,197,94,0.08)" },
  blue:    { main: "#3b82f6", light: "#60a5fa", rgb: "59,130,246",  glow: "rgba(59,130,246,0.35)", border: "rgba(59,130,246,0.4)", bgWin: "rgba(59,130,246,0.08)" },
} as const;

const LOSE = { main: "#ef4444", light: "#f87171", rgb: "239,68,68", glow: "rgba(239,68,68,0.2)", border: "rgba(239,68,68,0.25)", bgWin: "rgba(239,68,68,0.06)" };

type Theme = keyof typeof THEMES;

/* ────────────────────────────────────────────────
 *  Props
 * ──────────────────────────────────────────────── */
export interface GameResultCardProps {
  show: boolean;
  won: boolean;
  amount?: string;
  usdAmount?: string;
  tokenLogoUrl?: string;
  tokenSymbol: string;
  subtitle: string;
  multiplier?: number;
  theme: Theme;
  winTitle?: string;
  loseTitle?: string;
  icon?: React.ReactNode;
  /** Render as inline flow element instead of absolute overlay */
  inline?: boolean;
}

/* ────────────────────────────────────────────────
 *  Particle burst (only on win)
 * ──────────────────────────────────────────────── */
function ResultParticles({ theme, big }: { theme: Theme; big?: boolean }) {
  const t = THEMES[theme];
  const count = big ? 28 : 16;
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360 + (Math.random() - 0.5) * 20;
        const rad = (angle * Math.PI) / 180;
        return {
          id: i,
          x: Math.cos(rad) * (70 + Math.random() * 140),
          y: Math.sin(rad) * (50 + Math.random() * 100),
          size: 2 + Math.random() * (big ? 5 : 3),
          dur: 0.6 + Math.random() * 0.5,
          delay: Math.random() * 0.15,
        };
      }),
    [count, big],
  );

  const colors = big
    ? [t.main, t.light, "#fbbf24", "#ffffff"]
    : [t.main, t.light, "#ffffff"];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: "50%",
            top: "50%",
            background: colors[p.id % colors.length],
            boxShadow: `0 0 ${p.size * 3}px ${colors[p.id % colors.length]}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeOut" }}
        />
      ))}
      {/* Central flash */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: big ? 120 : 80, height: big ? 120 : 80, background: `radial-gradient(circle, ${t.glow} 0%, transparent 70%)` }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────
 *  Lose shimmer (red pulse)
 * ──────────────────────────────────────────────── */
function LoseShimmer() {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl pointer-events-none z-0"
      style={{ background: `linear-gradient(135deg, transparent 30%, ${LOSE.glow} 50%, transparent 70%)`, backgroundSize: "200% 200%" }}
      initial={{ backgroundPosition: "200% 200%" }}
      animate={{ backgroundPosition: "-200% -200%" }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    />
  );
}

/* ────────────────────────────────────────────────
 *  Token ring (logo inside animated ring)
 * ──────────────────────────────────────────────── */
function TokenRing({ logoUrl, symbol, color, won }: { logoUrl?: string; symbol: string; color: string; won: boolean }) {
  return (
    <div className="relative shrink-0">
      {/* Outer pulsing ring (win only) */}
      {won && (
        <motion.div
          className="absolute -inset-1 rounded-full"
          style={{ border: `2px solid ${color}`, opacity: 0.5 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {/* Ring */}
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative overflow-hidden"
        style={{
          background: won
            ? `conic-gradient(from 0deg, ${color}40, ${color}80, ${color}40, transparent, ${color}40)`
            : `conic-gradient(from 0deg, ${LOSE.main}20, ${LOSE.main}40, ${LOSE.main}20)`,
          padding: "2px",
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: won
              ? "linear-gradient(135deg, #0a0f1a, #111827)"
              : "linear-gradient(135deg, #1a0a0a, #1f1111)",
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={symbol}
              width={28}
              height={28}
              className={`rounded-full ${won ? "" : "grayscale opacity-40"}`}
              style={won ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
            />
          ) : (
            <span
              className="text-xs font-bold font-mono"
              style={{ color: won ? color : LOSE.main }}
            >
              {symbol}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
 *  Main GameResultCard
 * ──────────────────────────────────────────────── */
export default function GameResultCard({
  show,
  won,
  amount,
  usdAmount,
  tokenLogoUrl,
  tokenSymbol,
  subtitle,
  multiplier = 0,
  theme,
  winTitle,
  loseTitle,
  icon,
  inline = false,
}: GameResultCardProps) {
  const t = THEMES[theme];
  const c = won ? t : LOSE;
  const isBigWin = won && multiplier >= 5;

  const title = won
    ? (winTitle || (isBigWin ? "MEGA WIN!" : "YOU WON!"))
    : (loseTitle || "YOU LOST");

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={inline ? "relative z-10" : "absolute top-4 sm:top-6 left-3 right-3 sm:left-4 sm:right-4 z-20 pointer-events-none"}
          initial={{ opacity: 0, y: inline ? 10 : -30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: inline ? 5 : -15, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
        >
          {/* Particles */}
          {won && <ResultParticles theme={theme} big={isBigWin} />}

          {/* Card */}
          <div
            className="relative rounded-2xl overflow-hidden backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, ${c.bgWin}, rgba(0, 0, 0, 0.92) 50%, ${c.bgWin})`,
              boxShadow: won
                ? `0 0 0 1px ${c.border}, 0 0 40px ${c.glow}, 0 20px 40px rgba(0, 0, 0, 0.4)`
                : `0 0 0 1px ${c.border}, 0 8px 24px rgba(0, 0, 0, 0.4)`,
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent 5%, ${c.main}80 30%, ${c.main} 50%, ${c.main}80 70%, transparent 95%)`,
              }}
            />

            {/* Win: animated gradient sweep */}
            {won && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(105deg, transparent 40%, ${c.glow} 50%, transparent 60%)`,
                  backgroundSize: "300% 100%",
                }}
                animate={{ backgroundPosition: ["150% 0%", "-150% 0%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              />
            )}

            {/* Lose: subtle static shimmer */}
            {!won && <LoseShimmer />}

            {/* Content */}
            <div className="relative z-10 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4">
              {/* Left: Token ring or custom icon */}
              {icon ? (
                <div className="shrink-0">{icon}</div>
              ) : (
                <TokenRing logoUrl={tokenLogoUrl} symbol={tokenSymbol} color={c.main} won={won} />
              )}

              {/* Center: Title + subtitle */}
              <div className="flex-1 min-w-0">
                <motion.div
                  className="flex items-center gap-2"
                  initial={won ? { scale: 0.8 } : { x: -5 }}
                  animate={won ? { scale: 1 } : { x: 0 }}
                  transition={won ? { type: "spring", stiffness: 500, damping: 15, delay: 0.1 } : { duration: 0.3 }}
                >
                  {/* Status dot */}
                  <div className="relative">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: c.main, boxShadow: `0 0 8px ${c.main}` }}
                    />
                    {won && (
                      <motion.div
                        className="absolute inset-0 w-2 h-2 rounded-full"
                        style={{ background: c.main }}
                        animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  <span
                    className="text-sm sm:text-base font-black font-mono uppercase tracking-wider"
                    style={{
                      color: c.main,
                      textShadow: won ? `0 0 20px ${c.glow}` : undefined,
                    }}
                  >
                    {title}
                  </span>

                  {/* Big win badge */}
                  {isBigWin && (
                    <motion.span
                      className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: `${t.main}25`,
                        color: t.light,
                        border: `1px solid ${t.main}40`,
                      }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {multiplier}x
                    </motion.span>
                  )}
                </motion.div>

                <div className="text-[11px] sm:text-xs font-mono text-gray-500 mt-0.5 truncate">
                  {subtitle}
                </div>
              </div>

              {/* Right: Payout */}
              {won && amount && (
                <motion.div
                  className="text-right shrink-0"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className="text-lg sm:text-xl font-black font-mono"
                      style={{ color: t.light, textShadow: `0 0 15px ${t.glow}` }}
                    >
                      +{amount}
                    </span>
                    {tokenLogoUrl && (
                      <img
                        src={tokenLogoUrl}
                        alt={tokenSymbol}
                        width={18}
                        height={18}
                        className="rounded-full"
                        style={{ filter: `drop-shadow(0 0 4px ${t.main})` }}
                      />
                    )}
                    <span className="text-xs font-mono" style={{ color: `${t.main}90` }}>
                      {tokenSymbol}
                    </span>
                  </div>
                  {usdAmount && (
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: `${t.main}60` }}>
                      ${usdAmount}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Bottom accent line */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent 10%, ${c.main}30 50%, transparent 90%)`,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
