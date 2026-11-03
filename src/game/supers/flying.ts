import { norm } from '../../core/vec';
import { TYPE_COLOR } from '../types';
import { recipeFor, ring as animRing } from '../anim';
import { TYPE_RAMP, aura, pillarSpout, screenLines } from '../vfx';
import { settings } from '../meta';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const RAMP = TYPE_RAMP.flying;

// hurricane vortex: a wind wall rolls out of the ally — every foe it
// crosses gets dragged into the eye; then the vortex pops the pile
// skyward, scrambles their clocks, and scatters the edges
export function flying(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const still = settings().shake === 0; // reduced motion: no streak swirl
  const radius = 210 * (ctx.perkIds.includes('sharp-beak') ? 1.4 : 1);
  const dragged = near(radius);
  ctx.act([
    {
      // the intake — wind streaks spiral inward, the gust sheet rings out
      t: 0, shake: 4, sfx: 'gust',
      run: () => {
        p.sq = Math.max(p.sq, 0.8);
        if (!still) screenLines(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { n: 14, speed: 700, inward: true });
        aura(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 30, n: 10, life: 0.6 });
        animRing(recipeFor('flying', 'HURRICANE'), p.x, p.y, radius * 0.55);
      },
    },
    {
      // the wind wall rolls out — crossed foes get hauled into the pile
      t: 0.14, shake: 5, flash: [color, 0.1],
      run: () => {
        ctx.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 240 * (ctx.perkIds.includes('sharp-beak') ? 1.4 : 1) * p.rngMul, t: 0.45, life: 0.45, color, hits: new Set(),
          onHit: (e) => {
            const dir = norm({ x: p.x - e.x, y: p.y - e.y });
            e.vx += dir.x * 640;
            e.vy += dir.y * 640;
            ctx.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
          },
        });
      },
    },
    {
      // the vortex pops — pile goes skyward, attack clocks scramble,
      // the edge of the heap fans back out
      t: 0.6, stop: 0.1, shake: 7, punch: 0.06, sfx: 'gust',
      run: () => {
        let n = 0;
        for (const e of dragged) {
          if (e.dead) continue;
          const out = norm({ x: e.x - p.x, y: e.y - p.y });
          e.vy -= 420;
          e.vx += out.x * 130;
          e.timer += 0.5;
          n++;
        }
        if (n) {
          pillarSpout(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { h: 1.4, n: 14, spread: 40 });
          if (!still) screenLines(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { n: 10, speed: 560 });
        }
      },
    },
    {
      // recovery — the gale settles into a slow swirl
      t: 0.85,
      run: () => aura(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 46, n: 8, life: 0.5 }),
    },
  ]);
}
