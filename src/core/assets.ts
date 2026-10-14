const cache = new Map<number, HTMLImageElement>();
const itemCache = new Map<string, HTMLImageElement>();

export function loadSprite(id: number): Promise<HTMLImageElement> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      cache.set(id, img);
      res(img);
    };
    img.onerror = () => rej(new Error(`failed to load sprite ${id}`));
    img.src = `sprites/${id}.png`;
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

export function loadAll(ids: number[]): Promise<HTMLImageElement[]> {
  return Promise.all([...new Set(ids)].map(loadSprite));
}

export function sprite(id: number): HTMLImageElement {
  const img = cache.get(id);
  if (!img) throw new Error(`sprite ${id} not loaded`);
  return img;
}
