# DeQuiz 🧠

A modern, animated multiple-choice quiz web app. Sharpen your mind, level up an animated character, and climb a global leaderboard.

**Trilingual:** English · Қазақша · Русский

## Features

- **200 questions** across **10 categories** — Logic Puzzles, Number Patterns, Critical Thinking, Verbal Reasoning, Lateral Thinking, Kazakh Literature, Kazakh History, Basic Geography, Films, and Sport. Options are shuffled every session.
- **Character progression** — 10 levels (thresholds 0 / 20 / 50 / 100 / 200 / 500 / 1000 / 2000 / 5000 / 10000) with a chosen path: **Hero's Path** (Recruit → Grand General) or **Royal Path** (Maiden → Queen). Each level has its own animated character.
- **Spectacular level-up** — a themed reveal with rotating light rays, shockwave rings, a sparkle burst, and confetti.
- **Global leaderboard** — with an animated "climb" when your rank improves after a quiz.
- **Full localization** — every screen, category, character name, and all 200 questions in English, Kazakh, and Russian. Language switches live and is remembered.
- **Ambient background music** — generated procedurally with the Web Audio API (no audio files), with a mute toggle.
- **Rich animated UI** — drifting aurora background, twinkling stars, floating particles, and micro-interactions throughout. Fully responsive.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- Plain CSS animations (no UI libraries)
- All client-side — progress, the leaderboard, and language choice persist in `localStorage`

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5191.

```bash
npm run build    # production build
npm run preview  # preview the build
```

## Project structure

```
src/
  App.jsx              # all screens (Welcome / Home / Quiz / Results / Leaderboard / LevelUpModal)
  audio.js             # procedural background music (Web Audio API)
  i18n.js              # UI strings, category & character names, path labels (en/kk/ru)
  index.css            # theme, layout and all animations
  data/
    questions.js       # English canonical catalog (200 questions) + getQuizQuestions()
    questions.ru.js    # Russian question pack
    questions.kk.js    # Kazakh question pack
    levels.js          # thresholds, colors, character emoji, level lookups
```

## Notes

This is an MVP. Google sign-in is currently simulated locally and the leaderboard is client-side with seeded players — a real backend (OAuth, a shared global leaderboard, and nickname uniqueness) is the natural next step.

The Kazakh and Russian translations were written by hand; the Kazakh set is worth a native speaker's spot-check.
