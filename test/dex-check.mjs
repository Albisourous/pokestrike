import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 540, height: 960 } });
await p.goto('http://localhost:5173/?dev');
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/dex-title.png' });
await b.close();
