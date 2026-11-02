// Headless playthrough — no DOM. Bundle: rolldown test/smoke.ts -f esm -p node
import './shims';
import { Battle, HIDE_WP_RATE, MAP_CELL, MAP_OX, MAP_OY, ULT_SHOTS, WEATHER_FOR, parseArenaPin, shotDamp, SHOT_T, placeLabel, LABEL_INTRO } from '../src/game/battle';
import * as battleModule from '../src/game/battle';
import { makeStage, ROSTER, TOTAL_STAGES, speciesById, rollWave, trainerWave, tierOf, BOSS_POOL, ALL_SPECIES, PULLABLE, PULL_COST, PULL_PITY, PULL_SHINY, PULL_RATES, DUST_BY_TIER, pullSpecies, dustCost, INVADER_IDS, shinyOdds, EVO_LINES, setPay, bst, raidStage, RAID_MODS, AVATARS, genRoom, buildRoom, ROOM_LAYOUTS, TYPE_MOVE, foeClocks, gaugeMon } from '../src/game/data';
import { existsSync, readFileSync } from 'fs';
import { mulberry32 } from '../src/core/rng';
import { hideWpRate } from '../src/game/weakpoint';
import { TRACKS, cry, cryIO, cryLive, cryReset, CRY_KO_CAP } from '../src/core/audio';
import { roleOf, ROLE_MODS, moveOf, MOVE_NAME, LV_CAP, offStat, lvlPow, enemyDrift, launchMult, hitFloor } from '../src/game/stats';
import { genRegion, routePath, MAP_W, T_GRASS } from '../src/game/map';
import { teamTraits, TRAIT_DESC } from '../src/game/traits';
import { typeMult, strikeType, weatherMult, WEATHER_OF, TYPES } from '../src/game/types';
import { rollEvent, martStock, tickDaycare } from '../src/game/events';
import { dexIds, dexRecent, shinyIds, unlockedAch, unlockAch, ACHIEVEMENTS, coachDone, markCoached, resetCoach, best, badgeOf, gymBadges, earnBadge, BADGES, applyRunRating, rating, tier, board, recordBoard, BOARD_MAX, migrateSaves, statOffer, statRunEnd, statsDump, settings, setSetting, bagStock, bankBag, spendBag, taskState, saveTaskState, streakDaily, streakWins, bumpStreaks, runSave, stars, addStars, spendStars, dust, addDust, spendDust, pullCount, bumpPulls, labLevel, buyLab, LAB_UPGRADES, statPull, starterGrant, starBoost, boostLeft, grantBoost, raidDoneToday, markRaidDone, loginCheck, loginToday, streakRisky, firstWinBonus, grindBonus, recordCapture, DEX_REWARDS, claimDexRewards, nextDexReward, freePullLeft, useFreePull, rookieCheck, nextRookie, ROOKIE_STEPS, helpSeen, markHelpSeen, ascPick, trainerPick, setProgress, setsReady, claimSet, bankBond, bondOf, bondLv, topBond, BOND_PAY, avatarOwned, avatarUnlock, avatarRoll, AVATAR_ROLL_COST, itemTier, ITEM_TIER_CAP, ITEM_PACK_COST, itemTierRoll, clearRank, recordClear, clearBests, RANK_PAY, RANK_BALL, secretIds, markSecret } from '../src/game/meta';
import { PERKS, rollPerks, BAG_ITEMS, perkTick } from '../src/game/perks';
import { DAILY_POOL, WEEKLY_POOL, rollTasks, dayKey, weekKey, daySeed, weekSeed, taskTick, taskViews, claimTask, tasksReady, taskResetsIn, featuredPull, raidPick, raidTeam, raidMod, raidLvl, raidEscortN, dealPick, dealOff, dealCost } from '../src/game/tasks';
import { THEMES } from '../src/game/bg';
import type { Theme } from '../src/game/bg';
import { ROOM_BOSS, STAGE_GIMMICKS, BULLET_GIMMICKS, bulletHints, fieldRoomReachable } from '../src/game/data';
import { dailyMod, DAILY_MODS } from '../src/game/daily';
import { BOX_STRIP, DEX_BTN, DEX_DETAIL_R, EDIT_TEAM_BTN, MENU_CLOSE, MENU_QUIT, PARTNERS_BTN, SETS_BTN, TAB_BAR, TEAM_BTN, TEAM_PANEL, boxSlotRect, dexBuyRect, partnersStripAt, teamSlotRect, teamStageAt, TOWN_FOLK, townStrollAt } from '../src/game/screens';
import { ACH_BTN, BOARD_BTN, HALL_BTN, LAB_BTN, TASKS_BTN, TOWN_LOTS } from '../src/game/screens';
import { TAB_CELLS, TOWN_DOORS, TOWN_PLATES } from '../src/game/screens';
import { ultHintSeen } from '../src/game/meta';
import { MISSION_PAY, Missions, pickMissions } from '../src/game/missions';
import { missionBests, recordMissions } from '../src/game/meta';
import { BALL_TIERS, DROP_CAP, HIT_DROP, LOOT_TABLE, STOP_CAP, Treasure, dropOdds, rollDrop, rollReward } from '../src/game/loot';
import { FLEE_DEF, FLEE_DUST, FLEE_FROM, FLEE_RATE, FLEE_SHINY, FLEE_STARS, FLEE_TURNS, Flee } from '../src/game/flee';
import { Telops, TELOP_SPEC, comboTier } from '../src/game/telop';
import { CONNECT_MUL, Connect } from '../src/game/connect';
import { MOVE_ANIM, SHEETS, MAX_ANIMS, SOFT_CAP, recipeFor, spawnAnim, beam, burst, rain, ring, stepAnims, drawAnims, drawTell, drawTellRing, animCount, clearAnims, drainAnimRequests } from '../src/game/anim';
import { installField2, stepField2, laserPlan, icePlan, spinPlan, warpPlan, blockField2, STAGE_GIMMICKS2, WIND_ACCEL, LASER_POST_HITS, ICE_PAUSE_MAX, ICE_SKATE, SPIN_KICK, type Field2Ball, type Field2Fx } from '../src/game/gimmicks2';
import { ABILITIES, abilityOf, abilityAttack, killerMult, weatherSpeed, counterHint, countersGimmick } from '../src/game/abilities';
import { fameActive, fameDown, fameEnd, fameScene, fameUp, startFame, tickFame } from '../src/game/fame';
import { EVO_FLASH, EVO_T, evoActive, evoScene, skipEvo, startEvo, tickEvo } from '../src/game/evolve';
import { drawRunCard, shareLink, type RunCard } from '../src/game/share';
import { counterAbility, gaugeCounter, counterLive, quietOpener } from '../src/game/gauge';
import { SECRET_IDS, rollSecret, maybeSecret, enterSecret, placeSecret, closeSecret } from '../src/game/secret';
import * as secretExports from '../src/game/secret';
import { evolveOnce, midBossPick, midBossStop } from '../src/game/midboss';
import { stopRows } from '../src/game/stops';

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    fails++;
    console.error(`FAIL  ${msg}`);
  }
};

{
  const originalCtx = cryIO.ctx;
  const originalOut = cryIO.out;
  const originalFetch = cryIO.fetch;
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const sources: any[] = [];
  const fakeBuf = {} as AudioBuffer;
  const fakeCtx: any = {
    state: 'running',
    currentTime: 0,
    decodeAudioData: async () => fakeBuf,
    createBufferSource: () => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: (node: any) => node,
        start: () => {},
        stop: () => {},
      };
      sources.push(src);
      return src;
    },
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime(value: number) { this.value = value; },
        linearRampToValueAtTime(value: number) { this.value = value; },
      },
      connect: (node: any) => node,
    }),
  };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  try {
    cryReset();
    let headlessThrew = false;
    try { cry(25, 'ko'); } catch { headlessThrew = true; }
    ok(!headlessThrew && cryLive() === 0, 'headless cry stays silent');

    Object.defineProperty(globalThis, 'Audio', {
      configurable: true,
      value: class { canPlayType() { return 'probably'; } },
    });
    cryIO.ctx = () => fakeCtx;
    cryIO.out = () => ({} as AudioNode);
    cryIO.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
    cry(25, 'ko');
    await tick();
    ok(cryLive() === 1, 'cry preload starts playback');
    sources[0].onended?.();
    for (let i = 0; i < 5; i++) cry(25, 'ko');
    ok(cryLive() === CRY_KO_CAP, 'ko cries respect the live cap');
    cry(25, 'boss');
    ok(cryLive() === CRY_KO_CAP + 1, 'boss cries bypass the ko cap');
    sources[1].onended?.();
    ok(cryLive() === CRY_KO_CAP, 'ended cries leave the live count');

    cryReset();
    let failedCalls = 0, missingThrew = false;
    cryIO.fetch = async () => { failedCalls++; return { ok: false } as Response; };
    try { cry(9999, 'ko'); } catch { missingThrew = true; }
    await tick();
    cry(9999, 'ko');
    await tick();
    ok(!missingThrew && failedCalls === 1 && cryLive() === 0, 'missing cry is cached silently');

    let rejectedCalls = 0, fetchThrew = false;
    cryIO.fetch = async () => { rejectedCalls++; throw new Error('fetch failed'); };
    try { cry(9998, 'ko'); } catch { fetchThrew = true; }
    await tick();
    cry(9998, 'ko');
    await tick();
    ok(!fetchThrew && rejectedCalls === 1, 'rejected cry fetch is cached silently');

    let decodeFetches = 0, decodeCalls = 0, decodeThrew = false;
    cryIO.fetch = async () => {
      decodeFetches++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response;
    };
    fakeCtx.decodeAudioData = async () => { decodeCalls++; throw new Error('decode failed'); };
    try { cry(9997, 'ko'); } catch { decodeThrew = true; }
    await tick();
    cry(9997, 'ko');
    await tick();
    ok(!decodeThrew && decodeFetches === 1 && decodeCalls === 1, 'rejected cry decode is cached silently');
    await tick();
    ok(unhandled === 0, 'cry failures produce no unhandled rejection');

    const cryIds = new Set([...ROSTER, ...BOSS_POOL].map((species) => species.id));
    ok([...cryIds].every((id) => existsSync(`public/cries/${id}.ogg`) && existsSync(`public/cries/${id}.m4a`)), 'all roster and boss cries are vendored in both formats');
  } finally {
    process.off('unhandledRejection', onUnhandled);
    cryReset();
    cryIO.ctx = originalCtx;
    cryIO.out = originalOut;
    cryIO.fetch = originalFetch;
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio);
    else delete (globalThis as any).Audio;
  }
}

const arena = { x: 30, y: 160, w: 480, h: 620 };
const team = () => [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[12]];
const speedStats = (spe: number) => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe });

// --- finishing blows and hit feedback ------------------------------------
{
  const { comboPitch, dmgNumSize } = battleModule as any;
  ok(typeof comboPitch === 'function' && comboPitch(0, 0) === 1, 'combo pitch starts neutral');
  ok(typeof comboPitch === 'function' && comboPitch(3, 0) > comboPitch(0, 0), 'combo pitch rises with hits');
  ok(typeof comboPitch === 'function' && comboPitch(100, 100) === 1.9, 'combo pitch caps at 1.9');
  ok(typeof dmgNumSize === 'function' && dmgNumSize(10, 500, true) > dmgNumSize(10, 500, false), 'weak damage numbers are larger');
  ok(typeof dmgNumSize === 'function' && dmgNumSize(20, 500, false) > dmgNumSize(10, 500, false), 'larger damage numbers are larger');
  ok(typeof dmgNumSize === 'function' && dmgNumSize(1e6, 1, true) <= 1.7, 'damage numbers cap at 1.7');

  const fresh = () => {
    const b: any = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
    b.spawnWave(0);
    b.courtT = -9;
    b.phase = 'aim';
    b.ultHintPending = false;
    return b;
  };
  const koWave = (b: any, except?: any) => {
    const wave = b.enemies;
    for (let i = 0; i < wave.length; i++) {
      const e = wave[i];
      if (e === except) continue;
      for (let n = 0; !e.dead && n < 10; n++) b.hurt(e, 1e6, '#fff');
    }
  };

  const mid = fresh();
  mid.battles = 2;
  mid.battle = 1;
  koWave(mid);
  ok(mid.finishN === 0, 'mid-stop battle has no finishing blow');

  const final = fresh();
  final.battle = final.battles;
  const last = final.enemies[final.enemies.length - 1];
  koWave(final, last);
  ok(final.finishN === 0, 'final battle waits for its last enemy');
  koWave(final);
  ok(final.finishN === 1 && (final.fin?.t ?? 0) > 0, 'final kill starts one finishing blow');
  final.waveCleared();
  ok(final.finishN === 1, 'repeated clear does not replay finishing blow');
  for (let i = 0; i < 120 && (final.fin?.t ?? 0) > 0; i++) final.update(1 / 60);
  ok(final.fin?.t === 0 && (final.finZoom?.() ?? 0) === 0, 'finishing slow-mo and zoom end');
  ok(final.phase === 'reward' || final.phase === 'loot' || !final.rewardPending, 'reward transition is not held by finishing blow');

  const skip = fresh();
  skip.battle = skip.battles;
  const skipLast = skip.enemies[skip.enemies.length - 1];
  koWave(skip, skipLast);
  koWave(skip);
  skip.pointerDown({ x: 270, y: 500 });
  ok(skip.fin?.t === 0, 'tap skips finishing blow');

  const reward = fresh();
  reward.fin.t = 0.2;
  reward.enterReward();
  ok(reward.fin.t === 0, 'reward entry clears finishing blow');
}

// --- Monster Strike shot decay and launch speed -------------------------
{
  ok(shotDamp(0, 1 / 60) === 1, 'shot decay starts at zero');
  ok(Math.abs(shotDamp(SHOT_T, 1 / 60) - Math.exp(-1)) < 1e-9, 'shot decay reaches e^-1 at SHOT_T');
  let damp = 1;
  for (let i = 0; i < 120; i++) damp *= shotDamp((i + 1) / 60, 1 / 60);
  ok(damp < 1e-6, 'shot decay fully stops the ball by 2 × SHOT_T');
  ok(launchMult(speedStats(75)) === 1, 'Spe 75 launch multiplier is 1');
  ok(launchMult(speedStats(10)) === 0.7, 'low Spe launch multiplier clamps to 0.7');
  ok(launchMult(speedStats(250)) === 1.4, 'high Spe launch multiplier clamps to 1.4');
  ok(launchMult(speedStats(90)) > 1 && launchMult(speedStats(90)) < 1.4 && launchMult(speedStats(90)) > launchMult(speedStats(60)), 'launch multiplier rises with Spe inside the clamp');
}

// The first settled battle teaches ULT once, without changing charge or turns.
{
  localStorage.setItem('pk_ult_hint', '"bad"');
  ok(!ultHintSeen(), 'a malformed ULT hint flag is not treated as seen');
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).courtT = -9;
  b.phase = 'aim';
  b.update(0.01);
  ok(b.ultHint && ultHintSeen(), 'first settled battle shows and banks the ULT hint');
  ok(localStorage.getItem('pk_ult_hint') === 'true', 'ULT teaching persists a small boolean flag');
  ok(b.shots === 0 && b.ultIn === ULT_SHOTS, 'ULT teaching never spends a turn or charge');
  const again = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (again as any).spawnWave(0);
  (again as any).courtT = -9;
  again.phase = 'aim';
  again.update(0.01);
  ok(!again.ultHint, 'later battles do not repeat ULT teaching');
}

// Wall-hit callouts stay on court, clear of fixed HUD even during camera kicks.
{
  const b: any = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  const cy = arena.y + arena.h / 2;
  for (const [shake, punch] of [[0, 0], [24, 0.1]]) {
    b.shake = shake;
    b.punch = punch;
    const ascent = 40, descent = 10;
    const top = (b.calloutY(-100, ascent, descent) - cy) * (1 + punch) + cy;
    const bottom = (b.calloutY(2000, ascent, descent) - cy) * (1 + punch) + cy;
    ok(top - ascent * (1 + punch) - shake / 2 >= arena.y, 'top-wall callout glyphs clear the header');
    ok(bottom + descent * (1 + punch) + shake / 2 <= arena.y + arena.h - 56, 'bottom-wall callout glyphs clear the turn cue');
  }
}

// --- stage gimmicks: real bounce contacts, shields and field panels -----
{
  const b: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  b.spawnWave(0);
  b.enemies = [];
  b.blocks = [];
  b.hazards = [];
  const p = b.active;
  p.def = speciesById(7)!;
  b.damageWalls = [{ edge: 'left', start: 0.2, end: 0.6, type: 'fire' }];
  p.x = arena.x + p.r - 1; p.y = arena.y + arena.h * 0.4;
  p.vx = -400; p.vy = 0;
  const hp = p.hp;
  b.hitWalls(p);
  const chipped = p.hp;
  ok(chipped < hp && p.vx > 0, 'damage wall chips once on an outward bounce');
  b.hitWalls(p);
  ok(p.hp === chipped, 'damage wall does not repeat on a resolved contact');
  p.x = arena.x + p.r - 1; p.vx = 400;
  b.hitWalls(p);
  ok(p.hp === chipped && p.vx > 0, 'inward overlap is corrected without damage or reversing velocity');
  p.x = arena.x + p.r - 1; p.y = arena.y + arena.h * 0.8; p.vx = -400;
  b.hitWalls(p);
  ok(p.hp === chipped, 'unlit edge segment is safe');
  p.x = arena.x + p.r - 1; p.y = arena.y + arena.h * 0.4; p.vx = -400;
  b.hitWalls(p);
  ok(p.hp < chipped, 'a second real bounce can chip again without a time cooldown');
  p.def = speciesById(4)!;
  const fireHp = p.hp;
  p.x = arena.x + p.r - 1; p.vx = -400;
  b.hitWalls(p);
  ok(p.hp === fireHp, 'matching fire type counters the lava rim');
  p.def = speciesById(7)!;
  b.slowImmune = true;
  p.x = arena.x + p.r - 1; p.vx = -400;
  b.hitWalls(p);
  ok(p.hp === fireHp, 'hazard immunity counters damage walls');
  b.slowImmune = false;
  b.damageWalls = [{ edge: 'left', start: 0, end: 1, type: 'fire' }, { edge: 'top', start: 0, end: 1, type: 'fire' }];
  let wallHits = 0;
  const damage = b.damagePlayer;
  b.damagePlayer = () => { wallHits++; };
  p.x = arena.x + p.r - 1; p.y = arena.y + p.r - 1; p.vx = p.vy = -400;
  b.hitWalls(p);
  ok(wallHits === 1 && p.vx > 0 && p.vy > 0, 'a corner bounce cannot double-charge damage');
  b.damagePlayer = damage;

  const timed: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  timed.spawnWave(0);
  timed.enemies = []; timed.blocks = []; timed.hazards = [];
  const tp = timed.active;
  tp.def = speciesById(7)!;
  timed.time = 10;
  timed.installRoom({ blocks: [], hazards: [], anchors: [], damageWalls: [{ edge: 'left', start: 0, end: 1, type: 'fire' }] });
  const wallT0 = timed.time;
  const timedBounce = () => {
    tp.x = arena.x + tp.r - 1; tp.y = arena.y + arena.h * 0.5; tp.vx = -400; tp.vy = 0;
    timed.hitWalls(tp);
  };
  const timedHp = tp.hp;
  timed.time = wallT0 + 0.1; timedBounce();
  timed.time = wallT0 + 1.4; timedBounce();
  ok(tp.hp === timedHp, 'a fading damage wall does not hurt');
  timed.introAlpha = () => 1;
  const wallText: string[] = [];
  const wallCtx = {
    save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {}, strokeRect() {}, setLineDash() {}, drawImage() {},
    strokeText(text: string) { wallText.push(text); }, fillText(text: string) { wallText.push(text); },
  } as any;
  timed.drawDamageWalls(wallCtx);
  ok(!wallText.includes('DMG WALL'), 'a fading damage wall has no live label');
  timed.time = wallT0 + 1.5; timedBounce();
  ok(tp.hp < timedHp, 'a damage wall hurts once fully live');

  const cycled: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  cycled.spawnWave(0);
  cycled.enemies = []; cycled.blocks = []; cycled.hazards = [];
  const cp = cycled.active;
  cp.def = speciesById(7)!;
  cycled.time = 20;
  cycled.installRoom({ blocks: [], hazards: [], anchors: [], damageWalls: [{ edge: 'left', start: 0, end: 1, type: 'fire', on: 2, off: 2 }] });
  const cycledWall = cycled.damageWalls[0];
  const cycleBase = cycled.time;
  const litTurns: boolean[] = [], warningTurns: boolean[] = [];
  const cycleBounce = () => {
    cp.x = arena.x + cp.r - 1; cp.y = arena.y + arena.h * 0.5; cp.vx = -400; cp.vy = 0;
    cycled.hitWalls(cp);
  };
  const cycleHp = cp.hp;
  for (let n = 0; n <= 5; n++) {
    cycled.shots = cycled.wallShot0 + n;
    cycled.syncWalls();
    litTurns.push(cycled.wallLit(cycledWall));
    warningTurns.push(cycled.wallWarn(cycledWall));
    if (n === 2) {
      cycleBounce();
      ok(cp.hp === cycleHp, 'an off-cycle damage wall does not hurt');
    }
    if (n === 3) {
      const labels: string[] = [];
      cycled.fieldLabel = (_ctx: any, text: string) => { labels.push(text); };
      cycled.drawWallWarnings({} as any);
      ok(labels.includes('NEXT TURN') && !labels.includes('DMG WALL'), 'warning text appears on the turn before lighting');
    }
    if (n === 4) {
      cycleBounce();
      ok(cp.hp === cycleHp, 'a re-lit damage wall fades in again');
      wallText.length = 0;
      cycled.introAlpha = () => 1;
      cycled.drawDamageWalls(wallCtx);
      ok(!wallText.includes('DMG WALL'), 'a re-lit fading wall has no live label');
    }
  }
  ok(litTurns.join(',') === 'true,true,false,false,true,true' && warningTurns.join(',') === 'false,false,false,true,false,false', 'damage-wall cycle and warning follow turns');
  cycled.time = cycleBase + 3.5;
  cycleBounce();
  ok(cp.hp < cycleHp, 'a re-lit damage wall hurts after fading in');
  cp.def = speciesById(4)!;
  const immuneHp = cp.hp;
  cycleBounce();
  ok(cp.hp === immuneHp, 'matching type still counters a live damage wall');
  cp.def = speciesById(7)!;
  cycled.slowImmune = true;
  cycleBounce();
  ok(cp.hp === immuneHp, 'hazard immunity still counters a live damage wall');

  const f: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  f.spawnWave(0);
  const e = f.enemies[0];
  e.shieldN = 2;
  const ehp = e.hp;
  f.hurt(e, 20, '#fff');
  ok(e.hp === ehp && e.shieldN === 1, 'Protect absorbs the first of two hits');
  f.hurt(e, 20, '#fff');
  ok(e.hp === ehp && e.shieldN === 0, 'Protect absorbs the last hit before breaking');
  ok(f.telop.texts().includes('REFLECT BROKEN'), 'shield break gets the REFLECT BROKEN banner');
  f.hurt(e, 20, '#fff');
  ok(e.hp < ehp, 'the hit after a broken shield damages HP');

  b.slowImmune = false;
  b.damageWalls = [];
  p.x = 270; p.y = 470; p.vx = 600; p.vy = 0;
  b.hazards = [{ kind: 'gravity', x: 270, y: 470, r: 80 }];
  b.stepShot(1 / 60);
  ok(p.vx < 550 && p.vx > 0, 'gravity panel slows a landlocked ball without bouncing it');
  p.x = 270; p.y = 470; p.vx = 600; p.vy = 0; b.slowImmune = true;
  b.stepShot(1 / 60);
  ok(p.vx > 550, 'hazard immunity bypasses gravity panel drag');
  b.slowImmune = false;
  b.hazards = [{ kind: 'well', x: 270, y: 470, r: 100 }];
  const swimmer = p.def;
  p.def = speciesById(4)!;
  p.x = 320; p.y = 470; p.vx = 0; p.vy = 400;
  b.stepShot(1 / 60);
  ok(p.vx < 0 && p.x < 320 && p.vy > 0, 'Psychic well pulls a non-swimmer inward without a solid boundary');
  b.slowImmune = true;
  p.x = 320; p.y = 470; p.vx = 0; p.vy = 400;
  b.stepShot(1 / 60);
  ok(p.x === 320 && p.vx === 0, 'hazard immunity bypasses Psychic well pull');
  b.slowImmune = false;
  b.hazards[0].moat = true;
  p.x = 320; p.y = 470; p.vx = 0; p.vy = 400;
  b.hitSolid(p);
  ok(p.x >= 370, 'authored well moats still block non-swimmers');
  b.hazards = [{ kind: 'static', x: 270, y: 470, r: 100 }];
  p.x = 320; p.y = 470;
  b.hitSolid(p);
  ok(p.x >= 370, 'water pools still block non-swimmers');
  p.def = swimmer;
  b.hazards = [{ kind: 'heal', x: 270, y: 470, r: 80 }];
  p.x = 270; p.y = 470; p.vx = 100; p.vy = 0; p.hp = Math.round(p.maxHp * 0.5);
  const hurtHp = p.hp;
  b.stepShot(1 / 60);
  const healedHp = p.hp;
  b.stepShot(1 / 60);
  ok(healedHp > hurtHp && p.hp === healedHp, 'healing panel mends once per shot, not per substep');
  b.stopShots++;
  b.stepShot(1 / 60);
  ok(p.hp > healedHp && p.hp <= p.maxHp, 'healing panel rearms for the next shot');
  p.hp = p.maxHp - 1; b.stopShots++;
  b.stepShot(1 / 60);
  ok(p.hp === p.maxHp, 'healing panel clamps to maximum HP');

  const walls = buildRoom(ROOM_LAYOUTS[0], 'plant', mulberry32(1)).damageWalls;
  ok(walls.length > 0 && walls.every((w) => w.type === 'electric'), 'plant room data arms electric edge segments');
  const nextWalls = buildRoom(ROOM_LAYOUTS[0], 'plant', mulberry32(1), 1).damageWalls;
  ok(nextWalls[0].edge !== walls[0].edge, 'successive battles change the authored damage-wall segment');
  for (const theme of ['grove', 'volcano', 'plant'] as const) {
    const phases = [0, 1, 2].map((phase) => buildRoom(ROOM_LAYOUTS[0], theme, mulberry32(1), phase).damageWalls);
    ok(phases.every((phase) => phase.length > 0), `${theme} damage-wall phases are populated`);
    ok(phases[0].every((wall) => !wall.on), `${theme} phase 0 walls stay always-on`);
    ok(phases[2].filter((wall) => !wall.on).length === 1, `${theme} phase 2 keeps one always-on wall`);
    ok(phases.flat().every((wall) => !wall.on || (wall.on >= 1 && (wall.off ?? 0) >= 2 && wall.on + (wall.off ?? 0) <= 4)), `${theme} cycled wall timing stays within four turns`);
  }
  for (const [theme, kind] of [['cavern', 'gravity'], ['meadow', 'heal'], ['marsh', 'mine'], ['shore', 'warp'], ['sky', 'boost'], ['sanctum', 'power']] as const) {
    const room = buildRoom(ROOM_LAYOUTS[0], theme, () => 0.99);
    const panels = room.hazards.filter((h) => h.kind === (kind as string));
    ok(panels.length >= (kind === 'warp' ? 2 : 1), `${theme} guarantees its stage fixture without a lucky roll`);
    ok(panels.every((h) => ROOM_LAYOUTS[0][Math.floor(h.ny * 11)][Math.floor(h.nx * 9)] === '0'), `${theme} fixtures occupy authored floor cells`);
  }
  f.theme = 'dojo';
  const protectedFoe = f.makeEnemy({ def: speciesById(7)!, nx: 0.5, ny: 0.3 }, 0);
  ok(protectedFoe.shieldN >= 2, 'Reflect stage data gives foes a multi-hit shield');
  const boss = f.makeEnemy({ def: speciesById(7)!, nx: 0.5, ny: 0.3, boss: true }, 0);
  boss.shieldN = 0;
  f.hurt(boss, boss.maxHp, '#fff');
  ok(boss.sumStage === 1 && boss.shieldN === 3 && boss.hp > 0, 'Reflect boss rearms a three-hit shield on its next HP bar');

  for (const theme of THEMES) {
    const kind = STAGE_GIMMICKS[theme].kind;
    if (kind === 'damage-wall' || kind === 'barrier') continue;
    let fixtures = true, rngStable = true;
    for (const grid of [...ROOM_LAYOUTS, ...ROOM_BOSS]) {
      let draws = 0;
      const room = buildRoom(grid, theme, () => { draws++; return 0.99; });
      rngStable &&= draws === 1;
      fixtures &&= kind === 'warp'
        ? room.hazards.filter((h) => h.kind === 'warp' && h.pair === 2).length === 2
        : room.hazards.some((h) => h.kind === kind && grid[Math.floor(h.ny * 11)][Math.floor(h.nx * 9)] === '0');
    }
    ok(fixtures, `${theme} signature fixture fits every authored room`);
    ok(rngStable, `${theme} guaranteed fixtures consume no extra RNG draws`);
  }
}

// --- wind + laser barrier: Pidgeot gust strip, Magnemite Light Screen fence
{
  const def = (id: number) => speciesById(id)!;
  let hurts = 0;
  const fx: Field2Fx = { hurt: () => { hurts++; }, burst: () => {}, notice: () => {}, shake: () => {} };
  const ball = (d: number, x: number, y: number, vx: number, vy: number): Field2Ball => ({ uid: d, def: def(d), x, y, vx, vy, r: 22, maxHp: 100, dead: false });
  const run = (f: any, u: Field2Ball, steps: number, t0 = 0) => {
    for (let i = 0; i < steps; i++) {
      stepField2(f, u, 1 / 120, t0 + i / 120, fx);
      u.x += u.vx / 120;
      u.y += u.vy / 120;
    }
  };
  const windy = (Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => STAGE_GIMMICKS2[t]!.kind === 'wind');
  const lasered = (Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => STAGE_GIMMICKS2[t]!.kind === 'laser');
  ok(windy.length > 0 && lasered.length > 0, 'wind and laser each skin at least one theme');
  ok([0, 1, 2].every((i) => !installField2(ROOM_LAYOUTS[i], windy[0], arena, 1) && !installField2(ROOM_LAYOUTS[i], lasered[0], arena, 1)), 'gentle openers carry no wind or laser');

  const wf: any = installField2(ROOM_LAYOUTS[5], windy[0], arena, 1);
  const midY = (wf.wind.y0 + wf.wind.y1) / 2;
  const gusted = ball(25, 270, midY, 0, 0);
  run(wf, gusted, 60);
  ok(Math.abs(gusted.vx - wf.wind.dir * WIND_ACCEL * 0.5) < 1e-6 && (gusted.x - 270) * wf.wind.dir > 60, `wind pushes the ball downwind deterministically (vx ${gusted.vx.toFixed(1)})`);
  const bird = ball(18, 270, midY, 0, 0), floater = ball(92, 270, midY, 0, 0);
  run(wf, bird, 60);
  run(wf, floater, 60);
  ok(bird.vx === 0 && floater.vx === 0, 'Flying types and Levitate ride through the wind');
  const outside = ball(25, 270, wf.wind.y1 + 40, 0, 0);
  run(wf, outside, 60);
  ok(outside.vx === 0, 'wind only blows inside its strip');

  let planned = 0, reach = true;
  for (const grid of ROOM_LAYOUTS.slice(3)) {
    const plan = laserPlan(grid);
    if (!plan) continue;
    planned++;
    const walled = grid.map((line, r) => (r === plan.row ? line.slice(0, plan.col) + '2'.repeat(9 - 2 * plan.col) + line.slice(9 - plan.col) : line));
    reach &&= grid[plan.row].slice(plan.col, 9 - plan.col) === '0'.repeat(9 - 2 * plan.col) && fieldRoomReachable(walled);
  }
  ok(planned >= 10 && reach, `laser fences sit on open floor and keep P→E and anchors reachable (${planned} rooms)`);

  const room = ROOM_LAYOUTS.slice(3).find((g) => laserPlan(g))!;
  const lf: any = installField2(room, lasered[0], arena, 1);
  const bx = (lf.laser.a.x + lf.laser.b.x) / 2, by = lf.laser.a.y;
  const shot = ball(4, bx, by + 40, 0, -600);
  run(lf, shot, 20);
  ok(shot.vy > 0 && shot.y > by && hurts === 1, `laser beam blocks and chips once (vy ${shot.vy}, hurts ${hurts})`);
  const volt = ball(135, bx, by + 40, 0, -600), pika = ball(25, bx, by + 40, 0, -600);
  run(lf, volt, 20);
  run(lf, pika, 20);
  ok(volt.vy === -600 && pika.vy === -600 && volt.y < by && hurts === 1, 'Electric and Volt Absorb pass the beam unharmed');
  const post = lf.laser.a;
  for (let k = 0; k < LASER_POST_HITS; k++) {
    const hit = ball(4, post.x, post.y + 40, 0, -600);
    run(lf, hit, 20, 1 + k);
    ok(hit.vy > 0, `post hit ${k + 1} bounces the ball`);
  }
  ok(post.hp === 0 && lf.laser.down, 'two post hits drop the barrier');
  const after = ball(4, bx, by + 40, 0, -600);
  run(lf, after, 20, 5);
  ok(after.vy === -600 && after.y < by, 'broken barrier no longer blocks');

  const bb: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  bb.theme = lasered[0];
  bb.swapCourt(room);
  ok(!!bb.field2?.laser, 'battle installs the laser fence on a non-gentle court');
  bb.swapCourt(ROOM_LAYOUTS[0]);
  ok(bb.field2 === null, 'gentle court clears the field gimmick');
}

// --- ice path: glide patches pause the shot clock, Fire melts, ice abilities skate
{
  const fx: Field2Fx = { hurt: () => {}, burst: () => {}, notice: () => {}, shake: () => {} };
  const ball = (d: number, x: number, y: number, vx = 0): Field2Ball => ({ uid: d, def: speciesById(d)!, x, y, vx, vy: 0, r: 22, maxHp: 100, dead: false });
  const glide = (f: any, u: Field2Ball, steps: number, shot: number) => {
    let paused = 0;
    for (let i = 0; i < steps; i++) paused += stepField2(f, u, 1 / 120, i / 120, fx, shot);
    return paused;
  };
  const icy = (Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => STAGE_GIMMICKS2[t]!.kind === 'ice');
  ok(icy.includes('cavern'), 'cave courts carry the ice path');
  ok([0, 1, 2].every((i) => !installField2(ROOM_LAYOUTS[i], 'cavern', arena, 1)), 'gentle openers carry no ice path');
  let iced = 0, floor = true;
  for (const grid of [...ROOM_LAYOUTS.slice(3), ...ROOM_BOSS]) {
    const plan = icePlan(grid);
    if (plan.length) iced++;
    floor &&= plan.every((p) => p.c0 + p.c1 === 8 || plan.some((q) => q.r0 === p.r0 && q.c0 === 8 - p.c1))
      && plan.every((p) => [p.r0, p.r0 + 1].every((r) => grid[r].slice(p.c0, p.c1 + 1) === '0'.repeat(p.c1 - p.c0 + 1)));
  }
  ok(iced >= 10 && floor, `ice patches sit mirror-symmetric on open floor (${iced} rooms)`);
  const grid = ROOM_LAYOUTS.slice(3).find((g) => icePlan(g).length)!;
  const p0 = icePlan(grid)[0];
  const blocked = installField2(grid, 'cavern', arena, 1, [{ nx: (p0.c0 + 0.5) / 9, ny: (p0.r0 + 0.5) / 11 }]) as any;
  ok(!blocked || blocked.ice.every((p: any) => !(p.x <= arena.x + arena.w * (p0.c0 + 0.5) / 9 && p.x + p.w >= arena.x + arena.w * (p0.c0 + 0.5) / 9 && p.y <= arena.y + arena.h * (p0.r0 + 0.5) / 11 && p.y + p.h >= arena.y + arena.h * (p0.r0 + 0.5) / 11)), 'ice skips cells a room hazard sits on');
  const f: any = installField2(grid, 'cavern', arena, 1);
  const pt = f.ice[0], cx = pt.x + pt.w / 2, cy = pt.y + pt.h / 2;
  const half = glide(f, ball(1, cx, cy), 60, 1);
  ok(Math.abs(half - 0.5) < 1e-9, `ice pauses the shot clock while gliding (${half.toFixed(3)} s)`);
  const capped = glide(f, ball(1, cx, cy), 300, 1);
  ok(Math.abs(half + capped - ICE_PAUSE_MAX) < 1e-9, `the pause is bounded per shot (${(half + capped).toFixed(3)} s)`);
  ok(Math.abs(glide(f, ball(1, cx, cy), 60, 2) - 0.5) < 1e-9, 'the next shot banks a fresh glide');
  ok(glide(f, ball(1, pt.x - 30, pt.y - 30), 60, 3) === 0, 'off the patch the clock runs');
  const seal = ball(363, cx, cy, 100);
  stepField2(f, seal, 1 / 120, 0, fx, 4);
  stepField2(f, seal, 1 / 120, 0, fx, 4);
  ok(Math.abs(seal.vx - 100 * ICE_SKATE) < 1e-9, `Thick Fat skates +10% once per patch per shot (vx ${seal.vx.toFixed(1)})`);
  const flame = ball(4, cx, cy);
  ok(glide(f, flame, 10, 5) === 0 && pt.melt === 5, 'a Fire ball melts the patch it crosses');
  ok(glide(f, ball(1, cx, cy), 10, 5) === 0, 'a melted patch stops gliding for the rest of that shot');
  ok(glide(f, ball(1, cx, cy), 10, 6) > 0, 'the patch refreezes on the next shot');

  const room = ROOM_LAYOUTS.slice(3).find((g) => laserPlan(g))!;
  const lf: any = installField2(room, 'plant', arena, 1);
  const foe = { x: (lf.laser.a.x + lf.laser.b.x) / 2, y: lf.laser.a.y + 10, vx: 0, vy: -200, r: 24 };
  blockField2(lf, foe);
  ok(foe.vy > 0 && foe.y >= lf.laser.a.y + 28 - 1e-9, 'laser beam blocks foe movement too');

  const bb: any = new Battle(arena, [speciesById(1)!, speciesById(4)!, speciesById(7)!, speciesById(25)!], makeStage(4, 'T'), mulberry32(18));
  bb.spawnWave(0);
  bb.theme = 'cavern';
  bb.swapCourt(grid);
  bb.enemies = []; bb.blocks = []; bb.damageWalls = []; bb.hazards = []; bb.pickups = [];
  bb.activeIdx = 0; bb.phase = 'shot'; bb.shotT = bb.time;
  const icePt = bb.field2?.ice?.[0], u = bb.players[0];
  u.x = icePt.x + icePt.w / 2; u.y = icePt.y + icePt.h / 2; u.vx = 30; u.vy = 0;
  const t0 = bb.shotT;
  bb.stepShot(1 / 60);
  ok(Math.abs(bb.shotT - t0 - 1 / 60) < 1e-9, 'battle shot clock holds while the ball is on ice');
}

// --- spinner tiles: snap to the arrow + kick once per tile per shot; gauge gate on field2 counters
{
  const fx: Field2Fx = { hurt: () => {}, burst: () => {}, notice: () => {}, shake: () => {} };
  const off: Field2Fx = { ...fx, live: () => false };
  const ball = (d: number, x: number, y: number, vx = 0, vy = 0): Field2Ball => ({ uid: d, def: speciesById(d)!, x, y, vx, vy, r: 22, maxHp: 100, dead: false });
  const spun = (Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => STAGE_GIMMICKS2[t]!.kind === 'spin');
  const kinds = new Set((Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => !spun.includes(t)));
  ok(spun.length > 0 && spun.every((t) => !kinds.has(t)), `spinners ride their own courts (${spun.join(', ')})`);
  ok([0, 1, 2].every((i) => !installField2(ROOM_LAYOUTS[i], spun[0], arena, 1)), 'gentle openers carry no spinners');
  let rooms = 0, floor = true;
  for (const grid of [...ROOM_LAYOUTS.slice(3), ...ROOM_BOSS]) {
    const plan = spinPlan(grid);
    if (plan.length) rooms++;
    floor &&= plan.every((p) => grid[p.r][p.c] === '0' && plan.some((q) => q.r === p.r && q.c === 8 - p.c && q.dx === -p.dx && q.dy === p.dy)) && fieldRoomReachable(grid);
  }
  ok(rooms >= 20 && floor, `spinner tiles sit mirrored on open floor (${rooms} rooms)`);
  const grid = ROOM_LAYOUTS.slice(3).find((g) => spinPlan(g).length === 4)!;
  const a = installField2(grid, spun[0], arena, 1) as any, b = installField2(grid, spun[0], arena, 2) as any;
  ok(JSON.stringify(a.spin) === JSON.stringify(b.spin), 'spinner layout is fixed by the room, no rolls');
  const up = a.spin.find((t: any) => t.dy === -1), side = a.spin.find((t: any) => t.dx === 1);
  const cx = up.x + up.w / 2, cy = up.y + up.h / 2;
  const u = ball(1, cx, cy, 300, 400);
  stepField2(a, u, 1 / 120, 0, fx, 1);
  ok(Math.abs(u.vx) < 1e-9 && Math.abs(u.vy + 500 * SPIN_KICK) < 1e-6, `a spinner snaps the ball to its arrow with +15% (vy ${u.vy.toFixed(1)})`);
  stepField2(a, u, 1 / 120, 0, fx, 1);
  ok(Math.abs(u.vy + 500 * SPIN_KICK) < 1e-6, 'the same tile kicks once per shot');
  const u2 = ball(1, side.x + side.w / 2, side.y + side.h / 2, 0, -200);
  stepField2(a, u2, 1 / 120, 0, fx, 1);
  ok(Math.abs(u2.vx - 200 * SPIN_KICK) < 1e-6 && Math.abs(u2.vy) < 1e-9, 'a different tile still turns the ball that shot');
  const u3 = ball(1, cx, cy, 0, 300);
  stepField2(a, u3, 1 / 120, 0, fx, 2);
  ok(Math.abs(u3.vy + 300 * SPIN_KICK) < 1e-6, 'spinners rearm on the next shot');
  const psy = ball(63, cx, cy, 120, 0), tempo = ball(327, cx, cy, 120, 0), tempoOff = ball(327, cx, cy, 120, 0);
  stepField2(a, psy, 1 / 120, 0, fx, 3);
  stepField2(a, tempo, 1 / 120, 0, fx, 4);
  stepField2(a, tempoOff, 1 / 120, 0, off, 5);
  ok(psy.vx === 120 && psy.vy === 0 && tempo.vx === 120, 'Psychic types and Own Tempo ignore spinners');
  ok(tempoOff.vy < 0, 'a gated Own Tempo gets spun like anyone');

  const windGrid = ROOM_LAYOUTS[3];
  const wf: any = installField2(windGrid, 'sky', arena, 1);
  const wy = (wf.wind.y0 + wf.wind.y1) / 2;
  const lev = ball(92, arena.x + arena.w / 2, wy), levOff = ball(92, arena.x + arena.w / 2, wy), bird = ball(16, arena.x + arena.w / 2, wy);
  stepField2(wf, lev, 0.5, 0, fx);
  stepField2(wf, levOff, 0.5, 0, off);
  stepField2(wf, bird, 0.5, 0, off);
  ok(lev.vx === 0 && levOff.vx !== 0 && bird.vx === 0, 'gauge gate: Levitate rides wind only while live, Flying always');
  const lgrid = ROOM_LAYOUTS.slice(3).find((g) => laserPlan(g))!;
  const lf: any = installField2(lgrid, 'plant', arena, 1);
  const volt = speciesById(1)!;
  const vb = { ...ball(1, (lf.laser.a.x + lf.laser.b.x) / 2, lf.laser.a.y + 10, 0, -300), def: { ...volt, ability: 'volt-absorb' } };
  const vbOff = { ...vb, def: vb.def };
  stepField2(lf, vb, 1 / 120, 0, fx);
  stepField2(lf, vbOff, 1 / 120, 1, off);
  ok(vb.vy < 0 && vbOff.vy > 0, 'gauge gate: Volt Absorb passes the laser only while live');
  const igrid = ROOM_LAYOUTS.slice(3).find((g) => icePlan(g).length)!;
  const inf: any = installField2(igrid, 'cavern', arena, 1);
  const ip = inf.ice[0];
  const seal = ball(363, ip.x + ip.w / 2, ip.y + ip.h / 2, 100), sealOff = ball(363, ip.x + ip.w / 2, ip.y + ip.h / 2, 100);
  stepField2(inf, seal, 1 / 120, 0, fx, 1);
  stepField2(inf, sealOff, 1 / 120, 0, off, 2);
  ok(Math.abs(seal.vx - 100 * ICE_SKATE) < 1e-9 && sealOff.vx === 100, 'gauge gate: ice skaters kick only while live');
}

// --- warp pads: cross-court pairs, velocity rides through, one warp per pair per shot
{
  const fx: Field2Fx = { hurt: () => {}, burst: () => {}, notice: () => {}, shake: () => {} };
  const ball = (d: number, x: number, y: number, vx = 0, vy = 0): Field2Ball => ({ uid: d, def: speciesById(d)!, x, y, vx, vy, r: 22, maxHp: 100, dead: false });
  const warped = (Object.keys(STAGE_GIMMICKS2) as Theme[]).filter((t) => STAGE_GIMMICKS2[t]!.kind === 'warp');
  ok(JSON.stringify(warped) === '["marsh"]', `warp pads ride a court of their own (${warped.join(', ')})`);
  ok([0, 1, 2].every((i) => !installField2(ROOM_LAYOUTS[i], 'marsh', arena, 1)), 'gentle openers carry no warp pads');
  let rooms = 0, paired = true;
  for (const grid of [...ROOM_LAYOUTS.slice(3), ...ROOM_BOSS]) {
    const plan = warpPlan(grid);
    if (!plan.length) continue;
    rooms++;
    paired &&= plan.length === 4 && plan.every((p) => {
      const mate = plan.filter((q) => q.pair === p.pair && q !== p);
      return grid[p.r][p.c] === '0' && mate.length === 1 && mate[0].c === 8 - p.c && mate[0].r !== p.r;
    }) && fieldRoomReachable(grid);
  }
  ok(rooms >= 20 && paired, `warp pads pair cross-court on open floor (${rooms} rooms)`);
  const grid = ROOM_LAYOUTS.slice(3).find((g) => warpPlan(g).length)!;
  const p0 = warpPlan(grid)[0];
  ok(warpPlan(grid, new Set([`${p0.c},${p0.r}`])).every((p) => !(p.c === p0.c && p.r === p0.r)), 'warp pads skip cells a room hazard holds');
  const a = installField2(grid, 'marsh', arena, 1) as any, b = installField2(grid, 'marsh', arena, 2) as any;
  ok(JSON.stringify(a.warp) === JSON.stringify(b.warp), 'warp layout is fixed by the room, no rolls');
  const [pa, pb] = a.warp.filter((q: any) => q.pair === 0);
  const mid = (q: any) => [q.x + q.w / 2, q.y + q.h / 2];
  const u = ball(1, ...(mid(pa) as [number, number]), 300, -400);
  stepField2(a, u, 1 / 120, 0, fx, 1);
  ok(u.x === mid(pb)[0] && u.y === mid(pb)[1] && u.vx === 300 && u.vy === -400, 'a warp exits the partner pad with the same velocity');
  const cell = grid[Math.floor((u.y - arena.y) / (arena.h / 11))][Math.floor((u.x - arena.x) / (arena.w / 9))];
  ok(cell === '0', 'the exit pad sits on clear floor');
  ok(a.warpFx.length === 2, 'the teleport ring plays at both pads');
  stepField2(a, u, 1 / 120, 0.01, fx, 1);
  ok(u.x === mid(pb)[0] && u.y === mid(pb)[1], 'the pair fires once per shot, no loop back');
  stepField2(a, u, 1 / 120, 0.02, fx, 2);
  ok(u.x === mid(pa)[0] && u.y === mid(pa)[1], 'warp pads rearm on the next shot');
  const ghost = ball(92, ...(mid(pa) as [number, number]), 120, 0);
  stepField2(a, ghost, 1 / 120, 0, fx, 3);
  ok(ghost.x === mid(pa)[0] && ghost.vx === 120, 'Ghost types phase through warp pads');
  const foe = { x: mid(pa)[0], y: mid(pa)[1], vx: 50, vy: 0, r: 22 };
  blockField2(a, foe);
  ok(foe.x === mid(pa)[0] && foe.y === mid(pa)[1] && foe.vx === 50, 'foes do not warp');
}

// --- bag items: pk_bag stock, constructor applies the run-start picks ------
// NB: must run before any block that KOs a gym boss — a badge earn banks a
// bag item into pk_bag, so the stock is only pristine here.
{
  const seed = bagStock(); // pk_bag never written → the starter kit
  ok(seed['exp-share'] === 1 && seed['friend-ball'] === 1, `first read seeds the starter kit (${JSON.stringify(seed)})`);
  ok(localStorage.getItem('pk_bag') === null, 'readers stay read-only — the seed stays virtual');
  bankBag('scope-lens');
  let s = bagStock();
  ok(s['scope-lens'] === 1 && s['exp-share'] === 1 && s['friend-ball'] === 1, 'bankBag +1s onto the virtual seed');
  bankBag('scope-lens');
  ok(bagStock()['scope-lens'] === 2, 'bankBag stacks');
  spendBag(['exp-share', 'friend-ball', 'friend-ball']); // the dupe clamps
  s = bagStock();
  ok(!s['exp-share'] && !s['friend-ball'] && s['scope-lens'] === 2, `spendBag decrements and clamps at 0 (${JSON.stringify(s)})`);
  ok(JSON.parse(localStorage.getItem('pk_bag')!)['friend-ball'] === 0, 'spendBag persists the clamp in one write');

  // every catalog entry: unique ids, real sprites, terse one-line descs
  ok(BAG_ITEMS.length === 13 && new Set(BAG_ITEMS.map((i) => i.id)).size === 13, 'thirteen bag items, unique ids');
  ok(BAG_ITEMS.every((i) => existsSync(`public/sprites/items/${i.item}.png`)), 'every bag item has a vendored sprite');

  // the constructor applies each pick's apply() with the team fielded
  const mb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['master-ball', 'friend-ball']);
  ok(mb.masterArmed === true, 'master ball arms the guaranteed first catch');
  ok(Math.abs(mb.captureChance - 0.14) < 1e-9, `friend ball adds catch chance (${mb.captureChance.toFixed(2)})`);
  const sc = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['scope-lens', 'bogus-id']);
  ok(Math.abs(sc.critCh - 0.15) < 1e-9, `scope lens adds crit (${sc.critCh}) — unknown ids skip clean`);
  const br = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['macho-brace']);
  ok(Math.abs(br.scoreMult - 1.2) < 1e-9 && Math.abs(br.launchBoost - 0.92) < 1e-9,
    `macho brace: score x${br.scoreMult.toFixed(2)}, launch x${br.launchBoost.toFixed(2)}`);
  const wl = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['wide-lens']);
  ok(Math.abs(wl.captureChance - 0.16) < 1e-9, `wide lens adds catch chance (${wl.captureChance.toFixed(2)})`);
  const mu = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['muscle-band']);
  ok(Math.abs(mu.physMult - 1.1) < 1e-9, `muscle band boosts hit damage (x${mu.physMult.toFixed(2)})`);
  const rh = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['rocky-helmet']);
  ok(rh.thorns === 15, `rocky helmet arms recoil (${rh.thorns})`);

  // exp share: the fielded team starts +2 levels over a same-seed baseline
  const base = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const xp = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['exp-share']);
  ok(
    xp.players.every((p, i) => p.lvl === base.players[i].lvl + 2 && p.maxHp > base.players[i].maxHp),
    `exp share fields the team +2 levels (${xp.players.map((p) => p.lvl).join(',')})`,
  );

  // sacred ash: a wipe revives once at 30%, the second wipe ends the run
  const sa = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['sacred-ash']);
  ok((sa as any).ashArmed === true, 'sacred ash arms on construct');
  (sa as any).spawnWave(0);
  sa.phase = 'aim';
  for (const p of sa.players) { p.hp = 0; p.dead = true; }
  (sa as any).nextTurn();
  ok(sa.phase === 'aim' && sa.players.every((p) => !p.dead && p.hp === Math.round(p.maxHp * 0.3)),
    'sacred ash revives a wipe at 30%');
  ok((sa as any).ashArmed === false, 'the ash is consumed on the revive');
  for (const p of sa.players) { p.hp = 0; p.dead = true; }
  (sa as any).nextTurn();
  ok(sa.phase === 'lost', 'one ash per run — the second wipe ends it');
}

// --- uncollected oran berries ripen after an enemy turn ------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'Test'), mulberry32(3));
  (b as any).spawnWave(0);
  const enemies = (b as any).enemies;
  const attacker = enemies[0];
  attacker.dead = true;
  if (enemies.every((e: any) => e.dead)) enemies.push({ ...attacker, dead: false });
  (b as any).pickups = [{ x: 100, y: 100, kind: 'oran-berry', t: 0, age: 0 }];
  (b as any).pendingAttacks = [attacker];
  (b as any).phase = 'enemy';
  (b as any).enemyPhaseT = 100;
  (b as any).resolveEnemyTurn();
  b.update(0.4);
  const pickup = (b as any).pickups[0];
  ok(pickup.kind === 'sitrus-berry' && pickup.age === 0, 'oran berry ripens into sitrus after an enemy turn');

  const p = b.players[0];
  p.hp = 1;
  (b as any).healCd = 0;
  (b as any).grabPickup({ x: 100, y: 100, kind: 'sitrus-berry', t: 0, age: 0 });
  ok(p.hp === Math.min(p.maxHp, 1 + Math.round(p.maxHp * 0.3)), 'sitrus berry heals 30% max HP');

  // MS rows 5→6 / 7→8: power and charge pickups ripen after three enemy turns
  (b as any).pickups = [
    { x: 100, y: 100, kind: 'protein', t: 0, age: 0 },
    { x: 140, y: 100, kind: 'elixir', t: 0, age: 0 },
  ];
  for (let i = 0; i < 3; i++) (b as any).ripenPickups();
  ok((b as any).pickups[0].kind === 'x-attack' && (b as any).pickups[1].kind === 'max-elixir', 'protein and elixir ripen in three enemy turns');

  (b as any).shotPhys = 1;
  (b as any).grabPickup({ x: 100, y: 100, kind: 'x-attack', t: 0, age: 0 });
  ok((b as any).shotPhys === 2, 'x attack doubles contact damage for the shot');

  (b as any).enemies = []; // no pressure foe eating charge ticks
  p.cd = 4;
  (b as any).grabPickup({ x: 140, y: 100, kind: 'max-elixir', t: 0, age: 0 });
  ok(p.cd === 2, 'max elixir charges two pips');
}

// --- bullet gimmicks: drain, berry drop, PP Up, Chesto, Safeguard --------
{
  const b: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  b.spawnWave(0);
  b.theme = 'meadow';
  const foes = () => [0.25, 0.5, 0.75].map((nx) => b.makeEnemy({ def: speciesById(1)!, nx, ny: 0.3 }, 0));
  const armed = () => b.enemies.some((e: any) => e.safeguard || e.clocks.some((c: any) => c.drain));
  b.enemies = foes();
  b.pickups = [];
  b.roomGrid = ROOM_LAYOUTS[1];
  b.armBullets(() => 0); // every roll lands
  b.heartDrop(b.enemies[0]);
  ok(Object.values(b.bulletN).every((n) => n === 0) && !b.pickups.length && !armed(), 'gentle opener rooms roll no bullet gimmicks or KO berries');

  b.roomGrid = ROOM_LAYOUTS[3];
  b.armBullets(() => 0);
  const count = (k: string) => b.pickups.filter((pk: any) => pk.kind === k).length;
  ok(count('pp-up') === BULLET_GIMMICKS['pp-up'].cap && count('chesto-berry') === BULLET_GIMMICKS.chesto.cap, 'PP Up and Chesto spawn capped per battle');
  const drains = b.enemies.filter((e: any) => e.clocks[0]?.drain);
  ok(drains.length === BULLET_GIMMICKS.drain.cap && drains[0].clocks[0].move === 'GIGA DRAIN', 'drain clocks cap per battle and take a Pokémon drain move');
  const guards = b.enemies.filter((e: any) => e.safeguard);
  ok(guards.length === BULLET_GIMMICKS.safeguard.cap && count('oran-berry') === 1, 'Safeguard caps per battle and leaves a berry to break it');

  const d = drains[0];
  d.hp = 1;
  b.drainHit(d, 'GIGA DRAIN', 20);
  ok(d.hp === 11, 'drain move heals the foe half the damage it dealt');

  const g = guards[0];
  const ghp = g.hp;
  b.hurt(g, 50, '#fff');
  ok(g.hp === ghp, 'Safeguard foe ignores hits');
  b.grabPickup({ x: 100, y: 100, kind: 'oran-berry', t: 0, age: 0 });
  b.hurt(g, 5, '#fff');
  ok(!g.safeguard && g.hp < ghp, 'grabbing a berry breaks Safeguard');

  b.ultIn = 5;
  b.grabPickup({ x: 100, y: 100, kind: 'pp-up', t: 0, age: 0 });
  ok(b.ultIn === 4, 'PP Up adds one ULT charge');
  b.ultIn = 0;
  b.grabPickup({ x: 100, y: 100, kind: 'pp-up', t: 0, age: 0 });
  ok(b.ultIn === 0, 'PP Up never overfills a ready ULT');

  for (const e of b.enemies) { e.timer = 0; for (const c of e.clocks) c.t = 0; }
  const full = b.enemies[2].clocks[0].turn;
  b.grabPickup({ x: 100, y: 100, kind: 'chesto-berry', t: 0, age: 0 });
  ok(b.enemies.every((e: any) => e.timer > 0 && e.clocks.every((c: any) => c.t === c.turn)) && full > 0, 'Chesto Berry winds every foe clock back to full');

  b.pickups = [];
  for (const e of b.enemies) b.heartDrop(e);
  ok(b.bulletN.heart === BULLET_GIMMICKS.heart.cap && count('oran-berry') === BULLET_GIMMICKS.heart.cap && b.pickups[0].x === b.enemies[0].x, 'KO berry drops cap per battle and land where the foe fell');
  for (const e of b.enemies) e.dead = true;
  b.bulletN.heart = 0;
  b.heartDrop(b.enemies[0]);
  ok(b.bulletN.heart === 0, 'the last KO of a wave drops no berry');

  ok(bulletHints('meadow', 'grass').join(' · ') === 'DRAIN · SAFEGUARD' && !bulletHints('cavern', 'rock').length, 'stop preview tags the bullet gimmicks a stop can roll');
}

// --- ascension scales enemy bulk ----------------------------------------
{
  const stage = makeStage(7, 'Test');
  const a = new Battle(arena, team(), stage, mulberry32(1));
  (a as any).spawnWave(0);
  const hpA = (a as any).enemies[0].maxHp;
  const b = new Battle(arena, team(), makeStage(7, 'Test'), mulberry32(1));
  b.asc = 5;
  (b as any).spawnWave(0);
  const hpB = (b as any).enemies[0].maxHp;
  ok(hpB > hpA, `ascension scales enemy hp (${hpA} -> ${hpB})`);
}

// --- weather summoners own the sky ----------------------------------------
{
  const stage = makeStage(7, 'Test');
  const caller = new Battle(arena, team(), stage, mulberry32(1));
  const s0 = (caller as any).stage.waves[0][0];
  s0.def = { ...s0.def, skyFor: 'sun' as const };
  (caller as any).spawnWave(0);
  ok((caller as any).weather === 'sun', 'drought caller brings its own sky');
  ok(String((caller as any).waveSpecial ?? '').includes('DROUGHT'), 'the banner names the sky it brought');
}

// --- swift swim / chlorophyll: carriers press 1.5x in their own sky --------
{
  const drifted = (sky: 'rain' | null) => {
    const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
    (b as any).spawnWave(0);
    const e = (b as any).enemies[0];
    e.def = { ...e.def, swift: 'rain', sleepy: undefined, blink: undefined };
    e.x = arena.x + arena.w / 2;
    e.y = arena.y + 40;
    for (const p of b.players) {
      p.x = arena.x + arena.w / 2;
      p.y = arena.y + arena.h - 40;
    }
    (b as any).pickups = []; // a thief would chase loot instead of the pack
    (b as any).weather = sky;
    b.phase = 'aim'; // drift only ticks while the fight's live
    const x0 = e.x, y0 = e.y;
    for (let i = 0; i < 30; i++) b.update(1 / 60);
    return Math.hypot(e.x - x0, e.y - y0);
  };
  const wet = drifted('rain'), dry = drifted(null);
  ok(dry > 0 && wet > dry * 1.3, `swift carrier presses harder in its sky (${dry.toFixed(1)} -> ${wet.toFixed(1)})`);
}

// --- ascension modifiers: named tiers on top of the bulk ------------------
{
  const base = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  (base as any).spawnWave(0);
  const t0 = (base as any).enemies.find((e: any) => !e.def.melee)?.timer;
  const hot = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  hot.asc = 2;
  (hot as any).spawnWave(0);
  const t1 = (hot as any).enemies.find((e: any) => !e.def.melee)?.timer;
  ok(t1 !== undefined && t0 !== undefined && t1 < t0, `ASC 2 foes wind up faster (${t0} -> ${t1})`);

  const rest = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(1));
  rest.asc = 4;
  const p = (rest as any).players[0];
  p.hp = 10;
  (rest as any).arriveAtNode({ kind: 'rest', row: 0 });
  ok((rest as any).eventChoice?.options.length === 2, 'rest stop asks: heal or train');
  (rest as any).phase = 'map';
  (rest as any).pickEventChoice(0); // POKÉ CENTER — heal + revive
  ok(p.hp === Math.round(p.maxHp * 0.75), `ASC 4 rests heal to 75% (${p.hp}/${p.maxHp})`);

  const gym = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  gym.asc = 6;
  (gym as any).spawnWave(2);
  const boss = (gym as any).enemies.find((e: any) => e.boss);
  ok(boss?.enraged === true, 'ASC 6 gym leaders arrive enraged');

  // StS stacking: rung 9 keeps every lower rule live in the same fight —
  // fast wind-up (2), rolled sky (8) on a fodder wave, then enraged boss
  // (6) + frenzied drift (7) when the gym lands. The stage-31 pack is all
  // melee — compare its wound-up timer against a calm same-seed run.
  const calm = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (calm as any).spawnWave(0);
  const cTimer = (calm as any).enemies[0]?.timer;
  const stack = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  stack.asc = 9;
  (stack as any).spawnWave(0);
  const sTimer = (stack as any).enemies[0]?.timer;
  ok(sTimer !== undefined && cTimer !== undefined && sTimer < cTimer, `ASC 9 still winds up fast (${cTimer} -> ${sTimer})`);
  ok((stack as any).weather != null, 'ASC 9 keeps rung 8: fodder wave rolled weather');
  (stack as any).spawnWave(2);
  const sBoss = (stack as any).enemies.find((e: any) => e.boss);
  ok(sBoss?.enraged === true && sBoss.drift > (boss?.drift ?? 0), 'ASC 9 keeps 6+7: enraged + frenzied');
}

// --- designed opener: clustered first pack + breathing room -------------
{
  const b = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(9));
  (b as any).spawnWave(0);
  const es = (b as any).enemies;
  ok(es.length === 3, 'opener fields three fodder');
  const xs = es.map((e: any) => (e.x - arena.x) / arena.w);
  const spread = Math.max(...xs) - Math.min(...xs);
  ok(spread < 0.45, `opener foes clustered for the ricochet (spread ${spread.toFixed(2)})`);
  ok(es.every((e: any) => e.timer > (e.def.melee ? 2 : 3)), 'opening wave foes give one extra beat');
}

// --- elite stops: deeper mono-type squad, rare-or-better loot -------------
{
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  (b as any).spawnWave(0, { kind: 'elite', ttype: 'fire', row: 0, tx: 0, ty: 0, links: [] });
  const es = (b as any).enemies;
  ok(es.every((e: any) => e.def.type === 'fire'), `elite fields a mono-type squad (${es.length} mons)`);
  (b as any).enterReward();
  ok(
    b.rewardOffers.length > 0 && b.rewardOffers.every((p) => p.rarity === 'rare' || p.rarity === 'legendary'),
    `elite pays rare+ relics (${b.rewardOffers.map((p) => p.rarity).join(',')})`,
  );
}

// --- shelled foes: the plate face glances hits, the back pays a flank ----
{
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(5));
  (b as any).spawnWave(0);
  const [e1, e2] = (b as any).enemies;
  for (const e of [e1, e2]) {
    e.def = { ...e.def, shielded: true };
    e.shieldA = 0; // plate faces +x — a shooter right of the foe hits the shell
  }
  const shooter = (b as any).active;
  shooter.vx = 500;
  shooter.vy = 0;

  shooter.x = e1.x + e1.r + 10; // arriving from the shell side → guarded
  shooter.y = e1.y;
  const hp1 = e1.hp;
  (b as any).strikeEnemy(shooter, e1);
  const guardedDmg = hp1 - e1.hp;

  shooter.x = e2.x - e2.r - 10; // arriving from the far side → flanked
  shooter.y = e2.y;
  const hp2 = e2.hp;
  (b as any).strikeEnemy(shooter, e2);
  const flankDmg = hp2 - e2.hp;

  ok(guardedDmg > 0 && flankDmg > 0 && flankDmg / guardedDmg > 3, `shell face glances, back flanks (${guardedDmg} -> ${flankDmg})`);

  // barbed foes: contact chips the shooter's own HP
  const e3 = (b as any).enemies[2] ?? e1;
  e3.def = { ...e3.def, spiky: true, shielded: false };
  const php = shooter.hp;
  shooter.x = e3.x - e3.r - 10;
  shooter.y = e3.y;
  (b as any).strikeEnemy(shooter, e3);
  ok(shooter.hp < php, `spiked contact chips the ball (${php} -> ${shooter.hp})`);

  // destiny bond: the strike that finishes a bond carrier faints the shooter —
  // hazards and indirect damage stay the safe answer
  const eBond = e3;
  eBond.def = { ...eBond.def, bond: true, spiky: false };
  eBond.hp = 1;
  eBond.lastHit.clear(); // the spiky poke just ate the hit cooldown
  const shooterAlive = shooter.dead;
  (b as any).strikeEnemy(shooter, eBond);
  ok(eBond.dead && !shooterAlive && shooter.dead, `destiny bond takes the striker down (${eBond.def.name})`);
  shooter.dead = false; shooter.hp = shooter.maxHp; // the next asserts still need it

  // color change: a struck chameleon takes on the attacking type, so the
  // same hit lands resisted next time
  const shooterDef0 = shooter.def;
  shooter.def = { ...shooter.def, type: 'fire' as const, type2: undefined };
  eBond.def = { ...eBond.def, bond: false, chameleon: true };
  eBond.hp = eBond.maxHp; eBond.dead = false; eBond.lastHit.clear();
  (b as any).strikeEnemy(shooter, eBond);
  ok(eBond.def.type === 'fire', `color change adopts the strike type (now ${eBond.def.type})`);
  shooter.def = shooterDef0;

  // regen foes mend — a wounded one gains HP over a sim second
  e1.def = { ...e1.def, regen: true };
  e1.hp = Math.floor(e1.maxHp / 2);
  (b as any).stepEnemyMovement(1);
  ok(e1.hp > Math.floor(e1.maxHp / 2), `regen foe mends (${Math.floor(e1.maxHp / 2)} -> ${e1.hp})`);

  // split foes divide on KO — two half-size spawn take its place
  const n0 = (b as any).enemies.length;
  e2.def = { ...e2.def, split: true };
  (b as any).hurt(e2, e2.hp, '#fff');
  ok((b as any).enemies.length === n0 + 2, `split KO adds two kids (${n0} -> ${(b as any).enemies.length})`);
  ok((b as any).enemies.filter((x: any) => !x.dead && x.def.split === undefined).length >= 2, 'split kids can\'t re-split');

  // rage foes snap under 30% — wound one and it enrages
  e1.def = { ...e1.def, rage: true };
  e1.hp = e1.maxHp;
  (b as any).hurt(e1, Math.ceil(e1.maxHp * 0.75), '#fff');
  ok(e1.enraged === true, 'rage foe enrages under 30%');

  // sleepy foes doze — countdown frozen, first hit lands +35% and wakes it
  e1.asleep = true;
  e1.enraged = false;
  e1.hp = e1.maxHp;
  e1.timer = 5;
  (b as any).endShot();
  ok(e1.timer === 5, `dozing countdown never winds (${e1.timer})`);
  (b as any).hurt(e1, 10, '#fff');
  ok(e1.asleep === false && e1.hp === e1.maxHp - 14, `wake-up hit lands like a crit (${e1.maxHp} -> ${e1.hp})`);

  // repel fields shove the ball off a head-on lane
  e1.repelR = 90;
  e1.x = arena.x + 300; e1.y = arena.y + 300;
  const act = (b as any).active;
  act.x = e1.x - 60; act.y = e1.y;
  act.vx = 50; act.vy = 0;
  const ax = act.x;
  (b as any).stepShot(0.05);
  ok(act.x < ax, `repel field shoves the ball back (${ax.toFixed(0)} -> ${act.x.toFixed(0)})`);
  e1.repelR = 0;

  // arena trap: a fleeing ball inside the leash band gets dragged back
  const trapDef = e1.def;
  e1.def = { ...trapDef, trap: true };
  e1.x = arena.x + 200; e1.y = arena.y + 200;
  act.x = e1.x + 200; act.y = e1.y; // in the 150–300 leash band
  act.vx = 300; act.vy = 0; // fleeing outward
  const ax2 = act.x;
  (b as any).stepShot(0.05);
  ok(act.x < ax2 + 5 || act.vx < 300, `arena trap drags the fleeing ball back (x ${ax2.toFixed(0)} -> ${act.x.toFixed(0)}, vx ${act.vx.toFixed(0)})`);
  e1.def = trapDef;

  // type-aware hazards: fire balls bathe in lava, flyers sail the spikes
  // (hzT stamps when the hazard fires — the flying trait can still dodge)
  const act2 = (b as any).active;
  const lx = arena.x + arena.w / 2, ly = arena.y + arena.h / 2;
  (b as any).hazards = [{ kind: 'lava', x: lx, y: ly, r: 40 }];
  act2.def = { ...act2.def, type: 'fire', type2: undefined };
  act2.x = lx; act2.y = ly; act2.vx = 5; act2.vy = 0; act2.hzT = -9;
  (b as any).stepShot(0.02);
  ok(act2.hzT === -9, 'fire ball bathes in lava — the chip never fires');
  act2.def = { ...act2.def, type: 'normal' };
  act2.hzT = -9;
  (b as any).stepShot(0.02);
  ok(act2.hzT > -9, 'non-fire ball takes the lava chip');

  // ice slick: a shot crossing the frozen band keeps nearly all its speed
  (b as any).hazards = [{ kind: 'ice', x: lx, y: ly, r: 60 }];
  act2.def = { ...act2.def, type: 'normal' };
  act2.x = lx; act2.y = ly; act2.vx = 400; act2.vy = 0;
  (b as any).stepShot(0.02);
  const vIce = Math.abs(act2.vx);
  act2.x = lx + 150; act2.y = ly; act2.vx = 400; act2.vy = 0;
  (b as any).stepShot(0.02);
  const vDry = Math.abs(act2.vx);
  ok(vIce > vDry, `ice keeps the ball's speed (${vIce.toFixed(0)} vs ${vDry.toFixed(0)})`);
  act2.vx = 0;
}

// sweep streaks pay — back-to-back one-shot clears escalate the callout
{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(4));
  (b as any).spawnWave(0);
  (b as any).waveShots = 1;
  (b as any).waveCleared();
  ok((b as any).sweepStreak === 1, 'first sweep starts the streak');
  const s0 = (b as any).score;
  (b as any).phase = 'aim'; // the board consumed the reward between waves
  (b as any).rewardPending = false;
  (b as any).waveShots = 1;
  (b as any).waveCleared();
  ok((b as any).sweepStreak === 2 && (b as any).score - s0 >= 120, `sweep x2 pays the streak bonus (${s0} -> ${(b as any).score})`);

  // untouched waves pay the flawless carrot; one hit forfeits it
  (b as any).phase = 'aim';
  (b as any).rewardPending = false;
  (b as any).waveShots = 3;
  const s1 = (b as any).score;
  (b as any).waveCleared();
  ok((b as any).waveSpecial.includes('FLAWLESS') && (b as any).score - s1 >= 50, `flawless clear pays (${s1} -> ${(b as any).score})`);
  (b as any).phase = 'aim';
  (b as any).rewardPending = false;
  (b as any).waveShots = 3;
  (b as any).waveFlawless = false; // took a hit this wave
  (b as any).waveCleared();
  ok(!(b as any).waveSpecial.includes('FLAWLESS'), 'a hit forfeits the flawless carrot');
}

// the ball swats hostile orbs mid-flight — cover for the parked team
{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(5));
  (b as any).spawnWave(0);
  const act = (b as any).active;
  act.vx = 0; act.vy = 0;
  (b as any).orbs = [{ x: act.x + 20, y: act.y, target: act, dmg: 5, t: 2, wob: 0, color: '#f00', hostile: true, src: (b as any).enemies[0] }];
  const sc0 = (b as any).score;
  (b as any).stepShot(0.02);
  ok(!(b as any).orbs.some((o: any) => o.t > 0) && (b as any).score - sc0 >= 10, `ball swats a hostile orb (${sc0} -> ${(b as any).score})`);
}

// a KO mid-combo tires the mon — the shot's chain feeds the catch roll
{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(7));
  (b as any).spawnWave(0);
  const e = (b as any).enemies[0];
  b.captureChance = 0;
  (b as any).inTrainer = false;
  (b as any).shotCombo = 100; // cap the +0.12 chain bonus
  (b as any).rng = () => 0.1; // 0.1 < 0.12 → lands; flat 0% odds never would
  (b as any).hurt(e, e.hp + 1, '#fff');
  ok((b as any).balls.at(-1)?.ok === true, 'a pinball KO tires the mon into the ball');
}

// raiders ditch the fight for the drop — in reach they swallow it, far they dash
{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(6));
  (b as any).spawnWave(0);
  const e = (b as any).enemies[0];
  e.def = { ...e.def, raider: true };
  e.hp = Math.floor(e.maxHp / 2);
  (b as any).pickups = [{ x: e.x + 10, y: e.y, kind: 'protein', t: 0, age: 0 }];
  (b as any).fireEnemy(e);
  ok((b as any).pickups.length === 0 && e.hp > Math.floor(e.maxHp / 2), 'raider swallows the drop in reach');
  (b as any).pickups = [{ x: e.x + 300, y: e.y, kind: 'protein', t: 0, age: 0 }];
  const ex = e.x;
  (b as any).fireEnemy(e);
  ok(Math.abs(e.x - ex) > 40, `raider dashes at the far drop (${ex.toFixed(0)} -> ${e.x.toFixed(0)})`);

  // lava burns whatever stands in it — fire types and flyers exempt
  e.def = { ...e.def, raider: false, type: 'grass', type2: undefined };
  e.x = arena.x + 240; e.y = arena.y + 300; e.hzT = -9;
  (b as any).hazards = [{ kind: 'lava', x: e.x, y: e.y, r: 60 }];
  const hp0 = e.hp;
  (b as any).stepEnemyMovement(0.05);
  ok(e.hp < hp0, `lava chips the standing foe (${hp0} -> ${e.hp})`);
  e.hzT = -9;
  (b as any).hazards = [{ kind: 'spikes', x: e.x, y: e.y, r: 60 }];
  const hp1 = e.hp;
  (b as any).stepEnemyMovement(0.05);
  ok(e.hp < hp1, `spike strip nicks the grounded foe (${hp1} -> ${e.hp})`);

  // a gust lane sweeps the pack standing in it — hazards herd foes too
  e.boss = false;
  const gx0 = e.x;
  (b as any).hazards = [{ kind: 'gust', x: e.x, y: e.y, r: 80, dir: 1 }];
  (b as any).stepEnemyMovement(0.5);
  ok(e.x > gx0 + 10, `gust lane sweeps the standing foe (${gx0.toFixed(0)} -> ${e.x.toFixed(0)})`);

  // blink foes teleport on a cycle — the hop lands somewhere else
  e.def = { ...e.def, blink: true, sleepy: false };
  e.asleep = false;
  e.blinkT = 0.01;
  const bx0 = e.x, by0 = e.y;
  (b as any).hazards = [];
  (b as any).stepEnemyMovement(0.05);
  ok(Math.hypot(e.x - bx0, e.y - by0) > 30 && e.blinkT > 3, `blink foe teleports and re-arms (${bx0.toFixed(0)},${by0.toFixed(0)} -> ${e.x.toFixed(0)},${e.y.toFixed(0)})`);

  // SOS callers cry a flagless kid into the pack instead of attacking
  e.def = { ...e.def, summon: true };
  const nFoes0 = (b as any).enemies.filter((a: any) => !a.dead).length;
  (b as any).fireEnemy(e);
  const nFoes1 = (b as any).enemies.filter((a: any) => !a.dead).length;
  const kid = (b as any).enemies[(b as any).enemies.length - 1];
  ok(nFoes1 === nFoes0 + 1 && !kid.def.summon, `SOS caller spawns a flagless kid (${nFoes0} -> ${nFoes1})`);
  e.def = { ...e.def, summon: undefined };
  kid.dead = true; // the test spawn can't leak into later wave counts

  // mirror blobs transform into the strongest standing mon — own HP kept
  const lead = [...(b as any).players].filter((p: any) => !p.dead).sort((x: any, y: any) => bst(y.def) - bst(x.def))[0];
  const mir = (b as any).makeEnemy(
    { def: { id: 132, name: 'Ditto', type: 'normal', stats: { hp: 48, atk: 48, def: 48, spa: 48, spd: 48, spe: 48 }, mirror: true }, nx: 0.5, ny: 0.3 },
    (b as any).waveIndex,
  );
  ok(mir.def.mirror && mir.def.stats.atk === lead.def.stats.atk && mir.def.stats.hp === 48, `mirror copies the lead's stats but keeps blob HP (atk ${mir.def.stats.atk})`);
  mir.dead = true; // test spawn, not a wave member

  // knockback: a fast hit shoves the foe along the shot's line
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  const act3 = (b as any).active;
  act3.vx = 800; act3.vy = 0;
  const ex0 = e.x;
  (b as any).strikeEnemy(act3, e);
  ok(e.vx > 100, `knockback shoves the foe along the shot (vx ${e.vx.toFixed(0)})`);
  e.vx = 0;
  e.vy = 0;

  // billiards: a shoved foe slams its packmate and transfers the hit
  const pin = (b as any).enemies.find((f: any) => f !== e && !f.dead);
  if (pin) {
    pin.x = e.x + e.r + pin.r - 4; pin.y = e.y; // overlapping, e slams rightward
    pin.vx = 0; pin.vy = 0;
    e.vx = 400; e.vy = 0;
    const pinHp0 = pin.hp;
    (b as any).separatePair(e, pin);
    ok(pin.hp < pinHp0 && pin.vx > 100, `a shoved foe bowls its packmate (hp ${pinHp0} -> ${pin.hp}, vx ${pin.vx.toFixed(0)})`);
    e.vx = 0;
  }

  // wall-slam: a flung foe pays for the rocks it hits
  (b as any).blocks = [{ x: e.x + 30, y: e.y - 20, w: 20, h: 60, kind: 'rock' }];
  e.vx = 500; e.vy = 0;
  const slamHp0 = e.hp;
  (b as any).stepEnemyMovement(0.1);
  ok(e.hp < slamHp0, `wall-slam chips the flung foe (${slamHp0} -> ${e.hp})`);
  e.vx = 0;
  e.vy = 0;
  (b as any).blocks = [];

  // hunters track the weakest link, not the nearest body
  {
    const ps = (b as any).players.filter((p: any) => !p.dead);
    if (ps.length >= 2) {
      const [near, far] = ps;
      near.x = e.x + 30; near.y = e.y; near.hp = near.maxHp;
      far.x = e.x + 300; far.y = e.y; far.hp = 1;
      e.def = { ...e.def, hunter: true };
      ok((b as any).nearestPlayer(e) === far, 'hunter picks the weakest mon over the nearest');
      e.def = { ...e.def, hunter: undefined };
      near.hp = near.maxHp;
      far.hp = far.maxHp;
    }
  }

  // follow me: a living bait mon pulls every foe lock — even hunters
  {
    const ps = (b as any).players.filter((p: any) => !p.dead);
    if (ps.length >= 2) {
      const bait = ps[1];
      bait.def = { ...bait.def, taunt: true };
      e.def = { ...e.def, hunter: true }; // even a bloodhound takes the bait
      ok((b as any).nearestPlayer(e) === bait, 'follow me pulls the foe lock');
      e.def = { ...e.def, hunter: undefined };
      bait.def = { ...bait.def, taunt: false };
    }
  }

  // a thief pockets a touched drop and its corpse coughs it back up
  e.def = { ...e.def, thief: true };
  e.vx = 0; e.vy = 0;
  (b as any).pickups = [{ x: e.x + 5, y: e.y, kind: 'protein', t: 0, age: 0 }];
  (b as any).stepEnemyMovement(0.05);
  ok((b as any).pickups.length === 0 && e.stolen === 'protein', 'thief pockets a touched drop');
  (b as any).hurt(e, e.hp + 1, '#fff');
  ok((b as any).pickups.some((pk: any) => pk.kind === 'protein'), 'a dead thief re-drops the loot');
  e.stolen = undefined;
  e.def = { ...e.def, thief: undefined };

  // damp: a living carrier keeps the bomber's powder wet — no blast
  e.dead = false; e.hp = e.maxHp; e.lastHit = new Map();
  e.def = { ...e.def, fuse: true };
  const damper = (b as any).players[0];
  damper.def = { ...damper.def, damp: true };
  const php = damper.hp;
  (b as any).fireEnemy(e);
  ok(!e.dead && damper.hp === php, 'damp fizzles the fuse — bomber survives, mon unhurt');
  damper.def = { ...damper.def, damp: false };
  e.lastHit = new Map();
  (b as any).fireEnemy(e);
  ok(e.dead, 'the fuse still blows once the damp mon is gone');
  e.dead = false; e.hp = e.maxHp;
  e.def = { ...e.def, fuse: undefined };

  // spikers seed the player half — the patch lands south of mid-court
  e.def = { ...e.def, lay: true };
  const hz0 = (b as any).hazards.length;
  (b as any).fireEnemy(e);
  const laid = (b as any).hazards[(b as any).hazards.length - 1];
  ok((b as any).hazards.length === hz0 + 1 && laid.kind === 'spikes' && laid.y > arena.y + arena.h * 0.5, 'spiker lobs a patch into the player half');
  (b as any).hazards = (b as any).hazards.slice(0, hz0);
  e.def = { ...e.def, lay: undefined };

  // anchor: knockback can't shift the planted foe
  e.def = { ...e.def, anchor: true };
  e.lastHit = new Map();
  e.vx = 0;
  const act4 = (b as any).active;
  act4.vx = 800; act4.vy = 0;
  (b as any).strikeEnemy(act4, e);
  ok(e.vx < 50, `anchored foe ignores the shove (vx ${e.vx.toFixed(0)})`);
  e.def = { ...e.def, anchor: undefined };

  // leech foes sip back the wounds they deal
  e.def = { ...e.def, leech: true };
  e.hp = Math.max(1, e.maxHp - 30);
  const leechHp0 = e.hp;
  const victim = (b as any).players.find((p: any) => !p.dead);
  (b as any).damagePlayer(victim, 10, e);
  ok(e.hp > leechHp0, `leech mends off the hit (${leechHp0} -> ${e.hp})`);
  e.def = { ...e.def, leech: undefined };
  e.hp = e.maxHp;

  // sleep powder drops the victim, the nap costs a turn
  e.def = { ...e.def, drowsy: true };
  const sleepy = (b as any).players.find((p: any) => !p.dead);
  const rng0 = (b as any).rng;
  (b as any).rng = () => 0.1; // under the 0.55 powder chance
  (b as any).damagePlayer(sleepy, 5, e);
  (b as any).rng = rng0;
  ok(sleepy.asleep === true, 'sleep powder puts the victim out');
  // the sleeping mon skips its turn — nextTurn wakes it sitting out
  const living = (b as any).players.filter((p: any) => !p.dead).length;
  (b as any).activeIdx = (b as any).players.indexOf(sleepy) - 1;
  if ((b as any).activeIdx < 0) (b as any).activeIdx = (b as any).players.length - 1;
  (b as any).phase = 'aim';
  (b as any).nextTurn();
  ok(sleepy.asleep === false && (living < 2 || (b as any).active !== sleepy), 'a dozing mon skips its turn and wakes');
  e.def = { ...e.def, drowsy: undefined };

  // venom stings leave a wound that bleeds each round
  e.def = { ...e.def, venom: true };
  const vic = (b as any).players.find((p: any) => !p.dead);
  vic.dotTicks = 0;
  (b as any).damagePlayer(vic, 5, e);
  ok(vic.dotTicks > 0 && vic.dotDmg > 0, `venom sting poisons the victim (${vic.dotTicks} ticks)`);
  vic.dotTicks = 0;
  vic.dotDmg = 0;
  e.def = { ...e.def, venom: undefined };

  // will-o-wisp burns — the victim singes and pulls its punches
  e.def = { ...e.def, burn: true };
  const burnee = (b as any).players.find((p: any) => !p.dead);
  burnee.burnT = 0;
  const rng1 = (b as any).rng;
  (b as any).rng = () => 0.1; // under the 0.7 wisp chance
  (b as any).damagePlayer(burnee, 5, e);
  (b as any).rng = rng1;
  ok(burnee.burnT > 0, `wisp burns the victim (${burnee.burnT} rounds)`);
  burnee.burnT = 0;
  e.def = { ...e.def, burn: undefined };

  // thunder wave paralyzes — the launch limps while it lasts
  e.def = { ...e.def, para: true };
  const jolted = (b as any).players.find((p: any) => !p.dead);
  jolted.paraT = 0;
  const rng2 = (b as any).rng;
  (b as any).rng = () => 0.1;
  (b as any).damagePlayer(jolted, 5, e);
  (b as any).rng = rng2;
  ok(jolted.paraT > 0, `thunder wave paralyzes (${jolted.paraT} rounds)`);
  jolted.paraT = 0;
  e.def = { ...e.def, para: undefined };

  // poison point: striking the hide can venom the ball
  e.def = { ...e.def, toxic: true };
  e.dead = false;
  e.hp = e.maxHp;
  const striker = (b as any).active;
  striker.dotTicks = 0;
  striker.vx = 300; striker.vy = 0;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  const rng3 = (b as any).rng;
  (b as any).rng = () => 0.1; // under the 0.3 point chance
  (b as any).strikeEnemy(striker, e);
  (b as any).rng = rng3;
  ok(striker.dotTicks > 0, `poison point venoms the striker (${striker.dotTicks} ticks)`);
  striker.dotTicks = 0;
  striker.dotDmg = 0;
  e.def = { ...e.def, toxic: undefined };

  // static: striking the crackling hide can paralyze the ball
  e.def = { ...e.def, shock: true };
  striker.paraT = 0;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  (b as any).rng = () => 0.1;
  (b as any).strikeEnemy(striker, e);
  (b as any).rng = rng3;
  ok(striker.paraT > 0, `static discharge jolts the striker (para ${striker.paraT})`);
  striker.paraT = 0;
  e.def = { ...e.def, shock: undefined };

  // flame body: striking the hide can burn the ball
  e.def = { ...e.def, flame: true };
  striker.burnT = 0;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  (b as any).rng = () => 0.1;
  (b as any).strikeEnemy(striker, e);
  (b as any).rng = rng3;
  ok(striker.burnT > 0, `flame body singes the striker (burn ${striker.burnT})`);
  striker.burnT = 0;
  e.def = { ...e.def, flame: undefined };

  // lum berry washes every ailment off the team at once
  striker.dotTicks = 4; striker.dotDmg = 3; striker.burnT = 4; striker.paraT = 2; striker.asleep = true;
  (b as any).grabPickup({ kind: 'lum-berry', x: 100, y: 100, t: 0, age: 0 });
  ok(striker.dotTicks === 0 && striker.burnT === 0 && striker.paraT === 0 && !striker.asleep, 'lum berry cures the whole slate');

  // revival herb raises the first fallen teammate at a quarter health
  const bench = (b as any).players.find((p) => p !== striker);
  bench.dead = true; bench.hp = 0;
  (b as any).grabPickup({ kind: 'revival-herb', x: 100, y: 100, t: 0, age: 0 });
  ok(!bench.dead && bench.hp === Math.max(1, Math.round(bench.maxHp * 0.25)), `revival herb raises a teammate (hp ${bench.hp})`);

  // intimidate: a living menace shaves a fifth off the team's hits.
  // Crank the striker first — a chip hit rounds the shave away.
  const menace = (b as any).enemies[1];
  menace.def = { ...menace.def, menace: true };
  const pow0 = striker.pow;
  striker.pow = 5;
  menace.dead = false;
  menace.hp = menace.maxHp;
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  striker.lastHit = new Map();
  const hpMen = e.hp;
  (b as any).strikeEnemy(striker, e);
  const menHit = hpMen - e.hp;
  menace.dead = true;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  striker.lastHit = new Map();
  const hpFree = e.hp;
  (b as any).strikeEnemy(striker, e);
  const freeHit = hpFree - e.hp;
  striker.pow = pow0;
  ok(menHit < freeHit && Math.abs(menHit / freeHit - 0.8) < 0.12, `intimidate shaves a fifth (${menHit} vs ${freeHit})`);

  // wonder guard: neutral hits whiff, super-effective still lands
  const strikerDef = striker.def, eDef = e.def;
  e.def = { ...e.def, wguard: true, type: 'water' as const, type2: undefined };
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  striker.def = { ...striker.def, type: 'normal' as const, type2: undefined };
  striker.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  ok(e.hp === e.maxHp, 'wonder guard nullifies a neutral hit');
  striker.def = { ...striker.def, type: 'electric' as const };
  striker.lastHit = new Map();
  e.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  ok(e.hp < e.maxHp, 'wonder guard still falls to SE');
  striker.def = strikerDef;
  e.def = eDef;

  // sturdy: the first lethal blow only wounds — hangs on at 1 HP
  e.def = { ...eDef, sturdy: true };
  e.sash = true;
  e.dead = false;
  e.hp = e.maxHp;
  (b as any).hurt(e, e.maxHp + 50);
  ok(e.hp === 1 && !e.dead && !e.sash, `sturdy hangs on at 1 HP (hp ${e.hp})`);

  // cute charm: a smitten striker nods off mid-contact
  e.def = { ...eDef, charm: true };
  e.dead = false;
  e.hp = e.maxHp;
  striker.asleep = false;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  (b as any).rng = () => 0.1;
  (b as any).strikeEnemy(striker, e);
  (b as any).rng = rng3;
  ok(striker.asleep, 'cute charm lulls the striker');
  striker.asleep = false;
  e.def = eDef;

  // multiscale: an untouched hide halves the hit, a chipped one doesn't
  e.def = { ...eDef, scale: true };
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  striker.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  const fullHit = e.maxHp - e.hp;
  e.hp = e.maxHp - 1; // chipped — scale drops
  e.lastHit = new Map();
  striker.lastHit = new Map();
  const before = e.hp;
  (b as any).strikeEnemy(striker, e);
  const chipHit = before - e.hp;
  ok(fullHit < chipHit && Math.abs(fullHit / chipHit - 0.5) < 0.2, `multiscale halves at full HP (${fullHit} vs ${chipHit})`);

  // guts: a statused brawler hits half again — don't dot it
  e.def = { ...eDef, guts: true };
  e.dead = false;
  e.hp = e.maxHp;
  const zapTarget = (b as any).players[0];
  e.dotTicks = 0;
  (b as any).orbs.length = 0;
  (b as any).foeZap(e, zapTarget);
  const zapBase = (b as any).orbs[0].dmg;
  e.dotTicks = 3;
  (b as any).orbs.length = 0;
  (b as any).foeZap(e, zapTarget);
  const zapGuts = (b as any).orbs[0].dmg;
  ok(zapGuts > zapBase && Math.abs(zapGuts / zapBase - 1.5) < 0.1, `guts hits harder while statused (${zapGuts} vs ${zapBase})`);
  e.dotTicks = 0;
  e.def = eDef;

  // absorb: a matching element feeds the hide instead of hurting it
  e.def = { ...eDef, absorb: 'water' as const, type: 'fire' as const, type2: undefined };
  e.dead = false;
  e.hp = Math.floor(e.maxHp / 2);
  e.lastHit = new Map();
  striker.def = { ...strikerDef, type: 'water' as const, type2: undefined };
  striker.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  ok(e.hp > Math.floor(e.maxHp / 2), `absorb heals on a matching hit (hp ${e.hp})`);
  striker.def = strikerDef;
  e.def = eDef;

  // truant: the loaf re-arms at double the cooldown
  const lazy = (b as any).enemies[1];
  const lazyDef = lazy.def;
  lazy.def = { ...lazyDef, truant: true };
  lazy.dead = false;
  lazy.hp = lazy.maxHp;
  lazy.timer = 0;
  (b as any).fireEnemy(lazy);
  const lazyTimer = lazy.timer;
  lazy.def = { ...lazyDef, truant: false };
  lazy.timer = 0;
  (b as any).fireEnemy(lazy);
  const busyTimer = lazy.timer;
  ok(lazyTimer > 0 && Math.abs(busyTimer * 2 - lazyTimer) < 0.001, `truant loafs a full round (${lazyTimer} vs ${busyTimer})`);

  // speed boost: each attack re-arms a touch faster
  lazy.def = { ...lazyDef, boost: true };
  lazy.boostN = 0;
  lazy.timer = 0;
  (b as any).fireEnemy(lazy);
  const boost0 = lazy.timer;
  lazy.timer = 0;
  (b as any).fireEnemy(lazy);
  const boost1 = lazy.timer;
  ok(boost1 < boost0 && Math.abs(boost1 / boost0 - 0.85) < 0.01, `speed boost re-arms faster (${boost1} vs ${boost0})`);
  lazy.def = lazyDef;
  lazy.boostN = 0;

  // effect spore: contact scatters a random ailment — sleep lands at 0.7+
  e.def = { ...eDef, spore: true };
  e.dead = false;
  e.hp = e.maxHp;
  striker.asleep = false;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  let roll = 0.1;
  (b as any).rng = () => { const r = roll; roll = 0.8; return r; }; // spore check 0.1 < 0.3, spore roll 0.8 → sleep
  (b as any).strikeEnemy(striker, e);
  (b as any).rng = rng3;
  ok(striker.asleep, 'effect spore can lull the striker');
  striker.asleep = false;
  e.def = eDef;

  // synchronize: a statused carrier echoes the ailment on contact
  e.def = { ...eDef, sync: true };
  e.dead = false;
  e.hp = e.maxHp;
  e.dotTicks = 4;
  e.dotDmg = 3;
  striker.dotTicks = 0;
  striker.dotDmg = 0;
  striker.lastHit = new Map();
  e.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  ok(striker.dotTicks === 4, `synchronize echoes the ailment (${striker.dotTicks} ticks)`);
  striker.dotTicks = 0;
  striker.dotDmg = 0;
  e.dotTicks = 0;
  e.dotDmg = 0;
  e.def = eDef;

  // pressure: every other super-charge tick is eaten while it lives
  const legend = (b as any).enemies[1];
  const legendDef = legend.def;
  legend.def = { ...legendDef, pressure: true };
  legend.dead = false;
  legend.hp = legend.maxHp;
  const p0 = (b as any).players[0];
  p0.cd = 8;
  (b as any).pressureN = 0;
  (b as any).chargeUp(p0);
  (b as any).chargeUp(p0);
  ok(p0.cd === 7, `pressure eats every other tick (cd ${p0.cd} after 2)`);
  legend.dead = true;
  (b as any).chargeUp(p0);
  (b as any).chargeUp(p0);
  ok(p0.cd === 5, `dead legend frees the economy (cd ${p0.cd})`);
  p0.cd = 0;
  legend.dead = false;
  legend.def = legendDef;

  // signal beam: the lane locks, telegraphs, then burns the channel.
  // The caster slot can land a healer/summoner — strip every flag the
  // attack dispatch checks before beam so the channel is what fires.
  const caster = (b as any).enemies[1];
  const casterDef = caster.def;
  caster.def = { ...casterDef, beam: true, fuse: undefined, healer: undefined, raider: undefined, summon: undefined, lay: undefined, charge: undefined, truant: undefined };
  caster.supp = undefined;
  caster.asleep = false;
  caster.dead = false;
  caster.hp = caster.maxHp;
  caster.timer = 0;
  p0.hp = p0.maxHp;
  p0.x = caster.x; p0.y = caster.y + 200; // lined up — the beam will find it
  (b as any).lanes.length = 0;
  (b as any).fireEnemy(caster);
  ok((b as any).lanes.length === 1, 'beam locks a lane');
  // run the delay queue — later() callbacks fire inside update()
  for (const d of (b as any).delays) d.t = 0;
  (b as any).update(0.01);
  ok(p0.hp < p0.maxHp, `beam burns the channel (hp ${p0.hp})`);
  caster.def = casterDef;

  // counter: a third of contact damage fires straight back
  e.def = { ...eDef, counter: true };
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  striker.hp = striker.maxHp;
  striker.lastHit = new Map();
  (b as any).strikeEnemy(striker, e);
  ok(striker.hp < striker.maxHp, `counter returns the hit (hp ${striker.hp})`);
  striker.hp = striker.maxHp;
  e.def = eDef;

  // pack alpha: a living leader rallies packmate hits
  const boss = (b as any).enemies[1];
  const bossDef = boss.def;
  boss.def = { ...bossDef, alpha: true };
  boss.dead = false;
  boss.hp = boss.maxHp;
  (b as any).orbs.length = 0;
  (b as any).foeZap(e, p0);
  const alphaZap = (b as any).orbs[0].dmg;
  boss.dead = true;
  (b as any).orbs.length = 0;
  (b as any).foeZap(e, p0);
  const soloZap = (b as any).orbs[0].dmg;
  ok(alphaZap > soloZap && Math.abs(alphaZap / soloZap - 1.3) < 0.08, `alpha rallies the pack (${alphaZap} vs ${soloZap})`);
  boss.dead = false;
  boss.def = bossDef;

  // shed skin: a statused shedder sloughs instead of ticking
  e.def = { ...eDef, shed: true };
  e.dotTicks = 3; e.dotDmg = 5; e.burnT = 2; e.hp = e.maxHp;
  const shedHp = e.hp;
  const rngHold = (b as any).rng;
  (b as any).rng = () => 0.1;
  (b as any).endShot();
  (b as any).rng = rngHold;
  ok(e.dotTicks === 0 && e.burnT === 0 && e.hp === shedHp, `shed sloughs the ailment (ticks ${e.dotTicks})`);
  e.def = eDef;

  // stampede: a charge foe's attack queues a hostile dash at its target
  e.def = { ...eDef, charge: true };
  e.timer = 0;
  e.dead = false;
  e.hp = e.maxHp;
  (b as any).delays.length = 0;
  (b as any).fireEnemy(e);
  (b as any).delays.forEach((d: any) => (d.t = 0));
  (b as any).update(0.001);
  const ram = (b as any).dashes.find((d: any) => d.hostile);
  ok(!!ram && ram.u === e, 'charge queues a hostile ram dash');
  e.def = eDef;
  (b as any).dashes.length = 0;

  // huge power: the flag doubles a striker's contact damage
  e.dead = false;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  const sDef = striker.def;
  striker.hp = striker.maxHp;
  striker.def = { ...sDef, stats: { ...sDef.stats, atk: 300 } }; // big enough that rounding can't blur the ×2
  (b as any).shotCombo = 0;
  (b as any).shotHitN.clear();
  (b as any).strikeEnemy(striker, e);
  const normalHit = e.maxHp - e.hp;
  e.hp = e.maxHp;
  e.lastHit = new Map();
  (b as any).shotCombo = 0;
  (b as any).shotHitN.clear();
  striker.def = { ...sDef, stats: { ...sDef.stats, atk: 300 }, huge: true };
  (b as any).strikeEnemy(striker, e);
  const hugeHit = e.maxHp - e.hp;
  striker.def = sDef;
  ok(hugeHit > normalHit * 1.8, `huge power doubles contact (${hugeHit} vs ${normalHit})`);

  // fuse foes detonate on their countdown — the blast wounds both sides
  e.def = { ...e.def, fuse: true, summon: undefined, blink: undefined };
  e.dead = false;
  const pal = (b as any).players.find((p: any) => !p.dead);
  pal.x = e.x + 60; pal.y = e.y; // park a mon inside the blast radius
  const palHp0 = pal.hp;
  const packMate = (b as any).enemies.find((f: any) => f !== e && !f.dead);
  let packHp0 = -1;
  if (packMate) { packMate.x = e.x + 50; packMate.y = e.y; packHp0 = packMate.hp; }
  (b as any).fireEnemy(e);
  ok(e.dead && pal.hp < palHp0, `fuse detonates — bomber dies, blast hits the team (${palHp0} -> ${pal.hp})`);
  ok(packHp0 < 0 || (packMate.hp < packHp0 || packMate.dead), 'the pack takes the blast too');
  e.def = { ...e.def, fuse: undefined };
  e.dead = false;
  e.hp = e.maxHp; // the test corpse can't leak into the volley check

  // volley fans the attack across the three nearest mons, weakened per orb
  e.def = { ...e.def, volley: true, melee: false, raider: false, healer: false };
  (b as any).pickups = [];
  (b as any).orbs = [];
  (b as any).fireEnemy(e);
  const volleyTargets = new Set((b as any).orbs.map((o: any) => o.target));
  ok((b as any).orbs.length === Math.min(3, (b as any).players.filter((p: any) => !p.dead).length) && volleyTargets.size === (b as any).orbs.length, `volley fans one orb per distinct target (${(b as any).orbs.length})`);
}

{
  const b = new Battle(arena, team(), makeStage(11, 'T'), mulberry32(2));
  (b as any).spawnWave(0);
  const shooter = (b as any).active;
  const e = (b as any).enemies[0];
  const pow0 = shooter.pow;
  const lvl0 = shooter.lvl;
  const bench = (b as any).players.filter((p: any) => p !== shooter && !p.dead);
  const bench0 = bench.map((p: any) => p.lvl);
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(e.dead, 'lethal hit kills');
  ok(shooter.lvl > lvl0 && shooter.pow > pow0, `KO levels shooter (lv${lvl0}->${shooter.lvl} pow ${shooter.pow.toFixed(2)})`);
  ok(bench.length > 0 && bench.every((p: any, i: number) => p.lvl === bench0[i] + Math.max(1, Math.round(e.lvl * 0.05 * 0.5))), `KO shares EXP with the living bench (${bench0.join(',')} -> ${bench.map((p: any) => p.lvl).join(',')})`);
  const lvTexts = (b as any).texts.map((t: any) => t.text);
  ok(lvTexts.filter((t: string) => /^LV \d+!$/.test(t)).length === 1 && lvTexts.filter((t: string) => t === 'TEAM LV UP').length === 1, `shared EXP is quiet: one LV popup for the launcher, one TEAM LV UP (${lvTexts.join('|')})`);
}

// --- evolution preserves earned levels ------------------------------------
{
  const karp = ROSTER.find((r) => r.id === 129)!;
  const b = new Battle(arena, [karp, ...team()], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  p.lvl = 50; // earned levels mid-run
  (b as any).absorbDupe(karp); // dup catch → evolve
  ok(p.def.id === 130, `Magikarp evolved into ${p.def.name}`);
  const m = ROLE_MODS[roleOf(p.def.stats, p.def.healer)];
  ok(Math.abs(p.pow - m.pow * lvlPow(offStat(p.def.stats, p.def.type), 50)) < 0.001, `levels survive evolution (pow ${p.pow.toFixed(2)} vs base ${m.pow})`);
}

// --- evolve scene: plays out, lands on the evolved species, tap skips ------
{
  while (evoActive()) skipEvo(); // earlier blocks queued scenes of their own
  const karp = ROSTER.find((r) => r.id === 129)!;
  const b = new Battle(arena, [karp, ...team()], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  (b as any).absorbDupe(karp);
  ok(evoActive() && evoScene()!.from === 129 && evoScene()!.to === 130, 'a fielded evolution opens the evolve scene');
  let n = 0;
  while (evoActive() && n++ < 100) tickEvo(1 / 30);
  ok(!evoActive() && n <= Math.ceil(EVO_T * 30) + 1 && p.def.id === 130, `scene ends inside ${EVO_T}s on ${p.def.name} (${n} frames)`);
  startEvo(4, 5);
  tickEvo(0.4);
  skipEvo();
  ok(evoActive() && evoScene()!.t >= EVO_FLASH, 'first tap jumps the flicker to the flash');
  skipEvo();
  ok(!evoActive(), 'second tap ends the scene');
}

// --- split evolution defers to the player's pick on the reward screen ----
{
  const eevee = ROSTER.find((r) => r.id === 133)!;
  const b = new Battle(arena, [eevee, ...team().slice(0, 3)], makeStage(3, 'T'), mulberry32(3));
  const p = (b as any).players[0];
  (b as any).absorbDupe(eevee); // a dupe normally auto-evolves — a branch can't
  ok(p.def.id === 133 && (b as any).evoPending.length === 1, 'split evo waits for a pick');
  (b as any).enterReward();
  ok(b.evoChoice?.options.length === 4, `eevee offers its four forms (${b.evoChoice?.options.map((o) => o.name).join('/')})`);
  b.pickEvo(1); // Jolteon
  ok(p.def.id === 135 && b.evoChoice === null, `picked branch becomes ${p.def.name}`);
  ok(p.def.luck === 1, 'the absorbed dupe banked a luck point through evolution');
}

// --- roleOf: specialty reads the dominant base stat -----------------------
{
  ok(
    roleOf(ROSTER.find((r) => r.id === 1)!) === 'MEDIC' && // Bulbasaur is healer-flagged
      roleOf(ROSTER.find((r) => r.id === 25)!) === 'SCOUT' && // Pikachu: spe 90 leads
      roleOf(ROSTER.find((r) => r.id === 95)!) === 'WARDEN' && // Onix: def 160 leads
      roleOf(speciesById(143)!) === 'BULWARK', // Snorlax: hp 160 leads
    'roleOf: healer flag → MEDIC, else dominant base stat names the specialty',
  );
}

// --- fusion luck pays out as bonus gym loot ------------------------------
{
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(5));
  const p = (b as any).players[0];
  (b as any).absorbDupe(p.def); // Pikachu dupe: +1 luck AND evolves to Raichu
  ok(p.def.luck === 1 && p.def.id === 26, `dupe banks luck through evolution (${p.def.name} luck ${p.def.luck})`);
  (p as any).def = { ...p.def, luck: 45 }; // a heavily-fused mon
  (b as any).enterLoot();
  const n = 24 + (b as any).depth * 3;
  const base = Math.max(2, Math.round(n * 0.18));
  const gems = (b as any).lootCoins.filter((c: any) => c.kind === 'gem').length;
  ok(gems === base + 4 || gems === base + 5, `team luck 45 pays ~4 bonus gems (${gems} vs base ${base})`);
}

// --- catches can't outlevel the team they join ----------------------------
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  const e = (b as any).enemies.find((x: any) => !team().some((t) => t.id === x.def.id));
  e.lvl = 90; // a wild far above anything a young team could field
  b.captureChance = 20; // the ball always lands — even through the level gate
  (b as any).hurt(e, e.hp + 50, '#fff');
  // the KO's punch-up EXP lands before the catch — measure the cap after
  const pl = (b as any).players.map((p: any) => p.lvl);
  const avg = Math.max(1, Math.round(pl.reduce((s: number, l: number) => s + l, 0) / pl.length));
  ok((b as any).boxLvl[0] === avg, `a lvl-90 catch joins at team average (box lvl ${(b as any).boxLvl[0]} vs team avg ${avg})`);
  // the capture ritual: the ball sequence exists mid-rock, then resolves
  // and drains on the update clock alone — the sim never waits for theatre
  ok((b as any).balls.length === 1, 'a forced catch queues its ball ritual');
  for (let i = 0; i < 40; i++) b.update(0.05); // 2s > the ritual's 1.8s bound
  ok((b as any).balls.length === 0, 'the ritual resolves and drains inside its span');
}

// --- catch odds scale off the team's ace -------------------------------------
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  const e = (b as any).enemies.find((x: any) => !team().some((t) => t.id === x.def.id));
  const best = Math.max(...(b as any).players.map((p: any) => p.lvl));
  e.lvl = best - 8; // a weakling next to the team
  const easy = b.catchOdds(e);
  e.lvl = best + 10; // far above — the gate closes
  const hard = b.catchOdds(e);
  ok(easy >= b.captureChance * 2.9, `weak foes catch easy (${easy.toFixed(2)} vs base ${b.captureChance})`);
  ok(hard <= b.captureChance * 0.06, `far-above foes are all but locked (${hard.toFixed(3)})`);
}

// --- gym stops sign their leader's type -------------------------------------
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), mulberry32(3));
  const gyms = b.regionMap.nodes.filter((n) => n.kind === 'gym');
  ok(gyms.length === 3 && gyms.every((n: any) => !!n.ttype), `every gym stop wears a leader type (${gyms.map((n: any) => n.ttype).join(', ')})`);
  const stagedBoss = (b as any).stage.waves[2].find((s: any) => s.boss);
  ok(gyms.find((n: any) => n.row === 2)?.ttype === stagedBoss.def.type, 'staged gym sign matches the rolled boss');
  const w = rollWave(mulberry32(1), 3, undefined, 'rock');
  ok(w.find((s: any) => s.boss)?.def.type === 'rock', 'a rolled gym wave honors the signed type');
}

// --- dual-typing: multiplied matchups, better-type strikes ---------------
{
  ok(typeMult('rock', speciesById(6)!) === 4, 'charizard (fire/flying) takes 4x rock');
  ok(typeMult('electric', speciesById(130)!) === 4, 'gyarados (water/flying) takes 4x electric');
  ok(typeMult('ghost', speciesById(282)!) === 0, 'gardevoir (psychic/normal) is ghost-immune');
  ok(strikeType(speciesById(260)!, speciesById(6)!) === 'rock', 'swampert leads with rock vs charizard');
  ok(strikeType(speciesById(260)!, speciesById(130)!) === 'rock', 'swampert leads with rock vs gyarados too (rock 2x2)');
  ok(strikeType(speciesById(260)!, speciesById(383)!) === 'water', 'swampert leads with water vs groudon');
}

// --- gauge shot: a gold-zone release arms +20% contact --------------------
{
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(2));
  (b as any).spawnWave(0);
  (b as any).roomGrid = ROOM_LAYOUTS[3];
  (b as any).courtT = -9; // court already settled
  b.phase = 'aim';
  const u = (b as any).active;
  b.pointerDown({ x: u.x, y: u.y });
  // park the meter in the gold band — the band jitters per pull now, so
  // solve dragT through the live charge/sweetSpot pair instead of constants
  for (let i = 0; i < 6; i++) {
    const z = (b as any).sweetSpot();
    const P = (0.85 - 0.3 * (b as any).gaugeDifficulty()) * (1 + (b as any).gaugeJit * 0.28);
    let dt = P * z.c - (b as any).gaugeStart * 2 * P;
    dt = ((dt % (2 * P)) + 2 * P) % (2 * P);
    (b as any).dragT = dt;
    if (Math.abs((b as any).charge() - (b as any).sweetSpot().c) <= z.hw) break;
  }
  b.pointerMove({ x: u.x + 60, y: u.y });
  b.pointerUp();
  ok(b.phase === 'shot' && (b as any).shotGold === true, 'gold release arms the gauge bonus');
}

// --- gauge difficulty: stronger species get tighter, drifting windows ------
{
  const easy = new Battle(arena, [speciesById(129)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(2));
  const hard = new Battle(arena, [speciesById(149)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(2));
  const ez = (easy as any).sweetSpot();
  const hd = (hard as any).sweetSpot();
  ok(hd.hw < ez.hw * 0.6, `dragonite's gold window is much tighter than magikarp's (${hd.hw.toFixed(3)} vs ${ez.hw.toFixed(3)})`);
  (easy as any).dragT = 1.3;
  ok((easy as any).sweetSpot().c === ez.c, 'weak mons keep a steady gold band');
  (hard as any).dragT = Math.PI / 4.8; // sin peak — dragT * 2.4 = π/2
  ok(Math.abs((hard as any).sweetSpot().c - hd.c) > 0.03, 'legendary-tier gold band drifts while held');
}

// --- weather courts: the sky tilts the matchup table -----------------------
{
  ok(weatherMult('sun', 'fire') === 1.5 && weatherMult('sun', 'water') === 0.75, 'sun boosts fire, dulls water');
  ok(weatherMult(null, 'fire') === 1 && weatherMult('rain', 'grass') === 1, 'clear sky and neutral types unchanged');
  ok(weatherMult('storm', 'electric') === 1.5 && weatherMult('storm', 'grass') === 0.75, 'storm boosts electric, dulls grass');
  const FOR: Record<string, string> = { grove: 'rain', cavern: 'sand', volcano: 'sun', sky: 'wind', shore: 'rain', plant: 'storm', marsh: 'rain' };
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(7));
  (b as any).spawnWave(0);
  // the arena is the element of the battle: stage-locked on wild waves,
  // the stop's own type court on trainer/elite stops
  ok((b as any).theme === (b as any).stage.theme, 'wild wave fights in the stage biome');
  const tb = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(7));
  (tb as any).spawnWave(0, { kind: 'trainer', ttype: 'fire', row: 0, tx: 0, ty: 0, links: [] });
  ok((tb as any).theme === 'volcano', `a fire stop fights in the volcano (${(tb as any).theme})`);
  const eb = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(7));
  (eb as any).spawnWave(0, { kind: 'elite', ttype: 'ghost', row: 0, tx: 0, ty: 0, links: [] });
  ok((eb as any).theme === 'tower', `a ghost elite fights in the tower (${(eb as any).theme})`);
  ok(
    (b as any).weather === null ||
      (b as any).weather === FOR[(b as any).theme] ||
      // a weatherless court rolls any sky from the deck when weather lands
      (FOR[(b as any).theme] === undefined && (b as any).weather in WEATHER_OF),
    'wave weather follows the court theme',
  );
  const strike = (w: string | null) => {
    const bb = new Battle(arena, [speciesById(4)!, ROSTER[1], ROSTER[2], ROSTER[3]], makeStage(3, 'T'), mulberry32(5));
    (bb as any).spawnWave(0);
    (bb as any).hazards = [];
    (bb as any).weather = w;
    const u = (bb as any).players[0];
    const e = (bb as any).enemies[0];
    const hp0 = e.hp;
    (bb as any).strikeEnemy(u, e);
    return hp0 - e.hp;
  };
  const clear = strike(null), sunny = strike('sun');
  ok(sunny > clear, `sun buffs charmander's contact (${clear} -> ${sunny})`);
}

// --- generated rooms: every biome synthesizes a connected court ---------
{
  for (const theme of THEMES) {
    for (let s = 1; s <= 8; s++) {
      const g = genRoom(theme, mulberry32(s * 97 + 13));
      ok(g.length === 11 && g.every((r) => r.length === 9), `${theme} room is 9x11`);
      const open = (r: number, c: number) => '0S4P678'.includes(g[r][c]); // ground-foe walkable set — same rule the authored-room validator uses
      const seen = new Set<string>(['4,9']);
      const q: [number, number][] = [[4, 9]];
      while (q.length) {
        const [x, y] = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
          if (nx < 1 || nx > 7 || ny < 1 || ny > 9 || seen.has(k) || !open(ny, nx)) continue;
          seen.add(k);
          q.push([nx, ny]);
        }
      }
      let sAll = true, blocks = 0;
      for (let r = 1; r <= 9; r++) {
        for (let c = 1; c <= 7; c++) {
          if (g[r][c] === 'S' && !seen.has(`${c},${r}`)) sAll = false;
          if (g[r][c] === '2') blocks++;
        }
      }
      ok(sAll && seen.has('4,1') && blocks <= 25, `${theme} generated room ${s}: lanes reach every spawn`);
      if (!sAll || !seen.has('4,1') || blocks > 25) break;
    }
  }
}

// --- signature gimmick: a court's roamer fixture is the biome's own -----
{
  const GI: Record<string, string> = {
    grove: 'well', cavern: 'well', volcano: 'boost', sky: 'boost', meadow: 'boost',
    shore: 'warp', plant: 'boost', marsh: 'well', sanctum: 'warp', dojo: 'boost', tower: 'warp',
  };
  for (const theme of THEMES) {
    let saw = 0;
    for (let s = 1; s <= 30; s++) {
      // the open room has no moats — every gimmick-shaped hazard here
      // came from the roamer fixture, not a '3' cell
      const r = buildRoom(ROOM_LAYOUTS[0], theme, mulberry32(s * 31 + 7));
      for (const h of r.hazards) {
        if (h.kind === 'warp' || h.kind === 'boost' || h.kind === 'well') {
          ok(h.kind === GI[theme], `${theme} gimmick is ${GI[theme]}`);
          saw++;
        }
      }
    }
    ok(saw > 0, `${theme} rolls its signature gimmick`);
  }
}

// --- debug arena pin: ?debug=arenaN maps 1-based to THEMES ---------------
{
  ok(parseArenaPin(new URLSearchParams('?debug=arena1')) === 'grove', 'debug=arena1 pins the grove court');
  ok(parseArenaPin(new URLSearchParams(`?debug=arena${THEMES.length}`)) === THEMES[THEMES.length - 1], `debug=arena${THEMES.length} pins the last court`);
  ok(parseArenaPin(new URLSearchParams('?dev&arena=shore')) === 'shore', '?dev&arena=<name> pins by name');
  ok(parseArenaPin(new URLSearchParams('?arena=volcano')) === null, 'the pin stays gated — no dev/debug flag');
}

// --- benching keeps earned levels ------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(13, 'T'), mulberry32(4));
  (b as any).spawnWave(0);
  const p = (b as any).players[1];
  p.lvl = 7;
  p.pow *= lvlPow(offStat(p.def.stats, p.def.type), 7); // simulate its earned growth
  const swappedPow = p.pow;
  b.box.push(ROSTER[5]);
  b.boxHp.push(1);
  b.boxLvl.push(3);
  b.phase = 'map'; // roster swaps live on the map's team panel now
  b.teamSel = 1; // a swap started from the team side resolves the same way
  b.swapFromBox(0, 1); // bench the Lv7, bring in the box Lv3
  ok(b.teamSel === -1 && b.boxSel === -1, 'swap clears both selections');
  ok(p.lvl === 3, `swapped-in mon carries its own level (lv${p.lvl})`);
  ok(b.boxLvl[0] === 7, `benched mon keeps earned levels (boxLvl ${b.boxLvl})`);
  ok(Math.abs(p.pow - ROLE_MODS[p.role].pow * lvlPow(offStat(p.def.stats, p.def.type), 3)) < 0.001, 'swap recomputes pow from its own level');
  void swappedPow;
}

// --- the same swap works on the reward break's TEAM · ITEMS panel ---------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.phase === 'reward', 'reward opens on the item pick');
  const boxed = ROSTER[5];
  b.box.push(boxed);
  b.boxHp.push(1);
  b.boxLvl.push(3);
  const benched = (b as any).players[1].def;
  b.swapFromBox(0, 1); // the catch break carries the same roster modal
  ok((b as any).players[1].def.id === boxed.id && (b as any).players[1].def.joined === b.waveIndex,
    'reward-phase swap fields the box mon, joined-stamped');
  ok(b.box[0] === benched && b.boxHp[0] > 0 && b.boxLvl[0] >= 1, 'reward-phase swap benches the teammate');
  ok(b.boxSel === -1 && b.teamSel === -1, 'reward-phase swap clears both selections');
  // mid-fight the panel is shut — a stray call still can't reorder the team
  b.phase = 'aim';
  const stray = ROSTER[6];
  b.box.push(stray);
  b.boxHp.push(1);
  b.boxLvl.push(1);
  b.swapFromBox(1, 0);
  ok(b.box.length === 2 && b.box[1] === stray && (b as any).players[0].def === ROSTER[0], 'mid-fight swap stays refused');
}

// --- reward sequencing: the roster seats before the item pick ------------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.wantMenu === false, 'empty box — the reward skips the roster step');
  b.box.push(ROSTER[7]);
  b.boxHp.push(1);
  b.boxLvl.push(2);
  (b as any).enterReward();
  ok(b.wantMenu === true && b.phase === 'reward', 'stocked box — the roster seats before the item pick');
}

// --- reward flow: the pick (or decline) goes straight to the map -----------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).enterReward();
  ok(b.phase === 'reward', 'reward opens on the item pick');
  b.declineReward();
  ok(b.phase === 'map', 'decline exits straight to the map');
  (b as any).enterReward();
  const n = b.rewardOffers.length;
  b.pickPerk(0);
  ok(n > 0 && b.rewardOffers.length === 0, 'a pick banks the relic');
  ok(b.phase === 'map', 'the pick exits straight to the map');
}

// --- offer tools: REROLL re-deals the board, BANISH culls the run -----------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  ok(b.rerollOffers() === false && b.toggleBanish() === false, 'tools stay shut off the reward board');
  (b as any).enterReward();
  const dealt = b.rewardOffers;
  ok(dealt.length === 3 && b.tools.roll === 1 && b.tools.ban === 1, 'fresh board, both charges stocked');
  ok(b.rerollOffers() === true && b.rewardOffers !== dealt, 'reroll re-deals the offers');
  ok(b.rewardOffers.length === 3 && b.tools.roll === 0, 'reroll spends the roll charge (1 → 0)');
  ok(b.rerollOffers() === false && b.rewardOffers.length === 3, 'out of charges — reroll refuses, board kept');
  ok(b.toggleBanish() === true && b.banArmed === true, 'banish arms the next card tap');
  const culled = b.rewardOffers[0].id;
  ok(b.banishPerk(0) === culled && b.perkBan.has(culled), `banish culls ${culled} from the run's pool`);
  ok(b.rewardOffers.length === 2 && b.rewardOffers.every((p) => p.id !== culled), 'the card leaves, the rest stay');
  ok(b.tools.ban === 0 && b.banArmed === false, 'banish spends the charge and disarms');
  ok(b.toggleBanish() === false, 'out of charges — banish refuses to arm');
  // emptying the board resolves the reward — they leave empty-handed
  b.tools.ban = 2;
  b.toggleBanish();
  b.banishPerk(0);
  b.toggleBanish();
  b.banishPerk(0);
  ok(b.rewardOffers.length === 0 && b.phase === 'map', 'banishing the whole board exits to the map');
}

// --- banished perks stay gone: rolls, fresh boards, the save file -----------
{
  // rollPerks honors the ban set directly
  const ban = new Set(['hpup', 'potion', 'moomoo', 'sash', 'mball']);
  let rolled = 0,
    leaked = 0;
  for (let s = 1; s <= 20; s++) {
    for (const p of rollPerks(mulberry32(s), 3, 9, undefined, ban)) {
      rolled++;
      if (ban.has(p.id)) leaked++;
    }
  }
  ok(rolled > 0 && leaked === 0, `${rolled} rolled cards, ${leaked} banished ids`);

  // enterReward routes through the same filter — a seeded ban survives re-deals
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(8));
  for (const id of ban) b.perkBan.add(id);
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    (b as any).spawnWave(0);
    (b as any).enterReward();
    seen.push(...b.rewardOffers.map((p) => p.id));
    b.declineReward(); // back to the map — the next wave pays a fresh board
  }
  ok(seen.length > 0 && seen.every((id) => !ban.has(id)), `5 re-dealt boards honor the ban list (${seen.length} cards)`);

  // charges + bans ride the mid-run save (v2); v1 saves re-stock the tools
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  a.tools.roll = 0;
  a.perkBan.add('sash');
  const s = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  ok(s.tools.roll === 0 && s.tools.ban === 1 && s.perkBan.join() === 'sash', 'snapshot banks spent charges + the ban list');
  const c = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  c.applySnapshot(s);
  ok(c.tools.roll === 0 && c.tools.ban === 1 && c.perkBan.has('sash'), 'tools + bans survive the resume');
  // the banked ult charge rides the save too; old saves re-arm the counter
  a.ultIn = 4;
  const su = JSON.parse(JSON.stringify(a.snapshot()!));
  ok(su.ultIn === 4, 'snapshot banks the ult charge');
  const u = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(42));
  u.applySnapshot(su);
  ok(u.ultIn === 4, 'banked ult charge survives the resume');
  delete su.ultIn;
  const vu = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(7));
  vu.applySnapshot(su);
  ok(vu.ultIn === ULT_SHOTS, 'an older save re-arms the ult counter');
  delete s.tools;
  delete s.perkBan;
  const v1 = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(7));
  v1.applySnapshot(s);
  ok(v1.tools.roll === 1 && v1.tools.ban === 1 && v1.perkBan.size === 0, 'a v1 save re-stocks the tools');

  // bag effects ride the same resume: field deltas replay, armed flags keep
  // their exact spent/armed state, and durable items don't double-apply
  const g = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(5), ['master-ball', 'scope-lens', 'exp-share']);
  ok(g.captureChance > 0.06 || (g as any).critCh > 0, 'bag picks land at construct');
  g.masterArmed = false; // spent mid-run before the save
  const sg = JSON.parse(JSON.stringify(g.snapshot()!));
  ok(sg.bag.join() === 'master-ball,scope-lens' && sg.masterArmed === false, 'save drops durable bag ids, keeps spent flags');
  // the real resume path maps saved lvl into the defs before constructing —
  // a durable exp-share must not add a second +2 on top of the saved level
  const rTeam = sg.team.map((e: any) => ({ ...speciesById(e.id)!, lvl: e.lvl, shiny: e.shiny || undefined }));
  const r = new Battle(arena, rTeam, makeStage(7, 'T'), mulberry32(9));
  r.applySnapshot(sg);
  ok((r as any).critCh === (g as any).critCh, 'bag deltas replay on resume');
  ok(r.masterArmed === false, 'a spent master ball stays spent across saves');
  ok(r.players[0].lvl === sg.team[0].lvl, 'exp-share levels come through the save once, not twice');
}

// --- type relics: bumpAlly riders fire only under their perk id -------------
{
  const mk = (leadId: number, ...relics: string[]) => {
    const b = new Battle(arena, [speciesById(leadId)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (b as any).spawnWave(0);
    (b as any).hazards = []; // static fields silence the cast
    for (const id of relics) b.grantPerk(PERKS.find((p) => p.id === id)!);
    const p = (b as any).players[0];
    p.cd = 0;
    return { b, p };
  };
  // clones give chains enough hops — fresh uids keep the hit-dedupe honest
  const clone = (b: any, n: number) => {
    for (let i = 0; i < n; i++)
      b.enemies.push({ ...b.enemies[i % b.enemies.length], uid: 9000 + i, dead: false });
  };
  const drain = (b: any) => {
    for (let i = 0; i < 8 && b.delays.length; i++)
      for (const d of b.delays.splice(0)) d.fn();
  };
  // park the pack in one tight row so every chain hop is in range
  const park = (b: any, p: any) =>
    b.enemies.forEach((e: any, i: number) => { e.x = 300 + i * 30; e.y = 300; p.x = 300; p.y = 360; });

  // magnet: THUNDER hops +2 further (cap still 6) — Mareep keeps the generic
  // chain (Pikachu's THUNDERBOLT signature wouldn't take relic riders)
  {
    const a = mk(179);
    clone(a.b, 4);
    park(a.b, a.p);
    (a.b as any).bumpAlly(a.p, a.p);
    drain(a.b);
    const arcs0 = (a.b as any).beams.length;
    const m = mk(179, 'magnet');
    clone(m.b, 4);
    park(m.b, m.p);
    (m.b as any).bumpAlly(m.p, m.p);
    drain(m.b);
    ok(arcs0 === 3 && (m.b as any).beams.length === arcs0 + 2, `magnet chains +2 links (${arcs0} -> ${(m.b as any).beams.length})`);
  }

  // silk scarf: EXTREMESPEED retargets a second time — a 3rd dash
  {
    const s = mk(133, 'silk-scarf');
    clone(s.b, 2);
    (s.b as any).bumpAlly(s.p, s.p);
    drain(s.b);
    const dash3 = (s.b as any).dashes.length;
    const n = mk(133);
    clone(n.b, 2);
    (n.b as any).bumpAlly(n.p, n.p);
    drain(n.b);
    ok(dash3 === 3 && (n.b as any).dashes.length === 2, `silk scarf links a 3rd dash (${(n.b as any).dashes.length} -> ${dash3})`);
  }

  // black belt: CLOSE COMBAT queues a 4th jab before the uppercut
  {
    const f = mk(66, 'black-belt');
    (f.b as any).bumpAlly(f.p, f.p);
    const jabs = (f.b as any).delays.length;
    const g = mk(66);
    (g.b as any).bumpAlly(g.p, g.p);
    ok(jabs === (g.b as any).delays.length + 1, `black belt adds a jab (${(g.b as any).delays.length} -> ${jabs})`);
  }

  // charcoal: the ring burns without sun, the volley lobs a 4th fireball —
  // Vulpix keeps the generic fire super (Charmander has FLAMETHROWER now)
  {
    const c = mk(37, 'charcoal');
    clone(c.b, 2);
    (c.b as any).weather = null; // clear sky — the burn must come from the relic
    (c.b as any).bumpAlly(c.p, c.p);
    ok((c.b as any).orbs.length === 4, `charcoal volley lobs a 4th fireball (${(c.b as any).orbs.length})`);
    const w = (c.b as any).waves.find((w: any) => w.onHit);
    const e = (c.b as any).enemies[0];
    w.onHit(e);
    ok(e.dotTicks > 0, 'charcoal ring burns under a clear sky');
  }

  // spell tag: HEX sends 8 wisps over the usual 6
  {
    const t = mk(92, 'spell-tag');
    clone(t.b, 5); // 8 targets — enough for the whole pack
    (t.b as any).bumpAlly(t.p, t.p);
    ok((t.b as any).orbs.length === 8, `spell tag sends +2 wisps (${(t.b as any).orbs.length})`);
  }
}

// --- ultimate: a tap on the charged mon detonates the court -----------------
{
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).courtT = -9; // court already settled
  b.phase = 'aim';
  b.ultIn = 0;
  const u = (b as any).active;
  const hp0 = (b as any).enemies.map((e: any) => e.hp);
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerUp();
  ok(b.ultIn === 0, 'the first ult tap only arms — no fire');
  b.pointerDown({ x: u.x, y: u.y }); // the confirm tap inside the 2s window fires
  b.pointerUp();
  ok(b.ultIn === ULT_SHOTS, 'firing the ult re-arms the counter');
  for (let i = 0; i < 60; i++) b.update(0.05); // the beams land on a stagger
  ok((b as any).enemies.every((e: any, i: number) => e.dead || e.hp < hp0[i]), 'the ult hits every foe on the court');
  b.ultIn = 3; // a part-banked charge rides into the next fight — the run banks it
  (b as any).spawnWave(0);
  (b as any).courtT = -9; // court already settled
  ok(b.ultIn === 3, 'ult charge carries into the next fight');
  const chip = (b as any).ultChip();
  ok(chip.w >= 44 && chip.h >= 44, 'ULT header has a thumb-sized hit target');
  b.pointerDown({ x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 });
  b.pointerUp();
  ok(b.ultIn === 3 && b.phase === 'aim' && !(b as any).dragging, 'charging ULT tap teaches without shooting');
  b.ultIn = 0;
  b.pointerDown({ x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 });
  b.pointerUp();
  ok(b.ultIn === 0, 'ready ULT header tap arms without firing');
  b.update(2.1);
  b.pointerDown({ x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 });
  b.pointerUp();
  ok(b.ultIn === 0, 'expired ULT confirmation must arm again');
  b.pointerDown({ x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 });
  b.pointerUp();
  ok(b.ultIn === ULT_SHOTS && !b.ultHint, 'ULT header confirmation fires and dismisses teaching');
  // the charge is the team's — a benched teammate can spend it too
  b.phase = 'aim';
  b.ultIn = 0;
  const bench = (b as any).players.find((p: any) => p !== (b as any).active && !p.dead);
  if (bench) {
    b.pointerDown({ x: bench.x, y: bench.y });
    b.pointerUp();
    b.pointerDown({ x: bench.x, y: bench.y }); // arm, then confirm
    b.pointerUp();
    ok(b.ultIn === ULT_SHOTS, 'a teammate can spend the shared ult charge');
    b.ultIn = 0;
    b.pointerDown({ x: bench.x, y: bench.y });
    b.pointerUp();
    b.pointerDown({ x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 });
    b.pointerUp();
    ok(b.ultIn === ULT_SHOTS && (b as any).ultFx.text === moveOf(bench.def.id, bench.def.type), 'header confirms the teammate displayed in its caster icon');
  }
}

// --- ranked ladder: depth pays, early wipes bleed ----------------------------
{
  const r0 = rating();
  const w = applyRunRating(9, true, 0);
  ok(w.delta > 0 && rating() === r0 + w.delta, `a clear climbs the ladder (+${w.delta})`);
  const l = applyRunRating(1, false, 0);
  ok(l.delta < 0, `an early wipe bleeds rating (${l.delta})`);
  const deep = applyRunRating(8, false, 0);
  ok(deep.delta > 0, 'a deep loss still climbs');
  ok(tier(0).name === 'POKé BALL' && tier(900).name === 'CHAMPION', 'tier bands bracket the ladder');
}

// --- hall of fame: sorted, capped, and honest about misses -------------------
{
  localStorage.removeItem('pk_board');
  ok(board().length === 0, 'board starts empty');
  const mk = (s: number) => ({ s, st: 5, w: false, asc: 0, team: [1, 4, 7], when: 0 });
  recordBoard(mk(100));
  recordBoard(mk(500));
  recordBoard(mk(300));
  ok(board()[0].s === 500 && board()[2].s === 100, 'board sorts by score');
  ok(recordBoard(mk(50)) === 3, 'the lowest slot reports its placement');
  for (let i = 0; i < BOARD_MAX + 2; i++) recordBoard(mk(1000 + i * 100));
  ok(board().length === BOARD_MAX, `board caps at ${BOARD_MAX}`);
  ok(recordBoard(mk(1)) === -1, 'a run under the cutoff misses the board');
  localStorage.setItem('pk_board', '{broken');
  ok(Array.isArray(board()), 'malformed pk_board falls back to memory copy');
  localStorage.removeItem('pk_board');
}

// --- save migration: a legacy best seeds the board exactly once -----------
{
  localStorage.removeItem('pk_board');
  localStorage.setItem('pk_ver', '0');
  localStorage.setItem('pk_best', JSON.stringify({ score: 777, stage: 4, wins: 0, runs: 3 }));
  migrateSaves();
  ok(board()[0]?.s === 777, 'legacy pk_best seeds the hall of fame');
  migrateSaves(); // pk_ver is stamped now — a second boot must not re-seed
  ok(board().length === 1, 'migration runs once');
  localStorage.setItem('pk_board', '[]');
  localStorage.removeItem('pk_best');
  localStorage.setItem('pk_ver', '1');
}

// --- decision telemetry: offers count taken-vs-shown, deaths key by stage ---
{
  localStorage.removeItem('pk_stats');
  statOffer('draft', [1, 4, 7], 4);
  statOffer('draft', [1, 4, 7], null);
  let s = statsDump();
  ok(s.draft['4']?.[0] === 1 && s.draft['4']?.[1] === 2, 'pick rates count taken vs offered');
  statRunEnd(5, false);
  statRunEnd(9, true);
  s = statsDump();
  ok(s.deaths['5'] === 1 && s.wins === 1 && s.runs === 2, 'deaths key by stage, wins count');
  localStorage.removeItem('pk_stats');
}

// --- load() cache: writes invalidate, corrupt stat entries re-seat ----------
{
  const star0 = localStorage.getItem('pk_stars');
  localStorage.setItem('pk_stars', '41'); // an outside write — same shape, new raw
  ok(stars() === 41, 'load() re-parses when the raw blob changes');
  addStars(1);
  ok(stars() === 42, 'a store() write reads back v2 — the cache never serves stale');
  if (star0 == null) localStorage.removeItem('pk_stars');
  else localStorage.setItem('pk_stars', star0);

  // a ledger entry that isn't a [taken, offered] pair re-seats, not throws
  localStorage.setItem(
    'pk_stats',
    JSON.stringify({ draft: { '25': 5 }, perks: { x: 1 }, pulls: { '7': 'y' }, deaths: { '9': 'x' }, wins: 0, runs: 0 }),
  );
  let threw = false;
  try {
    statOffer('draft', [25, 4], 25);
    statPull(7, false);
    statRunEnd(9, false);
  } catch {
    threw = true;
  }
  const cs = statsDump();
  ok(!threw && cs.draft['25']?.[1] === 1 && cs.deaths['9'] === 1, 'corrupt stat entries re-seat instead of throwing');
  localStorage.removeItem('pk_stats');
}

// --- settings: defaults cover garbage, writes persist immediately ----------
{
  localStorage.setItem('pk_settings', '{broken');
  const d = settings();
  ok(
    d.master === 0.8 && d.music === 0.5 && d.sfx === 0.7 && d.haptics && d.shake === 1 && d.flash &&
      d.quality === 'high' && d.pickupFx === 'complete' && !d.battery && !d.fps && d.uiSfx && d.dmgNums && d.aimGuide &&
      d.mapGlints,
    'garbage pk_settings falls back to defaults',
  );
  // cries is retired — an old save's cries key is plain junk now: real keys
  // merge, missing keys read defaults, and nothing leaks a cries field back
  localStorage.setItem('pk_settings', JSON.stringify({ music: 0.2, cries: 0.1, junk: 'x' }));
  const p = settings();
  ok(p.music === 0.2 && p.master === 0.8 && p.flash === true, 'a partial blob merges real keys over defaults');
  ok(!('cries' in p), 'a stored cries key is ignored junk — it never merges back');
  // v1 stored shake as a bool — it migrates to the 0..1 intensity on read
  localStorage.setItem('pk_settings', JSON.stringify({ shake: true }));
  ok(settings().shake === 1, 'stored shake:true migrates to intensity 1');
  localStorage.setItem('pk_settings', JSON.stringify({ shake: false }));
  ok(settings().shake === 0, 'stored shake:false migrates to intensity 0');
  // enum fields merge only members of their allowed set
  localStorage.setItem('pk_settings', JSON.stringify({ quality: 'ultra', pickupFx: 'simple' }));
  const q = settings();
  ok(q.quality === 'high' && q.pickupFx === 'simple', 'enums merge valid members, reject strangers');
  // the FX booleans honor an explicit off, and junk types fall back to on
  localStorage.setItem('pk_settings', JSON.stringify({ dmgNums: false, uiSfx: 7, aimGuide: 'no' }));
  const f = settings();
  ok(!f.dmgNums && f.uiSfx && f.aimGuide, 'FX toggles honor stored false, reject non-booleans');
  setSetting('master', 0.3);
  setSetting('shake', 0);
  ok(settings().master === 0.3 && settings().shake === 0, 'setSetting lands on the merged read');
  const raw = JSON.parse(localStorage.getItem('pk_settings')!);
  ok(raw.master === 0.3 && raw.shake === 0, 'setSetting persists pk_settings immediately');
  setSetting('quality', 'medium');
  ok(settings().quality === 'medium', 'setSetting invalidates the parse cache — no reload needed');
  setSetting('master', 0.8);
  setSetting('music', 0.5);
  setSetting('shake', 1);
  setSetting('quality', 'high');
  setSetting('pickupFx', 'complete'); // leave the store at defaults
}

// --- shiny roll + guaranteed catch ----------------------------------------
{
  const b = new Battle(arena, team(), makeStage(5, 'T'), () => 0); // rng=0 → everything shiny/caught
  (b as any).spawnWave(0);
  const e = (b as any).enemies.find((x: any) => !x.boss);
  ok(e.shiny === true, 'rng<SHINY_RATE rolls shiny');
  const box0 = b.box.length;
  (b as any).hurt(e, e.hp + 50, '#fff');
  ok(b.box.length === box0 + 1, 'shiny KO always catches');
  ok(b.shiniesCaught === 1, 'shiniesCaught counts');
  // capture-time persistence: the dex + shiny ledger update the moment the
  // ball lands, not at run end — a closed tab can't lose a catch
  ok(dexIds().includes(e.def.id), 'catch writes the dex immediately');
  ok(shinyIds().includes(e.def.id), 'shiny catch writes the shiny ledger');
  ok(unlockedAch().has('shiny'), 'shiny catch unlocks the SHINING trophy');
  ok(!unlockAch('shiny'), 'trophy unlock is idempotent');
}

// --- trophy shelf: list sanity + award dedupe -------------------------------
{
  ok(ACHIEVEMENTS.length >= 10, `${ACHIEVEMENTS.length} trophies defined`);
  ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'trophy ids unique');
  ok(unlockAch('test-noop') === true, 'fresh trophy unlocks');
  ok(unlockAch('test-noop') === false, 'repeat unlock is a no-op');
}

// --- level variance: draft 5-14, wilds scale with depth, catches keep it --
{
  const b = new Battle(arena, [{ ...ROSTER[0], lvl: 20 }, ...team().slice(1)], makeStage(55, 'T'), mulberry32(6));
  const p = (b as any).players[0];
  ok(p.lvl === 20, `draft lvl marker applies (lv${p.lvl})`);
  ok(p.pow > ROLE_MODS[p.role].pow * 1.1, `draft level scales pow (${p.pow.toFixed(2)})`);
  (b as any).spawnWave(0);
  const lv0 = b.enemies.reduce((s, e) => s + e.lvl, 0) / Math.max(1, b.enemies.length);
  for (let i = 1; i <= 6; i++) (b as any).spawnWave(i); // rolled waves materialize sequentially
  const lv6 = b.enemies.reduce((s, e) => s + e.lvl, 0) / Math.max(1, b.enemies.length);
  ok(lv6 > lv0 + 30, `wild levels scale with depth (w0 ${lv0.toFixed(1)} → w6 ${lv6.toFixed(1)})`);
  ok(lv0 >= 5 && lv0 <= LV_CAP, `wild levels inside 1-${LV_CAP}`);
}
{
  const b = new Battle(arena, team(), makeStage(8, 'T'), () => 0); // rng=0 → catches always land
  for (let i = 0; i <= 4; i++) (b as any).spawnWave(i);
  const e = (b as any).enemies[0];
  e.sumStage = 2;
  e.hp = Math.ceil(e.maxHp * 0.4);
  e.sash = false;
  e.lastStand = false;
  const el = e.lvl;
  (b as any).hurt(e, e.hp * 4 + 50, '#fff');
  // keeps its level up to the catch cap — the team's own average
  const pl = (b as any).players.map((p: any) => p.lvl);
  const want = Math.min(el, Math.max(1, Math.round(pl.reduce((s: number, l: number) => s + l, 0) / pl.length)));
  ok(b.boxLvl[b.boxLvl.length - 1] === want, `caught mon joins capped at team pace (Lv${el} wild → Lv${b.boxLvl[b.boxLvl.length - 1]}, cap ${want})`);
}

// --- map stop effects -------------------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  (b as any).spawnWave(0);
  const p0 = (b as any).players[0];
  const p1 = (b as any).players[1];
  p0.hp = Math.round(p0.maxHp * 0.5);
  p1.dead = true;
  p1.hp = 0;
  const items0 = b.heldItems.length;
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'rest', row: 0, links: [] });
  (b as any).phase = 'map';
  (b as any).pickEventChoice(0); // POKÉ CENTER — heal + revive
  ok(p0.hp === p0.maxHp, `rest heals to full (${p0.hp}/${p0.maxHp})`);
  ok(!p1.dead && p1.hp === p1.maxHp, 'rest revives a fainted mon');
  // TRAIN HARD: the other rest pick trades the heal for +3 levels
  const bt = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  const tp = (bt as any).players[0];
  const lvl0 = tp.lvl;
  tp.hp = Math.floor(tp.maxHp / 2);
  (bt as any).arriveAtNode({ tx: 0, ty: 0, kind: 'rest', row: 0, links: [] });
  (bt as any).phase = 'map';
  (bt as any).pickEventChoice(1); // TRAIN HARD — +3 levels, no heal
  ok(tp.lvl === lvl0 + 3 && tp.hp < tp.maxHp, `train hard: +3 levels, no heal (Lv${lvl0}→${tp.lvl})`);
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'chest', row: 0, links: [] });
  ok(b.heldItems.length === items0 + 1, 'chest stop grants a relic');
  // the mart boards a shop shelf — buys re-prompt until LEAVE
  p1.dead = true;
  p1.hp = 0;
  (b as any).arriveAtNode({ tx: 0, ty: 0, kind: 'mart', row: 0, links: [] });
  ok((b as any).eventChoice?.options.length === 5, 'mart shelf lists revive when a mon is down');
  (b as any).phase = 'map';
  b.score = 600;
  (b as any).pickEventChoice(3); // REVIVE 350
  ok(!p1.dead && p1.hp === Math.round(p1.maxHp / 2) && b.score === 250, 'mart revive trades score for a standing mon');
  ok(!!(b as any).eventChoice, 'mart keeps the board open until LEAVE');
  (b as any).pickEventChoice(0); // POTION 200 — one-of-each stock…
  ok(b.score === 50, 'mart potion trades score for a heal');
  ok(!(b as any).eventChoice.options.some((o: { label: string }) => o.label.startsWith('POTION')), 'a bought shelf item leaves the board');
  const left = (b as any).eventChoice.options.length;
  (b as any).pickEventChoice(0); // RARE CANDY 400 — the wallet can't cover it
  ok((b as any).eventChoice.options.length === left && b.score === 50, 'short score keeps the item on the shelf');
  (b as any).pickEventChoice((b as any).eventChoice.options.length - 1);
  ok(!(b as any).eventChoice, 'LEAVE resolves the mart stop');
}

// --- trainer stops: mono-type squads, no catches --------------------------
{
  const b = new Battle(arena, team(), makeStage(21, 'T'), mulberry32(9));
  const node = { tx: 0, ty: 0, kind: 'trainer' as const, row: 1, links: [], ttype: 'fire' as const };
  (b as any).spawnWave(1, node);
  ok(b.enemies.length >= 4, `trainer fields a squad (${b.enemies.length})`);
  ok(b.enemies.every((e) => e.def.type === 'fire'), 'trainer squad is mono-type');
  ok(!b.enemies.some((e) => e.shiny), 'trainer mons are never shiny');
  const boxN = b.box.length;
  (b as any).hurt(b.enemies[0], b.enemies[0].hp + 50, '#fff');
  ok(b.box.length === boxN, 'trainer mons cannot be caught');
  ok((b as any).hardWave, 'trainer wave is a hard stop');
}

// --- recruits: only a fallen gym pays its ace -------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(0); // wild wave — no boss
  const box0 = b.box.length;
  (b as any).enterReward();
  ok(b.box.length === box0 && !b.lastRecruit, 'wild stage grants no recruit');
  (b as any).spawnWave(2); // gym wave — has a boss
  (b as any).enterReward();
  ok(!!b.lastRecruit && b.box.length > box0, `gym pays its ace (${b.lastRecruit?.name})`);
}

// --- field-move walls: break counts, safe pushes and authored lanes -------
{
  const grid = (cells: [number, number, string][]) => {
    const rows = ['1111E1111', ...Array(8).fill('100000001'), '1000P0001', '111111111'].map((r) => r.split(''));
    for (const [c, r, ch] of cells) rows[r][c] = ch;
    return rows.map((r) => r.join(''));
  };
  const battle = (g: string[]) => {
    const b: any = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
    b.enemies = [];
    for (const u of b.players) { u.x = arena.x + 30; u.y = arena.y + arena.h - 30; }
    b.swapCourt(g);
    b.hazards = [];
    return b;
  };
  const hit = (b: any, block: any, side = 'left', speed = 400) => {
    const u = b.active;
    u.x = block.x + block.w / 2; u.y = block.y + block.h / 2;
    u.vx = 0; u.vy = 0;
    if (side === 'left') { u.x = block.x - u.r + 1; u.vx = speed; }
    if (side === 'right') { u.x = block.x + block.w + u.r - 1; u.vx = -speed; }
    if (side === 'top') { u.y = block.y - u.r + 1; u.vy = speed; }
    if (side === 'bottom') { u.y = block.y + block.h + u.r - 1; u.vy = -speed; }
    b.hitBlocks(u);
  };
  const b = battle(grid([[3, 4, 'R'], [4, 4, 'R'], [5, 4, 'T']]));
  ok(b.blocks.length === 3, 'field tiles compile as separate solid cells, not merged slabs');
  const rock = b.blocks.find((r: any) => r.field === 'smash');
  if (rock) {
    hit(b, rock, 'left', 0);
    ok(rock.hp === 3, 'resting overlap does not damage Rock Smash rock');
    hit(b, rock);
    ok(rock.hp === 2 && b.active.vx < 0, 'first rock hit chips it and bounces normally');
    b.hitBlocks(b.active);
    ok(rock.hp === 2, 'separation does not count as a second impact');
    hit(b, rock);
    ok(rock.hp === 1 && b.blocks.includes(rock), 'second rock hit leaves cracked cover');
    hit(b, rock);
    ok(!b.blocks.includes(rock), 'third rock hit opens floor');
    ok(b.blocks.length === 2, 'breaking one rock does not remove its neighbor');
  } else ok(false, 'Rock Smash tile installs hit points');
  for (const [id, hits] of [[1, 1], [123, 2], [212, 2], [7, 2], [46, 1], [585, 1]]) {
    const cut = battle(grid([[4, 4, 'T']]));
    cut.active.def = speciesById(id)!;
    const tree = cut.blocks[0];
    if (tree) {
      hit(cut, tree);
      ok(cut.blocks.includes(tree) === (hits === 2), `${cut.active.def.name} Cut first-hit rule`);
      if (hits === 2) { hit(cut, tree); ok(!cut.blocks.includes(tree), 'ordinary ball cuts tree on second hit'); }
    } else ok(false, 'Cut tree compiles as cover');
  }
  for (const [side, dx, dy] of [['left', 1, 0], ['right', -1, 0], ['top', 0, 1], ['bottom', 0, -1]] as const) {
    const push = battle(grid([[4, 4, 'B']]));
    const stone = push.blocks[0];
    if (!stone) { ok(false, 'Strength boulder compiles as cover'); continue; }
    const x = stone.x, y = stone.y;
    hit(push, stone, side);
    ok(Math.abs(stone.x - x - dx * arena.w / 9) < 0.001 && Math.abs(stone.y - y - dy * arena.h / 11) < 0.001, `Strength pushes exactly one cell from ${side}`);
    ok(push.active.vx * dx + push.active.vy * dy < 0, 'pushing impact still banks the ball');
  }
  for (const ch of ['2', 'R', 'T', 'B', '3', '4', 'S', 'P']) {
    const push = battle(grid([[3, 4, 'B'], [4, 4, ch]]));
    const stone = push.blocks.find((r: any) => r.field === 'strength');
    if (!stone) continue;
    const x = stone.x;
    hit(push, stone);
    ok(stone.x === x, `Strength cannot push onto ${ch}`);
  }
  const edge = battle(grid([[7, 4, 'B']]));
  if (edge.blocks[0]) { const x = edge.blocks[0].x; hit(edge, edge.blocks[0]); ok(edge.blocks[0].x === x, 'Strength stays inside the room'); }
  const occupied = battle(grid([[3, 4, 'B']]));
  if (occupied.blocks[0]) {
    const stone = occupied.blocks[0], x = stone.x;
    occupied.players[1].x = x + stone.w * 1.5;
    occupied.players[1].y = stone.y + stone.h / 2;
    hit(occupied, stone);
    ok(stone.x === x, 'Strength never pushes onto a live unit');
    occupied.players[1].x = arena.x + 30;
    occupied.hazards = [{ kind: 'mine', x: x + stone.w * 1.5, y: stone.y + stone.h / 2, r: 15 }];
    hit(occupied, stone);
    ok(stone.x === x, 'Strength never pushes onto a live hazard');
  }
  const gate = battle(grid([[3, 4, 'B'], [3, 3, '2'], [4, 3, 'S'], [5, 3, '2'], [3, 2, '2'], [4, 2, '2'], [5, 2, '2'], [5, 4, '2']]));
  if (gate.blocks.some((r: any) => r.field === 'strength')) {
    const stone = gate.blocks.find((r: any) => r.field === 'strength'), x = stone.x;
    hit(gate, stone);
    ok(stone.x === x, 'Strength rejects a free cell that would wall in a spawn');
  }
  const layouts = ROOM_LAYOUTS.filter((g) => g.some((r) => /[RTB]/.test(r)));
  ok(layouts.length >= 6 && layouts.length <= 10, 'six to ten authored rooms use field moves');
  ok(ROOM_LAYOUTS.slice(0, 3).every((g) => g.every((r) => !/[RTB]/.test(r))), 'first three gentle rooms stay unchanged');
  for (const g of layouts) {
    ok(g.length === 11 && g.every((r) => r.length === 9 && r === r.split('').reverse().join('')), 'field room is 9x11 and mirror-symmetric');
    const room = battle(g);
    ok(room.blocks.every((r: any) => room.players.every((u: any) => u.x + u.r <= r.x || u.x - u.r >= r.x + r.w || u.y + u.r <= r.y || u.y - u.r >= r.y + r.h)), 'field room installs without trapping the team in cover');
    for (const anchor of buildRoom(g, 'grove', () => 0.99).anchors)
      ok(!room.blocks.some((r: any) => arena.x + anchor.nx * arena.w > r.x && arena.x + anchor.nx * arena.w < r.x + r.w && arena.y + anchor.ny * arena.h > r.y && arena.y + anchor.ny * arena.h < r.y + r.h), 'field room spawn anchors stay on floor');
    ok(room.pickNextRoom() !== g, 'next-court selection never repeats the installed room');
  }
}

// --- room blocks: furnished waves, open boss rooms, clean spawns --------
{
  let furnished = 0,
    gymOpen = 0,
    gymFurnished = 0,
    overlap = 0;
  for (const s of [1, 7, 13, 42, 99, 314, 777, 2024, 5150, 9001]) {
    const b = new Battle(arena, team(), makeStage(s), mulberry32(s));
    for (const i of [0, 1, 2]) {
      (b as any).spawnWave(i);
      if ((b as any).enemies.some((e: any) => e.boss)) (b.blocks.length ? gymFurnished++ : gymOpen++);
      if (b.blocks.length) furnished++;
      for (const e of b.enemies)
        for (const bl of b.blocks)
          if (e.x > bl.x - e.r && e.x < bl.x + bl.w + e.r && e.y > bl.y - e.r && e.y < bl.y + bl.h + e.r) overlap++;
    }
  }
  ok(furnished > 0, `${furnished}/30 spawned waves furnished with stone blocks`);
  ok(gymOpen > 0, `gyms mostly stay open (${gymOpen} open, ${gymFurnished} furnished)`);
  ok(overlap === 0, `${overlap} enemy spawns inside blocks`);
}

// --- boss enrage ------------------------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave — has a boss
  const boss = (b as any).enemies.find((e: any) => e.boss);
  ok(!!boss, 'gym wave has a boss');
  if (boss) {
    boss.sumStage = 2;
    boss.hp = Math.ceil(boss.maxHp * 0.4);
    (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.15), '#fff');
    ok(boss.enraged === true, `boss enrages under 30% hp (${Math.round(boss.hp / boss.maxHp * 100)}%)`);
  }
}

// --- every rolled wave across seeds is spawnable ---------------------------
{
  let bad = 0;
  for (let s = 1; s <= 40; s++) {
    const st = makeStage(s);
    for (const w of st.waves) if (!w.length) bad++;
  }
  ok(bad === 0, `40 seeded stages, ${bad} empty waves`);
}

// --- power tiers: weak draft, depth-gated wild pools ------------------------
{
  ok(ROSTER.every((r) => tierOf(r) <= 1), `draft pool is weak mons only (max BST tier ${Math.max(...ROSTER.map(tierOf))})`);
  // seeded openers never field a heavy hitter
  let heavy = 0;
  for (let s = 1; s <= 30; s++) {
    for (const w of makeStage(s).waves[0]) if (tierOf(w.def) >= 2) heavy++;
  }
  ok(heavy === 0, `stage-1 fodder stays tier ≤1 (${heavy} heavy)`);
  // shallow rolled waves can't roll ubers; deep ones can (bosses excluded —
  // gym aces are the marquee exception, not fodder)
  let uber = 0;
  for (let s = 1; s <= 40; s++) {
    for (const w of rollWave(mulberry32(s), 1, 'grove')) if (!w.boss && tierOf(w.def) >= 3) uber++;
  }
  ok(uber === 0, `depth-1 waves field no ubers (${uber})`);
  let deep = 0;
  for (let s = 1; s <= 60; s++) {
    for (const w of rollWave(mulberry32(s), 6, 'grove')) if (!w.boss && tierOf(w.def) >= 3) deep++;
  }
  ok(deep > 0, `deep waves roll 560+ elites (${deep})`);
  // ~12% of waves are species pods — over 60 seeds at least one all-same
  // pack rolls, and pods never come with a boss riding along
  let pods = 0;
  for (let s = 1; s <= 60; s++) {
    const w = rollWave(mulberry32(s), 2, 'grove');
    if (!w.some((x) => x.boss) && w.length >= 3 && w.every((x) => x.def === w[0].def)) pods++;
  }
  ok(pods > 0 && pods < 20, `species pods roll occasionally (${pods}/60)`);
  // trainers obey the same gate — a stage-2 squad tops out at tier 2
  let tmax = 0;
  for (let s = 1; s <= 30; s++) {
    for (const w of trainerWave(mulberry32(s), 0, 'fire')) tmax = Math.max(tmax, tierOf(w.def));
  }
  ok(tmax <= 2, `depth-0 trainer squads stay ≤ tier 2 (max ${tmax})`);
}

// --- roster integrity: every evo chain resolves, every species has art ----
{
  const ids = new Set(ALL_SPECIES.map((d) => d.id));
  const dangling = ALL_SPECIES.filter(
    (d) => d.evolvesTo != null && (Array.isArray(d.evolvesTo) ? d.evolvesTo : [d.evolvesTo]).some((id) => !ids.has(id)),
  );
  ok(!dangling.length, `every evolvesTo resolves (${dangling.map((d) => `${d.name}->${d.evolvesTo}`).join(',') || 'none'})`);
  const noArt = ALL_SPECIES.filter((d) => !existsSync(`public/sprites/${d.id}.png`));
  ok(!noArt.length, `every species has a vendored sprite (${noArt.map((d) => `${d.name}#${d.id}`).join(',') || 'none'})`);
}

// --- badge case: every leader is themed to a badge, paid once -------------
{
  ok(
    BOSS_POOL.length === 11 && new Set(BOSS_POOL.map((b) => b.type)).size === 11 && BOSS_POOL.every((b) => badgeOf(b.id)),
    `11 leaders, one per type, all badge-themed (${BOSS_POOL.map((b) => b.name).join('/')})`,
  );
  ok(
    BOSS_POOL.every((b) => ACHIEVEMENTS.some((a) => a.id === `gym-${b.id}`)),
    'every leader seeds its own trophy',
  );
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(1));
  (b as any).spawnWave(2); // the gym wave — leader + entourage
  const boss = (b as any).enemies.find((e: any) => e.boss);
  ok(!!boss && !!badgeOf(boss.def.id), `gym boss maps to a badge (${boss?.def.name})`);
  ok(
    b.enemies.filter((e: any) => !e.boss).every((e: any) => e.def.type === boss.def.type),
    'leader entourage is mono-type',
  );
  boss.sumStage = 2;
  boss.hp = Math.ceil(boss.maxHp * 0.4);
  (b as any).hurt(boss, 999999, '#fff'); // KO the leader — caught or fainted, the badge pays
  if (!boss.dead) (b as any).hurt(boss, 999999, '#fff'); // focus sash holds once — the second hit lands
  ok(gymBadges().has(boss.def.id), `gym KO banks the ${badgeOf(boss.def.id)?.name}`);
  ok(unlockedAch().has(`gym-${boss.def.id}`), `gym KO unlocks the leader trophy`);
  ok(earnBadge(boss.def.id) === null, 'the same leader pays the badge once');
}

// --- full autoplayed climbs: naive aim, real physics, win or wipe ---------
for (const [seed, asc] of [[99, 0], [2024, 0], [777, 0], [5150, 5]] as const) {
  const rng = mulberry32(seed);
  const b = new Battle(arena, team(), makeStage(seed), rng);
  b.asc = asc;
  let frames = 0;
  let aimTries = 0;
  let lastWave = -1; // the aim budget is per-wave — a fresh fight refills it
  let shopPicks = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) b.update(1 / 60); };
  while (b.phase !== 'won' && b.phase !== 'lost' && frames < 200000) {
    frames++;
    if ((b as any).waveIndex !== lastWave) {
      lastWave = (b as any).waveIndex;
      aimTries = 0; // new wave, new budget — the flail cycle restarts with it
    }
    if (b.phase === 'aim' && aimTries++ > 600) break; // stall detector — bouncier physics makes a dumb bot's fights run longer
    if ((b as any).eventChoice) { // a ? is asking — buy once, then LEAVE (last option) if the board re-asks
      const opts = (b as any).eventChoice.options;
      (b as any).pickEventChoice(shopPicks++ % 2 ? opts.length - 1 : 0);
      step(5);
      continue;
    }
    if ((b as any).eventBox) { // an event popup holds the map — dismiss it first
      b.pointerDown({ x: 270, y: 850 });
      step(5);
      continue;
    }
    if (b.phase === 'map') {
      // pick a linked stop — same cell math drawRegion/pointerDown use
      const region = b.regionMap;
      const cur = region.nodes[(b as any).mapNode];
      const n = region.nodes[cur.links[Math.floor(rng() * cur.links.length)]];
      // the map viewport scrolls — screen y is island row minus camera
      b.pointerDown({ x: MAP_OX + n.tx * MAP_CELL + MAP_CELL / 2, y: MAP_OY + (n.ty - (b as any).mapCam) * MAP_CELL + MAP_CELL / 2 });
      step(240); // the lead mon walks the route over ~6 tiles/sec
    } else if (b.phase === 'reward') {
      if (b.evoChoice) b.pickEvo(Math.floor(rng() * b.evoChoice.options.length)); // a split evo asks first
      else if (b.rewardOffers.length) b.pickPerk(Math.floor(rng() * b.rewardOffers.length));
      else b.declineReward(); // empty board — take the score and go
    } else if (b.phase === 'aim') {
      const u = (b as any).active;
      if (!u || u.dead) { step(30); continue; }
      const foes = (b as any).enemies.filter((e: any) => !e.dead);
      if (!foes.length) { step(60); continue; }
      // nearest live foe — but if one is sitting on us, aim at arena top instead.
      // when straight shots keep whiffing into stone, the bot flails: cycles
      // targets and banks the pull angle so a dead lane can't stall the climb
      let foe = foes[0], bestD = Infinity;
      for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < bestD) { bestD = d; foe = f; } }
      const t = bestD > 60 ? foe : { x: arena.x + arena.w / 2, y: arena.y + 60 };
      let dx = t.x - u.x, dy = t.y - u.y;
      if (aimTries > 120) {
        const alt = foes[aimTries % foes.length];
        const wob = ((aimTries * 37) % 9 - 4) * 0.28; // swing the aim ±64° in steps
        const cs = Math.cos(wob), sn = Math.sin(wob);
        [dx, dy] = [ (alt.x - u.x) * cs - (alt.y - u.y) * sn, (alt.x - u.x) * sn + (alt.y - u.y) * cs ];
      }
      const d = Math.hypot(dx, dy) || 1;
      b.pointerDown({ x: u.x, y: u.y });
      b.pointerMove({ x: u.x - (dx / d) * 200, y: u.y - (dy / d) * 200 });
      b.pointerUp();
      step(1);
    } else {
      step(30);
    }
  }
  if (b.phase === 'aim') {
    const left = (b as any).enemies.filter((e: any) => !e.dead).map((e: any) => `${e.def.name}#${e.def.id} ${Math.round(e.hp)}/${e.maxHp}`).join(' | ');
    console.log(`DBG seed ${seed}: aim stall depth=${(b as any).depth} wave=${(b as any).waveIndex} tries=${aimTries} — left: ${left}`);
  }
  ok(b.phase === 'won' || b.phase === 'lost', `seed ${seed}${asc ? ` asc${asc}` : ''}: ${b.phase} (depth ${(b as any).depth}, score ${b.score}, kos ${(b as any).totalKos})`);
  ok(b.score > 0, 'score accumulates');
}

// --- region map integrity ---------------------------------------------------
{
  for (const s of [1, 42, 99, 777, 2024, 5150, 31337]) {
    const r = genRegion(s);
    const rowOf = (i: number) => r.nodes[i].row;
    const fwd = r.nodes.every((n) => n.links.every((li) => rowOf(li) === n.row + 1));
    ok(fwd, `seed ${s}: all links go one row forward`);
    const reachable = new Set([0]);
    for (let i = 0; i < r.nodes.length; i++) if (reachable.has(i)) r.nodes[i].links.forEach((li) => reachable.add(li));
    ok(reachable.size === r.nodes.length, `seed ${s}: every stop reachable (${reachable.size}/${r.nodes.length})`);
    const gyms = [2, 5, 8].map((row) => r.nodes.filter((n) => n.row === row));
    ok(gyms.every((g) => g.length === 1 && g[0].kind === 'gym'), `seed ${s}: forced single gyms on rows 2/5/8`);
    // triplet shape: HOME at row -1, then every non-gym row is a left/right fork
    ok(r.nodes[0].kind === 'start' && r.nodes[0].row === -1, `seed ${s}: HOME anchors the climb`);
    ok(
      r.nodes.filter((n) => n.row === 0).every((n) => r.nodes[0].links.includes(r.nodes.indexOf(n))),
      `seed ${s}: HOME links to stage 1's whole fork`,
    );
    const forks = [0, 1, 3, 4, 6, 7].every((row) => {
      const n = r.nodes.filter((x) => x.row === row).length;
      return n >= 2 && n <= 3;
    });
    ok(forks, `seed ${s}: every choice row is a 2-3 lane fork`);
    ok(r.nodes.every((n) => n.kind !== 'trainer' || !!n.ttype), `seed ${s}: trainer stops carry a type`);
    ok(r.nodes.length >= 9 && r.nodes.length <= 24, `seed ${s}: ${r.nodes.length} stops`);
    // every linked pair must have a walkable carved route between them
    let walkable = true;
    for (const n of r.nodes)
      for (const li of n.links) {
        const p = routePath(r, n, r.nodes[li]);
        const t = r.nodes[li];
        if (p.length < 2 || p[p.length - 1].x !== t.tx || p[p.length - 1].y !== t.ty) walkable = false;
      }
    ok(walkable, `seed ${s}: every link has a walkable route`);
    // the cottage stands on stamped grass — a water tile under it means
    // the house floats on stilts over the sea
    const home = r.nodes[0];
    ok(
      [0, 1, 2, 3].every((dy) => r.tiles[(home.ty - dy) * MAP_W + home.tx] === T_GRASS),
      `seed ${s}: HOME's yard stays dry`,
    );
  }
}

// --- map guarantees: rests are rare, but ? and mart stay in each half ---
{
  for (const s of [1, 7, 13, 42, 99, 777, 2024, 5150, 31337, 555]) {
    const r = genRegion(s);
    const rests = r.nodes.filter((n) => n.kind === 'rest').length;
    ok(rests >= 1 && rests <= 3, `seed ${s}: rests are rare — one guaranteed somewhere (${rests} total)`);
    const ev1 = r.nodes.some((n) => n.kind === 'event' && n.row >= 1 && n.row <= 4);
    const ev2 = r.nodes.some((n) => n.kind === 'event' && n.row >= 5 && n.row <= 7);
    ok(ev1 && ev2, `seed ${s}: a ? stop is offered in each half`);
    const m1 = r.nodes.some((n) => n.kind === 'mart' && n.row >= 1 && n.row <= 4);
    const m2 = r.nodes.some((n) => n.kind === 'mart' && n.row >= 5 && n.row <= 7);
    ok(m1 && m2, `seed ${s}: a mart is offered in each half`);
  }
}

// --- type traits: tiers, shiny double-count, dead mons excluded -------------
{
  const mk = (type: 'fire' | 'water' | 'ghost' | 'normal', shiny = false, dead = false) => ({ dead, shiny, def: { type } });
  ok(teamTraits([mk('fire'), mk('fire'), mk('water')]).get('fire') === 1, 'two same-type = tier 1');
  ok(teamTraits([mk('ghost', true), mk('ghost'), mk('ghost')]).get('ghost') === 2, 'shiny counts double (2+1+1=4 → tier 2)');
  ok(teamTraits([mk('normal', true), mk('normal', true), mk('normal'), mk('water')]).get('normal') === 3, 'two shinies + one = tier 3');
  ok(teamTraits([mk('fire'), mk('fire'), mk('fire', false, true)]).get('fire') === 1, 'fainted mons do not feed traits');
  ok(!teamTraits([mk('water'), mk('fire'), mk('ghost'), mk('normal')]).size, 'spread team earns no traits');
  ok(Object.values(TRAIT_DESC).every((d) => d.length === 3), 'every type documents 3 trait tiers');
}

// --- trait hooks land in battle ---------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(4));
  (b as any).spawnWave(0);
  b.traits.clear();
  const e = b.enemies[0];
  e.shieldN = 0;
  const hp0 = e.hp;
  (b as any).hurt(e, 50, '#fff');
  const d1 = hp0 - e.hp;
  e.hp = hp0;
  b.traits.set('fire', 3);
  (b as any).hurt(e, 50, '#fff');
  const d2 = hp0 - e.hp;
  ok(d2 > d1, `fire trait boosts damage (${d1} → ${d2})`);
  // anti-stall: the same hit hurts more once a wave has outlasted 10 shots
  const p = b.players[0];
  b.traits.clear();
  const php0 = p.hp;
  (b as any).waveShots = 0;
  (b as any).damagePlayer(p, 50);
  const h1 = php0 - p.hp;
  p.hp = php0;
  (b as any).waveShots = 20;
  (b as any).damagePlayer(p, 50);
  const h2 = php0 - p.hp;
  ok(h2 > h1, `anti-stall pressure ramp after 10 shots (${h1} → ${h2})`);
}

// --- ? event pool: variety, ambushes stage scripted waves -------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  (b as any).spawnWave(0);
  const seen = new Set<string>();
  let waves = 0;
  for (let i = 0; i < 60; i++) {
    const out = rollEvent(b);
    seen.add(out.note.slice(0, 12));
    if (out.wave) waves++;
  }
  ok(seen.size >= 4, `event pool rolls variety (${seen.size} distinct outcomes)`);
  ok(waves > 0, `ambushes stage scripted waves (${waves}/60)`);
}

// --- event arrival: scripted wave replaces the row, no gym credit -----------
{
  const b = new Battle(arena, team(), makeStage(41, 'T'), mulberry32(5));
  (b as any).pendingEventWave = [{ def: speciesById(262)!, nx: 0.5, ny: 0.3, boss: true }];
  (b as any).spawnWave(1);
  ok((b as any).inEvent, 'event wave flagged');
  ok(b.enemies.some((e) => e.boss), 'scripted boss fields');
  ok(!(b as any).waveHadGym, 'event boss is not a gym badge');
  ok(!!b.enemies.find((e) => e.boss)?.relic, 'event alpha carries a held item');
}

// --- floating text: repeats coalesce, numbers don't, court caps -----------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const tx = () => (b as any).texts as { text: string; big: boolean }[];
  tx().length = 0;
  const push = (text: string, x = 200, big = false) => (b as any).pushText({ x, y: 300, text, t: 1, color: '#fff', big });
  push('RICOCHET!');
  push('RICOCHET!', 230);
  ok(tx().length === 1 && tx()[0].text === 'RICOCHET! ×2', 'a repeat callout coalesces into ×2');
  push('RICOCHET!', 480);
  ok(tx().length === 2, 'a far-off repeat gets its own callout');
  push('-12');
  push('-12');
  ok(tx().filter((t) => t.text === '-12').length === 2, 'damage numbers never coalesce');
  tx().length = 0;
  push('BANNER', 270, true);
  for (let i = 0; i < 20; i++) push(`L${i}`, 20 + i * 25);
  ok(tx().length === 5 && tx().some((t) => t.text === 'BANNER'), 'court caps at 5 callouts, banners outlive small labels');
}

// --- field labels: one intro per pickup kind, foe priority, no overlap -----
{
  const b: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  b.pickups = [{ x: 200, y: 400, kind: 'oran-berry', t: 0, age: 0 }];
  b.update(0.016);
  ok(b.pickups[0]?.tag === LABEL_INTRO, 'first oran shows its tag');
  let elapsed = 0.016;
  while (elapsed <= LABEL_INTRO + 0.1) {
    b.update(0.1);
    elapsed += 0.1;
  }
  ok(b.pickups[0]?.tag === 0, 'tag hides after LABEL_INTRO');
  b.pickups.push(
    { x: 200, y: 400, kind: 'oran-berry', t: 0, age: 0 },
    { x: 240, y: 400, kind: 'protein', t: 0, age: 0 },
  );
  b.update(0.016);
  ok(b.pickups[1]?.tag === 0, 'repeat kind stays icon-only');
  ok(b.pickups[2]?.tag === LABEL_INTRO, 'new kind shows its tag');

  const foe = { safeguard: true, def: { regen: true } };
  ok(b.foeTag(foe, true) === 'SAFEGUARD', 'pull tag favors safeguard');
  foe.safeguard = false;
  foe.def.regen = true;
  ok(b.foeTag(foe, true) === undefined && b.foeTag(foe, false) === 'REGEN', 'intro foe tag includes non-pull traits');

  const boxes = new Float32Array(32 * 4);
  let count = 0;
  for (let i = 0; i < 6; i++)
    placeLabel(boxes, count++, 270, 300, 120, 16, 3, 100, 800, i % 2 === 0);
  placeLabel(boxes, count++, 270, 105, 120, 16, 3, 100, 800, true);
  placeLabel(boxes, count++, 270, 105, 120, 16, 3, 100, 800, true);
  let disjoint = true;
  let within = true;
  for (let i = 0; i < count; i++) {
    const x0 = boxes[i * 4], y0 = boxes[i * 4 + 1], x1 = boxes[i * 4 + 2], y1 = boxes[i * 4 + 3];
    within &&= y0 >= 100 && y1 <= 800;
    for (let j = i + 1; j < count; j++) {
      const ox0 = boxes[j * 4], oy0 = boxes[j * 4 + 1], ox1 = boxes[j * 4 + 2], oy1 = boxes[j * 4 + 3];
      if (x0 < ox1 && x1 > ox0 && y0 < oy1 && y1 > oy0) disjoint = false;
    }
  }
  ok(disjoint && within, 'field labels nudge apart and stay off the HUD');
}

// --- boss bars + teleport rotation ------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave — has a boss
  const boss = b.enemies.find((e) => e.boss)!;
  const oldFoes = b.enemies.filter((e) => !e.boss);
  oldFoes[0].stolen = 'oran-berry';
  const boxBefore = b.box.length;
  const levelsBefore = b.players.map((p) => p.lvl);
  const blocksBefore = b.blocks;
  const hazardsBefore = b.hazards;
  const stolenBefore = b.pickups.filter((p) => p.kind === 'oran-berry').length;
  boss.timer = 0.5;
  (boss as any).bigT = 2;
  (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.5), '#fff');
  ok(boss.hp === Math.ceil(boss.maxHp * 0.7), `first bar clamps boss at 70% (${boss.hp}/${boss.maxHp})`);
  ok(boss.sumStage === 1 && (b as any).barBreak, 'first bar break queues after this shot');
  const breakHp = boss.hp;
  (b as any).hurt(boss, 100, '#fff');
  ok(boss.hp === breakHp, 'pending bar break absorbs further hits');
  (b as any).endShot();
  const firstEscorts = b.enemies.filter((e) => e.minion);
  ok(oldFoes.every((e) => !b.enemies.includes(e)), 'old escorts flee without a KO path');
  ok(firstEscorts.length === 1 && firstEscorts.every((e) => e.timer <= 2), 'first break brings one hot guard escort');
  ok(b.box.length === boxBefore && b.players.every((p, i) => p.lvl === levelsBefore[i]), 'fleeing escorts give no catches or XP');
  ok(b.pickups.filter((p) => p.kind === 'oran-berry').length === stolenBefore + 1, 'fleeing thief returns its stolen pickup');
  ok(b.blocks !== blocksBefore && b.hazards !== hazardsBefore, 'bar break rebuilds the room');
  const blocksBar2 = b.blocks;
  ok(b.telop.texts().includes('PHASE CLEAR') && b.telop.texts().includes('BATTLE 2/3'), 'first break announces PHASE CLEAR · BATTLE 2/3');
  ok(boss.timer > 1 && (boss as any).bigT === 7 && !(b as any).barBreak, 'boss returns with both clocks reset');

  for (const m of firstEscorts) m.dead = true;
  boss.timer = 0.5;
  (boss as any).bigT = 1;
  (b as any).hurt(boss, Math.ceil(boss.maxHp * 0.5), '#fff');
  ok(boss.hp === Math.ceil(boss.maxHp * 0.4) && boss.sumStage === 2 && (b as any).barBreak, 'second bar clamps boss at 40%');
  (b as any).endShot();
  const secondEscorts = b.enemies.filter((e) => e.minion);
  ok(firstEscorts.every((e) => !b.enemies.includes(e)) && secondEscorts.length === 2, 'second break replaces escorts with two guards');
  ok(b.telop.texts().includes('BATTLE 3/3'), 'second break announces BATTLE 3/3');
  if (!(b as any).gymFurnished) {
    const sig = (r: any[]) => JSON.stringify(r.map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.w), Math.round(k.h)]));
    ok(new Set([sig(blocksBefore), sig(blocksBar2), sig(b.blocks)]).size === 3, 'each boss bar gets its own authored court');
  }
  ok(boss.timer >= 1 && boss.phaseRage && (boss as any).bigT === 7 && !(b as any).barBreak, 'second break resets clocks with final-bar rage');
  // attack rotation: signature, signature, hop — position changes on the 3rd
  const { x: hx, y: hy } = { x: boss.x, y: boss.y };
  (b as any).bossAttack(boss);
  (b as any).bossAttack(boss);
  ok(boss.x === hx && boss.y === hy, 'first two attacks stay put');
  (b as any).bossAttack(boss);
  ok(boss.x !== hx || boss.y !== hy, 'every 3rd attack teleports the boss');

  for (const m of secondEscorts) m.dead = true;
  boss.sash = false;
  boss.lastStand = false;
  (b as any).hurt(boss, boss.maxHp * 2, '#fff');
  ok(
    boss.dead && boss.sumStage === 2 && !(b as any).barBreak &&
      ((b as any).rewardPending || b.phase === 'won' || b.phase === 'loot' || b.phase === 'reward'),
    'last bar can KO the boss and clear the wave',
  );
}

// --- Boss phases: readable weak faces, rage, guards and gauge reset ---
{
  const b: any = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  b.spawnWave(2);
  b.theme = 'grove';
  const boss = b.enemies.find((e: any) => e.boss);
  b.enemies = [boss];
  boss.relic = undefined;
  const stats = { ...boss.def.stats };
  const faces = [boss.weakA];
  ok(!boss.enraged && !boss.phaseRage, 'normal boss starts without final-bar rage');
  const face = boss.weakA;
  b.relocateBoss(boss);
  ok(boss.weakA === face, 'boss teleport keeps the current bar weak face');
  for (let bar = 1; bar <= 2; bar++) {
    boss.shieldN = 0;
    boss.bigT = 1;
    b.hurt(boss, boss.maxHp * 2, '#fff');
    const hp = b.players.map((p: any) => p.hp);
    boss.bigT = 0;
    b.bossBigAttack(boss);
    ok(b.players.every((p: any, i: number) => p.hp === hp[i]), `bar ${bar} break cancels a due big move`);
    b.endShot();
    faces.push(boss.weakA);
    ok(boss.bigT === 7 && b.pendingBig.length === 0, `bar ${bar + 1} resets the big countdown and pending attacks`);
    ok(b.telop.texts().includes('WEAK SPOT MOVED'), `bar ${bar + 1} telegraphs its new weak face`);
    const guards = b.enemies.filter((e: any) => e.minion && e.shieldN >= 2);
    ok(guards.length === bar && guards.every((e: any) => e.def.type === boss.def.type || EVO_LINES.some((l) => l.ids.includes(boss.def.id) && l.ids.includes(e.def.id))), `bar ${bar + 1} brings ${bar} matching Reflect guards`);
    ok(b.enemies.filter((e: any) => !e.dead).length <= 5, `bar ${bar + 1} respects the five-foe cap`);
    if (bar === 1) ok(!boss.phaseRage && !boss.enraged && boss.def.stats.atk === stats.atk, 'bar two has no rage or stat boost');
  }
  ok(new Set(faces).size === 3 && Math.abs((faces[1] - faces[0] + Math.PI * 2) % (Math.PI * 2) - Math.PI * 2 / 3) < 1e-9, 'weak face rotates 120 degrees on each bar');
  ok(boss.phaseRage && boss.enraged && boss.def.stats.atk === Math.round(stats.atk * 1.2) && boss.def.stats.spa === Math.round(stats.spa * 1.2), 'last bar starts rage with a 20% offensive stat bump');
  const baseClocks = foeClocks(boss.def.type, true, 2);
  ok(boss.clocks.every((c: any, i: number) => c.turn === Math.max(1, baseClocks[i].turn - 1) && c.t === Math.max(1, baseClocks[i].first - 1)), 'rage shortens all move clocks by one turn');
  ok(b.enemyReload(boss) === (boss.def.melee ? 1 : 2), 'rage basic clock loses one turn with a one-turn floor');
  ok(b.telop.texts().includes('RAGE'), 'last bar announces RAGE through the banner queue');
  const rageAtk = boss.def.stats.atk;
  b.enrageBoss(boss);
  ok(boss.def.stats.atk === rageAtk, 'rage cannot stack its stats twice');
  while (b.enemies.length < 5) b.enemies.push({ ...boss, boss: false, minion: true });
  const count = b.enemies.length;
  b.summonBossAdds(boss, []);
  ok(b.enemies.length === count, 'summoning into a full enemy roster adds nothing');

  b.enemies = [boss];
  boss.timer = 100;
  boss.clocks = [];
  boss.bigT = 3;
  for (let turn = 1; turn <= 3; turn++) {
    b.phase = 'shot';
    b.endShot();
    ok(boss.bigT === 3 - turn && b.pendingBig.length === (turn === 3 ? 1 : 0), `big move countdown resolves exactly on turn three, tick ${turn}`);
  }
  ok(!b.telop.texts().includes('FOE TURN'), 'per-attacker FOE TURN banners stay silent — the countdown carries it');
  clearAnims();
  const hp = b.players.map((p: any) => p.hp);
  b.bossBigAttack(boss);
  ok(b.players.every((p: any, i: number) => p.dead || p.hp < hp[i]), 'signature big move damages every living team member');
  ok(boss.bigT === 7 && animCount() > 0, 'big move plays Gen 3 recipe visuals and reloads');
  clearAnims();
  const after = b.players.map((p: any) => p.hp);
  b.bossBigAttack(boss);
  ok(b.players.every((p: any, i: number) => p.hp === after[i]), 'a stale big-move callback cannot fire after the counter resets');

  for (const def of BOSS_POOL) {
    const guardBattle: any = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
    const ace = guardBattle.makeEnemy({ def, boss: true, nx: 0.5, ny: 0.2 }, 2);
    ace.sumStage = 2;
    guardBattle.enemies = [ace];
    guardBattle.summonBossAdds(ace, [{ nx: 0.25, ny: 0.3 }, { nx: 0.75, ny: 0.3 }]);
    ok(guardBattle.enemies.length === 3 && guardBattle.enemies.slice(1).every((e: any) => e.shieldN >= 2 && e.def.type === def.type), `${def.name} summons two type-matched Reflect guards`);
    guardBattle.enemies.push({ ...ace, boss: false });
    guardBattle.summonBossAdds(ace, []);
    ok(guardBattle.enemies.length === 5, `${def.name} reduces its summon to one when only one slot remains`);
  }
}

// --- MS attack clocks + type moves ---
{
  const electric = foeClocks('electric', false, 0);
  ok(electric.length === 1 && electric[0].kind === 'laser' && electric[0].move === 'THUNDERBOLT',
    'fodder gets its electric laser move');
  ok(TYPES.every((type) => TYPE_MOVE[type]), 'every canonical type has a foe move');
  ok(
    foeClocks('electric', true, 0).length === 1 &&
      foeClocks('electric', true, 1).length === 2 &&
      foeClocks('electric', true, 2).length === 3,
    'boss bars add one attack clock each',
  );

  const spawned = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (spawned as any).spawnWave(0);
  const spawnedFoe = spawned.enemies.find((e) => !e.def.fuse)!;
  const initialClock = spawnedFoe.clocks[0];
  ok(initialClock.t === foeClocks(spawnedFoe.def.type, false, 0)[0].first,
    'spawned foe clocks start at first_attack_turn');

  const dual = foeClocks('ghost', false, 0, 'poison');
  ok(dual.length === 2 && dual[1].kind === TYPE_MOVE.poison.kind && dual[1].move === TYPE_MOVE.poison.move &&
    dual[1].turn > dual[0].turn && dual[1].first > dual[0].first && dual[1].type === 'poison',
    'dual-type foes carry a slower second-typing clock');
  const dualFoe = (spawned as any).makeEnemy({ def: speciesById(93)!, nx: 0.5, ny: 0.5, lvl: 10 }, 0);
  ok(dualFoe.clocks.length === 2 && dualFoe.clocks[1].move === 'SLUDGE WAVE' && dualFoe.clocks[1].t === dual[1].first,
    'spawned dual-type foe fields both wind-ups');

  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(0);
  const foe = b.enemies.find((e) => !e.def.fuse)!;
  for (const other of b.enemies) if (other !== foe) other.dead = true;
  foe.timer = 100;
  const clock = { kind: 'laser' as const, move: 'THUNDERBOLT', turn: 3, t: 3 };
  foe.clocks = [clock];
  const endClockTurn = () => {
    (b as any).phase = 'shot';
    (b as any).endShot();
  };
  endClockTurn();
  ok((b as any).pendingMoves.length === 0, 'three-turn clock waits after turn one');
  endClockTurn();
  ok((b as any).pendingMoves.length === 0, 'three-turn clock waits after turn two');
  endClockTurn();
  ok((b as any).pendingMoves.some((m: any) => m.e === foe && m.c === clock) && clock.t === 3,
    'three-turn clock queues and reloads on turn three');

  const first = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (first as any).spawnWave(0);
  const firstFoe = first.enemies.find((e) => !e.def.fuse)!;
  for (const other of first.enemies) if (other !== firstFoe) other.dead = true;
  firstFoe.timer = 100;
  const delayed = { kind: 'laser' as const, move: 'THUNDERBOLT', turn: 1, t: 3 };
  firstFoe.clocks = [delayed];
  for (let i = 0; i < 2; i++) {
    (first as any).phase = 'shot';
    (first as any).endShot();
    ok((first as any).pendingMoves.length === 0, `first attack delay holds on turn ${i + 1}`);
  }
  (first as any).phase = 'shot';
  (first as any).endShot();
  ok((first as any).pendingMoves.some((m: any) => m.c === delayed),
    'first attack delay fires on turn three');

  const laser = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (laser as any).spawnWave(0);
  const laserFoe = laser.enemies[0];
  for (const other of laser.enemies) if (other !== laserFoe) other.dead = true;
  laserFoe.x = 200; laserFoe.y = 400;
  const [laserHit, laserMiss, ...laserRest] = laser.players;
  for (const p of laserRest) p.dead = true;
  laserHit.x = 300; laserHit.y = 400;
  laserMiss.x = 300; laserMiss.y = 500;
  const laserHp = [laserHit.hp, laserMiss.hp];
  (laser as any).fireMove(laserFoe, { kind: 'laser', move: 'THUNDERBOLT', turn: 3, t: 1 });
  ok(laserHit.hp < laserHp[0] && laserMiss.hp === laserHp[1], 'laser hits its line and spares the off-line player');

  const cross = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (cross as any).spawnWave(0);
  const crossFoe = cross.enemies[0];
  for (const other of cross.enemies) if (other !== crossFoe) other.dead = true;
  crossFoe.x = 200; crossFoe.y = 400;
  const [crossHit, crossMiss, ...crossRest] = cross.players;
  for (const p of crossRest) p.dead = true;
  crossHit.x = 200; crossHit.y = 500;
  crossMiss.x = 300; crossMiss.y = 500;
  const crossHp = [crossHit.hp, crossMiss.hp];
  (cross as any).fireMove(crossFoe, { kind: 'cross', move: 'PSYBEAM', turn: 3, t: 1 });
  ok(crossHit.hp < crossHp[0] && crossMiss.hp === crossHp[1], 'cross hits vertical alignment and spares unaligned player');

  const quake = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (quake as any).spawnWave(0);
  const quakeFoe = quake.enemies[0];
  for (const other of quake.enemies) if (other !== quakeFoe) other.dead = true;
  quakeFoe.x = 200; quakeFoe.y = 400;
  const [quakeHit, quakeMiss, ...quakeRest] = quake.players;
  for (const p of quakeRest) p.dead = true;
  quakeHit.x = 220; quakeHit.y = 400;
  quakeMiss.x = 430; quakeMiss.y = 400;
  const quakeHp = [quakeHit.hp, quakeMiss.hp];
  (quake as any).fireMove(quakeFoe, { kind: 'quake', move: 'EARTHQUAKE', turn: 3, t: 1 });
  for (let i = 0; i < 4; i++) quake.update(0.2);
  ok(quakeHit.hp < quakeHp[0] && quakeMiss.hp === quakeHp[1], 'quake ring damages inside QUAKE_R only');

  const bossBattle = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (bossBattle as any).spawnWave(2);
  const boss = bossBattle.enemies.find((e) => e.boss)!;
  boss.sash = false;
  (bossBattle as any).hurt(boss, Math.ceil(boss.maxHp * 0.5), '#fff');
  (bossBattle as any).endShot();
  ok(boss.sumStage === 1 && boss.clocks.length === 2 &&
    boss.clocks.every((c, i) => c.kind === foeClocks(boss.def.type, true, 1)[i].kind &&
      c.move === foeClocks(boss.def.type, true, 1)[i].move &&
      c.t === foeClocks(boss.def.type, true, 1)[i].first),
  'first boss bar break loads the two-clock bar-one set');

  const asleep = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (asleep as any).spawnWave(0);
  const sleepingFoe = asleep.enemies[0];
  for (const other of asleep.enemies) if (other !== sleepingFoe) other.dead = true;
  sleepingFoe.asleep = true;
  sleepingFoe.timer = 100;
  const sleepingClock = { kind: 'laser' as const, move: 'THUNDERBOLT', turn: 3, t: 3 };
  sleepingFoe.clocks = [sleepingClock];
  (asleep as any).phase = 'shot';
  (asleep as any).endShot();
  ok(sleepingClock.t === 3 && (asleep as any).pendingMoves.length === 0,
    'asleep foe clocks do not tick');
}

// --- MS heavy boss clock ---
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2);
  const boss = b.enemies.find((e) => e.boss)!;
  for (const e of b.enemies) if (!e.boss) e.dead = true;
  for (const p of b.players) p.hp = p.maxHp;
  const hpBefore = b.players.map((p) => p.hp);
  boss.timer = 100;
  boss.paraT = 3;
  (boss as any).bigT = 1;
  (b as any).endShot();
  ok(((b as any).pendingBig ?? []).includes(boss), 'heavy clock queues a boss attack at zero');
  (b as any).resolveEnemyTurn();
  b.update(0.5);
  ok(b.players.every((p, i) => p.dead || p.hp < hpBefore[i]), 'heavy attack hits every living player through para');
  ok((boss as any).bigT === 7, 'heavy attack reloads its clock');
}

{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2);
  const boss = b.enemies.find((e) => e.boss)!;
  boss.asleep = true;
  boss.timer = 4;
  (boss as any).bigT = 4;
  (b as any).endShot();
  ok(boss.timer === 4 && (boss as any).bigT === 4, 'sleep freezes both boss clocks');
}

// --- MS mechanics: weak point, minion guard, strike shot, mines, volatile ---
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2);
  const boss = b.enemies.find((e) => e.boss)!;
  // drop the entourage — a taunt minion (Shuckle & co.) would toll-booth
  // the boss's contact hits and the weak-point check would read 0
  for (const e of b.enemies) if (!e.boss) e.dead = true;

  // weak point: contact on the marked face pays triple
  const u = b.players[0];
  boss.weakA = -Math.PI / 2; // face up
  u.x = boss.x;
  u.y = boss.y - boss.r - u.r - 4;
  const bhp0 = boss.hp;
  (b as any).strikeEnemy(u, boss);
  const weakD = bhp0 - boss.hp;
  (b as any).time += 1; // clear the hit cooldown
  boss.weakA = Math.PI / 2; // face away
  boss.hp = bhp0;
  (b as any).strikeEnemy(u, boss);
  const flatD = bhp0 - boss.hp;
  ok(weakD > flatD * 2, `weak point pays ~3x (${flatD} → ${weakD})`);

  const regularDamage = (angle: number) => {
    const run = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(11));
    (run as any).spawnWave(0);
    const foe = run.enemies.find((e) => !e.boss && !e.def.shielded)!;
    for (const other of run.enemies) if (other !== foe) other.dead = true;
    foe.weakA = 0;
    foe.shieldN = 0;
    const striker = run.players[0];
    striker.x = foe.x + Math.cos(angle) * (foe.r + striker.r + 4);
    striker.y = foe.y + Math.sin(angle) * (foe.r + striker.r + 4);
    striker.vx = 0;
    striker.vy = 0;
    const hp = foe.hp;
    (run as any).strikeEnemy(striker, foe);
    return { run, foe, damage: hp - foe.hp };
  };
  const regularWeak = regularDamage(0);
  const regularFlat = regularDamage(Math.PI);
  ok(
    regularWeak.damage > 0 && Math.abs(regularWeak.damage - regularFlat.damage * 2) <= 1,
    `regular weak point doubles contact (${regularFlat.damage} → ${regularWeak.damage})`,
  );
  regularWeak.foe.def = { ...regularWeak.foe.def, shielded: true };
  const weakHit = (regularWeak.run as any).weakHit;
  ok(
    typeof weakHit === 'function' && !weakHit.call(
      regularWeak.run,
      regularWeak.foe,
      regularWeak.foe.x + regularWeak.foe.r,
      regularWeak.foe.y,
    ),
    'shielded regular foe has no weak point',
  );

  // minion guard: summoned adds halve boss damage until they die
  const b2 = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b2 as any).spawnWave(2);
  const boss2 = b2.enemies.find((e) => e.boss)!;
  (b2 as any).hurt(boss2, Math.ceil(boss2.maxHp * 0.5), '#fff');
  (b2 as any).endShot();
  const mhp0 = boss2.hp;
  (b2 as any).hurt(boss2, 100, '#fff');
  const dGuarded = mhp0 - boss2.hp;
  for (const m of b2.enemies.filter((e) => e.minion)) m.dead = true;
  boss2.hp = mhp0;
  (b2 as any).hurt(boss2, 100, '#fff');
  const dOpen = mhp0 - boss2.hp;
  ok(dGuarded === Math.max(1, Math.round(dOpen * 0.5)), `minion guard halves boss damage (${dGuarded} vs ${dOpen})`);

  // strike shot: launching with a ready super spends its cooldown
  const b3 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const u3 = (b3 as any).active;
  u3.cd = 0;
  b3.phase = 'aim';
  b3.pointerDown({ x: u3.x, y: u3.y });
  b3.pointerMove({ x: u3.x - 120, y: u3.y });
  b3.pointerUp();
  ok(u3.cd > 0, `strike shot spends the super on launch (cd ${u3.cd})`);

  // long-range supers: fire lobs homing fireballs at the far pack, and
  // electric's chain leaves visible arcs (Vulpix/Mareep — signature-free, so
  // they fire the generic type supers these asserts read)
  {
    const bf = new Battle(arena, [speciesById(37)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (bf as any).spawnWave(0);
    const fp = bf.players[0];
    fp.cd = 0;
    (bf as any).bumpAlly(fp, fp);
    ok((bf as any).orbs.length === 3, `fire volley launches 3 homing orbs (${(bf as any).orbs.length})`);
    // cast motes: every super scatters element-flavored fx — embers for
    // fire rise against gravity
    ok((bf as any).fx.some((f: any) => f.grav < 0), 'fire cast scatters rising embers');

    const be = new Battle(arena, [speciesById(179)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (be as any).spawnWave(0);
    const ep = be.players[0];
    ep.cd = 0;
    (be as any).bumpAlly(ep, ep);
    // the arcs are scheduled a beat apart — drain the delay queue
    for (const d of [...(be as any).delays]) d.fn();
    ok((be as any).beams.length > 0, `chain lightning draws its arcs (${(be as any).beams.length})`);

    // signature nukes: Dragonite's HYPER BEAM is a piercing line, not the
    // generic flying pull — foes on the ray take damage, off it don't
    const bd = new Battle(arena, [ROSTER[1], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
    (bd as any).spawnWave(0);
    const dp = bd.players[0];
    dp.def = { ...dp.def, id: 149, name: 'Dragonite' };
    dp.cd = 0;
    // line three foes up on the beam path: caster at left, targets east
    dp.x = 60; dp.y = 400;
    bd.enemies.forEach((e, i) => { e.x = 200 + i * 60; e.y = 400; e.vx = e.vy = 0; e.shieldN = 0; });
    const hps = bd.enemies.map((e) => e.hp);
    (bd as any).bumpAlly(dp, dp);
    ok((bd as any).beams.length > 0 && (bd as any).beams[0].w! > 2, 'hyper beam fires the fat line');
    ok(bd.enemies.every((e, i) => e.hp < hps[i]), 'hyper beam pierces every foe on the line');
    // a foe parked behind the caster stays untouched
    (bd as any).spawnWave(0);
    const behind = bd.enemies[0];
    behind.x = dp.x - 80; behind.y = dp.y;
    bd.enemies.forEach((e, i) => { if (i > 0) { e.x = 500; e.y = 800; } });
    dp.cd = 0;
    const bhp = behind.hp;
    (bd as any).bumpAlly(dp, dp);
    ok(behind.hp === bhp, 'hyper beam spares foes behind the caster');
  }

  // mines: ball contact detonates — the blast SHOVES foes but never
  // damages them (enemies take no environment damage)
  const b4 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b4 as any).spawnWave(0);
  const e4 = b4.enemies[0];
  // the ball detonates the pad without touching the foe — any hp loss
  // would be the blast itself, not a contact hit
  const mx = e4.x + e4.r + 45;
  (b4 as any).hazards = [{ kind: 'mine', x: mx, y: e4.y, r: 30 }];
  const e4hp = e4.hp;
  const u4 = (b4 as any).active;
  // ball (r 26) parked just off the foe — touching it would deal contact
  // damage and muddle what the blast does
  u4.x = mx + 14;
  u4.y = e4.y;
  u4.vx = 0;
  u4.vy = 0;
  (b4 as any).stepShot(1 / 60);
  ok(b4.hazards[0].spent === true, 'mine detonates on ball contact');
  ok(e4.hp === e4hp, `mine blast can't hurt foes (${e4.hp})`);
  ok(Math.hypot(e4.vx, e4.vy) > 50, `mine blast shoves foes (v ${Math.round(Math.hypot(e4.vx, e4.vy))})`);

  // volatile: a KO splashes neighbors and can chain
  const b5 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b5 as any).spawnWave(0);
  const v1 = b5.enemies[0];
  const v2 = b5.enemies[1];
  v1.shieldN = v2.shieldN = 0;
  v1.volatile = true;
  v2.x = v1.x + 30;
  v2.y = v1.y;
  const v2hp = v2.hp;
  (b5 as any).hurt(v1, v1.hp + 50, '#fff');
  ok(v2.hp < v2hp, `volatile KO splashes neighbors (${v2hp} → ${v2.hp})`);

  // wave mutators: enough seeds roll affixes on non-boss waves
  let mods = 0;
  let newMods = 0;
  for (let s = 1; s <= 60; s++) {
    const bm = new Battle(arena, team(), makeStage(s), mulberry32(s * 7));
    (bm as any).spawnWave(1);
    const banner = (bm as any).waveSpecial ?? '';
    if (/SWARM|HASTY|VOLATILE|BIG ONE|SHINY|CLERIC|GUARDIAN|STAY DOWN/.test(banner)) mods++;
    if (/WARDED|TAKE WING|SKITTER|HEXED|TAILWIND/.test(banner)) newMods++;
  }
  ok(mods > 3, `${mods}/60 seeds rolled a wave mutator`);
  ok(newMods > 0, `${newMods}/60 seeds rolled a new affix (warded/sky/skitter/hexed/tailwind)`);

  // warp: riding one pad spits the ball out its twin, velocity kept
  const b6 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b6 as any).spawnWave(0);
  (b6 as any).hazards = [
    { kind: 'warp', x: 200, y: 300, r: 30, pair: 1 },
    { kind: 'warp', x: 400, y: 200, r: 30, pair: 1 },
  ];
  const u6 = (b6 as any).active;
  u6.x = 200;
  u6.y = 300;
  u6.vx = 300;
  u6.vy = 0;
  (b6 as any).stepShot(1 / 60);
  ok(Math.abs(u6.x - 400) < 80 && Math.abs(u6.y - 200) < 80, `warp ports the ball to its twin (${Math.round(u6.x)},${Math.round(u6.y)})`);
  ok(Math.hypot(u6.vx, u6.vy) > 100, 'warp keeps the ball moving');

  // boost: crossing a pad speeds the ball up
  const b7 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b7 as any).spawnWave(0);
  (b7 as any).hazards = [{ kind: 'boost', x: 250, y: 300, r: 30 }];
  const u7 = (b7 as any).active;
  u7.x = 250;
  u7.y = 300;
  u7.vx = 500;
  u7.vy = 0;
  (b7 as any).stepShot(1 / 60);
  ok(u7.vx > 550, `boost pad re-launches the ball (${Math.round(u7.vx)})`);

  // well: a swimmer's ball gains velocity toward the core while inside —
  // landlocked balls bank off the surface instead
  const b8 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (b8 as any).spawnWave(0);
  (b8 as any).enemies = []; // the well's pull is what this tests — no spawn bumps the ball
  (b8 as any).hazards = [{ kind: 'well', x: 400, y: 300, r: 80 }];
  const u8 = (b8 as any).active;
  u8.def = speciesById(7); // Squirtle swims into the pull
  u8.x = 320;
  u8.y = 300;
  u8.vx = 0;
  u8.vy = 0;
  for (let i = 0; i < 10; i++) (b8 as any).stepShot(1 / 60);
  ok(u8.vx > 5, `gravity well drags the ball inward (vx ${Math.round(u8.vx)})`);

  // ponds & pools are walls to landlocked mons — swimmers, flyers and
  // hoverers cross, everything else banks off the surface
  const bw = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(5));
  (bw as any).spawnWave(0);
  (bw as any).hazards = [{ kind: 'static', x: 300, y: 300, r: 60 }];
  const uw = (bw as any).active;
  uw.def = speciesById(4); // Charmander can't swim
  uw.x = 300 - 60 - uw.r + 6; // nose already over the surface
  uw.y = 300;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx < 0 && Math.hypot(uw.x - 300, uw.y - 300) >= uw.r + 60 - 0.5, `pond banks a land ball (vx ${Math.round(uw.vx)})`);
  uw.def = speciesById(7); // Squirtle swims
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `water type swims across (x ${Math.round(uw.x)})`);
  uw.def = speciesById(92); // Gastly hovers — no water/flying type needed
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `floating mon hovers across (x ${Math.round(uw.x)})`);
  // landlocked foes can't stand in the pond either
  const ew = bw.enemies.find((e) => !e.dead);
  ew.def = speciesById(4);
  ew.x = 310;
  ew.y = 300;
  (bw as any).stepEnemyMovement(1 / 60);
  ok(Math.hypot(ew.x - 300, ew.y - 300) >= ew.r + 60 - 0.5, `landlocked foe is ejected to the shore (d ${Math.round(Math.hypot(ew.x - 300, ew.y - 300))})`);

  // spikes are boulder walls: land bodies bank off, flyers clear the
  // strip, and pressing into the rim still chips like a damage wall
  (bw as any).hazards = [{ kind: 'spikes', x: 300, y: 300, r: 60 }];
  uw.def = speciesById(4); // Charmander can't climb boulders
  uw.x = 300 - 60 - uw.r + 6;
  uw.y = 300;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx < 0 && Math.hypot(uw.x - 300, uw.y - 300) >= uw.r + 60 - 0.5, `spike boulders bank a land ball (vx ${Math.round(uw.vx)})`);
  uw.def = speciesById(16); // Pidgey flies over the strip
  uw.x = 300 - 60 - uw.r - 8;
  uw.vx = 400;
  uw.vy = 0;
  (bw as any).stepShot(1 / 60);
  ok(uw.vx > 0 && uw.x > 300 - 60 - uw.r - 8, `flying mon clears the boulders (x ${Math.round(uw.x)})`);
  uw.def = speciesById(4);
  uw.x = 300 - 60 - uw.r + 6; // nose already over the rim
  uw.vx = 60;
  uw.vy = 0;
  uw.hzT = -1;
  const hpw = uw.hp;
  (bw as any).stepShot(1 / 60);
  ok(uw.hp < hpw, `grinding into the boulders still chips (hp ${hpw} → ${uw.hp})`);
  ew.def = speciesById(4);
  ew.x = 300;
  ew.y = 300;
  (bw as any).stepEnemyMovement(1 / 60);
  ok(Math.hypot(ew.x - 300, ew.y - 300) >= ew.r + 60 - 0.5, `landlocked foe banks off the boulders (d ${Math.round(Math.hypot(ew.x - 300, ew.y - 300))})`);

  // aegis: the guardian wards an ally, and the ward eats one whole hit
  const b9 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b9 as any).spawnWave(0);
  const g9 = b9.enemies[0];
  const w9 = b9.enemies[1];
  b9.enemies.forEach((e) => { e.shieldN = 0; });
  g9.supp = 'aegis';
  w9.hp = Math.floor(w9.maxHp * 0.4); // weakest → the ward target
  (b9 as any).pendingAttacks = [g9];
  (b9 as any).resolveEnemyTurn();
  for (const d of [...(b9 as any).delays]) d.fn(); // the volley fires on beats
  ok(w9.shieldN === 1, 'aegis wards the weakest ally');
  const w9hp = w9.hp;
  (b9 as any).hurt(w9, 100, '#fff');
  ok(w9.hp === w9hp && w9.shieldN === 0, `ward eats a whole hit (hp ${w9hp} → ${w9.hp})`);

  // cleric: the medic patches its most-wounded ally instead of attacking
  const b10 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b10 as any).spawnWave(0);
  const m10 = b10.enemies[0];
  const h10 = b10.enemies[1];
  m10.supp = 'medic';
  h10.hp = Math.floor(h10.maxHp * 0.5);
  const h10hp = h10.hp;
  (b10 as any).pendingAttacks = [m10];
  (b10 as any).resolveEnemyTurn();
  for (const d of [...(b10 as any).delays]) d.fn(); // the volley fires on beats
  ok(h10.hp > h10hp, `medic heals the pack (${h10hp} → ${h10.hp})`);

  // zombie loop: fell one while its partner stands → it rises at 40%;
  // both down in the same shot → the pair stays down for good
  const b11 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b11 as any).spawnWave(0);
  const z1 = b11.enemies[0];
  const z2 = b11.enemies[1];
  z1.shieldN = z2.shieldN = 0;
  z1.link = z2;
  z2.link = z1;
  z1.revives = z2.revives = 2;
  (b11 as any).hurt(z1, z1.hp + 1, '#fff');
  (b11 as any).endShot();
  ok(!z1.dead && z1.revives === 1 && z1.hp > 0, `zombie rises at partial hp (${z1.hp})`);
  (b11 as any).hurt(z1, z1.hp + 1, '#fff');
  (b11 as any).hurt(z2, z2.hp + 1, '#fff');
  (b11 as any).endShot();
  ok(z1.dead && z2.dead, 'double-kill breaks the zombie loop');

  // skull mark: the KO pays a bounty — score pop + team heal
  const b12 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b12 as any).spawnWave(0);
  const sk = b12.enemies[0];
  sk.shieldN = 0;
  sk.skull = true;
  const s0 = b12.score;
  b12.players[0].hp = 10;
  (b12 as any).hurt(sk, sk.hp + 1, '#fff');
  ok(b12.score - s0 >= 150, `skull bounty pays +150 on top of the KO (${b12.score - s0})`);
  ok(b12.players[0].hp > 10, `skull bounty heals the team (${b12.players[0].hp})`);

  // gravity aura: a ball inside the carrier's bubble bleeds speed
  const b13 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b13 as any).spawnWave(0);
  const g13 = b13.enemies[0];
  const u13 = (b13 as any).active;
  u13.x = g13.x + 130; // inside the aura, clear of the sprite
  u13.y = g13.y;
  g13.gravR = 160;
  u13.vx = 600;
  u13.vy = 0;
  for (let i = 0; i < 12; i++) (b13 as any).stepShot(1 / 60);
  ok(u13.vx < 500, `gravity aura drags the ball (vx ${Math.round(u13.vx)})`);

  // victory loot: the fountain mixes coins with rare drops, and scooping
  // pays score into the running tally
  const b14 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b14 as any).spawnWave(0);
  (b14 as any).enterLoot();
  const kinds = new Set((b14 as any).lootCoins.map((c: any) => c.kind));
  ok(kinds.has('coin') && kinds.has('gem') && kinds.has('heart') && kinds.has('candy'),
    `loot fountain mixes all kinds (${[...kinds].join(',')})`);
  ok((b14 as any).lootCoins.length >= 24, `fountain size scales (${(b14 as any).lootCoins.length} pieces)`);
  // park a mon mid-fountain and let the sim scoop whatever drifts through —
  // coins land at one origin first, so several can vacuum in a single tick
  const mon = b14.players[0];
  mon.x = arena.x + arena.w / 2;
  mon.y = arena.y + arena.h / 2;
  const s14 = b14.score;
  for (let i = 0; i < 30; i++) (b14 as any).stepLoot(1 / 60);
  ok(b14.score > s14 && (b14 as any).lootGot > 0, `scooping pays into the tally (score +${b14.score - s14})`);
  ok((b14 as any).lootCoins.length < 30, `coins get collected (left: ${(b14 as any).lootCoins.length})`);
}

// --- gym boss relic + egg hatch ---------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (b as any).spawnWave(2); // seeded gym wave
  const boss = b.enemies.find((e) => e.boss);
  ok(!!boss?.relic, `gym boss carries a held item (${boss?.relic})`);
  const c = new Battle(arena, team(), makeStage(50, 'T'), mulberry32(8));
  c.eggIn = 1;
  const box0 = c.box.length;
  (c as any).tickEgg();
  ok(c.eggIn === 0 && c.box.length === box0 + 1, `egg hatches into the box (${c.box[c.box.length - 1]?.name})`);
}

// --- choice events: the row waits for a pick, options do what they say -------
{
  const b = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  // salesman: paying lands a relic, walking away clears the row
  const s0 = 500;
  b.score = s0;
  const items0 = b.heldItems.length;
  const sale = rollEventChoices(b, 'PAY 300 SCORE');
  ok(sale !== null, 'salesman choice surfaced');
  if (sale) {
    sale.run(b);
    ok(b.score === s0 - 300, `paying the salesman costs score (${s0} → ${b.score})`);
    ok(b.heldItems.length === items0 + 1, 'the mystery box pays a relic');
  }
  // shrine: the offer trades hp for levels
  const shrine = rollEventChoices(b, 'OFFER 15% HP · +2 LEVELS');
  ok(shrine !== null, 'shrine choice surfaced');
  if (shrine) {
    const p = b.players[0];
    // pin mid-level — the level-up heal scales ~1/lvl, so a low-lvl mon
    // would net-gain hp and the trade reads backwards
    p.lvl = 40;
    p.hp = p.maxHp;
    const hp0 = p.hp;
    const lv0 = p.lvl;
    shrine.run(b);
    ok(p.hp < hp0 && p.lvl === lv0 + 2, `shrine trades hp for levels (lv${lv0} → ${p.lvl})`);
  }
}

// --- gamble events: the slots take real score, the boulder is a coin flip ---
{
  // game corner: across seeds the wager busts, pays out, and refuses a broke wallet
  let bust = false, paid = false;
  for (let s = 0; s < 60 && !(bust && paid); s++) {
    const bb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(300 + s));
    bb.score = 500;
    const spin = rollEventChoices(bb, 'SPIN THE REELS');
    if (!spin) continue;
    const s0 = bb.score;
    spin.run(bb);
    if (bb.score === s0 - 200) bust = true;
    if (bb.score > s0 - 200 || bb.heldItems.length) paid = true;
  }
  ok(bust, 'the slots can eat the 200 stake');
  ok(paid, 'the slots can pay out (score or relic)');
  const broke = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(9));
  broke.score = 100;
  rollEventChoices(broke, 'SPIN THE REELS')?.run(broke);
  ok(broke.score === 100, 'the slots refuse a wallet under 200');

  // fossil smash: the boulder hides a boxed fossil or a rocky squatter
  const FOSSILS = new Set([138, 140, 142, 345, 347, 369, 408, 410]);
  let dug = false, woke = false, poolOk = true;
  for (let s = 0; s < 60 && !(dug && woke); s++) {
    const bb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(400 + s));
    (bb as any).spawnWave(0); // waveIndex feeds the fossil's level
    const smash = rollEventChoices(bb, 'SMASH THE BOULDER');
    if (!smash) continue;
    const box0 = bb.box.length;
    const out = smash.run(bb);
    if (out.wave) { woke = true; continue; }
    if (bb.box.length === box0 + 1) {
      dug = true;
      if (!FOSSILS.has(bb.box[bb.box.length - 1].id)) poolOk = false;
    }
  }
  ok(dug, 'the boulder can hide a fossil mon in the box');
  ok(woke, 'the boulder can wake a rocky squatter');
  ok(poolOk, 'boxed fossils come from the fossil pool');

  // macho-brace drills: the ace bleeds, the whole team levels
  const tb = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(77));
  const drills = rollEventChoices(tb, 'TRAIN · ACE -25% HP, ALL +1 LV');
  ok(drills !== null, 'boot-camp drills surfaced in the pool');
  if (drills) {
    const ace = tb.players.filter((p) => !p.dead).sort((a, z) => z.lvl - a.lvl)[0];
    const hp0 = ace.hp;
    const lv0 = tb.players.map((p) => p.lvl);
    drills.run(tb);
    ok(ace.hp < hp0, `the ace pays in sweat (hp ${hp0} → ${ace.hp})`);
    ok(tb.players.every((p, i) => p.lvl === lv0[i] + 1), 'everyone +1 level');
  }
  // the gate: nobody standing, no drills — re-kill each roll since the
  // hidden spring event revives the team mid-loop
  const corpses = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(42));
  const kill = () => { for (const p of corpses.players) { p.dead = true; p.hp = 0; } };
  kill();
  let gated = true;
  for (let i = 0; i < 150 && gated; i++) {
    const out = rollEvent(corpses);
    if (out.choices?.options.some((o) => o.label === 'TRAIN · ACE -25% HP, ALL +1 LV')) gated = false;
    kill();
  }
  ok(gated, 'drills stay out of the pool when nobody can train');
}

// --- gated route events: berries, tutors, daycare, trades, and the Trick House ---
{
  const eventBattle = (seed: number) => {
    const bb = new Battle(arena, team(), makeStage(seed, 'T'), mulberry32(seed));
    bb.mapNode = bb.regionMap.nodes.findIndex((n) => n.row >= 3);
    return bb;
  };
  const checkState = (bb: InstanceType<typeof Battle>, name: string) => {
    ok(
      bb.players.every((p) => Number.isFinite(p.hp) && p.hp >= 0 && p.hp <= p.maxHp) &&
        bb.box.length === bb.boxHp.length && bb.box.length === bb.boxLvl.length,
      `${name} keeps hp and box state valid`,
    );
  };
  const prompts = [
    'A BERRY TREE SAGS WITH FRUIT · PICK ONE.',
    'A MOVE TUTOR TEACHES ONE MON · ULT +4, STUDENT PAYS 30% HP.',
    'THE DAY CARE WILL RAISE ONE MON · BACK IN 2 STOPS, +2 LV.',
    'A LOST TRAINER WANTS A TRADE · ANY MON FOR ONE OF ITS TIER.',
    'THE TRICK MASTER HANDS YOU THE PRIZE · NOW BEAT HIS HOUSE.',
  ];
  const rowZero = new Battle(arena, team(), makeStage(70, 'T'), mulberry32(70));
  rowZero.mapNode = rowZero.regionMap.nodes.findIndex((n) => n.row === 0);
  let surfaced = false;
  for (let i = 0; i < 200; i++) {
    if (prompts.includes(rollEvent(rowZero).choices?.prompt ?? '')) surfaced = true;
  }
  ok(!surfaced, 'row 0 never rolls the five gated choice events');

  for (const [label, seed] of [
    ['ORAN · TEAM +25% HP', 71],
    ['SITRUS · WEAKEST TO FULL', 72],
    ['CHESTO · ULT +3', 73],
  ] as const) {
    const bb = eventBattle(seed);
    const option = rollEventChoices(bb, label);
    ok(option !== null, `${label} option surfaces`);
    if (option) {
      if (label.startsWith('ORAN')) for (const p of bb.players) p.hp = Math.floor(p.maxHp / 2);
      if (label.startsWith('SITRUS')) {
        for (const p of bb.players) p.hp = p.maxHp;
        bb.players[0].hp = Math.floor(bb.players[0].maxHp / 2);
      }
      if (label.startsWith('CHESTO')) bb.ultIn = 8;
      const hp = bb.players.map((p) => p.hp);
      const weakest = bb.players[0];
      const ult = bb.ultIn;
      option.run(bb);
      if (label.startsWith('ORAN'))
        ok(bb.players.every((p, i) => p.hp > hp[i]), 'Oran heals a hurt team');
      if (label.startsWith('SITRUS'))
        ok(weakest.hp === weakest.maxHp && bb.players.slice(1).every((p, i) => p.hp === hp[i + 1]), 'Sitrus fills only the weakest mon');
      if (label.startsWith('CHESTO')) ok(bb.ultIn === ult - 3, 'Chesto reduces ult charge by 3');
      checkState(bb, label);
    }
  }

  const tutor = eventBattle(74);
  const teach = rollEventChoices(
    tutor,
    / · ULT \+4 · -30% HP$/,
    'A MOVE TUTOR TEACHES ONE MON · ULT +4, STUDENT PAYS 30% HP.',
  );
  ok(teach !== null, 'Move Tutor student option surfaces');
  if (teach) {
    for (const p of tutor.players) p.hp = p.maxHp;
    const hp = tutor.players.map((p) => p.hp);
    tutor.ultIn = 8;
    teach.run(tutor);
    ok(tutor.players.some((p, i) => p.hp < hp[i]) && tutor.ultIn === 4, 'Move Tutor trades 30% hp for 4 ult shots');
    checkState(tutor, 'Move Tutor');
  }

  const daycare = eventBattle(75);
  const boxed = ROSTER[6];
  daycare.boxAdd({ ...boxed, lvl: 20 }, 1, false);
  const leave = rollEventChoices(
    daycare,
    /^LEAVE /,
    'THE DAY CARE WILL RAISE ONE MON · BACK IN 2 STOPS, +2 LV.',
  );
  ok(leave !== null, 'Day Care party option surfaces');
  if (leave) {
    daycare.box.length = 0;
    daycare.boxHp.length = 0;
    daycare.boxLvl.length = 0;
    daycare.boxAdd({ ...boxed, lvl: 20 }, 1, false);
    leave.run(daycare);
    ok(daycare.players.some((p) => p.def.id === boxed.id) && !!daycare.daycare && daycare.box.length === 0,
      'Day Care swaps in the boxed mon and holds the benched mon');
    checkState(daycare, 'Day Care deposit');
    const benched = daycare.daycare!.def;
    const daycareLvl = daycare.daycare!.lvl;
    const save = JSON.parse(JSON.stringify(daycare.snapshot()!));
    const resumed = new Battle(arena, team(), makeStage(76, 'T'), mulberry32(76));
    resumed.applySnapshot(save);
    ok(
      resumed.daycare?.def.id === benched.id && resumed.daycare.lvl === daycareLvl,
      'run snapshot restores daycare state',
    );
    const back = resumed.daycare!.back;
    resumed.mapNode = resumed.regionMap.nodes.findIndex((n) => n.row >= back);
    const returned = tickDaycare(resumed);
    ok(
      !!returned && resumed.daycare === null &&
        resumed.box.some((d, i) => d.id === benched.id && resumed.boxLvl[i] === Math.min(100, daycareLvl + 2)),
      'Day Care returns the mon to the box at +2 levels',
    );
    checkState(resumed, 'Day Care return');
  }

  const trade = eventBattle(77);
  const tradeOption = rollEventChoices(
    trade,
    /^TRADE /,
    'A LOST TRAINER WANTS A TRADE · ANY MON FOR ONE OF ITS TIER.',
  );
  ok(tradeOption !== null, 'Lost Trainer trade option surfaces');
  if (tradeOption) {
    const traded = trade.players.find((p) => p.def.name.toUpperCase() === tradeOption.label.slice(6))!;
    const oldId = traded.def.id;
    const oldTier = tierOf(traded.def);
    const oldLevel = traded.lvl;
    tradeOption.run(trade);
    ok(traded.def.id !== oldId && tierOf(traded.def) === oldTier && traded.lvl === oldLevel,
      'Lost Trainer gives a different mon of the same tier and level');
    checkState(trade, 'Lost Trainer');
  }

  const trick = eventBattle(78);
  const perks = trick.perkIds.length;
  const items = trick.heldItems.length;
  const house = rollEventChoices(trick, 'TAKE IT · FIGHT THE HOUSE');
  ok(house !== null, 'Trick House fight option surfaces');
  if (house) {
    const out = house.run(trick);
    ok(out.wave?.length === 4 && out.wave.filter((s) => s.boss).length === 1, 'Trick House fields one boss and three escorts');
    ok(trick.perkIds.length === perks + 1 && trick.heldItems.length === items + 1, 'Trick House grants one perk and held item');
    checkState(trick, 'Trick House');
  }
}

function rollEventChoices(b: InstanceType<typeof Battle>, label: string | RegExp, prompt?: string) {
  for (let i = 0; i < 200; i++) {
    const out = rollEvent(b);
    const opt = out.choices?.prompt === prompt || prompt == null
      ? out.choices?.options.find((o) => label instanceof RegExp ? label.test(o.label) : o.label === label)
      : undefined;
    if (opt) return opt;
  }
  return null;
}

// --- a corpse attacker never fires ------------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(7));
  (b as any).spawnWave(0);
  const dead = b.enemies[0];
  dead.dead = true;
  const p = b.players[0];
  const hp0 = p.hp;
  (b as any).pendingAttacks = [dead];
  (b as any).resolveEnemyTurn();
  for (const d of [...(b as any).delays]) d.fn();
  ok(p.hp === hp0, 'a mon killed in the windup never attacks');
}

// --- orbs die with their wave, perks retune the fielded team ----------------
{
  const bf = new Battle(arena, [speciesById(37)!, ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3));
  (bf as any).spawnWave(0);
  const fp = bf.players[0];
  fp.cd = 0;
  (bf as any).bumpAlly(fp, fp);
  ok((bf as any).orbs.length === 3, 'fire volley fields orbs');
  (bf as any).spawnWave(1);
  ok((bf as any).orbs.length === 0, 'orbs clear on the next wave');

  const bp = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  const p = bp.players[0];
  const cd0 = p.cdMax;
  PERKS.find((x) => x.id === 'claw')!.apply(bp);
  ok(p.cdMax < cd0, `quick claw retunes fielded cooldowns (${cd0} → ${p.cdMax})`);
  const cd1 = p.cdMax;
  PERKS.find((x) => x.id === 'pherb')!.apply(bp);
  ok(p.cdMax === Math.max(1, cd1 - 1), `power herb shaves a shot (${cd1} → ${p.cdMax})`);
}

// --- perk ticks: periodic clauses fire off battle-owned ids -------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  perkTick(b, 100); // zero perks: the loop is a silent no-op
  ok(b.players.every((p) => p.hp === p.maxHp), 'perkTick with zero perks stays silent');

  b.grantPerk(PERKS.find((p) => p.id === 'leftovers')!);
  const p = b.players[0];
  p.hp = Math.floor(p.maxHp / 2);
  const hp0 = p.hp;
  perkTick(b, 10); // under the 18s clock — nothing yet
  ok(p.hp === hp0, 'leftovers waits out its 18s clock');
  perkTick(b, 9); // 19s banked → one mend
  ok(p.hp > hp0, `leftovers mends on the clock (${hp0} → ${Math.round(p.hp)})`);

  // trigger conditions met, but the perks were never granted — nothing fires
  const sash0 = b.players.map((q) => q.sash).join();
  const crit0 = b.critCh;
  b.shots = 10;
  b.waveIndex = 4;
  b.players[1].cd = 3;
  perkTick(b, 30);
  ok(b.critCh === crit0 && b.players[1].cd === 3 && b.players.map((q) => q.sash).join() === sash0,
    "an un-owned perk's tick never fires");

  // focus sash re-weaves two stages after it armed
  const sb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  sb.grantPerk(PERKS.find((p) => p.id === 'sash')!);
  sb.players.forEach((q) => { q.sash = false; }); // spent in a fight
  sb.waveIndex = 1;
  perkTick(sb, 1); // first tick only learns the stage it armed on
  ok(sb.players.every((q) => !q.sash), 'sash stays spent inside the re-arm window');
  sb.waveIndex = 3;
  perkTick(sb, 1);
  ok(sb.players.every((q) => !q.sash), 'two stages on: still inside the window');
  sb.waveIndex = 4;
  perkTick(sb, 1);
  ok(sb.players.every((q) => q.sash), 'three stages on: sashes re-arm');

  // dire hit: crit surges through the 5th shot, hands it back on the 6th
  const db = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  db.grantPerk(PERKS.find((p) => p.id === 'direhit')!);
  const c0 = db.critCh;
  db.shots = 5;
  perkTick(db, 1);
  ok(db.critCh > c0, `5th shot rides a crit surge (${c0.toFixed(2)} → ${db.critCh.toFixed(2)})`);
  db.shots = 6;
  perkTick(db, 1);
  ok(Math.abs(db.critCh - c0) < 1e-9, 'the surge returns the crit after the shot');

  // ether: supers shave a charge every 25s
  const eb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  eb.grantPerk(PERKS.find((p) => p.id === 'ether')!);
  eb.players.forEach((q) => { q.cd = 2; });
  perkTick(eb, 30);
  ok(eb.players.every((q) => q.cd === 1), 'ether shaves a charge on the 25s clock');

  // soothe bell: a slow mend every 4s on top of the flat volley boost
  const so = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  so.grantPerk(PERKS.find((p) => p.id === 'soothebell')!);
  const sq = so.players[0];
  sq.hp = Math.floor(sq.maxHp / 2);
  const sq0 = sq.hp;
  perkTick(so, 4.1);
  ok(sq.hp > sq0, `soothe bell mends 2% on the 4s clock (${sq0} → ${Math.round(sq.hp)})`);

  // lucky egg: a 25-score trickle every 30s
  const le = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  le.grantPerk(PERKS.find((p) => p.id === 'luckyegg')!);
  const sc0 = le.score;
  perkTick(le, 30.1);
  ok(le.score === sc0 + 25, `lucky egg trickles +25 score on the 30s clock (${sc0} → ${le.score})`);

  // exp. share: the lowest living ally levels on the 60s clock
  const xs = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  xs.grantPerk(PERKS.find((p) => p.id === 'expshare')!);
  const xw = xs.players.reduce((a, z) => (a.lvl <= z.lvl ? a : z));
  const xl = xw.lvl;
  perkTick(xs, 60.1);
  ok(xw.lvl === xl + 1, `exp. share drips a level to the weakest ally (Lv${xl} → Lv${xw.lvl})`);
}

// --- a cancelled gesture never launches -------------------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const u = (b as any).active;
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerMove({ x: u.x - 150, y: u.y - 150 });
  b.pointerCancel();
  ok(b.phase === 'aim' && u.vx === 0 && u.vy === 0, 'pointercancel drops the drag, no shot');
}

// --- MS stage_phases: a wild stop strings battles before its reward ---------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(1);
  (b as any).battles = 3;
  b.phase = 'aim';
  const first = b.enemies.slice();
  for (const e of b.enemies) e.dead = true;
  b.enemies.length = 0;
  (b as any).waveCleared();
  ok((b as any).battle === 2 && !(b as any).rewardPending, 'a mid-stop clear loads battle 2, no reward yet');
  ok(b.enemies.length > 0 && b.enemies.length <= 5 && b.enemies.every((e) => !first.includes(e)), 'battle 2 brings a fresh pack of up to enemy_max');
  ok((b as any).foeDrop() === 0, 'the next battle scrolls in and drops its foes');
  b.enemies.length = 0;
  (b as any).phase = 'shot';
  (b as any).waveCleared();
  ok((b as any).battleBreak && (b as any).battle === 2, 'a clear inside a shot waits for endShot');
  (b as any).nextBattle();
  b.enemies.length = 0;
  b.phase = 'aim';
  (b as any).waveCleared();
  ok((b as any).battle === 3 && (b as any).rewardPending, 'the last battle pays the stop reward');
  const lens = new Set<number>();
  for (let s = 1; s <= 40; s++) {
    const c = new Battle(arena, team(), makeStage(s, 'T'), mulberry32(s));
    (c as any).spawnWave(1);
    if (!c.enemies.some((e) => e.boss) && !(c as any).inRival && !(c as any).inTrainer) lens.add((c as any).battles);
  }
  ok([...lens].every((n) => n >= 2 && n <= 4) && lens.size > 1, `skip_rate varies stop length (${[...lens].sort()})`);
}

// --- MS bonus_turn: a per-stop turn par pays SPEED CLEAR -----------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(1);
  const par = (b as any).par;
  ok(par >= 10 && par <= 24 && par === Math.max(10, (b as any).battles * 6), `stop par sits in MS's 10-24 range (${par})`);
  (b as any).battles = 1;
  (b as any).stopShots = par;
  const s0 = (b as any).score;
  (b as any).waveCleared();
  ok((b as any).waveSpecial.includes('SPEED CLEAR') && (b as any).score - s0 >= 100, 'clearing on par pays SPEED CLEAR');
  const c = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (c as any).spawnWave(1);
  (c as any).battles = 1;
  (c as any).stopShots = (c as any).par + 1;
  (c as any).waveCleared();
  ok(!(c as any).waveSpecial.includes('SPEED CLEAR'), 'one turn over par forfeits it');
  const g = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (g as any).spawnWave(2);
  ok((g as any).par === 14, `a gym stop gets the boss par (${(g as any).par})`);
}

// --- drop-in: foes stay off the court until the scroll lands them ----------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const u = (b as any).active;
  b.pointerDown({ x: u.x, y: u.y });
  ok(!(b as any).dragging && (b as any).foeDrop() === 0, 'no pull while the court scrolls in');
  (b as any).time += 1;
  ok((b as any).foeDrop() === 1, 'foes land once the scroll and drop finish');
}

// --- a tap on a foe pops its scout card, not a shot ---------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).courtT = -9; // court already settled
  b.phase = 'aim';
  const u = (b as any).active;
  const e = b.enemies[0];
  b.pointerDown({ x: e.x, y: e.y });
  b.pointerUp();
  ok((b as any).inspect?.uid === e.uid, 'tap on a foe opens the scout card');
  ok(b.phase === 'aim' && u.vx === 0, 'a scout tap never fires a shot');
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerUp();
  ok((b as any).inspect?.uid === u.uid, 'tap on your own mon scouts it too');
  b.pointerDown({ x: u.x, y: u.y });
  b.pointerMove({ x: u.x - 150, y: u.y });
  b.pointerUp();
  ok(b.phase === 'shot' && !(b as any).inspect, 'a real pull dismisses the card');
}

// --- seeded runs replay identically ------------------------------------------
{
  const a = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42));
  const b = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42));
  (a as any).spawnWave(0);
  (b as any).spawnWave(0);
  const seq = (bb: Battle) => bb.enemies.map((e) => `${e.def.id}:${e.hp}`).join(',');
  ok(seq(a) === seq(b), 'same seed → same wave (replayable climbs)');
}

// --- MS treasure drops: bounded odds, boss floor, existing pools, side stream --
{
  const bagIds = new Set(BAG_ITEMS.map((i) => i.id));
  const perfs = [false, true].flatMap((boss) => [false, true].flatMap((weak) => [false, true].flatMap((finisher) => [false, true].flatMap((speed) => [0, 4, 12, 99].map((combo) => ({ boss, weak, finisher, speed, combo }))))));
  ok(perfs.every((p) => { const o = dropOdds(p); return o.chance > 0 && o.chance <= (p.boss ? 1 : DROP_CAP) && o.weights.every((w) => w >= 0 && Number.isFinite(w)); }), 'treasure drop odds stay bounded');
  const plain = dropOdds({ boss: false, weak: false, finisher: false, speed: false, combo: 0 });
  const star = dropOdds({ boss: false, weak: true, finisher: true, speed: true, combo: 12 });
  const rare = (o: typeof plain) => (o.weights[2] + o.weights[3]) / o.weights.reduce((a, b) => a + b, 0);
  ok(star.chance > plain.chance && rare(star) > rare(plain), 'weak/finisher/combo/speed raise treasure odds');
  const r = mulberry32(5);
  const bossTiers = Array.from({ length: 500 }, () => rollDrop(r, { boss: true, weak: false, finisher: false, speed: false, combo: 0 }));
  ok(bossTiers.every((t) => t && t !== 'poke-ball'), 'bosses always drop a Great Ball or better');
  const rewards = BALL_TIERS.flatMap((t) => Array.from({ length: 300 }, () => rollReward(r, t)));
  ok(rewards.every((w) => (w.kind === 'stars' || w.kind === 'dust') ? w.n > 0 : w.kind === 'item' && bagIds.has(w.id!)), 'treasure rewards come from stars, dust and the bag pool only');
  ok(Object.values(LOOT_TABLE).every((slots) => slots.length <= 4), 'each ball keeps at most 4 drop slots');
  // a full drop stop banks once, tallies, and the reveal skips then closes
  const tr = new Treasure();
  for (let i = 0; i < 40; i++) tr.ko({ x: 100, y: 100, r: 20 }, i, { boss: true, weak: false, finisher: false, speed: false, combo: 0 }, 0);
  ok(tr.field.length === STOP_CAP, 'treasure drops cap per stop');
  const s0 = stars(), d0 = dust();
  let starsIn = 0;
  tr.endStop(1, 270, 160, (n) => { starsIn += n; return n; });
  const dustIn = tr.reveal.filter((w) => w.kind === 'dust').reduce((a, w) => a + w.n, 0);
  ok(tr.opened === STOP_CAP && tr.reveal.length === STOP_CAP && dust() === d0 + dustIn && stars() === s0, 'stop end banks every ball once');
  spendDust(dustIn); // later wallet checks read an untouched dust balance
  tr.endStop(2, 270, 160, () => 0);
  ok(tr.opened === STOP_CAP && tr.reveal.length === 0, 'collected balls never bank twice');
  tr.reveal = rewards.slice(0, 3);
  tr.show(10);
  ok(tr.showing() && tr.tap(10.1) && tr.showing() && tr.tap(10.2) && !tr.showing(), 'one tap skips the reveal, the next closes it');
  // drops roll off their own stream: the run rng order is unchanged
  const mk = () => { const bb: any = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42)); bb.spawnWave(0); return bb; };
  const a = mk(), b = mk();
  b.treasure.ko = () => null;
  for (const bb of [a, b]) for (const e of [...bb.enemies]) bb.hurt(e, 1e6, '#fff');
  ok(a.treasure.field.length > 0 && b.treasure.field.length === 0, 'KO hook rolls treasure');
  ok(a.rng() === b.rng() && a.score === b.score, 'treasure rolls leave seeded replays unchanged');
}

// --- MS fleeing rare foe: seeded plan, isolated build, countdown and loot ---
{
  const flee = new Flee();
  let spawns = 0;
  for (let seed = 0; seed < 6000; seed++) if (flee.plan(seed, 4, 1, false)) spawns++;
  const rate = spawns / 6000;
  ok(rate >= 0.13 && rate <= 0.2, 'rare foe rate stays near one in six');
  ok(!flee.plan(42, 4, 1, true) && !flee.plan(42, FLEE_FROM - 1, 1, false), 'rare foe never plans for excluded stops');
  let gentleSeed: number | undefined;
  let skipsGentleBattle = true;
  for (let seed = 0; seed < 6000; seed++) {
    const candidate = new Flee();
    candidate.plan(seed, 4, 2, false, true);
    if (candidate.at === 1) skipsGentleBattle = false;
    if (candidate.at === 2 && gentleSeed === undefined) gentleSeed = seed;
  }
  ok(skipsGentleBattle && gentleSeed !== undefined, 'gentle opener never receives the rare foe');
  const gentleFlee = new Flee();
  gentleFlee.plan(gentleSeed!, 4, 2, false, true);
  const replacedRoom = gentleFlee.room(2, ROOM_LAYOUTS[1]);
  ok(gentleFlee.at === 2 && replacedRoom !== ROOM_LAYOUTS[1] && ROOM_LAYOUTS.indexOf(replacedRoom) >= 3, 'planned foe swaps gentle room for non-gentle room');
  ok(gentleFlee.room(1, ROOM_LAYOUTS[1]) === ROOM_LAYOUTS[1] && gentleFlee.room(2, ROOM_LAYOUTS[3]) === ROOM_LAYOUTS[3], 'room substitution leaves unplanned and non-gentle rooms alone');
  const roomRngNext = (replace: boolean) => {
    const rng = mulberry32(82);
    const battle = new Battle(arena, team(), makeStage(82, 'T'), rng) as any;
    battle.flee.plan(gentleSeed!, 4, 2, false, true);
    battle.pickNextRoom();
    if (replace) battle.flee.room(2, ROOM_LAYOUTS[1]);
    return rng();
  };
  ok(roomRngNext(true) === roomRngNext(false), 'planned room substitution preserves the primary battle RNG');
  const planSeed = Array.from({ length: 6000 }, (_, seed) => seed).find((seed) => new Flee().plan(seed, 4, 1, false))!;
  const snapshot = (seed: number) => {
    const f = new Flee();
    f.plan(seed, 4, 3, false);
    const spawn = f.spawnAt();
    const host = { rng: mulberry32(99) };
    const built = f.build(host, () => host.rng());
    return [f.at, spawn.def.id, spawn.nx, spawn.ny, spawn.lvl, built];
  };
  ok(JSON.stringify(snapshot(planSeed)) === JSON.stringify(snapshot(planSeed)), 'rare foe plan and spawn placement are deterministic');
  flee.plan(planSeed, 4, 1, false);
  const plan = flee.spawnAt();
  ok(!plan.def.blink && !plan.def.mirror && !plan.def.healer && !plan.def.copy, 'rare species side mechanics are stripped');

  const unit = (id: number) => ({
    uid: 41, def: speciesById(id)!, maxHp: 100, hp: 100, timer: 3, clocks: [{ t: 1 }], bigT: 9,
    shiny: true, dead: false, x: 210, y: 330, r: 20,
  });
  const dittoShinySeed = Array.from({ length: 6000 }, (_, seed) => seed).find((seed) => {
    const f = new Flee();
    if (!f.plan(seed, 4, 1, false) || f.spawnAt().def.id !== 132) return false;
    return f.spawn({ ...unit(132), def: f.spawnAt().def }).shiny;
  });
  ok(dittoShinySeed !== undefined, 'planned shiny Ditto keeps its seeded shiny state');
  const tracked = flee.spawn(unit(plan.def.id));
  ok(tracked.hp === 35 && tracked.maxHp === 35 && tracked.timer === 99 && tracked.clocks.length === 0 && tracked.bigT === 0, 'rare spawn gets reduced HP and no attack clocks');
  ok(flee.is(tracked) && flee.def(tracked, 30) === Math.max(1, Math.round(30 * FLEE_DEF)), 'rare foe damage scales by FLEE_DEF');
  const hit1 = flee.hitSeed(tracked, 7, 3, 2);
  const hit2 = flee.hitSeed(tracked, 7, 3, 2);
  ok(hit1 === ((7 * 977 + 3 * 131 + 2 * 17 + tracked.uid * 7919 + 104729) >>> 0) && hit2 === ((7 * 977 + 3 * 131 + 2 * 17 + tracked.uid * 7919 + 2 * 104729) >>> 0), 'rare hit seeds advance deterministically per foe');

  const chanseySeed = Array.from({ length: 6000 }, (_, seed) => seed).find((seed) => {
    const f = new Flee();
    return f.plan(seed, 4, 1, false) && f.spawnAt().def.id === 113;
  })!;
  const chanseyFlee = new Flee();
  chanseyFlee.plan(chanseySeed, 4, 1, false);
  const chansey = chanseyFlee.spawn({ ...unit(113), def: chanseyFlee.spawnAt().def });
  const dustBefore = dust();
  let starsPaid = 0;
  const bonus = chanseyFlee.ko(chansey, (n) => { starsPaid += n; return n; });
  const again = chanseyFlee.ko(chansey, (n) => { starsPaid += n; return n; });
  ok(bonus === `+${FLEE_DUST} DUST · +${FLEE_STARS} STAR PIECES` && again === '' && dust() === dustBefore + FLEE_DUST && starsPaid === FLEE_STARS, 'Chansey bonus pays exactly once');
  spendDust(FLEE_DUST);

  const full = new Treasure();
  for (let i = 0; i < STOP_CAP; i++) full.ko({ x: 10, y: 20, r: 8 }, i, { boss: true, weak: false, finisher: false, speed: false, combo: 0 }, 0);
  const rareBall = full.ko({ x: 10, y: 20, r: 8 }, 123, { boss: false, weak: false, finisher: false, speed: false, combo: 0, rare: true, off: true }, 1);
  ok(rareBall === 'ultra-ball' && full.field.length === STOP_CAP + 1, 'rare KO guarantees Ultra Ball over the stop cap');

  const hitSeed = Array.from({ length: 1000 }, (_, seed) => seed).find((seed) => mulberry32(seed)() < HIT_DROP)!;
  const hitTarget = { x: 100, y: 120, r: 14 };
  const hitLoot = (seed: number) => {
    const treasure = new Treasure();
    const tier = treasure.hit(hitTarget, seed, 2);
    return { tier, field: treasure.field };
  };
  const hitA = hitLoot(hitSeed), hitB = hitLoot(hitSeed);
  ok(hitA.tier === 'poke-ball' && hitA.field[0].tier === 'poke-ball' && JSON.stringify(hitA) === JSON.stringify(hitB), 'surviving rare hits drop deterministic Poke Balls only');

  const battle = new Battle(arena, team(), makeStage(71, 'T'), mulberry32(71)) as any;
  battle.spawnWave(0);
  ok(battle.flee.plan(planSeed, 4, 1, false), 'integration seed plans a rare foe');
  const escaping = battle.flee.spawn(battle.flee.build(battle, () => battle.makeEnemy(battle.flee.spawnAt(), battle.waveIndex)));
  battle.enemies = [escaping];
  const kosBefore = battle.stopKos;
  battle.endShot();
  battle.endShot();
  battle.update(0.01);
  ok(escaping.dead && battle.telop.texts().includes(`${escaping.def.name.toUpperCase()} FLED`) && battle.stopKos === kosBefore, 'two turns flee without KO credit and clear an empty court');

  const nextRng = (withRare: boolean) => {
    const rng = mulberry32(981);
    const b: any = new Battle(arena, team(), makeStage(981, 'T'), rng);
    b.spawnWave(0);
    if (withRare) {
      b.flee.plan(planSeed, 4, 1, false);
      b.enemies.push(b.flee.spawn(b.flee.build(b, () => b.makeEnemy(b.flee.spawnAt(), b.waveIndex))));
    }
    return rng();
  };
  ok(nextRng(false) === nextRng(true), 'rare foe construction preserves the primary battle RNG sequence');
  ok(FLEE_TURNS === 2 && FLEE_SHINY === 1 / 8, 'rare foe countdown and Ditto shiny odds stay settled');
}

// --- MS stop missions: deterministic picks, ticks, pay once, seed-stable -----
{
  const types = ['fire', 'water', 'grass'] as any;
  const a = pickMissions(42, 3, types, true), b = pickMissions(42, 3, [...types].reverse(), true);
  ok(JSON.stringify(a) === JSON.stringify(b) && a.length === 3 && new Set(a.map((m) => m.id)).size === 3, 'missions pick deterministically, 3 unique');
  const spread = new Set(Array.from({ length: 30 }, (_, i) => pickMissions(i, 1, types, true).map((m) => m.id).join()));
  ok(spread.size > 3, 'missions vary with seed');
  ok(Array.from({ length: 50 }, (_, i) => pickMissions(i, 2, types, false)).every((l) => l.every((m) => m.id !== 'ult')), 'ULT mission only when the charge can land');
  const m = new Missions();
  m.start(1, 1, types, true, 0, true);
  ok(m.list.length === 0, 'event and raid stops roll no missions');
  m.rare = true;
  m.start(1, 1, types, true, 0);
  ok(!m.rare, 'mission start clears a planned rare preview');
  m.list = (['par', 'multiko', 'weak3', 'nofaint', 'ult', 'finish'] as const).map((id) => ({ id, label: id, state: 'live' as const, pay: MISSION_PAY[id], type: id === 'finish' ? 'fire' as any : undefined }));
  m.ko(1);
  ok(m.list[1].state === 'live', 'a lone KO leaves the 2-KO goal live');
  m.ko(2);
  m.ult();
  m.tick({ shots: 11, par: 10, weak: 3, faints: 1 });
  ok(m.list.map((x) => x.state).join() === 'fail,done,done,fail,done,live', 'missions tick live');
  m.ko(1, 'fire' as any);
  const d0 = dust();
  let starsIn = 0;
  m.clear(77, { shots: 11, par: 10, weak: 3, faints: 1 }, (n) => { starsIn += n; return n; });
  m.clear(77, { shots: 11, par: 10, weak: 3, faints: 1 }, (n) => { starsIn += n; return n; });
  ok(starsIn === MISSION_PAY.finish.n && dust() === d0 + MISSION_PAY.multiko.n + MISSION_PAY.weak3.n + MISSION_PAY.ult.n, 'mission pay banks once');
  ok(missionBests()['77'] === 3, 'mission best records, clamped to 3');
  ok(recordMissions(78, 2) && missionBests()['78'] === 2 && !recordMissions(78, 1) && recordMissions(78, 3) && missionBests()['78'] === 3, 'mission best keeps the max');
  spendDust(dust() - d0);
  // the run rng never feeds the pick: same seed, stubbed missions, same wave
  const mk = () => { const bb: any = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42)); return bb; };
  const x = mk(), y = mk();
  y.missions.start = () => {};
  x.spawnWave(0);
  y.spawnWave(0);
  ok(x.missions.list.length === 3 && x.rng() === y.rng(), 'missions leave seeded replays unchanged');
  // pk_stops counts card shows; past the third the card goes auto — it still
  // eats a tap inside its beat, then drops itself. Draw headless on a stub
  // ctx the way the share card does.
  const fakeCtx: any = new Proxy({}, {
    get: (_, k) =>
      k === 'measureText' ? () => ({ width: 40 })
      : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
      : () => {},
    set: () => true,
  });
  const doc0 = (globalThis as Record<string, unknown>).document;
  (globalThis as Record<string, unknown>).document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };
  const st0 = { shots: 0, par: 10, weak: 0, faints: 0 };
  const sc = { theme: 'grove', name: 'N', sub: 'S', foes: [], team: [] } as any;
  globalThis.localStorage.setItem('pk_stops', '{"n":0}');
  const c2 = new Missions();
  c2.start(1, 1, types, true, 0);
  c2.draw(fakeCtx, 1, arena, st0, sc);
  ok(c2.dismiss(1.1) && !c2.dismiss(1.2), 'a fresh stop card still holds for the tap');
  globalThis.localStorage.setItem('pk_stops', '{"n":3}');
  const c3 = new Missions();
  c3.start(1, 1, types, true, 0);
  c3.draw(fakeCtx, 0.1, arena, st0, sc);
  ok(c3.dismiss(0.2), 'the auto card still eats a tap inside its beat');
  const c4 = new Missions();
  c4.start(1, 1, types, true, 0);
  c4.draw(fakeCtx, 1.6, arena, st0, sc);
  ok(!c4.dismiss(1.7), 'the auto card drops itself after the beat');
  (globalThis as Record<string, unknown>).document = doc0;
}

// --- MS ALL CONNECT: every living ally in one shot, next shot ×1.25 -------
{
  const mon = (id: number) => ({ dead: false, def: { id }, x: 0, y: 0, r: 20 });
  const sq = [mon(1), mon(4), mon(7), mon(25)];
  const tl = new Telops();
  const c = new Connect();
  c.launch();
  ok(!c.touch(sq[1], sq[0], sq, tl) && !c.touch(sq[2], sq[0], sq, tl) && !c.touch(sq[2], sq[0], sq, tl) && !c.armed, 'ALL CONNECT: 2 of 3 allies is no connect');
  ok(c.touch(sq[3], sq[0], sq, tl) && c.armed && c.alls === 1 && c.best === 3, 'ALL CONNECT fires once every living ally is touched');
  tl.update(0.01);
  ok(tl.texts().includes('ALL CONNECT') && tl.cur?.mons?.length === 4, 'ALL CONNECT telop carries the team fronts');
  ok(!c.touch(sq[1], sq[0], sq, tl) && c.alls === 1, 'ALL CONNECT fires once per shot');
  ok(c.mult() === 1, 'ALL CONNECT shot itself gets no bonus');
  c.launch();
  ok(c.mult() === CONNECT_MUL && !c.armed, 'ALL CONNECT bonus rides the next shot');
  c.launch();
  ok(c.mult() === 1, 'ALL CONNECT bonus applies exactly once');
  sq[3].dead = true;
  ok(!c.touch(sq[3], sq[0], sq) && !c.touch(sq[1], sq[0], sq) && c.touch(sq[2], sq[0], sq), 'ALL CONNECT skips fainted allies');
  c.launch();
  sq[2].dead = true;
  ok(!c.touch(sq[1], sq[0], sq) && !c.armed, 'ALL CONNECT needs 2 living allies');
  c.reset();
  ok(!c.armed && !c.live && c.best === 0 && c.alls === 0, 'ALL CONNECT resets per stop');
  // battle wiring: the live bonus scales real hits
  const mk = () => { const bb: any = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42)); bb.spawnWave(0); bb.critCh = 0; return bb; };
  const x = mk(), y = mk();
  y.connect.live = true;
  const ex = x.enemies[0], ey = y.enemies[0];
  const hx = ex.hp, hy = ey.hp;
  x.hurt(ex, 40, '#fff', '', x.players[0]);
  y.hurt(ey, 40, '#fff', '', y.players[0]);
  const dx = hx - ex.hp, dy = hy - ey.hp;
  ok(dx > 0 && Math.abs(dy - Math.round(dx * CONNECT_MUL)) <= 1, `ALL CONNECT bonus scales battle damage (${dx} → ${dy})`);
}

// --- the pause chip freezes the sim, a tap thaws it ---------------------------
{
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  b.phase = 'aim';
  const chip = (b as any).pauseChip();
  b.pointerDown({ x: chip.x + 15, y: chip.y + 15 });
  ok(b.paused === true, 'pause chip freezes the fight');
  b.pointerDown({ x: 270, y: 659 });
  ok(b.paused && (b as any).ff, 'pause card speed control toggles without resuming');
  b.pointerDown({ x: 270, y: 659 });
  ok(b.paused && !(b as any).ff, 'pause card restores normal speed');
  const ehp = b.enemies.map((e) => e.hp).join(',');
  for (let i = 0; i < 120; i++) b.update(1 / 60);
  ok(b.enemies.map((e) => e.hp).join(',') === ehp && b.phase === 'aim', 'nothing moves while paused');
  b.pointerDown({ x: 270, y: 480 });
  ok(b.paused === false, 'any tap resumes');
}

// --- corrupt saves can't NaN or crash the run --------------------------------
{
  localStorage.setItem('pk_best', '{}');
  localStorage.setItem('pk_dex', '{"oops":true}');
  const b = best();
  ok(Number.isFinite(b.wins) && Number.isFinite(b.score), 'malformed pk_best falls back to defaults');
  ok(Array.isArray(dexIds()), 'malformed pk_dex reads as an empty dex');
  localStorage.removeItem('pk_best');
  localStorage.removeItem('pk_dex');
}

// --- a corrupt pk_run reads as "no parked climb", never a NaN'd one ---------
{
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  const clean = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  const trySave = (mut: (s: any) => void) => {
    const s = JSON.parse(JSON.stringify(clean));
    mut(s);
    localStorage.setItem('pk_run', JSON.stringify(s));
    return runSave();
  };
  ok(trySave(() => {}) !== null, 'a clean snapshot passes the pk_run shape-check');
  ok(trySave((s) => { s.team[1].lvl = 'x'; }) === null, 'a non-number team[].lvl rejects the save');
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 5 }, { id: 4, lvl: 5 }];
      s.boxHp = [1, 'x'];
      s.boxLvl = [5, 5];
    }) === null,
    'a non-number boxHp rejects the save',
  );
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 5 }, { id: 4, lvl: 5 }];
      s.boxHp = [1];
      s.boxLvl = [5, 5];
    }) === null,
    'boxHp/boxLvl pair with the box slot-for-slot',
  );
  ok(
    trySave((s) => {
      s.box = [{ id: 1, lvl: 'x' }];
      s.boxHp = [1];
      s.boxLvl = [5];
    }) === null,
    'a non-number box[].lvl rejects the save',
  );
  ok(trySave((s) => { s.tools = { roll: 'x', ban: 1 }; }) === null, 'non-number tool charges reject the save');
  ok(trySave((s) => { s.pendingNext = TOTAL_STAGES; }) === null, 'pendingNext past the last row rejects the save');
  ok(trySave((s) => { s.pendingNext = TOTAL_STAGES - 1; }) !== null, `the last gym row (pendingNext ${TOTAL_STAGES - 1}) still resumes`);
  // the v3 migration writes into pk_run — a valid-JSON primitive can't take a property
  localStorage.setItem('pk_run', '42');
  localStorage.setItem('pk_ver', '2');
  let threw = false;
  try {
    migrateSaves();
  } catch {
    threw = true;
  }
  ok(!threw && runSave() === null, 'a primitive pk_run survives the v3 migration and reads as no save');
  localStorage.removeItem('pk_run');
  localStorage.setItem('pk_ver', '1'); // the resting state the migration block left
}

// --- first-run coaching flag -------------------------------------------------
{
  markCoached();
  ok(coachDone(), 'coaching flag persists once the first wave clears');
  resetCoach();
  ok(!coachDone(), 'TUTORIAL pill re-arms the coach');
  markCoached(); // back to done — later checks assume a coached save
}

// --- mid-run save round-trips through JSON ----------------------------------
{
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  a.grantPerk(PERKS.find((p) => p.id === 'hpup')!); // measurable: maxHp growth
  (a as any).players[1].hp = 7;
  (a as any).mapNode = 1;
  (a as any).waveIndex = 0;
  (a as any).pendingNext = 1;
  a.score = 1234;
  const s = JSON.parse(JSON.stringify(a.snapshot()!)); // real serialization
  ok(s.perks.join() === 'hpup', 'snapshot records granted perks');

  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  const shape = (bb: Battle) => JSON.stringify(bb.regionMap.nodes.map((n) => [n.tx, n.ty, n.kind]));
  ok((b as any).mapSeed === s.mapSeed && shape(b) === shape(a), 'island regens from the saved seed');
  ok(b.players[1].hp === 7, 'battled hp restores');
  ok(b.players[0].maxHp === a.players[0].maxHp, 'perk re-applies maxHp growth');
  ok(b.score === 1234 && (b as any).mapNode === 1 && (b as any).pendingNext === 1, 'run position restores');
  ok((b as any).perkIds.join() === 'hpup', 'perk ids survive the resume');
  ok(b.snapshot()!.mapSeed === s.mapSeed, 're-snapshot keeps the original island seed');
}

// --- resume late in the climb keeps waves indexed by row --------------------
{
  // stage.waves only ships the seeded 3; a save parked at row 4+ used to
  // resume with pendingNext past the array — the next node tap crashed
  // reading spawns off waves[5]
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  (a as any).mapNode = 4;
  (a as any).waveIndex = 4;
  (a as any).pendingNext = 5;
  const s = JSON.parse(JSON.stringify(a.snapshot()!));
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  ok((b as any).stage.waves.length > 5, 'resume refills rolled waves');
  let threw = false;
  try {
    (b as any).spawnWave(5);
  } catch {
    threw = true;
  }
  ok(!threw, 'first node tap after a late resume fights, not crashes');
}

// --- resume before the final gym still reaches 'won' ------------------------
{
  // regression: backfilled waves must count toward depth — a run parked then
  // resumed used to clear the last gym at depth 5 < FINAL_DEPTH and stall on
  // the map at "STAGE 10 OF 9" instead of winning
  const a = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(3));
  (a as any).mapNode = 7;
  (a as any).waveIndex = 7;
  (a as any).pendingNext = 8;
  (a as any).depth = 5; // what a live climb banks standing at the last row
  const s = JSON.parse(JSON.stringify(a.snapshot()!));
  const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(99));
  b.applySnapshot(s);
  ok((b as any).depth === 6, 'backfilled waves count toward depth');
  (b as any).waveIndex = 8;
  (b as any).waveCleared();
  ok(b.phase === 'won', 'clearing the last row after a resume wins the run');
}

// --- roster integrity -------------------------------------------------------
ok(ROSTER.length >= 29, `roster expanded (${ROSTER.length})`);
ok(ROSTER.every((r) => speciesById(r.id)), 'every roster id resolves');
const evo = ROSTER.filter((r) => r.evolvesTo).every((r) =>
  (Array.isArray(r.evolvesTo) ? r.evolvesTo : [r.evolvesTo!]).every((id) => speciesById(id)),
);
ok(evo, 'every evolvesTo resolves');
ok(moveOf(25, 'electric') === 'THUNDERBOLT', 'pikachu override');
ok(moveOf(129, 'water') === 'SPLASH', 'magikarp signature');
ok(moveOf(9999, 'fire') === MOVE_NAME.fire, 'unknown id falls back to type move');

// --- signature moves: metronome rolls, future sight waits, ice beam locks ---
{
  const mk = (id: number) => {
    const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
    (b as any).spawnWave(0);
    (b as any).hazards = []; // static fields silence casts
    b.enemies.forEach((e) => { e.shieldN = 0; });
    const p = b.players[0];
    p.def = { ...p.def, id }; // masquerade — moveOf keys the dex id
    p.cd = 0;
    return { b, p };
  };
  const drain = (b: any) => {
    for (let i = 0; i < 8 && b.delays.length; i++)
      for (const d of b.delays.splice(0)) d.fn();
  };

  // METRONOME: the wag lands SOME signature — the trail names the roll
  {
    const { b, p } = mk(35); // Clefairy
    (b as any).bumpAlly(p, p);
    const rolled = b.fieldLog.find((l) => l.startsWith('METRONOME →'));
    const fx = (b as any).beams.length + (b as any).waves.length + (b as any).orbs.length + (b as any).delays.length;
    ok(!!rolled && fx > 0, `metronome wags into a real signature (${rolled})`);
  }

  // FUTURE SIGHT: the telegraph ring goes up first, the nuke lands on the queue
  {
    const { b, p } = mk(65); // Alakazam
    p.x = 500; p.y = 300;
    b.enemies.forEach((e: any, i: number) => { e.x = 100 + i * 20; e.y = 300; e.vx = e.vy = 0; });
    const e = b.enemies[0]; // farthest from p — the mark lands under it
    (b as any).bumpAlly(p, p);
    ok((b as any).delays.length > 0 && (b as any).waves.some((w: any) => w.life === 1.8), 'future sight telegraphs before it hits');
    const hp1 = e.hp; // a role passive may already have nicked it
    drain(b);
    ok(e.dead || e.hp < hp1, `future sight's delayed nuke lands (${hp1} → ${e.dead ? 'KO' : e.hp})`);
  }

  // ICE BEAM: every foe on the ray freezes stiff — timers slip
  {
    const { b, p } = mk(350); // Milotic
    p.x = 60; p.y = 400;
    b.enemies.forEach((e: any, i: number) => { e.x = 220 + i * 50; e.y = 400; e.vx = e.vy = 0; e.timer = 3; });
    (b as any).bumpAlly(p, p);
    ok(b.enemies.every((e: any) => e.dead || e.timer > 3), 'ice beam freezes every foe it spears');
  }

  // SPLASH: the dud still counts — it logs the joke and never falls through
  // to the type super (a fallthrough would queue chain links / push beams)
  {
    const { b, p } = mk(129); // Magikarp
    (b as any).bumpAlly(p, p);
    ok(
      b.fieldLog.some((l) => l.includes('SPLASH')) && (b as any).beams.length === 0 && (b as any).delays.length === 0,
      'splash is a dud — logged, no type-super fallthrough',
    );
  }

  // WATER SPOUT: the geyser pours on the caster's own HP — full floods, faint sputters
  {
    const spout = (frac: number) => {
      const { b, p } = mk(382); // Kyogre
      p.x = 60; p.y = 400;
      b.enemies.forEach((e: any, i: number) => {
        e.x = 260 + i * 60; e.y = 400; e.vx = e.vy = 0; e.shieldN = 0;
      });
      const hp0 = b.enemies.map((e: any) => e.hp);
      p.hp = Math.max(1, Math.round(p.maxHp * frac));
      (b as any).bumpAlly(p, p);
      return b.enemies.reduce((s: number, e: any, i: number) => s + hp0[i] - e.hp, 0);
    };
    ok(spout(1) > spout(0.05), 'water spout pours harder at full HP than near-faint');
  }

  // SEISMIC TOSS: fixed damage — the landing pays out per caster level
  {
    const slam = (lvl: number) => {
      const { b, p } = mk(67); // Machoke
      p.lvl = lvl;
      p.x = 270; p.y = 760;
      b.enemies.forEach((e: any, i: number) => {
        e.vx = e.vy = 0; e.shieldN = 0;
        e.x = i === 0 ? 270 : 80 + i * 100;
        e.y = i === 0 ? 300 : 200;
      });
      const e = b.enemies[0];
      const hp0 = e.hp;
      (b as any).bumpAlly(p, p);
      drain(b); // the 0.5s landing is where the damage lives
      return hp0 - e.hp;
    };
    ok(slam(40) > slam(20), 'seismic toss lands harder the higher the level');
  }

  // ENDEAVOR: a full-HP foe gets dragged down to a hurting caster's fraction
  {
    const { b, p } = mk(277); // Swellow
    p.hp = Math.max(1, Math.round(p.maxHp * 0.1));
    p.x = 270; p.y = 760;
    b.enemies.forEach((e: any, i: number) => {
      e.x = 270; e.y = 300 - i * 50; e.vx = e.vy = 0; e.shieldN = 0;
    });
    const e = b.enemies[0];
    const want = Math.max(1, Math.round(e.maxHp * (p.hp / p.maxHp)));
    (b as any).bumpAlly(p, p);
    ok(!e.dead && e.hp <= want, `endeavor pulls the foe to the caster's fraction (${e.hp}/${e.maxHp} → ≤${want})`);
  }

  // FISSURE: the crack skips winged foes — only grounded prey is in its path
  {
    const { b, p } = mk(383); // Groudon
    p.x = 270; p.y = 760;
    const g = b.enemies[0];
    b.enemies.forEach((e: any, i: number) => {
      e.vx = e.vy = 0; e.shieldN = 0; e.timer = 3;
      if (i === 0) {
        e.x = 270; e.y = 500; e.airborne = false; // nearest, grounded — the mark
        e.def = { ...e.def, type: 'normal', type2: undefined };
        e.hp = 1; // canon OHKO: the crack KOs what it catches
      } else {
        e.x = i % 2 ? 80 : 460; e.y = 230 + i * 15; // farther — and winged
        if (i === 1) e.def = { ...e.def, type: 'flying', type2: undefined };
        else e.airborne = true;
      }
    });
    const flyers = b.enemies.slice(1); // hold refs — the dead drop out of enemies[]
    const fly0 = flyers.map((e: any) => e.hp);
    (b as any).bumpAlly(p, p);
    ok(g.dead, 'fissure KOs the grounded mark');
    ok(
      flyers.length > 0 && flyers.every((e: any, i: number) => !e.dead && e.hp === fly0[i]),
      'fissure skips the airborne pack for grounded prey',
    );
  }
}

// --- daily/weekly task board: seeded picks, rollover, one-claim payout ------
{
  localStorage.removeItem('pk_tasks');
  const DAY = 86400000;
  const t0 = Date.UTC(2024, 5, 10, 12); // Monday 2024-06-10, noon UTC
  const t1 = t0 + DAY; // Tuesday — a new day, the same ISO week

  // the seeded roll is deterministic: same key, same board, for everyone
  const ids = rollTasks(DAILY_POOL, 3, daySeed(t0)).map((d) => d.id);
  ok(
    ids.length === 3 && ids.join() === rollTasks(DAILY_POOL, 3, daySeed(t0)).map((d) => d.id).join(),
    `a fixed day rolls the same 3 tasks (${ids.join('/')})`,
  );
  ok(new Set(ids).size === ids.length, 'no duplicate tasks on the daily board');
  ok(rollTasks(WEEKLY_POOL, 4, weekSeed(t0)).length === 4, 'a fixed week rolls 4 tasks');
  const catalogue = [...DAILY_POOL, ...WEEKLY_POOL];
  ok(new Set(catalogue.map((d) => d.id)).size === catalogue.length, 'task ids unique across pools');
  ok(catalogue.every((d) => BAG_ITEMS.some((i) => i.id === d.reward)), 'every reward is a real bag item');
  ok(dayKey(t0) === '2024-06-10' && weekKey(t0) === '2024-W24', `period keys (${dayKey(t0)} / ${weekKey(t0)})`);
  ok(taskViews('daily', t0).length === 3 && localStorage.getItem('pk_tasks') === null, 'taskViews stays read-only — the roll waits for a writer');

  // a full-kind beat lands on both periods — but only the kinds on offer
  taskTick({ kos: 10, catches: 2, stages: 1, gyms: 1, perks: 2, score: 500, shinies: 1, runs: 1, wins: 1, maxstage: 4, dailies: 1 }, t0);
  const dv0 = taskViews('daily', t0);
  const wv0 = taskViews('weekly', t0);
  ok(dv0.length === 3 && wv0.length === 4, 'selections show through the views');
  ok(dv0.every((v) => v.have > 0) && wv0.every((v) => v.have > 0), 'tick accumulates into both periods');
  const s0 = taskState();
  ok(Object.keys(s0.dp).length <= 3 && Object.keys(s0.wp).length <= 4, 'the blob only tracks offered kinds');
  ok(s0.day === dayKey(t0) && s0.dsel.join() === ids.join(), 'tick persisted the seeded board under the day key');

  // overshoot is fine — have runs past n, done is the gate
  taskTick({ kos: 500, catches: 50, stages: 50, gyms: 9, perks: 50, score: 99999, shinies: 5, runs: 5, wins: 2, maxstage: 9, dailies: 2 }, t0);
  const dv = taskViews('daily', t0);
  ok(dv.every((v) => v.done) && dv.some((v) => v.have > v.n), 'over-ticking overshoots the target — done flags hold');
  const wv = taskViews('weekly', t0);
  const ready = dv.concat(wv).filter((v) => v.done && !v.claimed).length;
  ok(ready === 7 && tasksReady(t0) === ready, `tasksReady counts unclaimed done across both periods (${ready})`);

  // the claim banks the reward once — a second tap reads null, stock unmoved
  const target = dv.find((v) => v.done)!;
  const reward = DAILY_POOL.find((d) => d.id === target.id)!.reward;
  const stock0 = bagStock()[reward] ?? 0;
  ok(claimTask(target.id, t0) === reward, 'claimTask returns the paid item id');
  ok((bagStock()[reward] ?? 0) === stock0 + 1, `the reward banks into pk_bag (${reward})`);
  ok(claimTask(target.id, t0) === null && (bagStock()[reward] ?? 0) === stock0 + 1, 'the same task pays once');
  ok(taskViews('daily', t0).find((v) => v.id === target.id)!.claimed === true, 'the claimed flag shows on the view');
  ok(tasksReady(t0) === ready - 1, 'a claim drops the ready count');

  // next day, same ISO week: the daily view re-rolls fresh, the week keeps on
  const dv1 = taskViews('daily', t1);
  ok(dv1.length === 3 && dv1.every((v) => v.have === 0 && !v.done && !v.claimed), 'a new day reads a fresh board — progress wiped');
  ok(taskViews('weekly', t1).every((v) => v.done), 'the weekly board survives the day boundary');
  taskTick({ kos: 1 }, t1); // the first tick of the new day banks the roll
  const s1 = taskState();
  ok(s1.day === dayKey(t1) && s1.dsel.length === 3 && s1.week === weekKey(t0) && Object.keys(s1.wp).length > 0,
    'tick persists the rolled-over day, the week keeps its books');

  // a stale stored key re-rolls through the writer — same seeded board, empty books
  saveTaskState({ day: '1999-01-01', dp: { kos: 99 }, dsel: ['gone'], dclaim: ['gone'], week: '1999-W01', wp: { kos: 5 }, wsel: ['gone2'], wclaim: [] });
  taskTick({}, t0);
  const s2 = taskState();
  ok(s2.day === dayKey(t0) && s2.dsel.join() === ids.join() && Object.keys(s2.dp).length === 0, 'an out-of-period day re-rolls with empty progress');
  ok(s2.week === weekKey(t0) && s2.wsel.length === 4 && Object.keys(s2.wp).length === 0, 'an out-of-period week re-rolls too');

  // countdown strings: a Monday noon is 12h from the daily flip, ~6.5d from the weekly
  ok(taskResetsIn('daily', t0) === 'IN 12H', `daily reset reads as hours (${taskResetsIn('daily', t0)})`);
  ok(taskResetsIn('weekly', t0) === 'IN 7D', `weekly reset reads as days (${taskResetsIn('weekly', t0)})`);
  localStorage.removeItem('pk_tasks'); // leave the store clean for the next run
}

// --- daily picks: memo'd on the day seed — same day hits, new day re-rolls --
{
  const DAY = 86400000;
  const t0 = Date.UTC(2024, 5, 10, 12); // Monday noon UTC
  const r0 = raidPick(t0);
  ok(raidPick(t0 + 3600000).id === r0.id, 'same UTC day hits the memo\'d raid pick');
  ok(featuredPull(t0).id === featuredPull(t0 + 3600000).id, 'same UTC day hits the memo\'d rate-up');
  const team0 = raidTeam(t0).map((d) => d.id).join();
  ok(raidTeam(t0 + 3600000).map((d) => d.id).join() === team0, 'same UTC day hits the memo\'d loaner team');
  const t1 = raidTeam(t0);
  t1[0].lvl = 99; // callers get fresh copies — mutating one mustn't taint the memo
  ok(raidTeam(t0)[0].lvl === 30, 'raidTeam still hands out fresh lvl-30 copies');
  let reRolled = false;
  for (let d = 1; d <= 30 && !reRolled; d++) reRolled = raidPick(t0 + d * DAY).id !== r0.id;
  ok(reRolled, 'a new day seed re-rolls the raid pick');
  // the handicap card rides the same day memo — same day hits, new day rolls
  ok(raidMod(t0).id === raidMod(t0 + 3600000).id && raidLvl(t0) === raidLvl(t0 + 3600000), 'same UTC day hits the memo\'d raid mod + lvl');
  let modRerolled = false;
  for (let d = 1; d <= 30 && !modRerolled; d++) modRerolled = raidMod(t0 + d * DAY).id !== raidMod(t0).id;
  ok(modRerolled, 'a new day seed re-rolls the raid mod');
}

// --- the daily chroma raid: seeded handicap + tribe escorts -------------------
// The day seed spends itself on the fight's shape: a named modifier, boss-typed
// escorts, pinned levels, flat bulk. The card advertises exactly what spawns.
{
  const boss = raidPick();
  const lvl = raidLvl();
  const escN = raidEscortN();
  const stage = raidStage(daySeed() * 31 + 91, boss, THEMES[daySeed() % THEMES.length], escN, lvl);
  const wave = stage.waves[0];
  ok(wave.filter((s) => s.boss).length === 1 && wave.length === escN + 1, `raid fields the boss + ${escN} escorts (${wave.length} foes)`);
  ok(wave.every((s) => s.boss || s.def.type === boss.type || s.def.type === boss.type2), 'raid escorts share the boss typing');
  ok(wave.find((s) => s.boss)?.lvl === lvl && wave.every((s) => s.boss || (s.lvl ?? 0) >= 28), `levels pinned — boss LV${lvl}, escorts ≥28`);
  ok(lvl >= 36 && lvl <= 45, `raid lvl band 36–45 (${lvl})`);
  ok(RAID_MODS.length === 11 && new Set(RAID_MODS.map((m) => m.id)).size === 11, 'eleven raid mods, unique ids');

  // every mod actually lands on the field — one battle per id
  for (const m of RAID_MODS) {
    const st = raidStage(9, boss, 'grove', m.id === 'horde' ? 5 : 3, 40);
    const b = new Battle(arena, team(), st, mulberry32(7), []);
    b.raid = true;
    b.raidMod = m.id;
    b.startFight();
    const foes = b.enemies;
    const ace = foes.find((e) => e.boss)!;
    switch (m.id) {
      case 'enraged':
        ok(ace.enraged, 'ENRAGED: the boss walks in furious');
        break;
      case 'storm': {
        const want = ({ water: 'rain', fire: 'sun', rock: 'sand', flying: 'wind', electric: 'storm' } as Record<string, string>)[boss.type] ?? WEATHER_FOR[b.theme as Theme] ?? 'storm'; // unmapped typings keep the court's sky, else the caller brings the storm itself
        ok(b.weather === want, `STORM CALLER: the sky locks to ${b.weather}`);
        break;
      }
      case 'fortress':
        ok(b.blocks.length > 0 || (b as any).hazards.length > 0, 'FORTRESS: a furnished court, not the open arena');
        break;
      case 'plated':
        ok(foes.every((e) => e.def.shielded), 'PLATED: every foe rolls shielded');
        break;
      case 'warded':
        ok(foes.every((e) => e.shieldN === 1), 'WARDED: every foe carries a ward');
        break;
      case 'volatile':
        ok(foes.every((e) => e.volatile), 'VOLATILE: every KO splashes');
        break;
      case 'frenzy':
        ok(foes.every((e) => e.drift >= enemyDrift(e.def.stats) * (e.boss ? 0.55 : 1) * 1.24), 'FRENZY: escorts press harder');
        break;
      case 'guardian':
        ok(foes.some((e) => e.supp === 'aegis') && foes.some((e) => e.supp === 'medic'), 'GUARDIAN: a warded cleric hides in the escorts');
        break;
      case 'hasty': {
        const cb = new Battle(arena, team(), raidStage(9, boss, 'grove', 3, 40), mulberry32(7), []);
        cb.raid = true;
        cb.startFight();
        ok(ace.timer < cb.enemies.find((e) => e.boss)!.timer, 'HAIR TRIGGER: foes wind up sooner');
        break;
      }
      case 'horde':
        ok(foes.length === 6, 'HORDE: five escorts flank the boss');
        break;
      case 'laststand': {
        ace.sash = false; // a rolled focus-sash would hang it at 1 first — the stand is what's under test
        ace.sumStage = 2;
        ace.hp = Math.ceil(ace.maxHp * 0.4);
        (b as any).hurt(ace, ace.hp + 1, '#fff');
        ok(!ace.dead && ace.hp === Math.ceil(ace.maxHp * 0.45) && ace.enraged, 'LAST STAND: the boss rises once at 45%, enraged');
        break;
      }
    }
    // the pinned level survives makeEnemy — the card's LV is the field's truth
    ok(ace.lvl === 40, `${m.id}: boss spawns at its pinned LV40`);
  }
}

// --- streaks: the daily chain counts fresh UTC days, wins count finishes ---
{
  localStorage.removeItem('pk_streak');
  const DAY = 86400000;
  const t0 = Date.UTC(2024, 5, 10, 12); // Monday 2024-06-10, noon UTC
  ok(streakDaily(t0) === 0 && streakWins() === 0, 'streaks start empty');
  ok(localStorage.getItem('pk_streak') === null, 'streak readers stay read-only');

  bumpStreaks(true, true, t0);
  ok(streakDaily(t0) === 1 && streakWins() === 1, 'a first daily win lights both chains');
  bumpStreaks(true, true, t0 + 3600000); // a second daily, same UTC day
  ok(streakDaily(t0) === 1, 'a same-day second daily never double-counts');
  ok(streakWins() === 2, 'every finished run still feeds the win chain');

  bumpStreaks(false, false, t0); // a non-daily loss the same day
  ok(streakDaily(t0) === 1, 'non-daily runs leave the daily chain alone');
  ok(streakWins() === 0, 'a loss snaps the win chain');

  bumpStreaks(false, true, t0 + DAY); // Tuesday's daily — finishing counts, win or lose
  ok(streakDaily(t0 + DAY) === 2, 'consecutive days chain even on a lost daily');
  ok(streakWins() === 0, 'the loss held wins at 0');

  ok(streakDaily(t0 + 2 * DAY) === 2, 'the badge holds while the chain is still live');
  ok(streakDaily(t0 + 3 * DAY) === 0, 'a gap morning reads broken on the badge');
  bumpStreaks(true, true, t0 + 3 * DAY); // Thursday daily after a missed Wednesday
  ok(streakDaily(t0 + 3 * DAY) === 1, 'the next daily restarts the chain at 1');
  ok(JSON.parse(localStorage.getItem('pk_streak')!).lastDaily === '2024-06-13', 'bumpStreaks persists immediately');

  bumpStreaks(true, false, t0 + 3 * DAY);
  bumpStreaks(true, true, t0 + 4 * DAY); // Friday's daily win
  ok(streakWins() === 3 && streakDaily(t0 + 4 * DAY) === 2, 'wins chain across modes while the daily chain keeps going');

  localStorage.setItem('pk_streak', '{broken');
  ok(streakDaily(t0 + 4 * DAY) === 2 && streakWins() === 3, 'a corrupt blob falls back to the memory copy');
  localStorage.removeItem('pk_streak');
}

// --- songbook validator (MUSIC.md S0): lead.length IS the loop length — a
// short lane is silent dead air, a long one is dead notes nobody hears ------
{
  const midiOk = (m: number) => m === 0 || (m >= 21 && m <= 108); // 0 = rest, else piano range
  const lanes = ['lead', 'harm', 'alt', 'altHarm', 'arp', 'bass'] as const;
  const drums = ['kick', 'snare', 'hat'] as const;
  for (const [name, t] of Object.entries(TRACKS)) {
    const n = t.lead.length;
    for (const f of lanes) {
      const a = t[f];
      if (a === undefined) continue;
      ok(a.length === n, `${name}.${f}: ${a.length} steps vs lead's ${n}`);
      const bad = a.find((m) => !midiOk(m));
      ok(bad === undefined, `${name}.${f}: midi 0 or 21-108 (found ${bad})`);
    }
    for (const f of drums) {
      ok(t[f].length === n, `${name}.${f}: ${t[f].length} steps vs lead's ${n}`);
      const bad = t[f].match(/[^kshc.]/)?.[0];
      ok(bad === undefined, `${name}.${f}: drum chars are k/s/h/c/. (found '${bad}')`);
    }
    if (t.stab !== undefined) {
      ok(t.stab.length === n, `${name}.stab: ${t.stab.length} rows vs lead's ${n}`);
      const badRow = t.stab.findIndex((r) => !Array.isArray(r) || r.some((m) => !midiOk(m)));
      ok(badRow === -1, `${name}.stab: every row is a midi chord array (row ${badRow})`);
    }
    ok(t.next === undefined || t.next in TRACKS, `${name}.next -> '${t.next}' is a real track`);
    ok(!(t.loop === true && t.next !== undefined), `${name}: a loop never hands off to next`);
  }
  ok(true, `${Object.keys(TRACKS).length} tracks validated`);
}

// --- daily rule card (B32): one seeded mod per UTC day, same for all ------
{
  const t0 = Date.UTC(2025, 5, 15);
  ok(dailyMod(t0) === dailyMod(t0), 'same day picks the same rule card');
  ok(DAILY_MODS.length >= 6 && new Set(DAILY_MODS.map((m) => m.id)).size === DAILY_MODS.length, `${DAILY_MODS.length} daily mods, unique ids`);
  const seen = new Set(Array.from({ length: 14 }, (_, i) => dailyMod(t0 + i * 86400000).id));
  ok(seen.size > 1, `the card rotates across days (${seen.size} ids in a fortnight)`);
  const fields = ['scoreMult', 'shinyRate', 'captureChance', 'launchBoost', 'critCh', 'regen', 'koHeal', 'dmgMult', 'takenMult', 'cdMult', 'ricoPip', 'volleyBoost', 'comboDmg', 'physMult', 'specMult', 'allAffix', 'dailyWeather', 'martMult', 'foeHpBonus'] as const;
  for (const m of DAILY_MODS) {
    const b = new Battle(arena, [speciesById(1)!], makeStage(5, 'T'), mulberry32(1));
    const before = fields.map((f) => b[f]);
    m.apply(b);
    ok(fields.some((f, i) => b[f] !== before[i]), `${m.id} apply() moves a battle field`);
  }

  // the flag paths move real mechanics, not just fields
  const mod = (id: string) => DAILY_MODS.find((m) => m.id === id)!;
  const fb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  mod('fever').apply(fb);
  ok(fb.shinyRate === 3, `gold fever: shinyRate x${fb.shinyRate}`);
  const hb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  const hp0 = hb.players.map((p) => p.maxHp);
  mod('hearty').apply(hb);
  ok(hb.players.every((p, i) => p.maxHp === Math.round(hp0[i] * 1.25) && p.hp === p.maxHp) && hb.foeHpBonus === 0.1,
    'hearty: team maxHp +25% and topped up, foes +10%');
  const rb = new Battle(arena, team(), makeStage(5, 'T'), mulberry32(1));
  mod('rich').apply(rb);
  const potion = martStock(rb).options.find((o) => o.label.startsWith('POTION'))!;
  ok(rb.scoreMult === 1.2 && potion.cost === 150, `big spender: +20% score, mart potion ${potion.cost} (was 200)`);
  const gb = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  const gb0 = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(4));
  mod('glass').apply(gb);
  (gb as any).spawnWave(0);
  (gb0 as any).spawnWave(0);
  const hpRatio = gb.enemies[0].maxHp / gb0.enemies[0].maxHp;
  ok(gb.dmgMult === 1.3 && Math.abs(hpRatio - 1.2) < 0.01, `glass cannon: dmg x${gb.dmgMult}, foes x${hpRatio.toFixed(3)} hp`);

  // storm chaser: every rolled wave has a sky; rough road: every eligible
  // rolled wave mutates. Boss/trainer/invade waves skip the affix roll.
  for (const s of [3, 11]) {
    const b = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    mod('stormy').apply(b);
    let skies = true;
    for (let i = 0; i <= 4; i++) {
      (b as any).spawnWave(i);
      if (!b.weather) skies = false;
    }
    ok(skies, `storm chaser: weather on every wave (seed ${s})`);
    const c = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    let clear = 0;
    for (let i = 0; i <= 4; i++) {
      (c as any).spawnWave(i);
      if (!c.weather) clear++;
    }
    ok(clear > 0, `control seed ${s}: ${clear} clear courts without the card`);

    const r = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    mod('rough').apply(r);
    let eligible = 0, affixed = 0;
    for (let i = 1; i <= 4; i++) {
      (r as any).spawnWave(i);
      // bosses (gyms + invades) skip the affix roll — a landed affix also
      // sets waveSpecial, so it can't be the discriminator
      if (r.enemies.some((e) => e.boss)) continue;
      eligible++;
      if ((r as any).curMod) affixed++;
    }
    ok(eligible > 0 && affixed === eligible, `rough road: ${affixed}/${eligible} eligible waves mutated (seed ${s})`);
    const rc = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(s));
    let cElig = 0, cAff = 0;
    for (let i = 1; i <= 4; i++) {
      (rc as any).spawnWave(i);
      if (rc.enemies.some((e) => e.boss)) continue;
      cElig++;
      if ((rc as any).curMod) cAff++;
    }
    ok(cAff < cElig, `control seed ${s}: affixes stay a minority (${cAff}/${cElig})`);
  }
}

// --- the hatcher: star/dust ledgers, pull buckets, pity, spark, lab ---------
// dead last on purpose: a bought lab level retunes later Battle asserts
{
  // earlier battle runs banked real stars — read the baseline, assert deltas
  const s0 = stars();
  localStorage.removeItem('pk_dust');
  localStorage.removeItem('pk_pulls');
  localStorage.removeItem('pk_lab');
  ok(addStars(42) === s0 + 42 && stars() === s0 + 42, 'stars bank and read back');
  ok(!spendStars(stars() + 1) && stars() === s0 + 42, 'spendStars refuses when short — balance unchanged');
  ok(spendStars(PULL_COST) && stars() === s0 + 12, 'a pull-priced spend deducts');
  const d0 = dust(); // treasure balls from the climbs above banked real dust
  ok(addDust(25) === d0 + 25 && spendDust(10) && !spendDust(d0 + 99) && dust() === d0 + 15, 'dust banks, spends, guards');
  ok(bumpPulls() === 1 && pullCount() === 1, 'pull counter bumps');

  const pullIds = new Set(PULLABLE.map((d) => d.id));
  ok(PULLABLE.length === pullIds.size && [...pullIds].every((id) => !!speciesById(id)),
    'PULLABLE is deduped and every entry resolves to a species');

  ok(pullSpecies(mulberry32(7)).id === pullSpecies(mulberry32(7)).id, 'same seed, same pull');
  let rarePlusOk = true;
  for (let i = 0; i < 40; i++) {
    const d = pullSpecies(mulberry32(100 + i), { rarePlus: true });
    if (!(tierOf(d) >= 2 || INVADER_IDS.has(d.id))) rarePlusOk = false;
  }
  ok(rarePlusOk, 'rarePlus pulls only deal rare+epic buckets');
  ok(Math.abs(PULL_RATES.common + PULL_RATES.rare + PULL_RATES.epic - 1) < 1e-9,
    'printed pull rates still sum to a full table');
  const feat = featuredPull(0);
  ok((tierOf(feat) >= 2 || INVADER_IDS.has(feat.id)) && featuredPull(0).id === feat.id,
    'featured pick is rare+ and stable within the day');
  ok(PULLABLE.every((d) => dustCost(d) === 80 * (tierOf(d) + 1)), 'spark price rides tier');

  // lab: a buy deducts and persists; a maxed or unaffordable upgrade refuses
  const up = LAB_UPGRADES.find((u) => u.max > 1)!;
  const sBefore = stars();
  addStars(up.costs[0]);
  ok(buyLab(up.id) && labLevel(up.id) === 1 && stars() === sBefore, 'lab buy deducts and levels');
  while (labLevel(up.id) < up.max) { addStars(up.costs[labLevel(up.id)]); buyLab(up.id); }
  const maxedStars = stars();
  ok(!buyLab(up.id) && stars() === maxedStars, 'a maxed upgrade refuses to sell');
  const broke = LAB_UPGRADES.find((u) => labLevel(u.id) < u.max && u.costs[labLevel(u.id)] > stars());
  if (broke) ok(!buyLab(broke.id), 'an unaffordable upgrade refuses to sell');

  // the wardrobe — MAY + WALLY hang free; a roll sells for stars, unlocks one
  // locked look, refuses when broke, and stops selling when the closet's full
  localStorage.removeItem('pk_avatars');
  ok(avatarOwned('may') && avatarOwned('wally'), 'the free pair is always owned');
  const lockedAtStart = AVATARS.filter((a) => !avatarOwned(a.id));
  ok(lockedAtStart.length === AVATARS.length - 2, 'a fresh closet locks every other look');
  const sRoll = stars();
  if (sRoll < AVATAR_ROLL_COST) addStars(AVATAR_ROLL_COST - sRoll);
  const rolled = avatarRoll();
  ok(!!rolled && avatarOwned(rolled!), 'a roll unlocks a locked look');
  ok(stars() === Math.max(sRoll, AVATAR_ROLL_COST) - AVATAR_ROLL_COST, 'a roll charges the printed price');
  ok(!avatarOwned('not_a_trainer'), 'junk ids never read owned');
  const nPreUnlock = AVATARS.filter((a) => avatarOwned(a.id)).length;
  avatarUnlock('generic_m1');
  avatarUnlock('generic_m1');
  ok(AVATARS.filter((a) => avatarOwned(a.id)).length === nPreUnlock + (rolled === 'generic_m1' ? 0 : 1),
    'unlocking twice stays idempotent');
  for (const a of AVATARS) { addStars(AVATAR_ROLL_COST); avatarUnlock(a.id); }
  const sFull = stars();
  ok(avatarRoll() === null && stars() === sFull, 'a full closet refuses to sell');

  // the upgrade pack — dust buys +1 tier on a random held item, caps at 5,
  // refuses when broke or maxed, and the tier actually lands in battle
  localStorage.removeItem('pk_itemtiers');
  ok(BAG_ITEMS.every((i) => itemTier(i.id) === 0), 'a fresh save starts every item at T0');
  const dRoll = dust();
  if (dRoll < ITEM_PACK_COST) addDust(ITEM_PACK_COST - dRoll);
  const bumped = itemTierRoll();
  ok(!!bumped && itemTier(bumped!) === 1, 'a pack raises one item a tier');
  ok(dust() === Math.max(dRoll, ITEM_PACK_COST) - ITEM_PACK_COST, 'a pack charges the printed price');
  for (let n = 0; n < ITEM_TIER_CAP * BAG_ITEMS.length; n++) { addDust(ITEM_PACK_COST); itemTierRoll(); }
  ok(BAG_ITEMS.every((i) => itemTier(i.id) === ITEM_TIER_CAP), 'packs top out at the cap');
  const dFull = dust();
  ok(itemTierRoll() === null && dust() === dFull, 'a maxed shelf refuses to sell');
  ok(itemTier('not_an_item') === 0, 'junk ids never read tiered');
  // scope-lens T5 must land in the fight: +0.15 flat + 5 × 0.02 tiers
  localStorage.setItem('pk_itemtiers', JSON.stringify({ t: { 'scope-lens': 5 } }));
  const tiered = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3), ['scope-lens']);
  ok(Math.abs(tiered.critCh - 0.25) < 1e-9, 'item tiers feed battle state');

  // lab levels change measurable battle state — a level must do something
  const preLab = localStorage.getItem('pk_lab');
  localStorage.setItem('pk_lab', '{}'); // a clean store — earlier buys mustn't leak in
  const unlabbed = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  localStorage.setItem('pk_lab', JSON.stringify({ hp: 2, dmg: 1, spc: 1, luck: 2, reroll: 2, ban: 1, fourth: 1, revive: 1, earnings: 1 }));
  const labbed = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  ok(labbed.players[0].maxHp > unlabbed.players[0].maxHp, 'HP UP levels raise fielded maxHp');
  ok(Math.abs(labbed.dmgMult - unlabbed.dmgMult * 1.05) < 1e-9, 'PROTEIN levels raise hit damage');
  ok(labbed.teamLuck() - unlabbed.teamLuck() === 4, 'LUCKY EGG levels feed team luck');
  ok(labbed.tools.roll - unlabbed.tools.roll === 2 && labbed.tools.ban - unlabbed.tools.ban === 1,
    'DIRE HIT/QUICK CLAW levels seed tool charges');
  ok(labbed.perkOfferN === unlabbed.perkOfferN + 1, 'MASTER BALL deals a fourth perk card');
  ok(labbed.reviveToken && !unlabbed.reviveToken, 'REVIVE level arms the token');
  ok(Math.abs((labbed as any).starMult - 1.1) < 1e-9, 'AMULET COIN levels raise star payout');
  ok(Math.abs((labbed as any).labSpcMult - 1.05) < 1e-9, 'CALCIUM levels raise super damage');
  ok(labbed.fieldLog.some((l) => l.startsWith('LAB')), 'bought levels announce on the field log');
  if (preLab == null) localStorage.removeItem('pk_lab'); else localStorage.setItem('pk_lab', preLab);

  // bond: cleared stages bank per-species pts, each level crossed pays dust once
  const preBond = localStorage.getItem('pk_bond');
  localStorage.removeItem('pk_bond');
  const dust0 = dust();
  const b1 = bankBond([{ id: ROSTER[0].id, pts: 5 }, { id: ROSTER[1].id, pts: 5 }, { id: ROSTER[0].id, pts: 5 }]); // a dup id banks once
  ok(bondOf(ROSTER[0].id) === 5 && bondLv(ROSTER[0].id) === 1 && b1.ups.length === 2,
    'a stage bank levels each lineup species once');
  ok(b1.dust === 2 * BOND_PAY && dust() === dust0 + 2 * BOND_PAY, 'each bond LV pays its dust');
  ok(bondOf(ROSTER[0].id) === 5, 'the dup stint counted once, not twice');
  const b2 = bankBond([{ id: ROSTER[0].id, pts: 5 }]);
  ok(bondOf(ROSTER[0].id) === 10 && b2.dust === 0 && b2.ups.length === 0,
    'pts under the next tier pay nothing');
  const b3 = bankBond([{ id: ROSTER[0].id, pts: 10 }]); // 20 total — LV2 lands at 12
  ok(bondLv(ROSTER[0].id) === 2 && b3.dust === 2 * BOND_PAY, 'crossing LV2 pays the level');
  ok(topBond(3)[0].id === ROSTER[0].id && topBond(3)[0].pts === 20, 'topBond ranks the ledger');
  const b4 = bankBond([{ id: ROSTER[2].id, pts: 0 }]);
  ok(b4.dust === 0 && bondOf(ROSTER[2].id) === 0, 'a stage-9 pickup banks nothing');
  // in-run payoff: a trusted partner feeds the gym fountain — ROSTER[1]
  // sits at LV1 (still +0), so the diff isolates ROSTER[0]'s LV2 point
  const plain = new Battle(arena, [ROSTER[1], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3)).teamLuck();
  const bonded = new Battle(arena, [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[12]], makeStage(9, 'T'), mulberry32(3)).teamLuck();
  ok(bonded === plain + 1, 'a LV2 partner pays +1 team luck at the fountain');
  if (preBond == null) localStorage.removeItem('pk_bond'); else localStorage.setItem('pk_bond', preBond);

  statPull(25, false); statPull(25, true);
  const pullsLog = (statsDump() as { pulls?: Record<string, [number, number]> }).pulls;
  ok(pullsLog?.[25]?.[0] === 1 && pullsLog[25][1] === 2, 'pull telemetry tallies total + dupes');

  // the starter grant: fires once into an empty wallet, never into a funded one
  localStorage.removeItem('pk_grant');
  spendStars(stars()); // drain — the grant only pays the broke
  ok(starterGrant() && stars() === 60, 'starter grant seeds an empty wallet');
  ok(!starterGrant() && stars() === 60, 'the grant does not pay twice');
  localStorage.removeItem('pk_grant');
  ok(!starterGrant() && stars() === 60, 'a funded wallet gets no grant');

  // v4 migration: a parked v3-shaped run gains revive/stars defaults
  localStorage.setItem('pk_run', JSON.stringify({ eggIn: 0, eggJustLaid: false }));
  localStorage.setItem('pk_ver', '3');
  migrateSaves();
  const parked = JSON.parse(localStorage.getItem('pk_run')!);
  ok(parked.reviveUsed === false && parked.starsRun === 0, 'v4 fills revive + stars tally on parked runs');
  localStorage.removeItem('pk_run');

  // chroma raid: the star boost persists one blob, grants only extend it
  const now = Date.now();
  localStorage.removeItem('pk_boost');
  localStorage.removeItem('pk_raid');
  grantBoost(now + 3600e3, 1.5);
  ok(starBoost(now) === 1.5 && boostLeft(now) > 0, 'star boost banks x1.5 with time left');
  grantBoost(now + 100, 2); // a sooner expiry must not shorten a later one
  ok(starBoost(now) === 1.5 && boostLeft(now) > 3000e3, 'grantBoost only extends — the longer until wins');
  localStorage.setItem('pk_boost', JSON.stringify({ until: now - 1, mult: 9 }));
  ok(starBoost(now) === 1 && boostLeft(now) === 0, 'an expired boost reads as x1');

  // the raid flag keys on the day — stale days don't count
  ok(!raidDoneToday(), 'no raid flag on a clean store');
  markRaidDone();
  ok(raidDoneToday(), 'markRaidDone flips the daily flag');
  localStorage.setItem('pk_raid', JSON.stringify({ day: '1999-01-01' }));
  ok(!raidDoneToday(), 'a stale day key is not done today');

  // the daily pick is seeded off the day and stays epic-or-invader
  const pick = raidPick();
  ok(raidPick().id === pick.id, 'raid pick is deterministic within the day');
  ok(tierOf(pick) >= 3 || INVADER_IDS.has(pick.id), 'raid pick is epic-or-invader');
  ok(!!speciesById(pick.id), 'raid pick resolves via speciesById');

  // the raid team: three unique lvl-30 species, stable across calls
  const rt = raidTeam();
  ok(rt.length === 3 && new Set(rt.map((d) => d.id)).size === 3, 'raid team is 3 unique species');
  ok(rt.every((d) => !!speciesById(d.id) && d.lvl === 30), 'raid team resolves at lvl 30');
  ok(raidTeam().map((d) => d.id).join() === rt.map((d) => d.id).join(), 'raid team is deterministic');
  rt[0].lvl = 99; // entries are fresh copies, not the pool defs
  ok(raidTeam()[0].lvl === 30, 'raid team hands out fresh lvl-30 copies');

  // login calendar: one drop a day, chained days escalate, gaps pay a comeback
  const DAY_MS = 86400000;
  const base = Date.now();
  const sLogin = stars();
  loginCheck(); // boot already banked today's drop — re-entry is a no-op
  ok(stars() === sLogin, 'a second same-day login pays nothing');
  const lt0 = loginToday()!;
  ok(lt0.n >= 1 && lt0.prize >= 20, 'today\'s login drop is recorded');
  loginCheck(base + DAY_MS);
  const lt1 = loginToday(base + DAY_MS)!;
  ok(lt1.n === lt0.n + 1 && lt1.prize === Math.min(20 + lt0.n * 10, 100), 'a chained day escalates the prize');
  for (let d = 2; d <= 6; d++) loginCheck(base + d * DAY_MS);
  ok(loginToday(base + 6 * DAY_MS)!.prize === 150, 'day 7 pays the milestone spike');
  loginCheck(base + 11 * DAY_MS); // a 5-day gap — the chain snaps, the comeback pays
  const ltB = loginToday(base + 11 * DAY_MS)!;
  ok(ltB.n === 1 && ltB.back === 60, 'a lapsed login resets and pays the comeback');

  // streak-at-risk: an unbanked chain warns, a banked one stays quiet
  bumpStreaks(true, true, base - 2 * DAY_MS);
  bumpStreaks(true, true, base - DAY_MS);
  ok(streakRisky() >= 2, 'a chain that died overnight reads as at-risk');
  bumpStreaks(true, true, base);
  ok(streakRisky() === 0, 'a banked chain is safe');

  // first-win-of-day: banks once, the boost multiplies, next day pays again
  const fwWant = Math.ceil(50 * starBoost(base + 11 * DAY_MS));
  const sW = stars();
  const fw = firstWinBonus();
  ok(fw === Math.ceil(50 * starBoost()) && stars() === sW + fw, 'first clear of the day pays its bonus');
  ok(firstWinBonus() === 0, 'the daily first-win pays once');
  ok(firstWinBonus(base + 11 * DAY_MS) === fwWant, 'the next day pays again');

  // session escalation: run n pays min(10n, 40), resets on a fresh UTC day
  localStorage.removeItem('pk_grind');
  const boostNow = starBoost();
  const g1 = grindBonus();
  ok(g1.n === 1 && g1.pay === Math.ceil(10 * boostNow), 'first run of the day pays the floor');
  const g2 = grindBonus();
  ok(g2.n === 2 && g2.pay === Math.ceil(20 * boostNow), 'the next run pays more');
  grindBonus();
  grindBonus();
  const g5 = grindBonus();
  ok(g5.pay === Math.ceil(40 * boostNow), 'the session payout caps at 40');
  ok(grindBonus(base + DAY_MS).n === 1, 'the counter resets on a new day');

  // the daily deal: one seeded rare+ mon at a seeded deep cut, same for everyone today
  const deal = dealPick();
  ok(dealPick().id === deal.id, 'deal pick is deterministic within the day');
  ok(tierOf(deal) >= 2 || INVADER_IDS.has(deal.id), 'the deal is rare-or-better');
  ok(deal.id !== raidPick().id && deal.id !== featuredPull().id, 'the deal never mirrors the raid or rate-up');
  ok(dealOff() >= 50 && dealOff() <= 75, `the day's cut stays a deep bargain (${dealOff()}% off)`);
  ok(dealCost(deal) === Math.ceil(dustCost(deal) * (1 - dealOff() / 100)), 'the deal species prices at the day\'s cut');
  const utcNoon = Date.UTC(2024, 5, 10, 12);
  ok(dealOff(utcNoon) === dealOff(utcNoon + 3600000), 'same UTC day hits the memo\'d deal cut');
  const offDeal = PULLABLE.find((d) => d.id !== deal.id)!;
  ok(dealCost(offDeal) === dustCost(offDeal), 'every other species keeps list price');

  // the weekend window: Sat/Sun UTC doubles shiny odds, weekdays stay flat
  const sat = Date.UTC(2026, 9, 24); // 2026-10-24 is a Saturday
  const mon = Date.UTC(2026, 9, 26); // 2026-10-26 is a Monday
  ok(shinyOdds(sat) === PULL_SHINY * 2, 'weekend pulls double the shiny roll');
  ok(shinyOdds(mon) === PULL_SHINY, 'weekday pulls hold the base odds');
}

// --- dex milestones, the daily free pull, and the KO bounty ---------------
// pk_dex is forged straight into the store — dexIds() reads the blob verbatim
{
  ok(
    DEX_REWARDS.length >= 3 &&
      DEX_REWARDS.every((r, i) => r.pay > 0 && (i === 0 || r.at > DEX_REWARDS[i - 1].at)),
    `dex rewards: ${DEX_REWARDS.length} tiers ascending by at, every pay > 0`,
  );
  const dexSave = localStorage.getItem('pk_dex'); // the real dex goes back after
  const fakeDex = (n: number, base: number) =>
    localStorage.setItem('pk_dex', JSON.stringify(Array.from({ length: n }, (_, i) => base + i)));

  // a claim pays every crossed tier, in order, exactly once
  fakeDex(DEX_REWARDS[1].at, 9000);
  ok(
    nextDexReward()?.at === DEX_REWARDS[0].at && nextDexReward()?.pay === DEX_REWARDS[0].pay,
    'the first unclaimed tier is next up',
  );
  const sD = stars();
  const wantD = DEX_REWARDS.slice(0, 2);
  const gotD = claimDexRewards();
  ok(
    gotD.length === 2 && gotD.every((r, i) => r.at === wantD[i].at && r.pay === wantD[i].pay),
    `a ${DEX_REWARDS[1].at}-deep dex claims the first two tiers in order`,
  );
  ok(stars() === sD + wantD[0].pay + wantD[1].pay, `each tier banks its pay (+${stars() - sD})`);
  ok(claimDexRewards().length === 0, 'a claimed tier never pays twice');

  // a real catch crossing the third tier pays only that one
  recordCapture(Array.from({ length: DEX_REWARDS[2].at - DEX_REWARDS[1].at }, (_, i) => 8000 + i));
  ok(nextDexReward()?.at === DEX_REWARDS[2].at, 'the third tier is next once crossed');
  const sD2 = stars();
  const gotD2 = claimDexRewards();
  ok(
    gotD2.length === 1 && gotD2[0].at === DEX_REWARDS[2].at && stars() === sD2 + DEX_REWARDS[2].pay,
    'only the newly-crossed tier pays',
  );

  // a maxed dex claims the rest of the ladder — then nothing is left
  fakeDex(DEX_REWARDS[DEX_REWARDS.length - 1].at, 7000);
  const sD3 = stars();
  const restD = DEX_REWARDS.slice(3);
  const gotD3 = claimDexRewards();
  ok(
    gotD3.length === restD.length &&
      gotD3.every((r, i) => r.at === restD[i].at && r.pay === restD[i].pay) &&
      stars() === sD3 + restD.reduce((s, r) => s + r.pay, 0),
    'a full dex claims every remaining tier',
  );
  ok(nextDexReward() === null && claimDexRewards().length === 0, 'nothing left once every tier pays');

  // LATEST CATCHES: the strip reads the dex tail, newest first — still
  // inside the forged dex so the fake ids never touch the real save
  for (const id of [9601, 9602, 9603, 9604]) recordCapture([id]);
  ok(
    dexRecent(3).join(',') === '9604,9603,9602',
    `dexRecent(3) returns the last 3 catches newest-first (${dexRecent(3).join(',')})`,
  );
  ok(dexRecent().length === 3 && dexRecent().join(',') === dexRecent(3).join(','), 'dexRecent() defaults to 3 entries');
  if (dexSave == null) localStorage.removeItem('pk_dex');
  else localStorage.setItem('pk_dex', dexSave);

  // the daily free pull: clean store → on the house, spent → gone, back tomorrow
  localStorage.removeItem('pk_free');
  ok(freePullLeft(), 'a clean pk_free leaves the daily pull available');
  useFreePull();
  ok(!freePullLeft(), 'useFreePull spends today\'s pull');
  ok(freePullLeft(Date.now() + 86400000), 'a fresh day re-arms the free pull');
  localStorage.removeItem('pk_free');

  // the KO bounty: every 5th enemy KO pays +5 stars into the run tally
  const kb = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  kb.traits.clear(); // keep the count exact — no trait splash KOs
  // a live task ping: BATTLE TESTED sits one KO short when the fight starts
  saveTaskState({ day: dayKey(Date.now()), dp: { kos: 14 }, dsel: ['d-kos'], dclaim: [], week: weekKey(Date.now()), wp: {}, wsel: [], wclaim: [] });
  const sK = kb.starsRun;
  let taskPing = false; // the cap is small — catch the ping before later banners evict it
  for (let w = 0; w < 3 && (kb as any).totalKos < 5; w++) {
    (kb as any).spawnWave(w);
    // Keep clear rank at C so this assertion isolates the KO bounty.
    (kb as any).stopShots = Math.ceil((kb as any).par * 1.5) + 1;
    (kb as any).stopFaints = 1;
    for (const e of [...(kb as any).enemies]) {
      while (!e.dead && (kb as any).totalKos < 5) {
        (kb as any).hurt(e, e.hp + 50, '#fff');
        taskPing ||= (kb as any).texts.some((tx: any) => tx.text === 'TASK: BATTLE TESTED ✓');
      }
      if ((kb as any).totalKos >= 5) break;
    }
  }
  const wantK = Math.ceil(5 * (kb as any).starMult * starBoost());
  ok(
    (kb as any).totalKos >= 5 && kb.starsRun === sK + wantK,
    `the 5th enemy KO pays its star bounty (+${kb.starsRun - sK})`,
  );
  ok(taskPing, 'crossing a task goal pings mid-fight, not at the report');
  localStorage.removeItem('pk_tasks');
}

// --- evolution-line sets: a completed line pays its star bounty once ------
{
  const dexSave = localStorage.getItem('pk_dex'); // the real dex goes back after
  const setsSave = localStorage.getItem('pk_sets');
  localStorage.setItem('pk_dex', '[]'); // a valid empty blob — memDex stays out of it
  localStorage.removeItem('pk_sets');

  ok(
    EVO_LINES.length > 0 &&
      EVO_LINES.every((l) => l.ids.length > 1 && l.ids[0] === l.root && l.ids.every((id) => !!speciesById(id))),
    `${EVO_LINES.length} evo-line sets — every line is a root plus a descendant`,
  );
  ok(setPay(EVO_LINES[0]) === 10 * EVO_LINES[0].ids.length, 'set pay scales with line length');
  ok(setsReady().length === 0 && setProgress().every((p) => p.have === 0), 'an empty dex readies no sets');
  ok(claimSet(EVO_LINES[0].root) === 0, 'claiming an incomplete line pays nothing');

  // a dex holding the whole line readies exactly that root
  const line = EVO_LINES[0];
  recordCapture(line.ids);
  ok(setsReady().join() === String(line.root), `a full line readies its set (${speciesById(line.root)?.name})`);
  const prog = setProgress().find((p) => p.root === line.root)!;
  ok(prog.have === prog.need && prog.need === line.ids.length, `setProgress reads ${prog.have}/${prog.need}`);

  // the claim banks setPay stars once — a second tap reads 0
  const sS = stars();
  ok(claimSet(line.root) === setPay(line) && stars() === sS + setPay(line), `the set claim pays +${setPay(line)} stars`);
  ok(claimSet(line.root) === 0 && stars() === sS + setPay(line), 'the same set never pays twice');
  ok(setsReady().length === 0, 'a claimed set leaves the ready list');

  // a corrupt pk_sets falls back to the memory copy — the claim survives
  localStorage.setItem('pk_sets', '{broken');
  ok(setsReady().length === 0 && claimSet(line.root) === 0, 'corrupt pk_sets keeps the claimed line claimed');
  // a valid array is authoritative — foreign ids aren't roots, so the set re-readies
  localStorage.setItem('pk_sets', '[999999]');
  ok(setsReady().join() === String(line.root), 'a foreign pk_sets array re-readies the unclaimed set');

  if (dexSave == null) localStorage.removeItem('pk_dex');
  else localStorage.setItem('pk_dex', dexSave);
  if (setsSave == null) localStorage.removeItem('pk_sets');
  else localStorage.setItem('pk_sets', setsSave);
}

// --- the rookie ladder + the first-boot help flag --------------------------
{
  const bestSave = localStorage.getItem('pk_best'); // the real record goes back
  const pullSave = localStorage.getItem('pk_pulls');
  // {n:0} beats removeItem — the memRookie fallback would resurrect any
  // earlier suite claim under a missing blob
  localStorage.setItem('pk_rookie', JSON.stringify({ n: 0 }));
  ok(
    ROOKIE_STEPS.length === 5 && ROOKIE_STEPS.every((r, i) => r.pay > 0 && (i === 0 || true)),
    `rookie board: ${ROOKIE_STEPS.length} steps, every pay > 0`,
  );
  ok(nextRookie()?.label === 'PLAY A CLIMB', 'the ladder starts at PLAY A CLIMB');

  // a first run that reached stage 3 clears steps in order — earlier suite
  // pulls may have already armed 'HATCH A MON', so assert order not count
  localStorage.setItem('pk_best', JSON.stringify({ score: 100, stage: 3, wins: 0, runs: 1 }));
  const sR = stars();
  const gotR = rookieCheck();
  ok(
    gotR.length >= 2 && gotR[0].label === 'PLAY A CLIMB' && gotR[1].label === 'REACH STAGE 3',
    `one run clears the ladder in order (${gotR.map((r) => r.label).join(' / ')})`,
  );
  ok(stars() === sR + gotR.reduce((s, r) => s + r.pay, 0), `each step banks its pay (+${stars() - sR})`);
  ok(rookieCheck().length === 0, 'a cleared step never pays twice');

  // whatever's left — hatch → task claim → win — finishes the board
  bumpPulls();
  saveTaskState({ day: dayKey(Date.now()), dp: {}, dsel: [], dclaim: ['d-kos'], week: weekKey(Date.now()), wp: {}, wsel: [], wclaim: [] });
  localStorage.setItem('pk_best', JSON.stringify({ score: 100, stage: 9, wins: 1, runs: 1 }));
  const sR2 = stars();
  const gotR2 = rookieCheck();
  ok(
    stars() === sR2 + gotR2.reduce((s, r) => s + r.pay, 0) && nextRookie() === null,
    `pull + claim + win finish the board (+${stars() - sR2})`,
  );
  ok(rookieCheck().length === 0, 'a finished ladder stays finished');

  // first-boot help: unseen until marked, stays marked
  localStorage.removeItem('pk_seen');
  ok(!helpSeen(), 'a fresh store has never opened the deck');
  markHelpSeen();
  ok(helpSeen(), 'markHelpSeen sticks');

  if (bestSave == null) localStorage.removeItem('pk_best');
  else localStorage.setItem('pk_best', bestSave);
  if (pullSave == null) localStorage.removeItem('pk_pulls');
  else localStorage.setItem('pk_pulls', pullSave);
  localStorage.removeItem('pk_rookie');
  localStorage.removeItem('pk_tasks');
}

// --- town villagers stroll their beats -------------------------------------
// The t-keyed wander must stay inside each box, move continuously (a leg's
// walk always completes inside its window, so boundaries can't teleport), and
// only name frames the npc atlas actually ships — norman flips left_* for
// right because the pack never drew his right side.
{
  const atlas = JSON.parse(readFileSync('public/sprites/gracidea/npcs.json', 'utf8')) as { frames: Record<string, unknown> };
  let inBox = true, cont = true, realFrame = true, roams = 0;
  for (const w of TOWN_FOLK) {
    let px = w.hx, py = w.hy, minX = Infinity, maxX = -Infinity;
    for (let t = 0; t <= 240; t += 0.06) {
      const s = townStrollAt(w, t);
      if (s.x < w.x0 - 0.01 || s.x > w.x1 + 0.01 || s.y < w.y0 - 0.01 || s.y > w.y1 + 0.01) inBox = false;
      if (Math.hypot(s.x - px, s.y - py) > w.speed * 0.06 + 0.5) cont = false;
      if (!atlas.frames[s.frame]) realFrame = false;
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      px = s.x; py = s.y;
    }
    if (maxX - minX > 30) roams++;
  }
  ok(inBox, 'villager strolls stay inside their beat boxes');
  ok(cont, 'villager walks are continuous — no leg-boundary teleports');
  ok(realFrame, 'every stroll frame exists in the npc atlas');
  ok(roams === TOWN_FOLK.length, `all ${TOWN_FOLK.length} villagers actually roam (${roams} ranged >30px)`);
}

// --- fuzz: garbage in any pk_* key can't throw or NaN a reader -------------
// A truncated/corrupt/foreign blob is the returning-player risk — every
// reader must fall back to its memory copy or defaults, never propagate junk.
{
  const KEYS = [
    'pk_dex', 'pk_dex_shiny', 'pk_dexrw', 'pk_rookie', 'pk_coach', 'pk_gyms',
    'pk_rating', 'pk_board', 'pk_echo', 'pk_best', 'pk_asc', 'pk_ach',
    'pk_badges', 'pk_bag', 'pk_stars', 'pk_dust', 'pk_pulls', 'pk_free',
    'pk_grant', 'pk_boost', 'pk_raid', 'pk_login', 'pk_win', 'pk_grind',
    'pk_lab', 'pk_seen', 'pk_stats', 'pk_run', 'pk_settings', 'pk_tasks',
    'pk_streak', 'pk_ver', 'pk_trainer', 'pk_sets', 'pk_bond',
  ];
  const JUNK = [
    '{broken', '42', '"str"', 'true', '[]', '{}', '[1,"x",null]',
    '{"n":"x"}', '1e999', '{"day":42,"n":[1],"team":"x"}', 'null', '',
  ];
  const now = Date.now();
  const READERS: [string, () => unknown][] = [
    ['dexIds', () => dexIds()], ['shinyIds', () => shinyIds()],
    ['setProgress', () => setProgress()], ['setsReady', () => setsReady()],
    ['unlockedAch', () => unlockedAch()], ['coachDone', () => coachDone()],
    ['best', () => best()], ['gymBadges', () => gymBadges()],
    ['rating', () => rating()], ['tier', () => tier()], ['board', () => board()],
    ['taskState', () => taskState()], ['streakDaily', () => streakDaily(now)],
    ['streakWins', () => streakWins()], ['runSave', () => runSave()],
    ['stars', () => stars()], ['dust', () => dust()], ['pullCount', () => pullCount()],
    ['labLevel', () => labLevel('hp')], ['starterGrant', () => starterGrant()],
    ['starBoost', () => starBoost(now)], ['boostLeft', () => boostLeft(now)],
    ['raidDoneToday', () => raidDoneToday(now)], ['loginToday', () => loginToday(now)],
    ['streakRisky', () => streakRisky(now)], ['bagStock', () => bagStock()],
    ['settings', () => settings()], ['freePullLeft', () => freePullLeft(now)],
    ['nextDexReward', () => nextDexReward()], ['nextRookie', () => nextRookie()],
    ['helpSeen', () => helpSeen()], ['statsDump', () => statsDump()],
    ['ascPick', () => ascPick()], ['trainerPick', () => trainerPick()],
    ['bondOf', () => bondOf(25)], ['topBond', () => topBond(3)],
    ['taskViews-d', () => taskViews('daily', now)],
    ['taskViews-w', () => taskViews('weekly', now)], ['featuredPull', () => featuredPull(now)],
    ['raidPick', () => raidPick(now)], ['dealPick', () => dealPick(now)],
    ['tasksReady', () => tasksReady(now)], ['taskResetsIn', () => taskResetsIn('daily', now)],
  ];
  const throwers = new Map<string, number>();
  let badReads = 0;
  for (const k of KEYS) {
    for (const j of JUNK) {
      localStorage.setItem(k, j);
      for (const [name, fn] of READERS) {
        try {
          fn();
        } catch {
          throwers.set(name, (throwers.get(name) ?? 0) + 1);
        }
      }
      try {
        // shape assertions on the values readers can leak
        if (!Number.isFinite(stars()) || !Number.isFinite(dust()) || !Number.isFinite(rating()) || !Number.isFinite(pullCount())) badReads++;
        if (!Array.isArray(dexIds()) || !Array.isArray(board()) || !Array.isArray(taskState().dsel)) badReads++;
        const rs = runSave();
        if (rs !== null && (!Array.isArray(rs.team) || !Number.isFinite(rs.seed))) badReads++;
        const st = settings();
        if (!(st.master >= 0 && st.master <= 1) || !['high', 'medium', 'low'].includes(st.quality)) badReads++;
        if (!/^[a-z_0-9]+$/.test(trainerPick())) badReads++;
      } catch {
        badReads++;
      }
    }
    localStorage.removeItem(k);
  }
  const threw = [...throwers.values()].reduce((a, b) => a + b, 0);
  ok(throwers.size === 0, `fuzz: ${KEYS.length} keys x ${JUNK.length} junk blobs — throws: ${[...throwers.entries()].map(([n, c]) => `${n}×${c}`).join(' ') || 'none'}`);
  ok(badReads === 0, `fuzz: readers stayed sane under junk — ${badReads} bad reads`);
  // the suite's mem copies survived the fuzz — real state still reads back
  ok(Number.isFinite(stars()) && Array.isArray(dexIds()), 'memory copies cover a wiped store');
}

// --- MS telops: one battle banner at a time, priority queue, skippable ----------
{
  ok(Object.values(TELOP_SPEC).every((s) => s.dur <= 1), 'every banner sweeps in, holds and out inside 1s');
  const q = new Telops();
  q.push({ kind: 'weak', title: 'WEAK POINT' });
  q.update(0.01);
  ok(q.cur?.kind === 'weak', 'first push goes live on the next tick');
  q.push({ kind: 'boss', title: 'BOSS INCOMING' });
  q.update(0.2);
  ok(q.cur?.kind === 'boss', 'a boss call cuts a minor banner short');
  q.push({ kind: 'clear', title: 'WAVE CLEAR' });
  q.update(0.05);
  ok(q.cur?.kind === 'boss' && q.queue.length === 1, 'big beats never cut each other, they queue');
  q.push({ kind: 'clear', title: 'STAGE CLEAR' });
  ok(q.queue.length === 1 && q.queue[0].title === 'STAGE CLEAR', 'a repeat kind restyles the queued copy');
  q.push({ kind: 'combo', title: 'NICE COMBO' });
  q.update(1.2);
  ok(q.cur?.kind === 'clear' && !q.texts().includes('NICE COMBO'), 'stale juice drops out of the queue');
  ok(q.skip() && !q.skip(), 'a tap jumps to the sweep-out once');
  q.update(0.2);
  ok(!q.cur, 'a skipped banner clears inside its sweep-out');
  q.push({ kind: 'start', title: 'BATTLE 1/3' });
  q.push({ kind: 'speed', title: 'SPEED CLEAR' });
  q.push({ kind: 'over', title: 'GAME OVER' });
  q.update(0.01);
  ok(q.cur?.kind === 'over' && !q.queue.length, 'GAME OVER clears the queue and plays first');
  ok(q.once('weak7') && !q.once('weak7'), 'first-hit keys fire once');
  ok(comboTier(3)?.[1] === 'NICE COMBO' && comboTier(5) && comboTier(8) && !comboTier(4), 'combo tiers at 3 · 5 · 8');

  // battle wiring: start, boss, clears, ULT READY, game over
  const b = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (b as any).spawnWave(1);
  ok(/^BATTLE \d\/\d · .* · /.test(b.telop.texts()) && b.telop.texts().includes(STAGE_GIMMICKS[(b as any).theme].label), `stop opens on BATTLE n/m + gimmick (${b.telop.texts()})`);
  (b as any).battles = 1;
  (b as any).stopShots = (b as any).par;
  (b as any).waveCleared();
  ok(b.telop.texts().includes('SPEED CLEAR') && /(WAVE|STAGE) CLEAR/.test(b.telop.texts()), `clear + SPEED CLEAR banners queue (${b.telop.texts()})`);
  const g = new Battle(arena, team(), makeStage(31, 'T'), mulberry32(11));
  (g as any).spawnWave(2);
  ok(g.telop.texts().includes('BOSS INCOMING'), 'a gym court calls the boss in');
  const boss = (g as any).enemies.find((e: any) => e.boss);
  ok(boss && /^badges\//.test(g.telop.queue.find((t) => t.kind === 'boss')?.icon ?? ''), 'the gym boss banner carries its badge');
  const u0 = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  (u0 as any).spawnWave(0);
  (u0 as any).courtT = -9;
  u0.telop = new Telops();
  let ults = 0;
  const push0 = u0.telop.push.bind(u0.telop);
  u0.telop.push = (t) => { if (t.kind === 'ult') ults++; push0(t); };
  for (let i = 0; i < 2; i++) {
    u0.phase = 'aim';
    u0.ultIn = 1 - i;
    const u = (u0 as any).active;
    u0.pointerDown({ x: u.x, y: u.y });
    u0.pointerMove({ x: u.x + 60, y: u.y + 40 });
    u0.pointerUp();
  }
  ok(ults === 0, `ULT READY stays on the chip pulse — no banner (${ults})`);
  (u0 as any).wipe();
  ok(u0.telop.queue.some((t) => t.kind === 'over') || u0.telop.cur?.kind === 'over', 'a wipe calls GAME OVER');
}

// --- Gen 3 battle-animation hooks ---------------------------------------
{
  for (const type of TYPES) {
    const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
    b['spawnWave'](0);
    b['courtT'] = -9;
    const e = b.enemies[0];
    e.def = { ...e.def, type };
    clearAnims();
    b['fireMove'](e, { ...TYPE_MOVE[type], turn: 5, t: 0 });
    if (TYPE_MOVE[type].kind === 'meteor') b.update(0.01);
    ok(animCount() > 0 && animCount() <= MAX_ANIMS, `${type} foe move spawns capped sprites`);
    clearAnims();
    e.dead = true;
    b['fireMove'](e, { ...TYPE_MOVE[type], turn: 5, t: 0 });
    ok(animCount() === 0, `${type} dead foe spawns no sprites`);
  }
  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  b['spawnWave'](0);
  const powers: number[] = [];
  clearAnims();
  b['castSignature']('THUNDERBOLT', b.players[0], b.players[0], (_e, power) => { powers.push(power); return 1; });
  ok(powers[0] === 2.2 && animCount() > 0, 'signature visuals preserve the damage callback power');
  clearAnims();
  for (const p of b.players) p.dead = true;
  b['fireMove'](b.enemies[0], { kind: 'laser', move: 'HYPER BEAM', turn: 5, t: 0 });
  ok(animCount() === 0, 'laser without a live target spawns no sprites');
  for (const e of b.enemies) e.dead = true;
  ok(!b['castSignature']('THUNDERBOLT', b.players[0], b.players[0], () => 1) && animCount() === 0,
    'signature without live foes spawns no sprites');
  b['spawnWave'](0);
  burst(MOVE_ANIM.fire, 0, 0, false);
  b['spawnWave'](0);
  ok(animCount() === 0, 'wave reset clears sprites');
}

// --- Gen 3 battle-animation pool ----------------------------------------
{
  clearAnims();
  ok(animCount() === 0, 'animation pool starts empty');
  for (const type of TYPES) {
    ok(!!MOVE_ANIM[type], `${type} has a Gen 3 recipe`);
    ok(recipeFor(type, TYPE_MOVE[type].move) === MOVE_ANIM[type], `${TYPE_MOVE[type].move} resolves its recipe`);
    const r = MOVE_ANIM[type];
    beam(r, 0, 0, 100, 100); burst(r, 100, 100, true); rain(r, 100, 100); ring(r, 100, 100, 80);
    stepAnims(1);
    ok(animCount() === 0, `${type} recipes finish within gameplay timings`);
  }
  ok(recipeFor('fire', 'ICE BEAM').sheet === 'ice', 'named move overrides the type recipe');
  ok(recipeFor('fire', 'SHADOW BALL') === MOVE_ANIM.ghost, 'Shadow Ball overrides its type');
  ok(recipeFor('normal', 'EARTHQUAKE').sheet === 'dirt', 'Earthquake uses dirt');
  ok(recipeFor('fire', 'unknown') === MOVE_ANIM.fire && recipeFor('fire', 'toString') === MOVE_ANIM.fire,
    'unknown move names fall back to the type');
  for (const s of Object.values(SHEETS)) ok(existsSync(`public/${s.src}`), `${s.src} is vendored`);
  clearAnims();
  for (let i = 0; i < 100; i++) spawnAnim('impact', 0, 0);
  ok(animCount() === MAX_ANIMS && !spawnAnim('impact', 0, 0), '100 effects stay within the 24-slot hard cap');
  stepAnims(1);
  ok(animCount() === 0, 'expired animations release every slot');
  for (let i = 0; i < SOFT_CAP; i++) spawnAnim('spark', 0, 0);
  ok(!spawnAnim('spark', 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 20, false, 0, 0.3, false, false, true),
    'particles skip at the soft cap');
  ok(animCount() === SOFT_CAP && spawnAnim('impact', 0, 0), 'core impact still spawns above the soft cap');
  clearAnims();
  for (let i = 0; i < SOFT_CAP; i++) spawnAnim('spark', 0, 0);
  beam(MOVE_ANIM.fire, 0, 0, 100, 100);
  ok(animCount() === SOFT_CAP + 1, 'beam stream skips extra particles above the soft cap');
  const stub = {} as CanvasRenderingContext2D;
  drawAnims(stub); drawTell(stub, 'electric', 0, 0, 100, 100, 1); drawTellRing(stub, 'water', 0, 0, 80, 1);
  ok(true, 'headless unloaded sprite draws safely skip the canvas');
  clearAnims();
  ok(!spawnAnim('impact', 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 20, false, 0, 0), 'zero-life spawns are rejected');
  spawnAnim('impact', 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 20, false, 0.2, 0.3);
  stepAnims(0.1); stepAnims(0);
  ok(animCount() === 1, 'delay and zero dt preserve a queued effect');
  stepAnims(0.5);
  ok(animCount() === 0, 'a step crossing delay and lifetime drains the effect');
  burst(MOVE_ANIM.electric, 0, 0, false);
  const requests = drainAnimRequests();
  ok(requests.shake === 7 && requests.color === MOVE_ANIM.electric.color && requests.duration > 0,
    'recipes request shake and flash');
  const again = drainAnimRequests();
  ok(again === requests && again.shake === 0 && again.duration === 0, 'request drain reuses its object and consumes requests');
  clearAnims();
  ok(animCount() === 0 && drainAnimRequests().shake === 0, 'clear resets instances and requests');
  drawAnims(stub);
}

// --- MS hit floor: landed hits deal at least 1, immunity stays 0 ---
{
  ok(hitFloor(0.2, 0.5) === 1, 'positive multiplier floors sub-one damage to 1');
  ok(hitFloor(0, 0.25) === 1, 'positive multiplier floors zero raw damage to 1');
  ok(hitFloor(7.6, 2) === 8, 'hit floor rounds damage normally above 1');
  ok(hitFloor(5, 0) === 0, 'type immunity stays at 0');
  ok(hitFloor(1.4, 1) === 1, 'positive multiplier preserves rounded 1 damage');
}

// --- clear ranks: MS-style S/A/B/C, per-stage bests only go up ---
{
  ok(clearRank(10, 10, 0) === 'S' && clearRank(5, 10, 0) === 'S', 'on-par and faster clears rank S');
  ok(clearRank(10, 10, 1) === 'A' && clearRank(15, 10, 0) === 'A', 'a faint or 1.5x par ranks A');
  ok(clearRank(16, 10, 0) === 'B' && clearRank(15, 10, 1) === 'B', 'slow clear or faint plus 1.5x par ranks B');
  ok(clearRank(16, 10, 1) === 'C' && clearRank(40, 10, 3) === 'C', 'slow clear with a faint ranks C');
  ok(RANK_PAY.S > RANK_PAY.A && RANK_PAY.A > RANK_PAY.B && RANK_PAY.B > RANK_PAY.C && RANK_PAY.C === 0, 'clear-rank star pays descend S to C');
  ok(Object.values(RANK_BALL).every((ball) => existsSync(`public/sprites/items/${ball}.png`)), 'every clear-rank ball sprite is vendored');

  const beforeCorrupt = clearBests();
  localStorage.setItem('pk_clear', '{corrupt');
  let afterCorrupt: ReturnType<typeof clearBests> = {};
  let corruptThrew = false;
  try {
    afterCorrupt = clearBests();
  } catch {
    corruptThrew = true;
  }
  ok(!corruptThrew && JSON.stringify(afterCorrupt) === JSON.stringify(beforeCorrupt), 'a corrupt clear blob falls back to valid session records');

  const beforeShape = clearBests();
  localStorage.setItem('pk_clear', JSON.stringify({
    '3': { rank: 'x', turns: 1, combo: 1 },
    '4': { rank: 1, turns: 12, combo: 5 },
    '5': { rank: 9, turns: 1, combo: 1 },
    '6': { rank: 0, turns: -1, combo: 2 },
  }));
  const shaped = clearBests();
  ok(JSON.stringify(shaped['4']) === JSON.stringify({ rank: 1, turns: 12, combo: 5 }), 'clear store keeps valid raw bests');
  ok(['3', '5', '6'].every((key) => JSON.stringify(shaped[key]) === JSON.stringify(beforeShape[key])), 'malformed raw entries do not replace session bests');

  const noBest = recordClear(4, 'B', 20, 3);
  ok(!noBest.rank && !noBest.turns && !noBest.combo, 'an existing record is not a first-clear best');
  ok(JSON.stringify(clearBests()['4']) === JSON.stringify({ rank: 1, turns: 12, combo: 5 }), 'worse records never replace stage bests');
  const allBest = recordClear(4, 'S', 9, 7);
  ok(allBest.rank && allBest.turns && allBest.combo, 'strict rank, turn, and combo improvements flag separately');
  ok(JSON.stringify(clearBests()['4']) === JSON.stringify({ rank: 0, turns: 9, combo: 7 }), 'improved records replace prior stage bests');
  const comboBest = recordClear(4, 'A', 11, 8);
  ok(!comboBest.rank && !comboBest.turns && comboBest.combo, 'only a strictly higher combo flags');
  ok(JSON.stringify(clearBests()['4']) === JSON.stringify({ rank: 0, turns: 9, combo: 8 }), 'each stage best keeps the best value for each metric');
  const firstClear = recordClear(99, 'S', 5, 5);
  ok(!firstClear.rank && !firstClear.turns && !firstClear.combo && !!clearBests()['99'], 'a first clear creates a record without a best flag');

  const b = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b as any).spawnWave(0);
  (b as any).stopShots = (b as any).par;
  (b as any).stopFaints = 0;
  (b as any).stopCombo = 4;
  const starsBefore = b.starsRun;
  (b as any).waveCleared();
  ok(b.clearCard?.rank === 'S', 'a climb stop clear creates an S-rank card');
  ok((b.clearCard?.pay ?? 0) >= RANK_PAY.S && b.starsRun === starsBefore + (b.clearCard?.pay ?? 0), 'clear-card pay matches credited run stars');
  ok(b.rankStreak === 1 && b.bestRankStreak === 1, 'an A-or-better clear starts the rank streak');
  (b as any).spawnWave(1);
  ok(b.clearCard === null, 'the next wave clears the prior stop card');
  const b2 = new Battle(arena, team(), makeStage(4, 'T'), mulberry32(3));
  (b2 as any).spawnWave(0);
  b2.raid = true;
  (b2 as any).waveCleared();
  ok(b2.clearCard === null, 'raid clears do not create a climb clear card');
}

// --- Pokémon ability counters: real species and scripted court contact ---
{
  ok(ALL_SPECIES.every((def) => typeof def.ability === 'string' && !!abilityOf(def)?.name), 'every roster and enemy species has a valid canonical ability');
  ok(speciesById(25)!.ability === 'static' && speciesById(35)!.ability === 'cute-charm' && !ABILITIES['magic-guard'], 'Gen 3 mons do not acquire later-generation or hidden abilities');
  ok(Object.values(ABILITIES).filter((a) => a.hint).length === 14, 'only fourteen abilities add new counter mechanics');
  const court = (id: number) => {
    const b: any = new Battle(arena, [speciesById(id)!, speciesById(4)!, speciesById(7)!, speciesById(1)!], makeStage(4, 'T'), mulberry32(18));
    b.spawnWave(0);
    b.enemies = []; b.blocks = []; b.damageWalls = []; b.hazards = []; b.pickups = [];
    b.slowImmune = false; b.activeIdx = 0; b.phase = 'shot'; b.shotGold = true; b.shotT = b.time;
    b.pushText = (text: { text: string }) => b.notices.push(text.text);
    b.notices = [];
    const p = b.players[0];
    p.x = arena.x + arena.w / 2; p.y = arena.y + arena.h / 2; p.vx = 200; p.vy = 0;
    return { b, p };
  };
  for (const id of [92, 4]) {
    const { b, p } = court(id), hp = p.hp;
    b.hazards = [{ kind: 'mine', x: p.x, y: p.y, r: 24, spent: false }];
    b.stepShot(1 / 60);
    ok(id === 92 ? p.hp === hp && !b.hazards[0].spent : p.hp < hp && b.hazards[0].spent, `${p.def.name}: mine immunity changes real contact damage and detonation`);
    if (id === 92) {
      b.stepShot(1 / 60);
      ok(b.notices.filter((t: string) => t === 'LEVITATE').length === 1, 'repeated hazard contact announces an ability once per battle');
      b.nextBattle();
      b.hazards = [{ kind: 'mine', x: p.x, y: p.y, r: 24 }]; b.enemies = []; b.blocks = [];
      b.stepShot(1 / 60);
      ok(b.notices.filter((t: string) => t === 'LEVITATE').length === 2, 'a new battle resets the first-trigger callout');
    }
  }
  const pull = (id: number, gravity = false) => {
    const { b, p } = court(id);
    if (gravity) b.enemies = [{ dead: false, gravR: 160, x: p.x + 60, y: p.y, r: 20, def: speciesById(4)!, vx: 0, vy: 0 }];
    else b.hazards = [{ kind: 'well', x: p.x + 60, y: p.y, r: 160 }];
    b.stepShot(1 / 60);
    return p.vx;
  };
  ok(pull(4) > pull(92) + 10, 'Levitate ignores a pull well while an ordinary mon curves toward it');
  ok(pull(92, true) > pull(4, true) + 10, 'Levitate ignores the gravity carrier slowdown');
  for (const id of [79, 4]) {
    const { b, p } = court(id), y = p.y;
    b.time = 2; b.shotT = b.time;
    b.hazards = [{ kind: 'warp', x: p.x, y, r: 24, pair: 1 }, { kind: 'warp', x: p.x, y: y - 160, r: 24, pair: 1 }];
    b.stepShot(1 / 60);
    ok(id === 79 ? p.y === y : p.y < y - 100, `${p.def.name}: Own Tempo changes paired-warp teleport outcome`);
  }
  const bounce = (id: number, type: 'fire' | 'water' | 'electric') => {
    const { b, p } = court(id);
    b.damageWalls = [{ edge: 'left', start: 0, end: 1, type }];
    p.hp = Math.floor(p.maxHp / 2);
    const hp = p.hp;
    p.x = arena.x + p.r - 1; p.vx = -200;
    b.hitWalls(p);
    return { b, p, hp };
  };
  for (const [id, type] of [[37, 'fire'], [134, 'water'], [170, 'electric'], [104, 'electric']] as const) {
    const { p, hp } = bounce(id, type);
    ok(p.hp > hp, `${p.def.name}: ${p.def.ability} turns a matching wall into a heal, including innate type immunity`);
  }
  const wrongWall = bounce(37, 'water'), plainWall = bounce(4, 'electric'), innateWall = bounce(4, 'fire');
  ok(wrongWall.p.hp < wrongWall.hp && plainWall.p.hp < plainWall.hp && innateWall.p.hp === innateWall.hp, 'unmatched walls still hurt and existing same-type wall immunity stays intact');
  for (const id of [95, 4]) {
    const { b, p } = court(id);
    b.damagePlayer(p, 100000);
    ok(id === 95 ? p.hp === 1 && !p.dead : p.dead, `${p.def.name}: Sturdy changes the lethal-hit outcome`);
    if (id === 95) {
      b.damagePlayer(p, 100000);
      ok(p.dead && b.notices.filter((t: string) => t === 'STURDY').length === 1, 'Sturdy cannot double-dip with the legacy sash');
      p.dead = false; p.hp = p.maxHp;
      b.nextBattle();
      b.damagePlayer(p, 100000);
      ok(p.hp === 1 && !p.dead, 'Sturdy rearms for the next battle');
    }
  }
  for (const id of [183, 307, 4]) {
    const { b, p } = court(id);
    const enemy: any = b.makeEnemy({ def: speciesById(4)!, nx: 0.5, ny: 0.2 }, 0);
    b.enemies = [enemy]; enemy.shieldN = 3;
    b.hurt(enemy, 10, '#fff', '', p);
    ok(enemy.shieldN === (id === 4 ? 2 : 1), `${p.def.name}: power abilities consume an extra Reflect layer`);
  }
  const rainy = court(116), sunny = court(43);
  rainy.b.weather = 'sun'; const dry = rainy.b.swiftMult(rainy.p);
  rainy.b.weather = 'rain'; sunny.b.weather = 'sun';
  ok(rainy.b.swiftMult(rainy.p) > dry && sunny.b.swiftMult(sunny.p) > 1.4, 'Swift Swim and Chlorophyll change actual launch-speed multipliers');
  ok(weatherSpeed('swift-swim', 'sun') === 1 && weatherSpeed('chlorophyll', 'rain') === 1, 'weather counters do not activate in the wrong weather');
  const power = court(183), pure = court(307), guts = court(66), swarm = court(123);
  ok(abilityAttack(power.b, power.p, speciesById(4)!, () => {}) * (power.p.def.huge ? 2 : 1) === 2
    && abilityAttack(pure.b, pure.p, speciesById(4)!, () => {}) * (pure.p.def.huge ? 2 : 1) === 2, 'Huge/Pure Power attack gains do not double legacy flags');
  guts.p.paraT = 2;
  ok(abilityAttack(guts.b, guts.p, speciesById(4)!, () => {}) * (guts.p.def.guts ? 1.5 : 1) === 1.5, 'Guts attack gain does not double the existing status multiplier');
  ok(killerMult(swarm.p.def.ability, speciesById(1)!) === 1.5 && killerMult(swarm.p.def.ability, speciesById(63)!) === 1.5
    && killerMult(swarm.p.def.ability, speciesById(4)!) === 1, 'Swarm Killer checks the target type family');
  const strike = (ability: string, id: number) => {
    const { b, p } = court(123);
    p.def = { ...p.def, ability };
    const e = b.makeEnemy({ def: speciesById(id)!, nx: 0.5, ny: 0.2 }, 0);
    e.hp = e.maxHp = 1000000; e.weakA = -Math.PI / 2; e.shieldN = 0;
    b.enemies = [e]; b.critCh = 0;
    b.strikeEnemy(p, e);
    return e.maxHp - e.hp;
  };
  const killerRatio = strike('swarm', 1) / strike('overgrow', 1);
  ok(killerRatio > 1.4 && killerRatio < 1.6 && strike('swarm', 4) === strike('overgrow', 4), 'Swarm changes real contact damage only against its target family');
  const intimidate = court(23), foe = intimidate.b.makeEnemy({ def: speciesById(4)!, nx: 0.5, ny: 0.2 }, 0);
  const cowed = intimidate.b.foeAtk(foe);
  intimidate.p.dead = true;
  ok(Math.abs(cowed / intimidate.b.foeAtk(foe) - 0.8) < 1e-9, 'a living Intimidate mon lowers foe attack exactly once');
  {
    const { b } = court(4);
    const lo = b.makeEnemy({ def: speciesById(4)!, nx: 0.5, ny: 0.2, lvl: 5 }, 0);
    const hi = b.makeEnemy({ def: speciesById(4)!, nx: 0.5, ny: 0.2, lvl: 50 }, 0);
    ok(b.foeAtk(hi) / b.foeAtk(lo) > 1.5, 'a deep-climb foe hits meaningfully harder than route-1 fodder');
    ok(Math.abs(b.foeAtk(lo) / speciesById(4)!.stats.atk - 1) < 0.05, 'a Lv5 foe attack stays at its old flat value');
  }
  ok(counterHint(STAGE_GIMMICKS.marsh) === 'MINES · LEVITATE HELPS' && countersGimmick(speciesById(92)!, STAGE_GIMMICKS.marsh)
    && !countersGimmick(speciesById(4)!, STAGE_GIMMICKS.marsh), 'stop hints and roster counter flags match the real hazard rule');
}

// --- home: shop ---
import * as S from '../src/game/screens';
{
  const shop = { SHOP_SCENE: S.SHOP_SCENE, HATCH_BTN: S.HATCH_BTN, SHOP_MORE_BTN: S.SHOP_MORE_BTN, DEAL_BTN: S.DEAL_BTN, UPGRADES_BTN: S.UPGRADES_BTN };
  const rs = Object.entries(shop);
  ok(rs.every(([, r]) => r.w >= 44 && r.h >= 44 && r.x >= 0 && r.x + r.w <= 540 && r.y >= 96 && r.y + r.h <= S.TAB_BAR.y - 12),
    'shop: every tap target is >=44px, on screen, and clear of the currency bar and tab bar');
  ok(rs.every(([, r], i) => rs.slice(i + 1).every(([, q]) => r.x + r.w <= q.x || q.x + q.w <= r.x || r.y + r.h <= q.y || q.y + q.h <= r.y)),
    'shop: scene, pull, ×10, deal and upgrade rects never overlap');
  const pk = S.PACK_PILL, ur = S.UPGRADES_BTN;
  ok(pk.h >= 44 && pk.x >= ur.x && pk.y >= ur.y && pk.x + pk.w <= ur.x + ur.w && pk.y + pk.h <= ur.y + ur.h, 'shop: the pack pill sits inside the upgrade rack');
}

// --- home: raid ---
import { raidWeaknesses, raidCounters, raidRefresh } from '../src/game/home/raid';
import { ballFor, ballDrop, DROP_H, DROP_SETTLE } from '../src/game/home/shop';
{
  const boss = { type: 'water' as const, type2: 'flying' as const };
  ok(raidWeaknesses(boss)[0].type === 'electric' && raidWeaknesses(boss)[0].mult === 4, 'raid hints respect dual-type weaknesses');
  const counters = raidCounters(boss, [25, 25, 999999, 4]);
  ok(counters.length === 1 && counters[0].mon.id === 25 && counters[0].mult === 4, 'raid box counters exclude invalid, duplicate and neutral matches');
  ok(raidCounters(boss, []).length === 0, 'raid handles an empty box');
  ok(raidRefresh(Date.UTC(2026, 0, 1)) === '24H 00M' && raidRefresh(Date.UTC(2026, 0, 1, 23, 59, 59)) === '0H 01M', 'raid timer rolls at UTC midnight');
}

// --- home: climb ---
import { FREE_BTN, RESTART_BTN, ASC_BTN, CLIMB_FREE, CLIMB_RAID, ascCellRect, hitAscCell } from '../src/game/screens';
import { ASC_MODS as CLIMB_ASC_MODS } from '../src/game/data';
{
  const overlap = (a: typeof FREE_BTN, b: typeof FREE_BTN) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  let rungs = true;
  for (let i = 0; i <= CLIMB_ASC_MODS.length; i++) {
    const r = ascCellRect(i);
    if (r.w < 44 || r.h < 44 || hitAscCell(r.x + r.w / 2, r.y + r.h / 2) !== i) rungs = false;
  }
  ok(rungs, 'climb: every ascension rung is a >=44px cell that hits itself');
  ok([FREE_BTN, RESTART_BTN, CLIMB_FREE, CLIMB_RAID].every((r) => r.h >= 44), 'climb: hero, restart and door taps are >=44px tall');
  ok(RESTART_BTN.x > FREE_BTN.x + 300 && RESTART_BTN.y === FREE_BTN.y, 'climb: restart flanks the hero row, CONTINUE keeps the wide side');
  const stack = [FREE_BTN, ASC_BTN, CLIMB_FREE, TAB_BAR];
  ok(stack.every((r, i) => i === 0 || !overlap(stack[i - 1], r)) && !overlap(CLIMB_FREE, CLIMB_RAID) && !overlap(CLIMB_RAID, TAB_BAR), 'climb: hero, ladder, doors and nav never overlap');
}

// --- home: mons ---
{
  const rects = [TEAM_BTN, EDIT_TEAM_BTN, DEX_BTN, SETS_BTN, PARTNERS_BTN];
  ok(rects.every((r) => r.h >= 44 && r.x >= 0 && r.x + r.w <= 540 && r.y >= 66 && r.y + r.h <= TAB_BAR.y), 'MONS cards fit above the tab bar with touch-sized targets');
  ok(rects.every((r, i) => rects.slice(i + 1).every((s) => r.x + r.w <= s.x || s.x + s.w <= r.x || r.y + r.h <= s.y || s.y + s.h <= r.y)), 'MONS cards do not overlap');
  ok(teamStageAt(TEAM_BTN.x + 10, TEAM_BTN.y + 10) === null, 'MONS stage band is not a team tap target');
  ok(partnersStripAt(PARTNERS_BTN.x + 4, PARTNERS_BTN.y + 10) === null, 'partners header is not a sprite tap target');
  const pullable = PULLABLE.find((d) => !dexIds().includes(d.id));
  const buy = pullable ? dexBuyRect(pullable.id) : null;
  ok(!!buy && buy.x >= DEX_DETAIL_R.x && buy.x + buy.w <= DEX_DETAIL_R.x + DEX_DETAIL_R.w && buy.y >= DEX_DETAIL_R.y && buy.y + buy.h <= DEX_DETAIL_R.y + DEX_DETAIL_R.h, 'unowned pullable buy target fits inside the detail frame');
}

// --- home: mons (team menu) ---
{
  const team = [0, 1, 2, 3].map(teamSlotRect);
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    r.x >= TEAM_PANEL.x && r.y >= TEAM_PANEL.y &&
    r.x + r.w <= TEAM_PANEL.x + TEAM_PANEL.w && r.y + r.h <= TEAM_PANEL.y + TEAM_PANEL.h;
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  ok(BOX_STRIP.y === 528 && team.every((r) => r.y === 618 && r.h === 100), 'team menu uses the updated box and party row positions');
  ok(team.every((r) => r.h >= 44 && inside(r)), 'team slots are thumb-sized and inside the team panel');
  ok(team.every((r) => [BOX_STRIP, MENU_CLOSE, MENU_QUIT].every((s) => !overlaps(r, s))), 'team slots do not overlap the box strip or menu buttons');
  ok(inside(boxSlotRect(0, 1)), 'first box slot is inside the team panel');
}

// --- hidden weak points (MS hide_wp_rate) ---
{
  ok(hideWpRate(HIDE_WP_RATE, 0, false) === 0 && hideWpRate(HIDE_WP_RATE, 2, false) === 0 && hideWpRate(HIDE_WP_RATE, 8, true) === 0
    && hideWpRate(HIDE_WP_RATE, 4, false) > 0 && hideWpRate(HIDE_WP_RATE, 8, false) > hideWpRate(HIDE_WP_RATE, 4, false),
  'hidden weak points: none early or in gentle rooms, rate rises with depth');
  const b: any = new Battle(arena, team(), makeStage(9, 'T'), mulberry32(3));
  b.spawnWave(0);
  b.theme = 'meadow';
  b.enemies = [0.25, 0.5, 0.75].map((nx) => b.makeEnemy({ def: speciesById(1)!, nx, ny: 0.3 }, 0));
  b.waveIndex = 8;
  b.roomGrid = ROOM_LAYOUTS[1];
  b.armWeakPoints(() => 0);
  ok(b.enemies.every((e: any) => !e.wpHidden), 'gentle rooms never hide weak points');
  b.roomGrid = ROOM_LAYOUTS[3];
  b.armWeakPoints(() => 0);
  ok(b.enemies.every((e: any) => e.wpHidden), 'deep rooms can hide non-boss weak points');
  const s = b.players[0];
  const at = (f: any, ang: number) => { s.x = f.x + Math.cos(ang) * (f.r + s.r); s.y = f.y + Math.sin(ang) * (f.r + s.r); f.lastHit.clear(); };
  const e0 = b.enemies[0];
  at(e0, e0.weakA + Math.PI);
  const w0 = b.stopWeak;
  b.strikeEnemy(s, e0);
  ok(!e0.wpHidden && e0.wpPopT === b.time && b.enemies[1].wpHidden && b.stopWeak === w0, 'first contact reveals only that foe, off-spot contact is no weak hit');
  b.telop = new Telops();
  b.shotWeak = 0;
  for (const f of b.enemies) { at(f, f.weakA); b.strikeEnemy(s, f); }
  ok(b.shotWeak === 3 && b.telop.texts().includes('WEAK POINT ×3'), 'three weak hits in one shot raise the WEAK POINT ×3 tally');
  let same = true, hidden = 0;
  for (const seed of [42, 7, 99]) for (const w of [4, 7]) {
    const run = (off: boolean) => {
      const r = mulberry32(seed);
      const bb: any = new Battle(arena, team(), makeStage(seed, 'T'), r);
      if (off) bb.armWeakPoints = () => {};
      bb.spawnWave(w);
      if (!off) hidden += bb.enemies.filter((e: any) => e.wpHidden).length;
      return bb.enemies.map((e: any) => `${e.def.id}@${e.x.toFixed(1)},${e.y.toFixed(1)}:${e.hp}`).join(' ') + ` next=${r()}`;
    };
    if (run(false) !== run(true)) same = false;
  }
  ok(same && hidden > 0, 'hidden weak points roll off a side stream: seeded spawns and run rng unchanged');
}

// pull theatre: the ball is the tier, and the drop always lands and settles
{
  ok(ballFor(1, false) === 'poke-ball' && ballFor(2, false) === 'great-ball' && ballFor(3, false) === 'ultra-ball', 'pull ball maps 1/2/3 stars to Poke/Great/Ultra');
  ok(ballFor(1, true) === 'master-ball' && ballFor(3, true) === 'master-ball', 'shiny pulls ride the Master Ball');
  ok(ballDrop(0).h === DROP_H && ballDrop(0).hit === -1, 'pull ball starts at the top of its drop');
  let maxH = 0, prevHit = 0, hops = 0;
  for (let t = 0.31; t < DROP_SETTLE; t += 0.005) {
    const d = ballDrop(t);
    maxH = Math.max(maxH, d.h);
    if (d.hit < prevHit) hops++;
    prevHit = d.hit;
  }
  ok(maxH > 0 && maxH < DROP_H * 0.5, `pull ball bounces lower than its drop (peak ${maxH.toFixed(0)})`);
  ok(hops === 2, `pull ball hops three times before settling (${hops + 1})`);
  ok(ballDrop(DROP_SETTLE + 0.01).h === 0 && ballDrop(5).h === 0, 'pull ball rests on the floor after the hops');
  ok(DROP_SETTLE < 1.15, 'pull ball settles inside the shortest shake');
}

// --- help deck ---
{
  const cards = S.HELP_DECK.flatMap((p) => p.cards);
  ok(S.HELP_PAGE_COUNT === S.HELP_DECK.length && S.HELP_DECK.every((p) => p.cards.length >= 1 && p.cards.length <= 7), 'every help page holds 1 to 7 cards');
  ok(S.HELP_DECK[0].name === 'TL;DR' && cards.every(([, t]) => !t.includes('—')), 'TL;DR opens the deck and no card has an em dash');
}

// --- gauge mons (MS gauge ability) ---
{
  ok(gaugeMon(speciesById(92)!), 'Gastly carries gauge through its three-stage line');
  ok(!gaugeMon(speciesById(93)!), 'Haunter is a middle stage, not a gauge mon');
  ok(!gaugeMon(speciesById(37)!), 'Vulpix is from a two-stage line, not a gauge mon');
  ok(!gaugeMon(speciesById(355)!), 'Duskull loses its ability on evolution, so it is not a gauge mon');
  ok(!gaugeMon(speciesById(26)!), 'final forms do not carry gauge');
  ok(quietOpener(0, true) && !quietOpener(0, false) && !quietOpener(1, true), 'only stop 1 gentle room is a quiet opener');
  const gaugeNames = ROSTER.filter(gaugeCounter).map((def) => def.name).sort();
  ok(JSON.stringify(gaugeNames) === JSON.stringify(['Azurill', 'Gastly', 'Litwick', 'Poliwag', 'Tynamo']), `gauge counters found (${gaugeNames.join(', ')})`);
  const gaugeDef = speciesById(92)!, evolvedDef = speciesById(37)!;
  ok(counterAbility(evolvedDef) && !gaugeCounter(evolvedDef), 'Vulpix is an always-on counter');
  ok(counterLive(evolvedDef, false) && counterLive(evolvedDef, true), 'non-gauge counters stay live on every shot');
  ok(!counterLive(gaugeDef, false) && counterLive(gaugeDef, true), 'gauge counters need a gold shot');
  const b: any = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(3));
  b.spawnWave(0);
  b.players[0].def = gaugeDef;
  b.players[1].def = gaugeDef;
  b.activeIdx = 0;
  b.phase = 'shot';
  const active = b.players[0], other = b.players[1];
  b.shotGold = false;
  const missOff = !b.counterOn(active);
  b.shotGold = true;
  const goldOn = b.counterOn(active);
  const otherOff = !b.counterOn(other);
  b.phase = 'aim';
  const aimOff = !b.counterOn(active);
  ok(missOff && goldOn && otherOff && aimOff, 'battle counters need the active mon in a gold shot');
  b.waveIndex = 0;
  b.roomGrid = ROOM_LAYOUTS[0];
  b.courtT = -9;
  b.sweetSpot = () => ({ c: b.charge(), hw: 1 });
  const release = () => {
    const u = b.players[0];
    b.phase = 'aim';
    b.activeIdx = 0;
    b.dragging = false;
    b.pointerDown({ x: u.x, y: u.y });
    b.pointerMove({ x: u.x + 60, y: u.y });
    b.pointerUp();
  };
  release();
  const openerOff = b.shotGold === false;
  b.roomGrid = ROOM_LAYOUTS[3];
  release();
  ok(openerOff && b.shotGold === true, 'gold release loses bonus only in the gentle opener');
  const pullDraws = (def: (typeof ROSTER)[number]) => {
    let draws = 0;
    const rng = mulberry32(19);
    const countedRng = () => { draws++; return rng(); };
    const bb: any = new Battle(arena, [def, ...team().slice(1)], makeStage(4, 'T'), countedRng);
    bb.spawnWave(0);
    bb.phase = 'aim';
    bb.courtT = -9;
    bb.sweetSpot = () => ({ c: bb.charge(), hw: 1 });
    const u = bb.players[0];
    const before = draws;
    bb.pointerDown({ x: u.x, y: u.y });
    bb.pointerMove({ x: u.x + 60, y: u.y });
    bb.pointerUp();
    return draws - before;
  };
  const gaugeDraws = pullDraws(gaugeDef), evolvedDraws = pullDraws(evolvedDef);
  ok(gaugeDraws === evolvedDraws && gaugeDraws === 3, `one pull keeps three rng draws (${gaugeDraws} vs ${evolvedDraws})`);
}

// share card: draws headless on a stub canvas, and the link carries the seed
{
  const g = globalThis as Record<string, unknown>;
  const fake: any = new Proxy({}, {
    get: (_, k) =>
      k === 'measureText' ? () => ({ width: 40 })
      : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
      : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
      : () => {},
    set: () => true,
  });
  const doc0 = g.document;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fake }) };
  const card: RunCard = { won: false, depth: 5, score: 12345, team: ROSTER.slice(0, 4), mvpIdx: 1, ranks: [undefined, undefined, 'S', 'A', undefined, 'B'], bestCombo: 7, loot: 3, asc: 2, seed: 424242, build: 'test', theme: 'grove', base: 'https://x.test/pokestrike/' };
  let threw = '';
  try {
    drawRunCard(fake, card);
    drawRunCard(fake, { ...card, won: true, team: [], ranks: [] });
  } catch (e) {
    threw = String(e);
  }
  g.document = doc0;
  ok(!threw, `share card draws headless${threw ? ` (${threw})` : ''}`);
  ok(shareLink(card.base, card.seed) === 'https://x.test/pokestrike/?seed=424242', 'share link carries the run seed');
}

// --- secret lair ---
ok(SECRET_IDS.length === 9, 'secret lair exposes the nine legendary ids');
{
  const arenaSecret = { x: 30, y: 160, w: 480, h: 620 };
  const secretTeam = () => [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[12]];
  globalThis.localStorage.setItem('pk_secrets', 'not-json');
  ok(secretIds().length === 0, 'corrupt pk_secrets returns an empty list');
  globalThis.localStorage.removeItem('pk_secrets');
  const golden: Record<number, { mapSeed: number; nodes: string; waves: string[] }> = {
    42: { mapSeed: 1858592655, nodes: 'start,elite,wild,rest,mart,event,gym,elite,wild,chest,event,trainer,gym,wild,trainer,event,mart,rest,gym', waves: ['84:119,287:110,187:85', '288:322,287:319,19:179,420:258,505:263', '309:346,311:446,125:740'] },
    7: { mapSeed: 1188257686, nodes: 'start,trainer,wild,mart,event,chest,gym,trainer,wild,rest,event,mart,gym,wild,elite,trainer,event,mart,gym', waves: ['314:115,287:160,291:111', '187:190,420:258,102:263,479:235', '358:517,202:1165,150:1316'] },
  };
  for (const seed of [42, 7]) {
    const b: any = new Battle(arenaSecret, secretTeam(), makeStage(seed, 'T'), mulberry32(seed));
    const waves: string[] = [];
    for (let i = 0; i < 3; i++) {
      b.spawnWave(i);
      waves.push(b.enemies.map((e: any) => `${e.def.id}:${e.hp}`).join(','));
    }
    ok(b.mapSeed === golden[seed].mapSeed && b.regionMap.nodes.map((n: any) => n.kind).join(',') === golden[seed].nodes && JSON.stringify(waves) === JSON.stringify(golden[seed].waves), `normal climb replay unchanged (${seed})`);
  }
  let bOrC = true;
  for (let seed = 0; seed < 2000; seed++) bOrC &&= !rollSecret(seed, 2, seed & 1 ? 'B' : 'C');
  ok(bOrC, 'B/C never roll over 2,000 map seeds');
  ok(!Array.from({ length: 2000 }, (_, seed) => rollSecret(seed, 8, 'S')).some(Boolean), 'row 8 never rolls');
  ok(![0, 1, 3, 4].some((row) => Array.from({ length: 2000 }, (_, seed) => rollSecret(seed, row, 'S')).some(Boolean)), 'non-gym rows never roll');
  const sRate = Array.from({ length: 2000 }, (_, seed) => rollSecret(seed, 2, 'S')).filter(Boolean).length / 2000;
  const aRate = Array.from({ length: 2000 }, (_, seed) => rollSecret(seed, 5, 'A')).filter(Boolean).length / 2000;
  ok(sRate >= 0.30 && sRate <= 0.40, `S lair odds stay in band (${sRate.toFixed(3)})`);
  ok(aRate >= 0.11 && aRate <= 0.19, `A lair odds stay in band (${aRate.toFixed(3)})`);
  const tier0 = new Set<number>(), tier1S = new Set<number>(), tier1A = new Set<number>();
  for (let seed = 0; seed < 20000; seed++) {
    const d0 = rollSecret(seed, 2, 'S'); if (d0) tier0.add(d0.id);
    const ds = rollSecret(seed, 5, 'S'); if (ds) tier1S.add(ds.id);
    const da = rollSecret(seed, 5, 'A'); if (da) tier1A.add(da.id);
  }
  ok(JSON.stringify([...tier0].sort()) === JSON.stringify([144, 145, 146]), 'row 2 yields birds only');
  ok(JSON.stringify([...tier1S].sort()) === JSON.stringify([249, 250, 381]), 'tier-1 S pool is exact');
  ok(JSON.stringify([...tier1A].sort()) === JSON.stringify([243, 244, 245]), 'tier-1 A pool is exact');

  const findOpen = () => {
    for (let seed = 1; seed < 1000; seed++) {
      const b: any = new Battle(arenaSecret, secretTeam(), makeStage(seed, 'T'), mulberry32(seed));
      if (!rollSecret(b.mapSeed, 2, 'S')) continue;
      for (let i = 0; i < 3; i++) b.spawnWave(i);
      const before = b.rng;
      b.waveIndex = 2; b.waveHadGym = true; b.clearCard = { rank: 'S' };
      maybeSecret(b);
      if (b.secret) return { b, before, seed };
    }
    throw new Error('no deterministic secret seed');
  };
  const opened = findOpen();
  ok(opened.b.rng === opened.before, 'secret discovery does not advance the main RNG');
  const saveCase = findOpen();
  const saving: any = saveCase.b;
  saving.phase = 'map';
  saving.pendingNext = saving.secret.row + 1;
  saving.mapNode = saving.secret.gymIdx;
  const save = saving.snapshot();
  const savedSecret = (save as any)?.secret;
  ok(savedSecret?.row === saving.secret.row && savedSecret.id === saving.secret.def.id && savedSecret.rank === saving.secret.rank, 'open lair is included in pk_run snapshots');
  if (save) {
    const resumed: any = new Battle(arenaSecret, secretTeam(), makeStage(saveCase.seed, 'T'), mulberry32(saveCase.seed));
    resumed.applySnapshot(save);
    const resumedNode = resumed.regionMap.nodes.find((n: any) => n.kind === 'secret');
    const sourceNode = saving.secret.node;
    ok(resumed.secret?.phase === 'open' && resumed.secret.def.id === savedSecret?.id, 'resuming restores the open legendary');
    ok(resumedNode?.tx === sourceNode.tx && resumedNode?.ty === sourceNode.ty && JSON.stringify(resumedNode?.links) === JSON.stringify(sourceNode.links), 'resuming rebuilds the same lair node and links');
    const plainSave: any = { ...save };
    delete plainSave.secret;
    const plain: any = new Battle(arenaSecret, secretTeam(), makeStage(saveCase.seed, 'T'), mulberry32(saveCase.seed));
    plain.applySnapshot(plainSave);
    ok(!plain.secret && !plain.regionMap.nodes.some((n: any) => n.kind === 'secret'), 'a run save without a lair resumes without one');
    const invalidSecrets = [
      { ...savedSecret, row: 1 },
      { ...savedSecret, id: 1 },
      { ...savedSecret, rank: 'B' },
      { ...savedSecret, row: String(savedSecret?.row ?? 2) },
      null,
    ];
    const invalidIgnored = invalidSecrets.every((secret) => {
      const bad: any = { ...save, secret };
      globalThis.localStorage.setItem('pk_run', JSON.stringify(bad));
      const kept = runSave() != null;
      const loaded: any = new Battle(arenaSecret, secretTeam(), makeStage(saveCase.seed, 'T'), mulberry32(saveCase.seed));
      loaded.applySnapshot(bad);
      return kept && !loaded.secret && !loaded.regionMap.nodes.some((n: any) => n.kind === 'secret') && loaded.mapSeed === save.mapSeed;
    });
    globalThis.localStorage.removeItem('pk_run');
    ok(invalidIgnored, 'invalid lair data is ignored without invalidating the rest of pk_run');
    const withoutSecret: any = { ...save };
    delete withoutSecret.secret;
    const rngWith: any = new Battle(arenaSecret, secretTeam(), makeStage(saveCase.seed, 'T'), mulberry32(saveCase.seed));
    const rngWithout: any = new Battle(arenaSecret, secretTeam(), makeStage(saveCase.seed, 'T'), mulberry32(saveCase.seed));
    rngWith.applySnapshot(save);
    rngWithout.applySnapshot(withoutSecret);
    ok(rngWith.rng() === rngWithout.rng(), 'restoring an open lair consumes no run RNG');
    if (resumed.secret?.node) {
      enterSecret(resumed, resumed.secret.node);
      ok(resumed.secret?.phase === 'fight' && resumed.mapNode === resumed.regionMap.nodes.indexOf(resumed.secret.node), 'the restored lair can be entered');
    } else ok(false, 'the restored lair can be entered');
  } else {
    ok(false, 'open lair snapshot exists for resume tests');
  }
  const lairRooms = (secretExports as any).ROOM_LAIR as string[][] | undefined;
  ok(Array.isArray(lairRooms) && lairRooms.length === 2 && lairRooms.every((grid) =>
    grid.length === 11 && grid.every((row) => row.length === 9 && [...row].every((cell) => '0123ESP'.includes(cell)) && row === [...row].reverse().join('')) && fieldRoomReachable(grid)),
  'both lair courts are symmetric, reachable 9x11 rooms');
  const chooseBossRooms = (secretExports as any).bossRooms;
  ok(typeof chooseBossRooms === 'function' && chooseBossRooms({ secret: { phase: 'fight' } }) === lairRooms && chooseBossRooms({}) === ROOM_BOSS, 'lair room lookup preserves normal gym rooms');
  const lairCourt = findOpen().b as any;
  lairCourt.pendingNext = lairCourt.secret.row + 1;
  enterSecret(lairCourt, lairCourt.secret.node);
  ok(JSON.stringify(lairCourt.roomGrid) === JSON.stringify(lairRooms?.[0]), 'a lair fight starts in its first authored court');
  const lairBoss = lairCourt.enemies.find((e: any) => e.boss);
  if (lairBoss) { lairBoss.sumStage = 1; lairCourt.gymFurnished = false; lairCourt.bossBarBreak(); }
  ok(JSON.stringify(lairCourt.roomGrid) === JSON.stringify(lairRooms?.[1]), 'a lair bar break selects its second authored court');
  const normalGym: any = new Battle(arenaSecret, secretTeam(), makeStage(31, 'T'), mulberry32(11));
  normalGym.rng = () => 0.99;
  normalGym.spawnWave(2);
  ok(JSON.stringify(normalGym.roomGrid) === JSON.stringify(ROOM_BOSS[0]), 'normal gyms keep the first boss court');
  const regionBefore = opened.b.regionMap.nodes.length;
  const gymIdx = opened.b.secret.gymIdx;
  const secretNode = opened.b.secret.node;
  const routeToGym = routePath(opened.b.regionMap, opened.b.regionMap.nodes[gymIdx], secretNode).length > 1;
  ok(routeToGym && opened.b.regionMap.nodes[opened.b.secret.gymIdx].links.includes(opened.b.regionMap.nodes.indexOf(secretNode)), 'gym reaches discovered lair');
  closeSecret(opened.b);
  ok(opened.b.regionMap.nodes.length === regionBefore - 1, 'closing a discovered lair restores the node list');

  const win = findOpen();
  const wb: any = win.b;
  enterSecret(wb, wb.secret.node);
  const winState = wb.secret;
  const winBoss = wb.enemies.find((e: any) => e.boss);
  for (const e of wb.enemies) e.dead = true;
  const starsBefore = wb.starsRun;
  const nodeCount = wb.regionMap.nodes.length;
  wb.enterReward();
  ok(wb.phase === 'map' && wb.pendingNext === winState.row + 1 && wb.mapNode === winState.gymIdx, 'secret win returns to the next map row');
  ok(wb.regionMap.nodes.length === nodeCount - 1 && wb.box.some((d: any) => d.id === winState.def.id), 'secret win closes the node and banks the legendary');
  ok(wb.starsRun >= starsBefore + 40 && secretIds().includes(winState.def.id), 'secret win awards stars and records the legendary');
  ok((wb.snapshot() as any)?.secret === undefined, 'a win omits closed lair data from the snapshot');
  const dupe = findOpen();
  const db: any = dupe.b;
  db.boxAdd({ ...db.secret.def, lvl: 1 }, 1, false);
  enterSecret(db, db.secret.node);
  const dupeBoss = db.enemies.find((e: any) => e.boss);
  dupeBoss.bars = [];
  dupeBoss.sash = false; dupeBoss.lastStand = false;
  db.masterArmed = true;
  db.hurt(dupeBoss, dupeBoss.hp + 1, '#fff');
  db.enterReward();
  ok(db.box.find((d: any) => d.id === dupeBoss.def.id)?.luck === 2, 'secret win absorbs a KO-caught duplicate legend');
  const control: any = new Battle(arenaSecret, secretTeam(), makeStage(win.seed, 'T'), mulberry32(win.seed));
  for (let i = 0; i < 3; i++) control.spawnWave(i);
  control.spawnWave(winState.row + 1);
  wb.spawnWave(winState.row + 1);
  ok(JSON.stringify(wb.enemies.map((e: any) => `${e.def.id}:${e.hp}`)) === JSON.stringify(control.enemies.map((e: any) => `${e.def.id}:${e.hp}`)), 'secret win preserves the next-row replay');

  const lose = findOpen();
  const lb: any = lose.b;
  enterSecret(lb, lb.secret.node);
  const hpSnap = lb.players.map((p: any) => ({ hp: p.hp, dead: p.dead }));
  for (const p of lb.players) { p.hp = 0; p.dead = true; }
  lb.wipe();
  ok(lb.phase === 'map' && lb.players.every((p: any, i: number) => p.hp === hpSnap[i].hp && p.dead === hpSnap[i].dead), 'secret lose restores the player state');
  ok(lb.telop.texts().includes('IT FLED') && lb.regionMap.nodes.length === 19, 'secret lose seals the lair without ending the run');
  ok((lb.snapshot() as any)?.secret === undefined, 'a flee omits closed lair data from the snapshot');
  for (let i = 0; i < 300; i++) lb.update(1 / 60);
  ok(lb.phase === 'map', 'secret lose survives 300 map updates');

  const bars: any = new Battle(arenaSecret, secretTeam(), makeStage(31, 'T'), mulberry32(11));
  bars.spawnWave(2);
  const barBoss = bars.enemies.find((e: any) => e.boss);
  barBoss.bars = [0.35, 0.65];
  barBoss.sash = false; barBoss.lastStand = false;
  bars.hurt(barBoss, Math.ceil(barBoss.maxHp * 0.7), '#fff');
  bars.endShot();
  ok(barBoss.sumStage === 1 && !barBoss.dead, 'two-bar legendary breaks once');
  for (const e of bars.enemies) if (!e.boss) e.dead = true;
  bars.hurt(barBoss, barBoss.maxHp * 2, '#fff');
  ok(barBoss.dead && !(bars as any).barBreak, 'two-bar legendary can KO after one break');

  const placed: any = genRegion(17);
  const gym = placed.nodes.findIndex((n: any) => n.kind === 'gym');
  const oldNodes = placed.nodes.length;
  const oldRoute = new Set(placed.route);
  const node = placeSecret(placed, gym);
  const forks = node.links.map((i: number) => placed.nodes[i]);
  ok(placed.tiles[node.ty * MAP_W + node.tx] === T_GRASS, 'secret node sits on grass');
  ok(routePath(placed, placed.nodes[gym], node).length > 1 && forks.every((fork: any) => routePath(placed, node, fork).length > 1), 'secret route reaches gym and every fork');
  closeSecret({ regionMap: placed, secret: { node, gymIdx: gym, added: [] } } as any);
  ok(placed.nodes.length === oldNodes && placed.nodes[gym].links.every((i: number) => i < oldNodes) && [...oldRoute].every((i) => placed.route.has(i)), 'placeSecret close restores its node, links and prior route');

  const ls = globalThis.localStorage;
  ls.setItem('pk_secrets', JSON.stringify({ ids: ['bad', 144, 144] }));
  ok(secretIds().length === 1 && secretIds()[0] === 144 && !markSecret(144), 'corrupt secret persistence filters duplicates and invalid ids');
  ls.removeItem('pk_secrets');
}

// --- mid-boss ---
{
  const eligible = { stop: 3, battle: 2, battles: 2, gym: false, trainer: false, event: false };
  ok(midBossStop(eligible), 'stop 4 final battle qualifies for a mid-boss');
  ok(!midBossStop({ ...eligible, stop: 2 }), 'stops before stop 4 stay regular');
  ok(!midBossStop({ ...eligible, battle: 1 }), 'only the last battle qualifies');
  ok(!midBossStop({ ...eligible, battle: 1, battles: 1 }), 'single-battle stops stay regular');
  ok(!midBossStop({ ...eligible, gym: true }), 'gym stops stay regular');
  ok(!midBossStop({ ...eligible, trainer: true }), 'trainer and elite stops stay regular');
  ok(!midBossStop({ ...eligible, event: true }), '?-event ambushes stay regular');

  const bulbasaur = speciesById(1)!;
  const venusaur = speciesById(3)!;
  ok(evolveOnce(bulbasaur).id === 2 && evolveOnce(venusaur).id === 3, 'mid-boss evolves once and leaves final forms unchanged');
  const candidates = [
    { def: bulbasaur, boss: false, dead: false },
    { def: venusaur, boss: false, dead: false },
    { def: speciesById(6)!, boss: true, dead: false },
    { def: speciesById(9)!, boss: false, minion: true, dead: false },
    { def: speciesById(150)!, boss: false, dead: true },
  ];
  ok(midBossPick(candidates) === 1 && midBossPick(candidates.slice(2)) === -1, 'mid-boss pick chooses strongest eligible foe and skips boss, minion, dead');
  ok(midBossPick([{ def: bulbasaur, boss: false, dead: false }, { def: bulbasaur, boss: false, dead: false }]) === 0, 'mid-boss pick keeps earliest index on ties');

  const b: any = new Battle(arena, team(), makeStage(42, 'T'), mulberry32(42));
  b.spawnWave(3);
  ok(b.battle === 1 && b.battles > 1 && !b.waveHadGym && !b.inTrainer && !b.inEvent && !b.inRival, 'wild stop state persists into its battles');
  ok(!b.enemies.some((e: any) => e.mid), 'battle 1 has no mid-boss');
  const applyMid = b.makeMidBoss;
  let before: { def: any; r: number; maxHp: number; weakA: number } | undefined;
  let flagsAtMid: boolean[] | undefined;
  if (applyMid) b.makeMidBoss = function () {
    flagsAtMid = [this.waveHadGym, this.inTrainer, this.inEvent];
    const i = midBossPick(this.enemies);
    if (i >= 0) {
      const e = this.enemies[i];
      before = { def: e.def, r: e.r, maxHp: e.maxHp, weakA: e.weakA };
    }
    applyMid.call(this);
  };
  while (b.battle < b.battles) {
    b.phase = 'aim';
    b.enemies.forEach((e: any) => { e.dead = true; });
    b.enemies.length = 0;
    b.waveCleared();
  }
  ok(!!flagsAtMid && flagsAtMid.every((flag) => !flag), 'wild-stop exclusion flags persist through the final battle transition');
  const mid = b.enemies.find((e: any) => e.mid);
  const count = b.enemies.filter((e: any) => e.mid).length;
  const pickedBefore = before as { def: any; r: number; maxHp: number; weakA: number } | undefined;
  ok(
    count === 1 && !!mid && !!pickedBefore && mid.def.id === evolveOnce(pickedBefore.def).id
      && mid.r === pickedBefore.r * 1.6 && mid.maxHp === Math.round(pickedBefore.maxHp * 3)
      && mid.hp === mid.maxHp && mid.bigT === 3 && !mid.boss && mid.weakA === pickedBefore.weakA,
    'final wild battle evolves strongest foe, scales it, and keeps fixed regular weak point',
  );
  if (mid) {
    b.critCh = 0;
    b.dmgMult = 1;
    b.connect.mult = () => 1;
    mid.hp = mid.maxHp;
    b.hurt(mid, Math.floor(mid.maxHp * 0.45), '#fff');
    ok(!b.enemies.some((e: any) => e.boss) && mid.sumStage === 0 && !b.barBreak && !mid.dead, 'mid-boss big hit stays on one regular HP bar');
    mid.sash = false;
    b.hurt(mid, mid.hp + 1, '#fff');
    ok(mid.dead && b.treasure.field.some((drop: any) => drop.tier !== 'poke-ball'), 'mid-boss KO guarantees Great Ball or better');
  } else {
    ok(false, 'mid-boss big hit stays on one regular HP bar');
    ok(false, 'mid-boss KO guarantees Great Ball or better');
  }

  const earlier: any = new Battle(arena, team(), makeStage(7, 'T'), mulberry32(7));
  earlier.spawnWave(2);
  earlier.waveIndex = 2;
  earlier.battle = earlier.battles = 2;
  earlier.waveHadGym = false;
  earlier.inTrainer = false;
  earlier.inEvent = false;
  earlier.makeMidBoss?.();
  ok(!earlier.enemies.some((e: any) => e.mid), 'wave index 2 stays regular');
  const gym: any = new Battle(arena, team(), makeStage(99, 'T'), mulberry32(99));
  gym.spawnWave(3);
  gym.battle = gym.battles = 2;
  gym.waveHadGym = true;
  gym.inTrainer = false;
  gym.inEvent = false;
  gym.makeMidBoss?.();
  ok(!gym.enemies.some((e: any) => e.mid), 'gym state excludes mid-boss');

  const floor = dropOdds({ boss: true, weak: false, finisher: false, speed: false, combo: 0 });
  ok(floor.chance === 1 && floor.weights[0] === 0, 'boss-quality drop floor guarantees Great Ball or better');
  let stable = true;
  for (const seed of [42, 7, 99]) {
    const spawn = (disable: boolean) => {
      const rng = mulberry32(seed);
      const bb: any = new Battle(arena, team(), makeStage(seed, 'T'), rng);
      if (disable) bb.makeMidBoss = () => {};
      bb.spawnWave(3);
      bb.battles = 2;
      bb.waveHadGym = false;
      bb.inTrainer = false;
      bb.inEvent = false;
      bb.inRival = false;
      bb.phase = 'aim';
      bb.enemies.forEach((e: any) => { e.dead = true; });
      bb.enemies.length = 0;
      bb.waveCleared();
      const promoted = bb.enemies.findIndex((e: any) => e.mid);
      const omitted = promoted >= 0 ? promoted : midBossPick(bb.enemies);
      return {
        foes: bb.enemies.filter((_: any, i: number) => i !== omitted).map((e: any) => [e.def.id, e.x, e.y]),
        next: rng(),
        mids: bb.enemies.filter((e: any) => e.mid).length,
      };
    };
    const live = spawn(false), stubbed = spawn(true);
    if (live.mids !== 1 || live.next !== stubbed.next || JSON.stringify(live.foes) !== JSON.stringify(stubbed.foes)) stable = false;
  }
  ok(stable, 'mid-boss promotion keeps seeded non-mid spawns and run rng unchanged');
}

// --- home: town -----------------------------------------------------------
{
  const targets = [LAB_BTN, BOARD_BTN, TASKS_BTN, ACH_BTN];
  ok(targets.every((r) => r.w >= 44 && r.h >= 44 && r.x >= 0 && r.x + r.w <= 540 && r.y >= 70 && r.y + r.h <= 856),
    'town building targets are large and clear of chrome');
  ok(targets.every((a, i) => targets.slice(i + 1).every((b) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)),
  'town building targets do not overlap');
  ok(HALL_BTN === BOARD_BTN, 'hall hit target aliases the job-board route');
  ok(TOWN_FOLK.every((folk) => TOWN_LOTS.every((lot) =>
    folk.x1 <= lot.x || lot.x + lot.w <= folk.x0 || folk.y1 + folk.h <= lot.y || lot.y + lot.h <= folk.y0)),
  'town villager beats stay clear of building sprites');
  ok(TOWN_FOLK.every((folk) => Object.values(TOWN_PLATES).every((p) =>
    folk.x1 <= p.x || p.x + p.w <= folk.x0 || folk.y1 + folk.h <= p.y || p.y + p.h <= folk.y0)),
  'town villager beats stay clear of plates');
  const plates = Object.values(TOWN_PLATES);
  const doors = Object.values(TOWN_DOORS);
  ok(plates.every((p, i) => p.x >= 52 && p.x + p.w <= 488 && Math.abs(p.x + p.w / 2 - doors[i]) <= 2),
    'town plates stay in bounds and centered under doors');
  ok(plates.every((a, i) => plates.slice(i + 1).every((b) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y) &&
    TOWN_LOTS.every((lot) => a.x + a.w <= lot.x || lot.x + lot.w <= a.x || a.y + a.h <= lot.y || lot.y + lot.h <= a.y)),
  'town plates stay clear of each other and buildings');
  ok(TAB_CELLS.length === 5 && TAB_CELLS.every((c, i) =>
    c.x === TAB_BAR.x + i * TAB_BAR.w / 5 && c.y === TAB_BAR.y && c.w === TAB_BAR.w / 5 && c.h === TAB_BAR.h),
  'tab cells preserve the shared bar geometry');
}

// hall of fame scene: plays out, taps advance, a double tap or hold skips,
// and the run's board entry is written once (main.ts) — never by the scene
{
  const b = new Battle(arena, team(), makeStage(3, 'T'), mulberry32(7));
  const stamp = 1234567;
  const n0 = board().length;
  recordBoard({ s: 999999, st: TOTAL_STAGES, w: true, asc: 0, team: b.players.map((p) => p.def.id), when: stamp });
  startFame(b);
  const f = fameScene()!;
  ok(fameActive() && f.team.length === b.players.length, `hall of fame opens on the team (${f.team.map((m) => m.name).join('/')})`);
  const end = fameEnd(f);
  let n = 0;
  while (fameActive() && n++ < 400) tickFame(1 / 30);
  ok(!fameActive() && end <= 6.01 && n <= Math.ceil(end * 30) + 1, `scene ends into the result card after ${end.toFixed(1)}s (${n} frames)`);
  ok(board().length === Math.min(BOARD_MAX, n0 + 1) && board().filter((e) => e.when === stamp).length === 1, 'the won run sits on the board exactly once');
  startFame(b);
  fameDown();
  fameUp();
  ok(fameActive() && fameScene()!.t === fameScene()!.slot, 'a tap advances to the next mon');
  tickFame(0.5);
  fameDown();
  fameUp();
  ok(fameScene()!.t >= 2 * fameScene()!.slot, 'each tap steps one beat');
  fameDown();
  ok(!fameActive(), 'a second quick tap skips the scene');
  startFame(b);
  fameDown();
  tickFame(0.6);
  ok(!fameActive(), 'a held press skips the scene');
}
{
  const gym = { def: { ...ROSTER[0], id: 130 }, nx: 0.5, ny: 0.3, boss: true };
  const st = { name: 'T', theme: 'grove' as const, waves: [[gym], [gym]] };
  const b = new Battle(arena, team(), st, mulberry32(7));
  b.runRanks[1] = 'A';
  startFame(b);
  const got = fameScene()!.badges;
  while (fameActive()) fameDown();
  ok(got.length === 1 && got[0] === badgeOf(130)!.icon, `hall of fame shows only this run's beaten leaders (${got})`);
}

// --- map stops ------------------------------------------------------------
{
  for (let n = 2; n <= 5; n++) {
    const rows = stopRows(n);
    ok(rows.length === n && rows.every((r) =>
      r.w >= 44 && r.h >= 44 && r.x >= 0 && r.x + r.w <= 540 && r.y >= 96 && r.y + r.h <= 960 && r.y >= 412),
    `map stop rows (${n}) fit inside the canvas below the art window`);
    ok(rows.every((a, i) => rows.slice(i + 1).every((b) =>
      a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)),
    `map stop rows (${n}) do not overlap`);
  }
}

console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
