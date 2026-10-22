import { itemSprite, loadItem, loadSprite, drawMon, drawShiny, drawNpc, gracidea } from '../core/assets';
import { isMuted } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES, INVADER_IDS, PULLABLE, PULL_COST, PULL10_COST, PULL_PITY, PULL_SHINY, shinyOdds, tierOf, speciesById, LEADER_NPC, ASC_MODS } from './data';
import { dailyMod as todaysMod } from './daily';
import { PERKS, RARITY_COLOR, BAG_ITEMS } from './perks';
import type { Perk, Rarity, BagItem } from './perks';
import { drawBackdrop } from './bg';
import { TYPE_COLOR, type PokeType } from './types';
import { roleOf, moveOf, superDesc } from './stats';
import { ULT_SHOTS } from './battle';
import { dexIds, shinyIds, best, shinyCharm, SHINY_CHARM_AT, ACHIEVEMENTS, unlockedAch, BADGES, gymBadges, badgeOf, tier, rating, rankName, board, settings, setSetting, bagStock, streakDaily, streakWins, ascPick, echoIds, labLevel, LAB_UPGRADES, stars, starBoost, boostLeft, raidDoneToday, pullCount, loginToday, streakRisky, nextDexReward, nextRookie, ROOKIE_STEPS, type Settings } from './meta';
import { taskViews, tasksReady, taskResetsIn, raidPick, featuredPull, dealPick, dealCost } from './tasks';
import type { TaskView } from './tasks';
import type { Vec } from '../core/vec';

export const W = 540;
export const H = 960;

// mobile-first: key affordances only render when a keyboard is likely —
// a coarse-primary pointer (phone/tablet) never sees [1] or [R]. The keys
// stay wired regardless; this decides chrome, not input.
const HAS_KEYS = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

// species that can ever drop a ball — the dex completion denominator, and the
// hatcher's pull pool; the dedup'd set lives in data.ts as PULLABLE now
export const CATCHABLE = PULLABLE.length;

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
  stars?: number; // star pieces banked this run — drawn as a findings row when set
  starsBonus?: number; // the once-a-day first-clear drop — its own findings row
  grind?: { n: number; pay: number }; // nth finished run today — the session pays out
  dexPay?: number; // dex-milestone stars this run banked — its own findings row
  rookie?: { label: string; pay: number }[]; // rookie steps this run cleared — one row each
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
export const FREE_BTN = { x: W / 2 - 205, y: 704, w: 148, h: 68 };
export const DAILY_BTN = { x: FREE_BTN.x + FREE_BTN.w + 8, y: 704, w: 150, h: 68 };
// the daily chroma raid squeezes beside DAILY — the hero row's third pill
// ends at W-27, flush with the menu chips' right edge below
export const RAID_BTN = { x: DAILY_BTN.x + DAILY_BTN.w + 8, y: 704, w: W - 27 - (DAILY_BTN.x + DAILY_BTN.w + 8), h: 68 };
// only visible while a saved run waits — slips between the big buttons and the DEX row
export const NEW_BTN = { x: W / 2 - 130, y: FREE_BTN.y + FREE_BTN.h + 1, w: 260, h: 24 };
// the drawn link stays a 24px sliver guarding CONTINUE, but the live target
// is a 36px slab centered on it — main.ts hit-tests NEW_HIT, not NEW_BTN
export const NEW_HIT = { x: NEW_BTN.x, y: NEW_BTN.y + NEW_BTN.h / 2 - 18, w: NEW_BTN.w, h: 36 };
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
// settings cog, mid-run size — the next 42px slot left of MUTE_CHIP's grid
export const MAP_GEAR = { x: W - 142, y: 54, w: 40, h: 40 };
export function drawGearChip(ctx: CanvasRenderingContext2D) {
  const cx = MAP_GEAR.x + MAP_GEAR.w / 2;
  const cy = MAP_GEAR.y + MAP_GEAR.h / 2;
  ctx.fillStyle = '#12152bcc';
  ctx.fillRect(MAP_GEAR.x, MAP_GEAR.y, MAP_GEAR.w, MAP_GEAR.h);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MAP_GEAR.x, MAP_GEAR.y, MAP_GEAR.w, MAP_GEAR.h);
  gearGlyph(ctx, cx, cy, 1.3, PARCH);
}
export const MUTE_BTN = { x: 20, y: 22, w: 44, h: 44 };
// gear badge, left of the ? — the settings modal
export const GEAR_BTN = { x: HELP_BTN.x - 54, y: 22, w: 44, h: 44 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// item reward cards reuse the draft card spacing. A 4th offer (the lab's
// FOURTH OPTION upgrade) can't squeeze another column into 540px — it goes
// 2×2 around the tool row: row 1 keeps the 3-card band, the TOOL_* pills
// stay parked, row 2 lands under them.
export function perkCardRect(i: number, n = 3) {
  if (n >= 4) {
    const gx = (W - (2 * CARD_W + CARD_GAP)) / 2;
    return { x: gx + (i % 2) * (CARD_W + CARD_GAP), y: 376 + Math.floor(i / 2) * 266, w: CARD_W, h: 200 };
  }
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
  // four branches (eevee's full spread) step down a size so the row still fits
  const w = n >= 4 ? 120 : 140, gap = n >= 4 ? 10 : 14;
  return { x: W / 2 - (n * w + (n - 1) * gap) / 2 + i * (w + gap), y: 400, w, h: 184 };
}
// the quiet out — staying unevolved is a legal pick; centered under the card
// row (cards end at 584, this leaves a 16px breath)
export const EVO_KEEP = { x: W / 2 - 90, y: 600, w: 180, h: 34 };

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

// Lv pips — `max` dashes spread across the rect, the first `lvl` lit gold.
// The lab card's level row; same pip language as the battle HUD's hp pips.
export function levelPips(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, lvl: number, max: number) {
  const gap = 5;
  const w = Math.max(4, (r.w - (max - 1) * gap) / max);
  const h = Math.min(5, r.h);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < lvl ? '#ffd84d' : '#2a3560';
    ctx.fillRect(r.x + i * (w + gap), r.y + (r.h - h) / 2, w, h);
  }
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

// --- ambient title: drifting wilds, today's offers --------------------------
// The pitch between the wordmark and the buttons is scenery, not a demo —
// wilds wander it on a spring and a TODAY card sells the day's rotating
// offers. The sling lives in battle.
const PITCH = { x: 26, y: 268, w: W - 52, h: 396 };

interface WildMon {
  id: number; x: number; y: number; vx: number; vy: number;
  ax: number; ay: number; wT: number; s: number;
}
// a scatter of wilds roams the pitch — hops to a nearby spot, the odd dart
const WILDS: WildMon[] = [
  { id: 25, x: 130, y: 330, vx: 0, vy: 0, ax: 130, ay: 330, wT: 0.4, s: 40 },
  { id: 133, x: 420, y: 300, vx: 0, vy: 0, ax: 420, ay: 300, wT: 0.9, s: 42 },
  { id: 1, x: 100, y: 560, vx: 0, vy: 0, ax: 100, ay: 560, wT: 0.2, s: 44 },
  { id: 4, x: 440, y: 590, vx: 0, vy: 0, ax: 440, ay: 590, wT: 0.7, s: 44 },
  { id: 7, x: 270, y: 630, vx: 0, vy: 0, ax: 270, ay: 630, wT: 1.1, s: 46 },
  { id: 60, x: 330, y: 380, vx: 0, vy: 0, ax: 330, ay: 380, wT: 0.6, s: 38 },
];

export function updateTitle(dt: number) {
  for (const f of WILDS) {
    f.wT -= dt;
    if (f.wT <= 0) {
      f.wT = 0.5 + Math.random() * 0.9;
      const m = f.s * 0.5 + 10;
      const dart = Math.random() < 0.22;
      const tx = dart ? PITCH.x + m + Math.random() * (PITCH.w - 2 * m) : f.x + (Math.random() - 0.5) * 160;
      const ty = dart ? PITCH.y + m + Math.random() * (PITCH.h - 2 * m) : f.y + (Math.random() - 0.5) * 160;
      f.ax = Math.min(Math.max(tx, PITCH.x + m), PITCH.x + PITCH.w - m);
      f.ay = Math.min(Math.max(ty, PITCH.y + m), PITCH.y + PITCH.h - m);
    }
    f.vx += (f.ax - f.x) * 26 * dt;
    f.vy += (f.ay - f.y) * 26 * dt;
    const damp = Math.exp(-7 * dt);
    f.vx *= damp;
    f.vy *= damp;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  // no piling up — wilds shoulder off each other
  for (let i = 0; i < WILDS.length; i++)
    for (let j = i + 1; j < WILDS.length; j++) {
      const a = WILDS[i], c = WILDS[j];
      const dx = a.x - c.x, dy = a.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = a.s * 0.5 + c.s * 0.5;
      if (d >= min) continue;
      const push = (min - d) / 2;
      a.x += (dx / d) * push; a.y += (dy / d) * push;
      c.x -= (dx / d) * push; c.y -= (dy / d) * push;
    }
  // the TODAY card is glass over grass — wilds shoulder out of its lane so
  // no silhouette reads as a fourth offer
  const card = { x: PITCH.x + 30, y: PITCH.y + 120, w: PITCH.w - 60, h: 152 };
  for (const f of WILDS) {
    const m = f.s * 0.5;
    if (f.x <= card.x - m || f.x >= card.x + card.w + m || f.y <= card.y - m || f.y >= card.y + card.h + m) continue;
    const dl = f.x - (card.x - m), dr = card.x + card.w + m - f.x;
    const dtp = f.y - (card.y - m), db = card.y + card.h + m - f.y;
    const min = Math.min(dl, dr, dtp, db);
    if (min === dl) f.x = card.x - m;
    else if (min === dr) f.x = card.x + card.w + m;
    else if (min === dtp) f.y = card.y - m;
    else f.y = card.y + card.h + m;
    f.ax = f.x; f.ay = f.y;
  }
}

function drawWilds(ctx: CanvasRenderingContext2D, t: number) {
  for (const [i, f] of WILDS.entries()) {
    monShadow(ctx, f.x, f.y + f.s * 0.05, f.s);
    const wob = Math.hypot(f.vx, f.vy) < 30 ? Math.sin(t * 2.2 + i * 1.7) * 2.5 : 0;
    drawMon(ctx, f.id, f.x, f.y + wob, f.s);
  }
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

// the login drop reads as a pop, not a ledger line — a gold banner that
// floats over the pitch for the first seconds of the session's first title
let loginT0 = -1;

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

  drawWilds(ctx, t);

  // TODAY card — the day's three rotating offers in one glance: the rate-up
  // pull, the chroma raid boss, the spark deal. The home menu's one summary.
  {
    const offers: { def: SpeciesDef; tag: string; c: string }[] = [
      { def: featuredPull(), tag: 'RATE UP', c: '#ffd84d' },
      { def: raidPick(), tag: raidDoneToday() ? '✓ CLEARED' : 'SHINY BOSS', c: '#9a6cff' },
      { def: dealPick(), tag: 'DEAL −25%', c: '#9df0ff' },
    ];
    const card = { x: PITCH.x + 30, y: PITCH.y + 120, w: PITCH.w - 60, h: 152 };
    ctx.fillStyle = 'rgba(10,14,32,0.74)';
    roundRect(ctx, card.x, card.y, card.w, card.h, 10);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = font(10);
    ctx.fillStyle = '#ffd84d';
    ctx.textAlign = 'center';
    ctx.fillText('TODAY', card.x + card.w / 2, card.y + 28);
    offers.forEach((o, i) => {
      const cx = card.x + (card.w * (i + 0.5)) / 3;
      monShadow(ctx, cx, card.y + 84, 54);
      drawMon(ctx, o.def.id, cx, card.y + 84 + Math.sin(t * 2.2 + i * 1.7) * 2.5, 54);
      ctx.font = fontB(7);
      ctx.fillStyle = o.c;
      ctx.fillText(o.tag, cx, card.y + 118);
      ctx.font = fontB(8);
      ctx.fillStyle = PARCH;
      ctx.fillText(o.def.name.toUpperCase(), cx, card.y + 132);
    });
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
    // fresh trainers see the ladder's next step on the front door itself
    sub: cont ? `STAGE ${Math.max(1, cont.stage)}` : nextRookie() ? `ROOKIE ${nextRookie()!.n + 1}/${ROOKIE_STEPS.length} · ${nextRookie()!.label}` : undefined,
  });
  pill(ctx, DAILY_BTN, dailyArmed
    ? { c: '#e03c34', cd: '#a02a24', tc: '#ffe8e8', label: 'DROP SAVED RUN?' }
    : { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'DAILY' });
  // the day's one seeded epic wears the rate-up band's purple — cleared,
  // the pill sleeps gray till tomorrow's roll
  const raidDone = raidDoneToday();
  pill(ctx, RAID_BTN, {
    c: '#9a6cff',
    cd: '#6b4ac0',
    tc: '#2a2440',
    label: 'CHROMA RAID',
    // cleared → the chip sells tomorrow's boss instead of going dead
    sub: raidDone
      ? `TMRW: ${raidPick(Date.now() + 86400000).name.toUpperCase()}`
      : `${raidPick().name.toUpperCase()} · DAILY SHINY`,
    disabled: raidDone,
  });
  // a live daily streak pins a pip on the corner — the tasksReady red pip's
  // family, gold while banked and warn-red when the chain dies at midnight
  const dStreak = streakDaily();
  const risky = streakRisky();
  if (dStreak > 0) {
    const bx = DAILY_BTN.x + DAILY_BTN.w - 4, by = DAILY_BTN.y + 4;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = risky ? '#e03c34' : '#ffd84d';
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
    if (risky) {
      ctx.fillStyle = '#e03c34';
      ctx.fillText(`STREAK ${risky} DIES TONIGHT`, DAILY_BTN.x + DAILY_BTN.w - 2, DAILY_BTN.y + DAILY_BTN.h + 31);
    }
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
  // the goal-gradient tell — the dex chip always names the nearest open
  // loop: catches to the charm, badges to the crown, then pulls to pity
  const dexN = dexIds().length;
  const dexRw = nextDexReward();
  const nextGoal = !shinyCharm()
    ? `${SHINY_CHARM_AT - dexN} TO CHARM`
    : dexRw
      ? `${dexRw.at - dexN} TO +${dexRw.pay}★`
      : gymBadges().size < BADGES.length
        ? `${BADGES.length - gymBadges().size} BADGES LEFT`
        : `PITY IN ${PULL_PITY - (pullCount() % PULL_PITY)}`;
  pill(ctx, DEX_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: `DEX ${dexN}/${CATCHABLE}`, sub: nextGoal });
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
  // row two — the meta loop's front doors. The hatcher wears the climb's
  // gold, the lab stays parchment; the ascension dial rides the tail
  pill(ctx, HATCH_BTN, { c: '#ffd84d', cd: '#c8a44d', tc: '#2a2440', label: 'HATCHER', sub: `★ ${stars()}` });
  pill(ctx, LAB_BTN, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'LAB' });
  // the records line is the one-more-run hook — ranked ladder, best score
  const b = best();
  const ld = tier();
  const bits = [`RANK ${rankName()}`, `BEST ${b.score.toLocaleString('en-US')}`];
  if (b.stage) bits.push(`PEAK ${b.stage}`);
  if (b.wins) bits.push(`ASCENSION ${Math.min(b.wins, 9)}`);
  const wStreak = streakWins();
  if (wStreak > 1) bits.push(`STREAK ${wStreak}`);
  // a live star-boost tails the records line in muted gold — the quiet
  // countdown while a finished raid or daily is still paying out
  const boostMs = boostLeft();
  const boostTxt = boostMs > 0
    ? `★ BOOST ×${starBoost()} ${Math.floor(boostMs / 3600000)}h${String(Math.floor((boostMs % 3600000) / 60000)).padStart(2, '0')}m`
    : '';
  const recLine = bits.join(' · ');
  const recFull = boostTxt ? `${recLine} · ${boostTxt}` : recLine;
  fitFont(ctx, recFull, 8, W - 40);
  const recY = HATCH_BTN.y + HATCH_BTN.h + 22;
  const recX = W / 2 - ctx.measureText(recFull).width / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aab4dd';
  ctx.fillText(boostTxt ? `${recLine} · ` : recLine, recX, recY);
  if (boostTxt) {
    ctx.fillStyle = GOLD;
    ctx.fillText(boostTxt, recX + ctx.measureText(`${recLine} · `).width, recY);
  }
  ctx.textAlign = 'center';
  // the ladder: a fill bar toward the next tier, tinted to the current one
  const rw = 220, rx = W / 2 - rw / 2, ry = HATCH_BTN.y + HATCH_BTN.h + 33;
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
    ry + 13,
  );
  // the heat dial rides chip row two's tail: gold while a pick is on,
  // parchment at zero, grayed until a first clear lifts the cap — a tap
  // cycles 0..cap. The picked tier's name rides inside as the pill's sub
  const ascCap = Math.min(b.wins, 9);
  const pick = ascPick();
  const ascModName = pick > 0 ? ASC_MODS[pick - 1]?.name : undefined;
  pill(ctx, ASC_BTN, {
    c: pick > 0 ? '#ffd84d' : '#e8ecf8',
    cd: pick > 0 ? '#c8a44d' : '#aab0c8',
    tc: '#2a2440',
    label: `ASC ${pick}`,
    sub: ascModName?.toUpperCase(),
    disabled: ascCap === 0,
  });

  // the day's login drop — a gold banner over the pitch top for the first
  // seconds on title, so the calendar reads as a reward, not a ledger line
  const lt = loginToday();
  if (lt) {
    if (loginT0 < 0) loginT0 = t;
    const age = t - loginT0;
    if (age < 6) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (6 - age) / 1.5);
      const msg = `DAY ${lt.n} LOGIN · +${lt.prize}★`;
      const back = lt.back > 0 ? `WELCOME BACK · +${lt.back}★` : '';
      ctx.font = font(11);
      let bw = ctx.measureText(msg).width;
      if (back) {
        ctx.font = fontB(9);
        bw = Math.max(bw, ctx.measureText(back).width);
        ctx.font = font(11);
      }
      bw += 40;
      const bh = back ? 56 : 38;
      const br = { x: W / 2 - bw / 2, y: 325 - bh / 2, w: bw, h: bh };
      ctx.fillStyle = '#161228';
      ctx.fillRect(br.x, br.y, br.w, br.h);
      dither(ctx, br, 0.08);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(msg, W / 2, br.y + (back ? 24 : 25));
      if (back) {
        ctx.font = fontB(9);
        ctx.fillStyle = '#aab4dd';
        ctx.fillText(back, W / 2, br.y + 42);
      }
      ctx.restore();
    }
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
// chip row two — the meta loop's doors, 8px under the menu row. The records
// line + ladder key off this row so the whole readout follows it down.
export const HATCH_BTN = { x: DEX_BTN.x, y: DEX_BTN.y + DEX_BTN.h + 8, w: MENU_CHIP_W, h: 48 };
export const LAB_BTN = { x: HATCH_BTN.x + HATCH_BTN.w + 8, y: HATCH_BTN.y, w: MENU_CHIP_W, h: 48 };
// the ascension dial rides row two's back half (spans the last two chip
// slots) — there's no band left below the ladder for it anymore
export const ASC_BTN = { x: LAB_BTN.x + LAB_BTN.w + 8, y: HATCH_BTN.y, w: W - 27 - (LAB_BTN.x + LAB_BTN.w + 8), h: 48 };
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
  PULLABLE.filter((def) => seen.has(def.id)).forEach((def, i) => {
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

  // locked trophies get a live fraction — the goal-gradient on every open loop
  const progress: Record<string, [number, number] | undefined> = {
    collector: [dexIds().length, 50],
    living: [dexIds().length, CATCHABLE],
    triple: [best().wins, 3],
    league: [gymBadges().size, BADGES.length],
    'hot-streak': [streakWins(), 3],
    'daily-devotion': [streakDaily(), 7],
  };
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
    const prog = !has && progress[a.id];
    if (prog) {
      ctx.textAlign = 'right';
      ctx.font = fontB(9);
      ctx.fillStyle = prog[0] >= prog[1] * 0.7 ? '#ffd84d' : '#8890b8'; // close loops read gold
      ctx.fillText(`${Math.min(prog[0], prog[1])}/${prog[1]}`, r.x + r.w - 26, y + 36);
      ctx.textAlign = 'left';
    }
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

// --- the hatcher + the lab: the star-piece economy's two fronts -------------
// Both ride the DEX_PANEL overlay pattern (dim + framed panel + clipped
// scroll view). main.ts owns the pull state machine — HatchState is what it
// hands the draw each frame: phase clock, result queue, spark scroll.

export interface PullResult {
  id: number;
  rarity: 1 | 2 | 3; // bucket: common / rare / epic — sets the star count + rim
  dupe: boolean; // already dex'd — it converted to dust instead
  shiny: boolean;
  dust: number; // dust paid out by this result (dupes only)
}
export type HatchPhase = 'idle' | 'shake' | 'reveal' | 'results';
export interface HatchState {
  phase: HatchPhase;
  t: number; // seconds inside the current phase — drives wobble/pop
  results: PullResult[]; // the pull queue — reveal + results read it
  i: number; // which result the reveal is on (10-pull tap-through)
  sparkScroll: number; // SPARK grid scroll — only live while phase is 'idle'
  label?: string; // the summary's header — 'RAID CLEARED' rides the same cards
  dexPay?: number; // dex-milestone stars this pull banked — the summary names the payout
  rookiePay?: number; // rookie-ladder stars this pull banked — same line
}

const HATCH_PANEL = DEX_PANEL;
const FEAT_BAND = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 66, w: HATCH_PANEL.w - 32, h: 88 };
export const PULL1_BTN = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 164, w: 218, h: 50 };
export const PULL10_BTN = { x: HATCH_PANEL.x + 246, y: HATCH_PANEL.y + 164, w: 218, h: 50 };
const PITY_BAR = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 234, w: HATCH_PANEL.w - 32, h: 10 };
const SPARK_VIEW = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 290, w: HATCH_PANEL.w - 32, h: 500 };
const SPARK_COLS = 4;
const SPARK_CELL_W = SPARK_VIEW.w / SPARK_COLS;
const SPARK_CELL_H = 112;
const HATCH_MODAL = { x: 80, y: 244, w: W - 160, h: 400 };
export const SKIP_PULL_BTN = { x: HATCH_MODAL.x + HATCH_MODAL.w - 92, y: HATCH_MODAL.y + 12, w: 80, h: 30 };

// the wallet pill — star pieces buy pulls, dust buys sparks outright
function balanceChip(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  starN: number,
  dust?: number,
) {
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fillStyle = '#1a2040';
  ctx.fill();
  rim(ctx, r, r.h / 2, GOLD, 1.5);
  void loadItem('star-piece');
  const star = itemSprite('star-piece');
  if (star) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(star, r.x + 10, r.y + r.h / 2 - 9, 18, 18);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.font = fontB(9);
  let tx = r.x + 34;
  ctx.fillStyle = '#ffd84d';
  ctx.fillText(`${starN}`, tx, r.y + r.h / 2 + 3.5);
  tx += ctx.measureText(`${starN}`).width + 8;
  if (dust != null) {
    // the second wallet reads cyan — a small diamond, not the star icon
    const mid = r.y + r.h / 2 - 1;
    ctx.fillStyle = '#9df0ff';
    ctx.beginPath();
    ctx.moveTo(tx + 4, mid - 5);
    ctx.lineTo(tx + 8, mid);
    ctx.lineTo(tx + 4, mid + 5);
    ctx.lineTo(tx, mid);
    ctx.closePath();
    ctx.fill();
    ctx.fillText(`${dust}`, tx + 12, r.y + r.h / 2 + 3.5);
  }
}

// a dust price — small cyan diamond + count, laid out as one centered unit
function dustTag(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, textColor: string) {
  ctx.font = fontB(7);
  const label = `${n}`;
  const tw = ctx.measureText(label).width;
  const x0 = cx - (tw + 10) / 2;
  ctx.fillStyle = '#9df0ff';
  ctx.beginPath();
  ctx.moveTo(x0 + 3.5, cy - 7);
  ctx.lineTo(x0 + 7, cy - 3);
  ctx.lineTo(x0 + 3.5, cy + 1);
  ctx.lineTo(x0, cy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(label, x0 + 10, cy);
}

export function hatchScrollMax(s: HatchState) {
  if (s.phase !== 'idle') return 0; // the pull show eats drags — the shop's scroll waits
  const rows = Math.ceil(PULLABLE.length / SPARK_COLS);
  return Math.max(0, rows * SPARK_CELL_H - SPARK_VIEW.h);
}

// pointer → pullable species in the spark grid (same math as the draw)
export function sparkHit(scroll: number, x: number, y: number): SpeciesDef | null {
  if (!inRect(x, y, SPARK_VIEW)) return null;
  const col = Math.floor((x - SPARK_VIEW.x) / SPARK_CELL_W);
  const row = Math.floor((y - SPARK_VIEW.y + scroll) / SPARK_CELL_H);
  return PULLABLE[row * SPARK_COLS + col] ?? null;
}

export function drawHatch(
  ctx: CanvasRenderingContext2D,
  s: HatchState,
  info: { stars: number; dust: number; pityIn: number; featured: SpeciesDef | null; free: boolean; flash?: string },
) {
  const r = HATCH_PANEL;
  void loadItem('star-piece');
  void loadItem('poke-ball');
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 14);

  // header left, wallet right — the shop reads like a counter
  ctx.textAlign = 'left';
  ctx.font = font(15);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText('THE HATCHER', r.x + 22, r.y + 42);
  balanceChip(ctx, { x: r.x + r.w - 178, y: r.y + 22, w: 160, h: 32 }, info.stars, info.dust);

  // the day's featured rate-up — a full-bleed striped banner, sprite + odds
  const f = info.featured;
  ctx.save();
  roundRect(ctx, FEAT_BAND.x, FEAT_BAND.y, FEAT_BAND.w, FEAT_BAND.h, 10);
  ctx.clip();
  const fg = ctx.createLinearGradient(0, FEAT_BAND.y, 0, FEAT_BAND.y + FEAT_BAND.h);
  fg.addColorStop(0, '#8a5cff');
  fg.addColorStop(1, mixHex('#8a5cff', '#12162b', 0.55));
  ctx.fillStyle = fg;
  ctx.fillRect(FEAT_BAND.x, FEAT_BAND.y, FEAT_BAND.w, FEAT_BAND.h);
  stripes(ctx, FEAT_BAND);
  ctx.restore();
  ctx.strokeStyle = '#0a0d18';
  ctx.lineWidth = 1.5;
  roundRect(ctx, FEAT_BAND.x + 0.5, FEAT_BAND.y + 0.5, FEAT_BAND.w - 1, FEAT_BAND.h - 1, 10);
  ctx.stroke();
  if (f) {
    void loadSprite(f.id);
    try {
      drawMon(ctx, f.id, FEAT_BAND.x + 54, FEAT_BAND.y + FEAT_BAND.h / 2 + 6, 74);
    } catch {
      /* sprite still warming */
    }
    chip(ctx, FEAT_BAND.x + 10, FEAT_BAND.y + 10, 'FEATURED', { bg: '#2a2440', fg: '#e8ecf8' });
    ctx.textAlign = 'left';
    fitFont(ctx, f.name.toUpperCase(), 12, FEAT_BAND.w - 220);
    ctx.fillStyle = '#2a2440';
    ctx.fillText(f.name.toUpperCase(), FEAT_BAND.x + 104, FEAT_BAND.y + 44);
    ctx.font = fontB(7);
    ctx.globalAlpha = 0.75;
    ctx.fillText('RATE UP — RARE+ POOL', FEAT_BAND.x + 104, FEAT_BAND.y + 60);
    ctx.globalAlpha = 1;
    chip(ctx, FEAT_BAND.x + FEAT_BAND.w - 96, FEAT_BAND.y + FEAT_BAND.h / 2 - 8, '10× TODAY', {
      bg: '#ffd84d',
      fg: '#2a2440',
    });
  } else {
    ctx.textAlign = 'center';
    ctx.font = font(10);
    ctx.fillStyle = '#2a2440';
    ctx.fillText('NO FEATURED PULL TODAY', FEAT_BAND.x + FEAT_BAND.w / 2, FEAT_BAND.y + FEAT_BAND.h / 2 + 4);
  }

  // the pulls — ×1 is parchment, ×10 the gold MS ten-pull; dim when short.
  // A daily free pull turns the first pill gold — the come-back-tomorrow hook
  pill(ctx, PULL1_BTN, {
    c: info.free ? '#ffd84d' : '#e8ecf8',
    cd: info.free ? '#c8a44d' : '#aab0c8',
    tc: '#2a2440',
    label: info.free ? 'FREE PULL' : 'PULL ×1',
    sub: info.free ? 'ONE A DAY' : `${PULL_COST} STAR PIECES`,
    disabled: !info.free && info.stars < PULL_COST,
  });
  pill(ctx, PULL10_BTN, {
    c: '#ffd84d',
    cd: '#c8a44d',
    tc: '#2a2440',
    label: 'PULL ×10',
    sub: `${PULL10_COST} · RARE GUARANTEED`,
    disabled: info.stars < PULL10_COST,
  });
  const starIcon = itemSprite('star-piece');
  if (starIcon) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = info.stars < PULL_COST ? 0.4 : 1;
    ctx.drawImage(starIcon, PULL1_BTN.x + 12, PULL1_BTN.y + PULL1_BTN.h / 2 - 11, 22, 22);
    ctx.globalAlpha = info.stars < PULL10_COST ? 0.4 : 1;
    ctx.drawImage(starIcon, PULL10_BTN.x + 12, PULL10_BTN.y + PULL10_BTN.h / 2 - 11, 22, 22);
    ctx.restore();
  }

  // pity — every Nth pull rolls rare+; the meter is the near-miss hook
  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = info.pityIn <= 1 ? '#ffd84d' : '#8890b8';
  // pityIn counts down to 1 — the pull that lands ON 1 is the guaranteed one
  ctx.fillText(info.pityIn <= 1 ? 'NEXT PULL IS GUARANTEED RARE' : `GUARANTEED RARE IN ${info.pityIn}`, W / 2, PITY_BAR.y - 6);
  ctx.fillStyle = '#0a0d18';
  ctx.fillRect(PITY_BAR.x, PITY_BAR.y, PITY_BAR.w, PITY_BAR.h);
  const pf = Math.min(1, Math.max(0, 1 - info.pityIn / PULL_PITY));
  if (pf > 0) {
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(PITY_BAR.x, PITY_BAR.y, Math.max(4, PITY_BAR.w * pf), PITY_BAR.h);
  }
  ctx.strokeStyle = '#2a3560';
  ctx.lineWidth = 1;
  ctx.strokeRect(PITY_BAR.x + 0.5, PITY_BAR.y + 0.5, PITY_BAR.w - 1, PITY_BAR.h - 1);

  // the odds, in print. Bucket cuts track pullSpecies' 0.72/0.97 rolls by
  // hand; the shiny number reads live so the weekend window advertises itself
  if (s.phase === 'idle') {
    const wknd = shinyOdds() > PULL_SHINY;
    ctx.font = fontB(7);
    ctx.fillStyle = info.flash || wknd ? '#ffd84d' : '#5a6284';
    ctx.fillText(
      info.flash ??
        `72% COMMON · 25% RARE · 3% EPIC — ${shinyOdds() * 100}% SHINY${wknd ? ' · WEEKEND ×2' : ''} PER PULL`,
      W / 2,
      PITY_BAR.y + PITY_BAR.h + 9,
    );
  }

  // SPARK — the dust shop: buy the species outright, owned ones dim out
  ctx.font = font(9);
  ctx.fillStyle = '#aab4dd';
  ctx.fillText('SPARK EXCHANGE', W / 2, SPARK_VIEW.y - 24);
  ctx.font = fontB(7);
  ctx.fillStyle = '#5a6284';
  ctx.fillText('buy a mon outright with dust — sparked or pulled, it joins the dex', W / 2, SPARK_VIEW.y - 11);

  const seen = new Set(dexIds());
  ctx.save();
  ctx.beginPath();
  ctx.rect(SPARK_VIEW.x - 4, SPARK_VIEW.y, SPARK_VIEW.w + 8, SPARK_VIEW.h);
  ctx.clip();
  const row0 = Math.max(0, Math.floor(s.sparkScroll / SPARK_CELL_H));
  const rowN = Math.ceil((s.sparkScroll + SPARK_VIEW.h) / SPARK_CELL_H);
  for (let i = row0 * SPARK_COLS; i < rowN * SPARK_COLS && i < PULLABLE.length; i++) {
    const def = PULLABLE[i];
    const cx = SPARK_VIEW.x + (i % SPARK_COLS) * SPARK_CELL_W;
    const cy = SPARK_VIEW.y + Math.floor(i / SPARK_COLS) * SPARK_CELL_H - s.sparkScroll;
    const owned = seen.has(def.id);
    const spTier = tierOf(def);
    const epic = spTier >= 3 || INVADER_IDS.has(def.id);
    const cell = { x: cx + 4, y: cy + 4, w: SPARK_CELL_W - 8, h: SPARK_CELL_H - 8 };
    ctx.save();
    ctx.globalAlpha = owned ? 0.35 : 1;
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 8);
    ctx.fillStyle = '#0d1126';
    ctx.fill();
    ctx.strokeStyle = epic ? '#f0b02f' : spTier === 2 ? '#5a9bf0' : '#2a3560';
    ctx.lineWidth = spTier >= 2 ? 1.5 : 1;
    ctx.stroke();
    void loadSprite(def.id);
    try {
      drawMon(ctx, def.id, cell.x + cell.w / 2, cell.y + 32, 50);
    } catch {
      /* sprite still warming */
    }
    ctx.textAlign = 'center';
    ctx.font = fontB(6);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.toUpperCase(), cell.x + cell.w / 2, cell.y + 62);
    if (owned) {
      ctx.fillStyle = '#5a6284';
      ctx.fillText('OWNED', cell.x + cell.w / 2, cell.y + 80);
    } else {
      const deal = def.id === dealPick().id;
      const cost = dealCost(def);
      dustTag(ctx, cell.x + cell.w / 2, cell.y + 82, cost, info.dust >= cost ? '#9df0ff' : '#ff6b6b');
      if (deal) {
        // the daily discount tab — gold corner flag, struck-through list price
        ctx.fillStyle = '#ffd84d';
        ctx.fillRect(cell.x + cell.w - 38, cell.y, 38, 13);
        ctx.fillStyle = '#2a2440';
        ctx.fillText('DEAL', cell.x + cell.w - 19, cell.y + 10);
      }
    }
    ctx.restore();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('pulled or sparked mons join the dex + future drafts · tap outside to close', W / 2, r.y + r.h - 14);

  // the pull show rides on top — dim the shop, modal carries the reveal
  if (s.phase !== 'idle') drawPullShow(ctx, s);
}

// shake → reveal → results. Timing is main.ts's; everything here derives
// from s.t (phase-local seconds) and the result queue.
function drawPullShow(ctx: CanvasRenderingContext2D, s: HatchState) {
  ctx.fillStyle = 'rgba(6,10,22,0.72)';
  ctx.fillRect(0, 0, W, H);
  const m = HATCH_MODAL;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, m.x + 3, m.y + 5, m.w, m.h, 12);
  ctx.fill();
  roundRect(ctx, m.x, m.y, m.w, m.h, 12);
  ctx.fillStyle = '#0d1122';
  ctx.fill();
  rim(ctx, m, 12, GOLD, 2);
  edge(ctx, m, 12);
  const cx = m.x + m.w / 2;

  if (s.phase === 'shake') {
    const res = s.results[s.i];
    // the gold tell: rares flash, ~1-in-6 commons fake it (MS's fake-out)
    const gold = res ? res.rarity >= 2 || ((res.id * 2654435761) >>> 0) % 100 < 16 : false;
    const cy = m.y + m.h / 2 - 10;
    const wob = Math.sin(s.t * 13) * 0.4 * Math.max(0, 1 - s.t / 1.8); // 2-3 decaying wobbles
    const pulse = 0.4 + 0.3 * Math.sin(s.t * 9);
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 96);
    glow.addColorStop(0, gold ? `rgba(255,216,77,${pulse})` : `rgba(200,208,224,${pulse * 0.5})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 96, cy - 96, 192, 192);
    const ball = itemSprite('poke-ball');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wob);
    ctx.imageSmoothingEnabled = false;
    if (ball) ctx.drawImage(ball, -48, -48, 96, 96);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('THE BALL TWITCHES...', cx, m.y + m.h - 34);
    return;
  }

  if (s.phase === 'reveal') {
    const res = s.results[s.i];
    const def = res && speciesById(res.id);
    if (!res || !def) return;
    void loadSprite(res.id);
    const cy = m.y + 148;
    const starC = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? '#ffd84d' : '#a8b0c8';
    // the burst — rarity-tinted rays spinning out behind the sprite
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = starC;
    ctx.lineWidth = 3;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + s.t * 1.6;
      const rr = 78 + 8 * Math.sin(s.t * 6 + k);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.stroke();
    }
    ctx.restore();
    const pop = 1 + 0.35 * Math.max(0, 1 - s.t * 3.5); // landing overshoot, reel-pop style
    try {
      (res.shiny ? drawShiny : drawMon)(ctx, def.id, cx, cy, 100 * Math.min(pop, 1.25));
    } catch {
      /* sprite still warming */
    }
    for (let k = 0; k < res.rarity; k++) {
      ctx.fillStyle = starC;
      fillStar(ctx, cx + (k - (res.rarity - 1) / 2) * 22, cy + 78, 9);
    }
    ctx.textAlign = 'center';
    fitFont(ctx, def.name.toUpperCase(), 12, m.w - 40);
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.toUpperCase(), cx, cy + 108);
    ctx.font = font(10);
    ctx.fillStyle = res.dupe ? '#5a9bf0' : '#ffd84d';
    ctx.fillText(res.dupe ? `DUPE +${res.dust} DUST` : 'NEW!', cx, cy + 138);
    if (res.shiny) {
      ctx.font = fontB(8);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('★ SHINY ★', cx, cy + 160);
    }
    ctx.font = fontB(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(
      s.results.length > 1 ? `${s.i + 1} OF ${s.results.length} — TAP FOR NEXT` : 'TAP TO CONTINUE',
      cx,
      m.y + m.h - 26,
    );
    if (s.results.length > 1) {
      // SKIP ≫ — the 10-pull's fast-forward sits inside the modal's rim
      pill(ctx, SKIP_PULL_BTN, { c: '#3a4160', cd: '#262c44', tc: '#aab4dd', label: 'SKIP ≫' });
    }
    return;
  }

  // 'results' — the whole pull laid out; a single pull gets the hero card
  ctx.textAlign = 'center';
  ctx.font = font(11);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText(s.label ?? 'PULL RESULTS', cx, m.y + 36);
  if (s.results.length === 1) {
    const res = s.results[0];
    const def = res && speciesById(res.id);
    if (res && def) {
      void loadSprite(res.id);
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, def.id, cx, m.y + 170, 110);
      } catch {
        /* sprite still warming */
      }
      const starC = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? '#ffd84d' : '#a8b0c8';
      for (let k = 0; k < res.rarity; k++) {
        ctx.fillStyle = starC;
        fillStar(ctx, cx + (k - (res.rarity - 1) / 2) * 22, m.y + 244, 9);
      }
      fitFont(ctx, def.name.toUpperCase(), 11, m.w - 40);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name.toUpperCase(), cx, m.y + 278);
      ctx.font = font(10);
      ctx.fillStyle = res.dupe ? '#5a9bf0' : '#ffd84d';
      ctx.fillText(res.dupe ? `DUPE +${res.dust} DUST` : 'NEW!', cx, m.y + 306);
    }
  } else {
    const cols = 5;
    const cw = (m.w - 32) / cols;
    const rh = 96;
    s.results.forEach((res, i) => {
      const cell = { x: m.x + 16 + (i % cols) * cw + 3, y: m.y + 52 + Math.floor(i / cols) * rh + 3, w: cw - 6, h: rh - 6 };
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 7);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      ctx.strokeStyle = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? '#5a9bf0' : '#2a3560';
      ctx.lineWidth = res.rarity >= 2 ? 1.5 : 1;
      ctx.stroke();
      void loadSprite(res.id);
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, res.id, cell.x + cell.w / 2, cell.y + 30, 44);
      } catch {
        /* sprite still warming */
      }
      const sc = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? '#ffd84d' : '#a8b0c8';
      for (let k = 0; k < res.rarity; k++) {
        ctx.fillStyle = sc;
        fillStar(ctx, cell.x + cell.w / 2 + (k - (res.rarity - 1) / 2) * 12, cell.y + 58, 5);
      }
      ctx.textAlign = 'center';
      ctx.font = fontB(6);
      ctx.fillStyle = res.dupe ? '#5a9bf0' : '#ffd84d';
      ctx.fillText(res.dupe ? `+${res.dust}` : 'NEW', cell.x + cell.w / 2, cell.y + 76);
    });
  }
  const news = s.results.filter((r) => !r.dupe).length;
  const dust = s.results.reduce((a, r) => a + r.dust, 0);
  ctx.textAlign = 'center';
  ctx.font = fontB(9);
  ctx.fillStyle = '#aab4dd';
  ctx.fillText(`${news} NEW${dust ? ` · +${dust} DUST` : ''}${s.dexPay ? ` · DEX +${s.dexPay}★` : ''}${s.rookiePay ? ` · ROOKIE +${s.rookiePay}★` : ''}`, cx, m.y + m.h - 40);
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('TAP TO COLLECT', cx, m.y + m.h - 24);
}

// --- the lab: the deterministic sink — every star buys a sure thing ---------
const LAB_HEAD = 86;
const LAB_COLS = 2;
const LAB_CARD_W = 219;
const LAB_CARD_H = 128;
const LAB_GAP = 10;
const LAB_VIEW = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + LAB_HEAD, w: HATCH_PANEL.w - 32, h: 0 };
LAB_VIEW.h = HATCH_PANEL.y + HATCH_PANEL.h - 30 - LAB_VIEW.y;
// section split by id — the rest of LAB_UPGRADES lands in RUN TEAM
const LAB_TRAIN = new Set(['hp', 'dmg', 'spc', 'luck']);

// the price pill's rect inside a card — labHit tests the same rect the draw
// renders, so only a deliberate tap on the buy strip spends
const labBuyRect = (r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x + 10,
  y: r.y + r.h - 32,
  w: r.w - 20,
  h: 24,
});

// card rects + section heads in CONTENT coords (y=0 is the view top) —
// drawLab and labHit share this so a tap always lands where a card drew
function labLayout() {
  const secs: [string, (typeof LAB_UPGRADES)[number][], boolean][] = [
    ['TRAINING — EVERY RUN STARTS STRONGER', LAB_UPGRADES.filter((u) => LAB_TRAIN.has(u.id)), true],
    ['RUN TEAM — PER-RUN TOOLS', LAB_UPGRADES.filter((u) => !LAB_TRAIN.has(u.id)), false],
  ];
  const heads: { text: string; y: number }[] = [];
  const cards: { u: (typeof LAB_UPGRADES)[number]; train: boolean; r: { x: number; y: number; w: number; h: number } }[] = [];
  let y = 0;
  for (const [title, list, train] of secs) {
    if (!list.length) continue;
    heads.push({ text: title, y });
    y += 26;
    list.forEach((u, i) => {
      cards.push({
        u,
        train,
        r: {
          x: LAB_VIEW.x + (i % LAB_COLS) * (LAB_CARD_W + LAB_GAP),
          y: y + Math.floor(i / LAB_COLS) * (LAB_CARD_H + LAB_GAP),
          w: LAB_CARD_W,
          h: LAB_CARD_H,
        },
      });
    });
    y += Math.ceil(list.length / LAB_COLS) * (LAB_CARD_H + LAB_GAP) + 10;
  }
  return { heads, cards, h: y };
}

export function labScrollMax() {
  return Math.max(0, labLayout().h - LAB_VIEW.h);
}

// pointer → lab upgrade id, or null — only the buy strip answers
export function labHit(scroll: number, x: number, y: number): string | null {
  if (!inRect(x, y, LAB_VIEW)) return null;
  for (const c of labLayout().cards) {
    const cr = { ...c.r, y: c.r.y + LAB_VIEW.y - scroll };
    if (inRect(x, y, labBuyRect(cr))) return c.u.id;
  }
  return null;
}

function drawLabCard(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  u: (typeof LAB_UPGRADES)[number],
  train: boolean,
  stars: number,
) {
  const lvl = labLevel(u.id);
  const maxed = lvl >= u.max;
  const cost = u.costs[lvl] ?? 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, r.x + 2, r.y + 4, r.w, r.h, 8);
  ctx.fill();
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 8);

  // the tinted header carries the item icon — training reads gold, tools blue
  const band = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: 38 };
  stripeBand(ctx, band, train ? GOLD : '#3a8cff');
  void loadItem(u.icon);
  const img = itemSprite(u.icon);
  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(img, band.x + 8, band.y + 4, 30, 30);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  fitFont(ctx, u.name.toUpperCase(), 8, band.w - 44 - 52);
  ctx.fillStyle = '#2a2440';
  ctx.fillText(u.name.toUpperCase(), band.x + 44, band.y + 24);
  ctx.textAlign = 'right';
  ctx.font = fontB(7);
  ctx.fillText(`LV ${lvl}/${u.max}`, band.x + band.w - 8, band.y + 24);

  ctx.textAlign = 'left';
  ctx.font = fontB(7);
  ctx.fillStyle = '#a8b0d8';
  wrap2(ctx, u.desc, r.w - 24).forEach((l, i) => ctx.fillText(l, r.x + 12, r.y + 58 + i * 13));

  levelPips(ctx, { x: r.x + 12, y: r.y + 78, w: r.w - 24, h: 7 }, lvl, u.max);

  const buy = labBuyRect(r);
  if (maxed) {
    ctx.font = fontB(7);
    const mw = ctx.measureText('MAXED').width + 16;
    chip(ctx, buy.x + buy.w - mw, buy.y + 4, 'MAXED', { bg: '#232840', fg: '#8890b8' });
  } else {
    const afford = stars >= cost;
    pill(ctx, buy, {
      c: afford ? '#ffd84d' : '#e03c34',
      cd: afford ? '#c8a44d' : '#a02a24',
      tc: afford ? '#2a2440' : '#fff',
      label: `LV UP · ${cost}`,
    });
    void loadItem('star-piece');
    const star = itemSprite('star-piece');
    if (star) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = afford ? 1 : 0.6;
      ctx.drawImage(star, buy.x + 10, buy.y + buy.h / 2 - 7, 14, 14);
      ctx.restore();
    }
  }
}

export function drawLab(ctx: CanvasRenderingContext2D, scroll: number, stars: number) {
  const r = HATCH_PANEL;
  void loadItem('star-piece');
  ctx.fillStyle = 'rgba(6,10,22,0.82)';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = '#12162b';
  ctx.fill();
  cardFrame(ctx, r, 14);

  ctx.textAlign = 'left';
  ctx.font = font(15);
  ctx.fillStyle = '#ffd84d';
  ctx.fillText("PROF.'S LAB", r.x + 22, r.y + 42);
  ctx.font = fontB(8);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('SPEND YOUR STAR PIECES', r.x + 22, r.y + 60);
  balanceChip(ctx, { x: r.x + r.w - 178, y: r.y + 22, w: 160, h: 32 }, stars);

  const { heads, cards } = labLayout();
  ctx.save();
  ctx.beginPath();
  ctx.rect(LAB_VIEW.x - 6, LAB_VIEW.y, LAB_VIEW.w + 12, LAB_VIEW.h);
  ctx.clip();
  for (const hd of heads) {
    const hy = LAB_VIEW.y + hd.y - scroll;
    ctx.textAlign = 'left';
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(hd.text, LAB_VIEW.x + 4, hy + 14);
    ctx.strokeStyle = 'rgba(90,98,136,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LAB_VIEW.x + 4, hy + 21);
    ctx.lineTo(LAB_VIEW.x + LAB_VIEW.w - 4, hy + 21);
    ctx.stroke();
  }
  for (const c of cards) {
    const cr = { ...c.r, y: c.r.y + LAB_VIEW.y - scroll };
    if (cr.y + cr.h < LAB_VIEW.y || cr.y > LAB_VIEW.y + LAB_VIEW.h) continue;
    drawLabCard(ctx, cr, c.u, c.train, stars);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = '#8890b8';
  ctx.fillText('lab levels persist across runs — every star buys a sure thing · tap outside to close', W / 2, r.y + r.h - 14);
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
  failed?: boolean; // clipboard write rejected — the button says so
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
  // greedy wrap inside the card — the old midpoint split overflowed long descs
  // straight into the neighbour card
  const dlines: string[] = [];
  let cur = '';
  for (const wd of perk.desc.split(' ')) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(t).width <= r.w - 16) cur = t;
    else {
      dlines.push(cur);
      cur = wd;
    }
  }
  if (cur) dlines.push(cur);
  dlines.slice(0, 3).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + 128 + i * 18));

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

  const four = offers.length >= 4; // the lab's FOURTH OPTION board goes 2×2
  offers.forEach((perk, i) =>
    drawPerkCard(ctx, perkCardRect(i, offers.length), perk, { age: spin, i }, { owned: !!perk.id && !!perkIds?.includes(perk.id) }),
  );

  // held items — the run's build so far, a strip of icons under the
  // tool row so you can read your loadout at a glance. The 4-card board's
  // second row shoves it to the seam above TEAM · ITEMS.
  if (heldItems.length) {
    const iw = 22, gap = 6, n = Math.min(heldItems.length, 14);
    let ix = W / 2 - (n * (iw + gap) - gap) / 2;
    heldItems.slice(0, 14).forEach((item) => {
      const img = itemSprite(item);
      ctx.globalAlpha = 0.9;
      if (img) ctx.drawImage(img, ix, four ? 846 : 644, iw, iw);
      ix += iw + gap;
    });
    ctx.globalAlpha = 1;
  }

  // next row on the map — gyms announce themselves; wild rows stay quiet
  // since the actual choice happens on the map now. The 2×2 board's second
  // row owns this band — the map says the same thing anyway.
  ctx.font = font(8);
  const nextY = 852;
  if (!four) {
    if (next.gym) {
      ctx.fillStyle = '#f85888';
      ctx.fillText('NEXT: GYM LEADER', W / 2, nextY);
    } else {
      ctx.fillStyle = '#8890b8';
      ctx.fillText('NEXT: PICK YOUR ROUTE', W / 2, nextY);
    }
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
    // the quiet out — dark pill, no gold pull; staying put is a legal pick
    pill(ctx, EVO_KEEP, {
      c: '#2a3560',
      cd: '#1a2040',
      tc: '#aab4dd',
      label: `KEEP ${evo.from.name.toUpperCase()}`,
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
  masterArmed: boolean,
) {
  // captured box — tap a catch and a teammate, in either order, to swap
  ctx.font = font(9);
  ctx.fillStyle = '#8890b8';
  const capLine = `BOX: beaten foes join at ${Math.round(catchPct * 100)}%`;
  ctx.fillText(capLine, W / 2, 526);
  if (masterArmed) {
    void loadItem('master-ball');
    const ball = itemSprite('master-ball');
    if (ball) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(ball, W / 2 + ctx.measureText(capLine).width / 2 + 8, 515, 18, 18);
      ctx.restore();
    }
  }
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
// bottom row is a centered pair — CLOSE keeps its look, QUIT rides beside it
export const MENU_CLOSE = { x: W / 2 - 184, y: 788, w: 180, h: 44 };
export const MENU_QUIT = { x: W / 2 + 12, y: 788, w: 172, h: 44 };

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
  masterArmed: boolean,
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

  drawRoster(ctx, box, boxHp, boxLvl, boxScroll, selBox, team, teamHp, teamLvl, selTeam, catchPct, masterArmed);
  pill(ctx, MENU_CLOSE, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'CLOSE' });
  // the quiet out — dark like evo KEEP; the parked pk_run is what CONTINUE resumes
  pill(ctx, MENU_QUIT, { c: '#2a3560', cd: '#1a2040', tc: '#aab4dd', label: 'QUIT TO TITLE' });
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
  const four = offers.length >= 4; // the lab's FOURTH OPTION hits the charm board too
  offers.forEach((p, i) => drawPerkCard(ctx, perkCardRect(i, offers.length), p, undefined, { idx: i }));
  // declining pays score instead — a dead offer still has a price
  pill(ctx, CHARM_SKIP, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'SKIP +200 PTS' });
  // the drafted squad rides under the offers — pick the item for THESE mons.
  // The 2×2 board's second row pushes the squad to the bottom seam, shrunk.
  if (team.length) {
    const labelY = four ? 854 : 664;
    const monY = four ? 884 : 702;
    const monS = four ? 44 : 62;
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('YOUR TEAM', W / 2, labelY);
    team.forEach((def, i) => {
      const mx = W / 2 + (i - (team.length - 1) / 2) * (four ? 76 : 92);
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, monY, monS);
      ctx.font = fontB(8);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name.toUpperCase(), mx, monY + (four ? 32 : 34));
      ctx.font = fontB(6);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillText(def.type.toUpperCase(), mx, monY + (four ? 44 : 46));
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
  if (res.stars) findings.push(['STAR PIECES', `+${res.stars}`, '#ffd84d']); // the wallet's payout — even a wipe banks
  if (res.starsBonus) findings.push(['FIRST WIN TODAY', `+${res.starsBonus}`, '#ffd84d']);
  if (res.grind) findings.push([`RUN ${res.grind.n} TODAY`, `+${res.grind.pay}`, '#ffd84d']);
  if (res.dexPay) findings.push(['DEX MILESTONES', `+${res.dexPay}`, '#c9a8ff']);
  res.rookie?.forEach((s) => findings.push([`ROOKIE: ${s.label}`, `+${s.pay}`, '#c9a8ff']));
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
  pill(ctx, SHARE_BTN, {
    c: '#e8ecf8',
    cd: '#aab0c8',
    tc: '#2a2440',
    label: share?.failed ? 'COPY FAILED' : share?.copied ? 'COPIED!' : 'SHARE RESULT',
  });
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
// a claim slab answers on every tap now — done-vs-deny is main.ts's call
export function taskRowHit(p: Vec, tab: 'daily' | 'weekly'): TasksHit | null {
  if (inRect(p.x, p.y, TASKS_CLOSE) || !inRect(p.x, p.y, TASKS_PANEL)) return { kind: 'close' };
  for (let i = 0; i < TASKS_TABS.length; i++) {
    if (inRect(p.x, p.y, tasksTabRect(i))) return { kind: 'tab', i };
  }
  const views = taskViews(tab);
  for (let i = 0; i < views.length; i++) {
    if (inRect(p.x, p.y, taskClaimRect(taskRowRect(i)))) return { kind: 'claim', i };
  }
  return null; // dead panel space is still modal
}

export function drawTasks(ctx: CanvasRenderingContext2D, views: TaskView[], tab: 'daily' | 'weekly', t: number, flash?: string) {
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
  ctx.fillStyle = flash ? '#ffe89d' : '#2a2440';
  ctx.fillText(flash ?? 'rewards land in your bag', TASKS_BAND.x + 14, TASKS_BAND.y + 38);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2a2440';

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
