/* ── match history ──────────────────────────────────────────────
   Kept locally. No account, no server, and it survives a refresh.
   Nothing here is load-bearing: if storage is unavailable the game
   plays exactly the same, it just forgets.
*/

const KEY = "wami.stats";

const blank = () => ({
  played: 0,
  wins: 0,
  best: 0,
  streak: 0,
  bestStreak: 0,
  history: [],
});

export function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const s = { ...blank(), ...raw };
    if (!Array.isArray(s.history)) s.history = [];
    return s;
  } catch {
    return blank();
  }
}

export function recordMatch({ won, score = 0, players = 0, rounds = 0 }) {
  const s = read();
  s.played += 1;

  if (won) {
    s.wins += 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.streak = 0;
  }

  s.best = Math.max(s.best, score);
  s.history = [
    { when: Date.now(), won: !!won, score, players, rounds },
    ...s.history,
  ].slice(0, 20);

  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — the game still plays */
  }
  return s;
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  return blank();
}

/** One line, or null when there is nothing worth saying yet. */
export function summaryLine() {
  const s = read();
  if (!s.played) return null;

  const bits = [`${s.wins}/${s.played} won`];
  if (s.streak >= 2) bits.push(`${s.streak} in a row`);
  if (s.bestStreak >= 2 && s.streak < s.bestStreak)
    bits.push(`best ${s.bestStreak}`);
  if (s.best) bits.push(`best score ${s.best}`);
  return bits.join(" · ");
}
