# Ultimates — per-type strike shots

Monster Strike's signature is the **Strike Shot**: one charged move that
turns a fight. Pokéstrike's ult currently has one shape — beams fan out to
every enemy for the firing mon's type. This doc makes it 11 shapes, one per
type in the roster, each a distinct MS archetype with its own animation
language.

## Ground rules

- **Spectacle first, payoff second** — every ult is a freeze, a flash, then a
  beat the player can follow. Nothing resolves in under ~0.8s; nothing drags
  past ~1.5s.
- **Compose existing primitives** — waves (ring fronts), orbs (homing),
  beams, dashes, scars, `flavor()` type particles, `later()` sequencing,
  hitStop/shake/punch/screenFlash. No new render systems per type.
- **Damage band** — the current generic ult is `SUPER_POW × 4.5` per enemy
  (×0.55 vs bosses). Damage-heavy ults stay in that band; control ults
  (delay, pull, DoT) trade ~30–40% of it for their effect. Every ult hits
  with the firing mon's typing — `typeMult(u.def.type, e.def)` stays the
  matchup layer.
- **Fire from whoever you tap** — the charge is the team's, the signature is
  the tapped mon's. Primary type picks the shape.
- **Re-arm**: `ULT_SHOTS` shots after firing, reset per wave. Unchanged.

## Shared ceremony (already exists in `fireUlt`)

Banner text `ULTIMATE <MOVE>!` → white flash → type flash → hitStop 0.55 →
eruption ring → shake/punch → type sfx + cry + haptic. Per-type handlers
plug in *after* this beat, replacing the current `targets.forEach` beam fan.

## The eleven

| Type | MS archetype | Shape | Payoff |
|---|---|---|---|
| fire | Meteor shower | Fireballs arc in from the arena roof onto every foe, staggered; each leaves a `scar` + brief burn | Heavy AoE, small residual DoT |
| water | Wave / push | A tidal front sweeps left→right across the court, dragging every foe to the right wall | Mid damage + forced wall pileup for the next shot |
| grass | Delay + drain | Frenzy vines erupt under each foe — `e.timer += 1`, dealt damage siphons ~35% back to the team | Soft damage, heal, and a bought turn |
| electric | Bounce chain | The bolt hops foe to foe, nearest first — each arc decays ×0.8 (floor ×0.4) | Focused hits; best on few foes, still chains walls |
| psychic | Gravity well | Inward rings pull all foes to the arena centre over 0.6s, then an implosion burst | Low-ish damage, perfect bump setup |
| rock | Targeted meteors | One named boulder per foe drops on its head with a scar decal — ×1.1 raw plus a 1s flinch per survivor | Reliable AoE + stall; heavier than fire, no DoT |
| poison | Status storm | Venom cloud blankets the court: every foe takes a hit and gains `dotTicks` poison | Front-loads DoT instead of burst |
| flying | Comet orbit | The caster launches on a tightening spiral, clipping every foe once with piercing | Mid damage, big motion sell |
| fighting | Rush-down | The caster dashes enemy→enemy rapid-fire (reuse `dashes`), ending with a haymaker on the highest-HP foe | Single-target-leaning AoE |
| ghost | Night slash | Court dims; wisps strike each foe once — bonus damage to foes still above half HP | Execute flavour, good opener |
| normal | Giant mode | The caster swells ×1.7 with a landing quake (×0.35 all foes + toss), then the next launch hits ×2 contact | The iconic MS giant SS — setup ult with a guaranteed floor |

### Beat-by-beat sketches

**fire — FLARE RAIN** `MOVE: FIRE BLAST`-style callout
Darken, then 1 orb per foe spawns at the roof on a staggered `later(i*0.09)`,
streaking down at the foe's position; on land: `scar`, `impact`, `hurt`,
`e.dotTicks = min(+2, 4)` at a small `dotDmg`. Fire `flavor()` embers rise
through it all. *MS echo: meteor SS.*

**water — TIDAL WAVE**
A `wave` ring renders as a wall travelling the court's width; as its front
crosses each foe (`onHit`), apply heavy `vx` push + `hurt`. Foes end piled
against the right wall — reads as the water shoving them, sets up a
ricochet-rich next shot. *MS echo: push/current SS.*

**grass — FRENZY PLANT**
Vine `beams` from each foe into the ground, `e.timer += 1` (visible on their
countdown), `hurt` then `tryHeal` 35% of total dealt. Court briefly flashes
`flavor('grass')` petals. *MS echo: delay SS + drain.*

**electric — VOLT SURGE**
Drive it like `dashes` but visualised as bolts: hop to nearest unhit foe,
`bolt`/`beams` between links, `hurt` with decaying mult (1.4 → ×0.7/hop),
hitStop tick per hop. Caster ends beside the last foe — it's still their
turn's position. *MS echo: weak-point bounce SS.*

**psychic — MIND GRIP**
Two contracting rings (waves with negative growth or shrinking `maxR`
trick), foes get pulled to centre via repeated `vx/vy` nudges over ~0.6s
(`later` chain), then one implosion `impact` + AoE `hurt`. *MS echo:
gravity/pull SS.*

**rock — ROCK SLIDE**
One meteor per living foe (no randomness — count them out), each on
`later(i*0.12)`: `scar` → `impact` → `hurt`. `flavor('rock')` debris.
*MS echo: targeted meteor SS.*

**poison — VENOM BURST**
Court-wide `wave` tinted purple; every foe `hurt` small + `dotTicks += 3`,
`dotDmg = ceil(maxHp*0.08)` — same numbers toxic already uses, just
court-wide. Green-purple `flavor` bubbles. *MS echo: status SS.*

**flying — SKY DIVE**
Reuse `dashes` but the caster traces a visible orbit: `later` chain moves it
through 6–8 ring points around the court edge with a `beams` trail behind;
each foe takes one clip as the orbit passes. SFX layered `wind`/whoosh.
*MS echo: piercing sweep SS.*

**fighting — FINAL RUSH**
`dashes` between foes at 0.08s intervals — dash, `hurt` 0.7, dash… last hit
on the highest-HP foe for 2.2 + a `hitStop` beat and a bigger `impact`.
Caster stays beside the last victim. *MS echo: consecutive-hit SS.*

**ghost — OMINOUS WIND**
`screenFlash` dark + dim overlay beat; wisps (orbs with high `wob`,
type color) converge on every foe; `hurt` with `×1.4` vs foes above 50% HP.
*MS echo: conditional slayer / night slash.*

**normal — GIGANTAMAX ROMP**
The caster's `r` triples and it's handed a fixed velocity pattern (3–4 hard
bounces, seeded `rng`), ~1.6s of real physics where every enemy contact is a
`hurt` + massive knockback — the shot IS the ult. Ends with a pop back to
size. *MS echo: giant mode SS.*

## Signature ults (per-species overrides)

`signatureMove` already overrides bump supers per species; ults get the same
`ULT_OF[id]` escape hatch for headline mons:

- **Pikachu** — 10,000,000 VOLT THUNDERBOLT: the court-wide chain, but every
  hop is full power and it ends with a sky-to-mon thunderbolt on the boss.
- **Charizard** — GIGA FLARE: the X-shaped blast — two crossing beam lanes
  sweep the court instead of a ring.
- **Magikarp** — SPLASH: the banner, a `hop`, nothing… then a second later
  a ludicrous hit on every foe. The gag IS the ult.
- **Mewtwo** — PSYSTRIKE: gravity well but the implosion hits each foe with
  its own weakness (`strikeType` picks the mult per target).

Keep this list short — 3–5 marquees. Type ults are the system; signatures
are seasoning.

## Things deliberately NOT in ults

The MS ability sheet's passive layer (Mine Sweeper, Null Damage Wall,
slayers, barriers, regen) doesn't belong on a one-shot — that's **relic**
territory (`perks.ts`). Candidates the sheet argues for as relics later:
Mine Sweeper (mines buff the ball instead of burning), Drain (heal on
direct hits), Wall Boost (damage per wall touch), Barrier (first hit per
wave eats reduced damage). Out of scope here.

## Implementation

`fireUlt(u)` keeps: banner, flashes, hitStop, ring, sfx, cry, buzz, the
`targets` loop becomes `ULT_SHAPE[src.def.type](u, dmg)` where `dmg` is the
shared power formula (`phys`/`spec` pick + `SUPER_POW` + boss modifier).
Each shape is a ~20–40 line private method — same shape as the `bumpAlly`
switch cases, reusing `waves/orbs/beams/dashes/scar/flavor/hurt/tryHeal/
later`. Dual-type mons fire their **primary** type — predictable, one icon
of truth; signatures can break the rule by name.

Smoke coverage: one assert per shape is overkill — keep the existing
"ult damages every foe" test per type where the shape still deals damage to
all foes (fire/water/rock/poison/ghost), plus a delay assert for grass
(`e.timer` grows) and a position assert for psychic (foes nearer centre).

## Rollout

1. Refactor `fireUlt` → shared ceremony + `ULT_SHAPE` dispatch, defaulting
   to the current beam fan so nothing regresses.
2. Land the five cheap transforms first — psychic (pull), water (push),
   grass (delay), poison (DoT), ghost (conditional mult) — all are knob
   turns on primitives that already exist.
3. Then the three movers — electric chain, fighting rush, flying orbit —
   reuse `dashes`/`beams` plumbing.
4. normal's giant ball last: it's the only shape that needs new physics
   handling (live contact damage on a big ball).
5. Signature overrides ride along as data in `ULT_OF` whenever one is
   worth it.
