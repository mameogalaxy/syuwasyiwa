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
  fly, shape, metal, strokePts, discU, ember, mirror, clamp01, trace,
  easeOutBack, easeOutExpo, FACE_OVAL,
} from './gfx.js';

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

// ============================================================ TENGU =========
function skin(ctx, F, p, env, cols, extra) {
  const xf = fly(F, p, { fromScale: 0.5, pivot: [0, 0.5] });
  shape(ctx, F, xf, FACE_OVAL, Object.assign({ c0: cols[0], c1: cols[1], c2: cols[2], outline: cols[3] || 'rgba(0,0,0,0.5)', top: -1.2, bot: 2.0 }, extra || {}));
  return xf;
}
function tenguFace(ctx, F, p, env) { skin(ctx, F, p, env, ['#7a0f0f', '#c12626', '#e85a4a']); }
function tenguNose(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.6, fromScale: 0.4, pivot: [0, 0.3] });
  shape(ctx, F, xf, [[-0.2, 0.0], [0.2, 0.0], [0.26, 0.5], [0.16, 1.2], [0, 1.55], [-0.16, 1.2], [-0.26, 0.5]],
    { c0: '#8a1414', c1: '#d83a2c', c2: '#ff7a5e', top: -0.1, bot: 1.6 });
  ember(ctx, xf, F, 0, 0.4, '#ff9a7a', 0.25, 0.18);
}
function tenguBrows(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.4, fromScale: 0.7, pivot: [0, -0.3] });
  for (const s of [1, -1])
    shape(ctx, F, xf, [[0.2 * s, -0.42], [0.95 * s, -0.55], [1.0 * s, -0.3], [0.3 * s, -0.12]],
      { c0: '#cfcfcf', c1: '#ffffff', c2: '#ffffff', outline: 'rgba(120,120,120,0.6)', gloss: false });
}
function tenguMustache(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 1.4, fromScale: 0.7, pivot: [0, 1.3] });
  shape(ctx, F, xf, [[-0.55, 1.15], [0.55, 1.15], [0.85, 1.5], [0.4, 1.55], [0, 1.35], [-0.4, 1.55], [-0.85, 1.5]],
    { c0: '#d8d8d8', c1: '#ffffff', c2: '#ffffff', outline: 'rgba(130,130,130,0.6)', gloss: false });
}
function tenguCap(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -2.0, fromScale: 0.6, pivot: [0, -1.0] });
  discU(ctx, F, xf, 0, -1.0, 0.22, [[0, '#3a3a3a'], [0.6, '#161616'], [1, '#000']], 'rgba(0,0,0,0.6)');
}
const TENGU = {
  id: 'tengu', name: '天狗', emoji: '👺', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: tenguFace },
    { dur: 0.55, anchor: [0, 0.8], lock: { sound: 'click', shake: 8, burst: 16 }, draw: tenguNose },
    { dur: 0.4, anchor: [0, -0.4], lock: { sound: 'click', shake: 4 }, draw: tenguBrows },
    { dur: 0.4, anchor: [0, 1.4], lock: { sound: 'click', shake: 4 }, draw: tenguMustache },
    { dur: 0.4, anchor: [0, -1.0], lock: { sound: 'click', shake: 4 }, draw: tenguCap },
  ],
};

// ============================================================ OKAME =========
function okameFace(ctx, F, p, env) { skin(ctx, F, p, env, ['#e7c9a8', '#f6e2cc', '#fff6ec']); }
function okameHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.8, fromScale: 0.7, pivot: [0, -0.8] });
  shape(ctx, F, xf, [[-1.25, 0.3], [-1.2, -0.6], [-0.6, -1.25], [0, -1.4], [0.6, -1.25], [1.2, -0.6], [1.25, 0.3],
    [0.9, -0.1], [0.5, -0.45], [0, -0.55], [-0.5, -0.45], [-0.9, -0.1]],
    { c0: '#000', c1: '#1c1c22', c2: '#3a3a44', outline: null });
  // hair side buns
  for (const s of [1, -1]) discU(ctx, F, xf, 1.15 * s, 0.5, 0.32, [[0, '#3a3a44'], [0.6, '#16161c'], [1, '#000']]);
}
function okameCheeks(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.1, pivot: [0, 0.7] });
  const a = 0.5 + 0.5 * easeOutBack(clamp01(p));
  for (const s of [1, -1]) { ctx.save(); ctx.globalAlpha = a; discU(ctx, F, xf, 0.78 * s, 0.85, 0.3, [[0, 'rgba(255,150,150,0.9)'], [1, 'rgba(240,90,110,0)']]); ctx.restore(); }
}
function okameEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 0] });
  for (const s of [1, -1]) L(ctx, F, xf, [[0.28 * s, 0.05], [0.5 * s, 0.0], [0.66 * s, 0.06]], '#1a1a1a', 0.03, 0);
  // tiny brows (high dots)
  for (const s of [1, -1]) discU(ctx, F, xf, 0.45 * s, -0.5, 0.07, [[0, '#2a2a2a'], [1, '#000']]);
}
function okameMouth(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 1.1] });
  discU(ctx, F, xf, 0, 1.15, 0.12, [[0, '#ff7a86'], [0.7, '#e23b56'], [1, '#a3132e']], 'rgba(120,10,30,0.6)');
}
const OKAME = {
  id: 'okame', name: 'おかめ', emoji: '😊', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'click', shake: 5, burst: 10 }, draw: okameFace },
    { dur: 0.5, anchor: [0, -0.8], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: okameHair },
    { dur: 0.35, anchor: [0, 0.85], lock: { sound: 'click', shake: 3 }, draw: okameCheeks },
    { dur: 0.35, anchor: [0, 0], lock: { sound: 'click', shake: 3 }, draw: okameEyes },
    { dur: 0.35, anchor: [0, 1.15], lock: { sound: 'click', shake: 3 }, draw: okameMouth },
  ],
};

// ============================================================ VAMPIRE =======
function vampFace(ctx, F, p, env) { skin(ctx, F, p, env, ['#9fb0c4', '#d7e2ee', '#f2f7fc']); }
function vampCollar(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 1.6, fromScale: 0.7, pivot: [0, 1.7] });
  shape(ctx, F, xf, [[-1.7, 2.2], [-1.5, 0.9], [-0.5, 1.7], [0, 1.5], [0.5, 1.7], [1.5, 0.9], [1.7, 2.2]],
    { c0: '#0a0a10', c1: '#23232e', c2: '#3a3a48', outline: 'rgba(0,0,0,0.6)' });
  // red lining
  L(ctx, F, xf, [[-1.45, 1.0], [-0.5, 1.7], [0, 1.55], [0.5, 1.7], [1.45, 1.0]], '#8a0d1c', 0.05, 0);
}
function vampHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.8, fromScale: 0.75, pivot: [0, -0.8] });
  shape(ctx, F, xf, [[-1.22, 0.1], [-1.2, -0.7], [-0.5, -1.3], [0, -1.42], [0.5, -1.3], [1.2, -0.7], [1.22, 0.1],
    [0.8, -0.2], [0.35, -0.5], [0, 0.0], [-0.35, -0.5], [-0.8, -0.2]],
    { c0: '#000', c1: '#15151b', c2: '#2c2c36', outline: null });
}
function vampBrows(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.8, fromScale: 0.6, pivot: [0, -0.3] });
  for (const s of [1, -1]) shape(ctx, F, xf, [[0.22 * s, -0.36], [0.85 * s, -0.5], [0.9 * s, -0.34], [0.3 * s, -0.14]],
    { c0: '#000', c1: '#15151b', c2: '#2c2c36', gloss: false, outline: null });
}
function vampEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2 });
  for (const s of [1, -1]) ember(ctx, xf, F, 0.5 * s, 0.02, '#ff2b3c', 0.5 + 0.5 * env.ignite, 0.13);
}
function vampFangs(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.5, fromScale: 0.4, pivot: [0, 1.15] });
  // mouth
  shape(ctx, F, xf, [[-0.4, 1.05], [0.4, 1.05], [0.34, 1.32], [0, 1.4], [-0.34, 1.32]],
    { c0: '#3a0a12', c1: '#6e121f', c2: '#8a1626', gloss: false, outline: 'rgba(0,0,0,0.5)' });
  for (const s of [1, -1]) shape(ctx, F, xf, [[0.18 * s, 1.06], [0.3 * s, 1.06], [0.22 * s, 1.34]],
    { c0: '#dcdcdc', c1: '#fff', c2: '#fff', gloss: false, outline: 'rgba(120,120,120,0.5)' });
}
const VAMPIRE = {
  id: 'vampire', name: 'バンパイア', emoji: '🧛', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 1.7], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: vampCollar },
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'click', shake: 5, burst: 10 }, draw: vampFace },
    { dur: 0.45, anchor: [0, -0.8], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: vampHair },
    { dur: 0.3, anchor: [0, -0.3], lock: { sound: 'click', shake: 3 }, draw: vampBrows },
    { dur: 0.35, anchor: [0, 1.2], lock: { sound: 'click', shake: 4 }, draw: vampFangs },
    { dur: 0.35, anchor: [0, 0], lock: { sound: null, shake: 3, flash: 0.18 }, draw: vampEyes },
  ],
};

// ============================================================ ZOMBIE ========
function zombieFace(ctx, F, p, env) {
  skin(ctx, F, p, env, ['#3c5a32', '#6f9a52', '#9ec471']);
}
function zombieSockets(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.3 });
  for (const s of [1, -1]) discU(ctx, F, xf, 0.5 * s, 0.02, 0.34, [[0, 'rgba(20,30,15,0.95)'], [0.7, 'rgba(20,30,15,0.7)'], [1, 'rgba(20,30,15,0)']]);
  for (const s of [1, -1]) ember(ctx, xf, F, 0.5 * s, 0.02, '#c8ff7a', 0.4 + 0.5 * env.ignite, 0.1);
}
function zombieStitches(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -0.8, fromScale: 0.7, pivot: [0, -0.6] });
  const line = [[-1.0, -0.5], [-0.3, -0.7], [0.4, -0.55], [1.0, -0.75]];
  L(ctx, F, xf, line, 'rgba(20,30,15,0.8)', 0.02, 0);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    L(ctx, F, xf, [[mx - 0.08, my - 0.1], [mx + 0.08, my + 0.1]], 'rgba(20,30,15,0.8)', 0.018, 0);
  }
}
function zombieScar(ctx, F, p, env) {
  const xf = fly(F, p, { fromU: 1.5, fromScale: 0.6, pivot: [0.7, 0.6] });
  L(ctx, F, xf, [[0.75, 0.3], [0.85, 0.7], [0.7, 1.05]], '#7a1414', 0.03, 0);
  for (const t of [0.4, 0.6, 0.8]) L(ctx, F, xf, [[0.7, 0.3 + t * 0.7], [0.92, 0.3 + t * 0.7]], '#7a1414', 0.016, 0);
}
function zombieMouth(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.6, fromScale: 0.4, pivot: [0, 1.2] });
  shape(ctx, F, xf, [[-0.5, 1.05], [0.5, 1.05], [0.4, 1.45], [-0.4, 1.45]],
    { c0: '#1a0a0a', c1: '#2a1010', c2: '#3a1818', gloss: false, outline: 'rgba(0,0,0,0.6)' });
  for (let i = -2; i <= 2; i++) shape(ctx, F, xf, [[i * 0.18 - 0.05, 1.06], [i * 0.18 + 0.05, 1.06], [i * 0.18, 1.2]],
    { c0: '#b9b98a', c1: '#e8e8c0', c2: '#fff', gloss: false, outline: null });
}
function zombieHair(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.6, fromScale: 0.7, pivot: [0, -0.9] });
  shape(ctx, F, xf, [[-1.0, -0.5], [-0.9, -1.2], [-0.3, -0.9], [0, -1.4], [0.4, -0.95], [0.95, -1.25], [1.0, -0.5],
    [0.5, -0.7], [0, -0.5], [-0.5, -0.7]],
    { c0: '#101410', c1: '#26301f', c2: '#3a4a2e', outline: null });
}
const ZOMBIE = {
  id: 'zombie', name: 'ゾンビ', emoji: '🧟', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 12 }, draw: zombieFace },
    { dur: 0.4, anchor: [0, -0.7], lock: { sound: 'click', shake: 4 }, draw: zombieHair },
    { dur: 0.4, anchor: [0, 0], lock: { sound: 'click', shake: 4 }, draw: zombieSockets },
    { dur: 0.35, anchor: [0, -0.6], lock: { sound: 'click', shake: 3 }, draw: zombieStitches },
    { dur: 0.35, anchor: [0.8, 0.6], lock: { sound: 'click', shake: 3 }, draw: zombieScar },
    { dur: 0.35, anchor: [0, 1.2], lock: { sound: 'heavy', shake: 5 }, draw: zombieMouth },
  ],
};

// ============================================================ POOP ==========
function poopTier(ctx, F, cx, cy, rx, ry, p, fromV) {
  const xf = fly(F, p, { fromV, fromScale: 0.4, pivot: [cx, cy] });
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  shape(ctx, F, xf, pts, { c0: '#5b3416', c1: '#8a5424', c2: '#c08743', outline: 'rgba(50,28,10,0.6)', top: cy - ry, bot: cy + ry });
}
const POOP = {
  id: 'poop', name: 'うんこ', emoji: '💩', finale: 'puff',
  parts: [
    { dur: 0.45, anchor: [0, 1.6], lock: { sound: 'heavy', shake: 7, burst: 12 }, draw: (c, F, p) => poopTier(c, F, 0, 1.55, 1.25, 0.7, p, 1.6) },
    { dur: 0.45, anchor: [0, 0.7], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: (c, F, p) => poopTier(c, F, 0, 0.7, 1.0, 0.62, p, 1.0) },
    { dur: 0.45, anchor: [0, -0.2], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: (c, F, p) => poopTier(c, F, 0, -0.15, 0.72, 0.52, p, 0.8) },
    {
      dur: 0.4, anchor: [0, -1.0], lock: { sound: 'click', shake: 5 }, draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromV: -1.5, fromScale: 0.3, pivot: [0, -0.7] });
        shape(ctx, F, xf, [[-0.4, -0.5], [0.4, -0.5], [0.22, -1.0], [0, -1.5], [-0.22, -1.0]],
          { c0: '#5b3416', c1: '#8a5424', c2: '#c08743', outline: 'rgba(50,28,10,0.6)', top: -1.5, bot: -0.5 });
      },
    },
    {
      dur: 0.35, anchor: [0, 0.1], lock: { sound: 'click', shake: 3 }, draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromScale: 0.2 });
        for (const s of [1, -1]) {
          discU(ctx, F, xf, 0.42 * s, 0.05, 0.26, [[0, '#fff'], [0.8, '#fff'], [1, '#e0e0e0']], 'rgba(0,0,0,0.5)');
          discU(ctx, F, xf, 0.42 * s, 0.1, 0.12, [[0, '#333'], [1, '#000']]);
        }
      },
    },
    {
      dur: 0.35, anchor: [0, 0.8], lock: { sound: 'click', shake: 3 }, draw: (ctx, F, p) => {
        const xf = fly(F, p, { fromScale: 0.2, pivot: [0, 0.8] });
        const a = clamp01(p);
        ctx.save(); ctx.globalAlpha = a;
        ctx.strokeStyle = '#2a1606'; ctx.lineWidth = Math.max(2, F.s * 0.06); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const t = i / 16, u = -0.45 + t * 0.9, v = 0.7 + Math.sin(t * Math.PI) * 0.45; const q = xf(u, v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke(); ctx.restore();
      },
    },
  ],
};

// ============================================================ TREE ==========
function treeBark(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#3e2a16', '#6b4a28', '#8f6a3e']);
  for (const u of [-0.5, 0, 0.5]) L(ctx, F, xf, [[u, -0.5], [u + 0.1, 0.5], [u, 1.6]], 'rgba(40,26,12,0.6)', 0.02, 0);
}
function treeCanopy(ctx, F, p, env, side) {
  const cx = side === 0 ? 0 : 1.15 * side, cy = side === 0 ? -1.1 : -0.2;
  const xf = fly(F, p, { fromV: -1.6, fromScale: 0.3, pivot: [cx, cy] });
  const blob = (bx, by, r) => discU(ctx, F, xf, bx, by, r, [[0, '#7bbf4e'], [0.6, '#3f8f3a'], [1, '#246b2c']], 'rgba(20,60,25,0.5)');
  if (side === 0) { blob(0, -1.15, 0.7); blob(-0.6, -0.85, 0.5); blob(0.6, -0.85, 0.5); blob(0, -0.6, 0.55); }
  else { blob(cx, cy, 0.5); blob(cx + 0.1 * side, cy + 0.4, 0.4); }
}
function treeEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2 });
  for (const s of [1, -1]) { discU(ctx, F, xf, 0.5 * s, 0.05, 0.2, [[0, '#2a1c0e'], [1, '#120a04']]); ember(ctx, xf, F, 0.5 * s, 0.0, '#ffe39a', 0.3 + 0.4 * env.ignite, 0.06); }
}
const TREE = {
  id: 'tree', name: '木', emoji: '🌳', glow: true, finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.5], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: treeBark },
    { dur: 0.45, anchor: [0, -1.1], lock: { sound: 'click', shake: 6, burst: 14 }, draw: (c, F, p, e) => treeCanopy(c, F, p, e, 0) },
    { dur: 0.4, anchor: [1.15, -0.2], lock: { sound: 'click', shake: 4, both: true }, draw: (c, F, p, e) => { treeCanopy(c, F, p, e, 1); treeCanopy(c, F, p, e, -1); } },
    { dur: 0.35, anchor: [0, 0], lock: { sound: 'click', shake: 3 }, draw: treeEyes },
  ],
};

// ============================================================ ANT ===========
function antHead(ctx, F, p, env) {
  const xf = skin(ctx, F, p, env, ['#0c0c10', '#2a1a14', '#5a2a1e']);
  // glossy highlight band
  ctx.save(); ctx.globalAlpha = 0.5;
  L(ctx, F, xf, [[-0.7, -0.5], [0, -0.7], [0.7, -0.5]], 'rgba(180,140,120,0.5)', 0.05, 0);
  ctx.restore();
}
function antAntennae(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: -1.4, fromScale: 0.5, pivot: [0, -0.8] });
  for (const s of [1, -1]) {
    ctx.save(); ctx.strokeStyle = '#0a0a0e'; ctx.lineWidth = Math.max(2, F.s * 0.05); ctx.lineCap = 'round';
    ctx.beginPath();
    const pts = [[0.15 * s, -0.6], [0.4 * s, -1.1], [0.75 * s, -1.4], [1.0 * s, -1.85]];
    for (let i = 0; i < pts.length; i++) { const q = xf(pts[i][0], pts[i][1]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke(); ctx.restore();
    discU(ctx, F, xf, 1.0 * s, -1.85, 0.12, [[0, '#5a2a1e'], [0.6, '#2a1410'], [1, '#000']]);
  }
}
function antEyes(ctx, F, p, env) {
  const xf = fly(F, p, { fromScale: 0.2 });
  for (const s of [1, -1]) {
    discU(ctx, F, xf, 0.6 * s, 0.0, 0.34, [[0, '#3a3a44'], [0.5, '#15151b'], [1, '#000']], 'rgba(0,0,0,0.6)');
    ember(ctx, xf, F, 0.5 * s, -0.12, '#ffffff', 0.5, 0.05);
  }
}
function antMandibles(ctx, F, p, env) {
  const xf = fly(F, p, { fromV: 0.8, fromScale: 0.5, pivot: [0, 1.4] });
  for (const s of [1, -1]) shape(ctx, F, xf, [[0.1 * s, 1.2], [0.5 * s, 1.35], [0.7 * s, 1.85], [0.45 * s, 1.95], [0.3 * s, 1.55], [0.05 * s, 1.45]],
    { c0: '#0a0a0e', c1: '#241410', c2: '#5a2a1e', outline: 'rgba(0,0,0,0.6)' });
}
const ANT = {
  id: 'ant', name: 'アリ', emoji: '🐜', finale: 'puff',
  parts: [
    { dur: 0.5, anchor: [0, 0.4], lock: { sound: 'heavy', shake: 6, burst: 10 }, draw: antHead },
    { dur: 0.45, anchor: [0, -1.4], lock: { sound: 'click', shake: 5, burst: 12 }, draw: antAntennae },
    { dur: 0.4, anchor: [0.6, 0], lock: { sound: 'click', shake: 4 }, draw: antEyes },
    { dur: 0.4, anchor: [0, 1.7], lock: { sound: 'heavy', shake: 7, burst: 14, both: true }, draw: antMandibles },
  ],
};

export const MASKS = [MECHA, TENGU, OKAME, VAMPIRE, ZOMBIE, POOP, TREE, ANT];
