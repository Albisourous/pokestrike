import { drawMon, drawShiny, gracidea, itemSprite, loadItem, loadSprite } from '../../core/assets';
import { speciesById, DUST_BY_TIER, type SpeciesDef } from '../data';
import { drawAmbient, drawBackdrop, drawSlice, drawWall, THEMES, type Theme } from '../bg';
import { ROCK_SMALL, TREE_ASH, TREE_PINE, TREE_ROUND, type TileRect } from '../maptiles';
import { dexIds, raidDoneToday, starBoost } from '../meta';
import { daySeed, raidPick, raidTeam, raidMod, raidLvl, raidEscortN } from '../tasks';
import { moveOf, roleOf, superDesc } from '../stats';
import { TYPES, TYPE_COLOR, typeMult, strikeType, type Typed } from '../types';
import { INK, INK_SOFT, PAPER, PARCH, GOLD_HI, font, fontB, ufit as fitFont, uiWindow, uiRow, type Rect } from '../ui';

export const raidWeaknesses = (boss: Typed) => TYPES
  .map(type => ({ type, mult: typeMult(type, boss) }))
  .filter(hit => hit.mult > 1)
  .sort((a, b) => b.mult - a.mult);

export function raidCounters(boss: Typed, ids: readonly number[]) {
  return [...new Set(ids)]
    .map(speciesById)
    .filter((mon): mon is SpeciesDef => !!mon)
    .map(mon => ({ mon, mult: typeMult(strikeType(mon, boss), boss) }))
    .filter(hit => hit.mult > 1)
    .sort((a, b) => b.mult - a.mult || a.mon.id - b.mon.id)
    .slice(0, 3);
}

export function raidRefresh(now: number) {
  const minutes = Math.ceil((86400000 - ((now % 86400000) + 86400000) % 86400000) / 60000);
  return `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`;
}

const PANEL = { x: 30, y: 108, w: 480, h: 604 };
const COURT = { x: 42, y: 156, w: 456, h: 200 };
const courts = new Map<Theme, HTMLCanvasElement>();
const requested = new Set<string>();

function mon(ctx: CanvasRenderingContext2D, def: SpeciesDef, x: number, y: number, size: number, shiny = false) {
  try {
    if (shiny) drawShiny(ctx, def.id, x, y, size);
    else drawMon(ctx, def.id, x, y, size);
  } catch {
    const key = `mon:${def.id}`;
    if (!requested.has(key)) {
      requested.add(key);
      void loadSprite(def.id).catch(() => {});
    }
  }
}

function item(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number) {
  const img = itemSprite(name);
  if (img) ctx.drawImage(img, x, y, size, size);
  else if (!requested.has(name)) {
    requested.add(name);
    void loadItem(name);
  }
}

function court(ctx: CanvasRenderingContext2D, theme: Theme) {
  let layer = courts.get(theme);
  if (!layer && gracidea()) {
    layer = document.createElement('canvas');
    layer.width = COURT.w;
    layer.height = COURT.h;
    const g = layer.getContext('2d')!;
    // Crop the full court rather than flattening its square terrain tiles.
    drawBackdrop(g, { x: -28, y: -300, w: 512, h: 910 }, 0, theme);
    drawWall(g, { x: 8, y: 8, w: COURT.w - 16, h: COURT.h - 16 }, theme);
    const prop: TileRect = theme === 'grove' || theme === 'meadow' ? TREE_ROUND
      : theme === 'sky' ? TREE_PINE : theme === 'volcano' ? TREE_ASH : ROCK_SMALL;
    for (const [x, y] of [[26, 28], [382, 28], [26, 126], [382, 126]]) {
      g.fillStyle = '#10182055';
      g.beginPath();
      g.ellipse(x + 24, y + 40, 24, 7, 0, 0, Math.PI * 2);
      g.fill();
      drawSlice(g, prop, x, y, 48, 48);
    }
    g.fillStyle = '#10182066';
    g.beginPath();
    g.ellipse(COURT.w / 2, 166, 76, 14, 0, 0, Math.PI * 2);
    g.fill();
    courts.set(theme, layer);
  }
  if (layer) ctx.drawImage(layer, COURT.x, COURT.y);
  else drawBackdrop(ctx, COURT, 8, theme);
}

export function drawRaidLobby(ctx: CanvasRenderingContext2D, t: number, fight: Rect) {
  const now = Date.now();
  const boss = raidPick(now), done = raidDoneToday(now), mod = raidMod(now);
  const owned = dexIds();
  const theme = THEMES[daySeed(now) % THEMES.length];
  const weaknesses = raidWeaknesses(boss);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.imageSmoothingEnabled = false;
  uiWindow(ctx, PANEL);
  ctx.fillStyle = INK;
  ctx.font = font(13);
  ctx.fillText('CHROMA RAID', 48, 138);
  ctx.font = fontB(13);
  ctx.textAlign = 'right';
  ctx.fillText(done ? 'CLEARED TODAY' : 'READY · FREE', 492, 138);

  court(ctx, theme);
  drawAmbient(ctx, COURT, theme, t, 0.35);
  mon(ctx, boss, 270, 252 + Math.sin(t * 2) * 2, 208, true);
  uiWindow(ctx, { x: 54, y: 168, w: 142, h: 32 }, { tint: INK, shadow: false });
  item(ctx, 'shiny-charm', 60, 170, 28);
  ctx.textAlign = 'left';
  ctx.font = fontB(13);
  ctx.fillStyle = PARCH;
  ctx.fillText('SHINY BOSS', 92, 190);

  ctx.fillStyle = INK;
  fitFont(ctx, boss.name.toUpperCase(), 16, 328);
  ctx.fillText(boss.name.toUpperCase(), 48, 384);
  ctx.textAlign = 'right';
  ctx.font = fontB(15);
  ctx.fillText(`LV ${raidLvl(now)}`, 492, 384);
  ctx.textAlign = 'left';
  let tx = 48;
  for (const type of boss.type2 ? [boss.type, boss.type2] : [boss.type]) {
    const text = type.toUpperCase();
    ctx.font = fontB(13);
    const w = ctx.measureText(text).width + 24;
    uiWindow(ctx, { x: tx, y: 396, w, h: 28 }, { tint: TYPE_COLOR[type], shadow: false, rad: 6 });
    ctx.fillStyle = INK;
    ctx.fillText(text, tx + 12, 416);
    tx += w + 8;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontB(13);
  ctx.fillText(roleOf(boss), 492, 416);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  const weakText = weaknesses.length
    ? `WEAK TO · ${weaknesses.slice(0, 3).map(hit => `${hit.type.toUpperCase()} ×${hit.mult}`).join(' · ')}`
    : 'NO TYPE WEAKNESS · USE YOUR STRONGEST HITS';
  ctx.font = fontB(13);
  ctx.fillText(weakText, 48, 448, 444);

  uiRow(ctx, { x: 44, y: 458, w: 452, h: 28 }, `${mod.name} · ${raidEscortN(now) + 1} FOES`, { on: true, px: 11 });
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontB(13);
  ctx.fillText(mod.desc, 48, 508, 444);
  ctx.fillText(`${moveOf(boss.id, boss.type)} · ${superDesc(boss.id, boss.type)}`, 48, 532, 444);

  ctx.fillStyle = INK;
  ctx.fillText('YOUR LV30 LOANERS · FIXED TEAM', 48, 560);
  const team = raidTeam(now);
  // counters wear their strike type + mult over the card — the WEAK TO
  // line's promise made visible on the loaners that cash it
  const counterOf = new Map(raidCounters(boss, team.map((d) => d.id)).map((h) => [h.mon.id, h]));
  team.forEach((def, i) => {
    const x = 48 + i * 148;
    uiWindow(ctx, { x, y: 568, w: 140, h: 48 }, { shadow: false });
    mon(ctx, def, x + 24, 592, 44);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.font = fontB(13);
    ctx.fillText(def.name, x + 48, 598, 88);
    const hit = counterOf.get(def.id);
    if (hit) {
      const strike = strikeType(def, boss);
      ctx.textAlign = 'right';
      ctx.font = fontB(11);
      ctx.fillStyle = TYPE_COLOR[strike];
      ctx.fillText(`${strike.toUpperCase()} ×${hit.mult}`, x + 134, 584);
    }
  });

  item(ctx, 'star-piece', 48, 676, 28);
  ctx.fillStyle = INK;
  ctx.font = fontB(14);
  ctx.fillText(`${Math.ceil(40 * starBoost())} STAR PIECES`, 80, 698);
  item(ctx, 'shiny-charm', 252, 676, 28);
  ctx.fillText('SHINY BOSS', 284, 698);
  if (owned.includes(boss.id)) {
    ctx.font = fontB(13);
    ctx.textAlign = 'right';
    ctx.fillText(`+${DUST_BY_TIER[3]} DUST`, 492, 698);
  }

  uiWindow(ctx, fight, { tint: done ? PAPER : GOLD_HI });
  ctx.textAlign = 'center';
  ctx.fillStyle = done ? INK_SOFT : INK;
  fitFont(ctx, done ? 'CLEARED TODAY' : 'FIGHT', 18, fight.w - 40);
  ctx.fillText(done ? 'CLEARED TODAY' : 'FIGHT', 270, fight.y + 30);
  ctx.font = fontB(13);
  ctx.fillText(done ? `NEXT · ${raidPick(now + 86400000).name.toUpperCase()}` : 'FREE RETRIES · SHINY BOSS ON WIN', 270, fight.y + 52);
  ctx.fillStyle = PAPER;
  ctx.font = fontB(14);
  ctx.fillText(`NEW BOSS IN ${raidRefresh(now)} · 00:00 UTC`, 270, fight.y + fight.h + 32);
  ctx.restore();
}
