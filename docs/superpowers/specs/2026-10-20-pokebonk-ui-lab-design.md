# PokéBonk-inspired UI anatomy + Star Piece economy

Design: 2026-10-20 · scope: project · source: reverse-engineered from
pokebonk.com (live screenshots + shipped CSS/JSON + community wiki)

## Intent and why

Adopt the two addictive layers PokéBonk gets right that Pokéstrike lacks:

1. **Component anatomy** — chunky card/pill/pill-button UI with striped
   rarity-tinted header bands, kind/rarity pills, key hints, and pressable
   "toy" buttons. Hybrid adoption: keep our night palette and Press Start 2P
   identity; steal the skeleton, not the skin.
2. **Agency + meta economy** — Refresh/Skip/Banish offer tools on the perk
   board, and a persistent currency (Star Pieces) banked every run and spent
   on permanent upgrades in a new Lab screen.

Why this serves the north star: MS physics untouched, Pokémon canon
(Star Piece is a canon valuable; Lab = Prof.'s lab flavor), and it's the
StS-progression meta layer — every run pays out even on a wipe, which is
the "one more run" engine our collection-only meta can't produce.

## Goals / non-goals / anti-goals

Goals:

- Reskin `drawPerkCard` to the PokéBonk card anatomy (reward board +
  charm pick share it).
- Tool row on the reward board: REROLL / SKIP / BANISH, per-run charges.
- `pk_stars` persistent currency: banked per stage cleared + sprinkled in
  gym loot fountains + win bonus; shown banked on the result screen.
- `LAB` scene off the title: two upgrade sections (Training / Run team)
  bought with Star Pieces, levels persisted in `pk_lab`.
- Telemetry keeps working: `statOffer` logs rerolled boards, banishes and
  skips as it does picks.
- `SAVE_VER` bump + migration step for the new save fields.

Non-goals:

- Item-pool curation (archive/discover), a second currency, new modes,
  the vitamin/move/inventory three-way split, mid-run item drops, an
  in-run Meowth shop (our `?`-mart already covers that niche).
- Draft card reskin — v1 reskins item/perk cards only. If it reads well,
  the mon draft card is a fast follow, not part of this project.
- PokéBonk's art: their sprites are PMD SpriteCollab; our canon stays
  FRLG/PokeAPI + gracidea. We copy design tokens, never files.

Anti-goals:

- No monetization mechanics (Star Pieces are earned in-game only).
- No new font or dependency (Press Start 2P + Roboto Condensed stay).
- No survival/endless work — Endless is explicitly future work.

## The design system (extracted from their shipped CSS)

Their tokens (reference only — adapt values to our palette):

- ink `#2a2440` / `#5a5478`, paper `#fff` / `#f3f1fa`, line `#e4e0f0`
- accent ramp: red `#ff5a5f`/`#e0303e`, orange `#ff9a3a`, yellow
  `#fc3`/`#f2a516`, blue `#3a8cff`/`#2563d8`, green `#36c96a`/`#1fa04e`,
  purple `#8a5cff`
- rarity ramp r0–r4: `#9aa4b8` `#36c96a` `#3a8cff` `#a35cff` `#ffb21a`
- radius ~22px, shadow `0 10px 28px #1a124638, 0 2px 6px #1a12461f`
- `--stripes`: `repeating-linear-gradient(-45deg, #ffffff24 0 10px,
  transparent 10px 20px)` — the candy texture on every header/button
- fonts: Nunito body / M PLUS Rounded 1c display → ours stay PS2P + rc.

### New canvas primitives (in `screens.ts`)

- `stripeBand(ctx, rect, color, dark)` — clip a roundRect, fill a
  rarity-tinted gradient (dark-adapted: `color → color-mix(45% #12162b)`
  top→bottom), then draw -45° white-alpha (≈0.14) diagonal bands.
- `pill(ctx, rect, {c, cd, label, pressed})` — pill button: 3-stop
  vertical gradient (lightened `c` → `c` → `cd`), a solid darker bottom
  rim ~4px tall (the press edge; collapses to ~1px + translateY(2px) when
  pressed), stripes overlay, centered label. Variants by color like
  theirs (default gold, `.blue`, `.red`, `.green`, `.ghost`).
- `chip(ctx, x, y, text, {bg, fg})` — small fully-rounded pill for
  rarity/kind/price/key-hint/counters.
- `keyHint(ctx, rect, label)` — `[1]`-style chip bottom-right of a card.
- `levelPips(ctx, x, y, n, max)` — row of short dash segments, filled vs
  empty (the Lab cards' Lv. 0/8 pip row).

### Card anatomy (replaces the inside of `drawPerkCard`)

Reference layout (their `.card`): white body 236×300, 110px header band
= rarity-tinted gradient + stripes, centered 64px pixelated icon with
drop shadow, `.rar` pill top-left, `.kind` pill top-right, `h3` name,
sub line, bullet stats, staggered deal-in animation.

Ours (162×200 card, dark body `#12162b`, keep the slot-reel — it's
better than their fade):

- Header band ~78px: rarity-tinted dark gradient + `stripeBand`, item
  icon centered ~44px with a soft drop shadow; the existing reel spin
  plays inside this band.
- `chip` rarity pill top-left (light bg, dark text, e.g. COMMON).
- `chip` kind pill top-right (dark translucent bg, light text):
  `NEW` when the perk id isn't in `battle.perkIds`, `DUPE` when it is
  (PokéBonk marks repeat picks as UPGRADE with a stat delta; ours just
  says DUPE since perks re-apply/stack).
- Name in `font()` (PS2P identity), two-line desc in `fontB` — same as
  today.
- `keyHint` `[1]`/`[2]`/`[3]` bottom-right; 1/2/3 keys pick cards
  (desktop affordance — the build ships to desktop too).
- Tap feedback: brief scale-to-1.04 + 3px rarity ring on the chosen card
  before grant (~120ms), the canvas analog of their hover lift.

### Where it applies

- `drawPerkCard` — used by the reward board (`drawReward`), the
  run-start charm board (`drawPerkPick`), and the `?`-mart mystery reveal.
- `pill` replaces the flat `button()` chrome on: tool row, REWARD_SKIP /
  REWARD_TEAM / CHARM_SKIP, title buttons (FREE/DAILY/DEX/ACH/BOARD/LAB),
  result RETRY/SHARE/TITLE. Keep `button()` for legacy spots not restyled
  yet; migrate the listed ones only.
- Section banners ("CHOOSE AN ITEM", Lab title, "Level 2!"-style wave
  banner): orange-striped gradient pill centered top — same `pill`
  primitive used as a banner, not a button.

## Offer tools (the agency layer)

A tool row under the perk cards on the reward board (between cards and
the SKIP/TEAM row): three `pill`s — `REROLL` (blue), `SKIP +150`
(ghost white), `BANISH` (red) — each with a charge-count badge.

- Charges: `battle.tools = { roll: n, skip: n, ban: n }`, seeded at run
  start as `1 + labLevel(...)` each; base is 1 charge per run each.
- REROLL: re-deal `rewardOffers` via the same `rollPerks(rng, cap, rank,
  types)` call, reset the reel clock (`rewardT0`), cost 1 charge. The
  reroll consumes rng on the run stream — deterministic replays stay
  honest since charges are saved.
- SKIP: leaves the board taking nothing, `+150 score` (score is the run
  wallet — mirrors `CHARM_SKIP`, where declining already pays score).
  Cost 1 charge.
- BANISH: tapping arms the tool (pulsing red = their `.armed`); the next
  card tap removes that perk id from the run pool instead of granting:
  `battle.perkBan: Set<string>` passed as a filter into `rollPerks`
  (new param, default empty). Tap BANISH again to disarm. Cost 1 charge
  on successful banish only.
- Telemetry: reroll → `statOffer('perks', oldOffers, null)` before
  re-dealing; banish → log the banished id as `taken` on a new
  `'perkban'` kind so pick rates stay clean; skip → existing `taken=null`
  path.
- Boards with <3 offers (elite=1, hard=2) get the same row; banish still
  pays off by culling future boards.

## Star Pieces + the Lab (the meta wallet)

`pk_stars: number` in `meta.ts` with `stars()`/`addStars(n)` and the
same localStorage/memory fallback pattern as `pk_dex`.

Earning (tunable consts, marked as guesses):

- Stage clear: `2 + depth` pieces (stage 1 pays 3 … stage 9 pays 11).
- Gym loot fountain: 2–4 `star` pickups worth +1 each, mixed into the
  existing coin/gem/heart/candy burst in `enterLoot` — purple star-piece
  tint, same physics.
- Climb win bonus: +40.
- Expected: ~100/deep run, ~8 on a stage-2 wipe. First meaningful buy
  lands after ~2–4 runs.

Sprite: vendor `star-piece.png` from PokeAPI/sprites
(`sprites/items/star-piece.png`) into `public/sprites/items/` — canon,
same source as the rest.

Spending — `pk_lab: Record<string, number>` (upgrade id → level), read
via `labLevel(id)`; buying is `buyLab(id)` → deduct, store, return
success. New `LAB` scene + `LAB_BTN` on the title's bottom row (DEX /
ACH / TOP RUNS row gains a fourth slot or LAB sits solo under it —
builder's call on the crowded row).

Lab screen: header banner `PROF.'S LAB` + `SPEND YOUR STAR PIECES` sub,
balance pill top-right, sectioned card grid (2 cols, scroll). Card =
tinted header w/ item icon, name, per-level desc, `levelPips`, price
pill (star icon + cost; red when short). Sections:

TRAINING (permanent, ~4 lines, 5 levels each):

- `hp` — HP UP: +8% team max HP /level (icon `hp-up`)
- `dmg` — PROTEIN: +5% hit damage /level (`protein`)
- `spc` — CALCIUM: +5% super damage /level (`calcium`)
- `luck` — LUCKY EGG: +2 team luck /level, 4 lvls (`lucky-egg`)

RUN TEAM (per-run tools):

- `reroll` — +1 REROLL charge /level ×3 (`dire-hit`)
- `skip` — +1 SKIP charge /level ×2 (`float-stone`)
- `ban` — +1 BANISH charge /level ×2 (`quick-claw`)
- `fourth` — perk boards offer 4 cards ×1 (`master-ball`)
- `revive` — start each run with a revive token: first KO'd mon returns
  at 50% HP ×1 (`revive`)

Costs (guesses, tune after play): Training 40/60/90/130/180 per level;
run team 60/80/120, `fourth` 400, `revive` 500.

Application: upgrades read at `Battle` construction into
multipliers/flags (`labHpMult`, `labDmgMult`, `labSpcMult`, `labLuck`,
tool charge seeds, `perkOfferN = 3 + (fourth?1:0)`, `reviveToken`).
Perk heals/maxHp ordering: apply lab multipliers BEFORE perk re-apply in
`applySnapshot` — same re-derive pattern perks use, so resume stays
deterministic. Revive token: on the first player KO, auto-revive at 50%
with a toast; flag persists in save.

## Files and integration points

- `screens.ts` — primitives (`stripeBand`, `pill`, `chip`, `keyHint`,
  `levelPips`), `drawPerkCard` reskin, tool row draw + rects
  (`TOOL_ROLL`/`TOOL_SKIP`/`TOOL_BAN`), `drawLab`, `LAB_BTN`, result
  screen `+N STAR PIECES` pill.
- `perks.ts` — `rollPerks` gains a `ban?: Set<string>` filter param.
- `battle.ts` — `tools` charges, `perkBan`, `perkOfferN`, revive token,
  lab application at construction, star pickups in `enterLoot`,
  stage-clear banking hook (call `addStars` at the same place gym wins /
  stage advances are recorded).
- `meta.ts` — `pk_stars`, `pk_lab`, `LAB_UPGRADES` table, `SAVE_VER` → 2
  + migrate step (new keys need no transform; mid-run `RunSave` gains
  `tools`, `perkBan`, `starsRun`, `reviveUsed` → the migrate step fills
  defaults for v1 saves).
- `main.ts` — `'lab'` scene in the union + routing, LAB button hit,
  tool row hit handling during `reward`, `1/2/3`/`R`/`X`/`Z` keys,
  result pieces state.
- `test/smoke.ts` — assert: stars banked after a stage, a lab buy
  persists + applies, tools consume charges, banish removes from pool,
  `SAVE_VER` migration on a v1 save.

## My calls (not user-approved, check them)

- Currency = **Star Pieces** (canon valuable item; sprite vendored from
  PokeAPI). Not "Stardust" — that's their name; Star Piece is ours.
- Lab lives on the **title screen row**, not inside runs; Lab purchases
  never happen mid-run.
- SKIP costs a charge AND pays +150 score — both halves matter: the
  charge makes it scarce, the payout makes it a decision.
- Fourth card costs 400 — the strongest single buy, priced like their
  3,000 "Fourth option".
- Tool row lives only on the reward board; charm pick and draft keep
  their existing reroll paths (draft reroll already exists via the
  `triple` achievement).
- PS2P stays for names/labels; `fontB` keeps dense small print — same
  split as today, just new shapes around it.
