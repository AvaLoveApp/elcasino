// Crash game visuals + Web Audio engine — ported 1:1 from Avlo's crash page.
import { useRef, useEffect, useMemo } from "react";

let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Continuous rising engine sound that scales to animation duration
let engineNodes: { stop: () => void } | null = null;
export function playEngineSound(durationMs: number, finalMult: number) {
  stopEngineSound();
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const dur = durationMs / 1000;

    // Main engine drone — low sine that rises with the multiplier
    const eng = ctx.createOscillator();
    const engGain = ctx.createGain();
    eng.type = "sine";
    eng.frequency.setValueAtTime(80, now);
    eng.frequency.exponentialRampToValueAtTime(80 + finalMult * 40, now + dur);
    engGain.gain.setValueAtTime(0, now);
    engGain.gain.linearRampToValueAtTime(0.07, now + 0.3);
    engGain.gain.setValueAtTime(0.07, now + dur * 0.85);
    engGain.gain.linearRampToValueAtTime(0, now + dur);
    eng.connect(engGain);
    engGain.connect(ctx.destination);
    eng.start(now);
    eng.stop(now + dur + 0.1);

    // Harmonic overtone — adds tension as it climbs
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = "triangle";
    harm.frequency.setValueAtTime(160, now);
    harm.frequency.exponentialRampToValueAtTime(160 + finalMult * 60, now + dur);
    harmGain.gain.setValueAtTime(0, now);
    harmGain.gain.linearRampToValueAtTime(0.04, now + 0.5);
    harmGain.gain.setValueAtTime(0.04, now + dur * 0.85);
    harmGain.gain.linearRampToValueAtTime(0, now + dur);
    harm.connect(harmGain);
    harmGain.connect(ctx.destination);
    harm.start(now);
    harm.stop(now + dur + 0.1);

    // Filtered noise — rocket rumble
    const noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(300, now);
    lpf.frequency.exponentialRampToValueAtTime(300 + finalMult * 150, now + dur);
    lpf.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.035, now + 0.4);
    noiseGain.gain.setValueAtTime(0.035, now + dur * 0.85);
    noiseGain.gain.linearRampToValueAtTime(0, now + dur);
    noise.connect(lpf);
    lpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Rising shimmer — high sine pulsing for suspense
    const shimmer = ctx.createOscillator();
    const shimGain = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(600, now);
    shimmer.frequency.exponentialRampToValueAtTime(600 + finalMult * 200, now + dur);
    shimGain.gain.setValueAtTime(0, now);
    shimGain.gain.linearRampToValueAtTime(0.02, now + 1);
    shimGain.gain.setValueAtTime(0.02, now + dur * 0.8);
    shimGain.gain.linearRampToValueAtTime(0, now + dur);
    shimmer.connect(shimGain);
    shimGain.connect(ctx.destination);
    shimmer.start(now);
    shimmer.stop(now + dur + 0.1);

    engineNodes = {
      stop: () => {
        const t = ctx.currentTime;
        [engGain, harmGain, noiseGain, shimGain].forEach(g => {
          try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.15); } catch {}
        });
        setTimeout(() => {
          [eng, harm, noise, shimmer].forEach(n => { try { n.stop(); } catch {} });
        }, 200);
        engineNodes = null;
      },
    };
  } catch { /* ignore audio errors */ }
}
export function stopEngineSound() {
  if (engineNodes) { engineNodes.stop(); engineNodes = null; }
}

export function playSound(type: "launch" | "rising" | "cashout" | "crash" | "tick") {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "launch": {
        // Clean rocket ignition: rising tone + subtle whoosh
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.setValueAtTime(0.12, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
        // Harmonic shimmer
        const h2 = ctx.createOscillator();
        const h2g = ctx.createGain();
        h2.type = "sine";
        h2.frequency.setValueAtTime(440, now);
        h2.frequency.exponentialRampToValueAtTime(1760, now + 0.6);
        h2g.gain.setValueAtTime(0.04, now);
        h2g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        h2.connect(h2g); h2g.connect(ctx.destination);
        h2.start(now); h2.stop(now + 0.65);
        // Soft filtered noise whoosh
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
        noise.buffer = buf;
        const bpf = ctx.createBiquadFilter();
        bpf.type = "bandpass";
        bpf.frequency.setValueAtTime(800, now);
        bpf.frequency.exponentialRampToValueAtTime(3000, now + 0.4);
        bpf.Q.value = 1.5;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.04, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        noise.connect(bpf); bpf.connect(ng); ng.connect(ctx.destination);
        noise.start(now);
        break;
      }
      case "rising": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "cashout": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.15);
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = "sine";
        o2.frequency.setValueAtTime(659, now + 0.12);
        g2.gain.setValueAtTime(0.15, now + 0.12);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        o2.start(now + 0.12);
        o2.stop(now + 0.5);
        const o3 = ctx.createOscillator();
        const g3 = ctx.createGain();
        o3.connect(g3); g3.connect(ctx.destination);
        o3.type = "sine";
        o3.frequency.setValueAtTime(784, now + 0.24);
        g3.gain.setValueAtTime(0.15, now + 0.24);
        g3.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        o3.start(now + 0.24);
        o3.stop(now + 0.6);
        break;
      }
      case "crash": {
        // Layered explosion: sub-bass thump + filtered noise burst + sawtooth crack
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.45);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        // Filtered noise burst
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const decay = Math.pow(1 - i / data.length, 1.8);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2400, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.5);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.28, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        noise.connect(filter); filter.connect(ng); ng.connect(ctx.destination);
        noise.start(now);
        // Mid-range crack (sawtooth)
        const crack = ctx.createOscillator();
        const cg = ctx.createGain();
        crack.connect(cg); cg.connect(ctx.destination);
        crack.type = "sawtooth";
        crack.frequency.setValueAtTime(900, now);
        crack.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        cg.gain.setValueAtTime(0.2, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        crack.start(now);
        crack.stop(now + 0.22);
        break;
      }
      case "tick": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
    }
  } catch { /* ignore audio errors */ }
}

// ── Subtle dark star canvas ──
export function StarsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      speed: Math.random() * 0.12 + 0.02,
      twinkle: Math.random() * Math.PI * 2,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        s.twinkle += 0.015;
        const alpha = 0.15 + Math.sin(s.twinkle) * 0.12;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
        s.y -= s.speed;
        if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Rocket SVG (puffy 3D cartoon style) ──
export function RocketSVG({ flameIntensity = 1, size = 80 }: { flameIntensity?: number; size?: number }) {
  const fi = Math.max(flameIntensity, 0);
  const w = size;
  const h = size * 1.3;
  return (
    <svg width={w} height={h} viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
      {/* Exhaust glow */}
      <ellipse cx="50" cy="105" rx={16 + fi * 9} ry={8 + fi * 5} fill="url(#rk_engineGlow)" opacity={0.25 * fi}>
        <animate attributeName="rx" values={`${16 + fi * 9};${18 + fi * 9};${16 + fi * 9}`} dur="0.3s" repeatCount="indefinite" />
      </ellipse>
      {/* Exhaust outer */}
      <ellipse cx="50" cy={105 + fi * 10} rx={10 + fi * 5} ry={5 + fi * 14} fill="url(#rk_exhaustOuter)" opacity={0.7 * Math.min(fi, 1)}>
        <animate attributeName="ry" values={`${5 + fi * 14};${7 + fi * 16};${5 + fi * 14}`} dur="0.15s" repeatCount="indefinite" />
      </ellipse>
      {/* Exhaust inner */}
      <ellipse cx="50" cy={103 + fi * 6} rx={5 + fi * 2.5} ry={4 + fi * 9} fill="url(#rk_exhaustInner)" opacity={0.85 * Math.min(fi, 1)}>
        <animate attributeName="ry" values={`${4 + fi * 9};${6 + fi * 10};${4 + fi * 9}`} dur="0.1s" repeatCount="indefinite" />
      </ellipse>
      {/* Exhaust core */}
      <ellipse cx="50" cy={101 + fi * 3} rx={2.5 + fi * 1} ry={2 + fi * 4} fill="white" opacity={0.9 * Math.min(fi, 1)}>
        <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.08s" repeatCount="indefinite" />
      </ellipse>

      {/* ── Fins (red, puffy 3D) ── */}
      <path d="M24 78C16 84 10 98 13 106L27 96L24 78Z" fill="url(#rk_finL)" />
      <path d="M24 78C16 84 10 98 13 106L27 96L24 78Z" fill="rgba(255,255,255,0.15)" />
      <path d="M76 78C84 84 90 98 87 106L73 96L76 78Z" fill="url(#rk_finR)" />
      <path d="M76 78C84 84 90 98 87 106L73 96L76 78Z" fill="rgba(0, 0, 0, 0.05)" />

      {/* ── Rocket body (puffy balloon, cylindrical 3D) ── */}
      <ellipse cx="50" cy="58" rx="26" ry="42" fill="url(#rk_body3d)" />
      {/* Body specular highlight (left-top) */}
      <ellipse cx="40" cy="42" rx="14" ry="28" fill="url(#rk_specular)" />
      {/* Body rim light (right edge) */}
      <ellipse cx="68" cy="55" rx="5" ry="32" fill="rgba(255,255,255,0.08)" />
      {/* Body shadow (right-bottom) */}
      <ellipse cx="58" cy="65" rx="12" ry="30" fill="rgba(0, 0, 0, 0.08)" />
      {/* Body bottom depth shadow */}
      <ellipse cx="50" cy="92" rx="20" ry="6" fill="rgba(0, 0, 0, 0.06)" />

      {/* ── Nose cone (red, bulbous) ── */}
      <path d="M50 10C44 10 36 20 32 28L68 28C64 20 56 10 50 10Z" fill="url(#rk_nose)" />
      {/* Nose highlight */}
      <ellipse cx="46" cy="18" rx="6" ry="5" fill="rgba(255,100,120,0.6)" />
      <ellipse cx="45" cy="16" rx="3" ry="2.5" fill="rgba(255,255,255,0.35)" />
      {/* Nose tip */}
      <ellipse cx="50" cy="12" rx="5" ry="3.5" fill="#ff5566" />
      <ellipse cx="48" cy="11" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.4)" />

      {/* ── Window (glossy porthole) ── */}
      <circle cx="50" cy="48" r="14" fill="#e8944c" />
      <circle cx="50" cy="48" r="12" fill="url(#rk_windowGlass)" />
      {/* Window gloss reflection */}
      <ellipse cx="46" cy="43" rx="6" ry="5" fill="rgba(255,255,255,0.18)" />
      <ellipse cx="44" cy="41" rx="3" ry="2" fill="rgba(255,255,255,0.25)" />

      {/* ── Orange band (puffy belt) ── */}
      <path d="M30 85C30 80 38 77 50 77C62 77 70 80 70 85L70 90C70 93 62 95 50 95C38 95 30 93 30 90Z" fill="url(#rk_band)" />
      {/* Band highlight */}
      <ellipse cx="42" cy="84" rx="8" ry="4" fill="rgba(255,255,255,0.15)" />

      {/* ── Center leg (red, chunky) ── */}
      <rect x="45" y="94" width="10" height="14" rx="5" fill="url(#rk_legGrad)" />
      <rect x="47" y="94" width="3" height="12" rx="1.5" fill="rgba(255,255,255,0.18)" />

      {/* ── Nozzle (puffy bell) ── */}
      <path d="M41 106L38 114L62 114L59 106Z" fill="#667" />
      <path d="M42 106L39.5 113L60.5 113L58 106Z" fill="#556" />
      <ellipse cx="47" cy="110" rx="4" ry="3" fill="rgba(255,255,255,0.06)" />

      <defs>
        {/* Puffy radial body gradient (shiny sphere look) */}
        <radialGradient id="rk_body3d" cx="0.38" cy="0.35" r="0.65" fx="0.35" fy="0.3">
          <stop stopColor="#ffffff" />
          <stop offset="0.2" stopColor="#f8f8f8" />
          <stop offset="0.5" stopColor="#e8e8e8" />
          <stop offset="0.8" stopColor="#d0d0d0" />
          <stop offset="1" stopColor="#b8b8b8" />
        </radialGradient>
        {/* Specular highlight */}
        <radialGradient id="rk_specular" cx="0.5" cy="0.35" r="0.6">
          <stop stopColor="rgba(255,255,255,0.4)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Window glass */}
        <radialGradient id="rk_windowGlass" cx="0.35" cy="0.35" r="0.7">
          <stop stopColor="#3a4068" />
          <stop offset="0.6" stopColor="#252840" />
          <stop offset="1" stopColor="#1a1d30" />
        </radialGradient>
        <linearGradient id="rk_nose" x1="32" y1="10" x2="68" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7777" />
          <stop offset="1" stopColor="#cc2233" />
        </linearGradient>
        <linearGradient id="rk_finL" x1="10" y1="78" x2="27" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff5555" />
          <stop offset="1" stopColor="#cc3333" />
        </linearGradient>
        <linearGradient id="rk_finR" x1="73" y1="78" x2="90" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ee4444" />
          <stop offset="1" stopColor="#aa2222" />
        </linearGradient>
        <linearGradient id="rk_band" x1="30" y1="77" x2="70" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5b040" />
          <stop offset="1" stopColor="#d08020" />
        </linearGradient>
        <linearGradient id="rk_legGrad" x1="45" y1="94" x2="55" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e05555" />
          <stop offset="1" stopColor="#bb3333" />
        </linearGradient>
        <radialGradient id="rk_engineGlow" cx="0.5" cy="0.3" r="0.7">
          <stop stopColor="#ff8800" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff4400" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rk_exhaustOuter" cx="0.5" cy="0.2" r="0.8">
          <stop stopColor="#ff6600" />
          <stop offset="0.5" stopColor="#ff3300" stopOpacity="0.7" />
          <stop offset="1" stopColor="#cc0000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rk_exhaustInner" cx="0.5" cy="0.15" r="0.7">
          <stop stopColor="#ffffcc" />
          <stop offset="0.4" stopColor="#ffcc44" />
          <stop offset="1" stopColor="#ff6600" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ── Idle pre-launch effects (memoized) ──
export const IDLE_STEAM_PUFFS = Array.from({ length: 6 }, (_, i) => ({
  sx: (i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 4),
  dx: ((i * 17) % 21) - 10,
  size: 14 + (i % 3) * 6,
  delay: (i * 0.55) % 3.2,
}));

// ── Cinematic explosion: shockwave + fireball + smoke + debris ──
export function ExplosionEffect() {
  const debris = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i,
    angle: (i / 18) * 360 + Math.random() * 18,
    dist: 60 + Math.random() * 130,
    fall: 80 + Math.random() * 140,
    size: 4 + Math.random() * 7,
    rot: (Math.random() - 0.5) * 720,
    color: ["#9ca3af", "#6b7280", "#fb923c", "#dc2626", "#fbbf24"][i % 5],
    delay: Math.random() * 0.05,
    dur: 0.9 + Math.random() * 0.6,
  })), []);
  const smoke = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 220,
    y: -40 - Math.random() * 90,
    size: 30 + Math.random() * 40,
    delay: Math.random() * 0.2,
    dur: 1.2 + Math.random() * 0.9,
  })), []);
  const sparks = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: (i / 24) * 360 + Math.random() * 12,
    dist: 40 + Math.random() * 90,
    size: 2 + Math.random() * 3,
    color: ["#fde047", "#fb923c", "#fef08a", "#ffffff"][i % 4],
    dur: 0.5 + Math.random() * 0.4,
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
      <style>{`
        @keyframes crashFlash {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
          18% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.3); }
        }
        @keyframes crashShock {
          0% { opacity: 1; transform: translate(-50%,-50%) scale(0.2); border-width: 6px; }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(14); border-width: 1px; }
        }
        @keyframes crashFireball {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.2); }
          25% { opacity: 1; transform: translate(-50%,-50%) scale(1.1); }
          70% { opacity: 0.8; transform: translate(-50%,-50%) scale(1.4); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(2); }
        }
        @keyframes crashDebris {
          0% { opacity: 1; transform: translate(0,0) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); }
        }
        @keyframes crashSmoke {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
          25% { opacity: 0.8; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) scale(1.6); }
        }
        @keyframes crashSpark {
          0% { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.2); }
        }
      `}</style>
      {/* Center bright flash */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 360, height: 360, marginLeft: -180, marginTop: -180,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,235,1) 0%, rgba(255,160,40,0.9) 28%, rgba(220,38,38,0.5) 55%, transparent 80%)",
        mixBlendMode: "screen",
        animation: "crashFlash 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        opacity: 0,
      }} />
      {/* Shockwave ring */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 60, height: 60, marginLeft: -30, marginTop: -30,
        borderRadius: "50%",
        border: "5px solid rgba(251,191,36,0.85)",
        boxShadow: "0 0 30px rgba(251,191,36,0.7), inset 0 0 30px rgba(251,191,36,0.4)",
        animation: "crashShock 0.9s cubic-bezier(0.22,1,0.36,1) forwards",
        opacity: 0,
      }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 60, height: 60, marginLeft: -30, marginTop: -30,
        borderRadius: "50%",
        border: "4px solid rgba(239,68,68,0.65)",
        boxShadow: "0 0 40px rgba(239,68,68,0.5), inset 0 0 20px rgba(239,68,68,0.3)",
        animation: "crashShock 1.05s cubic-bezier(0.22,1,0.36,1) 0.15s forwards",
        opacity: 0,
      }} />
      {/* Fireball */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 140, height: 140, marginLeft: -70, marginTop: -70,
        borderRadius: "50%",
        background: "radial-gradient(circle at 40% 35%, #fff8c8 0%, #fbbf24 25%, #f97316 50%, #dc2626 75%, transparent 95%)",
        filter: "blur(2px)",
        animation: "crashFireball 0.85s ease-out forwards",
        opacity: 0,
      }} />
      {/* Smoke clouds */}
      {smoke.map(s => (
        <div key={`s${s.id}`} style={{
          position: "absolute", left: "50%", top: "50%",
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(80,80,90,0.6) 0%, rgba(40,40,50,0.4) 60%, transparent 90%)",
          filter: "blur(3px)",
          ["--sx" as any]: `${s.x}px`,
          ["--sy" as any]: `${s.y}px`,
          animation: `crashSmoke ${s.dur}s ease-out ${s.delay}s forwards`,
          opacity: 0,
        }} />
      ))}
      {/* Debris (chunks) */}
      {debris.map(d => {
        const dx = Math.cos(d.angle * Math.PI / 180) * d.dist;
        const dy = Math.sin(d.angle * Math.PI / 180) * d.dist + d.fall;
        return (
          <div key={`d${d.id}`} style={{
            position: "absolute", left: "50%", top: "50%",
            width: d.size, height: d.size,
            background: d.color,
            borderRadius: 2,
            boxShadow: `0 0 ${d.size}px ${d.color}`,
            ["--dx" as any]: `${dx}px`,
            ["--dy" as any]: `${dy}px`,
            ["--dr" as any]: `${d.rot}deg`,
            animation: `crashDebris ${d.dur}s cubic-bezier(0.36,0,0.66,1) ${d.delay}s forwards`,
          }} />
        );
      })}
      {/* Sparks */}
      {sparks.map(p => {
        const dx = Math.cos(p.angle * Math.PI / 180) * p.dist;
        const dy = Math.sin(p.angle * Math.PI / 180) * p.dist;
        return (
          <div key={`p${p.id}`} style={{
            position: "absolute", left: "50%", top: "50%",
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: "50%",
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            ["--dx" as any]: `${dx}px`,
            ["--dy" as any]: `${dy}px`,
            animation: `crashSpark ${p.dur}s ease-out forwards`,
          }} />
        );
      })}
    </div>
  );
}

// ── Falling token particles while rocket rises ──
export function FallingTokens({ logoUrl, intensity }: { logoUrl: string; intensity: number }) {
  const count = Math.min(Math.floor(intensity * 6), 18);
  const tokens = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: 5 + (i * 37 + 13) % 90,
      delay: (i * 0.7 + Math.sin(i * 2.1) * 0.5) % 4,
      duration: 2.2 + (i % 5) * 0.6,
      size: 12 + (i % 4) * 4,
      opacity: 0.15 + (i % 3) * 0.12,
      wobble: (i % 2 === 0 ? 1 : -1) * (8 + (i % 6) * 4),
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      <style>{`
        @keyframes tokenFall {
          0% { transform: translateY(-30px) rotate(0deg) translateX(0px); opacity: 0; }
          10% { opacity: var(--tk-opacity); }
          50% { transform: translateY(50%) rotate(180deg) translateX(var(--tk-wobble)); }
          90% { opacity: var(--tk-opacity); }
          100% { transform: translateY(calc(100% + 40px)) rotate(360deg) translateX(calc(var(--tk-wobble) * -0.5)); opacity: 0; }
        }
      `}</style>
      {tokens.slice(0, count).map((t) => (
        <div
          key={t.id}
          className="absolute rounded-full overflow-hidden"
          style={{
            left: `${t.left}%`,
            top: 0,
            width: t.size,
            height: t.size,
            ['--tk-opacity' as string]: t.opacity,
            ['--tk-wobble' as string]: `${t.wobble}px`,
            animation: `tokenFall ${t.duration}s ${t.delay}s ease-in infinite`,
            filter: 'blur(0.3px)',
          }}
        >
          <img src={logoUrl} alt="" width={t.size} height={t.size} className="w-full h-full object-cover rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Pendulum token that swings from rocket nose ──
export function PendulumToken({ logoUrl, multiplier }: { logoUrl: string; multiplier: number }) {
  const swingSpeed = Math.max(0.5, 1.8 - multiplier * 0.12);
  const swingAngle = Math.min(40, 15 + multiplier * 3);
  const ropeLen = 14 + Math.min(multiplier * 2, 10);

  return (
    <div className="absolute z-20" style={{
      left: '50%',
      top: 0,
      transformOrigin: 'top center',
    }}>
      <style>{`
        @keyframes pendulumSwing {
          0% { transform: translateX(-50%) rotate(calc(var(--swing-angle) * -1deg)); }
          50% { transform: translateX(-50%) rotate(calc(var(--swing-angle) * 1deg)); }
          100% { transform: translateX(-50%) rotate(calc(var(--swing-angle) * -1deg)); }
        }
      `}</style>
      <div
        style={{
          ['--swing-angle' as string]: swingAngle,
          transformOrigin: 'top center',
          animation: `pendulumSwing ${swingSpeed}s ease-in-out infinite`,
          transform: 'translateX(-50%)',
        }}
      >
        {/* Rope */}
        <div style={{
          width: 2,
          height: ropeLen,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(16,185,129,0.8))',
          margin: '0 auto',
          borderRadius: 1,
          boxShadow: '0 0 6px rgba(16,185,129,0.4)',
        }} />
        {/* Token coin */}
        <div
          className="rounded-full overflow-hidden border-2 border-emerald-400/80 shadow-lg shadow-emerald-500/60"
          style={{
            width: 26,
            height: 26,
            marginTop: 0,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <img src={logoUrl} alt="" width={26} height={26} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

// ── Launch Platform SVG ──
export function LaunchPlatform() {
  return (
    <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
      {/* Base platform */}
      <rect x="10" y="40" width="100" height="8" rx="2" fill="url(#platGrad)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      {/* Platform top surface highlight */}
      <rect x="12" y="40" width="96" height="2" rx="1" fill="rgba(255,255,255,0.08)" />
      {/* Support legs */}
      <rect x="20" y="48" width="6" height="12" rx="1" fill="#334" />
      <rect x="94" y="48" width="6" height="12" rx="1" fill="#334" />
      <rect x="55" y="48" width="10" height="12" rx="1" fill="#2a2e3a" />
      {/* Launch rail left */}
      <rect x="30" y="20" width="3" height="22" rx="1" fill="#445566" />
      <rect x="30" y="18" width="3" height="4" rx="1.5" fill="#ff4466" />
      {/* Launch rail right */}
      <rect x="87" y="20" width="3" height="22" rx="1" fill="#445566" />
      <rect x="87" y="18" width="3" height="4" rx="1.5" fill="#ff4466" />
      {/* Warning stripes */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={25 + i * 16} y="42" width="8" height="2" rx="0.5" fill="rgba(255,200,0,0.15)" />
      ))}
      {/* Steam/smoke vents */}
      <circle cx="40" cy="38" r="2" fill="rgba(255,255,255,0.03)">
        <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.06;0.02;0.06" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="80" cy="38" r="2" fill="rgba(255,255,255,0.03)">
        <animate attributeName="r" values="2;3.5;2" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.05;0.02;0.05" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* Status lights */}
      <circle cx="25" y="" cy="35" r="1.5" fill="#00ff88" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="95" cy="35" r="1.5" fill="#00ff88" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
      </circle>
      <defs>
        <linearGradient id="platGrad" x1="10" y1="40" x2="110" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2a3040" />
          <stop offset="0.5" stopColor="#3a4050" />
          <stop offset="1" stopColor="#2a3040" />
        </linearGradient>
      </defs>
    </svg>
  );
}
