const cache = new Map<number, HTMLImageElement>();
const itemCache = new Map<string, HTMLImageElement>();
const animCache = new Map<number, { img: HTMLImageElement; frames: number; delay: number }>();

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
    img.src = `sprites/items/${name}.png`;
  });
}

export function itemSprite(name: string): HTMLImageElement | undefined {
  return itemCache.get(name);
}

// Animated Gen V sheets: horizontal strips of 96x96 frames converted from the
// real Black/White sprites, with per-species frame counts + delays from the
// GIFs baked into manifest.json.
export async function loadAnims(ids: number[]) {
  let manifest: Record<string, { f: number; d: number }>;
  try {
    manifest = await (await fetch('sprites/anim/manifest.json')).json();
  } catch {
    return; // no manifest — everything falls back to statics
  }
  await Promise.all(
    ids.map(async (id) => {
      const m = manifest[id];
      if (!m) return;
      try {
        const img = await loadImg(`sprites/anim/${id}.png`, `anim ${id}`);
        animCache.set(id, { img, frames: m.f, delay: m.d });
      } catch {
        // missing sheet -> static sprite fallback
      }
    }),
  );
}

export function loadAll(ids: number[]): Promise<HTMLImageElement[]> {
  return Promise.all([...new Set(ids)].map(loadSprite));
}

export function sprite(id: number): HTMLImageElement {
  const img = cache.get(id);
  if (!img) throw new Error(`sprite ${id} not loaded`);
  return img;
}

// Draw a Pokémon centered at x,y at `size` px — animated sheet if loaded,
// static sprite otherwise. t is the running clock in seconds.
const FRAME = 96;
export function drawMon(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number, t: number) {
  const a = animCache.get(id);
  if (!a) {
    ctx.drawImage(sprite(id), x - size / 2, y - size / 2, size, size);
    return;
  }
  const f = Math.floor((t * 1000) / a.delay) % a.frames;
  ctx.drawImage(a.img, f * FRAME, 0, FRAME, FRAME, x - size / 2, y - size / 2, size, size);
}
