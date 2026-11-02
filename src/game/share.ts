// Shareable run card: an offscreen 540×960 PNG of the climb, drawn on the
// last arena's court, with the ?seed= replay link printed on it.
import { drawMon, drawShiny, itemSprite, loadGracidea, loadItem, loadSprite } from '../core/assets';
import { drawBackdrop, type Theme } from './bg';
import { RANK_BALL, type ClearRank } from './meta';
import { TOTAL_STAGES, type SpeciesDef } from './data';
import { INK, PARCH, GOLD, GOLD_HI, INK_FAINT, font, fontB, uiWindow } from './ui';
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
  const sz = Math.min(120, 460 / n);
  const floorY = 410;
  c.team.forEach((def, i) => {
    const x = W / 2 + (i - (n - 1) / 2) * Math.min(130, 480 / n);
    const y = floorY + (i % 2 ? 18 : 0);
    ctx.fillStyle = 'rgba(8,12,8,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + sz * 0.36, sz * 0.38, sz * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    try {
      (def.shiny ? drawShiny : drawMon)(ctx, def.id, x, y, sz);
    } catch {
      /* sprite still warming */
    }
    ctx.font = fontB(12);
    const name = def.name.toUpperCase();
    const nw = ctx.measureText(name).width + 16;
    uiWindow(ctx, { x: x - nw / 2, y: y + sz * 0.42, w: nw, h: 20 }, { dark: true, rad: 6, shadow: false });
    ctx.fillStyle = def.shiny ? GOLD_HI : PARCH;
    ctx.fillText(name, x, y + sz * 0.42 + 14);
    if (i === c.mvpIdx) {
      ctx.font = font(14);
      shadowText(ctx, '★', x, y - sz * 0.48, GOLD_HI);
    }
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
    ctx.save();
    if (!r) ctx.globalAlpha = 0.25;
    item(ctx, r ? RANK_BALL[r] : 'poke-ball', x, gy + 62, 48);
    ctx.restore();
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

  // the receipt: the replay link and the build that ran it
  const link = shareLink(c.base, c.seed);
  uiWindow(ctx, { x: 24, y: 816, w: W - 48, h: 104 }, { dark: true, rad: 10 });
  ctx.font = fontB(11);
  ctx.fillStyle = GOLD;
  ctx.fillText('REPLAY THIS CLIMB', W / 2, 840);
  let px = 18;
  ctx.font = fontB(px);
  while (px > 9 && ctx.measureText(link).width > W - 80) ctx.font = fontB(--px);
  ctx.fillStyle = PARCH;
  ctx.fillText(link, W / 2, 870);
  ctx.font = fontB(11);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(`SEED ${c.seed} · ${c.build}`, W / 2, 900);
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
