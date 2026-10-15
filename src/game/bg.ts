// Stadium-court arenas: a prerendered textured floor per theme with painted
// pitch markings (inset boundary, halfway line, center circle, corner arcs)
// drawn live so they scale to the arena rect. Props come from the gracidea pass.

import { gracidea, loadGracidea } from '../core/assets';

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
// menus want the texture without the edge props
const bareFloors = new Map<Theme, HTMLCanvasElement>();

function floor(theme: Theme, bare = false) {
  const cache = bare ? bareFloors : floors;
  const hit = cache.get(theme);
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
  if (!bare) {
    if (propsReady) decorate(theme, g);
    else ensureProps();
  }
  cache.set(theme, c);
  return c;
}

// --- gracidea scenery: keyed atlas slices baked into each floor, once ---

type Slice = readonly [number, number, number, number]; // source rect in tileset.webp
const sliceCache = new Map<string, HTMLCanvasElement>();

// The webp is lossy: the transparency key shows up as a family of hot pinks
// (≈249,76,225 → 179,3,153), so key on "r&b high, g low" instead of one color.
function slice(sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement | undefined {
  const img = gracidea();
  if (!img) return;
  const k = `${sx},${sy},${sw},${sh}`;
  const hit = sliceCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const g = c.getContext('2d')!;
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const id = g.getImageData(0, 0, sw, sh);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    if (r > 140 && b > 110 && gg < 120 && r - gg > 50 && b - gg > 40) d[i + 3] = 0;
  }
  g.putImageData(id, 0, 0);
  sliceCache.set(k, c);
  return c;
}

function put(g: CanvasRenderingContext2D, s: Slice, x: number, y: number, sc = 1, alpha = 1) {
  const c = slice(s[0], s[1], s[2], s[3]);
  if (!c) return;
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, x, y, s[2] * sc, s[3] * sc);
  g.restore();
}

// Eyeballed prop rects in tileset.webp (see the .json for neighboring frames).
const TREE: Slice[] = [
  [1980, 90, 54, 54],
  [1918, 90, 52, 54],
  [1872, 126, 54, 54],
];
const FLOWER: Slice[] = [
  [1710, 92, 16, 16], // red
  [1764, 92, 16, 16], // yellow
  [1782, 92, 16, 16], // yellow
  [1764, 110, 16, 16], // pink
  [1782, 110, 16, 16], // pink
];
const PEN: Slice[] = [
  // rock-walled pens with a boulder inside
  [18, 115, 54, 65],
  [72, 115, 54, 65],
  [234, 115, 54, 65],
];
const CAVE_ARCH: Slice = [292, 140, 40, 23];
const DOME = {
  brown: [0, 0, 56, 60],
  olive: [57, 0, 56, 60],
  white: [113, 0, 56, 60],
  red: [169, 0, 56, 60],
  dark: [225, 0, 56, 60],
  char: [281, 0, 56, 60],
} as const;
const BOWL: Slice = [1838, 488, 52, 36]; // stone basin
const BOWL_TALL: Slice = [1838, 455, 52, 30];
const METEOR: Slice = [1590, 22, 28, 30]; // pocked gray rock
const PEAK: Slice = [930, 570, 80, 70]; // stone summit monument
const PEBBLES: Slice = [180, 189, 36, 9];
let propsReady = false;
let propsLoading = false;

// Floors are usually first baked while the atlas is still loading; decorate
// every cached floor when the fetch lands instead of rebuilding them.
function ensureProps() {
  if (propsReady || propsLoading) return;
  propsLoading = true;
  loadGracidea()
    .then(() => {
      propsReady = true;
      floors.forEach((c, t) => decorate(t, c.getContext('2d')!));
    })
    .catch(() => {});
}

function decorate(theme: Theme, g: CanvasRenderingContext2D) {
  if (theme === 'grove') {
    // tree row hugging the top edge + scattered flowers
    for (let k = 0; k < 6; k++) {
      put(g, TREE[k % 3], 8 + k * 88 + hash(k * 7.1) * 10 - 5, -4, 1.5);
    }
    for (let k = 0; k < 6; k++) {
      put(g, FLOWER[k % FLOWER.length], 55 + k * 85 + hash(k * 11.3) * 16, 64 + hash(k * 5.9) * 30, 2);
    }
    for (let k = 0; k < 6; k++) {
      put(g, FLOWER[(k * 2) % FLOWER.length], 30 + hash(k * 13.7) * 460, 905 + hash(k * 7.3) * 40, 2);
    }
  } else if (theme === 'cavern') {
    for (let k = 0; k < 3; k++) put(g, PEN[k], 16 + k * 88, 2);
    put(g, CAVE_ARCH, 238, 10, 2);
    put(g, DOME.dark, 4, 420);
    put(g, DOME.char, 482, 470);
    put(g, DOME.olive, 10, 880);
    put(g, DOME.white, 440, 886);
    for (let k = 0; k < 5; k++) {
      put(g, PEBBLES, 60 + hash(k * 9.1) * 420, 200 + hash(k * 17.7) * 500, 1, 0.75);
    }
  } else if (theme === 'volcano') {
    put(g, DOME.red, 8, 4, 1.1);
    put(g, DOME.char, 82, 2, 1.1);
    put(g, DOME.char, 478, 30, 1.1);
    put(g, DOME.brown, 12, 880, 1.1);
    put(g, DOME.red, 452, 884, 1.1);
    put(g, BOWL, 200, 14, 1.5);
    put(g, BOWL_TALL, 330, 20, 1.5);
    put(g, METEOR, 14, 300, 2);
    put(g, METEOR, 486, 620, 1.7);
  } else {
    // floating summits poking through the cloud banks
    put(g, PEAK, 2, -4, 1.35);
    put(g, DOME.white, 470, 4);
    put(g, DOME.olive, 255, -8);
    put(g, PEAK, 430, 896, 0.9);
  }
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
  bare = false,
) {
  const { x, y, w, h } = rect;
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(floor(theme, bare), x, y, w, h);
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
