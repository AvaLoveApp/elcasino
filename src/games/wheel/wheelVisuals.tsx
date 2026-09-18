// Wheel visuals + audio — ported 1:1 from Avlo's wheel page.
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

const SEGMENT_COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ── Sound FX ──
let audioCtx: AudioContext | null = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function playSound(type: "spin" | "tick" | "win" | "lose") {
  try {
    const ctx = getAudioCtx(); const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    switch (type) {
      case "spin":
        osc.type = "triangle"; osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5); break;
      case "tick":
        osc.type = "sine"; osc.frequency.setValueAtTime(1200 + Math.random() * 300, now);
        gain.gain.setValueAtTime(0.025, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now); osc.stop(now + 0.03); break;
      case "win": {
        // Triumphant ascending arpeggio C-E-G-C + sparkle
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "triangle";
          const t = now + i * 0.08;
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.12, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          o.start(t); o.stop(t + 0.5);
        });
        const sparkle = ctx.createOscillator(); const sg = ctx.createGain();
        sparkle.connect(sg); sg.connect(ctx.destination);
        sparkle.type = "sine"; sparkle.frequency.setValueAtTime(2093, now + 0.36);
        sg.gain.setValueAtTime(0.06, now + 0.36); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        sparkle.start(now + 0.36); sparkle.stop(now + 0.85);
        break;
      }
      case "lose": {
        // Sub-bass thump + filtered noise burst (deflated woomph)
        osc.type = "sine"; osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
        gain.gain.setValueAtTime(0.22, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.45, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const decay = Math.pow(1 - i / data.length, 2.2);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const ng = ctx.createGain(); const filter = ctx.createBiquadFilter();
        filter.type = "lowpass"; filter.frequency.setValueAtTime(1400, now); filter.frequency.exponentialRampToValueAtTime(140, now + 0.4);
        noise.connect(filter); filter.connect(ng); ng.connect(ctx.destination);
        ng.gain.setValueAtTime(0.16, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        noise.start(now); noise.stop(now + 0.45);
        // Descending sad horn
        const sad = ctx.createOscillator(); const sg = ctx.createGain();
        sad.connect(sg); sg.connect(ctx.destination);
        sad.type = "sawtooth"; sad.frequency.setValueAtTime(440, now + 0.05);
        sad.frequency.exponentialRampToValueAtTime(160, now + 0.55);
        sg.gain.setValueAtTime(0.06, now + 0.05); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        sad.start(now + 0.05); sad.stop(now + 0.6);
        break;
      }
    }
  } catch {}
}

// ── Enhanced audio helpers for wheel ──
function playDeflectorHit() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator();
    const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ctx.destination);
    f.type = "bandpass"; f.frequency.value = 3000 + Math.random() * 2000; f.Q.value = 8;
    o1.frequency.value = 2800 + Math.random() * 800; o1.type = "triangle";
    o2.frequency.value = 4200 + Math.random() * 600; o2.type = "square";
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o1.start(t); o1.stop(t + 0.06); o2.start(t); o2.stop(t + 0.06);
  } catch {}
}

function playPocketBounce() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
    const ng = ctx.createGain();
    src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0.12, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    src.start(t); src.stop(t + 0.03);
    const o = ctx.createOscillator(); const og = ctx.createGain();
    o.connect(og); og.connect(ctx.destination);
    o.frequency.setValueAtTime(280 + Math.random() * 80, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.06); o.type = "sine";
    og.gain.setValueAtTime(0.07, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.start(t); o.stop(t + 0.08);
    const o2x = ctx.createOscillator(); const og2 = ctx.createGain();
    o2x.connect(og2); og2.connect(ctx.destination);
    o2x.frequency.value = 3200 + Math.random() * 800; o2x.type = "sine";
    og2.gain.setValueAtTime(0.03, t); og2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o2x.start(t); o2x.stop(t + 0.06);
  } catch {}
}

function playBallDropFX() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const delays = [0, 0.04, 0.075, 0.1, 0.12, 0.135];
    delays.forEach((dt, i) => {
      const decay = 1 - i / delays.length;
      const bLen = Math.floor(ctx.sampleRate * (0.015 * decay + 0.003));
      const buf = ctx.createBuffer(1, bLen, ctx.sampleRate);
      const bd = buf.getChannelData(0);
      for (let j = 0; j < bLen; j++) bd[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bLen * 0.12));
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = 1200 + i * 300; bp.Q.value = 1.5;
      const ng = ctx.createGain();
      src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.09 * decay, t + dt);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.03 * decay + 0.005);
      src.start(t + dt); src.stop(t + dt + 0.04 * decay + 0.005);
      if (i < 3) {
        const o = ctx.createOscillator(); const og = ctx.createGain();
        o.connect(og); og.connect(ctx.destination);
        o.frequency.setValueAtTime(220 - i * 40, t + dt);
        o.frequency.exponentialRampToValueAtTime(80, t + dt + 0.04); o.type = "sine";
        og.gain.setValueAtTime(0.06 * decay, t + dt);
        og.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.045);
        o.start(t + dt); o.stop(t + dt + 0.05);
      }
    });
  } catch {}
}

function playPointerTing() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.008);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.2));
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const ng = ctx.createGain();
    ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    ns.start(t); ns.stop(t + 0.015);
    const o = ctx.createOscillator(); const og = ctx.createGain();
    o.connect(og); og.connect(ctx.destination);
    o.frequency.value = 2200 + Math.random() * 600; o.type = "sine";
    og.gain.setValueAtTime(0.025, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    o.start(t); o.stop(t + 0.04);
  } catch {}
}

function playWinFanfare() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.07, t + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
      o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.3);
    });
  } catch {}
}

let rollingNoise: { source: AudioBufferSourceNode; gain: GainNode; extras: any[] } | null = null;
function startRollingNoise() {
  try {
    if (rollingNoise) return;
    const ctx = getAudioCtx();
    const bufLen = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.4);
    master.connect(ctx.destination);
    const s1 = ctx.createBufferSource(); s1.buffer = buf; s1.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 350; lp.Q.value = 0.7;
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    s1.connect(lp); lp.connect(g1); g1.connect(master); s1.start();
    const s2 = ctx.createBufferSource(); s2.buffer = buf; s2.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2.0;
    const g2x = ctx.createGain(); g2x.gain.value = 0.35;
    s2.connect(bp); bp.connect(g2x); g2x.connect(master); s2.start();
    const s3 = ctx.createBufferSource(); s3.buffer = buf; s3.loop = true;
    const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 3500; hpf.Q.value = 0.5;
    const g3 = ctx.createGain(); g3.gain.value = 0.12;
    s3.connect(hpf); hpf.connect(g3); g3.connect(master); s3.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.08;
    lfo.connect(lfoG); lfoG.connect(g2x.gain); lfo.start();
    rollingNoise = { source: s1, gain: master, extras: [s2, s3, lfo] };
  } catch {}
}
function stopRollingNoise() {
  try {
    if (!rollingNoise) return;
    const ctx = getAudioCtx();
    rollingNoise.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    const r = rollingNoise;
    setTimeout(() => { try { r.source.stop(); r.extras.forEach(s => { try { s.stop(); } catch {} }); } catch {} }, 600);
    rollingNoise = null;
  } catch {}
}
function setRollingVol(vol: number) {
  try {
    if (!rollingNoise) return;
    const ctx = getAudioCtx();
    rollingNoise.gain.gain.linearRampToValueAtTime(Math.max(0.001, vol), ctx.currentTime + 0.05);
  } catch {}
}

// ── Win/Lose Particles ──
export function WheelParticles({ type }: { type: "win" | "lose" | "bigwin" }) {
  const colors = type === "win" ? ["#22c55e", "#4ade80", "#86efac", "#fbbf24"] : type === "bigwin" ? ["#fbbf24", "#f59e0b", "#facc15", "#a855f7", "#22c55e"] : ["#ef4444", "#f87171", "#fca5a5"];
  const count = type === "bigwin" ? 40 : type === "win" ? 24 : 12;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360 + Math.random() * 20;
        const dist = 80 + Math.random() * 200;
        const size = 3 + Math.random() * 6;
        const dur = 0.6 + Math.random() * 0.8;
        const color = colors[i % colors.length];
        return (
          <motion.div key={i}
            className="absolute rounded-full"
            style={{ width: size, height: size, background: color, left: "50%", top: "50%", boxShadow: `0 0 ${size * 2}px ${color}` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle * Math.PI / 180) * dist, y: Math.sin(angle * Math.PI / 180) * dist, opacity: 0, scale: 0 }}
            transition={{ duration: dur, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

// ── Wheel Visual — Fortune Wheel Style (2D, no ball) ──
const WHEEL_SIZE = 420;
const WHEEL_CX = WHEEL_SIZE / 2;
const WHEEL_CY = WHEEL_SIZE / 2;
const OUTER_R = 195;
const SEGMENT_R = 185;
const INNER_R = 60;

export function WheelVisual({ segments, resultSegment, isSpinning, onLand }: {
  segments: number[];
  resultSegment: number | null;
  isSpinning: boolean;
  onLand?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const wheelAngle = useRef(0);
  const animRef = useRef<number>();
  const landedRef = useRef(false);
  const animating = useRef(false);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const pointerBounce = useRef(0);

  const segCount = segments.length || 10;
  const segAngle = 360 / segCount;

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const segCountRef = useRef(segCount);
  segCountRef.current = segCount;

  // ─── Draw wheel on canvas ───
  const drawWheel = useRef((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);
    ctx.save();
    ctx.translate(WHEEL_CX, WHEEL_CY);
    ctx.rotate((angle * Math.PI) / 180);

    const sc = segCountRef.current;
    const segs = segmentsRef.current;
    const sa = (2 * Math.PI) / sc;

    // Outer metallic ring
    const ringGrad = ctx.createRadialGradient(0, 0, SEGMENT_R, 0, 0, OUTER_R);
    ringGrad.addColorStop(0, "#3a3a4a");
    ringGrad.addColorStop(0.3, "#5a5a6a");
    ringGrad.addColorStop(0.6, "#4a4a5a");
    ringGrad.addColorStop(1, "#2a2a3a");
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R, 0, Math.PI * 2);
    ctx.arc(0, 0, SEGMENT_R, 0, Math.PI * 2, true);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // Gold trim on outer edge
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ─── Colored segments ───
    for (let i = 0; i < sc; i++) {
      const startA = i * sa - Math.PI / 2;
      const endA = startA + sa;
      const baseColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

      // Segment fill with gradient
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SEGMENT_R, startA, endA);
      ctx.closePath();
      const midA = (startA + endA) / 2;
      const gx = Math.cos(midA) * SEGMENT_R * 0.5;
      const gy = Math.sin(midA) * SEGMENT_R * 0.5;
      const sg = ctx.createRadialGradient(gx, gy, 0, 0, 0, SEGMENT_R);
      sg.addColorStop(0, baseColor + "ff");
      sg.addColorStop(0.6, baseColor + "dd");
      sg.addColorStop(1, baseColor + "99");
      ctx.fillStyle = sg;
      ctx.fill();

      // Segment border
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(startA) * SEGMENT_R, Math.sin(startA) * SEGMENT_R);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Multiplier label — big, bold, inverse-color of the segment for harmony
      const textMidA = startA + sa / 2;
      const textR = SEGMENT_R * 0.74;
      ctx.save();
      ctx.translate(Math.cos(textMidA) * textR, Math.sin(textMidA) * textR);
      ctx.rotate(textMidA + Math.PI / 2);
      const fontSize = sc > 12 ? 23 : sc > 8 ? 30 : 36;
      ctx.font = `900 ${fontSize}px 'Arial Black', 'Impact', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const mult = (segs[i] / 100).toFixed(1) + "x";
      // Compute inverse color of segment (255 - r/g/b)
      const hex = baseColor.replace("#", "");
      const br = parseInt(hex.slice(0, 2), 16);
      const bg = parseInt(hex.slice(2, 4), 16);
      const bb = parseInt(hex.slice(4, 6), 16);
      const ir = 255 - br, ig = 255 - bg, ib = 255 - bb;
      const invHex = `#${ir.toString(16).padStart(2,"0")}${ig.toString(16).padStart(2,"0")}${ib.toString(16).padStart(2,"0")}`;
      // Lighter & darker variants for gradient
      const lighten = (v: number, p: number) => Math.min(255, Math.round(v + (255 - v) * p));
      const darken = (v: number, p: number) => Math.max(0, Math.round(v * (1 - p)));
      const invLight = `#${lighten(ir, 0.55).toString(16).padStart(2,"0")}${lighten(ig, 0.55).toString(16).padStart(2,"0")}${lighten(ib, 0.55).toString(16).padStart(2,"0")}`;
      const invDark = `#${darken(ir, 0.4).toString(16).padStart(2,"0")}${darken(ig, 0.4).toString(16).padStart(2,"0")}${darken(ib, 0.4).toString(16).padStart(2,"0")}`;
      // Soft drop shadow under text
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      // Heavy dark outline for contrast on any segment color
      ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
      ctx.lineWidth = Math.max(4, fontSize * 0.18);
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(mult, 0, 0);
      // Reset shadow before fill so the gradient text stays crisp
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      // Vertical inverse-color gradient fill
      const tg = ctx.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.55);
      tg.addColorStop(0, invLight);
      tg.addColorStop(0.5, invHex);
      tg.addColorStop(1, invDark);
      ctx.fillStyle = tg;
      ctx.fillText(mult, 0, 0);
      // Subtle highlight pass on top half
      ctx.save();
      ctx.beginPath();
      ctx.rect(-fontSize * 1.5, -fontSize, fontSize * 3, fontSize * 0.45);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText(mult, 0, 0);
      ctx.restore();
      // Outer glow halo in inverse hue
      ctx.shadowColor = invHex;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeText(mult, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Inner ring border
    ctx.beginPath();
    ctx.arc(0, 0, SEGMENT_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(212,184,90,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Peg dots on outer ring between segments
    for (let i = 0; i < sc; i++) {
      const pegA = i * sa - Math.PI / 2;
      const px = Math.cos(pegA) * (SEGMENT_R + 3);
      const py = Math.sin(pegA) * (SEGMENT_R + 3);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      const pegGrad = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 3);
      pegGrad.addColorStop(0, "#f0e8c0");
      pegGrad.addColorStop(0.5, "#d4b85a");
      pegGrad.addColorStop(1, "#8a6e30");
      ctx.fillStyle = pegGrad;
      ctx.fill();
    }

    // Center hub
    const hubGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, INNER_R);
    hubGrad.addColorStop(0, "#2a2a35");
    hubGrad.addColorStop(0.5, "#1e1e2a");
    hubGrad.addColorStop(1, "#141420");
    ctx.beginPath();
    ctx.arc(0, 0, INNER_R, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, INNER_R, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center emblem
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    const embGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 22);
    embGrad.addColorStop(0, "#e8d070");
    embGrad.addColorStop(0.5, "#c8a84e");
    embGrad.addColorStop(1, "#8a6e30");
    ctx.fillStyle = embGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a28";
    ctx.fill();

    // "SPIN" text in center
    ctx.font = "bold 10px 'Courier New', monospace";
    ctx.fillStyle = "#d4b85a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", 0, 0);

    ctx.restore();
  }).current;

  // Initial draw
  useEffect(() => { drawWheel(wheelAngle.current); }, [segments]);

  // ─── Update pointer spring ───
  const updatePointer = useRef(() => {
    const ptr = pointerRef.current;
    if (!ptr) return;
    if (pointerBounce.current > 0.01) {
      pointerBounce.current *= 0.82;
      const deg = pointerBounce.current * 12;
      ptr.style.transform = `translateX(-50%) rotate(${-deg}deg)`;
    } else {
      pointerBounce.current = 0;
      ptr.style.transform = "translateX(-50%) rotate(0deg)";
    }
  }).current;

  const bouncePointerFn = useRef(() => {
    pointerBounce.current = 1;
    playPointerTing();
  }).current;

  // ─── Idle spin (while waiting for result) ───
  useEffect(() => {
    if (!isSpinning) return;
    if (animating.current) return;

    let angle = wheelAngle.current;
    let lastPointerSeg = -1;

    startRollingNoise();

    const loop = () => {
      angle += 4;
      wheelAngle.current = angle;
      drawWheel(angle);
      updatePointer();

      // Pointer bounce when peg passes top
      const wheelDeg = ((angle % 360) + 360) % 360;
      const curSeg = Math.floor(wheelDeg / segAngle);
      if (curSeg !== lastPointerSeg) {
        lastPointerSeg = curSeg;
        bouncePointerFn();
      }

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopRollingNoise();
    };
  }, [isSpinning]);

  // ─── Landing animation (decelerate to target segment) ───
  useEffect(() => {
    if (isSpinning || resultSegment === null || landedRef.current) return;
    landedRef.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animating.current = true;

    // Target: pointer at top (270deg in canvas coords), pointing to middle of resultSegment
    // Wheel needs to rotate so segment center aligns with top (270deg / -90deg direction)
    const segCenterDeg = resultSegment * segAngle + segAngle / 2;
    // The top of the wheel is at -90deg (or 270deg). We draw segments starting at -90deg, 
    // so segment 0 center when wheel angle=0 is at visual top + segAngle/2.
    // To land on resultSegment, the pointer (at top) needs to point at: 360 - segCenterDeg 
    const targetMod = ((360 - segCenterDeg) % 360 + 360) % 360;
    const startAngle = wheelAngle.current;
    const startMod = ((startAngle % 360) + 360) % 360;
    const extra = ((targetMod - startMod) % 360 + 360) % 360;
    const totalDist = extra + 360 * 4; // 4 full extra spins for dramatic effect

    const duration = 4500;
    const startTime = performance.now();
    let lastPSeg = -1;

    startRollingNoise();

    const anim = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Cubic ease-out: strong deceleration
      const ease = 1 - Math.pow(1 - t, 3);
      const curAngle = startAngle + totalDist * ease;
      wheelAngle.current = curAngle;
      drawWheel(curAngle);
      updatePointer();

      // Rolling volume fades
      const vol = t < 0.8 ? 0.035 * (1 - t * 0.8) : 0.001;
      setRollingVol(vol);

      // Pointer bounce when peg passes
      const wheelDeg = ((curAngle % 360) + 360) % 360;
      const curSeg = Math.floor(wheelDeg / segAngle);
      if (curSeg !== lastPSeg) {
        lastPSeg = curSeg;
        bouncePointerFn();
      }

      if (elapsed < duration) {
        animRef.current = requestAnimationFrame(anim);
      } else {
        stopRollingNoise();
        playBallDropFX();
        setTimeout(() => {
          animating.current = false;
          onLandRef.current?.();
        }, 400);
      }
    };

    animRef.current = requestAnimationFrame(anim);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopRollingNoise();
    };
  }, [isSpinning, resultSegment, segCount, segAngle]);

  // Reset landedRef when spin starts
  useEffect(() => {
    if (isSpinning) {
      landedRef.current = false;
      animating.current = false;
    }
  }, [isSpinning]);

  // Draw initial state when idle with no result
  useEffect(() => {
    if (isSpinning) return;
    if (resultSegment !== null) return;
    drawWheel(0);
    wheelAngle.current = 0;
  }, [isSpinning, resultSegment]);

  return (
    <div className="relative mx-auto select-none" style={{ width: WHEEL_SIZE + 20, height: WHEEL_SIZE + 40 }}>
      {/* Pointer at the top – base fixed, tip pointing down */}
      <div
        ref={pointerRef}
        className="absolute left-1/2 z-30"
        style={{
          top: -6,
          transform: "translateX(-50%) rotate(0deg)",
          transformOrigin: "50% 0%",
          width: 40,
          height: 56,
        }}
      >
        <svg width="40" height="56" viewBox="0 0 40 56" className="absolute top-0 left-0" style={{ filter: "drop-shadow(0 4px 12px rgba(0,255,136,0.3)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5))" }}>
          <defs>
            <linearGradient id="wPtrGrad2" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#2a2a3e" />
              <stop offset="40%" stopColor="#1a1a2e" />
              <stop offset="100%" stopColor="#0d0d1a" />
            </linearGradient>
            <linearGradient id="wPtrEdge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#00cc6a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00ff88" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="wPtrShine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {/* Main pointer body – wide base at top, sharp tip at bottom */}
          <path d="M8 0 L32 0 Q34 0 34 2 L22 50 Q20 56 18 50 L6 2 Q6 0 8 0 Z" fill="url(#wPtrGrad2)" />
          {/* Neon edge glow */}
          <path d="M8 0 L32 0 Q34 0 34 2 L22 50 Q20 56 18 50 L6 2 Q6 0 8 0 Z" fill="none" stroke="url(#wPtrEdge)" strokeWidth="1.5" />
          {/* Inner highlight strip */}
          <path d="M12 4 L28 4 L21 44 Q20 48 19 44 L12 4 Z" fill="url(#wPtrShine)" />
          {/* Center accent line */}
          <line x1="20" y1="8" x2="20" y2="42" stroke="#00ff88" strokeWidth="0.8" strokeOpacity="0.35" />
          {/* Mounting dot at base */}
          <circle cx="20" cy="4" r="2.5" fill="#0d0d1a" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.6" />
        </svg>
      </div>

      {/* Glow behind wheel */}
      <div className="absolute inset-0 rounded-full" style={{
        top: 10, left: 10, width: WHEEL_SIZE, height: WHEEL_SIZE,
        boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 120px rgba(0,0,0,0.3)",
        borderRadius: "50%",
      }} />

      {/* Outer decorative ring */}
      <div className="absolute rounded-full" style={{
        top: 4, left: 4, width: WHEEL_SIZE + 12, height: WHEEL_SIZE + 12,
        border: "3px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.5), 0 8px 30px rgba(0, 0, 0, 0.6)",
      }} />

      {/* Canvas wheel */}
      <canvas ref={canvasRef} width={WHEEL_SIZE} height={WHEEL_SIZE}
        className="absolute rounded-full"
        style={{ top: 10, left: 10, filter: "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.4))" }}
      />
    </div>
  );
}
