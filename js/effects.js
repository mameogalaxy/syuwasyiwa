// Screen-space cinematic effects: spark particles, camera shake, flash,
// and the post-transformation HUD (targeting ring, scanline, telemetry).
// All of this is deliberately lightweight so it stays smooth on phones.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor() {
    this.particles = [];
    this.shakeAmt = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.t = 0;
    this.ambientTimer = 0;
    this.MAX = 220;
  }

  // ---- triggers ----
  shake(mag) { this.shakeAmt = Math.max(this.shakeAmt, mag); }

  doFlash(a, color = '210,240,255') { this.flash = Math.max(this.flash, a); this.flashColor = color; }

  burst(x, y, n, opt = {}) {
    const speed = opt.speed ?? 1;
    const hue = opt.color ?? 'cyan';
    for (let i = 0; i < n && this.particles.length < this.MAX; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 340) * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.35, 0.8),
        max: 0.8,
        size: rand(1.2, 3.2),
        drag: rand(1.5, 3.5),
        kind: hue,
        spark: Math.random() < 0.5,
      });
    }
  }

  // a circular shockwave of particles (used at completion)
  ring(x, y, n, radiusSpeed) {
    for (let i = 0; i < n && this.particles.length < this.MAX; i++) {
      const a = (i / n) * TAU + rand(-0.05, 0.05);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * radiusSpeed,
        vy: Math.sin(a) * radiusSpeed,
        life: rand(0.5, 0.9), max: 0.9,
        size: rand(1.5, 3), drag: 2.2, kind: 'cyan', spark: true,
      });
    }
  }

  // ---- update ----
  update(dt, power) {
    this.t += dt;
    this.shakeAmt *= Math.pow(0.0025, dt);      // fast decay
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    this.flash *= Math.pow(0.02, dt);
    if (this.flash < 0.01) this.flash = 0;

    const p = this.particles;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      const d = Math.pow(0.5, dt * q.drag);
      q.vx *= d; q.vy *= d;
      q.vy += 220 * dt;            // slight gravity
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.life -= dt;
      if (q.life <= 0) p.splice(i, 1);
    }

    // ambient HUD motes once the suit is online
    if (power > 0.4) {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0 && p.length < this.MAX) {
        this.ambientTimer = rand(0.08, 0.2);
        p.push({
          x: rand(0, this._w), y: rand(0, this._h),
          vx: rand(-10, 10), vy: rand(-30, -10),
          life: rand(0.8, 1.6), max: 1.6, size: rand(0.8, 1.8),
          drag: 0.4, kind: 'cyan', spark: false,
        });
      }
    }
  }

  shakeOffset() {
    if (!this.shakeAmt) return { x: 0, y: 0 };
    return { x: rand(-1, 1) * this.shakeAmt, y: rand(-1, 1) * this.shakeAmt };
  }

  // ---- draw ----
  drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.particles) {
      const a = Math.max(0, q.life / q.max);
      const col = q.kind === 'white' ? '255,255,255'
        : q.kind === 'amber' ? '255,190,120' : '150,232,255';
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgba(${col},1)`;
      ctx.shadowColor = `rgba(${col},1)`;
      ctx.shadowBlur = q.size * 4;
      if (q.spark) {
        // streak
        ctx.fillRect(q.x - q.size * 0.5, q.y - q.size * 0.5, q.size, q.size);
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawFlash(ctx, w, h) {
    if (!this.flash) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // HUD anchored to the face frame; intensity ramps with `power` (0..1).
  drawHud(ctx, F, power, w, h) {
    this._w = w; this._h = h;
    if (power <= 0.01 || !F) return;
    const cx = F.to(0, 0.55).x, cy = F.to(0, 0.55).y; // around face centre
    const R = F.s * 2.05;
    const t = this.t;
    ctx.save();
    ctx.globalAlpha = power;
    ctx.lineCap = 'round';

    // rotating targeting ring (two arcs)
    ctx.strokeStyle = 'rgba(150,232,255,0.85)';
    ctx.shadowColor = 'rgba(120,220,255,0.9)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = Math.max(1.5, F.s * 0.02);
    for (let k = 0; k < 2; k++) {
      const off = t * (k ? -0.6 : 0.9) + k * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, R - k * F.s * 0.14, off, off + 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R - k * F.s * 0.14, off + Math.PI, off + Math.PI + 1.1);
      ctx.stroke();
    }

    // tick marks
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(150,232,255,0.5)';
    ctx.lineWidth = Math.max(1, F.s * 0.012);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + t * 0.2;
      const r0 = R + F.s * 0.06, r1 = R + F.s * (i % 6 === 0 ? 0.16 : 0.1);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // corner brackets around the face box
    const bw = F.s * 1.7, bh = F.s * 2.4;
    const bx = cx - bw, by = cy - bh * 0.62;
    const L = F.s * 0.28;
    ctx.strokeStyle = 'rgba(150,232,255,0.8)';
    ctx.lineWidth = Math.max(1.5, F.s * 0.02);
    const corner = (x, y, sx, sy) => {
      ctx.beginPath();
      ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
      ctx.stroke();
    };
    corner(bx, by, 1, 1); corner(bx + bw * 2, by, -1, 1);
    corner(bx, by + bh * 1.24, 1, -1); corner(bx + bw * 2, by + bh * 1.24, -1, -1);

    // scanline sweeping down the face box
    const sy = by + ((t * 0.45) % 1) * bh * 1.24;
    const grd = ctx.createLinearGradient(0, sy - 18, 0, sy + 18);
    grd.addColorStop(0, 'rgba(150,232,255,0)');
    grd.addColorStop(0.5, 'rgba(150,232,255,0.5)');
    grd.addColorStop(1, 'rgba(150,232,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(bx, sy - 18, bw * 2, 36);

    // telemetry text
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(120,220,255,0.8)';
    ctx.fillStyle = 'rgba(180,240,255,0.95)';
    const fs = Math.max(10, F.s * 0.12);
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText('SYSTEM ONLINE', bx, by - fs * 1.6);
    ctx.textAlign = 'right';
    ctx.fillText('TARGET // LOCK', bx + bw * 2, by - fs * 1.6);
    ctx.textAlign = 'left';
    const pct = Math.min(100, Math.round(80 + 20 * Math.abs(Math.sin(t)))) ;
    ctx.fillText('SYNC ' + pct + '%', bx, by + bh * 1.24 + fs * 0.4);
    ctx.restore();
  }
}
