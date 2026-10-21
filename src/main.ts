import './style.css';
import { startLoop } from './core/loop';
import { unlockAudio, sfx, cry, music, toggleMute, syncVolumes } from './core/audio';
import { loadAll, loadItem, loadGracidea, loadNpcs } from './core/assets';
import { mulberry32 } from './core/rng';
import { vec } from './core/vec';
import { Battle } from './game/battle';
import { PERKS, rollPerks } from './game/perks';
import type { Perk } from './game/perks';
import { ROSTER, makeStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS, TOTAL_STAGES, speciesById, ACE_POOL, tierOf } from './game/data';
import type { SpeciesDef } from './game/data';
import { dexIds, recordCapture, recordGymWin, rank, echoIds, saveEcho, clearEcho, recordRun, best, shinyCharm, unlockAch, unlockedAch, ACHIEVEMENTS, coachDone, markCoached, BADGES, applyRunRating, recordBoard, migrateSaves, statOffer, statRunEnd, statsDump, saveRun, runSave, clearRun, settings, spendBag, type RunSave } from './game/meta';
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
  evoCardRect,
  boxSlotRect,
  boxScrollMax,
  BOX_STRIP,
  teamSlotRect,
  RETRY_BTN,
  SHARE_BTN,
  TITLE_BTN,
  FREE_BTN,
  NEW_BTN,
  DAILY_BTN,
  HELP_BTN,
  HELP_CHIP,
  GEAR_BTN,
  MUTE_CHIP,
  drawHelpChip,
  drawMuteChip,
  MUTE_BTN,
  DRAFT_REROLL,
  REEL_STOPS,
  BAG_ROW,
  BAG_MAX,
  bagChipRect,
  bagRowItems,
  drawHelp,
  drawPerkPick,
  CHARM_SKIP,
  TOOL_ROLL,
  TOOL_SKIP,
  TOOL_BAN,
  drawToolRow,
  REWARD_TEAM,
  REWARD_CATCH,
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
  BOARD_BTN,
  drawBoard,
  CATCHABLE,
  MAP_MENU,
  TEAM_PANEL,
  MENU_CLOSE,
  drawTeamMenu,
  SETTINGS_PANEL,
  SETTINGS_CLOSE,
  SETTINGS_CATS,
  drawSettings,
  settingsRowHit,
  settingsSliderSet,
  settingsToggleFlip,
  TASKS_BTN,
  TASKS_TABS,
  drawTasks,
  taskRowHit,
  settingsSegSet,
  inRect,
  font,
  fontB,
  titlePointerDown,
  titlePointerMove,
  titlePointerUp,
  titlePointerCancel,
  updateTitle,
} from './game/screens';
import type { RunResult, ShareGrid, SettingsCat, SettingsSliderKey } from './game/screens';
import { taskViews, claimTask, taskTick, type TaskPeriod } from './game/tasks';
import type { PokeType } from './game/types';

type Scene = 'loading' | 'title' | 'draft' | 'charm' | 'battle' | 'result';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// extra logical space the letterbox leaves above/below the 960 box on
// tall phone screens — the arena grows into it instead of black bars
let viewPad = 0;
const arenaRect = () => ({ x: 24, y: 72 - viewPad, w: W - 48, h: H - 92 + viewPad * 2 });

// seeds stay in 1..2^31 so they survive the ?seed= round-trip in a share link
const randSeed = () => ((Math.random() * 2 ** 31) >>> 0) || 1;
// the daily climb: one UTC date seed — same climb for everyone, everywhere
const dailySeed = () => Number(new Date().toISOString().slice(0, 10).replaceAll('-', ''));

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
// the run's bag picks — ≤2 pk_bag consumables toggled on the draft board,
// spent the moment the last pick constructs the Battle (never earlier)
let bagPick = new Set<string>();
let bagLast: string | null = null; // last tapped chip — its desc rides the row
let stage = makeStage(randSeed());
// the run's roll source — always seeded: draft deals and the Battle both
// draw from it, so every run reproduces from its seed (shares carry it)
let runSeed = 0;
let runIsDaily = false; // a shared-date climb — the share card says so
let runRng: () => number = Math.random;
let helpOpen = false;
let menuOpen = false; // overworld TEAM · ITEMS panel
let settingsOpen = false;
let tasksOpen = false;
let tasksTab: TaskPeriod = 'daily';
let settingsCat: SettingsCat = 'sound';
let settingsDrag: { key: SettingsSliderKey } | null = null;
let helpPage = 0;
let dexOpen = false;
let dexScroll = 0;
let achOpen = false;
let achScroll = 0;
let boardOpen = false;
let dexDrag: { y0: number; s0: number; moved: boolean } | null = null;
let helpDrag: { x0: number; y0: number; moved: boolean } | null = null;
let result: RunResult | null = null;
let startOffers: Perk[] = []; // starter charm pick between draft and battle
let charmPicks = 1; // ASC 3+ veterans start the climb with two charms
let charmBonus = false;
let resultExtra: string | null = null;
let share: ShareGrid | null = null;
let shareText = '';
let t = 0;
let fpsEma = 0; // SHOW FPS counter — smoothed over ~12 live frames
// gyms already banked this battle — the delta feeds recordGymWin
let lastGyms = 0;
let lastPhase = ''; // battle phase last frame — map-entry edges bank the run
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
  // point where extra pixels stop being visible but still cost fill-rate.
  // battery saver halves both the frame rate (loop.ts) and the fill-rate.
  const dpr = settings().battery ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
  (window as unknown as { __dbg: { scene: () => Scene; battle: () => Battle | null; xy: (x: number, y: number) => { x: number; y: number }; stats: typeof statsDump } }).__dbg = {
    scene: () => scene,
    battle: () => battle,
    xy: (x, y) => { const p = toLogical({ clientX: x, clientY: y } as PointerEvent); return { x: p.x, y: p.y }; },
    stats: statsDump, // the on-device metric server — pick rates + stage deaths
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
  // waveIndex is -1 at HOME — a run that ends there cleared nothing, and a
  // throw here reruns the whole record block every frame
  const cleared = Math.max(0, won ? TOTAL_STAGES : b.waveIndex);
  const waves =
    '🟩'.repeat(cleared) + (won ? '' : '🟥') + '⬛'.repeat(TOTAL_STAGES - cleared - (won ? 0 : 1));
  const team = draft.picked.map((i) => TYPE_SQ[draftPool[i].type]).join('');
  return { waves, team, copied: false };
}

// Offers for the current round — never re-offer a species already on the
// team; top up from unpicked species when the deal runs dry. Rolled ONCE
// per round and cached: re-rolling in render would flicker the cards.
let offerCache: number[] | null = null;
// slot-reel reveal: draftT0 marks when the board dealt, draftLanded counts
// the reels already stopped — a tap mid-spin fast-forwards to the dealt board
let draftT0 = 0;
let draftLanded = 0;
function respinDraft() {
  draftT0 = t;
  draftLanded = 0;
}
// item offers spin the same reels — rewardT0 stamps when the board dealt
let rewardT0 = 0;
let rewardLanded = 0;
let wasReward = false;
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

// --- reward-board actions shared by pointer and keys ---------------------
// pickPerk/declineReward play their own sfx inside battle; the tools don't,
// so the input layer owns their click.

const rewardPick = (i: number) => {
  if (!battle || i >= battle.rewardOffers.length) return;
  const ids = battle.rewardOffers.map((p) => p.id);
  // an armed banish turns the card tap into a pool kill instead of a pick
  if (battle.banArmed) {
    const id = battle.banishPerk(i);
    if (id != null) {
      statOffer('perkban', ids, id);
      sfx('ui');
    }
    return;
  }
  statOffer('perks', ids, battle.rewardOffers[i].id);
  battle.pickPerk(i);
};

const rewardReroll = () => {
  if (!battle) return;
  const ids = battle.rewardOffers.map((p) => p.id);
  if (!battle.rerollOffers()) return;
  statOffer('perks', ids, null); // rejected board — nobody took it
  rewardT0 = t; // the reels deal again for the new offers
  rewardLanded = 0;
  sfx('ui');
};

const rewardSkip = () => {
  if (!battle || battle.phase !== 'reward') return;
  statOffer('perks', battle.rewardOffers.map((p) => p.id), null);
  battle.declineReward();
};

const charmPick = (i: number) => {
  const perk = startOffers[i];
  if (!perk) return;
  sfx('ui');
  if (battle) {
    statOffer('perks', startOffers.map((p) => p.id), perk.id);
    battle.grantPerk(perk);
    battle.perksTaken++;
  }
  startOffers.splice(i, 1);
  if (charmPicks - 1 > 0 && startOffers.length) {
    charmPicks--;
    return; // ascension bonus: take a second
  }
  startOffers = [];
  scene = 'battle';
  sceneMusic();
};

// the draft pick shared by pointer and keys — the last pick builds the run
const draftPick = (i: number) => {
  if (draft.picked.length >= DRAFT_ROUNDS) return;
  const offers = draftOffers();
  if (i >= offers.length) return;
  sfx('ui');
  cry(draftPool[offers[i]].id, 0.15); // picked mon calls out — quiet, the ogg cries are hot
  statOffer('draft', offers.map((o) => draftPool[o].id), draftPool[offers[i]].id);
  draft.picked.push(offers[i]);
  offerCache = null;
  respinDraft(); // next round spins a fresh board
  if (draft.picked.length !== DRAFT_ROUNDS) return;
  battle = new Battle(arenaRect(), draft.picked.map(draftDef), stage, runRng, [...bagPick]);
  if (bagPick.size) spendBag([...bagPick]); // run locked — the picks leave the bag
  menuOpen = false;
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
  // the charm pick gates the climb — ASC 3+ pays out a second charm
  startOffers = rollPerks(runRng, 3, rank(), battle.teamTypes());
  charmBonus = battle.asc >= 3;
  charmPicks = charmBonus ? 2 : 1;
  scene = 'charm';
};

// A run's draft pool is the roster plus everything the dex has caught that
// isn't already in it — catching mons is how new faces join future drafts.
// draftOrder only deals roster indices, so the extras get shuffled into the
// deal here or they'd never be offered.
// one run setup shared by START CLIMB, DAILY and REMATCH — ?seed=NNN
// always wins (debug/sharing), else the daily date seed or a fresh roll
let titleSave: RunSave | null = null; // pk_run peek for the title's CONTINUE button

function newRun(daily = false) {
  const forced = Number(new URLSearchParams(location.search).get('seed'));
  const hasForced = Number.isFinite(forced) && forced > 0;
  runSeed = hasForced ? forced : daily ? dailySeed() : randSeed();
  runIsDaily = daily && !hasForced;
  runRng = mulberry32(runSeed);
  stage = makeStage(runSeed);
  clearRun(); // a fresh climb drops the old one
}

// bank the climb whenever the team is parked on the map — mid-fight tabs
// resume at the last stop, not mid-wave
function bankRun() {
  const s = battle?.snapshot();
  if (s) {
    s.seed = runSeed;
    s.daily = runIsDaily;
    saveRun(s);
  }
}
window.addEventListener('pagehide', bankRun);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) bankRun();
});

// A saved climb skips the draft/charm entirely — same seed, same island
// (region regens from mapSeed), perks replayed through grantPerk.
function resumeRun(s: RunSave) {
  runSeed = s.seed;
  runIsDaily = s.daily;
  runRng = mulberry32(runSeed);
  stage = makeStage(runSeed);
  const team = s.team
    .map((e): SpeciesDef | null => {
      const base = speciesById(e.id);
      return base ? { ...base, lvl: e.lvl, shiny: e.shiny || undefined } : null;
    })
    .filter((d): d is SpeciesDef => !!d);
  if (!team.length) return; // a team-less save can't fight — fall through to title
  clearRun();
  battle = new Battle(arenaRect(), team, stage, runRng);
  battle.rank = rank();
  battle.asc = s.asc;
  battle.bestScore = best().score;
  battle.shinyRate = shinyCharm() ? 2 : 1;
  const echo = echoIds()
    ?.map((e) => ({ def: speciesById(e.id), lvl: e.lvl }))
    .filter((e): e is { def: SpeciesDef; lvl: number } => !!e.def);
  battle.echo = echo?.length ? echo : null;
  battle.applySnapshot(s);
  scene = 'battle';
  sceneMusic();
}

function startDraft() {
  // Catches feed the draft by tier: weak species join the general deal as
  // new faces, but tier-2+ monsters only surface on the ace board — a caught
  // Dragonite is a last-pick treat, not a round-one freebie.
  const caught = dexIds()
    .map(speciesById)
    .filter((d): d is SpeciesDef => !!d && !ROSTER.some((r) => r.id === d.id));
  draftPool = [...ROSTER, ...caught.filter((d) => tierOf(d) <= 1)];
  const aceCandidates = [...ACE_POOL];
  for (const d of caught) {
    if (tierOf(d) >= 2 && !aceCandidates.some((a) => a.id === d.id)) aceCandidates.push(d);
  }
  // TRIPLE CROWN (3 wins) pays a second board reshuffle — the draft gets
  // friendlier once you've proven the climb
  const rerolls = 1 + (unlockedAch().has('triple') ? 1 : 0);
  draft = { order: draftOrder(runRng), picked: [], shiny: new Set(), lvls: new Map(), rerolls };
  for (let i = ROSTER.length; i < draftPool.length; i++) {
    draft.order.splice(Math.floor(runRng() * (draft.order.length + 1)), 0, i);
  }
  // ace round: the last pick always deals three veterans — three scrappy
  // picks stay, but every team gets one anchor with an evo ceiling
  const aceTypes = new Set<string>();
  const aces: number[] = [];
  while (aces.length < 3) {
    const c = aceCandidates[Math.floor(runRng() * aceCandidates.length)];
    if (aceTypes.has(c.type)) continue;
    aceTypes.add(c.type);
    aces.push(draftPool.push(c) - 1);
  }
  draft.order.splice((DRAFT_ROUNDS - 1) * 3, 3, ...aces);
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
  bagPick.clear();
  bagLast = null;
  offerCache = null;
  respinDraft();
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
  respinDraft();
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
  // the settings modal too — tabs switch, sliders grab, toggles flip on
  // pointerdown; CLOSE or a tap outside dismisses
  if (settingsOpen) {
    if (inRect(p.x, p.y, SETTINGS_CLOSE) || !inRect(p.x, p.y, SETTINGS_PANEL)) {
      settingsOpen = false;
      settingsDrag = null;
      sfx('ui');
      return;
    }
    const hit = settingsRowHit(p, settingsCat);
    if (hit?.kind === 'tab') {
      const next = SETTINGS_CATS[hit.i].id;
      if (next !== settingsCat) {
        settingsCat = next;
        sfx('ui');
      }
      return;
    }
    if (hit?.kind === 'slider') {
      settingsDrag = { key: hit.key };
      settingsSliderSet(hit.key, p.x); // a tap on the track jumps to x
      return;
    }
    if (hit?.kind === 'toggle') {
      settingsToggleFlip(hit.key);
      if (hit.key === 'battery') resize(); // the dpr cap applies now, not on next resize
      sfx('ui');
      return;
    }
    if (hit?.kind === 'seg') {
      settingsSegSet(hit.key, hit.i);
      sfx('ui');
      return;
    }
    return; // dead panel space is still modal
  }
  // the tasks board swallows taps while it's up — claim, tab, or close
  if (tasksOpen) {
    const hit = taskRowHit(p, tasksTab);
    if (hit?.kind === 'close') {
      tasksOpen = false;
      sfx('ui');
      return;
    }
    if (hit?.kind === 'tab') {
      tasksTab = TASKS_TABS[hit.i];
      sfx('ui');
      return;
    }
    if (hit?.kind === 'claim' && hit.i != null) {
      const v = taskViews(tasksTab)[hit.i];
      if (v && claimTask(v.id)) sfx('caught'); // the bag pays out
      return;
    }
    return;
  }
  if (scene === 'title') {
    if (dexOpen || achOpen || boardOpen) {
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
    if (inRect(p.x, p.y, BOARD_BTN)) {
      sfx('ui');
      boardOpen = true;
      return;
    }
    if (inRect(p.x, p.y, TASKS_BTN)) {
      sfx('ui');
      tasksOpen = true;
      tasksTab = 'daily';
      return;
    }
    if (inRect(p.x, p.y, HELP_BTN)) {
      sfx('ui');
      helpOpen = true;
      helpPage = 0;
      return;
    }
    if (inRect(p.x, p.y, GEAR_BTN)) {
      sfx('ui');
      settingsOpen = true;
      settingsCat = 'sound';
      return;
    }
    if (inRect(p.x, p.y, MUTE_BTN)) {
      toggleMute();
      sfx('ui'); // plays only when unmuting
      return;
    }
    if (titleSave && inRect(p.x, p.y, NEW_BTN)) {
      // start over — the parked climb is dropped for a fresh seed
      sfx('ui');
      newRun();
      titleSave = null;
      startDraft();
      scene = 'draft';
      sceneMusic();
      return;
    }
    if (inRect(p.x, p.y, FREE_BTN)) {
      sfx('ui');
      if (titleSave) {
        const s = titleSave;
        titleSave = null;
        resumeRun(s);
      } else {
        newRun();
        startDraft();
        scene = 'draft';
      }
      sceneMusic();
      return;
    }
    if (inRect(p.x, p.y, DAILY_BTN)) {
      // same date seed for everyone — the climb itself is the share
      sfx('ui');
      newRun(true);
      startDraft();
      scene = 'draft';
      sceneMusic();
      return;
    }
    // the pitch is playable — a drag on the grass grabs the demo ball
    if (titlePointerDown(p)) return;
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    // bag chips are their own control — a tap toggles the pick and never
    // fast-forwards the reels (and the row sits clear of the offer cards)
    if (inRect(p.x, p.y, BAG_ROW)) {
      const items = bagRowItems();
      for (let i = 0; i < items.length; i++) {
        if (!inRect(p.x, p.y, bagChipRect(i, items.length))) continue;
        const id = items[i].id;
        bagLast = id; // even a denied tap shows what the item does
        if (bagPick.has(id)) {
          bagPick.delete(id);
          sfx('ui');
        } else if (bagPick.size < BAG_MAX) {
          bagPick.add(id);
          sfx('ui');
        } else {
          sfx('ui', 0.6); // third pick denied — a low thud, no shake
        }
        return;
      }
    }
    if (draft.rerolls > 0 && inRect(p.x, p.y, DRAFT_REROLL)) {
      rerollDraft();
      return;
    }
    // reels still rolling — any tap fast-forwards to the dealt board
    if (t - draftT0 < REEL_STOPS[REEL_STOPS.length - 1]) {
      draftT0 = t - REEL_STOPS[REEL_STOPS.length - 1];
      return;
    }
    const offers = draftOffers();
    for (let i = 0; i < offers.length; i++) {
      if (inRect(p.x, p.y, draftCardRect(i))) {
        draftPick(i);
        return;
      }
    }
  } else if (scene === 'charm') {
    if (inRect(p.x, p.y, CHARM_SKIP)) {
      // declining the charm pays score instead — dead offers have a price
      sfx('ui');
      statOffer('perks', startOffers.map((p) => p.id), null);
      if (battle) battle.score += 200;
      startOffers = [];
      scene = 'battle';
      sceneMusic();
      return;
    }
    for (let i = 0; i < startOffers.length; i++) {
      if (inRect(p.x, p.y, perkCardRect(i))) {
        charmPick(i);
        return;
      }
    }
    return;
  } else if (scene === 'battle') {
    // mid-run reference: the ? chip shows between fights
    if (battle && (battle.phase === 'map' || battle.phase === 'reward') && !menuOpen) {
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
    // the team panel is modal over the map AND the reward screen — CLOSE
    // or a tap outside dismisses; inside, roster ops only
    if (battle && menuOpen && (battle.phase === 'map' || battle.phase === 'reward')) {
      if (inRect(p.x, p.y, MENU_CLOSE) || !inRect(p.x, p.y, TEAM_PANEL)) {
        menuOpen = false;
        battle.boxSel = -1;
        battle.teamSel = -1;
        sfx('ui');
        return;
      }
      if (battle.box.length > 0 && inRect(p.x, p.y, BOX_STRIP)) {
        boxDrag = { x0: p.x, s0: boxScroll, moved: false };
        return;
      }
      for (let i = 0; i < battle.players.length; i++) {
        if (!inRect(p.x, p.y, teamSlotRect(i))) continue;
        if (battle.boxSel >= 0) battle.swapFromBox(battle.boxSel, i);
        else if (battle.box.length > 0) {
          battle.teamSel = battle.teamSel === i ? -1 : i;
          sfx('ui');
        }
        return;
      }
      return;
    }
    if (battle?.phase === 'map') {
      if (!battle.mapModal && inRect(p.x, p.y, MAP_MENU)) {
        sfx('ui');
        menuOpen = true;
        battle.boxPing = false; // looked — the bouncing ball did its job
        battle.boxSel = battle.teamSel = -1; // no stale pick from the reward break
        return;
      }
    }
    if (battle?.phase === 'reward') {
      // a split evolution swallows taps until its form is chosen
      if (battle.evoChoice) {
        const opts = battle.evoChoice.options;
        for (let i = 0; i < opts.length; i++) {
          if (inRect(p.x, p.y, evoCardRect(i, opts.length))) battle.pickEvo(i);
        }
        return;
      }
      // the catch card or the TEAM · ITEMS button opens the box mid-pick —
      // same modal the map carries, the relic pick waits
      if (inRect(p.x, p.y, REWARD_TEAM) || (battle.boxGain && inRect(p.x, p.y, REWARD_CATCH))) {
        sfx('ui');
        menuOpen = true;
        battle.boxPing = false;
        battle.boxSel = battle.teamSel = -1;
        return;
      }
      // the relic pick. Reels still rolling — a tap fast-forwards,
      // never picks blind
      if (t - rewardT0 < REEL_STOPS[REEL_STOPS.length - 1]) {
        rewardT0 = t - REEL_STOPS[REEL_STOPS.length - 1];
        return;
      }
      // the tool row: reroll re-deals, skip cashes out, banish arms a card tap
      if (inRect(p.x, p.y, TOOL_ROLL)) {
        rewardReroll();
        return;
      }
      if (inRect(p.x, p.y, TOOL_SKIP)) {
        rewardSkip();
        return;
      }
      if (inRect(p.x, p.y, TOOL_BAN)) {
        if (battle.toggleBanish()) sfx('ui');
        return;
      }
      for (let i = 0; i < battle.rewardOffers.length; i++) {
        if (inRect(p.x, p.y, perkCardRect(i))) {
          rewardPick(i);
          return;
        }
      }
      return;
    } else {
      battle?.pointerDown(p);
    }
  } else if (scene === 'result') {
    if (inRect(p.x, p.y, SHARE_BTN)) {
      sfx('ui');
      shareResult();
    } else if (inRect(p.x, p.y, RETRY_BTN)) {
      // REMATCH: one tap back into a fresh draft — rolls fresh unless a
      // ?seed= is pinned, which replays the same island
      sfx('ui');
      newRun();
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
      titleSave = runSave();
      sceneMusic();
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  if (settingsDrag) {
    settingsSliderSet(settingsDrag.key, p.x); // write-through, no click spam
    syncVolumes(); // master/music are node params — poke them live
    return;
  }
  if (settingsOpen) return;
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
  if (scene === 'title') titlePointerMove(p);
  if (scene === 'battle') battle?.pointerMove(p);
});

canvas.addEventListener('pointerup', (e) => {
  if (settingsDrag) {
    settingsDrag = null;
    sfx('ui'); // one click on release, not a stream while dragging
    return;
  }
  if (settingsOpen) return;
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
      boardOpen = false;
    }
    return;
  }
  if (boxDrag) {
    const { moved } = boxDrag;
    boxDrag = null;
    // a drag that never moved is a tap: pick a catch, then a teammate to swap into
    if (!moved && scene === 'battle' && battle && (battle.phase === 'map' || battle.phase === 'reward') && menuOpen) {
      const p = toLogical(e);
      if (inRect(p.x, p.y, BOX_STRIP)) {
        for (let i = 0; i < battle.box.length; i++) {
          if (!inRect(p.x, p.y, boxSlotRect(i, battle.box.length, boxScroll))) continue;
          if (battle.teamSel >= 0) battle.swapFromBox(i, battle.teamSel);
          else {
            battle.boxSel = battle.boxSel === i ? -1 : i;
            sfx('ui');
          }
          break;
        }
      }
    }
    return;
  }
  if (scene === 'title') titlePointerUp();
  if (scene === 'battle') battle?.pointerUp();
});
// desktop keys: Esc/? toggles the manual, arrows page it, P pauses a live
// fight, M mutes — pointer paths stay the single source of truth
addEventListener('keydown', (e) => {
  unlockAudio();
  if (helpOpen) {
    if (e.key === 'Escape' || e.key === '?') helpOpen = false;
    else if (e.key === 'ArrowRight') helpPage = Math.min(helpPage + 1, HELP_PAGE_COUNT - 1);
    else if (e.key === 'ArrowLeft') helpPage = Math.max(0, helpPage - 1);
    return;
  }
  if (tasksOpen) {
    if (e.key === 'Escape') {
      tasksOpen = false;
      sfx('ui');
    }
    return;
  }
  // Esc dismisses settings — swallowed here so it can't fall through to help
  if (settingsOpen) {
    if (e.key === 'Escape') {
      settingsOpen = false;
      settingsDrag = null;
      sfx('ui');
    }
    return;
  }
  // the dealt boards take keys too — [1..3] picks (or banishes when armed),
  // R rerolls, Z arms banish, X cashes out; Escape disarms before help opens
  if (scene === 'draft' && draftLanded >= REEL_STOPS.length) {
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0) {
      draftPick(i);
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && draft.rerolls > 0) {
      rerollDraft();
      return;
    }
  }
  if (scene === 'charm') {
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0 && i < startOffers.length) {
      charmPick(i);
      return;
    }
  }
  if (
    scene === 'battle' &&
    battle?.phase === 'reward' &&
    !menuOpen &&
    !battle.evoChoice &&
    rewardLanded >= REEL_STOPS.length
  ) {
    if (e.key === 'Escape' && battle.banArmed) {
      battle.toggleBanish();
      sfx('ui');
      return;
    }
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0 && i < battle.rewardOffers.length) {
      rewardPick(i);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      rewardReroll();
      return;
    }
    if (e.key === 'z' || e.key === 'Z') {
      if (battle.toggleBanish()) sfx('ui');
      return;
    }
    if (e.key === 'x' || e.key === 'X') {
      rewardSkip();
      return;
    }
  }
  if (e.key === 'Escape' || e.key === '?') {
    helpOpen = true;
    helpPage = 0;
  } else if ((e.key === 'p' || e.key === 'P') && battle && (battle.phase === 'aim' || battle.phase === 'shot' || battle.phase === 'enemy')) {
    battle.paused = !battle.paused;
    if (battle.paused) battle.pointerCancel(); // a frozen game drops the half-pull
    sfx('ui');
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  }
});

canvas.addEventListener('pointercancel', () => {
  helpDrag = null;
  dexDrag = null;
  boxDrag = null;
  settingsDrag = null;
  // an interrupt isn't a release — drop the drag, don't fire the shot
  if (scene === 'title') titlePointerCancel();
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
    if (scene !== 'battle' || !battle || !((battle.phase === 'map' || battle.phase === 'reward') && menuOpen)) return;
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
  drawHud(ctx, battle.waveIndex, battle.shots, name, battle.score, battle.streak, battle.ultIn, battle.time);
  ctx.restore();
}

// phones auto-lock mid-run — hold a screen wake lock while a run is live.
// The OS drops it when the tab hides, so visibilitychange re-acquires.
let wakeLock: { release(): Promise<void> } | null = null;
let wakeReq = false;
function syncWake() {
  const want = !!battle && scene !== 'result' && scene !== 'title';
  if (want && !wakeLock && !wakeReq && 'wakeLock' in navigator) {
    wakeReq = true;
    navigator.wakeLock
      .request('screen')
      .then((l) => (wakeLock = l))
      .catch(() => {})
      .finally(() => (wakeReq = false));
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    wakeLock = null; // the OS already released it while hidden
    syncWake();
  }
});

function update(dt: number) {
  t += dt;
  if (dt > 0) fpsEma = fpsEma ? fpsEma + (1 / dt - fpsEma) * 0.08 : 1 / dt;
  syncWake();
  if (scene === 'title') updateTitle(dt);
  if (scene === 'battle' && battle && !helpOpen) {
    // the manual freezes the fight — reading help mid-shot shouldn't cost HP
    battle.update(dt);
    // the item reels deal when the reward screen opens
    const itemStep = battle.phase === 'reward';
    if (itemStep && !wasReward) {
      rewardT0 = t;
      rewardLanded = 0;
    }
    wasReward = itemStep;
    if (battle.phase !== 'reward' && !(battle.phase === 'map' && menuOpen)) boxScroll = 0;
    if (battle.phase !== 'map' && battle.phase !== 'reward') menuOpen = false;
    // a resolved stop banks the run — the climb survives a closed tab
    if (battle.phase === 'map' && lastPhase !== 'map') bankRun();
    lastPhase = battle.phase;
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
      statRunEnd(stageReached, won);
      // tasks accrue at run end — abandoned climbs bank nothing
      taskTick({
        kos: battle.totalKos,
        catches: battle.box.length,
        stages: stageReached,
        gyms: battle.gymsBeaten,
        perks: battle.perksTaken,
        score: battle.score,
        shinies: battle.shiniesCaught,
        runs: 1,
        wins: won ? 1 : 0,
        maxstage: stageReached,
      });
      const dexBefore = dexIds().length;
      const prevBest = best().score;
      const mvp = battle.players.reduce((a, p) => (p.lvl > a.lvl ? p : a), battle.players[0]);
      const newBest = recordRun(battle.score, stageReached, won);
      const gap = prevBest - battle.score;
      // the ladder grades every run — deep runs climb, early wipes bleed
      const rr = applyRunRating(stageReached, won, battle.asc);
      // hall of fame: log the run, keep the slot it earned (-1 = missed)
      const place = recordBoard({
        s: battle.score,
        st: stageReached,
        w: won,
        asc: battle.asc,
        team: battle.players.map((p) => p.def.id),
        when: Date.now(),
      });
      result = {
        won,
        runNo: best().runs,
        depth: stageReached,
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
        rating: { delta: rr.delta, tier: rr.tier.name, color: rr.tier.color, up: rr.promoted },
        place,
        seed: runSeed,
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
        if (battle.killer) extra += ` — felled by ${battle.killer.toUpperCase()}`;
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
        if (nextAsc > battle.asc && nextAsc <= 9) {
          // name the new modifier when a threshold tier unlocks
          const mod =
            nextAsc === 2 ? ' foes wind up faster.' :
            nextAsc === 3 ? ' you start with two charms.' :
            nextAsc === 4 ? ' Poké Centers heal less.' :
            nextAsc === 6 ? ' gym leaders arrive enraged.' :
            ' the climb gets meaner.';
          resultExtra = `ASCENSION ${nextAsc} UNLOCKED —${mod}`;
        }
      }
      const teamNames = battle.players.map((p) => p.def.name).join(' · ');
      shareText = [
        runIsDaily
          ? `⚾ POKÉSTRIKE DAILY ${new Date().toISOString().slice(0, 10)} — same climb for everyone`
          : `⚾ POKÉSTRIKE: sling & ricochet Pokémon roguelike`,
        `🗺️ ${stage.name}: ${won ? 'cleared!' : `stage ${stageReached}/${TOTAL_STAGES}`}${battle.asc ? ` · ASC ${battle.asc}` : ''}`,
        share.waves,
        `✨ ${teamNames}`,
        ...(mvp.lvl > 1 ? [`👑 MVP ${mvp.def.name.toUpperCase()} Lv${mvp.lvl}`] : []),
        `⭐ ${result.score.toLocaleString('en-US')} pts · ⚡ ${result.shots} shots${result.caught ? ` · 📦 ${result.caught} caught` : ''}`,
        `🏅 ${result.badges.slice(0, 4).map((b) => b.name).join(' · ')}`,
        share.team,
        // the seed rides the link — opening it replays this exact climb
        `${location.origin}${location.pathname}?seed=${runSeed}`,
      ].join('\n');
      clearRun(); // the climb is over — nothing to continue into
      scene = 'result';
      music(won ? 'win' : null); // clear fanfare, or cut to silence on a loss
    }
  }
  // draft reels land one by one — a rising thunk per stop
  if (scene === 'draft') {
    const landed = REEL_STOPS.filter((s) => t - draftT0 >= s).length;
    if (landed > draftLanded) {
      draftLanded = landed;
      sfx('bounce', 0.8 + landed * 0.25);
    }
  }
  // item reels thunk the same way when the reward board deals
  if (scene === 'battle' && battle?.phase === 'reward') {
    const landed = REEL_STOPS.filter((s) => t - rewardT0 >= s).length;
    if (landed > rewardLanded) {
      rewardLanded = landed;
      sfx('bounce', 0.8 + landed * 0.25);
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
      drawTitle(ctx, t, titleSave ? { stage: titleSave.pendingNext + 1, score: titleSave.score } : null);
      if (dexOpen) drawDex(ctx, dexScroll);
      if (achOpen) drawAch(ctx, achScroll);
      if (boardOpen) drawBoard(ctx);
      break;
    case 'charm':
      drawPerkPick(ctx, startOffers, 'CHOOSE YOUR CHARM',
        charmBonus ? (charmPicks > 1 ? 'ASCENSION III BONUS — take two charms' : 'one more — ascension pays')
                   : 'one held item starts the climb',
        t, draft.picked.map(draftDef));
      break;
    case 'draft': {
      const idx = draftOffers();
      drawDraft(
        ctx,
        idx.map(draftDef),
        draft.picked.map(draftDef),
        stage.name,
        t,
        draft.rerolls,
        { age: t - draftT0, pool: draftPool, idx },
        { sel: bagPick, last: bagLast },
      );
      break;
    }
    case 'battle':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        hud(battle.hardWave ? `${battle.stage.name} · TRAINER` : battle.stage.name);
        battle.render(ctx);
        if (battle.phase === 'reward') {
          drawReward(
            ctx,
            battle.rewardOffers,
            battle.boxGain,
            {
              stage: battle.waveIndex + 2,
              gym: battle.nextIsGym,
              rolled: battle.nextIsRolled,
            },
            battle.score,
            battle.heldItems,
            battle.evoChoice,
            battle.teamLuck(),
            t - rewardT0,
            battle.perkIds,
          );
          if (!menuOpen && !battle.evoChoice) drawToolRow(ctx, battle.tools, battle.banArmed, t);
        }
        if (menuOpen && (battle.phase === 'map' || battle.phase === 'reward'))
          drawTeamMenu(
            ctx,
            battle.box,
            battle.boxHp,
            battle.boxLvl,
            battle.players.map((p) => p.def),
            battle.players.map((p) => (p.maxHp ? p.hp / p.maxHp : 0)),
            battle.players.map((p) => p.lvl),
            battle.boxSel,
            battle.teamSel,
            boxScroll,
            battle.captureChance,
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
  if (scene === 'battle' && battle && (battle.phase === 'map' || battle.phase === 'reward') && !menuOpen) {
    drawHelpChip(ctx);
    drawMuteChip(ctx);
  }
  if (helpOpen) drawHelp(ctx, helpPage);
  if (settingsOpen) drawSettings(ctx, settingsCat, settings());
  if (tasksOpen) drawTasks(ctx, taskViews(tasksTab), tasksTab, t);
  // playtester lifeline: you can't see their console — a crash paints
  // itself with the run's seed and build, so one screenshot is the report
  if (crash) {
    ctx.fillStyle = 'rgba(11,14,26,0.94)';
    ctx.fillRect(16, H / 2 - 110, W - 32, 220);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, H / 2 - 110, W - 32, 220);
    ctx.textAlign = 'center';
    ctx.font = font(11);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('CRASHED — SCREENSHOT THIS', W / 2, H / 2 - 76);
    ctx.font = fontB(9);
    ctx.fillStyle = '#f8d030';
    ctx.fillText(`seed ${runSeed} · ${__BUILD__}`, W / 2, H / 2 - 48);
    ctx.font = fontB(8);
    ctx.fillStyle = '#fff';
    // crude mid-word wrap — detail beats pretty on a crash card
    const msg = crash.slice(0, 150);
    for (let i = 0; i < Math.ceil(msg.length / 50); i++)
      ctx.fillText(msg.slice(i * 50, (i + 1) * 50), W / 2, H / 2 - 22 + i * 14);
  }
  // SHOW FPS: dim counter in the bottom-right corner — letterbox on tall
  // screens, the box's bottom edge otherwise; clear of the chips up top
  if (settings().fps) {
    ctx.textAlign = 'right';
    ctx.font = fontB(9);
    ctx.fillStyle = '#ffffff60';
    ctx.fillText(`${Math.round(fpsEma)} FPS`, W - 10, H + viewPad - 10);
  }
  ctx.restore();
}

// first error wins — the root cause, not the cascade behind it
let crash: string | null = null;
addEventListener('error', (e) => (crash ??= String(e.message || e.error || 'unknown')));
addEventListener('unhandledrejection', (e) => (crash ??= String(e.reason)));

// upgrade any legacy pk_* saves before the game reads them
migrateSaves();

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
  ...BADGES.map((b) => loadItem(`badges/${b.icon}`)),
  document.fonts.load('700 10px rc').catch(() => console.warn('rc font failed, using monospace')),
  document.fonts.load('10px ps2p').catch(() => console.warn('ps2p font failed, using rc')),
])
  .then(() => {
    scene = 'title';
    titleSave = runSave();
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
