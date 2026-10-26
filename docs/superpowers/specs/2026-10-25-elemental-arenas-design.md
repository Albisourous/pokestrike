# Elemental Arenas — design + tracker

Date: 2026-10-25 · Status: implemented (0b56f91…840e6a0) · Owner: dev

## Intent

The court should read as a *place with an element*, not a random backdrop.
Today `spawnWave` re-rolls `theme` every wave (`battle.ts`), so "Viridian
Wilds" draws forest enemies on a snow summit. This spec locks the arena to
the element of the battle, grows the roster from 4 arenas to one per type
(11), adds a seeded room generator alongside the authored layouts, banks
the team ULT across the whole run, and ships a `?arena=` debug viewer.

This file is also the arena tracker: the per-arena tables below are the
checklist implementation fills in. When an arena lands, flip its status
and keep the table honest — it is the list of "elements that can show up"
per biome.

## Decisions (from the user)

- One arena per type — 11 total, 7 new.
- Theme never changes mid-battle. Stage-locked biome; trainer/elite/gym
  nodes fight in *their* type's arena (the element of the battle).
- Rooms: keep authored `ROOM_LAYOUTS` **and** add a seeded per-biome
  generator that authors new rooms at runtime.
- ULT charge banks across the whole run, surviving saves.

## Type → arena map (real Pokémon biome logic)

| Type      | Arena    | Canon anchor                              | Status |
|-----------|----------|-------------------------------------------|--------|
| grass     | grove    | Viridian Forest — deep woods, flowers     | shipped (docs/_arena1.png)  |
| rock      | cavern   | Mt. Moon / Rock Tunnel — boulder dark     | shipped (docs/_arena2.png)  |
| fire      | volcano  | Cinnabar/Mt. Ember — basalt, embers       | shipped (docs/_arena3.png)  |
| flying    | sky      | high summit — snow peak, thin air         | shipped (docs/_arena4.png)  |
| normal    | meadow   | Route fields — tall grass, fences, hay    | shipped (docs/_arena5.png)  |
| water     | shore    | Cerulean/Seafoam — sand, pond slicks      | shipped (docs/_arena6.png)  |
| electric  | plant    | Kanto Power Plant — industrial slabs      | shipped (docs/_arena7.png)  |
| poison    | marsh    | Fuchsia Safari Zone — bog, dead trees     | shipped (docs/_arena8.png)  |
| psychic   | sanctum  | Ruins of Alph — broken columns, dusk      | shipped (docs/_arena9.png)  |
| fighting  | dojo     | Saffron Fighting Dojo — packed-dirt ring  | shipped (docs/_arena10.png) |
| ghost     | tower    | Pokémon Tower, Lavender — graves, wisps   | shipped (docs/_arena11.png) |

`TYPE_THEME: Record<PokeType, Theme>` in `data.ts` owns this map. Theme ids
are short strings; `THEME_NAME` gains the stage-name entries below.

## Theme selection rule

`spawnWave` stops rotating themes. Resolution order (shipped):

1. Debug pin — `?debug=arena1..11` or `?dev&arena=<name|index>` — forces
   every wave. (`parseArenaPin` in battle.ts)
2. Trainer / elite / gym node → `TYPE_THEME[node.ttype]` — the element of
   the battle.
3. Wild deep waves → the per-row biome remembered in `deepThemes`; the
   rest → `stage.theme`.

`makeStage` keeps picking `stage.theme` from `THEMES` — now 11 entries, so
rolled stages spread across the full elemental set automatically.

## Per-arena element tables — THE TRACKER

Every arena must fill the same slots. `bg.ts`: `GROUND`, `RIM`, `GLOW`,
`FILL`, `PATCH`, `WALL_PROPS`, `FACE`. `battle.ts`: `DECOR`, `AMBIENT`,
`WEATHER_FOR`, `BLOCK_TINT`, `BLOCK_FACE`. `data.ts`: `ENEMY_THEME`,
`THEME_NAME`, `MOAT_HAZARD`. `audio.ts`: `BIOME_TRACK` (reuses the nearest
existing track — no new compositions in v1). New atlas rects land in
`maptiles.ts` as needed, mined from `public/sprites/gracidea/*.json`.

Weather uses the existing four skies; `storm` (electric×1.5 / grass×0.75)
is added because rain+Thunder is canon and the plant deserves a sky.
`—` means no weather forced; gyms there run a clear court.

| Arena   | Floor (FILL/PATCH)            | Wall props (hi / lo)                     | Weather | Ambient          | Moat '3' | Stage name      |
|---------|-------------------------------|------------------------------------------|---------|------------------|----------|-----------------|
| grove   | grassf / path dirt            | oaks·pines·olive·teal / flowers          | rain    | petals           | static   | Viridian Wilds  |
| cavern  | cobble indigo / cobble dark   | boulders·cairns / small rocks            | sand    | dust motes       | static   | Echo Cavern     |
| volcano | cobble basalt / scorch        | burnt snags·hot rocks / ember rocks      | sun     | embers           | lava     | Cinder Crag     |
| sky     | snow drift / drift patches    | frosted pines·iced rocks / drifts        | wind    | slant snow       | ice      | Gale Heights    |
| meadow  | grassf pale / path            | bushes·fence rails / tall-grass tufts    | —       | pollen drift     | grass    | Route Fields    |
| shore   | sand / water-edge patches     | rocks·fence / drift+tufts at the tideline| rain    | mist spray       | well     | Cerulean Shore  |
| plant   | cobble gray-rust / oil dark   | rocks iron-tint·small rocks / scrap      | storm   | spark flickers   | power    | Vermilion Plant |
| marsh   | grassf bog-tint / pond slicks | dead trees·rocks / weed tufts            | rain    | firefly motes    | static   | Fuchsia Marsh   |
| sanctum | cobble violet / cracked dark  | hall-column slices·rocks / rubble        | —       | drifting motes   | well     | Alph Ruins      |
| dojo    | packed dirt (sand/path) / scuff | rocks·fence rails / sand tufts         | —       | kicked dust      | boost    | Saffron Dojo    |
| tower   | cobble grave-dark / darker    | dead trees·grave rocks / small rocks     | —       | violet wisps     | static   | Lavender Tower  |

Enemy pools (`ENEMY_THEME`): new arenas draw from `ENEMY_DB` by canon
habitat — water+ice mons to shore, electric+steel-ish to plant, poison+bug
to marsh, psychic+fairy-ish to sanctum, fighting to dojo, ghost+dark-ish
to tower, plain normals to meadow. Exact id lists are a data diff; rule:
**species must plausibly live there in the games** (the user's "real
Pokémon logic").

## Room generator (alongside authored layouts)

`genRoom(theme, rng): string[]` in `data.ts` produces a 9×11 grid in the
exact `ROOM_LAYOUTS` charset (`0 2 3 4 5 6 7 8 S`, border `1`, `P`, `E`),
so `buildRoom` consumes generator output untouched. Per-biome stamp
patterns compose the room:

- **clusters** — cellular-automata blob of moat/mine cells (shore ponds,
  marsh bogs, tower warps)
- **lanes** — slab rows/columns leaving guaranteed corridors (plant
  machinery rows, dojo ring posts, sanctum columns)
- **scatter** — sparse single-cell hazards on hash grid (mines, spikes)
- **ring** — perimeter-adjacent hazards for hard rooms (keep/saltire style)

Validation (from the generator spec): interior flood-fill from `P` must
reach every `S` anchor and the `E` strip; ≤40% blocked interior; on
failure the stamp re-rolls (capped iterations), final fallback is the
open authored room. Generated rooms join the pull next to authored ones:
`rollRoom` picks authored ~60% / generated ~40%, gentle-authored still
owns stage openers and `ROOM_BOSS` owns gyms.

Debug: under `?dev`, `__dbg.room(theme)` dumps the last generated room as
`{ bg[][], fg[][], behavior[][] }` (the spec's JSON node shape — `0x0C`
floor, `0x01` blocked, `0x02` hazard) for inspection.

Shipped extras past the spec: **ring** is the 4th stamp (perimeter hazards,
35% of generated rooms); `buildRoom`'s roamer gimmick is keyed per-theme
(`GIMMICK` — sanctum/tower warp, shore warp, dojo/plant boost, the wet
biomes well) instead of a flat 3-way roll; `&wave=M` and `&room=gen|authored`
extend the preview URL.

## ULT banking — shipped

`ultIn` is a run resource, not a wave resource:

- The per-wave `this.ultIn = ULT_SHOTS` reset in `spawnWave` is gone — the
  field initializer arms a fresh run; `fireUlt` re-arms on spend.
- `RunSave.ultIn?: number` — snapshot stamps it, `applySnapshot` restores
  it (`?? ULT_SHOTS` for pre-field saves). Optional field + default, the
  house pattern for `pk_run` evolution — no `SAVE_VER` bump needed.

## Debug arena viewer — shipped

`?debug=arena<N>` (N = 1..11, 1-based over `THEMES`):

- sandboxes `pk_*` to `pk_debug_*` (meta.ts `DEBUG` treats `debug=arena*`
  like `debug=1`) — the preview never writes the real save
- boots straight past the title into the pinned court on a stock roster
- the HUD stage tag shows the arena's `THEME_NAME` while pinned
- `?dev&arena=<name|index>` still pins courts inside a normal dev run
- `__dbg.room(theme, seed)` under `?dev` dumps a generated room as
  `{ bg, fg, behavior }` nodes per cell

## Non-goals

- New music tracks (new arenas borrow the nearest `BIOME_TRACK` entry)
- Map-node/island reskin — the StS map keeps its current look
- New hazard *mechanics* — new arenas reuse the existing kinds; only the
  moat reskin key (`MOAT_HAZARD`) is new data
- Weather types beyond `storm`
- The mid-run `pk_run` migration touches only `ultIn`

## Calls I made (flag if wrong)

- Gyms with no canon weather (meadow/sanctum/dojo/tower) run a clear
  court rather than a wrong-element sky.
- Authored:generated pull ratio is 60:40; generator failure falls back
  to the open room, never crashes a wave.
- `storm` weather added (electric boost) — one new `Weather` member.
- Arena names reuse canon place names where one fits (Power Plant,
  Pokémon Tower, Safari Zone→Marsh, Alph Ruins, Saffron Dojo).
- Sanctum/tower moats ship `well`/`static`, not `warp` — unpaired '3'
  cells chain-link into an unpredictable teleport net (unpaired warps
  connect to each other). A warp room should be authored, not rolled.
- No `SAVE_VER` bump for `ultIn` — optional field + `??` default is the
  `pk_run` evolution pattern (`eggIn`, `tagEchoDone`).
