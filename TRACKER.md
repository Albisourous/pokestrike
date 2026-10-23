# Pokéstrike Improvement Tracker

Autonomous improvement log — one row per change so each can be reviewed or
reverted independently. Verify with `npm run build && npm run smoke`.

## Progression strategy (2026-10-22)

The dex tracks collection **breadth** (caught or not). **Bond** adds
per-species **depth**: cleared stages bank bond pts for the lineup → bond
LV-ups pay dust → dust buys sparks → sparks complete dex lines. It gives a
reason to field different mons each draft (run variety) and a play-earned
dust source besides dupe pulls. Design doc:
`docs/superpowers/specs/2026-10-22-mon-bond-progression.md`.

Roadmap, in order: bond payoff inside the run (needs balance thought first)
→ audit pass on non-mons tabs for the same class of polish.

| Date | Commit | Area | Summary | Revert |
|------|--------|------|---------|--------|
| 2026-10-22 | `77c91fc` | town | mid-band building slices (roofs unclipped), scene clipped to play area, GYM_HIT re-rected, fog clamp | `git revert 77c91fc` |
| 2026-10-22 | `95565cc` | tabs | swap-out shrink anim, pill-accurate hit cells, TODAY card doors → SHOP/RAID, ←/→ tab nav | `git revert 95565cc` |
| 2026-10-22 | `c45fdf6` | mons | `pk_bond` career track (+pts per cleared stage → LV-ups pay dust); PARTNERS card replaces LATEST CATCHES once bonded; dex `BOND n` tag; `BOND LV-UPS` result row; smoke + fuzz coverage | `git revert c45fdf6` |
| 2026-10-22 | `f0b7c78` | dex | mon detail card on row tap — portrait/shiny palette, typing chips, bond row, role+move, traits, stat bars+BST, evo line; detail freezes scroll, pops before register | `git revert f0b7c78` |
| 2026-10-22 | `8aaf953` | mons | squad strip — parked climb's team w/ LV + shiny palettes (echo → HOF stand-ins), `STAGE n/9` sub, taps to CLIMB's CONTINUE or the dex | `git revert 8aaf953` |
| 2026-10-22 | `039b0e0` | mons | strip taps deep-link to the mon card (`partnersStripAt`); quiet SETS card honors its "browse the dex" footer; dex footer advertises row taps; traits line fit-guarded | `git revert 039b0e0` |
| 2026-10-22 | `fe07410` | roster | bond `·B{n}` rides the LV chips (box + team) and the swap-hint super line — bond visible where the squad is managed, read-only | `git revert fe07410` |
| 2026-10-22 | `42cd57a` | draft | kind pill carries `·B{n}` — `OWNED·B3` reads the species career at the pick | `git revert 42cd57a` |
| 2026-10-22 | `ed695c9` | raid | boss + loaner trio deep-link the dex detail card (`raidMonAt`), card hints the tap | `git revert ed695c9` |
| 2026-10-22 | `6875050` | climb | pitch echo ghosts deep-link the detail card (`echoMonAt`) — every home mon is a door | `git revert 6875050` |
| 2026-10-22 | `454a8fe` | battle | bond pays in-run: `teamLuck()` adds `⌊LV/2⌋` per fielded partner → gym fountain; reward line + detail card surface it; smoke asserts +1 at LV2 | `git revert 454a8fe` |
| 2026-10-22 | `735d29f` | bond | join-depth crediting: `def.joined` stamps on swap-in (survives evo/park/resume, saves v6), `bankBond` takes per-species pts — a stage-8 pickup stops free-riding the whole run | `git revert 735d29f` |
| 2026-10-22 | `78913c1` | battle | `regionMap` getter retires the events+smoke region type-pun — last `shortcut:` gone | `git revert 78913c1` |
| 2026-10-22 | `1675a48` | result | `BOND LVn ▲` tag on leveled squad sprites — the findings row lands on a face | `git revert 1675a48` |
| 2026-10-22 | `a5cef29` | dex | register draws only the visible band (was uiRow+sprite ×649/frame) + gold scroll thumb on a 40-screen list | `git revert a5cef29` |
| 2026-10-22 | `ebf0d9b` | mons | `nextGoal` negative-countdown fix: a crossed-but-unclaimed tier reads `+N★ MILESTONE READY`, not `-210 TO +30★` | `git revert ebf0d9b` |
| 2026-10-23 | `8dfd349` | audit | full-screen crawl (27 shots, 0 console errors): raid `TAP A MON` hint moved off the loaner name row → LOANERS header; hatcher pity line lowered 4px clear of the pull pills' ink lip | `git revert 8dfd349` |
| 2026-10-23 | `476358d` | polish | tab-swap bodies rise 12px in over 0.22s; town pollen motes (mapGlints-gated); wallet star/dust counts tick-chase instead of snapping; town plazas+hedges+GYM sign ride along (was uncommitted) | `git revert 476358d` |
| 2026-10-23 | `476358d` | rooms | pool 12→15: the keep (moat castle, gate gaps), pincer (mine claws), saltire (triple-pillar slalom) — all validated symmetric/reachable at module load | `git revert 476358d` |
| 2026-10-23 | `6b83149` | town | GYMHQ re-slice: columned gym entrance + steps | `git revert 6b83149` |
| 2026-10-23 | `d4d0d0c` | town | all five building slices re-bound to true atlas edges (MART dome+M restored, LAB right wall, HALL off neighbor, TOWER apex/door clipped→dome only, GYMHQ off lower building); draws at native aspect, ACH_BTN covers the sign | `git revert d4d0d0c` |
| 2026-10-23 | `eecac2e`+`2daaabc` | raid/battle | dropped raid-card mon→dex deep-links (TAP A MON hint gone, `raidMonAt` deleted); rode along: ×2 fast-forward chip beside pause + `f` key + scene-change fade lift | `git revert eecac2e 2daaabc` |
| 2026-10-23 | `5b6376a` | a11y | pinch-zoom restored (`user-scalable=no`/`maximum-scale` dropped — ux lint critical), `color-scheme: dark` + `touch-action: manipulation` keep double-tap delay out; `__dbg.ui()` exposes tab/overlay state for playtest crawls | `git revert 5b6376a` |
| 2026-10-23 | `755e695` | dex/hof | register lists all `DEX_ALL` slots — unseen lines ghost `? ???` + `#N` (1/223 no longer leaves a void); ghost taps don't open cards; empty HALL OF FAME gets a `START A CLIMB` gold door → draft (supersedes the "sparse states kept" call below) | `git revert 755e695` |
| 2026-10-23 | `7ab173a` | help | copy pass on the HOW TO PLAY deck — 7 unclear lines rewritten (power = release point, melee countdowns, READY term consistency, gold-band naming); `COACH ON` pill renamed `TUTORIAL ON` to match its own button | `git revert 7ab173a` |
| 2026-10-23 | `eecac2e` | draft | bag row auto-arms — first ≤2 stocked consumables ride in unasked (`BAG — n RIDE IN`, chips lit); taps only read the desc (rode in on the ff-chip commit; `16f22b7` comments it) | `git revert eecac2e` |
| 2026-10-23 | `4994c34` | draft | bag picks go seeded-random (runRng — replays hold); `BAG — n RIDE IN` header dropped, chips alone carry it | `git revert 4994c34` |
| 2026-10-23 | `8146c12` | sw | `controllerchange` → reload when already controlled: a deploy's new SW was claiming open clients while the stale bundle stayed in memory (the InvalidStateError crash report came from build `1348faa`, 13 min older than the `beafdac` fix) | `git revert 8146c12` |
| 2026-10-23 | `e21c241` | crash | `unhandledrejection` latch skips `audio device` rejections — a benign iOS resume race shouldn't paint a fatal card over a live run (backstop to `beafdac`'s wrapped sources) | `git revert e21c241` |

## Audit notes (2026-10-23, HIG rubric crawl — assessed, mostly no change)

Second full-screen pass under the new global skill `designing-with-hig`
(~/.config/devin/skills): contract → per-screen screenshots → 8-dimension
rubric → fix → re-shoot → `ux lint`. 30+ states: five tabs, hatcher/pull
theatre/results, spark deal, dex+detail, sets/partners/team, lab/board/
trophies/tasks/gym/ascension, raid card+arena, help deck ×3, settings,
draft/charm/map/wave/pause, wide+mobile letterbox. Zero console errors.

- **Fixed**: viewport `user-scalable=no` (critical) → pinch-zoom restored,
  `touch-action: manipulation` keeps double-tap delay out; `color-scheme: dark`.
- **Assessed, kept**: dex/Hall-of-Fame sparse states (footers carry the
  next-goal guidance); `N LEFT` inside the arena rim + SHOTS/SCORE chip
  tuck are deliberate placements; `?dev` `__dbg.song` console.logs are dev
  tooling; wheel listener must stay non-passive (`preventDefault`);
  build hash peeking under modals is the diagnostic affordance working.

## Audit notes (2026-10-23, playwright crawl — assessed, no change)

- **60 FPS held**: rAF-delta probe mid-fight = 60.3 avg / 59.9 p95. Battery saver already halves rate; dpr capped at 2. No pooling work filed — particles are bounded spawn objects, and `dexIds()` per-frame filter+Set is ~µs of garbage against measured headroom. Re-profile if jank is ever felt on real touch hardware.
- **Loop is throw-safe**: `loop.ts` schedules rAF before update/render; a draw crash can't kill the game. dt clamped at 1/30 — fixed-timestep decoupling not needed at this sim complexity.
- **HUD on exact 16:9**: map/reward phases draw the run HUD under the map panel when `viewPad` is 0 — visible only on taller-than-16:9 screens (i.e. every phone). Map phase is self-sufficient (own stage header); left as designed.
- **Tasks/HOF empty states**: WEEKLY tab and empty HALL OF FAME leave a large dead mid-panel — acceptable whitespace, consistent with the window kit.
- **Retention layer already covers the directive**: near-miss `shortOfBest` line, rival echo, streak risk, daily/login calendar, first-win bonus, pity, bond LV-ups, rookie ladder, grind pay — no new hooks added.
| 2026-10-23 | `58d5892` | battle/hud | ×2 chip no longer eats the stage tag — tag moved right of the corner chips (x97), capped clear of the stage pips, `fitFontB` shrinks long names; `· TRAINER` suffix dropped (intro banner carries it); ULT/streak row shifted to x99 | `git revert 58d5892` |
| 2026-10-23 | `e60019a` | battle/juice | hp lag bars — a pale wound slice drains behind the color bar on every unit + the enemy plate, so big hits read at a glance; heals snap. Room pool tiers: the keep/pincer/saltire tail (`ROOM_HARD`) rides in only from depth 2 — early climb keeps the mid pool | `git revert e60019a` |
