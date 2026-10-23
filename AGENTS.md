# Pokéstrike

Monster Strike pull-and-bounce combat in a Pokémon skin, with a Slay the
Spire run structure. TypeScript + Canvas 2D, no game engine. Vite dev
server, 540×960 letterboxed logical space, custom circle physics.

## Direction

- North star: **Monster Strike physics · Pokémon pixel-art theme · StS progression**. If a change serves none of the three, it's scope creep.
- One mode: the 9-stage gym climb (stages 1–3 seeded, 4–9 rolled, a gym every 3rd), via the START CLIMB button; `?seed=NNN` forces a seed for debugging. Endless is future work — don't build for it.
- Two level canons: **battle arenas are Archero** — each wave pulls one hand-authored 9×11 room template (`ROOM_LAYOUTS`/`ROOM_BOSS` char grids in `data.ts`: `2` rock, `3` liquid moat, `4` mine, `S` spawn anchor), never procedural geometry; **the overworld map is Slay the Spire** — the seeded branching node map it already is.
- Single art source: **Pokémon FireRed/LeafGreen (Gen 3 GBA)**. Mon sprites are official FRLG battle fronts vendored from [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (`sprites/pokemon/versions/generation-iii/firered-leafgreen/<id>.png`); item icons come from the same repo (`sprites/items/`). Scenery/props get sliced or blitted from the Gracidea `tileset`/`npcs` atlases at `public/sprites/gracidea/` (RSE, same era). Never procedural shapes.
- **Real asset before drawn asset, always.** For any icon, sprite, prop, or UI flourish, reach for a vendored Pokémon asset first — a mon front (`drawMon`/`itemSprite`), an item icon (`sprites/items/`), a badge (`sprites/badges/`), an NPC (`drawNpc`), or a slice/blit of the gracidea atlases. If the right asset isn't vendored yet, pull it from PokeAPI/sprites (or the gracidea pack) rather than inventing a glyph. Hand-drawn code (`*Glyph`, `fillStar`, shapes) is a last resort for things no asset covers — and keep them only as cold-cache fallbacks.
- Anti-goals: no monetization mechanics, no non-Pokémon content.
- Replayability, in order: run variety → ascension modifiers → unlockables. Keep it simple until the core is solid.

## Field lessons (from the RiftAtlas + MegaCrit postmortems)

- Feel before features: judge the sling on real touch hardware, not a mouse.
- Version the save: `pk_ver` + `migrateSaves()` at boot; never write inside
  readers. Bump `SAVE_VER` and add a step when a `pk_*` shape changes.
- Ship early; put `?seed=` links in front of players. Every run is seeded, so
  a shared link or a result-screen `SEED · build` receipt replays the climb.
- Log decisions, not vibes: `statOffer` records taken-vs-shown per board,
  `statRunEnd` records stage-keyed deaths (late pools are pre-filtered —
  condition on stage). `__dbg.stats()` under `?dev` dumps `pk_stats`.
- No daily mode — runs are `randSeed()`/`?seed=` only; `pk_run`'s `daily`/`modId` fields linger so parked daily saves still resume.
- Profile only jank you feel; no preemptive perf tooling.
- Nintendo has no fan-content policy — public distribution is the open legal
  risk. The content layer is data-driven (`data.ts` + vendored sprites) so a
  reskin is a data swap, not a rewrite.

## Commands

- `npm run dev` — dev server (default port 5173)
- `npm run build` — typecheck (`tsc --noEmit`) + production build
- `npm run typecheck` — types only
- `npm run smoke` — headless playthrough test (`test/smoke.ts`, bundled by
  rolldown): spawns waves, autoplayed climb, ascension/level/evo/shiny asserts
- Verify by `npm run build` + `npm run smoke`; a real run still beats both

## Layout

- `src/core/` — engine plumbing: `vec.ts` (vector math), `loop.ts` (rAF loop), `assets.ts` (sprite cache), `audio.ts` (synth SFX + haptics)
- `src/game/data.ts` — all content: roster/enemy species with canonical base stats, stage waves (normalized arena coords), seeded stage generator, `ROOM_LAYOUTS` 9×11 Archero room pool + `buildRoom` compiler
- `src/game/stats.ts` — stat-to-mechanic formulas (Atk/Def = physical, SpA/SpD = special, Spe = movement)
- `src/game/types.ts` — Pokémon type chart + colors
- `src/game/battle.ts` — battle scene: slingshot physics, turns, damage, bump combos, enemy AI, rendering + the region-map interstitial
- `src/game/map.ts` — seeded island generator for the climb map (value-noise terrain, decor); a fixed-lane StS tree: triplets of fork(2 battle doors) → fan(3 utility doors) → gym(1), edges deterministic by lane (door→own side+center, fan→gym, gym→both doors); tile draws key magenta from the gracidea tileset
- `src/game/events.ts` — the `?`-stop event pool (heals, catches, ambush scripted waves, egg)
- `src/game/traits.ts` — tiered type traits from fielded mons (shiny counts double)
- `src/game/ui.ts` — the menu-window chrome kit: palette (INK/PAPER/PARCH/GOLD), fonts (`font`/`fontB`), `uiWindow`/`uiBand`/`uiPanel` (double-framed paper windows + INK title band), `uiRow` (list rows, `on`=ink slab, `hot`=gold slab + ▶), `cursorTri` (blinking ▶), `scrim`, `uiClose`. Every panel/overlay draws through these — design spec: `docs/superpowers/specs/2026-10-22-menu-ux-overhaul.md`
- `src/game/maptiles.ts` — `TILE_*` source rects into `tileset.webp` for the map
- `src/game/meta.ts` — localStorage persistence: dex catches, rank, rival echo, mid-run save (`pk_run` banked at map safe points, CONTINUE on title), decision telemetry (`pk_stats`), and the earned-progression stores — stars/dust wallets, pulls + pity, lab, board, login calendar, rookie ladder, dex-reward tiers, free pull, streaks, first-win, session grind, mon bond (`pk_bond` per-species career pts → dust). New stores are unversioned shape-checked blobs (`load` + field validation + `mem*` fallback); only a `pk_*` shape change in a versioned blob needs `SAVE_VER` + `migrateSaves()`
- `src/game/tasks.ts` — daily/weekly task board + the UTC-seeded daily picks (`featuredPull` rate-up, `raidPick`/`raidTeam` chroma raid, `dealPick`/`dealCost` spark deal); seeded `do/while` picks are iteration-capped
- `src/game/screens.ts` — all drawing + hit rects: title home menu (ambient wilds, TODAY card, currency bar), draft offers (from `draftOrder(rng)` in `data.ts`), result card, and the overlays — hatcher (pull theatre + spark shop), lab, tasks, dex, trophies, board, help deck
- `src/main.ts` — canvas sizing, scene state machine, pointer routing
- `public/sprites/gracidea/` — scenery canon (see Direction): `tileset`, `npcs` WebP atlases + JSON frame indexes (16px frames, magenta key)
- `public/sprites/<id>.png` — 64×64 FRLG battle fronts by dex id, vendored from PokeAPI/sprites
- `public/sprites/items/<name>.png` — item icons from the same PokeAPI repo (`sprites/items/<name>.png`)
- `public/sprites/badges/<n>.png` — gym badge art from the same repo (`sprites/badges/<n>.png`, canon league order: Kanto 1–8, Johto 9–16, Hoenn 17–24); `GymBadge.icon` maps leaders to them

## Conventions

- Content changes are data changes: add a species/stage in `data.ts`, drop its
  sprite in `public/sprites/`. No new systems for single features.
- Each type's bump super is one case in the `bumpAlly` switch; its move name
  lives in `MOVE_NAME`, cooldown in `BUMP_CD` (all in `stats.ts`). Keep them
  in sync when changing a super.
- Arena geometry is normalized (`nx`/`ny` 0..1) so stages are resolution-free.
- Two UI faces: `font()` = Press Start 2P pixel display (vendored `public/fonts/PressStart2P-Regular.ttf`), `fontB()` = Roboto Condensed for dense stat/small print — pixel type runs ~1.7x wider, so cramped readouts use `fontB` and long labels `fitFont()`.
- New battle rooms are data: author a 9×11 char grid in `ROOM_LAYOUTS`
  (mirror-symmetric, anchors on floor, clear lanes — the loader validates
  dims and P→E/anchor reachability). First three entries stay gentle for
  stage openers; gyms use `ROOM_BOSS`.
- Physics tunables are named consts at the top of `battle.ts`.
- Asset canon is FRLG/Gen-3 (see Direction). Mons and items are vendored PNGs from PokeAPI/sprites; new scenery/props get sliced or blitted from `sprites/gracidea/` atlases.
- Scenery draws from the gracidea atlases (the prop pass landed) — new scenery still means slice or blit from the pack, never invented blobs.

## Installed agent tooling (`.devin/`)

- `skills/ponytail*` — lazy senior-dev mode (see ruleset below)
- `skills/*` from obra/superpowers — brainstorming, TDD, debugging, etc.
- `skills/design-taste-frontend`, `image-to-code`, `web-design-guidelines`, `playwright-cli` — installed via `npx skills add … -a devin`; design packs `retro`/`sega`/`dithered` from bergside/awesome-design-skills
- `skills/reverse-engineer-anything` + `mcp_config.json` — REA MCP server
- `uxskill` CLI — design-intelligence engine (pip/uv tool: `ux lint`,
  `ux recommend`, `ux design-md`, `ux-mcp` MCP server). `uxskill init` writes
  IDE artifacts (`.windsurfrules`); it once clobbered this file — restore from
  git if it rewrites `AGENTS.md` wholesale.
- `hooks.v1.json` — SessionStart hook injecting the superpowers bootstrap

---

# Ponytail, lazy senior dev mode

You are a lazy senior developer. The best code is the code never written. You solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.

## Before you write

Read the task and the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

## The smallest complete change

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every part the task needs, including the callers, tests and fixtures your change breaks.
- No abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the structure the codebase already has: its layers, interfaces and conventions.
- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Lazy code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new script or app) leaves one small test or an assert-based self-check. Trivial changes need none.
- A shortcut with a known limit gets a code comment in this form: `shortcut: <the limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

(Yes, this file also applies to agents working on the ponytail repo itself. Especially to them.)
