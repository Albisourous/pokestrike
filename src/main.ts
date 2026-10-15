import './style.css';
import { startLoop } from './core/loop';
import { unlockAudio, sfx, cry, music } from './core/audio';
import { loadAll, loadItem, loadGracidea } from './core/assets';
import { vec } from './core/vec';
import { Battle } from './game/battle';
import { PERKS } from './game/perks';
import { ROSTER, makeStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS, TOTAL_STAGES } from './game/data';
import {
  W,
  H,
  drawTitle,
  drawDraft,
  drawResult,
  drawHud,
  drawReward,
  draftCardRect,
  perkCardRect,
  boxSlotRect,
  boxScrollMax,
  BOX_STRIP,
  teamSlotRect,
  pathBtnRect,
  RETRY_BTN,
  SHARE_BTN,
  FREE_BTN,
  inRect,
  font,
} from './game/screens';
import type { RunResult, ShareGrid } from './game/screens';
import type { PokeType } from './game/types';

type Scene = 'loading' | 'title' | 'draft' | 'battle' | 'result';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// extra logical space the letterbox leaves above/below the 960 box on
// tall phone screens — the arena grows into it instead of black bars
let viewPad = 0;
const arenaRect = () => ({ x: 24, y: 72 - viewPad, w: W - 48, h: H - 92 + viewPad * 2 });

const randSeed = () => (Math.random() * 2 ** 31) | 0;

let scene: Scene = 'loading';
let battle: Battle | null = null;
let draft: { order: number[]; picked: number[] } = { order: [], picked: [] };
let stage = makeStage(randSeed());
let result: RunResult | null = null;
let resultExtra: string | null = null;
let share: ShareGrid | null = null;
let shareText = '';
let t = 0;
// box strip scroll: offset in px + an in-progress drag (tap = drag that never moved)
let boxScroll = 0;
let boxDrag: { x0: number; s0: number; moved: boolean } | null = null;

// --- canvas sizing: letterboxed 540x960 logical space ---
let scale = 1;
let ox = 0;
let oy = 0;

function resize() {
  // use the visible viewport, not 100vh — mobile URL bars overlap the latter
  const vw = window.visualViewport?.width ?? innerWidth;
  const vh = window.visualViewport?.height ?? innerHeight;
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  scale = Math.min(vw / W, vh / H);
  ox = (vw - W * scale) / 2;
  oy = (vh - H * scale) / 2;
  viewPad = Math.max(0, vh / scale - H) / 2;
  if (battle) Object.assign(battle.arena, arenaRect());
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

function toLogical(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return vec((e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale);
}

// Wordle-style emoji grid for sharing results.
const TYPE_SQ: Record<PokeType, string> = {
  fire: '🟥', water: '🟦', grass: '🟩', electric: '🟨', psychic: '🟪',
  rock: '🟫', poison: '🟪', normal: '⬜', flying: '🟦', fighting: '🟧',
  ghost: '⬛',
};

function buildShare(b: Battle, won: boolean) {
  const cleared = won ? TOTAL_STAGES : b.waveIndex;
  const waves =
    '🟩'.repeat(cleared) + (won ? '' : '🟥') + '⬛'.repeat(TOTAL_STAGES - cleared - (won ? 0 : 1));
  const team = draft.picked.map((i) => TYPE_SQ[ROSTER[i].type]).join('');
  return { waves, team, copied: false };
}

// Offers for the current round — never re-offer a species already on the
// team; top up from unpicked species when the deal runs dry. Rolled ONCE
// per round and cached: re-rolling in render would flicker the cards.
let offerCache: number[] | null = null;
function draftOffers(): number[] {
  if (offerCache) return offerCache;
  const offers = draft.order
    .slice(draft.picked.length * 3)
    .filter((i) => !draft.picked.includes(i))
    .slice(0, 3);
  if (offers.length < 3) {
    const extra = ROSTER.map((_, i) => i).filter(
      (i) => !draft.picked.includes(i) && !offers.includes(i),
    );
    for (let i = extra.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [extra[i], extra[j]] = [extra[j], extra[i]];
    }
    offers.push(...extra.slice(0, 3 - offers.length));
  }
  offerCache = offers;
  return offers;
}

// navigator.clipboard rejects on iOS Safari even in a gesture — the
// textarea + execCommand trick still works there, so it's the fallback
async function copyText(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareText);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = shareText;
    ta.readOnly = true;
    ta.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS needs the explicit range
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

async function shareResult() {
  // native sheet first: on iOS it's the reliable path and has a Copy
  // action built in
  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
      return;
    } catch {
      /* cancelled or unsupported payload — fall through to copy */
    }
  }
  if ((await copyText()) && share) {
    share.copied = true;
    setTimeout(() => share && (share.copied = false), 1500);
  }
}

// --- input routing ---

// title+draft share the title loop; result keeps whatever the battle queued
function sceneMusic() {
  if (scene === 'result') return;
  music(scene === 'battle' ? 'battle' : 'title');
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio(); // first gesture spins up the synth
  sceneMusic();
  const p = toLogical(e);
  if (scene === 'title') {
    if (inRect(p.x, p.y, FREE_BTN)) {
      sfx('ui');
      draft = { order: draftOrder(Math.random), picked: [] };
      offerCache = null;
      stage = makeStage(randSeed());
      scene = 'draft';
      sceneMusic();
    }
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    const offers = draftOffers();
    for (let i = 0; i < offers.length; i++) {
      if (!inRect(p.x, p.y, draftCardRect(i))) continue;
      sfx('ui');
      cry(ROSTER[offers[i]].id, 0.15); // picked mon calls out — quiet, the ogg cries are hot
      draft.picked.push(offers[i]);
      offerCache = null; // next round rerolls
      if (draft.picked.length === DRAFT_ROUNDS) {
        battle = new Battle(arenaRect(), draft.picked.map((i) => ROSTER[i]), stage, Math.random);
        // ?dev exposes the live battle for poking around during playtests
        if (new URLSearchParams(location.search).has('dev'))
          (window as unknown as { __battle: Battle }).__battle = battle;
        scene = 'battle';
        sceneMusic();
      }
      return;
    }
  } else if (scene === 'battle') {
    if (battle?.phase === 'reward') {
      // path choice: safe route vs the elite road — rolled stages only
      if (battle.nextIsRolled && !battle.nextIsGym) {
        for (let i = 0; i < 2; i++) {
          if (inRect(p.x, p.y, pathBtnRect(i))) {
            battle.pathElite = i === 1;
            sfx('ui');
            return;
          }
        }
      }
      // box strip swallows the pointer — release decides tap vs scroll drag
      if (battle.box.length > 0 && inRect(p.x, p.y, BOX_STRIP)) {
        boxDrag = { x0: p.x, s0: boxScroll, moved: false };
        return;
      }
      if (battle.boxSel >= 0) {
        for (let i = 0; i < battle.players.length; i++) {
          if (inRect(p.x, p.y, teamSlotRect(i))) {
            battle.swapFromBox(battle.boxSel, i);
            return;
          }
        }
      }
      for (let i = 0; i < battle.rewardOffers.length; i++) {
        if (inRect(p.x, p.y, perkCardRect(i))) battle.pickPerk(i);
      }
    } else {
      battle?.pointerDown(p);
    }
  } else if (scene === 'result') {
    if (inRect(p.x, p.y, SHARE_BTN)) {
      sfx('ui');
      shareResult();
    } else if (inRect(p.x, p.y, RETRY_BTN)) {
      sfx('ui');
      draft = { order: [], picked: [] };
      battle = null;
      result = null;
      resultExtra = null;
      share = null;
      scene = 'title';
      sceneMusic();
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  if (boxDrag) {
    if (Math.abs(p.x - boxDrag.x0) > 6) boxDrag.moved = true;
    if (battle)
      boxScroll = Math.min(
        Math.max(boxDrag.s0 + boxDrag.x0 - p.x, 0),
        boxScrollMax(battle.box.length),
      );
    return;
  }
  if (scene === 'battle') battle?.pointerMove(p);
});

canvas.addEventListener('pointerup', (e) => {
  if (boxDrag) {
    const { moved } = boxDrag;
    boxDrag = null;
    // a drag that never moved is a tap: pick a catch, then a teammate to swap into
    if (!moved && scene === 'battle' && battle?.phase === 'reward') {
      const p = toLogical(e);
      if (inRect(p.x, p.y, BOX_STRIP)) {
        for (let i = 0; i < battle.box.length; i++) {
          if (!inRect(p.x, p.y, boxSlotRect(i, battle.box.length, boxScroll))) continue;
          battle.boxSel = battle.boxSel === i ? -1 : i;
          sfx('ui');
          break;
        }
      }
    }
    return;
  }
  if (scene === 'battle') battle?.pointerUp();
});
canvas.addEventListener('pointercancel', () => {
  boxDrag = null;
  if (scene === 'battle') battle?.pointerUp();
});

// wheel/trackpad scroll for desktop playtests — drag is the primary control
canvas.addEventListener(
  'wheel',
  (e) => {
    if (scene !== 'battle' || battle?.phase !== 'reward') return;
    const max = boxScrollMax(battle.box.length);
    if (max <= 0) return;
    e.preventDefault();
    boxScroll = Math.min(Math.max(boxScroll + e.deltaX + e.deltaY, 0), max);
  },
  { passive: false },
);

// --- game loop ---

// HUD lives in the strip above the arena — on tall screens that strip is
// partly the top letterbox, so shift it up along with the arena
function hud(name: string) {
  if (!battle) return;
  ctx.save();
  ctx.translate(0, -viewPad);
  drawHud(ctx, battle.waveIndex, battle.shots, name);
  ctx.restore();
}

function update(dt: number) {
  t += dt;
  if (scene === 'battle' && battle) {
    battle.update(dt);
    if (battle.phase !== 'reward') boxScroll = 0;
    if (battle.phase === 'won' || battle.phase === 'lost') {
      result = {
        won: battle.phase === 'won',
        shots: battle.shots,
        time: battle.time,
        caught: battle.box.length,
        badges: battle.runBadges(battle.phase === 'won'),
      };
      share = buildShare(battle, result.won);
      if (!result.won) {
        resultExtra = `reached stage ${battle.waveIndex + 1} of ${TOTAL_STAGES}`;
      }
      shareText = [
        `Pokéstrike ${stage.name}`,
        share.waves,
        `⚡ ${result.shots} shots · ${result.time.toFixed(1)}s${result.caught ? ` · 📦 ${result.caught} caught` : ''}`,
        `🏅 ${result.badges.slice(0, 4).map((b) => b.name).join(' · ')}`,
        share.team,
        'https://albisourous.github.io/pokestrike/',
      ].join('\n');
      scene = 'result';
      music(result.won ? 'win' : null); // clear fanfare, or cut to silence on a loss
    }
  }
}

function render() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  switch (scene) {
    case 'loading':
      ctx.fillStyle = '#0b0e1a';
      ctx.fillRect(0, 0, W, H);
      ctx.font = font(12);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8890b8';
      ctx.fillText('loading…', W / 2, H / 2);
      break;
    case 'title':
      drawTitle(ctx);
      break;
    case 'draft': {
      const offers = draftOffers().map((i) => ROSTER[i]);
      drawDraft(
        ctx,
        offers,
        draft.picked.map((i) => ROSTER[i]),
        stage.name,
        t,
      );
      break;
    }
    case 'battle':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        hud(battle.eliteWave ? `${battle.stage.name} · ELITE` : battle.stage.name);
        battle.render(ctx);
        if (battle.phase === 'reward')
          drawReward(
            ctx,
            battle.rewardOffers,
            battle.box,
            battle.players.map((p) => p.def),
            battle.boxSel,
            boxScroll,
            battle.captureChance,
            battle.lastRecruit,
            {
              stage: battle.waveIndex + 2,
              gym: battle.nextIsGym,
              rolled: battle.nextIsRolled,
            },
            battle.pathElite,
          );
      }
      break;
    case 'result':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        hud(battle.stage.name);
        battle.render(ctx);
      }
      if (result) drawResult(ctx, result, resultExtra, share);
      break;
  }
  ctx.restore();
}

Promise.all([
  loadAll(ALL_SPRITE_IDS),
  loadGracidea(),
  loadItem('poke-ball'),
  loadItem('oran-berry'),
  loadItem('protein'),
  loadItem('elixir'),
  ...PERKS.map((p) => loadItem(p.item)),
  document.fonts.load('700 10px rc').catch(() => console.warn('rc font failed, using monospace')),
])
  .then(() => {
    scene = 'title';
    startLoop(update, render);
  })
  .catch((err) => {
    scene = 'loading';
    console.error(err);
    ctx.fillStyle = '#fff';
    ctx.font = font(10);
    ctx.fillText(`failed to load: ${err.message}`, 20, H / 2);
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
