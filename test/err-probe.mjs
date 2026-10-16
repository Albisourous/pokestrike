import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
pg.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await pg.goto('http://localhost:5173/?dev&seed=7');
await pg.waitForTimeout(2000);
await pg.mouse.click(270, 772);
await pg.waitForTimeout(600);
await pg.screenshot({ path: '/tmp/ps5-draft.png' });
// dex overlay — new entries are hidden until caught, but the count should be up
await pg.keyboard.press('Escape');
await pg.waitForTimeout(200);
await pg.goto('http://localhost:5173/?dev&seed=7');
await pg.waitForTimeout(1500);
await pg.mouse.click(200, 880);
await pg.waitForTimeout(400);
await pg.screenshot({ path: '/tmp/ps5-dex.png' });
await browser.close();
console.log('done');
