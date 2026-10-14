# Pokéstrike

**Pokémon × Monster Strike** — a quick daily-run browser game. Pull back, launch
your Pokémon, and bounce it around the arena to smash wild Pokémon and the boss.

Built to be played for 5–10 minutes a day: pick a team of 4, clear 2 waves,
beat Mewtwo, chase your best clear time.

## How to play

```bash
npm install
npm run dev
```

Open the printed URL. Works on desktop and touch.

1. **Pick 4 Pokémon** from the roster on the team-select screen.
2. **Drag anywhere** on the arena to pull back (like a slingshot), release to
   launch the active Pokémon.
3. Every enemy you bump takes damage — with **type effectiveness** (a fire hit
   on grass lands 2x).
4. **Bump your own teammates** to trigger their attack: a shockwave that damages
   every enemy around them.
5. Enemies attack on a **countdown** (the number bubble). Bosses fire an AoE
   shockwave — keep your team out of the blast or end the fight fast.
6. Clear all 3 waves to win. Your best clear time is saved locally.

## How it works

- **No engine** — plain TypeScript + Canvas 2D. Physics is ~150 lines of custom
  code: slingshot launch, wall reflection, circle-vs-circle elastic collisions,
  exponential friction, hit cooldowns.
- **Data-driven** — Pokémon stats/types live in `src/game/data.ts`, the type
  chart in `src/game/types.ts`, and stages are wave lists with normalized arena
  coordinates. Adding a Pokémon or a stage is a data change, not a code change.
- **Fixed logical resolution** — 540×960 letterboxed to any window, so it plays
  identically on phone and desktop.

```
src/
  core/    vec.ts, loop.ts, assets.ts      # engine plumbing
  game/    types.ts, data.ts, battle.ts,   # rules + battle scene
           screens.ts                       # title / select / result
  main.ts                                   # canvas fit + scene state
public/sprites/                             # PokeAPI sprite PNGs
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
- More stages, daily seeded runs, evolution rewards
- Bump combos that differ per ally type instead of a generic shockwave
- Actual Gen-1-style back sprites for the player's team
