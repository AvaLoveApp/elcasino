import { useRef, useEffect, useState, useMemo } from "react";
import { playSound } from "../../games/sound";

/**
 * 3D token-logo coin flip — ported 1:1 from Avlo's coinflip page. Idle-spins
 * while waiting, then decelerates to land on the result face (heads=0°, tails=180°).
 */
export function CoinVisual({ spinning, result, choice, tokenLogoUrl, tokenSymbol, onLand }: {
  spinning: boolean; result: number | null; choice: number; tokenLogoUrl: string; tokenSymbol: string; onLand?: () => void;
}) {
  const coinRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const animRef = useRef<number>();
  const landedRef = useRef(false);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const [displayAngle, setDisplayAngle] = useState(0);

  useEffect(() => {
    if (!spinning || result !== null) return;
    landedRef.current = false;
    let lastTime = performance.now();
    const IDLE_SPEED = 180;
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      angleRef.current += IDLE_SPEED * dt;
      setDisplayAngle(angleRef.current);
      if (Math.floor(angleRef.current / 180) > Math.floor((angleRef.current - IDLE_SPEED * dt) / 180)) playSound("tick");
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning, result]);

  useEffect(() => {
    if (!spinning || result === null || landedRef.current) return;
    landedRef.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const IDLE_SPEED = 180;
    const targetFace = result === 0 ? 0 : 180;
    const currentMod = ((angleRef.current % 360) + 360) % 360;
    const offset = ((targetFace - currentMod) % 360 + 360) % 360;
    const totalDist = offset + 360;
    const duration = Math.max(3000, (2 * totalDist / IDLE_SPEED) * 1000);
    const startAngle = angleRef.current;
    const startTime = performance.now();
    let lastTickAngle = startAngle;
    const anim = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t * (2 - t);
      const angle = startAngle + totalDist * ease;
      angleRef.current = angle;
      setDisplayAngle(angle);
      if (Math.floor(angle / 180) > Math.floor(lastTickAngle / 180)) { lastTickAngle = angle; playSound("tick"); }
      if (t < 1) { animRef.current = requestAnimationFrame(anim); }
      else { angleRef.current = startAngle + totalDist; setDisplayAngle(angleRef.current); onLandRef.current?.(); }
    };
    animRef.current = requestAnimationFrame(anim);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning, result]);

  useEffect(() => {
    if (!spinning && result === null) {
      angleRef.current = choice === 0 ? 0 : 180;
      setDisplayAngle(angleRef.current);
      landedRef.current = false;
    }
  }, [spinning, result, choice]);

  const angle = spinning ? displayAngle : (result !== null ? (result === 0 ? 0 : 180) : (choice === 0 ? 0 : 180));
  const COIN_THICKNESS = 10;
  const edgeSlices = useMemo(() => Array.from({ length: COIN_THICKNESS }, (_, i) => i), []);

  return (
    <div className="relative mx-auto" style={{ width: 180, height: 180, perspective: "800px" }}>
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{
        bottom: -14, width: 150, height: 24,
        background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)",
        filter: "blur(5px)", transform: spinning ? "scale(0.5)" : "scale(1)", transition: "transform 0.3s",
      }} />
      <div ref={coinRef} style={{
        width: 180, height: 180, transformStyle: "preserve-3d",
        transform: `rotateY(${angle}deg)`,
        transition: spinning ? "none" : "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {edgeSlices.map((i) => (
          <div key={`edge-${i}`} className="absolute inset-0 rounded-full" style={{
            transform: `translateZ(${i - COIN_THICKNESS / 2 + 0.5}px)`,
            background: "linear-gradient(180deg, #FFD700 0%, #DAA520 8%, #B8860B 20%, #8B6914 35%, #6B4F12 50%, #8B6914 65%, #B8860B 80%, #DAA520 92%, #FFD700 100%)",
            boxShadow: i % 2 === 0 ? "inset 0 0 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,215,0,0.3)" : "inset 0 0 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
            borderTop: i % 2 === 0 ? "1px solid rgba(139,105,20,0.6)" : "1px solid rgba(255,215,0,0.25)",
            borderBottom: i % 2 === 0 ? "1px solid rgba(107,79,18,0.7)" : "1px solid rgba(218,165,32,0.2)",
          }} />
        ))}
        {/* HEADS */}
        <div className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden" style={{
          backfaceVisibility: "hidden", transform: `translateZ(${COIN_THICKNESS / 2}px)`,
          background: "linear-gradient(145deg, #FFD700 0%, #FFA500 30%, #FFD700 60%, #DAA520 100%)",
          border: "5px solid #B8860B",
          boxShadow: "0 0 40px rgba(255,215,0,0.35), inset 0 4px 10px rgba(255,255,255,0.5), inset 0 -4px 10px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <div className="absolute inset-[3px] rounded-full pointer-events-none" style={{ border: "2px solid rgba(255,215,0,0.5)", boxShadow: "inset 0 1px 3px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)" }} />
          {tokenLogoUrl ? (
            <img src={tokenLogoUrl} alt="Heads" className="w-[68%] h-[68%] object-contain rounded-full" style={{ filter: "brightness(1.1) saturate(1.2) drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
          ) : <span className="text-6xl drop-shadow-lg">👑</span>}
          <div className="absolute top-2 left-4 w-16 h-8 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)" }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 180 180">
            <defs><path id="coin-top-arc" d="M 14,90 A 76,76 0 0,1 166,90" fill="none" /><path id="coin-bottom-arc" d="M 14,90 A 76,76 0 0,0 166,90" fill="none" /></defs>
            <text><textPath href="#coin-top-arc" startOffset="50%" textAnchor="middle" style={{ fontSize: "8.5px", fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.18em", fill: "#8B6914", stroke: "#6B4F12", strokeWidth: 0.3 }}>{tokenSymbol ? `★ ${tokenSymbol} COIN ★` : "★ COIN ★"}</textPath></text>
            <text><textPath href="#coin-bottom-arc" startOffset="50%" textAnchor="middle" style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.15em", fill: "#8B6914", stroke: "#6B4F12", strokeWidth: 0.3 }}>HEADS</textPath></text>
          </svg>
        </div>
        {/* TAILS */}
        <div className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden" style={{
          backfaceVisibility: "hidden", transform: `rotateY(180deg) translateZ(${COIN_THICKNESS / 2}px)`,
          background: "linear-gradient(145deg, #9CA3AF 0%, #6B7280 30%, #9CA3AF 60%, #4B5563 100%)",
          border: "5px solid #4B5563",
          boxShadow: "0 0 40px rgba(156,163,175,0.25), inset 0 4px 10px rgba(255,255,255,0.3), inset 0 -4px 10px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <div className="absolute inset-[3px] rounded-full pointer-events-none" style={{ border: "2px solid rgba(156,163,175,0.35)", boxShadow: "inset 0 1px 3px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.2)" }} />
          {tokenLogoUrl ? (
            <img src={tokenLogoUrl} alt="Tails" className="w-[68%] h-[68%] object-contain rounded-full" style={{ filter: "brightness(0.5) saturate(0.3) grayscale(0.6) drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
          ) : <span className="text-6xl drop-shadow-lg" style={{ filter: "grayscale(0.8) brightness(0.7)" }}>🦅</span>}
          <div className="absolute top-2 left-4 w-16 h-8 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)" }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 180 180">
            <defs><path id="coin-top-arc-t" d="M 14,90 A 76,76 0 0,1 166,90" fill="none" /><path id="coin-bottom-arc-t" d="M 14,90 A 76,76 0 0,0 166,90" fill="none" /></defs>
            <text><textPath href="#coin-top-arc-t" startOffset="50%" textAnchor="middle" style={{ fontSize: "8.5px", fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.18em", fill: "#6B7280", stroke: "#4B5563", strokeWidth: 0.3 }}>{tokenSymbol ? `★ ${tokenSymbol} COIN ★` : "★ COIN ★"}</textPath></text>
            <text><textPath href="#coin-bottom-arc-t" startOffset="50%" textAnchor="middle" style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.15em", fill: "#6B7280", stroke: "#4B5563", strokeWidth: 0.3 }}>TAILS</textPath></text>
          </svg>
        </div>
      </div>
    </div>
  );
}
