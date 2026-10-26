import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
await pg.goto('http://localhost:5173/?dev&seed=99');
await pg.waitForTimeout(1800);
await pg.mouse.click(480, 92); // close welcome manual
await pg.waitForTimeout(300);
await pg.mouse.click(270, 640); // START CLIMB
await pg.waitForTimeout(600);
for (let i = 0; i < 4; i++) { await pg.mouse.click(99, 378); await pg.waitForTimeout(1600); await pg.mouse.click(99, 378); await pg.waitForTimeout(400); }
await pg.mouse.click(99, 408); // charm
await pg.waitForTimeout(900);
// step to first stop
const stepMap = async () => {
  const kind = await pg.evaluate(() => {
    const b = window.__battle;
    if (b.phase !== 'map') return null;
    const region = b.region;
    const cur = region.nodes[b.mapNode];
    const li = cur.links[0];
    const n = region.nodes[li];
    const cell = 32, ox = (540 - 16 * cell) / 2, oy = 128;
    b.pointerDown({ x: ox + n.tx * cell + cell / 2, y: oy + (n.ty - b.mapCam) * cell + cell / 2 });
    return n.kind;
  });
  if (!kind) return null;
  await pg.waitForTimeout(1800);
  return kind;
};
console.log('stop:', await stepMap());
// wait for aim phase
for (let i = 0; i < 30; i++) {
  const ph = await pg.evaluate(() => window.__battle?.phase);
  if (ph === 'aim') break;
  await pg.waitForTimeout(400);
}
// tap a foe to open the inspect card
const foe = await pg.evaluate(() => {
  const b = window.__battle;
  const e = b.enemies.find((e) => !e.dead);
  return e ? { x: e.x, y: e.y } : null;
});
if (foe) { await pg.mouse.click(foe.x, foe.y); await pg.waitForTimeout(500); }
await pg.screenshot({ path: '/tmp/ps-inspect.png' });
// open the TEAM·ITEMS panel from the map? need map phase — first fight through
for (let i = 0; i < 60; i++) {
  const st = await pg.evaluate(() => {
    const b = window.__battle;
    if (!b) return { phase: 'none' };
    const out = { phase: b.phase };
    if (b.phase === 'aim') {
      const u = b.active;
      const foes = b.enemies.filter((e) => !e.dead);
      if (u && foes.length) {
        let f = foes[0], bd = 1e9;
        for (const e of foes) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; f = e; } }
        Object.assign(out, { ux: u.x, uy: u.y, fx: f.x, fy: f.y });
      }
    }
    return out;
  });
  if (st.phase === 'aim' && st.ux) {
    const dx = st.fx - st.ux, dy = st.fy - st.uy;
    const d = Math.hypot(dx, dy) || 1;
    await pg.mouse.move(st.ux, st.uy);
    await pg.mouse.down();
    await pg.mouse.move(st.ux - (dx / d) * 200, st.uy - (dy / d) * 200, { steps: 8 });
    await pg.mouse.up();
    await pg.waitForTimeout(1800);
  } else if (st.phase === 'reward') {
    await pg.screenshot({ path: '/tmp/ps-reward2.png' });
    await pg.mouse.click(270, 892); // TEAM · ITEMS pill
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: '/tmp/ps-teamitems.png' });
    break;
  } else await pg.waitForTimeout(500);
}
await browser.close();
console.log('done');
