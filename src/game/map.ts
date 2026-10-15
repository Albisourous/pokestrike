// Region map generator — a port of porygion's algorithm (MIT,
// github.com/huderlem/porygion) to the climb: 3-octave value noise for
// elevation (water < 0, land, mountain > 0.55), one node per row-band on
// land south→north, Manhattan L-routes between consecutive nodes.
import { mulberry32 } from '../core/rng';
import { gracidea } from '../core/assets';
import { TOTAL_STAGES } from './data';

export const MAP_W = 16;
export const MAP_H = 22;

export type NodeKind = 'start' | 'wild' | 'gym';
export interface MapNode {
  tx: number;
  ty: number;
  kind: NodeKind;
}
export interface RegionMap {
  elev: Float32Array; // MAP_W*MAP_H — <0 water, >0.55 mountain
  nodes: MapNode[]; // TOTAL_STAGES stops, nodes[0] is the southern start
  route: Set<number>; // tile indices carved between nodes
}

// Seeded value noise (0..1) — smooth-interpolated lattice hashes; stands in
// for porygion's opensimplex octaves.
const h2 = (x: number, y: number, s: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const fade = (t: number) => t * t * (3 - 2 * t);
const vn = (x: number, y: number, s: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = fade(x - xi), yf = fade(y - yi);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * yf) * yf;
};

export function genRegion(seed: number): RegionMap {
  const rng = mulberry32(seed);
  const elev = new Float32Array(MAP_W * MAP_H);
  // porygion's octave recipe: broad base (+0.2 keeps it mostly land),
  // medium detail, jitter modulated by a slow coefficient field
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const base = vn(x / 6.5, y / 6.5, 0) * 2 - 1 + 0.2;
      const detail = (vn(x / 2.5, y / 2.5, 1) * 2 - 1) * 0.15;
      const jitter = (vn(x / 1.4, y / 1.4, 2) * 2 - 1) * ((vn(x / 4.5, y / 4.5, 3) * 2 - 1) * 0.6);
      // pull the far edges underwater so the region reads as an island
      const edge = Math.min(x, MAP_W - 1 - x, y, MAP_H - 1 - y);
      elev[y * MAP_W + x] = base + detail + jitter - Math.max(0, 1.6 - edge) * 0.5;
    }
  }
  const land = (x: number, y: number) =>
    x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && elev[y * MAP_W + x] >= 0 && elev[y * MAP_W + x] <= 0.55;

  // One node per row-band, alternating left/right halves so the path
  // zigzags south→north; each lands on the nearest valid grass tile.
  const nodes: MapNode[] = [];
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const band = i / (TOTAL_STAGES - 1);
    const cy = Math.round(MAP_H - 2 - band * (MAP_H - 4));
    const mid = i % 2 === 0 ? MAP_W * 0.3 : MAP_W * 0.7;
    let best: MapNode | null = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!land(x, cy + dy)) continue;
        const d = Math.abs(x - mid) + Math.abs(dy) * 1.5 + rng() * 2;
        if (d < bd) { bd = d; best = { tx: x, ty: cy + dy, kind: 'wild' }; }
      }
    }
    nodes.push(best ?? { tx: Math.round(mid), ty: Math.max(1, Math.min(MAP_H - 2, cy)), kind: 'wild' });
  }
  nodes[0].kind = 'start';
  for (const i of [2, 5, 8]) if (nodes[i]) nodes[i].kind = 'gym';

  // Manhattan L-routes — random corner order, porygion's connectCities
  const route = new Set<number>();
  const carve = (a: MapNode, b: MapNode) => {
    const hFirst = rng() < 0.5;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
      while (x1 !== x2 || y1 !== y2) {
        route.add(y1 * MAP_W + x1);
        x1 += dx * (x1 !== x2 ? 1 : 0);
        y1 += dy * (x1 === x2 ? 1 : 0);
      }
      route.add(y2 * MAP_W + x2);
    };
    if (hFirst) { seg(a.tx, a.ty, b.tx, a.ty); seg(b.tx, a.ty, b.tx, b.ty); }
    else { seg(a.tx, a.ty, a.tx, b.ty); seg(a.tx, b.ty, b.tx, b.ty); }
  };
  for (let i = 1; i < nodes.length; i++) carve(nodes[i - 1], nodes[i]);

  return { elev, nodes, route };
}

// --- tile drawing: keyed gracidea slices, cached per rect (same magenta-
// family test as bg.ts — terrain tiles are opaque but buildings aren't)
const tileCache = new Map<string, HTMLCanvasElement>();
export function drawTile(
  ctx: CanvasRenderingContext2D,
  s: readonly [number, number, number, number],
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const img = gracidea();
  if (!img) return;
  const k = s.join(',');
  let c = tileCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = s[2];
    c.height = s[3];
    const g = c.getContext('2d')!;
    g.drawImage(img, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]);
    const id = g.getImageData(0, 0, s[2], s[3]);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (r > 140 && b > 110 && gg < 120 && r - gg > 50 && b - gg > 40) d[i + 3] = 0;
    }
    g.putImageData(id, 0, 0);
    tileCache.set(k, c);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, dx, dy, dw, dh);
  ctx.restore();
}
