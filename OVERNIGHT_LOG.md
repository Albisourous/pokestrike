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

## Iteration — pause-drift sweep (B21)
- Every this.time stamp now advances under pause: warp/boost/hazard
  cooldowns, bump throttle, ricochet windows, per-shooter hit maps,
  ult arm. Bonus catch: ultArmT lapsed mid-pause.
- Hostile orb contact rings now #ff6b6b (bursts were already red).
- build+smoke green. Overnight docs committed (9a6cd5e).

## Iteration — cross-system fixes (R5 audit, inline)
- HIGH: waveCleared() now guards 'lost' — a posthumous kill during
  the lose-sting could flip a final-wave wipe to WON in stats/tasks/
  rating/streaks, or inflate pk_gyms on any wave.
- HIGH: pointerUp off-aim releases dissolve the drag instead of
  forcing phase='shot' — held pull across a posthumous clear could
  re-run ceremonies, dup pk_gyms/rewards, or un-lose via ashRevive.
- drawAim gated to aim phase (no ghost on loot/reward screens).
- 6 other seams verified clean (endT/rewardPending structure,
  perkTick clauses, asc plumbing, foeZap lifecycle, waveIntroT,
  HOME-save round-trip). Noted: perkTick tSt not serialized
  (stingy-side drift only).
- build+smoke green.
- REAL PLAYTHROUGH ✓ — playwright live session: title → draft →
  charm → map → WILD node → 3 real pointer pulls (damage, countdowns,
  SUPER READY, ult rings all live) → wave cleared → reward board.
  Stray drags during reward correctly ignored (no mis-picks). Pointer
  path validated end-to-end in a real browser.
- FOLLOWUP ✓ — map-phase stray hits now log "X TOOK A STRAY HIT — n"
  (the map early-return hides damage texts; field log is the channel).

════════════════════════════════════════════════════════════════
MORNING SUMMARY — the night in one read
════════════════════════════════════════════════════════════════
29 commits pushed to origin/main overnight (baseline 9de24a6 → 3a13936).
Every iteration verified: npm run build + npm run smoke green before
commit. One red commit slipped through early (masked by a pipe) —
caught next verify, root-caused, and fixed in a7b381d.

STABILITY — the important stuff first
- Determinism: pull gauge now seeds off run rng (killed the seed-777
  flake); every remaining Math.random is cosmetic-only.
- Save/resume hardened: strict shape validation, tuple filtering,
  gym-credit dedup, egg persistence (SAVE_VER 3), HOME saves legal.
- Data-loss doors closed: 2-tap confirms on new-climb + DAILY; pause
  menu with SETTINGS/QUIT; stray-orb wipes during loot/reward/map now
  register; posthumous-kill outcome flip (lost→won in stats!) fixed.
- A latent softlock found + fixed: delayed-ult kills left the field
  dead-but-aim → wave-clear failsafe + idempotent waveCleared.

INPUT (mobile) — the biggest real-device wins
- pointerId gating: a second finger can no longer hijack the sling
  or fire the ult. Multi-touch was completely untracked before.
- 0.25s transition input lock: no more blind charm picks or
  un-walkable route commits from double-taps.
- prefers-reduced-motion honored; punch zoom gated by shake.
- Hit targets, countdown size, contrast, color+shape channels all
  bumped to spec.

FEEL — Monster Strike juice pass
- Win/lose celebration beat (endT) — FIELD REPORT no longer slams
  over the ceremony. WAVE CLEAR/STAGE CLEAR callouts, crit ceremony,
  hit squash on all damage paths.
- Sling: elastic type-colored tether, mon strains with charge, aim
  ring shows real type-effectiveness (+weak-face star), gold-zone
  haptic nod.
- Enemies: ranged attacks are now telegraphed orbs; melee gets a
  crouch windup. Wave "!" arrival beat. Typed super SFX pitch.
- Capture ritual: ball drop → wiggles → click/burst → verdict.

SYSTEMS
- Ascension is now a DIAL on the title (pk_asc) — was auto-ramped
  off lifetime wins with no opt-out. Default = old behavior.
- Balance pass: weekly task calibrations (BIG LEAGUE 8000, gyms 3),
  Dire Hit flat 5%, Focus Sash 3-stage re-arm, minefield 3 mines,
  luck shrine 100, day-care rare weight, no aim-phase perk farming.
- Content: +9 biome species, 3 new rooms (pool 11), 4 new ?-events,
  3 task templates, Weakness Policy perk.
- Meta surface: rival-echo title hook, PEAK/RANK bits, board stats
  footer, field-log for map-phase stray hits.

VERIFIED FOR REAL
- Playwright live playthrough: title → draft → charm → map → battle →
  real pointer pulls → wave cleared → reward board. Screenshots taken.
- Parked-run + rival-echo title state screenshotted and spacing-fixed.

KNOWN LEFTOVERS (conscious skips, not bugs)
- perkTick timers (sash re-arm, leftovers/ether) don't serialize —
  resume mid-window restarts them (stingy-side only).
- Resume forks the rng stream — a resumed run is deterministic per
  save but differs from an uninterrupted run on the same seed.
- Flat ascension tiers (1/5/7/8/9) have no named modifier — the flat
  HP/dmg scaling IS their modifier; naming them is future design work.
- Real touch hardware feel — everything is verified in browser;
  your thumbs are the final judge.
- ~10 cosmetic pause-drift fields got swept; purely cosmetic ones
  (wave-intro fade, trail stamps) deliberately left.

## Iteration — spinner reskin (user request)
- Release meter redrawn: sweeping needle + glowing orb tip + fading
  ghost trails, ruler notches, beveled track, gold zone bracket caps
  that pulse while lit. Charge ring: notch ticks + orb tip riding
  the sweep. Verified live mid-pull (2 screenshots, different phases).

═══ RESUMED (user directive: ability variance + replayability) ═══
- f93b4e3 spinner reskin shipped first (was still open from chat).
- ABILITIES scout ✓ — only 11 types; fighting SHARES rock's super,
  ghost flat/THIN, normal whiffs>240px, flying weakest; signatures
  cover 13/460 species (Pikachu has none); type-keyed passives and
  signature-keyed ults are untouched axes; combo-scaled payloads +
  weather hooks are ~30 lines total.
- [~] B22 running: all 10 spec'd type-super upgrades + SUPER_DESC sync
- VARIANCE scout + RUN-VARIETY scout still auditing
- RUN-VARIETY scout ✓ — big sameness levers found: island coastline
  is UNSEEDED (identical silhouette every run); stage.theme fixed
  once = ~90% of species mix per run (display themes already rotate);
  wave shape fixed [3]/[3+elite]/[2+boss]; gyms all use ROOM_BOSS;
  lanes never jitter; DAILY is a bare seed (no mutator); rest is
  auto-heal (no heal-vs-smith); chest always rare+ (dominant pick);
  ASC 1/5/7/8/9 unnamed; board[0] champ could become a rival echo.
- QUEUED after B22 (battle.ts serialization):
  B23 variety quicks: seeded coastline, per-row biome, wave shapes,
    gym room pull, lane jitter+cross-link
  B24 named ASC tiers 1/5/7/8/9 (roamers/inflation/frenzy/storm/tag)
  B25 rest → choice card (heal / train / patch+tool)
  B26 daily modifier rule card (~6 seeded twists + HUD + share)
  B27 daily task kind + streak trophies
  B28 champion echo ghost

## Iteration — map variety (inline, variety scout items 1+8)
- Island coastline now seeds off mapSeed (was literal seeds 0/1 —
  every run shared the silhouette). Lane jitter ±0.06, ~20% cross
  links in the tree. Two climbs now visibly differ at first glance.

## Iterations — map/wave variety + all-type super upgrades
- 6e8a586 seeded coastline, lane jitter, ~20% cross-links (inline).
- 321bcf7 designed-triplet shape variance; gravity-well test isolated.
- ~B22 all 10 spec'd supers landed: ghost=fee per foe (feasts on
  poison), fighting=AURA STORM jab-chain (split from rock), normal=
  EXTREMESPEED 2-link never whiffs, poison=detonate, flying=gather→
  scramble, electric hops scale with combo, psychic wall-slam, grass
  roots, water rain-lane, fire sun-burn. SUPER_DESC rewritten for
  all 10 (water's old desc was stale). Judgment: EXTREMESPEED rename
  canon-true; CLOSE COMBAT kept; BUMP_CD untouched.
- VARIANCE scout ✓ — 12 spec'd new perks (traitForge/dampRock/
  winRibbon/linkCable/backupCall/nestBall/tagOut/smokeBall/luckIncense/
  secondWind/dittoGoo/ultCell), 4 bag items, 5 affixes (warded/sky/
  skitter/hexed/tailwind), tick candidates for ~8 flat perks.
- QUEUED: B23b biome rotation+gym room pull (battle.ts) → B29 perks
  batch → B30 affixes+flat-ticks → B31 signature wave → B24-28.
- 845bcea pushed: per-wave biome rotation + furnished gyms + test update.
- [~] B29 (a567836a): 11 type-relic perks — canon sprites (charcoal,
  mystic-water, magnet, miracle-seed, hard-stone, poison-barb,
  sharp-beak, spell-tag, twisted-spoon, black-belt, silk-scarf), each a
  rider on its upgraded super — + 4 bag items + smoke asserts.
- QUEUED: B30 rest-choice eventChoice + 5 affixes + flat-perk ticks;
  B31 signature wave (METRONOME via castSignature refactor, FUTURE
  SIGHT, CRUNCH, ICE BEAM, HYPER VOICE, THUNDERBOLT, FLAMETHROWER,
  SPLASH); B32 daily modifier card; B33 champion-echo wave.
- 6bdf5a7 pushed: B29 — 11 type relics (team-type-filtered offers,
  renamed 'Charcoal+' style to de-collide with flat charms) + quick-claw/
  dusk-ball/protein(dmgMult)/razor-claw bag items + 6 rider asserts.
- [~] B30 (8dfebf94): rest = 2-option eventChoice (heal vs train-hard),
  5 affixes (warded/sky/skitter/hexed/tailwind), 3 flat-perk tick clauses.
- 2c67c91 pushed: B30 — rest is a required heal/train eventChoice;
  warded(shieldN)/sky(airborne flag)/skitter(drift×1.4)/hexed(contact
  dotTicks)/tailwind(launch×1.15, aim-sim honest) affixes; soothe/lucky/
  expshare ticks. Judgment: warded=aegis stack not supp; sky=unit flag
  not def mutation; rest now resolves peacefully (event semantic).
- CUT: champion-echo wave — rivalWave already fights the fallen team.
- [~] B31 (2ae42a6f): signature wave — METRONOME (castSignature
  refactor + curated pool), FUTURE SIGHT (delayed telegraph nuke),
  CRUNCH, ICE BEAM, HYPER VOICE, THUNDERBOLT (Pikachu), FLAMETHROWER,
  SPLASH (canon dud).
- QUEUED: B32 daily modifier card; B34 HP-based signatures (WATER
  SPOUT scales on caster HP, FISSURE, SEISMIC TOSS, ENDEAVOR).
- 4d5f920 pushed: B34 — 4 HP-aware signatures (WATER SPOUT scales on
  caster HP, FISSURE OHKOs grounded prey only, SEISMIC TOSS ~1.2%/lv
  fixed damage, ENDEAVOR drags to caster fraction). Fix in-flight:
  flyers assert held refs not indices (KO compacts enemies[]).
- 4ec0db8 pushed: B31 — 8 signatures (metronome refactor, future sight
  telegraph, thunderbolt on Pikachu, canon-dud splash). 4 stale smoke
  tests repointed off newly-signature species.
- 4d5f920 pushed: B34 + M0 — 4 HP-aware signatures (WATER SPOUT hp-scaled,
  FISSURE grounded-only OHKO+daze, SEISMIC TOSS lvl-scaled fixed dmg,
  ENDEAVOR fraction pull, Math.max(1) no-KO floor) + S0 songbook
  validator (caught+fixed 4 empty drum strings). B34 committed directly
  despite spec — author/message correct, work verified, kept.
- QUEUED: B32 daily modifier card; M1 biome selector + battle_volcano
  (S1); then S2 audition hook so taste-checks are possible.
- ef5be6c pushed: B32+B24+B27+S1/S2/S8 merge — 6 seeded daily rule
  cards (GOLD FEVER/HEARTY/BIG SPENDER/ROUGH ROAD/STORM CHASER/GLASS
  CANNON, seed-derived so resume keeps its card, title card + share
  line); ASC_MODS names all 9 tiers, new effects ROAMERS(2×invades)/
  INFLATION(+30%/tier)/FRENZY(drift×1.25)/STORM(weather every wave)/
  TAG TEAM(owed echo); COMMUTER w-dailies task kind; VICTORY STAR +
  WEEK SIBLING streak trophies; battle_volcano (E phrygian 170bpm
  guitar+slap) + BIOME_TRACK selector; clear/fail/hatch/rest jingles
  wired; __dbg.song audition hook. Fix: revert double-apply modId door
  (seed derivation covers resume).
- QUEUED: S3 battle_grove, S4 battle_cavern, S5 battle_sky, S6 trainer
  tint, S7 gym stab, S9 invade sting; scout refill for game backlog.
- ae880d8 pushed: S3-S7/S9 — battle_grove (C lydian pastoral bounce),
  battle_cavern (D dorian drips, echo 0.3), battle_sky (F lydian hat-
  driven), trainer_forge (march +4 semitones, saw voices) via
  TRAINER_TRACK; GYM_STAB family stabs at boss spawn; invade jingle
  layers the legendary crash-in. All 11 tracks pass the validator.
- eba6c4e pushed: content-scout batch — ENEMY_THEME completed (every
  non-boss ENEMY_DB id themed; volcano 20→27 w/ fossils, cavern→45,
  grove→64, sky→44); colliery room (ROOM_LAYOUTS[11], mine pairs, pass
  validator); eevee evolvesTo gains 196 Espeon; MOVE_OF +55 ids for
  gen4-5 (27 inherit real castSignature behaviour, 28 name-only canon +
  24 MOVE_DESC); 3 new rares (loaded dice/metal coat/wise glasses);
  FAKE ITEM BALL mimic event (w2, voltorb/foongus lines); perkBan now
  honoured at all 4 blind draw sites; undef-species guards on scripted
  event waves + rollEvent empty-pool tail.
- ef5be6c/78ace78 (committed+pushed by B32 sweep, verified): daily
  rule cards via daily.ts, 9 named ASC tiers all wired (roam/hair-
  trigger/fortunate/thin-centers/inflation/enraged/frenzy/storm/tag-
  team), streak trophies, S1/S2/S8 music, 3 broken 'dailies' task
  asserts repaired.
- ae880d8 + eba6c4e (concurrent session, not mine): S3-S7/S9 music +
  C1-C6 content (themed species +180, colliery room, Espeon branch,
  55 signature mappings, mimic event).
- 07576ba pushed: M2's real fix — FLYD pool split; mixo borrowings
  hand-voiced (third-down harmonizer was emitting seconds).
- NOTE: a second session/loop writes this tree concurrently. Its
  in-flight diffs stay uncommitted by me; verify-before-commit now
  includes "is this diff mine".
- [~] R6 (22c4ba9d): regression hunt over the ability/variance batch.
- 76859be pushed: scout-backlog batch — STABILITY: uid is per-battle
  (orb wobble is seed-pure again; the seed-777 divergence class dead),
  applySnapshot + both row-skip backfills draw THEMES like the live
  path, migrateSaves primitive guard, runSave element checks
  (team/box lvl finite, boxHp/boxLvl paired+finite, tools finite),
  row bound < TOTAL_STAGES, smoke aimTries resets per wave.
  POLISH: slider tap syncs volume, visibilitychange clears touch
  deadlock, denied reroll/banish play ui 0.6, Esc closes TEAM·ITEMS,
  task rows deny, share.failed → COPY FAILED, buildShare reads the
  battle not stale draft, MAP_GEAR chip opens settings on map/reward,
  EVO_KEEP chip + declineEvo(), NEW_HIT 36px, ASC_BTN 44px, loot
  fountain tap-skips, ult arm expiry → STOOD DOWN, master-ball spend
  banners + ball glyph on the box line. audio: sky-track lydian/mixo
  harmonisation fix (semitone rub on tonic thirds).
- pending push: DAILY_MODS 6→9 (SAFARI DAY catch×1.25, HEAVYWEIGHTS
  foeHp+0.25, RICOCHET +1 pip); task defs ROADWORK→quick-claw,
  VICTORY ROAD→dusk-ball, BULK UP→protein (orphan items now have
  deterministic earn paths); FISHING (w3, 25% gyarados fight) +
  HEADBUTT TREE (w2, 40% swarm) choice events; foe() throws at boot on
  unknown theme ids; smoke daily-count assert → unique-ids shape.
- pushed: reward offer-card desc wrap — greedy fontB wrap ≤3 lines at
  card width replaces the width-blind midpoint split (Grip Claw/Ether
  compound descs bled into the next card). Verified live on the same
  three-perk board.
