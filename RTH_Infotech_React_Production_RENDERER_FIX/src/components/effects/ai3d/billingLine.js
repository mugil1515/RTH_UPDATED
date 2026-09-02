// Automatic bill generation, shown as an actual production line.
//
// The previous billing visual was five invoice sheets sliding down one curve
// into the hub. Sheets moving is not a process: nothing is extracted, nothing
// is calculated, nothing is produced. A viewer sees paper drift and learns
// nothing about billing.
//
// This is the real sequence, one station per step, left to right:
//
//   ORDER -> EXTRACT -> TAX -> INVOICE -> DELIVER -> LEDGER
//    card    customer   GST    document   envelope   database
//            + amount          assembles  + message  updated
//                              + check
//
// A job token rides the rail between stations. It MOVES, then it STOPS while
// the station does its work — anticipation, action, result, hold. That pause
// is what makes each step readable; a continuous slide is not.
//
// Stations accumulate: once a step has run it stays completed (green) for the
// rest of the cycle, so by the end of one pass the whole chain is lit and the
// viewer can see the entire process at once. Then it resets and runs again.

import * as THREE from "three";

const ORANGE = 0xeb6217;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
};
/** A rise-and-fall bump across x in 0..1 — the shape of one station's action. */
const bump = (x) => smoothstep(x / 0.32) * (1 - smoothstep((x - 0.62) / 0.38));

// Fraction of each station's slot spent travelling to it; the rest is the
// hold during which its work is actually performed and can be read.
const TRANSIT = 0.46;

const STATIONS = [
  { kind: "order", x: -4.6 },
  { kind: "customer", x: -2.76 },
  { kind: "tax", x: -0.92 },
  { kind: "invoice", x: 0.92 },
  { kind: "envelope", x: 2.76 },
  { kind: "ledger", x: 4.6 },
];

const LINE_Y = -0.55;
const LINE_Z = 2.4;
const RAIL_Y = -1.15;

/**
 * @param objects business-object factory from businessObjects.js
 * @param mat     shared scene materials
 * @param geo     tracking helper
 */
export function createBillingLine(objects, mat, geo, { seg = 24, count = STATIONS.length } = {}) {
  const root = new THREE.Group();
  const specs = STATIONS.slice(0, Math.max(3, count));

  /* ---- rail ------------------------------------------------------------
   * A single straight track under the stations. Without it the stations look
   * like six unrelated props instead of one line.
   */
  const railGeo = geo.track(new THREE.BoxGeometry(11.6, 0.07, 0.16));
  const rail = new THREE.Mesh(railGeo, mat.track);
  rail.position.set(0, RAIL_Y, LINE_Z);
  root.add(rail);

  // Its own material, not the shared trackActive: this one is driven by the
  // billing cycle and must not pull every other track in the scene with it.
  const railLitMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.7, depthWrite: false,
  });
  geo.trackMaterial(railLitMat);
  const railLit = new THREE.Mesh(geo.track(new THREE.BoxGeometry(11.6, 0.045, 0.09)), railLitMat);
  railLit.position.set(0, RAIL_Y + 0.05, LINE_Z);
  root.add(railLit);

  /* ---- stations --------------------------------------------------------
   * Each is a pedestal plus one recognizable object. The pedestal grounds it
   * and gives the completion light somewhere to live.
   */
  const pedestalGeo = geo.track(new THREE.CylinderGeometry(0.62, 0.68, 0.16, seg));
  const pedestalEdges = geo.track(new THREE.EdgesGeometry(pedestalGeo));
  const glowGeo = geo.track(new THREE.RingGeometry(0.7, 0.92, seg));

  const stations = specs.map((spec, i) => {
    const holder = new THREE.Group();
    holder.position.set(spec.x, LINE_Y, LINE_Z);
    root.add(holder);

    const pedestal = new THREE.Mesh(pedestalGeo, mat.ceramic);
    pedestal.position.y = -0.62;
    holder.add(pedestal);
    const edges = new THREE.LineSegments(pedestalEdges, mat.ink);
    edges.position.y = -0.62;
    holder.add(edges);

    const glowMat = new THREE.MeshBasicMaterial({
      color: ORANGE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    geo.trackMaterial(glowMat);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.53;
    holder.add(glow);

    const item = objects.build(spec.kind);
    item.group.scale.setScalar(1.7);
    holder.add(item.group);

    // Feeder from the hub down to this station: the hub is what drives the
    // line, so the connection has to be visible.
    const feed = new THREE.Mesh(
      geo.track(new THREE.CylinderGeometry(0.014, 0.014, 1, 6)),
      mat.track,
    );
    const from = new THREE.Vector3(0, -0.3, 0);
    const to = new THREE.Vector3(spec.x, LINE_Y + 0.35, LINE_Z);
    const dir = to.clone().sub(from);
    feed.scale.y = dir.length();
    feed.position.copy(from).addScaledVector(dir, 0.5);
    feed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    root.add(feed);

    return { holder, item, glow, glowMat, spec, index: i };
  });

  /* ---- the invoice being assembled -------------------------------------
   * The invoice station's own object is the one that visibly builds: its
   * line items scale in one at a time, then a checkmark lands on it. That is
   * "the bill was generated", stated as an event rather than as an icon.
   */
  const invoiceStation = stations.find((s) => s.spec.kind === "invoice") || stations[stations.length - 2];
  const stamp = objects.build("check");
  stamp.group.scale.setScalar(0.001);
  stamp.group.position.set(0.36, 0.34, 0.2);
  stamp.setState("success", 1);
  invoiceStation.holder.add(stamp.group);

  /* ---- extracted data, above the EXTRACT station -----------------------
   * Customer and amount coming off the order. Two small plates, so the
   * extraction reads as "these two fields", not as sparkle.
   */
  const extractStation = stations[1];
  const extracted = [];
  const extractMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
  });
  geo.trackMaterial(extractMat);
  const extractGeo = geo.track(new THREE.BoxGeometry(0.34, 0.1, 0.06));
  for (let i = 0; i < 3; i += 1) {
    const chip = new THREE.Mesh(extractGeo, extractMat);
    chip.position.set(-0.28 + i * 0.28, 0.7 + i * 0.16, 0.1);
    extractStation.holder.add(chip);
    extracted.push(chip);
  }

  /* ---- delivery --------------------------------------------------------
   * The finished bill leaves by two routes at once — email and message — and
   * lands on two customer records. Delivery is only believable if you can
   * see something arrive somewhere.
   */
  const deliverStation = stations[4] || stations[stations.length - 1];
  const deliveries = [];
  const receivers = [];
  [
    { kind: "envelope", to: new THREE.Vector3(5.9, 1.8, 3.0) },
    { kind: "message", to: new THREE.Vector3(6.5, 0.2, 3.7) },
  ].forEach((route, i) => {
    const parcel = objects.build(route.kind);
    parcel.group.scale.setScalar(1.3);
    parcel.group.visible = false;
    root.add(parcel.group);

    const receiver = objects.build("customer");
    receiver.group.position.copy(route.to);
    receiver.group.scale.setScalar(1.45);
    root.add(receiver.group);

    deliveries.push({
      parcel,
      from: new THREE.Vector3(deliverStation.spec.x, LINE_Y + 0.2, LINE_Z),
      to: route.to.clone().add(new THREE.Vector3(-0.55, 0, 0.1)),
      offset: i * 0.14,
    });
    receivers.push(receiver);
  });

  /* ---- job token -------------------------------------------------------
   * The work itself, travelling the line. One object, always visible, so the
   * viewer can follow a single job from order to ledger.
   */
  const tokenMat = new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.05,
  });
  geo.trackMaterial(tokenMat);
  const token = new THREE.Mesh(geo.track(new THREE.OctahedronGeometry(0.2, 0)), tokenMat);
  root.add(token);
  const tokenHaloMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.24, depthWrite: false,
  });
  geo.trackMaterial(tokenHaloMat);
  const tokenHalo = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.34, 12, 12)), tokenHaloMat);
  root.add(tokenHalo);

  const _from = new THREE.Vector3();
  const _to = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const entry = new THREE.Vector3(specs[0].x - 2.6, LINE_Y + 0.2, LINE_Z);

  // Cycle length in seconds. Deliberately slow: every step has to finish
  // being read before the next one starts.
  const CYCLE = 17;
  let clockT = 0;

  /**
   * @param weight 0..1 — how present this line is (its section's weight)
   * @param hold   when set, the cycle parks at this phase instead of running.
   *               Used for prefers-reduced-motion: freezing at phase 0 would
   *               show an empty line that never produces anything, which says
   *               less than the old scene did. Parking near the end of a run
   *               shows the finished bill, the delivery and the updated ledger
   *               as a still image.
   */
  function update(elapsed, delta, weight, hold = null) {
    root.visible = weight > 0.02;
    if (!root.visible) return;

    if (hold === null) clockT = (clockT + delta * weight) % CYCLE;
    else clockT = hold * CYCLE;
    const p = clockT / CYCLE;
    const n = stations.length;
    const scaled = p * n;
    const index = Math.min(n - 1, Math.floor(scaled));
    const local = scaled - index;


    /* -- token: move, then stop while the station works ----------------- */
    if (index === 0) _from.copy(entry);
    else _from.set(specs[index - 1].x, LINE_Y + 0.2, LINE_Z);
    _to.set(specs[index].x, LINE_Y + 0.2, LINE_Z);
    if (local < TRANSIT) {
      _pos.lerpVectors(_from, _to, smoothstep(local / TRANSIT));
    } else {
      _pos.copy(_to);
    }
    // lifts slightly while it is being worked on
    const working = local < TRANSIT ? 0 : smoothstep((local - TRANSIT) / (1 - TRANSIT));
    _pos.y += Math.sin(working * Math.PI) * 0.5;
    token.position.copy(_pos);
    tokenHalo.position.copy(_pos);
    token.rotation.y += delta * 1.4;
    token.rotation.x += delta * 0.7;
    const fade = weight * (1 - smoothstep((p - 0.95) / 0.05));
    tokenMat.emissiveIntensity = (0.8 + working * 1.1) * fade;
    token.scale.setScalar(0.8 + working * 0.35);
    tokenHalo.scale.setScalar(0.9 + Math.sin(elapsed * 2.2) * 0.08 + working * 0.4);
    tokenHaloMat.opacity = 0.2 * fade;

    /* -- stations: not yet / acting / completed -------------------------- */
    const mixRate = Math.min(1, delta * 3.2);
    stations.forEach((s, j) => {
      const x = clamp01(scaled - j);              // 0 before, ramps across, 1 after
      const acting = j === index ? bump(local) : 0;
      const completed = scaled > j + 1 ? 1 : 0;

      const state = completed ? "success" : acting > 0.15 ? "active" : x > 0 ? "process" : "neutral";
      s.item.setState(state, mixRate);

      s.glowMat.color.setHex(completed ? 0x3f9169 : ORANGE);
      s.glowMat.opacity = (completed ? 0.28 : acting * 0.6) * weight;

      // the object rises and turns to face front while it is the active step
      s.item.group.position.y = acting * 0.16;
      s.item.group.rotation.y = Math.sin(elapsed * 0.3 + j) * 0.14 + acting * 0.5;
      s.item.group.scale.setScalar(1.7 * (1 + acting * 0.16));
    });

    /* -- EXTRACT: customer + amount lift off the order ------------------- */
    const extractAct = index === 1 ? bump(local) : (scaled > 2 ? 0.25 : 0);
    extractMat.opacity = extractAct * 0.85 * weight;
    extracted.forEach((chip, i) => {
      chip.position.y = 0.5 + extractAct * (0.35 + i * 0.2);
      chip.scale.setScalar(0.6 + extractAct * 0.6);
    });

    /* -- INVOICE: assembles line by line, then is stamped ---------------- */
    const invIndex = invoiceStation.index;
    const invRows = invoiceStation.item.rows || [];
    if (scaled < invIndex) {
      // not built yet
      invRows.forEach((row) => row.scale.x = 0.001);
      stamp.group.scale.setScalar(0.001);
    } else {
      const build = index === invIndex ? clamp01((local - TRANSIT * 0.5) / (1 - TRANSIT * 0.5)) : 1;
      invRows.forEach((row, r) => {
        const rowIn = smoothstep((build - r * 0.16) / 0.2);
        row.scale.x = Math.max(0.001, rowIn * (row.userData.fullX || 1));
      });
      // the stamp lands only once every line is on the page
      const stamped = smoothstep((build - 0.82) / 0.18);
      stamp.group.scale.setScalar(0.001 + stamped * 0.75);
      stamp.group.rotation.z = (1 - stamped) * 0.9;
    }

    /* -- DELIVER: the bill leaves by two routes and arrives -------------- */
    const delIndex = stations.indexOf(deliverStation);
    deliveries.forEach((d, i) => {
      let travel = -1;
      if (index === delIndex && local >= TRANSIT) {
        travel = clamp01((local - TRANSIT) / (1 - TRANSIT) - d.offset) / (1 - d.offset || 1);
      } else if (scaled > delIndex + 1) {
        travel = 1;
      }
      d.parcel.group.visible = travel >= 0 && travel < 0.999 && weight > 0.1;
      if (!d.parcel.group.visible) return;
      const e = smoothstep(travel);
      d.parcel.group.position.lerpVectors(d.from, d.to, e);
      d.parcel.group.position.y += Math.sin(e * Math.PI) * 0.7;
      d.parcel.group.rotation.y = -0.4 - e * 0.8;
      d.parcel.group.scale.setScalar(1.3 * (0.4 + e * 0.6));
      d.parcel.setState(e > 0.75 ? "success" : "active", mixRate);
      // the receiver only lights once the parcel has actually reached it
      receivers[i].setState(e > 0.85 ? "success" : "neutral", mixRate);
    });
    if (scaled < delIndex) receivers.forEach((r) => r.setState("neutral", mixRate));

    /* -- rail fills in behind the token ----------------------------------
     * A progress bar for the whole job: how much of the billing run is done.
     */
    railLitMat.opacity = (0.42 + working * 0.35) * weight;
    railLit.scale.x = Math.max(0.001, clamp01(p));
    railLit.position.x = -5.8 + (11.6 * railLit.scale.x) / 2;
  }

  // Record each invoice row's authored width once, so the assembly animation
  // can restore it exactly rather than assuming every row is full width.
  (invoiceStation.item.rows || []).forEach((row) => { row.userData.fullX = row.scale.x; });

  return { root, update, stations, token };
}
