const cache = new Map<number, HTMLImageElement>();
const itemCache = new Map<string, HTMLImageElement>();
let gracideaImg: HTMLImageElement | undefined;

// Scenery canon: the RSE-era Gracidea atlases in public/sprites/gracidea.
// Slice by pixel rect — frame indexes live in the matching .json files.
export function loadGracidea(): Promise<HTMLImageElement> {
  if (gracideaImg) return Promise.resolve(gracideaImg);
  return loadImg('sprites/gracidea/tileset.webp', 'gracidea tileset').then((img) => {
    gracideaImg = img;
    return img;
  });
}

export function gracidea(): HTMLImageElement | undefined {
  return gracideaImg;
}

function loadImg(src: string, label: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`failed to load ${label}`));
    img.src = src;
  });
}

export function loadSprite(id: number): Promise<HTMLImageElement> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  return loadImg(`sprites/${id}.png`, `sprite ${id}`).then((img) => {
    cache.set(id, img);
    return img;
  });
}

export function loadItem(name: string): Promise<HTMLImageElement> {
  const hit = itemCache.get(name);
  if (hit) return Promise.resolve(hit);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      itemCache.set(name, img);
      res(img);
    };
    img.onerror = () => res(img); // blank fallback — items are decorative
    img.src = `sprites/${name.includes('/') ? name : `items/${name}`}.png`;
  });
}

export function itemSprite(name: string): HTMLImageElement | undefined {
  return itemCache.get(name);
}

export function loadAll(ids: number[]): Promise<HTMLImageElement[]> {
  return Promise.all([...new Set(ids)].map(loadSprite));
}

export function sprite(id: number): HTMLImageElement {
  const img = cache.get(id);
  if (!img) throw new Error(`sprite ${id} not loaded`);
  return img;
}

// Draw a Pokémon centered at x,y at `size` px. Nearest-neighbor keeps
// the pixel art crisp at non-integer scales.
export function drawMon(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite(id), x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

// Shiny variant: a lazy gold-tinted copy of the front sprite — the classic
// alt-palette read without vendoring a second set of art.
const shinyCache = new Map<number, HTMLCanvasElement>();
export function shinySprite(id: number): HTMLCanvasElement {
  let c = shinyCache.get(id);
  if (!c) {
    const img = sprite(id);
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const t = c.getContext('2d')!;
    t.imageSmoothingEnabled = false;
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = 'rgba(255, 205, 66, 0.5)';
    t.fillRect(0, 0, c.width, c.height);
    shinyCache.set(id, c);
  }
  return c;
}

export function drawShiny(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shinySprite(id), x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

// --- sprite sheets (Makko-baked, or any strip/grid sheet) ---
// Drop <name>.png + <name>.json into public/anim/. The JSON manifest is:
//   { "frameW": 64, "frameH": 64, "fps": 12, "frames": [{"x":0,"y":0,"w":64,"h":64}, ...] }
// `frames` is optional — without it, frames are read left-to-right,
// top-to-bottom on a frameW × frameH grid.
interface Sheet {
  img: HTMLImageElement;
  fps: number;
  frames: { x: number; y: number; w: number; h: number }[];
}
const sheetCache = new Map<string, Sheet>();

export async function loadSheet(name: string): Promise<Sheet> {
  const hit = sheetCache.get(name);
  if (hit) return hit;
  const [img, meta] = await Promise.all([
    loadImg(`anim/${name}.png`, `sheet ${name}`),
    fetch(`anim/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`failed to load sheet manifest ${name}`);
      return r.json();
    }),
  ]);
  const frames =
    meta.frames ??
    Array.from({ length: Math.floor(img.width / meta.frameW) * Math.floor(img.height / meta.frameH) }, (_, i) => ({
      x: (i % Math.floor(img.width / meta.frameW)) * meta.frameW,
      y: Math.floor(i / Math.floor(img.width / meta.frameW)) * meta.frameH,
      w: meta.frameW,
      h: meta.frameH,
    }));
  const sheet: Sheet = { img, fps: meta.fps ?? 12, frames };
  sheetCache.set(name, sheet);
  return sheet;
}

export function sheet(name: string): Sheet {
  const s = sheetCache.get(name);
  if (!s) throw new Error(`sheet ${name} not loaded`);
  return s;
}

// Frame index wraps — call with Math.floor(t * sheet.fps) for a loop.
export function drawSheetFrame(
  ctx: CanvasRenderingContext2D,
  name: string,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = sheet(name);
  const f = s.frames[frame % s.frames.length];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, f.x, f.y, f.w, f.h, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

// --- gracidea NPC atlas: overworld trainer sprites for the region map ---
// TexturePacker hash JSON; packed-rotated frames are skipped — every class
// the map uses has an upright down/left frame.
let npcsImg: HTMLImageElement | undefined;
let npcFrames: Record<string, { x: number; y: number; w: number; h: number }> = {};

export function loadNpcs(): Promise<void> {
  if (npcsImg) return Promise.resolve();
  return Promise.all([
    loadImg('sprites/gracidea/npcs.webp', 'gracidea npcs'),
    fetch('sprites/gracidea/npcs.json').then((r) => {
      if (!r.ok) throw new Error('failed to load npcs manifest');
      return r.json();
    }),
  ]).then(([img, meta]) => {
    npcsImg = img;
    npcFrames = {};
    for (const [k, v] of Object.entries(meta.frames)) {
      const f = (v as { frame: { x: number; y: number; w: number; h: number }; rotated?: boolean });
      if (f.rotated) continue;
      npcFrames[k] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h };
    }
  });
}

// Draw an NPC sprite feet-anchored at x,y scaled to `h` px tall. The atlas
// is already transparent — no keying pass needed.
export function drawNpc(ctx: CanvasRenderingContext2D, frame: string, x: number, y: number, h: number) {
  const f = npcFrames[frame];
  if (!npcsImg || !f) return;
  const w = (h / f.h) * f.w;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(npcsImg, f.x, f.y, f.w, f.h, x - w / 2, y - h, w, h); // feet stand on y
  ctx.restore();
}
