// Level system — 10 levels, cumulative correct answers unlock each.
// Character emoji branch by chosen path: hero (male) or royal (female).
// Names & taglines are language-dependent and live in ../i18n.js (CHAR_T).

import { CHAR_T } from '../i18n.js';

export const THRESHOLDS = [0, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export const COLORS = [
  '#facc15', '#fb923c', '#f472b6', '#a78bfa', '#818cf8',
  '#38bdf8', '#34d399', '#f59e0b', '#f43f5e', '#fde047',
];

// path id + icon; display labels/blurbs come from PATH_T in i18n.
export const PATHS = {
  hero: { id: 'hero', icon: '⚔️' },
  royal: { id: 'royal', icon: '👑' },
};

export const CHARACTER_EMOJI = {
  hero: ['🪖', '🎖️', '🛡️', '⚔️', '🏹', '🐎', '🗡️', '🦁', '🐉', '👑'],
  royal: ['🌸', '🎀', '💐', '👒', '💎', '🦋', '🌹', '🕊️', '🦢', '👑'],
};

function emojiFor(path) {
  return CHARACTER_EMOJI[path] || CHARACTER_EMOJI.hero;
}

function namesFor(path, lang) {
  const byLang = CHAR_T[lang] || CHAR_T.en;
  return byLang[path] || byLang.hero || CHAR_T.en.hero;
}

function build(idx, path, lang) {
  const { name, tagline } = namesFor(path, lang)[idx];
  return {
    level: idx + 1,
    threshold: THRESHOLDS[idx],
    color: COLORS[idx],
    character: emojiFor(path)[idx],
    name,
    tagline,
  };
}

export function levelInfo(totalCorrect, path = 'hero', lang = 'en') {
  let idx = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (totalCorrect >= THRESHOLDS[i]) idx = i;
  return build(idx, path, lang);
}

export function nextLevelInfo(totalCorrect, path = 'hero', lang = 'en') {
  const idx = THRESHOLDS.findIndex(t => t > totalCorrect);
  if (idx === -1) return null;
  return build(idx, path, lang);
}
