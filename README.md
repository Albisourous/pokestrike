# Pokéstrike

**Pokémon × Monster Strike** — a quick daily-run browser game. Pull back, launch
your Pokémon, and bounce it around the arena to smash wild Pokémon and the boss.

Built to be played for 5–10 minutes a day: pick a team of 4, clear 2 waves,
beat the boss, keep your streak alive.

## How to play

```bash
npm install
npm run dev
```

Open the printed URL. Works on desktop and touch.

1. Pick **Daily Strike** (same seeded stage for everyone, streak tracked) or
   **Free Play** (practice stage).
2. **Pick 4 Pokémon** from the roster.
3. **Drag anywhere** on the arena to pull back (like a slingshot), release to
   launch the active Pokémon.
4. Every enemy you bump takes damage with **type effectiveness** — gold `!`
   numbers are super effective, grey means resisted (or immune).
5. **Bump your own teammates** to trigger their signature attack. Enemies
   creep toward your team and attack on a **countdown** — kill them or keep
   moving.

## Bump attacks by type

| Type | Ally bump attack |
| --- | --- |
| Fire | Radial blast around the ally |
| Electric | Chain lightning — jumps between up to 3 enemies |
| Grass | Drain field — damages enemies, heals your team |
| Water | Homing water orbs chase the 3 nearest enemies |
| Psychic | Telekinetic shove — damage + knocks enemies back |
| Flying | Wide gust — weaker shove over a bigger radius |
| Poison | Toxin — immediate hit plus damage ticks after your shots |
| Rock / Fighting | Heavy blow on the nearest enemy |
| Ghost | Hex — weak hit on every enemy on the field |
| Normal | Quick tackle on the nearest enemy |

## Install it like an app

The game ships a PWA: `manifest.webmanifest`, icons, and a cache-first service
worker (`public/sw.js`) registered only in production builds.

- **iOS**: open the deployed site in Safari → Share → Add to Home Screen
- **Android/desktop**: the install prompt appears in the browser
- **Native wrapper**: `npm run build`, then wrap `dist/` with
  [Capacitor](https://capacitorjs.com) (`npx cap init` → `npx cap add ios`) —
  the game is one self-contained static bundle with no backend.

## How it works

- **No engine** — plain TypeScript + Canvas 2D. Physics is custom: slingshot
  launch, wall reflection, circle-vs-circle collisions, friction, knockback.
- **Data-driven** — species stats in `src/game/data.ts`, the type chart in
  `src/game/types.ts`, stages as wave lists with normalized arena coords.
  Adding a Pokémon is a data change, not a code change.
- **Daily mode** — `makeDailyStage(seed)` uses a seeded RNG so everyone gets
  the same waves and boss each day; the streak lives in localStorage.
- **Fixed logical resolution** — 540×960 letterboxed to any window.

```
src/
  core/    vec.ts, loop.ts, assets.ts, rng.ts   # engine plumbing
  game/    types.ts, data.ts, battle.ts,        # rules + battle scene
           screens.ts                            # title / select / result
  main.ts                                       # canvas fit + scene state
public/  sprites/, manifest.webmanifest, sw.js, icons
```

## Sprites & credit

Sprites are from [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (Gen V
front sprites, 96×96), vendored into `public/sprites/` so the game runs offline
after install.

Pokémon is © Nintendo / Game Freak / Creatures Inc. This is a fan-made,
non-commercial project — not affiliated with or endorsed by them.

## Roadmap ideas

- Gauge shot ("tap at the right moment" critical hits)
- Strike shots: per-Pokémon charged abilities (Thunderbolt lines, Surf wave)
- Evolution rewards and a roster you grow over days
- Shared daily leaderboard
