// Headless playthrough — no DOM. Bundle: rolldown test/smoke.ts -f esm -p node
import './shims';
import { Battle, MAP_CELL, MAP_OX, MAP_OY } from '../src/game/battle';
import { makeStage, ROSTER, TOTAL_STAGES, speciesById } from '../src/game/data';
import { mulberry32 } from '../src/core/rng';
import { roleOf, ROLE_MODS, moveOf, MOVE_NAME, LV_CAP, offStat, lvlPow } from '../src/game/stats';
import { genRegion, routePath } from '../src/game/map';
import { teamTraits, TRAIT_DESC } from '../src/game/traits';
import { rollEvent } from '../src/game/events';

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
  b.swapFromBox(0, 1); // bench the Lv7, bring in the box Lv3
  ok(p.lvl === 3, `swapped-in mon carries its own level (lv${p.lvl})`);
  ok(b.boxLvl[0] === 7, `benched mon keeps earned levels (boxLvl ${b.boxLvl})`);
  ok(Math.abs(p.pow - ROLE_MODS[p.role].pow * lvlPow(offStat(p.def.stats, p.def.type), 3)) < 0.001, 'swap recomputes pow from its own level');
  void swappedPow;
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

// --- full autoplayed climbs: naive aim, real physics, win or wipe ---------
for (const [seed, asc] of [[99, 0], [2024, 0], [777, 0], [5150, 5]] as const) {
  const rng = mulberry32(seed);
  const b = new Battle(arena, team(), makeStage(seed), rng);
  b.asc = asc;
  let frames = 0;
  let aimTries = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
  while (b.phase !== 'won' && b.phase !== 'lost' && frames < 200000) {
    frames++;
    if (b.phase === 'aim' && aimTries++ > 300) break; // stall detector
    if (b.phase === 'map') {
      // pick a linked stop — same cell math drawRegion/pointerDown use
      const region = (b as any).region;
      const cur = region.nodes[(b as any).mapNode];
      const n = region.nodes[cur.links[Math.floor(rng() * cur.links.length)]];
      b.pointerDown({ x: MAP_OX + n.tx * MAP_CELL + MAP_CELL / 2, y: MAP_OY + n.ty * MAP_CELL + MAP_CELL / 2 });
      step(240); // the lead mon walks the route over ~6 tiles/sec
    } else if (b.phase === 'reward') {
      b.pickPerk(Math.floor(rng() * Math.max(1, b.rewardOffers.length)) || 0);
      if (b.phase === 'reward') b.pickPerk(0); // safety: force advance
    } else if (b.phase === 'aim') {
      const u = (b as any).active;
      if (!u || u.dead) { step(30); continue; }
      const foes = (b as any).enemies.filter((e: any) => !e.dead);
      if (!foes.length) { step(60); continue; }
      // nearest live foe — but if one is sitting on us, aim at arena top instead
      let foe = foes[0], bestD = Infinity;
      for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < bestD) { bestD = d; foe = f; } }
      const t = bestD > 60 ? foe : { x: arena.x + arena.w / 2, y: arena.y + 60 };
      const dx = t.x - u.x, dy = t.y - u.y;
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

// --- roster integrity -------------------------------------------------------
ok(ROSTER.length >= 29, `roster expanded (${ROSTER.length})`);
ok(ROSTER.every((r) => speciesById(r.id)), 'every roster id resolves');
const evo = ROSTER.filter((r) => r.evolvesTo).every((r) => speciesById(r.evolvesTo!));
ok(evo, 'every evolvesTo resolves');
ok(moveOf(25, 'electric') === 'THUNDERBOLT', 'pikachu override');
ok(moveOf(129, 'water') === 'SPLASH', 'magikarp signature');
ok(moveOf(9999, 'fire') === MOVE_NAME.fire, 'unknown id falls back to type move');

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
