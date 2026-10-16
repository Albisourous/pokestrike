// Generates SpeciesDef rows for newly vendored sprites from /tmp/pkstats/*.json
// Placement + flags are hand-assigned; stats/types come from PokeAPI.
import { readFileSync } from 'fs';

const TYPE_MAP = {
  ground: 'rock', steel: 'rock', ice: 'water', dark: 'ghost',
  dragon: 'flying', fairy: 'normal', bug: 'poison',
};
const SUPPORTED = new Set(['normal','fire','water','grass','electric','psychic','rock','poison','flying','fighting','ghost']);
// judgment overrides where the mechanical map reads wrong
const TYPE_OVERRIDE = {
  205: 'rock',      // Forretress — steel shell
  227: 'flying',    // Skarmory — steel/flying, reads flying
  330: 'rock',      // Flygon — desert dragon
  303: 'fighting',  // Mawile — the steel jaw bites
  199: 'psychic',   // Slowking — the smart one
  215: 'ghost',     // Sneasel — dark reads ghost here
  204: 'poison',    // Pineco — bug convention
};

const placement = {
  roster: [152, 155, 158, 252, 255, 258, 173, 175, 161, 190, 235, 239, 238, 23, 96, 83, 220, 120],
  evos: [153, 156, 159, 253, 256, 259, 176],
  elites: [254, 260, 182, 199, 205, 227, 226, 224, 233, 237, 107, 330, 321, 369, 303, 335],
  fodder: [24, 97, 124, 114, 162, 185, 201, 203, 204, 211, 213, 215, 234, 264, 268, 269, 272, 275, 287, 288, 290, 291, 292, 311, 312, 316, 317, 320, 327, 339, 340, 351, 352, 358, 368],
};

const FLAGS = {
  83: 'melee: true',            // Farfetch'd — leek swordsman
  107: 'melee: true',           // Hitmonchan
  237: 'melee: true',           // Hitmontop
  303: 'melee: true',           // Mawile
  335: 'melee: true',           // Zangoose
  288: 'melee: true',           // Vigoroth
  260: 'melee: true',           // Swampert
  152: 'healer: true', 153: 'healer: true', 173: 'healer: true',
  175: 'healer: true', 176: 'healer: true', 182: 'healer: true',
  235: 'copy: true',            // Smeargle — Sketch
  254: 'pierce: true',          // Sceptile
  291: 'pierce: true',          // Ninjask — fastest thing alive
  215: 'pierce: true, melee: true', // Sneasel — fast slasher
  213: 'taunt: true',           // Shuckle
  321: 'taunt: true',           // Wailord
  205: 'taunt: true',           // Forretress
  369: 'taunt: true',           // Relicanth
  340: 'taunt: true',           // Whiscash
  185: 'taunt: true',           // Sudowoodo — the wall that pretends
  317: 'taunt: true',           // Swalot
  292: 'cursed: true',          // Shedinja — the hollow shell
};

const EVOLVES = {
  152: 153, 153: 154, 155: 156, 156: 157, 158: 159, 159: 160,
  252: 253, 253: 254, 255: 256, 256: 257, 258: 259, 259: 260,
  161: 162, 173: 35, 175: 176, 23: 24, 96: 97, 220: 221, 120: 121,
  238: 124, 239: 125, 204: 205, 320: 321, 339: 340, 316: 317,
  290: 291, 287: 288, 288: 289, 268: 269,
};

const NAME_FIX = { 'farfetchd': "Farfetch'd", 'mr-mime': 'Mr. Mime', 'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂' };

function row(id) {
  const j = JSON.parse(readFileSync(`/tmp/pkstats/${id}.json`, 'utf8'));
  const name = NAME_FIX[j.name] ?? j.name[0].toUpperCase() + j.name.slice(1);
  const stats = Object.fromEntries(j.stats.map((s) => [s.stat.name, s.base_stat]));
  const [t1, t2] = j.types.map((t) => t.type.name);
  let type = TYPE_OVERRIDE[id]
    ?? (SUPPORTED.has(t1) ? t1 : SUPPORTED.has(t2) ? t2 : TYPE_MAP[t1] ?? 'normal');
  const bits = [`id: ${id}`, `name: '${name}'`, `type: '${type}'`,
    `stats: st(${stats.hp}, ${stats.attack}, ${stats.defense}, ${stats['special-attack']}, ${stats['special-defense']}, ${stats.speed})`];
  if (FLAGS[id]) bits.push(FLAGS[id]);
  if (EVOLVES[id]) bits.push(`evolvesTo: ${EVOLVES[id]}`);
  return `  { ${bits.join(', ')} },`;
}

for (const [pool, ids] of Object.entries(placement)) {
  console.log(`// --- ${pool.toUpperCase()} (${ids.length}) ---`);
  for (const id of ids) console.log(row(id));
}
