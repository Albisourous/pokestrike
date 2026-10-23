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

### Spacing

Canvas is 540×960 logical. All chrome spacing lands on a **4px grid** —
`SP` in `ui.ts` is the scale; reach for the token, not a literal.

| Token | px | Use |
|---|---|---|
| `SP.xx` | 2 | hairline nudge — glyph shadows, optical alignment only |
| `SP.xs` | 4 | icon↔text, chip inner padding |
| `SP.sm` | 8 | cell padding, pill side padding, chip↔chip gap |
| `SP.md` | 12 | row↔row inside a card, card inner margin |
| `SP.lg` | 16 | sibling component gap |
| `SP.xl` | 24 | section break inside a panel |
| `SP.xxl` | 40 | region break — header→body, body→footer |

Named constants that aren't `SP` but are canon:

- `PANEL_M = 14` — the margin every big window shares (`x:14, w:W-28`)
- `CARD_GAP = 9` — draft card lane gap (deliberate: 3-frame × 3px chrome)
- `LINE_B = 11` — `fontB(9)` line rhythm; stat lines step ~20

Rules:

- New spacing is a multiple of 4. The **3px border/shadow/radius language
  is shape, not spacing** — it never comes out of `SP`, and `SP` never
  describes it.
- Vertical rhythm: stat lines step 20, captions step `LINE_B`, section
  breaks are `SP.xl` minimum. Dead bands bigger than `SP.xxl` inside a
  panel mean the panel is too tall — shrink the panel, don't space-fill.
- Insets are symmetric — a card pads with one token on all four sides
  (the double frame's 6px rim + 3px border already reads as padding).
- Siblings separate by one gap token — don't inset both sides of a joint.
- Tap targets ≥44px where possible; pills run 40–46px tall.
- Text smaller than `fontB(9)` is a warning sign — if it needs 7px to
  fit, the line is decoration; cut it (show, don't tell).

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
