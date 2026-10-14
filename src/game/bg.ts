// Stage backdrops are flat for now — a theme-tinted field and a darker rim
// for the wall. Real Gracidea/RSE scenery replaces this when the asset
// pass is ready.

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

// _t and _pool are dead while the field is flat — kept so call sites stay stable.
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  r: number,
  theme: Theme,
  _t: number,
  _pool: { nx: number; ny: number } | null = { nx: 0.78, ny: 0.2 },
) {
  const { x, y, w, h } = rect;
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = GROUND[theme];
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
