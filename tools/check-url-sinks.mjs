/* ─────────────────────────────────────────────────────────────
   check-url-sinks.mjs — the half of the sanitising story that no
   string filter can cover.

   `esc()` escapes &<>"' and `cleanName()` strips them. Neither one
   neutralises a URI scheme: `javascript:x=1` passes through both
   unchanged, because a colon is not a markup character.

   That is fine today for exactly one reason — no player-controlled
   string is ever assigned to an href, a src, or any other URL
   attribute. The only `.src` the app writes is card art, and card ids
   come from the deck in cards.js, never from the network.

   That reason is an architectural fact, and architectural facts rot.
   So it is checked here rather than trusted: if somebody ever wires a
   name into a URL, this fails before the deploy does.

   Run:  node tools/check-url-sinks.mjs
   ───────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FILES = readdirSync("js")
 .filter((f) => f.endsWith(".js"))
 .map((f) => join("js", f));

/* Network-reachable free text. If one of these appears on the right of a
   URL assignment, a URI scheme can reach a browser unfiltered. */
const TAINTED = /(?:^|[^\w.])(name|avatar|msg\.\w+|action\.\w+)\b/;

/* Anything that assigns a URL, or builds one from a template literal. */
const URL_SINK =
 /\.(href|src|srcset|action|formAction|data|poster)\s*=\s*([^\n;]*)/g;

const problems = [];

for (const file of FILES) {
 const lines = readFileSync(file, "utf8").split("\n");

 lines.forEach((line, i) => {
  /* Attribute writes via setAttribute are just as dangerous. */
  const attr = line.match(/setAttribute\(\s*["'](href|src|srcset|action)["']/);
  if (attr && TAINTED.test(line)) {
   problems.push({
    file,
    line: i + 1,
    what: `setAttribute("${attr[1]}") from network text`,
    text: line.trim(),
   });
   return;
  }

  URL_SINK.lastIndex = 0;
  let m;
  while ((m = URL_SINK.exec(line))) {
   const rhs = m[2] ?? "";
   /* Art built from a deck id is the one legitimate source. */
   if (/\bartUrl\(|CARD_BY_ID|BACK_ART/.test(rhs)) continue;
   if (TAINTED.test(rhs)) {
    problems.push({
     file,
     line: i + 1,
     what: `.${m[1]} =` + " set from network text",
     text: line.trim().slice(0, 100),
    });
   }
  }
 });
}

if (problems.length) {
 console.log("\n  A name or avatar is being written into a URL attribute.\n");
 for (const p of problems) {
  console.log(`  ${p.file}:${p.line}  ${p.what}`);
  console.log(`      ${p.text}`);
 }
 console.log(
  "\n  Neither esc() nor cleanName() neutralises a URI scheme, so this is\n" +
   "  an injection path that the existing filters do not close. Either\n" +
   "  allowlist the URL against known-good values, or do not put free\n" +
   "  text in a URL.\n",
 );
 process.exit(1);
}

console.log(
 `  ok  no player-controlled string reaches a URL attribute (${FILES.length} modules scanned)`,
);
