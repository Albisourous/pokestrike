# Elemental Arenas — design + tracker

Date: 2026-10-25 · Status: proposed · Owner: dev

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
| grass     | grove    | Viridian Forest — deep woods, flowers     | exists |
| rock      | cavern   | Mt. Moon / Rock Tunnel — boulder dark     | exists |
| fire      | volcano  | Cinnabar/Mt. Ember — basalt, embers       | exists |
| flying    | sky      | high summit — snow peak, thin air         | exists |
| normal    | meadow   | Route fields — tall grass, fences, hay    | new    |
| water     | shore    | Cerulean/Seafoam — sand, pond slicks      | new    |
| electric  | plant    | Kanto Power Plant — industrial slabs      | new    |
| poison    | marsh    | Fuchsia Safari Zone — bog, dead trees     | new    |
| psychic   | sanctum  | Ruins of Alph — broken columns, dusk      | new    |
| fighting  | dojo     | Saffron Fighting Dojo — packed-dirt ring  | new    |
| ghost     | tower    | Pokémon Tower, Lavender — graves, wisps   | new    |

`TYPE_THEME: Record<PokeType, Theme>` in `data.ts` owns this map. Theme ids
are short strings; `THEME_NAME` gains the stage-name entries below.

## Theme selection rule

`spawnWave` stops rotating themes. Resolution order:

1. `?arena=<name|index>` debug override (dev only) — forces every wave.
2. Trainer / elite / gym node → `TYPE_THEME[node.ttype]` — the element of
   the battle.
3. Everything else (wild rows, `?`-events, rival echo, raids without a
   declared theme) → `stage.theme`.

`makeStage` keeps picking `stage.theme` from `THEMES` — now 11 entries, so
rolled stages spread across the full elemental set automatically.
`rollWave`'s per-row `THEMES[…]` argument passes `stage.theme` instead so
deep waves stay in-biome.

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
| sanctum | cobble violet / cracked dark  | hall-column slices·rocks / rubble        | —       | drifting motes   | warp     | Alph Ruins      |
| dojo    | packed dirt (sand/path) / scuff | rocks·fence rails / sand tufts         | —       | kicked dust      | boost    | Saffron Dojo    |
| tower   | cobble grave-dark / darker    | dead trees·grave rocks / small rocks     | —       | violet wisps     | warp     | Lavender Tower  |

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

## ULT banking

`ultIn` is a run resource, not a wave resource:

- Delete the per-wave `this.ultIn = ULT_SHOTS` reset in `spawnWave` — the
  field initializer already sets it; `fireUlt` already re-arms on spend.
- `RunSave` gains `ultIn?: number` (snapshot stamps it, `applySnapshot`
  restores it) — `pk_*` shape change ⇒ `SAVE_VER` bump + migrate step per
  AGENTS.md.
- HUD: the armed/ready state already pulses gold; a banked-armed ULT shows
  the same "ULTIMATE READY" toast once on the first wave it carries into
  (only if it arms mid-wave, or armed-at-entry shows `ULT READY` tag — one
  line, no new UI).

## Debug arena viewer

`?dev&arena=<name|index>`:

- forces `this.theme` every `spawnWave` (resolution step 1 above)
- HUD draws `ARENA · <name>` under the stage-name pill in `?dev` always —
  cheap, and makes screenshot review of all 11 arenas a one-link job:
  `?dev&seed=1&arena=6`

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
