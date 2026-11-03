import { dist } from '../../core/vec';
import type { Sfx } from '../../core/audio';
import { TYPE_COLOR } from '../types';
import { TYPE_RAMP, aura, chargeMotes, impactRing, pickRamp, pillarSpout } from '../vfx';
import type { ActBeat } from '../vfx';
import { spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

// drain field: petal motes gather, roots burst under the pack one by one
// and root them in place — each drained foe bleeds a siphon stream back
// to the ally, and the team mends when the streams land. Spore orbs
// chase the far stragglers and drain them too.
export function grass(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, _nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.grass;
  const pack = near(140);
  const seed = ctx.perkIds.includes('miracle-seed');
  let dealt = 0;
  // a siphon stream — leech motes race the drained life back to the ally;
  // velocities solve against the step's damping so they land as t runs out
  const eta = (e: Unit) => Math.min(0.75, dist(e, p) / 520);
  const siphon = (e: Unit, life: number) => {
    const k = 3.2 / (1 - Math.exp(-3.2 * life));
    for (let i = 0; i < 4; i++) {
      const ox = (ctx.fxRng() - 0.5) * e.r, oy = (ctx.fxRng() - 0.5) * e.r;
      ctx.fx.push({
        x: e.x + ox, y: e.y + oy,
        vx: (p.x - e.x - ox) * k, vy: (p.y - e.y - oy) * k,
        t: life, life, size: 1.6 + ctx.fxRng() * 1.8,
        color: ctx.fxRng() < 0.3 ? '#ffffff' : pickRamp(ramp, ctx.fxRng),
        shape: 'sparkle', spin: (ctx.fxRng() - 0.5) * 8, grav: 0,
      });
    }
  };
  const beats: ActBeat[] = [
    // wind-up — petal motes gather on the ally
    {
      t: 0, sfx: 'gust', run: () => {
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 60, n: 12, life: 0.26 });
        aura(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 26, n: 8, life: 0.7 });
        ctx.flavor(p.x, p.y, 'grass');
      },
    },
    // contact — the drain field rolls out green under the pack
    {
      t: 0.26, stop: 0.08, shake: 8, punch: 0.1, flash: ['#78c850', 0.14], sfx: ['boom', 0.8], run: () => {
        ctx.waves.push({ x: p.x, y: p.y, r: 0, maxR: 210 * p.rngMul, t: 0.4, life: 0.4, color, hits: new Set() });
        impactRing(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { radius: 60, width: 5, motes: 7 });
      },
    },
    // roots burst under each foe in turn — dirt plume, rising seed, siphon home
    ...pack.map((e, i) => ({
      t: 0.26 + i * 0.07,
      shake: 4,
      sfx: ['boom', 1.05 - i * 0.05] as [Sfx, number],
      run: () => {
        if (e.dead) return;
        spawnAnim('dirt', e.x, e.y + e.r * 0.5, 0, -30, 2, 3.4, 1, 0, 0, 0, 20, false, 0, 0.3, false, false, true);
        spawnAnim('orb', e.x, e.y - 6, 0, -60, 1.5, 2.4, 1, 0, 0, 0, 16, true, 0, 0.4, false, true, true);
        pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y + e.r * 0.6, ramp, { h: 0.9, n: 8, spread: e.r });
        const dmg = bumpDmg(e, 1.1);
        dealt += dmg;
        ctx.hurt(e, dmg, '#9df0ff');
        e.timer += 0.6; // the roots hold the drained a beat
        siphon(e, eta(e));
      },
    })),
  ];
  // spore flares chase the far enemies and siphon them back to the team
  const spores = near(Infinity)
    .sort((a, b) => dist(p, b) - dist(p, a))
    .slice(0, seed ? 3 : 2);
  beats.push(
    {
      t: 0.42, sfx: ['heal', 1.15], run: () => {
        spores.forEach((e, i) => {
          ctx.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.8), t: 2.5, wob: i * 2.1, color, drain: true });
        });
      },
    },
  );
  // the mended beat — pooled heal lands when the last siphon arrives
  if (pack.length) {
    const healT = 0.26 + (pack.length - 1) * 0.07 + Math.max(...pack.map(eta));
    beats.push({
      t: healT, sfx: 'heal', run: () => {
        if (dealt > 0) ctx.tryHeal(ctx.players, () => Math.max(Math.round(dealt * (seed ? 0.7 : 0.35)), 4));
        aura(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 30, n: 12 });
      },
    });
  }
  // recovery — petals drift over the rooted pack
  beats.push({ t: 0.8, run: () => ctx.flavor(p.x, p.y, 'grass') });
  ctx.act(beats);
}
