// Generates SpeciesDef rows for gen-4 additions from /tmp/pkstats/*.json
import { readFileSync } from 'fs';

const SUPPORTED = new Set(['normal','fire','water','grass','electric','psychic','rock','poison','flying','fighting','ghost']);
const TYPE_MAP = { ground:'rock', steel:'rock', ice:'water', dark:'ghost', dragon:'flying', fairy:'normal', bug:'poison' };

// distinctive-second-type overrides (Slowpoke→psychic convention)
const TYPE_OVERRIDE = {
  388:'grass',391:'fighting',394:'water', // mids keep primary feel
  397:'flying',398:'flying',
  401:'poison',402:'poison', // Kricketot/Kricketune — crickets read grass-ish? keep poison bug convention... actually grass fits. handled below
  413:'grass', // Wormadam plant cloak
  415:'flying',416:'flying', // Combee/Vespiquen
  419:'water', // Floatzel
  424:'normal',425:'ghost',426:'ghost', // Ambipom/Drifloon/Drifblim
  430:'flying',431:'normal',432:'normal',
  434:'poison',435:'poison',
  436:'rock',437:'rock', // Bronzor/Bronzong — steel bell → rock
  441:'flying',442:'ghost', // Chatot/Spiritomb
  443:'rock',444:'rock',445:'rock', // Gible line — ground/dragon → rock
  451:'poison',452:'poison',
  456:'water',457:'water',458:'water',
  459:'grass',460:'grass', // Snover/Abomasnow — grass/ice
  461:'ghost', // Weavile — dark
  469:'flying', // Yanmega
  470:'grass',471:'water', // Leafeon/Glaceon(ice→water)
  472:'rock', // Gliscor ground/flying — scorpion desert → rock? reads flying-ish. keep rock (ground)
  476:'rock',477:'ghost',478:'ghost', // Probopass steel/rock→rock; Froslass ice/ghost→ghost
  479:'electric', // Rotom electric/ghost
  483:'rock',484:'water', // Dialga steel/dragon→rock; Palkia water/dragon→water
  485:'fire',486:'normal',487:'ghost',488:'psychic',489:'water',490:'water',491:'ghost',492:'grass',493:'normal',
};

const ROSTER = [387,390,393,396,399,403,406,408,410,417,418,425,427,431,433,436,438,439,440,443,446,447,451,453,456,458,459];
const EVOS = [388,391,394,397,404,413,414,420,421,444,449,455,465]; // mids + evo-only branches
const ELITES = [389,392,395,398,405,407,409,411,419,424,426,428,429,430,432,435,437,442,445,448,450,452,454,460,461,462,463,464,466,467,468,469,470,471,472,473,474,475,476,477,478,479,495].filter(id=>id<=493);
const INVADERS = [480,481,482,483,484,485,486,487,488,489,490,491,492,493];
const done = new Set([...ROSTER, ...EVOS, ...ELITES, ...INVADERS]);
const FODDER = []; for (let i = 387; i <= 493; i++) if (!done.has(i)) FODDER.push(i);

const FLAGS = {
  387:'healer: true',390:'melee: true', // turtwig sustain-y, chimchar scrapper
  396:'melee: true',399:'taunt: true',403:'melee: true',
  408:'melee: true',417:'pierce: true',418:'pierce: true',
  425:'cursed: true',427:'pierce: true',
  433:'healer: true',436:'taunt: true',438:'taunt: true',
  440:'healer: true',443:'melee: true',446:'taunt: true',447:'melee: true',
  451:'melee: true',453:'melee: true',
  // evos/elites
  391:'melee: true',394:'taunt: true',
  389:'taunt: true',392:'melee: true, pierce: true',395:'taunt: true',
  398:'melee: true',405:'melee: true',407:'healer: true',
  409:'melee: true',411:'taunt: true',
  424:'melee: true',426:'cursed: true',428:'pierce: true',
  429:'healer: true',430:'pierce: true',435:'melee: true',
  437:'taunt: true',442:'cursed: true',445:'melee: true, pierce: true',
  448:'melee: true, pierce: true',450:'taunt: true',452:'melee: true',
  454:'melee: true',460:'taunt: true',461:'pierce: true, melee: true',
  462:'pierce: true',464:'melee: true',466:'melee: true',467:'melee: true',
  468:'healer: true',469:'pierce: true',472:'melee: true',
  473:'melee: true',475:'melee: true',476:'taunt: true',
  478:'pierce: true',479:'cursed: true',
  // invaders
  480:'pierce: true',481:'healer: true',482:'melee: true',
  483:'taunt: true',486:'taunt: true, melee: true',487:'cursed: true',
  488:'healer: true',491:'cursed: true',493:'copy: true',
};

const EVOLVES = {
  387:388,388:389, 390:391,391:392, 393:394,394:395,
  396:397,397:398, 399:400, 403:404,404:405, 406:315,315:407,
  408:409, 410:411, 417:0, 418:419, 420:421, 425:426,
  427:428, 431:432, 433:358, 434:435, 436:437, 438:185,
  439:122, 440:113, 441:0, 443:444,444:445, 446:143,
  447:448, 449:450, 451:452, 453:454, 455:0, 456:457, 458:226, 459:460,
  // new evos of gen1-3 mons handled as separate edits on existing rows
};

const NAME_FIX = { 'mime-jr': 'Mime Jr.', 'farfetchd': "Farfetch'd" };

function row(id) {
  const j = JSON.parse(readFileSync(`/tmp/pkstats/${id}.json`, 'utf8'));
  const name = NAME_FIX[j.name] ?? j.name[0].toUpperCase() + j.name.slice(1);
  const stats = Object.fromEntries(j.stats.map((s) => [s.stat.name, s.base_stat]));
  const [t1, t2] = j.types.map((t) => t.type.name);
  const type = TYPE_OVERRIDE[id] ?? (SUPPORTED.has(t1) ? t1 : SUPPORTED.has(t2) ? t2 : TYPE_MAP[t1] ?? 'normal');
  const bits = [`id: ${id}`, `name: '${name}'`, `type: '${type}'`,
    `stats: st(${stats.hp}, ${stats.attack}, ${stats.defense}, ${stats['special-attack']}, ${stats['special-defense']}, ${stats.speed})`];
  if (FLAGS[id]) bits.push(FLAGS[id]);
  const ev = EVOLVES[id];
  if (ev) bits.push(`evolvesTo: ${ev}`);
  return `  { ${bits.join(', ')} },`;
}

console.log('// --- ROSTER ---'); for (const id of ROSTER) console.log(row(id));
console.log('// --- EVOS ---'); for (const id of EVOS) console.log(row(id));
console.log('// --- ELITES ---'); for (const id of ELITES) console.log(row(id));
console.log('// --- INVADERS ---'); for (const id of INVADERS) console.log(row(id));
console.log('// --- FODDER ---'); for (const id of FODDER) console.log(row(id));
console.log(`// counts: ${ROSTER.length}r ${EVOS.length}e ${ELITES.length}x ${INVADERS.length}i ${FODDER.length}f = ${ROSTER.length+EVOS.length+ELITES.length+INVADERS.length+FODDER.length}`);
