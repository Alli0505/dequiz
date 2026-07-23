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
- **Rich animated UI** — drifting aurora background, twinkling stars, floating particles, celebration confetti, and micro-interactions throughout. Fully responsive.
- **Optional real backend** — Google sign-in, a genuinely global leaderboard, and enforced unique nicknames via Supabase. Works with **no backend** out of the box (local mode); flip on env vars to go live. See [SETUP.md](SETUP.md).

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- Plain CSS animations + [canvas-confetti](https://github.com/catdad/canvas-confetti) (no heavy animation libraries)
- [Supabase](https://supabase.com/) (Postgres + Google OAuth) — optional; the app degrades to `localStorage` when unconfigured
- Client-side — progress, leaderboard, and language choice persist locally, or in Supabase when connected

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

## Deployment & backend

Deploy the static build anywhere (Vercel recommended). To enable real Google sign-in and a global leaderboard, create a Supabase project + Google OAuth client and set two env vars — full step-by-step in **[SETUP.md](SETUP.md)**. The database schema is in [`supabase/schema.sql`](supabase/schema.sql).

## Notes

Without Supabase env vars the app runs in local mode: sign-in is simulated and the leaderboard is seeded in `localStorage`. Scores are written from the client — for a hardened competitive leaderboard, move score-writing behind a Supabase Edge Function later.

The Kazakh and Russian translations were written by hand; the Kazakh set is worth a native speaker's spot-check.
