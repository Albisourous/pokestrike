import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
pg.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await pg.goto('http://localhost:5173/?dev&seed=99');
await pg.waitForTimeout(1800);
await pg.mouse.click(270, 772);
await pg.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await pg.mouse.click(105, 425); await pg.waitForTimeout(250); }
await pg.mouse.click(105, 480);
await pg.waitForTimeout(900);

// walk to first stop
await pg.evaluate(() => {
  const b = window.__battle;
  const n = b.region.nodes[b.region.nodes[b.mapNode].links[0]];
  b.pointerDown({ x: 14 + n.tx * 32 + 16, y: 128 + (n.ty - b.mapCam) * 32 + 16 });
});
await pg.waitForTimeout(2500);

// wait for aim, then swap in a gym wave
for (let i = 0; i < 30; i++) {
  if ((await pg.evaluate(() => window.__battle.phase)) === 'aim') break;
  await pg.waitForTimeout(400);
}
await pg.evaluate(() => {
  const b = window.__battle;
  b.spawnWave(2); // gym wave: leader + entourage
});
await pg.waitForTimeout(700);
await pg.screenshot({ path: '/tmp/ps4-gym.png' });

// nearly kill the boss, shoot at it, catch the badge moment
const t = await pg.evaluate(() => {
  const b = window.__battle;
  const boss = b.enemies.find((e) => e.boss && !e.dead);
  if (boss) boss.hp = 5;
  const u = b.active;
  return boss ? { ux: u.x, uy: u.y, fx: boss.x, fy: boss.y } : null;
});
if (t) {
  const dx = t.fx - t.ux, dy = t.fy - t.uy, d = Math.hypot(dx, dy) || 1;
  await pg.mouse.move(t.ux, t.uy);
  await pg.mouse.down();
  await pg.mouse.move(t.ux - (dx / d) * 200, t.uy - (dy / d) * 200, { steps: 8 });
  await pg.mouse.up();
  await pg.waitForTimeout(1600);
  await pg.screenshot({ path: '/tmp/ps4-badge.png' });
  await pg.waitForTimeout(2000);
  await pg.screenshot({ path: '/tmp/ps4-after.png' });
}
await browser.close();
console.log('done');
