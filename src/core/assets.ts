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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite(id), x - size / 2, y - size / 2, size, size);
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shinySprite(id), x - size / 2, y - size / 2, size, size);
}

// White silhouette of the front sprite — the evolving mon's glow frames.
const whiteCache = new Map<number, HTMLCanvasElement>();
export function whiteSprite(id: number): HTMLCanvasElement {
  let c = whiteCache.get(id);
  if (!c) {
    const img = sprite(id);
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const t = c.getContext('2d')!;
    t.imageSmoothingEnabled = false;
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = '#ffffff';
    t.fillRect(0, 0, c.width, c.height);
    whiteCache.set(id, c);
  }
  return c;
}

// --- gracidea NPC atlas: overworld trainer sprites for the region map ---
// TexturePacker hash JSON; rotated frames un-pack via a 90° canvas turn —
// a few families (wally, several generics) only ship their down/up frames
// rotated, so skipping them blanks whole rows.
let npcsImg: HTMLImageElement | undefined;
let npcFrames: Record<string, { x: number; y: number; w: number; h: number; rot?: boolean }> = {};

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
      npcFrames[k] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, ...(f.rotated ? { rot: true } : {}) };
    }
  });
}

// Draw an NPC sprite feet-anchored at x,y scaled to `h` px tall. The atlas
// is already transparent — no keying pass needed.
export function drawNpc(ctx: CanvasRenderingContext2D, frame: string, x: number, y: number, h: number) {
  const f = npcFrames[frame];
  if (!npcsImg || !f) return;
  ctx.imageSmoothingEnabled = false;
  if (!f.rot) {
    const w = (h / f.h) * f.w;
    ctx.drawImage(npcsImg, f.x, f.y, f.w, f.h, x - w / 2, y - h, w, h); // feet stand on y
    return;
  }
  // packed 90° CW: upright dims are the packed w/h swapped — pivot at the
  // feet's left corner, turn the canvas so the sprite lands upright
  ctx.save();
  const uw = (h / f.w) * f.h;
  ctx.translate(x - uw / 2, y);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(npcsImg, f.x, f.y, f.w, f.h, 0, 0, h, uw);
  ctx.restore();
}
