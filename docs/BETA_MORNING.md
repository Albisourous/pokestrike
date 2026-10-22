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
  targets are met in logical space, but feel on a phone is unverified.
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
