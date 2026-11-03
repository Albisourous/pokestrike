// Font-floor verification pass: tour the player-facing screens and capture
// PNGs for eyeball review. Dev server must be running on :5173.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SEED = process.argv[2] ?? '7';
const GAME = `http://localhost:5173/?dev&seed=${SEED}`;
const OUT = '/tmp/fontshots/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(GAME);
await page.waitForTimeout(3500);

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const tap = (x, y) => page.mouse.click(x, y);
const phase = () => page.evaluate(() => window.__battle?.phase ?? 'none');
const ui = () => page.evaluate(() => window.__dbg?.ui() ?? {});
const sleep = (ms) => page.waitForTimeout(ms);

// first run auto-opens the help overlay — capture it before dismissing
await sleep(500);
await shot('help-first');
await tap(400, 800);
await sleep(400);
await shot('title');

// menu overlays from the title: tasks, dex, settings, hatch
const openOver = async (name, x, y) => {
  await tap(x, y);
  await sleep(600);
  await shot(name);
};
// TAB_CELLS sit in the title tab bar (50..490 x, y ~856-932)
await openOver('mons-tab', 150, 890);
await openOver('town-tab', 270, 890);
// settings gear at GEAR_BTN (W-118, 22, 44x44) → center ~(422,44)
await openOver('settings', 422, 44);
await tap(460, 120); // close (top-right)
await sleep(400);

await tap(270, 752); // START CLIMB
await sleep(600);
await shot('draft');
for (let i = 0; i < 4; i++) {
  await tap(105, 425);
  await sleep(400);
}
await sleep(500);
await shot('charm');
await tap(105, 480);
await sleep(800);
await shot('map');

const waitPhase = async (wants, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ph = await phase();
    if (wants.includes(ph)) return ph;
    await sleep(200);
  }
  return phase();
};

let aimShot = false, battleShot = false, scoutShot = false, pauseShot = false, rewardShot = false;
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
      return { tx: n.tx, ty: n.ty, kind: n.kind, cam: b.mapCam };
    });
    if (!hit) { await sleep(300); continue; }
    const cell = 32, ox = (540 - 16 * cell) / 2, oy = 128;
    await tap(ox + hit.tx * cell + cell / 2, oy + (hit.ty - hit.cam) * cell + cell / 2);
    await page.waitForFunction(() => !window.__battle.mapWalk, null, { timeout: 15000 }).catch(() => {});
  } else if (ph === 'aim' || ph === 'shot' || ph === 'enemy') {
    if (!aimDone && ph === 'aim') {
      const u = await page.evaluate(() => {
        const b = window.__battle;
        const p = b.players.find((x) => !x.dead && x.uid === b.active?.uid) ?? b.players.find((x) => !x.dead);
        const foes = b.enemies.filter((e) => !e.dead);
        if (!p || !foes.length) return null;
        let f = foes[0], best = Infinity;
        for (const e of foes) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < best) { best = d; f = e; } }
        const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
        return { x: p.x, y: p.y, dx: (dx / d) * 200, dy: (dy / d) * 200, fx: f.x, fy: f.y };
      });
      if (u) {
        // scout card: tap the foe first (inspect), then aim-drag
        await tap(u.fx, u.fy);
        await sleep(500);
        await shot('scout');
        scoutShot = true;
        await page.mouse.move(u.x, u.y);
        await page.mouse.down();
        await page.mouse.move(u.x - u.dx, u.y - u.dy, { steps: 6 });
        await shot('aim');
        aimShot = true;
        await page.mouse.up();
        await sleep(900);
        await shot('battle');
        battleShot = true;
        // pause card
        const pc = await page.evaluate(() => window.__battle?.pauseChip?.() ?? null);
        if (pc) { await tap(pc.x + pc.w / 2, pc.y + pc.h / 2); await sleep(500); await shot('pause'); pauseShot = true; await tap(270, 700); await sleep(400); }
        aimDone = true;
        continue;
      }
    }
    await page.evaluate(() => {
      const b = window.__battle;
      for (const e of b.enemies) if (!e.dead) b.hurt(e, e.hp + 1, '#fff');
      if (b.phase === 'aim') b.endShot();
    });
    await sleep(800);
  } else if (ph === 'reward') {
    if (!rewardShot) { await shot('reward'); rewardShot = true; }
    await tap(105, 480);
    await sleep(400);
    if ((await phase()) === 'reward') await tap(473, 923);
    await sleep(400);
  } else {
    await sleep(500);
  }
  if (aimShot && battleShot && scoutShot && rewardShot && iter > 30) break;
}

const end = await phase();
if (end === 'won' || end === 'lost') await shot('result');
console.log(`done: phase=${end} aim=${aimShot} battle=${battleShot} scout=${scoutShot} pause=${pauseShot} reward=${rewardShot}`);
await browser.close();
