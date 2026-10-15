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

export type NodeKind = 'start' | 'wild' | 'gym' | 'rest' | 'item' | 'shrine' | 'elite' | 'mart' | 'mystery';
export interface MapNode {
  tx: number;
  ty: number;
  kind: NodeKind;
  row: number; // climb depth 0..8 — gyms forced on rows 2/5/8
  links: number[]; // indices into nodes[] — the stops you can pick next
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

// Branching stops per row — gyms are forced singles every 3rd row; the
// rest offer 2-3 linked choices (wild/elite/rest/item/shrine) StS-style.

export function genRegion(seed: number): RegionMap {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const cx = (MAP_W - 1) / 2, cy = (MAP_H - 1) / 2;
  // main island — two noise octaves make the coastline bite into bays
  // and capes instead of a smooth blob
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / (MAP_W / 2), dy = (y - cy) / (MAP_H / 2);
      const wobble = (vn(x / 3.2, y / 3.2, 0) - 0.5) * 0.55 + (vn(x / 1.6, y / 1.6, 1) - 0.5) * 0.15;
      tiles[y * MAP_W + x] = dx * dx + dy * dy < 0.76 + wobble ? T_GRASS : T_WATER;
    }
  }
  // inland ponds — a couple of small blobs make it read as terrain, not a
  // disc; center must sit on grass so the pond actually shows
  const ponds = 1 + Math.floor(rng() * 2);
  for (let p = 0; p < ponds; p++) {
    let px = cx, py = cy, tries = 0;
    do {
      px = 3 + Math.floor(rng() * (MAP_W - 6));
      py = 4 + Math.floor(rng() * (MAP_H - 8));
    } while (tiles[Math.round(py) * MAP_W + Math.round(px)] !== T_GRASS && ++tries < 20);
    if (tries >= 20) continue;
    const pr = 1.2 + rng() * 1.4;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        if (tiles[i] === T_GRASS && (x - px) ** 2 + (y - py) ** 2 < pr * pr) tiles[i] = T_WATER;
      }
    }
  }
  // sometimes a tiny islet offshore — pure charm, costs nothing
  if (rng() < 0.5) {
    const ix = rng() < 0.5 ? 1 + Math.floor(rng() * 3) : MAP_W - 4 + Math.floor(rng() * 3);
    const iy = 2 + Math.floor(rng() * (MAP_H - 4));
    if (iy >= 0 && iy < MAP_H && ix >= 0 && ix < MAP_W) tiles[iy * MAP_W + ix] = T_SAND;
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

  // Stops: branching rows south→north. Row 0 is the single start, every
  // 3rd row is a lone gym; the rest get 2-3 stops spread across the band.
  const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const nodes: MapNode[] = [];
  for (let r = 0; r < TOTAL_STAGES; r++) {
    const band = r / (TOTAL_STAGES - 1);
    const ty = Math.round(MAP_H - 3 - band * (MAP_H - 6));
    let kinds: NodeKind[];
    if (r === 0) kinds = ['start'];
    else if ((r + 1) % 3 === 0) kinds = ['gym'];
    else {
      // a real fork: wild is always one door, the other(s) get flavored
      const extras = shuffle<NodeKind>(['elite', 'rest', 'item', 'shrine', 'mart', 'mystery']);
      kinds = rng() < 0.3 ? shuffle(['wild', 'elite', extras[0]]) : shuffle(['wild', extras[0]]);
    }
    const xs = kinds.length === 1 ? [0.5] : kinds.length === 2 ? [0.3, 0.7] : [0.18, 0.5, 0.82];
    kinds.forEach((kind, k) => {
      let tx = Math.round(xs[k] * (MAP_W - 1) + (rng() - 0.5) * 1.4);
      let guard = 0;
      while (
        (!land(tx, ty) || nodes.some((o) => o.row === r && Math.abs(o.tx - tx) < 3)) &&
        tx !== Math.round(cx) &&
        guard++ < 10
      ) tx += Math.sign(cx - tx) || 1;
      nodes.push({ tx, ty, kind, row: r, links: [] });
    });
  }

  // forward links: each stop reaches the 1-2 nearest stops in the next row,
  // and every next-row stop is reachable from somewhere — no dead ends
  const idxOf = (n: MapNode) => nodes.indexOf(n);
  for (let r = 0; r < TOTAL_STAGES - 1; r++) {
    const from = nodes.filter((n) => n.row === r);
    const to = nodes.filter((n) => n.row === r + 1);
    for (const a of from) {
      const sorted = [...to].sort((x, y) => Math.abs(x.tx - a.tx) - Math.abs(y.tx - a.tx));
      a.links.push(idxOf(sorted[0]));
      if (sorted.length > 1 && rng() < 0.45) a.links.push(idxOf(sorted[1]));
    }
    for (const b of to) {
      if (!from.some((a) => a.links.includes(idxOf(b)))) {
        const nearest = [...from].sort((x, y) => Math.abs(x.tx - b.tx) - Math.abs(y.tx - b.tx))[0];
        nearest.links.push(idxOf(b));
      }
    }
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
  for (const a of nodes) for (const li of a.links) carve(a, nodes[li]);

  // Scenery on open grass — trees clump into little woods, boulders into
  // one rocky outcrop, flowers scatter between them. Route tiles and the
  // ring around stops stay clear.
  const decor = new Map<number, 'tree' | 'flower' | 'rock'>();
  const nearNode = (x: number, y: number) =>
    nodes.some((n) => Math.abs(n.tx - x) + Math.abs(n.ty - y) <= 1);
  const free = (x: number, y: number) =>
    land(x, y) && !route.has(y * MAP_W + x) && !nearNode(x, y) && !decor.has(y * MAP_W + x);
  // 3-5 tree clumps of 2-4 trees — reads as forest, not polka dots
  const clumps = 3 + Math.floor(rng() * 3);
  for (let c = 0; c < clumps; c++) {
    const tx = 1 + Math.floor(rng() * (MAP_W - 2)), ty = 1 + Math.floor(rng() * (MAP_H - 2));
    const n = 2 + Math.floor(rng() * 3);
    for (let t = 0; t < n; t++) {
      const x = tx + Math.floor(rng() * 3) - 1, y = ty + Math.floor(rng() * 3) - 1;
      if (free(x, y)) decor.set(y * MAP_W + x, 'tree');
    }
  }
  // one boulder outcrop — the craggy patch overworld maps get from cliffs;
  // retry until at least a couple land on open grass
  for (let attempt = 0, placed = 0; attempt < 12 && placed < 2; attempt++) {
    const rx = 2 + Math.floor(rng() * (MAP_W - 4)), ry = 2 + Math.floor(rng() * (MAP_H - 4));
    for (let t = 0; t < 4; t++) {
      const x = rx + Math.floor(rng() * 3) - 1, y = ry + Math.floor(rng() * 3) - 1;
      if (free(x, y)) { decor.set(y * MAP_W + x, 'rock'); placed++; }
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (tiles[i] !== T_GRASS || route.has(i) || nearNode(x, y) || decor.has(i)) continue;
      const r = rng();
      if (r < 0.04) decor.set(i, 'tree');
      else if (r < 0.12) decor.set(i, 'flower');
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
