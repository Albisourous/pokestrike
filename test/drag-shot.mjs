import { chromium } from 'playwright';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
const shot = (n) => pg.screenshot({ path: `/tmp/ps2-${n}.png` });
await pg.goto('http://localhost:5173/?dev&seed=99');
await pg.waitForTimeout(1800);
await pg.mouse.click(270, 772);
await pg.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await pg.mouse.click(105, 425); await pg.waitForTimeout(250); }
await pg.mouse.click(105, 480);
await pg.waitForTimeout(1000);

const stepMap = async () => pg.evaluate(() => {
  const b = window.__battle;
  if (b.phase !== 'map') return null;
  const region = b.region;
  const cur = region.nodes[b.mapNode];
  const n = region.nodes[cur.links[0]];
  const cell = 32, ox = (540 - 16 * cell) / 2, oy = 128;
  b.pointerDown({ x: ox + n.tx * cell + 16, y: oy + (n.ty - b.mapCam) * cell + 16 });
  return n.kind;
});

await stepMap();
await pg.waitForTimeout(2000);

// wait for aim
for (let i = 0; i < 30; i++) {
  const ph = await pg.evaluate(() => window.__battle.phase);
  if (ph === 'aim') break;
  await pg.waitForTimeout(400);
}

// scout card: tap (no pull) the nearest foe
const foe = await pg.evaluate(() => {
  const b = window.__battle;
  const f = b.enemies.filter((e) => !e.dead)[0];
  return f ? { x: f.x, y: f.y } : null;
});
if (foe) {
  await pg.mouse.click(foe.x, foe.y);
  await pg.waitForTimeout(300);
  await shot('01-scout-foe');
}

// pause overlay
await pg.keyboard.press('p');
await pg.waitForTimeout(300);
await shot('02-pause');
await pg.keyboard.press('p');
await pg.waitForTimeout(200);

// teammate scout
const mate = await pg.evaluate(() => {
  const b = window.__battle;
  const m = b.players.filter((p) => !p.dead && p !== b.active)[0];
  return m ? { x: m.x, y: m.y } : null;
});
if (mate) {
  await pg.mouse.click(mate.x, mate.y);
  await pg.waitForTimeout(300);
  await shot('03-scout-mate');
}

// force-clear the fight to reach reward + map + next fight
for (let i = 0; i < 25; i++) {
  const st = await pg.evaluate(() => {
    const b = window.__battle;
    if (b.phase === 'aim') {
      for (const e of b.enemies) if (!e.dead) e.hp = 1;
      const u = b.active, foes = b.enemies.filter((e) => !e.dead);
      if (!u || !foes.length) return { phase: b.phase };
      return { phase: b.phase, ux: u.x, uy: u.y, fx: foes[0].x, fy: foes[0].y };
    }
    return { phase: b.phase };
  });
  if (st.phase === 'reward') { await shot('04-reward'); await pg.mouse.click(270, 460); await pg.waitForTimeout(500); continue; }
  if (st.phase === 'map') { await shot('05-map'); await stepMap(); await pg.waitForTimeout(1800); continue; }
  if (st.phase === 'aim' && st.ux !== undefined) {
    const dx = st.fx - st.ux, dy = st.fy - st.uy, d = Math.hypot(dx, dy) || 1;
    await pg.mouse.move(st.ux, st.uy);
    await pg.mouse.down();
    await pg.mouse.move(st.ux - (dx / d) * 200, st.uy - (dy / d) * 200, { steps: 6 });
    await pg.mouse.up();
    await pg.waitForTimeout(2000);
    continue;
  }
  if (st.phase === 'won' || st.phase === 'lost') { await shot('06-result'); break; }
  await pg.waitForTimeout(400);
}

// force a loss to see the result/killer line
await pg.evaluate(() => {
  const b = window.__battle;
  if (b.phase === 'aim') {
    for (const p of b.players) { p.hp = 1; }
    for (const e of b.enemies) if (!e.dead) e.timer = 0;
  }
});
await pg.waitForTimeout(4000);
await shot('07-late');
await browser.close();
console.log('done');
