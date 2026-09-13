/* ─────────────────────────────────────────────────────────────
   main.js — the bit that turns six modules into a game.

   Two ways to run:

     SOLO   one browser, bots for the other seats. No network at all.
            This is the onboarding path, because this game cannot be
            learned alone — every rule is a rule about other people.

     HOST   one browser is the referee. It holds the real deck, runs
            the reducer, and sends every player a snapshot with their
            own card removed. Everyone else sends intents and renders
            whatever they are given.

   The host is whoever created the room. If they leave, the round is
   abandoned rather than migrated: a player can only ever see other
   people's cards, so no other seat holds enough state to take over
   without cheating.
   ───────────────────────────────────────────────────────────── */

import { createTable } from "./table.js";
import { openRoom } from "./net.js";
import { makeRoomCode } from "./crypto.js";
import { cleanName, cleanAvatar, esc, cleanCode } from "./sanitize.js";
import { ROLE_LIST, roleName, valueOf, artUrl } from "./cards.js";
import {
  createMatch,
  reduce,
  viewFor,
  deductionFor,
  accountingFor,
  deckManifestFor,
  PHASE,
  seatPlayers,
  turnOrder,
  DEFAULT_TARGET,
} from "./rules.js";
import {
  botDecideTurn,
  botAnswer,
  botCite,
  botSimulPick,
  fillWithBots,
  clearMemories,
  recordBelief,
} from "./bots.js";
import { sfx, unlock as unlockAudio, isMuted, toggleMuted } from "./sfx.js";
import { recordMatch, summaryLine } from "./stats.js";

/* ── tiny dom helpers ───────────────────────────────────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
/**
 * Builds an element whose contents are MARKUP, not text.
 *
 * Every interpolated value passed here must already be escaped. That
 * holds because of two independent layers:
 *
 *   1. Ingress  — names and avatars are cleaned in sanitize.js the moment
 *                 they come off the network (main.js "hello" handler),
 *                 and that clean STRIPS the characters that can open
 *                 markup rather than escaping them.
 *   2. Sinks    — every remaining interpolation of a player name goes
 *                 through esc() at the point of use.
 *
 * Either layer alone would be sufficient; both are present because a
 * single missed ingress path would otherwise be enough to inject.
 * tools/test-sanitize.mjs asserts the property directly.
 *
 * textContent is not usable at the call sites that matter here: the
 * HUD prompt and the answer modal emit <b> for emphasis on purpose.
 */
const el = (tag, cls, markup) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (markup != null) node.innerHTML = markup;
  return node;
};

/**
 * Player names arrive from other people over the network and then get
 * pasted into markup all over this file, so they are stripped down to
 * something that cannot carry a tag. Cheaper and far harder to get
 * wrong than escaping at thirty separate interpolations.
 */
const show = (id) => {
  $$(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
  window.scrollTo(0, 0);
};

const modal = (id, on) => $(`#${id}`).classList.toggle("on", on);
const closeModals = () => $$(".modal").forEach((m) => m.classList.remove("on"));

let toastTimer = 0;
const toast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
};

/* ── who am I ───────────────────────────────────────────────── */

const store = {
  get name() {
    return localStorage.getItem("wami.name") || "";
  },
  set name(v) {
    localStorage.setItem("wami.name", v);
  },
  get avatar() {
    if (!localStorage.getItem("wami.avatar")) {
      const marks = ["🜁", "🜂", "🜃", "🜄", "✦", "❦", "☾", "☉"];
      localStorage.setItem(
        "wami.avatar",
        marks[Math.floor(Math.random() * marks.length)],
      );
    }
    return localStorage.getItem("wami.avatar");
  },
};

const myPid = crypto.randomUUID();

/* ── application state ──────────────────────────────────────── */

const app = {
  mode: null, // 'solo' | 'host' | 'guest'
  net: null,
  view: null, // latest snapshot for the local player
  code: null,
  hostPid: null,
  roster: [], // lobby list
  table: null,
  busy: false, // a bot or reveal timer is mid-flight
};

/* ── the referee (host and solo only) ───────────────────────── */

const referee = {
  match: createMatch({ targetScore: DEFAULT_TARGET }),
  timers: [],

  clear() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  },

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  },

  /** Apply one action, fan the new state out, and keep the bots moving. */
  dispatch(action) {
    /* A bot that has just been given an answer to its own question should
       remember it, because that is the answer it can be blamed for later.
       Recording it here, at the asker, is what makes citation land on the
       bot that actually misled somebody. */
    if (action.type === "answer") {
      const asker = this.match.pending?.asker;
      if (asker && this.match.players.find((p) => p.pid === asker)?.bot) {
        recordBelief(asker, action.pid, action.role, this.match.round);
      }
    }

    const { state, events } = reduce(this.match, action);
    if (state === this.match && !events.length) return;

    this.match = state;

    /* The host and the solo player are also players. broadcastViews()
       deliberately skips this seat — it only feeds other people — so
       without this the local view freezes on whatever it was when the
       room opened and the table never leaves the lobby state. */
    if (app.mode !== "guest") {
      app.view = viewFor(this.match, myPid);
      playEvents(events);
      render();
    }

    broadcast(events);
    broadcastViews();
    this.tick();
  },

  /** Is anybody waiting on a timer or a bot? Start them. */
  tick() {
    const s = this.match;
    this.clear();

    if (s.phase === PHASE.DEAL) {
      /* The deal is a button now, not a 1.5s pause. It is the moment the
         whole table learns the deck, so it is worth being deliberate —
         but there is still a fallback, because a host who walks away
         should not be able to stall the room. */
      this.later(() => this.dispatch({ type: "deal_done" }), 20000);
      return;
    }

    const active = turnOrder(s)[s.pending?.turnIndex ?? 0];
    const isBot = (pid) => s.players.find((p) => p.pid === pid)?.bot;

    if (s.phase === PHASE.TURN && isBot(active)) {
      this.later(
        () => {
          const move = botDecideTurn(this.match, active);
          if (move.type === "ask")
            this.dispatch({ type: "ask", pid: active, target: move.target });
          else if (move.type === "swap")
            this.dispatch({ type: "swap", pid: active });
          else if (move.type === "declare")
            this.dispatch({ type: "declare", pid: active, role: move.role });
        },
        1100 + Math.random() * 900,
      );
      return;
    }

    if (s.phase === PHASE.ANSWERING && isBot(s.pending.target)) {
      this.later(
        () => {
          const role = botAnswer(this.match, s.pending.target, s.pending.asker);
          this.dispatch({ type: "answer", pid: s.pending.target, role });
        },
        900 + Math.random() * 800,
      );
      return;
    }

    if (s.phase === PHASE.CITING && isBot(s.pending.citer)) {
      this.later(() => {
        this.dispatch({
          type: "cite",
          pid: s.pending.citer,
          source: botCite(this.match, s.pending.citer),
        });
      }, 1400);
      return;
    }

    if (s.phase === PHASE.SIMUL) {
      const picks = s.pending.picks ?? {};
      const waitingBot = seatPlayers(s).find(
        (p) => !p.out && p.bot && !(p.pid in picks),
      );
      if (waitingBot) {
        this.later(
          () => {
            this.dispatch({
              type: "declare",
              pid: waitingBot.pid,
              role: botSimulPick(this.match, waitingBot.pid),
            });
          },
          1000 + Math.random() * 700,
        );
      }
    }
  },
};

/* ── network ────────────────────────────────────────────────── */

/** Local player's own view, so solo and host share one render path. */
const localView = () => viewFor(referee.match, myPid);

function broadcastViews() {
  if (app.mode === "solo") return;
  app.roster.forEach((p) => {
    if (p.pid === myPid) return;
    app.net?.sendTo(p.pid, { k: "view", state: viewFor(referee.match, p.pid) });
  });
}

function broadcast(events) {
  if (app.mode === "solo" || !events.length) return;
  app.net.send({ k: "events", events });
}

function receive(msg) {
  switch (msg.k) {
    case "hello": {
      if (app.mode !== "host") break;
      app.net.trust(msg.pid, msg.pub);
      /* msg.name comes off the wire from another human. Strip it here,
         once, so nothing downstream has to think about it. */
      const name = cleanName(msg.name) || "Player";
      const avatar = cleanAvatar(msg.avatar);
      app.roster = [
        ...app.roster.filter((p) => p.pid !== msg.pid),
        { pid: msg.pid, name, avatar, bot: false },
      ];
      referee.dispatch({
        type: "join",
        pid: msg.pid,
        name,
        avatar,
      });
      sendRoster();
      break;
    }

    case "roster": {
      /* This runs for EVERYONE, host and guest alike.

           It used to be gated on `app.mode === "host"`, which meant a
           guest received the roster and threw it away — and with it the
           host's public key. Without that key the guest has no entry in
           pairKeys, and the transport drops unopenable envelopes without
           a word: `if (!key) return;` in net.js.

           So every private snapshot the host sent was silently discarded
           and a joining player was never let into the game. The failure
           looked like the host starting without them, which is exactly
           what it was. */
      msg.players.forEach((p) => app.net.trust(p.pid, p.pub));
      app.roster = msg.players;
      renderLobby();
      break;
    }

    case "view": {
      if (app.mode !== "guest") break;
      app.view = msg.state;
      render();
      break;
    }

    case "events": {
      if (app.mode !== "guest") break;
      playEvents(msg.events);
      break;
    }

    case "intent": {
      if (app.mode !== "host") break;
      referee.dispatch(msg.action);
      break;
    }

    case "bye": {
      if (app.mode !== "host") break;
      app.roster = app.roster.filter((p) => p.pid !== msg.pid);
      sendRoster();
      break;
    }

    default:
      break;
  }
}

const sendRoster = () => {
  app.net?.send({
    k: "roster",
    hostPid: myPid,
    players: app.roster.map((p) => ({
      ...p,
      pub: p.pid === myPid ? app.net.pub : undefined,
    })),
  });
};

/** Guest and solo both funnel through here so there is one code path. */
const act = (action) => {
  if (app.mode === "guest")
    app.net.sendTo(app.hostPid, { k: "intent", action });
  else referee.dispatch(action);
};

/* ── rendering ──────────────────────────────────────────────── */

let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    draw();
  });
}

function draw() {
  const s = app.view;
  if (!s) return;

  /* A guest never presses Start, so nothing ever moved it off the lobby.

     It received the game state perfectly well and rendered it into HUD
     elements that were not on screen, which made the failure look like
     the host starting without them rather than a missing transition.
     Any phase past the lobby means a game is running, so the table is
     the right screen whichever seat you are in. */
  if (s.phase !== PHASE.LOBBY && !$("#table-screen").classList.contains("on")) {
    openTable();
  }

  const seated = seatPlayers(s);
  const me = seated.find((p) => p.pid === myPid);
  const activePid =
    s.phase === PHASE.TURN ? turnOrder(s)[s.pending?.turnIndex ?? 0] : null;
  const myTurn = activePid === myPid;

  app.table?.setView(s, myPid);

  /* round + scores */
  $("#hud-round").textContent = s.round || 1;
  $("#hud-circuit").textContent =
    s.phase === PHASE.SIMUL
      ? "everyone declares at once"
      : `circuit ${s.pending?.circuit ?? 1}`;

  const scores = $("#hud-scores");
  scores.textContent = "";
  seated.forEach((p) => {
    const chip = el(
      "div",
      "score-chip" +
        (p.pid === activePid ? " turn" : "") +
        (p.out ? " out" : ""),
    );
    chip.append(
      el("span", null, esc(p.avatar)),
      el("span", null, p.pid === myPid ? `${esc(p.name)} (you)` : esc(p.name)),
      el("span", "pts", String(p.score)),
    );
    scores.append(chip);
  });

  /* Markup because the prompt emphasises names in <b>. Every name it
     interpolates goes through nameOf() -> esc(), and names were already
     stripped of markup characters at ingress. See the el() contract. */
  $("#hud-prompt").innerHTML = promptFor(s, myTurn, activePid);
  drawActions(s, myTurn);
  drawDeduction(s);
  drawLog(s);

  /* modals that are driven by phase */
  drawDealVeil(s);
  modal(
    "modal-answer",
    s.phase === PHASE.ANSWERING && s.pending.target === myPid,
  );
  modal("modal-cite", s.phase === PHASE.CITING && s.pending.citer === myPid);
  modal(
    "modal-simul",
    s.phase === PHASE.SIMUL && !s.players.find((p) => p.pid === myPid)?.out,
  );

  /* One-shot on the transition into MATCH_END, not on every frame the
     modal happens to be up. Without this guard the win sting retriggers
     and the record books itself once per render. */
  if (s.phase === PHASE.MATCH_END && app.lastPhase !== PHASE.MATCH_END) {
    sfx.win();
    recordMatch({
      won: s.winner === myPid,
      score: me?.score ?? 0,
      players: seated.length,
      rounds: s.round,
    });
  }
  app.lastPhase = s.phase;

  if (s.phase === PHASE.ROUND_END || s.phase === PHASE.MATCH_END)
    showRoundEnd(s);
  else if (!$("#modal-round").classList.contains("on")) {
    /* leave closed */
  }

  if (me && s.phase === PHASE.ROUND_END) modal("modal-round", true);
}

const nameOf = (s, pid) =>
  esc(seatPlayers(s).find((p) => p.pid === pid)?.name ?? "someone");

function promptFor(s, myTurn, activePid) {
  if (s.phase === PHASE.DEAL)
    return "Dealing… <b>the card in front of you is the one you cannot read.</b>";
  if (s.phase === PHASE.SIMUL)
    return "A full circuit passed with no declaration. <b>Everyone declares at once.</b>";
  if (s.phase === PHASE.ANSWERING) {
    /* The question was "what am I?". The asker wants to know their OWN
       card, because they are the one person who cannot see it. So the
       answer is always a claim about the asker, never about the person
       doing the answering. */
    return s.pending.target === myPid
      ? `<b>${nameOf(s, s.pending.asker)}</b> is asking what they are.`
      : `<b>${nameOf(s, s.pending.target)}</b> is deciding what to tell <b>${nameOf(s, s.pending.asker)}</b>.`;
  }
  if (s.phase === PHASE.CITING) {
    return s.pending.citer === myPid
      ? "That was not who you are. <b>Name whoever misled you.</b>"
      : `<b>${nameOf(s, s.pending.citer)}</b> has to name who misled them.`;
  }
  if (s.phase === PHASE.ROUND_END || s.phase === PHASE.MATCH_END)
    return "Round over.";
  if (myTurn) return "<b>Your turn.</b> Ask, swap, or declare.";
  if (activePid) return `Waiting for <b>${nameOf(s, activePid)}</b>.`;
  return "…";
}

function drawActions(s, myTurn) {
  const bar = $("#hud-actions");
  bar.textContent = "";
  if (!myTurn) return;

  const me = seatPlayers(s).find((p) => p.pid === myPid);
  const targets = seatPlayers(s).filter((p) => !p.out && p.pid !== myPid);

  const pick = el("button", "btn ghost sm", "Ask someone ▾");
  pick.onclick = () => {
    if (bar.dataset.picking === "1") {
      bar.dataset.picking = "0";
      draw();
      return;
    }
    bar.dataset.picking = "1";
    bar.textContent = "";
    targets.forEach((t) => {
      const b = el("button", "btn sm", `${esc(t.avatar)} ${esc(t.name)}`);
      b.onclick = () => {
        bar.dataset.picking = "0";
        act({ type: "ask", pid: myPid, target: t.pid });
      };
      bar.append(b);
    });
    const cancel = el("button", "btn ghost sm", "cancel");
    cancel.onclick = () => {
      bar.dataset.picking = "0";
      draw();
    };
    bar.append(cancel);
  };

  const swap = el("button", "btn ghost sm", `Swap card (${me?.tokens ?? 0})`);
  swap.disabled = !me?.tokens || !(s.pile?.count > 0);
  swap.onclick = () => act({ type: "swap", pid: myPid });

  const declare = el("button", "btn primary sm", "Declare who I am");
  declare.onclick = () =>
    openRolePick("declare-roles", (role) => {
      modal("modal-declare", false);
      act({ type: "declare", pid: myPid, role });
    });

  /* data-act gives the keyboard shortcuts something stable to press.
     Indexing the children by position would break the moment the bar
     renders in a different order. */
  pick.dataset.act = "ask";
  swap.dataset.act = "swap";
  declare.dataset.act = "declare";

  bar.append(pick, swap, declare);
}

function openRolePick(containerId, onPick) {
  const box = $(`#${containerId}`);
  box.textContent = "";
  ROLE_LIST.forEach((r) => {
    const b = el(
      "button",
      "role-btn",
      `<div class="v">${r.value} pt</div><div class="n">${esc(roleName(r.id))}</div>`,
    );
    b.onclick = () => onPick(r.id);
    box.append(b);
  });
  if (containerId === "declare-roles") modal("modal-declare", true);
}

/**
 * The deal, as a moment rather than a 1.5-second pause.
 *
 * This is where the table learns its deck, and it was the missing half
 * of the deduction. A player who does not know the pool cannot reason
 * "I can see both Fools, so I am not a Fool" — which is the most
 * valuable thought in the game. Showing the manifest before anything is
 * dealt is what makes the rest of the round playable by talent.
 */
function drawDealVeil(s) {
  const veil = $("#deal-veil");
  const on = s.phase === PHASE.DEAL;
  if (!on) {
    veil.classList.remove("on");
    return;
  }

  const m = deckManifestFor(s);
  veil.classList.add("on");

  $("#deal-kicker").textContent =
    `Round ${s.round || 1} \u00b7 first to ${m.targetScore}`;

  const sub = $("#deal-sub");
  sub.textContent = "";
  sub.append(
    el("b", null, `${m.deckSize} cards`),
    el(
      "span",
      null,
      ` \u2014 ${m.players} go face-out to the table, ${m.pileSize} face-down to the pile.`,
    ),
  );

  const grid = $("#deal-manifest");
  grid.textContent = "";
  m.roles.forEach((r) => {
    const item = el("div", "manifest-item");
    item.append(
      el("div", "mf-count", `\u00d7${r.count}`),
      el("div", "mf-name", roleName(r.role)),
      el("div", "mf-val", `${r.value} pt`),
    );
    grid.append(item);
  });

  /* Only the host and a solo player can advance the deal; a guest is
     waiting on the host's broadcast. */
  const go = $("#deal-go");
  const isGuest = app.mode === "guest";
  go.disabled = isGuest;
  go.textContent = isGuest
    ? "Waiting for the host to deal\u2026"
    : "Shuffle and deal";
}

function drawDeduction(s) {
  const panel = $("#deduce");
  const d = deductionFor(s, myPid);
  const a = accountingFor(s, myPid);
  const toggle = $("#deduce-toggle");

  panel.textContent = "";
  panel.append(el("h4", null, "What you actually know"));

  const seen = d.deckSize - d.poolSize;
  panel.append(
    el(
      "div",
      "deduce-line",
      `You can read <b>${seen}</b> of <b>${d.deckSize}</b> cards.`,
    ),
  );

  if (d.certain) {
    panel.append(
      el(
        "div",
        "deduce-line",
        `Nothing else is left. <b>You are the ${roleName(d.certain)}.</b>`,
      ),
    );
  } else {
    panel.append(
      el(
        "div",
        "deduce-line",
        `Yours is one of <b>${d.poolSize}</b> — the pile and your own forehead.`,
      ),
    );
  }

  /* The arithmetic, spelled out rather than summarised.

     "Two Fools exist, you can see one of them, so one Fool could be you"
     is the thought the entire game is made of, and a player can only have
     it if they can see the sum. A bare "could be yours: 5" asks them to
     trust a number they have no way to check. */
  const table = el("table", "accounting");
  const head = el("tr");
  ["Role", "In deck", "You see", "Could be you"].forEach((h) =>
    head.append(el("th", null, h)),
  );
  table.append(head);

  a.rows.forEach((r) => {
    const tr = el("tr", r.mine === 0 ? "ruled-out" : "");
    tr.append(
      el("td", null, roleName(r.role)),
      el("td", "num", String(r.count)),
      el("td", "num", String(r.visible)),
      el("td", "num mine", r.mine === 0 ? "ruled out" : String(r.mine)),
    );
    table.append(tr);
  });
  panel.append(table);

  panel.append(el("div", "deduce-line muted", r0()));

  const chips = el("div", "chips");
  Object.entries(d.byRole)
    .sort((x, y) => valueOf(x[0]) - valueOf(y[0]))
    .forEach(([role, n]) => {
      const certain = d.certain === role;
      chips.append(
        el(
          "span",
          "chip" + (certain ? " certain" : ""),
          `${roleName(role)} <b>×${n}</b>`,
        ),
      );
    });
  panel.append(chips);
  toggle.textContent = d.certain
    ? `? You are the ${roleName(d.certain)}`
    : "? What you know";
}

/* The bottom line of the accounting table. */
function r0() {
  return "Any role showing <b>ruled out</b> is one you can see every copy of — so it cannot be yours.";
}

function drawLog(s) {
  const box = $("#log");
  const entries = [...(s.log ?? [])].reverse().slice(0, 9);
  box.textContent = "";

  entries.forEach((e) => {
    const row = el("div", "log-entry");
    if (e.kind === "ask") {
      const mine = e.from === myPid;
      /* Spelled out the long way. "Bram asked what they are" is
         technically correct and hopelessly ambiguous, and the
         direction of this sentence is the entire game. */
      row.append(
        el(
          "div",
          null,
          `<span class="who">${nameOf(s, e.from)}</span> asked ` +
            `<span class="who">${nameOf(s, e.to)}</span> what ` +
            `<span class="who">${nameOf(s, e.from)}</span> is.`,
        ),
        el(
          "div",
          null,
          `<span class="who">${nameOf(s, e.to)}</span> said ` +
            `<span class="said">${roleName(e.answer)}</span>` +
            (mine ? "" : " — believe that?"),
        ),
      );
    } else if (e.kind === "swap") {
      row.append(
        el(
          "div",
          null,
          `<span class="who">${nameOf(s, e.from)}</span> swapped their card.`,
        ),
      );
      row.append(
        el("div", "muted", "The table knows what they are now. They do not."),
      );
    } else if (e.kind === "declare") {
      row.append(
        el(
          "div",
          null,
          `<span class="who">${nameOf(s, e.from)}</span> declared ` +
            `<span class="${e.correct ? "good" : "warn"}">${roleName(e.role)}</span> — ` +
            (e.correct ? "correct." : "wrong."),
        ),
      );
    } else if (e.kind === "cite") {
      row.append(
        el(
          "div",
          null,
          `<span class="warn">${nameOf(s, e.from)}</span> blamed ` +
            `<span class="who">${e.source === "nobody" ? "nobody" : nameOf(s, e.source)}</span>.`,
        ),
      );
    }
    box.append(row);
  });
}

/* ── round end ──────────────────────────────────────────────── */

function showRoundEnd(s) {
  const last = s.lastRound;
  if (!last) return;

  const iWon = last.winnerPid === myPid;
  const matchOver = s.phase === PHASE.MATCH_END;

  $("#round-kicker").textContent = matchOver
    ? "Match over"
    : `Round ${last.round} over`;
  $("#round-head").textContent = matchOver
    ? `${nameOf(s, s.winner)} takes it, ${s.players.find((p) => p.pid === s.winner)?.score} points.`
    : iWon
      ? "You had it right."
      : `${nameOf(s, last.winnerPid)} got it.`;

  $("#round-sub").textContent = matchOver
    ? "Play another?"
    : "Here is what everyone was actually holding — including you.";

  const grid = $("#round-reveal");
  grid.textContent = "";
  last.reveal.forEach((r) => {
    const item = el("div", "reveal-item");
    const mini = el("div", "mini" + (r.pid === myPid ? " you" : ""));
    mini.append(el("img", null));
    mini.querySelector("img").src = artUrl(r.cardId);
    mini.querySelector("img").alt = roleName(r.role);
    item.append(
      mini,
      el("div", "nm", nameOf(s, r.pid)),
      el("div", "rl", roleName(r.role)),
    );
    grid.append(item);
  });

  const scores = $("#round-scores");
  scores.textContent = "";
  const table = el("table");
  table.style.width = "100%";
  table.style.fontSize = "14px";
  seatPlayers(s)
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const tr = el("tr");
      tr.append(
        el("td", null, p.pid === myPid ? `${esc(p.name)} (you)` : esc(p.name)),
        el("td", null, p.out ? "out" : `+${p.roundScore}`),
        el("td", null, `<b>${p.score}</b>`),
      );
      table.append(tr);
    });
  scores.append(table);

  const record = summaryLine();
  $("#round-stats").textContent = record ? `Your record: ${record}` : "";

  $("#round-next").textContent = matchOver ? "Rematch" : "Deal the next round";
  modal("modal-round", true);
}

/* ── events → sound and motion ──────────────────────────────── */

function playEvents(events) {
  events.forEach((e) => {
    if (
      e.t === "ask" ||
      e.t === "answer" ||
      e.t === "declare" ||
      e.t === "eliminated"
    ) {
      app.table?.pulse(e.pid ?? e.from);
      app.table?.look(e.from ?? e.pid);
    }
    if (e.t === "swap") app.table?.pulse("__pile");

    /* Sound is keyed off the same events as the motion, so the two can
       never disagree about what just happened. */
    switch (e.t) {
      case "deal":
        sfx.deal();
        break;
      case "ask":
        sfx.ask();
        break;
      case "answer":
        sfx.answer();
        break;
      case "swap":
        sfx.tap();
        break;
      case "declare":
        e.correct ? sfx.right() : sfx.wrong();
        break;
      case "score":
        sfx.score();
        break;
      case "eliminated":
        sfx.eliminate();
        break;
      default:
        break;
    }

    /* When somebody answers a question I asked, that answer is the single
       most important thing on screen and it otherwise lands in a side
       panel I am not looking at. */
    if (e.t === "answer" && e.to === myPid) {
      toast(`${nameOf(app.view, e.from)} says you are a ${roleName(e.role)}.`);
    }
    if (e.t === "eliminated")
      toast(`${nameOf(app.view, e.pid)} is out — ${e.why}.`);
    if (e.t === "simul_begin")
      toast("A full circuit, no declaration. Everyone declares at once.");
    if (e.t === "round_void")
      toast("Nobody was right. The round goes to the pile, worth nothing.");
  });
}

/* ── entering a game ────────────────────────────────────────── */

function openTable() {
  show("table-screen");
  if (!app.table) {
    app.table = createTable($("#gl"), {
      onSelect: (pid) => {
        const s = app.view;
        if (!s || s.phase !== PHASE.TURN) return;
        if (turnOrder(s)[s.pending?.turnIndex ?? 0] !== myPid) return;
        if (pid !== "__pile" && pid !== myPid)
          act({ type: "ask", pid: myPid, target: pid });
      },
    });
  }
  setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
}

function startSolo(playerCount = 4) {
  clearMemories();
  app.mode = "solo";
  app.code = null;
  app.roster = [];
  referee.match = createMatch({ targetScore: DEFAULT_TARGET });

  const withMe = reduce(referee.match, {
    type: "join",
    pid: myPid,
    name: store.name || "You",
    avatar: store.avatar,
  }).state;

  referee.match = fillWithBots(
    withMe,
    playerCount,
    (state, bot) => reduce(state, { type: "join", ...bot }).state,
  );

  app.view = localView();
  openTable();
  render();
  referee.dispatch({ type: "start" });
}

async function createRoom() {
  const name = cleanName($("#name-input").value) || "Player";
  store.name = name;
  app.mode = "host";
  app.code = makeRoomCode();
  app.roster = [{ pid: myPid, name, avatar: store.avatar, bot: false }];
  referee.match = createMatch({ targetScore: DEFAULT_TARGET });
  referee.match = reduce(referee.match, {
    type: "join",
    pid: myPid,
    name,
    avatar: store.avatar,
  }).state;

  show("lobby");
  renderLobby();
  setStatus("lobby-status", "opening the room…");

  try {
    app.net = await openRoom({
      code: app.code,
      onStatus: (txt) => setStatus("lobby-status", txt, "live"),
      onLost: () =>
        setStatus("lobby-status", "lost the relay — retrying", "bad"),
      onMessage: receive,
    });
    app.net.setMe(myPid);
    sendRoster();
    setStatus("lobby-status", `open · ${app.net.relayCount} relay`, "live");
  } catch {
    setStatus(
      "lobby-status",
      "no relay reachable — try again in a moment",
      "bad",
    );
  }
}

async function joinRoom() {
  const name = cleanName($("#name-input").value) || "Player";
  const code = cleanCode($("#code-input").value);
  if (!code) return setStatus("menu-status", "type the code first", "bad");

  store.name = name;
  app.mode = "guest";
  app.code = code;

  show("lobby");
  $("#lobby-code").textContent = app.code;
  renderLobby();
  setStatus("lobby-status", "knocking…");

  try {
    app.net = await openRoom({
      code: app.code,
      onStatus: (txt) => setStatus("lobby-status", txt, "live"),
      onLost: () =>
        setStatus("lobby-status", "lost the relay — retrying", "bad"),
      onMessage: receive,
    });
    app.net.setMe(myPid);
    app.net.send({
      k: "hello",
      pid: myPid,
      name,
      avatar: store.avatar,
      pub: app.net.pub,
    });
    setStatus("lobby-status", "waiting for the host to see you…");
  } catch {
    setStatus("lobby-status", "no relay reachable", "bad");
  }
}

const setStatus = (id, text, cls = "") => {
  const node = $(`#${id}`);
  if (!node) return;
  node.textContent = text;
  node.className = `status-line ${cls}`;
};

function renderLobby() {
  $("#lobby-code").textContent = app.code ?? "····";

  const seats = $("#lobby-seats");
  seats.textContent = "";

  const shown = app.roster.length
    ? app.roster
    : [{ pid: myPid, name: store.name || "You", avatar: store.avatar }];
  shown.forEach((p) => {
    const row = el("div", "seat-row filled");
    row.append(el("div", "seat-av", esc(p.avatar)));
    row.append(el("div", "seat-nm", esc(p.name)));
    const tags = el("div");
    if (p.pid === myPid) tags.append(el("span", "seat-tag you", "you"));
    if (p.pid === myPid && app.mode === "host")
      tags.append(el("span", "seat-tag host", " host"));
    if (p.bot) tags.append(el("span", "seat-tag bot", "bot"));
    row.append(tags);
    seats.append(row);
  });

  const empty = Math.max(0, 3 - shown.length);
  for (let i = 0; i < empty; i++) {
    const row = el("div", "seat-row empty");
    row.append(el("div", "seat-av", "·"));
    row.append(el("div", "seat-nm", "empty seat"));
    row.append(el("div", null, ""));
    seats.append(row);
  }

  const isHost = app.mode === "host";
  const start = $("#btn-start");
  start.disabled = !isHost || shown.length < 3;
  start.textContent = !isHost
    ? "Waiting for the host to deal"
    : shown.length < 3
      ? `Deal — need ${3 - shown.length} more`
      : `Deal ${shown.length} cards`;
  $("#btn-fill").classList.toggle("hidden", !isHost);
  $("#lobby-head").textContent = isHost
    ? "Waiting for players"
    : "Waiting for the host";
  $("#lobby-kicker").textContent = isHost
    ? "Your waiting room"
    : "Waiting room";
}

/* ── wire up the screens ────────────────────────────────────── */

$$("[data-go]").forEach((b) => {
  b.onclick = () => {
    const dest = b.dataset.go;
    if (dest === "practice") return startSolo(4);
    if (dest === "menu") {
      $("#name-input").value = store.name;
      return show("menu");
    }
    show(dest);
  };
});

/* onboarding carousel */
let slide = 0;
const SLIDES = 5;
function paintSlide() {
  $$(".slide").forEach((s) =>
    s.classList.toggle("on", Number(s.dataset.slide) === slide),
  );
  $$(".dot").forEach((d, i) => d.classList.toggle("on", i === slide));
  $("#slide-back").style.visibility = slide === 0 ? "hidden" : "visible";
  $("#slide-next").textContent =
    slide === SLIDES - 1 ? "Play a practice round" : "Next";
}
$("#slide-next").onclick = () => {
  if (slide === SLIDES - 1) return startSolo(4);
  slide = Math.min(SLIDES - 1, slide + 1);
  paintSlide();
};
$("#slide-back").onclick = () => {
  slide = Math.max(0, slide - 1);
  paintSlide();
};
paintSlide();

$("#btn-create").onclick = createRoom;
$("#btn-join").onclick = joinRoom;
$("#code-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinRoom();
});

$("#btn-start").onclick = () => {
  if (app.mode !== "host") return;
  referee.dispatch({ type: "start" });
  openTable();
};

$("#btn-fill").onclick = () => {
  if (app.mode !== "host") return;
  const target = Math.min(6, Math.max(3, app.roster.length + 1));
  referee.match = fillWithBots(referee.match, target, (state, bot) => {
    app.roster.push({
      pid: bot.pid,
      name: bot.name,
      avatar: bot.avatar,
      bot: true,
    });
    return reduce(state, { type: "join", ...bot }).state;
  });
  sendRoster();
  renderLobby();
};

$("#btn-copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(app.code);
    toast("Code copied.");
  } catch {
    toast(app.code);
  }
};

$("#btn-share").onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(app.code)}`;
  try {
    if (navigator.share) await navigator.share({ title: "What Am I?", url });
    else {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    }
  } catch {
    toast(url);
  }
};

const leaveRoom = () => {
  app.net?.send({ k: "bye", pid: myPid });
  app.net?.leave();
  app.net = null;
  app.mode = null;
  app.view = null;
  clearMemories();
  referee.clear();
  closeModals();
  show("hero");
};
$("#btn-leave").onclick = leaveRoom;
$("#round-quit").onclick = leaveRoom;

/* answer modal */
$("#answer-roles").textContent = "";
$("#modal-answer").addEventListener("transitionend", () => {});

function fillAnswerModal() {
  const s = app.view;
  if (!s || s.phase !== PHASE.ANSWERING) return;
  const asker = nameOf(s, s.pending.asker);
  $("#answer-question").innerHTML =
    `<b>${asker}</b> is asking what <b>they</b> are.`;
  const box = $("#answer-roles");
  box.textContent = "";
  ROLE_LIST.forEach((r) => {
    const b = el(
      "button",
      "role-btn",
      `<div class="v">${r.value} pt</div><div class="n">${esc(roleName(r.id))}</div>`,
    );
    b.onclick = () => act({ type: "answer", pid: myPid, role: r.id });
    box.append(b);
  });
}

/* cite modal */
function fillCiteModal() {
  const s = app.view;
  if (!s || s.phase !== PHASE.CITING) return;
  const list = $("#cite-list");
  list.textContent = "";
  /* Only the questions I ASKED can be cited. An answer I gave is not
     something I can claim to have relied on, and a question somebody
     else asked me tells me nothing about my own card. Getting this
     backwards pointed the blame at the wrong player. */
  const asked = (s.log ?? []).filter(
    (e) => e.kind === "ask" && e.from === myPid,
  );
  const sources = [...new Set(asked.map((e) => e.to))];

  if (!sources.length) {
    list.append(
      el(
        "p",
        "muted",
        "Nobody told you anything. You worked it out alone, and you were wrong.",
      ),
    );
  }

  sources.forEach((pid) => {
    const last = [...asked].reverse().find((e) => e.to === pid);
    const b = el(
      "button",
      "btn wide",
      `${nameOf(s, pid)} — told you that you were a ${roleName(last.answer)}`,
    );
    b.onclick = () => act({ type: "cite", pid: myPid, source: pid });
    list.append(b);
  });

  $("#cite-nobody").onclick = () =>
    act({ type: "cite", pid: myPid, source: "nobody" });
}

/* A slow watcher for the phase-driven modals. The reducer is the only
   thing that changes phase, and on a guest that happens when a snapshot
   lands — there is no callback to hang the modal off. */
let lastPhase = null;
setInterval(() => {
  const s = app.view;
  if (!s) return;
  const living = seatPlayers(s).filter((p) => !p.out).length;

  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    if (s.phase === PHASE.ANSWERING) fillAnswerModal();
    if (s.phase === PHASE.CITING) fillCiteModal();
    if (s.phase === PHASE.SIMUL) {
      openRolePick("simul-roles", (role) =>
        act({ type: "declare", pid: myPid, role }),
      );
    }
  }

  if (s.phase === PHASE.SIMUL) {
    const picks = s.pending?.picks ?? {};
    const mine = picks[myPid];
    $("#simul-status").textContent = mine
      ? `You picked ${roleName(mine)}. Waiting for the rest.`
      : `${Object.keys(picks).length} of ${living} have chosen`;
  }
}, 250);

$("#round-next").onclick = () => {
  modal("modal-round", false);
  if (app.view?.phase === PHASE.MATCH_END) act({ type: "rematch" });
  else act({ type: "next_round" });
  if (app.mode === "guest") $("#round-next").disabled = true;
  setTimeout(() => {
    $("#round-next").disabled = false;
  }, 1200);
};

$("#btn-help").onclick = () => modal("modal-rules", true);
$("#deal-go").onclick = () => {
  unlockAudio();
  sfx.deal();
  if (app.mode !== "guest") referee.dispatch({ type: "deal_done" });
};
$("#rules-close").onclick = () => modal("modal-rules", false);
$("#declare-cancel").onclick = () => modal("modal-declare", false);
$("#fatal-ok").onclick = () => {
  modal("modal-fatal", false);
  leaveRoom();
};

$("#deduce-toggle").onclick = () => {
  const panel = $("#deduce");
  const open = panel.classList.toggle("hidden");
  $("#deduce-toggle").classList.toggle("hidden", !open);
};

/* ── sound toggle ───────────────────────────────────────────── */

const paintSound = () => {
  $("#btn-sound").classList.toggle("off", isMuted());
  $("#btn-sound").title = isMuted() ? "Sound off" : "Sound on";
};

$("#btn-sound").onclick = () => {
  unlockAudio();
  const nowMuted = toggleMuted();
  paintSound();
  if (!nowMuted) sfx.tap();
  toast(nowMuted ? "Sound off." : "Sound on.");
};
paintSound();

/* Browsers refuse to start audio until the user has genuinely
   interacted, so the first real click anywhere is what turns it on.
   Clicking a button is not enough on its own in every browser, hence
   `pointerdown` rather than routing everything through the mute key. */
window.addEventListener("pointerdown", unlockAudio, { once: true });

/* ── keyboard ───────────────────────────────────────────────── */

/* Numbers pick the Nth role in whichever picker is open, which is the
   same order the buttons are drawn in — so a number never means
   something different from what is on screen next to it. */
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const tag = (e.target?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  if (e.key === "Escape") {
    /* Only the modals the player opened. The phase-driven ones would
       reopen on the next frame, which just flickers. */
    modal("modal-declare", false);
    modal("modal-rules", false);
    return;
  }

  if (e.key === "?") {
    modal("modal-rules", true);
    return;
  }

  if (e.key === "m" || e.key === "M") {
    $("#btn-sound").click();
    return;
  }

  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= 8) {
    const open = $$(".modal.on").find((m) => m.querySelector(".role-btn"));
    if (open) {
      const btn = $$(`#${open.id} .role-btn`)[n - 1];
      if (btn) {
        e.preventDefault();
        btn.click();
        return;
      }
    }
  }

  const s = app.view;
  if (!s || s.phase !== PHASE.TURN) return;
  if (turnOrder(s)[s.pending?.turnIndex ?? 0] !== myPid) return;

  const key = e.key.toLowerCase();
  if (key !== "a" && key !== "s" && key !== "d") return;
  const act = { a: "ask", s: "swap", d: "declare" }[key];
  const btn = $(`#hud-actions [data-act="${act}"]`);
  if (btn && !btn.disabled) {
    e.preventDefault();
    btn.click();
  }
});

/* ── deep link ──────────────────────────────────────────────── */

const start = () => {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  const solo = params.get("solo");
  if ($("#name-input")) $("#name-input").value = store.name;

  /* ?solo=4 drops straight into a practice table against three bots.
     It is a link worth being able to send someone ("here is what this
     is") and it is also how the table gets screenshotted in a headless
     browser, where there is nothing to click. ?solo on its own, or any
     value too small to be a table, means four. */
  if (solo !== null) {
    const n = Number(solo);
    startSolo(Number.isFinite(n) && n >= 3 ? Math.min(8, n) : 4);
    return;
  }

  if (room) {
    $("#code-input").value = cleanCode(room);
    show("menu");
    if (store.name) toast(`Code ${cleanCode(room)} is filled in — press Join.`);
    return;
  }

  if (!store.name) return show("hero");
};

$("#gl") && start();

window.addEventListener("beforeunload", () => app.net?.leave());
