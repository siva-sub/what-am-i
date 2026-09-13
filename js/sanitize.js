/* ─────────────────────────────────────────────────────────────
   sanitize.js — the boundary between other people and your DOM.

   Names and avatars arrive over the network from other humans and
   are then rendered with innerHTML in several places. That is a real
   injection path, not a theoretical one: a guest can send
   `avatar: "<img src=x onerror=...>"` and it runs in every other
   player's browser.

   This lives in its own module so the boundary can be unit-tested.
   While it was buried inside main.js — which touches the DOM on
   import — no test could reach it, which is a poor place for the one
   function standing between a hostile string and innerHTML.
   ───────────────────────────────────────────────────────────── */

/* Everything that can break out of text or an attribute. */
const HOSTILE = /[<>&"'`\\/]/g;
/**
 * A display name. Strips markup characters rather than escaping them,
 * because a name has no legitimate reason to contain any — and stripping
 * means the value is safe in attributes and template strings too, not
 * just in text position.
 */
export const cleanName = (raw) =>
 String(raw || "")
  .replace(HOSTILE, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 16);

/**
 * Avatars are a single glyph from a fixed set, so anything carrying
 * markup characters was never a legitimate avatar.
 */
export const cleanAvatar = (raw) =>
 String(raw || "")
  .replace(HOSTILE, "")
  .slice(0, 4) || "🜁";

/**
 * Escapes for the handful of places that build markup by hand. Defense
 * in depth: even if a value somehow reaches here un-cleaned, it lands as
 * text rather than as tags.
 */
export const esc = (str) =>
 String(str ?? "").replace(
  /[&<>"']/g,
  (c) =>
   ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
 );

/** A room code, uppercased and limited to the alphabet we generate. */
export const cleanCode = (raw) =>
 String(raw || "")
  .toUpperCase()
  .replace(/[^A-Z0-9-]/g, "")
  .slice(0, 12);

/* ── layer three: a parser that cannot be talked into compliance ──

   Layers one and two are both character filters, and both are
   discipline: they work only as long as every ingress path strips and
   every sink escapes. That has held, and an independent audit
   confirmed it against seven hostile payloads.

   But discipline is not structure. DOMPurify parses the string with a
   real HTML parser and rebuilds it from a fixed allowlist, so a value
   that somehow reaches a sink un-cleaned still cannot become a tag.
   The rules below are the entire grammar the HUD is allowed to emit:
   emphasis and line breaks, no attributes at all.

   This is defence in depth, not a fix for a live hole. It exists so
   that a future edit adding a sink without escaping degrades to
   stripped formatting instead of to script execution. */

import DOMPurify from "../vendor/dompurify.es.min.mjs";

const ALLOWED = {
 ALLOWED_TAGS: ["b", "i", "em", "strong", "span", "br"],
 ALLOWED_ATTR: [],
 ALLOW_DATA_ATTR: false,
 KEEP_CONTENT: true,
};

/**
 * Render trusted-shape markup. Emits the allowlist above and nothing
 * else: no script, no event handler, no style, no data URI, no SVG.
 *
 * Falls back to esc() where there is no DOM to parse with — which is
 * Node, where the tests run. The fallback is strictly more conservative
 * than the parser, so the tests exercise the safe direction.
 */
export const markup = (str) => {
 const raw = String(str ?? "");
 if (typeof DOMPurify?.sanitize !== "function") return esc(raw);
 return DOMPurify.sanitize(raw, ALLOWED);
};

/**
 * The same sanitising, returned as nodes instead of an HTML string.
 *
 * Preferred over markup(): the caller assigns with replaceChildren, so
 * no string is ever parsed as HTML a second time and there is no
 * innerHTML anywhere in the render path. The parse DOMPurify already
 * did is the only parse.
 *
 * Returns a DocumentFragment in a browser. Where there is no DOM the
 * input is text, so a text node is the honest answer.
 */
export const markupNodes = (str) => {
 const raw = String(str ?? "");
 if (
  typeof DOMPurify?.sanitize !== "function" ||
  typeof document === "undefined"
 )
  return [raw];
 return [DOMPurify.sanitize(raw, { ...ALLOWED, RETURN_DOM_FRAGMENT: true })];
};
