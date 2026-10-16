import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
await pg.goto('http://localhost:5173/?dev&seed=99');
await pg.waitForTimeout(1800);

// trophy shelf: the ★ button next to DEX
await pg.mouse.click(405, 880);
await pg.waitForTimeout(400);
await pg.screenshot({ path: '/tmp/ps3-trophies.png' });
await pg.keyboard.press('Escape');
await pg.waitForTimeout(300);

// dex overlay
await pg.mouse.click(200, 880);
await pg.waitForTimeout(400);
await pg.screenshot({ path: '/tmp/ps3-dex.png' });
await pg.keyboard.press('Escape');
await pg.waitForTimeout(200);

// fresh map with decor mons
await pg.mouse.click(270, 772);
await pg.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await pg.mouse.click(105, 425); await pg.waitForTimeout(250); }
await pg.mouse.click(105, 480);
await pg.waitForTimeout(1200);
await pg.screenshot({ path: '/tmp/ps3-map.png' });
await browser.close();
console.log('done');
