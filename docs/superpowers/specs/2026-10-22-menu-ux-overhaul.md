# Menu UX overhaul — GBA menu-window canon

Date: 2026-10-22 · Status: approved by owner (verbal: "overhaul the entire UX
UI of the menu … make it look like the real pokemon game menus but different
… do not ask me anything just build").

## Intent

The current chrome is already "GBA authentic" (style-mock direction A: paper
cards in navy frames) but it reads as generic cards, not as *Pokémon menus*.
Real Gen-3 Pokémon UI is a **window system**: every surface is a framed
window — a colored outer frame with an inner hairline, a dark title band,
and content laid out as list rows with a blinking ▶ cursor. This overhaul
makes every menu surface in the game follow that window canon, in our own
palette so it reads "Pokémon" without being a reskin.

## The system (src/game/ui.ts — the only new file)

Palette stays: INK #283058, PAPER #f8f8f0, PARCH #f0e6c8, GOLD #c8a44d /
GOLD_HI #ffd848, ACCENT #2a68c8, DANGER #d04840. The palette moves to ui.ts;
screens.ts imports it.

Chrome primitives (all in ui.ts):

- `uiWindow(ctx, r, o?)` — THE panel. Paper face, 3px INK frame, 1.5px inner
  hairline rim inset 5px (the double-frame signature), 8px corners, hard
  offset shadow (0,+5, ink@35%). Options: `dark` (INK face — tab bar,
  scrims), `tint` (colored face e.g. gold CTA), `rim:false`.
- `uiBand(ctx, r, title, o?)` — solid INK title band across the top of a
  window, PARCH pixel title, 2px GOLD baseline. Optional right-aligned sub
  in fontB. Returns content-top y.
- `uiPanel(ctx, r, title, o?)` — uiWindow + uiBand composed; returns the
  content rect inside the frame/rim. Overlays should be `scrim` → `uiPanel`.
- `uiRow(ctx, r, label, o?)` — a menu list row. Idle: INK text on paper,
  optional right value (INK_SOFT) and sub-line (fontB, INK_FAINT). `on`:
  INK fill + PARCH text + blinking ▶. `hot` (armed two-tap): GOLD face +
  INK text + ▶.
- `cursorTri(ctx, x, y, t, c?)` — the blinking ▶. Deterministic blink:
  (t*2.4)%1 < 0.72 lit. Draw on armed/selected/focused rows only.
- `scrim(ctx, a?)` — full-canvas INK dim behind overlay windows.
- `uiClose(ctx, r)` — the 28×28 INK ×-chip at a window's top-right.

Rules:

- Every rectangular panel/overlay/card is drawn with `uiWindow`. No raw
  `menuCard`/`cardFrame` calls for surfaces the user sees as a "panel".
  Old helpers stay for cold-path code nobody is reskinning.
- Titles live in `uiBand`s, not free-floating text on field.
- Selectable/pressable rows use `uiRow`; armed two-tap states = `hot`.
- Cursor ▶ appears only on rows that are armed/active — flavor, not a
  fake focus model. Tap targets stay taps.
- Buttons (`button`, `pill`) keep their hard-edge style — it already reads
  GBA; only their surrounding chrome changes.
- Type colors, sprite art, rarity bands stay content — chrome stays
  PAPER/INK/GOLD.

## What changes per surface

- **Home shell** — tab bar becomes a dark command strip (uiWindow dark):
  active cell is a paper window popped up out of the strip (keeps the
  existing grow/spring anim + geometry). Tab bodies: hero cards become
  `uiPanel`s with `uiBand` titles; TODAY card, wallet bar, hero row keep
  layout, new chrome. TOWN's building scene keeps the tile art (it's the
  canon) but its door signs become tiny `uiWindow`s.
- **Overlays** (help, dex, board, trophies, tasks, settings, bug) —
  uniform pattern: `scrim` → centered `uiPanel(title)` → content rows →
  `uiClose` chip. Rows become `uiRow`s where they're lists (dex entries,
  tasks, achievements, settings rows).
- **Economy** (hatcher front, pull summary, lab) — same overlay pattern;
  spark-shop cells keep their card look but sit inside the panel.
- **Run flow** (draft, reward, perk pick, team menu, result) — screens
  get `uiPanel` frames; offer cards keep their type-tint faces but gain
  the double-frame rim. HUD: light touch only — keep readability over
  battle.

## Contract (all agents, non-negotiable)

- Every `export` name, signature, and hit-rect export in screens.ts stays
  EXACTLY as-is — main.ts and smoke keep working untouched.
- Do not touch main.ts, hit rects, logic, persistence, or fonts.
- Do not touch the shared helpers block (~lines 380-742) or the import
  block — palette + fonts are already imported from './ui'.
- No `Math.random()` in draw paths — hash-seed any noise from `t`/coords.
- No new deps, no new files besides what already exists.
- 44px min tap targets; nothing may cover the iOS home-indicator zone
  (bottom ~28px).

## Non-goals

- Battle scene internals (sprites, physics, FX) untouched.
- The map screen keeps its island art — it's already canon.
- No layout re-architecture: same rects, same tab structure, new skin.

## Verification

typecheck + `npm run smoke` + `npm run build` green; playwright screenshots
of every tab and overlay.
