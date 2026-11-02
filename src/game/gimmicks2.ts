// Two more MS stage gimmicks in Pokémon dress. A Pidgeot Whirlwind strip
// pushes the ball sideways while it is inside (MS wind zone). A Magnemite
// fence holds a Light Screen beam between two posts: it blocks and chips
// the ball until one post takes LASER_POST_HITS (MS barrier). Ice Path
// patches pause the MS shot-decay clock while the ball glides over them.
// Rocket Hideout spinner tiles snap the ball to their arrow with a speed
// kick (MS accel/redirect panels). Saffron Gym warp pads come in cross-court
// pairs: the ball steps on one and exits its partner (MS warp).
// Battle owns one Field2 per room, built by installField2 and stepped once
// per physics substep.
import type { SpeciesDef } from './data';
import { isGentleRoom, fieldRoomReachable } from './data';
import type { Theme } from './bg';
import { TYPE_COLOR, type PokeType } from './types';
import { drawMon } from '../core/assets';
import { sfx } from '../core/audio';
import { drawTile } from './map';
import { FX_LEAF, ROCK_SMALL, TILE_ICE, TILE_FLAGSTONE, TILE_STEEL_TRIM, type TileRect } from './maptiles';
import { fontB } from './ui';
import { fitFontB } from './screens';

export const WIND_ACCEL = 520; // px/s² sideways push while the ball sits in the strip
export const LASER_CHIP = 0.03; // share of max HP the beam takes per contact
export const LASER_HURT_CD = 0.35; // s between beam chips on the same ball
export const LASER_POST_HITS = 2; // ball hits that break a post and drop the beam
export const LASER_POST_R = 15; // px post body radius
export const LASER_BEAM_R = 4; // px beam half thickness
export const ICE_PAUSE_MAX = 0.75; // s of shot-decay clock one shot can bank gliding on ice
export const ICE_SKATE = 1.1; // speed kick for ice abilities entering a patch
export const SPIN_KICK = 1.15; // speed kick when a spinner tile redirects the ball
export const WARP_FLASH = 0.35; // s the Gen 3 teleport ring plays at both pads
const POST_HIT_CD = 0.12; // s, one contact counts once across substeps
const PIDGEOT = 18, MAGNEMITE = 81;
const SPIN_ARROW: TileRect = [1350, 702, 18, 9]; // Gen 3 gym-panel chevron, points down

export type Gimmick2Kind = 'wind' | 'laser' | 'ice' | 'spin' | 'warp';
export interface Gimmick2 { kind: Gimmick2Kind; label: string; type: PokeType; hint: string }
export const STAGE_GIMMICKS2: Partial<Record<Theme, Gimmick2>> = {
  sky: { kind: 'wind', label: 'WIND', type: 'flying', hint: 'FLYING/LEVITATE HELPS' },
  shore: { kind: 'wind', label: 'WIND', type: 'flying', hint: 'FLYING/LEVITATE HELPS' },
  plant: { kind: 'laser', label: 'LASER', type: 'electric', hint: 'ELECTRIC/VOLT ABSORB HELPS' },
  sanctum: { kind: 'laser', label: 'LASER', type: 'electric', hint: 'ELECTRIC/VOLT ABSORB HELPS' },
  cavern: { kind: 'ice', label: 'ICE PATH', type: 'water', hint: 'ICE ABILITIES SKATE · FIRE MELTS' },
  dojo: { kind: 'spin', label: 'SPINNER', type: 'psychic', hint: 'PSYCHIC/OWN TEMPO IGNORES' },
  tower: { kind: 'spin', label: 'SPINNER', type: 'psychic', hint: 'PSYCHIC/OWN TEMPO IGNORES' },
  marsh: { kind: 'warp', label: 'WARP', type: 'ghost', hint: 'GHOST PHASES THROUGH' },
};

type Def = Pick<SpeciesDef, 'type' | 'type2' | 'ability'>;
const typed = (d: Def, t: PokeType) => d.type === t || d.type2 === t;
export const ignoresWind = (d: Def) => typed(d, 'flying') || d.ability === 'levitate';
export const passesLaser = (d: Def) => typed(d, 'electric') || d.ability === 'volt-absorb';
export const ignoresSpin = (d: Def) => typed(d, 'psychic') || d.ability === 'own-tempo';
// the type chart has no Ice type, so the roster's ice-flavoured abilities skate
const SKATERS = new Set(['snow-cloak', 'ice-body', 'thick-fat']);
export const skatesIce = (d: Def) => SKATERS.has(d.ability);
export const meltsIce = (d: Def) => d.type === 'fire' || d.type2 === 'fire';
export const countersGimmick2 = (d: Def, g: Gimmick2) =>
  g.kind === 'wind' ? ignoresWind(d) : g.kind === 'laser' ? passesLaser(d) : g.kind === 'spin' ? ignoresSpin(d) : g.kind === 'warp' ? typed(d, 'ghost') : skatesIce(d);

interface Rect { x: number; y: number; w: number; h: number }
export interface Post { x: number; y: number; hp: number; t: number }
export interface IcePatch extends Rect { melt: number; skated: number } // shot index of the last melt / skate kick
export interface SpinTile extends Rect { dx: number; dy: number; used: number } // used = shot index of the last kick
export interface WarpPad extends Rect { pair: number; used: number } // used = shot index the pair last fired
export interface Field2 {
  warp: WarpPad[] | null;
  warpFx: { x: number; y: number; t: number }[];
  spin: SpinTile[] | null;
  ice: IcePatch[] | null;
  icePause: number; // clock seconds banked this shot
  iceShot: number;
  wind: { x0: number; x1: number; y0: number; y1: number; dir: 1 | -1 } | null;
  laser: { a: Post; b: Post; hurtT: number; down: boolean } | null;
  inWind: boolean;
}
export interface Field2Ball {
  uid: number; def: SpeciesDef; x: number; y: number; vx: number; vy: number; r: number; maxHp: number; dead: boolean;
}
export interface Field2Fx {
  hurt: (u: Field2Ball, dmg: number) => void;
  burst: (x: number, y: number, color: string) => void;
  notice: (u: Field2Ball) => void;
  shake: (amt: number) => void;
  live?: (u: Field2Ball) => boolean; // gauge.ts gate: is this ball's ability counter on right now
}

// Beam row + post columns: an open run of floor cells, mirror-symmetric,
// that still leaves P a lane to the door and every anchor with the beam
// treated as a wall. Rows mid-court first, wide fence first.
export function laserPlan(grid: string[], taken: Set<string> = new Set()): { row: number; col: number } | null {
  for (const row of [5, 6, 4, 3]) for (const col of [2, 3]) {
    const run = grid[row].slice(col, 9 - col);
    if (![...run].every((ch, i) => ch === '0' && !taken.has(`${col + i},${row}`))) continue;
    const walled = grid.map((line, r) => (r === row ? line.slice(0, col) + '2'.repeat(run.length) + line.slice(9 - col) : line));
    if (fieldRoomReachable(walled)) return { row, col };
  }
  return null;
}

// Ice patches: mirror-symmetric 2-row runs of open floor in the lower and
// upper mid court, skipping cells a room hazard already sits on.
export function icePlan(grid: string[], taken: Set<string> = new Set()): { c0: number; c1: number; r0: number }[] {
  const out: { c0: number; c1: number; r0: number }[] = [];
  for (const r0 of [6, 3]) {
    const cell = (c: number) => grid[r0][c] === '0' && grid[r0 + 1][c] === '0' && !taken.has(`${c},${r0}`) && !taken.has(`${c},${r0 + 1}`);
    const open = (c: number) => cell(c) && cell(8 - c); // mirror cell too, a few rooms seat anchors off-axis
    for (let c = 1; c <= 7; c++) {
      if (!open(c)) continue;
      let c1 = c;
      while (c1 < 7 && open(c1 + 1)) c1++;
      if (c1 > c) out.push({ c0: c, c1, r0 });
      c = c1;
    }
  }
  return out;
}

// Spinner tiles: one mirrored pair low (arrows up the court) and one high
// (arrows turning inward), on open floor no room hazard sits on.
export function spinPlan(grid: string[], taken: Set<string> = new Set()): { c: number; r: number; dx: number; dy: number }[] {
  const out: { c: number; r: number; dx: number; dy: number }[] = [];
  const open = (c: number, r: number) => grid[r][c] === '0' && !taken.has(`${c},${r}`);
  for (const r of [7, 3]) {
    const c = [1, 2, 3].find((k) => open(k, r) && open(8 - k, r));
    if (c === undefined) continue;
    if (r === 7) out.push({ c, r, dx: 0, dy: -1 }, { c: 8 - c, r, dx: 0, dy: -1 });
    else out.push({ c, r, dx: 1, dy: 0 }, { c: 8 - c, r, dx: -1, dy: 0 });
  }
  return out;
}

// Warp pads: four floor cells on two rows, mirror-symmetric; each pad's
// partner sits across the court on the other row, so a warp always crosses.
export function warpPlan(grid: string[], taken: Set<string> = new Set()): { c: number; r: number; pair: number }[] {
  const open = (c: number, r: number) => grid[r][c] === '0' && !taken.has(`${c},${r}`);
  for (const [lo, hi] of [[7, 3], [6, 4], [8, 2]]) {
    const c = [1, 2, 3].find((k) => open(k, lo) && open(8 - k, lo) && open(k, hi) && open(8 - k, hi));
    if (c !== undefined) return [{ c, r: lo, pair: 0 }, { c: 8 - c, r: hi, pair: 0 }, { c: 8 - c, r: lo, pair: 1 }, { c, r: hi, pair: 1 }];
  }
  return [];
}

export function installField2(grid: string[] | null, theme: Theme, a: Rect, battle: number, hazards: { nx: number; ny: number }[] = []): Field2 | null {
  const g = STAGE_GIMMICKS2[theme];
  if (!g || !grid || isGentleRoom(grid)) return null;
  const f: Field2 = { warp: null, warpFx: [], spin: null, ice: null, icePause: 0, iceShot: -1, wind: null, laser: null, inWind: false };
  const cw = a.w / 9, ch = a.h / 11;
  const taken = new Set(hazards.map((z) => `${Math.floor(z.nx * 9)},${Math.floor(z.ny * 11)}`));
  if (g.kind === 'warp') {
    const sz = Math.min(cw, ch);
    f.warp = warpPlan(grid, taken).map((p) => ({ x: a.x + cw * p.c + (cw - sz) / 2, y: a.y + ch * p.r + (ch - sz) / 2, w: sz, h: sz, pair: p.pair, used: -1 }));
    if (!f.warp.length) return null;
  } else if (g.kind === 'spin') {
    const sz = Math.min(cw, ch); // square tiles, centred in the cell
    f.spin = spinPlan(grid, taken).map((p) => ({ x: a.x + cw * p.c + (cw - sz) / 2, y: a.y + ch * p.r + (ch - sz) / 2, w: sz, h: sz, dx: p.dx, dy: p.dy, used: -1 }));
    if (!f.spin.length) return null;
  } else if (g.kind === 'ice') {
    f.ice = icePlan(grid, taken).map((p) => ({ x: a.x + cw * p.c0, y: a.y + ch * p.r0, w: cw * (p.c1 - p.c0 + 1), h: ch * 2, melt: -1, skated: -1 }));
    if (!f.ice.length) return null;
  } else if (g.kind === 'wind') {
    f.wind = { x0: a.x, x1: a.x + a.w, y0: a.y + ch * 4, y1: a.y + ch * 6, dir: battle % 2 ? -1 : 1 };
  } else {
    const plan = laserPlan(grid, taken);
    if (!plan) return null;
    const y = a.y + ch * (plan.row + 0.5);
    const post = (c: number): Post => ({ x: a.x + cw * (c + 0.5), y, hp: LASER_POST_HITS, t: -9 });
    f.laser = { a: post(plan.col), b: post(8 - plan.col), hurtT: -9, down: false };
  }
  return f;
}

const tell = (u: Field2Ball, ability: string, fx: Field2Fx) => u.def.ability === ability && fx.notice(u);
// type immunity always holds; the ability half goes through the gauge gate
const counters = (u: Field2Ball, fx: Field2Fx, type: PokeType, ability: string) =>
  typed(u.def, type) || (u.def.ability === ability && (fx.live?.(u) ?? true));

// Push the ball out along n (unit, pointing at the ball) and mirror its
// velocity when it is moving into the surface.
function bounce(u: { x: number; y: number; vx: number; vy: number }, nx: number, ny: number, depth: number) {
  u.x += nx * depth;
  u.y += ny * depth;
  const vn = u.vx * nx + u.vy * ny;
  if (vn < 0) {
    u.vx -= 2 * vn * nx;
    u.vy -= 2 * vn * ny;
  }
}

// returns shot-clock seconds to pause (Battle adds it to shotT)
function stepIce(f: Field2, u: Field2Ball, h: number, shot: number, fx: Field2Fx): number {
  if (!f.ice) return 0;
  if (f.iceShot !== shot) {
    f.iceShot = shot;
    f.icePause = 0;
  }
  const p = f.ice.find((q) => u.x >= q.x && u.x <= q.x + q.w && u.y >= q.y && u.y <= q.y + q.h);
  if (!p || p.melt === shot) return 0;
  if (meltsIce(u.def)) {
    p.melt = shot;
    fx.burst(u.x, u.y, '#bfe8ff');
    sfx('splash');
    return 0;
  }
  if (skatesIce(u.def) && (fx.live?.(u) ?? true) && p.skated !== shot) {
    p.skated = shot;
    u.vx *= ICE_SKATE;
    u.vy *= ICE_SKATE;
    tell(u, u.def.ability, fx);
  }
  const pause = Math.min(h, ICE_PAUSE_MAX - f.icePause);
  f.icePause += pause;
  return pause;
}

export function stepField2(f: Field2 | null, u: Field2Ball, h: number, time: number, fx: Field2Fx, shot = 0): number {
  if (!f || u.dead) return 0;
  const pause = stepIce(f, u, h, shot, fx);
  const sp = f.spin?.find((q) => q.used !== shot && u.x >= q.x && u.x <= q.x + q.w && u.y >= q.y && u.y <= q.y + q.h);
  if (sp) {
    sp.used = shot;
    if (counters(u, fx, 'psychic', 'own-tempo')) tell(u, 'own-tempo', fx);
    else {
      const v = Math.hypot(u.vx, u.vy) * SPIN_KICK;
      u.vx = sp.dx * v;
      u.vy = sp.dy * v;
      fx.burst(u.x, u.y, TYPE_COLOR.psychic);
      sfx('ui');
    }
  }
  const wp = f.warp?.find((q) => q.used !== shot && u.x >= q.x && u.x <= q.x + q.w && u.y >= q.y && u.y <= q.y + q.h);
  const twin = wp && !typed(u.def, 'ghost') && f.warp!.find((q) => q !== wp && q.pair === wp.pair);
  if (wp && twin) {
    // velocity rides through untouched; the pair stays spent this shot so it cannot loop
    wp.used = twin.used = shot;
    f.warpFx = f.warpFx.filter((e) => time - e.t < WARP_FLASH);
    f.warpFx.push({ x: wp.x + wp.w / 2, y: wp.y + wp.h / 2, t: time }, { x: twin.x + twin.w / 2, y: twin.y + twin.h / 2, t: time });
    fx.burst(u.x, u.y, TYPE_COLOR.ghost);
    u.x = twin.x + twin.w / 2;
    u.y = twin.y + twin.h / 2;
    fx.burst(u.x, u.y, TYPE_COLOR.ghost);
    sfx('gust');
  }
  const w = f.wind;
  if (w) {
    const inside = u.y >= w.y0 && u.y <= w.y1;
    if (inside && counters(u, fx, 'flying', 'levitate')) tell(u, 'levitate', fx);
    else if (inside) {
      u.vx += w.dir * WIND_ACCEL * h;
      if (!f.inWind) sfx('gust');
    }
    f.inWind = inside;
  }
  const l = f.laser;
  if (!l || l.down) return pause;
  for (const p of [l.a, l.b]) {
    const dx = u.x - p.x, dy = u.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d >= u.r + LASER_POST_R) continue;
    bounce(u, dx / d, dy / d, u.r + LASER_POST_R - d);
    if (time - p.t < POST_HIT_CD) return pause;
    p.t = time;
    p.hp--;
    fx.shake(6);
    fx.burst(p.x, p.y, TYPE_COLOR.electric);
    sfx('hit');
    if (p.hp <= 0) {
      l.down = true;
      fx.shake(12);
      fx.burst(l.a.x, l.a.y, '#fff6a0');
      fx.burst(l.b.x, l.b.y, '#fff6a0');
      sfx('boom');
    }
    return pause;
  }
  // beam: closest point on the a-b segment
  const sx = l.b.x - l.a.x, sy = l.b.y - l.a.y;
  const k = Math.max(0, Math.min(1, ((u.x - l.a.x) * sx + (u.y - l.a.y) * sy) / (sx * sx + sy * sy)));
  const dx = u.x - (l.a.x + sx * k), dy = u.y - (l.a.y + sy * k), d = Math.hypot(dx, dy);
  if (d >= u.r + LASER_BEAM_R) return pause;
  if (counters(u, fx, 'electric', 'volt-absorb')) {
    tell(u, 'volt-absorb', fx);
    return pause;
  }
  // dead-on center: fall back to the side the ball came from
  const nx = d > 0.01 ? dx / d : 0, ny = d > 0.01 ? dy / d : (u.vy > 0 ? -1 : 1);
  bounce(u, nx, ny, u.r + LASER_BEAM_R - d);
  if (time - l.hurtT < LASER_HURT_CD) return pause;
  l.hurtT = time;
  fx.hurt(u, Math.max(1, Math.round(u.maxHp * LASER_CHIP)));
  fx.burst(u.x - nx * u.r, u.y - ny * u.r, TYPE_COLOR.electric);
  sfx('zap');
  return pause;
}

// foes knocked into the fence bounce off it; no chip, posts take no hits
export function blockField2(f: Field2 | null, e: { x: number; y: number; vx: number; vy: number; r: number; dead?: boolean }) {
  const l = f?.laser;
  if (!l || l.down || e.dead) return;
  for (const p of [l.a, l.b]) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < e.r + LASER_POST_R) return bounce(e, dx / d, dy / d, e.r + LASER_POST_R - d);
  }
  const sx = l.b.x - l.a.x, sy = l.b.y - l.a.y;
  const k = Math.max(0, Math.min(1, ((e.x - l.a.x) * sx + (e.y - l.a.y) * sy) / (sx * sx + sy * sy)));
  const dx = e.x - (l.a.x + sx * k), dy = e.y - (l.a.y + sy * k), d = Math.hypot(dx, dy);
  if (d >= e.r + LASER_BEAM_R) return;
  bounce(e, d > 0.01 ? dx / d : 0, d > 0.01 ? dy / d : (e.vy > 0 ? -1 : 1), e.r + LASER_BEAM_R - d);
}

// floor layer, drawn under hazards and units: Gracidea ice tiles with a
// frosted rim and a drop shadow on the near edge so the patch sits in the court
export function drawField2Floor(ctx: CanvasRenderingContext2D, f: Field2 | null, time: number, shot = 0) {
  if (!f) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // warp pads: Saffron floor panel in a steel rim with a Gen 3 vortex
  // turning on it; partners share a rim colour, a spent pair dims
  for (const t of f.warp ?? []) {
    const spent = t.used === shot, m = 5;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(t.x + m, t.y + t.h - m, t.w - m * 2, 5);
    ctx.globalAlpha = spent ? 0.5 : 1;
    drawTile(ctx, TILE_FLAGSTONE, t.x + m + 3, t.y + m + 3, t.w - m * 2 - 6, t.h - m * 2 - 6);
    ctx.strokeStyle = WARP_RIM[t.pair % WARP_RIM.length];
    ctx.lineWidth = 3;
    ctx.strokeRect(t.x + m + 1.5, t.y + m + 1.5, t.w - m * 2 - 3, t.h - m * 2 - 3);
    for (let k = 0; k < 4; k++) drawTile(ctx, TILE_STEEL_TRIM, t.x + m + (k % 2) * (t.w - m * 2 - 6), t.y + m + (k >> 1) * (t.h - m * 2 - 6), 6, 6);
    const vortex = animSheet('shadow_ball');
    if (vortex) {
      const s = (t.w - m * 2) * 0.7;
      ctx.save();
      ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
      ctx.rotate((spent ? 0 : time * 3) * (t.pair ? -1 : 1));
      ctx.globalAlpha = spent ? 0.3 : 0.9;
      ctx.drawImage(vortex, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
  // spinner tiles: lavender gym floor in a steel rim, Gen 3 chevrons
  // scrolling toward the arrow; a spent tile dims for the rest of the shot
  for (const t of f.spin ?? []) {
    const spent = t.used === shot, m = 5;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(t.x + m, t.y + t.h - m, t.w - m * 2, 5);
    ctx.globalAlpha = spent ? 0.5 : 1;
    for (let k = 0; k < 4; k++) drawTile(ctx, TILE_STEEL_TRIM, t.x + m + (k % 2) * (t.w - m * 2 - 6), t.y + m + (k >> 1) * (t.h - m * 2 - 6), 6, 6);
    drawTile(ctx, TILE_FLAGSTONE, t.x + m + 3, t.y + m + 3, t.w - m * 2 - 6, t.h - m * 2 - 6);
    ctx.save();
    ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
    ctx.rotate(Math.atan2(t.dy, t.dx) - Math.PI / 2);
    const aw = (t.w - m * 2) * 0.82, ah = aw / 2, run = (t.h - m * 2) * 0.42;
    for (let i = 0; i < 2; i++) {
      const k = spent ? i * 0.5 : (time * 1.4 + i * 0.5) % 1;
      ctx.globalAlpha = (spent ? 0.4 : 1) * Math.min(1, k * 4, (1 - k) * 4);
      drawTile(ctx, SPIN_ARROW, -aw / 2, -run / 2 + k * run - ah / 2, aw, ah);
    }
    ctx.restore();
  }
  for (const p of f.ice ?? []) {
    const melted = p.melt === shot;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x + 2, p.y + p.h, p.w - 4, 5);
    ctx.globalAlpha = melted ? 0.35 : 1;
    const cs = p.h / 2;
    for (let y = p.y; y < p.y + p.h - 1; y += cs) for (let x = p.x; x < p.x + p.w - 1; x += cs) drawTile(ctx, TILE_ICE, x, y, cs + 0.5, cs + 0.5);
    ctx.globalAlpha = melted ? 0.45 : 0.9;
    ctx.strokeStyle = melted ? '#4a90c8' : '#f4fcff';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
    if (melted) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#3a88d0';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      continue;
    }
    // sheen glint sliding across the patch
    const u = (time * 0.35 + p.x * 0.01) % 1;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x + u * (p.w - 10), p.y + 4, 10, p.h - 8);
  }
  ctx.restore();
}

const WARP_RIM = ['#c890ff', '#f8d030'];
const sheets = new Map<string, HTMLImageElement>();
function animSheet(name: string): HTMLImageElement | undefined {
  if (typeof Image === 'undefined') return undefined;
  let img = sheets.get(name);
  if (!img) {
    img = new Image();
    img.src = `sprites/anims/${name}.png`;
    sheets.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}

export function drawField2(ctx: CanvasRenderingContext2D, f: Field2 | null, time: number) {
  if (!f) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const w = f.wind;
  if (w) {
    const bw = w.x1 - w.x0, bh = w.y1 - w.y0;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#d8f0ff';
    ctx.fillRect(w.x0, w.y0, bw, bh);
    // Gen 3 Gust swirls and Gracidea leaves stream downwind
    const gust = animSheet('gust');
    for (let i = 0; i < 12; i++) {
      const u = ((i * 0.381 + time * (0.32 + (i % 3) * 0.06)) % 1);
      const x = w.dir > 0 ? w.x0 + u * bw : w.x1 - u * bw;
      const y = w.y0 + bh * (0.12 + ((i * 0.618) % 1) * 0.76) + Math.sin(time * 3 + i) * 6;
      ctx.globalAlpha = 0.75 * Math.min(1, u * 6, (1 - u) * 6);
      if (i % 2 === 0 && gust) {
        const fr = Math.floor(time * 10 + i) % 2;
        ctx.drawImage(gust, 0, fr * 32, 32, 32, x - 18, y - 18, 36, 36);
      } else {
        const s = 10 + (i % 2) * 4;
        drawTile(ctx, FX_LEAF, x - s / 2, y - s / 2, s, s);
      }
    }
    // Pidgeot at the upwind rim, flapping the gale across
    ctx.globalAlpha = 0.85;
    const px = w.dir > 0 ? w.x0 + 44 : w.x1 - 44, py = (w.y0 + w.y1) / 2 + Math.sin(time * 6) * 3;
    ctx.save();
    ctx.translate(px, py);
    if (w.dir > 0) ctx.scale(-1, 1); // FRLG fronts face left
    drawMon(ctx, PIDGEOT, 0, 0, 44);
    ctx.restore();
  }
  // Gen 3 teleport: a gold ring blinks open over the pad left and the pad reached
  const ring = animSheet('gold_ring');
  for (const e of f.warpFx) {
    const k = (time - e.t) / WARP_FLASH;
    if (!ring || k < 0 || k >= 1) continue;
    ctx.globalAlpha = 1 - k;
    const rw = 12 + k * 36, rh = 56 + k * 16;
    const fr = Math.floor((time - e.t) * 12) % 2; // two stacked 16px frames — don't squash the sheet
    ctx.drawImage(ring, 0, fr * 16, 16, 16, e.x - rw / 2, e.y - rh / 2, rw, rh);
  }
  const l = f.laser;
  if (l && !l.down) {
    const flick = 0.75 + Math.sin(time * 31) * 0.15;
    ctx.globalAlpha = 0.3 * flick;
    ctx.strokeStyle = '#f8e858';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
    ctx.globalAlpha = flick;
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 3;
    ctx.stroke();
    const spark = animSheet('spark_0');
    if (spark) for (let i = 0; i < 3; i++) {
      const k = (time * 0.9 + i / 3) % 1;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(spark, 0, (Math.floor(time * 20 + i * 3) % 8) * 8, 8, 8, l.a.x + (l.b.x - l.a.x) * k - 8, l.a.y - 8, 16, 16);
    }
    for (const p of [l.a, l.b]) {
      const hit = time - p.t < 0.25 ? Math.sin(time * 60) * 3 : 0;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 20, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      drawTile(ctx, ROCK_SMALL, p.x - 15, p.y + 6, 30, 18);
      ctx.globalAlpha = p.hp < LASER_POST_HITS && Math.sin(time * 18) > 0 ? 0.6 : 1;
      drawMon(ctx, MAGNEMITE, p.x + hit, p.y - 4 + Math.sin(time * 4 + p.x) * 2, 40);
    }
  }
  ctx.restore();
}

// one short tag per gimmick while the court intro runs
export function labelField2(f: Field2 | null, alpha: number, put: (text: string, x: number, y: number, color: string, alpha: number) => void) {
  if (!f || alpha <= 0) return;
  if (f.warp) put('WARP', f.warp[0].x + f.warp[0].w / 2, f.warp[0].y - 6, TYPE_COLOR.ghost, alpha);
  if (f.spin) put('SPINNER', f.spin[0].x + f.spin[0].w / 2, f.spin[0].y - 6, TYPE_COLOR.psychic, alpha);
  if (f.ice) put('ICE PATH', f.ice[0].x + f.ice[0].w / 2, f.ice[0].y + f.ice[0].h / 2, '#bfe8ff', alpha);
  if (f.wind) put('WIND', (f.wind.x0 + f.wind.x1) / 2, (f.wind.y0 + f.wind.y1) / 2, TYPE_COLOR.flying, alpha);
  if (f.laser && !f.laser.down) put('LASER', (f.laser.a.x + f.laser.b.x) / 2, f.laser.a.y + 30, TYPE_COLOR.electric, alpha);
}

// stop-preview line under the main gimmick hint, same look as drawCounterHint
export function drawField2Hint(ctx: CanvasRenderingContext2D, theme: Theme, team: SpeciesDef[], x: number, y: number, width: number) {
  const g = STAGE_GIMMICKS2[theme];
  if (!g) return;
  const match = team.filter((d) => countersGimmick2(d, g));
  const text = [g.label, g.hint, match[0] && match[0].name.toUpperCase() + (match.length > 1 ? ` +${match.length - 1}` : '')].filter(Boolean).join(' · ');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.font = fontB(12);
  fitFontB(ctx, text, 12, width);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = TYPE_COLOR[g.type];
  ctx.fillText(text, x, y);
  ctx.restore();
}
