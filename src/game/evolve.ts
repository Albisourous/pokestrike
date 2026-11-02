// Gen 3 evolution scene: the court dims, the old front pulses white, the
// silhouette flickers old↔new faster and faster, a white flash, then the new
// form lands with sparkles and its cry. A tap jumps to the flash, a second
// ends it; reduced motion starts at the flash.
import { cry } from '../core/audio';
import { drawMon, drawShiny, loadSprite, whiteSprite } from '../core/assets';
import { speciesById } from './data';
import { fontB, uiWindow, GOLD_HI } from './ui';

const W = 540, H = 960;

export const EVO_T = 2.5;
export const EVO_FLASH = 1.75; // the flash peaks here; the reveal runs to EVO_T
const PULSE = 0.5; // old front pulses white until here, then the flicker
const RAMP = 0.15; // the screen whites out over the last beat of the flicker

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Evo {
  from: number;
  to: number;
  shiny: boolean;
  t: number;
  cried: boolean;
}
const queue: Evo[] = [];

export function startEvo(from: number, to: number, shiny = false) {
  void loadSprite(from).catch(() => null);
  void loadSprite(to).catch(() => null);
  queue.push({ from, to, shiny, t: REDUCED ? EVO_FLASH : 0, cried: false });
}

export const evoActive = () => queue.length > 0;
export const evoScene = (): Readonly<Evo> | undefined => queue[0];

function reveal(e: Evo) {
  e.cried = true;
  cry(e.to, 'catch');
}

export function tickEvo(dt: number) {
  const e = queue[0];
  if (!e) return;
  e.t += dt;
  if (!e.cried && e.t >= EVO_FLASH) reveal(e);
  if (e.t >= EVO_T) queue.shift();
}

export function skipEvo() {
  const e = queue[0];
  if (!e) return;
  if (e.t < EVO_FLASH) {
    e.t = EVO_FLASH;
    reveal(e);
  } else queue.shift();
}

const name = (id: number) => speciesById(id)?.name ?? '???';

function front(ctx: CanvasRenderingContext2D, id: number, shiny: boolean, x: number, y: number, s: number) {
  try {
    (shiny ? drawShiny : drawMon)(ctx, id, x, y, s);
  } catch {
    /* cold cache: the sprite lands next frame */
  }
}

function white(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, s: number) {
  try {
    ctx.drawImage(whiteSprite(id), x - s / 2, y - s / 2, s, s);
  } catch {
    /* cold cache */
  }
}

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

export function drawEvo(ctx: CanvasRenderingContext2D) {
  const e = queue[0];
  if (!e) return;
  const t = e.t;
  const cx = W / 2, cy = 400, S = 256;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(4,6,14,0.84)';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, cy + 40, 20, cx, cy + 40, 260);
  glow.addColorStop(0, 'rgba(255,236,170,0.22)');
  glow.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + S * 0.4, S * 0.34, S * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  let flash = 0;
  if (t < PULSE) {
    front(ctx, e.from, e.shiny, cx, cy, S);
    ctx.globalAlpha = (0.5 - 0.5 * Math.cos(t * Math.PI * 6)) * (t / PULSE);
    white(ctx, e.from, cx, cy, S);
    ctx.globalAlpha = 1;
  } else if (t < EVO_FLASH) {
    const ph = (t - PULSE) / (EVO_FLASH - PULSE);
    const period = 0.2 - 0.17 * ph; // swaps speed up toward the flash
    white(ctx, Math.floor((t - PULSE) / period) % 2 ? e.to : e.from, cx, cy, S);
    flash = Math.max(0, (t - (EVO_FLASH - RAMP)) / RAMP);
  } else {
    const rp = Math.min(1, (t - EVO_FLASH) / 0.3);
    const pop = 1 + 0.2 * (1 - rp) * (1 - rp);
    front(ctx, e.to, e.shiny, cx, cy - 8 * (1 - rp), S * pop);
    ctx.fillStyle = e.shiny ? GOLD_HI : '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (t - EVO_FLASH) * 1.6;
      const d = 110 + 50 * rp + (i % 2) * 18;
      const tw = Math.abs(Math.sin((t - EVO_FLASH) * 9 + i * 1.7));
      ctx.globalAlpha = 0.4 + 0.6 * tw;
      sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 6 + 7 * tw);
    }
    ctx.globalAlpha = 1;
    flash = 1 - rp;
  }

  const box = { x: 20, y: 740, w: W - 40, h: 120 };
  uiWindow(ctx, box, { dark: true, rad: 10 });
  const line = t < EVO_FLASH ? `What? ${name(e.from)} is evolving!` : `${name(e.from)} evolved into ${name(e.to)}!`;
  let px = 30;
  ctx.font = fontB(px);
  while (px > 16 && ctx.measureText(line).width > box.w - 56) ctx.font = fontB(--px);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line, box.x + 28, box.y + box.h / 2);
  ctx.font = fontB(15);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(t < EVO_FLASH ? 'TAP · SKIP' : 'TAP · CONTINUE', box.x + box.w - 16, box.y + box.h - 16);

  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
