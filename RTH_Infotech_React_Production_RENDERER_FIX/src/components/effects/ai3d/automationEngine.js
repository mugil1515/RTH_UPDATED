// The RTH Automation Core — the hero object of the whole page.
//
// This is the SAME central glass core the site already had, kept as the
// processing chamber. What is added around it is the part that was missing:
// a direction. A cube alone has no front, no input and no output, so it can
// only ever read as decoration. Here the identical nested-glass core sits at
// the middle of a machine that states its own process by shape:
//
//     [ INPUT bay ] -> [ PROCESSING chamber ] -> [ OUTPUT bay ]
//        (open)           (scan / extract)          (open)
//
// The three zones share one titanium deck, left to right, with an illuminated
// channel running through the base in the direction of travel. A scan bar
// sweeps the chamber, extracted data points rise off whatever is being read,
// a three-way route selector shows the DECIDE step choosing a branch, and an
// EXECUTE control on the deck is what the robotic hand presses — which is
// what finally gives the hand a reason to exist.
//
// Every visible change is driven by a named phase from the scroll storyboard,
// so nothing here moves without a stated cause.

import * as THREE from "three";

const ORANGE = 0xeb6217;
const TITANIUM = 0xbfbdb8;
const SUCCESS = 0x3f9169;

/** Small functional label — INPUT / PROCESSING / ACTION. A tag, not prose. */
function labelTexture(text) {
  const w = 256;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#8a857e";
  ctx.font = "600 27px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // letterSpacing is Chromium-only; the label is still correct without it.
  try { ctx.letterSpacing = "5px"; } catch { /* older engines ignore this */ }
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  return tex;
}

/**
 * @param mat shared scene materials ({ ceramic, thread, ... })
 * @param geo tracking helper ({ track, trackMaterial, trackTexture })
 */
export function createAutomationCore(mat, geo, { seg = 32, labels = true, scale = 1 } = {}) {
  const root = new THREE.Group();

  // Zone centres in local space. The whole story reads left to right.
  const IN_X = -3.5;
  const MID_X = 0;
  const OUT_X = 3.5;
  const DECK_Y = -1.55;

  const titanium = new THREE.MeshPhysicalMaterial({
    color: TITANIUM, metalness: 0.9, roughness: 0.3,
    clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.5,
  });
  geo.trackMaterial(titanium);

  const emissive = (color, opacity) => {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
    });
    geo.trackMaterial(m);
    return m;
  };

  /* ---- chassis ---------------------------------------------------------
   * One continuous deck under all three zones: this is what makes them read
   * as a single machine rather than three separate props.
   */
  const deck = new THREE.Mesh(geo.track(new THREE.BoxGeometry(10.4, 0.26, 2.6)), titanium);
  deck.position.y = DECK_Y;
  root.add(deck);
  const deckEdges = new THREE.LineSegments(geo.track(new THREE.EdgesGeometry(deck.geometry)), mat.ink);
  deckEdges.position.y = DECK_Y;
  root.add(deckEdges);

  const underLip = new THREE.Mesh(geo.track(new THREE.BoxGeometry(9.8, 0.1, 2.1)), mat.ceramicSoft);
  underLip.position.y = DECK_Y - 0.18;
  root.add(underLip);

  // Flow channel: an illuminated strip along the deck pointing in the
  // direction of travel. Pulses run along it, so the machine states its own
  // direction even at rest — the single clearest "this goes that way" cue.
  const channelMat = emissive(ORANGE, 0.5);
  const channel = new THREE.Mesh(geo.track(new THREE.BoxGeometry(9.4, 0.045, 0.14)), channelMat);
  channel.position.set(0, DECK_Y + 0.16, 1.15);
  root.add(channel);

  const pulses = [];
  const pulseMat = emissive(ORANGE, 0.95);
  const pulseGeo = geo.track(new THREE.BoxGeometry(0.7, 0.07, 0.19));
  for (let i = 0; i < 4; i += 1) {
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.position.set(0, DECK_Y + 0.17, 1.15);
    pulse.userData.t = i / 4;
    root.add(pulse);
    pulses.push(pulse);
  }

  /* ---- INPUT bay -------------------------------------------------------
   * Deliberately open on the left: a mouth things go into. The rollers read
   * as a conveyor, so an object sitting there is obviously queued.
   */
  const inputBay = new THREE.Group();
  inputBay.position.x = IN_X;
  root.add(inputBay);

  const rollerGeo = geo.track(new THREE.CylinderGeometry(0.11, 0.11, 1.7, 12));
  const rollers = [];
  for (let i = 0; i < 5; i += 1) {
    const roller = new THREE.Mesh(rollerGeo, titanium);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(-1.15 + i * 0.58, DECK_Y + 0.24, 0);
    inputBay.add(roller);
    rollers.push(roller);
  }
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(geo.track(new THREE.BoxGeometry(3.0, 0.07, 0.08)), mat.ceramic);
    rail.position.set(-0.1, DECK_Y + 0.38, side * 0.92);
    inputBay.add(rail);
  });
  // A feed chute angled down into the conveyor: business data arriving from
  // outside the machine, given a physical mouth to arrive through.
  const chute = new THREE.Mesh(geo.track(new THREE.BoxGeometry(1.5, 0.06, 1.5)), mat.ceramic);
  chute.position.set(-1.75, DECK_Y + 0.72, 0);
  chute.rotation.z = -0.42;
  inputBay.add(chute);

  /* ---- PROCESSING chamber ----------------------------------------------
   * The original nested glass core, unchanged in character: outer glass
   * shell, warm inner shell, luminous orange heart. It is now enclosed by
   * corner posts and stood on the deck, so it reads as the working part of a
   * machine instead of a floating object.
   */
  const chamber = new THREE.Group();
  chamber.position.set(MID_X, 0.35, 0);
  root.add(chamber);

  const outerGeo = geo.track(new THREE.BoxGeometry(3.0, 3.0, 2.4));
  const outer = new THREE.Mesh(outerGeo, mat.heroGlass);
  chamber.add(outer);
  chamber.add(new THREE.LineSegments(geo.track(new THREE.EdgesGeometry(outerGeo)), mat.ink));

  const midGeo = geo.track(new THREE.BoxGeometry(2.05, 2.05, 1.6));
  const mid = new THREE.Mesh(midGeo, mat.heroGlassWarm);
  chamber.add(mid);
  chamber.add(new THREE.LineSegments(geo.track(new THREE.EdgesGeometry(midGeo)), mat.threadWarm));

  const inner = new THREE.Group();
  const coreBox = new THREE.Mesh(geo.track(new THREE.BoxGeometry(1.1, 1.1, 1.1)), mat.core);
  inner.add(coreBox);
  const coreHalo = new THREE.Mesh(geo.track(new THREE.BoxGeometry(1.7, 1.7, 1.7)), mat.coreHalo);
  inner.add(coreHalo);
  chamber.add(inner);

  // Corner posts so the chamber reads as engineered, not as a floating pane.
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.09, 3.1, 0.09)), titanium);
    post.position.set(sx * 1.5, 0, sz * 1.2);
    chamber.add(post);
  });
  // Legs down to the deck: the chamber is supported, not levitating.
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.055, 0.07, 1.55, 10)), titanium);
    leg.position.set(sx * 1.5, -2.28, sz * 1.2);
    chamber.add(leg);
  });

  // SCAN: a bar that sweeps the chamber. Its travel is the scan.
  const scanMat = emissive(ORANGE, 0);
  const scanBar = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.08, 2.7, 2.2)), scanMat);
  chamber.add(scanBar);

  // EXTRACT: data points that rise out of whatever is being read. This is the
  // step where "customer + amount" comes off a document.
  const analyzeMat = emissive(ORANGE, 0);
  const analyzeGeo = geo.track(new THREE.BoxGeometry(0.11, 0.11, 0.11));
  const dataPoints = [];
  for (let i = 0; i < 6; i += 1) {
    const dot = new THREE.Mesh(analyzeGeo, analyzeMat);
    dot.userData = { phase: i * 0.9, x: -0.55 + (i % 3) * 0.55, z: i < 3 ? -0.25 : 0.25 };
    chamber.add(dot);
    dataPoints.push(dot);
  }

  /* ---- DECIDE: three candidate routes leaving the chamber ---------------
   * Exactly one lights at a time. A decision is only readable as a decision
   * if the alternatives are visible and unlit.
   */
  const routeMats = [emissive(ORANGE, 0.12), emissive(ORANGE, 0.12), emissive(ORANGE, 0.12)];
  const routeGeo = geo.track(new THREE.BoxGeometry(1.9, 0.05, 0.05));
  const routes = [];
  routeMats.forEach((rm, i) => {
    const route = new THREE.Mesh(routeGeo, rm);
    route.position.set(2.45, 0.85 - i * 0.55, 0);
    route.rotation.z = (1 - i) * 0.14;
    root.add(route);
    routes.push(route);
  });

  /* ---- OUTPUT bay ------------------------------------------------------
   * Open like the input, but with a completion plate: things leave here
   * finished, and the plate is where the success state is shown.
   */
  const outputBay = new THREE.Group();
  outputBay.position.x = OUT_X;
  root.add(outputBay);

  const outPlate = new THREE.Mesh(geo.track(new THREE.BoxGeometry(2.3, 0.09, 1.7)), mat.ceramic);
  outPlate.position.y = DECK_Y + 0.2;
  outputBay.add(outPlate);
  // Object3D.add() returns the parent, not the child, so the outline has to be
  // positioned before it is added — chaining off add() moves the wrong node.
  const outPlateEdges = new THREE.LineSegments(
    geo.track(new THREE.EdgesGeometry(outPlate.geometry)),
    mat.ink,
  );
  outPlateEdges.position.y = DECK_Y + 0.2;
  outputBay.add(outPlateEdges);

  const outGlowMat = emissive(SUCCESS, 0);
  const outGlow = new THREE.Mesh(geo.track(new THREE.PlaneGeometry(2.2, 1.6)), outGlowMat);
  outGlow.rotation.x = -Math.PI / 2;
  outGlow.position.y = DECK_Y + 0.26;
  outputBay.add(outGlow);

  /* ---- EXECUTE control -------------------------------------------------
   * A real control on the deck. This is the hand's target: pressing it is
   * what starts the action, which is the cause the hand previously lacked.
   */
  const executeGroup = new THREE.Group();
  executeGroup.position.set(2.4, DECK_Y + 0.17, 1.0);
  root.add(executeGroup);

  const housing = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.3, 0.34, 0.12, seg)), titanium);
  executeGroup.add(housing);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.35,
    roughness: 0.3, metalness: 0.1,
  });
  geo.trackMaterial(buttonMat);
  const button = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.22, 0.22, 0.12, seg)), buttonMat);
  button.position.y = 0.1;
  executeGroup.add(button);
  const buttonRingMat = emissive(ORANGE, 0.2);
  const buttonRing = new THREE.Mesh(
    geo.track(new THREE.RingGeometry(0.34, 0.46, seg)),
    buttonRingMat,
  );
  buttonRing.rotation.x = -Math.PI / 2;
  buttonRing.position.y = -0.05;
  executeGroup.add(buttonRing);

  /* ---- micro labels ----------------------------------------------------- */
  const labelMeshes = [];
  if (labels) {
    const labelGeo = geo.track(new THREE.PlaneGeometry(1.5, 0.38));
    [["INPUT", IN_X], ["PROCESSING", MID_X], ["ACTION", OUT_X]].forEach(([text, x]) => {
      const tex = labelTexture(text);
      geo.trackTexture(tex);
      const lm = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.5, depthWrite: false,
      });
      geo.trackMaterial(lm);
      const mesh = new THREE.Mesh(labelGeo, lm);
      mesh.position.set(x, DECK_Y - 0.42, 1.34);
      root.add(mesh);
      labelMeshes.push(mesh);
    });
  }

  root.scale.setScalar(scale);

  /* ---------------------------------------------------------------------
   * anchors — where work is at each step. The queue and output systems read
   * these rather than hard-coding positions, so moving the machine moves
   * everything that belongs to it.
   * ------------------------------------------------------------------ */
  const anchors = {
    approach: new THREE.Vector3(IN_X - 3.4, DECK_Y + 0.85, 0.1),
    mouth: new THREE.Vector3(IN_X + 0.9, DECK_Y + 0.75, 0),
    centre: new THREE.Vector3(MID_X, 0.35, 0),
    exit: new THREE.Vector3(MID_X + 2.1, 0.1, 0),
    output: new THREE.Vector3(OUT_X, DECK_Y + 0.75, 0),
    away: new THREE.Vector3(OUT_X + 3.6, DECK_Y + 1.5, 0.3),
    execute: new THREE.Vector3(2.4, DECK_Y + 0.32, 1.0),
  };

  /**
   * @param phases { scan, analyze, decide, execute, pressed, done } each 0..1
   */
  function update(elapsed, delta, phases = {}) {
    const scan = phases.scan ?? 0;
    const analyze = phases.analyze ?? 0;
    const decide = phases.decide ?? 0;
    const execute = phases.execute ?? 0;
    const done = phases.done ?? 0;
    const pressed = phases.pressed ?? 0;
    const live = Math.max(scan, analyze, decide, execute);

    // The core itself: slow rotation, breathing pulse. This is the idle
    // signal that the system is alive even when the page is not scrolling.
    inner.rotation.y -= delta * 0.42;
    inner.rotation.x = Math.sin(elapsed * 0.4) * 0.12;
    inner.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.05);
    mid.rotation.y += delta * 0.1;

    // conveyor turns only while work is arriving
    rollers.forEach((roller, i) => {
      roller.rotation.y += delta * (0.5 + scan * 2.4) * (1 + (i % 2) * 0.1);
    });

    // flow pulses travel input -> output, faster as the machine works
    pulses.forEach((pulse) => {
      pulse.userData.t = (pulse.userData.t + delta * (0.1 + live * 0.28)) % 1;
      pulse.position.x = -4.7 + pulse.userData.t * 9.4;
    });
    pulseMat.opacity = 0.25 + live * 0.7;
    channelMat.opacity = 0.24 + live * 0.4;

    // SCAN: bar sweeps the chamber
    scanMat.opacity = scan * 0.7;
    scanBar.position.x = -1.35 + ((elapsed * 0.5) % 1) * 2.7;

    // EXTRACT: points rise off the work and hold
    analyzeMat.opacity = analyze * 0.95;
    dataPoints.forEach((dot) => {
      const rise = (Math.sin(elapsed * 1.4 + dot.userData.phase) * 0.5 + 0.5) * analyze;
      dot.position.set(dot.userData.x, -0.75 + rise * 1.5, dot.userData.z);
      dot.scale.setScalar(0.5 + analyze * 0.8);
    });

    // DECIDE: exactly one route lights. Selection changes slowly enough to
    // read as a decision rather than a flicker.
    const chosen = Math.floor((elapsed * 0.2) % 3);
    routeMats.forEach((rm, i) => {
      const target = i === chosen ? 0.12 + decide * 0.8 : 0.1;
      rm.opacity += (target - rm.opacity) * Math.min(1, delta * 4);
    });

    // EXECUTE: the control lights when armed and depresses when pressed
    buttonMat.emissiveIntensity = 0.3 + execute * 1.6;
    buttonRingMat.opacity = 0.12 + execute * 0.5;
    button.position.y = 0.1 - pressed * 0.06;

    // DONE: the output plate confirms completion
    outGlowMat.opacity = done * 0.2;

    labelMeshes.forEach((m) => { m.material.opacity = 0.26 + live * 0.34; });
  }

  return { root, anchors, update, chamber, inner, coreBox, executeGroup, button, routes };
}
