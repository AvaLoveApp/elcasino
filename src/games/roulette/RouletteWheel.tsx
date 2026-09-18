import { useRef, useEffect, useCallback, useState } from "react";
import { WHEEL_NUMBERS, getNumberColor } from "./rouletteConstants";

interface RouletteWheelProps {
  result: number | null;
  spinning: boolean;
  onSpinComplete?: () => void;
}

const TOTAL = 37;
const SEG = 360 / TOTAL;

export function RouletteWheel({ result, spinning, onSpinComplete }: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const idleRaf = useRef<number>(0);
  const ballRaf = useRef<number>(0);
  const idleBallAngle = useRef<number>(0);
  const wheelAngle = useRef<number>(0);
  const landedBallPos = useRef<{ x: number; y: number } | null>(null);
  const [landed, setLanded] = useState(false);
  const animating = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;
  const pointerBounce = useRef(0);
  const deflectorFlash = useRef<number[]>(new Array(8).fill(0));
  const rollingNoiseRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);

  const SIZE = 440;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = 188;
  const POCKET_R = 155;
  const INNER_R = 120;
  const HUB_R = 40;
  const BALL_ORBIT_R = 168;
  const BALL_POCKET_R = 138;
  const BALL_SIZE = 20;
  const HALF_BALL = BALL_SIZE / 2;

  // ─── audio helpers (realistic casino sounds) ───
  const getAudio = useCallback(() => {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    return audioCtx.current;
  }, []);

  // Metallic deflector hit — short sharp "clink"
  const playDeflectorHit = useCallback(() => {
    try {
      const ctx = getAudio();
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      filter.type = "bandpass";
      filter.frequency.value = 3000 + Math.random() * 2000;
      filter.Q.value = 8;
      o1.frequency.value = 2800 + Math.random() * 800;
      o1.type = "triangle";
      o2.frequency.value = 4200 + Math.random() * 600;
      o2.type = "square";
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o1.start(t); o1.stop(t + 0.06);
      o2.start(t); o2.stop(t + 0.06);
    } catch {/* */}
  }, [getAudio]);

  // Ball rolling sound — layered: low rumble + mid friction + high shimmer (like ivory on chrome)
  const startRollingSound = useCallback(() => {
    try {
      if (rollingNoiseRef.current) return;
      const ctx = getAudio();
      // Create noise buffer
      const bufLen = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.4);
      master.connect(ctx.destination);

      // Layer 1: low rumble (ball weight on track)
      const s1 = ctx.createBufferSource();
      s1.buffer = buf; s1.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 350; lp.Q.value = 0.7;
      const g1 = ctx.createGain(); g1.gain.value = 0.5;
      s1.connect(lp); lp.connect(g1); g1.connect(master);
      s1.start();

      // Layer 2: mid friction (main character)
      const s2 = ctx.createBufferSource();
      s2.buffer = buf; s2.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2.0;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      s2.connect(bp); bp.connect(g2); g2.connect(master);
      s2.start();

      // Layer 3: high shimmer (ball surface detail)
      const s3 = ctx.createBufferSource();
      s3.buffer = buf; s3.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 3500; hp.Q.value = 0.5;
      const g3 = ctx.createGain(); g3.gain.value = 0.12;
      s3.connect(hp); hp.connect(g3); g3.connect(master);
      s3.start();

      // Subtle LFO on mid-band for rhythmic "rolling" feel
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain);
      lfoGain.connect(g2.gain);
      lfo.start();

      rollingNoiseRef.current = { source: s1, gain: master, _extras: [s2, s3, lfo] } as any;
    } catch {/* */}
  }, [getAudio]);

  const stopRollingSound = useCallback(() => {
    try {
      const r = rollingNoiseRef.current as any;
      if (!r) return;
      const ctx = getAudio();
      r.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        try {
          r.source.stop();
          if (r._extras) r._extras.forEach((s: any) => { try { s.stop(); } catch {/* */} });
        } catch {/* */}
      }, 600);
      rollingNoiseRef.current = null;
    } catch {/* */}
  }, [getAudio]);

  const setRollingVolume = useCallback((vol: number) => {
    try {
      const r = rollingNoiseRef.current;
      if (!r) return;
      const ctx = getAudio();
      r.gain.gain.linearRampToValueAtTime(Math.max(0.001, vol), ctx.currentTime + 0.05);
    } catch {/* */}
  }, [getAudio]);

  // Pocket bounce — ball hitting metal fret divider (sharp "tik" with metallic ring)
  const playPocketBounce = useCallback(() => {
    try {
      const ctx = getAudio();
      const t = ctx.currentTime;
      // Sharp impact transient (noise burst through high-pass)
      const bufSize = Math.floor(ctx.sampleRate * 0.012);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 1800;
      const ng = ctx.createGain();
      src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      src.start(t); src.stop(t + 0.03);
      // Ball body tone (ball resonance on impact — low thud)
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.connect(og); og.connect(ctx.destination);
      o.frequency.setValueAtTime(280 + Math.random() * 80, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.06);
      o.type = "sine";
      og.gain.setValueAtTime(0.07, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.start(t); o.stop(t + 0.08);
      // Metal fret ring
      const o2 = ctx.createOscillator();
      const og2 = ctx.createGain();
      o2.connect(og2); og2.connect(ctx.destination);
      o2.frequency.value = 3200 + Math.random() * 800;
      o2.type = "sine";
      og2.gain.setValueAtTime(0.03, t);
      og2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o2.start(t); o2.stop(t + 0.06);
    } catch {/* */}
  }, [getAudio]);

  // Ball settles into pocket — rapid small bounces getting quieter (ball rattling to rest)
  const playBallDrop = useCallback(() => {
    try {
      const ctx = getAudio();
      const t = ctx.currentTime;
      // Sequence of 6 rapid micro-impacts, decreasing in volume and pitch (ball settling)
      const delays = [0, 0.04, 0.075, 0.1, 0.12, 0.135];
      delays.forEach((dt, i) => {
        const decay = 1 - i / delays.length;
        // Impact noise burst
        const bLen = Math.floor(ctx.sampleRate * (0.015 * decay + 0.003));
        const buf = ctx.createBuffer(1, bLen, ctx.sampleRate);
        const bd = buf.getChannelData(0);
        for (let j = 0; j < bLen; j++) bd[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bLen * 0.12));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1200 + i * 300; // shifts higher as bounces get smaller
        bp.Q.value = 1.5;
        const ng = ctx.createGain();
        src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
        ng.gain.setValueAtTime(0.09 * decay, t + dt);
        ng.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.03 * decay + 0.005);
        src.start(t + dt); src.stop(t + dt + 0.04 * decay + 0.005);
        // Low body thud for first 3 bounces
        if (i < 3) {
          const o = ctx.createOscillator();
          const og = ctx.createGain();
          o.connect(og); og.connect(ctx.destination);
          o.frequency.setValueAtTime(220 - i * 40, t + dt);
          o.frequency.exponentialRampToValueAtTime(80, t + dt + 0.04);
          o.type = "sine";
          og.gain.setValueAtTime(0.06 * decay, t + dt);
          og.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.045);
          o.start(t + dt); o.stop(t + dt + 0.05);
        }
      });
    } catch {/* */}
  }, [getAudio]);

  // Win fanfare
  const playWin = useCallback(() => {
    try {
      const ctx = getAudio();
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = "sine";
        g.gain.setValueAtTime(0.07, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.3);
      });
    } catch {/* */}
  }, [getAudio]);

  // Pointer click — short metallic tick as pin flicks the pointer tip
  const playPointerTing = useCallback(() => {
    try {
      const ctx = getAudio();
      const t = ctx.currentTime;
      // Impact click (short noise burst)
      const bufLen = Math.floor(ctx.sampleRate * 0.008);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.2));
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 2500;
      const ng = ctx.createGain();
      ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
      ng.gain.setValueAtTime(0.06, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      ns.start(t); ns.stop(t + 0.015);
      // Metal ring overtone
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.connect(og); og.connect(ctx.destination);
      o.frequency.value = 2200 + Math.random() * 600;
      o.type = "sine";
      og.gain.setValueAtTime(0.025, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      o.start(t); o.stop(t + 0.04);
    } catch {/* */}
  }, [getAudio]);

  // Bounce pointer
  const bouncePointer = useCallback(() => {
    pointerBounce.current = 1;
    playPointerTing();
  }, [playPointerTing]);

  // helper: draw one diamond pin at (pinAngle rad, radius r) in current ctx transform
  const drawPin = (ctx: CanvasRenderingContext2D, pinAngle: number, baseR: number, tipR: number, halfW: number) => {
    const rx = Math.cos(pinAngle), ry = Math.sin(pinAngle);
    const tx = -ry, ty = rx;
    const bx = rx * baseR, by = ry * baseR;
    const tipX = rx * tipR, tipY = ry * tipR;
    const midR = (baseR + tipR) / 2;
    const lx = rx * midR + tx * halfW, ly = ry * midR + ty * halfW;
    const rrx = rx * midR - tx * halfW, rry = ry * midR - ty * halfW;
    // shadow
    ctx.beginPath();
    ctx.moveTo(bx+1,by+1); ctx.lineTo(lx+1,ly+1); ctx.lineTo(tipX+1,tipY+1); ctx.lineTo(rrx+1,rry+1);
    ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
    // left face
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(lx,ly); ctx.lineTo(tipX,tipY); ctx.closePath();
    ctx.fillStyle = "#d0d0d0"; ctx.fill();
    // right face
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(rrx,rry); ctx.lineTo(tipX,tipY); ctx.closePath();
    ctx.fillStyle = "#787878"; ctx.fill();
    // outline
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(lx,ly); ctx.lineTo(tipX,tipY); ctx.lineTo(rrx,rry); ctx.closePath();
    ctx.strokeStyle = "rgba(180,180,180,0.4)"; ctx.lineWidth = 0.5; ctx.stroke();
    // highlight
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(tipX,tipY);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 0.7; ctx.stroke();
    // tip dot
    ctx.beginPath(); ctx.arc(tipX,tipY,1.0,0,Math.PI*2); ctx.fillStyle = "#e8e8e8"; ctx.fill();
  };

  // ─── draw wheel on canvas ───
  // `moving` = true for animation frames (idle spin + landing decel). While the
  // wheel is spinning we skip the two most expensive per-frame canvas ops — the
  // 37 per-pocket radial gradients and the 37 shadow-blurred number labels — and
  // fall back to flat fills / no shadow. At speed the motion blur hides the
  // difference, but it turns a ~45-gradient + 37-shadowBlur redraw into cheap
  // solid fills, which is what stops the low-FPS "stutter/freeze" during a spin.
  // The final resting frame (moving=false) draws at full quality.
  const drawWheel = useCallback((angle: number, moving = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // ═══════════════════════════════════════════
    // PASS 1 — ROTATING INNER DISC (numbers)
    // ═══════════════════════════════════════════
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate((angle * Math.PI) / 180);

    // ─── Fret pins on rotating disc outer edge ───
    for (let i = 0; i < TOTAL; i++) {
      const pinAngle = (i * SEG - 90) * (Math.PI / 180);
      const baseR = POCKET_R - 5;
      const tipR  = POCKET_R + 2;
      const halfW = 2.4;

      const rx = Math.cos(pinAngle);
      const ry = Math.sin(pinAngle);
      const tx = -ry;
      const ty =  rx;

      const bx   = rx * baseR;
      const by   = ry * baseR;
      const tipX = rx * tipR;
      const tipY = ry * tipR;
      const midR = (baseR + tipR) / 2;
      const lx   = rx * midR + tx * halfW;
      const ly   = ry * midR + ty * halfW;
      const rrx  = rx * midR - tx * halfW;
      const rry  = ry * midR - ty * halfW;

      // Shadow
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 1);
      ctx.lineTo(lx + 1, ly + 1);
      ctx.lineTo(tipX + 1, tipY + 1);
      ctx.lineTo(rrx + 1, rry + 1);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fill();
      ctx.restore();

      // Left face
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(lx, ly); ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = "#d0d0d0";
      ctx.fill();

      // Right face
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(rrx, rry); ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = "#787878";
      ctx.fill();

      // Outline
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(lx, ly); ctx.lineTo(tipX, tipY); ctx.lineTo(rrx, rry);
      ctx.closePath();
      ctx.strokeStyle = "rgba(180,180,180,0.4)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Highlight ridge
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(tipX, tipY);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Bright tip
      ctx.beginPath();
      ctx.arc(tipX, tipY, 1.0, 0, Math.PI * 2);
      ctx.fillStyle = "#e8e8e8";
      ctx.fill();
    }

    // ─── Colored pockets with raised frets ───
    for (let i = 0; i < TOTAL; i++) {
      const num    = WHEEL_NUMBERS[i];
      const startA = (i * SEG - 90) * (Math.PI / 180);
      const endA   = ((i + 1) * SEG - 90) * (Math.PI / 180);
      const color  = getNumberColor(num);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, POCKET_R, startA, endA);
      ctx.closePath();
      const pocketBase  = color === "red" ? "#b91c1c" : color === "green" ? "#15803d" : "#1e1e32";
      const pocketLight = color === "red" ? "#d42a2a" : color === "green" ? "#1fa050" : "#2a2a44";
      if (moving) {
        // Flat fill while spinning — skip the per-pocket radial gradient.
        ctx.fillStyle = pocketLight;
        ctx.fill();
      } else {
        const midA = (startA + endA) / 2;
        const pgx  = Math.cos(midA) * POCKET_R * 0.7;
        const pgy  = Math.sin(midA) * POCKET_R * 0.7;
        const pg   = ctx.createRadialGradient(pgx, pgy, 0, pgx, pgy, POCKET_R * 0.4);
        pg.addColorStop(0, pocketLight);
        pg.addColorStop(1, pocketBase);
        ctx.fillStyle = pg;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(0, 0, POCKET_R, startA, endA);
      ctx.strokeStyle = "rgba(200,168,78,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Metal fret divider
      const fretX1 = Math.cos(startA) * INNER_R;
      const fretY1 = Math.sin(startA) * INNER_R;
      const fretX2 = Math.cos(startA) * POCKET_R;
      const fretY2 = Math.sin(startA) * POCKET_R;

      ctx.beginPath();
      ctx.moveTo(fretX1 + 1, fretY1 + 1); ctx.lineTo(fretX2 + 1, fretY2 + 1);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(fretX1, fretY1); ctx.lineTo(fretX2, fretY2);
      ctx.strokeStyle = "#a0a0a0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(fretX1 - 0.5, fretY1 - 0.5); ctx.lineTo(fretX2 - 0.5, fretY2 - 0.5);
      ctx.strokeStyle = "rgba(220,220,220,0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Number text
      const textMidA = ((i * SEG + SEG / 2) - 90) * (Math.PI / 180);
      const textR    = (POCKET_R + INNER_R) / 2 + 4;
      ctx.save();
      ctx.translate(Math.cos(textMidA) * textR, Math.sin(textMidA) * textR);
      ctx.rotate(textMidA + Math.PI / 2);
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!moving) {
        // shadowBlur is the single most expensive per-frame op — full quality
        // only on the resting frame.
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
      }
      ctx.fillText(String(num), 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Inner ring (gold)
    ctx.beginPath();
    ctx.arc(0, 0, INNER_R, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cone area
    const coneGrad = ctx.createRadialGradient(0, 0, HUB_R, 0, 0, INNER_R);
    coneGrad.addColorStop(0, "#2a2a35");
    coneGrad.addColorStop(0.3, "#252530");
    coneGrad.addColorStop(0.7, "#1e1e2a");
    coneGrad.addColorStop(1, "#1a1a28");
    ctx.beginPath();
    ctx.arc(0, 0, INNER_R - 1, 0, Math.PI * 2);
    ctx.arc(0, 0, HUB_R + 1, 0, Math.PI * 2, true);
    ctx.fillStyle = coneGrad;
    ctx.fill();

    // Spokes
    for (let i = 0; i < 8; i++) {
      const sa = (i * Math.PI * 2) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * (HUB_R + 2) + 1, Math.sin(sa) * (HUB_R + 2) + 1);
      ctx.lineTo(Math.cos(sa) * (INNER_R - 2) + 1, Math.sin(sa) * (INNER_R - 2) + 1);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * (HUB_R + 2), Math.sin(sa) * (HUB_R + 2));
      ctx.lineTo(Math.cos(sa) * (INNER_R - 2), Math.sin(sa) * (INNER_R - 2));
      ctx.strokeStyle = "rgba(200,168,78,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * (HUB_R + 2) - 0.5, Math.sin(sa) * (HUB_R + 2) - 0.5);
      ctx.lineTo(Math.cos(sa) * (INNER_R - 2) - 0.5, Math.sin(sa) * (INNER_R - 2) - 0.5);
      ctx.strokeStyle = "rgba(255,230,150,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center hub
    const hubGrad = ctx.createRadialGradient(-10, -10, 4, 0, 0, HUB_R);
    hubGrad.addColorStop(0, "#777");
    hubGrad.addColorStop(0.3, "#555");
    hubGrad.addColorStop(0.6, "#3a3a3a");
    hubGrad.addColorStop(1, "#1a1a1a");
    ctx.beginPath();
    ctx.arc(0, 0, HUB_R, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, HUB_R, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center emblem
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    const emblemGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14);
    emblemGrad.addColorStop(0, "#e8d070");
    emblemGrad.addColorStop(0.5, "#c8a84e");
    emblemGrad.addColorStop(1, "#8a6e30");
    ctx.fillStyle = emblemGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2a2a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-3, -3, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fill();

    ctx.restore();

    // ═══════════════════════════════════════════════════════
    // PASS 2 — COUNTER-ROTATING BALL TRACK (grey ring + pins)
    // Rotates opposite direction to inner disc
    // ═══════════════════════════════════════════════════════
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate((-angle * Math.PI) / 180);

    // Chrome ball track annulus
    const trackGrad = ctx.createRadialGradient(0, 0, POCKET_R + 3, 0, 0, OUTER_R - 8);
    trackGrad.addColorStop(0, "#505050");
    trackGrad.addColorStop(0.2, "#6a6a6a");
    trackGrad.addColorStop(0.5, "#5a5a5a");
    trackGrad.addColorStop(0.8, "#484848");
    trackGrad.addColorStop(1, "#383838");
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R - 8, 0, Math.PI * 2);
    ctx.arc(0, 0, POCKET_R + 3, 0, Math.PI * 2, true);
    ctx.fillStyle = trackGrad;
    ctx.fill();



    // 8 gold deflectors in the middle of the track
    for (let i = 0; i < 8; i++) {
      const da    = (i * Math.PI * 2) / 8;
      const dr    = (POCKET_R + OUTER_R - 5) / 2;
      const flash = deflectorFlash.current[i];
      ctx.save();
      ctx.rotate(da);
      ctx.translate(0, -dr);

      ctx.beginPath();
      ctx.moveTo(1,-5); ctx.lineTo(4,1); ctx.lineTo(1,7); ctx.lineTo(-2,1);
      ctx.closePath(); ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0,-6); ctx.lineTo(4,0); ctx.lineTo(0,6); ctx.lineTo(-4,0);
      ctx.closePath();
      const dGrad = ctx.createLinearGradient(0,-6,0,6);
      dGrad.addColorStop(0, flash > 0.3 ? "#fff8d0" : "#e8c858");
      dGrad.addColorStop(0.5, flash > 0.3 ? "#ffeea0" : "#c8a84e");
      dGrad.addColorStop(1, flash > 0.3 ? "#d4b85a" : "#8a6e30");
      ctx.fillStyle = dGrad; ctx.fill();
      ctx.strokeStyle = "#d4b85a"; ctx.lineWidth = 0.5; ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0,-5); ctx.lineTo(2,0); ctx.lineTo(0,-1); ctx.lineTo(-2,0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,240,${0.3 + flash * 0.5})`; ctx.fill();

      ctx.restore();

      if (deflectorFlash.current[i] > 0) {
        deflectorFlash.current[i] = Math.max(0, deflectorFlash.current[i] - 0.04);
      }
    }

    // Gold trim: inner edge of track
    ctx.beginPath();
    ctx.arc(0, 0, POCKET_R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a"; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.restore();

    // ═══════════════════════════════════════════
    // PASS 3 — STATIC OUTER WOOD RING
    // ═══════════════════════════════════════════
    ctx.save();
    ctx.translate(CX, CY);

    // Gold trim outer edge of track
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R - 7, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a"; ctx.lineWidth = 2; ctx.stroke();

    // Outer red ring — wide deep red velvet border
    const woodGrad = ctx.createRadialGradient(0, 0, OUTER_R - 8, 0, 0, OUTER_R + 18);
    woodGrad.addColorStop(0,   "#8b0000");
    woodGrad.addColorStop(0.2, "#a80000");
    woodGrad.addColorStop(0.45, "#c00010");
    woodGrad.addColorStop(0.65, "#8b0000");
    woodGrad.addColorStop(0.85, "#5c0000");
    woodGrad.addColorStop(1,   "#2a0000");
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R + 18, 0, Math.PI * 2);
    ctx.arc(0, 0, OUTER_R - 8,  0, Math.PI * 2, true);
    ctx.fillStyle = woodGrad; ctx.fill();
    // inner gold trim on red ring
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R - 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4b85a"; ctx.lineWidth = 1.5; ctx.stroke();
    // outer gold trim on red ring
    ctx.beginPath();
    ctx.arc(0, 0, OUTER_R + 16, 0, Math.PI * 2);
    ctx.strokeStyle = "#c8a84e"; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.restore();

    // ═══════════════════════════════════════════════════════════
    // PASS 4 — COUNTER-ROTATING PINS on inner gold trim of red ring
    // Same -angle as Pass 2, drawn after red ring so pins are visible
    // ═══════════════════════════════════════════════════════════
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate((-angle * Math.PI) / 180);

    for (let i = 0; i < TOTAL; i++) {
      const pinAngle = (i * SEG - 90) * (Math.PI / 180);
      drawPin(ctx, pinAngle, OUTER_R - 7, OUTER_R + 7, 2.6);
    }

    ctx.restore();
  }, []);

  // Initial draw
  useEffect(() => {
    drawWheel(wheelAngle.current);
  }, [drawWheel]);

  // ─── update pointer spring each frame ───
  const updatePointer = useCallback(() => {
    const ptr = pointerRef.current;
    if (!ptr) return;
    if (pointerBounce.current > 0.01) {
      pointerBounce.current *= 0.85;
      const deg = pointerBounce.current * 12;
      ptr.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    } else {
      pointerBounce.current = 0;
      ptr.style.transform = "translateX(-50%) rotate(0deg)";
    }
  }, []);

  // ─── idle spin ───
  useEffect(() => {
    if (!spinning || result !== null) return;
    if (animating.current) return;

    const ball = ballRef.current;
    if (!ball) return;

    setLanded(false);
    landedBallPos.current = null;

    let angle = wheelAngle.current;
    let ballAngle = idleBallAngle.current;
    let lastDeflectorTick = 0;
    let swayPhase = Math.random() * Math.PI * 2;
    let lastPointerSeg = -1;

    startRollingSound();

    const loop = () => {
      angle += 1.8;
      ballAngle -= 4.5;
      swayPhase += 0.08;
      wheelAngle.current = angle;
      idleBallAngle.current = ballAngle;

      drawWheel(angle, true);
      updatePointer();

      // Ball sway
      const sway = Math.sin(swayPhase) * 3 + Math.sin(swayPhase * 2.3) * 1.5;
      const rad = (ballAngle * Math.PI) / 180;
      const perpX = -Math.sin(rad) * sway;
      const perpY = Math.cos(rad) * sway;
      const bx = CX + Math.cos(rad) * BALL_ORBIT_R + perpX - HALF_BALL;
      const by = CY + Math.sin(rad) * BALL_ORBIT_R + perpY - HALF_BALL;
      ball.style.left = `${bx}px`;
      ball.style.top = `${by}px`;

      // Motion blur
      ball.style.filter = "blur(0.7px)";

      // Deflector hits + flash
      if (Math.abs(ballAngle - lastDeflectorTick) > 30) {
        lastDeflectorTick = ballAngle;
        const ballDeg = ((ballAngle % 360) + 360) % 360;
        for (let d = 0; d < 8; d++) {
          const dDeg = (d * 360) / 8;
          const diff = Math.abs(ballDeg - dDeg);
          if (diff < 20 || diff > 340) {
            deflectorFlash.current[d] = 1;
            playDeflectorHit();
            break;
          }
        }
      }

      // Pointer bounce when wheel segment passes top
      const wheelDeg = ((angle % 360) + 360) % 360;
      const curSeg = Math.floor(wheelDeg / SEG);
      if (curSeg !== lastPointerSeg) {
        lastPointerSeg = curSeg;
        bouncePointer();
      }

      idleRaf.current = requestAnimationFrame(loop);
    };

    idleRaf.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(idleRaf.current);
      stopRollingSound();
    };
  }, [spinning, result, drawWheel, playDeflectorHit, startRollingSound, stopRollingSound, bouncePointer, updatePointer]);

  // ─── landing animation (decelerate from idle speed) ───
  useEffect(() => {
    if (!spinning || result === null) return;

    const ball = ballRef.current;
    if (!ball) return;

    cancelAnimationFrame(idleRaf.current);
    animating.current = true;

    const idx = WHEEL_NUMBERS.indexOf(result);
    if (idx === -1) return;

    const IDLE_WHEEL_SPEED = 108;
    const IDLE_BALL_SPEED = 270;

    const wheelStart = wheelAngle.current;
    const segCenterDeg = idx * SEG + SEG / 2;
    const targetMod = ((360 - segCenterDeg) % 360 + 360) % 360;
    const startMod = ((wheelStart % 360) + 360) % 360;
    const extra = ((targetMod - startMod) % 360 + 360) % 360;
    const totalWheelDist = extra + 360;
    const wheelDuration = Math.max(5000, (2 * totalWheelDist / IDLE_WHEEL_SPEED) * 1000);

    const ballStart = idleBallAngle.current;
    const ballStartMod = ((ballStart % 360) + 360) % 360;
    const toTop = ((ballStartMod - 270) % 360 + 360) % 360;
    const totalBallDist = toTop + 360;
    const targetBallAngle = ballStart - totalBallDist;
    const ballDuration = Math.max(4000, (2 * totalBallDist / IDLE_BALL_SPEED) * 1000);

    const duration = Math.max(wheelDuration, ballDuration);
    const startTime = performance.now();
    let lastSnd = ballStart;
    let swayPhase = Math.random() * Math.PI * 2;
    let lastPSeg = -1;
    let pocketBounceCount = 0;

    startRollingSound();

    const anim = (now: number) => {
      const elapsed = now - startTime;

      const wt = Math.min(elapsed / wheelDuration, 1);
      const wEase = wt * (2 - wt);
      const curWheel = wheelStart + totalWheelDist * wEase;
      wheelAngle.current = curWheel;
      drawWheel(curWheel);
      updatePointer();

      const bt = Math.min(elapsed / ballDuration, 1);
      const bEase = bt * (2 - bt);
      let curBall = ballStart + (targetBallAngle - ballStart) * bEase;
      swayPhase += 0.06 * (1 - bt);

      // Pocket bounce (last 15%)
      if (bt > 0.85 && bt < 0.97) {
        const pbt = (bt - 0.85) / 0.12;
        const bounceAmp = Math.sin(pbt * Math.PI * 5) * (1 - pbt) * (SEG * 0.35);
        curBall += bounceAmp;
        const bounceIdx = Math.floor(pbt * 5);
        if (bounceIdx > pocketBounceCount) {
          pocketBounceCount = bounceIdx;
          playPocketBounce();
        }
      }

      // Radius: orbit → pocket
      let r = BALL_ORBIT_R;
      if (bt > 0.6) {
        const drop = (bt - 0.6) / 0.4;
        r = BALL_ORBIT_R - drop * drop * (BALL_ORBIT_R - BALL_POCKET_R);
      }
      if (bt > 0.88 && bt < 0.97) {
        const rbt = (bt - 0.88) / 0.09;
        r += Math.sin(rbt * Math.PI * 4) * (1 - rbt) * 5;
      }

      // Ball sway
      const rad = (curBall * Math.PI) / 180;
      const swayAmt = (1 - bt) * 4;
      const sway = Math.sin(swayPhase) * swayAmt + Math.sin(swayPhase * 1.7) * swayAmt * 0.4;
      const perpX = -Math.sin(rad) * sway;
      const perpY = Math.cos(rad) * sway;
      const bx = CX + Math.cos(rad) * r + perpX - HALF_BALL;
      const by = CY + Math.sin(rad) * r + perpY - HALF_BALL;
      ball.style.left = `${bx}px`;
      ball.style.top = `${by}px`;

      // Motion blur decreases
      const speedFactor = 1 - bt;
      ball.style.filter = bt > 0.9 ? "none" : `blur(${speedFactor * 1.5}px)`;

      // Continuous rolling volume — fades with deceleration
      const rollingVol = bt < 0.85 ? 0.035 * (1 - bt * 0.8) : 0.001;
      setRollingVolume(rollingVol);

      // Deflector hits
      if (Math.abs(curBall - lastSnd) > 22 && bt < 0.7) {
        lastSnd = curBall;
        const ballDeg = ((curBall % 360) + 360) % 360;
        for (let d = 0; d < 8; d++) {
          const dDeg = (d * 360) / 8;
          const diff = Math.abs(ballDeg - dDeg);
          if (diff < 20 || diff > 340) {
            deflectorFlash.current[d] = 1;
            playDeflectorHit();
            break;
          }
        }
      }

      // Pointer bounce
      const wheelDeg = ((curWheel % 360) + 360) % 360;
      const curSeg = Math.floor(wheelDeg / SEG);
      if (curSeg !== lastPSeg) {
        lastPSeg = curSeg;
        bouncePointer();
      }

      if (elapsed < duration) {
        ballRaf.current = requestAnimationFrame(anim);
      } else {
        // Redraw the final resting position at FULL quality (gradients + number
        // shadows) — the spin frames used the cheap flat-fill path.
        drawWheel(curWheel, false);
        ball.style.filter = "none";
        landedBallPos.current = { x: bx, y: by };
        idleBallAngle.current = curBall;
        playBallDrop();
        stopRollingSound();

        setTimeout(() => {
          animating.current = false;
          setLanded(true);
          playWin();
          onSpinCompleteRef.current?.();
        }, 500);
      }
    };

    ballRaf.current = requestAnimationFrame(anim);
    return () => {
      cancelAnimationFrame(ballRaf.current);
      stopRollingSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, result]);

  // ─── Persist ball at landed position ───
  useEffect(() => {
    if (spinning) return;
    const ball = ballRef.current;
    if (!ball) return;

    if (landed && landedBallPos.current) {
      ball.style.left = `${landedBallPos.current.x}px`;
      ball.style.top = `${landedBallPos.current.y}px`;
      ball.style.filter = "none";
    } else if (!landed) {
      drawWheel(0);
      wheelAngle.current = 0;
      ball.style.left = `${CX - HALF_BALL}px`;
      ball.style.top = `${CY - BALL_ORBIT_R - HALF_BALL}px`;
      ball.style.filter = "none";
    }
  }, [spinning, landed, drawWheel]);

  return (
    <div className="relative mx-auto select-none" style={{
      width: SIZE + 180, height: SIZE + 120,
      perspective: '1100px',
      perspectiveOrigin: '50% 82%',
      overflow: 'visible',
    }}>
      <div style={{
        position: 'absolute',
        top: 30, left: 90, width: SIZE, height: SIZE,
        transform: 'rotateX(40deg)',
        transformStyle: 'preserve-3d' as const,
      }}>

      {/* ─── Pointer — tip points down, pivots from base (top), hits fret pins ─── */}
      <div
        ref={pointerRef}
        className="absolute left-1/2 z-30"
        style={{
          top: -18,
          transform: "translateX(-50%) rotate(0deg)",
          transformOrigin: "50% 0%",
          width: 28,
          height: 42,
        }}
      >
        {/* Pointer shadow */}
        <div className="absolute" style={{
          top: 6, left: 4,
          width: 0, height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "36px solid rgba(0, 0, 0, 0.4)",
          filter: "blur(3px)",
        }} />
        {/* Pointer body — wide base at top, sharp tip at bottom touching wheel pins */}
        <svg width="28" height="42" viewBox="0 0 28 42" className="absolute top-0 left-0">
          <defs>
            <linearGradient id="ptrGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0d878" />
              <stop offset="25%" stopColor="#d4b85a" />
              <stop offset="50%" stopColor="#c8a84e" />
              <stop offset="75%" stopColor="#a0862e" />
              <stop offset="100%" stopColor="#806820" />
            </linearGradient>
            <linearGradient id="ptrHL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,240,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,240,0)" />
            </linearGradient>
          </defs>
          {/* Main body: wide base at top → sharp tip at bottom */}
          <path d="M4 2 Q14 0 24 2 L14 42 Z" fill="url(#ptrGrad)" stroke="#b89838" strokeWidth="0.8" />
          {/* Left highlight edge */}
          <path d="M6 4 Q14 2 14 2 L14 38 Z" fill="url(#ptrHL)" />
          {/* Center ridge line */}
          <line x1="14" y1="5" x2="14" y2="38" stroke="rgba(255,255,240,0.12)" strokeWidth="0.8" />
          {/* Tip accent — bright point */}
          <circle cx="14" cy="40" r="1.5" fill="#e8d070" />
        </svg>
      </div>

      {/* 3D depth rim layers — deep red, stacked downward */}
      {[56, 44, 32, 20, 10].map((z, i) => (
        <div
          key={`rim-${i}`}
          className="absolute rounded-full"
          style={{
            top: -26 + i * 1,
            left: -26,
            width: SIZE + 52,
            height: SIZE + 52,
            background: `linear-gradient(175deg, ${['#3a0000','#4e0000','#620000','#780000','#8c0000'][i]} 0%, ${['#0e0000','#180000','#220000','#2e0000','#3a0000'][i]} 100%)`,
            border: `1px solid ${['#2a0000','#3c0000','#500000','#640000','#780000'][i]}`,
            transform: `translateZ(-${z}px)`,
            boxShadow: i === 0 ? '0 40px 100px rgba(0,0,0,0.98), 0 16px 40px rgba(0,0,0,0.7)' : 'none',
          }}
        />
      ))}

      {/* Outer glow overlay — no border, just subtle inner shadow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: -26,
          left: -26,
          width: SIZE + 52,
          height: SIZE + 52,
          boxShadow: "inset 0 0 24px rgba(180,0,0,0.35)",
          background: "transparent",
          transform: 'translateZ(0px)',
        }}
      />

      {/* Canvas wheel */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="absolute inset-0 rounded-full"
        style={{ filter: "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5))" }}
      />

      {/* ─── Ball — larger 3D sphere ─── */}
      <div
        ref={ballRef}
        className={`absolute z-20 ${spinning && !landed ? 'ball-spinning' : ''}`}
        style={{
          width: BALL_SIZE,
          height: BALL_SIZE,
          left: CX - HALF_BALL,
          top: CY - BALL_ORBIT_R - HALF_BALL,
          transition: "filter 0.1s",
        }}
      >
        {/* Ball shadow */}
        <div className="absolute" style={{
          width: 18, height: 7, left: 1, top: BALL_SIZE,
          background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.7) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(2px)',
        }} />
        {/* Ball body — polished ivory */}
        <div className="rounded-full" style={{
          width: BALL_SIZE, height: BALL_SIZE,
          background: `radial-gradient(circle at 35% 25%, 
            #ffffff 0%, #f5f5ec 15%, #e8e8d8 30%, 
            #d0d0c0 50%, #b0b0a0 70%, #909080 90%, #707060 100%)`,
          boxShadow: `0 2px 5px rgba(0, 0, 0, 0.9), 0 0 12px rgba(255,255,255,0.3), 
            inset 0 -4px 6px rgba(0, 0, 0, 0.35), inset 0 3px 4px rgba(255,255,255,0.9)`,
        }} />
        {/* Primary specular highlight */}
        <div className="absolute rounded-full" style={{
          width: 7, height: 5, left: 5, top: 3,
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)',
        }} />
        {/* Secondary highlight */}
        <div className="absolute rounded-full" style={{
          width: 3, height: 2, left: 12, top: 6,
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
        }} />
      </div>

      {/* Landed result badge */}
      {landed && result !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold text-white shadow-2xl border-2 ${
              getNumberColor(result) === "red"
                ? "bg-red-700 border-red-400"
                : getNumberColor(result) === "green"
                ? "bg-green-700 border-green-400"
                : "bg-gray-800 border-gray-500"
            }`}
            style={{
              boxShadow: `0 0 30px ${
                getNumberColor(result) === "red"
                  ? "rgba(220,38,38,0.5)"
                  : getNumberColor(result) === "green"
                  ? "rgba(0,200,100,0.5)"
                  : "rgba(100,100,100,0.4)"
              }`,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            {result}
          </div>
        </div>
      )}
      </div>

      {/* 3D shadow below tilted wheel */}
      <div className="absolute" style={{
        bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: SIZE * 1.1, height: 36,
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, rgba(80,0,0,0.3) 50%, transparent 70%)',
        filter: 'blur(14px)',
        borderRadius: '50%',
      }} />
    </div>
  );
}
