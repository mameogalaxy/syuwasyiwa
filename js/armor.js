// Mecha-armor renderer + assembly sequence.
//
// Parts are described in a normalised "face space":
//   origin (0,0) = midpoint between the eyes
//   +u          = toward the right eye (horizontal)
//   +v          = toward the chin (vertical)
//   1 unit      = the inter-ocular distance
// A FaceFrame maps that space onto the mirrored screen canvas, so every part
// sticks to the face and rotates with the head.

import * as sfx from './sound.js';

// MediaPipe FaceMesh landmark indices we sample.
const L_EYE = [33, 133, 159, 145];
const R_EYE = [263, 362, 386, 374];
const CHIN = 152;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Build a coordinate frame from MediaPipe landmarks already mapped to screen px.
// `map(idx)` returns {x, y} in canvas pixels (mirroring handled by caller).
export function buildFrame(map) {
  const avg = (ids) => {
    let x = 0, y = 0;
    for (const i of ids) { const p = map(i); x += p.x; y += p.y; }
    return { x: x / ids.length, y: y / ids.length };
  };
  const le = avg(L_EYE), re = avg(R_EYE), chin = map(CHIN);

  const mid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
  let ex = re.x - le.x, ey = re.y - le.y;
  const s = Math.hypot(ex, ey) || 1;
  const xhat = { x: ex / s, y: ey / s };
  // perpendicular, oriented toward the chin
  let yhat = { x: -xhat.y, y: xhat.x };
  if ((chin.x - mid.x) * yhat.x + (chin.y - mid.y) * yhat.y < 0) {
    yhat = { x: -yhat.x, y: -yhat.y };
  }
  const to = (u, v) => ({
    x: mid.x + u * s * xhat.x + v * s * yhat.x,
    y: mid.y + u * s * xhat.y + v * s * yhat.y,
  });
  return { to, s, mid, xhat, yhat };
}

// ---- low-level drawing helpers -------------------------------------------

function poly(ctx, F, pts, dx = 0, dv = 0, pivot = null, ang = 0) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    let [u, v] = pts[i];
    u += dx; v += dv;
    if (ang && pivot) {
      const du = u - pivot[0], dv2 = v - pivot[1];
      const c = Math.cos(ang), s = Math.sin(ang);
      u = pivot[0] + du * c - dv2 * s;
      v = pivot[1] + du * s + dv2 * c;
    }
    const p = F.to(u, v);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function metalFill(ctx, F, aU, aV, bU, bV, tint = 0) {
  const a = F.to(aU, aV), b = F.to(bU, bV);
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  const hi = tint === 1 ? '#9fd0ff' : '#cfd8e6';
  const lo = tint === 1 ? '#1d2b44' : '#2a313d';
  g.addColorStop(0, lo);
  g.addColorStop(0.45, hi);
  g.addColorStop(0.62, '#f3f7ff');
  g.addColorStop(0.8, hi);
  g.addColorStop(1, lo);
  return g;
}

function rivet(ctx, F, u, v) {
  const p = F.to(u, v);
  const r = Math.max(1.5, F.s * 0.018);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#11151c';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function glowLine(ctx, F, pts, color, width, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, F.s * width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = F.s * 0.25;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = F.to(pts[i][0], pts[i][1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

// ---- individual parts -----------------------------------------------------
// Each receives the assemble progress p (0..1). They slide/rotate from an
// off-position into their locked place as p goes 0 -> 1.

function sidePlate(ctx, F, p, side) {
  const e = easeOutBack(clamp01(p));
  const dx = (1 - e) * 1.5 * side; // slides in from outside
  const sgn = side;
  const base = [
    [0.58 * sgn, -0.05], [1.18 * sgn, 0.05], [1.3 * sgn, 0.55],
    [1.12 * sgn, 1.15], [0.72 * sgn, 1.62], [0.36 * sgn, 1.66],
    [0.34 * sgn, 1.12], [0.5 * sgn, 0.55], [0.52 * sgn, 0.1],
  ];
  ctx.save();
  ctx.globalAlpha = clamp01(p * 1.3);
  poly(ctx, F, base, dx, 0);
  ctx.fillStyle = metalFill(ctx, F, 0.5 * sgn, 0, 1.3 * sgn, 1.4);
  ctx.fill();
  ctx.lineWidth = Math.max(1, F.s * 0.02);
  ctx.strokeStyle = '#0a0e15';
  ctx.stroke();
  // accent groove
  glowLine(ctx, F, [[0.62 * sgn + dx, 0.35], [1.02 * sgn + dx, 0.95]], '#38e8ff', 0.03, 0.8 * p);
  if (p > 0.6) {
    rivet(ctx, F, 1.12 * sgn + dx, 0.18);
    rivet(ctx, F, 0.9 * sgn + dx, 1.2);
  }
  ctx.restore();
}

function faceGuard(ctx, F, p) {
  const e = easeOutBack(clamp01(p));
  const dv = (1 - e) * 1.25; // slides up from below the chin
  const shape = [
    [-0.5, 0.5], [0.5, 0.5], [0.62, 1.0], [0.42, 1.55],
    [0, 1.78], [-0.42, 1.55], [-0.62, 1.0],
  ];
  ctx.save();
  ctx.globalAlpha = clamp01(p * 1.3);
  poly(ctx, F, shape, 0, dv);
  ctx.fillStyle = metalFill(ctx, F, -0.6, 0.5 + dv, 0.6, 1.7 + dv);
  ctx.fill();
  ctx.lineWidth = Math.max(1, F.s * 0.02);
  ctx.strokeStyle = '#0a0e15';
  ctx.stroke();
  // breathing vents
  ctx.globalAlpha *= 0.9;
  for (let i = 0; i < 4; i++) {
    const v = 0.92 + i * 0.16 + dv;
    const w = 0.34 - i * 0.05;
    glowLine(ctx, F, [[-w, v], [w, v]], '#1a2230', 0.05, 1);
  }
  // central seam glow
  glowLine(ctx, F, [[0, 0.55 + dv], [0, 1.7 + dv]], '#ff6b3d', 0.018, 0.7 * p);
  if (p > 0.6) { rivet(ctx, F, -0.5, 0.62 + dv); rivet(ctx, F, 0.5, 0.62 + dv); }
  ctx.restore();
}

function crown(ctx, F, p) {
  const e = easeOutBack(clamp01(p));
  const dv = -(1 - e) * 1.5;               // drops down from above
  const ang = (1 - easeOutCubic(clamp01(p))) * 0.25; // settles from a tilt
  const shape = [
    [-1.08, -0.32], [-0.62, -1.08], [0, -1.26], [0.62, -1.08],
    [1.08, -0.32], [0.78, -0.16], [0, -0.36], [-0.78, -0.16],
  ];
  ctx.save();
  ctx.globalAlpha = clamp01(p * 1.3);
  poly(ctx, F, shape, 0, dv, [0, -0.7], ang);
  ctx.fillStyle = metalFill(ctx, F, -1.0, -0.3 + dv, 1.0, -1.2 + dv);
  ctx.fill();
  ctx.lineWidth = Math.max(1, F.s * 0.022);
  ctx.strokeStyle = '#0a0e15';
  ctx.stroke();

  // central crest fin
  const fin = [[-0.12, -0.4], [0, -1.5], [0.12, -0.4]];
  poly(ctx, F, fin, 0, dv, [0, -0.7], ang);
  ctx.fillStyle = '#d8e2f0';
  ctx.fill();
  ctx.stroke();

  // forehead gem
  if (p > 0.5) {
    const g = F.to(0, -0.62 + dv);
    const r = F.s * 0.13;
    const grd = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, r);
    grd.addColorStop(0, '#bff6ff');
    grd.addColorStop(0.5, '#38e8ff');
    grd.addColorStop(1, '#0a4a59');
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.shadowColor = '#38e8ff';
    ctx.shadowBlur = F.s * 0.4 * p;
    ctx.fill();
  }
  ctx.restore();
}

function visor(ctx, F, p) {
  const e = easeOutCubic(clamp01(p));
  const shape = [
    [-1.02, -0.34], [1.02, -0.34], [0.86, 0.28],
    [0, 0.42], [-0.86, 0.28],
  ];
  ctx.save();
  ctx.globalAlpha = clamp01(p * 1.3);
  poly(ctx, F, shape, 0, 0);
  ctx.fillStyle = metalFill(ctx, F, -1.0, -0.34, 1.0, 0.4);
  ctx.fill();
  ctx.lineWidth = Math.max(1, F.s * 0.02);
  ctx.strokeStyle = '#0a0e15';
  ctx.stroke();

  // glowing eye slits, brightening as the part powers up
  const glow = e;
  const slit = (sgn) => {
    const pts = [
      [0.18 * sgn, -0.04], [0.72 * sgn, -0.16],
      [0.78 * sgn, 0.06], [0.24 * sgn, 0.12],
    ];
    poly(ctx, F, pts, 0, 0);
    const a = F.to(0.18 * sgn, 0), b = F.to(0.78 * sgn, 0);
    const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grd.addColorStop(0, `rgba(255,90,60,${0.4 + 0.6 * glow})`);
    grd.addColorStop(1, `rgba(255,210,90,${0.5 + 0.5 * glow})`);
    ctx.fillStyle = grd;
    ctx.shadowColor = '#ff6a2c';
    ctx.shadowBlur = F.s * 0.45 * glow;
    ctx.fill();
  };
  slit(1); slit(-1);
  ctx.restore();
}

function finishing(ctx, F, p, pulse) {
  ctx.save();
  // temple antennas
  [1, -1].forEach((sgn) => {
    const e = easeOutBack(clamp01(p));
    const dx = (1 - e) * 0.4 * sgn;
    const pts = [
      [1.02 * sgn, -0.2], [1.42 * sgn, -0.55], [1.5 * sgn, -0.42],
      [1.12 * sgn, -0.05],
    ];
    ctx.globalAlpha = clamp01(p * 1.4);
    poly(ctx, F, pts, dx, 0);
    ctx.fillStyle = '#cfd8e6';
    ctx.strokeStyle = '#0a0e15';
    ctx.lineWidth = Math.max(1, F.s * 0.018);
    ctx.fill(); ctx.stroke();
    glowLine(ctx, F, [[1.46 * sgn + dx, -0.5], [1.52 * sgn + dx, -0.4]], '#38e8ff', 0.05, p);
  });

  // full-mask energy seams pulsing across the whole helmet
  const a = 0.35 + 0.4 * pulse;
  glowLine(ctx, F, [[-1.0, -0.32], [-0.5, 0.5], [-0.6, 1.0], [0, 1.78]], '#38e8ff', 0.016, a * p);
  glowLine(ctx, F, [[1.0, -0.32], [0.5, 0.5], [0.6, 1.0], [0, 1.78]], '#38e8ff', 0.016, a * p);
  glowLine(ctx, F, [[0, -1.2], [0, -0.36]], '#38e8ff', 0.016, a * p);
  ctx.restore();
}

// ---- the sequence ---------------------------------------------------------

const STAGES = [
  { name: '装甲 左右スライド', dur: 0.85, sound: () => sfx.servo(0.85) },
  { name: 'フェイスガード合体', dur: 0.8, sound: () => sfx.clank() },
  { name: 'クラウン展開', dur: 0.85, sound: () => sfx.servo(0.85) },
  { name: 'バイザー点灯', dur: 0.7, sound: () => sfx.powerUp(0.7) },
  { name: '最終ロック', dur: 0.9, sound: () => { sfx.clank(); sfx.chord(); } },
];

export class Armor {
  constructor() {
    this.active = false;
    this.stage = -1;       // -1 = nothing placed
    this.stageT = 0;       // seconds into the current stage
    this.done = false;
    this.pulse = 0;        // completion glow phase
    this.onStage = null;   // callback(name|null)
  }

  get isComplete() { return this.done; }
  get isAnimating() { return this.active && !this.done; }

  start() {
    if (this.active && !this.done && this.stage >= 0) return; // already transforming
    this.active = true;
    this.done = false;
    this.stage = 0;
    this.stageT = 0;
    STAGES[0].sound();
    if (this.onStage) this.onStage(STAGES[0].name);
  }

  reset() {
    if (!this.active) return;
    sfx.powerDown();
    this.active = false;
    this.done = false;
    this.stage = -1;
    this.stageT = 0;
    if (this.onStage) this.onStage(null);
  }

  update(dt) {
    this.pulse += dt;
    if (!this.active || this.done || this.stage < 0) return;
    this.stageT += dt;
    const st = STAGES[this.stage];
    if (this.stageT >= st.dur) {
      this.stageT -= st.dur;
      this.stage++;
      if (this.stage >= STAGES.length) {
        this.stage = STAGES.length - 1;
        this.stageT = STAGES[this.stage].dur;
        this.done = true;
        if (this.onStage) this.onStage('変身完了');
      } else {
        STAGES[this.stage].sound();
        if (this.onStage) this.onStage(STAGES[this.stage].name);
      }
    }
  }

  // progress (0..1) for a given stage index, given current playback position
  _p(idx) {
    if (this.stage < 0) return 0;
    if (idx < this.stage) return 1;
    if (idx > this.stage) return 0;
    return clamp01(this.stageT / STAGES[idx].dur);
  }

  draw(ctx, F) {
    if (this.stage < 0) return;
    const p0 = this._p(0), p1 = this._p(1), p2 = this._p(2),
          p3 = this._p(3), p4 = this._p(4);
    const pulse = (Math.sin(this.pulse * 4) + 1) / 2;

    ctx.save();
    ctx.lineJoin = 'round';
    // Draw back-to-front so the face guard / visor sit on top.
    if (p0 > 0) { sidePlate(ctx, F, p0, 1); sidePlate(ctx, F, p0, -1); }
    if (p2 > 0) crown(ctx, F, p2);
    if (p1 > 0) faceGuard(ctx, F, p1);
    if (p3 > 0) visor(ctx, F, p3);
    if (p4 > 0) finishing(ctx, F, p4, pulse);
    ctx.restore();
  }
}

export { STAGES };
