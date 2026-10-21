// Headless playthrough — no DOM. Bundle: rolldown test/smoke.ts -f esm -p node
import './shims';
import { Battle, MAP_CELL, MAP_OX, MAP_OY, ULT_SHOTS } from '../src/game/battle';
import { makeStage, ROSTER, TOTAL_STAGES, speciesById, rollWave, trainerWave, tierOf, BOSS_POOL, ALL_SPECIES } from '../src/game/data';
import { existsSync } from 'fs';
import { mulberry32 } from '../src/core/rng';
import { TRACKS } from '../src/core/audio';
import { roleOf, ROLE_MODS, moveOf, MOVE_NAME, LV_CAP, offStat, lvlPow } from '../src/game/stats';
import { genRegion, routePath } from '../src/game/map';
import { teamTraits, TRAIT_DESC } from '../src/game/traits';
import { typeMult, strikeType, weatherMult } from '../src/game/types';
import { rollEvent, martStock } from '../src/game/events';
import { dexIds, shinyIds, unlockedAch, unlockAch, ACHIEVEMENTS, coachDone, markCoached, best, badgeOf, gymBadges, earnBadge, BADGES, applyRunRating, rating, tier, board, recordBoard, BOARD_MAX, migrateSaves, statOffer, statRunEnd, statsDump, settings, setSetting, bagStock, bankBag, spendBag, taskState, saveTaskState, streakDaily, streakWins, bumpStreaks, runSave } from '../src/game/meta';
import { PERKS, rollPerks, BAG_ITEMS, perkTick } from '../src/game/perks';
import { DAILY_POOL, WEEKLY_POOL, rollTasks, dayKey, weekKey, daySeed, weekSeed, taskTick, taskViews, claimTask, tasksReady, taskResetsIn } from '../src/game/tasks';
import { dailyMod, DAILY_MODS } from '../src/game/daily';

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

// --- bag items: pk_bag stock, constructor applies the run-start picks ------
// NB: must run before any block that KOs a gym boss — a badge earn banks a
// bag item into pk_bag, so the stock is only pristine here.
{
  const seed = bagStock(); // pk_bag never written → the starter kit
  ok(seed['exp-share'] === 1 && seed['friend-ball'] === 1, `first read seeds the starter kit (${JSON.stringify(seed)})`);
  ok(localStorage.getItem('pk_bag') === null, 'readers stay read-only — the seed stays virtual');
  bankBag('scope-lens');
  let s = bagStock();
  ok(s['scope-lens'] === 1 && s['exp-share'] === 1 && s['friend-ball'] === 1, 'bankBag +1s onto the virtual seed');
  bankBag('scope-lens');
  ok(bagStock()['scope-lens'] === 2, 'bankBag stacks');
  spendBag(['exp-share', 'friend-ball', 'friend-ball']); // the dupe clamps
  s = bagStock();
  ok(!s['exp-share'] && !s['friend-ball'] && s['scope-lens'] === 2, `spendBag decrements and clamps at 0 (${JSON.stringify(s)})`);
  ok(JSON.parse(localStorage.getItem('pk_bag')!)['friend-ball'] === 0, 'spendBag persists the clamp in one write');

  // every catalog entry: unique ids, real sprites, terse one-line descs
  ok(BAG_ITEMS.length === 10 && new Set(BAG_ITEMS.map((i) => i.id)).size === 10, 'ten bag items, unique ids');
  ok(BAG_ITEMS.every((i) => existsSync(`public/sprites/items/${i.item}.png`)), 'every bag item has a vendored sprite');

  // the constructor applies each pick's apply() with the team fielded
  const mb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['master-ball', 'friend-ball']);
  ok(mb.masterArmed === true, 'master ball arms the guaranteed first catch');
  ok(Math.abs(mb.captureChance - 0.14) < 1e-9, `friend ball adds catch chance (${mb.captureChance.toFixed(2)})`);
  const sc = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['scope-lens', 'bogus-id']);
  ok(Math.abs(sc.critCh - 0.15) < 1e-9, `scope lens adds crit (${sc.critCh}) — unknown ids skip clean`);
  const br = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['macho-brace']);
  ok(Math.abs(br.scoreMult - 1.2) < 1e-9 && Math.abs(br.launchBoost - 0.92) < 1e-9,
    `macho brace: score x${br.scoreMult.toFixed(2)}, launch x${br.launchBoost.toFixed(2)}`);

  // exp share: the fielded team starts +2 levels over a same-seed baseline
  const base = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const xp = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['exp-share']);
  ok(
    xp.players.every((p, i) => p.lvl === base.players[i].lvl + 2 && p.maxHp > base.players[i].maxHp),
    `exp share fields the team +2 levels (${xp.players.map((p) => p.lvl).join(',')})`,
  );

  // sacred ash: a wipe revives once at 30%, the second wipe ends the run
  const sa = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['sacred-ash']);
  ok((sa as any).ashArmed === true, 'sacred ash arms on construct');
  (sa as any).spawnWave(0);
  sa.phase = 'aim';
  for (const p of sa.players) { p.hp = 0; p.dead = true; }
  (sa as any).nextTurn();
  ok(sa.phase === 'aim' && sa.players.every((p) => !p.dead && p.hp === Math.round(p.maxHp * 0.3)),
    'sacred ash revives a wipe at 30%');
  ok((sa as any).ashArmed === false, 'the ash is consumed on the revive');
  for (const p of sa.players) { p.hp = 0; p.dead = true; }
  (sa as any).nextTurn();
  ok(sa.phase === 'lost', 'one ash per run — the second wipe ends it');
}

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
  (rest as any).arriveAtNode({ kind: 'rest', row: 0 });
  ok((rest as any).eventChoice?.options.length === 2, 'rest stop asks: heal or train');
  (rest as any).phase = 'map';
  (rest as any).pickEventChoice(0); // POKÉ CENTER — heal + revive
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
  ok(b.evoChoice?.options.length === 4, `eevee offers its four forms (${b.evoChoice?.options.map((o) => o.name).join('/')})`);
  b.pickEvo(1); // Jolteon
  ok(p.def.id === 135 && b.evoChoice === null, `picked branch becomes ${p.def.name}`);
  ok(p.def.luck === 1, 'the absorbed dupe banked a luck point through evolution');
}

// --- roleOf: specialty reads the dominant base stat -----------------------
{
  ok(
    roleOf(ROSTER.find((r) => r.id === 1)!) === 'MEDIC' && // Bulbasaur is healer-flagged
      roleOf(ROSTER.find((r) => r.id === 25)!) === 'SCOUT' && // Pikachu: spe 90 leads
      roleOf(ROSTER.find((r) => r.id === 95)!) === 'WARDEN' && // Onix: def 160 leads
      roleOf(speciesById(143)!) === 'BULWARK', // Snorlax: hp 160 leads
    'roleOf: healer flag → MEDIC, else dominant base stat names the specialty',
  );
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

// --- catches can't outlevel the team they join ----------------------------
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  const e = (b as any).enemies.find((x: any) => !team().some((t) => t.id === x.def.id));
  e.lvl = 90; // a wild far above anything a young team could field
  b.captureChance = 1; // the ball always lands
  (b as any).hurt(e, e.hp + 50, '#fff');
  // the KO's punch-up EXP lands before the catch — measure the cap after
  const best = Math.max(...(b as any).players.map((p: any) => p.lvl));
  ok((b as any).boxLvl[0] === best + 3, `a lvl-90 catch joins at team pace (box lvl ${(b as any).boxLvl[0]} vs team best ${best})`);
  // the capture ritual: the ball sequence exists mid-rock, then resolves
  // and drains on the update clock alone — the sim never waits for theatre
  ok((b as any).balls.length === 1, 'a forced catch queues its ball ritual');
  for (let i = 0; i < 40; i++) b.update(0.05); // 2s > the ritual's 1.8s bound
  ok((b as any).balls.length === 0, 'the ritual resolves and drains inside its span');
}

// --- gym stops sign their leader's type -------------------------------------
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), mulberry32(3));
  const gyms = (b as any).region.nodes.filter((n: any) => n.kind === 'gym');
  ok(gyms.length === 3 && gyms.every((n: any) => !!n.ttype), `every gym stop wears a leader type (${gyms.map((n: any) => n.ttype).join(', ')})`);
  const stagedBoss = (b as any).stage.waves[2].find((s: any) => s.boss);
  ok(gyms.find((n: any) => n.row === 2)?.ttype === stagedBoss.def.type, 'staged gym sign matches the rolled boss');
  const w = rollWave(mulberry32(1), 3, undefined, 'rock');
  ok(w.find((s: any) => s.boss)?.def.type === 'rock', 'a rolled gym wave honors the signed type');
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
  b.phase = 'map'; // roster swaps live on the map's team panel now
  b.teamSel = 1; // a swap started from the team side resolves the same way
  b.swapFromBox(0, 1); // bench the Lv7, bring in the box Lv3
  ok(b.teamSel === -1 && b.boxSel === -1, 'swap clears both selections');
  ok(p.lvl === 3, `swapped-in mon carries its own level (lv${p.lvl})`);
  ok(b.boxLvl[0] === 7, `benched mon keeps earned levels (boxLvl ${b.boxLvl})`);
  ok(Math.abs(p.pow - ROLE_MODS[p.role].pow * lvlPow(offStat(p.def.stats, p.def.type), 3)) < 0.001, 'swap recomputes pow from its own level');
  void swappedPow;
}

// --- the same swap works on the reward break's TEAM · ITEMS panel ---------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.phase === 'reward', 'reward opens on the item pick');
  const boxed = ROSTER[5];
  b.box.push(boxed);
  b.boxHp.push(1);
  b.boxLvl.push(3);
  const benched = (b as any).players[1].def;
  b.swapFromBox(0, 1); // the catch break carries the same roster modal
  ok((b as any).players[1].def === boxed, 'reward-phase swap fields the box mon');
  ok(b.box[0] === benched && b.boxHp[0] > 0 && b.boxLvl[0] >= 1, 'reward-phase swap benches the teammate');
  ok(b.boxSel === -1 && b.teamSel === -1, 'reward-phase swap clears both selections');
  // mid-fight the panel is shut — a stray call still can't reorder the team
  b.phase = 'aim';
  const stray = ROSTER[6];
  b.box.push(stray);
  b.boxHp.push(1);
  b.boxLvl.push(1);
  b.swapFromBox(1, 0);
  ok(b.box.length === 2 && b.box[1] === stray && (b as any).players[0].def === ROSTER[0], 'mid-fight swap stays refused');
}

// --- reward flow: the pick (or decline) goes straight to the map -----------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.phase === 'reward', 'reward opens on the item pick');
  b.declineReward();
  ok(b.phase === 'map', 'decline exits straight to the map');
  (b as any).enterReward();
  const n = b.rewardOffers.length;
  b.pickPerk(0);
  ok(n > 0 && b.rewardOffers.length === 0, 'a pick banks the relic');
  ok(b.phase === 'map', 'the pick exits straight to the map');
}

// --- offer tools: REROLL re-deals the board, BANISH culls the run -----------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  ok(b.rerollOffers() === false && b.toggleBanish() === false, 'tools stay shut off the reward board');
  (b as any).enterReward();
  const dealt = b.rewardOffers;
  ok(dealt.length === 3 && b.tools.roll === 1 && b.tools.ban === 1, 'fresh board, both charges stocked');
  ok(b.rerollOffers() === true && b.rewardOffers !== dealt, 'reroll re-deals the offers');
  ok(b.rewardOffers.length === 3 && b.tools.roll === 0, 'reroll spends the roll charge (1 → 0)');
  ok(b.rerollOffers() === false && b.rewardOffers.length === 3, 'out of charges — reroll refuses, board kept');
  ok(b.toggleBanish() === true && b.banArmed === true, 'banish arms the next card tap');
  const culled = b.rewardOffers[0].id;
  ok(b.banishPerk(0) === culled && b.perkBan.has(culled), `banish culls ${culled} from the run's pool`);
  ok(b.rewardOffers.length === 2 && b.rewardOffers.every((p) => p.id !== culled), 'the card leaves, the rest stay');
  ok(b.tools.ban === 0 && b.banArmed === false, 'banish spends the charge and disarms');
  ok(b.toggleBanish() === false, 'out of charges — banish refuses to arm');
  // emptying the board resolves the reward — they leave empty-handed
  b.tools.ban = 2;
  b.toggleBanish();
  b.banishPerk(0);
  b.toggleBanish();
  b.banishPerk(0);
  ok(b.rewardOffers.length === 0 && b.phase === 'map', 'banishing the whole board exits to the map');
}

// --- banished perks stay gone: rolls, fresh boards, the save file -----------
{
  // rollPerks honors the ban set directly
  const ban = new Set(['hpup', 'potion', 'moomoo', 'sash', 'mball']);
  let rolled = 0,
    leaked = 0;
  for (let s = 1; s <= 20; s++) {
    for (const p of rollPerks(mulberry32(s), 3, 9, undefined, ban)) {
      rolled++;
      if (ban.has(p.id)) leaked++;
    }
  }
  ok(rolled > 0 && leaked === 0, `${rolled} rolled cards, ${leaked} banished ids`);

  // enterReward routes through the same filter — a seeded ban survives re-deals
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(8));
  for (const id of ban) b.perkBan.add(id);
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    (b as any).spawnWave(0);
    (b as any).enterReward();
    seen.push(...b.rewardOffers.map((p) => p.id));
    b.declineReward(); // back to the map — the next wave pays a fresh board
  }
  ok(seen.length > 0 && seen.every((id) => !ban.has(id)), `5 re-dealt boards honor the ban list (${seen.length} cards)`);

  // charges + bans ride the mid-run save (v2); v1 saves re-stock the tools
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  a.tools.roll = 0;
  a.perkBan.add('sash');
  const s = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  ok(s.tools.roll === 0 && s.tools.ban === 1 && s.perkBan.join() === 'sash', 'snapshot banks spent charges + the ban list');
  const c = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  c.applySnapshot(s);
  ok(c.tools.roll === 0 && c.tools.ban === 1 && c.perkBan.has('sash'), 'tools + bans survive the resume');
  delete s.tools;
  delete s.perkBan;
  const v1 = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(7));
  v1.applySnapshot(s);
  ok(v1.tools.roll === 1 && v1.tools.ban === 1 && v1.perkBan.size === 0, 'a v1 save re-stocks the tools');

  // bag effects ride the same resume: field deltas replay, armed flags keep
  // their exact spent/armed state, and durable items don't double-apply
  const g = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(5), ['master-ball', 'scope-lens', 'exp-share']);
  ok(g.captureChance > 0.06 || (g as any).critCh > 0, 'bag picks land at construct');
  g.masterArmed = false; // spent mid-run before the save
  const sg = JSON.parse(JSON.stringify(g.snapshot()!));
  ok(sg.bag.join() === 'master-ball,scope-lens' && sg.masterArmed === false, 'save drops durable bag ids, keeps spent flags');
  // the real resume path maps saved lvl into the defs before constructing —
  // a durable exp-share must not add a second +2 on top of the saved level
  const rTeam = sg.team.map((e: any) => ({ ...speciesById(e.id)!, lvl: e.lvl, shiny: e.shiny || undefined }));
  const r = new Battle(arena, rTeam, makeStage(7, 'T'), mulberry32(9));
  r.applySnapshot(sg);
  ok((r as any).critCh === (g as any).critCh, 'bag deltas replay on resume');
  ok(r.masterArmed === false, 'a spent master ball stays spent across saves');
  ok(r.players[0].lvl === sg.team[0].lvl, 'exp-share levels come through the save once, not twice');
}

// --- type relics: bumpAlly riders fire only under their perk id -------------
{
  const mk = (leadId: number, ...relics: string[]) => {
    const b = new Battle(arena, [speciesById(leadId)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (b as any).spawnWave(0);
    (b as any).hazards = []; // static fields silence the cast
    for (const id of relics) b.grantPerk(PERKS.find((p) => p.id === id)!);
    const p = (b as any).players[0];
    p.cd = 0;
    return { b, p };
  };
  // clones give chains enough hops — fresh uids keep the hit-dedupe honest
  const clone = (b: any, n: number) => {
    for (let i = 0; i < n; i++)
      b.enemies.push({ ...b.enemies[i % b.enemies.length], uid: 9000 + i, dead: false });
  };
  const drain = (b: any) => {
    for (let i = 0; i < 8 && b.delays.length; i++)
      for (const d of b.delays.splice(0)) d.fn();
  };
  // park the pack in one tight row so every chain hop is in range
  const park = (b: any, p: any) =>
    b.enemies.forEach((e: any, i: number) => { e.x = 300 + i * 30; e.y = 300; p.x = 300; p.y = 360; });

  // magnet: THUNDER hops +2 further (cap still 6) — Mareep keeps the generic
  // chain (Pikachu's THUNDERBOLT signature wouldn't take relic riders)
  {
    const a = mk(179);
    clone(a.b, 4);
    park(a.b, a.p);
    (a.b as any).bumpAlly(a.p, a.p);
    drain(a.b);
    const arcs0 = (a.b as any).beams.length;
    const m = mk(179, 'magnet');
    clone(m.b, 4);
    park(m.b, m.p);
    (m.b as any).bumpAlly(m.p, m.p);
    drain(m.b);
    ok(arcs0 === 3 && (m.b as any).beams.length === arcs0 + 2, `magnet chains +2 links (${arcs0} -> ${(m.b as any).beams.length})`);
  }

  // silk scarf: EXTREMESPEED retargets a second time — a 3rd dash
  {
    const s = mk(133, 'silk-scarf');
    clone(s.b, 2);
    (s.b as any).bumpAlly(s.p, s.p);
    drain(s.b);
    const dash3 = (s.b as any).dashes.length;
    const n = mk(133);
    clone(n.b, 2);
    (n.b as any).bumpAlly(n.p, n.p);
    drain(n.b);
    ok(dash3 === 3 && (n.b as any).dashes.length === 2, `silk scarf links a 3rd dash (${(n.b as any).dashes.length} -> ${dash3})`);
  }

  // black belt: CLOSE COMBAT queues a 4th jab before the uppercut
  {
    const f = mk(66, 'black-belt');
    (f.b as any).bumpAlly(f.p, f.p);
    const jabs = (f.b as any).delays.length;
    const g = mk(66);
    (g.b as any).bumpAlly(g.p, g.p);
    ok(jabs === (g.b as any).delays.length + 1, `black belt adds a jab (${(g.b as any).delays.length} -> ${jabs})`);
  }

  // charcoal: the ring burns without sun, the volley lobs a 4th fireball —
  // Vulpix keeps the generic fire super (Charmander has FLAMETHROWER now)
  {
    const c = mk(37, 'charcoal');
    clone(c.b, 2);
    (c.b as any).weather = null; // clear sky — the burn must come from the relic
    (c.b as any).bumpAlly(c.p, c.p);
    ok((c.b as any).orbs.length === 4, `charcoal volley lobs a 4th fireball (${(c.b as any).orbs.length})`);
    const w = (c.b as any).waves.find((w: any) => w.onHit);
    const e = (c.b as any).enemies[0];
    w.onHit(e);
    ok(e.dotTicks > 0, 'charcoal ring burns under a clear sky');
  }

  // spell tag: HEX sends 8 wisps over the usual 6
  {
    const t = mk(92, 'spell-tag');
    clone(t.b, 5); // 8 targets — enough for the whole pack
    (t.b as any).bumpAlly(t.p, t.p);
    ok((t.b as any).orbs.length === 8, `spell tag sends +2 wisps (${(t.b as any).orbs.length})`);
  }
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
  ok(b.ultIn === 0, 'the first ult tap only arms — no fire');
  b.pointerDown({ x: u.x, y: u.y }); // the confirm tap inside the 2s window fires
  b.pointerUp();
  ok(b.ultIn === ULT_SHOTS, 'firing the ult re-arms the counter');
  for (let i = 0; i < 60; i++) b.update(0.05); // the beams land on a stagger
  ok((b as any).enemies.every((e: any, i: number) => e.dead || e.hp < hp0[i]), 'the ult hits every foe on the court');
  b.ultIn = 3; // a part-banked charge...
  (b as any).spawnWave(0);
  ok(b.ultIn === ULT_SHOTS, 'ult charge never carries into the next fight');
  // the charge is the team's — a benched teammate can spend it too
  b.phase = 'aim';
  b.ultIn = 0;
  const bench = (b as any).players.find((p: any) => p !== (b as any).active && !p.dead);
  if (bench) {
    b.pointerDown({ x: bench.x, y: bench.y });
    b.pointerUp();
    b.pointerDown({ x: bench.x, y: bench.y }); // arm, then confirm
    b.pointerUp();
    ok(b.ultIn === ULT_SHOTS, 'a teammate can spend the shared ult charge');
  }
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

// --- hall of fame: sorted, capped, and honest about misses -------------------
{
  localStorage.removeItem('pk_board');
  ok(board().length === 0, 'board starts empty');
  const mk = (s: number) => ({ s, st: 5, w: false, asc: 0, team: [1, 4, 7], when: 0 });
  recordBoard(mk(100));
  recordBoard(mk(500));
  recordBoard(mk(300));
  ok(board()[0].s === 500 && board()[2].s === 100, 'board sorts by score');
  ok(recordBoard(mk(50)) === 3, 'the lowest slot reports its placement');
  for (let i = 0; i < BOARD_MAX + 2; i++) recordBoard(mk(1000 + i * 100));
  ok(board().length === BOARD_MAX, `board caps at ${BOARD_MAX}`);
  ok(recordBoard(mk(1)) === -1, 'a run under the cutoff misses the board');
  localStorage.setItem('pk_board', '{broken');
  ok(Array.isArray(board()), 'malformed pk_board falls back to memory copy');
  localStorage.removeItem('pk_board');
}

// --- save migration: a legacy best seeds the board exactly once -----------
{
  localStorage.removeItem('pk_board');
  localStorage.setItem('pk_ver', '0');
  localStorage.setItem('pk_best', JSON.stringify({ score: 777, stage: 4, wins: 0, runs: 3 }));
  migrateSaves();
  ok(board()[0]?.s === 777, 'legacy pk_best seeds the hall of fame');
  migrateSaves(); // pk_ver is stamped now — a second boot must not re-seed
  ok(board().length === 1, 'migration runs once');
  localStorage.setItem('pk_board', '[]');
  localStorage.removeItem('pk_best');
  localStorage.setItem('pk_ver', '1');
}

// --- decision telemetry: offers count taken-vs-shown, deaths key by stage ---
{
  localStorage.removeItem('pk_stats');
  statOffer('draft', [1, 4, 7], 4);
  statOffer('draft', [1, 4, 7], null);
  let s = statsDump();
  ok(s.draft['4']?.[0] === 1 && s.draft['4']?.[1] === 2, 'pick rates count taken vs offered');
  statRunEnd(5, false);
  statRunEnd(9, true);
  s = statsDump();
  ok(s.deaths['5'] === 1 && s.wins === 1 && s.runs === 2, 'deaths key by stage, wins count');
  localStorage.removeItem('pk_stats');
}

// --- settings: defaults cover garbage, writes persist immediately ----------
{
  localStorage.setItem('pk_settings', '{broken');
  const d = settings();
  ok(
    d.master === 0.8 && d.music === 0.5 && d.sfx === 0.7 && d.cries === 0.6 && d.haptics && d.shake === 1 && d.flash &&
      d.quality === 'high' && d.pickupFx === 'complete' && !d.battery && !d.fps,
    'garbage pk_settings falls back to defaults',
  );
  localStorage.setItem('pk_settings', JSON.stringify({ cries: 0.1, junk: 'x' }));
  const p = settings();
  ok(p.cries === 0.1 && p.master === 0.8 && p.flash === true, 'a partial blob merges over defaults');
  // v1 stored shake as a bool — it migrates to the 0..1 intensity on read
  localStorage.setItem('pk_settings', JSON.stringify({ shake: true }));
  ok(settings().shake === 1, 'stored shake:true migrates to intensity 1');
  localStorage.setItem('pk_settings', JSON.stringify({ shake: false }));
  ok(settings().shake === 0, 'stored shake:false migrates to intensity 0');
  // enum fields merge only members of their allowed set
  localStorage.setItem('pk_settings', JSON.stringify({ quality: 'ultra', pickupFx: 'simple' }));
  const q = settings();
  ok(q.quality === 'high' && q.pickupFx === 'simple', 'enums merge valid members, reject strangers');
  setSetting('master', 0.3);
  setSetting('shake', 0);
  ok(settings().master === 0.3 && settings().shake === 0, 'setSetting lands on the merged read');
  const raw = JSON.parse(localStorage.getItem('pk_settings')!);
  ok(raw.master === 0.3 && raw.shake === 0, 'setSetting persists pk_settings immediately');
  setSetting('quality', 'medium');
  ok(settings().quality === 'medium', 'setSetting invalidates the parse cache — no reload needed');
  setSetting('master', 0.8);
  setSetting('shake', 1);
  setSetting('quality', 'high');
  setSetting('pickupFx', 'complete');
  setSetting('cries', 0.6); // leave the store at defaults
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
  // keeps its level up to the catch cap — a few over the team's best
  const best = Math.max(...(b as any).players.map((p: any) => p.lvl));
  const want = Math.min(el, best + 3);
  ok(b.boxLvl[b.boxLvl.length - 1] === want, `caught mon joins capped at team pace (Lv${el} wild → Lv${b.boxLvl[b.boxLvl.length - 1]}, cap ${want})`);
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
  (b as any).phase = 'map';
  (b as any).pickEventChoice(0); // POKÉ CENTER — heal + revive
  ok(p0.hp === p0.maxHp, `rest heals to full (${p0.hp}/${p0.maxHp})`);
  ok(!p1.dead && p1.hp === p1.maxHp, 'rest revives a fainted mon');
  // TRAIN HARD: the other rest pick trades the heal for +3 levels
  const bt = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  const tp = (bt as any).players[0];
  const lvl0 = tp.lvl;
  tp.hp = Math.floor(tp.maxHp / 2);
  (bt as any).arriveAtNode({ tx: 0, ty: 0, kind: 'rest', row: 0, links: [] });
  (bt as any).phase = 'map';
  (bt as any).pickEventChoice(1); // TRAIN HARD — +3 levels, no heal
  ok(tp.lvl === lvl0 + 3 && tp.hp < tp.maxHp, `train hard: +3 levels, no heal (Lv${lvl0}→${tp.lvl})`);
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
    gymOpen = 0,
    gymFurnished = 0,
    overlap = 0;
  for (const s of [1, 7, 13, 42, 99, 314, 777, 2024, 5150, 9001]) {
    const b = new Battle(arena, team(), makeStage(s), mulberry32(s));
    for (const i of [0, 1, 2]) {
      (b as any).spawnWave(i);
      if ((b as any).enemies.some((e: any) => e.boss)) (b.blocks.length ? gymFurnished++ : gymOpen++);
      if (b.blocks.length) furnished++;
      for (const e of b.enemies)
        for (const bl of b.blocks)
          if (e.x > bl.x - e.r && e.x < bl.x + bl.w + e.r && e.y > bl.y - e.r && e.y < bl.y + bl.h + e.r) overlap++;
    }
  }
  ok(furnished > 0, `${furnished}/30 spawned waves furnished with stone blocks`);
  ok(gymOpen > 0, `gyms mostly stay open (${gymOpen} open, ${gymFurnished} furnished)`);
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
  let lastWave = -1; // the aim budget is per-wave — a fresh fight refills it
  let shopPicks = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
  while (b.phase !== 'won' && b.phase !== 'lost' && frames < 200000) {
    frames++;
    if ((b as any).waveIndex !== lastWave) {
      lastWave = (b as any).waveIndex;
      aimTries = 0; // new wave, new budget — the flail cycle restarts with it
    }
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
      else if (b.rewardOffers.length) b.pickPerk(Math.floor(rng() * b.rewardOffers.length));
      else b.declineReward(); // empty board — take the score and go
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
  if (b.phase === 'aim') {
    const left = (b as any).enemies.filter((e: any) => !e.dead).map((e: any) => `${e.def.name}#${e.def.id} ${Math.round(e.hp)}/${e.maxHp}`).join(' | ');
    console.log(`DBG seed ${seed}: aim stall depth=${(b as any).depth} wave=${(b as any).waveIndex} tries=${aimTries} — left: ${left}`);
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

// --- map guarantees: rests are rare, but ? and mart stay in each half ---
{
  for (const s of [1, 7, 13, 42, 99, 777, 2024, 5150, 31337, 555]) {
    const r = genRegion(s);
    const rests = r.nodes.filter((n) => n.kind === 'rest').length;
    ok(rests >= 1 && rests <= 3, `seed ${s}: rests are rare — one guaranteed somewhere (${rests} total)`);
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
  // electric's chain leaves visible arcs (Vulpix/Mareep — signature-free, so
  // they fire the generic type supers these asserts read)
  {
    const bf = new Battle(arena, [speciesById(37)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (bf as any).spawnWave(0);
    const fp = bf.players[0];
    fp.cd = 0;
    (bf as any).bumpAlly(fp, fp);
    ok((bf as any).orbs.length === 3, `fire volley launches 3 homing orbs (${(bf as any).orbs.length})`);
    // cast motes: every super scatters element-flavored fx — embers for
    // fire rise against gravity
    ok((bf as any).fx.some((f: any) => f.grav < 0), 'fire cast scatters rising embers');

    const be = new Battle(arena, [speciesById(179)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
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
  let newMods = 0;
  for (let s = 1; s <= 60; s++) {
    const bm = new Battle(arena, team(), makeStage(s), mulberry32(s * 7));
    (bm as any).spawnWave(1);
    const banner = (bm as any).waveSpecial ?? '';
    if (/SWARM|HASTY|VOLATILE|BIG ONE|SHINY|CLERIC|GUARDIAN|STAY DOWN/.test(banner)) mods++;
    if (/WARDED|TAKE WING|SKITTER|HEXED|TAILWIND/.test(banner)) newMods++;
  }
  ok(mods > 3, `${mods}/60 seeds rolled a wave mutator`);
  ok(newMods > 0, `${newMods}/60 seeds rolled a new affix (warded/sky/skitter/hexed/tailwind)`);

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
  (b8 as any).enemies = []; // the well's pull is what this tests — no spawn bumps the ball
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
    // pin mid-level — the level-up heal scales ~1/lvl, so a low-lvl mon
    // would net-gain hp and the trade reads backwards
    p.lvl = 40;
    p.hp = p.maxHp;
    const hp0 = p.hp;
    const lv0 = p.lvl;
    shrine.run(b);
    ok(p.hp < hp0 && p.lvl === lv0 + 2, `shrine trades hp for levels (lv${lv0} → ${p.lvl})`);
  }
}

// --- gamble events: the slots take real score, the boulder is a coin flip ---
{
  // game corner: across seeds the wager busts, pays out, and refuses a broke wallet
  let bust = false, paid = false;
  for (let s = 0; s < 60 && !(bust && paid); s++) {
    const bb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(300 + s));
    bb.score = 500;
    const spin = rollEventChoices(bb, 'SPIN THE REELS');
    if (!spin) continue;
    const s0 = bb.score;
    spin.run(bb);
    if (bb.score === s0 - 200) bust = true;
    if (bb.score > s0 - 200 || bb.heldItems.length) paid = true;
  }
  ok(bust, 'the slots can eat the 200 stake');
  ok(paid, 'the slots can pay out (score or relic)');
  const broke = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(9));
  broke.score = 100;
  rollEventChoices(broke, 'SPIN THE REELS')?.run(broke);
  ok(broke.score === 100, 'the slots refuse a wallet under 200');

  // fossil smash: the boulder hides a boxed fossil or a rocky squatter
  const FOSSILS = new Set([138, 140, 142, 345, 347, 369, 408, 410]);
  let dug = false, woke = false, poolOk = true;
  for (let s = 0; s < 60 && !(dug && woke); s++) {
    const bb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(400 + s));
    (bb as any).spawnWave(0); // waveIndex feeds the fossil's level
    const smash = rollEventChoices(bb, 'SMASH THE BOULDER');
    if (!smash) continue;
    const box0 = bb.box.length;
    const out = smash.run(bb);
    if (out.wave) { woke = true; continue; }
    if (bb.box.length === box0 + 1) {
      dug = true;
      if (!FOSSILS.has(bb.box[bb.box.length - 1].id)) poolOk = false;
    }
  }
  ok(dug, 'the boulder can hide a fossil mon in the box');
  ok(woke, 'the boulder can wake a rocky squatter');
  ok(poolOk, 'boxed fossils come from the fossil pool');

  // macho-brace drills: the ace bleeds, the whole team levels
  const tb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  const drills = rollEventChoices(tb, 'TRAIN — ACE -25% HP, ALL +1 LV');
  ok(drills !== null, 'boot-camp drills surfaced in the pool');
  if (drills) {
    const ace = tb.players.filter((p) => !p.dead).sort((a, z) => z.lvl - a.lvl)[0];
    const hp0 = ace.hp;
    const lv0 = tb.players.map((p) => p.lvl);
    drills.run(tb);
    ok(ace.hp < hp0, `the ace pays in sweat (hp ${hp0} → ${ace.hp})`);
    ok(tb.players.every((p, i) => p.lvl === lv0[i] + 1), 'everyone +1 level');
  }
  // the gate: nobody standing, no drills — re-kill each roll since the
  // hidden spring event revives the team mid-loop
  const corpses = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(42));
  const kill = () => { for (const p of corpses.players) { p.dead = true; p.hp = 0; } };
  kill();
  let gated = true;
  for (let i = 0; i < 150 && gated; i++) {
    const out = rollEvent(corpses);
    if (out.choices?.options.some((o) => o.label === 'TRAIN — ACE -25% HP, ALL +1 LV')) gated = false;
    kill();
  }
  ok(gated, 'drills stay out of the pool when nobody can train');
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
  const bf = new Battle(arena, [speciesById(37)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
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

// --- perk ticks: periodic clauses fire off battle-owned ids -------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  perkTick(b, 100); // zero perks: the loop is a silent no-op
  ok(b.players.every((p) => p.hp === p.maxHp), 'perkTick with zero perks stays silent');

  b.grantPerk(PERKS.find((p) => p.id === 'leftovers')!);
  const p = b.players[0];
  p.hp = Math.floor(p.maxHp / 2);
  const hp0 = p.hp;
  perkTick(b, 10); // under the 18s clock — nothing yet
  ok(p.hp === hp0, 'leftovers waits out its 18s clock');
  perkTick(b, 9); // 19s banked → one mend
  ok(p.hp > hp0, `leftovers mends on the clock (${hp0} → ${Math.round(p.hp)})`);

  // trigger conditions met, but the perks were never granted — nothing fires
  const sash0 = b.players.map((q) => q.sash).join();
  const crit0 = b.critCh;
  b.shots = 10;
  b.waveIndex = 4;
  b.players[1].cd = 3;
  perkTick(b, 30);
  ok(b.critCh === crit0 && b.players[1].cd === 3 && b.players.map((q) => q.sash).join() === sash0,
    "an un-owned perk's tick never fires");

  // focus sash re-weaves two stages after it armed
  const sb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  sb.grantPerk(PERKS.find((p) => p.id === 'sash')!);
  sb.players.forEach((q) => { q.sash = false; }); // spent in a fight
  sb.waveIndex = 1;
  perkTick(sb, 1); // first tick only learns the stage it armed on
  ok(sb.players.every((q) => !q.sash), 'sash stays spent inside the re-arm window');
  sb.waveIndex = 3;
  perkTick(sb, 1);
  ok(sb.players.every((q) => !q.sash), 'two stages on: still inside the window');
  sb.waveIndex = 4;
  perkTick(sb, 1);
  ok(sb.players.every((q) => q.sash), 'three stages on: sashes re-arm');

  // dire hit: crit surges through the 5th shot, hands it back on the 6th
  const db = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  db.grantPerk(PERKS.find((p) => p.id === 'direhit')!);
  const c0 = db.critCh;
  db.shots = 5;
  perkTick(db, 1);
  ok(db.critCh > c0, `5th shot rides a crit surge (${c0.toFixed(2)} → ${db.critCh.toFixed(2)})`);
  db.shots = 6;
  perkTick(db, 1);
  ok(Math.abs(db.critCh - c0) < 1e-9, 'the surge returns the crit after the shot');

  // ether: supers shave a charge every 25s
  const eb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  eb.grantPerk(PERKS.find((p) => p.id === 'ether')!);
  eb.players.forEach((q) => { q.cd = 2; });
  perkTick(eb, 30);
  ok(eb.players.every((q) => q.cd === 1), 'ether shaves a charge on the 25s clock');

  // soothe bell: a slow mend every 4s on top of the flat volley boost
  const so = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  so.grantPerk(PERKS.find((p) => p.id === 'soothebell')!);
  const sq = so.players[0];
  sq.hp = Math.floor(sq.maxHp / 2);
  const sq0 = sq.hp;
  perkTick(so, 4.1);
  ok(sq.hp > sq0, `soothe bell mends 2% on the 4s clock (${sq0} → ${Math.round(sq.hp)})`);

  // lucky egg: a 25-score trickle every 30s
  const le = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  le.grantPerk(PERKS.find((p) => p.id === 'luckyegg')!);
  const sc0 = le.score;
  perkTick(le, 30.1);
  ok(le.score === sc0 + 25, `lucky egg trickles +25 score on the 30s clock (${sc0} → ${le.score})`);

  // exp. share: the lowest living ally levels on the 60s clock
  const xs = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  xs.grantPerk(PERKS.find((p) => p.id === 'expshare')!);
  const xw = xs.players.reduce((a, z) => (a.lvl <= z.lvl ? a : z));
  const xl = xw.lvl;
  perkTick(xs, 60.1);
  ok(xw.lvl === xl + 1, `exp. share drips a level to the weakest ally (Lv${xl} → Lv${xw.lvl})`);
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

// --- a corrupt pk_run reads as "no parked climb", never a NaN'd one ---------
{
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  const clean = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  const trySave = (mut: (s: any) => void) => {
    const s = JSON.parse(JSON.stringify(clean));
    mut(s);
    localStorage.setItem('pk_run', JSON.stringify(s));
    return runSave();
  };
  ok(trySave(() => {}) !== null, 'a clean snapshot passes the pk_run shape-check');
  ok(trySave((s) => { s.team[1].lvl = 'x'; }) === null, 'a non-number team[].lvl rejects the save');
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 5 }, { id: 4, lvl: 5 }];
      s.boxHp = [1, 'x'];
      s.boxLvl = [5, 5];
    }) === null,
    'a non-number boxHp rejects the save',
  );
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 5 }, { id: 4, lvl: 5 }];
      s.boxHp = [1];
      s.boxLvl = [5, 5];
    }) === null,
    'boxHp/boxLvl pair with the box slot-for-slot',
  );
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 'x' }];
      s.boxHp = [1];
      s.boxLvl = [5];
    }) === null,
    'a non-number box[].lvl rejects the save',
  );
  ok(trySave((s) => { s.tools = { roll: 'x', ban: 1 }; }) === null, 'non-number tool charges reject the save');
  ok(trySave((s) => { s.pendingNext = TOTAL_STAGES; }) === null, 'pendingNext past the last row rejects the save');
  ok(trySave((s) => { s.pendingNext = TOTAL_STAGES - 1; }) !== null, `the last gym row (pendingNext ${TOTAL_STAGES - 1}) still resumes`);
  // the v3 migration writes into pk_run — a valid-JSON primitive can't take a property
  localStorage.setItem('pk_run', '42');
  localStorage.setItem('pk_ver', '2');
  let threw = false;
  try {
    migrateSaves();
  } catch {
    threw = true;
  }
  ok(!threw && runSave() === null, 'a primitive pk_run survives the v3 migration and reads as no save');
  localStorage.removeItem('pk_run');
  localStorage.setItem('pk_ver', '1'); // the resting state the migration block left
}

// --- first-run coaching flag -------------------------------------------------
{
  markCoached();
  ok(coachDone(), 'coaching flag persists once the first wave clears');
}

// --- mid-run save round-trips through JSON ----------------------------------
{
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  a.grantPerk(PERKS.find((p) => p.id === 'hpup')!); // measurable: maxHp growth
  (a as any).players[1].hp = 7;
  (a as any).mapNode = 1;
  (a as any).waveIndex = 0;
  (a as any).pendingNext = 1;
  a.score = 1234;
  const s = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  ok(s.perks.join() === 'hpup', 'snapshot records granted perks');

  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  const shape = (bb: Battle) => JSON.stringify((bb as any).region.nodes.map((n: any) => [n.tx, n.ty, n.kind]));
  ok((b as any).mapSeed === s.mapSeed && shape(b) === shape(a), 'island regens from the saved seed');
  ok(b.players[1].hp === 7, 'battled hp restores');
  ok(b.players[0].maxHp === a.players[0].maxHp, 'perk re-applies maxHp growth');
  ok(b.score === 1234 && (b as any).mapNode === 1 && (b as any).pendingNext === 1, 'run position restores');
  ok((b as any).perkIds.join() === 'hpup', 'perk ids survive the resume');
  ok(b.snapshot()!.mapSeed === s.mapSeed, 're-snapshot keeps the original island seed');
}

// --- resume late in the climb keeps waves indexed by row --------------------
{
  // stage.waves only ships the seeded 3; a save parked at row 4+ used to
  // resume with pendingNext past the array — the next node tap crashed
  // reading spawns off waves[5]
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  (a as any).mapNode = 4;
  (a as any).waveIndex = 4;
  (a as any).pendingNext = 5;
  const s = JSON.parse(JSON.stringify(a.snapshot()!));
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  ok((b as any).stage.waves.length > 5, 'resume refills rolled waves');
  let threw = false;
  try {
    (b as any).spawnWave(5);
  } catch {
    threw = true;
  }
  ok(!threw, 'first node tap after a late resume fights, not crashes');
}

// --- resume before the final gym still reaches 'won' ------------------------
{
  // regression: backfilled waves must count toward depth — a run parked then
  // resumed used to clear the last gym at depth 5 < FINAL_DEPTH and stall on
  // the map at "STAGE 10 OF 9" instead of winning
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  (a as any).mapNode = 7;
  (a as any).waveIndex = 7;
  (a as any).pendingNext = 8;
  (a as any).depth = 5; // what a live climb banks standing at the last row
  const s = JSON.parse(JSON.stringify(a.snapshot()!));
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  ok((b as any).depth === 6, 'backfilled waves count toward depth');
  (b as any).waveIndex = 8;
  (b as any).waveCleared();
  ok(b.phase === 'won', 'clearing the last row after a resume wins the run');
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

// --- signature moves: metronome rolls, future sight waits, ice beam locks ---
{
  const mk = (id: number) => {
    const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
    (b as any).spawnWave(0);
    (b as any).hazards = []; // static fields silence casts
    const p = b.players[0];
    p.def = { ...p.def, id }; // masquerade — moveOf keys the dex id
    p.cd = 0;
    return { b, p };
  };
  const drain = (b: any) => {
    for (let i = 0; i < 8 && b.delays.length; i++)
      for (const d of b.delays.splice(0)) d.fn();
  };

  // METRONOME: the wag lands SOME signature — the trail names the roll
  {
    const { b, p } = mk(35); // Clefairy
    (b as any).bumpAlly(p, p);
    const rolled = b.fieldLog.find((l) => l.startsWith('METRONOME →'));
    const fx = (b as any).beams.length + (b as any).waves.length + (b as any).orbs.length + (b as any).delays.length;
    ok(!!rolled && fx > 0, `metronome wags into a real signature (${rolled})`);
  }

  // FUTURE SIGHT: the telegraph ring goes up first, the nuke lands on the queue
  {
    const { b, p } = mk(65); // Alakazam
    p.x = 500; p.y = 300;
    b.enemies.forEach((e: any, i: number) => { e.x = 100 + i * 20; e.y = 300; e.vx = e.vy = 0; });
    const e = b.enemies[0]; // farthest from p — the mark lands under it
    (b as any).bumpAlly(p, p);
    ok((b as any).delays.length > 0 && (b as any).waves.some((w: any) => w.life === 1.8), 'future sight telegraphs before it hits');
    const hp1 = e.hp; // a role passive may already have nicked it
    drain(b);
    ok(e.dead || e.hp < hp1, `future sight's delayed nuke lands (${hp1} → ${e.dead ? 'KO' : e.hp})`);
  }

  // ICE BEAM: every foe on the ray freezes stiff — timers slip
  {
    const { b, p } = mk(350); // Milotic
    p.x = 60; p.y = 400;
    b.enemies.forEach((e: any, i: number) => { e.x = 220 + i * 50; e.y = 400; e.vx = e.vy = 0; e.timer = 3; });
    (b as any).bumpAlly(p, p);
    ok(b.enemies.every((e: any) => e.dead || e.timer > 3), 'ice beam freezes every foe it spears');
  }

  // SPLASH: the dud still counts — it logs the joke and never falls through
  // to the type super (a fallthrough would queue chain links / push beams)
  {
    const { b, p } = mk(129); // Magikarp
    (b as any).bumpAlly(p, p);
    ok(
      b.fieldLog.some((l) => l.includes('SPLASH')) && (b as any).beams.length === 0 && (b as any).delays.length === 0,
      'splash is a dud — logged, no type-super fallthrough',
    );
  }

  // WATER SPOUT: the geyser pours on the caster's own HP — full floods, faint sputters
  {
    const spout = (frac: number) => {
      const { b, p } = mk(382); // Kyogre
      p.x = 60; p.y = 400;
      b.enemies.forEach((e: any, i: number) => {
        e.x = 260 + i * 60; e.y = 400; e.vx = e.vy = 0; e.shieldN = 0;
      });
      const hp0 = b.enemies.map((e: any) => e.hp);
      p.hp = Math.max(1, Math.round(p.maxHp * frac));
      (b as any).bumpAlly(p, p);
      return b.enemies.reduce((s: number, e: any, i: number) => s + hp0[i] - e.hp, 0);
    };
    ok(spout(1) > spout(0.05), 'water spout pours harder at full HP than near-faint');
  }

  // SEISMIC TOSS: fixed damage — the landing pays out per caster level
  {
    const slam = (lvl: number) => {
      const { b, p } = mk(67); // Machoke
      p.lvl = lvl;
      p.x = 270; p.y = 760;
      b.enemies.forEach((e: any, i: number) => {
        e.vx = e.vy = 0; e.shieldN = 0;
        e.x = i === 0 ? 270 : 80 + i * 100;
        e.y = i === 0 ? 300 : 200;
      });
      const e = b.enemies[0];
      const hp0 = e.hp;
      (b as any).bumpAlly(p, p);
      drain(b); // the 0.5s landing is where the damage lives
      return hp0 - e.hp;
    };
    ok(slam(40) > slam(20), 'seismic toss lands harder the higher the level');
  }

  // ENDEAVOR: a full-HP foe gets dragged down to a hurting caster's fraction
  {
    const { b, p } = mk(277); // Swellow
    p.hp = Math.max(1, Math.round(p.maxHp * 0.1));
    p.x = 270; p.y = 760;
    b.enemies.forEach((e: any, i: number) => {
      e.x = 270; e.y = 300 - i * 50; e.vx = e.vy = 0; e.shieldN = 0;
    });
    const e = b.enemies[0];
    const want = Math.max(1, Math.round(e.maxHp * (p.hp / p.maxHp)));
    (b as any).bumpAlly(p, p);
    ok(!e.dead && e.hp <= want, `endeavor pulls the foe to the caster's fraction (${e.hp}/${e.maxHp} → ≤${want})`);
  }

  // FISSURE: the crack skips winged foes — only grounded prey is in its path
  {
    const { b, p } = mk(383); // Groudon
    p.x = 270; p.y = 760;
    const g = b.enemies[0];
    b.enemies.forEach((e: any, i: number) => {
      e.vx = e.vy = 0; e.shieldN = 0; e.timer = 3;
      if (i === 0) {
        e.x = 270; e.y = 500; e.airborne = false; // nearest, grounded — the mark
        e.def = { ...e.def, type: 'normal', type2: undefined };
        e.hp = 1; // canon OHKO: the crack KOs what it catches
      } else {
        e.x = i % 2 ? 80 : 460; e.y = 230 + i * 15; // farther — and winged
        if (i === 1) e.def = { ...e.def, type: 'flying', type2: undefined };
        else e.airborne = true;
      }
    });
    const flyers = b.enemies.slice(1); // hold refs — the dead drop out of enemies[]
    const fly0 = flyers.map((e: any) => e.hp);
    (b as any).bumpAlly(p, p);
    ok(g.dead, 'fissure KOs the grounded mark');
    ok(
      flyers.length > 0 && flyers.every((e: any, i: number) => !e.dead && e.hp === fly0[i]),
      'fissure skips the airborne pack for grounded prey',
    );
  }
}

// --- daily/weekly task board: seeded picks, rollover, one-claim payout ------
{
  localStorage.removeItem('pk_tasks');
  const DAY = 86400000;
  const t0 = Date.UTC(2024, 5, 10, 12); // Monday 2024-06-10, noon UTC
  const t1 = t0 + DAY; // Tuesday — a new day, the same ISO week

  // the seeded roll is deterministic: same key, same board, for everyone
  const ids = rollTasks(DAILY_POOL, 3, daySeed(t0)).map((d) => d.id);
  ok(
    ids.length === 3 && ids.join() === rollTasks(DAILY_POOL, 3, daySeed(t0)).map((d) => d.id).join(),
    `a fixed day rolls the same 3 tasks (${ids.join('/')})`,
  );
  ok(new Set(ids).size === ids.length, 'no duplicate tasks on the daily board');
  ok(rollTasks(WEEKLY_POOL, 4, weekSeed(t0)).length === 4, 'a fixed week rolls 4 tasks');
  const catalogue = [...DAILY_POOL, ...WEEKLY_POOL];
  ok(new Set(catalogue.map((d) => d.id)).size === catalogue.length, 'task ids unique across pools');
  ok(catalogue.every((d) => BAG_ITEMS.some((i) => i.id === d.reward)), 'every reward is a real bag item');
  ok(dayKey(t0) === '2024-06-10' && weekKey(t0) === '2024-W24', `period keys (${dayKey(t0)} / ${weekKey(t0)})`);
  ok(taskViews('daily', t0).length === 3 && localStorage.getItem('pk_tasks') === null, 'taskViews stays read-only — the roll waits for a writer');

  // a full-kind beat lands on both periods — but only the kinds on offer
  taskTick({ kos: 10, catches: 2, stages: 1, gyms: 1, perks: 2, score: 500, shinies: 1, runs: 1, wins: 1, maxstage: 4, dailies: 1 }, t0);
  const dv0 = taskViews('daily', t0);
  const wv0 = taskViews('weekly', t0);
  ok(dv0.length === 3 && wv0.length === 4, 'selections show through the views');
  ok(dv0.every((v) => v.have > 0) && wv0.every((v) => v.have > 0), 'tick accumulates into both periods');
  const s0 = taskState();
  ok(Object.keys(s0.dp).length <= 3 && Object.keys(s0.wp).length <= 4, 'the blob only tracks offered kinds');
  ok(s0.day === dayKey(t0) && s0.dsel.join() === ids.join(), 'tick persisted the seeded board under the day key');

  // overshoot is fine — have runs past n, done is the gate
  taskTick({ kos: 500, catches: 50, stages: 50, gyms: 9, perks: 50, score: 99999, shinies: 5, runs: 5, wins: 2, maxstage: 9, dailies: 2 }, t0);
  const dv = taskViews('daily', t0);
  ok(dv.every((v) => v.done) && dv.some((v) => v.have > v.n), 'over-ticking overshoots the target — done flags hold');
  const wv = taskViews('weekly', t0);
  const ready = dv.concat(wv).filter((v) => v.done && !v.claimed).length;
  ok(ready === 7 && tasksReady(t0) === ready, `tasksReady counts unclaimed done across both periods (${ready})`);

  // the claim banks the reward once — a second tap reads null, stock unmoved
  const target = dv.find((v) => v.done)!;
  const reward = DAILY_POOL.find((d) => d.id === target.id)!.reward;
  const stock0 = bagStock()[reward] ?? 0;
  ok(claimTask(target.id, t0) === reward, 'claimTask returns the paid item id');
  ok((bagStock()[reward] ?? 0) === stock0 + 1, `the reward banks into pk_bag (${reward})`);
  ok(claimTask(target.id, t0) === null && (bagStock()[reward] ?? 0) === stock0 + 1, 'the same task pays once');
  ok(taskViews('daily', t0).find((v) => v.id === target.id)!.claimed === true, 'the claimed flag shows on the view');
  ok(tasksReady(t0) === ready - 1, 'a claim drops the ready count');

  // next day, same ISO week: the daily view re-rolls fresh, the week keeps on
  const dv1 = taskViews('daily', t1);
  ok(dv1.length === 3 && dv1.every((v) => v.have === 0 && !v.done && !v.claimed), 'a new day reads a fresh board — progress wiped');
  ok(taskViews('weekly', t1).every((v) => v.done), 'the weekly board survives the day boundary');
  taskTick({ kos: 1 }, t1); // the first tick of the new day banks the roll
  const s1 = taskState();
  ok(s1.day === dayKey(t1) && s1.dsel.length === 3 && s1.week === weekKey(t0) && Object.keys(s1.wp).length > 0,
    'tick persists the rolled-over day, the week keeps its books');

  // a stale stored key re-rolls through the writer — same seeded board, empty books
  saveTaskState({ day: '1999-01-01', dp: { kos: 99 }, dsel: ['gone'], dclaim: ['gone'], week: '1999-W01', wp: { kos: 5 }, wsel: ['gone2'], wclaim: [] });
  taskTick({}, t0);
  const s2 = taskState();
  ok(s2.day === dayKey(t0) && s2.dsel.join() === ids.join() && Object.keys(s2.dp).length === 0, 'an out-of-period day re-rolls with empty progress');
  ok(s2.week === weekKey(t0) && s2.wsel.length === 4 && Object.keys(s2.wp).length === 0, 'an out-of-period week re-rolls too');

  // countdown strings: a Monday noon is 12h from the daily flip, ~6.5d from the weekly
  ok(taskResetsIn('daily', t0) === 'IN 12H', `daily reset reads as hours (${taskResetsIn('daily', t0)})`);
  ok(taskResetsIn('weekly', t0) === 'IN 7D', `weekly reset reads as days (${taskResetsIn('weekly', t0)})`);
  localStorage.removeItem('pk_tasks'); // leave the store clean for the next run
}

// --- streaks: the daily chain counts fresh UTC days, wins count finishes ---
{
  localStorage.removeItem('pk_streak');
  const DAY = 86400000;
  const t0 = Date.UTC(2024, 5, 10, 12); // Monday 2024-06-10, noon UTC
  ok(streakDaily(t0) === 0 && streakWins() === 0, 'streaks start empty');
  ok(localStorage.getItem('pk_streak') === null, 'streak readers stay read-only');

  bumpStreaks(true, true, t0);
  ok(streakDaily(t0) === 1 && streakWins() === 1, 'a first daily win lights both chains');
  bumpStreaks(true, true, t0 + 3600000); // a second daily, same UTC day
  ok(streakDaily(t0) === 1, 'a same-day second daily never double-counts');
  ok(streakWins() === 2, 'every finished run still feeds the win chain');

  bumpStreaks(false, false, t0); // a non-daily loss the same day
  ok(streakDaily(t0) === 1, 'non-daily runs leave the daily chain alone');
  ok(streakWins() === 0, 'a loss snaps the win chain');

  bumpStreaks(false, true, t0 + DAY); // Tuesday's daily — finishing counts, win or lose
  ok(streakDaily(t0 + DAY) === 2, 'consecutive days chain even on a lost daily');
  ok(streakWins() === 0, 'the loss held wins at 0');

  ok(streakDaily(t0 + 2 * DAY) === 2, 'the badge holds while the chain is still live');
  ok(streakDaily(t0 + 3 * DAY) === 0, 'a gap morning reads broken on the badge');
  bumpStreaks(true, true, t0 + 3 * DAY); // Thursday daily after a missed Wednesday
  ok(streakDaily(t0 + 3 * DAY) === 1, 'the next daily restarts the chain at 1');
  ok(JSON.parse(localStorage.getItem('pk_streak')!).lastDaily === '2024-06-13', 'bumpStreaks persists immediately');

  bumpStreaks(true, false, t0 + 3 * DAY);
  bumpStreaks(true, true, t0 + 4 * DAY); // Friday's daily win
  ok(streakWins() === 3 && streakDaily(t0 + 4 * DAY) === 2, 'wins chain across modes while the daily chain keeps going');

  localStorage.setItem('pk_streak', '{broken');
  ok(streakDaily(t0 + 4 * DAY) === 2 && streakWins() === 3, 'a corrupt blob falls back to the memory copy');
  localStorage.removeItem('pk_streak');
}

// --- songbook validator (MUSIC.md S0): lead.length IS the loop length — a
// short lane is silent dead air, a long one is dead notes nobody hears ------
{
  const midiOk = (m: number) => m === 0 || (m >= 21 && m <= 108); // 0 = rest, else piano range
  const lanes = ['lead', 'harm', 'alt', 'altHarm', 'arp', 'bass'] as const;
  const drums = ['kick', 'snare', 'hat'] as const;
  for (const [name, t] of Object.entries(TRACKS)) {
    const n = t.lead.length;
    for (const f of lanes) {
      const a = t[f];
      if (a === undefined) continue;
      ok(a.length === n, `${name}.${f}: ${a.length} steps vs lead's ${n}`);
      const bad = a.find((m) => !midiOk(m));
      ok(bad === undefined, `${name}.${f}: midi 0 or 21-108 (found ${bad})`);
    }
    for (const f of drums) {
      ok(t[f].length === n, `${name}.${f}: ${t[f].length} steps vs lead's ${n}`);
      const bad = t[f].match(/[^kshc.]/)?.[0];
      ok(bad === undefined, `${name}.${f}: drum chars are k/s/h/c/. (found '${bad}')`);
    }
    if (t.stab !== undefined) {
      ok(t.stab.length === n, `${name}.stab: ${t.stab.length} rows vs lead's ${n}`);
      const badRow = t.stab.findIndex((r) => !Array.isArray(r) || r.some((m) => !midiOk(m)));
      ok(badRow === -1, `${name}.stab: every row is a midi chord array (row ${badRow})`);
    }
    ok(t.next === undefined || t.next in TRACKS, `${name}.next -> '${t.next}' is a real track`);
    ok(!(t.loop === true && t.next !== undefined), `${name}: a loop never hands off to next`);
  }
  ok(true, `${Object.keys(TRACKS).length} tracks validated`);
}

// --- daily rule card (B32): one seeded mod per UTC day, same for all ------
{
  const t0 = Date.UTC(2025, 5, 15);
  ok(dailyMod(t0) === dailyMod(t0), 'same day picks the same rule card');
  ok(DAILY_MODS.length >= 6 && new Set(DAILY_MODS.map((m) => m.id)).size === DAILY_MODS.length, `${DAILY_MODS.length} daily mods, unique ids`);
  const seen = new Set(Array.from({ length: 14 }, (_, i) => dailyMod(t0 + i * 86400000).id));
  ok(seen.size > 1, `the card rotates across days (${seen.size} ids in a fortnight)`);
  const fields = ['scoreMult', 'shinyRate', 'captureChance', 'launchBoost', 'critCh', 'regen', 'koHeal', 'dmgMult', 'takenMult', 'cdMult', 'ricoPip', 'volleyBoost', 'comboDmg', 'physMult', 'specMult', 'allAffix', 'dailyWeather', 'martMult', 'foeHpBonus'] as const;
  for (const m of DAILY_MODS) {
    const b = new Battle(arena, [speciesById(1)!], makeStage(5, 'T'), mulberry32(1));
    const before = fields.map((f) => b[f]);
    m.apply(b);
    ok(fields.some((f, i) => b[f] !== before[i]), `${m.id} apply() moves a battle field`);
  }

  // the flag paths move real mechanics, not just fields
  const mod = (id: string) => DAILY_MODS.find((m) => m.id === id)!;
  const fb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  mod('fever').apply(fb);
  ok(fb.shinyRate === 3, `gold fever: shinyRate x${fb.shinyRate}`);
  const hb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  const hp0 = hb.players.map((p) => p.maxHp);
  mod('hearty').apply(hb);
  ok(hb.players.every((p, i) => p.maxHp === Math.round(hp0[i] * 1.25) && p.hp === p.maxHp) && hb.foeHpBonus === 0.1,
    'hearty: team maxHp +25% and topped up, foes +10%');
  const rb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  mod('rich').apply(rb);
  const potion = martStock(rb).options.find((o) => o.label.startsWith('POTION'))!;
  ok(rb.scoreMult === 1.2 && potion.cost === 150, `big spender: +20% score, mart potion ${potion.cost} (was 200)`);
  const gb = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  const gb0 = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  mod('glass').apply(gb);
  (gb as any).spawnWave(0);
  (gb0 as any).spawnWave(0);
  const hpRatio = gb.enemies[0].maxHp / gb0.enemies[0].maxHp;
  ok(gb.dmgMult === 1.3 && Math.abs(hpRatio - 1.2) < 0.01, `glass cannon: dmg x${gb.dmgMult}, foes x${hpRatio.toFixed(3)} hp`);

  // storm chaser: every rolled wave has a sky; rough road: every eligible
  // rolled wave mutates. Boss/trainer/invade waves skip the affix roll.
  for (const s of [3, 11]) {
    const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    mod('stormy').apply(b);
    let skies = true;
    for (let i = 0; i <= 4; i++) {
      (b as any).spawnWave(i);
      if (!b.weather) skies = false;
    }
    ok(skies, `storm chaser: weather on every wave (seed ${s})`);
    const c = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    let clear = 0;
    for (let i = 0; i <= 4; i++) {
      (c as any).spawnWave(i);
      if (!c.weather) clear++;
    }
    ok(clear > 0, `control seed ${s}: ${clear} clear courts without the card`);

    const r = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    mod('rough').apply(r);
    let eligible = 0, affixed = 0;
    for (let i = 1; i <= 4; i++) {
      (r as any).spawnWave(i);
      // bosses (gyms + invades) skip the affix roll — a landed affix also
      // sets waveSpecial, so it can't be the discriminator
      if (r.enemies.some((e) => e.boss)) continue;
      eligible++;
      if ((r as any).curMod) affixed++;
    }
    ok(eligible > 0 && affixed === eligible, `rough road: ${affixed}/${eligible} eligible waves mutated (seed ${s})`);
    const rc = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    let cElig = 0, cAff = 0;
    for (let i = 1; i <= 4; i++) {
      (rc as any).spawnWave(i);
      if (rc.enemies.some((e) => e.boss)) continue;
      cElig++;
      if ((rc as any).curMod) cAff++;
    }
    ok(cAff < cElig, `control seed ${s}: affixes stay a minority (${cAff}/${cElig})`);
  }
}

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
