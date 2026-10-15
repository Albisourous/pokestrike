// Terrain + landmark slices in tileset.webp (eyeballed — see tileset.json for grid).
// Frames are 16x16 on an 18px pitch: frame (col,row) sits at x=1+col*18, y=1+row*18.
export type Slice = readonly [number, number, number, number];
export const TILE_WATER: Slice = [145, 361, 16, 16]; // flat sea water, faint wave streaks
export const TILE_GRASS: Slice = [55, 325, 16, 16]; // mid-green blade grass
export const TILE_PATH: Slice = [289, 109, 16, 16]; // flat brown dirt
export const TILE_MOUNTAIN: Slice = [302, 123, 50, 56]; // chunky tan boulder pile
export const TILE_TOWN: Slice = [402, 452, 72, 76]; // timber-frame house: shingle roof, door, window
export const TILE_GYM: Slice = [545, 0, 104, 92]; // big gym building, "GYM" sign + blue doors
export const TILE_SAND: Slice | null = [91, 667, 16, 16]; // pale beach sand with wave marks
