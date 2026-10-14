// Tiny synthesized SFX — no audio assets, just WebAudio oscillators/noise.
// Browsers require a user gesture first, so call unlock() from pointerdown.

let ac: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
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
  | 'zap' | 'boom' | 'splash' | 'heal' | 'ui' | 'wave' | 'lose';

export function sfx(name: Sfx, pitch = 1) {
  switch (name) {
    case 'launch':
      noise(0.18, 900, 0.25, 0, -600);
      tone(500, 180, 0.15, 'sawtooth', 0.12);
      break;
    case 'perfect':
      [660, 880, 1320].forEach((f, i) => tone(f, f, 0.12, 'square', 0.09, i * 0.05));
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
  }
}

// Mobile haptics; silently absent where unsupported (iOS Safari).
export function buzz(pattern: number | number[]) {
  navigator.vibrate?.(pattern);
}

// Real species cries (PokeAPI/cries .ogg), cached and replayable.
const cries = new Map<number, HTMLAudioElement>();
export function cry(id: number, vol = 0.2) {
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
