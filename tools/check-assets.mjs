/* ─────────────────────────────────────────────────────────────
   check-assets.mjs — walk the real import graph.

   A module that 404s is invisible until somebody clicks a button on
   the live site. That is exactly how this project shipped a broken
   build once: three.js was vendored by hand, and `three.module.min.js`
   imports a sibling chunk, `three.core.min.js`, that nobody notices
   until the browser refuses the whole graph and every button on the
   page silently does nothing.

   So this reads the actual imports rather than a hand-kept list.

     node tools/check-assets.mjs      # from web/
   ───────────────────────────────────────────────────────────── */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const seen = new Set();
const missing = [];
const queue = ["js/main.js"];

const resolveSpec = (spec, from) => {
 if (!spec.startsWith(".")) return null; // bare specifier, not ours
 let p = resolve(dirname(from), spec);
 if (!existsSync(p) && existsSync(`${p}.js`)) p += ".js";
 return p;
};

while (queue.length) {
 const file = queue.pop();
 if (seen.has(file)) continue;
 seen.add(file);

 if (!existsSync(file)) {
  missing.push(file);
  continue;
 }

 for (const m of readFileSync(file, "utf8").matchAll(
  /from\s*["']([^"']+)["']/g,
 )) {
  const p = resolveSpec(m[1], file);
  if (p) queue.push(p);
 }
}

/* The HTML references things the import graph cannot see. */
for (const m of readFileSync("index.html", "utf8").matchAll(
 /(?:src|href)="([^"]+)"/g,
)) {
 const url = m[1];
 if (url.startsWith("http") || url.startsWith("#") || url.startsWith("data:"))
  continue;
 if (!existsSync(url)) missing.push(url);
}

/* And the table screen loads card art and textures by string, not by
   import, so nothing above would notice if one went missing. */
const BY_STRING = [
 "assets/cards/queen.webp",
 "assets/cards/prince.webp",
 "assets/cards/fool-a.webp",
 "assets/cards/back.webp",
 "assets/cards/cover.webp",
 "assets/tex/table-wood.jpg",
 "assets/tex/room.jpg",
];
for (const p of BY_STRING) {
 if (!existsSync(p)) missing.push(p);
}

if (missing.length) {
 console.error("MISSING FILES:");
 for (const f of missing) console.error(`  ${f}`);
 process.exit(1);
}

console.log(
 `checked ${seen.size} modules, the HTML, and card art — all present`,
);
