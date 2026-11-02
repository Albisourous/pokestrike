// Cached Pokémon tile courts; only the small ambient sprite pass moves.
import { gracidea } from '../core/assets';
import * as MT from './maptiles';
import type { TileRect } from './maptiles';

export type Theme =
  | 'grove' | 'cavern' | 'volcano' | 'sky'
  | 'meadow' | 'shore' | 'plant' | 'marsh' | 'sanctum' | 'dojo' | 'tower';
export const THEMES: Theme[] = [
  'grove', 'cavern', 'volcano', 'sky',
  'meadow', 'shore', 'plant', 'marsh', 'sanctum', 'dojo', 'tower',
];

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export interface PropSpec {
  r: TileRect;
  t?: string;
}

// Keyed atlas slice cached per rect+tint — same magenta-family test as
// map.ts's drawTile. Terrain fills are opaque so keying is a no-op for them;
// the tint pass only lands where the sprite does (source-atop keeps alpha).
const sliceCache = new Map<string, HTMLCanvasElement>();
export function slice(s: TileRect, tint?: string, chroma?: readonly [number, number, number]): HTMLCanvasElement | null {
  const img = gracidea();
  if (!img) return null;
  const k = `${s.join(',')}|${tint ?? ''}|${chroma?.join(',') ?? ''}`;
  let c = sliceCache.get(k);
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
      if (chroma && r === chroma[0] && gg === chroma[1] && b === chroma[2]) d[i + 3] = 0;
    }
    g.putImageData(id, 0, 0);
    if (tint) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint;
      g.fillRect(0, 0, c.width, c.height);
    }
    sliceCache.set(k, c);
  }
  return c;
}

// Blit a keyed slice; a no-op while the atlas streams in so callers never
// branch on load state — the frame just draws fewer props until then.
export function drawSlice(
  ctx: CanvasRenderingContext2D,
  s: TileRect,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  tint?: string,
) {
  const c = slice(s, tint);
  if (!c) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, dx, dy, dw, dh);
  ctx.restore();
}

type Rect = { x: number; y: number; w: number; h: number };
const FW = 540, FH = 960;
const floors = new Map<Theme, HTMLCanvasElement>();
const flats = new Map<Theme, HTMLCanvasElement>();

const FILL: Record<Theme, PropSpec> = {
  grove: { r: MT.TILE_TURF, t: 'rgba(8,36,22,0.72)' },
  cavern: { r: MT.TILE_GRAVEL, t: 'rgba(10,14,32,0.78)' },
  volcano: { r: MT.TILE_COBBLE, t: 'rgba(24,8,12,0.80)' },
  sky: { r: MT.TILE_ICE, t: 'rgba(16,44,70,0.76)' },
  meadow: { r: MT.TILE_TURF, t: 'rgba(18,44,20,0.72)' },
  shore: { r: MT.TILE_WATER, t: 'rgba(4,34,56,0.60)' },
  plant: { r: MT.TILE_BRICK, t: 'rgba(8,24,32,0.80)' },
  marsh: { r: MT.TILE_WATER, t: 'rgba(12,38,32,0.76)' },
  sanctum: { r: MT.TILE_FLAGSTONE, t: 'rgba(32,22,62,0.80)' },
  dojo: { r: MT.TILE_CLAY, t: 'rgba(44,26,16,0.78)' },
  tower: { r: MT.TILE_BRICK, t: 'rgba(12,8,30,0.86)' },
};

const STAGE: Record<Theme, { ground: PropSpec; edge: PropSpec }> = {
  grove: { ground: { r: MT.TILE_TURF, t: 'rgba(40,148,56,0.22)' }, edge: { r: MT.TILE_SAND } },
  cavern: { ground: { r: MT.TILE_GRAVEL, t: 'rgba(58,72,112,0.38)' }, edge: { r: MT.TILE_FLAGSTONE, t: 'rgba(52,60,96,0.34)' } },
  volcano: { ground: { r: MT.TILE_CLAY, t: 'rgba(166,50,20,0.26)' }, edge: { r: MT.TILE_LAVA } },
  sky: { ground: { r: MT.TILE_ICE }, edge: { r: MT.TILE_FLAGSTONE, t: 'rgba(54,128,188,0.34)' } },
  meadow: { ground: { r: MT.TILE_TURF, t: 'rgba(154,186,58,0.24)' }, edge: { r: MT.TILE_CLAY } },
  shore: { ground: { r: MT.TILE_SAND }, edge: { r: MT.TILE_DIAMOND, t: 'rgba(198,156,60,0.24)' } },
  plant: { ground: { r: MT.TILE_BRICK, t: 'rgba(38,116,132,0.34)' }, edge: { r: MT.TILE_STEEL_TRIM } },
  marsh: { ground: { r: MT.TILE_GRAVEL, t: 'rgba(54,112,66,0.45)' }, edge: { r: MT.TILE_MOSS_TRIM } },
  sanctum: { ground: { r: MT.TILE_DIAMOND, t: 'rgba(156,130,196,0.16)' }, edge: { r: MT.TILE_FLAGSTONE, t: 'rgba(94,64,142,0.44)' } },
  dojo: { ground: { r: MT.TILE_CLAY, t: 'rgba(214,170,76,0.16)' }, edge: { r: MT.TILE_TIMBER } },
  tower: { ground: { r: MT.TILE_BRICK, t: 'rgba(86,60,126,0.48)' }, edge: { r: MT.TILE_FLAGSTONE, t: 'rgba(70,52,114,0.46)' } },
};

function nineTiles(r: TileRect, edge: number): readonly TileRect[] {
  const xs = [r[0], r[0] + edge, r[0] + r[2] - edge];
  const ys = [r[1], r[1] + edge, r[1] + r[3] - edge];
  return ys.flatMap((y, row) => xs.map((x, col): TileRect =>
    [x, y, col === 1 ? r[2] - edge * 2 : edge, row === 1 ? r[3] - edge * 2 : edge]));
}

const WALL_TILES: Record<Theme, readonly TileRect[]> = {
  grove: MT.WALL_HEDGE, meadow: MT.WALL_HEDGE,
  cavern: nineTiles(MT.WALL_ROCK, 12), tower: nineTiles(MT.WALL_ROCK, 12),
  volcano: nineTiles(MT.WALL_VOLCANIC, 12), sky: nineTiles(MT.WALL_SNOW, 12),
  shore: nineTiles(MT.WALL_ROCK, 12), plant: nineTiles(MT.WALL_METAL, 4),
  dojo: nineTiles(MT.WALL_WOOD, 4), marsh: MT.WALL_HEDGE,
  sanctum: nineTiles(MT.WALL_ROCK, 12),
};
const WATER_TILES = nineTiles(MT.MOAT_SHORE, 8).map((r, i) => i === 4 ? MT.MOAT_WATER : r);
const lavaTiles = new Map<string, HTMLCanvasElement>();

function lavaTile(r: TileRect) {
  if (r === MT.MOAT_WATER) return slice(MT.MOAT_LAVA);
  const water = slice(r);
  if (!water) return null;
  const key = r.join(',');
  const hit = lavaTiles.get(key);
  if (hit) return hit;
  const fill = slice(MT.MOAT_LAVA);
  if (!fill) return null;
  const c = document.createElement('canvas');
  c.width = r[2]; c.height = r[3];
  const g = c.getContext('2d')!;
  tileRect(g, fill, 0, 0, c.width, c.height, 1);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(water, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(slice(r, undefined, [112, 184, 240])!, 0, 0);
  lavaTiles.set(key, c);
  return c;
}

// Joined sides use the interior tile; exposed sides keep the original caps.
function drawPatch(ctx: CanvasRenderingContext2D, b: Rect, tiles: readonly TileRect[], joins: readonly boolean[], rim = false, shadow = false, lava = false) {
  const edge = Math.min(12, b.w / 3, b.h / 3);
  const xs = [b.x, b.x + edge, b.x + b.w - edge, b.x + b.w];
  const ys = [b.y, b.y + edge, b.y + b.h - edge, b.y + b.h];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (shadow) ctx.globalAlpha *= 0.24;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    if (rim && row === 1 && col === 1) continue;
    const sy = (row === 0 && joins[0]) || (row === 2 && joins[2]) ? 1 : row;
    const sx = (col === 0 && joins[3]) || (col === 2 && joins[1]) ? 1 : col;
    const r = tiles[sy * 3 + sx];
    const tile = lava ? lavaTile(r) : slice(r, shadow ? '#101820' : undefined);
    if (!tile) continue;
    const w = xs[col + 1] - xs[col], h = ys[row + 1] - ys[row];
    const tw = sx === 1 ? tile.width * 2 : w;
    const th = sy === 1 ? tile.height * 2 : h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(xs[col], ys[row] + (shadow ? 3 : 0), w, h);
    ctx.clip();
    const x0 = sx === 1 ? Math.floor(xs[col] / tw) * tw : xs[col];
    const y0 = sy === 1 ? Math.floor(ys[row] / th) * th : ys[row];
    for (let y = y0; y < ys[row + 1]; y += th) for (let x = x0; x < xs[col + 1]; x += tw)
      ctx.drawImage(tile, x, y + (shadow ? 3 : 0), tw, th);
    ctx.restore();
  }
  ctx.restore();
}

export function drawCover(ctx: CanvasRenderingContext2D, b: Rect & { field?: 'smash' | 'cut' | 'strength'; hp?: number }, theme: Theme, joins: readonly boolean[]) {
  if (b.field) {
    const prop = b.field === 'cut' ? MT.FIELD_CUT : b.field === 'strength' ? MT.FIELD_STRENGTH
      : (b.hp ?? 3) < 3 ? MT.FIELD_CHIPPED : MT.FIELD_SMASH;
    const size = b.field === 'smash' && b.hp === 1 ? 0.8 : 1;
    const w = b.w * size, h = b.h * size;
    const x = b.x + (b.w - w) / 2, y = b.y + b.h - h;
    ctx.save();
    ctx.globalAlpha *= 0.24;
    drawSlice(ctx, prop, x, y + 3, w, h, '#101820');
    ctx.restore();
    drawSlice(ctx, prop, x, y, w, h);
    return;
  }
  const prop = theme === 'shore' ? MT.WALL_BOULDER : theme === 'sanctum' ? MT.WALL_RUIN
    : theme === 'marsh' ? MT.WALL_REED : theme === 'dojo' ? MT.WALL_WOOD : theme === 'plant' ? MT.WALL_METAL
    : theme === 'grove' || theme === 'meadow' ? MT.WALL_BUSH : null;
  if (prop) {
    if (theme === 'shore' || theme === 'sanctum') {
      drawPatch(ctx, b, WALL_TILES[theme], joins, false, true);
      drawPatch(ctx, b, WALL_TILES[theme], joins);
    }
    for (const shadow of [true, false]) {
      const tile = slice(prop, shadow ? '#101820' : undefined);
      if (!tile) continue;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (shadow) ctx.globalAlpha *= 0.24;
      if (theme === 'shore' || theme === 'sanctum' || theme === 'dojo' || theme === 'plant')
        ctx.drawImage(tile, b.x, b.y + (shadow ? 3 : 0), b.w, b.h);
      else {
        const scale = b.w / tile.width, h = tile.height * scale;
        ctx.beginPath();
        ctx.rect(b.x, b.y + (shadow ? 3 : 0), b.w, b.h);
        ctx.clip();
        for (let y = b.y; y < b.y + b.h; y += h - 4)
          ctx.drawImage(tile, b.x, y + (shadow ? 3 : 0), b.w, h);
      }
      ctx.restore();
    }
    return;
  }
  drawPatch(ctx, b, WALL_TILES[theme], joins, false, true);
  drawPatch(ctx, b, WALL_TILES[theme], joins);
}

export function drawMoat(ctx: CanvasRenderingContext2D, b: Rect, theme: Theme, joins: readonly boolean[]) {
  drawPatch(ctx, b, WATER_TILES, joins, false, false, theme === 'volcano');
}

function tileRect(g: CanvasRenderingContext2D, tile: HTMLCanvasElement, x: number, y: number, w: number, h: number, scale = 2) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const tw = tile.width * scale, th = tile.height * scale;
  for (let yy = y; yy < y + h; yy += th)
    for (let xx = x; xx < x + w; xx += tw) g.drawImage(tile, xx, yy, tw, th);
  g.restore();
}

function floor(theme: Theme) {
  const hit = floors.get(theme);
  if (hit) return hit;
  const f = FILL[theme], s = STAGE[theme];
  const surround = slice(f.r, f.t);
  if (!surround) {
    // Keep streaming fallbacks separate so the atlas upgrades on arrival.
    let flat = flats.get(theme);
    if (!flat) {
      flat = document.createElement('canvas');
      flat.width = FW;
      flat.height = FH;
      const g = flat.getContext('2d')!;
      g.fillStyle = '#101820';
      g.fillRect(0, 0, FW, FH);
      flats.set(theme, flat);
    }
    return flat;
  }
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  tileRect(g, surround, 0, 0, FW, FH);

  // Stage edge sits on the physics wall, so the band reads as where balls bounce.
  const x = 14, y = 30, w = FW - 28, h = FH - 44, band = 16;
  g.fillStyle = 'rgba(0,0,0,0.50)';
  g.fillRect(x - 4, y + 8, w + 8, h + 4);
  tileRect(g, slice(s.edge.r, s.edge.t)!, x, y, w, h);
  tileRect(g, slice(s.ground.r, s.ground.t)!, x + band, y + band, w - band * 2, h - band * 2);

  const light = g.createLinearGradient(0, y, 0, y + h);
  light.addColorStop(0, 'rgba(255,248,216,0.12)');
  light.addColorStop(0.45, 'rgba(255,248,216,0)');
  light.addColorStop(1, 'rgba(6,12,28,0.16)');
  g.fillStyle = light;
  g.fillRect(0, 0, FW, FH);
  const vignette = g.createRadialGradient(FW / 2, FH * 0.4, FW * 0.35, FW / 2, FH * 0.45, FH * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, FW, FH);

  floors.set(theme, c);
  return c;
}

export function drawWall(ctx: CanvasRenderingContext2D, a: Rect, theme: Theme) {
  if (theme === 'plant' || theme === 'dojo') {
    const prop = theme === 'plant' ? MT.WALL_METAL : MT.WALL_WOOD;
    for (const shadow of [true, false]) {
      const tile = slice(prop, shadow ? '#101820' : undefined);
      if (!tile) continue;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (shadow) ctx.globalAlpha *= 0.24;
      ctx.translate(a.x, a.y + (shadow ? 3 : 0));
      const scale = 12 / tile.height;
      tileRect(ctx, tile, 0, 0, a.w, 12, scale);
      tileRect(ctx, tile, 0, a.h - 12, a.w, 12, scale);
      ctx.translate(12, 12);
      ctx.rotate(Math.PI / 2);
      tileRect(ctx, tile, 0, 0, a.h - 24, 12, scale);
      tileRect(ctx, tile, 0, 12 - a.w, a.h - 24, 12, scale);
      ctx.restore();
    }
    return;
  }
  drawPatch(ctx, a, WALL_TILES[theme], [], true, true);
  drawPatch(ctx, a, WALL_TILES[theme], [], true);
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  r: number,
  theme: Theme,
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(floor(theme), rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

const WATER_KEY = [136, 200, 240] as const;
const SAND_KEY = [216, 184, 96] as const;
const LAVA_KEY = [200, 48, 0] as const;
const AMBIENT: Record<Theme, PropSpec & { chroma?: readonly [number, number, number]; n: number; vx: number; vy: number; size: number; alpha: number }> = {
  grove: { r: MT.FX_LEAF, n: 18, vx: 13, vy: 22, size: 8, alpha: 0.52 },
  cavern: { r: MT.FX_DUST, chroma: SAND_KEY, t: 'rgba(170,190,238,0.40)', n: 16, vx: 5, vy: 7, size: 4, alpha: 0.35 },
  volcano: { r: MT.FX_EMBER, chroma: LAVA_KEY, n: 24, vx: 7, vy: -32, size: 7, alpha: 0.70 },
  sky: { r: MT.FX_SNOW, chroma: WATER_KEY, n: 22, vx: -16, vy: 24, size: 7, alpha: 0.65 },
  meadow: { r: MT.FX_PETAL, n: 18, vx: 18, vy: 12, size: 6, alpha: 0.55 },
  shore: { r: MT.FX_BUBBLE, chroma: WATER_KEY, n: 16, vx: -10, vy: -12, size: 7, alpha: 0.40 },
  plant: { r: MT.FX_EMBER, chroma: LAVA_KEY, t: 'rgba(255,230,110,0.70)', n: 14, vx: 3, vy: -20, size: 4, alpha: 0.50 },
  marsh: { r: MT.FX_BUBBLE, chroma: WATER_KEY, t: 'rgba(160,208,110,0.35)', n: 16, vx: 5, vy: -9, size: 7, alpha: 0.50 },
  sanctum: { r: MT.FX_SNOW, chroma: WATER_KEY, t: 'rgba(184,148,240,0.35)', n: 14, vx: 4, vy: -12, size: 5, alpha: 0.45 },
  dojo: { r: MT.FX_DUST, chroma: SAND_KEY, n: 14, vx: 14, vy: 8, size: 4, alpha: 0.42 },
  tower: { r: MT.FX_PETAL, t: 'rgba(160,134,238,0.65)', n: 16, vx: 5, vy: -15, size: 6, alpha: 0.55 },
};
const ambientTiles = new Map<Theme, HTMLCanvasElement>();

export function drawAmbient(ctx: CanvasRenderingContext2D, a: Rect, theme: Theme, time: number, quality = 1) {
  const amb = AMBIENT[theme];
  let tile = ambientTiles.get(theme);
  if (!tile) {
    const loaded = slice(amb.r, amb.t, amb.chroma);
    if (!loaded) return;
    ambientTiles.set(theme, loaded);
    tile = loaded;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.x + 12, a.y + 64, a.w - 24, a.h - 80);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const n = Math.max(1, Math.round(amb.n * quality));
  for (let k = 0; k < n; k++) {
    const phase = time * 1.2 + k * 2.3;
    const x = a.x + ((k * 97.31 + time * amb.vx + Math.sin(phase) * 16) % a.w + a.w) % a.w;
    const y = a.y + ((k * 61.7 + time * amb.vy) % a.h + a.h) % a.h;
    const w = amb.size * (0.7 + (k % 3) * 0.15);
    ctx.globalAlpha = amb.alpha * (0.55 + 0.45 * Math.sin(phase) ** 2);
    ctx.drawImage(tile, Math.round(x), Math.round(y), w, w * tile.height / tile.width);
  }
  ctx.restore();
}
