import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { sfx, unlockAudio } from './audio';
import { fetchGlobalLeaderboard, postScore, isGlobalLeaderboardConfigured } from './leaderboard';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RECIPE = ['lady', 'cream', 'lady', 'cream', 'cocoa'];
const NAMES = { lady: 'Savoiardi', cream: 'Mascarpone', cocoa: 'Cacao' };
const ICONS = { lady: '🍪', cream: '🥛', cocoa: '🍫' };
const POINTS = { perfect: 40, good: 18, bad: 0 };
const GOAL_CM = 30000;

const PHASES = [
  { name: 'Apprentice', threshold: 0,     speed: 0.6,  green: 36, time: '1pm', bg: 'phase-1', sub: '1pm · The crowd is small but eager. Show them what you can do.' },
  { name: 'Pasticcere', threshold: 800,   speed: 1.0,  green: 27, time: '2pm', bg: 'phase-2', sub: '2pm · The press arrive. Cameras flash on the King\'s Road.' },
  { name: 'Maestro',    threshold: 3000,  speed: 1.4,  green: 20, time: '3pm', bg: 'phase-3', sub: "3pm · Sloane Square is heaving. Traffic is at a standstill." },
  { name: 'Virtuoso',   threshold: 9000,  speed: 1.85, green: 15, time: '4pm', bg: 'phase-4', sub: '4pm · The Italian Embassy is on the line. Vogue Italia just arrived.' },
  { name: 'Leggenda',   threshold: 20000, speed: 2.4,  green: 11, time: '5pm', bg: 'phase-5', sub: '5pm · Golden hour. Silence. Only your hands move. The world watches.' },
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
    'Sloane mum tuts loudly',
    'A disaster, darling',
    "That's not Bluebird-tier",
    "The Saatchi wouldn't hang it",
    'Fulham would still take it',
    'Madonna santa, riprova!',
    'Imola laughs from afar',
    'Like a Sloane Square parking ticket',
    'Even M&S Food does better',
    'Roma is texting Imola already',
    "The Cadogan Estate looks the other way",
    'Vogue Italia is off the line',
    'Sloppy work — pensioners deserve better',
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
    'Squisito, chef!',
    'The Royal Hospital cheers',
    "Better than L'Eliseo's",
    'A slice for the ages',
    "World's End is buzzing",
    'Eataly approves',
    "The Daily Mail can't fault it",
    'Even the Italian Embassy calls',
    'Bramble worthy',
    'Royal-Hospital-Road-tier',
    'Not bad for SW3',
    'Sloane Rangers nod',
    "Joe & The Juice has nothing on this",
    'Tatler files a feature',
    'Even John Lewis is jealous',
  ],
  golden: [
    '🌟 Vogue Italia approves!',
    '🌟 La Stampa front page!',
    '🌟 Saatchi takes a photo!',
    '🌟 Eataly wants the recipe!',
    '🌟 King Charles applauds!',
    '🌟 La Repubblica calls!',
    "🌟 The Pope's blessing arrives",
    '🌟 Chelsea Pensioners salute',
    '🌟 The Mayor declares a holiday',
    '🌟 Stamford Bridge erupts',
    '🌟 Roma weeps with envy',
    '🌟 Italian schoolchildren applaud',
    '🌟 BBC1 cuts to live coverage',
    '🌟 The Daily Mail crowns a hero',
  ],
  multUp: {
    2: ['×2 — On a roll!', '×2 multiplier!', '×2 — Sloane Square notices', '×2 — Just warming up', '×2 — The chatter starts'],
    3: ['×3 — Magnifico!', '×3 — Cadogan applauds', '×3 — Saatchi takes notes', '×3 — Sky News on the line', '×3 — Tatler is interested'],
    5: ['×5 — Bellissimo combo!', '×5 — Vogue Italia is here', '×5 — Eataly wants in', "×5 — King's Rd is yours", '×5 — Cameras zoom'],
    8: ['×8 LEGGENDARIO!', '×8 — Vogue is calling!', '×8 — Roma is jealous', '×8 — The Pope is watching', '×8 — Italian PM tweets'],
  },
};

// Ambient story beats — sparse, sprinkled across the game arc
const STORY_BEATS = [
  { at: 1500,  text: '📺 Sky News: "Live from Chelsea Town Hall"' },
  { at: 5000,  text: '🎙️ BBC Radio 4: "Approaching the record…"' },
  { at: 12000, text: '📸 Vogue Italia: "Bellissimo, darling!"' },
  { at: 20000, text: '🐎 King\'s Road traffic stopped' },
  { at: 26000, text: '🇮🇹 Imola: "...this is humiliating"' },
];

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

// Local "leaderboard" — top 10 runs with name + score + date
function getUsername() { try { return localStorage.getItem('tiramisu_name') || ''; } catch (e) { return ''; } }
function setUsernameLocal(n) { try { localStorage.setItem('tiramisu_name', String(n).slice(0, 20)); } catch (e) {} }
function getTeam() { try { return localStorage.getItem('tiramisu_team') || ''; } catch (e) { return ''; } }
function setTeamLocal(t) { try { localStorage.setItem('tiramisu_team', t); } catch (e) {} }
function getLeaderboard() { try { return JSON.parse(localStorage.getItem('tiramisu_leaderboard') || '[]'); } catch (e) { return []; } }
function addToLeaderboard(name, cm, team) {
  try {
    const board = getLeaderboard();
    board.push({ name: (name || 'Anonymous').slice(0, 20), cm: Math.floor(cm), date: Date.now(), team: team || '' });
    board.sort((a, b) => b.cm - a.cm);
    localStorage.setItem('tiramisu_leaderboard', JSON.stringify(board.slice(0, 10)));
  } catch (e) {}
}

// ─── CONFETTI HELPERS ────────────────────────────────────────────────────────
// Tiramisu-themed confetti palette
const CONFETTI_COLORS = ['#c97b1a', '#f4c771', '#fbbf24', '#fffaeb', '#4a2818', '#deb887', '#e8c897'];
const CONFETTI_FLAG = ['#009246', '#ffffff', '#ce2b37', '#c97b1a', '#fbbf24'];

function fireConfetti(intensity = 1) {
  const count = 60 * intensity;
  function shoot(angle, originX) {
    confetti({
      particleCount: count / 3, angle, spread: 70,
      origin: { x: originX, y: 0.7 }, colors: CONFETTI_COLORS,
      startVelocity: 32, ticks: 70, zIndex: 100, scalar: 0.9,
    });
  }
  shoot(60, 0.2);
  shoot(120, 0.8);
  setTimeout(() => shoot(90, 0.5), 130);
}

function fireBigConfetti() {
  const duration = 2600;
  const end = Date.now() + duration;
  (function frame() {
    confetti({
      particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.85 },
      colors: CONFETTI_FLAG, startVelocity: 38, ticks: 80, zIndex: 100, scalar: 1.0,
    });
    confetti({
      particleCount: 5, angle: 120, spread: 70, origin: { x: 1, y: 0.85 },
      colors: CONFETTI_FLAG, startVelocity: 38, ticks: 80, zIndex: 100, scalar: 1.0,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  // Initial burst
  confetti({
    particleCount: 80, spread: 360, startVelocity: 22, ticks: 90,
    origin: { x: 0.5, y: 0.5 }, colors: [...CONFETTI_FLAG, ...CONFETTI_COLORS], zIndex: 100, scalar: 1.1,
  });
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
  const restart = () => {
    setHintsOn(false); // hints only on first run, not on replay
    setScreen('game');
  };
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
  // Step phases: 0..4 cinematic, 5 = profile, 6 = ready
  const seenIntro = (() => { try { return localStorage.getItem('tiramisu_seen_intro') === '1'; } catch (e) { return false; } })();
  const PROFILE_STEP = 5;
  const READY_STEP = 6;
  const [step, setStep] = useState(seenIntro ? PROFILE_STEP : 0);
  const personalBest = getBest();
  const [name, setName] = useState(() => getUsername());
  const [team, setTeamState] = useState(() => getTeam());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [globalBoard, setGlobalBoard] = useState(null);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const localBoard = getLeaderboard();

  // Fetch global on mount so we can preview top players inline
  useEffect(() => {
    if (isGlobalLeaderboardConfigured() && !globalBoard) {
      setLoadingGlobal(true);
      fetchGlobalLeaderboard(25).then(b => {
        setGlobalBoard(b || []);
        setLoadingGlobal(false);
      });
    }
  }, [globalBoard]);

  const isGlobal = isGlobalLeaderboardConfigured();
  const board = isGlobal && globalBoard ? globalBoard : localBoard;
  const next = () => {
    // Unlock audio on every welcome interaction so iOS context is firmly bound
    try { unlockAudio(); } catch (e) {}
    setStep(s => {
      const ns = s + 1;
      if (ns >= PROFILE_STEP) { try { localStorage.setItem('tiramisu_seen_intro', '1'); } catch (e) {} }
      return ns;
    });
  };

  // Cinematic intro scenes
  const SCENES = [
    {
      kind: 'setting',
      eyebrow: 'Chelsea · Sunday',
      title: 'This afternoon',
      body: "It's a Sunday in April. Cadogan Square is in full bloom. A crowd has gathered outside Chelsea Town Hall, sipping flat whites.",
    },
    {
      kind: 'setting',
      eyebrow: 'The Record',
      title: '275 metres',
      body: 'Set by Imola in 2019. The longest tiramisu ever assembled. Italians have held the record for thirty years.',
    },
    {
      kind: 'setting',
      eyebrow: 'Your Mission',
      title: '300 metres',
      body: 'Beat the Italians at their own game. Build a tiramisu longer than King\'s Road has ever seen. Cameras roll.',
    },
    {
      kind: 'cast',
      eyebrow: 'Meet your mentor',
      portrait: '👵',
      name: 'Nonna Maria',
      quote: '"I have been making tiramisu since 1952. Don\'t embarrass me, caro."',
      caption: 'Will judge you. Silently. Constantly.',
    },
    {
      kind: 'cast',
      eyebrow: 'Meet the locals',
      portraits: ['👜', '🎩', '🎨', '🐎', '🎖️'],
      name: 'Chelsea',
      quote: '"We\'ve seen better. We\'ve seen worse."',
      caption: "Sloane mums, Cadogan barons, Saatchi curators — they'll order. You'll deliver. Or won't.",
    },
  ];

  if (step < SCENES.length) {
    const s = SCENES[step];
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_50%_30%,#3a2a4e_0%,#1a1638_75%)] overflow-hidden cursor-pointer"
        onClick={next}
        onTouchStart={(e) => { e.preventDefault(); next(); }}
      >
        {/* Stars */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.55) 1px, transparent 2px),' +
            'radial-gradient(circle at 78% 12%, rgba(255,255,255,0.4) 1px, transparent 2px),' +
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.5) 0.8px, transparent 2px),' +
            'radial-gradient(circle at 92% 84%, rgba(255,255,255,0.35) 0.8px, transparent 2px),' +
            'radial-gradient(circle at 18% 64%, rgba(255,255,255,0.4) 0.8px, transparent 2px),' +
            'radial-gradient(circle at 58% 92%, rgba(255,255,255,0.5) 0.8px, transparent 2px),' +
            'radial-gradient(circle at 42% 38%, rgba(255,255,255,0.4) 0.8px, transparent 2px)',
        }} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-[380px] w-full text-center"
          >
            <div className="text-[11px] text-gold font-extrabold tracking-[3px] uppercase mb-4">{s.eyebrow}</div>

            {s.kind === 'setting' && (
              <>
                <motion.h1
                  initial={{ scale: 0.92 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.15 }}
                  className="text-white text-[56px] font-black tracking-tight mb-4 leading-none"
                  style={{ textShadow: '0 4px 24px rgba(201,123,26,0.35)' }}
                >
                  {s.title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-[15px] text-white/85 leading-relaxed font-medium italic max-w-[320px] mx-auto"
                >
                  {s.body}
                </motion.p>
              </>
            )}

            {s.kind === 'cast' && s.portrait && (
              <>
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0, y: [0, -6, 0] }}
                  transition={{ scale: { type: 'spring', stiffness: 250, damping: 14, delay: 0.1 }, y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
                  className="text-[120px] leading-none mb-3"
                >{s.portrait}</motion.div>
                <h1 className="text-white text-[36px] font-black tracking-tight mb-2 leading-tight">{s.name}</h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-[15px] text-white/85 italic font-medium max-w-[320px] mx-auto mb-3"
                >
                  {s.quote}
                </motion.p>
                <p className="text-[12px] text-gold/85 font-bold tracking-wide max-w-[300px] mx-auto">{s.caption}</p>
              </>
            )}

            {s.kind === 'cast' && s.portraits && (
              <>
                <motion.div className="flex justify-center gap-3 mb-4 flex-wrap">
                  {s.portraits.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 280, damping: 18 }}
                      className="text-[56px] leading-none"
                    >{p}</motion.div>
                  ))}
                </motion.div>
                <h1 className="text-white text-[36px] font-black tracking-tight mb-2 leading-tight">{s.name}</h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
                  className="text-[15px] text-white/85 italic font-medium max-w-[320px] mx-auto mb-3"
                >
                  {s.quote}
                </motion.p>
                <p className="text-[12px] text-gold/85 font-bold tracking-wide max-w-[320px] mx-auto">{s.caption}</p>
              </>
            )}

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.6 }}
              className="absolute left-0 right-0 -bottom-20 text-center"
            >
              <div className="text-[11px] uppercase tracking-[2px] text-white/50 font-bold">Tap to continue</div>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-white/60 text-[14px] mt-1"
              >▼</motion.div>
            </motion.div>

            {/* Step dots */}
            <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2">
              {SCENES.map((_, i) => (
                <div key={i} className={`h-[6px] rounded-full transition-all ${i === step ? 'w-6 bg-gold' : i < step ? 'w-[6px] bg-white/60' : 'w-[6px] bg-white/20'}`} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  }

  // Final card with rules + Begin
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-[radial-gradient(ellipse_at_50%_30%,#3a2a4e_0%,#1a1638_75%)] overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.5) 1px, transparent 2px),' +
          'radial-gradient(circle at 78% 12%, rgba(255,255,255,0.4) 1px, transparent 2px),' +
          'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45) 0.8px, transparent 2px),' +
          'radial-gradient(circle at 18% 64%, rgba(255,255,255,0.4) 0.8px, transparent 2px),' +
          'radial-gradient(circle at 58% 92%, rgba(255,255,255,0.4) 0.8px, transparent 2px)',
      }} />
      <motion.div
        key={step}
        initial={{ scale: 0.92, opacity: 0, x: 30 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        exit={{ scale: 0.92, opacity: 0, x: -30 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="relative bg-surface border border-[rgba(74,40,24,0.1)] rounded-[24px] px-5 py-6 text-center max-w-sm w-full shadow-large"
      >
        {/* Step pips */}
        <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5">
          {[PROFILE_STEP, READY_STEP].map(s => (
            <div key={s} className={`h-[5px] rounded-full transition-all ${step === s ? 'w-5 bg-gold' : step > s ? 'w-[5px] bg-gold/60' : 'w-[5px] bg-[rgba(74,40,24,0.15)]'}`} />
          ))}
        </div>

        {step === PROFILE_STEP && (
          <>
            <div className="text-[44px] mb-1 leading-none select-none mt-2">👋</div>
            <h2 className="text-[22px] font-black text-ink tracking-tight leading-tight mb-1">Who are you?</h2>
            <p className="text-[12px] text-ink2 mb-5 px-2">For the global leaderboard. Pick a side.</p>

            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setUsernameLocal(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && team) next(); }}
              placeholder="🏆  Your name"
              maxLength={20}
              autoFocus={!name}
              autoComplete="off"
              autoCapitalize="words"
              className="w-full px-3 py-3 mb-3 rounded-[12px] border-2 border-[rgba(74,40,24,0.15)] bg-surface2 text-[15px] text-ink font-bold text-center focus:outline-none focus:border-gold"
            />
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                onClick={() => { setTeamState('GB'); setTeamLocal('GB'); }}
                className={`py-3 px-2 rounded-[12px] flex flex-col items-center justify-center gap-0.5 text-[12px] font-bold transition-all ${team === 'GB' ? 'bg-cocoa text-mascarpone shadow-[0_4px_12px_rgba(74,40,24,0.3)]' : 'bg-surface2 text-ink2 border border-[rgba(74,40,24,0.12)]'}`}
              >
                <span className="text-[26px] leading-none">🇬🇧</span><span>British</span>
              </button>
              <button
                onClick={() => { setTeamState('IT'); setTeamLocal('IT'); }}
                className={`py-3 px-2 rounded-[12px] flex flex-col items-center justify-center gap-0.5 text-[12px] font-bold transition-all ${team === 'IT' ? 'bg-cocoa text-mascarpone shadow-[0_4px_12px_rgba(74,40,24,0.3)]' : 'bg-surface2 text-ink2 border border-[rgba(74,40,24,0.12)]'}`}
              >
                <span className="text-[26px] leading-none">🇮🇹</span><span>Italian</span>
              </button>
            </div>
            {team === 'GB' && <p className="text-[11px] text-ink3 mb-3 italic">"Brilliant attempt, old chap"</p>}
            {team === 'IT' && <p className="text-[11px] text-ink3 mb-3 italic">"Sangue italiano! Forza!"</p>}

            <button
              onClick={next}
              disabled={!team}
              className={`block w-full py-3 rounded-[12px] text-[13px] font-extrabold uppercase tracking-wider transition-transform ${team ? 'bg-cocoa text-mascarpone active:scale-[0.97]' : 'bg-[rgba(74,40,24,0.1)] text-ink3'}`}
            >
              {team ? 'Continue →' : 'Pick a side'}
            </button>
            {seenIntro && (
              <button onClick={() => setStep(0)} className="block w-full pt-3 text-[10px] text-ink3 underline">Watch intro again</button>
            )}
          </>
        )}

        {step >= READY_STEP && (
          <>
            <div className="text-[44px] mb-1 leading-none select-none mt-2">🍰</div>
            <h2 className="text-[22px] font-black text-ink tracking-tight leading-tight">Ready, {name || 'Anonymous'}?</h2>
            <p className="text-[10px] text-gold font-extrabold tracking-[1.5px] uppercase mb-4">Beat 275m · Build 300m</p>

            <ul className="text-left mb-4 space-y-2.5 px-1">
              <li className="text-[12.5px] text-ink flex gap-2.5 leading-snug"><span className="text-[18px] flex-none w-6 text-center">👆</span><span>Tap when marker hits <b className="text-successgreen">green</b>.</span></li>
              <li className="text-[12.5px] text-ink flex gap-2.5 leading-snug"><span className="text-[18px] flex-none w-6 text-center">🔥</span><span>Stack perfetti for <b className="text-gold">×8 multiplier</b>. <b>☕ Espresso</b> at 5 perfetti slows meter.</span></li>
              <li className="text-[12.5px] text-ink flex gap-2.5 leading-snug"><span className="text-[18px] flex-none w-6 text-center">🧠</span><span>Mini-rounds between slices. <b className="text-errorred">Fail = −1 ♥</b>.</span></li>
            </ul>

            {/* Leaderboard preview */}
            {(board.length > 0 || isGlobal) && (
              <div className="mb-4 p-2.5 bg-surface2 rounded-[12px] text-left border border-[rgba(74,40,24,0.08)]">
                <div className="text-[10px] uppercase tracking-[1.3px] text-ink3 font-extrabold mb-1.5 text-center flex items-center justify-center gap-1">
                  <span>🏆</span><span>{isGlobal ? "Players you'll chase" : 'Best runs'}</span>
                </div>
                {loadingGlobal && <div className="text-center text-[11px] text-ink3 py-1 italic">Loading…</div>}
                {!loadingGlobal && board.length === 0 && (
                  <div className="text-center text-[11px] text-ink3 py-1 italic">Be the first!</div>
                )}
                {!loadingGlobal && board.slice(0, 3).map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[12px] py-0.5 px-1">
                    <span className={`w-4 font-extrabold ${i === 0 ? 'text-gold' : 'text-ink2'}`}>{i + 1}</span>
                    {entry.team === 'GB' && <span>🇬🇧</span>}
                    {entry.team === 'IT' && <span>🇮🇹</span>}
                    <span className="flex-1 font-bold text-ink truncate">{entry.name}</span>
                    <span className="font-extrabold text-ink tabular-nums">{fmt(entry.cm)}m</span>
                  </div>
                ))}
                {board.length > 3 && (
                  <button onClick={() => setShowLeaderboard(true)} className="mt-1.5 text-[10px] text-gold underline w-full text-center font-bold">View all 25 →</button>
                )}
              </div>
            )}

            <button onClick={() => onStart(true)} className="block w-full py-3.5 rounded-[12px] text-[14px] font-extrabold uppercase tracking-wider mb-2 bg-cocoa text-mascarpone active:scale-[0.97] transition-transform">
              Begin
            </button>
            <div className="flex justify-center gap-4 pt-1">
              <button onClick={() => setStep(PROFILE_STEP)} className="text-[10px] text-ink3 underline">← Edit name</button>
              <button onClick={() => onStart(false)} className="text-[10px] text-ink3 underline">Skip hints</button>
            </div>
          </>
        )}
      </motion.div>

      {/* Leaderboard panel */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] flex items-center justify-center p-5 bg-[rgba(31,17,8,0.7)] backdrop-blur-md"
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-[rgba(74,40,24,0.1)] rounded-[24px] p-6 max-w-sm w-full shadow-large max-h-[80vh] overflow-y-auto"
            >
              <div className="text-center mb-4">
                <div className="text-[44px] mb-1 leading-none">🏆</div>
                <h3 className="text-[22px] font-black text-ink tracking-tight">Top runs</h3>
                <p className="text-[11px] text-ink3 font-bold tracking-wider uppercase mt-1">
                  {isGlobal ? 'Global leaderboard' : 'On this device'}
                </p>
              </div>
              {loadingGlobal && (
                <div className="text-center text-[12px] text-ink3 py-6">Loading…</div>
              )}
              <div className="space-y-1.5">
                {!loadingGlobal && board.length === 0 && (
                  <div className="text-center text-[12px] text-ink3 py-4 italic">No runs yet — be the first!</div>
                )}
                {!loadingGlobal && board.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-[10px] bg-surface2">
                    <div className={`w-6 text-[14px] font-extrabold ${i === 0 ? 'text-gold' : i < 3 ? 'text-ink' : 'text-ink3'}`}>{i + 1}</div>
                    <div className="flex-1 text-[13px] font-bold text-ink truncate flex items-center gap-1.5">
                      {entry.team === 'GB' && <span>🇬🇧</span>}
                      {entry.team === 'IT' && <span>🇮🇹</span>}
                      <span className="truncate">{entry.name}</span>
                    </div>
                    <div className="text-[14px] font-extrabold text-ink tabular-nums">{fmt(entry.cm)}m</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="block w-full mt-5 py-3 rounded-[12px] bg-cocoa text-mascarpone text-[13px] font-bold uppercase tracking-wider active:scale-[0.97]"
              >Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [punch, setPunch] = useState(0);
  const [hintStage, setHintStage] = useState(hintsOn ? 0 : -1);
  const [garnishes, setGarnishes] = useState([]);
  const [milestonesShown] = useState(() => new Set());
  const [builderAnim, setBuilderAnim] = useState(null); // 'complete' | 'golden' | null
  const [storyBeatsShown] = useState(() => new Set());
  const [activeBeat, setActiveBeat] = useState(null);
  // Aggregate stats for end-game display
  const statsRef = useRef({ perfects: 0, maxCombo: 0, slices: 0, goldenSlices: 0, miniGamesWon: 0, miniGamesLost: 0 });
  // Leaderboard: fetched at game start, used for "chasing" + "passed" celebrations
  const leaderboardTargetsRef = useRef([]); // sorted array of { name, cm, team } we haven't passed yet
  const [chasingTarget, setChasingTarget] = useState(null); // current next target
  const seenEspressoRef = useRef(false); // first-time espresso explainer flag
  const [mode, setMode] = useState('timing'); // 'timing' | 'memory' | 'order' | 'lightning'
  const [memoryRoundCount, setMemoryRoundCount] = useState(0);
  const [orderRoundCount, setOrderRoundCount] = useState(0);
  const [lightningRoundCount, setLightningRoundCount] = useState(0);

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
  const transitioningRef = useRef(false); // blocks taps during slice complete transition

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

  // Fetch leaderboard at game start so we know who to chase
  useEffect(() => {
    let cancelled = false;
    if (isGlobalLeaderboardConfigured()) {
      fetchGlobalLeaderboard(15).then(b => {
        if (cancelled || !b || !b.length) return;
        // Sort ascending so we pop targets as we pass them
        const sorted = [...b].sort((a, b) => a.cm - b.cm);
        leaderboardTargetsRef.current = sorted;
        // Set first target = lowest score on board (smallest mountain to climb)
        const first = sorted[0];
        if (first) {
          setChasingTarget(first);
          // Show "Top score: X" banner briefly so player knows the bar
          const top = sorted[sorted.length - 1];
          showToast(`🏆 Top: ${top.name} · ${fmt(top.cm)}m`, 'gold', 3500);
        }
      });
    }
    return () => { cancelled = true; };
  }, []);

  // Keyboard support: space or enter = tap (for desktop accessibility)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (modeRef.current === 'timing' && !pausedRef.current && runningRef.current) {
          handleTap();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Marker animation loop with phase-based modifiers for strategic depth
  useEffect(() => {
    let raf;
    const loop = () => {
      if (runningRef.current && !pausedRef.current && modeRef.current === 'timing') {
        const pIdx = phaseIdxRef.current;
        const phase = PHASES[pIdx];
        let speed = phase.speed;
        if (espressoActiveRef.current > 0) speed *= 0.4;
        if (hintStageRef.current === 0) speed *= 0.55; // slow during initial hint

        // Phase 4 (Virtuoso): occasional random direction reversal — keeps you alert
        if (pIdx >= 3 && Math.random() < 0.003) {
          markerRef.current.dir *= -1;
        }
        // Phase 5 (Leggenda): erratic speed variance
        if (pIdx >= 4) {
          const variance = 0.65 + Math.random() * 0.7; // 0.65–1.35x
          speed *= variance;
        }

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
    if (!runningRef.current || pausedRef.current || modeRef.current !== 'timing') return;
    if (transitioningRef.current) return; // ignore taps during slice transition
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
        setTimeout(() => onEnd({ length: newLength, runId: Date.now(), stats: { ...statsRef.current } }), 700);
        // fall through to apply state below
      }
    } else if (quality === 'perfect') {
      sfx.perfect();
      statsRef.current.perfects += 1;
      if (newCombo > statsRef.current.maxCombo) statsRef.current.maxCombo = newCombo;
      // Multiplier tier-up celebration
      if (m.tier > prevTier && JOKES.multUp[m.mult]) {
        sfx.multUp(m.tier);
        showToast(pick(JOKES.multUp[m.mult]), 'green', 2400);
      }
      // Espresso earned at every 5 consecutive perfetti
      if (newCombo > 0 && newCombo % 5 === 0) {
        sfx.espresso();
        setEspresso(e => e + 1);
        // First-time explainer: clearer message about what to do with it
        if (!seenEspressoRef.current) {
          seenEspressoRef.current = true;
          showToast('☕ Espresso! Tap cup at right to slow the meter', 'gold', 4500);
        } else {
          showToast('☕ Espresso earned!', 'gold', 2400);
        }
      }
    } else {
      sfx.good();
    }

    setCombo(newCombo);
    setLength(newLength);
    setSliceLayers(newSliceLayers);

    // Espresso decrement
    if (espressoActiveRef.current > 0) espressoActiveRef.current -= 1;

    // Check phase transition — non-interrupting toast
    const newPhase = getPhase(newLength);
    if (newPhase.idx !== phaseIdxRef.current) {
      setPhaseIdx(newPhase.idx);
      sfx.phase();
      showToast(`⚡ Phase ${newPhase.idx + 1} · ${newPhase.name}`, 'gold', 2400);
    }

    // Check ambient story beats
    for (const beat of STORY_BEATS) {
      if (newLength >= beat.at && !storyBeatsShown.has(beat.at)) {
        storyBeatsShown.add(beat.at);
        const beatRef = beat;
        setActiveBeat(beat);
        setTimeout(() => setActiveBeat(b => (b === beatRef ? null : b)), 3500);
      }
    }

    // Check leaderboard overtakes — celebrate passing other players
    while (leaderboardTargetsRef.current.length > 0 && newLength >= leaderboardTargetsRef.current[0].cm) {
      const passed = leaderboardTargetsRef.current.shift();
      const flag = passed.team === 'GB' ? '🇬🇧 ' : passed.team === 'IT' ? '🇮🇹 ' : '';
      showToast(`📈 Passed ${flag}${passed.name}!`, 'goldenslice', 2800);
      sfx.multUp(2);
      // Update chasing target to next
      setChasingTarget(leaderboardTargetsRef.current[0] || null);
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
      statsRef.current.slices += 1;
      if (allPerfect) {
        statsRef.current.goldenSlices += 1;
        const baseSliceCm = newSliceLayers.reduce((s, l) => s + POINTS[l.quality] * m.mult, 0);
        bonus = Math.round(baseSliceCm * 0.5);
        finalLen = newLength + bonus;
        setLength(finalLen);
        sfx.golden();
        fireConfetti(1);
        setPunch(p => p + 1); // camera punch on golden
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
      transitioningRef.current = true;
      setTimeout(() => {
        setSliceLayers([]);
        setLayerIdx(0);
        setBuilderAnim(null);
        transitioningRef.current = false;
      }, 700);

      // Increment slice count and check for event round trigger
      sliceCountRef.current += 1;
      // Events start from Phase 1 (Pasticcere) onwards — Apprentice is timing-only
      // Every 3rd slice triggers an event (rotates: memory → order → lightning)
      if (sliceCountRef.current % 3 === 0 && sliceCountRef.current > 0 && phaseIdxRef.current >= 1) {
        setTimeout(() => {
          eventCounterRef.current += 1;
          const types = ['memory', 'order', 'lightning'];
          const eventType = types[(eventCounterRef.current - 1) % types.length];
          setMode(eventType);
        }, 1100);
      }
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

  const handleEventComplete = useCallback((kind, success, bonus) => {
    if (success) {
      statsRef.current.miniGamesWon += 1;
      const newLen = lengthRef.current + bonus;
      setLength(newLen);
      sfx.golden();
      fireConfetti(0.8);
      const successMsg =
        kind === 'memory' ? `🧠 Memoria perfetta · +${bonus}cm`
        : kind === 'order' ? `👑 Order delivered · +${bonus}cm`
        : `⚡ Lightning · +${bonus}cm`;
      showToast(successMsg, 'goldenslice', 3000);

      // Check leaderboard overtakes from event bonus too
      while (leaderboardTargetsRef.current.length > 0 && newLen >= leaderboardTargetsRef.current[0].cm) {
        const passed = leaderboardTargetsRef.current.shift();
        const flag = passed.team === 'GB' ? '🇬🇧 ' : passed.team === 'IT' ? '🇮🇹 ' : '';
        setTimeout(() => showToast(`📈 Passed ${flag}${passed.name}!`, 'goldenslice', 2800), 800);
        setChasingTarget(leaderboardTargetsRef.current[0] || null);
      }

      // Check phase + milestones immediately (don't wait for next timing tap)
      const newPh = getPhase(newLen);
      if (newPh.idx !== phaseIdxRef.current) {
        setPhaseIdx(newPh.idx);
        sfx.phase();
      }
      const meters = newLen / 100;
      for (const ms of MILESTONES) {
        if (meters >= ms.m && !milestonesShown.has(ms.m)) {
          milestonesShown.add(ms.m);
          if (ms.heart) setLives(l => Math.min(3, l + 1));
          if (ms.garnish) setGarnishes(g => [...g, ms.garnish]);
          if (ms.pause) {
            if (ms.m === 275) sfx.record(); else sfx.golden();
            fireBigConfetti();
            // Fire pause AFTER mode switches back to timing
            setTimeout(() => pauseFor({ emoji: ms.emoji, label: ms.label, title: ms.text, sub: ms.sub }), 600);
          } else {
            const msId = Date.now() + Math.random();
            setSmallMilestone({ text: ms.text, sub: ms.sub, id: msId });
            fireConfetti(0.6);
            setTimeout(() => setSmallMilestone(m2 => (m2 && m2.id === msId) ? null : m2), 2400);
          }
        }
      }
    } else {
      statsRef.current.miniGamesLost += 1;
      sfx.miss();
      // Penalty only kicks in from Phase 2 (Maestro) — Pasticcere is forgiving
      const penalize = phaseIdxRef.current >= 2;
      if (penalize) {
        const newLives = livesRef.current - 1;
        setLives(newLives);
        setShake(s => s + 1);
        setFlash(f => f + 1);
        const failMsg =
          kind === 'memory' ? 'Memory failed · −1 ♥'
          : kind === 'order' ? 'Order rejected · −1 ♥'
          : 'Lightning missed · −1 ♥';
        showToast(failMsg, 'red', 2600);
        if (newLives <= 0) {
          runningRef.current = false;
          setTimeout(() => onEnd({ length: lengthRef.current, runId: Date.now(), stats: { ...statsRef.current } }), 800);
        }
      } else {
        const failMsg =
          kind === 'memory' ? 'Memory failed — no bonus'
          : kind === 'order' ? 'Order rejected — no bonus'
          : 'Lightning missed — no bonus';
        showToast(failMsg, 'red', 2400);
      }
    }
    if (kind === 'memory') setMemoryRoundCount(c => c + 1);
    else if (kind === 'order') setOrderRoundCount(c => c + 1);
    else if (kind === 'lightning') setLightningRoundCount(c => c + 1);
    // Reset marker to center for clean restart of timing mode
    markerRef.current.pos = 50;
    markerRef.current.dir = 1;
    setMode('timing');
  }, [showToast, onEnd]);

  const phase = PHASES[phaseIdx];
  const m = multTier(combo);
  const recordPct = Math.min(100, (length / GOAL_CM) * 100);
  const meters = length / 100;
  const progressLabel = meters < 275 ? 'Goal 300m' : meters < 300 ? '🏆 Record broken!' : '🏆 300m smashed!';

  return (
    <motion.div
      animate={{
        x: shake > 0 ? [0, -8, 8, -5, 5, 0] : 0,
        scale: punch > 0 ? [1, 1.035, 1] : 1,
      }}
      transition={{
        x: { duration: 0.4 },
        scale: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] },
      }}
      key={'fx-' + shake + '-' + punch}
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
      <div className={`flex-1 relative overflow-hidden bg-${phase.bg}`}>
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
        <div className="absolute top-[78px] left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[2.2px] font-bold text-ink3 z-[6] flex items-center gap-2 whitespace-nowrap">
          <span>Phase {phaseIdx + 1}</span>
          <span className="text-gold">{phase.name}</span>
          <span className="text-ink3 opacity-50">·</span>
          <span className="text-ink2">{phase.time}</span>
        </div>

        {/* Ambient story beats — press-ticker style */}
        <div className="absolute top-[156px] left-0 right-0 flex justify-center pointer-events-none z-[8] px-4">
          <AnimatePresence>
            {activeBeat && (
              <motion.div
                key={activeBeat.at}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="bg-surface text-ink text-[12px] font-semibold px-4 py-2 rounded-full border border-[rgba(74,40,24,0.1)] shadow-soft max-w-full whitespace-nowrap overflow-hidden text-ellipsis text-center"
              >
                {activeBeat.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toast — wrapper handles centering, motion handles animation */}
        <div className="absolute top-[110px] left-0 right-0 flex justify-center pointer-events-none z-20 px-4">
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

        {/* Hint — only during timing mode and tutorial */}
        {hintStage >= 0 && mode === 'timing' && <HintLayer stage={hintStage} />}

        {/* Espresso */}
        <AnimatePresence>
          {espresso > 0 && <EspressoButton count={espresso} onUse={useEspresso} />}
        </AnimatePresence>

        {/* Tap button */}
        <div className="absolute bottom-0 left-0 right-0 h-[130px] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[14px] flex z-[7] bg-gradient-to-t from-bg from-[65%] to-transparent">
          <TapButton type={RECIPE[layerIdx]} onTap={handleTap} pulse={hintStage >= 0} />
        </div>
      </div>

      {/* Event rounds — full takeover */}
      <AnimatePresence>
        {mode === 'memory' && (
          <MemoryRound
            key={'mem-' + memoryRoundCount}
            roundNum={memoryRoundCount}
            phaseIdx={phaseIdx}
            onComplete={(success, bonus) => handleEventComplete('memory', success, bonus)}
          />
        )}
        {mode === 'order' && (
          <OrderRound
            key={'ord-' + orderRoundCount}
            roundNum={orderRoundCount}
            phaseIdx={phaseIdx}
            onComplete={(success, bonus) => handleEventComplete('order', success, bonus)}
          />
        )}
        {mode === 'lightning' && (
          <LightningRound
            key={'lit-' + lightningRoundCount}
            roundNum={lightningRoundCount}
            phaseIdx={phaseIdx}
            onComplete={(success, bonus) => handleEventComplete('lightning', success, bonus)}
          />
        )}
      </AnimatePresence>

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
      aria-label={`Tap to drop ${NAMES[type]} layer when marker is on green`}
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
      aria-label="Use espresso boost — slows the meter for 4 layers"
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
  // Stage 0: point at TAP BUTTON (bottom). Stage 1+: point at METER.
  const config = stage === 0
    ? { bottom: 142, label: 'TAP THE BUTTON', color: 'gold' }
    : { bottom: 200, label: 'TAP WHEN GREEN', color: 'green' };
  const bg = config.color === 'green' ? 'bg-successgreen' : 'bg-gold';
  const shadow = config.color === 'green'
    ? '0 6px 20px rgba(16,185,129,0.5)'
    : '0 6px 20px rgba(201,123,26,0.5)';
  return (
    <motion.div
      key={stage}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, bottom: config.bottom }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="absolute left-0 right-0 z-[23] flex justify-center pointer-events-none"
    >
      <div className="flex flex-col items-center gap-1">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[44px] leading-none"
          style={{ filter: 'drop-shadow(0 6px 12px rgba(201,123,26,0.45))' }}
        >👇</motion.div>
        <div className={`${bg} text-white px-4 py-[8px] rounded-full text-[12px] font-extrabold tracking-wider whitespace-nowrap`} style={{ boxShadow: shadow }}>
          {config.label}
        </div>
      </div>
    </motion.div>
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
  const [iapStage, setIapStage] = useState('offer'); // offer | processing | rugpull
  const [isNew, setIsNew] = useState(false);
  const [best, setBest] = useState(() => getBest());

  // Save best ONCE on mount (idempotent across re-renders)
  useEffect(() => {
    const wasNew = saveBest(stats.length);
    setIsNew(wasNew);
    setBest(getBest());
    // Add to local leaderboard
    addToLeaderboard(getUsername(), stats.length, getTeam());
    // Also post to global if configured
    if (isGlobalLeaderboardConfigured() && stats.length > 100) {
      postScore(getUsername() || 'Anonymous', stats.length, getTeam());
    }
  }, [stats.length]);

  let title = 'Servizio finito', verdict = '', closingScene = '', stars = 0;
  if (m < 30) {
    title = 'Curtain falls early';
    verdict = "Even Pret across the road did better tonight. The cameras pack up. The crowd drifts to L'Eliseo for a proper one.";
    closingScene = 'Riprova, caro.';
    stars = 1;
  } else if (m < 100) {
    title = 'A modest evening';
    verdict = "Respectable enough. Sloane mums give a polite nod, then leave for Granger & Co. King's Road moves on.";
    closingScene = 'There is always tomorrow.';
    stars = 2;
  } else if (m < 220) {
    title = 'A solid showing';
    verdict = 'The pensioners stay till the end. Saatchi takes one photo. Vogue Italia does not call back.';
    closingScene = 'Almost — but not yet.';
    stars = 3;
  } else if (m < 275) {
    title = 'So close, caro';
    verdict = 'Five metres from the record. La nonna sets down her spoon. Imola, watching from afar, exhales.';
    closingScene = 'Riprova — you were inches away.';
    stars = 3;
  } else if (m < 300) {
    title = '🏆 Record broken!';
    verdict = "275m down. You beat the Italians at their own game — but you came for 300, didn't you? The crowd is delighted; the ego, less so.";
    closingScene = 'A famous victory. Push for 300 next time.';
    stars = 4;
  } else if (m < 400) {
    title = '🏆 300 METRI!';
    verdict = 'Chelsea Town Hall erupts. La Repubblica leads with the headline. The Cadogan Estate offers you a mews. Roma weeps with envy. The pensioners give you a standing ovation.';
    closingScene = 'A perfect night, darling.';
    stars = 5;
  } else {
    title = '🏆 LEGGENDARIO';
    verdict = m.toFixed(0) + "m. Beyond legend. Even Stamford Bridge bows. The Pope sends his blessing. Italian schoolchildren will study tonight in textbooks.";
    closingScene = 'Buonissimo, leggenda.';
    stars = 5;
  }

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
      className="absolute inset-0 z-30 flex flex-col items-center justify-start gap-3 px-6 py-8 pb-12 bg-[rgba(253,246,232,0.94)] backdrop-blur-xl overflow-y-auto"
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

      {/* Run stats */}
      {stats.stats && (
        <div className="grid grid-cols-3 gap-2 max-w-[340px] w-full mt-1">
          <StatTile label="Perfetti" value={stats.stats.perfects || 0} />
          <StatTile label="Max combo" value={'×' + multTier(stats.stats.maxCombo || 0).mult} />
          <StatTile label="Slices" value={stats.stats.slices || 0} />
          <StatTile label="Golden" value={stats.stats.goldenSlices || 0} highlight={stats.stats.goldenSlices > 0} />
          <StatTile label="Mini-wins" value={stats.stats.miniGamesWon || 0} />
          <StatTile label="Mini-fails" value={stats.stats.miniGamesLost || 0} />
        </div>
      )}

      <p className="text-[14px] text-center text-ink2 leading-snug max-w-[340px] font-medium px-2 mt-1">{verdict}</p>
      <p className="text-[12px] text-center text-gold italic font-bold leading-snug max-w-[320px] px-2 mt-1">{closingScene}</p>

      {/* The £10 IAP joke */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 280, damping: 22 }}
        className="bg-surface2 rounded-[14px] p-3 border border-[rgba(74,40,24,0.12)] max-w-[340px] w-full mt-3 text-left"
      >
        {iapStage === 'offer' && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-ink3 font-bold mb-1">Discreet offer</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-extrabold text-ink leading-tight">🤫 Bribe the judges</div>
                <div className="text-[11px] text-ink2 mt-0.5">Transfer £10 to Hugo via Revolut to stay in the game</div>
              </div>
              <button
                onClick={() => { setIapStage('processing'); setTimeout(() => setIapStage('rugpull'), 1800); }}
                className="px-3 py-2 bg-cocoa text-mascarpone rounded-[10px] text-[11px] font-extrabold tracking-wide whitespace-nowrap active:scale-[0.95] transition-transform"
              >
                £10 · Pay
              </button>
            </div>
          </>
        )}
        {iapStage === 'processing' && (
          <div className="flex items-center gap-3 py-1">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="text-[20px]"
            >⏳</motion.div>
            <div className="flex-1">
              <div className="text-[12px] font-bold text-ink">Bribing judges…</div>
              <div className="text-[10px] text-ink2 mt-0.5">Sending £10 to Hugo via Revolut</div>
            </div>
          </div>
        )}
        {iapStage === 'rugpull' && (
          <div className="text-center py-1">
            <div className="text-[28px] leading-none mb-1">😏</div>
            <div className="text-[13px] font-extrabold text-ink">Just kidding! Hugo isn't taking bribes.</div>
            <div className="text-[11px] text-ink2 mt-1 italic">Chelsea Town Hall has standards. Riprova free, caro.</div>
          </div>
        )}
      </motion.div>

      <button onClick={onRestart} className="px-9 py-[13px] rounded-[14px] text-sm font-bold bg-cocoa text-mascarpone active:scale-[0.97] transition-transform mt-3">
        Play again
      </button>
      <div className="flex gap-2">
        <button onClick={share} className="px-6 py-[11px] rounded-[14px] text-[12px] font-semibold bg-transparent text-ink2 border border-[rgba(74,40,24,0.18)] active:scale-[0.97] transition-transform">
          Share score
        </button>
        <button onClick={onHome} className="px-6 py-[11px] rounded-[14px] text-[12px] font-semibold bg-transparent text-ink2 border border-[rgba(74,40,24,0.18)] active:scale-[0.97] transition-transform">
          Home
        </button>
      </div>
    </motion.div>
  );
}

function StatTile({ label, value, highlight }) {
  return (
    <div className={`rounded-[12px] px-3 py-2 text-center ${highlight ? 'bg-[rgba(201,123,26,0.12)] border border-[rgba(201,123,26,0.3)]' : 'bg-surface2'}`}>
      <div className={`text-[16px] font-extrabold tabular-nums ${highlight ? 'text-gold' : 'text-ink'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider font-bold text-ink3">{label}</div>
    </div>
  );
}

// ─── MEMORY ROUND ────────────────────────────────────────────────────────────
const MEMORY_SUCCESS = [
  'Una memoria perfetta!',
  'Bellissima — like Sloane clockwork!',
  "Magnifico — Chelsea's finest mind!",
  'Perfetto — Saatchi-worthy memory!',
  'Bravissimo — Cadogan calls!',
  'Squisito! Vogue takes notes',
  'Memoria leggendaria, darling!',
];
const MEMORY_FAIL = [
  'Madonna mia, that\'s not it',
  "Forgetful, like King's Road parking",
  'Concentrate, caro!',
  'Even my goldfish remembers better',
  'Disastro! Riprova next time',
];

function MemoryRound({ roundNum, phaseIdx = 0, onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | preview | showing | prompt | input | result
  const [showIdx, setShowIdx] = useState(-1);
  const [inputIdx, setInputIdx] = useState(0);
  const [tappedTypes, setTappedTypes] = useState([]); // record of what user tapped
  const [result, setResult] = useState(null);
  const isFirst = roundNum === 0;
  // Gentle early difficulty, escalates with phase
  const sequence = useMemo(() => {
    const types = ['lady', 'cream', 'cocoa'];
    // Phase 0: 3, Phase 1: 4, Phase 2: 5, Phase 3: 6, Phase 4: 7+ (harder)
    const len = Math.min(3 + phaseIdx + Math.floor(roundNum / 3), 9);
    return Array.from({ length: len }, () => types[Math.floor(Math.random() * 3)]);
  }, [roundNum, phaseIdx]);
  // Display speed: slow in early phases, fast in late
  const showDuration = Math.max(260, 720 - phaseIdx * 90 - roundNum * 20);
  const gapDuration = Math.max(110, 240 - phaseIdx * 25 - roundNum * 8);

  // Intro: play sound on entry, user taps "Watch" to continue
  useEffect(() => {
    if (phase === 'intro') sfx.phase();
  }, [phase]);

  // Pre-show beat then start sequence
  useEffect(() => {
    if (phase !== 'preview') return;
    const t = setTimeout(() => setPhase('showing'), 800);
    return () => clearTimeout(t);
  }, [phase]);

  // Showing sequence
  useEffect(() => {
    if (phase !== 'showing') return;
    let alive = true;
    let i = 0;
    const tick = () => {
      if (!alive) return;
      if (i >= sequence.length) {
        setShowIdx(-1);
        setTimeout(() => alive && setPhase('prompt'), 350);
        return;
      }
      setShowIdx(i);
      const seqIdx = i;
      const seqType = sequence[seqIdx];
      const tIdx = seqType === 'lady' ? 0 : seqType === 'cream' ? 1 : 2;
      sfx.memShow(tIdx);
      i += 1;
      setTimeout(() => {
        if (!alive) return;
        setShowIdx(-1);
        setTimeout(tick, gapDuration);
      }, showDuration);
    };
    setTimeout(tick, 400);
    return () => { alive = false; };
  }, [phase, sequence, showDuration, gapDuration]);

  // Prompt → input after brief beat
  useEffect(() => {
    if (phase !== 'prompt') return;
    const t = setTimeout(() => setPhase('input'), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  const handleTap = useCallback((type) => {
    if (phase !== 'input') return;
    if (type === sequence[inputIdx]) {
      sfx.perfect();
      const newIdx = inputIdx + 1;
      setInputIdx(newIdx);
      setTappedTypes(t => [...t, type]);
      if (newIdx >= sequence.length) {
        sfx.golden();
        setResult('success');
        setPhase('result');
        // Bonus scales with sequence length × round difficulty
        const bonus = 250 * sequence.length + roundNum * 100;
        setTimeout(() => onComplete(true, bonus), 1700);
      }
    } else {
      sfx.miss();
      setResult('fail');
      setPhase('result');
      setTimeout(() => onComplete(false, 0), 1500);
    }
  }, [phase, inputIdx, sequence, roundNum, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 bg-bg flex flex-col"
    >
      {/* Header strip retains length/lives via parent — this is the round content */}
      <div className="flex-1 flex flex-col items-center justify-between px-6 pt-10 pb-8">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-[88px] mb-3 leading-none"
              >🧠</motion.div>
              <div className="text-[11px] uppercase tracking-[2px] font-extrabold text-gold mb-2">{isFirst ? 'Mini-game · New!' : 'Round Event'}</div>
              <h2 className="text-[34px] font-black text-ink tracking-tight mb-3 leading-tight">Nonna's Memory</h2>
              <p className="text-[15px] text-ink2 max-w-[300px] leading-relaxed mb-2 px-1">
                {isFirst
                  ? "Nonna will show you a pattern of ingredients. Watch carefully, then repeat it in the same order."
                  : "Watch the pattern, then repeat it in order."}
              </p>
              <p className="text-[12px] text-ink3 max-w-[280px] leading-relaxed mb-7 px-2">
                <b className="text-gold">Bonus length</b> on success · No penalty if you miss
              </p>
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 280 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPhase('preview')}
                onTouchStart={(e) => { e.preventDefault(); setPhase('preview'); }}
                className="px-9 py-[14px] rounded-[14px] text-sm font-extrabold uppercase tracking-wider bg-cocoa text-mascarpone shadow-large active:scale-[0.97] transition-transform"
              >
                Watch the pattern →
              </motion.button>
            </motion.div>
          )}

          {phase === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="text-[40px] mb-3 leading-none">👀</div>
              <h2 className="text-[28px] font-black text-ink tracking-tight">Watch carefully…</h2>
              <p className="text-[13px] text-ink2 mt-2">{sequence.length} ingredient{sequence.length !== 1 ? 's' : ''}</p>
            </motion.div>
          )}

          {(phase === 'showing' || phase === 'input' || phase === 'prompt') && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 w-full flex flex-col items-center justify-between"
            >
              {/* Top: title + state */}
              <div className="text-center mt-2">
                <div className="text-[10px] uppercase tracking-[2px] font-bold text-ink3 mb-1">Memoria · Round {roundNum + 1}</div>
                <motion.h2
                  key={phase}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-[26px] font-black text-ink tracking-tight"
                >
                  {phase === 'showing' ? '👀 Watching…' : phase === 'prompt' ? '👇 Now repeat it!' : 'Your turn 👆'}
                </motion.h2>
                {phase === 'input' && (
                  <p className="text-[12px] text-ink3 mt-1 font-medium">Tap in the order Nonna showed</p>
                )}
              </div>

              {/* Sequence dots */}
              <div className="flex gap-3 my-4">
                {sequence.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i < inputIdx ? 1.25 : i === showIdx ? 1.4 : 1,
                      backgroundColor: i < inputIdx ? '#10b981' : i === showIdx ? '#c97b1a' : 'rgba(74,40,24,0.18)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                    className="w-3 h-3 rounded-full"
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                {['lady', 'cream', 'cocoa'].map(type => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.94 }}
                    animate={{
                      scale: phase === 'showing' && sequence[showIdx] === type ? 1.08 : 1,
                      boxShadow: phase === 'showing' && sequence[showIdx] === type
                        ? '0 0 0 4px rgba(201,123,26,0.85), 0 0 32px rgba(201,123,26,0.65)'
                        : '0 8px 22px rgba(74,40,24,0.18)',
                    }}
                    transition={{ duration: 0.18 }}
                    onTouchStart={(e) => { e.preventDefault(); handleTap(type); }}
                    onClick={(e) => { if (!('ontouchstart' in window)) handleTap(type); }}
                    disabled={phase !== 'input'}
                    className={`btn-${type} h-[110px] rounded-[20px] flex flex-col items-center justify-center font-bold ${phase !== 'input' ? 'pointer-events-none' : ''}`}
                  >
                    <span className="text-[40px] leading-none">{ICONS[type]}</span>
                    <span className="text-[12px] mt-2 font-bold tracking-tight">{NAMES[type]}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'result' && (
            <motion.div
              key="result"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="text-[80px] mb-3 leading-none">{result === 'success' ? '🌟' : '😬'}</div>
              <h2 className="text-[28px] font-black text-ink tracking-tight mb-2 px-4 leading-tight">
                {result === 'success' ? pick(MEMORY_SUCCESS) : pick(MEMORY_FAIL)}
              </h2>
              <p className="text-[14px] text-ink2 font-medium">
                {result === 'success' ? `+${250 * sequence.length + roundNum * 100}cm bonus` : 'No bonus this time'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── LIGHTNING ROUND (Pure reflexes — match flashing ingredients) ─────────────
const LIGHTNING_LINES = [
  '⚡ Lightning fast!',
  '⚡ Bellissimo reflexes!',
  '⚡ Like a Sloane Square cabbie!',
  '⚡ Vogue cover speed!',
  '⚡ Faster than King\'s Road traffic!',
];
const LIGHTNING_FAIL = [
  'Too slow, caro!',
  'Reflexes need espresso',
  'Rusty, like a Cadogan gate',
  'Madonna mia, focus!',
];

function LightningRound({ roundNum, phaseIdx = 0, onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | countdown | active | result
  const [showIdx, setShowIdx] = useState(-1);
  const [hits, setHits] = useState(0);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const isFirst = roundNum === 0;
  const sequence = useMemo(() => {
    const types = ['lady', 'cream', 'cocoa'];
    const len = Math.min(3 + phaseIdx + Math.floor(roundNum / 3), 6);
    return Array.from({ length: len }, () => types[Math.floor(Math.random() * 3)]);
  }, [roundNum, phaseIdx]);
  // Hit window: VERY generous — 2.5s early, 1.5s late
  const hitWindow = Math.max(1500, 2500 - phaseIdx * 250 - roundNum * 30);
  const hitTimerRef = useRef(null);
  const aliveRef = useRef(true);
  const phaseRef = useRef(phase);
  const tapHandlerRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => {
    aliveRef.current = false;
    tapHandlerRef.current = null;
    if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
  }, []);

  useEffect(() => {
    if (phase === 'intro') sfx.phase();
  }, [phase]);

  // Countdown phase: 3, 2, 1, GO
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    let n = 3;
    sfx.tap();
    const tick = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(tick);
        setCountdown(0); // 'GO!' state
        sfx.multUp(2);
        setTimeout(() => setPhase('active'), 450);
        return;
      }
      setCountdown(n);
      sfx.tap();
    }, 700);
    return () => clearInterval(tick);
  }, [phase]);

  // Active phase: cycle through ingredients
  useEffect(() => {
    if (phase !== 'active') return;
    let i = 0;
    setShowIdx(-1);
    const advance = () => {
      if (!aliveRef.current) return;
      if (i >= sequence.length) {
        // All done!
        setShowIdx(-1);
        sfx.golden();
        setResult('success');
        setPhase('result');
        const bonus = 200 * sequence.length + 500 + roundNum * 80 + phaseIdx * 100;
        setTimeout(() => onComplete(true, bonus), 1700);
        return;
      }
      const seqIdx = i;
      const seqType = sequence[seqIdx];
      setShowIdx(seqIdx);
      const tIdx = seqType === 'lady' ? 0 : seqType === 'cream' ? 1 : 2;
      sfx.memShow(tIdx);
      hitTimerRef.current = setTimeout(() => {
        if (!aliveRef.current) return;
        // Timeout — miss
        sfx.miss();
        setResult('fail');
        setPhase('result');
        setTimeout(() => onComplete(false, 0), 1500);
      }, hitWindow);
      i += 1;
    };

    const handler = (type) => {
      if (!aliveRef.current || phaseRef.current !== 'active') return;
      const currentIdx = i - 1;
      if (currentIdx < 0 || currentIdx >= sequence.length) return;
      if (type === sequence[currentIdx]) {
        clearTimeout(hitTimerRef.current);
        sfx.perfect();
        setHits(h => h + 1);
        setShowIdx(-1);
        setTimeout(advance, 280); // breathing room between ingredients
      } else {
        clearTimeout(hitTimerRef.current);
        sfx.miss();
        setResult('fail');
        setPhase('result');
        tapHandlerRef.current = null;
        setTimeout(() => onComplete(false, 0), 1500);
      }
    };
    tapHandlerRef.current = handler;
    setTimeout(advance, 350);
    return () => { clearTimeout(hitTimerRef.current); tapHandlerRef.current = null; };
  }, [phase, sequence, hitWindow, roundNum, phaseIdx, onComplete]);

  const onButtonTap = useCallback((type) => {
    if (tapHandlerRef.current) tapHandlerRef.current(type);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 bg-bg flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-between px-6 pt-10 pb-8">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <motion.div
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                className="text-[88px] mb-3 leading-none"
              >⚡</motion.div>
              <div className="text-[11px] uppercase tracking-[2px] font-extrabold text-gold mb-2">{isFirst ? 'Mini-game · New!' : 'Lightning Round'}</div>
              <h2 className="text-[34px] font-black text-ink tracking-tight mb-3 leading-tight">Lightning</h2>
              <p className="text-[15px] text-ink2 max-w-[300px] leading-relaxed mb-2 px-1">
                {isFirst
                  ? "Ingredients will flash one at a time. Tap the matching button before it disappears. No second chances."
                  : "Match each flashing ingredient. Be fast — windows close quickly."}
              </p>
              <p className="text-[12px] text-ink3 max-w-[280px] leading-relaxed mb-7 px-2">
                <b className="text-gold">All-or-nothing</b> · Big bonus on success
              </p>
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 280 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPhase('countdown')}
                onTouchStart={(e) => { e.preventDefault(); setPhase('countdown'); }}
                className="px-9 py-[14px] rounded-[14px] text-sm font-extrabold uppercase tracking-wider bg-cocoa text-mascarpone shadow-large active:scale-[0.97] transition-transform"
              >
                Start lightning ⚡
              </motion.button>
            </motion.div>
          )}

          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="text-[11px] uppercase tracking-[2px] font-bold text-ink3 mb-2">Get ready…</div>
              <motion.div
                key={'cd-' + countdown}
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="text-[140px] font-black text-gold leading-none tabular-nums"
                style={{ textShadow: '0 4px 32px rgba(201,123,26,0.4)' }}
              >
                {countdown > 0 ? countdown : 'GO!'}
              </motion.div>
              <p className="text-[14px] text-ink2 font-medium mt-3">Match each flashing ingredient</p>
            </motion.div>
          )}

          {phase === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 w-full flex flex-col items-center justify-between"
            >
              <div className="text-center mt-2">
                <div className="text-[10px] uppercase tracking-[2px] font-bold text-ink3 mb-1">Lightning · Round {roundNum + 1}</div>
                <h2 className="text-[22px] font-black text-ink tracking-tight">Tap the matching button below</h2>
                <p className="text-[12px] text-ink3 mt-1">Hit {hits} / {sequence.length}</p>
              </div>

              {/* Flashing target ingredient with shrinking hit-window timer */}
              <div className="flex-1 flex items-center justify-center w-full relative">
                <AnimatePresence mode="wait">
                  {showIdx >= 0 && (
                    <motion.div
                      key={showIdx}
                      initial={{ scale: 0, rotate: -10, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      className={`relative w-[150px] h-[150px] rounded-[30px] flex items-center justify-center text-[80px] btn-${sequence[showIdx]} shadow-large`}
                      style={{ boxShadow: '0 0 0 6px rgba(201,123,26,0.25), 0 12px 40px rgba(74,40,24,0.3)' }}
                    >
                      {ICONS[sequence[showIdx]]}
                      {/* Hit-window shrinking ring */}
                      <motion.div
                        key={'ring-' + showIdx}
                        initial={{ scale: 1.35, opacity: 0.85 }}
                        animate={{ scale: 1.0, opacity: 0 }}
                        transition={{ duration: hitWindow / 1000, ease: 'linear' }}
                        className="absolute inset-0 rounded-[30px] border-[4px] border-gold pointer-events-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Hit progress dots */}
              <div className="flex gap-2 mb-4">
                {sequence.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i < hits ? 1.2 : 1,
                      backgroundColor: i < hits ? '#10b981' : i === hits ? '#c97b1a' : 'rgba(74,40,24,0.18)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                    className="w-3 h-3 rounded-full"
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                {['lady', 'cream', 'cocoa'].map(type => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.94 }}
                    onTouchStart={(e) => { e.preventDefault(); onButtonTap(type); }}
                    onClick={(e) => { if (!('ontouchstart' in window)) onButtonTap(type); }}
                    className={`btn-${type} h-[100px] rounded-[20px] flex flex-col items-center justify-center font-bold shadow-[0_8px_22px_rgba(74,40,24,0.18)]`}
                  >
                    <span className="text-[36px] leading-none">{ICONS[type]}</span>
                    <span className="text-[12px] mt-1 font-bold tracking-tight">{NAMES[type]}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'result' && (
            <motion.div
              key="result"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="text-[80px] mb-3 leading-none">{result === 'success' ? '⚡' : '💤'}</div>
              <h2 className="text-[28px] font-black text-ink tracking-tight mb-2 px-4 leading-tight">
                {result === 'success' ? pick(LIGHTNING_LINES) : pick(LIGHTNING_FAIL)}
              </h2>
              <p className="text-[14px] text-ink2 font-medium">
                {result === 'success'
                  ? `+${200 * sequence.length + 500 + roundNum * 80 + phaseIdx * 100}cm bonus`
                  : `${hits} of ${sequence.length} caught — no bonus`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── ORDER ROUND (Customer recipe match) ─────────────────────────────────────
const CUSTOMERS = [
  { name: 'Sloane Mum',       portrait: '👜', quote: "I'll have what we had at L'Eliseo, dear" },
  { name: 'Cadogan Baron',    portrait: '🎩', quote: "Nothing too sweet — I'm watching my figure" },
  { name: 'Saatchi Curator',  portrait: '🎨', quote: "I want something… provocative" },
  { name: 'Italian Nonna',    portrait: '👵', quote: "Authentic, like Roma. Don't disappoint." },
  { name: 'Royal Pensioner',  portrait: '🎖️', quote: "The usual, son. Just like '52." },
  { name: "King's Rd Ranger", portrait: '🐎', quote: "Quick — I'm parked at Sloane Square" },
  { name: 'Fulham Dad',       portrait: '🧑‍💼', quote: "Whatever's on the menu, mate" },
];

const ORDER_SUCCESS = [
  'Order delivered, darling!',
  'Customer is delighted!',
  'Five stars on Tripadvisor!',
  'Will tell all the Sloane mums!',
  'Bellissimo, exactly as ordered!',
];
const ORDER_FAIL = [
  'Customer rejects it, disastro!',
  'They wanted something else, ma!',
  'Wrong order — no tip today',
  'Madonna mia, riprova!',
];

function OrderRound({ roundNum, phaseIdx = 0, onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | reveal | input | result
  const [inputIdx, setInputIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [shake, setShake] = useState(0);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const isFirst = roundNum === 0;

  const customer = useMemo(() => CUSTOMERS[roundNum % CUSTOMERS.length], [roundNum]);
  const sequence = useMemo(() => {
    const types = ['lady', 'cream', 'cocoa'];
    const len = Math.min(3 + phaseIdx + Math.floor(roundNum / 3), 7);
    return Array.from({ length: len }, () => types[Math.floor(Math.random() * 3)]);
  }, [roundNum, phaseIdx]);
  // Reveal duration: very generous early game (5.5s), still fair late game (3s)
  const revealMs = Math.max(3000, 6500 - phaseIdx * 800);

  useEffect(() => {
    if (phase === 'intro') sfx.phase();
  }, [phase]);

  // Reveal phase: show order for revealMs with countdown
  useEffect(() => {
    if (phase !== 'reveal') return;
    setRevealCountdown(Math.ceil(revealMs / 1000));
    let n = Math.ceil(revealMs / 1000);
    const tick = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(tick); setPhase('input'); return; }
      setRevealCountdown(n);
      sfx.tap();
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, revealMs]);

  const handleTap = useCallback((type) => {
    if (phase !== 'input') return;
    if (type === sequence[inputIdx]) {
      sfx.perfect();
      const newIdx = inputIdx + 1;
      setInputIdx(newIdx);
      if (newIdx >= sequence.length) {
        sfx.golden();
        setResult('success');
        setPhase('result');
        const bonus = 250 * sequence.length + roundNum * 80;
        setTimeout(() => onComplete(true, bonus), 1700);
      }
    } else {
      sfx.miss();
      setShake(s => s + 1);
      setResult('fail');
      setPhase('result');
      setTimeout(() => onComplete(false, 0), 1600);
    }
  }, [phase, inputIdx, sequence, roundNum, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-30 bg-bg flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-between px-6 pt-10 pb-8">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-[88px] mb-3 leading-none"
              >{customer.portrait}</motion.div>
              <div className="text-[11px] uppercase tracking-[2px] font-extrabold text-gold mb-2">{isFirst ? 'Mini-game · Posh Order' : 'Posh Order'}</div>
              <h2 className="text-[30px] font-black text-ink tracking-tight mb-3 leading-tight">{customer.name}</h2>
              <p className="text-[15px] text-ink2 italic max-w-[300px] leading-relaxed font-medium mb-2">"{customer.quote}"</p>
              <p className="text-[12px] text-ink3 max-w-[280px] leading-relaxed mb-7 px-2">
                {isFirst
                  ? <>A customer arrives. <b className="text-gold">Tap each ingredient in order</b>. Wrong = customer leaves empty-handed.</>
                  : <>Tap each ingredient in their order. <b className="text-gold">Bonus length</b> on success.</>}
              </p>
              <motion.button
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 280 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPhase('reveal')}
                onTouchStart={(e) => { e.preventDefault(); setPhase('reveal'); }}
                className="px-9 py-[14px] rounded-[14px] text-sm font-extrabold uppercase tracking-wider bg-cocoa text-mascarpone shadow-large active:scale-[0.97] transition-transform"
              >
                See the order →
              </motion.button>
            </motion.div>
          )}

          {phase === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 w-full flex flex-col items-center justify-between"
            >
              <div className="text-center mt-2">
                <div className="text-[11px] uppercase tracking-[2px] font-bold text-gold mb-2">Memorise the order</div>
                <h2 className="text-[26px] font-black text-ink tracking-tight">Memorise it!</h2>
                <p className="text-[12px] text-ink2 mt-1">It will disappear in <b className="text-gold tabular-nums">{revealCountdown}s</b></p>
              </div>

              {/* Order display — visible during reveal */}
              <div className="flex flex-col items-center gap-3 my-6 max-w-full">
                <div className="text-[10px] uppercase tracking-[2px] font-bold text-ink3">{customer.name}'s Order</div>
                <div className="flex gap-2 justify-center flex-wrap max-w-[340px]">
                  {sequence.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
                      className={`relative w-12 h-12 rounded-[12px] flex flex-col items-center justify-center text-[24px] btn-${t} shadow-soft`}
                    >
                      {ICONS[t]}
                      <span className="absolute -bottom-[18px] text-[10px] text-ink3 font-bold tabular-nums">{i + 1}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Countdown ring */}
              <motion.div
                key={'cd-' + revealCountdown}
                initial={{ scale: 1.2, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-[64px] font-black text-gold tabular-nums leading-none"
              >
                {revealCountdown}
              </motion.div>
            </motion.div>
          )}

          {(phase === 'input') && (
            <motion.div
              key={'play-' + shake}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, x: shake > 0 ? [0, -8, 8, -5, 5, 0] : 0 }}
              exit={{ opacity: 0 }}
              transition={{ x: { duration: 0.4 } }}
              className="flex-1 w-full flex flex-col items-center justify-between"
            >
              {/* Customer header */}
              <div className="flex items-center gap-3 bg-surface px-4 py-3 rounded-[18px] shadow-soft border border-[rgba(74,40,24,0.08)]">
                <div className="text-[28px] leading-none">{customer.portrait}</div>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-ink3">Order from memory</div>
                  <div className="text-[15px] font-extrabold text-ink tracking-tight">{customer.name}</div>
                </div>
              </div>

              {/* Position dots — show only what's been tapped (correct), rest as "?" */}
              <div className="text-center my-3">
                <div className="text-[10px] uppercase tracking-[2px] font-bold text-ink3 mb-3">Position {inputIdx + 1} of {sequence.length}</div>
                <div className="flex gap-2 justify-center flex-wrap max-w-[340px]">
                  {sequence.map((t, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: i === inputIdx ? 1.2 : 1,
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                      className={`relative w-10 h-10 rounded-[10px] flex items-center justify-center text-[18px] font-black ${i < inputIdx ? `btn-${t}` : i === inputIdx ? 'bg-gold text-white' : 'bg-surface2 text-ink3'}`}
                      style={{
                        boxShadow: i === inputIdx ? '0 0 0 3px rgba(201,123,26,0.45)' : 'none',
                      }}
                    >
                      {i < inputIdx ? ICONS[t] : i === inputIdx ? '?' : '·'}
                      {i < inputIdx && <div className="absolute -top-[6px] -right-[5px] text-[12px] text-successgreen font-black bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-soft">✓</div>}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                {['lady', 'cream', 'cocoa'].map(type => (
                  <motion.button
                    key={type}
                    whileTap={{ scale: 0.94 }}
                    onTouchStart={(e) => { e.preventDefault(); handleTap(type); }}
                    onClick={(e) => { if (!('ontouchstart' in window)) handleTap(type); }}
                    className={`btn-${type} h-[110px] rounded-[20px] flex flex-col items-center justify-center font-bold shadow-[0_8px_22px_rgba(74,40,24,0.18)]`}
                  >
                    <span className="text-[40px] leading-none">{ICONS[type]}</span>
                    <span className="text-[12px] mt-2 font-bold tracking-tight">{NAMES[type]}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'result' && (
            <motion.div
              key="result"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.05, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="text-[80px] mb-3 leading-none">{result === 'success' ? customer.portrait : '😬'}</div>
              <h2 className="text-[28px] font-black text-ink tracking-tight mb-2 px-4 leading-tight">
                {result === 'success' ? pick(ORDER_SUCCESS) : pick(ORDER_FAIL)}
              </h2>
              <p className="text-[14px] text-ink2 font-medium">
                {result === 'success' ? `+${250 * sequence.length + roundNum * 80}cm bonus` : 'Customer leaves empty-handed'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
