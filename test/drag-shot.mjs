import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
await pg.goto('http://localhost:5173/?dev&seed=99');
await pg.waitForTimeout(1800);
await pg.mouse.click(270, 772);
await pg.waitForTimeout(600);
for (let i = 0; i < 4; i++) { await pg.mouse.click(105, 425); await pg.waitForTimeout(300); }
await pg.mouse.click(105, 480);
await pg.waitForTimeout(1000);
// walk to first linked stop
await pg.evaluate(() => {
  const b = window.__battle;
  const region = b.region;
  const cur = region.nodes[b.mapNode];
  const n = region.nodes[cur.links[0]];
  const cell = 32, ox = (540 - 16 * cell) / 2, oy = 128;
  b.pointerDown({ x: ox + n.tx * cell + 16, y: oy + (n.ty - b.mapCam) * cell + 16 });
});
await pg.waitForTimeout(2500);
// wait for aim then drag toward nearest foe
for (let i = 0; i < 30; i++) {
  const st = await pg.evaluate(() => {
    const b = window.__battle;
    if (b.phase !== 'aim') return { phase: b.phase };
    const u = b.active, foes = b.enemies.filter((e) => !e.dead);
    if (!u || !foes.length) return { phase: b.phase };
    let f = foes[0], bd = 1e9;
    for (const e of foes) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; f = e; } }
    return { phase: b.phase, ux: u.x, uy: u.y, fx: f.x, fy: f.y };
  });
  if (st.phase === 'aim' && st.ux !== undefined) {
    const dx = st.fx - st.ux, dy = st.fy - st.uy;
    const d = Math.hypot(dx, dy) || 1;
    await pg.mouse.move(st.ux, st.uy);
    await pg.mouse.down();
    await pg.mouse.move(st.ux - (dx / d) * 200, st.uy - (dy / d) * 200, { steps: 10 });
    await pg.waitForTimeout(500); // let the charge ring fill mid-sweep
    await pg.screenshot({ path: '/tmp/ps-ring.png' });
    await pg.mouse.up();
    break;
  }
  await pg.waitForTimeout(500);
}
await browser.close();
console.log('done');
