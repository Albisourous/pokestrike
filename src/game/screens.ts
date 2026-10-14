import { itemSprite, drawMon } from '../core/assets';
import { SpeciesDef, TOTAL_STAGES } from './data';
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
// The box is a fixed window into a horizontally scrolling row — catches can
// outgrow 540px, so the row scrolls instead of centering off-screen.
export const BOX_STRIP = { x: 24, y: 640, w: W - 48, h: 56 };
const BOX_SLOT = 56;
const BOX_GAP = 10;
export function boxScrollMax(n: number) {
  return Math.max(0, n * (BOX_SLOT + BOX_GAP) - BOX_GAP - BOX_STRIP.w);
}
export function boxSlotRect(i: number, n: number, scroll = 0) {
  const content = n * (BOX_SLOT + BOX_GAP) - BOX_GAP;
  const off = Math.max(0, (BOX_STRIP.w - content) / 2);
  return { x: BOX_STRIP.x + off + i * (BOX_SLOT + BOX_GAP) - scroll, y: BOX_STRIP.y, w: BOX_SLOT, h: BOX_SLOT };
}
// Path choice on the reward screen: 0 = safe route, 1 = elite road.
export function pathBtnRect(i: number) {
  const w = 210, gap = 16;
  return { x: W / 2 - (w + gap / 2) + i * (w + gap), y: 898, w, h: 44 };
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
  // base grass — the real ripped Gen-5 battle ground
  const bg = itemSprite('bg/grove');
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else {
    ctx.fillStyle = '#459233';
    ctx.fillRect(0, 0, W, H);
  }

  // scattered tall-grass clumps — the same ripped tufts as the route grass
  const tuft = itemSprite('bg/grass');
  if (tuft) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 16; i++) {
      const x = hashSeed(i * 31 + 7) * W;
      const y = 100 + hashSeed(i * 57 + 3) * (H - 140);
      const s = 30 + hashSeed(i * 13) * 14;
      ctx.drawImage(tuft, x - s / 2, y - s * 0.2, s, s * 0.4);
    }
    ctx.restore();
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

// Tall-grass clump — ripped BW grass the wild mons stand in.
function grassClump(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const tuft = itemSprite('bg/grass');
  if (!tuft) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tuft, x - r, y - r * 0.4, r * 2, r * 0.8);
  ctx.restore();
}

function drawRingMons(ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number, rx: number, ry: number) {
  RING_MONS.forEach(([id, size], i) => {
    const a = -Math.PI / 2 + (i / RING_MONS.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    grassClump(ctx, x, y + size * 0.42, size * 0.55); // standing in route grass
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
  drawWildMons(ctx, t);

  const cx = W / 2;
  const cy = 300;
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
  box: SpeciesDef[],
  team: SpeciesDef[],
  selBox: number,
  boxScroll: number,
  catchPct: number,
  recruit: SpeciesDef | null,
  next: { stage: number; gym: boolean; rolled: boolean },
  pathElite: boolean,
) {
  ctx.fillStyle = '#0b0e1ad8';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  // the stage's guaranteed catch announces itself — beat a gym, take the ace
  if (recruit) {
    drawMon(ctx, recruit.id, W / 2 - 120, 250, 44);
    ctx.font = `10px ${PIXEL_FONT}`;
    ctx.fillStyle = '#ffd84d';
    ctx.fillText(`${recruit.name.toUpperCase()} JOINS YOUR BOX!`, W / 2 + 40, 258);
  }

  ctx.font = `20px ${PIXEL_FONT}`;
  ctx.fillStyle = '#f8d030';
  ctx.fillText('CHOOSE A RELIC', W / 2, 300);
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.fillStyle = '#8890b8';
  ctx.fillText(
    next.gym
      ? `stage ${next.stage} of ${TOTAL_STAGES} — a gym leader waits`
      : `stage ${next.stage} of ${TOTAL_STAGES} — the waves get meaner`,
    W / 2,
    335,
  );

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

  // captured box — tap a catch, then a teammate, to swap
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.fillStyle = '#8890b8';
  ctx.fillText(`BOX — catch rate ${Math.round(catchPct * 100)}%`, W / 2, 620);
  if (box.length === 0) {
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.fillStyle = '#5a6284';
    ctx.fillText('nothing caught yet — defeats sometimes capture', W / 2, 668);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOX_STRIP.x - 4, BOX_STRIP.y - 6, BOX_STRIP.w + 8, BOX_STRIP.h + 12);
  ctx.clip();
  box.forEach((def, i) => {
    const r = boxSlotRect(i, box.length, boxScroll);
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
  ctx.restore();
  const maxScroll = boxScrollMax(box.length);
  if (maxScroll > 0) {
    ctx.font = `9px ${PIXEL_FONT}`;
    ctx.fillStyle = '#8890b8';
    if (boxScroll > 0) ctx.fillText('◀', BOX_STRIP.x - 14, BOX_STRIP.y + 34);
    if (boxScroll < maxScroll) ctx.fillText('▶', BOX_STRIP.x + BOX_STRIP.w + 14, BOX_STRIP.y + 34);
  }

  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.fillStyle = '#8890b8';
  ctx.fillText('YOUR TEAM', W / 2, 750);
  team.forEach((def, i) => {
    const r = teamSlotRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = '#12162b';
    ctx.fill();
    ctx.strokeStyle = selBox >= 0 ? GOLD : '#2a3560';
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
    selBox >= 0 ? 'tap a teammate to swap in' : 'tap a box mon, then a teammate',
    W / 2,
    880,
  );

  // path choice — StS greed: the safe route, or the elite road (bigger
  // fight, richer relics, a guaranteed elite to catch). Fixed stages and
  // gyms just show what's next.
  ctx.font = `8px ${PIXEL_FONT}`;
  if (next.gym) {
    ctx.fillStyle = '#f85888';
    ctx.fillText('NEXT: GYM LEADER', W / 2, 926);
  } else if (next.rolled) {
    button(ctx, pathBtnRect(0), 'ROUTE', !pathElite);
    button(ctx, pathBtnRect(1), 'ELITE ★', pathElite);
  } else {
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`NEXT: STAGE ${next.stage}`, W / 2, 926);
  }
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

export function drawHud(ctx: CanvasRenderingContext2D, wave: number, shots: number, stageName: string) {
  ctx.fillStyle = '#8890b8';
  ctx.font = `9px ${PIXEL_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(stageName, 30, 44);
  // run map in miniature: a pip per stage, gyms as diamonds — the whole
  // 9-stage climb is visible from the first fight
  const gap = 22;
  const x0 = W / 2 - ((TOTAL_STAGES - 1) * gap) / 2;
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const x = x0 + i * gap;
    const y = 40;
    const gym = (i + 1) % 3 === 0;
    ctx.fillStyle = i < wave ? '#ffd84d' : i === wave ? '#ffffff' : '#3a4066';
    if (gym) {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SHOTS ${shots}`, W - 30, 44);
}
