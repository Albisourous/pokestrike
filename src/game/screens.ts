import { itemSprite, loadItem, loadSprite, drawMon, drawShiny, drawNpc, gracidea, whiteSprite } from '../core/assets';
import { isMuted } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES, INVADER_IDS, PULLABLE, DEX_ALL, PULL_COST, PULL10_COST, PULL_PITY, PULL_SHINY, PULL_RATES, shinyOdds, tierOf, speciesById, LEADER_NPC, ASC_MODS, dustCost, AVATARS, EVO_LINES, setPay } from './data';
import { dailyMod as todaysMod } from './daily';
import { PERKS, RARITY_COLOR, BAG_ITEMS } from './perks';
import type { Perk, Rarity, BagItem } from './perks';
import { drawBackdrop } from './bg';
import { drawTile } from './map';
import { TILE_GRASSF, TILE_PATH, TILE_SAND, TILE_WATER, TILE_ROCK, TILE_LAB, TILE_HALL, TILE_MART, TILE_GYMHQ, TILE_TOWER, TREE_ROUND, TREE_PINE, TREE_TEAL, FLOWER_YB, FLOWER_PK, ROCK_SMALL } from './maptiles';
import { TYPE_COLOR, type PokeType } from './types';
import { roleOf, moveOf, superDesc } from './stats';
import { ULT_SHOTS } from './battle';
import { dexIds, dexRecent, shinyIds, best, SHINY_CHARM_AT, ACHIEVEMENTS, unlockedAch, BADGES, gymBadges, badgeOf, tier, rankName, board, settings, setSetting, bagStock, streakDaily, streakWins, ascPick, echoIds, labLevels, LAB_UPGRADES, stars, starBoost, boostLeft, raidDoneToday, pullCount, loginToday, streakRisky, nextDexReward, nextRookie, ROOKIE_STEPS, dust, freePullLeft, trainerPick, setProgress, setsReady, bondLv, bondOf, topBond, BOND_LEVELS, runSave, type Settings } from './meta';
import { tasksReady, taskResetsIn, raidPick, raidTeam, featuredPull, dealPick, dealCost } from './tasks';
import type { TaskView } from './tasks';
import type { Vec } from '../core/vec';
import {
  INK, INK_SOFT, INK_FAINT, PAPER, PAPER_HI, PARCH, GOLD, GOLD_HI, ACCENT, DANGER,
  font, fontB, uiWindow, uiBand, uiPanel, uiRow, uiClose, cursorTri, scrim,
} from './ui';

export const W = 540;
export const H = 960;

// mobile-first: key affordances only render when a keyboard is likely —
// a coarse-primary pointer (phone/tablet) never sees [1] or [R]. The keys
// stay wired regardless; this decides chrome, not input.
const HAS_KEYS = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

// species that can ever drop a ball — the dex completion denominator, and the
// every species the dex can hold — pulls plus evo-only forms; the dedup'd
// set lives in data.ts as DEX_ALL
export const CATCHABLE = DEX_ALL.length;

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
  bondDust?: number; // dust the lineup's bond level-ups paid — its own findings row
  bondUps?: { id: number; lv: number }[]; // which squad members crossed a bond rung — tagged on the attachment row
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
// the hero row anchors the bottom stack: ONE primary action (the climb) with
// the daily as its smaller flank — the raid lives on its own tab, so the row
// carries two doors, not three competing CTAs
export const FREE_BTN = { x: 46, y: 676, w: 296, h: 72 };
export const DAILY_BTN = { x: FREE_BTN.x + FREE_BTN.w + 10, y: FREE_BTN.y, w: W - 46 - (FREE_BTN.x + FREE_BTN.w + 10), h: 72 };
// only visible while a saved run waits — slips under the hero row
export const NEW_BTN = { x: W / 2 - 130, y: FREE_BTN.y + FREE_BTN.h + 4, w: 260, h: 24 };
// the drawn link stays a 24px sliver guarding CONTINUE; the live target is
// a 34px slab top-aligned on it so it can't ride into the pills above
export const NEW_HIT = { x: NEW_BTN.x, y: FREE_BTN.y + FREE_BTN.h + 1, w: NEW_BTN.w, h: 34 };
// --- home tabs: the CR-style bottom nav the title's bodies hang off -------
export type HomeTab = 'shop' | 'mons' | 'climb' | 'raid' | 'town';
// a floating bar, not flush — its bottom edge keeps ~28px clear of the
// iOS home-swipe zone
export const TAB_BAR = { x: 50, y: H - 104, w: W - 100, h: 76 };
// five cells: economy+collection left, CLIMB dead-center, the day's raid and
// the town hub to its right. `hit` follows the drawn pill — the popped card
// rides above the bar and the bare cell would leave it a dead zone
export const TAB_CELLS: {
  tab: HomeTab;
  x: number;
  y: number;
  w: number;
  h: number;
  hit: { x: number; y: number; w: number; h: number };
}[] = (['shop', 'mons', 'climb', 'raid', 'town'] as HomeTab[]).map((tab, i) => {
  const cell = {
    x: TAB_BAR.x + (TAB_BAR.w * i) / 5,
    y: TAB_BAR.y,
    w: TAB_BAR.w / 5,
    h: TAB_BAR.h,
  };
  return { tab, ...cell, hit: { ...cell } };
});

// press-pop feedback — main stamps the tap time (same `t` the loop runs on);
// swap stamps the outgoing tab so its card shrinks out instead of vanishing
let tabPressT = -9;
let swapFrom: HomeTab | null = null;
let swapT = -9;
export const noteTabPress = (t: number) => {
  tabPressT = t;
};
export const noteTabSwap = (t: number, from: HomeTab) => {
  swapFrom = from;
  swapT = t;
};

export const HELP_BTN = { x: W - 64, y: 22, w: 44, h: 44 };
// beta lifeline — a quiet link bottom-left, parked just above the tab bar
// so the nav never covers it
export const BUG_BTN = { x: 10, y: TAB_BAR.y - 30, w: 96, h: 18 };
export const BUG_HIT = { x: 0, y: TAB_BAR.y - 40, w: 130, h: 40 };
// the same ? badge shrunk for mid-run lookups — shown between fights
// (map + reward), where a player actually wants the reference
export const HELP_CHIP = { x: W - 58, y: 54, w: 40, h: 40 };
// 2px gaps between the mid-run chips cap the hit slop — pad 2 splits the
// gutter evenly, so a borderline tap goes to the first-checked chip
export const HELP_CHIP_HIT = { x: HELP_CHIP.x - 2, y: HELP_CHIP.y - 2, w: 44, h: 44 };
// corner-badge chrome — dark slab, optional dither, gold stroke; only the
// glyph inside varies (? / speaker / cog). The mid-run chips run lighter:
// an alpha face with a hairline rim; the title's badges are solid + dithered.
function cornerBadge(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  o: { bg?: string; dither?: number; lw?: number } = {},
) {
  // a dark menu-window chip — `bg` survives as the face tint (the mid-run
  // chips' translucent slab), the double-frame is the chrome kit's own
  uiWindow(ctx, r, { dark: true, tint: o.bg, rad: 8 });
  if (o.dither) {
    ctx.save();
    roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
    ctx.clip();
    dither(ctx, r, o.dither);
    ctx.restore();
  }
}

export function drawHelpChip(ctx: CanvasRenderingContext2D) {
  const cx = HELP_CHIP.x + HELP_CHIP.w / 2;
  const cy = HELP_CHIP.y + HELP_CHIP.h / 2;
  cornerBadge(ctx, HELP_CHIP, { bg: '#283058cc', lw: 1.5 });
  ctx.font = font(12);
  ctx.fillStyle = PARCH;
  ctx.textAlign = 'center';
  // PS2P '?' has right side-bearing and sits ~0.9em above the baseline —
  // nudge right and drop the baseline so the ink lands on the box center
  ctx.fillText('?', cx + 2, cy + 11);
}
export const MUTE_CHIP = { x: W - 100, y: 54, w: 40, h: 40 };
export const MUTE_CHIP_HIT = { x: MUTE_CHIP.x - 2, y: MUTE_CHIP.y - 2, w: 44, h: 44 };
export function drawMuteChip(ctx: CanvasRenderingContext2D) {
  const cx = MUTE_CHIP.x + MUTE_CHIP.w / 2;
  const cy = MUTE_CHIP.y + MUTE_CHIP.h / 2;
  cornerBadge(ctx, MUTE_CHIP, { bg: '#283058cc', lw: 1.5 });
  speakerGlyph(ctx, cx, cy, 0.72);
}
// settings cog, mid-run size — the next 42px slot left of MUTE_CHIP's grid
export const MAP_GEAR = { x: W - 142, y: 54, w: 40, h: 40 };
export const MAP_GEAR_HIT = { x: MAP_GEAR.x - 2, y: MAP_GEAR.y - 2, w: 44, h: 44 };
export function drawGearChip(ctx: CanvasRenderingContext2D) {
  const cx = MAP_GEAR.x + MAP_GEAR.w / 2;
  const cy = MAP_GEAR.y + MAP_GEAR.h / 2;
  cornerBadge(ctx, MAP_GEAR, { bg: '#283058cc', lw: 1.5 });
  gearGlyph(ctx, cx, cy, 1.3, PARCH);
}
export const MUTE_BTN = { x: 20, y: 22, w: 44, h: 44 };
// gear badge, left of the ? — the settings modal
export const GEAR_BTN = { x: HELP_BTN.x - 54, y: 22, w: 44, h: 44 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// invisible hit margin around a drawn target — the NEW_BTN/NEW_HIT pattern
// for one-offs; only safe where no sibling hit-rect sits within `n` px
export const slop = (r: { x: number; y: number; w: number; h: number }, n: number) => ({
  x: r.x - n,
  y: r.y - n,
  w: r.w + n * 2,
  h: r.h + n * 2,
});

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
// offer-tool row under the perk cards — reroll / banish pills. (The old
// SKIP pill is gone: every board must be picked.) perkCardRect ends at
// 580; the held-items strip yields to just below these. The tool row is
// a thumb target first — 46px tall, hugged under the cards
export const TOOL_ROLL = { x: 55, y: 588, w: 190, h: 46 };
export const TOOL_BAN = { x: W - 55 - 190, y: 588, w: 190, h: 46 };
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

// palette + fonts + the menu-window chrome live in ./ui — the single
// source so every surface shares the same ink/paper/gold vocabulary.
// DESIGN.md "GBA authentic": light paper faces in navy frames, gold
// reserved for the one CTA and rims; color lives in content, never fills.

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
// little person for the TRAINER tab — head + shoulders, same stroke family
function personGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 4.5 * s, 3.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 6.5 * s, cy + 7 * s);
  ctx.quadraticCurveTo(cx, cy - 1 * s, cx + 6.5 * s, cy + 7 * s);
  ctx.closePath();
  ctx.fill();
}

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

// tab-icon fallbacks — drawn stand-ins so a cold sprite cache never blanks
// a tab: a ball for MONS, twin peaks for CLIMB, a star for SHOP (TOWN's
// NPC ships with the boot atlas, so it needs no fallback)
function ballGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, 8 * s, 0, Math.PI * 2);
  ctx.moveTo(cx - 8 * s, cy);
  ctx.lineTo(cx + 8 * s, cy);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();
}

function peakGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 9 * s, cy + 6 * s);
  ctx.lineTo(cx - 3 * s, cy - 7 * s);
  ctx.lineTo(cx + 1 * s, cy - 2 * s);
  ctx.lineTo(cx + 4 * s, cy - 5 * s);
  ctx.lineTo(cx + 9 * s, cy + 6 * s);
  ctx.closePath();
  ctx.fill();
}

function edge(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, rad: number) {
  ctx.strokeStyle = INK;
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

// gradient cache — a CanvasGradient is fully fixed by its geometry + stops,
// so keying the ctor args gives identical fills without re-allocating one
// per frame (the field alone ran four radials a frame). Bounded like the
// measure memo — cold restart beats eviction bookkeeping.
const gradCache = new Map<string, CanvasGradient>();
const gradFor = (
  ctx: CanvasRenderingContext2D,
  key: string,
  make: (c: CanvasRenderingContext2D) => CanvasGradient,
) => {
  let g = gradCache.get(key);
  if (!g) {
    if (gradCache.size >= 400) gradCache.clear();
    gradCache.set(key, (g = make(ctx)));
  }
  return g;
};

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
  ctx.fillStyle = PAPER;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // the type tint survives as a faint content wash — chrome stays paper
  const gx = r.x + r.w / 2;
  const gy = r.y + r.h * 0.42;
  const c = TYPE_COLOR[type];
  const glow = gradFor(ctx, `cardGlow:${gx},${gy},${r.w},${type}`, (cc) => {
    const g = cc.createRadialGradient(gx, gy, 8, gx, gy, r.w * 0.95);
    g.addColorStop(0, `${c}28`);
    g.addColorStop(1, `${c}00`);
    return g;
  });
  ctx.fillStyle = glow;
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

// measureText storms: fitFont/wrap2 re-measure the same static strings every
// frame. Font+text fully determine the width, so a bounded memo ends it —
// cold restart on full beats eviction bookkeeping (contents are static strings)
const measureCache = new Map<string, number>();
const measureW = (ctx: CanvasRenderingContext2D, text: string) => {
  const k = `${ctx.font}\n${text}`;
  let w = measureCache.get(k);
  if (w === undefined) {
    if (measureCache.size >= 500) measureCache.clear();
    measureCache.set(k, (w = ctx.measureText(text).width));
  }
  return w;
};

// shrink a label's px until it fits a width — pixel type runs wide
export function fitFont(ctx: CanvasRenderingContext2D, label: string, px: number, maxW: number) {
  let size = px;
  ctx.font = font(size);
  while (size > 6 && measureW(ctx, label) > maxW) ctx.font = font(--size);
  return size;
}

// fitFont's dense-face twin — spark-grid names shrink in half-px steps
function fitFontB(ctx: CanvasRenderingContext2D, label: string, px: number, maxW: number) {
  let size = px;
  ctx.font = fontB(size);
  while (size > 5 && measureW(ctx, label) > maxW) ctx.font = fontB((size -= 0.5));
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
  if (measureW(ctx, text) <= maxW) return [text];
  const words = text.split(' ');
  let first = '';
  let used = 0;
  while (used < words.length && measureW(ctx, first ? `${first} ${words[used]}` : words[used]) <= maxW) {
    first = first ? `${first} ${words[used]}` : words[used];
    used++;
  }
  let rest = words.slice(used).join(' ');
  // line two has nowhere to wrap — ellipsize rather than clip mid-word.
  // binary-search the longest prefix that fits next to the ellipsis —
  // char-at-a-time was one measureText per trimmed char per frame
  if (measureW(ctx, rest) > maxW) {
    let lo = 1;
    let hi = rest.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measureW(ctx, `${rest.slice(0, mid)}…`) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    rest = `${rest.slice(0, lo).trimEnd()}…`;
  }
  return [first, rest];
}

// arcade cabinet button: hard corners, solid offset block the face presses into
export function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean, icon?: string, iconDy = 0) {
  ctx.fillStyle = 'rgba(40,48,88,0.3)';
  ctx.fillRect(r.x + 3, r.y + 3, r.w, r.h);
  ctx.fillStyle = on ? PAPER : '#e8e8e0';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = on ? 3 : 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const ic = icon ? 42 : 0; // an icon claims the left edge — text centers in what's left
  fitFont(ctx, label, 13, r.w - 20 - ic);
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? INK : INK_FAINT;
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
  const g = gradFor(ctx, `band:${r.y},${r.h},${color}`, (cc) => {
    const lg = cc.createLinearGradient(0, r.y, 0, r.y + r.h);
    lg.addColorStop(0, color);
    lg.addColorStop(1, mixHex(color, PAPER, 0.55));
    return lg;
  });
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
  const pa = ctx.textAlign;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 7, y + 11.5);
  ctx.textAlign = pa;
  return w;
}

// '[1]'-style key affordance, tucked bottom-right inside a card — same dark
// chip style as the kind pill
export function keyHint(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string) {
  ctx.font = fontB(7);
  const w = ctx.measureText(label).width + 14;
  chip(ctx, r.x + r.w - w - 8, r.y + r.h - 24, label, { bg: INK, fg: PAPER });
}

// Lv pips — `max` dashes spread across the rect, the first `lvl` lit gold.
// The lab card's level row; same pip language as the battle HUD's hp pips.
export function levelPips(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, lvl: number, max: number) {
  const gap = 5;
  const w = Math.max(4, (r.w - (max - 1) * gap) / max);
  const h = Math.min(5, r.h);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < lvl ? GOLD : '#d0d0c8';
    ctx.fillRect(r.x + i * (w + gap), r.y + (r.h - h) / 2, w, h);
  }
}

// GBA pill: flat face on a solid INK press edge — the lip under the bottom
// is the button's "up" state. `pressed` flattens the edge to a sliver and
// sinks the ink; `disabled` drops to pale gray. `badge` is a small INK
// counter at the right end.
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
  const c = o.disabled ? '#d8d8d0' : o.c;
  const tc = o.disabled ? INK_FAINT : o.tc;
  const rimH = o.pressed ? 1 : 4;
  // the press edge is a whole INK pill — the face sits on it and covers all
  // but the bottom lip
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h - rimH, (r.h - rimH) / 2);
  ctx.clip();
  ctx.fillStyle = c;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  stripes(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - rimH });
  ctx.restore();

  let bw = 0;
  if (o.badge) {
    ctx.font = fontB(7);
    bw = ctx.measureText(o.badge).width + 10;
  }
  const cy = r.y + (r.h - rimH) / 2 + (o.pressed ? 2 : 0);
  const pa = ctx.textAlign;
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
  ctx.textAlign = pa;
}

// --- title screen: mottled grass pitch, stadium ring of mons, arched wordmark ---

// font()/fontB() moved to ./ui with the rest of the chrome kit — re-exported
// here so existing callers keep working.
export { font, fontB };

// --- ambient title: today's offers ----------------------------------------
// The pitch between the wordmark and the buttons is scenery, not a demo —
// a TODAY card sells the day's rotating offers. The sling lives in battle.
const PITCH = { x: 26, y: 268, w: W - 52, h: 396 };

// TODAY's three teasers are doors, not just a poster — rate-up and deal open
// SHOP's tab, the shiny boss RAID's
const TODAY_CARD = { x: PITCH.x + 30, y: PITCH.y + 120, w: PITCH.w - 60, h: 152 };
export const TODAY_HITS: { tab: HomeTab; x: number; y: number; w: number; h: number }[] = (
  ['shop', 'raid', 'shop'] as HomeTab[]
).map((tab, i) => ({
  tab,
  x: TODAY_CARD.x + (TODAY_CARD.w * i) / 3,
  y: TODAY_CARD.y,
  w: TODAY_CARD.w / 3,
  h: TODAY_CARD.h,
}));

// the fallen team's ghosts haunt the pitch foot — a tap on one deep-links
// its dex card, the same contract as PARTNERS/RAID sprites
export function echoMonAt(x: number, y: number): number | null {
  const echo = echoIds();
  if (!echo?.length) return null;
  const ids = echo.slice(0, 3);
  for (let i = 0; i < ids.length; i++) {
    const ex = PITCH.x + PITCH.w * (0.2 + i * 0.3);
    if (inRect(x, y, { x: ex - 30, y: PITCH.y + PITCH.h - 100, w: 60, h: 80 })) return ids[i].id;
  }
  return null;
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
    ctx.fillStyle = gradFor(ctx, `field:${x},${y},${r}`, (cc) => {
      const rg = cc.createRadialGradient(x, y, 10, x, y, r);
      rg.addColorStop(0, c);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      return rg;
    });
    // clamp to the play area — edge patches would haze the letterbox
    const fx = Math.max(0, x - r), fy = Math.max(0, y - r);
    ctx.fillRect(fx, fy, Math.min(x + r, W) - fx, Math.min(y + r, H) - fy);
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
  const grad = gradFor(ctx, `logo:${size}`, (cc) => {
    const lg = cc.createLinearGradient(0, -size, 0, 0);
    lg.addColorStop(0, '#ffe76a');
    lg.addColorStop(1, '#f5a614');
    return lg;
  });
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
  tab: HomeTab,
) {
  // meta getters each hit localStorage + JSON.parse — one read each per frame
  const starN = stars();
  // the tab dots read these on every tab — the bodies get them passed in
  // rather than paying for a second parse
  const taskN = tasksReady();
  const freeNow = freePullLeft();

  drawField(ctx);
  drawWildMons(ctx);

  // stadium shadow at the edges keeps the eye on logo + impact
  const vig = gradFor(ctx, 'vignette', (cc) => {
    const rg = cc.createRadialGradient(W / 2, 400, 280, W / 2, 400, 640);
    rg.addColorStop(0, '#00000000');
    rg.addColorStop(1, 'rgba(6,14,6,0.2)');
    return rg;
  });
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // the wallet rides top-center like a Clash Royale gold bar — stars and
  // dust on the title mean the economy is visible before any overlay opens
  balanceChip(ctx, { x: W / 2 - 92, y: 28, w: 184, h: 36 }, starN, dust());


  // corner badges are chrome, not body — they ride every tab: how-to-play,
  // mute, settings
  cornerBadge(ctx, HELP_BTN, { dither: 0.09 });
  ctx.textAlign = 'center';
  ctx.font = font(16);
  ctx.fillStyle = PARCH;
  ctx.fillText('?', HELP_BTN.x + HELP_BTN.w / 2 + 3, HELP_BTN.y + HELP_BTN.h / 2 + 14);
  const mcx = MUTE_BTN.x + MUTE_BTN.w / 2, mcy = MUTE_BTN.y + MUTE_BTN.h / 2;
  cornerBadge(ctx, MUTE_BTN, { dither: 0.09 });
  speakerGlyph(ctx, mcx, mcy, 1);
  cornerBadge(ctx, GEAR_BTN, { dither: 0.09 });
  gearGlyph(ctx, GEAR_BTN.x + GEAR_BTN.w / 2, GEAR_BTN.y + GEAR_BTN.h / 2, 1.5, PARCH);

  if (tab === 'climb') drawClimbBody(ctx, t, cont, newArmed, dailyArmed);
  else if (tab === 'shop') drawShopBody(ctx, t, freeNow);
  else if (tab === 'mons') drawMonsBody(ctx, t);
  else if (tab === 'raid') drawRaidBody(ctx, t);
  else drawTownBody(ctx, t, taskN);

  // the floating nav draws last — no body should peek through under it
  drawTabBar(ctx, t, tab, freeNow, taskN);
}

// the run tab — today's title minus the meta chips the bottom nav now owns
function drawClimbBody(
  ctx: CanvasRenderingContext2D,
  t: number,
  cont: { stage: number; score: number } | null,
  newArmed: boolean,
  dailyArmed: boolean,
) {
  const raidDone = raidDoneToday();
  const raidDef = raidPick();
  const rookie = nextRookie();

  // wordmark rides upper-left — the action owns the rest of the pitch
  const logo = itemSprite('ui/pokemon-logo');
  if (logo) ctx.drawImage(logo, 36, 58, 330, 121);
  logoBig(ctx, 'STRIKE', 200, 236, 60, 320);

  // the last climb's fallen team haunts the pitch as ghosts — CR shows your
  // deck on the home screen; ours shows the team you have to avenge
  const echo = echoIds();
  if (echo?.length) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    echo.slice(0, 3).forEach((e, i) => {
      const ex = PITCH.x + PITCH.w * (0.2 + i * 0.3);
      const ey = PITCH.y + PITCH.h - 56 + Math.sin(t * 1.6 + i * 2.1) * 4;
      monShadow(ctx, ex, PITCH.y + PITCH.h - 56, 44);
      try {
        drawMon(ctx, e.id, ex, ey, 44);
      } catch {
        /* sprite still warming */
      }
      void loadSprite(e.id);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = fontB(7);
    ctx.fillStyle = TYPE_COLOR.ghost;
    ctx.fillText('RIVALS · WIN TO PUT THEM TO REST', PITCH.x + PITCH.w / 2, PITCH.y + PITCH.h - 28);
    ctx.restore();
  }

  // TODAY card — the day's three rotating offers in one glance: the rate-up
  // pull, the chroma raid boss, the spark deal. The home menu's one summary.
  {
    const offers: { def: SpeciesDef; tag: string; c: string }[] = [
      { def: featuredPull(), tag: 'RATE UP', c: GOLD },
      { def: raidDef, tag: raidDone ? '✓ CLEARED' : 'SHINY BOSS', c: '#9a6cff' },
      { def: dealPick(), tag: 'DEAL −25%', c: ACCENT },
    ];
    const card = TODAY_CARD;
    uiPanel(ctx, card, 'TODAY');
    ctx.textAlign = 'center';
    offers.forEach((o, i) => {
      const cx = card.x + (card.w * (i + 0.5)) / 3;
      monShadow(ctx, cx, card.y + 84, 54);
      drawMon(ctx, o.def.id, cx, card.y + 84 + Math.sin(t * 2.2 + i * 1.7) * 2.5, 54);
      ctx.font = fontB(7);
      ctx.fillStyle = o.c;
      ctx.fillText(o.tag, cx, card.y + 118);
      ctx.font = fontB(8);
      ctx.fillStyle = INK;
      ctx.fillText(o.def.name.toUpperCase(), cx, card.y + 132);
    });
  }

  // one hero pill — the daily rides its flank at the same height. The raid
  // isn't a door here anymore; its tab carries the boss face + chroma dot.
  pill(ctx, FREE_BTN, {
    c: GOLD_HI,
    cd: '#c8a44d',
    tc: INK,
    label: cont ? 'CONTINUE' : 'START CLIMB',
    // fresh trainers see the ladder's next step on the front door itself
    sub: cont ? `STAGE ${Math.max(1, cont.stage)}` : rookie ? `ROOKIE ${rookie.n + 1}/${ROOKIE_STEPS.length} · ${rookie.label}` : undefined,
  });
  pill(ctx, DAILY_BTN, dailyArmed
    ? { c: DANGER, cd: '#a02a24', tc: '#ffe8e8', label: 'DROP SAVED RUN?' }
    : { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'DAILY', sub: `RESETS ${taskResetsIn('daily')}` });
  // armed two-tap — the blinking ▶ rides beside the warn label
  if (dailyArmed) {
    const label = 'DROP SAVED RUN?';
    fitFont(ctx, label, 10, DAILY_BTN.w - 24);
    const tw = measureW(ctx, label);
    cursorTri(
      ctx,
      DAILY_BTN.x + DAILY_BTN.w / 2 - tw / 2 - 14,
      DAILY_BTN.y + (DAILY_BTN.h - 4) / 2,
      t,
      '#ffe8e8',
    );
  }
  // a live daily streak pins a pip on the corner — the tasksReady red pip's
  // family, gold while banked and warn-red when the chain dies at midnight
  const dStreak = streakDaily();
  const risky = streakRisky();
  if (dStreak > 0) {
    const bx = DAILY_BTN.x + DAILY_BTN.w - 4, by = DAILY_BTN.y + 4;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = risky ? '#e03c34' : GOLD;
    ctx.fill();
    ctx.strokeStyle = '#0a0d18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(dStreak > 9 ? '9+' : `${dStreak}`, bx, by + 3.5);
  }
  // today's seeded rule gets one line under DAILY — name + rule on a single
  // row; a dying streak claims the next one in warn-red
  if (!cont) {
    const dm = todaysMod();
    ctx.save();
    ctx.font = fontB(7);
    ctx.textAlign = 'right';
    ctx.fillStyle = PARCH;
    ctx.fillText(`TODAY: ${dm.name} — ${dm.desc}`, DAILY_BTN.x + DAILY_BTN.w - 2, DAILY_BTN.y + DAILY_BTN.h + 11);
    if (risky) {
      ctx.fillStyle = '#e03c34';
      ctx.fillText(`STREAK ${risky} DIES TONIGHT`, DAILY_BTN.x + DAILY_BTN.w - 2, DAILY_BTN.y + DAILY_BTN.h + 21);
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
    // armed — the ▶ marks the link as a live confirm, blinking off `t`
    if (newArmed) cursorTri(ctx, W / 2 - tw / 2 - 14, NEW_BTN.y + NEW_BTN.h - 8, t, col);
  }

  // the echo's haunt lives on the pitch itself now — spectral mons beat a caption line

  // the records line is the one-more-run hook — ranked ladder, best score.
  // Re-anchored to the hero row now the chip rows are gone: the +50 clears
  // the abandon-link / daily-mod tail that still owns the band right below.
  const b = best();
  const ld = tier();
  const bits = [`RANK ${rankName()}`, `BEST ${b.score.toLocaleString('en-US')}`];
  if (b.wins) bits.push(`ASCENSION ${Math.min(b.wins, 9)}`);
  const wStreak = streakWins();
  if (wStreak > 1) bits.push(`STREAK ${wStreak}`);
  // the rating's next rung folds into the records line — one stat row, one bar
  bits.push(ld.next ? `${ld.name} ${Math.round(ld.prog * 100)}% → ${ld.next.name}` : `${ld.name} MAX`);
  // a live star-boost tails the records line in muted gold — the quiet
  // countdown while a finished raid or daily is still paying out
  const boostMs = boostLeft();
  const boostTxt = boostMs > 0
    ? `★ BOOST ×${starBoost()} ${Math.floor(boostMs / 3600000)}h${String(Math.floor((boostMs % 3600000) / 60000)).padStart(2, '0')}m`
    : '';
  const recLine = bits.join(' · ');
  const recFull = boostTxt ? `${recLine} · ${boostTxt}` : recLine;
  // the dense-stat face — the pixel font's floor can't squeeze this line
  fitFontB(ctx, recFull, 8, W - 44);
  const recY = FREE_BTN.y + FREE_BTN.h + 58;
  const recX = W / 2 - measureW(ctx, recFull) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aab4dd';
  ctx.fillText(boostTxt ? `${recLine} · ` : recLine, recX, recY);
  if (boostTxt) {
    ctx.fillStyle = GOLD;
    ctx.fillText(boostTxt, recX + measureW(ctx, `${recLine} · `), recY);
  }
  ctx.textAlign = 'center';
  // the ladder: a fill bar toward the next tier, tinted to the current one —
  // its label already rode up into the stat line above
  const rw = 220, rx = W / 2 - rw / 2, ry = FREE_BTN.y + FREE_BTN.h + 70;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(rx, ry, rw, 7);
  ctx.fillStyle = ld.color;
  ctx.fillRect(rx, ry, Math.max(3, rw * ld.prog), 7);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, 6);

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
      uiWindow(ctx, br, { dark: true, rad: 6, rim: false });
      ctx.textAlign = 'center';
      ctx.fillStyle = GOLD_HI;
      ctx.fillText(msg, W / 2, br.y + (back ? 24 : 25));
      if (back) {
        ctx.font = fontB(9);
        ctx.fillStyle = PAPER;
        ctx.fillText(back, W / 2, br.y + 42);
      }
      ctx.restore();
    }
  }

  // build tag — bug reports should name their build
  ctx.font = fontB(7);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff30';
  ctx.fillText(__BUILD__, W - 10, BUG_BTN.y + BUG_BTN.h - 4);
  // the report link rides the opposite corner — a tester never hunts for it
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('REPORT BUGS', BUG_BTN.x, BUG_BTN.y + BUG_BTN.h - 4);
}

// the floating bottom nav — a raised gold-crowned pill marks the active
// cell, badge dots pull the eye to unclaimed pulls and tasks. Sprites fall
// back to drawn glyphs while the cache is still cold — no blank tabs.
function drawTabBar(
  ctx: CanvasRenderingContext2D,
  t: number,
  active: HomeTab,
  freeNow: boolean,
  taskN: number,
) {
  // the bar is a dark command strip — the menu window inverted
  uiWindow(ctx, TAB_BAR, { dark: true, rad: 18 });

  void loadItem('poke-ball');
  void loadItem('badges/1');
  void loadItem('star-piece');

  for (const cell of TAB_CELLS) {
    const on = cell.tab === active;
    const cx = cell.x + cell.w / 2;
    // every pill rests inside the bar — a still-raised CLIMB read as
    // half-selected, so clicking off puts it all the way back in
    const hero = cell.tab === 'climb';
    const rest = { x: cell.x + 7, y: cell.y + 7, w: cell.w - 14, h: cell.h - 14 };
    // the active tab DWARFS its cell — wider than the column and riding
    // proud of the bar so the picked tab reads from across the room;
    // CLIMB pops tallest as the hero
    const big = hero
      ? { x: cell.x - 1, y: cell.y - 28, w: cell.w + 2, h: cell.h + 18 }
      : { x: cell.x - 2, y: cell.y - 16, w: cell.w + 4, h: cell.h + 10 };
    // grow-in on switch: back-out ease overshoots the pill past `big` then
    // settles — a spring pop, not an instant swap. The outgoing card shrinks
    // back down over ~0.18s off the stamp main sets on the swap
    const grow = on
      ? bo(clamp01((t - tabPressT) / 0.24))
      : cell.tab === swapFrom
        ? 1 - clamp01((t - swapT) / 0.18)
        : 0;
    const lit = on || grow > 0.01;
    const pr = {
      x: rest.x + (big.x - rest.x) * grow,
      y: rest.y + (big.y - rest.y) * grow,
      w: rest.w + (big.w - rest.w) * grow,
      h: rest.h + (big.h - rest.h) * grow,
    };
    // the drawn pill is the tap target — a popped card rides above the bar,
    // so the bare cell would leave its visible crown a dead zone
    cell.hit.x = Math.min(cell.x, pr.x);
    cell.hit.y = Math.min(cell.y, pr.y);
    cell.hit.w = Math.max(cell.x + cell.w, pr.x + pr.w) - cell.hit.x;
    cell.hit.h = Math.max(cell.y + cell.h, pr.y + pr.h) - cell.hit.y;
    if (lit) {
      // the picked tab pops a paper window out of the strip — same
      // grow/spring `pr` math, the double-frame is the new crown
      uiWindow(ctx, pr, { rad: 14 });
    } else {
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.fillStyle = 'rgba(248,248,240,0.07)';
      ctx.fill();
    }

    const icY = cell.y + 25;
    const tint = lit ? INK : '#8890b8';
    // press-pop — the just-tapped pill squashes for ~0.16s (stamp set in main)
    const pop = on ? Math.max(0, 1 - (t - tabPressT) / 0.16) : 0;
    // every tab icon is a real asset: ball, gym badge, star piece, shiny boss,
    // townsperson
    const spr =
      cell.tab === 'mons'
        ? itemSprite('poke-ball')
        : cell.tab === 'climb'
          ? itemSprite('badges/1')
          : cell.tab === 'shop'
            ? itemSprite('star-piece')
            : undefined;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * clamp01(grow); // the icon fades in with the pop
    const iscale = (1 + 0.4 * grow) * (1 - 0.15 * pop); // icon rides the pill's grow — ~1.4× lit
    if (iscale !== 1) {
      ctx.translate(cx, icY);
      ctx.scale(iscale, iscale);
      ctx.translate(-cx, -icY);
    }
    if (spr) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, cx - 12, icY - 12, 24, 24);
    } else if (cell.tab === 'town') drawNpc(ctx, 'mom_down_0', cx, icY + 12, 28);
    else if (cell.tab === 'raid') {
      // the tab's face is today's shiny boss itself
      try {
        drawShiny(ctx, raidPick().id, cx, icY, 26);
      } catch {
        void loadSprite(raidPick().id);
      }
    } else if (cell.tab === 'mons') ballGlyph(ctx, cx, icY, 1, tint);
    else if (cell.tab === 'climb') peakGlyph(ctx, cx, icY, 1, tint);
    else {
      ctx.fillStyle = tint;
      fillStar(ctx, cx, icY, 11);
    }
    ctx.restore();

    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? INK : '#8890b8';
    ctx.fillText(cell.tab.toUpperCase(), cx, cell.y + cell.h - 14);

    // badge dots — the notification pull. SHOP breathes gold while the
    // daily free pull waits, MONS while a line-set bounty sits; TOWN carries
    // the claimable-task count in red; RAID glows chroma till the boss falls.
    const bx = cx + 20, by = cell.y + 14;
    if (cell.tab === 'raid' && !raidDoneToday()) {
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(t * 5) * 0.3;
      ctx.beginPath();
      ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#9a6cff';
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    if ((cell.tab === 'shop' && freeNow) || (cell.tab === 'mons' && setsReady().length > 0)) {
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(t * 5) * 0.3;
      ctx.beginPath();
      ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    if (cell.tab === 'town' && taskN > 0) {
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#e03c34';
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = fontB(7);
      ctx.textAlign = 'center';
      ctx.fillStyle = PAPER;
      ctx.fillText(taskN > 9 ? '9+' : `${taskN}`, bx, by + 3.5);
    }
  }
}

// --- MONS: the creature loop — hatcher hero, dex card, latest catches -----
// --- SHOP: stars and sparks in, mons out — hatcher hero + the daily deal ---
function drawShopBody(ctx: CanvasRenderingContext2D, t: number, freeNow: boolean) {
  hatcherCard(ctx, t, freeNow);

  // the day's −25% spark bargain — its own window so the deal sells itself
  const dr = DEAL_BTN;
  uiPanel(ctx, dr, 'SPARK DEAL −25%');
  const deal = dealPick();
  // a type-tinted pad — the bargain stands on its own color like the rest
  const dcx = dr.x + 82, dcy = dr.y + 102;
  ctx.fillStyle = `${TYPE_COLOR[deal.type]}30`;
  ctx.beginPath();
  ctx.ellipse(dcx, dcy + 44, 64, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  monShadow(ctx, dcx, dcy + 4, 78);
  try {
    drawMon(ctx, deal.id, dcx, dcy + Math.sin(t * 2.4) * 2.5, 78);
  } catch {
    void loadSprite(deal.id);
  }
  const tx2 = dr.x + 156;
  ctx.textAlign = 'left';
  ctx.font = fontB(8);
  ctx.fillStyle = ACCENT;
  ctx.fillText('TODAY ONLY', tx2, dr.y + 58);
  fitFont(ctx, deal.name.toUpperCase(), 12, dr.x + dr.w - tx2 - 14);
  ctx.fillStyle = INK;
  ctx.fillText(deal.name.toUpperCase(), tx2, dr.y + 82);
  ctx.font = fontB(8);
  ctx.fillStyle = TYPE_COLOR[deal.type];
  ctx.fillText(deal.type2 ? `${deal.type} · ${deal.type2}`.toUpperCase() : deal.type.toUpperCase(), tx2, dr.y + 101);
  // the price leads; the struck list price beside it makes the −25% land
  const was = dustCost(deal);
  ctx.font = fontB(11);
  ctx.fillStyle = ACCENT;
  const cost = `${dealCost(deal)}`;
  ctx.fillText(`◆ ${cost}`, tx2, dr.y + 123);
  const pw = ctx.measureText(`◆ ${cost}`).width;
  ctx.font = fontB(8);
  const wl = `was ◆ ${was}`;
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(wl, tx2 + pw + 12, dr.y + 121);
  ctx.strokeStyle = INK_FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx2 + pw + 12, dr.y + 118);
  ctx.lineTo(tx2 + pw + 12 + ctx.measureText(wl).width, dr.y + 118);
  ctx.stroke();
  ctx.font = fontB(9);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('TAP TO OPEN THE HATCHER ›', tx2, dr.y + 148);
}

// the hatcher's hero card — featured pull on its type stage, pity, prices
function hatcherCard(ctx: CanvasRenderingContext2D, t: number, freeNow: boolean) {
  const pullN = pullCount();
  const r = HATCH_BTN;
  // the economy's front door — a titled window; the free pull flags in-band
  uiPanel(ctx, r, 'THE HATCHER', { h: 36, sub: freeNow ? 'FREE PULL TODAY' : undefined });

  // the day's rate-up face on a stage of its own — a type-glow card with
  // pedestal, ball watermark, and twinkles breathing around the sprite
  const feat = featuredPull();
  const ftc = TYPE_COLOR[feat.type];
  const stage = { x: r.x + 16, y: r.y + 50, w: 200, h: 146 };
  ctx.save();
  roundRect(ctx, stage.x, stage.y, stage.w, stage.h, 10);
  ctx.clip();
  ctx.fillStyle = PAPER_HI;
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
  const sg = ctx.createRadialGradient(
    stage.x + stage.w / 2,
    stage.y + stage.h * 0.44,
    8,
    stage.x + stage.w / 2,
    stage.y + stage.h * 0.44,
    stage.w * 0.9,
  );
  sg.addColorStop(0, `${ftc}33`);
  sg.addColorStop(1, `${ftc}00`);
  ctx.fillStyle = sg;
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
  ctx.restore();
  rim(ctx, stage, 10, `${ftc}88`, 1.5);

  const fcx = stage.x + stage.w / 2, fcy = stage.y + 72;
  ballGlyph(ctx, fcx, fcy - 6, 4.6, 'rgba(40,48,88,0.08)');
  ctx.fillStyle = `${ftc}40`;
  ctx.beginPath();
  ctx.ellipse(fcx, fcy + 42, 68, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  monShadow(ctx, fcx, fcy + 6, 100);
  try {
    drawMon(ctx, feat.id, fcx, fcy + Math.sin(t * 2.2) * 3, 100);
  } catch {
    void loadSprite(feat.id);
  }
  const twk: [number, number][] = [[-70, -42], [66, -50], [56, 28]];
  ctx.fillStyle = GOLD;
  twk.forEach(([dx, dy], i) => {
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.6 + i * 2.1));
    fillStar(ctx, fcx + dx, fcy + dy, 4.5);
  });
  ctx.globalAlpha = 1;
  ctx.font = fontB(8);
  ctx.textAlign = 'center';
  ctx.fillStyle = mixHex(ftc, INK, 0.2);
  ctx.fillText(
    feat.type2 ? `${feat.type} · ${feat.type2}`.toUpperCase() : feat.type.toUpperCase(),
    fcx,
    stage.y + stage.h - 12,
  );

  const tx = stage.x + stage.w + 18;
  ctx.textAlign = 'left';
  ctx.font = fontB(9);
  ctx.fillStyle = GOLD;
  ctx.fillText('RATE-UP TODAY', tx, r.y + 72);
  fitFont(ctx, feat.name.toUpperCase(), 13, r.x + r.w - tx - 14);
  ctx.fillStyle = INK;
  ctx.fillText(feat.name.toUpperCase(), tx, r.y + 98);
  ctx.font = fontB(8);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('10× ODDS IN THE RARE+ POOL', tx, r.y + 118);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`RARE+ GUARANTEED IN ${PULL_PITY - (pullN % PULL_PITY)} PULLS`, tx, r.y + 137);
  // the price of admission — two cost chips: the single, the discounted ten
  const pw = (r.x + r.w - 16 - tx - 10) / 2;
  ([['×1', PULL_COST], ['×10', PULL10_COST]] as [string, number][]).forEach(([k, cost], i) => {
    const px = tx + i * (pw + 10);
    uiWindow(ctx, { x: px, y: r.y + 148, w: pw, h: 32 }, { rad: 8, rim: false, shadow: false });
    ctx.textAlign = 'center';
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`PULL ${k}`, px + pw / 2, r.y + 161);
    ctx.font = fontB(10);
    ctx.fillStyle = GOLD;
    ctx.fillText(`★${cost}`, px + pw / 2, r.y + 176);
  });

  // the whole card is the button — the pill at its foot says so out loud
  pill(
    ctx,
    { x: r.x + 16, y: r.y + r.h - 46, w: r.w - 32, h: 34 },
    freeNow
      ? { c: GOLD, cd: '#c8a44d', tc: INK, label: 'FREE PULL WAITING — TAP TO OPEN' }
      : { c: GOLD_HI, cd: '#c8a44d', tc: INK, label: 'TAP TO OPEN THE HATCHER' },
  );

  // the old chip's breathing glow — today's free pull still sells itself
  if (freeNow) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(t * 5) * 0.3;
    ctx.strokeStyle = '#ffe89d';
    ctx.lineWidth = 2.5;
    roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 15);
    ctx.stroke();
    ctx.restore();
  }
}

// --- MONS: the collection — dex, evolution sets, latest catches ------------
// --- RAID: the day's seeded chroma boss — free retries till it falls ------
function drawRaidBody(ctx: CanvasRenderingContext2D, t: number) {
  const raidDone = raidDoneToday();
  const boss = raidPick();
  const r = RAID_CARD;
  uiPanel(ctx, r, 'CHROMA RAID', { sub: raidDone ? '✓ CLEARED' : undefined });

  // the boss stands center on a chroma stage — shiny palette, slow hover
  const bcx = r.x + r.w / 2, bcy = r.y + 122;
  ctx.fillStyle = '#9a6cff30';
  ctx.beginPath();
  ctx.ellipse(bcx, bcy + 54, 96, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  monShadow(ctx, bcx, bcy + 4, 120);
  const bob = Math.sin(t * 2.2) * 3;
  try {
    drawShiny(ctx, boss.id, bcx, bcy + bob, 120);
  } catch {
    try {
      drawMon(ctx, boss.id, bcx, bcy + bob, 120);
    } catch {
      void loadSprite(boss.id);
    }
  }
  ctx.textAlign = 'center';
  fitFont(ctx, boss.name.toUpperCase(), 12, r.w - 40);
  ctx.fillStyle = INK;
  ctx.fillText(boss.name.toUpperCase(), bcx, bcy + 88);
  ctx.font = fontB(8);
  ctx.fillStyle = '#9a6cff';
  ctx.fillText('SHINY BOSS · ONE PER DAY', bcx, bcy + 106);

  // the loaner trio — level-30 rare+ rentals, same three for everyone
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('YOUR LV30 LOANERS', bcx, r.y + 254);
  // the deep-link hint rides the header line — below the trio it collides
  // with the right loaner's name
  ctx.textAlign = 'right';
  ctx.fillText('TAP A MON → ITS CARD', r.x + r.w - 16, r.y + 254);
  ctx.textAlign = 'center';
  raidTeam().forEach((d, i) => {
    const cx = bcx + (i - 1) * 110;
    monShadow(ctx, cx, r.y + 292, 48);
    try {
      drawMon(ctx, d.id, cx, r.y + 288 + Math.sin(t * 2.2 + i * 1.7) * 2, 48);
    } catch {
      void loadSprite(d.id);
    }
    ctx.font = fontB(7);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(d.name.toUpperCase(), cx, r.y + 320);
  });
  // the fight pill — chroma face; cleared, it sells tomorrow's boss instead
  pill(
    ctx,
    RAID_FIGHT,
    raidDone
      ? {
          c: '#3a4160',
          cd: '#262c44',
          tc: INK_FAINT,
          label: 'CLEARED',
          sub: `TMRW: ${raidPick(Date.now() + 86400000).name.toUpperCase()}`,
        }
      : { c: '#9a6cff', cd: '#6b4ac0', tc: PAPER, label: 'FIGHT', sub: 'FREE RETRIES · SHINY DEX + ★ ON WIN' },
  );
}

function drawMonsBody(ctx: CanvasRenderingContext2D, t: number) {
  // the dex card keeps the chip's two facts — how full, and the nearest
  // open loop: catches to the charm, badges to the crown, pulls to pity
  const dexN = dexIds().length;
  const pullN = pullCount();
  const badges = gymBadges();
  const dexRw = nextDexReward();
  const nextGoal = dexN < SHINY_CHARM_AT
    ? `${SHINY_CHARM_AT - dexN} TO CHARM`
    : dexRw
      ? dexRw.at <= dexN
        ? `+${dexRw.pay}★ MILESTONE READY` // crossed, unpaid — a pull/run banks it
        : `${dexRw.at - dexN} TO +${dexRw.pay}★`
      : badges.size < BADGES.length
        ? `${BADGES.length - badges.size} BADGES LEFT`
        : `PITY IN ${PULL_PITY - (pullN % PULL_PITY)}`;
  const d = DEX_BTN;
  uiPanel(ctx, d, 'POKÉDEX', { h: 26, sub: `${dexN}/${CATCHABLE}` });
  // the dex's ball icon rides the title band's left edge
  ballGlyph(ctx, d.x + 22, d.y + 16, 1.1, '#e03c34');
  ctx.textAlign = 'left';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(nextGoal, d.x + 18, d.y + 62);
  // a claimable set bounty advertises on the dex card too — the SETS card
  // below owns the claiming
  const readySets = setsReady().length;
  if (readySets) {
    const label = `${readySets} SET BONUS${readySets > 1 ? 'ES' : ''} READY`;
    const chipX = d.x + 18 + ctx.measureText(nextGoal).width + 10;
    ctx.font = fontB(7);
    roundRect(ctx, chipX, d.y + 51, ctx.measureText(label).width + 14, 15, 7);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(label, chipX + 7, d.y + 62);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('TAP TO BROWSE', d.x + d.w - 18, d.y + 62);
  // a slim fill toward a full dex — the ladder bar's idiom, percent inside
  const bw = d.w - 36, bx = d.x + 18, by = d.y + d.h - 28;
  ctx.fillStyle = '#e8e8e0';
  ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = GOLD;
  ctx.fillRect(bx, by, Math.max(3, (bw * dexN) / CATCHABLE), 8);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 7);
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`${Math.round((dexN / CATCHABLE) * 100)}%`, bx + bw, by + 20);

  // LINE SETS — whole evolution families for a one-time star bounty. A
  // ready line turns the card into a CLAIM button; otherwise it shows the
  // nearest finish so the chase stays visible
  const sr = SETS_BTN;
  const ready = setsReady();
  const done = setProgress().filter((p) => p.have === p.need).length;
  uiPanel(ctx, sr, ready.length ? 'LINE SETS — CLAIM!' : 'LINE SETS', {
    sub: `${done}/${EVO_LINES.length} COMPLETE`,
  });
  ctx.textAlign = 'left';
  if (ready.length) {
    // every claimable line lists itself as a menu row — a tap banks them all
    let ry = sr.y + 56;
    let pay = 0;
    ready.forEach((root) => {
      const line = EVO_LINES.find((l) => l.root === root)!;
      pay += setPay(line);
      if (ry < sr.y + sr.h - 20) {
        uiRow(
          ctx,
          { x: sr.x + 8, y: ry - 14, w: sr.w - 16, h: 20 },
          `${speciesById(root)?.name.toUpperCase() ?? root} LINE`,
          { right: `+★${setPay(line)}` },
        );
        ry += 20;
      }
    });
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`TAP TO CLAIM +★${pay}`, sr.x + 14, sr.y + sr.h - 14);
  } else {
    // nearest line to finishing — sprites of the missing links sell the gap
    const next = setProgress()
      .filter((p) => p.have > 0 && p.have < p.need)
      .sort((a, b) => b.have / b.need - a.have / a.need)[0];
    if (next) {
      const line = EVO_LINES.find((l) => l.root === next.root)!;
      ctx.font = font(9);
      ctx.fillStyle = INK;
      ctx.fillText(`${speciesById(next.root)?.name.toUpperCase() ?? next.root} LINE`, sr.x + 14, sr.y + 62);
      ctx.font = fontB(8);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(`${next.have}/${next.need} CAUGHT · PAYS ★${setPay(line)}`, sr.x + 14, sr.y + 82);
      // the line's silhouettes — caught bright, missing dimmed
      const owned = new Set(dexIds());
      line.ids.slice(0, 6).forEach((id, i) => {
        const ix = sr.x + 40 + i * 56;
        ctx.save();
        ctx.globalAlpha = owned.has(id) ? 1 : 0.22;
        try {
          drawMon(ctx, id, ix, sr.y + 116, 40);
        } catch {
          void loadSprite(id);
        }
        ctx.restore();
      });
    } else {
      ctx.font = fontB(9);
      ctx.fillStyle = INK_FAINT;
      ctx.fillText('CATCH TO START A LINE', sr.x + 14, sr.y + 76);
    }
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('TAP TO BROWSE THE DEX', sr.x + 14, sr.y + sr.h - 12);
  }

  // the strip casts whoever the career ledger says matters: top-bonded
  // partners once any exist, the dex's latest catches until then
  const s = PARTNERS_BTN;
  const partners = topBond(3);
  void loadItem('friend-ball');
  uiPanel(ctx, s, partners.length ? 'PARTNERS' : 'LATEST CATCHES', {
    h: 26,
    ...(partners.length ? { sub: 'BOND LVS PAY DUST' } : {}),
  });
  const ids = partners.length ? partners.map((p) => p.id) : dexRecent(3);
  if (!ids.length) {
    // ghost ball silhouettes behind the empty line — the strip reads as a
    // stage waiting for its cast, not a dead card
    [-90, 0, 90].forEach((dx) => ballGlyph(ctx, s.x + s.w / 2 + dx, s.y + 76, 1.6, 'rgba(255,255,255,0.07)'));
    ctx.font = font(9);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('CATCHES LAND HERE', s.x + s.w / 2, s.y + s.h / 2 + 14);
  } else {
    const shinies = new Set(shinyIds());
    ids.forEach((id, i) => {
      const cx = s.x + s.w / 2 + (i - (ids.length - 1) / 2) * 150;
      const cy = s.y + (partners.length ? 78 : 84);
      const cdef = speciesById(id);
      // type-tinted floor pad — each catch lands on its own color
      if (cdef) {
        ctx.fillStyle = `${TYPE_COLOR[cdef.type]}2e`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 30, 46, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      monShadow(ctx, cx, cy + 4, 56);
      try {
        drawMon(ctx, id, cx, cy + Math.sin(t * 2.2 + i * 1.7) * 2.5, 56);
      } catch {
        void loadSprite(id);
      }
      ctx.font = fontB(7);
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.fillText(cdef ? cdef.name.toUpperCase() : `#${id}`, cx, s.y + s.h - (partners.length ? 30 : 22));
      if (shinies.has(id)) {
        ctx.fillStyle = GOLD;
        ctx.fillText('★', cx + 30, cy - 24);
      }
      if (partners.length) {
        // friend ball + LV pips: the bond read is canon, not invented
        const fball = itemSprite('friend-ball');
        if (fball) ctx.drawImage(fball, cx - 46, cy - 30, 18, 18);
        const lv = bondLv(id);
        for (let p = 0; p < BOND_LEVELS.length; p++) {
          ctx.fillStyle = p < lv ? GOLD : '#d8d8d0';
          ctx.beginPath();
          ctx.arc(cx - 24 + p * 12, s.y + s.h - 14, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  // YOUR TEAM — the parked climb's lineup when a run is banked; the rival
  // echo or the hall's top squad stand in when nothing's mid-climb
  const tr = TEAM_BTN;
  const parked = runSave()?.team;
  const echo = parked ? null : echoIds();
  const hof = !parked && !echo ? (board()[0]?.team ?? []).map((id) => ({ id, lvl: 0 })) : null;
  const squad: { id: number; lvl: number; shiny?: boolean }[] | null = parked ?? echo ?? hof;
  uiPanel(ctx, tr, parked ? 'YOUR CLIMB' : echo ? 'RIVAL ECHO' : 'LAST SQUAD', {
    h: 26,
    ...(parked
      ? { sub: `STAGE ${runSave()!.pendingNext + 1}/${TOTAL_STAGES}` }
      : echo
        ? { sub: 'IT HUNTS YOU' }
        : {}),
  });
  if (!squad || !squad.length) {
    // the same ghost-ball wait as the catches strip — an empty stable, not
    // a dead card
    [-90, 0, 90].forEach((dx) => ballGlyph(ctx, tr.x + tr.w / 2 + dx, tr.y + 58, 1.6, 'rgba(255,255,255,0.07)'));
    ctx.font = font(9);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('NO SQUAD — START A CLIMB', tr.x + tr.w / 2, tr.y + tr.h / 2 + 12);
  } else {
    const step = Math.min(76, (tr.w - 60) / squad.length);
    const x0 = tr.x + tr.w / 2 - ((squad.length - 1) * step) / 2;
    squad.slice(0, 6).forEach((m, i) => {
      const cx = x0 + i * step;
      const cy = tr.y + 56;
      monShadow(ctx, cx, cy + 4, 44);
      try {
        (m.shiny ? drawShiny : drawMon)(ctx, m.id, cx, cy + Math.sin(t * 2.2 + i * 1.7) * 2, 44);
      } catch {
        void loadSprite(m.id);
      }
      if (m.lvl) {
        ctx.font = fontB(7);
        ctx.textAlign = 'center';
        ctx.fillStyle = INK;
        ctx.fillText(`LV${m.lvl}`, cx, tr.y + tr.h - 24);
      }
    });
    // the card is a door — a parked squad taps through to CLIMB's CONTINUE
    ctx.font = fontB(7);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(parked ? 'TAP → CLIMB' : 'TAP TO BROWSE', tr.x + tr.w - 14, tr.y + tr.h - 10);
  }
}

// --- TOWN: a real little town — the buildings ARE the menu; tap a door ----
// Structures + scenery are gracidea tileset slices (the RSE canon), villagers
// from the npcs atlas. Signs posted at each door carry the stats the old
// cards did. The gym's rung board anchors the bottom edge.

// a door sign — a tiny menu-window plaque on a post, name + one stat line
function townSign(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, name: string, sub: string) {
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(cx - 2, y + 28, 4, 10);
  const r = { x: cx - w / 2, y, w, h: 32 };
  uiWindow(ctx, r, { rad: 6 });
  ctx.textAlign = 'center';
  fitFont(ctx, name, 7, w - 10);
  ctx.fillStyle = INK;
  ctx.fillText(name, cx, y + 14);
  ctx.font = fontB(7);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(sub, cx, y + 26);
}

function drawTownBody(ctx: CanvasRenderingContext2D, t: number, taskN: number) {
  // clip the whole scene to the play area — the tile loops' last column and
  // the flank trees overrun W, and without this they paint the right pillar
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // grass slab under the tab body — the interior tile at 1.5× reads as
  // chunky GBA ground. Starts under the chrome band: the wallet bar and
  // corner badges draw before the body, so the tiles would bury them.
  for (let gy = 68; gy < H; gy += 66) for (let gx = 0; gx < W; gx += 66) drawTile(ctx, TILE_GRASSF, gx, gy, 66, 66);

  // the treeline — the classic GBA town wall, three canopies trading places
  for (let i = 0; i < 11; i++) drawTile(ctx, [TREE_ROUND, TREE_PINE, TREE_TEAL][i % 3], 20 + i * 46, 118, 40, 42);
  // a couple hugging the flanks so the wall doesn't read as a cornice
  drawTile(ctx, TREE_PINE, 0, 190, 38, 40);
  drawTile(ctx, TREE_ROUND, 508, 200, 38, 40);

  // the main road: bordered path blocks straight across mid-town
  const ROAD_Y = 352;
  for (let gx = 0; gx < W; gx += 52) drawTile(ctx, TILE_PATH, gx, ROAD_Y, 52, 52);

  // doorstep paths — sand strips joining each building's door to the road
  const stub = (cx: number, y0: number, y1 = ROAD_Y) => {
    for (let y = y0; y < y1; y += 32) drawTile(ctx, TILE_SAND, cx - 16, y, 32, 32);
  };
  stub(110, 310);
  stub(272, 316);
  stub(434, 312);

  // north row — the lab, the hall, the trophy tower
  drawTile(ctx, TILE_LAB, 48, 196, 124, 114);
  drawTile(ctx, TILE_HALL, 200, 204, 140, 117);
  drawTile(ctx, TILE_TOWER, 372, 170, 124, 145);

  // south row — the mart with its job board, and the gym
  drawTile(ctx, TILE_MART, 56, 436, 140, 110);
  drawTile(ctx, TILE_GYMHQ, 322, 526, 142, 172);

  // door signs — what the old cards said, now posted at each doorstep
  const lvls = labLevelMap();
  const trained = LAB_UPGRADES.filter((u) => (lvls.get(u.id) ?? 0) > 0).length;
  const b = best();
  const runs = board().length;
  townSign(ctx, 110, 316, 104, 'THE LAB', `${trained}/${LAB_UPGRADES.length} TRAINED`);
  townSign(ctx, 272, 322, 118, 'HALL OF FAME', b.score ? `BEST ${b.score.toLocaleString('en-US')}` : `${runs} RUNS LOGGED`);
  townSign(ctx, 434, 320, 108, 'TROPHIES', `★ ${unlockedAch().size}/${ACHIEVEMENTS.length}`);
  townSign(ctx, 126, 574, 110, 'JOB BOARD', taskN > 0 ? `${taskN} READY` : `RESETS ${taskResetsIn('daily')}`);
  // a claimable task pins the red count pip on the sign's corner — the same
  // badge the old card corner wore
  if (taskN > 0) {
    const bx = 126 + 55, by = 574;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#e03c34';
    ctx.fill();
    ctx.strokeStyle = '#0a0d18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = fontB(7);
    ctx.textAlign = 'center';
    ctx.fillStyle = PAPER;
    ctx.fillText(taskN > 9 ? '9+' : `${taskN}`, bx, by + 3.5);
  }

  // villagers — feet on the grass by their doors; the gym leader waits in
  // his doorway, and one youngster paces the road with a walk cycle
  drawNpc(ctx, 'scientist_down_0', 172, 342, 30);
  drawNpc(ctx, 'lass_down_0', 338, 344, 30);
  drawNpc(ctx, 'gentleman_down_0', 500, 340, 30);
  drawNpc(ctx, 'shopkeeper_m_down_0', 194, 584, 30);
  drawNpc(ctx, 'norman_down_0', 400, 706, 32);
  const walk = (t * 60) % 840;
  const wx = walk <= 420 ? 60 + walk : 480 - (walk - 420);
  drawNpc(ctx, `youngster_${walk <= 420 ? 'right' : 'left'}_${[0, 1, 0, 2][Math.floor(t * 6) % 4]}`, wx, 398, 30);

  // the south pond — sand shore ring, water inset, a boulder sunning itself
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(140, 648, 105, 40, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let y = 600; y < 696; y += 32) for (let x = 30; x < 260; x += 32) drawTile(ctx, TILE_SAND, x, y, 32, 32);
  ctx.beginPath();
  ctx.ellipse(140, 645, 88, 29, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let y = 600; y < 686; y += 32) for (let x = 50; x < 250; x += 32) drawTile(ctx, TILE_WATER, x, y, 32, 32);
  ctx.restore();
  drawTile(ctx, TILE_ROCK, 42, 606, 40, 43);
  drawTile(ctx, TREE_ROUND, 262, 652, 38, 38);
  drawTile(ctx, ROCK_SMALL, 480, 636, 44, 32);
  drawTile(ctx, FLOWER_YB, 266, 592, 26, 22);
  drawTile(ctx, FLOWER_PK, 500, 700, 26, 22);
  // the village green — a shady tree and flowerbeds filling the mid gap
  drawTile(ctx, TREE_TEAL, 300, 448, 52, 50);
  drawTile(ctx, FLOWER_YB, 360, 520, 26, 22);
  drawTile(ctx, FLOWER_PK, 250, 540, 26, 22);

  // the gym's challenge board — StS's rung chain under its roofline; the
  // building's door taps ping this card, the rungs themselves pick the heat
  drawAscLadder(ctx, t, ASC_BTN, Math.min(b.wins, 9), ascPick());
  ctx.restore();
}

// The crash-receipt instructions, in a card — the game collects no
// telemetry, so a report IS a screenshot plus the receipt line
export function drawBugCard(ctx: CanvasRenderingContext2D, seed: number | null) {
  scrim(ctx, 0.85);
  const r = { x: 40, y: 250, w: W - 80, h: 330 };
  uiPanel(ctx, r, 'REPORT A BUG');
  // tap-anywhere still closes; the × is the window's look, not a new target
  uiClose(ctx, { x: r.x + r.w - 34, y: r.y + 4, w: 28, h: 26 });
  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  const lines = [
    'We collect no telemetry — your report',
    'IS the log. To file one:',
    '',
    '1. Screenshot what broke (a crash',
    '    paints its own receipt).',
    '2. Include the line below.',
    "3. Note what you tapped last.",
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, r.y + 78 + i * 20));
  ctx.font = font(9);
  ctx.fillStyle = GOLD;
  ctx.fillText(seed != null ? `SEED ${seed} · ${__BUILD__}` : `BUILD ${__BUILD__}`, W / 2, r.y + 250);
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('post it where you found the build', W / 2, r.y + 276);
  ctx.fillText('tap anywhere to close', W / 2, r.y + r.h - 18);
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
  helpArrow(ctx, mx + ux * 24, my + uy * 24, fx - ux * 16, fy - uy * 16, INK, [3, 7]);
  ctx.strokeStyle = GOLD;
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
  ctx.fillStyle = GOLD;
  ctx.fillRect(bx + bw * 0.68, by - 2, 2, 10);
  ctx.fillRect(bx + bw * 0.84 - 2, by - 2, 2, 10);
}

function demoBump(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const ax = x + w * 0.16, ay = y + h * 0.72;
  const bx = x + w * 0.48, by = y + h * 0.3;
  const ex = x + w * 0.82, ey = y + h * 0.62;
  helpArrow(ctx, ax + 16, ay - 18, bx - 14, by + 18, INK, [3, 6]);
  helpArrow(ctx, bx + 16, by + 10, ex - 18, ey - 8, GOLD, [3, 6]);
  drawMon(ctx, 25, ax, ay, 42); // you
  drawMon(ctx, 7, bx, by, 42); // ally — the bumper
  drawMon(ctx, 19, ex, ey, 44); // enemy
  // super burst on the enemy
  ctx.strokeStyle = GOLD;
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
    ctx.fillStyle = k < 3 ? GOLD : '#d0d0c8';
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
    ctx.fillStyle = INK;
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
  helpArrow(ctx, mx + 30, my, bx - 22, by, INK, [3, 6]);
}

function demoClimb(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const n = 9, gap = (w * 0.7) / (n - 1), x0 = x + w * 0.15, my = y + h * 0.5;
  for (let i = 0; i < n; i++) {
    const px = x0 + i * gap;
    const gym = (i + 1) % 3 === 0;
    ctx.fillStyle = i < 3 ? GOLD : '#3a4066';
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
    ctx.fillStyle = INK;
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
  ctx.fillStyle = PAPER;
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
// modal corner targets get the full pad — nothing else hit-tests up there
export const HELP_CLOSE_HIT = { x: HELP_CLOSE.x - 8, y: HELP_CLOSE.y - 8, w: 56, h: 56 };
// re-arms the kinetic battle coach — top-left, kept narrow to clear the title
export const HELP_TUT = { x: HELP_PANEL.x + 14, y: HELP_PANEL.y + 12, w: 96, h: 40 };

export function drawHelp(ctx: CanvasRenderingContext2D, page: number, coachArmed = false, welcome = false) {
  const r = HELP_PANEL;
  scrim(ctx);
  uiPanel(ctx, r, 'HOW TO PLAY', { rad: 14 });

  ctx.textAlign = 'center';
  if (welcome) {
    ctx.font = fontB(9);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('your first fight teaches the pull — this deck is the manual', r.x + r.w / 2, r.y + 56);
  }

  uiClose(ctx, HELP_CLOSE);

  // TUTORIAL pill — re-arms the in-battle coach (ghost pull + field beats).
  // It rides the title band like the X chip: dark chip, parch edge.
  roundRect(ctx, HELP_TUT.x, HELP_TUT.y, HELP_TUT.w, HELP_TUT.h, 10);
  ctx.fillStyle = coachArmed ? '#16301c' : INK;
  ctx.fill();
  ctx.strokeStyle = coachArmed ? '#6fdc6f' : PARCH;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = fontB(9);
  ctx.fillStyle = coachArmed ? '#9fe89f' : PARCH;
  ctx.fillText(coachArmed ? 'COACH ON' : '▶ TUTORIAL', HELP_TUT.x + HELP_TUT.w / 2, HELP_TUT.y + 25);

  // two roomy cards per page — bigger demos than the old scroll ever showed
  HELP_PAGES[page].secs.forEach((si, slot) => {
    const s = HELP_SECTIONS[si];
    const sy = r.y + HELP_HEAD + 14 + slot * 336;
    const dx = r.x + 22, dw = r.w - 44;
    ctx.font = font(11);
    ctx.fillStyle = INK;
    ctx.fillText(s.title, r.x + r.w / 2, sy + 12);

    const dy = sy + 20;
    uiWindow(ctx, { x: dx, y: dy, w: dw, h: 210 }, { shadow: false });
    ctx.save();
    roundRect(ctx, dx, dy, dw, 210, 8);
    ctx.clip();
    s.demo(ctx, dx, dy, dw, 210);
    ctx.restore();

    ctx.font = fontB(9);
    ctx.fillStyle = INK;
    s.lines.forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, dy + 234 + li * 16));
  });

  // footer nav: ‹ › arrows flank the page dots — same dots, new chrome
  ctx.font = font(14);
  ctx.fillStyle = page > 0 ? INK : INK_FAINT;
  ctx.fillText('‹', HELP_PREV.x + HELP_PREV.w / 2, HELP_PREV.y + 22);
  ctx.fillStyle = page < HELP_PAGE_COUNT - 1 ? INK : INK_FAINT;
  ctx.fillText('›', HELP_NEXT.x + HELP_NEXT.w / 2, HELP_NEXT.y + 22);
  for (let i = 0; i < HELP_PAGE_COUNT; i++) {
    ctx.fillStyle = i === page ? GOLD : INK_FAINT;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2 + (i - (HELP_PAGE_COUNT - 1) / 2) * 16, HELP_PREV.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`${HELP_PAGES[page].name} — swipe or tap ‹ › · outside closes`, r.x + r.w / 2, r.y + r.h - 8);
}

// --- dex overlay: caught mons only — a real dex doesn't list what you ---
// --- haven't caught; the count is the only hint at what's out there -------
// home-tab card rects — the same _BTN names the hit tests know, re-homed to
// the cards the tab bodies draw. SHOP owns the hatcher hero + spark deal;
// MONS owns dex / line-sets / catches; TOWN owns the 2-col grid + ASC + HALL.
export const HATCH_BTN = { x: 30, y: 210, w: W - 60, h: 250 };
export const DEAL_BTN = { x: 30, y: HATCH_BTN.y + HATCH_BTN.h + 16, w: W - 60, h: 170 };
export const DEX_BTN = { x: 30, y: 230, w: W - 60, h: 120 };
export const SETS_BTN = { x: 30, y: DEX_BTN.y + DEX_BTN.h + 16, w: W - 60, h: 160 };
// the partners strip upgrades from LATEST CATCHES once any bond exists —
// tapping it browses the dex like the other MONS cards
export const PARTNERS_BTN = { x: 30, y: SETS_BTN.y + SETS_BTN.h + 16, w: W - 60, h: 160 };
// the squad strip — parked climb's team when one's banked, else the rival
// echo or the hall's top lineup; a parked squad's tap jumps to CLIMB
export const TEAM_BTN = { x: 30, y: PARTNERS_BTN.y + PARTNERS_BTN.h + 16, w: W - 60, h: 118 };

// which mon a partners-strip tap is aiming at — null below the sprite row,
// where a tap should just browse the dex
export function partnersStripAt(x: number, y: number): number | null {
  const s = PARTNERS_BTN;
  if (y < s.y + 36) return null;
  const partners = topBond(3);
  const ids = partners.length ? partners.map((p) => p.id) : dexRecent(3);
  if (!ids.length) return null;
  const i = Math.round((x - (s.x + s.w / 2)) / 150 + (ids.length - 1) / 2);
  return i >= 0 && i < ids.length ? ids[i] : null;
}
// TOWN's hit rects are building footprints — door + roof + its sign, so a
// tap anywhere on a structure opens its overlay. GYM sits above the asc
// card; its door taps ping the ladder below rather than open a screen.
export const LAB_BTN = { x: 44, y: 192, w: 132, h: 156 };
export const TASKS_BTN = { x: 48, y: 426, w: 156, h: 182 };
export const ACH_BTN = { x: 362, y: 164, w: 142, h: 158 };
export const BOARD_BTN = { x: 194, y: 198, w: 156, h: 156 };
export const GYM_HIT = { x: 316, y: 522, w: 164, h: 180 };
export const ASC_BTN = { x: 30, y: 708, w: W - 60, h: 122 };

// ASCENSION's rung track — cells 0..9 (0 = the base climb) in one row.
// StS names each rung's new modifier under the pick; locked rungs stay
// visible but dim so the next win's prize is always on screen.
const ASC_CELL_W = 38;
const ASC_CELL_GAP = 8;
const ASC_NCELLS = ASC_MODS.length + 1;

export function ascCellRect(i: number) {
  const w = ASC_NCELLS * ASC_CELL_W + (ASC_NCELLS - 1) * ASC_CELL_GAP;
  return { x: ASC_BTN.x + (ASC_BTN.w - w) / 2 + i * (ASC_CELL_W + ASC_CELL_GAP), y: ASC_BTN.y + 42, w: ASC_CELL_W, h: 32 };
}

export function hitAscCell(x: number, y: number): number {
  if (!inRect(x, y, ASC_BTN)) return -1;
  for (let i = 0; i < ASC_NCELLS; i++) if (inRect(x, y, ascCellRect(i))) return i;
  return -1;
}

// a tap on a locked rung flashes the lock hint under the track for ~1.5s
let ascDeny = { i: -1, t: -10 };
export function noteAscDeny(i: number, t: number) {
  ascDeny = { i, t };
}
// a gym-door tap pings the board — a gold rim pulse says the rungs answer
let ascPingT = -10;
export function noteAscPing(t: number) {
  ascPingT = t;
}

function drawAscLadder(ctx: CanvasRenderingContext2D, t: number, r: { x: number; y: number; w: number; h: number }, cap: number, pick: number) {
  uiPanel(ctx, r, 'ASCENSION', { rad: 12, sub: cap ? `LV ${cap}/9` : 'LOCKED' });
  if (t - ascPingT < 0.9) {
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 12);
    rim(ctx, r, 12, GOLD, 3);
    ctx.restore();
  }

  // the track behind the rungs
  const c0 = ascCellRect(0), cN = ascCellRect(ASC_NCELLS - 1);
  ctx.fillStyle = '#d0d0c8';
  ctx.fillRect(c0.x + c0.w / 2, c0.y + c0.h / 2 - 1.5, cN.x + cN.w / 2 - (c0.x + c0.w / 2), 3);

  const denied = ascDeny.i >= 0 && t - ascDeny.t < 1.5 ? ascDeny.i : -1;
  for (let i = 0; i < ASC_NCELLS; i++) {
    const cr = ascCellRect(i);
    const sel = i === pick;
    const locked = i > cap;
    ctx.save();
    if (sel) ctx.translate(0, -3); // the picked rung rides proud of the track
    if (locked) ctx.globalAlpha = 0.45; // locked rungs dim to ghost windows
    uiWindow(ctx, cr, { rad: 7, shadow: false, ...(sel ? { tint: GOLD } : {}) });
    ctx.font = font(8);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(`${i}`, cr.x + cr.w / 2 + (sel ? 4 : 0), cr.y + cr.h / 2 + 5);
    if (sel) cursorTri(ctx, cr.x + 6, cr.y + cr.h / 2, t);
    ctx.restore();
    if (i === denied) {
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 10);
      roundRect(ctx, cr.x, cr.y, cr.w, cr.h, 7);
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // the modifier line — StS names each rung's new rule under the pick
  ctx.textAlign = 'center';
  if (denied >= 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = DANGER;
    ctx.fillText(`WIN A CLIMB — LV ${denied} IS LOCKED`, r.x + r.w / 2, r.y + 104);
  } else if (pick === 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(cap ? 'STANDARD RULES — THE BASE CLIMB' : 'STANDARD RULES — WIN A CLIMB TO HEAT UP', r.x + r.w / 2, r.y + 104);
  } else {
    const m = ASC_MODS[pick - 1];
    ctx.font = fontB(8);
    ctx.fillStyle = GOLD;
    ctx.fillText(`LV ${pick} · ${m.name.toUpperCase()}`, r.x + r.w / 2, r.y + 98);
    ctx.font = fontB(7);
    ctx.fillStyle = INK_SOFT;
    fitFont(ctx, m.desc.toUpperCase(), 7, r.w - 30);
    ctx.fillText(m.desc.toUpperCase(), r.x + r.w / 2, r.y + 114);
  }
}
// the hall IS the Poké Center building — same door as TOP RUNS, same board
export const HALL_BTN = BOARD_BTN;
// RAID: one boss card — today's shiny fight + its loaner trio — then the
// FIGHT pill the tab's tap target rides on
export const RAID_CARD = { x: 30, y: 230, w: W - 60, h: 340 };
export const RAID_FIGHT = { x: 30, y: RAID_CARD.y + RAID_CARD.h + 16, w: W - 60, h: 64 };
// the boss and its loaners are species — a tap deep-links the dex detail
// card, same contract as PARTNERS. Rects mirror drawRaidBody's layout.
export function raidMonAt(x: number, y: number): number | null {
  const r = RAID_CARD;
  if (!inRect(x, y, r)) return null;
  const bcx = r.x + r.w / 2;
  if (inRect(x, y, { x: bcx - 84, y: r.y + 56, w: 168, h: 180 })) return raidPick().id;
  const loans = raidTeam();
  for (let i = 0; i < loans.length; i++) {
    const cx = bcx + (i - 1) * 110;
    if (inRect(x, y, { x: cx - 52, y: r.y + 244, w: 104, h: 88 })) return loans[i].id;
  }
  return null;
}
const DEX_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
// the dex is a one-entry-per-row register now — dexScrollMax's math is
// frozen, so these consts describe a row: 1 entry per row, 44px tall
const DEX_COLS = 1;
const DEX_CELL = 44;
const DEX_HEAD = 66;

export function dexScrollMax() {
  const rows = Math.ceil(dexIds().length / DEX_COLS);
  return Math.max(0, rows * DEX_CELL - (DEX_PANEL.h - DEX_HEAD - 36));
}

export function drawDex(ctx: CanvasRenderingContext2D, scroll: number) {
  const r = DEX_PANEL;
  const dexList = dexIds(); // one parse a frame — seen count + charm both read it
  const dexN = dexList.length;
  scrim(ctx);
  uiPanel(ctx, r, `POKÉDEX ${dexN}/${CATCHABLE}`, { rad: 14 });
  // tap-anywhere still closes — the chip is the invite, not the mechanism
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });

  // second header fact: set-bounty progress — gold when a claim waits
  const setsN = setsReady().length;
  const linesDone = setProgress().filter((p) => p.have === p.need).length;
  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = setsN ? GOLD : INK_FAINT;
  ctx.fillText(
    `${Math.round((dexN / CATCHABLE) * 100)}% FOUND · ${linesDone}/${EVO_LINES.length} LINES${setsN ? ` · ${setsN} SET BONUS${setsN > 1 ? 'ES' : ''} READY` : ''}`,
    r.x + r.w / 2,
    r.y + 57,
  );

  // the register: Gen-3 dex canon — a scrolling list, icon + name left,
  // dex number and typing right. One entry per row; DEX_CELL is the row pitch.
  const seen = new Set(dexList);
  const shinies = new Set(shinyIds());
  const rows = DEX_ALL.filter((def) => seen.has(def.id)); // dexRowAt filters the same way — indexes must match
  const viewH = r.h - DEX_HEAD - 36;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + DEX_HEAD, r.w - 16, viewH);
  ctx.clip();
  // the clip already hides off-band rows — draw only the visible index
  // range instead of a uiRow + sprite per caught species per frame
  const lo = Math.max(0, Math.floor(scroll / DEX_CELL) - 1);
  const hi = Math.min(rows.length - 1, Math.ceil((scroll + viewH) / DEX_CELL));
  for (let i = lo; i <= hi; i++) {
    const def = rows[i];
    const y = r.y + DEX_HEAD + i * DEX_CELL - scroll;
    const row = { x: r.x + 16, y, w: r.w - 32, h: DEX_CELL - 6 };
    drawMon(ctx, def.id, row.x + 22, row.y + row.h / 2 + 2, 30);
    const bl = bondLv(def.id);
    uiRow(
      ctx,
      { x: row.x + 44, y: row.y, w: row.w - 44, h: row.h },
      def.name.toUpperCase(),
      { right: `#${def.id} · ${`${def.type}${def.type2 ? `/${def.type2}` : ''}`.toUpperCase()}${bl ? ` · BOND ${bl}` : ''}` },
    );
    if (shinies.has(def.id)) { // a caught shiny earns the gold star
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
      ctx.fillStyle = GOLD;
      ctx.fillText('★', row.x + 38, row.y + 13);
    }
    ctx.strokeStyle = 'rgba(90,98,136,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(row.x + 6, y + DEX_CELL - 5);
    ctx.lineTo(row.x + row.w - 6, y + DEX_CELL - 5);
    ctx.stroke();
  }
  ctx.restore();
  // scroll thumb — a 649-row register needs a position read, same idiom as
  // the completion bars: a slim rail in the row/panel margin, gold thumb
  const total = rows.length * DEX_CELL;
  if (total > viewH) {
    const rail = { x: r.x + r.w - 11, y: r.y + DEX_HEAD + 4, w: 4, h: viewH - 8 };
    ctx.fillStyle = 'rgba(12,16,32,0.4)';
    roundRect(ctx, rail.x, rail.y, rail.w, rail.h, 2);
    ctx.fill();
    const th = Math.max(24, (viewH / total) * rail.h);
    const ty = rail.y + (scroll / dexScrollMax()) * (rail.h - th);
    ctx.fillStyle = GOLD;
    roundRect(ctx, rail.x, ty, rail.w, th, 2);
    ctx.fill();
  }
  if (!seen.size) {
    ctx.font = font(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('NO CATCHES YET', r.x + r.w / 2, r.y + r.h / 2);
  }

  // the completion milestone is the promise that keeps hunters grinding
  ctx.font = fontB(8);
  if (dexN >= SHINY_CHARM_AT) {
    ctx.fillStyle = GOLD;
    ctx.fillText('★ SHINY CHARM: shinies are twice as common ★', r.x + r.w / 2, r.y + r.h - 26);
  } else {
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`${SHINY_CHARM_AT - dexN} more catches for the SHINY CHARM (x2 shinies)`, r.x + r.w / 2, r.y + r.h - 26);
  }
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('tap a row for its card · catches join future draft pools · tap to close', r.x + r.w / 2, r.y + r.h - 14);
}

// a tap on a register row resolves to its species — the detail card's door
export function dexRowAt(x: number, y: number, scroll: number): number | null {
  const r = DEX_PANEL;
  if (x < r.x + 8 || x > r.x + r.w - 8 || y < r.y + DEX_HEAD || y > r.y + r.h - 36) return null;
  const seen = new Set(dexIds());
  const list = DEX_ALL.filter((def) => seen.has(def.id));
  const i = Math.floor((y - r.y - DEX_HEAD + scroll) / DEX_CELL);
  return list[i]?.id ?? null;
}

// the mon detail card — a dex row's whole story: portrait, typing, role and
// signature move, base stats, its evolution line, and where its bond stands
export function drawDexDetail(ctx: CanvasRenderingContext2D, id: number) {
  const def = speciesById(id);
  if (!def) return;
  const r = { x: 44, y: 150, w: W - 88, h: 610 };
  scrim(ctx, 0.55);
  uiPanel(ctx, r, def.name.toUpperCase(), { rad: 14, sub: `#${id}` });
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });
  const cx = r.x + r.w / 2;
  const shiny = shinyIds().includes(id);

  // hero — sprite on a type-tinted pad; a caught shiny shows its alt palette
  const cy = r.y + 116;
  ctx.fillStyle = `${TYPE_COLOR[def.type]}2e`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 44, 84, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  monShadow(ctx, cx, cy + 38, 96);
  try {
    if (shiny) drawShiny(ctx, id, cx, cy, 96);
    else drawMon(ctx, id, cx, cy, 96);
  } catch {
    void loadSprite(id);
  }
  ctx.textAlign = 'center';
  if (shiny) {
    ctx.font = font(14);
    ctx.fillStyle = GOLD;
    ctx.fillText('★', cx + 58, cy - 44);
  }

  // typing chips under the portrait
  const types = [def.type, ...(def.type2 ? [def.type2] : [])];
  types.forEach((ty, i) => {
    const tx = cx - (types.length * 92 - 8) / 2 + i * 92;
    roundRect(ctx, tx, r.y + 178, 84, 18, 9);
    ctx.fillStyle = TYPE_COLOR[ty];
    ctx.fill();
    ctx.font = fontB(7);
    ctx.fillStyle = '#fff';
    ctx.fillText(ty.toUpperCase(), tx + 42, r.y + 191);
  });

  // the career line — bond level, progress to the next rung, LV pips
  void loadItem('friend-ball');
  const pts = bondOf(id), lv = bondLv(id);
  const fb = itemSprite('friend-ball');
  if (fb) ctx.drawImage(fb, r.x + 24, r.y + 208, 18, 18);
  ctx.textAlign = 'left';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_SOFT;
  const nxt = BOND_LEVELS[lv];
  const luckBit = Math.floor(lv / 2) ? ` · +${Math.floor(lv / 2)} LUCK` : '';
  ctx.fillText(pts ? `BOND LV${lv} · ${nxt ? `${pts}/${nxt}` : 'MAX'} PTS${luckBit}` : 'FIELD IT TO BOND', r.x + 50, r.y + 222);
  for (let p = 0; p < BOND_LEVELS.length; p++) {
    ctx.fillStyle = p < lv ? GOLD : '#d8d8d0';
    ctx.beginPath();
    ctx.arc(r.x + r.w - 28 - (BOND_LEVELS.length - 1 - p) * 16, r.y + 218, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // role + signature move, with the flags that change arena behavior
  ctx.textAlign = 'center';
  ctx.font = font(9);
  ctx.fillStyle = INK;
  ctx.fillText(`${roleOf(def)} · ${moveOf(id, def.type).toUpperCase()}`, cx, r.y + 252);
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
  fitFont(ctx, superDesc(id, def.type).toUpperCase(), 7, r.w - 48);
  ctx.fillText(superDesc(id, def.type).toUpperCase(), cx, r.y + 270);
  const traits = [
    def.healer && 'BUMP HEALS THE TEAM',
    def.pierce && 'PIERCES FOES',
    def.melee && 'LUNGES AT CONTACT',
    def.copy && "COPIES BUMPERS' SUPERS",
    def.taunt && 'SHIELDS ALLIES',
    def.cursed && 'DEATH SLOWS ENEMY SUPERS',
  ].filter(Boolean) as string[];
  if (traits.length) {
    ctx.fillStyle = ACCENT;
    fitFont(ctx, traits.join(' · '), 7, r.w - 48);
    ctx.fillText(traits.join(' · '), cx, r.y + 288);
  }

  // base stats in canon order — bars scale to ~200, a strong base read
  const stats: [string, number][] = [
    ['HP', def.stats.hp],
    ['ATK', def.stats.atk],
    ['DEF', def.stats.def],
    ['SPA', def.stats.spa],
    ['SPD', def.stats.spd],
    ['SPE', def.stats.spe],
  ];
  stats.forEach(([name, v], i) => {
    const y = r.y + 312 + i * 26;
    ctx.textAlign = 'left';
    ctx.font = fontB(8);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(name, r.x + 24, y + 9);
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(r.x + 68, y + 2, r.w - 140, 8);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(r.x + 68, y + 2, Math.max(3, (r.w - 140) * Math.min(1, v / 200)), 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.fillText(`${v}`, r.x + r.w - 24, y + 9);
  });
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`BASE TOTAL ${stats.reduce((a, s) => a + s[1], 0)}`, r.x + r.w - 24, r.y + 312 + 6 * 26 + 12);

  // the family row — caught bright, the viewed mon pinned gold
  const line = EVO_LINES.find((l) => l.ids.includes(id));
  const ly = r.y + r.h - 96;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(line ? 'EVOLUTION LINE' : 'NO EVOLUTION LINE', r.x + 24, ly);
  if (line) {
    const owned = new Set(dexIds());
    line.ids.slice(0, 7).forEach((eid, i) => {
      const ix = r.x + 44 + i * 56;
      ctx.save();
      ctx.globalAlpha = owned.has(eid) ? 1 : 0.22;
      try {
        drawMon(ctx, eid, ix, ly + 36, 40);
      } catch {
        void loadSprite(eid);
      }
      ctx.restore();
      if (eid === id) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(ix, ly + 62, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('TAP TO CLOSE', cx, r.y + r.h - 14);
}

// --- hall of fame: the top climbs this device has logged, score-ranked ---
const BOARD_ROW = 74;
const BOARD_HEAD = 84;

export function drawBoard(ctx: CanvasRenderingContext2D) {
  const r = DEX_PANEL;
  scrim(ctx);
  uiPanel(ctx, r, 'HALL OF FAME', { rad: 14 });
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });

  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('the top climbs logged on this device — score rules all', r.x + r.w / 2, r.y + 57);

  const list = board();
  if (!list.length) {
    fitFont(ctx, 'NO RUNS YET — CLIMB AND CLAIM A SPOT', 10, r.w - 40);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('NO RUNS YET — CLIMB AND CLAIM A SPOT', r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + BOARD_HEAD, r.w - 16, r.h - BOARD_HEAD - 36);
  ctx.clip();
  list.forEach((e, i) => {
    const y = r.y + BOARD_HEAD + i * BOARD_ROW;
    const rx = r.x + 14, rw = r.w - 28;
    // the leader's row wears the gold slab — the medal stays content
    const line = `${e.w ? 'CLEARED' : `STAGE ${e.st}/${TOTAL_STAGES}`}${e.asc ? ` · ASC ${e.asc}` : ''}`;
    const d = new Date(e.when);
    uiRow(
      ctx,
      { x: rx, y, w: rw, h: BOARD_ROW - 10 },
      `#${i + 1}  ${e.s.toLocaleString('en-US')}`,
      { hot: i === 0, sub: `${line} · ${d.getMonth() + 1}/${d.getDate()}` },
    );
    // the run's lineup marches the right edge — the plaque's face
    e.team.slice(0, 4).forEach((id, ti) => {
      try {
        drawMon(ctx, id, rx + rw - 110 + ti * 28, y + BOARD_ROW / 2 - 6, 26);
      } catch {
        /* sprite not warmed */
      }
    });
    if (i) { // the ledger rule under idle rows
      ctx.strokeStyle = 'rgba(90,98,136,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + 6, y + BOARD_ROW - 10);
      ctx.lineTo(rx + rw - 6, y + BOARD_ROW - 10);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
  });
  ctx.restore();

  // the lifetime ledger under the plaques — same muted small print
  const bb = best();
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
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
  scrim(ctx);

  const got = unlockedAch();
  uiPanel(ctx, r, `TROPHIES ${got.size}/${ACHIEVEMENTS.length}`, { rad: 14 });
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });

  ctx.textAlign = 'center';

  // the badge case: one canon badge per leader, mounted on a dark
  // octagon socket — earned glyphs light in their badge color
  const held = gymBadges();
  ctx.font = font(9);
  ctx.fillStyle = INK_FAINT;
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
    ctx.fillStyle = '#e8e8e0';
    ctx.fill();
    ctx.strokeStyle = has ? GOLD : '#3a4370';
    ctx.lineWidth = 2;
    ctx.stroke();
    const img = itemSprite(`badges/${b.icon}`);
    ctx.globalAlpha = has ? 1 : 0.28; // unearned slots read as indentations
    if (img) ctx.drawImage(img, cx - 15, cy - 15, 30, 30);
    ctx.globalAlpha = 1;
    ctx.font = fontB(6.5);
    ctx.fillStyle = has ? INK : INK_FAINT;
    ctx.fillText(b.name.replace(' BADGE', ''), cx, cy + 33);
  });

  // locked trophies get a live fraction — the goal-gradient on every open loop
  const dexN = dexIds().length;
  const progress: Record<string, [number, number] | undefined> = {
    collector: [dexN, 50],
    living: [dexN, CATCHABLE],
    triple: [best().wins, 3],
    league: [held.size, BADGES.length],
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
    ctx.save();
    if (!has) ctx.globalAlpha = 0.5; // locked trophies read as ghosted rows
    // the medallion: lit star when earned, hollow ring when not
    ctx.strokeStyle = has ? GOLD : '#3a4370';
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
        ctx.fillStyle = GOLD;
        fillStar(ctx, r.x + 34, y + ACH_ROW / 2 - 4, 8);
      }
    }
    uiRow(ctx, { x: r.x + 50, y: y - 2, w: r.w - 70, h: ACH_ROW - 8 }, a.name, { sub: a.desc });
    ctx.restore();
    const prog = !has && progress[a.id];
    if (prog) { // live fractions stay legible — the goal-gradient on open loops
      ctx.textAlign = 'right';
      ctx.font = fontB(9);
      ctx.fillStyle = prog[0] >= prog[1] * 0.7 ? GOLD : INK_FAINT; // close loops read gold
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
  ctx.fillStyle = INK_FAINT;
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
  tMax: number; // current phase's length — main.ts sizes it to the pull's hype
  results: PullResult[]; // the pull queue — reveal + results read it
  i: number; // which result the reveal is on (10-pull tap-through)
  sparkScroll: number; // SPARK grid scroll — only live while phase is 'idle'
  label?: string; // the summary's header — 'RAID CLEARED' rides the same cards
  dexPay?: number; // dex-milestone stars this pull banked — the summary names the payout
  rookiePay?: number; // rookie-ladder stars this pull banked — same line
}

// shared modal frame — hatcher and lab both ride it; main.ts needs it for
// the modal-inside/outside tap test
export const HATCH_PANEL = DEX_PANEL;
const FEAT_BAND = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 76, w: HATCH_PANEL.w - 32, h: 110 };
export const PULL1_BTN = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 198, w: 218, h: 64 };
export const PULL10_BTN = { x: HATCH_PANEL.x + 246, y: HATCH_PANEL.y + 198, w: 218, h: 64 };
const PITY_BAR = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 288, w: HATCH_PANEL.w - 32, h: 18 };
const RATE_BAND = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 314, w: HATCH_PANEL.w - 32, h: 54 };
const SPARK_VIEW = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 406, w: HATCH_PANEL.w - 32, h: 394 };
const SPARK_COLS = 4;
const SPARK_CELL_W = SPARK_VIEW.w / SPARK_COLS;
const SPARK_CELL_H = 118;
const HATCH_MODAL = { x: 80, y: 244, w: W - 160, h: 400 };
export const SKIP_PULL_BTN = { x: HATCH_MODAL.x + HATCH_MODAL.w - 92, y: HATCH_MODAL.y + 12, w: 80, h: 30 };

// the wallet pill — star pieces buy pulls, dust buys sparks outright
function balanceChip(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  starN: number,
  dust?: number,
) {
  // the wallet is a small dark window-chip — same frame language as the panel
  uiWindow(ctx, r, { dark: true, rad: r.h / 2, shadow: false });
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
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(`${starN}`, tx, r.y + r.h / 2 + 3.5);
  tx += ctx.measureText(`${starN}`).width + 8;
  if (dust != null) {
    // the second wallet reads cool — a small diamond, not the star icon
    const mid = r.y + r.h / 2 - 1;
    ctx.fillStyle = '#9df0ff';
    ctx.beginPath();
    ctx.moveTo(tx + 4, mid - 5);
    ctx.lineTo(tx + 8, mid);
    ctx.lineTo(tx + 4, mid + 5);
    ctx.lineTo(tx, mid);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.fillText(`${dust}`, tx + 12, r.y + r.h / 2 + 3.5);
  }
}

// a dust price — a tiny dark window-chip: cyan diamond + count, centered
function dustTag(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, textColor: string) {
  ctx.font = fontB(7);
  const label = `${n}`;
  const tw = ctx.measureText(label).width;
  const x0 = cx - (tw + 20) / 2;
  uiWindow(ctx, { x: x0, y: cy - 12, w: tw + 20, h: 18 }, { dark: true, rad: 9, shadow: false });
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(x0 + 8.5, cy - 7);
  ctx.lineTo(x0 + 12, cy - 3);
  ctx.lineTo(x0 + 8.5, cy + 1);
  ctx.lineTo(x0 + 5, cy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(label, x0 + 15, cy);
}

// the price INSIDE a pull pill — a dark plaque: star icon + count, or the
// free-pull tag when cost is null. The pill's own sub-line printed too dim
// for the shop's one job, so the price gets ink of its own.
function pricePlaque(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  cost: number | null,
  ok: boolean,
) {
  ctx.font = fontB(9);
  const label = cost == null ? 'FREE · 1/DAY' : `${cost}`;
  const pw = ctx.measureText(label).width + (cost == null ? 20 : 32);
  const px = b.x + b.w / 2 - pw / 2;
  const py = b.y + b.h - 28;
  // a tiny dark window — the afford rim traces the frame's inner edge
  uiWindow(ctx, { x: px, y: py, w: pw, h: 20 }, { dark: true, rad: 10, shadow: false });
  rim(ctx, { x: px, y: py, w: pw, h: 20 }, 10, ok ? '#ffe89d' : '#ff6b6b', 1);
  let tx = px + 10;
  if (cost != null) {
    const star = itemSprite('star-piece');
    if (star) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(star, px + 7, py + 3, 14, 14);
      ctx.restore();
    }
    tx = px + 24;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = ok ? '#ffe89d' : '#ff9d9d';
  ctx.fillText(label, tx, py + 14.5);
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
  // the view's last pixels can index a phantom column, and a negative
  // scroll (over-drag) a phantom row — both return a wrong mon, not null
  if (col < 0 || col >= SPARK_COLS || row < 0) return null;
  return PULLABLE[row * SPARK_COLS + col] ?? null;
}

export function drawHatch(
  ctx: CanvasRenderingContext2D,
  s: HatchState,
  info: { stars: number; dust: number; pityIn: number; featured: SpeciesDef | null; free: boolean; flash?: string; armedId?: number; armedFrac?: number },
) {
  const r = HATCH_PANEL;
  void loadItem('star-piece');
  void loadItem('poke-ball');
  scrim(ctx, 0.82);

  // the whole shop is one window — the title lives in its INK band and the
  // pool count rides the band's right side as the sub
  const dexSet = new Set(dexIds());
  const poolFound = PULLABLE.reduce((n, d) => n + (dexSet.has(d.id) ? 1 : 0), 0);
  uiPanel(ctx, r, 'THE HATCHER', { sub: `${poolFound} / ${PULLABLE.length} FOUND` });

  // the strip between band and featured card — a claimable line-set bounty
  // gets the loud gold chip left; the wallet counter sits right
  ctx.textAlign = 'left';
  const ready = setsReady();
  if (ready.length) {
    const sl = ready.length > 1 ? `${ready.length} SET BONUSES READY` : 'SET BONUS READY';
    chip(ctx, r.x + 16, r.y + 45, sl, { bg: GOLD, fg: INK, fontPx: 8 });
  } else {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('EVERY PULL GROWS YOUR DRAFT POOL', r.x + 16, r.y + 58);
  }
  balanceChip(ctx, { x: r.x + r.w - 176, y: r.y + 40, w: 160, h: 28 }, info.stars, info.dust);

  // the day's featured rate-up — a full-bleed band tinted by the mon's own
  // type: a bigger stage, the name up front, and what "featured" buys you
  const f = info.featured;
  const fc = f ? TYPE_COLOR[f.type] : '#8a5cff';
  // a content card inside the window: the type tint keeps its gradient face,
  // the frame is the double-frame canon and a hairline of the tint rings it
  uiWindow(ctx, FEAT_BAND, { rad: 10 });
  ctx.save();
  roundRect(ctx, FEAT_BAND.x + 7, FEAT_BAND.y + 7, FEAT_BAND.w - 14, FEAT_BAND.h - 14, 5);
  ctx.clip();
  const fg = gradFor(ctx, `feat:${fc}`, (cc) => {
    const lg = cc.createLinearGradient(0, FEAT_BAND.y, 0, FEAT_BAND.y + FEAT_BAND.h);
    lg.addColorStop(0, mixHex(fc, PAPER, 0.22));
    lg.addColorStop(1, mixHex(fc, PAPER, 0.8));
    return lg;
  });
  ctx.fillStyle = fg;
  ctx.fillRect(FEAT_BAND.x + 7, FEAT_BAND.y + 7, FEAT_BAND.w - 14, FEAT_BAND.h - 14);
  stripes(ctx, { x: FEAT_BAND.x + 7, y: FEAT_BAND.y + 7, w: FEAT_BAND.w - 14, h: FEAT_BAND.h - 14 });
  ctx.restore();
  rim(ctx, FEAT_BAND, 10, fc, 1.5);
  if (f) {
    void loadSprite(f.id);
    // the stage — a type-tinted pedestal under a faint ball watermark
    const scx = FEAT_BAND.x + 68, scy = FEAT_BAND.y + FEAT_BAND.h / 2 + 2;
    ballGlyph(ctx, scx, scy - 4, 4.2, 'rgba(255,255,255,0.09)');
    ctx.fillStyle = `${fc}50`;
    ctx.beginPath();
    ctx.ellipse(scx, scy + 42, 62, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    monShadow(ctx, scx, scy + 4, 96);
    try {
      drawMon(ctx, f.id, scx, scy + Math.sin(s.t * 2.4) * 2.5, 96);
    } catch {
      /* sprite still warming */
    }
    const tx = FEAT_BAND.x + 140;
    ctx.textAlign = 'left';
    fitFont(ctx, f.name.toUpperCase(), 14, FEAT_BAND.x + FEAT_BAND.w - tx - 96);
    ctx.fillStyle = '#f8f4e4';
    ctx.fillText(f.name.toUpperCase(), tx, FEAT_BAND.y + 44);
    ctx.font = fontB(8);
    ctx.fillStyle = mixHex(fc, '#ffffff', 0.45);
    ctx.fillText(f.type2 ? `${f.type} · ${f.type2}`.toUpperCase() : f.type.toUpperCase(), tx, FEAT_BAND.y + 64);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('10× ODDS IN THE RARE+ POOL', tx, FEAT_BAND.y + 84);
    // the badge — FEATURED flags the corner, 10× is the band's one number
    chip(ctx, FEAT_BAND.x + FEAT_BAND.w - 61, FEAT_BAND.y + 10, 'FEATURED', { bg: INK, fg: PARCH });
    const odds = { x: FEAT_BAND.x + FEAT_BAND.w - 82, y: FEAT_BAND.y + FEAT_BAND.h / 2 - 12, w: 66, h: 50 };
    uiWindow(ctx, odds, { dark: true, rad: 10, shadow: false });
    rim(ctx, odds, 10, '#ffe89d', 1);
    ctx.textAlign = 'center';
    ctx.font = font(11);
    ctx.fillStyle = '#ffe89d';
    ctx.fillText('10×', FEAT_BAND.x + FEAT_BAND.w - 49, FEAT_BAND.y + FEAT_BAND.h / 2 + 10);
    ctx.font = fontB(6.5);
    ctx.fillStyle = PARCH;
    ctx.fillText('RATE-UP', FEAT_BAND.x + FEAT_BAND.w - 49, FEAT_BAND.y + FEAT_BAND.h / 2 + 27);
  } else {
    ctx.textAlign = 'center';
    ctx.font = font(10);
    ctx.fillStyle = INK;
    ctx.fillText('NO FEATURED PULL TODAY', FEAT_BAND.x + FEAT_BAND.w / 2, FEAT_BAND.y + FEAT_BAND.h / 2 + 4);
  }

  // the pulls — the shop's heroes. ×1 parchment, ×10 the gold MS ten-pull,
  // price as a dark plaque inside the pill so it reads at thumb distance.
  // A daily free pull turns ×1 gold and rings it in breathing light
  pill(ctx, PULL1_BTN, {
    c: info.free ? GOLD : INK,
    cd: info.free ? '#c8a44d' : '#aab0c8',
    tc: INK,
    label: '',
    disabled: !info.free && info.stars < PULL_COST,
  });
  pill(ctx, PULL10_BTN, {
    c: GOLD,
    cd: '#c8a44d',
    tc: INK,
    label: '',
    disabled: info.stars < PULL10_COST,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  fitFont(ctx, info.free ? 'FREE PULL' : 'PULL ×1', 11, PULL1_BTN.w - 28);
  ctx.fillText(info.free ? 'FREE PULL' : 'PULL ×1', PULL1_BTN.x + PULL1_BTN.w / 2, PULL1_BTN.y + 25);
  fitFont(ctx, 'PULL ×10', 11, PULL10_BTN.w - 28);
  ctx.fillText('PULL ×10', PULL10_BTN.x + PULL10_BTN.w / 2, PULL10_BTN.y + 25);
  pricePlaque(ctx, PULL1_BTN, info.free ? null : PULL_COST, info.free || info.stars >= PULL_COST);
  pricePlaque(ctx, PULL10_BTN, PULL10_COST, info.stars >= PULL10_COST);
  // the ten-pull's built-in discount — a corner tag kept inside the pill's
  // rounded silhouette (16px in from the edge, past the corner radius)
  ctx.font = fontB(7);
  const dv = ctx.measureText('−10%').width + 12;
  roundRect(ctx, PULL10_BTN.x + PULL10_BTN.w - dv - 16, PULL10_BTN.y + 8, dv, 15, 7);
  ctx.fillStyle = 'rgba(40,48,88,0.55)';
  ctx.fill();
  ctx.fillStyle = '#ffe89d';
  ctx.fillText('−10%', PULL10_BTN.x + PULL10_BTN.w - dv / 2 - 16, PULL10_BTN.y + 19);
  if (info.free) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(s.t * 5) * 0.3;
    ctx.strokeStyle = '#ffe89d';
    ctx.lineWidth = 2.5;
    roundRect(ctx, PULL1_BTN.x - 3, PULL1_BTN.y - 3, PULL1_BTN.w + 6, PULL1_BTN.h + 6, PULL1_BTN.h / 2 + 3);
    ctx.stroke();
    ctx.restore();
  }

  // pity — every Nth pull rolls rare+. Ten pips, one per pull, so the meter
  // reads as banked progress; the last pip keeps a gold outline — the prize
  // slot — and pityIn counting to 1 means the NEXT pull is the guarantee
  const done = PULL_PITY - info.pityIn;
  ctx.textAlign = 'center';
  ctx.font = font(9);
  ctx.fillStyle = info.pityIn <= 1 ? GOLD : INK_SOFT;
  ctx.fillText(
    info.pityIn <= 1 ? 'NEXT PULL IS A GUARANTEED RARE+' : `${info.pityIn} MORE PULLS TO A GUARANTEED RARE+`,
    W / 2,
    PITY_BAR.y - 6, // glyph tops stay clear of the pull pills' ink lip
  );
  const pgap = 4;
  const pseg = (PITY_BAR.w - pgap * (PULL_PITY - 1)) / PULL_PITY;
  for (let i = 0; i < PULL_PITY; i++) {
    const sx = PITY_BAR.x + i * (pseg + pgap);
    roundRect(ctx, sx, PITY_BAR.y, pseg, PITY_BAR.h, 4);
    if (i < done) {
      ctx.fillStyle = GOLD;
      ctx.fill();
    } else {
      ctx.fillStyle = '#e8e8e0';
      ctx.fill();
      ctx.strokeStyle = i === PULL_PITY - 1 ? GOLD : '#d0d0c8';
      ctx.lineWidth = i === PULL_PITY - 1 ? 1.5 : 1;
      ctx.stroke();
    }
  }

  // the odds, tiered — one glanceable rate card: tier name, the number big,
  // and a bar drawn to scale. Buckets read PULL_RATES straight so the print
  // can never drift from pullSpecies'; shiny rides every pull so it gets
  // its own cell with live odds. A payout flash borrows the slot
  if (s.phase === 'idle') {
    uiWindow(ctx, RATE_BAND, { rad: 8, shadow: false });
    if (info.flash) {
      ctx.textAlign = 'center';
      ctx.font = fontB(9);
      ctx.fillStyle = GOLD;
      ctx.fillText(info.flash, W / 2, RATE_BAND.y + RATE_BAND.h / 2 + 4);
    } else {
      const wknd = shinyOdds() > PULL_SHINY;
      const cells: [string, number, string][] = [
        ['COMMON', PULL_RATES.common, INK_SOFT],
        ['RARE', PULL_RATES.rare, '#5a9bf0'],
        ['EPIC', PULL_RATES.epic, '#f0b02f'],
        [wknd ? 'SHINY ×2' : 'SHINY', shinyOdds(), GOLD],
      ];
      const cw = RATE_BAND.w / cells.length;
      cells.forEach(([label, pct, color], i) => {
        const cx = RATE_BAND.x + i * cw;
        if (i) {
          ctx.strokeStyle = '#d0d0c8'; // hairline — dark navy shouts on paper
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + 0.5, RATE_BAND.y + 8);
          ctx.lineTo(cx + 0.5, RATE_BAND.y + RATE_BAND.h - 8);
          ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.font = fontB(7);
        ctx.fillStyle = color;
        ctx.fillText(label, cx + cw / 2, RATE_BAND.y + 16);
        ctx.font = font(10);
        ctx.fillStyle = i === 0 ? INK : color;
        ctx.fillText(`${Math.round(pct * 100)}%`, cx + cw / 2, RATE_BAND.y + 38);
        // the honest bar — odds drawn to scale across the cell's foot
        ctx.fillStyle = color;
        ctx.fillRect(cx + 10, RATE_BAND.y + RATE_BAND.h - 7, Math.max(3, (cw - 20) * pct), 3);
      });
    }
  }

  // SPARK — the dust shop: buy the species outright, owned ones tag IN DEX.
  // The pull show covers the whole face in 0.92 black — skip the shop's
  // sprites/deal rolls entirely once the theatre takes over
  if (s.phase === 'idle') {
  // the shelf gets its own ink band — a window header for the section
  uiBand(ctx, { x: SPARK_VIEW.x - 6, y: SPARK_VIEW.y - 36, w: SPARK_VIEW.w + 12, h: 16 }, 'SPARK EXCHANGE', { h: 16, rad: 5 });
  ctx.textAlign = 'center';
  ctx.font = fontB(6.5);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('buy a mon outright with dust — sparked or pulled, it joins the dex', W / 2, SPARK_VIEW.y - 4);

  const seen = new Set(dexIds());
  ctx.save();
  ctx.beginPath();
  ctx.rect(SPARK_VIEW.x - 4, SPARK_VIEW.y, SPARK_VIEW.w + 8, SPARK_VIEW.h);
  ctx.clip();
  const row0 = Math.max(0, Math.floor(s.sparkScroll / SPARK_CELL_H));
  const rowN = Math.ceil((s.sparkScroll + SPARK_VIEW.h) / SPARK_CELL_H);
  const deal = dealPick(); // one seeded roll a frame — dealCost re-rolled it per cell
  for (let i = row0 * SPARK_COLS; i < rowN * SPARK_COLS && i < PULLABLE.length; i++) {
    const def = PULLABLE[i];
    const cx = SPARK_VIEW.x + (i % SPARK_COLS) * SPARK_CELL_W;
    const cy = SPARK_VIEW.y + Math.floor(i / SPARK_COLS) * SPARK_CELL_H - s.sparkScroll;
    const owned = seen.has(def.id);
    const spTier = tierOf(def);
    const epic = spTier >= 3 || INVADER_IDS.has(def.id);
    const cell = { x: cx + 4, y: cy + 4, w: SPARK_CELL_W - 8, h: SPARK_CELL_H - 8 };
    const tcol = epic ? '#f0b02f' : spTier === 2 ? '#5a9bf0' : '#d0d0c8';
    // each shelf item is a small window — rare+ keeps its tint as a rim trace
    uiWindow(ctx, cell, { rad: 8, shadow: false });
    if (spTier >= 2) rim(ctx, cell, 8, tcol, 1.5);
    // a type-tinted floor pad — the cell's mon stands on its own color
    ctx.fillStyle = `${TYPE_COLOR[def.type]}26`;
    ctx.beginPath();
    ctx.ellipse(cell.x + cell.w / 2, cell.y + 60, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = owned ? 0.4 : 1;
    void loadSprite(def.id);
    try {
      drawMon(ctx, def.id, cell.x + cell.w / 2, cell.y + 34, 52);
    } catch {
      /* sprite still warming */
    }
    ctx.restore();
    // rare+ stock wears its tier as a corner flag — the rim color made words
    if (spTier >= 2) {
      ctx.font = fontB(6);
      const tl = epic ? 'EPIC' : 'RARE';
      const tw = ctx.measureText(tl).width + 8;
      ctx.fillStyle = tcol;
      ctx.fillRect(cell.x, cell.y, tw, 12);
      ctx.textAlign = 'left';
      ctx.fillStyle = PAPER_HI;
      ctx.fillText(tl, cell.x + 4, cell.y + 9);
    }
    ctx.textAlign = 'center';
    fitFontB(ctx, def.name.toUpperCase(), 8, cell.w - 10);
    ctx.fillStyle = owned ? INK_FAINT : INK;
    ctx.fillText(def.name.toUpperCase(), cell.x + cell.w / 2, cell.y + 74);
    if (owned) {
      // caught reads as a green tag, not a dim-out — the grid's owned state
      ctx.font = fontB(7);
      const ow = ctx.measureText('IN DEX').width + 26;
      const ox = cell.x + cell.w / 2 - ow / 2;
      roundRect(ctx, ox, cell.y + 84, ow, 16, 8);
      ctx.fillStyle = '#1d3524';
      ctx.fill();
      ctx.strokeStyle = '#6fdc6f';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = '#9fe89f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + 7, cell.y + 92);
      ctx.lineTo(ox + 10, cell.y + 95);
      ctx.lineTo(ox + 15, cell.y + 88);
      ctx.stroke();
      ctx.fillStyle = '#9fe89f';
      ctx.fillText('IN DEX', ox + ow / 2 + 4, cell.y + 96);
    } else {
      const isDeal = def.id === deal.id;
      // dealCost's −25% inlined against the frame's hoisted deal — calling
      // it per cell re-rolled dealPick (raidPick + featuredPull inside) 16×
      const cost = isDeal ? Math.ceil(dustCost(def) * 0.75) : dustCost(def);
      const armed = info.armedId === def.id;
      if (armed) {
        // two-tap confirm: pulse the rim, spend the price line on the cue,
        // and burn the window down a bottom strip
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(s.t * 10);
        roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 8);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        const cue = `TAP AGAIN · ◆${cost}`;
        fitFontB(ctx, cue, 9, cell.w - 26);
        ctx.textAlign = 'center';
        ctx.fillStyle = GOLD;
        ctx.fillText(cue, cell.x + cell.w / 2, cell.y + 92);
        // the armed row earns the handheld ▶ — its blink is the cursor's own
        cursorTri(ctx, cell.x + cell.w / 2 - ctx.measureText(cue).width / 2 - 11, cell.y + 88, s.t, GOLD);
        ctx.fillStyle = GOLD;
        ctx.fillRect(cell.x + 4, cell.y + cell.h - 5, (cell.w - 8) * Math.max(0, info.armedFrac ?? 0), 3);
      } else {
        dustTag(ctx, cell.x + cell.w / 2 - (isDeal ? 12 : 0), cell.y + 92, cost, info.dust >= cost ? ACCENT : '#ff6b6b');
      }
      if (isDeal && !armed) {
        // the struck list price beside the deal price — the bargain shows
        const wl = `${dustCost(def)}`;
        ctx.font = fontB(7);
        ctx.textAlign = 'left';
        ctx.fillStyle = INK_FAINT;
        const wx = cell.x + cell.w / 2 + 14;
        ctx.fillText(wl, wx, cell.y + 92);
        ctx.strokeStyle = INK_FAINT;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, cell.y + 89);
        ctx.lineTo(wx + ctx.measureText(wl).width, cell.y + 89);
        ctx.stroke();
        // the daily discount tab — a gold corner flag
        ctx.fillStyle = GOLD;
        ctx.fillRect(cell.x + cell.w - 36, cell.y, 36, 14);
        ctx.textAlign = 'center';
        ctx.font = fontB(7);
        ctx.fillStyle = INK;
        ctx.fillText('−25%', cell.x + cell.w - 18, cell.y + 10);
      }
    }
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('pulled or sparked mons join the dex + future drafts · tap outside to close', W / 2, r.y + r.h - 14);
  }

  // the pull show rides on top — dim the shop, modal carries the reveal
  if (s.phase !== 'idle') drawPullShow(ctx, s);
}

// --- pull theatre: the gacha cinematic ------------------------------------
// Shake charges on a letterboxed stage; the reveal's flash beat kicks the
// screen, then the mon flash-reveals under god-rays and burst rings.
// hype 0/1/2 = common / rare / epic-or-shiny — counts + palette scale it.
const SHOW_CY = 396; // stage center — text marquee hangs below it
const LB_H = 88; // letterbox bar height once fully closed
const LB_SLAM = 0.4; // seconds for the bars to slam shut
const FLASH_T = 0.34; // the silhouette→color beat inside the reveal
const PRISM = ['#ff6b6b', GOLD, '#7dff8a', '#6bb6ff', '#c05df0'];
const RAY_N = [0, 10, 16]; // god-ray wedges by hype
const BURST_N = [26, 46, 74]; // spark count on the flash beat by hype
const KICK = [0, 5, 10]; // screen-kick px on the flash beat by hype
const FLASH_A = [0.15, 0.3, 0.55]; // full-screen whiteout alpha by hype

// shake → reveal → results. Timing is main.ts's; everything here derives
// from s.t (phase-local seconds) and the result queue.
function drawPullShow(ctx: CanvasRenderingContext2D, s: HatchState) {
  if (s.phase === 'results') {
    drawPullSummary(ctx, s);
    return;
  }
  // the theatre runs the whole letterboxed screen — the modal stays parked
  ctx.fillStyle = 'rgba(4,6,14,0.92)';
  ctx.fillRect(0, 0, W, H);
  const res = s.results[s.i];
  const def = res && speciesById(res.id);
  const tier = def ? tierOf(def) : 0; // BST tier — invaders ride rarity 3 past it
  const hype = res ? (res.shiny || res.rarity >= 3 || tier >= 3 ? 2 : res.rarity === 2 || tier === 2 ? 1 : 0) : 0;
  const cx = W / 2;
  const cy = SHOW_CY;
  // the flash beat kicks the screen — a damped rattle for its first 0.4s
  const kick = s.phase === 'reveal' ? KICK[hype] * Math.max(0, 1 - s.t / 0.4) : 0;
  ctx.save();
  if (kick) ctx.translate(Math.sin(s.t * 97) * kick, Math.cos(s.t * 83) * kick);
  if (s.phase === 'shake') drawShakeScene(ctx, s, res, hype, cx, cy);
  else if (res && def) drawRevealScene(ctx, s, res, def, hype, cx, cy);
  ctx.restore();
  // the bars slam shut on s.t — a shake-skip or raid entry just finishes
  // the close inside the reveal; the summary draws its own sliding back out
  letterbox(ctx, clamp01(s.t / LB_SLAM));
}

// seeded hash — the reel's spark layouts can't Math.random or a seeded
// replay's visuals would flicker frame to frame
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const eo = (v: number) => 1 - (1 - v) * (1 - v); // ease-out quad
const bo = (v: number) => { // back-out — overshoots ~1.1 then settles at 1
  const c = 1.70158, u = v - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
// '#rrggbb' + alpha → '#rrggbbaa' — the palette stays hex, alpha rides along
const withA = (c: string, a: number) =>
  c +
  Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0');

// cinema bars — k=1 fully closed; the shake slams them, the summary opens
function letterbox(ctx: CanvasRenderingContext2D, k: number) {
  const h = LB_H * eo(clamp01(k));
  if (h <= 0) return;
  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
}

// spiky stamp badge — n long spikes with an inner ring at 0.68r
function burstStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.68 : r;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// dark silhouette for the reveal's hold beat — built once per species like
// assets' whiteSprite cache, never in the draw path's hot loop
const silCache = new Map<number, HTMLCanvasElement>();
function silSprite(id: number): HTMLCanvasElement | null {
  const hit = silCache.get(id);
  if (hit) return hit;
  let c: HTMLCanvasElement;
  try {
    const img = whiteSprite(id); // throws till the sprite lands — caller skips
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const t = c.getContext('2d')!;
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = '#05070f';
    t.fillRect(0, 0, c.width, c.height);
  } catch {
    return null;
  }
  silCache.set(id, c);
  return c;
}

// the charge-up: converging rings, inbound sparks, a ball that jitters
// faster and harder until the seam cracks — the rarity's tell colors it all
function drawShakeScene(
  ctx: CanvasRenderingContext2D,
  s: HatchState,
  res: PullResult | undefined,
  hype: number,
  cx: number,
  cy: number,
) {
  const T = Math.max(s.tMax, 0.01);
  const p = clamp01(s.t / T);
  if (res) void loadSprite(res.id); // warm the art during the charge — the beat can't wait
  // the tell: rares+ glow gold, epic/shiny prism — and ~1-in-6 commons fake
  // the gold anyway (Monster Strike's fake-out, kept from the old reel)
  const fake = res ? ((res.id * 2654435761) >>> 0) % 100 < 16 : false;
  const tellC =
    hype === 2 ? PRISM[Math.floor(s.t * 9) % PRISM.length] : hype === 1 || fake ? GOLD : '#c0c8e0';

  // inbound spark lanes — seeded per pull so the charge reads identical
  // every frame (and every replay)
  const n = 16 + hype * 10;
  for (let k = 0; k < n; k++) {
    const seed = (res?.id ?? 1) * 131 + k * 17;
    const a = rnd(seed) * Math.PI * 2;
    const q = (s.t * (0.5 + rnd(seed + 1) * 0.7) * (1 + p) + rnd(seed + 2)) % 1;
    const rr = 26 + (1 - q) * 220;
    const sz = 1.5 + rnd(seed + 3) * 3;
    ctx.globalAlpha = q * 0.85;
    ctx.fillStyle = k % 3 ? tellC : '#ffffff';
    ctx.fillRect(cx + Math.cos(a) * rr - sz / 2, cy + Math.sin(a) * rr - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  // rings collapse onto the ball — faster and tighter as the charge builds
  for (let k = 0; k < 3; k++) {
    const q = (s.t * (0.9 + p * 2.2) + k / 3) % 1;
    ctx.globalAlpha = q * 0.55;
    ctx.strokeStyle = tellC;
    ctx.lineWidth = 1.5 + q * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 + (1 - q) * (140 + hype * 45), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the charge glow — its pulse rate climbs with the charge
  const pulse = 0.5 + 0.3 * Math.sin(s.t * (6 + p * 14)) + p * 0.4;
  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 130 + hype * 35);
  glow.addColorStop(0, withA(tellC, pulse * 0.8));
  glow.addColorStop(1, withA(tellC, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 170, cy - 170, 340, 340);

  // the ball — jitter frequency and amplitude both ramp toward the pop
  const ball = itemSprite('poke-ball');
  const freq = 13 + p * 50;
  const amp = 1.5 + p * 13;
  ctx.save();
  ctx.translate(cx + Math.sin(s.t * freq) * amp * 0.45, cy + Math.cos(s.t * freq * 0.87) * amp * 0.3);
  ctx.rotate(Math.sin(s.t * freq) * (0.12 + p * 0.3));
  ctx.imageSmoothingEnabled = false;
  if (ball) {
    const bs = 108 + Math.sin(s.t * freq * 0.5) * 4 * p;
    ctx.drawImage(ball, -bs / 2, -bs / 2, bs, bs);
  }
  ctx.restore();

  // the last beat — the seam cracks light before the cut to reveal
  if (p > 0.85) {
    const q = (p - 0.85) / 0.15;
    ctx.fillStyle = `rgba(255,255,255,${0.75 * q})`;
    ctx.fillRect(cx - 2 - q * 9, cy - 48, 4 + q * 18, 96);
  }

  ctx.textAlign = 'center';
  ctx.font = font(9);
  ctx.fillStyle = hype === 2 ? GOLD : INK_FAINT;
  const dots = '.'.repeat(1 + (Math.floor(s.t * 3) % 3));
  ctx.fillText(
    hype === 2 ? `THE AIR CRACKLES${dots}` : hype === 1 || fake ? `THE BALL GLOWS${dots}` : `THE BALL TWITCHES${dots}`,
    cx,
    cy + 124,
  );
  if (s.results.length > 1) {
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`${s.i + 1} OF ${s.results.length} — TAP TO HURRY`, cx, cy + 148);
  }
}

// the reveal — the mon's dark silhouette holds a beat, then FLASH_T cracks
// it to color under rotating god-rays, burst rings and a spark shower
function drawRevealScene(
  ctx: CanvasRenderingContext2D,
  s: HatchState,
  res: PullResult,
  def: SpeciesDef,
  hype: number,
  cx: number,
  cy: number,
) {
  void loadSprite(res.id);
  const seed = res.id * 2654435761 + s.i * 7919 + (res.shiny ? 41 : 0);
  const T = Math.max(s.tMax, 0.01);
  const fade = clamp01(s.t / 0.3) * clamp01((T - s.t) / 0.35); // in/out gate
  const typeC = TYPE_COLOR[def.type];
  const main = hype === 2 ? (res.shiny ? GOLD : '#c05df0') : hype === 1 ? GOLD : '#c0c8e0';
  const prism = hype === 2;
  const pick = (k: number) => (prism ? PRISM[k % PRISM.length] : main);
  const ft = s.t - FLASH_T; // seconds past the color beat

  // the pillar — a light column squeezed out of a radial gradient
  if (hype >= 1) {
    ctx.save();
    ctx.translate(cx, cy - 30);
    ctx.scale(0.16 + hype * 0.05, 1);
    const beam = ctx.createRadialGradient(0, 0, 10, 0, 0, 420);
    beam.addColorStop(0, withA('#ffffff', 0.4 * fade));
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.arc(0, 0, 420, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // god-rays — wedges wheeling behind the mon, prism-sliced on big pulls
  const rays = RAY_N[hype];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(s.t * 0.5);
  for (let k = 0; k < rays; k++) {
    ctx.save();
    ctx.rotate((k / rays) * Math.PI * 2);
    ctx.fillStyle = withA(pick(k), (0.13 + 0.05 * Math.sin(s.t * 5 + k * 1.7)) * fade);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -440);
    ctx.lineTo(30, -440);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // FGO's rainbow summon ring — segmented arcs counter-rotating
  if (prism) {
    ctx.save();
    ctx.translate(cx, cy);
    for (let ring = 0; ring < 2; ring++) {
      ctx.save();
      ctx.rotate((ring ? -1 : 1) * s.t * (0.7 + ring * 0.35));
      const rr = 98 + ring * 28;
      for (let k = 0; k < 12; k++) {
        ctx.strokeStyle = PRISM[(k + ring * 2) % PRISM.length];
        ctx.globalAlpha = 0.6 * fade;
        ctx.lineWidth = 8 - ring * 3;
        ctx.beginPath();
        ctx.arc(0, 0, rr, (k / 12) * Math.PI * 2, (k / 12) * Math.PI * 2 + 0.32);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // the type-tinted stage glow the mon lands on
  ctx.save();
  ctx.translate(cx, cy + 88);
  ctx.scale(1, 0.3);
  const gg = ctx.createRadialGradient(0, 0, 6, 0, 0, 130);
  gg.addColorStop(0, withA(typeC, 0.55 * fade));
  gg.addColorStop(1, withA(typeC, 0));
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // burst rings — expanding shockwaves off the flash beat
  for (let k = 0; k <= hype; k++) {
    const rt = ft - k * 0.08;
    if (rt <= 0 || rt > 0.6) continue;
    const q = rt / 0.6;
    ctx.strokeStyle = pick(k);
    ctx.globalAlpha = 0.85 * (1 - q);
    ctx.lineWidth = Math.max(1, 9 - q * 8);
    ctx.beginPath();
    ctx.arc(cx, cy, 26 + eo(q) * (190 + hype * 95 + k * 26), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the mon — silhouette till the beat, then color lands with an overshoot
  const pop = 1 + 0.45 * Math.max(0, 1 - s.t * 4);
  const sz = (98 + hype * 16) * Math.min(pop, 1.32);
  const up = -8 * eo(clamp01(s.t / 0.3));
  if (ft < 0) {
    const sil = silSprite(res.id);
    if (sil) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sil, cx - sz / 2, cy + up - sz / 2, sz, sz);
      ctx.restore();
    }
  } else {
    // save/restore, not a bare alpha reset — a still-warming sprite throws
    // mid-draw and would otherwise leave the flash + whiteout dimmed
    ctx.save();
    try {
      ctx.globalAlpha = clamp01(ft / 0.1);
      (res.shiny ? drawShiny : drawMon)(ctx, def.id, cx, cy + up, sz);
    } catch {
      /* sprite still warming */
    }
    ctx.restore();
  }

  // the white hit on the beat + a full-screen whiteout scaled by hype
  if (ft >= 0) {
    if (ft < 0.22) {
      const fg = ctx.createRadialGradient(cx, cy, 8, cx, cy, 250);
      fg.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - ft / 0.22)})`);
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(cx - 250, cy - 250, 500, 500);
    }
    const wa = FLASH_A[hype] * Math.max(0, 1 - ft / 0.18);
    if (wa > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${wa})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // the burst — seeded sparks fly out, stars mixed in on bigger pulls
  if (ft >= 0 && ft < 1.1) {
    const n = BURST_N[hype];
    for (let k = 0; k < n; k++) {
      const life = 0.5 + rnd(seed + k * 7 + 2) * 0.5;
      const q = ft / life;
      if (q >= 1) continue;
      const a = rnd(seed + k * 7) * Math.PI * 2;
      const v = 90 + rnd(seed + k * 7 + 1) * (270 + hype * 110);
      const px = cx + Math.cos(a) * v * ft;
      const py = cy + Math.sin(a) * v * ft * 0.82 + rnd(seed + k * 7 + 3) * 130 * ft * ft;
      const sz = (2 + rnd(seed + k * 7 + 4) * 4) * (1 - q);
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = k % 4 ? pick(k) : '#ffffff';
      if (k % 6 === 0) fillStar(ctx, px, py, Math.max(1.5, sz * 1.7));
      else ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // the shower — sparks sift down through the bars while the card holds
  const span = H - LB_H * 2;
  for (let k = 0; k < 10 + hype * 8; k++) {
    const sx = cx - 190 + rnd(seed + 900 + k * 3) * 380 + Math.sin(s.t * 2 + k) * 14;
    const sy = LB_H + ((rnd(seed + 901 + k) * span + s.t * (24 + rnd(seed + 902 + k) * 44)) % span);
    const tw = Math.abs(Math.sin(s.t * (3 + rnd(seed + 903 + k) * 4) + k * 2));
    const ss = 1.5 + rnd(seed + 904 + k) * 2.5;
    ctx.globalAlpha = tw * 0.45 * fade;
    ctx.fillStyle = k % 4 ? pick(k) : '#ffffff';
    ctx.fillRect(sx, sy, ss, ss);
  }
  ctx.globalAlpha = 1;

  // the marquee — a type bar slides in, the name pops, stars land one by one
  const ny = cy + 124;
  const nameK = eo(clamp01((s.t - 0.45) / 0.25));
  if (nameK > 0) {
    ctx.fillStyle = typeC;
    ctx.fillRect(cx - 95 * nameK, ny + 13, 190 * nameK, 3);
    ctx.textAlign = 'center';
    fitFont(ctx, def.name.toUpperCase(), 13, W - 90);
    ctx.fillStyle = INK;
    ctx.save();
    ctx.translate(cx, ny);
    const sc = nameK + 0.4 * Math.sin(Math.PI * clamp01((s.t - 0.45) / 0.3));
    ctx.scale(sc, sc);
    ctx.fillText(def.name.toUpperCase(), 0, 0);
    ctx.restore();
  }
  const starC = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? GOLD : '#a8b0c8';
  for (let k = 0; k < res.rarity; k++) {
    const kt = clamp01((s.t - 0.56 - k * 0.09) / 0.18);
    if (kt <= 0) continue;
    ctx.fillStyle = starC;
    fillStar(
      ctx,
      cx + (k - (res.rarity - 1) / 2) * 24,
      ny + 36,
      9 * (0.4 + 0.6 * eo(kt) + 0.4 * Math.sin(kt * Math.PI)),
    );
  }

  // the stamp slams in rotated — SHINY! beats NEW! beats the plain dupe line
  const stampK = clamp01((s.t - 0.66) / 0.2);
  if (stampK > 0) {
    ctx.save();
    ctx.translate(cx, ny + 74);
    ctx.rotate(-0.08);
    const sc = 2 - eo(stampK);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    if (res.shiny) {
      ctx.fillStyle = GOLD;
      burstStar(ctx, 0, 0, 42, 12);
      ctx.font = font(9);
      ctx.fillStyle = INK;
      ctx.fillText('SHINY!', 0, 4);
    } else if (!res.dupe) {
      ctx.fillStyle = '#d0483e';
      burstStar(ctx, 0, 0, 36, 10);
      ctx.font = font(9);
      ctx.fillStyle = '#fff5d6';
      ctx.fillText('NEW!', 0, 4);
    } else {
      ctx.font = font(10);
      ctx.fillStyle = '#5a9bf0';
      ctx.fillText(`DUPE +${res.dust} DUST`, 0, 4);
    }
    ctx.restore();
  }

  // reel position + the out — SKIP ≫ keeps its hit rect inside the parked rim
  if (s.results.length > 1) {
    const pw = s.results.length * 10 - 6;
    for (let k = 0; k < s.results.length; k++) {
      ctx.fillStyle = k === s.i ? GOLD : '#3a4160';
      ctx.fillRect(cx - pw / 2 + k * 10, H - LB_H - 44, 6, 6);
    }
    pill(ctx, SKIP_PULL_BTN, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'SKIP ≫' });
  }
  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(s.results.length > 1 ? 'TAP FOR NEXT' : 'TAP TO CONTINUE', cx, H - LB_H - 22);
}
// 'results' — the whole pull laid out in the parked modal; a single pull
// gets the hero card. The theatre's bars slide back open over the top.
function drawPullSummary(ctx: CanvasRenderingContext2D, s: HatchState) {
  scrim(ctx, 0.72);
  const m = HATCH_MODAL;
  uiPanel(ctx, m, s.label ?? 'PULL RESULTS');
  const cx = m.x + m.w / 2;

  // a winning queue warms the whole card — gold haze behind the header
  if (s.results.some((r) => r.shiny || r.rarity >= 2)) {
    ctx.save();
    roundRect(ctx, m.x + 4, m.y + 36, m.w - 8, m.h - 40, 7);
    ctx.clip();
    const wg = ctx.createRadialGradient(cx, m.y + 90, 10, cx, m.y + 90, 240);
    wg.addColorStop(0, 'rgba(255,216,77,0.14)');
    wg.addColorStop(1, 'rgba(255,216,77,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.restore();
  }
  if (s.results.length === 1) {
    const res = s.results[0];
    const def = res && speciesById(res.id);
    if (res && def) {
      void loadSprite(res.id);
      // the hero card pops in like the reveal did — overshoot, then settle;
      // a small window is the stage it bursts out of
      uiWindow(ctx, { x: cx - 80, y: m.y + 94, w: 160, h: 134 }, { shadow: false });
      const k = eo(clamp01(s.t / 0.3));
      ctx.save();
      ctx.translate(cx, m.y + 170);
      ctx.scale(0.6 + 0.4 * k + 0.15 * Math.sin(Math.PI * clamp01(s.t / 0.35)), 0.6 + 0.4 * k + 0.15 * Math.sin(Math.PI * clamp01(s.t / 0.35)));
      ctx.translate(-cx, -(m.y + 170));
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, def.id, cx, m.y + 170, 110);
      } catch {
        /* sprite still warming */
      }
      ctx.restore();
      ctx.globalAlpha = k;
      const starC = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? GOLD : '#a8b0c8';
      for (let k = 0; k < res.rarity; k++) {
        ctx.fillStyle = starC;
        fillStar(ctx, cx + (k - (res.rarity - 1) / 2) * 22, m.y + 244, 9);
      }
      fitFont(ctx, def.name.toUpperCase(), 11, m.w - 40);
      ctx.fillStyle = INK;
      ctx.fillText(def.name.toUpperCase(), cx, m.y + 278);
      ctx.font = font(10);
      ctx.fillStyle = res.dupe ? '#5a9bf0' : GOLD;
      ctx.fillText(res.dupe ? `DUPE +${res.dust} DUST` : 'NEW!', cx, m.y + 306);
      ctx.globalAlpha = 1;
    }
  } else {
    const cols = 5;
    const cw = (m.w - 32) / cols;
    const rh = 96;
    s.results.forEach((res, i) => {
      // cards deal in one by one — the reel's last staggered beat
      const k = eo(clamp01((s.t - i * 0.05) / 0.22));
      if (k <= 0) return;
      const cell = { x: m.x + 16 + (i % cols) * cw + 3, y: m.y + 52 + Math.floor(i / cols) * rh + 3, w: cw - 6, h: rh - 6 };
      ctx.save();
      ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
      const sc = (0.4 + 0.6 * k) * (1 + 0.3 * Math.sin(Math.PI * k));
      ctx.scale(sc, sc);
      ctx.translate(-(cell.x + cell.w / 2), -(cell.y + cell.h / 2));
      // each dealt card is a small window — rare+ keeps its tint on the rim
      uiWindow(ctx, cell, { rad: 7, shadow: false, rim: false });
      if (res.rarity >= 2) rim(ctx, cell, 7, res.rarity >= 3 ? '#c05df0' : '#5a9bf0', 1.5);
      // big pulls keep their win shimmer — a second rim that breathes
      if (res.shiny || res.rarity >= 3) {
        ctx.globalAlpha = 0.45 + 0.3 * Math.sin(s.t * 6 + i);
        ctx.strokeStyle = res.shiny ? GOLD : '#c05df0';
        ctx.lineWidth = 2;
        roundRect(ctx, cell.x - 1.5, cell.y - 1.5, cell.w + 3, cell.h + 3, 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      void loadSprite(res.id);
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, res.id, cell.x + cell.w / 2, cell.y + 30, 44);
      } catch {
        /* sprite still warming */
      }
      const sc2 = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? GOLD : '#a8b0c8';
      for (let k = 0; k < res.rarity; k++) {
        ctx.fillStyle = sc2;
        fillStar(ctx, cell.x + cell.w / 2 + (k - (res.rarity - 1) / 2) * 12, cell.y + 58, 5);
      }
      ctx.textAlign = 'center';
      ctx.font = fontB(6);
      ctx.fillStyle = res.dupe ? '#5a9bf0' : GOLD;
      ctx.fillText(res.dupe ? `+${res.dust}` : 'NEW', cell.x + cell.w / 2, cell.y + 76);
      ctx.restore();
    });
  }
  const news = s.results.filter((r) => !r.dupe).length;
  const dust = s.results.reduce((a, r) => a + r.dust, 0);
  ctx.textAlign = 'center';
  ctx.font = fontB(9);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`${news} NEW${dust ? ` · +${dust} DUST` : ''}${s.dexPay ? ` · DEX +${s.dexPay}★` : ''}${s.rookiePay ? ` · ROOKIE +${s.rookiePay}★` : ''}`, cx, m.y + m.h - 40);
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('TAP TO COLLECT', cx, m.y + m.h - 24);
  letterbox(ctx, 1 - clamp01(s.t / 0.4)); // the bars ride back out over the card
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
// drawLab and labHit share this so a tap always lands where a card drew.
// It's a pure function of LAB_UPGRADES, so the rect map builds once.
let labLayoutCache: ReturnType<typeof computeLabLayout> | null = null;
function labLayout() {
  return (labLayoutCache ??= computeLabLayout());
}
function computeLabLayout() {
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

// pointer → lab upgrade id, or null — only the buy strip answers. The pill
// draws 24px but the live target is a 44px slab inside the card's bottom —
// a thumb shouldn't have to thread the drawn price strip to spend.
export function labHit(scroll: number, x: number, y: number): string | null {
  if (!inRect(x, y, LAB_VIEW)) return null;
  for (const c of labLayout().cards) {
    const cr = { ...c.r, y: c.r.y + LAB_VIEW.y - scroll };
    const buy = labBuyRect(cr);
    const hit = { x: buy.x, y: cr.y + cr.h - 44, w: buy.w, h: 44 };
    if (inRect(x, y, hit)) return c.u.id;
  }
  return null;
}

// one pk_lab read a frame — labLevels() rides meta's load() cache, and its
// memLab fallback covers a missing/corrupt save (private mode) the same way
// the per-id getter did
function labLevelMap(): Map<string, number> {
  const lvls = labLevels();
  return new Map(LAB_UPGRADES.map((u) => [u.id, lvls[u.id] ?? 0]));
}

function drawLabCard(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  u: (typeof LAB_UPGRADES)[number],
  train: boolean,
  stars: number,
  lvl: number,
) {
  const maxed = lvl >= u.max;
  const cost = u.costs[lvl] ?? 0;
  // each upgrade is a small window — the tinted header band stays content
  uiWindow(ctx, r, { rim: false });

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
  ctx.fillStyle = INK;
  ctx.fillText(u.name.toUpperCase(), band.x + 44, band.y + 24);
  ctx.textAlign = 'right';
  ctx.font = fontB(7);
  ctx.fillText(`LV ${lvl}/${u.max}`, band.x + band.w - 8, band.y + 24);

  ctx.textAlign = 'left';
  ctx.font = fontB(7);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(u.desc, r.x + 12, r.y + 56);
  // the bought effect, summed — levels must show what they've already bought
  if (lvl > 0) {
    ctx.fillStyle = GOLD;
    ctx.fillText(`NOW ${u.now(lvl).toUpperCase()}`, r.x + 12, r.y + 70);
  }

  levelPips(ctx, { x: r.x + 12, y: r.y + 78, w: r.w - 24, h: 7 }, lvl, u.max);

  const buy = labBuyRect(r);
  if (maxed) {
    ctx.font = fontB(7);
    const mw = ctx.measureText('MAXED').width + 16;
    chip(ctx, buy.x + buy.w - mw, buy.y + 4, 'MAXED', { bg: '#d0d0c8', fg: INK_FAINT });
  } else {
    const afford = stars >= cost;
    pill(ctx, buy, {
      c: afford ? GOLD : '#e03c34',
      cd: afford ? '#c8a44d' : '#a02a24',
      tc: afford ? INK : '#fff',
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
  scrim(ctx, 0.82);
  uiPanel(ctx, r, "PROF.'S LAB");

  // the strip between band and the card view — tagline left, wallet right
  ctx.textAlign = 'left';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('SPEND YOUR STAR PIECES', r.x + 16, r.y + 60);
  balanceChip(ctx, { x: r.x + r.w - 176, y: r.y + 42, w: 160, h: 28 }, stars);

  const { heads, cards } = labLayout();
  const lvls = labLevelMap();
  ctx.save();
  ctx.beginPath();
  ctx.rect(LAB_VIEW.x - 6, LAB_VIEW.y, LAB_VIEW.w + 12, LAB_VIEW.h);
  ctx.clip();
  for (const hd of heads) {
    const hy = LAB_VIEW.y + hd.y - scroll;
    // each section wears the same mini ink band the spark shelf does
    uiBand(ctx, { x: LAB_VIEW.x - 4, y: hy, w: LAB_VIEW.w + 8, h: 16 }, hd.text, { h: 16, rad: 5 });
  }
  for (const c of cards) {
    const cr = { ...c.r, y: c.r.y + LAB_VIEW.y - scroll };
    if (cr.y + cr.h < LAB_VIEW.y || cr.y > LAB_VIEW.y + LAB_VIEW.h) continue;
    drawLabCard(ctx, cr, c.u, c.train, stars, lvls.get(c.u.id) ?? 0);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
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
  // bagRowItems' filter inline so the stock read serves both the list and the ×n badges
  const stock = bagStock();
  const items = BAG_ITEMS.filter((it) => (stock[it.id] ?? 0) > 0);
  if (!items.length) return;
  ctx.textAlign = 'center';
  ctx.font = font(8);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`BAG — TAKE UP TO ${BAG_MAX}${sel.size ? ` · ${Math.min(sel.size, BAG_MAX)}/${BAG_MAX}` : ''}`, W / 2, BAG_ROW.y + 13);
  items.forEach((it, i) => {
    const on = sel.has(it.id);
    const r = bagChipRect(i, items.length);
    const cr = { x: r.x, y: r.y + (on ? -4 : 0), w: r.w, h: r.h };
    // pocket-size menu windows — gold inner rim when it's riding along
    uiWindow(ctx, cr, { rad: 8 });
    if (on) rim(ctx, cr, 8, GOLD, 2);
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
    ctx.fillStyle = on ? INK : INK_SOFT;
    ctx.textAlign = 'center';
    ctx.fillText(it.name.toUpperCase(), cr.x + cr.w / 2, cr.y + 49);
    // ×n stock badge top-right — gold-lit when the chip is picked
    const n = `×${stock[it.id] ?? 0}`;
    ctx.font = fontB(7);
    const bw = ctx.measureText(n).width + 10;
    roundRect(ctx, cr.x + cr.w - bw - 5, cr.y + 5, bw, 13, 6.5);
    ctx.fillStyle = on ? GOLD : 'rgba(42,36,64,0.9)';
    ctx.fill();
    ctx.fillStyle = on ? INK : PARCH; // the badge face is dark until picked
    ctx.fillText(n, cr.x + cr.w - bw / 2 - 5, cr.y + 14.5);
  });
  // last tap answers "what does this one do?" — one dim line, order-free
  const li = items.findIndex((it) => it.id === last);
  if (li >= 0) {
    ctx.font = fontB(7);
    ctx.fillStyle = INK_SOFT;
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

  // the draft board is one big menu window — the INK band carries the
  // title and the stage, everything below lives on the window's paper
  uiPanel(ctx, { x: 14, y: 96, w: W - 28, h: 738 }, `DRAFT: PICK ${picked.length + 1} OF 4`, { sub: stageName });

  ctx.textAlign = 'center';
  ctx.font = fontB(9);
  ctx.fillStyle = INK;
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
    // menu-window chrome around a content face: uiWindow carries the
    // frame/rim/shadow, cardFace paints the type-tinted paper inside the rim
    uiWindow(ctx, r, { rad: 10 });
    cardFace(ctx, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 }, def.type);
    if (def.shiny) rim(ctx, r, 10, GOLD, 2);

    // same anatomy as the relic cards: a type-tinted header band carries
    // the sprite — the reel plays inside it. Inset past the window rim so
    // the double-frame reads all the way around
    const band = { x: r.x + 7, y: r.y + 7, w: r.w - 14, h: 103 };

    // slot reel: pool faces scroll past until the reel brakes onto the offer
    const stopAt = REEL_STOPS[i] ?? REEL_STOPS[REEL_STOPS.length - 1];
    const spinP = Math.min(spin.age / stopAt, 1);
    if (spinP < 1) {
      ctx.save();
      roundRect(ctx, band.x, band.y, band.w, band.h + 9, 9);
      ctx.clip();
      ctx.fillStyle = INK;
      ctx.fillRect(band.x, band.y, band.w, band.h);
      // quart ease-out, then a 10px overshoot in the last fifth — the reel
      // brakes hard and the dealt face clicks back up like a real slot stop
      const steps = 9 + i * 3;
      const over = Math.sin(clamp01((spinP - 0.8) / 0.2) * Math.PI) * 10;
      const pos = steps * (1 - Math.pow(1 - spinP, 4)) + over / 80;
      // normalized reel speed: the quart's derivative, 1 at deal → 0 at stop
      const spd = Math.pow(1 - spinP, 3);
      const L = spin.pool.length;
      const bcx = band.x + band.w / 2, bcy = band.y + band.h / 2;
      for (let j = Math.floor(pos) - 1; j <= Math.floor(pos) + 2; j++) {
        const d = spin.pool[(((spin.idx[i] + j - steps) % L) + L) % L];
        const py = bcy + (j - pos) * 80;
        // speed stretch — faces pull tall while the reel flies, settle square
        ctx.save();
        ctx.translate(bcx, py);
        ctx.scale(1 - spd * 0.14, 1 + spd * 0.32);
        drawMon(ctx, d.id, 0, 0, 76);
        ctx.restore();
        // a ghost trails fast faces — cheap motion blur against the dark
        if (spd > 0.2) {
          ctx.save();
          ctx.globalAlpha = spd * 0.3;
          drawMon(ctx, d.id, bcx, py - spd * 24, 76);
          ctx.restore();
        }
      }
      // the payline — gold pips mark the row the reel stops on
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.9;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(band.x + (s < 0 ? 2 : band.w - 2), bcy);
        ctx.lineTo(band.x + (s < 0 ? 9 : band.w - 9), bcy - 6);
        ctx.lineTo(band.x + (s < 0 ? 9 : band.w - 9), bcy + 6);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      // fade the band edges so faces slide out of the dark
      const g = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
      g.addColorStop(0, 'rgba(10,14,30,0.9)');
      g.addColorStop(0.35, 'rgba(10,14,30,0)');
      g.addColorStop(0.65, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(band.x, band.y, band.w, band.h);
      ctx.restore();
      // the body deals in as skeleton bars — a shimmer reads "rolling",
      // not "broken": the paper half stays empty no longer
      const shim = 0.14 + 0.09 * Math.sin(spin.age * 7 + i * 1.9);
      ctx.fillStyle = `rgba(40,48,88,${shim})`;
      const bars: [number, number][] = [
        [r.y + 156, r.w - 56], // name
        [r.y + 180, 92], // #id · level
        [r.y + 202, 108], // type · role
        [r.y + 224, 96], // super line
        [r.y + 242, r.w - 40], // desc
      ];
      bars.forEach(([by, bw]) => {
        roundRect(ctx, r.x + r.w / 2 - bw / 2, by, bw, 10, 5);
        ctx.fill();
      });
      return;
    }
    // landing pop: the sprite overshoots for a beat as the reel stops
    const pop = 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15);

    stripeBand(ctx, band, TYPE_COLOR[def.type]);
    // type chip top-left: light pill, type ink darkened so pale types
    // (electric, ice) still read on it
    chip(ctx, r.x + 9, r.y + 9, def.type.toUpperCase(), {
      bg: INK,
      fg: mixHex(TYPE_COLOR[def.type], INK, 0.45),
    });
    // kind pill top-right — SHINY trumps the dex tag; a bonded offer shows
    // its level so the pick can chase LV5 or spread to a fresh partner
    const kind = `${def.shiny ? 'SHINY' : dex.has(def.id) ? 'OWNED' : 'NEW'}${bondLv(def.id) ? `·B${bondLv(def.id)}` : ''}`;
    ctx.font = fontB(7);
    chip(ctx, r.x + r.w - 9 - ctx.measureText(kind).width - 14, r.y + 9, kind, def.shiny
      ? { bg: GOLD, fg: INK }
      : { bg: 'rgba(42,36,64,0.8)', fg: INK });

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
        ctx.fillStyle = ACCENT;
        ctx.fillText(`→ ${nx}`, r.x + 10, r.y + 126);
      }
    }
    if (def.pierce || def.copy) {
      ctx.textAlign = 'right';
      ctx.font = font(8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 9, r.y + 127);
      ctx.fillStyle = GOLD;
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 10, r.y + 126);
    }

    ctx.textAlign = 'center';
    fitFont(ctx, def.name, 14, r.w - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(def.name, r.x + r.w / 2 + 1, r.y + 165);
    ctx.fillStyle = INK;
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 164);

    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`#${String(def.id).padStart(3, '0')} · Lv${def.lvl ?? 1}`, r.x + r.w / 2, r.y + 186);

    ctx.font = fontB(10);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${roleTag(def)}`, r.x + r.w / 2, r.y + 206);

    // the bump super this mon fires — a draft decision you can taste
    ctx.font = fontB(11);
    ctx.fillStyle = GOLD;
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
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('YOUR TEAM', W / 2, 650);
  for (let i = 0; i < 4; i++) {
    const sx = W / 2 - 4 * 44 + i * 88;
    const sr = { x: sx, y: 660, w: 76, h: 90 };
    uiWindow(ctx, sr, { rad: 10 });
    const def = picked[i];
    if (def) {
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, sx + 38, 692, 48);
      ctx.font = fontB(8);
      ctx.fillStyle = INK;
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
    ctx.fillStyle = INK_SOFT;
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
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('tip: fly through an ally mid-shot — charged allies fire their super', W / 2, 810);
  ctx.font = fontB(7);
  ctx.fillStyle = INK_SOFT;
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
  ctx.fillStyle = frac > 0.5 ? '#6fdc6f' : frac > 0.25 ? GOLD : '#ff6b6b';
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
  // the offer card is a menu window — the rarity band is content color,
  // inset past the window rim so the double-frame reads all the way around
  uiWindow(ctx, r, { rad: 10 });

  // pokebonk anatomy: a rarity header band carries the icon — the reel
  // plays inside it too
  const band = { x: r.x + 7, y: r.y + 7, w: r.w - 14, h: 69 };
  const stopAt = spin ? (REEL_STOPS[spin.i] ?? REEL_STOPS[REEL_STOPS.length - 1]) : 0;
  if (spin && spin.age < stopAt) {
    // slot reel: item icons scroll past inside the band until it brakes
    // onto the deal — band/chips stay hidden or the spin would spoil itself
    ctx.save();
    roundRect(ctx, band.x, band.y, band.w, band.h + 9, 9);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    // quart ease-out + end overshoot — same stop language as the draft reel
    const spinP = Math.min(spin.age / stopAt, 1);
    const steps = 9 + spin.i * 3;
    const over = Math.sin(clamp01((spinP - 0.8) / 0.2) * Math.PI) * 7;
    const pos = steps * (1 - Math.pow(1 - spinP, 4)) + over / 48;
    const spd = Math.pow(1 - spinP, 3); // 1 at deal → 0 at the stop
    const L = ITEM_REEL.length;
    const idx = Math.max(0, ITEM_REEL.indexOf(perk.item));
    ctx.imageSmoothingEnabled = false;
    const bcx = band.x + band.w / 2, bcy = band.y + band.h / 2;
    for (let j = Math.floor(pos) - 1; j <= Math.floor(pos) + 2; j++) {
      const img = itemSprite(ITEM_REEL[(((idx + j - steps) % L) + L) % L]);
      const py = bcy + (j - pos) * 48;
      if (!img) continue;
      ctx.save();
      ctx.translate(bcx, py);
      ctx.scale(1 - spd * 0.12, 1 + spd * 0.3);
      ctx.drawImage(img, -20, -20, 40, 40);
      ctx.restore();
      if (spd > 0.2) {
        ctx.save();
        ctx.globalAlpha = spd * 0.3;
        ctx.drawImage(img, bcx - 20, py - 20 - spd * 16, 40, 40);
        ctx.restore();
      }
    }
    // the payline — gold pips mark the row the reel stops on
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.9;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(band.x + (s < 0 ? 2 : band.w - 2), bcy);
      ctx.lineTo(band.x + (s < 0 ? 9 : band.w - 9), bcy - 5);
      ctx.lineTo(band.x + (s < 0 ? 9 : band.w - 9), bcy + 5);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // fade the band edges so icons slide out of the dark
    const g = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
    g.addColorStop(0, 'rgba(10,14,30,0.9)');
    g.addColorStop(0.35, 'rgba(10,14,30,0)');
    g.addColorStop(0.65, 'rgba(10,14,30,0)');
    g.addColorStop(1, 'rgba(10,14,30,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.restore();
    // skeleton bars where the name/desc land — shimmer says "rolling"
    const shim = 0.14 + 0.09 * Math.sin(spin.age * 7 + spin.i * 1.9);
    ctx.fillStyle = `rgba(40,48,88,${shim})`;
    [[r.y + 96, r.w - 40], [r.y + 122, r.w - 24], [r.y + 140, r.w - 30], [r.y + 158, r.w - 44]].forEach(([by, bw]) => {
      roundRect(ctx, r.x + r.w / 2 - bw / 2, by, bw, 10, 5);
      ctx.fill();
    });
    return;
  }
  // landing pop: the icon overshoots for a beat as the reel stops
  const pop = spin ? 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15) : 1;

  stripeBand(ctx, band, RARITY_COLOR[perk.rarity]);
  // rarity pill top-left (light), kind pill top-right (dark) — our perks
  // re-apply/stack, so a repeat is DUPE not UPGRADE
  chip(ctx, r.x + 9, r.y + 9, perk.rarity.toUpperCase(), { bg: INK, fg: INK });
  const kind = opts?.owned ? 'DUPE' : 'NEW';
  ctx.font = fontB(7);
  chip(ctx, r.x + r.w - 9 - ctx.measureText(kind).width - 14, r.y + 9, kind, {
    bg: 'rgba(42,36,64,0.8)',
    fg: INK,
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
    ctx.fillStyle = INK;
    ctx.fillText('?', band.x + band.w / 2 + 3, band.y + band.h / 2 + 12);
  }
  ctx.textAlign = 'center';
  fitFont(ctx, perk.name, 9, r.w - 12);
  ctx.fillStyle = INK;
  ctx.fillText(perk.name, r.x + r.w / 2, r.y + 104);
  ctx.font = fontB(9);
  ctx.fillStyle = INK_SOFT;
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
  scrim(ctx, 0.85);

  ctx.textAlign = 'center';
  // a fresh catch gets the hero slot: a gold-rimmed window with a breathing
  // sprite — and it IS the swap button now, tapping opens the team panel
  if (recruit) {
    const r = REWARD_CATCH;
    uiWindow(ctx, r, { rad: 12 });
    rim(ctx, r, 12, GOLD, 2);
    const pulse = 1 + Math.sin(spin * 5) * 0.05;
    drawMon(ctx, recruit.id, r.x + 52, r.y + r.h / 2, 56 * pulse);
    ctx.textAlign = 'left';
    ctx.font = font(9);
    ctx.fillStyle = GOLD;
    ctx.fillText('NEW CATCH!', r.x + 98, r.y + 24);
    fitFont(ctx, recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), 12, r.w - 112);
    ctx.fillStyle = INK;
    ctx.fillText(recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), r.x + 98, r.y + 46);
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('in your box — tap to open TEAM · ITEMS', r.x + 98, r.y + 64);
    ctx.textAlign = 'center';
  }

  // the reward board is one menu window — band carries the title, the
  // stage/score readouts and the offer cards all live on its paper
  uiPanel(ctx, { x: 14, y: 262, w: W - 28, h: 608 }, 'CHOOSE AN ITEM');

  ctx.font = font(10);
  ctx.fillStyle = INK;
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, W / 2, 356);
  if (spin < REEL_STOPS[REEL_STOPS.length - 1]) {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('reels rolling — tap to skip', W / 2, 372);
  } else if (luck > 0) {
    ctx.font = fontB(8);
    ctx.fillStyle = '#6fdc6f';
    ctx.fillText(`TEAM LUCK ${luck} — fusion dupes + bond feed the gym fountain`, W / 2, 372);
  } else {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('pick a relic — your box waits on the map', W / 2, 372);
  }
  ctx.font = font(9);
  ctx.fillStyle = INK_FAINT;
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
      ctx.fillStyle = INK_FAINT;
      ctx.fillText('NEXT: PICK YOUR ROUTE', W / 2, nextY);
    }
  }
  // every board is pick-one — the old decline-for-score pill is gone; you
  // can still check the deck mid-pick: TEAM · ITEMS is the same panel the
  // map carries
  pill(ctx, REWARD_TEAM, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'TEAM · ITEMS' });

  // a split evolution blocks the reward pick until its form is chosen
  if (evo) {
    scrim(ctx, 0.78);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    fitFont(ctx, `${evo.from.name.toUpperCase()} IS EVOLVING — CHOOSE ITS FORM`, 13, W - 60);
    ctx.fillText(`${evo.from.name.toUpperCase()} IS EVOLVING — CHOOSE ITS FORM`, W / 2, 372);
    evo.options.forEach((opt, i) => {
      const r = evoCardRect(i, evo.options.length);
      uiWindow(ctx, r, { rad: 10 });
      rim(ctx, r, 10, GOLD, 2);
      // split strip sells the dual-type at a glance
      ctx.fillStyle = TYPE_COLOR[opt.type];
      ctx.fillRect(r.x + 8, r.y + 8, opt.type2 ? (r.w - 16) / 2 : r.w - 16, 4);
      if (opt.type2) {
        ctx.fillStyle = TYPE_COLOR[opt.type2];
        ctx.fillRect(r.x + 8 + (r.w - 16) / 2, r.y + 8, (r.w - 16) / 2, 4);
      }
      (opt.shiny ? drawShiny : drawMon)(ctx, opt.id, r.x + r.w / 2, r.y + 66, 76);
      fitFont(ctx, opt.name.toUpperCase(), 9, r.w - 12);
      ctx.fillStyle = INK;
      ctx.fillText(opt.name.toUpperCase(), r.x + r.w / 2, r.y + 128);
      ctx.font = fontB(7);
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(opt.type2 ? `${opt.type}/${opt.type2}` : opt.type, r.x + r.w / 2, r.y + 141);
      ctx.fillStyle = GOLD;
      ctx.fillText(`★ ${moveOf(opt.id, opt.type)}`, r.x + r.w / 2, r.y + 156);
      ctx.fillStyle = INK_FAINT;
      wrap2(ctx, superDesc(opt.id, opt.type), r.w - 14).forEach((l, li) =>
        ctx.fillText(l, r.x + r.w / 2, r.y + 167 + li * 9));
    });
    // the quiet out — dark pill, no gold pull; staying put is a legal pick
    pill(ctx, EVO_KEEP, {
      c: '#e8e8e0',
      cd: '#aab0c8',
      tc: INK,
      label: `KEEP ${evo.from.name.toUpperCase()}`,
    });
  }
}

// The offer-board tool row: REROLL re-deals the offers, BANISH arms then
// culls the next card tapped — that perk stays out of every board left in
// the run. Charges are per-run — main.ts hit-tests TOOL_* and owns state.
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
  ctx.save();
  // armed reads as their .armed state — a pulsing red waiting on a card
  // tap; the label turns into the instruction so it can't misread
  if (banArmed) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 8);
  pill(ctx, TOOL_BAN, {
    c: '#ff5a5f',
    cd: '#e0303e',
    tc: '#fff',
    label: banArmed ? 'TAP A CARD' : 'BANISH',
    badge: banArmed ? undefined : `×${tools.ban}`,
    sub: banArmed ? 'culls it all run' : HAS_KEYS ? '[Z]' : undefined,
    disabled: tools.ban <= 0,
  });
  // the armed cursor — the handheld's ▶ parked on the hot row
  if (banArmed) cursorTri(ctx, TOOL_BAN.x + 13, TOOL_BAN.y + TOOL_BAN.h / 2 - 1, t, '#fff');
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
  ctx.fillStyle = INK_FAINT;
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
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('nothing caught yet: beaten foes sometimes join', W / 2, BOX_STRIP.y + BOX_STRIP.h / 2 + 4);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOX_STRIP.x - 4, BOX_STRIP.y - 6, BOX_STRIP.w + 8, BOX_STRIP.h + 12);
  ctx.clip();
  // the clip already hides off-strip slots — walk only the visible index
  // range instead of paying a card draw for all of them. Same formula as
  // boxSlotRect: x = strip.x + off + i*step - scroll, visible while it
  // overlaps the clip's ±4px slop
  const step = BOX_SLOT + BOX_GAP;
  const off = Math.max(0, (BOX_STRIP.w - (box.length * step - BOX_GAP)) / 2);
  const lo = Math.max(0, Math.floor((boxScroll - off - BOX_SLOT - 4) / step) + 1);
  const hi = Math.min(box.length - 1, Math.ceil((BOX_STRIP.w + 4 + boxScroll - off) / step) - 1);
  for (let i = lo; i <= hi; i++) {
    const def = box[i];
    const r = boxSlotRect(i, box.length, boxScroll);
    const sel = i === selBox;
    const dy = sel ? -3 : 0; // the pick lifts its card off the strip
    const card = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
    // window cells: the picked catch goes dark (the menu's on-look), and
    // while a teammate is armed the whole box turns gold — hot swap targets
    uiWindow(ctx, card, { rad: 10, dark: sel, tint: !sel && selTeam >= 0 ? GOLD_HI : undefined });
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
      ctx.fillStyle = GOLD;
      ctx.fillText('✦', r.x + r.w - 8, card.y + 11);
    }
    hpBar(ctx, r.x + 6, card.y + 46, r.w - 12, boxHp[i] ?? 1);
    ctx.font = fontB(7);
    ctx.fillStyle = ko ? INK_FAINT : TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, card.y + 58);
    const lvl = boxLvl[i] ?? 1;
    const bl = bondLv(def.id);
    if (lvl > 1 || bl) {
      chip(ctx, r.x + 3, card.y + 3, `Lv${lvl}${bl ? `·B${bl}` : ''}`, { bg: 'rgba(12,16,32,0.85)', fg: ACCENT });
      ctx.textAlign = 'center';
    }
  }
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
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('YOUR TEAM', W / 2, 622);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    const sel = i === selTeam;
    const dy = sel ? -3 : 0; // same lift as the box strip — the armed card raises
    const card = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
    // window cells: armed pick goes INK-dark + ▶; while a catch waits in
    // the box every teammate tints gold — the row of hot swap targets
    uiWindow(ctx, card, { rad: 10, dark: sel, tint: !sel && selBox >= 0 ? GOLD_HI : undefined });
    if (sel) cursorTri(ctx, card.x + 9, card.y + card.h / 2 + 2, performance.now() / 1000, PARCH);
    // type hairline + draft-card chips: type tag left, level tag right —
    // a shiny's level rides in gold
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(card.x + 6, card.y + 5, def.type2 ? (card.w - 12) / 2 : card.w - 12, 3);
    if (def.type2) {
      ctx.fillStyle = TYPE_COLOR[def.type2];
      ctx.fillRect(card.x + 6 + (card.w - 12) / 2, card.y + 5, (card.w - 12) / 2, 3);
    }
    chip(ctx, card.x + 6, card.y + 12, def.type.toUpperCase(), sel
      ? { bg: 'rgba(240,230,200,0.16)', fg: TYPE_COLOR[def.type], fontPx: 6 }
      : { bg: INK, fg: mixHex(TYPE_COLOR[def.type], INK, 0.45), fontPx: 6 });
    const lvl = teamLvl[i] ?? 1;
    const bl = bondLv(def.id);
    const lt = `${def.shiny ? `✦${lvl}` : `Lv${lvl}`}${bl ? `·B${bl}` : ''}`;
    ctx.font = fontB(7);
    const lw = ctx.measureText(lt).width + 14;
    chip(
      ctx,
      card.x + card.w - 6 - lw,
      card.y + 12,
      lt,
      def.shiny ? { bg: GOLD, fg: INK } : { bg: 'rgba(12,16,32,0.85)', fg: ACCENT },
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
    ctx.fillStyle = ko ? INK_FAINT : sel ? PARCH : INK;
    ctx.fillText(def.name.slice(0, 12), card.x + card.w / 2, card.y + 87);
    // the role rides as a caption under the card — the 92px face is full
    ctx.font = fontB(6);
    ctx.fillStyle = ko ? '#464e6e' : INK_FAINT;
    ctx.fillText(roleTag(def), card.x + card.w / 2, card.y + card.h + 10);
  });
  // the selected mon's super reads here — swapping is a move pick too
  const selDef = selBox >= 0 ? box[selBox] : selTeam >= 0 ? team[selTeam] : null;
  if (selDef) {
    const sbl = bondLv(selDef.id);
    ctx.font = fontB(8);
    ctx.fillStyle = GOLD;
    ctx.fillText(`★ ${moveOf(selDef.id, selDef.type)} — ${superDesc(selDef.id, selDef.type)}${sbl ? ` · BOND ${sbl}` : ''}`, W / 2, 748); // under the role captions
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
  scrim(ctx, 0.82);
  // the roster drawer is a menu window — the INK band carries the title
  uiPanel(ctx, TEAM_PANEL, 'TEAM & ITEMS');
  ctx.textAlign = 'center';

  // held items — the run's build, card rows like the bag list: rarity notch,
  // icon, name and what it does
  ctx.font = font(9);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('HELD ITEMS', W / 2, 326);
  const shown = heldItems.slice(0, 5);
  if (heldItems.length > shown.length) {
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.textAlign = 'right';
    ctx.fillText(`+${heldItems.length - shown.length} more`, TEAM_PANEL.x + TEAM_PANEL.w - 16, 326);
    ctx.textAlign = 'center';
  }
  if (!shown.length) {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('none yet — relic picks and chests stock it', W / 2, 366);
  }
  shown.forEach((item, i) => {
    const r = { x: TEAM_PANEL.x + 16, y: 336 + i * 34, w: TEAM_PANEL.w - 32, h: 30 };
    // list cells, not floating cards — flat windows, no shadow
    uiWindow(ctx, r, { rad: 8, shadow: false });
    const perk = PERKS.find((p) => p.item === item);
    ctx.fillStyle = perk ? RARITY_COLOR[perk.rarity] : '#d0d0c8';
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
    ctx.fillStyle = INK;
    ctx.fillText(name, r.x + 42, r.y + 19);
    if (perk) {
      ctx.font = fontB(8);
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(`— ${perk.desc}`, r.x + 48 + nw, r.y + 19);
    }
    ctx.restore();
    ctx.textAlign = 'center';
  });

  drawRoster(ctx, box, boxHp, boxLvl, boxScroll, selBox, team, teamHp, teamLvl, selTeam, catchPct, masterArmed);
  pill(ctx, MENU_CLOSE, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'CLOSE' });
  // the quiet out — dark like evo KEEP; the parked pk_run is what CONTINUE resumes
  pill(ctx, MENU_QUIT, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'QUIT TO TITLE' });
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
  const four = offers.length >= 4; // the lab's FOURTH OPTION hits the charm board too
  // the charm board is a menu window — the 2×2 board's second row pushes the
  // squad below the window's floor, where it floats on the sky like before
  uiPanel(ctx, { x: 14, y: 252, w: W - 28, h: four ? 596 : 540 }, title);
  ctx.font = fontB(9);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(sub, W / 2, 315);
  offers.forEach((p, i) => drawPerkCard(ctx, perkCardRect(i, offers.length), p, undefined, { idx: i }));
  // declining pays score instead — a dead offer still has a price
  pill(ctx, CHARM_SKIP, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'SKIP +200 PTS' });
  // the drafted squad rides under the offers — pick the item for THESE mons.
  // The 2×2 board's second row pushes the squad to the bottom seam, shrunk.
  if (team.length) {
    const labelY = four ? 854 : 664;
    const monY = four ? 884 : 702;
    const monS = four ? 44 : 62;
    ctx.font = font(9);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('YOUR TEAM', W / 2, labelY);
    team.forEach((def, i) => {
      const mx = W / 2 + (i - (team.length - 1) / 2) * (four ? 76 : 92);
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, monY, monS);
      ctx.font = fontB(8);
      ctx.fillStyle = INK;
      ctx.fillText(def.name.toUpperCase(), mx, monY + (four ? 32 : 34));
      ctx.font = fontB(6);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillText(def.type.toUpperCase(), mx, monY + (four ? 44 : 46));
    });
  }
}

// Win confetti — little type-colored paper squares drifting down forever.
// Positions/velocities are derived from the index, so it needs no state.
const CONFETTI = [GOLD, '#f08030', '#6890f0', '#78c850', '#f85888'];
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
  scrim(ctx, 0.87);
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
    ['DEPTH', `${depthN || '—'}/${TOTAL_STAGES}`, INK],
    ['SHOTS', `${res.shots}`, INK],
    ['TIME', `${res.time.toFixed(1)}s`, INK],
    ['CAUGHT', `${res.caught}`, INK],
  ];
  if (res.stars) findings.push(['STAR PIECES', `+${res.stars}`, GOLD]); // the wallet's payout — even a wipe banks
  if (res.starsBonus) findings.push(['FIRST WIN TODAY', `+${res.starsBonus}`, GOLD]);
  if (res.grind) findings.push([`RUN ${res.grind.n} TODAY`, `+${res.grind.pay}`, GOLD]);
  if (res.dexPay) findings.push(['DEX MILESTONES', `+${res.dexPay}`, '#c9a8ff']);
  if (res.bondDust) findings.push(['BOND LV-UPS', `+${res.bondDust} DUST`, '#c9a8ff']);
  res.rookie?.forEach((s) => findings.push([`ROOKIE: ${s.label}`, `+${s.pay}`, '#c9a8ff']));
  if (res.rating) {
    const r = res.rating;
    findings.push([
      'RATING',
      `${r.delta >= 0 ? '+' : ''}${r.delta} ${r.tier}${r.up ? ' ★ RANK UP' : ''}${res.place >= 0 ? ` · HOF #${res.place + 1}` : ''}`,
      r.color,
    ]);
  }
  if (res.newDex > 0) findings.push(['NEW DEX', `+${res.newDex}`, ACCENT]);

  ctx.font = fontB(9);
  const noteLines = extra ? wrap2(ctx, extra, W - 92) : []; // interior width of the report card

  // sized to content — the card tallies each block before it draws, and the
  // whole stack (report + attachment + echo) centres above the buttons.
  // A packed report (many findings + badge rows) can outgrow the space
  // above REMATCH, so it compacts in steps and the panel is hard-capped —
  // truncated tail rows clip at the card floor instead of inking buttons.
  const findingsY = 122; // band + CASE kicker + FINDINGS head
  const recH = res.newBest || res.shortOfBest > 0 ? 22 : 0;
  const shareH = share ? 116 : 0;
  const echoH = !res.won ? 22 : 0;
  const stackCap = RETRY_BTN.y - 8 - 46;
  const size = (rowH: number, badgeCap: number, noteCap: number) =>
    findingsY +
    findings.length * rowH +
    recH +
    (extra ? 18 + Math.min(noteLines.length, noteCap) * 13 + 6 : 0) +
    (res.newAch.length ? 20 : 0) +
    (badgeRows.length ? Math.min(badgeRows.length, badgeCap) * 28 + 4 : 0) +
    12;
  let rowH = 24;
  let badgeCap = badgeRows.length;
  let noteCap = noteLines.length;
  if (size(rowH, badgeCap, noteCap) + shareH + echoH > stackCap) {
    rowH = 20;
    if (size(rowH, badgeCap, noteCap) + shareH + echoH > stackCap) {
      rowH = 19;
      badgeCap = 2;
      noteCap = 2;
    }
  }
  const badgeDrawn = badgeRows.slice(0, badgeCap);
  const noteDrawn = noteLines.slice(0, noteCap);
  const panelH = Math.min(size(rowH, badgeCap, noteCap), stackCap - shareH - echoH);
  const panel = {
    x: 30,
    y: Math.max(46, Math.round((RETRY_BTN.y - 8 - (panelH + shareH + echoH)) / 2)),
    w: W - 60,
    h: panelH,
  };
  const ix = panel.x + 16; // interior left edge (index gutter)
  const vx = panel.x + panel.w - 16; // findings values right-align here

  // the report is a menu window — double-frame, hard shadow; the manual's
  // crop ticks and the rubber stamp stay, they're the report's own flavor
  uiWindow(ctx, panel, { rad: 10 });

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

  // the INK title band carries the report's name; the subtitle drops to a
  // dim line between the band and the CASE index
  uiBand(ctx, panel, 'FIELD REPORT');
  ctx.textAlign = 'left';
  ctx.font = fontB(7);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('post-climb debrief — filed for the record', ix, panel.y + 50);

  // the CASE line is the file's index card — run number when main files
  // one, otherwise the seed carries the reference
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
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
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('FINDINGS', ix, panel.y + 96);

  // the findings stack clips at the card floor — a compacted report keeps
  // its top rows and loses tail rows to the cap, never over the buttons
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y + 44, panel.w, panel.h - 44);
  ctx.clip();

  findings.forEach(([label, value, color], i) => {
    const fy = panel.y + findingsY + i * rowH;
    ctx.font = fontB(8);
    ctx.fillStyle = '#464e6e';
    ctx.fillText(String(i + 1).padStart(2, '0'), ix, fy);
    // each finding is a menu list row — the value keeps its semantic ink
    // (gold payouts, accent dex), so it draws over uiRow's right slot
    uiRow(ctx, { x: ix + 28, y: fy - rowH / 2 - 4, w: vx - ix - 28, h: rowH }, label);
    ctx.font = fontB(10);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(value, vx, fy);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(ix, fy + 9, panel.w - 32, 1);
  });
  let yy = panel.y + findingsY + findings.length * rowH;

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
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`${res.shortOfBest.toLocaleString('en-US')} PTS SHORT OF YOUR BEST`, W / 2, yy + 14);
    yy += 22;
  }

  // the free-text margin: loss detail or ascension unlock, filed verbatim
  if (extra) {
    ctx.textAlign = 'left';
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('FIELD NOTE', ix, yy + 12);
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(ix + ctx.measureText('FIELD NOTE').width + 8, yy + 9, vx - ix - ctx.measureText('FIELD NOTE').width - 8, 1);
    ctx.font = fontB(9);
    ctx.fillStyle = '#f8d030';
    noteDrawn.forEach((l, li) => ctx.fillText(l, ix, yy + 24 + li * 13));
    yy += 18 + noteDrawn.length * 13 + 6;
  }

  // fresh trophies get their own gold line under the findings block
  if (res.newAch.length) {
    ctx.textAlign = 'center';
    ctx.font = fontB(9);
    ctx.fillStyle = GOLD;
    ctx.fillText(`★ ${res.newAch.join(' · ')} ★`, W / 2, yy + 14);
    yy += 20;
  }

  // run badges — rarity-colored chips, capped rows when the report compacts
  badgeDrawn.forEach((row, ri) => {
    const by = yy + 4 + ri * 28;
    ctx.font = fontB(8);
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      const br = { x: bx, y: by, w: ws[i], h: 20 };
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.fillStyle = PAPER;
      ctx.fill();
      rim(ctx, br, 5, RARITY_COLOR[b.rarity]);
      edge(ctx, br, 5);
      ctx.font = fontB(8);
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      ctx.fillText(b.name, bx + ws[i] / 2, by + 14);
      bx += ws[i] + 8;
    });
  });
  if (badgeRows.length > badgeDrawn.length) {
    ctx.font = fontB(8);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`+ ${badgeRows.slice(badgeCap).flat().length} MORE BADGES`, W / 2, yy + 4 + badgeDrawn.length * 28 + 12);
  }
  ctx.restore(); // the card-floor clip ends — attachments draw uncapped

  // the attachment — squad + wave grid ride below the report itself
  const ay = panel.y + panel.h;
  ctx.textAlign = 'center';
  if (share) {
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
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
        ctx.fillStyle = GOLD;
        ctx.fillText('★', mx, sy + 13); // crowns the sprite, below the wave row
      }
      ctx.font = fontB(6);
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(roleTag(def), mx, sy + 68);
      // a bond level-up lands on a face, not just the findings line
      const bu = res.bondUps?.find((u) => u.id === def.id);
      if (bu) {
        ctx.fillStyle = '#c9a8ff';
        ctx.fillText(`BOND LV${bu.lv} ▲`, mx, sy + 79);
      }
    });
  }

  // the echo tease — losing isn't a dead end, the team comes back hostile
  if (!res.won) {
    ctx.font = fontB(8);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('this fallen team may return as a RIVAL next run', W / 2, share ? ay + 126 : ay + 34);
  }

  pill(ctx, RETRY_BTN, { c: GOLD, cd: '#c8a44d', tc: INK, label: 'REMATCH' });
  pill(ctx, SHARE_BTN, {
    c: '#e8e8e0',
    cd: '#aab0c8',
    tc: INK,
    label: share?.failed ? 'COPY FAILED' : share?.copied ? 'COPIED!' : 'SHARE RESULT',
  });
  pill(ctx, TITLE_BTN, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'TITLE' });

  // receipt stub — one screenshot carries the replay and the build
  ctx.save();
  ctx.font = fontB(8);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff42';
  ctx.fillText(`SEED ${res.seed} · ${__BUILD__}`, 14, 22);
  ctx.restore();
}

// toLocaleString per frame was the HUD's only non-trivial alloc — two slots
// memoize it (the score is stable for seconds at a time)
let scoreStrN = -1;
let scoreStr = '';

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, shots: number, stageName: string, score: number, streak = 0, ultIn = 1, t = 0) {
  ctx.font = fontB(9);
  // a tiny dark window keeps the stage tag legible over any arena floor
  uiWindow(ctx, { x: 46, y: 30, w: measureW(ctx, stageName) + 18, h: 20 }, { dark: true, shadow: false });
  ctx.fillStyle = INK_FAINT;
  ctx.textAlign = 'left';
  // right of the pause chip (x 14..44) — the chip would eat the first letter
  ctx.fillText(stageName, 54, 44);
  // run map in miniature: a pip per stage, gyms as diamonds — the whole
  // 9-stage climb is visible from the first fight
  const gap = 22;
  const x0 = W / 2 - ((TOTAL_STAGES - 1) * gap) / 2;
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const x = x0 + i * gap;
    const y = 40;
    const gym = (i + 1) % 3 === 0;
    ctx.fillStyle = i < wave ? GOLD : i === wave ? '#ffffff' : '#3a4066';
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
  if (score !== scoreStrN) {
    scoreStrN = score;
    scoreStr = score.toLocaleString('en-US'); // a string the frame can reuse — the score barely moves
  }
  // SHOTS/SCORE ride one dark chip — sized to whichever string runs wider
  ctx.font = font(8);
  const rw = Math.max(measureW(ctx, `SHOTS ${shots}`), measureW(ctx, `SCORE ${scoreStr}`)) + 30;
  uiWindow(ctx, { x: W - 22 - rw, y: 28, w: rw, h: 40 }, { dark: true, shadow: false });
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
  ctx.font = font(8);
  ctx.fillStyle = GOLD;
  ctx.fillText(`SCORE ${scoreStr}`, W - 30, 60);
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
  ctx.fillStyle = ready ? GOLD : INK_FAINT;
  ctx.fillText('ULT', ux, 60);
  ux += ctx.measureText('ULT').width + 6;
  const banked = ULT_SHOTS - Math.max(0, ultIn);
  const pipW = Math.min(14, Math.max(6, Math.floor(120 / ULT_SHOTS) - 2));
  const glow = ready ? 0.55 + Math.sin(t * 6) * 0.45 : 0;
  for (let i = 0; i < ULT_SHOTS; i++) {
    const on = i < banked || ready;
    ctx.fillStyle = on ? GOLD : '#d0d0c8';
    ctx.fillRect(ux + i * (pipW + 3), 52, pipW, 8);
    if (ready) {
      ctx.fillStyle = `rgba(255,216,77,${(0.25 + 0.35 * glow).toFixed(3)})`;
      ctx.fillRect(ux + i * (pipW + 3) - 1, 51, pipW + 2, 10);
    }
  }
  if (ready) {
    ctx.globalAlpha = glow;
    ctx.fillStyle = GOLD;
    ctx.fillText('TAP A TEAMMATE!', ux + ULT_SHOTS * (pipW + 3) + 8, 60);
    ctx.globalAlpha = 1;
  }
}

// --- settings modal: pokebonk anatomy, our palette — a left rail of ------
// --- category pills over a right panel: striped header, then slider or ---
// --- toggle rows. Geometry is the single source for draw + hit tests. ----

export type SettingsCat = 'sound' | 'graphics' | 'feel' | 'trainer';
export type SettingsSliderKey = 'master' | 'music' | 'sfx' | 'shake';
export type SettingsToggleKey = 'haptics' | 'flash' | 'battery' | 'fps' | 'uiSfx' | 'dmgNums' | 'aimGuide' | 'mapGlints';
export type SettingsSegKey = 'quality' | 'pickupFx';
export type SettingsHit =
  | { kind: 'tab'; i: number }
  | { kind: 'slider'; key: SettingsSliderKey }
  | { kind: 'toggle'; key: SettingsToggleKey }
  | { kind: 'seg'; key: SettingsSegKey; i: number }
  | { kind: 'avatar'; i: number };

// a settings row — the draw pass and the hit test read the same list. The
// `invert` toggle lamp reads !stored (REDUCE FLASHES on = flash off); the
// flip itself is still !stored — toggling an inverted bool is the same op.
type SettingsRow =
  | { kind: 'slider'; key: SettingsSliderKey; label: string; sub?: string }
  | { kind: 'toggle'; key: SettingsToggleKey; label: string; sub?: string; invert?: boolean }
  | { kind: 'seg'; key: SettingsSegKey; label: string; sub?: string };

export const SETTINGS_PANEL = { x: 22, y: 38, w: W - 44, h: 800 };
export const SETTINGS_CLOSE = { x: W / 2 - 100, y: SETTINGS_PANEL.y + SETTINGS_PANEL.h - 64, w: 200, h: 46 };

export const SETTINGS_CATS: { id: SettingsCat; name: string; tab: string; sub: string }[] = [
  { id: 'sound', name: 'SOUND', tab: 'volume', sub: 'volume, music and effects' },
  { id: 'graphics', name: 'GRAPHICS', tab: 'res & effects', sub: 'quality, battery and effects' },
  { id: 'feel', name: 'FEEL', tab: 'rumble', sub: 'haptics and feedback' },
  { id: 'trainer', name: 'TRAINER', tab: 'your look', sub: 'the trainer on the map' },
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
    { kind: 'toggle', key: 'uiSfx', label: 'MENU SOUNDS', sub: 'clicks & blips in menus' },
  ],
  graphics: [
    { kind: 'seg', key: 'quality', label: 'QUALITY', sub: 'low performs better' },
    { kind: 'toggle', key: 'battery', label: 'BATTERY SAVER', sub: 'caps at 30 fps and lowers the resolution' },
    { kind: 'slider', key: 'shake', label: 'SHAKE INTENSITY', sub: 'hit feedback strength' },
    { kind: 'toggle', key: 'flash', label: 'REDUCE FLASHES', sub: 'caps full-screen flash intensity', invert: true },
    { kind: 'seg', key: 'pickupFx', label: 'PICKUP EFFECTS', sub: 'fewer sparkles under pickups' },
    { kind: 'toggle', key: 'mapGlints', label: 'MAP SPARKLES', sub: 'sea glints on the climb map' },
    { kind: 'toggle', key: 'fps', label: 'SHOW FPS', sub: 'frame counter in the corner' },
  ],
  feel: [
    { kind: 'toggle', key: 'haptics', label: 'HAPTICS' },
    { kind: 'toggle', key: 'dmgNums', label: 'DAMAGE NUMBERS', sub: 'hit values over mons' },
    { kind: 'toggle', key: 'aimGuide', label: 'AIM ARROW', sub: 'launch direction while aiming' },
  ],
  trainer: [], // the avatar grid draws itself — no settings rows
};

const SET_RAIL = { x: SETTINGS_PANEL.x + 16, y: SETTINGS_PANEL.y + 52, w: 150 };
const SET_TAB_H = 78;
const SET_TAB_GAP = 14;
const SET_PANEL = {
  x: SET_RAIL.x + SET_RAIL.w + 14,
  y: SETTINGS_PANEL.y + 16,
  w: SETTINGS_PANEL.x + SETTINGS_PANEL.w - 16 - (SET_RAIL.x + SET_RAIL.w + 14),
  // ends a gutter above the CLOSE row — rows must never slide under it
  h: SETTINGS_PANEL.h - 32 - 78,
};
const SET_BAND = { x: SET_PANEL.x + 4, y: SET_PANEL.y + 4, w: SET_PANEL.w - 8, h: 56 };
const SET_ROW = { x: SET_PANEL.x + 4, w: SET_PANEL.w - 8 };
const SET_ROWS_Y = SET_BAND.y + SET_BAND.h + 18;
const SET_SLIDER_H = 92;
const SET_TOGGLE_H = 66;
const SET_SEG_H = 86;
const SET_TRACK = { x: SET_ROW.x + 14, w: SET_ROW.w - 28, h: 12 };
const SET_SEG_TRACK = { x: SET_TRACK.x, w: SET_TRACK.w, h: 28 };

// rows carrying a sub line pack tighter — the sub eats the label's bottom pad.
// sub-toggle pitch is 54 so its hit row clears the 44px touch floor
const setRowPitch = (r: SettingsRow) =>
  r.kind === 'seg' ? SET_SEG_H : r.sub ? (r.kind === 'slider' ? 82 : 54) : r.kind === 'slider' ? SET_SLIDER_H : SET_TOGGLE_H;

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
const segTrackRect = (r: { y: number }) => ({ x: SET_SEG_TRACK.x, y: r.y + 46, w: SET_SEG_TRACK.w, h: SET_SEG_TRACK.h });

const segIndex = (key: SettingsSegKey, tr: { x: number; w: number }, x: number) => {
  const n = SETTINGS_SEG_OPTIONS[key].length;
  return Math.min(n - 1, Math.max(0, Math.floor((x - tr.x) / (tr.w / n))));
};

// the TRAINER tab's avatar grid — 4×4 cards under the band, draw and hit
// test read the same rect
const AV_COLS = 4;
const AV_CELL = { w: 66, h: 80, gap: 8 };
const avatarRect = (i: number) => {
  const gw = AV_COLS * AV_CELL.w + (AV_COLS - 1) * AV_CELL.gap;
  return {
    x: SET_PANEL.x + (SET_PANEL.w - gw) / 2 + (i % AV_COLS) * (AV_CELL.w + AV_CELL.gap),
    y: SET_ROWS_Y + 4 + Math.floor(i / AV_COLS) * (AV_CELL.h + AV_CELL.gap),
    w: AV_CELL.w,
    h: AV_CELL.h,
  };
};

// what a point inside the panel touches: a rail pill, a slider's drag slab
// (the track ±23px — a thumb hit gets >=22px of grace), or a toggle's row
export function settingsRowHit(p: { x: number; y: number }, cat: SettingsCat): SettingsHit | null {
  for (let i = 0; i < SETTINGS_CATS.length; i++) {
    if (inRect(p.x, p.y, settingsTabRect(i))) return { kind: 'tab', i };
  }
  if (cat === 'trainer') {
    for (let i = 0; i < AVATARS.length; i++)
      if (inRect(p.x, p.y, avatarRect(i))) return { kind: 'avatar', i };
    return null;
  }
  const rows = SET_ROWS[cat];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const r = settingsRowRect(i, cat);
    if (row.kind === 'slider') {
      // the drag slab is the track ±20px — a thumb hit gets >=24px of
      // grace, but never past the row's bottom or a sub-slider bleeds
      // into the toggle below it
      const slabY = r.y + (row.sub ? 34 : 38);
      if (inRect(p.x, p.y, { x: r.x, y: slabY, w: r.w, h: Math.min(56, r.y + r.h - slabY) }))
        return { kind: 'slider', key: row.key };
    } else if (row.kind === 'toggle') {
      if (inRect(p.x, p.y, r)) return { kind: 'toggle', key: row.key };
    } else {
      // seg hits live on the track — 50px deep, bottom-flush with the row so
      // it never bleeds into the next; a label tap still doesn't pick options
      const tr = segTrackRect(r);
      if (inRect(p.x, p.y, { x: tr.x - 6, y: tr.y - 18, w: tr.w + 12, h: 50 }))
        return { kind: 'seg', key: row.key, i: segIndex(row.key, tr, p.x) };
    }
  }
  return null;
}

// drag writes hit pk_settings per pointermove otherwise — the live value
// rides sliderPending for the draw while setSetting flushes to storage at
// ~4Hz; settingsSliderFlush (the drop points in main.ts) banks the last x
let sliderPending: { key: SettingsSliderKey; v: number } | null = null;
let sliderLastWrite = -1;

// x → 0..1 across the shared track span — pointerdown sets immediately,
// pointermove while dragging keeps calling this
export function settingsSliderSet(key: SettingsSliderKey, x: number) {
  const v = Math.min(1, Math.max(0, (x - SET_TRACK.x) / SET_TRACK.w));
  if (sliderPending && sliderPending.key !== key) settingsSliderFlush(); // new drag, old key pending
  sliderPending = { key, v };
  const now = performance.now();
  if (now - sliderLastWrite >= 250) {
    sliderLastWrite = now;
    setSetting(key, v);
    sliderPending = null;
  }
}

// release/cancel/close — always persist whatever the thumb last touched
export function settingsSliderFlush() {
  if (!sliderPending) return;
  setSetting(sliderPending.key, sliderPending.v);
  sliderPending = null;
}

export function settingsToggleFlip(key: SettingsToggleKey) {
  setSetting(key, !settings()[key]);
}

export function settingsSegSet(key: SettingsSegKey, i: number) {
  const opts = SETTINGS_SEG_OPTIONS[key];
  setSetting(key, opts[Math.min(opts.length - 1, Math.max(0, i))] as Settings[typeof key]);
}

export function drawSettings(ctx: CanvasRenderingContext2D, cat: SettingsCat, vals: Settings) {
  const cdef = SETTINGS_CATS.find((c) => c.id === cat)!;
  scrim(ctx, 0.75);
  uiPanel(ctx, SETTINGS_PANEL, 'SETTINGS', { sub: cdef.tab });

  // category tabs — small window cells; the live one inverts to the ink
  // slab (uiRow's on-look). Icons keep their gold/pale circles.
  SETTINGS_CATS.forEach((c, i) => {
    const r = settingsTabRect(i);
    const on = c.id === cat;
    uiWindow(ctx, r, { dark: on, rad: 16 });
    const cx = r.x + 34;
    const cy = r.y + r.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = on ? GOLD : '#e8e8e0';
    ctx.fill();
    const ink = on ? INK : INK_FAINT;
    if (c.id === 'sound') speakerGlyph(ctx, cx, cy, 1, false, ink);
    else if (c.id === 'graphics') monitorGlyph(ctx, cx, cy, 1.15, ink);
    else if (c.id === 'trainer') personGlyph(ctx, cx, cy, 1.15, ink);
    else gearGlyph(ctx, cx, cy, 1.15, ink);
    ctx.textAlign = 'left';
    fitFont(ctx, c.name, 9, r.w - 70);
    ctx.fillStyle = on ? PARCH : INK_SOFT;
    ctx.fillText(c.name, r.x + 62, r.y + 35);
    ctx.font = fontB(8);
    ctx.fillStyle = on ? '#a8b0d0' : INK_FAINT;
    ctx.fillText(c.tab, r.x + 62, r.y + 53);
  });

  // the live category's header — an ink slab row under the title band.
  // (SET_BAND's old y already clears the uiBand; the nudge keeps it so.)
  const P = SET_PANEL;
  uiRow(ctx, { x: SET_ROW.x, y: SET_BAND.y + 24, w: SET_ROW.w, h: 36 }, cdef.name, {
    on: true,
    sub: cdef.sub,
    px: 11,
  });

  if (cat === 'trainer') {
    const sel = trainerPick();
    AVATARS.forEach((a, i) => {
      const r = avatarRect(i);
      const on = a.id === sel;
      // tiny windows — the picked trainer pops ink + a gold rim
      uiWindow(ctx, r, on ? { dark: true, rim: false, rad: 8 } : { tint: '#0a0d18', rim: false, rad: 8 });
      if (on) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
        ctx.stroke();
      }
      drawNpc(ctx, `${a.id}_down_0`, r.x + r.w / 2, r.y + 52, 50);
      ctx.textAlign = 'center';
      ctx.font = font(6);
      ctx.fillStyle = on ? GOLD : INK_FAINT;
      ctx.fillText(a.name, r.x + r.w / 2, r.y + r.h - 7);
    });
  }

  SET_ROWS[cat].forEach((row, i) => {
    const r = settingsRowRect(i, cat);
    // the label rides a uiRow strip — a lone toggle centers in its row;
    // sliders/segs/subs pin theirs to the top 36px, controls below
    const stripH = row.kind === 'toggle' && !row.sub ? r.h : 36;
    uiRow(ctx, { x: r.x, y: r.y, w: r.w, h: stripH }, row.label, { sub: row.sub, px: 10 });
    if (row.kind === 'slider') {
      // a throttled write keeps the thumb live from the pending value —
      // vals[] only catches up at the ~4Hz flush
      const v = sliderPending?.key === row.key ? sliderPending.v : vals[row.key];
      ctx.font = font(9);
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v * 100)}%`, r.x + r.w - 2, r.y + 18);
      const ty = r.y + (row.sub ? 48 : 54);
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.fillStyle = '#0a0d18';
      ctx.fill();
      // the fill wears the same light→base→dark ramp as the pills
      ctx.save();
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.clip();
      const g = gradFor(ctx, `sliderFill:${ty}`, (cc) => {
        const lg = cc.createLinearGradient(0, ty, 0, ty + SET_TRACK.h);
        lg.addColorStop(0, '#ffe76a');
        lg.addColorStop(0.55, GOLD);
        lg.addColorStop(1, '#c8a44d');
        return lg;
      });
      ctx.fillStyle = g;
      ctx.fillRect(SET_TRACK.x, ty, Math.max(SET_TRACK.h, SET_TRACK.w * v), SET_TRACK.h);
      ctx.restore();
      roundRect(ctx, SET_TRACK.x, ty, SET_TRACK.w, SET_TRACK.h, 5);
      ctx.strokeStyle = '#d0d0c8';
      ctx.lineWidth = 1;
      ctx.stroke();
      // ball thumb — red cap, white belly, dark seam + button
      const bx = SET_TRACK.x + SET_TRACK.w * v;
      const by = ty + SET_TRACK.h / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = PAPER;
      ctx.fillRect(bx - 14, by - 14, 28, 28);
      ctx.fillStyle = '#f04038';
      ctx.fillRect(bx - 14, by - 14, 28, 14);
      ctx.fillStyle = '#0a0d18';
      ctx.fillRect(bx - 14, by - 2, 28, 4);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (row.kind === 'toggle') {
      const on = row.invert ? !vals[row.key] : vals[row.key];
      const tr = { x: r.x + r.w - 70, y: r.y + r.h / 2 - 15, w: 60, h: 30 };
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 15);
      ctx.fillStyle = on ? GOLD : '#d0d0c8';
      ctx.fill();
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 15);
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const kx = on ? tr.x + tr.w - 16 : tr.x + 16;
      ctx.beginPath();
      ctx.arc(kx, tr.y + 15, 12, 0, Math.PI * 2);
      ctx.fillStyle = on ? PAPER : INK_FAINT;
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
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.strokeStyle = '#0a0d18';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      roundRect(ctx, tr.x, tr.y, tr.w, tr.h, tr.h / 2);
      ctx.strokeStyle = '#d0d0c8';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      opts.forEach((o, oi) => {
        ctx.font = fontB(9);
        ctx.fillStyle = oi === sel ? INK : INK_FAINT;
        ctx.fillText(o.toUpperCase(), tr.x + sw * (oi + 0.5), tr.y + tr.h / 2 + 4);
      });
    }
  });

  ctx.textAlign = 'center';
  ctx.font = fontB(8);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('saved when you leave', P.x + P.w / 2, P.y + P.h - 14);

  // the × chip rides centered on the wide close rect — the tap zone
  // (SETTINGS_CLOSE) is bigger than the mark on purpose
  const cc = SETTINGS_CLOSE;
  uiClose(ctx, { x: cc.x + cc.w / 2 - cc.h / 2, y: cc.y, w: cc.h, h: cc.h });
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
// a claim slab answers on every tap now — done-vs-deny is main.ts's call.
// `views` must be the list the draw used: re-deriving here would claim a
// different task than the row the player tapped after a day rollover.
export function taskRowHit(p: Vec, views: TaskView[]): TasksHit | null {
  if (inRect(p.x, p.y, TASKS_CLOSE) || !inRect(p.x, p.y, TASKS_PANEL)) return { kind: 'close' };
  for (let i = 0; i < TASKS_TABS.length; i++) {
    if (inRect(p.x, p.y, tasksTabRect(i))) return { kind: 'tab', i };
  }
  for (let i = 0; i < views.length; i++) {
    if (inRect(p.x, p.y, taskClaimRect(taskRowRect(i)))) return { kind: 'claim', i };
  }
  return null; // dead panel space is still modal
}

export function drawTasks(ctx: CanvasRenderingContext2D, views: TaskView[], tab: 'daily' | 'weekly', t: number, flash?: string) {
  scrim(ctx, 0.75);
  uiWindow(ctx, TASKS_PANEL);

  // period tabs — small window cells; the live one inverts to the ink slab.
  // Their rects overlap the title-band zone (geometry is hit law), so the
  // band draws OVER them — the tabs read as hanging off the title rail —
  // and their labels re-print below the band's bottom edge.
  TASKS_TABS.forEach((id, i) => {
    const r = tasksTabRect(i);
    uiWindow(ctx, r, { dark: id === tab, rad: 14 });
  });
  uiBand(ctx, TASKS_PANEL, 'TASKS', { sub: `NEW TASKS ${taskResetsIn(tab)}` });
  TASKS_TABS.forEach((id, i) => {
    const r = tasksTabRect(i);
    const on = id === tab;
    ctx.font = font(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? PARCH : INK_SOFT;
    ctx.fillText(id.toUpperCase(), r.x + r.w / 2, r.y + r.h - 7);
  });

  // the strip under the tabs is the modal's voice — claim flash or promise
  ctx.textAlign = 'left';
  ctx.font = fontB(8);
  ctx.fillStyle = flash ? GOLD : INK_FAINT;
  ctx.fillText(flash ?? 'rewards land in your bag', TASKS_BAND.x + 10, TASKS_BAND.y + TASKS_BAND.h / 2 + 3);

  if (!views.length) {
    ctx.textAlign = 'center';
    ctx.font = font(9);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('ALL CLEAR — CHECK BACK AFTER THE RESET', TASKS_PANEL.x + TASKS_PANEL.w / 2, TASKS_ROWS_Y + 60);
  }

  views.forEach((v, i) => {
    const r = taskRowRect(i);
    const ready = v.done && !v.claimed;
    // a claimable row is the armed uiRow — GOLD slab + blinking ▶; the rest
    // stay bare list rows with a hairline seam under each
    if (ready) uiRow(ctx, r, '', { hot: true, t });
    ctx.fillStyle = 'rgba(40,48,88,0.12)';
    ctx.fillRect(r.x + 8, r.y + r.h + 2, r.w - 16, 1);

    const cr = taskClaimRect(r);
    const ix = cr.x - 12 - 28; // the reward icon rides just left of the slot
    const tx = r.x + 20; // the ▶ claims the left edge — text starts past it
    const textW = ix - 16 - tx; // label + bar share this width

    ctx.textAlign = 'left';
    fitFont(ctx, v.label, 9, textW - (v.done ? 56 : 0));
    ctx.fillStyle = v.claimed ? INK_FAINT : INK;
    ctx.fillText(v.label, tx, r.y + 17);
    ctx.font = fontB(7);
    ctx.fillStyle = v.claimed ? '#464e6e' : ready ? INK_SOFT : INK_FAINT;
    ctx.fillText(v.desc.toUpperCase(), tx, r.y + 28);
    if (v.done) {
      // the counter rides the label line once the slot holds CLAIM/CLAIMED;
      // unfinished rows wear it in the slot instead (the dimmed '0/15' state)
      ctx.font = fontB(9);
      ctx.textAlign = 'right';
      ctx.fillStyle = v.claimed ? INK_FAINT : ready ? INK : GOLD;
      ctx.fillText(`${v.have}/${v.n}`, tx + textW, r.y + 17);
      ctx.textAlign = 'left';
    }

    // the progress track is the settings slider's groove + gold ramp
    const br = { x: tx, y: r.y + 36, w: textW, h: 9 };
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
      g.addColorStop(0.55, GOLD);
      g.addColorStop(1, '#c8a44d');
      ctx.fillStyle = g;
      ctx.fillRect(br.x, br.y, Math.max(br.h, br.w * frac), br.h);
      ctx.restore();
    }
    roundRect(ctx, br.x, br.y, br.w, br.h, 5);
    ctx.strokeStyle = '#d0d0c8';
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
      // the armed claim pulses — a dark ink pill on the gold slab is the
      // loudest contrast in the kit; this modal exists for this tap
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 6 + (Math.sin(t * 4) * 0.5 + 0.5) * 8;
      pill(ctx, cr, { c: '#1b2140', cd: INK, tc: GOLD_HI, label: 'CLAIM' });
      ctx.restore();
    } else if (v.claimed) {
      ctx.font = fontB(7);
      const cw = ctx.measureText('CLAIMED').width + 14;
      chip(ctx, cr.x + (cr.w - cw) / 2, cr.y + (cr.h - 16) / 2, 'CLAIMED', { bg: '#d0d0c8', fg: INK_FAINT });
    } else {
      // not done — the slot holds the dimmed target where a button would be
      ctx.font = fontB(9);
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(`${v.have}/${v.n}`, cr.x + cr.w / 2, cr.y + cr.h / 2 + 4);
    }
  });

  // the bag preview — the screen's other half; claims land here
  const stock = bagStock();
  const stocked = BAG_ITEMS.filter((it) => (stock[it.id] ?? 0) > 0);
  const bagY = TASKS_CLOSE.y - 116;
  ctx.textAlign = 'left';
  ctx.font = font(8);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('YOUR BAG', TASKS_PANEL.x + 16, bagY);
  ctx.font = fontB(6);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('TAKE 2 INTO A RUN', TASKS_PANEL.x + 16, bagY + 11);
  if (!stocked.length) {
    ctx.font = fontB(7);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('EMPTY — CLAIM TASKS TO STOCK IT', TASKS_PANEL.x + 16, bagY + 42);
  }
  stocked.slice(0, 6).forEach((it, i) => {
    const cw = 74;
    const cx = TASKS_PANEL.x + 16 + (i % 3) * (cw + 8);
    const cy = bagY + 18 + Math.floor(i / 3) * 44;
    const r = { x: cx, y: cy, w: cw, h: 38 };
    uiWindow(ctx, r, { rad: 8, rim: false, shadow: false });
    const img = itemSprite(it.item);
    void loadItem(it.item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, r.x + 4, r.y + 8, 22, 22);
      ctx.restore();
    }
    ctx.font = fontB(6);
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = 'left';
    ctx.fillText(it.name.split(' ')[0], r.x + 30, r.y + 16);
    ctx.fillStyle = GOLD;
    ctx.fillText(`×${stock[it.id]}`, r.x + 30, r.y + 27);
  });

  // the × chip rides centered on the wide close rect — the tap zone
  // (TASKS_CLOSE) is bigger than the mark on purpose
  const cc = TASKS_CLOSE;
  uiClose(ctx, { x: cc.x + cc.w / 2 - cc.h / 2, y: cc.y, w: cc.h, h: cc.h });
  if (HAS_KEYS) keyHint(ctx, TASKS_CLOSE, '[esc]');
}
