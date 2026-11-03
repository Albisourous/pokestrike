import { norm } from '../../core/vec';
import type { Sfx } from '../../core/audio';
import { TYPE_COLOR } from '../types';
import { TYPE_RAMP, chargeMotes, screenLines, smokeColumn } from '../vfx';
import type { ActBeat } from '../vfx';
import { recipeFor, beam as animBeam, rain as animRain, spawnAnim } from '../anim';
import type { Unit } from '../battle';
import type { SuperCtx, BumpDmg, NearFn, NearestFn } from './ctx';

// HYDRO PUMP — a firehose jet, not three polite orbs: pressure gathers on
// the ally, the lane locks, then a fat pressurized beam spears the whole
// court and hoses each foe downstream as the front reaches them.
export function water(ctx: SuperCtx, src: Unit, p: Unit, bumpDmg: BumpDmg, near: NearFn, nearest: NearestFn): void {
  const color = TYPE_COLOR[src.def.type];
  const ramp = TYPE_RAMP.water;
  const e = nearest(p, Infinity);
  if (!e) return;
  const dir = norm({ x: e.x - p.x, y: e.y - p.y });
  const end = { x: p.x + dir.x * 900, y: p.y + dir.y * 900 }; // pierce — the jet runs the whole court
  const lane = ctx.weather === 'rain' ? 48 : 24; // rain swells the lane
  const chill = ctx.perkIds.includes('mystic-water');
  // the corridor roster locks at cast — hits land staggered down the ray
  const hits = near(Infinity)
    .map((t) => {
      const dx = t.x - p.x, dy = t.y - p.y;
      return { t, along: dx * dir.x + dy * dir.y, off: Math.abs(dx * dir.y - dy * dir.x) };
    })
    .filter((h) => h.along >= 0 && h.off <= h.t.r + lane)
    .sort((a, b) => a.along - b.along);
  const jet = recipeFor('water', 'HYDRO PUMP');
  const beats: ActBeat[] = [
    // wind-up — mist converges, the lane tell glows
    {
      t: 0, sfx: 'warn', run: () => {
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { r: 56, n: 10, life: 0.24 });
        screenLines(ctx.fx, ctx.fxRng, p.x, p.y, ramp, { n: 8, speed: 300, inward: true });
        ctx.beams.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y, t: 0.22, life: 0.22, color: '#a8d0ff', w: 0.4 });
      },
    },
    // contact — the jet fires: fat beam + foam core + splash sheets down the ray
    {
      t: 0.22, stop: 0.09, shake: 12, punch: 0.12, flash: ['#bfe8ff', 0.16], sfx: 'beam', run: () => {
        ctx.beams.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y, t: 0.42, life: 0.42, color, w: 10 });
        ctx.beams.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y, t: 0.3, life: 0.3, color: '#dff4ff', w: 4 });
        animBeam(jet, p.x, p.y, end.x, end.y);
        ctx.burst(p.x + dir.x * p.r, p.y + dir.y * p.r, '#dff4ff', 14, 380); // spray at the nozzle
      },
    },
    // the front races downstream — each body eats it as the jet arrives
    ...hits.map((h, i) => ({
      t: 0.22 + Math.min(0.55, h.along / 1500),
      stop: 0.04,
      shake: 4,
      sfx: ['splash', 0.9 + i * 0.06] as [Sfx, number],
      run: () => {
        if (h.t.dead) return;
        h.t.vx += dir.x * 640;
        h.t.vy += dir.y * 640;
        ctx.hurt(h.t, bumpDmg(h.t, 1.9), '#9df0ff');
        if (chill) h.t.timer += 0.4; // the jet chills their clocks
        ctx.impact(h.t.x, h.t.y, color, 1.7);
        spawnAnim('water', h.t.x, h.t.y, 0, 0, 2, 3.4, 1, 0, 0, 0, 20, false, 0, 0.32, false, true, true);
      },
    })),
    // recovery — rain lingers over the last body, mist off the hosed lane
    {
      t: 0.85, sfx: 'splash', run: () => {
        const last = hits[hits.length - 1]?.t ?? e;
        animRain(jet, last.x, last.y);
        smokeColumn(ctx.fx, ctx.fxRng, p.x + dir.x * 120, p.y + dir.y * 120, ramp, { n: 4, spread: 20 });
        smokeColumn(ctx.fx, ctx.fxRng, p.x + dir.x * 260, p.y + dir.y * 260, ramp, { n: 3, spread: 20 });
      },
    },
  ];
  ctx.act(beats);
}
