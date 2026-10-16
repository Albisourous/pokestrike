// Stadium-court arenas: a prerendered textured floor per theme with painted
// pitch markings (inset boundary, halfway line, center circle, corner arcs)
// drawn live so they scale to the arena rect.

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
// soft light pool per theme: sun patch / light shaft / ember bed / sun glare
const GLOW: Record<Theme, [number, number, number, number]> = {
  grove: [255, 234, 150, 0.12],
  cavern: [186, 200, 255, 0.10],
  volcano: [255, 116, 40, 0.16],
  sky: [255, 255, 255, 0.14],
};
// court paint stays faint so sprites read over it
const PAINT = 'rgba(255,246,220,0.12)';
const TAU = Math.PI * 2;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The texture is far too many ops to redraw per frame, so each theme's floor
// is painted once at logical size and blitted; stretch on odd rects is invisible.
const FW = 540, FH = 960;
const floors = new Map<Theme, HTMLCanvasElement>();

function floor(theme: Theme) {
  const hit = floors.get(theme);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const g = c.getContext('2d')!;
  g.fillStyle = GROUND[theme];
  g.fillRect(0, 0, FW, FH);
  if (theme === 'grove') {
    // alternating mow stripes + scattered clipped blades
    for (let y = 0; y < FH; y += 96) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(0, y, FW, 48);
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(0, y + 48, FW, 48);
    }
    for (let i = 0; i < 1400; i++) {
      const v = hash(i * 5.3 + 4);
      g.fillStyle = v > 0.5 ? 'rgba(220,255,170,0.09)' : 'rgba(8,44,12,0.10)';
      g.fillRect(hash(i * 1.7) * FW, hash(i * 3.1 + 9) * FH, 2, 3 + v * 3);
    }
  } else if (theme === 'cavern') {
    // large staggered slabs: tint per slab, grout stroke, top-edge highlight
    const cw = 108, ch = 96;
    for (let row = 0, y = 0; y < FH; y += ch, row++) {
      for (let x = (row % 2) * -cw / 2; x < FW; x += cw) {
        const v = hash(x * 0.37 + y * 1.13);
        g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${Math.abs(v - 0.5) * 0.22})`;
        g.fillRect(x, y, cw, ch);
        g.strokeStyle = 'rgba(0,0,0,0.20)';
        g.lineWidth = 3;
        g.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
        g.strokeStyle = 'rgba(255,255,255,0.05)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 3, y + 3.5);
        g.lineTo(x + cw - 3, y + 3.5);
        g.stroke();
      }
    }
  } else if (theme === 'volcano') {
    // basalt mottling + wandering crack seams, a few glowing hot
    for (let i = 0; i < 70; i++) {
      const er = 18 + hash(i * 1.3) * 58;
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.beginPath();
      g.ellipse(hash(i * 7.7) * FW, hash(i * 3.9 + 2) * FH, er, er * 0.6, hash(i) * 3, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      let px = hash(i * 11.3) * FW, py = hash(i * 7.1 + 5) * FH;
      const hot = hash(i * 2.9) > 0.78;
      g.strokeStyle = hot ? 'rgba(255,110,40,0.16)' : 'rgba(0,0,0,0.30)';
      g.lineWidth = hot ? 4 : 2;
      g.beginPath();
      g.moveTo(px, py);
      const steps = 3 + ((hash(i * 4.7) * 4) | 0);
      for (let s = 0; s < steps; s++) {
        const ang = hash(i * 17.3 + s * 3.1) * TAU;
        const len = 24 + hash(i * 9.1 + s * 1.7) * 55;
        px += Math.cos(ang) * len;
        py += Math.sin(ang) * len;
        g.lineTo(px, py);
      }
      g.stroke();
    }
  } else {
    // sky — cloud-banked floor: faint blue underside under each white cap
    for (let i = 0; i < 90; i++) {
      const hx = hash(i * 5.1) * FW, hy = hash(i * 2.3 + 8) * FH;
      const pr = 24 + hash(i * 1.9) * 58;
      g.fillStyle = 'rgba(70,120,170,0.08)';
      g.beginPath();
      g.arc(hx, hy + 12, pr, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath();
      g.arc(hx, hy, pr * (0.8 + hash(i * 4.4) * 0.4), 0, TAU);
      g.fill();
    }
  }
  floors.set(theme, c);
  return c;
}

// Thick rim with a hairline chalk line just inside, so the edge reads as
// painted stadium boards rather than a bare stroke.
export function drawWall(ctx: CanvasRenderingContext2D, a: { x: number; y: number; w: number; h: number }, theme: Theme) {
  ctx.strokeStyle = RIM[theme];
  ctx.lineWidth = 10;
  rr(ctx, a.x, a.y, a.w, a.h, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,220,0.20)';
  ctx.lineWidth = 2;
  rr(ctx, a.x + 7, a.y + 7, a.w - 14, a.h - 14, 11);
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
  ctx.drawImage(floor(theme), x, y, w, h);
  // dark seat under the wall so the rim sits on the floor, not floats
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 12;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  // painted court lines — inset clear of the rim + hairline above
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h);
  const ix = x + 18, iy = y + 18, iw = w - 36, ih = h - 36;
  ctx.strokeStyle = PAINT;
  ctx.fillStyle = PAINT;
  ctx.lineWidth = 4;
  rr(ctx, ix, iy, iw, ih, Math.max(0, r - 6));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ix, cy);
  ctx.lineTo(ix + iw, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, m * 0.17, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, TAU);
  ctx.fill();
  const cr = m * 0.1;
  ctx.beginPath();
  ctx.arc(ix, iy, cr, 0, TAU / 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ix + iw, iy, cr, TAU / 4, TAU / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ix + iw, iy + ih, cr, TAU / 2, TAU * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ix, iy + ih, cr, TAU * 0.75, TAU);
  ctx.stroke();
  // soft light pool, gently pulsing; screens pass null to skip it
  if (pool) {
    const [gr, gg, gb, ga] = GLOW[theme];
    const px = x + pool.nx * w, py = y + pool.ny * h;
    const a = ga * (0.85 + 0.15 * Math.sin(t * 1.2));
    const gd = ctx.createRadialGradient(px, py, 0, px, py, m * 0.42);
    gd.addColorStop(0, `rgba(${gr},${gg},${gb},${a})`);
    gd.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = gd;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
