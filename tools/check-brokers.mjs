/* ─────────────────────────────────────────────────────────────
   check-brokers.mjs — which public relays actually handshake.

   The room layer races and holds every broker that answers, so a
   dead one costs nothing at runtime. But a broker that answers and
   then silently drops frames costs everything, and looks exactly
   like "nobody joined the room". Run this before trusting a list.

     node tools/check-brokers.mjs
   ───────────────────────────────────────────────────────────── */

const CANDIDATES = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://test.mosquitto.org:8081",
  "wss://mqtt.eclipseprojects.io:443/mqtt",
  "wss://mqtt.eclipseprojects.io/mqtt",
  "wss://broker.mqttdashboard.com:8000/mqtt",
  "wss://mqtt-dashboard.com:8884/mqtt",
  "wss://broker.hivemq.com:8883/mqtt",
];

const enc = (s) => {
  const b = new TextEncoder().encode(s);
  return [b.length >> 8, b.length & 0xff, ...b];
};

const vlen = (n) => {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
};

const pkt = (t, b) => new Uint8Array([t, ...vlen(b.length), ...b]);

const TOPIC = `wami-probe-${Math.random().toString(36).slice(2, 10)}`;
const TIMEOUT = 6000;

/* Full round trip: connect, subscribe, publish, receive it back.
   A CONNACK alone is not proof — a broker can accept a session and
   still never deliver a frame. */
function check(url) {
  return new Promise((resolve) => {
    const result = { url, connack: false, suback: false, echoed: false };
    let ws;

    const done = () => {
      try {
        ws?.close();
      } catch {}
      resolve(result);
    };

    const timer = setTimeout(done, TIMEOUT);

    try {
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
    } catch (e) {
      result.error = e.message;
      clearTimeout(timer);
      return resolve(result);
    }

    let subscribed = false;

    ws.onopen = () => {
      ws.send(
        pkt(0x10, [
          0,
          4,
          0x4d,
          0x51,
          0x54,
          0x54,
          0x04,
          0x02,
          0,
          30,
          ...enc(`probe-${Math.random().toString(36).slice(2, 10)}`),
        ]),
      );
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      clearTimeout(timer);
      done();
    };

    ws.onmessage = (e) => {
      const d = new Uint8Array(e.data);
      const type = d[0];

      if (type === 0x20) {
        result.connack = true;
        ws.send(pkt(0x82, [0, 1, ...enc(TOPIC), 0x00]));
      } else if (type === 0x90) {
        result.suback = true;
        if (!subscribed) {
          subscribed = true;
          ws.send(
            pkt(0x30, [...enc(TOPIC), ...new TextEncoder().encode("ping")]),
          );
        }
      } else if ((type & 0xf0) === 0x30) {
        result.echoed = true;
        clearTimeout(timer);
        done();
      }
    };
  });
}

console.log("probing public MQTT-over-WebSocket brokers\n");

const results = await Promise.all(CANDIDATES.map(check));

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad("broker", 46)} ${pad("CONNACK", 8)} ${pad("SUBACK", 7)} round-trip`,
);
console.log("─".repeat(78));

for (const r of results) {
  const host = r.url.replace("wss://", "");
  const mark = (v) => (v ? "  yes  " : "  no   ");
  console.log(
    `${pad(host, 46)} ${pad(mark(r.connack), 8)} ${pad(mark(r.suback), 7)} ${mark(r.echoed)}`,
  );
}

const good = results.filter((r) => r.echoed).map((r) => r.url);
console.log(`\nusable (${good.length}/${results.length}):`);
good.forEach((u) => console.log(`  '${u}',`));
