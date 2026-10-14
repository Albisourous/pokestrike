import { itemSprite, drawMon } from '../core/assets';
import { SpeciesDef } from './data';
import { RARITY_COLOR } from './perks';
import type { Rarity } from './perks';
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
  badges: { name: string; rarity: Rarity }[];
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
  ctx.font = `13px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = on ? PARCH : '#6a7090';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 5);
}

// --- title screen: grass field, pokeball crest, arced fan-logo wordmark ---

export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

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
  // base grass — deep meadow gradient, no tiles, no grid
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4f9c38');
  g.addColorStop(0.5, '#459233');
  g.addColorStop(1, '#357a27');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // large mottled tone patches — organic meadow, not a mowed lawn
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(16,72,16,0.10)';
    ctx.beginPath();
    ctx.ellipse(
      hashSeed(i * 13 + 2) * W,
      hashSeed(i * 29 + 7) * H,
      60 + hashSeed(i * 41) * 120,
      40 + hashSeed(i * 53) * 90,
      hashSeed(i * 3) * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // worn dirt patches — battle-scarred spots near the edges
  for (let i = 0; i < 4; i++) {
    const dx = 40 + hashSeed(i * 97) * 460;
    const dy = 60 + hashSeed(i * 83) * 840;
    const drx = 30 + hashSeed(i * 31) * 45;
    const dry = 18 + hashSeed(i * 17) * 25;
    ctx.fillStyle = 'rgba(122,86,46,0.55)';
    ctx.beginPath();
    ctx.ellipse(dx, dy, drx, dry, hashSeed(i * 7) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(148,110,64,0.5)';
    ctx.beginPath();
    ctx.ellipse(dx - drx * 0.15, dy - dry * 0.15, drx * 0.6, dry * 0.6, hashSeed(i * 7) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // grass tufts: little 3-blade clusters scattered everywhere
  ctx.strokeStyle = '#2e6420';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 110; i++) {
    const x = hashSeed(i * 31 + 7) * W;
    const y = hashSeed(i * 57 + 3) * H;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(x + b * 2.5, y);
      ctx.lineTo(x + b * 3.5, y - (b === 0 ? 6 : 4));
      ctx.stroke();
    }
  }

  // wildflowers + pebble speckles
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = ['#ffffff', '#ffe86b', '#ffb8d0'][i % 3];
    ctx.fillRect(hashSeed(i * 61 + 19) * W, hashSeed(i * 43 + 11) * H, 2.5, 2.5);
  }
  ctx.fillStyle = 'rgba(0,50,0,0.12)';
  for (let i = 0; i < 50; i++) {
    ctx.fillRect(hashSeed(i * 67 + 5) * W, hashSeed(i * 71 + 13) * H, 2.5, 2.5);
  }

  // overworld props at the edges — real extracted metatiles
  const prop = (name: string, x: number, y: number, s: number) => {
    const img = itemSprite(name);
    if (!img) return;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.34, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x - s / 2, y - s / 2, s, (s * img.height) / img.width);
    ctx.restore();
  };
  prop('tree', 36, 250, 64);
  prop('tree', 506, 250, 64);
  prop('rock', 56, 832, 46);
  prop('tree', 108, 846, 40);
  prop('pond', 464, 792, 104);

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

// Pixel wordmark — chunky font with a hard offset shadow, fan-game style.
// Shrinks to fit maxW so it never runs off the field.
function logoWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseY: number,
  size: number,
  maxW: number,
  fill = '#ffcb05',
  shade = '#1e3260',
) {
  ctx.save();
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.max(8, Math.floor(size * (maxW / w)));
    ctx.font = `${size}px ${PIXEL_FONT}`;
  }
  const off = Math.max(3, Math.round(size * 0.14));
  ctx.fillStyle = shade;
  ctx.fillText(text, cx + off, baseY + off);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, baseY);
  ctx.restore();
}

// Small pixel UI text — tagline, captions, stats.
function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseY: number,
  size: number,
  color = '#f0e6c8',
) {
  ctx.save();
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(text, cx + 2, baseY + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, cx, baseY);
  ctx.restore();
}

const SKIN_TONES = ['#f0c8a0', '#e0a878', '#b87b50', '#8a5a38', '#ffd9b8'];
const CROWD_SHIRTS = ['#e05050', '#e0a030', '#50b060', '#4090d0', '#8050c0', '#d060a0', '#50c0b0', '#e0e0e0', '#d0d040'];

// A block of tiny spectators — body square + head square, some heads bob.
// `railOnTop` flips the barrier for the bottom stands (rail faces the field).
function drawCrowd(ctx: CanvasRenderingContext2D, y0: number, h: number, t: number, railOnTop: boolean) {
  ctx.fillStyle = '#0e1024';
  ctx.fillRect(0, y0, W, h);
  for (let r = 0; r < 4; r++) {
    const y = y0 + 5 + r * 12;
    for (let x = 5 + (r % 2) * 7, i = 0; x < W - 8; x += 13, i++) {
      if (hashSeed(r * 101 + i * 7) < 0.08) continue; // empty seat
      ctx.fillStyle = CROWD_SHIRTS[Math.floor(hashSeed(r * 53 + i * 13) * CROWD_SHIRTS.length)];
      ctx.fillRect(x, y + 4, 10, 7);
      const bob = hashSeed(i * 29 + r) < 0.18 ? Math.round(Math.sin(t * 3 + i * 0.7) * 1.5) : 0;
      ctx.fillStyle = SKIN_TONES[Math.floor(hashSeed(r * 71 + i * 17) * SKIN_TONES.length)];
      ctx.fillRect(x + 2, y + bob, 6, 5);
      if (hashSeed(i * 37 + r * 11) < 0.22) {
        // trainer cap — brim + crown over the head
        ctx.fillStyle = CROWD_SHIRTS[Math.floor(hashSeed(i * 43 + r * 7) * CROWD_SHIRTS.length)];
        ctx.fillRect(x + 1, y + bob - 2, 8, 3);
      }
    }
  }
  ctx.fillStyle = '#343a70';
  ctx.fillRect(0, railOnTop ? y0 : y0 + 56, W, 3);
}

// Stadium frame: night sky + floodlight towers on top, packed stands above
// and below the field — the Pokémon Arena crowd look.
function drawStands(ctx: CanvasRenderingContext2D, t: number) {
  const s = ctx.createLinearGradient(0, 0, 0, 80);
  s.addColorStop(0, '#070b22');
  s.addColorStop(1, '#141a44');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, W, 80);
  for (let i = 0; i < 46; i++) {
    const a = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.4 + i * 1.7));
    ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(2)})`;
    ctx.fillRect(hashSeed(i * 11) * W, hashSeed(i * 19) * 74, 2, 2);
  }
  for (const sx of [16, 476]) {
    ctx.fillStyle = '#141736';
    ctx.fillRect(sx, 10, 48, 44);
    ctx.strokeStyle = '#3a3f78';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, 10, 48, 44);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = 'rgba(255,255,230,0.85)';
        ctx.fillRect(sx + 6 + c * 10, 16 + r * 12, 6, 6);
      }
  }
  drawCrowd(ctx, 80, 59, t, false);
  drawCrowd(ctx, 872, H - 872, t, true);
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
  drawStands(ctx, t);
  drawSparkles(ctx, t);
  drawWildMons(ctx, t);

  const cx = W / 2;
  const cy = 300;
  drawRingLine(ctx, cx, cy + 8, 210, 168, t);
  drawCrest(ctx, cx, cy, 132);
  drawRingMons(ctx, t, cx, cy + 8, 210, 168);

  ctx.textAlign = 'center';
  // the ball IS the logo: POKÉ on the red half, STRIKE on the white —
  // same size, symmetric about the band so they read as one wordmark
  logoWord(ctx, 'POKÉ', cx, cy - 56, 28, 165);
  logoWord(ctx, 'STRIKE', cx, cy + 84, 28, 170, '#22336a', '#c8d0e8');

  button(ctx, FREE_BTN, 'FREE PLAY', true);

  if (best !== null) pixelText(ctx, `best clear ${best.toFixed(1)}s`, cx, 812, 9);
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  offers: SpeciesDef[],
  picked: SpeciesDef[],
  stageName: string,
  t: number,
) {
  drawBackdrop(ctx, { x: 0, y: 0, w: W, h: H }, 0, 'sky', t * 0.6, { nx: 0.08, ny: 0.05 });

  ctx.textAlign = 'center';
  ctx.font = `18px ${PIXEL_FONT}`;
  ctx.fillStyle = '#f8d030';
  ctx.fillText(`DRAFT — PICK ${picked.length + 1} OF 4`, W / 2, 120);
  ctx.font = `9px ${PIXEL_FONT}`;
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

    ctx.font = `11px ${PIXEL_FONT}`;
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 128);
    const role = roleOf(def.stats, def.healer);
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(`${def.type.toUpperCase()} · ${role.toUpperCase()}`, r.x + r.w / 2, r.y + 146);

    // role tagline + what the super does — no raw stats
    ctx.font = `7px ${PIXEL_FONT}`;
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
  ctx.font = `9px ${PIXEL_FONT}`;
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
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.fillStyle = PARCH;
      ctx.fillText(def.name, sx + 38, 740);
    }
  }

  ctx.font = `8px ${PIXEL_FONT}`;
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
  offers: { name: string; item: string; desc: string; rarity: Rarity }[],
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
  ctx.font = `20px ${PIXEL_FONT}`;
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE A RELIC', W / 2, 300);
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.fillStyle = '#8890b8';
  ctx.fillText(depth > 0 ? `depth ${depth + 1} — the waves get meaner` : 'the stage is not done with you', W / 2, 335);

  offers.forEach((perk, i) => {
    const r = perkCardRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    trim(ctx, r, 10);
    ctx.fillStyle = RARITY_COLOR[perk.rarity];
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
      ctx.font = `16px ${PIXEL_FONT}`;
      ctx.fillStyle = PARCH;
      ctx.fillText('?', r.x + r.w / 2, r.y + 74);
    }
    ctx.font = `9px ${PIXEL_FONT}`;
    ctx.fillStyle = PARCH;
    ctx.fillText(perk.name, r.x + r.w / 2, r.y + 118);
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.fillStyle = RARITY_COLOR[perk.rarity];
    ctx.fillText(perk.rarity.toUpperCase(), r.x + r.w / 2, r.y + 134);
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.fillStyle = '#a8b0d8';
    // two-line desc
    const words = perk.desc.split(' ');
    const mid = Math.ceil(words.length / 2);
    ctx.fillText(words.slice(0, mid).join(' '), r.x + r.w / 2, r.y + 150);
    ctx.fillText(words.slice(mid).join(' '), r.x + r.w / 2, r.y + 168);
  });

  // captured box — tap a catch, then a teammate, to swap (once per break)
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX — catch rate ${Math.round(catchPct * 100)}%`, W / 2, 620);
  if (box.length === 0) {
    ctx.font = `7px ${PIXEL_FONT}`;
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
    ctx.font = `6px ${PIXEL_FONT}`;
    ctx.fillStyle = TYPE_COLOR[def.type];
    ctx.fillText(def.name.slice(0, 9), r.x + r.w / 2, r.y + 52);
  });

  ctx.font = `9px ${PIXEL_FONT}`;
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
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.fillStyle = PARCH;
    ctx.fillText(def.name.slice(0, 12), r.x + r.w / 2, r.y + 64);
  });
  ctx.font = `7px ${PIXEL_FONT}`;
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
  ctx.font = `26px ${PIXEL_FONT}`;
  ctx.fillStyle = res.won ? '#6fdc6f' : '#ff6b6b';
  ctx.fillText(res.won ? 'STAGE CLEAR!' : 'WIPED OUT', W / 2, 300);

  ctx.font = `10px ${PIXEL_FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(
    `${res.shots} shots · ${res.time.toFixed(1)}s${res.caught ? ` · ${res.caught} caught` : ''}`,
    W / 2,
    355,
  );
  if (extra) {
    ctx.font = `11px ${PIXEL_FONT}`;
    ctx.fillStyle = '#f8d030';
    ctx.fillText(extra, W / 2, 395);
  } else if (res.won && best !== null) {
    ctx.font = `9px ${PIXEL_FONT}`;
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`best: ${best.toFixed(1)}s`, W / 2, 390);
  }

  // run badges — rarity-colored chips, up to two rows
  const badgeRows: { name: string; rarity: Rarity }[][] = [[]];
  for (const b of res.badges) {
    const row = badgeRows[badgeRows.length - 1];
    if (row.length >= 4) badgeRows.push([b]);
    else row.push(b);
  }
  badgeRows.forEach((row, ri) => {
    const y = 428 + ri * 28;
    ctx.font = `7px ${PIXEL_FONT}`;
    const ws = row.map((b) => ctx.measureText(b.name).width + 20);
    let bx = W / 2 - (ws.reduce((a, c) => a + c, 0) + (row.length - 1) * 8) / 2;
    row.forEach((b, i) => {
      roundRect(ctx, bx, y, ws[i], 20, 5);
      ctx.fillStyle = '#12162b';
      ctx.fill();
      ctx.strokeStyle = RARITY_COLOR[b.rarity];
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.fillStyle = RARITY_COLOR[b.rarity];
      ctx.fillText(b.name, bx + ws[i] / 2, y + 14);
      bx += ws[i] + 8;
    });
  });

  if (share) {
    const sy = 460 + badgeRows.length * 28;
    ctx.font = '30px system-ui';
    ctx.fillText(share.waves, W / 2, sy);
    ctx.font = '24px system-ui';
    ctx.fillText(share.team, W / 2, sy + 42);
  }

  button(ctx, RETRY_BTN, 'PLAY AGAIN', true);
  button(ctx, SHARE_BTN, share?.copied ? 'COPIED!' : 'SHARE RESULT', true);
}

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, waves: number, shots: number, stageName: string) {
  ctx.fillStyle = '#8890b8';
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(stageName, 30, 44);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(wave + 1 === waves ? 'BOSS' : `WAVE ${wave + 1}/${waves}`, W / 2, 44);
  ctx.textAlign = 'right';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
}
