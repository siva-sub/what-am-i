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
