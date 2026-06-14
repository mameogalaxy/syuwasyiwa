// Generic transformation engine: runs a mask's parts through a staged
// assemble -> hold -> disassemble sequence, firing effects + sound.

import * as sfx from './sound.js?v=9';
import { clamp01, easeInCubic } from './gfx.js?v=9';

const REL_LEAD = 0.26, REL_STAGGER = 0.15, REL_PART = 0.5;

export class Transformer {
  constructor(effects) {
    this.fx = effects;
    this.onStage = null;
    this.F = null;
    this.time = 0;
    this.mask = null;
    this._idle();
  }

  _idle() {
    this.active = false;
    this.done = false;
    this.releasing = false;
    this.si = -1;          // current stage index
    this.st = 0;           // time into stage
    this.relT = 0;
    this.snap = null;
    this.relFired = {};
    this.locked = {};
    this.power = 0;
  }

  setMask(mask) {
    if (this.active) this._idle();
    this.mask = mask;
    // build stage timeline
    const st = [];
    if (mask.intro === 'scan') st.push({ kind: 'scan', dur: 0.5 });
    this.partStage = [];
    mask.parts.forEach((p, i) => { this.partStage[i] = st.length; st.push({ kind: 'part', i, dur: p.dur || 0.5 }); });
    this._ignitePoint = st.length - 1; // last part stage starts the power ramp
    if (mask.glow) st.push({ kind: 'ignite', dur: 0.4 });
    if (mask.hud) st.push({ kind: 'hud', dur: 0.5 });
    this.stages = st;
  }

  get isComplete() { return this.done; }
  get isAnimating() { return this.active && !this.done; }
  get isReleasing() { return this.releasing; }

  start() {
    if (!this.mask || (this.active && this.si >= 0)) return;
    this._idle();
    this.active = true;
    this.si = 0; this.st = 0;
    this._enter(this.stages[0]);
    if (this.onStage) this.onStage('TRANSFORM…');
    this.relTotal = REL_LEAD + (this.mask.parts.length - 1) * REL_STAGGER + REL_PART + 0.2;
  }

  disengage() {
    if (!this.active || this.releasing) return;
    this.releasing = true; this.relT = 0; this.relFired = {};
    this.snap = this.mask.parts.map((_, i) => this._entry(i));
    sfx.powerDown(0.55);
    this.fx.doFlash(0.12, '150,232,255');
    if (this.onStage) this.onStage('解除 — DISENGAGE');
  }

  _enter(stg) {
    if (stg.kind === 'scan') sfx.scanSweep(0.5);
    else if (stg.kind === 'ignite') sfx.powerUp(0.5);
    else if (stg.kind === 'hud') sfx.hudBoot();
    else if (stg.kind === 'part') {
      const en = this.mask.parts[stg.i].enter;
      if (en) en(); else sfx.whoosh(0.4);
    }
  }

  _entry(i) {
    const s = this.partStage[i];
    if (this.si < 0) return 0;
    if (this.si > s) return 1;
    if (this.si < s) return 0;
    return clamp01(this.st / this.stages[s].dur);
  }

  _relEntry(i) {
    const order = this.mask.parts.length - 1 - i; // last part leaves first
    const startT = REL_LEAD + order * REL_STAGGER;
    const exitP = clamp01((this.relT - startT) / REL_PART);
    const base = (this.snap && this.snap[i]) || 0;
    return base * (1 - easeInCubic(exitP));
  }

  _impact(i) {
    if (this.locked[i] || !this.F) return;
    this.locked[i] = true;
    const part = this.mask.parts[i], lk = part.lock || {};
    const [u, v] = part.anchor || [0, 0];
    const a = this.F.to(u, v);
    if (lk.burst) {
      this.fx.burst(a.x, a.y, lk.burst);
      if (lk.both) { const b = this.F.to(-u, v); this.fx.burst(b.x, b.y, lk.burst); }
    }
    if (lk.ring) this.fx.ring(a.x, a.y, 18, 260);
    if (lk.shake) this.fx.shake(lk.shake);
    if (lk.flash) this.fx.doFlash(lk.flash, '210,240,255');
    if (lk.sound === 'click') sfx.clickLock();
    else if (lk.sound === 'heavy') sfx.heavyLock();
  }

  _releaseFx() {
    if (!this.F) return;
    const n = this.mask.parts.length;
    for (let i = 0; i < n; i++) {
      if (this.relFired[i]) continue;
      const order = n - 1 - i;
      if (this.relT >= REL_LEAD + order * REL_STAGGER) {
        this.relFired[i] = true;
        const [u, v] = this.mask.parts[i].anchor || [0, 0];
        const a = this.F.to(u, v);
        this.fx.burst(a.x, a.y, 9, { speed: 0.8 });
        this.fx.shake(5);
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
      if (this.relT >= this.relTotal) { this._idle(); if (this.onStage) this.onStage(null); }
      return;
    }

    if (!this.active || this.si < 0) return;

    const target = this.si >= this._ignitePoint ? 1 : 0;
    this.power += (target - this.power) * (1 - Math.pow(0.001, dt));

    if (this.done) return;
    this.st += dt;
    const stg = this.stages[this.si];
    if (stg.kind === 'part' && this.st / stg.dur > 0.82) this._impact(stg.i);

    if (this.st >= stg.dur) {
      this.st -= stg.dur;
      this.si++;
      if (this.si >= this.stages.length) {
        this.si = this.stages.length - 1;
        this.st = this.stages[this.si].dur;
        this.done = true;
        this._finale();
        if (this.onStage) this.onStage(this.mask.name + ' 変身完了');
      } else {
        this._enter(this.stages[this.si]);
      }
    }
  }

  _finale() {
    if (this.F) {
      const c = this.F.to(0, 0.4);
      this.fx.ring(c.x, c.y, 28, 360);
      this.fx.doFlash(0.3, '180,240,255');
      this.fx.shake(8);
    }
    if (this.mask.glow) sfx.chord(); else { sfx.clickLock(); sfx.chord(); }
  }

  draw(ctx, F) {
    this.F = F;
    if (this.si < 0 && !this.releasing) return;
    const env = { time: this.time, power: this.power, ignite: this.power };

    if (!this.releasing && this.mask.intro === 'scan' && this.si === 0 && this.stages[0].kind === 'scan')
      drawScan(ctx, F, clamp01(this.st / this.stages[0].dur));

    const parts = this.mask.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = this.releasing ? this._relEntry(i) : this._entry(i);
      if (p > 0.001) {
        ctx.save();
        parts[i].draw(ctx, F, p, env);
        ctx.restore();
      }
    }
  }
}

function drawScan(ctx, F, p) {
  const v = -0.9 + p * 1.8;
  const a = F.to(-1.3, v), b = F.to(1.3, v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(150,232,255,0.9)';
  ctx.shadowColor = '#8fe8ff'; ctx.shadowBlur = F.s * 0.5;
  ctx.lineWidth = Math.max(2, F.s * 0.04);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, F.s * 0.012);
  const box = [F.to(-1.25, -1.0), F.to(1.25, -1.0), F.to(1.25, 1.0), F.to(-1.25, 1.0)];
  ctx.beginPath(); ctx.moveTo(box[0].x, box[0].y);
  for (const q of box.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}
