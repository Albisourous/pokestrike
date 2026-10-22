# Pokéstrike Menu Style System — "GBA Authentic"

One theme for every menu surface (title tabs, cards, buttons, chips, modals,
overlays, settings, hatcher, lab, tasks, dex, trophies, board, help, draft,
result). The language is the Gen-3 handheld menu itself: **light paper boxes
in thick navy frames, dark ink text, one gold CTA per surface.** Canvas-drawn;
tokens below are the single source — no hand-rolled colors at call sites.

## Tokens

### Color — chrome (constant across every menu)

| Token | Value | Role |
|---|---|---|
| `PAPER` | `#f8f8f0` | card / modal / panel faces |
| `PAPER_HI` | `#ffffff` | raised inner cells, inputs |
| `INK` | `#283058` | frames/borders, primary text on paper, chrome bars |
| `INK_SOFT` | `#586070` | secondary text on paper |
| `INK_FAINT` | `#989aa8` | captions, disabled, footnotes on paper |
| `GOLD` | `#ffd848` | THE call-to-action face (one per surface) |
| `GOLD_DEEP` | `#c8a44d` | gold rims, wallet/star accents, tab underline |
| `DANGER` | `#d04840` | confirm-armed warns, delete |
| `FIELD_*` | gracidea grass | scenery behind menus — unchanged, not chrome |

Rules: chrome is only ever `PAPER`/`INK`/gold. Color lives in **content** —
mon sprites, `TYPE_COLOR` chips, badge art — never in frames or fills.

### Type

- `font()` Press Start 2P (vendored) — headers, buttons, big numbers. Uppercase.
- `fontB()` Roboto Condensed (vendored) — stats, captions, dense small print.
- `fitFont()`/`fitFontB()` shrink-to-fit, never overflow.

### Shape

- Cards/buttons: **3px `INK` border**, radius 8–10px, hard offset shadow
  (`~3px` down, `INK` at 50% alpha) — a sticker, not a glow.
- Inner cells/rows: `PAPER_HI` face, 2px `INK`-soft or hairline border.
- No blur shadows, no gradients on chrome, no glow rims, no 0px↔20px mixing:
  radius is 8–10px on chrome, `999` only on capsule chips.

## Component anatomy

- **card**: `PAPER` face · 3px `INK` frame · offset shadow · `INK` header text
- **button (pill)**: same anatomy · primary = `GOLD` face + `INK` text ·
  secondary = `PAPER_HI`/`#e8e8e0` + `INK_SOFT` text · armed/warn = `DANGER`
- **wallet chip**: `INK` face + `PAPER` text (inverted so it floats on field)
- **tab bar**: `INK` bar, inactive tabs `INK` + `#8890b8`; active = `PAPER`
  pill + `INK` text + `GOLD_DEEP` underline
- **stripe/header band**: `INK` band + `PAPER` text (replaces colored stripes)
- **modal**: `PAPER` face, `INK` frame, `INK` header band, `PAPER_HI` rows

## Anti-patterns (hard constraints)

- No dark/glass menu cards, no neon glow, no gradient chrome.
- No text in `PARCH`/light colors on `PAPER` — `PARCH` survives only on
  dark chrome (tab bar, field overlays).
- Real sprite/asset before drawn glyph (see AGENTS.md).
- Battle HUD stays dark for v1 — this contract covers menus only.
