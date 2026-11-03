import { dist, norm } from '../../core/vec';
import { TYPE_COLOR } from '../types';
import { TYPE_RAMP, chargeMotes, impactRing, smokeColumn } from '../vfx';
import { recipeFor, ring as animRing, spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

// flame ring: embers gather on the ally, a fire ring rolls out scorching
// the floor under everyone it crosses — and fireball orbs hunt the
// farthest in the same cast. Under sun (or Charcoal) the ring ignites.
export function fire(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.fire;
  // fireball volley: homing orbs peel off for the farthest — they fly
  // alongside the ring; where one lands, it chars
  const volley = near(Infinity)
    .sort((a, b) => dist(p, b) - dist(p, a))
    .slice(0, ctx.perkIds.includes('charcoal') ? 4 : 3);
  volley.forEach((e, i) => {
    ctx.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.9), t: 2.5, wob: i * 2.1, color });
    ctx.later(0.15 + dist(p, e) / 620, () => ctx.scar(e.x, e.y, 14));
  });
  // the ring rolls on cast; enemies catch fire as the front passes over
  // them — the beats below dress its ignition and wake
  ctx.waves.push({
    x: p.x, y: p.y, r: 0, maxR: 255 * p.rngMul, t: 0.45, life: 0.45,
    color, hits: new Set(),
    onHit: (e) => {
      const dir = norm({ x: e.x - p.x, y: e.y - p.y });
      e.vx += dir.x * 170;
      e.vy += dir.y * 170;
      ctx.scar(e.x, e.y, 18); // the front scorches the floor it crossed
      // under sun (or Charcoal) the ring ignites — same cap as toxic
      if (ctx.weather === 'sun' || ctx.perkIds.includes('charcoal')) {
        e.dotTicks = Math.min(e.dotTicks + 1, 6);
        e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
      }
      ctx.hurt(e, bumpDmg(e, 1.6), '#9df0ff');
    },
  });
  ctx.act([
    // wind-up — embers climb in and gather on the ally
    {
      t: 0, sfx: 'sizzle', run: () => {
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 64, n: 12, life: 0.3 });
        for (let i = 0; i < 3 + volley.length; i++) {
          spawnAnim('ember', p.x + (ctx.fxRng() - 0.5) * 44, p.y + 8 + i * 6,
            (ctx.fxRng() - 0.5) * 30, -70 - i * 26, 1.6, 2.4, 0.9, 0,
            0, 0, 18, true, i * 0.05, 0.4, false, true, true);
        }
      },
    },
    // ignition — ember petals ride the rolling front
    {
      t: 0.3, stop: 0.1, shake: 10, punch: 0.12, flash: ['#f08030', 0.16], sfx: 'boom', run: () => {
        animRing(recipeFor('fire'), p.x, p.y, 190);
        impactRing(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { radius: 70, width: 6, motes: 8 });
      },
    },
    // recovery — soot curls off the ring's wake
    { t: 0.7, run: () => smokeColumn(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { n: 4, spread: 30 }) },
  ]);
}
