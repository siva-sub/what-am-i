# What Am I?

A hidden-identity game where the only thing you cannot see is your own card, and the only way to learn it is to trust someone who is allowed to lie.

Play it: **<https://siva-sub.github.io/what-am-i/>** — 3 to 8 players, no install, no account.

---

## The problem this game is built around

You are dealt a card face-out, so everyone at the table can read it except you. On your turn you name a player and ask "what am I?" They answer with a role name. The rules permit them to lie.

Telling you the truth costs them the game. You will declare the role they named, score its value, and take the round. So nobody volunteers anything true, and asking should be pointless.

What makes it work is that **a lie is traceable**. Declare wrong and you must name whoever misled you, and they leave the round with you. Lying sits at a cost rather than a wall — the band where bluffing games live. The whole design is one sentence:

> Tell the truth and lose. Lie and risk elimination. Say nothing and nobody wins.

Everything the players invent to escape that triangle — trading answers, testing one asker against another, deliberate vagueness, silence as leverage — is the actual game.

## The version that shipped was a coin flip

I built it, then measured it, and the measurement said the game did not work.

A four-player table deals 12 cards, one to each player, the rest face-down in a central pile. You can see three opponent cards. Your own identity is therefore one of **nine** cards you cannot see. One role-name answer moves that from 1/9 to 2/9. That is not enough to stake elimination on, and no amount of asking closes it.

So nobody ever reached certainty. Every round ran the full circuit with no declaration and fell through to the simultaneous guess, and the winner was whoever guessed right.

The numbers, over 400 simulated matches:

| | before | after |
| --- | --- | --- |
| declarations made from actually knowing | **0%** | **99.6%** |
| rounds ending in a forced simultaneous guess | **252%** | **0.4%** |
| rounds per match | **1.9** | **5.1** |
| declaration accuracy | **0%** | **78.5%** |

78.5% is far above chance: reading the table works, and the missing 21.5% is lies. Bots trust an answer, act on it, get burned, and cite the player who gave it. That is the loop the whole design was supposed to produce.

Four things were wrong, and three of them were structural.

**The pile was larger than the information could ever close.** Capping it at four cards makes your identity one of `pile + 1` — always 1-of-5, whether the table seats three players or eight. Two honest answers narrow that to one. `deckFor(n) = n + 4`, and it is the most important number in the game.

**Bots asked and then ignored the answer.** The knowledge function computed the unknown set from visible opponent cards and never consulted the memory of what it had been told. Asking was pure ceremony. One line fixes it, and it is the line the entire game hangs on.

**The forced guess fired before anyone could use anything.** Information arrives at the *end of your own turn* — you ask, you are answered, and only then do you know. Your next turn is a full circuit later. The simultaneous declaration triggered on the first silent lap, so a player never held information on a turn they were allowed to act on. Two laps now: the first is for asking, the second for acting on it.

**Truth had nowhere to pay off.** An honest answer only ever helped the person asking, so lying was strictly better, so every answer was a lie, so asking was worthless. Answerers now score a point when their honest answer is acted on. Honesty becomes a strategy in its own right, and the liar becomes the deviant that citation punishes.

## Playing well

Two honest answers usually pin your role down. The *What you know* panel shows the arithmetic rather than a summary, because the thought the game is made of is "I can see both Fools, so I am not a Fool," and you can only have it if the sum is on screen:

| Role | In deck | You see | Could be you |
| --- | --- | --- |---|
| Fool | 2 | 1 | 1 |
| Guard | 2 | 1 | 1 |
| Widow | 2 | 0 | 2 |
| Monk | 2 | 1 | 1 |

The round opens with the deck laid out before anything moves, so everyone starts from the same pool. Read it. Then count what is already on other people's faces.

Lie to the player about to win. Tell the truth to everyone else, and collect the counsel point.

## How multiplayer works with no server

GitHub Pages is static hosting, so there is no backend to run a lobby on. The room *is* a shared channel on a public MQTT broker over WebSocket.

```text
room code "MOTH-K7QP"
   │
   ├─ topic    = wami-v1/<sha256(code)[0:16]>   the code never goes on the wire
   └─ room key = PBKDF2(code)                   AES-GCM, everything encrypted
```

Everyone talks to the relay and never to each other, so no player needs a TURN server and nobody fails to connect. The room code is the only secret; without it the channel is noise. The honest weakness is the dependency on one public broker staying up. `?relay=wss://your.broker/mqtt` points a group at their own.

There is a second lock, because one is not enough. A room is a shared channel, so when the host sends each player their private snapshot, everyone else receives it too. Each snapshot hides its owner's card but reveals everyone else's — so anyone who kept all of them could rebuild the deck and read their own identity out of a console. Player keypairs, agreed pairwise with the host, seal each snapshot to its owner.

## Running it

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

It must be served over HTTP. ES modules and WebCrypto both refuse to run from a `file://` path.

`/?solo=4` drops straight into a practice table against bots. `/?room=MOTH-K7QP` pre-fills a room code.

## Tests

```bash
node tools/test-rules.mjs       # 55 assertions on the rules engine
node tools/test-sanitize.mjs    # 57 on the input boundary
node tools/test-handshake.mjs   # 7 on the host/guest key exchange
node tools/check-url-sinks.mjs  # no player string reaches an href or a src
node tools/check-assets.mjs     # walks the real module import graph
node tools/sim-balance.mjs 400 4 8
```

The rules engine is pure — no DOM, no network, no timers — so the host, the bots and the tests all run the same code. A rule can only be wrong in one place.

`check-assets.mjs` exists because this project once shipped a build where every button silently did nothing. `three.module.min.js` imports a sibling chunk, and vendoring only the first file makes the browser reject the entire module graph. The script follows imports rather than a hand-kept list.

`test-sanitize.mjs` covers the boundary between other players and your DOM. Names and avatars arrive over the network and are rendered as markup, so a guest could once have sent `avatar: "<img src=x onerror=…>"` and had it run in every other player's browser. That is fixed in one place now, and the fix is tested rather than asserted.

That suite also documents where the filters stop. Neither `esc()` nor `cleanName()` neutralises a URI scheme — `javascript:x=1` passes through both, because a colon is not a markup character. The app is safe in a URL position only because no player-controlled string is ever assigned to an `href` or a `src`. `check-url-sinks.mjs` enforces that, and I confirmed it fails on a deliberately injected violation rather than assuming it would.

There is a third layer under both: DOMPurify, vendored, parsing every string the HUD renders and rebuilding it from a fixed allowlist of emphasis tags with no attributes at all. That is not a fix for a live hole — the first two layers hold, and an independent audit confirmed it. It exists because those two layers are *discipline*: they work only while every ingress path strips and every sink escapes. Three layers means a future sink that forgets to escape degrades to stripped formatting rather than to script execution.

`test-handshake.mjs` pins the order of the key exchange. A guest learns the host's public key from the roster broadcast, and the transport drops anything it cannot open without a word — so if the roster ever stops being applied on the guest, a joining player is silently locked out while everything looks healthy. That bug shipped once.

`sim-balance.mjs` is the one that caught the real problem. It drives complete matches through the engine and reports how often a declaration came from knowing versus guessing. If "from certainty" drops or "circuits collapsed" climbs, the game has silently gone back to being a coin flip.

## Two editions

The web build is the streamlined rules: no abilities, tuned for a table where nobody can read the room over a socket.

`print-and-play/` is the v3 tabletop kit — 16 card faces, ability cards, witness cards and swap tokens, with whispered answers that stay private and marks that persist between rounds. It plays differently on purpose: at a table you can see a player's face while they answer, and the digital build has no equivalent.

`docs/` holds the design record, including the drafts that failed. `rules.md` is the original one-pager. `design.md` is the full exploration. `build-kit.md` is the print edition's assembly guide.

## What is here

```text
index.html          every screen, plus the crash banner
css/app.css         parchment for reading, candlelight for the table
js/cards.js         the deck, and how big it gets per table size
js/rules.js         the referee — pure, no DOM, no network, no timers
js/bots.js          practice opponents
js/table.js         the three.js table
js/net.js           MQTT over WebSocket, rooms, reconnect
js/crypto.js        room keys, player keypairs, room codes
js/sanitize.js      the boundary between other players and your DOM
js/sfx.js           synthesised sound, no audio files
js/stats.js         local win record
js/main.js          wires the above into a game
tools/              tests and the balance simulator
docs/               the design record
print-and-play/     the tabletop edition
```

Three.js and DOMPurify are vendored, so the game runs offline, does not break when a CDN changes, and cannot be surprised by an upstream version bump.

## Licence

MIT.
