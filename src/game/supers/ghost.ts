import { dist, norm } from '../../core/vec';
import { sfx } from '../../core/audio';
import { TYPE_COLOR } from '../types';
import { pixelExplosion, smokeColumn, TYPE_RAMP } from '../vfx';
import { spawnAnim } from '../anim';
import type { Orb, Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

const TAU = Math.PI * 2;

// hex: wisps manifest around the caster and creep on their marks, then all
// dart at once — spectral hits puff smoke, and the hex detonates on the
// poisoned (the venom it finds is the feast)
export function ghost(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.ghost;
  const tag = ctx.perkIds.includes('spell-tag');
  const wisps: Orb[] = [];
  ctx.act([
    {
      t: 0, // wind-up: the dark pulls in, wisps blink on around the caster
      run: () => {
        // whole-court shadow ring — hex reaches everything, so the ring does too
        ctx.waves.push({ x: p.x, y: p.y, r: 0, maxR: 430, t: 0.5, life: 0.5, color, hits: new Set() });
        near(Infinity)
          .sort((a, b) => dist(p, a) - dist(p, b))
          .slice(0, tag ? 8 : 6)
          .forEach((e, i) => {
            const a = i * (TAU / 6) + 0.7;
            const o: Orb = {
              x: p.x + Math.cos(a) * 52, y: p.y + Math.sin(a) * 36,
              target: e, dmg: bumpDmg(e, 1.3), t: 3, wob: i * 2.6 + 1.3, color,
              spd: 130, // the creep — they drift before they pounce
            };
            wisps.push(o);
            ctx.orbs.push(o);
            // the wisp manifests: a shadow ball phasing in at the spawn
            spawnAnim('ghost', o.x, o.y, 0, 0, 0.8, 1.8, 0.85, 0.3, 0, 3, 10, false, i * 0.03, 0.5);
            smokeColumn(ctx.fx, ctx.fxRng, o.x, o.y, ramp, { n: 2, spread: 6 });
          });
      },
      flash: ['#705898', 0.18], sfx: ['invade', 1.2],
    },
    {
      t: 0.45, // the dart — every wisp snaps onto its mark at once
      run: () => {
        for (const o of wisps) {
          o.spd = 1050;
          const dir = norm({ x: o.target.x - o.x, y: o.target.y - o.y });
          const eta = Math.min(1, dist(o, o.target) / 1050 + 0.06);
          // a shadow ball flies the dart line with the wisp
          spawnAnim('ghost', o.x, o.y, dir.x * 1050, dir.y * 1050, 1.6, 2.4, 0.9, 0.15, 0, 8, 12, false, 0, Math.max(0.2, eta));
          // detonation check rides the orb's landing (retries while it flies)
          let tries = 0;
          const det = () => {
            if (o.t > 0) { if (++tries < 4) ctx.later(0.22, det); return; }
            const t2 = o.target;
            if (t2.dead) return;
            smokeColumn(ctx.fx, ctx.fxRng, t2.x, t2.y, ramp, { n: 3 }); // every hit is spectral
            if (t2.dotTicks <= 0) return; // the hex feasts on the poisoned
            pixelExplosion(ctx.fx, ctx.fxRng, t2.x, t2.y, ramp, { scale: 1.1 });
            ctx.impact(t2.x, t2.y, color, 1.3);
            ctx.hitStop = Math.max(ctx.hitStop, 0.07);
            ctx.addShake(6);
            ctx.hurt(t2, bumpDmg(t2, tag ? 0.95 : 0.65), '#a890d8');
            sfx('boom');
          };
          ctx.later(eta, det);
        }
      },
      sfx: 'gust',
    },
  ]);
}
