// Data layer with two interchangeable modes:
//   • 'supabase' — real auth (Google OAuth) + Postgres global leaderboard
//   • 'local'    — localStorage fallback so the app works with no backend
// The app awaits these functions regardless of mode.

import { supabase, isSupabaseConfigured } from './supabase.js';

export const BACKEND_MODE = isSupabaseConfigured ? 'supabase' : 'local';

// ─────────────────────────── local mode ───────────────────────────
const USER_KEY = 'dequiz.user';
const BOARD_KEY = 'dequiz.board';

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

const localUser = () => JSON.parse(localStorage.getItem(USER_KEY) || 'null');
const saveLocalUser = u => localStorage.setItem(USER_KEY, JSON.stringify(u));
const localBoard = () => JSON.parse(localStorage.getItem(BOARD_KEY) || 'null') || SEED_BOARD;
const saveLocalBoard = b => localStorage.setItem(BOARD_KEY, JSON.stringify(b));

// ─────────────────────────── public API ───────────────────────────

// Whether a real login is required before a profile can exist.
export const REQUIRES_AUTH = BACKEND_MODE === 'supabase';

// Returns { authed, needsProfile, profile } — profile is null until a nickname is claimed.
export async function getState() {
  if (BACKEND_MODE === 'local') {
    const u = localUser();
    return { authed: !!u, needsProfile: false, profile: u };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { authed: false, needsProfile: false, profile: null };
  const profile = await fetchProfile(session.user.id);
  return { authed: true, needsProfile: !profile, profile };
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, path, correct, quizzes, best')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nick: data.nickname, path: data.path, correct: data.correct, quizzes: data.quizzes, best: data.best };
}

// Subscribe to auth changes (supabase only). Returns an unsubscribe fn.
export function onAuthChange(cb) {
  if (BACKEND_MODE === 'local') return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => cb());
  return () => subscription.unsubscribe();
}

// Begins Google sign-in. In local mode this is a no-op (the UI shows the
// simulated nickname step directly).
export async function signInWithGoogle() {
  if (BACKEND_MODE === 'local') return { simulated: true };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return { redirecting: true };
}

export async function signOut() {
  if (BACKEND_MODE === 'local') {
    localStorage.removeItem(USER_KEY);
    return;
  }
  await supabase.auth.signOut();
}

// Claim a nickname + path, creating the profile. Throws 'nickname-taken' on conflict.
export async function claimProfile(nick, path) {
  const nickname = nick.trim();
  if (BACKEND_MODE === 'local') {
    const board = localBoard();
    if (board.some(e => e.nick.toLowerCase() === nickname.toLowerCase())) throw new Error('nickname-taken');
    const u = { nick: nickname, path, correct: 0, quizzes: 0, best: 0, joined: Date.now() };
    saveLocalUser(u);
    return u;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not-authed');
  const { error } = await supabase.from('profiles').insert({
    id: session.user.id, nickname, path, correct: 0, quizzes: 0, best: 0,
  });
  if (error) {
    if (error.code === '23505') throw new Error('nickname-taken'); // unique_violation
    throw error;
  }
  return { id: session.user.id, nick: nickname, path, correct: 0, quizzes: 0, best: 0 };
}

// Persist progress after a quiz.
export async function saveProgress(profile, { correct, quizzes, best }) {
  if (BACKEND_MODE === 'local') {
    const u = { ...localUser(), correct, quizzes, best };
    saveLocalUser(u);
    const board = localBoard().filter(e => e.nick !== u.nick);
    board.push({ nick: u.nick, correct, path: u.path });
    saveLocalBoard(board);
    return;
  }
  const { error } = await supabase.from('profiles')
    .update({ correct, quizzes, best }).eq('id', profile.id);
  if (error) throw error;
}

// Top-N leaderboard, sorted by correct desc. Returns [{ nick, correct, path }].
export async function getLeaderboard(limit = 50) {
  if (BACKEND_MODE === 'local') {
    return [...localBoard()].sort((a, b) => b.correct - a.correct).slice(0, limit);
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, correct, path')
    .order('correct', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(r => ({ nick: r.nickname, correct: r.correct, path: r.path }));
}
