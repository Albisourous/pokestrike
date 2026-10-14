import { itemSprite, drawMon } from '../core/assets';
import { SpeciesDef } from './data';
import { drawBackdrop, hash as hashSeed } from './bg';
import { TYPE_COLOR } from './types';
import { bumpIsPhysical, roleOf, ROLE_BLURB, TYPE_MOVE } from './stats';

export const W = 540;
export const H = 960;

export interface RunResult {
  won: boolean;
  shots: number;
  time: number;
  caught: number;
}

// --- draft layout: 3 offer cards, team strip at the bottom ---

const CARD_W = 150;
const CARD_H = 250;
const CARD_GAP = 15;
const CARDS_X = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
const CARDS_Y = 300;

export function draftCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: CARDS_Y, w: CARD_W, h: CARD_H };
}

export const RETRY_BTN = { x: W / 2 - 110, y: 620, w: 220, h: 64 };
export const SHARE_BTN = { x: W / 2 - 110, y: 700, w: 220, h: 54 };
export const FREE_BTN = { x: W / 2 - 140, y: 680, w: 280, h: 64 };

export const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// relic reward cards reuse the draft card spacing
export function perkCardRect(i: number) {
  return { x: CARDS_X + i * (CARD_W + CARD_GAP), y: 380, w: CARD_W, h: 200 };
}
export function boxSlotRect(i: number, n: number) {
  const w = 56, gap = 10;
  return { x: W / 2 - (n * (w + gap) - gap) / 2 + i * (w + gap), y: 640, w, h: 56 };
}
export function teamSlotRect(i: number) {
  const w = 100, gap = 14;
  return { x: W / 2 - (4 * (w + gap) - gap) / 2 + i * (w + gap), y: 772, w, h: 70 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Conquest-style chrome: dark indigo panel, gold double border, serif text.
const GOLD = '#c8a44d';
const PARCH = '#f0e6c8';
const SERIF = 'Georgia, "Times New Roman", serif';

function trim(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, rad: number) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.stroke();
  ctx.strokeStyle = '#c8a44d55';
  ctx.lineWidth = 1;
  roundRect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(rad - 4, 2));
  ctx.stroke();
}

function button(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, on: boolean) {
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = on ? '#1b2140' : '#12152b';
  ctx.fill();
  trim(ctx, r, 10);
  ctx.font = `bold 21px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? PARCH : '#6a7090';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 7);
}

// --- title screen: grass field, pokeball crest, arced fan-logo wordmark ---

const TITLE_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

// Mons standing the ring around the logo — all ids are in ALL_SPRITE_IDS.
const RING_MONS: [number, number][] = [
  [143, 78], // Snorlax anchors the top
  [149, 56], [6, 58], [130, 62], [150, 58], [94, 50],
  [76, 54], [3, 56], [9, 54], [68, 54], [59, 56], [131, 56],
];

// Wild mons roaming the field edges — the PokéSurvivor "alive world" feel.
// [id, anchorX, anchorY, wander range]
const WILD_MONS: [number, number, number, number][] = [
  [19, 80, 120, 26],   // Rattata skitters top-left
  [16, 470, 110, 30],  // Pidgey hops top-right
  [43, 70, 560, 22],   // Oddish pokes up mid-left
  [52, 480, 580, 24],  // Meowth prowls mid-right
  [41, 500, 300, 20],  // Zubat flaps by the ring
];

function drawField(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#57a53e');
  g.addColorStop(0.55, '#4d9a37');
  g.addColorStop(1, '#3c7f2b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // mowing stripes
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 175, W, 88);
  // speckles and tufts
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,50,0,0.10)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(hashSeed(i * 31 + 7) * W, hashSeed(i * 57 + 3) * H, 2.5, 2.5);
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.4, 140, W / 2, H * 0.4, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,30,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawSparkles(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 14; i++) {
    const s = 5 + hashSeed(i * 13) * 6;
    ctx.save();
    ctx.translate(hashSeed(i * 97 + 11) * W, hashSeed(i * 61 + 29) * H);
    ctx.rotate(t * 0.8 + i);
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + i * 2.1));
    ctx.fillStyle = '#ffe86b';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.22, -s * 0.22);
      ctx.lineTo(0, -s);
      ctx.lineTo(-s * 0.22, -s * 0.22);
      ctx.closePath();
      ctx.rotate(Math.PI / 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawRingLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, t: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = t * 20;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRingMons(ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number, rx: number, ry: number) {
  RING_MONS.forEach(([id, size], i) => {
    const a = -Math.PI / 2 + (i / RING_MONS.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.38, size * 0.42, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    drawMon(ctx, id, x, y + Math.sin(t * 2 + i * 1.7) * 3 - size * 0.05, size);
  });
}

function drawCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.92, r * 0.95, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  // lower half
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#f4f4f8';
  ctx.fill();
  // upper half
  const rg = ctx.createLinearGradient(0, cy - r, 0, cy);
  rg.addColorStop(0, '#ff7070');
  rg.addColorStop(1, '#d82020');
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = rg;
  ctx.fill();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.45, cy - r * 0.6, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // band, rim, button
  ctx.fillStyle = '#20203a';
  ctx.fillRect(cx - r, cy - r * 0.085, r * 2, r * 0.17);
  ctx.lineWidth = r * 0.05;
  ctx.strokeStyle = '#20203a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#20203a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// Letters fan out along a dipped baseline — the classic fan-logo look.
function logoWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseY: number,
  size: number,
  dip: number,
  tilt: number,
) {
  ctx.save();
  ctx.font = `900 ${size}px ${TITLE_FONT}`;
  const chars = [...text];
  const gap = size * 0.04;
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  const x0 = cx - total / 2;
  let x = x0;
  chars.forEach((ch, i) => {
    const t01 = total ? (x + widths[i] / 2 - x0) / total : 0.5;
    ctx.save();
    ctx.translate(x, baseY + Math.pow(Math.abs(2 * t01 - 1), 1.4) * dip);
    ctx.rotate((t01 - 0.5) * tilt);
    ctx.transform(1, 0, -0.14, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.18;
    ctx.strokeStyle = '#20386e';
    ctx.strokeText(ch, 0, 0);
    const lg = ctx.createLinearGradient(0, -size, 0, 0);
    lg.addColorStop(0, '#fff3a0');
    lg.addColorStop(0.45, '#ffcb05');
    lg.addColorStop(1, '#f09c1c');
    ctx.fillStyle = lg;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += widths[i] + gap;
  });
  ctx.restore();
}

// Wild mons drift around their anchor in a lazy lissajous — never leaves
// the anchor's range, deterministic, zero state.
function drawWildMons(ctx: CanvasRenderingContext2D, t: number) {
  WILD_MONS.forEach(([id, ax, ay, range], i) => {
    const x = ax + Math.sin(t * 0.5 + i * 2.3) * range;
    const y = ay + Math.sin(t * 0.7 + i * 1.4) * range * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawMon(ctx, id, x, y + Math.sin(t * 3 + i) * 2, 34);
  });
}

export function drawTitle(ctx: CanvasRenderingContext2D, t: number, best: number | null) {
  drawField(ctx);
  drawSparkles(ctx, t);
  drawWildMons(ctx, t);

  const cx = W / 2;
  const cy = 350;
  drawRingLine(ctx, cx, cy + 12, 214, 180, t);
  drawCrest(ctx, cx, cy, 140);
  drawRingMons(ctx, t, cx, cy + 12, 214, 180);

  ctx.textAlign = 'center';
  logoWord(ctx, 'POKÉ', cx, cy - 52, 42, 7, 0.4);
  logoWord(ctx, 'STRIKE', cx, cy + 112, 88, 15, 0.5);

  ctx.font = `italic 19px ${SERIF}`;
  ctx.fillStyle = PARCH;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 5;
  ctx.fillText('pull back. launch. bounce.', cx, 618);
  ctx.shadowBlur = 0;

  // the loop, in one line
  ctx.font = 'bold 13px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.fillText('DRAFT  ·  LAUNCH  ·  COMBO  ·  CAPTURE  ·  RELICS', cx, 650);
  ctx.shadowBlur = 0;

  button(ctx, FREE_BTN, 'FREE PLAY', true);

  ctx.font = '16px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  if (best !== null) ctx.fillText(`best clear ${best.toFixed(1)}s`, cx, 830);
  ctx.shadowBlur = 0;
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6);

  ctx.textAlign = 'center';
  ctx.font = `bold 34px ${SERIF}`;
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`DRAFT — PICK ${picked.length + 1} OF 4`, W / 2, 120);
  ctx.font = '17px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText(stageName, W / 2, 155);
  ctx.fillText('one of three — choose for coverage and speed', W / 2, 180);

  offers.forEach((def, i) => {
    const r = draftCardRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    trim(ctx, r, 10);
    // type ribbon across the top of the card
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, 5);

    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 62, 88);

    ctx.font = `bold 16px ${SERIF}`;
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 128);
    const role = roleOf(def.stats, def.healer);
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${role.toUpperCase()}`, r.x + r.w / 2, r.y + 146);

    // role tagline + what the super does — no raw stats
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#a8b0d8';
    ctx.fillText(ROLE_BLURB[role], r.x + r.w / 2, r.y + 178);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(TYPE_MOVE[def.type], r.x + r.w / 2, r.y + 198);
    ctx.fillText(
      bumpIsPhysical(def.type) ? 'rolls Attack' : 'rolls Sp. Atk',
      r.x + r.w / 2,
      r.y + 218,
    );
  });

  // picked team strip
  ctx.font = '13px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 640);
  for (let i = 0; i < 4; i++) {
    const sx = W / 2 - 4 * 44 + i * 88;
    roundRect(ctx, sx, 660, 76, 90, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 1;
    ctx.stroke();
    const def = picked[i];
    if (def) {
      drawMon(ctx, def.id, sx + 38, 692, 48);
      ctx.font = `10px ${SERIF}`;
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name, sx + 38, 740);
    }
  }

  ctx.font = '14px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('tip: bounce off allies to trigger their attack', W / 2, 810);
}

export interface ShareGrid {
  waves: string; // emoji squares, one per wave
  team: string; // emoji squares, one per drafted mon
  copied: boolean;
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  offers: { name: string; item: string; desc: string }[],
  depth: number,
  box: SpeciesDef[],
  team: SpeciesDef[],
  selBox: number,
  swapped: boolean,
  catchPct: number,
) {
  ctx.fillStyle = '#0b0e1ad8';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = `bold 36px ${SERIF}`;
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE A RELIC', W / 2, 300);
  ctx.font = '16px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText(depth > 0 ? `depth ${depth + 1} — the waves get meaner` : 'the stage is not done with you', W / 2, 335);

  offers.forEach((perk, i) => {
    const r = perkCardRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    trim(ctx, r, 10);
    ctx.fillStyle = GOLD;
    ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, 5);

    // item sprite on a gold-rimmed plinth
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + 66, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const img = itemSprite(perk.item);
    if (img) ctx.drawImage(img, r.x + r.w / 2 - 21, r.y + 45, 42, 42);
    else {
      ctx.font = '24px system-ui';
      ctx.fillStyle = PARCH;
      ctx.fillText('?', r.x + r.w / 2, r.y + 74);
    }
    ctx.font = `bold 15px ${SERIF}`;
    ctx.fillStyle = PARCH;
    ctx.fillText(perk.name, r.x + r.w / 2, r.y + 118);
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#a8b0d8';
    // two-line desc
    const words = perk.desc.split(' ');
    const mid = Math.ceil(words.length / 2);
    ctx.fillText(words.slice(0, mid).join(' '), r.x + r.w / 2, r.y + 150);
    ctx.fillText(words.slice(mid).join(' '), r.x + r.w / 2, r.y + 168);
  });

  // captured box — tap a catch, then a teammate, to swap (once per break)
  ctx.font = 'bold 14px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX — catch rate ${Math.round(catchPct * 100)}%`, W / 2, 620);
  if (box.length === 0) {
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#5a6284';
    ctx.fillText('nothing caught yet — defeats sometimes capture', W / 2, 668);
  }
  box.forEach((def, i) => {
    const r = boxSlotRect(i, box.length);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = i === selBox ? '#ffd84d' : '#2a3560';
    ctx.lineWidth = i === selBox ? 2.5 : 1;
    ctx.stroke();
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 26, 40);
    ctx.font = '9px system-ui';
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, r.y + 52);
  });

  ctx.font = 'bold 14px system-ui';
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 750);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = selBox >= 0 && !swapped ? GOLD : '#2a3560';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, 3);
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 32, 40);
    ctx.font = '9px system-ui';
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.slice(0, 12), r.x + r.w / 2, r.y + 64);
  });
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#5a6284';
  ctx.fillText(
    swapped ? 'swap used' : selBox >= 0 ? 'tap a teammate to swap in' : 'tap a box mon, then a teammate — once per break',
    W / 2,
    880,
  );
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  res: RunResult,
  best: number | null,
  extra: string | null,
  share: ShareGrid | null,
) {
  ctx.fillStyle = '#0b0e1add';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = `bold 52px ${SERIF}`;
  ctx.fillStyle = res.won ? '#6fdc6f' : '#ff6b6b';
  ctx.fillText(res.won ? 'STAGE CLEAR!' : 'WIPED OUT', W / 2, 300);

  ctx.font = '20px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText(
    `${res.shots} shots · ${res.time.toFixed(1)}s${res.caught ? ` · ${res.caught} caught` : ''}`,
    W / 2,
    355,
  );
  if (extra) {
    ctx.font = 'bold 20px system-ui';
    ctx.fillStyle = '#f8d030';
    ctx.fillText(extra, W / 2, 395);
  } else if (res.won && best !== null) {
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`best: ${best.toFixed(1)}s`, W / 2, 390);
  }

  if (share) {
    ctx.font = '30px system-ui';
    ctx.fillText(share.waves, W / 2, 465);
    ctx.font = '24px system-ui';
    ctx.fillText(share.team, W / 2, 510);
  }

  button(ctx, RETRY_BTN, 'PLAY AGAIN', true);
  button(ctx, SHARE_BTN, share?.copied ? 'COPIED!' : 'SHARE RESULT', true);
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, waves: number, shots: number, stageName: string) {
  ctx.fillStyle = '#8890b8';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(stageName, 30, 44);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(wave + 1 === waves ? 'BOSS' : `WAVE ${wave + 1}/${waves}`, W / 2, 44);
  ctx.textAlign = 'right';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
}
