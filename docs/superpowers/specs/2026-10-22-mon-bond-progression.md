# Mon bond — per-species career progression

Date: 2026-10-22 · status: shipped

## Why

The dex tracks collection **breadth** — a species is caught or it isn't.
Nothing tracks **depth**: a caught mon is a checklist cell, not a character
with a career. And dust had exactly one source (dupe pulls), so the spark
shop only paid off for players already pulling — a dead loop for anyone
grinding climbs instead.

## The loop

climb stages cleared → lineup banks bond pts → bond LV pays dust → dust buys
sparks → sparks complete dex lines → lines pay stars → stars buy pulls.
Bond is the play-earned dust source that closes the economy for non-pullers,
and a reason to field different mons each draft (run variety — the north
star's #1 replayability axis).

## What shipped

- `pk_bond`: `Record<speciesId, pts>` — same unversioned shape-checked blob
  pattern as `pk_lab`. Run end banks `+clearedStages` for each unique species
  in `battle.players`.
  - shortcut: join depth isn't tracked — a mon drafted on stage 8 bonds like
    it fought all nine. Upgrade path: a join-depth field on `RunSave.team`.
- `BOND_LEVELS = [5, 12, 24, 45, 80]` → LV 1–5; each level crossed pays
  `BOND_PAY × lv` dust (75 total to max one species vs 80–320 spark prices).
- MONS tab: LATEST CATCHES strip flips to **PARTNERS** once any bond exists —
  top-3 bonded mons, `friend-ball` badge, 5 LV pips; the card taps open the
  dex. Dex rows append `· BOND n`; the result card gets a `BOND LV-UPS` dust
  findings row.
- **Mon detail card** (`drawDexDetail` + `dexRowAt`): a register-row tap opens
  the species card — portrait (shiny palette if owned), typing chips, bond
  row, role + signature move, trait flags, canon-order stat bars + BST, and
  the evo line with the viewed mon pinned. Detail freezes register scroll and
  pops before the register on tap/Esc.

- **Bond pays luck in-run**: `Battle.teamLuck()` adds `⌊bondLv/2⌋` per
  fielded species (LV2–3 → +1, LV4–5 → +2) — it feeds the existing gym
  loot fountain, surfaces in the reward screen's `TEAM LUCK` readout, and
  composes with fusion luck instead of replacing it. A fully bonded trio
  is +6 — under one guaranteed fountain gem, deliberately modest.
- **Every home mon sprite is a door**: PARTNERS entries, the RAID boss +
  loaner trio, and the CLIMB pitch's echo ghosts all deep-link the detail
  card (`partnersStripAt`/`raidMonAt`/`echoMonAt`); the draft kind pill
  carries `·B{n}` and roster LV chips read `Lv8·B3`.

## Next, uncommitted

- Join-depth tracking so a stage-8 pickup doesn't bond like it fought all
  nine (the `shortcut:` noted above).
