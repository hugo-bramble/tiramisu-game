import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { sfx, unlockAudio } from './audio';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RECIPE = ['lady', 'cream', 'lady', 'cream', 'cocoa'];
const NAMES = { lady: 'Savoiardi', cream: 'Mascarpone', cocoa: 'Cacao' };
const ICONS = { lady: '🍪', cream: '🥛', cocoa: '🍫' };
const POINTS = { perfect: 40, good: 18, bad: 0 };
const GOAL_CM = 30000;

const PHASES = [
  { name: 'Apprentice', threshold: 0,     speed: 0.6,  green: 36, sub: 'Wide green zone, slow meter — get the timing' },
  { name: 'Pasticcere', threshold: 800,   speed: 1.0,  green: 27, sub: 'The meter speeds up. Stay sharp.' },
  { name: 'Maestro',    threshold: 3000,  speed: 1.4,  green: 20, sub: 'Faster, tighter — perfetti now matter more' },
  { name: 'Virtuoso',   threshold: 9000,  speed: 1.85, green: 15, sub: 'Punishing pace. Save your espresso!' },
  { name: 'Leggenda',   threshold: 20000, speed: 2.4,  green: 11, sub: 'Mastery only. Chelsea holds its breath.' },
];

const MILESTONES = [
  { m: 30,  text: 'Trenta!',       sub: 'The Sloane Square queue notices', garnish: '🍒' },
  { m: 80,  text: 'Ottanta!',      sub: "King's Road traffic is stopped",  garnish: '🍓' },
  { m: 150, text: '150 metri!',    sub: 'Saatchi Gallery wants to display it', garnish: '🍫', heart: true },
  { m: 220, text: 'Duecentoventi!', sub: 'Peter Jones runs out of mascarpone' },
  { m: 275, text: 'RECORD BROKEN!', sub: 'Stamford Bridge cheers from across town!', heart: true, pause: true, emoji: '🏆', label: 'WORLD RECORD' },
  { m: 300, text: '300 metri!',    sub: 'Chelsea pensioners weep with pride!', heart: true, pause: true, emoji: '👑', label: 'GOAL REACHED' },
  { m: 400, text: 'Quattrocento!', sub: 'Cadogan Estate offers you a flat (£8m)' },
];

const JOKES = {
  bad: [
    'Sloppy! Cadogan disapproves',
    'Madonna mia, what a mess',
    'Ma che fai?! Disastro!',
    "Even Pret's tiramisu beat that",
    'The pensioners gasp in horror',
    'Peter Jones returns it',
    "Worse than King's Road traffic",
  ],
  slice: [
    'Una fetta perfetta!',
    'Slice complete, darling',
    'Sloane mums approve',
    'The Bluebird applauds',
    "Fit for the King's Road",
    'Buonissimo, old bean',
    'Cadogan estate impressed',
    'Posher than Granger & Co',
  ],
  golden: [
    '🌟 Vogue Italia approves!',
    '🌟 La Stampa front page!',
    '🌟 Saatchi takes a photo!',
    '🌟 Eataly wants the recipe!',
    '🌟 King Charles applauds!',
  ],
  multUp: {
    2: ['×2 — On a roll!', '×2 multiplier!'],
    3: ['×3 — Magnifico!', '×3 — Sloane Square impressed'],
    5: ['×5 — Bellissimo combo!', '×5 — Saatchi takes notes'],
    8: ['×8 LEGGENDARIO!', '×8 — Vogue is calling!'],
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (cm) => (cm / 100).toFixed(cm < 1000 ? 2 : 1);

function multTier(combo) {
  if (combo >= 12) return { mult: 8, tier: 4, label: '×8' };
  if (combo >= 8)  return { mult: 5, tier: 3, label: '×5' };
  if (combo >= 5)  return { mult: 3, tier: 3, label: '×3' };
  if (combo >= 2)  return { mult: 2, tier: 2, label: '×2' };
  return { mult: 1, tier: 1, label: '×1' };
}

function getPhase(length) {
  for (let i = PHASES.length - 1; i >= 0; i--) if (length >= PHASES[i].threshold) return { idx: i, ...PHASES[i] };
  return { idx: 0, ...PHASES[0] };
}

function getBest() {
  try { return parseInt(localStorage.getItem('tiramisu_best') || '0', 10); } catch (e) { return 0; }
}
function saveBest(cm) {
  try {
    const prev = getBest();
    if (cm > prev) { localStorage.setItem('tiramisu_best', String(Math.floor(cm))); return true; }
  } catch (e) {}
  return false;
}

// ─── CONFETTI HELPERS ────────────────────────────────────────────────────────
function fireConfetti(intensity = 1) {
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
  const count = 60 * intensity;
  const colors = ['#c97b1a', '#f4c771', '#10b981', '#ef4444', '#fffaeb', '#4a2818'];
  function shoot(angle, originX) {
    confetti({ ...defaults, particleCount: count / 3, angle, spread: 70, origin: { x: originX, y: 0.7 }, colors });
  }
  shoot(60, 0.2);
  shoot(120, 0.8);
  setTimeout(() => shoot(90, 0.5), 150);
}

function fireBigConfetti() {
  const colors = ['#c97b1a', '#f4c771', '#10b981', '#ef4444', '#fffaeb', '#fbbf24', '#009246', '#ce2b37'];
  const duration = 2400;
  const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors, zIndex: 100 });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors, zIndex: 100 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('welcome'); // welcome | game | gameover
  const [hintsOn, setHintsOn] = useState(false);
  const [endStats, setEndStats] = useState(null);

  const start = (showHints) => {
    unlockAudio();
    setHintsOn(showHints);
    setScreen('game');
  };
  const end = (stats) => { setEndStats(stats); setScreen('gameover'); };
  const restart = () => setScreen('game');
  const back = () => setScreen('welcome');

  return (
    <div className="fixed inset-0 bg-bg overflow-hidden">
      <FlagStripe />
      {screen === 'welcome' && <Welcome onStart={start} />}
      {screen === 'game' && <Game key={endStats?.runId || 'g0'} hintsOn={hintsOn} onEnd={end} />}
      {screen === 'gameover' && <GameOver stats={endStats} onRestart={restart} onHome={back} />}
    </div>
  );
}

function FlagStripe() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[3px] flex z-[5] pointer-events-none flag-stripe">
      <span /><span /><span />
    </div>
  );
}

// ─── WELCOME ─────────────────────────────────────────────────────────────────
function Welcome({ onStart }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-[rgba(31,17,8,0.45)] backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="bg-surface border border-[rgba(74,40,24,0.1)] rounded-[26px] p-8 pb-5 text-center max-w-sm w-full shadow-large"
      >
        <div className="text-5xl mb-1">🍰</div>
        <h2 className="text-3xl font-extrabold text-ink tracking-tight mb-1">Chelsea Tiramisu</h2>
        <div className="text-[11px] text-gold font-bold tracking-widest uppercase mb-4">Chelsea Town Hall · Live</div>
        <p className="text-[14px] text-ink leading-relaxed mb-5 px-1">
          You're at <b className="text-gold font-bold">Chelsea Town Hall</b>. Build a <b className="text-gold font-bold">300m tiramisu</b> and break the 275m world record.
        </p>
        <ul className="text-left mb-5 space-y-3">
          <HowItem icon="👆">One button. <b className="text-gold">Tap when the marker hits green</b> for perfetto.</HowItem>
          <HowItem icon="🔥">Stack perfetti to build a <b className="text-gold">×8 multiplier</b>. One miss resets it.</HowItem>
          <HowItem icon="📈">Five phases get harder fast: <b className="text-gold">Apprentice → Leggenda</b>.</HowItem>
        </ul>
        <button onClick={() => onStart(true)} className="block w-full py-[14px] rounded-[14px] text-sm font-bold uppercase tracking-wider mb-2 bg-cocoa text-mascarpone active:scale-[0.97] transition-transform">
          Show me how
        </button>
        <button onClick={() => onStart(false)} className="block w-full py-[10px] rounded-[14px] text-xs font-semibold tracking-wide bg-transparent text-ink2 border border-[rgba(74,40,24,0.18)] active:scale-[0.97] transition-transform">
          Skip — let's go
        </button>
      </motion.div>
    </motion.div>
  );
}

function HowItem({ icon, children }) {
  return (
    <li className="text-[13px] text-ink flex gap-3 leading-snug">
      <span className="text-[22px] w-[30px] flex-none text-center leading-tight">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

// ─── GAME ────────────────────────────────────────────────────────────────────
function Game({ hintsOn, onEnd }) {
  // Reactive state (rerender)
  const [length, setLength] = useState(0);
  const [lives, setLives] = useState(3);
  const [layerIdx, setLayerIdx] = useState(0);
  const [sliceLayers, setSliceLayers] = useState([]);
  const [trough, setTrough] = useState([]);
  const [combo, setCombo] = useState(0);
  const [espresso, setEspresso] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [paused, setPaused] = useState(null); // null or { emoji, label, title, sub }
  const [toast, setToast] = useState(null); // { text, kind, id }
  const [smallMilestone, setSmallMilestone] = useState(null);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const [hintStage, setHintStage] = useState(hintsOn ? 0 : -1);
  const [garnishes, setGarnishes] = useState([]);
  const [milestonesShown] = useState(() => new Set());
  const [builderAnim, setBuilderAnim] = useState(null); // 'complete' | 'golden' | null
  const [mode, setMode] = useState('timing'); // 'timing' | 'memory' | 'order'
  const [memoryRoundCount, setMemoryRoundCount] = useState(0);
  const [orderRoundCount, setOrderRoundCount] = useState(0);

  // Non-rendered refs
  const markerRef = useRef({ pos: 0, dir: 1 });
  const markerEl = useRef(null);
  const espressoActiveRef = useRef(0);
  const runningRef = useRef(true);
  const lengthRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const layerIdxRef = useRef(0);
  const sliceLayersRef = useRef([]);
  const phaseIdxRef = useRef(0);
  const pausedRef = useRef(false);
  const hintStageRef = useRef(hintsOn ? 0 : -1);
  const sliceIdRef = useRef(0);
  const modeRef = useRef('timing');
  const sliceCountRef = useRef(0);
  const eventCounterRef = useRef(0); // alternates memory ↔ order

  // Keep refs in sync
  useEffect(() => { lengthRef.current = length; }, [length]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { layerIdxRef.current = layerIdx; }, [layerIdx]);
  useEffect(() => { sliceLayersRef.current = sliceLayers; }, [sliceLayers]);
  useEffect(() => { phaseIdxRef.current = phaseIdx; }, [phaseIdx]);
  useEffect(() => { pausedRef.current = paused != null; }, [paused]);
  useEffect(() => { hintStageRef.current = hintStage; }, [hintStage]);

  // Sync mode to ref
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Marker animation loop
  useEffect(() => {
    let raf;
    const loop = () => {
      if (runningRef.current && !pausedRef.current && modeRef.current === 'timing') {
        const phase = PHASES[phaseIdxRef.current];
        let speed = phase.speed;
        if (espressoActiveRef.current > 0) speed *= 0.4;
        if (hintStageRef.current === 0) speed *= 0.55; // slow during initial hint
        markerRef.current.pos += markerRef.current.dir * speed;
        if (markerRef.current.pos >= 100) { markerRef.current.pos = 100; markerRef.current.dir = -1; }
        if (markerRef.current.pos <= 0)   { markerRef.current.pos = 0;   markerRef.current.dir = 1; }
        if (markerEl.current) markerEl.current.style.left = markerRef.current.pos + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Toast helper
  const toastIdRef = useRef(0);
  const showToast = useCallback((text, kind, dur = 2400) => {
    const id = ++toastIdRef.current;
    setToast({ text, kind, id });
    setTimeout(() => setToast(t => (t && t.id === id) ? null : t), dur);
  }, []);

  const pauseFor = useCallback((info) => {
    setPaused(info);
  }, []);

  const computeQuality = useCallback(() => {
    const phase = PHASES[phaseIdxRef.current];
    const g = phase.green;
    const y = (100 - g) * 0.35;
    const r = (100 - g - 2 * y) / 2;
    const p = markerRef.current.pos;
    const greenStart = r + y, greenEnd = greenStart + g;
    const goodStart = r, goodEnd = 100 - r;
    if (p >= greenStart && p <= greenEnd) return 'perfect';
    if (p >= goodStart && p <= goodEnd) return 'good';
    return 'bad';
  }, []);

  const handleTap = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return;
    sfx.tap();
    const quality = computeQuality();
    const type = RECIPE[layerIdxRef.current];

    const prevTier = multTier(comboRef.current).tier;
    let newCombo = comboRef.current;
    if (quality === 'perfect') newCombo += 1;
    else if (quality === 'bad') newCombo = 0;
    const m = multTier(newCombo);

    const pts = POINTS[quality] * m.mult;
    const newLength = lengthRef.current + pts;

    // Update slice
    const newSliceLayers = [...sliceLayersRef.current, { type, quality }];

    // SFX & feedback
    if (quality === 'bad') {
      sfx.miss();
      setShake(s => s + 1);
      setFlash(f => f + 1);
      showToast(pick(JOKES.bad) + ' −1 ♥', 'red', 2500);
      const newLives = livesRef.current - 1;
      setLives(newLives);
      if (newLives <= 0) {
        runningRef.current = false;
        setTimeout(() => onEnd({ length: newLength, runId: Date.now() }), 700);
        // fall through to apply state below
      }
    } else if (quality === 'perfect') {
      sfx.perfect();
      // Multiplier tier-up celebration
      if (m.tier > prevTier && JOKES.multUp[m.mult]) {
        sfx.multUp(m.tier);
        showToast(pick(JOKES.multUp[m.mult]), 'green', 2400);
      }
      // Espresso earned at every 5 consecutive perfetti
      if (newCombo > 0 && newCombo % 5 === 0) {
        sfx.espresso();
        setEspresso(e => e + 1);
        showToast('☕ Espresso earned!', 'gold', 2400);
      }
    } else {
      sfx.good();
    }

    setCombo(newCombo);
    setLength(newLength);
    setSliceLayers(newSliceLayers);

    // Espresso decrement
    if (espressoActiveRef.current > 0) espressoActiveRef.current -= 1;

    // Check phase transition
    const newPhase = getPhase(newLength);
    if (newPhase.idx !== phaseIdxRef.current) {
      setPhaseIdx(newPhase.idx);
      sfx.phase();
      pauseFor({ emoji: '⚡', label: 'PHASE ' + (newPhase.idx + 1), title: newPhase.name, sub: newPhase.sub });
    }

    // Check milestones
    const meters = newLength / 100;
    for (const ms of MILESTONES) {
      if (meters >= ms.m && !milestonesShown.has(ms.m)) {
        milestonesShown.add(ms.m);
        if (ms.heart) setLives(l => Math.min(3, l + 1));
        if (ms.garnish) setGarnishes(g => [...g, ms.garnish]);
        if (ms.pause) {
          if (ms.m === 275) sfx.record(); else sfx.golden();
          fireBigConfetti();
          pauseFor({ emoji: ms.emoji, label: ms.label, title: ms.text, sub: ms.sub });
        } else {
          const msId = Date.now() + Math.random();
          setSmallMilestone({ text: ms.text, sub: ms.sub, id: msId });
          fireConfetti(0.6);
          setTimeout(() => setSmallMilestone(m2 => (m2 && m2.id === msId) ? null : m2), 2400);
        }
      }
    }

    // Slice complete
    const newLayerIdx = layerIdxRef.current + 1;
    if (newLayerIdx >= 5) {
      // Finalize slice
      const allPerfect = newSliceLayers.every(l => l.quality === 'perfect');
      let bonus = 0;
      let finalLen = newLength;
      if (allPerfect) {
        const baseSliceCm = newSliceLayers.reduce((s, l) => s + POINTS[l.quality] * m.mult, 0);
        bonus = Math.round(baseSliceCm * 0.5);
        finalLen = newLength + bonus;
        setLength(finalLen);
        sfx.golden();
        fireConfetti(1);
        showToast(pick(JOKES.golden) + ` +${bonus}cm`, 'goldenslice', 3000);
        setBuilderAnim('golden');
      } else {
        sfx.slice();
        showToast('🍰 ' + pick(JOKES.slice), 'green', 2200);
        setBuilderAnim('complete');
      }
      // Push slice to trough
      setTrough(t => {
        const sliceObj = {
          id: ++sliceIdRef.current,
          golden: allPerfect,
          garnish: allPerfect ? '🌟' : (garnishes.length > 0 && Math.random() < 0.5 ? pick(garnishes) : null),
        };
        return [...t, sliceObj];
      });
      // Reset slice
      setTimeout(() => {
        setSliceLayers([]);
        setLayerIdx(0);
        setBuilderAnim(null);
      }, 700);
    } else {
      setLayerIdx(newLayerIdx);
    }

    // Hints advance
    if (hintStageRef.current >= 0) {
      const ns = hintStageRef.current + 1;
      setHintStage(ns >= 3 ? -1 : ns);
    }
  }, [showToast, computeQuality, garnishes, onEnd, milestonesShown, pauseFor]);

  const useEspresso = useCallback(() => {
    if (espresso <= 0 || pausedRef.current) return;
    sfx.espresso();
    setEspresso(e => e - 1);
    espressoActiveRef.current = 4;
    showToast('☕ Meter slowed for 4 layers', 'gold', 2200);
  }, [espresso, showToast]);

  const handleResume = useCallback(() => setPaused(null), []);

  const phase = PHASES[phaseIdx];
  const m = multTier(combo);
  const recordPct = Math.min(100, (length / GOAL_CM) * 100);
  const meters = length / 100;
  const progressLabel = meters < 275 ? 'Goal 300m' : meters < 300 ? '🏆 Record broken!' : '🏆 300m smashed!';

  return (
    <motion.div
      animate={{ x: [0, -8, 8, -5, 5, 0] }}
      transition={{ duration: shake > 0 ? 0.4 : 0 }}
      key={'shake-' + shake}
      className="absolute inset-0 flex flex-col"
    >
      {/* Header */}
      <header className="pt-[18px] pb-[12px] px-[18px] grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[rgba(74,40,24,0.1)]">
        <div className="text-[14px] font-bold text-ink tracking-tight">🍰 Chelsea Tiramisu</div>
        <div className="flex justify-center"><MultiplierBadge tier={m.tier} label={m.label} /></div>
        <div className="flex flex-col items-end gap-[3px]">
          <div className="flex items-baseline gap-[4px]">
            <motion.span
              key={'len-' + Math.floor(length)}
              initial={{ scale: 1.18, color: '#c97b1a' }}
              animate={{ scale: 1, color: '#1f1108' }}
              transition={{ duration: 0.25 }}
              className="text-[22px] font-extrabold tracking-tight tabular-nums leading-none"
            >
              {fmt(length)}
            </motion.span>
            <span className="text-[11px] text-ink2 font-semibold">m</span>
          </div>
          <Hearts count={lives} />
        </div>
      </header>

      {/* Stage */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#fff8e7_0%,#fdf6e8_80%)]">
        {/* Flash on miss */}
        <AnimatePresence>
          {flash > 0 && <motion.div key={'fl-' + flash} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} className="flash-red" />}
        </AnimatePresence>

        {/* Progress */}
        <div className="absolute top-4 left-4 right-4 z-[6]">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold mb-2">
            <span className="text-ink3">0m</span>
            <span className={meters >= 275 ? 'text-gold' : 'text-ink2'}>{progressLabel}</span>
            <span className="text-ink3">300m</span>
          </div>
          <div className="h-[5px] bg-[rgba(74,40,24,0.08)] rounded-[3px] overflow-hidden relative">
            <motion.div
              animate={{ width: recordPct + '%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-goldsoft to-gold rounded-[3px]"
            />
            <div className="absolute -top-[3px] -bottom-[3px] left-[91.66%] w-[2px] bg-ink rounded opacity-40">
              <span className="absolute -top-[16px] left-1/2 -translate-x-1/2 text-[9px] text-ink2 font-bold tracking-tight">275m</span>
            </div>
          </div>
        </div>

        {/* Phase label */}
        <div className="absolute top-[60px] left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[2.2px] font-bold text-ink3 z-[6]">
          Phase {phaseIdx + 1} <span className="text-gold ml-1">{phase.name}</span>
        </div>

        {/* Toast — wrapper handles centering, motion handles animation */}
        <div className="absolute top-[92px] left-0 right-0 flex justify-center pointer-events-none z-20 px-4">
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={
                  'px-[22px] py-[12px] rounded-full font-extrabold text-[15px] shadow-large whitespace-nowrap max-w-full overflow-hidden text-ellipsis text-center ' +
                  (toast.kind === 'red' ? 'bg-errorred text-white'
                  : toast.kind === 'green' ? 'bg-successgreen text-white'
                  : toast.kind === 'gold' ? 'bg-gold text-white'
                  : toast.kind === 'goldenslice' ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-white text-[16px] px-[26px] py-[13px] shadow-[0_8px_24px_rgba(251,191,36,0.55)]'
                  : 'bg-ink text-bg')
                }
              >
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Small milestone banner */}
        <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none gap-2 px-6">
          <AnimatePresence>
            {smallMilestone && (
              <motion.div
                key={smallMilestone.id}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="text-[38px] font-black text-gold tracking-tight" style={{ textShadow: '0 4px 16px rgba(201,123,26,0.4)' }}>
                  {smallMilestone.text}
                </div>
                <div className="text-[14px] font-semibold text-ink">
                  {smallMilestone.sub}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Plank + Trough */}
        <div className="absolute bottom-[244px] left-0 right-0 h-[5px] plank z-[2]" />
        <div className="absolute bottom-[249px] left-0 right-0 h-[78px] overflow-hidden z-[3] pointer-events-none">
          <Trough trough={trough} />
        </div>

        {/* Builder */}
        <div className="absolute bottom-[252px] left-1/2 -translate-x-1/2 z-[4] flex flex-col items-center pointer-events-none">
          <Builder layers={sliceLayers} anim={builderAnim} />
          <div className="w-[70px] h-[5px] mt-[-1px] plank rounded-sm" />
        </div>

        {/* Recipe dots */}
        <div className="absolute bottom-[200px] left-0 right-0 z-[6] flex justify-center gap-[9px]">
          {Array.from({ length: 5 }).map((_, i) => {
            const done = i < layerIdx;
            const current = i === layerIdx;
            const layerInfo = sliceLayers[i];
            const isPerfect = layerInfo?.quality === 'perfect';
            return (
              <motion.div
                key={i}
                animate={{
                  scale: current ? 1.5 : 1,
                  background: done && isPerfect ? '#10b981' : done ? '#c97b1a' : current ? '#c97b1a' : 'rgba(74,40,24,0.15)',
                  boxShadow: current ? '0 0 0 4px rgba(201,123,26,0.2)' : '0 0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                className="w-2 h-2 rounded-full"
              />
            );
          })}
        </div>

        {/* Meter */}
        <div className="absolute bottom-[152px] left-4 right-4 z-[6]">
          <div className="h-[40px] bg-surface border border-[rgba(74,40,24,0.1)] rounded-[20px] overflow-hidden relative shadow-soft">
            <Meter green={phase.green} />
            <div ref={markerEl} className="absolute top-[5px] bottom-[5px] w-[4px] bg-ink rounded shadow-[0_0_10px_rgba(31,17,8,0.5)]" />
          </div>
        </div>

        {/* Hint */}
        {hintStage >= 0 && <HintLayer stage={hintStage} />}

        {/* Espresso */}
        <AnimatePresence>
          {espresso > 0 && <EspressoButton count={espresso} onUse={useEspresso} />}
        </AnimatePresence>

        {/* Tap button */}
        <div className="absolute bottom-0 left-0 right-0 h-[130px] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[14px] flex z-[7] bg-gradient-to-t from-bg from-[65%] to-transparent">
          <TapButton type={RECIPE[layerIdx]} onTap={handleTap} pulse={hintStage >= 0} />
        </div>
      </div>

      {/* Pause modal */}
      <AnimatePresence>
        {paused && <PauseModal info={paused} onResume={handleResume} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function Hearts({ count }) {
  return (
    <div className="flex gap-[2px] text-[13px] tracking-[1px]">
      {[0,1,2].map(i => (
        <motion.span
          key={i}
          animate={i >= count ? { scale: 1, color: '#b8a48a' } : { scale: 1, color: '#ef4444' }}
          className={i >= count ? 'text-ink3' : 'text-errorred'}
        >
          {i < count ? '♥' : '♡'}
        </motion.span>
      ))}
    </div>
  );
}

function MultiplierBadge({ tier, label }) {
  const styles = {
    1: 'bg-surface2 text-ink2',
    2: 'bg-goldsoft text-cocoa',
    3: 'bg-gold text-white shadow-[0_4px_14px_rgba(201,123,26,0.35)]',
    4: 'bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white shadow-[0_4px_18px_rgba(239,68,68,0.45)]',
  };
  return (
    <motion.div
      key={'mult-' + label}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 0.4 }}
      className={`text-[16px] font-extrabold px-[14px] py-[6px] rounded-full tracking-tight tabular-nums ${styles[tier]}`}
    >
      {label}
    </motion.div>
  );
}

function Trough({ trough }) {
  // Auto-scroll: keep latest slice in view by translating left
  const offset = Math.max(0, trough.length * 27 - 100);
  return (
    <motion.div
      animate={{ x: -offset }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="absolute bottom-0 left-0 h-[78px] flex items-end pl-[50%]"
    >
      <AnimatePresence initial={false}>
        {trough.map(s => (
          <motion.div
            key={s.id}
            initial={{ y: -30, scale: 0.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 18 }}
            className={'w-[26px] h-[64px] flex-shrink-0 relative flex flex-col justify-end mr-[1px] ' + (s.golden ? 'drop-shadow-[0_2px_6px_rgba(251,191,36,0.6)]' : 'drop-shadow-[0_2px_4px_rgba(74,40,24,0.15)]')}
          >
            <div className="layer-cocoa slice-cocoa w-full" />
            <div className="layer-cream slice-cream w-full" />
            <div className="layer-lady slice-lady w-full" />
            <div className="layer-cream slice-cream w-full" />
            <div className="layer-lady slice-lady w-full" />
            {s.garnish && <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 text-[11px] leading-none">{s.garnish}</div>}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function Builder({ layers, anim }) {
  return (
    <motion.div
      animate={
        anim === 'golden' ? { scale: [1, 1.18, 1], filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'] }
        : anim === 'complete' ? { scale: [1, 1.12, 1] }
        : { scale: 1 }
      }
      transition={{ duration: anim === 'golden' ? 0.7 : anim === 'complete' ? 0.45 : 0.2 }}
      className="w-[60px] h-[76px] flex flex-col justify-end drop-shadow-[0_4px_8px_rgba(74,40,24,0.2)]"
    >
      <AnimatePresence initial={false}>
        {[...layers].reverse().map((l, i) => (
          <motion.div
            key={layers.length - 1 - i + '-' + l.type + '-' + i}
            initial={{ y: -50, scale: 0.6, opacity: 0 }}
            animate={{
              y: 0,
              scale: 1,
              opacity: l.quality === 'bad' ? 0.35 : 1,
              filter: l.quality === 'bad' ? 'grayscale(0.7)' : 'grayscale(0)',
              boxShadow: l.quality === 'perfect' ? ['0 0 0 rgba(201,123,26,0)', '0 0 22px 4px rgba(201,123,26,0.85)', '0 0 0 rgba(201,123,26,0)'] : '0 0 0 rgba(0,0,0,0)',
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, boxShadow: { duration: 0.7 } }}
            className={`w-full layer-${l.type} build-${l.type} relative`}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function Meter({ green }) {
  const y = (100 - green) * 0.35;
  const r = (100 - green - 2 * y) / 2;
  const widths = [r, y, green, y, r];
  const classes = ['zone-bad', 'zone-good', 'zone-perfect', 'zone-good', 'zone-bad'];
  return (
    <div className="absolute inset-0 flex">
      {widths.map((w, i) => (
        <motion.div
          key={i}
          animate={{ width: w + '%' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={'h-full ' + classes[i]}
        />
      ))}
    </div>
  );
}

function TapButton({ type, onTap, pulse }) {
  const cls = type === 'lady' ? 'btn-lady' : type === 'cream' ? 'btn-cream' : 'btn-cocoa';
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onTouchStart={(e) => { e.preventDefault(); onTap(); }}
      onClick={(e) => { if (!('ontouchstart' in window)) onTap(); }}
      className={`flex-1 rounded-[22px] flex items-center justify-center gap-[14px] px-5 ${cls} shadow-[0_8px_22px_rgba(74,40,24,0.18)] ${pulse ? 'tap-pulse' : ''}`}
    >
      <span className="text-[38px] leading-none">{ICONS[type]}</span>
      <div className="flex flex-col items-start">
        <span className="text-[18px] font-extrabold tracking-tight leading-tight">{NAMES[type]}</span>
        <span className="text-[11px] font-semibold opacity-70 tracking-wide mt-[2px]">Tap on green</span>
      </div>
    </motion.button>
  );
}

function EspressoButton({ count, onUse }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: [0, -3, 0] }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, scale: { type: 'spring', stiffness: 400, damping: 18 } }}
      whileTap={{ scale: 0.92 }}
      onTouchStart={(e) => { e.preventDefault(); onUse(); }}
      onClick={(e) => { if (!('ontouchstart' in window)) onUse(); }}
      className="absolute bottom-[152px] right-4 w-[46px] h-[46px] rounded-full bg-cocoa border-2 border-gold flex items-center justify-center text-[20px] z-[9]"
      style={{ boxShadow: '0 6px 18px rgba(201,123,26,0.4), 0 0 0 4px rgba(201,123,26,0.15)' }}
    >
      ☕
      <span className="absolute -top-[5px] -right-[5px] bg-errorred text-white text-[11px] font-extrabold rounded-full w-[18px] h-[18px] flex items-center justify-center border-2 border-bg">
        {count}
      </span>
    </motion.button>
  );
}

function HintLayer({ stage }) {
  return (
    <>
      <div className="absolute bottom-[200px] left-4 right-4 z-[23] flex items-center justify-center pointer-events-none">
        <div className="bg-successgreen text-white px-4 py-[7px] rounded-full text-[13px] font-extrabold tracking-tight" style={{ boxShadow: '0 6px 18px rgba(16,185,129,0.45)' }}>
          {stage === 0 ? 'Tap when GREEN ✨' : 'Tap when GREEN ✨'}
        </div>
      </div>
      <div className="absolute bottom-[168px] left-1/2 z-[23] flex flex-col items-center gap-[6px] pointer-events-none hint-bounce" style={{ transform: 'translateX(-50%)' }}>
        <div className="text-[38px] leading-none drop-shadow-[0_4px_8px_rgba(201,123,26,0.5)]">👇</div>
        <div className="bg-gold text-white px-4 py-[7px] rounded-full text-[13px] font-extrabold tracking-tight whitespace-nowrap" style={{ boxShadow: '0 6px 18px rgba(201,123,26,0.5)' }}>
          {stage === 0 ? 'TAP HERE' : 'TAP ON GREEN'}
        </div>
      </div>
    </>
  );
}

function PauseModal({ info, onResume }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] flex items-center justify-center p-5 bg-[rgba(31,17,8,0.45)] backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="bg-gradient-to-b from-[#fff8e7] to-[#fef3d9] border-2 border-gold rounded-[26px] p-8 pb-5 text-center max-w-sm w-full"
        style={{ boxShadow: '0 12px 40px rgba(74,40,24,0.18), 0 0 0 8px rgba(201,123,26,0.1)' }}
      >
        <div className="text-[64px] leading-none mb-[6px] pulse-emoji">{info.emoji}</div>
        <div className="text-[11px] text-gold font-extrabold tracking-[2px] uppercase mb-1">{info.label}</div>
        <h2 className="text-[32px] font-black text-ink mb-[6px] tracking-tight">{info.title}</h2>
        <p className="text-[14px] text-ink2 mb-[22px] leading-snug px-2 font-medium">{info.sub}</p>
        <button
          onClick={onResume}
          className="block w-full py-[14px] rounded-[14px] text-sm font-bold uppercase tracking-wider bg-cocoa text-mascarpone active:scale-[0.97] transition-transform"
        >
          Continua
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────
function GameOver({ stats, onRestart, onHome }) {
  const m = stats.length / 100;
  const isNew = saveBest(stats.length);
  const best = getBest();

  let title = 'Servizio finito', verdict = '', stars = 0;
  if (m < 30) { verdict = 'Even the Pret next door did better. Riprova!'; stars = 1; }
  else if (m < 100) { verdict = "Respectable, but King's Road is unimpressed."; stars = 2; }
  else if (m < 220) { verdict = 'Decent. A Sloane mum gives you a polite nod.'; stars = 3; }
  else if (m < 275) { verdict = "So close to 275m. La nonna è triste, caro."; stars = 3; }
  else if (m < 300) { title = 'Record broken!'; verdict = 'You beat 275m — but you promised Chelsea 300. Riprova!'; stars = 4; }
  else if (m < 400) { title = '🏆 300 metri!'; verdict = 'Chelsea Town Hall erupts. The Cadogan Estate names a mews after you.'; stars = 5; }
  else { title = '🏆 Leggenda!'; verdict = m.toFixed(0) + 'm — beyond legend. Even Stamford Bridge bows.'; stars = 5; }

  useEffect(() => {
    if (m >= 275) fireBigConfetti();
  }, [m]);

  const share = async () => {
    const text = `🍰 ${m.toFixed(2)}m tiramisu at Chelsea Town Hall! ${m >= 300 ? '🏆 SMASHED 300m!' : m >= 275 ? '🏆 BROKE THE 275m RECORD!' : `(${(m / 300 * 100).toFixed(0)}% of 300m)`} https://hugo-bramble.github.io/tiramisu-game/`;
    try {
      if (navigator.share) await navigator.share({ title: 'Chelsea Tiramisu', text });
      else await navigator.clipboard.writeText(text);
    } catch (e) {}
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 p-6 bg-[rgba(253,246,232,0.94)] backdrop-blur-xl"
    >
      <h2 className="text-[26px] font-extrabold text-ink tracking-tight text-center">{title}</h2>
      <div className="text-[10px] text-ink3 uppercase tracking-widest font-bold">Final length</div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="text-[64px] font-black text-gold tracking-tight leading-none tabular-nums"
      >
        {fmt(stats.length)}m
      </motion.div>
      <div className="text-[26px] tracking-[4px]">
        {'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </div>
      <div className="flex gap-3 items-center px-4 py-2 bg-surface2 rounded-full text-[12px] text-ink2 font-bold">
        Best: <b className="text-ink font-extrabold">{fmt(best)}m</b>
        {isNew && <span className="text-gold font-extrabold px-2 py-1 bg-[rgba(201,123,26,0.12)] rounded-full text-[11px] tracking-wide uppercase">New PB!</span>}
      </div>
      <p className="text-[14px] text-center text-ink2 leading-snug max-w-[320px] font-medium px-2">{verdict}</p>
      <button onClick={onRestart} className="px-9 py-[13px] rounded-[14px] text-sm font-bold bg-cocoa text-mascarpone active:scale-[0.97] transition-transform mt-2">
        Play again
      </button>
      <button onClick={share} className="px-6 py-[11px] rounded-[14px] text-[12px] font-semibold bg-transparent text-ink2 border border-[rgba(74,40,24,0.18)] active:scale-[0.97] transition-transform">
        Share score
      </button>
    </motion.div>
  );
}
