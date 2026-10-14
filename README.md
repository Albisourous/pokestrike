# Pokéstrike

**Pokémon × Monster Strike** — a quick daily-run browser game. Pull back, launch
your Pokémon, and bounce it around the arena to smash wild Pokémon and the boss.

Built to be played for 5–10 minutes a day: pick a team of 4, clear 2 waves,
beat the boss, keep your streak alive.

| Title | Draft | Battle |
| --- | --- | --- |
| ![title screen](docs/title.png) | ![draft round](docs/draft.png) | ![battle](docs/battle.png) |

## How to play

```bash
npm install
npm run dev    # serves on 0.0.0.0 — open the printed Network URL on your phone
```

The game is also deployed to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`), so you can play from any device at
`https://<user>.github.io/pokestrike/`.

Open the printed URL. Works on desktop and touch.

1. Pick **Daily Strike** (same seeded stage *and* same draft offers for
   everyone, streak tracked) or **Free Play** — an endless run: random stage,
   and after the boss the arena **descends a depth** with bigger, tougher
   waves (another boss every 3rd depth) until you wipe.
2. **Draft your team** — four rounds, one of three Pokémon each round, from an
   18-species pool. Cards show the real base stats and whether the bump attack
   is physical or special. Build for type coverage: a tank, a fast shooter,
   a big special attacker, a healer — your call.
3. **Pull back to aim** — drag direction sets your launch angle. **Power is
   timing**: a charge meter ping-pongs while you hold — release at the top for
   a full-speed `PERFECT!` launch.
4. Every enemy you bump takes damage with **type effectiveness** — gold `!`
   numbers are super effective, grey means resisted (or immune).
5. **Bump your own teammates** — every pass-through is a combo link (gold
   arc + rising ×N counter, escalating hit-stop and flashes). The ally's
   signature **super** fires only if it's recharged — cooldowns tick down
   per shot (cyan bubble shows shots left). Enemies creep and dart toward
   your team and attack on a **countdown** — kill them or keep moving.
6. **Choose a relic between waves** (Slay the Spire style): heals, +max HP,
   +damage, faster recharges, launch speed, revive. Builds stack across the
   run — draft for synergy, relic for the holes.
7. **Share your result** — the result screen shows a Wordle-style emoji grid
   (🟩 cleared waves, 🟥 where you fell) plus your drafted team as type-colored
   squares. Tap **SHARE RESULT** to post or copy it — streak included.

## Real stats, real roles

Every species carries its canonical base stats (HP / Atk / Def / SpA / SpD /
Spe). The mapping is one rule: **physical attacks roll Attack vs Defense,
special attacks roll Sp.Atk vs Sp.Def.**

| Stat | What it does in Pokéstrike |
| --- | --- |
| HP | Max HP (players `60 + 1.15×`, bosses `5.8×`) |
| Attack | Damage when your launched Pokémon physically hits an enemy |
| Defense | Shrinks physical damage taken — contact hits and enemy zaps |
| Sp. Atk | Damage of the bump combo when an ally is hit mid-shot |
| Sp. Def | Shrinks special damage taken — boss blasts, poison ticks |
| Speed | Launch velocity for your team; approach speed for enemies |

So Pikachu (55 Atk / 90 Spe) is a fast skirmisher, Jigglypuff (115 HP / 20
Spe) is a slow tank, and Geodude's 100 Defense means physical hits bounce off —
hit it with special bump attacks instead. Damage mitigation is
`60 / (60 + def)` — a defender at 60 takes about half damage.

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
- **Data-driven** — species + real base stats in `src/game/data.ts`, stat-to-
  mechanic formulas in `src/game/stats.ts`, the type chart in
  `src/game/types.ts`, stages as wave lists with normalized arena coords.
  Adding a Pokémon is a data change, not a code change.
- **Daily mode** — `makeDailyStage(seed)` uses a seeded RNG so everyone gets
  the same waves and boss each day; the streak lives in localStorage.
- **Fixed logical resolution** — 540×960 letterboxed to any window.

```
src/
  core/    vec.ts, loop.ts, assets.ts, rng.ts   # engine plumbing
  game/    types.ts, data.ts, stats.ts,         # rules + stat formulas
           battle.ts, screens.ts                 # battle scene + title/draft/result
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
