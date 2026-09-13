/* ── sound ──────────────────────────────────────────────────────
   Synthesised, not sampled. A single audio file would be bigger than
   this entire module and could 404 on a slow connection; a WebAudio
   graph cannot fail to load.

   Everything routes through `master`, so muting is one gain node
   rather than a flag every call site has to remember. Browsers keep
   an AudioContext suspended until the user actually does something,
   so the context is created lazily and `unlock()` is wired to the
   first click.
*/

const KEY = "wami.muted";

let ctx = null;
let master = null;

let muted = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  return ctx;
}

/** Browsers block audio until a real gesture. Call this from a click. */
export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export const isMuted = () => muted;

export function setMuted(on) {
  muted = !!on;
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* private mode — the preference just will not persist */
  }
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}

export const toggleMuted = () => setMuted(!muted);

/* One voice. */
function tone({
  freq,
  dur = 0.25,
  type = "sine",
  gain = 0.3,
  delay = 0,
  detune = 0,
}) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  /* exponential ramps cannot reach zero, so aim just above it */
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/* Filtered noise — anything percussive: cards, taps, shuffles. */
function noise({ dur = 0.12, gain = 0.2, lp = 2600, hp = 300, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const lo = c.createBiquadFilter();
  lo.type = "lowpass";
  lo.frequency.value = lp;
  const hi = c.createBiquadFilter();
  hi.type = "highpass";
  hi.frequency.value = hp;

  const g = c.createGain();
  g.gain.value = gain;

  src.connect(hi).connect(lo).connect(g).connect(master);
  src.start(t0);
}

const A = 440;
const note = (semitones) => A * 2 ** (semitones / 12);

export const sfx = {
  /** Cards leaving the deck. */
  deal() {
    for (let i = 0; i < 4; i++)
      noise({ dur: 0.13, gain: 0.13, lp: 3200, hp: 500, delay: i * 0.055 });
  },

  /** A card laid flat on wood. */
  tap() {
    noise({ dur: 0.05, gain: 0.11, lp: 2200, hp: 400 });
  },

  ask() {
    noise({ dur: 0.05, gain: 0.12, lp: 1800, hp: 300 });
    tone({
      freq: note(7),
      dur: 0.1,
      type: "triangle",
      gain: 0.08,
      delay: 0.02,
    });
  },

  /** A voice without saying anything — somebody telling you a lie. */
  answer() {
    tone({ freq: note(-5), dur: 0.18, type: "triangle", gain: 0.09 });
    tone({
      freq: note(-4),
      dur: 0.18,
      type: "triangle",
      gain: 0.06,
      delay: 0.07,
    });
  },

  right() {
    [0, 12, 19, 24].forEach((s, i) =>
      tone({
        freq: note(s),
        dur: 0.6,
        type: "sine",
        gain: 0.13,
        delay: i * 0.085,
      }),
    );
  },

  /* Two sawtooths a hair apart beat against each other. It reads as
     "wrong" without needing to be loud or harsh. */
  wrong() {
    tone({ freq: note(-24), dur: 0.55, type: "sawtooth", gain: 0.1 });
    tone({
      freq: note(-24),
      dur: 0.55,
      type: "sawtooth",
      gain: 0.08,
      detune: -35,
      delay: 0.01,
    });
  },

  eliminate() {
    tone({ freq: note(-29), dur: 0.8, type: "sine", gain: 0.2 });
    noise({ dur: 0.3, gain: 0.08, lp: 600, hp: 60 });
  },

  turn() {
    tone({ freq: note(3), dur: 0.28, type: "sine", gain: 0.1 });
    tone({ freq: note(10), dur: 0.4, type: "sine", gain: 0.09, delay: 0.11 });
  },

  score() {
    tone({ freq: note(24), dur: 0.45, type: "sine", gain: 0.11 });
  },

  win() {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
      tone({
        freq: note(s),
        dur: 0.8,
        type: "sine",
        gain: 0.12,
        delay: i * 0.075,
      }),
    );
  },
};
