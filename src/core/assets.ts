const cache = new Map<number, HTMLImageElement>();

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

export function loadAll(ids: number[]): Promise<HTMLImageElement[]> {
  return Promise.all([...new Set(ids)].map(loadSprite));
}

export function sprite(id: number): HTMLImageElement {
  const img = cache.get(id);
  if (!img) throw new Error(`sprite ${id} not loaded`);
  return img;
}
