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

// autoplay: map taps pick the leftmost linked stop (trainers preferred),
// aim drags from the active mon toward the nearest foe
let aimShot = false;
let battleShot = false;
let rewardShot = false;
let resultShot = false;
for (let iter = 0; iter < 4000; iter++) {
  const ph = await phase();
  if (ph === 'won' || ph === 'lost') break;
  if (ph === 'map') {
    const hit = await page.evaluate(() => {
      const b = window.__battle;
      if (b.mapWalk) return null;
      const cur = b.region.nodes[b.mapNode];
      const nodes = cur.links.map((li) => b.region.nodes[li]);
      const n = nodes.find((x) => x.kind === 'trainer') ?? nodes[0];
      return { tx: n.tx, ty: n.ty, kind: n.kind };
    });
    if (!hit) { await sleep(300); continue; }
    if (hit.kind === 'trainer') await shot('map'); // re-shoot with trainer in view
    const cell = 30, ox = (540 - 16 * cell) / 2, oy = 136;
    await tap(ox + hit.tx * cell + cell / 2, oy + hit.ty * cell + cell / 2);
    await sleep(2600); // the walk + spawn
  } else if (ph === 'aim') {
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
    if (!u) { await sleep(400); continue; }
    await page.mouse.move(u.x, u.y);
    await page.mouse.down();
    await page.mouse.move(u.x - u.dx, u.y - u.dy, { steps: 6 });
    if (!aimShot) { await shot('aim'); aimShot = true; }
    await page.mouse.up();
    await sleep(900);
    if (!battleShot) { await shot('battle'); battleShot = true; }
    await sleep(600);
  } else if (ph === 'reward') {
    if (!rewardShot) { await shot('reward'); rewardShot = true; }
    await tap(105, 480); // take the first relic
    await sleep(400);
    const still = await phase();
    if (still === 'reward') await tap(473, 923); // REWARD_SKIP
    await sleep(400);
  } else {
    await sleep(500);
  }
  if (aimShot && battleShot && rewardShot) break; // got the shots — done
}
const end = await phase();
if (end === 'won' || end === 'lost') { await shot('result'); resultShot = true; }
console.log(`done: phase=${end} aim=${aimShot} battle=${battleShot} reward=${rewardShot} result=${resultShot}`);
await browser.close();
