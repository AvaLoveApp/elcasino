// Plinko board visuals + audio — ported 1:1 from Avlo's plinko page.
import { useRef, useEffect, useCallback } from "react";

// Max multiplier (basis-points) per [rows][riskLevel] — mirrors contract _getMaxMultiplier
const PLINKO_MAX_MULT: Record<number, [number, number, number]> = {
  8: [560, 1300, 2900], 9: [560, 1300, 2900],
  10: [890, 2200, 5800], 11: [890, 2200, 5800],
  12: [1000, 3300, 17000], 13: [1000, 3300, 17000],
  14: [710, 4300, 42000], 15: [710, 4300, 42000],
  16: [1600, 11000, 55500],
};

// ── Bucket multiplier lookup (mirrors contract _getBucketMultiplier) ──
// Layout: edges HIGH, center LOW (standard Plinko — rare edges pay big)
const MULT_TABLES: Record<number, number[][]> = {
  8: [
    [560, 210, 110, 100, 50, 100, 110, 210, 560],
    [1300, 300, 130, 70, 40, 70, 130, 300, 1300],
    [2900, 400, 150, 30, 20, 30, 150, 400, 2900],
  ],
  10: [
    [890, 300, 140, 110, 100, 50, 100, 110, 140, 300, 890],
    [2200, 500, 200, 140, 60, 40, 60, 140, 200, 500, 2200],
    [5800, 900, 270, 130, 30, 20, 30, 130, 270, 900, 5800],
  ],
  12: [
    [1000, 300, 160, 140, 110, 100, 50, 100, 110, 140, 160, 300, 1000],
    [3300, 1100, 400, 200, 110, 60, 30, 60, 110, 200, 400, 1100, 3300],
    [17000, 2400, 810, 200, 70, 20, 20, 20, 70, 200, 810, 2400, 17000],
  ],
  14: [
    [710, 400, 190, 140, 130, 110, 100, 50, 100, 110, 130, 140, 190, 400, 710],
    [4300, 1300, 600, 300, 130, 100, 70, 50, 70, 100, 130, 300, 600, 1300, 4300],
    [42000, 5600, 1800, 500, 190, 30, 20, 20, 20, 30, 190, 500, 1800, 5600, 42000],
  ],
  16: [
    [1600, 900, 200, 140, 140, 120, 110, 100, 50, 100, 110, 120, 140, 140, 200, 900, 1600],
    [11000, 4100, 1000, 500, 300, 150, 100, 50, 30, 50, 100, 150, 300, 500, 1000, 4100, 11000],
    [55500, 13000, 2600, 900, 400, 210, 20, 20, 20, 20, 20, 210, 400, 900, 2600, 13000, 55500],
  ],
};
// For odd rows, use the nearest lower even table (same as contract)
export function getBucketMultipliers(rows: number, risk: number): number[] {
  if (MULT_TABLES[rows]) return MULT_TABLES[rows][risk];
  const base = rows - 1;
  if (MULT_TABLES[base]) return MULT_TABLES[base][risk];
  return new Array(rows + 1).fill(100);
}
// Bucket colour based on multiplier value
function bucketColor(bp: number): string {
  if (bp >= 1000) return "#f59e0b"; // gold
  if (bp >= 400) return "#f97316";  // orange
  if (bp >= 200) return "#22c55e";  // green
  if (bp >= 100) return "#3b82f6";  // blue
  if (bp >= 50) return "#8b5cf6";   // purple
  return "#ef4444";                 // red
}

// ── Sound FX ──
let audioCtx: AudioContext | null = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function playSound(type: "drop" | "peg" | "win" | "lose") {
  try {
    const ctx = getAudioCtx(); const now = ctx.currentTime;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    switch (type) {
      case "drop":
        osc.type = "sine"; osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
        gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2); break;
      case "peg":
        osc.type = "sine"; osc.frequency.setValueAtTime(1000 + Math.random() * 500, now);
        gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now); osc.stop(now + 0.04); break;
      case "win":
        osc.type = "sine"; osc.frequency.setValueAtTime(523, now);
        gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.15);
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination); o2.type = "sine";
        o2.frequency.setValueAtTime(784, now + 0.12);
        g2.gain.setValueAtTime(0.12, now + 0.12); g2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        o2.start(now + 0.12); o2.stop(now + 0.5); break;
      case "lose":
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4); break;
    }
  } catch {}
}

// ── Plinko Board Visual ──
const CANVAS_W = 560;
const CANVAS_H = 500;
const FRAMES_PER_SEG = 11;  // animation frames per path segment (slower = more watchable)
const BALL_STAGGER = 14;    // frames between consecutive ball launches
const LABEL_LIFE = 50;      // frames for floating "+Mx" labels to fade

interface BallState { path: { x: number; y: number }[]; bucket: number; startFrame: number; done: boolean; spawned?: boolean }
interface FloatLabel { text: string; x: number; y: number; birth: number; color: string }

interface PlinkoBoardProps {
  rows: number;
  riskLevel: number;
  resultBucket: number | null;
  isAnimating: boolean;
  tokenLogoUrl?: string;
  onAnimDone?: () => void;
}

export function PlinkoBoard({ rows, riskLevel, resultBucket, isAnimating, tokenLogoUrl, onAnimDone }: PlinkoBoardProps) {
  const buckets = rows + 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const doneRef = useRef(false);
  const allDoneFrameRef = useRef(0);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const logoOk = useRef(false);
  const multipliers = getBucketMultipliers(rows, riskLevel);

  // Multi-ball state
  const ballsRef = useRef<BallState[]>([]);
  const labelsRef = useRef<FloatLabel[]>([]);

  // ── Layout constants ──
  const topPad = 36;
  const botPad = 60;
  const pegSpacingX = Math.min(34, (CANVAS_W - 60) / (rows + 1));
  const rowH = (CANVAS_H - topPad - botPad) / rows;
  const pegR = Math.max(3, 4.5 - rows * 0.08);
  const ballR = 11;
  const bucketW = (CANVAS_W - 12) / buckets;

  // ── Token logo image ──
  useEffect(() => {
    if (!tokenLogoUrl) { logoOk.current = false; return; }
    const img = new window.Image();
    img.onload = () => { logoRef.current = img; logoOk.current = true; };
    img.onerror = () => { logoOk.current = false; };
    img.src = tokenLogoUrl;
  }, [tokenLogoUrl]);

  // ── Build a bouncing path from top-center → target bucket ──
  const buildPath = useCallback((targetBucket: number): { x: number; y: number }[] => {
    const w = CANVAS_W;
    const path: { x: number; y: number }[] = [];
    path.push({ x: w / 2, y: topPad - 18 });

    let rights = targetBucket;
    const decisions: boolean[] = [];
    for (let r = 0; r < rows; r++) {
      const rem = rows - r;
      if (rights <= 0) { decisions.push(false); }
      else if (rights >= rem) { decisions.push(true); rights--; }
      else { const go = Math.random() < rights / rem; decisions.push(go); if (go) rights--; }
    }

    let pIdx = 0;
    for (let r = 0; r < rows; r++) {
      const nPegs = r + 2;
      const rw = (nPegs - 1) * pegSpacingX;
      const sx = (w - rw) / 2;
      const px = sx + pIdx * pegSpacingX;
      const py = topPad + r * rowH;
      path.push({ x: px + (Math.random() - 0.5) * pegSpacingX * 0.25, y: py });

      if (decisions[r]) pIdx++;
      const nNext = r + 3;
      const rwN = (nNext - 1) * pegSpacingX;
      const sxN = (w - rwN) / 2;
      const npx = sxN + pIdx * pegSpacingX;
      const mx = (px + npx) / 2 + (Math.random() - 0.5) * pegSpacingX * 0.15;
      const my = py + rowH * 0.55;
      path.push({ x: mx, y: my });
    }

    const fx = 6 + targetBucket * bucketW + bucketW / 2;
    const fy = CANVAS_H - botPad + 20;
    path.push({ x: fx, y: fy });
    return path;
  }, [rows, pegSpacingX, rowH, bucketW, topPad, botPad]);

  // ── Draw a single ball at (bx, by) with 3D sphere effect ──
  const drawBall = useCallback((ctx: CanvasRenderingContext2D, bx: number, by: number) => {
    // Soft glow around ball
    const tg = ctx.createRadialGradient(bx, by, 0, bx, by, ballR * 3);
    tg.addColorStop(0, "rgba(16,185,129,0.18)"); tg.addColorStop(1, "transparent");
    ctx.fillStyle = tg;
    ctx.fillRect(bx - ballR * 3, by - ballR * 3, ballR * 6, ballR * 6);

    // Drop shadow
    ctx.beginPath(); ctx.arc(bx + 1.5, by + 2, ballR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; ctx.fill();

    if (logoOk.current && logoRef.current) {
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, ballR + 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(logoRef.current, bx - ballR, by - ballR, ballR * 2, ballR * 2);
      ctx.restore();
      // 3D highlight on top-left
      const hl = ctx.createRadialGradient(bx - ballR * 0.35, by - ballR * 0.35, 0, bx, by, ballR);
      hl.addColorStop(0, "rgba(255,255,255,0.35)"); hl.addColorStop(0.5, "rgba(255,255,255,0.05)"); hl.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      ctx.fillStyle = hl; ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, ballR + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // 3D sphere gradient: highlight top-left, darker bottom-right
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      const bg = ctx.createRadialGradient(bx - ballR * 0.35, by - ballR * 0.4, ballR * 0.15, bx + ballR * 0.1, by + ballR * 0.1, ballR * 1.1);
      bg.addColorStop(0, "#a7f3d0"); bg.addColorStop(0.35, "#6ee7b7"); bg.addColorStop(0.7, "#10b981"); bg.addColorStop(1, "#065f46");
      ctx.fillStyle = bg; ctx.fill();
      // Specular highlight
      const spec = ctx.createRadialGradient(bx - ballR * 0.3, by - ballR * 0.35, 0, bx - ballR * 0.3, by - ballR * 0.35, ballR * 0.45);
      spec.addColorStop(0, "rgba(255,255,255,0.7)"); spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      ctx.fillStyle = spec; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }, [ballR]);

  // ── Full draw function (pegs + buckets + multi-ball + floating labels) ──
  const drawFrame = useCallback((globalFrame: number, highlightBucket: number | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = CANVAS_W, h = CANVAS_H;
    ctx.clearRect(0, 0, w, h);

    // ── Pegs ──
    for (let r = 0; r < rows; r++) {
      const nPegs = r + 2;
      const rw = (nPegs - 1) * pegSpacingX;
      const sx = (w - rw) / 2;
      const y = topPad + r * rowH;
      for (let p = 0; p < nPegs; p++) {
        const x = sx + p * pegSpacingX;
        const g = ctx.createRadialGradient(x, y, 0, x, y, pegR * 4);
        g.addColorStop(0, "rgba(16,185,129,0.12)"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(x - pegR * 4, y - pegR * 4, pegR * 8, pegR * 8);
        ctx.beginPath(); ctx.arc(x, y, pegR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fill();
      }
    }

    // ── Buckets ──
    const bh = 48;
    for (let b = 0; b < buckets; b++) {
      const x = 6 + b * bucketW;
      const y = h - botPad + 2;
      const isHit = highlightBucket !== null && b === highlightBucket;
      const multBP = multipliers[b] || 100;
      const col = bucketColor(multBP);

      ctx.globalAlpha = isHit ? 0.55 : 0.13;
      ctx.fillStyle = col;
      const cr = 6;
      ctx.beginPath();
      ctx.moveTo(x + 1 + cr, y); ctx.lineTo(x + bucketW - 1 - cr, y);
      ctx.quadraticCurveTo(x + bucketW - 1, y, x + bucketW - 1, y + cr);
      ctx.lineTo(x + bucketW - 1, y + bh - cr);
      ctx.quadraticCurveTo(x + bucketW - 1, y + bh, x + bucketW - 1 - cr, y + bh);
      ctx.lineTo(x + 1 + cr, y + bh);
      ctx.quadraticCurveTo(x + 1, y + bh, x + 1, y + bh - cr);
      ctx.lineTo(x + 1, y + cr);
      ctx.quadraticCurveTo(x + 1, y, x + 1 + cr, y);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isHit) {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      const mStr = multBP >= 100 ? `${(multBP / 100).toFixed(multBP >= 1000 ? 0 : 1)}x` : `${(multBP / 100).toFixed(1)}x`;
      ctx.fillStyle = isHit ? "#fff" : col;
      ctx.font = `bold ${bucketW < 26 ? 8 : bucketW < 34 ? 10 : 12}px monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(mStr, x + bucketW / 2, y + bh / 2);
    }

    // ── Multi-ball rendering ──
    if (globalFrame >= 0) {
      const balls = ballsRef.current;
      for (const ball of balls) {
        if (globalFrame < ball.startFrame) continue;
        // Play spawn sound on first frame
        if (!ball.spawned) { ball.spawned = true; try { playSound("drop"); } catch {} }
        const elapsed = globalFrame - ball.startFrame;
        const totalFrames = (ball.path.length - 1) * FRAMES_PER_SEG;
        const progress = Math.min(elapsed / totalFrames, 1);

        // Ball just landed — create floating label
        if (progress >= 1 && !ball.done) {
          ball.done = true;
          const bp = multipliers[ball.bucket] || 100;
          const mStr = (bp / 100).toFixed(bp >= 1000 ? 0 : 1) + "x";
          const fx = 6 + ball.bucket * bucketW + bucketW / 2;
          const fy = h - botPad - 5;
          labelsRef.current.push({ text: `+${mStr}`, x: fx, y: fy, birth: globalFrame, color: bucketColor(bp) });
          try { playSound("peg"); } catch {}
        }

        // Draw in-flight ball
        if (progress < 1) {
          const along = progress * (ball.path.length - 1);
          const idx = Math.min(Math.floor(along), ball.path.length - 2);
          const st = along - idx;
          const e = st < 0.5 ? 2 * st * st : 1 - Math.pow(-2 * st + 2, 2) / 2;
          const bx = ball.path[idx].x + (ball.path[idx + 1].x - ball.path[idx].x) * e;
          const by = ball.path[idx].y + (ball.path[idx + 1].y - ball.path[idx].y) * e;
          drawBall(ctx, bx, by);
        }
      }

      // ── Floating "+Mx" labels ──
      for (const label of labelsRef.current) {
        const age = globalFrame - label.birth;
        if (age > LABEL_LIFE || age < 0) continue;
        const alpha = 1 - age / LABEL_LIFE;
        const yOff = label.y - age * 0.8;
        ctx.globalAlpha = alpha;
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)"; ctx.shadowBlur = 4;
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, label.x, yOff);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
  }, [rows, buckets, pegSpacingX, rowH, pegR, ballR, bucketW, topPad, botPad, multipliers, drawBall]);

  // ── Animation controller ──
  useEffect(() => {
    cancelAnimationFrame(animRef.current);

    if (resultBucket === null) {
      ballsRef.current = [];
      labelsRef.current = [];
      drawFrame(-1, null);
      return;
    }

    if (!isAnimating) {
      // Static result — draw board with highlighted bucket + ball sitting in bucket
      ballsRef.current = [];
      labelsRef.current = [];
      drawFrame(-1, resultBucket);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const fx = 6 + resultBucket * bucketW + bucketW / 2;
          const fy = CANVAS_H - botPad + 20;
          drawBall(ctx, fx, fy);
        }
      }
      return;
    }

    // ── Generate multi-ball animation (rows balls, staggered) ──
    const balls: BallState[] = [];
    for (let i = 0; i < rows; i++) {
      const bucket = resultBucket; // all balls land in the result bucket
      balls.push({ path: buildPath(bucket), bucket, startFrame: i * BALL_STAGGER, done: false });
    }
    ballsRef.current = balls;
    labelsRef.current = [];
    frameRef.current = 0;
    doneRef.current = false;
    allDoneFrameRef.current = 0;

    const loop = () => {
      const f = frameRef.current;
      drawFrame(f, null);

      const allDone = balls.every(b => b.done);
      if (allDone && allDoneFrameRef.current === 0) allDoneFrameRef.current = f;

      if (!allDone || f < allDoneFrameRef.current + LABEL_LIFE) {
        frameRef.current++;
        animRef.current = requestAnimationFrame(loop);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onAnimDone?.();
      }
    };
    animRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultBucket, isAnimating, rows, riskLevel]);

  // Redraw when rows/risk change (no animation)
  useEffect(() => {
    if (resultBucket === null) drawFrame(-1, null);
  }, [rows, riskLevel, drawFrame, resultBucket]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="w-full rounded-2xl"
      style={{
        maxWidth: CANVAS_W,
        aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
        background: "transparent",
      }}
    />
  );
}
