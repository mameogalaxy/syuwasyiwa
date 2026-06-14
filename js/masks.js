// Mask library. Each mask = a set of parts that fly in and assemble onto the
// face. The Transformer engine runs the assemble/disassemble sequence and
// effects generically; here we only describe geometry + look + timing.
//
// part = {
//   dur, anchor:[u,v], lock:{sound:'click'|'heavy'|null, shake, burst, flash},
//   draw(ctx, F, p, env)   // p = entry progress 0..1, env={time,power,ignite}
// }
// mask = { id, name, emoji, intro?, glow?, hud?, finale?, parts:[...] }

import {
  fly, shape, metal, strokePts, discU, sphere, ember, mirror, clamp01, trace,
  easeOutBack, easeOutExpo, FACE_OVAL,
} from './gfx.js?v=9';

const L = strokePts;
const both = (fn) => (ctx, F, p, env) => { fn(ctx, F, p, env, 1); fn(ctx, F, p, env, -1); };

// ============================================================ MECHA =========
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
const MNOSE = [[-0.12, 0.26], [0.12, 0.26], [0.18, 0.62], [0, 0.90], [-0.16, 0.62]];
const PLATE_R = [[0, 0.60], [0.50, 0.58], [0.62, 1.05], [0.44, 1.50], [0, 1.68]];

function mechaCheek(ctx, F, p, env, side) {
  const xf = fly(F, p, { fromU: 2.6 * side, fromV: -0.4, fromRot: -0.55 * side, fromScale: 0.68, pivot: [0.95 * side, 0.7] });
  const m = (arr) => arr.map(([u, v]) => [u * side, v]);
  metal(ctx, F, xf, side === 1 ? CHEEK_R : mirror(CHEEK_R), {
    time: env.time, power: env.power, phase: side, top: -0.1, bot: 1.6,
    grooves: [m([[0.7, 0.18], [1.18, 0.42]]), m([[0.6, 0.95], [1.04, 1.18]])],
    glow: [{ pts: m([[0.66, 0.34], [1.0, 0.62], [0.92, 1.05]]), color: '#8fe8ff', w: 0.024, k: 1 }],
    rivets: [[1.12 * side, 0.16], [0.94 * side, 1.3]],
  });
  ember(ctx, xf, F, 1.16 * side, 0.18, '#8fe8ff', 0.5 * (0.4 + 0.6 * env.power), 0.07);
}
function mechaCrown(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -2.3, fromRot: 0.4, fromScale: 0.85, pivot: [0, -0.7] });
  metal(ctx, F, xf, CROWN, {
    time: env.time, power: env.power, top: -1.5, bot: -0.1,
    grooves: [[[-0.72, -0.55], [0, -0.68], [0.72, -0.55]]],
    glow: [{ pts: [[-0.82, -0.42], [0, -0.30], [0.82, -0.42]], color: '#8fe8ff', w: 0.022, k: 1 }],
    rivets: [[-0.95, -0.34], [0.95, -0.34]],
  });
  metal(ctx, F, xf, CREST, { time: env.time, power: env.power, top: -1.6, bot: -0.4 });
  ember(ctx, xf, F, 0, -0.6, '#8fe8ff', 0.45 + 0.55 * env.power, 0.18);
}
function mechaJaw(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 2.0, fromRot: -0.28, fromScale: 0.82, pivot: [0, 1.6] });
  metal(ctx, F, xf, JAW, {
    time: env.time, power: env.power, top: 1.0, bot: 2.15,
    grooves: [[[-0.42, 1.52], [0.42, 1.52]], [[-0.3, 1.74], [0.3, 1.74]]],
    glow: [{ pts: [[-0.34, 1.44], [0, 1.5], [0.34, 1.44]], color: '#8fe8ff', w: 0.02, k: 1 }],
  });
}
function mechaPlate(ctx, F, p, env) {
  const e = easeOutBack(p), off = (1 - e) * 1.35, rot = (1 - easeOutExpo(p)) * 0.18;
  // two halves slide in from the sides and snap together at the centre line
  const drawHalf = (side) => {
    const xf = (u, v) => {
      const a = Math.cos(rot * side), b = Math.sin(rot * side);
      return F.to(u * a - v * b + off * side, u * b + v * a);
    };
    metal(ctx, F, xf, side === 1 ? PLATE_R : mirror(PLATE_R), { time: env.time, power: env.power, phase: side, top: 0.5, bot: 1.7 });
  };
  drawHalf(1); drawHalf(-1);
  const snap = clamp01((p - 0.6) / 0.4);
  const xf = (u, v) => F.to(u, v);
  for (let i = -2; i <= 2; i++) L(ctx, F, xf, [[i * 0.15, 0.98], [i * 0.1, 1.42]], 'rgba(4,7,11,0.85)', 0.03, 0);
  L(ctx, F, xf, [[0, 0.62], [0, 1.66]], '#aef0ff', 0.014, snap * (0.6 + 0.4 * env.power));
}
function mechaVisor(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.55, fromScale: 0.92 });
  metal(ctx, F, xf, MNOSE, { time: env.time, power: env.power, tint: 'steel', top: 0.2, bot: 0.9 });
  metal(ctx, F, xf, VISOR, { time: env.time, power: 0, tint: 'steel', top: -0.3, bot: 0.4,
    grooves: [[[-0.92, -0.16], [-0.2, -0.18]], [[0.2, -0.18], [0.92, -0.16]]] });
  const ig = env.ignite;
  for (const sgn of [1, -1]) {
    trace(ctx, xf, sgn === 1 ? EYE_R : mirror(EYE_R));
    const a = xf(0.3 * sgn, 0.05), b = xf(0.86 * sgn, -0.05);
    const grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grd.addColorStop(0, `rgba(120,220,255,${0.3 + 0.7 * ig})`);
    grd.addColorStop(1, `rgba(232,250,255,${0.45 + 0.55 * ig})`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd; ctx.shadowColor = '#8fe8ff'; ctx.shadowBlur = F.s * 0.55 * ig; ctx.fill();
    ctx.restore();
  }
}

const MECHA = {
  id: 'mecha', name: 'メカ', emoji: '🤖', intro: 'scan', glow: true, hud: true,
  parts: [
    { dur: 0.55, anchor: [1.0, 0.8], lock: { sound: 'click', shake: 7, burst: 14, both: true }, draw: both(mechaCheek) },
    { dur: 0.50, anchor: [0, -0.9], lock: { sound: 'click', shake: 7, burst: 16 }, draw: mechaCrown },
    { dur: 0.45, anchor: [0, 1.9], lock: { sound: 'heavy', shake: 9, burst: 18, flash: 0.12 }, draw: mechaJaw },
    { dur: 0.55, anchor: [0, 1.0], lock: { sound: 'heavy', shake: 13, burst: 24, flash: 0.28, ring: true }, draw: mechaPlate },
    { dur: 0.40, anchor: [0, 0], lock: { sound: null, shake: 4 }, draw: mechaVisor },
  ],
};

// shared face base used by the character masks
function skin(ctx, F, p, env, cols, extra) {
  const xf = fly(F, p, { fromScale: 0.5, pivot: [0, 0.5] });
  shape(ctx, F, xf, FACE_OVAL, Object.assign({
    c0: cols[0], c1: cols[1], c2: cols[2], outline: cols[3] || 'rgba(0,0,0,0.5)',
    top: -1.2, bot: 2.0, spec: [-0.4, -0.35], specR: 0.7, hi: 0.3,
  }, extra || {}));
  return xf;
}

// ============================================================ TENGU =========
function tenguFace(ctx, F, p, env) {
  skin(ctx, F, p, env, ['#6e0c0c', '#c81f1f', '#f06a4e'], {
    spec: [-0.35, -0.45], specR: 0.62, hi: 0.34, top: -1.25, bot: 2.0,
  });
}

// The signature long nose: a long red wedge down the centre with a bright
// rounded ridge highlight, a dark underside / nostril shadow, then a bulbous
// shaded tip rendered as a sphere. Flies forward (pops toward camera).
function tenguNose(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.7, fromScale: 0.32, pivot: [0, 0.35] });
  const NOSE = [
    [-0.20, -0.18], [0.20, -0.18],
    [0.26, 0.30], [0.24, 0.85], [0.20, 1.30],
    [0.13, 1.62], [0, 1.74],
    [-0.13, 1.62], [-0.20, 1.30],
    [-0.24, 0.85], [-0.26, 0.30],
  ];
  shape(ctx, F, xf, NOSE, {
    c0: '#7c1010', c1: '#d23022', c2: '#ff7a5c',
    outline: 'rgba(60,6,6,0.55)', ow: 0.02,
    top: -0.18, bot: 1.5, spec: [-0.05, 0.35], specR: 0.24, hi: 0.36,
    grooves: [
      [[-0.16, 1.34], [-0.10, 1.58]],
      [[0.16, 1.34], [0.10, 1.58]],
    ],
  });
  L(ctx, F, xf, [[-0.02, 0.0], [0, 0.6], [0.01, 1.1], [0, 1.45]],
    'rgba(255,200,180,0.6)', 0.055, 0);
  L(ctx, F, xf, [[-0.18, 1.46], [0, 1.6], [0.18, 1.46]],
    'rgba(70,6,6,0.5)', 0.07, 0);
  sphere(ctx, F, xf, 0, 1.66, 0.27, '#a81818', '#ff8c6e', 'rgba(60,6,6,0.6)');
  for (const s of [1, -1])
    discU(ctx, F, xf, 0.09 * s, 1.74, 0.05,
      [[0, 'rgba(50,4,4,0.95)'], [1, 'rgba(50,4,4,0.4)']]);
}

// Thick white bushy angry eyebrows, angled inward (inner end low, outer high).
function tenguBrows(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.5, fromScale: 0.7, pivot: [0, -0.35] });
  for (const s of [1, -1]) {
    const BROW = [
      [0.16 * s, -0.10], [0.50 * s, -0.40], [0.92 * s, -0.62],
      [1.06 * s, -0.50], [0.78 * s, -0.30], [0.46 * s, -0.18], [0.22 * s, 0.06],
    ];
    shape(ctx, F, xf, BROW, {
      c0: '#b9b9b9', c1: '#f2f2f2', c2: '#ffffff',
      outline: 'rgba(110,110,110,0.55)', ow: 0.016, gloss: false,
    });
    L(ctx, F, xf, [[0.30 * s, -0.16], [0.62 * s, -0.42], [0.96 * s, -0.58]],
      'rgba(210,210,210,0.7)', 0.02, 0);
  }
}

// White bushy mustache/beard around an angry downturned mouth.
function tenguMustache(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 1.4, fromScale: 0.7, pivot: [0, 1.25] });
  shape(ctx, F, xf, [
    [-0.34, 1.18], [0, 1.10], [0.34, 1.18],
    [0.24, 1.30], [0, 1.24], [-0.24, 1.30],
  ], { c0: '#2a0606', c1: '#5a0e0e', c2: '#7c1414', gloss: false, outline: 'rgba(0,0,0,0.5)' });
  const STACHE = [
    [-0.70, 1.06], [-0.30, 1.18], [0, 1.12], [0.30, 1.18], [0.70, 1.06],
    [0.98, 1.30], [0.70, 1.40], [0.42, 1.34],
    [0.28, 1.70], [0, 1.86], [-0.28, 1.70],
    [-0.42, 1.34], [-0.70, 1.40], [-0.98, 1.30],
  ];
  shape(ctx, F, xf, STACHE, {
    c0: '#c4c4c4', c1: '#f4f4f4', c2: '#ffffff',
    outline: 'rgba(120,120,120,0.55)', ow: 0.016, gloss: false,
    grooves: [
      [[-0.6, 1.18], [-0.2, 1.30]],
      [[0.6, 1.18], [0.2, 1.30]],
      [[-0.1, 1.42], [0, 1.7], [0.1, 1.42]],
    ],
  });
}

// Small black 'tokin' pillbox cap on the forehead, with a thin gold band.
function tenguCap(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -2.1, fromRot: 0.3, fromScale: 0.55, pivot: [0, -1.0] });
  shape(ctx, F, xf, [
    [-0.30, -0.78], [-0.26, -1.12], [0, -1.20], [0.26, -1.12], [0.30, -0.78],
    [0.20, -0.66], [0, -0.62], [-0.20, -0.66],
  ], { c0: '#050505', c1: '#262626', c2: '#3c3c3c', outline: 'rgba(0,0,0,0.6)', top: -1.2, bot: -0.62, hi: 0.22 });
  L(ctx, F, xf, [[-0.28, -0.74], [0, -0.70], [0.28, -0.74]], '#caa23a', 0.05, 0);
  L(ctx, F, xf, [[-0.28, -0.74], [0, -0.70], [0.28, -0.74]], '#ffe79a', 0.018, 0);
  discU(ctx, F, xf, 0, -1.20, 0.07, [[0, '#ffe79a'], [0.6, '#caa23a'], [1, '#7a5e16']], 'rgba(60,40,4,0.6)');
}

const TENGU = {
  id: 'tengu', name: '天狗', emoji: '👺', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: tenguFace },
    { dur: 0.55, anchor: [0, 0.9], lock: { sound: 'heavy', shake: 9, burst: 18, flash: 0.12 }, draw: tenguNose },
    { dur: 0.4, anchor: [0, -0.4], lock: { sound: 'click', shake: 5 }, draw: tenguBrows },
    { dur: 0.4, anchor: [0, 1.4], lock: { sound: 'click', shake: 4 }, draw: tenguMustache },
    { dur: 0.4, anchor: [0, -1.0], lock: { sound: 'click', shake: 4 }, draw: tenguCap },
  ],
};

// ============================================================ OKAME =========
// Traditional Otafuku / Okame: a plump, pale, beaming face with glossy
// lacquered black hair, big rosy cheeks, gentle half-moon eyes, high painted
// brows, a soft little nose and small glossy red lips. Parts draw back-to-front.

// soft warm cream face with a forehead specular and a rosy drift toward cheeks
function okameFace(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#e8c6a4', '#f8e6d2', '#fff8f0'], {
    spec: [-0.32, -0.5], specR: 0.78, hi: 0.34, top: -1.25, bot: 2.0,
  });
  ctx.save();
  trace(ctx, xf, FACE_OVAL); ctx.clip();
  for (const s of [1, -1]) {
    const c = xf(0.62 * s, 0.95), r = F.s * 1.05;
    const g = ctx.createRadialGradient(c.x, c.y, r * 0.1, c.x, c.y, r);
    g.addColorStop(0, 'rgba(255,176,176,0.30)');
    g.addColorStop(0.6, 'rgba(255,176,176,0.08)');
    g.addColorStop(1, 'rgba(255,176,176,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  const cb = xf(0, 1.95), rb = F.s * 1.1;
  const gb = ctx.createRadialGradient(cb.x, cb.y, rb * 0.1, cb.x, cb.y, rb);
  gb.addColorStop(0, 'rgba(190,120,95,0.18)');
  gb.addColorStop(1, 'rgba(190,120,95,0)');
  ctx.fillStyle = gb; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

const OKAME_CROWN = [
  [-1.28, 0.42], [-1.3, -0.42], [-0.86, -1.12], [-0.34, -1.46], [0, -1.52],
  [0.34, -1.46], [0.86, -1.12], [1.3, -0.42], [1.28, 0.42],
  [0.98, 0.02], [0.66, -0.34], [0.3, -0.52], [0.07, -0.34], [0, -0.18],
  [-0.07, -0.34], [-0.3, -0.52], [-0.66, -0.34], [-0.98, 0.02],
];
function okameHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -2.0, fromScale: 0.78, pivot: [0, -0.9] });
  for (const s of [1, -1]) {
    sphere(ctx, F, xf, 1.16 * s, 0.46, 0.34, '#101016', '#45454f', null);
    sphere(ctx, F, xf, 1.0 * s, -0.18, 0.2, '#0d0d12', '#3a3a44', null);
  }
  shape(ctx, F, xf, OKAME_CROWN, {
    c0: '#050507', c1: '#1a1a22', c2: '#46464f', outline: null,
    top: -1.45, bot: 0.6, hi: 0.36, spec: [-0.5, -1.0], specR: 0.5,
  });
  for (const s of [1, -1])
    L(ctx, F, xf, [[0.18 * s, -0.28], [0.6 * s, -0.62], [1.02 * s, -0.5], [1.18 * s, -0.05]],
      'rgba(190,200,225,0.4)', 0.03, 0);
  for (const s of [1, -1])
    L(ctx, F, xf, [[1.02 * s, 0.3], [1.18 * s, 0.5]], 'rgba(220,228,245,0.55)', 0.04, 0);
}

function okameCheeks(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.1, pivot: [0, 0.7] });
  const a = 0.55 + 0.45 * easeOutBack(clamp01(p));
  for (const s of [1, -1]) {
    ctx.save(); ctx.globalAlpha = a;
    discU(ctx, F, xf, 0.74 * s, 0.92, 0.34,
      [[0, 'rgba(255,150,158,0.92)'], [0.55, 'rgba(248,108,128,0.5)'], [1, 'rgba(240,90,110,0)']]);
    discU(ctx, F, xf, (0.74 - 0.1) * s, 0.82, 0.1,
      [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    ctx.restore();
  }
}

function okameEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 0] });
  for (const s of [1, -1]) {
    const eye = [[0.26 * s, 0.0], [0.4 * s, 0.1], [0.5 * s, 0.13], [0.6 * s, 0.1], [0.7 * s, 0.0]];
    L(ctx, F, xf, eye, '#16161a', 0.034, 0);
    L(ctx, F, xf, [[0.3 * s, -0.05], [0.5 * s, 0.02], [0.66 * s, -0.05]], 'rgba(60,40,40,0.35)', 0.016, 0);
    L(ctx, F, xf, [[0.34 * s, -0.6], [0.48 * s, -0.66], [0.62 * s, -0.6]], '#1c1c20', 0.045, 0);
  }
}

function okameNose(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.4, fromScale: 0.3, pivot: [0, 0.75] });
  sphere(ctx, F, xf, 0, 0.78, 0.12, '#e6b89a', '#fdeada', null);
  for (const s of [1, -1])
    discU(ctx, F, xf, 0.07 * s, 0.86, 0.04, [[0, 'rgba(150,90,70,0.5)'], [1, 'rgba(150,90,70,0)']]);
}

function okameMouth(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 1.1] });
  sphere(ctx, F, xf, 0, 1.16, 0.13, '#c01430', '#ff6f80', 'rgba(120,10,30,0.55)');
  discU(ctx, F, xf, 0, 1.18, 0.07, [[0, 'rgba(160,20,40,0.55)'], [1, 'rgba(160,20,40,0)']]);
  L(ctx, F, xf, [[-0.06, 1.1], [0, 1.085], [0.06, 1.1]], 'rgba(255,235,235,0.8)', 0.02, 0);
}

const OKAME = {
  id: 'okame', name: 'おかめ', emoji: '😊', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'click', shake: 5, burst: 10 }, draw: okameFace },
    { dur: 0.5, anchor: [0, -0.85], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: okameHair },
    { dur: 0.35, anchor: [0, 0.9], lock: { sound: 'click', shake: 3 }, draw: okameCheeks },
    { dur: 0.3, anchor: [0, 0.78], lock: { sound: 'click', shake: 2 }, draw: okameNose },
    { dur: 0.35, anchor: [0, 0], lock: { sound: 'click', shake: 3 }, draw: okameEyes },
    { dur: 0.35, anchor: [0, 1.15], lock: { sound: 'click', shake: 3 }, draw: okameMouth },
  ],
};

// ============================================================ VAMPIRE =======
function vampFace(ctx, F, p, env) {
  // Pale blue-white skin with cool greys + forehead specular.
  const xf = skin(ctx, F, p, env, ['#8ea2ba', '#cdd9e8', '#eef4fb'], {
    spec: [-0.35, -0.55], specR: 0.6, hi: 0.34, top: -1.25, bot: 2.0,
  });
  // gaunt cheek hollows for a sunken, sinister look
  ctx.save(); ctx.globalAlpha = 0.4;
  for (const s of [1, -1])
    discU(ctx, F, xf, 0.82 * s, 0.75, 0.42,
      [[0, 'rgba(70,86,110,0)'], [0.55, 'rgba(60,74,96,0.35)'], [1, 'rgba(40,52,72,0)']]);
  ctx.restore();
}
function vampCollar(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 1.9, fromRot: 0.0, fromScale: 0.72, pivot: [0, 1.8] });
  // red inner lining (drawn first so the black collar overlaps its base)
  shape(ctx, F, xf,
    [[-1.55, 2.3], [-1.35, 0.75], [-0.45, 1.55], [0, 1.35], [0.45, 1.55], [1.35, 0.75], [1.55, 2.3]],
    { c0: '#3a0410', c1: '#7a0c1c', c2: '#b51828', outline: 'rgba(20,0,4,0.7)',
      top: 0.7, bot: 2.3, spec: [-0.3, 1.3], specR: 0.5, hi: 0.22 });
  // tall black collar wings rising behind the head, slightly inset over the lining
  shape(ctx, F, xf,
    [[-1.78, 2.35], [-1.62, 0.4], [-1.0, 1.05], [-0.55, 1.62], [0, 1.5],
     [0.55, 1.62], [1.0, 1.05], [1.62, 0.4], [1.78, 2.35],
     [1.2, 2.2], [0.55, 1.85], [0, 1.78], [-0.55, 1.85], [-1.2, 2.2]],
    { c0: '#05050a', c1: '#181820', c2: '#34343f', outline: 'rgba(0,0,0,0.7)',
      top: 0.5, bot: 2.3, gloss: true, hi: 0.14,
      glow: [{ pts: [[-1.5, 0.7], [-0.55, 1.5], [0, 1.4], [0.55, 1.5], [1.5, 0.7]],
               color: '#b51828', w: 0.03, k: 0.5 }],
      power: 0.4 + 0.6 * env.ignite });
  // crisp red edge highlight along the inner collar rim
  L(ctx, F, xf, [[-1.55, 0.62], [-0.55, 1.5], [0, 1.4], [0.55, 1.5], [1.55, 0.62]],
    '#d4263a', 0.022, 0.4 + 0.5 * env.ignite);
}
function vampHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -2.0, fromScale: 0.78, pivot: [0, -0.9] });
  // slicked black hair: side volume sweeping up, sharp central widow's peak dipping low
  shape(ctx, F, xf,
    [[-1.26, 0.2], [-1.3, -0.55], [-1.0, -1.15], [-0.5, -1.42], [0, -1.5],
     [0.5, -1.42], [1.0, -1.15], [1.3, -0.55], [1.26, 0.2],
     [0.92, -0.18], [0.55, -0.55], [0.3, -0.42], [0.12, -0.62],
     [0, -0.12],
     [-0.12, -0.62], [-0.3, -0.42], [-0.55, -0.55], [-0.92, -0.18]],
    { c0: '#020205', c1: '#14141c', c2: '#34343f', outline: null,
      top: -1.5, bot: 0.1, gloss: true, hi: 0.3,
      spec: [-0.45, -0.85], specR: 0.45 });
  // glossy slicked-back highlight streaks
  ctx.save(); ctx.globalAlpha = 0.55;
  for (const s of [1, -1])
    L(ctx, F, xf, [[0.18 * s, -0.5], [0.55 * s, -0.85], [0.95 * s, -0.9]],
      'rgba(120,130,150,0.7)', 0.026, 0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.45;
  L(ctx, F, xf, [[-0.12, -0.45], [-0.05, -0.85]], 'rgba(170,180,200,0.8)', 0.02, 0);
  ctx.restore();
}
function vampBrows(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.7, fromScale: 0.6, pivot: [0, -0.3] });
  for (const s of [1, -1])
    shape(ctx, F, xf,
      [[0.18 * s, -0.18], [0.5 * s, -0.46], [0.92 * s, -0.5], [0.95 * s, -0.36],
       [0.55 * s, -0.34], [0.26 * s, -0.08]],
      { c0: '#020205', c1: '#15151d', c2: '#2c2c36', gloss: false, outline: null });
}
function vampEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.25 });
  const ig = env.ignite;
  for (const s of [1, -1]) {
    discU(ctx, F, xf, 0.5 * s, 0.02, 0.26,
      [[0, 'rgba(8,4,6,0.95)'], [0.65, 'rgba(20,8,12,0.7)'], [1, 'rgba(20,8,12,0)']]);
    sphere(ctx, F, xf, 0.5 * s, 0.02, 0.12, '#2a0608', '#7a1018', 'rgba(0,0,0,0.6)');
    ember(ctx, xf, F, 0.5 * s, 0.02, '#ff2030', 0.45 + 0.55 * ig, 0.1);
    ember(ctx, xf, F, 0.5 * s, 0.02, '#ff5a4a', 0.25 + 0.4 * ig, 0.05);
  }
}
function vampFangs(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.6, fromScale: 0.45, pivot: [0, 1.15] });
  shape(ctx, F, xf,
    [[-0.42, 1.04], [0.42, 1.04], [0.32, 1.34], [0, 1.44], [-0.32, 1.34]],
    { c0: '#1c0408', c1: '#400a12', c2: '#601420', gloss: false, outline: 'rgba(0,0,0,0.6)' });
  ctx.save(); ctx.globalAlpha = 0.5;
  L(ctx, F, xf, [[-0.4, 1.05], [0, 1.12], [0.4, 1.05]], 'rgba(150,60,70,0.7)', 0.018, 0);
  L(ctx, F, xf, [[-0.3, 1.36], [0, 1.43], [0.3, 1.36]], 'rgba(90,30,40,0.7)', 0.016, 0);
  ctx.restore();
  for (const s of [1, -1])
    shape(ctx, F, xf,
      [[0.14 * s, 1.05], [0.3 * s, 1.05], [0.26 * s, 1.18], [0.2 * s, 1.4]],
      { c0: '#c8cdd4', c1: '#f4f7fb', c2: '#ffffff', gloss: false,
        outline: 'rgba(110,115,125,0.55)', ow: 0.012 });
}
const VAMPIRE = {
  id: 'vampire', name: 'バンパイア', emoji: '🧛', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 1.7], lock: { sound: 'heavy', shake: 7, burst: 12 }, draw: vampCollar },
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'click', shake: 5, burst: 10 }, draw: vampFace },
    { dur: 0.45, anchor: [0, -0.9], lock: { sound: 'heavy', shake: 6, burst: 14 }, draw: vampHair },
    { dur: 0.3, anchor: [0, -0.3], lock: { sound: 'click', shake: 3 }, draw: vampBrows },
    { dur: 0.35, anchor: [0, 1.2], lock: { sound: 'click', shake: 4 }, draw: vampFangs },
    { dur: 0.4, anchor: [0, 0], lock: { sound: null, shake: 3, flash: 0.22 }, draw: vampEyes },
  ],
};

// ============================================================ ZOMBIE ========
function zombieFace(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#33502a', '#618c47', '#92ba64']);
  // mottled rot: irregular two-tone discoloration patches, low-alpha overlay
  shape(ctx, F, xf, [[-0.95, -0.3], [-0.45, -0.55], [-0.2, 0.0], [-0.55, 0.5], [-0.98, 0.35]],
    { c0: '#2a3d1c', c1: '#3d5526', c2: '#4d6a30', gloss: false, outline: null, shadow: false, fill: 'rgba(36,52,22,0.55)' });
  shape(ctx, F, xf, [[0.35, 0.55], [0.95, 0.45], [1.05, 1.05], [0.6, 1.35], [0.3, 1.0]],
    { c0: '#2a3d1c', c1: '#36481f', c2: '#445a28', gloss: false, outline: null, shadow: false, fill: 'rgba(28,42,18,0.5)' });
  // sickly pale-yellow blotches (lighter rot)
  discU(ctx, F, xf, 0.55, -0.55, 0.32, [[0, 'rgba(186,200,120,0.4)'], [0.7, 'rgba(160,180,100,0.18)'], [1, 'rgba(160,180,100,0)']]);
  discU(ctx, F, xf, -0.7, 1.0, 0.4, [[0, 'rgba(120,150,80,0.32)'], [1, 'rgba(120,150,80,0)']]);
}
function zombieHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.6, fromScale: 0.7, pivot: [0, -0.9] });
  // messy uneven dark hair patch with jagged spikes
  shape(ctx, F, xf, [[-1.02, -0.45], [-0.95, -1.15], [-0.55, -0.85], [-0.28, -1.35], [-0.05, -0.9],
    [0.18, -1.45], [0.45, -0.92], [0.78, -1.3], [0.98, -0.7], [1.02, -0.4],
    [0.5, -0.62], [0.12, -0.42], [-0.18, -0.6], [-0.55, -0.4]],
    { c0: '#0d120c', c1: '#1f291a', c2: '#323f27', outline: null });
  // a few stray clumps for messiness
  for (const s of [1, -1]) L(ctx, F, xf, [[0.3 * s, -0.55], [0.5 * s, -1.05], [0.4 * s, -1.3]], '#1a231590', 0.025, 0);
}
function zombieSockets(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.3 });
  // deep sunken recesses: dark radial giving socket depth
  for (const s of [1, -1])
    discU(ctx, F, xf, 0.5 * s, 0.04, 0.4, [[0, 'rgba(8,16,6,0.95)'], [0.55, 'rgba(14,24,10,0.85)'], [1, 'rgba(14,24,10,0)']]);
  // bruised ring around socket
  for (const s of [1, -1])
    discU(ctx, F, xf, 0.5 * s, 0.18, 0.42, [[0, 'rgba(40,30,55,0)'], [0.7, 'rgba(48,28,58,0.28)'], [1, 'rgba(48,28,58,0)']]);
  // pale sickly glowing eyes intensifying with ignite
  for (const s of [1, -1]) ember(ctx, xf, F, 0.5 * s, 0.02, '#d4ff86', 0.35 + 0.6 * env.ignite, 0.09);
}
function zombieStitches(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.8, fromScale: 0.7, pivot: [0, -0.6] });
  const seams = [
    [[-1.0, -0.55], [-0.4, -0.78], [0.3, -0.62], [0.95, -0.82]],
    [[0.45, 0.35], [0.7, 0.75], [0.62, 1.2]],
  ];
  for (const seam of seams) {
    L(ctx, F, xf, seam, 'rgba(16,26,12,0.85)', 0.018, 0);
    for (let i = 0; i < seam.length - 1; i++) {
      const a = seam[i], b = seam[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 0.09, ny = dx / len * 0.09;
      for (const t of [0.28, 0.72]) {
        const mx = a[0] + dx * t, my = a[1] + dy * t;
        L(ctx, F, xf, [[mx - nx, my - ny], [mx + nx, my + ny]], 'rgba(12,20,8,0.85)', 0.014, 0);
      }
    }
  }
}
function zombieGash(ctx, F, p, env) {
  const xf = fly(F, p, { fromU: 1.5, fromScale: 0.6, pivot: [-0.75, 0.55] });
  // open wound on left cheek: dark interior shape then raw red rim
  shape(ctx, F, xf, [[-0.82, 0.3], [-0.62, 0.45], [-0.78, 0.75], [-0.6, 1.0], [-0.85, 1.05], [-0.95, 0.65]],
    { c0: '#2a0608', c1: '#4a0c0e', c2: '#3a0809', gloss: false, outline: 'rgba(90,10,12,0.8)', ow: 0.03, shadow: false });
  discU(ctx, F, xf, -0.78, 0.66, 0.16, [[0, 'rgba(150,20,24,0.9)'], [0.6, 'rgba(90,10,12,0.7)'], [1, 'rgba(40,4,6,0)']]);
  for (const t of [0.35, 0.65]) {
    const v = 0.35 + t * 0.6;
    L(ctx, F, xf, [[-0.98, v], [-0.62, v]], 'rgba(70,8,10,0.85)', 0.014, 0);
  }
}
function zombieMouth(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.6, fromScale: 0.4, pivot: [0, 1.2] });
  shape(ctx, F, xf, [[-0.52, 1.04], [0.5, 1.06], [0.42, 1.5], [0.0, 1.56], [-0.42, 1.46]],
    { c0: '#120606', c1: '#220c0c', c2: '#301414', gloss: false, outline: 'rgba(0,0,0,0.65)' });
  const teeth = [
    [-0.42, 1.06, 0.07, 0.16, -0.04],
    [-0.24, 1.05, 0.08, 0.2, 0.02],
    [0.0, 1.07, 0.06, 0.13, 0.0],
    [0.3, 1.05, 0.085, 0.18, 0.05],
    [0.46, 1.07, 0.06, 0.12, 0.03],
  ];
  for (const [u, v, w, h, tilt] of teeth)
    shape(ctx, F, xf, [[u - w, v], [u + w, v], [u + w * 0.6 + tilt, v + h], [u - w * 0.6 + tilt, v + h]],
      { c0: '#8f8f66', c1: '#c2c29a', c2: '#e6e6c8', gloss: false, outline: 'rgba(60,60,40,0.45)', shadow: false });
  for (const u of [-0.3, 0.18])
    shape(ctx, F, xf, [[u - 0.06, 1.5], [u + 0.06, 1.5], [u + 0.03, 1.4], [u - 0.03, 1.4]],
      { c0: '#7a7a55', c1: '#a8a880', c2: '#cacaa6', gloss: false, outline: null, shadow: false });
}
const ZOMBIE = {
  id: 'zombie', name: 'ゾンビ', emoji: '🧟', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: zombieFace },
    { dur: 0.45, anchor: [0, -0.9], lock: { sound: 'heavy', shake: 5, burst: 10 }, draw: zombieHair },
    { dur: 0.4, anchor: [0, 0], lock: { sound: 'heavy', shake: 5 }, draw: zombieSockets },
    { dur: 0.35, anchor: [0, -0.6], lock: { sound: 'click', shake: 3 }, draw: zombieStitches },
    { dur: 0.35, anchor: [-0.75, 0.6], lock: { sound: 'click', shake: 4, burst: 6 }, draw: zombieGash },
    { dur: 0.4, anchor: [0, 1.2], lock: { sound: 'heavy', shake: 5 }, draw: zombieMouth },
  ],
};

// ============================================================ POOP ==========
// Hyper-quality glossy soft-serve poop. Warm chocolate palette:
//   #3a2410 deep shadow · #7a4a22 mid · #c98a4a light · #e8b878 sheen.
const POOP_C = { d: '#3a2410', m: '#7a4a22', l: '#c98a4a', hi: '#e8b878' };

// One rounded, glossy tier. `lean` curls the swirl sideways.
function poopTier(ctx, F, cx, cy, rx, ry, p, fromV, lean = 0) {
  const xf = fly(F, p, { fromV, fromScale: 0.42, fromRot: lean * 0.5, pivot: [cx, cy] });
  const pts = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ry2 = a > Math.PI ? ry * 1.04 : ry * 0.9;
    const lobe = 1 + 0.05 * Math.sin(a * 3);
    const lx = lean * 0.18 * Math.cos(a) * Math.sin(a);
    pts.push([cx + Math.cos(a) * rx * lobe + lx, cy + Math.sin(a) * ry2 * lobe]);
  }
  shape(ctx, F, xf, pts, {
    c0: POOP_C.d, c1: POOP_C.m, c2: POOP_C.l,
    outline: 'rgba(40,22,10,0.55)', ow: 0.02,
    top: cy - ry, bot: cy + ry,
    lightV: 0.22, hi: 0.36,
    spec: [cx - rx * 0.28, cy - ry * 0.5], specR: rx * 0.6,
  });
  L(ctx, F, xf, [
    [cx - rx * 0.62, cy - ry * 0.42], [cx - rx * 0.2, cy - ry * 0.66],
    [cx + rx * 0.34, cy - ry * 0.6], [cx + rx * 0.66, cy - ry * 0.34],
  ], 'rgba(232,184,120,0.5)', 0.04, 0);
  L(ctx, F, xf, [
    [cx - rx * 0.7, cy + ry * 0.5], [cx, cy + ry * 0.78], [cx + rx * 0.7, cy + ry * 0.5],
  ], 'rgba(30,16,6,0.45)', 0.05, 0);
}

function poopSeam(ctx, F, xf, cx, cy, w) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push([cx - w + t * 2 * w, cy + Math.sin(t * Math.PI) * w * 0.34 - 0.02]);
  }
  L(ctx, F, xf, pts, 'rgba(40,22,10,0.4)', 0.022, 0);
  L(ctx, F, xf, pts.map(([u, v]) => [u, v - 0.045]), 'rgba(232,184,120,0.4)', 0.016, 0);
}

const POOP = {
  id: 'poop', name: 'うんこ', emoji: '💩', finale: 'puff',
  parts: [
    {
      dur: 0.45, anchor: [0, 1.55], lock: { sound: 'heavy', shake: 8, burst: 14 },
      draw: (c, F, p) => {
        poopTier(c, F, 0, 1.5, 1.28, 0.74, p, 1.7, 0);
        const xf = fly(F, p, { fromV: 1.7, fromScale: 0.42, pivot: [0, 1.5] });
        poopSeam(c, F, xf, 0, 0.86, 1.05);
      },
    },
    {
      dur: 0.45, anchor: [0, 0.7], lock: { sound: 'heavy', shake: 7, burst: 12 },
      draw: (c, F, p) => {
        poopTier(c, F, 0, 0.7, 1.02, 0.64, p, 1.0, -0.35);
        const xf = fly(F, p, { fromV: 1.0, fromScale: 0.42, fromRot: -0.175, pivot: [0, 0.7] });
        poopSeam(c, F, xf, 0.04, 0.12, 0.82);
      },
    },
    {
      dur: 0.42, anchor: [0, -0.15], lock: { sound: 'heavy', shake: 6, burst: 10 },
      draw: (c, F, p) => {
        poopTier(c, F, 0, -0.15, 0.74, 0.54, p, 0.85, 0.4);
        const xf = fly(F, p, { fromV: 0.85, fromScale: 0.42, fromRot: 0.2, pivot: [0, -0.15] });
        poopSeam(c, F, xf, -0.02, -0.62, 0.6);
      },
    },
    {
      dur: 0.4, anchor: [0, -1.0], lock: { sound: 'click', shake: 5, burst: 8 },
      draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromV: -1.6, fromScale: 0.25, fromRot: 0.6, pivot: [0, -0.55] });
        shape(ctx, F, xf, [
          [-0.42, -0.5], [-0.34, -0.86], [-0.16, -1.18], [0.04, -1.42],
          [0.22, -1.58], [0.3, -1.5], [0.16, -1.28], [0.06, -1.02],
          [0.16, -0.78], [0.4, -0.56], [0.18, -0.46],
        ], {
          c0: POOP_C.d, c1: POOP_C.m, c2: POOP_C.l,
          outline: 'rgba(40,22,10,0.55)', ow: 0.02,
          top: -1.6, bot: -0.5, lightV: 0.2, hi: 0.38,
          spec: [-0.06, -1.2], specR: 0.26,
        });
        L(ctx, F, xf, [[-0.18, -0.66], [-0.04, -1.0], [0.08, -1.32], [0.18, -1.5]],
          'rgba(232,184,120,0.55)', 0.028, 0);
      },
    },
    {
      dur: 0.35, anchor: [0, 0.05], lock: { sound: 'click', shake: 3 },
      draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromScale: 0.15, pivot: [0, 0.05] });
        for (const s of [1, -1]) {
          sphere(ctx, F, xf, 0.46 * s, 0.02, 0.3, '#dfe3ea', '#ffffff', 'rgba(30,18,8,0.55)');
          discU(ctx, F, xf, 0.4 * s, 0.08, 0.15,
            [[0, '#3a2a22'], [0.5, '#150d08'], [1, '#000']], 'rgba(0,0,0,0.5)');
          discU(ctx, F, xf, 0.35 * s, 0.0, 0.05, [[0, '#fff'], [1, 'rgba(255,255,255,0)']]);
          discU(ctx, F, xf, 0.44 * s, 0.13, 0.025, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
        }
      },
    },
    {
      dur: 0.35, anchor: [0, 0.78], lock: { sound: 'click', shake: 3 },
      draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 0.78] });
        const mouth = [
          [-0.5, 0.66], [-0.3, 0.6], [0, 0.58], [0.3, 0.6], [0.5, 0.66],
          [0.34, 0.96], [0, 1.08], [-0.34, 0.96],
        ];
        shape(ctx, F, xf, mouth, {
          c0: '#1a0c04', c1: '#3a160c', c2: '#5a200f',
          outline: 'rgba(20,10,4,0.7)', ow: 0.022,
          top: 0.58, bot: 1.08, hi: 0.18, spec: [-0.1, 0.7], specR: 0.16,
        });
        shape(ctx, F, xf, [
          [-0.26, 0.92], [0, 0.86], [0.26, 0.92], [0.2, 1.06], [0, 1.1], [-0.2, 1.06],
        ], {
          c0: '#8a2030', c1: '#c83a4e', c2: '#ee6a7c',
          outline: 'rgba(70,12,20,0.6)', ow: 0.018, shadow: false,
          top: 0.86, bot: 1.1, hi: 0.3, spec: [-0.06, 0.94], specR: 0.12,
        });
        L(ctx, F, xf, [[-0.4, 0.66], [0, 0.6], [0.4, 0.66]],
          'rgba(232,184,120,0.45)', 0.02, 0);
      },
    },
  ],
};

// ============================================================ TREE ==========
function treeBark(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#2e1d0e', '#5e3f22', '#8a6336'], {
    spec: [-0.35, -0.3], specR: 0.55, hi: 0.22,
    grooves: [
      [[-0.62, -0.9], [-0.52, 0.0], [-0.6, 1.0], [-0.5, 1.85]],
      [[-0.18, -1.0], [-0.1, 0.1], [-0.16, 1.1], [-0.08, 1.9]],
      [[0.3, -0.95], [0.4, 0.05], [0.32, 1.05], [0.42, 1.88]],
      [[0.72, -0.7], [0.66, 0.3], [0.74, 1.3], [0.66, 1.75]],
    ],
  });
  for (const [ku, kv, kr] of [[-0.78, 0.85, 0.16], [0.7, 1.25, 0.13]]) {
    discU(ctx, F, xf, ku, kv, kr, [[0, '#7a5630'], [0.5, '#3f2a14'], [0.8, '#5a3c20'], [1, '#2a1a0c']], 'rgba(30,18,8,0.6)');
    discU(ctx, F, xf, ku, kv, kr * 0.42, [[0, '#1c1006'], [1, '#0d0703']]);
  }
}
// One rounded leaf cluster built from several overlapping spheres.
function leafCluster(ctx, F, xf, cx, cy, scale) {
  const dk = '#1f5a26', md = '#2f8035', lt = '#5fb547', hl = '#8fd862';
  sphere(ctx, F, xf, cx - 0.42 * scale, cy + 0.34 * scale, 0.5 * scale, '#163f1c', dk, 'rgba(15,45,20,0.5)');
  sphere(ctx, F, xf, cx + 0.46 * scale, cy + 0.32 * scale, 0.52 * scale, '#163f1c', dk, 'rgba(15,45,20,0.5)');
  sphere(ctx, F, xf, cx + 0.02 * scale, cy + 0.5 * scale, 0.46 * scale, '#143818', dk, 'rgba(15,45,20,0.5)');
  sphere(ctx, F, xf, cx - 0.5 * scale, cy - 0.02 * scale, 0.56 * scale, dk, md, 'rgba(20,55,25,0.5)');
  sphere(ctx, F, xf, cx + 0.5 * scale, cy - 0.04 * scale, 0.58 * scale, dk, md, 'rgba(20,55,25,0.5)');
  sphere(ctx, F, xf, cx + 0.0 * scale, cy + 0.06 * scale, 0.66 * scale, dk, md, 'rgba(20,55,25,0.5)');
  sphere(ctx, F, xf, cx - 0.22 * scale, cy - 0.4 * scale, 0.5 * scale, md, lt, 'rgba(30,80,35,0.45)');
  sphere(ctx, F, xf, cx + 0.26 * scale, cy - 0.42 * scale, 0.52 * scale, md, lt, 'rgba(30,80,35,0.45)');
  sphere(ctx, F, xf, cx + 0.02 * scale, cy - 0.58 * scale, 0.44 * scale, lt, hl, 'rgba(40,100,45,0.4)');
}
function berry(ctx, F, xf, u, v, r, warm) {
  sphere(ctx, F, xf, u, v, r, warm ? '#a3321a' : '#8a1414', warm ? '#ff8a3a' : '#e8423a', 'rgba(60,10,5,0.6)');
}
function treeTop(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.9, fromScale: 0.25, pivot: [0, -1.2] });
  leafCluster(ctx, F, xf, -0.78, -0.55, 1.0);
  leafCluster(ctx, F, xf, 0.8, -0.55, 1.0);
  leafCluster(ctx, F, xf, -0.05, -0.95, 1.15);
  leafCluster(ctx, F, xf, 0.0, -0.35, 0.95);
  berry(ctx, F, xf, -0.5, -0.4, 0.1, false);
  berry(ctx, F, xf, 0.46, -0.7, 0.11, true);
  berry(ctx, F, xf, 0.12, -1.15, 0.09, false);
}
function treeSide(ctx, F, p, env, side) {
  const cx = 1.12 * side, cy = 0.15;
  const xf = fly(F, p, { fromU: 1.7 * side, fromV: -0.2, fromRot: -0.4 * side, fromScale: 0.3, pivot: [cx, cy] });
  L(ctx, F, xf, [[0.7 * side, 0.25], [1.0 * side, 0.05], [1.25 * side, -0.15]], 'rgba(45,28,14,0.85)', 0.03, 0);
  leafCluster(ctx, F, xf, cx, cy, 0.78);
  leafCluster(ctx, F, xf, cx + 0.18 * side, cy + 0.62, 0.55);
  berry(ctx, F, xf, cx + 0.1 * side, cy + 0.15, 0.09, true);
}
function treeEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.15, pivot: [0, 0] });
  for (const s of [1, -1]) {
    discU(ctx, F, xf, 0.5 * s, 0.08, 0.22, [[0, '#3a2410'], [0.55, '#1c1006'], [1, '#0c0602']], 'rgba(20,12,5,0.7)');
    discU(ctx, F, xf, 0.5 * s, 0.08, 0.12, [[0, '#140a03'], [1, '#000']]);
    ember(ctx, xf, F, 0.44 * s, 0.0, '#ffd98a', 0.35 + 0.4 * env.ignite, 0.06);
  }
}
const TREE = {
  id: 'tree', name: '木', emoji: '🌳', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: treeBark },
    { dur: 0.45, anchor: [1.12, 0.15], lock: { sound: 'click', shake: 5, burst: 10, both: true }, draw: (c, F, p, e) => { treeSide(c, F, p, e, 1); treeSide(c, F, p, e, -1); } },
    { dur: 0.5, anchor: [0, -0.9], lock: { sound: 'heavy', shake: 8, burst: 18, flash: 0.12 }, draw: treeTop },
    { dur: 0.35, anchor: [0, 0], lock: { sound: 'click', shake: 3 }, draw: treeEyes },
  ],
};

// ============================================================ ANT ===========
const ANT_GROOVES = [
  [[-0.74, -0.42], [0, -0.56], [0.74, -0.42]],
  [[-0.92, 0.12], [0, 0.02], [0.92, 0.12]],
  [[-0.66, 0.62], [0, 0.74], [0.66, 0.62]],
];
function antHead(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#08080c', '#241410', '#5a2a1e'], {
    spec: [-0.32, -0.5], specR: 0.5, hi: 0.34, top: -1.25, bot: 2.0,
    grooves: ANT_GROOVES,
  });
  ctx.save(); ctx.globalAlpha = 0.6;
  L(ctx, F, xf, [[-0.78, -0.54], [-0.3, -0.74], [0.3, -0.74], [0.78, -0.54]],
    'rgba(210,180,170,0.6)', 0.07, 0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.85;
  L(ctx, F, xf, [[-0.34, -0.66], [0.2, -0.7]], 'rgba(255,244,238,0.9)', 0.02, 0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.4;
  for (const s of [1, -1])
    L(ctx, F, xf, [[1.06 * s, -0.1], [1.12 * s, 0.55], [0.96 * s, 1.15]],
      'rgba(150,70,48,0.8)', 0.03, 0);
  ctx.restore();
}
function antEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.5, fromScale: 0.3, pivot: [0, 0.1] });
  for (const s of [1, -1]) {
    const eu = 0.74 * s, ev = -0.02;
    discU(ctx, F, xf, eu, ev + 0.04, 0.5,
      [[0, 'rgba(4,4,8,0.9)'], [0.6, 'rgba(8,6,10,0.55)'], [1, 'rgba(8,6,10,0)']]);
    sphere(ctx, F, xf, eu, ev, 0.4, '#0c0c14', '#7a7a92', 'rgba(0,0,0,0.7)');
    ctx.save(); ctx.globalAlpha = 0.16;
    for (const [du, dv, r] of [[-0.12, -0.08, 0.07], [0.1, -0.02, 0.06],
      [-0.04, 0.12, 0.06], [0.14, 0.14, 0.05], [-0.16, 0.08, 0.05]])
      discU(ctx, F, xf, eu + du * s, ev + dv, r,
        [[0, 'rgba(190,200,220,0.6)'], [1, 'rgba(60,64,80,0)']]);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5;
    discU(ctx, F, xf, eu + 0.14 * s, ev + 0.16, 0.06,
      [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    ctx.restore();
  }
}
function antAntenna(ctx, F, p, env, s) {
  const xf = fly(F, p, { fromV: -1.5, fromRot: -0.5 * s, fromScale: 0.4, pivot: [0.2 * s, -0.6] });
  const seg = [
    [0.16 * s, -0.58], [0.34 * s, -0.92], [0.4 * s, -1.18],
    [0.66 * s, -1.42], [0.98 * s, -1.58], [1.26 * s, -1.82],
  ];
  L(ctx, F, xf, seg, '#08080c', 0.05, 0);
  L(ctx, F, xf, seg.slice(2), '#160c0a', 0.034, 0);
  ctx.save(); ctx.globalAlpha = 0.45;
  L(ctx, F, xf, [[0.2 * s, -0.7], [0.42 * s, -1.16], [0.78 * s, -1.46]],
    'rgba(170,120,100,0.7)', 0.014, 0);
  ctx.restore();
  sphere(ctx, F, xf, 1.26 * s, -1.82, 0.15, '#3a1c14', '#8a4632', 'rgba(0,0,0,0.6)');
}
function antMandibles(ctx, F, p, env, s) {
  const xf = fly(F, p, { fromU: 1.2 * s, fromV: 0.7, fromRot: 0.5 * s, fromScale: 0.5, pivot: [0.2 * s, 1.25] });
  const MAND = [
    [0.06 * s, 1.12], [0.42 * s, 1.18], [0.78 * s, 1.4],
    [0.92 * s, 1.78], [0.74 * s, 2.06], [0.5 * s, 2.12],
    [0.62 * s, 1.86], [0.5 * s, 1.6], [0.22 * s, 1.42],
    [0.04 * s, 1.3],
  ];
  shape(ctx, F, xf, MAND, {
    c0: '#08080c', c1: '#241410', c2: '#5a2a1e',
    outline: 'rgba(0,0,0,0.65)', ow: 0.02,
    top: 1.0, bot: 2.1, spec: [0.6 * s, 1.55], specR: 0.3, hi: 0.3,
  });
  ctx.save(); ctx.globalAlpha = 0.6;
  L(ctx, F, xf, [[0.46 * s, 1.22], [0.82 * s, 1.46], [0.92 * s, 1.78], [0.74 * s, 2.04]],
    'rgba(200,150,128,0.8)', 0.016, 0);
  ctx.restore();
  sphere(ctx, F, xf, 0.52 * s, 2.1, 0.07, '#3a1c14', '#9a5238', 'rgba(0,0,0,0.6)');
}
function antPalps(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.4, fromScale: 0.4, pivot: [0, 1.2] });
  shape(ctx, F, xf, [[-0.16, 1.06], [0.16, 1.06], [0.1, 1.34], [0, 1.42], [-0.1, 1.34]],
    { c0: '#08080c', c1: '#1e110c', c2: '#3a1c14', gloss: false, outline: 'rgba(0,0,0,0.6)' });
  for (const s of [1, -1]) {
    L(ctx, F, xf, [[0.12 * s, 1.18], [0.26 * s, 1.4], [0.3 * s, 1.62]], '#120a08', 0.02, 0);
    discU(ctx, F, xf, 0.3 * s, 1.62, 0.05, [[0, '#5a2a1e'], [1, '#0a0608']]);
  }
}
const ANT = {
  id: 'ant', name: 'アリ', emoji: '🐜', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.4], lock: { sound: 'heavy', shake: 7, burst: 12 }, draw: antHead },
    { dur: 0.4, anchor: [0.74, 0], lock: { sound: 'click', shake: 4, burst: 6, both: true }, draw: antEyes },
    { dur: 0.45, anchor: [0, -1.4], lock: { sound: 'click', shake: 5, burst: 10, both: true }, draw: both(antAntenna) },
    { dur: 0.4, anchor: [0, 1.7], lock: { sound: 'heavy', shake: 8, burst: 16, both: true }, draw: both(antMandibles) },
    { dur: 0.35, anchor: [0, 1.2], lock: { sound: 'click', shake: 3 }, draw: antPalps },
  ],
};

// ============================================================ IMAGE =========
// Runtime mask from a user-supplied image, warped onto the face (clipped to the
// face oval) and flown in like any other mask.
export function makeImageMask(img) {
  const draw = (ctx, F, p) => {
    const e = easeOutBack(clamp01(p));
    const sc = 0.55 + 0.45 * e;
    ctx.save();
    ctx.globalAlpha = clamp01(p * 1.4);
    // map face-space -> screen (multiplies onto the current shake transform)
    ctx.transform(F.s * F.xhat.x, F.s * F.xhat.y, F.s * F.yhat.x, F.s * F.yhat.y, F.mid.x, F.mid.y);
    ctx.translate(0, 0.5); ctx.scale(sc, sc); ctx.translate(0, -0.5);
    // clip to the face oval so the photo reads as a face mask
    ctx.beginPath();
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const [u, v] = FACE_OVAL[i];
      if (i === 0) ctx.moveTo(u, v); else ctx.lineTo(u, v);
    }
    ctx.closePath();
    ctx.clip();
    // cover-fit the image into the face box, preserving aspect ratio
    const bx = -1.32, by = -1.4, bw = 2.64, bh = 3.5;
    const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
    const ar = iw / ih, boxAr = bw / bh;
    let dw = bw, dh = bh, dx = bx, dy = by;
    if (ar > boxAr) { dh = bh; dw = dh * ar; dx = bx + (bw - dw) / 2; }
    else { dw = bw; dh = dw / ar; dy = by + (bh - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  };
  return {
    id: 'image', name: '画像', emoji: '🖼️', finale: 'puff',
    parts: [
      { dur: 0.6, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 9, burst: 18, flash: 0.18, both: true }, draw },
    ],
  };
}

export const MASKS = [MECHA, TENGU, OKAME, VAMPIRE, ZOMBIE, POOP, TREE, ANT];
