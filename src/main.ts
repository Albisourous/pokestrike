import './style.css';
import { startLoop } from './core/loop';
import { loadAll, loadItem } from './core/assets';
import { vec } from './core/vec';
import { dateSeed, mulberry32 } from './core/rng';
import { Battle } from './game/battle';
import { PERKS } from './game/perks';
import { ROSTER, makeStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS } from './game/data';
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
  teamSlotRect,
  RETRY_BTN,
  SHARE_BTN,
  DAILY_BTN,
  FREE_BTN,
  inRect,
} from './game/screens';
import type { RunResult, ShareGrid } from './game/screens';
import type { PokeType } from './game/types';

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
let stage = makeStage(dateSeed());
let runRng: () => number = Math.random; // daily runs share one seeded stream
let result: RunResult | null = null;
let resultExtra: string | null = null;
let share: ShareGrid | null = null;
let shareText = '';
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

// Wordle-style emoji grid for sharing daily results.
const TYPE_SQ: Record<PokeType, string> = {
  fire: '🟥', water: '🟦', grass: '🟩', electric: '🟨', psychic: '🟪',
  rock: '🟫', poison: '🟪', normal: '⬜', flying: '🟦', fighting: '🟧',
  ghost: '⬛',
};

function buildShare(b: Battle, won: boolean) {
  const cleared = won ? b.waveCount : b.waveIndex;
  const waves =
    '🟩'.repeat(cleared) + (won ? '' : '🟥') + '⬛'.repeat(b.waveCount - cleared - (won ? 0 : 1));
  const team = draft.picked.map((i) => TYPE_SQ[ROSTER[i].type]).join('');
  return { waves, team, copied: false };
}

async function shareResult() {
  try {
    if (navigator.share) {
      await navigator.share({ text: shareText });
      return;
    }
    await navigator.clipboard.writeText(shareText);
  } catch {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      /* not a secure context — grid is on screen for a screenshot anyway */
    }
  }
  if (share) {
    share.copied = true;
    setTimeout(() => share && (share.copied = false), 1500);
  }
}

// --- input routing ---

canvas.addEventListener('pointerdown', (e) => {
  const p = toLogical(e);
  if (scene === 'title') {
    if (inRect(p.x, p.y, DAILY_BTN) || inRect(p.x, p.y, FREE_BTN)) {
      mode = inRect(p.x, p.y, DAILY_BTN) ? 'daily' : 'free';
      // daily drafts are seeded: everyone sees the same offers that day
      runRng = mode === 'daily' ? mulberry32(dateSeed()) : Math.random;
      draft = { order: draftOrder(runRng), picked: [] };
      stage = makeStage(
        mode === 'daily' ? dateSeed() : (Math.random() * 2 ** 31) | 0,
        mode === 'daily' ? 'Daily Strike' : undefined,
      );
      scene = 'draft';
    }
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    const offers = draft.order.slice(draft.picked.length * 3, draft.picked.length * 3 + 3);
    for (let i = 0; i < offers.length; i++) {
      if (!inRect(p.x, p.y, draftCardRect(i))) continue;
      draft.picked.push(offers[i]);
      if (draft.picked.length === DRAFT_ROUNDS) {
        battle = new Battle(ARENA, draft.picked.map((i) => ROSTER[i]), stage, runRng, mode === 'free');
        scene = 'battle';
      }
      return;
    }
  } else if (scene === 'battle') {
    if (battle?.phase === 'reward') {
      // box first: pick a catch, then a teammate slot to swap into
      for (let i = 0; i < battle.box.length; i++) {
        if (inRect(p.x, p.y, boxSlotRect(i, battle.box.length))) {
          battle.boxSel = battle.boxSel === i ? -1 : i;
          return;
        }
      }
      if (battle.boxSel >= 0 && !battle.swapped) {
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
      shareResult();
    } else if (inRect(p.x, p.y, RETRY_BTN)) {
      draft = { order: [], picked: [] };
      battle = null;
      result = null;
      resultExtra = null;
      share = null;
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
      share = buildShare(battle, result.won);
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
      } else if (mode === 'free') {
        resultExtra = `reached depth ${battle.depth + 1}`;
      }
      shareText = [
        `Pokéstrike ${stage.name}`,
        share.waves,
        `⚡ ${result.shots} shots · ${result.time.toFixed(1)}s${mode === 'daily' ? ` · 🔥 streak ${streak}` : ''}`,
        share.team,
        'https://albisourous.github.io/pokestrike/',
      ].join('\n');
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
        stage.name,
        t,
      );
      break;
    }
    case 'battle':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        drawHud(
          ctx,
          battle.waveIndex,
          battle.waveCount,
          battle.shots,
          battle.depth > 0 ? `${battle.stage.name} · DEPTH ${battle.depth}` : battle.stage.name,
        );
        battle.render(ctx);
        if (battle.phase === 'reward')
          drawReward(
            ctx,
            battle.rewardOffers,
            battle.depth,
            battle.box,
            battle.players.map((p) => p.def),
            battle.boxSel,
            battle.swapped,
            battle.captureChance,
          );
      }
      break;
    case 'result':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        drawHud(ctx, battle.waveIndex, battle.waveCount, battle.shots, battle.stage.name);
        battle.render(ctx);
      }
      if (result) drawResult(ctx, result, best, resultExtra, share);
      break;
  }
  ctx.restore();
}

Promise.all([loadAll(ALL_SPRITE_IDS), ...PERKS.map((p) => loadItem(p.item))])
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
