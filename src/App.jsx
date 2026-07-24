import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { CATEGORIES, getQuizQuestions } from './data/questions.js';
import { levelInfo, nextLevelInfo, PATHS } from './data/levels.js';
import { quizMusic, sfx } from './audio.js';
import { LANGUAGES, t, fill, CATEGORY_T, PATH_T } from './i18n.js';
import {
  REQUIRES_AUTH, getState, onAuthChange,
  signInWithGoogle, signOut, claimProfile, saveProgress, getLeaderboard,
} from './backend.js';

const LANG_KEY = 'dequiz.lang';
const BEST_KEY = 'dequiz.bestPoints';
const QTIME = 20; // seconds per question
const loadLang = () => localStorage.getItem(LANG_KEY) || 'en';

const plural = (lang, n) => (lang === 'en' && n !== 1 ? 's' : '');

// points for a correct answer.
// Questions with a fixed `max` (hard set): 40% base + up to 60% speed, capped at max, no streak.
// Default questions: 100 base + up to 60 speed bonus + streak bonus.
function pointsFor(timeLeft, streak, q) {
  const limit = q?.time || QTIME;
  const speedFrac = Math.max(0, timeLeft) / limit;
  if (q?.max) {
    return Math.min(q.max, Math.round(q.max * (0.4 + 0.6 * speedFrac)));
  }
  return 100 + Math.round(60 * speedFrac) + (streak - 1) * 20;
}

function resultMsg(lang, score) {
  if (score >= 9) return t(lang, 'msgGenius');
  if (score >= 7) return t(lang, 'msgBrilliant');
  if (score >= 5) return t(lang, 'msgSolid');
  return t(lang, 'msgWarming');
}

export default function App() {
  const [user, setUser] = useState(null);      // profile or null
  const [authed, setAuthed] = useState(false);  // signed in but maybe no profile yet
  const [screen, setScreen] = useState('boot');
  const [selectedCats, setSelectedCats] = useState([]);
  const [session, setSession] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [muted, setMuted] = useState(false);
  const [rankChange, setRankChange] = useState(null);
  const [lang, setLang] = useState(loadLang);

  const path = user?.path || 'hero';
  const level = levelInfo(user?.correct || 0, path, lang);
  const next = nextLevelInfo(user?.correct || 0, path, lang);

  useEffect(() => {
    let alive = true;
    async function sync() {
      const st = await getState();
      if (!alive) return;
      setAuthed(st.authed);
      setUser(st.profile);
      setScreen(st.profile ? 'home' : 'welcome');
    }
    sync();
    const off = onAuthChange(sync);
    return () => { alive = false; off(); };
  }, []);

  useEffect(() => { localStorage.setItem(LANG_KEY, lang); }, [lang]);

  useEffect(() => {
    if (screen === 'quiz') quizMusic.start();
    else quizMusic.stop();
    return () => quizMusic.stop();
  }, [screen]);

  async function register(nick, chosenPath) {
    const profile = await claimProfile(nick, chosenPath); // throws 'nickname-taken'
    setUser(profile);
    setAuthed(true);
    setScreen('home');
  }

  async function doSignOut() {
    await signOut();
    setUser(null);
    setAuthed(false);
    setScreen('welcome');
  }

  function startQuiz() {
    setRankChange(null);
    setSession({
      questions: getQuizQuestions(selectedCats, 10, lang),
      index: 0, correct: 0, picked: null, results: [],
      points: 0, streak: 0, bestStreak: 0,
    });
    setScreen('quiz');
  }

  // i === -1 means the timer ran out (counts as wrong, no selection)
  function pick(i, timeLeft = 0) {
    if (session.picked !== null) return;
    const q = session.questions[session.index];
    const isRight = i === q.answer;
    sfx.play(isRight ? 'correct' : 'wrong');
    setSession(s => {
      const results = [...s.results];
      results[s.index] = isRight;
      const streak = isRight ? s.streak + 1 : 0;
      const gained = isRight ? pointsFor(timeLeft, streak, q) : 0;
      return {
        ...s, picked: i, results,
        correct: s.correct + (isRight ? 1 : 0),
        streak, bestStreak: Math.max(s.bestStreak, streak),
        points: s.points + gained,
      };
    });
  }

  function toggleMute() {
    setMuted(m => {
      const nextMuted = !m;
      quizMusic.setMuted(nextMuted);
      sfx.setMuted(nextMuted);
      return nextMuted;
    });
  }

  async function finishQuiz() {
    const before = levelInfo(user.correct, path, lang);
    const newTotal = user.correct + session.correct;
    const after = levelInfo(newTotal, path, lang);
    const updated = { ...user, correct: newTotal, quizzes: user.quizzes + 1, best: Math.max(user.best, session.correct) };

    const boardBefore = await getLeaderboard(200);
    let fromRank = boardBefore.findIndex(e => e.nick === updated.nick);
    if (fromRank === -1) fromRank = boardBefore.length;

    await saveProgress(updated, { correct: newTotal, quizzes: updated.quizzes, best: updated.best });
    setUser(updated);

    const boardAfter = await getLeaderboard(200);
    let toRank = boardAfter.findIndex(e => e.nick === updated.nick);
    if (toRank === -1) toRank = fromRank;
    setRankChange({ from: fromRank, to: toRank });

    // personal-best points (client-side)
    const prevBest = Number(localStorage.getItem(BEST_KEY) || 0);
    const isBest = session.points > prevBest && session.points > 0;
    if (isBest) localStorage.setItem(BEST_KEY, String(session.points));
    setSession(s => ({ ...s, newBest: isBest }));

    if (after.level > before.level) { sfx.play('levelup'); setLevelUp(after); }
    setScreen('results');
  }

  function nextQuestion() {
    if (session.index + 1 < session.questions.length) {
      setSession(s => ({ ...s, index: s.index + 1, picked: null }));
    } else {
      finishQuiz();
    }
  }

  return (
    <div className="app">
      <BgOrbs />
      {screen !== 'welcome' && screen !== 'boot' && user && (
        <header className="topbar">
          <button className="brand" onClick={() => setScreen('home')}>De<span>Quiz</span></button>
          <nav>
            <LangSwitch lang={lang} setLang={setLang} />
            <button className={screen === 'board' ? 'active' : ''} onClick={() => setScreen('board')}>🏆 {t(lang, 'leaderboard')}</button>
            <span className="chip" title={level.name}>{level.character} {t(lang, 'lv')} {level.level} · {user.correct}✓</span>
            <button className="signout-btn" onClick={doSignOut} title={t(lang, 'signOut')}>⎋</button>
          </nav>
        </header>
      )}

      <div key={screen} className="screen-layer">
        {screen === 'boot' && (
          <main className="center-screen">
            <div className="logo-burst">🧠</div>
            <p className="subtitle" style={{ marginTop: 18 }}>{t(lang, 'loading')}</p>
          </main>
        )}
        {screen === 'welcome' && (
          <Welcome lang={lang} setLang={setLang} authed={authed} onRegister={register} />
        )}
        {screen === 'home' && user && (
          <Home lang={lang} user={user} level={level} next={next}
            selectedCats={selectedCats} setSelectedCats={setSelectedCats} onStart={startQuiz} />
        )}
        {screen === 'quiz' && session && (
          <Quiz lang={lang} session={session} onPick={pick} onNext={nextQuestion} muted={muted} onToggleMute={toggleMute} />
        )}
        {screen === 'results' && session && (
          <Results lang={lang} session={session} user={user} level={level} next={next}
            onAgain={() => setScreen('home')} onBoard={() => setScreen('board')} />
        )}
        {screen === 'board' && <Leaderboard lang={lang} me={user?.nick} rankChange={rankChange} onBack={() => setScreen('home')} />}
      </div>

      {levelUp && <LevelUpModal lang={lang} level={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  );
}

function LangSwitch({ lang, setLang }) {
  return (
    <div className="lang-switch" role="group" aria-label={t(lang, 'language')}>
      {LANGUAGES.map(l => (
        <button key={l.id}
          className={`lang-btn ${lang === l.id ? 'active' : ''}`}
          onClick={() => setLang(l.id)} title={l.label}>
          {l.flag}
        </button>
      ))}
    </div>
  );
}

function BgOrbs() {
  const stars = useMemo(() => Array.from({ length: 60 }, () => ({
    left: Math.random() * 100, top: Math.random() * 100, size: Math.random() * 2 + 1,
    delay: Math.random() * 4, dur: Math.random() * 3 + 2,
  })), []);
  const particles = useMemo(() => Array.from({ length: 22 }, () => ({
    left: Math.random() * 100, size: Math.random() * 10 + 5,
    delay: Math.random() * 16, dur: Math.random() * 12 + 12, hue: Math.random() > 0.5 ? 'a' : 'b',
  })), []);
  return (
    <div className="bg" aria-hidden="true">
      <div className="aurora" />
      <div className="stars">
        {stars.map((s, i) => (
          <span key={i} className="star" style={{
            left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
            animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`,
          }} />
        ))}
      </div>
      <div className="orbs">
        <div className="orb o1" /><div className="orb o2" /><div className="orb o3" /><div className="orb o4" />
      </div>
      <div className="particles">
        {particles.map((p, i) => (
          <span key={i} className={`particle p-${p.hue}`} style={{
            left: `${p.left}%`, width: p.size, height: p.size,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

function Welcome({ lang, setLang, authed, onRegister }) {
  const [step, setStep] = useState(authed && REQUIRES_AUTH ? 1 : 0);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = nick.trim().length >= 3;
  const paths = PATH_T[lang] || PATH_T.en;

  useEffect(() => { if (authed && REQUIRES_AUTH) setStep(s => (s === 0 ? 1 : s)); }, [authed]);

  async function handleGoogle() {
    setError(null);
    if (!REQUIRES_AUTH) { setStep(1); return; }
    setBusy(true);
    try { await signInWithGoogle(); }
    catch { setBusy(false); setError(t(lang, 'signInError')); }
  }

  async function choosePath(pathId) {
    setBusy(true); setError(null);
    try {
      await onRegister(nick.trim(), pathId);
    } catch (e) {
      setBusy(false);
      setError(e.message === 'nickname-taken' ? t(lang, 'nickTaken') : t(lang, 'signInError'));
      setStep(1);
    }
  }

  return (
    <main className="center-screen">
      <div className="welcome-lang"><LangSwitch lang={lang} setLang={setLang} /></div>
      <div className="hero">
        <div className="logo-burst">🧠</div>
        <h1 className="title">De<span>Quiz</span></h1>
        <p className="subtitle">{t(lang, 'subtitle')}</p>

        {step === 0 && (
          <div className="fade-in">
            <button className="google-btn" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon /> {t(lang, 'continueGoogle')}
            </button>
            <p className="fineprint">{REQUIRES_AUTH ? '' : t(lang, 'demoNote')}</p>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}

        {step === 1 && (
          <form className="nick-form" onSubmit={e => { e.preventDefault(); if (ok) { setError(null); setStep(2); } }}>
            <label htmlFor="nick">{t(lang, 'chooseNick')}</label>
            <input id="nick" autoFocus value={nick} maxLength={20}
              onChange={e => setNick(e.target.value)} placeholder={t(lang, 'nickPlaceholder')} />
            {error && <p className="form-error">{error}</p>}
            <button className="cta" disabled={!ok}>{t(lang, 'next')}</button>
          </form>
        )}

        {step === 2 && (
          <div className="path-pick">
            <label className="path-label">{fill(t(lang, 'choosePath'), { name: nick.trim() })}</label>
            <div className="path-grid">
              {Object.values(PATHS).map((p, i) => (
                <button key={p.id} className="path-card" disabled={busy} style={{ animationDelay: `${i * 0.1}s` }}
                  onClick={() => choosePath(p.id)}>
                  <span className="path-icon">{p.icon}</span>
                  <strong>{paths[p.id].label}</strong>
                  <small>{paths[p.id].blurb}</small>
                </button>
              ))}
            </div>
            {busy && <p className="fineprint">{t(lang, 'claiming')}</p>}
            <button className="link-back" onClick={() => setStep(1)} disabled={busy}>{t(lang, 'back')}</button>
          </div>
        )}
      </div>
      {step < 2 && (
        <div className="hero-cats">
          {CATEGORIES.slice(0, 5).map((c, i) => (
            <div className="float-emoji" style={{ animationDelay: `${i * 0.4}s` }} key={c.id}>{c.emoji}</div>
          ))}
        </div>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.1 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

function Home({ lang, user, level, next, selectedCats, setSelectedCats, onStart }) {
  const progress = next
    ? Math.round(((user.correct - level.threshold) / (next.threshold - level.threshold)) * 100)
    : 100;
  const cats = CATEGORY_T[lang] || CATEGORY_T.en;
  const remaining = next ? next.threshold - user.correct : 0;
  function toggle(id) {
    setSelectedCats(cs => cs.includes(id) ? cs.filter(x => x !== id) : [...cs, id]);
  }
  return (
    <main className="page">
      <section className="player-card" style={{ '--lvl': level.color }}>
        <div className="avatar bounce">{level.character}</div>
        <div className="player-info">
          <h2>{user.nick}</h2>
          <p className="lvl-name">{t(lang, 'level')} {level.level} — {level.name}</p>
          <div className="bar-head">
            <span>{level.character} {t(lang, 'lv')} {level.level}</span>
            {next && <span className="pct">{progress}%</span>}
            {next && <span>{t(lang, 'lv')} {next.level} {next.character}</span>}
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: `${progress}%` }} /></div>
          <p className="bar-label">
            {next
              ? fill(t(lang, 'moreToBecome'), { n: remaining, s: plural(lang, remaining), char: next.character, name: next.name })
              : t(lang, 'maxLevel')}
          </p>
        </div>
      </section>

      <h3 className="section-title">{t(lang, 'pickTopics')} <span>{t(lang, 'pickTopicsHint')}</span></h3>
      <div className="cat-grid">
        {CATEGORIES.map((c, i) => (
          <button key={c.id} style={{ animationDelay: `${i * 0.04}s` }}
            className={`cat-card ${selectedCats.includes(c.id) ? 'selected' : ''}`}
            onClick={() => toggle(c.id)}>
            <span className="cat-emoji">{c.emoji}</span>
            <strong>{cats[c.id].name}</strong>
            <small>{cats[c.id].blurb}</small>
          </button>
        ))}
      </div>

      <button className="cta big pulse" onClick={onStart}>{t(lang, 'startQuiz')}</button>
    </main>
  );
}

function Quiz({ lang, session, onPick, onNext, muted, onToggleMute }) {
  const q = session.questions[session.index];
  const n = session.questions.length;
  const answered = session.picked !== null;
  const cat = CATEGORIES.find(c => c.id === q.category);
  const catName = (CATEGORY_T[lang] || CATEGORY_T.en)[q.category].name;

  const limit = (q.time || QTIME) * 1000;
  const [remaining, setRemaining] = useState(limit);
  const answeredRef = useRef(answered);
  answeredRef.current = answered;
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  // per-question countdown; resets when the question changes, stops on answer
  useEffect(() => {
    setRemaining(limit);
    const start = performance.now();
    const id = setInterval(() => {
      if (answeredRef.current) { clearInterval(id); return; }
      const rem = limit - (performance.now() - start);
      if (rem <= 0) { setRemaining(0); clearInterval(id); onPick(-1, 0); return; }
      setRemaining(rem);
    }, 100);
    return () => clearInterval(id);
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.max(0, (remaining / limit) * 100);
  const timedOut = session.picked === -1;

  return (
    <main className="page quiz">
      <div className="quiz-head">
        <div className="dots">
          {session.questions.map((_, i) => {
            let cls = 'dot';
            if (session.results[i] === true) cls += ' correct';
            else if (session.results[i] === false) cls += ' wrong';
            else if (i === session.index) cls += ' now';
            return <span key={i} className={cls} />;
          })}
        </div>
        <div className="quiz-head-right">
          {session.streak >= 2 && <span className="streak-chip">🔥 {session.streak}</span>}
          <span className="pts-chip">⚡ {session.points}</span>
          <button className="mute-btn" onClick={onToggleMute} title={muted ? t(lang, 'unmute') : t(lang, 'mute')}>
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="score-chip">✓ {session.correct}</span>
        </div>
      </div>

      <div className="timer-bar">
        <div className={`timer-fill ${pct < 30 ? 'low' : ''} ${answered ? 'paused' : ''}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="q-card" key={q.id}>
        <span className="q-cat">{cat?.emoji} {catName}</span>
        <h2 className="q-text">{q.q}</h2>
        <div className="options">
          {q.options.map((opt, i) => {
            let cls = 'option';
            if (answered) {
              if (i === q.answer) cls += ' right';
              else if (i === session.picked) cls += ' wrong';
              else cls += ' dim';
            }
            return (
              <button key={i} className={cls} onClick={() => onPick(i, remainingRef.current / 1000)} disabled={answered}>
                <span className="opt-letter">{String.fromCharCode(65 + i)}</span> {opt}
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            {timedOut && <p className="time-up">{t(lang, 'timeUp')}</p>}
            <button className="cta next-btn" onClick={onNext}>
              {session.index + 1 < n ? t(lang, 'nextQuestion') : t(lang, 'seeResults')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function CountUp({ to }) {
  const [val, setVal] = useState(to);
  useEffect(() => {
    setVal(0);
    let cur = 0;
    const step = Math.max(1, Math.ceil(to / 14));
    const id = setInterval(() => {
      cur = Math.min(to, cur + step);
      setVal(cur);
      if (cur >= to) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, [to]);
  return <>{val}</>;
}

function Results({ lang, session, user, level, next, onAgain, onBoard }) {
  const score = session.correct;
  const msg = resultMsg(lang, score);
  const progress = next
    ? Math.round(((user.correct - level.threshold) / (next.threshold - level.threshold)) * 100)
    : 100;
  const remaining = next ? next.threshold - user.correct : 0;
  return (
    <main className="center-screen">
      <div className="results-card">
        <div className="avatar big-avatar bounce">{level.character}</div>
        <h1 className="score-line"><span className="score-num"><CountUp to={score} /></span>/10</h1>
        <p className="score-msg">{msg}</p>
        <div className="stat-row">
          <div className="stat"><span className="stat-val">⚡ <CountUp to={session.points} /></span><span className="stat-key">{t(lang, 'points')}</span></div>
          <div className="stat"><span className="stat-val">🔥 {session.bestStreak}</span><span className="stat-key">{t(lang, 'streakLabel')}</span></div>
        </div>
        {session.newBest && <p className="new-best">{t(lang, 'newBest')}</p>}
        <div className="bar"><div className="bar-fill" style={{ width: `${progress}%` }} /></div>
        <p className="bar-label">
          {next
            ? fill(t(lang, 'moreToReach'), { n: remaining, char: next.character, name: next.name })
            : t(lang, 'maxLevelShort')}
        </p>
        <div className="btn-row">
          <button className="cta" onClick={onAgain}>{t(lang, 'playAgain')}</button>
          <button className="ghost" onClick={onBoard}>🏆 {t(lang, 'leaderboard')}</button>
        </div>
      </div>
    </main>
  );
}

function Leaderboard({ lang, me, rankChange, onBack }) {
  const medals = ['🥇', '🥈', '🥉'];
  const climbed = rankChange && rankChange.to < rankChange.from;
  const jumped = climbed ? rankChange.from - rankChange.to : 0;
  const ROW = 68;
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let alive = true;
    getLeaderboard(50).then(final => {
      if (alive) setOrder(final);
    });
    return () => { alive = false; };
  }, []);

  return (
    <main className="page">
      <h2 className="section-title">{t(lang, 'globalLeaderboard')}</h2>
      {climbed && (
        <div className="climb-banner">
          {fill(t(lang, 'climbBanner'), { n: jumped, s: plural(lang, jumped), rank: rankChange.to + 1 })}
        </div>
      )}
      {!order ? (
        <p className="bar-label" style={{ textAlign: 'center' }}>{t(lang, 'loading')}</p>
      ) : (
        <div className="board">
          {order.map((e, i) => {
            const lvl = levelInfo(e.correct, e.path || 'hero', lang);
            const isMe = e.nick === me;
            const climbing = isMe && climbed;
            return (
              <div key={e.nick}
                className={`board-row ${isMe ? 'me' : ''} ${climbing ? 'climbing' : ''}`}
                style={climbing ? { '--climb': `${jumped * ROW}px` } : { animationDelay: `${i * 0.05}s` }}>
                <span className="rank">{medals[i] || i + 1}</span>
                <span className="board-char">{lvl.character}</span>
                <span className="board-nick">
                  {e.nick}{isMe && ` ${t(lang, 'you')}`}
                  {climbing && <span className="rank-up">▲ {jumped}</span>}
                </span>
                <span className="board-lvl">{t(lang, 'lv')} {lvl.level}</span>
                <span className="board-score">{e.correct} ✓</span>
              </div>
            );
          })}
        </div>
      )}
      <button className="ghost" onClick={onBack}>{t(lang, 'back')}</button>
    </main>
  );
}

function LevelUpModal({ lang, level, onClose }) {
  useEffect(() => {
    const colors = [level.color, '#21d4fd', '#facc15', '#fb7185'];
    confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.4 }, colors, zIndex: 100 });
    const end = Date.now() + 900;
    let raf;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors, zIndex: 100 });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors, zIndex: 100 });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    })();
    return () => cancelAnimationFrame(raf);
  }, [level.color]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="levelup" style={{ '--lvl': level.color }} onClick={e => e.stopPropagation()}>
        <div className="char-stage" aria-hidden="true">
          <div className="rays" />
          <div className="ring r1" /><div className="ring r2" /><div className="ring r3" />
          <div className="levelup-char">{level.character}</div>
        </div>
        <h2>{t(lang, 'levelUp')}</h2>
        <p className="levelup-name">{t(lang, 'level')} {level.level} — {level.name}</p>
        <p className="levelup-tag">“{level.tagline}”</p>
        <button className="cta" onClick={onClose}>{t(lang, 'awesome')}</button>
      </div>
    </div>
  );
}
