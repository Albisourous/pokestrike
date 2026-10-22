// GBA-map arenas: a prerendered floor per theme tiled from gracidea terrain
// blocks with painted pitch markings (inset boundary, halfway line, center
// circle, corner arcs) drawn live so they scale to the arena rect, and a
// wall ring of atlas props standing on the rim — the PokéBonk cliff look.
import { gracidea } from '../core/assets';
import * as MT from './maptiles';
import type { TileRect } from './maptiles';

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// multiply a #rrggbb by f — the ±15% luminance steps for floor scatter
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
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

// light-pool gradients keyed by center+radius+color — static per arena,
// so the radial bake isn't re-created every frame
const poolGrads = new Map<string, CanvasGradient>();

// face-tile patterns keyed on the baked face canvas — the cliff-face fill
// is identical every frame
const facePatterns = new Map<HTMLCanvasElement, CanvasPattern>();

// A wall prop is a tile rect plus an optional source-atop tint baked into its
// cached slice — themes darken rocks/dead wood without new art.
export interface PropSpec {
  r: TileRect;
  t?: string;
}

// Keyed atlas slice cached per rect+tint — same magenta-family test as
// map.ts's drawTile. Terrain fills are opaque so keying is a no-op for them;
// the tint pass only lands where the sprite does (source-atop keeps alpha).
const sliceCache = new Map<string, HTMLCanvasElement>();
export function slice(s: TileRect, tint?: string): HTMLCanvasElement | null {
  const img = gracidea();
  if (!img) return null;
  const k = `${s.join(',')}|${tint ?? ''}`;
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

// rounded-rect subpath, appended — the face's ring clip needs two of these
// in one path, so the path-body lives here and rr() wraps it for strokes
function rrp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  rrp(ctx, x, y, w, h, r);
}

// The texture is far too many ops to redraw per frame, so each theme's floor
// is painted once at logical size and blitted; stretch on odd rects is invisible.
const FW = 540, FH = 960;
const floors = new Map<Theme, HTMLCanvasElement>();
// flat stand-ins served while the atlas streams (title screen) — kept out of
// `floors` so each court rebakes tiled once gracidea lands
const flats = new Map<Theme, HTMLCanvasElement>();

// One fill block per theme, stamped interior-first across the court. `t` bakes
// a shade into the tile (source-atop): cavern drops a shade, volcano cooks the
// same cobble down to basalt. `s` upscales so the pixel grain reads at court
// size; `wash` softens sky's snow toward blue.
const FILL: Record<Theme, { r: TileRect; t?: string; s: number; wash?: string }> = {
  grove: { r: MT.TILE_GRASSF, s: 1.2 },
  cavern: { r: MT.TILE_COBBLE, t: 'rgba(14,14,34,0.20)', s: 1.3 },
  volcano: { r: MT.TILE_COBBLE, t: 'rgba(96,32,8,0.50)', s: 1.3 },
  sky: { r: MT.TILE_SNOWF, s: 1.6, wash: 'rgba(130,194,232,0.55)' },
};

function floor(theme: Theme) {
  const hit = floors.get(theme);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const g = c.getContext('2d')!;
  g.fillStyle = GROUND[theme];
  g.fillRect(0, 0, FW, FH);
  const tile = slice(FILL[theme].r, FILL[theme].t);
  if (!tile) {
    // atlas still streaming — serve a cached flat bake so the title screen
    // doesn't churn canvases; `floors` stays empty so the court upgrades
    const f = flats.get(theme);
    if (f) return f;
    flats.set(theme, c);
    return c;
  }
  const tw = FILL[theme].r[2] * FILL[theme].s, th = FILL[theme].r[3] * FILL[theme].s;
  g.imageSmoothingEnabled = false;
  // per-tile alpha jitter (±4%) breaks the strict grid at distance
  for (let y = 0, ty = 0; y < FH; y += th, ty++) {
    for (let x = 0, tx = 0; x < FW; x += tw, tx++) {
      g.globalAlpha = 0.96 + (hash(tx * 31.7 + ty * 17.3) - 0.5) * 0.08;
      g.drawImage(tile, x, y, tw, th);
    }
  }
  g.globalAlpha = 1;
  // micro-scatter: hash-seeded pebble dots + blade ticks in ±15% ground
  // luminance — cheap noise that kills the 44px moiré between tile features
  {
    const dark = shade(GROUND[theme], 0.85), lite = shade(GROUND[theme], 1.16);
    const bladeOdds = theme === 'grove' ? 0.5 : theme === 'sky' ? 0.12 : 0.2;
    for (let i = 0; i < 420; i++) {
      const mx = hash(i * 13.7 + 3) * FW, my = hash(i * 7.9 + 11) * FH;
      g.fillStyle = hash(i * 3.1 + 5) < 0.55 ? dark : lite;
      g.globalAlpha = 0.28 + hash(i * 9.7 + 1) * 0.26;
      if (hash(i * 5.3 + 7) < bladeOdds) {
        g.fillRect(mx, my, 1.5 + hash(i * 2.9) * 1.5, 3 + hash(i * 4.3) * 2);
      } else {
        g.beginPath();
        g.arc(mx, my, 1 + hash(i * 4.1 + 2) * 1.6, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  if (FILL[theme].wash) {
    g.fillStyle = FILL[theme].wash;
    g.fillRect(0, 0, FW, FH);
  }
  if (theme === 'volcano') {
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
  } else if (theme === 'sky') {
    // cloud-banked floor: faint blue underside under each white cap
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

// The court's border is a ring of gracidea props standing on the rim — the
// GBA-map cliff edge, not stadium boards. `hi` pieces take the top and side
// edges; `lo` pieces are short ground cover for the bottom strip where the
// team stands. `pile` doubles up the stamp so cavern rocks read as cairns.
const WALL_PROPS: Record<Theme, { hi: PropSpec[]; lo: PropSpec[]; pile?: boolean }> = {
  grove: {
    hi: [{ r: MT.TREE_ROUND }, { r: MT.TREE_PINE }, { r: MT.TREE_OLIVE }, { r: MT.TREE_TEAL }],
    lo: [{ r: MT.TILE_FLOWER }, { r: MT.FLOWER_YB }, { r: MT.FLOWER_PK }],
  },
  cavern: {
    hi: [{ r: MT.TILE_ROCK }, { r: MT.ROCK_SMALL }, { r: MT.TILE_ROCK, t: 'rgba(40,40,90,0.30)' }],
    lo: [{ r: MT.ROCK_SMALL }, { r: MT.TILE_ROCK, t: 'rgba(40,40,90,0.30)' }],
    pile: true,
  },
  volcano: {
    hi: [
      { r: MT.TREE_ASH, t: 'rgba(115,45,15,0.50)' }, // pale pines cooked into scorched snags
      { r: MT.TREE_ASH2, t: 'rgba(115,45,15,0.50)' },
      { r: MT.TILE_ROCK, t: 'rgba(70,20,8,0.45)' },
    ],
    lo: [{ r: MT.ROCK_SMALL, t: 'rgba(70,20,8,0.45)' }, { r: MT.TILE_ROCK, t: 'rgba(70,20,8,0.45)' }],
    pile: true,
  },
  sky: { hi: [], lo: [] }, // its ring is a painted cloud bank, not props
};

// The rim is a cliff face, not boards: a darkened cobble band falls away
// OUTSIDE the court (the mesa you could fall off), a lit lip sits at the
// drop line inside the rim, and the face bottoms out in darkness. `ds`
// shrinks the 28px cobble so the face grain is finer than the floor's.
const FACE_D = 19;
const FACE: Partial<Record<Theme, { r: TileRect; t: string; ds: number }>> = {
  grove: { r: MT.TILE_COBBLE, t: 'rgba(16,40,14,0.48)', ds: 0.68 },
  cavern: { r: MT.TILE_COBBLE, t: 'rgba(8,8,30,0.45)', ds: 0.68 },
  volcano: { r: MT.TILE_COBBLE, t: 'rgba(44,10,2,0.64)', ds: 0.68 },
};
// scaled-down face tile, baked once per theme next to the floor bakes
const faceTiles = new Map<Theme, HTMLCanvasElement | null>();
function faceTile(theme: Theme): HTMLCanvasElement | null {
  const hit = faceTiles.get(theme);
  if (hit !== undefined) return hit;
  const F = FACE[theme];
  if (!F) {
    faceTiles.set(theme, null); // sky has no rock face — permanent miss
    return null;
  }
  const s = slice(F.r, F.t);
  if (!s) return null; // atlas still streaming — retry next frame, don't cache
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(F.r[2] * F.ds));
  c.height = Math.max(4, Math.round(F.r[3] * F.ds));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(s, 0, 0, c.width, c.height);
  faceTiles.set(theme, c);
  return c;
}

// Prop ring with depth: a dark seat + thin rim keeps the physics edge
// readable, an inner AO ring is the cliff-shadow, and hash-jittered props
// hang over the rim into the court — balls sliding under them is the look.
export function drawWall(ctx: CanvasRenderingContext2D, a: { x: number; y: number; w: number; h: number }, theme: Theme) {
  // cliff face — the textured rock band outside the rim, drawn under the
  // seat shadow so the mesa edge still grounds the court. The even-odd
  // ring clip keeps the band's corners concentric with the arena's.
  const ft = faceTile(theme);
  if (ft) {
    ctx.save();
    ctx.beginPath();
    rrp(ctx, a.x - FACE_D, a.y - FACE_D, a.w + FACE_D * 2, a.h + FACE_D * 2, 34);
    rrp(ctx, a.x + 2, a.y + 2, a.w - 4, a.h - 4, 16);
    ctx.clip('evenodd');
    let pat = facePatterns.get(ft);
    if (!pat) {
      pat = ctx.createPattern(ft, 'repeat')!;
      facePatterns.set(ft, pat);
    }
    ctx.fillStyle = pat;
    ctx.fillRect(a.x - FACE_D, a.y - FACE_D, a.w + FACE_D * 2, a.h + FACE_D * 2);
    // vertical shading per side: lit where the face leaves the rim, dark as
    // it falls — the gradient vectors point outward
    for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of [
      [a.x, a.y + 2, a.x, a.y - FACE_D, a.x - FACE_D, a.y - FACE_D, a.w + FACE_D * 2, FACE_D + 2],
      [a.x, a.y + a.h - 2, a.x, a.y + a.h + FACE_D, a.x - FACE_D, a.y + a.h - 2, a.w + FACE_D * 2, FACE_D + 2],
      [a.x + 2, a.y, a.x - FACE_D, a.y, a.x - FACE_D, a.y + 2, FACE_D + 2, a.h - 4],
      [a.x + a.w - 2, a.y, a.x + a.w + FACE_D, a.y, a.x + a.w - 2, a.y + 2, FACE_D + 2, a.h - 4],
    ]) {
      const gd = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      gd.addColorStop(0, 'rgba(255,244,214,0.13)');
      gd.addColorStop(0.4, 'rgba(0,0,0,0)');
      gd.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = gd;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
    // dark drop — the face's bottom edge lost in shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 5;
    rr(ctx, a.x - FACE_D + 2.5, a.y - FACE_D + 2.5, a.w + (FACE_D - 2.5) * 2, a.h + (FACE_D - 2.5) * 2, 32);
    ctx.stroke();
  }
  // seat shadow so the rim lifts off the floor
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = 15;
  rr(ctx, a.x, a.y + 2, a.w, a.h, 18);
  ctx.stroke();
  // thin dark rim — the physics edge must stay readable under the props
  ctx.strokeStyle = RIM[theme];
  ctx.lineWidth = 7;
  rr(ctx, a.x, a.y, a.w, a.h, 18);
  ctx.stroke();
  if (ft) {
    // top-light lip — the court's edge catches sun where the drop begins
    ctx.strokeStyle = 'rgba(255,246,220,0.38)';
    ctx.lineWidth = 2.5;
    rr(ctx, a.x + 4.5, a.y + 4.5, a.w - 9, a.h - 9, 14);
    ctx.stroke();
  } else {
    // hairline chalk just inside the rim; props hang over it on purpose
    ctx.strokeStyle = 'rgba(255,246,220,0.20)';
    ctx.lineWidth = 2;
    rr(ctx, a.x + 7, a.y + 7, a.w - 14, a.h - 14, 11);
    ctx.stroke();
  }
  // inner AO — stepped strokes fake a ~24px gradient ring, the shadow the
  // wall line throws onto the court
  for (const [inset, al, lw] of [[9, 0.2, 7], [16, 0.11, 8], [24, 0.05, 9]]) {
    ctx.strokeStyle = `rgba(0,0,0,${al})`;
    ctx.lineWidth = lw;
    rr(ctx, a.x + inset, a.y + inset, a.w - inset * 2, a.h - inset * 2, 12);
    ctx.stroke();
  }
  // sky's ring is a rolling cloud bank — ambience, so painted puffs are OK
  // here. A second, darker row rides outside the first: height, like the
  // other courts' rock face.
  if (theme === 'sky') {
    const bank = (bx: number, by: number, s: number, back = false) => {
      for (let k = -1; k <= 1; k++) {
        ctx.fillStyle = back ? 'rgba(74,108,152,0.5)' : 'rgba(120,160,205,0.45)'; // blue-gray underside
        ctx.beginPath();
        ctx.arc(bx + k * 13 * s, by + 6, 13 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = back ? 'rgba(196,214,238,0.55)' : 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.arc(bx + k * 13 * s, by, 13 * s * (1 - Math.abs(k) * 0.18), 0, TAU);
        ctx.fill();
      }
    };
    for (let i = 0, x = a.x + 24; x < a.x + a.w - 10; i++) {
      bank(x + (hash(i * 7.1) - 0.5) * 16, a.y + 4 + (i % 2) * 5, 1.15 + hash(i * 3.7) * 0.3, true);
      bank(x + (hash(i * 9.7) - 0.5) * 10, a.y + 24 + (i % 2) * 6, 1 + hash(i * 5.1) * 0.3);
      x += 46 + hash(i * 3.3) * 14;
    }
    for (let i = 0, y = a.y + 84; y < a.y + a.h - 120; i++) {
      bank(a.x - 8 + (hash(i * 6.3) - 0.5) * 4, y - 8, 1.05 + hash(i * 2.9) * 0.3, true);
      bank(a.x + a.w + 8 + (hash(i * 4.1) - 0.5) * 4, y - 2, 1.05 + hash(i * 8.7) * 0.3, true);
      bank(a.x + 10 + (hash(i * 8.3) - 0.5) * 4, y, 0.9 + hash(i * 4.7) * 0.3);
      bank(a.x + a.w - 10 + (hash(i * 3.1) - 0.5) * 4, y + 6, 0.9 + hash(i * 7.7) * 0.3);
      y += 58 + hash(i * 3.9) * 16;
    }
    for (let i = 0, x = a.x + 50; x < a.x + a.w - 40; i++) {
      bank(x + (hash(i * 3.7) - 0.5) * 20, a.y + a.h + 12, 0.85 + hash(i * 9.3) * 0.3, true);
      bank(x, a.y + a.h - 6, 0.7 + hash(i * 6.7) * 0.3);
      x += 90 + hash(i * 5.5) * 40;
    }
    return;
  }
  // nothing to stamp until the atlas lands — rim + AO still carry the edge
  if (!gracidea()) return;
  const P = WALL_PROPS[theme];
  // feet-anchored stamp: by is the prop's ground line; a soft contact
  // shadow underneath keeps it standing on the court, not floating
  const stamp = (p: PropSpec, bx: number, by: number, s: number) => {
    const w = p.r[2] * s, h = p.r[3] * s;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(bx, by - 2, w * 0.38, 4.5, 0, 0, TAU);
    ctx.fill();
    drawSlice(ctx, p.r, bx - w / 2, by - h, w, h, p.t);
  };
  // top treeline — dense, jittered, canopies overhanging the rim
  for (let i = 0, x = a.x + 24; x < a.x + a.w - 10; i++) {
    const p = P.hi[Math.floor(hash(i * 7.3 + 2) * P.hi.length)];
    const s = 1.0 + hash(i * 5.1 + 4) * 0.45;
    stamp(p, x + (hash(i * 9.7) - 0.5) * 10, a.y + 46 + (i % 2) * 9, s);
    x += 42 + hash(i * 3.3) * 13;
  }
  // side edges — same upright props stepping down; they stop short of the
  // bottom strip so the team's row stays clear
  for (let i = 0, y = a.y + 74; y < a.y + a.h - 120; i++) {
    const p = P.hi[Math.floor(hash(i * 6.1 + 40) * P.hi.length)];
    const s = 1.0 + hash(i * 4.7 + 9) * 0.45;
    stamp(p, a.x + 11 + (hash(i * 8.3) - 0.5) * 6, y, s);
    const p2 = P.hi[Math.floor(hash(i * 5.9 + 80) * P.hi.length)];
    const s2 = 1.0 + hash(i * 7.7 + 3) * 0.45;
    stamp(p2, a.x + a.w - 11 + (hash(i * 3.1) - 0.5) * 6, y + (hash(i * 2.3) - 0.5) * 8, s2);
    if (P.pile) {
      // a second loose lump turns each boulder into a little cairn —
      // borrows the theme's low-prop tint so volcano rocks stay scorched
      stamp({ r: MT.ROCK_SMALL, t: P.lo[0].t }, a.x + 27, y - 6, s * 0.7);
      stamp({ r: MT.ROCK_SMALL, t: P.lo[0].t }, a.x + a.w - 27, y + 2, s2 * 0.7);
    }
    y += 44 + hash(i * 3.9) * 12;
  }
  // bottom strip — sparse low cover; nothing tall may hide the team
  for (let i = 0, x = a.x + 40; x < a.x + a.w - 30; i++) {
    const p = P.lo[Math.floor(hash(i * 8.9 + 60) * P.lo.length)];
    const s = 0.9 + hash(i * 6.7) * 0.5;
    stamp(p, x + (hash(i * 4.3) - 0.5) * 14, a.y + a.h - 7, s);
    x += 72 + hash(i * 5.5) * 38;
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
    const pr = m * 0.42;
    // the gradient is static per arena+pool — the pulse rides on
    // globalAlpha so the color stops bake once instead of per frame
    const pk = `${gr},${gg},${gb}|${px},${py},${pr}`;
    let gd = poolGrads.get(pk);
    if (!gd) {
      gd = ctx.createRadialGradient(px, py, 0, px, py, pr);
      gd.addColorStop(0, `rgba(${gr},${gg},${gb},1)`);
      gd.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      poolGrads.set(pk, gd);
    }
    ctx.globalAlpha = ga * (0.85 + 0.15 * Math.sin(t * 1.2));
    ctx.fillStyle = gd;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
