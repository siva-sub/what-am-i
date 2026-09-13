/* ─────────────────────────────────────────────────────────────
   crypto.js — two locks, and why you need both.

   The room lock keeps strangers out: everything on the relay is
   encrypted with a key derived from the room code.

   The room lock is NOT enough on its own. A room is a shared
   channel, so when the host sends each player their own private
   snapshot, every other player receives it too. Each snapshot
   hides its owner's card but reveals everyone else's — so anyone
   who kept all of them could rebuild the entire deck and read
   their own identity out of devtools. That would end the game.

   So there is a second lock: an ECDH keypair per player, agreed
   with the host. Your snapshot is encrypted to you alone. The
   other seats receive ciphertext they cannot open.

   No dependencies. WebCrypto ships with the browser.
   ───────────────────────────────────────────────────────────── */

const SUBTLE = globalThis.crypto?.subtle;

export const hasCrypto = Boolean(SUBTLE);

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── room key ───────────────────────────────────────────────── */

export async function roomKey(code) {
  const material = await SUBTLE.importKey(
    "raw",
    enc.encode(String(code).toUpperCase()),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return SUBTLE.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("wami1"),
      iterations: 120_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ── pairwise key ───────────────────────────────────────────── */

export async function makeIdentity() {
  const pair = await SUBTLE.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
  const raw = await SUBTLE.exportKey("raw", pair.publicKey);
  return { pair, pub: b64(raw) };
}

export async function agree(identity, theirPubB64) {
  const theirPub = await SUBTLE.importKey(
    "raw",
    unb64(theirPubB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return SUBTLE.deriveKey(
    { name: "ECDH", public: theirPub },
    identity.pair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ── sealed boxes ───────────────────────────────────────────── */

/** Encrypt with `key`. Returns a compact string safe for any transport. */
export async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = enc.encode(JSON.stringify(value));
  const box = await SUBTLE.encrypt({ name: "AES-GCM", iv }, key, body);
  return b64(new Uint8Array([...iv, ...new Uint8Array(box)]));
}

/** Decrypt with `key`. Returns null on anything unreadable. */
export async function open(key, packed) {
  try {
    const raw = unb64(packed);
    const plain = await SUBTLE.decrypt(
      { name: "AES-GCM", iv: raw.slice(0, 12) },
      key,
      raw.slice(12),
    );
    return JSON.parse(dec.decode(plain));
  } catch {
    return null;
  }
}

/* ── short codes ────────────────────────────────────────────── */

/* No 0/O/1/I/L. These get read aloud across rooms and misheard. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const WORDS = [
  "MOTH",
  "CROW",
  "VEIL",
  "MASK",
  "BELL",
  "LAMP",
  "BONE",
  "ROPE",
  "ASH",
  "IRON",
  "MOSS",
  "THORN",
  "CHALK",
  "SALT",
  "WREN",
  "GLASS",
  "CANDLE",
  "MIRROR",
  "SHADOW",
  "LANTERN",
  "FEATHER",
  "STATUE",
  "SPINDLE",
  "HOURGLASS",
  "COMPASS",
  "MORTAR",
  "ANCHOR",
  "PRISM",
];

export function makeRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const tail = Array.from(
    bytes.slice(0, 4),
    (b) => ALPHABET[b % ALPHABET.length],
  ).join("");
  return `${WORDS[bytes[4] % WORDS.length]}-${tail}`;
}

/** Tolerant of however somebody typed it back to you. */
export const normaliseCode = (raw) =>
  String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

/** Stable, non-reversible topic name — the code itself never goes on the wire. */
export async function topicFor(code, version) {
  const digest = await SUBTLE.digest(
    "SHA-256",
    enc.encode(`${version}/${normaliseCode(code)}`),
  );
  return `wami-${version}-${[...new Uint8Array(digest).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}
