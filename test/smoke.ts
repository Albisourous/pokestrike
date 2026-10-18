// Headless playthrough — no DOM. Bundle: rolldown test/smoke.ts -f esm -p node
import './shims';
import { Battle, MAP_CELL, MAP_OX, MAP_OY, ULT_SHOTS } from '../src/game/battle';
import { makeStage, ROSTER, TOTAL_STAGES, speciesById, rollWave, trainerWave, tierOf, BOSS_POOL, ALL_SPECIES } from '../src/game/data';
import { existsSync } from 'fs';
import { mulberry32 } from '../src/core/rng';
import { roleOf, ROLE_MODS, moveOf, MOVE_NAME, LV_CAP, offStat, lvlPow } from '../src/game/stats';
import { genRegion, routePath } from '../src/game/map';
import { teamTraits, TRAIT_DESC } from '../src/game/traits';
import { typeMult, strikeType, weatherMult } from '../src/game/types';
import { rollEvent } from '../src/game/events';
import { dexIds, shinyIds, unlockedAch, unlockAch, ACHIEVEMENTS, coachDone, markCoached, best, badgeOf, gymBadges, earnBadge, BADGES, applyRunRating, rating, tier } from '../src/game/meta';
import { PERKS } from '../src/game/perks';

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    fails++;
    console.error(`FAIL  ${msg}`);
  }
};

const arena = { x: 30, y: 160, w: 480, h: 620 };
const team = () => [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[12]];

// --- ascension scales enemy bulk ----------------------------------------
{
  const stage = makeStage(7, 'Test');
  const a = new Battle(arena, team(), stage, mulberry32(1));
  (a as any).spawnWave(0);
  const hpA = (a as any).enemies[0].maxHp;
  const b = new Battle(arena, team(), makeStage(7, 'Test'), mulberry32(1));
  b.asc = 5;
  (b as any).spawnWave(0);
  const hpB = (b as any).enemies[0].maxHp;
  ok(hpB > hpA, `ascension scales enemy hp (${hpA} -> ${hpB})`);
}

// --- ascension modifiers: named tiers on top of the bulk ------------------
{
  const base = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  (base as any).spawnWave(0);
  const t0 = (base as any).enemies.find((e: any) => !e.def.melee)?.timer;
  const hot = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  hot.asc = 2;
  (hot as any).spawnWave(0);
  const t1 = (hot as any).enemies.find((e: any) => !e.def.melee)?.timer;
  ok(t1 !== undefined && t0 !== undefined && t1 < t0, `ASC 2 foes wind up faster (${t0} -> ${t1})`);

  const rest = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  rest.asc = 4;
  const p = (rest as any).players[0];
  p.hp = 10;
  (rest as any).arriveAtNode({ kind: 'rest' });
  ok(p.hp === Math.round(p.maxHp * 0.75), `ASC 4 rests heal to 75% (${p.hp}/${p.maxHp})`);

  const gym = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  gym.asc = 6;
  (gym as any).spawnWave(2);
  const boss = (gym as any).enemies.find((e: any) => e.boss);
  ok(boss?.enraged === true, 'ASC 6 gym leaders arrive enraged');
}

// --- designed opener: clustered first pack + breathing room -------------
{
  const b = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(9));
  (b as any).spawnWave(0);
  const es = (b as any).enemies;
  ok(es.length === 3, 'opener fields three fodder');
  const xs = es.map((e: any) => (e.x - arena.x) / arena.w);
  const spread = Math.max(...xs) - Math.min(...xs);
  ok(spread < 0.45, `opener foes clustered for the ricochet (spread ${spread.toFixed(2)})`);
  ok(es.every((e: any) => e.timer > (e.def.melee ? 2 : 3)), 'opening wave foes give one extra beat');
}

// --- elite stops: deeper mono-type squad, rare-or-better loot -------------
{
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  (b as any).spawnWave(0, { kind: 'elite', ttype: 'fire', row: 0, tx: 0, ty: 0, links: [] });
  const es = (b as any).enemies;
  ok(es.every((e: any) => e.def.type === 'fire'), `elite fields a mono-type squad (${es.length} mons)`);
  (b as any).enterReward();
  ok(
    b.rewardOffers.length > 0 && b.rewardOffers.every((p) => p.rarity === 'rare' || p.rarity === 'legendary'),
    `elite pays rare+ relics (${b.rewardOffers.map((p) => p.rarity).join(',')})`,
  );
}

// --- KOs level the shooter ----------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(2));
  (b as any).spawnWave(0);
  const shooter = (b as any).active;
  const e = (b as any).enemies[0];
  const pow0 = shooter.pow;
  const lvl0 = shooter.lvl;
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(e.dead, 'lethal hit kills');
  ok(shooter.lvl > lvl0 && shooter.pow > pow0, `KO levels shooter (lv${lvl0}->${shooter.lvl} pow ${shooter.pow.toFixed(2)})`);
}

// --- evolution preserves earned levels ------------------------------------
{
  const karp = ROSTER.find((r) => r.id === 129)!;
  const b = new Battle(arena, [karp, ...team()], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  p.lvl = 50; // earned levels mid-run
  (b as any).absorbDupe(karp); // dup catch → evolve
  ok(p.def.id === 130, `Magikarp evolved into ${p.def.name}`);
  const m = ROLE_MODS[roleOf(p.def.stats, p.def.healer)];
  ok(Math.abs(p.pow - m.pow * lvlPow(offStat(p.def.stats, p.def.type), 50)) < 0.001, `levels survive evolution (pow ${p.pow.toFixed(2)} vs base ${m.pow})`);
}

// --- split evolution defers to the player's pick on the reward screen ----
{
  const eevee = ROSTER.find((r) => r.id === 133)!;
  const b = new Battle(arena, [eevee, ...team().slice(0, 3)], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  (b as any).absorbDupe(eevee); // a dupe normally auto-evolves — a branch can't
  ok(p.def.id === 133 && (b as any).evoPending.length === 1, 'split evo waits for a pick');
  (b as any).enterReward();
  ok(b.evoChoice?.options.length === 3, `eevee offers its three forms (${b.evoChoice?.options.map((o) => o.name).join('/')})`);
  b.pickEvo(1); // Jolteon
  ok(p.def.id === 135 && b.evoChoice === null, `picked branch becomes ${p.def.name}`);
  ok(p.def.luck === 1, 'the absorbed dupe banked a luck point through evolution');
}

// --- fusion luck pays out as bonus gym loot ------------------------------
{
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(5));
  const p = (b as any).players[0];
  (b as any).absorbDupe(p.def); // Pikachu dupe: +1 luck AND evolves to Raichu
  ok(p.def.luck === 1 && p.def.id === 26, `dupe banks luck through evolution (${p.def.name} luck ${p.def.luck})`);
  (p as any).def = { ...p.def, luck: 45 }; // a heavily-fused mon
  (b as any).enterLoot();
  const n = 24 + (b as any).depth * 3;
  const base = Math.max(2, Math.round(n * 0.18));
  const gems = (b as any).lootCoins.filter((c: any) => c.kind === 'gem').length;
  ok(gems === base + 4 || gems === base + 5, `team luck 45 pays ~4 bonus gems (${gems} vs base ${base})`);
}

// --- dual-typing: multiplied matchups, better-type strikes ---------------
{
  ok(typeMult('rock', speciesById(6)!) === 4, 'charizard (fire/flying) takes 4x rock');
  ok(typeMult('electric', speciesById(130)!) === 4, 'gyarados (water/flying) takes 4x electric');
  ok(typeMult('ghost', speciesById(282)!) === 0, 'gardevoir (psychic/normal) is ghost-immune');
  ok(strikeType(speciesById(260)!, speciesById(6)!) === 'rock', 'swampert leads with rock vs charizard');
  ok(strikeType(speciesById(260)!, speciesById(130)!) === 'rock', 'swampert leads with rock vs gyarados too (rock 2x2)');
  ok(strikeType(speciesById(260)!, speciesById(383)!) === 'water', 'swampert leads with water vs groudon');
}

// --- gauge shot: a gold-zone release arms +20% contact --------------------
{
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(2));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const u = (b as any).active;
  b.pointerDown({ x: u.x, y: u.y });
  // park the meter in the gold band — the band jitters per pull now, so
  // solve dragT through the live charge/sweetSpot pair instead of constants
  for (let i = 0; i < 6; i++) {
    const z = (b as any).sweetSpot();
    const P = (0.85 - 0.3 * (b as any).gaugeDifficulty()) * (1 + (b as any).gaugeJit * 0.14);
    let dt = P * z.c - (b as any).gaugeStart * 2 * P;
    dt = ((dt % (2 * P)) + 2 * P) % (2 * P);
    (b as any).dragT = dt;
    if (Math.abs((b as any).charge() - (b as any).sweetSpot().c) <= z.hw) break;
  }
  b.pointerMove({ x: u.x + 60, y: u.y });
  b.pointerUp();
  ok(b.phase === 'shot' && (b as any).shotGold === true, 'gold release arms the gauge bonus');
}

// --- gauge difficulty: stronger species get tighter, drifting windows ------
{
  const easy = new Battle(arena, [speciesById(129)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(2));
  const hard = new Battle(arena, [speciesById(149)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(2));
  const ez = (easy as any).sweetSpot();
  const hd = (hard as any).sweetSpot();
  ok(hd.hw < ez.hw * 0.6, `dragonite's gold window is much tighter than magikarp's (${hd.hw.toFixed(3)} vs ${ez.hw.toFixed(3)})`);
  (easy as any).dragT = 1.3;
  ok((easy as any).sweetSpot().c === ez.c, 'weak mons keep a steady gold band');
  (hard as any).dragT = Math.PI / 4.8; // sin peak — dragT * 2.4 = π/2
  ok(Math.abs((hard as any).sweetSpot().c - hd.c) > 0.03, 'legendary-tier gold band drifts while held');
}

// --- weather courts: the sky tilts the matchup table -----------------------
{
  ok(weatherMult('sun', 'fire') === 1.5 && weatherMult('sun', 'water') === 0.75, 'sun boosts fire, dulls water');
  ok(weatherMult(null, 'fire') === 1 && weatherMult('rain', 'grass') === 1, 'clear sky and neutral types unchanged');
  const FOR: Record<string, string> = { grove: 'rain', cavern: 'sand', volcano: 'sun', sky: 'wind' };
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(7));
  (b as any).spawnWave(0);
  ok((b as any).weather === null || (b as any).weather === FOR[(b as any).theme], 'wave weather follows the court theme');
  const strike = (w: string | null) => {
    const bb = new Battle(arena, [speciesById(4)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(5));
    (bb as any).spawnWave(0);
    (bb as any).hazards = [];
    (bb as any).weather = w;
    const u = (bb as any).players[0];
    const e = (bb as any).enemies[0];
    const hp0 = e.hp;
    (bb as any).strikeEnemy(u, e);
    return hp0 - e.hp;
  };
  const clear = strike(null), sunny = strike('sun');
  ok(sunny > clear, `sun buffs charmander's contact (${clear} -> ${sunny})`);
}

// --- benching keeps earned levels ------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(13, 'T'), mulberry32(4));
  (b as any).spawnWave(0);
  const p = (b as any).players[1];
  p.lvl = 7;
  p.pow *= lvlPow(offStat(p.def.stats, p.def.type), 7); // simulate its earned growth
  const swappedPow = p.pow;
  b.box.push(ROSTER[5]);
  b.boxHp.push(1);
  b.boxLvl.push(3);
  b.phase = 'reward';
  b.teamSel = 1; // a swap started from the team side resolves the same way
  b.swapFromBox(0, 1); // bench the Lv7, bring in the box Lv3
  ok(b.teamSel === -1 && b.boxSel === -1, 'swap clears both selections');
  ok(p.lvl === 3, `swapped-in mon carries its own level (lv${p.lvl})`);
  ok(b.boxLvl[0] === 7, `benched mon keeps earned levels (boxLvl ${b.boxLvl})`);
  ok(Math.abs(p.pow - ROLE_MODS[p.role].pow * lvlPow(offStat(p.def.stats, p.def.type), 3)) < 0.001, 'swap recomputes pow from its own level');
  void swappedPow;
}

// --- reward flow: roster management gates the item pick ---------------------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.phase === 'reward' && b.rewardStep === 'team', 'reward opens on the team step');
  b.advanceReward();
  ok(b.rewardStep === 'item', 'advanceReward flips to the item step');
  b.rewardStep = 'team';
  b.advanceReward();
  ok(b.rewardStep === 'item', 'going back and re-advancing still reaches items');
  b.declineReward();
  ok(b.phase !== 'reward', 'decline still exits the reward screen');
}

// --- ultimate: a tap on the charged mon detonates the court -----------------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  b.ultIn = 0;
  const u = (b as any).active;
  const hp0 = (b as any).enemies.map((e: any) => e.hp);
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerUp();
  ok(b.ultIn === ULT_SHOTS, 'firing the ult re-arms the counter');
  for (let i = 0; i < 60; i++) b.update(0.05); // the beams land on a stagger
  ok((b as any).enemies.every((e: any, i: number) => e.dead || e.hp < hp0[i]), 'the ult hits every foe on the court');
}

// --- ranked ladder: depth pays, early wipes bleed ----------------------------
{
  const r0 = rating();
  const w = applyRunRating(9, true, 0);
  ok(w.delta > 0 && rating() === r0 + w.delta, `a clear climbs the ladder (+${w.delta})`);
  const l = applyRunRating(1, false, 0);
  ok(l.delta < 0, `an early wipe bleeds rating (${l.delta})`);
  const deep = applyRunRating(8, false, 0);
  ok(deep.delta > 0, 'a deep loss still climbs');
  ok(tier(0).name === 'POKé BALL' && tier(900).name === 'CHAMPION', 'tier bands bracket the ladder');
}

// --- shiny roll + guaranteed catch ----------------------------------------
{
  const b = new Battle(arena, team(), makeStage(5, 'T'), () => 0); // rng=0 → everything shiny/caught
  (b as any).spawnWave(0);
  const e = (b as any).enemies.find((x: any) => !x.boss);
  ok(e.shiny === true, 'rng<SHINY_RATE rolls shiny');
  const box0 = b.box.length;
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(b.box.length === box0 + 1, 'shiny KO always catches');
  ok(b.shiniesCaught === 1, 'shiniesCaught counts');
  // capture-time persistence: the dex + shiny ledger update the moment the
  // ball lands, not at run end — a closed tab can't lose a catch
  ok(dexIds().includes(e.def.id), 'catch writes the dex immediately');
  ok(shinyIds().includes(e.def.id), 'shiny catch writes the shiny ledger');
  ok(unlockedAch().has('shiny'), 'shiny catch unlocks the SHINING trophy');
  ok(!unlockAch('shiny'), 'trophy unlock is idempotent');
}

// --- trophy shelf: list sanity + award dedupe -------------------------------
{
  ok(ACHIEVEMENTS.length >= 10, `${ACHIEVEMENTS.length} trophies defined`);
  ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'trophy ids unique');
  ok(unlockAch('test-noop') === true, 'fresh trophy unlocks');
  ok(unlockAch('test-noop') === false, 'repeat unlock is a no-op');
}

// --- level variance: draft 5-14, wilds scale with depth, catches keep it --
{
  const b = new Battle(arena, [{ ...ROSTER[0], lvl: 20 }, ...team().slice(1)], makeStage(55, 'T'), mulberry32(6));
  const p = (b as any).players[0];
  ok(p.lvl === 20, `draft lvl marker applies (lv${p.lvl})`);
  ok(p.pow > ROLE_MODS[p.role].pow * 1.1, `draft level scales pow (${p.pow.toFixed(2)})`);
  (b as any).spawnWave(0);
  const lv0 = b.enemies.reduce((s, e) => s + e.lvl, 0) / Math.max(1, b.enemies.length);
  for (let i = 1; i <= 6; i++) (b as any).spawnWave(i); // rolled waves materialize sequentially
  const lv6 = b.enemies.reduce((s, e) => s + e.lvl, 0) / Math.max(1, b.enemies.length);
  ok(lv6 > lv0 + 30, `wild levels scale with depth (w0 ${lv0.toFixed(1)} → w6 ${lv6.toFixed(1)})`);
  ok(lv0 >= 5 && lv0 <= LV_CAP, `wild levels inside 1-${LV_CAP}`);
}
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), () => 0); // rng=0 → catches always land
  for (let i = 0; i <= 4; i++) (b as any).spawnWave(i);
  const e = (b as any).enemies[0];
  const el = e.lvl;
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(b.boxLvl[b.boxLvl.length - 1] === el, `caught mon keeps its level (Lv${el})`);
}

// --- map stop effects -------------------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  (b as any).spawnWave(0);
  const p0 = (b as any).players[0];
  const p1 = (b as any).players[1];
  p0.hp = Math.round(p0.maxHp * 0.5);
  p1.dead = true;
  p1.hp = 0;
  const items0 = b.heldItems.length;
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'rest', row: 0, links: [] });
  ok(p0.hp === p0.maxHp, `rest heals to full (${p0.hp}/${p0.maxHp})`);
  ok(!p1.dead && p1.hp === p1.maxHp, 'rest revives a fainted mon');
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'chest', row: 0, links: [] });
  ok(b.heldItems.length === items0 + 1, 'chest stop grants a relic');
  // the mart boards a shop shelf — buys re-prompt until LEAVE
  p1.dead = true;
  p1.hp = 0;
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'mart', row: 0, links: [] });
  ok((b as any).eventChoice?.options.length === 5, 'mart shelf lists revive when a mon is down');
  (b as any).phase = 'map';
  b.score = 600;
  (b as any).pickEventChoice(3); // REVIVE 350
  ok(!p1.dead && p1.hp === Math.round(p1.maxHp / 2) && b.score === 250, 'mart revive trades score for a standing mon');
  ok(!!(b as any).eventChoice, 'mart keeps the board open until LEAVE');
  (b as any).pickEventChoice(0); // POTION 200 — one-of-each stock…
  ok(b.score === 50, 'mart potion trades score for a heal');
  ok(!(b as any).eventChoice.options.some((o: { label: string }) => o.label.startsWith('POTION')), 'a bought shelf item leaves the board');
  const left = (b as any).eventChoice.options.length;
  (b as any).pickEventChoice(0); // RARE CANDY 400 — the wallet can't cover it
  ok((b as any).eventChoice.options.length === left && b.score === 50, 'short score keeps the item on the shelf');
  (b as any).pickEventChoice((b as any).eventChoice.options.length - 1);
  ok(!(b as any).eventChoice, 'LEAVE resolves the mart stop');
}

// --- trainer stops: mono-type squads, no catches --------------------------
{
  const b = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  const node = { tx: 0, ty: 0, kind: 'trainer' as const, row: 1, links: [], ttype: 'fire' as const };
  (b as any).spawnWave(1, node);
  ok(b.enemies.length >= 4, `trainer fields a squad (${b.enemies.length})`);
  ok(b.enemies.every((e) => e.def.type === 'fire'), 'trainer squad is mono-type');
  ok(!b.enemies.some((e) => e.shiny), 'trainer mons are never shiny');
  const boxN = b.box.length;
  (b as any).hurt(b.enemies[0], b.enemies[0].hp + 50, '#fff');
  ok(b.box.length === boxN, 'trainer mons cannot be caught');
  ok((b as any).hardWave, 'trainer wave is a hard stop');
}

// --- recruits: only a fallen gym pays its ace -------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(0); // wild wave — no boss
  const box0 = b.box.length;
  (b as any).enterReward();
  ok(b.box.length === box0 && !b.lastRecruit, 'wild stage grants no recruit');
  (b as any).spawnWave(2); // gym wave — has a boss
  (b as any).enterReward();
  ok(!!b.lastRecruit && b.box.length > box0, `gym pays its ace (${b.lastRecruit?.name})`);
}

// --- room blocks: furnished waves, open boss rooms, clean spawns --------
{
  let furnished = 0,
    bossOpen = true,
    overlap = 0;
  for (const s of [1, 7, 13, 42, 99, 314, 777, 2024, 5150, 9001]) {
    const b = new Battle(arena, team(), makeStage(s), mulberry32(s));
    for (const i of [0, 1, 2]) {
      (b as any).spawnWave(i);
      if ((b as any).enemies.some((e: any) => e.boss) && b.blocks.length) bossOpen = false;
      if (b.blocks.length) furnished++;
      for (const e of b.enemies)
        for (const bl of b.blocks)
          if (e.x > bl.x - e.r && e.x < bl.x + bl.w + e.r && e.y > bl.y - e.r && e.y < bl.y + bl.h + e.r) overlap++;
    }
  }
  ok(furnished > 0, `${furnished}/30 spawned waves furnished with stone blocks`);
  ok(bossOpen, 'gym rooms stay open');
  ok(overlap === 0, `${overlap} enemy spawns inside blocks`);
}

// --- boss enrage ------------------------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave — has a boss
  const boss = (b as any).enemies.find((e: any) => e.boss);
  ok(!!boss, 'gym wave has a boss');
  if (boss) {
    (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.75), '#fff');
    ok(boss.enraged === true, `boss enrages under 30% hp (${Math.round(boss.hp / boss.maxHp * 100)}%)`);
  }
}

// --- every rolled wave across seeds is spawnable ---------------------------
{
  let bad = 0;
  for (let s = 1; s <= 40; s++) {
    const st = makeStage(s);
    for (const w of st.waves) if (!w.length) bad++;
  }
  ok(bad === 0, `40 seeded stages, ${bad} empty waves`);
}

// --- power tiers: weak draft, depth-gated wild pools ------------------------
{
  ok(ROSTER.every((r) => tierOf(r) <= 1), `draft pool is weak mons only (max BST tier ${Math.max(...ROSTER.map(tierOf))})`);
  // seeded openers never field a heavy hitter
  let heavy = 0;
  for (let s = 1; s <= 30; s++) {
    for (const w of makeStage(s).waves[0]) if (tierOf(w.def) >= 2) heavy++;
  }
  ok(heavy === 0, `stage-1 fodder stays tier ≤1 (${heavy} heavy)`);
  // shallow rolled waves can't roll ubers; deep ones can (bosses excluded —
  // gym aces are the marquee exception, not fodder)
  let uber = 0;
  for (let s = 1; s <= 40; s++) {
    for (const w of rollWave(mulberry32(s), 1, 'grove')) if (!w.boss && tierOf(w.def) >= 3) uber++;
  }
  ok(uber === 0, `depth-1 waves field no ubers (${uber})`);
  let deep = 0;
  for (let s = 1; s <= 60; s++) {
    for (const w of rollWave(mulberry32(s), 6, 'grove')) if (!w.boss && tierOf(w.def) >= 3) deep++;
  }
  ok(deep > 0, `deep waves roll 560+ elites (${deep})`);
  // trainers obey the same gate — a stage-2 squad tops out at tier 2
  let tmax = 0;
  for (let s = 1; s <= 30; s++) {
    for (const w of trainerWave(mulberry32(s), 0, 'fire')) tmax = Math.max(tmax, tierOf(w.def));
  }
  ok(tmax <= 2, `depth-0 trainer squads stay ≤ tier 2 (max ${tmax})`);
}

// --- roster integrity: every evo chain resolves, every species has art ----
{
  const ids = new Set(ALL_SPECIES.map((d) => d.id));
  const dangling = ALL_SPECIES.filter(
    (d) => d.evolvesTo != null && (Array.isArray(d.evolvesTo) ? d.evolvesTo : [d.evolvesTo]).some((id) => !ids.has(id)),
  );
  ok(!dangling.length, `every evolvesTo resolves (${dangling.map((d) => `${d.name}->${d.evolvesTo}`).join(',') || 'none'})`);
  const noArt = ALL_SPECIES.filter((d) => !existsSync(`public/sprites/${d.id}.png`));
  ok(!noArt.length, `every species has a vendored sprite (${noArt.map((d) => `${d.name}#${d.id}`).join(',') || 'none'})`);
}

// --- badge case: every leader is themed to a badge, paid once -------------
{
  ok(
    BOSS_POOL.length === 11 && new Set(BOSS_POOL.map((b) => b.type)).size === 11 && BOSS_POOL.every((b) => badgeOf(b.id)),
    `11 leaders, one per type, all badge-themed (${BOSS_POOL.map((b) => b.name).join('/')})`,
  );
  ok(
    BOSS_POOL.every((b) => ACHIEVEMENTS.some((a) => a.id === `gym-${b.id}`)),
    'every leader seeds its own trophy',
  );
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(1));
  (b as any).spawnWave(2); // the gym wave — leader + entourage
  const boss = (b as any).enemies.find((e: any) => e.boss);
  ok(!!boss && !!badgeOf(boss.def.id), `gym boss maps to a badge (${boss?.def.name})`);
  ok(
    b.enemies.filter((e: any) => !e.boss).every((e: any) => e.def.type === boss.def.type),
    'leader entourage is mono-type',
  );
  (b as any).hurt(boss, 999999, '#fff'); // KO the leader — caught or fainted, the badge pays
  if (!boss.dead) (b as any).hurt(boss, 999999, '#fff'); // focus sash holds once — the second hit lands
  ok(gymBadges().has(boss.def.id), `gym KO banks the ${badgeOf(boss.def.id)?.name}`);
  ok(unlockedAch().has(`gym-${boss.def.id}`), `gym KO unlocks the leader trophy`);
  ok(earnBadge(boss.def.id) === null, 'the same leader pays the badge once');
}

// --- full autoplayed climbs: naive aim, real physics, win or wipe ---------
for (const [seed, asc] of [[99, 0], [2024, 0], [777, 0], [5150, 5]] as const) {
  const rng = mulberry32(seed);
  const b = new Battle(arena, team(), makeStage(seed), rng);
  b.asc = asc;
  let frames = 0;
  let aimTries = 0;
  let shopPicks = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
  while (b.phase !== 'won' && b.phase !== 'lost' && frames < 200000) {
    frames++;
    if (b.phase === 'aim' && aimTries++ > 600) break; // stall detector — bouncier physics makes a dumb bot's fights run longer
    if ((b as any).eventChoice) { // a ? is asking — buy once, then LEAVE (last option) if the board re-asks
      const opts = (b as any).eventChoice.options;
      (b as any).pickEventChoice(shopPicks++ % 2 ? opts.length - 1 : 0);
      step(5);
      continue;
    }
    if ((b as any).eventBox) { // an event popup holds the map — dismiss it first
      b.pointerDown({ x: 270, y: 850 });
      step(5);
      continue;
    }
    if (b.phase === 'map') {
      // pick a linked stop — same cell math drawRegion/pointerDown use
      const region = (b as any).region;
      const cur = region.nodes[(b as any).mapNode];
      const n = region.nodes[cur.links[Math.floor(rng() * cur.links.length)]];
      // the map viewport scrolls — screen y is island row minus camera
      b.pointerDown({ x: MAP_OX + n.tx * MAP_CELL + MAP_CELL / 2, y: MAP_OY + (n.ty - (b as any).mapCam) * MAP_CELL + MAP_CELL / 2 });
      step(240); // the lead mon walks the route over ~6 tiles/sec
    } else if (b.phase === 'reward') {
      if (b.evoChoice) b.pickEvo(Math.floor(rng() * b.evoChoice.options.length)); // a split evo asks first
      else b.pickPerk(Math.floor(rng() * Math.max(1, b.rewardOffers.length)) || 0);
      if (b.phase === 'reward' && !b.evoChoice) b.pickPerk(0); // safety: force advance
    } else if (b.phase === 'aim') {
      const u = (b as any).active;
      if (!u || u.dead) { step(30); continue; }
      const foes = (b as any).enemies.filter((e: any) => !e.dead);
      if (!foes.length) { step(60); continue; }
      // nearest live foe — but if one is sitting on us, aim at arena top instead.
      // when straight shots keep whiffing into stone, the bot flails: cycles
      // targets and banks the pull angle so a dead lane can't stall the climb
      let foe = foes[0], bestD = Infinity;
      for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < bestD) { bestD = d; foe = f; } }
      const t = bestD > 60 ? foe : { x: arena.x + arena.w / 2, y: arena.y + 60 };
      let dx = t.x - u.x, dy = t.y - u.y;
      if (aimTries > 120) {
        const alt = foes[aimTries % foes.length];
        const wob = ((aimTries * 37) % 9 - 4) * 0.28; // swing the aim ±64° in steps
        const cs = Math.cos(wob), sn = Math.sin(wob);
        [dx, dy] = [ (alt.x - u.x) * cs - (alt.y - u.y) * sn, (alt.x - u.x) * sn + (alt.y - u.y) * cs ];
      }
      const d = Math.hypot(dx, dy) || 1;
      b.pointerDown({ x: u.x, y: u.y });
      b.pointerMove({ x: u.x - (dx / d) * 200, y: u.y - (dy / d) * 200 });
      b.pointerUp();
      step(1);
    } else {
      step(30);
    }
  }
  ok(b.phase === 'won' || b.phase === 'lost', `seed ${seed}${asc ? ` asc${asc}` : ''}: ${b.phase} (depth ${(b as any).depth}, score ${b.score}, kos ${(b as any).totalKos})`);
  ok(b.score > 0, 'score accumulates');
}

// --- region map integrity ---------------------------------------------------
{
  for (const s of [1, 42, 99, 777, 2024, 5150, 31337]) {
    const r = genRegion(s);
    const rowOf = (i: number) => r.nodes[i].row;
    const fwd = r.nodes.every((n) => n.links.every((li) => rowOf(li) === n.row + 1));
    ok(fwd, `seed ${s}: all links go one row forward`);
    const reachable = new Set([0]);
    for (let i = 0; i < r.nodes.length; i++) if (reachable.has(i)) r.nodes[i].links.forEach((li) => reachable.add(li));
    ok(reachable.size === r.nodes.length, `seed ${s}: every stop reachable (${reachable.size}/${r.nodes.length})`);
    const gyms = [2, 5, 8].map((row) => r.nodes.filter((n) => n.row === row));
    ok(gyms.every((g) => g.length === 1 && g[0].kind === 'gym'), `seed ${s}: forced single gyms on rows 2/5/8`);
    // triplet shape: HOME at row -1, then every non-gym row is a left/right fork
    ok(r.nodes[0].kind === 'start' && r.nodes[0].row === -1, `seed ${s}: HOME anchors the climb`);
    ok(
      r.nodes.filter((n) => n.row === 0).every((n) => r.nodes[0].links.includes(r.nodes.indexOf(n))),
      `seed ${s}: HOME links to stage 1's whole fork`,
    );
    const forks = [0, 1, 3, 4, 6, 7].every((row) => {
      const n = r.nodes.filter((x) => x.row === row).length;
      return n >= 2 && n <= 3;
    });
    ok(forks, `seed ${s}: every choice row is a 2-3 lane fork`);
    ok(r.nodes.every((n) => n.kind !== 'trainer' || !!n.ttype), `seed ${s}: trainer stops carry a type`);
    ok(r.nodes.length >= 9 && r.nodes.length <= 24, `seed ${s}: ${r.nodes.length} stops`);
    // every linked pair must have a walkable carved route between them
    let walkable = true;
    for (const n of r.nodes)
      for (const li of n.links) {
        const p = routePath(r, n, r.nodes[li]);
        const t = r.nodes[li];
        if (p.length < 2 || p[p.length - 1].x !== t.tx || p[p.length - 1].y !== t.ty) walkable = false;
      }
    ok(walkable, `seed ${s}: every link has a walkable route`);
  }
}

// --- map guarantees: a rest each half + real ? variety (pokelike's rule) ---
{
  for (const s of [1, 7, 13, 42, 99, 777, 2024, 5150, 31337, 555]) {
    const r = genRegion(s);
    const rests1 = r.nodes.filter((n) => n.kind === 'rest' && n.row >= 1 && n.row <= 4).length;
    const rests2 = r.nodes.filter((n) => n.kind === 'rest' && n.row >= 5 && n.row <= 7).length;
    ok(rests1 >= 1 && rests2 >= 1, `seed ${s}: a rest is offered in each half (${rests1}+${rests2})`);
    const ev1 = r.nodes.some((n) => n.kind === 'event' && n.row >= 1 && n.row <= 4);
    const ev2 = r.nodes.some((n) => n.kind === 'event' && n.row >= 5 && n.row <= 7);
    ok(ev1 && ev2, `seed ${s}: a ? stop is offered in each half`);
    const m1 = r.nodes.some((n) => n.kind === 'mart' && n.row >= 1 && n.row <= 4);
    const m2 = r.nodes.some((n) => n.kind === 'mart' && n.row >= 5 && n.row <= 7);
    ok(m1 && m2, `seed ${s}: a mart is offered in each half`);
  }
}

// --- type traits: tiers, shiny double-count, dead mons excluded -------------
{
  const mk = (type: 'fire' | 'water' | 'ghost' | 'normal', shiny = false, dead = false) => ({ dead, shiny, def: { type } });
  ok(teamTraits([mk('fire'), mk('fire'), mk('water')]).get('fire') === 1, 'two same-type = tier 1');
  ok(teamTraits([mk('ghost', true), mk('ghost'), mk('ghost')]).get('ghost') === 2, 'shiny counts double (2+1+1=4 → tier 2)');
  ok(teamTraits([mk('normal', true), mk('normal', true), mk('normal'), mk('water')]).get('normal') === 3, 'two shinies + one = tier 3');
  ok(teamTraits([mk('fire'), mk('fire'), mk('fire', false, true)]).get('fire') === 1, 'fainted mons do not feed traits');
  ok(!teamTraits([mk('water'), mk('fire'), mk('ghost'), mk('normal')]).size, 'spread team earns no traits');
  ok(Object.values(TRAIT_DESC).every((d) => d.length === 3), 'every type documents 3 trait tiers');
}

// --- trait hooks land in battle ---------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(4));
  (b as any).spawnWave(0);
  b.traits.clear();
  const e = b.enemies[0];
  const hp0 = e.hp;
  (b as any).hurt(e, 50, '#fff');
  const d1 = hp0 - e.hp;
  e.hp = hp0;
  b.traits.set('fire', 3);
  (b as any).hurt(e, 50, '#fff');
  const d2 = hp0 - e.hp;
  ok(d2 > d1, `fire trait boosts damage (${d1} → ${d2})`);
  // anti-stall: the same hit hurts more once a wave has outlasted 10 shots
  const p = b.players[0];
  b.traits.clear();
  const php0 = p.hp;
  (b as any).waveShots = 0;
  (b as any).damagePlayer(p, 50);
  const h1 = php0 - p.hp;
  p.hp = php0;
  (b as any).waveShots = 20;
  (b as any).damagePlayer(p, 50);
  const h2 = php0 - p.hp;
  ok(h2 > h1, `anti-stall pressure ramp after 10 shots (${h1} → ${h2})`);
}

// --- ? event pool: variety, ambushes stage scripted waves -------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  (b as any).spawnWave(0);
  const seen = new Set<string>();
  let waves = 0;
  for (let i = 0; i < 60; i++) {
    const out = rollEvent(b);
    seen.add(out.note.slice(0, 12));
    if (out.wave) waves++;
  }
  ok(seen.size >= 4, `event pool rolls variety (${seen.size} distinct outcomes)`);
  ok(waves > 0, `ambushes stage scripted waves (${waves}/60)`);
}

// --- event arrival: scripted wave replaces the row, no gym credit -----------
{
  const b = new Battle(arena, team(), makeStage(41, 'T'), mulberry32(5));
  (b as any).pendingEventWave = [{ def: speciesById(262)!, nx: 0.5, ny: 0.3, boss: true }];
  (b as any).spawnWave(1);
  ok((b as any).inEvent, 'event wave flagged');
  ok(b.enemies.some((e) => e.boss), 'scripted boss fields');
  ok(!(b as any).waveHadGym, 'event boss is not a gym badge');
  ok(!!b.enemies.find((e) => e.boss)?.relic, 'event alpha carries a held item');
}

// --- boss escalation: phase summons + teleport rotation ----------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave — has a boss
  const boss = b.enemies.find((e) => e.boss)!;
  const n0 = b.enemies.length;
  (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.4), '#fff'); // 100% → 60%: crosses the 2/3 gate
  ok(b.enemies.length > n0, `boss calls for help under 2/3 hp (+${b.enemies.length - n0} adds)`);
  ok(boss.sumStage === 1, 'first summon threshold consumed');
  for (const m of b.enemies.filter((e) => e.minion)) m.dead = true; // drop the guard, then hit hard — the counterplay
  (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.3), '#fff'); // 60% → ~30%: crosses the 1/3 gate
  ok(boss.sumStage === 2, 'second summon threshold consumed');
  const n2 = b.enemies.length;
  (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.05), '#fff'); // no third gate
  ok(b.enemies.length === n2, 'summons stop after two phases');
  // attack rotation: signature, signature, hop — position changes on the 3rd
  const { x: hx, y: hy } = { x: boss.x, y: boss.y };
  (b as any).bossAttack(boss);
  (b as any).bossAttack(boss);
  ok(boss.x === hx && boss.y === hy, 'first two attacks stay put');
  (b as any).bossAttack(boss);
  ok(boss.x !== hx || boss.y !== hy, 'every 3rd attack teleports the boss');
}

// --- MS mechanics: weak point, minion guard, strike shot, mines, volatile ---
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2);
  const boss = b.enemies.find((e) => e.boss)!;
  // drop the entourage — a taunt minion (Shuckle & co.) would toll-booth
  // the boss's contact hits and the weak-point check would read 0
  for (const e of b.enemies) if (!e.boss) e.dead = true;

  // weak point: contact on the marked face pays triple
  const u = b.players[0];
  boss.weakA = -Math.PI / 2; // face up
  u.x = boss.x;
  u.y = boss.y - boss.r - u.r - 4;
  const bhp0 = boss.hp;
  (b as any).strikeEnemy(u, boss);
  const weakD = bhp0 - boss.hp;
  (b as any).time += 1; // clear the hit cooldown
  boss.weakA = Math.PI / 2; // face away
  boss.hp = bhp0;
  (b as any).strikeEnemy(u, boss);
  const flatD = bhp0 - boss.hp;
  ok(weakD > flatD * 2, `weak point pays ~3x (${flatD} → ${weakD})`);

  // minion guard: summoned adds halve boss damage until they die
  const b2 = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b2 as any).spawnWave(2);
  const boss2 = b2.enemies.find((e) => e.boss)!;
  (b2 as any).summonAdds(boss2);
  const mhp0 = boss2.hp;
  (b2 as any).hurt(boss2, 100, '#fff');
  const dGuarded = mhp0 - boss2.hp;
  for (const m of b2.enemies.filter((e) => e.minion)) m.dead = true;
  boss2.hp = mhp0;
  (b2 as any).hurt(boss2, 100, '#fff');
  const dOpen = mhp0 - boss2.hp;
  ok(dGuarded === Math.max(1, Math.round(dOpen * 0.5)), `minion guard halves boss damage (${dGuarded} vs ${dOpen})`);

  // strike shot: launching with a ready super spends its cooldown
  const b3 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const u3 = (b3 as any).active;
  u3.cd = 0;
  b3.phase = 'aim';
  b3.pointerDown({ x: u3.x, y: u3.y });
  b3.pointerMove({ x: u3.x - 120, y: u3.y });
  b3.pointerUp();
  ok(u3.cd > 0, `strike shot spends the super on launch (cd ${u3.cd})`);

  // long-range supers: fire lobs homing fireballs at the far pack, and
  // electric's chain leaves visible arcs
  {
    const bf = new Battle(arena, [ROSTER[1], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (bf as any).spawnWave(0);
    const fp = bf.players[0];
    fp.cd = 0;
    (bf as any).bumpAlly(fp, fp);
    ok((bf as any).orbs.length === 3, `fire volley launches 3 homing orbs (${(bf as any).orbs.length})`);
    // cast motes: every super scatters element-flavored fx — embers for
    // fire rise against gravity
    ok((bf as any).fx.some((f: any) => f.grav < 0), 'fire cast scatters rising embers');

    const be = new Battle(arena, [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (be as any).spawnWave(0);
    const ep = be.players[0];
    ep.cd = 0;
    (be as any).bumpAlly(ep, ep);
    // the arcs are scheduled a beat apart — drain the delay queue
    for (const d of [...(be as any).delays]) d.fn();
    ok((be as any).beams.length > 0, `chain lightning draws its arcs (${(be as any).beams.length})`);

    // signature nukes: Dragonite's HYPER BEAM is a piercing line, not the
    // generic flying pull — foes on the ray take damage, off it don't
    const bd = new Battle(arena, [ROSTER[1], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (bd as any).spawnWave(0);
    const dp = bd.players[0];
    dp.def = { ...dp.def, id: 149, name: 'Dragonite' };
    dp.cd = 0;
    // line three foes up on the beam path: caster at left, targets east
    dp.x = 60; dp.y = 400;
    bd.enemies.forEach((e, i) => { e.x = 200 + i * 60; e.y = 400; e.vx = e.vy = 0; });
    const hps = bd.enemies.map((e) => e.hp);
    (bd as any).bumpAlly(dp, dp);
    ok((bd as any).beams.length > 0 && (bd as any).beams[0].w! > 2, 'hyper beam fires the fat line');
    ok(bd.enemies.every((e, i) => e.hp < hps[i]), 'hyper beam pierces every foe on the line');
    // a foe parked behind the caster stays untouched
    (bd as any).spawnWave(0);
    const behind = bd.enemies[0];
    behind.x = dp.x - 80; behind.y = dp.y;
    bd.enemies.forEach((e, i) => { if (i > 0) { e.x = 500; e.y = 800; } });
    dp.cd = 0;
    const bhp = behind.hp;
    (bd as any).bumpAlly(dp, dp);
    ok(behind.hp === bhp, 'hyper beam spares foes behind the caster');
  }

  // mines: ball contact detonates — the blast SHOVES foes but never
  // damages them (enemies take no environment damage)
  const b4 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b4 as any).spawnWave(0);
  const e4 = b4.enemies[0];
  // the ball detonates the pad without touching the foe — any hp loss
  // would be the blast itself, not a contact hit
  const mx = e4.x + e4.r + 45;
  (b4 as any).hazards = [{ kind: 'mine', x: mx, y: e4.y, r: 30 }];
  const e4hp = e4.hp;
  const u4 = (b4 as any).active;
  // ball (r 26) parked just off the foe — touching it would deal contact
  // damage and muddle what the blast does
  u4.x = mx + 14;
  u4.y = e4.y;
  u4.vx = 0;
  u4.vy = 0;
  (b4 as any).stepShot(1 / 60);
  ok(b4.hazards[0].spent === true, 'mine detonates on ball contact');
  ok(e4.hp === e4hp, `mine blast can't hurt foes (${e4.hp})`);
  ok(Math.hypot(e4.vx, e4.vy) > 50, `mine blast shoves foes (v ${Math.round(Math.hypot(e4.vx, e4.vy))})`);

  // volatile: a KO splashes neighbors and can chain
  const b5 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b5 as any).spawnWave(0);
  const v1 = b5.enemies[0];
  const v2 = b5.enemies[1];
  v1.volatile = true;
  v2.x = v1.x + 30;
  v2.y = v1.y;
  const v2hp = v2.hp;
  (b5 as any).hurt(v1, v1.hp + 50, '#fff');
  ok(v2.hp < v2hp, `volatile KO splashes neighbors (${v2hp} → ${v2.hp})`);

  // wave mutators: enough seeds roll affixes on non-boss waves
  let mods = 0;
  for (let s = 1; s <= 40; s++) {
    const bm = new Battle(arena, team(), makeStage(s), mulberry32(s * 7));
    (bm as any).spawnWave(1);
    if (/SWARM|HASTY|VOLATILE|BIG ONE|SHINY|CLERIC|GUARDIAN|STAY DOWN/.test((bm as any).waveSpecial ?? '')) mods++;
  }
  ok(mods > 3, `${mods}/40 seeds rolled a wave mutator`);

  // warp: riding one pad spits the ball out its twin, velocity kept
  const b6 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b6 as any).spawnWave(0);
  (b6 as any).hazards = [
    { kind: 'warp', x: 200, y: 300, r: 30, pair: 1 },
    { kind: 'warp', x: 400, y: 200, r: 30, pair: 1 },
  ];
  const u6 = (b6 as any).active;
  u6.x = 200;
  u6.y = 300;
  u6.vx = 300;
  u6.vy = 0;
  (b6 as any).stepShot(1 / 60);
  ok(Math.abs(u6.x - 400) < 80 && Math.abs(u6.y - 200) < 80, `warp ports the ball to its twin (${Math.round(u6.x)},${Math.round(u6.y)})`);
  ok(Math.hypot(u6.vx, u6.vy) > 100, 'warp keeps the ball moving');

  // boost: crossing a pad speeds the ball up
  const b7 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b7 as any).spawnWave(0);
  (b7 as any).hazards = [{ kind: 'boost', x: 250, y: 300, r: 30 }];
  const u7 = (b7 as any).active;
  u7.x = 250;
  u7.y = 300;
  u7.vx = 500;
  u7.vy = 0;
  (b7 as any).stepShot(1 / 60);
  ok(u7.vx > 550, `boost pad re-launches the ball (${Math.round(u7.vx)})`);

  // well: a swimmer's ball gains velocity toward the core while inside —
  // landlocked balls bank off the surface instead
  const b8 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b8 as any).spawnWave(0);
  (b8 as any).hazards = [{ kind: 'well', x: 400, y: 300, r: 80 }];
  const u8 = (b8 as any).active;
  u8.def = speciesById(7); // Squirtle swims into the pull
  u8.x = 320;
  u8.y = 300;
  u8.vx = 0;
  u8.vy = 0;
  for (let i = 0; i < 10; i++) (b8 as any).stepShot(1 / 60);
  ok(u8.vx > 5, `gravity well drags the ball inward (vx ${Math.round(u8.vx)})`);

  // ponds & pools are walls to landlocked mons — swimmers, flyers and
  // hoverers cross, everything else banks off the surface
  const bw = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (bw as any).spawnWave(0);
  (bw as any).hazards = [{ kind: 'static', x: 300, y: 300, r: 60 }];
  const uw = (bw as any).active;
  uw.def = speciesById(4); // Charmander can't swim
  uw.x = 300 - 60 - uw.r + 6; // nose already over the surface
  uw.y = 300;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx < 0 && Math.hypot(uw.x - 300, uw.y - 300) >= uw.r + 60 - 0.5, `pond banks a land ball (vx ${Math.round(uw.vx)})`);
  uw.def = speciesById(7); // Squirtle swims
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `water type swims across (x ${Math.round(uw.x)})`);
  uw.def = speciesById(92); // Gastly hovers — no water/flying type needed
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `floating mon hovers across (x ${Math.round(uw.x)})`);
  // landlocked foes can't stand in the pond either
  const ew = bw.enemies.find((e) => !e.dead);
  ew.def = speciesById(4);
  ew.x = 310;
  ew.y = 300;
  (bw as any).stepEnemyMovement(1 / 60);
  ok(Math.hypot(ew.x - 300, ew.y - 300) >= ew.r + 60 - 0.5, `landlocked foe is ejected to the shore (d ${Math.round(Math.hypot(ew.x - 300, ew.y - 300))})`);

  // spikes are boulder walls: land bodies bank off, flyers clear the
  // strip, and pressing into the rim still chips like a damage wall
  (bw as any).hazards = [{ kind: 'spikes', x: 300, y: 300, r: 60 }];
  uw.def = speciesById(4); // Charmander can't climb boulders
  uw.x = 300 - 60 - uw.r + 6;
  uw.y = 300;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx < 0 && Math.hypot(uw.x - 300, uw.y - 300) >= uw.r + 60 - 0.5, `spike boulders bank a land ball (vx ${Math.round(uw.vx)})`);
  uw.def = speciesById(16); // Pidgey flies over the strip
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `flying mon clears the boulders (x ${Math.round(uw.x)})`);
  uw.def = speciesById(4);
  uw.x = 300 - 60 - uw.r + 6; // nose already over the rim
  uw.vx = 60;
  uw.vy = 0;
  uw.hzT = -1;
  const hpw = uw.hp;
  (bw as any).stepShot(1 / 60);
  ok(uw.hp < hpw, `grinding into the boulders still chips (hp ${hpw} → ${uw.hp})`);
  ew.def = speciesById(4);
  ew.x = 300;
  ew.y = 300;
  (bw as any).stepEnemyMovement(1 / 60);
  ok(Math.hypot(ew.x - 300, ew.y - 300) >= ew.r + 60 - 0.5, `landlocked foe banks off the boulders (d ${Math.round(Math.hypot(ew.x - 300, ew.y - 300))})`);

  // aegis: the guardian wards an ally, and the ward eats one whole hit
  const b9 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b9 as any).spawnWave(0);
  const g9 = b9.enemies[0];
  const w9 = b9.enemies[1];
  g9.supp = 'aegis';
  w9.hp = Math.floor(w9.maxHp * 0.4); // weakest → the ward target
  (b9 as any).pendingAttacks = [g9];
  (b9 as any).resolveEnemyTurn();
  for (const d of [...(b9 as any).delays]) d.fn(); // the volley fires on beats
  ok(w9.shieldN === 1, 'aegis wards the weakest ally');
  const w9hp = w9.hp;
  (b9 as any).hurt(w9, 100, '#fff');
  ok(w9.hp === w9hp && w9.shieldN === 0, `ward eats a whole hit (hp ${w9hp} → ${w9.hp})`);

  // cleric: the medic patches its most-wounded ally instead of attacking
  const b10 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b10 as any).spawnWave(0);
  const m10 = b10.enemies[0];
  const h10 = b10.enemies[1];
  m10.supp = 'medic';
  h10.hp = Math.floor(h10.maxHp * 0.5);
  const h10hp = h10.hp;
  (b10 as any).pendingAttacks = [m10];
  (b10 as any).resolveEnemyTurn();
  for (const d of [...(b10 as any).delays]) d.fn(); // the volley fires on beats
  ok(h10.hp > h10hp, `medic heals the pack (${h10hp} → ${h10.hp})`);

  // zombie loop: fell one while its partner stands → it rises at 40%;
  // both down in the same shot → the pair stays down for good
  const b11 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b11 as any).spawnWave(0);
  const z1 = b11.enemies[0];
  const z2 = b11.enemies[1];
  z1.link = z2;
  z2.link = z1;
  z1.revives = z2.revives = 2;
  (b11 as any).hurt(z1, z1.hp + 1, '#fff');
  (b11 as any).endShot();
  ok(!z1.dead && z1.revives === 1 && z1.hp > 0, `zombie rises at partial hp (${z1.hp})`);
  (b11 as any).hurt(z1, z1.hp + 1, '#fff');
  (b11 as any).hurt(z2, z2.hp + 1, '#fff');
  (b11 as any).endShot();
  ok(z1.dead && z2.dead, 'double-kill breaks the zombie loop');

  // skull mark: the KO pays a bounty — score pop + team heal
  const b12 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b12 as any).spawnWave(0);
  const sk = b12.enemies[0];
  sk.skull = true;
  const s0 = b12.score;
  b12.players[0].hp = 10;
  (b12 as any).hurt(sk, sk.hp + 1, '#fff');
  ok(b12.score - s0 >= 150, `skull bounty pays +150 on top of the KO (${b12.score - s0})`);
  ok(b12.players[0].hp > 10, `skull bounty heals the team (${b12.players[0].hp})`);

  // gravity aura: a ball inside the carrier's bubble bleeds speed
  const b13 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b13 as any).spawnWave(0);
  const g13 = b13.enemies[0];
  const u13 = (b13 as any).active;
  u13.x = g13.x + 130; // inside the aura, clear of the sprite
  u13.y = g13.y;
  g13.gravR = 160;
  u13.vx = 600;
  u13.vy = 0;
  for (let i = 0; i < 12; i++) (b13 as any).stepShot(1 / 60);
  ok(u13.vx < 500, `gravity aura drags the ball (vx ${Math.round(u13.vx)})`);

  // victory loot: the fountain mixes coins with rare drops, and scooping
  // pays score into the running tally
  const b14 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b14 as any).spawnWave(0);
  (b14 as any).enterLoot();
  const kinds = new Set((b14 as any).lootCoins.map((c: any) => c.kind));
  ok(kinds.has('coin') && kinds.has('gem') && kinds.has('heart') && kinds.has('candy'),
    `loot fountain mixes all kinds (${[...kinds].join(',')})`);
  ok((b14 as any).lootCoins.length >= 24, `fountain size scales (${(b14 as any).lootCoins.length} pieces)`);
  // park a mon mid-fountain and let the sim scoop whatever drifts through —
  // coins land at one origin first, so several can vacuum in a single tick
  const mon = b14.players[0];
  mon.x = arena.x + arena.w / 2;
  mon.y = arena.y + arena.h / 2;
  const s14 = b14.score;
  for (let i = 0; i < 30; i++) (b14 as any).stepLoot(1 / 60);
  ok(b14.score > s14 && (b14 as any).lootGot > 0, `scooping pays into the tally (score +${b14.score - s14})`);
  ok((b14 as any).lootCoins.length < 30, `coins get collected (left: ${(b14 as any).lootCoins.length})`);
}

// --- gym boss relic + egg hatch ---------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave
  const boss = b.enemies.find((e) => e.boss);
  ok(!!boss?.relic, `gym boss carries a held item (${boss?.relic})`);
  const c = new Battle(arena, team(), makeStage(50, 'T'), mulberry32(8));
  c.eggIn = 1;
  const box0 = c.box.length;
  (c as any).tickEgg();
  ok(c.eggIn === 0 && c.box.length === box0 + 1, `egg hatches into the box (${c.box[c.box.length - 1]?.name})`);
}

// --- choice events: the row waits for a pick, options do what they say -------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  // salesman: paying lands a relic, walking away clears the row
  const s0 = 500;
  b.score = s0;
  const items0 = b.heldItems.length;
  const sale = rollEventChoices(b, 'PAY 300 SCORE');
  ok(sale !== null, 'salesman choice surfaced');
  if (sale) {
    sale.run(b);
    ok(b.score === s0 - 300, `paying the salesman costs score (${s0} → ${b.score})`);
    ok(b.heldItems.length === items0 + 1, 'the mystery box pays a relic');
  }
  // shrine: the offer trades hp for levels
  const shrine = rollEventChoices(b, 'OFFER 15% HP — +2 LEVELS');
  ok(shrine !== null, 'shrine choice surfaced');
  if (shrine) {
    const p = b.players[0];
    const hp0 = p.hp;
    const lv0 = p.lvl;
    shrine.run(b);
    ok(p.hp < hp0 && p.lvl === lv0 + 2, `shrine trades hp for levels (lv${lv0} → ${p.lvl})`);
  }
}
function rollEventChoices(b: InstanceType<typeof Battle>, label: string) {
  for (let i = 0; i < 200; i++) {
    const out = rollEvent(b);
    const opt = out.choices?.options.find((o) => o.label === label);
    if (opt) return opt;
  }
  return null;
}

// --- a corpse attacker never fires ------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b as any).spawnWave(0);
  const dead = b.enemies[0];
  dead.dead = true;
  const p = b.players[0];
  const hp0 = p.hp;
  (b as any).pendingAttacks = [dead];
  (b as any).resolveEnemyTurn();
  for (const d of [...(b as any).delays]) d.fn();
  ok(p.hp === hp0, 'a mon killed in the windup never attacks');
}

// --- orbs die with their wave, perks retune the fielded team ----------------
{
  const bf = new Battle(arena, [ROSTER[1], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
  (bf as any).spawnWave(0);
  const fp = bf.players[0];
  fp.cd = 0;
  (bf as any).bumpAlly(fp, fp);
  ok((bf as any).orbs.length === 3, 'fire volley fields orbs');
  (bf as any).spawnWave(1);
  ok((bf as any).orbs.length === 0, 'orbs clear on the next wave');

  const bp = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const p = bp.players[0];
  const cd0 = p.cdMax;
  PERKS.find((x) => x.id === 'claw')!.apply(bp);
  ok(p.cdMax < cd0, `quick claw retunes fielded cooldowns (${cd0} → ${p.cdMax})`);
  const cd1 = p.cdMax;
  PERKS.find((x) => x.id === 'pherb')!.apply(bp);
  ok(p.cdMax === Math.max(1, cd1 - 1), `power herb shaves a shot (${cd1} → ${p.cdMax})`);
}

// --- a cancelled gesture never launches -------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const u = (b as any).active;
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerMove({ x: u.x - 150, y: u.y - 150 });
  b.pointerCancel();
  ok(b.phase === 'aim' && u.vx === 0 && u.vy === 0, 'pointercancel drops the drag, no shot');
}

// --- a tap on a foe pops its scout card, not a shot ---------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const u = (b as any).active;
  const e = b.enemies[0];
  b.pointerDown({ x: e.x, y: e.y });
  b.pointerUp();
  ok((b as any).inspect?.uid === e.uid, 'tap on a foe opens the scout card');
  ok(b.phase === 'aim' && u.vx === 0, 'a scout tap never fires a shot');
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerUp();
  ok((b as any).inspect?.uid === u.uid, 'tap on your own mon scouts it too');
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerMove({ x: u.x - 150, y: u.y });
  b.pointerUp();
  ok(b.phase === 'shot' && !(b as any).inspect, 'a real pull dismisses the card');
}

// --- seeded runs replay identically ------------------------------------------
{
  const a = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42));
  const b = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42));
  (a as any).spawnWave(0);
  (b as any).spawnWave(0);
  const seq = (bb: Battle) => bb.enemies.map((e) => `${e.def.id}:${e.hp}`).join(',');
  ok(seq(a) === seq(b), 'same seed → same wave (replayable climbs)');
}

// --- the pause chip freezes the sim, a tap thaws it ---------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const chip = (b as any).pauseChip();
  b.pointerDown({ x: chip.x + 15, y: chip.y + 15 });
  ok(b.paused === true, 'pause chip freezes the fight');
  const ehp = b.enemies.map((e) => e.hp).join(',');
  for (let i = 0; i < 120; i++) b.update(1 / 60);
  ok(b.enemies.map((e) => e.hp).join(',') === ehp && b.phase === 'aim', 'nothing moves while paused');
  b.pointerDown({ x: 270, y: 480 });
  ok(b.paused === false, 'any tap resumes');
}

// --- corrupt saves can't NaN or crash the run --------------------------------
{
  localStorage.setItem('pk_best', '{}');
  localStorage.setItem('pk_dex', '{"oops":true}');
  const b = best();
  ok(Number.isFinite(b.wins) && Number.isFinite(b.score), 'malformed pk_best falls back to defaults');
  ok(Array.isArray(dexIds()), 'malformed pk_dex reads as an empty dex');
  localStorage.removeItem('pk_best');
  localStorage.removeItem('pk_dex');
}

// --- first-run coaching flag -------------------------------------------------
{
  markCoached();
  ok(coachDone(), 'coaching flag persists once the first wave clears');
}

// --- roster integrity -------------------------------------------------------
ok(ROSTER.length >= 29, `roster expanded (${ROSTER.length})`);
ok(ROSTER.every((r) => speciesById(r.id)), 'every roster id resolves');
const evo = ROSTER.filter((r) => r.evolvesTo).every((r) =>
  (Array.isArray(r.evolvesTo) ? r.evolvesTo : [r.evolvesTo!]).every((id) => speciesById(id)),
);
ok(evo, 'every evolvesTo resolves');
ok(moveOf(25, 'electric') === 'THUNDERBOLT', 'pikachu override');
ok(moveOf(129, 'water') === 'SPLASH', 'magikarp signature');
ok(moveOf(9999, 'fire') === MOVE_NAME.fire, 'unknown id falls back to type move');

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
