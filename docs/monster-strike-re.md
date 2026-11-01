# Monster Strike 3DS: reverse-engineering notes for Pokéstrike

Source: Albin's own `Monster Strike (Japan).cia` (CTR-P-BFLJ, title `000400000017b300`, code name `monst`).
Pipeline: `ctrtool` (CIA → NCCH → ExeFS `code.bin` + RomFS) → `strings` → Ghidra 12.2 headless
(ARM:LE:32:v6, base `0x100000`, JDK 25) with a script that decompiles every function referencing a
chosen string. No game code or data is committed here, only derived numbers and design notes.

Ground rules: anything marked **(data)** was read directly from a RomFS CSV, **(code)** from the
decompile or RTTI strings, **(inferred)** is our reading of it. Ideas get reinvented for Pokéstrike.
We don't port them line for line.

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
composition over a base entity. A new effect means a new controller, not another branch in the ball.

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

## Phase 2: Mathematical and formula extraction (data)
| system | observed values |
|---|---|
| strike-shot charge | `require_cnt` mode 12 (164 rows), then 18, 16, 20, 13, 14, 24 … 30. Stronger shots charge slower |
| speed-clear par | `bonus_turn` 12 (209 stages), 10 (152), 15, 20, 22, 24. Set per stage, not global |
| boss HP bars | `35/65` (128 stages), `30/30/40` (28), `40/60`. Each bar is a phase gate |
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
| per-stage `bonus_turn` | `SPEED CLEAR` at a fixed `shots <= 12` | next: par from wave count, e.g. `3 × waves` |
| boss HP bars 35/65, 30/30/40 | summons at 2/3 and 1/3 HP, enrage < 30% | next: draw the bar split, clamp overflow at a bar break so each phase has to be earned |
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
  xref `field_items` table global `DAT_0012b734` in Ghidra (`~/re/gproj/monst`).
