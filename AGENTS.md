# Pokéstrike

Pokémon × Monster Strike browser game. TypeScript + Canvas 2D, no game engine.
Vite dev server, 540×960 letterboxed logical space, custom circle physics.

## Commands

- `npm run dev` — dev server (default port 5173)
- `npm run build` — typecheck (`tsc --noEmit`) + production build
- `npm run typecheck` — types only
- No test suite yet; verify by running `npm run build` and playing a run

## Layout

- `src/core/` — engine plumbing: `vec.ts` (vector math), `loop.ts` (rAF loop), `assets.ts` (sprite cache), `audio.ts` (synth SFX + haptics)
- `src/game/data.ts` — all content: roster/enemy species with canonical base stats, stage waves (normalized arena coords), daily-stage generator
- `src/game/stats.ts` — stat-to-mechanic formulas (Atk/Def = physical, SpA/SpD = special, Spe = movement)
- `src/game/types.ts` — Pokémon type chart + colors
- `src/game/battle.ts` — battle scene: slingshot physics, turns, damage, bump combos, enemy AI, rendering
- `src/game/screens.ts` — title / draft / result drawing + hit rects (draft offers come from `draftOrder(rng)` in `data.ts`)
- `src/main.ts` — canvas sizing, scene state machine, pointer routing
- `public/sprites/<id>.png` — Gen 5 (Black/White) front sprites, 96×96 (id = Pokédex number); `sprites/anim/<id>.png` — matching BW animated vertical strip
- `public/sprites/bg/<theme>.png` — ripped DS battle grounds, arena-sized; `sprites/gracidea/` — overworld tileset atlas (16px frames, magenta key, index in `tileset.json`)

## Conventions

- Content changes are data changes: add a species/stage in `data.ts`, drop its
  sprite in `public/sprites/`. No new systems for single features.
- Each type's bump super is one case in the `bumpAlly` switch; its move name
  lives in `MOVE_NAME`, draft-card blurb in `TYPE_MOVE`, cooldown in
  `BUMP_CD` (all in `stats.ts`). Keep them in sync when changing a super.
- Arena geometry is normalized (`nx`/`ny` 0..1) so stages are resolution-free.
- Physics tunables are named consts at the top of `battle.ts`.
- Sprite theme is Gen 5 (Black/White) pixel art — statics from `versions/generation-v/black-white/` in PokeAPI/sprites, anim strips converted from the same generation's animated GIFs. New species must match this theme; this is a non-commercial fan project.
- All scenery is ripped game art, never procedural shapes: arena grounds are DS battle-background panels, props are overworld metatiles/tileset frames. New scenery = slice or blit real assets; don't invent blobs.

## Installed agent tooling (`.devin/`)

- `skills/ponytail*` — lazy senior-dev mode (see ruleset below)
- `skills/*` from obra/superpowers — brainstorming, TDD, debugging, etc.
- `skills/reverse-engineer-anything` + `mcp_config.json` — REA MCP server
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
