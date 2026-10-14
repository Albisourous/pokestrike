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
export const DAILY_BTN = { x: W / 2 - 140, y: 640, w: 280, h: 64 };
export const FREE_BTN = { x: W / 2 - 140, y: 720, w: 280, h: 64 };

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

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  t: number,
  best: number | null,
  streak: number,
  dailyDone: boolean,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'grove', t, { nx: 0.12, ny: 0.9 });

  ctx.textAlign = 'center';
  ctx.font = `bold 56px ${SERIF}`;
  ctx.fillStyle = '#f8d030';
  ctx.strokeStyle = '#2a3560';
  ctx.lineWidth = 8;
  ctx.strokeText('POKÉSTRIKE', W / 2, 250);
  ctx.fillText('POKÉSTRIKE', W / 2, 250);

  // gold rule lines flanking the tagline, conquest-style
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  for (const y of [288, 292]) {
    ctx.beginPath();
    ctx.moveTo(W / 2 - 170, y);
    ctx.lineTo(W / 2 + 170, y);
    ctx.stroke();
  }
  ctx.font = '16px system-ui';
  ctx.fillStyle = '#4a6238';
  ctx.fillText('pull back. launch. bounce.', W / 2, 278);

  // mini-arena diorama: the game in one frame
  const D = { x: 55, y: 320, w: 430, h: 280 };
  ctx.save();
  roundRect(ctx, D.x, D.y, D.w, D.h, 14);
  ctx.clip();
  drawBackdrop(ctx, D, 14, 'grove', t, null);
  // a sleeping Snorlax blocking the route + tall grass tufts
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(D.x + 352, D.y + 212, 42, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  drawMon(ctx, 143, D.x + 352, D.y + 178, 92, t); // Snorlax = the obstacle
  // grass patch: blades, not blobs
  ctx.strokeStyle = '#2c5a28';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bx = D.x + 90 + Math.cos(a) * 46;
    const by = D.y + 92 + Math.sin(a) * 34;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.quadraticCurveTo(bx, by - 13, bx + 4, by);
    ctx.stroke();
  }
  ctx.strokeStyle = '#58a848';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 14; i++) {
    const bx = D.x + 90 + (hashSeed(i * 7 + 1) - 0.5) * 70;
    const by = D.y + 92 + (hashSeed(i * 13 + 4) - 0.5) * 46;
    ctx.beginPath();
    ctx.moveTo(bx - 3, by);
    ctx.quadraticCurveTo(bx, by - 10, bx + 3, by);
    ctx.stroke();
  }
  drawMon(ctx, 43, D.x + 91, D.y + 65, 38, t); // Oddish in the grass
  // enemies with capture rings
  const foes: [number, number, number, number][] = [
    [94, D.x + 300, D.y + 80, 0.6],   // Gengar, 60% caught
    [66, D.x + 180, D.y + 60, 0.25],  // Machop
    [74, D.x + 360, D.y + 130, 0.85], // Geodude nearly caught
  ];
  for (const [id, fx, fy, pct] of foes) {
    const bob = Math.sin(t * 2.4 + fx) * 4;
    drawMon(ctx, id, fx, fy + bob, 48, t);
    ctx.strokeStyle = '#9df0ff';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(fx, fy + bob, 32, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // floating damage + combo text
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#ffd84d';
  ctx.fillText('24!', D.x + 300, D.y + 38 + Math.sin(t * 3) * 4);
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`COMBO ×${1 + Math.floor(t % 3)}`, D.x + 90, D.y + 30 + Math.sin(t * 2.2) * 4);
  // launched Pikachu: trail dots, dashed aim arc, styler rings
  const px = D.x + 110 + Math.sin(t * 1.4) * 30;
  const py = D.y + 200;
  ctx.fillStyle = '#f8d03088';
  for (let i = 1; i <= 5; i++) {
    ctx.globalAlpha = 0.6 - i * 0.1;
    ctx.beginPath();
    ctx.arc(px - i * 16, py + i * 7, 6 - i * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawMon(ctx, 25, px, py, 52, t);
  for (const [rr, sp] of [[34, 2], [42, -1.4]] as const) {
    ctx.strokeStyle = '#9df0ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = t * 50 * sp;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  ctx.restore();
  // gold frame over the diorama
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, D.x, D.y, D.w, D.h, 14);
  ctx.stroke();
  // the loop, in one line
  ctx.font = 'bold 13px system-ui';
  ctx.fillStyle = '#3c4c30';
  ctx.fillText('DRAFT  ·  LAUNCH  ·  COMBO  ·  CAPTURE  ·  RELICS', W / 2, 630);

  button(ctx, DAILY_BTN, dailyDone ? 'DAILY · CLEARED' : 'DAILY STRIKE', true);
  button(ctx, FREE_BTN, 'FREE PLAY', true);

  ctx.font = '16px system-ui';
  ctx.fillStyle = '#8890b8';
  const stats: string[] = [];
  if (streak > 0) stats.push(`streak ${streak}`);
  if (best !== null) stats.push(`best clear ${best.toFixed(1)}s`);
  ctx.fillText(stats.join('  ·  '), W / 2, 830);
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

    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 62, 88, t);

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
      drawMon(ctx, def.id, sx + 38, 692, 48, t);
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
  t: number,
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
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 26, 40, t);
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
    drawMon(ctx, def.id, r.x + r.w / 2, r.y + 32, 40, t);
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
