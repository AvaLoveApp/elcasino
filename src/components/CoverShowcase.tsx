import { useEffect, useMemo, useRef, useState } from "react";
import { Rocket, Dices, ShieldCheck, Flame, Gift, RefreshCw, ExternalLink } from "lucide-react";
import { CHAIN, ADDR } from "../lib/chain";
import { RWA_PRESETS } from "../lib/rwa";
import { CASINO_GAMES, GameKey } from "../lib/casino";
import { GameTypeIcon } from "./GameTypeIcon";

/**
 * Home cover: the branded video plays continuously FORWARD then in REVERSE
 * (boomerang) so it never stops or hitches at a loop seam — and it stays sharp
 * (no blur). Over it, small visual cards float in in random groups of 2–3 — real
 * RWA tokens, casino games, and platform features — a visual pitch, not text.
 */

const RWA = RWA_PRESETS.filter((p) => p.logo && p.key !== "midgard");
const GAMES = CASINO_GAMES;
const GROUP_MS = 3000;

type Card =
  | { kind: "rwa"; logo: string; label: string; color: string }
  | { kind: "game"; gkey: GameKey; label: string; color: string }
  | { kind: "feature"; Icon: typeof Rocket; label: string; sub: string; color: string };

const FEATURES: Card[] = [
  { kind: "feature", Icon: Dices, label: "Casino", sub: "provably fair", color: "#fbbf24" },
  { kind: "feature", Icon: Gift, label: "Real yield", sub: "WETH to holders", color: "#34d399" },
  { kind: "feature", Icon: Flame, label: "Mirror-burn", sub: "supply decays", color: "#b4ff2e" },
  { kind: "feature", Icon: ShieldCheck, label: "Audited", sub: "on-chain", color: "#38bdf8" },
];

const POOL: Card[] = [
  ...RWA.map((r): Card => ({ kind: "rwa", logo: r.logo!, label: r.label, color: r.color })),
  ...GAMES.map((g): Card => ({ kind: "game", gkey: g.key, label: g.label, color: g.color })),
  ...FEATURES,
];

// Position presets (in %) — groups of 2 or 3, spread so cards don't overlap and
// leave the video visible around them. Kept in the top ~60% (brand sits bottom).
const LAYOUTS: { x: number; y: number }[][] = [
  [{ x: 8, y: 14 }, { x: 60, y: 34 }],
  [{ x: 12, y: 34 }, { x: 52, y: 9 }, { x: 73, y: 40 }],
  [{ x: 18, y: 8 }, { x: 63, y: 28 }],
  [{ x: 6, y: 38 }, { x: 38, y: 10 }, { x: 68, y: 36 }],
  [{ x: 22, y: 28 }, { x: 62, y: 11 }],
  [{ x: 10, y: 10 }, { x: 44, y: 34 }, { x: 74, y: 12 }],
];

type Placed = { pos: { x: number; y: number }; card: Card; id: string };

function pickGroup(): Placed[] {
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const used = new Set<number>();
  const chosen: Card[] = [];
  while (chosen.length < layout.length) {
    const i = Math.floor(Math.random() * POOL.length);
    if (used.has(i)) continue;
    used.add(i);
    chosen.push(POOL[i]);
  }
  return layout.map((pos, i) => ({ pos, card: chosen[i], id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}` }));
}

export function CoverShowcase({ onRefresh }: { onRefresh?: () => void } = {}) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const motion = useMemo(() => !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches), []);
  const [group, setGroup] = useState<Placed[]>(() => pickGroup());

  // The source is a pre-baked boomerang (forward + reversed, concatenated), so a
  // plain native loop plays it as a seamless forward↔reverse sweep — smooth, never
  // a hard cut back to the start.
  useEffect(() => {
    const v = vref.current;
    if (v) v.play().catch(() => {});
  }, []);

  // Swap the floating card group on an interval.
  useEffect(() => {
    if (!motion) return;
    const t = setInterval(() => setGroup(pickGroup()), GROUP_MS);
    return () => clearInterval(t);
  }, [motion]);

  return (
    <div className="relative -mx-4 sm:-mx-6 -mt-6 mb-4 overflow-hidden bg-ink-950">
      {/* Sharp, continuously boomeranging video (pre-baked forward+reverse) — never blurred.
          Height-capped on wider screens (the app is full-width now, so an uncapped
          h-auto cover would balloon) — object-cover crops instead of scaling up. */}
      <video ref={vref} className="block w-full h-auto max-h-[130px] sm:max-h-[150px] lg:max-h-[170px] object-cover" autoPlay muted loop playsInline poster="./elcasino_logo.png"
        onError={(e) => { const v = e.currentTarget; v.outerHTML = `<img src="./elcasino_logo.png" class="block w-full h-auto max-h-[130px] sm:max-h-[150px] lg:max-h-[170px] object-cover" alt="EL-Casino" />`; }}>
        <source src="./kapak-boom.mp4" type="video/mp4" />
      </video>

      {/* top-right controls — contract link + force refresh, docked on the cover */}
      <div className="absolute top-2 right-4 sm:right-6 z-20 flex items-center gap-2">
        <a href={`${CHAIN.explorer}/token/${ADDR.token}`} target="_blank" rel="noreferrer"
           className="font-mono text-[11px] text-bone-200 hover:text-blood-300 inline-flex items-center gap-1 rounded-full bg-ink-950/60 backdrop-blur px-2.5 py-1 ring-1 ring-ink-700/70">
          contract <ExternalLink size={11} />
        </a>
        {onRefresh && (
          <button onClick={onRefresh} title="Force refresh from chain"
            className="text-bone-300 hover:text-blood-300 transition rounded-full bg-ink-950/60 backdrop-blur p-1.5 ring-1 ring-ink-700/70">
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {/* light legibility gradient at the bottom for the brand mark */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent pointer-events-none z-[1]" />

      {/* floating visual cards — random groups of 2–3 */}
      {motion && (
        <div className="absolute inset-0 z-[5] pointer-events-none">
          {group.map((p) => <FloatCard key={p.id} placed={p} />)}
        </div>
      )}

      {/* flowing neon line along the bottom edge */}
      <div className="mg-cover-neon absolute bottom-0 inset-x-0 h-[3px] pointer-events-none z-10" />

      {/* brand overlay — always on top */}
      <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-2.5 flex items-end gap-2.5 flex-wrap z-20">
        <img src="./elcasino_logo.png" alt="" draggable={false}
          className="w-[52px] h-[52px] rounded-lg object-cover ring-1 ring-blood-500/40 shrink-0" />
        <div className="min-w-0">
          <h1 className="mg-neon text-xl font-black tracking-tight leading-none">ELCAS</h1>
          <span className="mg-neon-soft font-mono text-[10px] text-bone-200 drop-shadow">the economy behind the network</span>
        </div>
      </div>
    </div>
  );
}

function FloatCard({ placed }: { placed: Placed }) {
  const { pos, card } = placed;
  const color = card.color;
  return (
    <div className="mg-card absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      <div className="mg-float rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg"
        style={{
          background: "linear-gradient(155deg, rgba(18,22,20,0.82), rgba(9,11,13,0.74))",
          border: `1px solid ${color}66`,
          boxShadow: `0 10px 30px -12px rgba(0,0,0,0.8), 0 0 22px -6px ${color}88`,
          backdropFilter: "blur(3px)",
        }}>
        {card.kind === "rwa" ? (
          <>
            <img src={card.logo} alt="" className="h-10 w-10 rounded-full object-cover ring-2 bg-ink-900 shrink-0"
              style={{ borderColor: color, boxShadow: `0 0 12px ${color}77` }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div className="leading-tight">
              <div className="font-bold text-sm text-bone-50">{card.label}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>RWA · tokenized</div>
            </div>
          </>
        ) : card.kind === "game" ? (
          <>
            <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0"
              style={{ background: `${color}22`, border: `1px solid ${color}66`, boxShadow: `0 0 12px ${color}55` }}>
              <GameTypeIcon type={card.gkey} size={22} />
            </span>
            <div className="leading-tight">
              <div className="font-bold text-sm text-bone-50">{card.label}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>casino · play</div>
            </div>
          </>
        ) : (
          <>
            <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0"
              style={{ background: `${color}22`, border: `1px solid ${color}66`, boxShadow: `0 0 12px ${color}55` }}>
              <card.Icon size={20} color={color} strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <div className="font-bold text-sm text-bone-50 inline-flex items-center gap-1">{card.label}</div>
              <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>{card.sub}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
