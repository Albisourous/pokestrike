// Step-by-step probe to reach the map TEAM & ITEMS drawer.
import { chromium } from 'playwright';

const GAME = 'http://localhost:5173/?dev&seed=7';
const OUT = new URL('../docs/', import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(GAME);
await page.waitForTimeout(3500);

const tap = async (x, y, tag) => {
  await page.mouse.click(x, y);
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ ph: window.__battle?.phase ?? 'none', scene: window.__dbg?.scene?.() }));
  console.log(tag, JSON.stringify(s));
  await page.screenshot({ path: `${OUT}step-${tag}.png` });
};

await tap(400, 500, 'drop1');
await tap(400, 500, 'drop2');
await tap(270, 752, 'start-climb');
await tap(105, 425, 'draft1');
await tap(105, 425, 'draft2');
await tap(105, 425, 'draft3');
await tap(105, 425, 'draft4');
await tap(105, 480, 'charm');
await tap(270, 895, 'menu');
await browser.close();
