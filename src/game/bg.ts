// Stage backdrops are flat for now — a theme-tinted field, a plain pool
// where movement rules need one, and a darker rim for the wall. Real
// Gracidea/RSE scenery replaces this when the asset pass is ready.

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const GROUND: Record<Theme, string> = {
  grove: '#3e8e3c',
  cavern: '#4c4658',
  volcano: '#40281e',
  sky: '#82c2e6',
};
const RIM: Record<Theme, string> = {
  grove: '#2a6428',
  cavern: '#322d40',
  volcano: '#241610',
  sky: '#5490ba',
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Flat rim marking the arena edge — the prop ring returns with real art.
export function drawWall(ctx: CanvasRenderingContext2D, a: { x: number; y: number; w: number; h: number }, theme: Theme) {
  ctx.strokeStyle = RIM[theme];
  ctx.lineWidth = 8;
  rr(ctx, a.x, a.y, a.w, a.h, 18);
  ctx.stroke();
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
  rr(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.fillStyle = GROUND[theme];
  ctx.fillRect(x, y, w, h);

  // flat pond / lava pool, sized to the collision region in battle.setPool
  if (pool) {
    const px = x + w * pool.nx, py = y + h * pool.ny;
    const lava = theme === 'volcano';
    const rx = lava ? 40 : 42, ry = lava ? 27 : 30;
    ctx.fillStyle = lava ? '#2a1408' : 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx + 7, ry + 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lava ? '#e85818' : '#3f88d0';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // expanding ripples — lava pulses ember rings instead
    ctx.strokeStyle = lava ? '#ffb060' : 'rgba(255,255,255,0.5)';
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
