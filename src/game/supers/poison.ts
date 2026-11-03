import { sfx } from '../../core/audio';
import { TYPE_COLOR } from '../types';
import { chargeMotes, pixelExplosion, smokeColumn, TYPE_RAMP } from '../vfx';
import { spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const TAU = Math.PI * 2;

// toxic: a rolling gas cloud poisons what it sweeps — anyone already
// ticking detonates their venom in a small purple pop on the spot
export function poison(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, _near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.poison;
  const barb = ctx.perkIds.includes('poison-barb');
  // the rolling gas body — ramp-graded soot puffs swelling out with the ring
  const cloud = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ctx.fxRng() * 0.5;
      const sp = 90 + ctx.fxRng() * 140;
      ctx.fx.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24,
        t: 0.55 + ctx.fxRng() * 0.45, life: 1,
        size: 8 + ctx.fxRng() * 8,
        color: ctx.fxRng() < 0.65 ? ramp[1] : ramp[0],
        shape: 'smoke', spin: (ctx.fxRng() - 0.5) * 4, grav: -28, sway: 16,
      });
    }
  };
  ctx.act([
    {
      t: 0, // wind-up: fumes condense on the ally
      run: () => chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 60, n: 10, life: 0.28 }),
      sfx: 'sizzle',
    },
    {
      t: 0.16, // contact: the cloud rolls out and gasses everything it sweeps
      run: () => {
        cloud(p.x, p.y, 18);
        // bubbles riding the front — the element art inside the gas
        for (let i = 0; i < 6; i++) {
          const a = i * (TAU / 6);
          spawnAnim('poison', p.x, p.y, Math.cos(a) * 210, Math.sin(a) * 210 - 30,
            1.4, 2.2, 0.9, 0, a, 2, 14, true, i * 0.03, 0.5, false, false, true);
        }
        ctx.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 180 * p.rngMul, t: 0.45, life: 0.45,
          color, hits: new Set(),
          onHit: (e) => {
            // venom detonation: the already-poisoned pop the payload now
            if (e.dotTicks > 0) {
              pixelExplosion(ctx.fx, ctx.fxRng, e.x, e.y, ramp, { scale: 0.9 });
              ctx.impact(e.x, e.y, '#a040a0', 1.2);
              ctx.hitStop = Math.max(ctx.hitStop, 0.05);
              ctx.addShake(5);
              ctx.hurt(e, e.dotDmg * (barb ? 3 : 2), '#a040a0');
              sfx('sizzle');
            }
            e.dotTicks = Math.min(e.dotTicks + (barb ? 5 : 2), 6);
            e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
            ctx.hurt(e, bumpDmg(e, 1.0), '#9df0ff');
            // bubbles boil off the freshly-gassed
            for (let j = 0; j < 3; j++) {
              spawnAnim('poison', e.x + (j - 1) * 8, e.y - e.r * 0.5, (j - 1) * 26, -48 - j * 14,
                1.4, 2, 0.85, 0, 0, 0, 12, true, j * 0.05, 0.55, false, false, true);
            }
          },
        });
      },
      stop: 0.08, shake: 6, punch: 0.08, flash: ['#a040a0', 0.12], sfx: ['boom', 1.3],
    },
    {
      t: 0.55, // recovery: the cloud settles into a lingering haze
      run: () => {
        smokeColumn(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { n: 5, spread: 60 });
      },
    },
  ]);
}
