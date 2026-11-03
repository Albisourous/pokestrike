import { dist } from '../../core/vec';
import type { Vec } from '../../core/vec';
import type { Sfx } from '../../core/audio';
import { TYPE_RAMP, chargeMotes, impactRing } from '../vfx';
import type { ActBeat } from '../vfx';
import { recipeFor, beam as animBeam, spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

// chain lightning: charge crackles onto the ally, then bolt segments hop
// foe to foe — each hop a flash + freeze beat, pitched a step higher.
// A hot shot arcs wider AND bites harder: links and lead power ride combo.
export function electric(ctx: SuperCtx, _src: Unit, p: Unit, bumpDmg: BumpDmg, _near: NearFn, _nearest: NearestFn): void {
  const ramp = TYPE_RAMP.electric;
  let from: Unit = p;
  const chain: { a: Vec; e: Unit; mult: number }[] = [];
  const hit = new Set<number>();
  // the chain grows — and bites — with the combo it's riding
  let mult = 1.3 + Math.min(0.3, ctx.shotCombo * 0.05);
  const links = Math.min(3 + Math.floor(ctx.shotCombo / 3) + (ctx.perkIds.includes('magnet') ? 2 : 0), 6);
  for (let i = 0; i < links; i++) {
    const next = ctx.enemies
      .filter((e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 340 * p.rngMul)
      .sort((a, b) => dist(from, a) - dist(from, b))[0];
    if (!next) break;
    hit.add(next.uid);
    chain.push({ a: { x: from.x, y: from.y }, e: next, mult });
    mult *= 0.7;
    from = next;
  }
  const zap = recipeFor('electric');
  const beats: ActBeat[] = [
    // wind-up — the charge crackles into the ally's throw
    {
      t: 0, sfx: ['zap', 0.8], run: () => {
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 48, n: 10, life: 0.14 });
        spawnAnim('shock', p.x, p.y, 0, 0, 1.5, 2.5, 1, 0, 0, 0, 24, true, 0, 0.16, false, true);
      },
    },
  ];
  // each hop lands a beat apart — bolt segments jump link to link
  chain.forEach((c, i) => {
    beats.push({
      t: 0.14 + i * 0.13,
      stop: 0.05,
      shake: 4 + i * 1.5,
      flash: ['#f8d030', 0.05],
      sfx: ['zap', 0.95 + i * 0.09] as [Sfx, number],
      run: () => {
        if (c.e.dead) return;
        animBeam(zap, c.a.x, c.a.y, c.e.x, c.e.y);
        ctx.beams.push({ x1: c.a.x, y1: c.a.y, x2: c.e.x, y2: c.e.y, t: 0.26, life: 0.26 });
        ctx.impact(c.e.x, c.e.y, '#f8d030', 1.4);
        ctx.hurt(c.e, bumpDmg(c.e, c.mult), '#9df0ff');
      },
    });
  });
  // recovery — the last link discharges in a halo
  if (chain.length) {
    const last = chain[chain.length - 1];
    beats.push({
      t: 0.14 + chain.length * 0.13,
      shake: 6,
      flash: ['#fffde8', 0.08],
      sfx: ['zap', 1.3],
      run: () => impactRing(ctx.fx, ctx.fxRng, last.e.x, last.e.y, ramp, { radius: 44, motes: 6 }),
    });
  }
  ctx.act(beats);
}
