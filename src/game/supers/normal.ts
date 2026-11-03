import { dist, norm } from '../../core/vec';
import { settings } from '../meta';
import { TYPE_RAMP, chargeMotes, impactRing, screenLines, smokeColumn } from '../vfx';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const RAMP = TYPE_RAMP.normal;

// extremespeed: crouch, blink, slam — the ally dashes the nearest foe
// (anywhere on the court), then chains into the next. Afterimage pips
// mark the flight and every landing freezes longer than the last.
export function normal(ctx: SuperCtx, _src: Unit, p: Unit, bumpDmg: BumpDmg, _near: NearFn, nearest: NearestFn): void {
  const e1 = nearest(p, Infinity);
  if (!e1) return;
  const still = settings().shake === 0; // reduced motion: no streak trails
  const scarf = ctx.perkIds.includes('silk-scarf');
  const hit: Unit[] = [];

  // one link of the chain: push the dash, strew afterimages along the
  // flight, then the landing frame — speed-line blast, ring, knockback
  const slam = (e: Unit, pow: number, link: number) => {
    hit.push(e);
    ctx.dashes.push({ u: p, e, done: false, dmg: bumpDmg(e, pow) });
    const eta = dist(p, e) / 1100; // dashes run at 1100 u/s
    if (!still) {
      const n = Math.min(9, Math.floor(eta / 0.045));
      for (let i = 1; i <= n; i++)
        ctx.later((eta * i) / (n + 1), () => {
          ctx.fx.push(
            { x: p.x, y: p.y, vx: 0, vy: 0, t: 0.18, life: 0.18, size: 6, color: '#ffffff', shape: 'dot', spin: 0, grav: 0 },
            { x: p.x, y: p.y, vx: 0, vy: 0, t: 0.14, life: 0.14, size: 2.2, color: RAMP[2], shape: 'streak', spin: 0, grav: 0 },
          );
        });
    }
    ctx.later(eta + 0.02, () => {
      screenLines(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, { n: 8 + link * 2, speed: 620 });
      impactRing(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, { radius: 40 + link * 10 });
      const dir = norm({ x: e.x - p.x, y: e.y - p.y });
      e.vx += dir.x * 360;
      e.vy += dir.y * 360;
      ctx.hitStop = Math.max(ctx.hitStop, 0.1 + link * 0.08);
      ctx.addShake(6 + link * 4);
      ctx.addPunch(0.05 + link * 0.03);
      ctx.screenFlash(RAMP[3], 0.08);
    });
  };

  // the next link picks the nearest live foe the chain hasn't hit yet
  const chain = (pow: number, link: number, then?: () => void) => {
    const e = ctx.enemies
      .filter((t) => !t.dead && !hit.includes(t))
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (!e) return;
    slam(e, pow, link);
    if (then) ctx.later(dist(p, e) / 1100 + 0.05, then);
  };

  ctx.act([
    {
      // wind-up: the crouch — motes and speed lines pour into the ally
      t: 0, sfx: ['gust', 1.3],
      run: () => {
        p.sq = Math.max(p.sq, 0.9);
        p.flashT = 0.14;
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 64, n: 10, life: 0.22 });
        if (!still) screenLines(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { n: 12, inward: true });
      },
    },
    { t: 0.2, run: () => slam(e1, 1.3, 0) },
    {
      // recovery: settle dust where the chain ended
      t: 1.1,
      run: () => {
        const e = hit[hit.length - 1];
        if (e) smokeColumn(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, { n: 3 });
      },
    },
  ]);

  // hop 2 waits for hop 1's landing, then re-picks; silk scarf links a 3rd
  ctx.later(0.2 + dist(p, e1) / 1100 + 0.05, () =>
    chain(1.7, 1, scarf ? () => chain(1.7, 2) : undefined));
}
