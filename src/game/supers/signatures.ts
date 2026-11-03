/* The money-shot table: iconic signature nukes keyed by move name, so
 * METRONOME can re-enter with a rolled pick instead of the caster's own.
 * Extracted verbatim from battle.ts's castSignature — `k` carries the
 * per-cast kit the cases used to close over, so bodies read `ctx.` and
 * otherwise match line for line.
 *
 * The uniqueness pass: each named ult authors its own act — a wind-up
 * tell, a contact beat (stop/flash/shake via the act layer, so reduced
 * motion lands it settled), and an aftermath texture, instead of every
 * nuke collapsing into "one beam / one wave / orbs".
 */
import { norm, dist } from '../../core/vec';
import { sfx, buzz } from '../../core/audio';
import { recipeFor, beam as animBeam, burst as animBurst } from '../anim';
import { bumpIsPhysical } from '../stats';
import type { Unit } from '../battle';
import {
  FX_MAX, TYPE_RAMP,
  aura, chargeMotes, impactRing, pillarSpout, pixelExplosion,
  screenLines, slashArc, smokeColumn,
} from '../vfx';
import type { ActBeat, Fx } from '../vfx';
import { nearest, farthest, flies } from './util';
import type { SuperCtx, BumpDmg } from './ctx';

// a piercing beam from the caster THROUGH the anchor enemy to the far
// wall — every enemy within `halfW` of the ray eats it
export type LineBlast = (to: Unit, color: string, halfW: number, power: number, w: number, onHit?: (e: Unit) => void) => void;

// the per-cast kit signature cases close over: foes is the living-enemy
// snapshot at cast time, far/fattest the two staple picks, lineBlast the
// shared ray-and-corridor helper
export interface SigArgs {
  ctx: SuperCtx;
  src: Unit; // the move owner (copy replays it)
  p: Unit; // the bumped ally the blast emanates from
  bumpDmg: BumpDmg; // already anim-wrapped by castNamedSuper
  foes: Unit[];
  far: Unit;
  fattest: Unit;
  lineBlast: LineBlast;
}

// hand-pushed particles respect the shared pool cap — oldest yield first
const pushFx = (ctx: SuperCtx, f: Fx) => {
  if (ctx.fx.length >= FX_MAX) ctx.fx.splice(0, ctx.fx.length - FX_MAX + 1);
  ctx.fx.push(f);
};

// is `e` inside a cone from p along d that widens `spread` px per unit?
// The FLAMETHROWER lane — a widening fan instead of the beams' corridor
const inCone = (p: Unit, d: { x: number; y: number }, e: Unit, spread: number, pad = 0) => {
  const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
  if (t < 0) return false;
  const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
  return Math.hypot(dx, dy) < t * spread + e.r + pad;
};

const SIGNATURES: Record<string, (k: SigArgs) => boolean> = {
  'HYPER BEAM': ({ ctx, p, far, lineBlast }) => { // the golden wall of light — a
    // long charge gathers on the caster, the fattest beam fires, and the
    // lane it drew keeps smoking
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1; // braced — the charge lifts it off the floor
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#a88010', '#ffd84d', '#fff0b0'], { r: 100, n: 16, life: 0.5 });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#ffd84d', { n: 14, inward: true });
        }, sfx: 'warn',
      },
      { t: 0.5, run: () => lineBlast(far, '#ffd84d', 38, 2.6, 2.8) },
      {
        t: 0.78, run: () => { // scorched lane — craters and soot down the ray
          for (let t = 90; t < 640; t += 110) {
            ctx.scar(p.x + d.x * t, p.y + d.y * t, 14);
            smokeColumn(ctx.fx, ctx.fxRng, p.x + d.x * t, p.y + d.y * t, TYPE_RAMP.fire, { n: 3 });
          }
        }, sfx: 'sizzle',
      },
    ]);
    return true;
  },
  'SOLAR BEAM': ({ ctx, p, far, lineBlast }) => { // drinks the light a breath
    // longer — a thin green lance, petals drifting off the lane it drew
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#b8f088', '#fff8c0', '#ffffff'], { r: 120, n: 18, life: 0.55 });
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.grass, { r: 30, n: 8 });
        }, sfx: 'warn',
      },
      { t: 0.55, run: () => lineBlast(far, '#78c850', 30, 2.3, 1.6) },
      {
        t: 0.82, run: () => { // the bloom — petals kick up along the lane
          const d = norm({ x: far.x - p.x, y: far.y - p.y });
          for (let t = 80; t < 560; t += 90) for (let i = 0; i < 3; i++) {
            pushFx(ctx, {
              x: p.x + d.x * t + (ctx.fxRng() - 0.5) * 30, y: p.y + d.y * t + (ctx.fxRng() - 0.5) * 30,
              vx: (ctx.fxRng() - 0.5) * 60, vy: -30 - ctx.fxRng() * 50,
              t: 0.6 + ctx.fxRng() * 0.4, life: 1, size: 2 + ctx.fxRng() * 2,
              color: ctx.fxRng() < 0.5 ? '#b8f088' : '#fff8c0', shape: 'leaf',
              spin: (ctx.fxRng() - 0.5) * 10, grav: 60, sway: 40,
            });
          }
        },
      },
    ]);
    return true;
  },
  'HYDRO CANNON': ({ ctx, p, far, lineBlast }) => { // a compressed sphere, then
    // the jet — the flood line shoves everything it spears down-beam
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.water, { r: 70, n: 12, life: 0.35 });
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.water, { r: 18, n: 8 });
        }, sfx: 'warn',
      },
      {
        t: 0.38, run: () => lineBlast(far, '#6890f0', 30, 2.3, 2.4, (e) => {
          if (!e.dead) { e.vx += d.x * 340; e.vy += d.y * 340; } // the flood carries them
        }),
      },
      {
        t: 0.62, run: () => { // the flood — spray and foam down the lane
          for (let t = 70; t < 600; t += 75)
            ctx.burst(p.x + d.x * t, p.y + d.y * t, '#a8d0ff', 4, 200, 0.8, TYPE_RAMP.water);
        }, sfx: 'splash',
      },
    ]);
    return true;
  },
  'ZAP CANNON': ({ ctx, p, bumpDmg, far }) => { // a crackle wind-up, then one
    // fat thunderball tracks the far foe — canon never misses its paralyze,
    // so the shock lands as the ball does
    chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.electric, { r: 64, n: 12, life: 0.4 });
    screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#f8d030', { n: 8, inward: true });
    sfx('warn');
    ctx.later(0.4, () => {
      ctx.orbs.push({ x: p.x, y: p.y, target: far, dmg: bumpDmg(far, 2.6), t: 3.5, wob: 0, color: '#f8d030', spd: 540 });
      ctx.screenFlash('#f8d030', 0.16);
      ctx.addShake(8);
      sfx('zap');
    });
    ctx.later(0.4 + dist(p, far) / 540 + 0.15, () => {
      if (far.dead) return;
      far.timer += 1.2; // locked stiff — the discharge set in
      ctx.pushText({ x: far.x, y: far.y - far.r - 34, text: 'PARALYZED!', t: 0.9, color: '#f8e88a', big: false });
    });
    return true;
  },
  'PSYCHO BOOST': ({ ctx, p, bumpDmg, fattest }) => { // Mewtwo's nuke — a
    // psychic charge gathers on the caster, folds space onto the biggest
    // target, then detonates
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.psychic, { r: 100, n: 14, life: 0.45 });
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.psychic, { r: 26, n: 10 });
        }, sfx: 'warn',
      },
      {
        t: 0.45, run: () => { // space folds onto the mark
          screenLines(ctx.fx, ctx.fxRng, fattest.x, fattest.y, '#f85888', { n: 14, speed: 700, inward: true });
          chargeMotes(ctx.fx, ctx.fxRng, fattest.x, fattest.y, TYPE_RAMP.psychic, { r: 80, n: 10, life: 0.18 });
        }, sfx: 'beam',
      },
      {
        t: 0.62, run: () => {
          pixelExplosion(ctx.fx, ctx.fxRng, fattest.x, fattest.y, TYPE_RAMP.psychic, { scale: 1.6 });
          ctx.waves.push({
            x: fattest.x, y: fattest.y, r: 0, maxR: 285, t: 0.55, life: 0.55,
            color: '#f85888', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, e === fattest ? 2.6 : 1.3), '#f8b8d0'),
          });
          ctx.scar(fattest.x, fattest.y, 45);
        }, stop: 0.34, shake: 15, punch: 0.18, flash: ['#f85888', 0.25], sfx: 'boom',
      },
    ]);
    return true;
  },
  'ERUPTION': ({ ctx, bumpDmg, foes }) => { // the court vents smoke first —
    // then fire pillars burst under the pack one by one
    const marks = foes.slice(0, 6);
    const beats: ActBeat[] = [{
      t: 0, run: () => {
        for (const e of marks) smokeColumn(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.fire, { n: 3, spread: 26 });
      }, shake: 5, sfx: 'warn',
    }];
    marks.forEach((e, i) => beats.push({
      t: 0.35 + i * 0.12,
      run: () => {
        if (e.dead) return;
        pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.fire, { h: 1.5, n: 14, spread: 30 });
        ctx.burst(e.x, e.y, '#f08030', 14, 560, 1.6);
        ctx.scar(e.x, e.y, 24);
        ctx.hurt(e, bumpDmg(e, 1.2), '#ffb088');
      },
      shake: 9, flash: i === 0 ? ['#f08030', 0.2] : undefined, sfx: 'boom',
    }));
    ctx.act(beats);
    return true;
  },
  'EXPLOSION': ({ ctx, p, bumpDmg, foes }) => { // the tick-tick-tick prime,
    // then everything goes — caster pays 15% recoil and the crater smokes
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1; p.flashT = 0.5; // it starts glowing — get away from it
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#ffd84d', '#ffffff'], { r: 60, n: 10, life: 0.4 });
        }, sfx: 'warn',
      },
      {
        t: 0.42, run: () => {
          pixelExplosion(ctx.fx, ctx.fxRng, p.x, p.y, ['#f08030', '#ffd84d', '#fff8d0'], { scale: 2.2 });
          for (const e of foes) ctx.hurt(e, bumpDmg(e, 1.5), '#ffffff');
          p.hp = Math.max(1, p.hp - Math.round(p.maxHp * 0.15));
          ctx.waves.push({ x: p.x, y: p.y, r: 0, maxR: 560, t: 0.6, life: 0.6, color: '#ffd84d', hits: new Set() });
          ctx.scar(p.x, p.y, 58);
          buzz([60, 40, 80]);
        }, stop: 0.4, shake: 20, punch: 0.24, flash: ['#ffffff', 0.35], sfx: 'boom',
      },
      { t: 0.8, run: () => smokeColumn(ctx.fx, ctx.fxRng, p.x, p.y, '#585848', { n: 6, spread: 30 }) },
    ]);
    return true;
  },
  'BLAST BURN': ({ ctx, p, bumpDmg }) => { // the caster ignites, then a rolling
    // fire wave scorches every tile it sweeps and the rim keeps smoldering
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1; p.flashT = 0.4;
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 70, n: 12, life: 0.4 });
        }, sfx: 'warn',
      },
      {
        t: 0.4, run: () => {
          ctx.waves.push({
            x: p.x, y: p.y, r: 0, maxR: 390, t: 0.55, life: 0.55,
            color: '#f08030', hits: new Set(),
            onHit: (e) => {
              pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.fire, { h: 1.1, n: 8 });
              ctx.scar(e.x, e.y, 20);
              ctx.hurt(e, bumpDmg(e, 1.9), '#ffb088');
            },
          });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#f08030', { n: 14 });
        }, stop: 0.28, shake: 14, punch: 0.1, flash: ['#f08030', 0.22], sfx: 'boom',
      },
      {
        t: 0.95, run: () => { // smolder — the swept rim keeps venting soot
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            smokeColumn(ctx.fx, ctx.fxRng, p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200, TYPE_RAMP.fire, { n: 2 });
          }
        },
      },
    ]);
    return true;
  },
  'FRENZY PLANT': ({ ctx, p, bumpDmg, foes }) => { // vines spear up under the
    // four far foes first — then the drain orbs ride them in
    foes.slice().sort((a, b) => dist(p, b) - dist(p, a)).slice(0, 4).forEach((e, i) => {
      ctx.later(i * 0.1, () => {
        if (e.dead) return;
        pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.grass, { h: 1.4, n: 12, spread: 34 });
        sfx('gust');
      });
      ctx.later(0.3 + i * 0.08, () => {
        if (e.dead) return;
        ctx.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 1.0), t: 3, wob: i * 1.7, color: '#78c850', drain: true });
      });
    });
    return true;
  },
  'OUTRAGE': ({ ctx, p, bumpDmg, foes }) => { // the rampage — a rage aura, then
    // three smashes on the nearest that crescendo into the launch
    const t = nearest(foes, p);
    const hits: ActBeat[] = [0, 1, 2].map((i) => ({
      t: 0.3 + i * 0.17,
      run: () => {
        if (t.dead) return;
        slashArc(ctx.fx, ctx.fxRng, t.x, t.y, ['#7038f8', '#b090ff', '#e8d8ff'], { angle: i * 2.1 + 0.6, radius: 44 + i * 10, arc: 2.6 });
        ctx.impact(t.x, t.y, '#7038f8', 1.4 + i * 0.3);
        ctx.hurt(t, bumpDmg(t, i === 2 ? 1.5 : 0.95), '#c8a8ff');
        const d = norm({ x: t.x - p.x, y: t.y - p.y });
        t.vx += d.x * (240 + i * 90); t.vy += d.y * (240 + i * 90);
      },
      stop: i === 2 ? 0.22 : 0.08, shake: 9 + i * 3, sfx: 'hit',
    }));
    ctx.act([
      { t: 0, run: () => { p.sq = 1; aura(ctx.fx, ctx.fxRng, p.x, p.y, ['#7038f8', '#b090ff', '#e8d8ff'], { r: 30, n: 10 }); }, sfx: 'warn' },
      ...hits,
    ]);
    return true;
  },
  'SHEER COLD': ({ ctx, p, bumpDmg, foes }) => { // absolute zero — frost
    // converges on the nearest foe, then the air itself shatters outward
    const t = nearest(foes, p);
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, t.x, t.y, ['#98d8d8', '#d8f0f8', '#ffffff'], { r: 90, n: 14, life: 0.5 });
          impactRing(ctx.fx, ctx.fxRng, t.x, t.y, '#98d8d8', { radius: 60, life: 0.5 });
        }, sfx: 'warn',
      },
      {
        t: 0.5, run: () => {
          for (let i = 0; i < 12; i++) { // the shatter — a ring of ice shards
            const a = (i / 12) * Math.PI * 2;
            pushFx(ctx, {
              x: t.x + Math.cos(a) * 40, y: t.y + Math.sin(a) * 40,
              vx: Math.cos(a) * (120 + ctx.fxRng() * 100), vy: Math.sin(a) * (120 + ctx.fxRng() * 100) - 40,
              t: 0.4 + ctx.fxRng() * 0.3, life: 0.7, size: 2.4 + ctx.fxRng() * 2.6,
              color: ctx.fxRng() < 0.4 ? '#ffffff' : '#d8f0f8', shape: 'shard',
              spin: (ctx.fxRng() - 0.5) * 10, grav: 160, rot: a, seed: ctx.fxRng(),
            });
          }
          ctx.waves.push({
            x: t.x, y: t.y, r: 0, maxR: 240, t: 0.5, life: 0.5,
            color: '#98d8d8', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, e === t ? 2.4 : 0.9), '#d8f0f8'),
          });
        }, stop: 0.32, shake: 13, punch: 0.14, flash: ['#98d8d8', 0.28], sfx: 'splash',
      },
    ]);
    return true;
  },
  'METRONOME': ({ ctx, src, p, bumpDmg }) => { // the finger wag — casts a rolled signature
    // the pool: the flashy half of this table — no METRONOME (no
    // recursion), no SPLASH (the wag deserves a real payoff)
    const pool = [
      'HYPER BEAM', 'SOLAR BEAM', 'HYDRO CANNON', 'ZAP CANNON',
      'PSYCHO BOOST', 'ERUPTION', 'EXPLOSION', 'BLAST BURN',
      'FRENZY PLANT', 'OUTRAGE', 'SHEER COLD', 'THUNDERBOLT',
      'ICE BEAM', 'FUTURE SIGHT', 'SPACIAL REND', 'MAGMA STORM',
      'SEED FLARE', 'BLUE FLARE', 'BOLT STRIKE', 'GLACIATE',
      'DRACO METEOR', 'MOONBLAST', 'SHADOW FORCE', 'SACRED FIRE',
      'AEROBLAST', 'DOOM DESIRE', 'DRAGON ASCENT', 'PSYSTRIKE',
    ];
    const picked = pool[Math.floor(ctx.rng() * pool.length)];
    ctx.log(`METRONOME → ${picked}`);
    ctx.pushText({ x: p.x, y: p.y - p.r - 64, text: `→ ${picked}!`, t: 1.2, color: '#ffd84d', big: true });
    sfx('ready');
    return castNamedSuper(ctx, picked, src, p, bumpDmg);
  },
  'FUTURE SIGHT': ({ ctx, bumpDmg, far }) => { // a hole in time opens where the
    // far foe STANDS — the mark swells over a breath, then the sky-lance
    // lands; move and it missed you
    const tx = far.x, ty = far.y;
    ctx.waves.push({ x: tx, y: ty, r: 0, maxR: 160, t: 1.35, life: 1.35, color: '#f85888', hits: new Set() });
    chargeMotes(ctx.fx, ctx.fxRng, tx, ty, TYPE_RAMP.psychic, { r: 120, n: 12, life: 1.2 });
    ctx.pushText({ x: tx, y: ty - 120, text: 'THE FUTURE SPOKE', t: 1.2, color: '#ff98c0', big: true });
    sfx('warn');
    ctx.later(1.35, () => {
      ctx.beams.push({ x1: tx + 60, y1: ty - 420, x2: tx, y2: ty, t: 0.3, life: 0.3, color: '#f85888', w: 4 });
      pixelExplosion(ctx.fx, ctx.fxRng, tx, ty, TYPE_RAMP.psychic, { scale: 1.7 });
      ctx.screenFlash('#f85888', 0.3);
      ctx.scar(tx, ty, 42);
      ctx.hitStop = Math.max(ctx.hitStop, 0.36);
      ctx.addPunch(0.18);
      ctx.addShake(16);
      for (const e of ctx.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
        if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 160 + e.r) continue;
        ctx.hurt(e, bumpDmg(e, 2.2), '#f8b8d0');
      }
      sfx('boom');
    });
    return true;
  },
  'CRUNCH': ({ ctx, p, bumpDmg, foes }) => { // jaws part wide over the mark,
    // then the fangs close — the bite flinches its attack clock a beat
    const t = nearest(foes, p);
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, t.x, t.y, ['#382858', '#705898', '#a890d8'], { r: 55, n: 8, life: 0.28 });
          screenLines(ctx.fx, ctx.fxRng, t.x, t.y, '#a890d8', { n: 8, inward: true });
        }, sfx: 'warn',
      },
      {
        t: 0.3, run: () => { // the bite — two crescents closing opposite ways
          slashArc(ctx.fx, ctx.fxRng, t.x, t.y, ['#382858', '#705898', '#e8e0f8'], { angle: ang + 0.9, radius: 46, arc: 1.8, width: 6 });
          slashArc(ctx.fx, ctx.fxRng, t.x, t.y, ['#382858', '#705898', '#e8e0f8'], { angle: ang + Math.PI - 0.9, radius: 46, arc: 1.8, width: 6 });
          ctx.impact(t.x, t.y, '#705898', 1.9);
          ctx.hurt(t, bumpDmg(t, 1.9), '#d8c8f0');
          t.timer += 0.8;
        }, stop: 0.2, shake: 11, sfx: 'hit',
      },
    ]);
    return true;
  },
  'ICE BEAM': ({ ctx, p, far, lineBlast }) => { // a cold glint, a surgical
    // lance — the lane flash-freezes behind it and everything it spears
    // locks up stiff (no def-down status exists; the chill rides the clock)
    ctx.act([
      { t: 0, run: () => chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#98d8d8', '#d8f0f8', '#ffffff'], { r: 50, n: 8, life: 0.22 }), sfx: 'warn' },
      {
        t: 0.22, run: () => lineBlast(far, '#98d8d8', 30, 2.0, 1.4, (e) => {
          if (!e.dead) e.timer += 0.6;
        }),
      },
      {
        t: 0.5, run: () => { // glittering frost shards hang on the lane
          const d = norm({ x: far.x - p.x, y: far.y - p.y });
          for (let t = 70; t < 560; t += 70) for (let i = 0; i < 2; i++)
            pushFx(ctx, {
              x: p.x + d.x * t + (ctx.fxRng() - 0.5) * 36, y: p.y + d.y * t + (ctx.fxRng() - 0.5) * 36,
              vx: (ctx.fxRng() - 0.5) * 30, vy: -14 - ctx.fxRng() * 20,
              t: 0.5 + ctx.fxRng() * 0.3, life: 0.8, size: 2 + ctx.fxRng() * 2.4,
              color: ctx.fxRng() < 0.4 ? '#ffffff' : '#d8f0f8', shape: 'shard',
              spin: (ctx.fxRng() - 0.5) * 6, grav: 40, rot: ctx.fxRng() * 6.3, seed: ctx.fxRng(),
            });
        },
      },
    ]);
    return true;
  },
  'HYPER VOICE': ({ ctx, p, bumpDmg }) => { // three echoing rings — each pulse
    // rattles the whole court a little wider
    ctx.screenFlash('#f0b6bc', 0.16);
    for (let i = 0; i < 3; i++) {
      ctx.later(i * 0.18, () => {
        ctx.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 260 + i * 40, t: 0.5, life: 0.5,
          color: '#f0b6bc', hits: new Set(),
          onHit: (e) => ctx.hurt(e, bumpDmg(e, 0.55), '#f8dce0'),
        });
        impactRing(ctx.fx, ctx.fxRng, p.x, p.y, '#f0b6bc', { radius: 60 + i * 30 });
        ctx.addShake(6 + i * 2);
        sfx('wave');
      });
    }
    return true;
  },
  'THUNDERBOLT': ({ ctx, src, p, bumpDmg, foes, far }) => { // the mascot bolt —
    // a crackle charge, one fat sky-arc on the far foe, then the discharge
    // hops to the two nearest leftovers
    chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.electric, { r: 60, n: 10, life: 0.3 });
    sfx('warn');
    ctx.later(0.3, () => {
      animBeam(recipeFor(src.def.type, 'THUNDERBOLT'), p.x, p.y, far.x, far.y);
      ctx.beams.push({ x1: p.x, y1: p.y, x2: far.x, y2: far.y, t: 0.32, life: 0.32, color: '#f8d030', w: 7 });
      ctx.impact(far.x, far.y, '#f8d030', 1.9);
      ctx.hurt(far, bumpDmg(far, 2.2), '#f8e88a');
      far.timer += 0.5; // stunned stiff
      ctx.screenFlash('#f8d030', 0.16);
      ctx.hitStop = Math.max(ctx.hitStop, 0.3);
      ctx.addShake(11);
      sfx('zap');
    });
    const hit = new Set([far.uid]);
    let from = far;
    for (let i = 0; i < 2; i++) {
      const next = nearest(foes.filter((e) => !hit.has(e.uid)), from);
      if (!next) break;
      hit.add(next.uid);
      const a = { x: from.x, y: from.y };
      ctx.later(0.44 + i * 0.1, () => {
        if (next.dead) return;
        ctx.beams.push({ x1: a.x, y1: a.y, x2: next.x, y2: next.y, t: 0.26, life: 0.26 });
        ctx.impact(next.x, next.y, '#f8d030', 1.3);
        ctx.hurt(next, bumpDmg(next, 0.9), '#f8e88a');
        sfx('zap');
      });
      from = next;
    }
    return true;
  },
  'FLAMETHROWER': ({ ctx, src, p, bumpDmg, foes, far }) => { // the cone — a
    // widening fan of flame down the ray; everything it sweeps keeps burning
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    ctx.act([
      { t: 0, run: () => chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 50, n: 10, life: 0.3 }), sfx: 'warn' },
      {
        t: 0.32, run: () => {
          animBeam(recipeFor(src.def.type, 'FLAMETHROWER'), p.x, p.y, far.x, far.y);
          for (let i = -2; i <= 2; i++) { // the fan — five jets spread off the ray
            const a = i * 0.16, ca = Math.cos(a), sa = Math.sin(a);
            ctx.beams.push({
              x1: p.x, y1: p.y,
              x2: p.x + (d.x * ca - d.y * sa) * 1300, y2: p.y + (d.x * sa + d.y * ca) * 1300,
              t: 0.5, life: 0.5, color: '#f08030', w: 2,
            });
          }
          for (const e of foes) {
            if (!inCone(p, d, e, 0.38, 20)) continue;
            ctx.hurt(e, bumpDmg(e, 2.0), '#ffb088');
            if (!e.dead) {
              e.dotTicks = Math.min(e.dotTicks + 3, 6);
              e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
            }
          }
          buzz([40, 30, 60]);
        }, stop: 0.3, shake: 14, punch: 0.14, flash: ['#f08030', 0.25], sfx: 'beam',
      },
    ]);
    return true;
  },
  'SPLASH': ({ ctx, src, p, bumpDmg, foes }) => { // the dud, played straight —
    // a hop, a beat of silence, one sad droplet, a ripple that barely stings
    const t = nearest(foes, p);
    p.sq = 1; // the little hop — up it goes, down it comes
    ctx.act([
      {
        t: 0.45, run: () => { // one sad droplet arcs off — nothing else happens
          pushFx(ctx, {
            x: p.x, y: p.y - p.r, vx: 60, vy: -120, t: 0.55, life: 0.55,
            size: 3, color: '#9db8d8', shape: 'dot', spin: 0, grav: 500,
          });
        },
      },
      {
        t: 0.95, run: () => { // the ripple — barely a sting
          impactRing(ctx.fx, ctx.fxRng, p.x + 33, p.y + 10, '#9db8d8', { radius: 24, life: 0.4, motes: 2 });
          ctx.hurt(t, bumpDmg(t, 0.1), '#bfe8ff');
        }, sfx: ['splash', 0.7],
      },
      {
        t: 1.15, run: () => {
          ctx.pushText({ x: p.x, y: p.y - p.r - 64, text: '…but nothing happened!', t: 1.1, color: '#9db8d8', big: false });
          ctx.log(`${src.def.name.toUpperCase()} used SPLASH · nothing happened`);
        },
      },
    ]);
    return true;
  },
  'WATER SPOUT': ({ ctx, src, p, bumpDmg, foes }) => { // Kyogre's geysers —
    // rain gathers, then the court erupts under the pack one by one. The
    // caster's own HP is the reservoir: full HP floods, near-faint sputters
    const power = 0.9 + 1.5 * (src.hp / src.maxHp);
    const beats: ActBeat[] = [{
      t: 0, run: () => { // rain streaks gather over the court
        for (let i = 0; i < 12; i++) pushFx(ctx, {
          x: p.x + (ctx.fxRng() - 0.5) * 300, y: p.y - 120 - ctx.fxRng() * 100,
          vx: 0, vy: 60 + ctx.fxRng() * 60, t: 0.5, life: 0.5, size: 1.6 + ctx.fxRng() * 1.6,
          color: '#a8d0ff', shape: 'streak', spin: 0, grav: 0,
        });
        chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.water, { r: 60, n: 10, life: 0.4 });
      }, sfx: 'warn',
    }];
    foes.slice(0, 6).forEach((e, i) => beats.push({
      t: 0.42 + i * 0.09,
      run: () => {
        if (e.dead) return;
        pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.water, { h: 1.7, n: 13, spread: 24 });
        ctx.hurt(e, bumpDmg(e, power), '#bfe8ff');
        e.vy -= 200; // the geyser lifts them
        e.vx += (ctx.rng() - 0.5) * 80;
      },
      shake: i === 0 ? 12 : 6, flash: i === 0 ? ['#6890f0', 0.18] : undefined, sfx: 'splash',
    }));
    ctx.act(beats);
    return true;
  },
  'FISSURE': ({ ctx, p, lineBlast, foes, far }) => { // the ground growls, then a
    // jagged crack races the ray — canon OHKO, but the crack only finds
    // GROUNDED prey; everyone else watches it pass
    const g = farthest(foes.filter((e) => !e.airborne && !flies(e.def)), p);
    const to = g ?? far; // no grounded mark: the crack lands as heavy damage
    ctx.act([
      {
        t: 0, run: () => { // the growl — dirt vents off every grounded foe
          for (const e of foes) if (!e.airborne && !flies(e.def))
            smokeColumn(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.rock, { n: 2, spread: 30 });
        }, shake: 6, sfx: 'warn',
      },
      {
        t: 0.35, run: () => {
          lineBlast(to, '#b8a038', 18, 2.8, 1.3, g ? (e) => {
            if (!e.dead && e.hp < e.maxHp * 0.35) e.timer += 1.2; // left dazed in the crack
          } : undefined);
          const d = norm({ x: to.x - p.x, y: to.y - p.y });
          for (let t = 60; t < Math.min(dist(p, to) + 200, 640); t += 65)
            pillarSpout(ctx.fx, ctx.fxRng, p.x + d.x * t, p.y + d.y * t, TYPE_RAMP.rock, { h: 0.7, n: 5, spread: 20 });
        },
      },
    ]);
    return true;
  },
  'SEISMIC TOSS': ({ ctx, src, p, foes }) => { // the grab — speed lines heave
    // the nearest foe skyward, then the slam lands; canon fixed damage
    // pays per level
    const t = nearest(foes, p);
    ctx.act([
      {
        t: 0, run: () => {
          t.y -= 60; // heaved skyward — the same pop the vortex uses
          t.vy -= 400;
          t.sq = 1;
          p.sq = 1;
          screenLines(ctx.fx, ctx.fxRng, t.x, t.y, '#c03028', { n: 8 });
        }, sfx: 'launch',
      },
      {
        t: 0.55, run: () => { // the landing is what hurts
          if (t.dead) return;
          pixelExplosion(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.fighting, { scale: 1.3 });
          ctx.impact(t.x, t.y, '#c03028', 1.8);
          ctx.hurt(t, Math.round(src.lvl * t.maxHp * 0.012), '#f0b8a8'); // ~1.2%/lv — Lv50 ≈ 60% maxHp
          ctx.scar(t.x, t.y, 22);
        }, stop: 0.22, shake: 12, sfx: 'boom',
      },
    ]);
    return true;
  },
  'ENDEAVOR': ({ ctx, src, p, bumpDmg, foes }) => { // the desperate dive — a
    // crouch, a speed-line lunge, and the mark dragged down to the caster's
    // own HP fraction
    const t = nearest(foes, p);
    const d = norm({ x: t.x - p.x, y: t.y - p.y });
    ctx.act([
      { t: 0, run: () => { p.sq = 1; aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.normal, { r: 22, n: 8, life: 0.5 }); }, sfx: 'warn' },
      {
        t: 0.25, run: () => {
          for (let i = -1; i <= 1; i++) // a speed-line fan — the dive reads fast
            ctx.beams.push({ x1: p.x, y1: p.y, x2: t.x - d.y * i * 14, y2: t.y + d.x * i * 14, t: 0.3, life: 0.3, color: '#f8f8f8', w: 2 });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#f8f8f8', { n: 10 });
          const want = Math.max(1, Math.round(t.maxHp * (src.hp / src.maxHp))); // canon can't KO
          const need = t.hp - want;
          ctx.hurt(t, need > 0 ? need : bumpDmg(t, 0.5), '#f8f8d8'); // under it already — chip, never whiff
          ctx.impact(t.x, t.y, '#f8f8f8', 1.5);
        }, stop: 0.18, shake: 10, sfx: 'hit',
      },
    ]);
    return true;
  },
  'AURA SPHERE': ({ ctx, p, bumpDmg, foes }) => { // canon never misses — the orb homes on the
    // nearest mark, phases through every rock and retargets on a kill,
    // so the lock-on literally cannot whiff
    const t = nearest(foes, p);
    ctx.orbs.push({ x: p.x, y: p.y, target: t, dmg: bumpDmg(t, 2.2), t: 3, wob: 0, color: '#30c8f0', spd: 1150 });
    ctx.pushText({ x: t.x, y: t.y - t.r - 40, text: 'LOCKED ON!', t: 0.9, color: '#9df0ff', big: false });
    ctx.screenFlash('#30c8f0', 0.14);
    sfx('beam');
    return true;
  },
  'SACRED SWORD': ({ ctx, src, p, bumpDmg, foes }) => { // canon ignores the target's stat changes —
    // the honest port is true damage: the blade pays no heed to defense
    const t =
      foes.filter((e) => dist(p, e) <= 340).sort((a, b) => b.maxHp - a.maxHp)[0] ?? // toughest in reach
      nearest(foes, p); // none close — it still cuts the nearest
    const d = norm({ x: t.x - p.x, y: t.y - p.y });
    for (let i = -1; i <= 1; i++) // one swing, a fan of three cut-lines
      ctx.beams.push({
        x1: t.x - d.x * 60 + d.y * i * 18, y1: t.y - d.y * 60 - d.x * i * 18,
        x2: t.x + d.x * 60 + d.y * i * 18, y2: t.y + d.y * 60 - d.x * i * 18,
        t: 0.35, life: 0.35, color: '#e8e8f8', w: 3,
      });
    // true damage: back the defender's mit term out of the super's own
    // roll — type, combo and pow still ride along (mit = 60/(60+stat))
    const mitStat = bumpIsPhysical(src.def.type) ? t.def.stats.def : t.def.stats.spd;
    ctx.hurt(t, Math.round((bumpDmg(t, 1.9) * (60 + mitStat)) / 60), '#e8e8f8');
    ctx.impact(t.x, t.y, '#e8e8f8', 1.8);
    ctx.pushText({ x: t.x, y: t.y - t.r - 40, text: 'CUTS THROUGH!', t: 0.9, color: '#e8e8f8', big: false });
    ctx.hitStop = Math.max(ctx.hitStop, 0.2);
    ctx.addShake(11);
    sfx('hit');
    return true;
  },
  'DARK VOID': ({ ctx, bumpDmg, fattest }) => { // the void opens on a beat — everything it
    // swallows oversleeps. `timer` (the attack clock) is the engine's
    // sleep: +2 turns beats any flinch in the table
    const tx = fattest.x, ty = fattest.y; // the dark pulls at the biggest threat
    ctx.waves.push({ x: tx, y: ty, r: 0, maxR: 250, t: 0.9, life: 0.9, color: '#705898', hits: new Set() });
    ctx.pushText({ x: tx, y: ty - 130, text: 'THE AIR GOES DARK', t: 1.2, color: '#b098e8', big: true });
    sfx('warn');
    ctx.later(0.9, () => {
      ctx.screenFlash('#403050', 0.3);
      ctx.impact(tx, ty, '#705898', 2);
      ctx.addShake(12);
      for (const e of ctx.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
        if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 250 + e.r) continue;
        e.timer += 2; // asleep — its attack clock slips two turns
        ctx.hurt(e, bumpDmg(e, 0.7), '#b098e8');
        ctx.pushText({ x: e.x, y: e.y - e.r - 30, text: 'Z Z Z', t: 1.1, color: '#b098e8', big: false });
      }
      sfx('wave');
    });
    return true;
  },
  'V-CREATE': ({ ctx, p, bumpDmg, foes }) => { // canon: the hottest flame + a defense drop. The
    // ally rockets through the pack — a two-link dash at nuke power that
    // ends parked on the far mark. No per-unit def-down field exists
    // (takenMult is a run-wide perk knob), so the self-cost stays on the
    // card text — the honest read is the bigger hit.
    const t = nearest(foes, p);
    ctx.screenFlash('#f08030', 0.2);
    ctx.burst(p.x, p.y, '#f08030', 20, 640); // takeoff — the V ignites
    ctx.dashes.push({ u: p, e: t, done: false, dmg: bumpDmg(t, 2.4) });
    // Dash has no land callback — re-push once the lunge should have
    // landed (dashes run at 1100 u/s), the same chain EXTREMESPEED uses
    ctx.later(dist(p, t) / 1100 + 0.05, () => {
      const t2 = nearest(ctx.enemies.filter((e) => !e.dead && e !== t), p);
      if (!t2) return;
      ctx.burst(p.x, p.y, '#f08030', 14, 540);
      ctx.dashes.push({ u: p, e: t2, done: false, dmg: bumpDmg(t2, 2.4) });
    });
    ctx.addShake(10);
    sfx('sizzle');
    return true;
  },
  'JUDGMENT': ({ ctx, bumpDmg, foes }) => { // countless pellets of light rain on the whole
    // pack — one sky-beam per foe, staggered so the volley reads as rain
    ctx.pushText({
      x: ctx.arena.x + ctx.arena.w / 2, y: ctx.arena.y + 90,
      text: 'JUDGMENT IS DEALT', t: 1.3, color: '#fff0a8', big: true,
    });
    ctx.screenFlash('#fff0a8', 0.22);
    ctx.addShake(10);
    sfx('warn');
    foes.forEach((e, i) => {
      ctx.later(0.15 + i * 0.09, () => {
        if (e.dead) return;
        ctx.beams.push({ x1: e.x + 40, y1: e.y - 300, x2: e.x, y2: e.y, t: 0.28, life: 0.28, color: '#fff0a8', w: 4 });
        ctx.impact(e.x, e.y, '#fff0a8', 1.4);
        ctx.hurt(e, bumpDmg(e, 1.6), '#fff8d0');
        sfx('beam');
      });
    });
    return true;
  },
  'ROAR OF TIME': ({ ctx, src, bumpDmg, fattest }) => { // the roar takes a beat to cross time — a
    // telegraph ring swells where the fattest foe stands, then the blast
    // lands huge. Canon recharge: the caster's super clock restarts full.
    const tx = fattest.x, ty = fattest.y;
    ctx.waves.push({ x: tx, y: ty, r: 0, maxR: 230, t: 1.2, life: 1.2, color: '#a8c8f0', hits: new Set() });
    ctx.pushText({ x: tx, y: ty - 130, text: 'TIME DISTORTS', t: 1.2, color: '#a8c8f0', big: true });
    sfx('warn');
    ctx.later(1.2, () => {
      ctx.screenFlash('#a8c8f0', 0.32);
      ctx.impact(tx, ty, '#a8c8f0', 2.2);
      ctx.scar(tx, ty, 48);
      ctx.hitStop = Math.max(ctx.hitStop, 0.36);
      ctx.addPunch(0.18);
      ctx.addShake(17);
      for (const e of ctx.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
        if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 230 + e.r) continue;
        ctx.hurt(e, bumpDmg(e, 3.0), '#d8e8ff');
      }
      src.cd = src.cdMax; // spent — the next super earns from zero
      sfx('boom');
    });
    return true;
  },
  // --- the new canon picks: legendaries whose name-only moves earn a real
  // signature here — species already map them in MOVE_OF, the anim layer
  // already carries their element recipes
  'SPACIAL REND': ({ ctx, src, p, bumpDmg, foes, far }) => { // Palkia tears the
    // court's fabric — a rend swallows a band, then space snaps shut for
    // a second hit on whatever's still inside
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    const band = (power: number) => {
      for (const e of foes) {
        const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
        if (t < 0) continue;
        const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
        if (Math.hypot(dx, dy) < 60 + e.r) ctx.hurt(e, bumpDmg(e, power), '#e0c8ff');
      }
    };
    ctx.act([
      {
        t: 0, run: () => { // space warps inward along the band
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.psychic, { r: 80, n: 10, life: 0.4 });
          screenLines(ctx.fx, ctx.fxRng, far.x, far.y, '#a890d8', { n: 12, inward: true });
        }, sfx: 'warn',
      },
      {
        t: 0.42, run: () => { // the rend — a violet tear down the lane
          animBeam(recipeFor(src.def.type, 'SPACIAL REND'), p.x, p.y, far.x, far.y);
          ctx.beams.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 1400, y2: p.y + d.y * 1400, t: 0.55, life: 0.55, color: '#a890d8', w: 3 });
          band(1.5);
        }, shake: 12, flash: ['#a890d8', 0.2], sfx: 'beam',
      },
      {
        t: 0.9, run: () => { // the snap — space slams shut, dragging the band along
          band(1.2);
          for (const e of foes) if (!e.dead) { e.vx += d.x * 180; e.vy += d.y * 180; }
          screenLines(ctx.fx, ctx.fxRng, p.x + d.x * 300, p.y + d.y * 300, '#f85888', { n: 10, inward: true });
        }, stop: 0.3, shake: 15, punch: 0.16, flash: ['#f85888', 0.25], sfx: 'boom',
      },
    ]);
    return true;
  },
  'MAGMA STORM': ({ ctx, p, bumpDmg }) => { // a magma vortex swallows the
    // court — the eye drags everything inward and the trap keeps burning
    ctx.act([
      {
        t: 0, run: () => {
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 60, n: 14 });
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 100, n: 10, life: 0.5 });
        }, sfx: 'warn',
      },
      {
        t: 0.5, run: () => {
          ctx.waves.push({
            x: p.x, y: p.y, r: 0, maxR: 320, t: 0.6, life: 0.6, color: '#f08030', hits: new Set(),
            onHit: (e) => {
              ctx.hurt(e, bumpDmg(e, 1.4), '#ffb088');
              if (e.dead) return;
              e.dotTicks = Math.min(e.dotTicks + 4, 6); // trapped — the swirl keeps burning
              e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
              const dd = norm({ x: p.x - e.x, y: p.y - e.y }); // dragged toward the eye
              e.vx += dd.x * 260; e.vy += dd.y * 260;
            },
          });
        }, shake: 12, punch: 0.12, flash: ['#f08030', 0.2], sfx: 'boom',
      },
      { t: 1.1, run: () => smokeColumn(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { n: 5, spread: 40 }) },
    ]);
    return true;
  },
  'SEED FLARE': ({ ctx, p, bumpDmg, fattest }) => { // Shaymin's flare — a seed
    // arcs onto the biggest mark, then blooms into a shockwave over the pack
    ctx.act([
      { t: 0, run: () => aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.grass, { r: 26, n: 10 }), sfx: 'warn' },
      {
        t: 0.35, run: () => {
          ctx.orbs.push({ x: p.x, y: p.y, target: fattest, dmg: bumpDmg(fattest, 0.8), t: 2, wob: 0, color: '#b8f088', spd: 900 });
        }, sfx: 'launch',
      },
      {
        t: 0.45 + dist(p, fattest) / 900, run: () => { // the bloom pops wherever the seed landed
          pixelExplosion(ctx.fx, ctx.fxRng, fattest.x, fattest.y, TYPE_RAMP.grass, { scale: 1.6 });
          ctx.waves.push({
            x: fattest.x, y: fattest.y, r: 0, maxR: 300, t: 0.55, life: 0.55, color: '#78c850', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, e === fattest ? 1.2 : 1.0), '#d8f8c0'),
          });
        }, stop: 0.3, shake: 13, punch: 0.14, flash: ['#b8f088', 0.22], sfx: 'boom',
      },
    ]);
    return true;
  },
  'BLUE FLARE': ({ ctx, src, p, bumpDmg, foes, far }) => { // a beautiful blue
    // jet — the far mark takes the heart of it; the lane it drew singes on
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    ctx.act([
      { t: 0, run: () => chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#2868c8', '#50a0f8', '#c8e8ff'], { r: 80, n: 14, life: 0.45 }), sfx: 'warn' },
      {
        t: 0.45, run: () => {
          animBeam(recipeFor(src.def.type, 'BLUE FLARE'), p.x, p.y, far.x, far.y);
          ctx.beams.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 1400, y2: p.y + d.y * 1400, t: 0.6, life: 0.6, color: '#50a0f8', w: 2.2 });
          pillarSpout(ctx.fx, ctx.fxRng, far.x, far.y, ['#2868c8', '#50a0f8', '#c8e8ff', '#f0faff'], { h: 2, n: 18, spread: 34 });
          for (const e of foes) {
            const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
            if (t < 0) continue;
            const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
            if (Math.hypot(dx, dy) < 46 + e.r) {
              ctx.hurt(e, bumpDmg(e, e === far ? 2.8 : 1.6), '#c8e8ff');
              if (!e.dead) {
                e.dotTicks = Math.min(e.dotTicks + 2, 6);
                e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
              }
            }
          }
          ctx.scar(far.x, far.y, 30);
          buzz([40, 30, 60]);
        }, stop: 0.36, shake: 16, punch: 0.18, flash: ['#50a0f8', 0.3], sfx: 'beam',
      },
    ]);
    return true;
  },
  'BOLT STRIKE': ({ ctx, src, bumpDmg, fattest }) => { // Zekrom's bolt falls
    // from the sky — charge gathers over the biggest mark, then one colossal
    // crash shatters the ground under it
    ctx.act([
      {
        t: 0, run: () => { // the sky charges over the mark
          chargeMotes(ctx.fx, ctx.fxRng, fattest.x, fattest.y - 200, TYPE_RAMP.electric, { r: 120, n: 12, life: 0.5 });
          impactRing(ctx.fx, ctx.fxRng, fattest.x, fattest.y, '#f8d030', { radius: 70, life: 0.5 });
        }, sfx: 'warn',
      },
      {
        t: 0.5, run: () => {
          animBeam(recipeFor(src.def.type, 'BOLT STRIKE'), fattest.x, fattest.y - 300, fattest.x, fattest.y);
          ctx.beams.push({ x1: fattest.x - 30, y1: fattest.y - 420, x2: fattest.x, y2: fattest.y, t: 0.35, life: 0.35, color: '#f8d030', w: 8 });
          pixelExplosion(ctx.fx, ctx.fxRng, fattest.x, fattest.y, TYPE_RAMP.electric, { scale: 1.7 });
          ctx.waves.push({
            x: fattest.x, y: fattest.y, r: 0, maxR: 230, t: 0.5, life: 0.5, color: '#f8d030', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, e === fattest ? 3.0 : 1.0), '#f8e88a'),
          });
          ctx.scar(fattest.x, fattest.y, 40);
        }, stop: 0.36, shake: 17, punch: 0.2, flash: ['#f8d030', 0.3], sfx: 'zap',
      },
    ]);
    return true;
  },
  // --- the late-mythic picks: canon signatures for species that wore the
  // type fallback or a generic card name — each earns its own act
  'DRACO METEOR': ({ ctx, src, bumpDmg, foes }) => { // the sky opens — a roar
    // gathers overhead, then meteors drop on the pack one by one
    const marks = foes.slice(0, 5);
    const beats: ActBeat[] = [{
      t: 0, run: () => {
        for (const e of marks) chargeMotes(ctx.fx, ctx.fxRng, e.x, e.y - 150, TYPE_RAMP.flying, { r: 60, n: 5, life: 0.4 });
      }, shake: 6, sfx: 'warn',
    }];
    marks.forEach((e, i) => beats.push({
      t: 0.4 + i * 0.11,
      run: () => {
        if (e.dead) return;
        animBeam(recipeFor(src.def.type, 'DRACO METEOR'), e.x + 40, e.y - 320, e.x, e.y);
        pixelExplosion(ctx.fx, ctx.fxRng, e.x, e.y, TYPE_RAMP.flying, { scale: 1.2 });
        ctx.hurt(e, bumpDmg(e, 1.5), '#d0c0ff');
        ctx.scar(e.x, e.y, 22);
      },
      stop: i === marks.length - 1 ? 0.24 : 0.05, shake: 10, flash: i === 0 ? ['#a890f0', 0.2] : undefined, sfx: 'boom',
    }));
    ctx.act(beats);
    return true;
  },
  'GIGA IMPACT': ({ ctx, p, bumpDmg, foes }) => { // the full-body freight — a
    // brace, then the body-check runs the nearest mark down and the crater
    // it leaves staggers what it didn't flatten
    const t = nearest(foes, p);
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.normal, { r: 80, n: 14, life: 0.4 });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#e0e0b0', { n: 12, inward: true });
        }, sfx: 'warn',
      },
      {
        t: 0.45, run: () => {
          ctx.burst(p.x, p.y, '#e0e0b0', 16, 560);
          ctx.dashes.push({ u: p, e: t, done: false, dmg: bumpDmg(t, 2.5) });
        }, sfx: 'launch',
      },
      {
        t: 0.5 + dist(p, t) / 1100, run: () => { // the shockwave rolls off the hit
          pixelExplosion(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.normal, { scale: 1.5 });
          ctx.waves.push({
            x: t.x, y: t.y, r: 0, maxR: 240, t: 0.5, life: 0.5, color: '#e0e0b0', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, 0.7), '#f8f8e0'),
          });
          ctx.scar(t.x, t.y, 34);
        }, stop: 0.3, shake: 16, punch: 0.2, flash: ['#f8f8e0', 0.25], sfx: 'boom',
      },
    ]);
    return true;
  },
  'MOONBLAST': ({ ctx, p, bumpDmg, fattest }) => { // a pale moon crests over
    // the biggest mark — then the light it lent comes down all at once
    const tx = fattest.x, ty = fattest.y;
    ctx.act([
      {
        t: 0, run: () => {
          aura(ctx.fx, ctx.fxRng, p.x, p.y, ['#9898c8', '#d8d8f0', '#f8f8ff'], { r: 40, n: 10 });
          impactRing(ctx.fx, ctx.fxRng, tx, ty, '#d8d8f0', { radius: 90, life: 0.6 });
        }, sfx: 'warn',
      },
      {
        t: 0.55, run: () => { // the moonbeam descends
          ctx.beams.push({ x1: tx - 90, y1: ty - 420, x2: tx, y2: ty, t: 0.4, life: 0.4, color: '#f0f0ff', w: 6 });
          pixelExplosion(ctx.fx, ctx.fxRng, tx, ty, ['#9898c8', '#d8d8f0', '#ffffff'], { scale: 1.5 });
          ctx.waves.push({
            x: tx, y: ty, r: 0, maxR: 240, t: 0.5, life: 0.5, color: '#d8d8f0', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, e === fattest ? 2.4 : 0.9), '#f0f0ff'),
          });
        }, stop: 0.3, shake: 14, punch: 0.16, flash: ['#f0f0ff', 0.28], sfx: 'beam',
      },
      {
        t: 1.0, run: () => { // stardust settles over the blast
          for (let i = 0; i < 8; i++) pushFx(ctx, {
            x: tx + (ctx.fxRng() - 0.5) * 160, y: ty - 20 - ctx.fxRng() * 60,
            vx: (ctx.fxRng() - 0.5) * 30, vy: 20 + ctx.fxRng() * 40,
            t: 0.6 + ctx.fxRng() * 0.4, life: 1, size: 1.6 + ctx.fxRng() * 2,
            color: '#f8f8ff', shape: 'sparkle', spin: (ctx.fxRng() - 0.5) * 6, grav: 40,
          });
        },
      },
    ]);
    return true;
  },
  'SHADOW FORCE': ({ ctx, p, bumpDmg, foes }) => { // the caster slips out of
    // the world — one beat of nothing, then it stands inside the far mark's
    // shadow and the dark bursts out
    const t = farthest(foes, p);
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1; p.flashT = 0.4; // it's already slipping away
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.ghost, { r: 70, n: 12, life: 0.45 });
        }, sfx: 'warn',
      },
      {
        t: 0.45, run: () => { // gone — its shadow pools under the mark instead
          smokeColumn(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.ghost, { n: 4, spread: 24 });
          p.x = t.x + 40; p.y = t.y + 40; // the strike lands from inside the shadow
          chargeMotes(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.ghost, { r: 60, n: 10, life: 0.25 });
          impactRing(ctx.fx, ctx.fxRng, t.x, t.y, '#705898', { radius: 70, life: 0.4 });
        }, flash: ['#382858', 0.2], sfx: 'wave',
      },
      {
        t: 0.75, run: () => {
          pixelExplosion(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.ghost, { scale: 1.6 });
          slashArc(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.ghost, { angle: ctx.fxRng() * 6.3, radius: 52, arc: 2.8 });
          ctx.hurt(t, bumpDmg(t, 2.5), '#d8c8f0');
          for (const e of foes) { // the burst splashes the shadow's neighbors
            if (e === t || e.dead || Math.hypot(e.x - t.x, e.y - t.y) > 120 + e.r) continue;
            ctx.hurt(e, bumpDmg(e, 0.8), '#b098e8');
          }
          ctx.scar(t.x, t.y, 30);
        }, stop: 0.32, shake: 15, punch: 0.18, flash: ['#a890d8', 0.25], sfx: 'boom',
      },
    ]);
    return true;
  },
  'LEAF BLADE': ({ ctx, p, bumpDmg, foes }) => { // a leaf of pure edge — the
    // caster's own orbit of leaves snaps into one sweeping cut through
    // everything a blade's reach away
    const t = nearest(foes, p);
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          for (let i = 0; i < 10; i++) { // leaves wheel around the caster
            const a = (i / 10) * Math.PI * 2;
            pushFx(ctx, {
              x: p.x + Math.cos(a) * 44, y: p.y + Math.sin(a) * 44,
              vx: -Math.sin(a) * 140, vy: Math.cos(a) * 140,
              t: 0.4, life: 0.4, size: 2 + ctx.fxRng() * 2,
              color: ctx.fxRng() < 0.4 ? '#eaffd0' : '#78c850', shape: 'leaf',
              spin: (ctx.fxRng() - 0.5) * 12, grav: 0, sway: 20,
            });
          }
        }, sfx: 'warn',
      },
      {
        t: 0.35, run: () => { // the cut — a wide melee arc off the shoulder
          slashArc(ctx.fx, ctx.fxRng, p.x + Math.cos(ang) * 70, p.y + Math.sin(ang) * 70, TYPE_RAMP.grass, { angle: ang - 1.4, radius: 60, arc: 2.8, width: 7 });
          for (const e of foes) {
            if (e.dead || dist(p, e) > 170 + e.r) continue;
            ctx.hurt(e, bumpDmg(e, e === t ? 2.2 : 1.2), '#d8f8c0');
          }
          ctx.impact(t.x, t.y, '#78c850', 1.7);
        }, stop: 0.22, shake: 12, punch: 0.1, flash: ['#b8f088', 0.2], sfx: 'hit',
      },
    ]);
    return true;
  },
  'X-SCISSOR': ({ ctx, p, bumpDmg, foes }) => { // two blades crossing into the
    // X — the nearest mark eats both cuts; whatever stands in the cross
    // eats the second
    const t = nearest(foes, p);
    const ang = Math.atan2(t.y - p.y, t.x - p.x);
    ctx.act([
      { t: 0, run: () => chargeMotes(ctx.fx, ctx.fxRng, t.x, t.y, ['#307028', '#b8f088', '#f8fff0'], { r: 50, n: 8, life: 0.22 }), sfx: 'warn' },
      {
        t: 0.24, run: () => { // the first blade
          slashArc(ctx.fx, ctx.fxRng, t.x, t.y, TYPE_RAMP.grass, { angle: ang + 0.8, radius: 50, arc: 2.2, width: 6 });
          ctx.hurt(t, bumpDmg(t, 1.1), '#d8f8c0');
        }, stop: 0.1, shake: 8, sfx: 'hit',
      },
      {
        t: 0.42, run: () => { // the second closes the X
          slashArc(ctx.fx, ctx.fxRng, t.x, t.y, ['#307028', '#b8f088', '#ffffff'], { angle: ang - 0.8 + Math.PI, radius: 50, arc: 2.2, width: 6 });
          ctx.impact(t.x, t.y, '#b8f088', 1.8);
          ctx.hurt(t, bumpDmg(t, 1.3), '#d8f8c0');
          for (const e of foes) {
            if (e === t || e.dead || Math.hypot(e.x - t.x, e.y - t.y) > 110 + e.r) continue;
            ctx.hurt(e, bumpDmg(e, 0.7), '#d8f8c0');
          }
        }, stop: 0.2, shake: 12, sfx: 'hit',
      },
    ]);
    return true;
  },
  'EARTH POWER': ({ ctx, bumpDmg, foes, fattest }) => { // the court's own
    // power pays out — a golden glow fronts in, then erupts under every
    // grounded mark; winged prey stays out of the earth's reach
    const gold = ['#b87818', '#e8a838', '#ffd878', '#fff0c0'];
    const grounded = foes.filter((e) => !e.airborne && !flies(e.def));
    const marks = (grounded.length ? grounded : [fattest]).slice(0, 5); // all winged: the earth still finds the biggest
    const beats: ActBeat[] = [{
      t: 0, run: () => {
        for (const e of marks) impactRing(ctx.fx, ctx.fxRng, e.x, e.y, '#ffd878', { radius: 40, life: 0.5, motes: 3 });
      }, shake: 6, sfx: 'warn',
    }];
    marks.forEach((e, i) => beats.push({
      t: 0.5 + i * 0.1,
      run: () => {
        if (e.dead) return;
        pillarSpout(ctx.fx, ctx.fxRng, e.x, e.y, gold, { h: 1.6, n: 13, spread: 26 });
        ctx.hurt(e, bumpDmg(e, 1.4), '#ffe8a8');
        ctx.scar(e.x, e.y, 22);
      },
      shake: i === 0 ? 12 : 6, flash: i === 0 ? ['#e8a838', 0.2] : undefined, sfx: 'boom',
    }));
    ctx.act(beats);
    return true;
  },
  'FLASH CANNON': ({ ctx, p, far, lineBlast }) => { // polished light gathers
    // on the caster, then one mirror-bright lance — the lane keeps glinting
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, ['#8898a8', '#d0e0f0', '#ffffff'], { r: 60, n: 12, life: 0.35 });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#d0e0f0', { n: 8, inward: true });
        }, sfx: 'warn',
      },
      { t: 0.35, run: () => lineBlast(far, '#e8f0f8', 30, 2.4, 2.2) },
      {
        t: 0.62, run: () => { // mirror glints scatter off the ray
          const d = norm({ x: far.x - p.x, y: far.y - p.y });
          for (let t = 80; t < 560; t += 80)
            pushFx(ctx, {
              x: p.x + d.x * t + (ctx.fxRng() - 0.5) * 30, y: p.y + d.y * t + (ctx.fxRng() - 0.5) * 30,
              vx: (ctx.fxRng() - 0.5) * 80, vy: -40 - ctx.fxRng() * 60,
              t: 0.5 + ctx.fxRng() * 0.3, life: 0.8, size: 2 + ctx.fxRng() * 2,
              color: ctx.fxRng() < 0.5 ? '#ffffff' : '#d0e0f0', shape: 'sparkle',
              spin: (ctx.fxRng() - 0.5) * 8, grav: 120,
            });
        },
      },
    ]);
    return true;
  },
  'DARK PULSE': ({ ctx, p, bumpDmg }) => { // a horrible aura rings out — the
    // pulse rattles everything it catches and rings in their skull
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.ghost, { r: 40, n: 12 });
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#705898', { n: 10, inward: true });
        }, sfx: 'warn',
      },
      {
        t: 0.4, run: () => {
          ctx.waves.push({
            x: p.x, y: p.y, r: 0, maxR: 340, t: 0.55, life: 0.55, color: '#705898', hits: new Set(),
            onHit: (e) => {
              ctx.hurt(e, bumpDmg(e, 1.6), '#d8c8f0');
              if (!e.dead) e.timer += 0.5; // flinched — the dark rings on
            },
          });
          for (let i = 1; i < 3; i++) // the echo rings trail the pulse
            ctx.waves.push({ x: p.x, y: p.y, r: 0, maxR: 340 + i * 70, t: 0.55, life: 0.55, color: '#382858', hits: new Set() });
        }, stop: 0.26, shake: 13, punch: 0.12, flash: ['#705898', 0.22], sfx: 'wave',
      },
    ]);
    return true;
  },
  'POWER GEM': ({ ctx, p, bumpDmg, foes, far }) => { // the gem hoards light,
    // then the ray it throws splinters — the far mark takes the beam and
    // cut-glass shards ricochet into the pack
    ctx.act([
      { t: 0, run: () => chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.rock, { r: 60, n: 12, life: 0.35 }), sfx: 'warn' },
      {
        t: 0.35, run: () => {
          ctx.beams.push({ x1: p.x, y1: p.y, x2: far.x, y2: far.y, t: 0.4, life: 0.4, color: '#e8d078', w: 5 });
          ctx.impact(far.x, far.y, '#e8d078', 1.9);
          ctx.hurt(far, bumpDmg(far, 2.3), '#faf0c8');
          for (let i = 0; i < 6; i++) { // the cut-glass spray off the hit
            const a = ctx.fxRng() * Math.PI * 2;
            pushFx(ctx, {
              x: far.x, y: far.y,
              vx: Math.cos(a) * (180 + ctx.fxRng() * 160), vy: Math.sin(a) * (180 + ctx.fxRng() * 160),
              t: 0.5, life: 0.5, size: 2 + ctx.fxRng() * 2.4,
              color: ctx.fxRng() < 0.5 ? '#faf0c8' : '#e8d078', shape: 'shard',
              spin: (ctx.fxRng() - 0.5) * 14, grav: 300, rot: a, seed: ctx.fxRng(),
            });
          }
          const rest = foes.filter((e) => e !== far).sort((a, b) => dist(far, a) - dist(far, b)).slice(0, 2);
          for (const e of rest) { // the splinters ricochet to the two nearest
            ctx.beams.push({ x1: far.x, y1: far.y, x2: e.x, y2: e.y, t: 0.26, life: 0.26, color: '#e8d078', w: 2 });
            ctx.impact(e.x, e.y, '#e8d078', 1.1);
            ctx.hurt(e, bumpDmg(e, 0.9), '#faf0c8');
          }
        }, stop: 0.28, shake: 13, punch: 0.14, flash: ['#e8d078', 0.22], sfx: 'beam',
      },
    ]);
    return true;
  },
  'PSYSTRIKE': ({ ctx, p, bumpDmg, fattest }) => { // a psychic shockwave that
    // strikes the body, not the mind — the roll swaps SpD for Def, then the
    // echo rips through again a breath later
    const tx = fattest.x, ty = fattest.y;
    // canon: psychokinesis hits the target's Defense — re-mit the super's
    // special roll off def instead of spd (mit = 60/(60+stat))
    const bodyHit = (e: Unit, power: number) => Math.round((bumpDmg(e, power) * (60 + e.def.stats.spd)) / (60 + e.def.stats.def));
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.psychic, { r: 90, n: 14, life: 0.45 });
          screenLines(ctx.fx, ctx.fxRng, tx, ty, '#f85888', { n: 12, inward: true });
        }, sfx: 'warn',
      },
      {
        t: 0.45, run: () => {
          ctx.waves.push({
            x: tx, y: ty, r: 0, maxR: 280, t: 0.55, life: 0.55, color: '#f85888', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bodyHit(e, e === fattest ? 2.4 : 1.0), '#f8b8d0'),
          });
          impactRing(ctx.fx, ctx.fxRng, tx, ty, '#f85888', { radius: 80, life: 0.4 });
        }, stop: 0.28, shake: 14, punch: 0.14, flash: ['#f85888', 0.24], sfx: 'boom',
      },
      {
        t: 0.85, run: () => { // the echo — the shockwave folds back on itself
          ctx.waves.push({
            x: tx, y: ty, r: 0, maxR: 200, t: 0.45, life: 0.45, color: '#ff98c0', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bodyHit(e, e === fattest ? 0.9 : 0.5), '#ffe8f0'),
          });
          pixelExplosion(ctx.fx, ctx.fxRng, tx, ty, TYPE_RAMP.psychic, { scale: 1.1 });
        }, shake: 9, sfx: 'boom',
      },
    ]);
    return true;
  },
  'SACRED FIRE': ({ ctx, src, p, bumpDmg, far }) => { // the mystic fire arcs
    // slow and sure onto the far mark — the pillar it lands in keeps burning
    const land = 0.4 + dist(p, far) / 700;
    ctx.act([
      {
        t: 0, run: () => {
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 70, n: 12, life: 0.4 });
          aura(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.fire, { r: 22, n: 8 });
        }, sfx: 'warn',
      },
      {
        t: 0.4, run: () => {
          animBurst(recipeFor(src.def.type, 'SACRED FIRE'), p.x, p.y, false);
          ctx.orbs.push({ x: p.x, y: p.y, target: far, dmg: bumpDmg(far, 2.4), t: 3, wob: 0, color: '#f08030', spd: 700 });
        }, sfx: 'sizzle',
      },
      {
        t: land, run: () => { // the pillar of holy flame
          pillarSpout(ctx.fx, ctx.fxRng, far.x, far.y, TYPE_RAMP.fire, { h: 1.8, n: 16, spread: 30 });
          if (!far.dead) {
            far.dotTicks = Math.min(far.dotTicks + 3, 6); // canon half-chance burn, always lands here
            far.dotDmg = Math.max(far.dotDmg, Math.ceil(far.maxHp * 0.08));
          }
        }, shake: 10, flash: ['#f08030', 0.2], sfx: 'boom',
      },
    ]);
    return true;
  },
  'AEROBLAST': ({ ctx, p, far, lineBlast }) => { // a vortex of air the size of
    // the court — one screaming lane that hurls everything it spears skyward
    ctx.act([
      {
        t: 0, run: () => { // the gale gathers — wind streaks converge on the caster
          for (let i = 0; i < 12; i++) pushFx(ctx, {
            x: p.x + (ctx.fxRng() - 0.5) * 300, y: p.y + (ctx.fxRng() - 0.5) * 200,
            vx: (p.x < 270 ? 1 : -1) * (260 + ctx.fxRng() * 200), vy: -30 - ctx.fxRng() * 60,
            t: 0.4, life: 0.4, size: 1.6 + ctx.fxRng() * 1.6,
            color: ctx.fxRng() < 0.4 ? '#ffffff' : '#d0c0ff', shape: 'streak', spin: 0, grav: 0,
          });
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.flying, { r: 80, n: 12, life: 0.4 });
        }, sfx: 'gust',
      },
      {
        t: 0.42, run: () => lineBlast(far, '#d0c0ff', 34, 2.4, 2.6, (e) => {
          if (!e.dead) { e.vy -= 260; e.vx += (ctx.rng() - 0.5) * 140; } // the vortex flings them
        }),
      },
      {
        t: 0.7, run: () => { // the wake — wind shear howls down the lane
          const d = norm({ x: far.x - p.x, y: far.y - p.y });
          for (let t = 90; t < 600; t += 85)
            screenLines(ctx.fx, ctx.fxRng, p.x + d.x * t, p.y + d.y * t, '#f0eaff', { n: 3 });
        }, sfx: 'gust',
      },
    ]);
    return true;
  },
  'DOOM DESIRE': ({ ctx, bumpDmg, fattest }) => { // a wish pinned on the
    // biggest mark — the star burns over it a breath, then countless rays
    // of light answer all at once
    const tx = fattest.x, ty = fattest.y;
    ctx.waves.push({ x: tx, y: ty, r: 0, maxR: 200, t: 1.2, life: 1.2, color: '#fff0a8', hits: new Set() });
    chargeMotes(ctx.fx, ctx.fxRng, tx, ty, ['#b8a038', '#fff0a8', '#ffffff'], { r: 120, n: 14, life: 1.1 });
    ctx.pushText({ x: tx, y: ty - 120, text: 'A WISH ANSWERS', t: 1.2, color: '#fff0a8', big: true });
    sfx('warn');
    ctx.later(1.2, () => {
      ctx.screenFlash('#fff0a8', 0.3);
      pixelExplosion(ctx.fx, ctx.fxRng, tx, ty, ['#b8a038', '#fff0a8', '#ffffff'], { scale: 1.8 });
      for (let i = -1; i <= 1; i++) // the rays rain from every direction
        ctx.beams.push({ x1: tx + i * 120, y1: ty - 420, x2: tx, y2: ty, t: 0.3, life: 0.3, color: '#fff0a8', w: 4 });
      ctx.scar(tx, ty, 44);
      ctx.hitStop = Math.max(ctx.hitStop, 0.34);
      ctx.addPunch(0.18);
      ctx.addShake(16);
      for (const e of ctx.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
        if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 200 + e.r) continue;
        ctx.hurt(e, bumpDmg(e, e === fattest ? 2.6 : 1.4), '#fff8d0');
      }
      sfx('boom');
    });
    return true;
  },
  'DRAGON ASCENT': ({ ctx, p, bumpDmg, far }) => { // the sky renders — the
    // caster screams off the court and dives the far mark from the ceiling,
    // a green streak the whole way down
    const d = norm({ x: far.x - p.x, y: far.y - p.y });
    ctx.act([
      {
        t: 0, run: () => {
          p.sq = 1;
          screenLines(ctx.fx, ctx.fxRng, p.x, p.y, '#a890f0', { n: 14 });
          chargeMotes(ctx.fx, ctx.fxRng, p.x, p.y, TYPE_RAMP.flying, { r: 80, n: 12, life: 0.4 });
        }, sfx: 'warn',
      },
      {
        t: 0.4, run: () => { // liftoff — the court blurs under it
          ctx.burst(p.x, p.y, '#a890f0', 18, 620);
          ctx.dashes.push({ u: p, e: far, done: false, dmg: bumpDmg(far, 2.6) });
        }, sfx: 'launch',
      },
      {
        t: 0.45 + dist(p, far) / 1100, run: () => { // the dive lands — a streak from the ceiling
          ctx.beams.push({ x1: far.x - d.x * 300, y1: far.y - d.y * 300 - 120, x2: far.x, y2: far.y, t: 0.3, life: 0.3, color: '#a890f0', w: 6 });
          pixelExplosion(ctx.fx, ctx.fxRng, far.x, far.y, TYPE_RAMP.flying, { scale: 1.6 });
          ctx.waves.push({
            x: far.x, y: far.y, r: 0, maxR: 250, t: 0.5, life: 0.5, color: '#a890f0', hits: new Set(),
            onHit: (e) => ctx.hurt(e, bumpDmg(e, 0.8), '#e0c8ff'),
          });
          ctx.scar(far.x, far.y, 36);
        }, stop: 0.34, shake: 17, punch: 0.2, flash: ['#d0c0ff', 0.28], sfx: 'boom',
      },
    ]);
    return true;
  },
  'GLACIATE': ({ ctx, p, bumpDmg }) => { // Kyurem's freezing wind — a gale
    // crawls the whole court; everything it sweeps chips and slows to a crawl
    ctx.act([
      {
        t: 0, run: () => { // the gale fronts in — long pale streaks sweep overhead
          for (let i = 0; i < 16; i++) pushFx(ctx, {
            x: p.x + (ctx.fxRng() - 0.5) * 700, y: p.y - 260 + ctx.fxRng() * 160,
            vx: 300 + ctx.fxRng() * 260, vy: 40 + ctx.fxRng() * 60,
            t: 0.4 + ctx.fxRng() * 0.3, life: 0.7, size: 2 + ctx.fxRng() * 2,
            color: ctx.fxRng() < 0.4 ? '#ffffff' : '#d8f0f8', shape: 'streak', spin: 0, grav: 0,
          });
        }, sfx: 'gust',
      },
      {
        t: 0.4, run: () => {
          ctx.waves.push({
            x: p.x, y: p.y, r: 0, maxR: 900, t: 0.7, life: 0.7, color: '#98d8d8', hits: new Set(),
            onHit: (e) => {
              ctx.hurt(e, bumpDmg(e, 1.2), '#d8f0f8');
              if (!e.dead) e.timer += 0.9; // chilled to the bone
            },
          });
        }, shake: 10, punch: 0.08, flash: ['#98d8d8', 0.18], sfx: 'wave',
      },
    ]);
    return true;
  },
};

// Dispatch a named signature: wrap the damage roll in the cast anim,
// snapshot the targets, build the ray helper, then the table decides.
// Returns false for a name the table doesn't know (the type super runs
// instead). METRONOME re-enters here with its rolled pick — bumpDmg gets
// re-wrapped, exactly like the old recursive castSignature call.
export function castNamedSuper(ctx: SuperCtx, name: string, src: Unit, p: Unit, bumpDmg: BumpDmg): boolean {
  const foes = ctx.enemies.filter((e) => !e.dead);
  if (!foes.length) return false;
  const far = farthest(foes, p);
  const fattest = foes.slice().sort((a, b) => b.maxHp - a.maxHp)[0];
  const damage = bumpDmg;
  bumpDmg = (e, power) => { animBurst(recipeFor(src.def.type, name), e.x, e.y, false); return damage(e, power); };
  const lineBlast: LineBlast = (to, color, halfW, power, w, onHit) => {
    animBeam(recipeFor(src.def.type, name), p.x, p.y, to.x, to.y);
    const d = norm({ x: to.x - p.x, y: to.y - p.y });
    halfW *= 1.4; // hit corridor tracks the fatter drawn beam
    ctx.beams.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 1400, y2: p.y + d.y * 1400, t: 0.6, life: 0.6, color, w });
    for (const e of foes) {
      const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
      if (t < 0) continue; // behind the caster
      const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
      if (Math.hypot(dx, dy) < halfW + e.r) {
        ctx.hurt(e, bumpDmg(e, power), '#ffffff');
        onHit?.(e);
      }
    }
    ctx.screenFlash(color, 0.3);
    ctx.hitStop = Math.max(ctx.hitStop, 0.42);
    ctx.addPunch(0.22);
    ctx.addShake(18);
    sfx('beam');
    buzz([40, 30, 60]);
  };
  return SIGNATURES[name]?.({ ctx, src, p, bumpDmg, foes, far, fattest, lineBlast }) ?? false;
}
