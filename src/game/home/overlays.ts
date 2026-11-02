// Town building overlays: PROF.'S LAB (star-piece upgrades), TROPHIES
// (badge case + achievement list) and HALL OF FAME (top climbs). All three
// share the tasks board's look: one framed paper window, paper cards with a
// gold rim when something is ready, dark progress grooves, real item/badge/mon
// art, and the bottom × chip.
import { drawMon, itemSprite, loadItem } from '../../core/assets';
import { TOTAL_STAGES } from '../data';
import {
  ACHIEVEMENTS, BADGES, LAB_UPGRADES, LADDER, best, board, dexIds, gymBadges, labLevels, streakDaily, streakWins, tier, unlockedAch,
} from '../meta';
import { CATCHABLE, balanceChip, chip, fitFont, fitFontB, monShadow, pill, rim, roundRect } from '../screens';
import { GOLD, GOLD_HI, INK, INK_FAINT, INK_SOFT, PAPER_HI, PARCH, fontB, scrim, uiBand, uiClose, uiWindow, type Rect } from '../ui';

const W = 540;
const H = 960;
// same frame as the hatcher/dex/tasks panels — main.ts hit-tests HATCH_PANEL
const P = { x: 30, y: 68, w: W - 60, h: H - 140 };
// the wide close zone under every overlay; the drawn × chip sits centered on it
export const OVL_CLOSE = { x: W / 2 - 90, y: P.y + P.h - 58, w: 180, h: 44 };
const VIEW_BOT = OVL_CLOSE.y - 10;

const inRect = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function frame(ctx: CanvasRenderingContext2D, title: string, sub?: string) {
  scrim(ctx, 0.75);
  uiWindow(ctx, P);
  uiBand(ctx, P, title, sub ? { sub } : {});
}

function closeChip(ctx: CanvasRenderingContext2D) {
  const c = OVL_CLOSE;
  uiClose(ctx, { x: c.x + c.w / 2 - c.h / 2, y: c.y, w: c.h, h: c.h });
}

function icon(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, alpha = 1) {
  void loadItem(name);
  const img = itemSprite(name);
  if (!img) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

// round paper socket an icon sits in; `lit` warms it to gold
function socket(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lit: boolean, warm = true) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = lit ? (warm ? '#f6e9c2' : '#dde8fa') : '#e2e2da';
  ctx.fill();
  ctx.strokeStyle = lit ? GOLD : '#b8bac4';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// the tasks board's groove: dark track, gold ramp, optional label inked inside,
// optional level ticks
function groove(ctx: CanvasRenderingContext2D, r: Rect, frac: number, label?: string, ticks = 0) {
  const rad = Math.min(6, r.h / 2);
  roundRect(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = '#0a0d18';
  ctx.fill();
  if (frac > 0) {
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, rad);
    ctx.clip();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#ffe76a');
    g.addColorStop(0.55, GOLD);
    g.addColorStop(1, '#c8a44d');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, Math.max(r.h, r.w * Math.min(1, frac)), r.h);
    ctx.restore();
  }
  if (ticks > 1) {
    ctx.fillStyle = 'rgba(248,248,240,0.55)';
    for (let i = 1; i < ticks; i++) ctx.fillRect(Math.round(r.x + (r.w * i) / ticks) - 1, r.y + 2, 2, r.h - 4);
  }
  roundRect(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.strokeStyle = '#d0d0c8';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (label) {
    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = frac >= 0.45 ? '#1b2140' : PAPER_HI;
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4.5);
  }
}

// cut a line to `maxW` with an ellipsis
function clipText(ctx: CanvasRenderingContext2D, s: string, maxW: number) {
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

// slim rail + gold thumb, the dex shelf's scroll language
function rail(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, scroll: number, total: number) {
  if (total <= h) return;
  ctx.fillStyle = 'rgba(12,16,32,0.25)';
  roundRect(ctx, x, y + 4, 4, h - 8, 2);
  ctx.fill();
  const th = Math.max(24, (h / total) * (h - 8));
  const ty = y + 4 + (scroll / (total - h)) * (h - 8 - th);
  ctx.fillStyle = GOLD;
  roundRect(ctx, x, ty, 4, th, 2);
  ctx.fill();
}

// --- hall of fame: the top climbs this device has logged, score-ranked -----
const HOF_TOP = P.y + 112;
const HOF_PITCH = 80;
const HOF_BALL = ['master-ball', 'ultra-ball', 'great-ball'];
const LADDER_BALL = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'shiny-charm'];
const LADDER_TOP = P.y + 256;
const LADDER_PITCH = 60;
// the empty ledger's door: a dead hall still owes you the climb
export const HOF_CLIMB = { x: W / 2 - 130, y: LADDER_TOP + LADDER.length * LADDER_PITCH + 14, w: 260, h: 56 };

export function drawBoard(ctx: CanvasRenderingContext2D) {
  frame(ctx, 'HALL OF FAME');

  // the lifetime ledger: four stat cells under the band
  const bb = best();
  const cells: [string, string][] = [
    ['BEST', bb.score.toLocaleString('en-US')],
    ['PEAK', `${bb.stage}/${TOTAL_STAGES}`],
    ['RUNS', `${bb.runs}`],
    ['WINS', `${bb.wins}`],
  ];
  const cw = (P.w - 28 - 3 * 8) / 4;
  cells.forEach(([k, v], i) => {
    const r = { x: P.x + 14 + i * (cw + 8), y: P.y + 46, w: cw, h: 52 };
    uiWindow(ctx, r, { rad: 8, rim: false, shadow: false });
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(k, r.x + r.w / 2, r.y + 20);
    fitFont(ctx, v, 9, r.w - 12);
    ctx.fillStyle = INK;
    ctx.fillText(v, r.x + r.w / 2, r.y + 42);
  });

  const list = board();
  if (!list.length) {
    const r = { x: P.x + 14, y: HOF_TOP, w: P.w - 28, h: 92 };
    uiWindow(ctx, r, { rad: 8 });
    icon(ctx, 'poke-ball', r.x + 40, r.y + r.h / 2, 36, 0.45);
    ctx.textAlign = 'left';
    fitFont(ctx, 'NO CLIMBS LOGGED', 9, r.w - 90);
    ctx.fillStyle = INK;
    ctx.fillText('NO CLIMBS LOGGED', r.x + 76, r.y + 40);
    ctx.font = fontB(10);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('Finish a climb to post your first score', r.x + 76, r.y + 64);

    // an empty hall still teaches the climb: the rank ladder
    const rt = tier();
    uiBand(ctx, { x: P.x + 14, y: LADDER_TOP - 32, w: P.w - 28, h: 20 }, `RANK LADDER · YOU'RE ${rt.name}`, { h: 20, rad: 5 });
    LADDER.forEach((t, i) => {
      const cur = i === rt.i;
      const lr = { x: P.x + 14, y: LADDER_TOP + i * LADDER_PITCH, w: P.w - 28, h: LADDER_PITCH - 8 };
      uiWindow(ctx, lr, { rad: 8, dark: cur, shadow: !cur ? false : undefined });
      icon(ctx, LADDER_BALL[i] ?? 'poke-ball', lr.x + 30, lr.y + lr.h / 2, 30, cur || i < rt.i ? 1 : 0.45);
      ctx.textAlign = 'left';
      fitFont(ctx, t.name, 9, lr.w - 180);
      ctx.fillStyle = cur ? PARCH : i < rt.i ? INK : INK_SOFT;
      ctx.fillText(t.name, lr.x + 58, lr.y + lr.h / 2 + 6);
      ctx.textAlign = 'right';
      ctx.font = fontB(10);
      ctx.fillStyle = cur ? GOLD_HI : INK_FAINT;
      ctx.fillText(cur ? 'YOU ARE HERE' : `${t.at} RATING`, lr.x + lr.w - 14, lr.y + lr.h / 2 + 5);
    });
    pill(ctx, HOF_CLIMB, { c: GOLD_HI, cd: GOLD, tc: INK, label: 'START A CLIMB' });
    closeChip(ctx);
    return;
  }

  list.forEach((e, i) => {
    const r = { x: P.x + 14, y: HOF_TOP + i * HOF_PITCH, w: P.w - 28, h: HOF_PITCH - 8 };
    if (r.y + r.h > VIEW_BOT) return;
    const lead = i === 0;
    uiWindow(ctx, r, { rad: 8, tint: lead ? '#fbf1d2' : undefined });
    if (lead) rim(ctx, r, 8, GOLD, 2);
    // the place medal: a real ball, best first
    icon(ctx, HOF_BALL[i] ?? 'poke-ball', r.x + 30, r.y + 28, 30);
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = lead ? INK : INK_SOFT;
    ctx.fillText(`#${i + 1}`, r.x + 30, r.y + r.h - 10);

    const teamW = Math.min(4, e.team.length) * 46;
    const tx = r.x + 60;
    ctx.textAlign = 'left';
    const score = e.s.toLocaleString('en-US');
    fitFont(ctx, score, 11, r.w - 70 - teamW - 14);
    ctx.fillStyle = INK;
    ctx.fillText(score, tx, r.y + 32);
    let lx = tx;
    if (e.w) lx += chip(ctx, lx, r.y + 42, 'CLEARED', { bg: GOLD, fg: INK }) + 6;
    const d = new Date(e.when);
    const meta = `${e.w ? '' : `STAGE ${e.st}/${TOTAL_STAGES} · `}${e.asc ? `ASC ${e.asc} · ` : ''}${d.getMonth() + 1}/${d.getDate()}`;
    ctx.font = fontB(10);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(meta, lx, r.y + 57);

    // the run's lineup stands on the card's right edge, grounded on shadows
    e.team.slice(0, 4).forEach((id, ti) => {
      const mx = r.x + r.w - 30 - (Math.min(4, e.team.length) - 1 - ti) * 46;
      const my = r.y + r.h / 2 - 2;
      monShadow(ctx, mx, my + 4, 40);
      try {
        drawMon(ctx, id, mx, my, 44);
      } catch {
        /* sprite not warmed */
      }
    });
  });
  closeChip(ctx);
}

// --- trophies: the badge case on top, the achievement list under -----------
const ACH_ICON: Record<string, string> = {
  'first-clear': 'ultra-ball',
  ascended: 'expert-belt',
  triple: 'kings-rock',
  badge: 'black-belt',
  league: 'soul-dew',
  rival: 'muscle-band',
  shiny: 'shiny-charm',
  myth: 'lustrous-orb',
  perfect: 'scope-lens',
  pinball: 'metronome',
  ult: 'power-herb',
  collector: 'poke-ball',
  living: 'master-ball',
  rampage: 'choice-band',
  'hot-streak': 'star-piece',
  'daily-devotion': 'lucky-egg',
};
const CASE = { x: P.x + 14, y: P.y + 74, w: P.w - 28, h: 168 };
const ACH_VIEW = { x: P.x + 10, y: CASE.y + CASE.h + 12, w: P.w - 20, h: 0 };
ACH_VIEW.h = VIEW_BOT - ACH_VIEW.y;
const ACH_PITCH = 74;

export function achScrollMax() {
  return Math.max(0, ACHIEVEMENTS.length * ACH_PITCH + 4 - ACH_VIEW.h);
}

export function drawAch(ctx: CanvasRenderingContext2D, scroll: number) {
  const got = unlockedAch();
  const held = gymBadges();
  frame(ctx, 'TROPHIES');

  const n = ACHIEVEMENTS.filter((a) => got.has(a.id)).length;
  groove(ctx, { x: P.x + 16, y: P.y + 46, w: P.w - 32, h: 18 }, n / ACHIEVEMENTS.length, `${n}/${ACHIEVEMENTS.length} EARNED`);

  // the badge case: a dark felt tray, one canon badge per leader
  uiWindow(ctx, CASE, { dark: true, rad: 10 });
  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(`BADGE CASE ${held.size}/${BADGES.length}`, CASE.x + CASE.w / 2, CASE.y + 24);
  BADGES.forEach((b, i) => {
    const rowN = Math.min(6, BADGES.length - Math.floor(i / 6) * 6); // center the short last row
    const cx = CASE.x + CASE.w / 2 + ((i % 6) - (rowN - 1) / 2) * 70;
    const cy = CASE.y + 56 + Math.floor(i / 6) * 62;
    const has = held.has(b.boss);
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1b2140';
    ctx.fill();
    ctx.strokeStyle = has ? GOLD : '#3a4370';
    ctx.lineWidth = 2;
    ctx.stroke();
    const img = itemSprite(`badges/${b.icon}`);
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = has ? 1 : 0.25; // unearned slots read as indentations
      ctx.drawImage(img, cx - 15, cy - 15, 30, 30);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.font = fontB(10);
    ctx.fillStyle = has ? PARCH : '#6a7298';
    ctx.fillText(b.name.replace(' BADGE', ''), cx, cy + 36);
  });

  // locked trophies with a count get a live bar: the goal gradient
  const dexN = dexIds().length;
  const progress: Record<string, [number, number] | undefined> = {
    collector: [dexN, 50],
    living: [dexN, CATCHABLE],
    triple: [best().wins, 3],
    league: [held.size, BADGES.length],
    'hot-streak': [streakWins(), 3],
    'daily-devotion': [streakDaily(), 7],
  };
  const v = ACH_VIEW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ACHIEVEMENTS.forEach((a, i) => {
    const r = { x: v.x + 4, y: v.y + 4 + i * ACH_PITCH - scroll, w: v.w - 18, h: ACH_PITCH - 8 };
    if (r.y + r.h < v.y || r.y > v.y + v.h) return;
    const has = got.has(a.id);
    uiWindow(ctx, r, { rad: 8, tint: has ? undefined : '#eeede4' });
    if (has) rim(ctx, r, 8, GOLD, 2);
    const gym = a.id.startsWith('gym-') ? BADGES.find((b) => b.boss === +a.id.slice(4)) : undefined;
    socket(ctx, r.x + 34, r.y + r.h / 2, 21, has);
    icon(ctx, gym ? `badges/${gym.icon}` : (ACH_ICON[a.id] ?? 'star-piece'), r.x + 34, r.y + r.h / 2, 30, has ? 1 : 0.35);

    const tx = r.x + 66;
    const right = r.x + r.w - 14;
    ctx.textAlign = 'right';
    let rw = 0;
    const prog = !has && progress[a.id];
    if (has) {
      ctx.font = fontB(10);
      rw = ctx.measureText('EARNED').width + 14;
      chip(ctx, right - rw, r.y + 10, 'EARNED', { bg: GOLD, fg: INK });
    } else {
      ctx.font = fontB(10);
      const txt = prog ? `${Math.min(prog[0], prog[1])}/${prog[1]}` : 'LOCKED';
      rw = ctx.measureText(txt).width;
      ctx.fillStyle = prog && prog[0] >= prog[1] * 0.7 ? GOLD : INK_FAINT; // close loops read gold
      ctx.fillText(txt, right, r.y + 25);
    }
    ctx.textAlign = 'left';
    fitFontB(ctx, a.name, 11, right - rw - 10 - tx);
    ctx.fillStyle = has ? INK : INK_SOFT;
    ctx.fillText(a.name, tx, r.y + 25);
    ctx.font = fontB(10);
    ctx.fillStyle = has ? INK_SOFT : INK_FAINT;
    ctx.fillText(clipText(ctx, a.desc, right - tx), tx, r.y + 44);
    if (prog) groove(ctx, { x: tx, y: r.y + r.h - 16, w: right - tx, h: 8 }, prog[0] / prog[1]);
  });
  ctx.restore();
  rail(ctx, v.x + v.w - 8, v.y, v.h, scroll, ACHIEVEMENTS.length * ACH_PITCH + 4);
  closeChip(ctx);
}

// --- the lab: the deterministic sink, every star buys a sure thing ----------
const LAB_COLS = 2;
const LAB_CARD_W = 219;
const LAB_CARD_H = 144;
const LAB_GAP = 10;
const LAB_VIEW = { x: P.x + 16, y: P.y + 86, w: P.w - 32, h: 0 };
LAB_VIEW.h = VIEW_BOT - LAB_VIEW.y;
// section split by id: the rest of LAB_UPGRADES lands in RUN TEAM
const LAB_TRAIN = new Set(['hp', 'dmg', 'spc', 'luck']);

// the upgrade pill's rect inside a card; labHit tests the card's bottom slab
const labBuyRect = (r: Rect) => ({ x: r.x + 10, y: r.y + r.h - 40, w: r.w - 20, h: 30 });

// card rects + section heads in CONTENT coords (y=0 is the view top);
// drawLab and labHit share this so a tap always lands where a card drew
let labLayoutCache: ReturnType<typeof computeLabLayout> | null = null;
function labLayout() {
  return (labLayoutCache ??= computeLabLayout());
}
function computeLabLayout() {
  const secs: [string, (typeof LAB_UPGRADES)[number][], boolean][] = [
    ['TRAINING · EVERY RUN STARTS STRONGER', LAB_UPGRADES.filter((u) => LAB_TRAIN.has(u.id)), true],
    ['RUN TEAM · PER-RUN TOOLS', LAB_UPGRADES.filter((u) => !LAB_TRAIN.has(u.id)), false],
  ];
  const heads: { text: string; y: number }[] = [];
  const cards: { u: (typeof LAB_UPGRADES)[number]; train: boolean; r: Rect }[] = [];
  let y = 0;
  for (const [title, list, train] of secs) {
    if (!list.length) continue;
    heads.push({ text: title, y });
    y += 30;
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
    y += Math.ceil(list.length / LAB_COLS) * (LAB_CARD_H + LAB_GAP) + 8;
  }
  return { heads, cards, h: y };
}

export function labScrollMax() {
  return Math.max(0, labLayout().h - LAB_VIEW.h);
}

// pointer → lab upgrade id, or null. Only the card's bottom 48px slab (the
// pill plus margin) answers, so a stray tap on the card text never spends.
export function labHit(scroll: number, x: number, y: number): string | null {
  if (!inRect(x, y, LAB_VIEW)) return null;
  for (const c of labLayout().cards) {
    const cr = { ...c.r, y: c.r.y + LAB_VIEW.y - scroll };
    const buy = labBuyRect(cr);
    if (inRect(x, y, { x: buy.x, y: cr.y + cr.h - 48, w: buy.w, h: 48 })) return c.u.id;
  }
  return null;
}

function drawLabCard(ctx: CanvasRenderingContext2D, r: Rect, u: (typeof LAB_UPGRADES)[number], train: boolean, stars: number, lvl: number) {
  const maxed = lvl >= u.max;
  const cost = u.costs[lvl] ?? 0;
  const afford = !maxed && stars >= cost;
  // a paper card like a task; one you can buy right now wears the gold rim
  uiWindow(ctx, r, { rad: 8 });
  if (afford) rim(ctx, r, 8, GOLD, 2);

  socket(ctx, r.x + 32, r.y + 32, 21, lvl > 0, train);
  icon(ctx, u.icon, r.x + 32, r.y + 32, 32);
  const tx = r.x + 62;
  ctx.textAlign = 'left';
  fitFontB(ctx, u.name, 11, r.x + r.w - 12 - tx);
  ctx.fillStyle = INK;
  ctx.fillText(u.name, tx, r.y + 28);
  ctx.font = fontB(10);
  ctx.fillStyle = maxed ? GOLD : INK_SOFT;
  ctx.fillText(maxed ? `LV ${lvl}/${u.max} · MAX` : `LV ${lvl}/${u.max}`, tx, r.y + 46);

  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(clipText(ctx, u.desc, r.w - 24), r.x + 12, r.y + 70);
  // what the bought levels already add up to
  if (lvl > 0) {
    ctx.fillStyle = GOLD;
    ctx.fillText(clipText(ctx, `NOW ${u.now(lvl).toUpperCase()}`, r.w - 24), r.x + 12, r.y + 86);
  }

  groove(ctx, { x: r.x + 12, y: r.y + 92, w: r.w - 24, h: 8 }, lvl / u.max, undefined, u.max);

  const buy = labBuyRect(r);
  if (maxed) {
    pill(ctx, buy, { c: '#d8d8d0', cd: INK, tc: INK_FAINT, label: 'MAXED', disabled: true });
    return;
  }
  // affordable: the gold CTA pill; broke: greyed. The price rides the badge.
  pill(ctx, buy, { c: GOLD_HI, cd: GOLD, tc: INK, label: afford ? 'UPGRADE' : 'NEED', badge: `${cost}`, disabled: !afford });
  icon(ctx, 'star-piece', buy.x + 18, buy.y + buy.h / 2 - 2, 18, afford ? 1 : 0.5);
}

export function drawLab(ctx: CanvasRenderingContext2D, scroll: number, stars: number) {
  void loadItem('star-piece');
  frame(ctx, "PROF.'S LAB");

  ctx.textAlign = 'left';
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText('Star pieces buy levels that last', P.x + 16, P.y + 64);
  balanceChip(ctx, { x: P.x + P.w - 176, y: P.y + 44, w: 160, h: 30 }, stars);

  const { heads, cards, h } = labLayout();
  const lvls = labLevels();
  const v = LAB_VIEW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x - 6, v.y, v.w + 12, v.h);
  ctx.clip();
  for (const hd of heads) {
    const hy = v.y + hd.y - scroll;
    uiBand(ctx, { x: v.x, y: hy, w: v.w, h: 20 }, hd.text, { h: 20, rad: 5 });
  }
  for (const c of cards) {
    const cr = { ...c.r, y: c.r.y + v.y - scroll };
    if (cr.y + cr.h < v.y || cr.y > v.y + v.h) continue;
    drawLabCard(ctx, cr, c.u, c.train, stars, lvls[c.u.id] ?? 0);
  }
  ctx.restore();
  rail(ctx, P.x + P.w - 12, v.y, v.h, scroll, h);
  closeChip(ctx);
}

// --- the battle freeze: a paper card over the dimmed court. The rects live
// in battle.ts (main.ts hit-tests them); this only paints.
export function drawPauseCard(
  ctx: CanvasRenderingContext2D,
  court: string,
  info: string,
  ff: boolean,
  t: number,
  b: { settings: Rect; quit: Rect; speed: Rect },
) {
  ctx.fillStyle = 'rgba(4,6,16,0.6)';
  ctx.fillRect(0, 0, W, 2000);
  const r = { x: b.settings.x - 34, y: b.settings.y - 146, w: b.settings.w + 68, h: b.speed.y + b.speed.h + 26 - (b.settings.y - 146) };
  uiWindow(ctx, r, { rad: 12 });
  uiBand(ctx, r, 'PAUSED');
  ctx.textAlign = 'center';
  fitFont(ctx, court, 10, r.w - 32);
  ctx.fillStyle = INK;
  ctx.fillText(court, W / 2, r.y + 68);
  ctx.font = fontB(10);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(clipText(ctx, info, r.w - 32), W / 2, r.y + 90);
  ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.25;
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('tap anywhere to resume', W / 2, r.y + 120);
  ctx.globalAlpha = 1;
  const quiet = { c: '#e8e8e0', cd: INK, tc: INK };
  pill(ctx, b.settings, { ...quiet, label: 'SETTINGS' });
  pill(ctx, b.quit, { ...quiet, label: 'QUIT TO TITLE' });
  pill(ctx, b.speed, ff ? { c: GOLD_HI, cd: GOLD, tc: INK, label: 'SPEED ×2' } : { ...quiet, label: 'SPEED ×1' });
}

// --- the day's login drop: a paper slip with the week strip, the 7th day
// is the spike
export function drawLoginDrop(ctx: CanvasRenderingContext2D, lt: { n: number; prize: number; back: number }, y: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const r = { x: W / 2 - 150, y, w: 300, h: lt.back > 0 ? 92 : 76 };
  uiWindow(ctx, r, { rad: 10 });
  rim(ctx, r, 10, GOLD, 2);
  icon(ctx, 'star-piece', r.x + 30, r.y + 30, 30);
  ctx.textAlign = 'left';
  const msg = `DAY ${lt.n} LOGIN · +${lt.prize}★`;
  fitFont(ctx, msg, 10, r.w - 70);
  ctx.fillStyle = INK;
  ctx.fillText(msg, r.x + 54, r.y + 30);
  const wk = ((lt.n - 1) % 7) + 1;
  for (let i = 1; i <= 7; i++) {
    const cx = r.x + 62 + (i - 1) * 30;
    const cy = r.y + 54;
    ctx.beginPath();
    ctx.arc(cx, cy, i === 7 ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = i <= wk ? GOLD_HI : '#e2e2da';
    ctx.fill();
    ctx.strokeStyle = i === wk ? INK : i <= wk ? GOLD : '#b8bac4';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (lt.back > 0) {
    ctx.font = fontB(10);
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(`WELCOME BACK · +${lt.back}★`, r.x + 54, r.y + 80);
  }
  ctx.restore();
}
