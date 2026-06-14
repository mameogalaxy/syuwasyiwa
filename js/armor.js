// Cinematic mecha-mask assembly + disassembly.
//
// Face space:
//   origin (0,0) = midpoint between the eyes
//   +u = toward the right eye, +v = toward the chin, 1 unit = inter-ocular dist.
// A FaceFrame maps that onto the (mirrored) screen so panels track the face.
//
// Design: a sleek near-future hero helmet — matte-black armour, brushed-silver
// trim, blue-white emissive lines. Sharp angular silhouette with a centre crest,
// widow's-peak brow, angular wrap-around visor with predator eyes, nose ridge,
// vented mouth grille and temple intakes. Original (not modelled on any IP).
// Authored in face-space so panels could later become 3D meshes.

import * as sfx from './sound.js';

// ---- landmark indices -------------------------------------------------------
const L_EYE = [33, 133, 159, 145];
const R_EYE = [263, 362, 386, 374];
const CHIN = 152;

// ---- easing -----------------------------------------------------------------
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ---- face frame -------------------------------------------------------------
export function extractPoints(map) {
  const avg = (ids) => {
    let x = 0, y = 0;
    for (const i of ids) { const p = map(i); x += p.x; y += p.y; }
    return { x: x / ids.length, y: y / ids.length };
  };
  return { le: avg(L_EYE), re: avg(R_EYE), chin: map(CHIN) };
}

export function buildFrame(le, re, chin) {
  const mid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
  const ex = re.x - le.x, ey = re.y - le.y;
  const s = Math.hypot(ex, ey) || 1;
  const xhat = { x: ex / s, y: ey / s };
  let yhat = { x: -xhat.y, y: xhat.x };
  if ((chin.x - mid.x) * yhat.x + (chin.y - mid.y) * yhat.y < 0)
    yhat = { x: -yhat.x, y: -yhat.y };
  const to = (u, v) => ({
    x: mid.x + (u * xhat.x + v * yhat.x) * s,
    y: mid.y + (u * xhat.y + v * yhat.y) * s,
  });
  return { to, s, mid, xhat, yhat };
}

function xform(F, { tx = 0, ty = 0, rot = 0, scale = 1, pivot = [0, 0] }) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (u, v) => {
    const du = (u - pivot[0]) * scale, dv = (v - pivot[1]) * scale;
    return F.to(pivot[0] + du * c - dv * s + tx, pivot[1] + du * s + dv * c + ty);
  };
}

// entry animation: p 0->1 brings a part from its fly-in offset into place
function flyIn(p, cfg) {
  const e = easeOutBack(p), er = easeOutExpo(p);
  return {
    tx: cfg.fromU * (1 - e),
    ty: cfg.fromV * (1 - e),
    rot: (cfg.fromRot || 0) * (1 - er),
    scale: 1 + ((cfg.fromScale || 1) - 1) * (1 - er),
    pivot: cfg.pivot || [0, 0],
  };
}

// ---- drawing primitives -----------------------------------------------------
function trace(ctx, xf, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = xf(pts[i][0], pts[i][1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function strokePts(ctx, F, xf, pts, color, wf, glow, closed) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, wf * F.s);
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = F.s * 0.32 * glow; }
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = xf(pts[i][0], pts[i][1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// shaded metallic armour panel
function panel(ctx, F, xf, pts, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const blue = o.tint === 'blue';

  // drop shadow
  ctx.save();
  trace(ctx, xf, pts);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = F.s * 0.2;
  ctx.shadowOffsetX = F.s * 0.02; ctx.shadowOffsetY = F.s * 0.055;
  ctx.fillStyle = '#06090e';
  ctx.fill();
  ctx.restore();

  // base brushed-metal gradient
  const a = xf(-1.3, 0), b = xf(1.3, 0);
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0.00, blue ? '#081019' : '#090d14');
  g.addColorStop(0.26, blue ? '#1b3346' : '#2b333f');
  g.addColorStop(0.48, blue ? '#4f7e9e' : '#6c7686');
  g.addColorStop(0.59, blue ? '#cfecff' : '#e9eff9');
  g.addColorStop(0.70, blue ? '#3a566c' : '#5e6573');
  g.addColorStop(1.00, blue ? '#070e16' : '#090d14');

  ctx.save();
  trace(ctx, xf, pts);
  ctx.fillStyle = o.fill || g;
  ctx.fill();
  ctx.clip();

  // top-lit sheen for roundness
  const t = xf(0, o.top ?? -1.5), c = xf(0, o.bot ?? 2.2);
  const sg = ctx.createLinearGradient(t.x, t.y, c.x, c.y);
  sg.addColorStop(0.00, 'rgba(255,255,255,0.45)');
  sg.addColorStop(0.18, 'rgba(220,238,255,0.12)');
  sg.addColorStop(0.55, 'rgba(0,0,0,0)');
  sg.addColorStop(1.00, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

  // travelling specular glint
  const gx = 0.5 + 0.5 * Math.sin((o.time || 0) * 0.7 + (o.phase || 0));
  const s0 = xf(-1.3 + gx * 2.6, -1.6), s1 = xf(-0.95 + gx * 2.6, 2.3);
  const st = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
  st.addColorStop(0, 'rgba(255,255,255,0)');
  st.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  st.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = st; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // engraved grooves
  if (o.grooves) for (const gl of o.grooves) {
    strokePts(ctx, F, xf, gl, 'rgba(3,6,10,0.9)', 0.028, 0);
    strokePts(ctx, F, xf, gl, 'rgba(200,220,245,0.14)', 0.008, 0);
  }
  // outer edge + bright silver trim (bevel)
  strokePts(ctx, F, xf, pts, '#04070c', 0.026, 0, true);
  strokePts(ctx, F, xf, pts, 'rgba(206,228,255,0.32)', 0.008, 0, true);
  // emissive accents
  if (o.glow) for (const gl of o.glow)
    strokePts(ctx, F, xf, gl.pts, gl.color || '#8fe8ff', gl.w || 0.02,
      (o.power ?? 0) * (gl.k ?? 1), gl.closed);
  // rivets
  if (o.rivets) for (const r of o.rivets) rivet(ctx, xf, F, r[0], r[1]);
}

function rivet(ctx, xf, F, u, v) {
  const p = xf(u, v);
  const r = Math.max(1.3, F.s * 0.02);
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#d6def0'); g.addColorStop(0.5, '#59616f'); g.addColorStop(1, '#0a0e14');
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
}

function ember(ctx, xf, F, u, v, color, glow, rfac = 0.16) {
  const p = xf(u, v), r = F.s * rfac;
  const g = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = glow;
  ctx.fillStyle = g; ctx.shadowColor = color; ctx.shadowBlur = F.s * 0.5 * glow;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- part geometry ----------------------------------------------------------
const mirror = (pts) => pts.map(([u, v]) => [-u, v]);

const CROWN = [
  [-1.16, -0.30], [-0.60, -1.16], [0, -1.34], [0.60, -1.16], [1.16, -0.30],
  [0.52, -0.18], [0.20, -0.40], [0, -0.28], [-0.20, -0.40], [-0.52, -0.18],
];
const CREST = [[-0.10, -0.45], [-0.06, -1.50], [0, -1.64], [0.06, -1.50], [0.10, -0.45]];

const CHEEK_R = [
  [0.50, -0.08], [0.82, 0.02], [1.20, 0.20], [1.36, 0.62], [1.22, 1.12],
  [0.82, 1.55], [0.50, 1.46], [0.52, 1.00], [0.68, 0.56], [0.60, 0.12],
];
const JAW = [
  [-0.58, 1.20], [0.58, 1.20], [0.72, 1.56], [0.36, 1.98],
  [0, 2.10], [-0.36, 1.98], [-0.72, 1.56],
];
const VISOR = [
  [-1.10, -0.28], [-0.20, -0.28], [0, -0.08], [0.20, -0.28], [1.10, -0.28],
  [0.95, 0.20], [0.50, 0.34], [0, 0.28], [-0.50, 0.34], [-0.95, 0.20],
];
const EYE_R = [[0.26, -0.05], [0.84, -0.18], [0.88, 0.05], [0.70, 0.15], [0.30, 0.13]];
const NOSE = [[-0.12, 0.26], [0.12, 0.26], [0.18, 0.62], [0, 0.90], [-0.16, 0.62]];
const PLATE_R = [[0, 0.60], [0.50, 0.58], [0.62, 1.05], [0.44, 1.50], [0, 1.68]];

// ---- part renderers ---------------------------------------------------------
function drawCheek(ctx, F, p, side, time, power) {
  const cfg = {
    fromU: 2.6 * side, fromV: -0.4, fromRot: -0.55 * side,
    fromScale: 0.68, pivot: [0.95 * side, 0.7],
  };
  const xf = xform(F, flyIn(p, cfg));
  const pts = side === 1 ? CHEEK_R : mirror(CHEEK_R);
  const m = (arr) => arr.map(([u, v]) => [u * side, v]);
  panel(ctx, F, xf, pts, {
    time, power, phase: side, top: -0.1, bot: 1.6,
    grooves: [m([[0.7, 0.18], [1.18, 0.42]]), m([[0.6, 0.95], [1.04, 1.18]]),
              m([[0.78, 0.34], [0.78, 0.52]])],
    glow: [{ pts: m([[0.66, 0.34], [1.0, 0.62], [0.92, 1.05]]), color: '#8fe8ff', w: 0.024, k: 1 }],
    rivets: [[1.12 * side, 0.16], [0.94 * side, 1.3], [1.2 * side, 0.62]],
  });
  // temple intake vents + indicator light
  for (let i = 0; i < 3; i++)
    strokePts(ctx, F, xf, m([[0.66, 0.66 + i * 0.1], [0.95, 0.62 + i * 0.1]]),
      'rgba(4,7,11,0.8)', 0.03, 0);
  ember(ctx, xf, F, 1.16 * side, 0.18, '#8fe8ff', 0.5 * (0.4 + 0.6 * power), 0.07);
}

function drawCrown(ctx, F, p, time, power) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: -2.3, fromRot: 0.4, fromScale: 0.85, pivot: [0, -0.7] }));
  panel(ctx, F, xf, CROWN, {
    time, power, top: -1.5, bot: -0.1,
    grooves: [[[-0.72, -0.55], [0, -0.68], [0.72, -0.55]]],
    glow: [{ pts: [[-0.82, -0.42], [0, -0.30], [0.82, -0.42]], color: '#8fe8ff', w: 0.022, k: 1 }],
    rivets: [[-0.95, -0.34], [0.95, -0.34]],
  });
  panel(ctx, F, xf, CREST, { time, power, tint: 'steel', top: -1.6, bot: -0.4,
    glow: [{ pts: [[0, -0.5], [0, -1.5]], color: '#aef0ff', w: 0.012, k: 1 }] });
  ember(ctx, xf, F, 0, -0.6, '#8fe8ff', 0.45 + 0.55 * power, 0.18);
}

function drawJaw(ctx, F, p, time, power) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: 2.0, fromRot: -0.28, fromScale: 0.82, pivot: [0, 1.6] }));
  panel(ctx, F, xf, JAW, {
    time, power, top: 1.0, bot: 2.15,
    grooves: [[[-0.42, 1.52], [0.42, 1.52]], [[-0.3, 1.74], [0.3, 1.74]]],
    glow: [{ pts: [[-0.34, 1.44], [0, 1.5], [0.34, 1.44]], color: '#8fe8ff', w: 0.02, k: 1 }],
    rivets: [[-0.52, 1.3], [0.52, 1.3]],
  });
  ember(ctx, xf, F, 0, 1.96, '#8fe8ff', 0.3 + 0.5 * power, 0.09);
}

function drawFaceplate(ctx, F, p, time, power) {
  const e = easeOutBack(p), off = (1 - e) * 1.35;
  const rot = (1 - easeOutExpo(p)) * 0.18;
  const xfR = xform(F, { tx: off, ty: 0.1 * (1 - e), rot });
  const xfL = xform(F, { tx: -off, ty: 0.1 * (1 - e), rot: -rot });
  const half = (xf, side) => panel(ctx, F, xf, side === 1 ? PLATE_R : mirror(PLATE_R), {
    time, power, phase: side, top: 0.5, bot: 1.7,
  });
  half(xfR, 1); half(xfL, -1);

  const snap = clamp01((p - 0.6) / 0.4);
  const xf = xform(F, {});
  // vertical mouth-grille slats
  for (let i = -2; i <= 2; i++) {
    const u = i * 0.15;
    strokePts(ctx, F, xf, [[u, 0.98], [u * 0.7, 1.42]], 'rgba(4,7,11,0.85)', 0.03, 0);
  }
  // centre seam ignites on snap
  strokePts(ctx, F, xf, [[0, 0.62], [0, 1.66]], '#aef0ff', 0.014, snap * (0.6 + 0.4 * power));
  strokePts(ctx, F, xf, [[-0.5, 0.6], [0.5, 0.58]], '#8fe8ff', 0.016, snap * (0.5 + 0.5 * power));
}

function drawVisorNose(ctx, F, p, time, power, ignite) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: -0.55, fromScale: 0.92, pivot: [0, 0] }));
  // nose ridge (sits just under the visor bridge)
  panel(ctx, F, xf, NOSE, { time, power, tint: 'steel', top: 0.2, bot: 0.9,
    glow: [{ pts: [[0, 0.34], [0, 0.82]], color: '#8fe8ff', w: 0.01, k: 1 }] });
  // visor shell
  panel(ctx, F, xf, VISOR, {
    time, power: 0, top: -0.3, bot: 0.4, tint: 'steel',
    grooves: [[[-0.92, -0.16], [-0.2, -0.18]], [[0.2, -0.18], [0.92, -0.16]]],
  });
  drawEyes(ctx, xf, F, ignite);
}

function drawEyes(ctx, xf, F, ignite) {
  const eye = (sgn) => {
    const pts = sgn === 1 ? EYE_R : mirror(EYE_R);
    trace(ctx, xf, pts);
    const a = xf(0.3 * sgn, 0.05), b = xf(0.86 * sgn, -0.05);
    const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grd.addColorStop(0, `rgba(120,220,255,${0.3 + 0.7 * ignite})`);
    grd.addColorStop(1, `rgba(232,250,255,${0.45 + 0.55 * ignite})`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd;
    ctx.shadowColor = '#8fe8ff';
    ctx.shadowBlur = F.s * 0.55 * ignite;
    ctx.fill();
    // hot inner core line
    strokePts(ctx, F, xf, [[0.34 * sgn, 0.02], [0.8 * sgn, -0.08]], '#ffffff', 0.012, ignite);
    ctx.restore();
  };
  eye(1); eye(-1);
}

// ---- sequence ---------------------------------------------------------------
const STAGES = [
  { id: 'scan',   dur: 0.55, enter: () => sfx.scanSweep(0.55) },
  { id: 'cheek',  dur: 0.55, enter: () => sfx.whoosh(0.45) },
  { id: 'crown',  dur: 0.50, enter: () => sfx.whoosh(0.45) },
  { id: 'jaw',    dur: 0.45, enter: () => sfx.whoosh(0.4) },
  { id: 'plate',  dur: 0.55, enter: () => sfx.whoosh(0.5) },
  { id: 'visor',  dur: 0.40, enter: () => sfx.whoosh(0.35) },
  { id: 'ignite', dur: 0.40, enter: () => sfx.powerUp(0.5) },
  { id: 'hud',    dur: 0.55, enter: () => sfx.hudBoot() },
];
const IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

// release (disassembly) order + timing
const REL_ORDER = ['plate', 'jaw', 'visor', 'crown', 'cheek'];
const REL_LEAD = 0.28, REL_STAGGER = 0.16, REL_PART = 0.5;
const REL_TOTAL = REL_LEAD + (REL_ORDER.length - 1) * REL_STAGGER + REL_PART + 0.2;

export class Armor {
  constructor(effects) {
    this.fx = effects;
    this.onStage = null;
    this.F = null;
    this.reset(true);
  }

  reset(silent) {
    if (!silent && this.active && !this.releasing) sfx.powerDown();
    this.active = false;
    this.done = false;
    this.releasing = false;
    this.relT = 0;
    this.snap = null;
    this.relFired = {};
    this.stage = -1;
    this.stageT = 0;
    this.time = this.time || 0;
    this.power = 0;
    this.locked = {};
  }

  get isComplete() { return this.done; }
  get isAnimating() { return this.active && !this.done; }
  get isReleasing() { return this.releasing; }

  start() {
    if (this.active && this.stage >= 0) return;
    this.active = true; this.done = false; this.releasing = false;
    this.stage = 0; this.stageT = 0; this.locked = {};
    STAGES[0].enter();
    if (this.onStage) this.onStage('SCAN…');
  }

  disengage() {
    if (!this.active || this.releasing) return;
    this.releasing = true;
    this.relT = 0;
    this.relFired = {};
    this.snap = {};
    for (const id of REL_ORDER) this.snap[id] = this._p(id);
    sfx.powerDown(0.55);
    this.fx.doFlash(0.12, '150,232,255');
    if (this.onStage) this.onStage('DISENGAGE…');
  }

  _p(id) {
    const i = IDX[id];
    if (this.stage < 0) return 0;
    if (i < this.stage) return 1;
    if (i > this.stage) return 0;
    return clamp01(this.stageT / STAGES[i].dur);
  }

  // entry progress for a part while releasing (retraces fly-in outward)
  _relEntry(id) {
    const i = REL_ORDER.indexOf(id);
    const s = this.relT - REL_LEAD - i * REL_STAGGER;
    const exitP = clamp01(s / REL_PART);
    const base = (this.snap && this.snap[id]) || 0;
    return base * (1 - easeInCubic(exitP));
  }

  _impact(id) {
    if (this.locked[id] || !this.F) return;
    this.locked[id] = true;
    const at = (u, v) => this.F.to(u, v);
    switch (id) {
      case 'cheek': {
        const r = at(1.0, 0.8), l = at(-1.0, 0.8);
        this.fx.burst(r.x, r.y, 14); this.fx.burst(l.x, l.y, 14);
        this.fx.shake(7); sfx.clickLock(); break;
      }
      case 'crown': { const c = at(0, -0.9); this.fx.burst(c.x, c.y, 16); this.fx.shake(7); sfx.clickLock(); break; }
      case 'jaw': { const c = at(0, 1.9); this.fx.burst(c.x, c.y, 18); this.fx.shake(9); this.fx.doFlash(0.12); sfx.heavyLock(); break; }
      case 'plate': {
        const c = at(0, 1.0);
        this.fx.burst(c.x, c.y, 24, { speed: 1.3 });
        this.fx.ring(c.x, c.y, 18, 260);
        this.fx.shake(13); this.fx.doFlash(0.28, '210,240,255'); sfx.heavyLock(); break;
      }
      case 'ignite': {
        const r = at(0.5, 0), l = at(-0.5, 0);
        this.fx.burst(r.x, r.y, 10); this.fx.burst(l.x, l.y, 10);
        this.fx.doFlash(0.25, '150,232,255'); this.fx.shake(5); break;
      }
    }
  }

  _releaseFx() {
    if (!this.F) return;
    for (let i = 0; i < REL_ORDER.length; i++) {
      const id = REL_ORDER[i];
      if (this.relFired[id]) continue;
      if (this.relT >= REL_LEAD + i * REL_STAGGER) {
        this.relFired[id] = true;
        const anchor = { plate: [0, 1.0], jaw: [0, 1.9], visor: [0, 0], crown: [0, -0.9], cheek: [1.0, 0.8] }[id];
        const a = this.F.to(anchor[0], anchor[1]);
        this.fx.burst(a.x, a.y, 10, { color: 'cyan', speed: 0.8 });
        if (id === 'cheek') { const l = this.F.to(-1.0, 0.8); this.fx.burst(l.x, l.y, 10); }
        this.fx.shake(id === 'plate' ? 8 : 5);
        sfx.whoosh(0.3);
      }
    }
  }

  update(dt) {
    this.time += dt;

    if (this.releasing) {
      this.relT += dt;
      this.power += (0 - this.power) * (1 - Math.pow(0.0004, dt));
      this._releaseFx();
      if (this.relT >= REL_TOTAL) {
        this.reset(true);
        if (this.onStage) this.onStage(null);
      }
      return;
    }

    if (!this.active || this.stage < 0) return;

    const ignited = this.stage >= IDX.ignite;
    this.power += ((ignited ? 1 : 0) - this.power) * (1 - Math.pow(0.001, dt));

    if (this.done) return;
    this.stageT += dt;
    const st = STAGES[this.stage];
    if (this.stageT / st.dur > 0.82) this._impact(st.id);

    if (this.stageT >= st.dur) {
      this.stageT -= st.dur;
      this.stage++;
      if (this.stage >= STAGES.length) {
        this.stage = STAGES.length - 1;
        this.stageT = STAGES[this.stage].dur;
        this.done = true;
        if (this.F) {
          const c = this.F.to(0, 0.4);
          this.fx.ring(c.x, c.y, 28, 360);
          this.fx.doFlash(0.3, '180,240,255'); this.fx.shake(8);
        }
        sfx.chord();
        if (this.onStage) this.onStage('変身完了 — SUIT ONLINE');
      } else {
        STAGES[this.stage].enter();
        if (this.onStage) this.onStage(label(STAGES[this.stage].id));
      }
    }
  }

  draw(ctx, F) {
    this.F = F;
    if (this.stage < 0 && !this.releasing) return;
    const time = this.time, power = this.power;
    const ent = (id) => (this.releasing ? this._relEntry(id) : this._p(id));

    if (!this.releasing) {
      const pScan = this._p('scan');
      if (pScan > 0 && this._p('cheek') === 0) drawScan(ctx, F, pScan);
    }

    const ignite = this.releasing ? this.power : clamp01(this._p('ignite') + this.power);

    const pCheek = ent('cheek'), pCrown = ent('crown'), pJaw = ent('jaw'),
      pPlate = ent('plate'), pVisor = ent('visor');

    ctx.save();
    if (pCheek > 0) { drawCheek(ctx, F, pCheek, 1, time, power); drawCheek(ctx, F, pCheek, -1, time, power); }
    if (pCrown > 0) drawCrown(ctx, F, pCrown, time, power);
    if (pJaw > 0) drawJaw(ctx, F, pJaw, time, power);
    if (pPlate > 0) drawFaceplate(ctx, F, pPlate, time, power);
    if (pVisor > 0) drawVisorNose(ctx, F, pVisor, time, power, Math.min(1, ignite));
    ctx.restore();
  }
}

function drawScan(ctx, F, p) {
  const v = -0.7 + p * 1.4;
  const a = F.to(-1.3, v), b = F.to(1.3, v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(150,232,255,0.9)';
  ctx.shadowColor = '#8fe8ff'; ctx.shadowBlur = F.s * 0.5;
  ctx.lineWidth = Math.max(2, F.s * 0.04);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, F.s * 0.012);
  const box = [F.to(-1.2, -0.8), F.to(1.2, -0.8), F.to(1.2, 0.8), F.to(-1.2, 0.8)];
  ctx.beginPath(); ctx.moveTo(box[0].x, box[0].y);
  for (const q of box.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

function label(id) {
  return ({
    cheek: 'CHEEK ARMOR', crown: 'CROWN DEPLOY', jaw: 'JAW LOCK',
    plate: 'FACEPLATE MERGE', visor: 'VISOR SET', ignite: 'IGNITION', hud: 'HUD BOOT',
  })[id] || id.toUpperCase();
}

export { STAGES };
