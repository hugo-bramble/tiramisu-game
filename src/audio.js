// Web Audio procedural SFX — no audio files, all synthesized in-browser.
let ctx = null;
let masterGain = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type = 'sine', vol = 0.18, attack = 0.005) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(masterGain);
    const now = c.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.start(now);
    o.stop(now + duration + 0.05);
  } catch (e) {}
}

function noise(duration, vol = 0.08, hpFreq = 200) {
  try {
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() - 0.5) * 2;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    const now = c.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.start(now);
  } catch (e) {}
}

function chord(freqs, duration, type = 'sine', vol = 0.12) {
  freqs.forEach((f, i) => setTimeout(() => tone(f, duration, type, vol), i * 18));
}

export const sfx = {
  perfect: () => {
    tone(880, 0.08, 'sine', 0.22);
    setTimeout(() => tone(1320, 0.14, 'sine', 0.16), 28);
  },
  good: () => tone(560, 0.1, 'sine', 0.14),
  miss: () => {
    tone(180, 0.28, 'sawtooth', 0.18, 0.002);
    noise(0.18, 0.08);
  },
  slice: () => {
    tone(620, 0.1, 'sine', 0.18);
    setTimeout(() => tone(880, 0.14, 'sine', 0.16), 35);
  },
  golden: () => {
    chord([523, 659, 784, 988, 1175], 0.22, 'sine', 0.18);
  },
  multUp: (tier) => {
    const root = [440, 587, 698, 880][Math.min(3, Math.max(0, tier - 1))];
    tone(root, 0.12, 'triangle', 0.2);
    setTimeout(() => tone(root * 1.5, 0.16, 'triangle', 0.16), 60);
  },
  espresso: () => {
    tone(380, 0.08, 'sine', 0.16);
    setTimeout(() => tone(580, 0.1, 'sine', 0.14), 50);
    setTimeout(() => tone(780, 0.12, 'sine', 0.12), 100);
  },
  phase: () => {
    chord([392, 523, 659, 784, 988], 0.2, 'sine', 0.18);
  },
  tap: () => tone(1400, 0.03, 'sine', 0.05),
  record: () => {
    chord([523, 659, 784, 988, 1175, 1318], 0.3, 'sine', 0.22);
  },
};

export function unlockAudio() {
  try { getCtx(); } catch (e) {}
}
