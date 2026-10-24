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
| 2026-10-23 | `67c49c4` | town | all six villagers stroll bounded beats (`TOWN_FOLK`/`townStrollAt`) — cardinal legs + idle beats, pure function of t, no teleports; `drawNpc` gained `flip` so norman's left_* covers right | `git revert 67c49c4` |
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
| 2026-10-23 | `7f0e54f` | battle/qol | ×2 rides the session (`Battle.ffPref` — new stage spawns inherit it); loot dropped from the double-step gate — the leash is real-time and halving the 6s grab was a tax, not a speedup | `git revert 7f0e54f` |
| 2026-10-24 | `cf0a1b4` | title/hub | asc rung board moved from the town strip onto CLIMB — heat picks where the run starts; DAILY pill + mod/streak copy gone (parked daily saves still resume via `pk_run` fields); RESTART promoted from the sliver link to a real pill beside CONTINUE (same two-tap warn); gym door routes to CLIMB + pulses the ladder; TODAY card + login toast reflowed into the freed band | `git revert cf0a1b4` |
| 2026-10-23 | `95d68d4` | result | findings ledger files in staggered (70ms/row, 180ms fade, `age` arg fed from `sceneT0`); WIPED OUT/CLEARED stamp moved to hang off the card's top-right corner — it sat inside the band clipping the "FIELD REPORT" tail | `git revert 95d68d4` |
| 2026-10-24 | `1071f14` | mons/dex card | DEX_BTN pulled to y110 × 240 tall — the dead 150px under the header is the card now; Press Start register count, shiny/badge tallies with real icons, vendored shiny-charm on a pedestal carrying the nearest chase line; rounded fill track, % stamped inside | `git revert 1071f14` |
| 2026-10-24 | `01c3f13` | mons/strip tap | sprite press on LATEST CATCHES/PARTNERS opens the detail card solo — register no longer stacks underneath; `dexPick` joined pointerdown's overlay gate so solo taps don't leak to title chrome | `git revert 01c3f13` |
| 2026-10-24 | `2307910` | dex/shelf | register rows → SPARK-style card grid: 4-wide cells, sprite on type-tinted pad, name + `#N`, rare+ corner flag + rim, shiny `★`; sealed `?` cells keep the checklist shape; `dexRowAt` maps cells, sealed cells don't open cards | `git revert 2307910` |
| 2026-10-24 | `4c08762` | raid/card | CHROMA RAID → event card: chroma crater + orbiting sparkle ring (the shiny burst), boss plate with typing chips + role + `moveOf`/`superDesc` lead move, LV30 loaners as shelf cells, reset countdown in the header, card grown to 470 | `git revert 4c08762` |
| 2026-10-23 | `6d7c4b5` | result | badge chips re-align center before drawing their name — the FIELD NOTE block leaves textAlign 'left', so names spilled half a width past the rim (FLAWLES/SPEED C EAR collisions); rode along: `inkCenter` true-ink-box centering for PS2P '?'/badge glyphs, wallet chip content-centering, ascCap on the town ladder | `git revert 6d7c4b5` |
| 2026-10-24 | `f307a69` | shop/odds card | dead band under SPARK DEAL → PULL ODDS card: COMMON/RARE/EPIC bars in the hatcher's rarity colors + pity count + rate-up note; SETTINGS panel 800→720 (fits graphics, its tallest tab) | `git revert f307a69` |
| 2026-10-24 | `c9f35ae` | tasks/commuter | `w-dailies` COMMUTER needed 2 finished daily climbs — unreachable since DAILY died; kind `dailies` removed with it, slot became SEAFLOOR (reach stage 8 → dusk-ball) | `git revert c9f35ae` |
| 2026-10-24 | `5ea4199` | climb/cta | START CLIMB floated 100px under the ASC ladder (its y676 predated the card reflow) — pulled to 604, echoes + records/bar re-anchored; dead space moved below the stats — grounded field, not a floating button | `git revert 5ea4199` |
| 2026-10-24 | `d1538e8` | draft/layout | dead band under the subtitle pulled: cards 300→240, → EVO demoted from pseudo-title to the stats line (PIERCE/COPY on its right), panel 738→704 + team/coverage/tips ride up — board reads subtitle→chips→cards→reroll→team→tips | `git revert d1538e8` |
| 2026-10-24 | `639590b` | draft/copy | footer tip walls + COVERAGE caption deleted — chips under the slots show the types, subtitle is one readable line; panel 704→652 | `git revert 639590b` |
| 2026-10-24 | `e637d63` | tokens/spacing | DESIGN.md Spacing section + `SP`/`PANEL_M`/`LINE_B` in ui.ts: 4px grid, role-named rungs, rules (shape≠spacing, panels shrink, fontB<9=cut it) — codifies the grid the codebase already lives on | `git revert e637d63` |
| 2026-10-24 | `0d8945f` | climb/cta-stack | FREE_BTN full-width (296→448), RESTART stacked under at h44 — primary over secondary; echoes/records/bar anchor to ctaBottom so the parked state pushes down clean | `git revert 0d8945f` |
| 2026-10-24 | `05f5a07` | debug/sandbox | `?debug=1` god mode: `liveKey` maps every pk_* key to `pk_debug_*` (load/store/removeItem all routed, real save never touched); `debugSeed()` once per sandbox — 99999★/9999◆, full dex + shiny ledger, 11 badges, 27 achievements, maxed lab, stocked bag, 9 wins → asc 9, coach/help preset. `test/debug.ts` covers seed + isolation + idempotency; `npm run smoke` runs it | also fixes `earnBadge` stale-read (badges past the first never banked) |
| 2026-10-24 | `4cf756a` | raid/loaners-band | YOUR LV30 LOANERS clipped mid-glyph — uiBand's `+h/2+4` baseline assumed ~9px ascent but ps2p reports ascent=full-em, landing every band title ~4px low (fatal at h16). `textBaseline:'middle'` centers ink at any height (global, all bands); loaner band 16→22, cells +378→+384 | `git revert` this row's sha |
| 2026-10-24 | `ccf61ea` | battle/feature-batch | pickups named + magnetized (name over icon, HEAL 15%/ATK +50%/SUPER +1 tag, grab 22→30, soft pull); drawWall per-wave seed re-dresses the prop ring + light pool; gauge jit2 — band width ±30%/pos ±13%/pace ±20% per pull; ult cinema (letterbox + type vignette + move banner); stocked-box rewards auto-seat the roster first (wantMenu → 'SET THE LINEUP FIRST'/'DONE → ITEMS'); '▼ RANK DOWN' on demotion; coach lines fixed; field-log lines capped + lab-log float rounded, held-item/bag descs ellipsize instead of clipping mid-glyph | `git revert ccf61ea` |
| 2026-10-24 | `05f5a07` | climb/arena | CR-style diorama: TODAY card → ARENA window — court backdrop in the previewed stage's theme + wave-1 pack at real spawn positions + `STAGE N · NAME`/`N FOES` plates; `takeClimbSeed()` pre-rolls the run seed on title so the preview IS the climb (`?seed=` still wins); TODAY_HITS doors die with the card; REPORT BUGS + build hash moved under the tab bar | `git revert 05f5a07` (shared commit — partial) |
| 2026-10-24 | `ead8d73` | dex/overflow | full-dex state (debug seed) exposed 3 escapes: `OF 649 REGISTERED` measured under fontB after the font(20) digit → label inside the number; SET-BONUSES pill text still textAlign='right' → inked left off-card; claimable LINE SETS rows ran into the TAP TO CLAIM footnote lane (guard now -34); pill now measures under its own fontB(7) | `git revert` this row's sha |
| 2026-10-24 | pending | chrome/esc-hint | `[esc]` keyHint pills off the settings + tasks close chips — the floating shortcut badge read as clutter next to the ×; draft's [1]/[2]/[3] card hints stay | `git revert` this row's sha |
| 2026-10-24 | `a485c9a` | shop/layout | SHOP's dead top band pulled (HATCH 210→110 — same start as MONS); PULL ODDS gained the SHINY row (live `shinyOdds()` — weekends show 4%) so the fill-to-tab-bar card earns its height; SPARK DEAL 170→190 + TAP TO VIEW rides the new foot — rode along in the user's chrome commit | `git revert a485c9a` (shared commit — partial) |
| 2026-10-24 | `b0923d9` | climb/arena | opener pack's clustered xs read as a fused blob — sort + fan to 22% window apart (display-only, real spawn kept) | `git revert b0923d9` |
| 2026-10-24 | `a4d07c6` | climb/fonts | arena plates fontB7→8, RIVALS caption 7→9 — no sub-9 text left on the climb board | `git revert a4d07c6` |
| 2026-10-24 | `9170203` | title/wilds | edge wilds static → slow ellipse graze — the field breathes at the margins | `git revert 9170203` |
| 2026-10-24 | `a5ae860` | dex/detail | superDesc + traits lines drew in PS2P (fontB→fitFont override) and bled past the frame — fitFontB(8), contained | `git revert a5ae860` |
| 2026-10-24 | `4f46631` | town/layout | scattered lots + corner pond → walled main-street plan: civic row (lab/hall) on a north street, commerce row (mart/tower) on a south street, lane joining them dead-ending at a centered park pond; hit rects re-fit to the new footprints | `git revert 4f46631` |
| 2026-10-24 | `f260ccb` | draft | bag row shrinks chips to fit (icon+badge under 60px, desc/names ride the subtitle); `→ EVO` no longer collides with PIERCE/COPY | `git revert f260ccb` |
| 2026-10-24 | pending | dex/buy | unowned pullable mon's detail card sells in place — `dexBuyRect` pill (`BUY · ◆N`, `DEAL −25%` tag on the deal pick), sparkBuy's two-tap arm rides it; owned card keeps the close footer | `git revert <dex-buy-commit>` |
| 2026-10-24 | pending | climb/ladder | rank bar: washed-out white 7px strip → dark inset capsule w/ quartile ticks + sheened tier fill, capped by the rung's real ball icons (poke→great→ultra→master, star-piece at CHAMPION) | `git revert <ladder-bar-commit>` |
| 2026-10-24 | pending | title/wilds | top-right Pidgey ambient pulled — it floated over the RAID card's field; the two bottom wilds stay | `git revert <wilds-commit>` |
| 2026-10-24 | `13860f7` | charm board | tall window owns the column (no dead top field, no clipped card 4); SKIP follows board size; rarity chip visible — was INK-on-INK | `git revert 13860f7` |
| 2026-10-24 | `61a1f2f` | charm board | 3-offer window centered; squad sprites no longer cover YOUR TEAM | `git revert 61a1f2f` |
| 2026-10-25 | `4f46631` | battle | shelled-foe mechanic: `shielded` species flag (Shellder/Pineco/Metapod/Kakuna/Cloyster/Shieldon) — a slow-drifting plate arcs the rim; front hits glance to 30% (GUARDED), back hits pay ×1.5 (FLANKED!) + SHELL kw tag + help line. Smoke asserts guarded→flank 3→29 | `git revert 4f46631 -- src/game/battle.ts src/game/data.ts` |
| 2026-10-25 | `b42891b` | battle | first-contact aim preview: the pull's ghost ray rides to the first foe (gold ring marks the opening target) or wall/slab (dashed ghost leg shows the bank angle) — teaches bank shots, aimGuide toggle respected | `git revert <this commit>` |
| 2026-10-24 | `f06b28d` | map header | drawHud slimmed on the region map — no duped tag/pip rows; SCORE chip moves to free top-left | `git revert f06b28d` |
| 2026-10-25 | `f96d58d` | battle | barbed-foe flag: Qwilfish/Maractus/Ferroseed/Toxicroak/Tentacruel/Sandslash chip the ball ~6% HP per contact (SPIKED! + SPIKY kw tag) — grazing the pack bleeds the run; smoke asserts 60→54 | `git revert <this commit>` |
| 2026-10-25 | `adbcacb` | battle | wave-clear ribbon reports the shot count — 'WAVE CLEAR! · 4 SHOTS', 'SWEEP!' on a one-shot clear: the speed goal reads every fight | `git revert <this commit>` |
| 2026-10-25 | `455a0ab` | battle | two sling-side wave mods join the pool: HEADWIND (−15% launch — banks want a longer pull) and SLICK COURT (−40% friction — the ball carries, settle comes late). Both ride curMod, wave-scoped | `git revert <this commit>` |
| 2026-10-25 | `0061d28` | battle | aim ghost marks ally passes: teammates the launch ray crosses get a ring (cyan = super ready, gray = cooling) — the bump chain reads before the pull | `git revert <this commit>` |
| 2026-10-25 | `32500f6` | battle | aim ghost colors the first-contact ring by shield outcome on shelled foes — red opening = plate (glance), cyan = back door (flank) | `git revert <this commit>` |
| 2026-10-25 | `4329cf0` | battle | kw tag composite (SHELL·SPIKY etc.) so dual-trait foes never hide a mechanic; Ferroseed double-flagged — flank it without grazing | `git revert <this commit>` |
| 2026-10-25 | `0b660b5` | data | hard-room pool 3→5: moat-gate (water walls, dry gates at edges+middle) and sluice (broken rock spine, mine elbows) — both validator-clean, depth-2 gated | `git revert <this commit>` |
| 2026-10-25 | `401a063` | battle | regen-foe flag: Tangela/Tangrowth/Gastrodon/Slowking/Vileplume/Alomomola mend ~3%/s (green puff throttle + REGEN kw tag) — burst them, don't whittle; smoke asserts 82→87 over a sim second | `git revert <this commit>` |
| 2026-10-25 | `abee525` | battle | split-foe flag: Exeggcute/Doduo/Combee/Klink/Weezing divide on KO into two 35%/0.7r kids (def-cloned, no recursion) + SPLIT kw tag; smoke 3→5 | `git revert <this commit>` |
| 2026-10-25 | `c5f176d` | battle | aim ghost's rebound leg: first-contact ring now throws the ball's post-bounce direction off the foe's face — double-kiss plans pre-pull (pierce skips it) | `git revert <this commit>` |
| 2026-10-25 | `eca5ae3` | battle | rage-foe flag: Mankey/Primeape/Tauros/Gyarados/Zangoose/Ursaring enrage under 30% — reuses the boss fast-cycle; smoke asserts the snap | `git revert <this commit>` |
| 2026-10-25 | `bbbb2a7` | battle | tap settles a dribbling shot (<260 u/s) — 'TAP TO SKIP THE DRIBBLE' surfaces after 1.2s of crawl; live ricochets can't be cut | `git revert <this commit>` |
| 2026-10-25 | `c521a98` | battle+data | SLEEPY foes doze till hit — countdown frozen (zZ tag), wake-up hit lands +35% and wakes it; Drowzee/Slowpoke/Slakoth/Hypno/Musharna | `git revert <this commit>` |
| 2026-10-25 | `853a7b3` | data | dormant gust/spikes/grass hazards wired into rooms — '5'/'6'/'7' tiles + bramble & crosswind hard-tier layouts | `git revert <this commit>` |
| 2026-10-25 | `bc31f2d` | battle | STORM & THORNS wave mutators — converging gust lanes / seeded spike fields ride the power-zone spawn pattern | `git revert <this commit>` |
| 2026-10-25 | `aafb9e5` | battle+data | REPEL foes — a gold halo shoves the ball off approach; Magneton line + Nosepass line | `git revert <this commit>` |
| 2026-10-25 | `e00bad2` | battle | type-aware chip hazards — fire balls bathe in lava, flyers sail the spike strip | `git revert <this commit>` |
| 2026-10-25 | `cca1e29` | battle | SWEEP streaks — back-to-back one-shot clears escalate the ribbon and pay +60 x streak | `git revert <this commit>` |
| 2026-10-25 | `1de6cd8` | battle | WHIFF callout — a shot landing no contact/bump/loot says so instead of ending silent | `git revert <this commit>` |
| 2026-10-25 | `af351b5` | battle | SWAT — the flying ball intercepts lingering hostile orbs (+10 score) | `git revert <this commit>` |
| 2026-10-25 | `f88baa1` | battle | ARMORED wave mutator — the whole pack rolls plated, cloned defs keep the DB row clean | `git revert <this commit>` |
| 2026-10-25 | `47e75e0` | battle | KO-shot chain feeds the catch roll — pinball kills tire the mon (+1.5%/link, cap +12%) | `git revert <this commit>` |
| 2026-10-25 | `4f37bca` | battle | aim preview shows the matchup — SE/NVE badge rides the first-contact ring | `git revert <this commit>` |
| 2026-10-25 | `verify` | battle | live pass — sleepy zZ, repel halo, gust chevrons, SE matchup badge all confirmed rendering mid-fight | n/a |
| 2026-10-25 | `db00306` | battle+data | RAIDER foes ditch the fight for field drops — dash at pickups, swallow in reach, mend on the bite; Meowth/Rattata/Zigzagoon lines | `git revert <this commit>` |
| 2026-10-25 | `7e3940f` | battle | SLUMBER wave mutator — the whole pack dozes; assassinate quietly or wake a bad night | `git revert <this commit>` |
| 2026-10-25 | `00b3aee` | battle | multi-KO callouts — DOUBLE/TRIPLE/N KO pops mid-flight on the pinball line | `git revert <this commit>` |
| 2026-10-25 | `7cdd7f5` | battle | aim ghost stays honest — repel targets ring orange, grav carriers ring teal | `git revert <this commit>` |
| 2026-10-25 | `e183160` | battle | foes chip in lava too — kite the pack through pools; fire types + flyers exempt | `git revert <this commit>` |
| 2026-10-25 | `aa51f25` | battle | spike strips nick grounded foes too — the fence hurts, not just walls | `git revert <this commit>` |
| 2026-10-25 | `eb6568f` | battle | aim ray marks live mines on the lane — orange blast ring, no ghost leg | `git revert <this commit>` |
| 2026-10-25 | `287d77d` | battle | aim ray previews warp pads — pad ring + ghost leg exiting the twin | `git revert <this commit>` |
| 2026-10-25 | `ebeab84` | battle | POLARIZED wave mutator — every foe carries a repulsor halo | `git revert <this commit>` |
| 2026-10-25 | `960016d` | battle | RESTLESS pre-warning at shot 8 — anti-stall ramp telegraphed 3 shots early | `git revert <this commit>` |
| 2026-10-25 | `6ef035e` | battle | VOLLEY foe flag — Octillery fans orbs across 3 mons, no tank-soak | `git revert <this commit>` |
| 2026-10-25 | `95d9ff2` | battle | hazards herd the pack — gust lanes sweep creeps, wells clump swimmers | `git revert <this commit>` |
| 2026-10-25 | `6862018` | battle | species pods — ~12% of waves are one-species packs, banner names the flock | `git revert <this commit>` |
| 2026-10-25 | `905978f` | battle | countdown urgency ramp — amber at 2, throbbing swell on the last tick | `git revert <this commit>` |
| 2026-10-25 | `d346d92` | battle | scout card explains foe flags — kw names what it does | `git revert <this commit>` |
| 2026-10-25 | `651d979` | battle | live pass — scout card 200w + 2-line tells + LV drop; countdown swell verified | `git revert <this commit>` |
| 2026-10-25 | `560096a` | battle | enrage embers — flickering collar keeps berserkers marked after the pop | `git revert <this commit>` |
| 2026-10-25 | `3b31689` | battle | venom status reads — rising poison bubbles + VENOM kw tag | `git revert <this commit>` |
| 2026-10-25 | `1b898ff` | battle | volatile ember crown — KO-burst foes marked before they pop | `git revert <this commit>` |
| 2026-10-25 | `92671d5` | battle | airborne foes hover — lift + detached ground shadow sells the SKY wave | `git revert <this commit>` |
| 2026-10-25 | `a4a2f64` | battle | court-state mods get ambient reads — slick gloss, hexed wisps, wind lanes | `git revert <this commit>` |
| 2026-10-25 | `04706eb` | battle | focus-sash headband — one-hit protection reads before the pop | `git revert <this commit>` |
| 2026-10-25 | `941d553` | battle | BLINK foes teleport on a cycle — Abra/Natu lines, shimmer telegraph | `git revert <this commit>` |
| 2026-10-25 | `2db4c5a` | battle | protein-fed ball burns orange till the shot parks | `git revert <this commit>` |
| 2026-10-25 | `7e8a854` | battle | last-shot arc echoes as a faint dotted line under the next aim | `git revert <this commit>` |
| 2026-10-25 | `f69daeb` | battle | SOS callers summon weak kids instead of attacking — flood-capped at 7 | `git revert <this commit>` |
| 2026-10-25 | `7607c1e` | battle | MIRROR blobs transform into the lead's typing + stats, keep own HP | `git revert <this commit>` |
| 2026-10-25 | `dad1229` | battle | active team traits read as a type-pip ribbon under the ASC chip | `git revert <this commit>` |
| 2026-10-25 | verified | verify | live pass: trait ribbon, SOS/BLINK tags, protein aura, path echo all read in-fight | n/a |
| 2026-10-25 | `ea21ae7` | battle | FLAWLESS clear bonus — untouched waves pay depth-scaled score | `git revert <this commit>` |
| 2026-10-25 | `42fbeba` | battle | FUSE foes self-destruct at zero — blast wounds both sides | `git revert <this commit>` |
| 2026-10-25 | `65d11dc` | battle | contact knockback — hits shove foes along the shot line into hazards | `git revert <this commit>` |
| 2026-10-25 | `e5f4073` | battle | billiard collisions — shoved foes slam packmates, momentum + chip | `git revert <this commit>` |
| 2026-10-25 | `8ad88c2` | battle | wall-slam — flung foes chip on rocks and shorelines | `git revert <this commit>` |
| 2026-10-25 | `0ae534a` | battle | HUNTER foes track the weakest mon — Poochyena/Mightyena carry it | `git revert <this commit>` |
| 2026-10-25 | verified | verify | perf pass: 60.1fps avg, p95 16.8ms under 8 hazards + 12 orbs + live shot | n/a |
| 2026-10-25 | `c0ab5d3` | battle | LEECH foes sip back the wounds they deal — Paras/Parasect | `git revert <this commit>` |
| 2026-10-25 | `15b089a` | battle | SLEEP powder — drowsy hits drop a mon a turn, can't bump | `git revert <this commit>` |
| 2026-10-25 | `014ae74` | battle | STING foes poison on hit — wound bleeds a tick a round both ways | `git revert <this commit>` |
| 2026-10-25 | `191d16f` | battle | WISP foes burn on hit — victim singes and hits softer | `git revert <this commit>` |
| 2026-10-25 | `007d41b` | battle | Poké Center cleanses statuses (sleep/poison/burn) alongside the heal | `git revert <this commit>` |
| 2026-10-25 | `9a619d7` | battle | JOLT waves paralyze — launch limps a few rounds | `git revert <this commit>` |
| 2026-10-25 | `2df16f2` | battle | TOXIC hides poison the ball on contact — Nidorans/Seadra | `git revert <this commit>` |
| 2026-10-25 | `5045321` | battle | STATIC hides paralyze the striker — Electabuzz/Manectric | `git revert <this commit>` |
| 2026-10-25 | `6ab7ad5` | battle | FLAME hides burn the striker — Ponyta/Slugma/Magmar | `git revert <this commit>` |
| 2026-10-25 | `1d2d472` | battle | LUM BERRY drops vs status packs — full team cleanse | `git revert <this commit>` |
| 2026-10-25 | `ba1a926` | battle | MENACE foes intimidate — team hits -20% while they live | `git revert <this commit>` |
| 2026-10-25 | `0daabf2` | battle | W-GUARD Shedinja — only SE hits land, slams still count | `git revert <this commit>` |
| 2026-10-25 | `800a389` | battle | STURDY foes hang at 1 HP — Geodude/Torkoal/Skarmory | `git revert <this commit>` |
| 2026-10-25 | `543d001` | battle | CHARM hides lull the striker — Delcatty/Milotic | `git revert <this commit>` |
| 2026-10-25 | `a63347f` | battle | SCALE hides halve damage at full HP — Dragonite/Lugia | `git revert <this commit>` |
| 2026-10-25 | pending | perf | heavy-scene re-check: 2.46ms avg update+render — visual passes cheap | — |
| 2026-10-25 | `f8130af` | battle | GUTS foes hit harder while statused — Heracross/Machamp/Ursaring | `git revert <this commit>` |
| 2026-10-25 | `ffef951` | battle | DRAIN foes absorb their element — Vaporeon/Lanturn/Flareon | `git revert <this commit>` |
| 2026-10-25 | `a9bd49d` | battle | LOAF foes truant — Slaking/Durant fire every other round | `git revert <this commit>` |
| 2026-10-25 | `2517d4e` | battle | BOOST foes re-arm faster each attack — Sharpedo/Blaziken/Scolipede | `git revert <this commit>` |
| 2026-10-25 | `58ef4a2` | battle | SPORE hides scatter a random ailment — Breloom/Vileplume | `git revert <this commit>` |
| 2026-10-25 | `81c3431` | battle | SYNC foes echo their status onto contact — Espeon/Kirlia | `git revert <this commit>` |
| 2026-10-25 | `f6b560d` | battle | PRESSURE halves super charge — the legendary beasts + Dusknoir | `git revert <this commit>` |
| 2026-10-25 | pending | verify | live shot: menace ring, static/flame/repel tags, halo, status marks all read | — |
| 2026-10-25 | `d04fa18` | battle | BEAM casters lock + burn a lane — Porygon line | `git revert <this commit>` |
| 2026-10-25 | `1726ac0` | battle | TRAP foes leash the court — Diglett/Dugtrio pit | `git revert <this commit>` |
| 2026-10-25 | `f252826` | battle | SKY callers summon weather — Torkoal/Ninetales/Ttar/Hippo/Politoed | `git revert <this commit>` |
| 2026-10-25 | `4aa5c70` | battle | COUNTER foes return a third of contact — Wobbuffet/Hitmons | `git revert <this commit>` |
| 2026-10-25 | `6fe2473` | battle | ALPHA leaders rally packmate hits — kill-order flag | `git revert <this commit>` |
| 2026-10-25 | `7f25b3f` | battle | SHED foes slough ailments each tick — anti-dot flag | `git revert <this commit>` |
| 2026-10-25 | `f934c61` | battle | ice slick tile (8) + glacier room — shots keep speed crossing | `git revert <this commit>` |
| 2026-10-25 | `e5db01e` | battle | aim ghost honors ice, slick, gust + grass — stops lying on field rooms | `git revert <this commit>` |
| 2026-10-25 | `92be12e` | battle | shoved foes skate on ice — rink is a bowling lane | `git revert <this commit>` |
| 2026-10-25 | `0c46898` | battle | CHARGE foes paw then ram across the court — new attack shape | `git revert <this commit>` |
| 2026-10-25 | `114a8ea` | verify | live probe: ice band, CHARGE/SHED/ALPHA tags, ram dash — all read | — |
| 2026-10-25 | `245c2be` | battle | REVIVAL HERB pickup — raises a fallen teammate, corpse-gated roll | `git revert <this commit>` |
| 2026-10-25 | `fd9a0ab` | battle | swift-swim launch — same-sky balls launch +12% faster | `git revert <this commit>` |
| 2026-10-25 | `57d0381` | battle | PRANK foes open early — ambush first attack | `git revert <this commit>` |
| 2026-10-25 | `d7fdddb` | battle | HUGE POWER — Azumarill/Medicham deal 2× contact (first player flag) | `git revert <this commit>` |
| 2026-10-25 | `1c52088` | battle | player-side STURDY — Onix/Bonsly hang on natively + STURDY! pop | `git revert <this commit>` |
| 2026-10-25 | `afcfcea` | battle | player-side GUTS — statused Machop/Shinx/etc hit 1.5×, ignore burn dip | `git revert <this commit>` |
| 2026-10-25 | `aca9773` | battle | POISON HEAL — venom mends Shroomish players and Breloom foes | `git revert <this commit>` |
| 2026-10-25 | `c577a07` | battle | SLEEPLESS — Insomnia/Vital Spirit mons shake off every lull | `git revert <this commit>` |
| 2026-10-23 | `c9fa90b` | copy | player-facing text audit (humanizer pass): WEEK SIBLING desc drops dead "daily climbs" + `bumpStreaks(won, true)` revives the day chain — trophy reachable again | `git revert c9fa90b` |
| 2026-10-23 | `a0bd6f2` | copy | same audit, screens.ts hunks rode the sync commit: ult help drops negation-first "not a per-mon super", dex footer `tap to close` → `outside closes` (row taps open cards) | `git revert a0bd6f2` (carries sync feature too) |
| 2026-10-25 | `78b98ad` | battle | PICKUP ability — scavenger mons nose out bag consumables post-wave | `git revert <this commit>` |
| 2026-10-25 | `f33950e` | battle | THICK FAT half lava chip + LIMBER para-immune — player flags | `git revert <this commit>` |
| 2026-10-25 | `dd86210` | battle | player-side STATIC/POISON PT + foe paralysis eats attacks | `git revert <this commit>` |
| 2026-10-25 | `3e36c80` | battle | player FLAME BODY + foe burns now chip and dull attacks | `git revert <this commit>` |
| 2026-10-25 | `7850763` | battle | player CUTE CHARM + EFFECT SPORE — point-mirror complete | `git revert <this commit>` |
| 2026-10-25 | `7907cd8` | battle | player INTIMIDATE dulls pack + SERENE GRACE 2× contact odds | `git revert <this commit>` |
| 2026-10-25 | `23b0dd5` | battle | DAMP — living carrier fizzles fuses, softens blasts | `git revert <this commit>` |
| 2026-10-25 | `a0bd6f2` | battle | player SYNCHRONIZE — ailments echo onto the striker | `git revert <this commit>` |
| 2026-10-25 | `5b2fa7a` | battle | bumping a sleeping ally wakes it (WOKE!) — no super | `git revert <this commit>` |
| 2026-10-25 | `29bff8e` | battle | THIEF foes pocket pickups — KO to re-drop | `git revert <this commit>` |
| 2026-10-25 | `12ae787` | battle | thief wears its loot — pocketed item floats at shoulder | `git revert <this commit>` |
| 2026-10-25 | perf | verify | 8-foe + ball-flight re-check: avg 1.9ms, p50 0.1ms — ~64ms "spikes" are Chrome display-list raster billing in the sync probe loop, not game code | n/a |
| 2026-10-25 | `5f87fbf` | battle | player FOLLOW ME (taunt) — living bait mon pulls all foe locks | `git revert <this commit>` |
| 2026-10-25 | `2426dfb` | battle | SPIKER foes lob spike patches into your half — court denial | `git revert <this commit>` |
| 2026-10-25 | `96ded43` | battle | SONIC foes confuse on contact — next launch veers ±10°, ghost wobbles | `git revert <this commit>` |
| 2026-10-25 | `47ad812` | draft | offer cards now show the ability row (HUGE·GUTS·TAUNT…) — pick informed | `git revert <this commit>` |
| 2026-10-25 | `322d9cf` | battle | ANCHOR foes can't be shoved — Snorlax + Aggron stay planted | `git revert <this commit>` |
| 2026-10-25 | `87939f9` | battle | kw ribbon capped at 3 tags (+N) — stacked vets no longer spill | `git revert <this commit>` |
| 2026-10-25 | `1fbb5c4` | test | smoke coverage for follow-me, thief, damp, spiker, anchor (982→989) | `git revert <this commit>` |
| 2026-10-25 | `a8ba5cf` | battle | OWN TEMPO (Spoink) shrugs off confusion + Mudkip picks up canon Damp | `git revert <this commit>` |
| 2026-10-25 | `fc3dcdc` | battle | FLANK foes approach on an arc — Zoroark + Absol drift wide | `git revert <this commit>` |
| 2026-10-25 | verify | visual | live probe: thief loot bubble, dizzy ?, zZ, capped kw tags, SPIKER — all clean | n/a |
| 2026-10-25 | `79662cd` | battle | FORECAST — Castform's type wears the sky (weakness follows weather) | `git revert <this commit>` |
| 2026-10-25 | `7790950` | battle | MOLD BREAKER — strikes and supers pierce Wonder Guard + Multiscale | `git revert <this commit>` |
| 2026-10-25 | `50fe718` | battle | HEAL BLOCK — Gothitelle + Duosion stop team recovery while alive | `git revert <this commit>` |
| 2026-10-25 | `7133c30` | battle | DESTINY BOND — direct KO takes the striker down; hazards/catches stay safe | `git revert <this commit>` |
| 2026-10-25 | `d042165` | battle | GRUDGE — roster cursed mons' faint slows the foe pack's wind-ups | `git revert <this commit>` |
| 2026-10-25 | `f004c37` | battle | AIM HONESTY — ghost path now bends through wells, rides boosts and warps | `git revert <this commit>` |
| 2026-10-25 | `ee19171` | battle | SHED SKIN — player-side natural cure on Scraggy, mirrors the foe tick | `git revert <this commit>` |
| 2026-10-25 | `cafbc8f` | feel | HIT FLASH — sprites burn white for a beat on every landed hit | `git revert <this commit>` |
| 2026-10-25 | `36e59bc` | verify | live probe — hit-flash, GO! call, kw tags, weather banner, labeled pickups all render | `git revert <this commit>` |
| 2026-10-25 | `8852526` | battle | REGENERATOR — player-side per-turn mend on Foongus, honors heal block | `git revert <this commit>` |
| 2026-10-25 | `8a44048` | battle | SHELL ARMOR — Kabuto/Kingler/Drapion shrug off crits | `git revert <this commit>` |
| 2026-10-25 | `5260326` | battle | COLOR CHANGE — Kecleon adopts the type that struck it, ring shows the hide | `git revert <this commit>` |
| 2026-10-25 | `b522503` | battle | FRIEND GUARD — Cleffa/Igglybuff soften hits on teammates while alive | `git revert <this commit>` |
| 2026-10-25 | `8deacb8` | battle | WEAK ARMOR — Vanillite/Magcargo crack on hit: faster but softer | `git revert <this commit>` |
| 2026-10-25 | `da38ebb` | battle | MOXIE — Krookodile/Mightyena sharpen their bite per KO they cause | `git revert <this commit>` |
| 2026-10-25 | `d6aa7ea` | battle | SAND VEIL — Sandslash/Cacturne whiff strikes inside a sandstorm | `git revert <this commit>` |
| 2026-10-25 | `b7751b5` | battle | LAST STAND — the final gym's ace gets back up once at 45%, enraged | `git revert <this commit>` |
| 2026-10-25 | `fbc6562` | battle | ABSORB — player-side same-type hits heal; Deerling gets Sap Sipper | `git revert <this commit>` |
| 2026-10-25 | `8643472` | battle | FILTER — Aggron/Camerupt blunt super-effective hits; Mold Breaker pierces | `git revert <this commit>` |
| 2026-10-25 | `6d2702b` | battle | SNIPE — Seadra/Octillery mark your farthest mon, punishing the back row | `git revert <this commit>` |
| 2026-10-25 | `397ed3a` | battle | UNAWARE — Quagsire/Bibarel shrug off your attack buffs | `git revert <this commit>` |
| 2026-10-25 | `32c2f29` | battle | SWIFT SWIM/CHLOROPHYLL — carriers press 1.5× in their sky (Ludicolo/Kingdra/Floatzel); scout line, SWIFT tag, dex trait, help line, smoke drift assert | `git revert 32c2f29` |
| 2026-10-23 | `46da9ff` | raid | day seed spends itself on the fight, not just the pick — `raidStage()` fields the ace + typed-tribe escorts (LV28-30) at pinned LV36-45 w/ +25-45% bulk; `RAID_MODS` names the day's handicap (enraged/storm/fortress/plated/warded/volatile/frenzy/guardian/hasty/horde/laststand — all live knobs in `battle.ts`); card shows LV + mod chip + escort count | `git revert 46da9ff` |
| 2026-10-23 | `3f68546` | tasks | job board was 340px of void — cards now split the room evenly by board size (3 daily breathe like 4 weekly), reward cell icon+name, pct inside the gold track, full 16-slot bag shelf ghosted when empty | `git revert 3f68546` |
| 2026-10-23 | `22e3ea8` | tabs | icons re-read: star-piece→amulet-coin (shop), ball→Pikachu face (mons), badge stays (climb ladder), boss blob→master-ball (raid), mom NPC→TILE_TOWN house (town) | `git revert 22e3ea8` |
| 2026-10-23 | `740fa38` | deal | flat −25% → day-seeded −50…75% (`dealOff` dayMemo, salt *31+47); card title/grid flag/buy label print the live cut, spark-grid inlining dropped (memo'd = free) | `git revert 740fa38` |
| 2026-10-23 | `654c31d` | title | popped CLIMB crown ate the records line + ball meter when a run was parked — echoes/caption/records/meter repack tighter (+28/+62/+76/+86 off ctaBottom), hero overshoot 28→20 keeps the pop above the track | `git revert 654c31d` |
| 2026-10-23 | `613ca2e` | town | facade slices re-bound at 4x-measured edges (mart 1585..1745 full awning run, hall 847/200 marquee only, lab wings 684..774, tower dome 556..654); draws centered on lots w/ native aspect, signs+door walks moved to door centers | `git revert 613ca2e` |
| 2026-10-23 | `bb19137` | trainer | wardrobe gated: MAY+WALLY free, 13 looks locked behind `avatarRoll()` ★20 pull (two-tap armed, `pk_avatars` owned set, old saves grandfather their stored pick); locked cells ghosted `? ? ?`, pill + closet count + unlock flash under the grid | `git revert bb19137` |
| 2026-10-23 | `70c0be2` | town | resliced real buildings — lab = domed institute (570,346), job board = awning café w/ patio (855,342); hedges → round garden bushes, pond gets iron rails + a gazebo, wildflower clusters + rocks fill dead lot sand | `git revert 70c0be2` |
| 2026-10-23 | `f7bc510` | town | Norman's stroll box moved off the pond rim to the park-mouth grass band; iron rail dress removed (read as floating debris at 29×14) | `git revert f7bc510` |
| 2026-10-23 | `bb02855` | map | stop guardians cell*1.7→1.15, player cell*1.7→1.3 — people were taller than buildings; labels pull in to sit right above heads | `git revert bb02855` |
| 2026-10-23 | `504d079` | arena | sports-pitch paint removed (inset rect/halfway/center circle/corner arcs); floor bake stamps 5 worn-ground patches per theme; blocks rounded + softer rim | `git revert 504d079` |
