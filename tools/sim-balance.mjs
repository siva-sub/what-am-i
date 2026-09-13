/* ─────────────────────────────────────────────────────────────
   sim-balance.mjs — how much of this game is skill?

   The claim to test: "your card is 1 of 9 unseen cards, so one
   role-name answer cannot resolve it, so declaring is a guess."

   This drives complete matches through the real engine with bot
   players and reports:

     1. how often a bot ever reaches certainty and declares from it
     2. the accuracy of declarations that were NOT certain
     3. what accuracy a coin-flip would score against the same
        remaining-card distribution

   If (2) is no better than (3), the declaration is luck, and any
   acumen in the design is not reaching the decision it is supposed
   to inform.

   Run:  node tools/sim-balance.mjs [matches] [players]
   ───────────────────────────────────────────────────────────── */

import {
  createMatch,
  reduce,
  seatPlayers,
  turnOrder,
  PHASE,
  DEFAULT_TARGET,
} from "../js/rules.js";
import {
  fillWithBots,
  botDecideTurn,
  botAnswer,
  botCite,
  botSimulPick,
  botKnowledge,
  clearMemories,
  recordBelief,
} from "../js/bots.js";
import { CARDS } from "../js/cards.js";

const MATCHES = Number(process.argv[2] || 400);
const PLAYERS = Number(process.argv[3] || 4);
const TARGET = Number(process.argv[4] || 0) || DEFAULT_TARGET;

/* Deterministic, so a change in the numbers means a change in the
   game rather than a change in the weather. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rng = seeded(20260913);
Math.random = rng;

function runMatch() {
  clearMemories();
  let s = createMatch({ targetScore: TARGET });
  const join = (st, p) => reduce(st, { type: "join", ...p }).state;
  s = fillWithBots(s, PLAYERS, join);
  s = reduce(s, { type: "start" }).state;

  const stats = {
    rounds: 0,
    declarations: 0,
    certainDeclares: 0,
    certainCorrect: 0,
    guessDeclares: 0,
    guessCorrect: 0,
    /* what a player guessing the most-likely remaining role would score */
    expectedLuckyHits: 0,
    turns: 0,
    swaps: 0,
    asks: 0,
    simulRounds: 0,
    circuitPasses: 0,
  };

  /* Every action the referee takes is mirrored to record whether the
     declaring bot was certain. botDecideTurn is the only place that
     knows, so we re-ask it at the moment of the declaration. */
  const step = (action) => {
    const before = s;
    const { state, events } = reduce(before, action);
    s = state;

    for (const e of events) {
      /* Simultaneous declarations arrive as `simul_pick` while picks are
         collected, and only surface as a `declare` on the final seat.
         Counting only `declare` recorded zero declarations for every
         match, because the simul path never emits one. */
      if (e.t === "declare" || e.t === "simul_pick") {
        const info = byPid.get(e.pid);
        const fromCertainty = !!info?.certain || (info?.rolesLeft ?? 9) === 1;

        stats.declarations += 1;
        if (fromCertainty) {
          stats.certainDeclares += 1;
          if (e.correct) stats.certainCorrect += 1;
        } else {
          stats.guessDeclares += 1;
          if (e.correct) stats.guessCorrect += 1;
        }
      }
      if (e.t === "simul_begin") stats.simulRounds += 1;
    }
    return events;
  };

  /* pid -> whether that bot was certain on its most recent turn */
  const byPid = new Map();

  let guard = 0;
  while (s.phase !== PHASE.MATCH_END && guard++ < 4000) {
    const active = turnOrder(s)[s.pending?.turnIndex ?? 0];
    const botOf = (pid) => s.players.find((p) => p.pid === pid)?.bot;

    if (s.phase === PHASE.DEAL) {
      step({ type: "deal_done" });
      continue;
    }

    if (s.phase === PHASE.TURN && botOf(active)) {
      const move = botDecideTurn(s, active, rng);
      byPid.set(active, certaintyOf(s, active));

      if (move.type === "ask") {
        stats.asks += 1;
        step({ type: "ask", pid: active, target: move.target });
      } else if (move.type === "swap") {
        stats.swaps += 1;
        step({ type: "swap", pid: active });
      } else if (move.type === "declare") {
        step({ type: "declare", pid: active, role: move.role });
      } else {
        step({ type: "pass", pid: active });
      }
      stats.turns += 1;
      continue;
    }

    if (s.phase === PHASE.ANSWERING && botOf(s.pending.target)) {
      const r = botAnswer(s, s.pending.target, s.pending.asker, rng);
      recordBelief(s.pending.asker, s.pending.target, r, s.round);
      step({ type: "answer", pid: s.pending.target, role: r });
      continue;
    }

    if (s.phase === PHASE.CITING && botOf(s.pending.citer)) {
      step({
        type: "cite",
        pid: s.pending.citer,
        source: botCite(s, s.pending.citer),
      });
      continue;
    }

    if (s.phase === PHASE.SIMUL) {
      const picks = s.pending.picks ?? {};
      const waiting = seatPlayers(s).find(
        (p) => !p.out && p.bot && !(p.pid in picks),
      );
      if (waiting) {
        byPid.set(waiting.pid, certaintyOf(s, waiting.pid));
        step({
          type: "declare",
          pid: waiting.pid,
          role: botSimulPick(s, waiting.pid, rng),
        });
        continue;
      }
    }

    if (s.phase === PHASE.ROUND_END) {
      stats.rounds += 1;
      step({ type: "next_round" });
      continue;
    }

    /* nothing matched — avoid a silent infinite loop */
    break;
  }

  return { stats, end: s };
}

/* Whether the bot could actually name its card from what it knows.
   Must go through botKnowledge, which applies the answers it has been
   given — computing this from visible cards alone reported zero
   certainty even while the bots were declaring accurately, because it
   ignored the very narrowing that made them accurate. */
function certaintyOf(state, pid) {
  const { unknown } = botKnowledge(state, pid);
  if (!unknown.length) return { certain: false, rolesLeft: 9 };
  const rolesLeft = new Set(unknown.map((c) => c.role)).size;
  return { certain: unknown.length === 1 || rolesLeft === 1, rolesLeft };
}

/* ── run ─────────────────────────────────────────────────────── */

const agg = {
  rounds: 0,
  declarations: 0,
  certainDeclares: 0,
  certainCorrect: 0,
  guessDeclares: 0,
  guessCorrect: 0,
  turns: 0,
  asks: 0,
  swaps: 0,
  simulRounds: 0,
  winners: new Set(),
};

for (let i = 0; i < MATCHES; i++) {
  const { stats, end } = runMatch();
  for (const k of Object.keys(stats)) agg[k] = (agg[k] ?? 0) + stats[k];
  if (end.winner) agg.winners.add(end.winner);
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "—");

console.log(`
${MATCHES} matches · ${PLAYERS} players each
${"=".repeat(52)}

  Turns taken          ${agg.turns}
  Questions asked      ${agg.asks}   (${(agg.asks / Math.max(1, agg.turns)).toFixed(2)} per turn)
  Swaps used           ${agg.swaps}
  Rounds played        ${agg.rounds}   (${(agg.rounds / MATCHES).toFixed(2)} per match)
  Circuits collapsed   ${agg.simulRounds}   (${pct(agg.simulRounds, agg.rounds)} of rounds)

  DECLARATIONS
  total                ${agg.declarations}
  from certainty       ${agg.certainDeclares}   (${pct(agg.certainDeclares, agg.declarations)})
  from a guess         ${agg.guessDeclares}   (${pct(agg.guessDeclares, agg.declarations)})

  ACCURACY
  certain declarations ${pct(agg.certainCorrect, agg.certainDeclares)}
  guessed declarations ${pct(agg.guessCorrect, agg.guessDeclares)}
`);

/* ── the verdict ─────────────────────────────────────────────── */

const guessRate = agg.guessDeclares ? agg.guessCorrect / agg.guessDeclares : 0;
const certainShare = agg.declarations
  ? agg.certainDeclares / agg.declarations
  : 0;

console.log("=".repeat(52));
if (certainShare < 0.2) {
  console.log(`
  Certainty is barely reachable: only ${pct(agg.certainDeclares, agg.declarations)} of
  declarations came from knowing. Everything else was a guess,
  and guesses landed ${pct(agg.guessCorrect, agg.guessDeclares)} of the time.

  When almost no declaration is informed, the winner is decided by
  who happened to guess right — not by who read the table better.
  That is the luck problem, measured.
`);
} else if (guessRate < 0.3) {
  console.log(`
  Declarations are mostly informed (${pct(agg.certainDeclares, agg.declarations)} from
  certainty) and guesses mostly fail (${pct(agg.guessCorrect, agg.guessDeclares)}), so
  the table rewards patience over nerve. Healthy.
`);
} else {
  console.log(`
  Mixed: ${pct(agg.certainDeclares, agg.declarations)} from certainty, guesses landing
  ${pct(agg.guessCorrect, agg.guessDeclares)}.
`);
}
