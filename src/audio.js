// Procedural ambient background music for quiz sessions.
// Generated with the Web Audio API — no external files, gentle looping pads
// with a soft arpeggio over a vi–IV–I–V chord progression in A minor.

const CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];

class QuizMusic {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.playing = false;
    this.muted = false;
  }

  start() {
    if (this.playing) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.16;
    // gentle low-pass so the pad stays soft and warm
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1600;
    this.filter.connect(this.ctx.destination);
    this.master.connect(this.filter);
    this.playing = true;
    this.step = 0;
    this.ctx.resume?.();
    this._tick();
    this.timer = setInterval(() => this._tick(), 2400);
  }

  _tick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = CHORDS[this.step % CHORDS.length];
    // sustained pad
    chord.forEach(f => this._pad(f, now, 2.4));
    // sparkling arpeggio on top, one octave up
    chord.forEach((f, i) => this._pluck(f * 2, now + i * 0.45 + 0.1));
    this.step++;
  }

  _pad(freq, t, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  _pluck(freq, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.16, this.ctx.currentTime, 0.1);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.ctx) {
      const c = this.ctx;
      this.master?.gain.setTargetAtTime(0, c.currentTime, 0.2);
      setTimeout(() => c.close?.(), 400);
      this.ctx = null;
      this.master = null;
    }
  }
}

export const quizMusic = new QuizMusic();

// ── short sound effects (procedural, share the mute state) ──
class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  _ac() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    return this.ctx;
  }
  setMuted(m) { this.muted = m; }

  _note(ctx, t, freq, gain, type, dur, glideTo) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(type) {
    if (this.muted) return;
    const ctx = this._ac();
    if (!ctx) return;
    ctx.resume?.();
    const t = ctx.currentTime;
    if (type === 'correct') {
      this._note(ctx, t, 660, 0.14, 'sine', 0.12);
      this._note(ctx, t + 0.09, 990, 0.14, 'sine', 0.16);
    } else if (type === 'wrong') {
      this._note(ctx, t, 220, 0.16, 'sawtooth', 0.28, 110);
    } else if (type === 'levelup') {
      [523, 659, 784, 1047].forEach((f, i) => this._note(ctx, t + i * 0.1, f, 0.13, 'triangle', 0.22));
    } else if (type === 'tick') {
      this._note(ctx, t, 880, 0.05, 'square', 0.05);
    }
  }
}

export const sfx = new Sfx();
