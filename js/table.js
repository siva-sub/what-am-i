/* ─────────────────────────────────────────────────────────────
   table.js — the room you sit in.

   The whole mechanic is one sentence: you can read every card but
   your own. A flat list of names would hide that. So the state is
   built as furniture — a table, a ring of seats, a card standing at
   every seat, and the one in front of you lying face-down.

   Opponent cards turn to face the camera because a card you cannot
   read is a card that is not in the game.
   ───────────────────────────────────────────────────────────── */

import * as THREE from "../vendor/three.module.min.js";
import { artUrl, BACK_ART } from "./cards.js";

const CARD_W = 1.0;
const CARD_H = 1.4;
const CARD_T = 0.012;
const SEAT_RADIUS = 2.75;
const CARD_RADIUS = 2.45;
const CARD_LIFT = 0.62;

/* Seat 0 is the local player, so it has to land on the NEAR side of
   the table — between the camera and the middle — with everyone else
   arranged across from it. sin(0)=0 and cos(0)=1 put angle 0 at +Z,
   which is where the camera is. */
/* Steeper than you would sit at a real table, on purpose. A shallow
   angle flattens the ring into an ellipse that spills off the bottom
   and leaves the top of the frame empty; looking further down keeps
   the whole circle on screen and roughly centred between the HUD
   bars, which is what lets you read every seat at once. */
const EYE = new THREE.Vector3(0, 8.0, 6.6);
const LOOK_AT = new THREE.Vector3(0, 0.2, 0);
const BASE_FOV = 46;

/* ── texture cache ──────────────────────────────────────────── */

const loader = new THREE.TextureLoader();
const texCache = new Map();

const loadTexture = (url) => {
  if (!texCache.has(url)) {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    texCache.set(url, tex);
  }
  return texCache.get(url);
};

/* ── materials ──────────────────────────────────────────────── */

const EDGE = new THREE.MeshStandardMaterial({
  color: 0xe8dfcc,
  roughness: 0.92,
});

const faceMaterial = (url) =>
  new THREE.MeshStandardMaterial({
    map: loadTexture(url),
    roughness: 0.88,
    metalness: 0.0,
  });

const backMaterial = () =>
  new THREE.MeshStandardMaterial({
    map: loadTexture(BACK_ART),
    roughness: 0.88,
  });

/* A card is a thin box, not a plane — the edge catches the light
   and it stops looking like a sticker floating in the dark. */
const makeCardMesh = (frontUrl) => {
  const geo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_T);
  const mats = [EDGE, EDGE, EDGE, EDGE, faceMaterial(frontUrl), backMaterial()];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

/* ── name plates ────────────────────────────────────────────── */

const roundedRect = (g, x, y, w, h, r) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

/**
 * A card with no name on it is a card you cannot use. The whole game is
 * "Bram, what am I?" — so every seat has to say who is sitting at it.
 * Drawn to a canvas and hung on a sprite, so the text is crisp, always
 * faces the camera, and costs nothing per frame once baked.
 */
const makePlateTexture = ({ name, score, isMe, isOut, isTurn }) => {
  const W = 512;
  const H = 168;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");

  const pad = 9;
  roundedRect(g, pad, pad, W - pad * 2, H - pad * 2, 24);
  g.fillStyle = isOut
    ? "rgba(28,12,10,0.80)"
    : isMe
      ? "rgba(52,37,15,0.94)"
      : "rgba(16,13,10,0.88)";
  g.fill();
  g.lineWidth = isTurn ? 8 : 3;
  g.strokeStyle = isOut
    ? "#5a2a22"
    : isTurn
      ? "#e8b95c"
      : isMe
        ? "#c9973f"
        : "rgba(201,151,63,0.4)";
  g.stroke();

  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillStyle = isOut ? "#8a6a60" : isMe ? "#f6efe0" : "#e8ddc6";
  g.font = '600 62px Georgia, "Iowan Old Style", serif';
  g.fillText(isMe ? `${name} (you)` : name, pad + 28, H / 2, W - 190);

  g.textAlign = "right";
  g.fillStyle = isOut ? "#6b4a42" : "#c9973f";
  g.font = "700 60px Georgia, serif";
  g.fillText(String(score), W - pad - 28, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/* ── the scene ──────────────────────────────────────────────── */

export function createTable(container, handlers = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  /* A dropped WebGL context leaves a black rectangle with no
     explanation, which reads as "this game is broken". Say what
     happened instead; the page cannot restore the context itself. */
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    window.__wamiReport?.(
      "3D view stopped",
      "The browser dropped the WebGL context, so the table can no longer be drawn. Reloading the page usually restores it.",
    );
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0908);
  scene.fog = new THREE.Fog(0x0a0908, 9, 20);

  /* The room. A backdrop cylinder rather than a flat background colour,
     because a flat colour gives the table no sense of being anywhere.

     Unlit and fog-exempt on purpose: the candlelight is painted into the
     texture, so scene light would only wash it out, and the fog would
     grey the arches back to the exact colour we are replacing.

     Radius 11 rather than something further out, and that is a maths
     constraint rather than a taste one. The camera sits at y=8 looking
     about 50° down at the table, so only rays shallower than atan(8/r)
     ever reach a wall instead of the floor. At r=15 that is a 1.4° band
     — a sliver hidden behind the score bar. At r=11 it is about 9°,
     which actually reads as a room.

     repeat.x=2 follows from the same geometry: circumference over
     height here is 5.8:1 and the panorama is 3:1, so twice around is
     6:1. About 4% of stretch, which is invisible. */
  const room = loadTexture("assets/tex/room.jpg");
  room.wrapS = THREE.RepeatWrapping;
  room.repeat.set(2, 1);
  /* The camera looks down at ~50°, so the wall only occupies the top
     band of the frame — and the arches sit higher in the source image
     than that band samples. Sliding the texture up brings them down
     into view. */
  room.offset.y = 0.13;

  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 26, 64, 1, true),
    new THREE.MeshBasicMaterial({
      map: room,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  /* Centred on the floor, so the wall runs from well below the table to
     well above the camera. A shorter cylinder puts its top rim in frame
     and the wall reads as a black dome sitting behind the table rather
     than as a room the table is standing in. */
  backdrop.position.y = 0;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 100);
  camera.position.copy(EYE);
  camera.userData.pull = 1;

  /* ── lighting: one candle, and the dark it fails to reach ── */

  scene.add(new THREE.AmbientLight(0x6b5b45, 0.55));

  const candle = new THREE.PointLight(0xffb96b, 22, 14, 2);
  candle.position.set(0, 1.5, 0);
  candle.castShadow = true;
  candle.shadow.mapSize.set(1024, 1024);
  candle.shadow.bias = -0.002;
  scene.add(candle);

  const rim = new THREE.DirectionalLight(0x8fa8c8, 0.5);
  rim.position.set(-4, 6, -5);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffd7a0, 0.35);
  fill.position.set(5, 3, 4);
  scene.add(fill);

  /* ── the table ──────────────────────────────────────────── */

  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  /* Real wood instead of a flat brown. Tiled, because a single
     stretch of a photograph across a 6.7m table reads as plastic. */
  const wood = loadTexture("assets/tex/table-wood.jpg");
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(2, 2);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(3.35, 3.35, 0.16, 72),
    new THREE.MeshStandardMaterial({
      map: wood,
      roughness: 0.58,
      metalness: 0.06,
    }),
  );
  top.position.y = -0.08;
  top.receiveShadow = true;
  tableGroup.add(top);

  const rim2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.35, 0.075, 10, 80),
    new THREE.MeshStandardMaterial({ color: 0x1d1410, roughness: 0.6 }),
  );
  rim2.rotation.x = Math.PI / 2;
  rim2.position.y = 0.01;
  tableGroup.add(rim2);

  /* Faint ring showing where cards should sit. */
  const guide = new THREE.Mesh(
    new THREE.RingGeometry(CARD_RADIUS - 0.7, CARD_RADIUS - 0.66, 80),
    new THREE.MeshBasicMaterial({
      color: 0xc9a06a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    }),
  );
  guide.rotation.x = -Math.PI / 2;
  guide.position.y = 0.012;
  tableGroup.add(guide);

  /* ── seats, cards, pile ─────────────────────────────────── */

  const seatGroup = new THREE.Group();
  const cardGroup = new THREE.Group();
  const pileGroup = new THREE.Group();
  const labelGroup = new THREE.Group();
  scene.add(seatGroup, cardGroup, pileGroup, labelGroup);

  const cardMeshes = new Map();
  const seatMeshes = new Map();
  const nameLabels = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let pileMesh = null;
  let myPid = null;
  let current = null;
  let hovered = null;
  let pickables = [];

  /* ── building from state ────────────────────────────────── */

  const clear = (group) => {
    while (group.children.length) {
      const child = group.children.pop();
      child.geometry?.dispose?.();
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((m) => m?.dispose?.());
    }
  };

  const seatAngle = (index, total) => (index / total) * Math.PI * 2;

  function buildPile(count) {
    clear(pileGroup);
    const layers = Math.min(count, 7);

    for (let i = 0; i < layers; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(CARD_W * 0.94, CARD_H * 0.94, CARD_T),
        [EDGE, EDGE, EDGE, EDGE, backMaterial(), backMaterial()],
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (i * 0.11) % 0.5;
      m.position.set(
        (i % 2 ? 1 : -1) * 0.035,
        0.01 + i * 0.014,
        (i % 3) * 0.02,
      );
      m.castShadow = true;
      pileGroup.add(m);
    }

    pileMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 32),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    pileMesh.rotation.x = -Math.PI / 2;
    pileMesh.position.y = 0.15;
    pileMesh.userData.pick = { kind: "pile" };
    pileGroup.add(pileMesh);
  }

  function buildSeats(state) {
    clear(seatGroup);
    clear(cardGroup);
    clear(labelGroup);
    cardMeshes.clear();
    seatMeshes.clear();
    nameLabels.clear();
    pickables = [];

    const seated = state.players;
    const total = seated.length;
    if (!total) return;

    const mine = seated.findIndex((p) => p.pid === myPid);

    seated.forEach((p, i) => {
      /* Rotate the whole ring so your own seat is nearest the camera. */
      const slot = mine >= 0 ? (i - mine + total) % total : i;
      const angle = seatAngle(slot, total);

      const sx = Math.sin(angle) * SEAT_RADIUS;
      const sz = Math.cos(angle) * SEAT_RADIUS;
      const cx = Math.sin(angle) * CARD_RADIUS;
      const cz = Math.cos(angle) * CARD_RADIUS;

      /* ── name plate ── */
      const plate = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.045, 24),
        new THREE.MeshStandardMaterial({
          color: p.out ? 0x241512 : 0x4a382a,
          roughness: 0.85,
        }),
      );
      disc.receiveShadow = true;
      plate.add(disc);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.47, 40),
        new THREE.MeshBasicMaterial({
          color: p.out ? 0x552222 : 0x8a6a3a,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.026;
      plate.add(halo);
      plate.position.set(sx, 0.05, sz);

      plate.userData.pick = { kind: "seat", pid: p.pid };
      plate.userData.halo = halo;
      seatGroup.add(plate);
      seatMeshes.set(p.pid, plate);
      pickables.push(disc);
      disc.userData.pick = { kind: "seat", pid: p.pid };

      /* ── the card ── */
      const isMine = p.pid === myPid;

      /* My own card arrives as null — that is the entire game. But it
         still has to exist on the table, face-down, because the thing
         that creates the tension is a card sitting there that I cannot
         read. Skipping it here quietly removes the point. */
      if (!isMine && !p.cardId && !p.out) return;

      const url = p.out || isMine ? BACK_ART : artUrl(p.cardId);
      const card = makeCardMesh(url);

      /* Cards stand on edge, tilted back, one per seat. */
      card.position.set(cx, CARD_LIFT, cz);
      card.userData = {
        pid: p.pid,
        pick: { kind: "card", pid: p.pid },
        baseY: CARD_LIFT,
        faceDown: isMine || !!p.out,
        cardId: p.cardId,
      };
      cardGroup.add(card);
      cardMeshes.set(p.pid, card);
      pickables.push(card);

      /* ── the name plate ──

         Only opponents get one. Their cards are the ones you have to
         read, so each one needs its owner's name attached. Yours is the
         face-down card in the foreground — it cannot be mistaken for
         anyone else's, and at arm's length from the camera a plate would
         be enormous and cover the table. */
      if (!isMine) {
        const label = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: makePlateTexture({
              name: p.name,
              score: p.score,
              isMe: false,
              isOut: !!p.out,
              isTurn: false,
            }),
            transparent: true,
            /* Labels hover above the cards, so they must not be clipped
               by one that leans into them. */
            depthTest: false,
            depthWrite: false,
          }),
        );
        label.scale.set(1.5, 0.49, 1);
        /* Directly above its own card, not out at the seat marker, so
           the pairing is unmistakable. */
        label.position.set(cx, 2.0, cz);
        label.renderOrder = 20;
        label.userData.pid = p.pid;
        label.userData.key = "";
        labelGroup.add(label);
        nameLabels.set(p.pid, label);
      }

      if (isMine) {
        /* Your own card is the one thing in the world you cannot
           read. Make that visible: dimmer, and ringed. */
        const collar = new THREE.Mesh(
          new THREE.RingGeometry(0.62, 0.7, 44),
          new THREE.MeshBasicMaterial({
            color: 0xc9973f,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
          }),
        );
        collar.position.set(cx, CARD_LIFT, cz);
        collar.userData.isCollar = true;
        cardGroup.add(collar);
      }
    });

    buildPile(state.pile?.count ?? 0);
    if (pileMesh) pickables.push(pileMesh);
  }

  /* ── per-frame orientation ──────────────────────────────── */

  const tmp = new THREE.Vector3();
  const aim = new THREE.Vector3();

  /* Rebake a plate only when what it says has actually changed.
     Canvas work per seat per frame would be genuinely wasteful. */
  function updateLabels() {
    nameLabels.forEach((label, pid) => {
      const p = current.players.find((x) => x.pid === pid);
      if (!p) return;

      const isTurn =
        current.phase === "turn" &&
        current.pending?.order?.[current.pending.turnIndex] === pid;
      const isMe = pid === myPid;
      const key = `${p.name}|${p.score}|${p.out}|${isTurn}`;
      if (label.userData.key === key) return;

      label.userData.key = key;
      label.material.map?.dispose();
      label.material.map = makePlateTexture({
        name: p.name,
        score: p.score,
        isMe,
        isOut: !!p.out,
        isTurn,
      });
      label.material.needsUpdate = true;
    });
  }

  function orientCards(now) {
    cardMeshes.forEach((card, pid) => {
      const idx = current.players.findIndex((p) => p.pid === pid);
      const isMine = pid === myPid;

      /* A card faces whoever is looking at it. Cards standing rigidly
         around a ring face the middle, which leaves the seats to your
         left and right edge-on and therefore unreadable — and reading
         them is the entire game. So they turn to the camera, keeping
         the backward lean that makes them look propped up rather than
         pasted onto the screen. */
      card.rotation.order = "YXZ";
      aim.subVectors(camera.position, card.position);
      card.rotation.y = Math.atan2(aim.x, aim.z);
      card.rotation.x = isMine ? -Math.PI / 2 + 0.12 : -0.22;

      /* Your own card lies flat, face-down, in front of you. */
      if (isMine) {
        card.position.y = 0.03;
        card.rotation.z = 0.04;
      } else {
        const lift = card.userData.baseY;
        card.position.y = lift + Math.sin(now * 0.0011 + idx * 1.7) * 0.022;
        card.rotation.z = Math.sin(now * 0.0007 + idx) * 0.014;
      }

      const target = hovered === pid ? 1.09 : 1;
      card.scale.lerp(tmp.set(target, target, target), 0.18);
    });

    updateLabels();

    seatMeshes.forEach((plate, pid) => {
      const isTurn =
        current?.phase === "turn" &&
        current.pending?.order?.[current.pending.turnIndex] === pid;
      const halo = plate.userData.halo;
      if (halo) {
        halo.material.opacity = isTurn
          ? 0.45 + Math.sin(now * 0.005) * 0.35
          : hovered === pid
            ? 0.6
            : 0.22;
      }
      const target = hovered === pid ? 1.14 : 1;
      plate.scale.lerp(tmp.set(target, target, target), 0.2);
    });

    if (pileMesh) {
      const target = hovered === "__pile" ? 1.12 : 1;
      pileGroup.scale.lerp(tmp.set(target, target, target), 0.2);
      pileMesh.visible =
        !!current &&
        current.phase === "turn" &&
        current.pending?.order?.[current.pending.turnIndex] === myPid;
    }
  }

  /* ── camera drift ───────────────────────────────────────── */

  let yaw = 0;
  let targetYaw = 0;

  function drift(now) {
    /* Very slow breathing motion. Enough that the room feels
       inhabited, not enough to make anyone motion-sick. */
    const idle = Math.sin(now * 0.00013) * 0.16;
    yaw += (targetYaw + idle - yaw) * 0.03;

    /* Pull the seat back on a narrow screen rather than opening the
       lens. A phone held upright has an aspect near 0.45, and matching
       that with FOV alone turns every card into a fish-eye smear. */
    const reach = EYE.length() * camera.userData.pull;
    camera.position.set(
      Math.sin(yaw) * reach * (EYE.z / EYE.length()),
      EYE.y * camera.userData.pull + Math.sin(now * 0.00019) * 0.09,
      Math.cos(yaw) * reach * (EYE.z / EYE.length()),
    );
    camera.lookAt(LOOK_AT);

    /* Candle flicker — the only reason this looks lit rather
       than lit up. */
    const f =
      0.86 +
      Math.sin(now * 0.011) * 0.06 +
      Math.sin(now * 0.037) * 0.04 +
      Math.sin(now * 0.0053) * 0.05;
    candle.intensity = 22 * f;
    candle.position.x = Math.sin(now * 0.0007) * 0.06;
  }

  /* ── input ──────────────────────────────────────────────── */

  const setPointer = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
    pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  };

  const pick = () => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData?.pick) node = node.parent;
      if (node?.userData?.pick) {
        const p = node.userData.pick;
        if (p.kind === "pile") return "__pile";
        return p.pid;
      }
    }
    return null;
  };

  const onMove = (e) => {
    setPointer(e);
    const hit = pick();
    if (hit !== hovered) {
      hovered = hit;
      renderer.domElement.style.cursor = hit ? "pointer" : "default";
    }
  };

  const onClick = (e) => {
    setPointer(e);
    const hit = pick();
    if (hit) handlers.onSelect?.(hit);
  };

  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onClick);
  renderer.domElement.addEventListener("pointerleave", () => {
    hovered = null;
    renderer.domElement.style.cursor = "default";
  });

  /* ── resize ─────────────────────────────────────────────── */

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = BASE_FOV;
    /* Hold the whole ring in frame by moving the seat back, not by
       widening the lens. */
    camera.userData.pull = THREE.MathUtils.clamp(1 / camera.aspect, 1, 2.1);
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ── loop ───────────────────────────────────────────────── */

  let running = true;
  let raf = 0;

  const loop = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    orientCards(now);
    drift(now);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  /* ── public ─────────────────────────────────────────────── */

  return {
    /** Hand the table a new snapshot. Cheap enough to call on every message. */
    setView(state, pid) {
      const changed =
        !current ||
        current.players.length !== state.players.length ||
        current.phase !== state.phase ||
        JSON.stringify(current.players.map((p) => p.cardId)) !==
          JSON.stringify(state.players.map((p) => p.cardId)) ||
        (current.pile?.count ?? 0) !== (state.pile?.count ?? 0);

      myPid = pid;
      current = state;
      if (changed) buildSeats(state);
      return changed;
    },

    /** Nudge the camera to look at whoever is speaking. */
    look(pid) {
      const total = current?.players?.length ?? 1;
      const mine = current?.players?.findIndex((p) => p.pid === myPid) ?? -1;
      const idx = current?.players?.findIndex((p) => p.pid === pid) ?? -1;
      if (idx < 0 || mine < 0) return;
      const slot = (idx - mine + total) % total;
      targetYaw = (slot / total) * Math.PI * 2 * 0.22;
    },

    /** Briefly lift and glow a card — used on ask, answer, swap, declare. */
    pulse(pid) {
      const card = cardMeshes.get(pid) ?? (pid === "__pile" ? pileMesh : null);
      if (!card) return;
      card.userData.pulseUntil = performance.now() + 620;
    },

    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onClick);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
