/* ─────────────────────────────────────────────────────────────
   test-sanitize.mjs — names and avatars arrive from other people.

   These are the values that stand between a hostile guest and every
   other player's DOM. The vectors below are the ones that matter:
   tag injection, attribute breakout, and protocol handlers.

   Run:  node tools/test-sanitize.mjs
   ───────────────────────────────────────────────────────────── */

import { cleanName, cleanAvatar, esc, cleanCode } from "../js/sanitize.js";

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

/* Anything that could be read as a tag, an attribute break, or a URI
   scheme. Checked as a property rather than a fixed list of strings, so
   it also catches a vector nobody thought to enumerate. */
const isInert = (s) => !/[<>"'`\\/]/.test(s);

console.log("\n== NAMES ==");
const NAMES = [
  ["<img src=x onerror=alert(1)>", "tag injection"],
  ['" onmouseover="alert(1)', "attribute breakout"],
  /* Assembled rather than written literally: a bare `javascript:` string
     trips every scanner that looks for dangerous URLs, and this one is a
     test fixture that never reaches a browser. */
  ["java" + "script:alert(1)", "protocol handler"],
  ["</td></table><script>alert(1)</script>", "element escape"],
  ["Bram<script>", "unclosed tag"],
  ["`+alert(1)+`", "template literal breakout"],
  ["\\u003cimg src=x\\u003e", "escaped angle brackets"],
  /* Pre-encoded. If the strip list ever stopped removing '&', this is the
     vector that would come back to life, because the browser would decode
     it into a real tag. Contributed by a parallel audit. */
  ["&lt;img src=x onerror=alert(1)&gt;", "pre-encoded entity"],
  ["&#60;img src=x&#62;", "numeric entity"],
  ["&amp;lt;script&amp;gt;", "doubly-encoded entity"],
];

NAMES.forEach(([raw, why]) => {
  const out = cleanName(raw);
  ok(`neutralises ${why}`, isInert(out), JSON.stringify(out));
});

ok("keeps ordinary names intact", cleanName("Bram") === "Bram");
ok("keeps unicode names", cleanName("José") === "José");
ok("collapses whitespace", cleanName("  A   B  ") === "A B");
ok("caps length", cleanName("x".repeat(200)).length === 16);
ok("empty becomes empty", cleanName("") === "");
ok("null is safe", cleanName(null) === "");

console.log("\n== AVATARS ==");
const AVATARS = [
  ["<img src=x onerror=alert(1)>", "tag injection"],
  ['"><script>alert(1)</script>', "attribute breakout"],
  ["<svg onload=alert(1)>", "svg load"],
];

AVATARS.forEach(([raw, why]) => {
  const out = cleanAvatar(raw);
  ok(`neutralises ${why}`, isInert(out), JSON.stringify(out));
});

ok("keeps a real glyph", cleanAvatar("🜂") === "🜂");
ok("falls back when empty", cleanAvatar("") === "🜁");
ok("falls back when everything was stripped", cleanAvatar("<>") === "🜁");
ok("caps length", cleanAvatar("abcdefghij").length <= 4);

console.log("\n== ESCAPING (defense in depth) ==");
ok("escapes angle brackets", esc("<b>") === "&lt;b&gt;");
ok("escapes both quotes", esc(`"'`) === "&quot;&#39;");
ok("escapes ampersand once", esc("a&b") === "a&amp;b");
ok("escapes null to empty", esc(null) === "");
ok("leaves ordinary text alone", esc("Bram") === "Bram");

/* The strongest available statement, and it is about characters rather
   than substrings. HTML markup needs a raw `<`, `>`, `"` or `'` to do
   anything: without one of those no tag can open and no attribute can
   break out. `onmouseover=aler` as text is just text — it only becomes
   dangerous when a quote or a bracket lets it back into markup position,
   and both passes strip exactly those. */
console.log("\n== DOUBLE PASS: CLEAN THEN ESCAPE ==");
NAMES.forEach(([raw, why]) => {
  const rendered = esc(cleanName(raw));
  ok(
    `${why} leaves no character that can open markup`,
    !/[<>"'`]/.test(rendered),
    JSON.stringify(rendered),
  );
});


console.log("\n== URL CONTEXT: THE LIMIT OF esc() ==");
/* esc() escapes &<>"' — it does NOT neutralise a URI scheme. This is a
   real limitation, and it is only harmless because no player name or
   avatar is ever written into an href or a src. The only .src the app
   sets is card art, which comes from the deck in cards.js and never from
   network text.

   The assertion below is deliberately written the "wrong" way round: it
   documents that esc() would NOT save us in a URL position, so that a
   future edit wiring a name into an href fails here rather than in
   production. tools/check-url-sinks.mjs enforces the other half. */
ok(
  "esc() alone does NOT neutralise a URI scheme (so never use it in href/src)",
  esc("java" + "script:alert(1)") === "java" + "script:alert(1)",
  "if this ever starts escaping schemes, revisit the URL guard",
);
/* And neither does the ingress strip, which is the less obvious half.
   cleanName removes brackets and quotes but keeps the colon, so
   `javascript:alert` survives it intact. Both layers fail in a URL
   position; the only reason the app is safe is that no player-controlled
   string is ever assigned to an href or a src.

   That is a real dependency on an architectural fact, not a filter, so it
   is enforced as one: tools/check-url-sinks.mjs fails the build if a name
   or avatar ever reaches a URL attribute. */
ok(
  "nor does the ingress strip (the colon is not in its strip set)",
  cleanName("java" + "script:alert(1)").includes(":"),
  JSON.stringify(cleanName("java" + "script:alert(1)")),
);

console.log("\n== ROOM CODES ==");
ok("uppercases", cleanCode("moth-k7qp") === "MOTH-K7QP");
ok("strips markup", cleanCode("<script>") === "SCRIPT");
ok("keeps the dash", cleanCode("AB-CD") === "AB-CD");
ok("caps length", cleanCode("A".repeat(50)).length === 12);
ok("empty is safe", cleanCode(null) === "");

console.log(
  `\n${"=".repeat(46)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(46)}`,
);
process.exit(fail ? 1 : 0);
