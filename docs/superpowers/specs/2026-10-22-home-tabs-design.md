# Home tabs — Clash Royale-style bottom nav

Date: 2026-10-22 · Status: approved by owner (verbal: "3 tabs … come up with a
design document then implement it with multiple sub agents")

## Intent

The title screen carries every affordance at once: 3 hero pills, 7 meta chips,
an ASC dial, records, ladder, footer. It reads cluttered — the user's reference
is Clash Royale's home: a top bar, a big center play button, and a small set of
bottom tabs holding everything else. We adopt that shape: **one floating bottom
nav with 3 tabs**, and the title's content partitioned under them.

## Tabs

Order left→right: **MONS · CLIMB · TOWN**. Default tab: **CLIMB** (center, the
play tab — CR puts battle center for muscle memory).

### CLIMB — the run tab (today's title minus meta chips)

Everything the current title draws EXCEPT the two chip rows
(DEX/ACH/BOARD/TASKS and HATCHER/LAB/ASC):

- field + wilds + vignette + logo + STRIKE wordmark
- echo ghost team ("RIVALS"), login banner, TODAY card
- tagline + hero row: `FREE_BTN` (START CLIMB / CONTINUE), `DAILY_BTN`,
  `RAID_BTN` + streak pip + daily-mod text + `NEW_HIT` abandon link
- records line + ladder bar
- footer: REPORT BUGS link + build sha (stays — testers need it on the front
  door; it is one small line, not clutter)

### MONS — the creature loop

Cards on the shared field background:

1. **HATCHER hero card** — big card (~w 480, h 240): featured mon sprite,
   `THE HATCHER`, pity counter `RARE GUARANTEED IN N`, pull cost, and
   `FREE PULL TODAY` when `freePullLeft()` — carries the breathing gold glow
   the old chip had. Tap → hatcher overlay (existing `HATCH_BTN` hit path,
   re-rected).
2. **DEX card** — `DEX n/CATCHABLE` + the existing `nextGoal` sub-line
   (`N TO CHARM` / `N TO +X★` / `N BADGES LEFT` / `PITY IN N`). Tap → dex
   overlay (`DEX_BTN` hit path, re-rected).
3. **LATEST CATCHES strip** — up to 3 newest `dexRecent()` entries as sprites
   with names; empty state: `CATCHES LAND HERE`. Decorative, no hit test.

### TOWN — the meta loop

2-column card grid (each ~232×110, gutters 16), then a wide row:

1. **LAB** — `THE LAB` + `N/9 TRAINED` (sum of `labLevel(u.id)` over
   `LAB_UPGRADES`) → lab overlay (`LAB_BTN` path).
2. **TASKS** — `TASKS` + `N READY` → tasks overlay (`TASKS_BTN` path). Keeps
   the red count pip (moves onto the card corner).
3. **TROPHIES** — `★ n/N` → achievements overlay (`ACH_BTN` path).
4. **TOP RUNS** — `TOP RUNS` + `BEST n` → board overlay (`BOARD_BTN` path).
5. **ASCENSION** (wide row) — `ASC n` + mod-name sub; tap cycles 0..cap,
   disabled look at cap 0 (`ASC_BTN` path).
6. **REPORT BUGS** is already footered on CLIMB; TOWN gets a copy? No —
   keep it only on CLIMB. TOWN footer shows the build sha once instead.
   Correction: sha already prints on CLIMB footer; TOWN adds nothing at
   bottom but the tab bar. Decided: no extra footer on TOWN.

## The tab bar (shared chrome)

- Floating rounded bar, NOT flush to the edge — the home-indicator swipe
  zone stays clear: `TAB_BAR = { x: 50, y: H - 104, w: W - 100, h: 76 }`
  → bottom edge at 932, ~28 logical px of clearance.
- Three equal cells `TAB_CELLS: { tab: HomeTab; x; y; w; h }[]`, each
  ~146×76 — well over the 44px floor.
- Cell contents: icon (24px) + label (`fontB(10)`) beneath.
- Active cell: raised pill look — gold top stroke + `#1b2140` fill + gold
  label. Inactive: `rgba(255,255,255,0.05)` fill, `#8890b8` label.
- Icons: MONS = `itemSprite('poke-ball')`; CLIMB = `itemSprite('badges/1.png')`
  (boulder badge — vendored); TOWN = a small drawn `homeGlyph` (house
  silhouette, same family as `gearGlyph`/`speakerGlyph`). If a sprite is
  missing the glyph fallback draws — no blank icons.
- **Badge dots on tabs** (CR's notification pull): MONS gets a gold dot while
  `freePullLeft()`, TOWN gets a red dot with the `tasksReady()` count. CLIMB
  never dots.

## Contract (both agents implement against exactly this)

```ts
// screens.ts — new exports
export type HomeTab = 'mons' | 'climb' | 'town';
export const TAB_BAR = { x: 50, y: H - 104, w: W - 100, h: 76 };
export const TAB_CELLS: { tab: HomeTab; x: number; y: number; w: number; h: number }[];
// card hit rects (re-purposed names stay — main.ts keeps working):
//   HATCH_BTN, DEX_BTN   → MONS tab card rects
//   LAB_BTN, TASKS_BTN, ACH_BTN, BOARD_BTN, ASC_BTN → TOWN tab card rects
export function drawTitle(ctx, t, cont, newArmed, dailyArmed, tab: HomeTab);
```

- `drawTitle` gains a 6th param `tab`. Shared chrome (field, wilds, vignette,
  balance chip, mute/gear/? badges, tab bar) draws on every tab; the body
  switches on `tab`. CLIMB body = current body minus chip rows, with
  records/ladder pulled up into the freed space (hero row stays anchored at
  its current y — muscle memory).
- All `_BTN` names keep their semantic meaning but get NEW geometry matching
  their card positions. `MENU_CHIP_W` may go away.
- main.ts: `let homeTab: HomeTab = 'climb'`; tap on `TAB_CELLS[i]` →
  `homeTab = cell.tab; sfx('ui')`. Each chip's hit-test is gated by the tab
  that owns it (e.g. `DEX_BTN` only live when `homeTab === 'mons'`).
  Everything else — overlays, help, settings, bug card, parked-run logic,
  DAILY two-tap arm — unchanged.

## Non-goals / constraints

- No new scenes — overlays (hatcher, lab, dex, tasks, board, trophies,
  settings, help, bug) are untouched modals over whichever tab is active.
- No horizontal swipe gesture for tabs — taps only (canvas swipe is
  occupied by the sling; keep scope tight).
- No removing features — every chip keeps a home; nothing is dropped.
- Keep `?seed=`, first-boot help auto-open, coach arming, `pk_*` stores
  untouched. `homeTab` is session state, NOT persisted (fresh boot lands on
  CLIMB).
- 44px min targets, ~28px bottom clearance (iOS gesture zone rule).

## Meta helper (third agent)

`meta.ts` gains `dexRecent(n = 3): number[]` — last n caught ids, newest
first, via `dexIds()` tail. `test/smoke.ts` gains one pin: after a seeded
`recordCapture` sequence, `dexRecent(3)` returns the 3 newest in order.

## Agent split

1. **screens.ts agent** — tab bar + 3 tab bodies + all rect exports above.
   Owns `src/game/screens.ts` only.
2. **main.ts agent** — `homeTab` state + tap routing + per-tab hit gating.
   Owns `src/main.ts` only.
3. **meta+smoke agent** — `dexRecent` + its smoke pin. Owns `src/game/meta.ts`
   and `test/smoke.ts` only.

Integrator (me): wire review, typecheck + smoke + build, playwright
screenshots of all three tabs, fix collisions, commit.
