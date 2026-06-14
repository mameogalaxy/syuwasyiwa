// Cinematic mecha-mask assembly.
//
// Parts are authored in normalised "face space":
//   origin (0,0) = midpoint between the eyes
//   +u          = toward the right eye (horizontal)
//   +v          = toward the chin (vertical)
//   1 unit      = inter-ocular distance
// A FaceFrame maps that onto the (mirrored) screen canvas so every panel sticks
// to the face and rotates with the head.
//
// Design language: matte-black + brushed-silver armour with blue-white emissive
// lines. Original near-future look (not modelled on any existing property).
// MVP renders with 2D canvas; the part list / face-space authoring is structured
// so individual panels could later be swapped for 3D meshes.

import * as sfx from './sound.js';

// ---- MediaPipe FaceMesh landmark indices we sample --------------------------
const L_EYE = [33, 133, 159, 145];
const R_EYE = [263, 362, 386, 374];
const CHIN = 152;

// ---- easing -----------------------------------------------------------------
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
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

// A transform that nests a part-local rotate/scale/translate inside the frame,
// used to make panels fly/rotate/scale into place.
function xform(F, { tx = 0, ty = 0, rot = 0, scale = 1, pivot = [0, 0] }) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (u, v) => {
    let du = (u - pivot[0]) * scale, dv = (v - pivot[1]) * scale;
    const ru = pivot[0] + du * c - dv * s + tx;
    const rv = pivot[1] + du * s + dv * c + ty;
    return F.to(ru, rv);
  };
}

// fly-in animation params for progress p (0..1)
function flyIn(p, cfg) {
  const e = easeOutBack(p);
  const er = easeOutExpo(p);
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

function strokePath(ctx, F, xf, pts, color, wf, glow) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, wf * F.s);
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = F.s * 0.3 * glow; }
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = xf(pts[i][0], pts[i][1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

// A fully shaded metallic armour panel.
//   o.grooves: [[ [u,v]... ], ...]   dark engraved panel lines
//   o.glow:    [{pts, color, w}]     emissive accent lines (scaled by o.power)
//   o.rivets:  [[u,v], ...]
//   o.tint:    'steel' | 'blue'
function panel(ctx, F, xf, pts, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // drop shadow for lift off the face
  ctx.save();
  trace(ctx, xf, pts);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = F.s * 0.18;
  ctx.shadowOffsetX = F.s * 0.02;
  ctx.shadowOffsetY = F.s * 0.05;
  ctx.fillStyle = '#080b11';
  ctx.fill();
  ctx.restore();

  // base brushed-metal gradient across the part
  const a = xf(-1.3, 0), b = xf(1.3, 0);
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  const blue = o.tint === 'blue';
  g.addColorStop(0.00, blue ? '#0a141f' : '#0c1118');
  g.addColorStop(0.28, blue ? '#1f3a52' : '#333c49');
  g.addColorStop(0.50, blue ? '#5f8fb0' : '#828c9b');
  g.addColorStop(0.60, blue ? '#cfeaff' : '#e8eefb');
  g.addColorStop(0.72, blue ? '#43617a' : '#737d8d');
  g.addColorStop(1.00, blue ? '#0a141f' : '#0c1118');

  ctx.save();
  trace(ctx, xf, pts);
  ctx.fillStyle = o.fill || g;
  ctx.fill();

  // clip and lay a top-lit sheen for a rounded, 3D feel
  ctx.clip();
  const t = xf(0, o.top ?? -1.5), c = xf(0, o.bot ?? 2.2);
  const sg = ctx.createLinearGradient(t.x, t.y, c.x, c.y);
  sg.addColorStop(0.00, 'rgba(255,255,255,0.40)');
  sg.addColorStop(0.20, 'rgba(220,238,255,0.10)');
  sg.addColorStop(0.55, 'rgba(0,0,0,0.0)');
  sg.addColorStop(1.00, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // a moving specular streak (brushed-metal glint)
  const ph = (o.time || 0) * 0.6;
  const gx = 0.5 + 0.5 * Math.sin(ph);
  const s0 = xf(-1.3 + gx * 2.6, -1.5), s1 = xf(-1.0 + gx * 2.6, 2.2);
  const st = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
  st.addColorStop(0, 'rgba(255,255,255,0)');
  st.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  st.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = st;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // engraved panel grooves
  if (o.grooves)
    for (const gl of o.grooves) {
      strokePath(ctx, F, xf, gl, 'rgba(4,7,11,0.85)', 0.03, 0);
      strokePath(ctx, F, xf, gl, 'rgba(190,210,235,0.12)', 0.008, 0);
    }

  // outer edge + faint rim light (bevel)
  strokePath(ctx, F, xf, pts, '#05080d', 0.024, 0);
  strokePath(ctx, F, xf, pts, 'rgba(200,224,255,0.22)', 0.007, 0);

  // emissive accent lines
  if (o.glow)
    for (const gl of o.glow)
      strokePath(ctx, F, xf, gl.pts, gl.color || '#8fe8ff', gl.w || 0.02,
        (o.power ?? 0) * (gl.k ?? 1));

  // rivets
  if (o.rivets) for (const r of o.rivets) rivet(ctx, xf, F, r[0], r[1]);
}

function rivet(ctx, xf, F, u, v) {
  const p = xf(u, v);
  const r = Math.max(1.4, F.s * 0.022);
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#cfd8e6');
  g.addColorStop(0.5, '#5c6573');
  g.addColorStop(1, '#0c1016');
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function emberDot(ctx, xf, F, u, v, color, glow, rfac = 0.16) {
  const p = xf(u, v);
  const r = F.s * rfac;
  const g = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = glow;
  ctx.fillStyle = g;
  ctx.shadowColor = color;
  ctx.shadowBlur = F.s * 0.5 * glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- part geometry ----------------------------------------------------------
const CHEEK_R = [
  [0.52, -0.18], [1.12, -0.06], [1.36, 0.42], [1.28, 1.04],
  [0.92, 1.56], [0.52, 1.52], [0.46, 0.98], [0.58, 0.46], [0.58, 0.02],
];
const CROWN = [
  [-1.18, -0.34], [-0.72, -1.12], [0, -1.36], [0.72, -1.12], [1.18, -0.34],
  [0.86, -0.18], [0, -0.44], [-0.86, -0.18],
];
const JAW = [
  [-0.58, 1.22], [0.58, 1.22], [0.7, 1.58], [0.34, 1.98],
  [0, 2.08], [-0.34, 1.98], [-0.7, 1.58],
];
const PLATE_R = [
  [0.0, 0.42], [0.52, 0.36], [0.66, 0.96], [0.46, 1.52], [0.0, 1.72],
];
const VISOR = [
  [-1.06, -0.36], [1.06, -0.36], [0.9, 0.3], [0, 0.46], [-0.9, 0.3],
];

const mirror = (pts) => pts.map(([u, v]) => [-u, v]);

// ---- individual part renderers ---------------------------------------------
function drawCheek(ctx, F, p, side, time, power) {
  const cfg = side === 1
    ? { fromU: 2.4, fromV: -0.3, fromRot: -0.5, fromScale: 0.7, pivot: [0.9, 0.7] }
    : { fromU: -2.4, fromV: -0.3, fromRot: 0.5, fromScale: 0.7, pivot: [-0.9, 0.7] };
  const xf = xform(F, flyIn(p, cfg));
  const pts = side === 1 ? CHEEK_R : mirror(CHEEK_R);
  const m = (a) => a.map(([u, v]) => [u * side, v]);
  panel(ctx, F, xf, pts, {
    time, power, top: -0.3, bot: 1.7,
    grooves: [m([[0.62, 0.2], [1.18, 0.5]]), m([[0.55, 0.95], [1.05, 1.2]])],
    glow: [{ pts: m([[0.66, 0.32], [1.06, 0.95]]), color: '#8fe8ff', w: 0.026, k: 1 }],
    rivets: [[1.1 * side, 0.0], [0.92 * side, 1.32], [1.18 * side, 0.62]],
  });
}

function drawCrown(ctx, F, p, time, power) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: -2.2, fromRot: 0.45, fromScale: 0.82, pivot: [0, -0.7] }));
  panel(ctx, F, xf, CROWN, {
    time, power, top: -1.5, bot: 0,
    grooves: [[[-0.7, -0.5], [0, -0.6], [0.7, -0.5]]],
    glow: [
      { pts: [[-0.8, -0.4], [0, -0.52], [0.8, -0.4]], color: '#8fe8ff', w: 0.022, k: 1 },
    ],
    rivets: [[-0.92, -0.3], [0.92, -0.3]],
  });
  // central crest fin (separate raised piece)
  panel(ctx, F, xf, [[-0.12, -0.4], [-0.05, -1.46], [0.05, -1.46], [0.12, -0.4]], {
    time, power, tint: 'steel', top: -1.5, bot: -0.4,
  });
  // forehead core gem
  emberDot(ctx, xf, F, 0, -0.66, '#8fe8ff', 0.4 + 0.6 * power, 0.17);
}

function drawJaw(ctx, F, p, time, power) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: 1.9, fromRot: -0.3, fromScale: 0.8, pivot: [0, 1.6] }));
  panel(ctx, F, xf, JAW, {
    time, power, top: 1.0, bot: 2.1,
    grooves: [[[-0.4, 1.5], [0.4, 1.5]], [[-0.28, 1.7], [0.28, 1.7]]],
    glow: [{ pts: [[-0.32, 1.42], [0.32, 1.42]], color: '#8fe8ff', w: 0.02, k: 1 }],
    rivets: [[-0.5, 1.32], [0.5, 1.32]],
  });
}

function drawFaceplate(ctx, F, p, time, power) {
  // two halves slide in from the sides and snap together at the centre line
  const e = easeOutBack(p);
  const off = (1 - e) * 1.3;
  const xfR = xform(F, { tx: off, ty: 0, rot: (1 - easeOutExpo(p)) * 0.2 });
  const xfL = xform(F, { tx: -off, ty: 0, rot: -(1 - easeOutExpo(p)) * 0.2 });
  const plate = (xf, side) => panel(ctx, F, xf, side === 1 ? PLATE_R : mirror(PLATE_R), {
    time, power, top: 0.3, bot: 1.7, tint: 'steel',
    grooves: [side === 1
      ? [[0.12, 0.6], [0.5, 0.7], [0.42, 1.3]]
      : [[-0.12, 0.6], [-0.5, 0.7], [-0.42, 1.3]]],
  });
  plate(xfR, 1); plate(xfL, -1);
  // breathing vents + centre seam, brighten when snapped
  const snap = clamp01((p - 0.6) / 0.4);
  const xf = xform(F, {});
  for (let i = 0; i < 3; i++) {
    const v = 0.92 + i * 0.2;
    strokePath(ctx, F, xf, [[-0.34 + i * 0.04, v], [0.34 - i * 0.04, v]],
      'rgba(6,10,16,0.85)', 0.05, 0);
  }
  strokePath(ctx, F, xf, [[0, 0.45], [0, 1.7]], '#aef0ff', 0.016, snap * (0.6 + 0.4 * power));
}

function drawVisor(ctx, F, p, time, power, ignite) {
  const xf = xform(F, flyIn(p, { fromU: 0, fromV: -0.5, fromRot: 0, fromScale: 0.92, pivot: [0, 0] }));
  panel(ctx, F, xf, VISOR, {
    time, power: 0, top: -0.4, bot: 0.45, tint: 'steel',
    grooves: [[[-0.9, -0.2], [0.9, -0.2]]],
  });
  // glowing eye slits
  const slit = (sgn) => {
    const pts = [[0.2 * sgn, -0.02], [0.74 * sgn, -0.16], [0.8 * sgn, 0.08], [0.26 * sgn, 0.14]];
    trace(ctx, xf, pts);
    const a = xf(0.2 * sgn, 0.05), b = xf(0.8 * sgn, 0.0);
    const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grd.addColorStop(0, `rgba(120,220,255,${0.35 + 0.65 * ignite})`);
    grd.addColorStop(1, `rgba(230,250,255,${0.5 + 0.5 * ignite})`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd;
    ctx.shadowColor = '#8fe8ff';
    ctx.shadowBlur = F.s * 0.5 * ignite;
    ctx.fill();
    ctx.restore();
  };
  slit(1); slit(-1);
}

// ---- the assembly sequence --------------------------------------------------
// Total ~3.5s, tuned for a punchy short-video transformation.
const STAGES = [
  { id: 'scan',  dur: 0.55, enter: () => sfx.scanSweep(0.55) },
  { id: 'cheek', dur: 0.55, enter: () => sfx.whoosh(0.45) },
  { id: 'crown', dur: 0.50, enter: () => sfx.whoosh(0.45) },
  { id: 'jaw',   dur: 0.45, enter: () => sfx.whoosh(0.4) },
  { id: 'plate', dur: 0.55, enter: () => sfx.whoosh(0.5) },
  { id: 'visor', dur: 0.40, enter: () => sfx.whoosh(0.35) },
  { id: 'ignite',dur: 0.40, enter: () => sfx.powerUp(0.5) },
  { id: 'hud',   dur: 0.55, enter: () => sfx.hudBoot() },
];
const IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

export class Armor {
  constructor(effects) {
    this.fx = effects;
    this.reset(true);
    this.onStage = null;
    this.F = null;
  }

  reset(silent) {
    if (!silent && this.active) sfx.powerDown();
    this.active = false;
    this.done = false;
    this.stage = -1;
    this.stageT = 0;
    this.time = 0;
    this.power = 0;
    this.locked = {};
  }

  get isComplete() { return this.done; }
  get isAnimating() { return this.active && !this.done; }

  start() {
    if (this.active && this.stage >= 0) return;
    this.active = true;
    this.done = false;
    this.stage = 0;
    this.stageT = 0;
    this.locked = {};
    STAGES[0].enter();
    if (this.onStage) this.onStage('SCAN…');
  }

  disengage() { this.reset(false); if (this.onStage) this.onStage(null); }

  // progress (0..1) for a given stage id at the current playback position
  _p(id) {
    const i = IDX[id];
    if (this.stage < 0) return 0;
    if (i < this.stage) return 1;
    if (i > this.stage) return 0;
    return clamp01(this.stageT / STAGES[i].dur);
  }

  // fire the satisfying "lock" impact for the stage that just snapped in
  _impact(id) {
    if (this.locked[id] || !this.F) return;
    this.locked[id] = true;
    const at = (u, v) => this.F.to(u, v);
    const sp = (x, y, n, mag, col) => { this.fx.burst(x, y, n, { color: col }); this.fx.shake(mag); };
    switch (id) {
      case 'cheek': {
        const r = at(1.0, 0.8), l = at(-1.0, 0.8);
        this.fx.burst(r.x, r.y, 14); this.fx.burst(l.x, l.y, 14);
        this.fx.shake(7); sfx.clickLock();
        break;
      }
      case 'crown': {
        const c = at(0, -0.9); sp(c.x, c.y, 16, 7); sfx.clickLock();
        break;
      }
      case 'jaw': {
        const c = at(0, 1.85); sp(c.x, c.y, 18, 9); this.fx.doFlash(0.12);
        sfx.heavyLock();
        break;
      }
      case 'plate': {
        const c = at(0, 1.0); this.fx.burst(c.x, c.y, 24, { speed: 1.3 });
        this.fx.ring(c.x, c.y, 18, 260); this.fx.shake(13);
        this.fx.doFlash(0.28, '210,240,255'); sfx.heavyLock();
        break;
      }
      case 'ignite': {
        const r = at(0.5, 0), l = at(-0.5, 0);
        this.fx.burst(r.x, r.y, 10); this.fx.burst(l.x, l.y, 10);
        this.fx.doFlash(0.25, '150,232,255'); this.fx.shake(5);
        break;
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (!this.active || this.stage < 0) return;

    // smooth power for emissive/HUD ramp (rises from the ignite stage)
    const ignited = this.stage >= IDX.ignite;
    const target = ignited ? 1 : 0;
    this.power += (target - this.power) * (1 - Math.pow(0.001, dt));

    if (this.done) return;
    this.stageT += dt;
    const st = STAGES[this.stage];

    // trigger lock impact partway through the relevant stages
    if (this.stageT / st.dur > 0.82) this._impact(st.id);

    if (this.stageT >= st.dur) {
      this.stageT -= st.dur;
      this.stage++;
      if (this.stage >= STAGES.length) {
        this.stage = STAGES.length - 1;
        this.stageT = STAGES[this.stage].dur;
        this.done = true;
        // grand finale
        if (this.F) {
          const c = this.F.to(0, 0.4);
          this.fx.ring(c.x, c.y, 28, 360);
          this.fx.doFlash(0.3, '180,240,255');
          this.fx.shake(8);
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
    if (this.stage < 0) return;
    const time = this.time, power = this.power;

    const pScan = this._p('scan');
    const pCheek = this._p('cheek');
    const pCrown = this._p('crown');
    const pJaw = this._p('jaw');
    const pPlate = this._p('plate');
    const pVisor = this._p('visor');
    const ignite = clamp01(this._p('ignite') + (this.power));

    // S1: eye-scan beam (before any part lands)
    if (pScan > 0 && pCheek === 0) drawScan(ctx, F, pScan);

    ctx.save();
    // back-to-front layering
    if (pCheek > 0) { drawCheek(ctx, F, pCheek, 1, time, power); drawCheek(ctx, F, pCheek, -1, time, power); }
    if (pCrown > 0) drawCrown(ctx, F, pCrown, time, power);
    if (pJaw > 0) drawJaw(ctx, F, pJaw, time, power);
    if (pPlate > 0) drawFaceplate(ctx, F, pPlate, time, power);
    if (pVisor > 0) drawVisor(ctx, F, pVisor, time, power, Math.min(1, ignite));
    ctx.restore();
  }
}

function drawScan(ctx, F, p) {
  // a bright horizontal beam sweeping down across the eyes
  const v = -0.7 + p * 1.4;
  const a = F.to(-1.3, v), b = F.to(1.3, v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(150,232,255,0.9)';
  ctx.shadowColor = '#8fe8ff';
  ctx.shadowBlur = F.s * 0.5;
  ctx.lineWidth = Math.max(2, F.s * 0.04);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  // faint targeting box
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, F.s * 0.012);
  const box = [F.to(-1.2, -0.8), F.to(1.2, -0.8), F.to(1.2, 0.8), F.to(-1.2, 0.8)];
  ctx.beginPath();
  ctx.moveTo(box[0].x, box[0].y);
  for (const q of box.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

function label(id) {
  return ({
    cheek: 'CHEEK ARMOR', crown: 'CROWN DEPLOY', jaw: 'JAW LOCK',
    plate: 'FACEPLATE MERGE', visor: 'VISOR SET', ignite: 'IGNITION',
    hud: 'HUD BOOT',
  })[id] || id.toUpperCase();
}

export { STAGES };
