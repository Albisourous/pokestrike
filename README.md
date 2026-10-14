# Pokéstrike

**Pokémon × Monster Strike** — a quick daily-run browser game. Pull back, launch
your Pokémon, and bounce it around the arena to smash wild Pokémon and the boss.

Built to be played for 5–10 minutes a day: pick a team of 4, climb 9 stages,
beat all three gym leaders, keep your streak alive.

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

1. Pick **Free Play** — a 9-stage climb (Slay the Spire style): random wild
   stages, a **gym leader** every 3rd stage, bigger and meaner packs as you
   go, and a win only when the third gym falls. Enemy typing is hidden (`?`)
   until a mon takes a hit or attacks — you learn the matchup by engaging.
   Gym leaders bring same-type entourages, and every gym you beat lets you
   **keep the leader's ace** for your own team.
2. **Draft your team** — four rounds, one of three Pokémon each round, from a
   10-species pool of unevolved starters. Every round offers **three
   different types** so teams stay varied — the heavy hitters (Gengar,
   Snorlax, Dragonite…) aren't in the draft at all; you catch them mid-run.
   Cards show each mon's **role** — read its stats at a glance:
   **SPEEDSTER** (fast shot, combos), **TANK** (huge HP), **SNIPER**
   (long-range super, frail), **BRUISER** (heavy hits), **HEALER** (super
   heals the team), plus what the bump super actually does.
3. **Pull back to aim** — drag direction sets your launch angle and a dotted
   **guide line** previews the ball's banks off walls and rocks, ending in a
   target ring on whatever it would hit first. **Power is timing**: a charge
   meter ping-pongs while you hold — release at the top for a full-speed
   `PERFECT!` launch (slow-mo + speedlines included).
4. Every enemy you bump takes damage with **type effectiveness** — gold `!`
   numbers are super effective, grey means resisted (or immune).
5. **Bump your own teammates** — every pass-through is a combo link (gold
   arc + rising ×N counter, escalating hit-stop and flashes). The ally's
   signature **super** fires only if it's recharged — cooldowns tick down
   per shot (cyan bubble shows shots left). Enemies creep and dart toward
   your team and attack on a **countdown** — kill them or keep moving.
6. **Read the field** — every wave re-themes the arena (grove, cavern,
   caldera, sky). Ponds wall off everything but Water/Flying, lava
   everything but Fire/Rock/Flying; dirt **ledges** hop one way like RSE;
   hazard pads slow you in tall grass, keep you sliding on ice, or fling
   you along an arrow — and wild mons hide in the grass until you get
   close. Rocks and trees give cover: supers can't hit what they can't see.
7. **Catch 'em** — a Ranger-style ring on each enemy fills as its HP drops;
   a KO has a chance to send it to your **box** (`CAUGHT!` ball wiggle and
   all), and every cleared stage guarantees **one recruit** — beat a gym
   leader and their ace joins you. Swap a boxed mon onto the team between
   stages (one swap per break). Evolved **elites** (gold ring) start
   appearing from stage 2 and get common deeper in. Bosses can be caught
   mid-fight too — a Master Ball relic never fails.
8. **Choose a relic between stages** (Slay the Spire style): heals, +max HP,
   +damage, faster recharges, launch speed, revive. Builds stack across the
   run — draft for synergy, relic for the holes. Then pick your **path**:
   the safe **ROUTE**, or the **ELITE** road — a bigger fight with a
   guaranteed elite spawn, and the next relic offer rolls uncommon-or-better.
9. **Share your result** — the result screen shows a Wordle-style emoji grid
   (🟩 cleared waves, 🟥 where you fell), your drafted team as type-colored
   squares, and rarity-colored **run badges** (FLAWLESS, MEGA KO, BOSS
   THIEF, SPEED CLEAR…). Tap **SHARE RESULT** to post or copy it.

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

Supers shout their real move name (`PIKACHU used THUNDER!`), forked lightning
hops enemy to enemy, fire rings sweep the field, KOs spin out into faint
ghosts, and everything is backed by a procedural chiptune soundtrack
(title / battle / victory) plus synthesized WebAudio SFX and haptics — no
audio assets.

## Bump attacks by type

| Type | Ally bump attack |
| --- | --- |
| Fire | Flame Burst — a fire ring sweeps outward from the ally; enemies burn as the front passes over them and get shoved back |
| Electric | Chain lightning — hops between up to 3 enemies, each arc landing a beat apart with a sky strike |
| Grass | Drain field — damages enemies, heals your whole team by a quarter of what it dealt |
| Water | Hydro Pump — three homing orbs corkscrew into the nearest enemies and splash on impact |
| Psychic | Telekinetic shove — damage plus a real knockback impulse that flings enemies off walls and each other |
| Flying | Hurricane — a vortex drags every nearby enemy into a pile on the ally, setting up your next combo |
| Poison | Toxic — immediate hit plus poison that ticks a cut of max HP after each of your shots; re-toxining stacks it |
| Rock / Fighting | Meteor fist — the nearest enemy eats a one-two of falling rock; the second hit leaves a crater |
| Ghost | Hex — wisps converge from the dark, weak hit on every enemy on the field |
| Normal | Quick Attack — the ally physically dashes to the nearest enemy, slams it, and snaps back |

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
  core/    vec.ts, loop.ts, assets.ts, rng.ts,  # engine plumbing
           audio.ts                             # chiptune music + synth sfx + haptics
  game/    types.ts, data.ts, stats.ts,         # rules + stat formulas
           perks.ts, bg.ts,                     # relics + themed backdrops
           battle.ts, screens.ts                 # battle scene + title/draft/result
  main.ts                                       # canvas fit + scene state
public/  sprites/, manifest.webmanifest, sw.js, icons
```

## Sprites & credit

All Pokémon use one consistent theme: **Generation V (Black/White) pixel
sprites** from [PokeAPI/sprites](https://github.com/PokeAPI/sprites) —
`public/sprites/<id>.png` is the static 96×96 front sprite and
`public/sprites/anim/<id>.png` is the matching animated strip (converted from
the Gen V animated GIFs). Everything is vendored so the game runs offline after
install — when adding a species, keep it in the same Gen V theme.

Pokémon is © Nintendo / Game Freak / Creatures Inc. This is a fan-made,
non-commercial project — not affiliated with or endorsed by them.

## Roadmap ideas

- Gauge shot ("tap at the right moment" critical hits)
- Strike shots: per-Pokémon charged abilities (Thunderbolt lines, Surf wave)
- Evolution rewards and a roster you grow over days
- Shared daily leaderboard
