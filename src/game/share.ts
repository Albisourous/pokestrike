// Shareable run card: an offscreen 540×960 PNG of the climb, drawn on the
// last arena's court, with the ?seed= replay link printed on it.
import { drawMon, drawShiny, itemSprite, loadGracidea, loadItem, loadSprite } from '../core/assets';
import { drawBackdrop, type Theme } from './bg';
import { RANK_BALL, type ClearRank } from './meta';
import { TOTAL_STAGES, type SpeciesDef } from './data';
import { TYPE_COLOR } from './types';
import { INK, PARCH, GOLD, GOLD_HI, INK_FAINT, PAPER_HI, font, fontB, rr, uiWindow } from './ui';
import { TYPE_RAMP, starPath } from './vfx';
import type { Battle } from './battle';
import type { RunResult, ShareGrid } from './screens';

export const CARD_W = 540;
export const CARD_H = 960;
const GYM_STAGES = [3, 6, 9]; // a gym every 3rd stop

export interface RunCard {
  won: boolean;
  depth: number;
  score: number;
  team: SpeciesDef[];
  mvpIdx: number;
  ranks: (ClearRank | undefined)[]; // by stage index, 0-based
  bestCombo: number;
  loot: number;
  asc: number;
  seed: number;
  build: string;
  theme: Theme;
  base: string; // origin + path the ?seed= rides on
}

export const shareLink = (base: string, seed: number) => `${base}?seed=${seed}`;

export function runCard(res: RunResult, b: Battle, build: string, base: string): RunCard {
  return {
    won: res.won,
    depth: res.depth ?? 0,
    score: res.score,
    team: res.team,
    mvpIdx: res.mvpIdx,
    ranks: b.runRanks,
    bestCombo: res.bestCombo ?? 0,
    loot: res.loot ?? 0,
    asc: b.asc,
    seed: res.seed,
    build,
    theme: b['theme'],
    base,
  };
}

function shadowText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string) {
  ctx.fillStyle = INK;
  ctx.fillText(s, x + 2, y + 3);
  ctx.fillStyle = c;
  ctx.fillText(s, x, y);
}

function item(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, sz: number) {
  const img = itemSprite(name);
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
}

// hex + alpha → rgba() — TYPE_COLOR arrives as #rrggbb
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// a stable 0..1 hash — the card bakes once, so glint placement must not roll
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// a baked four-point glint — same silhouette the live scenes twinkle with
function glint(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, a = 0.9) {
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  starPath(ctx, x, y, s, 0.28);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawRunCard(ctx: CanvasRenderingContext2D, c: RunCard) {
  const W = CARD_W, H = CARD_H;
  ctx.save();
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, 0, W, H);
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, c.theme);
  // dark top and foot so the print reads over any court
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,16,36,0.88)');
  g.addColorStop(0.26, 'rgba(12,16,36,0.25)');
  g.addColorStop(0.55, 'rgba(12,16,36,0.2)');
  g.addColorStop(1, 'rgba(12,16,36,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the lead's typing keys the card: halo under the squad, edge frame last
  const lead = c.team[0];
  const c1 = TYPE_COLOR[lead?.type ?? 'normal'];
  const c2 = TYPE_COLOR[lead?.type2 ?? lead?.type ?? 'normal'];
  const halo = ctx.createRadialGradient(W / 2, 430, 40, W / 2, 430, 300);
  halo.addColorStop(0, rgba(c1, 0.3));
  halo.addColorStop(1, rgba(c1, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 110, W, 640);

  ctx.textAlign = 'center';
  ctx.font = font(30);
  shadowText(ctx, 'POKÉSTRIKE', W / 2, 78, PARCH);
  const verdict = c.won ? 'CLIMB COMPLETE' : `WIPED AT STAGE ${c.depth}/${TOTAL_STAGES}`;
  ctx.font = font(13);
  const vw = ctx.measureText(verdict).width + 36;
  uiWindow(ctx, { x: W / 2 - vw / 2, y: 100, w: vw, h: 34 }, { dark: true, rad: 17, shadow: false });
  ctx.fillStyle = c.won ? '#6fdc6f' : '#ff8a8a';
  ctx.fillText(verdict, W / 2, 123);
  ctx.font = font(34);
  shadowText(ctx, c.score.toLocaleString('en-US'), W / 2, 194, GOLD_HI);
  ctx.font = fontB(13);
  ctx.fillStyle = PARCH;
  ctx.fillText(`POINTS${c.asc ? ` · ASCENSION ${c.asc}` : ''}`, W / 2, 218);

  // the squad on the court: big fronts on grounded shadows, the MVP crowned
  const n = Math.max(1, c.team.length);
  const sz = Math.min(150, 470 / n);
  const floorY = 420;
  c.team.forEach((def, i) => {
    const x = W / 2 + (i - (n - 1) / 2) * Math.min(150, 500 / n);
    const y = floorY + (i % 2 ? 20 : 0);
    ctx.fillStyle = 'rgba(8,12,8,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + sz * 0.36, sz * 0.38, sz * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    try {
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, x, y, sz * (i === c.mvpIdx ? 1.08 : 1));
    } catch {
      /* sprite still warming */
    }
    // baked twinkles off each mon — the ramp's hot end, gold for shinies,
    // placed by hash so the same run always prints the same card
    const ramp = TYPE_RAMP[def.type];
    for (let k = 0; k < 3; k++) {
      const gx = x + (hash(def.id * 7 + i * 31 + k * 13) - 0.5) * sz * 1.2;
      const gy = y - sz * 0.4 + hash(def.id * 17 + i * 41 + k * 23) * sz * 0.7;
      const c = k === 2 ? '#ffffff' : def.shiny && k === 0 ? GOLD_HI : ramp[2 + (k % 2)];
      glint(ctx, gx, gy, 3.5 + hash(def.id + i * 53 + k * 7) * 4.5, c, 0.45 + hash(def.id * 3 + k) * 0.45);
    }
    ctx.font = fontB(12);
    const name = def.name.toUpperCase();
    const nw = ctx.measureText(name).width + 16;
    uiWindow(ctx, { x: x - nw / 2, y: y + sz * 0.42, w: nw, h: 20 }, { dark: true, rad: 6, shadow: false });
    ctx.fillStyle = TYPE_COLOR[def.type]; // the plate's typing rides its foot
    ctx.fillRect(x - nw / 2 + 3, y + sz * 0.42 + 18, nw - 6, 3);
    ctx.fillStyle = def.shiny || i === c.mvpIdx ? GOLD_HI : PARCH;
    ctx.fillText(name, x, y + sz * 0.42 + 14);
    if (i === c.mvpIdx) item(ctx, 'star-piece', x, y - sz * 0.52, 32); // the crown is a real drop
  });

  // gym ranks: the ball each leader was beaten with, blank if never reached
  const gy = 560;
  uiWindow(ctx, { x: 40, y: gy, w: W - 80, h: 128 }, { dark: true, rad: 10 });
  ctx.font = fontB(12);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText('GYM RANKS', W / 2, gy + 24);
  GYM_STAGES.forEach((st, i) => {
    const x = W / 2 + (i - 1) * 140;
    const r = c.ranks[st - 1];
    if (r) {
      // an earned ball sits in a gold ring — S-rank rings burn brighter
      ctx.strokeStyle = r === 'S' ? GOLD_HI : GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, gy + 62, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    if (!r) ctx.globalAlpha = 0.25;
    item(ctx, r ? RANK_BALL[r] : 'poke-ball', x, gy + 62, 48);
    ctx.restore();
    if (r) {
      // the card is a still PNG — the ball's shine is painted in
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(x - 9, gy + 49, 13, 5, -0.55, 0, Math.PI * 2);
      ctx.fill();
      glint(ctx, x + 16, gy + 42, r === 'S' ? 7 : 5, r === 'S' ? GOLD_HI : 'rgba(255,255,255,0.85)'); // an earned ball catches the light
    }
    ctx.font = font(16);
    ctx.fillStyle = r ? (r === 'S' ? GOLD_HI : PARCH) : INK_FAINT;
    ctx.fillText(r ?? '·', x, gy + 106);
    ctx.font = fontB(10);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(`GYM ${i + 1}`, x + 34, gy + 106);
  });

  // three stat plates
  const stats: [string, string, string | null][] = [
    ['BEST COMBO', `×${c.bestCombo}`, null],
    ['TREASURE', `${c.loot}`, 'amulet-coin'],
    ['ASCENSION', `${c.asc}`, 'star-piece'],
  ];
  const sw = (W - 80 - 24) / 3;
  stats.forEach(([label, val, icon], i) => {
    const x = 40 + i * (sw + 12);
    const y = 708;
    uiWindow(ctx, { x, y, w: sw, h: 84 }, { rad: 10 });
    ctx.font = fontB(11);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(label, x + sw / 2, y + 22);
    ctx.font = font(18);
    ctx.fillStyle = INK;
    const vw2 = ctx.measureText(val).width;
    const ix = icon ? 14 : 0;
    ctx.fillText(val, x + sw / 2 + ix, y + 62);
    if (icon) item(ctx, icon, x + sw / 2 - vw2 / 2 - 6, y + 55, 28);
  });

  // the receipt: the replay link and the build that ran it — the link sits
  // in its own inset strip so it reads as a field, not loose print
  const link = shareLink(c.base, c.seed);
  uiWindow(ctx, { x: 24, y: 816, w: W - 48, h: 104 }, { dark: true, rad: 10 });
  ctx.font = fontB(11);
  ctx.fillStyle = GOLD;
  ctx.fillText('REPLAY THIS CLIMB', W / 2, 838);
  const strip = { x: 44, y: 848, w: W - 88, h: 32 };
  rr(ctx, strip.x, strip.y, strip.w, strip.h, 8);
  ctx.fillStyle = '#0a0e20';
  ctx.fill();
  ctx.strokeStyle = rgba(c1, 0.7);
  ctx.lineWidth = 2;
  rr(ctx, strip.x + 1, strip.y + 1, strip.w - 2, strip.h - 2, 7);
  ctx.stroke();
  let px = 20;
  ctx.font = fontB(px);
  while (px > 9 && ctx.measureText(link).width > strip.w - 24) ctx.font = fontB(--px);
  ctx.fillStyle = PAPER_HI;
  ctx.fillText(link, W / 2, strip.y + strip.h / 2 + 5);
  ctx.font = fontB(11);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`SEED ${c.seed} · ${c.build}`, W / 2, 900);

  // the type-keyed frame edges the whole card — dual types split the rail
  const fg = ctx.createLinearGradient(0, 0, 0, H);
  fg.addColorStop(0, c1);
  fg.addColorStop(1, c2);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.strokeStyle = 'rgba(240,230,200,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.restore();
}

export async function renderRunCard(c: RunCard): Promise<HTMLCanvasElement> {
  await Promise.all([
    loadGracidea(),
    ...c.team.map((d) => loadSprite(d.id).catch(() => null)),
    ...['poke-ball', 'amulet-coin', 'star-piece', ...c.ranks.flatMap((r) => (r ? [RANK_BALL[r]] : []))].map(loadItem),
  ]);
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  drawRunCard(cv.getContext('2d')!, c);
  return cv;
}

// navigator.clipboard rejects on iOS Safari even in a gesture — the
// textarea + execCommand trick still works there, so it's the fallback
async function copy(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.readOnly = true;
    ta.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS needs the explicit range
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// share sheet with the PNG when the platform takes files; otherwise the PNG
// downloads and the replay link goes to the clipboard
export async function shareRun(c: RunCard, text: string, flags: ShareGrid | null) {
  if (flags) flags.failed = false;
  const blob = await new Promise<Blob | null>((res) => void renderRunCard(c).then((cv) => cv.toBlob(res, 'image/png'), () => res(null)));
  const name = `pokestrike-${c.seed}.png`;
  if (blob) {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // the player closed the sheet
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const ok = await copy(shareLink(c.base, c.seed));
  if (!flags) return;
  if (ok) {
    flags.copied = true;
    setTimeout(() => (flags.copied = false), 1500);
  } else flags.failed = true;
}
