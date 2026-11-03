// Region map generator — porygion's idea (seeded island, banded stops,
// Manhattan routes) kept simple: one wobbling island of grass ringed by
// sand and sea, a StS-style tree of stops climbing south→north, scenery
// sprinkled on the open land. Rows read as triplets — fork(2) → fan(3) →
// gym(1) — and the map view scrolls one triplet at a time.
import { mulberry32 } from '../core/rng';
import { gracidea } from '../core/assets';
import { TOTAL_STAGES, TRAINER_TYPES } from './data';
import type { PokeType } from './types';

export const MAP_W = 16;
// 5-tile row gaps + generous margins — the climb scrolls through a
// ~20-row viewport instead of showing the whole island at once
export const MAP_H = 58;
const ROW_GAP = 5;

export const T_WATER = 0;
export const T_SAND = 1;
export const T_GRASS = 2;

export type NodeKind = 'start' | 'wild' | 'trainer' | 'elite' | 'chest' | 'rest' | 'mart' | 'event' | 'gym' | 'secret';
export interface MapNode {
  tx: number;
  ty: number;
  kind: NodeKind;
  row: number; // climb depth 0..8 = stages; -1 = the home start marker
  links: number[]; // indices into nodes[] — the stops you can pick next
  ttype?: PokeType; // trainer stops: the mono-type squad waiting there; gyms: the leader's type on the sign
}
export interface RegionMap {
  tiles: Uint8Array; // MAP_W*MAP_H — T_*
  nodes: MapNode[]; // every stop on the tree — nodes[0] is the southern start
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

// Fixed-lane tree: fork rows field 2 stops, fan rows 3, gyms are forced
// singles every 3rd row — so the graph is a clean branching tree.

export function genRegion(seed: number): RegionMap {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const cx = (MAP_W - 1) / 2, cy = (MAP_H - 1) / 2;
  const ns = seed % 977; // the coastline bites differently every climb
  // main island — two noise octaves make the coastline bite into bays
  // and capes instead of a smooth blob
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / (MAP_W / 2), dy = (y - cy) / (MAP_H / 2);
      const wobble = (vn(x / 3.2, y / 3.2, ns) - 0.5) * 0.55 + (vn(x / 1.6, y / 1.6, ns + 1) - 0.5) * 0.15;
      tiles[y * MAP_W + x] = dx * dx + dy * dy < 0.76 + wobble ? T_GRASS : T_WATER;
    }
  }
  // inland ponds — a couple of small blobs make it read as terrain, not a
  // disc; center must sit on grass so the pond actually shows
  const ponds = 2 + Math.floor(rng() * 3);
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
  // one roll picks the island's signature: a big lake, a forest mass, a
  // rock ridge, a flower field — or none. Terrain landmarks paint here so
  // the beach ring sands their shores; decor landmarks wait for the
  // routes so paths stay clear
  const landmarkRoll = rng();
  const landmark =
    landmarkRoll < 0.18 ? 'lake'
    : landmarkRoll < 0.38 ? 'forest'
    : landmarkRoll < 0.55 ? 'ridge'
    : landmarkRoll < 0.75 ? 'meadow'
    : null;
  if (landmark === 'lake') {
    let lx = cx, ly = cy, tries = 0;
    do {
      lx = 3 + Math.floor(rng() * (MAP_W - 6));
      ly = 5 + Math.floor(rng() * (MAP_H - 14));
    } while (tiles[ly * MAP_W + lx] !== T_GRASS && ++tries < 30);
    if (tries < 30) {
      const lr = 3 + rng() * 1.2;
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          if (tiles[i] === T_GRASS && (x - lx) ** 2 + (y - ly) ** 2 < lr * lr) tiles[i] = T_WATER;
        }
      }
    }
  }
  // sometimes a tiny islet offshore — a sand speck or a little cluster
  if (rng() < 0.5) {
    const ix = rng() < 0.5 ? 1 + Math.floor(rng() * 3) : MAP_W - 4 + Math.floor(rng() * 3);
    const iy = 2 + Math.floor(rng() * (MAP_H - 4));
    const n = 1 + Math.floor(rng() * 3);
    for (let t = 0; t < n; t++) {
      const x = ix + Math.floor(rng() * 3) - 1, y = iy + Math.floor(rng() * 3) - 1;
      if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tiles[y * MAP_W + x] === T_WATER) tiles[y * MAP_W + x] = T_SAND;
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
  // dirt patches inland — dry clearings and worn ground away from the
  // shore; painted after the beach ring so they can't widen it
  for (let p = 0, n = Math.floor(rng() * 3); p < n; p++) {
    const dx = 2 + Math.floor(rng() * (MAP_W - 4)), dy = 3 + Math.floor(rng() * (MAP_H - 6));
    const dr = 0.9 + rng() * 1.1;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x;
        if (tiles[i] === T_GRASS && (x - dx) ** 2 + (y - dy) ** 2 < dr * dr) tiles[i] = T_SAND;
      }
    }
  }
  const land = (x: number, y: number) => x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tiles[y * MAP_W + x] === T_GRASS;

  // Stops: HOME (row -1, where the draft happened — no fight) then a fixed
  // tree south→north — each triplet is fork(2) → fan(3) → gym(1). r%3==0
  // rows are two battle doors, r%3==1 rows fan three of the four utility
  // kinds (chest/rest/mart/?), r%3==2 converges on a lone gym. Lanes never
  // jitter — the tree shape is the same on every seed.
  const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const nodes: MapNode[] = [];
  // the coastline can leave a lane in the sea — stamp a little grass
  // clearing under every stop so nothing stands on water
  const stop = (tx: number, ty: number, kind: NodeKind, row: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (!dx || !dy) tiles[(ty + dy) * MAP_W + tx + dx] = T_GRASS;
    nodes.push({
      tx,
      ty,
      kind,
      row,
      links: [],
      ...(kind === 'trainer' || kind === 'elite' ? { ttype: TRAINER_TYPES[Math.floor(rng() * TRAINER_TYPES.length)] } : {}),
    });
  };
  // HOME: the starter pick — nodes[0] so the climb starts standing on it,
  // one row below stage 1's fork. It never hosts a wave. Two rows up
  // from the island's edge so the cottage clears the frame's fade.
  stop(Math.round(cx), MAP_H - 4, 'start', -1);
  // HOME's yard — the cottage draws on the tiles above the stop, so the
  // clearing needs to be a real pad, not the usual door-tile cross
  for (let dy = -3; dy <= 0; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.round(cx) + dx, y = MAP_H - 4 + dy;
      if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) tiles[y * MAP_W + x] = T_GRASS;
    }
  for (let r = 0; r < TOTAL_STAGES; r++) {
    const ty = MAP_H - 2 - (r + 1) * ROW_GAP;
    // utility rows field 3 stops — mostly services, but ~45% of the time a
    // fight slips into the pool and a service stays home; rest is the
    // rarest kind now (one is guaranteed across the whole climb, not halves)
    const kinds: NodeKind[] =
      r % 3 === 2 ? ['gym']
      : r % 3 === 1
        ? shuffle<NodeKind>(
            rng() < 0.55 ? ['chest', 'rest', 'mart', 'event'] : ['chest', 'mart', 'event', rng() < 0.5 ? 'wild' : 'trainer'],
          ).slice(0, 3)
        : shuffle<NodeKind>(rng() < 0.35 ? ['wild', 'elite'] : ['wild', 'trainer']);
    const xs = kinds.length === 1 ? [0.5] : kinds.length === 3 ? [0.16, 0.5, 0.84] : [0.28, 0.72];
    kinds.forEach((kind, k) => stop(Math.round((xs[k] + (rng() - 0.5) * 0.12) * (MAP_W - 1)), ty, kind, r));
  }

  // StS-style facility guarantees (pokelike's rule): each half of the
  // climb always offers a ? stop and a mart. Donors are utility-row
  // stops only — battle rows keep their fight, gyms are untouchable.
  const convert = (lo: number, hi: number, kind: NodeKind) => {
    const band = nodes.filter((n) => n.row >= lo && n.row <= hi && n.row % 3 === 1);
    if (band.some((n) => n.kind === kind)) return;
    // never eat a half's last rest, mart or ? — that's a guarantee, not a donor
    const pool = band.filter(
      (n) =>
        (n.kind !== 'rest' && n.kind !== 'event' && n.kind !== 'mart') ||
        band.filter((m) => m.kind === n.kind).length > 1,
    );
    if (pool.length) pool[Math.floor(rng() * pool.length)].kind = kind;
  };
  // healing is precious, not routine — one rest across the whole climb.
  // It plants first: its donors are picked climb-wide, so a rest placed
  // late could eat a half's only mart; placed early it's a protected
  // singleton in whichever half it lands in
  convert(1, 7, 'rest');
  for (const [lo, hi] of [[1, 4], [5, 7]] as const) {
    convert(lo, hi, 'event');
    convert(lo, hi, 'mart');
  }
  // elites can't roll extinct — ~27% of islands had none. Promote a wild
  // fork stop; the row's lane count doesn't move so the tree is untouched
  if (!nodes.some((n) => n.kind === 'elite')) {
    const wilds = nodes.filter((n) => n.kind === 'wild' && n.row % 3 === 0);
    const w = wilds[Math.floor(rng() * wilds.length)];
    if (w) {
      w.kind = 'elite';
      w.ttype = TRAINER_TYPES[Math.floor(rng() * TRAINER_TYPES.length)];
    }
  }

  // StS tree edges — lane order is fixed, so the graph is deterministic:
  // each battle door opens its own side of the fan + center (2→3), every
  // fan lane converges on the gym (3→1), and the gym re-opens both battle
  // doors (1→2). An early door can still lock you out of a later reward —
  // that's the routing tension — but every stop stays reachable.
  const idxOf = (n: MapNode) => nodes.indexOf(n);
  for (let r = 0; r < TOTAL_STAGES - 1; r++) {
    const from = nodes.filter((n) => n.row === r);
    const to = nodes.filter((n) => n.row === r + 1);
    for (const [i, a] of from.entries()) {
      for (const b of from.length === 1 || to.length === 1 ? to : to.slice(i, i + 2))
        a.links.push(idxOf(b));
      // a stray cross-route ~1 in 5 — most climbs share the lattice, some zig
      if (from.length > 1 && to.length > 1 && rng() < 0.2) {
        const cross = idxOf(to[to.length - 1 - i]);
        if (!a.links.includes(cross)) a.links.push(cross);
      }
    }
  }
  // HOME feeds stage 1's whole fork — the first step is the only free one
  nodes[0].links = nodes.filter((n) => n.row === 0).map(idxOf);

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
    nodes.some((n) =>
      n.kind === 'start'
        ? Math.abs(n.tx - x) <= 1 && y - n.ty >= -3 && y - n.ty <= 1 // the yard pad
        : Math.abs(n.tx - x) + Math.abs(n.ty - y) <= 1,
    );
  // grass clearings — a couple of seeded glades stay open so the island
  // isn't wall-to-wall dressing; routes may cross, decor keeps out
  const clearings: { x: number; y: number; r: number }[] = [];
  for (let c = 0, n = 1 + Math.floor(rng() * 2); c < n; c++) {
    clearings.push({
      x: 2 + Math.floor(rng() * (MAP_W - 4)),
      y: 2 + Math.floor(rng() * (MAP_H - 4)),
      r: 1.6 + rng() * 1.2,
    });
  }
  const inClearing = (x: number, y: number) =>
    clearings.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r);
  const free = (x: number, y: number) =>
    land(x, y) && !route.has(y * MAP_W + x) && !nearNode(x, y) && !decor.has(y * MAP_W + x) && !inClearing(x, y);
  // the landmark's decor half — same roll as the terrain pass, so a seed
  // always grows the same signature. Claims its space before the sprinkle
  if (landmark && landmark !== 'lake') {
    let mx = cx, my = cy, tries = 0;
    do {
      mx = 2 + Math.floor(rng() * (MAP_W - 4));
      my = 3 + Math.floor(rng() * (MAP_H - 6));
    } while (!land(mx, my) && ++tries < 30);
    if (tries < 30) {
      if (landmark === 'forest') {
        const r = 2.6 + rng() * 1.2;
        for (let y = 0; y < MAP_H; y++)
          for (let x = 0; x < MAP_W; x++)
            if ((x - mx) ** 2 + (y - my) ** 2 < r * r && free(x, y) && rng() < 0.65) decor.set(y * MAP_W + x, 'tree');
      } else if (landmark === 'ridge') {
        // a wobbly spine of outcrops — breaks around routes and stops
        const [sx, sy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]][
          Math.floor(rng() * 8)
        ];
        let rx = mx, ry = my;
        for (let s = 0; s < 12; s++) {
          if (free(rx, ry)) decor.set(ry * MAP_W + rx, 'rock');
          if (rng() < 0.45 && free(rx - sy, ry + sx)) decor.set((ry + sx) * MAP_W + rx - sy, 'rock');
          rx += sx;
          ry += sy;
          if (rx < 1 || rx > MAP_W - 2 || ry < 1 || ry > MAP_H - 2) break;
        }
      } else {
        // meadow — a flower field worth walking around
        const r = 2.4 + rng() * 1.2;
        for (let y = 0; y < MAP_H; y++)
          for (let x = 0; x < MAP_W; x++)
            if ((x - mx) ** 2 + (y - my) ** 2 < r * r && free(x, y) && rng() < 0.55) decor.set(y * MAP_W + x, 'flower');
      }
    }
  }
  // tree clumps — mostly 2-4 trees, the odd grove of 5-8; reads as
  // forest, not polka dots
  const clumps = 8 + Math.floor(rng() * 7);
  for (let c = 0; c < clumps; c++) {
    const tx = 1 + Math.floor(rng() * (MAP_W - 2)), ty = 1 + Math.floor(rng() * (MAP_H - 2));
    const n = rng() < 0.22 ? 5 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 3);
    const reach = n > 4 ? 2 : 1;
    for (let t = 0; t < n; t++) {
      const x = tx + Math.floor(rng() * (reach * 2 + 1)) - reach, y = ty + Math.floor(rng() * (reach * 2 + 1)) - reach;
      if (free(x, y)) decor.set(y * MAP_W + x, 'tree');
    }
  }
  // boulder outcrops — the craggy patch overworld maps get from cliffs;
  // retry until a handful land on open grass
  for (let attempt = 0, placed = 0; attempt < 20 && placed < 5; attempt++) {
    const rx = 2 + Math.floor(rng() * (MAP_W - 4)), ry = 2 + Math.floor(rng() * (MAP_H - 4));
    for (let t = 0; t < 4; t++) {
      const x = rx + Math.floor(rng() * 3) - 1, y = ry + Math.floor(rng() * 3) - 1;
      if (free(x, y)) { decor.set(y * MAP_W + x, 'rock'); placed++; }
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (tiles[i] !== T_GRASS || route.has(i) || nearNode(x, y) || decor.has(i) || inClearing(x, y)) continue;
      const r = rng();
      if (r < 0.04) decor.set(i, 'tree');
      else if (r < 0.12) decor.set(i, 'flower');
    }
  }

  return { tiles, nodes, route, decor };
}

// Walkable tiles between two linked stops — BFS over the carved route so
// the overworld walk follows the drawn path, not a straight line.
export function routePath(region: RegionMap, a: MapNode, b: MapNode): { x: number; y: number }[] {
  const start = a.ty * MAP_W + a.tx;
  const goal = b.ty * MAP_W + b.tx;
  const prev = new Int16Array(MAP_W * MAP_H).fill(-1);
  prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length && prev[goal] === -1; h++) {
    const i = q[h];
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (prev[ni] !== -1 || (!region.route.has(ni) && ni !== goal)) continue;
      prev[ni] = i;
      q.push(ni);
    }
  }
  if (prev[goal] === -1) return [{ x: a.tx, y: a.ty }, { x: b.tx, y: b.ty }];
  const out = [];
  for (let i = goal; i !== start; i = prev[i]) out.push({ x: i % MAP_W, y: (i / MAP_W) | 0 });
  out.push({ x: a.tx, y: a.ty });
  return out.reverse();
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
      // g<150 (not 120): lossy webp bleeds magenta into sprite edges —
      // dirty pinks like (220,140,220) still key while true lavenders
      // (r-g<50) stay safe
      if (r > 140 && b > 110 && gg < 150 && r - gg > 50 && b - gg > 40) d[i + 3] = 0;
    }
    g.putImageData(id, 0, 0);
    tileCache.set(k, c);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, dx, dy, dw, dh);
  ctx.restore();
}
