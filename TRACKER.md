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

Roadmap, in order: mon detail card on dex-row tap → parked-run TEAM card on
the MONS tab → bond payoff inside the run (needs balance thought first).

| Date | Commit | Area | Summary | Revert |
|------|--------|------|---------|--------|
| 2026-10-22 | `77c91fc` | town | mid-band building slices (roofs unclipped), scene clipped to play area, GYM_HIT re-rected, fog clamp | `git revert 77c91fc` |
| 2026-10-22 | `95565cc` | tabs | swap-out shrink anim, pill-accurate hit cells, TODAY card doors → SHOP/RAID, ←/→ tab nav | `git revert 95565cc` |
| 2026-10-22 | `c45fdf6` | mons | `pk_bond` career track (+pts per cleared stage → LV-ups pay dust); PARTNERS card replaces LATEST CATCHES once bonded; dex `BOND n` tag; `BOND LV-UPS` result row; smoke + fuzz coverage | `git revert c45fdf6` |
