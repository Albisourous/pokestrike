import { itemSprite, loadItem, drawMon, drawShiny, drawNpc, gracidea } from '../core/assets';
import { isMuted } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES, ENEMY_DB, ELITES, INVADERS, ROSTER, speciesById, LEADER_NPC } from './data';
import { RARITY_COLOR } from './perks';
import type { Perk, Rarity } from './perks';
import { drawBackdrop } from './bg';
import { TYPE_COLOR, type PokeType } from './types';
import { roleOf, moveOf, superDesc } from './stats';
import { dexIds, shinyIds, rankName, best, shinyCharm, SHINY_CHARM_AT, ACHIEVEMENTS, unlockedAch, dailyBest, BADGES, gymBadges, badgeOf } from './meta';

export const W = 540;
export const H = 960;

// species that can ever drop a ball — the dex completion denominator
// (roster mons count too: a rival echo can field them and they can be caught)
const DEX_LIST = [...new Map([...ROSTER, ...ENEMY_DB, ...ELITES, ...INVADERS].map((s) => [s.id, s])).values()].sort(
  (a, b) => a.id - b.id,
);
export const CATCHABLE = DEX_LIST.length;

export interface RunResult {
  won: boolean;
  shots: number;
  time: number;
  caught: number;
  score: number;
  badges: { name: string; rarity: Rarity }[];
  team: SpeciesDef[]; // final lineup — survives mid-run box swaps
  newBest: boolean; // the run just beat the saved best score
  newDex: number; // fresh dex entries this run added
  mvpIdx: number; // highest-level mon — crowned on the team row
  shortOfBest: number; // pts shy of the record, when it was close
  newAch: string[]; // trophy names this run just unlocked
}

// --- draft layout: 3 offer cards, team strip at the bottom ---

const CARD_W = 162;
const CARD_H = 264;
const CARD_GAP = 9;
const CARDS_X = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
const CARDS_Y = 300;

export function draftCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: CARDS_Y, w: CARD_W, h: CARD_H };
}
export const DRAFT_REROLL = { x: W / 2 - 85, y: CARDS_Y + CARD_H + 16, w: 170, h: 40 };
// slot-reel reveal: each offer card spins a strip of pool faces that brakes
// onto the dealt mon — staggered left to right. Spin age counts seconds.
export const DRAFT_STOPS = [0.7, 1.0, 1.3];

export const RETRY_BTN = { x: W / 2 - 110, y: 620, w: 220, h: 64 };
export const SHARE_BTN = { x: W / 2 - 110, y: 700, w: 220, h: 54 };
export const TITLE_BTN = { x: W / 2 - 80, y: 772, w: 160, h: 44 };
export const FREE_BTN = { x: W / 2 - 140, y: 740, w: 280, h: 64 };
// everyone's island for the day — one seed, shared climb
export const DAILY_BTN = { x: W / 2 - 90, y: FREE_BTN.y + FREE_BTN.h + 12, w: 180, h: 44 };
export const HELP_BTN = { x: W - 64, y: 22, w: 44, h: 44 };
// the same ? badge shrunk for mid-run lookups — shown between fights
// (map + reward), where a player actually wants the reference
export const HELP_CHIP = { x: W - 58, y: 54, w: 40, h: 40 };
export function drawHelpChip(ctx: CanvasRenderingContext2D) {
  const cx = HELP_CHIP.x + HELP_CHIP.w / 2;
  const cy = HELP_CHIP.y + HELP_CHIP.h / 2;
  ctx.fillStyle = '#12152bcc';
  ctx.fillRect(HELP_CHIP.x, HELP_CHIP.y, HELP_CHIP.w, HELP_CHIP.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(HELP_CHIP.x, HELP_CHIP.y, HELP_CHIP.w, HELP_CHIP.h);
  ctx.font = font(12);
  ctx.fillStyle = PARCH;
  ctx.textAlign = 'center';
  ctx.fillText('?', cx, cy + 6);
}
export const MUTE_CHIP = { x: W - 100, y: 54, w: 40, h: 40 };
export function drawMuteChip(ctx: CanvasRenderingContext2D) {
  const cx = MUTE_CHIP.x + MUTE_CHIP.w / 2;
  const cy = MUTE_CHIP.y + MUTE_CHIP.h / 2;
  ctx.fillStyle = '#12152bcc';
  ctx.fillRect(MUTE_CHIP.x, MUTE_CHIP.y, MUTE_CHIP.w, MUTE_CHIP.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MUTE_CHIP.x, MUTE_CHIP.y, MUTE_CHIP.w, MUTE_CHIP.h);
  speakerGlyph(ctx, cx, cy, 0.72);
}
export const MUTE_BTN = { x: 20, y: 22, w: 44, h: 44 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// item reward cards reuse the draft card spacing
export function perkCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: 380, w: CARD_W, h: 200 };
}
export const CHARM_SKIP = { x: W / 2 - 90, y: 592, w: 180, h: 40 };
export const REWARD_SKIP = { x: W - 152, y: 904, w: 134, h: 40 };
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
export function teamSlotRect(i: number) {
  const w = 100, gap = 14;
  return { x: W / 2 - (4 * (w + gap) - gap) / 2 + i * (w + gap), y: 772, w, h: 70 };
}

// split-evolution option cards — centered row over the dimmed reward screen
export function evoCardRect(i: number, n: number) {
  const w = 140, gap = 14;
  return { x: W / 2 - (n * w + (n - 1) * gap) / 2 + i * (w + gap), y: 400, w, h: 184 };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

// speaker glyph + slash — shared by the title badge and the mid-run chip
function speakerGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.fillStyle = PARCH;
  ctx.beginPath();
  ctx.moveTo(cx - 8 * s, cy - 3 * s);
  ctx.lineTo(cx - 3 * s, cy - 3 * s);
  ctx.lineTo(cx + 2 * s, cy - 8 * s);
  ctx.lineTo(cx + 2 * s, cy + 8 * s);
  ctx.lineTo(cx - 3 * s, cy + 3 * s);
  ctx.lineTo(cx - 8 * s, cy + 3 * s);
  ctx.closePath();
  ctx.fill();
  if (isMuted()) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s, cy - 7 * s);
    ctx.lineTo(cx + 9 * s, cy + 7 * s);
    ctx.moveTo(cx + 9 * s, cy - 7 * s);
    ctx.lineTo(cx - 4 * s, cy + 7 * s);
    ctx.stroke();
  } else {
    ctx.strokeStyle = PARCH;
    ctx.lineWidth = 2 * s;
    for (const rr of [6, 10]) {
      ctx.beginPath();
      ctx.arc(cx + 2 * s, cy, rr * s, -0.9, 0.9);
      ctx.stroke();
    }
  }
}


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

// ordered-dither stipple — a 2x2 checker of dark pixels, the handheld
// texture trick; lays over panel faces at low alpha
let ditherPat: CanvasPattern | null = null;
function dither(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, alpha: number) {
  if (!ditherPat) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const t = c.getContext('2d')!;
    t.fillStyle = '#000';
    t.fillRect(0, 0, 1, 1);
    t.fillRect(1, 1, 1, 1);
    ditherPat = ctx.createPattern(c, 'repeat');
  }
  if (!ditherPat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ditherPat;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// shrink a label's px until it fits a width — pixel type runs wide
export function fitFont(ctx: CanvasRenderingContext2D, label: string, px: number, maxW: number) {
  let size = px;
  ctx.font = font(size);
  while (size > 6 && ctx.measureText(label).width > maxW) ctx.font = font(--size);
  return size;
}

// greedy word-wrap into at most two lines at the current font — descs are
// short enough that a third line never earns its keep
export function wrap2(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  let first = '';
  let used = 0;
  while (used < words.length && ctx.measureText(first ? `${first} ${words[used]}` : words[used]).width <= maxW) {
    first = first ? `${first} ${words[used]}` : words[used];
    used++;
  }
  return [first, words.slice(used).join(' ')];
}

// arcade cabinet button: hard corners, solid offset block the face presses into
export function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean, icon?: string) {
  ctx.fillStyle = '#0a0d18';
  ctx.fillRect(r.x + 4, r.y + 4, r.w, r.h);
  ctx.fillStyle = on ? '#1b2140' : '#12152b';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  dither(ctx, r, on ? 0.09 : 0.05);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const ic = icon ? 42 : 0; // an icon claims the left edge — text centers in what's left
  fitFont(ctx, label, 13, r.w - 20 - ic);
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? PARCH : '#6a7090';
  ctx.fillText(label, r.x + ic + (r.w - ic) / 2, r.y + r.h / 2 + 6);
  if (icon) {
    void loadItem(icon);
    const img = itemSprite(icon);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.drawImage(img, r.x + 10, r.y + (r.h - 32) / 2, 32, 32);
      ctx.restore();
    }
  }
}

// --- title screen: mottled grass pitch, stadium ring of mons, arched wordmark ---

// UI font: Press Start 2P — the Gen-3 handheld look — vendored in
// public/fonts; Roboto Condensed and monospace are the failure fallbacks.
const PIXEL_FONT = 'ps2p, rc, monospace';
const FONT_SCALE = 1.4;
export const font = (px: number) => `400 ${Math.round(px * FONT_SCALE)}px ${PIXEL_FONT}`;
// dense small print stays in the narrow face — the pixel font runs ~1.7x wider
export const fontB = (px: number) => `700 ${Math.round(px * FONT_SCALE)}px rc, monospace`;

// Mons standing the ring around the logo — all draft-pool faces (ROSTER),
// so the title shows who you'll actually sling, not legendaries you'll never
// be offered. All ids are in ALL_SPRITE_IDS.
const RING_MONS: [number, number][] = [
  [95, 82], // Onix anchors the top
  [4, 58], [7, 62], [1, 60], [25, 60], [133, 52],
  [66, 56], [39, 58], [92, 56], [129, 58], [183, 58], [403, 60],
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
  // the real wordmark — vendored logo art, already arched, rides the ball top
  const logo = itemSprite('ui/pokemon-logo');
  if (logo) ctx.drawImage(logo, cx - 165, cy - 155, 330, 121);
  logoBig(ctx, 'STRIKE', cx, cy + 148, 64, 320);

  // stadium shadow at the edges keeps the eye on the crest
  const vig = ctx.createRadialGradient(cx, cy, 280, cx, cy, 640);
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(1, 'rgba(6,14,6,0.2)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // the pitch in one line — a stranger gets the loop before they tap a thing
  ctx.font = font(11);
  ctx.fillStyle = '#0a2410';
  ctx.textAlign = 'center';
  ctx.fillText('SLING · BOUNCE · CATCH · CLIMB', W / 2 + 1, FREE_BTN.y - 15);
  ctx.fillStyle = PARCH;
  ctx.fillText('SLING · BOUNCE · CATCH · CLIMB', W / 2, FREE_BTN.y - 16);
  button(ctx, FREE_BTN, 'START CLIMB', true);
  const dBest = dailyBest();
  button(ctx, DAILY_BTN, dBest ? `DAILY · BEST ${dBest}` : 'DAILY CLIMB', true);

  // ? badge, top corner — the how-to-play overlay
  ctx.fillStyle = '#12152b';
  ctx.fillRect(HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h);
  dither(ctx, HELP_BTN, 0.09);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h);
  ctx.font = font(16);
  ctx.fillStyle = PARCH;
  ctx.fillText('?', HELP_BTN.x + HELP_BTN.w / 2, HELP_BTN.y + HELP_BTN.h / 2 + 7);

  // mute badge, opposite corner — speaker glyph, slashed when off
  const mcx = MUTE_BTN.x + MUTE_BTN.w / 2, mcy = MUTE_BTN.y + MUTE_BTN.h / 2;
  ctx.fillStyle = '#12152b';
  ctx.fillRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h);
  dither(ctx, MUTE_BTN, 0.09);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h);
  speakerGlyph(ctx, mcx, mcy, 1);
  // the dex and the trophy shelf share one row — same chrome as the menus
  button(ctx, DEX_BTN, `DEX ${dexIds().length}/${CATCHABLE}`, true);
  button(ctx, ACH_BTN, `★ ${unlockedAch().size}/${ACHIEVEMENTS.length}`, true);
  // the records line is the one-more-run hook — rank and best score
  const b = best();
  const bits = [`RANK ${rankName()}`, `BEST ${b.score.toLocaleString('en-US')}`];
  if (b.wins) bits.push(`ASCENSION ${Math.min(b.wins, 9)}`);
  fitFont(ctx, bits.join(' · '), 8, W - 40);
  ctx.fillStyle = '#aab4dd';
  ctx.fillText(bits.join(' · '), W / 2, DEX_BTN.y + DEX_BTN.h + 22);
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
  // pull-back drag (gold) mirrors the flight path (dotted) through the mon —
  // both arrows start at its edge so the slingshot reads at a glance
  const fx = x + w * 0.78, fy = y + h * 0.3;
  const dl = Math.hypot(fx - mx, fy - my);
  const ux = (fx - mx) / dl, uy = (fy - my) / dl;
  helpArrow(ctx, mx - ux * 24, my - uy * 24, mx - ux * 96, my - uy * 96, GOLD);
  helpArrow(ctx, mx + ux * 24, my + uy * 24, fx - ux * 16, fy - uy * 16, '#e8ecf8', [3, 7]);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(fx, fy, 12, 0, Math.PI * 2);
  ctx.stroke();
  // mini meter: the gold band isn't pinned to the top — it follows the mon
  const bw = w * 0.56, bx = x + w * 0.22, by = y + h * 0.88;
  ctx.fillStyle = '#ffffff1c';
  ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = '#ffd84d55';
  ctx.fillRect(bx + bw * 0.68, by, bw * 0.16, 6);
  ctx.fillStyle = '#58a8f8';
  ctx.fillRect(bx, by, bw * 0.74, 6);
  ctx.fillStyle = '#ffd84d';
  ctx.fillRect(bx + bw * 0.68, by - 2, 2, 10);
  ctx.fillRect(bx + bw * 0.84 - 2, by - 2, 2, 10);
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

function demoHazards(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const spots: [number, string, string][] = [
    [0.25, '#f08030', 'HURT'],
    [0.5, '#b090ff', 'HUSH'],
    [0.75, '#58d858', 'BOOST'],
  ];
  ctx.font = font(8);
  ctx.textAlign = 'center';
  for (const [fx, c, lab] of spots) {
    const hx = x + w * fx, hy = y + h * 0.42;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(hx, hy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PARCH;
    ctx.fillText(lab, hx, hy + 44);
  }
}

function demoTraits(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  drawMon(ctx, 4, x + w * 0.34, y + h * 0.45, 46);
  drawMon(ctx, 6, x + w * 0.66, y + h * 0.45, 46);
  ctx.font = font(9);
  ctx.textAlign = 'center';
  const label = 'FIRE T2';
  const tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(20,26,48,0.9)';
  ctx.fillRect(x + w / 2 - tw / 2, y + h * 0.7, tw, 18);
  ctx.fillStyle = '#f08030';
  ctx.fillText(label, x + w / 2, y + h * 0.7 + 13);
}

interface HelpSection {
  title: string;
  lines: string[];
  demo: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'AIM & POWER',
    lines: [
      'pull back anywhere: the dotted line is the flight path',
      'pull distance only aims — power is the release timing on the meter',
      'let go inside the gold band for a PERFECT full-power shot',
      "the band sits at your mon's own spot: fast ones are high and tight",
      'stronger mons are harder to control — tighter band, faster meter, the top end drifts',
      'on keys: ? help · P pause · M mute · arrows turn pages',
    ],
    demo: demoAim,
  },
  {
    title: 'ALLY CHAINS',
    lines: ['fly through a teammate mid-flight — full pips fire their super', 'each pass adds damage and speed, so route through allies'],
    demo: demoBump,
  },
  {
    title: 'PINCH SHOTS',
    lines: [
      'two different touches — foe, ally, wall, stone — within 0.35s flash PINCH!',
      "hitting the same thing twice doesn't count",
      'relics cash it in: Binding Band pays +40% hit damage, Ether feeds a super pip',
    ],
    demo: demoBump,
  },
  {
    title: 'CHARGE PIPS',
    lines: [
      'shots and KOs fill the gold pips under each mon — all-gold means READY',
      'launch a READY mon and its super fires from the sling (STRIKE SHOT)',
    ],
    demo: demoCharge,
  },
  {
    title: 'ENEMIES',
    lines: [
      'a foe strikes when its number hits 0 — each shot you take ticks one down',
      'melee mons start low, so thin them out first',
      "a boss's drifting gold star is its weak face — hits there pay triple",
      'tap (don\'t pull) a foe to scout its name, hp, and next move',
    ],
    demo: demoCountdown,
  },
  {
    title: 'FIELD PICKUPS',
    lines: ['roll the ball through them: they collect on touch', 'one spawns each wave, two when something big lurks'],
    demo: demoPickups,
  },
  {
    title: 'CATCHING',
    lines: [
      'beaten foes sometimes drop a ball: catches go to your box · beat a gym, take the ace',
      'a duplicate feeds the copy you own: +1 LUCK every fusion, paid out in gym loot',
      'split evolutions (Eevee, Tyrogue…) ask which form after the fight',
    ],
    demo: demoCatch,
  },
  {
    title: 'LEVELING UP',
    lines: ['every KO levels the mon that launched the shot, tougher foes teach more (Lv100 cap)', 'levels survive evolution; each win raises ASCENSION: foes tougher, faster (2), a second charm (3), weaker rests (4), enraged gyms (6)'],
    demo: demoCharge,
  },
  {
    title: 'THE CLIMB',
    lines: ['9 stages, a gym every 3rd: pick your route on the map', 'lose and your fallen team returns next run as the rival'],
    demo: demoClimb,
  },
  {
    title: 'MAP STOPS',
    lines: ['rest heals+revives and chests pay an item — both still fight after', 'trainer squads can\'t be caught but pay better loot · ELITE doors fight deeper, pay rare+ relics · ??? is a surprise'],
    demo: demoPickups,
  },
  {
    title: 'SHINIES & STREAKS',
    lines: ['gold-tinted foes are rare: KO one and it always joins your box', 'perfect releases build a streak: every gold-zone hit pays extra'],
    demo: demoAim,
  },
  {
    title: 'STONE WALLS',
    lines: ['boulder clusters wall off the lane: the ball banks right off them', 'block bounces count as wall hits: banking still pays damage'],
    demo: demoBump,
  },
  {
    title: 'FIELD GIMMICKS',
    lines: ['red zones chip the ball, violet hushes supers — foes ignore both', 'warp pads teleport, green pads boost, dark wells bend the path'],
    demo: demoHazards,
  },
  {
    title: 'TYPE TRAITS',
    lines: [
      'field 2+ of a type for a team-wide bonus — shinies count double',
      'dual-typed mons count for both types and strike with whichever hits harder',
      'the chips on the map screen show what your team is running',
    ],
    demo: demoTraits,
  },
  {
    title: 'SUPER INDEX I',
    lines: [
      'NORMAL dash-slams the nearest · FIGHTING rains meteors',
      'ROCK rains meteors · FLYING piles foes with a vortex',
      'WATER sends homing orbs · ELECTRIC chains lightning',
    ],
    demo: demoBump,
  },
  {
    title: 'SUPER INDEX II',
    lines: [
      'GRASS drains foes to heal · POISON bleeds foes each shot',
      'FIRE flame ring + fireballs · GHOST hexes every foe',
      'PSYCHIC shoves the pack away — more charge, bigger effect',
    ],
    demo: demoCharge,
  },
];

// Help is reference, not onboarding: two sections a page so nobody scrolls
// a manual. Pages pair what belongs together — shot basics with the enemy
// countdown, supers with their pips, map stops with the climb.
const HELP_PAGES: { name: string; secs: number[] }[] = [
  { name: 'YOUR SHOT', secs: [0, 4] },
  { name: 'SUPERS', secs: [1, 3] },
  { name: 'SUPER INDEX', secs: [14, 15] },
  { name: 'SHOT TECH', secs: [2, 5] },
  { name: 'THE FIELD', secs: [11, 12] },
  { name: 'GROWTH', secs: [6, 7] },
  { name: 'THE CLIMB', secs: [8, 9] },
  { name: 'EXTRAS', secs: [10, 13] },
];
export const HELP_PAGE_COUNT = HELP_PAGES.length;

export const HELP_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
const HELP_HEAD = 64; // title band inside the panel
const HELP_FOOT = 44; // nav band
export const HELP_PREV = { x: HELP_PANEL.x + 14, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 38 };
export const HELP_NEXT = { x: HELP_PANEL.x + HELP_PANEL.w - 62, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 38 };
export const HELP_CLOSE = { x: HELP_PANEL.x + HELP_PANEL.w - 48, y: HELP_PANEL.y + 12, w: 38, h: 38 };

export function drawHelp(ctx: CanvasRenderingContext2D, page: number) {
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

  ctx.strokeStyle = '#8890b8';
  ctx.lineWidth = 2;
  const cx = HELP_CLOSE.x + HELP_CLOSE.w / 2, cy = HELP_CLOSE.y + HELP_CLOSE.h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 7);
  ctx.lineTo(cx + 7, cy + 7);
  ctx.moveTo(cx + 7, cy - 7);
  ctx.lineTo(cx - 7, cy + 7);
  ctx.stroke();

  // two roomy cards per page — bigger demos than the old scroll ever showed
  HELP_PAGES[page].secs.forEach((si, slot) => {
    const s = HELP_SECTIONS[si];
    const sy = r.y + HELP_HEAD + 14 + slot * 336;
    const dx = r.x + 22, dw = r.w - 44;
    ctx.font = font(11);
    ctx.fillStyle = GOLD;
    ctx.fillText(s.title, r.x + r.w / 2, sy + 12);

    const dy = sy + 20;
    roundRect(ctx, dx, dy, dw, 210, 10);
    ctx.fillStyle = '#0d1126';
    ctx.fill();
    ctx.save();
    roundRect(ctx, dx, dy, dw, 210, 10);
    ctx.clip();
    s.demo(ctx, dx, dy, dw, 210);
    ctx.restore();

    ctx.font = fontB(9);
    ctx.fillStyle = PARCH;
    s.lines.forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, dy + 234 + li * 16));
  });

  // footer nav: ‹ › arrows flank the page dots
  ctx.font = font(14);
  ctx.fillStyle = page > 0 ? '#e8ecf8' : '#3a4066';
  ctx.fillText('‹', HELP_PREV.x + HELP_PREV.w / 2, HELP_PREV.y + 22);
  ctx.fillStyle = page < HELP_PAGE_COUNT - 1 ? '#e8ecf8' : '#3a4066';
  ctx.fillText('›', HELP_NEXT.x + HELP_NEXT.w / 2, HELP_NEXT.y + 22);
  for (let i = 0; i < HELP_PAGE_COUNT; i++) {
    ctx.fillStyle = i === page ? GOLD : '#3a4066';
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2 + (i - (HELP_PAGE_COUNT - 1) / 2) * 16, HELP_PREV.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`${HELP_PAGES[page].name} — swipe or tap ‹ › · outside closes`, r.x + r.w / 2, r.y + r.h - 8);
}

// --- dex overlay: caught mons only — a real dex doesn't list what you ---
// --- haven't caught; the count is the only hint at what's out there -------
export const DEX_BTN = { x: W / 2 - 140, y: DAILY_BTN.y + DAILY_BTN.h + 10, w: 135, h: 44 };
export const ACH_BTN = { x: W / 2 + 5, y: DEX_BTN.y, w: 135, h: 44 };
const DEX_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
const DEX_COLS = 6;
const DEX_CELL = (DEX_PANEL.w - 40) / DEX_COLS;
const DEX_HEAD = 60;

export function dexScrollMax() {
  const rows = Math.ceil(dexIds().length / DEX_COLS);
  return Math.max(0, rows * DEX_CELL - (DEX_PANEL.h - DEX_HEAD - 36));
}

export function drawDex(ctx: CanvasRenderingContext2D, scroll: number) {
  const r = DEX_PANEL;
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 14);

  ctx.textAlign = 'center';
  ctx.font = font(17);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText(`POKÉDEX ${dexIds().length}/${CATCHABLE}`, r.x + r.w / 2, r.y + 40);

  const seen = new Set(dexIds());
  const shinies = new Set(shinyIds());
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + DEX_HEAD, r.w - 16, r.h - DEX_HEAD - 36);
  ctx.clip();
  ctx.font = fontB(7);
  DEX_LIST.filter((def) => seen.has(def.id)).forEach((def, i) => {
    const cx = r.x + 20 + (i % DEX_COLS) * DEX_CELL + DEX_CELL / 2;
    const cy = r.y + DEX_HEAD + 8 + Math.floor(i / DEX_COLS) * DEX_CELL - scroll + DEX_CELL / 2;
    drawMon(ctx, def.id, cx, cy, DEX_CELL - 20);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.toUpperCase(), cx, cy + DEX_CELL / 2 - 8);
    if (shinies.has(def.id)) { // a caught shiny earns the gold star
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('★', cx + DEX_CELL / 2 - 12, cy - DEX_CELL / 2 + 14);
    }
  });
  ctx.restore();
  if (!seen.size) {
    ctx.font = font(10);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('NO CATCHES YET', r.x + r.w / 2, r.y + r.h / 2);
  }

  // the completion milestone is the promise that keeps hunters grinding
  ctx.font = fontB(8);
  if (shinyCharm()) {
    ctx.fillStyle = '#ffd84d';
    ctx.fillText('★ SHINY CHARM: shinies are twice as common ★', r.x + r.w / 2, r.y + r.h - 26);
  } else {
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`${SHINY_CHARM_AT - dexIds().length} more catches for the SHINY CHARM (x2 shinies)`, r.x + r.w / 2, r.y + r.h - 26);
  }
  ctx.fillStyle = '#8890b8';
  ctx.fillText('catch wild mons to fill the dex: they join future draft pools · tap to close', r.x + r.w / 2, r.y + r.h - 14);
}

// --- trophy shelf: the badge case on top, the StS-style achievement list under ---
const ACH_ROW = 58;
const ACH_HEAD = 204; // the badge case owns the head — the trophy list scrolls below

export function achScrollMax() {
  return Math.max(0, ACHIEVEMENTS.length * ACH_ROW - (DEX_PANEL.h - ACH_HEAD - 36));
}

export function drawAch(ctx: CanvasRenderingContext2D, scroll: number) {
  const r = DEX_PANEL;
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 14);

  const got = unlockedAch();
  ctx.textAlign = 'center';
  ctx.font = font(17);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText(`TROPHIES ${got.size}/${ACHIEVEMENTS.length}`, r.x + r.w / 2, r.y + 40);

  // the badge case: one canon badge per leader, mounted on a dark
  // octagon socket — earned glyphs light in their badge color
  const held = gymBadges();
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BADGE CASE ${held.size}/${BADGES.length}`, r.x + r.w / 2, r.y + 62);
  BADGES.forEach((b, i) => {
    const rowN = Math.min(6, BADGES.length - Math.floor(i / 6) * 6); // center the short last row
    const cx = r.x + r.w / 2 + ((i % 6) - (rowN - 1) / 2) * 66;
    const cy = r.y + 96 + Math.floor(i / 6) * 64;
    const has = held.has(b.boss);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const px = cx + Math.cos(a) * 20, py = cy + Math.sin(a) * 20;
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#1b2140';
    ctx.fill();
    ctx.strokeStyle = has ? '#ffd84d' : '#3a4370';
    ctx.lineWidth = 2;
    ctx.stroke();
    const img = itemSprite(`badges/${b.icon}`);
    ctx.globalAlpha = has ? 1 : 0.28; // unearned slots read as indentations
    if (img) ctx.drawImage(img, cx - 15, cy - 15, 30, 30);
    ctx.globalAlpha = 1;
    ctx.font = fontB(6.5);
    ctx.fillStyle = has ? PARCH : '#5a6288';
    ctx.fillText(b.name.replace(' BADGE', ''), cx, cy + 33);
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + ACH_HEAD, r.w - 16, r.h - ACH_HEAD - 36);
  ctx.clip();
  ACHIEVEMENTS.forEach((a, i) => {
    const y = r.y + ACH_HEAD + 8 + i * ACH_ROW - scroll;
    const has = got.has(a.id);
    // the medallion: lit star when earned, hollow ring when not
    ctx.strokeStyle = has ? '#ffd84d' : '#3a4370';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x + 34, y + ACH_ROW / 2 - 4, 13, 0, Math.PI * 2);
    ctx.stroke();
    if (has) {
      const gym = a.id.startsWith('gym-') ? badgeOf(+a.id.slice(4)) : undefined;
      const gymDef = gym && speciesById(gym.boss);
      if (gymDef) {
        drawNpc(ctx, LEADER_NPC[gymDef.type], r.x + 34, y + ACH_ROW / 2 + 9, 26);
      } else {
        ctx.fillStyle = '#ffd84d';
        ctx.font = font(11);
        ctx.textAlign = 'center';
        ctx.fillText('★', r.x + 34, y + ACH_ROW / 2);
      }
    }
    ctx.textAlign = 'left';
    ctx.font = font(10);
    ctx.fillStyle = has ? '#ffd84d' : '#8890b8';
    ctx.fillText(a.name, r.x + 58, y + 18);
    ctx.font = fontB(8);
    ctx.fillStyle = has ? PARCH : '#5a6288';
    ctx.fillText(a.desc, r.x + 58, y + 36);
    ctx.strokeStyle = 'rgba(90,98,136,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + 20, y + ACH_ROW - 8);
    ctx.lineTo(r.x + r.w - 20, y + ACH_ROW - 8);
    ctx.stroke();
  });
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('trophies persist across runs · tap to close', r.x + r.w / 2, r.y + r.h - 14);
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
  rerolls: number,
  spin: { age: number; pool: SpeciesDef[]; idx: number[] },
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6, null);

  ctx.textAlign = 'center';
  ctx.font = font(18);
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`DRAFT: PICK ${picked.length + 1} OF 4`, W / 2, 120);
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(stageName, W / 2, 155);
  ctx.font = fontB(9);
  const spinning = spin.age < DRAFT_STOPS[DRAFT_STOPS.length - 1];
  ctx.fillText(
    spinning
      ? 'reels rolling — tap to skip'
      : picked.length === 3
        ? 'ace round — a veteran anchors the team'
        : 'one of three — your picks become the balls you sling',
    W / 2,
    180,
  );

  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    // lifted-card shadow, then the face
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 10);
    ctx.fill();
    cardFace(ctx, r, def.type);
    cardFrame(ctx, r, 10);
    if (def.shiny) rim(ctx, r, 10, '#ffd84d', 2);

    // slot reel: pool faces scroll past until the reel brakes onto the offer
    const stopAt = DRAFT_STOPS[i] ?? DRAFT_STOPS[DRAFT_STOPS.length - 1];
    const spinP = Math.min(spin.age / stopAt, 1);
    if (spinP < 1) {
      const win = { x: r.x + 10, y: r.y + 20, w: r.w - 20, h: 148 };
      ctx.save();
      roundRect(ctx, win.x, win.y, win.w, win.h, 8);
      ctx.clip();
      ctx.fillStyle = '#0a0e1e';
      ctx.fillRect(win.x, win.y, win.w, win.h);
      // ease-out quart — a fast blur of faces that settles hard on the deal
      const steps = 9 + i * 3;
      const pos = steps * (1 - Math.pow(1 - spinP, 4));
      const L = spin.pool.length;
      for (let j = Math.floor(pos) - 1; j <= Math.floor(pos) + 2; j++) {
        const d = spin.pool[(((spin.idx[i] + j - steps) % L) + L) % L];
        drawMon(ctx, d.id, r.x + r.w / 2, win.y + win.h / 2 + (j - pos) * 88, 80);
      }
      // fade the window edges so faces slide out of the dark
      const g = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
      g.addColorStop(0, 'rgba(10,14,30,0.9)');
      g.addColorStop(0.3, 'rgba(10,14,30,0)');
      g.addColorStop(0.7, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(win.x, win.y, win.w, win.h);
      ctx.restore();
      ctx.font = font(9);
      ctx.fillStyle = '#3a4468';
      ctx.fillText('· · ·', r.x + r.w / 2, r.y + 184);
      return;
    }
    // landing pop: the sprite overshoots for a beat as the reel stops
    const pop = 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15);

    // a shiny draft card glows gold — the rarest pick on the board
    if (def.shiny) {
      ctx.textAlign = 'center';
      ctx.font = font(9);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('✦ SHINY ✦', r.x + r.w / 2, r.y + 34);
    }
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, r.x + r.w / 2, r.y + 106, 96 * pop);

    // evolution hint rides the top-left — Magikarp is secretly Gyarados
    if (def.evolvesTo != null) {
      const nx = Array.isArray(def.evolvesTo)
        ? `${def.evolvesTo.length} FORMS`
        : speciesById(def.evolvesTo)?.name.toUpperCase();
      if (nx) {
        ctx.textAlign = 'left';
        ctx.font = fontB(9);
        ctx.fillStyle = '#9df0ff';
        ctx.fillText(`→ ${nx}`, r.x + 10, r.y + 17);
      }
    }

    // trait tag rides the top-right corner
    if (def.pierce || def.copy) {
      ctx.textAlign = 'right';
      ctx.font = font(8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 9, r.y + 20);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 10, r.y + 19);
    }

    ctx.textAlign = 'center';
    fitFont(ctx, def.name, 14, r.w - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(def.name, r.x + r.w / 2 + 1, r.y + 181);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 180);

    ctx.font = fontB(10);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`#${String(def.id).padStart(3, '0')} · Lv${def.lvl ?? 1}`, r.x + r.w / 2, r.y + 199);

    const role = roleOf(def.stats, def.healer);
    ctx.font = fontB(10);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${role === 'wild' ? 'BALANCED' : role.toUpperCase()}`, r.x + r.w / 2, r.y + 216);

    // the bump super this mon fires — a draft decision you can taste
    ctx.font = fontB(11);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${moveOf(def.id, def.type)}`, r.x + r.w / 2, r.y + 234);
    ctx.font = fontB(9);
    ctx.fillStyle = '#a8b0d0';
    const dl = wrap2(ctx, superDesc(def.id, def.type), r.w - 16);
    dl.forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, r.y + 248 + li * 11));
  });

  // one board reshuffle per draft — dimmed once spent
  button(ctx, DRAFT_REROLL, rerolls > 0 ? `REROLL (${rerolls})` : 'REROLL USED', rerolls > 0);

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
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, sx + 38, 692, 48);
      ctx.font = fontB(8);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name, sx + 38, 736);
      ctx.font = fontB(6);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillText(def.type.toUpperCase(), sx + 38, 747);
    }
  }
  // coverage strip: which types the team already brings — drafting for
  // coverage is the real choice, so it's read at a glance
  const types = [...new Set(picked.map((d) => d.type))];
  if (types.length) {
    ctx.font = fontB(7);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('COVERAGE — matching types unlock team TRAITS', W / 2, 772);
    types.forEach((ty, i) => {
      const cx = W / 2 - (types.length * 34 - 6) / 2 + i * 34;
      roundRect(ctx, cx, 778, 28, 12, 6);
      ctx.fillStyle = TYPE_COLOR[ty];
      ctx.fill();
      // color alone can't carry the info — 3-letter tag on the chip
      ctx.font = fontB(7);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ty.slice(0, 3).toUpperCase(), cx + 14, 787.5);
    });
  }

  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('tip: fly through an ally mid-shot — charged allies fire their super', W / 2, 810);
  ctx.font = fontB(7);
  ctx.fillStyle = '#6a7498';
  ctx.fillText('PIERCE flies through enemies · COPY repeats the bumper\'s super · speed sets launch, power tightens the gold window', W / 2, 826);
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

// One held-item offer card — shared by the post-stage reward and the
// pre-run charm pick.
export function drawPerkCard(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  perk: { name: string; item: string; desc: string; rarity: Rarity },
) {
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
  ctx.textAlign = 'center';
  fitFont(ctx, perk.name, 9, r.w - 12);
  ctx.fillStyle = PARCH;
  ctx.fillText(perk.name, r.x + r.w / 2, r.y + 118);
  ctx.font = fontB(8);
  ctx.fillStyle = RARITY_COLOR[perk.rarity];
  ctx.fillText(perk.rarity.toUpperCase(), r.x + r.w / 2, r.y + 135);
  ctx.font = fontB(8);
  ctx.fillStyle = '#a8b0d8';
  // two-line desc
  const words = perk.desc.split(' ');
  const mid = Math.ceil(words.length / 2);
  ctx.fillText(words.slice(0, mid).join(' '), r.x + r.w / 2, r.y + 150);
  ctx.fillText(words.slice(mid).join(' '), r.x + r.w / 2, r.y + 168);
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  offers: { name: string; item: string; desc: string; rarity: Rarity }[],
  box: SpeciesDef[],
  boxHp: number[],
  boxLvl: number[],
  team: SpeciesDef[],
  teamHp: number[],
  teamLvl: number[],
  selBox: number,
  selTeam: number,
  boxScroll: number,
  catchPct: number,
  recruit: SpeciesDef | null,
  next: { stage: number; gym: boolean; rolled: boolean },
  score: number,
  heldItems: string[],
  evo: { from: SpeciesDef; options: SpeciesDef[] } | null,
  luck: number,
) {
  ctx.fillStyle = '#0b0e1ad8';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // a fallen gym's prize announces itself — beat a leader, take the ace
  if (recruit) {
    drawMon(ctx, recruit.id, W / 2 - 120, 250, 44);
    ctx.font = fontB(10);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(
      `${recruit.name.toUpperCase()}${recruit.lvl && recruit.lvl > 1 ? ` Lv${recruit.lvl}` : ''} JOINS YOUR BOX!`,
      W / 2 + 40,
      258,
    );
  }

  ctx.font = font(20);
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE AN ITEM', W / 2, 300);
  ctx.font = font(10);
  ctx.fillStyle = '#e8ecf8';
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, W / 2, 356);
  if (luck > 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#6fdc6f';
    ctx.fillText(`TEAM LUCK ${luck} — fusion dupes feed the gym fountain`, W / 2, 372);
  }
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    next.gym
      ? `stage ${next.stage} of ${TOTAL_STAGES}: a gym leader waits`
      : `stage ${next.stage} of ${TOTAL_STAGES}: the waves get meaner`,
    W / 2,
    335,
  );

  offers.forEach((perk, i) => drawPerkCard(ctx, perkCardRect(i), perk));

  // held items — the run's build so far, a strip of icons between the
  // offer cards and the box so you can read your loadout at a glance
  if (heldItems.length) {
    const iw = 22, gap = 6, n = Math.min(heldItems.length, 14);
    let ix = W / 2 - (n * (iw + gap) - gap) / 2;
    heldItems.slice(0, 14).forEach((item) => {
      const img = itemSprite(item);
      ctx.globalAlpha = 0.9;
      if (img) ctx.drawImage(img, ix, 592, iw, iw);
      ix += iw + gap;
    });
    ctx.globalAlpha = 1;
  }

  // captured box — tap a catch and a teammate, in either order, to swap
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX: beaten foes join at ${Math.round(catchPct * 100)}%`, W / 2, 620);
  if (box.length === 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('nothing caught yet: beaten foes sometimes join', W / 2, 668);
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
    const ko = (boxHp[i] ?? 1) <= 0;
    ctx.globalAlpha = ko ? 0.3 : 1;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, r.x + r.w / 2, r.y + 23, 38);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = font(9);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', r.x + r.w / 2 + 1, r.y + 27);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', r.x + r.w / 2, r.y + 26);
    } else if (def.shiny) {
      ctx.font = font(7);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('✦', r.x + r.w - 8, r.y + 11);
    }
    hpBar(ctx, r.x + 6, r.y + 42, r.w - 12, boxHp[i] ?? 1);
    ctx.font = fontB(8);
    ctx.fillStyle = ko ? '#5a6284' : TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, r.y + 54);
    const lvl = boxLvl[i] ?? 1;
    if (lvl > 1) {
      ctx.font = fontB(7);
      const lw = ctx.measureText(`Lv${lvl}`).width + 8;
      roundRect(ctx, r.x + 3, r.y + 3, lw, 11, 4);
      ctx.fillStyle = '#0c1020dd';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9df0ff';
      ctx.fillText(`Lv${lvl}`, r.x + 7, r.y + 11);
      ctx.textAlign = 'center';
    }
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
    rim(ctx, r, 8, i === selTeam ? '#ffd84d' : selBox >= 0 ? GOLD : '#2a3560', i === selTeam ? 2 : 1);
    edge(ctx, r, 8);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(r.x + 5, r.y + 5, def.type2 ? (r.w - 10) / 2 : r.w - 10, 3);
    if (def.type2) {
      ctx.fillStyle = TYPE_COLOR[def.type2];
      ctx.fillRect(r.x + 5 + (r.w - 10) / 2, r.y + 5, (r.w - 10) / 2, 3);
    }
    const ko = (teamHp[i] ?? 1) <= 0;
    ctx.globalAlpha = ko ? 0.3 : 1;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, r.x + r.w / 2, r.y + 30, 40);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = font(10);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', r.x + r.w / 2 + 1, r.y + 34);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', r.x + r.w / 2, r.y + 33);
    } else if (def.shiny) {
      ctx.font = font(7);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('✦', r.x + r.w - 9, r.y + 13);
    }
    hpBar(ctx, r.x + 8, r.y + 54, r.w - 16, teamHp[i] ?? 1);
    ctx.font = fontB(8);
    ctx.fillStyle = ko ? '#5a6284' : PARCH;
    ctx.fillText(def.name.slice(0, 12), r.x + r.w / 2, r.y + 67);
    const lvl = teamLvl[i] ?? 1;
    if (lvl > 1) {
      ctx.font = fontB(7);
      const lw = ctx.measureText(`Lv${lvl}`).width + 8;
      roundRect(ctx, r.x + 3, r.y + 3, lw, 11, 4);
      ctx.fillStyle = '#0c1020dd';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9df0ff';
      ctx.fillText(`Lv${lvl}`, r.x + 7, r.y + 11);
      ctx.textAlign = 'center';
    }
  });
  // the selected mon's super reads here — swapping is a move pick too
  const selDef = selBox >= 0 ? box[selBox] : selTeam >= 0 ? team[selTeam] : null;
  if (selDef) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${moveOf(selDef.id, selDef.type)} — ${superDesc(selDef.id, selDef.type)}`, W / 2, 862);
  }
  ctx.font = fontB(8);
  ctx.fillStyle = '#5a6284';
  ctx.fillText(
    selTeam >= 0
      ? 'tap a box mon to swap in'
      : selBox >= 0
        ? 'tap a teammate to swap in'
        : 'tap a team mon and a box mon to swap them',
    W / 2,
    880,
  );

  // next row on the map — gyms announce themselves; wild rows stay quiet
  // since the actual choice happens on the map now
  ctx.font = font(8);
  if (next.gym) {
    ctx.fillStyle = '#f85888';
    ctx.fillText('NEXT: GYM LEADER', W / 2, 926);
  } else {
    ctx.fillStyle = '#8890b8';
    ctx.fillText('NEXT: PICK YOUR ROUTE', W / 2, 926);
  }
  // StS lets you decline a reward — here it cashes out as score instead
  button(ctx, REWARD_SKIP, 'DECLINE +150', true);

  // a split evolution blocks the reward pick until its form is chosen
  if (evo) {
    ctx.fillStyle = 'rgba(4,6,16,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd84d';
    fitFont(ctx, `${evo.from.name.toUpperCase()} IS EVOLVING — CHOOSE ITS FORM`, 13, W - 60);
    ctx.fillText(`${evo.from.name.toUpperCase()} IS EVOLVING — CHOOSE ITS FORM`, W / 2, 372);
    evo.options.forEach((opt, i) => {
      const r = evoCardRect(i, evo.options.length);
      roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      rim(ctx, r, 10, i === 0 ? '#ffd84d' : GOLD, 2);
      edge(ctx, r, 10);
      // split strip sells the dual-type at a glance
      ctx.fillStyle = TYPE_COLOR[opt.type];
      ctx.fillRect(r.x + 8, r.y + 8, opt.type2 ? (r.w - 16) / 2 : r.w - 16, 4);
      if (opt.type2) {
        ctx.fillStyle = TYPE_COLOR[opt.type2];
        ctx.fillRect(r.x + 8 + (r.w - 16) / 2, r.y + 8, (r.w - 16) / 2, 4);
      }
      (opt.shiny ? drawShiny : drawMon)(ctx, opt.id, r.x + r.w / 2, r.y + 66, 76);
      fitFont(ctx, opt.name.toUpperCase(), 9, r.w - 12);
      ctx.fillStyle = PARCH;
      ctx.fillText(opt.name.toUpperCase(), r.x + r.w / 2, r.y + 128);
      ctx.font = fontB(7);
      ctx.fillStyle = '#8890b8';
      ctx.fillText(opt.type2 ? `${opt.type}/${opt.type2}` : opt.type, r.x + r.w / 2, r.y + 141);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(`★ ${moveOf(opt.id, opt.type)}`, r.x + r.w / 2, r.y + 156);
      ctx.fillStyle = '#8890b8';
      wrap2(ctx, superDesc(opt.id, opt.type), r.w - 14).forEach((l, li) =>
        ctx.fillText(l, r.x + r.w / 2, r.y + 167 + li * 9));
    });
  }
}

// Starter-charm pick before stage 1 — same card look, standalone screen.
export function drawPerkPick(
  ctx: CanvasRenderingContext2D,
  offers: Perk[],
  title: string,
  sub: string,
  t = 0,
  team: SpeciesDef[] = [],
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6, null);
  ctx.textAlign = 'center';
  ctx.font = font(20);
  ctx.fillStyle = '#f8d030';
  ctx.fillText(title, W / 2, 280);
  ctx.font = fontB(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(sub, W / 2, 315);
  offers.forEach((p, i) => drawPerkCard(ctx, perkCardRect(i), p));
  // declining pays score instead — a dead offer still has a price
  button(ctx, CHARM_SKIP, 'SKIP +200 PTS', true);
  // the drafted squad rides under the offers — pick the item for THESE mons
  if (team.length) {
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('YOUR TEAM', W / 2, 664);
    team.forEach((def, i) => {
      const mx = W / 2 + (i - (team.length - 1) / 2) * 92;
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, 702, 62);
      ctx.font = fontB(8);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name.toUpperCase(), mx, 736);
      ctx.font = fontB(6);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillText(def.type.toUpperCase(), mx, 748);
    });
  }
}

// Win confetti — little type-colored paper squares drifting down forever.
// Positions/velocities are derived from the index, so it needs no state.
const CONFETTI = ['#ffd84d', '#f08030', '#6890f0', '#78c850', '#f85888'];
function confetti(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 42; i++) {
    const speed = 60 + (i % 5) * 22;
    const x = (i * 73 + Math.sin(t * 1.4 + i) * 14 + 40) % W;
    const y = (i * 149 + t * speed) % (H + 40) - 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (2 + (i % 3)) + i);
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-3, -2, 6, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  res: RunResult,
  extra: string | null,
  share: ShareGrid | null,
  t = 0,
) {
  ctx.fillStyle = '#0b0e1add';
  ctx.fillRect(0, 0, W, H);
  if (res.won) confetti(ctx, t);

  ctx.textAlign = 'center';
  const headline = res.won ? 'CLIMB COMPLETE!' : 'WIPED OUT';
  fitFont(ctx, headline, 26, W - 60);
  ctx.fillStyle = res.won ? '#6fdc6f' : '#ff6b6b';
  ctx.fillText(headline, W / 2, 300);

  ctx.font = font(16);
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`SCORE ${res.score.toLocaleString('en-US')}`, W / 2, 334);
  if (res.newBest) {
    ctx.font = font(10);
    ctx.fillStyle = '#ffe76a';
    ctx.fillText('★ NEW RECORD ★', W / 2, 352);
  } else if (res.shortOfBest > 0) {
    // so-close framing — the near-record loss is the strongest rematch pull
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`${res.shortOfBest.toLocaleString('en-US')} PTS SHORT OF YOUR BEST`, W / 2, 352);
  }

  ctx.font = font(10);
  ctx.fillStyle = '#fff';
  ctx.fillText(
    `${res.shots} shots · ${res.time.toFixed(1)}s${res.caught ? ` · ${res.caught} caught` : ''}`,
    W / 2,
    res.newBest ? 368 : 355,
  );
  if (res.newDex > 0) {
    ctx.font = font(9);
    ctx.fillStyle = '#9df0ff';
    ctx.fillText(`+${res.newDex} NEW DEX ENTR${res.newDex === 1 ? 'Y' : 'IES'}`, W / 2, res.newBest ? 384 : 371);
  }
  if (extra) {
    ctx.fillStyle = '#f8d030';
    fitFont(ctx, extra, 11, W - 60);
    ctx.fillText(extra, W / 2, res.newDex > 0 ? 400 : 395);
  }
  // fresh trophies get their own gold line under the score block
  if (res.newAch.length) {
    ctx.font = fontB(9);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${res.newAch.join(' · ')} ★`, W / 2, extra ? 414 : 408);
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
    ctx.font = fontB(8);
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      const br = { x: bx, y, w: ws[i], h: 20 };
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      rim(ctx, br, 5, RARITY_COLOR[b.rarity]);
      edge(ctx, br, 5);
      ctx.font = fontB(8);
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      ctx.fillText(b.name, bx + ws[i] / 2, y + 14);
      bx += ws[i] + 8;
    });
  });

  if (share) {
    const sy = 460 + badgeRows.length * 28;
    ctx.font = '30px system-ui';
    ctx.fillText(share.waves, W / 2, sy);
    // the squad as real sprites — reads as Pokémon at a glance
    const n = res.team.length;
    res.team.forEach((def, i) => {
      const mx = W / 2 + (i - (n - 1) / 2) * 52;
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, sy + 34, 42);
      if (i === res.mvpIdx) {
        ctx.font = font(10);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('★', mx, sy + 4);
      }
    });
  }

  // the echo tease — losing isn't a dead end, the team comes back hostile
  if (!res.won) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('this fallen team may return as a RIVAL next run', W / 2, share ? 460 + badgeRows.length * 28 + 64 : 560);
  }

  button(ctx, RETRY_BTN, 'REMATCH', true);
  button(ctx, SHARE_BTN, share?.copied ? 'COPIED!' : 'SHARE RESULT', true);
  button(ctx, TITLE_BTN, 'TITLE', true);
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, shots: number, stageName: string, score: number, streak = 0) {
  ctx.fillStyle = '#8890b8';
  ctx.font = fontB(9);
  ctx.textAlign = 'left';
  // right of the pause chip (x 14..44) — the chip would eat the first letter
  ctx.fillText(stageName, 52, 44);
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
  ctx.font = font(8);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, W - 30, 60);
  if (streak > 1) {
    ctx.fillStyle = '#f08030';
    ctx.fillText(`PERFECT ×${streak}`, W - 30, 76);
  }
}
