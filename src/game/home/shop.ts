// SHOP: the prize counter — a cached Gracidea back room (brick wall, mart
// floor, striped stall, props) with the live clerk, shelf items and the
// day's rate-up mon drawn over it each frame.
import { drawMon, drawNpc, itemSprite, loadItem, loadSprite } from '../../core/assets';
import { slice } from '../bg';
import { TILE_BRICK, TILE_DIAMOND, TILE_BUSH, FLOWER_PINK, type TileRect } from '../maptiles';
import { INK, PARCH, GOLD_HI, rr, ufit, fontB, uiWindow, type Rect } from '../ui';
import { TYPE_COLOR } from '../types';
import type { SpeciesDef } from '../data';

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
  drawNpc(ctx, t % 6 < 0.9 ? 'shopkeeper_f_left_0' : 'shopkeeper_f_down_0', sx + s.w * 0.8, top + 22, 66);
  ctx.restore();
  // prizes on the counter top
  ctx.imageSmoothingEnabled = false;
  SHELF.forEach((id, i) => {
    void loadItem(id);
    const spr = itemSprite(id);
    if (spr) ctx.drawImage(spr, sx + 10 + i * 31, top - 24, 28, 28);
  });

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
