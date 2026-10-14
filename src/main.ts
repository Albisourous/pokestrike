import './style.css';
import { startLoop } from './core/loop';
import { loadAll } from './core/assets';
import { vec } from './core/vec';
import { dateSeed } from './core/rng';
import { Battle } from './game/battle';
import { ROSTER, STAGE, makeDailyStage, ALL_SPRITE_IDS } from './game/data';
import {
  W,
  H,
  drawTitle,
  drawSelect,
  drawResult,
  drawHud,
  cellRect,
  START_BTN,
  RETRY_BTN,
  DAILY_BTN,
  FREE_BTN,
  inRect,
} from './game/screens';
import type { RunResult } from './game/screens';

type Scene = 'loading' | 'title' | 'select' | 'battle' | 'result';
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
let picks: number[] = [];
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
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  scale = Math.min(innerWidth / W, innerHeight / H);
  ox = (innerWidth - W * scale) / 2;
  oy = (innerHeight - H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
}
addEventListener('resize', resize);
resize();

function toLogical(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return vec((e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale);
}

// --- input routing ---

canvas.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  if (scene === 'title') {
    if (inRect(p.x, p.y, DAILY_BTN)) {
      mode = 'daily';
      scene = 'select';
    } else if (inRect(p.x, p.y, FREE_BTN)) {
      mode = 'free';
      scene = 'select';
    }
  } else if (scene === 'select') {
    for (let i = 0; i < ROSTER.length; i++) {
      if (inRect(p.x, p.y, cellRect(i))) {
        const at = picks.indexOf(i);
        if (at >= 0) picks.splice(at, 1);
        else if (picks.length < 4) picks.push(i);
        return;
      }
    }
    if (picks.length === 4 && inRect(p.x, p.y, START_BTN)) {
      const stage = mode === 'daily' ? makeDailyStage(dateSeed()) : STAGE;
      battle = new Battle(ARENA, picks.map((i) => ROSTER[i]), stage);
      scene = 'battle';
    }
  } else if (scene === 'battle') {
    battle?.pointerDown(p);
  } else if (scene === 'result') {
    if (inRect(p.x, p.y, RETRY_BTN)) {
      picks = [];
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
    case 'select':
      drawSelect(ctx, picks, mode === 'daily' ? 'Daily Strike' : STAGE.name);
      break;
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
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
