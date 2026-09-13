/* ─────────────────────────────────────────────────────────────
   bots.js — practice opponents.

   This matters more than it looks. What Am I? cannot be learned
   alone: the entire game is a response to other people, so a
   tutorial that explains the rules leaves you still unable to
   play. Practice mode has to be a real table.

   The bots are not pretending to be clever. They are built to
   demonstrate the three real decisions:

     1. Whether to tell the truth (cheap on a low card, ruinous on
        a high one, so they do it when it costs them least)
     2. When to gamble on a declaration
     3. Who to blame afterwards — they cite the last player whose
        answer they actually used, which is how liars get caught
   ───────────────────────────────────────────────────────────── */

import { CARDS, ROLES, deckFor, roleOf, valueOf } from "./cards.js";
import { seatPlayers } from "./rules.js";

/* ── what a bot can see ─────────────────────────────────────── */

/* Every card except its own, and not the pile. That is exactly
   what a human at the table sees, so the bots have no advantage. */
export function botKnowledge(state, pid) {
 const seated = seatPlayers(state);
 const deckSize = state.pending?.deckSize ?? deckFor(seated.length);
 const deck = CARDS.slice(0, deckSize);

 const visible = new Set(
  seated.filter((p) => p.pid !== pid && p.cardId).map((p) => p.cardId),
 );

 /* Everything on the table rules itself out. Everything else is still
    possible. */
 let unknown = deck.filter((c) => !visible.has(c.id));

 /* Now apply what people have actually told you.

    This is the step that turns asking into a strategy, and it was
    missing. The bot asked, filed the answer away, and then narrowed
    nothing — so its candidate set stayed at whatever the table started
    with, certainty was unreachable, and every round collapsed into the
    forced simultaneous declaration. Asking was pure ceremony. */
 const claims = memoryOf(pid).believed.filter((b) => b.round === state.round);
 if (claims.length) {
  const claimedRoles = new Set(claims.map((b) => b.role));
  const narrowed = unknown.filter((c) => claimedRoles.has(c.role));

  /* Only keep the narrowing if something survives it. Claims that rule
     out every card mean somebody named a role that is not even in this
     deck; reasoning on from that contradiction would be worse than
     falling back to the whole space. */
  if (narrowed.length) unknown = narrowed;
 }

 return { unknown, visible: [...visible], deckSize, claims };
}

/* ── memory ─────────────────────────────────────────────────── */

const memories = new Map();

export const memoryOf = (pid) => {
 if (!memories.has(pid)) memories.set(pid, { believed: [], swaps: 0 });
 return memories.get(pid);
};

export const clearMemories = () => memories.clear();

const remember = (pid, source) => {
 const m = memoryOf(pid);
 m.believed = [
  ...m.believed.filter((b) => b.round !== source.round),
  source,
 ].slice(-6);
};

/* ── the answer ─────────────────────────────────────────────── */

/**
 * The bot has been asked what it is. Telling the truth hands the
 * asker a win; lying risks being cited if they declare wrong.
 *
 * Truth is cheap when the card is worth little and the asker is
 * nowhere near the target. It is ruinous when the card is a Queen
 * and the asker is one point from the match.
 */
export function botAnswer(state, pid, askerPid, rng = Math.random) {
 const asker = seatPlayers(state).find((p) => p.pid === askerPid);
 if (!asker?.cardId) return "fool";

 /* The question was "what am I?", so the truthful answer is the ASKER's
    role — the one card at this table they cannot see and I can. */
 const truth = roleOf(asker.cardId);
 const cost = valueOf(asker.cardId) / 8;
 const threat = Math.min(1, asker.score / Math.max(1, state.targetScore));

 /* Truth is cheap when their card is worth little and they are nowhere
    near the target. It is ruinous when it is a Queen and they are one
    point from the match.

    The base rate matters more than it looks. An answer only carries
    information if it is usually honest, so honesty has to be the default
    and the lie has to be the exception — which is what the counsel point
    in doDeclare pays for. Lying stays the right move against the player
    about to win, and the (1 - threat) term is what keeps that alive. */
 const truthChance = 0.4 + 0.5 * (1 - cost) * (1 - threat);
 if (rng() < truthChance) return truth;

 /* Lie with a role that could plausibly still be sitting on their
    forehead — one with copies left unaccounted for. A claim nobody
    could hold is a claim that gets you cited. */
 const { unknown } = botKnowledge(state, pid);
 const options = unknown.filter((c) => c.role !== truth);
 const pool = options.length ? options : CARDS.filter((c) => c.role !== truth);

 /* Prefer a lie near the true value — a wild claim is a tell. */
 const sorted = [...pool].sort(
  (a, b) =>
   Math.abs(ROLES[a.role].value - ROLES[truth].value) -
   Math.abs(ROLES[b.role].value - ROLES[truth].value),
 );
 return sorted[Math.floor(rng() * Math.min(3, sorted.length))].role;
}

/**
 * Record that `asker` was told `role` by `source`.
 *
 * Called at the ASKER, not the answerer. The thing you can be blamed for
 * is the answer you were *given*, which is the one you might act on. What
 * you said to somebody else's question is invisible to your own card and
 * cannot have misled you about it.
 */
export function recordBelief(askerPid, sourcePid, role, round) {
 remember(askerPid, { round, source: sourcePid, role });
}

/* ── the turn ───────────────────────────────────────────────── */

/**
 * Certainty beats everything: if every other card is visible and
 * the pile is empty, the bot's own card is whatever is left, and
 * it declares.
 */
export function botDecideTurn(state, pid, rng = Math.random) {
 const { unknown } = botKnowledge(state, pid);
 const me = seatPlayers(state).find((p) => p.pid === pid);
 if (!me) return { type: "pass" };

 const alive = seatPlayers(state).filter((p) => !p.out);

 /* Solvable: declare and take the points. */
 if (unknown.length === 1) {
  return { type: "declare", role: unknown[0].role };
 }

 /* Solved by role even though not by card: every card still unaccounted
    for is the same role, so the name is certain even if the picture is
    not. With a four-card pile this is the normal way to finish — two
    honest answers usually collapse the space to one role name. */
 const rolesLeft = new Set(unknown.map((c) => c.role));
 if (rolesLeft.size === 1) {
  return { type: "declare", role: unknown[0].role };
 }

 /* Near-solvable and holding something worth stealing: gamble.
     The odds thin fast, so this stays rare. */
 const gambleOdds = 1 / Math.max(1, unknown.length);
 const best = [...unknown].sort(
  (a, b) => ROLES[b.role].value - ROLES[a.role].value,
 )[0];
 const prize = ROLES[best.role].value;

 if (
  unknown.length <= 3 &&
  prize >= 5 &&
  me.score + prize >= state.targetScore &&
  rng() < gambleOdds * 0.55
 ) {
  return { type: "declare", role: best.role };
 }

 /* Nothing to learn from a table of one. */
 if (alive.length < 2) {
  return { type: "declare", role: best.role };
 }

 /* Swap only to shed a card the table has been talking about, and
     only with a token to spare. It teaches the bot nothing, so it
     is a defensive move, not a routine one. */
 const m = memoryOf(pid);
 const pileSize = state.pile?.count ?? state.pile?.length ?? 0;
 if (me.tokens > 1 && pileSize > 0 && m.swaps < 1 && rng() < 0.12) {
  m.swaps += 1;
  return { type: "swap" };
 }

 /* Otherwise: ask the person who has told the fewest lies, or the
     one who has not been asked yet. Fresh voices are worth more
     than familiar ones. */
 const asked = new Set(
  (state.log ?? [])
   .filter((e) => e.kind === "ask" && e.from === pid)
   .map((e) => e.to),
 );
 const fresh = alive.filter((p) => p.pid !== pid && !asked.has(p.pid));
 const candidates = fresh.length ? fresh : alive.filter((p) => p.pid !== pid);

 if (!candidates.length) return { type: "declare", role: best.role };

 /* Prefer the strongest player — they are the one whose answers
     the table will act on, so pinning them down is worth most. */
 const target = [...candidates].sort((a, b) => b.score - a.score)[0];
 return { type: "ask", target: target.pid };
}

/* ── the blame ──────────────────────────────────────────────── */

/**
 * Called after a wrong declaration. A bot names whoever it
 * actually relied on. If it reasoned by elimination rather than
 * from an answer, it names nobody — and eats the loss alone.
 */
export function botCite(state, pid) {
 const m = memoryOf(pid);
 const seated = seatPlayers(state);
 const alive = seated.filter((p) => !p.out && p.pid !== pid);

 const usable = m.believed.filter(
  (b) => b.round === state.round && alive.some((p) => p.pid === b.source),
 );

 if (!usable.length) return "nobody";

 /* Blame the most recent answer it acted on. */
 return usable.at(-1).source;
}

/* ── simultaneous declaration ───────────────────────────────── */

export function botSimulPick(state, pid, rng = Math.random) {
 const { unknown } = botKnowledge(state, pid);
 if (!unknown.length) return "fool";
 if (unknown.length === 1) return unknown[0].role;

 /* Highest expected value among the plausible cards. */
 const ranked = [...unknown].sort(
  (a, b) => ROLES[b.role].value - ROLES[a.role].value,
 );
 const top = ranked.slice(0, Math.min(2, ranked.length));
 return top[Math.floor(rng() * top.length)].role;
}

/* ── table management ───────────────────────────────────────── */

const NAMES = ["Ada", "Bram", "Cyrus", "Dena", "Elias", "Fenn"];
const AVATARS = ["🜁", "🜂", "🜃", "🜄", "✦", "❦"];

/** Fill a practice table to `count` seats with bots, if it is short. */
export function fillWithBots(state, count, join) {
 let next = state;
 const humans = next.players.filter((p) => !p.bot).length;
 const needed = Math.max(0, count - Math.max(humans, next.players.length));

 for (let i = 0; i < needed; i++) {
  const seatIndex = next.players.length;
  next = join(next, {
   pid: `bot-${seatIndex}-${Math.random().toString(36).slice(2, 7)}`,
   name: NAMES[seatIndex % NAMES.length],
   avatar: AVATARS[seatIndex % AVATARS.length],
   bot: true,
  });
 }
 return next;
}
