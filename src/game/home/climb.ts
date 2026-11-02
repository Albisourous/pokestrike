// CLIMB home tab: the run's stage 1 as a cached Gracidea court (gym, trees,
// rim, the opener pack, your trainer + lead), one hero START/CONTINUE pill,
// the ascension ladder, and two side doors (free pull, today's raid).
import { drawMon, drawNpc, itemSprite, loadItem, loadSprite } from '../../core/assets';
import { ASC_MODS, makeStage, speciesById, type StageDef } from '../data';
import { drawAmbient, drawBackdrop, drawWall, slice, type Theme } from '../bg';
import * as MT from '../maptiles';
import type { TileRect } from '../maptiles';
import { INK, INK_SOFT, INK_FAINT, PAPER, GOLD, GOLD_HI, DANGER, font, fontB, uiWindow, uiPanel, cursorTri } from '../ui';
import {
  ascCap, ascPick, best, bondPts, boostLeft, coachDone, echoIds, freePullLeft, nextRookie, raidDoneToday, rankName,
  ROOKIE_STEPS, runSave, settings, starBoost, streakWins, tier, trainerPick,
} from '../meta';
import { raidPick } from '../tasks';
import { pill, fitFont, fitFontB, roundRect } from '../screens';

// local copies: screens.ts imports this module, so its consts aren't live yet at load
const W = 540;
const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const CLIMB_SCENE = { x: 20, y: 222, w: W - 40, h: 264 };
export const FREE_BTN = { x: 20, y: 500, w: W - 40, h: 84 };
// a parked save splits the hero row: CONTINUE left, RESTART on the flank
export const RESTART_BTN = { x: 376, y: FREE_BTN.y, w: W - 20 - 376, h: FREE_BTN.h };
export const ASC_BTN = { x: 20, y: 598, w: W - 40, h: 146 };
export const CLIMB_FREE = { x: 20, y: 758, w: 244, h: 60 };
export const CLIMB_RAID = { x: 276, y: 758, w: 244, h: 60 };

// fresh-save diet: before the coached first run, the climb tab is just the
// court + START — ladder and side doors draw and hit-test behind this gate
export const freshClimb = () => !coachDone() && best().runs === 0;

// stage 1's seed pre-rolls here and newRun() consumes it, so the preview is the truth
let climbSeed = (Math.random() * 0x7fffffff) | 0 || 1;
export function takeClimbSeed() {
  const s = climbSeed;
  climbSeed = (Math.random() * 0x7fffffff) | 0 || 1;
  return s;
}

let stgMemo: { seed: number; stg: StageDef } | null = null;
const stageFor = (seed: number) => {
  if (stgMemo?.seed !== seed) stgMemo = { seed, stg: makeStage(seed) };
  return stgMemo.stg;
};

// the fallen team's ghosts loiter on the court's front row; a tap opens their dex card
const ECHO_X = [70, 430, 130];
const ECHO_FOOT = CLIMB_SCENE.y + 238;
export function echoMonAt(x: number, y: number): number | null {
  const ids = echoIds()?.slice(0, 3);
  if (!ids?.length) return null;
  for (let i = 0; i < ids.length; i++)
    if (inRect(x, y, { x: CLIMB_SCENE.x + ECHO_X[i] - 28, y: ECHO_FOOT - 56, w: 56, h: 60 })) return ids[i].id;
  return null;
}

// --- cached court: floor crop + gym + trees + rim, one canvas per theme ---
const courts = new Map<Theme, HTMLCanvasElement>();
const PROPS: [TileRect, number, number, number][] = [
  // rect, x, y (top-left in scene px), scale
  [MT.TREE_PINE, 14, 6, 2],
  [MT.TREE_ROUND, 82, 30, 2],
  [MT.TILE_GYM, 182, 8, 2],
  [MT.FLOWER_PINK, 146, 96, 1.4],
  [MT.FLOWER_PINK, 316, 96, 1.4],
  [MT.TREE_ROUND, 350, 30, 2],
  [MT.TREE_PINE, 420, 6, 2],
];
function court(theme: Theme): HTMLCanvasElement | null {
  const hit = courts.get(theme);
  if (hit) return hit;
  const tiles = PROPS.map(([r]) => slice(r));
  if (tiles.some((t) => !t)) return null; // atlas still loading; retry next frame
  const { w, h } = CLIMB_SCENE;
  const full = document.createElement('canvas');
  full.width = 540;
  full.height = 960;
  drawBackdrop(full.getContext('2d')!, { x: 0, y: 0, w: 540, h: 960 }, 0, theme);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(full, 30, 330, 480, 254, 0, 0, w, h);
  PROPS.forEach(([r, x, y, s], i) => {
    const pw = r[2] * s, ph = r[3] * s;
    g.fillStyle = 'rgba(8,24,8,0.28)';
    g.beginPath();
    g.ellipse(x + pw / 2, y + ph - 2, pw * 0.42, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(tiles[i]!, x, y, pw, ph);
  });
  drawWall(g, { x: 0, y: 0, w, h }, theme);
  courts.set(theme, c);
  return c;
}

const shadow = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.fillStyle = 'rgba(8,24,8,0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.42, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
};

const plate = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, right = false, fg = PAPER) => {
  ctx.font = fontB(12);
  const w = ctx.measureText(text).width + 18;
  const px = right ? x - w : x;
  roundRect(ctx, px, y, w, 26, 9);
  ctx.fillStyle = 'rgba(40,48,88,0.88)';
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.fillText(text, px + 9, y + 18);
};

let leadMemo = { s: -1, id: 25 };
function leadId(t: number): number {
  const s = Math.floor(t);
  if (leadMemo.s !== s) {
    const top = Object.entries(bondPts()).sort((a, b) => b[1] - a[1])[0];
    const cand = runSave()?.team[0]?.id ?? (top ? +top[0] : 25);
    leadMemo = { s, id: speciesById(cand) ? cand : 25 }; // a corrupt save id never reaches the sprite cache
  }
  return leadMemo.id;
}

function drawScene(ctx: CanvasRenderingContext2D, t: number, cont: { stage: number; seed: number } | null) {
  const S = CLIMB_SCENE;
  const stg = stageFor(cont?.seed ?? climbSeed);
  ctx.save();
  roundRect(ctx, S.x - 3, S.y - 3, S.w + 6, S.h + 6, 15);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, S.x, S.y, S.w, S.h, 12);
  ctx.clip();
  const c = court(stg.theme);
  if (c) ctx.drawImage(c, S.x, S.y);
  else drawBackdrop(ctx, S, 12, stg.theme);
  drawAmbient(ctx, { x: S.x, y: S.y - 40, w: S.w, h: S.h + 60 }, stg.theme, t, settings().quality === 'low' ? 0.25 : 0.55);

  // the opener pack holds the middle band, evenly spread so three foes never fuse
  const pack = stg.waves[0];
  pack.forEach((sp, i) => {
    const mx = S.x + S.w * (pack.length === 1 ? 0.5 : 0.24 + (0.52 * i) / (pack.length - 1));
    const my = S.y + 176;
    shadow(ctx, mx, my, 50);
    void loadSprite(sp.def.id).catch(() => {});
    drawMon(ctx, sp.def.id, mx, my - 21 + Math.sin(t * 2.2 + i * 1.7) * 2, 50);
  });

  const echo = echoIds()?.slice(0, 3);
  if (echo?.length) {
    ctx.globalAlpha = 0.42;
    echo.forEach((e, i) => {
      const ex = S.x + ECHO_X[i];
      shadow(ctx, ex, ECHO_FOOT, 46);
      void loadSprite(e.id).catch(() => {});
      drawMon(ctx, e.id, ex, ECHO_FOOT - 20 + Math.sin(t * 1.6 + i * 2.1) * 3, 46);
    });
    ctx.globalAlpha = 1;
  }

  // you, back to camera, facing the gym; your lead out front
  const lead = leadId(t);
  const fy = S.y + S.h - 18;
  shadow(ctx, S.x + 214, fy, 40);
  drawNpc(ctx, `${trainerPick()}_up_0`, S.x + 214, fy, 58);
  shadow(ctx, S.x + 290, fy, 84);
  void loadSprite(lead).catch(() => {});
  drawMon(ctx, lead, S.x + 290, fy - 34 + Math.sin(t * 1.8) * 2, 84);
  ctx.restore();

  plate(ctx, S.x + 12, S.y + 12, `STAGE ${cont ? Math.max(1, cont.stage) : 1} · ${stg.name.toUpperCase()}`);
  plate(ctx, S.x + S.w - 12, S.y + 12, `${stg.waves.flat().length} FOES`, true);
  // records plate: the one-more-run hook (rank, best, ball tier, streak,
  // boost) — a fresh save has no records to hook, so the plate stays home
  const b = best();
  if (b.runs > 0) {
    const ld = tier();
    const bits = [`RANK ${rankName()}`, `BEST ${b.score.toLocaleString('en-US')}`];
    bits.push(ld.next ? `${ld.name} ${Math.round(ld.prog * 100)}%` : `${ld.name} MAX`);
    const wStreak = streakWins();
    if (wStreak > 1) bits.push(`STREAK ${wStreak}`);
    plate(ctx, S.x + 12, S.y + 44, bits.join(' · '), false, '#d8def8');
  }
  const boostMs = boostLeft();
  if (boostMs > 0)
    plate(ctx, S.x + S.w - 12, S.y + 44, `★ BOOST ×${starBoost()} ${Math.floor(boostMs / 3600000)}h${String(Math.floor((boostMs % 3600000) / 60000)).padStart(2, '0')}m`, true, GOLD_HI);
}

// --- ascension ladder: 10 rungs (0 = base climb), the pick names what it adds ---
const ASC_NCELLS = ASC_MODS.length + 1;
const ASC_CELL_W = 44;
const ASC_CELL_GAP = 4;
export function ascCellRect(i: number) {
  const w = ASC_NCELLS * ASC_CELL_W + (ASC_NCELLS - 1) * ASC_CELL_GAP;
  return { x: ASC_BTN.x + (ASC_BTN.w - w) / 2 + i * (ASC_CELL_W + ASC_CELL_GAP), y: ASC_BTN.y + 42, w: ASC_CELL_W, h: 46 };
}
export function hitAscCell(x: number, y: number): number {
  if (!inRect(x, y, ASC_BTN)) return -1;
  for (let i = 0; i < ASC_NCELLS; i++) {
    const r = ascCellRect(i);
    if (inRect(x, y, { x: r.x - ASC_CELL_GAP / 2, y: r.y - 6, w: r.w + ASC_CELL_GAP, h: r.h + 12 })) return i;
  }
  return -1;
}
let ascDeny = { i: -1, t: -10 };
export function noteAscDeny(i: number, t: number) {
  ascDeny = { i, t };
}

export function drawAscLadder(ctx: CanvasRenderingContext2D, t: number, r: typeof ASC_BTN, cap: number, pick: number) {
  uiPanel(ctx, r, 'ASCENSION', { rad: 12, sub: cap ? `LV ${cap}/9 OPEN` : 'LOCKED' });
  const denied = ascDeny.i >= 0 && t - ascDeny.t < 1.5 ? ascDeny.i : -1;
  for (let i = 0; i < ASC_NCELLS; i++) {
    const cr = ascCellRect(i);
    const sel = i === pick;
    const locked = i > cap;
    ctx.save();
    if (sel) ctx.translate(0, -3);
    if (locked) ctx.globalAlpha = 0.45;
    uiWindow(ctx, cr, { rad: 7, shadow: false, ...(sel ? { tint: GOLD } : !locked && i < pick ? { tint: '#e8d9a8' } : {}) });
    ctx.font = font(11);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(`${i}`, cr.x + cr.w / 2, cr.y + cr.h / 2 + 8);
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
  // line 1 names the rung, line 2 says what it adds; a locked tap previews the prize
  const show = denied >= 0 ? denied : pick;
  const short = denied - cap;
  const head = denied >= 0
    ? `LV ${denied} LOCKED · ${short} MORE WIN${short > 1 ? 'S' : ''}`
    : show === 0 ? 'LV 0 · STANDARD RULES' : `LV ${show} · ${ASC_MODS[show - 1].name}`;
  const body = show === 0
    ? cap ? 'THE BASE CLIMB · TAP A RUNG TO HEAT UP' : 'WIN A CLIMB TO OPEN LV 1'
    : `${ASC_MODS[show - 1].desc.toUpperCase()}${show > 1 && denied < 0 ? ` · STACKS ${show} RULES` : ''}`;
  ctx.textAlign = 'center';
  fitFontB(ctx, head, 14, r.w - 28);
  ctx.fillStyle = denied >= 0 ? DANGER : INK;
  ctx.fillText(head, r.x + r.w / 2, r.y + 114);
  fitFontB(ctx, body, 12, r.w - 28);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(body, r.x + r.w / 2, r.y + 134);
}

// a side door: real item/mon icon, a title, and a ready/locked state line
function door(
  ctx: CanvasRenderingContext2D, r: typeof CLIMB_FREE, icon: (x: number, y: number) => void,
  title: string, state: string, ready: boolean,
) {
  uiWindow(ctx, r, { rad: 10 });
  icon(r.x + 34, r.y + r.h / 2);
  ctx.textAlign = 'left';
  fitFontB(ctx, title, 13, r.w - 74);
  ctx.fillStyle = INK;
  ctx.fillText(title, r.x + 64, r.y + 27);
  fitFontB(ctx, state, 12, r.w - 74);
  ctx.fillStyle = ready ? '#2a8a3a' : INK_FAINT;
  ctx.fillText(state, r.x + 64, r.y + 47);
}

export function drawClimb(
  ctx: CanvasRenderingContext2D,
  t: number,
  cont: { stage: number; score: number; seed: number } | null,
  restartArmed: boolean,
  logoBig: (ctx: CanvasRenderingContext2D, text: string, cx: number, baseY: number, size: number, maxW: number) => void,
) {
  const logo = itemSprite('ui/pokemon-logo');
  if (logo) ctx.drawImage(logo, W / 2 - 150, 50, 300, 110);
  logoBig(ctx, 'STRIKE', W / 2, 206, 46, 300);

  drawScene(ctx, t, cont);

  // the hero pill: biggest thing on screen, its own big label + blinking ▶
  const rookie = nextRookie();
  const hero = cont ? { ...FREE_BTN, w: RESTART_BTN.x - 12 - FREE_BTN.x } : FREE_BTN;
  const label = cont ? 'CONTINUE' : 'START CLIMB';
  const sub = cont ? `STAGE ${Math.max(1, cont.stage)} · ${cont.score.toLocaleString('en-US')} PTS`
    : rookie ? `ROOKIE ${rookie.n + 1}/${ROOKIE_STEPS.length} · ${rookie.label}` : `ASCENSION ${ascPick()}`;
  pill(ctx, hero, { c: GOLD_HI, cd: GOLD, tc: INK, label: '' });
  const hx = hero.x + hero.w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  fitFont(ctx, label, 18, hero.w - 80);
  ctx.fillText(label, hx + 10, hero.y + 42);
  cursorTri(ctx, hx + 10 - ctx.measureText(label).width / 2 - 22, hero.y + 33, t);
  fitFontB(ctx, sub, 13, hero.w - 40);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(sub, hx, hero.y + 66);
  if (cont) {
    pill(ctx, RESTART_BTN, restartArmed
      ? { c: DANGER, cd: '#a02a24', tc: '#ffe8e8', label: 'DROP RUN?', sub: 'TAP AGAIN' }
      : { c: '#e8e8e0', cd: '#aab0c8', tc: INK, label: 'RESTART', sub: 'NEW SEED' });
  }

  if (freshClimb()) return; // logo, diorama, START — the rest earns its place after run one

  drawAscLadder(ctx, t, ASC_BTN, ascCap(), ascPick());

  const free = freePullLeft();
  door(ctx, CLIMB_FREE, (x, y) => {
    const ball = itemSprite('poke-ball');
    if (ball) ctx.drawImage(ball, x - 18, y - 18, 36, 36);
    else void loadItem('poke-ball');
  }, 'FREE PULL', free ? 'READY · OPEN SHOP' : 'BACK TOMORROW', free);
  const boss = raidPick();
  const raided = raidDoneToday();
  door(ctx, CLIMB_RAID, (x, y) => {
    void loadSprite(boss.id);
    drawMon(ctx, boss.id, x, y, 48);
  }, `TODAY'S RAID · ${boss.name.toUpperCase()}`, raided ? 'CLEARED TODAY' : 'READY · OPEN RAID', !raided);

}
