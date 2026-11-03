# Pixel FX Overhaul — shared brief

Monster Strike logic, Pokémon dress, pixelfx method. This spec is the
contract every effect agent works from. Reference: github.com/patch-gg/pixelfx
(244 code-drawn pixel effects; the idea we take is **acting** + palettes +
seeded particles, not the library itself — we do not npm-install it).

## Canon

- Hybrid art source. Vendored pokeemerald sheets in `public/sprites/anims/`
  stay the elemental art (ember, bolt, rocks, poison bubble…). Code-drawn
  pixel FX (Canvas 2D, no deps) handle the juice: slash arcs, impact frames,
  rings, shards, smoke, aura motes, speed lines. Mon sprites / props / UI
  still follow AGENTS.md "real asset first" — this spec only licenses
  procedurally drawn *battle VFX*.
- FRLG/Gen-3 feel: compositions stay ≤0.6s (ults may run ~1.2s with a
  windup), chunky pixels, `imageSmoothingEnabled = false`, additive
  `'lighter'` glow pass.
- 540×960 letterboxed court. All fx coordinates are already in canvas px.

## The acting model (the whole point)

An effect alone is a sticker. What sells a hit:

1. **Wind-up** — caster flashes/squashes, a tell ring or charge motes say
   something is coming (~0.15–0.35s).
2. **Contact** — strike lands with a *freeze*: `hitStop` 0.05–0.5s scaled
   to the hit's weight, plus `shake`, `punch` (zoom-kick), `screenFlash`.
3. **Target reacts** — knockback velocity, `flashT` white-hot sprite frame,
   `sq` squash, KO pop on death.
4. **Recovery** — brief settle; embers/smoke fade out.

Author moves as *acts*, not loose `later()` chains. The shared helper lives
in `src/game/vfx.ts` (`act()` / beat lists). Every super and ult should read
as wind-up → contact → recovery.

## Architecture

- `src/game/vfx.ts` — the runtime: extended `Fx` particle shapes, per-type
  `TYPE_RAMP` palettes (dark→bright), seeded rng passthrough, the `act`
  choreographer, and code-drawn effect primitives (slashArc, impactRing,
  pillarSpout, aura, screenLines, pixelExplosion, smokeColumn…). Pure
  helpers that push `Fx` — battle.ts keeps one `fx` array and one draw pass.
- `src/game/anim.ts` — the sheet pool stays. `Recipe`/compositions are for
  elemental sprite art; agents may vendor more pokeemerald sheets and add
  compositions, but the pool contract doesn't change.
- `src/game/supers/` — bump-supers + signature ults live here as data-ish
  modules behind a `SuperCtx` interface (same pattern as `Field2Fx` in
  abilities.ts). battle.ts keeps a thin dispatch. One file per type plus
  `signatures.ts` for named ults.
- `src/game/telop.ts` — banners; already good, gets polish not a rewrite.

## Rules every agent follows

- No new dependencies. Canvas 2D only. No generated URLs.
- Reduced motion: `settings().shake === 0` → no shake/punch/trails; flashes
  shorten; effects land settled. Respect `settings().flash` and
  `QUALITY_FX[settings().quality]` particle scaling where it exists.
- Determinism: prefer `this.rng`/seeded rng over `Math.random()` where the
  call site has it; smoke replays runs.
- Text rules (humanizer): terse fragments, `·` delimiter, no em dashes, no
  AI tells. Move names stay SHOUTY CAPS canon names.
- Perf: pooled or capped arrays; the existing `fx` cap (~260) stands. No
  per-frame allocations beyond the existing pattern.
- Do NOT commit. Do NOT revert existing uncommitted changes in the tree.
- Verify before done: `npm run build` (typecheck+build) and `npm run smoke`
  must pass.

## Splits

Each content agent owns disjoint files — never edit battle.ts unless your
brief says you own it.
