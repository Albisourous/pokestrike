// ?debug=1 sandbox check — headless, no DOM. The location shim must land
// before meta.ts evaluates (DEBUG is a module-level const), so meta comes in
// through a dynamic import after the global is set.
import './shims';
(globalThis as Record<string, unknown>).location = { search: '?debug=1' };

const meta = await import('../src/game/meta');
const { DEX_ALL } = await import('../src/game/data');

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    fails++;
    console.error(`FAIL  ${msg}`);
  }
};

meta.debugSeed();

// the grant landed — under pk_debug_* only
ok(meta.stars() >= 99999, `stars seeded fat (${meta.stars()})`);
ok(meta.dust() >= 9999, `dust seeded fat (${meta.dust()})`);
ok(meta.dexIds().length === DEX_ALL.length, `full dex (${meta.dexIds().length}/${DEX_ALL.length})`);
ok(meta.shinyIds().length === DEX_ALL.length, `full shiny ledger (${meta.shinyIds().length})`);
ok(meta.gymBadges().size === meta.BADGES.length, `badge case full (${meta.gymBadges().size}/${meta.BADGES.length})`);
ok(meta.best().wins === 9, 'nine wins → ascension ladder tops out');
const lab0 = meta.LAB_UPGRADES[0];
ok(meta.labLevel(lab0.id) === lab0.max, `lab maxed (${lab0.id} lv${meta.labLevel(lab0.id)})`);
ok(meta.bagStock()['master-ball'] === 5, 'bag stocked');
ok(meta.unlockedAch().size === meta.ACHIEVEMENTS.length, `all achievements (${meta.unlockedAch().size})`);
ok(meta.coachDone() && meta.helpSeen(), 'first-boot overlays preset');
ok(localStorage.getItem('pk_debug_stars') !== null, 'writes land on pk_debug_* keys');
ok(localStorage.getItem('pk_stars') === null, 'real pk_stars untouched');
ok(localStorage.getItem('pk_debug_badges') !== null && localStorage.getItem('pk_badges') === null, 'badges sandboxed');

// runtime progress stays in the sandbox
meta.spendStars(1000);
ok(meta.stars() >= 98999 && localStorage.getItem('pk_stars') === null, 'spends stay sandboxed');
const cleared = JSON.parse(localStorage.getItem('pk_debug_dex')!) as number[];
localStorage.setItem('pk_dex', JSON.stringify([999])); // a "real" save write mid-session
ok(meta.dexIds().length === cleared.length, 'debug reads ignore the real save');
localStorage.removeItem('pk_dex');

// idempotent — a reseed doesn't stomp runtime changes
meta.debugSeed();
ok(meta.stars() >= 98999 && meta.stars() < 99999 + 200, 'reseed is a no-op');

if (fails) {
  console.error(`\n${fails} FAIL`);
  process.exit(1);
}
console.log('\ndebug sandbox ok');
