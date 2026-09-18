import { getNumberColor, BET_TYPES } from "./rouletteConstants";
import { useRef, useCallback } from "react";

interface BettingTableProps {
  onBet: (betType: number, number: number) => void;
  selectedBets: Map<string, { type: number; number: number; amount?: string }>;
  disabled: boolean;
  tokenLogo?: string;
}

const GRID_NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1);

function betKey(type: number, num: number) {
  return `${type}-${num}`;
}

/** Chip count from amount (in terms of base chip). Max 5 visual chips */
function chipCount(amount: number, baseChip: number): number {
  if (!amount || !baseChip || baseChip <= 0) return 1;
  const ratio = amount / baseChip;
  if (ratio <= 1) return 1;
  // log2 doubling: 1x=1, 2x=2, 4x=3, 8x=4, 16x=5
  return Math.min(5, Math.floor(Math.log2(ratio)) + 1);
}

function ChipStack({ tokenLogo, count }: { tokenLogo?: string; count: number }) {
  // Spread positions: chips fill the cell area like a real roulette table
  // Each chip placed slightly offset so the stack fans out
  const positions: { x: number; y: number }[] = [
    { x: 0, y: 0 },          // center
    { x: -30, y: -25 },      // top-left
    { x: 28, y: -20 },       // top-right
    { x: -25, y: 22 },       // bottom-left
    { x: 30, y: 25 },        // bottom-right
  ];
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const pos = positions[i] || positions[0];
        return (
          <div
            key={i}
            className={`absolute w-7 h-7 sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center overflow-hidden ${i === count - 1 ? "chip-animate" : ""}`}
            style={{
              top: `calc(50% + ${pos.y}%)`,
              left: `calc(50% + ${pos.x}%)`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle at 38% 38%, rgba(40,45,55,0.9), rgba(0, 0, 0, 0.95))',
              boxShadow: i === count - 1
                ? '0 0 8px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.6)'
                : '0 1px 3px rgba(0, 0, 0, 0.5)',
            }}
          >
            {tokenLogo ? (
              <img src={tokenLogo} alt="" width={22} height={22} className={`rounded-full ${i === count - 1 ? 'opacity-95' : 'opacity-60'}`} />
            ) : (
              <div className={`w-4 h-4 rounded-full ${i === count - 1 ? 'bg-accent-green' : 'bg-accent-green/50'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Play a short chip placement sound via Web Audio API */
function useChipSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(() => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      const t = ctx.currentTime;
      // Short click/clack — two quick filtered noise bursts
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.exp(-i / (ctx.sampleRate * 0.008)); // fast decay
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3500;
      bp.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      src.connect(bp).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.06);
    } catch { /* audio not available */ }
  }, []);
}

export function BettingTable({ onBet, selectedBets, disabled, tokenLogo }: BettingTableProps) {
  const playChipSound = useChipSound();
  const rows = [
    GRID_NUMBERS.filter((n) => n % 3 === 0),     // Top row: 3,6,9...
    GRID_NUMBERS.filter((n) => n % 3 === 2),     // Mid row: 2,5,8...
    GRID_NUMBERS.filter((n) => n % 3 === 1),     // Bot row: 1,4,7...
  ];

  const isSelected = (type: number, num: number) =>
    selectedBets.has(betKey(type, num));

  const getBet = (type: number, num: number) =>
    selectedBets.get(betKey(type, num));

  const handleClick = (type: number, num: number) => {
    if (disabled) return;
    playChipSound();
    onBet(type, num);
  };

  /** Get chip stack info for a position */
  const getChipInfo = (type: number, num: number) => {
    const bet = getBet(type, num);
    if (!bet) return null;
    const amt = Number(bet.amount) || 0;
    // Find smallest bet to use as base chip for stack count
    let minAmt = Infinity;
    selectedBets.forEach((b) => { const a = Number(b.amount) || 0; if (a > 0 && a < minAmt) minAmt = a; });
    if (minAmt === Infinity) minAmt = amt || 1;
    return { amount: amt, count: chipCount(amt, minAmt) };
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full">
        {/* Main grid wrapper with deep-black casino felt */}
        <div className="rounded-lg border-2 border-[#1a1a1a] p-2 sm:p-3 shadow-[0_8px_32px_rgba(0,0,0,0.85),inset_0_0_60px_rgba(0,0,0,0.6)]" style={{ background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #050505 50%, #000000 100%)' }}>
          {/* Zero + Number grid */}
          <div className="flex">
            {/* Zero cell — spans full height of the 3 rows */}
            <button
              className={`relative cell-green flex-shrink-0 w-[7%] min-w-[24px] flex items-center justify-center text-white font-bold text-xs sm:text-base rounded-tl-md transition-all ${
                isSelected(BET_TYPES.NUMBER, 0) ? "ring-2 ring-accent-green ring-inset shadow-[inset_0_0_8px_rgba(0,255,136,0.3)]" : ""
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => handleClick(BET_TYPES.NUMBER, 0)}
            >
              0
              {(() => { const ci = getChipInfo(BET_TYPES.NUMBER, 0); return ci ? <ChipStack tokenLogo={tokenLogo} count={ci.count} /> : null; })()}
            </button>

            {/* Number rows + column bets */}
            <div className="flex-1 min-w-0">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex">
                  {row.map((num) => {
                    const color = getNumberColor(num);
                    const sel = isSelected(BET_TYPES.NUMBER, num);
                    return (
                      <button
                        key={num}
                        className={`relative ${
                          color === "red" ? "cell-red" : "cell-black"
                        } flex-1 min-w-0 aspect-[1.6/1] lg:aspect-[1.4/1] flex items-center justify-center text-white text-[8px] sm:text-[11px] lg:text-[13px] font-semibold transition-all ${
                          sel ? "ring-2 ring-accent-green ring-inset shadow-[inset_0_0_8px_rgba(0,255,136,0.3)]" : ""
                        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        onClick={() => handleClick(BET_TYPES.NUMBER, num)}
                      >
                        {num}
                        {(() => { const ci = getChipInfo(BET_TYPES.NUMBER, num); return ci ? <ChipStack tokenLogo={tokenLogo} count={ci.count} /> : null; })()}
                      </button>
                    );
                  })}
                  {/* Column bet */}
                  <button
                    className={`relative flex-shrink-0 w-[7%] min-w-[24px] border border-[rgba(30,42,58,0.5)] bg-[rgba(0,0,0,0.6)] text-gray-400 text-[7px] sm:text-[10px] font-semibold hover:bg-accent-green/10 hover:text-accent-green transition-all ${
                      isSelected(BET_TYPES.COL1 + rowIdx, 0) ? "ring-2 ring-accent-green ring-inset bg-accent-green/10 text-accent-green" : ""
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => handleClick(BET_TYPES.COL1 + rowIdx, 0)}
                  >
                    2:1
                    {(() => { const ci = getChipInfo(BET_TYPES.COL1 + rowIdx, 0); return ci ? <ChipStack tokenLogo={tokenLogo} count={ci.count} /> : null; })()}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dozens row */}
          <div className="flex mt-0.5 sm:mt-1">
            <div className="flex-shrink-0 w-[7%] min-w-[24px]" />
            <div className="flex-1 flex min-w-0 gap-0.5">
              {[
                { label: "1st 12", type: BET_TYPES.DOZEN1 },
                { label: "2nd 12", type: BET_TYPES.DOZEN2 },
                { label: "3rd 12", type: BET_TYPES.DOZEN3 },
              ].map(({ label, type }) => (
                <button
                  key={type}
                  className={`relative flex-1 min-w-0 h-7 sm:h-8 lg:h-10 border border-[rgba(30,42,58,0.5)] bg-[rgba(0,0,0,0.6)] text-gray-400 text-[8px] sm:text-[11px] lg:text-[13px] font-semibold hover:bg-accent-green/10 hover:text-accent-green transition-all ${
                    isSelected(type, 0) ? "ring-2 ring-accent-green ring-inset bg-accent-green/10 text-accent-green" : ""
                  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={() => handleClick(type, 0)}
                >
                  {label}
                  {(() => { const ci = getChipInfo(type, 0); return ci ? <ChipStack tokenLogo={tokenLogo} count={ci.count} /> : null; })()}
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 w-[7%] min-w-[24px]" />
          </div>

          {/* Outside bets row */}
          <div className="flex mt-0.5 sm:mt-1">
            <div className="flex-shrink-0 w-[7%] min-w-[24px]" />
            <div className="flex-1 flex min-w-0 gap-0.5">
              {[
                { label: "1-18", type: BET_TYPES.LOW },
                { label: "EVEN", type: BET_TYPES.EVEN },
                { label: "RED", type: BET_TYPES.RED, accent: "bg-red-700/40 hover:bg-red-600/50" },
                { label: "BLK", type: BET_TYPES.BLACK, accent: "bg-gray-800/80 hover:bg-gray-700/80" },
                { label: "ODD", type: BET_TYPES.ODD },
                { label: "19-36", type: BET_TYPES.HIGH },
              ].map(({ label, type, accent }) => (
                <button
                  key={type}
                  className={`relative flex-1 min-w-0 h-8 sm:h-9 lg:h-11 border border-[rgba(30,42,58,0.5)] ${
                    accent || "bg-[rgba(0,0,0,0.6)] hover:bg-accent-green/10"
                  } text-gray-300 text-[7px] sm:text-[10px] lg:text-[12px] font-semibold hover:text-white transition-all ${
                    isSelected(type, 0) ? "ring-2 ring-accent-green ring-inset shadow-[inset_0_0_8px_rgba(0,255,136,0.3)]" : ""
                  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={() => handleClick(type, 0)}
                >
                  {label}
                  {(() => { const ci = getChipInfo(type, 0); return ci ? <ChipStack tokenLogo={tokenLogo} count={ci.count} /> : null; })()}
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 w-[7%] min-w-[24px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
