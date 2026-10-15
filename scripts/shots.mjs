// Play a real run headlessly and capture the docs/ screenshots.
// Usage: node scripts/shots.mjs [seed]   (dev server must be running)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SEED = process.argv[2] ?? '7';
const GAME = `http://localhost:5173/?dev&seed=${SEED}`;
const OUT = new URL('../docs/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(GAME);
await page.waitForTimeout(3500); // sprites + font

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const tap = (x, y) => page.mouse.click(x, y);
const phase = () => page.evaluate(() => window.__battle?.phase ?? 'none');
const sleep = (ms) => page.waitForTimeout(ms);

// first run auto-opens the help overlay — a tap anywhere closes it
await tap(400, 800);
await sleep(400);
await shot('title');
await tap(270, 752); // FREE PLAY
await sleep(600);
await shot('draft');
for (let i = 0; i < 4; i++) {
  await tap(105, 425); // leftmost offer card
  await sleep(400);
}
await sleep(500);
await shot('charm');
await tap(105, 480); // first charm card
await sleep(800);
await shot('map'); // region map, pre-walk

// autoplay: state-driven walk — map taps prefer a trainer stop, waves are
// force-cleared via hurt()+endShot(). Screenshot harvest, not a fairness test.
const waitPhase = async (wants, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ph = await phase();
    if (wants.includes(ph)) return ph;
    await sleep(200);
  }
  return phase();
};

let aimShot = false;
let battleShot = false;
let trainerShot = false;
let rewardShot = false;
let resultShot = false;
let aimDone = false;

for (let iter = 0; iter < 400; iter++) {
  const ph = await phase();
  if (ph === 'won' || ph === 'lost') break;
  if (ph === 'map') {
    const hit = await page.evaluate(() => {
      const b = window.__battle;
      if (b.mapWalk) return null;
      const cur = b.region.nodes[b.mapNode];
      const nodes = cur.links.map((li) => b.region.nodes[li]);
      const n = nodes.find((x) => x.kind === 'trainer') ?? nodes.find((x) => x.kind !== 'gym') ?? nodes[0];
      return { tx: n.tx, ty: n.ty, kind: n.kind };
    });
    if (!hit) { await sleep(300); continue; }
    const cell = 32, ox = (540 - 16 * cell) / 2, oy = 128;
    await tap(ox + hit.tx * cell + cell / 2, oy + hit.ty * cell + cell / 2);
    await page.waitForFunction(() => !window.__battle.mapWalk, null, { timeout: 15000 }).catch(() => {});
    if (hit.kind === 'trainer' && !trainerShot) {
      await waitPhase(['aim']);
      await sleep(400);
      await shot('trainer');
      trainerShot = true;
    }
  } else if (ph === 'aim' || ph === 'shot' || ph === 'enemy') {
    // first wave: a real drag for the aim/battle shots before force-clearing
    if (!aimDone && ph === 'aim') {
      const u = await page.evaluate(() => {
        const b = window.__battle;
        const p = b.players.find((x) => !x.dead && x.uid === b.active?.uid) ?? b.players.find((x) => !x.dead);
        const foes = b.enemies.filter((e) => !e.dead);
        if (!p || !foes.length) return null;
        let f = foes[0], best = Infinity;
        for (const e of foes) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < best) { best = d; f = e; } }
        const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
        return { x: p.x, y: p.y, dx: (dx / d) * 200, dy: (dy / d) * 200 };
      });
      if (u) {
        await page.mouse.move(u.x, u.y);
        await page.mouse.down();
        await page.mouse.move(u.x - u.dx, u.y - u.dy, { steps: 6 });
        await shot('aim');
        aimShot = true;
        await page.mouse.up();
        await sleep(900);
        await shot('battle');
        battleShot = true;
        aimDone = true;
        continue;
      }
    }
    await page.evaluate(() => {
      const b = window.__battle;
      for (const e of b.enemies) if (!e.dead) b.hurt(e, e.hp + 1, '#fff');
      if (b.phase === 'aim') b.endShot(); // only settle from aim — calling endShot during reward deadlocks
    });
    await sleep(800);
  } else if (ph === 'reward') {
    if (!rewardShot) { await shot('reward'); rewardShot = true; }
    await tap(105, 480); // take the first relic
    await sleep(400);
    if ((await phase()) === 'reward') await tap(473, 923); // REWARD_SKIP
    await sleep(400);
  } else {
    await sleep(500);
  }
  if (aimShot && battleShot && trainerShot && rewardShot) break;
}

const end = await phase();
if (end === 'won' || end === 'lost') { await shot('result'); resultShot = true; }
console.log(`done: phase=${end} aim=${aimShot} battle=${battleShot} trainer=${trainerShot} reward=${rewardShot} result=${resultShot}`);
await browser.close();
