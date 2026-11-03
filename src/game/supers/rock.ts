import { dist, norm } from '../../core/vec';
import { TYPE_COLOR } from '../types';
import { recipeFor, rain as animRain } from '../anim';
import { TYPE_RAMP, chargeMotes, pixelExplosion, slashArc } from '../vfx';
import type { ActBeat } from '../vfx';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const RAMP = TYPE_RAMP.rock;

// stone edge: a point-blank jab while motes mark the targets overhead,
// then the sky falls — meteors crater the farthest foes one by one
export function rock(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const e = nearest(p, 200);
  const targets = near(Infinity)
    .sort((a, b) => dist(p, b) - dist(p, a))
    .slice(0, ctx.perkIds.includes('hard-stone') ? 5 : 3);
  ctx.act([
    {
      // wind-up telegraph: the caster gathers, every marked foe glints
      t: 0, sfx: ['warn', 0.9],
      run: () => {
        p.sq = Math.max(p.sq, 0.9);
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 60, n: 8, life: 0.28 });
        for (const t of targets) chargeMotes(ctx.fx, ctx.fxRng, t.x, t.y, RAMP, { r: 42, n: 6, life: 0.48 });
      },
    },
    {
      // the jab — close-range opener while the sky loads
      t: 0.28, stop: 0.08, shake: 7, punch: 0.05, sfx: 'hit',
      run: () => {
        if (!e || e.dead) return;
        slashArc(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, { radius: 34 });
        ctx.impact(e.x, e.y, color, 1.3);
        ctx.hurt(e, bumpDmg(e, 0.8), '#9df0ff');
        const dir = norm({ x: e.x - p.x, y: e.y - p.y });
        e.vx += dir.x * 200;
        e.vy += dir.y * 200;
      },
    },
    // meteor rain — sheet rocks streak in ahead of each crater
    ...targets.flatMap((t, i): ActBeat[] => {
      const T = 0.5 + i * 0.18;
      return [
        {
          t: Math.max(0, T - 0.26),
          run: () => {
            animRain(recipeFor('rock', 'ROCK SLIDE'), t.x, t.y);
            for (let k = 0; k < 4; k++)
              ctx.fx.push({
                x: t.x + (ctx.fxRng() - 0.5) * 30, y: t.y - 100 - ctx.fxRng() * 30,
                vx: (ctx.fxRng() - 0.5) * 40, vy: 420 + ctx.fxRng() * 120,
                t: 0.4, life: 0.4, size: 2.5 + ctx.fxRng() * 2.5,
                color: ctx.fxRng() < 0.4 ? '#ffffff' : RAMP[1 + Math.floor(ctx.fxRng() * 3)],
                shape: 'shard', spin: (ctx.fxRng() - 0.5) * 16, grav: 500, seed: ctx.fxRng(),
              });
          },
        },
        {
          // the crater — scar, blast, and a heavy freeze on the first
          t: T, stop: i === 0 ? 0.16 : 0.1, shake: 12, punch: 0.07,
          flash: [color, 0.12], sfx: ['boom', 0.85 + i * 0.08],
          run: () => {
            ctx.scar(t.x, t.y, 22); // the meteor lands whether or not it kills
            pixelExplosion(ctx.fx, ctx.fxRng, t.x, t.y, RAMP, { scale: i === 0 ? 0.9 : 0.7 });
            if (!t.dead) ctx.hurt(t, bumpDmg(t, i === 0 ? 2.2 : 1.5), '#9df0ff');
          },
        },
      ];
    }),
  ]);
}
