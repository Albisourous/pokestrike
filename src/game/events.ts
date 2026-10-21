// ?-stop event pool — pokelike's QUESTION_EVENTS adapted to the climb.
// Most events resolve on arrival and the row clears with no fight; the
// ambushes (alpha, thief) swap the row's wave for a scripted one that
// still pays normal battle rewards.
import type { Battle } from './battle';
import { pickWild } from './data';
import type { SpeciesDef, WaveSpawn } from './data';
import { speciesById } from './data';
import { rollPerks } from './perks';
import { recordCapture, recordShiny } from './meta';
import { sfx } from '../core/audio';

export interface EventChoice {
  label: string;
  run: (b: Battle) => EventOutcome;
  cost?: number; // mart shelf price — the board dims what the wallet can't cover
  icon?: string; // items/<name>.png drawn on the button — shelf goods get a face
}

// The pop-up card's art window: an npc face, a mon front, an item icon, a
// cycling slot reel — or nothing, which draws the glinting ? emblem.
export interface EventArt {
  npc?: string;
  mon?: number;
  item?: string;
  slot?: string[];
}

export interface EventOutcome {
  note: string; // flavor line — becomes the wave banner or a map toast
  art?: EventArt; // the card's stage picture
  wave?: WaveSpawn[]; // scripted fight replacing the row's wave
  skip?: boolean; // resolved peacefully — no battle this stop
  // the stop ASKS instead of resolving — the map holds until the player picks
  choices?: { prompt: string; options: EventChoice[]; art?: EventArt };
}

interface GameEvent {
  w: number;
  skip?: (b: Battle) => boolean;
  run: (b: Battle) => EventOutcome;
}

const healAll = (b: Battle, frac: number) => {
  for (const p of b.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * frac));
  sfx('heal'); // the mend chime — every team heal lands on the ear
};

// a boxed catch at wave-appropriate level — wounded mons arrive hurt,
// and no catch may outlevel the team it lands on
const boxCatch = (b: Battle, def: SpeciesDef, lvl: number, hpFrac: number) => {
  b.boxAdd({ ...def, lvl: b.catchLvl(lvl) }, hpFrac);
  recordCapture([def.id]); // a mid-run tab close keeps the dex honest
};

const EVENTS: GameEvent[] = [
  {
    w: 3,
    run: (b) => {
      for (const p of b.players) { p.dead = false; p.hp = p.maxHp; }
      sfx('heal'); // the spring revives too — healAll can't reach dead mons
      return { note: 'A HIDDEN SPRING FULLY RESTORED YOUR TEAM!', art: { item: 'mystic-water' }, skip: true };
    },
  },
  {
    w: 4,
    run: (b) => {
      healAll(b, 0.3);
      return {
        note: 'YOU FOUND A BERRY BUSH — THE TEAM RECOVERED 30%!',
        art: { item: b.roll() < 0.5 ? 'oran-berry' : 'sitrus-berry' },
        skip: true,
      };
    },
  },
  {
    w: 3,
    run: (b) => {
      for (const p of b.players) b.gainLevels(p, 2);
      return { note: 'YOU DUG UP A RARE CANDY STASH — EVERYONE +2 LEVELS!', art: { item: 'hp-up' }, skip: true };
    },
  },
  {
    w: 3,
    run: (b) => {
      const p = b.players.filter((x) => !x.dead).sort((a, z) => z.lvl - a.lvl)[0];
      if (!p) return { note: 'THE TUTOR FOUND NO ONE TO TEACH.', skip: true };
      p.cdMod += 1; // a real lesson: the super recharges one shot sooner, forever
      p.cdMax = Math.max(1, p.cdMax - 1);
      p.cd = Math.min(p.cd, p.cdMax);
      return {
        note: `A WANDERING TUTOR DRILLED ${p.def.name.toUpperCase()} — SUPER -1 SHOT!`,
        art: { npc: 'expert_f_down_0' },
        skip: true,
      };
    },
  },
  {
    w: 4,
    run: (b) => {
      const def = pickWild(b.roll, b.depth);
      const lvl = Math.min(100, 5 + b.waveIndex * 10 + Math.floor(b.roll() * 5));
      boxCatch(b, def, lvl, 0.35);
      return {
        note: `A WOUNDED ${def.name.toUpperCase()} TRUSTS YOU — IT JOINED YOUR BOX!`,
        art: { mon: def.id },
        skip: true,
      };
    },
  },
  {
    w: 3,
    skip: (b) => b.eggIn > 0,
    run: (b) => {
      b.eggIn = 3;
      b.eggJustLaid = true;
      return { note: 'YOU FOUND AN EGG! IT RUSTLES… (HATCHES IN 3 STOPS)', art: { item: 'lucky-egg' }, skip: true };
    },
  },
  {
    w: 2,
    run: (b) => {
      // wonder trade: one random mon out, one stranger in — same level,
      // shiny odds tripled like the machine always promised
      const alive = b.players.filter((p) => !p.dead);
      if (!alive.length) return { note: 'THE MACHINE STAYED SILENT.', skip: true };
      const p = alive[Math.floor(b.roll() * alive.length)];
      const def = pickWild(b.roll, b.depth + 1);
      const shiny = b.roll() < (1 / 48) * 3;
      const name = p.def.name.toUpperCase();
      b.applyDef(p, { ...def, shiny: shiny || undefined }, p.lvl, p.hp / p.maxHp);
      return {
        note: `${name} LEFT… AND ${shiny ? 'SHINY ' : ''}${def.name.toUpperCase()} ARRIVED!`,
        art: { mon: def.id },
        skip: true,
      };
    },
  },
  {
    w: 4,
    run: (b) => {
      // alpha mini-boss: one elite guards a treasure — a real fight, so it
      // pays the wave's rewards like any hard stop
      const boss = pickWild(b.roll, b.depth + 2, true);
      const escorts: WaveSpawn[] = [
        { def: pickWild(b.roll, b.depth), nx: 0.3, ny: 0.5 },
        { def: pickWild(b.roll, b.depth), nx: 0.7, ny: 0.5 },
      ];
      return {
        note: `AN ALPHA ${boss.name.toUpperCase()} GUARDS A TREASURE!`,
        wave: [...escorts, { def: boss, nx: 0.5, ny: 0.35, boss: true }],
      };
    },
  },
  {
    w: 3,
    run: (b) => {
      // dark pack ambush — Mightyena and its cronies
      const ids = [262, 198, 353, 261];
      const wave: WaveSpawn[] = ids.map((id, i) => ({
        def: speciesById(id)!,
        nx: 0.25 + (i % 2) * 0.5 + (b.roll() - 0.5) * 0.1,
        ny: 0.2 + Math.floor(i / 2) * 0.3,
      }));
      return { note: 'A WILD PACK AMBUSHES YOU!', wave };
    },
  },
  {
    // StS question marks ask something — a score sink priced like a reward
    w: 3,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A SHADY SALESMAN FLASHES A MYSTERY BOX — 300 SCORE?',
        // the box is a slot reel — it never stops deciding what's inside
        art: { slot: ['poke-ball', 'ultra-ball', 'master-ball', 'revive', 'hp-up', 'lucky-egg', 'leftovers', 'metronome'] },
        options: [
          {
            label: 'PAY 300 SCORE',
            run: (bb) => {
              if (bb.score < 300) return { note: 'HE SCOWLED — "COME BACK RICHER."', skip: true };
              bb.score -= 300;
              const p = rollPerks(bb.roll, 1, bb.rank, bb.teamTypes())[0];
              if (!p) return { note: 'THE BOX WAS EMPTY. HE VANISHED.', skip: true };
              bb.grantPerk(p);
              return { note: `THE BOX HELD ${p.name.toUpperCase()}!`, skip: true };
            },
          },
          { label: 'WALK AWAY', run: () => ({ note: 'YOU KEPT WALKING.', skip: true }) },
        ],
      },
    }),
  },
  {
    // blood shrine: pay in HP, gain in levels — the classic risk pick
    w: 2,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A STRANGE SHRINE HUMS. OFFER YOUR TEAM\'S STRENGTH?',
        art: { npc: 'elder_f_down_0' },
        options: [
          {
            label: 'OFFER 15% HP — +2 LEVELS',
            run: (bb) => {
              for (const p of bb.players) {
                if (p.dead) continue;
                p.hp = Math.max(1, Math.round(p.hp - p.maxHp * 0.15));
                bb.gainLevels(p, 2);
              }
              return { note: 'THE SHRINE DRANK DEEP — EVERYONE GREW +2 LEVELS.', skip: true };
            },
          },
          { label: 'LEAVE IT', run: () => ({ note: 'THE HUM FADED BEHIND YOU.', skip: true }) },
        ],
      },
    }),
  },
  {
    // a tune-up stop: every charged gauge snaps to ready
    w: 2,
    run: (b) => {
      let n = 0;
      for (const p of b.players) if (!p.dead && p.cd > 0) { p.cd = 0; n++; }
      return {
        note: n ? `A MYSTIC TUNED THE TEAM — ${n} SUPER${n > 1 ? 'S' : ''} CHARGED!` : 'THE MYSTIC FOUND NOTHING TO TUNE.',
        art: { item: 'metronome' },
        skip: true,
      };
    },
  },
  {
    // the well fight is opt-in — a small sure thing vs a risky payday
    w: 2,
    run: (b) => ({
      note: '',
      choices: {
        prompt: 'A WELL ECHOES WITH BATTLE CRIES — CLIMB DOWN?',
        // the card flashes whichever ghost is waiting below
        art: { mon: [92, 353, 355, 198, 302][Math.floor(b.roll() * 5)] },
        options: [
          {
            label: 'CLIMB DOWN — FIGHT',
            run: (bb) => ({
              note: 'SOMETHING MOVED IN THE DARK!',
              wave: [92, 353, 355, 198, 302].map((id, i) => ({
                def: speciesById(id)!,
                nx: 0.2 + (i % 3) * 0.3 + (bb.roll() - 0.5) * 0.08,
                ny: 0.18 + Math.floor(i / 3) * 0.32,
              })),
            }),
          },
          {
            label: 'TOSS A COIN IN',
            run: (bb) => {
              bb.score += 100;
              return { note: 'YOU WISHED FOR LUCK — +100 SCORE.', skip: true };
            },
          },
        ],
      },
    }),
  },
  {
    // the weakest link gets a stranger at +4 — a real team-building call
    w: 2,
    skip: (b) => !b.players.some((p) => !p.dead),
    run: () => ({
      note: '',
      choices: {
        prompt: 'A COLLECTOR WANTS YOUR WEAKEST MON — OFFERS A STRANGER +4 LEVELS.',
        art: { npc: 'pokefan_down_0' },
        options: [
          {
            label: 'MAKE THE TRADE',
            run: (bb) => {
              const alive = bb.players.filter((p) => !p.dead);
              if (!alive.length) return { note: 'THE DEAL COLLAPSED.', skip: true };
              const weak = alive.sort((a, z) => a.lvl - z.lvl)[0];
              const def = pickWild(bb.roll, bb.depth + 1);
              const shiny = bb.roll() < 1 / 48;
              const name = weak.def.name.toUpperCase();
              bb.applyDef(weak, { ...def, shiny: shiny || undefined }, Math.min(100, weak.lvl + 4), weak.hp / weak.maxHp);
              recordCapture([def.id]); // the stranger lands in the dex
              return { note: `${name} LEFT… ${shiny ? 'SHINY ' : ''}${def.name.toUpperCase()} ARRIVED AT Lv${weak.lvl}!`, skip: true };
            },
          },
          { label: 'DECLINE', run: () => ({ note: 'THE COLLECTOR NODDED AND MOVED ON.', skip: true }) },
        ],
      },
    }),
  },
  {
    // the game corner: the only ? priced to lose — the wallet tag dims on a
    // broke run, the reels bust half the time, and 777 pays a relic
    w: 2,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A GENTLEMAN FANS A COIN CASE — THE SLOTS ARE 200 A SPIN.',
        // FRLG canon: the GAMBLER class wears a suit and answers to GENTLEMAN
        art: { npc: 'gentleman_down_0' },
        options: [
          {
            label: 'SPIN THE REELS',
            cost: 200,
            run: (bb) => {
              if (bb.score < 200) return { note: 'HE SNAPPED THE CASE SHUT — "COME BACK RICHER."', skip: true };
              bb.score -= 200;
              const r = bb.roll();
              if (r < 0.5) return { note: 'NOT EVEN A CHERRY — THE HOUSE ATE 200.', skip: true };
              if (r < 0.9) {
                bb.score += 400;
                return { note: 'BARS LINE UP — THE SPIN PAID DOUBLE! +400 SCORE.', skip: true };
              }
              const p = rollPerks(bb.roll, 1, bb.rank, bb.teamTypes())[0];
              if (!p) {
                bb.score += 600;
                return { note: 'THE REELS JAMMED ON 777 — +600 SCORE.', skip: true };
              }
              bb.grantPerk(p);
              return { note: `777 — JACKPOT! THE MACHINE DROPPED ${p.name.toUpperCase()}!`, skip: true };
            },
          },
          { label: 'WALK AWAY', run: () => ({ note: 'THE REELS SPUN ON WITHOUT YOU.', skip: true }) },
        ],
      },
    }),
  },
  {
    // rock-smash gamble: canon cracked boulders hide fossils or a very
    // angry squatter — the fight still pays wave rewards like any ambush
    w: 2,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A HIKER SQUATS BY A CRACKED BOULDER — SMASH IT OPEN?',
        art: { npc: 'hiker_down_0' },
        options: [
          {
            label: 'SMASH THE BOULDER',
            run: (bb) => {
              if (bb.roll() < 0.3) {
                const ids = [74, 95, 304, 213]; // geodude, onix, aron, shuckle — it was a nest
                const wave: WaveSpawn[] = ids.map((id, i) => ({
                  def: speciesById(id)!,
                  nx: 0.25 + (i % 2) * 0.5 + (bb.roll() - 0.5) * 0.1,
                  ny: 0.2 + Math.floor(i / 2) * 0.3,
                }));
                return { note: 'THE ROCK FIGHTS BACK — IT WAS A NEST!', wave };
              }
              // helix/dome/root/claw/skull/armour fossils — old amber and the
              // living fossil ride the rare pull
              const rare = bb.roll() < 0.15;
              const ids = rare ? [142, 369] : [138, 140, 345, 347, 408, 410];
              const def = speciesById(ids[Math.floor(bb.roll() * ids.length)])!;
              const lvl = Math.min(100, 5 + bb.waveIndex * 10 + Math.floor(bb.roll() * 5));
              boxCatch(bb, def, lvl, 0.4);
              return {
                note: `${rare ? 'AN OLD AMBER' : 'A FOSSIL'} CRACKED OPEN — ${def.name.toUpperCase()} JOINED YOUR BOX!`,
                art: { mon: def.id },
                skip: true,
              };
            },
          },
          { label: 'LEAVE IT', run: () => ({ note: 'THE BOULDER KEPT ITS SECRET.', skip: true }) },
        ],
      },
    }),
  },
  {
    // macho-brace drills: same sweat-for-levels trade as the shrine, but the
    // bill lands on the ace alone — concentrated pain, spread gain
    w: 2,
    skip: (b) => !b.players.some((p) => !p.dead),
    run: () => ({
      note: '',
      choices: {
        prompt: 'A BLACK BELT BARKS: MACHO-BRACE DRILLS — THE ACE PAYS IN SWEAT.',
        art: { npc: 'black_belt_down_0' },
        options: [
          {
            label: 'TRAIN — ACE -25% HP, ALL +1 LV',
            run: (bb) => {
              const ace = bb.players.filter((p) => !p.dead).sort((a, z) => z.lvl - a.lvl)[0];
              if (!ace) return { note: 'NO ONE STOOD TO TRAIN.', skip: true };
              ace.hp = Math.max(1, ace.hp - Math.round(ace.maxHp * 0.25));
              for (const p of bb.players) if (!p.dead) bb.gainLevels(p, 1);
              return {
                note: `${ace.def.name.toUpperCase()} LED THE DRILLS — EVERYONE +1 LEVEL!`,
                art: { item: 'macho-brace' },
                skip: true,
              };
            },
          },
          { label: 'PASS', run: () => ({ note: 'HE BOWED AND WENT BACK TO PRESS-UPS.', skip: true }) },
        ],
      },
    }),
  },
  {
    w: 1,
    run: (b) => {
      // golden mon: a guaranteed shiny leads a two-mon escort — shiny KOs
      // auto-catch, so the fight itself is the rare pull
      const def = pickWild(b.roll, b.depth);
      const escorts: WaveSpawn[] = [
        { def: b.roll() < 0.5 ? def : pickWild(b.roll, b.depth), nx: 0.3, ny: 0.5 },
        { def: b.roll() < 0.5 ? def : pickWild(b.roll, b.depth), nx: 0.7, ny: 0.5 },
      ];
      return {
        note: `A GOLDEN ${def.name.toUpperCase()} SPARKLES IN THE BRUSH!`,
        wave: [...escorts, { def: { ...def, shiny: true }, nx: 0.5, ny: 0.35 }],
      };
    },
  },
  {
    w: 2,
    run: (b) => {
      // swarm: one species floods the upper court — the catch-farm inverse
      // of the alpha's single threat
      const def = pickWild(b.roll, b.depth);
      const n = 5 + Math.floor(b.roll() * 2);
      const wave: WaveSpawn[] = Array.from({ length: n }, (_, i) => ({
        def,
        nx: 0.15 + (i % 3) * 0.35 + (b.roll() - 0.5) * 0.08,
        ny: 0.15 + Math.floor(i / 3) * 0.3,
      }));
      return { note: `A SWARM OF ${def.name.toUpperCase()} DESCENDS!`, wave };
    },
  },
  {
    // luck shrine: the only feeder for teamLuck outside fusion dupes — pay
    // score like the game corner, or bow for a free smaller blessing
    w: 2,
    run: () => ({
      note: '',
      choices: {
        prompt: 'AN ELDER TENDS A MOSSY SHRINE — OFFER SCORE FOR LUCK?',
        art: { npc: 'elder_m_down_0' },
        options: [
          {
            label: 'OFFER 100 — TEAM LUCK +2',
            cost: 100,
            run: (bb) => {
              if (bb.score < 100) return { note: 'THE ELDER SHOOK HIS HEAD — "LUCK FOLLOWS COIN."', skip: true };
              bb.score -= 100;
              for (const p of bb.players) p.def = { ...p.def, luck: Math.min(99, (p.def.luck ?? 0) + 2) };
              return { note: 'THE SHRINE GLIMMERS — EVERYONE +2 LUCK!', skip: true };
            },
          },
          {
            label: 'BOW AND PASS — +1 LUCK',
            run: (bb) => {
              for (const p of bb.players) p.def = { ...p.def, luck: Math.min(99, (p.def.luck ?? 0) + 1) };
              return { note: 'A QUIET PRAYER — EVERYONE +1 LUCK.', skip: true };
            },
          },
          { label: 'WALK AWAY', run: () => ({ note: 'THE ELDER WAVED YOU ON.', skip: true }) },
        ],
      },
    }),
  },
  {
    // day-care twin: the couple clones your ace straight into the box —
    // fusion fodder or a second body for the climb
    w: 1,
    skip: (b) => !b.players.some((p) => !p.dead),
    run: (b) => {
      const ace = b.players.filter((p) => !p.dead).sort((a, z) => z.lvl - a.lvl)[0];
      if (!ace) return { note: 'THE DAY-CARE WAS EMPTY.', skip: true };
      // the twin is the same species fresh — luck doesn't photocopy (it's
      // fusion-earned), and a shiny lands on the ledger like any catch
      boxCatch(b, { ...ace.def, luck: undefined }, ace.lvl, 1);
      if (ace.def.shiny) recordShiny(ace.def.id);
      return {
        note: `A DAY-CARE COUPLE HANDS YOU A TWIN OF ${ace.def.name.toUpperCase()}!`,
        art: { npc: 'mom_down_0' },
        skip: true,
      };
    },
  },
];

// Poké Mart: the ?-choice box doubles as a shop board — every buy re-prompts
// the shelf until LEAVE, and score is the wallet so purchases tax the run's
// final tally. One mart per map half is guaranteed by genRegion. Stock is
// one-of-each per visit — `sold` rides the re-prompt chain so a bought
// item leaves the board.
export function martStock(b: Battle, prompt = 'POKÉ MART — WHAT\'LL IT BE?', sold = new Set<string>()): { prompt: string; options: EventChoice[]; art?: EventArt } {
  const reprompt = (bb: Battle, note: string): EventOutcome => ({ note, choices: martStock(bb, note, sold) });
  // cost renders as a tag on the button's right edge — the label stays short
  // enough to read at full pixel size. martMult is the daily card's discount
  const price = (n: number) => Math.round(n * b.martMult);
  const shelf = (key: string, cost: number, label: string, icon: string, buy: (bb: Battle) => string): EventChoice => ({
    label,
    cost: price(cost),
    icon,
    run: (bb) => {
      if (bb.score < price(cost)) return reprompt(bb, 'NOT ENOUGH SCORE.');
      bb.score -= price(cost);
      sold.add(key);
      return reprompt(bb, buy(bb));
    },
  });
  const stock: [string, EventChoice][] = [
    ['potion', shelf('potion', 200, 'POTION — HEAL 40%', 'potion', (bb) => (healAll(bb, 0.4), 'THE TEAM RECOVERED 40%!'))],
    ['candy', shelf('candy', 400, 'RARE CANDY — +1 LV', 'hp-up', (bb) => {
      for (const p of bb.players) if (!p.dead) bb.gainLevels(p, 1);
      return 'EVERYONE GREW +1 LEVEL!';
    })],
    ['mystery', {
      label: 'MYSTERY ITEM',
      cost: price(300),
      icon: 'lucky-egg',
      run: (bb) => {
        // roll the goods before charging — a blind shelf shouldn't take
        // score when there's nothing in the bag
        const p = rollPerks(bb.roll, 1, bb.rank, bb.teamTypes())[0];
        if (!p) return reprompt(bb, 'SOLD OUT. THE CLERK SHRUGGED.');
        if (bb.score < price(300)) return reprompt(bb, 'NOT ENOUGH SCORE.');
        bb.score -= price(300);
        sold.add('mystery');
        bb.grantPerk(p);
        return reprompt(bb, `IT WAS ${p.name.toUpperCase()}!`);
      },
    }],
  ];
  if (b.players.some((p) => p.dead))
    stock.push(['revive', shelf('revive', 350, 'REVIVE — HALF HP', 'revive', (bb) => {
      const dead = bb.players.filter((p) => p.dead);
      const p = dead[Math.floor(bb.roll() * dead.length)];
      p.dead = false;
      p.hp = Math.round(p.maxHp / 2);
      return `${p.def.name.toUpperCase()} IS BACK ON ITS FEET!`;
    })]);
  const options = stock.filter(([key]) => !sold.has(key)).map(([, o]) => o);
  options.push({ label: 'LEAVE', run: () => ({ note: 'YOU HEADED BACK TO THE ROUTE.', skip: true }) });
  return { prompt, options, art: { npc: 'shopkeeper_m_down_0' } };
}

export function rollEvent(b: Battle): EventOutcome {
  const pool = EVENTS.filter((e) => !e.skip?.(b));
  let r = b.roll() * pool.reduce((a, e) => a + e.w, 0);
  for (const e of pool) {
    r -= e.w;
    if (r <= 0) return e.run(b);
  }
  return pool[0].run(b);
}
