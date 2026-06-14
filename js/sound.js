// Procedural mechanical sound effects (no audio assets required).
// Everything is synthesised live with the Web Audio API.

let ctx = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Must be called from a user gesture (e.g. the Henshin button) to unlock audio.
export function unlock() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
  return c;
}

function noiseBuffer(c, seconds) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// "ウィーン" — a servo motor whirr that slides up then settles.
export function servo(duration = 0.7) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
  master.gain.exponentialRampToValueAtTime(0.16, t + duration * 0.8);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  master.connect(c.destination);

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(540, t + duration * 0.55);
  osc.frequency.exponentialRampToValueAtTime(420, t + duration);

  // slight detuned second oscillator for a "geared" beat
  const osc2 = c.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(184, t);
  osc2.frequency.exponentialRampToValueAtTime(548, t + duration * 0.55);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + duration * 0.6);
  lp.Q.value = 6;

  const g2 = c.createGain();
  g2.gain.value = 0.4;
  osc2.connect(g2).connect(lp);
  osc.connect(lp);
  lp.connect(master);

  osc.start(t); osc2.start(t);
  osc.stop(t + duration + 0.02); osc2.stop(t + duration + 0.02);
}

// "カシャン" — a metallic clank: a noise burst through a ringing band-pass plus a thud.
export function clank() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.25);

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2400, t);
  bp.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
  bp.Q.value = 9;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

  src.connect(bp).connect(g).connect(c.destination);
  src.start(t); src.stop(t + 0.26);

  // low thud
  const thud = c.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(150, t);
  thud.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.4, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  thud.connect(tg).connect(c.destination);
  thud.start(t); thud.stop(t + 0.2);
}

// A bright electronic "power-up" sweep for the glowing-parts stage.
export function powerUp(duration = 0.6) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  g.connect(c.destination);

  [1, 1.5, 2].forEach((mult, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(330 * mult, t);
    o.frequency.exponentialRampToValueAtTime(1320 * mult, t + duration * 0.9);
    const og = c.createGain();
    og.gain.value = 0.5 / (i + 1);
    o.connect(og).connect(g);
    o.start(t); o.stop(t + duration + 0.02);
  });
}

// Triumphant chord at completion.
export function chord() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const freqs = [392, 523.25, 659.25, 784]; // G major-ish
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  master.connect(c.destination);

  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'triangle';
    o.frequency.value = f;
    const og = c.createGain();
    og.gain.value = 0.4 / (i + 1);
    o.connect(og).connect(master);
    o.start(t + i * 0.04);
    o.stop(t + 1.7);
  });

  // shimmer
  const sh = c.createBufferSource();
  sh.buffer = noiseBuffer(c, 1.2);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.06, t + 0.1);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  sh.connect(hp).connect(sg).connect(c.destination);
  sh.start(t); sh.stop(t + 1.25);
}

// Soft reset / disengage sound.
export function powerDown(duration = 0.5) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(120, t + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + duration + 0.02);
}
