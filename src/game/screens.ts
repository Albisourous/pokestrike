import { sprite } from '../core/assets';
import { SpeciesDef, ROSTER } from './data';
import { TYPE_COLOR } from './types';

export const W = 540;
export const H = 960;

export interface RunResult {
  won: boolean;
  shots: number;
  time: number;
}

// --- team select layout ---

const COLS = 4;
const CELL = 104;
const GRID_X = (W - COLS * CELL) / 2;
const GRID_Y = 220;

export function cellRect(i: number) {
  return {
    x: GRID_X + (i % COLS) * CELL,
    y: GRID_Y + Math.floor(i / COLS) * (CELL + 30),
    w: CELL,
    h: CELL + 30,
  };
}

export const START_BTN = { x: W / 2 - 110, y: 700, w: 220, h: 64 };
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
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, W, H);

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

export function drawSelect(ctx: CanvasRenderingContext2D, picks: number[], stageName: string) {
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 34px system-ui';
  ctx.fillStyle = '#f8d030';
  ctx.fillText('PICK YOUR TEAM', W / 2, 120);
  ctx.font = '17px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`${picks.length} / 4 — ${stageName} awaits`, W / 2, 160);

  ROSTER.forEach((def: SpeciesDef, i: number) => {
    const r = cellRect(i);
    const picked = picks.includes(i);
    const order = picks.indexOf(i) + 1;

    roundRect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 12);
    ctx.fillStyle = picked ? '#2a3560' : '#12162b';
    ctx.fill();
    ctx.strokeStyle = picked ? TYPE_COLOR[def.type] : '#2a3560';
    ctx.lineWidth = picked ? 3 : 1;
    ctx.stroke();

    const img = sprite(def.id);
    ctx.drawImage(img, r.x + r.w / 2 - 32, r.y + 14, 64, 64);

    ctx.font = 'bold 13px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 96);
    ctx.font = '11px system-ui';
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(
      `${def.type.toUpperCase()}  ATK ${def.stats.atk} · SPE ${def.stats.spe}`,
      r.x + r.w / 2,
      r.y + 114,
    );

    if (picked) {
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.beginPath();
      ctx.arc(r.x + r.w - 18, r.y + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 13px system-ui';
      ctx.fillStyle = '#1b1f36';
      ctx.fillText(`${order}`, r.x + r.w - 18, r.y + 22);
    }
  });

  button(ctx, START_BTN, 'STRIKE!', picks.length === 4);

  ctx.font = '14px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('tip: bounce off allies to trigger their attack', W / 2, 820);
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
