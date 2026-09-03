// "Don't just answer. Act." — execution, shown as cause and effect.
//
// SCROLL DRIVES THIS, NOT A CLOCK.
// The sequence used to run on its own 16-second timer (`clockT += delta`),
// which meant the visitor arrived at whatever phase the timer happened to be
// in and the story ran on regardless of them. The phase is now the #agent
// section's own scroll progress, so the visitor advances the automation by
// reading the section — and scrolling back runs it backwards, cleanly,
// because every value below is a pure function of that one number.
//
// THE CLICK STARTS THE PROCESS.
// The old order was trigger -> analyze -> decide -> PRESS -> send, so the hand
// pressed the button after the machine had already decided what to do. The
// press was an illustration of a decision that had happened without it. Now
// the press is at the front, where a trigger belongs, and everything after it
// is its consequence:
//
//   0.00-0.15  IDLE       control lit and waiting, work queued but inert
//   0.15-0.30  APPROACH   the hand travels to the control
//   0.30-0.36  PRESS      the button goes down; the core comes up
//   0.36-0.50  PROCESS    work enters the machine, the chamber runs
//   0.50-0.65  DECIDE     one route is chosen; the others stay dark
//   0.65-0.80  ACT        the messages leave along the chosen route
//   0.80-0.92  UPDATE     the CRM, the ledger and the follow-up land
//   0.92-1.00  COMPLETE   orange settles to green and holds
//
// NOTHING ELSE MOVED.
// Every object is in the position it has always been in — the console, its
// button, the hand's approach anchor, the routes, the customer records and the
// three systems. Only WHEN each of them acts changed.
//
// ONE ACT AT A TIME.
// Everything used to be on screen from the first frame, which read as a
// diagram rather than a process. Each group now carries a `focus` weight, and
// what is not the current subject is scaled down and pushed back rather than
// hidden — the whole chain stays legible, but only one link is ever loud.

import * as THREE from "three";

const ORANGE = 0xeb6217;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
};
/** Window: 0 outside [a,b], smooth 0->1->0 inside. */
const window01 = (x, a, b) => {
  if (x <= a || x >= b) return 0;
  const t = (x - a) / (b - a);
  return smoothstep(t / 0.3) * (1 - smoothstep((t - 0.7) / 0.3));
};
/** Gate: 0 before a, ramps to 1 by b, stays 1. */
const gate = (x, a, b) => smoothstep((x - a) / (b - a || 1));

/** Plateau: ramps up across [a,b], holds at 1, ramps back down across [c,d].
 *  The hold is what gives each stage a moment to be understood before the
 *  next one takes over, instead of every act cross-fading continuously. */
const act = (x, a, b, c, d) => smoothstep((x - a) / (b - a || 1))
  * (1 - smoothstep((x - c) / (d - c || 1)));

// Phase boundaries, in 0..1 of the section's scroll.
const T_APPROACH = 0.15; // hand starts moving toward the control
const T_ALIGN = 0.30;    // fingertip is on the button
const T_CLICK = 0.36;    // button bottoms out — the process starts HERE
const T_PROCESS = 0.50;  // work has entered the machine
const T_DECIDE = 0.65;   // a route has been chosen
const T_ACT = 0.80;      // the messages have arrived
const T_UPDATE = 0.92;   // the connected systems have updated

// Where the sequence parks when there is no scroll progress to read (a route
// with no #agent section). Late enough to read as a finished, working system.
const RESTING_PHASE = 0.94;

export function createActionSequence(objects, mat, geo, { seg = 24, customers = 3 } = {}) {
  const root = new THREE.Group();

  const emissive = (color, opacity) => {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
    });
    geo.trackMaterial(m);
    return m;
  };

  /* ---- TRIGGER: the overdue invoices ------------------------------------
   * Amber, because amber in this scene only ever means "waiting / overdue".
   * They are what the system is reacting to, so they arrive first and stay
   * visible until they are dealt with.
   */
  const OVERDUE_AT = [
    new THREE.Vector3(-4.9, 1.0, 2.0),
    new THREE.Vector3(-3.7, 1.75, 1.3),
    new THREE.Vector3(-4.3, 0.15, 2.7),
  ];
  const overdue = OVERDUE_AT.map((at, i) => {
    const item = objects.build("invoice");
    item.group.position.copy(at);
    item.group.scale.setScalar(1.1);
    root.add(item.group);
    return { item, at, phase: i * 0.7 };
  });

  // The read sweep that passes over them during ANALYZE.
  const sweepMat = emissive(ORANGE, 0);
  const sweep = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.08, 2.6, 2.2)), sweepMat);
  sweep.position.set(-4.3, 0.9, 2.0);
  root.add(sweep);

  /* ---- ACTION: the EXECUTE console --------------------------------------
   * A physical control on its own plinth, in front of the hub where the hand
   * can plausibly reach it.
   */
  const console_ = new THREE.Group();

  console_.position.set(0.2, -1.35, 3.2);
  root.add(console_);

  const plinth = new THREE.Mesh(geo.track(new THREE.BoxGeometry(1.5, 0.22, 1.1)), mat.ceramic);
  console_.add(plinth);
  const plinthEdges = new THREE.LineSegments(
    geo.track(new THREE.EdgesGeometry(plinth.geometry)),
    mat.ink,
  );
  console_.add(plinthEdges);

  const titanium = new THREE.MeshPhysicalMaterial({
    color: 0xbfbdb8, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5,
  });
  geo.trackMaterial(titanium);
  const housing = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.3, 0.34, 0.12, seg)), titanium);
  housing.position.y = 0.16;
  console_.add(housing);

  const buttonMat = new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.1,
  });
  geo.trackMaterial(buttonMat);
  const button = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.22, 0.22, 0.13, seg)), buttonMat);
  button.position.y = 0.26;
  console_.add(button);

  const armMat = emissive(ORANGE, 0);
  const armRing = new THREE.Mesh(geo.track(new THREE.RingGeometry(0.36, 0.5, seg)), armMat);
  armRing.rotation.x = -Math.PI / 2;
  armRing.position.y = 0.13;
  console_.add(armRing);

  /* ---- ACTION: the reminders that leave ---------------------------------- */
  const CUSTOMER_AT = [
    new THREE.Vector3(6.3, 1.5, 2.2),
    new THREE.Vector3(6.9, 0.0, 3.0),
    new THREE.Vector3(5.9, -1.4, 3.4),
  ].slice(0, customers);

  const receivers = CUSTOMER_AT.map((at) => {
    const item = objects.build("customer");
    item.group.position.copy(at);
    item.group.scale.setScalar(1.05);
    root.add(item.group);
    return item;
  });

  const SEND_FROM = new THREE.Vector3(0.2, -0.85, 3.2);

  /* ---- DECISION: the candidate routes -----------------------------------
   * These are not an abstract three-way selector floating beside the machine;
   * they are the ACTUAL paths the reminders will travel, drawn from the
   * console to each customer record. During DECIDE they light one after
   * another as the engine works through the candidates, and during SEND each
   * carries its own message. A decision is only readable as a decision when
   * you can see the options it is choosing between, and it is only believable
   * when the thing chosen is the thing that then happens.
   */
  const routeMats = CUSTOMER_AT.map(() => emissive(ORANGE, 0.1));
  const routes = CUSTOMER_AT.map((at, i) => {
    const mid = SEND_FROM.clone().lerp(at, 0.5);
    mid.y += 0.85;
    const curve = new THREE.CatmullRomCurve3(
      [SEND_FROM.clone(), mid, at.clone().add(new THREE.Vector3(-0.5, 0, 0.15))],
      false, "catmullrom", 0.4,
    );
    const tube = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, 40, 0.035, 5, false)),
      routeMats[i],
    );
    root.add(tube);
    return { tube, curve };
  });

  const messages = CUSTOMER_AT.map((at, i) => {
    const item = objects.build("message");
    item.group.scale.setScalar(1.15);
    item.group.visible = false;
    item.setState("active", 1);
    root.add(item.group);
    return { item, curve: routes[i].curve, offset: i * 0.13 };
  });

  /* ---- RESULT: the systems that get updated ------------------------------
   * These are the payoff. They are always on screen and always inert until a
   * message has actually landed, so their colour change is earned.
   */
  // The CRM, the ledger and the follow-up, in their original places. Held as a
  // list only so the confirmation below can stagger them in order; the objects
  // and positions are exactly what they were.
  const SYSTEM_AT = [
    ["crm", new THREE.Vector3(3.6, 2.5, 0.4)],
    ["database", new THREE.Vector3(1.6, 2.6, 0.0)],
    ["calendar", new THREE.Vector3(5.6, 2.4, 1.0)],
  ];
  const systems = SYSTEM_AT.map(([kind, at]) => {
    const item = objects.build(kind);
    item.group.position.copy(at);
    item.group.scale.setScalar(1.15);
    root.add(item.group);
    return { item, at };
  });
  // Links from the chosen route up to the systems it updates, so "the CRM
  // updated" has a visible reason rather than just happening nearby.
  const linkMat = emissive(ORANGE, 0.12);
  const linkGeo = geo.track(new THREE.CylinderGeometry(0.016, 0.016, 1, 6));
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const links = systems.map(({ item: target }) => {
    const link = new THREE.Mesh(linkGeo, linkMat);

    _a.set(1.4, 0.2, 2.4);
    _b.copy(target.group.position);
    const dir = _b.clone().sub(_a);
    link.scale.y = dir.length();
    link.position.copy(_a).addScaledVector(dir, 0.5);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    root.add(link);
    return link;
  });

  /* ---- exported anchors, for the robotic hand --------------------------- */
  const anchors = {
    button: new THREE.Vector3(0.2, -1.05, 3.2),

    approach: new THREE.Vector3(4.4, 1.2, 4.4),
  };

  const _travel = new THREE.Vector3();
  const state = { pressed: 0, reach: 0, phase: 0, core: 0 };

  /**
   * @param weight 0..1 — how present this sequence is (its section's weight)
   * @param phase  0..1 — the #agent section's own scroll progress. This is the
   *               only thing that advances the story; there is no internal
   *               clock. Pass null on a route that has no #agent section and
   *               the chain parks at RESTING_PHASE.
   * @returns state { phase, reach, pressed, core } so the scene can drive the
   *          hand and light the hub in step with the press.
   */
  function update(elapsed, delta, weight, phase = null) {
    root.visible = weight > 0.02;
    if (!root.visible) {
      state.reach = 0;
      state.pressed = 0;
      state.core = 0;
      return state;
    }

    const p = clamp01(typeof phase === "number" ? phase : RESTING_PHASE);
    state.phase = p;
    // Reversing scroll must converge as cleanly as advancing it, so the colour
    // blend cannot be allowed to stall: delta is 0 under reduced motion, and a
    // mix of 0 would freeze every object on whatever state it last held.
    const mix = Math.min(1, Math.max(delta, 1 / 60) * 6);
    // Idle motion only — never story. Zero under reduced motion.
    const bob = delta > 0 ? 1 : 0;

    /* -- who is the subject right now -----------------------------------
     * Not visibility: everything in the chain stays on screen so the whole
     * workflow can be read at once (brief §3). This is emphasis — whatever is
     * not the current act is scaled down and pushed back (brief §4).
     */
    // The waiting work is the subject from the first frame — it is the reason
    // the button gets pressed — and only recedes once the decision is made.
    const fTrigger = 1 - gate(p, T_DECIDE, T_ACT);
    const fProcess = act(p, T_ALIGN, T_CLICK, T_DECIDE, T_ACT);
    const fAction = act(p, T_PROCESS, T_DECIDE, T_UPDATE, 1.02);
    const fResult = gate(p, T_ACT, T_UPDATE);
    // How far a de-emphasised group recedes. One helper, so every group
    // recedes by the same amount and the depth ordering stays readable.
    const recede = (group, base, at, focus) => {
      group.scale.setScalar(base * (0.58 + 0.42 * focus));
      group.position.z = at.z - (1 - focus) * 1.5;
    };

    /* -- IDLE / TRIGGER: the work that is waiting ------------------------
     * Present from the start, because it is the reason the button gets
     * pressed — but inert and small until the press sends it in.
     */
    const intake = gate(p, T_CLICK, T_PROCESS);
    const cleared = gate(p, T_ACT, T_UPDATE);
    overdue.forEach((o, i) => {
      o.item.group.visible = true;
      // Once the process starts they are drawn in toward the machine. This is
      // the "input data entering system" beat, and it is caused by the click.
      const drawn = smoothstep(intake) * (1 - cleared * 0.25);
      o.item.group.position.set(
        o.at.x + drawn * (2.1 + i * 0.3),
        o.at.y - drawn * (0.9 + i * 0.2) + Math.sin(elapsed * 0.5 + o.phase) * 0.07 * bob,
        o.at.z + drawn * 0.4,
      );
      recede(o.item.group, 1.1 * (1 - cleared * 0.45), o.at, Math.max(fTrigger, fProcess));
      o.item.group.position.z += drawn * 0.4;
      o.item.group.rotation.y = -0.35 + Math.sin(elapsed * 0.3 + o.phase) * 0.12 * bob;
      // amber while overdue, orange while being worked, green once cleared
      o.item.setState(cleared > 0.6 ? "success" : intake > 0.35 ? "process" : "alert", mix);
    });

    /* -- PROCESS: the read sweep passes over the intake ------------------ */
    const processing = act(p, T_CLICK, T_CLICK + 0.06, T_PROCESS, T_DECIDE);
    sweepMat.opacity = processing * 0.7;
    sweep.position.x = -5.6 + gate(p, T_CLICK, T_PROCESS) * 2.6;

    /* -- THE PRESS, and everything it starts -----------------------------
     * `reach` is the approach, `press` is the stroke itself. Both are pure
     * functions of scroll, so scrubbing backwards lifts the finger and walks
     * the hand back out exactly the way it came in (brief §14).
     */
    const reachIn = gate(p, T_APPROACH, T_ALIGN);
    const pressIn = gate(p, T_ALIGN, T_CLICK);
    // The button comes back up right after the click, and the hand leaves once
    // the process it started is running on its own. Without this the hand sat
    // on the control for the remaining two thirds of the section, competing
    // for attention with the very thing it had just set going (brief §4).
    const release = gate(p, T_CLICK, T_PROCESS);
    const withdraw = gate(p, T_PROCESS - 0.04, T_DECIDE);
    state.reach = reachIn * (1 - withdraw);
    state.pressed = pressIn * (1 - release);
    // The control stays lit while the run it launched is in progress — a
    // latched switch, not a doorbell.
    const latched = pressIn * (1 - gate(p, T_UPDATE, 1) * 0.55);

    // The core comes up the instant the button bottoms out. This is the single
    // most important cause-and-effect link in the section (brief §9), so the
    // ramp is deliberately short and lands exactly on T_CLICK.
    const live = gate(p, T_CLICK - 0.03, T_CLICK + 0.02);
    state.core = live * (1 - gate(p, T_UPDATE, 1) * 0.45);

    buttonMat.emissiveIntensity = 0.34 + reachIn * 0.5 + latched * 1.7;
    button.position.y = 0.26 - state.pressed * 0.085;
    // The ring that leaves the button at the moment of contact.
    const pulse = window01(p, T_ALIGN, T_PROCESS);
    armMat.opacity = reachIn * 0.18 + pulse * 0.55;
    armRing.scale.setScalar(1 + pulse * 1.9);

    /* -- DECIDE: one route is chosen, the others stay dark ---------------
     * The cursor walks the candidates during DECIDE and then settles, so the
     * chosen route is the one still lit when the sending starts.
     */
    const deciding = act(p, T_PROCESS, T_PROCESS + 0.05, T_DECIDE, T_DECIDE + 0.04);
    const sending = gate(p, T_DECIDE, T_ACT);
    const cursor = ((p - T_PROCESS) / (T_DECIDE - T_PROCESS || 1)) * routeMats.length;
    routeMats.forEach((rm, i) => {
      const considered = deciding * Math.max(0, 1 - Math.abs(cursor - i - 0.5) * 1.6);
      // Assigned, not damped toward a target: a damped value carries history,
      // and history is exactly what makes a scrubbed timeline look different
      // going up than it did coming down.
      rm.opacity = 0.06 + considered * 0.6 + sending * 0.46;
    });

    /* -- ACT: the messages travel the route they were assigned ----------- */
    const span = T_ACT - T_DECIDE;
    messages.forEach((m, i) => {
      // Staggered start AND finish. Normalising every message to end at T_ACT
      // made all three land on the same frame, which reads as one event rather
      // than as three deliveries — and left the customers all turning green
      // together with nothing having visibly reached them.
      const start = T_DECIDE + span * m.offset;
      const travel = (p - start) / (span * 0.7 || 1);
      const flying = travel > 0 && travel < 1;
      m.item.group.visible = flying;
      if (flying) {
        const e = smoothstep(travel);
        m.curve.getPointAt(clamp01(e), _travel);
        m.item.group.position.copy(_travel);
        m.item.group.rotation.y = -0.5 - e * 0.7;
        m.item.group.scale.setScalar(1.15 * (0.4 + e * 0.6));
      }
      // the customer lights only once its own message has landed
      const landed = travel >= 0.96;
      receivers[i].setState(
        landed || p > T_ACT ? "success" : sending > 0.2 ? "process" : "neutral",
        mix,
      );
      recede(receivers[i].group, 1.05, CUSTOMER_AT[i], Math.max(fAction, fResult));
      receivers[i].group.position.y = CUSTOMER_AT[i].y
        + Math.sin(elapsed * 0.45 + i) * 0.06 * bob + (landed ? 0.08 : 0);
    });

    /* -- UPDATE: the connected systems land, one after another -----------
     * Staggered across the update window so four checkmarks appear in order
     * rather than together — the difference between "the systems updated" and
     * "four things lit up".
     */
    const settled = gate(p, T_UPDATE, 0.99);
    const working = gate(p, T_DECIDE, T_ACT);
    // Everything orange settles once the run is complete — the finished state
    // is a system at rest, not one still visibly working (brief §2).
    linkMat.opacity = (0.06 + sending * 0.22 + gate(p, T_ACT, T_UPDATE) * 0.34)
      * (1 - settled * 0.5);
    routeMats.forEach((rm) => { rm.opacity *= 1 - settled * 0.6; });
    systems.forEach(({ item, at }, i) => {
      const slot = T_ACT + (T_UPDATE - T_ACT) * (i / systems.length);
      const done = gate(p, slot, slot + 0.07);
      item.setState(done > 0.5 ? "success" : working > 0.35 ? "process" : "neutral", mix);
      recede(item.group, 1.15 * (1 + done * 0.1), at, fResult);
      item.group.rotation.y = Math.sin(elapsed * 0.25 + i) * 0.18 * bob;
    });
    links.forEach((link, i) => {
      link.visible = working > 0.04 || i < 2;
    });

    /* -- COMPLETE: the orange settles and the system holds ---------------- */
    buttonMat.emissiveIntensity *= 1 - settled * 0.3;

    return state;
  }

  return { root, update, anchors, state };
}
