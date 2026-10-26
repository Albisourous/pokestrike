# Elemental Arenas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the battle arena to the element of the battle, grow from 4 to 11 elemental arenas (one per type), add a seeded room generator next to the authored layouts, bank ULT across the run, and ship a `?arena=` debug viewer.

**Architecture:** All themes are data. `Theme` widens to 11 ids and every `Record<Theme, …>` table gains entries — `tsc` enumerates every site that must be filled. New arenas reuse existing atlas slices + tints and existing hazard kinds; only new `TileRect`s and one `Weather` member (`storm`) are genuinely new code. `genRoom` emits the same 9×11 char grid `buildRoom` already parses.

**Tech Stack:** TypeScript + Canvas 2D, Vite, gracidea WebP atlas, `npm run build` (tsc+vite) + `npm run smoke` verification, playwright for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-25-elemental-arenas-design.md`

## Global Constraints

- Real Pokémon assets only: arena dressing is sliced/tinted from `public/sprites/gracidea/` atlases; no invented blobs (root AGENTS.md).
- Species pools must match canon habitat ("real Pokémon logic").
- `pk_*` shape change ⇒ `SAVE_VER` bump + `migrateSaves()` step.
- UI text: terse fragments, `·` delimiter, no em dashes, no AI tells.
- Commits: plain `git commit -m`, author stays `Albisourous`, no co-author trailers.
- Physics-edge readability: rim + cover silhouettes must stay legible in every new theme (BLOCK_FACE darker than floor).

## Review Focus

1. A `Record<Theme,…>` missed by tsc (e.g. `Partial<Record>` or keyed by string) silently defaults → audit `theme` indexing sites by grep after Task 1, not just the type error list.
2. `genRoom` must never wall off `P` from an `S` anchor or emit >40% blocked interior → flood-fill test in Task 4 asserts both.
3. `?arena=` forcing a theme must not corrupt seeded rng (no extra rng draws on the override path) → smoke test still passes; override reads no rng.
4. Parked `pk_run` saves from before `ultIn` existed must still resume (reader default) → Task 5 asserts migrate path in smoke.
5. Storm weather must boost electric ×1.5 / dull grass ×0.75 and only appear where mapped → `weatherMult` assertions in Task 2.

---

### Task 1: Widen `Theme` to 11 arenas + fill every table

**Files:**
- Modify: `src/game/bg.ts` (`Theme`, `THEMES`, `GROUND`, `RIM`, `GLOW`, `FILL`, `PATCH`, `WALL_PROPS`, `FACE`)
- Modify: `src/game/battle.ts` (`DECOR`, `AMBIENT`, `WEATHER_FOR`, `BLOCK_TINT`, `BLOCK_FACE`, moat/'3' reskin call site)
- Modify: `src/game/data.ts` (`ENEMY_THEME`, `THEME_NAME`, `MOAT_HAZARD`, `TYPE_THEME`, `buildRoom` '3' mapping)
- Modify: `src/game/maptiles.ts` (new `TileRect` consts mined from `public/sprites/gracidea/*.json`)
- Modify: `src/core/audio.ts` (`BIOME_TRACK` entries → nearest existing track)

**Interfaces:**
- Produces: `Theme = 'grove'|'cavern'|'volcano'|'sky'|'meadow'|'shore'|'plant'|'marsh'|'sanctum'|'dojo'|'tower'`; `TYPE_THEME: Record<PokeType,Theme>`; `MOAT_HAZARD: Record<Theme,HazardKind>` used by `buildRoom`'s `'3'` case.

- [ ] **Step 1:** Extend `Theme`/`THEMES`; run `npx tsc --noEmit` and collect the full list of `Record<Theme,…>` errors — that list IS the fill checklist.
- [ ] **Step 2:** Fill every table per the spec's per-arena element table (floors, wall props, faces, decor, ambient, block tints, moat hazards, stage names, enemy pools by canon habitat). Mine atlas JSON for sand/water-edge/fence/column rects; add `TILE_*` consts.
- [ ] **Step 3:** `npm run build` — must pass with zero `Theme`-coverage errors.
- [ ] **Step 4:** Eyeball each new theme once via dev server + `?dev` (screenshots land properly in Task 7; here just confirm no missing-slice holes).
- [ ] **Step 5:** Commit `feat: 11 elemental arenas — per-type court tables`.

### Task 2: `storm` weather

**Files:**
- Modify: `src/game/types.ts` (`Weather`, `WEATHER_OF`, `WEATHER_LINE`, `WEATHER_TINT`)
- Modify: `src/game/battle.ts` (`WEATHER_FOR.plant = 'storm'`; skyLabel map if it switches on Weather)

**Interfaces:**
- Produces: `Weather` gains `'storm'`; `WEATHER_OF.storm = ['electric','grass']`.

- [ ] **Step 1:** Add member + entries; `WEATHER_LINE.storm = 'THUNDERSTORM · ELECTRIC ×1.5'`, tint `#b8b8d0`.
- [ ] **Step 2:** Assert in `test/smoke.ts` (or a tsc-level check): `weatherMult('storm','electric') === 1.5`, `weatherMult('storm','grass') === 0.75`. Run `npm run smoke`.
- [ ] **Step 3:** Commit.

### Task 3: Theme selection rule (kill per-wave rotation)

**Files:**
- Modify: `src/game/battle.ts` (`spawnWave` ~line 1211-1215; `rollWave` call sites ~1194, 1202)
- Modify: `src/game/data.ts` (`TYPE_THEME` consumed here)

**Interfaces:**
- Consumes: `TYPE_THEME` (Task 1), `arenaOverride` debug hook (Task 6 supplies the param reader — land the call site here behind a `debugArena()` helper Task 6 defines in `main.ts`; keep a stub `= null` if Task 6 hasn't landed).

- [ ] **Step 1:** In `spawnWave`: replace rotation with — `this.theme = debugArena() ?? (ttype ? TYPE_THEME[ttype] : this.stage.theme)`.
- [ ] **Step 2:** `rollWave` biome argument: pass `this.stage.theme` (deep waves stay in-biome); gym row already passes `node.ttype`.
- [ ] **Step 3:** `npm run build` + `npm run smoke` — seed determinism must hold (no new rng draws on this path).
- [ ] **Step 4:** Commit `fix: arena follows the element of the battle, not a per-wave roll`.

### Task 4: `genRoom` seeded room generator

**Files:**
- Modify: `src/game/data.ts` (`genRoom`, `rollRoom`, per-biome stamp tables, flood-fill validator)
- Modify: `src/game/battle.ts` (room pull ~line 1297: authored 60% / generated 40%; openers + `ROOM_BOSS` unchanged)
- Modify: `src/main.ts` (`__dbg.room(theme)` dev export under `?dev`)

**Interfaces:**
- Produces: `genRoom(theme: Theme, rng: () => number): string[]` (9×11 `ROOM_LAYOUTS` charset); `rollRoom(rng, theme, pool): string[]` picks authored/generated; `__dbg.room(theme?)` → `{ bg, fg, behavior }` JSON dump of last/generated grid.

- [ ] **Step 1:** Write the failing test in `test/smoke.ts`: for each of the 11 themes × 8 seeds, `genRoom` output is 9×11, border `1`, contains `P`+≥1 `S`, and flood-fill from `P` reaches every `S` and `E` with ≤40% interior non-floor. Run — fails (no `genRoom`).
- [ ] **Step 2:** Implement `genRoom`: per-biome stamp table (`clusters`/`lanes`/`scatter`/`ring` with per-theme hazard char palette — e.g. shore cluster `'3'`, plant lanes `'2'`, tower scatter `'4'`/`'8'`); stamp → validate (flood fill + density) → retry ≤6 → fallback open room grid.
- [ ] **Step 3:** Wire `rollRoom` into the wave pull; `__dbg.room` export.
- [ ] **Step 4:** `npm run smoke` passes (incl. new asserts); `npm run build`.
- [ ] **Step 5:** Commit `feat: seeded per-biome room generator alongside authored layouts`.

### Task 5: ULT banks across the run

**Files:**
- Modify: `src/game/battle.ts` (remove `spawnWave` reset ~1181; `snapshot`/`applySnapshot` stamp `ultIn`; armed-entry toast)
- Modify: `src/game/meta.ts` (`RunSave.ultIn?`, `SAVE_VER` bump + migrate step)

**Interfaces:**
- Produces: `RunSave.ultIn?: number`; Battle keeps `ultIn` field — unchanged name.

- [ ] **Step 1:** Delete the reset line; field initializer keeps `ULT_SHOTS`; `fireUlt` re-arm already correct.
- [ ] **Step 2:** `snapshot()` adds `ultIn: this.ultIn`; `applySnapshot` restores `s.ultIn ?? ULT_SHOTS`; bump `SAVE_VER`, add migrate step (default `ULT_SHOTS`).
- [ ] **Step 3:** On first `aim` phase of a wave, if `ultIn <= 0` and it was already armed at wave start, draw a small `ULT READY` tag under the shots pill (reuse existing pill style; no new UI system).
- [ ] **Step 4:** `npm run build` + `npm run smoke`; smoke assert: two consecutive `spawnWave`s don't reset `ultIn`.
- [ ] **Step 5:** Commit `feat: team ult banks across the whole run + parked saves`.

### Task 6: `?arena=` debug viewer + HUD arena label

**Files:**
- Modify: `src/main.ts` (`debugArena(): Theme | null` — parses `?arena=<name|index>` once, `?dev`-gated)
- Modify: `src/game/battle.ts` (HUD: under the stage-name pill, `?dev` draws `ARENA · <THEME_NAME[theme]>`)

**Interfaces:**
- Produces: `debugArena()` consumed by Task 3's `spawnWave`.

- [ ] **Step 1:** Implement `debugArena` (name or `THEMES` index; invalid → null). Import into battle via a small exported setter or direct import — match existing `?dev` plumbing style.
- [ ] **Step 2:** HUD label (fontB, small, under stage pill, `?dev`-gated).
- [ ] **Step 3:** `npm run build`; manual: `?dev&seed=1&arena=shore` boots into the shore court with the label visible.
- [ ] **Step 4:** Commit `feat: ?arena= debug viewer + arena name HUD tag`.

### Task 7: Screenshot pass — all 11 arenas

**Files:**
- None (verification only); screenshots to `docs/` alongside existing `_boot*.png`s.

- [ ] **Step 1:** `npm run dev`; playwright-cli: for each `?dev&seed=1&arena=<id>`, load, dismiss to battle, capture `docs/_arena_<id>.png`. 11 shots.
- [ ] **Step 2:** Review the sheet: physics rim readable, no missing-slice holes, element reads at a glance; fix tint/prop choices that fail the eye test.
- [ ] **Step 3:** `npm run build` + `npm run smoke` green; commit any tuning + screenshots `docs: elemental arena screenshot sheet`.

## Self-review notes

- Spec coverage: arenas ✓(T1), theme rule ✓(T3), generator ✓(T4), ULT ✓(T5), debug ✓(T6), tracker doc updated as statuses land (fold into T7 commit).
- Order matters: T1 unblocks T3/T4 (types exist); T2 feeds T1's `WEATHER_FOR.plant` — land T2 first or fill plant weather in T1 then upgrade in T2 (either order works; do T2 first to keep T1's diff data-only).
