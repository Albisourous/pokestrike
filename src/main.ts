import './style.css';
import { startLoop } from './core/loop';
import { loadAll } from './core/assets';
import { vec } from './core/vec';
import { dateSeed, mulberry32 } from './core/rng';
import { Battle } from './game/battle';
import { ROSTER, STAGE, makeDailyStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS } from './game/data';
import {
  W,
  H,
  drawTitle,
  drawDraft,
  drawResult,
  drawHud,
  draftCardRect,
  RETRY_BTN,
  DAILY_BTN,
  FREE_BTN,
  inRect,
} from './game/screens';
import type { RunResult } from './game/screens';

type Scene = 'loading' | 'title' | 'draft' | 'battle' | 'result';
type Mode = 'daily' | 'free';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const ARENA = { x: 24, y: 110, w: W - 48, h: H - 190 };
const BEST_KEY = 'pokestrike_best_clear';
const STREAK_KEY = 'pokestrike_streak';
const DAILY_KEY = 'pokestrike_daily_last';

let scene: Scene = 'loading';
let mode: Mode = 'free';
let battle: Battle | null = null;
let draft: { order: number[]; picked: number[] } = { order: [], picked: [] };
let result: RunResult | null = null;
let resultExtra: string | null = null;
let best: number | null = null;
let streak = 0;
let dailyDone = false;
let t = 0;

try {
  const raw = localStorage.getItem(BEST_KEY);
  best = raw === null ? null : Number(raw);
  streak = Number(localStorage.getItem(STREAK_KEY) ?? 0) || 0;
  dailyDone = Number(localStorage.getItem(DAILY_KEY)) === dateSeed();
} catch {
  // storage unavailable
}

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
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

function toLogical(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return vec((e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale);
}

// --- input routing ---

canvas.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  if (scene === 'title') {
    if (inRect(p.x, p.y, DAILY_BTN) || inRect(p.x, p.y, FREE_BTN)) {
      mode = inRect(p.x, p.y, DAILY_BTN) ? 'daily' : 'free';
      // daily drafts are seeded: everyone sees the same offers that day
      const rng = mode === 'daily' ? mulberry32(dateSeed()) : Math.random;
      draft = { order: draftOrder(rng), picked: [] };
      scene = 'draft';
    }
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    const offers = draft.order.slice(draft.picked.length * 3, draft.picked.length * 3 + 3);
    for (let i = 0; i < offers.length; i++) {
      if (!inRect(p.x, p.y, draftCardRect(i))) continue;
      draft.picked.push(offers[i]);
      if (draft.picked.length === DRAFT_ROUNDS) {
        const stage = mode === 'daily' ? makeDailyStage(dateSeed()) : STAGE;
        battle = new Battle(ARENA, draft.picked.map((i) => ROSTER[i]), stage);
        scene = 'battle';
      }
      return;
    }
  } else if (scene === 'battle') {
    battle?.pointerDown(p);
  } else if (scene === 'result') {
    if (inRect(p.x, p.y, RETRY_BTN)) {
      draft = { order: [], picked: [] };
      battle = null;
      result = null;
      resultExtra = null;
      scene = 'title';
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (scene === 'battle') battle?.pointerMove(toLogical(e));
});

canvas.addEventListener('pointerup', () => {
  if (scene === 'battle') battle?.pointerUp();
});
canvas.addEventListener('pointercancel', () => {
  if (scene === 'battle') battle?.pointerUp();
});

// --- game loop ---

function update(dt: number) {
  t += dt;
  if (scene === 'battle' && battle) {
    battle.update(dt);
    if (battle.phase === 'won' || battle.phase === 'lost') {
      result = { won: battle.phase === 'won', shots: battle.shots, time: battle.time };
      if (result.won) {
        if (mode === 'daily') {
          const seed = dateSeed();
          const yesterday = dateSeed(new Date(Date.now() - 86400000));
          const last = Number(localStorage.getItem(DAILY_KEY)) || 0;
          if (last !== seed) streak = last === yesterday ? streak + 1 : 1;
          dailyDone = true;
          resultExtra = `daily streak: ${streak}`;
        } else if (best === null || result.time < best) {
          best = result.time;
        }
        try {
          localStorage.setItem(BEST_KEY, String(best));
          localStorage.setItem(STREAK_KEY, String(streak));
          localStorage.setItem(DAILY_KEY, String(dailyDone ? dateSeed() : 0));
        } catch {
          // storage unavailable
        }
      }
      scene = 'result';
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
      ctx.font = '20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8890b8';
      ctx.fillText('loading…', W / 2, H / 2);
      break;
    case 'title':
      drawTitle(ctx, t, best, streak, dailyDone);
      break;
    case 'draft': {
      const offers = draft.order
        .slice(draft.picked.length * 3, draft.picked.length * 3 + 3)
        .map((i) => ROSTER[i]);
      drawDraft(
        ctx,
        offers,
        draft.picked.map((i) => ROSTER[i]),
        mode === 'daily' ? 'Daily Strike' : STAGE.name,
        t,
      );
      break;
    }
    case 'battle':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        drawHud(ctx, battle.waveIndex, battle.waveCount, battle.shots, battle.stage.name);
        battle.render(ctx);
      }
      break;
    case 'result':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        drawHud(ctx, battle.waveIndex, battle.waveCount, battle.shots, battle.stage.name);
        battle.render(ctx);
      }
      if (result) drawResult(ctx, result, best, resultExtra);
      break;
  }
  ctx.restore();
}

loadAll(ALL_SPRITE_IDS)
  .then(() => {
    scene = 'title';
    startLoop(update, render);
  })
  .catch((err) => {
    scene = 'loading';
    console.error(err);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui';
    ctx.fillText(`failed to load: ${err.message}`, 20, H / 2);
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
