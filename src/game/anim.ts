/* Gen 3 compositions, adapted to <=0.6s rather than full cartridge cutscenes.
 * Source: pret/pokeemerald data/battle_anim_scripts.s and
 * graphics/battle_anims/sprites; same vendored-art footing as FRLG fronts.
 * Thunderbolt: shock_3 (3 frames), spark_0 (8); bolts 7/7/9 ticks apart.
 * Flamethrower: small_ember (5); 16-tick flights, emission every 2 ticks.
 * Surf: scrolling wave background, sound at tick 24; splash (1) substitute.
 * Solar Beam: orbs (3), 20-tick flights at 4-tick intervals after absorption.
 * Hyper Beam: same orbs, pairs every tick with red palette flashes.
 * Psybeam: gold_ring (2), 13-tick flights at 4-tick intervals.
 * Night Shade: background + 85-tick mon clone; shadow_ball (1) substitute.
 * Shadow Ball: shadow_ball (1), travelling orb then 8-tick shake.
 * Earthquake: 50-tick horizontal shake, flashes at 10/26; flying_dirt (1).
 * Rock Slide: rocks (6 variants), falls every 2 ticks, repeated volleys.
 * Gust: gust (2), 70-tick palette tornado then impact (1).
 * Twister: leaves/rocks spiral for 100-120 ticks; Gust stands in for wind.
 * Sludge Bomb: poison_bubble (3), ten shots every 3 ticks then splatter.
 * Ice Beam: ice_crystals_0 (1), outer/inner streams every tick, 11/20 flight.
 * Focus Punch: fist then impact at 10/18/26/34 ticks; punch_impact (1).
 * Generic hit: impact (1), brief expanding hitsplat. All ticks are 1/60s.
 * spark_0 and ice_crystals_0 bake their separate spark/ice_crystals palettes.
 */
import type { PokeType } from './types';
import { TYPE_COLOR } from './types';

interface Sheet { src: string; fw: number; fh: number; frames: number; image?: HTMLImageElement }
function sheet(name: string, fw: number, fh: number, frames: number): Sheet {
  return { src: `sprites/anims/${name}.png`, fw, fh, frames };
}
export const SHEETS = {
  ember: sheet('small_ember', 32, 32, 5), water: sheet('splash', 64, 64, 1),
  orb: sheet('orbs', 16, 16, 3), ring: sheet('gold_ring', 16, 16, 2),
  bolt: sheet('shock_3', 32, 32, 3), spark: sheet('spark_0', 8, 8, 8),
  rock: sheet('rocks', 32, 32, 6), poison: sheet('poison_bubble', 16, 16, 3),
  wind: sheet('gust', 32, 32, 2), fist: sheet('punch_impact', 32, 32, 1),
  impact: sheet('impact', 32, 32, 1), ghost: sheet('shadow_ball', 32, 32, 1),
  dirt: sheet('flying_dirt', 32, 32, 1), ice: sheet('ice_crystals_0', 16, 16, 1),
};
export type SheetName = keyof typeof SHEETS;
export const MAX_ANIMS = 24, SOFT_CAP = 18;
interface Instance {
  sheet: SheetName; x: number; y: number; vx: number; vy: number; ax: number; ay: number;
  scale0: number; scale1: number; alpha0: number; alpha1: number; rotation: number;
  spin: number; fps: number; loop: boolean; delay: number; life: number; t: number;
  flipX: boolean; additive: boolean; alive: boolean;
}
const pool: Instance[] = Array.from({ length: MAX_ANIMS }, () => ({
  sheet: 'impact', x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, scale0: 2, scale1: 2,
  alpha0: 1, alpha1: 0, rotation: 0, spin: 0, fps: 20, loop: false, delay: 0,
  life: 0.3, t: 0, flipX: false, additive: false, alive: false,
}));
let live = 0;
export let animShake = 0;
export const animFlash = { color: '', duration: 0 };
const drained = { shake: 0, color: '', duration: 0 };
export function drainAnimRequests(): Readonly<typeof drained> {
  drained.shake = animShake; drained.color = animFlash.color; drained.duration = animFlash.duration;
  animShake = 0; animFlash.color = ''; animFlash.duration = 0;
  return drained;
}
export function animCount(): number { return live; }
export function clearAnims(): void {
  for (const a of pool) a.alive = false;
  live = 0; animShake = 0; animFlash.color = ''; animFlash.duration = 0;
}
export function spawnAnim(name: SheetName, x: number, y: number, vx = 0, vy = 0,
  scale0 = 2, scale1 = scale0, alpha0 = 1, alpha1 = 0, rotation = 0, spin = 0,
  fps = 20, loop = false, delay = 0, life = 0.3, flipX = false, additive = false,
  particle = false, ax = 0, ay = 0): boolean {
  if (live >= (particle ? SOFT_CAP : MAX_ANIMS) || life <= 0 || delay < 0) return false;
  for (const a of pool) if (!a.alive) {
    a.sheet = name; a.x = x; a.y = y; a.vx = vx; a.vy = vy; a.ax = ax; a.ay = ay;
    a.scale0 = scale0; a.scale1 = scale1; a.alpha0 = alpha0; a.alpha1 = alpha1;
    a.rotation = rotation; a.spin = spin; a.fps = fps; a.loop = loop; a.delay = delay;
    a.life = life; a.t = 0; a.flipX = flipX; a.additive = additive; a.alive = true;
    live++; return true;
  }
  return false;
}
export function stepAnims(dt: number): void {
  if (dt <= 0) return;
  for (const a of pool) if (a.alive) {
    const before = Math.max(0, a.t - a.delay);
    a.t += dt;
    const age = a.t - a.delay;
    if (age >= a.life) { a.alive = false; live--; continue; }
    if (age <= 0) continue;
    const active = age - before;
    a.x += a.vx * active + a.ax * active * active / 2;
    a.y += a.vy * active + a.ay * active * active / 2;
    a.vx += a.ax * active; a.vy += a.ay * active; a.rotation += a.spin * active;
  }
}
function imageFor(s: Sheet): HTMLImageElement | undefined {
  if (!s.image && typeof Image !== 'undefined') { s.image = new Image(); s.image.src = s.src; }
  return s.image?.complete && s.image.naturalWidth > 0 ? s.image : undefined;
}
function drawFrame(ctx: CanvasRenderingContext2D, name: SheetName, frame: number,
  x: number, y: number, scale: number, alpha: number, rotation = 0, flip = false, additive = false): void {
  const s = SHEETS[name], img = imageFor(s);
  if (!img) return;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
  ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rotation); ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(img, 0, frame * s.fh, s.fw, s.fh, -s.fw / 2, -s.fh / 2, s.fw, s.fh);
  ctx.restore();
}
export function drawAnims(ctx: CanvasRenderingContext2D): void {
  for (const a of pool) if (a.alive && a.t >= a.delay) {
    const age = a.t - a.delay, p = age / a.life, s = SHEETS[a.sheet];
    const frame = a.loop ? Math.floor(age * a.fps) % s.frames : Math.min(s.frames - 1, Math.floor(age * a.fps));
    drawFrame(ctx, a.sheet, frame, a.x, a.y, a.scale0 + (a.scale1 - a.scale0) * p,
      a.alpha0 + (a.alpha1 - a.alpha0) * p, a.rotation, a.flipX, a.additive);
  }
}
export interface Recipe { sheet: SheetName; hit: SheetName; color: string; style: 'stream' | 'bolt'; shake: number }
function recipe(sheet: SheetName, hit: SheetName, type: PokeType, shake = 4, style: Recipe['style'] = 'stream'): Recipe {
  return { sheet, hit, color: TYPE_COLOR[type], style, shake };
}
export const MOVE_ANIM: Record<PokeType, Recipe> = {
  normal: recipe('orb', 'impact', 'normal'), fire: recipe('ember', 'ember', 'fire'),
  water: recipe('water', 'water', 'water'), grass: recipe('orb', 'orb', 'grass'),
  electric: recipe('bolt', 'spark', 'electric', 7, 'bolt'), psychic: recipe('ring', 'ring', 'psychic'),
  rock: recipe('rock', 'dirt', 'rock', 8), poison: recipe('poison', 'poison', 'poison'),
  flying: recipe('wind', 'wind', 'flying'), fighting: recipe('fist', 'impact', 'fighting', 7),
  ghost: recipe('ghost', 'ghost', 'ghost'),
};
const overrides: Record<string, Recipe | undefined> = {
  'HYPER BEAM': MOVE_ANIM.normal, 'ICE BEAM': recipe('ice', 'ice', 'water'),
  'SHADOW BALL': MOVE_ANIM.ghost, 'EARTHQUAKE': recipe('dirt', 'dirt', 'rock', 10),
  'SOLAR BEAM': MOVE_ANIM.grass, 'PSYBEAM': MOVE_ANIM.psychic,
  'SLUDGE BOMB': MOVE_ANIM.poison, 'FOCUS PUNCH': MOVE_ANIM.fighting,
};
export function recipeFor(type: PokeType, move?: string): Recipe {
  return (move && Object.hasOwn(overrides, move) && overrides[move]) || MOVE_ANIM[type];
}
function request(r: Recipe): void {
  animShake = Math.max(animShake, r.shake); animFlash.color = r.color; animFlash.duration = 0.08;
}
export function beam(r: Recipe, x1: number, y1: number, x2: number, y2: number): void {
  request(r);
  if (r.style === 'bolt') {
    for (let i = 0; i < 3; i++) spawnAnim(r.sheet, x2 + (i - 1) * 24, y2 - 80, 0, 320,
      3, 2, 1, 0, 0, 0, 18, false, i * 0.07, 0.25);
    spawnAnim(r.hit, x2, y2, 0, 0, 3, 5, 1, 0, 0, 0, 24, true, 0.15, 0.3);
    return;
  }
  const dx = x2 - x1, dy = y2 - y1, angle = Math.atan2(dy, dx);
  for (let i = 0; i < 8; i++) spawnAnim(r.sheet, x1, y1, dx / 0.28, dy / 0.28,
    2, 3, 0.9, 0.3, angle, 0, 22, true, i * 0.035, 0.28);
}
export function burst(r: Recipe, x: number, y: number, big: boolean): void {
  request(r);
  spawnAnim(r.hit, x, y, 0, 0, big ? 3 : 2, big ? 5 : 3, 1, 0, 0, 0, 24, false, 0, 0.32);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    spawnAnim(r.sheet, x, y, Math.cos(a) * 110, Math.sin(a) * 110, 2, 1, 0.8, 0,
      a, 2, 20, true, 0.02, 0.36, false, false, true);
  }
}
export function rain(r: Recipe, x: number, y: number): void {
  request(r);
  for (let i = 0; i < 5; i++) spawnAnim(r.sheet, x + (i - 2) * 20, y - 100,
    0, 220, 2, 2, 1, 0.2, i, 2, 16, true, i * 0.04, 0.4, false, false, i > 0, 0, 150);
  spawnAnim(r.hit, x, y, 0, 0, 2, 4, 0.9, 0, 0, 0, 20, false, 0.3, 0.28);
}
export function ring(r: Recipe, x: number, y: number, R: number): void {
  request(r);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, dx = Math.cos(a), dy = Math.sin(a);
    spawnAnim(r.sheet, x + dx * R * 0.6, y + dy * R * 0.6, dx * R, dy * R,
      2, 3, 0.85, 0, a, 1, 20, true, i % 3 * 0.03, 0.45, false, false, i > 0);
  }
}
export function drawTell(ctx: CanvasRenderingContext2D, type: PokeType,
  x1: number, y1: number, x2: number, y2: number, time: number): void {
  const name = MOVE_ANIM[type].sheet, frame = Math.floor(Math.abs(time) * 10) % SHEETS[name].frames;
  for (let i = 1; i <= 4; i++) drawFrame(ctx, name, frame,
    x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5, 2, 0.12 + 0.06 * Math.sin(time * 8 + i));
}
export function drawTellRing(ctx: CanvasRenderingContext2D, type: PokeType,
  x: number, y: number, R: number, time: number): void {
  const name = MOVE_ANIM[type].sheet, frame = Math.floor(Math.abs(time) * 10) % SHEETS[name].frames;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    drawFrame(ctx, name, frame, x + Math.cos(a) * R, y + Math.sin(a) * R,
      2, 0.12 + 0.06 * Math.sin(time * 8 + i));
  }
}
