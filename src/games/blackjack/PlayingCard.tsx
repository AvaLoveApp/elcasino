import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { playSound } from "../sound";

// Card system ported from Avlo blackjack — 52-card index → rank/suit, classic
// pip layouts, 3D flip animation, dealt/flip SFX.
export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardToRankSuit(cardIndex: number): { rank: string; suit: string } {
  const r = cardIndex % 13;
  const s = Math.floor(cardIndex / 13);
  return { rank: RANKS[r], suit: SUITS[s] };
}
export function cardValue(cardIndex: number): number {
  const r = cardIndex % 13;
  if (r === 0) return 11;
  if (r >= 10) return 10;
  return r + 1;
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[50, 22], [50, 78]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[28, 22], [72, 22], [28, 78], [72, 78]],
  5: [[28, 22], [72, 22], [50, 50], [28, 78], [72, 78]],
  6: [[28, 18], [72, 18], [28, 50], [72, 50], [28, 82], [72, 82]],
  7: [[28, 16], [72, 16], [50, 32], [28, 50], [72, 50], [28, 72], [72, 72]],
  8: [[28, 14], [72, 14], [50, 30], [28, 48], [72, 48], [50, 64], [28, 80], [72, 80]],
  9: [[28, 13], [72, 13], [28, 33], [72, 33], [50, 50], [28, 67], [72, 67], [28, 87], [72, 87]],
  10: [[28, 12], [72, 12], [50, 26], [28, 40], [72, 40], [28, 60], [72, 60], [50, 74], [28, 88], [72, 88]],
};

export function PlayingCard({ cardIndex, faceDown, delay = 0, small }: {
  cardIndex: number; faceDown?: boolean; delay?: number; small?: boolean;
}) {
  const [arrived, setArrived] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const wasFaceDown = useRef(!!faceDown);

  useEffect(() => {
    const t = setTimeout(() => { setArrived(true); playSound("deal"); }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (faceDown) { setFlipped(false); return; }
    if (!arrived) return;
    const flipDelay = wasFaceDown.current ? 300 : 600;
    wasFaceDown.current = false;
    const t = setTimeout(() => { setFlipped(true); playSound("flip"); }, flipDelay);
    return () => clearTimeout(t);
  }, [faceDown, arrived]);

  const { rank, suit } = cardToRankSuit(cardIndex);
  const isRed = suit === "♥" || suit === "♦";
  const suitColor = isRed ? "#cc1111" : "#111111";
  const isFace = ["J", "Q", "K"].includes(rank);
  const isAce = rank === "A";
  const pipCount = isAce || isFace ? 0 : parseInt(rank) || 0;
  const pips = PIP_LAYOUTS[pipCount] || [];

  const W = small ? 62 : 82;
  const H = small ? 90 : 118;
  const cornerRank = small ? 14 : 18;
  const cornerSuit = small ? 11 : 14;
  const pipSize = small ? 10 : 13;
  const aceSuit = small ? 38 : 52;
  const faceLabel = isFace ? rank : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, y: -20, rotate: -5 }}
      animate={arrived ? { opacity: 1, x: 0, y: 0, rotate: 0 } : { opacity: 0, x: 50, y: -20, rotate: -5 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ perspective: "900px", width: W, height: H, flexShrink: 0, position: "relative" }}>
      <div style={{
        transformStyle: "preserve-3d",
        transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
        transition: "transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)",
        width: W, height: H, position: "absolute", inset: 0,
      }}>
        {/* FRONT */}
        <div className="absolute inset-0 rounded-[8px] overflow-hidden select-none" style={{
          backfaceVisibility: "hidden",
          background: "linear-gradient(160deg, #fffef8 0%, #faf9f0 100%)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)",
          border: "1px solid rgba(160,140,120,0.35)",
        }}>
          <div className="absolute top-[4px] left-[5px] flex flex-col items-center leading-none" style={{ color: suitColor }}>
            <span style={{ fontSize: cornerRank, fontWeight: 900, lineHeight: 1, fontFamily: "Georgia, serif" }}>{rank}</span>
            <span style={{ fontSize: cornerSuit, lineHeight: 1.1 }}>{suit}</span>
          </div>
          <div className="absolute bottom-[4px] right-[5px] flex flex-col items-center leading-none rotate-180" style={{ color: suitColor }}>
            <span style={{ fontSize: cornerRank, fontWeight: 900, lineHeight: 1, fontFamily: "Georgia, serif" }}>{rank}</span>
            <span style={{ fontSize: cornerSuit, lineHeight: 1.1 }}>{suit}</span>
          </div>
          <div className="absolute inset-0">
            {isAce ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: aceSuit, color: suitColor, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}>{suit}</span>
              </div>
            ) : isFace ? (
              <div className="absolute inset-[8px] rounded-[4px] flex flex-col items-center justify-center overflow-hidden"
                style={{ border: `2px solid ${suitColor}55`, background: isRed ? "rgba(180,0,0,0.04)" : "rgba(0,0,0,0.04)" }}>
                <div className="absolute top-1 left-1 text-[6px]" style={{ color: suitColor, opacity: 0.4 }}>◆</div>
                <div className="absolute top-1 right-1 text-[6px]" style={{ color: suitColor, opacity: 0.4 }}>◆</div>
                <div className="absolute bottom-1 left-1 text-[6px]" style={{ color: suitColor, opacity: 0.4 }}>◆</div>
                <div className="absolute bottom-1 right-1 text-[6px]" style={{ color: suitColor, opacity: 0.4 }}>◆</div>
                <span style={{ fontSize: small ? 36 : 48, fontWeight: 900, lineHeight: 1, fontFamily: "Georgia, 'Times New Roman', serif", color: suitColor, textShadow: `0 2px 4px ${suitColor}33` }}>{faceLabel}</span>
                <span style={{ fontSize: small ? 14 : 18, color: suitColor, lineHeight: 1, marginTop: 2 }}>{suit}</span>
              </div>
            ) : (
              <svg className="absolute inset-0" width={W} height={H} viewBox="0 0 100 100" preserveAspectRatio="none">
                {pips.map(([cx, cy], i) => (
                  <text key={i} x={cx} y={cy + 4} textAnchor="middle" dominantBaseline="middle"
                    fontSize={pipSize * 1.5} fill={suitColor} style={{ fontFamily: "sans-serif" }}>{suit}</text>
                ))}
              </svg>
            )}
          </div>
        </div>
        {/* BACK */}
        <div className="absolute inset-0 rounded-[8px] overflow-hidden" style={{
          backfaceVisibility: "hidden", transform: "rotateY(180deg)",
          background: "linear-gradient(135deg, #7f1d1d 0%, #611515 40%, #4a1010 60%, #7f1d1d 100%)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div className="absolute inset-[3px] rounded-[5px]" style={{ border: "1.5px solid rgba(255,255,255,0.55)" }} />
          <div className="absolute inset-[6px] rounded-[3px]" style={{ border: "1px solid rgba(255,255,255,0.2)" }} />
          <div className="absolute inset-[7px] rounded-[2px] overflow-hidden opacity-30" style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgba(220,80,80,0.6) 0px, rgba(220,80,80,0.6) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, rgba(220,80,80,0.6) 0px, rgba(220,80,80,0.6) 1px, transparent 1px, transparent 6px)",
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span style={{ fontSize: small ? 22 : 30, opacity: 0.85 }}>⚔️</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** A hand row of cards with running total badge. */
export function Hand({ cards, count, faceDownIndex, total, label, small }: {
  cards: number[]; count: number; faceDownIndex?: number; total: number; label: string; small?: boolean;
}) {
  const visible = cards.slice(0, count);
  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-bone-500">{label}</span>
        {total > 0 && (
          <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${total > 21 ? "bg-blood-900/40 text-blood-300" : total === 21 ? "bg-amber-900/40 text-amber-300" : "bg-ink-800 text-bone-300"}`}>
            {total > 21 ? `${total} BUST` : total}
          </span>
        )}
      </div>
      <div className="flex justify-center gap-1.5 min-h-[92px]">
        {visible.length === 0 && <div className="text-bone-700 text-xs font-mono self-center">—</div>}
        {visible.map((c, i) => (
          <PlayingCard key={i} cardIndex={c} delay={i * 250}
            faceDown={faceDownIndex !== undefined && i === faceDownIndex} small={small} />
        ))}
      </div>
    </div>
  );
}
