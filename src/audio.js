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

// Tone with frequency sweep (pitch slide for richer feel)
function sweep(freqStart, freqEnd, duration, type = 'sine', vol = 0.16) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    const now = c.currentTime;
    o.frequency.setValueAtTime(freqStart, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    o.connect(g);
    g.connect(masterGain);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.005);
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
    // Crisp two-note ascending stab — feels like a "ding!"
    tone(987.77, 0.06, 'sine', 0.22);
    setTimeout(() => tone(1318.51, 0.13, 'sine', 0.18), 22);
    setTimeout(() => tone(1975.53, 0.08, 'sine', 0.08), 40);
  },
  good: () => {
    tone(659.25, 0.09, 'sine', 0.16);
    setTimeout(() => tone(783.99, 0.06, 'sine', 0.10), 35);
  },
  miss: () => {
    sweep(220, 90, 0.32, 'sawtooth', 0.18);
    noise(0.16, 0.08, 300);
  },
  slice: () => {
    // Satisfying "thunk" + bell
    tone(440, 0.08, 'sine', 0.20);
    setTimeout(() => tone(659.25, 0.12, 'sine', 0.16), 28);
    setTimeout(() => tone(880, 0.16, 'sine', 0.12), 60);
  },
  golden: () => {
    // Triumphant ascending arpeggio
    [523.25, 659.25, 783.99, 987.77, 1318.51].forEach((f, i) =>
      setTimeout(() => tone(f, 0.22, 'sine', 0.20 - i * 0.015), i * 55)
    );
    // Sparkle sheen
    setTimeout(() => sweep(2000, 4000, 0.4, 'sine', 0.07), 100);
  },
  multUp: (tier) => {
    // Rising chord — gets more intense per tier
    const roots = [440, 523.25, 659.25, 880];
    const root = roots[Math.min(3, Math.max(0, tier - 1))];
    tone(root, 0.1, 'triangle', 0.18);
    setTimeout(() => tone(root * 1.25, 0.12, 'triangle', 0.16), 50);
    setTimeout(() => tone(root * 1.5, 0.15, 'triangle', 0.14), 100);
    if (tier >= 3) setTimeout(() => tone(root * 2, 0.18, 'triangle', 0.12), 150);
  },
  espresso: () => {
    // Coffee machine vibe — short bursts
    tone(380, 0.06, 'sawtooth', 0.10);
    setTimeout(() => sweep(600, 1200, 0.18, 'sine', 0.14), 30);
    setTimeout(() => tone(1500, 0.06, 'sine', 0.10), 100);
  },
  phase: () => {
    // Cinematic phase-up swell
    [392, 523.25, 659.25, 783.99, 987.77].forEach((f, i) =>
      setTimeout(() => tone(f, 0.24, 'sine', 0.18 - i * 0.02), i * 70)
    );
    setTimeout(() => sweep(200, 800, 0.5, 'triangle', 0.10), 40);
  },
  tap: () => tone(1400, 0.025, 'sine', 0.05),
  record: () => {
    // Triumphant fanfare for record breaking
    [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51].forEach((f, i) =>
      setTimeout(() => tone(f, 0.32, 'sine', 0.22 - i * 0.02), i * 45)
    );
    // Bass support
    setTimeout(() => tone(130.81, 0.6, 'triangle', 0.12), 0);
    setTimeout(() => tone(196, 0.6, 'triangle', 0.12), 100);
  },
  // Memory mode ingredient highlight (different from tap)
  memShow: (idx) => {
    const freqs = [659.25, 783.99, 987.77];
    tone(freqs[idx % 3], 0.18, 'sine', 0.22);
  },
};

export function unlockAudio() {
  try {
    const c = getCtx();
    // iOS-friendly: schedule a near-silent priming tone so the audio
    // session is firmly bound to this user gesture
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 440;
    o.connect(g);
    g.connect(masterGain);
    const now = c.currentTime;
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    o.start(now);
    o.stop(now + 0.06);
    // Also try to resume in case it returned suspended
    if (c.state === 'suspended') {
      const p = c.resume();
      if (p && p.then) p.then(() => {}).catch(() => {});
    }
  } catch (e) {}
}
