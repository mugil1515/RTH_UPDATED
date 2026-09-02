// "Don't just answer. Act." — execution, shown as cause and effect.
//
// The old version had a robotic hand drift in from the right, hover near a
// glowing cylinder and wiggle its fingers forever. Nothing it did changed
// anything, so it read as an ornament with a hand shape.
//
// Here the hand has exactly one job, and the whole section is one causal
// chain that repeats slowly enough to follow:
//
//   TRIGGER   overdue invoices surface, amber
//   DECISION  the engine reads them and works along the candidate routes to
//             each customer, lighting them one at a time
//   ACTION    the hand presses EXECUTE — reminders leave along those routes
//   RESULT    customers receive them, the CRM updates, a follow-up is scheduled
//
// Nothing in here moves before its cause has happened. The hand does not
// approach until the decision is made, the messages do not leave until the
// button is down, and the customer records do not light until a message has
// physically reached them.

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

// Phase boundaries of one execution cycle, in 0..1 of the cycle.
const T_TRIGGER = 0.10;
const T_ANALYZE = 0.24;
const T_DECIDE = 0.38;
const T_PRESS = 0.50;
const T_SEND = 0.74;
const T_CONFIRM = 0.90;

const CYCLE = 16;

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
    return { item, curve: routes[i].curve, offset: i * 0.16 };
  });

  /* ---- RESULT: the systems that get updated ------------------------------
   * These are the payoff. They are always on screen and always inert until a
   * message has actually landed, so their colour change is earned.
   */
  const crm = objects.build("crm");
  crm.group.position.set(3.6, 2.5, 0.4);
  crm.group.scale.setScalar(1.15);
  root.add(crm.group);

  const ledger = objects.build("database");
  ledger.group.position.set(1.6, 2.6, 0.0);
  ledger.group.scale.setScalar(1.15);
  root.add(ledger.group);

  const schedule = objects.build("calendar");
  schedule.group.position.set(5.6, 2.4, 1.0);
  schedule.group.scale.setScalar(1.15);
  root.add(schedule.group);

  // Links from the chosen route up to the systems it updates, so "the CRM
  // updated" has a visible reason rather than just happening nearby.
  const linkMat = emissive(ORANGE, 0.12);
  const linkGeo = geo.track(new THREE.CylinderGeometry(0.016, 0.016, 1, 6));
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const links = [crm, ledger, schedule].map((target) => {
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
  let clockT = 0;
  const state = { pressed: 0, reach: 0, phase: 0 };

  /**
   * @param weight 0..1 — how present this sequence is (its section's weight)
   * @param hold   when set, the cycle parks at this phase instead of running
   *               (prefers-reduced-motion). Parked after the send, so the
   *               reminders have gone out and the systems read as updated
   *               rather than the chain sitting frozen before it starts.
   * @returns state { phase, reach, pressed } so the scene can drive the hand
   */
  function update(elapsed, delta, weight, hold = null) {
    root.visible = weight > 0.02;
    if (!root.visible) {
      state.reach = 0;
      state.pressed = 0;
      return state;
    }

    if (hold === null) clockT = (clockT + delta * weight) % CYCLE;
    else clockT = hold * CYCLE;
    const p = clockT / CYCLE;
    state.phase = p;
    const mix = Math.min(1, delta * 3);

    /* -- TRIGGER -------------------------------------------------------- */
    const triggered = gate(p, 0, T_TRIGGER);
    const cleared = gate(p, T_SEND, T_CONFIRM);
    overdue.forEach((o) => {
      o.item.group.visible = triggered > 0.02;
      o.item.group.position.set(
        o.at.x,
        o.at.y + (1 - triggered) * -0.8 + Math.sin(elapsed * 0.5 + o.phase) * 0.07,
        o.at.z,
      );
      o.item.group.scale.setScalar(1.1 * triggered * (1 - cleared * 0.55));
      o.item.group.rotation.y = -0.35 + Math.sin(elapsed * 0.3 + o.phase) * 0.12;
      // amber while overdue, green once the reminders have gone out
      o.item.setState(cleared > 0.6 ? "success" : triggered > 0.5 ? "alert" : "neutral", mix);
    });

    /* -- ANALYZE: the read sweep ---------------------------------------- */
    const analyzing = window01(p, T_TRIGGER, T_ANALYZE);
    sweepMat.opacity = analyzing * 0.7;
    sweep.position.x = -5.6 + ((p - T_TRIGGER) / (T_ANALYZE - T_TRIGGER || 1)) * 2.6;

    /* -- DECIDE: the engine works through the candidate routes ------------
     * They light one at a time, in order, while the decision is being made —
     * that sequence is what reads as "choosing" rather than "switching on".
     * Once the button is pressed they all carry traffic.
     */
    const deciding = gate(p, T_ANALYZE, T_DECIDE);
    const sending = gate(p, T_PRESS, T_SEND);
    const scanning = deciding * (1 - sending);
    const cursor = ((p - T_ANALYZE) / (T_DECIDE - T_ANALYZE || 1)) * routeMats.length;
    routeMats.forEach((rm, i) => {
      const considered = scanning * Math.max(0, 1 - Math.abs(cursor - i - 0.5) * 1.6);
      const target = 0.09 + considered * 0.55 + sending * 0.5;
      rm.opacity += (target - rm.opacity) * Math.min(1, delta * 4);
    });

    /* -- ACT: the hand arrives, presses, and the send begins ------------- */
    // The hand only starts reaching once the decision exists to be executed.
    const reach = gate(p, T_DECIDE - 0.08, T_PRESS - 0.04);
    // A single sharp press, then release — not a continuous bobbing.
    const press = window01(p, T_PRESS - 0.06, T_PRESS + 0.08);
    state.reach = reach;
    state.pressed = press;

    buttonMat.emissiveIntensity = 0.3 + deciding * 1.1 + press * 1.4;
    button.position.y = 0.26 - press * 0.075;
    armMat.opacity = deciding * 0.35 + press * 0.4;

    /* -- messages leave, travel, and arrive ------------------------------ */
    messages.forEach((m, i) => {
      const raw = (p - T_PRESS) / (T_SEND - T_PRESS || 1) - m.offset;
      const travel = raw / (1 - m.offset || 1);
      const flying = travel > 0 && travel < 1;
      m.item.group.visible = flying;
      if (flying) {
        // Rides the route it was assigned, so the reminder is visibly the
        // thing the chosen path was for.
        const e = smoothstep(travel);
        m.curve.getPointAt(clamp01(e), _travel);
        m.item.group.position.copy(_travel);
        m.item.group.rotation.y = -0.5 - e * 0.7;
        m.item.group.scale.setScalar(1.15 * (0.4 + e * 0.6));
      }
      // the customer lights only once its own message has landed
      const landed = travel >= 0.92 ? 1 : 0;
      receivers[i].setState(landed || p > T_SEND ? "success" : "neutral", mix);
      receivers[i].group.position.y = CUSTOMER_AT[i].y
        + Math.sin(elapsed * 0.45 + i) * 0.06 + (landed ? 0.08 : 0);
    });

    /* -- CONFIRM: the connected systems update --------------------------- */
    const confirmed = gate(p, T_SEND, T_CONFIRM);
    const scheduled = gate(p, T_CONFIRM, 1);
    linkMat.opacity = 0.1 + confirmed * 0.5;
    crm.setState(confirmed > 0.5 ? "success" : sending > 0.4 ? "process" : "neutral", mix);
    ledger.setState(confirmed > 0.6 ? "success" : sending > 0.5 ? "process" : "neutral", mix);
    schedule.setState(scheduled > 0.4 ? "success" : confirmed > 0.8 ? "process" : "neutral", mix);
    [crm, ledger, schedule].forEach((sys, i) => {
      const lift = i === 2 ? scheduled : confirmed;
      sys.group.scale.setScalar(1.15 * (1 + lift * 0.1));
      sys.group.rotation.y = Math.sin(elapsed * 0.25 + i) * 0.18;
    });
    links.forEach((link, i) => { link.visible = confirmed > 0.05 || i < 2; });

    return state;
  }

  return { root, update, anchors, state };
}
