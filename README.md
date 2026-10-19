# Pokéstrike

**Monster Strike physics in a Pokémon skin, with a Slay the Spire climb.**
Pull back, launch your Pokémon, and bounce it around the arena smashing wild
mons. Draft a team of 4, climb 9 stages, and take down all three gym
leaders to win the run — or hit **DAILY** for the one seed everyone's
climbing today.

**Play it:** https://albisourous.github.io/pokestrike/

| Title | Draft | Battle |
| --- | --- | --- |
| ![title screen](docs/title.png) | ![draft round](docs/draft.png) | ![battle](docs/battle.png) |

| Region map | Aiming | Reward |
| --- | --- | --- |
| ![region map](docs/map.png) | ![aiming](docs/aim.png) | ![relic reward](docs/reward.png) |

| Charm pick | Trainer battle | ? Event |
| --- | --- | --- |
| ![starting charm](docs/charm.png) | ![trainer battle](docs/trainer.png) | ![event stop](docs/event.png) |

| Wave mutator | Mines | Boss weak point |
| --- | --- | --- |
| ![swarm wave](docs/mutator.png) | ![mine hazard](docs/mines.png) | ![gym weak point](docs/weakpoint.png) |

| Victory loot | Soul-linked pair | Power zone + auras |
| --- | --- | --- |
| ![coin shower after a gym](docs/loot.png) | ![zombie pair tether](docs/zombie.png) | ![power zone, gravity aura, skull mark](docs/powerzone.png) |

## How to play

```bash
npm install
npm run dev    # serves on 0.0.0.0, open the printed Network URL on your phone
```

The game is also deployed to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`), so you can play from any device at
https://albisourous.github.io/pokestrike/.

Open the printed URL. Works on desktop and touch. The `?` button opens a
scrollable in-game manual — and your first wave teaches by doing, with a
ghost pull that repeats until you've really slung one.

1. Hit **START CLIMB** for a 9-stage climb (Slay the Spire style): random wild
   stages, a **gym leader** every 3rd stage, bigger and meaner packs as you
   go, and a win only when the third gym falls. Or hit **DAILY** — the same
   UTC-date seed for everyone, so today's climb is one shared mountain.
   Every run is fully seeded (the island, the draft deals, every roll all
   reproduce): share cards carry a `?seed=` link that deals the exact same
   climb, and `?seed=NNN` by hand pins any seed for debugging. Enemy typing is hidden (`?`)
   until a mon takes a hit or attacks; you learn the matchup by engaging.
   Gym leaders bring same-type entourages and a **signature attack** (Mewtwo
   hunts you with psychic orbs, Dragonite fires a hyper beam line,
   Gyarados sweeps the court, Charizard scorches a ring), and every gym
   you beat lets you **keep the leader's ace** for your own team.
2. **Draft your team.** Four rounds, one of three Pokémon each round, from a
   132-species pool of unevolved first-stagers. Every round offers **three
   different types** so teams stay varied. The heavy hitters (Gengar,
   Snorlax, Dragonite...) aren't in the draft at all; you catch them mid-run.
   Each card shows the mon's **role** at a glance: **SPEEDSTER** (fast
   shot, combos), **TANK** (huge HP), **SNIPER** (long-range super,
   frail), **BRUISER** (heavy hits), **HEALER** (super heals the team),
   **WILD** (all-rounder), plus its full base-stat block and any trait
   tag: **PIERCE** sails straight through enemies instead of bouncing off
   them, and **COPY** (Ditto) replays the super, stats, typing and
   cooldown, of whichever ally bumps it.
3. **Pull back to aim.** Drag direction sets your launch angle and a dotted
   **guide line** previews the ball's banks off walls and rocks, ending on
   whatever it would hit first. **Power is timing**: a
   meter ping-pongs while you hold, so release inside the gold band for a
   full-power `PERFECT!` shot (shockwave, slow-mo and all). The band's
   spot is the mon's own, set by base Speed: fast mons sit high and tight,
   slow mons get a lower, wider target. Every wall
   **bank** on the way pays +8% contact damage on the hits that follow, the
   Monster Strike trick-shot fantasy, and stone blocks count.
4. Every enemy you bump takes damage with **type effectiveness**. Gold `!`
   numbers are super effective, grey means resisted (or immune).
5. **Bump your own teammates.** Every pass-through is a combo link (rising
   ×N counter, escalating hit-stop and flashes), and each link **powers up
   the launch**: +10% contact damage and a momentum kick per bump, so
   routing through the whole team turns a good shot into a rampage. Each
   ally's
   signature **super** starts uncharged and builds one notch per shot. The
   pip meter under its HP bar fills as it charges, all-gold means ready,
   and its move name appears overhead; that's the one you want to hit
   next. Enemies creep and dart toward your team and attack on a
   **countdown**, so kill them or keep moving. Wild **healers** patch their
   most-wounded ally instead of attacking (kill the cleric first or the
   fight drags), and bosses
   **enrage** under 30% HP, attack timers cycling a third faster. Bosses
   also carry a drifting gold **weak point** on their rim — contact on
   that face pays triple — and **cry for help** at 2/3 and 1/3 HP,
   flooding the court with adds that halve the damage they take until
   you clear them. Every third boss attack is a teleport hop, so no
   pocket stays safe. Route one shot through every living ally in a
   single launch and they all fire at once — `TEAM CHAIN!`
5b. **The team ultimate.** One shared charge builds across your shots —
   when it fills, every living teammate glows gold. Tap any of them and
   *that* mon's signature detonates across the whole court, shaped by its
   type: fire rains meteors that crater and burn, water sweeps a tidal
   front that piles foes into a wall, psychic drags everything to center
   court then implodes, fighting dashes foe-to-foe ending on a FINISHER,
   and normal turns the caster giant (fatter hitbox, double contact)
   until its next launch. The full set is in the type tables below.
6. **Read the field.** Each wave re-themes the court and the wilds match
   the stage's biome: grove draws grass-and-bird packs, cavern
   rock-and-ghost, volcano fire packs, sky flyers and electric, right down
   to ambient embers, petals, and wisps drifting over the floor.
   **Stone clusters** stand mid-court as bounceable cover; bank off them
   like walls for the same per-bounce damage bonus. The court
   fights back too — but only against you (enemies take no environment
   damage): **lava pools** scorch the ball, **tall grass** drags your
   launch to a crawl, **wind bands** push the ball sideways, **spike
   strips** chip it on contact, and **mine pads** detonate when the ball
   touches them — the blast still chips you, but it shoves the pack
   around for free repositioning. Deep waves can roll a **mutator**: SWARM
   floods in extra fodder, HASTY starts timers low, VOLATILE makes KOs
   burst onto neighbors, A BIG ONE supersizes a fodder, a gold glint
   guarantees one shiny in the pack, and a **soul-linked pair** shares a
   green tether — fell one and its partner drags it back at partial HP
   (twice each, then they're done), so drop both in the same shot.
   Rarer affixes: a **skull-marked foe** pays a team heal + score bounty
   on KO, a **gravity aura** carrier slows your ball to a crawl inside
   its bubble, and a **power zone** paints an ATK field — shots landing
   from inside it hit +50% harder. An
   **Air Balloon** item floats over all of it. **Field pickups** spawn
   each wave and the ball collects them by touch: **Oran Berry** heals the
   team, **Protein** boosts contact damage for the rest of the shot,
   **Elixir** knocks a notch off every super's cooldown. Heavy hits scar
   the court, and some spawn pairs sit close enough to squeeze the ball
   between them for multi-hits. **Combo shots**: when the ball touches two
   different things — foe, ally, wall, stone — inside a 0.35s window, the
   second contact flashes `COMBO SHOT!` (banks only count while the ball
   still has speed). Relics are what make them pay: **Binding Band** gives
   +40% contact damage on the hit and **Ether** feeds the launcher a
   super pip.
7. **Catch 'em.** A KO has a chance to send the enemy to your **box**
   (`CAUGHT!` ball wiggle and all); beating a **gym leader** is the only
   guaranteed catch — their ace joins you, and the boss bursts into a
   **coin shower**: a few seconds to drag your mon through the spinning
   PokéCoins before they fade, +25 score each. Swap boxed
   mons onto the team freely between stages. HP follows the mon, so
   benching never heals or revives. A **duplicate** catch doesn't waste a
   slot: it feeds the copy you own, evolving the mon if its line has a
   next stage or becoming **rare candy** (a stat bump, or a team
   heal if it's benched). Evolved **elites** start appearing from stage 2
   and get common deeper in, and any normal wave can be **invaded** by a
   legendary (the birds, the beasts, Mew, Celebi) crashing in as a
   mini-boss worth catching. Bosses can be caught mid-fight too, and a
   Master Ball item never fails. Rare **shiny** wilds (~1 in 48 spawns)
   sparkle gold; KO one and it's a guaranteed catch plus a score bonus.
   Fill 100 dex entries for the **Shiny Charm**, which doubles every shiny
   roll from then on.
8. **Choose an item between stages** (Slay the Spire style): heals, +max HP,
   +damage, faster recharges, launch speed, revive. Builds stack across the
   run, so draft for synergy and item for the holes. Cold board? **Decline**
   the reward for +150 score instead. Mid-pick the **TEAM · ITEMS** button —
   or a tap on the **NEW CATCH** card — opens the same box panel the map
   carries, so a fresh catch can be swapped in before you even pick the
   relic. **Type charms** (Charcoal,
   Mystic Water, Magnet...) give +20% to one type and stack; going mono-type
   is a real build (they only roll for types you actually field). Then pick
   your **route** on the region map: non-gym rows
   offer 1-2 linked stops to tap: safe **wilds** (catchable fights),
   **trainers** (a real NPC class fields a mono-type squad — no catches,
   no shinies, but elite-tier loot), **chests** (a free relic),
   **Poké Center rests** (full heal and fainted mons revived), and **?**
   event stops — a roll from the event pool: a heal, a free catch, a
   rare candy stash, a wonder trade, an egg that hatches a few stops
   later, or an ambush (an alpha guarding treasure, a wild pack) that
   fields a scripted wave. Field two or more mons of one type and its
   **type trait** kicks in (shinies count double, fainted mons don't):
   fire burns brighter, ghosts execute low foes, psychic hits splash —
   tiers show as chips under the map. Waves that outlast 10 shots ramp
   enemy damage, so stalls get punished. Gyms are
   forced singles every third row; the island itself is a seeded
   porygion-style value-noise map. The items you've taken ride the reward
   screen as an icon strip.
9. **It remembers you.** Caught mons join your **dex** and can show up in
   future draft pools; gym wins raise your **rank**, and higher ranks unlock
   gated items in the pool. Your **best score** lives on
   the title screen. Tap the dex count on the title for the **Pokédex**, every
   catchable species lit when owned. **TOP RUNS** keeps your eight best
   climbs — score, stage, and the team's sprites on a plaque (a legacy best
   from before the board gets seeded in as the bar to beat). Every finished
   run moves the **ranked ladder** — POKé BALL → GREAT → ULTRA → MASTER →
   CHAMPION — deep runs climb, early wipes bleed. Each leader's first KO
   banks a **gym badge** toward the LEAGUE CHAMPION case, and a **trophy
   shelf** of achievements pays out the rest (FLAWLESS climbs, ricochet
   streaks, shiny catches, one scalp per leader). Lose a run and that exact
   team comes back as a **RIVAL BATTLE**
   wave in your next one, at the levels it earned, shinies included.
   Beat it to clear the echo. Every clear raises
   your **ascension** (shown on the title): enemies get +15% bulk and +8%
   damage per tier, and pay a +20%/tier score premium.
9b. **Level up mid-run**: every KO feeds the mon that landed it levels.
    Bigger foes teach more, and punching above your weight pays double.
    Stats grow on the real Gen-3 formula (up to Lv 100), so a high-level
    carry is a different monster entirely. Levels survive evolution and
    benching since they follow the mon. Feed your carry, not your bench.
9c. **Signature moves**: drafted and caught mons shout their *own* move
    (Pikachu `THUNDERBOLT`, Gyarados `TWISTER`, Mewtwo `PSYCHO BOOST`),
    and draft cards show the super you'll unlock. Draft cards can roll
    **shiny** (~1 in 50) too; a gold card stays gold for the whole run.
9d. **Before stage 1, choose your charm**: one of three held items to
    start the climb with (shown against your drafted team), after a
    one-per-run draft **reroll** if the board is cold. Or **SKIP** the
    charm entirely for +200 score.
9e. **Perfect streaks and revenge**: back-to-back gold releases stack up
    to +28% shot damage (watch `PERFECT ×n` in the HUD); a fainted
    teammate surges the survivors +8% damage and a sip of HP.
10. **Share your result.** The result screen shows a Wordle-style emoji grid
    (🟩 cleared waves, 🟥 where you fell), your final team as real sprites,
    rarity-colored **run badges** (FLAWLESS, MEGA KO, BOSS THIEF, SHINY
    HUNTER...), an MVP star on your carry, a "N pts short of your best"
    hook, and a `★ NEW RECORD ★` when you top it. **SHARE RESULT**
    posts a trainer-card readout (team names, score, badges, the grid) with
    a `?seed=` link — opening it deals that exact climb. A `SEED · build`
    stub sits in the corner so any screenshot is a complete bug report.
    **REMATCH** drops you straight into a fresh draft.

## Real stats, real roles

Every species carries its canonical base stats (HP / Atk / Def / SpA / SpD /
Spe). The mapping is one rule: **physical attacks roll Attack vs Defense,
special attacks roll Sp.Atk vs Sp.Def.**

| Stat | What it does in Pokéstrike |
| --- | --- |
| HP | Max HP (players `60 + 1.15×`, bosses `5.8×`) |
| Attack | Damage when your launched Pokémon physically hits an enemy |
| Defense | Shrinks physical damage taken: contact hits and enemy zaps |
| Sp. Atk | Damage of the bump combo when an ally is hit mid-shot |
| Sp. Def | Shrinks special damage taken: boss blasts, poison ticks |
| Speed | Launch velocity for your team; approach speed for enemies |

So Pikachu (55 Atk / 90 Spe) is a fast skirmisher, Jigglypuff (115 HP / 20
Spe) is a slow tank, and Geodude's 100 Defense means physical hits bounce off;
hit it with special bump attacks instead. Damage mitigation is
`60 / (60 + def)`, so a defender at 60 takes about half damage.

Supers shout their real move name (`PIKACHU used THUNDER!`), chain lightning
hops enemy to enemy, shockwave rings sweep the field, and everything is
backed by a procedural chiptune soundtrack
(title / battle / victory) plus synthesized WebAudio SFX and haptics. No
audio assets.

## Bump attacks by type

| Type | Ally bump attack |
| --- | --- |
| Fire | Flame Burst: a shockwave ring shoves enemies back as it rolls out, then 3 homing fire-orbs arc into the farthest stragglers |
| Electric | Chain lightning: hops between up to 3 enemies, each hit landing a beat apart |
| Grass | Giga Drain: a field saps nearby foes and heals the team by a cut of it, while 2 seed flares siphon the farthest |
| Water | Hydro Pump: a fat pressurized jet spears the court on a lane to the nearest foe — everything it crosses gets hosed and washed downstream |
| Psychic | Telekinetic shove: a real knockback impulse flings enemies off walls and each other, plus 2 psy-orbs hunt the farthest stragglers |
| Flying | Hurricane: a vortex drags every nearby enemy into a pile on the ally, setting up your next combo |
| Poison | Toxic: a gas cloud now, then a cut of max HP after each of your shots; re-toxining stacks the timer |
| Rock / Fighting | Meteor shower: a jab on the nearest, then 3 meteors rain on the farthest — the craters stay on the court |
| Ghost | Hex: a whole-court shadow ring — every enemy on the field takes the hit |
| Normal | Quick Attack: the ally physically dashes to the nearest enemy, slams it, and stays beside it |

~130 species shout their **own** canon move instead of the type default —
Pikachu fires `THUNDERBOLT`, Magikarp `SPLASH`. Eleven of those get bespoke
FX on top of the type behavior: `HYPER BEAM` is a golden wall of light,
`ZAP CANNON` tracks the farthest foe, `PSYCHO BOOST` detonates the biggest
target, `EXPLOSION` clears the field at 15% recoil, `SHEER COLD`
flash-freezes a zone, and `ERUPTION`, `BLAST BURN`, `FRENZY PLANT`,
`OUTRAGE`, `SOLARBEAM`, `HYDRO CANNON` each play differently.

## Team ultimates by type

One shared charge — tap any glowing teammate and its type decides the shape:

| Type | Ultimate |
| --- | --- |
| Fire | Flare Rain: a fireball streaks down on each foe — craters and a short burn |
| Water | Tidal Wave: a front sweeps in off the wall and shoves every foe into a pile |
| Grass | Frenzy Plant: vines root every foe (their countdowns slip) and siphon a third of the damage back |
| Electric | Volt Surge: a bolt hops foe to foe nearest-first, each arc weaker than the last |
| Psychic | Mind Grip: five pulses drag the court to the center, then the implosion pays out |
| Rock | Rock Slide: one boulder per foe, dead center — no RNG |
| Poison | Venom Burst: the whole court eats the hit and survivors keep ticking |
| Flying | Sky Dive: an orbital sweep clips each foe in turn, knocking them toward the middle |
| Fighting | Final Rush: real dashes foe to foe, the last hit a 1.9× FINISHER |
| Ghost | Ominous Wind: wisps converge on every foe — double damage on the healthy |
| Normal | Giga Romp: giant mode — fatter hitbox and double contact until its next launch |

## Install it like an app

The game ships a PWA: `manifest.webmanifest`, icons, and a cache-first service
worker (`public/sw.js`) registered only in production builds.

- **iOS**: open the deployed site in Safari → Share → Add to Home Screen
- **Android/desktop**: the install prompt appears in the browser
- **Native wrapper**: `npm run build`, then wrap `dist/` with
  [Capacitor](https://capacitorjs.com) (`npx cap init` → `npx cap add ios`).
  The game is one self-contained static bundle with no backend.

## How it works

- **No engine**: plain TypeScript + Canvas 2D. Physics is custom: slingshot
  launch, wall reflection, circle-vs-circle collisions, friction, knockback.
- **Data-driven**: species + real base stats in `src/game/data.ts`, stat-to-
  mechanic formulas in `src/game/stats.ts`, the type chart in
  `src/game/types.ts`, stages as wave lists with normalized arena coords.
  Adding a Pokémon is a data change, not a code change.
- **Seeded everything**: `makeStage(seed)` builds the opening stretch and
  `rollWave` the deeper stages — but the whole run's roll source
  (`mulberry32`) is seeded too, so draft deals and battle rolls all
  reproduce from one number. `?seed=NNN` pins it, every share card carries
  it, and **DAILY** is today's UTC date as the seed.
- **Meta persistence**: `src/game/meta.ts` keeps the dex, badges,
  achievements, rating, hall of fame, and rival echo in localStorage,
  behind a `pk_ver` schema stamp — `migrateSaves()` upgrades old saves at
  boot instead of breaking them.
- **Decision telemetry**: `pk_stats` logs every offer board (shown vs
  taken) and which stage each run died on — the on-device version of
  MegaCrit's metric server. `?dev` exposes `__dbg` (scene, live battle,
  coordinate probe) plus `__dbg.stats()` to dump it.
- **Built for bug reports**: the title screen carries a git-hash build
  tag, the result screen a `SEED · build` stub, and any uncaught error
  paints a crash card with both — one screenshot is a complete report.
- **Phone-ready**: `touch-action`/`overscroll` killed, `visualViewport`
  sizing, and a screen wake lock holds while a run is live.
- **Fixed logical resolution**: 540×960 letterboxed to any window.

```
src/
  core/    vec.ts, loop.ts, assets.ts, rng.ts,  # engine plumbing
           audio.ts                             # chiptune music + synth sfx + haptics
  game/    types.ts, data.ts, stats.ts,         # rules + stat formulas
           perks.ts, bg.ts, meta.ts,            # items, backdrops, persistence
           map.ts, maptiles.ts,                  # seeded region map + atlas tiles
           battle.ts, screens.ts                 # battle scene + title/draft/result
  main.ts                                       # canvas fit + scene state
public/  sprites/ (mons, items, gracidea, cries), manifest.webmanifest, sw.js, icons
```

## Art & credit

All game art is **Pokémon FireRed/LeafGreen (Gen 3 GBA)** era, vendored
from two places:

- Mons: official FRLG battle fronts (64×64, keyed by dex id) from
  [PokeAPI/sprites](https://github.com/PokeAPI/sprites)
  `sprites/pokemon/versions/generation-iii/firered-leafgreen/` →
  `sprites/<id>.png`
- Items: official item icons from the same repo (`sprites/items/`) →
  `sprites/items/<name>.png`
- Scenery: the [Gracidea](https://github.com/lowlighter/gracidea) pack
  (RSE tileset + npcs), vendored into `public/sprites/gracidea/`: court
  edges get real tileset props (trees, boulders, flowers, scorched
  debris)

One era is what keeps the theme cohesive: new art gets vendored or sliced
from these sources, never invented shapes. Hazard zones and court paint
are translucent gameplay markings, not scenery.

Pokémon is © Nintendo / Game Freak / Creatures Inc. This is a fan-made,
non-commercial project, not affiliated with or endorsed by them.

## Roadmap

The climb is the game. What's next, in rough order:

- Balance passes driven by `pk_stats` pick rates and stage deaths —
  balance from logs, not vibes
- More canon signature FX and species-unique ultimates
  (`docs/ultimates.md` is the design doc)
- Endless mode past the 9th gym — deliberately deferred until the core
  climb is rock solid
