import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, getQuizQuestions } from './data/questions.js';
import { levelInfo, nextLevelInfo, PATHS } from './data/levels.js';
import { quizMusic } from './audio.js';
import { LANGUAGES, t, fill, CATEGORY_T, PATH_T } from './i18n.js';

// ── local persistence (stand-in for real backend + Google OAuth) ──
const USER_KEY = 'dequiz.user';
const BOARD_KEY = 'dequiz.board';
const LANG_KEY = 'dequiz.lang';

const SEED_BOARD = [
  { nick: 'QuantumQuokka', correct: 2140, path: 'hero' },
  { nick: 'LogicLynx', correct: 1287, path: 'royal' },
  { nick: 'RiddleRider', correct: 640, path: 'hero' },
  { nick: 'SynapseSam', correct: 305, path: 'hero' },
  { nick: 'PuzzlePilot', correct: 168, path: 'royal' },
  { nick: 'BrainyBek', correct: 84, path: 'royal' },
  { nick: 'CuriousCat', correct: 41, path: 'royal' },
  { nick: 'NovaNaz', correct: 18, path: 'hero' },
];

const loadUser = () => JSON.parse(localStorage.getItem(USER_KEY) || 'null');
const saveUser = u => localStorage.setItem(USER_KEY, JSON.stringify(u));
const loadBoard = () => JSON.parse(localStorage.getItem(BOARD_KEY) || 'null') || SEED_BOARD;
const saveBoard = b => localStorage.setItem(BOARD_KEY, JSON.stringify(b));
const loadLang = () => localStorage.getItem(LANG_KEY) || 'en';

// English needs plural "s"; kk/ru templates omit the {s} token entirely.
const plural = (lang, n) => (lang === 'en' && n !== 1 ? 's' : '');

function resultMsg(lang, score) {
  if (score >= 9) return t(lang, 'msgGenius');
  if (score >= 7) return t(lang, 'msgBrilliant');
  if (score >= 5) return t(lang, 'msgSolid');
  return t(lang, 'msgWarming');
}

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [screen, setScreen] = useState(user ? 'home' : 'welcome');
  const [selectedCats, setSelectedCats] = useState([]);
  const [session, setSession] = useState(null); // { questions, index, correct, picked, results }
  const [levelUp, setLevelUp] = useState(null); // level object to celebrate
  const [muted, setMuted] = useState(false);
  const [rankChange, setRankChange] = useState(null); // { from, to } (0-based ranks)
  const [lang, setLang] = useState(loadLang);

  const path = user?.path || 'hero';
  const level = levelInfo(user?.correct || 0, path, lang);
  const next = nextLevelInfo(user?.correct || 0, path, lang);

  useEffect(() => { if (user) saveUser(user); }, [user]);
  useEffect(() => { localStorage.setItem(LANG_KEY, lang); }, [lang]);

  // background music plays only during the quiz screen
  useEffect(() => {
    if (screen === 'quiz') quizMusic.start();
    else quizMusic.stop();
    return () => quizMusic.stop();
  }, [screen]);

  function register(nick, chosenPath) {
    const u = { nick, path: chosenPath, correct: 0, quizzes: 0, best: 0, joined: Date.now() };
    setUser(u);
    setScreen('home');
  }

  function startQuiz() {
    setRankChange(null);
    setSession({ questions: getQuizQuestions(selectedCats, 10, lang), index: 0, correct: 0, picked: null, results: [] });
    setScreen('quiz');
  }

  function pick(i) {
    if (session.picked !== null) return;
    const q = session.questions[session.index];
    const isRight = i === q.answer;
    setSession(s => {
      const results = [...s.results];
      results[s.index] = isRight;
      return { ...s, picked: i, correct: s.correct + (isRight ? 1 : 0), results };
    });
  }

  function toggleMute() {
    setMuted(m => {
      const nextMuted = !m;
      quizMusic.setMuted(nextMuted);
      return nextMuted;
    });
  }

  function nextQuestion() {
    if (session.index + 1 < session.questions.length) {
      setSession(s => ({ ...s, index: s.index + 1, picked: null }));
    } else {
      const before = levelInfo(user.correct, path, lang);
      const newTotal = user.correct + session.correct;
      const after = levelInfo(newTotal, path, lang);
      const updated = { ...user, correct: newTotal, quizzes: user.quizzes + 1, best: Math.max(user.best, session.correct) };
      setUser(updated);

      // compute rank movement on the global board
      const prevBoard = loadBoard();
      const sortedBefore = [...prevBoard].sort((a, b) => b.correct - a.correct);
      let fromRank = sortedBefore.findIndex(e => e.nick === updated.nick);
      if (fromRank === -1) fromRank = sortedBefore.length; // wasn't ranked yet
      const board = prevBoard.filter(e => e.nick !== updated.nick);
      board.push({ nick: updated.nick, correct: newTotal, path });
      saveBoard(board);
      const toRank = [...board].sort((a, b) => b.correct - a.correct).findIndex(e => e.nick === updated.nick);
      setRankChange({ from: fromRank, to: toRank });

      if (after.level > before.level) setLevelUp(after);
      setScreen('results');
    }
  }

  return (
    <div className="app">
      <BgOrbs />
      {screen !== 'welcome' && user && (
        <header className="topbar">
          <button className="brand" onClick={() => setScreen('home')}>De<span>Quiz</span></button>
          <nav>
            <LangSwitch lang={lang} setLang={setLang} />
            <button className={screen === 'board' ? 'active' : ''} onClick={() => setScreen('board')}>🏆 {t(lang, 'leaderboard')}</button>
            <span className="chip" title={level.name}>{level.character} {t(lang, 'lv')} {level.level} · {user.correct}✓</span>
          </nav>
        </header>
      )}

      {screen === 'welcome' && <Welcome lang={lang} setLang={setLang} onRegister={register} />}
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
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 4,
    dur: Math.random() * 3 + 2,
  })), []);
  const particles = useMemo(() => Array.from({ length: 22 }, () => ({
    left: Math.random() * 100,
    size: Math.random() * 10 + 5,
    delay: Math.random() * 16,
    dur: Math.random() * 12 + 12,
    hue: Math.random() > 0.5 ? 'a' : 'b',
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

function Welcome({ lang, setLang, onRegister }) {
  const [step, setStep] = useState(0); // 0 = google, 1 = nickname, 2 = path
  const [nick, setNick] = useState('');
  const ok = nick.trim().length >= 3;
  const paths = PATH_T[lang] || PATH_T.en;
  return (
    <main className="center-screen">
      <div className="welcome-lang"><LangSwitch lang={lang} setLang={setLang} /></div>
      <div className="hero">
        <div className="logo-burst">🧠</div>
        <h1 className="title">De<span>Quiz</span></h1>
        <p className="subtitle">{t(lang, 'subtitle')}</p>

        {step === 0 && (
          <>
            <button className="google-btn" onClick={() => setStep(1)}>
              <GoogleIcon /> {t(lang, 'continueGoogle')}
            </button>
            <p className="fineprint">{t(lang, 'demoNote')}</p>
          </>
        )}

        {step === 1 && (
          <form className="nick-form" onSubmit={e => { e.preventDefault(); if (ok) setStep(2); }}>
            <label htmlFor="nick">{t(lang, 'chooseNick')}</label>
            <input id="nick" autoFocus value={nick} maxLength={20}
              onChange={e => setNick(e.target.value)} placeholder={t(lang, 'nickPlaceholder')} />
            <button className="cta" disabled={!ok}>{t(lang, 'next')}</button>
          </form>
        )}

        {step === 2 && (
          <div className="path-pick">
            <label className="path-label">{fill(t(lang, 'choosePath'), { name: nick.trim() })}</label>
            <div className="path-grid">
              {Object.values(PATHS).map((p, i) => (
                <button key={p.id} className="path-card" style={{ animationDelay: `${i * 0.1}s` }}
                  onClick={() => onRegister(nick.trim(), p.id)}>
                  <span className="path-icon">{p.icon}</span>
                  <strong>{paths[p.id].label}</strong>
                  <small>{paths[p.id].blurb}</small>
                </button>
              ))}
            </div>
            <button className="link-back" onClick={() => setStep(1)}>{t(lang, 'back')}</button>
          </div>
        )}
      </div>
      {step < 2 && (
        <div className="hero-cats">
          {CATEGORIES.map((c, i) => (
            <div className="float-emoji" style={{ animationDelay: `${i * 0.6}s` }} key={c.id}>{c.emoji}</div>
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
        {CATEGORIES.map(c => (
          <button key={c.id}
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
          <button className="mute-btn" onClick={onToggleMute} title={muted ? t(lang, 'unmute') : t(lang, 'mute')}>
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="score-chip">✓ {session.correct}</span>
        </div>
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
              <button key={i} className={cls} onClick={() => onPick(i)} disabled={answered}>
                <span className="opt-letter">{String.fromCharCode(65 + i)}</span> {opt}
              </button>
            );
          })}
        </div>
        {answered && (
          <button className="cta next-btn" onClick={onNext}>
            {session.index + 1 < n ? t(lang, 'nextQuestion') : t(lang, 'seeResults')}
          </button>
        )}
      </div>
    </main>
  );
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
        <h1 className="score-line"><span className="score-num">{score}</span>/10</h1>
        <p className="score-msg">{msg}</p>
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
  const board = useMemo(() => loadBoard().sort((a, b) => b.correct - a.correct), []);
  const medals = ['🥇', '🥈', '🥉'];
  const climbed = rankChange && rankChange.to < rankChange.from;
  const jumped = climbed ? rankChange.from - rankChange.to : 0;
  const ROW = 68; // px per row incl. gap, used to compute the climb distance

  return (
    <main className="page">
      <h2 className="section-title">{t(lang, 'globalLeaderboard')}</h2>
      {climbed && (
        <div className="climb-banner">{fill(t(lang, 'climbBanner'), { n: jumped, s: plural(lang, jumped), rank: rankChange.to + 1 })}</div>
      )}
      <div className="board">
        {board.map((e, i) => {
          const lvl = levelInfo(e.correct, e.path || 'hero', lang);
          const isMe = e.nick === me;
          const climbing = isMe && climbed;
          return (
            <div key={e.nick}
              className={`board-row ${isMe ? 'me' : ''} ${climbing ? 'climbing' : ''}`}
              style={climbing
                ? { '--climb': `${jumped * ROW}px` }
                : { animationDelay: `${i * 0.06}s` }}>
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
      <button className="ghost" onClick={onBack}>{t(lang, 'back')}</button>
    </main>
  );
}

function LevelUpModal({ lang, level, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="levelup" style={{ '--lvl': level.color }} onClick={e => e.stopPropagation()}>
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.15}s` }} />
          ))}
        </div>
        <div className="char-stage" aria-hidden="true">
          <div className="rays" />
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="ring r3" />
          <div className="sparks">
            {Array.from({ length: 12 }).map((_, i) => (
              <b key={i} style={{ '--a': `${i * 30}deg`, animationDelay: `${0.3 + (i % 6) * 0.05}s` }} />
            ))}
          </div>
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
