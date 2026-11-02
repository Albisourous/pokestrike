// Gen 3 Hall of Fame: on a won climb, before the result card, each team mon
// slides in under a spotlight with its name/Lv/type plate and cry, then the
// whole team stands with the trainer, the welcome box and the badge row.
// A tap advances a beat; a second quick tap or a hold skips; reduced motion
// shows the final frame only.
import { cry } from '../core/audio';
import { drawMon, drawNpc, drawShiny, itemSprite, loadItem, loadSprite } from '../core/assets';
import { BADGES, gymBadges, trainerPick } from './meta';
import { TYPE_COLOR, type PokeType } from './types';
import { font, fontB, uiWindow, GOLD_HI } from './ui';
import type { Battle } from './battle';

const W = 540, H = 960;
const SLIDES = 3.6; // the whole slide-in reel, split across the team
const FINAL = 2.4;
const HOLD = 0.5; // a press held this long skips
const DOUBLE = 0.35; // a second tap inside this skips
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface FameMon {
  id: number;
  name: string;
  lvl: number;
  type: PokeType;
  shiny: boolean;
}
interface Fame {
  team: FameMon[];
  badges: number[];
  trainer: string;
  slot: number;
  t: number;
  clock: number; // real time, for double-tap and hold
  lastTap: number;
  held: number | null;
  cried: number;
}
let fame: Fame | null = null;
let closed = false;
const close = () => ((fame = null), (closed = true));

const finalAt = (f: Fame) => f.team.length * f.slot;
export const fameEnd = (f: Fame) => finalAt(f) + FINAL;
export const fameActive = () => fame !== null;
export const fameScene = (): Readonly<Fame> | null => fame;

export function startFame(b: Battle) {
  const team = b.players.map((p) => ({ id: p.def.id, name: p.def.name, lvl: p.lvl, type: p.def.type, shiny: p.shiny }));
  const badges = BADGES.filter((g) => gymBadges().has(g.boss)).map((g) => g.icon);
  for (const m of team) void loadSprite(m.id).catch(() => null);
  for (const n of badges) void loadItem(`badges/${n}`).catch(() => null);
  const slot = SLIDES / Math.max(1, team.length);
  fame = { team, badges, trainer: trainerPick(), slot, t: 0, clock: 0, lastTap: -1, held: null, cried: -1 };
  if (REDUCED) fame.t = finalAt(fame);
}

// true on the frame after the scene closes, so the result card starts its intro then
export function tickFame(dt: number): boolean {
  const f = fame;
  if (!f) return closed && !(closed = false);
  f.t += dt;
  f.clock += dt;
  const i = Math.floor(f.t / f.slot);
  // the cry lands with the mon, a beat into its slot
  if (i < f.team.length && i > f.cried && f.t - i * f.slot >= f.slot * 0.45) {
    f.cried = i;
    cry(f.team[i].id, 'catch');
  }
  if (f.t >= fameEnd(f) || (f.held !== null && f.clock - f.held >= HOLD)) close();
  return false;
}

export function fameDown() {
  const f = fame;
  if (!f) return;
  if (f.lastTap >= 0 && f.clock - f.lastTap < DOUBLE) {
    close();
    return;
  }
  f.lastTap = f.clock;
  f.held = f.clock;
  const fin = finalAt(f);
  if (f.t >= fin) close();
  else f.t = Math.min(fin, (Math.floor(f.t / f.slot) + 1) * f.slot);
}

export function fameUp() {
  if (fame) fame.held = null;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function mon(ctx: CanvasRenderingContext2D, m: FameMon, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.4, s * 0.32, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  try {
    (m.shiny ? drawShiny : drawMon)(ctx, m.id, x, y, s);
  } catch {
    /* cold cache: the sprite lands next frame */
  }
}

function beam(ctx: CanvasRenderingContext2D, x: number, top: number, bot: number, w0: number, w1: number, a: number) {
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, `rgba(255,240,190,${0.05 * a})`);
  g.addColorStop(1, `rgba(255,240,190,${0.22 * a})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w0 / 2, top);
  ctx.lineTo(x + w0 / 2, top);
  ctx.lineTo(x + w1 / 2, bot);
  ctx.lineTo(x - w1 / 2, bot);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255,240,190,${0.18 * a})`;
  ctx.beginPath();
  ctx.ellipse(x, bot, w1 / 2, w1 * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fit(ctx: CanvasRenderingContext2D, f: (px: number) => string, text: string, px: number, max: number) {
  ctx.font = f(px);
  while (px > 10 && ctx.measureText(text).width > max) ctx.font = f(--px);
}

export function drawFame(ctx: CanvasRenderingContext2D) {
  const f = fame;
  if (!f) return;
  const t = f.t;
  const fin = finalAt(f);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05070f');
  bg.addColorStop(1, '#141a33');
  ctx.fillStyle = bg; // its own room: the result card waits underneath, unseen
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(24);
  ctx.fillText('HALL OF FAME', W / 2, 96);

  if (t < fin) {
    const i = Math.floor(t / f.slot);
    const m = f.team[i];
    const s = (t - i * f.slot) / f.slot;
    beam(ctx, W / 2, 130, 520, 90, 300, 1);
    const x = W / 2 + (1 - ease(s / 0.45)) * (W / 2 + 160);
    mon(ctx, m, x, 400, 240);
    const pa = ease((s - 0.4) / 0.25);
    if (pa > 0) {
      ctx.globalAlpha = pa;
      const plate = { x: W / 2 - 180, y: 590, w: 360, h: 112 };
      uiWindow(ctx, plate, { dark: true, rad: 10 });
      ctx.fillStyle = '#ffffff';
      fit(ctx, fontB, m.name.toUpperCase(), 34, plate.w - 40);
      ctx.fillText(m.name.toUpperCase(), W / 2, plate.y + 38);
      const tl = m.type.toUpperCase();
      ctx.font = fontB(20);
      const lv = `Lv${m.lvl} · `;
      const lw = ctx.measureText(lv).width, tw = ctx.measureText(tl).width + 24;
      const x0 = W / 2 - (lw + tw) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(lv, x0, plate.y + 80);
      ctx.fillStyle = TYPE_COLOR[m.type];
      ctx.beginPath();
      ctx.roundRect(x0 + lw, plate.y + 67, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(tl, x0 + lw + tw / 2, plate.y + 80);
      ctx.globalAlpha = 1;
    }
    ctx.font = fontB(18);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${i + 1} / ${f.team.length}`, W / 2, 136);
  } else {
    const a = REDUCED ? 1 : ease((t - fin) / 0.4);
    beam(ctx, W / 2, 120, 560, 200, 500, a);
    const n = f.team.length;
    const back = n > 3 ? Math.ceil(n / 2) : n;
    const rows = n > 3 ? [f.team.slice(0, back), f.team.slice(back)] : [f.team];
    const s = n > 3 ? 132 : 150;
    rows.forEach((row, r) => {
      const y = rows.length > 1 ? 300 + r * 120 : 380;
      row.forEach((m, j) => {
        const x = W / 2 + (j - (row.length - 1) / 2) * (s * 0.95);
        const bob = REDUCED ? 0 : Math.sin((t - fin) * 3 + j + r) * 2;
        mon(ctx, m, x, y + bob, s);
      });
    });
    drawNpc(ctx, `${f.trainer}_down_0`, W / 2, 610, 96);
    const box = { x: 24, y: 640, w: W - 48, h: 96 };
    uiWindow(ctx, box, { dark: true, rad: 10 });
    ctx.fillStyle = '#ffffff';
    fit(ctx, font, 'WELCOME TO THE HALL OF FAME!', 20, box.w - 40);
    ctx.fillText('WELCOME TO THE HALL OF FAME!', W / 2, box.y + box.h / 2);
    if (f.badges.length) {
      const band = { x: 24, y: 752, w: W - 48, h: 72 };
      uiWindow(ctx, band, { dark: true, rad: 10 });
      const bs = Math.min(44, (band.w - 24) / f.badges.length - 6);
      f.badges.forEach((icon, j) => {
        const img = itemSprite(`badges/${icon}`);
        if (img) ctx.drawImage(img, W / 2 + (j - (f.badges.length - 1) / 2) * (bs + 6) - bs / 2, band.y + (band.h - bs) / 2, bs, bs);
      });
    }
    ctx.globalAlpha = 1;
  }
  ctx.font = fontB(15);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(t < fin ? 'TAP · NEXT    HOLD · SKIP' : 'TAP · CONTINUE', W / 2, 900);
  ctx.restore();
}
