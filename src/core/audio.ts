// Tiny synthesized SFX — no audio assets, just WebAudio oscillators/noise.
// Browsers require a user gesture first, so call unlock() from pointerdown.

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let mGain: GainNode | null = null;
let muted = localStorage.getItem('pk-mute') === '1';

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('pk-mute', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function unlockAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    restart();
    return;
  }
  try {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    mGain = ac.createGain();
    mGain.gain.value = 0.42; // music sits under the sfx
    mGain.connect(master);
    restart();
  } catch {
    ac = null;
  }
}

// One-shot oscillator blip with a pitch slide and decay envelope.
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ac || !master || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Filtered noise burst — impacts, explosions, whooshes.
function noise(dur: number, freq: number, vol: number, delay = 0, slide = 0) {
  if (!ac || !master || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const len = Math.max(1, Math.round(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t0);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(freq + slide, 40), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export type Sfx =
  | 'launch' | 'perfect' | 'hit' | 'ko' | 'caught' | 'hurt'
  | 'zap' | 'boom' | 'splash' | 'heal' | 'ui' | 'wave' | 'lose' | 'ready'
  | 'sizzle' | 'gust' | 'invade' | 'beam' | 'tick' | 'bounce';

export function sfx(name: Sfx, pitch = 1) {
  switch (name) {
    case 'launch':
      noise(0.18, 900, 0.25, 0, -600);
      tone(500, 180, 0.15, 'sawtooth', 0.12);
      break;
    case 'perfect': // jackpot: rising sparkle run over a thump + shimmer tail
      tone(190, 95, 0.16, 'sine', 0.18);
      [660, 880, 1108, 1760].forEach((f, i) => tone(f, f, 0.14, 'square', 0.09, i * 0.045));
      noise(0.3, 2600, 0.08, 0.06, 2400);
      break;
    case 'tick': // timing cue — the fill just crossed into the gold zone
      tone(1760, 1760, 0.035, 'square', 0.045);
      break;
    case 'bounce': // pinball thock — pitch follows impact speed
      tone(340 * pitch, 110 * pitch, 0.05, 'sine', 0.11);
      noise(0.03, 1800 * pitch, 0.05);
      break;
    case 'hit': // pitch climbs with combo count
      tone(280 * pitch, 140 * pitch, 0.08, 'square', 0.16);
      noise(0.05, 2200, 0.1);
      break;
    case 'ko':
      noise(0.3, 400, 0.3, 0, -250);
      tone(160, 50, 0.3, 'sine', 0.3);
      break;
    case 'caught': // pokeball: ding-ding-DING
      tone(880, 880, 0.09, 'sine', 0.18);
      tone(880, 880, 0.09, 'sine', 0.18, 0.14);
      tone(1320, 1320, 0.3, 'sine', 0.22, 0.3);
      break;
    case 'hurt':
      tone(220, 110, 0.12, 'sawtooth', 0.12);
      break;
    case 'zap':
      tone(1400, 300, 0.12, 'sawtooth', 0.14);
      noise(0.1, 3000, 0.12);
      break;
    case 'boom':
      noise(0.35, 300, 0.35, 0, -180);
      tone(120, 40, 0.35, 'sine', 0.32);
      break;
    case 'splash':
      noise(0.25, 1200, 0.2, 0, 800);
      break;
    case 'heal':
      [520, 660, 780].forEach((f, i) => tone(f, f * 1.2, 0.15, 'sine', 0.1, i * 0.06));
      break;
    case 'ui':
      tone(700, 900, 0.06, 'square', 0.08);
      break;
    case 'wave':
      [440, 550, 660].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.12, i * 0.07));
      break;
    case 'lose':
      [330, 262, 196].forEach((f, i) => tone(f, f * 0.9, 0.25, 'triangle', 0.14, i * 0.16));
      break;
    case 'ready': // super recharged — soft two-note ping
      tone(1046, 1046, 0.07, 'sine', 0.09);
      tone(1568, 1568, 0.1, 'sine', 0.09, 0.06);
      break;
    case 'sizzle': // lava/spike chip — hot static pop
      noise(0.12, 2600, 0.14);
      tone(320, 90, 0.1, 'sawtooth', 0.08);
      break;
    case 'gust': // wind band — airy sweep up
      noise(0.35, 800, 0.12, 0, 1400);
      break;
    case 'invade': // legendary sting — dark rise + hit
      tone(196, 784, 0.28, 'sawtooth', 0.12);
      tone(98, 392, 0.28, 'triangle', 0.14);
      noise(0.2, 500, 0.2, 0.26, -300);
      break;
    case 'beam': // hyper beam — rising charge then a blast tail
      tone(180, 1400, 0.22, 'sawtooth', 0.14);
      noise(0.3, 900, 0.24, 0.2, -500);
      break;
  }
}

// --- chiptune sequencer: original loops, NES-flavored voices ---
// Steps are 8th notes; note arrays use midi (0 = rest), drum strings
// use '.' = rest. Scheduled ~0.2s ahead so loops never gap.

const M2F = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Track {
  bpm: number;
  lead: number[];
  harm?: number[]; // quiet second voice, a scale-third under the lead
  arp?: number[]; // broken-chord shimmer
  bass: number[];
  kick: string;
  snare: string;
  hat: string;
  loop?: boolean;
  next?: TrackName;
}
type TrackName = 'title' | 'battle' | 'win';

function mnote(f: number, t0: number, dur: number, type: OscillatorType, vol: number, f1 = 0) {
  if (!ac || !mGain) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.6);
  g.gain.setValueAtTime(vol, t0);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(mGain);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let nbuf: AudioBuffer | null = null;
function mnoise(t0: number, dur: number, freq: number, vol: number) {
  if (!ac || !mGain) return;
  if (!nbuf) {
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource();
  s.buffer = nbuf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f).connect(g).connect(mGain);
  s.start(t0, Math.random());
  s.stop(t0 + dur + 0.02);
}

// E natural minor pool for harmonizing the battle lead a third down.
const EM = [64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84, 86, 88];
const thirdDown = (m: number) => {
  const i = EM.indexOf(m);
  return i > 1 ? EM[i - 2] : m;
};

const rep = (a: number[], n: number) => Array.from({ length: n }, () => a).flat();

const battleLead = [
  76, 0, 79, 0, 76, 0, 74, 0, // Em: hook
  71, 0, 74, 0, 76, 0, 0, 0, //     answer
  72, 0, 76, 0, 79, 0, 76, 0, // C
  74, 0, 79, 0, 83, 0, 79, 0, // G
  76, 0, 79, 0, 81, 0, 83, 0, // Em: climb
  83, 0, 81, 0, 79, 0, 78, 0, //     descend
  81, 0, 78, 0, 74, 0, 78, 0, // D
  71, 0, 75, 0, 78, 0, 83, 0, // B (D# = harmonic-minor tension back to Em)
];

// B section — higher register, Am/C/G/D then a climb to E6 that falls
// back into the A hook. Halves how often the ear hears the same phrase.
const battleLeadB = [
  81, 0, 81, 0, 84, 0, 81, 0, // Am
  84, 0, 83, 0, 79, 0, 76, 0, // C
  79, 0, 81, 0, 83, 0, 86, 0, // G
  86, 0, 83, 0, 81, 0, 78, 0, // D
  76, 0, 79, 0, 81, 0, 84, 0, // Am
  83, 0, 81, 0, 79, 0, 76, 0, // C
  78, 0, 81, 0, 83, 0, 86, 0, // D
  88, 0, 86, 0, 83, 0, 78, 0, // B: peak then fall to the hook
];

const battleLeadAll = [...battleLead, ...battleLeadB];

const TRACKS: Record<TrackName, Track> = {
  title: {
    bpm: 96,
    lead: [
      76, 0, 79, 0, 76, 0, 72, 0, // C
      74, 0, 79, 0, 81, 0, 79, 0, // G
      76, 0, 81, 0, 84, 0, 81, 0, // Am
      81, 0, 84, 0, 86, 0, 84, 0, // F
      84, 0, 79, 0, 76, 0, 79, 0, // C
      74, 0, 77, 0, 79, 0, 81, 0, // G
      81, 0, 79, 0, 77, 0, 76, 0, // F
      72, 0, 0, 0, 0, 0, 0, 0, //   C home
    ],
    arp: [
      ...rep([60, 64, 67, 72], 2), ...rep([55, 59, 62, 67], 2),
      ...rep([57, 60, 64, 69], 2), ...rep([53, 57, 60, 65], 2),
      ...rep([60, 64, 67, 72], 2), ...rep([55, 59, 62, 67], 2),
      ...rep([53, 57, 60, 65], 2), ...rep([60, 64, 67, 72], 2),
    ],
    bass: [
      ...rep([48, 0, 55, 0], 2), ...rep([43, 0, 50, 0], 2),
      ...rep([45, 0, 52, 0], 2), ...rep([41, 0, 48, 0], 2),
      ...rep([48, 0, 55, 0], 2), ...rep([43, 0, 50, 0], 2),
      ...rep([41, 0, 48, 0], 2), 48, 0, 0, 0, 0, 0, 0, 0,
    ],
    kick: 'k.......'.repeat(7) + 'k.......',
    snare: '',
    hat: '..h...h.'.repeat(8),
    loop: true,
  },
  battle: {
    bpm: 152,
    lead: battleLeadAll,
    harm: battleLeadAll.map((n) => (n ? thirdDown(n) : 0)),
    arp: [
      ...rep([64, 67, 71, 76], 2), ...rep([64, 67, 71, 76], 2), // Em Em
      ...rep([60, 64, 67, 72], 2), ...rep([67, 71, 74, 79], 2), // C G
      ...rep([64, 67, 71, 76], 2), ...rep([64, 67, 71, 76], 2), // Em Em
      ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2), // D B
      ...rep([57, 60, 64, 69], 2), ...rep([60, 64, 67, 72], 2), // Am C
      ...rep([55, 59, 62, 67], 2), ...rep([62, 66, 69, 74], 2), // G D
      ...rep([57, 60, 64, 69], 2), ...rep([60, 64, 67, 72], 2), // Am C
      ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2), // D B
    ],
    bass: [
      ...rep([40, 52], 4), 40, 52, 40, 52, 41, 43, 45, 47, // Em + walkup
      ...rep([36, 48], 4), ...rep([43, 55], 4), // C G
      ...rep([40, 52], 4), 40, 52, 40, 52, 45, 47, 50, 47, // Em + walk
      ...rep([38, 50], 4), ...rep([35, 47], 3), 35, 47, // D B
      ...rep([45, 57], 4), ...rep([36, 48], 4), // Am C
      ...rep([43, 55], 4), ...rep([38, 50], 4), // G D
      ...rep([45, 57], 4), ...rep([36, 48], 4), // Am C
      ...rep([38, 50], 4), ...rep([35, 47], 3), 35, 47, // D B
    ],
    kick: 'k...k...'.repeat(2) + 'k...k.k.' + 'k...k...' + 'k...k...' + 'k...k.k.' + 'k...k...' + 'k.k.k.k.'
      + 'k...k...'.repeat(7) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(7) + '..s..ss.'
      + '..s...s.'.repeat(7) + '..s.sss.',
    hat: 'hhhhhhhh'.repeat(8) + '..h...h.'.repeat(8), // offbeat hats on B
    loop: true,
  },
  win: { // clear fanfare in C, then hands off to the title loop
    bpm: 140,
    lead: [
      72, 74, 76, 79, 81, 83, 84, 0, // run up to C6
      84, 0, 81, 0, 84, 0, 86, 0,
      86, 0, 84, 0, 83, 0, 81, 0,
      79, 0, 81, 0, 84, 0, 0, 0,
    ],
    bass: [
      ...rep([48, 0, 48, 0], 2), ...rep([41, 0, 41, 0], 2),
      ...rep([43, 0, 43, 0], 2), 48, 0, 0, 0, 0, 0, 0, 0,
    ],
    kick: 'k...k...'.repeat(3) + 'k.......',
    snare: '..s...s.'.repeat(3) + '....s...',
    hat: 'hhhhhhhh'.repeat(3) + 'hhhh....',
    next: 'title',
  },
};

let curTrack: TrackName | null = null;
let stepIdx = 0;
let nextT = 0;
let pumpTimer: ReturnType<typeof setInterval> | null = null;

export function music(name: TrackName | null) {
  if (name === curTrack) return;
  curTrack = name;
  restart();
}

function restart() {
  if (pumpTimer) {
    clearInterval(pumpTimer);
    pumpTimer = null;
  }
  stepIdx = 0;
  if (!curTrack || !ac || !mGain) return;
  nextT = ac.currentTime + 0.08;
  pumpTimer = setInterval(pump, 40);
}

function pump() {
  if (!ac || !curTrack || ac.state !== 'running') return;
  if (nextT < ac.currentTime - 0.25) nextT = ac.currentTime + 0.05; // tab was suspended
  let tr = TRACKS[curTrack];
  while (nextT < ac.currentTime + 0.2) {
    const i = stepIdx;
    const stepDur = 30 / tr.bpm;
    const voice = (arr: number[] | undefined, vol: number, type: OscillatorType, gate: number) => {
      const m = arr?.[i];
      if (m) mnote(M2F(m), nextT, stepDur * gate, type, vol);
    };
    voice(tr.lead, 0.06, 'square', 0.92);
    voice(tr.harm, 0.032, 'square', 0.9);
    voice(tr.arp, 0.028, 'square', 0.4);
    voice(tr.bass, 0.14, 'triangle', 0.85);
    if (tr.kick[i] && tr.kick[i] !== '.') mnote(150, nextT, 0.13, 'sine', 0.55, 45);
    if (tr.snare[i] && tr.snare[i] !== '.') mnoise(nextT, 0.14, 1900, 0.2);
    if (tr.hat[i] && tr.hat[i] !== '.') mnoise(nextT, 0.05, 7000, 0.06);
    stepIdx++;
    nextT += stepDur;
    if (stepIdx >= tr.lead.length) {
      stepIdx = 0;
      if (!tr.loop) {
        music(tr.next ?? null); // jingle over — hand off or go quiet
        return;
      }
      tr = TRACKS[curTrack];
    }
  }
}

// Mobile haptics; silently absent where unsupported (iOS Safari).
export function buzz(pattern: number | number[]) {
  navigator.vibrate?.(pattern);
}

// Real species cries (PokeAPI/cries .ogg), cached and replayable.
const cries = new Map<number, HTMLAudioElement>();
export function cry(id: number, vol = 0.2) {
  if (muted) return;
  try {
    let a = cries.get(id);
    if (!a) {
      a = new Audio(`sprites/cries/${id}.ogg`);
      cries.set(id, a);
    }
    a.volume = vol;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {
    // audio unavailable
  }
}
