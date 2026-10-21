import { itemSprite, loadItem, drawMon, drawShiny, drawNpc, gracidea } from '../core/assets';
import { isMuted, sfx } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES, ENEMY_DB, ELITES, INVADERS, ROSTER, speciesById, bst, LEADER_NPC, ASC_MODS } from './data';
import { dailyMod as todaysMod } from './daily';
import { PERKS, RARITY_COLOR, BAG_ITEMS } from './perks';
import type { Perk, Rarity, BagItem } from './perks';
import { drawBackdrop } from './bg';
import { TYPE_COLOR, typeMult, type PokeType } from './types';
import { roleOf, moveOf, superDesc, launchMult, physDamage, specDamage, ROLE_MODS } from './stats';
import { BASE_SHOT_SPEED, POWER, WALL_REST, UNIT_REST, FRICTION, STOP_SPEED, ULT_SHOTS } from './battle';
import { dexIds, shinyIds, best, shinyCharm, SHINY_CHARM_AT, ACHIEVEMENTS, unlockedAch, BADGES, gymBadges, badgeOf, tier, rating, rankName, board, settings, setSetting, bagStock, streakDaily, streakWins, ascPick, echoIds, type Settings } from './meta';
import { taskViews, tasksReady, taskResetsIn } from './tasks';
import type { TaskView } from './tasks';
import type { Vec } from '../core/vec';

export const W = 540;
export const H = 960;

// mobile-first: key affordances only render when a keyboard is likely —
// a coarse-primary pointer (phone/tablet) never sees [1] or [R]. The keys
// stay wired regardless; this decides chrome, not input.
const HAS_KEYS = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

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
  rating: { delta: number; tier: string; color: string; up: boolean }; // ladder movement this run
  place: number; // hall-of-fame slot earned (0-based), -1 = off the board
  seed: number; // the run's roll — a shared seed replays this climb
  runNo?: number; // lifetime run count — the report's CASE no; the seed stands in till main.ts fills it
  depth?: number; // stages reached — the DEPTH finding; a wipe without one parses it back out of `extra`
}

// --- draft layout: 3 offer cards, team strip at the bottom ---

const CARD_W = 162;
const CARD_H = 276;
const CARD_GAP = 9;
const CARDS_X = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
const CARDS_Y = 300;

export function draftCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: CARDS_Y, w: CARD_W, h: CARD_H };
}
export const DRAFT_REROLL = { x: W / 2 - 85, y: CARDS_Y + CARD_H + 12, w: 170, h: 40 };
// slot-reel reveal: each offer card spins a strip of pool faces that brakes
// onto the deal — staggered left to right. Spin age counts seconds.
export const REEL_STOPS = [0.7, 1.0, 1.3];

// --- bag row: pk_bag consumables ride the dead band between the draft ---
// --- subtitle (~y180) and the offer cards (y300). ≤2 picked into the run.
export const BAG_MAX = 2;
const BAG_CHIP_W = 74;
const BAG_CHIP_H = 60;
const BAG_CHIP_GAP = 8;
export const BAG_ROW = { x: 0, y: 196, w: W, h: 98 };
export function bagChipRect(i: number, n: number) {
  const rowW = n * BAG_CHIP_W + (n - 1) * BAG_CHIP_GAP;
  return { x: W / 2 - rowW / 2 + i * (BAG_CHIP_W + BAG_CHIP_GAP), y: BAG_ROW.y + 26, w: BAG_CHIP_W, h: BAG_CHIP_H };
}
// stocked bag items in chip order — chip i ↔ items[i], so hit tests and the
// draw both walk this one list
export function bagRowItems(): BagItem[] {
  const stock = bagStock();
  return BAG_ITEMS.filter((it) => (stock[it.id] ?? 0) > 0);
}

export const RETRY_BTN = { x: W / 2 - 110, y: 620, w: 220, h: 64 };
export const SHARE_BTN = { x: W / 2 - 110, y: 700, w: 220, h: 54 };
export const TITLE_BTN = { x: W / 2 - 80, y: 772, w: 160, h: 44 };
export const FREE_BTN = { x: W / 2 - 200, y: 704, w: 195, h: 68 };
export const DAILY_BTN = { x: W / 2 + 5, y: 704, w: 195, h: 68 };
// only visible while a saved run waits — slips between the big buttons and the DEX row
export const NEW_BTN = { x: W / 2 - 130, y: FREE_BTN.y + FREE_BTN.h + 1, w: 260, h: 24 };
// the ascension dial — parked in the dead band under the ladder readout;
// a tap cycles the heat 0..wins, hit-tested ahead of the start pill
export const ASC_BTN = { x: W / 2 - 70, y: 912, w: 140, h: 30 };
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
  // PS2P '?' has right side-bearing and sits ~0.9em above the baseline —
  // nudge right and drop the baseline so the ink lands on the box center
  ctx.fillText('?', cx + 2, cy + 11);
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
// gear badge, left of the ? — the settings modal
export const GEAR_BTN = { x: HELP_BTN.x - 54, y: 22, w: 44, h: 44 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// item reward cards reuse the draft card spacing
export function perkCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: 380, w: CARD_W, h: 200 };
}
export const CHARM_SKIP = { x: W / 2 - 90, y: 592, w: 180, h: 40 };
export const REWARD_TEAM = { x: W / 2 - 95, y: 872, w: 190, h: 40 };
// the NEW CATCH card doubles as a button — it opens the team panel
export const REWARD_CATCH = { x: W / 2 - 190, y: 158, w: 380, h: 78 };
// offer-tool row under the perk cards — reroll / skip / banish pills.
// perkCardRect ends at 580; the held-items strip yields to just below these.
// the tool row is a thumb target first — 46px tall, hugged under the cards
export const TOOL_ROLL = { x: 33, y: 588, w: 150, h: 46 };
export const TOOL_SKIP = { x: W / 2 - 75, y: 588, w: 150, h: 46 };
export const TOOL_BAN = { x: W - 33 - 150, y: 588, w: 150, h: 46 };
// The box is a fixed window into a horizontally scrolling row — catches can
// outgrow 540px, so the row scrolls instead of centering off-screen.
export const BOX_STRIP = { x: 24, y: 536, w: W - 48, h: 64 };
const BOX_SLOT = 64;
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
  const w = 108, gap = 12;
  return { x: W / 2 - (4 * (w + gap) - gap) / 2 + i * (w + gap), y: 632, w, h: 92 };
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

// speaker glyph + slash — shared by the title badge and the mid-run chip.
// color/muted default to the live mute state; the settings tab overrides both.
function speakerGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, muted = isMuted(), color = PARCH) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 8 * s, cy - 3 * s);
  ctx.lineTo(cx - 3 * s, cy - 3 * s);
  ctx.lineTo(cx + 2 * s, cy - 8 * s);
  ctx.lineTo(cx + 2 * s, cy + 8 * s);
  ctx.lineTo(cx - 3 * s, cy + 3 * s);
  ctx.lineTo(cx - 8 * s, cy + 3 * s);
  ctx.closePath();
  ctx.fill();
  if (muted) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s, cy - 7 * s);
    ctx.lineTo(cx + 9 * s, cy + 7 * s);
    ctx.moveTo(cx + 9 * s, cy - 7 * s);
    ctx.lineTo(cx - 4 * s, cy + 7 * s);
    ctx.stroke();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * s;
    for (const rr of [6, 10]) {
      ctx.beginPath();
      ctx.arc(cx + 2 * s, cy, rr * s, -0.9, 0.9);
      ctx.stroke();
    }
  }
}

// cog glyph — settings chrome: tooth ring + hub (title badge + feel tab)
function gearGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillRect(-1.5 * s, -9.5 * s, 3 * s, 3.8 * s);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, 5.8 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
}

// monitor glyph — the graphics tab's icon: a screen with quality bars inside
function monitorGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(cx - 8.5 * s, cy - 7 * s, 17 * s, 11 * s);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 1.5 * s, cy + 4 * s, 3 * s, 3.5 * s); // neck
  ctx.fillRect(cx - 5.5 * s, cy + 7.5 * s, 11 * s, 2 * s); // foot
  ctx.fillRect(cx - 5.5 * s, cy - 0.5 * s, 3 * s, 3 * s); // rising bars
  ctx.fillRect(cx - 1.5 * s, cy - 2.5 * s, 3 * s, 5 * s);
  ctx.fillRect(cx + 2.5 * s, cy - 4.5 * s, 3 * s, 7 * s);
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

// a star drawn as a path — the ★ glyph's bearings drift off-center in a frame
function fillStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.42 : r;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
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

// the stat-derived role as a tag — 'wild' reads BALANCED, the draft cards'
// word; a flagged medic earns its star wherever the tag shows
const roleTag = (def: SpeciesDef) => {
  const r = roleOf(def);
  return `${def.healer ? '★ ' : ''}${r === 'wild' ? 'BALANCED' : r}`;
};

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
export function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean, icon?: string, iconDy = 0) {
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
      ctx.drawImage(img, r.x + 10, r.y + (r.h - 32) / 2 + iconDy, 32, 32);
      ctx.restore();
    }
  }
}

// lerp two #rrggbb colors — t=0 keeps `a`, t=1 lands on `b`
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  let out = '#';
  for (const s of [16, 8, 0]) {
    const ca = (pa >> s) & 255;
    out += Math.round(ca + (((pb >> s) & 255) - ca) * t)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
};

// candy stripes — the pokebonk texture: -45° white bands, 10 on / 10 off.
// expects a clip already on the context; covers the rect's rotated bounds.
function stripes(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }) {
  const s = Math.hypot(r.w, r.h);
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = -s / 2 - 20; x < s / 2 + 20; x += 20) ctx.fillRect(x, -s / 2, 10, s);
  ctx.restore();
}

// rarity header band: vertical gradient color → dark blend, striped. The
// clip overshoots 9px below the band so only the TOP corners round — the
// bottom edge stays a straight cut against the card body.
export function stripeBand(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, color: string) {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h + 9, 9);
  ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, color);
  g.addColorStop(1, mixHex(color, '#12162b', 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  stripes(ctx, r);
  ctx.restore();
}

// fully-rounded text tag — rarity/kind/key-hint counters. Returns its width
// so a caller can right-anchor by measuring first (same font).
export function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  o: { bg: string; fg: string; fontPx?: number },
) {
  ctx.font = fontB(o.fontPx ?? 7);
  const w = ctx.measureText(text).width + 14;
  roundRect(ctx, x, y, w, 16, 8);
  ctx.fillStyle = o.bg;
  ctx.fill();
  ctx.fillStyle = o.fg;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 7, y + 11.5);
  return w;
}

// '[1]'-style key affordance, tucked bottom-right inside a card — same dark
// chip style as the kind pill
export function keyHint(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string) {
  ctx.font = fontB(7);
  const w = ctx.measureText(label).width + 14;
  chip(ctx, r.x + r.w - w - 8, r.y + r.h - 24, label, { bg: 'rgba(42,36,64,0.8)', fg: '#e8ecf8' });
}

// candy pill button: light→base→dark gradient face with full-radius ends
// over a darker "press edge", stripes on top, centered ink. `pressed`
// flattens the edge to a sliver and sinks the ink; `disabled` drops the
// whole ramp to grays. `badge` is a small dark counter at the right end.
export function pill(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  o: {
    c: string;
    cd: string;
    tc: string;
    label: string;
    sub?: string;
    badge?: string;
    pressed?: boolean;
    disabled?: boolean;
  },
) {
  const c = o.disabled ? '#8a90a4' : o.c;
  const cd = o.disabled ? '#5c6276' : o.cd;
  const tc = o.disabled ? '#d8dcea' : o.tc;
  const rimH = o.pressed ? 1 : 4;
  // the press edge is a whole pill a shade past the face's dark stop — the
  // face sits on it and covers all but the bottom lip
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fillStyle = mixHex(cd, '#12162b', 0.4);
  ctx.fill();
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h - rimH, (r.h - rimH) / 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h - rimH);
  g.addColorStop(0, mixHex(c, '#ffffff', 0.4));
  g.addColorStop(0.55, c);
  g.addColorStop(1, cd);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  stripes(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - rimH });
  ctx.restore();

  let bw = 0;
  if (o.badge) {
    ctx.font = fontB(7);
    bw = ctx.measureText(o.badge).width + 10;
  }
  const cy = r.y + (r.h - rimH) / 2 + (o.pressed ? 2 : 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = tc;
  fitFont(ctx, o.label, o.sub ? 9 : 10, r.w - 24 - bw);
  ctx.fillText(o.label, r.x + r.w / 2 - bw / 2, cy + (o.sub ? -1 : 5));
  if (o.sub) {
    ctx.font = fontB(6);
    ctx.globalAlpha = 0.7;
    ctx.fillText(o.sub, r.x + r.w / 2 - bw / 2, cy + 12);
    ctx.globalAlpha = 1;
  }
  if (o.badge) {
    const bx = r.x + r.w - bw - 8;
    roundRect(ctx, bx, cy - 7, bw, 14, 7);
    ctx.fillStyle = 'rgba(42,36,64,0.4)';
    ctx.fill();
    ctx.font = fontB(7);
    ctx.fillStyle = tc;
    ctx.textAlign = 'left';
    ctx.fillText(o.badge, bx + 5, cy + 3.5);
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

// The attract loop isn't one shot — it's a rotation of scripted skeletons,
// each a different lesson: the pass chain, the bank off two walls, the
// full-court sweep of every foe, the tight ricochet squeeze. Straight legs
// the scripted ball walks; the shared checks fire bumps and score hits the
// same as a real pull.
const ATTRACT = { windup: 0.7, rest: 0.6, speed: 300 };
const PAD = { x: 400, y: 560 }; // pikachu's mark — every script opens here
const SCRIPTS: { aim: { x: number; y: number }; legs: { x: number; y: number }[] }[] = [
  {
    aim: { x: 430, y: 395 }, // THE PASS — bump the whole squad, clip machop
    legs: [PAD, { x: 118, y: 335 }, { x: 150, y: 585 }, { x: 200, y: 620 }, { x: 430, y: 395 }],
  },
  {
    aim: { x: 470, y: 288 }, // THE BANK — wall, wall, gastly
    legs: [PAD, { x: 486, y: 320 }, { x: 60, y: 300 }, { x: 470, y: 288 }],
  },
  {
    aim: { x: 95, y: 260 }, // THE SWEEP — touch all three foes, end on spearow
    legs: [PAD, { x: 430, y: 395 }, { x: 470, y: 288 }, { x: 95, y: 260 }],
  },
  {
    aim: { x: 150, y: 585 }, // THE SQUEEZE — hug the rail through the squad to squirtle
    legs: [PAD, { x: 200, y: 620 }, { x: 60, y: 630 }, { x: 118, y: 335 }, { x: 150, y: 585 }],
  },
];
// leg start times per script, windup first — the last leg lands on the aim
const SCRIPT_T = SCRIPTS.map((s) => {
  const t = [ATTRACT.windup];
  for (let i = 1; i < s.legs.length; i++) {
    const p = s.legs[i], q = s.legs[i - 1];
    t.push(t[i - 1] + Math.hypot(p.x - q.x, p.y - q.y) / ATTRACT.speed);
  }
  return t;
});
const SCRIPT_CYCLE = SCRIPT_T.map((t) => t[t.length - 1] + ATTRACT.rest);
const attractPos = (tc: number) => {
  const s = SCRIPTS[play.script];
  const T = SCRIPT_T[play.script];
  for (let i = 1; i < T.length; i++) {
    if (tc <= T[i]) {
      const u = Math.min(1, (tc - T[i - 1]) / (T[i] - T[i - 1]));
      const p = s.legs[i - 1];
      const q = i === s.legs.length - 1 ? play.aim : s.legs[i];
      return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u };
    }
  }
  return s.legs[0];
};
const TITLE_FOES: [number, number, number, number][] = [ // id, x, y, size
  [92, 470, 288, 50], // gastly
  [66, 430, 395, 54], // machop
  [21, 95, 260, 46], // spearow — gives the left rail something to hit
];
// your squad fields like a real wave — pikachu leads off and the other
// three's homes ARE the scripted legs, so the loop bumps all of them
const TITLE_TEAM: [number, number, number][] = [ // id, home x, home y
  [25, PAD.x, PAD.y], // pikachu starts on the pad
  [1, 118, 335], // bulbasaur
  [7, 150, 585], // squirtle
  [4, 200, 620], // charmander
];

// --- playable title sandbox --------------------------------------------------
// The pitch between the wordmark and the buttons is a live demo: the scripted
// attract loop plays until a drag lands on the grass, then the squad is the
// player's — pull-back sling, wall bounces, bump a teammate and their super
// fires. Launch, meter, physics and turn rotation are the real battle rules
// (battle.ts constants + the pointerUp charge formula), not a tuned-down toy.
export const TITLE_FIELD = { x: 26, y: 268, w: W - 52, h: 396 };
const BALL_R = 26;

// same formulas as Battle.charge / Battle.sweetSpot, keyed to whoever's up
const monDiff = (def: SpeciesDef) => Math.min(Math.max((bst(def) - 320) / 300, 0), 1);
const monCharge = (def: SpeciesDef, dragT: number) => {
  const P = 0.85 - 0.3 * monDiff(def);
  const ph = dragT % (2 * P);
  return ph < P ? ph / P : 2 - ph / P;
};
const monZone = (def: SpeciesDef) => {
  const n = Math.min(def.stats.spe / 120, 1);
  const d = monDiff(def);
  const hw = Math.max(0.09 - 0.05 * n - 0.04 * d, 0.025);
  const c = Math.min(Math.max(0.68 + 0.27 * n, hw), 1 - hw);
  return { c, hw };
};
const monLaunch = (def: SpeciesDef) => launchMult(def.stats) * ROLE_MODS[roleOf(def.stats, def.healer)].launch;

interface TitleFoe {
  id: number; ax: number; ay: number; wT: number;
  x: number; y: number; vx: number; vy: number; s: number; timer: number;
}
interface TitleMon {
  id: number; x: number; y: number; s: number; fired: boolean; pulse: number;
  vx: number; vy: number;
}
const play = {
  live: false, // flips while the player's hands are on the field — the
  // attract loop takes it back once they've been idle a beat
  idle: 0,
  dragStart: null as { x: number; y: number } | null,
  dragNow: null as { x: number; y: number } | null,
  dragT: 0,
  wasGold: false,
  launched: false, // once you've slung one the drag prompt has done its job
  script: 0, // which attract skeleton the scripted ball is riding
  turn: 0, // squad index riding the sling — a settled shot hands it on
  t: 0, // attract clock — drives the scripted rider until live flips
  ball: { x: TITLE_TEAM[0][1], y: TITLE_TEAM[0][2], vx: 0, vy: 0, live: false, trail: [] as { x: number; y: number }[] },
  team: TITLE_TEAM.map(([id, x, y]): TitleMon => ({ id, x, y, s: 52, fired: false, pulse: 0, vx: 0, vy: 0 })),
  bolts: [] as { x1: number; y1: number; x2: number; y2: number; t: number; delay: number; foe: TitleFoe; dmg: number }[],
  foes: TITLE_FOES.map(([id, x, y, s], i): TitleFoe => ({ id, ax: x, ay: y, wT: Math.random() * 0.9, x, y, vx: 0, vy: 0, s, timer: 3 - i })),
  aim: { x: 430, y: 395 }, // the scripted way-out leg clips the nearest foe
  orbs: [] as { x: number; y: number; vx: number; vy: number; t: number; tgt: TitleFoe | TitleMon; c: string; dmg: number }[],
  waves: [] as { x: number; y: number; r: number; maxR: number; t: number; life: number; dmg: (f: TitleFoe) => number; hits: Set<TitleFoe> }[],
  pops: [] as { x: number; y: number; t: number; label: string; color: string }[],
  hitSet: new Set<TitleFoe>(), // a scripted pass sits on its leg — one hit each
  lastTc: 0, // wraps each attract cycle — the foe countdown ticks per shot
};
const activeMon = () => play.team[play.turn];
const activeDef = () => speciesById(activeMon().id)!;

export function titlePointerDown(p: { x: number; y: number }): boolean {
  if (!inRect(p.x, p.y, TITLE_FIELD)) return false;
  play.live = true;
  play.idle = 0;
  // a scripted pass may be mid-flight — the ball freezes where it was and
  // that spot becomes the active mon's ground
  const a = activeMon();
  a.x = play.ball.x;
  a.y = play.ball.y;
  Object.assign(play.ball, { vx: 0, vy: 0, live: false });
  play.ball.trail = [];
  play.hitSet.clear();
  for (const m of play.team) m.fired = false;
  // grass is the sling, same as battle — a press anywhere starts the pull
  play.dragStart = { x: p.x, y: p.y };
  play.dragNow = { x: p.x, y: p.y };
  play.dragT = 0;
  play.wasGold = false;
  return true;
}
export function titlePointerMove(p: { x: number; y: number }) {
  if (play.dragStart) play.dragNow = { x: p.x, y: p.y };
}
export function titlePointerUp() {
  if (!play.dragStart || !play.dragNow) return;
  const b = play.ball;
  // same launch as Battle.pointerUp: pull aims, meter timing powers
  const pull = { x: play.dragStart.x - play.dragNow.x, y: play.dragStart.y - play.dragNow.y };
  const d = Math.hypot(pull.x, pull.y);
  const def = activeDef();
  const frac = monCharge(def, play.dragT);
  const zone = monZone(def);
  const gold = Math.abs(frac - zone.c) <= zone.hw;
  play.dragStart = play.dragNow = null;
  if (d < 18 || b.live) return; // a tap isn't a pull — same jitter floor as battle
  const speed = BASE_SHOT_SPEED * POWER * monLaunch(def) * (0.4 + 0.6 * (gold ? 1 : frac));
  b.vx = (pull.x / d) * speed;
  b.vy = (pull.y / d) * speed;
  b.live = true;
  b.trail = [];
  play.hitSet.clear();
  play.launched = true;
  for (const f of play.foes) f.timer = f.timer <= 1 ? 3 : f.timer - 1;
  for (const m of play.team) m.fired = false; // bump combo re-arms each shot, like the real cd
  sfx('launch');
}
export function titlePointerCancel() {
  play.dragStart = play.dragNow = null;
}

// the bump super, keyed to the bumped mon's type — a pocket version of
// battle's bumpAlly cases: chain, homing orbs, flame front + fireballs, drain
const fireSuper = (m: TitleMon) => {
  const md = speciesById(m.id)!;
  play.pops.push({ x: m.x, y: m.y - 46, t: 0.9, label: `${moveOf(m.id, md.type)}!`, color: TYPE_COLOR[md.type] });
  const foeDef = (f: TitleFoe) => speciesById(f.id)!;
  const dmg = (f: TitleFoe, pw = 1) =>
    Math.round(specDamage(md.stats.spa, foeDef(f).stats.spd, typeMult(md.type, foeDef(f)), 0.7 * pw));
  if (md.type === 'electric') {
    // chain lightning hops the pack, enemy → enemy like bumpAlly's case
    sfx('zap');
    let from = { x: m.x, y: m.y };
    const chained: TitleFoe[] = [];
    for (let i = 0; i < play.foes.length; i++) {
      const next = play.foes
        .filter((f) => !chained.includes(f))
        .sort((a, c) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(c.x - from.x, c.y - from.y))[0];
      if (!next) break;
      chained.push(next);
      play.bolts.push({ x1: from.x, y1: from.y, x2: next.x, y2: next.y, t: 0.3, delay: i * 0.1, foe: next, dmg: dmg(next) });
      from = next;
    }
  } else if (md.type === 'water') {
    // homing orbs on the nearest 3
    sfx('splash');
    play.foes
      .slice()
      .sort((a, c) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(c.x - m.x, c.y - m.y))
      .slice(0, 3)
      .forEach((tgt, i) => {
        const a = (i / 3) * Math.PI * 2;
        play.orbs.push({ x: m.x, y: m.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 1.8, tgt, c: '#6890f0', dmg: dmg(tgt) });
      });
  } else if (md.type === 'fire') {
    // flame ring rolls out, fireballs hunt the farthest — the real fire
    // super's one-two, not just a shove
    sfx('sizzle');
    play.waves.push({ x: m.x, y: m.y, r: 0, maxR: 220, t: 0.45, life: 0.45, dmg: (f) => dmg(f, 1.4), hits: new Set() });
    play.foes
      .slice()
      .sort((a, c) => Math.hypot(c.x - m.x, c.y - m.y) - Math.hypot(a.x - m.x, a.y - m.y))
      .slice(0, 3)
      .forEach((tgt, i) => {
        const a = (i / 3) * Math.PI * 2;
        play.orbs.push({ x: m.x, y: m.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 1.8, tgt, c: '#f08030', dmg: dmg(tgt, 0.9) });
      });
  } else {
    // grass drain — wisps leech off every foe back into the bumped mon
    sfx('heal');
    for (const f of play.foes) {
      play.pops.push({ x: f.x, y: f.y - 30, t: 0.7, label: String(dmg(f)), color: '#78c850' });
      play.orbs.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 1.4, tgt: m, c: '#78c850', dmg: 0 });
    }
  }
};

export function updateTitle(dt: number) {
  // the meter runs while a pull is held — gold-entry tick, same cue as battle
  if (play.dragStart) {
    play.dragT += dt;
    const z = monZone(activeDef());
    const inGold = Math.abs(monCharge(activeDef(), play.dragT) - z.c) <= z.hw;
    if (inGold && !play.wasGold) sfx('tick');
    play.wasGold = inGold;
  }
  // foes roam the whole pitch like battle creeps — hop to a nearby spot,
  // dart across now and then; the same spring eats knockback, so hits
  // still shove and settle
  for (const f of play.foes) {
    f.wT -= dt;
    if (f.wT <= 0) {
      f.wT = 0.5 + Math.random() * 0.9;
      const m = f.s * 0.5 + 10;
      const dart = Math.random() < 0.22;
      const tx = dart ? TITLE_FIELD.x + m + Math.random() * (TITLE_FIELD.w - 2 * m) : f.x + (Math.random() - 0.5) * 160;
      const ty = dart ? TITLE_FIELD.y + m + Math.random() * (TITLE_FIELD.h - 2 * m) : f.y + (Math.random() - 0.5) * 160;
      f.ax = Math.min(Math.max(tx, TITLE_FIELD.x + m), TITLE_FIELD.x + TITLE_FIELD.w - m);
      f.ay = Math.min(Math.max(ty, TITLE_FIELD.y + m), TITLE_FIELD.y + TITLE_FIELD.h - m);
    }
    f.vx += (f.ax - f.x) * 26 * dt;
    f.vy += (f.ay - f.y) * 26 * dt;
    const damp = Math.exp(-7 * dt);
    f.vx *= damp;
    f.vy *= damp;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  // no piling up — foes shoulder off each other, the squad, the parked ball
  for (let i = 0; i < play.foes.length; i++)
    for (let j = i + 1; j < play.foes.length; j++) {
      const a = play.foes[i], c = play.foes[j];
      const dx = a.x - c.x, dy = a.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = a.s * 0.5 + c.s * 0.5;
      if (d >= min) continue;
      const push = (min - d) / 2;
      a.x += (dx / d) * push; a.y += (dy / d) * push;
      c.x -= (dx / d) * push; c.y -= (dy / d) * push;
    }
  for (const f of play.foes) {
    for (const m of play.team) {
      if (m === activeMon()) continue;
      const dx = f.x - m.x, dy = f.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = f.s * 0.5 + m.s * 0.5;
      if (d < min) { f.x += (dx / d) * (min - d); f.y += (dy / d) * (min - d); }
    }
    if (!play.ball.live) {
      const dx = f.x - play.ball.x, dy = f.y - play.ball.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = f.s * 0.5 + 30;
      if (d < min) { f.x += (dx / d) * (min - d); f.y += (dy / d) * (min - d); }
    }
  }
  // a knocked teammate glides out and settles — the separations above shove
  // any foe it slides through
  const F0 = TITLE_FIELD;
  for (const m of play.team) {
    if (m === activeMon() || (!m.vx && !m.vy)) continue;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const fr0 = Math.exp(-6 * dt);
    m.vx *= fr0;
    m.vy *= fr0;
    const r = m.s * 0.5;
    m.x = Math.min(Math.max(m.x, F0.x + r), F0.x + F0.w - r);
    m.y = Math.min(Math.max(m.y, F0.y + r), F0.y + F0.h - r);
    if (Math.hypot(m.vx, m.vy) < 24) m.vx = m.vy = 0;
  }
  const b = play.ball;
  let flying = false;
  // hands off long enough and the pitch slips back into the demo cycle —
  // any touch grabs it again
  if (play.live && !play.dragStart && !b.live) {
    play.idle += dt;
    if (play.idle > 5) {
      play.live = false;
      play.t = 0;
      play.lastTc = 0;
    }
  } else {
    play.idle = 0;
  }
  if (!play.live) {
    // attract loop: pikachu rides scripted legs — the shared checks below
    // fire the bumps and score the hits, same as a real pull
    play.t += dt;
    const cyc = SCRIPT_CYCLE[play.script];
    const lastT = SCRIPT_T[play.script][SCRIPT_T[play.script].length - 1];
    const tc = play.t % cyc;
    if (tc < play.lastTc) {
      for (const f of play.foes) f.timer = f.timer <= 1 ? 3 : f.timer - 1;
      play.script = (play.script + 1) % SCRIPTS.length; // next skeleton up
    }
    play.lastTc = tc;
    const pos = attractPos(Math.min(tc, lastT));
    if (tc < ATTRACT.windup || tc >= lastT) {
      b.live = false;
      b.vx = b.vy = 0;
      b.x = PAD.x;
      b.y = PAD.y;
      if (tc < ATTRACT.windup) {
        play.hitSet.clear();
        for (const m of play.team) m.fired = false;
        // the way-out leg clips whichever foe has drifted nearest the lane
        const anchor = SCRIPTS[play.script].aim;
        const nf = play.foes
          .slice()
          .sort((a, c) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(c.x - anchor.x, c.y - anchor.y))[0];
        if (nf) { play.aim.x = nf.x; play.aim.y = nf.y; }
      }
    } else {
      const ahead = attractPos(Math.min(tc + 0.03, lastT));
      b.vx = (ahead.x - pos.x) / 0.03;
      b.vy = (ahead.y - pos.y) / 0.03;
      b.x = pos.x;
      b.y = pos.y;
      b.live = true;
      flying = true;
    }
  } else if (b.live) {
    flying = true;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < STOP_SPEED) {
      // settled — the mon holds its landing spot like the real game and the
      // next squad member steps up wherever it rests
      b.live = false;
      b.vx = b.vy = 0;
      const me = activeMon();
      me.x = b.x;
      me.y = b.y;
      play.turn = (play.turn + 1) % play.team.length;
      const nx = activeMon();
      b.x = nx.x;
      b.y = nx.y;
      const nd = activeDef();
      play.pops.push({ x: nx.x, y: nx.y - 40, t: 0.8, label: `${nd.name} UP`, color: TYPE_COLOR[nd.type] });
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const fr = Math.exp(-FRICTION * dt);
      b.vx *= fr;
      b.vy *= fr;
    }
    const F = TITLE_FIELD;
    const wall = (v: number) => { if (Math.abs(v) > 120) sfx('bounce', 0.9); };
    if (b.x < F.x + BALL_R) { b.x = F.x + BALL_R; wall(b.vx); b.vx = Math.abs(b.vx) * WALL_REST; }
    if (b.x > F.x + F.w - BALL_R) { b.x = F.x + F.w - BALL_R; wall(b.vx); b.vx = -Math.abs(b.vx) * WALL_REST; }
    if (b.y < F.y + BALL_R) { b.y = F.y + BALL_R; wall(b.vy); b.vy = Math.abs(b.vy) * WALL_REST; }
    if (b.y > F.y + F.h - BALL_R) { b.y = F.y + F.h - BALL_R; wall(b.vy); b.vy = -Math.abs(b.vy) * WALL_REST; }
  }
  if (flying) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 7) b.trail.shift();
    const sp = Math.hypot(b.vx, b.vy);
    const bDef = activeDef();
    for (const f of play.foes) {
      if (play.hitSet.has(f)) continue;
      const fr2 = f.s * 0.5;
      const dx = b.x - f.x, dy = b.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d >= BALL_R + fr2 || d === 0) continue;
      const nx = dx / d, ny = dy / d; // unit normal, foe → ball
      if (play.live) {
        b.x = f.x + nx * (BALL_R + fr2);
        b.y = f.y + ny * (BALL_R + fr2);
        const vn = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * vn * nx) * UNIT_REST;
        b.vy = (b.vy - 2 * vn * ny) * UNIT_REST;
      } else {
        play.hitSet.add(f);
      }
      f.vx -= nx * sp * 0.5;
      f.vy -= ny * sp * 0.5;
      const fDef = speciesById(f.id)!;
      const eff = typeMult(bDef.type, fDef);
      play.pops.push({
        x: f.x, y: f.y, t: 0.8,
        label: String(physDamage(bDef.stats.atk, fDef.stats.def, eff, 1.4)),
        color: eff > 1 ? '#ffd84d' : '#e8ecf8',
      });
      sfx('hit', 0.9);
    }
    // bumping a teammate fires their super — the same trigger as bumpAlly
    for (const m of play.team) {
      if (m === activeMon() || m.fired) continue;
      if (Math.hypot(b.x - m.x, b.y - m.y) >= BALL_R + m.s * 0.5) continue;
      m.fired = true;
      m.pulse = 1;
      fireSuper(m);
    }
  }
  for (let i = play.orbs.length - 1; i >= 0; i--) {
    const o = play.orbs[i];
    o.t -= dt;
    const dx = o.tgt.x - o.x, dy = o.tgt.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 9 * dt);
    o.vx += ((dx / d) * 520 - o.vx) * k;
    o.vy += ((dy / d) * 520 - o.vy) * k;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (d < o.tgt.s * 0.5 + 8 || o.t <= 0) {
      if (d < o.tgt.s * 0.5 + 8) {
        if ('ax' in o.tgt) { // a foe eats it — knock + the damage number
          o.tgt.vx += (dx / d) * 160;
          o.tgt.vy += (dy / d) * 160;
          play.pops.push({ x: o.tgt.x, y: o.tgt.y, t: 0.7, label: String(o.dmg), color: o.c });
        } else {
          play.pops.push({ x: o.tgt.x, y: o.tgt.y, t: 0.5, label: '', color: o.c });
        }
      }
      play.orbs.splice(i, 1);
    }
  }
  // a rolling flame front catches each foe once as it passes over
  for (let i = play.waves.length - 1; i >= 0; i--) {
    const w = play.waves[i];
    w.t -= dt;
    w.r = (1 - Math.max(0, w.t) / w.life) * w.maxR;
    for (const f of play.foes) {
      if (w.hits.has(f)) continue;
      const d = Math.hypot(f.x - w.x, f.y - w.y);
      if (d > w.r + f.s * 0.5) continue;
      w.hits.add(f);
      f.vx += ((f.x - w.x) / (d || 1)) * 170;
      f.vy += ((f.y - w.y) / (d || 1)) * 170;
      play.pops.push({ x: f.x, y: f.y - 26, t: 0.7, label: String(w.dmg(f)), color: '#f08030' });
    }
    if (w.t <= 0) play.waves.splice(i, 1);
  }
  // chain arcs land a beat apart — each one knocks its target on arrival
  for (let i = play.bolts.length - 1; i >= 0; i--) {
    const bl = play.bolts[i];
    if (bl.delay > 0) {
      bl.delay -= dt;
      if (bl.delay <= 0) {
        const d = Math.hypot(bl.foe.x - bl.x1, bl.foe.y - bl.y1) || 1;
        bl.foe.vx += ((bl.foe.x - bl.x1) / d) * 200;
        bl.foe.vy += ((bl.foe.y - bl.y1) / d) * 200;
        play.pops.push({ x: bl.foe.x, y: bl.foe.y, t: 0.7, label: String(bl.dmg), color: '#f8d030' });
        sfx('zap', 1.15);
      }
    } else {
      bl.t -= dt;
      if (bl.t <= 0) play.bolts.splice(i, 1);
    }
  }
  for (const m of play.team) if (m.pulse > 0) m.pulse -= dt * 3;
  for (let i = play.pops.length - 1; i >= 0; i--) {
    play.pops[i].t -= dt;
    if (play.pops[i].t <= 0) play.pops.splice(i, 1);
  }
}

// jagged chain-lightning arc — regenerated every frame so it crackles
function bolt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const dl = Math.hypot(dx, dy) || 1;
  const px = -dy / dl, py = dx / dl;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (const u of [0.33, 0.66])
    ctx.lineTo(x1 + dx * u + px * (Math.random() - 0.5) * dl * 0.16, y1 + dy * u + py * (Math.random() - 0.5) * dl * 0.16);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#f8d030';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#fff8d0';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// Wild mons at the screen edges — the stadium crowd, clear of the pitch
const WILD_MONS: [number, number, number][] = [
  [16, 484, 118],
  [19, 72, 884],
  [41, 476, 884],
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

// 4-point hit sparkle — the game's impact star
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
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

// the friendly read — green hp bar + a row of charged pips, same chrome the
// battle HUD gives your side
const allyHud = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ty: PokeType) => {
  const bw = s * 0.75;
  ctx.fillStyle = '#000a';
  ctx.fillRect(x - bw / 2, y + s * 0.5 + 4, bw, 5);
  ctx.fillStyle = '#6fdc6f';
  ctx.fillRect(x - bw / 2, y + s * 0.5 + 4, bw, 5);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = TYPE_COLOR[ty];
    ctx.fillRect(x + (i - 1.5) * 7 - 2.5, y + s * 0.5 + 12, 5, 5);
  }
};

// every actor on the pitch, shared by the attract loop and the live sandbox
// — the scripted rider and a real pull feed the same play.ball
function drawActors(ctx: CanvasRenderingContext2D, t: number) {
  play.foes.forEach((f, i) => {
    monShadow(ctx, f.x, f.y + f.s * 0.05, f.s);
    const wob = Math.hypot(f.vx, f.vy) < 30 ? Math.sin(t * 2.2 + i * 1.7) * 2.5 : 0;
    drawMon(ctx, f.id, f.x, f.y + wob, f.s);
    // battle's hostile reads: flat-red hp bar + the attack countdown
    ctx.fillStyle = '#000a';
    ctx.fillRect(f.x - f.s * 0.38, f.y + f.s * 0.5 + 4, f.s * 0.75, 5);
    ctx.fillStyle = '#e05050';
    ctx.fillRect(f.x - f.s * 0.38, f.y + f.s * 0.5 + 4, f.s * 0.75, 5);
    ctx.font = font(10);
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${Math.ceil(f.timer)}`, f.x + f.s * 0.5 - 2, f.y - f.s * 0.5 + 7);
    ctx.fillStyle = f.timer <= 1 ? '#ff6b6b' : '#fff';
    ctx.fillText(`${Math.ceil(f.timer)}`, f.x + f.s * 0.5 - 2, f.y - f.s * 0.5 + 7);
  });

  // the rest of the squad idles on the pitch — sling through one and
  // their super fires
  for (const m of play.team) {
    if (m === activeMon()) continue; // the ball draws itself
    monShadow(ctx, m.x, m.y + m.s * 0.05, m.s);
    drawMon(ctx, m.id, m.x, m.y + Math.sin(t * 2.4 + m.id) * 2.5, m.s * (1 + Math.max(0, m.pulse) * 0.15));
    if (m.pulse > 0) {
      ctx.globalAlpha = m.pulse;
      ctx.strokeStyle = TYPE_COLOR[speciesById(m.id)!.type];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.s * 0.5 + (1 - m.pulse) * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    allyHud(ctx, m.x, m.y, m.s, speciesById(m.id)!.type);
  }

  for (const bl of play.bolts) if (bl.delay <= 0) bolt(ctx, bl.x1, bl.y1, bl.x2, bl.y2);

  // flame fronts — a hot lip rolling out over a faint scorch wash
  for (const w of play.waves) {
    const a = Math.max(0, w.t / w.life);
    ctx.globalAlpha = a * 0.18;
    ctx.fillStyle = '#f08030';
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#f08030';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffe76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const o of play.orbs) {
    ctx.fillStyle = o.c;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffffcc';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const b = play.ball;
  const bDef = activeDef();
  if (b.live) {
    b.trail.forEach((g, gi) => {
      ctx.globalAlpha = ((gi + 1) / b.trail.length) * 0.22;
      drawMon(ctx, bDef.id, g.x, g.y, 62);
    });
    ctx.globalAlpha = 1;
    const ang = Math.atan2(b.vy, b.vx) * 0.7;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    drawMon(ctx, bDef.id, 0, 0, 78);
    ctx.restore();
  } else {
    monShadow(ctx, b.x, b.y + 8, 76);
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(t * 2) * 1.5);
    if (play.dragStart) ctx.rotate(-0.15); // coiling into the pull
    drawMon(ctx, bDef.id, 0, 0, 76);
    ctx.restore();
    allyHud(ctx, b.x, b.y, 76, bDef.type);
    // whose-turn marker — the gold chevron bobs over the mon on deck
    if (!play.dragStart) {
      const bob = Math.sin(t * 4) * 3;
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.moveTo(b.x - 8, b.y - 60 + bob);
      ctx.lineTo(b.x + 8, b.y - 60 + bob);
      ctx.lineTo(b.x, b.y - 50 + bob);
      ctx.closePath();
      ctx.fill();
    }
  }

  const pulse = 1 + Math.sin(t * 5) * 0.15;
  for (const pop of play.pops) {
    ctx.globalAlpha = Math.min(1, pop.t / 0.3);
    sparkle(ctx, pop.x, pop.y, 12 * pulse, pop.color);
    if (pop.label) {
      ctx.textAlign = 'center';
      ctx.font = fontB(11);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(pop.label, pop.x, pop.y - 34);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.label, pop.x, pop.y - 34);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  t: number,
  cont: { stage: number; score: number } | null = null,
  newArmed = false, // new-climb link's two-tap confirm is lit — red warn label
  dailyArmed = false, // DAILY's own two-tap — warn-red face while it's lit
) {
  drawField(ctx);
  drawWildMons(ctx);

  // stadium shadow at the edges keeps the eye on logo + impact
  const vig = ctx.createRadialGradient(W / 2, 400, 280, W / 2, 400, 640);
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(1, 'rgba(6,14,6,0.2)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // wordmark rides upper-left — the action owns the rest of the pitch
  const logo = itemSprite('ui/pokemon-logo');
  if (logo) ctx.drawImage(logo, 36, 58, 330, 121);
  logoBig(ctx, 'STRIKE', 200, 236, 60, 320);

  if (play.live) {
    // --- live sandbox: the pitch is the player's ---
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.strokeRect(TITLE_FIELD.x, TITLE_FIELD.y, TITLE_FIELD.w, TITLE_FIELD.h);
    ctx.restore();
    drawActors(ctx, t);

    const b = play.ball;
    const bDef = activeDef();
    // the real aim read: pull dir aims, the meter powers — same preview the
    // battle scene draws (path dots, charge ring, gold band, launch arrow)
    if (play.dragStart && play.dragNow && !b.live) {
      const pull = { x: play.dragStart.x - play.dragNow.x, y: play.dragStart.y - play.dragNow.y };
      const pullLen = Math.hypot(pull.x, pull.y);
      const frac = monCharge(bDef, play.dragT);
      const zone = monZone(bDef);
      const maxed = Math.abs(frac - zone.c) <= zone.hw;
      const color = TYPE_COLOR[bDef.type];
      const F = TITLE_FIELD;

      // release-timing bar across the pitch top — Battle.drawMeter's layout
      const bw = Math.min(320, F.w * 0.64), bh = 14;
      const bx = F.x + (F.w - bw) / 2, by = F.y + 10;
      ctx.fillStyle = 'rgba(10,14,32,0.8)';
      ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
      ctx.fillStyle = '#ffffff1c';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ffd84d55';
      ctx.fillRect(bx + bw * (zone.c - zone.hw), by, bw * 2 * zone.hw, bh);
      ctx.save();
      if (maxed) {
        ctx.shadowColor = '#ffd84d';
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = maxed ? '#ffd84d' : color;
      ctx.fillRect(bx, by, bw * frac, bh);
      ctx.restore();
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(bx + bw * (zone.c - zone.hw), by - 3, 2, bh + 6);
      ctx.fillRect(bx + bw * (zone.c + zone.hw) - 2, by - 3, 2, bh + 6);

      if (pullLen >= 12) {
        const dir = { x: pull.x / pullLen, y: pull.y / pullLen };
        const speed = BASE_SHOT_SPEED * POWER * monLaunch(bDef) * (0.4 + 0.6 * (maxed ? 1 : frac));

        // predicted path — same sim as battle's aim: one wall bounce, stop
        // at first contact
        let sx = b.x, sy = b.y, svx = dir.x * speed, svy = dir.y * speed;
        const dots: { x: number; y: number }[] = [];
        let dead = false;
        sim: for (let i = 0; i < 60; i++) {
          const damp = Math.exp(-FRICTION / 30);
          svx *= damp;
          svy *= damp;
          sx += svx / 30;
          sy += svy / 30;
          if (Math.hypot(svx, svy) < 90) break;
          if (sx - BALL_R < F.x) { sx = F.x + BALL_R; svx = -svx * WALL_REST; dead = true; }
          else if (sx + BALL_R > F.x + F.w) { sx = F.x + F.w - BALL_R; svx = -svx * WALL_REST; dead = true; }
          if (sy - BALL_R < F.y) { sy = F.y + BALL_R; svy = -svy * WALL_REST; dead = true; }
          else if (sy + BALL_R > F.y + F.h) { sy = F.y + F.h - BALL_R; svy = -svy * WALL_REST; dead = true; }
          for (const f of play.foes)
            if (Math.hypot(sx - f.x, sy - f.y) < BALL_R + f.s * 0.5) { dead = true; break sim; }
          if (dead) break;
          if (i % 2 === 0) dots.push({ x: sx, y: sy });
        }
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        for (const q of dots) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (dead && dots.length) {
          const q = dots[dots.length - 1];
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y - 7);
          ctx.lineTo(q.x + 7, q.y);
          ctx.lineTo(q.x, q.y + 7);
          ctx.lineTo(q.x - 7, q.y);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // charge ring on the ball — the timing read where the eyes are
        const rr = BALL_R + 16, a0 = -Math.PI / 2;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff22';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffd84d66';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, a0 + Math.PI * 2 * (zone.c - zone.hw), a0 + Math.PI * 2 * (zone.c + zone.hw));
        ctx.stroke();
        ctx.save();
        if (maxed) {
          ctx.shadowColor = '#ffd84d';
          ctx.shadowBlur = 12;
        }
        ctx.strokeStyle = maxed ? '#ffd84d' : color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, a0, a0 + Math.PI * 2 * frac);
        ctx.stroke();
        ctx.restore();

        // launch arrow — points where the mon will fly, grows with charge
        const ex = b.x + dir.x * (50 + frac * 160);
        const ey = b.y + dir.y * (50 + frac * 160);
        ctx.save();
        if (maxed) {
          ctx.shadowColor = '#ffd84d';
          ctx.shadowBlur = 16;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        const hs = 14;
        const px = -dir.y, py = dir.x;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ex + dir.x * hs, ey + dir.y * hs);
        ctx.lineTo(ex + px * hs * 0.6, ey + py * hs * 0.6);
        ctx.lineTo(ex - px * hs * 0.6, ey - py * hs * 0.6);
        ctx.fill();
        ctx.restore();
      }
    }

  } else {
    drawActors(ctx, t);
  }

  // drag prompt — a ghost pull loops the gesture until the first real launch
  if (!play.launched && !play.ball.live) {
    const bx = play.ball.x;
    const by = play.ball.y;
    const gp = (t % 1.7) / 1.7;
    const ga = gp < 0.75 ? Math.sin((gp / 0.75) * Math.PI) : 0;
    ctx.save();
    ctx.globalAlpha = ga;
    ctx.strokeStyle = '#e8ecf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx - 58 * Math.min(1, gp / 0.75), by + 64 * Math.min(1, gp / 0.75), 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = ga * 0.5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 58 * Math.min(1, gp / 0.75), by + 64 * Math.min(1, gp / 0.75));
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.55 + Math.sin(t * 3.4) * 0.3;
    ctx.textAlign = 'center';
    fitFont(ctx, 'GRAB A MON · PULL BACK · LET GO — THE PITCH IS PLAYABLE', 10, W - 60);
    ctx.strokeStyle = '#0a2410';
    ctx.lineWidth = 4;
    ctx.strokeText('GRAB A MON · PULL BACK · LET GO — THE PITCH IS PLAYABLE', W / 2, TITLE_FIELD.y + TITLE_FIELD.h - 14);
    ctx.fillStyle = '#ffe76a';
    ctx.fillText('GRAB A MON · PULL BACK · LET GO — THE PITCH IS PLAYABLE', W / 2, TITLE_FIELD.y + TITLE_FIELD.h - 14);
    ctx.globalAlpha = 1;
  }

  // the pitch in one line — a stranger gets the loop before they tap a thing
  ctx.font = font(11);
  ctx.fillStyle = '#0a2410';
  ctx.textAlign = 'center';
  ctx.fillText('SLING · BOUNCE · CATCH · CLIMB', W / 2 + 1, FREE_BTN.y - 15);
  ctx.fillStyle = PARCH;
  ctx.fillText('SLING · BOUNCE · CATCH · CLIMB', W / 2, FREE_BTN.y - 16);
  // the front door rides the press-edge pills — gold for the climb,
  // parchment for the daily, same ramp the rest of the UI moved to
  pill(ctx, FREE_BTN, {
    c: '#ffd84d',
    cd: '#c8a44d',
    tc: '#2a2440',
    label: cont ? 'CONTINUE' : 'START CLIMB',
    sub: cont ? `STAGE ${Math.max(1, cont.stage)}` : undefined,
  });
  pill(ctx, DAILY_BTN, dailyArmed
    ? { c: '#e03c34', cd: '#a02a24', tc: '#ffe8e8', label: 'DROP SAVED RUN?' }
    : { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'DAILY' });
  // a live daily streak pins a gold pip on the corner — the tasksReady
  // red pip's family, flipped to gold for a kept-up habit
  const dStreak = streakDaily();
  if (dStreak > 0) {
    const bx = DAILY_BTN.x + DAILY_BTN.w - 4, by = DAILY_BTN.y + 4;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd84d';
    ctx.fill();
    ctx.strokeStyle = '#0a0d18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a2440';
    ctx.fillText(dStreak > 9 ? '9+' : `${dStreak}`, bx, by + 3.5);
  }
  // today's seeded rule card hugs the DAILY pill's bottom-right — it only
  // shows on a clean title; a parked run's new-climb link owns that band
  if (!cont) {
    const dm = todaysMod();
    ctx.save();
    ctx.font = fontB(7);
    ctx.textAlign = 'right';
    ctx.fillStyle = PARCH;
    ctx.fillText(`TODAY: ${dm.name}`, DAILY_BTN.x + DAILY_BTN.w - 2, DAILY_BTN.y + DAILY_BTN.h + 11);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(dm.desc, DAILY_BTN.x + DAILY_BTN.w - 2, DAILY_BTN.y + DAILY_BTN.h + 21);
    ctx.restore();
  }
  if (cont) {
    // a parked climb still needs the escape hatch — text link under the
    // pair; the hairline underline is the press affordance. Armed by a
    // first tap, it turns warn-red and asks for the second that burns it.
    const msg = newArmed
      ? 'ABANDON THE SAVED CLIMB? TAP AGAIN'
      : `or start a new climb · saved at ${cont.score.toLocaleString('en-US')} pts`;
    const col = newArmed ? '#e03c34' : '#aab4dd';
    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = col;
    ctx.fillText(msg, W / 2, NEW_BTN.y + NEW_BTN.h - 2);
    const tw = ctx.measureText(msg).width;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - tw / 2, NEW_BTN.y + NEW_BTN.h);
    ctx.lineTo(W / 2 + tw / 2, NEW_BTN.y + NEW_BTN.h);
    ctx.stroke();
  }

  // a fallen team haunts the next climb — one spectral line in the band
  // under the start pill (it stacks under the new-climb link when a run parks)
  if (echoIds()?.length) {
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = TYPE_COLOR.ghost;
    ctx.fillText('A RIVAL TEAM HAUNTS THE CLIMB', W / 2, FREE_BTN.y - 7);
  }

  // ? badge, top corner — the how-to-play overlay
  ctx.fillStyle = '#12152b';
  ctx.fillRect(HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h);
  dither(ctx, HELP_BTN, 0.09);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(HELP_BTN.x, HELP_BTN.y, HELP_BTN.w, HELP_BTN.h);
  ctx.font = font(16);
  ctx.fillStyle = PARCH;
  ctx.fillText('?', HELP_BTN.x + HELP_BTN.w / 2 + 3, HELP_BTN.y + HELP_BTN.h / 2 + 14);

  // mute badge, opposite corner — speaker glyph, slashed when off
  const mcx = MUTE_BTN.x + MUTE_BTN.w / 2, mcy = MUTE_BTN.y + MUTE_BTN.h / 2;
  ctx.fillStyle = '#12152b';
  ctx.fillRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h);
  dither(ctx, MUTE_BTN, 0.09);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h);
  speakerGlyph(ctx, mcx, mcy, 1);

  // gear badge beside the ? — opens the settings modal
  ctx.fillStyle = '#12152b';
  ctx.fillRect(GEAR_BTN.x, GEAR_BTN.y, GEAR_BTN.w, GEAR_BTN.h);
  dither(ctx, GEAR_BTN, 0.09);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(GEAR_BTN.x, GEAR_BTN.y, GEAR_BTN.w, GEAR_BTN.h);
  gearGlyph(ctx, GEAR_BTN.x + GEAR_BTN.w / 2, GEAR_BTN.y + GEAR_BTN.h / 2, 1.5, PARCH);
  // dex, trophies, ladder, tasks — one row of equal parchment pills
  pill(ctx, DEX_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: `DEX ${dexIds().length}/${CATCHABLE}` });
  pill(ctx, ACH_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: `★ ${unlockedAch().size}/${ACHIEVEMENTS.length}` });
  pill(ctx, BOARD_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'TOP RUNS' });
  pill(ctx, TASKS_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'TASKS' });
  // a claimable task pins a red count pip on the chip corner — the same
  // notification pull the dex count works, shrunk to a badge
  const taskN = tasksReady();
  if (taskN > 0) {
    const bx = TASKS_BTN.x + TASKS_BTN.w - 4, by = TASKS_BTN.y + 4;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#e03c34';
    ctx.fill();
    ctx.strokeStyle = '#0a0d18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8f8f0';
    ctx.fillText(taskN > 9 ? '9+' : `${taskN}`, bx, by + 3.5);
  }
  // the records line is the one-more-run hook — ranked ladder, best score
  const b = best();
  const ld = tier();
  const bits = [`RANK ${rankName()}`, `BEST ${b.score.toLocaleString('en-US')}`];
  if (b.stage) bits.push(`PEAK ${b.stage}`);
  if (b.wins) bits.push(`ASCENSION ${Math.min(b.wins, 9)}`);
  const wStreak = streakWins();
  if (wStreak > 1) bits.push(`STREAK ${wStreak}`);
  fitFont(ctx, bits.join(' · '), 8, W - 40);
  ctx.fillStyle = '#aab4dd';
  ctx.fillText(bits.join(' · '), W / 2, DEX_BTN.y + DEX_BTN.h + 22);
  // the ladder: a fill bar toward the next tier, tinted to the current one
  const rw = 220, rx = W / 2 - rw / 2, ry = DEX_BTN.y + DEX_BTN.h + 33;
  ctx.fillStyle = '#1a2040';
  ctx.fillRect(rx, ry, rw, 7);
  ctx.fillStyle = ld.color;
  ctx.fillRect(rx, ry, Math.max(3, rw * ld.prog), 7);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, 6);
  ctx.font = fontB(7);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    ld.next
      ? `${rating()} PTS ${ld.name} — ${Math.round(ld.prog * 100)}% TO ${ld.next.name}`
      : `${rating()} PTS ${ld.name} — TOP OF THE LADDER`,
    W / 2,
    ry + 19,
  );
  // the heat dial: gold while a pick is on, parchment at zero, grayed until
  // a first clear lifts the cap off the floor — a tap cycles 0..cap
  const ascCap = Math.min(b.wins, 9);
  const pick = ascPick();
  pill(ctx, ASC_BTN, {
    c: pick > 0 ? '#ffd84d' : '#e8ecf8',
    cd: pick > 0 ? '#c8a44d' : '#aab0c8',
    tc: '#2a2440',
    label: `ASC ${pick}`,
    disabled: ascCap === 0,
  });
  // the picked tier's name under the dial — ASC 0 leaves the band empty
  const ascModName = pick > 0 ? ASC_MODS[pick - 1]?.name : undefined;
  if (ascModName) {
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8890b8';
    ctx.fillText(ascModName, ASC_BTN.x + ASC_BTN.w / 2, ASC_BTN.y + ASC_BTN.h + 10);
  }

  // build tag — bug reports should name their build
  ctx.font = fontB(7);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff30';
  ctx.fillText(__BUILD__, W - 10, H - 8);
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
      'fast mons aim high and tight; stronger mons get a faster sweep',
      'the band drifts a little every pull — read it, don\'t memorize',
    ],
    demo: demoAim,
  },
  {
    title: 'ALLY CHAINS',
    lines: ['fly through a teammate mid-flight — full pips fire their super', 'each pass adds damage and speed, so route through allies'],
    demo: demoBump,
  },
  {
    title: 'RICOCHET',
    lines: [
      'two different touches — foe, ally, wall, stone — in 0.35s flash RICOCHET!',
      "hitting the same thing twice doesn't count",
      'relics cash it in: Binding Band +40% hits, Ether feeds a pip',
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
    lines: [
      'each wave seeds a pickup — the colored ring and tag name it',
      'berry heals the team, protein buffs the shot, elixir charges pips',
      'roll the ball through to collect on touch',
      'one spawns each wave, two when something big lurks',
    ],
    demo: demoPickups,
  },
  {
    title: 'CATCHING',
    lines: [
      'beaten foes sometimes drop a ball: catches go to your box',
      'beat a gym and its ace joins your box too',
      'a duplicate feeds the copy you own: +1 LUCK every fusion',
      'luck pays out in gym loot',
      'split evolutions (Eevee, Tyrogue…) ask which form after the fight',
    ],
    demo: demoCatch,
  },
  {
    title: 'LEVELING UP',
    lines: [
      'every KO levels the mon that launched the shot',
      'tougher foes teach more — cap Lv100, levels survive evolution',
      'each win raises ASCENSION: foes get tougher and faster',
      'ASC buys perks: a second charm (3), weaker rests (4), enraged gyms (6)',
    ],
    demo: demoCharge,
  },
  {
    title: 'THE CLIMB',
    lines: [
      '9 stages, a gym every 3rd: pick your route on the map',
      'after each fight: fix the lineup first, then take an item',
      'lose and your fallen team returns next run as the rival',
      'every run moves your ladder rating — wins climb, wipes drop',
    ],
    demo: demoClimb,
  },
  {
    title: 'MAP STOPS',
    lines: [
      'rests heal and revive · chests pay an item · both still fight after',
      'trainer squads pay better loot but can\'t be caught',
      'ELITE doors fight deeper and pay rare+ relics',
      '??? is a surprise — heal, haul, or ambush',
    ],
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
  {
    title: 'ULTIMATE',
    // lazy: ULT_SHOTS lives in battle.ts, which imports this module — a
    // top-level read would hit the const before it's initialized
    get lines() {
      return [
        `not a per-mon super — one shared meter · every shot banks a pip, ${ULT_SHOTS} pips arm it`,
        'when the gauge floods gold, TAP any glowing mon — its type picks the nuke',
        'all foes take the hit · bosses shrug off most of it · charge resets each fight',
        // key affordances hide on touch — same (pointer: fine) gate as the [1]/[R] hints
        ...(HAS_KEYS ? ['on keys: ? help · P pause · M mute · arrows turn pages'] : []),
      ];
    },
    demo: demoCharge,
  },
];

// Help is reference, not onboarding: two sections a page so nobody scrolls
// a manual. Pages pair what belongs together — shot basics with the enemy
// countdown, supers with their pips, map stops with the climb.
const HELP_PAGES: { name: string; secs: number[] }[] = [
  { name: 'YOUR SHOT', secs: [0, 4] },
  { name: 'SUPERS', secs: [1, 3] },
  { name: 'ULTIMATE', secs: [16] },
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
// 40px touch floor — the same size as the corner chips these sit beside
export const HELP_PREV = { x: HELP_PANEL.x + 14, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 40 };
export const HELP_NEXT = { x: HELP_PANEL.x + HELP_PANEL.w - 62, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 40 };
export const HELP_CLOSE = { x: HELP_PANEL.x + HELP_PANEL.w - 48, y: HELP_PANEL.y + 12, w: 40, h: 40 };

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
// the menu chip row — four equal chips on 8px gutters, spanning the old
// row's left edge to W-27 so TASKS slots in without moving the records line
const MENU_CHIP_W = (W - 27 - (W / 2 - 205) - 3 * 8) / 4; // 106
// +36 over FREE's edge leaves the parked-run line (NEW_BTN, 24px + the
// rival-echo note) its band — records and ladder key off this row and follow
export const DEX_BTN = { x: W / 2 - 205, y: FREE_BTN.y + FREE_BTN.h + 36, w: MENU_CHIP_W, h: 48 };
export const ACH_BTN = { x: DEX_BTN.x + DEX_BTN.w + 8, y: DEX_BTN.y, w: MENU_CHIP_W, h: 48 };
export const BOARD_BTN = { x: ACH_BTN.x + ACH_BTN.w + 8, y: DEX_BTN.y, w: MENU_CHIP_W, h: 48 };
export const TASKS_BTN = { x: BOARD_BTN.x + BOARD_BTN.w + 8, y: DEX_BTN.y, w: MENU_CHIP_W, h: 48 };
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

// --- hall of fame: the top climbs this device has logged, score-ranked ---
const BOARD_ROW = 74;
const BOARD_HEAD = 84;

export function drawBoard(ctx: CanvasRenderingContext2D) {
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
  ctx.fillText('HALL OF FAME', r.x + r.w / 2, r.y + 40);
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('the top climbs logged on this device — score rules all', r.x + r.w / 2, r.y + 58);

  const list = board();
  if (!list.length) {
    fitFont(ctx, 'NO RUNS YET — CLIMB AND CLAIM A SPOT', 10, r.w - 40);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('NO RUNS YET — CLIMB AND CLAIM A SPOT', r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + BOARD_HEAD, r.w - 16, r.h - BOARD_HEAD - 36);
  ctx.clip();
  list.forEach((e, i) => {
    const y = r.y + BOARD_HEAD + i * BOARD_ROW;
    const rx = r.x + 14, rw = r.w - 28;
    roundRect(ctx, rx, y, rw, BOARD_ROW - 10, 8);
    ctx.fillStyle = i === 0 ? '#1d2545' : '#0d1126';
    ctx.fill();
    ctx.strokeStyle = i === 0 ? GOLD : '#2a3560';
    ctx.lineWidth = i === 0 ? 2 : 1;
    ctx.stroke();
    // rank plate — gold for the leader
    ctx.font = font(11);
    ctx.textAlign = 'left';
    ctx.fillStyle = i === 0 ? '#ffd84d' : '#8890b8';
    ctx.fillText(`#${i + 1}`, rx + 14, y + 30);
    ctx.font = font(11);
    ctx.fillStyle = '#f0e6c8';
    ctx.fillText(e.s.toLocaleString('en-US'), rx + 62, y + 30);
    ctx.font = fontB(9);
    ctx.fillStyle = '#8890b8';
    const line = `${e.w ? 'CLEARED' : `STAGE ${e.st}/${TOTAL_STAGES}`}${e.asc ? ` · ASC ${e.asc}` : ''}`;
    ctx.fillText(line, rx + 62, y + 50);
    const d = new Date(e.when);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5a6284';
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, rx + rw - 12, y + 16);
    // the run's lineup marches the right edge — the plaque's face
    e.team.slice(0, 4).forEach((id, ti) => {
      try {
        drawMon(ctx, id, rx + rw - 110 + ti * 28, y + BOARD_ROW / 2 - 6, 26);
      } catch {
        /* sprite not warmed */
      }
    });
    ctx.textAlign = 'center';
  });
  ctx.restore();

  // the lifetime ledger under the plaques — same muted small print
  const bb = best();
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    `BEST ${bb.score.toLocaleString('en-US')} · PEAK ${bb.stage} · RUNS ${bb.runs} · WINS ${bb.wins}`,
    r.x + r.w / 2,
    r.y + r.h - 28,
  );
  ctx.fillText('tap to close', r.x + r.w / 2, r.y + r.h - 14);
}

// --- trophy shelf: the badge case on top, the StS-style achievement list under ---
const ACH_ROW = 58;
const ACH_HEAD = 234; // the badge case owns the head — the trophy list scrolls below

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
        fillStar(ctx, r.x + 34, y + ACH_ROW / 2 - 4, 8);
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

// the BAG row — card-lite chips of stocked consumables; ≤2 ride into the
// run (gold rim + lift, the shiny-card selection language). `last` is the
// last tapped chip — its desc sits on one dim line under the row. Empty
// stock hides the whole thing — no dead UI.
function drawBagRow(
  ctx: CanvasRenderingContext2D,
  sel: ReadonlySet<string>,
  last: string | null,
) {
  const items = bagRowItems();
  if (!items.length) return;
  const stock = bagStock();
  ctx.textAlign = 'center';
  ctx.font = font(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BAG — TAKE UP TO ${BAG_MAX}${sel.size ? ` · ${Math.min(sel.size, BAG_MAX)}/${BAG_MAX}` : ''}`, W / 2, BAG_ROW.y + 13);
  items.forEach((it, i) => {
    const on = sel.has(it.id);
    const r = bagChipRect(i, items.length);
    const cr = { x: r.x, y: r.y + (on ? -4 : 0), w: r.w, h: r.h };
    // same anatomy as the offer cards, pocket size: drop shadow, dark face,
    // frame — gold inner rim when it's riding along
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, cr.x + 2, cr.y + 4, cr.w, cr.h, 8);
    ctx.fill();
    roundRect(ctx, cr.x, cr.y, cr.w, cr.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    cardFrame(ctx, cr, 8);
    if (on) rim(ctx, cr, 8, '#ffd84d', 2);
    void loadItem(it.item);
    const img = itemSprite(it.item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, cr.x + cr.w / 2 - 13, cr.y + 7, 26, 26);
      ctx.restore();
    }
    ctx.font = fontB(7);
    ctx.fillStyle = on ? PARCH : '#a8b0d0';
    ctx.textAlign = 'center';
    ctx.fillText(it.name.toUpperCase(), cr.x + cr.w / 2, cr.y + 49);
    // ×n stock badge top-right — gold-lit when the chip is picked
    const n = `×${stock[it.id] ?? 0}`;
    ctx.font = fontB(7);
    const bw = ctx.measureText(n).width + 10;
    roundRect(ctx, cr.x + cr.w - bw - 5, cr.y + 5, bw, 13, 6.5);
    ctx.fillStyle = on ? '#ffd84d' : 'rgba(42,36,64,0.9)';
    ctx.fill();
    ctx.fillStyle = on ? '#2a2440' : '#e8ecf8';
    ctx.fillText(n, cr.x + cr.w - bw / 2 - 5, cr.y + 14.5);
  });
  // last tap answers "what does this one do?" — one dim line, order-free
  const li = items.findIndex((it) => it.id === last);
  if (li >= 0) {
    ctx.font = fontB(7);
    ctx.fillStyle = '#6a7498';
    ctx.textAlign = 'center';
    ctx.fillText(items[li].desc.toUpperCase(), W / 2, BAG_ROW.y + 92);
  }
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
  rerolls: number,
  spin: { age: number; pool: SpeciesDef[]; idx: number[] },
  bag: { sel: ReadonlySet<string>; last: string | null },
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
  const spinning = spin.age < REEL_STOPS[REEL_STOPS.length - 1];
  ctx.fillText(
    spinning
      ? 'reels rolling — tap to skip'
      : picked.length === 3
        ? 'ace round — a veteran anchors the team'
        : 'one of three — your picks become the balls you sling',
    W / 2,
    180,
  );

  drawBagRow(ctx, bag.sel, bag.last);

  const dex = new Set(dexIds()); // kind chips read dex membership per card — parse once a frame
  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    // lifted-card shadow, then the face
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 10);
    ctx.fill();
    cardFace(ctx, r, def.type);
    cardFrame(ctx, r, 10);
    if (def.shiny) rim(ctx, r, 10, '#ffd84d', 2);

    // same anatomy as the relic cards: a type-tinted header band carries
    // the sprite — the reel plays inside it
    const band = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: 106 };

    // slot reel: pool faces scroll past until the reel brakes onto the offer
    const stopAt = REEL_STOPS[i] ?? REEL_STOPS[REEL_STOPS.length - 1];
    const spinP = Math.min(spin.age / stopAt, 1);
    if (spinP < 1) {
      ctx.save();
      roundRect(ctx, band.x, band.y, band.w, band.h + 9, 9);
      ctx.clip();
      ctx.fillStyle = '#0a0e1e';
      ctx.fillRect(band.x, band.y, band.w, band.h);
      // ease-out quart — a fast blur of faces that settles hard on the deal
      const steps = 9 + i * 3;
      const pos = steps * (1 - Math.pow(1 - spinP, 4));
      const L = spin.pool.length;
      for (let j = Math.floor(pos) - 1; j <= Math.floor(pos) + 2; j++) {
        const d = spin.pool[(((spin.idx[i] + j - steps) % L) + L) % L];
        drawMon(ctx, d.id, band.x + band.w / 2, band.y + band.h / 2 + (j - pos) * 80, 72);
      }
      // fade the band edges so faces slide out of the dark
      const g = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
      g.addColorStop(0, 'rgba(10,14,30,0.9)');
      g.addColorStop(0.35, 'rgba(10,14,30,0)');
      g.addColorStop(0.65, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(band.x, band.y, band.w, band.h);
      ctx.restore();
      ctx.font = font(9);
      ctx.fillStyle = '#3a4468';
      ctx.textAlign = 'center';
      ctx.fillText('· · ·', r.x + r.w / 2, r.y + 184);
      return;
    }
    // landing pop: the sprite overshoots for a beat as the reel stops
    const pop = 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15);

    stripeBand(ctx, band, TYPE_COLOR[def.type]);
    // type chip top-left: light pill, type ink darkened so pale types
    // (electric, ice) still read on it
    chip(ctx, r.x + 9, r.y + 9, def.type.toUpperCase(), {
      bg: '#e8ecf8',
      fg: mixHex(TYPE_COLOR[def.type], '#2a2440', 0.45),
    });
    // kind pill top-right — SHINY trumps the dex tag
    const kind = def.shiny ? 'SHINY' : dex.has(def.id) ? 'OWNED' : 'NEW';
    ctx.font = fontB(7);
    chip(ctx, r.x + r.w - 9 - ctx.measureText(kind).width - 14, r.y + 9, kind, def.shiny
      ? { bg: '#ffd84d', fg: '#2a2440' }
      : { bg: 'rgba(42,36,64,0.8)', fg: '#e8ecf8' });

    // the sprite gets the band center with the same soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, band.x + band.w / 2, band.y + band.h / 2 + 2, 84 * pop);
    ctx.restore();

    // evolution hint + trait tag ride the strip under the band — Magikarp
    // is secretly Gyarados
    if (def.evolvesTo != null) {
      const nx = Array.isArray(def.evolvesTo)
        ? `${def.evolvesTo.length} FORMS`
        : speciesById(def.evolvesTo)?.name.toUpperCase();
      if (nx) {
        ctx.textAlign = 'left';
        ctx.font = fontB(9);
        ctx.fillStyle = '#9df0ff';
        ctx.fillText(`→ ${nx}`, r.x + 10, r.y + 126);
      }
    }
    if (def.pierce || def.copy) {
      ctx.textAlign = 'right';
      ctx.font = font(8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 9, r.y + 127);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 10, r.y + 126);
    }

    ctx.textAlign = 'center';
    fitFont(ctx, def.name, 14, r.w - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(def.name, r.x + r.w / 2 + 1, r.y + 165);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 164);

    ctx.font = fontB(10);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`#${String(def.id).padStart(3, '0')} · Lv${def.lvl ?? 1}`, r.x + r.w / 2, r.y + 186);

    ctx.font = fontB(10);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${roleTag(def)}`, r.x + r.w / 2, r.y + 206);

    // the bump super this mon fires — a draft decision you can taste
    ctx.font = fontB(11);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${moveOf(def.id, def.type)}`, r.x + r.w / 2, r.y + 226);
    ctx.font = fontB(9);
    ctx.fillStyle = '#a8b0d0';
    const dl = wrap2(ctx, superDesc(def.id, def.type), r.w - 16);
    dl.forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, r.y + 238 + li * 11));

    if (HAS_KEYS) keyHint(ctx, r, `[${i + 1}]`); // [1]/[2]/[3] — desktop keys pick cards
  });

  // one board reshuffle per draft — spent charges gray out
  pill(ctx, DRAFT_REROLL, {
    c: '#3a8cff',
    cd: '#2563d8',
    tc: '#fff',
    label: 'REROLL',
    badge: `×${rerolls}`,
    disabled: rerolls <= 0,
  });

  // picked team strip
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 650);
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

// the item reel cycles every held-item icon the game can deal
const ITEM_REEL = [...new Set(PERKS.map((p) => p.item))];

// One held-item offer card — shared by the post-stage reward and the
// pre-run charm pick. `spin` runs the same reel reveal the draft uses.
// opts.owned marks repeat picks (DUPE pill); opts.idx feeds the [n] key hint.
export function drawPerkCard(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  perk: { name: string; item: string; desc: string; rarity: Rarity },
  spin?: { age: number; i: number },
  opts?: { owned?: boolean; idx?: number },
) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 10);
  ctx.fill();
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 10);

  // pokebonk anatomy: a rarity header band carries the icon — the reel
  // plays inside it too
  const band = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: 72 };
  const stopAt = spin ? (REEL_STOPS[spin.i] ?? REEL_STOPS[REEL_STOPS.length - 1]) : 0;
  if (spin && spin.age < stopAt) {
    // slot reel: item icons scroll past inside the band until it brakes
    // onto the deal — band/chips stay hidden or the spin would spoil itself
    ctx.save();
    roundRect(ctx, band.x, band.y, band.w, band.h + 9, 9);
    ctx.clip();
    ctx.fillStyle = '#0a0e1e';
    ctx.fillRect(band.x, band.y, band.w, band.h);
    // ease-out quart — a fast blur of icons that settles hard on the deal
    const spinP = Math.min(spin.age / stopAt, 1);
    const steps = 9 + spin.i * 3;
    const pos = steps * (1 - Math.pow(1 - spinP, 4));
    const L = ITEM_REEL.length;
    const idx = Math.max(0, ITEM_REEL.indexOf(perk.item));
    ctx.imageSmoothingEnabled = false;
    for (let j = Math.floor(pos) - 1; j <= Math.floor(pos) + 2; j++) {
      const img = itemSprite(ITEM_REEL[(((idx + j - steps) % L) + L) % L]);
      if (img) ctx.drawImage(img, band.x + band.w / 2 - 20, band.y + band.h / 2 - 20 + (j - pos) * 48, 40, 40);
    }
    // fade the band edges so icons slide out of the dark
    const g = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
    g.addColorStop(0, 'rgba(10,14,30,0.9)');
    g.addColorStop(0.35, 'rgba(10,14,30,0)');
    g.addColorStop(0.65, 'rgba(10,14,30,0)');
    g.addColorStop(1, 'rgba(10,14,30,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = font(9);
    ctx.fillStyle = '#3a4468';
    ctx.fillText('· · ·', r.x + r.w / 2, r.y + 178);
    return;
  }
  // landing pop: the icon overshoots for a beat as the reel stops
  const pop = spin ? 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15) : 1;

  stripeBand(ctx, band, RARITY_COLOR[perk.rarity]);
  // rarity pill top-left (light), kind pill top-right (dark) — our perks
  // re-apply/stack, so a repeat is DUPE not UPGRADE
  chip(ctx, r.x + 9, r.y + 9, perk.rarity.toUpperCase(), { bg: '#e8ecf8', fg: '#2a2440' });
  const kind = opts?.owned ? 'DUPE' : 'NEW';
  ctx.font = fontB(7);
  chip(ctx, r.x + r.w - 9 - ctx.measureText(kind).width - 14, r.y + 9, kind, {
    bg: 'rgba(42,36,64,0.8)',
    fg: '#e8ecf8',
  });

  const img = itemSprite(perk.item);
  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(img, band.x + band.w / 2 - 22 * pop, band.y + band.h / 2 - 22 * pop, 44 * pop, 44 * pop);
    ctx.restore();
  } else {
    ctx.textAlign = 'center';
    ctx.font = font(16);
    ctx.fillStyle = PARCH;
    ctx.fillText('?', band.x + band.w / 2 + 3, band.y + band.h / 2 + 12);
  }
  ctx.textAlign = 'center';
  fitFont(ctx, perk.name, 9, r.w - 12);
  ctx.fillStyle = PARCH;
  ctx.fillText(perk.name, r.x + r.w / 2, r.y + 104);
  ctx.font = fontB(9);
  ctx.fillStyle = '#a8b0d8';
  // two-line desc
  const words = perk.desc.split(' ');
  const mid = Math.ceil(words.length / 2);
  ctx.fillText(words.slice(0, mid).join(' '), r.x + r.w / 2, r.y + 128);
  ctx.fillText(words.slice(mid).join(' '), r.x + r.w / 2, r.y + 146);

  // [1]/[2]/[3] — desktop keys pick cards off the board
  const idx = opts?.idx ?? spin?.i;
  if (idx != null && HAS_KEYS) keyHint(ctx, r, `[${idx + 1}]`);
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  offers: { id?: string; name: string; item: string; desc: string; rarity: Rarity }[],
  recruit: SpeciesDef | null,
  next: { stage: number; gym: boolean; rolled: boolean },
  score: number,
  heldItems: string[],
  evo: { from: SpeciesDef; options: SpeciesDef[] } | null,
  luck: number,
  spin: number, // reel age in seconds — counts up from the deal
  perkIds?: string[], // the run's granted perks — repeat offers tag as DUPE
) {
  ctx.fillStyle = '#0b0e1ad8';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // a fresh catch gets the hero slot: a gold-framed card with a breathing
  // sprite — and it IS the swap button now, tapping opens the team panel
  if (recruit) {
    const r = REWARD_CATCH;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, r.x + 3, r.y + 5, r.w, r.h, 12);
    ctx.fill();
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = '#171d36';
    ctx.fill();
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = 3;
    ctx.stroke();
    const pulse = 1 + Math.sin(spin * 5) * 0.05;
    drawMon(ctx, recruit.id, r.x + 52, r.y + r.h / 2, 56 * pulse);
    ctx.textAlign = 'left';
    ctx.font = font(9);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText('NEW CATCH!', r.x + 98, r.y + 24);
    fitFont(ctx, recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), 12, r.w - 112);
    ctx.fillStyle = PARCH;
    ctx.fillText(recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), r.x + 98, r.y + 46);
    ctx.font = fontB(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('in your box — tap to open TEAM · ITEMS', r.x + 98, r.y + 64);
    ctx.textAlign = 'center';
  }

  ctx.font = font(20);
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE AN ITEM', W / 2, 300);
  ctx.font = font(10);
  ctx.fillStyle = '#e8ecf8';
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, W / 2, 356);
  if (spin < REEL_STOPS[REEL_STOPS.length - 1]) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('reels rolling — tap to skip', W / 2, 372);
  } else if (luck > 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#6fdc6f';
    ctx.fillText(`TEAM LUCK ${luck} — fusion dupes feed the gym fountain`, W / 2, 372);
  } else {
    ctx.font = fontB(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('pick a relic — your box waits on the map', W / 2, 372);
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

  offers.forEach((perk, i) =>
    drawPerkCard(ctx, perkCardRect(i), perk, { age: spin, i }, { owned: !!perk.id && !!perkIds?.includes(perk.id) }),
  );

  // held items — the run's build so far, a strip of icons under the
  // tool row so you can read your loadout at a glance
  if (heldItems.length) {
    const iw = 22, gap = 6, n = Math.min(heldItems.length, 14);
    let ix = W / 2 - (n * (iw + gap) - gap) / 2;
    heldItems.slice(0, 14).forEach((item) => {
      const img = itemSprite(item);
      ctx.globalAlpha = 0.9;
      if (img) ctx.drawImage(img, ix, 644, iw, iw);
      ix += iw + gap;
    });
    ctx.globalAlpha = 1;
  }

  // next row on the map — gyms announce themselves; wild rows stay quiet
  // since the actual choice happens on the map now
  ctx.font = font(8);
  const nextY = 852;
  if (next.gym) {
    ctx.fillStyle = '#f85888';
    ctx.fillText('NEXT: GYM LEADER', W / 2, nextY);
  } else {
    ctx.fillStyle = '#8890b8';
    ctx.fillText('NEXT: PICK YOUR ROUTE', W / 2, nextY);
  }
  // StS lets you decline a reward — cashes out as score via the tool row's
  // SKIP pill now — and lets you check the deck mid-pick: TEAM · ITEMS is
  // the same panel the map carries
  pill(ctx, REWARD_TEAM, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'TEAM · ITEMS' });

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

// The offer-board tool row: REROLL re-deals the offers, SKIP cashes the
// board out as +150 score, BANISH arms then culls the next card tapped.
// Charges are per-run — main.ts hit-tests TOOL_* and owns the tools state.
export function drawToolRow(
  ctx: CanvasRenderingContext2D,
  tools: { roll: number; ban: number },
  banArmed: boolean,
  t: number, // frame time in seconds — drives the armed pulse
) {
  pill(ctx, TOOL_ROLL, {
    c: '#3a8cff',
    cd: '#2563d8',
    tc: '#fff',
    label: 'REROLL',
    badge: `×${tools.roll}`,
    sub: HAS_KEYS ? '[R]' : undefined,
    disabled: tools.roll <= 0,
  });
  pill(ctx, TOOL_SKIP, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'SKIP +150', sub: HAS_KEYS ? '[X]' : undefined });
  ctx.save();
  // armed reads as their .armed state — a pulsing red waiting on a card tap
  if (banArmed) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 8);
  pill(ctx, TOOL_BAN, {
    c: '#ff5a5f',
    cd: '#e0303e',
    tc: '#fff',
    label: 'BANISH',
    badge: `×${tools.ban}`,
    sub: HAS_KEYS ? '[Z]' : undefined,
    disabled: tools.ban <= 0,
  });
  ctx.restore();
}

// The roster manager — box strip + team slots with tap-to-swap. The
// overworld TEAM · ITEMS panel is its only home now (same rects → same
// hit tests).

function drawRoster(
  ctx: CanvasRenderingContext2D,
  box: SpeciesDef[],
  boxHp: number[],
  boxLvl: number[],
  boxScroll: number,
  selBox: number,
  team: SpeciesDef[],
  teamHp: number[],
  teamLvl: number[],
  selTeam: number,
  catchPct: number,
) {
  // captured box — tap a catch and a teammate, in either order, to swap
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX: beaten foes join at ${Math.round(catchPct * 100)}%`, W / 2, 526);
  if (box.length === 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('nothing caught yet: beaten foes sometimes join', W / 2, BOX_STRIP.y + BOX_STRIP.h / 2 + 4);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOX_STRIP.x - 4, BOX_STRIP.y - 6, BOX_STRIP.w + 8, BOX_STRIP.h + 12);
  ctx.clip();
  box.forEach((def, i) => {
    const r = boxSlotRect(i, box.length, boxScroll);
    const sel = i === selBox;
    const dy = sel ? -3 : 0; // the pick lifts its card off the strip
    const card = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
    if (sel) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, r.x + 2, r.y + 6, r.w, r.h, 10);
      ctx.fill();
    }
    roundRect(ctx, card.x, card.y, card.w, card.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, card, 10, sel ? '#ffd84d' : '#2a3560', sel ? 2.5 : 1);
    edge(ctx, card, 10);
    const ko = (boxHp[i] ?? 1) <= 0;
    ctx.globalAlpha = ko ? 0.3 : 1;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, r.x + r.w / 2, card.y + 25, 36);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = font(9);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', r.x + r.w / 2 + 1, card.y + 29);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', r.x + r.w / 2, card.y + 28);
    } else if (def.shiny) {
      ctx.font = font(7);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('✦', r.x + r.w - 8, card.y + 11);
    }
    hpBar(ctx, r.x + 6, card.y + 46, r.w - 12, boxHp[i] ?? 1);
    ctx.font = fontB(7);
    ctx.fillStyle = ko ? '#5a6284' : TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, card.y + 58);
    const lvl = boxLvl[i] ?? 1;
    if (lvl > 1) {
      chip(ctx, r.x + 3, card.y + 3, `Lv${lvl}`, { bg: 'rgba(12,16,32,0.85)', fg: '#9df0ff' });
      ctx.textAlign = 'center';
    }
  });
  ctx.restore();
  const maxScroll = boxScrollMax(box.length);
  if (maxScroll > 0) {
    // scroll affordances — tucked inside the strip so they stay on the panel
    ctx.font = font(9);
    if (boxScroll > 0) {
      ctx.fillStyle = 'rgba(10,14,30,0.7)';
      ctx.beginPath();
      ctx.arc(BOX_STRIP.x + 12, BOX_STRIP.y + BOX_STRIP.h / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aab0c8';
      ctx.fillText('◀', BOX_STRIP.x + 12, BOX_STRIP.y + BOX_STRIP.h / 2 + 5);
    }
    if (boxScroll < maxScroll) {
      ctx.fillStyle = 'rgba(10,14,30,0.7)';
      ctx.beginPath();
      ctx.arc(BOX_STRIP.x + BOX_STRIP.w - 12, BOX_STRIP.y + BOX_STRIP.h / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aab0c8';
      ctx.fillText('▶', BOX_STRIP.x + BOX_STRIP.w - 12, BOX_STRIP.y + BOX_STRIP.h / 2 + 5);
    }
  }

  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 622);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    const sel = i === selTeam;
    const dy = sel ? -3 : 0; // same lift as the box strip — the armed card raises
    const card = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
    if (sel) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, r.x + 2, r.y + 6, r.w, r.h, 10);
      ctx.fill();
    }
    roundRect(ctx, card.x, card.y, card.w, card.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, card, 10, sel ? '#ffd84d' : selBox >= 0 ? GOLD : '#2a3560', sel ? 2.5 : selBox >= 0 ? 1.5 : 1);
    edge(ctx, card, 10);
    // type hairline + draft-card chips: type tag left, level tag right —
    // a shiny's level rides in gold
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(card.x + 6, card.y + 5, def.type2 ? (card.w - 12) / 2 : card.w - 12, 3);
    if (def.type2) {
      ctx.fillStyle = TYPE_COLOR[def.type2];
      ctx.fillRect(card.x + 6 + (card.w - 12) / 2, card.y + 5, (card.w - 12) / 2, 3);
    }
    chip(ctx, card.x + 6, card.y + 12, def.type.toUpperCase(), {
      bg: '#e8ecf8',
      fg: mixHex(TYPE_COLOR[def.type], '#2a2440', 0.45),
      fontPx: 6,
    });
    const lvl = teamLvl[i] ?? 1;
    const lt = def.shiny ? `✦${lvl}` : `Lv${lvl}`;
    ctx.font = fontB(7);
    const lw = ctx.measureText(lt).width + 14;
    chip(
      ctx,
      card.x + card.w - 6 - lw,
      card.y + 12,
      lt,
      def.shiny ? { bg: '#ffd84d', fg: '#2a2440' } : { bg: 'rgba(12,16,32,0.85)', fg: '#9df0ff' },
    );
    ctx.textAlign = 'center';
    const ko = (teamHp[i] ?? 1) <= 0;
    ctx.globalAlpha = ko ? 0.3 : 1;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, card.x + card.w / 2, card.y + 50, 44);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = font(10);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', card.x + card.w / 2 + 1, card.y + 54);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', card.x + card.w / 2, card.y + 53);
    }
    hpBar(ctx, card.x + 8, card.y + 74, card.w - 16, teamHp[i] ?? 1);
    ctx.font = fontB(8);
    ctx.fillStyle = ko ? '#5a6284' : PARCH;
    ctx.fillText(def.name.slice(0, 12), card.x + card.w / 2, card.y + 87);
    // the role rides as a caption under the card — the 92px face is full
    ctx.font = fontB(6);
    ctx.fillStyle = ko ? '#464e6e' : '#8890b8';
    ctx.fillText(roleTag(def), card.x + card.w / 2, card.y + card.h + 10);
  });
  // the selected mon's super reads here — swapping is a move pick too
  const selDef = selBox >= 0 ? box[selBox] : selTeam >= 0 ? team[selTeam] : null;
  if (selDef) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${moveOf(selDef.id, selDef.type)} — ${superDesc(selDef.id, selDef.type)}`, W / 2, 748); // under the role captions
  }
  const hint =
    selTeam >= 0
      ? 'tap a box mon to swap in'
      : selBox >= 0
        ? 'tap a teammate to swap in'
        : 'tap a team mon and a box mon to swap them';
  ctx.font = fontB(7);
  const hw = ctx.measureText(hint).width + 14;
  chip(ctx, W / 2 - hw / 2, 752, hint, { bg: 'rgba(42,36,64,0.8)', fg: '#a8b0d0' });
  ctx.textAlign = 'center';
}

// Overworld roster drawer — the map keeps a single TEAM · ITEMS button where
// the mon strip used to sit; the panel shows held items up top and the same
// box/team management the reward break uses.
export const MAP_MENU = { x: W / 2 - 120, y: 872, w: 240, h: 46 };
export const TEAM_PANEL = { x: 24, y: 258, w: W - 48, h: 586 };
export const MENU_CLOSE = { x: W / 2 - 90, y: 788, w: 180, h: 44 };

export function drawTeamMenu(
  ctx: CanvasRenderingContext2D,
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
  heldItems: string[],
) {
  ctx.fillStyle = 'rgba(4,6,16,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, TEAM_PANEL.x, TEAM_PANEL.y, TEAM_PANEL.w, TEAM_PANEL.h, 10);
  ctx.fillStyle = '#0d1122';
  ctx.fill();
  rim(ctx, TEAM_PANEL, 10, GOLD, 2);
  edge(ctx, TEAM_PANEL, 10);
  ctx.textAlign = 'center';
  // the same striped band the offer cards wear — gold for the run's loadout
  const band = { x: TEAM_PANEL.x + 4, y: TEAM_PANEL.y + 4, w: TEAM_PANEL.w - 8, h: 42 };
  stripeBand(ctx, band, GOLD);
  ctx.font = font(15);
  ctx.fillStyle = '#2a2440';
  ctx.fillText('TEAM & ITEMS', W / 2, band.y + band.h / 2 + 6);

  // held items — the run's build, card rows like the bag list: rarity notch,
  // icon, name and what it does
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('HELD ITEMS', W / 2, 326);
  const shown = heldItems.slice(0, 5);
  if (heldItems.length > shown.length) {
    ctx.font = fontB(7);
    ctx.fillStyle = '#5a6284';
    ctx.textAlign = 'right';
    ctx.fillText(`+${heldItems.length - shown.length} more`, TEAM_PANEL.x + TEAM_PANEL.w - 16, 326);
    ctx.textAlign = 'center';
  }
  if (!shown.length) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('none yet — relic picks and chests stock it', W / 2, 366);
  }
  shown.forEach((item, i) => {
    const r = { x: TEAM_PANEL.x + 16, y: 336 + i * 34, w: TEAM_PANEL.w - 32, h: 30 };
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    rim(ctx, r, 8, '#2a3560', 1);
    edge(ctx, r, 8);
    const perk = PERKS.find((p) => p.item === item);
    ctx.fillStyle = perk ? RARITY_COLOR[perk.rarity] : '#2a3560';
    ctx.fillRect(r.x + 4, r.y + 5, 3, r.h - 10);
    const img = itemSprite(item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, r.x + 12, r.y + 4, 22, 22);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 40, r.y, r.w - 50, r.h);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.font = fontB(9);
    const name = (perk ? perk.name : item).toUpperCase();
    const nw = ctx.measureText(name).width;
    ctx.fillStyle = '#e8ecf8';
    ctx.fillText(name, r.x + 42, r.y + 19);
    if (perk) {
      ctx.font = fontB(8);
      ctx.fillStyle = '#8890b8';
      ctx.fillText(`— ${perk.desc}`, r.x + 48 + nw, r.y + 19);
    }
    ctx.restore();
    ctx.textAlign = 'center';
  });

  drawRoster(ctx, box, boxHp, boxLvl, boxScroll, selBox, team, teamHp, teamLvl, selTeam, catchPct);
  pill(ctx, MENU_CLOSE, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'CLOSE' });
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
  offers.forEach((p, i) => drawPerkCard(ctx, perkCardRect(i), p, undefined, { idx: i }));
  // declining pays score instead — a dead offer still has a price
  pill(ctx, CHARM_SKIP, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'SKIP +200 PTS' });
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

// The run debrief, filed as a FIELD REPORT: a centred card carries the
// banded header, a numbered FINDINGS list and the FIELD NOTE; the verdict
// is rubber-stamped across its top edge and the squad rides below as the
// report's attachment. The button hit rects keep their posts — only the
// ink inside them changed hands.
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

  // badge chips wrap four to a row — counted up front, they size the card
  const badgeRows: { name: string; rarity: Rarity }[][] = [[]];
  for (const b of res.badges) {
    const row = badgeRows[badgeRows.length - 1];
    if (row.length >= 4) badgeRows.push([b]);
    else row.push(b);
  }

  // the numbered findings — one row per logged stat. DEPTH is won=9 or the
  // field main.ts filed; a wipe without it is parsed back out of `extra`.
  const depthN = res.depth ?? (res.won ? TOTAL_STAGES : Number(extra?.match(/stage (\d+) of/)?.[1] ?? 0));
  const findings: [label: string, value: string, color: string][] = [
    ['SCORE', res.score.toLocaleString('en-US'), '#f8d030'],
    ['DEPTH', `${depthN || '—'}/${TOTAL_STAGES}`, '#e8ecf8'],
    ['SHOTS', `${res.shots}`, '#e8ecf8'],
    ['TIME', `${res.time.toFixed(1)}s`, '#e8ecf8'],
    ['CAUGHT', `${res.caught}`, '#e8ecf8'],
  ];
  if (res.rating) {
    const r = res.rating;
    findings.push([
      'RATING',
      `${r.delta >= 0 ? '+' : ''}${r.delta} ${r.tier}${r.up ? ' ★ RANK UP' : ''}${res.place >= 0 ? ` · HOF #${res.place + 1}` : ''}`,
      r.color,
    ]);
  }
  if (res.newDex > 0) findings.push(['NEW DEX', `+${res.newDex}`, '#9df0ff']);

  ctx.font = fontB(9);
  const noteLines = extra ? wrap2(ctx, extra, W - 92) : []; // interior width of the report card

  // sized to content — the card tallies each block before it draws, and the
  // whole stack (report + attachment + echo) centres above the buttons
  const ROW = 24;
  const findingsY = 122; // band + CASE kicker + FINDINGS head
  const noteH = extra ? 18 + noteLines.length * 13 + 6 : 0;
  const recH = res.newBest || res.shortOfBest > 0 ? 22 : 0;
  const achH = res.newAch.length ? 20 : 0;
  const badgeH = res.badges.length ? badgeRows.length * 28 + 4 : 0;
  const panelH = findingsY + findings.length * ROW + recH + noteH + achH + badgeH + 12;
  const shareH = share ? 116 : 0;
  const echoH = !res.won ? 22 : 0;
  const panel = {
    x: 30,
    y: Math.max(46, Math.round((RETRY_BTN.y - 8 - (panelH + shareH + echoH)) / 2)),
    w: W - 60,
    h: panelH,
  };
  const ix = panel.x + 16; // interior left edge (index gutter)
  const vx = panel.x + panel.w - 16; // findings values right-align here

  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 10);
  ctx.fillStyle = '#0d1122';
  ctx.fill();
  rim(ctx, panel, 10, GOLD, 2);
  edge(ctx, panel, 10);

  // registration marks — the manual's crop ticks on every corner
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  for (const [cx, cy] of [
    [panel.x, panel.y],
    [panel.x + panel.w, panel.y],
    [panel.x, panel.y + panel.h],
    [panel.x + panel.w, panel.y + panel.h],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx, cy + 6);
    ctx.stroke();
  }
  ctx.restore();

  const band = { x: panel.x + 4, y: panel.y + 4, w: panel.w - 8, h: 44 };
  stripeBand(ctx, band, GOLD);
  ctx.textAlign = 'left';
  ctx.font = font(13);
  ctx.fillStyle = '#2a2440';
  ctx.fillText('FIELD REPORT', band.x + 14, band.y + 25);
  ctx.font = fontB(7);
  ctx.globalAlpha = 0.75;
  ctx.fillText('post-climb debrief — filed for the record', band.x + 14, band.y + 38);
  ctx.globalAlpha = 1;

  // the CASE line is the file's index card — run number when main files
  // one, otherwise the seed carries the reference
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`CASE ${res.runNo ?? res.seed}${res.runNo != null ? ` · SEED ${res.seed}` : ''}`, ix, panel.y + 66);

  // the verdict is stamped, not printed — tilted ink across the card's
  // top-right edge, the only colour the report allows itself
  ctx.save();
  ctx.translate(panel.x + panel.w - 100, panel.y + 16);
  ctx.rotate(-0.14);
  ctx.globalAlpha = 0.92;
  const stampC = res.won ? '#6fdc6f' : '#ff6b6b';
  const stamp = res.won ? 'CLIMB COMPLETE' : 'WIPED OUT';
  ctx.strokeStyle = stampC;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-88, -19, 176, 38);
  ctx.lineWidth = 1;
  ctx.strokeRect(-84, -15, 168, 30);
  fitFont(ctx, stamp, 12, 156);
  ctx.fillStyle = stampC;
  ctx.textAlign = 'center';
  ctx.fillText(stamp, 0, 5);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.font = fontB(7);
  ctx.fillStyle = '#5a6284';
  ctx.fillText('FINDINGS', ix, panel.y + 96);

  findings.forEach(([label, value, color], i) => {
    const fy = panel.y + findingsY + i * ROW;
    ctx.font = fontB(8);
    ctx.fillStyle = '#464e6e';
    ctx.fillText(String(i + 1).padStart(2, '0'), ix, fy);
    ctx.font = font(8);
    ctx.fillStyle = '#aab4dd';
    ctx.fillText(label, ix + 36, fy);
    ctx.font = fontB(10);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(value, vx, fy);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(ix, fy + 9, panel.w - 32, 1);
  });
  let yy = panel.y + findingsY + findings.length * ROW;

  // so-close framing — the near-record loss is the strongest rematch pull
  if (res.newBest) {
    ctx.textAlign = 'center';
    ctx.font = font(9);
    ctx.fillStyle = '#ffe76a';
    ctx.fillText('★ NEW RECORD ★', W / 2, yy + 14);
    yy += 22;
  } else if (res.shortOfBest > 0) {
    ctx.textAlign = 'center';
    ctx.font = fontB(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`${res.shortOfBest.toLocaleString('en-US')} PTS SHORT OF YOUR BEST`, W / 2, yy + 14);
    yy += 22;
  }

  // the free-text margin: loss detail or ascension unlock, filed verbatim
  if (extra) {
    ctx.textAlign = 'left';
    ctx.font = fontB(7);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('FIELD NOTE', ix, yy + 12);
    ctx.fillStyle = '#1a2040';
    ctx.fillRect(ix + ctx.measureText('FIELD NOTE').width + 8, yy + 9, vx - ix - ctx.measureText('FIELD NOTE').width - 8, 1);
    ctx.font = fontB(9);
    ctx.fillStyle = '#f8d030';
    noteLines.forEach((l, li) => ctx.fillText(l, ix, yy + 24 + li * 13));
    yy += 18 + noteLines.length * 13 + 6;
  }

  // fresh trophies get their own gold line under the findings block
  if (res.newAch.length) {
    ctx.textAlign = 'center';
    ctx.font = fontB(9);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`★ ${res.newAch.join(' · ')} ★`, W / 2, yy + 14);
    yy += 20;
  }

  // run badges — rarity-colored chips, up to two rows
  badgeRows.forEach((row, ri) => {
    const by = yy + 4 + ri * 28;
    ctx.font = fontB(8);
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      const br = { x: bx, y: by, w: ws[i], h: 20 };
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      rim(ctx, br, 5, RARITY_COLOR[b.rarity]);
      edge(ctx, br, 5);
      ctx.font = fontB(8);
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      ctx.fillText(b.name, bx + ws[i] / 2, by + 14);
      bx += ws[i] + 8;
    });
  });

  // the attachment — squad + wave grid ride below the report itself
  const ay = panel.y + panel.h;
  ctx.textAlign = 'center';
  if (share) {
    ctx.font = fontB(7);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('— SQUAD ATTACHMENT —', W / 2, ay + 14);
    const sy = ay + 44;
    ctx.font = '30px system-ui';
    ctx.fillText(share.waves, W / 2, sy);
    // the squad as real sprites — reads as Pokémon at a glance
    const n = res.team.length;
    res.team.forEach((def, i) => {
      const mx = W / 2 + (i - (n - 1) / 2) * 52;
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, sy + 36, 42);
      if (i === res.mvpIdx) {
        ctx.font = font(10);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('★', mx, sy + 13); // crowns the sprite, below the wave row
      }
      ctx.font = fontB(6);
      ctx.fillStyle = '#8890b8';
      ctx.fillText(roleTag(def), mx, sy + 68);
    });
  }

  // the echo tease — losing isn't a dead end, the team comes back hostile
  if (!res.won) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('this fallen team may return as a RIVAL next run', W / 2, share ? ay + 126 : ay + 34);
  }

  pill(ctx, RETRY_BTN, { c: '#ffd84d', cd: '#c8a44d', tc: '#2a2440', label: 'REMATCH' });
  pill(ctx, SHARE_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: share?.copied ? 'COPIED!' : 'SHARE RESULT' });
  pill(ctx, TITLE_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'TITLE' });

  // receipt stub — one screenshot carries the replay and the build
  ctx.save();
  ctx.font = fontB(8);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff42';
  ctx.fillText(`SEED ${res.seed} · ${__BUILD__}`, 14, 22);
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, shots: number, stageName: string, score: number, streak = 0, ultIn = 1, t = 0) {
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
  // streak + ult share a second row under the stage name — a third right
  // row would land inside the arena rim and get drawn over
  ctx.font = fontB(8);
  ctx.textAlign = 'left';
  const ready = ultIn <= 0;
  let ux = 52;
  if (streak > 1) {
    ctx.fillStyle = '#f08030';
    ctx.fillText(`PERFECT ×${streak}`, ux, 60);
    ux += ctx.measureText(`PERFECT ×${streak}`).width + 10;
  }
  // the shared charge is a real gauge, not a tally: ULT label + a pip per
  // banked shot, gold flood + pulse once it's armed
  ctx.fillStyle = ready ? '#ffd84d' : '#5a6284';
  ctx.fillText('ULT', ux, 60);
  ux += ctx.measureText('ULT').width + 6;
  const banked = ULT_SHOTS - Math.max(0, ultIn);
  const pipW = Math.min(14, Math.max(6, Math.floor(120 / ULT_SHOTS) - 2));
  const glow = ready ? 0.55 + Math.sin(t * 6) * 0.45 : 0;
  for (let i = 0; i < ULT_SHOTS; i++) {
    const on = i < banked || ready;
    ctx.fillStyle = on ? '#ffd84d' : '#232840';
    ctx.fillRect(ux + i * (pipW + 3), 52, pipW, 8);
    if (ready) {
      ctx.fillStyle = `rgba(255,216,77,${(0.25 + 0.35 * glow).toFixed(3)})`;
      ctx.fillRect(ux + i * (pipW + 3) - 1, 51, pipW + 2, 10);
    }
  }
  if (ready) {
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffd84d';
    ctx.fillText('TAP A TEAMMATE!', ux + ULT_SHOTS * (pipW + 3) + 8, 60);
    ctx.globalAlpha = 1;
  }
}

// --- settings modal: pokebonk anatomy, our palette — a left rail of ------
// --- category pills over a right panel: striped header, then slider or ---
// --- toggle rows. Geometry is the single source for draw + hit tests. ----

export type SettingsCat = 'sound' | 'graphics' | 'feel';
export type SettingsSliderKey = 'master' | 'music' | 'sfx' | 'cries' | 'shake';
export type SettingsToggleKey = 'haptics' | 'flash' | 'battery' | 'fps';
export type SettingsSegKey = 'quality' | 'pickupFx';
export type SettingsHit =
  | { kind: 'tab'; i: number }
  | { kind: 'slider'; key: SettingsSliderKey }
  | { kind: 'toggle'; key: SettingsToggleKey }
  | { kind: 'seg'; key: SettingsSegKey; i: number };

// a settings row — the draw pass and the hit test read the same list. The
// `invert` toggle lamp reads !stored (REDUCE FLASHES on = flash off); the
// flip itself is still !stored — toggling an inverted bool is the same op.
type SettingsRow =
  | { kind: 'slider'; key: SettingsSliderKey; label: string; sub?: string }
  | { kind: 'toggle'; key: SettingsToggleKey; label: string; sub?: string; invert?: boolean }
  | { kind: 'seg'; key: SettingsSegKey; label: string; sub?: string };

export const SETTINGS_PANEL = { x: 24, y: 258, w: W - 48, h: 480 };
export const SETTINGS_CLOSE = { x: W / 2 - 90, y: SETTINGS_PANEL.y + SETTINGS_PANEL.h - 58, w: 180, h: 44 };

export const SETTINGS_CATS: { id: SettingsCat; name: string; tab: string; sub: string }[] = [
  { id: 'sound', name: 'SOUND', tab: 'volume & cries', sub: 'volume, music and cries' },
  { id: 'graphics', name: 'GRAPHICS', tab: 'res & effects', sub: 'quality, battery and effects' },
  { id: 'feel', name: 'FEEL', tab: 'rumble', sub: 'haptics and feedback' },
];

// segment order is the store order — hit index and drawn pill share this
export const SETTINGS_SEG_OPTIONS: Record<SettingsSegKey, readonly string[]> = {
  quality: ['high', 'medium', 'low'],
  pickupFx: ['complete', 'simple'],
};

const SET_ROWS: Record<SettingsCat, SettingsRow[]> = {
  sound: [
    { kind: 'slider', key: 'master', label: 'MASTER VOLUME' },
    { kind: 'slider', key: 'music', label: 'MUSIC' },
    { kind: 'slider', key: 'sfx', label: 'EFFECTS' },
    { kind: 'slider', key: 'cries', label: 'POKÉMON CRIES' },
  ],
  graphics: [
    { kind: 'seg', key: 'quality', label: 'QUALITY', sub: 'low performs better' },
    { kind: 'toggle', key: 'battery', label: 'BATTERY SAVER', sub: 'caps at 30 fps and lowers the resolution' },
    { kind: 'slider', key: 'shake', label: 'SHAKE INTENSITY', sub: 'hit feedback strength' },
    { kind: 'toggle', key: 'flash', label: 'REDUCE FLASHES', sub: 'caps full-screen flash intensity', invert: true },
    { kind: 'seg', key: 'pickupFx', label: 'PICKUP EFFECTS', sub: 'fewer sparkles under pickups' },
    { kind: 'toggle', key: 'fps', label: 'SHOW FPS', sub: 'frame counter in the corner' },
  ],
  feel: [{ kind: 'toggle', key: 'haptics', label: 'HAPTICS' }],
};

const SET_RAIL = { x: SETTINGS_PANEL.x + 14, y: SETTINGS_PANEL.y + 36, w: 160 };
const SET_TAB_H = 64;
const SET_TAB_GAP = 10;
const SET_PANEL = {
  x: SET_RAIL.x + SET_RAIL.w + 12,
  y: SETTINGS_PANEL.y + 14,
  w: SETTINGS_PANEL.x + SETTINGS_PANEL.w - 14 - (SET_RAIL.x + SET_RAIL.w + 12),
  h: 390,
};
const SET_BAND = { x: SET_PANEL.x + 4, y: SET_PANEL.y + 4, w: SET_PANEL.w - 8, h: 44 };
const SET_ROW = { x: SET_PANEL.x + 4, w: SET_PANEL.w - 8 };
const SET_ROWS_Y = SET_BAND.y + SET_BAND.h + 14;
const SET_SLIDER_H = 70;
const SET_TOGGLE_H = 66;
const SET_SEG_H = 62;
const SET_TRACK = { x: SET_ROW.x + 14, w: SET_ROW.w - 28, h: 10 };
const SET_SEG_TRACK = { x: SET_TRACK.x, w: SET_TRACK.w, h: 22 };

// rows carrying a sub line pack tighter — the sub eats the label's bottom pad.
// sub-toggle pitch is 48 so its hit row clears the 44px touch floor
const setRowPitch = (r: SettingsRow) =>
  r.kind === 'seg' ? SET_SEG_H : r.sub ? (r.kind === 'slider' ? 58 : 48) : r.kind === 'slider' ? SET_SLIDER_H : SET_TOGGLE_H;

export function settingsTabRect(i: number) {
  return { x: SET_RAIL.x, y: SET_RAIL.y + i * (SET_TAB_H + SET_TAB_GAP), w: SET_RAIL.w, h: SET_TAB_H };
}

function settingsRowRect(i: number, cat: SettingsCat) {
  const rows = SET_ROWS[cat];
  let y = SET_ROWS_Y;
  for (let k = 0; k < i; k++) y += setRowPitch(rows[k]);
  return { x: SET_ROW.x, y, w: SET_ROW.w, h: setRowPitch(rows[i]) - 4 };
}

// the inset track a segmented row's pills ride in — shared by hit and draw
const segTrackRect = (r: { y: number }) => ({ x: SET_SEG_TRACK.x, y: r.y + 36, w: SET_SEG_TRACK.w, h: SET_SEG_TRACK.h });

const segIndex = (key: SettingsSegKey, tr: { x: number; w: number }, x: number) => {
  const n = SETTINGS_SEG_OPTIONS[key].length;
  return Math.min(n - 1, Math.max(0, Math.floor((x - tr.x) / (tr.w / n))));
};

// what a point inside the panel touches: a rail pill, a slider's drag slab
// (the track ±23px — a thumb hit gets >=22px of grace), or a toggle's row
export function settingsRowHit(p: { x: number; y: number }, cat: SettingsCat): SettingsHit | null {
  for (let i = 0; i < SETTINGS_CATS.length; i++) {
    if (inRect(p.x, p.y, settingsTabRect(i))) return { kind: 'tab', i };
  }
  const rows = SET_ROWS[cat];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = settingsRowRect(i, cat);
    if (row.kind === 'slider') {
      // the drag slab is the track ±17px — a thumb hit gets >=22px of grace
      if (inRect(p.x, p.y, { x: r.x, y: r.y + (row.sub ? 21 : 16), w: r.w, h: 46 }))
        return { kind: 'slider', key: row.key };
    } else if (row.kind === 'toggle') {
      if (inRect(p.x, p.y, r)) return { kind: 'toggle', key: row.key };
    } else {
      // seg hits live on the track — 44px deep, bottom-flush with the row so
      // it never bleeds into the next; a label tap still doesn't pick options
      const tr = segTrackRect(r);
      if (inRect(p.x, p.y, { x: tr.x - 6, y: tr.y - 18, w: tr.w + 12, h: 44 }))
        return { kind: 'seg', key: row.key, i: segIndex(row.key, tr, p.x) };
    }
  }
  return null;
}

// x → 0..1 across the shared track span — pointerdown sets immediately,
// pointermove while dragging keeps calling this
export function settingsSliderSet(key: SettingsSliderKey, x: number) {
  setSetting(key, Math.min(1, Math.max(0, (x - SET_TRACK.x) / SET_TRACK.w)));
}

export function settingsToggleFlip(key: SettingsToggleKey) {
  setSetting(key, !settings()[key]);
}

export function settingsSegSet(key: SettingsSegKey, i: number) {
  const opts = SETTINGS_SEG_OPTIONS[key];
  setSetting(key, opts[Math.min(opts.length - 1, Math.max(0, i))] as Settings[typeof key]);
}

export function drawSettings(ctx: CanvasRenderingContext2D, cat: SettingsCat, vals: Settings) {
  ctx.fillStyle = 'rgba(4,6,16,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, SETTINGS_PANEL.x, SETTINGS_PANEL.y, SETTINGS_PANEL.w, SETTINGS_PANEL.h, 10);
  ctx.fillStyle = '#0d1122';
  ctx.fill();
  rim(ctx, SETTINGS_PANEL, 10, GOLD, 2);
  edge(ctx, SETTINGS_PANEL, 10);

  ctx.textAlign = 'center';
  ctx.font = font(10);
  ctx.fillStyle = GOLD;
  ctx.fillText('SETTINGS', SET_RAIL.x + SET_RAIL.w / 2, SETTINGS_PANEL.y + 24);

  // category pills: icon circle + bold name + dim sub — the live category
  // fills gold-tinted, the rest stay ink
  SETTINGS_CATS.forEach((c, i) => {
    const r = settingsTabRect(i);
    const on = c.id === cat;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fillStyle = on ? '#2a2440' : '#12162b';
    ctx.fill();
    rim(ctx, r, 14, on ? GOLD : '#2a3560', on ? 2 : 1);
    edge(ctx, r, 14);
    const cx = r.x + 30;
    const cy = r.y + r.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#ffd84d' : '#1a2040';
    ctx.fill();
    const ink = on ? '#2a2440' : '#8890b8';
    if (c.id === 'sound') speakerGlyph(ctx, cx, cy, 0.85, false, ink);
    else if (c.id === 'graphics') monitorGlyph(ctx, cx, cy, 1, ink);
    else gearGlyph(ctx, cx, cy, 1, ink);
    ctx.textAlign = 'left';
    ctx.font = font(9);
    ctx.fillStyle = on ? PARCH : '#aab4dd';
    ctx.fillText(c.name, r.x + 56, r.y + 28);
    ctx.font = fontB(7);
    ctx.fillStyle = '#5a6284';
    ctx.fillText(c.tab, r.x + 56, r.y + 44);
  });

  // the content panel — striped band names the live category
  const P = SET_PANEL;
  roundRect(ctx, P.x, P.y, P.w, P.h, 10);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  rim(ctx, P, 10, '#2a3560', 1);
  edge(ctx, P, 10);
  stripeBand(ctx, SET_BAND, GOLD);
  const cdef = SETTINGS_CATS.find((c) => c.id === cat)!;
  ctx.textAlign = 'left';
  ctx.font = font(13);
  ctx.fillStyle = '#2a2440';
  ctx.fillText(cdef.name, SET_BAND.x + 14, SET_BAND.y + 25);
  ctx.font = fontB(7);
  ctx.globalAlpha = 0.75;
  ctx.fillText(cdef.sub, SET_BAND.x + 14, SET_BAND.y + 38);
  ctx.globalAlpha = 1;

  SET_ROWS[cat].forEach((row, i) => {
    const r = settingsRowRect(i, cat);
    ctx.textAlign = 'left';
    ctx.font = font(9);
    ctx.fillStyle = '#e8ecf8';
    ctx.fillText(row.label, r.x + 2, r.y + (row.sub || row.kind !== 'toggle' ? 15 : r.h / 2 + 4));
    if (row.sub) {
      ctx.font = fontB(7);
      ctx.fillStyle = '#5a6284';
      ctx.fillText(row.sub, r.x + 2, r.y + 27);
    }
    if (row.kind === 'slider') {
      const v = vals[row.key];
      ctx.font = fontB(10);
      ctx.fillStyle = '#ffd84d';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v * 100)}%`, r.x + r.w - 2, r.y + 15);
      const ty = r.y + (row.sub ? 38 : 33);
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.fillStyle = '#0a0d18';
      ctx.fill();
      // the fill wears the same light→base→dark ramp as the pills
      ctx.save();
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.clip();
      const g = ctx.createLinearGradient(0, ty, 0, ty + SET_TRACK.h);
      g.addColorStop(0, '#ffe76a');
      g.addColorStop(0.55, '#ffd84d');
      g.addColorStop(1, '#c8a44d');
      ctx.fillStyle = g;
      ctx.fillRect(SET_TRACK.x, ty, Math.max(SET_TRACK.h, SET_TRACK.w * v), SET_TRACK.h);
      ctx.restore();
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.strokeStyle = '#2a3560';
      ctx.lineWidth = 1;
      ctx.stroke();
      // ball thumb — red cap, white belly, dark seam + button
      const bx = SET_TRACK.x + SET_TRACK.w * v;
      const by = ty + SET_TRACK.h / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#f8f8f0';
      ctx.fillRect(bx - 12, by - 12, 24, 24);
      ctx.fillStyle = '#f04038';
      ctx.fillRect(bx - 12, by - 12, 24, 12);
      ctx.fillStyle = '#0a0d18';
      ctx.fillRect(bx - 12, by - 2, 24, 4);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f8f8f0';
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (row.kind === 'toggle') {
      const on = row.invert ? !vals[row.key] : vals[row.key];
      const tr = { x: r.x + r.w - 64, y: r.y + r.h / 2 - 13, w: 54, h: 26 };
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 13);
      ctx.fillStyle = on ? '#ffd84d' : '#232840';
      ctx.fill();
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 13);
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const kx = on ? tr.x + tr.w - 14 : tr.x + 14;
      ctx.beginPath();
      ctx.arc(kx, tr.y + 13, 10, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#f8f8f0' : '#5a6284';
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // segmented control — an inset track, the live option a filled pill
      const opts = SETTINGS_SEG_OPTIONS[row.key];
      const sel = Math.max(0, opts.indexOf(vals[row.key]));
      const tr = segTrackRect(r);
      const sw = tr.w / opts.length;
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, tr.h / 2);
      ctx.fillStyle = '#0a0d18';
      ctx.fill();
      const pr = { x: tr.x + 2 + sel * sw, y: tr.y + 2, w: sw - 4, h: tr.h - 4 };
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2);
      ctx.fillStyle = '#ffd84d';
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, tr.h / 2);
      ctx.strokeStyle = '#2a3560';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      opts.forEach((o, oi) => {
        ctx.font = fontB(8);
        ctx.fillStyle = oi === sel ? '#2a2440' : '#8890b8';
        ctx.fillText(o.toUpperCase(), tr.x + sw * (oi + 0.5), tr.y + tr.h / 2 + 3);
      });
    }
  });

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = '#5a6284';
  ctx.fillText('saved when you leave', P.x + P.w / 2, P.y + P.h - 12);

  pill(ctx, SETTINGS_CLOSE, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'CLOSE' });
  if (HAS_KEYS) keyHint(ctx, SETTINGS_CLOSE, '[esc]');
}

// --- tasks modal: daily/weekly missions — the settings anatomy (dim -----
// --- screen, gold-rimmed panel, striped band, close pill) but the rail ---
// --- becomes a top row of two period tabs and each mission is a 56px -----
// --- row card with a reward icon and a claim slot on the right. ----------

export const TASKS_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
export const TASKS_CLOSE = { x: W / 2 - 90, y: TASKS_PANEL.y + TASKS_PANEL.h - 58, w: 180, h: 44 };
// hit-test order — {kind:'tab', i} maps back through this list (SETTINGS_CATS trick)
export const TASKS_TABS = ['daily', 'weekly'] as const;

export type TasksHit = { kind: 'tab'; i: number } | { kind: 'claim'; i: number } | { kind: 'close' };

const TASKS_TAB_H = 44;
const TASKS_TAB_GAP = 8;
const TASKS_BAND = { x: TASKS_PANEL.x + 4, y: TASKS_PANEL.y + 14 + TASKS_TAB_H + 10, w: TASKS_PANEL.w - 8, h: 44 };
const TASKS_ROWS_Y = TASKS_BAND.y + TASKS_BAND.h + 12;
const TASKS_ROW_H = 62; // 56px card + gutter — a thumb never aims smaller
const TASKS_CLAIM_W = 96;
const TASKS_CLAIM_H = 44;

// two equal pills across the panel top — the rail, squashed into a row
export function tasksTabRect(i: number) {
  const w = (TASKS_PANEL.w - 28 - TASKS_TAB_GAP) / 2;
  return { x: TASKS_PANEL.x + 14 + i * (w + TASKS_TAB_GAP), y: TASKS_PANEL.y + 14, w, h: TASKS_TAB_H };
}

function taskRowRect(i: number) {
  return { x: TASKS_PANEL.x + 14, y: TASKS_ROWS_Y + i * TASKS_ROW_H, w: TASKS_PANEL.w - 28, h: 56 };
}

// the reward icon + claim control share the row's right edge — the claim
// slab stays ≥44px so the live hitbox is already thumb-sized
function taskClaimRect(row: { x: number; y: number; w: number; h: number }) {
  return { x: row.x + row.w - TASKS_CLAIM_W - 10, y: row.y + (row.h - TASKS_CLAIM_H) / 2, w: TASKS_CLAIM_W, h: TASKS_CLAIM_H };
}

// what a point inside the panel touches — tabs and CLOSE always answer;
// a claim slab only goes live while its task is done and unclaimed
export function taskRowHit(p: Vec, tab: 'daily' | 'weekly'): TasksHit | null {
  if (inRect(p.x, p.y, TASKS_CLOSE) || !inRect(p.x, p.y, TASKS_PANEL)) return { kind: 'close' };
  for (let i = 0; i < TASKS_TABS.length; i++) {
    if (inRect(p.x, p.y, tasksTabRect(i))) return { kind: 'tab', i };
  }
  const views = taskViews(tab);
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    if (!v.done || v.claimed) continue;
    if (inRect(p.x, p.y, taskClaimRect(taskRowRect(i)))) return { kind: 'claim', i };
  }
  return null; // dead panel space is still modal
}

export function drawTasks(ctx: CanvasRenderingContext2D, views: TaskView[], tab: 'daily' | 'weekly', t: number) {
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, TASKS_PANEL.x, TASKS_PANEL.y, TASKS_PANEL.w, TASKS_PANEL.h, 10);
  ctx.fillStyle = '#0d1122';
  ctx.fill();
  rim(ctx, TASKS_PANEL, 10, GOLD, 2);
  edge(ctx, TASKS_PANEL, 10);

  // period tabs — the live one fills dark with a gold rim, the rail's look
  TASKS_TABS.forEach((id, i) => {
    const r = tasksTabRect(i);
    const on = id === tab;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fillStyle = on ? '#2a2440' : '#12162b';
    ctx.fill();
    rim(ctx, r, 14, on ? GOLD : '#2a3560', on ? 2 : 1);
    edge(ctx, r, 14);
    ctx.font = font(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? PARCH : '#aab4dd';
    ctx.fillText(id.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + 6);
  });

  stripeBand(ctx, TASKS_BAND, GOLD);
  ctx.textAlign = 'left';
  ctx.font = font(13);
  ctx.fillStyle = '#2a2440';
  ctx.fillText('TASKS', TASKS_BAND.x + 14, TASKS_BAND.y + 25);
  ctx.font = fontB(7);
  ctx.globalAlpha = 0.75;
  ctx.fillText('rewards land in your bag', TASKS_BAND.x + 14, TASKS_BAND.y + 38);
  ctx.globalAlpha = 1;

  if (!views.length) {
    ctx.textAlign = 'center';
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('ALL CLEAR — CHECK BACK AFTER THE RESET', TASKS_PANEL.x + TASKS_PANEL.w / 2, TASKS_ROWS_Y + 60);
  }

  views.forEach((v, i) => {
    const r = taskRowRect(i);
    const ready = v.done && !v.claimed;
    // a claimable row lights like the board's leader row — the rest stay ink
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = ready ? '#1d2545' : '#0d1126';
    ctx.fill();
    ctx.strokeStyle = ready ? GOLD : '#2a3560';
    ctx.lineWidth = ready ? 2 : 1;
    ctx.stroke();

    const cr = taskClaimRect(r);
    const ix = cr.x - 12 - 28; // the reward icon rides just left of the slot
    const textW = ix - 16 - (r.x + 12); // label + bar share this width

    ctx.textAlign = 'left';
    fitFont(ctx, v.label, 9, textW - (v.done ? 56 : 0));
    ctx.fillStyle = v.claimed ? '#5a6284' : '#e8ecf8';
    ctx.fillText(v.label, r.x + 12, r.y + 17);
    ctx.font = fontB(7);
    ctx.fillStyle = v.claimed ? '#464e6e' : '#8890b8';
    ctx.fillText(v.desc.toUpperCase(), r.x + 12, r.y + 28);
    if (v.done) {
      // the counter rides the label line once the slot holds CLAIM/CLAIMED;
      // unfinished rows wear it in the slot instead (the dimmed '0/15' state)
      ctx.font = fontB(9);
      ctx.textAlign = 'right';
      ctx.fillStyle = v.claimed ? '#5a6284' : '#ffd84d';
      ctx.fillText(`${v.have}/${v.n}`, r.x + 12 + textW, r.y + 17);
      ctx.textAlign = 'left';
    }

    // the progress track is the settings slider's groove + gold ramp
    const br = { x: r.x + 12, y: r.y + 36, w: textW, h: 9 };
    roundRect(ctx, br.x, br.y, br.w, br.h, 5);
    ctx.fillStyle = '#0a0d18';
    ctx.fill();
    const frac = Math.min(1, v.have / v.n);
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.clip();
      const g = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
      g.addColorStop(0, '#ffe76a');
      g.addColorStop(0.55, '#ffd84d');
      g.addColorStop(1, '#c8a44d');
      ctx.fillStyle = g;
      ctx.fillRect(br.x, br.y, Math.max(br.h, br.w * frac), br.h);
      ctx.restore();
    }
    roundRect(ctx, br.x, br.y, br.w, br.h, 5);
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 1;
    ctx.stroke();

    // reward icon — ghosted until earned, spent grey once claimed
    const spr = BAG_ITEMS.find((it) => it.id === v.reward)?.item ?? v.reward;
    void loadItem(spr);
    const img = itemSprite(spr);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = v.claimed ? 0.3 : v.done ? 1 : 0.6;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, ix, r.y + (r.h - 28) / 2, 28, 28);
      ctx.restore();
    }

    if (ready) {
      // the armed claim pulses — the pull that this modal exists for
      ctx.save();
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 6 + (Math.sin(t * 4) * 0.5 + 0.5) * 8;
      pill(ctx, cr, { c: '#ffd84d', cd: '#c8a44d', tc: '#2a2440', label: 'CLAIM' });
      ctx.restore();
    } else if (v.claimed) {
      ctx.font = fontB(7);
      const cw = ctx.measureText('CLAIMED').width + 14;
      chip(ctx, cr.x + (cr.w - cw) / 2, cr.y + (cr.h - 16) / 2, 'CLAIMED', { bg: '#232840', fg: '#8890b8' });
    } else {
      // not done — the slot holds the dimmed target where a button would be
      ctx.font = fontB(9);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5a6284';
      ctx.fillText(`${v.have}/${v.n}`, cr.x + cr.w / 2, cr.y + cr.h / 2 + 4);
    }
  });

  // the bag preview — the screen's other half; claims land here
  const stock = bagStock();
  const stocked = BAG_ITEMS.filter((it) => (stock[it.id] ?? 0) > 0);
  const bagY = TASKS_CLOSE.y - 116;
  ctx.textAlign = 'left';
  ctx.font = font(8);
  ctx.fillStyle = '#aab4dd';
  ctx.fillText('YOUR BAG', TASKS_PANEL.x + 16, bagY);
  ctx.font = fontB(6);
  ctx.fillStyle = '#5a6284';
  ctx.fillText('TAKE 2 INTO A RUN', TASKS_PANEL.x + 16, bagY + 11);
  if (!stocked.length) {
    ctx.font = fontB(7);
    ctx.fillStyle = '#5a6284';
    ctx.fillText('EMPTY — CLAIM TASKS TO STOCK IT', TASKS_PANEL.x + 16, bagY + 42);
  }
  stocked.slice(0, 6).forEach((it, i) => {
    const cw = 74;
    const cx = TASKS_PANEL.x + 16 + (i % 3) * (cw + 8);
    const cy = bagY + 18 + Math.floor(i / 3) * 44;
    const r = { x: cx, y: cy, w: cw, h: 38 };
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#0d1126';
    ctx.fill();
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 1;
    ctx.stroke();
    const img = itemSprite(it.item);
    void loadItem(it.item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, r.x + 4, r.y + 8, 22, 22);
      ctx.restore();
    }
    ctx.font = fontB(6);
    ctx.fillStyle = '#aab4dd';
    ctx.textAlign = 'left';
    ctx.fillText(it.name.split(' ')[0], r.x + 30, r.y + 16);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`×${stock[it.id]}`, r.x + 30, r.y + 27);
  });

  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`NEW TASKS ${taskResetsIn(tab)}`, TASKS_PANEL.x + TASKS_PANEL.w / 2, TASKS_CLOSE.y - 10);

  pill(ctx, TASKS_CLOSE, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'CLOSE' });
  if (HAS_KEYS) keyHint(ctx, TASKS_CLOSE, '[esc]');
}
