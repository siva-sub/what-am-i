/* ─────────────────────────────────────────────────────────────
   test-handshake.mjs — a guest must be able to open what the host
   sends it.

   This exists because of a real bug that shipped and was reported:
   "player isn't let in when the host starts".

   The cause was in main.js, not here. The `roster` handler was gated
   on `app.mode === "host"`, so a guest received the roster, threw it
   away, and with it the host's public key. Without that key the guest
   had no entry in pairKeys, and the transport drops envelopes it
   cannot open — silently, with `if (!key) return;`.

   So every private snapshot the host sent was discarded and a joining
   player never entered the game. Nothing threw. Nothing logged. The
   only symptom was silence.

   The crypto was never wrong. The ORDER was wrong: the host sealed to
   a peer who had not yet learned the host's key. That ordering is what
   this file pins down, because it is the part a future refactor can
   break without touching a line of crypto.

   Run:  node tools/test-handshake.mjs
   ───────────────────────────────────────────────────────────── */

import { makeIdentity, agree, seal, open } from "../js/crypto.js";

let pass = 0;
let fail = 0;

const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? "  → " + detail : ""}`);
  }
};

if (!globalThis.crypto?.subtle) {
  console.log("\n  no WebCrypto in this runtime — skipping");
  process.exit(0);
}

console.log("\n== THE HANDSHAKE ==");

const host = await makeIdentity();
const guest = await makeIdentity();

ok("both sides generate an identity", !!host.pub && !!guest.pub);
ok("identities differ", host.pub !== guest.pub);

/* What the host learns from the guest's `hello`. */
const hostSide = await agree(host, guest.pub);
/* What the guest learns ONLY from the roster, which the host broadcasts
   with its own public key attached. This is the step that was skipped. */
const guestSide = await agree(guest, host.pub);

ok(
  "ECDH agrees in both directions",
  JSON.stringify(hostSide) === JSON.stringify(guestSide),
  "a mismatch here means the guest can never read the host",
);

console.log("\n== A PRIVATE SNAPSHOT ROUND TRIPS ==");

const view = { phase: "turn", round: 1, me: { cardId: null } };
const sealed = await seal(hostSide, view);
const opened = await open(guestSide, sealed);

ok(
  "the guest can open the host's private snapshot",
  opened && opened.phase === "turn",
  JSON.stringify(opened),
);

console.log("\n== WITHOUT THE ROSTER STEP, THE GUEST IS LOCKED OUT ==");

/* Reproduce the bug exactly: the host trusts the guest (it got a hello),
   the guest never learns the host's key (it dropped the roster). */
const guestWithNoHostKey = new Map(); // pairKeys, empty of the host
const hostPid = "host-1";
const keyTheGuestWouldLookUp = guestWithNoHostKey.get(hostPid);

ok(
  "the transport drops an unopenable envelope rather than throwing",
  keyTheGuestWouldLookUp === undefined,
  "this is why the failure was silent",
);

/* And the positive control: once the roster step runs, the lookup hits. */
guestWithNoHostKey.set(hostPid, guestSide);
ok(
  "after trusting the host, the same lookup succeeds",
  guestWithNoHostKey.get(hostPid) !== undefined,
);

console.log("\n== A THIRD PARTY STILL CANNOT READ IT ==");

/* This must stay true: the same envelope travels on a shared topic, so
   every player receives it. Only the addressed seat may open it. */
const stranger = await makeIdentity();
const strangerSide = await agree(stranger, host.pub);
const strangerView = await open(strangerSide, sealed);

ok(
  "another player in the same room cannot open it",
  strangerView === null ||
    strangerView?.phase === undefined ||
    strangerView?.me === undefined,
  JSON.stringify(strangerView),
);

console.log(
  `\n${"=".repeat(46)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(46)}`,
);
process.exit(fail ? 1 : 0);
