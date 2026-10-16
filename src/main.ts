import './style.css';
import { startLoop } from './core/loop';
import { unlockAudio, sfx, cry, music, toggleMute } from './core/audio';
import { loadAll, loadItem, loadGracidea, loadNpcs } from './core/assets';
import { mulberry32 } from './core/rng';
import { vec } from './core/vec';
import { Battle } from './game/battle';
import { PERKS, rollPerks } from './game/perks';
import type { Perk } from './game/perks';
import { ROSTER, makeStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS, TOTAL_STAGES, speciesById } from './game/data';
import type { SpeciesDef } from './game/data';
import { dexIds, recordCapture, recordGymWin, rank, echoIds, saveEcho, clearEcho, recordRun, best, shinyCharm, unlockAch, ACHIEVEMENTS, coachDone, markCoached } from './game/meta';
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
  RETRY_BTN,
  SHARE_BTN,
  TITLE_BTN,
  FREE_BTN,
  HELP_BTN,
  HELP_CHIP,
  MUTE_CHIP,
  drawHelpChip,
  drawMuteChip,
  MUTE_BTN,
  DRAFT_REROLL,
  drawHelp,
  drawPerkPick,
  CHARM_SKIP,
  REWARD_SKIP,
  HELP_PANEL,
  HELP_PREV,
  HELP_NEXT,
  HELP_CLOSE,
  HELP_PAGE_COUNT,
  DEX_BTN,
  drawDex,
  dexScrollMax,
  ACH_BTN,
  drawAch,
  achScrollMax,
  CATCHABLE,
  inRect,
  font,
} from './game/screens';
import type { RunResult, ShareGrid } from './game/screens';
import type { PokeType } from './game/types';

type Scene = 'loading' | 'title' | 'draft' | 'charm' | 'battle' | 'result';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// extra logical space the letterbox leaves above/below the 960 box on
// tall phone screens — the arena grows into it instead of black bars
let viewPad = 0;
const arenaRect = () => ({ x: 24, y: 72 - viewPad, w: W - 48, h: H - 92 + viewPad * 2 });

const randSeed = () => (Math.random() * 2 ** 31) | 0;

let scene: Scene = 'loading';
let battle: Battle | null = null;
let draft: {
  order: number[];
  picked: number[];
  shiny: Set<number>;
  lvls: Map<number, number>;
  rerolls: number;
} = {
  order: [],
  picked: [],
  shiny: new Set(),
  lvls: new Map(),
  rerolls: 1,
};
// the run's draft pool — roster plus captured-dex species not already in it
let draftPool: SpeciesDef[] = [];
let stage = makeStage(randSeed());
// the run's roll source — Math.random normally, seeded under ?seed=NNN;
// draft deals and the Battle both draw from it so a forced seed reproduces
let runRng: () => number = Math.random;
let helpOpen = false;
let helpPage = 0;
let dexOpen = false;
let dexScroll = 0;
let achOpen = false;
let achScroll = 0;
let dexDrag: { y0: number; s0: number; moved: boolean } | null = null;
let helpDrag: { x0: number; y0: number; moved: boolean } | null = null;
let result: RunResult | null = null;
let startOffers: Perk[] = []; // starter charm pick between draft and battle
let resultExtra: string | null = null;
let share: ShareGrid | null = null;
let shareText = '';
let t = 0;
// gyms already banked this battle — the delta feeds recordGymWin
let lastGyms = 0;
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
  // dpr 3 phone screens would rasterize a 540x960 game at 3x — 2x is the
  // point where extra pixels stop being visible but still cost fill-rate
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  scale = Math.min(vw / W, vh / H);
  ox = (vw - W * scale) / 2;
  oy = (vh - H * scale) / 2;
  viewPad = Math.max(0, vh / scale - H) / 2;
  // never re-fit mid-fight — units/hazards keep old-coord physics while the
  // URL bar collapses; remap only between waves where spawnWave re-layouts
  if (battle && ['map', 'reward', 'won', 'lost'].includes(battle.phase)) Object.assign(battle.arena, arenaRect());
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
// ?dev also exposes the scene machine + coordinate transform for playtest probes
if (new URLSearchParams(location.search).has('dev'))
  (window as unknown as { __dbg: { scene: () => Scene; xy: (x: number, y: number) => { x: number; y: number } } }).__dbg = {
    scene: () => scene,
    xy: (x, y) => { const p = toLogical({ clientX: x, clientY: y } as PointerEvent); return { x: p.x, y: p.y }; },
  };

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
  const team = draft.picked.map((i) => TYPE_SQ[draftPool[i].type]).join('');
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
    const extra = draftPool.map((_, i) => i).filter(
      (i) => !draft.picked.includes(i) && !offers.includes(i),
    );
    for (let i = extra.length - 1; i > 0; i--) {
      const j = Math.floor(runRng() * (i + 1));
      [extra[i], extra[j]] = [extra[j], extra[i]];
    }
    offers.push(...extra.slice(0, 3 - offers.length));
  }
  offerCache = offers;
  return offers;
}

// A run's draft pool is the roster plus everything the dex has caught that
// isn't already in it — catching mons is how new faces join future drafts.
// draftOrder only deals roster indices, so the extras get shuffled into the
// deal here or they'd never be offered.
function startDraft() {
  draftPool = [
    ...ROSTER,
    ...dexIds()
      .map(speciesById)
      .filter((d): d is SpeciesDef => !!d && !ROSTER.some((r) => r.id === d.id)),
  ];
  draft = { order: draftOrder(runRng), picked: [], shiny: new Set(), lvls: new Map(), rerolls: 1 };
  for (let i = ROSTER.length; i < draftPool.length; i++) {
    draft.order.splice(Math.floor(runRng() * (draft.order.length + 1)), 0, i);
  }
  // ~1/50 of draft cards roll shiny — a gold card is the run's first
  // high-roll; the Shiny Charm milestone doubles it
  const shinyOdds = 0.02 * (shinyCharm() ? 2 : 1);
  draftPool.forEach((_, i) => {
    if (runRng() < shinyOdds) draft.shiny.add(i);
    // every card rolls a level 5-14, weighted low — a Lv14 opener is a
    // real high-roll: roughly double the stats of a fresh Lv5
    const lvl = 5 + Math.floor(Math.pow(runRng(), 1.8) * 10);
    draft.lvls.set(i, lvl);
  });
  offerCache = null;
}

// a shiny or leveled slot hands Battle a cloned def — the shared species
// rows stay clean
const draftDef = (i: number): SpeciesDef => {
  const base = draftPool[i];
  const shiny = draft.shiny.has(i);
  const lvl = draft.lvls.get(i);
  return shiny || lvl ? { ...base, shiny: shiny || undefined, lvl } : base;
};

// one board reshuffle per draft — a bad first board isn't a run sentence
function rerollDraft() {
  if (draft.rerolls <= 0) return;
  draft.rerolls--;
  const head = draft.order.slice(0, draft.picked.length * 3);
  const tail = draft.order.slice(draft.picked.length * 3);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(runRng() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  draft.order = [...head, ...tail];
  offerCache = null;
  sfx('ui');
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

// title+draft share the title loop; result keeps whatever the battle queued.
// battle picks its own track every frame (map/gym/trainer/wild) — stepping in
// here would flip-flop and restart the song on every drag
function sceneMusic() {
  if (scene === 'result' || scene === 'battle') return;
  music('title');
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio(); // first gesture spins up the synth
  sceneMusic();
  const p = toLogical(e);
  // the help pager swallows all input while it's up — any scene
  if (helpOpen) {
    helpDrag = { x0: p.x, y0: p.y, moved: false };
    return;
  }
  if (scene === 'title') {
    if (dexOpen || achOpen) {
      dexDrag = { y0: p.y, s0: dexOpen ? dexScroll : achScroll, moved: false };
      return;
    }
    if (inRect(p.x, p.y, DEX_BTN)) {
      sfx('ui');
      dexOpen = true;
      dexScroll = 0;
      return;
    }
    if (inRect(p.x, p.y, ACH_BTN)) {
      sfx('ui');
      achOpen = true;
      achScroll = 0;
      return;
    }
    if (inRect(p.x, p.y, HELP_BTN)) {
      sfx('ui');
      helpOpen = true;
      helpPage = 0;
      return;
    }
    if (inRect(p.x, p.y, MUTE_BTN)) {
      toggleMute();
      sfx('ui'); // plays only when unmuting
      return;
    }
    if (inRect(p.x, p.y, FREE_BTN)) {
      sfx('ui');
      // ?seed=NNN forces the run — debug sharable climbs
      const forced = Number(new URLSearchParams(location.search).get('seed'));
      runRng = Number.isFinite(forced) && forced > 0 ? mulberry32(forced) : Math.random;
      startDraft();
      stage = makeStage(Number.isFinite(forced) && forced > 0 ? forced : randSeed());
      scene = 'draft';
      sceneMusic();
    }
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    if (draft.rerolls > 0 && inRect(p.x, p.y, DRAFT_REROLL)) {
      rerollDraft();
      return;
    }
    const offers = draftOffers();
    for (let i = 0; i < offers.length; i++) {
      if (!inRect(p.x, p.y, draftCardRect(i))) continue;
      sfx('ui');
      cry(draftPool[offers[i]].id, 0.15); // picked mon calls out — quiet, the ogg cries are hot
      draft.picked.push(offers[i]);
      offerCache = null; // next round rerolls
      if (draft.picked.length === DRAFT_ROUNDS) {
        battle = new Battle(arenaRect(), draft.picked.map(draftDef), stage, runRng);
        battle.coach = !coachDone(); // first-ever run teaches by doing
        battle.rank = rank();
        battle.asc = Math.min(best().wins, 9); // every clear raises the heat
        battle.bestScore = best().score; // crossing it mid-run pops NEW BEST!
        battle.shinyRate = shinyCharm() ? 2 : 1; // dex milestone doubles the gold
        // the last losing team returns as a rival wave — battle eats it
        const echo = echoIds()
          ?.map((e) => ({ def: speciesById(e.id), lvl: e.lvl }))
          .filter((e): e is { def: SpeciesDef; lvl: number } => !!e.def);
        battle.echo = echo?.length ? echo : null;
        lastGyms = 0;
        // ?dev exposes the live battle for poking around during playtests
        if (new URLSearchParams(location.search).has('dev'))
          (window as unknown as { __battle: Battle }).__battle = battle;
        // the charm pick gates the climb — one held item before stage 1
        startOffers = rollPerks(runRng, 3, rank(), battle.teamTypes());
        scene = 'charm';
      }
      return;
    }
  } else if (scene === 'charm') {
    if (inRect(p.x, p.y, CHARM_SKIP)) {
      // declining the charm pays score instead — dead offers have a price
      sfx('ui');
      if (battle) battle.score += 200;
      startOffers = [];
      scene = 'battle';
      sceneMusic();
      return;
    }
    for (let i = 0; i < startOffers.length; i++) {
      if (!inRect(p.x, p.y, perkCardRect(i))) continue;
      const perk = startOffers[i];
      sfx('ui');
      if (battle) {
        perk.apply(battle);
        battle.heldItems.push(perk.item);
        battle.perksTaken++;
      }
      startOffers = [];
      scene = 'battle';
      sceneMusic();
      return;
    }
    return;
  } else if (scene === 'battle') {
    // mid-run reference: the ? chip shows between fights
    if (battle && (battle.phase === 'map' || battle.phase === 'reward')) {
      if (inRect(p.x, p.y, HELP_CHIP)) {
        sfx('ui');
        helpOpen = true;
        helpPage = 0;
        return;
      }
      if (inRect(p.x, p.y, MUTE_CHIP)) {
        toggleMute();
        sfx('ui');
        return;
      }
    }
    if (battle?.phase === 'reward') {
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
      if (inRect(p.x, p.y, REWARD_SKIP)) battle.declineReward();
    } else {
      battle?.pointerDown(p);
    }
  } else if (scene === 'result') {
    if (inRect(p.x, p.y, SHARE_BTN)) {
      sfx('ui');
      shareResult();
    } else if (inRect(p.x, p.y, RETRY_BTN)) {
      // REMATCH: one tap back into a fresh draft — the loop stays hot
      sfx('ui');
      runRng = Math.random;
      stage = makeStage(randSeed());
      battle = null;
      result = null;
      resultExtra = null;
      share = null;
      startDraft();
      scene = 'draft';
      sceneMusic();
    } else if (inRect(p.x, p.y, TITLE_BTN)) {
      sfx('ui');
      draft = { order: [], picked: [], shiny: new Set(), lvls: new Map(), rerolls: 1 };
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
  if (helpDrag) {
    if (Math.abs(p.x - helpDrag.x0) > 6 || Math.abs(p.y - helpDrag.y0) > 6) helpDrag.moved = true;
    return;
  }
  if (dexDrag) {
    if (Math.abs(p.y - dexDrag.y0) > 6) dexDrag.moved = true;
    const s = Math.min(Math.max(dexDrag.s0 + dexDrag.y0 - p.y, 0), achOpen ? achScrollMax() : dexScrollMax());
    if (achOpen) achScroll = s; else dexScroll = s;
    return;
  }
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
  if (helpDrag) {
    const { x0, moved } = helpDrag;
    helpDrag = null;
    const p = toLogical(e);
    if (moved) {
      // horizontal swipe flips pages; vertical wiggle does nothing
      if (p.x - x0 < -30) helpPage = Math.min(helpPage + 1, HELP_PAGE_COUNT - 1);
      else if (p.x - x0 > 30) helpPage = Math.max(helpPage - 1, 0);
      return;
    }
    if (inRect(p.x, p.y, HELP_CLOSE) || !inRect(p.x, p.y, HELP_PANEL)) helpOpen = false;
    else if (inRect(p.x, p.y, HELP_NEXT)) helpPage = Math.min(helpPage + 1, HELP_PAGE_COUNT - 1);
    else if (inRect(p.x, p.y, HELP_PREV)) helpPage = Math.max(helpPage - 1, 0);
    return;
  }
  if (dexDrag) {
    const { moved } = dexDrag;
    dexDrag = null;
    if (!moved) {
      dexOpen = false;
      achOpen = false;
    }
    return;
  }
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
  helpDrag = null;
  dexDrag = null;
  boxDrag = null;
  // an interrupt isn't a release — drop the drag, don't fire the shot
  if (scene === 'battle') battle?.pointerCancel();
});

// wheel/trackpad scroll for desktop playtests — drag is the primary control
canvas.addEventListener(
  'wheel',
  (e) => {
    if (helpOpen) {
      e.preventDefault();
      helpPage = Math.min(Math.max(helpPage + (e.deltaY + e.deltaX > 0 ? 1 : -1), 0), HELP_PAGE_COUNT - 1);
      return;
    }
    if (scene === 'title' && dexOpen) {
      e.preventDefault();
      dexScroll = Math.min(Math.max(dexScroll + e.deltaY, 0), dexScrollMax());
      return;
    }
    if (scene === 'title' && achOpen) {
      e.preventDefault();
      achScroll = Math.min(Math.max(achScroll + e.deltaY, 0), achScrollMax());
      return;
    }
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
  drawHud(ctx, battle.waveIndex, battle.shots, name, battle.score, battle.streak);
  ctx.restore();
}

function update(dt: number) {
  t += dt;
  if (scene === 'battle' && battle) {
    battle.update(dt);
    if (battle.phase !== 'reward') boxScroll = 0;
    // metagame polls — same spot the battle→scene transitions already live
    while (battle.gymsBeaten > lastGyms) {
      recordGymWin();
      lastGyms++;
    }
    if (battle.echoCleared) {
      clearEcho();
      battle.echoCleared = false; // consumed; battle only raises the flag
    }
    if (battle.coachDone) {
      markCoached();
      battle.coachDone = false;
      battle.coach = false;
    }
    if (battle.phase === 'won' || battle.phase === 'lost') {
      const won = battle.phase === 'won';
      const stageReached = won ? TOTAL_STAGES : battle.waveIndex + 1;
      const dexBefore = dexIds().length;
      const prevBest = best().score;
      const mvp = battle.players.reduce((a, p) => (p.lvl > a.lvl ? p : a), battle.players[0]);
      const newBest = recordRun(battle.score, stageReached, won);
      const gap = prevBest - battle.score;
      result = {
        won,
        shots: battle.shots,
        time: battle.time,
        caught: battle.box.length,
        score: battle.score,
        badges: battle.runBadges(won),
        team: battle.players.map((p) => p.def),
        newBest,
        newDex: 0,
        mvpIdx: battle.players.indexOf(mvp),
        shortOfBest: !newBest && gap > 0 && gap <= 500 ? gap : 0,
        newAch: [],
      };
      // run-level trophies — battle awards its own (perfect, pinball, catches)
      const trophy = (id: string) => {
        if (unlockAch(id)) result!.newAch.push(ACHIEVEMENTS.find((a) => a.id === id)!.name);
      };
      if (won) trophy('first-clear');
      if (won && battle.asc >= 1) trophy('ascended');
      if (won && best().wins >= 3) trophy('triple');
      if (battle.totalKos >= 40) trophy('rampage');
      share = buildShare(battle, won);
      // catches join the dex either way; a loss leaves the team behind as
      // the next run's rival "echo"
      recordCapture(battle.box.map((b) => b.id));
      result.newDex = dexIds().length - dexBefore;
      if (dexIds().length >= 50) trophy('collector');
      if (dexIds().length >= CATCHABLE) trophy('living');
      if (!won) saveEcho(battle.players.map((p) => ({ id: p.def.id, lvl: p.lvl })));
      if (!won) {
        // near-miss framing: a deep wipe reads as "so close", not "failed"
        const near = stageReached >= TOTAL_STAGES - 1;
        let extra = near
          ? `so close, fell at stage ${stageReached} of ${TOTAL_STAGES}`
          : `reached stage ${stageReached} of ${TOTAL_STAGES}`;
        // the sting: how close the killing wave itself was to falling
        const left = battle.enemies.filter((e) => !e.dead);
        if (left.length === 1) {
          const pct = Math.ceil((left[0].hp / left[0].maxHp) * 100);
          if (pct <= 40) extra += `. ${left[0].def.name.toUpperCase()} was at ${pct}%!`;
        } else if (left.length > 1) {
          const rem = left.reduce((s, e) => s + e.hp, 0) / left.reduce((s, e) => s + e.maxHp, 1);
          if (rem < 0.35) extra += `. The wave was ${Math.round((1 - rem) * 100)}% cleared`;
        }
        resultExtra = extra;
      } else {
        // a clear raises the heat — say so, that's the "again?" hook
        const nextAsc = Math.min(best().wins, 9);
        if (nextAsc > battle.asc && nextAsc <= 9)
          resultExtra = `ASCENSION ${nextAsc} UNLOCKED. The climb gets meaner`;
      }
      const teamNames = battle.players.map((p) => p.def.name).join(' · ');
      shareText = [
        `⚾ POKÉSTRIKE: sling & ricochet Pokémon roguelike`,
        `🗺️ ${stage.name}: ${won ? 'cleared!' : `stage ${stageReached}/${TOTAL_STAGES}`}${battle.asc ? ` · ASC ${battle.asc}` : ''}`,
        share.waves,
        `✨ ${teamNames}`,
        ...(mvp.lvl > 1 ? [`👑 MVP ${mvp.def.name.toUpperCase()} Lv${mvp.lvl}`] : []),
        `⭐ ${result.score.toLocaleString('en-US')} pts · ⚡ ${result.shots} shots${result.caught ? ` · 📦 ${result.caught} caught` : ''}`,
        `🏅 ${result.badges.slice(0, 4).map((b) => b.name).join(' · ')}`,
        share.team,
        'https://albisourous.github.io/pokestrike/',
      ].join('\n');
      scene = 'result';
      music(won ? 'win' : null); // clear fanfare, or cut to silence on a loss
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
      if (dexOpen) drawDex(ctx, dexScroll);
      if (achOpen) drawAch(ctx, achScroll);
      break;
    case 'charm':
      drawPerkPick(ctx, startOffers, 'CHOOSE YOUR CHARM', 'one held item starts the climb', t, draft.picked.map(draftDef));
      break;
    case 'draft': {
      const offers = draftOffers().map(draftDef);
      drawDraft(
        ctx,
        offers,
        draft.picked.map(draftDef),
        stage.name,
        t,
        draft.rerolls,
      );
      break;
    }
    case 'battle':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        hud(battle.hardWave ? `${battle.stage.name} · TRAINER` : battle.stage.name);
        battle.render(ctx);
        if (battle.phase === 'reward')
          drawReward(
            ctx,
            battle.rewardOffers,
            battle.box,
            battle.boxHp,
            battle.boxLvl,
            battle.players.map((p) => p.def),
            battle.players.map((p) => (p.maxHp ? p.hp / p.maxHp : 0)),
            battle.players.map((p) => p.lvl),
            battle.boxSel,
            boxScroll,
            battle.captureChance,
            battle.lastRecruit,
            {
              stage: battle.waveIndex + 2,
              gym: battle.nextIsGym,
              rolled: battle.nextIsRolled,
            },
            battle.score,
            battle.heldItems,
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
      if (result) drawResult(ctx, result, resultExtra, share, t);
      break;
  }
  // the ?/mute chips ride between fights; the pager floats over any scene
  if (scene === 'battle' && battle && (battle.phase === 'map' || battle.phase === 'reward')) {
    drawHelpChip(ctx);
    drawMuteChip(ctx);
  }
  if (helpOpen) drawHelp(ctx, helpPage);
  ctx.restore();
}

Promise.all([
  loadAll(ALL_SPRITE_IDS),
  loadGracidea(),
  loadNpcs(),
  loadItem('poke-ball'),
  loadItem('ui/pokemon-logo'),
  loadItem('oran-berry'),
  loadItem('protein'),
  loadItem('elixir'),
  ...PERKS.map((p) => loadItem(p.item)),
  document.fonts.load('700 10px rc').catch(() => console.warn('rc font failed, using monospace')),
])
  .then(() => {
    scene = 'title';
    // no forced manual: first-run coaching lives in the battle itself —
    // the ? chip is there for anyone who wants the reference
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
