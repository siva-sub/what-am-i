/* ─────────────────────────────────────────────────────────────
   rules.js — the referee.

   Pure state machine. No DOM, no network, no timers. Feed it the
   current state and one action, get back the next state and a list
   of events describing what the table just watched happen.

   The host runs this. Everyone else sends intents and receives the
   resulting snapshot. Keeping it pure means the same code runs a
   networked match, a practice game against bots, and the tests.

   The three rules everything else orbits:

     1. You can read every card but your own.
     2. A lie is punished by citation — declare wrong and name your
        source, and your source goes out with you.
     3. Tell the truth and lose, lie and risk elimination, say
        nothing and nobody wins.
   ───────────────────────────────────────────────────────────── */

import { CARDS, ROLES, deckFor, valueOf, roleOf } from "./cards.js";

export const START_TOKENS = 2;
/* Eight, not five.

   With the deck now capped at a four-card pile the top card in play is
   a Monk or so, and a target of five was reachable in a single lucky
   declaration. At target 8 a match runs about five rounds, which is
   long enough for a read on who lies to you to be worth something. */
export const DEFAULT_TARGET = 8;

export const PHASE = {
  LOBBY: "lobby",
  DEAL: "deal",
  TURN: "turn",
  ANSWERING: "answering",
  CITING: "citing",
  SIMUL: "simul",
  ROUND_END: "round_end",
  MATCH_END: "match_end",
};

/* ── setup ──────────────────────────────────────────────────── */

export const createMatch = (config = {}) => ({
  phase: PHASE.LOBBY,
  targetScore: config.targetScore ?? DEFAULT_TARGET,
  /* "No-declaration opening" — nobody may declare during the first
     circuit. Forces information trading before anyone can win. */
  noDeclareFirstCircuit: config.noDeclareFirstCircuit ?? false,
  round: 0,
  players: [],
  pile: [],
  log: [],
  pending: null,
  lastRound: null,
  winner: null,
});

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const seatPlayers = (state) =>
  [...state.players].sort((a, b) => a.seat - b.seat);

export const playerAt = (state, pid) =>
  state.players.find((p) => p.pid === pid);

export const activePlayer = (state) => {
  const order = turnOrder(state);
  return order[state.pending?.turnIndex ?? 0];
};

/* Turn order skips anyone who is out, and is recomputed each turn
   so an elimination does not strand the rotation. */
export const turnOrder = (state) => state.pending?.order ?? [];

const nextAlive = (state, fromPid) => {
  const seated = seatPlayers(state).filter((p) => !p.out);
  if (!seated.length) return null;
  const here = seated.findIndex((p) => p.pid === fromPid);
  return seated[(here + 1) % seated.length].pid;
};

/* ── dealing ────────────────────────────────────────────────── */

export function beginRound(state, rng = Math.random) {
  const seated = seatPlayers(state);
  const deckSize = deckFor(seated.length);
  const deck = shuffle(CARDS.slice(0, deckSize), rng);

  const hands = deck.slice(0, seated.length);
  const pile = deck.slice(seated.length);

  const players = state.players.map((p) => {
    const card = hands[seated.findIndex((s) => s.pid === p.pid)];
    return {
      ...p,
      cardId: card?.id ?? null,
      tokens: START_TOKENS,
      out: false,
      roundScore: 0,
      outReason: null,
    };
  });

  const first = seated[0].pid;

  return {
    ...state,
    phase: PHASE.DEAL,
    round: state.round + 1,
    players,
    pile,
    log: [],
    lastRound: null,
    pending: {
      order: seated.map((p) => p.pid),
      turnIndex: 0,
      circuit: 1,
      firstSpeaker: first,
      declaredThisCircuit: false,
      deckSize,
    },
  };
}

export const startTurn = (state, events = []) => {
  const alive = state.players.filter((p) => !p.out);
  if (!alive.length) return endRound(state, events, null);
  return { ...state, phase: PHASE.TURN };
};

/* ── asking ─────────────────────────────────────────────────── */

const doAsk = (state, pid, targetPid, events) => {
  if (state.phase !== PHASE.TURN) return state;
  const me = playerAt(state, pid);
  const target = playerAt(state, targetPid);

  if (!me || !target || me.out || target.out || target.pid === me.pid)
    return state;

  events.push({ t: "ask", from: pid, to: targetPid });

  return {
    ...state,
    phase: PHASE.ANSWERING,
    pending: { ...state.pending, asker: pid, target: targetPid },
  };
};

/* The answer is a role name, not a card. So "Guard" is a legal
   answer whether or not it is true. */
const doAnswer = (state, pid, roleId, events) => {
  if (state.phase !== PHASE.ANSWERING) return state;
  if (state.pending.target !== pid) return state;
  if (!ROLES[roleId]) return state;

  const asker = state.pending.asker;

  /* The question was "what am I?". It is the ASKER who cannot see their
     own card, so a truthful answer describes the asker — not the person
     doing the answering. Computing this from `pid` recorded whether the
     answerer had accurately described themselves, which is not the
     question anybody asked. */
  const truth = roleOf(playerAt(state, asker)?.cardId);

  events.push({ t: "answer", from: pid, to: asker, role: roleId, truth });

  return afterTurn(
    {
      ...state,
      log: [
        ...state.log,
        {
          round: state.round,
          circuit: state.pending.circuit,
          kind: "ask",
          from: asker,
          to: pid,
          answer: roleId,
          /* Stripped before it reaches any player — see viewFor(). */
          wasTrue: roleId === truth,
        },
      ],
    },
    events,
  );
};

/* ── swapping ───────────────────────────────────────────────── */

const doSwap = (state, pid, events) => {
  if (state.phase !== PHASE.TURN) return state;
  const me = playerAt(state, pid);
  if (!me || me.out) return state;
  if (me.tokens <= 0) return state;
  if (!state.pile.length) return state;

  /* Push yours face-down onto the bottom, draw the top. The table
     watches you change identity. You do not. */
  const pile = [...state.pile];
  const drawn = pile.shift();
  pile.push(me.cardId);

  events.push({ t: "swap", pid });

  const next = afterTurn(
    {
      ...state,
      pile,
      players: state.players.map((p) =>
        p.pid === pid ? { ...p, cardId: drawn.id, tokens: p.tokens - 1 } : p,
      ),
      log: [
        ...state.log,
        {
          round: state.round,
          circuit: state.pending.circuit,
          kind: "swap",
          from: pid,
        },
      ],
    },
    events,
  );

  return next;
};

/* ── declaring ──────────────────────────────────────────────── */

const canDeclare = (state) => {
  if (state.noDeclareFirstCircuit && state.pending.circuit === 1) return false;
  return true;
};

const doDeclare = (state, pid, roleId, events) => {
  const me = playerAt(state, pid);
  if (!me || me.out) return state;

  const correct = roleOf(me.cardId) === roleId;

  if (state.phase === PHASE.SIMUL) {
    /* Simultaneous declarations are collected, then opened together. */
    const picks = { ...(state.pending.picks ?? {}), [pid]: roleId };
    const waiting = seatPlayers(state).filter(
      (p) => !p.out && !(p.pid in picks),
    );

    events.push({ t: "simul_pick", pid });

    if (waiting.length) {
      return { ...state, pending: { ...state.pending, picks } };
    }
    return resolveSimul(state, picks, events);
  }

  if (state.phase !== PHASE.TURN) return state;
  if (!canDeclare(state)) return state;

  events.push({ t: "declare", pid, role: roleId, correct });

  if (correct) {
    const points = valueOf(me.cardId);
    events.push({ t: "declare", pid, role: roleId, correct: true });
    events.push({ t: "score", pid, points });

    /* Good counsel pays.

       Everyone who answered this player honestly THIS round scores a
       point for it. Without this, telling the truth only ever helps the
       person asking, so lying is strictly better, so every answer is a
       lie, so asking is worthless and the round is a guess. Paying the
       answerer makes honesty a strategy in its own right and leaves the
       lie as the deviant move — which is what the citation step is for.

       The bot logic still makes people lie to whoever is about to win,
       so the table politics survive. */
    const counsellors = [
      ...new Set(
        state.log
          .filter(
            (e) =>
              e.kind === "ask" &&
              e.round === state.round &&
              e.from === pid &&
              e.wasTrue === true,
          )
          .map((e) => e.to),
      ),
    ].filter((c) => {
      const p = playerAt(state, c);
      return p && !p.out;
    });

    counsellors.forEach((c) => events.push({ t: "score", pid: c, points: 1 }));

    const scored = {
      ...state,
      log: [
        ...state.log,
        {
          round: state.round,
          kind: "declare",
          from: pid,
          role: roleId,
          correct: true,
        },
      ],
      players: state.players.map((p) =>
        p.pid === pid
          ? {
              ...p,
              roundScore: p.roundScore + points,
              score: p.score + points,
            }
          : counsellors.includes(p.pid)
            ? { ...p, roundScore: p.roundScore + 1, score: p.score + 1 }
            : p,
      ),
    };

    return endRound(scored, events, pid);
  }

  /* Wrong. The declarer is out, and now must name whoever misled
     them. They never learn what they actually held. */
  return {
    ...state,
    phase: PHASE.CITING,
    pending: { ...state.pending, citer: pid, declaredRole: roleId },
  };
};

/* A wrong declaration removes two people and then — crucially —
   play carries on. The round only ends on a correct declaration or
   on a full silent circuit. */
const doCite = (state, pid, sourcePid, events) => {
  if (state.phase !== PHASE.CITING) return state;
  if (state.pending.citer !== pid) return state;
  if (sourcePid && sourcePid !== "nobody" && !playerAt(state, sourcePid))
    return state;

  const victims = [pid];
  const cited =
    sourcePid && sourcePid !== "nobody" ? playerAt(state, sourcePid) : null;
  if (cited && !cited.out) victims.push(cited.pid);

  events.push({ t: "cite", from: pid, source: sourcePid });
  victims.forEach((v) =>
    events.push({
      t: "eliminated",
      pid: v,
      why:
        v === pid
          ? "declared wrong"
          : `cited by ${playerAt(state, pid)?.name ?? "a player"}`,
    }),
  );

  const marked = {
    ...state,
    log: [
      ...state.log,
      {
        round: state.round,
        kind: "declare",
        from: pid,
        role: state.pending.declaredRole,
        correct: false,
      },
      { round: state.round, kind: "cite", from: pid, source: sourcePid },
    ],
    players: state.players.map((p) =>
      victims.includes(p.pid) ? { ...p, out: true, outReason: "cited" } : p,
    ),
    /* A declaration happened, so the silent-circuit clock restarts. */
    pending: { ...state.pending, declaredThisCircuit: true },
  };

  if (!marked.players.some((p) => !p.out)) {
    events.push({ t: "round_void" });
    return endRound(marked, events, null);
  }

  return afterTurn(marked, events);
};

/* ── simultaneous declarations ──────────────────────────────── */

const resolveSimul = (state, picks, events) => {
  const seated = seatPlayers(state).filter((p) => !p.out);

  const results = seated.map((p) => ({
    pid: p.pid,
    picked: picks[p.pid] ?? null,
    actual: roleOf(p.cardId),
    correct: roleOf(p.cardId) === picks[p.pid],
  }));

  events.push({ t: "simul_open", results });

  const right = seated.filter((p) => roleOf(p.cardId) === picks[p.pid]);
  const wrong = seated.filter((p) => roleOf(p.cardId) !== picks[p.pid]);

  let scored;

  if (right.length) {
    const points = new Map(right.map((p) => [p.pid, valueOf(p.cardId)]));
    points.forEach((pts, pid) => events.push({ t: "score", pid, points: pts }));
    scored = {
      ...state,
      players: state.players.map((p) =>
        points.has(p.pid)
          ? {
              ...p,
              roundScore: points.get(p.pid),
              score: p.score + points.get(p.pid),
            }
          : p,
      ),
    };
  } else {
    /* Nobody correct: the round goes to the pile worth nothing, and
       everyone who was wrong is out. */
    const outed = new Set(wrong.map((p) => p.pid));
    events.push({ t: "round_void" });
    scored = {
      ...state,
      players: state.players.map((p) =>
        outed.has(p.pid)
          ? { ...p, out: true, outReason: "simultaneous declaration" }
          : p,
      ),
    };
  }

  /* Route through endRound the way every other ending does. Returning
     straight to ROUND_END skipped building lastRound, so the results
     screen opened with nothing to put in it and showed its placeholder
     dashes instead of the cards. */
  return endRound(
    { ...scored, pending: { ...state.pending, simulResults: results } },
    events,
    right.length ? right[0].pid : null,
  );
};

/* ── ending ─────────────────────────────────────────────────── */

/* Round ends only when somebody is right. Anyone still standing
   keeps the points they banked earlier in the match; roundScore is
   just this round's tally. */
function endRound(state, events, winnerPid) {
  const seated = seatPlayers(state);
  const scores = seated.map((p) => ({ pid: p.pid, scored: p.roundScore }));

  events.push({ t: "round_end", scores, winnerPid });

  const champion = state.players.find((p) => p.score >= state.targetScore);

  return {
    ...state,
    phase: champion ? PHASE.MATCH_END : PHASE.ROUND_END,
    winner: champion?.pid ?? null,
    lastRound: {
      round: state.round,
      winnerPid,
      /* Now — and only now — does everyone get to see every card,
         including the one they were wearing. */
      reveal: seated.map((p) => ({
        pid: p.pid,
        cardId: p.cardId,
        role: roleOf(p.cardId),
      })),
      scores,
    },
  };
}

/* A full circuit with no declaration does NOT end the round.

   It used to, and that made the game unwinnable by skill. A player's
   information arrives at the END of their own turn — they ask, they
   are answered, and only then do they know anything. Their next turn
   is a full circuit later. So firing the simultaneous declaration on
   the first wrap guaranteed that nobody ever held information on the
   turn they were allowed to act on it: every round collapsed into a
   blind guess, and the match was decided by who guessed right.

   Giving people a second circuit means turn one is asking and turn
   two is acting on the answer, which is the loop the whole design is
   built around. */
export const SILENT_CIRCUITS_BEFORE_SIMUL = 2;

const advanceTurn = (state) => {
  const alive = seatPlayers(state)
    .filter((p) => !p.out)
    .map((p) => p.pid);

  if (!alive.length) {
    return {
      pending: {
        ...state.pending,
        order: [],
        turnIndex: 0,
        circuit: state.pending.circuit,
      },
      triggerSimul: false,
    };
  }

  const current = state.pending.order[state.pending.turnIndex];

  /* If the player who opened the circuit has since been eliminated,
     the circuit has to close on somebody else or the round can never
     reach its simultaneous-declaration ending. */
  let firstSpeaker = state.pending.firstSpeaker;
  if (!alive.includes(firstSpeaker)) firstSpeaker = alive[0];

  const seatAfter = nextAlive(state, current);
  const wrapped = seatAfter === firstSpeaker;
  let circuit = state.pending.circuit;
  let silentCircuits = state.pending.silentCircuits ?? 0;
  let triggerSimul = false;

  if (wrapped) {
    circuit += 1;
    /* A full circuit with no declaration. At a table this is a
       handshake; online it has to be automatic, because nobody can
       read the room over a socket. But it takes more than one silent
       lap before the room is out of ideas — see
       SILENT_CIRCUITS_BEFORE_SIMUL. */
    if (!state.pending.declaredThisCircuit) {
      const silent = (state.pending.silentCircuits ?? 0) + 1;
      if (silent >= SILENT_CIRCUITS_BEFORE_SIMUL) triggerSimul = true;
      else silentCircuits = silent;
    }
  }

  return {
    pending: {
      ...state.pending,
      order: alive,
      firstSpeaker,
      turnIndex: Math.max(0, alive.indexOf(seatAfter)),
      circuit,
      silentCircuits,
      /* A declaration resets the silent-lap clock. */
      declaredThisCircuit: wrapped ? false : state.pending.declaredThisCircuit,
    },
    triggerSimul,
  };
};

/* Every action that ends a turn routes through here, so the circuit
   counter and the simultaneous-declaration trigger stay in one place. */
const afterTurn = (state, events) => {
  const { pending, triggerSimul } = advanceTurn(state);
  if (triggerSimul) {
    events.push({ t: "simul_begin" });
    return { ...state, phase: PHASE.SIMUL, pending: { ...pending, picks: {} } };
  }
  return { ...state, phase: PHASE.TURN, pending };
};

/**
 * The exact deck this table is playing with, before anything is dealt.
 *
 * Deduction needs this and it was never shown. "I can see two Fools and
 * there are only two Fools in this deck, so I am not a Fool" is the
 * single most useful thought a player can have, and it is unreachable
 * unless they know the deck. Without the manifest the table is guessing
 * at a pool it has never been told.
 */
export function deckManifestFor(state) {
  const seated = seatPlayers(state);
  const deckSize = state.pending?.deckSize ?? deckFor(seated.length);
  const deck = CARDS.slice(0, deckSize);

  const counts = {};
  deck.forEach((c) => {
    counts[c.role] = (counts[c.role] ?? 0) + 1;
  });

  return {
    deckSize,
    players: seated.length,
    pileSize: Math.max(0, deckSize - seated.length),
    targetScore: state.targetScore ?? DEFAULT_TARGET,
    roles: Object.entries(counts)
      .map(([role, count]) => ({
        role,
        count,
        value: ROLES[role]?.value ?? 0,
      }))
      .sort((a, b) => a.value - b.value),
  };
}

/**
 * What each role could still be, in full: how many exist, how many you
 * can see, and therefore how many could be on your own forehead.
 *
 * `deductionFor` gave the remaining pool; this gives the reasoning that
 * produces it, so a player can check the arithmetic rather than trust a
 * number.
 */
export function accountingFor(state, pid) {
  const manifest = deckManifestFor(state);
  const seated = seatPlayers(state);

  const visibleCount = {};
  seated
    .filter((p) => p.pid !== pid && p.cardId)
    .forEach((p) => {
      const r = roleOf(p.cardId);
      visibleCount[r] = (visibleCount[r] ?? 0) + 1;
    });

  let couldBeMine = 0;
  const rows = manifest.roles.map((r) => {
    const visible = visibleCount[r.role] ?? 0;
    const mine = Math.max(0, r.count - visible);
    couldBeMine += mine;
    return { ...r, visible, mine };
  });

  return { manifest, rows, couldBeMine };
}

/* ── reducer ────────────────────────────────────────────────── */

export function reduce(state, action) {
  const events = [];
  let next = state;

  switch (action.type) {
    case "join": {
      if (state.phase !== PHASE.LOBBY) break;
      if (state.players.some((p) => p.pid === action.pid)) break;
      if (state.players.length >= 8) break;
      next = {
        ...state,
        players: [
          ...state.players,
          {
            pid: action.pid,
            name: String(action.name || "Player").slice(0, 16),
            avatar: action.avatar ?? "🜁",
            seat: state.players.length,
            score: 0,
            roundScore: 0,
            tokens: START_TOKENS,
            cardId: null,
            out: false,
            outReason: null,
            bot: !!action.bot,
          },
        ],
      };
      events.push({ t: "join", pid: action.pid, name: action.name });
      break;
    }

    case "leave": {
      if (state.phase === PHASE.LOBBY) {
        next = {
          ...state,
          players: state.players
            .filter((p) => p.pid !== action.pid)
            .map((p, i) => ({ ...p, seat: i })),
        };
      } else {
        next = {
          ...state,
          players: state.players.map((p) =>
            p.pid === action.pid ? { ...p, out: true, outReason: "left" } : p,
          ),
        };
      }
      events.push({ t: "leave", pid: action.pid });
      break;
    }

    case "start": {
      if (state.phase !== PHASE.LOBBY) break;
      if (state.players.length < 3) break;
      next = beginRound(state);
      events.push({ t: "deal", round: next.round });
      break;
    }

    case "deal_done": {
      if (state.phase !== PHASE.DEAL) break;
      next = startTurn({ ...state, phase: PHASE.TURN });
      break;
    }

    case "ask":
      next = doAsk(state, action.pid, action.target, events);
      break;
    case "answer":
      next = doAnswer(state, action.pid, action.role, events);
      break;
    case "swap":
      next = doSwap(state, action.pid, events);
      break;
    case "declare":
      next = doDeclare(state, action.pid, action.role, events);
      break;
    case "cite":
      next = doCite(state, action.pid, action.source, events);
      break;

    case "force_circuit_end": {
      /* A full circuit with no declaration: everyone declares at once. */
      if (state.phase !== PHASE.TURN) break;
      next = {
        ...state,
        phase: PHASE.SIMUL,
        pending: { ...state.pending, picks: {} },
      };
      events.push({ t: "simul_begin" });
      break;
    }

    case "next_round": {
      if (state.phase !== PHASE.ROUND_END) break;
      next = beginRound(state);
      events.push({ t: "deal", round: next.round });
      break;
    }

    case "rematch": {
      const cleared = {
        ...state,
        players: state.players.map((p) => ({ ...p, score: 0 })),
        winner: null,
        round: 0,
      };
      next = beginRound(cleared);
      events.push({ t: "deal", round: next.round });
      break;
    }

    default:
      break;
  }

  return { state: next, events };
}

/* ── per-player visibility ──────────────────────────────────── */

/**
 * The one function that makes this game work online.
 *
 * A player receives a snapshot where every OTHER player's card is
 * readable and their own is null. The pile is a count, never a
 * list. `wasTrue` is stripped from the log, because knowing which
 * answers were lies is exactly the thing you are supposed to be
 * buying with your questions.
 */
export function viewFor(state, pid) {
  const seated = seatPlayers(state);

  return {
    ...state,
    players: seated.map((p) => ({
      ...p,
      cardId: p.pid === pid ? null : p.cardId,
    })),
    pile: { count: state.pile.length },
    log: state.log.map((entry) =>
      entry.kind === "ask" ? { ...entry, wasTrue: undefined } : entry,
    ),
    /* Your own card is genuinely absent, so a curious player
       reading the socket sees nothing to cheat with. */
    lastRound:
      state.lastRound &&
      state.phase !== PHASE.ROUND_END &&
      state.phase !== PHASE.MATCH_END
        ? null
        : state.lastRound,
  };
}

/* Everything you can deduce for yourself, from what you can see. */
export function deductionFor(state, pid) {
  const seated = seatPlayers(state);
  const deckSize = state.pending?.deckSize ?? deckFor(seated.length);
  const deck = CARDS.slice(0, deckSize);

  const visible = new Set(
    seated.filter((p) => p.pid !== pid && p.cardId).map((p) => p.cardId),
  );

  const countVisible = {};
  visible.forEach((id) => {
    const role = roleOf(id);
    countVisible[role] = (countVisible[role] ?? 0) + 1;
  });

  const remaining = deck.filter((c) => !visible.has(c.id));
  const byRole = {};
  remaining.forEach((c) => {
    byRole[c.role] = (byRole[c.role] ?? 0) + 1;
  });

  return {
    deckSize,
    poolSize: remaining.length,
    byRole,
    /* If the pile is empty and every other seat is visible, your own
       card is the last one standing. That moment is the whole endgame. */
    certain: remaining.length === 1 ? roleOf(remaining[0].id) : null,
  };
}
