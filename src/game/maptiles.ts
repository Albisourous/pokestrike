// Tile rects into sprites/gracidea/tileset.webp for the region map
// (map.ts). Eyeballed against the atlas — same convention as bg.ts's Slice.

export type TileRect = readonly [number, number, number, number];

// Terrain fills — the ~52px blocks at the atlas's bottom-left.
export const TILE_WATER: TileRect = [145, 361, 16, 16]; // dark sea, faint wave streaks
export const TILE_PATH: TileRect = [74, 648, 52, 52];
export const TILE_GRASS: TileRect = [183, 648, 52, 52];

// Stop icons — drawn ~2 cells, so bigger landmark slices.
export const TILE_TOWN: TileRect = [1172, 353, 87, 80]; // green-roofed house
export const TILE_GYM: TileRect = [398, 2, 68, 57]; // red-roofed center (left trunk sliver trimmed)

// Town-tab buildings — whole structures sliced from the atlas's mid bands.
// The top-band copies all touch the sheet edge (roofs clipped); these don't.
export const TILE_MUSEUM: TileRect = [399, 69, 72, 82]; // the institute — satellite dish on a parapet roof deck over a gray lab facade; the dome museum east of x552 is a neighbor, not the lab. Door ~x425
export const TILE_HALL: TileRect = [847, 200, 90, 76]; // columned pavilion: marquee lip at 200, stone base ends 276 — the orange behind is a neighbor, not the hall
export const TILE_TOWER: TileRect = [1441, 556, 87, 98]; // hexagonal jewel-domed tower — dome cap at 556, pillar base ends 654
export const TILE_CAFE: TileRect = [855, 342, 143, 144]; // the job hall — red roof, striped awning, flower boxes, teal patio with stools; door centered ~x927
export const TILE_GAZEBO: TileRect = [788, 355, 52, 85]; // wooden gazebo with a domed cap on a deck run — a park centerpiece
export const TILE_BUSH: TileRect = [1918, 92, 50, 63]; // round garden bush on a dirt base — a hedge that reads grown, not blobbed
export const TILE_FENCE: TileRect = [1664, 214, 58, 28]; // iron railing segment — a pond-side fence
export const FLOWER_PINK: TileRect = [1706, 90, 28, 26]; // pink wildflower cluster
export const FLOWER_WILD: TileRect = [1736, 92, 40, 26]; // white-and-yellow bed

// Scenery + shore.
export const TILE_SAND: TileRect = [91, 667, 16, 16]; // pale beach sand
export const TILE_FLOWER: TileRect = [1710, 92, 16, 16]; // red flower patch
export const TILE_ROCK: TileRect = [1590, 22, 28, 30]; // pocked boulder

// Battle-arena dressing (bg.ts prop ring + tiled floors, battle.ts scatter).
// Interiors are inset so block borders never tile; props keep alpha edges.
export const TILE_GRASSF: TileRect = [187, 652, 44, 44]; // grass block interior
export const TILE_COBBLE: TileRect = [140, 661, 28, 28]; // mountain block's cobble interior
export const TILE_SNOWF: TileRect = [30, 789, 30, 28]; // periwinkle drift interior
export const TILE_DRIFT: TileRect = [26, 785, 38, 34]; // whole rounded snow patch
export const TREE_ROUND: TileRect = [1762, 20, 34, 34]; // bushy oak on dirt base
export const TREE_PINE: TileRect = [1838, 17, 33, 36]; // tall conical pine
export const TREE_TEAL: TileRect = [1947, 16, 38, 36]; // swirly teal canopy
export const TREE_OLIVE: TileRect = [1987, 14, 34, 40]; // three-puff olive tree
export const TREE_ASH: TileRect = [1801, 84, 38, 50]; // pale ash pine — scorched when tinted
export const TREE_ASH2: TileRect = [1800, 146, 38, 50]; // second ash variant
export const ROCK_SMALL: TileRect = [1600, 58, 32, 23]; // loose blue-gray rock
export const FLOWER_YB: TileRect = [1727, 95, 15, 13]; // yellow+blue pair
export const FLOWER_PK: TileRect = [1727, 112, 15, 13]; // pink+white pair
