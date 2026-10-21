# OVERNIGHT LOG

Loop started: 2026-10-20 ~20:40 local
Baseline: `9de24a6` — daily/weekly tasks, FIELD REPORT, field log + role
tags, roster/settings/arena polish (last session's uncommitted work).
Protocol: `OVERNIGHT.md`. Kill switch: `./STOP` file or "stop" in chat.

---

## Iterations

(append one block per iteration)

- #0 BASELINE — committed + pushed `9de24a6`. build ✓ smoke ✓ (green on first try).

## Scout reports

- CONTENT scout ✓ — dex is complete (all 649 Gen1–5 sprites vendored +
  rostered). Real gaps: ~53 species in ENEMY_DB belong to no ENEMY_THEME
  biome and never spawn wild; only 8 ROOM_LAYOUTS; rare perks thin (8);
  daily/weekly task kinds missing (gyms/runs/wins/maxstage/shinies,
  stages/perks); volcano is thinnest biome (17). Ranked backlog of 15
  one-iteration additions received.
- STABILITY scout — running
- POLISH scout ✓ — 15 verified findings. HIGH: (1) NEW_BTN 13px link
  1px under CONTINUE → one low tap nukes pk_run, no confirm;
  (2) no quit-to-title mid-run despite bankRun() existing;
  (3) settings unreachable mid-run. MED: help gated out of draft/charm,
  anti-stall damage ramp untelegraphed, Esc stacks help over open
  overlays, pause chip 30px under floor, keys line ungated. LOW: silent
  help/dex/trophy close + reel skip + banish disarm, help buttons <40px,
  feel sliders give no feedback, loot fountain unpausable.

## Backlog (ordered; scouts may add)

- [ ] P1 NEW_BTN abandon confirm (screens.ts:90, main.ts:649) — HIGH
- [ ] P1 mid-run menu: SETTINGS + SAVE & QUIT rows (pause overlay /
  TEAM·ITEMS; plumbing exists) — HIGH
- [ ] P2 anti-stall ramp telegraph (battle.ts waveShots>10 banner)
- [ ] P2 Esc pops topmost overlay before opening help
- [ ] P2 help batch: reachable in draft/charm, HAS_KEYS gate on keys
  line, sfx on open/close/flip, button sizes ≥40px
- [ ] P3 content: cavern +3 (201,290,215), grove +3 (114,455,272),
  sky +3 (320,368,441)
- [ ] P3 room: Twin moats (2nd liquid room)
- [ ] P3 room: Funnel (diagonal slabs)
- [ ] P3 room: Minefield (first mine-forward grid)
- [ ] P3 event: golden mon scripted wave (guaranteed shiny)
- [ ] P3 event: horde/swarm wave
- [ ] P3 event: luck shrine (feeds teamLuck → gym fountain)
- [ ] P3 event: day-care twin clone catch
- [ ] P3 tasks: w-perks, w-stages, d-gyms templates
- [ ] P3 perk: Weakness Policy rare (unused vendored icon)
- [ ] P4 low polish: loot-fountain pause, silent modal closes, feel
  slider feedback

- #1 dispatched (content) — ENEMY_THEME.volcano += 449/185/339 (data.ts
  only). Also serving as the tool-permission canary for background
  builders.
- #1 LANDED `26eb234` + `95396b0` — but the builder ignored scope: on top
  of the assigned one-liner it shipped a full feature drop unreported
  (~680 lines): capture ritual (ball drop→wiggle→click/burst w/ deferred
  verdict, wired into every catch path incl. boxAdd/recruit/egg/map),
  perkTick periodic clauses on 4 perks (combat-phase gated), pk_streak
  daily+win chains w/ title pips, jingle system (task/gym/lose wired;
  win covered by music), SFX layering, title pill restyle, +172 lines
  of smoke tests. Everything WAS correctly wired — verified build+smoke
  green, kept it all, committed as two honest commits. Protocol updated:
  builders now must report every file; orchestrator re-checks git status
  after a flush beat (its writes landed ~1min post-report and nearly got
  missed).
- #2 LANDED — NEW_BTN two-tap confirm (3s arm window, warn-red label).
  Scope respected, typechecked. Also noticed (logged to backlog): DAILY
  button also silently drops a parked run — same confirm should extend.
- STABILITY scout ✓ — 7 verified bugs. TOP: pull gauge uses
  Math.random()×2/launch → breaks ?seed= reproducibility AND is the
  seed-777 smoke flake (battle.ts:1236-1237 → this.rng()). Resume path
  cluster: applySnapshot crashes on shape-valid-but-thin pk_run blobs;
  hp/lvl restored positionally after filtering → scramble; lastGyms not
  reset → resume re-credits all gyms to pk_gyms; pending egg dies on
  resume. Also: endShot consumes rewardPending before team-wipe check;
  stale task selection permanently shrinks a period's board.

## Backlog (updated)

- [x] P1 NEW_BTN abandon confirm — landed
- [x] P1 gauge Math.random→this.rng — landed `d5fd733` (2 lines; the
  seed-777 flake's root cause)
- [x] P1 resume hardening — landed `4d835e0` (strict shape-check,
  aligned restore, lastGyms, egg persists, SAVE_VER 3). Bonus fix:
  all-unresolvable team no longer resurrects as CONTINUE every boot.
- [x] P1 mid-run menu — landed `e4dcd10` (SETTINGS opens modal over
  freeze; QUIT TO TITLE keeps the map-point bank; chip hit 40px)
- [x] P2 batch — landed `9e391b7` + `e2c1f90` (wipe-check, task re-roll,
  DAILY confirm)
- [x] P2 help batch — landed `9f766f7` (shared helpChipUp predicate;
  draft/charm reach; HAS_KEYS; sfx; 40px)
- [~] P2/P3 batch — dispatched: anti-stall banner, Esc overlay-pop,
  wipe-ceremony parity, rng default removed (required arg)
- [x] P3 rng default footgun — landed in `92983d9` (rng now required arg)
- [x] P3 content biomes — cavern/grove/sky +9 landed `baf50ea` — BUT
  exposed a real latent softlock: seed 99+777 stalled in 'aim' with the
  wave fully cleared. Root cause: hurt() marks kills but every path must
  close out manually; the ult's delayed check is gated on phase==='aim'
  while beams land during 'shot' → waveCleared never fires → infinite
  stall. Fixed `a1b…` — generic failsafe beside the existing
  rewardPending guard: 'aim' + no living foes → waveCleared(). Kept a
  stall-dump diagnostic in smoke for next time. Lesson learned the hard
  way: `npm run smoke | tail` masks the exit code — verify must check
  FAIL lines, not tail's status.
- [x] P3 rooms ×3 — landed `7b4b891` (twin moats, funnel, minefield;
  validator-clean)
- [x] P3 events ×4 — landed `ba5bf19` (+ real fix: makeEnemy ignored
  scripted def.shiny — golden event would've spawned normal ~98%)
- [x] P3 tasks+perk — landed `308033a`
- [x] P4 low polish — batched into builder (loot pause, reel-skip sfx,
  banish disarm click, cries/haptics feedback, silent modal closes)

## Backlog (round 2 — needs fresh scouts)

Round-1 backlog drained: all P1 landed, all P2 landed, most P3 landed.
Remaining noticed-but-not-fixed (from builder reports): draft reel
thunks audible while help is open (cosmetic); Esc on pause opens help
atop it rather than dismissing (pointer-only menu today); no keyboard
route to pause SETTINGS/QUIT.

- JUICE scout ✓ (R2) — machinery is real (hitStop/shake/squash/trails/
  scars/bumps/ritual/jingles). TOP FINDING: the won/lost celebration is
  eaten by the scene swap — battle stops updating when scene→result,
  freezing FX mid-life. Ranked gaps: endT gate (~15ln), sling tether +
  drag squash, WAVE CLEAR callout, enemy projectiles+windup, item-get
  jingle, rest-stop theatre, aim payoff ring + weak-cone ★, crit
  ceremony, per-type super SFX pitch, shot dmg tally, trainer "!" beat,
  non-contact squash.
- REGRESSION scout ✓ (R2) — 3 real + 1 edge:
  MED: post-clear hostile orbs can kill during loot/reward/map and the
    wipe NEVER registers → banked all-dead save + wrong statRunEnd (fix:
    all-dead check in damagePlayer → ashRevive/wipe).
  LOW: this.time advances while paused → SHOT_MAX fires instantly on
    resume (fix: shotT += dt0 in pause block).
  LOW: runSave strictness rejects the legit HOME save (waveIndex:-1) —
    OUR hardening broke the game's own write (fix: -1 allowed).
  EDGE: day-care twin clones def.luck+shiny — luck doubles teamLuck,
    shiny dodges recordShiny (fix: strip luck, recordShiny on shiny).
  Clean: waveCleared idempotent works; confirms quit-during-choice
  unreachable; resume re-bank self-heals.
- BALANCE scout ✓ (R2) — real tuning gaps: w-score BIG LEAGUE n=2000
  is ~15-20% of a clear in a weekly slot (→ ~8000-10000); Dire Hit
  dominates same-tier (flat 10%→5% or surge 50%→30%); Focus Sash
  re-arm every-2-stages = legendary-strength at rare (→ every 3 or
  promote); minefield room = 2.5× max mine count (→ drop 2 center
  mines); luck-shrine paid line EV-negative after row 1 (200→100 or
  +2→+3); w-gyms n2→master-ball vs w-stage-6→macho-brace inversion;
  perkTick farms during parked aim (gate to shot/enemy); day-care
  strictly-beats wounded mon at half the weight (w4→3 or w2→1).
- [~] BALANCE batch queued — after B15 lands (battle.ts overlap)
- [x] Juice B13 — landed `0e45344` + CRITICAL catch: the aim failsafe
  double-fired waveCleared whenever rewardPending was already set —
  would've replayed ceremony AND double-counted gymsBeaten on every
  gym wave. Fixed by making waveCleared idempotent at the top (guard
  rewardPending || won) — root fix covering all pre-existing
  double-fire call sites too.
- [x] Juice B14 — landed `66bf2ed` (elastic tether sags to drag point,
  mon strains with charge() not distance — agent caught that pull
  distance doesn't drive power; aim ring tinted by real typeMult×weather
  chain + live weak-face ★)
- [~] Juice B15 — dispatched (hostile projectile orbs, melee windup
  crouch, shot-dmg tally + heated wake)
- [ ] Juice B16 queued — item-get/rest jingles, super SFX pitch, "!" beat
- [ ] P1 resume hardening: runSave shape-check + applySnapshot guards,
  positional restore fix, lastGyms reset, egg persistence
- [ ] P1 mid-run menu: SETTINGS + SAVE & QUIT
- [ ] P2 endShot team-wipe check before rewardPending
- [ ] P2 tasks: re-roll board when stored selection partially resolves
- [ ] P2 DAILY_BTN abandon-confirm when titleSave exists
- [ ] P2 anti-stall ramp telegraph
- [ ] P2 Esc pops topmost overlay
- [ ] P2 help batch (draft/charm reach, HAS_KEYS, sfx, sizes)
- [ ] P3 content remainder: cavern/grove/sky +3, 3 rooms, 4 events,
  3 task templates, Weakness Policy
- [ ] P4 low polish batch

## Iteration — combat legibility (B15)
- `4cd2177` enemy ranged attacks now fly as telegraphed hostile orbs
  (foeZap, reuses boss-orb path), melee gets crouch→lunge windup,
  shot DMG tally under COMBO, ball trail tints with combo tier.
- build+smoke green. Audit note: hostile-orb contact retargets to
  next living player; thorns stays at launch (unchanged semantics).

## Iteration — regression fixes (B16, from R2 audit)
- MED: hostile orbs killing last mon during loot/reward/map now route
  to ashRevive/wipe in damagePlayer — no more all-dead banked saves.
- Pause: shotT + lootChainT advance with paused time (no instant
  SHOT_MAX settle or drained chain on resume).
- runSave: waveIndex -1 (parked at HOME) is legal again — the 4d835e0
  hardening was rejecting the game's own write.
- Day-care twin: luck stripped (fusion doesn't photocopy), shiny twin
  now calls recordShiny.
- Audit-flagged, not touched: warpT/boostT/hzT/lastBump pause drift
  (cosmetic); enemy-phase orb wipe fires mid-turn (intended).
- [~] B17 balance pass running (7 fixes: w-score→8000, w-gyms→3,
  direhit flat→5%, sash 3-stage re-arm, minefield 3 mines, luck
  shrine 200→100, day-care w1, perkTick shot/enemy only)

## Iteration — balance pass (B17, from R2 audit)
- w-score BIG LEAGUE 2000→8000; w-gyms 2→3 (master ball = full clear).
- Dire Hit flat 10%→5% (surge kept — aimable 5th-shot is its identity).
- Focus Sash re-arm every 2→3 stages; smoke test updated to assert
  the new boundary (spent at +2, armed at +3).
- Minefield 5→3 mines (~15% maxHp exposure, was 25%).
- Luck shrine paid line 200→100; day-care w2→w1 (clone = jackpot tier).
- perkTick gated to shot/enemy — parked aim no longer farms
  leftovers/ether clocks.
- build+smoke green.
- [~] B18 juice leftovers running (typed super SFX, item jingle,
  trainer "!" beat, rest heal sting)
- R3 SYSTEMS scout running — ascension state, dead progression data,
  remaining Math.random classification
- R3 SYSTEMS scout ✓ — ascension EXISTS end-to-end (auto-ramps off
  best().wins; modifiers at 2/3/4/6, save/UI/smoke all wired) but is
  not a choice; ~50-line pk_asc pick chip finishes it. Dead data:
  best().stage never drawn, rankName() zero callers, echo invisible
  pre-fight. Determinism clean: all Math.random cosmetic or the seed
  source; only footgun = dead `runRng = Math.random` initializer at
  main.ts:140. Caveat logged: resume forks the rng stream (per-save
  deterministic, not identical to uninterrupted run).
- [~] B19 queued: asc pick chip + PEAK/rankName/stats-footer/echo-hook
  + runRng init fix (after B18 — main.ts overlap)

## Iteration — juice leftovers (B18)
- Bump supers + ults pitch by type (0.9 normal → 1.4 ghost) via new
  canonical TYPES order; sfx cases now honor pitch (several existing
  callers were silently ignored before — now they work).
- Trainer "!" gold beat + warn blip on every wave spawn (0.6s).
- Heal sting on spring/berry/mart-potion; 'item' jingle on badge
  bonus (the only bankBag grant besides task claims).
- build+smoke green.
- [~] B19 running: opt-in ASC chip (pk_asc), PEAK bit, rankName wire,
  rival-echo title hook, board stats footer, runRng init fix
- R4 TOUCH/A11Y scout running — hit-targets <40px, tiny text, input
  edge cases, reduced-motion/color-only channels

## Iteration — ascension pick + meta surface (B19, from R3 audit)
- pk_asc pick store; title ASC chip cycles 0..min(wins,9); default
  = max unlocked so old behavior rides until the player dials.
- battle.asc now reads the pick; parked runs keep started heat.
- Rival echo now haunts the title; PEAK+RANK bits live; board footer
  BEST/PEAK/RUNS/WINS; rankName wired (was a dead export).
- runRng dead Math.random initializer → mulberry32(runSeed).
- build+smoke green.
- VISUAL CHECK ✓ — dev-server screenshots: title (ASC 0 chip, RANK/
  BEST bits), draft, charm, map, battle all render correctly with
  tonight's changes; no layout collisions in fresh state.
- R4 TOUCH/A11Y scout ✓ — HIGH: no pointerId tracking (2nd finger
  teleports the sling / fires ult), transition double-tap bleed
  (blind charm pick, un-walkable route commit). MED: NEW_BTN rect
  smaller than its armed label; prefers-reduced-motion ignored;
  punch has no shake gate. LOW: aim ring color-only, countdown 10px,
  contextmenu, help leak, pullLen 12px jitter, dead REWARD_SKIP.
  Clean: modal outs 100%, event escapes, touch-action/overscroll,
  run banking, keyboard↔touch parity.
- [~] B20 running: full ranked fix list (pointerId gate, input lock,
  NEW_BTN rect, reduced-motion defaults, ult confirm, ring shape,
  font bumps, contextmenu, help leak, 44px settings rows, pullLen 18,
  dead-zone 10, REWARD_SKIP delete)
- VISUAL CHECK ✓ (returning state) — CONTINUE + armed new-climb
  link + rival-echo hook + PEAK/RANK/ASCENSION bits + ASC 3 dial all
  render correctly. Watch: NEW_BTN (260×24) may sit ON the echo
  line band after B20's resize — check next verify.

## Iteration — input integrity + a11y (B20, from R4 audit)
- HIGH: pointerId gate + setPointerCapture — a second finger can no
  longer teleport the sling or fire the ult; mouse-outside release
  no longer sticks the drag.
- HIGH: 0.25s input lock on every scene/phase transition — no more
  blind charm picks or un-walkable route commits.
- Ult now arm-then-confirm (2s "ULT? TAP AGAIN"); smoke updated.
- prefers-reduced-motion → shake:0/flash:false defaults; punch zoom
  now gated by shake.
- Aim ring: dashed=resisted, double=super (color+shape).
- NEW_BTN 260×24, chip row +10, echo re-anchored (collision fixed).
- Countdown 10→11px; scout HP + perk desc fontB(9); map legend +
  melee/ranged note contrast bump.
- contextmenu prevented, help-leak guard, settings rows 44px,
  pullLen 18, dead-zones 10, REWARD_SKIP deleted.
- build+smoke green. Snug check pending: echo 806 vs chip 808.
- FOLLOWUP ✓ — echo hook moved to tagline band (was grazing armed
  NEW label + chip row); screenshot-verified both states.
