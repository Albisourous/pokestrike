import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 540, height: 960 } });
await pg.goto('http://localhost:5173/?dev');
await pg.waitForFunction(() => window.__dbg?.scene === 'title', null, { timeout: 30000 });
await pg.waitForTimeout(400);
// dismiss help overlay (auto-opens on fresh profile)
await pg.mouse.click(270, 480);
await pg.waitForTimeout(200);
// free play
await pg.mouse.click(270, 772);
await pg.waitForFunction(() => window.__dbg.scene === 'draft', null, { timeout: 5000 });
await pg.waitForTimeout(300);
// draft 3 cards
for (const x of [105, 270, 435]) { await pg.mouse.click(x, 425); await pg.waitForTimeout(350); }
await pg.waitForFunction(() => window.__dbg.scene === 'battle', null, { timeout: 5000 });
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/map-decor1.png' });
// scroll the camera up to see more of the island
await pg.evaluate(() => { const b = window.__battle; if (b) b.mapCam = 12; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: '/tmp/map-decor2.png' });
await pg.evaluate(() => { const b = window.__battle; if (b) b.mapCam = 26; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: '/tmp/map-decor3.png' });
await b.close();
console.log('done');
