// Stage backdrops are real ripped art: each theme is a Gen-5 battle
// background panel sliced from the spriters-resource DS sheet and
// pre-scaled to the arena (public/sprites/bg/<theme>.png). Props
// (pines, boulders, pond) are ripped overworld metatiles. Only the
// clip, pool surface FX, and ripples are drawn procedurally.

import { itemSprite } from '../core/assets';

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// Prop ring around the arena, like an overworld tree/rock line: BW pine
// pair in the grove, boulders in cave and volcano, open air in the sky.
const WALL_PROP: Record<Theme, { name: string; s: number } | null> = {
  grove: { name: 'bg/pine', s: 42 },
  cavern: { name: 'rock', s: 28 },
  volcano: { name: 'rock', s: 28 },
  sky: null,
};

export function drawWall(ctx: CanvasRenderingContext2D, a: { x: number; y: number; w: number; h: number }, theme: Theme, t: number) {
  const spec = WALL_PROP[theme];
  if (!spec) return;
  const img = itemSprite(spec.name);
  if (!img) return;
  const s = spec.s;
  const step = s * 0.72;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const blit = (x: number, y: number, bob = 0) =>
    ctx.drawImage(img, x - s / 2, y + bob - s / 2, s, (s * img.height) / img.width);
  let i = 0;
  for (let x = a.x; x <= a.x + a.w; x += step, i++) {
    const bob = Math.sin(t * 1.2 + i) * 1.2; // grove pines sway a touch
    blit(x, a.y - 5, theme === 'grove' ? bob * 0.4 : 0);
    blit(x + step / 2, a.y + a.h + 5, theme === 'grove' ? -bob * 0.4 : 0);
  }
  i = 0;
  for (let y = a.y; y <= a.y + a.h; y += step, i++) {
    blit(a.x - 5, y + step / 2);
    blit(a.x + a.w + 5, y);
  }
  ctx.restore();
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  r: number,
  theme: Theme,
  t: number,
  pool: { nx: number; ny: number } | null = { nx: 0.78, ny: 0.2 },
) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();

  // the ripped battle ground — already baked at arena size
  const bg = itemSprite(`bg/${theme}`);
  if (bg) ctx.drawImage(bg, x, y, w, h);
  else {
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(x, y, w, h);
  }

  // pond / lava pool — real pond metatile on land themes, ripped flame
  // texture clipped to the pool ellipse on the volcano
  if (pool) {
    const px = x + w * pool.nx, py = y + h * pool.ny;
    const pond = itemSprite('pond');
    const lava = itemSprite('bg/lava');
    if (theme === 'volcano') {
      // cooled-crust rim, then molten surface
      ctx.fillStyle = '#3a1c0e';
      ctx.beginPath();
      ctx.ellipse(px, py, 48, 35, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lava) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(px, py, 40, 27, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(lava, px - 40, py - 27, 80, 54);
        ctx.restore();
      }
    } else if (pond) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const pw = 112, ph = 93;
      ctx.drawImage(pond, px - pw / 2, py - ph / 2, pw, ph);
      ctx.restore();
    }
    // expanding ripples — lava pulses ember rings instead
    ctx.strokeStyle = theme === 'volcano' ? '#ffb060' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const prog = (t * 0.5 + i * 0.5) % 1;
      ctx.globalAlpha = (1 - prog) * 0.45;
      ctx.beginPath();
      ctx.ellipse(px, py, 12 + prog * 32, (12 + prog * 32) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
