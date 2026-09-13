# WHAT AM I? — v3 · Build Kit

Everything needed to print, assemble and play. Continues from `what-am-i-full-design.md`.

```
   ┌────────────────────────────────────────────────────────────────┐
   │  v1  one-pager          BROKEN  · lying was impossible         │
   │  v2  full design        PLAYABLE· whispers + marks + witness   │
   │  v3  build kit          LOCKED  · three fixes, ready to print  │
   └────────────────────────────────────────────────────────────────┘
```

---

## 1. WHAT CHANGED IN v3

Three structural fixes, plus one emergent property I did not design and do not want to lose.

### CHANGE 1 — Tokens now clear your own MARK

**The problem.** v2's worst outcome was the Fizzle: everyone lies, everyone gets marked, nobody can declare, the round scores zero. My v2 mitigation was "redeal," which is a shrug, not a rule.

**The fix.** A token does two jobs now:

```
                    ┌─────────────────────────┐
                    │      SWAP TOKEN         │
                    │   (2 per player)        │
                    └────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      ┌───────────────┐             ┌───────────────┐
      │  SPEND TO     │             │  SPEND TO     │
      │  SWAP YOUR    │             │  CLEAR YOUR   │
      │  CARD         │             │  OWN MARK     │
      └───────────────┘             └───────────────┘
       escape a bad card             escape a spite mark
```

This fixes three things at once:

```
   BEFORE (v2)                              AFTER (v3)
   ──────────────────────                   ──────────────────────
   liar gets marked                         liar gets marked
      → cannot win                             → pays a token
      → sits out the round                     → back in the game
      → round fizzles
                                           lying now has a BUDGET:
   lying: unlimited, free                    you can afford two lies,
   cost: your entire round                   then you are done for
```

And it gives the spite-mark real teeth without making it fatal: marking the leader forces them to spend a resource to survive. That was the point of the rule all along.

### CHANGE 2 — No declaring in the first circuit

**The problem.** v2's second risk was the Race: two players trade truths on turns 1 and 2, one declares, round over in 40 seconds. It was a variant fix. It should be a base rule.

**The fix.** Nobody may declare until every player has had one turn.

```
   CIRCUIT 1                          CIRCUIT 2
   ─────────────────────────────      ──────────────────────────
   A  ask                             A  DECLARE (now legal)
   B  ask                             ...
   C  ask
   D  ask        ← circuit complete
   ──────────────────
   declaring locked
```

**Why it is not arbitrary.** It guarantees every player gets at least one action before anyone can win. In a 4-player game that is the difference between playing and watching. Games already do this — no attacking on turn one, no buying on turn one.

### CHANGE 3 — Match is first to 8 points

v2 said first to 5. With a deck average of 3.8 points per round-win, that is a two-round match and it feels like a coin flip. First to 8 is realistically three rounds, which is where the metagame starts mattering.

```
   MATCH LENGTH              rounds       wall clock
   ──────────────────────────────────────────────────
   first to 5  (v2)           ~2          ~7 min
   first to 8  (v3)           ~3          ~10-12 min
   first to 12                ~4          ~15 min
   ──────────────────────────────────────────────────
```

### ALSO — a change that did *not* happen

The Fizzle rule (if every player is marked, redeal immediately) stays as a backstop. It should now almost never trigger, because tokens can clear marks. Keep it anyway; it costs one line and prevents a dead round.

---

## 2. THE QUEEN PARADOX

This fell out of the scoring rule and it is now my favourite thing in the design.

Truth-telling is unprofitable. But the **Queen is worth 8 points**, and the match is to 8. So telling a Queen-holder their identity does not merely cost you the round — **it ends the match on the spot.**

```
   ┌──────────────────────────────────────────────────────────────┐
   │  "You are the Queen."                                        │
   │                                                              │
   │      → they score 8                                          │
   │      → match over                                            │
   │      → you chose the person who beats you                    │
   └──────────────────────────────────────────────────────────────┘

   SO: nobody will ever tell a Queen-holder the truth.
```

Which means the game's best card is the one nobody will talk about:

```
        CARD VALUE        WILL PEOPLE TELL YOU?
   ──────────────────────────────────────────────────
        1  FOOL          often — it is almost harmless
        2  GUARD         often
        3  WIDOW         sometimes
        4  MONK          maybe
        5  ORACLE        rarely
        6  JUDGE         rarely
        7  PRINCE        almost never
        8  QUEEN         NEVER

   ┌───────────────────────────────────────────────────────┐
   │  The strongest card in the deck is the one you are    │
   │  least likely to ever be told about.                  │
   │  Queen-holders must win by COUNTING, not by asking.   │
   └───────────────────────────────────────────────────────┘
```

A Queen-holder can still work it out: they see four cards, so they know their identity is one of eight unknowns, and if every informant refuses to engage, refusal itself is evidence. The high card is played by deduction alone. That is a genuinely good dynamic and it arrived for free.

---

## 3. LOCKED RULES — v3

The complete rule text. This is the version to print.

```
╔══════════════════════════════════════════════════════════════════╗
║                        W H A T   A M   I ?                       ║
║                                                                  ║
║   You cannot read your own identity. Everyone else can.          ║
║   They have every reason to lie about it.                        ║
║   Act before someone else works out theirs.                      ║
║                                                                  ║
║   4-5 players  ·  3 min per round  ·  first to 8 points          ║
╚══════════════════════════════════════════════════════════════════╝
```

**COMPONENTS** — 12 role cards · 2 tokens per player · a small folded card holder per player

**SETUP**

```
   1.  Shuffle all 12 role cards.
   2.  Deal one card to each player, held FACE-OUT.
   3.  The rest go face-down in the centre as the pile.
   4.  Each player takes 2 tokens.

   ┌─────────────────────────────────────────────────────┐
   │  You may read every card at the table except yours. │
   │  Nobody may tell you your card. Nobody may confirm. │
   │  You may never look.                                │
   └─────────────────────────────────────────────────────┘
```

**YOUR TURN — do exactly one**

```
   ┌──────────────────┬──────────────────┬──────────────────┐
   │       ASK        │     DECLARE      │       SWAP       │
   ├──────────────────┼──────────────────┼──────────────────┤
   │ whisper ONE      │ say your role    │ spend 1 token:   │
   │ player:          │ out loud         │  · swap your card│
   │ "what am I?"     │                  │    for a pile    │
   │                  │ table reads your │    card, FACE-OUT│
   │ answer is        │ card             │  · OR clear your │
   │ PRIVATE          │                  │    own mark      │
   │                  │                  │                  │
   │ they may lie     │                  │ a swap may be    │
   │ refusing is      │                  │ done once per    │
   │ legal — and a    │                  │ round by each    │
   │ tell             │                  │ player           │
   └──────────────────┴──────────────────┴──────────────────┘
```

**DECLARING**

```
              ┌──────────────────────────┐
              │  "I am the Prince."      │
              └────────────┬─────────────┘
                           │
              ┌────────────▼─────────────┐
              │  table reads your card   │
              └────────────┬─────────────┘
                           │
          ┌────────────────┴─────────────────┐
          ▼                                  ▼
  ┌───────────────┐                ┌───────────────────────┐
  │   CORRECT     │                │        WRONG          │
  ├───────────────┤                ├───────────────────────┤
  │ score its     │                │ you are OUT           │
  │ value         │                │                       │
  │ round ends    │                │ you MAY name whoever  │
  └───────────────┘                │ misled you            │
                                   │   → they become       │
     first to 8                    │     MARKED            │
     wins the match                └───────────────────────┘

   MARKED = you cannot declare. You may still ask, answer
            and swap. You cannot win this round unless you
            spend a token to clear your own mark.
```

**FORCED DECLARATION**

If a full circuit passes with nobody declaring, everyone declares simultaneously by pointing at the reference card.

```
   exactly one correct  →  they score the round
   none correct         →  round goes to the pile, nobody scores
   several correct      →  highest value wins; ties score nobody
```

**THE FIRST CIRCUIT**

Nobody may declare until every player has taken one turn.

**ELIMINATED PLAYERS BECOME WITNESSES**

Once per round, an eliminated player may publicly point at any player and announce what they are. They may tell the truth or lie.

```
              the dead are the only players
              with nothing left to lose
                        │
                        ▼
        ┌───────────────────────────────┐
        │  a free truth, or a free lie  │
        │  nobody can tell which        │
        └───────────────────────────────┘
```

**GLIMPSING YOUR OWN CARD**

If you accidentally see your own card, you must declare immediately.

**THE FIZZLE BACKSTOP**

If every player is marked at the same time, the round is void, redeal.

---

## 4. PRINT SHEET — ROLE CARDS

```
   CUT ON ALL LINES  ·  or print to 2 sheets at 2.5 × 3.5 in
   ═══════════════════════════════════════════════════════════════
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ 1              │ │ 1              │ │ 2              │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │      FOOL      │ │      FOOL      │ │     GUARD      │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │   1 POINT      │ │   1 POINT      │ │   2 POINTS     │
   └────────────────┘ └────────────────┘ └────────────────┘
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ 2              │ │ 3              │ │ 3              │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │     GUARD      │ │     WIDOW      │ │     WIDOW      │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │   2 POINTS     │ │   3 POINTS     │ │   3 POINTS     │
   └────────────────┘ └────────────────┘ └────────────────┘
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ 4              │ │ 4              │ │ 5              │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │      MONK      │ │      MONK      │ │     ORACLE     │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │   4 POINTS     │ │   4 POINTS     │ │   5 POINTS     │
   └────────────────┘ └────────────────┘ └────────────────┘
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ 6              │ │ 7              │ │ 8              │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │     JUDGE      │ │    PRINCE      │ │     QUEEN      │
   │                │ │                │ │                │
   │                │ │                │ │                │
   │   6 POINTS     │ │   7 POINTS     │ │   8 POINTS     │
   └────────────────┘ └────────────────┘ └────────────────┘
   ═══════════════════════════════════════════════════════════════
```

**CARD BACK** — print 12 of these on the reverse, or just leave the backs blank and shuffle face-down normally.

```
   ┌────────────────┐
   │ ░░░░░░░░░░░░░░ │
   │ ░░░░░░░░░░░░░░ │
   │ ░░░ ┌────┐ ░░░ │
   │ ░░░ │  ? │ ░░░ │
   │ ░░░ └────┘ ░░░ │
   │ ░░░░░░░░░░░░░░ │
   │ ░░░░░░░░░░░░░░ │
   └────────────────┘
```

---

## 5. PRINT SHEET — TOKENS

```
   CUT ON ALL LINES  ·  10 per sheet  ·  print 1 sheet
   ═══════════════════════════════════════════════════════════════
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  ╔════╗  │ │  ╔════╗  │ │  ╔════╗  │ │  ╔════╗  │
   │  ║ ↺  ║  │ │  ║ ↺  ║  │ │  ║ ↺  ║  │ │  ║ ↺  ║  │
   │  ╚════╝  │ │  ╚════╝  │ │  ╚════╝  │ │  ╚════╝  │
   │   SWAP   │ │   SWAP   │ │   SWAP   │ │   SWAP   │
   │    or    │ │    or    │ │    or    │ │    or    │
   │  CLEAR   │ │  CLEAR   │ │  CLEAR   │ │  CLEAR   │
   │   MARK   │ │   MARK   │ │   MARK   │ │   MARK   │
   └──────────┘ └──────────┘ └──────────┘ └──────────┘
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  ╔════╗  │ │  ╔════╗  │ │  ╔════╗  │ │  ╔════╗  │
   │  ║ ↺  ║  │ │  ║ ↺  ║  │ │  ║ ↺  ║  │ │  ║ ↺  ║  │
   │  ╚════╝  │ │  ╚════╝  │ │  ╚════╝  │ │  ╚════╝  │
   │   SWAP   │ │   SWAP   │ │   SWAP   │ │   SWAP   │
   │    or    │ │    or    │ │    or    │ │    or    │
   │  CLEAR   │ │  CLEAR   │ │  CLEAR   │ │  CLEAR   │
   │   MARK   │ │   MARK   │ │   MARK   │ │   MARK   │
   └──────────┘ └──────────┘ └──────────┘ └──────────┘
   ┌──────────┐ ┌──────────┐
   │  ╔════╗  │ │  ╔════╗  │
   │  ║ ↺  ║  │ │  ║ ↺  ║  │
   │  ╚════╝  │ │  ╚════╝  │
   │   SWAP   │ │   SWAP   │
   │    or    │ │    or    │
   │  CLEAR   │ │  CLEAR   │
   │   MARK   │ │   MARK   │
   └──────────┘ └──────────┘
   ═══════════════════════════════════════════════════════════════
```

---

## 6. PLAYER AID — one per player

```
   ╔══════════════════════════════════════════════════════════╗
   ║                 WHAT AM I?  ·  PLAYER AID                ║
   ╠══════════════════════════════════════════════════════════╣
   ║                                                          ║
   ║   YOUR CARD IS FACE-OUT. YOU MAY NOT READ IT.            ║
   ║   NOBODY MAY TELL YOU. NOBODY MAY CONFIRM.               ║
   ║                                                          ║
   ║   ── YOUR TURN · PICK ONE ──────────────────────────     ║
   ║                                                          ║
   ║      ASK       whisper ONE player "what am I?"           ║
   ║                the answer is PRIVATE                     ║
   ║                refusing is legal — and a tell            ║
   ║                                                          ║
   ║      DECLARE   say your role out loud                    ║
   ║                the table reads your card                 ║
   ║                                                          ║
   ║      SWAP      spend a token, draw from the pile         ║
   ║                your new card goes FACE-OUT               ║
   ║                                                          ║
   ║   ── TOKEN · TWO USES ──────────────────────────────     ║
   ║                                                          ║
   ║      ↺   SWAP YOUR CARD                                  ║
   ║      ↺   CLEAR YOUR OWN MARK                             ║
   ║                                                          ║
   ║   ── DECLARING ─────────────────────────────────────     ║
   ║                                                          ║
   ║      CORRECT  → score its value · round ends             ║
   ║      WRONG    → you are OUT                              ║
   ║                 you may name your source                 ║
   ║                 that player becomes MARKED               ║
   ║                                                          ║
   ║      MARKED   → you cannot declare                       ║
   ║                                                          ║
   ║   ── OTHER ──────────────────────────────────────────     ║
   ║                                                          ║
   ║      · No declaring in the FIRST CIRCUIT                 ║
   ║      · Glimpse your own card → declare immediately       ║
   ║      · Eliminated → WITNESS, once per round:             ║
   ║        publicly announce any one card, true or lie       ║
   ║      · Full circuit, no declaration → everyone           ║
   ║        declares at once                                  ║
   ║      · First to 8 points wins the match                  ║
   ║                                                          ║
   ╚══════════════════════════════════════════════════════════╝
```

---

## 7. ROLE REFERENCE — one per table

Used for forced declarations and for new players.

```
   ┌──────────────────────────────────────────────────────────┐
   │             R O L E   R E F E R E N C E                  │
   ├──────────────────────────────────────────────────────────┤
   │                                                          │
   │    1             2             3             4           │
   │   FOOL         GUARD         WIDOW          MONK         │
   │   ×2            ×2            ×2            ×2           │
   │   1 pt         2 pts         3 pts         4 pts         │
   │                                                          │
   │    5             6             7             8           │
   │   ORACLE       JUDGE         PRINCE        QUEEN         │
   │   ×1            ×1            ×1            ×1           │
   │   5 pts         6 pts         7 pts         8 pts        │
   │                                                          │
   ├──────────────────────────────────────────────────────────┤
   │  12 cards total  ·  deck value 46  ·  4 low cards repeat │
   │  THE QUEEN IS NEVER TOLD. Winners count. Losers ask.     │
   └──────────────────────────────────────────────────────────┘
```

---

## 8. SCOREPAD

```
   WHAT AM I?  ·  SCOREPAD          first to 8           round ___
   ┌────────────┬────┬────┬────┬────┬────┬────┬────┬────┬─────┐
   │  PLAYER    │ R1 │ R2 │ R3 │ R4 │ R5 │ R6 │ R7 │ R8 │ TOP │
   ├────────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────┤
   │            │    │    │    │    │    │    │    │    │     │
   ├────────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────┤
   │            │    │    │    │    │    │    │    │    │     │
   ├────────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────┤
   │            │    │    │    │    │    │    │    │    │     │
   ├────────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────┤
   │            │    │    │    │    │    │    │    │    │     │
   ├────────────┼────┼────┼────┼────┼────┼────┼────┼────┼─────┤
   │            │    │    │    │    │    │    │    │    │     │
   └────────────┴────┴────┴────┴────┴────┴────┴────┴────┴─────┘

   after each round, write the DECLARED ROLE here:

   ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
   │ R1   │ R2   │ R3   │ R4   │ R5   │ R6   │ R7   │ R8   │
   ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
   │      │      │      │      │      │      │      │      │
   └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
   this row is the game's memory. It is how stories get retold.
```

---

## 9. TABLE SETUP — top-down

```
                             ┌─────────────────┐
                             │      ALICE      │
                             │   ┌─────────┐   │
                             │   │  QUEEN  │ ← │  legible to
                             │   └─────────┘   │  Bob, Carol
                             │     ●    ●      │  and Dan
                             └─────────────────┘
                                      │
                                      │  Alice cannot
                                      │  see this card
                                      ▼


  ┌─────────────────┐      ┌───────────────────┐      ┌─────────────────┐
  │       DAN       │      │   CENTRE  PILE    │      │       BOB       │
  │   ┌─────────┐   │      │  ┌─────┐ ┌─────┐  │      │   ┌─────────┐   │
  │   │  WIDOW  │   │      │  │ ░░░ │ │ ░░░ │  │      │   │  MONK   │   │
  │   └─────────┘   │      │  └─────┘ └─────┘  │      │   └─────────┘   │
  │     ●    ●      │      │  ┌─────┐ ┌─────┐  │      │     ●    ●      │
  └─────────────────┘      │  │ ░░░ │ │ ░░░ │  │      └─────────────────┘
                           │  └─────┘ └─────┘  │
                           │  8 cards, face-down│
                           │                   │
                           │  ┌─────────────┐  │
                           │  │ROLE REFERENCE│ │
                           │  └─────────────┘  │
                           └───────────────────┘

                             ┌─────────────────┐
                             │      CAROL      │
                             │   ┌─────────┐   │
                             │   │  FOOL   │   │
                             │   └─────────┘   │
                             │     ●    ●      │
                             └─────────────────┘

   ● ● = swap tokens (2 per player)

   ┌──────────────────────────────────────────────────────────────┐
   │  NOTE THE SHAPE OF THIS. Every card faces INWARD, toward     │
   │  the table. The information is already in the room — the     │
   │  game is entirely about whether anyone will hand it over.    │
   └──────────────────────────────────────────────────────────────┘
```

---

## 10. CARD HOLDER — assembly

Needed so cards stand face-out and cannot be peeked at. Fold a strip of card into a tent.

```
   ── CUT ────────────────────────────────────────────────────────
   ┌───────────────────────┬───────────────────────┐
   │                       │                       │
   │        FRONT          │         BACK          │
   │                       │                       │
   │     cut a 3 in × 1/4 in slot along the fold   │
   │                       │                       │
   └───────────────────────┴───────────────────────┘
                         ▲
                    fold here
   ── FOLD ───────────────────────────────────────────────────────


   ── ASSEMBLED · front view ──        ── side view ──
        ╱▔▔▔▔▔▔▔▔▔▔▔▔▔╲
       ╱               ╲                      ╱╲
      ╱   ┌───────┐     ╲                    ╱  ╲
     ╱    │ QUEEN │      ╲                  ╱    ╲
    ╱     └───────┘       ╲                ╱      ╲
   ╱───────────────────────╲              ╱────────╲

   the card slots through the slit and stands upright.
   the owner sits behind it and physically cannot read it.
```

**If you do not want to make holders:** any card stand, a folded piece of paper with a slit, or a phone propped against a mug. The only requirement is that the card is legible to everyone facing it and invisible to its owner.

---

## 11. TUCK BOX — optional

```
   ── NET · cut on solid lines, fold on dashed ──────────────────
   ┌────────┬──────────────────────┬────────┬─────────────┐
   │        │                      │        │             │
   │  FLAP  │        BACK          │  FLAP  │   GLUE TAB  │
   │        │                      │        │             │
   ├────────┼──────────────────────┼────────┼─────────────┤
   │        │                      │        │             │
   │  FLAP  │   ╔══════════════╗   │  FLAP  │   GLUE TAB  │
   │        │   ║  WHAT AM I?  ║   │        │             │
   │        │   ╚══════════════╝   │        │             │
   │        │                      │        │             │
   ├────────┼──────────────────────┼────────┼─────────────┤
   │        │                      │        │             │
   │  FLAP  │        FRONT         │  FLAP  │   GLUE TAB  │
   │        │                      │        │             │
   ├────────┼──────────────────────┼────────┼─────────────┤
   │        │                      │        │             │
   │  FLAP  │     BOTTOM FLAP      │  FLAP  │   GLUE TAB  │
   │        │                      │        │             │
   └────────┴──────────────────────┴────────┴─────────────┘
```

---

## 12. PACKING LIST

```
   ╔══════════════════════════════════════════════════════════╗
   ║  WHAT AM I?  ·  v3  ·  COMPONENTS                        ║
   ╠══════════════════════════════════════════════════════════╣
   ║                                                          ║
   ║   12   role cards        2 sheets of card                ║
   ║   10   swap tokens       1 sheet, ~1 in squares          ║
   ║    5   player aids       1 sheet                         ║
   ║    1   role reference    1 sheet                         ║
   ║    1   rule sheet        1 page                          ║
   ║    1   scorepad          1 sheet, or a blank notepad     ║
   ║    5   card holders      5 strips of card, folded        ║
   ║                                                          ║
   ║   TIME TO BUILD                                          ║
   ║     print + cut cards + tokens ......... 25 min          ║
   ║     fold 5 card holders ................ 10 min          ║
   ║     optional tuck box .................. 15 min          ║
   ║     ─────────────────────────────────────────────        ║
   ║     playable in ....................... 35 min           ║
   ║     fully finished ..................... 1 hour           ║
   ║                                                          ║
   ║   COST                                                   ║
   ║     3 sheets of card + 2 of paper ...... under $1        ║
   ║                                                          ║
   ╚══════════════════════════════════════════════════════════╝
```

---

## 13. FIRST PLAY — scripted walkthrough

What a first round looks like, in order, so the first game does not stall.

```
   ┌─ BEFORE YOU START ───────────────────────────────────────────┐
   │ Read the player aid aloud. Then say this sentence, exactly:   │
   │                                                              │
   │  "You can see everyone's card but your own. When you ask     │
   │   someone what you are, they may lie, and only you will      │
   │   hear it. Truth costs them the round, so expect lies."      │
   │                                                              │
   │ Then deal and say nothing else. Do not explain further.      │
   │ The first confusion IS the game. Let it happen.              │
   └──────────────────────────────────────────────────────────────┘

   CIRCUIT 1 — nobody may declare
   ──────────────────────────────────────────────────────────────
     turn 1   first player asks somebody. Watch who they pick.
     turn 2   next player asks. Two whispers so far.
     turn 3   somebody will refuse to answer. Watch the table
              notice. This is the game's first real information.
     turn 4   circuit ends.

   CIRCUIT 2 — declaring is legal
   ──────────────────────────────────────────────────────────────
     somebody declares, probably on incomplete information.
     either they score, or they are out and they name a source.

     ┌────────────────────────────────────────────────────────┐
     │  Whatever happens, the round is now over in under 3    │
     │  minutes and everyone has a story. Deal the next one.  │
     └────────────────────────────────────────────────────────┘
```

**Three things that will go wrong on the first play. Say these out loud when they happen.**

```
   1.  Someone will ask "can I see my own card?"
       NO. This is the entire game.

   2.  Someone will say "I'm just going to say what Alice is."
       You may only ask about YOURSELF. Base game.

   3.  Someone will try to tell another player their card out loud
       in front of everyone.
       Whisper only. Public announcements are what the Witness
       rule exists for — and only the dead get that power.
```

---

## 14. PLAYTEST OBSERVATION SHEET

Print one per session. Fill it in during play, not after.

```
   WHAT AM I?  ·  SESSION ___    date ______    players ____
   ┌────────────────────────────────────────────────────────────┐
   │  ROUND │ DECLARED │ BY WHOM │ CORRECT? │ SECONDS │ LAUGH?  │
   ├────────┼──────────┼─────────┼──────────┼─────────┼─────────┤
   │   1    │          │         │          │         │         │
   ├────────┼──────────┼─────────┼──────────┼─────────┼─────────┤
   │   2    │          │         │          │         │         │
   ├────────┼──────────┼─────────┼──────────┼─────────┼─────────┤
   │   3    │          │         │          │         │         │
   ├────────┼──────────┼─────────┼──────────┼─────────┼─────────┤
   │   4    │          │         │          │         │         │
   └────────┴──────────┴─────────┴──────────┴─────────┴─────────┘

   TALLY THESE AS THEY HAPPEN
   ┌──────────────────────────────────────────┬───────────────┐
   │ truths given for free ...................│ ____ /round   │
   │ lies told ...............................│ ____ /round   │
   │ refusals to answer ......................│ ____ /round   │
   │ trades ("you tell me mine") .............│ ____ /round   │
   │ marks given .............................│ ____ /round   │
   │ tokens spent on SWAP ....................│ ____ /round   │
   │ tokens spent on CLEAR MARK ..............│ ____ /round   │
   │ forced declarations .....................│ ____ /match   │
   │ fizzles (all marked) ....................│ ____ /match   │
   │ longest gap between one player's turns ..│ ____ sec      │
   └──────────────────────────────────────────┴───────────────┘

   THE ONE QUESTION THAT DECIDES THE DESIGN
   ┌──────────────────────────────────────────────────────────┐
   │  Did anyone laugh?  YES / NO                             │
   │  At what? _____________________________________________  │
   │                                                          │
   │  If this line is empty after four rounds, stop building  │
   │  this game. A game that produces no laughter will not    │
   │  survive the second playtest either.                     │
   └──────────────────────────────────────────────────────────┘
```

---

## 15. BUILD STATUS

```
   ┌─────────────────────────────────────────┬─────────────────┐
   │  STAGE                                  │  STATUS         │
   ├─────────────────────────────────────────┼─────────────────┤
   │  concept generated from recombination   │  DONE           │
   │  v1 rules written                       │  DONE           │
   │  v1 stress tested                       │  BROKEN         │
   │  fatal flaw identified and fixed        │  DONE           │
   │  v2 full design + ASCII                 │  DONE           │
   │  v3 three structural fixes              │  DONE           │
   │  locked rules text                      │  DONE           │
   │  print-and-play sheets                  │  DONE           │
   │  player aids, reference, scorepad       │  DONE           │
   │  assembly instructions                  │  DONE           │
   │  playtest observation sheet             │  DONE           │
   ├─────────────────────────────────────────┼─────────────────┤
   │  PRINTED                                │  not yet        │
   │  CUT                                    │  not yet        │
   │  ASSEMBLED                              │  not yet        │
   │  PLAYED BY 4 PEOPLE                     │  not yet        │
   │  LAUGHTER CONFIRMED                     │  not yet        │
   └─────────────────────────────────────────┴─────────────────┘

   Everything above the second divider is paper.
   Everything below it is the only work that matters now.
```

---

## 16. WHAT I STILL DO NOT KNOW

Honest list. These are unresolved and only play will resolve them.

```
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. Is 2 tokens the right number?                             │
   │    2 lets a liar lie twice. Maybe 1 is tighter, maybe        │
   │    3 is looser. Unknown without play.                        │
   │                                                              │
   │ 2. Does MARKED actually sting now that it is clearable?      │
   │    It might now be too soft, which would make lying free.    │
   │                                                              │
   │ 3. Does the Queen Paradox hold up?                           │
   │    If Queen-holders can reliably count their way to the      │
   │    answer, the strongest card becomes the easiest to win     │
   │    with, and the deck is unbalanced. Watch for it.           │
   │                                                              │
   │ 4. Will players actually whisper?                            │
   │    If a group refuses to whisper and just announces, the     │
   │    fatal flaw of v1 returns in person. Watch the first       │
   │    whisper.                                                  │
   │                                                              │
   │ 5. Is the Witness rule fun or just chaotic?                  │
   │    The dead having a free public lie is either the best      │
   │    moment in the game or an unearned swing. Unknown.         │
   │                                                              │
   │ 6. Does the counting layer attract or repel people?          │
   │    It rewards one kind of player and bores another.          │
   │    That may be fine. It may also split the table.            │
   └──────────────────────────────────────────────────────────────┘
```
