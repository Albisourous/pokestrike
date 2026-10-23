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
