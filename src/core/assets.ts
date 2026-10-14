const cache = new Map<number, HTMLImageElement>();
const itemCache = new Map<string, HTMLImageElement>();
const animCache = new Map<number, HTMLImageElement>();

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
  // animated strip rides along; missing file just means "stay static"
  loadImg(`sprites/anim/${id}.png`, `anim ${id}`)
    .then((img) => animCache.set(id, img))
    .catch(() => {});
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

// Draw a Pokémon centered at x,y at `size` px. When an animated strip is
// loaded (vertical stack of square cells, Essentials-style) we step frames
// at ~12fps; otherwise the static sprite is drawn. Nearest-neighbor keeps
// the pixel art crisp at non-integer scales.
export function drawMon(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number) {
  const sheet = animCache.get(id);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (sheet) {
    const w = sheet.width;
    const frames = Math.round(sheet.height / w);
    const f = Math.floor(performance.now() / 80 + id * 0.6) % frames;
    ctx.drawImage(sheet, 0, f * w, w, w, x - size / 2, y - size / 2, size, size);
  } else {
    ctx.drawImage(sprite(id), x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();
}
