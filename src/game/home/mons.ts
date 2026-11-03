import { drawMon, drawShiny, gracidea, itemSprite, loadItem, loadSprite, whiteSprite } from '../../core/assets';
import { abilityLabel, abilityOf } from '../abilities';
import { DEX_ALL, EVO_LINES, INVADER_IDS, PULLABLE, PULL_PITY, TOTAL_STAGES, setPay, speciesById, tierOf } from '../data';
import { drawAmbient, drawBackdrop, hash } from '../bg';
import { drawTile } from '../map';
import {
  FLOWER_PINK, FLOWER_WILD, ROCK_SMALL, TREE_PINE, TREE_ROUND, TREE_TEAL,
} from '../maptiles';
import {
  BADGES, BOND_LEVELS, SHINY_CHARM_AT, bondLv, bondOf, board, dexIds, dexRecent,
  dust, echoIds, gymBadges, nextDexReward, pullCount, runSave, setProgress, setsReady,
  shinyIds, topBond,
} from '../meta';
import { dealCost, dealOff, dealPick, daySeed } from '../tasks';
import { moveOf, roleOf, superDesc } from '../stats';
import { TYPE_COLOR } from '../types';
import {
  ACCENT, GOLD, GOLD_HI, INK, INK_FAINT, INK_SOFT, font, fontB, scrim, uiClose,
  uiPanel, uiRow, uiWindow,
} from '../ui';
import { ballGlyph, fillStar, fitFontB, monShadow, pill, rim, roundRect } from '../screens';

const W = 540;

export const TEAM_BTN = { x: 18, y: 78, w: 504, h: 372 };
export const EDIT_TEAM_BTN = { x: 46, y: 462, w: 448, h: 68 };
export const DEX_BTN = { x: 18, y: 546, w: 246, h: 150 };
export const SETS_BTN = { x: 276, y: 546, w: 246, h: 150 };
export const PARTNERS_BTN = { x: 18, y: 708, w: 504, h: 136 };

const DEX_PANEL = { x: 30, y: 68, w: W - 60, h: 820 };
const DEX_COLS = 4;
const DEX_CELL_W = (DEX_PANEL.w - 32) / DEX_COLS;
const DEX_CELL_H = 104;
const DEX_HEAD = 66;
export const DEX_DETAIL_R = { x: 30, y: 84, w: 480, h: 780 };

const STAGE_R = { x: TEAM_BTN.x + 10, y: TEAM_BTN.y + 36, w: TEAM_BTN.w - 20, h: TEAM_BTN.h - 48 };

// OS reduced-motion seed (same probe as bg/evolve/fame): the stray holds
// its spot on the tree line instead of pacing.
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// the meadow's wild visitor: small pullables only — the day's pick seeds
// off UTC like the raid boss and rate-up, so it's the field's fauna, never
// a squad member or a hatcher teaser
const STRAYS = PULLABLE.filter((d) => tierOf(d) === 0);

// same strider as the climb court's scout: out, dwell, back, dwell
const patrol01 = (t: number, walk: number, rest: number) => {
  const P = 2 * (walk + rest);
  const u = t % P;
  if (u < walk) return { k: u / walk, dir: 1, walking: true };
  if (u < walk + rest) return { k: 1, dir: 0, walking: false };
  if (u < walk + rest + walk) return { k: 1 - (u - walk - rest) / walk, dir: -1, walking: true };
  return { k: 0, dir: 0, walking: false };
};

let stageCanvas: HTMLCanvasElement | null = null;
let detailPlatform: HTMLCanvasElement | null = null;
let drawnStage: { id: number; x: number; y: number; plate: { x: number; y: number; w: number; h: number } }[] = [];

function arenaCanvas() {
  if (stageCanvas || !gracidea()) return stageCanvas;
  const c = document.createElement('canvas');
  c.width = STAGE_R.w;
  c.height = STAGE_R.h;
  const g = c.getContext('2d')!;
  drawBackdrop(g, { x: 0, y: 0, w: c.width, h: c.height }, 12, 'meadow');
  const trees = [TREE_ROUND, TREE_PINE, TREE_TEAL, TREE_PINE, TREE_ROUND, TREE_TEAL, TREE_PINE, TREE_ROUND, TREE_TEAL];
  trees.forEach((tile, i) => drawTile(g, tile, i * 56 - 2, 1 + (i % 2) * 3, 40, 42));
  const accents = [[FLOWER_PINK, 12], [FLOWER_WILD, 58], [ROCK_SMALL, c.width - 48], [FLOWER_PINK, c.width - 83]] as const;
  accents.forEach(([tile, x], i) => drawTile(g, tile, x, c.height - 34 + (i % 2) * 5, 30, 24));
  stageCanvas = c;
  return stageCanvas;
}

function detailPlatformCanvas() {
  if (detailPlatform || !gracidea()) return detailPlatform;
  const c = document.createElement('canvas');
  c.width = 210;
  c.height = 48;
  const g = c.getContext('2d')!;
  drawBackdrop(g, { x: 0, y: 0, w: c.width, h: c.height }, 18, 'meadow');
  drawTile(g, FLOWER_WILD, 12, 16, 28, 20);
  drawTile(g, FLOWER_PINK, c.width - 42, 14, 28, 20);
  detailPlatform = c;
  return detailPlatform;
}

function shownCols(n: number) {
  return n === 1 ? [270] : n === 2 ? [189, 351] : [108, 270, 432];
}

export function teamStageAt(x: number, y: number): number | null {
  for (const cell of drawnStage) {
    const r = { x: cell.x - 74, y: cell.y - 40, w: 148, h: cell.plate.y + cell.plate.h - (cell.y - 40) };
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return cell.id;
  }
  return null;
}

export function partnersStripAt(x: number, y: number): number | null {
  const s = PARTNERS_BTN;
  if (x < s.x || x > s.x + s.w || y < s.y + 36 || y > s.y + s.h) return null;
  const partners = topBond(3);
  const ids = partners.length ? partners.map((p) => p.id) : dexRecent(3);
  if (!ids.length) return null;
  const i = Math.round((x - (s.x + s.w / 2)) / 150 + (ids.length - 1) / 2);
  return i >= 0 && i < ids.length ? ids[i] : null;
}

function drawTypeChip(ctx: CanvasRenderingContext2D, type: keyof typeof TYPE_COLOR, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = TYPE_COLOR[type];
  ctx.fill();
  fitFontB(ctx, type.toUpperCase(), 10, w - 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(type.toUpperCase(), x + w / 2, y + h / 2 + 5);
}

function nextDexGoal(dexN: number, badges: Set<number>) {
  const pullN = pullCount();
  const dexRw = nextDexReward();
  return dexN < SHINY_CHARM_AT
    ? `${SHINY_CHARM_AT - dexN} TO CHARM`
    : dexRw
      ? dexRw.at <= dexN
        ? `+${dexRw.pay}★ MILESTONE READY`
        : `${dexRw.at - dexN} TO +${dexRw.pay}★`
      : badges.size < BADGES.length
        ? `${BADGES.length - badges.size} BADGES LEFT`
        : `PITY IN ${PULL_PITY - (pullN % PULL_PITY)}`;
}

export function drawMonsBody(ctx: CanvasRenderingContext2D, t: number) {
  const run = runSave();
  const echo = run ? null : echoIds();
  const hof = !run && !echo ? (board()[0]?.team ?? []).map((id) => ({ id, lvl: 0 })) : null;
  const squad = (runSave()?.team ?? echoIds() ?? hof)?.filter((m) => speciesById(m.id));
  const frame = TEAM_BTN;
  uiPanel(ctx, frame, run ? 'YOUR CLIMB' : echo ? 'RIVAL ECHO' : hof?.length ? 'LAST SQUAD' : 'YOUR SQUAD', {
    h: 26,
    ...(run ? { sub: `STAGE ${run.pendingNext + 1}/${TOTAL_STAGES}` } : echo ? { sub: 'IT HUNTS YOU' } : {}),
  });
  const arena = arenaCanvas();
  ctx.save();
  roundRect(ctx, STAGE_R.x, STAGE_R.y, STAGE_R.w, STAGE_R.h, 12);
  ctx.clip();
  if (arena) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(arena, STAGE_R.x, STAGE_R.y);
  } else {
    // cold atlas — a flat meadow fill beats a bare slab (shop's fallback tone)
    ctx.fillStyle = '#7a9a5e';
    ctx.fillRect(STAGE_R.x, STAGE_R.y, STAGE_R.w, STAGE_R.h);
  }
  drawAmbient(ctx, STAGE_R, 'meadow', t, 0.6);
  // a wild stray paces the tree line — still inside the stage clip, and the
  // squad row is drawn after, so the party passes in front of it
  const stray = STRAYS.length ? STRAYS[Math.floor(hash(daySeed() * 2.71 + 4.7) * STRAYS.length)] : null;
  if (stray) {
    const pace = REDUCED ? { k: 0.5, dir: 0, walking: false } : patrol01(t + hash(daySeed() * 1.9) * 13, 7, 1.8);
    const mx = STAGE_R.x + 44 + pace.k * (STAGE_R.w - 88);
    const fy = STAGE_R.y + 74;
    ctx.fillStyle = 'rgba(8,24,8,0.28)';
    ctx.beginPath();
    ctx.ellipse(mx, fy, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (pace.dir < 0) {
      ctx.translate(mx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-mx, 0);
    }
    try {
      drawMon(ctx, stray.id, mx, fy - 15 - (pace.walking ? Math.abs(Math.sin(t * 8)) * 2 : 0), 34);
    } catch {
      void loadSprite(stray.id).catch(() => {});
    }
    ctx.restore();
  }
  ctx.restore();

  drawnStage = [];
  const mons = squad?.slice(0, 6) ?? [];
  if (!mons.length) {
    void loadItem('poke-ball');
    const emptyBall = itemSprite('poke-ball');
    [198, 270, 342].forEach((x) => {
      if (emptyBall) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(emptyBall, x - 15, 250, 30, 30);
        ctx.restore();
      } else ballGlyph(ctx, x, 265, 1.7, '#82966c');
    });
    ctx.font = fontB(13);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('NO TEAM YET', 270, 312);
  } else {
    const shinySet = new Set(shinyIds());
    for (let row = 0; row < Math.ceil(mons.length / 3); row++) {
      const rowMons = mons.slice(row * 3, row * 3 + 3);
      const xs = shownCols(rowMons.length);
      rowMons.forEach((m, col) => {
        const def = speciesById(m.id);
        const cx = xs[col];
        const cy = TEAM_BTN.y + (row ? 272 : 132);
        const bob = Math.sin(t * 2.2 + (row * 3 + col) * 1.7) * 2;
        const plate = { x: cx - 74, y: cy + 42, w: 148, h: 54 };
        drawnStage.push({ id: m.id, x: cx, y: cy, plate });
        monShadow(ctx, cx, cy + 4, 80);
        // a run team entry's own shiny flag wins — the dex's species-level
        // set would gold every member once any one of them is shiny
        const isShiny = 'shiny' in m ? !!m.shiny : shinySet.has(m.id);
        try {
          (isShiny ? drawShiny : drawMon)(ctx, m.id, cx, cy + bob, 80);
        } catch {
          void loadSprite(m.id).catch(() => {});
        }
        uiWindow(ctx, plate, { rad: 6, shadow: false });
        ctx.textAlign = 'center';
        ctx.font = fontB(13);
        ctx.fillStyle = INK;
        fitFontB(ctx, def?.name.toUpperCase() ?? `#${m.id}`, 13, plate.w - 12);
        ctx.fillText(def?.name.toUpperCase() ?? `#${m.id}`, cx, plate.y + 19);
        const types = def ? [def.type, ...(def.type2 ? [def.type2] : [])] : [];
        if (m.lvl) {
          ctx.textAlign = 'left';
          ctx.font = fontB(13);
          ctx.fillStyle = INK_SOFT;
          ctx.fillText(`Lv${m.lvl}`, plate.x + 8, plate.y + 44);
        }
        const typeW = 48, typeGap = 4;
        let tx = plate.x + plate.w - 6 - types.length * typeW - Math.max(0, types.length - 1) * typeGap;
        types.forEach((type) => {
          drawTypeChip(ctx, type, tx, plate.y + 29, typeW, 18);
          tx += typeW + typeGap;
        });
        if (isShiny) {
          ctx.fillStyle = GOLD;
          fillStar(ctx, cx + 34, cy - 28, 8);
        }
        const bond = bondLv(m.id);
        if (bond > 0) {
          void loadItem('friend-ball');
          const friend = itemSprite('friend-ball');
          if (friend) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(friend, cx - 48, cy - 42, 20, 20);
            ctx.restore();
          }
          ctx.font = fontB(11);
          ctx.textAlign = 'left';
          ctx.fillStyle = INK;
          ctx.fillText(`B${bond}`, cx - 25, cy - 27);
        }
      });
    }
  }

  const cta = EDIT_TEAM_BTN;
  const boxN = run?.box.length ?? 0;
  pill(ctx, cta, {
    c: GOLD_HI,
    cd: GOLD,
    tc: INK,
    label: run ? 'EDIT TEAM' : 'DRAFT A TEAM',
    sub: run ? `${run.team.length} IN PARTY · ${boxN} IN BOX` : 'STARTS A NEW CLIMB',
  });

  const dexN = dexIds().length;
  const badgeSet = gymBadges();
  const dex = DEX_BTN;
  uiPanel(ctx, dex, 'POKÉDEX', { h: 26 });
  void loadItem('poke-ball');
  const headBall = itemSprite('poke-ball');
  if (headBall) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(headBall, dex.x + 13, dex.y + 7, 18, 18);
    ctx.restore();
  } else ballGlyph(ctx, dex.x + 22, dex.y + 16, 1.1, '#e03c34');
  const shinyN = shinyIds().length;
  ctx.textAlign = 'left';
  ctx.font = font(16);
  ctx.fillStyle = INK;
  ctx.fillText(`${dexN}`, dex.x + 14, dex.y + 72);
  const digitsW = ctx.measureText(`${dexN}`).width;
  ctx.font = fontB(13);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`/${DEX_ALL.length}`, dex.x + 20 + digitsW, dex.y + 72);
  const bx = dex.x + 14, by = dex.y + 82, bw = dex.w - 28, bh = 12;
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.fillStyle = '#e8e8e0';
  ctx.fill();
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.clip();
  ctx.fillStyle = GOLD;
  ctx.fillRect(bx, by, dexN ? Math.max(5, bw * dexN / DEX_ALL.length) : 0, bh);
  ctx.restore();
  ctx.font = fontB(9);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.fillText(`${Math.round(dexN / DEX_ALL.length * 100)}%`, bx + bw - 5, by + 10);
  ctx.textAlign = 'left';
  ctx.font = fontB(12);
  ctx.fillStyle = INK;
  fitFontB(ctx, `★ ${shinyN} SHINY · ${badgeSet.size}/${BADGES.length} BADGES`, 12, dex.w - 22);
  ctx.fillText(`★ ${shinyN} SHINY · ${badgeSet.size}/${BADGES.length} BADGES`, dex.x + 11, dex.y + 119);
  ctx.font = fontB(12);
  ctx.fillStyle = INK_SOFT;
  fitFontB(ctx, nextDexGoal(dexN, badgeSet), 12, dex.w - 22);
  ctx.fillText(nextDexGoal(dexN, badgeSet), dex.x + 11, dex.y + 140);

  const sets = SETS_BTN;
  const ready = setsReady();
  const progress = setProgress();
  const done = progress.filter((p) => p.have === p.need).length;
  uiPanel(ctx, sets, 'LINE SETS', { h: 26, sub: `${done}/${EVO_LINES.length}` });
  if (ready.length) {
    ctx.font = fontB(9);
    const label = 'SET BONUS READY';
    const readyW = ctx.measureText(label).width + 12;
    roundRect(ctx, sets.x + sets.w - readyW - 10, sets.y + 35, readyW, 17, 7);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(label, sets.x + sets.w - readyW / 2 - 10, sets.y + 47);
    const pay = ready.reduce((n, root) => n + setPay(EVO_LINES.find((l) => l.root === root)!), 0);
    roundRect(ctx, sets.x + 12, sets.y + 58, sets.w - 24, 66, 8);
    ctx.fillStyle = GOLD_HI;
    ctx.fill();
    ctx.font = fontB(14);
    ctx.fillStyle = INK;
    ctx.fillText(`CLAIM +★${pay}`, sets.x + sets.w / 2, sets.y + 87);
    ctx.font = fontB(12);
    ctx.fillText(`${ready.length} LINE${ready.length === 1 ? '' : 'S'} DONE`, sets.x + sets.w / 2, sets.y + 110);
  } else {
    const next = progress.filter((p) => p.have > 0 && p.have < p.need).sort((a, b) => b.have / b.need - a.have / a.need)[0];
    if (next) {
      const line = EVO_LINES.find((l) => l.root === next.root)!;
      const ids = line.ids.slice(0, 3);
      const spacing = 52;
      const first = sets.x + sets.w / 2 - (ids.length - 1) * spacing / 2;
      ids.forEach((id, i) => {
        ctx.save();
        ctx.globalAlpha = dexIds().includes(id) ? 1 : 0.22;
        try {
          drawMon(ctx, id, first + i * spacing, sets.y + 87, 40);
        } catch {
          void loadSprite(id);
        }
        ctx.restore();
      });
      ctx.textAlign = 'center';
      ctx.font = fontB(12);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(`${next.have}/${next.need} · PAYS ★${setPay(line)}`, sets.x + sets.w / 2, sets.y + 131);
    } else {
      ctx.textAlign = 'center';
      ctx.font = fontB(12);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText('CATCH TO START A LINE', sets.x + sets.w / 2, sets.y + 94);
    }
  }

  const s = PARTNERS_BTN;
  const partners = topBond(3);
  const ids = partners.length ? partners.map((p) => p.id) : dexRecent(3);
  void loadItem('friend-ball');
  uiPanel(ctx, s, partners.length ? 'PARTNERS' : 'LATEST CATCHES', {
    h: 26, ...(partners.length ? { sub: 'BOND PAYS DUST' } : {}),
  });
  if (!ids.length) {
    void loadItem('poke-ball');
    const stripBall = itemSprite('poke-ball');
    [180, 270, 360].forEach((x) => {
      if (stripBall) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(stripBall, x - 12, s.y + 58, 24, 24);
        ctx.restore();
      } else ballGlyph(ctx, x, s.y + 70, 1.5, '#82966c');
    });
    ctx.font = fontB(12);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('CATCHES LAND HERE', s.x + s.w / 2, s.y + 112);
  } else {
    const shinies = new Set(shinyIds());
    ids.forEach((id, i) => {
      const cx = s.x + s.w / 2 + (i - (ids.length - 1) / 2) * 150;
      const cy = s.y + 64;
      const def = speciesById(id);
      if (def) {
        ctx.fillStyle = `${TYPE_COLOR[def.type]}2e`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 24, 36, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      monShadow(ctx, cx, cy + 4, 56);
      try {
        drawMon(ctx, id, cx, cy + Math.sin(t * 2.2 + i * 1.7) * 2, 56);
      } catch {
        void loadSprite(id).catch(() => {});
      }
      ctx.textAlign = 'center';
      ctx.font = fontB(12);
      ctx.fillStyle = INK;
      ctx.fillText(def?.name.toUpperCase() ?? `#${id}`, cx, s.y + 112);
      if (shinies.has(id)) {
        ctx.fillStyle = GOLD;
        fillStar(ctx, cx + 30, cy - 22, 7);
      }
      if (partners.length) {
        const friend = itemSprite('friend-ball');
        if (friend) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(friend, cx - 43, cy - 27, 18, 18);
          ctx.restore();
        }
        const lv = bondLv(id);
        for (let p = 0; p < BOND_LEVELS.length; p++) {
          ctx.fillStyle = p < lv ? GOLD : '#d8d8d0';
          ctx.beginPath();
          ctx.arc(cx - 24 + p * 12, s.y + 126, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }
}

export function dexScrollMax() {
  return Math.max(0, Math.ceil(DEX_ALL.length / DEX_COLS) * DEX_CELL_H - (DEX_PANEL.h - DEX_HEAD - 48));
}

export function drawDex(ctx: CanvasRenderingContext2D, scroll: number) {
  const r = DEX_PANEL;
  const dexList = dexIds();
  const seen = new Set(dexList);
  const shinies = new Set(shinyIds());
  const dexN = dexList.length;
  scrim(ctx);
  uiPanel(ctx, r, `POKÉDEX ${dexN}/${DEX_ALL.length}`, { rad: 14 });
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });
  const ready = setsReady().length;
  const done = setProgress().filter((p) => p.have === p.need).length;
  ctx.textAlign = 'center';
  ctx.font = fontB(12);
  ctx.fillStyle = ready ? GOLD : INK_FAINT;
  ctx.fillText(`${Math.round(dexN / DEX_ALL.length * 100)}% FOUND · ${done}/${EVO_LINES.length} LINES${ready ? ` · ${ready} SET BONUS READY` : ''}`, r.x + r.w / 2, r.y + 57);

  const viewH = r.h - DEX_HEAD - 48;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 8, r.y + DEX_HEAD, r.w - 16, viewH);
  ctx.clip();
  const lo = Math.max(0, Math.floor(scroll / DEX_CELL_H) * DEX_COLS - DEX_COLS);
  const hi = Math.min(DEX_ALL.length - 1, Math.ceil((scroll + viewH) / DEX_CELL_H) * DEX_COLS - 1);
  void loadItem('poke-ball');
  const pokeball = itemSprite('poke-ball');
  for (let i = lo; i <= hi; i++) {
    const def = DEX_ALL[i];
    const cx = r.x + 16 + (i % DEX_COLS) * DEX_CELL_W;
    const cy = r.y + DEX_HEAD + Math.floor(i / DEX_COLS) * DEX_CELL_H - scroll;
    const cell = { x: cx + 3, y: cy + 3, w: DEX_CELL_W - 6, h: DEX_CELL_H - 6 };
    const owned = seen.has(def.id);
    const tierColor = tierColorFor(def.id);
    uiWindow(ctx, cell, { rad: 8, shadow: false });
    if (owned && tierColor) rim(ctx, cell, 8, tierColor, 1.5);
    ctx.fillStyle = owned ? `${TYPE_COLOR[def.type]}26` : '#e4e4da';
    ctx.beginPath();
    ctx.ellipse(cell.x + cell.w / 2, cell.y + 56, 36, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (owned) {
      void loadSprite(def.id);
      try {
        drawMon(ctx, def.id, cell.x + cell.w / 2, cell.y + 30, 50);
      } catch {
        /* sprite still warming */
      }
      if (pokeball) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pokeball, cell.x + 5, cell.y + 5, 18, 18);
        ctx.restore();
      }
    } else {
      void loadSprite(def.id);
      try {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(whiteSprite(def.id), cell.x + cell.w / 2 - 23, cell.y + 7, 46, 46);
        ctx.restore();
      } catch {
        ctx.textAlign = 'center';
        ctx.font = font(14);
        ctx.fillStyle = INK_FAINT;
        ctx.fillText('?', cell.x + cell.w / 2, cell.y + 52);
      }
    }
    ctx.textAlign = 'center';
    ctx.font = fontB(12);
    ctx.fillStyle = owned ? INK : INK_FAINT;
    fitFontB(ctx, owned ? def.name.toUpperCase() : '???', 12, cell.w - 10);
    ctx.fillText(owned ? def.name.toUpperCase() : '???', cell.x + cell.w / 2, cell.y + 76);
    ctx.font = fontB(11);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`#${def.id}`, cell.x + cell.w / 2, cell.y + 92);
    if (owned && shinies.has(def.id)) {
      ctx.font = font(12);
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'right';
      ctx.fillText('★', cell.x + cell.w - 5, cell.y + 18);
    }
  }
  ctx.restore();
  const total = Math.ceil(DEX_ALL.length / DEX_COLS) * DEX_CELL_H;
  if (total > viewH) {
    const rail = { x: r.x + r.w - 11, y: r.y + DEX_HEAD + 4, w: 4, h: viewH - 8 };
    roundRect(ctx, rail.x, rail.y, rail.w, rail.h, 2);
    ctx.fillStyle = 'rgba(12,16,32,0.4)';
    ctx.fill();
    const th = Math.max(24, (viewH / total) * rail.h);
    roundRect(ctx, rail.x, rail.y + (scroll / dexScrollMax()) * (rail.h - th), rail.w, th, 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
  ctx.font = fontB(11);
  ctx.textAlign = 'center';
  if (dexN >= SHINY_CHARM_AT) {
    ctx.fillStyle = GOLD;
    ctx.fillText('★ SHINY CHARM ON · x2 SHINIES', r.x + r.w / 2, r.y + r.h - 32);
  } else {
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`${SHINY_CHARM_AT - dexN} TO SHINY CHARM · x2 SHINIES`, r.x + r.w / 2, r.y + r.h - 32);
  }
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('TAP A MON FOR ITS CARD · OUTSIDE CLOSES', r.x + r.w / 2, r.y + r.h - 18);
}

function tierColorFor(id: number) {
  const def = speciesById(id);
  if (!def) return null;
  const tier = tierOf(def);
  return tier >= 3 || INVADER_IDS.has(id) ? '#f0b02f' : tier === 2 ? '#5a9bf0' : null;
}

export function dexRowAt(x: number, y: number, scroll: number): number | null {
  const r = DEX_PANEL;
  if (x < r.x + 16 || x > r.x + r.w - 16 || y < r.y + DEX_HEAD || y > r.y + r.h - 48) return null;
  const seen = new Set(dexIds());
  const col = Math.floor((x - r.x - 16) / DEX_CELL_W);
  const row = Math.floor((y - r.y - DEX_HEAD + scroll) / DEX_CELL_H);
  const def = col >= 0 && col < DEX_COLS ? DEX_ALL[row * DEX_COLS + col] : undefined;
  return def && seen.has(def.id) ? def.id : null;
}

export function dexBuyRect(id: number) {
  const def = speciesById(id);
  if (!def || dexIds().includes(id) || !PULLABLE.some((d) => d.id === id)) return null;
  return { x: W / 2 - 110, y: DEX_DETAIL_R.y + DEX_DETAIL_R.h - 56, w: 220, h: 32 };
}

// the detail card's fold: bond, traits and the stat block sit behind one
// STATS row — session state only, keyed to the open card's id
export const DEX_STATS = { x: DEX_DETAIL_R.x + 24, y: DEX_DETAIL_R.y + 344, w: DEX_DETAIL_R.w - 48, h: 30 };
let statsFor = -1;
export function dexStatsFlip(id: number) {
  statsFor = statsFor === id ? -1 : id;
}

export function drawDexDetail(ctx: CanvasRenderingContext2D, id: number, t = 0, armed = false) {
  void t;
  const def = speciesById(id);
  if (!def) return;
  const r = DEX_DETAIL_R;
  scrim(ctx, 0.55);
  uiPanel(ctx, r, def.name.toUpperCase(), { rad: 14, sub: `#${id}` });
  uiClose(ctx, { x: r.x + r.w - 48, y: r.y + 12, w: 40, h: 40 });
  const cx = r.x + r.w / 2;
  const shiny = shinyIds().includes(id);
  const cy = r.y + 126;
  const platform = detailPlatformCanvas();
  if (platform) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(platform, cx - platform.width / 2, cy + 30);
    ctx.restore();
  }
  monShadow(ctx, cx, cy + 12, 120);
  try {
    (shiny ? drawShiny : drawMon)(ctx, id, cx, cy, 160);
  } catch {
    void loadSprite(id);
  }
  if (shiny) {
    ctx.fillStyle = GOLD;
    fillStar(ctx, cx + 64, cy - 62, 10);
  }

  const types = [def.type, ...(def.type2 ? [def.type2] : [])];
  const typeGap = 8;
  const typeX = cx - (types.length * 100 + (types.length - 1) * typeGap) / 2;
  types.forEach((type, i) => {
    roundRect(ctx, typeX + i * (100 + typeGap), r.y + 212, 100, 26, 8);
    ctx.fillStyle = TYPE_COLOR[type];
    ctx.fill();
    ctx.font = fontB(12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(type.toUpperCase(), typeX + i * (100 + typeGap) + 50, r.y + 230);
  });

  ctx.textAlign = 'center';
  ctx.font = fontB(13);
  ctx.fillStyle = INK;
  ctx.fillText(`ABILITY · ${abilityLabel(def)}`, cx, r.y + 260);
  const hint = abilityOf(def)?.hint;
  if (hint) {
    ctx.font = fontB(11);
    ctx.fillStyle = INK_SOFT;
    fitFontB(ctx, hint, 11, r.w - 48);
    ctx.fillText(hint, cx, r.y + 280);
  }
  ctx.textAlign = 'center';
  ctx.font = fontB(12);
  ctx.fillStyle = INK;
  ctx.fillText(`${roleOf(def)} · ${moveOf(id, def.type).toUpperCase()}`, cx, r.y + 310);
  const desc = superDesc(id, def.type).toUpperCase();
  ctx.fillStyle = INK_FAINT;
  fitFontB(ctx, desc, 12, r.w - 48);
  ctx.fillText(desc, cx, r.y + 330);

  // the fold: one STATS row owns bond, trait flags and the stat block —
  // the default card stops at the super, the depth stays a tap away
  const open = statsFor === id;
  uiRow(ctx, DEX_STATS, 'STATS · BOND · TRAITS', { on: open, right: open ? '▲' : '▼' });

  if (open) {
    void loadItem('friend-ball');
    const pts = bondOf(id), lv = bondLv(id);
    const friend = itemSprite('friend-ball');
    if (friend) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(friend, r.x + 24, r.y + 388, 20, 20);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.font = fontB(12);
    ctx.fillStyle = INK_SOFT;
    const next = BOND_LEVELS[lv];
    const luck = Math.floor(lv / 2) ? ` · +${Math.floor(lv / 2)} LUCK` : '';
    ctx.fillText(pts ? `BOND LV${lv} · ${next ? `${pts}/${next}` : 'MAX'} PTS${luck}` : 'FIELD IT TO BOND', r.x + 52, r.y + 404);
    for (let p = 0; p < BOND_LEVELS.length; p++) {
      ctx.fillStyle = p < lv ? GOLD : '#d8d8d0';
      ctx.beginPath();
      ctx.arc(r.x + r.w - 28 - (BOND_LEVELS.length - 1 - p) * 16, r.y + 400, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    const traits = [
      def.healer && 'BUMP HEALS THE TEAM', def.pierce && 'PIERCES FOES', def.melee && 'LUNGES AT CONTACT',
      def.copy && "COPIES BUMPERS' SUPERS", def.cursed && 'GRUDGE · ITS FAINT SLOWS FOES',
      def.huge && 'HUGE POWER · 2× CONTACT', def.sturdy && 'STURDY · SURVIVES ONE HIT',
      def.guts && 'GUTS · STATUS FEEDS IT', def.pheal && 'POISON HEALS IT', def.sleepless && 'NEVER SLEEPS',
      def.pickup && 'PICKUP · FINDS LOOT', def.thickFat && 'THICK FAT · HALF LAVA',
      def.limber && 'LIMBER · NO PARALYSIS', def.shock && 'STATIC · HITS JOLT BACK',
      def.toxic && 'POISON POINT · HITS VENOM BACK', def.flame && 'FLAME BODY · HITS SINGE BACK',
      def.charm && 'CUTE CHARM · HITS LULL BACK', def.spore && 'EFFECT SPORE · HITS SCATTER',
      def.menace && 'INTIMIDATE · DULLS FOES', def.grace && 'SERENE GRACE · 2× ODDS',
      def.damp && 'DAMP · FIZZLES BOMBS', def.sync && 'SYNCHRONIZE · ECHOES ILLS',
      def.swift && 'SWIFT · 1.5× IN ITS SKY', def.taunt && 'FOLLOW ME · DRAWS FIRE',
      def.tempo && 'OWN TEMPO · CLEAR-HEADED', def.breaker && 'MOLD BREAKER · PIERCES GUARDS',
      def.shed && 'SHED SKIN · SLAYS OFF ILLS', def.regen && 'REGENERATOR · MENDS EACH TURN',
      def.friendGuard && 'FRIEND GUARD · SHIELDS TEAM', def.absorb && `${def.absorb.toUpperCase()} HITS HEAL IT`,
    ].filter(Boolean) as string[];
    if (traits.length) {
      ctx.fillStyle = ACCENT;
      fitFontB(ctx, traits.join(' · '), 11, r.w - 48);
      ctx.fillText(traits.join(' · '), cx, r.y + 430);
    }

    const stats: [string, number][] = [
      ['HP', def.stats.hp], ['ATK', def.stats.atk], ['DEF', def.stats.def],
      ['SPA', def.stats.spa], ['SPD', def.stats.spd], ['SPE', def.stats.spe],
    ];
    stats.forEach(([name, value], i) => {
      const y = r.y + 448 + i * 19;
      ctx.textAlign = 'left';
      ctx.font = fontB(12);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(name, r.x + 24, y + 13);
      ctx.fillStyle = '#e8e8e0';
      ctx.fillRect(r.x + 72, y + 1, r.w - 144, 12);
      ctx.fillStyle = TYPE_COLOR[def.type];
      ctx.fillRect(r.x + 72, y + 1, Math.max(3, (r.w - 144) * Math.min(1, value / 200)), 12);
      ctx.textAlign = 'right';
      ctx.fillStyle = INK;
      ctx.fillText(`${value}`, r.x + r.w - 24, y + 13);
    });
    ctx.textAlign = 'right';
    ctx.font = fontB(12);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`BASE TOTAL ${stats.reduce((sum, stat) => sum + stat[1], 0)}`, r.x + r.w - 24, r.y + 568);
  }

  const buy = dexBuyRect(id);
  const line = EVO_LINES.find((l) => l.ids.includes(id));
  const labelY = r.y + (open ? (buy ? 594 : 628) : (buy ? 470 : 500));
  ctx.textAlign = 'left';
  ctx.font = fontB(12);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(line ? 'EVOLUTION LINE' : 'NO EVOLUTION LINE', r.x + 24, labelY);
  if (line) {
    const owned = new Set(dexIds());
    const ids = line.ids.slice(0, 7);
    const gap = 58;
    const first = cx - (ids.length - 1) * gap / 2;
    ids.forEach((eid, i) => {
      const ix = first + i * gap;
      ctx.save();
      ctx.globalAlpha = owned.has(eid) ? 1 : 0.22;
      try {
        drawMon(ctx, eid, ix, labelY + 36, 48);
      } catch {
        void loadSprite(eid);
      }
      ctx.restore();
      if (eid === id) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(ix, labelY + 64, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  ctx.textAlign = 'center';
  if (buy) {
    const cost = dealCost(def);
    const label = armed ? `TAP AGAIN · ◆${cost}` : `${def.id === dealPick().id ? `DEAL −${dealOff()}% · ` : ''}BUY · ◆${cost}`;
    pill(ctx, buy, {
      c: GOLD_HI, cd: GOLD, tc: INK, label, pressed: armed, disabled: dust() < cost,
    });
  }
  ctx.font = fontB(11);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('OUTSIDE CLOSES', cx, r.y + r.h - 12);
}
