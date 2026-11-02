import { itemSprite, loadItem, loadSprite, drawMon, drawShiny, drawNpc, loadNpcs, gracidea, whiteSprite } from '../core/assets';
import { drawMissionTicks } from './missions';
import { isMuted } from '../core/audio';
import { SpeciesDef, TOTAL_STAGES, INVADER_IDS, PULLABLE, DEX_ALL, PULL_COST, PULL10_COST, PULL_PITY, PULL_SHINY, PULL_RATES, shinyOdds, tierOf, speciesById, dustCost, AVATARS, STAGE_GIMMICKS } from './data';
import { abilityOf, abilityLabel, counterHint, countersGimmick } from './abilities';
import { gaugeCounter } from './gauge';
import { PERKS, RARITY_COLOR, BAG_ITEMS } from './perks';
import type { Perk, Rarity, BagItem } from './perks';
import { drawBackdrop, type Theme } from './bg';
import { drawTile } from './map';
import { drawShopScene, drawPullStage, drawCounterStrip, ballFor, ballDrop, DROP_H, DROP_SETTLE } from './home/shop';
import { TILE_GYM, TILE_GRASS, TILE_ROCK, TILE_BUSH, TILE_LAVA, TILE_BRICK, type TileRect } from './maptiles';
import { TYPE_COLOR, type PokeType } from './types';
import { roleOf, moveOf, superDesc } from './stats';
import { ULT_SHOTS } from './battle';
import { dexIds, settings, setSetting, bagStock, stars, raidDoneToday, pullCount, loginToday, dust, freePullLeft, trainerPick, setsReady, bondLv, coachDone, itemTier, ITEM_TIER_CAP, ITEM_PACK_COST, RANK_BALL, type Settings, type ClearCard, type ClearRank } from './meta';
import { tasksReady, taskResetsIn, featuredPull, dealPick, dealOff, dealCost, raidPick } from './tasks';
import { drawRaidLobby } from './home/raid';
import type { TaskView } from './tasks';
import { drawClimb, CLIMB_SCENE } from './home/climb';
export { FREE_BTN, RESTART_BTN, ASC_BTN, CLIMB_FREE, CLIMB_RAID, ascCellRect, hitAscCell, noteAscDeny, takeClimbSeed, pinClimbSeed, echoMonAt, freshClimb } from './home/climb';
import type { Vec } from '../core/vec';
import {
  INK, INK_SOFT, INK_FAINT, PAPER, PAPER_HI, PARCH, GOLD, GOLD_HI, ACCENT, DANGER,
  font, fontB, uiWindow, uiBand, uiPanel, uiRow, uiClose, cursorTri, scrim,
} from './ui';
import { drawMonsBody } from './home/mons';
export { DEX_BTN, SETS_BTN, PARTNERS_BTN, TEAM_BTN, EDIT_TEAM_BTN, partnersStripAt, teamStageAt } from './home/mons';
export { DEX_DETAIL_R, DEX_STATS, dexBuyRect, dexRowAt, dexScrollMax, dexStatsFlip, drawDex, drawDexDetail } from './home/mons';
import { drawTownBody } from './home/town';
export { ACH_BTN, BOARD_BTN, HALL_BTN, LAB_BTN, TASKS_BTN, TOWN_DOORS, TOWN_FOLK, TOWN_LOTS, TOWN_PLATES, townStrollAt } from './home/town';
export type { TownStroll } from './home/town';
export { HOF_CLIMB, OVL_CLOSE, achScrollMax, drawAch, drawBoard, drawLab, drawPauseCard, labHit, labScrollMax } from './home/overlays';
import { drawLoginDrop } from './home/overlays';

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
  rating: { delta: number; tier: string; color: string; up: boolean; down?: boolean }; // ladder movement this run
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
  bestCombo?: number; // longest pass-chain this run
  rankStreak?: number; // longest run of A-or-better stop clears
  loot?: number; // treasure balls opened this run
  secrets?: { n: number; of: number; fresh: number };
}

// --- draft layout: 3 offer cards, team strip at the bottom ---

const CARD_W = 162;
const CARD_H = 276;
const CARD_GAP = 9;
const CARDS_X = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
const CARDS_Y = 240;

export function draftCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: CARDS_Y, w: CARD_W, h: CARD_H };
}
export const DRAFT_REROLL = { x: W / 2 - 85, y: CARDS_Y + CARD_H + 12, w: 170, h: 40 };
// the quiet door out — nothing banks mid-draft, so a back link costs a tap
export const DRAFT_BACK = { x: 14, y: 30, w: 74, h: 26 };
// slot-reel reveal: each offer card spins a strip of pool faces that brakes
// onto the deal — staggered left to right. Spin age counts seconds.
export const REEL_STOPS = [0.7, 1.0, 1.3];

// --- bag row: pk_bag consumables ride the band between the draft ---
// --- subtitle and the offer cards. ≤2 picked into the run.
export const BAG_MAX = 2;
const BAG_CHIP_W = 74;
const BAG_CHIP_H = 46;
const BAG_CHIP_GAP = 8;
export const BAG_ROW = { x: 0, y: 178, w: W, h: 62 };
const BAG_CHIP_MIN = 44; // thumb floor — a fully stocked bag scrolls before chips crush past it
export function bagScrollMax(n: number) {
  return Math.max(0, n * BAG_CHIP_MIN + (n - 1) * BAG_CHIP_GAP - (W - 24));
}
export function bagChipRect(i: number, n: number, scroll = 0) {
  // a stocked-everything save can carry 7+ — chips shrink to the floor,
  // then the row scrolls like the box strip instead of bleeding off-screen
  const cw = Math.max(BAG_CHIP_MIN, Math.min(BAG_CHIP_W, Math.floor((W - 24 - (n - 1) * BAG_CHIP_GAP) / n)));
  const rowW = n * cw + (n - 1) * BAG_CHIP_GAP;
  const off = Math.max(0, (W - 24 - rowW) / 2); // centered while it fits, left-anchored past it
  return { x: 12 + off + i * (cw + BAG_CHIP_GAP) - scroll, y: BAG_ROW.y + 12, w: cw, h: BAG_CHIP_H };
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
// RESTART sits under it full-width — a parked climb's burn-and-deal-again
// door, drawn only while a save exists
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
// the report link + build hash live under the nav in the dead strip at the
// screen's very bottom — always visible, never competing with the board
export const BUG_BTN = { x: 10, y: H - 22, w: 96, h: 16 };
export const BUG_HIT = { x: 0, y: H - 44, w: 130, h: 44 };
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
  inkCenter(ctx, '?', cx, cy);
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

// invisible hit margin around a drawn target — the drawn-vs-live rect pattern
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
export function perkCardRect(i: number, n = 3, dy = 0) {
  if (n >= 4) {
    const gx = (W - (2 * CARD_W + CARD_GAP)) / 2;
    return { x: gx + (i % 2) * (CARD_W + CARD_GAP), y: 376 + dy + Math.floor(i / 2) * 266, w: CARD_W, h: 200 };
  }
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: 380 + dy, w: CARD_W, h: 200 };
}
// the charm board's own card slot — draw and hit share the one function so
// the 3-offer row can't drift from its tap zones. 3 offers sit in a centered
// window (cards dy −80); the 2×2 board fills the tall one (dy −140).
export function charmCardRect(i: number, n: number) {
  return perkCardRect(i, n, n >= 4 ? -140 : -72);
}
export function charmSkipRect(n: number) {
  // rides under the board — the 2×2's second row pushes it past the 3-card slot
  return { x: W / 2 - 90, y: n >= 4 ? 716 : 520, w: 180, h: 40 };
}
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
export const BOX_STRIP = { x: 24, y: 528, w: W - 48, h: 64 };
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
  return { x: W / 2 - (4 * (w + gap) - gap) / 2 + i * (w + gap), y: 618, w, h: 100 };
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

// PS2P glyphs carry side-bearings and sit high in the em box, so a centered
// fillText lands their ink off the box center. Measure the real ink box and
// draw so it centers at (cx, cy) — the corner-badge '?' uses this.
function inkCenter(ctx: CanvasRenderingContext2D, ch: string, cx: number, cy: number) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch);
  const l = m.actualBoundingBoxLeft ?? 0;
  const inkW = l + (m.actualBoundingBoxRight ?? m.width);
  const asc = m.actualBoundingBoxAscent ?? 0;
  const desc = m.actualBoundingBoxDescent ?? 0;
  ctx.fillText(ch, cx - l - inkW / 2, cy + (asc - desc) / 2);
}

// speaker glyph + slash — shared by the title badge and the mid-run chip.
// color/muted default to the live mute state; the settings tab overrides both.
// The cone + arcs span [-8s, +12s]; shifting 2s left centers the ink on cx.
function speakerGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, muted = isMuted(), color = PARCH) {
  cx -= 2 * s;
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
    ctx.fillRect(-1.9 * s, -10.4 * s, 3.8 * s, 4.4 * s);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 2 * s, 0, Math.PI * 2);
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
export function ballGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
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

export function rim(
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
export function fillStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
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
export function fitFontB(ctx: CanvasRenderingContext2D, label: string, px: number, maxW: number) {
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
// greedy wrap into at most n lines, stepping the font down until all of it
// fits: card blurbs never get cut or ellipsized
export function fitWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, n: number, minPx = 9) {
  for (let size = px; ; size -= 0.5) {
    ctx.font = fontB(size);
    const lines: string[] = [];
    let cur = '';
    for (const wd of text.split(' ')) {
      const t = cur ? `${cur} ${wd}` : wd;
      if (!cur || measureW(ctx, t) <= maxW) cur = t;
      else {
        lines.push(cur);
        cur = wd;
      }
    }
    if (cur) lines.push(cur);
    if (size <= minPx || (lines.length <= n && lines.every((l) => measureW(ctx, l) <= maxW))) return lines.slice(0, n);
  }
}

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
    // don't slice mid-word — back off to the last space inside the fit
    const sp = rest.lastIndexOf(' ', lo);
    if (sp > 0) lo = sp;
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
  // fitFont floors at 6px — a still-long label ellipsizes rather than spill
  const fit = fitFont(ctx, label, 13, r.w - 20 - ic);
  let lab = label;
  if (fit <= 6) while (lab.length > 3 && measureW(ctx, lab + '…') > r.w - 20 - ic) lab = lab.slice(0, -1);
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? INK : INK_FAINT;
  ctx.fillText(fit <= 6 && lab !== label ? lab + '…' : label, r.x + ic + (r.w - ic) / 2, r.y + r.h / 2 + 6);
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
  ctx.font = fontB(Math.max(10, o.fontPx ?? 10));
  const w = ctx.measureText(text).width + 14;
  roundRect(ctx, x, y, w, 20, 8);
  ctx.fillStyle = o.bg;
  ctx.fill();
  ctx.fillStyle = o.fg;
  const pa = ctx.textAlign;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 7, y + 15);
  ctx.textAlign = pa;
  return w;
}

// '[1]'-style key affordance, tucked bottom-right inside a card — same dark
// chip style as the kind pill
export function keyHint(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string) {
  ctx.font = fontB(10);
  const w = ctx.measureText(label).width + 14;
  chip(ctx, r.x + r.w - w - 8, r.y + r.h - 24, label, { bg: INK, fg: PAPER });
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
    ctx.font = fontB(10);
    bw = ctx.measureText(o.badge).width + 10;
  }
  const cy = r.y + (r.h - rimH) / 2 + (o.pressed ? 2 : 0);
  const pa = ctx.textAlign;
  ctx.textAlign = 'center';
  ctx.fillStyle = tc;
  fitFont(ctx, o.label, o.sub ? 9 : 10, r.w - 24 - bw);
  ctx.fillText(o.label, r.x + r.w / 2 - bw / 2, cy + (o.sub ? -1 : 5));
  if (o.sub) {
    ctx.font = fontB(10);
    ctx.globalAlpha = 0.7;
    ctx.fillText(o.sub, r.x + r.w / 2 - bw / 2, cy + 12);
    ctx.globalAlpha = 1;
  }
  if (o.badge) {
    const bx = r.x + r.w - bw - 8;
    roundRect(ctx, bx, cy - 7, bw, 14, 7);
    ctx.fillStyle = 'rgba(42,36,64,0.4)';
    ctx.fill();
    ctx.font = fontB(10);
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

// Wild mons at the screen edges — the stadium crowd, clear of the pitch
const WILD_MONS: [number, number, number][] = [
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

export function monShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
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

function drawWildMons(ctx: CanvasRenderingContext2D, t: number) {
  WILD_MONS.forEach(([id, x, y], i) => {
    // a slow graze loop — each wild wanders a small ellipse around its spot
    const wx = x + Math.sin(t * 0.21 + i * 2.1) * 22;
    const wy = y + Math.sin(t * 0.34 + i * 1.3) * 10;
    monShadow(ctx, wx, wy, 34);
    drawMon(ctx, id, wx, wy, 34);
  });
}

// the login drop reads as a pop, not a ledger line — a gold banner that
// floats over the pitch for the first seconds of the session's first title
let loginT0 = -1;

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  t: number,
  cont: { stage: number; score: number; seed: number } | null = null,
  restartArmed = false, // RESTART's own two-tap — warn-red face while it's lit
  tab: HomeTab,
  pack: { arm: boolean; flash: string | null } = { arm: false, flash: null },
) {
  // meta getters each hit localStorage + JSON.parse — one read each per frame
  const starN = stars();
  // the tab dots read these on every tab — the bodies get them passed in
  // rather than paying for a second parse
  const taskN = tasksReady();
  const freeNow = freePullLeft();

  drawField(ctx);
  drawWildMons(ctx, t);

  // stadium shadow at the edges keeps the eye on logo + impact
  const vig = gradFor(ctx, 'vignette', (cc) => {
    const rg = cc.createRadialGradient(W / 2, 400, 280, W / 2, 400, 640);
    rg.addColorStop(0, '#00000000');
    rg.addColorStop(1, 'rgba(6,14,6,0.2)');
    return rg;
  });
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // bodies rise ~12px into place on a tab swap — the same stamp that eases
  // the outgoing card down; past 0.22s the offset is exactly zero
  const rise = swapFrom ? (1 - clamp01((t - swapT) / 0.22)) * 12 : 0;
  ctx.save();
  if (rise > 0.05) ctx.translate(0, rise);
  if (tab === 'climb') drawClimbBody(ctx, t, cont, restartArmed);
  else if (tab === 'shop') drawShopBody(ctx, t, freeNow, pack.arm, pack.flash);
  else if (tab === 'mons') drawMonsBody(ctx, t);
  else if (tab === 'raid') drawRaidBody(ctx, t);
  else drawTownBody(ctx, t, taskN);
  ctx.restore();

  // chrome draws OVER the body — the wallet bar and corner badges ride every
  // tab, so a body's own ground (town tiles to y0) can't bury them
  // the wallet rides top-center like a Clash Royale gold bar — stars and
  // dust on the title mean the economy is visible before any overlay opens
  // center 44 matches the corner badges' (22 + 44/2)
  balanceChip(ctx, { x: W / 2 - 92, y: 26, w: 184, h: 36 }, starN, dust());

  // corner badges are chrome, not body — they ride every tab: how-to-play,
  // mute, settings
  cornerBadge(ctx, HELP_BTN, { dither: 0.09 });
  ctx.font = font(18);
  ctx.fillStyle = PARCH;
  inkCenter(ctx, '?', HELP_BTN.x + HELP_BTN.w / 2, HELP_BTN.y + HELP_BTN.h / 2);
  const mcx = MUTE_BTN.x + MUTE_BTN.w / 2, mcy = MUTE_BTN.y + MUTE_BTN.h / 2;
  cornerBadge(ctx, MUTE_BTN, { dither: 0.09 });
  speakerGlyph(ctx, mcx, mcy, 1);
  cornerBadge(ctx, GEAR_BTN, { dither: 0.09 });
  gearGlyph(ctx, GEAR_BTN.x + GEAR_BTN.w / 2, GEAR_BTN.y + GEAR_BTN.h / 2, 1.5, PARCH);

  // the floating nav draws last — no body should peek through under it
  drawTabBar(ctx, t, tab, freeNow, taskN);
}

// the run tab — today's title minus the meta chips the bottom nav now owns
function drawClimbBody(
  ctx: CanvasRenderingContext2D,
  t: number,
  cont: { stage: number; score: number; seed: number } | null,
  restartArmed: boolean,
) {
  drawClimb(ctx, t, cont, restartArmed, logoBig);

  // the day's login drop — a gold banner over the pitch top for the first
  // seconds on title, so the calendar reads as a reward, not a ledger line
  const lt = loginToday();
  if (lt) {
    if (loginT0 < 0) loginT0 = t;
    const age = t - loginT0;
    if (age < 6) drawLoginDrop(ctx, lt, CLIMB_SCENE.y + 96, Math.min(1, (6 - age) / 1.5));
  }

  // build tag — bug reports should name their build
  ctx.font = fontB(10);
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
  uiWindow(ctx, TAB_BAR, { dark: true, rad: 18 });

  void loadItem('poke-ball');
  void loadItem('master-ball');
  void loadItem('town-map');
  void loadNpcs();
  void loadSprite(25).catch(() => {});
  const raidId = raidPick().id;
  void loadSprite(raidId).catch(() => {});

  for (const cell of TAB_CELLS) {
    const on = cell.tab === active;
    const cx = cell.x + cell.w / 2;
    const rest = { x: cell.x + 3, y: cell.y + 3, w: cell.w - 6, h: cell.h - 6 };
    const big = { x: cell.x + 3, y: cell.y - 10, w: cell.w - 6, h: cell.h + 7 };
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
    cell.hit.x = Math.min(cell.x, pr.x);
    cell.hit.y = Math.min(cell.y, pr.y);
    cell.hit.w = Math.max(cell.x + cell.w, pr.x + pr.w) - cell.hit.x;
    cell.hit.h = Math.max(cell.y + cell.h, pr.y + pr.h) - cell.hit.y;
    if (lit) {
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.save();
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.clip();
      const crown = ctx.createLinearGradient(0, pr.y, 0, pr.y + pr.h);
      crown.addColorStop(0, GOLD_HI);
      crown.addColorStop(0.2, GOLD);
      crown.addColorStop(1, GOLD);
      ctx.fillStyle = crown;
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.stroke();
    } else {
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.fillStyle = '#343c62';
      ctx.fill();
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 2;
      roundRect(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.stroke();
    }

    const pop = on ? Math.max(0, 1 - (t - tabPressT) / 0.16) : 0;
    const iconY = pr.y + 27;
    const iconSize = 38 + 8 * grow;
    const spr = cell.tab === 'shop' ? itemSprite('poke-ball')
      : cell.tab === 'raid' ? itemSprite('master-ball')
        : cell.tab === 'town' ? itemSprite('town-map')
          : undefined;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(cx, iconY);
    ctx.scale(1 - 0.1 * pop, 1 - 0.1 * pop);
    if (cell.tab === 'mons') {
      try {
        drawMon(ctx, 25, 0, 0, iconSize);
      } catch {
        ballGlyph(ctx, 0, 0, 1, PAPER);
      }
    } else if (cell.tab === 'raid') {
      try {
        drawMon(ctx, raidId, 0, 0, iconSize);
      } catch {
        if (spr) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(spr, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
        }
      }
    } else if (cell.tab === 'climb') {
      if (!drawNpc(ctx, 'hiker_down_0', 0, iconSize / 2, iconSize)) peakGlyph(ctx, 0, 0, 1, PAPER);
    } else if (spr) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    }
    ctx.restore();

    ctx.font = fontB(on ? 14 : 13);
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? INK : PAPER;
    ctx.fillText(cell.tab.toUpperCase(), cx, pr.y + pr.h - 10);

    const bx = pr.x + pr.w - 9, by = pr.y + 9;
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
      ctx.font = fontB(10);
      ctx.textAlign = 'center';
      ctx.fillStyle = PAPER;
      ctx.fillText(taskN > 9 ? '9+' : `${taskN}`, bx, by + 3.5);
    }
  }
}

// --- MONS: the creature loop — hatcher hero, dex card, latest catches -----
// --- SHOP: stars and sparks in, mons out — hatcher hero + the daily deal ---
function drawShopBody(
  ctx: CanvasRenderingContext2D,
  t: number,
  freeNow: boolean,
  packArmed = false,
  packFlashId: string | null = null,
) {
  drawShopScene(ctx, SHOP_SCENE, t, featuredPull());

  // the focal pull — gold when it can fire, pity pips under the label
  const hb = HATCH_BTN;
  const canPull = freeNow || stars() >= PULL_COST;
  if (freeNow) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(t * 5) * 0.3;
    ctx.strokeStyle = '#ffe89d';
    ctx.lineWidth = 3;
    roundRect(ctx, hb.x - 4, hb.y - 4, hb.w + 8, hb.h + 8, 17);
    ctx.stroke();
    ctx.restore();
  }
  uiWindow(ctx, hb, { tint: canPull ? GOLD_HI : '#d8d8d0', rad: 14 });
  const star = itemSprite('star-piece');
  void loadItem('star-piece');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = font(15);
  const lab = freeNow ? 'FREE PULL' : 'PULL';
  const cost = freeNow ? '' : `${PULL_COST}`;
  const lw = ctx.measureText(lab).width;
  ctx.font = fontB(15);
  const cw = cost ? 12 + 24 + 4 + ctx.measureText(cost).width : 0;
  let lx = hb.x + (hb.w - lw - cw) / 2;
  ctx.font = font(15);
  ctx.fillStyle = canPull ? INK : INK_FAINT;
  ctx.fillText(lab, lx, hb.y + 40);
  if (cost) {
    lx += lw + 12;
    if (star) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(star, lx, hb.y + 17, 24, 24);
      ctx.restore();
    }
    ctx.font = fontB(15);
    ctx.fillStyle = canPull ? INK : DANGER;
    ctx.fillText(cost, lx + 28, hb.y + 38);
  }
  const done = pullCount() % PULL_PITY;
  const pipW = 14, px0 = hb.x + 22;
  for (let i = 0; i < PULL_PITY; i++) {
    ctx.fillStyle = i < done ? GOLD : 'rgba(40,48,88,0.22)';
    ctx.beginPath();
    ctx.arc(px0 + i * pipW + 5, hb.y + 63, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // the pips count pulls toward the pity roll — say so, same words the
  // hatcher's own meter uses
  ctx.textAlign = 'right';
  ctx.font = fontB(11);
  ctx.fillStyle = done === PULL_PITY - 1 ? INK : INK_SOFT;
  ctx.fillText(done === PULL_PITY - 1 ? 'NEXT PULL · RARE+' : `RARE+ IN ${PULL_PITY - done}`, hb.x + hb.w - 18, hb.y + 67);
  // the ×10 and the spark exchange live inside the hatcher — this opens it
  const mb = SHOP_MORE_BTN;
  uiWindow(ctx, mb, { rad: 14 });
  ctx.textAlign = 'center';
  ctx.font = font(13);
  ctx.fillStyle = INK;
  ctx.fillText('×10', mb.x + mb.w / 2, mb.y + 34);
  ctx.font = fontB(13);
  const c10 = `${PULL10_COST}`;
  const c10w = 22 + ctx.measureText(c10).width;
  if (star) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(star, mb.x + (mb.w - c10w) / 2, mb.y + 41, 18, 18);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = stars() >= PULL10_COST ? GOLD : DANGER;
  ctx.fillText(c10, mb.x + (mb.w - c10w) / 2 + 22, mb.y + 56);
  ctx.textAlign = 'center';
  ctx.font = fontB(11);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('SPARKS · ODDS ›', mb.x + mb.w / 2, mb.y + 74);

  // the day's spark bargain — price, list price, and when it rolls over
  const dr = DEAL_BTN;
  const dc = uiPanel(ctx, dr, `DAILY DEAL · −${dealOff()}%`);
  const deal = dealPick();
  const dcx = dr.x + 80, dcy = dc.y + 40;
  ctx.fillStyle = `${TYPE_COLOR[deal.type]}30`;
  ctx.beginPath();
  ctx.ellipse(dcx, dcy + 34, 56, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  monShadow(ctx, dcx, dcy, 72);
  try {
    drawMon(ctx, deal.id, dcx, dcy + Math.sin(t * 2.4) * 2.5, 72);
  } catch {
    void loadSprite(deal.id).catch(() => {});
  }
  const tx2 = dr.x + 150;
  const chip = { x: dr.x + dr.w - 112, y: dc.y + 4, w: 96, h: 54 };
  ctx.textAlign = 'left';
  const dn = deal.name.toUpperCase();
  fitFont(ctx, dn, 13, chip.x - 12 - tx2);
  ctx.fillStyle = INK;
  ctx.fillText(dn, tx2, dc.y + 24);
  ctx.font = fontB(12);
  ctx.fillStyle = TYPE_COLOR[deal.type];
  ctx.fillText(deal.type2 ? `${deal.type} · ${deal.type2}`.toUpperCase() : deal.type.toUpperCase(), tx2, dc.y + 47);
  const price = dealCost(deal);
  const ps = `◆ ${price}`;
  ctx.font = fontB(16);
  ctx.fillStyle = dust() >= price ? ACCENT : DANGER;
  ctx.fillText(ps, tx2, dc.y + 80);
  const pw = ctx.measureText(ps).width;
  ctx.font = fontB(12);
  const wl = `was ◆ ${dustCost(deal)}`;
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(wl, tx2 + pw + 12, dc.y + 78);
  ctx.strokeStyle = INK_FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx2 + pw + 12, dc.y + 73);
  ctx.lineTo(tx2 + pw + 12 + ctx.measureText(wl).width, dc.y + 73);
  ctx.stroke();
  uiWindow(ctx, chip, { tint: PARCH, rad: 8, rim: false, shadow: false });
  ctx.textAlign = 'center';
  ctx.font = fontB(11);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('ENDS', chip.x + chip.w / 2, chip.y + 21);
  ctx.font = font(10);
  ctx.fillStyle = INK;
  ctx.fillText(taskResetsIn('daily'), chip.x + chip.w / 2, chip.y + 44);
  ctx.textAlign = 'right';
  ctx.font = fontB(12);
  ctx.fillStyle = ACCENT;
  ctx.fillText('VIEW ›', dr.x + dr.w - 18, dc.y + 80);

  // the upgrade rack — held items tier up off cheap dust packs; the shelf
  // lists every bag item's pips so a pack's bump has a visible home, and
  // the pill is the right column so the shelf doesn't fight it
  const ur = UPGRADES_BTN;
  const uc = uiPanel(ctx, ur, 'ITEM UPGRADES', { sub: 'PIPS = TIER · MAX 5' });
  const pk = PACK_PILL;
  const rackW = pk.x - 12 - uc.x;
  const pitch = Math.floor((rackW - 28) / 6);
  const x0 = uc.x + 14 + (rackW - 28 - pitch * 6) / 2;
  BAG_ITEMS.forEach((it, i) => {
    const col = i % 7, row = (i / 7) | 0;
    const cx = x0 + col * pitch;
    const cy = uc.y + 16 + row * 44;
    // ghosted = none in the bag — its tier just waits for stock to land
    ctx.globalAlpha = (bagStock()[it.id] ?? 0) > 0 ? 1 : 0.55;
    const spr = itemSprite(it.item);
    void loadItem(it.item);
    if (spr) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, cx - 14, cy - 14, 28, 28);
      ctx.restore();
    }
    const tt = itemTier(it.id);
    for (let p = 0; p < ITEM_TIER_CAP; p++) {
      ctx.fillStyle = p < tt ? GOLD : 'rgba(40,44,70,0.25)';
      ctx.beginPath();
      ctx.arc(cx - 12 + p * 6, cy + 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  // the pack pill arms like a spark buy — first tap reads its cost, second pays
  const maxed = BAG_ITEMS.every((i) => itemTier(i.id) >= ITEM_TIER_CAP);
  const canPay = dust() >= ITEM_PACK_COST;
  roundRect(ctx, pk.x, pk.y, pk.w, pk.h, 12);
  ctx.fillStyle = packArmed ? '#1a2a4a' : maxed || !canPay ? '#3a3f58' : GOLD;
  ctx.fill();
  ctx.strokeStyle = packArmed ? '#8ab8ff' : INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = fontB(12);
  ctx.fillStyle = packArmed ? '#c8dcff' : maxed || !canPay ? '#9aa2c0' : INK;
  ctx.fillText(maxed ? 'ALL MAXED' : packArmed ? 'TAP AGAIN' : 'UPGRADE', pk.x + pk.w / 2, pk.y + 28);
  ctx.fillText(maxed ? '' : packArmed ? 'TO BUY' : 'PACK', pk.x + pk.w / 2, pk.y + 45);
  ctx.font = fontB(13);
  ctx.fillStyle = packArmed ? '#9df0ff' : maxed || !canPay ? '#8a92b0' : INK;
  ctx.fillText(`◆ ${ITEM_PACK_COST}`, pk.x + pk.w / 2, pk.y + 64);
  if (packFlashId) {
    ctx.fillStyle = GOLD;
    const fn = BAG_ITEMS.find((i) => i.id === packFlashId)?.name.toUpperCase() ?? '';
    fitFontB(ctx, `${fn} T${itemTier(packFlashId)}!`, 10, rackW);
    ctx.fillText(`${fn} T${itemTier(packFlashId)}!`, uc.x + rackW / 2, ur.y + ur.h - 9);
  }
}

// --- MONS: the collection — dex, evolution sets, latest catches ------------
// --- RAID: the day's seeded chroma boss — free retries till it falls ------
function drawRaidBody(ctx: CanvasRenderingContext2D, t: number) {
  drawRaidLobby(ctx, t, RAID_FIGHT);
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
    'We collect no telemetry · your report',
    'IS the log. To file one:',
    '',
    '1. Screenshot what broke (a crash',
    '    paints its own receipt).',
    '2. Include the line below.',
    "3. Note what you tapped last.",
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, r.y + 78 + i * 20));
  ctx.font = fontB(10);
  ctx.fillStyle = GOLD;
  ctx.fillText(seed != null ? `SEED ${seed} · ${__BUILD__}` : `BUILD ${__BUILD__}`, W / 2, r.y + 250);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('post it where you found the build', W / 2, r.y + 276);
  ctx.fillText('tap anywhere to close', W / 2, r.y + r.h - 18);
}

// --- help overlay: job-board paper cards, one idea each beside a real ------
// --- asset (mon front, item, badge, gracidea tile, battle-anim frame) ------

// a dex id draws the FRLG front · a string is an item path for loadItem
// ('badges/1', 'anims/<sheet>' crops frame 0) · a TileRect blits gracidea
type HelpIcon = number | string | TileRect;
type HelpCard = readonly [HelpIcon, string];

interface HelpSection {
  title: string;
  cards: HelpCard[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'AIM & POWER',
    cards: [
      ['poke-ball', 'pull back anywhere: the dotted line is the flight path'],
      ['great-ball', 'pull distance only aims · power is where you let go on the meter'],
      ['master-ball', 'let go inside the gold band for a PERFECT full-power shot'],
      [135, 'fast mons aim high and tight; stronger mons get a faster sweep'],
      ['wide-lens', 'the band drifts a little every pull · read it, don\'t memorize'],
      ['quick-claw', 'speed dies fast after 1.5s · the early banks hit hardest'],
    ],
  },
  {
    title: 'ALLY CHAINS',
    cards: [
      [25, 'fly through a teammate mid-flight · a READY ally fires its super'],
      ['muscle-band', 'each pass adds damage and speed, so route through allies'],
    ],
  },
  {
    title: 'RICOCHET',
    cards: [
      ['anims/impact', 'two different touches (foe, ally, wall, stone) in 0.35s flash RICOCHET!'],
      ['metronome', "hitting the same thing twice doesn't count"],
      ['grip-claw', 'relics cash it in: Binding Band +40% hits, Ether feeds a pip'],
    ],
  },
  {
    title: 'CHARGE PIPS',
    cards: [
      ['elixir', 'shots and KOs fill the gold pips under each mon · all-gold means READY'],
      ['power-herb', 'launch a READY mon and its super fires from the sling (STRIKE SHOT)'],
    ],
  },
  {
    title: 'ENEMIES',
    cards: [
      ['anims/gold_ring', 'a foe strikes when its number hits 0 · each shot you take ticks one down'],
      ['scope-lens', 'at 1 the move shows its target · a dashed line or a ghosted footprint'],
      [56, 'melee countdowns start low · thin them out first'],
      ['star-piece', 'gold stars mark weak spots · some hide till first contact · ×2, bosses ×3'],
      [TILE_GYM, 'BOSSES fight in 3 bars · new court, new adds, the weak spot moves'],
      [150, 'a boss ★ clock is its signature move · HEAVY hits the whole team'],
      [130, 'bar 3 is RAGE · every boss clock starts a turn sooner'],
      [91, 'shelled foes glance hits off the plate · bank around the back for a FLANK'],
      [28, 'spiked foes bite the ball on contact · hit them clean, don\'t graze'],
      ['leftovers', 'regen foes mend over time · burst them down, don\'t whittle'],
      ['anims/orbs', 'split foes divide when KO\'d · expect two where one fell'],
      [57, 'rage foes snap under 30% · a wounded one swings faster'],
      [143, 'zZ foes doze till hit · the wake-up shot lands like a crit'],
      ['bright-powder', 'gold halos repel the ball · bank in behind or punch through fast'],
      [52, 'thieves dash at your field drops · grab the loot or drop them first'],
      ['wide-lens', 'volley foes fan their shot across three mons · kill the cannon first'],
      [63, 'blink foes flicker before they teleport · hold the shot a beat'],
      [293, 'SOS callers cry for backup · silence them before the field floods'],
      [132, 'mirror blobs transform into your strongest · feed them a weak lead'],
      [100, 'FUSE foes detonate at zero · kill fast, or bait the blast into its pack'],
      ['razor-claw', 'HUNTER foes stalk your weakest · park a tank between them'],
      ['big-root', 'LEECH foes heal off every hit · burst them, don\'t trade chips'],
      ['sign', 'tap (don\'t pull) a foe to scout its name, hp, and next move'],
    ],
  },
  {
    title: 'FOE AILMENTS',
    cards: [
      [43, 'SLEEP powder drops a mon a whole turn · sleepers can\'t bump either'],
      ['poison-barb', 'VENOM stings leave a wound that bleeds a tick a round'],
      ['charcoal', 'WISP flames burn · the victim singes and hits softer'],
      ['magnet', 'JOLT waves paralyze · the shocked mon\'s launch limps'],
      [89, 'TOXIC hides poison the ball on contact · kill them with banks'],
      [125, 'STATIC hides paralyze on contact · touch once, hard'],
      [126, 'FLAME hides burn on contact · seared hits lose heat'],
      [35, 'CHARM hides lull the striker · contact can put it to sleep'],
      [46, 'SPORE hides scatter a random ailment on contact'],
      [196, 'SYNC foes echo their status · burn one and it burns you back'],
      [147, 'SHED foes shrug off poison, burns and sleep · burst them'],
      ['anims/poison_bubble', 'P-HEAL foes mend off your poison · burn them instead'],
      [134, 'DRAIN foes absorb their element · same-type hits heal them'],
      ['potion', 'H-BLOCK foes stop your heals · kill the blocker to mend'],
      ['anims/shadow_ball', 'BOND foes drag down whoever lands the KO · finish them with hazards or a catch'],
    ],
  },
  {
    title: 'FOE TELLS',
    cards: [
      [24, 'MENACE foes intimidate · your hits lose a fifth while they live'],
      [292, 'W-GUARD only falls to super-effective hits · slams still count'],
      [74, 'STURDY foes hang on at 1 HP · the first kill shot only wounds'],
      [149, 'SCALE hides half damage at full HP · chip it open first'],
      [66, 'GUTS foes hit harder while statused · kill them clean'],
      [287, 'LOAF foes truant · they fire once, then loiter a round'],
      [291, 'BOOST foes speed up every attack · kill them early'],
      [144, 'PRESSURE halves your super charge · legends bend the economy'],
      ['choice-specs', 'BEAM foes lock a lane · the dashed line telegraphs the burn'],
      [50, 'TRAP foes leash the court · the ball can\'t flee while they live'],
      [324, 'SKY callers summon weather · Torkoal brings the drought'],
      [351, 'a ball matching the sky launches faster · draft into the weather'],
      [202, 'COUNTER foes return a third of contact · chip, don\'t crit'],
      ['kings-rock', 'ALPHA foes rally the pack · kill the leader first'],
      [128, 'CHARGE foes paw the ground, then ram · shove them off-line'],
      [302, 'PRANK foes strike early · expect an ambush opener'],
      ['amulet-coin', 'THIEF foes snatch your pickups · KO them to take it back'],
      ['anims/splash', 'SWIFT foes press 1.5× harder in their own sky'],
      ['anims/rocks', 'SPIKER foes seed your half with spikes · the court fills while they live'],
      [41, 'SONIC foes rattle your aim · a touched mon launches off-line'],
      ['iron', 'ANCHOR foes cannot be shoved · no herding them into hazards'],
      [141, 'ARMOR foes shrug off crits · out-muscle them straight'],
    ],
  },
  {
    title: 'FIELD PICKUPS',
    cards: [
      ['stardust', 'each wave seeds a pickup · the colored ring and tag name it'],
      ['lum-berry', 'LUM BERRY cures the team · it only drops when someone is sick'],
      ['protein', 'berry heals the team, protein buffs the shot, elixir charges pips'],
      ['sitrus-berry', 'pickups ripen if ignored · ORAN → SITRUS, PROTEIN → X ATTACK, ELIXIR → MAX ELIXIR'],
      ['pp-up', 'PP UP adds one ULT charge · CHESTO BERRY winds every foe clock back'],
      ['oran-berry', 'some courts drop berries on KOs · DRAIN foes heal off their hits'],
      ['anims/ice_crystals_0', 'SAFEGUARD foes take no damage · grab a berry to break it'],
      ['power-herb', 'fly through the glowing item to collect on touch'],
      ['lucky-egg', 'one spawns each wave, two when something big lurks'],
    ],
  },
  {
    title: 'CATCHING',
    cards: [
      ['poke-ball', 'beaten foes sometimes drop a ball: catches go to your box'],
      ['great-ball', 'weak foes join easy · ones far above your ace all but refuse'],
      ['ultra-ball', 'a catch joins at your team\'s level, never above it'],
      ['badges/2', 'beat a gym and its ace joins your box too'],
      ['friend-ball', 'a duplicate feeds the copy you own: +1 LUCK every fusion'],
      ['amulet-coin', 'luck pays out in gym loot'],
      [133, 'split evolutions (Eevee, Tyrogue…) ask which form after the fight'],
    ],
  },
  {
    title: 'LEVELING UP',
    cards: [
      ['exp-share', 'every KO levels the mon that launched the shot · the rest of the team learns a little too'],
      ['macho-brace', 'tougher foes teach more · cap Lv100, levels survive evolution'],
      ['badges/3', 'each win raises ASCENSION: foes get tougher and faster'],
      ['dire-hit', 'ASC buys perks: a second charm (3), weaker rests (4), enraged gyms (6)'],
    ],
  },
  {
    title: 'THE CLIMB',
    cards: [
      [TILE_GYM, '9 stages, a gym every 3rd: pick your route on the map'],
      ['choice-band', 'after each fight: fix the lineup first, then take an item'],
      ['dusk-ball', 'lose and your fallen team returns next run as the rival'],
      ['badges/8', 'every run moves your ladder rating · wins climb, wipes drop'],
      [TILE_GRASS, 'wild stops run 2 to 4 battles against a turn par'],
      ['star-piece', 'CLEAR card: S on par with no faints · S A B pay star pieces'],
    ],
  },
  {
    title: 'MAP STOPS',
    cards: [
      ['revive', 'rests heal and revive · chests pay an item · a fight still follows'],
      ['black-belt', 'trainer squads pay better loot but can\'t be caught'],
      ['adamant-orb', 'ELITE doors fight deeper and pay rare+ relics'],
      ['moomoo-milk', '??? is a surprise · heal, haul, or ambush'],
      [146, 'S or A gym clear may open a SECRET lair · win: the legend joins + star pieces · lose: it flees, the climb goes on'],
    ],
  },
  {
    title: 'SHINIES & STREAKS',
    cards: [
      ['shiny-charm', 'gold-tinted foes are rare: KO one and it always joins your box'],
      ['expert-belt', 'perfect releases build a streak · each one hits a bit harder'],
    ],
  },
  {
    title: 'STONE WALLS',
    cards: [
      [TILE_ROCK, 'boulder clusters wall off the lane: the ball banks right off them'],
      ['hard-stone', 'boulder bounces count as wall hits: banking still pays damage'],
      [TILE_BUSH, 'ROCK SMASH rocks break in 3 hits · CUT trees in 2, or 1 from Grass'],
      [68, 'STRENGTH boulders shove one cell when you hit them hard'],
    ],
  },
  {
    title: 'FIELD GIMMICKS',
    cards: [
      [TILE_LAVA, 'red zones chip the ball, violet ones silence supers · foes ignore both'],
      ['float-stone', 'warp pads teleport, green pads boost, dark wells bend the path'],
      [TILE_BRICK, 'DMG WALL edges fade in, then bite any mon that banks off them'],
      ['metronome', 'walls switch by turn · NEXT TURN marks the edge about to light'],
      [92, 'DMG WALLs spare their own type · stop tags name the ABILITY that helps'],
      [18, 'PIDGEOT wind strips push the ball sideways · FLYING or LEVITATE ignore them'],
      [81, 'MAGNEMITE posts hold a beam that blocks and chips the ball · 2 hits on a post drop it'],
      ['magnet', 'ELECTRIC or VOLT ABSORB mons pass straight through the beam'],
    ],
  },
  {
    title: 'TYPE TRAITS',
    cards: [
      ['silk-scarf', 'field 2+ of a type for a team-wide bonus · shinies count double'],
      [6, 'dual-typed mons count for both types and strike with whichever hits harder'],
      ['eviolite', 'the chips on the map screen show what your team is running'],
    ],
  },
  {
    title: 'SUPER INDEX I',
    cards: [
      ['anims/punch_impact', 'NORMAL dash-slams the nearest · FIGHTING rains meteors'],
      ['anims/rocks', 'ROCK rains meteors · FLYING piles foes with a vortex'],
      ['mystic-water', 'WATER sends homing orbs · ELECTRIC chains lightning'],
    ],
  },
  {
    title: 'SUPER INDEX II',
    cards: [
      ['miracle-seed', 'GRASS drains foes to heal · POISON bleeds foes each shot'],
      ['charcoal', 'FIRE flame ring + fireballs · GHOST hexes every foe'],
      ['twisted-spoon', 'PSYCHIC shoves the pack away · more charge, bigger effect'],
    ],
  },
  {
    title: 'ULTIMATE',
    cards: [
      // {ULT} resolves at draw: ULT_SHOTS lives in battle.ts, which imports
      // this module, so a top-level read would hit it before it's initialized
      ['soul-dew', 'Every shot charges ULT · {ULT} shots fill it'],
      ['focus-sash', 'Full? Tap ULT, then tap again to unleash · or tap a glowing teammate twice'],
      ['life-orb', 'Hits all foes · bosses resist it · charge carries between fights'],
      // key affordances hide on touch, same (pointer: fine) gate as the [1]/[R] hints
      ...(HAS_KEYS ? [['sign', 'on keys: ? help, P pause, M mute · arrows turn pages'] as const] : []),
    ],
  },
  {
    title: 'TL;DR',
    cards: [
      ['poke-ball', 'PULL · drag back, let go in the gold band'],
      [25, 'BOUNCE · bank off walls, fly through allies to fire supers'],
      ['badges/1', 'BREAK BARS · drop each boss bar before its clocks hit 0'],
      ['star-piece', 'CLEAR FAST · on par with no faints ranks S'],
    ],
  },
  {
    title: 'TREASURE & MISSIONS',
    cards: [
      ['ultra-ball', 'KO\'d foes may drop a treasure ball · Poké, Great, Ultra or Master'],
      ['master-ball', 'bosses always drop one, Great Ball or better'],
      ['amulet-coin', 'weak-point KOs, finishers, speed clears and combos lift the odds'],
      ['stardust', 'balls open after the CLEAR card: star pieces, dust or a bag item'],
      ['exp-share', 'each battle stop sets up to 3 missions · the HUD chip ticks them live'],
      ['lucky-egg', 'speed clear · KO 2 in one shot · hit 3 weak points'],
      ['badges/3', 'no faints · use a ULT · finish with a named type'],
      ['star-piece', 'each mission done pays star pieces or dust on the CLEAR card · raids skip drops and missions'],
    ],
  },
];

// topic groups in reading order · a group spills onto as many evenly
// filled pages as its cards need, and the dots track groups, not pages
const HELP_GROUPS: { name: string; secs: number[] }[] = [
  { name: 'TL;DR', secs: [19] },
  { name: 'YOUR SHOT', secs: [0, 2] },
  { name: 'FOES', secs: [4] },
  { name: 'AILMENTS', secs: [5] },
  { name: 'TELLS', secs: [6] },
  { name: 'SUPERS', secs: [1, 3] },
  { name: 'SUPER INDEX', secs: [16, 17] },
  { name: 'ULTIMATE', secs: [18, 12] },
  { name: 'THE FIELD', secs: [7, 13] },
  { name: 'GROWTH', secs: [8, 9] },
  { name: 'THE CLIMB', secs: [10, 11] },
  { name: 'TREASURE', secs: [20] },
  { name: 'GIMMICKS', secs: [14, 15] },
];
const HELP_PER_PAGE = 7;
export const HELP_DECK: { name: string; group: number; cards: HelpCard[] }[] = HELP_GROUPS.flatMap((g, gi) => {
  const all = g.secs.flatMap((si) => HELP_SECTIONS[si].cards);
  const n = Math.ceil(all.length / HELP_PER_PAGE);
  const per = Math.ceil(all.length / n);
  return Array.from({ length: n }, (_, i) => ({
    name: n > 1 ? `${g.name} ${i + 1}/${n}` : g.name,
    group: gi,
    cards: all.slice(i * per, (i + 1) * per),
  }));
});
export const HELP_PAGE_COUNT = HELP_DECK.length;

export const HELP_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
const HELP_HEAD = 64; // title band inside the panel
const HELP_FOOT = 44; // nav band
const HELP_CARD_Y = HELP_PANEL.y + HELP_HEAD + 40; // under the page name
const HELP_CARD_H = 86; // three 20px lines
const HELP_CARD_GAP = 8;
const HELP_TEXT_PX = 14; // fontB(14) = 20 logical ≈ 14.4px at 390 wide
const HELP_TEXT_MIN = 13.5; // the 19-logical floor
// 40px touch floor — the same size as the corner chips these sit beside
export const HELP_PREV = { x: HELP_PANEL.x + 14, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 40 };
export const HELP_NEXT = { x: HELP_PANEL.x + HELP_PANEL.w - 62, y: HELP_PANEL.y + HELP_PANEL.h - HELP_FOOT + 4, w: 48, h: 40 };
export const HELP_CLOSE = { x: HELP_PANEL.x + HELP_PANEL.w - 48, y: HELP_PANEL.y + 12, w: 40, h: 40 };
// modal corner targets get the full pad — nothing else hit-tests up there
export const HELP_CLOSE_HIT = { x: HELP_CLOSE.x - 8, y: HELP_CLOSE.y - 8, w: 56, h: 56 };
// re-arms the kinetic battle coach — top-left, kept narrow to clear the title
export const HELP_TUT = { x: HELP_PANEL.x + 14, y: HELP_PANEL.y + 12, w: 116, h: 40 };

// greedy word-wrap at the current font, no line cap
function wrapAll(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measureW(ctx, next) > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// each `·` clause gets its own line(s) · shrink in half steps until the card
// holds three lines, never under the floor
function helpLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const parts = text.split(' · ');
  let px = HELP_TEXT_PX;
  for (;;) {
    ctx.font = fontB(px);
    const lines = parts.map((p, i) => wrapAll(ctx, p, maxW).map((l) => ({ l, lead: i === 0 }))).flat();
    if (lines.length <= 3 || px <= HELP_TEXT_MIN) return { lines, px };
    px -= 0.5;
  }
}

const helpMonReady = new Set<number>();
function drawHelpIcon(ctx: CanvasRenderingContext2D, icon: HelpIcon, cx: number, cy: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (typeof icon === 'number') {
    if (helpMonReady.has(icon)) {
      monShadow(ctx, cx, cy + 2, 56);
      drawMon(ctx, icon, cx, cy, 60);
    } else void loadSprite(icon).then(() => helpMonReady.add(icon));
  } else if (typeof icon === 'string') {
    void loadItem(icon);
    const img = itemSprite(icon);
    if (img && img.width) {
      // anim sheets are strips of square frames · show frame 0
      const fw = icon.startsWith('anims/') ? img.height : img.width;
      const sz = icon.startsWith('badges/') ? 40 : 52;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, 0, 0, fw, img.height, cx - sz / 2, cy - sz / 2, sz, sz);
    }
  } else {
    const k = 52 / Math.max(icon[2], icon[3]);
    drawTile(ctx, icon, cx - (icon[2] * k) / 2, cy - (icon[3] * k) / 2, icon[2] * k, icon[3] * k);
  }
  ctx.restore();
}

export function drawHelp(ctx: CanvasRenderingContext2D, page: number, coachArmed = false, welcome = false) {
  const r = HELP_PANEL;
  const pg = HELP_DECK[page];
  scrim(ctx);
  uiPanel(ctx, r, 'HOW TO PLAY', { rad: 14 });
  uiClose(ctx, HELP_CLOSE);

  // TUTORIAL pill — re-arms the in-battle coach (ghost pull + field beats).
  // It rides the title band like the X chip: dark chip, parch edge.
  roundRect(ctx, HELP_TUT.x, HELP_TUT.y, HELP_TUT.w, HELP_TUT.h, 10);
  ctx.fillStyle = coachArmed ? '#16301c' : INK;
  ctx.fill();
  ctx.strokeStyle = coachArmed ? '#6fdc6f' : PARCH;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  const tut = coachArmed ? 'TUTORIAL ON' : '▶ TUTORIAL';
  fitFontB(ctx, tut, HELP_TEXT_MIN, HELP_TUT.w - 12);
  ctx.fillStyle = coachArmed ? '#9fe89f' : PARCH;
  ctx.fillText(tut, HELP_TUT.x + HELP_TUT.w / 2, HELP_TUT.y + 27);

  fitFont(ctx, pg.name, 14, r.w - 40);
  ctx.fillStyle = INK;
  ctx.fillText(pg.name, r.x + r.w / 2, r.y + HELP_HEAD + 28);

  // one paper card per idea: asset cell left, its clauses stacked right
  const cx = r.x + 14, cw = r.w - 28;
  const tx = cx + 84, tw = cw - 84 - 14;
  pg.cards.forEach(([icon, raw], i) => {
    const text = raw.replace('{ULT}', String(ULT_SHOTS));
    const y = HELP_CARD_Y + i * (HELP_CARD_H + HELP_CARD_GAP);
    uiWindow(ctx, { x: cx, y, w: cw, h: HELP_CARD_H }, { rad: 8, shadow: false });
    roundRect(ctx, cx + 8, y + 8, 68, HELP_CARD_H - 16, 6);
    ctx.fillStyle = 'rgba(40,48,88,0.08)';
    ctx.fill();
    drawHelpIcon(ctx, icon, cx + 42, y + HELP_CARD_H / 2);

    const { lines, px } = helpLines(ctx, text, tw);
    const lh = px * 1.4 + 3;
    const top = y + HELP_CARD_H / 2 - (lines.length * lh) / 2 + lh * 0.72;
    ctx.textAlign = 'left';
    ctx.font = fontB(px);
    lines.forEach(({ l, lead }, li) => {
      ctx.fillStyle = lead ? INK : INK_SOFT;
      ctx.fillText(l, tx, top + li * lh);
    });
  });

  if (welcome && page === 0) {
    const y = HELP_CARD_Y + pg.cards.length * (HELP_CARD_H + HELP_CARD_GAP) + 30;
    ctx.textAlign = 'center';
    ctx.font = fontB(HELP_TEXT_PX);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('your first fight teaches the pull', r.x + r.w / 2, y);
    ctx.fillText('the rest of this deck is the manual', r.x + r.w / 2, y + 26);
  }

  // footer nav: ‹ › arrows flank one dot per topic group
  ctx.textAlign = 'center';
  ctx.font = font(14);
  ctx.fillStyle = page > 0 ? INK : INK_FAINT;
  ctx.fillText('‹', HELP_PREV.x + HELP_PREV.w / 2, HELP_PREV.y + 26);
  ctx.fillStyle = page < HELP_PAGE_COUNT - 1 ? INK : INK_FAINT;
  ctx.fillText('›', HELP_NEXT.x + HELP_NEXT.w / 2, HELP_NEXT.y + 26);
  const groups = HELP_GROUPS.length;
  for (let i = 0; i < groups; i++) {
    ctx.fillStyle = i === pg.group ? GOLD : INK_FAINT;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2 + (i - (groups - 1) / 2) * 20, HELP_PREV.y + 20, i === pg.group ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- dex overlay: the full register — caught rows draw, unseen ghost as ---
// --- ?/??? so the dex reads as a checklist, not a wall of caught names -----
// home-tab card rects — the same _BTN names the hit tests know, re-homed to
// the cards the tab bodies draw. SHOP owns the hatcher hero + spark deal;
// MONS owns dex / line-sets / catches; TOWN owns the 2-col grid + ASC + HALL.
// SHOP: the counter scene opens the hatcher; HATCH_BTN pulls ×1 straight
// away, SHOP_MORE_BTN opens it for ×10 + sparks
export const SHOP_SCENE = { x: 20, y: 102, w: W - 40, h: 258 };
export const HATCH_BTN = { x: 30, y: SHOP_SCENE.y + SHOP_SCENE.h + 10, w: 322, h: 84 };
export const SHOP_MORE_BTN = { x: HATCH_BTN.x + HATCH_BTN.w + 10, y: HATCH_BTN.y, w: W - 60 - HATCH_BTN.w - 10, h: 84 };
export const DEAL_BTN = { x: 30, y: HATCH_BTN.y + HATCH_BTN.h + 12, w: W - 60, h: 148 };
export const UPGRADES_BTN = { x: 30, y: DEAL_BTN.y + DEAL_BTN.h + 12, w: W - 60, h: 200 };
// the pack pill is the rack's right column — exported for main's two-tap
// armed-buy routing
export const PACK_PILL = { x: UPGRADES_BTN.x + UPGRADES_BTN.w - 158, y: UPGRADES_BTN.y + 80, w: 140, h: 74 };
// RAID: one boss card — today's shiny fight + its loaner trio — then the
// FIGHT pill the tab's tap target rides on
export const RAID_CARD = { x: 30, y: 210, w: W - 60, h: 502 };
export const RAID_FIGHT = { x: 30, y: RAID_CARD.y + RAID_CARD.h + 16, w: W - 60, h: 64 };
const DEX_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
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
const PITY_WIN = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 272, w: HATCH_PANEL.w - 32, h: 44 };
const RATE_BAND = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 320, w: HATCH_PANEL.w - 32, h: 48 };
const SPARK_VIEW = { x: HATCH_PANEL.x + 16, y: HATCH_PANEL.y + 406, w: HATCH_PANEL.w - 32, h: 388 };
const SPARK_COLS = 4;
const SPARK_CELL_W = SPARK_VIEW.w / SPARK_COLS;
const SPARK_CELL_H = 132;
const HATCH_MODAL = { x: 24, y: 170, w: W - 48, h: 500 };
// SKIP rides the top cinema bar, clear of the flash-beat kick
export const SKIP_PULL_BTN = { x: W - 128, y: 26, w: 108, h: 38 };

// the wallet pill — star pieces buy pulls, dust buys sparks outright
// the wallet counts chase the real numbers — a tick-up reads as paid, a
// snap reads as a refresh. One shared pair: every chip draws the same wallet
let chipStars = -1;
let chipDust = -1;
const chase = (shown: number, target: number) =>
  shown < 0 || Math.abs(target - shown) < 0.6 ? target : shown + (target - shown) * 0.22;

export function balanceChip(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  starN: number,
  dust?: number,
) {
  chipStars = chase(chipStars, starN);
  if (dust != null) chipDust = chase(chipDust, dust);
  // the wallet is a small dark window-chip — same frame language as the panel
  uiWindow(ctx, r, { dark: true, rad: r.h / 2, shadow: false });
  void loadItem('star-piece');
  ctx.textAlign = 'left';
  ctx.font = fontB(10);
  const starTxt = `${Math.round(chipStars)}`;
  const dustTxt = `${Math.round(chipDust)}`;
  // center the whole cluster — icon + counts — not just the first glyph
  const contentW =
    18 + 6 + ctx.measureText(starTxt).width + (dust != null ? 8 + 12 + ctx.measureText(dustTxt).width : 0);
  let tx = r.x + (r.w - contentW) / 2;
  const star = itemSprite('star-piece');
  if (star) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(star, tx, r.y + r.h / 2 - 9, 18, 18);
    ctx.restore();
  }
  tx += 24;
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(starTxt, tx, r.y + r.h / 2 + 3.5);
  tx += ctx.measureText(starTxt).width + 8;
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
    ctx.fillText(`${Math.round(chipDust)}`, tx + 12, r.y + r.h / 2 + 3.5);
  }
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
  ctx.font = fontB(10);
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
    ctx.font = fontB(10);
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
  drawCounterStrip(ctx, FEAT_BAND);
  rim(ctx, FEAT_BAND, 10, fc, 1.5);
  if (f) {
    void loadSprite(f.id);
    // the stage — a type-tinted pedestal under a faint ball watermark
    const scx = FEAT_BAND.x + 68, scy = FEAT_BAND.y + FEAT_BAND.h / 2 + 2;
    ctx.fillStyle = `${fc}55`;
    ctx.beginPath();
    ctx.ellipse(scx, scy + 42, 58, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    monShadow(ctx, scx, scy + 2, 96);
    try {
      drawMon(ctx, f.id, scx, scy + Math.sin(s.t * 2.4) * 2.5, 96);
    } catch {
      /* sprite still warming */
    }
    const tx = FEAT_BAND.x + 140;
    uiWindow(ctx, { x: tx - 12, y: FEAT_BAND.y + 18, w: FEAT_BAND.x + FEAT_BAND.w - 92 - (tx - 12), h: 78 }, { dark: true, rad: 8, rim: false, shadow: false });
    ctx.textAlign = 'left';
    fitFont(ctx, f.name.toUpperCase(), 14, FEAT_BAND.x + FEAT_BAND.w - tx - 96);
    ctx.fillStyle = '#f8f4e4';
    ctx.fillText(f.name.toUpperCase(), tx, FEAT_BAND.y + 44);
    ctx.font = fontB(10);
    ctx.fillStyle = mixHex(fc, '#ffffff', 0.45);
    ctx.fillText(f.type2 ? `${f.type} · ${f.type2}`.toUpperCase() : f.type.toUpperCase(), tx, FEAT_BAND.y + 64);
    ctx.fillStyle = PARCH;
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
    ctx.font = fontB(10);
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
    c: info.free ? GOLD : PARCH,
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
  ctx.font = fontB(10);
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
  const next = info.pityIn <= 1;
  uiWindow(ctx, PITY_WIN, { dark: true, rad: 10, shadow: false, rim: false });
  if (next) rim(ctx, PITY_WIN, 10, GOLD_HI, 2);
  const pw = PITY_WIN, ps = 22, pg = 2;
  const px0 = pw.x + pw.w - 12 - PULL_PITY * ps - (PULL_PITY - 1) * pg;
  ctx.textAlign = 'left';
  ctx.fillStyle = next ? GOLD_HI : PARCH;
  const pl = next ? 'NEXT PULL · RARE+' : `RARE+ IN ${info.pityIn}`;
  fitFont(ctx, pl, 10, px0 - pw.x - 24);
  ctx.fillText(pl, pw.x + 14, pw.y + 22);
  ctx.font = fontB(10);
  ctx.fillStyle = '#a8b0d0';
  ctx.fillText(`${done} / ${PULL_PITY} BANKED`, pw.x + 14, pw.y + 38);
  // one Poké Ball per banked pull; the guarantee slot is an Ultra Ball
  void loadItem('ultra-ball');
  const pb = itemSprite('poke-ball'), ub = itemSprite('ultra-ball');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < PULL_PITY; i++) {
    const bx = px0 + i * (ps + pg), by = pw.y + (pw.h - ps) / 2;
    const last = i === PULL_PITY - 1;
    const img = last ? ub : pb;
    ctx.globalAlpha = i < done ? 1 : last ? (next ? 0.7 + 0.3 * Math.sin(s.t * 6) : 0.6) : 0.35;
    if (img) ctx.drawImage(img, bx - 2, by - 2, ps + 4, ps + 4);
    else {
      ctx.fillStyle = i < done ? GOLD : '#3a4160';
      ctx.fillRect(bx + 4, by + 4, ps - 8, ps - 8);
    }
  }
  ctx.restore();

  // the odds, tiered — one glanceable rate card: tier name, the number big,
  // and a bar drawn to scale. Buckets read PULL_RATES straight so the print
  // can never drift from pullSpecies'; shiny rides every pull so it gets
  // its own cell with live odds. A payout flash borrows the slot
  if (s.phase === 'idle') {
    uiWindow(ctx, RATE_BAND, { rad: 8, shadow: false });
    if (info.flash) {
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
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
        ctx.font = fontB(10);
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
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('buy a mon outright with dust · sparked or pulled, it joins the dex', W / 2, SPARK_VIEW.y - 4);

  const seen = new Set(dexIds());
  ctx.save();
  ctx.beginPath();
  ctx.rect(SPARK_VIEW.x - 4, SPARK_VIEW.y, SPARK_VIEW.w + 8, SPARK_VIEW.h);
  ctx.clip();
  // the shelf sits on the mart floor, same back room as the theatre
  drawCounterStrip(ctx, { x: SPARK_VIEW.x - 4, y: SPARK_VIEW.y, w: SPARK_VIEW.w + 8, h: SPARK_VIEW.h }, 0);
  const row0 = Math.max(0, Math.floor(s.sparkScroll / SPARK_CELL_H));
  const rowN = Math.ceil((s.sparkScroll + SPARK_VIEW.h) / SPARK_CELL_H);
  const deal = dealPick(); // one seeded roll a frame — dealCost re-rolled it per cell
  void loadItem('poke-ball');
  const dexBall = itemSprite('poke-ball');
  for (let i = row0 * SPARK_COLS; i < rowN * SPARK_COLS && i < PULLABLE.length; i++) {
    const def = PULLABLE[i];
    const cx = SPARK_VIEW.x + (i % SPARK_COLS) * SPARK_CELL_W;
    const cy = SPARK_VIEW.y + Math.floor(i / SPARK_COLS) * SPARK_CELL_H - s.sparkScroll;
    const owned = seen.has(def.id);
    const spTier = tierOf(def);
    const epic = spTier >= 3 || INVADER_IDS.has(def.id);
    const cell = { x: cx + 4, y: cy + 6, w: SPARK_CELL_W - 8, h: SPARK_CELL_H - 10 };
    const mx = cell.x + cell.w / 2;
    const tcol = epic ? '#f0b02f' : spTier === 2 ? '#5a9bf0' : '#d0d0c8';
    // missing stock is a lit paper card; owned ones go dark behind the glass
    uiWindow(ctx, cell, { rad: 8, dark: owned, shadow: !owned });
    if (spTier >= 2 && !owned) rim(ctx, cell, 8, tcol, 2);
    ctx.save();
    ctx.globalAlpha = owned ? 0.5 : 1;
    monShadow(ctx, mx, cell.y + 40, 76);
    void loadSprite(def.id);
    try {
      drawMon(ctx, def.id, mx, cell.y + 40, 76);
    } catch {
      /* sprite still warming */
    }
    ctx.restore();
    // rare+ stock wears its tier as a corner flag — the rim color made words
    if (spTier >= 2 && !owned) {
      ctx.font = fontB(10);
      const tl = epic ? 'EPIC' : 'RARE';
      const tw = ctx.measureText(tl).width + 8;
      ctx.fillStyle = tcol;
      ctx.fillRect(cell.x, cell.y, tw, 13);
      ctx.textAlign = 'left';
      ctx.fillStyle = PAPER_HI;
      ctx.fillText(tl, cell.x + 4, cell.y + 10);
    }
    ctx.textAlign = 'center';
    fitFontB(ctx, def.name.toUpperCase(), 10, cell.w - 10);
    ctx.fillStyle = owned ? '#a8b0d0' : INK;
    ctx.fillText(def.name.toUpperCase(), mx, cell.y + 84);
    const strip = { x: cell.x + 5, y: cell.y + cell.h - 27, w: cell.w - 10, h: 22 };
    if (owned) {
      // caught: a green IN DEX strip with the ball it's filed under
      roundRect(ctx, strip.x, strip.y, strip.w, strip.h, 7);
      ctx.fillStyle = '#1d3524';
      ctx.fill();
      ctx.strokeStyle = '#6fdc6f';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = fontB(10);
      const lw = ctx.measureText('IN DEX').width;
      if (dexBall) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(dexBall, mx - lw / 2 - 18, strip.y + 2, 18, 18);
        ctx.restore();
      }
      ctx.fillStyle = '#9fe89f';
      ctx.fillText('IN DEX', mx + 9, strip.y + 15);
      continue;
    }
    const isDeal = def.id === deal.id;
    // the day's cut is memo'd, so per-cell dealCost is a lookup not a roll
    const cost = dealCost(def);
    const can = info.dust >= cost;
    if (info.armedId === def.id) {
      // two-tap confirm: pulse the rim, the price strip turns gold, and the
      // window burns down along the cell's bottom edge
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(s.t * 10);
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 8);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      roundRect(ctx, strip.x, strip.y, strip.w, strip.h, 7);
      ctx.fillStyle = GOLD_HI;
      ctx.fill();
      const cue = `TAP AGAIN · ◆${cost}`;
      fitFontB(ctx, cue, 10, strip.w - 8);
      ctx.fillStyle = INK;
      ctx.fillText(cue, mx, strip.y + 15);
      ctx.fillStyle = GOLD;
      ctx.fillRect(cell.x + 4, cell.y + cell.h - 3, (cell.w - 8) * Math.max(0, info.armedFrac ?? 0), 3);
      continue;
    }
    // the price: a dark strip, dust blue when affordable, red when short
    uiWindow(ctx, strip, { dark: true, rad: 7, shadow: false, rim: false });
    if (isDeal) rim(ctx, strip, 7, GOLD, 1.5);
    const price = `◆ ${cost}`;
    ctx.font = fontB(12);
    const pw = ctx.measureText(price).width;
    const was = isDeal ? `${dustCost(def)}` : '';
    ctx.font = fontB(9);
    const ww = was ? ctx.measureText(was).width + 6 : 0;
    const px = mx - (pw + ww) / 2;
    ctx.textAlign = 'left';
    ctx.font = fontB(12);
    ctx.fillStyle = !can ? '#ff8a8a' : isDeal ? GOLD_HI : '#9fd0ff';
    ctx.fillText(price, px, strip.y + 16);
    if (was) {
      // the struck list price beside the deal price — the bargain shows
      ctx.font = fontB(9);
      ctx.fillStyle = '#a8b0d0';
      const wx = px + pw + 6;
      ctx.fillText(was, wx, strip.y + 15);
      ctx.strokeStyle = '#a8b0d0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, strip.y + 11);
      ctx.lineTo(wx + ww - 6, strip.y + 11);
      ctx.stroke();
      // the daily discount tab — a gold corner flag
      ctx.fillStyle = GOLD;
      ctx.fillRect(cell.x + cell.w - 36, cell.y, 36, 14);
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
      ctx.fillStyle = INK;
      ctx.fillText(`−${dealOff()}%`, cell.x + cell.w - 18, cell.y + 10);
    }
    ctx.textAlign = 'center';
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('pulled or sparked mons join the dex + future drafts · tap outside to close', W / 2, r.y + r.h - 12);
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
const FLOOR_Y = SHOW_CY + 56; // the counter floor the ball bounces on and the mon lands on
const BALL_S = 96;
// the glow each ball casts — the ball is the star tier, the glow says it again
const BALL_GLOW: Record<string, string> = {
  'poke-ball': '#c0c8e0',
  'great-ball': '#5a9bf0',
  'ultra-ball': GOLD,
  'master-ball': '#c05df0',
};
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
  // the theatre runs on the prize counter's back room, lights down
  const res = s.results[s.i];
  pullStage(ctx, res ? ballFor(res.rarity, res.shiny) : 'poke-ball');
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
  // SKIP ≫ rides the top bar, outside the kick, for the whole reel
  if (s.results.length > 1) pill(ctx, SKIP_PULL_BTN, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'SKIP ≫' });
}

// the Gracidea back room dimmed to a spotlit floor, tinted by the ball's tier
function pullStage(ctx: CanvasRenderingContext2D, ball: string) {
  drawPullStage(ctx, W, H, FLOOR_Y);
  ctx.fillStyle = 'rgba(8,10,24,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, FLOOR_Y);
  ctx.scale(1, 0.32);
  const sp = ctx.createRadialGradient(0, 0, 10, 0, 0, 230);
  sp.addColorStop(0, 'rgba(255,248,220,0.42)');
  sp.addColorStop(0.6, withA(BALL_GLOW[ball] ?? '#c0c8e0', 0.16));
  sp.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = sp;
  ctx.beginPath();
  ctx.arc(0, 0, 230, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  // every pull lands as a Poké Ball; rare+ upgrades to its real ball mid-wobble
  const target = res ? ballFor(res.rarity, res.shiny) : 'poke-ball';
  const upAt = DROP_SETTLE + (T - DROP_SETTLE) * 0.35;
  const shown = s.t >= upAt ? target : 'poke-ball';
  const tellC =
    hype === 2 && shown !== 'poke-ball'
      ? PRISM[Math.floor(s.t * 9) % PRISM.length]
      : shown !== 'poke-ball'
        ? BALL_GLOW[shown]
        : fake
          ? '#5a9bf0'
          : '#c0c8e0';

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

  // the ball drops onto the floor, hops, then rocks harder toward the pop
  for (const id of ['great-ball', 'ultra-ball', 'master-ball']) void loadItem(id);
  const ball = itemSprite(shown);
  const d = ballDrop(s.t);
  const w = clamp01((s.t - DROP_SETTLE) / Math.max(0.01, T - DROP_SETTLE));
  const squash = d.hit >= 0 && d.hit < 0.1 ? 0.24 * (1 - d.hit / 0.1) : 0;
  const lift = Math.min(1, d.h / DROP_H);
  ctx.fillStyle = `rgba(4,6,16,${0.45 - lift * 0.3})`;
  ctx.beginPath();
  ctx.ellipse(cx, FLOOR_Y, BALL_S * (0.42 - lift * 0.22), 9 - lift * 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, FLOOR_Y - d.h);
  if (d.h === 0 && s.t > DROP_SETTLE) ctx.rotate(Math.sin(s.t * (11 + w * 26)) * (0.1 + w * 0.32));
  ctx.scale(1 + squash, 1 - squash);
  ctx.imageSmoothingEnabled = false;
  if (ball) ctx.drawImage(ball, -BALL_S / 2, -BALL_S, BALL_S, BALL_S);
  ctx.restore();
  // the upgrade pops a ring off the ball as the new tier lands
  const ut = s.t - upAt;
  if (target !== 'poke-ball' && ut >= 0 && ut < 0.4) {
    const q = ut / 0.4;
    ctx.globalAlpha = 1 - q;
    ctx.strokeStyle = tellC;
    ctx.lineWidth = 6 - q * 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 + eo(q) * 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - q)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // the last beat — the seam cracks light before the cut to reveal
  if (p > 0.85) {
    const q = (p - 0.85) / 0.15;
    ctx.fillStyle = `rgba(255,255,255,${0.75 * q})`;
    ctx.fillRect(cx - 2 - q * 9, cy - 48, 4 + q * 18, 96);
  }

  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = hype === 2 ? GOLD : '#c0c8e0';
  const dots = '.'.repeat(1 + (Math.floor(s.t * 3) % 3));
  ctx.fillText(
    hype === 2 ? `THE AIR CRACKLES${dots}` : hype === 1 || fake ? `THE BALL GLOWS${dots}` : `THE BALL TWITCHES${dots}`,
    cx,
    cy + 124,
  );
  ctx.font = fontB(10);
  ctx.fillStyle = PARCH;
  ctx.fillText(s.results.length > 1 ? `${s.i + 1} OF ${s.results.length} · TAP TO HURRY` : 'TAP TO SKIP', cx, cy + 148);
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
  ctx.translate(cx, FLOOR_Y);
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
      monShadow(ctx, cx, cy + 4, sz);
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
    const wa = FLASH_A[hype] * Math.max(0, 1 - ft / 0.18) * (settings().flash ? 1 : 0.35);
    if (wa > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${wa})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // shiny: a gold flash, then Star Pieces orbit the mon while the card holds
  if (res.shiny && ft >= 0) {
    if (ft < 0.35) {
      ctx.fillStyle = `rgba(255,224,120,${0.55 * (1 - ft / 0.35) * (settings().flash ? 1 : 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const sp = itemSprite('star-piece');
    void loadItem('star-piece');
    if (sp) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (let k = 0; k < 6; k++) {
        const a = s.t * 1.6 + (k / 6) * Math.PI * 2;
        const r = 70 + 14 * Math.sin(s.t * 3 + k);
        const ps = 22 + 6 * Math.sin(s.t * 7 + k * 2);
        ctx.globalAlpha = clamp01(ft / 0.2) * fade;
        ctx.drawImage(sp, cx + Math.cos(a) * r - ps / 2, cy + Math.sin(a) * r * 0.7 - ps / 2, ps, ps);
      }
      ctx.restore();
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
    ctx.globalAlpha = nameK;
    uiWindow(ctx, { x: cx - 150, y: ny - 32, w: 300, h: 84 }, { dark: true, rad: 10, shadow: false });
    ctx.globalAlpha = 1;
    ctx.fillStyle = typeC;
    ctx.fillRect(cx - 95 * nameK, ny + 13, 190 * nameK, 3);
    ctx.textAlign = 'center';
    fitFont(ctx, def.name.toUpperCase(), 13, 270);
    ctx.fillStyle = PARCH;
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
    ctx.translate(cx, ny + 96);
    ctx.rotate(-0.08);
    const sc = 2 - eo(stampK);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    if (res.shiny) {
      ctx.fillStyle = GOLD;
      burstStar(ctx, 0, 0, 42, 12);
      ctx.font = fontB(10);
      ctx.fillStyle = INK;
      ctx.fillText('SHINY!', 0, 4);
    } else if (!res.dupe) {
      ctx.fillStyle = '#d0483e';
      burstStar(ctx, 0, 0, 36, 10);
      ctx.font = fontB(10);
      ctx.fillStyle = '#fff5d6';
      ctx.fillText('NEW!', 0, 4);
    } else {
      ctx.font = font(10);
      ctx.fillStyle = '#5a9bf0';
      ctx.fillText(`DUPE +${res.dust} DUST`, 0, 4);
    }
    ctx.restore();
  }

  // reel position — one ball per card, the current one lit
  if (s.results.length > 1) {
    const pw = s.results.length * 22 - 4;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    s.results.forEach((r, k) => {
      const img = itemSprite(ballFor(r.rarity, r.shiny));
      ctx.globalAlpha = k === s.i ? 1 : k < s.i ? 0.7 : 0.25;
      if (img) ctx.drawImage(img, cx - pw / 2 + k * 22, H - LB_H - 56, 18, 18);
    });
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = PARCH;
  ctx.fillText(s.results.length > 1 ? 'TAP FOR NEXT' : 'TAP TO CONTINUE', cx, H - LB_H - 22);
}
// 'results' — the whole pull laid out in the parked modal; a single pull
// gets the hero card. The theatre's bars slide back open over the top.
function drawPullSummary(ctx: CanvasRenderingContext2D, s: HatchState) {
  const best = s.results.reduce((a, r) => (r.shiny ? 9 : r.rarity) > (a.shiny ? 9 : a.rarity) ? r : a, s.results[0]);
  pullStage(ctx, best ? ballFor(best.rarity, best.shiny) : 'poke-ball');
  const m = HATCH_MODAL;
  uiPanel(ctx, m, s.label ?? 'PULL RESULTS');
  const cx = m.x + m.w / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (s.results.length === 1) {
    const res = s.results[0];
    const def = res && speciesById(res.id);
    if (res && def) {
      void loadSprite(res.id);
      // the hero card pops in like the reveal did, standing in its own ball's glow
      const hero = { x: cx - 110, y: m.y + 70, w: 220, h: 200 };
      uiWindow(ctx, hero, { shadow: false });
      const ball = ballFor(res.rarity, res.shiny);
      rim(ctx, hero, 10, BALL_GLOW[ball], 2);
      const bi = itemSprite(ball);
      if (bi) ctx.drawImage(bi, hero.x + 8, hero.y + 8, 30, 30);
      const k = eo(clamp01(s.t / 0.3));
      const sc = 0.6 + 0.4 * k + 0.15 * Math.sin(Math.PI * clamp01(s.t / 0.35));
      const my = hero.y + 108;
      monShadow(ctx, cx, my, 120);
      ctx.save();
      ctx.translate(cx, my);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -my);
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, def.id, cx, my, 120);
      } catch {
        /* sprite still warming */
      }
      ctx.restore();
      ctx.globalAlpha = k;
      if (!res.dupe) newTag(ctx, hero.x + hero.w - 8, hero.y + 10, 12);
      const starC = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? GOLD : '#a8b0c8';
      for (let j = 0; j < res.rarity; j++) {
        ctx.fillStyle = starC;
        fillStar(ctx, cx + (j - (res.rarity - 1) / 2) * 24, m.y + 300, 10);
      }
      ctx.textAlign = 'center';
      fitFont(ctx, def.name.toUpperCase(), 13, m.w - 40);
      ctx.fillStyle = INK;
      ctx.fillText(def.name.toUpperCase(), cx, m.y + 342);
      ctx.font = font(10);
      ctx.fillStyle = res.dupe ? '#3a78d0' : res.shiny ? '#b08020' : '#d0483e';
      ctx.fillText(res.dupe ? `DUPE +${res.dust} DUST` : res.shiny ? 'SHINY · NEW' : 'NEW TO YOUR DEX', cx, m.y + 376);
      ctx.globalAlpha = 1;
    }
  } else {
    const cols = 5;
    const cw = (m.w - 24) / cols;
    const rh = 176;
    s.results.forEach((res, i) => {
      // cards deal in one by one, the reel's last staggered beat
      const k = eo(clamp01((s.t - i * 0.05) / 0.22));
      if (k <= 0) return;
      const def = speciesById(res.id);
      const cell = { x: m.x + 12 + (i % cols) * cw + 3, y: m.y + 50 + Math.floor(i / cols) * rh + 3, w: cw - 6, h: rh - 8 };
      const mx = cell.x + cell.w / 2;
      ctx.save();
      ctx.translate(mx, cell.y + cell.h / 2);
      const sc = (0.4 + 0.6 * k) * (1 + 0.3 * Math.sin(Math.PI * k));
      ctx.scale(sc, sc);
      ctx.translate(-mx, -(cell.y + cell.h / 2));
      const ball = ballFor(res.rarity, res.shiny);
      uiWindow(ctx, cell, { rad: 7, shadow: false, rim: false });
      if (ball !== 'poke-ball') rim(ctx, cell, 7, BALL_GLOW[ball], 2);
      // big pulls keep their win shimmer, a second rim that breathes
      if (res.shiny || res.rarity >= 3) {
        ctx.globalAlpha = 0.45 + 0.3 * Math.sin(s.t * 6 + i);
        ctx.strokeStyle = res.shiny ? GOLD : '#c05df0';
        ctx.lineWidth = 2;
        roundRect(ctx, cell.x - 1.5, cell.y - 1.5, cell.w + 3, cell.h + 3, 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const bi = itemSprite(ball);
      if (bi) ctx.drawImage(bi, cell.x + 3, cell.y + 3, 24, 24);
      if (!res.dupe) newTag(ctx, cell.x + cell.w - 4, cell.y + 6, 9);
      void loadSprite(res.id);
      monShadow(ctx, mx, cell.y + 66, 70);
      try {
        (res.shiny ? drawShiny : drawMon)(ctx, res.id, mx, cell.y + 66, 70);
      } catch {
        /* sprite still warming */
      }
      const sc2 = res.rarity >= 3 ? '#c05df0' : res.rarity === 2 ? GOLD : '#a8b0c8';
      for (let j = 0; j < res.rarity; j++) {
        ctx.fillStyle = sc2;
        fillStar(ctx, mx + (j - (res.rarity - 1) / 2) * 14, cell.y + 114, 6);
      }
      ctx.textAlign = 'center';
      const nm = def ? def.name.toUpperCase() : '';
      fitFontB(ctx, nm, 10, cell.w - 8);
      ctx.fillStyle = INK;
      ctx.fillText(nm, mx, cell.y + 138);
      ctx.font = fontB(10);
      ctx.fillStyle = res.dupe ? '#3a78d0' : res.shiny ? '#b08020' : INK_SOFT;
      ctx.fillText(res.dupe ? `+${res.dust} DUST` : res.shiny ? 'SHINY' : 'CAUGHT', mx, cell.y + 156);
      ctx.restore();
    });
  }
  ctx.restore();
  const news = s.results.filter((r) => !r.dupe).length;
  const dust = s.results.reduce((a, r) => a + r.dust, 0);
  ctx.textAlign = 'center';
  ctx.font = fontB(11);
  ctx.fillStyle = INK;
  ctx.fillText(`${news} NEW${dust ? ` · +${dust} DUST` : ''}${s.dexPay ? ` · DEX +${s.dexPay}★` : ''}${s.rookiePay ? ` · ROOKIE +${s.rookiePay}★` : ''}`, cx, m.y + m.h - 44);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('TAP TO COLLECT', cx, m.y + m.h - 22);
  letterbox(ctx, 1 - clamp01(s.t / 0.4)); // the bars ride back out over the card
}

// red NEW ribbon, right-aligned at x
function newTag(ctx: CanvasRenderingContext2D, x: number, y: number, px: number) {
  ctx.font = fontB(px);
  const tw = ctx.measureText('NEW').width + 10;
  roundRect(ctx, x - tw, y, tw, px * 1.4 + 6, 5);
  ctx.fillStyle = '#d0483e';
  ctx.fill();
  ctx.fillStyle = '#fff5d6';
  ctx.textAlign = 'center';
  ctx.fillText('NEW', x - tw / 2, y + px * 1.4 + 1);
}

// the BAG row — card-lite chips of stocked consumables; ≤2 ride into the
// run unasked (gold rim + lift, the shiny-card selection language). `last`
// is the last tapped chip — its desc sits on one dim line under the row.
// Empty stock hides the whole thing — no dead UI.
function drawBagRow(
  ctx: CanvasRenderingContext2D,
  sel: ReadonlySet<string>,
  last: string | null,
  scroll = 0,
) {
  // bagRowItems' filter inline so the stock read serves both the list and the ×n badges
  const stock = bagStock();
  const items = BAG_ITEMS.filter((it) => (stock[it.id] ?? 0) > 0);
  if (!items.length) return;
  ctx.textAlign = 'center';
  // an overflowing row clips to the band — same trick as the box strip
  ctx.save();
  ctx.beginPath();
  ctx.rect(4, BAG_ROW.y + 2, W - 8, BAG_ROW.h + 4);
  ctx.clip();
  items.forEach((it, i) => {
    const on = sel.has(it.id);
    const r = bagChipRect(i, items.length, scroll);
    const cr = { x: r.x, y: r.y + (on ? -4 : 0), w: r.w, h: r.h };
    // pocket-size menu windows — gold inner rim when it's riding along
    uiWindow(ctx, cr, { rad: 8 });
    if (on) rim(ctx, cr, 8, GOLD, 2);
    void loadItem(it.item);
    const img = itemSprite(it.item);
    const iconOnly = cr.w < 60; // crowded rows go icon+badge — the desc line names it
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      const iw = iconOnly ? 26 : 22;
      ctx.drawImage(img, cr.x + cr.w / 2 - iw / 2, cr.y + (iconOnly ? 9 : 5), iw, iw);
      ctx.restore();
    }
    if (!iconOnly) {
      ctx.font = fontB(10);
      ctx.fillStyle = on ? INK : INK_SOFT;
      ctx.textAlign = 'center';
      fitFontB(ctx, it.name.toUpperCase(), 10, cr.w - 6);
      ctx.fillText(it.name.toUpperCase(), cr.x + cr.w / 2, cr.y + 37);
    }
    // ×n stock badge top-right — gold-lit when the chip is picked
    const n = `×${stock[it.id] ?? 0}`;
    ctx.font = fontB(10);
    const bw = ctx.measureText(n).width + 10;
    roundRect(ctx, cr.x + cr.w - bw - 5, cr.y + 5, bw, 13, 6.5);
    ctx.fillStyle = on ? GOLD : 'rgba(42,36,64,0.9)';
    ctx.fill();
    ctx.fillStyle = on ? INK : PARCH; // the badge face is dark until picked
    ctx.fillText(n, cr.x + cr.w - bw / 2 - 5, cr.y + 14.5);
  });
  ctx.restore();
  const maxScroll = bagScrollMax(items.length);
  if (maxScroll > 0) {
    // scroll affordances tucked in the band — the box strip's ◀▶ markers
    ctx.font = fontB(10);
    const cy = BAG_ROW.y + BAG_ROW.h / 2;
    if (scroll > 0) {
      ctx.fillStyle = 'rgba(10,14,30,0.7)';
      ctx.beginPath();
      ctx.arc(16, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aab0c8';
      ctx.fillText('◀', 16, cy + 5);
    }
    if (scroll < maxScroll) {
      ctx.fillStyle = 'rgba(10,14,30,0.7)';
      ctx.beginPath();
      ctx.arc(W - 16, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aab0c8';
      ctx.fillText('▶', W - 16, cy + 5);
    }
  }
  void last; // the desc answers on the subtitle line — see drawDraft
}

// In-run pick boards stand on a themed court, Monster Strike style: cards
// deal up from below staggered, the reel plays inside, and the tapped card
// pops off the board for a beat after the pick (main.ts stamps popPick).
type Rect = { x: number; y: number; w: number; h: number };
const DEAL_T = 0.32, DEAL_GAP = 0.07, POP_T = 0.42;
const dealIn = (age: number, i: number) => 1 - Math.pow(1 - clamp01((age - i * DEAL_GAP) / DEAL_T), 3);

function choiceCourt(ctx: CanvasRenderingContext2D, theme: Theme | null, dim: number) {
  if (theme) drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, theme);
  // the vignette keeps the eye on the cards in the middle of the court
  ctx.fillStyle = gradFor(ctx, `choiceVig${dim}`, (c) => {
    const g = c.createRadialGradient(W / 2, H * 0.46, 140, W / 2, H * 0.46, H * 0.7);
    g.addColorStop(0, `rgba(16,20,40,${dim * 0.45})`);
    g.addColorStop(1, `rgba(16,20,40,${Math.min(0.9, dim + 0.25)})`);
    return g;
  });
  ctx.fillRect(0, 0, W, H);
}

// a dealt card: its shadow lands on the court first, the card swings up into it
function dealCard(ctx: CanvasRenderingContext2D, r: Rect, i: number, age: number, body: () => void) {
  const k = dealIn(age, i);
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.fillStyle = 'rgba(8,16,8,0.42)';
  ctx.beginPath();
  ctx.ellipse(r.x + r.w / 2, r.y + r.h + 5, r.w * 0.46, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (k >= 1) return body();
  ctx.save();
  ctx.globalAlpha *= 0.35 + 0.65 * k;
  ctx.translate(r.x + r.w / 2, r.y + r.h + (1 - k) * (H - r.y));
  ctx.rotate((1 - k) * 0.16 * (i - 1));
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h));
  body();
  ctx.restore();
}

type PickFace = { mon: SpeciesDef } | { perk: { name: string; item: string; desc: string; rarity: Rarity } };
let pickPop: { r: Rect; t0: number; face: PickFace } | null = null;
export function popPick(r: Rect, t: number, face: PickFace) {
  pickPop = { r, t0: t, face };
}
// the chosen card lifts and swells off the board with a gold flare, then fades
export function drawPickPop(ctx: CanvasRenderingContext2D, t: number) {
  if (!pickPop) return;
  const p = (t - pickPop.t0) / POP_T;
  if (p < 0 || p >= 1) {
    if (p >= 1) pickPop = null;
    return;
  }
  const { r, face } = pickPop;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const s = 1 + 0.16 * (1 - Math.pow(1 - Math.min(1, p * 2.5), 3));
  ctx.save();
  ctx.globalAlpha = 1 - p * p;
  ctx.fillStyle = gradFor(ctx, 'pickFlare', (c) => {
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 200);
    g.addColorStop(0, 'rgba(255,216,72,0.6)');
    g.addColorStop(1, 'rgba(255,216,72,0)');
    return g;
  });
  ctx.translate(cx, cy - 18 * p);
  ctx.fillRect(-200, -200, 400, 400);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  if ('mon' in face) {
    monCardChrome(ctx, r, face.mon);
    drawMonCard(ctx, r, face.mon, new Set(dexIds()), 1);
  } else drawPerkCard(ctx, r, face.perk);
  rim(ctx, r, 10, GOLD_HI, 3);
  ctx.restore();
}

function monCardChrome(ctx: CanvasRenderingContext2D, r: Rect, def: SpeciesDef) {
  // menu-window chrome around a content face: uiWindow carries the
  // frame/rim/shadow, cardFace paints the type-tinted paper inside the rim
  uiWindow(ctx, r, { rad: 10 });
  cardFace(ctx, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 }, def.type);
  if (def.shiny) rim(ctx, r, 10, GOLD, 2);
}

function drawMonCard(ctx: CanvasRenderingContext2D, r: Rect, def: SpeciesDef, dex: ReadonlySet<number>, pop: number) {
  const band = { x: r.x + 7, y: r.y + 7, w: r.w - 14, h: 103 };

  stripeBand(ctx, band, TYPE_COLOR[def.type]);
  // type chip top-left: light pill, type ink darkened so pale types
  // (electric, ice) still read on it
  chip(ctx, r.x + 10, r.y + 10, def.type.toUpperCase(), {
    bg: INK,
    fg: mixHex(TYPE_COLOR[def.type], INK, 0.45),
  });
  // kind pill top-right — SHINY trumps the dex tag; a bonded offer shows
  // its level so the pick can chase LV5 or spread to a fresh partner
  const kind = `${def.shiny ? 'SHINY' : dex.has(def.id) ? 'OWNED' : 'NEW'}${bondLv(def.id) ? `·B${bondLv(def.id)}` : ''}`;
  ctx.font = fontB(10);
  chip(ctx, r.x + r.w - 10 - ctx.measureText(kind).width - 14, r.y + 10, kind, def.shiny
    ? { bg: GOLD, fg: INK }
    : { bg: 'rgba(42,36,64,0.8)', fg: PARCH });

  // the sprite stands on the band with a ground shadow, drawn big
  monShadow(ctx, band.x + band.w / 2, band.y + band.h / 2 - 8, 64);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  (def.shiny ? drawShiny : drawMon)(ctx, def.id, band.x + band.w / 2, band.y + band.h / 2 + 2, 108 * pop);
  ctx.restore();

  // the mon's name leads the card body — sprite above it, stats below
  ctx.textAlign = 'center';
  fitFont(ctx, def.name, 14, r.w - 20);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(def.name, r.x + r.w / 2 + 1, r.y + 139);
  ctx.fillStyle = INK;
  ctx.fillText(def.name, r.x + r.w / 2, r.y + 138);

  // a coached run deals the thin face — sprite, name, chips and the super;
  // once the coach banks, the card shows its whole scouting hand again
  const full = coachDone();
  if (full) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`#${String(def.id).padStart(3, '0')} · Lv${def.lvl ?? 1}`, r.x + r.w / 2, r.y + 156);

    ctx.font = fontB(10);
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${roleTag(def)}`, r.x + r.w / 2, r.y + 174);

    // evolution hint + trait tag sit with the stats — Magikarp is secretly
    // Gyarados; PIERCE/COPY hold the right edge of the same line
    const tagW = def.pierce || def.copy
      ? (() => { ctx.font = fontB(10); return ctx.measureText(def.pierce ? 'PIERCE' : 'COPY').width + 8; })()
      : 0;
    if (def.evolvesTo != null) {
      const nx = Array.isArray(def.evolvesTo)
        ? `${def.evolvesTo.length} FORMS`
        : speciesById(def.evolvesTo)?.name.toUpperCase();
      if (nx) {
        ctx.textAlign = 'left';
        ctx.font = fontB(10);
        ctx.fillStyle = ACCENT;
        fitFontB(ctx, `→ ${nx}`, 10, r.w - 22 - tagW);
        ctx.fillText(`→ ${nx}`, r.x + 10, r.y + 192);
      }
    }
    if (def.pierce || def.copy) {
      ctx.textAlign = 'right';
      ctx.font = fontB(10);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 9, r.y + 193);
      ctx.fillStyle = GOLD;
      ctx.fillText(def.pierce ? 'PIERCE' : 'COPY', r.x + r.w - 10, r.y + 192);
    }

    // the ability row — the flags that change how the pick actually plays
    // sit above the fold: a draft is a bet, so the card shows its hand
    const flags = [abilityLabel(def), abilityOf(def)?.hint].filter(Boolean).join(' · ');
    if (flags) {
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
      ctx.fillStyle = ACCENT;
      fitFontB(ctx, flags, 12, r.w - 16);
      ctx.fillText(flags, r.x + r.w / 2, r.y + 116);
    }
  }

  // the bump super this mon fires — a draft decision you can taste; the thin
  // face pulls it up under the name and keeps the desc to one line
  const sy = full ? 212 : 188;
  ctx.textAlign = 'center';
  ctx.font = fontB(11);
  ctx.fillStyle = GOLD;
  ctx.fillText(`★ ${moveOf(def.id, def.type)}`, r.x + r.w / 2, r.y + sy);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  fitWrap(ctx, superDesc(def.id, def.type), r.w - 20, 10, full ? 3 : 1).forEach((line, li) =>
    ctx.fillText(line, r.x + r.w / 2, r.y + sy + 14 + li * 12));

}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  _t: number,
  rerolls: number,
  spin: { age: number; pool: SpeciesDef[]; idx: number[] },
  bag: { sel: ReadonlySet<string>; last: string | null; scroll?: number },
) {
  choiceCourt(ctx, 'meadow', 0.35);

  // a title plate up top; the cards stand on the court itself, and the team
  // so far sits on a dark ledge below so the offer stays the focal pick
  uiPanel(ctx, { x: 14, y: 96, w: W - 28, h: 74 }, `DRAFT · PICK ${picked.length + 1} OF 4`, { sub: stageName });
  uiWindow(ctx, { x: 30, y: 572, w: W - 60, h: 156 }, { rad: 12, dark: true });

  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = INK;
  const spinning = spin.age < REEL_STOPS[REEL_STOPS.length - 1];
  // a tapped bag chip borrows this line for its "what does it do" answer
  const lastId = bag.last;
  const lastIt = !spinning && lastId ? bagRowItems().find((it) => it.id === lastId) : undefined;
  const bagDesc = lastIt?.desc;
  const line = bagDesc
    ? `${lastIt!.name.toUpperCase()} · ${bagDesc}`
    : spinning
      ? 'reels rolling · tap to skip'
      : picked.length === 3
        ? 'ace round · a veteran anchors the team'
        : 'your picks become the balls you sling';
  if (bagDesc) fitFontB(ctx, line.toUpperCase(), 10, W - 40);
  ctx.fillStyle = bagDesc ? INK_SOFT : INK;
  ctx.fillText(bagDesc ? line.toUpperCase() : line, W / 2, 155);

  drawBagRow(ctx, bag.sel, bag.last, bag.scroll);

  const dex = new Set(dexIds()); // kind chips read dex membership per card — parse once a frame
  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    dealCard(ctx, r, i, spin.age, () => {
      monCardChrome(ctx, r, def);

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
          [r.y + 132, r.w - 56], // name
          [r.y + 154, 92], // #id · level
          [r.y + 174, 108], // type · role
          [r.y + 194, 96], // evo hint
          [r.y + 218, 110], // super line
          [r.y + 236, r.w - 40], // desc
        ];
        bars.forEach(([by, bw]) => {
          roundRect(ctx, r.x + r.w / 2 - bw / 2, by, bw, 10, 5);
          ctx.fill();
        });
        return;
      }
      // landing pop: the sprite overshoots for a beat as the reel stops
      const pop = 1 + 0.12 * Math.max(0, 1 - (spin.age - stopAt) / 0.15);
      drawMonCard(ctx, r, def, dex, pop);
      if (HAS_KEYS) keyHint(ctx, r, `[${i + 1}]`); // [1]/[2]/[3] — desktop keys pick cards
    });
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
  ctx.font = fontB(10);
  ctx.fillStyle = PARCH;
  ctx.fillText('YOUR TEAM', W / 2, 586);
  for (let i = 0; i < 4; i++) {
    const sx = W / 2 - 4 * 44 + i * 88;
    const sr = { x: sx, y: 596, w: 76, h: 90 };
    uiWindow(ctx, sr, { rad: 10 });
    const def = picked[i];
    if (def) {
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, sx + 38, 628, 48);
      ctx.font = fontB(10);
      ctx.fillStyle = INK;
      ctx.fillText(def.name, sx + 38, 672);
    }
  }
  // coverage chips under the slots — the team's types, no caption needed
  const types = [...new Set(picked.map((d) => d.type))];
  if (types.length) {
    types.forEach((ty, i) => {
      const cx = W / 2 - (types.length * 40 - 8) / 2 + i * 40;
      roundRect(ctx, cx, 698, 32, 16, 8);
      ctx.fillStyle = TYPE_COLOR[ty];
      ctx.fill();
      // color alone can't carry the info — 3-letter tag on the chip
      ctx.font = fontB(10);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ty.slice(0, 3).toUpperCase(), cx + 16, 710);
    });
  }

  // the out — a quiet chip in the empty top strip, same dark tag as hints
  chip(ctx, DRAFT_BACK.x, DRAFT_BACK.y + 3, '‹ TITLE', { bg: 'rgba(42,36,64,0.8)', fg: '#a8b0d0' });
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
  if (!spin) return perkCardBody(ctx, r, perk, spin, opts);
  dealCard(ctx, r, spin.i, spin.age, () => perkCardBody(ctx, r, perk, spin, opts));
}

function perkCardBody(
  ctx: CanvasRenderingContext2D,
  r: Rect,
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
  // rarity pill top-left, kind pill top-right — our perks re-apply/stack,
  // so a repeat is DUPE not UPGRADE
  chip(ctx, r.x + 10, r.y + 10, perk.rarity.toUpperCase(), { bg: INK, fg: RARITY_COLOR[perk.rarity] });
  const kind = opts?.owned ? 'DUPE' : 'NEW';
  ctx.font = fontB(10);
  chip(ctx, r.x + r.w - 10 - ctx.measureText(kind).width - 14, r.y + 10, kind, {
    bg: 'rgba(42,36,64,0.8)',
    fg: PARCH,
  });

  const img = itemSprite(perk.item);
  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(img, band.x + band.w / 2 - 28 * pop, band.y + band.h / 2 - 28 * pop, 56 * pop, 56 * pop);
    ctx.restore();
  } else {
    ctx.font = font(16);
    ctx.fillStyle = INK;
    inkCenter(ctx, '?', band.x + band.w / 2, band.y + band.h / 2);
  }
  ctx.textAlign = 'center';
  fitFontB(ctx, perk.name, 10, r.w - 12);
  ctx.fillStyle = INK;
  ctx.fillText(perk.name, r.x + r.w / 2, r.y + 104);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  // greedy wrap inside the card — the old midpoint split overflowed long descs
  // straight into the neighbour card
  fitWrap(ctx, perk.desc, r.w - 16, 10, 3).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + 126 + i * 16));

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
  ping = false, // a fresh catch waits in the box — the team pill glows gold
) {
  // the cleared battle court stays visible under a dim vignette
  choiceCourt(ctx, null, 0.55);

  ctx.textAlign = 'center';
  // a fresh catch gets the hero slot: a gold-rimmed window with a breathing
  // sprite — and it IS the swap button now, tapping opens the team panel
  if (recruit) {
    const r = REWARD_CATCH;
    uiWindow(ctx, r, { rad: 12 });
    rim(ctx, r, 12, GOLD, 2);
    const pulse = 1 + Math.sin(spin * 5) * 0.05;
    drawBackdrop(ctx, { x: r.x + 12, y: r.y + 9, w: 80, h: r.h - 18 }, 8, 'meadow');
    monShadow(ctx, r.x + 52, r.y + r.h / 2, 64);
    (recruit.shiny ? drawShiny : drawMon)(ctx, recruit.id, r.x + 52, r.y + r.h / 2, 64 * pulse);
    ctx.textAlign = 'left';
    ctx.font = fontB(10);
    ctx.fillStyle = GOLD;
    ctx.fillText('NEW CATCH!', r.x + 98, r.y + 24);
    fitFont(ctx, recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), 12, r.w - 112);
    ctx.fillStyle = INK;
    ctx.fillText(recruit.name.toUpperCase() + (recruit.lvl && recruit.lvl > 1 ? ` LV${recruit.lvl}` : ''), r.x + 98, r.y + 46);
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('in your box · swap first, then pick an item', r.x + 98, r.y + 64);
    ctx.textAlign = 'center';
  }

  // a title plate carries the readouts; the offer cards stand on the court
  uiPanel(ctx, { x: 14, y: 262, w: W - 28, h: 108 }, 'CHOOSE AN ITEM');

  ctx.font = font(10);
  ctx.fillStyle = INK;
  ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, W / 2, 334);
  if (spin < REEL_STOPS[REEL_STOPS.length - 1]) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('reels rolling · tap to skip', W / 2, 354);
  } else if (luck > 0) {
    ctx.font = fontB(10);
    ctx.fillStyle = '#6fdc6f';
    ctx.fillText(`TEAM LUCK ${luck} · fusion dupes + bond feed the gym fountain`, W / 2, 354);
  } else {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('pick a relic · your box waits on the map', W / 2, 354);
  }
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
    uiWindow(ctx, { x: ix - 8, y: (four ? 846 : 644) - 4, w: n * (iw + gap) - gap + 16, h: iw + 8 }, { rad: 8, dark: true, shadow: false });
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
  ctx.font = fontB(10);
  const nextY = 852;
  if (!four) {
    if (next.gym) {
      ctx.fillStyle = '#f85888';
      ctx.fillText('NEXT: GYM LEADER', W / 2, nextY);
    } else {
      ctx.fillStyle = PARCH;
      ctx.fillText('NEXT: PICK YOUR ROUTE', W / 2, nextY);
    }
  }
  // every board is pick-one — the old decline-for-score pill is gone; you
  // can still check the deck mid-pick: TEAM · ITEMS is the same panel the
  // map carries. A fresh catch arms it gold — swap first, then pick.
  pill(ctx, REWARD_TEAM, { c: ping ? GOLD_HI : '#e8e8e0', cd: ping ? GOLD : '#aab0c8', tc: INK, label: ping ? 'SWAP THE NEW CATCH IN' : 'TEAM · ITEMS' });

  // a split evolution blocks the reward pick until its form is chosen
  if (evo) {
    choiceCourt(ctx, 'meadow', 0.45);
    uiPanel(ctx, { x: 14, y: 300, w: W - 28, h: 70 }, 'EVOLUTION');
    ctx.textAlign = 'center';
    const head = `${evo.from.name} is evolving · pick a form`;
    ctx.fillStyle = INK_SOFT;
    fitFontB(ctx, head, 10, W - 60);
    ctx.fillText(head, W / 2, 356);
    evo.options.forEach((opt, i) => {
      const r = evoCardRect(i, evo.options.length);
      const cx = r.x + r.w / 2;
      dealCard(ctx, r, i, spin, () => {
        uiWindow(ctx, r, { rad: 10 });
        cardFace(ctx, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 }, opt.type);
        rim(ctx, r, 10, GOLD, 2);
        const patch = { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: 84 };
        drawBackdrop(ctx, patch, 8, 'meadow');
        // split strip along the patch foot sells the dual-type at a glance
        const half = opt.type2 ? patch.w / 2 : patch.w;
        ctx.fillStyle = TYPE_COLOR[opt.type];
        ctx.fillRect(patch.x, patch.y + patch.h - 4, half, 4);
        if (opt.type2) {
          ctx.fillStyle = TYPE_COLOR[opt.type2];
          ctx.fillRect(patch.x + half, patch.y + patch.h - 4, half, 4);
        }
        monShadow(ctx, cx, r.y + 46, 64);
        (opt.shiny ? drawShiny : drawMon)(ctx, opt.id, cx, r.y + 50, 92);
        ctx.fillStyle = INK;
        fitFontB(ctx, opt.name.toUpperCase(), 12, r.w - 12);
        ctx.fillText(opt.name.toUpperCase(), cx, r.y + 109);
        ctx.font = fontB(10);
        ctx.fillStyle = TYPE_COLOR[opt.type];
        ctx.fillText((opt.type2 ? `${opt.type} · ${opt.type2}` : opt.type).toUpperCase(), cx, r.y + 123);
        ctx.fillStyle = GOLD;
        fitFontB(ctx, `★ ${moveOf(opt.id, opt.type)}`, 10, r.w - 12);
        ctx.fillText(`★ ${moveOf(opt.id, opt.type)}`, cx, r.y + 138);
        ctx.fillStyle = INK_SOFT;
        fitWrap(ctx, superDesc(opt.id, opt.type), r.w - 14, 10, 3).forEach((l, li) => ctx.fillText(l, cx, r.y + 152 + li * 12));
      });
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
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  // odds scale off your ace's level — weaklings easy, far-above foes gated
  const capLine = `BOX: beaten foes may join · weakest ${Math.round(catchPct * 300)}%`;
  fitFontB(ctx, capLine, 10, W - 40);
  ctx.fillText(capLine, W / 2, 520);
  if (masterArmed) {
    void loadItem('master-ball');
    const ball = itemSprite('master-ball');
    if (ball) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(ball, W / 2 + ctx.measureText(capLine).width / 2 + 8, 509, 18, 18);
      ctx.restore();
    }
  }
  if (box.length === 0) {
    ctx.font = fontB(10);
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
    monShadow(ctx, r.x + r.w / 2, card.y + 25, 36);
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, r.x + r.w / 2, card.y + 25, 36);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = fontB(10);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', r.x + r.w / 2 + 1, card.y + 29);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', r.x + r.w / 2, card.y + 28);
    } else if (def.shiny) {
      ctx.font = fontB(10);
      ctx.fillStyle = GOLD;
      ctx.fillText('✦', r.x + r.w - 8, card.y + 11);
    }
    hpBar(ctx, r.x + 6, card.y + 46, r.w - 12, boxHp[i] ?? 1);
    ctx.font = fontB(10);
    ctx.fillStyle = ko ? INK_FAINT : TYPE_COLOR[def.type];
    fitFontB(ctx, def.name, 10, r.w - 6);
    ctx.fillText(def.name, r.x + r.w / 2, card.y + 58);
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
    ctx.font = fontB(10);
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

  ctx.font = fontB(11);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('YOUR TEAM', W / 2, 610);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    const sel = i === selTeam;
    const dy = sel ? -3 : 0; // same lift as the box strip — the armed card raises
    const card = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
    // window cells: armed pick goes INK-dark + ▶; while a catch waits in
    // the box every teammate tints gold — the row of hot swap targets
    uiWindow(ctx, card, { rad: 10, dark: sel, tint: !sel && selBox >= 0 ? GOLD_HI : undefined });
    if (sel) cursorTri(ctx, card.x + 9, card.y + card.h / 2 + 2, performance.now() / 1000, PARCH);
    const lvl = teamLvl[i] ?? 1;
    const bl = bondLv(def.id);
    const lt = `${def.shiny ? `✦${lvl}` : `Lv${lvl}`}${bl ? `·B${bl}` : ''}`;
    ctx.font = fontB(12);
    ctx.fillStyle = sel ? PARCH : INK;
    fitFontB(ctx, def.name, 12, card.w - 12);
    ctx.fillText(def.name, card.x + card.w / 2, card.y + 17);
    const patch = { x: card.x + 6, y: card.y + 22, w: card.w - 12, h: 44 };
    drawBackdrop(ctx, patch, 8, 'meadow');
    const cx = card.x + card.w / 2;
    monShadow(ctx, cx, card.y + 44, 48);
    const ko = (teamHp[i] ?? 1) <= 0;
    ctx.globalAlpha = ko ? 0.3 : 1;
    (def.shiny ? drawShiny : drawMon)(ctx, def.id, cx, card.y + 44, 48);
    ctx.globalAlpha = 1;
    if (ko) {
      ctx.font = font(10);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('KO', cx + 1, card.y + 48);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('KO', cx, card.y + 47);
    }
    chip(ctx, patch.x + 2, patch.y + 2, lt, def.shiny
      ? { bg: GOLD, fg: INK }
      : { bg: 'rgba(12,16,32,0.85)', fg: ACCENT });
    hpBar(ctx, card.x + 8, card.y + 70, card.w - 16, teamHp[i] ?? 1);
    const types: PokeType[] = def.type2 ? [def.type, def.type2] : [def.type];
    const typeGap = types.length > 1 ? 4 : 0;
    const chipW = (card.w - 12 - typeGap) / types.length;
    types.forEach((type, ti) => {
      const x = card.x + 6 + ti * (chipW + typeGap);
      const y = card.y + 76;
      roundRect(ctx, x, y, chipW, 16, 6);
      ctx.fillStyle = TYPE_COLOR[type];
      ctx.fill();
      ctx.font = fontB(10);
      ctx.fillStyle = '#fff';
      const label = type.toUpperCase();
      fitFontB(ctx, label, 10, chipW - 6);
      ctx.fillText(label, x + chipW / 2, y + 12);
    });
    ctx.font = fontB(12);
    ctx.fillStyle = ko ? '#464e6e' : INK_FAINT;
    fitFontB(ctx, abilityLabel(def), 12, card.w + 4);
    ctx.fillText(abilityLabel(def), cx, card.y + card.h + 12);
  });
  // the selected mon's super reads here — swapping is a move pick too
  const selDef = selBox >= 0 ? box[selBox] : selTeam >= 0 ? team[selTeam] : null;
  if (selDef) {
    const sbl = bondLv(selDef.id);
    const abilityHint = [abilityLabel(selDef), abilityOf(selDef)?.hint].filter(Boolean).join(' · ');
    ctx.font = fontB(12); ctx.fillStyle = ACCENT;
    fitFontB(ctx, abilityHint, 12, W - 60);
    ctx.fillText(abilityHint, W / 2, 752);
    const moveHint = `★ ${moveOf(selDef.id, selDef.type)} · ${superDesc(selDef.id, selDef.type)}${sbl ? ` · BOND ${sbl}` : ''}`;
    ctx.font = fontB(10);
    ctx.fillStyle = GOLD;
    fitFontB(ctx, moveHint, 10, W - 60);
    ctx.fillText(moveHint, W / 2, 770);
  } else {
    const hint = 'tap a team mon and a box mon to swap them';
    ctx.font = fontB(10);
    const hw = ctx.measureText(hint).width + 14;
    chip(ctx, W / 2 - hw / 2, 744, hint, { bg: 'rgba(42,36,64,0.8)', fg: '#a8b0d0' });
  }
  ctx.textAlign = 'center';
}

// Overworld roster drawer — the map keeps a single TEAM · ITEMS button where
// the mon strip used to sit; the panel shows held items up top and the same
// box/team management the reward break uses.
export const MAP_MENU = { x: W / 2 - 120, y: 872, w: 240, h: 46 };
export const TEAM_PANEL = { x: 24, y: 258, w: W - 48, h: 586 };

export function drawCounterHint(ctx: CanvasRenderingContext2D, gimmick: typeof STAGE_GIMMICKS[keyof typeof STAGE_GIMMICKS], team: SpeciesDef[], x: number, y: number, width: number) {
  const hint = counterHint(gimmick).split(' · ')[1];
  if (!hint) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = fontB(12);
  ctx.strokeText(hint, x, y);
  ctx.fillText(hint, x, y);
  const matches = team.filter((def) => countersGimmick(def, gimmick));
  if (matches.length) {
    const label = matches[0].name.toUpperCase() + (matches.length > 1 ? ` +${matches.length - 1}` : '') + (gaugeCounter(matches[0]) ? ' · GOLD SHOT' : '');
    fitFontB(ctx, label, 12, width);
    ctx.strokeText(label, x, y + 14);
    ctx.fillText(label, x, y + 14);
  }
  ctx.restore();
}
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
  rewardStep = false, // the reward break seats this first — swap, THEN items
) {
  scrim(ctx, 0.82);
  // the roster drawer is a menu window — the INK band carries the title
  uiPanel(ctx, TEAM_PANEL, rewardStep ? 'SET THE LINEUP FIRST' : 'TEAM & ITEMS');
  ctx.textAlign = 'center';
  if (rewardStep) {
    ctx.font = fontB(10);
    ctx.fillStyle = GOLD;
    ctx.fillText('FIX YOUR SQUAD · THE ITEM BOARD WAITS BEHIND THIS', W / 2, TEAM_PANEL.y + 52);
  }

  // held items — the run's build, card rows like the bag list: rarity notch,
  // icon, name and what it does
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('HELD ITEMS', W / 2, 326);
  const shown = heldItems.slice(0, 5);
  if (heldItems.length > shown.length) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.textAlign = 'right';
    ctx.fillText(`+${heldItems.length - shown.length} more`, TEAM_PANEL.x + TEAM_PANEL.w - 16, 326);
    ctx.textAlign = 'center';
  }
  if (!shown.length) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('none yet · relic picks and chests stock it', W / 2, 366);
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
    ctx.textAlign = 'left';
    ctx.font = fontB(10);
    let name = (perk ? perk.name : item).toUpperCase();
    while (name.length > 3 && ctx.measureText(name + '…').width > r.w - 50) name = name.slice(0, -1);
    const nw = ctx.measureText(name).width;
    ctx.fillStyle = INK;
    ctx.fillText(name, r.x + 42, r.y + 19);
    if (perk) {
      ctx.font = fontB(10);
      ctx.fillStyle = INK_FAINT;
      // ellipsize, not hard-clip — a cut glyph reads as text spilling off the row
      const dscW = r.x + r.w - 10 - (r.x + 48 + nw);
      // a long name can eat the whole row — no room means no desc, never
      // a negative width that lands text past the row's edge
      if (dscW > 26) {
        let dsc = `· ${perk.desc}`;
        while (dsc.length > 3 && ctx.measureText(dsc + '…').width > dscW) dsc = dsc.slice(0, -1);
        ctx.fillText(dsc, r.x + 48 + nw, r.y + 19);
      }
    }
    ctx.textAlign = 'center';
  });

  drawRoster(ctx, box, boxHp, boxLvl, boxScroll, selBox, team, teamHp, teamLvl, selTeam, catchPct, masterArmed);
  pill(ctx, MENU_CLOSE, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: rewardStep ? 'DONE → ITEMS' : 'CLOSE' });
  // the quiet out — dark like evo KEEP; the parked pk_run is what CONTINUE resumes
  pill(ctx, MENU_QUIT, { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'QUIT TO TITLE' });
}

// Starter-charm pick before stage 1 — same card look, standalone screen.
export function drawPerkPick(
  ctx: CanvasRenderingContext2D,
  offers: Perk[],
  title: string,
  sub: string,
  _t = 0,
  team: SpeciesDef[] = [],
) {
  choiceCourt(ctx, 'meadow', 0.35);
  ctx.textAlign = 'center';
  const four = offers.length >= 4; // the lab's FOURTH OPTION hits the charm board too
  // same board as the draft: a title plate, cards standing on the court
  const py = four ? 84 : 232;
  uiPanel(ctx, { x: 14, y: py, w: W - 28, h: 70 }, title);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  fitFontB(ctx, sub, 10, W - 60);
  ctx.fillText(sub, W / 2, py + 56);
  offers.forEach((p, i) => {
    const r = charmCardRect(i, offers.length);
    dealCard(ctx, r, i, 9, () => drawPerkCard(ctx, r, p, undefined, { idx: i }));
  });
  // declining pays score instead — a dead offer still has a price
  pill(ctx, charmSkipRect(offers.length), { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'SKIP +200 PTS' });
  // the drafted squad rides under the offers — pick the item for THESE mons
  if (team.length) {
    const labelY = four ? 780 : 584;
    const monY = four ? 798 : 632; // drawMon centers — half the sprite + pad
    const monS = four ? 48 : 62;
    uiWindow(ctx, { x: 30, y: labelY - 18, w: W - 60, h: four ? 94 : 120 }, { rad: 12, dark: true });
    ctx.font = fontB(10);
    ctx.fillStyle = PARCH;
    ctx.fillText('YOUR TEAM', W / 2, labelY);
    team.forEach((def, i) => {
      const mx = W / 2 + (i - (team.length - 1) / 2) * (four ? 82 : 92);
      monShadow(ctx, mx, monY, monS);
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, mx, monY, monS);
      ctx.font = fontB(10);
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name.toUpperCase(), mx, monY + (four ? 36 : 34));
      ctx.font = fontB(10);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillText(def.type.toUpperCase(), mx, monY + (four ? 48 : 46));
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

// The stop's MS-style result: CLEAR, the stat rows file in, the rank ball
// pops, then the rank's star bonus ticks up. Any tap closes it (main.ts).
const RANK_INK: Record<ClearRank, string> = { S: '#c8900c', A: DANGER, B: ACCENT, C: INK_SOFT };
const CLEAR_ROWS = 5;
function clearIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number) {
  void loadItem(name);
  const img = itemSprite(name);
  if (!img) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}
function bestTag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.font = fontB(13);
  const w = ctx.measureText('NEW BEST').width + 14;
  roundRect(ctx, x - w, y - 13, w, 20, 5);
  ctx.fillStyle = GOLD_HI;
  ctx.fill();
  edge(ctx, { x: x - w, y: y - 13, w, h: 20 }, 5);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText('NEW BEST', x - w / 2, y + 2);
}
export function drawClearCard(ctx: CanvasRenderingContext2D, c: ClearCard, age: number) {
  ctx.save();
  scrim(ctx, 0.78);
  const rankAt = 0.3 + CLEAR_ROWS * 0.12 + 0.15;
  if (c.rank === 'S' && age > rankAt) confetti(ctx, age);
  const panel = { x: 30, y: 140, w: W - 60, h: 630 };
  const pop = clamp01(age / 0.22);
  ctx.translate(W / 2, panel.y + panel.h / 2);
  ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
  ctx.translate(-W / 2, -(panel.y + panel.h / 2));
  ctx.globalAlpha = pop;
  uiWindow(ctx, panel, { rad: 10 });
  uiBand(ctx, panel, `STAGE ${c.stage} · RESULT`, { h: 40 });
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.font = font(40);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.strokeText('CLEAR!', cx, panel.y + 116);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText('CLEAR!', cx, panel.y + 116);
  const speed = c.turns <= c.par;
  const rows: [label: string, value: string, best: boolean][] = [
    ['TURNS', `${c.turns}/${c.par}`, c.best.turns],
    ['MAX COMBO', `×${c.combo}`, c.best.combo],
    ['WEAK HITS', `${c.weak}`, false],
    ['KOs', `${c.kos}`, false],
    ['DMG TAKEN', c.faints ? `${c.taken} · ${c.faints} DOWN` : `${c.taken}`, false],
    ...(c.chain ? [['BEST CHAIN', c.chain.alls ? `ALL CONNECT ×${c.chain.alls}` : `${c.chain.best}`, false] as [string, string, boolean]] : []),
  ];
  const ix = panel.x + 28;
  const vx = panel.x + panel.w - 28;
  rows.forEach(([label, value, best], i) => {
    const a = clamp01((age - 0.3 - i * 0.12) / 0.16);
    if (a <= 0) return;
    const y = panel.y + 180 + i * Math.min(56, 230 / (rows.length - 1));
    ctx.globalAlpha = pop * a;
    ctx.textAlign = 'left';
    ctx.font = fontB(22);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(label, ix + (1 - a) * 24, y);
    const lw = ctx.measureText(label).width;
    ctx.textAlign = 'right';
    fitFont(ctx, value, 20, vx - ix - lw - 20);
    ctx.fillStyle = i === 0 && speed ? '#2f9a3a' : INK;
    ctx.fillText(value, vx, y);
    const vw = ctx.measureText(value).width;
    if (i === 0 && speed) {
      clearIcon(ctx, 'quick-claw', vx - vw - 22, y - 8, 36);
      ctx.font = fontB(14);
      ctx.fillStyle = '#2f9a3a';
      ctx.fillText('SPEED CLEAR', vx - vw - 44, y - 1);
    } else if (best) bestTag(ctx, vx - vw - 12, y - 6);
    ctx.fillStyle = 'rgba(40,48,88,0.12)';
    ctx.fillRect(ix, y + 16, vx - ix, 2);
  });
  // the rank: its ball slams in big, the letter rides beside it
  const ry = panel.y + 500;
  const ra = clamp01((age - rankAt) / 0.25);
  if (ra > 0) {
    ctx.globalAlpha = pop;
    const s = 1 + (1 - ra) * 0.8;
    ctx.save();
    ctx.translate(cx - 70, ry);
    ctx.scale(s, s);
    ctx.globalAlpha = pop * ra;
    clearIcon(ctx, RANK_BALL[c.rank], 0, 0, 96);
    ctx.restore();
    ctx.globalAlpha = pop * ra;
    ctx.textAlign = 'left';
    ctx.font = fontB(18);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('RANK', cx - 6, ry - 54);
    ctx.font = font(56);
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText(c.rank, cx - 10, ry + 46);
    ctx.fillStyle = RANK_INK[c.rank];
    ctx.fillText(c.rank, cx - 10, ry + 46);
    if (c.best.rank) bestTag(ctx, vx, ry - 26);
    if (c.missions) drawMissionTicks(ctx, c.missions, cx + 70, ry, pop * ra);
  }
  // the payout ticks up once the rank lands
  const pa = clamp01((age - rankAt - 0.3) / 0.4);
  if (c.pay > 0 && pa > 0) {
    ctx.globalAlpha = pop;
    const n = Math.round(c.pay * pa);
    const py = panel.y + panel.h - 44;
    ctx.font = font(16);
    const label = `+${n} STAR PIECE${c.pay > 1 ? 'S' : ''}`;
    const w = ctx.measureText(label).width + 40;
    clearIcon(ctx, 'star-piece', cx - w / 2 + 12, py - 6, 40);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7a52c8';
    ctx.fillText(label, cx - w / 2 + 38, py);
  }
  ctx.restore();
  // blinks under the card — one tap moves on to the reward board
  if (age > 0.6 && Math.floor(age * 2.2) % 2 === 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = fontB(18);
    ctx.fillStyle = PARCH;
    ctx.fillText('TAP TO CONTINUE', W / 2, panel.y + panel.h + 44);
    ctx.restore();
  }
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
  age = 99, // seconds since the report opened — rows file in staggered
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
    ['DEPTH', `${depthN || '0'}/${TOTAL_STAGES}`, INK],
    ['SHOTS', `${res.shots}`, INK],
    ['TIME', `${res.time.toFixed(1)}s`, INK],
    ['CAUGHT', `${res.caught}`, INK],
  ];
  if (res.bestCombo) findings.push(['BEST COMBO', `×${res.bestCombo}`, INK]);
  if (res.rankStreak) findings.push(['RANK STREAK', `${res.rankStreak} · A OR BETTER`, INK]);
  if (res.loot) findings.push(['TREASURE', `${res.loot} BALL${res.loot > 1 ? 'S' : ''} OPENED`, GOLD]);
  if (res.secrets?.n) findings.push(['SECRETS', `${res.secrets.n}/${res.secrets.of}${res.secrets.fresh ? ` · +${res.secrets.fresh} NEW` : ''}`, '#c9a8ff']);
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
      `${r.delta >= 0 ? '+' : ''}${r.delta} ${r.tier}${r.up ? ' ★ RANK UP' : r.down ? ' ▼ RANK DOWN' : ''}${res.place >= 0 ? ` · HOF #${res.place + 1}` : ''}`,
      r.color,
    ]);
  }
  if (res.newDex > 0) findings.push(['NEW DEX', `+${res.newDex}`, ACCENT]);

  // six rows carry the ledger: the run's vitals, then its payouts — the
  // bookkeeping rest folds into a +N tail line
  const pinned = (l: string) => l === 'SCORE' || l === 'DEPTH' || l === 'CAUGHT';
  const shown = [
    ...findings.filter(([l]) => pinned(l)),
    ...findings.filter(([l, , c]) => !pinned(l) && c !== INK),
    ...findings.filter(([l, , c]) => !pinned(l) && c === INK),
  ].slice(0, 6);
  const moreN = findings.length - shown.length;
  const findingsRows = shown.length + (moreN > 0 ? 1 : 0);

  ctx.font = fontB(10);
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
    findingsRows * rowH +
    recH +
    (extra ? 18 + Math.min(noteLines.length, noteCap) * 18 + 6 : 0) +
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
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;

  // the CASE line is the file's index card — run number when main files
  // one, otherwise the seed carries the reference
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`CASE ${res.runNo ?? res.seed}${res.runNo != null ? ` · SEED ${res.seed}` : ''}`, ix, panel.y + 66);

  // the verdict is stamped, not printed — tilted ink hanging half off the
  // card's top-right corner; it used to sit inside and clip the band title
  ctx.save();
  ctx.translate(panel.x + panel.w - 104, panel.y - 10);
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
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('FINDINGS', ix, panel.y + 96);

  // the findings stack clips at the card floor — a compacted report keeps
  // its top rows and loses tail rows to the cap, never over the buttons
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y + 44, panel.w, panel.h - 44);
  ctx.clip();

  shown.forEach(([label, value, color], i) => {
    const fy = panel.y + findingsY + i * rowH;
    // the ledger files row by row — each finding ticks in 70ms apart
    const rowA = clamp01((age - 0.2 - i * 0.07) / 0.18);
    if (rowA <= 0) return;
    ctx.globalAlpha = rowA;
    ctx.font = fontB(10);
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
    ctx.globalAlpha = 1;
  });
  if (moreN > 0) {
    const fy = panel.y + findingsY + shown.length * rowH;
    const rowA = clamp01((age - 0.2 - shown.length * 0.07) / 0.18);
    if (rowA > 0) {
      ctx.globalAlpha = rowA;
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
      ctx.fillStyle = INK_FAINT;
      ctx.fillText(`+ ${moreN} MORE`, panel.x + panel.w / 2, fy);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
  let yy = panel.y + findingsY + findingsRows * rowH;

  // so-close framing — the near-record loss is the strongest rematch pull
  if (res.newBest) {
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = '#ffe76a';
    ctx.fillText('★ NEW RECORD ★', W / 2, yy + 14);
    yy += 22;
  } else if (res.shortOfBest > 0) {
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`${res.shortOfBest.toLocaleString('en-US')} PTS SHORT OF YOUR BEST`, W / 2, yy + 14);
    yy += 22;
  }

  // the free-text margin: loss detail or ascension unlock, filed verbatim
  if (extra) {
    ctx.textAlign = 'left';
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('FIELD NOTE', ix, yy + 12);
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(ix + ctx.measureText('FIELD NOTE').width + 8, yy + 9, vx - ix - ctx.measureText('FIELD NOTE').width - 8, 1);
    ctx.font = fontB(10);
    ctx.fillStyle = '#f8d030';
    noteDrawn.forEach((l, li) => ctx.fillText(l, ix, yy + 24 + li * 18));
    yy += 18 + noteDrawn.length * 18 + 6;
  }

  // fresh trophies get their own gold line under the findings block
  if (res.newAch.length) {
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = GOLD;
    ctx.fillText(`★ ${res.newAch.join(' · ')} ★`, W / 2, yy + 14);
    yy += 20;
  }

  // run badges — rarity-colored chips, capped rows when the report compacts
  badgeDrawn.forEach((row, ri) => {
    const by = yy + 4 + ri * 28;
    ctx.font = fontB(10);
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      const br = { x: bx, y: by, w: ws[i], h: 20 };
      roundRect(ctx, br.x, br.y, br.w, br.h, 5);
      ctx.fillStyle = PAPER;
      ctx.fill();
      rim(ctx, br, 5, RARITY_COLOR[b.rarity]);
      edge(ctx, br, 5);
      ctx.font = fontB(10);
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      // x is the chip's center — realign, or the note block's 'left' spill
      // shifts the name half a width past the rim
      ctx.textAlign = 'center';
      ctx.fillText(b.name, bx + ws[i] / 2, by + 14);
      bx += ws[i] + 8;
    });
  });
  if (badgeRows.length > badgeDrawn.length) {
    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`+ ${badgeRows.slice(badgeCap).flat().length} MORE BADGES`, W / 2, yy + 4 + badgeDrawn.length * 28 + 12);
  }
  ctx.restore(); // the card-floor clip ends — attachments draw uncapped

  // the attachment — squad + wave grid ride below the report itself
  const ay = panel.y + panel.h;
  ctx.textAlign = 'center';
  if (share) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('· SQUAD ATTACHMENT ·', W / 2, ay + 14);
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
      ctx.font = fontB(10);
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
    ctx.font = fontB(10);
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
  ctx.font = fontB(10);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff42';
  ctx.fillText(`SEED ${res.seed} · ${__BUILD__}`, 14, 22);
  ctx.restore();
}

// toLocaleString per frame was the HUD's only non-trivial alloc — two slots
// memoize it (the score is stable for seconds at a time)
let scoreStrN = -1;
let scoreStr = '';

export function drawHud(ctx: CanvasRenderingContext2D, shots: number, score: number) {
  if (score !== scoreStrN) {
    scoreStrN = score;
    scoreStr = score.toLocaleString('en-US');
  }
  ctx.font = fontB(11);
  const rw = Math.max(measureW(ctx, `SHOTS ${shots}`), measureW(ctx, `SCORE ${scoreStr}`)) + 30;
  uiWindow(ctx, { x: 14, y: 20, w: rw, h: 48 }, { dark: true, shadow: false });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SHOTS ${shots}`, 24, 40);
  ctx.fillStyle = GOLD;
  ctx.fillText(`SCORE ${scoreStr}`, 24, 60);
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

export const SETTINGS_PANEL = { x: 22, y: 38, w: W - 44, h: 720 };
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
  const cols = Math.min(AV_COLS, AVATARS.length);
  const gw = cols * AV_CELL.w + (cols - 1) * AV_CELL.gap;
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

export function drawSettings(
  ctx: CanvasRenderingContext2D,
  cat: SettingsCat,
  vals: Settings,
) {
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
    fitFontB(ctx, c.name, 10, r.w - 70);
    ctx.fillStyle = on ? PARCH : INK_SOFT;
    ctx.fillText(c.name, r.x + 62, r.y + 35);
    ctx.font = fontB(10);
    ctx.fillStyle = on ? '#a8b0d0' : INK_FAINT;
    ctx.fillText(c.tab, r.x + 62, r.y + 53);
  });

  // the live category's header — an ink slab row under the title band.
  // (SET_BAND's old y already clears the uiBand; the nudge keeps it so.)
  const P = SET_PANEL;
  uiRow(ctx, { x: SET_ROW.x, y: SET_BAND.y + 22, w: SET_ROW.w, h: 42 }, cdef.name, {
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
      ctx.font = fontB(10);
      ctx.fillStyle = on ? GOLD : INK_FAINT;
      ctx.fillText(a.name, r.x + r.w / 2, r.y + r.h - 7);
    });
  }

  SET_ROWS[cat].forEach((row, i) => {
    const r = settingsRowRect(i, cat);
    // the label rides a uiRow strip — a lone toggle centers in its row;
    // sliders/segs/subs pin theirs to the top 36px, controls below
    const stripH = row.kind === 'toggle' && !row.sub ? r.h : 36;
    uiWindow(ctx, { x: r.x - 4, y: r.y, w: r.w + 8, h: r.h }, { rad: 8, shadow: false });
    // the strip sits 6px into the card so the pixel caps clear its top frame
    uiRow(ctx, { x: r.x, y: stripH === 36 ? r.y + 6 : r.y, w: r.w, h: stripH }, row.label, { sub: row.sub, px: 10 });
    if (row.kind === 'slider') {
      // a throttled write keeps the thumb live from the pending value —
      // vals[] only catches up at the ~4Hz flush
      const v = sliderPending?.key === row.key ? sliderPending.v : vals[row.key];
      ctx.font = fontB(10);
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(v * 100)}%`, r.x + r.w - 10, r.y + 24);
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
        ctx.font = fontB(10);
        ctx.fillStyle = oi === sel ? INK : INK_FAINT;
        ctx.fillText(o.toUpperCase(), tr.x + sw * (oi + 0.5), tr.y + tr.h / 2 + 4);
      });
    }
  });

  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('saved when you leave', P.x + P.w / 2, P.y + P.h - 14);

  // the × chip rides centered on the wide close rect — the tap zone
  // (SETTINGS_CLOSE) is bigger than the mark on purpose
  const cc = SETTINGS_CLOSE;
  uiClose(ctx, { x: cc.x + cc.w / 2 - cc.h / 2, y: cc.y, w: cc.h, h: cc.h });
}

// --- tasks modal: daily/weekly missions — the settings anatomy (dim -----
// --- screen, gold-rimmed panel, striped band, close pill) but the rail ---
// --- becomes a top row of two period tabs, each mission is a row card ---
// --- with a reward cluster + state slab on the right, and the bag shelf -
// --- anchors the bottom above the close chip. ---------------------------

export const TASKS_PANEL = { x: 30, y: 68, w: W - 60, h: H - 140 };
export const TASKS_CLOSE = { x: W / 2 - 90, y: TASKS_PANEL.y + TASKS_PANEL.h - 58, w: 180, h: 44 };
// hit-test order — {kind:'tab', i} maps back through this list (SETTINGS_CATS trick)
export const TASKS_TABS = ['daily', 'weekly'] as const;

export type TasksHit = { kind: 'tab'; i: number } | { kind: 'claim'; i: number } | { kind: 'close' };

const TASKS_TAB_H = 44;
const TASKS_TAB_GAP = 8;
// the strip under the tabs is the modal's voice — one text line, not a band
const TASKS_BAND = { x: TASKS_PANEL.x + 4, y: TASKS_PANEL.y + 22 + TASKS_TAB_H + 2, w: TASKS_PANEL.w - 8, h: 24 };
const TASKS_ROWS_Y = TASKS_BAND.y + TASKS_BAND.h + 8;
// the board splits in two: task cards share the upper room evenly (3 dailies
// breathe as much as 4 weeklies), the bag shelf anchors the bottom. Content
// stops at the close chip's top rail — the OVL_CLOSE convention — so the
// grid is derived UP from it and can never clip under the chip.
const CONTENT_BOT = TASKS_CLOSE.y - 10;
const BAG_COLS = 4;
const BAG_CELL_H = 44;
const BAG_CELL_GAP = 6;
const BAG_GRID_H = Math.ceil(BAG_ITEMS.length / BAG_COLS) * (BAG_CELL_H + BAG_CELL_GAP) - BAG_CELL_GAP;
const BAG_GRID_Y = CONTENT_BOT - BAG_GRID_H;
const BAG_BAND_Y = BAG_GRID_Y - 28; // 20px band + 8px air
const TASKS_ROWS_BOT = BAG_BAND_Y - 10;
const TASKS_CLAIM_W = 96;
const TASKS_CLAIM_H = 64; // the ≈60px slab — the HIG touch floor on a phone
const TASKS_REWARD_W = 88; // the icon+name column pinned beside the slab

// two equal pills across the panel top — the rail, squashed into a row
export function tasksTabRect(i: number) {
  const w = (TASKS_PANEL.w - 28 - TASKS_TAB_GAP) / 2;
  return { x: TASKS_PANEL.x + 14 + i * (w + TASKS_TAB_GAP), y: TASKS_PANEL.y + 22, w, h: TASKS_TAB_H };
}

function taskRowRect(i: number, n: number) {
  // the pitch divides the shared room by the board's size — hit-testing uses
  // the same math as the draw, so the geometry stays law on both tabs
  const pitch = Math.min(118, Math.floor((TASKS_ROWS_BOT - TASKS_ROWS_Y) / n));
  return { x: TASKS_PANEL.x + 14, y: TASKS_ROWS_Y + i * pitch, w: TASKS_PANEL.w - 28, h: pitch - 8 };
}

// the state slab is one tall target centered on the card's midline —
// ~60px tall so the live hitbox is thumb-sized on a phone
function taskClaimRect(row: { x: number; y: number; w: number; h: number }) {
  const h = Math.min(TASKS_CLAIM_H, row.h - 16);
  return { x: row.x + row.w - TASKS_CLAIM_W - 10, y: row.y + (row.h - h) / 2, w: TASKS_CLAIM_W, h };
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
    if (inRect(p.x, p.y, taskClaimRect(taskRowRect(i, views.length)))) return { kind: 'claim', i };
  }
  return null; // dead panel space is still modal
}

function overlayBandTitle(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, title: string, o: Parameters<typeof uiBand>[3] = {}) {
  uiBand(ctx, r, '', o);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PARCH;
  fitFontB(ctx, title, 18, r.w - 40);
  ctx.fillText(title, r.x + r.w / 2, r.y + 19);
  ctx.restore();
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
  overlayBandTitle(ctx, TASKS_PANEL, 'TASKS', { sub: `NEW TASKS ${taskResetsIn(tab)}` });
  TASKS_TABS.forEach((id, i) => {
    const r = tasksTabRect(i);
    const on = id === tab;
    fitFontB(ctx, id.toUpperCase(), 18, r.w - 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? PARCH : INK_SOFT;
    ctx.fillText(id.toUpperCase(), r.x + r.w / 2, r.y + r.h - 7);
  });

  // the strip under the tabs is the modal's voice — claim flash or promise
  ctx.textAlign = 'left';
  ctx.font = fontB(10);
  ctx.fillStyle = flash ? GOLD : INK_SOFT;
  ctx.fillText(flash ?? 'rewards land in your bag', TASKS_BAND.x + 10, TASKS_BAND.y + TASKS_BAND.h / 2 + 3);

  if (!views.length) {
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('ALL CLEAR · CHECK BACK AFTER THE RESET', TASKS_PANEL.x + TASKS_PANEL.w / 2, TASKS_ROWS_Y + 60);
  }

  views.forEach((v, i) => {
    const r = taskRowRect(i, views.length);
    const ready = v.done && !v.claimed;
    // each task is its own paper card — a claimable one wears the gold rim
    // and the blinking ▶, the rest stay quiet list windows
    uiWindow(ctx, r, { rad: 8 });
    if (ready) {
      rim(ctx, r, 8, GOLD, 2);
      cursorTri(ctx, r.x + 8, r.y + r.h / 2 - 16, t, INK);
    }

    const cr = taskClaimRect(r);
    const rcx = cr.x - 10 - TASKS_REWARD_W; // the reward column, pinned to the slab
    const midY = r.y + r.h / 2;
    const tx = r.x + 20; // the ▶ claims the left edge — text starts past it
    const textR = rcx - 8; // label, desc and bar never cross the reward cluster

    ctx.textAlign = 'left';
    fitFontB(ctx, v.label, 18, textR - tx - 52);
    ctx.fillStyle = v.claimed ? INK_FAINT : INK;
    ctx.fillText(v.label, tx, r.y + 22);
    ctx.font = fontB(10);
    ctx.fillStyle = v.claimed ? '#464e6e' : ready ? INK_SOFT : INK_FAINT;
    let dsc = v.desc.toUpperCase();
    while (dsc.length > 3 && ctx.measureText(dsc + '…').width > textR - tx) dsc = dsc.slice(0, -1);
    ctx.fillText(dsc === v.desc.toUpperCase() ? dsc : dsc + '…', tx, r.y + 43);
    // the counter rides the label line — the slab is for the state
    const counter = `${v.have}/${v.n}`;
    fitFontB(ctx, counter, 18, 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = v.claimed ? INK_FAINT : ready ? INK : GOLD;
    ctx.fillText(counter, textR, r.y + 22);
    ctx.textAlign = 'left';

    // the progress track is the card's foot — a dark groove with the gold
    // ramp and the percent inked inside; it runs under the reward column
    // but never beneath the slab
    const br = { x: tx, y: r.y + r.h - 20, w: cr.x - 10 - tx, h: 12 };
    roundRect(ctx, br.x, br.y, br.w, br.h, 6);
    ctx.fillStyle = '#0a0d18';
    ctx.fill();
    const frac = Math.min(1, v.have / v.n);
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, br.x, br.y, br.w, br.h, 6);
      ctx.clip();
      const g = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
      g.addColorStop(0, '#ffe76a');
      g.addColorStop(0.55, GOLD);
      g.addColorStop(1, '#c8a44d');
      ctx.fillStyle = g;
      ctx.fillRect(br.x, br.y, Math.max(br.h, br.w * frac), br.h);
      ctx.restore();
    }
    roundRect(ctx, br.x, br.y, br.w, br.h, 6);
    ctx.strokeStyle = '#d0d0c8';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = frac >= 0.45 ? '#1b2140' : PAPER_HI;
    ctx.fillText(`${Math.round(frac * 100)}%`, br.x + br.w / 2, br.y + 9);
    ctx.textAlign = 'left';

    // the reward reads as one cluster beside the slab — icon over name,
    // both centered on the card's midline; ghosted till done, spent grey
    // once claimed
    const spr = BAG_ITEMS.find((it) => it.id === v.reward)?.item ?? v.reward;
    void loadItem(spr);
    const img = itemSprite(spr);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = v.claimed ? 0.3 : v.done ? 1 : 0.55;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, rcx + (TASKS_REWARD_W - 30) / 2, midY - 22, 30, 30);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = v.claimed ? INK_FAINT : ready ? GOLD : INK_SOFT;
    const rewardName = (BAG_ITEMS.find((it) => it.id === v.reward)?.name ?? v.reward).toUpperCase();
    fitFontB(ctx, rewardName, 10, TASKS_REWARD_W);
    ctx.fillText(rewardName, rcx + TASKS_REWARD_W / 2, midY + 16);
    ctx.textAlign = 'left';

    if (ready) {
      // the armed claim pulses — a dark ink pill on the gold slab is the
      // loudest contrast in the kit; this modal exists for this tap
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 6 + (Math.sin(t * 4) * 0.5 + 0.5) * 8;
      pill(ctx, cr, { c: '#1b2140', cd: INK, tc: GOLD_HI, label: '' });
      fitFontB(ctx, 'CLAIM', 18, cr.w - 8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = GOLD_HI;
      ctx.fillText('CLAIM', cr.x + cr.w / 2, cr.y + cr.h / 2 - 1);
      ctx.restore();
    } else if (v.claimed) {
      ctx.font = fontB(13);
      const cw = ctx.measureText('EARNED').width + 14;
      chip(ctx, cr.x + (cr.w - cw) / 2, cr.y + (cr.h - 20) / 2, 'EARNED', { bg: '#d0d0c8', fg: INK_FAINT, fontPx: 13 });
    } else {
      // not done — a ghost slab holds the slot where the button will arm
      roundRect(ctx, cr.x, cr.y, cr.w, cr.h, cr.h / 2);
      ctx.strokeStyle = '#c8c8c0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_FAINT;
      fitFontB(ctx, 'IN THE FIELD', 10, cr.w - 10);
      ctx.fillText('IN THE FIELD', cr.x + cr.w / 2, cr.y + cr.h / 2 + 4);
      ctx.textAlign = 'left';
    }
  });

  // the bag shelf — the screen's other half; claims land here. Every slot
  // draws: stocked cells bright, empties ghosted so the shelf never voids
  uiBand(ctx, { x: TASKS_PANEL.x + 14, y: BAG_BAND_Y, w: TASKS_PANEL.w - 28, h: 20 }, 'YOUR BAG · TAKE 2 INTO A RUN', { h: 20, rad: 5 });
  const stock = bagStock();
  const cellW = (TASKS_PANEL.w - 28 - (BAG_COLS - 1) * BAG_CELL_GAP) / BAG_COLS;
  const slots = BAG_COLS * Math.ceil(BAG_ITEMS.length / BAG_COLS);
  for (let i = 0; i < slots; i++) {
    const cx = TASKS_PANEL.x + 14 + (i % BAG_COLS) * (cellW + BAG_CELL_GAP);
    const cy = BAG_GRID_Y + Math.floor(i / BAG_COLS) * (BAG_CELL_H + BAG_CELL_GAP);
    const r = { x: cx, y: cy, w: cellW, h: BAG_CELL_H };
    const it = BAG_ITEMS[i];
    const n = it ? (stock[it.id] ?? 0) : 0;
    uiWindow(ctx, r, { rad: 8, rim: false, shadow: false });
    if (!it) continue; // trailing slots stay bare shelf
    const img = itemSprite(it.item);
    void loadItem(it.item);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = n > 0 ? 1 : 0.3;
      ctx.drawImage(img, r.x + 8, r.y + (r.h - 24) / 2, 24, 24);
      ctx.restore();
    }
    ctx.font = fontB(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = n > 0 ? INK_SOFT : INK_FAINT;
    // long names clip with an ellipsis — the font floor can't shrink to fit
    let nm = it.name.toUpperCase();
    while (nm.length > 3 && ctx.measureText(nm + '…').width > r.w - 44) nm = nm.slice(0, -1);
    ctx.fillText(nm === it.name.toUpperCase() ? nm : nm + '…', r.x + 38, r.y + 19);
    ctx.fillStyle = n > 0 ? GOLD : INK_FAINT;
    ctx.fillText(n > 0 ? `×${n}` : '·', r.x + 38, r.y + 33);
  }

  // the × chip rides centered on the wide close rect — the tap zone
  // (TASKS_CLOSE) is bigger than the mark on purpose
  const cc = TASKS_CLOSE;
  uiClose(ctx, { x: cc.x + cc.w / 2 - cc.h / 2, y: cc.y, w: cc.h, h: cc.h });
}
