/* ─────────────────────────────────────────────────────────────
   cards.js — the deck.

   Three of the eight roles are printed twice, one is printed three
   times, and the three high cards exist once each. Duplication is
   not decoration: it is what makes the central pile unpredictable
   and what stops the table solving the deck by elimination on
   turn one.
   ───────────────────────────────────────────────────────────── */

export const ROLES = {
 fool: { value: 1, name: "Fool", plural: "Fools" },
 guard: { value: 2, name: "Guard", plural: "Guards" },
 widow: { value: 3, name: "Widow", plural: "Widows" },
 monk: { value: 4, name: "Monk", plural: "Monks" },
 oracle: { value: 5, name: "Oracle", plural: "Oracles" },
 judge: { value: 6, name: "Judge", plural: "Judges" },
 prince: { value: 7, name: "Prince", plural: "Princes" },
 queen: { value: 8, name: "Queen", plural: "Queens" },
};

export const ROLE_LIST = Object.entries(ROLES)
 .map(([id, r]) => ({ id, ...r }))
 .sort((a, b) => a.value - b.value);

/* Every physical card carries its own artwork, so two Fools in
   play are two different pictures and the table can say "the
   seated Fool" instead of pointing. */
export const CARDS = [
 { id: "fool-a", role: "fool", art: "fool-a" },
 { id: "fool-b", role: "fool", art: "fool-b" },
 { id: "guard-a", role: "guard", art: "guard-a" },
 { id: "guard-b", role: "guard", art: "guard-b" },
 { id: "widow-a", role: "widow", art: "widow-a" },
 { id: "widow-b", role: "widow", art: "widow-b" },
 { id: "monk-a", role: "monk", art: "monk-a" },
 { id: "monk-b", role: "monk", art: "monk-b" },
 { id: "oracle-a", role: "oracle", art: "oracle-a" },
 { id: "judge-a", role: "judge", art: "judge-a" },
 { id: "prince", role: "prince", art: "prince" },
 { id: "queen", role: "queen", art: "queen" },

 /* Expansion — the three high cards are never duplicated. Two
     Queens would let two players end the match on one role, which
     destroys the whole tension. Only values 1–6 scale. */
 { id: "fool-c", role: "fool", art: "fool-c" },
 { id: "guard-c", role: "guard", art: "guard-c" },
 { id: "oracle-b", role: "oracle", art: "oracle-b" },
 { id: "judge-b", role: "judge", art: "judge-b" },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/* The pile is capped at four cards, so the deck follows the size of the
   table instead of a step function.

   This is the most important number in the game. Your own card is always
   one of (pile + 1) cards you cannot see. With the old fixed 12-card deck
   and four players that was 1-of-9, and no single role-name answer can
   resolve 1-of-9 — so nobody could ever reach certainty, every round hit
   the forced simultaneous declaration, and the winner was whoever guessed
   right. At pile=4 it is 1-of-5: two honest answers narrow it to one, and
   declaring becomes a decision rather than a lottery ticket. */
export const deckFor = (playerCount) => Math.min(CARDS.length, playerCount + 4);

export const artUrl = (cardId) =>
 `assets/cards/${CARD_BY_ID[cardId]?.art ?? "back"}.webp`;

export const roleOf = (cardId) => CARD_BY_ID[cardId]?.role ?? null;

export const valueOf = (cardId) => ROLES[roleOf(cardId)]?.value ?? 0;

export const roleName = (roleId) => ROLES[roleId]?.name ?? roleId;

/* What a card looks like to someone who cannot read it. */
export const BACK_ART = "assets/cards/back.webp";

export const DECK_SUMMARY = ROLE_LIST.map((r) => ({
 ...r,
 copies: CARDS.filter((c) => c.role === r.id).length,
}));

export const deckValue = (n) =>
 CARDS.slice(0, n).reduce((sum, c) => sum + ROLES[c.role].value, 0);
