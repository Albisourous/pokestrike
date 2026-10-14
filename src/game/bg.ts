// Procedural stage backdrops in the GBA-overworld style: flat tiled
// ground, scattered details, and a themed sprite wall around the arena.
// No image assets — everything is drawn per frame.

import { itemSprite } from '../core/assets';

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

const CFG: Record<
  Theme,
  {
    tileA: string;
    tileB: string;
    dab: string;
    pool: string; // pond / lava / pit / cloud gap
    poolEdge: string;
    mote: string;
    line: string; // painted pitch markings
  }
> = {
  grove: { tileA: '#8fd068', tileB: '#84c45c', dab: '#6aa848', pool: '#58b0e8', poolEdge: '#4090c8', mote: '#ffffff', line: '#eef6e4' },
  cavern: { tileA: '#50507c', tileB: '#484870', dab: '#3c3c60', pool: '#28284a', poolEdge: '#1c1c38', mote: '#9db4ff', line: '#b0b8d0' },
  volcano: { tileA: '#584038', tileB: '#503a34', dab: '#443028', pool: '#ff7028', poolEdge: '#c84810', mote: '#ffb060', line: '#c89070' },
  sky: { tileA: '#98c4ec', tileB: '#8cbce4', dab: '#7cb0dc', pool: '#5c8cd0', poolEdge: '#4a74b8', mote: '#ffffff', line: '#ffffff' },
};

// wall sprite palettes: dark outline, mid fill, highlight
const WALL: Record<Theme, { line: string; mid: string; hi: string; extra?: string }> = {
  grove: { line: '#1d5028', mid: '#3c9448', hi: '#64c068' },          // ball trees
  cavern: { line: '#28283c', mid: '#7878a0', hi: '#9c9cc4' },         // boulders
  volcano: { line: '#1c1018', mid: '#382830', hi: '#ff7030' },        // obsidian, lava seams
  sky: { line: '#7c9cc8', mid: '#f4f8ff', hi: '#ffffff' },            // cloud bank
};

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, lobes = 7) {
  ctx.beginPath();
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = 0.82 + hash(seed + i * 17) * 0.36;
    const px = cx + Math.cos(a) * rx * r;
    const py = cy + Math.sin(a) * ry * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(cx + Math.cos(a - Math.PI / lobes) * rx * r * 1.15, cy + Math.sin(a - Math.PI / lobes) * ry * r * 1.15, px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// One ball-tree tile — the classic overworld wall.
function tree(ctx: CanvasRenderingContext2D, x: number, y: number, w: typeof WALL[Theme], s: number) {
  ctx.fillStyle = w.line;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.62, 0, Math.PI * 2);
  ctx.arc(x - s * 0.34, y + s * 0.18, s * 0.44, 0, Math.PI * 2);
  ctx.arc(x + s * 0.34, y + s * 0.18, s * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = w.mid;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.06, s * 0.54, 0, Math.PI * 2);
  ctx.arc(x - s * 0.3, y + s * 0.12, s * 0.38, 0, Math.PI * 2);
  ctx.arc(x + s * 0.3, y + s * 0.12, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = w.hi;
  ctx.beginPath();
  ctx.arc(x - s * 0.14, y - s * 0.22, s * 0.26, 0, Math.PI * 2);
  ctx.arc(x + s * 0.18, y - s * 0.12, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function boulder(ctx: CanvasRenderingContext2D, x: number, y: number, w: typeof WALL[Theme], s: number, seed: number) {
  ctx.fillStyle = w.line;
  blob(ctx, x, y, s * 0.62, s * 0.56, seed, 6);
  ctx.fillStyle = w.mid;
  blob(ctx, x, y - s * 0.05, s * 0.52, s * 0.46, seed + 3, 6);
  ctx.fillStyle = w.hi;
  blob(ctx, x - s * 0.1, y - s * 0.2, s * 0.24, s * 0.14, seed + 7, 5);
}

function obsidian(ctx: CanvasRenderingContext2D, x: number, y: number, w: typeof WALL[Theme], s: number, seed: number) {
  boulder(ctx, x, y, w, s, seed);
  // glowing lava seam
  ctx.strokeStyle = w.hi;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y + s * 0.1);
  ctx.lineTo(x - s * 0.05, y - s * 0.08);
  ctx.lineTo(x + s * 0.22, y + s * 0.16);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: typeof WALL[Theme], s: number) {
  ctx.fillStyle = w.line;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x, y + s * 0.14, s * 0.5, 0, Math.PI * 2);
  ctx.arc(x - s * 0.4, y + s * 0.2, s * 0.34, 0, Math.PI * 2);
  ctx.arc(x + s * 0.4, y + s * 0.2, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = w.mid;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
  ctx.arc(x - s * 0.38, y + s * 0.08, s * 0.34, 0, Math.PI * 2);
  ctx.arc(x + s * 0.38, y + s * 0.08, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
}

// Themed sprite wall along the arena border, like an overworld tree line.
export function drawWall(ctx: CanvasRenderingContext2D, a: { x: number; y: number; w: number; h: number }, theme: Theme, t: number) {
  const w = WALL[theme];
  const s = 17; // sprite size
  const step = s * 1.5;
  const draw = (x: number, y: number, seed: number) => {
    switch (theme) {
      case 'grove': tree(ctx, x, y, w, s); break;
      case 'cavern': boulder(ctx, x, y, w, s, seed); break;
      case 'volcano': obsidian(ctx, x, y, w, s, seed); break;
      case 'sky': cloud(ctx, x, y, w, s); break;
    }
  };
  // back row (behind border) then front row for depth
  let i = 0;
  for (let x = a.x; x <= a.x + a.w; x += step, i++) {
    const bob = Math.sin(t * 1.2 + i) * 1.2;
    draw(x, a.y - 7 + (theme === 'sky' ? bob : 0), i);
    draw(x + step / 2, a.y + a.h + 7 - (theme === 'sky' ? bob : 0), i + 100);
  }
  i = 0;
  for (let y = a.y; y <= a.y + a.h; y += step, i++) {
    draw(a.x - 7, y + step / 2, i + 200);
    draw(a.x + a.w + 7, y, i + 300);
  }
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  r: number,
  theme: Theme,
  t: number,
  pool: { nx: number; ny: number } | null = { nx: 0.78, ny: 0.2 },
) {
  const c = CFG[theme];
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

  // flat base — grove gets mowing stripes like the arena pitch shots
  ctx.fillStyle = c.tileA;
  ctx.fillRect(x, y, w, h);
  if (theme === 'grove') {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i * 90 < w; i++) ctx.fillRect(x + i * 90, y, 45, h);
  }
  if (theme === 'cavern') {
    // concrete slab court — big pavers with dark seams and a few cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 3;
    for (let gx = x + 64; gx < x + w; gx += 96) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y + 80; gy < y + h; gy += 110) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 8; i++) {
      const cxx = x + hash(i * 17 + 4) * w;
      const cyy = y + hash(i * 23 + 9) * h;
      ctx.beginPath();
      ctx.moveTo(cxx, cyy);
      ctx.lineTo(cxx + 10 + hash(i) * 18, cyy + 6 + hash(i * 3) * 14);
      ctx.lineTo(cxx + 4 + hash(i * 7) * 22, cyy + 18 + hash(i * 11) * 16);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = c.tileB;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.ellipse(
      x + hash(i * 13 + 2) * w,
      y + hash(i * 29 + 7) * h,
      50 + hash(i * 41) * 110,
      40 + hash(i * 53) * 80,
      hash(i * 3) * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // scattered dabs: grass blades / pebbles / cracks per theme
  ctx.fillStyle = c.dab;
  for (let i = 0; i < 90; i++) {
    const dx = x + hash(i * 3 + 5) * w;
    const dy = y + hash(i * 11 + 9) * h;
    if (theme === 'grove') {
      // grass blade tuft
      ctx.fillRect(dx, dy, 2, 5);
      ctx.fillRect(dx + 3, dy + 1, 2, 4);
    } else if (theme === 'sky') {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 4 + hash(i) * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5 + hash(i * 7) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // painted pitch markings — worn white lines, soccer-arena style:
  // center circle + dot, halfway line, arcs off the top/bottom edges
  {
    const mcx = x + w / 2, mcy = y + h / 2;
    ctx.strokeStyle = c.line;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 16]); // dashed = worn paint
    ctx.beginPath();
    ctx.arc(mcx, mcy, Math.min(w, h) * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, mcy);
    ctx.lineTo(x + w, mcy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mcx, y, Math.min(w, h) * 0.15, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mcx, y + h, Math.min(w, h) * 0.15, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.line;
    ctx.beginPath();
    ctx.arc(mcx, mcy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // a pond / lava pool — real RSE pond metatiles for water themes,
  // procedural lava for the volcano (water doesn't belong there)
  if (pool) {
    const px = x + w * pool.nx, py = y + h * pool.ny;
    const pond = itemSprite('pond');
    if (pond && theme !== 'volcano') {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const pw = 112, ph = 93;
      ctx.drawImage(pond, px - pw / 2, py - ph / 2, pw, ph);
      ctx.restore();
    } else {
      ctx.fillStyle = '#6a1e04';
      blob(ctx, px, py, 54, 38, 42, 8);
      ctx.fillStyle = c.pool;
      blob(ctx, px, py, 44, 29, 43, 8);
      // cooled crust plates floating on the lava
      ctx.fillStyle = '#8a3808';
      blob(ctx, px - 16, py + 4, 14, 8, 45, 6);
      blob(ctx, px + 18, py - 6, 11, 7, 46, 6);
      ctx.fillStyle = 'rgba(255,200,110,0.5)';
      blob(ctx, px - 8, py - 10, 15, 6, 44, 5);
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

  // grove extras: little flowers
  if (theme === 'grove') {
    for (let i = 0; i < 14; i++) {
      const fx = x + hash(i * 29 + 3) * w;
      const fy = y + hash(i * 37 + 1) * h;
      ctx.fillStyle = i % 3 ? '#ffffff' : '#ffd84d';
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.arc(fx + 3, fy + 1, 2, 0, Math.PI * 2);
      ctx.arc(fx + 1, fy + 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // drifting motes — subtle shimmer
  for (let i = 0; i < 18; i++) {
    const mx = x + hash(i * 7 + 1) * w + Math.sin(t * 0.8 + i * 1.7) * 14;
    const prog = (hash(i * 13) * h + t * (18 + hash(i) * 24)) % (h + 40);
    const my = y + h + 20 - prog;
    ctx.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillStyle = c.mote;
    ctx.beginPath();
    ctx.arc(mx, my, 1.5 + hash(i * 31) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
