// Shared graphics helpers + face frame, used by every mask definition.
//
// Face space:  origin = midpoint between the eyes, +u = toward right eye,
// +v = toward chin, 1 unit = inter-ocular distance.

// ---- landmark indices -------------------------------------------------------
const L_EYE = [33, 133, 159, 145];
const R_EYE = [263, 362, 386, 374];
const CHIN = 152;

// ---- easing -----------------------------------------------------------------
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInCubic = (t) => t * t * t;
export const easeOutBack = (t) => {
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

// ---- transforms -------------------------------------------------------------
export function xform(F, { tx = 0, ty = 0, rot = 0, scale = 1, pivot = [0, 0] }) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (u, v) => {
    const du = (u - pivot[0]) * scale, dv = (v - pivot[1]) * scale;
    return F.to(pivot[0] + du * c - dv * s + tx, pivot[1] + du * s + dv * c + ty);
  };
}

// fly-in: p 0->1 brings a part from its offset/rotation/scale into place
export function flyIn(p, cfg) {
  const e = easeOutBack(p), er = easeOutExpo(p);
  return {
    tx: (cfg.fromU || 0) * (1 - e),
    ty: (cfg.fromV || 0) * (1 - e),
    rot: (cfg.fromRot || 0) * (1 - er),
    scale: 1 + ((cfg.fromScale || 1) - 1) * (1 - er),
    pivot: cfg.pivot || [0, 0],
  };
}

// convenience: xform that flies a part in for progress p
export const fly = (F, p, cfg) => xform(F, flyIn(p, cfg));

// ---- primitives -------------------------------------------------------------
export function trace(ctx, xf, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = xf(pts[i][0], pts[i][1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

export function strokePts(ctx, F, xf, pts, color, wf, glow, closed) {
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

export const mirror = (pts) => pts.map(([u, v]) => [-u, v]);

// a soft drop shadow under a traced shape
function dropShadow(ctx, F, xf, pts, fill) {
  ctx.save();
  trace(ctx, xf, pts);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = F.s * 0.18;
  ctx.shadowOffsetX = F.s * 0.02; ctx.shadowOffsetY = F.s * 0.05;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// Generic shaded, rounded-looking coloured shape.
//   o: {c0 dark, c1 mid, c2 light, top, bot, outline, ow, grooves, glow, power,
//       rivets, gloss, shadow}
export function shape(ctx, F, xf, pts, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // lifted drop shadow for separation between stacked parts
  if (o.shadow !== false) {
    ctx.save();
    trace(ctx, xf, pts);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = F.s * (o.shadowBlur ?? 0.24);
    ctx.shadowOffsetX = F.s * 0.03; ctx.shadowOffsetY = F.s * 0.08;
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  const a = xf(-1.2, 0), b = xf(1.2, 0);
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  const c0 = o.c0 || '#222', c1 = o.c1 || '#555', c2 = o.c2 || '#999';
  g.addColorStop(0.0, c0); g.addColorStop(0.32, c1);
  g.addColorStop(0.55, c2); g.addColorStop(0.78, c1); g.addColorStop(1, c0);

  ctx.save();
  trace(ctx, xf, pts);
  ctx.fillStyle = o.fill || g;
  ctx.fill();
  ctx.clip();

  if (o.gloss !== false) {
    // bounding box of the shape on screen
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const pt of pts) {
      const p = xf(pt[0], pt[1]);
      if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
      if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
    }
    const bw = mxx - mnx, bh = mxy - mny;
    // light comes from upper-left: offset the highlight centre there
    const cx = mnx + bw * (o.lightU ?? 0.4), cy = mny + bh * (o.lightV ?? 0.34);
    const rad = Math.max(bw, bh) * 0.66;

    // radial form light: bright core -> neutral -> dark rim (occlusion = volume)
    const rg = ctx.createRadialGradient(cx, cy, rad * 0.06, cx, cy, rad);
    rg.addColorStop(0, `rgba(255,255,255,${o.hi ?? 0.26})`);
    rg.addColorStop(0.42, 'rgba(255,255,255,0.05)');
    rg.addColorStop(0.78, 'rgba(0,0,0,0.16)');
    rg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    // gentle directional sheen on top
    const t = xf(0, o.top ?? -1.4), c = xf(0, o.bot ?? 2.1);
    const sg = ctx.createLinearGradient(t.x, t.y, c.x, c.y);
    sg.addColorStop(0, 'rgba(255,255,255,0.16)');
    sg.addColorStop(0.3, 'rgba(255,255,255,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

    // tight specular hotspot
    if (o.spec) {
      const sp = xf(o.spec[0], o.spec[1]); const sr = (o.specR ?? 0.32) * F.s;
      const sg2 = ctx.createRadialGradient(sp.x, sp.y, 1, sp.x, sp.y, sr);
      sg2.addColorStop(0, 'rgba(255,255,255,0.55)');
      sg2.addColorStop(0.6, 'rgba(255,255,255,0.12)');
      sg2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg2; ctx.fillRect(0, 0, W, H);
    }
  }
  ctx.restore();

  if (o.grooves) for (const gl of o.grooves)
    strokePts(ctx, F, xf, gl, 'rgba(0,0,0,0.4)', 0.022, 0);
  if (o.outline !== null)
    strokePts(ctx, F, xf, pts, o.outline || 'rgba(0,0,0,0.55)', o.ow || 0.022, 0, true);
  if (o.glow) for (const gl of o.glow)
    strokePts(ctx, F, xf, gl.pts, gl.color || '#fff', gl.w || 0.02, (o.power ?? 0) * (gl.k ?? 1), gl.closed);
  if (o.rivets) for (const r of o.rivets) rivet(ctx, xf, F, r[0], r[1]);
}

// A shaded sphere — for rounded features (eyes, cheeks, noses, berries…).
export function sphere(ctx, F, xf, u, v, rUnits, baseDark, baseLight, outline) {
  const p = xf(u, v), r = rUnits * F.s;
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.05, p.x, p.y, r);
  g.addColorStop(0, baseLight);
  g.addColorStop(0.55, baseDark);
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  if (outline) { ctx.lineWidth = Math.max(1, F.s * 0.014); ctx.strokeStyle = outline; ctx.stroke(); }
  // crisp specular dot
  ctx.beginPath();
  ctx.arc(p.x - r * 0.34, p.y - r * 0.4, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
}

// Brushed-metal panel (for the mecha mask).
export function metal(ctx, F, xf, pts, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const blue = o.tint === 'blue';
  dropShadow(ctx, F, xf, pts, '#06090e');

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
  const t = xf(0, o.top ?? -1.5), c = xf(0, o.bot ?? 2.2);
  const sg = ctx.createLinearGradient(t.x, t.y, c.x, c.y);
  sg.addColorStop(0.0, 'rgba(255,255,255,0.45)');
  sg.addColorStop(0.18, 'rgba(220,238,255,0.12)');
  sg.addColorStop(0.55, 'rgba(0,0,0,0)');
  sg.addColorStop(1.0, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  const gx = 0.5 + 0.5 * Math.sin((o.time || 0) * 0.7 + (o.phase || 0));
  const s0 = xf(-1.3 + gx * 2.6, -1.6), s1 = xf(-0.95 + gx * 2.6, 2.3);
  const st = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
  st.addColorStop(0, 'rgba(255,255,255,0)');
  st.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  st.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = st; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (o.grooves) for (const gl of o.grooves) {
    strokePts(ctx, F, xf, gl, 'rgba(3,6,10,0.9)', 0.028, 0);
    strokePts(ctx, F, xf, gl, 'rgba(200,220,245,0.14)', 0.008, 0);
  }
  strokePts(ctx, F, xf, pts, '#04070c', 0.026, 0, true);
  strokePts(ctx, F, xf, pts, 'rgba(206,228,255,0.32)', 0.008, 0, true);
  if (o.glow) for (const gl of o.glow)
    strokePts(ctx, F, xf, gl.pts, gl.color || '#8fe8ff', gl.w || 0.02, (o.power ?? 0) * (gl.k ?? 1), gl.closed);
  if (o.rivets) for (const r of o.rivets) rivet(ctx, xf, F, r[0], r[1]);
}

export function rivet(ctx, xf, F, u, v) {
  const p = xf(u, v);
  const r = Math.max(1.3, F.s * 0.02);
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#d6def0'); g.addColorStop(0.5, '#59616f'); g.addColorStop(1, '#0a0e14');
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
}

// filled disc at face coords; rUnits in face units; stops -> radial gradient
export function discU(ctx, F, xf, u, v, rUnits, stops, outline) {
  const p = xf(u, v), r = rUnits * F.s;
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  if (outline) { ctx.lineWidth = Math.max(1, F.s * 0.016); ctx.strokeStyle = outline; ctx.stroke(); }
}

// glowing dot
export function ember(ctx, xf, F, u, v, color, glow, rfac = 0.16) {
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

// a generic face oval many masks reuse as the "skin" base
export const FACE_OVAL = [
  [0, -1.25], [0.55, -1.15], [0.95, -0.7], [1.16, -0.1], [1.2, 0.6],
  [1.06, 1.2], [0.78, 1.7], [0.36, 2.02], [0, 2.1],
  [-0.36, 2.02], [-0.78, 1.7], [-1.06, 1.2], [-1.2, 0.6],
  [-1.16, -0.1], [-0.95, -0.7], [-0.55, -1.15],
];
