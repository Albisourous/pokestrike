import { itemSprite, drawMon, gracidea } from '../core/assets';
import { isMuted } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES } from './data';
import { RARITY_COLOR } from './perks';
import type { Rarity } from './perks';
import { drawBackdrop } from './bg';
import { TYPE_COLOR, type PokeType } from './types';
import { roleOf } from './stats';
import { dexIds, rankName } from './meta';

export const W = 540;
export const H = 960;

export interface RunResult {
  won: boolean;
  shots: number;
  time: number;
  caught: number;
  badges: { name: string; rarity: Rarity }[];
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
export const SHARE_BTN = { x: W / 2 - 110, y: 700, w: 220, h: 54 };
export const FREE_BTN = { x: W / 2 - 140, y: 720, w: 280, h: 64 };
export const DAILY_BTN = { x: W / 2 - 140, y: 800, w: 280, h: 64 };
export const HELP_BTN = { x: W - 64, y: 22, w: 44, h: 44 };
export const MUTE_BTN = { x: 20, y: 22, w: 44, h: 44 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// relic reward cards reuse the draft card spacing
export function perkCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: 380, w: CARD_W, h: 200 };
}
// The box is a fixed window into a horizontally scrolling row — catches can
// outgrow 540px, so the row scrolls instead of centering off-screen.
export const BOX_STRIP = { x: 24, y: 640, w: W - 48, h: 56 };
const BOX_SLOT = 56;
const BOX_GAP = 10;
export function boxScrollMax(n: number) {
  return Math.max(0, n * (BOX_SLOT + BOX_GAP) - BOX_GAP - BOX_STRIP.w);
}
export function boxSlotRect(i: number, n: number, scroll = 0) {
  const content = n * (BOX_SLOT + BOX_GAP) - BOX_GAP;
  const off = Math.max(0, (BOX_STRIP.w - content) / 2);
  return { x: BOX_STRIP.x + off + i * (BOX_SLOT + BOX_GAP) - scroll, y: BOX_STRIP.y, w: BOX_SLOT, h: BOX_SLOT };
}
// Path choice on the reward screen: 0 = safe route, 1 = elite road.
export function pathBtnRect(i: number) {
  const w = 210, gap = 16;
  return { x: W / 2 - (w + gap / 2) + i * (w + gap), y: 898, w, h: 44 };
}
export function teamSlotRect(i: number) {
  const w = 100, gap = 14;
  return { x: W / 2 - (4 * (w + gap) - gap) / 2 + i * (w + gap), y: 772, w, h: 70 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Card chrome: dark indigo panel. Shared border language — a hairline
// dark edge with a light inner rim — on cards, chips and panels.
const GOLD = '#c8a44d';
const PARCH = '#f0e6c8';


function edge(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, rad: number) {
  ctx.strokeStyle = '#0a0d18';
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.stroke();
}

function rim(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  rad: number,
  color: string,
  lw = 1.5,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, Math.max(1, rad - 2));
  ctx.stroke();
}

// joker frame: pale rim inside a thin dark edge
function cardFrame(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, rad: number) {
  rim(ctx, r, rad, '#e8ecf8', 3);
  edge(ctx, r, rad);
}

// Balatro-ish card face: dark panel with a type-colored glow behind the
// art and an edge vignette. Reusable for any card that wants to show a type.
function cardFace(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  type: PokeType,
) {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  ctx.fillStyle = '#12162b';
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const gx = r.x + r.w / 2;
  const gy = r.y + r.h * 0.42;
  const c = TYPE_COLOR[type];
  const glow = ctx.createRadialGradient(gx, gy, 8, gx, gy, r.w * 0.95);
  glow.addColorStop(0, `${c}66`);
  glow.addColorStop(1, `${c}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const vig = ctx.createRadialGradient(gx, r.y + r.h / 2, r.w * 0.35, gx, r.y + r.h / 2, r.w * 1.05);
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(1, '#00000055');
  ctx.fillStyle = vig;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean) {
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = on ? '#1b2140' : '#12152b';
  ctx.fill();
  rim(ctx, r, 10, GOLD);
  edge(ctx, r, 10);
  ctx.font = font(13);
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? PARCH : '#6a7090';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 5);
}

// --- title screen: mottled grass pitch, stadium ring of mons, arched wordmark ---

// UI font: Roboto Condensed bold — the broadcast-graphics look — vendored
// as a variable TTF in public/fonts; monospace is the boot/failure fallback.
const PIXEL_FONT = 'rc, monospace';
const FONT_SCALE = 1.15;
export const font = (px: number) => `700 ${Math.round(px * FONT_SCALE)}px ${PIXEL_FONT}`;

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Mons standing the ring around the logo — all ids are in ALL_SPRITE_IDS.
const RING_MONS: [number, number][] = [
  [143, 82], // Snorlax anchors the top
  [149, 58], [6, 62], [130, 66], [150, 60], [94, 52],
  [76, 56], [3, 58], [9, 56], [68, 58], [59, 58], [131, 60],
];

// Wild mons at the field edges, clear of the ring — [id, x, y]
const WILD_MONS: [number, number, number][] = [
  [16, 484, 118],
  [43, 52, 636],
  [52, 488, 640],
  [19, 72, 852],
  [41, 476, 856],
];

// A clean flat-grass tile of the gracidea tileset, blurred up and
// mirror-tiled into a seamless patch — the soft mottled pitch.
const GRASS_SRC = { x: 20, y: 308, w: 14, h: 14 };
let fieldPattern: CanvasPattern | null = null;

function drawField(ctx: CanvasRenderingContext2D) {
  const img = gracidea();
  if (img && !fieldPattern) {
    // two upscale passes — the tile's speckle melts into soft mottle
    const soft = document.createElement('canvas');
    soft.width = soft.height = 96;
    soft.getContext('2d')!.drawImage(img, GRASS_SRC.x, GRASS_SRC.y, GRASS_SRC.w, GRASS_SRC.h, 0, 0, 96, 96);
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 480;
    const t = c.getContext('2d')!;
    for (const mx of [0, 1])
      for (const my of [0, 1]) {
        t.save();
        t.translate(mx ? 480 : 0, my ? 480 : 0);
        t.scale(mx ? -1 : 1, my ? -1 : 1);
        t.drawImage(soft, 0, 0, 240, 240);
        t.restore();
      }
    fieldPattern = ctx.createPattern(c, 'repeat');
  }
  if (fieldPattern) {
    ctx.fillStyle = fieldPattern;
    ctx.fillRect(0, 0, W, H);
    // wash of pitch green — subdues the tile speckle to a faint texture
    ctx.fillStyle = 'rgba(62,124,54,0.65)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#3e8e3c';
    ctx.fillRect(0, 0, W, H);
  }
  // broad mowing patches — the soft tonal drift of a real field
  for (const [x, y, r, c] of [
    [140, 200, 200, 'rgba(255,255,200,0.07)'],
    [430, 540, 230, 'rgba(255,255,200,0.06)'],
    [130, 780, 180, 'rgba(16,52,16,0.10)'],
    [420, 90, 170, 'rgba(16,52,16,0.08)'],
  ] as const) {
    const rg = ctx.createRadialGradient(x, y, 10, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function monShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(8,24,8,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.42, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Ring mons stand on the pitch ellipse; nearer ones (lower) are a touch
// larger so the field reads with some depth.
function drawRingMons(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  RING_MONS.forEach(([id, size], i) => {
    const a = -Math.PI / 2 + (i / RING_MONS.length) * Math.PI * 2;
    const s = size * (1 + Math.sin(a) * 0.22);
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    monShadow(ctx, x, y, s);
    drawMon(ctx, id, x, y - s * 0.05, s);
  });
}

// Big leaning wordmark: gold gradient fill, navy outline, hard drop shadow.
function logoBig(ctx: CanvasRenderingContext2D, text: string, cx: number, baseY: number, size: number, maxW: number) {
  ctx.save();
  ctx.font = font(size);
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.max(8, Math.floor(size * (maxW / w)));
    ctx.font = font(size);
  }
  ctx.translate(cx, baseY);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(0, -size, 0, 0);
  grad.addColorStop(0, '#ffe76a');
  grad.addColorStop(1, '#f5a614');
  ctx.lineWidth = Math.max(4, size * 0.16);
  ctx.strokeStyle = '#16244d';
  ctx.fillStyle = 'rgba(8,16,40,0.5)';
  ctx.fillText(text, 5, 7);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawWildMons(ctx: CanvasRenderingContext2D) {
  WILD_MONS.forEach(([id, x, y]) => {
    monShadow(ctx, x, y, 34);
    drawMon(ctx, id, x, y, 34);
  });
}

export function drawTitle(ctx: CanvasRenderingContext2D) {
  drawField(ctx);
  drawWildMons(ctx);

  const cx = W / 2;
  const cy = 396;

  // stadium pitch marking — the mons stand on the circle line
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 240, 266, 0, 0, Math.PI * 2);
  ctx.stroke();

  drawRingMons(ctx, cx, cy, 240, 266);

  const ball = itemSprite('poke-ball');
  if (ball) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ball, cx - 122, cy - 122, 244, 244);
    ctx.restore();
  }
  logoArc(ctx, 'POKÉ', cx, cy + 100, 190, 86);
  logoBig(ctx, 'STRIKE', cx, cy + 148, 86, 440);

  // stadium shadow at the edges keeps the eye on the crest
  const vig = ctx.createRadialGradient(cx, cy, 280, cx, cy, 640);
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(1, 'rgba(6,14,6,0.2)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  button(ctx, FREE_BTN, 'FREE PLAY', true);
  button(ctx, DAILY_BTN, 'DAILY CLIMB', true);

  // ? badge, top corner — the how-to-play overlay
  ctx.beginPath();
  ctx.arc(HELP_BTN.x + HELP_BTN.w / 2, HELP_BTN.y + HELP_BTN.h / 2, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#12152b';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = font(16);
  ctx.fillStyle = PARCH;
  ctx.fillText('?', HELP_BTN.x + HELP_BTN.w / 2, HELP_BTN.y + HELP_BTN.h / 2 + 6);

  // mute badge, opposite corner — speaker glyph, slashed when off
  const mcx = MUTE_BTN.x + MUTE_BTN.w / 2, mcy = MUTE_BTN.y + MUTE_BTN.h / 2;
  ctx.beginPath();
  ctx.arc(mcx, mcy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#12152b';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PARCH;
  ctx.beginPath();
  ctx.moveTo(mcx - 8, mcy - 3);
  ctx.lineTo(mcx - 3, mcy - 3);
  ctx.lineTo(mcx + 2, mcy - 8);
  ctx.lineTo(mcx + 2, mcy + 8);
  ctx.lineTo(mcx - 3, mcy + 3);
  ctx.lineTo(mcx - 8, mcy + 3);
  ctx.closePath();
  ctx.fill();
  if (isMuted()) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mcx - 4, mcy - 7);
    ctx.lineTo(mcx + 9, mcy + 7);
    ctx.moveTo(mcx + 9, mcy - 7);
    ctx.lineTo(mcx - 4, mcy + 7);
    ctx.stroke();
  } else {
    ctx.strokeStyle = PARCH;
    ctx.lineWidth = 2;
    for (const rr of [6, 10]) {
      ctx.beginPath();
      ctx.arc(mcx + 2, mcy, rr, -0.9, 0.9);
      ctx.stroke();
    }
  }
  // the seed in plaintext — players can tell which day's climb they're on
  const now = new Date();
  ctx.font = font(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    `${MONTH_ABBR[now.getMonth()]} ${now.getDate()}`,
    W / 2,
    DAILY_BTN.y + DAILY_BTN.h + 22,
  );
  ctx.fillText(`RANK ${rankName()} · DEX ${dexIds().length}`, W / 2, DAILY_BTN.y + DAILY_BTN.h + 36);
}

// --- help overlay: scrollable sections, each a mini diagram + a caption ---

function helpArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.45) * 10, y1 - Math.sin(a - 0.45) * 10);
  ctx.lineTo(x1 - Math.cos(a + 0.45) * 10, y1 - Math.sin(a + 0.45) * 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function demoAim(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const mx = x + w * 0.3, my = y + h * 0.68;
  drawMon(ctx, 7, mx, my, 46);
  // pull-back drag (gold) and the resulting flight (dotted)
  helpArrow(ctx, mx - 6, my + 26, mx - w * 0.2, my + h * 0.28, GOLD);
  helpArrow(ctx, mx + 8, my - 16, x + w * 0.78, y + h * 0.3, '#e8ecf8', [3, 7]);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w * 0.78, y + h * 0.3, 12, 0, Math.PI * 2);
  ctx.stroke();
}

function demoBump(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const ax = x + w * 0.16, ay = y + h * 0.72;
  const bx = x + w * 0.48, by = y + h * 0.3;
  const ex = x + w * 0.82, ey = y + h * 0.62;
  helpArrow(ctx, ax + 16, ay - 18, bx - 14, by + 18, '#e8ecf8', [3, 6]);
  helpArrow(ctx, bx + 16, by + 10, ex - 18, ey - 8, '#ffd84d', [3, 6]);
  drawMon(ctx, 25, ax, ay, 42); // you
  drawMon(ctx, 7, bx, by, 42); // ally — the bumper
  drawMon(ctx, 19, ex, ey, 44); // enemy
  // super burst on the enemy
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a) * 26, ey + Math.sin(a) * 26);
    ctx.lineTo(ex + Math.cos(a) * 34, ey + Math.sin(a) * 34);
    ctx.stroke();
  }
}

function demoCharge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const mx = x + w / 2, my = y + h * 0.42;
  drawMon(ctx, 4, mx, my, 46);
  // hp bar + pip row, same language as the battle HUD
  ctx.fillStyle = '#000a';
  ctx.fillRect(mx - 26, my + 26, 52, 4);
  ctx.fillStyle = '#6fdc6f';
  ctx.fillRect(mx - 26, my + 26, 52 * 0.7, 4);
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k < 3 ? '#ffd84d' : '#2a3560';
    ctx.fillRect(mx - 26 + k * 14, my + 36, 10, 5);
  }
}

function demoCountdown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const spots: [number, number, string, string][] = [
    [0.3, 0.55, '2', '#ffffff'],
    [0.7, 0.5, '1', '#ff6b6b'],
  ];
  for (const [fx, fy, n, c] of spots) {
    const mx = x + w * fx, my = y + h * fy;
    drawMon(ctx, n === '1' ? 41 : 43, mx, my, 44);
    ctx.font = font(14);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0d18';
    ctx.fillText(n, mx + 1, my - 30 + 1);
    ctx.fillStyle = c;
    ctx.fillText(n, mx, my - 30);
  }
}

function demoWeak(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const mx = x + w * 0.42, my = y + h * 0.55;
  drawMon(ctx, 149, mx, my, 60);
  // the gold diamond rides the body — hit that face for x3
  const wx = mx + 20, wy = my - 16, s = 8;
  ctx.fillStyle = '#ffd84d';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wx, wy - s);
  ctx.lineTo(wx + s, wy);
  ctx.lineTo(wx, wy + s);
  ctx.lineTo(wx - s, wy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = font(10);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd84d';
  ctx.fillText('×3', x + w * 0.66, my + 4);
}

function demoPickups(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const kinds: [string, string][] = [
    ['oran-berry', 'HEAL'],
    ['protein', 'ATK UP'],
    ['elixir', 'CD -1'],
  ];
  ctx.font = font(8);
  ctx.textAlign = 'center';
  kinds.forEach(([item, lab], i) => {
    const ix = x + w * (0.22 + i * 0.28), iy = y + h * 0.42;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.ellipse(ix, iy + 18, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const img = itemSprite(item);
    if (img) ctx.drawImage(img, ix - 15, iy - 15, 30, 30);
    ctx.fillStyle = PARCH;
    ctx.fillText(lab, ix, iy + 34);
  });
}

function demoCatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const mx = x + w * 0.3, my = y + h * 0.52;
  drawMon(ctx, 16, mx, my, 46);
  ctx.fillStyle = '#000a';
  ctx.fillRect(mx - 24, my + 26, 48, 4);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(mx - 24, my + 26, 48 * 0.2, 4);
  const ball = itemSprite('poke-ball');
  const bx = x + w * 0.68, by = y + h * 0.5;
  if (ball) ctx.drawImage(ball, bx - 16, by - 16, 32, 32);
  helpArrow(ctx, mx + 30, my, bx - 22, by, '#e8ecf8', [3, 6]);
}

function demoClimb(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const n = 9, gap = (w * 0.7) / (n - 1), x0 = x + w * 0.15, my = y + h * 0.5;
  for (let i = 0; i < n; i++) {
    const px = x0 + i * gap;
    const gym = (i + 1) % 3 === 0;
    ctx.fillStyle = i < 3 ? '#ffd84d' : '#3a4066';
    if (gym) {
      ctx.beginPath();
      ctx.moveTo(px, my - 8);
      ctx.lineTo(px + 7, my);
      ctx.lineTo(px, my + 8);
      ctx.lineTo(px - 7, my);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px, my, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

interface HelpSection {
  title: string;
  lines: string[];
  demo: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'AIM & POWER',
    lines: ['drag back from your mon — the dotted line is the flight path', 'release inside the gold zone for a full-power shot'],
    demo: demoAim,
  },
  {
    title: 'BUMP COMBOS',
    lines: ['bounce off a teammate mid-flight to trigger their super', 'every link in the chain adds damage — route through allies'],
    demo: demoBump,
  },
  {
    title: 'CHARGE PIPS',
    lines: ['hits and KOs fill the gold pips under each mon', 'all-gold pips means READY — the move name pulses'],
    demo: demoCharge,
  },
  {
    title: 'ENEMY COUNTDOWN',
    lines: ['enemies strike when the number over them hits zero', 'melee mons attack sooner — thin them out first'],
    demo: demoCountdown,
  },
  {
    title: 'WEAK POINTS',
    lines: ['elites and bosses carry a gold diamond on one face', 'hit the marked face for triple contact damage'],
    demo: demoWeak,
  },
  {
    title: 'FIELD PICKUPS',
    lines: ['roll the ball through them — they collect on touch', 'one spawns each wave, two when something big lurks'],
    demo: demoPickups,
  },
  {
    title: 'CATCHING',
    lines: ['beaten foes sometimes drop a ball — catches go to your box', 'a duplicate evolves or feeds the copy you already own'],
    demo: demoCatch,
  },
  {
    title: 'THE CLIMB',
    lines: ['9 stages, a gym leader every 3rd — diamonds on the map', 'a relic after every clear; rolled stages offer a riskier elite road'],
    demo: demoClimb,
  },
];

const HELP_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
const HELP_HEAD = 64; // title band inside the panel
const HELP_FOOT = 40; // footer hint band
const HELP_SECTION_H = 186; // heading + 104 demo box + 2 caption lines + gap
const HELP_CONTENT_H = HELP_SECTIONS.length * HELP_SECTION_H;

export function helpScrollMax() {
  return Math.max(0, HELP_CONTENT_H - (HELP_PANEL.h - HELP_HEAD - HELP_FOOT));
}

export function drawHelp(ctx: CanvasRenderingContext2D, scroll: number) {
  const r = HELP_PANEL;
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 14);

  ctx.textAlign = 'center';
  ctx.font = font(17);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText('HOW TO PLAY', r.x + r.w / 2, r.y + 42);

  // scrollable body
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + HELP_HEAD, r.w - 16, r.h - HELP_HEAD - HELP_FOOT);
  ctx.clip();
  HELP_SECTIONS.forEach((s, i) => {
    const sy = r.y + HELP_HEAD + 10 + i * HELP_SECTION_H - scroll;
    const dx = r.x + 22, dw = r.w - 44;
    ctx.font = font(11);
    ctx.fillStyle = GOLD;
    ctx.fillText(s.title, r.x + r.w / 2, sy + 12);

    const dy = sy + 22;
    roundRect(ctx, dx, dy, dw, 104, 10);
    ctx.fillStyle = '#0d1126';
    ctx.fill();
    ctx.save();
    roundRect(ctx, dx, dy, dw, 104, 10);
    ctx.clip();
    s.demo(ctx, dx, dy, dw, 104);
    ctx.restore();

    ctx.font = font(9);
    ctx.fillStyle = PARCH;
    s.lines.forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, dy + 128 + li * 15));
  });
  ctx.restore();

  // scroll track — a thumb hints there's more when the list is long
  if (helpScrollMax() > 0) {
    const trackY = r.y + HELP_HEAD, trackH = r.h - HELP_HEAD - HELP_FOOT;
    const th = Math.max(30, (trackH / (HELP_CONTENT_H + trackH)) * trackH);
    const ty = trackY + (scroll / helpScrollMax()) * (trackH - th);
    ctx.fillStyle = '#2a3560';
    ctx.fillRect(r.x + r.w - 12, trackY, 3, trackH);
    ctx.fillStyle = GOLD;
    ctx.fillRect(r.x + r.w - 12, ty, 3, th);
  }

  ctx.font = font(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('scroll to read · tap to close', r.x + r.w / 2, r.y + r.h - 16);
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6, null, true);

  ctx.textAlign = 'center';
  ctx.font = font(18);
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`DRAFT — PICK ${picked.length + 1} OF 4`, W / 2, 120);
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(stageName, W / 2, 155);
  ctx.fillText('one of three — choose for coverage and speed', W / 2, 180);

  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    // lifted-card shadow, then the face
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 10);
    ctx.fill();
    cardFace(ctx, r, def.type);
    cardFrame(ctx, r, 10);

    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 94, 84);

    // trait tag rides the top-right corner
    if (def.pierce || def.copy) {
      ctx.textAlign = 'right';
      ctx.font = font(8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 8, r.y + 19);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 9, r.y + 18);
    }

    // name + dex number, kept centered as one unit
    ctx.font = font(13);
    const nw = ctx.measureText(def.name).width;
    ctx.font = font(8);
    const idTxt = `#${String(def.id).padStart(3, '0')}`;
    const nx = r.x + r.w / 2 - (nw + 5 + ctx.measureText(idTxt).width) / 2;
    ctx.textAlign = 'left';
    ctx.font = font(13);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(def.name, nx + 1, r.y + 181);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name, nx, r.y + 180);
    ctx.font = font(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(idTxt, nx + nw + 5, r.y + 180);
    ctx.textAlign = 'center';

    const role = roleOf(def.stats, def.healer);
    ctx.font = font(9);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${role.toUpperCase()}`, r.x + r.w / 2, r.y + 198);

    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + 14, r.y + 208);
    ctx.lineTo(r.x + r.w - 14, r.y + 208);
    ctx.stroke();

    // broadcast stat readout — 3x2 label+number pairs
    const st = def.stats;
    const cells: [string, number][] = [
      ['HP', st.hp], ['ATK', st.atk], ['DEF', st.def],
      ['SPA', st.spa], ['SPD', st.spd], ['SPE', st.spe],
    ];
    ctx.font = font(8);
    ctx.textAlign = 'left';
    cells.forEach(([lab, v], k) => {
      const cx = r.x + 12 + ((r.w - 24) / 6) * (2 * (k % 3) + 1);
      const cy = r.y + 224 + ((k / 3) | 0) * 16;
      const lw = ctx.measureText(lab).width;
      const vw = ctx.measureText(`${v}`).width;
      const tx = cx - (lw + 3 + vw) / 2;
      ctx.fillStyle = '#8890b8';
      ctx.fillText(lab, tx, cy);
      ctx.fillStyle = PARCH;
      ctx.fillText(`${v}`, tx + lw + 3, cy);
    });
    ctx.textAlign = 'center';
  });

  // picked team strip
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 640);
  for (let i = 0; i < 4; i++) {
    const sx = W / 2 - 4 * 44 + i * 88;
    const sr = { x: sx, y: 660, w: 76, h: 90 };
    roundRect(ctx, sr.x, sr.y, sr.w, sr.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, sr, 10, '#2a3560', 1);
    edge(ctx, sr, 10);
    const def = picked[i];
    if (def) {
      drawMon(ctx, def.id, sx + 38, 692, 48);
      ctx.font = font(8);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name, sx + 38, 740);
    }
  }

  ctx.font = font(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('tip: bounce off allies to trigger their attack', W / 2, 810);
}

export interface ShareGrid {
  waves: string; // emoji squares, one per wave
  team: string; // emoji squares, one per drafted mon
  copied: boolean;
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number) {
  ctx.fillStyle = '#000a';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = frac > 0.5 ? '#6fdc6f' : frac > 0.25 ? '#ffd84d' : '#ff6b6b';
  ctx.fillRect(x, y, w * Math.max(frac, 0), 4);
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  offers: { name: string; item: string; desc: string; rarity: Rarity }[],
  box: SpeciesDef[],
  boxHp: number[],
  team: SpeciesDef[],
  teamHp: number[],
  selBox: number,
  boxScroll: number,
  catchPct: number,
  recruit: SpeciesDef | null,
  next: { stage: number; gym: boolean; rolled: boolean },
  pathElite: boolean,
) {
  ctx.fillStyle = '#0b0e1ad8';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // the stage's guaranteed catch announces itself — beat a gym, take the ace
  if (recruit) {
    drawMon(ctx, recruit.id, W / 2 - 120, 250, 44);
    ctx.font = font(10);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`${recruit.name.toUpperCase()} JOINS YOUR BOX!`, W / 2 + 40, 258);
  }

  ctx.font = font(20);
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE A RELIC', W / 2, 300);
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    next.gym
      ? `stage ${next.stage} of ${TOTAL_STAGES} — a gym leader waits`
      : `stage ${next.stage} of ${TOTAL_STAGES} — the waves get meaner`,
    W / 2,
    335,
  );

  offers.forEach((perk, i) => {
    const r = perkCardRect(i);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 10);
    ctx.fill();
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    cardFrame(ctx, r, 10);
    ctx.fillStyle = RARITY_COLOR[perk.rarity];
    ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, 5);

    const img = itemSprite(perk.item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, r.x + r.w / 2 - 21, r.y + 45, 42, 42);
      ctx.restore();
    } else {
      ctx.font = font(16);
      ctx.fillStyle = PARCH;
      ctx.fillText('?', r.x + r.w / 2, r.y + 74);
    }
    ctx.font = font(10);
    ctx.fillStyle = PARCH;
    ctx.fillText(perk.name, r.x + r.w / 2, r.y + 118);
    ctx.font = font(8);
    ctx.fillStyle = RARITY_COLOR[perk.rarity];
    ctx.fillText(perk.rarity.toUpperCase(), r.x + r.w / 2, r.y + 135);
    ctx.font = font(8);
    ctx.fillStyle = '#a8b0d8';
    // two-line desc
    const words = perk.desc.split(' ');
    const mid = Math.ceil(words.length / 2);
    ctx.fillText(words.slice(0, mid).join(' '), r.x + r.w / 2, r.y + 150);
    ctx.fillText(words.slice(mid).join(' '), r.x + r.w / 2, r.y + 168);
  });

  // captured box — tap a catch, then a teammate, to swap
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX — catch rate ${Math.round(catchPct * 100)}%`, W / 2, 620);
  if (box.length === 0) {
    ctx.font = font(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('nothing caught yet — defeats sometimes capture', W / 2, 668);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOX_STRIP.x - 4, BOX_STRIP.y - 6, BOX_STRIP.w + 8, BOX_STRIP.h + 12);
  ctx.clip();
  box.forEach((def, i) => {
    const r = boxSlotRect(i, box.length, boxScroll);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, r, 8, i === selBox ? '#ffd84d' : '#2a3560', i === selBox ? 2 : 1);
    edge(ctx, r, 8);
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 23, 38);
    hpBar(ctx, r.x + 6, r.y + 42, r.w - 12, boxHp[i] ?? 1);
    ctx.font = font(8);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, r.y + 54);
  });
  ctx.restore();
  const maxScroll = boxScrollMax(box.length);
  if (maxScroll > 0) {
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    if (boxScroll > 0) ctx.fillText('◀', BOX_STRIP.x - 14, BOX_STRIP.y + 34);
    if (boxScroll < maxScroll) ctx.fillText('▶', BOX_STRIP.x + BOX_STRIP.w + 14, BOX_STRIP.y + 34);
  }

  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 750);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, r, 8, selBox >= 0 ? GOLD : '#2a3560', 1);
    edge(ctx, r, 8);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(r.x + 5, r.y + 5, r.w - 10, 3);
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 30, 40);
    hpBar(ctx, r.x + 8, r.y + 54, r.w - 16, teamHp[i] ?? 1);
    ctx.font = font(8);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.slice(0, 12), r.x + r.w / 2, r.y + 67);
  });
  ctx.font = font(8);
  ctx.fillStyle = '#5a6284';
  ctx.fillText(
    selBox >= 0 ? 'tap a teammate to swap in' : 'tap a box mon, then a teammate',
    W / 2,
    880,
  );

  // path choice — StS greed: the safe route, or the elite road (bigger
  // fight, richer relics, a guaranteed elite to catch). Fixed stages and
  // gyms just show what's next.
  ctx.font = font(8);
  if (next.gym) {
    ctx.fillStyle = '#f85888';
    ctx.fillText('NEXT: GYM LEADER', W / 2, 926);
  } else if (next.rolled) {
    button(ctx, pathBtnRect(0), 'ROUTE', !pathElite);
    button(ctx, pathBtnRect(1), 'ELITE ★', pathElite);
  } else {
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`NEXT: STAGE ${next.stage}`, W / 2, 926);
  }
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  res: RunResult,
  extra: string | null,
  share: ShareGrid | null,
) {
  ctx.fillStyle = '#0b0e1add';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = font(26);
  ctx.fillStyle = res.won ? '#6fdc6f' : '#ff6b6b';
  ctx.fillText(res.won ? 'STAGE CLEAR!' : 'WIPED OUT', W / 2, 300);

  ctx.font = font(10);
  ctx.fillStyle = '#fff';
  ctx.fillText(
    `${res.shots} shots · ${res.time.toFixed(1)}s${res.caught ? ` · ${res.caught} caught` : ''}`,
    W / 2,
    355,
  );
  if (extra) {
    ctx.font = font(11);
    ctx.fillStyle = '#f8d030';
    ctx.fillText(extra, W / 2, 395);
  }

  // run badges — rarity-colored chips, up to two rows
  const badgeRows: { name: string; rarity: Rarity }[][] = [[]];
  for (const b of res.badges) {
    const row = badgeRows[badgeRows.length - 1];
    if (row.length >= 4) badgeRows.push([b]);
    else row.push(b);
  }
  badgeRows.forEach((row, ri) => {
    const y = 428 + ri * 28;
    ctx.font = font(8);
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      const br = { x: bx, y, w: ws[i], h: 20 };
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      rim(ctx, br, 5, RARITY_COLOR[b.rarity]);
      edge(ctx, br, 5);
      ctx.font = font(8);
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      ctx.fillText(b.name, bx + ws[i] / 2, y + 14);
      bx += ws[i] + 8;
    });
  });

  if (share) {
    const sy = 460 + badgeRows.length * 28;
    ctx.font = '30px system-ui';
    ctx.fillText(share.waves, W / 2, sy);
    ctx.font = '24px system-ui';
    ctx.fillText(share.team, W / 2, sy + 42);
  }

  button(ctx, RETRY_BTN, 'PLAY AGAIN', true);
  button(ctx, SHARE_BTN, share?.copied ? 'COPIED!' : 'SHARE RESULT', true);
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, shots: number, stageName: string) {
  ctx.fillStyle = '#8890b8';
  ctx.font = font(9);
  ctx.textAlign = 'left';
  ctx.fillText(stageName, 30, 44);
  // run map in miniature: a pip per stage, gyms as diamonds — the whole
  // 9-stage climb is visible from the first fight
  const gap = 22;
  const x0 = W / 2 - ((TOTAL_STAGES - 1) * gap) / 2;
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const x = x0 + i * gap;
    const y = 40;
    const gym = (i + 1) % 3 === 0;
    ctx.fillStyle = i < wave ? '#ffd84d' : i === wave ? '#ffffff' : '#3a4066';
    if (gym) {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
}
