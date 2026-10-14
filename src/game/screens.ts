import { sprite } from '../core/assets';
import { SpeciesDef } from './data';
import { drawBackdrop } from './bg';
import { TYPE_COLOR } from './types';
import { bumpIsPhysical } from './stats';

export const W = 540;
export const H = 960;

export interface RunResult {
  won: boolean;
  shots: number;
  time: number;
}

// --- draft layout: 3 offer cards, team strip at the bottom ---

const CARD_W = 150;
const CARD_H = 250;
const CARD_GAP = 15;
const CARDS_X = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
const CARDS_Y = 300;

export function draftCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: CARDS_Y, w: CARD_W, h: CARD_H };
}

export const RETRY_BTN = { x: W / 2 - 110, y: 620, w: 220, h: 64 };
export const DAILY_BTN = { x: W / 2 - 140, y: 640, w: 280, h: 64 };
export const FREE_BTN = { x: W / 2 - 140, y: 720, w: 280, h: 64 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean) {
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = on ? '#f8d030' : '#2a3560';
  ctx.fill();
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? '#1b1f36' : '#8890b8';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 8);
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  t: number,
  best: number | null,
  streak: number,
  dailyDone: boolean,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'grove', t);

  ctx.textAlign = 'center';
  ctx.font = 'bold 56px system-ui';
  ctx.fillStyle = '#f8d030';
  ctx.strokeStyle = '#2a3560';
  ctx.lineWidth = 8;
  ctx.strokeText('POKÉSTRIKE', W / 2, 300);
  ctx.fillText('POKÉSTRIKE', W / 2, 300);

  ctx.font = '18px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('pull back. launch. bounce.', W / 2, 340);

  // bouncing sprite teaser
  const bob = Math.sin(t * 2) * 18;
  const img = sprite(25);
  ctx.drawImage(img, W / 2 - 60, 390 + bob, 120, 120);

  button(ctx, DAILY_BTN, dailyDone ? 'DAILY · CLEARED' : 'DAILY STRIKE', true);
  button(ctx, FREE_BTN, 'FREE PLAY', true);

  ctx.font = '16px system-ui';
  ctx.fillStyle = '#8890b8';
  const stats: string[] = [];
  if (streak > 0) stats.push(`streak ${streak}`);
  if (best !== null) stats.push(`best clear ${best.toFixed(1)}s`);
  ctx.fillText(stats.join('  ·  '), W / 2, 830);
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6);

  ctx.textAlign = 'center';
  ctx.font = 'bold 34px system-ui';
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`DRAFT — PICK ${picked.length + 1} OF 4`, W / 2, 120);
  ctx.font = '17px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText(stageName, W / 2, 155);
  ctx.fillText('one of three — choose for coverage and speed', W / 2, 180);

  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = TYPE_COLOR[def.type];
    ctx.lineWidth = 2;
    ctx.stroke();

    const img = sprite(def.id);
    ctx.drawImage(img, r.x + r.w / 2 - 44, r.y + 18, 88, 88);

    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 128);
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(def.type.toUpperCase(), r.x + r.w / 2, r.y + 146);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#a8b0d8';
    const s = def.stats;
    ctx.fillText(`HP ${s.hp}   ATK ${s.atk}   DEF ${s.def}`, r.x + r.w / 2, r.y + 180);
    ctx.fillText(`SPA ${s.spa}   SPD ${s.spd}   SPE ${s.spe}`, r.x + r.w / 2, r.y + 200);
    ctx.fillStyle = '#8890b8';
    ctx.font = '11px system-ui';
    ctx.fillText(
      bumpIsPhysical(def.type) ? 'bump: physical' : 'bump: special',
      r.x + r.w / 2,
      r.y + 226,
    );
  });

  // picked team strip
  ctx.font = '13px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 640);
  for (let i = 0; i < 4; i++) {
    const sx = W / 2 - 4 * 44 + i * 88;
    roundRect(ctx, sx, 660, 76, 90, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 1;
    ctx.stroke();
    const def = picked[i];
    if (def) {
      ctx.drawImage(sprite(def.id), sx + 14, 668, 48, 48);
      ctx.font = '10px system-ui';
      ctx.fillStyle = '#fff';
      ctx.fillText(def.name, sx + 38, 740);
    }
  }

  ctx.font = '14px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('tip: bounce off allies to trigger their attack', W / 2, 810);
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  res: RunResult,
  best: number | null,
  extra: string | null,
) {
  ctx.fillStyle = '#0b0e1add';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 52px system-ui';
  ctx.fillStyle = res.won ? '#6fdc6f' : '#ff6b6b';
  ctx.fillText(res.won ? 'STAGE CLEAR!' : 'WIPED OUT', W / 2, 320);

  ctx.font = '20px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${res.shots} shots · ${res.time.toFixed(1)}s`, W / 2, 380);
  if (extra) {
    ctx.font = 'bold 20px system-ui';
    ctx.fillStyle = '#f8d030';
    ctx.fillText(extra, W / 2, 420);
  } else if (res.won && best !== null) {
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`best: ${best.toFixed(1)}s`, W / 2, 415);
  }

  button(ctx, RETRY_BTN, 'PLAY AGAIN', true);
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, waves: number, shots: number, stageName: string) {
  ctx.fillStyle = '#8890b8';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(stageName, 30, 44);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(wave + 1 === waves ? 'BOSS' : `WAVE ${wave + 1}/${waves}`, W / 2, 44);
  ctx.textAlign = 'right';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
}
