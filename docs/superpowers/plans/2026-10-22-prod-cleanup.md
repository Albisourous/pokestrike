# Production Cleanup & Smoothness — Implementation Plan

> **For agentic workers:** executed via parallel subagent workstreams; file
> ownership is disjoint so implementers run concurrently.

**Goal:** ship-readiness pass — fix silent-failure boot paths, remove dead
code/assets, and cut per-frame GC churn + storage-parse storms.

**Architecture:** audits produced ~40 findings. Grouped into 4 file-disjoint
workstreams so four implementer subagents run in parallel without conflicts.
The single highest-leverage change is a raw-string parse cache inside
`meta.ts`'s `load()` — it centrally fixes the per-frame `localStorage`
read + `JSON.parse` storm (~15 parses/frame on title) without touching the
~40 call sites.

## Global Constraints

- Verify with `npx tsc --noEmit` only during implementation; the controller
  runs `npm run smoke` + `npm run build` at integration (shared output
  paths would race under parallel agents). Exception: WS-A may run
  `npm run smoke` (sole owner of test/smoke.ts).
- No new dependencies. No visual changes intended — glow/gradient
  replacements must preserve the current look.
- Physics/determinism unchanged: in-place array compaction must preserve
  element order; seeded picks stay pure functions of their seed.
- `load()` cache must stay correct for cross-tab writes (key on raw string)
  and mem-fallback mode (storage unavailable).
- Commits: controller stages per-workstream and commits (plain -m, no
  trailers). Implementers do NOT commit.

## Cross-workstream contracts

- **WS-B produces:** `Battle.drawBalls(ctx, yMin, yMax): void` — public
  method that draws the catch-ritual ball layer with each ball's `y`
  clamped into `[yMin, yMax]` for the call, restored after. Replaces the
  `as unknown` type pun in main.ts:2055-2064.
- **WS-C consumes** that signature in main.ts.
- **WS-A produces:** `load(key)` raw-string cache (transparent — no
  call-site changes anywhere) and memoized daily picks in tasks.ts
  (`raidPick`, `featuredPull`, `dealPick`, `dailyMod`) keyed on the day's
  seed — transparent signature-wise.

---

## WS-A — storage layer: safety + parse cache
**Files:** `src/core/audio.ts`, `src/game/meta.ts`, `src/game/events.ts`,
`src/game/tasks.ts`, `src/game/daily.ts`, `test/smoke.ts`

- audio.ts:12,21 — wrap `localStorage` access in try/catch (module-eval
  read AND `toggleMute` write); unguarded throw = silent black screen.
- audio.ts — migrate `pk-mute` → `pk_mute` (read legacy key once, write
  new; keep legacy read for compat). Delete dead `JINGLES['win']` entry +
  `'win'` from `JingleKind` union.
- meta.ts `load()` — add raw-string cache (`Map<key,{raw,val}>`): return
  cached parsed value when `getItem` returns the identical string;
  `store`/`remove` update the cache. Fixes title-screen ~15 parses/frame
  + overlay reads centrally.
- meta.ts `settings()` — cache the merged object behind the same raw-
  string guard (callers: `addShake`/`addPunch` per hit, `drawWeather`,
  aim guide, battery check per frame).
- meta.ts `stats()` ~:896-922 — coerce non-array stat entries
  (`Array.isArray` guard) before `e[1]++`; tampered `pk_stats` currently
  throws in a tap handler → latched crash card.
- tasks.ts — memoize `raidPick`/`featuredPull`/`dealPick` (and `dailyMod`
  in daily.ts) keyed on `daySeed(now)`; currently ~25 seeded
  `pullSpecies` draws per frame on title.
- events.ts:77 — add the codebase-convention `shortcut:` comment on the
  `region` type pun (matches main.ts:2053 convention).
- test/smoke.ts — add asserts: store→load returns fresh value through the
  cache; corrupt `pk_stats` entry doesn't throw `statOffer`; daily-pick
  memo returns identical value for same day and differs across seeds.

## WS-B — battle loop: GC churn + glow cost
**Files:** `src/game/battle.ts`, `src/game/bg.ts`, `src/game/maptiles.ts`

- `Battle.update` (~:1667-1748) — ~14 `.filter()` reallocations per frame
  → in-place compaction (`let w=0; …; arr.length=w`) or dirty-flag gate;
  preserves order. Include `delays`/`due` (:1747-48), `stepLoot` :4564,
  and `[...enemies,...players]` spreads :1624,1725.
- `stepEnemyMovement` (:1963-2021) — kill per-frame allocs: nearest target
  via scalar `dx²+dy²` (no `reduce`/`Math.hypot`), write `vx/vy` with
  scalar normalize (no `norm`/temp vec), `.slice()` copy out. Same for
  `collide` `norm` alloc (:2360-75), `inStatic` `dist` alloc (:2304),
  `strikeEnemy` taunt/hazard rescans (:2695,:2733).
- `shadowBlur` — replace per-frame blur with cached look: wave rings
  (:7852-77, blur 26), orbs (:5849-62, blur 22), charge ring (:7801, 12),
  aim arrow (:7823, 16). Bake once per (size,color) to offscreen canvas
  or pre-built `CanvasGradient`; `drawImage` per frame. Keep look.
- Gradients — cache `CanvasGradient` for map fades/vignette (:6750-65)
  and `bg.ts` `drawBackdrop` light pool (:492-501). Hoist `AMBIENT`
  literal out of render (:5543).
- Public API — add `drawBalls(ctx, yMin, yMax)` (contract above).
- `?mark` spike (:24, uses ~:7281,7289,7378-84) — DELETE the spike
  entirely (comment says "not shipping UI"; `public/_mock/` also goes).
- maptiles.ts:9 — delete unused `TILE_MOUNTAIN`.
- Optional-if-cheap: `drawCoach` filter+sort only while coach visible
  (:6384-86); `evoFx.some`/shiny `starPath` precompute (:7330-66).

## WS-C — boot + UI: robustness + draw cost
**Files:** `src/main.ts`, `src/game/screens.ts`

- main.ts — move `error`/`unhandledrejection` listeners to the TOP of the
  module (before canvas/ctx non-null asserts at :127-128); boot failure
  currently paints once then `resize()` wipes to black — draw failure
  card with `TAP TO RETRY` → `location.reload()` (:2153-2187 .catch).
- main.ts:2166-67 — `document.fonts?.load(...) ?? Promise.resolve()`;
  eager eval throws on engines without Font Loading API.
- main.ts — cache `getBoundingClientRect` in `resize()`; `toLogical`
  (:285-288) forces layout ~120×/s during drags.
- main.ts — per-frame allocs: `players.map` ×3 for `drawTeamMenu`
  (~:2069-2074 — reuse buffers or pass players + accessor), `draft.picked
  .map(draftDef)` dupes (:2009,2015-16). Use `battle.drawBalls(ctx,690,830)`
  contract for the catch-ball re-pass (:2055-64), delete the type pun.
- main.ts:457 — `?seed` must be a positive integer (`Number.isInteger`).
- screens.ts — memoize `fitFont`/`fitFontB`/`wrap2` results in a bounded
  `Map` keyed `text|font|maxW`; fix `wrap2`'s per-char `measureText`
  ellipsis loop (:502-518) — binary-search or drop whole words.
- screens.ts — cache gradients: `drawField` 4 mowing radials (:760-65),
  title vignette (:831-35), `logoBig` (:788), `cardFace`/`stripeBand`/
  `FEAT_BAND` (:433-54,:576-86,:2950) keyed on stable geometry.
- screens.ts — `drawRoster` (:4767-4810): cull to visible index range
  from `boxScroll`/`BOX_STRIP` instead of drawing all slots.
- screens.ts:5606-08 — slider drag writes `pk_settings` per pointermove;
  throttle to ~4Hz or write on release.
- screens.ts:5412 — cache `score.toLocaleString` on last value.

## WS-D — deploy plumbing + shipped-file hygiene
**Files:** `public/sw.js`, `scripts/stamp-sw.mjs` (new), `package.json`,
`.github/workflows/deploy.yml`, deletions: `public/_mock/`, `public/AGENTS.md`

- sw.js — nav fallback `caches.match(e.request,{ignoreSearch:true})` then
  `caches.match('./')` — `?seed=`/`?dev` reloads currently miss offline.
- sw.js + scripts/stamp-sw.mjs — post-build script stamps
  `CACHE = 'pokestrike-<githash>'` into dist/sw.js (same hash source as
  `__BUILD__` in vite.config.ts); wire into `build` script after
  `vite build`. Byte-change per deploy → SW update → `activate` purges
  the old cache name. Also prune `assets/index-*` entries not in the
  precache on activate.
- deploy.yml — insert `npm run smoke` between `npm ci` and `npm run
  build` so the ~880-check suite (incl. sprite-existence asserts) gates
  deploys.
- Delete `public/_mock/` (4 files, unreferenced, links broken under base)
  and `public/AGENTS.md` (ships to dist; root AGENTS.md covers it).
- Keep: `public/sprites/items/sign.png` (docs/style-mock.html refs it;
  plausible future use), `public/sprites/gracidea/tileset.json`
  (authoring index per AGENTS.md), `test/*.mjs` dev probes.

## Review Focus

- `load()` cache invalidation: a `store()` immediately followed by
  `load()` MUST return the new value (smoke asserts this).
- Filter→compaction: enemy/fx arrays mutated during iteration elsewhere —
  compaction order must match `.filter` output exactly.
- `drawBalls` must restore `b.y` even if draw throws (finally).
- sw.js `ignoreSearch` must still honor the doc-vs-asset branch.
- Daily-pick memo: `dealPick(now)` advances day at UTC midnight — key on
  the same seed the pick uses, not wall clock.
