// Procedural stage backdrops in the GBA-overworld style: flat tiled
// ground, scattered details, and a themed sprite wall around the arena.
// No image assets — everything is drawn per frame.

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
  }
> = {
  grove: { tileA: '#8fd068', tileB: '#84c45c', dab: '#6aa848', pool: '#58b0e8', poolEdge: '#4090c8', mote: '#ffffff' },
  cavern: { tileA: '#50507c', tileB: '#484870', dab: '#3c3c60', pool: '#28284a', poolEdge: '#1c1c38', mote: '#9db4ff' },
  volcano: { tileA: '#584038', tileB: '#503a34', dab: '#443028', pool: '#ff7028', poolEdge: '#c84810', mote: '#ffb060' },
  sky: { tileA: '#98c4ec', tileB: '#8cbce4', dab: '#7cb0dc', pool: '#5c8cd0', poolEdge: '#4a74b8', mote: '#ffffff' },
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

  // flat tile base — two-tone checker like overworld grass tiles
  const TS = 26;
  ctx.fillStyle = c.tileA;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c.tileB;
  for (let ty = 0; ty * TS < h; ty++) {
    for (let tx = 0; tx * TS < w; tx++) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(x + tx * TS, y + ty * TS, TS, TS);
    }
  }

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

  // a pond / lava pool / pit blob for landmark variety
  const px = x + w * 0.78, py = y + h * 0.2;
  ctx.fillStyle = c.poolEdge;
  blob(ctx, px, py, 52, 36, 42, 8);
  ctx.fillStyle = c.pool;
  blob(ctx, px, py, 44, 29, 43, 8);
  if (theme === 'grove' || theme === 'sky') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    blob(ctx, px - 10, py - 8, 16, 6, 44, 5);
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
