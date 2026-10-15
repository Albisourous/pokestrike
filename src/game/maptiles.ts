// Tile rects into sprites/gracidea/tileset.webp for the region map
// (map.ts). Eyeballed against the atlas — same convention as bg.ts's Slice.

export type TileRect = readonly [number, number, number, number];

// Terrain fills — the ~52px blocks at the atlas's bottom-left.
export const TILE_WATER: TileRect = [145, 361, 16, 16]; // dark sea, faint wave streaks
export const TILE_PATH: TileRect = [74, 648, 52, 52];
export const TILE_MOUNTAIN: TileRect = [129, 648, 50, 52];
export const TILE_GRASS: TileRect = [183, 648, 52, 52];

// Stop icons — drawn ~2 cells, so bigger landmark slices.
export const TILE_TOWN: TileRect = [1172, 353, 87, 80]; // green-roofed house
export const TILE_GYM: TileRect = [392, 2, 74, 57]; // red-roofed center

// Scenery + shore.
export const TILE_SAND: TileRect = [91, 667, 16, 16]; // pale beach sand
export const TILE_TREE: TileRect = [1980, 90, 54, 54]; // round-canopy tree
export const TILE_FLOWER: TileRect = [1710, 92, 16, 16]; // red flower patch
export const TILE_ROCK: TileRect = [1590, 22, 28, 30]; // pocked boulder
