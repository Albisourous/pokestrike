# The Hatcher — Monster Strike-style gacha meta loop

Design: 2026-10-21 · scope: project · source: user request ("make the
gameplay more Monster Strike-like, more addictive, more replayable").
Builds on the unshipped currency half of
`2026-10-20-pokebonk-ui-lab-design.md` — `pk_stars` never landed, so this
doc owns it.

## Intent and why

The run is fun; the meta is a lobby. Between runs there's nothing to
spend, nothing to chase, and a wipe pays only a badge count. Monster
Strike's engine is a pull machine sitting on an earn-everywhere
currency — we already have the missing half: `dexIds()` feeds the
draft pool in `startDraft`, and a dupe catch banks +1 luck in
`absorbDupe`. The whole loop exists except the slot machine.

This adds the slot machine: Star Pieces banked every run → spent at the
HATCHER on pulled eggs → each pull records a dex capture → the captured
species joins future drafts through the path that already exists. Every
pull is permanent draft variety; every run is progress even when you
die on stage 2.

## Goals / non-goals / anti-goals

Goals:

- `pk_stars` persistent currency, banked per the rates in the Oct-20
  spec (stage clear `2 + stageNumber`, gym fountain star pickups, +40
  win — "stage" = map row advanced, not `battle.depth`).
- `HATCH` overlay off the title: 1-pull / 10-pull, rarity reveal, pity,
  featured rate-up, dupe→dust conversion, dust spark shop.
- `pk_lab` permanent upgrades per the Oct-20 spec (deterministic sink —
  the "sure thing" next to the gamble). Two sinks keep the currency
  honest.
- Pulls call `recordCapture` — pulled species enter the dex and future
  draft deals through the existing mechanism. No new draft plumbing.
- Telemetry: pulls logged so pick/pity rates can be audited.

Non-goals:

- A persistent monster box / choose-your-team-from-collection. The dex
  → draft pipeline already delivers "my collection shows up in runs";
  a separate box duplicates it and breaks `?seed=` parity between
  players. Rejected.
- In-run purchases, a mid-climb shop for pulls (the `?`-mart already
  covers in-run spending), stamina/timers, ads, monetization.
- Pull-exclusive species (content that can ONLY come from the hatcher).
  v1 pool = every catchable species; exclusives are a later lever if the
  pull economy proves out.

Anti-goals:

- No monetization mechanics — stars are earned in-game, never bought.
- No energy system. MS's stamina is the part that makes people quit,
  not the part that hooks them.
- No new font, dependency, or sprite source — pulls reuse FRLG sprites
  and the existing ball/item icons.

## The loop

```
run → bank stars (+fountain pickups) → HATCHER → pull egg → NEW: dex+
draft pool grow  /  DUPE: → dust → dust buys chosen species (spark)
                                          ↘ pity counter → guaranteed rare
                       LAB ← spend stars on permanent upgrades (Oct-20 spec)
```

Replay hooks this creates, mapped to MS:

- **Earn everywhere**: even a stage-2 wipe banks ~8 stars. "Wasted run"
  stops existing — the main quit-trigger in a roguelite.
- **Near-miss pull math**: pity at 10 pulls, priced so a deep run buys
  ~3 pulls. Always one more run from the next guarantee.
- **Dupe→dust→spark**: MS's guaranteed-out for bad luck. Dust shop sells
  any pullable species outright at a steep price — the long chase.
- **Featured rate-up**: daily seeded species gets 10× weight. Stacks on
  the existing daily climb + tasks + streak for the login habit.
- **Shiny pulls**: every pull independently rolls shiny — another lottery
  on top of the lottery, feeds the existing shiny dex/charm.

## The Hatcher

HATCHER is an **overlay** like `dexOpen`/`achOpen`/`boardOpen`/
`tasksOpen` — not a `Scene` union member. Same for LAB. They inherit
Esc-pop, drag-scroll, and the title's input path for free; the hatch
overlay carries a small internal state machine (`pending → shaking →
reveal → settle`) the way the dex overlay carries scroll state.

Title layout: the DEX/ACH/TOP RUNS/TASKS chip row is already 4-wide —
don't widen it. Add a **second chip row** directly below it holding
`HATCHER` and `LAB`, and shift the records line + ladder bar down to
follow (they already key off `DEX_BTN.y`).

Screen anatomy:

- Header `THE HATCHER` + balance pill (star-piece icon + count).
- Featured panel: today's rate-up species (sprite + `10× TODAY`), seeded
  off `daySeed()` so it's the same mon for everyone that day.
- Two pills: `PULL ×1 — 30` and `PULL ×10 — 270` (10-pull is a 10%
  discount AND guarantees ≥1 rare — the classic MS ten-pull).
- Pity meter: `GUARANTEED RARE IN N` filling toward every 10th pull.
- SPARK section: scrollable grid of pullable species with dust prices;
  owned ones dimmed. `SPARK` buys the species outright with dust.
- Pull animation: a ball shakes 2-3 times (MS's orb-glow tell: the ball
  flashes gold before rares — a fake-out that occasionally upgrades),
  bursts, sprite reveal with rarity stars (★/★★/★★★ by tier bucket),
  NEW! banner or `DUPE +N DUST`. 10-pull lays the results out as a
  tap-through queue, then a summary grid.

Pool and rates (tunable consts — guesses, mark them):

- `PULLABLE` = the same dedup'd set `screens.ts` builds as `DEX_LIST`
  (ROSTER + ENEMY_DB + ELITES + INVADERS). Move it to `data.ts` as an
  export; screens keeps importing it. ~520 species — big enough that
  the spark grid needs scroll (reuses the overlay drag-scroll pattern).
- Rarity is a **bucket roll, then uniform within the bucket** — pool
  share doesn't set rates: common (tier ≤1) 72%, rare (tier 2) 25%,
  epic 3% where epic = `tierOf(d) >= 3 || INVADERS.has(d.id)` — build an
  explicit `Set` of INVADER ids; tier alone misses Phione (tier 2
  invader) and would sweep non-invader bosses in ambiguously.
- Pity: pull #10, #20, … (every `pullCount % 10 === 0`) rolls rare+
  only. Note: any 10 consecutive pulls always contain exactly one pity
  roll, so the 10-pull "guaranteed rare" is free — no extra logic.
- Dupe: `DUST_BY_TIER = [5, 10, 40, 120]` — pulled a dex'd species, it
  converts to dust by its tier instead of re-recording.
- Dust spark price: `dustCost = 80 × (tier + 1)` — a tier-3 legendary
  costs ~320 dust ≈ a few dozen dupe pulls. Slow on purpose.
- Shiny: 2% per pull, `recordShiny(id)` on hit regardless of dupe.
- Pull RNG is **never `runRng`** — a title-side pull that consumed the
  run stream would shift a resumed climb's determinism. Pulls use
  `Math.random` directly (they're a live slot machine, not run content);
  the injected `rng` param exists for tests only.

Featured: `featuredPull(now)` lives in **`tasks.ts`** (next to
`daySeed`, which it uses — `data.ts` importing it would cycle
data→tasks→meta→data). Seeded pick from the rare+epic pool, 10× weight
inside its bucket for that day only; featured picks come from rare+
only — a featured Rattata is a bad ad.

## The Lab (Oct-20 spec, with three fixes)

`pk_lab` upgrades buy with stars — Training (HP/damage/super/luck
multis) + Run Team. Rates and application per the Oct-20 spec, except:

1. **Drop the `skip` upgrade** — shipped SKIP is free and unlimited
   (it pays +150 score, no charge). Making it charged would silently
   nerf shipped gameplay. Replace with `earnings`: `AMULET COIN — +10%
   star earnings /level ×3` (icon `amulet-coin` — vendor if missing),
   applied as a multiplier inside `addStars`'s callers.
2. **`RunSave` DOES change** — the revive token needs a persisted
   `reviveUsed` flag (same one-shot pattern as `ashArmed`) and
   `starsRun` tallies this run's earnings for the result screen (a
   resumed run otherwise underreports). Bump `SAVE_VER` to 4 with a
   default-fill migrate step — same shape as the v3 step. (Oct-20's
   "→2" is stale; `SAVE_VER` is already 3.)
3. **4-card boards need layout** — lab `fourth` makes `perkOfferN = 4`,
   but `rollPerks` hardcodes 3 and `perkCardRect` lays out 3×162px.
   Give `rollPerks` a count param, and at 4 offers draw a 2×2 grid of
   the same 162×200 cards (reward + charm boards) instead of squeezing
   a fourth column into 540px.

## API contract (frozen — agents code against these names)

`meta.ts`:

```ts
export function stars(): number                 // pk_stars balance
export function addStars(n: number): number     // returns new balance
export function spendStars(n: number): boolean  // false when short, never negative
export function dust(): number                  // pk_dust
export function addDust(n: number): number
export function spendDust(n: number): boolean
export function pullCount(): number             // pk_pulls — lifetime, feeds pity
export function bumpPulls(): number             // ++count, returns it
export function labLevel(id: string): number
export function buyLab(id: string): boolean     // deduct next-level cost, bump
export const LAB_UPGRADES: { id: string; name: string; icon: string; max: number; desc: string; costs: number[] }[]
```

`data.ts`:

```ts
export const PULLABLE: SpeciesDef[]             // dedup'd catchable set (was DEX_LIST)
export const PULL_COST = 30, PULL10_COST = 270, PULL_PITY = 10
export const DUST_BY_TIER = [5, 10, 40, 120] as const
export function pullSpecies(rng: () => number, opts?: { rarePlus?: boolean }): SpeciesDef
export function dustCost(d: SpeciesDef): number // 80 × (tier + 1)
```

`tasks.ts`:

```ts
export function featuredPull(now?: number): SpeciesDef  // rare+ pool, same all day, 10× weight
```

`meta.ts` telemetry — `Stats` gains `pulls: Record<string, [number, number]>`
(id → [dupes, total]) written by a new `statPull(id, dupe)`, guarded on
read like `s.perkban ??= {}` since stored blobs predate the key.

Pull flow (in the title-side hatch overlay): `spendStars(PULL_COST)` →
`pullSpecies(Math.random, { rarePlus: bumpPulls() % PULL_PITY === 0 })` →
if `dexIds()` lacks it → `recordCapture([id])` + show NEW; else
`addDust(DUST_BY_TIER[tierOf(def)])`. Featured weighting lives inside
`pullSpecies`. Shiny roll → `recordShiny(id)` either way. After a
`recordCapture`, fire the `collector`/`living` milestone checks — those
`unlockAch` calls currently only run at run end, so a pull crossing a
threshold should toast immediately, not wait for the next climb.

## Files and integration points

- `meta.ts` — four standalone `pk_*` keys (stars, dust, pulls, lab),
  same load/store/memX pattern as `pk_bag`; `Stats.pulls` + `statPull`;
  `SAVE_VER` → 4 + migrate filling `RunSave.reviveUsed`/`starsRun`
  defaults on parked saves (v3 step is the template).
- `data.ts` — `PULLABLE`, rate/price consts, `pullSpecies`, `dustCost`,
  `INVADER_IDS` set for the epic bucket.
- `tasks.ts` — `featuredPull` (sits by `daySeed`). Stretch: some task
  rewards can pay stars (`reward: 'star:10'`) — cheap second faucet.
- `perks.ts` — `rollPerks` gains a count param (currently hardcodes 3)
  for the lab `fourth` upgrade.
- `screens.ts` — `drawHatch`/`drawLab` overlays, `HATCH_BTN`/`LAB_BTN`
  second chip row, pull-reveal draw (ball shake → gold fake-out → burst
  → rarity stars), result screen `+N STAR PIECES` row, `DEX_LIST` now
  imports `PULLABLE`, `levelPips` primitive (spec'd Oct-20, never
  authored), 2×2 card layout when `perkOfferN === 4`. Sprites to vendor
  from PokeAPI (`sprites/items/`): `star-piece.png` (required — missing
  today), `amulet-coin.png` if the earnings upgrade uses it.
- `battle.ts` — `addStars(2 + stageNumber)` when the run advances a
  stage (a stage = a cleared map row; utility stops pay too — progress
  is progress), `star` pickups mixed into `enterLoot` (add the kind to
  spawn/draw/collect — tint purple, worth +1), lab multis applied at
  construction before perk re-apply (Oct-20 ordering), `+40` on climb
  win, revive token honoring `reviveUsed`.
- `main.ts` — `hatchOpen`/`labOpen` overlays + hit rects (title chip
  row 2), pull state machine, spark-shop purchase → `recordCapture`,
  milestone toasts on pull (`collector`/`living`/`shiny`).
- `test/smoke.ts` — asserts: pull determinism under seeded rng, spend
  guard never goes negative, pity fires on every 10th, dupe→dust
  conversion, lab buy persists and applies, `featuredPull` stable per
  day, `PULLABLE` ⊂ `ALL_SPECIES`.

## Workstreams (disjoint files — safe to run in parallel)

| Agent | Owns | Depends on |
|-------|------|-----------|
| A meta   | `meta.ts` only | contract names above |
| B pool   | `data.ts` + `tasks.ts` + `perks.ts` | contract names above |
| C screens| `screens.ts` only | A+B API names (calls them) |
| D wiring | `main.ts` + `battle.ts` | A+B API names (calls them) |
| E tests  | `test/smoke.ts` | full contract — wave 2 |

Contract is pinned above so A–D run blind against it. Wave 2: tests +
the orchestrator fixes seam mismatches, then `npm run build` +
`npm run smoke`.

## My calls (not user-approved, check them)

- **Dex IS the unlock ledger** — pulls call `recordCapture`, not a
  parallel "owned" set. Pulled species are draft-eligible exactly like
  caught ones (tier ≤1 general deal, tier ≥2 ace board). This also means
  hatcher progress advances dex milestones (Shiny Charm at 100) — pull
  spending quietly hunts the charm.
- Currency = **Star Pieces**, per the unbuilt Oct-20 spec — canon item,
  sprite already vendored there (`star-piece.png` — vendor if missing).
- Pull cost 30 stars: a deep run (~100 stars) buys ~3 pulls, a wipe buys
  ~¼ of one. Every number in §Hatcher is a guess pending playtesting.
- Dupe→dust instead of dupe→refund: refunds deflate the economy; dust
  builds the second chase.
- Pity is global (every 10th pull), not per-banner: simpler, and the
  "IN N" meter stays meaningful across sessions.
- 2% shiny rate per pull — higher than wild, because a pull you can't
  feel is a pull nobody buys.
- `pk_stars`/`pk_dust`/`pk_pulls`/`pk_lab` are standalone keys needing
  no migration — but `RunSave` gains `reviveUsed`/`starsRun`, so
  `SAVE_VER` bumps to 4 with a default-fill step (v3 is the template).
- Pulls roll on `Math.random`, never `runRng` — title-side pulls must
  not shift a resumed climb's stream or `?seed=` replays.
- HATCHER/LAB are overlays (the `dexOpen` pattern), not `Scene` union
  members — inherits Esc/scroll/title input free. Two new chips go in a
  second row under the existing 4-wide chip row.
- The Lab's `skip` upgrade is replaced by `earnings` (+10%/level) —
  shipped SKIP is free; charging it would nerf current gameplay.
