import { drawMon, drawNpc, gracidea, itemSprite, loadItem, loadNpcs, loadSprite } from '../core/assets';
import { drawCounterStrip } from './home/shop';
import { dirtFill, tileFill } from './home/town';
import { drawTile } from './map';
import { FLOWER_PINK, type TileRect } from './maptiles';
import { fitFontB } from './screens';
import type { EventChoice } from './events';
import { GOLD, GOLD_HI, INK, INK_FAINT, PARCH, fontB, rr, scrim, uiBand, uiWindow, type Rect } from './ui';

const ART = { x: 30, y: 96, w: 480, h: 300 };
const INNER = { x: 36, y: 102, w: 468, h: 288 };
const CARD_X = 30;
const CARD_Y = 412;
const CARD_W = 480;
const ROW_Y = 500;
const ROW_H = 64;
const ROW_GAP = 10;
const GRASS: TileRect = [52, 417, 16, 16];
const CENTER: TileRect = [684, 93, 90, 87];
const STALL: TileRect = [1315, 657, 89, 62];
const STALL_S = 2.4;
const STALL_COUNTER_Y = 40;
const CENTER_S = 2.4;
const FLOWER_S = 1.5;
const restArt = new Map<string, HTMLCanvasElement>();

export function stopRows(n: number): Rect[] {
  return Array.from({ length: n }, (_, i) => ({
    x: 50,
    y: ROW_Y + i * (ROW_H + ROW_GAP),
    w: 440,
    h: ROW_H,
  }));
}

function restBackdrop(w: number, h: number) {
  const key = `${w}x${h}`;
  const cached = restArt.get(key);
  if (cached) return cached;
  const atlas = gracidea();
  if (!atlas?.complete || !atlas.naturalWidth) return null;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  tileFill(g, { x: 0, y: 0, w, h }, GRASS, 2);

  const centerW = CENTER[2] * CENTER_S;
  const centerH = CENTER[3] * CENTER_S;
  const centerX = (w - centerW) / 2;
  const centerY = 8;
  const doorX = w / 2;
  g.fillStyle = 'rgba(32,48,28,0.24)';
  g.beginPath();
  g.ellipse(doorX, centerY + centerH - 2, centerW * 0.42, 9, 0, 0, Math.PI * 2);
  g.fill();
  dirtFill(g, { x: doorX - 22, y: centerY + centerH - 4, w: 44, h: h - centerY - centerH + 4 });
  drawTile(g, CENTER, centerX, centerY, centerW, centerH);

  const flowerW = FLOWER_PINK[2] * FLOWER_S;
  const flowerH = FLOWER_PINK[3] * FLOWER_S;
  drawTile(g, FLOWER_PINK, 30, h - flowerH - 18, flowerW, flowerH);
  drawTile(g, FLOWER_PINK, w - flowerW - 30, h - flowerH - 18, flowerW, flowerH);

  restArt.set(key, c);
  return c;
}

function drawRestArt(ctx: CanvasRenderingContext2D, t: number) {
  const backdrop = restBackdrop(INNER.w, INNER.h);
  if (backdrop) ctx.drawImage(backdrop, INNER.x, INNER.y);

  const bob = Math.sin(t * 2.4) * 2;
  void loadSprite(113);
  try {
    drawMon(ctx, 113, INNER.x + INNER.w / 2 - 72, INNER.y + INNER.h - 28 + bob, 72);
  } catch {
    // The front sprite is still loading.
  }
  void loadNpcs();
  drawNpc(ctx, 'shopkeeper_f_down_0', INNER.x + INNER.w / 2 + 46, INNER.y + INNER.h - 24 + bob, 44);
}

function drawMartArt(ctx: CanvasRenderingContext2D, t: number) {
  drawCounterStrip(ctx, INNER, 0.55);
  const w = STALL[2] * STALL_S, h = STALL[3] * STALL_S;
  const x = INNER.x + (INNER.w - w) / 2;
  const y = INNER.y + INNER.h - h - 22;
  ctx.fillStyle = 'rgba(8,16,32,0.32)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - 3, w * 0.48, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  void loadNpcs();
  const counterTop = y + STALL_COUNTER_Y * STALL_S;
  drawTile(ctx, STALL, x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(INNER.x, INNER.y, INNER.w, counterTop - INNER.y);
  ctx.clip();
  drawNpc(ctx, 'shopkeeper_m_down_0', x + w * 0.72, counterTop + 22 + Math.sin(t * 2.4) * 2, 64);
  ctx.restore();
}

function drawCardTitle(ctx: CanvasRenderingContext2D, card: Rect, title: string, score?: number) {
  uiBand(ctx, card, '', { h: 36 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PARCH;
  fitFontB(ctx, title, 18, score === undefined ? card.w - 40 : 216);
  ctx.fillText(title, card.x + card.w / 2, card.y + 22);

  if (score !== undefined) {
    const chip = { x: card.x + card.w - 126, y: card.y + 7, w: 114, h: 30 };
    uiWindow(ctx, chip, { dark: true, rad: 8, rim: false, shadow: false });
    ctx.font = fontB(14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GOLD_HI;
    fitFontB(ctx, `SCORE ${score}`, 14, chip.w - 12);
    ctx.fillText(`SCORE ${score}`, chip.x + chip.w / 2, chip.y + chip.h / 2);
  }
}

function drawOption(ctx: CanvasRenderingContext2D, r: Rect, option: EventChoice, score: number) {
  const leave = option.cost === undefined && !option.icon;
  if (leave) {
    uiWindow(ctx, r, { dark: true, rad: 10 });
    ctx.font = fontB(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PARCH;
    ctx.fillText(option.label, r.x + r.w / 2, r.y + r.h / 2);
    return;
  }

  uiWindow(ctx, r, { rad: 10 });
  const affordable = option.cost === undefined || option.cost <= score;
  if (option.icon) {
    void loadItem(option.icon);
    const img = itemSprite(option.icon);
    if (img) {
      ctx.save();
      ctx.globalAlpha = affordable ? 1 : 0.45;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, r.x + 12, r.y + 12, 40, 40);
      ctx.restore();
    }
  }

  const price = option.cost === undefined ? undefined : {
    x: r.x + r.w - 92,
    y: r.y + 12,
    w: 82,
    h: 40,
  };
  const labelX = r.x + 64;
  const labelMaxW = price ? price.x - labelX - 8 : r.x + r.w - labelX - 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = affordable ? INK : INK_FAINT;
  fitFontB(ctx, option.label, 20, labelMaxW);
  ctx.fillText(option.label, labelX, r.y + r.h / 2);

  if (price && option.cost !== undefined) {
    uiWindow(ctx, price, { dark: true, rad: 10, shadow: false, rim: false });
    ctx.save();
    ctx.globalAlpha = affordable ? 1 : 0.45;
    ctx.font = fontB(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GOLD;
    fitFontB(ctx, `${option.cost}`, 20, price.w - 12);
    ctx.fillText(`${option.cost}`, price.x + price.w / 2, price.y + price.h / 2);
    ctx.restore();
  }
}

export function drawStopScene(
  ctx: CanvasRenderingContext2D,
  s: { kind: 'rest' | 'mart'; t: number; cardT: number; prompt: string; options: EventChoice[]; score: number },
): Rect[] {
  const rows = stopRows(s.options.length);
  scrim(ctx, 0.75);
  const pop = Math.min(1, s.cardT / 0.24);
  ctx.save();
  ctx.globalAlpha = pop;
  ctx.translate(270, 480);
  ctx.scale(pop, pop);
  ctx.translate(-270, -480);

  uiWindow(ctx, ART, { rad: 12 });
  ctx.save();
  rr(ctx, INNER.x, INNER.y, INNER.w, INNER.h, 6);
  ctx.clip();
  if (s.kind === 'rest') drawRestArt(ctx, s.t);
  else drawMartArt(ctx, s.t);
  ctx.restore();

  const last = rows[rows.length - 1];
  const card = {
    x: CARD_X,
    y: CARD_Y,
    w: CARD_W,
    h: last ? last.y + last.h + 16 - CARD_Y : 100,
  };
  uiWindow(ctx, card, { rad: 12 });
  drawCardTitle(ctx, card, s.kind === 'rest' ? 'POKÉ CENTER' : 'POKÉ MART', s.kind === 'mart' ? s.score : undefined);

  ctx.font = fontB(18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  fitFontB(ctx, s.prompt, 18, card.w - 48);
  ctx.fillText(s.prompt, 270, 476);

  rows.forEach((r, i) => drawOption(ctx, r, s.options[i], s.score));
  ctx.restore();
  return rows;
}
