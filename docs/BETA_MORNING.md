# BETA MORNING — what happened while you slept

Gate status at handoff: `npm run typecheck` ✓ · `npm run smoke` ✓ (all
checks, incl. the new save fuzz) · `npm run build` ✓. Deployed bundle was
already live at <https://albisourous.github.io/pokestrike/> and serving
og/manifest/icons correctly; the final push re-deploys this build.

## What shipped tonight

1. **Baseline + deploy verified** — gate green; `deploy.yml` ships
   `dist/` to GitHub Pages on `main`; live site 200, deployed bundle
   matched local HEAD byte-for-byte at check time; og:title/description/
   image, manifest icons, theme-color and favicon all confirmed live.
2. **Cold boot walked end-to-end in Playwright** — help deck → title →
   free pull (hatch reveal works) → draft → map → first battle → sling
   pull-and-release all function. Screenshots in `docs/_boot*.png`.
3. **Save-integrity fuzz in smoke** — every `pk_*` key × 12 junk shapes
   (corrupt JSON, wrong types, partial fields, missing keys): zero
   throws, zero bad reads. Fixed a real crash this surfaced (`ascPick`
   was referenced but never imported — a reader threw on *every* cold
   read under rolldown).
4. **Audit wave 2 — three read-only agents swept battle.ts /
   screens.ts / meta.ts / tasks.ts / main.ts / events.ts / perks.ts.**
   Real bugs fixed and committed (`0a47361`):
   - **Quit-at-reward replay exploit**: quitting while the reward row
     was up parked a save that could re-fight the cleared row for double
     KO bounties + stage pay. `snapshot()` now banks resolved rows.
   - **Corpse-hit refire**: stray hazards could damage an already-dead
     ball and re-run the KO beat (revenge stack, sash burn, revive
     spend, killer rewrite). Dead-ball guards in `damagePlayer` + the
     hazard loop.
   - **RunSave integrity**: luck/cdMod/cd/sash/tagEchoDone/modId now
     persist; SAVE_VER 5 + migration; ranges clamped; ascPick floored;
     board entries must be finite; wallets/login reject negative junk.
   - **Hazard field correctness**: `static`/`well`/`power` zones no
     longer chip-damage units that legitimately enter them.
   - **Perk replay on resume** no longer double-applies transient
     effects (elixir, sash) — transient fields saved and stamped after
     replay instead of re-rolled.
   - **Input layering**: chips can't be tapped under event/evo modals;
     task row hits use the drawn view list (midnight-rollover
     misalignment); keys get the same 250ms lock as taps; `[4]` claims
     the lab's fourth card; overlay drags can't write into another
     overlay's scroll state.
   - **Layout**: leaked `textAlign` in `pill()`/`chip()` pushed draft
     tips + team labels off the right edge — fixed at the shared helper.
     `wrap2` ellipsizes instead of clipping mid-word. Result report
     compacts under load instead of growing over REMATCH/CONTINUE.
     Settings slider hit slab no longer bleeds into the row below.
     Hatcher rates line no longer collides with SPARK EXCHANGE.
   - **Touch targets**: help/mute/gear chips, help-close, lab buy strip,
     spark cells, evo keep, NEW sliver all expanded to ≥44px live targets
     via the existing draw-rect/hit-rect split.
   - Misc: `healAll` reports honestly when nobody needed healing;
     collector trade message prints the *new* level; mystery box can't
     charge for an empty shelf; ace draft can't loop forever on <3 types;
     dex header counts evo-only catches; long stage names fit.
5. **Ship kit** — REPORT BUGS link bottom-left of title opens a card
   with the crash-receipt line (`SEED nnn · BUILD xxx`) and filing
   instructions; build sha on title confirmed; `docs/BETA.md` written
   with tester instructions, bug-report flow, and `?seed=` replay tip.
6. **Screenshot-driven pass 2** (`c73de8d`→`a31bede`, your live shots):
   - **Start area rebuilt** — the HOME cottage sat centered on the node,
     so the trainer stood on the roof and the building hung over the
     sea. It's raised onto a real grass yard with the trainer at the
     door; smoke pins the yard across all seeds.
   - **Trainer customization** — new TRAINER settings tab: 15 avatars
     (`pk_trainer`), drives the overworld sprite. Fixed a real asset bug
     along the way: rotation-packed atlas frames were skipped on load,
     blanking half the roster.
   - **Settings filled out** — 5 new toggles, all wired to live behavior:
     MENU SOUNDS, TITLE WILDS, MAP SPARKLES, DAMAGE NUMBERS, AIM ARROW;
     modal grew to fit. Old saves default everything on.
   - **iOS swipe-zone fix** — the title's bottom stack (records, ladder,
     REPORT BUGS, sha) sat in the home-gesture area. Lifted ~28px; the
     footer is one line and the ladder bar is now the lowest element.
   - **Hatcher odds** — flat text line → tiered 2×2 rate card fed by a
     `PULL_RATES` constant `pullSpecies` now reads too (printed odds can
     never drift from the roll).
   - **Lab levels were never dead** — all nine were already wired into
     Battle construction; they just showed nothing. Cards now print the
     bought total (`NOW +16% TEAM MAX HP`) and the battle field log
     announces `LAB +16%HP · +5%DMG …`. Smoke proves every upgrade
     changes measurable battle state. Also fixed a clipped TRAINING
     section head.

## What I decided, and why

- **Reverted a "fix" that wasn't one**: an audit claimed `static`/`well`
   being water-solid was inverted logic. The smoke tests explicitly pin
   it as intended design (ponds wall off landlocked mons; swimmers cross
   the field). Reverted to the pinned behavior; kept the adjacent real
   fix (field effects no longer chip-damage swimmers crossing them).
- **Snapshot-banks-reward over blocking quit**: simpler and safer to let
   a parked save record the row as resolved than to forbid quitting.
- **No telemetry, no backend**: the bug card tells testers to post a
   screenshot + receipt — matches the localStorage-only architecture.
- **pauseChip left at its drawn size**: the in-code comment warns that
   enlarging it would eat arena taps; noted as a risk, not changed.

## Still broken / not fully verified

- **No real-device touch test** — sling is playable on mouse; 44px
  targets are met in logical space, and the bottom strip is now clear
  of the iOS home-swipe zone, but pull-back feel on a phone is
  unverified.
- **Result-screen compaction** is verified by construction (clipped +
  capped), not by screenshot of a heavily-loaded report.
- **`pauseChip` remains <44px** deliberately (arena-tap conflict).
- Dev-server note: `public/` assets only resolve at `/` in `vite dev`;
  opening `localhost:5173/pokestrike/` hits the SPA fallback. Prod is
  unaffected (relative `./` base).

## Distribution posture — options, no decision made

1. **Password gate on the same Pages URL** — a thin localStorage-gated
   title check; keeps everything else identical. Cheapest to build;
   weakest protection (sha in the bundle means anyone who reads the JS
   finds it).
2. **Unlisted itch.io page** — real fan-game home, comments + devlog
   free; still public-ish and a new channel (you said don't publish
   anywhere new — this is a decision for you).
3. **Reskin via `data.ts` + sprite swap** — the content layer is fully
   data-driven (species, names, sprites, cries); a swap is days of art
   work, not a rewrite. Safest legally, loses the pull of the theme.
4. **Status quo: unlisted-by-obscurity on Pages** — it's already up and
   beta-usable; risk is a DMCA/takedown, which for a non-commercial fan
   project is a takedown, not a lawsuit. **My recommendation: ship the
   beta as-is, and if it gathers traction, do the reskin** — it's the
   only option that survives a takedown.

## Addendum — settings UX retune (`0716008`)

Your mockups were already the anatomy the modal used — it was just too
small. The panel now fills the screen (y 38→838, was a 580px floating
card): rail pills 64→78px with icon circles, band 44→56, slider rows
~92px with 14px pokeball thumbs and pixel `%` readouts, 60×30 toggles,
28px seg tracks. `GRAPHICS` no longer bleeds past its pill (fitFont).
Hit rects re-derived from the same geometry, all rows ≥44px. Verified
against live screenshots of all four tabs.

Warning: a second session was editing this repo at the same time —
uncommitted `pk_sets`/SHOP work in `data.ts`/`meta.ts`/`screens.ts` is
theirs and was left untouched. One cosmetic line of mine (scrim 0.82→
0.9 in `drawSettings`) is deliberately uncommitted so it lands with
their next green commit instead of dragging half-built code into mine.
If the worktree errors you see (`DEAL_BTN`, `pullN`, `SETS_BTN`,
`tabPressT`) persist, they're mid-feature — committed HEAD is clean.

## Addendum 2 — cries out, hatcher cinematic (5-agent wave)

**Cries feature deleted** (`dc3f023`) — `cry()`, the audio cache, all 11
call sites, the `cries` settings key + slider row, and all 649 vendored
`.ogg` files (~8.7MB). Old saves carrying a `cries` key are ignored junk.

**Pull theatre rebuilt** (`37b2fb8`) — FGO/Genshin-style: letterbox bars
slam in, spark lanes + collapsing energy rings charge the ball, seam
cracks light, dark silhouette flash-reveals to color, god-rays + burst
rings + light pillar, and epic/shiny pulls get a counter-rotating prism
summon ring, whiteout kick and longer runway (`HatchState.tMax` scales
per result). All particle fields are hash-seeded — no `Math.random` in
the draw path. Marquee: type underbar, pop-in name, staggered stars,
rotated `SHINY!`/`NEW!`/`DUPE` stamp.

**Hatcher readability** — featured band is now type-colored with a
96px sprite stage + `10× ODDS` explainer; pull buttons carry in-pill
price plaques (red when short); the pity bar is a 10-pip countdown;
rates live in a framed 4-column card; spark cells got type pads, tier
flags, `✓ IN DEX` chips and struck deal prices; plus a `N/514 FOUND —
EVERY PULL GROWS YOUR DRAFT POOL` motivation line + SET BONUS chip.

**Why-pull design** — `docs/superpowers/specs/2026-10-22-hatcher-motivation.md`
ranks the value stack; the two cheapest cues (dex-found counter, set-bonus
chip) shipped in the overlay header.

**Dead wiring fixed** (was another session's half-landed work): HATCH_BTN
was gated to the 'mons' tab while drawing on 'shop' — tap dead there and
it occluded DEX_BTN on 'mons'. Now `shop`-gated, DEAL_BTN opens the
hatcher too, SETS_BTN actually claims all ready lines (`claimSet` was
never called anywhere), and `noteTabPress` drives a tab press-pop.

**Smoke**: 11 new sets asserts + `cries`-key-ignored coverage; suite
green, typecheck green, build green.

**Follow-ups after the wave** (`e485592`): the spark grid's two-tap
"armed" state now has a visual channel — pulsing gold rim, `TAP AGAIN ·
◆N` price line, and a countdown strip burning down the 3s window
(`armedId`/`armedFrac` piped through `drawHatch`'s info arg). Dead-button
sweep: every exported `*_BTN`/`*_CHIP` has a live hit rect. Verified the
epic + shiny cinematics in a live browser by stubbing `Math.random` —
prism ring, rays, silhouette reveal and the `SHINY!` starburst all fire.
Deploy to Pages confirmed green after each push.

**Audit pass on the new theatre** (`33b07e4`): a focused review found and
fixed — spark "TAP AGAIN" label lingering after the 3s arm window lapsed
(now reports `armedId:-1`), the spark grid + deal rolls rendering every
frame beneath the theatre's 0.92 dim (now idle-gated), `dealCost`
re-rolling `dealPick`/`raidPick` per cell (inlined against the frame's
hoisted deal), a 150ms input lock so a tap meant for one phase can't
skip the card the auto-advance just opened, raid captures now credit
the rookie 'HATCH A MON' rung, a `globalAlpha` leak if the reveal sprite
was still warming, and SKIP's hit slop grew to 12px to cover the
flash-beat screen kick.

**Concurrency note**: that commit also swept in the other session's
in-flight "GBA authentic" reskin (paper card faces in navy frames, gold
CTA) and a new 5th `RAID` home tab — both verified complete and green
before pushing. Known issue in the reskin: `townCard` still draws its
hero stat + the raid boss name in `PARCH` (cream) on `PAPER` faces —
washed out on TOWN and RAID; the palette comment itself says PARCH is
dark-chrome-only. Left for the concurrent session since they were still
mid-edit on `screens.ts` (broken intermediate state at handoff — e.g.
`const PAPER = PAPER` self-init + duplicate `INK` — their problem to
finish, HEAD is clean).

## Questions for the morning

1. Are you OK shipping the beta publicly under Pokémon branding, or
   should I put the password gate in front of it first? (My rec: option
   4 above — as-is, reskin as the contingency.)
2. Is there a real phone/tablet available for a touch-feel pass on the
   sling? I verified mouse only.
3. Where do you want bug reports collected — Discord, a GitHub issues
   thread on this repo, or a text group? The card says "where you found
   the build" until you name the place.
4. Economy check after you play: do 40★ pulls / lab prices / raid payout
   feel right, or did the grant amounts drift while features landed?
5. The ambient-wilds and `?seed=` flows depend on every roster id having
   a vendored sprite — swept all 649 ids, zero missing. No action needed;
   kept here so you know it was checked.
