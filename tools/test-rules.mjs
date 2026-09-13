import {
  createMatch,
  reduce,
  viewFor,
  deductionFor,
  PHASE,
  turnOrder,
} from "../js/rules.js";
import { roleOf, ROLES, deckFor } from "../js/cards.js";
import { botAnswer } from "../js/bots.js";

let pass = 0,
  fail = 0;
const ok = (label, cond, extra = "") => {
  cond
    ? (pass++, console.log(`  ok  ${label}`))
    : (fail++, console.log(`  FAIL ${label} ${extra}`));
};

// deterministic rng
const seeded = (s) => () =>
  (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// patch Math.random for beginRound default
const origRandom = Math.random;
Math.random = seeded(7);

console.log("\n== 1. LOBBY ==");
let s = createMatch({ targetScore: 5 });
for (const [pid, name] of [
  ["p1", "Ada"],
  ["p2", "Bram"],
  ["p3", "Cyrus"],
  ["p4", "Dena"],
]) {
  s = reduce(s, { type: "join", pid, name }).state;
}
ok("4 players joined", s.players.length === 4, `got ${s.players.length}`);
ok("still lobby", s.phase === PHASE.LOBBY);

console.log("\n== 2. DEAL ==");
s = reduce(s, { type: "start" }).state;
ok("phase = deal", s.phase === PHASE.DEAL);
ok(
  "everyone has a card",
  s.players.every((p) => p.cardId),
  JSON.stringify(s.players.map((p) => p.cardId)),
);
ok(
  "deck follows the table",
  s.pending.deckSize === deckFor(4),
  `got ${s.pending.deckSize}, deckFor(4)=${deckFor(4)}`,
);
ok("pile is capped at 4", s.pile.length === 4, `got ${s.pile.length}`);
ok(
  "everyone has 2 tokens",
  s.players.every((p) => p.tokens === 2),
);
ok(
  "every physical card is unique",
  new Set([...s.players.map((p) => p.cardId), ...s.pile]).size === deckFor(4),
);

console.log("\n== 3. VISIBILITY (the whole point) ==");
const v1 = viewFor(s, "p1");
ok(
  "p1 sees own card as null",
  v1.players.find((p) => p.pid === "p1").cardId === null,
);
ok(
  "p1 sees all 3 others",
  v1.players.filter((p) => p.pid !== "p1").every((p) => p.cardId),
);
ok(
  "p1 sees pile as a count only",
  v1.pile.count === 4 && v1.pile.length === undefined,
);
const leaked = JSON.stringify(v1).includes(
  s.players.find((p) => p.pid === "p1").cardId,
);
ok("own card id absent from the snapshot string", !leaked);

console.log("\n== 4. DEDUCTION ==");
const d = deductionFor(s, "p1");
ok("pool = pile + my own card", d.poolSize === 5, `got ${d.poolSize}`);
ok("not certain yet", d.certain === null);

console.log("\n== 5. ASK / ANSWER ==");
s = reduce(s, { type: "deal_done" }).state;
ok("phase = turn", s.phase === PHASE.TURN);
const first = turnOrder(s)[0];
const second = turnOrder(s)[1];
s = reduce(s, { type: "ask", pid: first, target: second }).state;
ok("phase = answering", s.phase === PHASE.ANSWERING);
const realRole = roleOf(s.players.find((p) => p.pid === second).cardId);
s = reduce(s, { type: "answer", pid: second, role: "queen" }).state;
ok("answer logged", s.log.length === 1 && s.log[0].answer === "queen");
ok("truth recorded internally", s.log[0].wasTrue === (realRole === "queen"));
ok(
  "truth stripped from player view",
  viewFor(s, "p3").log[0].wasTrue === undefined,
);
ok(
  "turn advanced to next player",
  turnOrder(s)[s.pending.turnIndex] !== first,
  `now ${turnOrder(s)[s.pending.turnIndex]}`,
);

console.log("\n== 6. SWAP ==");
const swapper = turnOrder(s)[s.pending.turnIndex];
const before = s.players.find((p) => p.pid === swapper).cardId;
s = reduce(s, { type: "swap", pid: swapper }).state;
const after = s.players.find((p) => p.pid === swapper).cardId;
ok("card changed", before !== after, `${before} -> ${after}`);
ok("token spent", s.players.find((p) => p.pid === swapper).tokens === 1);
ok("pile stays at 4", s.pile.length === 4);
ok("old card went to the bottom of the pile", s.pile.at(-1) === before);
ok(
  "no duplicates after swap",
  new Set([...s.players.map((p) => p.cardId), ...s.pile]).size === deckFor(4),
);

console.log("\n== 7. CORRECT DECLARE ==");
const actor = turnOrder(s)[s.pending.turnIndex];
const actorCard = s.players.find((p) => p.pid === actor).cardId;
const actorRole = roleOf(actorCard);
const pts = ROLES[actorRole].value;
s = reduce(s, { type: "declare", pid: actor, role: actorRole }).state;
ok("phase = round_end", s.phase === PHASE.ROUND_END, s.phase);
ok(
  `${actor} scored ${pts}`,
  s.players.find((p) => p.pid === actor).score === pts,
);
ok("lastRound reveal has all cards", s.lastRound.reveal.length === 4);
ok(
  "reveal includes the declarer own card",
  s.lastRound.reveal.every((r) => r.cardId),
);

console.log("\n== 8. WRONG DECLARE -> CITE -> TWO OUT, ROUND CONTINUES ==");
s = reduce(s, { type: "next_round" }).state;
s = reduce(s, { type: "deal_done" }).state;
const d1 = turnOrder(s)[s.pending.turnIndex];
const d2 = turnOrder(s)[1];
const wrongRole =
  d1 === d2
    ? "fool"
    : roleOf(s.players.find((p) => p.pid === d1).cardId) === "queen"
      ? "fool"
      : "queen";
s = reduce(s, { type: "declare", pid: d1, role: wrongRole }).state;
ok("phase = citing", s.phase === PHASE.CITING, s.phase);
const target = turnOrder(s).find((p) => p !== d1);
s = reduce(s, { type: "cite", pid: d1, source: target }).state;
ok("declarer out", s.players.find((p) => p.pid === d1).out === true);
ok("cited player out", s.players.find((p) => p.pid === target).out === true);
ok("phase = turn (round continues)", s.phase === PHASE.TURN, s.phase);
ok(
  "turn order now skips the dead",
  turnOrder(s).length === 2,
  `alive order = ${JSON.stringify(turnOrder(s))}`,
);

console.log("\n== 9. SILENT CIRCUIT -> SIMULTANEOUS DECLARE ==");
s = reduce(s, { type: "next_round" }).state;
s = reduce(s, { type: "deal_done" }).state;
let guard = 0;
while (s.phase === PHASE.TURN && guard++ < 40) {
  const me = turnOrder(s)[s.pending.turnIndex];
  const them = turnOrder(s).find((p) => p !== me);
  s = reduce(s, { type: "ask", pid: me, target: them }).state;
  s = reduce(s, { type: "answer", pid: them, role: "fool" }).state;
}
ok(
  "simultaneous phase reached",
  s.phase === PHASE.SIMUL,
  `phase=${s.phase} after ${guard} turns`,
);
const alive = turnOrder(s);
for (const pid of alive)
  s = reduce(s, { type: "declare", pid, role: "fool" }).state;
ok("simul resolved to round_end", s.phase === PHASE.ROUND_END, s.phase);
ok(
  "simul results recorded",
  Array.isArray(s.pending.simulResults),
  JSON.stringify(s.pending.simulResults),
);

// Regression: resolveSimul used to return straight to ROUND_END without
// calling endRound, so lastRound stayed null and the results screen opened
// empty. Anything that reaches ROUND_END must be able to describe itself.
ok("lastRound exists after a simultaneous declaration", !!s.lastRound);
ok(
  "lastRound reveals every card",
  (s.lastRound?.reveal ?? []).length === 4,
  JSON.stringify(s.lastRound?.reveal),
);
ok(
  "lastRound covers every seat",
  new Set((s.lastRound?.reveal ?? []).map((r) => r.pid)).size === 4,
);

console.log("\n== 10. MATCH END ==");
let m = createMatch({ targetScore: 3 });
for (const [pid, name] of [
  ["a", "A"],
  ["b", "B"],
  ["c", "C"],
])
  m = reduce(m, { type: "join", pid, name }).state;
Math.random = seeded(99);
let rounds = 0;
while (m.phase !== PHASE.MATCH_END && rounds++ < 30) {
  m = reduce(m, { type: m.round === 0 ? "start" : "next_round" }).state;
  m = reduce(m, { type: "deal_done" }).state;
  let g = 0;
  while (
    m.phase !== PHASE.ROUND_END &&
    m.phase !== PHASE.MATCH_END &&
    g++ < 80
  ) {
    if (m.phase === PHASE.TURN) {
      const me = turnOrder(m)[m.pending.turnIndex];
      if (!me) break;
      const myRole = roleOf(m.players.find((p) => p.pid === me).cardId);
      m = reduce(m, { type: "declare", pid: me, role: myRole }).state; // perfect play
    } else if (m.phase === PHASE.ANSWERING) {
      m = reduce(m, {
        type: "answer",
        pid: m.pending.target,
        role: "monk",
      }).state;
    } else break;
  }
}
ok(
  "match reached MATCH_END",
  m.phase === PHASE.MATCH_END,
  `${m.phase} after ${rounds} rounds`,
);
ok("a winner exists", !!m.winner, m.winner);
ok(
  "winner is at or above target",
  m.players.find((p) => p.pid === m.winner).score >= 3,
);
console.log(
  `      winner: ${m.players.find((p) => p.pid === m.winner).name} @ ${m.players.find((p) => p.pid === m.winner).score} pts in ${rounds} rounds`,
);

console.log("\n== 11. AN ANSWER DESCRIBES THE ASKER, NOT THE ANSWERER ==");
// "what am I?" is a question the ASKER cannot answer about themselves.
// This was wrong in three layers at once: the engine, the bot, and the
// citation UI all treated the answer as being about the answerer.
s = reduce(s, { type: "next_round" }).state;
s = reduce(s, { type: "deal_done" }).state;

const askerPid = turnOrder(s)[s.pending.turnIndex];
const answererPid = turnOrder(s).find((p) => p !== askerPid);
const askerCard = s.players.find((p) => p.pid === askerPid).cardId;
const answererCard = s.players.find((p) => p.pid === answererPid).cardId;
const askerRole = roleOf(askerCard);
const answererRole = roleOf(answererCard);

s = reduce(s, { type: "ask", pid: askerPid, target: answererPid }).state;
s = reduce(s, { type: "answer", pid: answererPid, role: askerRole }).state;
ok(
  "naming the ASKER's real role counts as true",
  s.log.at(-1).wasTrue === true,
  `answered ${askerRole}, asker really was ${askerRole}, got wasTrue=${s.log.at(-1).wasTrue}`,
);

// If the two differ, naming the answerer's own role must count as a lie.
if (askerRole !== answererRole) {
  let s2 = reduce(s, { type: "force_circuit_end" }).state;
  s2 = s;
  while (s2.phase !== PHASE.TURN) s2 = reduce(s2, { type: "deal_done" }).state;
  const a2 = turnOrder(s2)[s2.pending.turnIndex];
  const b2 = turnOrder(s2).find((p) => p !== a2);
  const b2Role = roleOf(s2.players.find((p) => p.pid === b2).cardId);
  const a2Role = roleOf(s2.players.find((p) => p.pid === a2).cardId);
  if (a2Role !== b2Role) {
    s2 = reduce(s2, { type: "ask", pid: a2, target: b2 }).state;
    s2 = reduce(s2, { type: "answer", pid: b2, role: b2Role }).state;
    ok(
      "naming the ANSWERER's own role is not automatically true",
      s2.log.at(-1).wasTrue === (b2Role === a2Role),
      `answerer said their own role ${b2Role}; asker was ${a2Role}`,
    );
  } else {
    console.log("  ok  (skipped: asker and answerer drew the same role)");
  }
} else {
  console.log("  ok  (skipped: asker and answerer drew the same role)");
}

// The bot must give the ASKER's role when it decides to be honest.
let botState = reduce(s, { type: "next_round" }).state;
botState = reduce(botState, { type: "deal_done" }).state;
const bAsker = turnOrder(botState)[botState.pending.turnIndex];
const bTarget = turnOrder(botState).find((p) => p !== bAsker);
const bAskerRole = roleOf(
  botState.players.find((p) => p.pid === bAsker).cardId,
);
botState = reduce(botState, {
  type: "ask",
  pid: bAsker,
  target: bTarget,
}).state;
const alwaysTruthful = () => 0;
const honest = botAnswer(botState, bTarget, bAsker, alwaysTruthful);
ok(
  "a truthful bot names the ASKER's role",
  honest === bAskerRole,
  `bot said ${honest}, asker really was ${bAskerRole}`,
);

console.log("\n== 12. THE PILE IS CAPPED, ON EVERY TABLE SIZE ==");
// The single number that decides whether this game is skill or luck.
// Your own face is one of (pile + 1) cards you cannot see. If that
// grows with the table, no amount of asking can ever close it and
// every round collapses into a blind simultaneous guess.
for (const n of [3, 4, 5, 6, 8]) {
  let t = createMatch({ targetScore: 8 });
  const addOne = (st, i) =>
    reduce(st, { type: "join", pid: `q${i}`, name: `Q${i}` }).state;
  for (let i = 0; i < n; i++) t = addOne(t, i);
  t = reduce(t, { type: "start" }).state;
  const unseen = t.pending.deckSize - (n - 1);
  ok(
    `${n} players: pile 4, so 1-of-5 unseen`,
    t.pile.length === 4 && unseen === 5,
    `pile=${t.pile.length} unseen=${unseen}`,
  );
}

console.log("\n== 13. TELLING THE TRUTH PAYS ==");
// Before this, an honest answer only ever helped the person asking, so
// lying was strictly better, so every answer was a lie, so asking was
// worthless. The counsel point is what makes honesty a real strategy.
//
// Built by hand rather than by playing: the mechanic reads the round
// log, so the log is the thing under test.
{
  let t = createMatch({ targetScore: 8 });
  const j = (st, pid) => reduce(st, { type: "join", pid, name: pid }).state;
  t = j(j(j(j(t, "p1"), "p2"), "p3"), "p4");
  t = reduce(t, { type: "start" }).state;
  t = reduce(t, { type: "deal_done" }).state;

  // p1 asks p2 and is told the truth about themselves.
  const p1Card = t.players.find((p) => p.pid === "p1").cardId;
  const p1Role = roleOf(p1Card);

  t = {
    ...t,
    log: [
      ...t.log,
      {
        round: t.round,
        kind: "ask",
        from: "p1",
        to: "p2",
        answer: p1Role,
        wasTrue: true,
      },
    ],
    pending: { ...t.pending, turnIndex: t.pending.order.indexOf("p1") },
    phase: PHASE.TURN,
  };

  const before = t.players.find((p) => p.pid === "p2").score;
  const { state: after, events } = reduce(t, {
    type: "declare",
    pid: "p1",
    role: p1Role,
  });
  const now = after.players.find((p) => p.pid === "p2").score;

  ok(
    "an honest answerer scores a counsel point",
    events.some((e) => e.t === "score" && e.pid === "p2" && e.points === 1) &&
      now === before + 1,
    `p2 ${before} -> ${now}, events=${events.map((e) => e.t).join(",")}`,
  );
  ok(
    "a wrong declaration pays nobody",
    (() => {
      let u = {
        ...t,
        log: t.log.map((e) => ({ ...e, wasTrue: false })),
        players: t.players.map((p) =>
          p.pid === "p1" ? { ...p, cardId: p1Card } : p,
        ),
      };
      const { events: ev2 } = reduce(u, {
        type: "declare",
        pid: "p1",
        role: p1Role,
      });
      return !ev2.some((e) => e.t === "score" && e.points === 1);
    })(),
    "a lie should not earn the liar counsel",
  );
}

console.log("\n== 14. ONE SILENT CIRCUIT IS NOT ENOUGH TO FORCE A GUESS ==");
// Information arrives at the END of your turn, and your next turn is a
// full circuit later. Firing the simul on the first silent wrap meant
// nobody ever held information on a turn they could act on — the round
// was structurally guaranteed to end in a blind guess.
{
  let t = createMatch({ targetScore: 8 });
  const j = (st, pid) => reduce(st, { type: "join", pid, name: pid }).state;
  t = j(j(j(j(t, "p1"), "p2"), "p3"), "p4");
  t = reduce(t, { type: "start" }).state;
  t = reduce(t, { type: "deal_done" }).state;

  let simulAtTurn = null;
  let turns = 0;
  let guard = 0;
  while (t.phase === PHASE.TURN && guard++ < 20) {
    const who = turnOrder(t)[t.pending.turnIndex];
    const target = turnOrder(t).find((p) => p !== who);
    t = reduce(t, { type: "ask", pid: who, target }).state;
    turns += 1;
    if (t.phase === PHASE.ANSWERING)
      t = reduce(t, { type: "answer", pid: target, role: "fool" }).state;
    if (t.phase === PHASE.SIMUL && simulAtTurn === null) simulAtTurn = turns;
  }
  // 4 seats, so one circuit is 4 turns. The simul must NOT fire at 4 —
  // that is the window in which a player finally acts on what they were
  // told on their previous turn.
  ok(
    "silence survives the first full circuit",
    simulAtTurn !== null && simulAtTurn > 4,
    `simul fired after ${simulAtTurn} turns (one circuit = 4)`,
  );
  ok(
    "and the table gives up on the second",
    simulAtTurn !== null && simulAtTurn <= 9,
    `simul fired after ${simulAtTurn} turns`,
  );
}

console.log(
  `\n${"=".repeat(46)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(46)}`,
);
Math.random = origRandom;
process.exit(fail ? 1 : 0);
