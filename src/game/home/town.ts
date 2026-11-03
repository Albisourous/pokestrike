import { drawMon, drawNpc, gracidea, loadSprite } from '../../core/assets';
import { hash } from '../bg';
import { PULLABLE, tierOf, type SpeciesDef } from '../data';
import { drawTile } from '../map';
import {
  ACHIEVEMENTS,
  LAB_UPGRADES,
  best,
  board,
  labLevels,
  settings,
  unlockedAch,
} from '../meta';
import {
  FLOWER_PK,
  FLOWER_PINK,
  FLOWER_WILD,
  FLOWER_YB,
  FX_PETAL,
  ROCK_SMALL,
  TREE_OLIVE,
  TREE_PINE,
  TREE_ROUND,
  TREE_TEAL,
  type TileRect,
} from '../maptiles';
import { daySeed, taskResetsIn } from '../tasks';
import { INK, INK_SOFT, PAPER, fontB, rr, uiWindow } from '../ui';

const W = 540;
const H = 960;
const S = 1.5;
const TOWER_S = 1.25;
type Rect = { x: number; y: number; w: number; h: number };

const LAB_SPRITE: TileRect = [397, 69, 90, 76];
const HALL_SPRITE: TileRect = [684, 93, 90, 87];
const TOWER_BODY_SPRITE: TileRect = [1441, 556, 87, 98]; // full pillar base — dome cap at 556, base ends 654 (maptiles TILE_TOWER)
const TOWER_BODY_H = TOWER_BODY_SPRITE[3] * TOWER_S;
// the arch between the base pillars is the entrance — no bolted-on door slab;
// the walk-up stub runs from the pillar base down to the south road
const TOWER_H = TOWER_BODY_H + 36;
const CAFE_ROOF: TileRect = [865, 327, 28, 28];
const CAFE_CAP: TileRect = [863, 355, 32, 7];
const CAFE_FRONT: TileRect = [863, 362, 110, 36];
const LAB = { x: 80, y: 147, w: LAB_SPRITE[2] * S, h: LAB_SPRITE[3] * S };
const HALL = { x: 314.5, y: 130.5, w: HALL_SPRITE[2] * S, h: HALL_SPRITE[3] * S };
const BOARD = { x: 78, y: 474.5, w: CAFE_FRONT[2] * S, h: (CAFE_ROOF[3] + CAFE_CAP[3] + CAFE_FRONT[3]) * S };
const TOWER = { x: 315, y: 581 - TOWER_H, w: TOWER_BODY_SPRITE[2] * TOWER_S, h: TOWER_BODY_H };
const TOWER_DOOR_X = TOWER.x + TOWER_BODY_SPRITE[2] * TOWER_S / 2;
const LAB_PLATE = { x: 55, y: 322, w: 120, h: 46 };
const HALL_PLATE = { x: 322, y: 322, w: 120, h: 46 };
const BOARD_PLATE = { x: 101, y: 641, w: 120, h: 46 };
const TOWER_PLATE = { x: TOWER_DOOR_X - 60, y: 641, w: 120, h: 46 };

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export const TOWN_LOTS: Rect[] = [LAB, HALL, BOARD, TOWER];
export const TOWN_DOORS = {
  lab: LAB.x + (420 - LAB_SPRITE[0]) * S,
  hall: HALL.x + (729 - HALL_SPRITE[0]) * S,
  jobBoard: BOARD.x + (918 - CAFE_FRONT[0]) * S,
  trophies: TOWER_DOOR_X,
};
export const TOWN_PLATES = {
  lab: LAB_PLATE,
  hall: HALL_PLATE,
  jobBoard: BOARD_PLATE,
  trophies: TOWER_PLATE,
};
export const LAB_BTN = union(LAB, LAB_PLATE);
export const BOARD_BTN = union(HALL, HALL_PLATE);
export const TASKS_BTN = union(BOARD, BOARD_PLATE);
export const ACH_BTN = union(TOWER, TOWER_PLATE);
export const HALL_BTN = BOARD_BTN;

export interface TownStroll {
  id: string;
  seed: number;
  hx: number;
  hy: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  speed: number;
  h: number;
  noRight?: boolean;
}

export const TOWN_FOLK: TownStroll[] = [
  { id: 'scientist', seed: 3.1, hx: 126, hy: 282, x0: 60, y0: 276, x1: 200, y1: 288, speed: 26, h: 30 },
  { id: 'gentleman', seed: 5.3, hx: 404, hy: 282, x0: 330, y0: 276, x1: 480, y1: 288, speed: 20, h: 30 },
  { id: 'lass', seed: 7.7, hx: 128, hy: 601, x0: 60, y0: 595, x1: 210, y1: 607, speed: 30, h: 30 },
  { id: 'youngster', seed: 8.8, hx: 404, hy: 601, x0: 330, y0: 595, x1: 480, y1: 607, speed: 55, h: 30 },
  { id: 'shopkeeper_m', seed: 9.9, hx: 345, hy: 695, x0: 320, y0: 690, x1: 370, y1: 700, speed: 26, h: 30 },
  { id: 'norman', seed: 4.2, hx: 190, hy: 746, x0: 170, y0: 742, x1: 210, y1: 750, speed: 24, h: 30, noRight: true },
];

// the day's strays: two small pullables seeded like the other dailies —
// one haunting the fountain plaza's south rim, one striding the south
// street. Beats reuse the villager shape so they merge into the same
// y-sorted pass; they stay clear of lots and plates by the same margin.
const MON_BEATS: TownStroll[] = [
  { id: 'stray', seed: 12.3, hx: 270, hy: 764, x0: 172, y0: 752, x1: 388, y1: 772, speed: 22, h: 34 },
  { id: 'stray', seed: 15.7, hx: 410, hy: 604, x0: 64, y0: 600, x1: 476, y1: 606, speed: 30, h: 34 },
];
const STRAYS = PULLABLE.filter((d) => tierOf(d) === 0);
const strayPick = (i: number) => STRAYS[Math.floor(hash(daySeed() * 1.13 + i * 5.77) * STRAYS.length)];

// OS reduced-motion seed (same probe as bg/evolve/fame): the strays hold
// their home spots instead of roaming.
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type NpcDir = 'down' | 'up' | 'left' | 'right';

// the shared waypoint walk: home for leg 0, then seeded waypoints inside
// the beat box on manhattan legs at `speed`, a standing beat between legs.
// townStrollAt dresses it in npc frames; the strays wear mon fronts.
function walkAt(w: TownStroll, t: number): { x: number; y: number; dir: NpcDir; walking: boolean } {
  const legT = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) / w.speed + 1.5;
  const k = Math.floor(t / legT);
  let tau = t - k * legT;
  const pt = (j: number): [number, number] => (j <= 0
    ? [w.hx, w.hy]
    : [w.x0 + hash(w.seed + j * 13.7) * (w.x1 - w.x0), w.y0 + hash(w.seed + j * 7.3 + 4) * (w.y1 - w.y0)]);
  const [ax, ay] = pt(k), [bx, by] = pt(k + 1);
  const segs: [number, number][] = hash(w.seed + k * 3.1 + 9) < 0.5 ? [[bx - ax, 0], [0, by - ay]] : [[0, by - ay], [bx - ax, 0]];
  let x = ax, y = ay, dir: NpcDir = 'down', walking = false;
  for (const [dx, dy] of segs) {
    const dur = Math.abs(dx || dy) / w.speed;
    if (tau < dur) {
      const u = tau / dur;
      x += dx * u; y += dy * u;
      dir = dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      walking = true;
      break;
    }
    tau -= dur;
    x += dx; y += dy;
    if (dx || dy) dir = dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  return { x, y, dir, walking };
}

export function townStrollAt(w: TownStroll, t: number): { x: number; y: number; frame: string; flip: boolean } {
  const { x, y, dir, walking } = walkAt(w, t);
  const flip = !!w.noRight && dir === 'right';
  const fr = walking ? [0, 1, 0, 2][Math.floor(t * 6) % 4] : 0;
  return { x, y, frame: `${w.id}_${flip ? 'left' : dir}_${fr}`, flip };
}

const GRASS: TileRect = [52, 417, 16, 16];
const DIRT: TileRect = [82, 407, 36, 36]; // tan path interior — tiled flat, no pebble border
const PAVE: TileRect = [251, 398, 32, 44]; // plaza's gray flagstone interior
const SOIL: TileRect = [184, 392, 70, 55]; // ragged dirt bed under the flower rows
const SIGN: TileRect = [1657, 18, 17, 20];
const FOUNTAIN: TileRect = [1984, 395, 49, 60];
const TREE_TYPES = [TREE_ROUND, TREE_PINE, TREE_TEAL] as const;
// street stubs run off both ends under the tree columns, so roads read as
// continuing into the woods instead of ending on lawn
const STREETS: Rect[] = [
  { x: 24, y: 276, w: 492, h: 42 },
  { x: 24, y: 595, w: 492, h: 42 },
  { x: 255, y: 276, w: 44, h: 399 }, // main street: north road → plaza gate, through the south road
];
const PLAZA: Rect = { x: 160, y: 675, w: 240, h: 105 };

let townBake: HTMLCanvasElement | null = null;
let keyedFountain: HTMLCanvasElement | null = null;

export function tileFill(ctx: CanvasRenderingContext2D, r: Rect, tile: TileRect, scale: number) {
  const size = tile[2] * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const x0 = Math.floor(r.x / size) * size;
  const y0 = Math.floor(r.y / size) * size;
  for (let y = y0; y < r.y + r.h; y += size)
    for (let x = x0; x < r.x + r.w; x += size)
      drawTile(ctx, tile, x, y, size, size);
  ctx.restore();
}

// flat dirt fill — town streets and the rest-stop path share the same
// tan interior tile, no pebble border
export function dirtFill(ctx: CanvasRenderingContext2D, r: Rect) {
  tileFill(ctx, r, DIRT, 2);
}

// one clipped pass fills the whole street network: junctions share the
// tile grid, so crossings stay seamless — no per-rect borders to double-draw
function streetClip(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (const r of STREETS) ctx.rect(r.x, r.y, r.w, r.h);
  for (const lot of [LAB, HALL, BOARD, TOWER]) {
    const doorX = lot === LAB ? TOWN_DOORS.lab : lot === HALL ? TOWN_DOORS.hall : lot === BOARD ? TOWN_DOORS.jobBoard : TOWN_DOORS.trophies;
    const streetY = lot === LAB || lot === HALL ? 276 : 595;
    ctx.rect(doorX - 21, lot.y + lot.h, 42, streetY - lot.y - lot.h);
  }
  ctx.clip();
}

function drawForest(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row < 3; row++) {
    const y = 48 + row * 30;
    for (let col = -1; col < 13; col++) {
      const x = col * 46 + (row % 2 ? 23 : 0);
      const tree = TREE_TYPES[(col + row * 2 + 3) % TREE_TYPES.length];
      drawTile(ctx, tree, x, y, tree[2] * S, tree[3] * S);
    }
  }
  for (let row = 0, y = 132; y < 800; row++, y += 32) {
    const left = TREE_TYPES[row % TREE_TYPES.length];
    const right = TREE_TYPES[(row + 1) % TREE_TYPES.length];
    drawTile(ctx, left, -8 + (row % 2 ? 8 : 0), y, left[2] * S, left[3] * S);
    drawTile(ctx, right, 491 - (row % 2 ? 8 : 0), y, right[2] * S, right[3] * S);
  }
  for (let row = 0; row < 3; row++) {
    const y = 780 + row * 30;
    for (let col = -1; col < 13; col++) {
      const x = col * 46 + (row % 2 ? 23 : 0);
      const tree = TREE_TYPES[(col + row + 4) % TREE_TYPES.length];
      drawTile(ctx, tree, x, y, tree[2] * S, tree[3] * S);
    }
  }
}

function drawPathNetwork(ctx: CanvasRenderingContext2D) {
  ctx.save();
  streetClip(ctx);
  dirtFill(ctx, { x: 0, y: 0, w: W, h: H });
  ctx.restore();
  ctx.save();
  rr(ctx, PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h, 14);
  ctx.clip();
  tileFill(ctx, PLAZA, PAVE, 2);
  ctx.restore();
  // a thin stone rim keeps the flagstones from bleeding into the lawn
  ctx.strokeStyle = 'rgba(52,56,76,0.55)';
  ctx.lineWidth = 3;
  rr(ctx, PLAZA.x + 1.5, PLAZA.y + 1.5, PLAZA.w - 3, PLAZA.h - 3, 13);
  ctx.stroke();
}

function drawBuildingShadow(ctx: CanvasRenderingContext2D, lot: Rect) {
  ctx.fillStyle = 'rgba(32,48,28,0.24)';
  ctx.beginPath();
  ctx.ellipse(lot.x + lot.w / 2, lot.y + lot.h - 2, lot.w * 0.43, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(ctx: CanvasRenderingContext2D, lot: Rect, sprite: TileRect) {
  drawBuildingShadow(ctx, lot);
  drawTile(ctx, sprite, lot.x, lot.y, lot.w, lot.h);
}

function drawTower(ctx: CanvasRenderingContext2D) {
  drawBuildingShadow(ctx, TOWER);
  drawTile(ctx, TOWER_BODY_SPRITE, TOWER.x, TOWER.y, TOWER.w, TOWER.h);
}

function drawCafe(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(32,48,28,0.24)';
  ctx.beginPath();
  ctx.ellipse(BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h - 2, BOARD.w * 0.43, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const roofW = CAFE_ROOF[2] * S;
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOARD.x, BOARD.y, BOARD.w, CAFE_ROOF[3] * S);
  ctx.clip();
  for (let x = BOARD.x; x < BOARD.x + BOARD.w; x += roofW)
    drawTile(ctx, CAFE_ROOF, x, BOARD.y, roofW, CAFE_ROOF[3] * S);
  ctx.restore();
  const capY = BOARD.y + CAFE_ROOF[3] * S;
  const capW = CAFE_CAP[2] * S;
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOARD.x, capY, BOARD.w, CAFE_CAP[3] * S);
  ctx.clip();
  for (let x = BOARD.x; x < BOARD.x + BOARD.w; x += capW)
    drawTile(ctx, CAFE_CAP, x, capY, capW, CAFE_CAP[3] * S);
  ctx.restore();
  drawTile(ctx, CAFE_FRONT, BOARD.x, BOARD.y + (CAFE_ROOF[3] + CAFE_CAP[3]) * S, BOARD.w, CAFE_FRONT[3] * S);
}

// flower beds: a ragged soil patch, three dense rows of small tufts packed
// tight so the rows overlap, a wild cluster in back, and a pink bush closing
// the end that faces the plaza — both beds frame the fountain
const GARDEN_Y = 695;
const GARDEN_W = 110;
const TUFT_S = 1.2;
function drawGarden(ctx: CanvasRenderingContext2D, x: number, mirror: boolean) {
  drawTile(ctx, SOIL, x, GARDEN_Y, GARDEN_W, 62);
  drawTile(ctx, FLOWER_WILD, x + GARDEN_W / 2 - 30, GARDEN_Y - 2, FLOWER_WILD[2] * S, FLOWER_WILD[3] * S);
  const tufts = [FLOWER_YB, FLOWER_PK];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const t = tufts[(row + col + (mirror ? 1 : 0)) % tufts.length];
      drawTile(ctx, t, x + 8 + col * 19, GARDEN_Y + 8 + row * 17, t[2] * TUFT_S, t[3] * TUFT_S);
    }
  }
  drawTile(ctx, FLOWER_PINK, mirror ? x - 4 : x + GARDEN_W - 38, GARDEN_Y + 14, FLOWER_PINK[2] * S, FLOWER_PINK[3] * S);
}

// loose lawn dressing — hand-placed so nothing lands on a street, lot or
// plate; signs keep their shadow ellipses, tufts sit flat on the grass
const LAWN_FLOWERS: [TileRect, number, number][] = [
  [FLOWER_WILD, 232, 195],
  [FLOWER_PINK, 446, 438],
  [FLOWER_PINK, 150, 408],
  [FLOWER_YB, 58, 348],
  [FLOWER_PK, 60, 545],
  [FLOWER_YB, 228, 430],
  [FLOWER_PK, 288, 548],
  [FLOWER_YB, 355, 345],
  [FLOWER_YB, 470, 555],
  [FLOWER_PK, 480, 362],
];
// tufts hugging the street edges soften the razor-straight dirt lines —
// placed off the junction spans so crossings stay clean
const EDGE_TUFTS: [TileRect, number, number][] = [
  [FLOWER_YB, 95, 267],
  [FLOWER_PK, 190, 269],
  [FLOWER_YB, 350, 267],
  [FLOWER_PK, 440, 269],
  [FLOWER_YB, 95, 586],
  [FLOWER_PK, 185, 588],
  [FLOWER_YB, 355, 586],
  [FLOWER_PK, 450, 588],
  [FLOWER_YB, 247, 345],
  [FLOWER_PK, 247, 440],
  [FLOWER_YB, 247, 535],
  [FLOWER_PK, 299, 390],
  [FLOWER_YB, 299, 565],
  [FLOWER_YB, 60, 640],
  [FLOWER_PK, 240, 641],
  [FLOWER_YB, 478, 640],
];
const LAWN_SIGNS = [
  { x: 465, y: 225 },
  { x: 52, y: 478 },
  { x: 459, y: 665 },
];
const LAWN_ROCKS = [
  { x: 62, y: 505 },
  { x: 455, y: 515 },
];

function drawYardProps(ctx: CanvasRenderingContext2D) {
  // standalone trees fill the gaps the forest band leaves inside the village
  drawTile(ctx, TREE_OLIVE, 240, 148, TREE_OLIVE[2] * S, TREE_OLIVE[3] * S);
  drawTile(ctx, TREE_ROUND, 56, 350, TREE_ROUND[2] * S, TREE_ROUND[3] * S);
  for (const [t, x, y] of LAWN_FLOWERS) drawTile(ctx, t, x, y, t[2] * S, t[3] * S);
  for (const [t, x, y] of EDGE_TUFTS) drawTile(ctx, t, x, y, t[2] * S, t[3] * S);
  for (const r of LAWN_ROCKS) drawTile(ctx, ROCK_SMALL, r.x, r.y, ROCK_SMALL[2] * S, ROCK_SMALL[3] * S);
  for (const p of LAWN_SIGNS) {
    const w = SIGN[2] * S, h = SIGN[3] * S;
    ctx.fillStyle = 'rgba(20,28,24,0.24)';
    ctx.beginPath();
    ctx.ellipse(p.x + w / 2, p.y + h - 1, w * 0.34, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    drawTile(ctx, SIGN, p.x, p.y, w, h);
  }
  drawGarden(ctx, 46, false);
  drawGarden(ctx, 386, true);
}

function drawKeyedFountain(atlas: HTMLImageElement): HTMLCanvasElement {
  if (keyedFountain) return keyedFountain;
  const w = FOUNTAIN[2], h = FOUNTAIN[3];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(atlas, FOUNTAIN[0], FOUNTAIN[1], w, h, 0, 0, w, h);
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const paving = (i: number) => {
    const r = d[i], green = d[i + 1], b = d[i + 2];
    return d[i + 3] > 0 && r >= 160 && green >= 150 && b >= 125 &&
      Math.max(r, green, b) - Math.min(r, green, b) < 100;
  };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], green = d[i + 1], b = d[i + 2];
    if (r > 140 && b > 110 && green < 150 && r - green > 50 && b - green > 40) d[i + 3] = 0;
  }
  const palette: number[][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
    const i = (y * w + x) * 4;
    if (paving(i)) palette.push([d[i], d[i + 1], d[i + 2]]);
  }
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const matchesPaving = (i: number) => paving(i) && palette.some(([r, green, b]) =>
    (d[i] - r) ** 2 + (d[i + 1] - green) ** 2 + (d[i + 2] - b) ** 2 <= 3600);
  const seed = (x: number, y: number) => {
    const p = y * w + x, i = p * 4;
    if (!seen[p] && matchesPaving(i)) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { seed(0, y); seed(w - 1, y); }
  while (head < tail) {
    const p = queue[head++], x = p % w, y = (p / w) | 0;
    d[p * 4 + 3] = 0;
    if (x) seed(x - 1, y);
    if (x + 1 < w) seed(x + 1, y);
    if (y) seed(x, y - 1);
    if (y + 1 < h) seed(x, y + 1);
  }
  g.putImageData(image, 0, 0);
  keyedFountain = canvas;
  return canvas;
}

function bakeTown(): HTMLCanvasElement | null {
  const atlas = gracidea();
  if (!atlas?.complete || !atlas.naturalWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  tileFill(ctx, { x: 0, y: 0, w: W, h: H }, GRASS, 2);
  drawPathNetwork(ctx); // streets first — the forest band overhangs their ends
  drawForest(ctx);

  drawBuilding(ctx, LAB, LAB_SPRITE);
  drawBuilding(ctx, HALL, HALL_SPRITE);
  drawCafe(ctx);
  drawTower(ctx);
  drawYardProps(ctx);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(drawKeyedFountain(atlas), 270 - FOUNTAIN[2] * S / 2, 727 - FOUNTAIN[3] * S / 2, FOUNTAIN[2] * S, FOUNTAIN[3] * S);
  return canvas;
}

function fitPlateText(ctx: CanvasRenderingContext2D, text: string, size: number, width: number) {
  let px = size;
  ctx.font = fontB(px);
  while (px > 10 && ctx.measureText(text).width > width) ctx.font = fontB((px -= 0.5));
}

function drawPlate(ctx: CanvasRenderingContext2D, r: Rect, name: string, sub: string, ready = 0) {
  uiWindow(ctx, r, { rad: 7 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitPlateText(ctx, name, 18, r.w - 12);
  ctx.fillStyle = INK;
  ctx.fillText(name, r.x + r.w / 2, r.y + 15);
  fitPlateText(ctx, sub, 14, r.w - 12);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(sub, r.x + r.w / 2, r.y + 34);

  if (ready > 0) {
    const x = r.x + r.w - 5, y = r.y + 5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#e03c34';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = fontB(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAPER;
    ctx.fillText(ready > 9 ? '9+' : `${ready}`, x, y);
  }
}

export function drawTownBody(ctx: CanvasRenderingContext2D, t: number, taskN: number) {
  if (!townBake) townBake = bakeTown();
  if (townBake) ctx.drawImage(townBake, 0, 0);
  else {
    ctx.fillStyle = '#68ad55';
    ctx.fillRect(0, 0, W, H);
  }

  if (settings().mapGlints) {
    for (let i = 0; i < 5; i++) {
      const x = (i * 103 + t * 7) % (W + 20) - 10;
      const y = 184 + (i * 113) % 420 + Math.sin(t * 0.7 + i * 1.8) * 5;
      drawTile(ctx, FX_PETAL, x, y, FX_PETAL[2] * S, FX_PETAL[3] * S);
    }
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2));
    drawTile(ctx, FX_PETAL, 265, 676, FX_PETAL[2] * S, FX_PETAL[3] * S);
    ctx.restore();
  }

  // villagers and the day's strays share one y-sorted pass — whoever is
  // further south draws last
  type Walker =
    | { kind: 'npc'; w: TownStroll; s: ReturnType<typeof townStrollAt> }
    | { kind: 'mon'; w: TownStroll; s: ReturnType<typeof walkAt>; def?: SpeciesDef };
  const walkers: Walker[] = [
    ...TOWN_FOLK.map((w): Walker => ({ kind: 'npc', w, s: townStrollAt(w, t) })),
    ...MON_BEATS.map((w, i): Walker => ({ kind: 'mon', w, s: walkAt(w, REDUCED ? 0 : t), def: strayPick(i) })),
  ].sort((a, b) => a.s.y - b.s.y);
  for (const e of walkers) {
    if (e.kind === 'npc') {
      drawNpc(ctx, e.s.frame, e.s.x, e.s.y, e.w.h, e.s.flip);
      continue;
    }
    if (!e.def) continue;
    const size = e.w.h + 8;
    ctx.fillStyle = 'rgba(32,48,28,0.24)';
    ctx.beginPath();
    ctx.ellipse(e.s.x, e.s.y - 1, size * 0.4, size * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    const hop = e.s.walking && !REDUCED ? Math.abs(Math.sin(t * 8)) * 2.5 : 0;
    ctx.save();
    if (e.s.dir === 'left') {
      ctx.translate(e.s.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-e.s.x, 0);
    }
    try {
      drawMon(ctx, e.def.id, e.s.x, e.s.y - size * 0.42 - hop, size);
    } catch {
      void loadSprite(e.def.id).catch(() => {});
    }
    ctx.restore();
  }

  const levels = labLevels();
  const trained = LAB_UPGRADES.filter((u) => (levels[u.id] ?? 0) > 0).length;
  const record = best();
  const runs = board().length;
  drawPlate(ctx, LAB_PLATE, 'THE LAB', `${trained}/${LAB_UPGRADES.length} TRAINED`);
  drawPlate(ctx, HALL_PLATE, 'HALL OF FAME', record.score
    ? `BEST ${record.score.toLocaleString('en-US')}`
    : `${runs} ${runs === 1 ? 'RUN' : 'RUNS'} LOGGED`);
  drawPlate(ctx, BOARD_PLATE, 'JOB BOARD', taskN > 0 ? `${taskN} READY` : `RESETS ${taskResetsIn('daily')}`, taskN);
  drawPlate(ctx, TOWER_PLATE, 'TROPHIES', `★ ${unlockedAch().size}/${ACHIEVEMENTS.length}`);
}
