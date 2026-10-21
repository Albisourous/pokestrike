// Tiny synthesized SFX — no audio assets, just WebAudio oscillators/noise.
// Browsers require a user gesture first, so call unlock() from pointerdown.
import { settings } from '../game/meta';

let ac: AudioContext | null = null;
let visBound = false;
let master: GainNode | null = null;
let mGain: GainNode | null = null;
let mFilter: BiquadFilterNode | null = null; // music-bus lowpass — softens square-wave edge
let mWet: GainNode | null = null; // echo send level — per-track depth
let gBus: WaveShaperNode | null = null; // guitar drive bus — tanh soft-clip dirt
let muted = localStorage.getItem('pk-mute') === '1';
const MASTER_VOL = 0.3; // the one loudness knob — 0.5 was hot

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('pk-mute', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : MASTER_VOL * settings().master;
}

// push the persisted sliders into the live nodes — master/music are gain
// params set once at init, so the settings panel pokes this on every drag
export function syncVolumes() {
  if (master) master.gain.value = muted ? 0 : MASTER_VOL * settings().master;
  if (mGain) mGain.gain.value = 0.3 * settings().music;
}

export function unlockAudio() {
  if (ac) {
    // just a resume — restarting the sequencer here restarts the song on
    // every tap while the old scheduled notes still ring = doubled audio
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    // a backgrounded tab shouldn't keep the sequencer running — suspend on
    // hide, resume on return (iOS suspends on its own; this covers the rest)
    if (typeof document !== 'undefined' && !visBound) {
      visBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!ac) return;
        if (document.hidden) void ac.suspend();
        else if (!muted) void ac.resume();
      });
    }
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL * settings().master;
    master.connect(ac.destination);
    mGain = ac.createGain();
    mGain.gain.value = 0.3 * settings().music; // music sits under the sfx
    // a gentle lowpass on the music bus takes the rasp off square leads —
    // the single biggest "this sounds grating" fix
    mFilter = ac.createBiquadFilter();
    mFilter.type = 'lowpass';
    mFilter.frequency.value = 3200;
    mFilter.Q.value = 0.4;
    mGain.connect(mFilter).connect(master);
    // the C418 trick: a slow feedback echo turns plucked notes into
    // space. Wet level is per-track — ambient soaks in it, battles stay dry
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.34;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    mWet = ac.createGain();
    mWet.gain.value = 0.18;
    mFilter.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(mWet).connect(master);
    // J-rock guitar bus: a tanh soft-clip waveshaper turns plain
    // sawtooth leads into distortion — upstream of the lowpass so the
    // fizz stays tamed
    gBus = ac.createWaveShaper();
    const curve = new Float32Array(257);
    for (let i = 0; i < 257; i++) curve[i] = Math.tanh(6 * ((i - 128) / 128));
    gBus.curve = curve;
    gBus.oversample = '2x';
    gBus.connect(mGain);
    restart();
  } catch {
    ac = null;
  }
}

// One-shot oscillator blip with a pitch slide and decay envelope.
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ac || !master || ac.state !== 'running') return;
  vol *= settings().sfx;
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
  vol *= settings().sfx;
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
  | 'sizzle' | 'gust' | 'invade' | 'beam' | 'tick' | 'bounce' | 'warn';

export function sfx(name: Sfx, pitch = 1) {
  switch (name) {
    case 'launch':
      noise(0.18, 900, 0.25, 0, -600);
      tone(500, 180, 0.15, 'sawtooth', 0.12);
      break;
    case 'perfect': // jackpot: rising sparkle run over a thump + shimmer tail, lone bell on top
      tone(190 * pitch, 95 * pitch, 0.16, 'sine', 0.18);
      [660, 880, 1108, 1760].forEach((f, i) => tone(f * pitch, f * pitch, 0.14, 'square', 0.09, i * 0.045));
      tone(2217 * pitch, 2217 * pitch, 0.26, 'sine', 0.06, 0.2); // C#7 crowns the A-major run
      noise(0.3, 2600 * pitch, 0.08, 0.06, 2400 * pitch);
      break;
    case 'tick': // timing cue — the fill just crossed into the gold zone
      tone(1760 * pitch, 1760 * pitch, 0.035, 'square', 0.045);
      break;
    case 'warn': // a foe's countdown hit 1 — two low blips, it swings next
      tone(340, 220, 0.1, 'triangle', 0.10);
      tone(340, 220, 0.1, 'triangle', 0.10, 0.14);
      break;
    case 'bounce': // pinball thock — pitch follows impact speed
      tone(340 * pitch, 110 * pitch, 0.05, 'sine', 0.11);
      noise(0.03, 1800 * pitch, 0.05);
      break;
    case 'hit': // pitch climbs with combo count
      tone(280 * pitch, 140 * pitch, 0.08, 'square', 0.16);
      noise(0.05, 2200, 0.1);
      break;
    case 'ko': // deeper body — knock transient up front, sub drop under the thud
      tone(220, 95, 0.07, 'triangle', 0.14);
      noise(0.3, 400, 0.3, 0, -250);
      tone(160, 50, 0.3, 'sine', 0.3);
      tone(85, 36, 0.34, 'sine', 0.2);
      break;
    case 'caught': // pokeball: ding-ding-DING with a glassy tail on the hold
      tone(880, 880, 0.09, 'sine', 0.18);
      tone(880, 880, 0.09, 'sine', 0.18, 0.14);
      tone(1320, 1320, 0.3, 'sine', 0.22, 0.3);
      noise(0.32, 4600, 0.045, 0.3, 2000); // sparkle under the ding
      tone(2640, 2640, 0.14, 'sine', 0.04, 0.44); // octave ghost
      break;
    case 'hurt':
      tone(220, 110, 0.12, 'sawtooth', 0.12);
      break;
    case 'zap':
      tone(1400 * pitch, 300 * pitch, 0.12, 'sawtooth', 0.14);
      noise(0.1, 3000 * pitch, 0.12);
      break;
    case 'boom':
      noise(0.35, 300 * pitch, 0.35, 0, -180 * pitch);
      tone(120 * pitch, 40 * pitch, 0.35, 'sine', 0.32);
      break;
    case 'splash':
      noise(0.25, 1200 * pitch, 0.2, 0, 800 * pitch);
      break;
    case 'heal':
      [520, 660, 780].forEach((f, i) => tone(f * pitch, f * 1.2 * pitch, 0.15, 'sine', 0.1, i * 0.06));
      break;
    case 'ui':
      tone(700 * pitch, 900 * pitch, 0.06, 'square', 0.08);
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

// --- jingles: short sequenced motifs for one-off moments ---
// Midi notes + second offsets fired through the sfx voice (tone), so they
// honour the sfx slider and the master mute gate like any other blip.
interface JNote {
  m: number; // midi pitch
  t: number; // offset in seconds
  d: number; // ring-out length
  v: number;
  w?: OscillatorType; // default square — the bright chiptune voice
}

const JINGLES: Record<'win' | 'lose' | 'catch' | 'task' | 'gym' | 'item', JNote[]> = {
  win: [ // rising fanfare in C — five-note run, full-chord bloom on top
    { m: 67, t: 0,    d: 0.1,  v: 0.1 },
    { m: 72, t: 0.1,  d: 0.1,  v: 0.1 },
    { m: 76, t: 0.2,  d: 0.1,  v: 0.1 },
    { m: 79, t: 0.3,  d: 0.1,  v: 0.11 },
    { m: 81, t: 0.4,  d: 0.09, v: 0.11 },
    { m: 84, t: 0.52, d: 0.6,  v: 0.13 },
    { m: 79, t: 0.52, d: 0.55, v: 0.05, w: 'triangle' }, // G+E pad under the C6
    { m: 76, t: 0.52, d: 0.55, v: 0.05, w: 'triangle' },
  ],
  lose: [ // somber Am descent — settles on low E under its own octave
    { m: 64, t: 0,   d: 0.2,  v: 0.12, w: 'triangle' },
    { m: 60, t: 0.2, d: 0.2,  v: 0.12, w: 'triangle' },
    { m: 57, t: 0.4, d: 0.22, v: 0.12, w: 'triangle' },
    { m: 52, t: 0.6, d: 0.45, v: 0.12, w: 'triangle' },
    { m: 40, t: 0.6, d: 0.45, v: 0.07, w: 'sine' },
  ],
  catch: [ // three ball-wobble beats, then the resolve leaps home — captured
    { m: 79, t: 0,    d: 0.08, v: 0.1 },
    { m: 79, t: 0.11, d: 0.08, v: 0.1 },
    { m: 79, t: 0.22, d: 0.08, v: 0.1 },
    { m: 81, t: 0.36, d: 0.1,  v: 0.11 },
    { m: 84, t: 0.5,  d: 0.5,  v: 0.12 },
    { m: 88, t: 0.5,  d: 0.4,  v: 0.045, w: 'sine' }, // third shimmer on the hold
  ],
  task: [ // claim ping — a fifth up, gone inside half a second
    { m: 83, t: 0,    d: 0.07, v: 0.09 },
    { m: 88, t: 0.07, d: 0.3,  v: 0.09 },
  ],
  item: [ // bag-item pickup — a bright G5→C6→E6 arpeggio ending on a hold
    { m: 79, t: 0,    d: 0.07, v: 0.1 },
    { m: 84, t: 0.07, d: 0.07, v: 0.1 },
    { m: 88, t: 0.14, d: 0.3,  v: 0.11 },
  ],
  gym: [ // badge stab — V hit then the home chord lands heavy
    { m: 55, t: 0,    d: 0.13, v: 0.08 },
    { m: 59, t: 0,    d: 0.13, v: 0.08 },
    { m: 62, t: 0,    d: 0.13, v: 0.08 },
    { m: 67, t: 0,    d: 0.13, v: 0.08 },
    { m: 48, t: 0.17, d: 0.6,  v: 0.09 },
    { m: 60, t: 0.17, d: 0.6,  v: 0.09 },
    { m: 64, t: 0.17, d: 0.6,  v: 0.09 },
    { m: 67, t: 0.17, d: 0.6,  v: 0.09 },
    { m: 72, t: 0.17, d: 0.6,  v: 0.11 },
    { m: 36, t: 0.17, d: 0.5,  v: 0.09, w: 'sine' }, // sub root for weight
  ],
};

export function playJingle(kind: 'win' | 'lose' | 'catch' | 'task' | 'gym' | 'item') {
  if (!ac || ac.state !== 'running' || muted) return;
  for (const n of JINGLES[kind]) tone(M2F(n.m), M2F(n.m), n.d, n.w ?? 'square', n.v, n.t);
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
  leadWave?: OscillatorType; // lead timbre — default square
  bassWave?: OscillatorType;
  swing?: number; // 0..0.2 — off-beat 8ths lean late for groove
  vib?: number; // lead vibrato depth in Hz — 0 keeps it chiptune-dry
  leadGate?: number; // note length in steps — >1 sustains across rests (pads)
  arpGate?: number;
  bassGate?: number;
  echo?: number; // wet-echo send 0..0.4 — ambient swims, battle stays tight
  alt?: number[]; // second lead phrase — loops alternate A/A' so repeats drift
  altHarm?: number[]; // harmony voiced to the alt lead — plays under it
  guitar?: boolean; // route the lead through the distortion bus — J-rock shred
  slap?: boolean; // bass gets a pitch-snap + pick click per note — slap feel
  stab?: number[][]; // synth-brass chord stabs — midi arrays per step, [] = rest
}
type TrackName = 'title' | 'battle' | 'map' | 'trainer' | 'gym' | 'win';

function mnote(f: number, t0: number, dur: number, type: OscillatorType, vol: number, f1 = 0, vib = 0, dest?: AudioNode) {
  if (!ac || !mGain) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.6);
  g.gain.setValueAtTime(vol, t0);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  if (vib) {
    // slow wobble fading in mid-note — GBA leads warble, they don't sit flat
    const l = ac.createOscillator();
    const lg = ac.createGain();
    l.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t0);
    lg.gain.linearRampToValueAtTime(vib, t0 + dur * 0.6);
    l.connect(lg).connect(o.frequency);
    l.start(t0);
    l.stop(t0 + dur + 0.02);
  }
  o.connect(g).connect(dest ?? mGain);
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

// A section: the riff — syncopated shreds that peak on E6, then a
// harmonic-minor pull home. Written for the distortion bus.
const battleLead = [
  76, 76, 83, 83, 82, 83, 76, 74, // Em riff — B5 bend grabs
  76, 0, 76, 79, 81, 0, 83, 0, //  answer with air
  84, 83, 81, 79, 81, 83, 79, 76, // descend, snap back
  74, 76, 78, 79, 81, 83, 84, 86, // climb
  88, 86, 84, 83, 81, 79, 78, 76, // peak shred down
  79, 81, 83, 81, 79, 76, 74, 71, // fall to the low string
  76, 0, 79, 0, 81, 0, 83, 0, //  restate
  86, 84, 83, 81, 79, 78, 75, 0, // B — D# tension pulls home
];

// B section: power-chord drive — doubled roots, stab gaps, one long
// climb back up to E6 before the drop.
const battleLeadB = [
  76, 76, 76, 0, 79, 79, 0, 81, // chug with gaps
  83, 83, 0, 83, 84, 0, 86, 0,
  88, 86, 84, 83, 81, 79, 78, 76, // cascade down
  74, 76, 78, 0, 79, 0, 81, 0,
  76, 76, 76, 0, 79, 79, 0, 83, // restate the chug higher
  86, 86, 0, 84, 83, 0, 81, 0,
  83, 81, 79, 81, 83, 84, 86, 88, // run to the peak
  86, 84, 83, 81, 79, 0, 75, 0, // drop out on D#
];

const battleLeadAll = [...battleLead, ...battleLeadB];

// Second verse: the loop's next pass answers the riff instead of
// restating it — a call-and-response counter-melody over the same chug.
const battleLeadAlt = [
  0, 0, 81, 0, 79, 0, 81, 0, // let the riff breathe, then answer
  76, 0, 79, 0, 81, 0, 79, 0,
  83, 0, 81, 0, 79, 0, 76, 0, // descend
  74, 0, 76, 0, 78, 0, 79, 0, // walk back up
  81, 0, 83, 0, 84, 0, 83, 0, // peak at C6
  81, 0, 79, 0, 76, 0, 74, 0, // fall
  71, 0, 74, 0, 76, 0, 79, 0, // rebuild
  83, 0, 81, 0, 79, 0, 0, 0, // breathe before the chug
  ...battleLeadB,
];

const TRACKS: Record<TrackName, Track> = {
  title: {
    bpm: 96,
    leadWave: 'triangle', // whistle-warm menu theme
    vib: 2,
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
    // J-rock anime battle: distorted riff, slap bass, frantic kit,
    // arcade brass stabs — 170 BPM, high momentum, seamless loop
    bpm: 170,
    lead: battleLeadAll,
    harm: battleLeadAll.map((n) => (n ? thirdDown(n) : 0)),
    alt: battleLeadAlt,
    altHarm: battleLeadAlt.map((n) => (n ? thirdDown(n) : 0)),
    leadWave: 'sawtooth',
    guitar: true,
    slap: true,
    bassGate: 0.5, // tight pops, no ringing
    vib: 4,
    echo: 0.12,
    stab: [
      // Em stabs answer the riff on off-beats — 90s arcade brass
      [], [64, 67, 71], [], [64, 67, 71], [], [], [64, 67, 71], [],
      [], [64, 67, 71], [], [64, 67, 71], [], [], [64, 67, 71], [],
      [], [60, 64, 67], [], [60, 64, 67], [], [], [60, 64, 67], [],
      [], [62, 66, 69], [], [62, 66, 69], [], [], [62, 66, 69], [],
      [], [64, 67, 71], [], [64, 67, 71], [], [], [64, 67, 71], [],
      [], [64, 67, 71], [], [64, 67, 71], [], [], [64, 67, 71], [],
      [], [62, 66, 69], [], [62, 66, 69], [], [], [62, 66, 69], [],
      [], [59, 63, 66], [], [59, 63, 66], [], [], [59, 63, 66], [],
      // B: brass on every off-beat — max density under the chug
      [], [64, 67, 71], [], [64, 67, 71], [], [64, 67, 71], [], [64, 67, 71],
      [], [60, 64, 67], [], [60, 64, 67], [], [60, 64, 67], [], [60, 64, 67],
      [], [62, 66, 69], [], [62, 66, 69], [], [62, 66, 69], [], [62, 66, 69],
      [], [59, 63, 66], [], [59, 63, 66], [], [59, 63, 66], [], [59, 63, 66],
      [], [64, 67, 71], [], [64, 67, 71], [], [64, 67, 71], [], [64, 67, 71],
      [], [60, 64, 67], [], [60, 64, 67], [], [60, 64, 67], [], [60, 64, 67],
      [], [62, 66, 69], [], [62, 66, 69], [], [62, 66, 69], [], [62, 66, 69],
      [], [59, 63, 66], [], [59, 63, 66], [], [59, 63, 66], [], [64, 67, 71],
    ],
    arp: [
      // Em Em C D Em Em D B — then Em C D B twice under the stabs
      ...rep([64, 67, 71, 76], 4), ...rep([60, 64, 67, 72], 2), ...rep([62, 66, 69, 74], 2),
      ...rep([64, 67, 71, 76], 4), ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2),
      ...rep([64, 67, 71, 76], 2), ...rep([60, 64, 67, 72], 2), ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2),
      ...rep([64, 67, 71, 76], 2), ...rep([60, 64, 67, 72], 2), ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2),
    ],
    bass: [
      // slap pops in octaves — Em Em C D | Em Em D B
      ...rep([40, 52, 40, 52, 40, 52, 40, 52], 2),
      ...rep([36, 48, 36, 48, 36, 48, 36, 48], 1),
      ...rep([38, 50, 38, 50, 38, 50, 38, 50], 1),
      ...rep([40, 52, 40, 52, 40, 52, 40, 52], 2),
      ...rep([38, 50, 38, 50, 38, 50, 38, 50], 1),
      ...rep([35, 47, 35, 47, 35, 47, 35, 47], 1),
      // B: Em C D B, twice — last bar walks up to the loop point
      ...rep([40, 52, 40, 52, 40, 52, 40, 52], 1),
      ...rep([36, 48, 36, 48, 36, 48, 36, 48], 1),
      ...rep([38, 50, 38, 50, 38, 50, 38, 50], 1),
      ...rep([35, 47, 35, 47, 35, 47, 35, 47], 1),
      ...rep([40, 52, 40, 52, 40, 52, 40, 52], 1),
      ...rep([36, 48, 36, 48, 36, 48, 36, 48], 1),
      ...rep([38, 50, 38, 50, 38, 50, 38, 50], 1),
      35, 47, 35, 47, 38, 40, 42, 44, // chromatic walk-up, seamless loop
    ],
    kick: 'k.k.k.k.'.repeat(7) + 'kkkkkkk.'
      + 'k.k.kk.k'.repeat(7) + 'kkkkkkkk', // frantic doubles, fill ends
    snare: '..s...s.'.repeat(7) + '..ssss..'
      + '..s..ss.'.repeat(7) + '.ssssss.', // rapid fills close each section
    hat: 'c...h.h.'.repeat(7) + 'h.h.h.h.'
      + 'chhhhhhh' + 'hhhhhhhh'.repeat(7), // crash hits the B downbeat
    loop: true,
  },
  map: {
    // overworld ambient — the C418 idiom: sparse sine plucks over a
    // sustained pad, no drums, notes ringing into the feedback echo.
    // Most steps are rests; the melody breathes between them.
    bpm: 66,
    leadWave: 'sine',
    leadGate: 5, // plucks ring ~2.3s — they blur into the pad
    arpGate: 9, // chord tones sustain ~4s — a real pad, not an arpeggio
    echo: 0.36,
    vib: 1,
    lead: [
      72, 0, 0, 0, 0, 0, 76, 0, 0, 0, 79, 0, 0, 0, 0, 0,
      74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 0, 0, 0,
      72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 79, 0, 0, 0,
      81, 0, 0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    alt: [ // the loop's second pass wanders somewhere new
      0, 0, 74, 0, 0, 0, 0, 0, 79, 0, 0, 0, 0, 0, 76, 0,
      0, 0, 0, 0, 81, 0, 0, 0, 0, 0, 79, 0, 0, 0, 0, 0,
      72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74, 0,
      71, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    arp: [
      // pad cycle C → G → Am → F, tones staggered so they stack into chords
      60, 0, 64, 0, 67, 0, 72, 0, 55, 0, 59, 0, 62, 0, 67, 0,
      57, 0, 60, 0, 64, 0, 69, 0, 53, 0, 57, 0, 60, 0, 65, 0,
      60, 0, 64, 0, 67, 0, 72, 0, 55, 0, 59, 0, 62, 0, 67, 0,
      57, 0, 60, 0, 64, 0, 69, 0, 53, 0, 57, 0, 60, 0, 65, 0,
    ],
    bass: [
      36, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0,
      45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0,
      36, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0,
      45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0,
    ],
    kick: '',
    snare: '',
    hat: '',
    loop: true,
  },
  trainer: {
    // trainer battle — bright C-major march, brassy square stabs, the
    // heroic key change real Pokémon trainer themes live in
    bpm: 144,
    leadWave: 'square',
    swing: 0.04,
    echo: 0.14,
    lead: [
      72, 0, 76, 0, 79, 0, 76, 0, // C E G E — call
      77, 0, 76, 0, 74, 0, 72, 0, // fall home
      74, 0, 77, 0, 81, 0, 77, 0, // D F A F
      79, 0, 77, 0, 76, 0, 74, 0, // resolve down
      72, 0, 76, 0, 79, 0, 84, 0, // leap to C6
      83, 0, 81, 0, 79, 0, 81, 0, // B A G A
      83, 0, 84, 0, 83, 0, 81, 0, // B C B A
      79, 0, 0, 0, 74, 0, 76, 0, // breathe, pick back up
      76, 76, 0, 79, 0, 81, 0, 79, // B: stabs
      77, 77, 0, 81, 0, 83, 0, 81,
      76, 76, 0, 79, 0, 84, 0, 83,
      81, 0, 79, 0, 76, 0, 74, 0,
      72, 0, 76, 0, 79, 0, 81, 0,
      83, 0, 81, 0, 79, 0, 81, 0,
      84, 0, 83, 0, 81, 0, 79, 0,
      76, 0, 74, 0, 72, 0, 0, 0,
    ],
    harm: [ // hand-voiced thirds — C major, not the E-minor pool
      67, 0, 72, 0, 76, 0, 72, 0,
      74, 0, 72, 0, 69, 0, 67, 0,
      71, 0, 74, 0, 76, 0, 74, 0,
      76, 0, 74, 0, 72, 0, 71, 0,
      67, 0, 72, 0, 76, 0, 79, 0,
      79, 0, 77, 0, 76, 0, 77, 0,
      79, 0, 81, 0, 79, 0, 77, 0,
      76, 0, 0, 0, 71, 0, 72, 0,
      72, 72, 0, 76, 0, 79, 0, 76,
      74, 74, 0, 77, 0, 79, 0, 77,
      72, 72, 0, 76, 0, 81, 0, 79,
      77, 0, 76, 0, 72, 0, 71, 0,
      69, 0, 72, 0, 76, 0, 77, 0,
      79, 0, 77, 0, 76, 0, 77, 0,
      81, 0, 79, 0, 77, 0, 76, 0,
      72, 0, 71, 0, 67, 0, 0, 0,
    ],
    arp: [
      // C C F G | C Am Dm G | then C F C G twice under the stabs
      ...rep([60, 64, 67, 72], 4), ...rep([65, 69, 72, 77], 2), ...rep([67, 71, 74, 79], 2),
      ...rep([60, 64, 67, 72], 2), ...rep([57, 60, 64, 69], 2), ...rep([62, 65, 69, 74], 2), ...rep([67, 71, 74, 79], 2),
      ...rep([60, 64, 67, 72], 2), ...rep([65, 69, 72, 77], 2), ...rep([60, 64, 67, 72], 2), ...rep([67, 71, 74, 79], 2),
      ...rep([60, 64, 67, 72], 2), ...rep([65, 69, 72, 77], 2), ...rep([60, 64, 67, 72], 2), ...rep([67, 71, 74, 79], 2),
    ],
    bass: [
      ...rep([36, 48], 8), ...rep([41, 53], 4), ...rep([43, 55], 4),
      ...rep([36, 48], 4), ...rep([33, 45], 4), ...rep([38, 50], 4), ...rep([43, 55], 4),
      ...rep([36, 48], 4), ...rep([41, 53], 4), ...rep([36, 48], 4), ...rep([43, 55], 4),
      ...rep([36, 48], 4), ...rep([41, 53], 4), ...rep([36, 48], 4), ...rep([43, 55], 4),
    ],
    kick: 'k...k.k.'.repeat(15) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(15) + '..s..ss.',
    hat: 'hhhhhhhh'.repeat(8) + 'h.h.h.h.'.repeat(8),
    loop: true,
  },
  gym: {
    // gym leader — the fastest theme: chromatic tension, urgent pedal
    // bass, stabs that never sit still. Minor, menacing, final.
    bpm: 168,
    leadWave: 'sawtooth',
    guitar: true,
    slap: true,
    bassGate: 0.55,
    swing: 0.03,
    vib: 2,
    echo: 0.1,
    lead: [
      76, 0, 83, 0, 82, 0, 83, 0, // E B Bb B — chromatic grip
      81, 0, 79, 0, 76, 0, 74, 0, // unwind
      76, 0, 79, 0, 81, 0, 83, 0, // climb
      86, 0, 84, 0, 83, 0, 81, 0, // E6 fall
      83, 0, 84, 0, 83, 0, 79, 0, // B C B G
      81, 0, 83, 0, 84, 0, 86, 0, // A B C E6
      87, 0, 86, 0, 84, 0, 83, 0, // Eb6 — peak chromatic
      82, 0, 83, 0, 0, 0, 75, 0, // Bb B rest D# — pull home
      76, 76, 0, 76, 79, 0, 81, 0, // B: stabs
      83, 83, 0, 83, 81, 0, 79, 0,
      76, 76, 0, 76, 79, 0, 81, 0,
      83, 0, 84, 0, 86, 0, 84, 0,
      88, 0, 86, 0, 84, 0, 83, 0,
      81, 0, 79, 0, 81, 0, 83, 0,
      84, 0, 83, 0, 81, 0, 79, 0,
      78, 0, 75, 0, 78, 0, 0, 0,
    ],
    harm: [ // thirdDown would trip on the chromatics — voice it by hand
      72, 0, 79, 0, 78, 0, 79, 0,
      78, 0, 76, 0, 72, 0, 71, 0,
      72, 0, 76, 0, 78, 0, 79, 0,
      83, 0, 81, 0, 79, 0, 78, 0,
      79, 0, 81, 0, 79, 0, 76, 0,
      78, 0, 79, 0, 81, 0, 83, 0,
      84, 0, 83, 0, 81, 0, 79, 0,
      79, 0, 79, 0, 0, 0, 71, 0,
      72, 72, 0, 72, 76, 0, 78, 0,
      79, 79, 0, 79, 78, 0, 76, 0,
      72, 72, 0, 72, 76, 0, 78, 0,
      79, 0, 81, 0, 83, 0, 81, 0,
      84, 0, 83, 0, 81, 0, 79, 0,
      78, 0, 76, 0, 78, 0, 79, 0,
      81, 0, 79, 0, 78, 0, 76, 0,
      75, 0, 71, 0, 75, 0, 0, 0,
    ],
    arp: [
      // Em Em Am B | Em C Am B — then doubles under the stabs
      ...rep([64, 67, 71, 76], 4), ...rep([57, 60, 64, 69], 2), ...rep([59, 63, 66, 71], 2),
      ...rep([64, 67, 71, 76], 2), ...rep([60, 64, 67, 72], 2), ...rep([57, 60, 64, 69], 2), ...rep([59, 63, 66, 71], 2),
      ...rep([64, 67, 71, 76], 4), ...rep([60, 64, 67, 72], 2), ...rep([64, 67, 71, 76], 2),
      ...rep([57, 60, 64, 69], 2), ...rep([60, 64, 67, 72], 2), ...rep([62, 66, 69, 74], 2), ...rep([59, 63, 66, 71], 2),
    ],
    bass: [
      // pedal E — the urgency is the root refusing to move
      ...rep([40, 52], 8), ...rep([45, 57], 4), ...rep([35, 47], 4),
      ...rep([40, 52], 4), ...rep([36, 48], 4), ...rep([45, 57], 4), ...rep([35, 47], 4),
      ...rep([40, 52], 8), ...rep([36, 48], 4), ...rep([40, 52], 4),
      ...rep([45, 57], 4), ...rep([36, 48], 4), ...rep([38, 50], 4), ...rep([35, 47], 4),
    ],
    kick: 'k.k.k...'.repeat(7) + 'k.k.k.k.'
      + 'k.k.k.k.'.repeat(8), // B section never lets up
    snare: '..s...s.'.repeat(7) + '..s..ss.'
      + '..s...s.'.repeat(7) + '.s.s.ss.',
    hat: 'chhhhhhh' + 'hhhhhhhh'.repeat(15), // crash on the downbeat
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
let leadSel = 0; // alt-phrase rotation — flips each pass through the loop
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
  leadSel = 0;
  if (!curTrack || !ac || !mGain) return;
  if (mWet) mWet.gain.value = TRACKS[curTrack].echo ?? 0.18; // per-track space
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
    // swing: off-beat 8ths land a hair late — the groove that stops a
    // loop from marching like a metronome
    const t0 = nextT + (i % 2 === 1 ? stepDur * (tr.swing ?? 0) : 0);
    const voice = (arr: number[] | undefined, vol: number, type: OscillatorType, gate: number, vib = 0, dest?: AudioNode) => {
      const m = arr?.[i];
      if (m) mnote(M2F(m), t0, stepDur * gate, type, vol, 0, vib, dest);
    };
    const altPass = leadSel % 2 === 1 && tr.alt;
    voice(altPass ? tr.alt! : tr.lead, 0.055, tr.leadWave ?? 'square', tr.leadGate ?? 0.92, tr.vib, tr.guitar ? gBus ?? undefined : undefined);
    voice(altPass ? (tr.altHarm ?? tr.harm) : tr.harm, 0.03, tr.leadWave ?? 'square', tr.leadGate ?? 0.9);
    voice(tr.arp, 0.026, 'square', tr.arpGate ?? 0.4);
    const bm = tr.bass[i];
    if (bm) {
      // slap bass: the pitch snaps down off the attack like a popped
      // string, and a pick click sits in front of the note
      mnote(M2F(bm), t0, stepDur * (tr.bassGate ?? 0.85), tr.bassWave ?? 'triangle', 0.13, tr.slap ? M2F(bm) * 0.55 : 0);
      if (tr.slap) mnoise(t0, 0.03, 3200, 0.06);
    }
    // arcade brass: short bright chord stabs on their own channel
    const st = tr.stab?.[i];
    if (st) for (const m of st) if (m) mnote(M2F(m), t0, stepDur * 0.6, 'square', 0.032);
    if (tr.kick[i] && tr.kick[i] !== '.') mnote(150, t0, 0.13, 'sine', 0.45, 45);
    if (tr.snare[i] && tr.snare[i] !== '.') mnoise(t0, 0.14, 1900, 0.16);
    const hc = tr.hat[i];
    if (hc === 'c') mnoise(t0, 0.4, 5500, 0.11); // crash — section accents
    else if (hc && hc !== '.') mnoise(t0, 0.05, 7000, 0.038);
    stepIdx++;
    nextT += stepDur;
    if (stepIdx >= tr.lead.length) {
      stepIdx = 0;
      leadSel++; // next pass plays the alt phrase if the track has one
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
  if (!settings().haptics) return;
  navigator.vibrate?.(pattern);
}

// Real species cries (PokeAPI/cries .ogg), cached and replayable.
const cries = new Map<number, HTMLAudioElement>();
// master cry trim — the .ogg sources are mastered way hotter than the
// synth mix, so every call-site volume scales down by this factor
const CRY_VOL = 0.25;
export function cry(id: number, vol = 0.2) {
  if (muted) return;
  try {
    let a = cries.get(id);
    if (!a) {
      a = new Audio(`sprites/cries/${id}.ogg`);
      cries.set(id, a);
    }
    a.volume = vol * CRY_VOL * settings().cries;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {
    // audio unavailable
  }
}
