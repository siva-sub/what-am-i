/* ─────────────────────────────────────────────────────────────
   net.js — rooms, with no server anywhere.

   GitHub Pages is static hosting. There is no backend to run a
   lobby on, so the waiting room is a shared channel on a public
   MQTT broker, reached over plain WebSocket.

   Three things this buys and one it costs:

     + no account, no deploy, no cold starts, no bill
     + no NAT problems — everyone talks to the relay, never to
       each other directly, so nobody needs a TURN server
     + the room code is the only secret; lose it and nothing else
       in the world can read the room
     − it depends on a public broker staying up, so three are
       raced at once and the first handshake wins

   Packet layer is hand-rolled MQTT 3.1.1: CONNECT, SUBSCRIBE,
   PUBLISH at QoS 0, PINGREQ. That is the whole protocol a room
   needs, and it is about 120 lines.
   ───────────────────────────────────────────────────────────── */

import {
  roomKey,
  seal,
  open,
  topicFor,
  makeIdentity,
  agree,
} from "./crypto.js";

const VERSION = "v1";

/* Public brokers that actually handshake and echo a frame back.
   Verified with tools/check-brokers.mjs — a great many public MQTT
   endpoints advertise WebSocket support and then never send a
   CONNACK. Keep this list honest.

   Both live entries are HiveMQ's public broker, so this is close to
   one provider. That is the honest weakness of a serverless room:
   if HiveMQ's public broker goes down, new rooms cannot form. Two
   mitigations are in place — both endpoints are held at once, and
   ?relay= lets a group point at their own broker. */
const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://mqtt-dashboard.com:8884/mqtt",
];

/** ?relay=wss://my.broker/mqtt — for anyone who wants their own. */
const customRelays = () => {
  try {
    const raw = new URLSearchParams(location.search).get("relay");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^wss?:\/\//.test(s));
  } catch {
    return [];
  }
};

const KEEPALIVE_S = 30;
const PING_EVERY_MS = 20_000;
const CONNECT_TIMEOUT_MS = 5_000;
const RECONNECT_MIN_MS = 1_500;
const RECONNECT_MAX_MS = 30_000;

/* ── MQTT 3.1.1 ─────────────────────────────────────────────── */

/* Remaining-Length is a variable byte integer: seven bits a byte,
   high bit means another byte follows. */
const encodeLength = (n) => {
  const out = [];
  do {
    let byte = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) byte |= 0x80;
    out.push(byte);
  } while (n > 0);
  return out;
};

const encStr = (str) => {
  const b = new TextEncoder().encode(str);
  return [b.length >> 8, b.length & 0xff, ...b];
};

const pkt = (type, body) =>
  new Uint8Array([type, ...encodeLength(body.length), ...body]);

const CONNECT = (id) =>
  pkt(0x10, [
    0,
    4,
    0x4d,
    0x51,
    0x54,
    0x54,
    0x04,
    0x02,
    KEEPALIVE_S >> 8,
    KEEPALIVE_S & 0xff,
    ...encStr(id),
  ]);

const SUBSCRIBE = (id, topic) =>
  pkt(0x82, [id >> 8, id & 0xff, ...encStr(topic), 0x00]);
const PUBLISH = (topic, payload) => pkt(0x30, [...encStr(topic), ...payload]);
const PINGREQ = new Uint8Array([0xc0, 0x00]);
const DISCONNECT = new Uint8Array([0xe0, 0x00]);

/* Broker frames split and coalesce MQTT packets, so hold a rolling
   buffer and cut whole packets out of it. */
const makeParser = (onPacket) => {
  let buf = new Uint8Array(0);

  return (chunk) => {
    buf = buf.length ? new Uint8Array([...buf, ...chunk]) : chunk;
    let offset = 0;
    let starved = false;

    for (;;) {
      if (buf.length - offset < 2) break;

      let multiplier = 1;
      let length = 0;
      let i = offset + 1;

      for (;;) {
        if (i >= buf.length) {
          starved = true;
          break;
        }
        const byte = buf[i++];
        length += (byte & 0x7f) * multiplier;
        if (!(byte & 0x80)) break;
        multiplier *= 128;
        if (multiplier > 128 ** 3) return void (buf = new Uint8Array(0));
      }
      if (starved) break;

      const headerLen = i - offset;
      if (buf.length - offset < headerLen + length) break;

      onPacket(buf[offset], buf.slice(i, i + length));
      offset += headerLen + length;
    }

    /* Only discard bytes actually consumed. */
    if (offset) buf = buf.slice(offset);
  };
};

/* ── broker connection ──────────────────────────────────────── */

const openBroker = (url, onPublish) =>
  new Promise((resolve) => {
    let settled = false;
    let socket;

    try {
      socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
    } catch {
      return resolve(null);
    }

    const giveUp = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(null);
    };

    const timer = setTimeout(giveUp, CONNECT_TIMEOUT_MS);

    const parse = makeParser((type, body) => {
      if ((type & 0xf0) === 0x30) {
        const topicLen = (body[0] << 8) | body[1];
        onPublish(body.slice(2 + topicLen));
      }
    });

    socket.onerror = giveUp;
    socket.onclose = giveUp;
    socket.onopen = () =>
      socket.send(CONNECT(`wami-${crypto.randomUUID().slice(0, 18)}`));

    /* CONNACK (0x20) is the first packet on the wire, and the only
       thing that counts as a successful connection. */
    socket.onmessage = (e) => {
      const data = new Uint8Array(e.data instanceof ArrayBuffer ? e.data : []);

      if (!settled) {
        if (data[0] === 0x20) {
          settled = true;
          clearTimeout(timer);
          resolve({ socket, send: (bytes) => socket.send(bytes) });
        }
        return;
      }

      parse(data);
    };
  });

/* ── the room ───────────────────────────────────────────────── */

/**
 * Open a room. Two layers of encryption:
 *
 *   room key     — derived from the code; keeps strangers out of
 *                  the channel entirely
 *   pairwise key — ECDH with each peer; keeps your private
 *                  snapshot private from the other players, which
 *                  is the difference between a game and a cheat
 *
 * Transport is deliberately multi-homed. Racing the brokers and
 * keeping the winner is faster but wrong: two players can win on
 * different brokers and then never hear each other. So we hold
 * every broker that answers, publish to all of them, and drop
 * duplicates on the way in.
 *
 * @param {object} opts
 *   code      room code
 *   onMessage ({from, payload, direct}) => void
 *   onStatus  (text) => void
 *   onLost    () => void
 */
export async function openRoom({ code, onMessage, onStatus, onLost }) {
  const [topic, rkey, identity] = await Promise.all([
    topicFor(code, VERSION),
    roomKey(code),
    makeIdentity(),
  ]);

  /* One shared secret per peer. ECDH is symmetric, so
     agree(us, theirPub) and agree(them, ourPub) are the same key —
     which means a single entry per peer both seals what we send
     them and opens what they send us. */
  const pairKeys = new Map();
  const links = [];
  const seenIds = new Set();
  let myPid = null;
  let closed = false;

  /* Every broker we hold, or none of them. A silent failure here
     looks exactly like "nobody joined the room", which is the
     most expensive possible way to debug this.

     The frame is a base64 string, so it has to be encoded to bytes
     before it goes on the wire — spreading a string into a
     Uint8Array yields characters, and characters coerce to NaN,
     which lands as a run of zero bytes that every receiver
     silently discards. Encode once, send to every link. */
  const publish = (payload) => {
    const frame = PUBLISH(topic, new TextEncoder().encode(payload));
    let sent = 0;
    for (const l of links) {
      try {
        l.send(frame);
        sent++;
      } catch {}
    }
    return sent;
  };

  const onFrame = async (frame) => {
    /* The wire carries bytes; the seal is base64 text. */
    const envelope = await open(rkey, new TextDecoder().decode(frame));
    if (!envelope) return;

    /* Duplicates arrive whenever two peers share more than one
       broker. Same message, two copies — drop the second. */
    if (envelope.id) {
      if (seenIds.has(envelope.id)) return;
      seenIds.add(envelope.id);
      if (seenIds.size > 400) seenIds.delete(seenIds.values().next().value);
    }

    if (envelope.to) {
      /* Addressed to somebody, and sealed again for them. If it
         is not ours it is ciphertext we cannot open — which is
         why a private snapshot stays private in a room where
         everybody hears every message. */
      if (envelope.to !== myPid) return;
      const key = pairKeys.get(envelope.from);
      if (!key) return;
      const inner = await open(key, envelope.b);
      if (inner) onMessage?.({ ...inner, from: envelope.from, direct: true });
      return;
    }

    onMessage?.({ ...envelope.p, direct: false });
  };

  const brokerList = () => (customRelays().length ? customRelays() : BROKERS);

  const connectAll = async () => {
    const settled = await Promise.all(
      brokerList().map((url) =>
        openBroker(url, onFrame).then((l) => (l ? { l, url } : null)),
      ),
    );
    const live = settled.filter(Boolean);
    live.forEach(attach);
    return live.length;
  };

  let reconnectDelay = RECONNECT_MIN_MS;
  let reconnectTimer = null;
  let consecutiveFails = 0;
  let toldThem = false;

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (closed) return;

      if (await connectAll()) {
        reconnectDelay = RECONNECT_MIN_MS;
        consecutiveFails = 0;
        onStatus?.(
          `reconnected — ${links.length} relay${links.length > 1 ? "s" : ""}`,
        );
        return;
      }

      consecutiveFails += 1;
      reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
      onStatus?.(
        `still down — retrying in ${Math.round(reconnectDelay / 1000)}s`,
      );

      /* Tell the UI only once, and only after the retries have
         gone on long enough to be worth a person's attention. */
      if (consecutiveFails === 3 && !toldThem) {
        toldThem = true;
        onLost?.();
      }

      scheduleReconnect();
    }, reconnectDelay);
  };

  /* A twenty-minute match outlives a single TCP connection, so
     losing every relay has to be survivable rather than fatal.
     Peer keys are already derived and survive a reconnect. */
  const attach = ({ l, url }) => {
    links.push(l);
    l.send(SUBSCRIBE(Math.floor(Math.random() * 65535), topic));

    let host = url;
    try {
      host = new URL(url).hostname;
    } catch {}
    onStatus?.(`on ${host}`);

    l.socket.addEventListener("close", () => {
      const i = links.indexOf(l);
      if (i >= 0) links.splice(i, 1);
      if (closed || links.length) return;
      onStatus?.("relay dropped — reconnecting");
      scheduleReconnect();
    });
  };

  if (!(await connectAll())) throw new Error("no relay reachable");

  onStatus?.(`connected — ${links.length} relay${links.length > 1 ? "s" : ""}`);

  const ping = setInterval(() => {
    for (const l of links) {
      try {
        l.send(PINGREQ);
      } catch {}
    }
  }, PING_EVERY_MS);

  /* A fresh id per frame, so the same message arriving from three
     brokers resolves to one delivery. */
  const envelopeOf = (body) => ({ id: crypto.randomUUID(), ...body });

  return {
    topic,
    pub: identity.pub,
    get relayCount() {
      return links.length;
    },

    setMe(pid) {
      myPid = pid;
    },

    /** Broadcast to the whole room. */
    async send(payload) {
      publish(await seal(rkey, envelopeOf({ p: payload })));
    },

    /** Seal a message so only `pid` can read it. */
    async sendTo(pid, payload) {
      const key = pairKeys.get(pid);
      if (!key) return false;
      publish(
        await seal(
          rkey,
          envelopeOf({
            to: pid,
            from: myPid,
            b: await seal(key, payload),
          }),
        ),
      );
      return true;
    },

    /** Learn a peer's public key. One entry serves both directions. */
    async trust(pid, theirPub) {
      if (!theirPub || pid === myPid || pairKeys.has(pid)) return;
      try {
        pairKeys.set(pid, await agree(identity, theirPub));
      } catch {
        /* Malformed key from a hostile peer. Ignore them. */
      }
    },

    knows(pid) {
      return pairKeys.has(pid);
    },

    leave() {
      closed = true;
      clearInterval(ping);
      clearTimeout(reconnectTimer);
      for (const l of links) {
        try {
          l.send(DISCONNECT);
        } catch {}
        try {
          l.socket.close();
        } catch {}
      }
      links.length = 0;
    },
  };
}
