import { dist, norm } from '../../core/vec';
import { sfx } from '../../core/audio';
import { TYPE_COLOR } from '../types';
import { aura, chargeMotes, impactRing, screenLines, TYPE_RAMP } from '../vfx';
import { spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

// telekinesis: the pack levitates on the wind-up, then a radial shockwave
// hurls them — whoever the fling pins to a wall eats the slam bonus
export function psychic(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.psychic;
  const spoon = ctx.perkIds.includes('twisted-spoon');
  const radius = 170;
  const lifted = near(radius); // snapshot — the lift set is the fling set
  ctx.act([
    {
      t: 0, // wind-up: motes converge on the ally, foes rise off the court
      run: () => {
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 80, n: 12, life: 0.32 });
        screenLines(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { n: 8, speed: 420, inward: true });
        for (const e of lifted) {
          e.vy -= 210; // the lift — they hang a beat before the throw
          e.sq = Math.max(e.sq, 0.5);
          aura(ctx.fx, ctx.fxRng, e.x, e.y + e.r * 0.5, ramp, { r: e.r, n: 4, life: 0.4 });
          // a psy-ring spins up under each levitating foe
          spawnAnim('ring', e.x, e.y + e.r, 0, -30, 1.8, 0.5, 0.8, 0, 0, 0, 16, false, 0, 0.34, false, true, true);
        }
      },
      sfx: ['beam', 0.55],
    },
    {
      t: 0.34, // contact: the ring front throws everything it sweeps
      run: () => {
        impactRing(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { radius: 72, width: 6, motes: 8 });
        screenLines(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { n: 14, speed: 680 });
        ctx.waves.push({
          x: p.x, y: p.y, r: 0, maxR: radius * 1.5 * p.rngMul, t: 0.4, life: 0.4,
          color, hits: new Set(),
          onHit: (e) => {
            const dir = norm({ x: e.x - p.x, y: e.y - p.y });
            e.vx += dir.x * 760;
            e.vy += dir.y * 760;
            ctx.hurt(e, bumpDmg(e, 1.2), '#9df0ff');
            // the slam lands where the fling ends — walls pay the bonus
            ctx.later(0.2, () => {
              if (e.dead) return;
              const a = ctx.arena;
              const m = spoon ? 62 : 42; // twisted spoon grabs wider
              const wall =
                e.x - e.r < a.x + m || e.x + e.r > a.x + a.w - m ||
                e.y - e.r < a.y + m || e.y + e.r > a.y + a.h - m;
              if (!wall) return;
              ctx.impact(e.x, e.y, color, 1.5);
              impactRing(ctx.fx, ctx.fxRng, e.x, e.y, ramp, { radius: 36, width: 4, motes: 5 });
              ctx.hitStop = Math.max(ctx.hitStop, 0.06);
              ctx.addShake(6);
              ctx.hurt(e, bumpDmg(e, spoon ? 1.1 : 0.8), '#9df0ff');
              sfx('bounce');
            });
          },
        });
      },
      stop: 0.12, shake: 9, punch: 0.12, flash: [color, 0.14], sfx: 'zap',
    },
    {
      t: 0.55, // recovery: twin psy-orbs hunt the stragglers out of reach
      run: () => {
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, 2)
          .forEach((e, i) => {
            ctx.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.9), t: 2.5, wob: i * 2.1 + 1, color });
            spawnAnim('ring', p.x, p.y, 0, 0, 1.4, 2.2, 0.7, 0, 0, 0, 18, false, 0, 0.3, false, true, true);
          });
      },
      sfx: 'ready',
    },
  ]);
}
