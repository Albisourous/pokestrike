# Monster Strike 3DS: reverse-engineering notes for Pokéstrike

Source: Albin's own `Monster Strike (Japan).cia` (CTR-P-BFLJ, title `000400000017b300`, code name `monst`).
Pipeline: `ctrtool` (CIA → NCCH → ExeFS `code.bin` + RomFS) → `strings` → Ghidra 12.2 headless
(ARM:LE:32:v6, base `0x100000`, JDK 25) with a script that decompiles every function referencing a
chosen string. No game code or data is committed here, only derived numbers and design notes.

Ground rules: anything marked **(data)** was read directly from a RomFS CSV, **(code)** from the
decompile or RTTI strings, **(inferred)** is our reading of it. Ideas get reinvented for Pokéstrike.
We don't port them line for line.

## Where the RE files live

Everything lives in the repo at `re/` (gitignored — local machine only, extracted game data never
commits). Reuse it instead of re-extracting or re-decompiling. The CIA stays at
`~/Documents/MonsterStrike/Monster Strike (Japan).cia`.

| What | Path (under `re/`) |
|---|---|
| ExeFS `code.bin` | `exefs/` |
| RomFS (stage CSVs, `2d/bg/btl*.arc`, `2d/ui/battle*`) | `romfs/` |
| Full decompile, every function in one file | `analysis/decomp/monst_decomp_all.c` |
| Function index (address, name, size) | `analysis/decomp/functions.tsv` |
| Round 1 decompile (CSV table loader `FUN_0012b26c`) | `analysis/decomp/decomp_out.c` |
| Analysed Ghidra 12.2 project, open without re-analysis | `analysis/ghidra/gproj/monst.gpr` |
| Headless scripts (`ExportAll.java`, `DecompXrefs.java`) | `analysis/ghidra/scripts/` |
| `strings` dump of code.bin (RTTI class names, CSV paths) | `analysis/code_strings.txt` |
| SARC / BFLIM / stage CSV tools | `analysis/tools/` |
| Decoded battle backgrounds, walls, UI (PNG + contact sheets) | `analysis/art_png/` |

To find a class's code: RTTI name in `code_strings.txt` → typeinfo → vtable → slot 5 (per-frame
update) → look the address up in `functions.tsv` → grep `@<address>` in `monst_decomp_all.c`.
`analysis/README.md` has the re-run command.

## Phase 1: Pure logic analysis

### Binary layout (code)
| segment | size |
|---|---|
| .text | `0x2D7130` |
| .rodata | `0x39200` |
| .data | `0x64598` |
| .bss | `0x621D0` |

RTTI class names expose the battle architecture: `TaskCharBall` / `TaskCharBallCtrBase` (player ball),
`TaskBullet` + `TaskBulletCtr_*` controllers (`StrikeShotCounterUp`, `HPSuction`, `HeartBarrierTrigger`,
`EnergyHeart`, `SuperMoveAttack`, `AttackCounterReset`), `TaskDamageWall`, `TaskEnemyCtrBoss`,
scenes `SceneBattle`, `SceneBattleResult`, `SceneGacha`, `SceneLuckMax`, and the mission API
`Mission_Is{BattleClear,CaptureChar,Clear,Progress}` / `Mission_Set{Clear,Open,Progress}`.
(inferred) Each effect is its own controller class attached to a shared `Task` entity, so it's
composition over a base entity. A new effect gets its own controller on the shared entity.

### Master table loader `FUN_0012b26c` (code)
```c
FUN_002a74ac(tbl, cap, "rom:/Battle/local_csv/<name>.csv", 0);   // x14 tables
```
| param | role |
|---|---|
| `param_1` (`DAT_*`) | `CsvTable*`: vtable, `rows*` @+4, `count` @+8, `capacity` @+0xC, `growBy` @+0x10 |
| `param_2` | initial row capacity: strike_shots 800, stages `0x208`=520, stage_groups `0xdc`=220, advent 100, stage_phase_blocks 300, mutations `0xaa`=170, field_items `0x14`=20, friend_achieve 20 |
| `param_3` | RomFS path |

After loading, the function compacts `stage_groups` in place: each 0x9C-byte (156 B) row is kept
only if the referenced entry in the global table (`*(global+0x174)[row+8]`) exists and has a non-zero
first `u16`. If `count ≥ capacity`, it reallocates to `capacity + growBy` rows and copies 39 words per row.
(inferred) Content is filtered once at boot against what the build ships, so the data can name
stages the client doesn't have. Pokéstrike's `data.ts` pools are the same idea, and the room loader
already validates content up front.

`FUN_0012cdf4` / `FUN_0012d3d4` load `stage/stage_phase_enemies_%08d.csv` per stage on demand,
which is lazy per-stage spawn tables.

### Table schemas worth stealing (data)
- `field_items` (62 rows): `effect`, `value`, `incidence`, `evolution_id`, `evolution_turn`, `group_id`.
  Row 1 heals 50, has incidence 75 and evolves to row 2 (heal 100) after **1** turn. Rows 5→6 and 7→8 evolve after **3** turns.
- `stage_phase_enemies`: `rate` (spawn %), `escape_dmg`, `hide_wp_rate` (weak point hidden %), `self_drop_rate`, 4 drop slots.
- `stages` (513): `bonus_turn` (speed-clear par), `boss_hp_bar` split, stamina `cost`, `friend_achievement_point`, `extra_stage_id/weight` (secret stage roll, unused in this build).
- `strike_shots` (1140): `require_cnt` = turns to charge, one per character.
- `advent_phase_rates`: chance a rare boss crashes each phase.

### Battle stage structure (data: `stage/stage_phases_*`, `stage_phase_enemies_*`, `char_enemy_attacks_*`, `char_enemy_collisions_*`, 280 stages)
- **Battles per stage**: 8 in 145 of 280 stages, 7 in 40, 5 in 38, 6 in 31. Each battle (`stage_phases`) caps live enemies at `enemy_max` (mode 6, then 5, 7, 4, 8).
- **Boss spans the last battles**: in 8-battle stages the boss first shows up in battle 6 and stays through 8, at the same level (e.g. stage 40090010: battles 6-8 field boss lvl 5700 / hp-level 14000). `stages.boss_hp_bar0..2` splits its HP across those battles (e.g. 30/30/40). The escort grows across them (7 → 9 enemies in stage 40080010).
- **Optional battles**: some mid battles carry `skip_rate` 50/60/70/85/100. (inferred) a roll can skip that battle, so the same stage plays with a different length.
- **Spawn pools**: each battle lists more spawn rows than `enemy_max`, each with its own `rate` (25/100/50/70/30 %), so the board differs between plays.
- **Several attack clocks per enemy**: 1124 enemy/stage pairs have 2 distinct attacks, 502 have 3, 469 have 4. Each attack row has its own `turn` countdown (mode 3, then 2, 5, 4, 7, 1, 11). A typical boss runs 3/4/7/11-turn clocks side by side: short chip attacks plus a long heavy one. `first_attack_turn` (1-4) delays the first fire, and `group_id` swaps the attack set per boss battle (stronger rows such as `value_0` 12000-20000 only in later groups).
- **Hitboxes with weak points**: enemies carry 2-9 collision circles. Flag 5 is the body (`damage_rate` 100), flag 8 is a small weak point (radius 2).
- **Battle walls**: `stage_phase_blocks` has per-battle walls (`type` 1: 186 rows, `type` 5: 21), plus code classes `TaskDamageWall`, `TaskMine`, `TaskWarpZone`, `TaskBarrier`.

## Phase 2: Mathematical and formula extraction (data)
| system | observed values |
|---|---|
| strike-shot charge | `require_cnt` mode 12 (164 rows), then 18, 16, 20, 13, 14, 24 … 30. Stronger shots charge slower |
| speed-clear par | `bonus_turn` 12 (209 stages), 10 (152), 15, 20, 22, 24. Set per stage, not global |
| boss HP bars | `35/65` (128 stages), `30/30/40` (28), `40/60`. Each bar is a phase gate |
| boss attack clocks | per-attack `turn`: 3 (2846 rows), 2 (2440), 5, 4, 7, 1, 11. Each clock counts down on its own and resets after it fires |
| boss bar battles | bar `i` ends at `hp = maxHp × (1 − Σ bar[0..i])`. (inferred) damage stops at the bar floor and the next battle starts |
| field item growth | `heal(t) = 50` for `t < 1`, else `100`. Doubles after one ignored turn |
| enemy HP curve | `enemy_level_adjusts`: 9000 → 50000 in 16-step groups, about +3000–4000 per step (linear) |
| stat ceilings by rarity (max hp / atk) | r4 ≈ 7000/7716, r5 ≈ 11704/12026, r6 ≈ 17764/19213. `extend_*` "plus" caps add about +3900 hp at r6 |
| level caps | 15/20/40/70/99 by rarity |
| power gauge | `shot_gauge1..4` zone widths 50/35/10/5 %, speed 100–200 |

Execution order of a turn (code: class names, inferred: order): player sling → `TaskCharBall`
collision → friend combos (`char_skills`, triggered by touching allies) → `TaskBulletCtr_*` effects
→ field items collected → enemy turn counters tick → boss attacks → strike-shot counters
(`StrikeShotCounterUp`) and field-item `evolution_turn` advance.

## Phase 3: Architecture and porting design
Mapped onto Pokéstrike's existing seams (via Graphify: `Battle` is the god node, content lives in `data.ts`):

| Monster Strike | Pokéstrike today | port |
|---|---|---|
| field item evolution | `Pickup` + `PICKUP_META` | **done**: `PICKUP_RIPEN` table + `ripenPickups()` on enemy→player handoff |
| per-stage `bonus_turn` | `SPEED CLEAR` at a fixed `shots <= 12` | **ported** (#14): per-stop `par = clamp(4 × battles + 10 if boss, 10, 24)`, `TURN n/par` chip, bonus on the last clear |
| boss HP bars 35/65, 30/30/40 over the last 3 battles | summons at 2/3 and 1/3 HP, enrage < 30% | **ported** (boss battles PR): `BOSS_BARS = [0.3, 0.3, 0.4]`. Each bar break clamps HP, the escort flees, the room reloads, fresh adds spawn, and the boss's clocks reset |
| several attack clocks per boss | one `timer` per enemy | **ported** (boss battles PR): bosses add a heavy-attack clock (`BOSS_BIG_TIMER = 7`) that hits the whole team |
| `stage_phases` battles, `enemy_max`, `skip_rate` | one battle per stop | **ported** (#13): wild stops run 1 + extras at `BATTLE_SKIP = [0, 0.5, 0.7]` (2 to 4 battles), `ENEMY_MAX = 5` per extra battle. Spawn `rate` pools stay rolled waves |
| `stage_phase_layouts` per boss battle | one `ROOM_BOSS` for every bar | **ported** (#11): one authored gym room per bar |
| battle entry: court scrolls, then enemies drop in | foes stood in place during the scroll | **ported** (#10): foes hidden for `COURT_SCROLL`, then fall in over `FOE_DROP`; pulls wait for the landing |
| per-mon `require_cnt` | team `ULT_SHOTS = 10` | keep team ult. Optionally scale charge by ult power |
| `hide_wp_rate` weak points | none | candidate: bosses hide a weak spot that takes ×3 |
| `advent_phase_rates` | legendary invades | already covered |
| `SceneLuckMax`, dupes | `pk_bond` | already covered |
| stamina `cost`, gacha | none | anti-goal (AGENTS.md: no monetization) |

Rules for every port: data first (a `const` table in `battle.ts` or `data.ts`), no new rng draws
(keeps `?seed=` replays stable), no per-frame allocation (mutate pickups/enemies in place, same
as the original's fixed-capacity tables), and hooks only at the existing turn boundary.

## Phase 4: Implementation (PR: ripening pickups)
```ts
// MS field items grow if left on the field.
const PICKUP_RIPEN: Partial<Record<PickupKind, { to: PickupKind; turns: number }>> = {
  'oran-berry': { to: 'sitrus-berry', turns: 1 },
};
private ripenPickups() {               // called once per resolved enemy turn
  for (const pk of this.pickups) {     // in place: no allocation, mirrors fixed CSV tables
    pk.age++;
    const ripen = PICKUP_RIPEN[pk.kind];
    if (!ripen || pk.age < ripen.turns) continue;
    pk.kind = ripen.to; pk.age = 0;    // rng-free, so seeded runs replay identically
  }
}
```
Sitrus heals 30% max HP (MS: 50 → 100, so ×2). It shares the oran heal branch in `grabPickup`.

## Phase 5: Validation and edge cases
- [x] `npm run smoke`: oran left through one enemy turn becomes sitrus with `age` reset, and sitrus heals 30% max HP.
- [x] `npm run build` passes.
- [ ] Thief steals a sitrus and drops it on KO: it comes back as sitrus with `age: 0`, so no double ripen.
- [ ] Wipe / ash revive path: `ripenPickups()` runs only after a non-wipe enemy turn.
- [ ] Same `?seed=` before and after: identical wave/pickup layout (no new rng draws).
- Precision risk: MS stores stats as integers (CSV ints, 16-bit fields in the 156-byte rows). Pokéstrike
  uses float HP with `Math.round` at heal time, so heal amounts can differ by ±1 from an integer port.
  That's harmless here, but any future port of the 9000→50000 enemy curve should round once at spawn.
- Open: the per-turn evolution routine itself wasn't located in `.text` yet (only the loader). Next step:
  xref `field_items` table global `DAT_0012b734` in Ghidra (`analysis/ghidra/gproj`, see "Where the RE files live").

## code.bin findings (Ghidra 12.2, raw ARM v6 @ 0x100000)

Method: headless import of the ExeFS `code.bin` as a raw binary, full
auto-analysis, then RTTI name strings → typeinfo → vtables → per-class
update method (vtable slot 5), decompiled and read by hand. The binary,
the Ghidra project and every decompiled listing stay off-repo; what
follows is our own description of the behaviour, with numbers read from
literal pools. "Confirmed" means the constant sits in the named
function's code path; "inferred" means the value exists in the binary
but its role is our best reading.

### Class map

| Class | How found | Update method |
|---|---|---|
| `TaskCharBall` (player ball) | RTTI + vtable | slot 5, one big switch on a per-ball state byte |
| `TaskDamageWall` | RTTI + vtable | slot 5, timer-driven fade/flash state machine |
| `TaskEnemyCtrBase` / `TaskEnemyCtrBoss` | RTTI + vtable | slot 5 per enemy controller |
| `TaskBulletCtr_HPSuction`, `_EnergyHeart`, `_SuperMoveAttack`, `_AttackCounterReset`, `_HeartBarrierTrigger`, `_StrikeShotCounterUp` | RTTI + vtables (all share `TaskBulletCtrBase`; heart-barrier and counter-up derive from `TaskBulletCtrTriggerBase`) | slot 5 each |
| `TaskMine`, `TaskWarpZone`, `TaskBarrier` (+`TaskBarrierCtr_HeartBarrier`) | not C++ RTTI: registered in a custom type table of {parent, method table, name} triples | via that table |

Battle effects are addressed by a numeric id into one `.arc` name table.
The ids show which beats the game treats as distinct feedback: separate
effects for weak-point hit, critical, wall reflect, three tiers of
"combo just" (a timed friendship-combo variant), killer hit, five
elemental damage-wall skins, warp zone, three barrier tiers, and the
anti-damage-wall / anti-barrier ability popups.

### Player ball movement (confirmed)

The ball's velocity is not damped by a constant friction. Each 60 Hz
frame it is multiplied by `1 − (t / T)^4`, where `t` is seconds since
launch and `T` is the shot's travel time. Early in the shot the factor is
≈1 (the ball glides at near-launch speed through bounces); as `t`
approaches `T` it collapses and the ball stops abruptly. Speed is never
"ticked down" by a fixed amount, so every shot lasts about `T` seconds
regardless of launch power.

| Item | Value |
|---|---|
| Per-frame velocity factor | `1 − (t/T)^4` |
| "Slow" flag raised once | when speed² < 40 000 (speed < 200 units/s) |
| Speed-down hit | `T` (and two sibling timers) scale by `pct × 0.01`; factor floored at 0.01, `T` floored at 0.1 s |
| Hop/airborne sub-state | upward speed `clamp(k, 0.7, 1.2) × 800`, gravity 5 880 units/s² |
| Second launch sub-state | `clamp((0.8 + 0.2k)·k, 0.7, 1.4) × 600` |
| Speed-stat factor `k` | raw speed stat × 0.0005 (MS speed stats are in the hundreds–thousands) |
| Tilt smoothing | low-pass `0.98 × old + 0.02 × new` per frame, wrapped at 360° |

A separate branch maps a pull length to a 0..1 power as `(len − 1)/16`
clamped, with 400 as the base and 1 600 as the power span; we read it as
the aim/pull feedback curve, not the launch speed.

### Damage wall (inferred timings)

`TaskDamageWall` runs a frame-counted cycle with literals 18, 30, 45 and
83 frames and alpha ramps of 0.2 / 0.5 / 0.8; we read this as
appear → active → flash → fade. Damage itself is applied by the ball
when it reflects off a wall flagged live, not by the wall task.

### Enemy controller (inferred)

The enemy update holds a shake/hit-react loop: 0x14 frames of jitter
(±3 / −2 units on alternating frame pairs) and an alpha that climbs 0.05
per frame to 1. A `1 − x · 2/3` falloff and thresholds 0.9 / 1.2 gate the
damage-taken flash scale. 1.3333 and 0.6667 both exist as literals in the
bullet-controller family, consistent with MS's public ×1.33 advantage /
×0.66 disadvantage element rule; we did not trace them to the hit path.

### Not located this pass

Attack-vs-defense formula, weak-point and critical multipliers, the
friendship-combo trigger, strike-shot turn counter (`StrikeShotCounterUp`
vtable found but its add amount not traced), enemy turn countdown, and
speed-clear counting. The per-stage numbers for those already come from
the CSV tables above.

### Ported (this PR)

| MS behaviour | PokeStrike |
|---|---|
| Time-boxed shot, `v *= 1 − (t/T)^4` per frame | `shotDamp(t, h)` in `battle.ts` = `exp(−60·(t/SHOT_T)^4·h)`, used by live play and the aim ghost; slick/ice/friction mults scale it |
| Speed curve `clamp((0.8 + 0.2k)k, 0.7, 1.4)` | `launchMult` in `stats.ts`, `k = Spe / 75` so Spe 75 = 1.0 |

Kept on purpose: Pokémon type chart (×2/×0.5/×0) instead of MS ×1.33,
existing weak-point/crit numbers (not confirmed in code), ult and combo
rules.

## code.bin findings, round 2 (hit damage, counters)

Same setup as round 1. This pass followed the element table, the
strike-shot counter item and the attack-counter-reset item into their
callers. Every "confirmed" row below was read in the function that uses
it; "inferred" rows are our reading of a field whose meaning comes from
context (its data source or the effect it fires), not from a name.

### Hit damage (confirmed)

One function computes the damage of a ball (or bullet) touching an
enemy. It has a single caller, the hit dispatcher, so normal hits,
bump-combo bullets and strike shots all pass through it. The shape:

`damage = attack × element × part × killer × (one factor per active ability)`

Each ability factor is a whole-number percent read from the character's
ability data and scaled by `0.01`. The result is truncated to an
integer; anything below 2 becomes exactly 1 and swaps in a separate
low-damage hit effect (we read it as the "resisted" pop). Damage above
3000 picks a heavier hit effect.

| Item | What the code does | Status |
|---|---|---|
| Attack vs defense | No defense term. Base is the attacker's attack stat; the enemy side only contributes multipliers (element, part, its own resist abilities) | confirmed |
| Element table | 6×6 float table (none, fire, water, wood, light, dark), indexed `[attacker][defender]`; out-of-range ids fall back to a default of 1 | confirmed |
| Element values | Advantage `1.33`, disadvantage `0.66` (stored as 1.33 / 0.66, not 1.3333 / 0.6667). Fire > wood > water > fire; light and dark are both 1.33 against each other | confirmed |
| Element boost abilities | `e' = 1 + (e − 1) × pct × 0.01`, then floored at 0.3 | confirmed |
| Minimum damage | Truncated damage under 2 is set to 1; a landed hit never deals 0 | confirmed |
| Weak point | No fixed weak-point constant. Each enemy hitbox carries its own multiplier from the collision table (`damage_rate`). Parts without the weak flag are capped at ×1, so only flagged parts can multiply up | confirmed (cap); values are per-enemy data |
| Killer | A separate check asks the attacker for a percent against the enemy's race, then against its element; it only applies when the result is above ×1 | confirmed |
| Critical | No random roll anywhere in the hit path. Criticals are ability-driven multipliers, not a base-game chance | confirmed (absence in this function) |
| 1.3333 / 0.6667 literals | Not in the hit path. They sit in bullet-controller and pull-feedback pools | inferred unrelated |

### Strike-shot charge (partly confirmed)

The ball keeps a charge counter that counts *up* toward the strike
shot's required count (the `require_cnt` column, looked up per strike
shot id). The add routine only adds while the counter is below the
requirement. The `StrikeShotCounterUp` field item drifts across the
board, and when a ball touches it, it adds its stored amount to that
ball's counter; the constructor sets the amount to 1, so one pickup
removes one turn of charge.

| Item | Value | Status |
|---|---|---|
| Counter direction | Counts up to `require_cnt` | confirmed |
| Pickup amount | +1 (default; per-item field) | confirmed |
| Add rule | Only while below the requirement | confirmed |
| Per-turn tick | Not located: the add routine's only caller is the pickup, so the per-turn step is inlined somewhere else | not located |

### Enemy attack countdown (partly confirmed)

Each enemy keeps one countdown per attack slot (multi-part enemies keep
one per part row), each with its own maximum from the attack data. The
`AttackCounterReset` item waits one second, then for every enemy in its
target range sets each slot whose counter is below its maximum back to
that maximum, plays its effect, and ends 1.5 s later. It only raises
counters; a slot already at or above its maximum is left alone.

| Item | Value | Status |
|---|---|---|
| Counter model | One countdown per attack slot, each with its own max | confirmed |
| Reset rule | `counter = max` only where `counter < max` | confirmed |
| Reset delay / lifetime | 1 s, then ends after 1.5 s | confirmed |
| Per-turn decrement | Not located | not located |
| Boss phase transitions | `TaskEnemyCtrBoss`'s update is a thunk into the base enemy update; no boss-only phase logic found in it. Phase changes come from the stage tables (`boss_hp_bar` split, `group_id` attack sets) | inferred |

### Friendship combo (not located)

The combo effect ids (combo, three "combo just" tiers, combo-up) are in
the effect table, but the code that detects ball-on-ally contact and
fires the combo was not found this pass. Its once-per-shot rule and
power scaling stay unknown.

### Damage wall, hop, pull (no change)

No new evidence for the 18/30/45/83 frame timings, the hop sub-state or
the pull curve beyond round 1.

### Ported (round 2)

| MS behaviour | PokeStrike |
|---|---|
| A landed hit deals at least 1 | `hitFloor(raw, mult)` in `stats.ts`, used by `strikeEnemy()`. Type immunity (×0) still deals 0 |

Kept on purpose: Pokémon `typeMult` (×2/×0.5/×0) instead of the 1.33 /
0.66 table; the 2 / 3 weak-point numbers (MS values are per-enemy data,
not a constant); the crit chance perk (MS has no base crit roll, but the
perk is a run upgrade); Pokémon Atk/Def mitigation (MS has no defense
term, but stats are the Pokémon identity here); `ULT_SHOTS = 10` and the
foe clock numbers (per-turn steps not located; MS values are per-unit
data).

## code.bin findings, round 3 (turn loop, countdowns, walls)

Same Ghidra setup as rounds 1–2. Values read through the game's
obfuscated-int getter/setter pair are described by meaning, not by field.

### Turn advance (confirmed)

One battle-manager routine runs between shots. In order:

```
for each of the 4 team slots with a live ball:
    if battle has started: tick_turn_counter(ball)     # see below
pick next shooter = next live slot, (i + 1) mod 4, skipping empties
turn_number += 1
for each live ball:  ball.on_turn()
for each of up to 10 live enemies: enemy.on_turn()
```

`on_turn()` is a shared base method (balls, enemies and the boss use the
same slot). It only counts down a turn-limited status (clearing its flag
at 0) and applies an ability's per-turn effect. It does not touch attack
countdowns or the strike-shot charge.

### Per-ball turn counter (inferred: likely strike-shot charge)

The first loop above calls a small per-ball routine on **every** team
ball, not only the one that just shot:

```
tick_turn_counter(ball):
    if quest flag "freeze" (0x400) is clear:
        if counter > 0: counter -= 1
        return counter == 0   # ready
```

So the counter steps by exactly 1 per team turn and floors at 0. It sits
next to the strike-shot fields, but round 2 found the strike-shot charge
counting *up* to `require_cnt`; whether this down-counter is the same
charge seen from the other side or a different per-ball timer is not
confirmed.

### Enemy attack countdown (confirmed)

```
pick_attack(enemy):
    single-clock enemy: choose the next attack by weighted random over the
        enemy's attack table, then
        countdown = (turn_number == 0) ? attack.first_count : attack.count
    multi-clock enemy: each slot whose countdown hit 0 gets the same reset
        from its own row

tick_countdown(enemy):          # one step per turn
    if countdown != 0:
        countdown -= 1
        if countdown == 0: fire_count += 1   # attack queued
```

Counts never go below 0; the attack fires on the step that reaches 0 and
the next `pick_attack` re-arms it. Opening turn uses a separate
first-turn count from the data, so a foe's first swing can come sooner
or later than its repeat cycle. Multi-clock slots flagged as passive
(bits 0x60) never tick. A separate routine adjusts the countdown by an
argument (delay/advance effects); its exact rule was not decoded.

### Damage wall timing (confirmed, corrects round 1)

The 18/30/45 literals are not phase lengths. They are a per-variant
value picked by wall subtype (45 default at init, 30 for the normal
wall, 18 for subtype 0x100) fed to the wall's animation, most likely its
playback rate. Actual phases are timed in seconds and turns:

```
appear:  t += dt
         alpha = clamp(t - 0.2, 0, 1)      # 0.2 s delay, then 1 s fade-in
         sound once when alpha first reaches 1
         t >= 1.5 s  -> live
live:    lifetime -= 1 each time turn_number changes
         lifetime == 0 (or battle-end state) -> vanish
vanish:  special variant: alpha = 255 - 1275 * t   # 0.2 s fade-out
         others: removed after 0.2 s
```

83 multiplies the fade-in alpha into an integer used by a sub-effect
(meaning not decoded). 0.5 is a scale picked for the special variant.
0.8 was not seen in the wall update this pass.

### Still unknown

- Friendship combo: contact detection, once-per-shot/once-per-turn rule
  and power scaling. A ball sub-state scans for an ally within 25 units
  for 10 frames when an ability flag is set, but nothing ties it to the
  combo.
- Boss phase transition internals: nothing beyond round 2 (data-driven
  via HP-bar splits and attack groups).
- The exact meaning of 83 and whether 18/30/45 is a frame rate or a
  frame count.

### Ported (round 3)

Nothing. PokeStrike already matches the confirmed rules: `ultIn` drops
by 1 per launch and stops at 0, and foe `clocks` drop by 1 per turn,
fire on reaching 0 and re-arm to `turn`, and `foeClocks()` already seeds
each clock with a separate `first` count. Kept on purpose: team-wide
per-ball ticking (would speed up per-ball super
cooldowns, a balance change), and wall timings (hazard code belongs to
another pass).

## code.bin findings, round 4 (meta layer + the retention loop)

Same setup. This pass mapped the scene/table inventory around the battle
and pulled the retention mechanics into one picture. "Data" rows come
from the RomFS CSVs, "code" from string/RTTI evidence.

### Meta layer (code)

| Surface | Evidence |
|---|---|
| Scene graph | `cSceneTitle / cSceneField / cSceneFieldMenu / cSceneQuestSelect / cSceneBattle / cSceneBattleResult / cSceneGacha / cSceneLuckMax / cSceneEvolutionComposition / cSceneReinForcedComposition / cSceneMonsterSell / cSceneNewCharcter / cSceneChapterTitle / cSceneStaffRoll` |
| Script bindings | a C API for `.lbn` scripts: `Camera_*`, `CharBall_*`, `Deck_*`, `Dialog_*`, `EffectObj_*`, `Item_*`, `Npc_*`, `Party_*`, `Scene_*`, `StrikeCard_*`, `Mission_*` |
| Field encounters | `encountSymbol*.lbn` + `Npc_GetEncountNpcBattleStage` — walking into a symbol on the overworld starts a battle on the spot |
| Meta tables (patch layer, not in this CIA's RomFS) | `Table/Gacha/Gacha_000.dat`, `Table/Encount/{EncountStage,SpecialAdvent,EncountNpcSetting}_000.dat`, `Table/Mission/`, `Table/Trophy/`, `Table/Item/`, `Table/FieldMap/`, `Pack/Menu/*.dat`, `Pack/Menu/luck_max.dat` |

### The retention engine (data)

The slot machine is three layers deep:

1. **Per-KO roll** — `stage_phase_enemies.self_drop_rate` + four
   weighted `slot_N_drop_*` slots per enemy. Every kill is a pull.
2. **Ambient drops** — `stages.rt_*` roll *during* the fight: coins,
   evo mats (`rt_evo1..3`), rares, eggs (`rt_egg_id1..3`), medals,
   tickets — each per-stage `incidence` + `max`.
3. **End-chest fan** — `stages.bonus_0..5` are six independent chest
   slots (item + count + rate each) plus `bonus_sp_*`. The clear screen
   opens them one at a time.

Wrapped around it: per-stage speed-clear par (`bonus_turn` 10–24),
hidden weak points (`hide_wp_rate`), fleeing rare spawns
(`escape_dmg`), advent intruders (`advent_phase_rates` — a rare boss
can crash *any* phase: `0,50,100,100,100,100,65`), secret stages
(`extra_stage_id/weight/cond` ×3), boss HP-bar phases (`boss_hp_bar`
35/65, 30/30/40, 40/60), growing pickups (`field_items.evolution_*`),
per-mon strike-shot charge (`require_cnt` 7–30), gauge-shot timing
(`shot_gauge` zones 50/35/10/5 on ~20 chars), killers
(`char_efficacious`, 2,179 rows), dupes→luck→more chests
(`cSceneLuckMax`, `com_luck`, `dummy_luck_kiwami`), item-cost evolutions
and multi-parent mutations (`char_evolutions`, `char_mutations` —
`request_drop_rateN` gates recipes behind *drop luck*), and stamina
(`stages.cost` 10–60 — F2P pacing, N/A offline).

### Port status, refreshed

Everything earlier rounds marked "candidate" has since landed:
`weakpoint.ts` (hidden wp ×2/×3), `flee.ts` (rare fleeing spawn),
`secret.ts` (rank-gated lairs), `INVADERS` (mid-wave legendaries),
`loot.ts` (per-KO ball drops + staged reveal), `missions.ts`,
`gimmicks2.ts` (wind/laser/ice/spin/warp), `connect.ts` (ALL CONNECT),
`gauge.ts` (gold-band release), `enrageBoss` (~45% bar shift).

True remaining gaps:

1. **Ripen is one family** — MS ripens heal (1 turn) *and* power +
   charge (3 turns each); Pokéstrike only ripens oran→sitrus.
2. **Species-signature drops** — MS foes carry their own 4-slot drop
   table, so quests have a farm identity; Pokéstrike's ball contents
   share one table.
3. **Luck-lite** — dupes feed a chest-odds scaler (`pk_bond` covers the
   adjacent "dupes pay progression" slot already).
4. Cosmetic depth: `cutin` boss splashes, `is_daytime` spawns,
   `stage_phase_layouts.range` ring scatter.

### Ported (round 4)

| MS behaviour | PokeStrike |
|---|---|
| `field_items` rows 5→6 and 7→8: power and charge pickups ripen after **3** ignored turns | `PICKUP_RIPEN` gains `protein → x-attack` (ATK +50% → +100%) and `elixir → max-elixir` (SUPER +1 → +2); icons vendored from PokeAPI/sprites |

Kept on purpose: ripen timers stay enemy-turn based (MS's
`evolution_turn` ticks the same way), and ripened tiers never enter the
spawn pool — they only exist if the player delays gratification, same
as MS.
