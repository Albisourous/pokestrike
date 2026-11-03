// Gen 3 Hall of Fame: on a won climb, before the result card, each team mon
// slides in under its own type-tinted spotlight with name/Lv/type plate and
// cry, then the whole team stands with the trainer under a landing flash —
// the welcome box and the badge row below.
// A tap advances a beat; a second quick tap or a hold skips; reduced motion
// shows the final frame only.
import { cry } from '../core/audio';
import { drawMon, drawNpc, drawShiny, itemSprite, loadItem, loadSprite } from '../core/assets';
import { badgeOf, settings, trainerPick } from './meta';
import { TYPE_COLOR, type PokeType } from './types';
import { TYPE_RAMP } from './vfx';
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
  type2?: PokeType;
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
  const team = b.players.map((p) => ({ id: p.def.id, name: p.def.name, lvl: p.lvl, type: p.def.type, type2: p.def.type2, shiny: p.shiny }));
  // this run's leaders: a ranked stop (cleared) whose row fielded a badge boss
  const badges = b.stage.waves.flatMap((w, i) => (b.runRanks[i] ? w.flatMap((s) => (s.boss && badgeOf(s.def.id)?.icon) || []) : []));
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
  // the cry lands with the mon, a beat into its slot — each id owns a
  // slightly different beat so the roll call doesn't march in lockstep
  if (i < f.team.length && i > f.cried && f.t - i * f.slot >= f.slot * (0.4 + ((f.team[i].id * 13) % 5) * 0.05)) {
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

// hex + alpha → rgba() — TYPE_COLOR arrives as #rrggbb
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// the spotlight cone — type-tinted per mon (dual types fade into type2)
function beam(ctx: CanvasRenderingContext2D, x: number, top: number, bot: number, w0: number, w1: number, a: number, col = '#fff0be', col2 = col) {
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, rgba(col, 0.05 * a));
  g.addColorStop(1, rgba(col2, 0.22 * a));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w0 / 2, top);
  ctx.lineTo(x + w0 / 2, top);
  ctx.lineTo(x + w1 / 2, bot);
  ctx.lineTo(x - w1 / 2, bot);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(col2, 0.18 * a);
  ctx.beginPath();
  ctx.ellipse(x, bot, w1 / 2, w1 * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

// a four-point twinkle — the team-shot landing burst
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
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
    beam(ctx, W / 2, 130, 520, 90, 300, 1, TYPE_COLOR[m.type], TYPE_COLOR[m.type2 ?? m.type]);
    const dir = i % 2 ? -1 : 1; // entrances alternate off-screen sides
    const x = W / 2 + dir * (1 - ease(s / 0.45)) * (W / 2 + 160);
    // a short type-ramped glint trail chases the slide-in, dying as it settles
    if (!REDUCED && s < 0.7) {
      const ramp = TYPE_RAMP[m.type];
      const ta = 1 - ease((s - 0.45) / 0.25);
      if (ta > 0) {
        for (let k = 1; k <= 5; k++) {
          const wob = Math.sin(t * 11 + k * 2.1);
          ctx.globalAlpha = ta * (0.75 - k * 0.11);
          ctx.fillStyle = k === 1 ? '#ffffff' : ramp[(k - 1) % ramp.length];
          sparkle(ctx, x + dir * (k * 24 + wob * 6), 400 - 30 + k * 14 + wob * 10, 3 + (6 - k) * 1.4);
        }
        ctx.globalAlpha = 1;
      }
    }
    mon(ctx, m, x, 400, 240);
    // a type-colored ripple spreads under the feet as the slide settles
    if (s > 0.45 && !REDUCED) {
      const rp = Math.min(1, (s - 0.45) / 0.3);
      ctx.globalAlpha = (1 - rp) * 0.55;
      ctx.strokeStyle = TYPE_COLOR[m.type];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, 400 + 240 * 0.4, 60 + rp * 120, (60 + rp * 120) * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
        // the landing burst: a pair of type-colored twinkles off each mon
        const sp = REDUCED ? 0 : 1 - Math.min(1, (t - fin) / 0.8);
        if (sp > 0) {
          ctx.globalAlpha = sp * (0.35 + 0.65 * Math.abs(Math.sin((t - fin) * 8 + j * 1.9 + r)));
          ctx.fillStyle = m.shiny ? GOLD_HI : TYPE_COLOR[m.type];
          sparkle(ctx, x - s * 0.42, y + bob - s * 0.36, 5 + 9 * sp);
          sparkle(ctx, x + s * 0.38, y + bob - s * 0.08, 4 + 7 * sp);
          ctx.globalAlpha = 1;
        }
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
      const bx = (j: number) => W / 2 + (j - (f.badges.length - 1) / 2) * (bs + 6);
      f.badges.forEach((icon, j) => {
        const img = itemSprite(`badges/${icon}`);
        if (img) ctx.drawImage(img, bx(j) - bs / 2, band.y + (band.h - bs) / 2, bs, bs);
      });
      // a gold shimmer sweeps the row once; each badge glints as the front passes
      const sh = (t - fin - 0.7) / 0.8;
      if (!REDUCED && sh > 0 && sh < 1) {
        const front = band.x + band.w * sh;
        ctx.save();
        ctx.beginPath();
        ctx.rect(band.x + 4, band.y + 4, band.w - 8, band.h - 8);
        ctx.clip();
        const gg = ctx.createLinearGradient(front - 40, 0, front + 40, 0);
        gg.addColorStop(0, 'rgba(255,236,160,0)');
        gg.addColorStop(0.5, 'rgba(255,236,160,0.45)');
        gg.addColorStop(1, 'rgba(255,236,160,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(band.x, band.y, band.w, band.h);
        ctx.restore();
        f.badges.forEach((_, j) => {
          const d = Math.abs(bx(j) - front);
          if (d < 44) {
            ctx.globalAlpha = (1 - d / 44) * 0.9;
            ctx.fillStyle = '#ffffff';
            sparkle(ctx, bx(j) + 8, band.y + 16, 4 + 6 * (1 - d / 44));
            ctx.globalAlpha = 1;
          }
        });
      }
    }
    ctx.globalAlpha = 1;
    // the team shot lands on a single combined flash
    const fl = REDUCED ? 0 : 1 - Math.min(1, (t - fin) / 0.5);
    if (fl > 0) {
      ctx.globalAlpha = fl * (settings().flash ? 1 : 0.35);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = fontB(15);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(t < fin ? 'TAP · NEXT    HOLD · SKIP' : 'TAP · CONTINUE', W / 2, 900);
  ctx.restore();
}
