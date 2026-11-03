/* Code-drawn pixel VFX runtime — the juice layer of the pixel-fx overhaul
 * (docs/superpowers/specs/2026-11-03-pixel-fx-overhaul.md). One shared
 * particle record (Fx), one step + one additive draw pass, per-type
 * dark→bright ramps, chunky effect primitives that only push Fx, and the
 * `act` beat-list choreographer (wind-up → contact → recovery). Pure
 * helpers: the caller owns the array and the rng, so seeded runs replay.
 */
import { sfx, type Sfx } from '../core/audio';
import { settings } from './meta';
import { TYPE_COLOR } from './types';
import type { PokeType } from './types';

const TAU = Math.PI * 2;
export const FX_MAX = 260; // pooled cap — oldest sparks yield first
export type FxRamp = string | string[]; // a flat color or a TYPE_RAMP walk
export type FxShape = 'dot' | 'streak' | 'star' | 'leaf' | 'shard' | 'ring' | 'slash' | 'smoke' | 'sparkle';

// One-shot anime particle: spark dots, velocity streaks and four-point
// stars — plus debris shards, hollow rings, crescent slashes, unlit smoke
// puffs and glints. Drawn additively so stacked hits read as real glow;
// smoke draws dim under the bloom pass so it never whites out.
export interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
  shape: FxShape;
  spin: number; // star/leaf/shard rotation rate — doubles as the sway phase
  grav: number; // debris pulls down; sparks/stars fly straight
  sway?: number; // horizontal wobble amplitude — leaves, embers, bubbles
  rot?: number; // resting angle — shard tumble, slash orientation
  arc?: number; // slash sweep length, radians
  width?: number; // ring/slash stroke px
  seed?: number; // per-particle variant pick (shard silhouette)
}

// flat pick across a ramp — primitives compose their own bias on top
export const pickRamp = (r: FxRamp, rng: () => number): string =>
  Array.isArray(r) ? r[Math.min(r.length - 1, Math.floor(rng() * r.length))] : r;

const capFx = (fx: Fx[]) => {
  if (fx.length > FX_MAX) fx.splice(0, fx.length - FX_MAX);
};

// four-point star: an 8-vertex polygon pinching at `pinch` of the radius —
// the weak-point marker and the spark particle share the shape
export const starPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pinch: number) => {
  const k = s * pinch;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + k, y + k);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - k, y + k);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - k, y - k);
  ctx.closePath();
};

// prebuilt unit-radius star paths — the shiny twinkle, weak marker and
// spark stars fill() a Path2D instead of re-pathing 8 vertices per frame.
// Pinches seen below: 0.4 (markers) and 0.28 (spark particles)
const mkStar = (pinch: number): Path2D | null => {
  if (typeof Path2D === 'undefined') return null;
  const p = new Path2D();
  p.moveTo(0, -1);
  p.lineTo(pinch, -pinch);
  p.lineTo(1, 0);
  p.lineTo(pinch, pinch);
  p.lineTo(0, 1);
  p.lineTo(-pinch, pinch);
  p.lineTo(-1, 0);
  p.lineTo(-pinch, -pinch);
  p.closePath();
  return p;
};
export const STAR_4 = mkStar(0.4);
export const STAR_28 = mkStar(0.28);

export function stepFx(fx: Fx[], dt: number, time: number): void {
  for (const f of fx) {
    f.t -= dt;
    const damp = Math.exp(-3.2 * dt);
    f.vx *= damp;
    f.vy *= damp;
    f.vy += f.grav * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.sway) f.x += Math.sin(time * 6 + f.spin * 7) * f.sway * dt;
  }
  let w = 0;
  for (let i = 0; i < fx.length; i++) if (fx[i].t > 0) { if (w !== i) fx[w] = fx[i]; w++; }
  fx.length = w;
}

export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx[]): void {
  if (!fx.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  // smoke stays unlit under the glow pass — a grey puff must not bloom
  for (const f of fx) {
    if (f.shape !== 'smoke') continue;
    const a = Math.max(f.t / f.life, 0);
    ctx.globalAlpha = a * 0.3;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(Math.round(f.x), Math.round(f.y), Math.max(0.5, f.size * (1.5 - a * 0.7)), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const f of fx) {
    if (f.shape === 'smoke') continue;
    const a = Math.max(f.t / f.life, 0);
    ctx.globalAlpha = a;
    if (f.shape === 'streak') {
      const s = Math.hypot(f.vx, f.vy);
      const nx = s > 1 ? f.vx / s : 1, ny = s > 1 ? f.vy / s : 0;
      const L = f.size * 4 * (0.4 + a);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(0.8, f.size * 0.55 * a);
      ctx.beginPath();
      ctx.moveTo(f.x - nx * L, f.y - ny * L);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
    } else if (f.shape === 'star') {
      const s = f.size * (0.5 + a * 0.9);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.spin * (f.life - f.t));
      ctx.scale(s, s);
      ctx.fillStyle = f.color;
      if (STAR_28) ctx.fill(STAR_28);
      else {
        starPath(ctx, 0, 0, 1, 0.28);
        ctx.fill();
      }
      ctx.restore();
    } else if (f.shape === 'leaf') {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.spin * (f.life - f.t) * 2);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size * 1.7, f.size * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (f.shape === 'shard') { // tumbling debris chip
      const s = f.size;
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(f.y));
      ctx.rotate((f.rot ?? 0) + f.spin * (f.life - f.t));
      ctx.fillStyle = f.color;
      ctx.beginPath();
      if ((f.seed ?? 0) < 0.5) {
        ctx.moveTo(s, 0); ctx.lineTo(-s * 0.8, s * 0.6); ctx.lineTo(-s * 0.5, -s * 0.9);
      } else {
        ctx.moveTo(s * 0.9, -s * 0.4); ctx.lineTo(s * 0.3, s * 0.9); ctx.lineTo(-s * 0.9, s * 0.3); ctx.lineTo(-s * 0.4, -s);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (f.shape === 'ring') { // hollow bloom — the radius rides the life fraction
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(0.8, (f.width ?? 3) * a);
      ctx.beginPath();
      ctx.arc(Math.round(f.x), Math.round(f.y), Math.max(0.5, f.size * (1 - a * a)), 0, TAU);
      ctx.stroke();
    } else if (f.shape === 'slash') { // crescent swipe
      const rot = (f.rot ?? 0) + f.spin * (f.life - f.t);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(0.8, (f.width ?? 4) * a);
      ctx.beginPath();
      ctx.arc(Math.round(f.x), Math.round(f.y), Math.max(0.5, f.size), rot, rot + (f.arc ?? 2));
      ctx.stroke();
    } else if (f.shape === 'sparkle') { // 4-point glint — swells then winks out
      const s = f.size * Math.sin(Math.PI * Math.min(1, 1 - a));
      if (s > 0.2) {
        ctx.save();
        ctx.translate(Math.round(f.x), Math.round(f.y));
        ctx.rotate((f.rot ?? 0) + f.spin * (f.life - f.t));
        ctx.scale(s, s);
        ctx.fillStyle = f.color;
        starPath(ctx, 0, 0, 1, 0.16);
        ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (0.5 + a * 0.6), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// dark→bright palettes tuned off TYPE_COLOR — ramped bursts and the
// primitives walk these so an element reads as a gradient, not a flat fill
export const TYPE_RAMP: Record<PokeType, string[]> = {
  normal: ['#585840', '#a8a878', '#e0e0b0', '#f8f8e0'],
  fire: ['#a83808', '#f08030', '#ffc040', '#fff0b0'],
  water: ['#2848a0', '#6890f0', '#a8d0ff', '#e8f8ff'],
  grass: ['#307028', '#78c850', '#b8f088', '#eaffd0'],
  electric: ['#a88010', '#f8d030', '#ffee80', '#fffde8'],
  psychic: ['#982048', '#f85888', '#ff98c0', '#ffe8f0'],
  rock: ['#685818', '#b8a038', '#e8d078', '#faf0c8'],
  poison: ['#582068', '#a040a0', '#d880e0', '#f8d8f8'],
  flying: ['#5848a0', '#a890f0', '#d0c0ff', '#f0eaff'],
  fighting: ['#701410', '#c03028', '#f06858', '#ffd0b8'],
  ghost: ['#382858', '#705898', '#a890d8', '#e8e0f8'],
};

// Anime shrapnel: velocity streaks, glow dots and a few stars exploding
// off a point — the workhorse every impact routes through. A `ramp`
// blooms dark→bright instead of one flat color: faster shrapnel burns hot.
export function burst(fx: Fx[], rng: () => number, x: number, y: number,
  color: string, n = 10, speed = 340, size = 1, ramp?: string[]): void {
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const sp = speed * (0.3 + rng());
    const kind = rng();
    const heat = ramp ? Math.min(ramp.length - 1, Math.floor((sp / speed) * ramp.length)) : -1;
    fx.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      t: 0.3 + rng() * 0.4,
      life: 0.7,
      size: (1.6 + rng() * 2.8) * size,
      color: kind < 0.2 ? '#ffffff' : heat >= 0 ? ramp![heat] : color,
      shape: kind < 0.55 ? 'streak' : kind < 0.88 ? 'dot' : 'star',
      spin: (rng() - 0.5) * 14,
      grav: kind < 0.5 ? 560 : 0,
    });
  }
  capFx(fx);
}

// The white-hot flash frame anime hits open with: a big white star plus
// a colored one spinning out under it, then shards on top.
export function impact(fx: Fx[], rng: () => number, x: number, y: number, color: string, scale = 1): void {
  fx.push(
    { x, y, vx: 0, vy: 0, t: 0.16, life: 0.16, size: 30 * scale, color: '#ffffff', shape: 'star', spin: 0, grav: 0 },
    { x, y, vx: 0, vy: 0, t: 0.32, life: 0.32, size: 17 * scale, color, shape: 'star', spin: 3, grav: 0 },
  );
  burst(fx, rng, x, y, color, Math.round(8 * scale) + 4, 400 * Math.sqrt(scale), scale);
}

// Cast motes keyed to the super's element — embers climb for fire,
// leaves flutter for grass, debris flies for rock. One call dresses
// every bump super in its own type instead of the same generic burst.
export function flavor(fx: Fx[], rng: () => number, x: number, y: number, type: PokeType): void {
  const c = TYPE_COLOR[type];
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU;
    const sp = 90 + rng() * 220;
    const f: Fx = {
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      t: 0.4 + rng() * 0.5,
      life: 0.9,
      size: 1.4 + rng() * 2.4,
      color: c,
      shape: 'dot',
      spin: (rng() - 0.5) * 10,
      grav: 0,
    };
    switch (type) {
      case 'fire': f.vy = -Math.abs(f.vy) - 60; f.grav = -300; f.sway = 24; break;
      case 'water': f.vy = -Math.abs(f.vy) * 0.7; f.grav = -160; f.sway = 40; f.color = rng() < 0.5 ? '#bfe8ff' : c; break;
      case 'grass': f.shape = 'leaf'; f.grav = 90; f.sway = 60; f.vx *= 0.5; f.vy = Math.abs(f.vy) * 0.4 - 40; break;
      case 'electric': f.shape = 'streak'; f.vx *= 1.8; f.vy *= 1.8; f.color = rng() < 0.4 ? '#ffffff' : '#f8d030'; break;
      case 'psychic': f.shape = 'star'; f.vx *= 0.4; f.vy = -Math.abs(f.vy) * 0.5 - 30; f.sway = 50; break;
      case 'flying': { // gale streaks swirl tangentially off the cast
        f.shape = 'streak';
        const ta = a + Math.PI / 2;
        const ts = 240 + rng() * 260;
        f.vx = Math.cos(ta) * ts;
        f.vy = Math.sin(ta) * ts;
        f.color = '#e8f6ff';
        break;
      }
      case 'poison': f.vy = Math.abs(f.vy) * 0.4 + 60; f.grav = 420; break; // drips fall
      case 'rock':
      case 'fighting': f.shape = 'shard'; f.grav = 640; f.vy = -Math.abs(f.vy) * 0.8; f.color = rng() < 0.5 ? '#c8b090' : c; f.seed = rng(); break; // debris chips
      case 'ghost': f.vy = -Math.abs(f.vy) * 0.4 - 20; f.grav = -60; f.sway = 34; f.size *= 1.5; f.t *= 1.4; f.life = 1.3; break;
      default: f.shape = 'streak'; f.vx *= 2.2; f.vy *= 2.2; f.color = '#ffffff'; break; // normal speed lines
    }
    fx.push(f);
  }
  capFx(fx);
}

// A crescent cut: a colored sweep with a white-hot inner arc and chips
// flung off the cut line — the melee-contact sticker.
export function slashArc(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { angle?: number; radius?: number; arc?: number; width?: number } = {}): void {
  const ang = opts.angle ?? rng() * TAU, R = opts.radius ?? 36, arc = opts.arc ?? 2.0;
  fx.push(
    { x, y, vx: 0, vy: 0, t: 0.3, life: 0.3, size: R, color: pickRamp(ramp, rng), shape: 'slash', spin: 2.2, grav: 0, rot: ang, arc, width: opts.width ?? 5 },
    { x, y, vx: 0, vy: 0, t: 0.2, life: 0.2, size: R * 0.78, color: '#ffffff', shape: 'slash', spin: 2.2, grav: 0, rot: ang + arc * 0.15, arc: arc * 0.7, width: 2.5 },
  );
  for (let i = 0; i < 3; i++) {
    const a = ang + arc * (0.25 + rng() * 0.5), sp = 90 + rng() * 120;
    fx.push({
      x: x + Math.cos(a) * R, y: y + Math.sin(a) * R,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0.28, life: 0.28, size: 1.6 + rng() * 2,
      color: pickRamp(ramp, rng), shape: 'shard', spin: (rng() - 0.5) * 18, grav: 380, seed: rng(),
    });
  }
  capFx(fx);
}

// Hollow ring bloom + white core — the "it landed" telegraph. The radius
// expands off the life fraction, so `radius` is the ring's final reach.
export function impactRing(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { radius?: number; width?: number; life?: number; motes?: number } = {}): void {
  const life = opts.life ?? 0.35;
  fx.push(
    { x, y, vx: 0, vy: 0, t: life, life, size: opts.radius ?? 48, color: pickRamp(ramp, rng), shape: 'ring', spin: 0, grav: 0, width: opts.width ?? 5 },
    { x, y, vx: 0, vy: 0, t: life * 0.45, life: life * 0.45, size: 10, color: '#ffffff', shape: 'dot', spin: 0, grav: 0 },
  );
  for (let i = 0; i < (opts.motes ?? 4); i++) {
    const a = rng() * TAU, sp = 160 + rng() * 180;
    fx.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0.3 + rng() * 0.2, life: 0.5, size: 1.4 + rng() * 1.6,
      color: rng() < 0.3 ? '#ffffff' : pickRamp(ramp, rng),
      shape: 'sparkle', spin: (rng() - 0.5) * 10, grav: 0,
    });
  }
  capFx(fx);
}

// Ground eruption: a column of hot streaks and dots shot skyward off a
// line, falling back under gravity, topped with element-tinted soot.
export function pillarSpout(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { h?: number; n?: number; spread?: number } = {}): void {
  const n = opts.n ?? 10, h = opts.h ?? 1, spread = opts.spread ?? 26;
  const soot = Array.isArray(ramp) ? ramp[0] : '#989898';
  for (let i = 0; i < n; i++) {
    fx.push({
      x: x + (rng() - 0.5) * spread, y,
      vx: (rng() - 0.5) * 50, vy: -(160 + rng() * 240) * h,
      t: 0.35 + rng() * 0.35, life: 0.7, size: 1.6 + rng() * 2.6,
      color: pickRamp(ramp, rng), shape: rng() < 0.45 ? 'streak' : 'dot',
      spin: (rng() - 0.5) * 10, grav: 720,
    });
  }
  for (let i = 0; i < 3; i++) {
    fx.push({
      x: x + (rng() - 0.5) * spread * 0.7, y: y - 4 - i * 5,
      vx: (rng() - 0.5) * 20, vy: -30 - rng() * 40,
      t: 0.6 + rng() * 0.4, life: 1, size: 5 + rng() * 5,
      color: soot, shape: 'smoke', spin: (rng() - 0.5) * 4, grav: -40, sway: 12,
    });
  }
  capFx(fx);
}

// Wind-up motes converging on the caster — velocities are solved against
// the step's damping so every mote lands dead-center as its t runs out.
export function chargeMotes(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { r?: number; n?: number; life?: number } = {}): void {
  const R = opts.r ?? 56, n = opts.n ?? 8, life = opts.life ?? 0.45;
  const k = 3.2 / (1 - Math.exp(-3.2 * life));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.7;
    const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
    fx.push({
      x: px, y: py,
      vx: (x - px) * k, vy: (y - py) * k,
      t: life, life, size: 1.4 + rng() * 1.6,
      color: rng() < 0.35 ? '#ffffff' : pickRamp(ramp, rng),
      shape: 'sparkle', spin: (rng() - 0.5) * 8, grav: 0,
    });
  }
  capFx(fx);
}

// Buff halo — slow motes orbiting the caster and lifting off, for power-up
// and heal beats.
export function aura(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { r?: number; n?: number; life?: number } = {}): void {
  const R = opts.r ?? 24, n = opts.n ?? 8, life = opts.life ?? 0.9;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    fx.push({
      x: x + Math.cos(a) * R, y: y + Math.sin(a) * R * 0.7,
      vx: -Math.sin(a) * (30 + rng() * 30), vy: -24 - rng() * 36,
      t: life * (0.6 + rng() * 0.4), life, size: 1.2 + rng() * 1.8,
      color: rng() < 0.3 ? '#ffffff' : pickRamp(ramp, rng),
      shape: rng() < 0.5 ? 'sparkle' : 'dot',
      spin: (rng() - 0.5) * 6, grav: -60, sway: 18,
    });
  }
  capFx(fx);
}

// Radial speed-line whoosh — inward=converge on the point (charge/dive
// tells), default sprays outward (dash, blast-off).
export function screenLines(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { n?: number; speed?: number; inward?: boolean } = {}): void {
  const n = opts.n ?? 10, sp = opts.speed ?? 520;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, v = sp * (0.6 + rng() * 0.8);
    const d = opts.inward ? -1 : 1;
    fx.push({
      x: opts.inward ? x + Math.cos(a) * 120 : x,
      y: opts.inward ? y + Math.sin(a) * 120 : y,
      vx: Math.cos(a) * v * d, vy: Math.sin(a) * v * d,
      t: 0.14 + rng() * 0.12, life: 0.26, size: 1.4 + rng() * 1.4,
      color: rng() < 0.3 ? '#ffffff' : pickRamp(ramp, rng),
      shape: 'streak', spin: 0, grav: 0,
    });
  }
  capFx(fx);
}

// The big boom: flash core + expanding ring + chunky shrapnel + soot —
// boss KOs and signature detonations.
export function pixelExplosion(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { scale?: number } = {}): void {
  const s = opts.scale ?? 1;
  impactRing(fx, rng, x, y, ramp, { radius: 54 * s, width: 5 * s });
  fx.push({ x, y, vx: 0, vy: 0, t: 0.14, life: 0.14, size: 30 * s, color: '#ffffff', shape: 'star', spin: 0, grav: 0 });
  for (let i = 0, n = Math.max(6, Math.round(16 * s)); i < n; i++) {
    const a = rng() * TAU, sp = (140 + rng() * 380) * s;
    fx.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      t: 0.4 + rng() * 0.5, life: 0.9, size: (1.8 + rng() * 3) * s,
      color: rng() < 0.25 ? '#ffffff' : pickRamp(ramp, rng),
      shape: rng() < 0.5 ? 'shard' : 'dot', spin: (rng() - 0.5) * 16, grav: 640, seed: rng(),
    });
  }
  smokeColumn(fx, rng, x, y, ramp, { n: 4 });
}

// A rising soot stack — aftermath, vents, burning ground. Tinted by the
// ramp's dark end when one is passed.
export function smokeColumn(fx: Fx[], rng: () => number, x: number, y: number, ramp: FxRamp,
  opts: { n?: number; spread?: number } = {}): void {
  const n = opts.n ?? 5, spread = opts.spread ?? 10;
  const soot = Array.isArray(ramp) ? ramp[0] : ramp;
  for (let i = 0; i < n; i++) {
    fx.push({
      x: x + (rng() - 0.5) * spread, y: y - i * 6 - rng() * 6,
      vx: (rng() - 0.5) * 16, vy: -26 - rng() * 34,
      t: 0.55 + rng() * 0.45 + i * 0.06, life: 1.1, size: 5 + rng() * 6,
      color: soot, shape: 'smoke', spin: (rng() - 0.5) * 4, grav: -36, sway: 14,
    });
  }
  capFx(fx);
}

// One beat in an act — t is seconds from the act() call. run() is the
// payoff (damage, spawns); stop/shake/punch/flash are the contact
// dressing; sfx is the beat's voice ([name, pitch] bends it).
export interface ActBeat {
  t: number;
  run?: () => void;
  stop?: number;
  shake?: number;
  punch?: number;
  flash?: [color: string, dur: number];
  sfx?: Sfx | [Sfx, number];
}

// What an act drives — battle wires later/hit-stop/shake/punch/flash in.
export interface ActHooks {
  later(t: number, fn: () => void): void;
  stop(n: number): void;
  shake(n: number): void;
  punch(n: number): void;
  flash(color: string, dur: number): void;
}

// Author a super as beats, not later() chains: wind-up tells on the early
// beats, the freeze+flash+shake stack on the contact beat, embers after.
// Beats fire in list order; a t<=0 beat lands this frame.
export function act(h: ActHooks, beats: ActBeat[]): void {
  for (const b of beats) {
    const fire = () => {
      b.run?.();
      if (b.stop) h.stop(b.stop);
      if (b.shake) h.shake(b.shake);
      if (b.punch) h.punch(b.punch);
      if (b.flash) h.flash(b.flash[0], settings().flash ? b.flash[1] : Math.min(b.flash[1], 0.06));
      if (b.sfx) { const s = b.sfx; Array.isArray(s) ? sfx(s[0], s[1]) : sfx(s); }
    };
    if (b.t <= 0) fire(); else h.later(b.t, fire);
  }
}
