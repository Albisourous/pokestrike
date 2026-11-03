// MS "ALL CONNECT": one shot that passes through every living teammate
// fires a friendship banner and powers up the next shot. No rng.
import { buzz } from '../core/audio';
import type { Telops } from './telop';
import { GOLD_HI, INK, fontB, uiWindow } from './ui';

export const CONNECT_MUL = 1.25; // next shot's damage after an ALL CONNECT
export const CONNECT_MIN = 2; // living teammates needed besides the shooter
const GREEN = '#7cf29a';
// OS reduced-motion seed (same probe as bg/evolve/fame): the link sparks hold still
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Mon { dead: boolean; def: { id: number }; x: number; y: number; r: number }

export class Connect {
  armed = false; // banked for the next launch
  live = false; // the shot in flight carries the bonus
  best = 0; // most teammates linked in one shot this stop
  alls = 0; // ALL CONNECTs this stop
  private touched = new Set<Mon>();
  private fired = false;
  private need = 0; // living allies the chain must thread — refreshed on each touch

  reset() {
    this.armed = this.live = this.fired = false;
    this.best = this.alls = this.need = 0;
    this.touched.clear();
  }
  // a launch spends a banked bonus: it rides this shot and no other
  launch() {
    this.live = this.armed;
    this.armed = this.fired = false;
    this.touched.clear();
  }
  mult() {
    return this.live ? CONNECT_MUL : 1;
  }
  // the shooter passed through ally `p`; fainted mons don't count
  touch(p: Mon, shooter: Mon, team: Mon[], telop?: Telops) {
    if (p.dead || p === shooter) return false;
    const fresh = !this.touched.has(p);
    this.touched.add(p);
    this.best = Math.max(this.best, this.touched.size);
    const others = team.filter((m) => !m.dead && m !== shooter);
    this.need = others.length;
    if (fresh) buzz([8]); // each new link ticks under the finger
    if (this.fired || others.length < CONNECT_MIN || !others.every((m) => this.touched.has(m))) return false;
    this.fired = this.armed = true;
    this.alls++;
    telop?.push({ kind: 'connect', title: 'ALL CONNECT', mons: team.filter((m) => !m.dead).map((m) => m.def.id) });
    buzz([20, 30, 20, 30, 40]);
    return true;
  }

  // live read on the active ball: a ring fills as the shot threads allies,
  // a pulse + orbiting sparks while the bonus waits banked or rides
  glow(ctx: CanvasRenderingContext2D, u: Mon, now: number) {
    const link = this.need > 0 ? Math.min(this.touched.size, this.need) : 0;
    if (!this.armed && !this.live && link === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.armed || this.live) {
      const k = 0.5 + Math.sin(now * 6) * 0.2;
      const g = ctx.createRadialGradient(u.x, u.y, u.r * 0.4, u.x, u.y, u.r * 1.6);
      g.addColorStop(0, `rgba(124,242,154,${0.7 * k})`);
      g.addColorStop(1, 'rgba(124,242,154,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GREEN;
      ctx.globalAlpha = k;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r * 1.15 + Math.sin(now * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!this.armed && link > 0) {
      // the chain in progress — fills clockwise until every ally is linked
      ctx.strokeStyle = GREEN;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r * 1.15, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * link) / this.need);
      ctx.stroke();
    }
    if (this.live) {
      // link sparks ride the boosted shot — three dots in orbit
      const a0 = REDUCED ? 0 : now * 5;
      ctx.fillStyle = GREEN;
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(u.x + Math.cos(a) * u.r * 1.45, u.y + Math.sin(a) * u.r * 1.45, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // HUD chip, arena top-left: LINK n/m while a shot is chaining, LINK ×1.25 up
  draw(ctx: CanvasRenderingContext2D, arena: { x: number; y: number }) {
    const link = this.need > 0 ? Math.min(this.touched.size, this.need) : 0;
    if (!this.armed && !this.live && link === 0) return;
    ctx.save();
    const c = { x: arena.x + 8, y: arena.y + 8, w: 128, h: 30 };
    uiWindow(ctx, c, { rad: 8 });
    ctx.textAlign = 'center';
    ctx.font = fontB(16);
    ctx.fillStyle = INK;
    ctx.fillText(this.armed || this.live ? `LINK ×${CONNECT_MUL}` : `LINK ${link}/${this.need}`, c.x + c.w / 2, c.y + 21);
    // one segment per needed ally — lit as the shot threads them
    const n = Math.max(this.need, 1);
    const lit = this.armed ? n : link;
    const seg = (c.w - 16 - (n - 1) * 4) / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < lit ? (this.live ? GREEN : GOLD_HI) : 'rgba(136,144,184,0.4)';
      ctx.fillRect(c.x + 8 + i * (seg + 4), c.y + c.h - 6, seg, 2);
    }
    ctx.restore();
  }
}
