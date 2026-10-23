import './style.css';
import { startLoop } from './core/loop';
import { unlockAudio, sfx, music, toggleMute, syncVolumes, playJingle, buzz, TRACKS } from './core/audio';
import type { TrackName } from './core/audio';
import { loadAll, loadItem, loadGracidea, loadNpcs } from './core/assets';
import { mulberry32 } from './core/rng';
import { vec } from './core/vec';
import { Battle, PAUSE_QUIT, PAUSE_SETTINGS } from './game/battle';
import { PERKS, rollPerks } from './game/perks';
import type { Perk } from './game/perks';
import { ROSTER, makeStage, draftOrder, DRAFT_ROUNDS, ALL_SPRITE_IDS, TOTAL_STAGES, speciesById, ACE_POOL, tierOf, pullSpecies, PULL_COST, PULL10_COST, PULL_PITY, DUST_BY_TIER, INVADER_IDS, shinyOdds, AVATARS } from './game/data';
import type { SpeciesDef, StageDef } from './game/data';
import { THEMES } from './game/bg';
import { dexIds, recordCapture, recordShiny, recordGymWin, rank, echoIds, saveEcho, clearEcho, recordRun, best, shinyCharm, unlockAch, unlockedAch, ACHIEVEMENTS, coachDone, markCoached, resetCoach, BADGES, applyRunRating, recordBoard, migrateSaves, statOffer, statRunEnd, statsDump, saveRun, runSave, clearRun, settings, spendBag, bumpStreaks, streakWins, streakDaily, ascPick, ascCap, setAsc, stars, addStars, starBoost, grantBoost, raidDoneToday, markRaidDone, spendStars, dust, addDust, spendDust, pullCount, bumpPulls, buyLab, statPull, firstWinBonus, grindBonus, freePullLeft, useFreePull, claimDexRewards, rookieCheck, helpSeen, markHelpSeen, setTrainer, setsReady, claimSet, bankBond, board, type RunSave } from './game/meta';
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
  EVO_KEEP,
  boxSlotRect,
  boxScrollMax,
  BOX_STRIP,
  teamSlotRect,
  RETRY_BTN,
  SHARE_BTN,
  TITLE_BTN,
  FREE_BTN,
  RESTART_BTN,
  ASC_BTN,
  hitAscCell,
  noteAscDeny,
  HELP_BTN,
  HELP_CHIP_HIT,
  GEAR_BTN,
  MUTE_CHIP_HIT,
  MAP_GEAR_HIT,
  drawHelpChip,
  drawMuteChip,
  drawGearChip,
  MUTE_BTN,
  DRAFT_REROLL,
  REEL_STOPS,
  BAG_ROW,
  BAG_MAX,
  bagChipRect,
  bagRowItems,
  drawHelp,
  drawBugCard,
  BUG_HIT,
  drawPerkPick,
  CHARM_SKIP,
  TOOL_ROLL,
  TOOL_BAN,
  drawToolRow,
  REWARD_TEAM,
  REWARD_CATCH,
  HELP_PANEL,
  HELP_PREV,
  HELP_NEXT,
  HELP_TUT,
  HELP_CLOSE_HIT,
  HELP_PAGE_COUNT,
  DEX_BTN,
  drawDex,
  drawDexDetail,
  dexRowAt,
  dexScrollMax,
  ACH_BTN,
  drawAch,
  achScrollMax,
  BOARD_BTN,
  HALL_BTN,
  drawBoard,
  CATCHABLE,
  MAP_MENU,
  TEAM_PANEL,
  MENU_CLOSE,
  MENU_QUIT,
  drawTeamMenu,
  SETTINGS_PANEL,
  SETTINGS_CLOSE,
  SETTINGS_CATS,
  drawSettings,
  settingsRowHit,
  settingsSliderSet,
  settingsSliderFlush,
  settingsToggleFlip,
  TASKS_BTN,
  TASKS_TABS,
  HOF_CLIMB,
  drawTasks,
  taskRowHit,
  settingsSegSet,
  HATCH_BTN,
  LAB_BTN,
  PULL1_BTN,
  PULL10_BTN,
  SKIP_PULL_BTN,
  drawHatch,
  drawLab,
  sparkHit,
  HATCH_PANEL,
  labHit,
  labScrollMax,
  hatchScrollMax,
  inRect,
  slop,
  font,
  fontB,
  TAB_CELLS,
  noteTabPress,
  noteTabSwap,
  takeClimbSeed,
  DEAL_BTN,
  SETS_BTN,
  PARTNERS_BTN,
  partnersStripAt,
  TEAM_BTN,
  RAID_FIGHT,
  echoMonAt,
} from './game/screens';
import type { RunResult, ShareGrid, SettingsCat, SettingsSliderKey, PullResult, HatchState, HomeTab } from './game/screens';
import { taskViews, claimTask, taskTick, featuredPull, daySeed, raidPick, raidTeam, dealPick, dealCost, type TaskPeriod, type TaskView } from './game/tasks';
import { dailyMod, DAILY_MODS, type DailyMod } from './game/daily';
import type { PokeType } from './game/types';

type Scene = 'loading' | 'title' | 'draft' | 'charm' | 'battle' | 'result';

// crash hooks land before canvas setup — a dead 2d context throws during
// module eval, and listeners parked at file bottom would never hear it.
// first error wins — the root cause, not the cascade behind it
let crash: string | null = null;
// a rejected boot paints this once — a later resize() wipes the bitmap, so
// resize() repaints the fail card while this is set
let bootFail: string | null = null;
const BOOT_RETRY = { x: W / 2 - 100, y: H / 2 + 44, w: 200, h: 46 };

// one card face for both failure modes — dark slab, red rim, wrapped detail
const drawFailCard = (c: CanvasRenderingContext2D, title: string, msg: string, retry: boolean) => {
  c.fillStyle = 'rgba(11,14,26,0.94)';
  c.fillRect(16, H / 2 - 110, W - 32, 220);
  c.strokeStyle = '#ff6b6b';
  c.lineWidth = 2;
  c.strokeRect(16, H / 2 - 110, W - 32, 220);
  c.textAlign = 'center';
  c.font = font(11);
  c.fillStyle = '#ff6b6b';
  c.fillText(title, W / 2, H / 2 - 76);
  c.font = fontB(9);
  c.fillStyle = '#f8d030';
  let seed = 0;
  try {
    seed = runSeed;
  } catch {
    /* module eval died before the seed line ran */
  }
  c.fillText(`seed ${seed} · ${__BUILD__}`, W / 2, H / 2 - 48);
  c.font = fontB(8);
  c.fillStyle = '#fff';
  // crude mid-word wrap — detail beats pretty on a fail card
  const m = msg.slice(0, 150);
  for (let i = 0; i < Math.ceil(m.length / 50); i++) c.fillText(m.slice(i * 50, (i + 1) * 50), W / 2, H / 2 - 22 + i * 14);
  if (retry) {
    c.fillStyle = '#f8d030';
    c.fillRect(BOOT_RETRY.x, BOOT_RETRY.y, BOOT_RETRY.w, BOOT_RETRY.h);
    c.font = font(10);
    c.fillStyle = '#0b0e1a';
    c.fillText('TAP TO RETRY', W / 2, BOOT_RETRY.y + BOOT_RETRY.h / 2 + 7);
  }
};

// the loop may never start (dead ctx, module-eval throw) — paint immediately
// in raw pixels instead of waiting for a render() that isn't coming
const paintCrash = () => {
  try {
    const el = document.getElementById('game') as HTMLCanvasElement | null;
    const c = el?.getContext('2d');
    if (!el || !c || !crash) return;
    const s = Math.min(el.width / W, el.height / H) || 1;
    c.save();
    c.setTransform(s, 0, 0, s, (el.width - W * s) / 2, (el.height - H * s) / 2);
    drawFailCard(c, 'CRASHED — SCREENSHOT THIS', crash, false);
    c.restore();
  } catch {
    /* no context — nothing to paint on */
  }
};
// the fail card draws on the game's own ctx — its letterbox transform is
// already live, and resize() re-calls this after every bitmap wipe
const paintBootFail = () => drawFailCard(ctx, 'FAILED TO LOAD', bootFail ?? '', true);

addEventListener('error', (e) => {
  crash ??= String(e.message || e.error || 'unknown');
  paintCrash();
});
addEventListener('unhandledrejection', (e) => {
  // benign: iOS rejects audio resume/suspend raced outside a gesture — a
  // silent speaker isn't worth a dead run. Sources are wrapped in audio.ts;
  // this is the backstop for any future stray.
  if (String(e.reason).includes('audio device')) return;
  crash ??= String(e.reason);
  paintCrash();
});

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// extra logical space the letterbox leaves above/below the 960 box on
// tall phone screens — the arena grows into it instead of black bars
let viewPad = 0;
const arenaRect = () => ({ x: 24, y: 72 - viewPad, w: W - 48, h: H - 92 + viewPad * 2 });

// seeds stay in 1..2^31 so they survive the ?seed= round-trip in a share link
const randSeed = () => ((Math.random() * 2 ** 31) >>> 0) || 1;
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
// the run's bag picks — ≤2 pk_bag consumables auto-armed when the draft
// deals, spent the moment the last pick constructs the Battle (never earlier)
let bagPick = new Set<string>();
let bagLast: string | null = null; // last tapped chip — its desc rides the row
let stage = makeStage(randSeed());
// the run's roll source — always seeded: draft deals and the Battle both
// draw from it, so every run reproduces from its seed (shares carry it)
let runSeed = 0;
let runIsDaily = false; // a shared-date climb — the share card says so
// the live run's rule card — null off the daily. Re-derived from the seed
// (YYYYMMDD → the same UTC day dailyMod() hashes), so a parked daily resumed
// on a later date keeps the card it started under
let runMod: DailyMod | null = null;
const modForSeed = (s: number) => {
  const d = `${s}`;
  return dailyMod(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
};
let runRng: () => number = mulberry32(runSeed);
// which home tab is showing — session state only (every boot lands on CLIMB)
let homeTab: HomeTab = 'climb';
let helpOpen = false;
let helpWelcome = false; // first-boot open greets; manual opens don't
let bugOpen = false; // the report-a-bug card — seed + build receipt
let menuOpen = false; // overworld TEAM · ITEMS panel
let settingsOpen = false;
let tasksOpen = false;
let tasksTab: TaskPeriod = 'daily';
// taskViews JSON.parses pk_tasks every call — recompute only when the board
// can actually change (open, tab switch, claim), not per drawn frame
let taskViewsCache: { tab: TaskPeriod; views: TaskView[] } | null = null;
const currentTaskViews = (): TaskView[] => {
  if (taskViewsCache?.tab !== tasksTab) taskViewsCache = { tab: tasksTab, views: taskViews(tasksTab) };
  return taskViewsCache.views;
};
let settingsCat: SettingsCat = 'sound';
let settingsDrag: { key: SettingsSliderKey } | null = null;
let helpPage = 0;
let dexOpen = false;
let dexScroll = 0;
let dexPick: number | null = null; // a dex row's detail card — null = register view
let achOpen = false;
let achScroll = 0;
let boardOpen = false;
// hatcher + lab — same overlay pattern as dex/ach/board/tasks: title chips
// open, Esc/dead taps close, drag scrolls. The hatch carries a small pull
// state machine the way the dex carries scroll state.
let hatchOpen = false;
let labOpen = false;
let labScroll = 0;
let hatch: HatchState = { phase: 'idle', t: 0, tMax: 0, results: [], i: 0, sparkScroll: 0 };
// a spark buy arms like the NEW-climb link — first tap arms for 3s, only a
// second tap inside the window spends the dust
let sparkArm = { id: -1, t: -10 };
let hatchLockT = -10; // eats a tap that lands in the same instant the reel auto-advances
let hatchFlash = { text: '', t: -10 }; // transient gold line under the pity bar — milestone payouts name themselves
let taskFlash = { text: '', t: -10 }; // same flash, on the chores board
let dexDrag: { y0: number; s0: number; moved: boolean; for?: 'hatch' | 'lab' | 'dex' | 'ach' | 'board' } | null = null;
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
// pointer-id gating: the first finger down owns the gesture — a second
// finger's events stay dead until the owner lifts (a mid-aim second tap
// used to teleport the sling; whichever finger lifted first fired it)
let activeId: number | null = null;
// scene/phase turnovers lock taps for a beat — a tap meant for the screen
// that just left can't fire blind on the new one
let inputLockT = 0;

// --- canvas sizing: letterboxed 540x960 logical space ---
let scale = 1;
let ox = 0;
let oy = 0;
// the canvas is fixed full-viewport — its rect only moves on resize, so
// pointer math reads a cached left/top instead of forcing layout per event
let rectL = 0;
let rectT = 0;

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
  const r = canvas.getBoundingClientRect(); // one forced layout per resize, not per pointer event
  rectL = r.left;
  rectT = r.top;
  if (bootFail) paintBootFail(); // a resized canvas wipes — redraw the fail card
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
// ?dev also exposes the scene machine + coordinate transform for playtest probes
if (new URLSearchParams(location.search).has('dev'))
  (window as unknown as { __dbg: { scene: () => Scene; battle: () => Battle | null; xy: (x: number, y: number) => { x: number; y: number }; stats: typeof statsDump; song: (name: string) => void; ui: () => Record<string, boolean | string> } }).__dbg = {
    scene: () => scene,
    battle: () => battle,
    ui: () => ({ homeTab, help: helpOpen, bug: bugOpen, menu: menuOpen, settings: settingsOpen, tasks: tasksOpen, dex: dexOpen, ach: achOpen, board: boardOpen, hatch: hatchOpen, lab: labOpen }),
    xy: (x, y) => { const p = toLogical({ clientX: x, clientY: y } as PointerEvent); return { x: p.x, y: p.y }; },
    stats: statsDump, // the on-device metric server — pick rates + stage deaths
    // audition any track straight from the console — builders can't hear
    song: (name: string) => {
      if (!(name in TRACKS)) {
        console.log(`no track '${name}' — try: ${Object.keys(TRACKS).join(', ')}`);
        return;
      }
      unlockAudio();
      music(name as TrackName);
      console.log(`♪ ${name}`);
    },
  };

function toLogical(e: PointerEvent) {
  return vec((e.clientX - rectL - ox) / scale, (e.clientY - rectT - oy) / scale);
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
  const team = b.players.map((p) => TYPE_SQ[p.def.type]).join('');
  return { waves, team, copied: false, failed: false };
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
      inputLockT = t + 0.25; // an emptied board advances — the next screen owns a beat
    }
    return;
  }
  statOffer('perks', ids, battle.rewardOffers[i].id);
  battle.pickPerk(i);
  inputLockT = t + 0.25; // reward → map: the route taps shouldn't catch this tap's twin
};

const rewardReroll = () => {
  if (!battle) return;
  const ids = battle.rewardOffers.map((p) => p.id);
  if (!battle.rerollOffers()) {
    sfx('ui', 0.6); // out of rolls — a denied tap still answers
    return;
  }
  statOffer('perks', ids, null); // rejected board — nobody took it
  rewardT0 = t; // the reels deal again for the new offers
  rewardLanded = 0;
  sfx('ui');
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
  inputLockT = t + 0.25; // the climb board is live — eat this tap's companion
  sceneMusic();
};

// the draft pick shared by pointer and keys — the last pick builds the run
const draftPick = (i: number) => {
  if (draft.picked.length >= DRAFT_ROUNDS) return;
  const offers = draftOffers();
  if (i >= offers.length) return;
  sfx('ui');
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
  battle.asc = Math.min(ascPick(), ascCap()); // the title's heat dial, capped by clears
  battle.bestScore = best().score; // crossing it mid-run pops NEW BEST!
  battle.shinyRate = shinyCharm() ? 2 : 1; // dex milestone doubles the gold
  // the daily's rule card applies like a bag item — after the metagame sets
  // so its multipliers stack on top, and it names itself on the field log
  if (runMod) {
    runMod.apply(battle);
    battle.log(`DAILY MOD: ${runMod.name}`);
  }
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
  startOffers = rollPerks(runRng, 3, rank(), battle.teamTypes(), undefined, battle.perkOfferN); // lab 'fourth' deals a fourth charm card too
  charmBonus = battle.asc >= 3;
  charmPicks = charmBonus ? 2 : 1;
  scene = 'charm';
  inputLockT = t + 0.25; // the charm board is live — eat this tap's companion
};

// A run's draft pool is the roster plus everything the dex has caught that
// isn't already in it — catching mons is how new faces join future drafts.
// draftOrder only deals roster indices, so the extras get shuffled into the
// deal here or they'd never be offered.
// one run setup shared by START CLIMB, RESTART and REMATCH — ?seed=NNN
// always wins (debug/sharing), else a fresh roll
let titleSave: RunSave | null = null; // pk_run peek for the title's CONTINUE button
// RESTART carries the old two-tap arm — the first tap lights the warn-red
// face, only a second inside 3s burns the parked run. -10 = cold at boot.
let restartConfirmT0 = -10;

function newRun() {
  const forced = Number(new URLSearchParams(location.search).get('seed'));
  const hasForced = Number.isInteger(forced) && forced > 0;
  runSeed = hasForced ? forced : takeClimbSeed(); // the title's arena diorama previewed this exact stage 1
  runIsDaily = false;
  runMod = null; // daily mode is gone — parked daily saves still resume below
  runRng = mulberry32(runSeed);
  stage = makeStage(runSeed);
  clearRun(); // a fresh climb drops the old one
}

// bank the climb whenever the team is parked on the map — mid-fight tabs
// resume at the last stop, not mid-wave. Draft/charm scenes hold a battle
// parked on a pre-run map: saving there would offer a CONTINUE that skips
// the charm pick entirely.
function bankRun() {
  if (scene !== 'battle') return;
  const s = battle?.snapshot();
  if (s) {
    s.seed = runSeed;
    s.daily = runIsDaily;
    s.modId = runMod?.id; // the rule card's id survives a DAILY_MODS reshuffle
    saveRun(s);
  }
}
window.addEventListener('pagehide', bankRun);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  bankRun();
  // a hidden tab can drop the gesture's pointerup — a held id would lock
  // every later tap out, so dump all drag state like a pointercancel
  activeId = null;
  helpDrag = dexDrag = boxDrag = settingsDrag = null;
  settingsSliderFlush(); // bank a mid-drag slider value the dropped up would have
  battle?.pointerCancel();
});

// A saved climb skips the draft/charm entirely — same seed, same island
// (region regens from mapSeed), perks replayed through grantPerk.
function resumeRun(s: RunSave) {
  runSeed = s.seed;
  runIsDaily = s.daily;
  // the save names its rule card — a DAILY_MODS reorder can't swap a parked
  // daily into a different mod mid-run; v4 saves re-derive like before
  runMod = s.daily ? (DAILY_MODS.find((m) => m.id === s.modId) ?? modForSeed(s.seed)) : null;
  runRng = mulberry32(runSeed);
  stage = makeStage(runSeed);
  // entries keep their save row attached — applySnapshot stamps hp by index,
  // so a bare filter would slide every later mon's hp onto the wrong slot
  const kept = s.team
    .map((e) => ({ e, def: speciesById(e.id) }))
    .filter((x): x is { e: RunSave['team'][number]; def: SpeciesDef } => !!x.def);
  clearRun(); // drop the parked climb even on the fall-through — don't resurrect it next boot
  if (!kept.length) return; // a team-less save can't fight — fall through to title
  battle = new Battle(
    arenaRect(),
    kept.map((x) => ({ ...x.def, lvl: x.e.lvl, shiny: x.e.shiny || undefined })),
    stage,
    runRng,
  );
  battle.rank = rank();
  battle.asc = s.asc;
  battle.bestScore = best().score;
  battle.shinyRate = shinyCharm() ? 2 : 1;
  // the daily card re-applies before the snapshot stamps saved hp — a maxHp
  // bump can't stomp the banked values that way
  if (runMod) {
    runMod.apply(battle);
    battle.log(`DAILY MOD: ${runMod.name}`);
  }
  const echo = echoIds()
    ?.map((e) => ({ def: speciesById(e.id), lvl: e.lvl }))
    .filter((e): e is { def: SpeciesDef; lvl: number } => !!e.def);
  battle.echo = echo?.length ? echo : null;
  battle.applySnapshot({ ...s, team: kept.map((x) => x.e) }); // pruned rows keep hp index-aligned
  // restored gyms were banked the first time — only new wins feed pk_gyms
  lastGyms = battle.gymsBeaten;
  scene = 'battle';
  inputLockT = t + 0.25; // a live board replaced the title — eat the tap's twin
  sceneMusic();
}

// the daily raid: one UTC-seeded epic boss for everyone — a standalone fight
// on the day's loaner trio, not a climb (no map, no draft, no end-of-run
// ledger, and a parked pk_run is never touched)
function startRaid() {
  const raidStage: StageDef = {
    name: 'CHROMA RAID',
    theme: THEMES[daySeed() % THEMES.length], // seeded rotate — same court for everyone
    waves: [[{ def: { ...raidPick(), shiny: true }, nx: 0.5, ny: 0.3, boss: true }]], // the chroma boss wears its palette
  };
  battle = new Battle(arenaRect(), raidTeam(), raidStage, mulberry32(daySeed() * 7919 + 13), []);
  battle.raid = true;
  battle.rank = rank();
  battle.shinyRate = shinyCharm() ? 2 : 1;
  battle.startFight(); // no island — straight into the lone wave
  scene = 'battle';
  inputLockT = t + 0.25; // the arena is live — eat the tap's twin
  sceneMusic(); // no-op on 'battle' — the fight picks its own track, same as a resumed run
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
  // a thin candidate pool (fewer than 3 distinct types) would spin forever —
  // cap the tries, then pad the spread deterministically from what's there
  for (let i = 0; i < 200 && aces.length < 3; i++) {
    const c = aceCandidates[Math.floor(runRng() * aceCandidates.length)];
    if (!c || aceTypes.has(c.type)) continue;
    aceTypes.add(c.type);
    aces.push(draftPool.push(c) - 1);
  }
  for (const c of aceCandidates) {
    if (aces.length >= 3) break;
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
  // the bag rides in unasked — ≤2 stocked consumables auto-arm, seeded-random
  // so the seed still replays the run; chips draw lit, a tap reads its desc
  const stocked = [...bagRowItems()];
  bagPick = new Set<string>();
  while (bagPick.size < BAG_MAX && stocked.length)
    bagPick.add(stocked.splice(Math.floor(runRng() * stocked.length), 1)[0].id);
  bagLast = null;
  offerCache = null;
  respinDraft();
  inputLockT = t + 0.25; // the draft board just dealt — eat the tap's twin
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
  if (draft.rerolls <= 0) {
    sfx('ui', 0.6); // out of reshuffles — a denied tap still answers
    return;
  }
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

// --- the hatcher: the pull machine + the dust spark shop -----------------
// tunables (Oct-21 spec — guesses, marked for playtesting)
const HATCH_SHAKE_T = 1.15; // base ball-rock seconds before the reveal
const HATCH_REVEAL_T = 1.7; // a card holds this long, then the reel plays itself
// bigger pulls buy a longer stage — epic and shiny each add runway
const hatchLen = (base: number, res?: PullResult) =>
  base + (res ? (res.rarity - 1) * 0.3 + (res.shiny ? 0.55 : 0) : 0);
// the reveal beat's verdict sound — shiny jackpots, epics get the dark sting
const revealSfx = (res?: PullResult) => {
  if (!res) return;
  if (res.shiny) sfx('perfect');
  else if (res.rarity >= 3) sfx('invade');
  else sfx('caught', res.rarity === 2 ? 1.25 : 1);
};
const SPARK_ARM_T = 3; // two-tap confirm window on a dust buy

// milestone checks the run-end path runs — a pull crossing a threshold
// toasts immediately instead of waiting for the next climb's report.
// Returns the dex-tier stars paid so the UI can name the payout.
const pullMilestones = () => {
  if (dexIds().length >= 50 && unlockAch('collector')) playJingle('task');
  if (dexIds().length >= CATCHABLE && unlockAch('living')) playJingle('task');
  const claims = claimDexRewards(); // collection tiers pay out
  if (claims.length) playJingle('task');
  return claims.reduce((s, c) => s + c.pay, 0);
};

// Math.random, never runRng — a title-side pull must not shift a resumed
// climb's stream or a shared ?seed= replay
const doPull = (n: number) => {
  // one free pull a day opens the hatcher for every wallet — the daily's
  // cheapest reason to come back
  if (n === 1 && freePullLeft()) useFreePull();
  else if (!spendStars(n === 10 ? PULL10_COST : PULL_COST)) {
    sfx('ui', 0.6); // short on stars — the price pill was red for a reason
    return;
  }
  const featuredId = featuredPull().id; // today's 10x rate-up, same for everyone
  const results: PullResult[] = [];
  let dexPay = 0; // milestone stars this pull banked — the summary names them
  for (let k = 0; k < n; k++) {
    const def = pullSpecies(Math.random, { rarePlus: bumpPulls() % PULL_PITY === 0, featuredId });
    const tier = tierOf(def);
    const dupe = dexIds().includes(def.id);
    let dustPay = 0;
    if (dupe) {
      dustPay = DUST_BY_TIER[tier];
      addDust(dustPay); // a pulled dupe converts instead of re-recording
    } else {
      recordCapture([def.id]); // the dex IS the unlock ledger — the draft pool grows
      dexPay += pullMilestones();
    }
    const shiny = Math.random() < shinyOdds(); // weekends double it
    if (shiny) {
      recordShiny(def.id); // shiny logs either way — dupe or new face
      if (unlockAch('shiny')) playJingle('task');
    }
    statPull(def.id, dupe);
    results.push({ id: def.id, rarity: INVADER_IDS.has(def.id) || tier >= 3 ? 3 : tier === 2 ? 2 : 1, dupe, shiny, dust: dustPay });
  }
  hatch.results = results;
  hatch.dexPay = dexPay;
  hatch.rookiePay = rookieCheck().reduce((s, r) => s + r.pay, 0); // 'HATCH A MON' clears here
  hatch.label = undefined; // a raid's 'RAID CLEARED' header can't ride the next pull
  hatch.i = 0;
  hatch.t = 0;
  hatch.tMax = hatchLen(HATCH_SHAKE_T, results[0]);
  hatch.phase = 'shake'; // the ball rocks before the first reveal
  sfx('ui');
  sfx('beam', 0.5); // the charge-up's rising whine under the wobble
};

// the spark grid's two-tap buy — first tap arms for 3s, the dust spend on
// the second is the real guard
const sparkBuy = (def: SpeciesDef) => {
  if (dexIds().includes(def.id)) {
    sfx('ui', 0.6); // already in the dex — the dimmed cell denies
    return;
  }
  if (sparkArm.id !== def.id || t - sparkArm.t >= SPARK_ARM_T) {
    sparkArm = { id: def.id, t };
    sfx('ui', 0.6); // armed, not bought — the warn pitch says so
    return;
  }
  sparkArm = { id: -1, t: -10 };
  if (!spendDust(dealCost(def))) { // today's deal species prices at 25% off
    sfx('ui', 0.6); // short on dust — the spend itself is the guard
    return;
  }
  recordCapture([def.id]);
  const dexPay = pullMilestones(); // a dust buy can cross a tier too
  const rookie = rookieCheck(); // a spark buy is a hatch for the rookie board
  // one flash can carry both payouts — a buy that hits a dex tier AND a
  // rookie step shouldn't eat the first line
  const flash: string[] = [];
  if (dexPay) flash.push(`DEX MILESTONE +${dexPay} ★`);
  if (rookie.length) flash.push(`ROOKIE +${rookie.reduce((s, r) => s + r.pay, 0)} ★`);
  if (flash.length) hatchFlash = { text: flash.join(' · '), t };
  playJingle('catch');
};

// a tap inside the hatch overlay: mid-theatre taps drive the state machine;
// idle taps pull, spark, or fall out the bottom like the sibling overlays
const hatchTap = (p: { x: number; y: number }) => {
  if (t - hatchLockT < 0.15) return; // a tap meant for the phase that just auto-advanced would skip the new card
  if (hatch.phase === 'shake') {
    hatch.phase = 'reveal'; // an impatient tap skips the rest of the shake
    hatch.t = 0;
    hatch.tMax = hatchLen(HATCH_REVEAL_T, hatch.results[hatch.i]);
    revealSfx(hatch.results[hatch.i]);
    return;
  }
  if (hatch.phase === 'reveal') {
    sfx('ui');
    // SKIP ≫ jumps the rest of the reel straight to the summary grid —
    // slop 12 because the flash-beat screen kick can slide the drawn pill
    // ~10px off its rect on epic/shiny reveals
    if (hatch.results.length > 1 && inRect(p.x, p.y, slop(SKIP_PULL_BTN, 12))) {
      hatch.phase = 'results';
      hatch.t = 0;
      return;
    }
    if (++hatch.i >= hatch.results.length) {
      hatch.phase = 'results';
    } else {
      // the next card's theatre starts clean — clock, runway and its own hit
      hatch.tMax = hatchLen(HATCH_REVEAL_T, hatch.results[hatch.i]);
      revealSfx(hatch.results[hatch.i]);
    }
    hatch.t = 0;
    return;
  }
  if (hatch.phase === 'results') {
    hatch.phase = 'idle'; // the summary's tap lands back at the shop
    hatch.results = [];
    hatch.t = 0;
    sfx('ui');
    return;
  }
  if (inRect(p.x, p.y, PULL1_BTN)) {
    doPull(1);
    return;
  }
  if (inRect(p.x, p.y, PULL10_BTN)) {
    doPull(10);
    return;
  }
  const cell = sparkHit(hatch.sparkScroll, p.x, p.y);
  if (cell) {
    sparkBuy(cell);
    return;
  }
  // dead space INSIDE the panel is modal like the siblings — only a tap
  // past the edge dismisses; a fat-finger on the shop shouldn't close it
  if (inRect(p.x, p.y, HATCH_PANEL)) return;
  hatchOpen = false; // dead space is a tap-out like its siblings
  sfx('ui');
};

// lab taps: a card spends stars on its next level; dead space closes
const labTap = (p: { x: number; y: number }) => {
  const id = labHit(labScroll, p.x, p.y);
  if (id) {
    if (buyLab(id)) sfx('ui'); // a level pip fills
    else sfx('ui', 0.6); // broke or maxed — the price pill was red
    return;
  }
  if (inRect(p.x, p.y, HATCH_PANEL)) return; // inside dead space is modal
  labOpen = false;
  sfx('ui');
};

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
  if (share) share.failed = false; // a fresh attempt clears the last one's flag
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
  } else if (share) {
    share.failed = true; // sheet threw and the clipboard said no — the card says so
  }
}

// --- input routing ---

// title keeps the title loop; the pick screens get the calmer draft theme;
// result keeps whatever the battle queued.
// battle picks its own track every frame (map/gym/trainer/wild) — stepping in
// here would flip-flop and restart the song on every drag
function sceneMusic() {
  if (scene === 'result' || scene === 'battle') return;
  music(scene === 'draft' || scene === 'charm' ? 'draft_theme' : 'title');
}

// the ? chip's one gate, read by both the hit-test and the draw: the dealt
// boards (draft/charm) and the between-fight lulls — wherever a choice is on
// the table, the manual is one tap away
const helpChipUp = () =>
  scene === 'draft' ||
  scene === 'charm' ||
  // mapModals (event cards, walks) and the evo pick own the screen — a
  // chip under a modal is an invisible hotspot
  (scene === 'battle' &&
    !!battle &&
    (battle.phase === 'map' || battle.phase === 'reward') &&
    !menuOpen &&
    !battle.mapModal &&
    !battle.evoChoice);

// one click per real page turn — edges stay quiet so a held arrow key or a
// trackpad flick can't machine-gun the synth
function helpFlip(d: number) {
  const np = Math.min(Math.max(helpPage + d, 0), HELP_PAGE_COUNT - 1);
  if (np === helpPage) return;
  helpPage = np;
  sfx('ui');
}

// long-press during an aim-hold pops Android's context menu — kill it
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  if (activeId !== null) return; // a second finger mid-gesture is dead input
  activeId = e.pointerId;
  canvas.setPointerCapture(e.pointerId); // a release off-window still sends its up here
  if (t < inputLockT) return; // this tap was aimed at the screen that just turned over
  unlockAudio(); // first gesture spins up the synth
  sceneMusic();
  const p = toLogical(e);
  // the help pager swallows all input while it's up — any scene
  if (helpOpen) {
    helpDrag = { x0: p.x, y0: p.y, moved: false };
    return;
  }
  // the bug card swallows its own tap-out — it's a card, not a drag surface
  if (bugOpen) {
    bugOpen = false;
    sfx('ui');
    return;
  }
  // the settings modal too — tabs switch, sliders grab, toggles flip on
  // pointerdown; CLOSE or a tap outside dismisses
  if (settingsOpen) {
    if (inRect(p.x, p.y, SETTINGS_CLOSE) || !inRect(p.x, p.y, SETTINGS_PANEL)) {
      settingsOpen = false;
      settingsDrag = null;
      settingsSliderFlush();
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
      if (hit.key === 'haptics') buzz(30); // the toggle you feel — buzz() self-gates on the new setting
      sfx('ui');
      return;
    }
    if (hit?.kind === 'seg') {
      settingsSegSet(hit.key, hit.i);
      sfx('ui');
      return;
    }
    if (hit?.kind === 'avatar') {
      setTrainer(AVATARS[hit.i].id);
      sfx('ui');
      return;
    }
    return; // dead panel space is still modal
  }
  // the tasks board swallows taps while it's up — claim, tab, or close
  if (tasksOpen) {
    const hit = taskRowHit(p, currentTaskViews());
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
      const v = currentTaskViews()[hit.i];
      // taskRowHit fires on any slap of the slab — done pays, the rest deny
      if (v?.done && claimTask(v.id)) {
        taskViewsCache = null; // the claim flag flipped — next read re-parses
        playJingle('task'); // the bag pays out
        const rookie = rookieCheck(); // 'CLAIM A TASK' clears on this tap
        if (rookie.length) taskFlash = { text: `ROOKIE +${rookie.reduce((s, r) => s + r.pay, 0)} ★`, t };
      } else sfx('ui', 0.6);
      return;
    }
    return;
  }
  // the ? chip rides the dealt boards too — checked ahead of the scenes so a
  // tap can't fall through to a fast-forward or a card pick
  if (helpChipUp() && inRect(p.x, p.y, HELP_CHIP_HIT)) {
    sfx('ui');
    helpOpen = true;
    helpPage = 0;
    return;
  }
  if (scene === 'title') {
    // every open overlay swallows the tap into a scroll drag — a drag that
    // never moved resolves as a tap on pointerup
    if (dexOpen || dexPick != null || achOpen || boardOpen || hatchOpen || labOpen) {
      dexDrag = {
        y0: p.y,
        s0: hatchOpen ? hatch.sparkScroll : labOpen ? labScroll : dexOpen ? dexScroll : achScroll,
        moved: false,
        for: hatchOpen ? 'hatch' : labOpen ? 'lab' : dexOpen || dexPick != null ? 'dex' : achOpen ? 'ach' : 'board',
      };
      return;
    }
    // the bottom nav is shared chrome — live on every tab, ahead of the body.
    // cell.hit tracks the drawn pill, so the popped card's crown taps through
    for (const cell of TAB_CELLS) {
      if (inRect(p.x, p.y, cell.hit)) {
        if (homeTab !== cell.tab) noteTabSwap(t, homeTab); // old card eases back down
        homeTab = cell.tab;
        noteTabPress(t); // press-pop reads the stamp on the new active pill
        sfx('ui');
        return;
      }
    }
    if (homeTab === 'climb') {
      // the pitch ghosts are the same door class — tap one for its card
      const ghost = echoMonAt(p.x, p.y);
      if (ghost != null) {
        sfx('ui');
        dexOpen = true;
        dexScroll = 0;
        dexPick = ghost;
        return;
      }
    }
    if (homeTab === 'shop' && inRect(p.x, p.y, DEAL_BTN)) {
      // the bargain's face opens its own card — the hatcher's spark shop
      // still sells it; the card tap is "what am I buying?", not checkout
      sfx('ui');
      dexPick = dealPick().id;
      return;
    }
    if (homeTab === 'shop' && inRect(p.x, p.y, HATCH_BTN)) {
      sfx('ui');
      hatchOpen = true;
      hatch = { phase: 'idle', t: 0, tMax: 0, results: [], i: 0, sparkScroll: 0 };
      sparkArm = { id: -1, t: -10 };
      return;
    }
    if (homeTab === 'mons' && inRect(p.x, p.y, SETS_BTN)) {
      // LINE SETS — the card sells "TAP TO CLAIM" only while a bounty waits;
      // quiet card, the footer promises "TAP TO BROWSE THE DEX" — keep it true
      const ready = setsReady();
      if (ready.length) {
        for (const root of ready) claimSet(root);
        sfx('perfect');
      } else {
        dexOpen = true;
        dexScroll = 0;
        sfx('ui');
      }
      return;
    }
    if (homeTab === 'town' && inRect(p.x, p.y, LAB_BTN)) {
      sfx('ui');
      labOpen = true;
      labScroll = 0;
      return;
    }
    if (homeTab === 'mons' && (inRect(p.x, p.y, DEX_BTN) || inRect(p.x, p.y, PARTNERS_BTN))) {
      sfx('ui');
      // a sprite tap opens just that mon's card — no register stacked under
      // it; the rest of the card browses the register as before
      const strip = inRect(p.x, p.y, PARTNERS_BTN) ? partnersStripAt(p.x, p.y) : null;
      dexOpen = strip == null;
      dexScroll = 0;
      dexPick = strip;
      return;
    }
    if (homeTab === 'mons' && inRect(p.x, p.y, TEAM_BTN)) {
      // the squad card is a door — a parked climb jumps to CLIMB's CONTINUE
      if (runSave()) {
        noteTabSwap(t, homeTab);
        homeTab = 'climb';
        noteTabPress(t);
      } else {
        dexOpen = true;
        dexScroll = 0;
      }
      sfx('ui');
      return;
    }
    if (homeTab === 'town' && inRect(p.x, p.y, ACH_BTN)) {
      sfx('ui');
      achOpen = true;
      achScroll = 0;
      return;
    }
    if (homeTab === 'town' && (inRect(p.x, p.y, BOARD_BTN) || inRect(p.x, p.y, HALL_BTN))) {
      sfx('ui');
      boardOpen = true;
      return;
    }
    if (homeTab === 'town' && inRect(p.x, p.y, TASKS_BTN)) {
      sfx('ui');
      tasksOpen = true;
      tasksTab = 'daily';
      taskViewsCache = null; // progress accrued since the last peek — re-parse
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
    if (homeTab === 'climb' && inRect(p.x, p.y, BUG_HIT)) {
      bugOpen = true;
      sfx('ui');
      return;
    }
    if (homeTab === 'climb' && inRect(p.x, p.y, ASC_BTN)) {
      // the rung ladder — a tap sets the heat directly; locked rungs deny
      const i = hitAscCell(p.x, p.y);
      if (i >= 0) {
        if (i <= ascCap()) {
          setAsc(i);
          sfx('ui');
        } else {
          noteAscDeny(i, t);
          sfx('ui', 0.6); // a denied tap still answers
        }
      }
      return;
    }
    if (homeTab === 'climb' && inRect(p.x, p.y, FREE_BTN)) {
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
    if (homeTab === 'climb' && titleSave && inRect(p.x, p.y, RESTART_BTN)) {
      // burn the parked climb, deal a fresh seed — the old sliver link's
      // deed on a real pill now. Two-tap: first arms the warn face, the
      // second inside 3s does it.
      if (t - restartConfirmT0 >= 3) {
        restartConfirmT0 = t;
        sfx('ui', 0.6); // warn pitch — nothing was dropped yet
        return;
      }
      restartConfirmT0 = -10;
      sfx('ui');
      newRun();
      titleSave = null;
      startDraft();
      scene = 'draft';
      sceneMusic();
      return;
    }
    if (homeTab === 'raid' && inRect(p.x, p.y, RAID_FIGHT)) {
      // the day's boss drops once — a beaten raid stays done till UTC midnight
      if (raidDoneToday()) {
        sfx('ui', 0.6); // soft deny — same pitch every dead tap gets
        return;
      }
      sfx('ui');
      startRaid();
      return;
    }
  } else if (scene === 'draft') {
    if (draft.picked.length >= DRAFT_ROUNDS) return;
    // bag chips ride in auto — a tap only answers "what does this one do?"
    if (inRect(p.x, p.y, BAG_ROW)) {
      const items = bagRowItems();
      for (let i = 0; i < items.length; i++) {
        if (!inRect(p.x, p.y, bagChipRect(i, items.length))) continue;
        bagLast = items[i].id;
        sfx('ui');
        return;
      }
    }
    if (inRect(p.x, p.y, slop(DRAFT_REROLL, 3))) {
      rerollDraft(); // the helper denies when the reshuffles are spent
      return;
    }
    // reels still rolling — any tap fast-forwards to the dealt board
    if (t - draftT0 < REEL_STOPS[REEL_STOPS.length - 1]) {
      draftT0 = t - REEL_STOPS[REEL_STOPS.length - 1];
      sfx('ui', 0.8); // the skip still clicks — low pitch, it cut the show short
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
    if (inRect(p.x, p.y, slop(CHARM_SKIP, 4))) {
      // declining the charm pays score instead — dead offers have a price
      sfx('ui');
      statOffer('perks', startOffers.map((p) => p.id), null);
      if (battle) battle.score += 200;
      startOffers = [];
      scene = 'battle';
      inputLockT = t + 0.25; // the climb board is live — eat this tap's companion
      sceneMusic();
      return;
    }
    for (let i = 0; i < startOffers.length; i++) {
      if (inRect(p.x, p.y, perkCardRect(i, startOffers.length))) {
        charmPick(i);
        return;
      }
    }
    return;
  } else if (scene === 'battle') {
    // the freeze's own buttons — SETTINGS opens the modal on top, QUIT bails
    // to the last map-point bank (the parked pk_run survives → CONTINUE).
    // Every other tap falls through to pointerDown, which thaws the fight.
    if (battle?.paused) {
      if (inRect(p.x, p.y, PAUSE_SETTINGS)) {
        sfx('ui');
        settingsOpen = true;
        settingsCat = 'sound';
        return;
      }
      if (inRect(p.x, p.y, PAUSE_QUIT)) {
        sfx('ui');
        battle = null; // snapshot() won't bank mid-fight — the parked save stands
        scene = 'title';
        titleSave = runSave();
        sceneMusic();
        return;
      }
    }
    // mid-run chips — the ? half of this gate moved up to helpChipUp() so the
    // dealt boards share it; the mute chip stays a between-fights control.
    // Neither answers under a modal (event card, evo pick) — that layer owns input
    if (battle && (battle.phase === 'map' || battle.phase === 'reward') && !menuOpen && !battle.mapModal && !battle.evoChoice) {
      if (inRect(p.x, p.y, MUTE_CHIP_HIT)) {
        toggleMute();
        sfx('ui');
        return;
      }
      if (inRect(p.x, p.y, MAP_GEAR_HIT)) {
        settingsOpen = true;
        settingsCat = 'sound';
        sfx('ui');
        return;
      }
    }
    // the team panel is modal over the map AND the reward screen — CLOSE
    // or a tap outside dismisses; inside, roster ops only
    if (battle && menuOpen && (battle.phase === 'map' || battle.phase === 'reward')) {
      // QUIT leaves the run to its parked pk_run — CONTINUE picks it back up;
      // bankRun catches panel-made swaps on the map, and a mid-reward save
      // resumes past the fought row (the board pick is the price of parking)
      if (inRect(p.x, p.y, MENU_QUIT)) {
        sfx('ui');
        bankRun();
        menuOpen = false;
        battle = null;
        scene = 'title';
        titleSave = runSave();
        sceneMusic();
        return;
      }
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
        // KEEP bows out of the split — the mon stays in its current form
        if (inRect(p.x, p.y, slop(EVO_KEEP, 5))) {
          battle.declineEvo();
          sfx('ui');
        }
        return;
      }
      // the catch card or the TEAM · ITEMS button opens the box mid-pick —
      // same modal the map carries, the relic pick waits
      if (inRect(p.x, p.y, slop(REWARD_TEAM, 4)) || (battle.boxGain && inRect(p.x, p.y, REWARD_CATCH))) {
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
        sfx('ui', 0.8); // the skip still clicks — low pitch, it cut the show short
        return;
      }
      // the tool row: reroll re-deals, banish arms a card tap — boards are
      // pick-one only now, no cash-out
      if (inRect(p.x, p.y, TOOL_ROLL)) {
        rewardReroll();
        return;
      }
      if (inRect(p.x, p.y, TOOL_BAN)) {
        const wasArmed = battle.banArmed;
        if (battle.toggleBanish() !== wasArmed) sfx('ui'); // arming and standing down both click
        else sfx('ui', 0.6); // out of banishes — a denied tap still answers
        return;
      }
      for (let i = 0; i < battle.rewardOffers.length; i++) {
        if (inRect(p.x, p.y, perkCardRect(i, battle.rewardOffers.length))) {
          rewardPick(i);
          return;
        }
      }
      return;
    } else {
      const ph = battle?.phase;
      const modal = battle?.mapModal;
      battle?.pointerDown(p);
      // a committed route (or a resolved map card) eats the tap's twin —
      // the new screen owns the next beat
      if (battle && (battle.phase !== ph || battle.mapModal !== modal)) inputLockT = t + 0.25;
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
  if (e.pointerId !== activeId) return; // the gesture belongs to another finger
  // a mouse released outside the window never sent its up — buttons:0 on
  // the way back in means the gesture died silently; drop it or the
  // claimed id locks every later tap out
  if (e.pointerType === 'mouse' && !e.buttons) {
    activeId = null;
    helpDrag = dexDrag = boxDrag = settingsDrag = null;
    settingsSliderFlush();
    if (scene === 'battle') battle?.pointerCancel();
    return;
  }
  const p = toLogical(e);
  if (settingsDrag) {
    settingsSliderSet(settingsDrag.key, p.x); // write-through, no click spam
    syncVolumes(); // master/music are node params — poke them live
    return;
  }
  if (settingsOpen) return;
  if (helpDrag) {
    if (Math.abs(p.x - helpDrag.x0) > 10 || Math.abs(p.y - helpDrag.y0) > 10) helpDrag.moved = true;
    return;
  }
  if (dexDrag) {
    if (Math.abs(p.y - dexDrag.y0) > 10) dexDrag.moved = true;
    // the pull theatre eats drags — sparkScrollMax is 0 mid-show, so a drag
    // there would zero the shop's scroll for no reason
    if (dexDrag.for === 'hatch' && hatch.phase !== 'idle') return;
    if (dexDrag.for === 'board') return; // the board has no scroll — don't drag ach's by proxy
    const s = Math.min(
      Math.max(dexDrag.s0 + dexDrag.y0 - p.y, 0),
      dexDrag.for === 'hatch' ? hatchScrollMax(hatch) : dexDrag.for === 'lab' ? labScrollMax() : dexDrag.for === 'dex' ? dexScrollMax() : achScrollMax(),
    );
    if (dexDrag.for === 'hatch') hatch.sparkScroll = s;
    else if (dexDrag.for === 'lab') labScroll = s;
    else if (dexDrag.for === 'dex') {
      if (dexPick == null) dexScroll = s; // the detail card freezes the register
    }
    else achScroll = s;
    return;
  }
  if (boxDrag) {
    if (Math.abs(p.x - boxDrag.x0) > 10) boxDrag.moved = true;
    if (battle)
      boxScroll = Math.min(
        Math.max(boxDrag.s0 + boxDrag.x0 - p.x, 0),
        boxScrollMax(battle.box.length),
      );
    return;
  }
  if (helpOpen) return; // a key-opened manual owns input without a drag
  if (scene === 'battle') battle?.pointerMove(p);
});

canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activeId) return; // not the gesture's finger — its lift fires nothing
  activeId = null;
  if (settingsDrag) {
    settingsDrag = null;
    settingsSliderFlush(); // drag values are write-throttled — bank the last x
    syncVolumes(); // a tap-set never saw a pointermove — flush the volume here
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
      if (p.x - x0 < -30) helpFlip(1);
      else if (p.x - x0 > 30) helpFlip(-1);
      return;
    }
    // CLOSE or an outside tap dismisses — a click like every sibling modal
    if (inRect(p.x, p.y, HELP_CLOSE_HIT) || !inRect(p.x, p.y, HELP_PANEL)) {
      helpOpen = false;
      helpWelcome = false;
      sfx('ui');
    } else if (inRect(p.x, p.y, slop(HELP_TUT, 4))) {
      // re-arm the kinetic coach: a live battle starts coaching at its next
      // aim phase; from the title it waits for the next run to bank again
      if (battle && battle.phase !== 'won' && battle.phase !== 'lost') battle.coach = true;
      else resetCoach();
      helpOpen = false; // closing shows the ghost pull immediately mid-battle
      helpWelcome = false;
      sfx('ui');
    } else if (inRect(p.x, p.y, slop(HELP_NEXT, 4))) helpFlip(1);
    else if (inRect(p.x, p.y, slop(HELP_PREV, 4))) helpFlip(-1);
    return;
  }
  if (dexDrag) {
    const { moved } = dexDrag;
    dexDrag = null;
    if (!moved) {
      // a drag that never moved is a tap: hatch/lab route it to their own
      // hit-tests (pull pills, spark cells, lab cards); the rest close out
      const p = toLogical(e);
      if (hatchOpen) hatchTap(p);
      else if (labOpen) labTap(p);
      else if (dexOpen || dexPick != null) {
        // detail first, then a row pick, then tap-to-close — the dex's stack
        if (dexPick != null) dexPick = null;
        else {
          const pick = dexRowAt(p.x, p.y, dexScroll);
          if (pick != null) dexPick = pick;
          else dexOpen = false;
        }
        sfx('ui');
      } else if (boardOpen) {
        // the empty ledger's one live cell — START A CLIMB leaves for the draft
        if (!board().length && inRect(p.x, p.y, HOF_CLIMB)) {
          boardOpen = false;
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
        } else boardOpen = false;
        sfx('ui');
      } else {
        achOpen = false;
        sfx('ui'); // tap-to-close clicks like every sibling modal
      }
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
  if (helpOpen) return; // a key-opened manual owns input without a drag
  if (scene === 'battle') battle?.pointerUp();
});
// desktop keys: Esc/? toggles the manual, arrows page it, P pauses a live
// fight, M mutes — pointer paths stay the single source of truth
addEventListener('keydown', (e) => {
  unlockAudio();
  if (helpOpen) {
    if (e.key === 'Escape' || e.key === '?') {
      helpOpen = false;
      helpWelcome = false;
      sfx('ui');
    } else if (e.key === 'ArrowRight') helpFlip(1);
    else if (e.key === 'ArrowLeft') helpFlip(-1);
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
      settingsSliderFlush();
      sfx('ui');
    }
    return;
  }
  // the dealt boards take keys too — [1..4] picks (the lab's fourth card is
  // real), or banishes when armed; R rerolls, Z arms banish.
  // The same 250ms lock the pointer layer eats applies here, or a key timed
  // to the board turnover double-fires into the next screen.
  if (t < inputLockT) return;
  if (scene === 'draft' && draftLanded >= REEL_STOPS.length) {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0) {
      draftPick(i);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      rerollDraft(); // the helper denies when the reshuffles are spent
      return;
    }
  }
  if (scene === 'charm') {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
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
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0 && i < battle.rewardOffers.length) {
      rewardPick(i);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      rewardReroll();
      return;
    }
    if (e.key === 'z' || e.key === 'Z') {
      const wasArmed = battle.banArmed;
      if (battle.toggleBanish() !== wasArmed) sfx('ui'); // arming and standing down both click
      else sfx('ui', 0.6); // out of banishes — a denied key still answers
      return;
    }
  }
  // the TEAM · ITEMS panel owns keys while it's up — Esc closes it instead
  // of falling through to the manual
  if (menuOpen) {
    if (e.key === 'Escape') {
      menuOpen = false;
      sfx('ui');
    }
    return;
  }
  // ←/→ walk the bottom nav — the desk build's tab key; overlays keep their
  // scroll so the arrows only fire on a bare tab
  if (scene === 'title' && !(dexOpen || achOpen || boardOpen || hatchOpen || labOpen)) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) {
      const i = TAB_CELLS.findIndex((c) => c.tab === homeTab);
      noteTabSwap(t, homeTab);
      homeTab = TAB_CELLS[(i + dir + TAB_CELLS.length) % TAB_CELLS.length].tab;
      noteTabPress(t);
      sfx('ui');
      return;
    }
  }
  // Esc pops the topmost overlay first — lab paints over hatch over board
  // over ach over dex — and only reaches the manual once the screen is
  // bare; '?' still opens help over anything, same as tapping the chip
  if (e.key === 'Escape' && (labOpen || hatchOpen || boardOpen || achOpen || dexOpen)) {
    if (labOpen) labOpen = false;
    else if (hatchOpen) {
      // mid-theatre Esc advances the reveal like a tap — the pull's already
      // paid, so closing here would eat the results unseen
      if (hatch.phase !== 'idle') {
        hatchTap({ x: -1, y: -1 });
        return;
      }
      hatchOpen = false;
    }
    else if (boardOpen) boardOpen = false;
    else if (achOpen) achOpen = false;
    else if (dexPick != null) dexPick = null;
    else dexOpen = false;
    sfx('ui');
  } else if (e.key === 'Escape' || e.key === '?') {
    helpOpen = true;
    helpPage = 0;
  } else if ((e.key === 'p' || e.key === 'P') && battle && (battle.phase === 'aim' || battle.phase === 'shot' || battle.phase === 'enemy' || battle.phase === 'loot')) {
    battle.paused = !battle.paused;
    if (battle.paused) battle.pointerCancel(); // a frozen game drops the half-pull
    sfx('ui');
  } else if ((e.key === 'f' || e.key === 'F') && battle && (battle.phase === 'aim' || battle.phase === 'shot' || battle.phase === 'enemy' || battle.phase === 'loot')) {
    battle.ff = Battle.ffPref = !battle.ff; // same gate as the pause chip phases; rides the session
    sfx('ui', battle.ff ? 1.3 : 0.8);
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  }
});

canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== activeId) return;
  activeId = null;
  helpDrag = null;
  dexDrag = null;
  boxDrag = null;
  settingsDrag = null;
  settingsSliderFlush();
  // an interrupt isn't a release — drop the drag, don't fire the shot
  if (scene === 'battle') battle?.pointerCancel();
});

// wheel/trackpad scroll for desktop playtests — drag is the primary control
canvas.addEventListener(
  'wheel',
  (e) => {
    if (helpOpen) {
      e.preventDefault();
      helpFlip(e.deltaY + e.deltaX > 0 ? 1 : -1);
      return;
    }
    if (scene === 'title' && dexOpen && dexPick == null) {
      e.preventDefault();
      dexScroll = Math.min(Math.max(dexScroll + e.deltaY, 0), dexScrollMax());
      return;
    }
    if (scene === 'title' && achOpen) {
      e.preventDefault();
      achScroll = Math.min(Math.max(achScroll + e.deltaY, 0), achScrollMax());
      return;
    }
    if (scene === 'title' && labOpen) {
      e.preventDefault();
      labScroll = Math.min(Math.max(labScroll + e.deltaY, 0), labScrollMax());
      return;
    }
    if (scene === 'title' && hatchOpen) {
      e.preventDefault();
      // mid-theatre the shop isn't drawn and its scroll max is 0 — don't
      // let a wheel flick zero the parked scroll position
      if (hatch.phase !== 'idle') return;
      hatch.sparkScroll = Math.min(Math.max(hatch.sparkScroll + e.deltaY, 0), hatchScrollMax(hatch));
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

  // the hatcher's phase clock always ticks — tMax carries each phase's
  // runway (sized to the pull's hype), the scenes read s.t for animation
  if (hatchOpen) {
    hatch.t += dt;
    let auto = false; // an auto-advance this frame eats the same-instant tap
    if (hatch.phase === 'shake' && hatch.t >= hatch.tMax) {
      hatch.phase = 'reveal';
      hatch.t = 0;
      hatch.tMax = hatchLen(HATCH_REVEAL_T, hatch.results[hatch.i]);
      revealSfx(hatch.results[hatch.i]);
      auto = true;
    } else if (hatch.phase === 'reveal' && hatch.t >= hatch.tMax) {
      // the reel plays itself — a 10-pull shouldn't cost 10 taps; taps
      // still fast-forward through hatchTap's advance
      if (++hatch.i >= hatch.results.length) hatch.phase = 'results';
      else {
        hatch.tMax = hatchLen(HATCH_REVEAL_T, hatch.results[hatch.i]);
        revealSfx(hatch.results[hatch.i]); // each card earns its own hit
      }
      hatch.t = 0;
      auto = true;
    }
    if (auto) hatchLockT = t;
  }
  if (scene === 'battle' && battle && !helpOpen) {
    // the manual freezes the fight — reading help mid-shot shouldn't cost HP
    battle.update(dt);
    // ×2 is watch-phases only — a second full step, never a stretched dt, so
    // physics can't tunnel; loot stays 1× (the leash is real-time — halving
    // the 6s grab window would be a tax, not a speedup)
    if (
      battle.ff &&
      !battle.paused &&
      (battle.phase === 'aim' || battle.phase === 'shot' || battle.phase === 'enemy')
    )
      battle.update(dt);
    // the item reels deal when the reward screen opens
    const itemStep = battle.phase === 'reward';
    if (itemStep && !wasReward) {
      rewardT0 = t;
      rewardLanded = 0;
    }
    wasReward = itemStep;
    // reward sequencing: the roster opens over the item board once — swap
    // first, then the pick. An evo card still outranks it on the frame.
    if (battle.phase === 'reward' && battle.wantMenu && !menuOpen && !battle.evoChoice && !battle.mapModal) {
      battle.wantMenu = false;
      menuOpen = true;
      battle.boxSel = battle.teamSel = -1;
    }
    if (battle.phase !== 'reward' && !(battle.phase === 'map' && menuOpen)) boxScroll = 0;
    if (battle.phase !== 'map' && battle.phase !== 'reward') menuOpen = false;
    // a resolved stop banks the run — the climb survives a closed tab
    if (battle.phase === 'map' && lastPhase !== 'map') bankRun();
    lastPhase = battle.phase;
    // metagame polls — same spot the battle→scene transitions already live
    while (battle.gymsBeaten > lastGyms) {
      recordGymWin();
      playJingle('gym'); // V→I stab under the badge toast
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
    // the win/lose beat plays out in the arena first — the report (and its
    // jingle) lands only once battle's endT freeze finishes
    if (battle.raid) {
      // a raid ends at the arena — the whole climb ledger (stats, tasks,
      // streaks, rating, board, echo, report) belongs to the climb only
      if ((battle.phase === 'won' || battle.phase === 'lost') && battle.endT <= 0) {
        const won = battle.phase === 'won';
        if (won) {
          markRaidDone(); // one boss a day — the chip goes dark till UTC midnight
          const boss = raidPick(); // day-seeded — same pick startRaid fielded
          const dupe = dexIds().includes(boss.id); // read BEFORE the capture lands
          recordShiny(boss.id); // the prize: a gold entry of today's boss
          recordCapture([boss.id]);
          if (dupe) addDust(DUST_BY_TIER[3]); // a dupe raid pays epic dust like a dupe pull
          addStars(Math.ceil(40 * starBoost())); // tunable guess: 40★ raid purse
          if (INVADER_IDS.has(boss.id)) unlockAch('myth'); // an invader raid tames the myth
          unlockAch('shiny'); // the first gold dex entry is its own trophy
          playJingle('task'); // the payout chime
          const dexPay = pullMilestones(); // the raid capture can cross collector/living too
          const rookiePay = rookieCheck().reduce((s, r) => s + r.pay, 0); // a raid catch is a hatch for the ladder
          // the prize rides the hatcher's theatre — straight to reveal:
          // the fight itself was the ball-shake
          const raidRes: PullResult = { id: boss.id, rarity: 3, dupe, shiny: true, dust: dupe ? DUST_BY_TIER[3] : 0 };
          hatch = {
            phase: 'reveal',
            t: 0,
            tMax: hatchLen(HATCH_REVEAL_T, raidRes),
            i: 0,
            sparkScroll: 0,
            label: 'RAID CLEARED',
            dexPay,
            rookiePay,
            results: [raidRes],
          };
          hatchOpen = true;
        } else {
          playJingle('lose'); // free retry — the chip stays lit
        }
        battle = null;
        scene = 'title';
        titleSave = runSave(); // a parked climb's CONTINUE survives the raid
        sceneMusic();
      }
    } else if ((battle.phase === 'won' || battle.phase === 'lost') && battle.endT <= 0) {
      const won = battle.phase === 'won';
      const stageReached = won ? TOTAL_STAGES : battle.waveIndex + 1;
      statRunEnd(stageReached, won);
      // tasks accrue at run end — abandoned climbs bank nothing
      taskTick({
        kos: battle.totalKos,
        catches: battle.box.length,
        // cleared stages, not the stage died on — same count buildShare draws;
        // waveIndex is the row fought (-1 at HOME), so a win means all of them
        stages: won ? TOTAL_STAGES : Math.max(0, battle.waveIndex),
        gyms: battle.gymsBeaten,
        perks: battle.perksTaken,
        score: battle.score,
        shinies: battle.shiniesCaught,
        runs: 1,
        wins: won ? 1 : 0,
        maxstage: stageReached,
      });
      // streaks bump once per finished run — a lost daily still counts the day
      bumpStreaks(won, runIsDaily);
      // a finished daily pays a star-piece boost till UTC midnight — win or lose
      if (runIsDaily) grantBoost((daySeed() + 1) * 86400_000, 1.5); // tunable guess: ×1.5
      const dexBefore = dexIds().length;
      const prevBest = best().score;
      const mvp = battle.players.reduce((a, p) => (p.lvl > a.lvl ? p : a), battle.players[0]);
      const newBest = recordRun(battle.score, stageReached, won);
      const gap = prevBest - battle.score;
      // the ladder grades every run — deep runs climb, early wipes bleed
      const rr = applyRunRating(stageReached, won, battle.asc);
      // the lineup banks bond for the stages each species actually fought —
      // a stage-8 pickup earns for the stages it fielded, not the whole run
      const cleared = won ? TOTAL_STAGES : Math.max(0, battle.waveIndex);
      const bond = bankBond(
        battle.players.map((p) => ({ id: p.def.id, pts: Math.max(0, cleared - (p.def.joined ?? 0)) })),
      );
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
        rating: { delta: rr.delta, tier: rr.tier.name, color: rr.tier.color, up: rr.promoted, down: rr.demoted },
        place,
        seed: runSeed,
        stars: battle.starsRun, // the run's banked star pieces — the report's +N row
        starsBonus: won ? firstWinBonus() : 0, // once-a-day clear bonus — banks before the report draws it
        grind: grindBonus(), // every finished run today pays a little more
        bondDust: bond.dust, // bond level-ups — the report's dust row
        bondUps: bond.ups.length ? bond.ups : undefined, // who leveled — tagged on the squad attachment
        rookie: rookieCheck(), // run/stage/win steps clear when the run banks
      };
      // run-level trophies — battle awards its own (perfect, pinball, catches)
      const trophy = (id: string) => {
        if (unlockAch(id)) result!.newAch.push(ACHIEVEMENTS.find((a) => a.id === id)!.name);
      };
      if (won) trophy('first-clear');
      if (won && battle.asc >= 1) trophy('ascended');
      if (won && best().wins >= 3) trophy('triple');
      if (battle.totalKos >= 40) trophy('rampage');
      // streak trophies — bumpStreaks just banked this run's chain
      if (streakWins() >= 3) trophy('hot-streak');
      if (streakDaily() >= 7) trophy('daily-devotion');
      share = buildShare(battle, won);
      // catches join the dex either way; a loss leaves the team behind as
      // the next run's rival "echo"
      recordCapture(battle.box.map((b) => b.id));
      result.newDex = dexIds().length - dexBefore;
      const dexPay = claimDexRewards().reduce((s, c) => s + c.pay, 0); // collection tiers pay out
      if (dexPay) {
        result.dexPay = dexPay; // the report names its own finding
        playJingle('task');
      }
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
          ? `⚾ POKÉSTRIKE DAILY ${new Date().toISOString().slice(0, 10)} — same climb for everyone${runMod ? ` — ${runMod.name}` : ''}`
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
      if (!won) playJingle('lose'); // the descent fills the silence
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

// scene-change fade — stamped on the first frame a new scene paints
let lastSceneDrawn: Scene | null = null;
let sceneT0 = -10;

// per-frame scratch for the draw calls — map() per call was throwing away
// 3-5 arrays a frame; these get refilled and never escape render()
const pickDefs: SpeciesDef[] = [];
const offerDefs: SpeciesDef[] = [];
const menuDefs: SpeciesDef[] = [];
const menuHps: number[] = [];
const menuLvls: number[] = [];

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
      drawTitle(ctx, t, titleSave ? { stage: titleSave.pendingNext + 1, score: titleSave.score, seed: titleSave.seed } : null, t - restartConfirmT0 < 3, homeTab);
      if (dexOpen) drawDex(ctx, dexScroll);
      if (dexPick != null) drawDexDetail(ctx, dexPick); // solo or stacked — its own scrim
      if (achOpen) drawAch(ctx, achScroll);
      if (boardOpen) drawBoard(ctx);
      if (hatchOpen)
        drawHatch(ctx, hatch, {
          stars: stars(),
          dust: dust(),
          pityIn: PULL_PITY - (pullCount() % PULL_PITY),
          featured: featuredPull(),
          free: freePullLeft(),
          flash: t - hatchFlash.t < 2.5 ? hatchFlash.text : undefined,
          // an expired arm reports -1 — the cell must stop promising
          // 'TAP AGAIN' once the window lapsed, since the next tap re-arms
          armedId: sparkArm.id >= 0 && t - sparkArm.t < SPARK_ARM_T ? sparkArm.id : -1,
          armedFrac: sparkArm.id >= 0 ? Math.max(0, 1 - (t - sparkArm.t) / SPARK_ARM_T) : 0,
        });
      if (labOpen) drawLab(ctx, labScroll, stars());
      break;
    case 'charm':
      pickDefs.length = draft.picked.length;
      for (let i = 0; i < pickDefs.length; i++) pickDefs[i] = draftDef(draft.picked[i]);
      drawPerkPick(ctx, startOffers, 'CHOOSE YOUR CHARM',
        charmBonus ? (charmPicks > 1 ? 'ASCENSION III BONUS — take two charms' : 'one more — ascension pays')
                   : 'one held item starts the climb',
        t, pickDefs);
      break;
    case 'draft': {
      const idx = draftOffers();
      offerDefs.length = idx.length;
      pickDefs.length = draft.picked.length;
      for (let i = 0; i < idx.length; i++) offerDefs[i] = draftDef(idx[i]);
      for (let i = 0; i < draft.picked.length; i++) pickDefs[i] = draftDef(draft.picked[i]);
      drawDraft(
        ctx,
        offerDefs,
        pickDefs,
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
        battle.render(ctx);
        // HUD on top — the arena's cliff face extends 19px above the rim
        // and would bury the score chip's lower row
        hud(battle.stage.name); // the intro banner carries the trainer tag — the HUD tag stays short
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
          // the capture ritual renders inside battle's own pass — the reward
          // dim swallows it, so replay the ball layer clamped into the open
          // band under the tool row (its anchor sits under the cards)
          battle.drawBalls(ctx, 690, 830);
        }
        if (menuOpen && (battle.phase === 'map' || battle.phase === 'reward')) {
          const ps = battle.players;
          menuDefs.length = menuHps.length = menuLvls.length = ps.length;
          for (let i = 0; i < ps.length; i++) {
            menuDefs[i] = ps[i].def;
            menuHps[i] = ps[i].maxHp ? ps[i].hp / ps[i].maxHp : 0;
            menuLvls[i] = ps[i].lvl;
          }
          drawTeamMenu(
            ctx,
            battle.box,
            battle.boxHp,
            battle.boxLvl,
            menuDefs,
            menuHps,
            menuLvls,
            battle.boxSel,
            battle.teamSel,
            boxScroll,
            battle.captureChance,
            battle.heldItems,
            battle.masterArmed,
            battle.phase === 'reward', // the reward break seats swaps first
          );
        }
      }
      break;
    case 'result':
      if (battle) {
        ctx.fillStyle = '#0b0e1a';
        ctx.fillRect(0, 0, W, H);
        battle.render(ctx);
        hud(battle.stage.name);
      }
      if (result) drawResult(ctx, result, resultExtra, share, t, t - sceneT0);
      break;
  }
  // the ? chip reads the same gate as the hit-test — dealt boards included;
  // the mute chip stays between-fights; the pager floats over any scene
  if (helpChipUp()) drawHelpChip(ctx);
  if (
    scene === 'battle' &&
    battle &&
    (battle.phase === 'map' || battle.phase === 'reward') &&
    !menuOpen &&
    !battle.mapModal &&
    !battle.evoChoice
  ) {
    drawMuteChip(ctx);
    drawGearChip(ctx); // same gate as the hit-test — no dead or buried hotspots
  }
  if (helpOpen) drawHelp(ctx, helpPage, (!!battle && battle.coach) || !coachDone(), helpWelcome);
  if (bugOpen) drawBugCard(ctx, runSave()?.seed ?? titleSave?.seed ?? null);
  if (settingsOpen) drawSettings(ctx, settingsCat, settings());
  if (tasksOpen) drawTasks(ctx, currentTaskViews(), tasksTab, t, t - taskFlash.t < 2.5 ? taskFlash.text : undefined);
  // playtester lifeline: you can't see their console — a crash paints
  // itself with the run's seed and build, so one screenshot is the report
  if (crash) drawFailCard(ctx, 'CRASHED — SCREENSHOT THIS', crash, false);
  // SHOW FPS: dim counter in the bottom-right corner — letterbox on tall
  // screens, the box's bottom edge otherwise; clear of the chips up top
  // a fast lift out of black on every scene change — hard cuts read as bugs
  if (scene !== lastSceneDrawn) {
    lastSceneDrawn = scene;
    sceneT0 = t;
  }
  const lift = 1 - Math.min(1, (t - sceneT0) / 0.28);
  if (lift > 0.01) {
    ctx.fillStyle = `rgba(11,14,26,${(lift * 0.9).toFixed(3)})`;
    ctx.fillRect(0, -viewPad, W, H + viewPad * 2);
  }
  if (settings().fps) {
    ctx.textAlign = 'right';
    ctx.font = fontB(9);
    ctx.fillStyle = '#ffffff60';
    ctx.fillText(`${Math.round(fpsEma)} FPS`, W - 10, H + viewPad - 10);
  }
  ctx.restore();
}

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
  loadItem('star-piece'), // the hatcher/lab wallet icon — blanks harmlessly if unvendored
  loadItem('amulet-coin'), // the lab's earnings-upgrade icon
  ...PERKS.map((p) => loadItem(p.item)),
  ...BADGES.map((b) => loadItem(`badges/${b.icon}`)),
  // no Font Loading API → load() throws synchronously building this array,
  // bypassing .catch — resolve() keeps the boot going on a fallback face
  document.fonts?.load('700 10px rc')?.catch(() => console.warn('rc font failed, using monospace')) ?? Promise.resolve(),
  document.fonts?.load('10px ps2p')?.catch(() => console.warn('ps2p font failed, using rc')) ?? Promise.resolve(),
])
  .then(() => {
    scene = 'title';
    titleSave = runSave();
    // first boot opens the help deck — the kinetic coach then teaches the
    // pull itself inside run one. Later boots leave it under the ? chip
    if (!helpSeen()) {
      helpOpen = true;
      helpWelcome = true;
      markHelpSeen();
    }
    startLoop(update, render);
  })
  .catch((err) => {
    scene = 'loading';
    console.error(err);
    bootFail = String(err?.message ?? err);
    paintBootFail();
  });

// a failed boot leaves the retry card up — the tap reloads (the fetch was
// probably transient); gated on bootFail so live taps never reach it
canvas.addEventListener('pointerdown', (e) => {
  if (!bootFail) return;
  const p = toLogical(e);
  if (inRect(p.x, p.y, BOOT_RETRY)) location.reload();
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // a deploy's new SW claims the page but the old bundle stays in memory —
  // reload so the fix actually reaches an already-open client. Attached only
  // when already controlled: the first-install claim isn't an update.
  if (navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
}
