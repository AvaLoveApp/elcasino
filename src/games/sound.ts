// Web Audio SFX ported verbatim from the Avlo casino — same card snaps,
// chip clinks, and win arpeggios across every ported game so the feel matches.
let audioCtx: AudioContext | null = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); return audioCtx; }
function makeNoise(ctx: AudioContext, duration: number) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export type SoundType = "deal" | "hit" | "win" | "lose" | "blackjack" | "flip" | "chip" | "tick";

export function playSound(type: SoundType) {
  try {
    const ctx = getAudioCtx(); const now = ctx.currentTime;
    switch (type) {
      case "flip": {
        const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 0.1);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.7;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now); src.stop(now + 0.1);
        break;
      }
      case "deal": {
        const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 0.18);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.setValueAtTime(600, now); bp.frequency.exponentialRampToValueAtTime(2800, now + 0.1); bp.Q.value = 1.2;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.14, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now); src.stop(now + 0.18);
        break;
      }
      case "hit": {
        const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 0.08);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 1;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now); src.stop(now + 0.08);
        break;
      }
      case "tick": {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = "square";
        o.frequency.setValueAtTime(1400, now);
        g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        o.start(now); o.stop(now + 0.04);
        break;
      }
      case "chip": {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = "sine";
        o.frequency.setValueAtTime(2200, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.06);
        g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        o.start(now); o.stop(now + 0.08);
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination); o2.type = "sine";
        o2.frequency.setValueAtTime(4800, now); g2.gain.setValueAtTime(0.04, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.05); o2.start(now); o2.stop(now + 0.05);
        break;
      }
      case "win": {
        const notes = [523, 659, 784]; const vol = 0.12;
        notes.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "sine";
          o.frequency.setValueAtTime(f, now + i * 0.12);
          g.gain.setValueAtTime(vol, now + i * 0.12); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.25);
        });
        break;
      }
      case "lose": {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = "triangle";
        o.frequency.setValueAtTime(330, now); o.frequency.exponentialRampToValueAtTime(200, now + 0.4);
        g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        o.start(now); o.stop(now + 0.4);
        break;
      }
      case "blackjack": {
        const notes = [523, 659, 784, 1047]; const vol = 0.13;
        notes.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "sine";
          o.frequency.setValueAtTime(f, now + i * 0.1);
          g.gain.setValueAtTime(vol, now + i * 0.1); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35);
          o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.35);
        });
        const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 0.3);
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
        const gs = ctx.createGain(); gs.gain.setValueAtTime(0.04, now + 0.3); gs.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        src.connect(hp); hp.connect(gs); gs.connect(ctx.destination); src.start(now + 0.3); src.stop(now + 0.6);
        break;
      }
    }
  } catch { /* audio blocked until user gesture — ignore */ }
}
