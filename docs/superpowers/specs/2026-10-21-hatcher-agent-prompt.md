# Multi-agent build prompt — the Hatcher gacha meta

Paste everything below the line into a fresh agent session.

---

You're implementing the Hatcher — a Monster Strike-style gacha meta loop — in the Pokéstrike repo at `/Users/albinshr/Documents/pokestrike` (TypeScript + Canvas 2D, Vite, no engine).

**Read first, in order:**
1. `AGENTS.md` (project direction, conventions, commands)
2. `docs/superpowers/specs/2026-10-21-hatcher-gacha-design.md` (the spec — this is the contract)
3. `docs/superpowers/specs/2026-10-20-pokebonk-ui-lab-design.md` (the Lab half — its `pk_stars`/`pk_lab` sections ship as part of this work)

**Dispatch 4 parallel subagents.** Each owns disjoint files and codes blind against the spec's "API contract" section — those names/signatures are frozen, nobody renames them:

- **Agent A (meta)**: `src/game/meta.ts` ONLY — `pk_stars`, `pk_dust`, `pk_pulls`, `pk_lab` stores + the contract functions (`stars`/`addStars`/`spendStars`, `dust`/`addDust`/`spendDust`, `pullCount`/`bumpPulls`, `labLevel`/`buyLab`, `LAB_UPGRADES` table). Follow the existing `load`/`store`/`memX` fallback pattern; standalone keys, no SAVE_VER bump.
- **Agent B (content)**: `src/game/data.ts` + `src/game/tasks.ts` + `src/game/perks.ts` ONLY — `PULLABLE`, `INVADER_IDS`, rate/price consts, `pullSpecies`, `dustCost` in data.ts; `featuredPull` in tasks.ts (it uses `daySeed`); `rollPerks` count param in perks.ts.
- **Agent C (screens)**: `src/game/screens.ts` ONLY — `drawHatch`/`drawLab` overlay draws (same pattern as `drawDex`), second title chip row with `HATCH_BTN`/`LAB_BTN`, pull-reveal draw (ball shake → gold fake-out → burst → rarity stars), result-screen `+N STAR PIECES` row, `levelPips` primitive, 2×2 card layout for `perkOfferN === 4`, `DEX_LIST` reuses `PULLABLE`. Match existing primitives (`pill`, `button`, `stripeBand`, fonts `font()`/`fontB()`/`fitFont()`). Also vendor `public/sprites/items/star-piece.png` (and `amulet-coin.png` if missing) from PokeAPI/sprites `sprites/items/`.
- **Agent D (wiring)**: `src/main.ts` + `src/game/battle.ts` ONLY — `hatchOpen`/`labOpen` overlays (the `dexOpen` pattern, NOT new Scene members) + hit rects, pull state machine using `Math.random` (never `runRng`), `addStars` earn hooks (per-stage `2 + stageNumber` on row advance, `star` pickups in `enterLoot`, +40 win), milestone `unlockAch` toasts on pulls, lab upgrades applied at `Battle` construction per the Oct-20 spec ordering note, revive token honoring `reviveUsed`.

Rules for every subagent: touch only owned files; if a needed helper doesn't exist yet, code against the contract name anyway (the orchestrator fixes seams); add no dependencies; follow AGENTS.md conventions (content = data, pixel font = `font()`, etc.); don't run `npm run build` (other agents' files may be mid-flight).

**Wave 2 (you, the orchestrator):** after all 4 report back — run `npm run typecheck`, fix seam mismatches (missing imports, signature drift), then add the spec's smoke asserts to `test/smoke.ts`, then `npm run build` && `npm run smoke`. Fix failures at the root, not the test.

**Verify:** `npm run build` green + `npm run smoke` green. Then report a one-paragraph summary + the file list.

**Git:** commits as `Albisourous <43053302+Albisourous@users.noreply.github.com>`, plain `git commit -m` (no AI trailers), don't push unless asked.
