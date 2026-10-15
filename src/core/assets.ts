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
