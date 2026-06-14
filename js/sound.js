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

// A short, sharp "カチッ" lock click.
export function clickLock() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.06);
  const bp = c.createBiquadFilter();
  bp.type = 'highpass'; bp.frequency.value = 3500;
  const g = c.createGain();
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t); src.stop(t + 0.07);

  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(1400, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.04);
  const og = c.createGain();
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(og).connect(c.destination);
  o.start(t); o.stop(t + 0.06);
}

// A heavy "ガシャン" lock — big metallic impact with a low body.
export function heavyLock() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.35);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1800, t);
  bp.frequency.exponentialRampToValueAtTime(600, t + 0.25);
  bp.Q.value = 6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t); src.stop(t + 0.36);

  const thud = c.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(180, t);
  thud.frequency.exponentialRampToValueAtTime(48, t + 0.2);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.6, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  thud.connect(tg).connect(c.destination);
  thud.start(t); thud.stop(t + 0.3);
}

// Airy "whoosh" as a part flies toward the face.
export function whoosh(duration = 0.4) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, duration + 0.05);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + duration);
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + duration * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t); src.stop(t + duration + 0.05);
}

// Targeting scan sweep for the eye-scan stage.
export function scanSweep(duration = 0.6) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(700, t);
  o.frequency.exponentialRampToValueAtTime(1600, t + duration);
  const lfo = c.createOscillator();
  lfo.type = 'square'; lfo.frequency.value = 28;
  const lg = c.createGain(); lg.gain.value = 0.12;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  lfo.connect(lg).connect(g.gain);
  o.connect(g).connect(c.destination);
  o.start(t); lfo.start(t);
  o.stop(t + duration + 0.02); lfo.stop(t + duration + 0.02);
}

// HUD boot — a quick run of confirmation beeps.
export function hudBoot() {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime;
  const notes = [880, 1175, 1568, 2093];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.07;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.07);
  });
}

// Camera shutter for photo capture.
export function shutter() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  for (const dt of [0, 0.08]) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.05);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(0.35, t + dt + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t + dt); src.stop(t + dt + 0.06);
  }
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
