// MS "ALL CONNECT": one shot that passes through every living teammate
// fires a friendship banner and powers up the next shot. No rng.
import { buzz } from '../core/audio';
import type { Telops } from './telop';
import { GOLD_HI, INK, fontB, uiWindow } from './ui';

export const CONNECT_MUL = 1.25; // next shot's damage after an ALL CONNECT
export const CONNECT_MIN = 2; // living teammates needed besides the shooter
const GREEN = '#7cf29a';

interface Mon { dead: boolean; def: { id: number }; x: number; y: number; r: number }

export class Connect {
  armed = false; // banked for the next launch
  live = false; // the shot in flight carries the bonus
  best = 0; // most teammates linked in one shot this stop
  alls = 0; // ALL CONNECTs this stop
  private touched = new Set<Mon>();
  private fired = false;

  reset() {
    this.armed = this.live = this.fired = false;
    this.best = this.alls = 0;
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
    this.touched.add(p);
    this.best = Math.max(this.best, this.touched.size);
    const others = team.filter((m) => !m.dead && m !== shooter);
    if (this.fired || others.length < CONNECT_MIN || !others.every((m) => this.touched.has(m))) return false;
    this.fired = this.armed = true;
    this.alls++;
    telop?.push({ kind: 'connect', title: 'ALL CONNECT', mons: team.filter((m) => !m.dead).map((m) => m.def.id) });
    buzz([20, 30, 20, 30, 40]);
    return true;
  }

  // next shooter's glow while the bonus waits or rides
  glow(ctx: CanvasRenderingContext2D, u: Mon, now: number) {
    if (!this.armed && !this.live) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
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
    ctx.restore();
  }
  // HUD chip, arena top-left, only while the bonus is up
  draw(ctx: CanvasRenderingContext2D, arena: { x: number; y: number }) {
    if (!this.armed && !this.live) return;
    ctx.save();
    const c = { x: arena.x + 8, y: arena.y + 8, w: 128, h: 30 };
    uiWindow(ctx, c, { rad: 8 });
    ctx.textAlign = 'center';
    ctx.font = fontB(16);
    ctx.fillStyle = INK;
    ctx.fillText(`LINK ×${CONNECT_MUL}`, c.x + c.w / 2, c.y + 21);
    ctx.fillStyle = this.live ? GREEN : GOLD_HI;
    ctx.fillRect(c.x + 8, c.y + c.h - 6, c.w - 16, 2);
    ctx.restore();
  }
}
