import { chromium } from 'playwright';

const OUT = '/tmp/ps';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 540, height: 960 } });
const shot = (n) => pg.screenshot({ path: `${OUT}-${n}.png` });
const sleep = (ms) => pg.waitForTimeout(ms);

await pg.goto('http://localhost:5173/?dev&seed=99');
await sleep(1800);
await shot('01-title');

await pg.keyboard.press('?');
await sleep(400);
await shot('02-help-p1');
await pg.keyboard.press('ArrowRight');
await pg.keyboard.press('ArrowRight');
await sleep(400);
await shot('03-help-p3');
await pg.keyboard.press('Escape');
await sleep(300);

await pg.mouse.click(270, 772); // START CLIMB
await sleep(600);
await shot('04-draft');

for (let i = 0; i < 4; i++) {
  await pg.mouse.click(105, 425);
  await sleep(350);
}
await shot('05-drafted');

await sleep(400);
await pg.mouse.click(105, 480); // charm: left perk card
await sleep(800);
await shot('06-map');

// walk to the first linked stop — same cell math drawRegion/pointerDown use
const stepMap = async () => {
  const node = await pg.evaluate(() => {
    const b = window.__battle;
    if (b.phase !== 'map') return null;
    const region = b.region;
    const cur = region.nodes[b.mapNode];
    const n = region.nodes[cur.links[0]];
    return { x: 7 + n.tx * 58 + 29, y: 34 + (n.ty - b.mapCam) * 58 + 29, kind: n.kind };
  });
  if (!node) return null;
  await pg.mouse.click(node.x, node.y);
  await sleep(1600); // lead mon walks the route
  return node.kind;
};

const kind = await stepMap();
console.log('first stop:', kind);

// battle loop: wait for aim, screenshot coach, fire real shots
for (let i = 0; i < 40; i++) {
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

  if (st.phase === 'aim' && st.ux !== undefined) {
    if (i === 0) await shot('07-coach'); // ghost drag on the first-ever shot
    const dx = st.fx - st.ux, dy = st.fy - st.uy;
    const d = Math.hypot(dx, dy) || 1;
    await pg.mouse.move(st.ux, st.uy);
    await pg.mouse.down();
    await pg.mouse.move(st.ux - (dx / d) * 200, st.uy - (dy / d) * 200, { steps: 8 });
    if (i === 0) await shot('08-dragging');
    await pg.mouse.up();
    await sleep(1800);
    if (i === 0) await shot('09-after-shot');
  } else if (st.phase === 'map') {
    await shot('10-map-next');
    await stepMap();
  } else if (st.phase === 'reward') {
    await shot('11-reward');
    await pg.mouse.click(270, 460);
    await sleep(600);
  } else if (st.phase === 'won' || st.phase === 'lost') {
    await shot('12-result');
    break;
  } else {
    await sleep(500);
  }
}

await browser.close();
console.log('done');
