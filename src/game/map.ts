// Region map generator — porygion's idea (seeded island, banded stops,
// Manhattan routes) kept simple: one wobbling island of grass ringed by
// sand and sea, nine stops zigzagging south→north, scenery sprinkled on
// the open land. StS-style stop kinds ride along: gyms every 3rd, Poké
// Center rests, field items to find.
import { mulberry32 } from '../core/rng';
import { gracidea } from '../core/assets';
import { TOTAL_STAGES } from './data';

export const MAP_W = 16;
export const MAP_H = 22;

export const T_WATER = 0;
export const T_SAND = 1;
export const T_GRASS = 2;

export type NodeKind = 'start' | 'wild' | 'gym' | 'rest' | 'item';
export interface MapNode {
  tx: number;
  ty: number;
  kind: NodeKind;
}
export interface RegionMap {
  tiles: Uint8Array; // MAP_W*MAP_H — T_*
  nodes: MapNode[]; // TOTAL_STAGES stops, nodes[0] is the southern start
  route: Set<number>; // tile indices carved between nodes
  decor: Map<number, 'tree' | 'flower' | 'rock'>; // scenery on open land
}

// Seeded value noise (0..1) — one smooth octave is enough for a coastline.
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

// One icon per stop — fixed so the island reads like StS's map: you can
// plan the climb ("rest before the last gym") the moment it rolls.
const KINDS: NodeKind[] = ['start', 'item', 'gym', 'wild', 'rest', 'gym', 'item', 'rest', 'gym'];

export function genRegion(seed: number): RegionMap {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const cx = (MAP_W - 1) / 2, cy = (MAP_H - 1) / 2;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / (MAP_W / 2), dy = (y - cy) / (MAP_H / 2);
      const wobble = (vn(x / 3.2, y / 3.2, 0) - 0.5) * 0.5;
      tiles[y * MAP_W + x] = dx * dx + dy * dy < 0.72 + wobble ? T_GRASS : T_WATER;
    }
  }
  // beach ring: any land touching the sea is sand
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (tiles[i] !== T_GRASS) continue;
      const sea = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const nx = x + ox, ny = y + oy;
        return nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || tiles[ny * MAP_W + nx] === T_WATER;
      });
      if (sea) tiles[i] = T_SAND;
    }
  }
  const land = (x: number, y: number) => x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tiles[y * MAP_W + x] === T_GRASS;

  // Stops: one per row-band, alternating left/right of the island so the
  // route snakes; nudge toward the center until it sits on grass.
  const nodes: MapNode[] = [];
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const band = i / (TOTAL_STAGES - 1);
    const ty = Math.round(MAP_H - 3 - band * (MAP_H - 6));
    let tx = Math.round((i % 2 === 0 ? 0.28 : 0.72) * (MAP_W - 1) + (rng() - 0.5) * 2);
    while (!land(tx, ty) && tx !== Math.round(cx)) tx += Math.sign(cx - tx);
    nodes.push({ tx, ty, kind: KINDS[i] });
  }

  // Manhattan L-routes — random corner order, porygion's connectCities
  const route = new Set<number>();
  const carve = (a: MapNode, b: MapNode) => {
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      while (x1 !== x2 || y1 !== y2) {
        route.add(y1 * MAP_W + x1);
        if (x1 !== x2) x1 += Math.sign(x2 - x1);
        else y1 += Math.sign(y2 - y1);
      }
      route.add(y2 * MAP_W + x2);
    };
    if (rng() < 0.5) { seg(a.tx, a.ty, b.tx, a.ty); seg(b.tx, a.ty, b.tx, b.ty); }
    else { seg(a.tx, a.ty, a.tx, b.ty); seg(a.tx, b.ty, b.tx, b.ty); }
  };
  for (let i = 1; i < nodes.length; i++) carve(nodes[i - 1], nodes[i]);

  // Scenery on open grass — skip route tiles and the ring around stops.
  const decor = new Map<number, 'tree' | 'flower' | 'rock'>();
  const nearNode = (x: number, y: number) =>
    nodes.some((n) => Math.abs(n.tx - x) + Math.abs(n.ty - y) <= 1);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (tiles[i] !== T_GRASS || route.has(i) || nearNode(x, y)) continue;
      const r = rng();
      if (r < 0.07) decor.set(i, 'tree');
      else if (r < 0.15) decor.set(i, 'flower');
      else if (r < 0.17) decor.set(i, 'rock');
    }
  }

  return { tiles, nodes, route, decor };
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
