// SHOP: the prize counter — a cached Gracidea back room (brick wall, mart
// floor, striped stall, props) with the live clerk, shelf items and the
// day's rate-up mon drawn over it each frame.
import { drawMon, drawNpc, itemSprite, loadItem, loadSprite } from '../../core/assets';
import { slice } from '../bg';
import { TILE_BRICK, TILE_DIAMOND, TILE_BUSH, FLOWER_PINK, type TileRect } from '../maptiles';
import { INK, PARCH, GOLD_HI, rr, ufit, fontB, uiWindow, type Rect } from '../ui';
import { settings } from '../meta';
import { TYPE_COLOR } from '../types';
import type { SpeciesDef } from '../data';

// OS reduced-motion seed (same probe as bg/evolve/fame): the counter sheen
// stays home; the shelf twinkles are blink-in-place so they keep running.
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const STALL: TileRect = [1315, 657, 89, 62]; // striped market stall; the awning's sign hole keys clear
const STALL_S = 2.4;
const SIGN = { x: 35, y: 9, w: 36, h: 18 }; // that hole, stall-local px
const COUNTER_Y = 40; // counter top, stall-local px
const WALL_H = 96;
const SHELF = ['poke-ball', 'great-ball', 'ultra-ball', 'star-piece'];

let layer: HTMLCanvasElement | null = null;

// stall placement inside the scene — shared by the cache and the live pass
const stallBox = (r: Rect) => {
  const w = STALL[2] * STALL_S, h = STALL[3] * STALL_S;
  return { x: r.w - w - 40, y: r.h - h - 48, w, h };
};

function sceneLayer(r: Rect) {
  if (layer && layer.width === r.w && layer.height === r.h) return layer;
  const wall = slice(TILE_BRICK), floor = slice(TILE_DIAMOND), stall = slice(STALL);
  const bush = slice(TILE_BUSH), flower = slice(FLOWER_PINK);
  if (!wall || !floor || !stall || !bush || !flower) return null;
  const c = document.createElement('canvas');
  c.width = r.w;
  c.height = r.h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < WALL_H; y += 64) for (let x = 0; x < r.w; x += 64) g.drawImage(wall, x, y, 64, 64);
  g.fillStyle = 'rgba(20,24,48,0.38)';
  g.fillRect(0, 0, r.w, WALL_H);
  for (let y = WALL_H; y < r.h; y += 64) for (let x = 0; x < r.w; x += 64) g.drawImage(floor, x, y, 64, 64);
  g.fillStyle = 'rgba(20,24,48,0.5)';
  g.fillRect(0, WALL_H, r.w, 4);
  const s = stallBox(r);
  g.fillStyle = 'rgba(8,16,32,0.32)';
  g.beginPath();
  g.ellipse(s.x + s.w / 2, s.y + s.h - 2, s.w * 0.54, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.drawImage(stall, s.x, s.y, s.w, s.h);
  // the awning's blank plate gets the counter's name
  const sg = { x: s.x + SIGN.x * STALL_S, y: s.y + SIGN.y * STALL_S, w: SIGN.w * STALL_S, h: SIGN.h * STALL_S };
  uiWindow(g, sg, { rad: 6, rim: false, shadow: false });
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ufit(g, 'PRIZES', 8, sg.w - 12);
  g.fillText('PRIZES', sg.x + sg.w / 2, sg.y + sg.h / 2 + 1);
  // grounded props: a bush in the far corner, flowers by the mon's spot
  const prop = (img: HTMLCanvasElement, x: number, y: number, k: number) => {
    const w = img.width * k, h = img.height * k;
    g.fillStyle = 'rgba(8,16,32,0.28)';
    g.beginPath();
    g.ellipse(x + w / 2, y + h - 3, w * 0.48, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(img, x, y, w, h);
  };
  prop(bush, r.w - 66, r.h - 74, 1.1);
  prop(flower, 14, r.h - 46, 1.3);
  prop(flower, 214, r.h - 40, 1.1);
  layer = c;
  return c;
}

export function drawShopScene(ctx: CanvasRenderingContext2D, r: Rect, t: number, feat: SpeciesDef) {
  const ftc = TYPE_COLOR[feat.type];
  ctx.fillStyle = 'rgba(40,48,88,0.35)';
  rr(ctx, r.x + 2, r.y + 5, r.w, r.h, 12);
  ctx.fill();
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  const bg = sceneLayer(r);
  if (bg) ctx.drawImage(bg, r.x, r.y);
  else {
    ctx.fillStyle = '#3a4468';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // the clerk behind the counter — clipped at its top so the counter hides
  // her legs; she glances at the mon now and then
  const s = stallBox(r);
  const sx = r.x + s.x, sy = r.y + s.y;
  const top = sy + COUNTER_Y * STALL_S;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, top - r.y);
  ctx.clip();
  const bob = REDUCED || !settings().shake ? 0 : Math.sin(t * 2.1) * 1.5;
  drawNpc(ctx, t % 6 < 0.9 ? 'shopkeeper_f_left_0' : 'shopkeeper_f_down_0', sx + s.w * 0.8, top + 22 + bob, 66);
  ctx.restore();
  // prizes on the counter top — each takes a turn catching the light
  ctx.imageSmoothingEnabled = false;
  SHELF.forEach((id, i) => {
    void loadItem(id);
    const spr = itemSprite(id);
    if (spr) ctx.drawImage(spr, sx + 10 + i * 31, top - 24, 28, 28);
    const tw = Math.sin(t * 2.4 + i * 2.7);
    if (spr && tw > 0.88) {
      ctx.save();
      ctx.globalAlpha = (tw - 0.88) / 0.12;
      ctx.fillStyle = '#fff8d8';
      ctx.translate(sx + 10 + i * 31 + 24, top - 24);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
      ctx.restore();
    }
  });
  // the counter's glimmer: a sheen sweeps the counter top every few
  // seconds, fading in and out across the pass
  if (!REDUCED && t % 7 < 3.5) {
    const u = (t % 7) / 3.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, top - 30, s.w, 34);
    ctx.clip();
    ctx.translate(sx - 40 + u * (s.w + 80), top - 14);
    ctx.rotate(-0.35);
    const grad = ctx.createLinearGradient(-16, 0, 16, 0);
    grad.addColorStop(0, 'rgba(255,248,216,0)');
    grad.addColorStop(0.5, `rgba(255,248,216,${(0.22 * Math.sin(Math.PI * u)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,248,216,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-16, -46, 32, 92);
    ctx.restore();
  }

  // a few dust motes hang in the back room's air — shake=0 parks them
  const ft = settings().shake === 0 ? 0 : t;
  for (let i = 0; i < 4; i++) {
    const mx = r.x + ((i * 137 + ft * 9) % (r.w + 24)) - 12;
    const my = r.y + 36 + ((i * 91) % (r.h - 80)) + Math.sin(ft * 0.8 + i * 2.1) * 7;
    ctx.globalAlpha = 0.08 + 0.07 * (0.5 + 0.5 * Math.sin(ft * 1.6 + i * 2.9));
    ctx.fillStyle = '#fff8d8';
    ctx.fillRect(mx, my, 3, 3);
  }
  ctx.globalAlpha = 1;

  // the day's rate-up face, big on a type-glow pad
  const cx = r.x + 128, gy = r.y + r.h - 32;
  ctx.fillStyle = `${ftc}55`;
  ctx.beginPath();
  ctx.ellipse(cx, gy, 82, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(8,16,32,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, gy - 2, 52, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  try {
    drawMon(ctx, feat.id, cx, gy - 58 + Math.sin(t * 2.2) * 3, 136);
  } catch {
    void loadSprite(feat.id);
  }
  const star = itemSprite('star-piece');
  if (star) {
    ([[-74, -112], [70, -128], [64, -40]] as const).forEach(([dx, dy], i) => {
      ctx.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.6 + i * 2.1));
      ctx.drawImage(star, cx + dx - 8, gy + dy - 8, 16, 16);
    });
    ctx.globalAlpha = 1;
  }

  // rate-up tag pinned top-left
  const tag = { x: r.x + 12, y: r.y + 12, w: 224, h: 62 };
  uiWindow(ctx, tag, { dark: true, rad: 8, rim: false, shadow: false });
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = fontB(11);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText('RATE-UP', tag.x + 12, tag.y + 23);
  ctx.textAlign = 'right';
  ctx.fillStyle = PARCH;
  ctx.fillText('10× ODDS', tag.x + tag.w - 12, tag.y + 23);
  ctx.textAlign = 'left';
  const nm = feat.name.toUpperCase();
  ufit(ctx, nm, 12, tag.w - 24);
  ctx.fillText(nm, tag.x + 12, tag.y + 50);
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 11);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,230,200,0.35)';
  ctx.lineWidth = 1.5;
  rr(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 8);
  ctx.stroke();
}

// --- the hatcher's back room: the same brick + mart floor at any size -------
// the pull theatre runs on it full-bleed and the featured strip as a header
const rooms = new Map<string, HTMLCanvasElement>();
function backRoom(w: number, h: number, wallH: number, props: boolean) {
  const key = `${w}x${h}x${wallH}x${props ? 1 : 0}`; // same box can bake with or without the bush/flower set
  const hit = rooms.get(key);
  if (hit) return hit;
  const wall = slice(TILE_BRICK), floor = slice(TILE_DIAMOND);
  const bush = slice(TILE_BUSH), flower = slice(FLOWER_PINK);
  if (!wall || !floor || !bush || !flower) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < wallH; y += 64) for (let x = 0; x < w; x += 64) g.drawImage(wall, x, y, 64, 64);
  g.fillStyle = 'rgba(20,24,48,0.38)';
  g.fillRect(0, 0, w, wallH);
  for (let y = wallH; y < h; y += 64) for (let x = 0; x < w; x += 64) g.drawImage(floor, x, y, 64, 64);
  g.fillStyle = 'rgba(20,24,48,0.5)';
  g.fillRect(0, wallH, w, 4);
  if (props) {
    const prop = (img: HTMLCanvasElement, x: number, y: number, k: number) => {
      const pw = img.width * k, ph = img.height * k;
      g.fillStyle = 'rgba(8,16,32,0.28)';
      g.beginPath();
      g.ellipse(x + pw / 2, y + ph - 3, pw * 0.48, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(img, x, y, pw, ph);
    };
    prop(bush, 18, wallH - 40, 1.5);
    prop(bush, w - 18 - 75, wallH - 40, 1.5);
    prop(flower, 40, wallH + 120, 1.5);
    prop(flower, w - 82, wallH + 150, 1.5);
  }
  rooms.set(key, c);
  return c;
}

// full-bleed theatre stage; falls back to a flat night fill on a cold atlas
export function drawPullStage(ctx: CanvasRenderingContext2D, w: number, h: number, floorY: number) {
  const bg = backRoom(w, h, floorY - 120, true);
  if (bg) ctx.drawImage(bg, 0, 0);
  else {
    ctx.fillStyle = '#1b2140';
    ctx.fillRect(0, 0, w, h);
  }
}

// the featured rate-up's header strip inside the hatcher window
export function drawCounterStrip(ctx: CanvasRenderingContext2D, r: Rect, wallK = 0.42) {
  const bg = backRoom(r.w, r.h, Math.round(r.h * wallK), false);
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  if (bg) ctx.drawImage(bg, r.x, r.y);
  else {
    ctx.fillStyle = '#3a4468';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 9);
  ctx.stroke();
}

// which ball a pull result rides in — the ball IS the star tier
export const ballFor = (rarity: number, shiny: boolean) =>
  shiny ? 'master-ball' : rarity >= 3 ? 'ultra-ball' : rarity === 2 ? 'great-ball' : 'poke-ball';

// the ball's drop: a gravity fall onto the floor, then three damped hops.
// h = px above the floor, hit = seconds since the last floor contact (-1 mid-fall)
export const DROP_H = 380;
const DROP_T = 0.3;
const DROP_E = 0.4; // restitution per bounce
export function ballDrop(t: number): { h: number; hit: number } {
  if (t < DROP_T) return { h: DROP_H * (1 - (t / DROP_T) ** 2), hit: -1 };
  const g = (2 * DROP_H) / (DROP_T * DROP_T);
  let v = g * DROP_T * DROP_E;
  let t0 = DROP_T;
  for (let k = 0; k < 3; k++) {
    const span = (2 * v) / g;
    if (t < t0 + span) {
      const u = t - t0;
      return { h: Math.max(0, v * u - 0.5 * g * u * u), hit: u };
    }
    t0 += span;
    v *= DROP_E;
  }
  return { h: 0, hit: t - t0 };
}
// when the hops end — the wobble starts here
export const DROP_SETTLE = DROP_T * (1 + 2 * (DROP_E + DROP_E ** 2 + DROP_E ** 3));
