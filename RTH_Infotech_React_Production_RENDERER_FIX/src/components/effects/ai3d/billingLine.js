// Automatic bill generation, shown as an actual production line.
//
// The previous billing visual was five invoice sheets sliding down one curve
// into the hub. Sheets moving is not a process: nothing is extracted, nothing
// is calculated, nothing is produced. A viewer sees paper drift and learns
// nothing about billing.
//
// This is the real sequence, one station per step:
//
//   RECEIVE -> ANALYSE -> TAX -> INVOICE -> EMAIL -> WHATSAPP -> ACCOUNTING
//   transaction  data    GST   document   envelope   message     ledger
//                fields  %     assembles  delivered  confirmed   synced
//                        calc  + stamped
//
// A job token rides the chain between stations. It MOVES, then it STOPS while
// the station does its work — anticipation, action, result, hold. That pause
// is what makes each step readable; a continuous slide is not.
//
// THREE STATES, AND ONLY THREE:
//   waiting    light grey   this step has not been reached
//   working    RTH orange   this step is running RIGHT NOW
//   completed  success green  this step is finished — and STAYS green
//
// Stations accumulate. Once a step has run it stays green for the rest of the
// pass, so the run ends with the entire chain green and a small PROCESS
// COMPLETE tag: the viewer can see the whole workflow at once, having watched
// each stage earn its colour one at a time.
//
// ORIENTATION
// Desktop lays the chain out horizontally; portrait lays the SAME seven
// stations out vertically. Not a crop and not a shrink — every step is present
// and labelled in both, because a workflow that drops a step is a different
// workflow.
//
// CLOCK
// When the caller supplies a phase (the #billing scroll position), the chain
// is driven by it, so the run starts when the section arrives and reaches its
// all-green state while the section is still on screen — which is what the
// recorded video needs. Without a phase it falls back to its own loop.

import * as THREE from "three";

const ORANGE = 0xeb6217;
const GREEN = 0x3f9169;   // the scene's existing success green (businessObjects STATE.success)
const WAITING = 0x9c968e; // light warm grey — inactive, but still legible on white

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
};
/** A rise-and-fall bump across x in 0..1 — the shape of one station's action. */
const bump = (x) => smoothstep(x / 0.3) * (1 - smoothstep((x - 0.66) / 0.34));

// Fraction of each station's slot spent travelling to it; the rest is the
// hold during which its work is actually performed and can be read.
const TRANSIT = 0.36;

/**
 * The workflow. `dur` is seconds of screen time — long enough for the step to
 * be understood, short enough that the whole chain finishes inside the section.
 * Delivery steps are shorter because "it was sent" is a smaller idea than
 * "the tax was calculated".
 */
const STEPS = [
  { kind: "transaction", label: ["TRANSACTION", "RECEIVED"], dur: 1.6 },
  { kind: "analytics",   label: ["ANALYSE", "TRANSACTION"],  dur: 2.0 },
  { kind: "tax",         label: ["CALCULATE", "TAX"],        dur: 2.0 },
  { kind: "invoice",     label: ["GENERATE", "INVOICE"],     dur: 2.3 },
  { kind: "envelope",    label: ["EMAIL", "INVOICE"],        dur: 1.5 },
  { kind: "message",     label: ["WHATSAPP", "CONFIRMED"],   dur: 1.5 },
  { kind: "ledger",      label: ["SYNC", "ACCOUNTING"],      dur: 1.9 },
];

// Seconds spent on the finished state: every station green, PROCESS COMPLETE
// showing. This is the shot the sequence is built to arrive at, so it gets
// real time rather than a beat.
const HOLD = 2.8;

const WORK_TIME = STEPS.reduce((a, s) => a + s.dur, 0);
const CYCLE = WORK_TIME + HOLD;

// Label plate proportions. Seven labels sit under seven stations one chain
// spacing apart, so a label is only allowed to be about as wide as its own
// station's slot — which is what forces two short lines rather than one long
// one. The canvas matches this ratio so nothing is stretched.
const LABEL_W = 512;
const LABEL_H = 224;
const LABEL_RATIO = LABEL_W / LABEL_H;

/**
 * Small all-caps tag, drawn on a canvas as one or two lines and auto-fitted to
 * the plate's width. White text, tinted by the material: one texture serves
 * all three states, so completing a step never re-rasterises anything.
 */
function labelTexture(lines) {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  try { ctx.letterSpacing = "4px"; } catch { /* older engines ignore this */ }

  const inner = LABEL_W - 36;
  const font = (px) => `700 ${px}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`;
  // Shrink until the longest line fits: a label that overflows its plate is
  // what produced seven overlapping words in the first place.
  let size = 74;
  for (; size > 26; size -= 2) {
    ctx.font = font(size);
    if (lines.every((l) => ctx.measureText(l).width <= inner)) break;
  }
  ctx.font = font(size);
  const lead = size * 1.24;
  lines.forEach((line, i) => {
    ctx.fillText(line, LABEL_W / 2, LABEL_H / 2 + (i - (lines.length - 1) / 2) * lead);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/**
 * @param objects business-object factory from businessObjects.js
 * @param mat     shared scene materials
 * @param geo     tracking helper
 * @param mobile  portrait composition — the chain runs top to bottom instead
 */
export function createBillingLine(objects, mat, geo, { seg = 24, mobile = false } = {}) {
  const root = new THREE.Group();

  /* ---- composition -----------------------------------------------------
   * Every step is placed here, and no step is ever omitted: `count`-style
   * trimming is exactly what made the process look incomplete. The two
   * layouts differ only in where the stations sit and how big they are.
   */
  const N = STEPS.length;
  // Portrait pushes the chain well forward of the stage deck. At the shallower
  // depth the deck's rim cut straight across the delivery steps, and a step you
  // cannot see is a step the process does not have.
  const LINE_Z = mobile ? 4.8 : 2.4;
  // Portrait sits the column lower than landscape sits the row: the caption
  // card owns the top of a 9:16 frame, and the first step of a process is the
  // last thing that may be hidden behind it.
  const LINE_Y = mobile ? -1.15 : -0.55;
  // Sized for the frame, not for the world: portrait's numbers are smaller
  // because it sits nearer the camera, so on screen the steps read the same.
  const SPACING = mobile ? 1.02 : 1.5;
  const ITEM_SCALE = mobile ? 1.02 : 1.42;
  // Portrait runs the chain left of centre so the labels have a column of
  // their own on the right rather than sitting on top of the objects.
  // Landscape runs it right of centre for the same kind of reason: the
  // explanation card sits in the lower LEFT of the frame, and a step label
  // hidden behind that card is a step the viewer cannot follow.
  const LINE_X = mobile ? -1.3 : 1.4;
  // Plate width in world units. Landscape keeps it just inside one station's
  // slot so neighbouring labels can never touch; portrait can be wider,
  // because there the labels sit beside the chain in their own column.
  const LABEL_PLATE = mobile ? 1.76 : 1.5;

  // Index -> world position of that station.
  const place = (i) => (mobile
    // top to bottom: RECEIVE at the top, ACCOUNTING at the bottom
    ? new THREE.Vector3(LINE_X, LINE_Y + ((N - 1) / 2 - i) * SPACING, LINE_Z)
    // left to right
    : new THREE.Vector3(LINE_X + (i - (N - 1) / 2) * SPACING, LINE_Y, LINE_Z));

  const positions = STEPS.map((_, i) => place(i));
  // Where the job enters the chain from, one slot before the first station.
  // Close enough that the incoming job reads as arriving AT the chain rather
  // than as a rail running off the edge of the frame.
  const entry = positions[0].clone().add(
    mobile ? new THREE.Vector3(0, SPACING * 0.85, 0) : new THREE.Vector3(-SPACING * 0.85, 0, 0),
  );

  /* ---- chain links -----------------------------------------------------
   * One segment per hop, each with a grey base and a coloured overlay that
   * fills as the token crosses it and settles green once the hop is done.
   * A single long rail could only ever say "how far along" — per-hop links
   * say WHICH hop, which is the thing the viewer is being asked to follow.
   */
  const linkBaseMat = new THREE.MeshBasicMaterial({
    color: 0xd7d3cd, transparent: true, opacity: 0.7, depthWrite: false,
  });
  geo.trackMaterial(linkBaseMat);
  // Thin on purpose: the chain is the thread the eye follows between the
  // stations, not a beam laid across the scene.
  const linkGeo = geo.track(new THREE.BoxGeometry(1, 0.028, 0.028));

  const links = [];
  const addLink = (from, to) => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mid = from.clone().addScaledVector(dir, 0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0), dir.clone().normalize(),
    );

    const base = new THREE.Mesh(linkGeo, linkBaseMat);
    base.position.copy(mid);
    base.quaternion.copy(quat);
    base.scale.x = len;
    root.add(base);

    const litMat = new THREE.MeshBasicMaterial({
      color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
    });
    geo.trackMaterial(litMat);
    const lit = new THREE.Mesh(
      geo.track(new THREE.BoxGeometry(1, 0.05, 0.05)), litMat,
    );
    lit.quaternion.copy(quat);
    root.add(lit);

    links.push({ lit, litMat, from: from.clone(), to: to.clone(), len });
  };

  addLink(entry, positions[0]);
  for (let i = 1; i < N; i += 1) addLink(positions[i - 1], positions[i]);

  /* ---- stations --------------------------------------------------------
   * Each is a pedestal, one recognizable business object, and its own label.
   * The pedestal grounds it and gives the state light somewhere to live; the
   * label is what lets the workflow be read without narration.
   */
  const pedestalGeo = geo.track(new THREE.CylinderGeometry(0.52, 0.58, 0.14, seg));
  const pedestalEdges = geo.track(new THREE.EdgesGeometry(pedestalGeo));
  const glowGeo = geo.track(new THREE.RingGeometry(0.6, 0.82, seg));
  const labelGeo = geo.track(new THREE.PlaneGeometry(LABEL_RATIO, 1));

  const stations = STEPS.map((spec, i) => {
    const holder = new THREE.Group();
    holder.position.copy(positions[i]);
    root.add(holder);

    // THE WHOLE STAGE CHANGES COLOUR, not just a detail on it.
    //
    // Every object in the scene shares ONE white ceramic material, and
    // businessObjects' setState only tints each object's small mark. That is
    // right for the rest of the scene — but here the state of a step IS the
    // subject, and a white card with a green speck on it does not read as
    // "this step is done". So each station gets its own copy of the body
    // material, and the station's pedestal and every ceramic surface of its
    // object are tinted together: white while waiting, orange while running,
    // green once complete.
    const bodyMat = mat.ceramic.clone();
    geo.trackMaterial(bodyMat);
    const bodyBase = bodyMat.color.clone();

    const pedestal = new THREE.Mesh(pedestalGeo, bodyMat);
    pedestal.position.y = -0.56;
    holder.add(pedestal);
    const edges = new THREE.LineSegments(pedestalEdges, mat.ink);
    edges.position.y = -0.56;
    holder.add(edges);

    const glowMat = new THREE.MeshBasicMaterial({
      color: ORANGE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    geo.trackMaterial(glowMat);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.48;
    holder.add(glow);

    const item = objects.build(spec.kind);
    item.group.scale.setScalar(ITEM_SCALE);
    holder.add(item.group);
    // Swap this object's shared white body for the station's own copy, so it
    // takes the station's state colour with the pedestal.
    item.group.traverse((child) => {
      if (child.isMesh && child.material === objects.shell) child.material = bodyMat;
    });

    // Label. Landscape puts it under the station (the row is wide and short);
    // portrait puts it beside the station, because stacking seven labels under
    // seven objects in a column is what would force them small.
    const tex = geo.trackTexture(labelTexture(spec.label));
    // depthTest off, drawn last: the step names are the one thing in this
    // scene that must never be half-readable. In portrait the column runs
    // right through the translucent stage deck, and the deck was washing out
    // EMAIL / WHATSAPP into a grey smear — the two steps a viewer is least
    // able to guess from the icon alone.
    const labelMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.9, depthWrite: false,
      depthTest: false, color: WAITING,
    });
    geo.trackMaterial(labelMat);
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.renderOrder = 12;
    label.scale.setScalar(LABEL_PLATE / LABEL_RATIO);
    if (mobile) label.position.set(1.44, -0.05, 0.2);
    else label.position.set(0, -1.16, 0.2);
    holder.add(label);

    // A completion tick that lands on the station once its step is done. The
    // green is the state; the tick is the evidence.
    const tick = objects.build("check");
    tick.setState("success", 1);
    tick.group.scale.setScalar(0.001);
    tick.group.position.set(mobile ? 0.72 : 0.5, 0.62, 0.25);
    holder.add(tick.group);

    return {
      holder, item, glow, glowMat, label, labelMat, tick, spec, index: i,
      bodyMat, bodyBase,
    };
  });

  /* ---- hub feeder ------------------------------------------------------
   * The hub is what drives the line, so the connection has to be visible.
   * Landscape can afford one feeder per station; portrait would turn seven
   * of them into a fan across the whole frame, so it feeds the head of the
   * chain and lets the chain itself carry the rest.
   */
  const feedTargets = mobile ? [entry] : positions;
  feedTargets.forEach((target) => {
    const feed = new THREE.Mesh(
      geo.track(new THREE.CylinderGeometry(0.013, 0.013, 1, 6)),
      mat.track,
    );
    const from = new THREE.Vector3(0, -0.3, 0);
    const dir = target.clone().add(new THREE.Vector3(0, 0.35, 0)).sub(from);
    feed.scale.y = dir.length();
    feed.position.copy(from).addScaledVector(dir, 0.5);
    feed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    root.add(feed);
  });

  /* ---- step 2, ANALYSE: fields lift off the transaction ----------------
   * Three small plates, so the analysis reads as "these fields were read",
   * not as sparkle.
   */
  const analyseStation = stations[1];
  const extracted = [];
  const extractMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
  });
  geo.trackMaterial(extractMat);
  const extractGeo = geo.track(new THREE.BoxGeometry(0.3, 0.09, 0.05));
  for (let i = 0; i < 3; i += 1) {
    const chip = new THREE.Mesh(extractGeo, extractMat);
    chip.position.set(-0.26 + i * 0.26, 0.66 + i * 0.15, 0.1);
    analyseStation.holder.add(chip);
    extracted.push(chip);
  }

  /* ---- step 3, CALCULATE TAX: the percent glyph resolves ---------------
   * The tax station's own object is a % plate. It spins up while the figure
   * is being worked out and settles square-on when it is decided — the
   * arithmetic, stated as a movement that stops.
   */
  const taxStation = stations[2];

  /* ---- step 4, GENERATE INVOICE: assembles, then is stamped ------------ */
  const invoiceStation = stations[3];
  const stamp = objects.build("check");
  stamp.group.scale.setScalar(0.001);
  stamp.group.position.set(0.34, 0.3, 0.2);
  stamp.setState("success", 1);
  invoiceStation.holder.add(stamp.group);
  // Record each row's authored width, so assembly restores it exactly rather
  // than assuming every row is full width.
  (invoiceStation.item.rows || []).forEach((row) => { row.userData.fullX = row.scale.x; });

  /* ---- steps 5 & 6, DELIVERY: the bill arrives somewhere ---------------
   * Email and WhatsApp are separate steps with separate recipients, because
   * "sent" and "confirmed" are separate facts. Delivery is only believable if
   * you can see something arrive.
   */
  const deliveries = [4, 5].map((stepIndex, i) => {
    const station = stations[stepIndex];
    // Portrait sends the deliveries out to the LEFT: the right of the frame is
    // the label column, and a recipient card parked over a step's name is the
    // one thing that can make a labelled process unreadable.
    const to = station.holder.position.clone().add(
      mobile
        ? new THREE.Vector3(-1.3, 0.68 + i * 0.2, 0.6)
        : new THREE.Vector3(0.15 + i * 0.2, 1.85 + i * 0.55, 0.8),
    );

    const parcel = objects.build(STEPS[stepIndex].kind);
    parcel.group.scale.setScalar(1.1);
    parcel.group.visible = false;
    root.add(parcel.group);

    const receiver = objects.build("customer");
    receiver.group.position.copy(to);
    receiver.group.scale.setScalar(1.25);
    root.add(receiver.group);

    return {
      parcel,
      receiver,
      stepIndex,
      from: station.holder.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
      to: to.clone().add(new THREE.Vector3(-0.45, -0.3, 0.1)),
    };
  });

  /* ---- step 7, SYNC ACCOUNTING: the ledger takes the record ------------
   * A pulse travelling from the invoice station into the ledger, so the sync
   * is a transfer rather than a light coming on by itself.
   */
  const ledgerStation = stations[6];
  const syncMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
  });
  geo.trackMaterial(syncMat);
  const sync = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.13, 10, 10)), syncMat);
  root.add(sync);
  const syncFrom = invoiceStation.holder.position.clone().add(new THREE.Vector3(0, 0.35, 0));
  const syncTo = ledgerStation.holder.position.clone().add(new THREE.Vector3(0, 0.3, 0));

  /* ---- PROCESS COMPLETE ------------------------------------------------
   * One small tag, only on the finished state. Deliberately a tag and not a
   * headline: the picture has already made the point, this only names it.
   */
  const completeTex = geo.trackTexture(labelTexture(["PROCESS COMPLETE"]));
  const completeMat = new THREE.MeshBasicMaterial({
    map: completeTex, transparent: true, opacity: 0, depthWrite: false,
    depthTest: false, color: GREEN,
  });
  geo.trackMaterial(completeMat);
  const complete = new THREE.Mesh(labelGeo, completeMat);
  complete.renderOrder = 12;
  complete.scale.setScalar((mobile ? 3.2 : 2.6) / LABEL_RATIO);
  // Landscape has clear air above the row; portrait does not — the caption
  // card is up there — so the tag closes the column from underneath.
  complete.position.set(
    mobile ? LINE_X + 0.45 : LINE_X,
    LINE_Y + ((N - 1) / 2) * SPACING * (mobile ? -1 : 0) + (mobile ? -1.05 : 1.55),
    LINE_Z + 0.3,
  );
  root.add(complete);

  /* ---- job token -------------------------------------------------------
   * The work itself, travelling the chain. One object, always visible, so a
   * single job can be followed from transaction to accounting.
   */
  const tokenMat = new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.05,
  });
  geo.trackMaterial(tokenMat);
  const token = new THREE.Mesh(geo.track(new THREE.OctahedronGeometry(0.18, 0)), tokenMat);
  root.add(token);
  const tokenHaloMat = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.24, depthWrite: false,
  });
  geo.trackMaterial(tokenHaloMat);
  const tokenHalo = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.3, 12, 12)), tokenHaloMat);
  root.add(tokenHalo);

  const _from = new THREE.Vector3();
  const _to = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _colour = new THREE.Color();
  // Body tints. Lighter than the mark colours: a whole ceramic surface carries
  // far more area than a mark does, so the same hex at full strength would
  // shout. These are the colours the stages actually fill with.
  const _greenBody = new THREE.Color(0x5fae86);
  const _orangeBody = new THREE.Color(0xf08a45);

  // Cumulative start time of each step, so a step's own duration decides how
  // long it is on screen rather than every step getting an equal slice.
  const START = [];
  STEPS.reduce((acc, s, i) => { START[i] = acc; return acc + s.dur; }, 0);

  let clockT = 0;

  /**
   * @param weight 0..1 — how present this line is (its section's weight)
   * @param hold   when set, the cycle parks at this phase instead of running.
   *               Used for prefers-reduced-motion: freezing at phase 0 would
   *               show an empty line that never produces anything. Parking in
   *               the final hold shows the whole chain green instead.
   * @param phase  when set (0..1), the caller's own progress drives the chain
   *               — the #billing scroll position. This is what guarantees the
   *               run both STARTS and FINISHES while the section is on screen,
   *               instead of a free-running loop being caught mid-step.
   */
  function update(elapsed, delta, weight, hold = null, phase = null) {
    root.visible = weight > 0.02;
    if (!root.visible) return;

    if (hold !== null) clockT = clamp01(hold) * CYCLE;
    else if (phase !== null) clockT = clamp01(phase) * CYCLE;
    else clockT = (clockT + delta * weight) % CYCLE;

    const t = clockT;
    // Which step is running, and how far into it. Past the last step the
    // chain is finished and simply holds, every station green.
    let index = N - 1;
    let local = 1;
    let finished = true;
    for (let i = 0; i < N; i += 1) {
      if (t < START[i] + STEPS[i].dur) {
        index = i;
        local = clamp01((t - START[i]) / STEPS[i].dur);
        finished = false;
        break;
      }
    }
    // 0..1 through the finished hold — drives the PROCESS COMPLETE tag.
    const holdP = finished ? clamp01((t - WORK_TIME) / HOLD) : 0;
    const mixRate = Math.min(1, Math.max(delta, 1 / 60) * 3.6);
    // How much of the current step's WORK (as opposed to travel) has run.
    const working = local < TRANSIT ? 0 : smoothstep((local - TRANSIT) / (1 - TRANSIT));
    const acting = finished ? 0 : bump(local);

    /* -- token: move, then stop while the station works ----------------- */
    _from.copy(index === 0 ? entry : positions[index - 1]);
    _to.copy(positions[index]);
    if (!finished && local < TRANSIT) {
      _pos.lerpVectors(_from, _to, smoothstep(local / TRANSIT));
    } else {
      _pos.copy(_to);
    }
    _pos.y += Math.sin(working * Math.PI) * 0.42;
    token.position.copy(_pos);
    tokenHalo.position.copy(_pos);
    token.rotation.y += delta * 1.4;
    token.rotation.x += delta * 0.7;
    // The token is the work in progress, so it retires once the work is done
    // rather than sitting lit on a finished chain.
    const tokenFade = weight * (1 - smoothstep(holdP / 0.25));
    tokenMat.emissiveIntensity = (0.8 + working * 1.1) * tokenFade;
    token.scale.setScalar((0.8 + working * 0.35) * (tokenFade > 0.01 ? 1 : 0.001));
    tokenHalo.scale.setScalar(0.9 + Math.sin(elapsed * 2.2) * 0.08 + working * 0.4);
    tokenHaloMat.opacity = 0.2 * tokenFade;

    /* -- stations: waiting -> working -> completed, and completed STAYS --
     * A station's colour is derived from the clock every frame rather than
     * latched, so scrolling back through the section rewinds the process
     * honestly. Moving forward, a green step is never revisited.
     */
    stations.forEach((s, j) => {
      const done = finished || j < index;
      // The step being travelled TO is already warming: the viewer should see
      // where the job is going before it gets there.
      const approaching = !done && j === index;
      const state = done ? "success"
        : approaching ? (local < TRANSIT ? "process" : "active")
          : "neutral";
      s.item.setState(state, mixRate);

      const target = done ? GREEN : approaching ? ORANGE : WAITING;
      s.glowMat.color.setHex(done ? GREEN : ORANGE);
      s.glowMat.opacity = (done ? 0.3 : approaching ? (0.16 + acting * 0.55) : 0) * weight;

      _colour.setHex(target);
      s.labelMat.color.lerp(_colour, mixRate);
      s.labelMat.opacity = (done ? 0.95 : approaching ? 1 : 0.5) * weight;

      // The station's whole body — pedestal and object together. Waiting is
      // the untouched white; running fills orange; completed fills green and
      // stays there. Blended toward the state colour rather than replaced by
      // it so the surface still reads as a lit ceramic object rather than a
      // flat green cut-out, which is what keeps it premium at this weight.
      _colour.copy(s.bodyBase);
      if (done) _colour.lerp(_greenBody, 0.82);
      else if (approaching) _colour.lerp(_orangeBody, 0.5 + acting * 0.34);
      s.bodyMat.color.lerp(_colour, mixRate);

      // Completed tick pops in as the step finishes, then stays.
      const tickIn = done ? 1 : approaching ? smoothstep((local - 0.88) / 0.12) : 0;
      s.tick.group.scale.setScalar(0.001 + tickIn * 0.55);
      s.tick.group.rotation.z = (1 - tickIn) * 0.8;

      // The object rises and turns to face front while it is the active step.
      const lift = approaching ? acting : 0;
      s.item.group.position.y = lift * 0.16;
      s.item.group.rotation.y = Math.sin(elapsed * 0.3 + j) * 0.12 + lift * 0.5;
      s.item.group.scale.setScalar(ITEM_SCALE * (1 + lift * 0.16));
    });

    /* -- chain links: fill orange as crossed, settle green once passed --- */
    links.forEach((link, j) => {
      // links[0] is entry->station0, so link j is the hop INTO station j.
      const crossed = finished || j < index;
      let fill = crossed ? 1 : 0;
      if (!finished && j === index) fill = local < TRANSIT ? smoothstep(local / TRANSIT) : 1;
      link.lit.scale.x = Math.max(0.001, link.len * fill);
      link.lit.position.lerpVectors(link.from, link.to, fill / 2);
      link.litMat.color.setHex(crossed ? GREEN : ORANGE);
      link.litMat.opacity = (crossed ? 0.55 : 0.85) * weight * (fill > 0.002 ? 1 : 0);
    });

    /* -- step 2: fields lift off the transaction ------------------------- */
    const analyseAct = index === 1 && !finished ? acting : (t > START[2] ? 0.22 : 0);
    extractMat.opacity = analyseAct * 0.85 * weight;
    extracted.forEach((chip, i) => {
      chip.position.y = 0.48 + analyseAct * (0.32 + i * 0.18);
      chip.scale.setScalar(0.6 + analyseAct * 0.6);
    });

    /* -- step 3: the % works, then settles ------------------------------- */
    const taxAct = index === 2 && !finished ? working : 0;
    // Spins while the figure is being decided; square-on the moment it is.
    taxStation.item.group.rotation.y += taxAct * delta * 5.2;
    if (index > 2 || finished) taxStation.item.group.rotation.y *= 1 - Math.min(1, delta * 6);

    /* -- step 4: the invoice assembles line by line, then is stamped ----- */
    const invRows = invoiceStation.item.rows || [];
    if (t < START[3]) {
      invRows.forEach((row) => { row.scale.x = 0.001; });
      stamp.group.scale.setScalar(0.001);
    } else {
      const build = index === 3 && !finished
        ? clamp01((local - TRANSIT * 0.5) / (1 - TRANSIT * 0.5))
        : 1;
      invRows.forEach((row, r) => {
        const rowIn = smoothstep((build - r * 0.16) / 0.2);
        row.scale.x = Math.max(0.001, rowIn * (row.userData.fullX || 1));
      });
      const stamped = smoothstep((build - 0.82) / 0.18);
      stamp.group.scale.setScalar(0.001 + stamped * 0.7);
      stamp.group.rotation.z = (1 - stamped) * 0.9;
    }

    /* -- steps 5 & 6: the bill is sent, and arrives ---------------------- */
    deliveries.forEach((d) => {
      let travel = -1;
      if (!finished && index === d.stepIndex && local >= TRANSIT) {
        travel = clamp01((local - TRANSIT) / (1 - TRANSIT));
      } else if (finished || index > d.stepIndex) {
        travel = 1;
      }
      const flying = travel >= 0 && travel < 0.999;
      d.parcel.group.visible = flying && weight > 0.1;
      // The recipient lights only once something has actually reached it, and
      // stays lit afterwards — the delivery is a fact, not a flash.
      d.receiver.setState(travel >= 1 || travel > 0.85 ? "success" : "neutral", mixRate);
      if (!d.parcel.group.visible) return;
      const e = smoothstep(travel);
      d.parcel.group.position.lerpVectors(d.from, d.to, e);
      d.parcel.group.position.y += Math.sin(e * Math.PI) * 0.5;
      d.parcel.group.rotation.y = -0.4 - e * 0.8;
      d.parcel.group.scale.setScalar(1.1 * (0.5 + e * 0.5));
      d.parcel.setState(e > 0.75 ? "success" : "active", mixRate);
    });

    /* -- step 7: the record travels into the ledger ---------------------- */
    const syncing = !finished && index === 6 ? working : 0;
    sync.visible = syncing > 0.001 && syncing < 0.999;
    if (sync.visible) {
      sync.position.lerpVectors(syncFrom, syncTo, syncing);
      sync.position.y += Math.sin(syncing * Math.PI) * 0.55;
      syncMat.opacity = Math.sin(syncing * Math.PI) * 0.9 * weight;
    }

    /* -- the finished state ---------------------------------------------- */
    completeMat.opacity = smoothstep(holdP / 0.25) * 0.95 * weight;
    const completeScale = (mobile ? 3.2 : 2.6) / LABEL_RATIO;
    complete.scale.setScalar(completeScale * (0.92 + smoothstep(holdP / 0.3) * 0.08));
  }

  return { root, update, stations, token, steps: STEPS, cycle: CYCLE };
}
