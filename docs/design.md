# WHAT AM I? — Full design document (v2)

**Status:** v1 one-pager (`what-am-i-rules.md`) is **broken**. This document explains why, fixes it, and expands the game to a buildable state.

---

## 1. STRESS TEST

Seven findings. The first one kills the game, so it goes first.

### FINDING 1 — FATAL: public answers make lying impossible

**Symptom.** Nobody ever lies. The game becomes a race to ask first.

**Cause.** In v1, answers were spoken aloud, and every player can see every card except their own. So when Carol tells Alice "you're the Widow," five other players are looking at Alice's actual card and can correct the lie instantly, for free.

```
   v1 — ANSWER SPOKEN ALOUD                    v2 — ANSWER WHISPERED
   ─────────────────────────                   ──────────────────────────

   CAROL: "Alice, you're the Widow."            CAROL: ·whisper· "Widow"
                                                   │
   DAN:  ·looking at Alice's card·                 │  only Alice hears it
         "That's a lie. You're the Prince."        │
                                                   ▼
   ┌──────────────────────────────┐            ┌──────────────────────┐
   │ lie detected in 0.4 seconds  │            │ the lie SURVIVES     │
   │ liar publicly humiliated     │            │ nobody can correct it│
   │ nobody lies again, ever      │            │ Alice must decide    │
   └──────────────────────────────┘            └──────────────────────┘
                    │                                     │
                    ▼                                     ▼
        GAME = "who asks first"                GAME = reading people
        ─────────────────────                  ────────────────────
        No bluffing.                           Bluffing is the core.
        No deduction.                          Cross-checking costs turns.
        No game.                               Actual game.
```

**Fix.** All answers are private, whispered into the asker's ear. The table sees *who talks to whom* (public) but never *what was said* (private). The correction channel disappears; the lie lives.

**This also restores the "space" dial from the Among Us analysis.** There is no board, but the visible pattern of whispers is spatial evidence — who consulted whom, who refused, who was shunned. That's the mechanic that makes the social layer legible.

---

### FINDING 2 — FATAL-ADJACENT: citation-elimination makes lying strictly suicidal

**Symptom.** In v1, a wrong declaration killed you *and* your source. So lying was always a trade of one life for one life, at best a coin flip, with no upside. Lying was irrational, so nobody would lie. Combined with Finding 1, the game had no deception left at all.

**Fix.** Delete the source's death. Lying now has a *profit* (a rival leaves the field) and a *cost* (you get MARKED, and being MARKED blocks you from declaring, so you cannot win the round).

```
        BEFORE (v1)                          AFTER (v2)
   ┌─────────────────────┐            ┌─────────────────────┐
   │ lie → victim fails  │            │ lie → victim fails  │
   │     → BOTH DIE      │            │     → you SURVIVE   │
   │                     │            │     → you're MARKED │
   │ payoff: 0, risk: ∞  │            │ payoff: +1 rival    │
   └─────────────────────┘            │ risk:   lose your   │
   never rational to lie              │         own win     │
                                      └─────────────────────┘
                                       rational ONCE, costly twice
```

**Why MARKED instead of death.** A liar who dies can't keep playing, and the table loses the story. A liar who is *marked* — visibly, publicly, permanently in that round — stays in the game as a known unreliable actor. That's how bluffing games actually work: the cost of lying is your credibility, not your life.

---

### FINDING 3 — SERIOUS: state machine needs a question economy, not a token economy

**Symptom.** If asking is free, you whisper to all five other players, compare notes, take the majority, and the truth is reconstructed. Lying dies again through sheer sampling.

**Fix.** **One action per turn.** On your turn you either ask one person, or declare, or swap. Cross-checking two players therefore costs two full circuits of the table. Meanwhile the game is running and someone else may win. Scarcity comes from *turn order*, not from a fiddly token economy — and turn order is a concept players already understand.

```
   COST OF VERIFYING ONE CARD
   ──────────────────────────────────────────────
   ask player 1 ......  1 turn
   ask player 2 ......  2 turns   ← agreement is now evidence
   ask player 3 ......  3 turns   ← someone else may have won
   ──────────────────────────────────────────────
   Turn scarcity IS the bluffing window.
```

---

### FINDING 4 — SERIOUS: the "cite your source" rule is arbitrary if answers aren't recorded

**Symptom.** You declare wrong, then choose whom to blame. Blame is retroactive, unfalsifiable, and becomes a social weapon unrelated to what actually happened.

**Fix.** Answers are whispered, so they cannot be recorded publicly without breaking Finding 1's fix. Instead the rule becomes **self-serving and non-arbitrary**: you name your source only because it *helps you*. Being misled is your excuse for failing.

```
   ┌────────────────────────────────────────────────────┐
   │  YOU DECLARED WRONG. You are OUT regardless.       │
   │                                                    │
   │  Naming a source does nothing for you.             │
   │  It only MARKs a rival who cannot now win.         │
   │                                                    │
   │  ▸ A dying player's last act is spite.             │
   │  ▸ Spite is free, legal, and often deserved.       │
   │  ▸ It is also completely unverifiable.             │
   └────────────────────────────────────────────────────┘
```

This is better than the original rule. The dying player's accusation is a *claim*, not a verdict. The table has to decide whether the marked player actually lied — and they usually can't. Uncertainty is preserved.

---

### FINDING 5 — MODERATE: eliminated players sit out, which is boring

**Symptom.** A wrong declaration removes you from a three-minute round with nothing to do. In a party game this is the worst outcome available.

**Fix.** The **Witness rule**. An eliminated player may, once before the round ends, publicly announce one card they can see — and may lie.

```
   ELIMINATED?  →  you become a WITNESS
                   ┌──────────────────────────────┐
                   │ once per round:              │
                   │ point at any player and say  │
                   │ out loud what they are       │
                   │                              │
                   │ TRUTH or LIE — your choice   │
                   └──────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
      a free truth handed                    a lie from someone
      to the table — who takes it?           with nothing to lose
```

The dead have nothing to lose, so they are the only players with no reason to lie — and they know it, and can exploit it. That is a great final act, and it keeps dead players at the table instead of on their phones.

---

### FINDING 6 — MODERATE: downtime at six players

**Symptom.** One action per turn means five turns of waiting between your actions at a six-player table. A circuit is roughly 90 seconds. That is the upper limit of tolerable.

**Ruling.** Recommend **4–5 players**. Six works but sags. Seven or more needs a different structure (see Variants).

```
   PLAYERS   TURNS BETWEEN YOUR ACTIONS   VERDICT
   ───────────────────────────────────────────────────────
      3            2 turns                tense, fast, brutal
      4            3 turns                ← SWEET SPOT
      5            4 turns                ← SWEET SPOT
      6            5 turns                playable, drags
      7+            6+ turns               restructure
```

---

### FINDING 7 — MINOR: swaps create bookkeeping, not decisions

**Symptom.** Card movement implies tracking, and tracking is the bookkeeping we removed from the design.

**Fix.** Keep swaps but make them **fully public and once per round**. Everyone sees who swapped and sees the new card immediately. Nothing to track — the information changes, it doesn't accumulate.

**Why keep it at all.** It is the only escape valve from a bad card, and it lets a player deliberately reset what the table knows about them. It also gives a marked player one last route back into relevance.

```
   SWAP ──► discard your card face-down to the pile
        ──► draw the top card, hold it FACE-OUT
        ──► everyone sees your new identity
        ──► you do not

        ┌─────────────┐        ┌─────────────┐
        │   ▓ QUEEN   │        │   ▓ WIDOW   │
        │  (before)   │  ────► │  (after)    │
        └─────────────┘        └─────────────┘
        you were told          you don't know
        "Queen" for 3 turns    if your informants
                               were ever honest
```

---

## 2. THE v2 RULES

```
┌────────────────────────────────────────────────────────────────────┐
│  WHAT AM I?                                                        │
│                                                                    │
│  You cannot read your own identity. Everyone else can.             │
│  They have every reason to lie about it.                           │
│  You must act before someone else guesses theirs.                  │
└────────────────────────────────────────────────────────────────────┘
```

**Players 4–5** (3 minimum, 6 maximum) · **Round 3 min** · **Match 15–25 min**
**Components:** 12 role cards · 6-card central pile · one card holder per player (or a rubber band)

### SETUP

1. Shuffle all 12 role cards.
2. Deal **one card to each player, held face-out**. You may read every card at the table except your own.
3. **Never** tell a player their card. Never confirm. Never let them look.
4. Place the remaining cards **face-down** as the central pile.
5. Each player takes **2 swap tokens**.

### TURN — do exactly one

```
┌───────────────────┬───────────────────┬───────────────────┐
│       ASK         │      DECLARE      │       SWAP        │
├───────────────────┼───────────────────┼───────────────────┤
│ whisper to ONE    │ say your role out │ spend 1 token     │
│ player: "what am  │ loud. The table   │ discard your card │
│ I?"               │ reads your card.  │ face-down, draw   │
│                   │                   │ top of pile, hold │
│ They may lie.     │ Correct → score.  │ it face-out.      │
│ Refusing is legal │ Wrong → you are   │ (once per round,  │
│ and is a tell.    │ OUT.              │  public)          │
└───────────────────┴───────────────────┴───────────────────┘
```

### DECLARING

```
                    ┌──────────────────────┐
                    │  "I AM THE PRINCE"   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ table flips your card│
                    │ and reads it aloud   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
     ┌─────────────────┐              ┌──────────────────────┐
     │    CORRECT      │              │       WRONG          │
     ├─────────────────┤              ├──────────────────────┤
     │ score = value   │              │ you are OUT          │
     │   of your card  │              │                      │
     │ round ends      │              │ you may optionally   │
     └─────────────────┘              │ name whoever misled  │
                                      │ you. If named:       │
                                      │   ▸ they are MARKED  │
                                      │   ▸ they cannot      │
                                      │     declare          │
                                      └──────────────────────┘
```

**MARKED means:** for the rest of the round, you cannot declare. You can still ask, still answer, still swap. You simply cannot win this round.

**A player cannot be MARKED without a dying player's accusation.** No one else can mark anyone.

### FORCED DECLARATION

If a **full circuit** passes with nobody declaring, everyone declares simultaneously by pointing at the role list.

```
   all correct      → nobody scores, round is a draw
   one correct      → they score
   all wrong        → round goes to the pile, nobody scores
```

This exists so the game cannot stall. It also means stalling is a real gamble: at 5 players you can see 4 of 12 cards, so your identity is one of 8 unknowns.

```
   BASELINE ODDS OF A BLIND GUESS
   ───────────────────────────────────────────────
   players   you see   unknown pool   blind hit rate
   ───────────────────────────────────────────────
      3         2            10            10%
      4         3             9            11%
      5         4             8           12.5%
      6         5             7            14%
   ───────────────────────────────────────────────
   Stalling is never correct. It is only desperate.
```

### MATCH

First to **5 points** wins. Points equal the value of the card you correctly declared. Rounds take about three minutes.

---

## 3. THE ONE MECHANIC THAT IS THE WHOLE GAME

```
   WHO CAN READ WHOSE CARD          ✓ = may read      — = forbidden

                 Alice   Bob   Carol   Dan    Eve
          Alice │   —     ✓     ✓      ✓      ✓
          Bob   │   ✓     —     ✓      ✓      ✓
          Carol │   ✓     ✓     —      ✓      ✓
          Dan   │   ✓     ✓     ✓      —      ✓
          Eve   │   ✓     ✓     ✓      ✓      —

     ┌────────────────────────────────────────────────────┐
     │  ▸ Every player sees 4 cards and is blind to 1.    │
     │  ▸ That one blind cell is the entire game.         │
     │  ▸ Five people know the answer.                    │
     │  ▸ Zero of them benefit from telling you.          │
     └────────────────────────────────────────────────────┘
```

---

## 4. THE DECK

```
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │       1       │  │       2       │  │       3       │
   │               │  │               │  │               │
   │     FOOL      │  │     GUARD     │  │     WIDOW     │
   │               │  │               │  │               │
   │    × 2        │  │    × 2        │  │    × 2        │
   └───────────────┘  └───────────────┘  └───────────────┘

   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │       4       │  │       5       │  │       6       │
   │               │  │               │  │               │
   │     MONK      │  │    ORACLE     │  │     JUDGE     │
   │               │  │               │  │               │
   │    × 2        │  │    × 1        │  │    × 1        │
   └───────────────┘  └───────────────┘  └───────────────┘

   ┌───────────────┐  ┌───────────────┐
   │       7       │  │       8       │
   │               │  │               │
   │    PRINCE     │  │     QUEEN     │
   │               │  │               │
   │    × 1        │  │    × 1        │
   └───────────────┘  └───────────────┘

   VALUE  ROLE     COPIES      total value in deck
   ────────────────────────────────────────────────
     1    FOOL        2              2
     2    GUARD       2              4
     3    WIDOW       2              6
     4    MONK        2              8
     5    ORACLE      1              5
     6    JUDGE       1              6
     7    PRINCE      1              7
     8    QUEEN       1              8
                     ───            ───
                     12             46

   ▸ FOUR of the twelve cards are worth 8 points of
     the deck's total 46. High cards are scarce, so
     a "you're the Queen" claim is unusual and loud.
   ▸ TWO copies each of the low cards means a low
     claim is often *almost* true, which is the
     liar's favourite hiding place.
```

**No abilities.** The role is a label and a score. This is deliberate — every mechanic removed is depth the players supply for free.

---

## 5. THE ECONOMY OF TRUTH

The single hardest thing to design in this game: **why would anyone ever tell the truth?**

```
   ┌─────────────────────────────────────────────────────────┐
   │                    TELL THE TRUTH                       │
   │  They declare correctly. They score. The round ends.    │
   │  You have handed a rival up to 8 points.                │
   │                                                         │
   │  PAYOFF: negative.                                      │
   └─────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────┐
   │                        LIE                              │
   │  They declare wrong. They are out. You survive.         │
   │  If they are spiteful, you are MARKED and cannot win.   │
   │                                                         │
   │  PAYOFF: one rival removed, at the price of your round. │
   └─────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────┐
   │                     SAY NOTHING                         │
   │  Refuse to answer, or answer uselessly ("maybe a Monk") │
   │  Nobody scores. You keep your options.                  │
   │                                                         │
   │  PAYOFF: zero, and it is safe.                          │
   └─────────────────────────────────────────────────────────┘
```

**All three options are bad. That is the design.**

Truth is a *sacrifice*, not a strategy. So truth only appears in three situations:

```
   1. KINGMAKING ── you cannot win this round, so you choose who does.
                    Your truth is a gift, and gifts make allies.

   2. TRADE ─────── "tell me mine and I'll tell you yours."
                    Both learn. Both race to declare.
                    ┌──────────────────────────────────────┐
                    │ only the player whose TURN it is can │
                    │ declare, so the trade is safe only   │
                    │ if their turn comes AFTER yours.     │
                    └──────────────────────────────────────┘

   3. COLLAPSE ──── you are about to lose anyway. Ending the round
                    now costs you nothing.
```

**This is the engine.** Nobody is ever forced to lie, and nobody is ever rewarded for honesty. Everything else — whispered trades, watched conversations, refusals as tells, spite accusations — is emergent, and none of it is in the rulebook.

---

## 6. TURN FLOW

```
                          ┌──────────────────┐
                          │   YOUR TURN      │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      ┌───────────────┐   ┌────────────────┐   ┌───────────────┐
      │     ASK       │   │    DECLARE     │   │     SWAP      │
      │               │   │                │   │               │
      │ pick ONE      │   │ say your role  │   │ once / round  │
      │ player        │   │ out loud       │   │ public        │
      │               │   │                │   │               │
      │ whisper:      │   │ table reads    │   │ you stay      │
      │ "what am I?"  │   │ your card      │   │ blind, table  │
      │               │   │                │   │ re-reads you  │
      │ answer is     │   │                │   │               │
      │ PRIVATE       │   │                │   │               │
      └───────┬───────┘   └───────┬────────┘   └───────┬───────┘
              │                   │                    │
              └───────────────────┼────────────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │  NEXT PLAYER'S TURN  │
                       └──────────────────────┘
```

```
   THE TABLE SEES                        THE TABLE DOES NOT SEE
   ─────────────────────────────         ──────────────────────────
   who whispered to whom                 what was whispered
   who was refused (a tell)              whether it was true
   who swapped                           whether a refusal was
   who is MARKED                          honest ignorance or
   who was accused of lying               strategic silence
```

---

## 7. ROUND TIMELINE

```
   t=0                                                        t=3min
   │                                                             │
   ├──── SETUP ────┬────── CIRCUIT 1 ──────┬──── CIRCUIT 2 ──────┤
   │               │                       │                     │
   │ deal 12       │ 5 turns of asking     │ more asking         │
   │ cards         │ 1 swap usually        │ TEMPO RISES         │
   │ face-out      │ nobody declares yet   │ somebody gambles    │
   │               │                       │                     │
   └───────────────┴───────────────────────┴─────────────────────┘
                                                                  │
             if no circuit ends in a declaration ─────────────────┘
                              ▼
                  ┌────────────────────────┐
                  │  FORCED DECLARATION    │
                  │  everyone simultaneously│
                  │  ~12% hit rate each    │
                  └────────────────────────┘
```

**Pacing note.** The interesting pressure is that the forced declaration is *always* coming. Every circuit that passes without a win makes a blind gamble more likely — so the round has a fuse even when nobody is talking.

---

## 8. WORKED EXAMPLE — one round, four players

```
   ┌──────────────────────────────────────────────────────────────┐
   │  DEALT                                                       │
   │                                                              │
   │    ALICE      BOB      CAROL      DAN                        │
   │   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                     │
   │   │QUEEN │  │MONK  │  │FOOL  │  │WIDOW │   ← all face-out    │
   │   └──────┘  └──────┘  └──────┘  └──────┘                     │
   │                                                              │
   │   centre pile:  ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓   (8 unknown)                │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 1 · ALICE ─────────────────────────────────────────────┐
   │ Alice whispers to Bob: "what am I?"                          │
   │ Bob: "you're the Widow."                                     │
   │                                                              │
   │   Bob is lying. He is holding the Monk (4) and wants        │
   │   Alice out of the round. The lie is safe because           │
   │   nobody heard it.                                          │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 2 · BOB ───────────────────────────────────────────────┐
   │ Bob whispers to Carol: "what am I?"                         │
   │ Carol: "the Monk."   ← true, and Carol regrets it at once   │
   │                                                              │
   │   Carol told the truth because Bob's turn already passed     │
   │   and she wants him to owe her later.                        │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 3 · CAROL ─────────────────────────────────────────────┐
   │ Carol asks Dan. Dan says: "the Widow."    ← lie              │
   │ Carol, who is the Fool, now believes she is a Widow (3)      │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 4 · DAN ───────────────────────────────────────────────┐
   │ Dan DECLARES: "I am the Queen."                              │
   │                                                              │
   │   WRONG. He is the Widow. Dan is OUT.                        │
   │   Dan names Bob as his source — Bob told him "Queen"         │
   │   two turns earlier.                                         │
   │                                                              │
   │   Bob is now MARKED. Bob cannot declare this round.          │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 5 · ALICE ─────────────────────────────────────────────┐
   │ Alice now holds two claims: Bob said "Widow".                │
   │ Bob has just been revealed as a liar.                        │
   │                                                              │
   │   If Bob lied to Dan, he probably lied to Alice.            │
   │   So Alice's smartest move is to ask Carol — but           │
   │   that costs her the turn, and Carol is the Fool,          │
   │   who has her own reasons to mislead.                       │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 6 · BOB (marked, cannot declare) ──────────────────────┐
   │ Bob asks Alice. Alice, spurned, refuses to answer.           │
   │ The refusal is public. Bob now has no information at all.    │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 7 · CAROL ─────────────────────────────────────────────┐
   │ Carol DECLARES: "I am the Widow."                            │
   │                                                              │
   │   WRONG. She is the Fool (1). Carol is OUT.                  │
   │   Carol names Dan.                                            │
   │                                                              │
   │   Dan is already out, so nothing happens. A spite            │
   │   accusation against a dead man is wasted.                   │
   └──────────────────────────────────────────────────────────────┘

   ┌─ TURN 8 · ALICE ─────────────────────────────────────────────┐
   │ Alice DECLARES: "I am the Queen."                            │
   │                                                              │
   │   CORRECT. Alice scores 8.                                   │
   │                                                              │
   │   Bob is the only other survivor and he is MARKED,           │
   │   so the round is over by arithmetic.                        │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │  SCORE   ALICE 8   │   BOB 0   │   CAROL 0   │   DAN 0       │
   │                                                              │
   │  STORY: Bob lied successfully twice and lost anyway,         │
   │  because the second person he lied to got lucky, and         │
   │  the first person he lied to was left holding a claim        │
   │  she no longer trusted.                                      │
   └──────────────────────────────────────────────────────────────┘
```

---

## 9. EMERGENT STRATEGIES

These were not designed. They fall out of the rules, which is the test of whether the rules are any good.

```
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. THE TRADE           "Tell me mine, I'll tell you yours."  │
   │                                                              │
   │    Safe only if their turn comes after yours.                │
   │    So the negotiation is always about TURN ORDER.            │
   │    Both parties learn their card. Whoever's turn is          │
   │    next declares. The trade is a duel disguised as a gift.   │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │ 2. THE REFUSAL AS TELL                                        │
   │                                                              │
   │    Refusing to answer is legal. It is also informative.      │
   │    Refusing someone you could safely help means you would    │
   │    be lying — so refusal leaks "I am not on your side."      │
   │    Meanwhile a fluent, immediate answer looks honest and     │
   │    is the cheapest place to hide a lie.                      │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │ 3. THE TABLE PACT                                             │
   │                                                              │
   │    "Let's all tell the truth, then we all know and we race." │
   │    It is legal, it is tempting, and it is self-defeating:    │
   │    whoever's turn lands first wins on the spot.              │
   │    The pact collapses the moment someone does the arithmetic.│
   │    Expect it once per playgroup. Let it happen.              │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │ 4. THE SPITE MARK                                             │
   │                                                              │
   │    A dying player marking a rival costs nothing and is       │
   │    unverifiable. Expect it to be used against whoever is     │
   │    leading, regardless of whether they lied.                 │
   │    This is a feature: it means the leader cannot be safe.    │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │ 5. THE MIRROR LIE                                             │
   │                                                              │
   │    Telling someone the role they are ALREADY most likely     │
   │    to be — the lowest remaining card — is nearly honest,     │
   │    so it survives scrutiny, and it kills them anyway if      │
   │    their real card was higher.                               │
   │    Note the deck has two copies of every low card:           │
   │    low claims are the liar's camouflage.                     │
   └──────────────────────────────────────────────────────────────┘
```

---

## 10. EDGE CASES AND RULINGS

```
   ┌──────────────────────────────────────────────────────────────┐
   │ PLAYER GLIMPSES THEIR OWN CARD                                │
   └──────────────────────────────────────────────────────────────┘
   They must DECLARE IMMEDIATELY, using whatever they just saw.
   No exception, no grace period.

     ┌────────────┐     ┌─────────────────────┐
     │  glimpse   │ ──► │ declare right now   │ ──► correct = score
     └────────────┘     └─────────────────────┘     wrong   = out

   This is harsh on purpose. It removes the accident as a
   source of advantage, and it is spectacular when it happens.
   Nobody ever risks an accidental glance twice.

   ┌──────────────────────────────────────────────────────────────┐
   │ IS THE HOLDER ALLOWED TO REASON INTO THEIR OWN CARD?          │
   └──────────────────────────────────────────────────────────────┘
   YES, absolutely, and it is a major skill.
      ▸ You see 4 of 12 cards → your card is one of 8 unknowns.
      ▸ If the pile has been swapped from, the odds shift.
      ▸ If someone truthfully said "not the Queen," narrow further.
   Counting is legal. It caps out at 12.5%, so it is never
   sufficient on its own — it only sharpens a guess.

   ┌──────────────────────────────────────────────────────────────┐
   │ WHAT IF EVERYONE ANSWERS TRUTHFULLY, FOREVER?                 │
   └──────────────────────────────────────────────────────────────┘
   Then the player with the earliest turn wins immediately and
   the game is over in one circuit. Everyone can see this.
   So it never happens twice.

   ┌──────────────────────────────────────────────────────────────┐
   │ WHISPERS, CODES, SIGNS                                        │
   └──────────────────────────────────────────────────────────────┘
      ▸ Whispers only. No written notes. No phones.
      ▸ A whisper must be quiet enough that only the asker hears.
      ▸ Codes and signals are LEGAL. If someone else overhears,
        that is public information and fair game.
      ▸ Anything a player claims was whispered is unverifiable,
        and that is the point.

   ┌──────────────────────────────────────────────────────────────┐
   │ MARKS STACK?                                                  │
   └──────────────────────────────────────────────────────────────┘
   No. MARKED is binary. You can ask, answer and swap freely.
   You simply cannot declare, so you cannot win this round.

   ┌──────────────────────────────────────────────────────────────┐
   │ CAN YOU ASK ABOUT SOMEONE ELSE'S CARD?                        │
   └──────────────────────────────────────────────────────────────┘
   NOT in the base game. Base game questions are only ever
   "what am I?" This is a variant hook (see 11.3) because it
   changes the game a lot: it lets you lie about a third party
   who cannot object.

   ┌──────────────────────────────────────────────────────────────┐
   │ CAN YOU DECLARE FOR SOMEONE ELSE?                             │
   └──────────────────────────────────────────────────────────────┘
   No. Only your own identity, only on your turn.

   ┌──────────────────────────────────────────────────────────────┐
   │ WHAT IF TWO PLAYERS WOULD WIN ON THE SAME CARD?               │
   └──────────────────────────────────────────────────────────────┘
   Impossible on a turn order. Turns are strictly sequential.
   The forced declaration is the only simultaneous moment, and
   ties there score nobody.
```

---

## 11. VARIANTS

### 11.1 Duel — 2 players

```
   ┌──────────────┐        ┌──────────────┐
   │   PLAYER A   │        │   PLAYER B   │
   │  ▓ face-out  │        │  ▓ face-out  │
   └──────────────┘        └──────────────┘
              centre pile: ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ (8)

   8 cards dealt from a 10-card pool. 2 in the centre.

   The whole game is one question: do you believe them?
   Every ask is a coin flip dressed as a conversation.
   Match to 3 points. Rounds are 90 seconds.
```

### 11.2 Big Table — 7–8 players

```
   16 cards, 8 dealt, 8 in the centre pile.
   3-minute discussion cap per circuit.
   If nobody declares in two consecutive circuits,
   forced declaration triggers.
```

Downtime is the enemy here. Do not run base rules at 8.

### 11.3 Third-Party Questions

You may ask "what is Carol?" instead of "what am I?"

```
   ┌──────────────────────────────────────────────────────────┐
   │ This is the highest-value variant and the most dangerous.│
   │                                                          │
   │ ▸ You can now lie about someone who is not in the        │
   │   conversation, and they cannot object in the moment.    │
   │ ▸ It creates coalitions, since two people can agree      │
   │   on a story about a third.                              │
   │ ▸ It also lets a player learn a rival's card without     │
   │   the rival knowing that anyone asked.                   │
   │                                                          │
   │ Play base game first. This variant roughly doubles the   │
   │ strategic surface.                                       │
   └──────────────────────────────────────────────────────────┘
```

### 11.4 Abilities

Only add these if the base game feels thin, which it probably will not.

```
   FOOL    · once per round, ask a second question on your turn
   GUARD   · immune to being MARKED
   WIDOW   · may look at one central pile card, once
   MONK    · refuse an ask without it counting as a refusal-tell
   ORACLE  · may ask a question out of turn
   JUDGE   · may accuse a player of lying; if wrong, you are out
   PRINCE  · on declaration, score double
   QUEEN   · you may declare out of turn
```

Each of these adds a rules question, a timing question and an argument. That is the cost.

### 11.5 No-Declaration Opening

Nobody may declare during the first circuit. Forces information trading to happen before anyone can win, and makes the spite-mark rule matter more.

---

## 12. COMPONENTS AND PRINT SHEET

```
   ═══════════════════════════════════════════════════════
     WHAT AM I?   ·   print sheet   ·   1 page
   ═══════════════════════════════════════════════════════

     ROLE CARDS  (12)                    cut on the lines

   ┌────────┐┌────────┐┌────────┐┌────────┐
   │   1    ││   1    ││   2    ││   2    │
   │  FOOL  ││  FOOL  ││ GUARD  ││ GUARD  │
   └────────┘└────────┘└────────┘└────────┘
   ┌────────┐┌────────┐┌────────┐┌────────┐
   │   3    ││   3    ││   4    ││   4    │
   │ WIDOW  ││ WIDOW  ││  MONK  ││  MONK  │
   └────────┘└────────┘└────────┘└────────┘
   ┌────────┐┌────────┐┌────────┐┌────────┐
   │   5    ││   6    ││   7    ││   8    │
   │ ORACLE ││ JUDGE  ││ PRINCE ││ QUEEN  │
   └────────┘└────────┘└────────┘└────────┘

   SWAP TOKENS      2 per player, printed 10-up
   ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
   │ SWAP ││ SWAP ││ SWAP ││ SWAP ││ SWAP │
   └──────┘└──────┘└──────┘└──────┘└──────┘

   ROLE REFERENCE   1 per table, for forced declarations
   ┌────────────────────────────────────────────┐
   │  1 FOOL   2 GUARD   3 WIDOW   4 MONK       │
   │  5 ORACLE 6 JUDGE   7 PRINCE  8 QUEEN      │
   └────────────────────────────────────────────┘

   CARD HOLDERS     fold a strip of card into a tent,
                    slot the card in, prop it up.
                    ┌─────┐
                    │ ▲▲▲ │  ← card visible to
                    │ ▲▲▲ │    everyone in front
                    └─────┘
   ═══════════════════════════════════════════════════════
```

Total cost at a copy shop: one sheet of card, one sheet of paper, ten minutes.

---

## 13. FUN AUDIT — honest assessment

```
   ┌───────────────────────────────────────┬────────┬──────────────────┐
   │ WHAT                                  │ WORKS? │ WHY              │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ The whisper                           │  YES   │ It is intimate,  │
   │                                       │        │ fast, and the    │
   │                                       │        │ table watches    │
   │                                       │        │ every one        │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ Watching who talks to whom            │  YES   │ Free social      │
   │                                       │        │ evidence, no     │
   │                                       │        │ rules           │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ The declaration                       │  YES   │ 5 seconds of     │
   │                                       │        │ genuine suspense │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ Someone acting on a lie for 3 turns   │  YES   │ This is the story│
   │                                       │        │ people retell    │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ The spite mark                        │  MOSTLY│ Great drama,     │
   │                                       │        │ slightly unfair  │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ Counting the deck                     │  MAYBE │ Rewards system   │
   │                                       │        │ thinkers, bores  │
   │                                       │        │ social players   │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ Sitting out after a bad guess         │  FIXED │ Witness rule     │
   │                                       │        │ handles it       │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ Six-player downtime                   │  RISK  │ Cap at 5         │
   ├───────────────────────────────────────┼────────┼──────────────────┤
   │ A table where nobody trusts anyone    │  RISK  │ If lying is too  │
   │                                       │        │ cheap the round  │
   │                                       │        │ fizzles to zero  │
   └───────────────────────────────────────┴────────┴──────────────────┘
```

**The two real risks, stated plainly:**

```
   RISK 1 · THE FIZZLE
   Everyone lies, everyone gets marked, nobody can declare,
   the round goes to the pile and scores zero.

   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
   │MARKED│   │MARKED│   │MARKED│   │MARKED│   → 0 points
   └──────┘   └──────┘   └──────┘   └──────┘
   Mitigation: if every player is MARKED, the round
   immediately resets and redeals. Cheap, fast, no
   arguing about it.

   RISK 2 · THE RACE
   Two players trade truths on turn 1 and 2, one declares,
   round over in 40 seconds. Repeatedly.

   Mitigation: the No-Declaration Opening variant (11.5).
   If this becomes the norm, adopt it permanently.
```

---

## 14. PLAYTEST PROTOCOL

Run four rounds, four players. Write down answers to these six questions. Nothing else matters yet.

```
   ┌────┬──────────────────────────────────────────────────────┐
   │ 1  │ Did anyone ever give a truth for free?               │
   │    │ If yes → the incentive triangle is leaking.          │
   ├────┼──────────────────────────────────────────────────────┤
   │ 2  │ Did any round end by forced declaration?             │
   │    │ If more than one → the fuse is too short or          │
   │    │ asking is too expensive.                            │
   ├────┼──────────────────────────────────────────────────────┤
   │ 3  │ Did anyone trade ("you tell me mine")?               │
   │    │ If never → the game is not reaching its best state.  │
   ├────┼──────────────────────────────────────────────────────┤
   │ 4  │ How long was the longest turn gap?                   │
   │    │ Over 90 seconds → cut to 4 players.                 │
   ├────┼──────────────────────────────────────────────────────┤
   │ 5  │ Did the MARKED rule ever matter?                     │
   │    │ If never → cut the spite mark and just let          │
   │    │ wrong declarers be out.                             │
   ├────┼──────────────────────────────────────────────────────┤
   │ 6  │ Did anyone laugh? Write down why.                    │
   │    │ This is the only metric that actually predicts       │
   │    │ whether the game is worth another hour of work.      │
   └────┴──────────────────────────────────────────────────────┘
```

**Stop rule.** If question 6 has no answer after four rounds, kill the design. Do not iterate on a game that produced no laughter.
