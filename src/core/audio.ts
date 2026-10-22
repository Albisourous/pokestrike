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
// storage can be blocked outright (private mode, locked-down webviews) — an
// unguarded getItem at module eval would sink the whole import graph
let muted = (() => {
  try {
    // pk-mute is the pre-rename key — read it as a fallback, write only pk_mute
    return (localStorage.getItem('pk_mute') ?? localStorage.getItem('pk-mute')) === '1';
  } catch {
    return false;
  }
})();
const MASTER_VOL = 0.3; // the one loudness knob — 0.5 was hot

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('pk_mute', muted ? '1' : '0');
  } catch {
    /* a throw inside a pointer handler latches the crash card — the session toggle still works */
  }
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
    weatherBed(bedWant); // a bed requested before the first gesture arms here
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
  if (name === 'ui' && !settings().uiSfx) return;
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

export type JingleKind = 'lose' | 'catch' | 'task' | 'gym' | 'item'
  | 'clear' | 'fail' | 'hatch' | 'rest'
  | 'gym_forge' | 'gym_shade' | 'gym_earth' | 'gym_gale' | 'invade';

const JINGLES: Record<JingleKind, JNote[]> = {
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
  clear: [ // stage clear — a quick G-pentatonic flick that blooms on held D6
    { m: 76, t: 0,    d: 0.08, v: 0.09 },
    { m: 79, t: 0.08, d: 0.08, v: 0.09 },
    { m: 81, t: 0.16, d: 0.08, v: 0.1 },
    { m: 84, t: 0.24, d: 0.09, v: 0.11 },
    { m: 86, t: 0.36, d: 0.55, v: 0.12 }, // D6 — the resolve rings out
    { m: 79, t: 0.36, d: 0.5,  v: 0.05, w: 'triangle' }, // G+B pad — major bloom
    { m: 83, t: 0.36, d: 0.5,  v: 0.05, w: 'triangle' },
  ],
  fail: [ // catch fail — the two-note wha-wha deflate, a half-step down
    { m: 64, t: 0,   d: 0.16, v: 0.11, w: 'sawtooth' },
    { m: 63, t: 0.2, d: 0.34, v: 0.11, w: 'sawtooth' },
  ],
  hatch: [ // egg — a Cmaj7 flutter that ends on the 9th, asking not answering
    { m: 72, t: 0,    d: 0.07, v: 0.09 },
    { m: 76, t: 0.06, d: 0.07, v: 0.09 },
    { m: 79, t: 0.12, d: 0.07, v: 0.09 },
    { m: 83, t: 0.18, d: 0.09, v: 0.1 },
    { m: 86, t: 0.27, d: 0.32, v: 0.09, w: 'sine' }, // the maj9 hangs — curious
  ],
  rest: [ // rest stop — a soft sine triad climbing home, lullaby-warm
    { m: 72, t: 0,    d: 0.14, v: 0.09, w: 'sine' },
    { m: 76, t: 0.14, d: 0.14, v: 0.09, w: 'sine' },
    { m: 79, t: 0.28, d: 0.14, v: 0.09, w: 'sine' },
    { m: 84, t: 0.42, d: 0.34, v: 0.1,  w: 'sine' },
    { m: 88, t: 0.42, d: 0.3,  v: 0.04, w: 'triangle' }, // octave shimmer
  ],
  // --- gym type stabs (S7): one dark V-hit each, ~0.5s, fired at boss-wave
  // spawn — they layer over the gym theme, family-colored by GYM_STAB below
  gym_forge: [ // G7 snaps up to a blazing C — hammer hitting hot steel
    { m: 62, t: 0,    d: 0.12, v: 0.09 },
    { m: 65, t: 0,    d: 0.12, v: 0.09 },
    { m: 67, t: 0,    d: 0.12, v: 0.09 },
    { m: 71, t: 0,    d: 0.12, v: 0.09 },
    { m: 60, t: 0.15, d: 0.4,  v: 0.1 },
    { m: 64, t: 0.15, d: 0.4,  v: 0.1 },
    { m: 67, t: 0.15, d: 0.4,  v: 0.1 },
    { m: 72, t: 0.15, d: 0.4,  v: 0.11 },
  ],
  gym_shade: [ // G+5b5 — a dominant that refuses to resolve cleanly, low and dark
    { m: 55, t: 0,    d: 0.14, v: 0.09, w: 'sawtooth' },
    { m: 61, t: 0,    d: 0.14, v: 0.09, w: 'sawtooth' },
    { m: 65, t: 0,    d: 0.14, v: 0.09, w: 'sawtooth' },
    { m: 59, t: 0.16, d: 0.4,  v: 0.09, w: 'sawtooth' },
    { m: 62, t: 0.16, d: 0.4,  v: 0.09, w: 'sawtooth' },
    { m: 65, t: 0.16, d: 0.4,  v: 0.09, w: 'sawtooth' },
    { m: 43, t: 0.16, d: 0.45, v: 0.07, w: 'sine' }, // sub G — it never lands home
  ],
  gym_earth: [ // a low G7 that drops onto C — bedrock weight under the hit
    { m: 55, t: 0,    d: 0.13, v: 0.09, w: 'triangle' },
    { m: 59, t: 0,    d: 0.13, v: 0.09, w: 'triangle' },
    { m: 62, t: 0,    d: 0.13, v: 0.09, w: 'triangle' },
    { m: 65, t: 0,    d: 0.13, v: 0.09, w: 'triangle' },
    { m: 48, t: 0.15, d: 0.42, v: 0.1,  w: 'triangle' },
    { m: 55, t: 0.15, d: 0.42, v: 0.1,  w: 'triangle' },
    { m: 60, t: 0.15, d: 0.42, v: 0.1,  w: 'triangle' },
    { m: 64, t: 0.15, d: 0.42, v: 0.1,  w: 'triangle' },
    { m: 36, t: 0.15, d: 0.4,  v: 0.08, w: 'sine' }, // sub C
  ],
  gym_gale: [ // open-fifth G — no third — blooming into an airy C6/9
    { m: 55, t: 0,    d: 0.12, v: 0.08 },
    { m: 62, t: 0,    d: 0.12, v: 0.08 },
    { m: 67, t: 0,    d: 0.12, v: 0.08 },
    { m: 60, t: 0.16, d: 0.42, v: 0.08, w: 'triangle' },
    { m: 64, t: 0.16, d: 0.42, v: 0.08, w: 'triangle' },
    { m: 69, t: 0.16, d: 0.42, v: 0.08, w: 'triangle' }, // the 9th — open air
    { m: 72, t: 0.16, d: 0.42, v: 0.09, w: 'triangle' },
    { m: 84, t: 0.3,  d: 0.25, v: 0.04, w: 'sine' }, // altitude shimmer
  ],
  invade: [ // S9 legendary crash-in — chromatic run-up, then a dark E
    // minor hit with the b5 (Bb) snarling against the root
    { m: 45, t: 0,    d: 0.06, v: 0.1,  w: 'sawtooth' },
    { m: 46, t: 0.07, d: 0.06, v: 0.1,  w: 'sawtooth' },
    { m: 47, t: 0.14, d: 0.06, v: 0.1,  w: 'sawtooth' },
    { m: 48, t: 0.21, d: 0.07, v: 0.11, w: 'sawtooth' },
    { m: 64, t: 0.3,  d: 0.32, v: 0.11, w: 'sawtooth' },
    { m: 70, t: 0.3,  d: 0.32, v: 0.1,  w: 'sawtooth' }, // Bb — the legendary snarl
    { m: 67, t: 0.3,  d: 0.32, v: 0.09, w: 'sawtooth' },
    { m: 40, t: 0.3,  d: 0.35, v: 0.11, w: 'triangle' }, // E2 slams underneath
    { m: 28, t: 0.3,  d: 0.35, v: 0.09, w: 'sine' }, // sub E
  ],
};

// gym leader type → stab jingle. battle.ts stays dumb — it looks the
// leader's type string up here and plays whatever comes back.
export const GYM_STAB: Record<string, JingleKind> = {
  fire: 'gym_forge', electric: 'gym_forge', fighting: 'gym_forge',
  ghost: 'gym_shade', poison: 'gym_shade', psychic: 'gym_shade',
  rock: 'gym_earth', normal: 'gym_earth', grass: 'gym_earth',
  flying: 'gym_gale', water: 'gym_gale',
};

export function playJingle(kind: JingleKind) {
  if (!ac || ac.state !== 'running' || muted) return;
  for (const n of JINGLES[kind]) tone(M2F(n.m), M2F(n.m), n.d, n.w ?? 'square', n.v, n.t);
}

// --- chiptune sequencer: original loops, NES-flavored voices ---
// Steps are 8th notes; note arrays use midi (0 = rest), drum strings
// use '.' = rest. Scheduled ~0.2s ahead so loops never gap.

const M2F = (m: number) => 440 * 2 ** ((m - 69) / 12);

export interface Track {
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
export type TrackName = 'title' | 'battle' | 'map' | 'trainer' | 'gym' | 'win'
  | 'battle_grove' | 'battle_cavern' | 'battle_volcano' | 'battle_sky'
  | 'trainer_forge' | 'trainer_shade' | 'trainer_earth' | 'trainer_gale'
  | 'draft_theme' | 'reward_theme';

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
// the shared 1s white-noise buffer — hats/snares slice it, the weather
// bed loops it. Built lazily on first use (needs a live context).
function noiseBuf() {
  if (!nbuf && ac) {
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return nbuf;
}
function mnoise(t0: number, dur: number, freq: number, vol: number) {
  if (!ac || !mGain) return;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf();
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

// E phrygian pool for battle_volcano — thirdDown only knows E natural
// minor (F#), but the whole point of this track is the F-natural b2
// grind, so its harmony is voiced off this pool instead.
const EPHR = [64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
const phr3 = (m: number) => {
  const i = EPHR.indexOf(m);
  return i > 1 ? EPHR[i - 2] : m;
};

// Same trick for the biome modes — every harm voice sits a scale-third
// under its lead, pooled to the mode so no wrong notes slip in.
const CLYD = [60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84, 86, 88];
const clyd3 = (m: number) => {
  const i = CLYD.indexOf(m);
  return i > 1 ? CLYD[i - 2] : m;
};
const DDOR = [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86];
const ddor3 = (m: number) => {
  const i = DDOR.indexOf(m);
  return i > 1 ? DDOR[i - 2] : m;
};
// FLYD stays strict lydian — a merged lydian+mixo pool makes the
// index-minus-2 math land on seconds, not thirds (F5 harmonized by Eb5
// is a semitone rub on the tonic). The two borrowed mixo tones the lead
// actually plays get their thirds by hand.
const FLYD = [65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
const FMIXO3: Record<number, number> = { 82: 79, 87: 84 }; // Bb→G, Eb→C
const flyd3 = (m: number) => {
  const i = FLYD.indexOf(m);
  if (i > 1) return FLYD[i - 2];
  return FMIXO3[m] ?? m;
};

// Volcano A: the riff — staccato E5 hits that keep pulling on F5 (the
// phrygian b2), then a two-bar climb that crests on D6 and falls home.
const volcanoLeadA = [
  76, 76, 0, 77, 0, 76, 0, 74, // E E . F . E . D — the grind
  76, 76, 0, 79, 0, 77, 0, 74, //           G    F    D
  76, 76, 0, 77, 0, 76, 0, 74, // restate
  71, 0, 72, 74, 0, 76, 0, 0, // B C-D . E — the climb starts
  79, 0, 81, 83, 0, 84, 0, 86, // G A-B . C6 . D6 — the crest
  86, 84, 0, 83, 81, 0, 79, 0, // fall off the peak
  83, 0, 81, 0, 79, 0, 77, 0, // B A G F — pulled back to b2
  76, 0, 74, 0, 76, 0, 0, 0, // land on E, breathe
];

// Volcano B: octave stabs over the power-chord root walk — E E C D |
// E F G — then a cadence stepping down F→E into the loop crash.
const volcanoLeadB = [
  88, 0, 86, 84, 0, 86, 88, 0, // E6 stabs over the E chug
  83, 0, 84, 86, 0, 88, 0, 0,
  88, 0, 86, 0, 84, 0, 79, 0, // over C
  86, 0, 81, 0, 77, 0, 81, 0, // over D — chord tones
  88, 0, 86, 0, 84, 0, 83, 0, // back on E
  77, 0, 81, 0, 84, 0, 81, 0, // over F — the bII power hit
  86, 0, 84, 0, 83, 0, 81, 0, // over G
  83, 0, 79, 77, 76, 0, 0, 0, // B G F-E — cadence into the crash
];

// Volcano A': the second eruption — the riff answers a beat late, then
// climbs past the first peak to E6. New contour, same kit, >15s rule.
const volcanoAltA = [
  0, 0, 74, 0, 76, 0, 77, 0, // let the band hit, answer low
  0, 0, 79, 0, 77, 0, 76, 0,
  0, 0, 74, 0, 76, 0, 77, 0,
  76, 0, 77, 79, 0, 81, 0, 0, // E F G A climb
  83, 0, 84, 86, 0, 88, 0, 0, // crests higher than A — E6
  88, 86, 0, 84, 83, 0, 81, 0,
  79, 0, 81, 0, 83, 0, 84, 0,
  83, 0, 81, 79, 77, 0, 0, 0,
];

const volcanoAltB = [
  84, 0, 86, 88, 0, 86, 84, 0, // inverted peak figure
  81, 0, 83, 84, 0, 86, 0, 0,
  79, 0, 84, 0, 88, 0, 84, 0, // over C — G C6 E6 C6
  81, 0, 77, 0, 86, 0, 81, 0, // over D
  88, 0, 86, 0, 84, 0, 86, 0,
  84, 0, 81, 0, 77, 0, 81, 0, // over F
  83, 0, 86, 0, 84, 0, 83, 0, // over G
  81, 0, 79, 77, 76, 0, 0, 0, // A G F E — home
];

const volcanoLeadAll = [...volcanoLeadA, ...volcanoLeadB];
const volcanoAltAll = [...volcanoAltA, ...volcanoAltB];

// Power-chord stabs — one hit on the loop downbeat, then one per B bar
// tracking the root walk. The accent is rhythm guitar, not brass.
const volcanoStabs: number[][] = (() => {
  const rows = Array.from({ length: 128 }, () => [] as number[]);
  const hits: Record<number, number[]> = {
    0: [64, 71, 76],
    64: [64, 71, 76], 72: [64, 71, 76],
    80: [60, 67, 72], 88: [62, 69, 74],
    96: [64, 71, 76], 104: [65, 72, 77],
    112: [67, 74, 79], 120: [64, 71, 76],
  };
  for (const [i, c] of Object.entries(hits)) rows[+i] = c;
  return rows;
})();

// Trainer march, C major — extracted as named data so family tints can
// transpose it wholesale (trainer_forge below) instead of re-authoring.
const trainerLead = [
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
];
const trainerHarm = [ // hand-voiced thirds — C major, not the E-minor pool
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
];
const trainerArp = [
  // C C F G | C Am Dm G | then C F C G twice under the stabs
  ...rep([60, 64, 67, 72], 4), ...rep([65, 69, 72, 77], 2), ...rep([67, 71, 74, 79], 2),
  ...rep([60, 64, 67, 72], 2), ...rep([57, 60, 64, 69], 2), ...rep([62, 65, 69, 74], 2), ...rep([67, 71, 74, 79], 2),
  ...rep([60, 64, 67, 72], 2), ...rep([65, 69, 72, 77], 2), ...rep([60, 64, 67, 72], 2), ...rep([67, 71, 74, 79], 2),
  ...rep([60, 64, 67, 72], 2), ...rep([65, 69, 72, 77], 2), ...rep([60, 64, 67, 72], 2), ...rep([67, 71, 74, 79], 2),
];
const trainerBass = [
  ...rep([36, 48], 8), ...rep([41, 53], 4), ...rep([43, 55], 4),
  ...rep([36, 48], 4), ...rep([33, 45], 4), ...rep([38, 50], 4), ...rep([43, 55], 4),
  ...rep([36, 48], 4), ...rep([41, 53], 4), ...rep([36, 48], 4), ...rep([43, 55], 4),
  ...rep([36, 48], 4), ...rep([41, 53], 4), ...rep([36, 48], 4), ...rep([43, 55], 4),
];

// Grove A: the hook — up the C triad, bounces off A5 twice, then a
// restate that reaches C6 and winks the lydian F# on the way down.
const groveLead = [
  72, 0, 74, 76, 0, 79, 0, 76, // C D-E . G . E
  81, 0, 79, 0, 76, 0, 74, 0, // A5 peak, tumble down
  72, 0, 74, 76, 0, 79, 0, 81, // restate, reach higher
  84, 0, 81, 0, 79, 0, 78, 0, // C6 — then F#5, the lydian wink
  // B: answers a third up over Am, cadences early so the fill breathes
  76, 0, 79, 0, 84, 0, 83, 0, // E . G . C6 . B5
  81, 0, 79, 0, 76, 0, 74, 0, // A5 falls home
  79, 0, 81, 0, 84, 0, 83, 0, // climb back over G
  84, 0, 81, 79, 76, 0, 0, 0, // cadence early — fill + bass walk stitch
];
// Grove A': bird-call answers from the canopy — sparse up top, then a
// long fall off D6 and a G-A pickup into the loop crash.
const groveAlt = [
  0, 0, 0, 0, 84, 0, 83, 0, // C6 B5 — the canopy answers
  0, 0, 81, 0, 84, 0, 0, 0,
  0, 0, 0, 0, 86, 0, 84, 0, // D6 this time — higher perch
  0, 0, 81, 0, 79, 0, 0, 0,
  0, 0, 0, 0, 84, 0, 83, 0, // B': the call again over Am
  0, 0, 81, 0, 84, 0, 0, 0,
  86, 0, 84, 0, 81, 0, 79, 0, // long fall off the peak
  76, 0, 79, 0, 81, 0, 0, 0, // G-A pickup into the loop
];

// Cavern: one drip motif, three-note droplets thrown into the dark and
// answered by the delay line. Rests are the texture — the cave does
// half the talking. Low D-dorian, everything within 60–72.
const cavernLead = [
  62, 0, 0, 64, 0, 0, 60, 0, // D...F...C — the drip, answered by echo
  0, 0, 0, 0, 0, 0, 0, 0,
  65, 0, 0, 67, 0, 0, 64, 0, // up a third — same drop, deeper water
  0, 0, 0, 0, 0, 0, 0, 0,
  62, 0, 0, 64, 0, 0, 69, 0, // B: calls again, ends on A — open
  0, 0, 0, 67, 0, 0, 65, 0,
  71, 0, 0, 69, 0, 0, 67, 0, // the high drip — B A G
  0, 0, 62, 0, 0, 0, 0, 0, // one low answer, then nothing
];
// Cavern A': the cave answers the drips — every call comes a step
// late, like the echo learned the song.
const cavernAlt = [
  0, 0, 62, 0, 0, 64, 0, 0, // the drip a step late — echo answers
  0, 60, 0, 0, 0, 0, 0, 0,
  0, 0, 65, 0, 0, 67, 0, 0,
  0, 64, 0, 0, 0, 0, 0, 0,
  0, 0, 62, 0, 0, 64, 0, 0, // B': same game over the new bass
  0, 69, 0, 0, 0, 0, 0, 0,
  0, 0, 71, 0, 0, 69, 0, 0,
  0, 67, 0, 0, 0, 0, 0, 0,
];

// Sky: a soaring F-lydian line — leap to E6, then ride the air down.
// B naturals keep it lydian; the alt slips an Eb6 in for the mixo
// read. High tessitura on purpose — it lives above the other tracks.
const skyLead = [
  77, 0, 81, 84, 0, 88, 0, 86, // F5 . A5 C6 . E6 . D6 — the leap
  84, 0, 81, 0, 83, 0, 81, 0, // ride the wind down, B5 lydian hang
  77, 0, 81, 84, 0, 86, 0, 88, // restate, peak on the bar line
  88, 0, 86, 0, 84, 0, 83, 0, // the glide home
  81, 0, 84, 0, 86, 0, 88, 0, // B: climb to E6 again
  88, 0, 86, 0, 84, 0, 81, 0, // fall back through the clouds
  83, 0, 84, 0, 86, 0, 83, 0, // hover on B — the lydian 4th over G
  84, 0, 81, 77, 81, 0, 0, 0, // cadence — last steps open for the loop
];
const skyAlt = [
  // A': the updraft answers — same contour a breath late, one Eb6
  // for the mixo read, then a stairway back to the loop.
  0, 0, 0, 0, 88, 0, 86, 0,
  0, 0, 84, 0, 83, 0, 0, 0,
  0, 0, 0, 0, 88, 0, 87, 0, // E6 Eb6 — the dark feather
  0, 0, 86, 0, 84, 0, 0, 0,
  0, 0, 0, 0, 86, 0, 84, 0, // B': lower thermals
  0, 0, 83, 0, 84, 0, 0, 0,
  86, 0, 84, 0, 83, 0, 84, 0, // stairway down
  81, 0, 83, 0, 84, 0, 0, 0,
];

// Menu pair (MUSIC.md 'Later'): the title loop's calmer sisters for the
// non-combat screens. Same triangle whistle and home-key C, but sparse,
// slow, and lydian-colored — the F# / D-major II bar is the tell. harm
// reuses the CLYD pool like grove does.
const draftLead = [
  76, 0, 0, 0, 79, 0, 0, 0, // E5 G5 — the title's first two notes, calmer
  78, 0, 0, 0, 81, 0, 0, 0, // F#5 A5 — the lydian wink
  79, 0, 0, 0, 76, 0, 0, 0, // G5 E5 — settle
  74, 0, 0, 0, 72, 0, 0, 0, // D5 C5 — home
];
const draftAlt = [ // A': reaches up to C6, then drifts back down the scale
  76, 0, 0, 0, 79, 0, 0, 0,
  81, 0, 0, 0, 84, 0, 0, 0,
  83, 0, 0, 0, 81, 0, 0, 0, // B5 A5 — the maj7 hangs warm over C
  79, 0, 0, 0, 74, 0, 0, 0,
];
const rewardLead = [ // a touch brighter — the run the win fanfare would take at rest
  72, 0, 76, 0, 79, 0, 84, 0, // C5 E5 G5 C6 — a soft fanfare shape
  81, 0, 79, 0, 76, 0, 74, 0, // tumble down over G
  76, 0, 0, 0, 81, 0, 79, 0, // E5, then A5 G5 over Am
  78, 0, 81, 0, 83, 0, 0, 0, // F#5 A5 B5 over D — climbs into the loop
];
const rewardAlt = [ // A': the run inverted, cresting on D6 before letting go
  76, 0, 79, 0, 81, 0, 84, 0,
  83, 0, 81, 0, 79, 0, 76, 0,
  79, 0, 0, 0, 84, 0, 81, 0,
  86, 0, 84, 0, 81, 0, 0, 0,
];

// Partial: TrackName lists every planned song, but unwritten names have
// no data yet — the selector falls back to 'battle' before music() ever
// sees them, and restart() refuses to arm a missing track.
export const TRACKS: Partial<Record<TrackName, Track>> = {
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
    snare: '.'.repeat(64), // no snare in the menu theme — rests, not a short string
    hat: '..h...h.'.repeat(8),
    loop: true,
  },
  draft_theme: {
    // title palette for the pick screen — same triangle whistle, slower,
    // C-lydian (the D-major II bar + F# in the line are the tell).
    // Staggered arp tones ring ~2.6s and blur into a soft pad; the kit is
    // a half-time heartbeat and one hat tick per bar, snare stays home.
    bpm: 92,
    leadWave: 'triangle',
    vib: 2,
    leadGate: 1.6, // notes ring past the beat — soft, not chiptune-tight
    arpGate: 8, // chord tones sustain — a pad, not plucks (the map trick)
    swing: 0.05,
    echo: 0.28,
    lead: draftLead,
    harm: draftLead.map((n) => (n ? clyd3(n) : 0)),
    alt: draftAlt,
    altHarm: draftAlt.map((n) => (n ? clyd3(n) : 0)),
    arp: [
      60, 0, 0, 64, 0, 0, 67, 0, // C
      62, 0, 0, 66, 0, 0, 69, 0, // D — the lydian II
      60, 0, 0, 64, 0, 0, 67, 0, // C home
      55, 0, 0, 59, 0, 0, 62, 0, // G — falls open
    ],
    bass: [
      36, 0, 0, 0, 0, 0, 0, 0, // C2 pedal
      38, 0, 0, 0, 0, 0, 0, 0, // D2 — the lydian II root
      36, 0, 0, 0, 0, 0, 0, 0, // home
      43, 0, 0, 0, 45, 0, 47, 0, // G, then A-B walks the loop back to C
    ],
    kick: 'k.......' + '........' + 'k.......' + '........', // half-time heartbeat
    snare: '.'.repeat(32),
    hat: '....h...'.repeat(4), // one tick on beat 3, nothing more
    loop: true,
  },
  reward_theme: {
    // the result-screen sister — same calm, a touch brighter and faster.
    // C G Am D, so the last bar's D-major II cadences the loop back to C.
    bpm: 100,
    leadWave: 'triangle',
    vib: 2,
    leadGate: 1.4,
    arpGate: 7,
    swing: 0.04,
    echo: 0.24,
    lead: rewardLead,
    harm: rewardLead.map((n) => (n ? clyd3(n) : 0)),
    alt: rewardAlt,
    altHarm: rewardAlt.map((n) => (n ? clyd3(n) : 0)),
    arp: [
      60, 0, 64, 0, 67, 0, 72, 0, // C
      55, 0, 59, 0, 62, 0, 67, 0, // G
      57, 0, 60, 0, 64, 0, 69, 0, // Am
      62, 0, 66, 0, 69, 0, 74, 0, // D — the lydian II cadence back home
    ],
    bass: [
      36, 0, 0, 0, 48, 0, 0, 0, // C, octave lift on beat 3
      43, 0, 0, 0, 50, 0, 0, 0, // G w/ fifth
      45, 0, 0, 0, 52, 0, 0, 0, // A w/ fifth
      38, 0, 0, 0, 42, 0, 45, 47, // D, then F#-A-B stairs up to the loop's C
    ],
    kick: 'k.......' + '........' + 'k.......' + '........', // half-time
    snare: '.'.repeat(32),
    hat: '..h...h.'.repeat(4), // the title's own pattern — the family tell
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
  battle_grove: {
    // S3 pastoral bounce — C lydian (F# is the tell), triangle lead over
    // a root-5th bouncing bass, swung just enough to skip not march.
    // No guitar: the grove fights clean. A/A' rotation, chromatic bass
    // walk + kick/snare pickup into the loop crash.
    bpm: 140,
    lead: groveLead,
    harm: groveLead.map((n) => (n ? clyd3(n) : 0)),
    alt: groveAlt,
    altHarm: groveAlt.map((n) => (n ? clyd3(n) : 0)),
    bass: [
      // root-5-octave bounce — the pastoral oom-pah without the pah
      ...rep([48, 0, 55, 0, 60, 0, 55, 0], 1),
      ...rep([45, 0, 52, 0, 57, 0, 52, 0], 1),
      ...rep([50, 0, 57, 0, 62, 0, 57, 0], 1),
      ...rep([43, 0, 50, 0, 55, 0, 50, 0], 1),
      ...rep([48, 0, 55, 0, 60, 0, 55, 0], 1),
      ...rep([45, 0, 52, 0, 57, 0, 52, 0], 1),
      ...rep([50, 0, 57, 0, 62, 0, 57, 0], 1),
      43, 0, 50, 0, 55, 0, 47, 48, // G, then B-C walks into the crash
    ],
    leadWave: 'triangle',
    swing: 0.08,
    leadGate: 0.8, // staccato bounce — notes hop, they don't flow
    vib: 1,
    echo: 0.12,
    kick: 'k...k.k.'.repeat(7) + 'k.....kk', // last beat pushes into the loop
    snare: '..s...s.'.repeat(7) + '....s..s', // fill answers the kick pickup
    hat: ('chhhhhhh' + 'hhhhhhhh'.repeat(3)).repeat(2), // crash per half
    loop: true,
  },
  battle_volcano: {
    // metal to battle's J-rock — E phrygian over a double-kick chug.
    // Distorted saw riff grinding the b2 (F), slap-flagged bass read as
    // picked palm-mute 8ths, power-chord stabs on the B-section walk.
    bpm: 170,
    lead: volcanoLeadAll,
    harm: volcanoLeadAll.map((n) => (n ? phr3(n) : 0)),
    alt: volcanoAltAll,
    altHarm: volcanoAltAll.map((n) => (n ? phr3(n) : 0)),
    leadWave: 'sawtooth',
    guitar: true,
    slap: true,
    bassGate: 0.45, // palm-muted — tighter than battle's pop
    vib: 3,
    echo: 0.1,
    stab: volcanoStabs,
    bass: [
      // E pedal chug — the root refuses to move. It breathes only to
      // walk: B C D under the lead climb, an F→E b2 grind, and a
      // chromatic run into each section seam.
      ...rep([40], 8), ...rep([40], 8), ...rep([40], 8),
      47, 0, 48, 0, 50, 0, 40, 40,
      ...rep([40], 8), ...rep([40], 8),
      41, 41, 41, 41, 40, 40, 40, 40,
      40, 40, 40, 40, 44, 45, 46, 47,
      // B: the root walk — E E C D | E F G, then a chromatic climb that
      // lands D#→E right on the loop crash
      ...rep([40], 8), ...rep([40], 8),
      ...rep([36], 8), ...rep([38], 8),
      ...rep([40], 8), ...rep([41], 8),
      ...rep([43], 8),
      40, 40, 40, 40, 36, 37, 38, 39,
    ],
    kick: 'k.kkk.kk'.repeat(7) + 'kkkkkkkk' // A: the gallop, last bar rolls
      + 'kkkkkkkk'.repeat(8), // B: straight double-bass, no mercy
    snare: '..s...s.'.repeat(7) + '..s.sss.'
      + '..s...s.'.repeat(7) + '.ssssss.', // fills roll into the crashes
    hat: ('chhhhhhh' + 'hhhhhhhh'.repeat(7)).repeat(2), // crash per section head
    loop: true,
  },
  battle_cavern: {
    // S4 drips in a cave — low D-dorian sine, most of the grid is rest.
    // The 0.3 echo IS the arrangement: three-note droplets bounce off
    // the walls long after the oscillator stops. alt answers every
    // call a step late, like the cave learned the song.
    bpm: 120,
    leadWave: 'sine',
    bassWave: 'sine',
    leadGate: 0.7,
    bassGate: 0.9,
    echo: 0.3,
    vib: 0.6,
    lead: cavernLead,
    harm: cavernLead.map((n) => (n ? ddor3(n) : 0)),
    alt: cavernAlt,
    altHarm: cavernAlt.map((n) => (n ? ddor3(n) : 0)),
    bass: [
      // stalactite roots — one note per bar on the low D pedal, a G
      // and C for color, and a soft A-Bb-C walk that pulls the loop shut
      38, 0, 0, 0, 0, 0, 0, 0,
      38, 0, 0, 0, 0, 0, 0, 0,
      41, 0, 0, 0, 0, 0, 0, 0, // F
      38, 0, 0, 0, 0, 0, 0, 0,
      38, 0, 0, 0, 0, 0, 0, 0,
      36, 0, 0, 0, 0, 0, 0, 0, // C
      43, 0, 0, 0, 0, 0, 0, 0, // G
      45, 0, 0, 0, 46, 0, 48, 0, // A .. Bb C — the walk into the crash
    ],
    kick: ('k.......' + '........').repeat(3) + '........' + 'k.....k.',
      // one heartbeat per two bars; two thumps at the end push into the loop
    snare: '........'.repeat(7) + '.....ss.', // the only fill in the song —
      // two ticks walk you back to step 0
    hat: 'c...h...' + '....h.h.'.repeat(7), // irregular ticks — falling water
    loop: true,
  },
  battle_sky: {
    // S5 air — high F-lydian triangle over a wide arp that sweeps the
    // clouds two octaves up and down. The kit is all hat and snare
    // with a light kick; weight is the one thing up here you don't need.
    bpm: 150,
    leadWave: 'triangle',
    bassWave: 'triangle',
    vib: 2,
    echo: 0.13,
    bassGate: 0.8,
    lead: skyLead,
    harm: skyLead.map((n) => (n ? flyd3(n) : 0)),
    alt: skyAlt,
    altHarm: skyAlt.map((n) => (n ? flyd3(n) : 0)),
    arp: [
      // two-octave sweeps — up the chord and straight back down
      65, 69, 72, 77, 81, 84, 77, 72,
      65, 69, 72, 77, 81, 84, 77, 72,
      67, 71, 74, 79, 83, 86, 79, 74, // G — the lydian II
      65, 69, 72, 77, 81, 84, 77, 72,
      65, 69, 72, 77, 81, 84, 77, 72,
      60, 64, 67, 72, 76, 79, 72, 67, // C
      67, 71, 74, 79, 83, 86, 79, 74, // G again
      60, 64, 67, 72, 76, 79, 72, 67, // C — lands the F on the crash
    ],
    bass: [
      // light pedal-F, off the gas — one fifth-hop per bar
      41, 0, 0, 0, 48, 0, 0, 0,
      41, 0, 0, 0, 48, 0, 0, 0,
      43, 0, 0, 0, 50, 0, 0, 0, // G
      41, 0, 0, 0, 48, 0, 0, 0,
      41, 0, 0, 0, 48, 0, 0, 0,
      36, 0, 0, 0, 43, 0, 0, 0, // C
      43, 0, 0, 0, 50, 0, 0, 0, // G
      36, 0, 43, 0, 45, 46, 47, 48, // C, chromatic walk lands F on the crash
    ],
    kick: '..k.k...'.repeat(7) + '....k.k.', // featherweight, two taps a bar
    snare: '....s...'.repeat(7) + '..ssss.s', // brushes on 3, fill at the seam
    hat: 'chhhhhhh' + 'hhhhhhhh'.repeat(7), // steady 8ths — the wind section
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
    kick: '.'.repeat(64), // no drums in the ambient map theme — rests, not a short string
    snare: '.'.repeat(64),
    hat: '.'.repeat(64),
    loop: true,
  },
  trainer: {
    // trainer battle — bright C-major march, brassy square stabs, the
    // heroic key change real Pokémon trainer themes live in
    bpm: 144,
    leadWave: 'square',
    swing: 0.04,
    echo: 0.14,
    lead: trainerLead,
    harm: trainerHarm,
    arp: trainerArp,
    bass: trainerBass,
    kick: 'k...k.k.'.repeat(15) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(15) + '..s..ss.',
    hat: 'hhhhhhhh'.repeat(8) + 'h.h.h.h.'.repeat(8),
    loop: true,
  },
  trainer_forge: {
    // S6 the lazy way — the march data transposed +4 into E major and
    // re-voiced hot: saw lead instead of square, faster, drier. Same
    // shape as 'trainer', so every typed trainer still reads as a
    // trainer, just fire/electric/fighting-flavored.
    bpm: 152,
    lead: trainerLead.map((n) => (n ? n + 4 : 0)),
    harm: trainerHarm.map((n) => (n ? n + 4 : 0)),
    arp: trainerArp.map((n) => (n ? n + 4 : 0)),
    bass: trainerBass.map((n) => (n ? n + 4 : 0)),
    leadWave: 'sawtooth',
    bassWave: 'sawtooth',
    swing: 0.02,
    vib: 3,
    echo: 0.11,
    kick: 'k...k.k.'.repeat(15) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(15) + '..s..ss.',
    hat: 'hhhhhhhh'.repeat(8) + 'h.h.h.h.'.repeat(8),
    loop: true,
  },
  trainer_shade: {
    // ghost/poison/psychic — the march dragged down a minor third, slowed
    // to a procession, warbling through more echo. Sinister, not heroic.
    bpm: 132,
    lead: trainerLead.map((n) => (n ? n - 3 : 0)),
    harm: trainerHarm.map((n) => (n ? n - 3 : 0)),
    arp: trainerArp.map((n) => (n ? n - 3 : 0)),
    bass: trainerBass.map((n) => (n ? n - 3 : 0)),
    leadWave: 'triangle',
    swing: 0.06,
    vib: 4,
    echo: 0.22,
    kick: 'k...k.k.'.repeat(15) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(15) + '..s..ss.',
    hat: 'hhhhhhhh'.repeat(8) + 'h.h.h.h.'.repeat(8),
    loop: true,
  },
  trainer_earth: {
    // rock/normal/grass — the march lifted a fifth into G major, square
    // lead kept, slap bass for bedrock weight. Bold and grounded.
    bpm: 140,
    lead: trainerLead.map((n) => (n ? n + 7 : 0)),
    harm: trainerHarm.map((n) => (n ? n + 7 : 0)),
    arp: trainerArp.map((n) => (n ? n + 7 : 0)),
    bass: trainerBass.map((n) => (n ? n + 7 : 0)),
    slap: true,
    swing: 0.05,
    vib: 1,
    echo: 0.12,
    kick: 'k...k.k.'.repeat(15) + 'k.k.k.k.',
    snare: '..s...s.'.repeat(15) + '..s..ss.',
    hat: 'hhhhhhhh'.repeat(8) + 'h.h.h.h.'.repeat(8),
    loop: true,
  },
  trainer_gale: {
    // flying/water — the march pushed a full octave up: same tune, thin
    // air. Swing stays loose, echo opens up, vibrato keeps it floating.
    bpm: 148,
    lead: trainerLead.map((n) => (n ? n + 12 : 0)),
    harm: trainerHarm.map((n) => (n ? n + 12 : 0)),
    arp: trainerArp.map((n) => (n ? n + 12 : 0)),
    bass: trainerBass.map((n) => (n ? n + 12 : 0)),
    swing: 0.08,
    vib: 3,
    echo: 0.2,
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

// biome → wild-battle song. The selector (battle.ts) does
// `BIOME_TRACK[theme] ?? 'battle'` — all four biomes are written now,
// but the fallback stays for anything new.
export const BIOME_TRACK: Record<string, TrackName> = {
  grove: 'battle_grove',
  cavern: 'battle_cavern',
  volcano: 'battle_volcano',
  sky: 'battle_sky',
};

// trainer type → song. One march, four tints — each family transposes
// and re-voices the same data (forge +4 saw, shade −3 triangle, earth
// +7 slap, gale +12 airy). The march stays the march; the element
// changes the weather.
export const TRAINER_TRACK: Record<string, TrackName> = {
  fire: 'trainer_forge',
  electric: 'trainer_forge',
  fighting: 'trainer_forge',
  ghost: 'trainer_shade',
  poison: 'trainer_shade',
  psychic: 'trainer_shade',
  rock: 'trainer_earth',
  normal: 'trainer_earth',
  grass: 'trainer_earth',
  flying: 'trainer_gale',
  water: 'trainer_gale',
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
  const tr = TRACKS[curTrack];
  if (!tr) {
    curTrack = null; // valid name, no song written yet — stay silent
    return;
  }
  if (mWet) mWet.gain.value = tr.echo ?? 0.18; // per-track space
  nextT = ac.currentTime + 0.08;
  pumpTimer = setInterval(pump, 40);
}

function pump() {
  if (!ac || !curTrack || ac.state !== 'running') return;
  if (nextT < ac.currentTime - 0.25) nextT = ac.currentTime + 0.05; // tab was suspended
  const armed = TRACKS[curTrack];
  if (!armed) return; // unwritten name — restart() already refused to arm it
  let tr = armed;
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
      tr = TRACKS[curTrack]!; // a looping track can't unwrite itself
    }
  }
}

// --- weather bed (MUSIC.md 'Later'): one looping filtered-noise layer ---
// Hung on mGain — pre-lowpass, same as the voices — so the music slider
// and master mute govern it; it never touches the sfx path. Rain is a
// gentle hiss; hail retunes the same layer brighter and a touch louder,
// the patter reading harder. null fades the bed out over ~0.4s.
export type BedKind = 'rain' | 'hail' | 'sand' | 'wind';
const BED_TUNE: Record<BedKind, { freq: number; gain: number }> = {
  rain: { freq: 1200, gain: 0.05 },
  hail: { freq: 4200, gain: 0.06 },
  // the game's weather enum is sand/sun/wind — sand grinds low, wind whistles
  sand: { freq: 800, gain: 0.06 },
  wind: { freq: 2600, gain: 0.04 },
};
let bedNodes: { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; kind: BedKind } | null = null;
let bedWant: BedKind | null = null; // desired state — a pre-unlock call arms lazily like curTrack

export function weatherBed(kind: BedKind | null) {
  bedWant = kind;
  if (!ac || !mGain || bedNodes?.kind === kind) return;
  const t0 = ac.currentTime;
  if (bedNodes) { // old layer out — 0.4s fade, then stop() frees the node
    bedNodes.g.gain.cancelScheduledValues(t0);
    bedNodes.g.gain.setValueAtTime(bedNodes.g.gain.value, t0);
    bedNodes.g.gain.linearRampToValueAtTime(0, t0 + 0.4);
    bedNodes.src.stop(t0 + 0.45);
    bedNodes = null;
  }
  if (!kind) return;
  const p = BED_TUNE[kind];
  const src = ac.createBufferSource();
  src.buffer = noiseBuf();
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = p.freq;
  f.Q.value = 0.7;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(p.gain, t0 + 0.6); // swells in under the song
  src.connect(f).connect(g).connect(mGain);
  src.start(t0, Math.random());
  bedNodes = { src, f, g, kind };
}

// Mobile haptics; silently absent where unsupported (iOS Safari).
export function buzz(pattern: number | number[]) {
  if (!settings().haptics) return;
  navigator.vibrate?.(pattern);
}

