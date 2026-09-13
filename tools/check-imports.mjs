/* ─────────────────────────────────────────────────────────────
   check-imports.mjs — every imported name must actually be exported.

   This exists because of a bug that reached production.

   `el()` was changed to call `markup(...)`, and a reformat collapsed
   the import statement onto one line. The edit that was *supposed* to
   add `markup` to the import did not match, so it silently did nothing.
   `markup` was therefore undefined, and `el()` threw the first time it
   was called with content.

   The game rendered a table and then stopped: no scores, no prompt, no
   actions. Nothing logged. The deploy went green, because none of the
   other checks load main.js — it is DOM-coupled, so only a browser can
   run it.

   A bundler would have caught this. There is no bundler here, and there
   will not be one: the whole point is that this is plain files with no
   build step. So the check that a bundler would have performed is
   performed here instead.

   Run:  node tools/check-imports.mjs
   ───────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const JS_DIR = "js";
const files = readdirSync(JS_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((f) => join(JS_DIR, f));

/** Every name a module exports, by any of the forms used here. */
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm,
  ))
    names.add(m[1]);
  // export { a, b as c }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    m[1].split(",").forEach((part) => {
      const t = part.trim();
      if (!t) return;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] ?? as[0]).trim());
    });
  }
  return names;
}

const problems = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");

  for (const m of src.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    const spec = m[2];
    if (!spec.startsWith(".")) continue; // vendor, skip

    const target = resolve(dirname(file), spec.split("?")[0]);
    let targetSrc;
    try {
      targetSrc = readFileSync(target, "utf8");
    } catch {
      problems.push({
        file,
        what: `imports from ${spec}, which does not exist`,
      });
      continue;
    }

    const available = exportsOf(targetSrc);
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      if (!available.has(name)) {
        problems.push({
          file,
          what: `imports \`${name}\` from ${spec}, which does not export it`,
          hint: available.size
            ? `exports: ${[...available].sort().join(", ")}`
            : "that module exports nothing",
        });
      }
    }
  }
}

if (problems.length) {
  console.log("\n  An imported name is not exported by the module it comes from.");
  console.log("  This is a ReferenceError at the first call site, in whichever");
  console.log("  file happens to use it, and no other check here would see it.\n");
  for (const p of problems) {
    console.log(`  ${p.file}  ${p.what}`);
    if (p.hint) console.log(`      ${p.hint}`);
  }
  console.log("");
  process.exit(1);
}

console.log(
  `  ok  every import resolves to a real export (${files.length} modules)`,
);
