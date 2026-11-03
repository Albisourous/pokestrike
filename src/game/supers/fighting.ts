import { dist, norm } from '../../core/vec';
import { TYPE_COLOR } from '../types';
import { recipeFor, burst as animBurst } from '../anim';
import { TYPE_RAMP, aura, chargeMotes, slashArc } from '../vfx';
import type { ActBeat } from '../vfx';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const RAMP = TYPE_RAMP.fighting;

// close combat: the ally dashes in and throws a jab string — rapid
// staggered cuts with rising pitch — ending on an uppercut that pops
// the foe off the deck and flinches its attack clock
export function fighting(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, _near: NearFn, nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const e = nearest(p, Infinity);
  if (!e) return;
  const jabs = ctx.perkIds.includes('black-belt') ? [0.45, 0.45, 0.45, 0.45] : [0.45, 0.45, 0.45];
  const eta = 0.16 + dist(p, e) / 1100; // wind-up, then the lunge lands
  const beats: ActBeat[] = [
    {
      // wind-up: glove-up crouch — motes and a low aura gather on the ally
      t: 0, sfx: ['warn', 1.2],
      run: () => {
        p.sq = Math.max(p.sq, 0.9);
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 56, n: 8, life: 0.18 });
        aura(ctx.fx, ctx.fxRng, p.x, p.y, RAMP, { r: 26, n: 6, life: 0.5 });
      },
    },
    { t: 0.16, run: () => ctx.dashes.push({ u: p, e, done: false, dmg: bumpDmg(e, 0.7) }) },
    // the string — each jab is a slash cut, a nudge, a quick freeze
    ...jabs.map((pow, i): ActBeat => ({
      t: eta + 0.06 + i * 0.09,
      stop: 0.035, shake: 4, sfx: ['hit', 1.1 + i * 0.15],
      run: () => {
        if (e.dead) return;
        slashArc(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, {
          angle: (i % 2 ? -1 : 1) * (0.4 + ctx.fxRng() * 0.6) + (i % 2 ? Math.PI : 0),
          radius: 30, width: 5,
        });
        ctx.impact(e.x, e.y, color, 1.1);
        ctx.hurt(e, bumpDmg(e, pow), '#9df0ff');
        const dir = norm({ x: e.x - p.x, y: e.y - p.y });
        e.vx += dir.x * 120;
        e.vy += dir.y * 120;
      },
    })),
    {
      // the uppercut — the launcher: pop skyward, clock scrambles
      t: eta + 0.06 + jabs.length * 0.09 + 0.05,
      stop: 0.18, shake: 11, punch: 0.09, flash: [color, 0.12], sfx: ['boom', 0.9],
      run: () => {
        if (e.dead) return;
        animBurst(recipeFor('fighting', 'MACH PUNCH'), e.x, e.y - e.r * 0.5, false);
        ctx.impact(e.x, e.y, color, 1.6);
        ctx.hurt(e, bumpDmg(e, 1.1), '#9df0ff');
        e.vy -= 480;
        e.timer += 1;
        e.sq = Math.max(e.sq, 0.8);
      },
    },
    {
      // recovery: heat shimmer off the struck foe
      t: eta + 0.06 + jabs.length * 0.09 + 0.4,
      run: () => {
        if (!e.dead) aura(ctx.fx, ctx.fxRng, e.x, e.y, RAMP, { r: 26, n: 6, life: 0.5 });
      },
    },
  ];
  ctx.act(beats);
}
