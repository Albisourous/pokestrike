// Headless playthrough — no DOM. Bundle: rolldown test/smoke.ts -f esm -p node
import './shims';
import { Battle } from '../src/game/battle';
import { makeStage, ROSTER, TOTAL_STAGES, speciesById } from '../src/game/data';
import { mulberry32 } from '../src/core/rng';
import { roleOf, ROLE_MODS } from '../src/game/stats';

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
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(e.dead, 'lethal hit kills');
  ok(shooter.lvl === 2 && shooter.pow > pow0, `KO levels shooter (lv${shooter.lvl} pow ${shooter.pow.toFixed(2)})`);
}

// --- evolution preserves earned levels ------------------------------------
{
  const karp = ROSTER.find((r) => r.id === 129)!;
  const b = new Battle(arena, [karp, ...team()], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  p.lvl = 10; // earned levels mid-run
  (b as any).absorbDupe(karp); // dup catch → evolve
  ok(p.def.id === 130, `Magikarp evolved into ${p.def.name}`);
  const m = ROLE_MODS[roleOf(p.def.stats, p.def.healer)];
  ok(p.pow > m.pow * 1.5, `levels survive evolution (pow ${p.pow.toFixed(2)} vs base ${m.pow})`);
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

// --- every rolled wave across seeds is spawnable ---------------------------
{
  let bad = 0;
  for (let s = 1; s <= 40; s++) {
    const st = makeStage(s);
    for (const w of st.waves) if (!w.length) bad++;
  }
  ok(bad === 0, `40 seeded stages, ${bad} empty waves`);
}

// --- full autoplayed climb: naive aim, real physics, win or wipe -----------
{
  const rng = mulberry32(99);
  const b = new Battle(arena, team(), makeStage(99), rng);
  b.asc = 0;
  let frames = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
  while (b.phase !== 'won' && b.phase !== 'lost' && frames < 400000) {
    frames++;
    if (b.phase === 'map') {
      b.pointerDown({ x: 270, y: 480 });
    } else if (b.phase === 'reward') {
      b.pickPerk(Math.floor(rng() * Math.max(1, b.rewardOffers.length)) || 0);
      if (b.phase === 'reward') b.pickPerk(0); // safety: force advance
    } else if (b.phase === 'aim') {
      const u = (b as any).active;
      const foe = (b as any).enemies.find((e: any) => !e.dead);
      if (!foe) { step(60); continue; }
      const dx = foe.x - u.x, dy = foe.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      b.pointerDown({ x: u.x, y: u.y });
      b.pointerMove({ x: u.x - (dx / d) * 200, y: u.y - (dy / d) * 200 });
      b.pointerUp();
      step(1);
    } else {
      step(30);
    }
  }
  ok(b.phase === 'won' || b.phase === 'lost', `autoplay reaches an end state: ${b.phase} (depth ${(b as any).depth}, ${frames} ticks)`);
  ok(b.score > 0, `score accumulates (${b.score})`);
  console.log(`     -> reached depth ${(b as any).depth}/${TOTAL_STAGES - 3} · kos ${(b as any).totalKos} · badges: ${b.runBadges(b.phase === 'won').map((x) => x.name).join(', ')}`);
}

// --- roster integrity -------------------------------------------------------
ok(ROSTER.length >= 29, `roster expanded (${ROSTER.length})`);
ok(ROSTER.every((r) => speciesById(r.id)), 'every roster id resolves');
const evo = ROSTER.filter((r) => r.evolvesTo).every((r) => speciesById(r.evolvesTo!));
ok(evo, 'every evolvesTo resolves');

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
