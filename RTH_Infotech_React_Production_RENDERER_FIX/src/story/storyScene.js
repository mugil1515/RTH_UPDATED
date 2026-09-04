// The standalone RTH automation story scene.
//
// This is NOT the website background. The site's scroll-driven scene stays
// exactly as it is (src/components/effects/ai3d/*); this module builds a second,
// self-contained world whose only job is to explain the automation concept end
// to end, on a fixed clock, with nothing but eight short stage labels.
//
// It reuses the site's visual language directly - the same business-object
// silhouettes and the same baked studio environment - so the video and the live
// page read as one product rather than two.
//
// DETERMINISM
// update(t) is a pure function of t: every motion is derived from the beat
// clock, never from accumulated delta. That is what lets the offline renderer
// step frame by frame and get identical, judder-free output.

import * as THREE from "three";
import { createBusinessObjects } from "@/components/effects/ai3d/businessObjects";
import {
  createStudioEnvironment,
  createContactShadowTexture,
} from "@/components/effects/ai3d/studioEnvironment";
import { getLayout } from "./layout";
import { BEATS, beatsAt, ramp, pulse, clamp01, smoothstep } from "./timeline";

const ORANGE = 0xeb6217;
const EMBER = 0xf7853f;
const CERAMIC = 0xe7e3dc;
const TITANIUM = 0xb9bcc0;
const INK = 0x6b655d;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const _v = new THREE.Vector3();

/* ==========================================================================
 * materials
 * ======================================================================= */
function createMaterials(geo) {
  const m = {};
  const keep = (x) => geo.trackMaterial(x);

  m.glass = keep(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04,
    transmission: 0.93, thickness: 1.2, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
    transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.ceramic = keep(new THREE.MeshPhysicalMaterial({
    color: CERAMIC, metalness: 0.02, roughness: 0.28,
    clearcoat: 0.85, clearcoatRoughness: 0.15, envMapIntensity: 1.1,
  }));
  m.titanium = keep(new THREE.MeshPhysicalMaterial({
    color: TITANIUM, metalness: 0.92, roughness: 0.29,
    clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 1.55,
  }));
  m.core = keep(new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 1.35,
    roughness: 0.3, metalness: 0.05, envMapIntensity: 0.7,
  }));
  m.halo = keep(new THREE.MeshBasicMaterial({
    color: EMBER, transparent: true, opacity: 0.28, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  m.contactShadow = keep(new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  return m;
}

/** A tube along a quadratic bend - used for every path in the scene. */
function curveBetween(from, bend, to) {
  return new THREE.QuadraticBezierCurve3(V(from), V(bend), V(to));
}

/* ==========================================================================
 * robotic hand - same construction as the site's, so the approved concept is
 * preserved exactly: ceramic shell, titanium joints, extended index finger,
 * and a measured fingertip offset so the tip lands ON the button rather than
 * near it.
 * ======================================================================= */
function buildHand(m, geo, segments = 10) {
  const root = new THREE.Group();
  const hand = new THREE.Group();
  root.add(hand);

  const jointGeo = geo.track(new THREE.SphereGeometry(1, segments, segments - 2));
  const bone = (from, to, r0, r1, mat) => {
    const dir = _v.subVectors(to, from);
    const len = dir.length() || 1e-4;
    const mesh = new THREE.Mesh(
      geo.track(new THREE.CylinderGeometry(r1, r0, len, segments, 1)), mat,
    );
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  };
  const joint = (at, r, mat) => {
    const mesh = new THREE.Mesh(jointGeo, mat);
    mesh.scale.setScalar(r);
    mesh.position.copy(at);
    return mesh;
  };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);

  hand.add(bone(P(0, 0, -1.05), P(0, 0, -0.42), 0.19, 0.17, m.ceramic));
  const cuff = new THREE.Mesh(geo.track(new THREE.TorusGeometry(0.17, 0.022, 10, 28)), m.titanium);
  cuff.position.set(0, 0, -0.46);
  hand.add(cuff);
  const palm = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.34, 0.1, 0.4)), m.ceramic);
  palm.position.set(0, 0, -0.16);
  hand.add(palm);
  const palmNode = new THREE.Mesh(
    geo.track(new THREE.SphereGeometry(0.045, 12, 12)),
    geo.trackMaterial(new THREE.MeshBasicMaterial({
      color: ORANGE, transparent: true, opacity: 0.4, depthWrite: false,
    })),
  );
  palmNode.position.set(0, 0.06, -0.14);
  hand.add(palmNode);

  const FINGERS = [
    { x: -0.115, lens: [0.17, 0.12, 0.085], curl: [0.02, 0.05, 0.05], r: [0.042, 0.037, 0.031, 0.024] },
    { x: -0.038, lens: [0.15, 0.115, 0.085], curl: [0.55, 0.75, 0.6], r: [0.04, 0.035, 0.03, 0.023] },
    { x: 0.04, lens: [0.14, 0.108, 0.08], curl: [0.6, 0.8, 0.62], r: [0.038, 0.033, 0.028, 0.022] },
    { x: 0.112, lens: [0.115, 0.09, 0.068], curl: [0.66, 0.85, 0.66], r: [0.034, 0.03, 0.025, 0.02] },
  ];
  const fingers = [];
  const xAxis = P(1, 0, 0);
  const tipAnchor = new THREE.Object3D();

  FINGERS.forEach((f, fi) => {
    const g = new THREE.Group();
    g.position.set(f.x, 0.02, 0.04);
    let p = P(0, 0, 0);
    let dir = P(0, 0.12, 1).normalize();
    f.lens.forEach((len, i) => {
      dir = dir.clone().applyAxisAngle(xAxis, f.curl[i]);
      const next = p.clone().addScaledVector(dir, len);
      g.add(bone(p, next, f.r[i], f.r[i + 1], i === f.lens.length - 1 ? m.titanium : m.ceramic));
      g.add(joint(p, f.r[i] * 1.15, m.titanium));
      p = next;
    });
    g.add(joint(p, f.r[3] * 1.1, m.titanium));
    if (fi === 0) { tipAnchor.position.copy(p); g.add(tipAnchor); }
    g.userData = { amp: fi === 0 ? 0.04 : 0.09, phase: fi * 1.3 };
    fingers.push(g);
    hand.add(g);
  });

  const thumb = new THREE.Group();
  thumb.position.set(-0.17, -0.01, -0.06);
  {
    let p = P(0, 0, 0);
    let dir = P(-0.5, 0.25, 0.6).normalize();
    const lens = [0.12, 0.095];
    const rr = [0.05, 0.04, 0.031];
    [0.3, 0.5].forEach((curl, i) => {
      dir = dir.clone().applyAxisAngle(P(0.3, 0.2, 0.9).normalize(), curl);
      const next = p.clone().addScaledVector(dir, lens[i]);
      thumb.add(bone(p, next, rr[i], rr[i + 1], i === 1 ? m.titanium : m.ceramic));
      thumb.add(joint(p, rr[i] * 1.15, m.titanium));
      p = next;
    });
    thumb.add(joint(p, rr[2] * 1.1, m.titanium));
  }
  thumb.userData = { amp: 0.05, phase: 2.4 };
  fingers.push(thumb);
  hand.add(thumb);

  hand.rotation.set(-0.58, -1.05, -0.16);
  root.scale.setScalar(2.35);
  root.updateMatrixWorld(true);
  const tipOffset = tipAnchor.getWorldPosition(new THREE.Vector3()).sub(root.position);

  return { root, hand, fingers, palmNode, tipOffset, tipAnchor };
}

/* ==========================================================================
 * the scene
 * ======================================================================= */
export function createStoryScene(renderer, { variant = "desktop" } = {}) {
  const L = getLayout(variant);

  const geometries = [];
  const materials = [];
  const textures = [];
  const geo = {
    track: (g) => { geometries.push(g); return g; },
    trackMaterial: (x) => { materials.push(x); return x; },
    trackTexture: (x) => { textures.push(x); return x; },
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfbfaf8);

  const env = createStudioEnvironment(renderer);
  scene.environment = env.texture;

  const m = createMaterials(geo);
  const shadowTex = geo.trackTexture(createContactShadowTexture());
  m.contactShadow.map = shadowTex;

  const objects = createBusinessObjects(geo);

  // Light is mostly the baked studio; these only keep the ceramic from going
  // flat where the environment gives it nothing.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(4, 8, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe4cf, 0.55);
  rim.position.set(-6, 3, -6);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(L.fov, L.width / L.height, 0.1, 200);
  const camTarget = new THREE.Vector3();

  const root = new THREE.Group();
  scene.add(root);

  /* ---- the RTH intelligence core ------------------------------------- */
  const coreGroup = new THREE.Group();
  root.add(coreGroup);

  const chamber = new THREE.Mesh(geo.track(new THREE.IcosahedronGeometry(1.72, 3)), m.glass);
  coreGroup.add(chamber);

  const chamberEdge = new THREE.LineSegments(
    geo.track(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.74, 1))),
    geo.trackMaterial(new THREE.LineBasicMaterial({
      color: INK, transparent: true, opacity: 0.18, depthWrite: false,
    })),
  );
  coreGroup.add(chamberEdge);

  const innerCore = new THREE.Mesh(geo.track(new THREE.OctahedronGeometry(0.62, 1)), m.core);
  coreGroup.add(innerCore);

  const halo = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.95, 24, 18)), m.halo);
  coreGroup.add(halo);

  // Titanium cage: three orbital lips. This is the "premium layered structure"
  // - it also gives the glass something hard to refract.
  const cage = [];
  [[1.95, 0], [2.18, 1.1], [2.05, -0.85]].forEach(([r, tilt], i) => {
    const ring = new THREE.Mesh(
      geo.track(new THREE.TorusGeometry(r, 0.028, 10, 96)), m.titanium,
    );
    ring.rotation.set(Math.PI / 2 + tilt * 0.5, tilt, i * 0.6);
    coreGroup.add(ring);
    cage.push(ring);
  });

  // Visible data input paths: short glass channels feeding the chamber.
  const intakeMat = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.2, depthWrite: false,
  }));
  L.inputs.forEach((cfg) => {
    const curve = curveBetween(cfg.bend, cfg.bend, L.coreEntry);
    const tube = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, 24, 0.018, 6, false)), intakeMat,
    );
    root.add(tube);
  });

  // Deck the core sits on, plus the contact shadow that grounds it.
  const deck = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(3.1, 3.35, 0.16, 64)), m.titanium,
  );
  deck.position.y = variant === "mobile" ? -3.05 : -2.55;
  root.add(deck);
  const deckTop = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(2.95, 2.95, 0.04, 64)), m.ceramic,
  );
  deckTop.position.y = deck.position.y + 0.1;
  root.add(deckTop);

  // Sized to the deck, not the world: a wider blob reads as a second disc
  // floating under the first rather than as the deck's own shadow.
  const shadow = new THREE.Mesh(geo.track(new THREE.PlaneGeometry(7.6, 7.6)), m.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = deck.position.y - 0.09;
  root.add(shadow);

  /* ---- PROCESSING instruments ---------------------------------------- */
  const scanMat = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  }));
  const scanBar = new THREE.Mesh(geo.track(new THREE.RingGeometry(1.0, 1.68, 64)), scanMat);
  scanBar.rotation.x = Math.PI / 2;
  coreGroup.add(scanBar);

  const dotMat = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
  }));
  const dots = [];
  const dotGeo = geo.track(new THREE.SphereGeometry(0.045, 8, 8));
  for (let i = 0; i < 26; i += 1) {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.userData = { a: (i / 26) * Math.PI * 6, r: 0.5 + (i % 5) * 0.16, phase: i * 0.41 };
    coreGroup.add(d);
    dots.push(d);
  }

  /* ---- DECISION routes ------------------------------------------------ */
  const routeIdle = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: 0xc9c5be, transparent: true, opacity: 0, depthWrite: false,
  }));
  const routeStart = L.routeStart;
  const routes = L.routes.map((r, i) => {
    const chosen = i === L.chosenRoute;
    const curve = curveBetween(routeStart, r.bend, r.to);
    const mat = chosen
      ? geo.trackMaterial(new THREE.MeshBasicMaterial({
        color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
      }))
      : routeIdle;
    const tube = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, 48, 0.035, 8, false)), mat,
    );
    root.add(tube);
    // Terminal node: a route has to end somewhere for "one route was chosen"
    // to read as a choice rather than a stray line.
    const node = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.11, 14, 12)), mat);
    node.position.copy(V(r.to));
    root.add(node);
    return { curve, tube, node, mat, chosen };
  });

  // A traveller that runs the chosen route the moment the decision resolves.
  const chosenCurve = routes[L.chosenRoute].curve;
  const routeRider = new THREE.Mesh(
    geo.track(new THREE.SphereGeometry(0.085, 14, 12)),
    geo.trackMaterial(new THREE.MeshBasicMaterial({
      color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
    })),
  );
  root.add(routeRider);

  /* ---- EXECUTE control ------------------------------------------------ */
  const executeGroup = new THREE.Group();
  executeGroup.position.copy(V(L.button));
  root.add(executeGroup);

  const plinth = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 40)), m.titanium,
  );
  executeGroup.add(plinth);
  const buttonMat = geo.trackMaterial(new THREE.MeshStandardMaterial({
    color: 0xf0ece5, emissive: ORANGE, emissiveIntensity: 0.25,
    roughness: 0.3, metalness: 0.04,
  }));
  const button = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(0.3, 0.31, 0.14, 40)), buttonMat,
  );
  button.position.y = 0.1;
  executeGroup.add(button);
  const ringMat = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide,
  }));
  const buttonRing = new THREE.Mesh(geo.track(new THREE.RingGeometry(0.34, 0.42, 48)), ringMat);
  buttonRing.rotation.x = -Math.PI / 2;
  buttonRing.position.y = 0.06;
  executeGroup.add(buttonRing);

  // The activation shockwave the press releases.
  const waveMat = geo.trackMaterial(new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  }));
  const wave = new THREE.Mesh(geo.track(new THREE.RingGeometry(0.4, 0.55, 64)), waveMat);
  wave.rotation.x = -Math.PI / 2;
  wave.position.y = 0.04;
  executeGroup.add(wave);

  const hand = buildHand(m, geo);
  root.add(hand.root);
  hand.root.visible = false;

  /* ---- input objects --------------------------------------------------- */
  const inputs = L.inputs.map((cfg, i) => {
    const item = objects.build(cfg.kind);
    item.group.scale.setScalar(0.001);
    root.add(item.group);
    return {
      ...item,
      curve: curveBetween(cfg.from, cfg.bend, L.coreEntry),
      spin: (i % 2 ? 1 : -1) * 0.22,
    };
  });

  /* ---- executed actions ------------------------------------------------ */
  const actions = L.actions.map((cfg, i) => {
    const holder = new THREE.Group();
    const item = objects.build(cfg.kind);
    holder.add(item.group);
    const tick = objects.build("check");
    tick.group.scale.setScalar(0.001);
    tick.group.position.set(0.44, 0.42, 0.22);
    tick.setState("success", 1);
    holder.add(tick.group);
    holder.scale.setScalar(0.001);
    root.add(holder);
    return { ...item, holder, tick, to: V(cfg.to), delay: i * 0.13 };
  });

  /* ---- connected systems ---------------------------------------------- */
  const linkIdle = geo.trackMaterial(new THREE.LineBasicMaterial({
    color: 0x9c9a95, transparent: true, opacity: 0, depthWrite: false,
  }));
  const modules = L.modules.map((cfg, i) => {
    const item = objects.build(cfg.kind);
    item.group.position.copy(V(cfg.at));
    item.group.scale.setScalar(0.001);
    root.add(item.group);

    const to = V(cfg.at);
    const bend = to.clone().multiplyScalar(0.5);
    bend.z += 0.9;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0), bend, to.clone().multiplyScalar(0.86),
    );
    const line = new THREE.Line(
      geo.track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40))), linkIdle,
    );
    root.add(line);

    const pulseDot = new THREE.Mesh(
      geo.track(new THREE.SphereGeometry(0.075, 12, 10)),
      geo.trackMaterial(new THREE.MeshBasicMaterial({
        color: ORANGE, transparent: true, opacity: 0, depthWrite: false,
      })),
    );
    root.add(pulseDot);

    const tick = objects.build("check");
    tick.setState("success", 1);
    tick.group.scale.setScalar(0.001);
    tick.group.position.copy(to).add(new THREE.Vector3(0.5, 0.5, 0.3));
    root.add(tick.group);

    return { ...item, curve, line, pulseDot, tick, at: to, delay: i * 0.11 };
  });

  /* ======================================================================
   * update
   * =================================================================== */
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tipNow = new THREE.Vector3();
  const buttonV = V(L.button);
  const handFromV = V(L.handFrom);

  function cameraFor(cKey, local) {
    const c = L.camera[cKey];
    return { pos: [c.pos[0], c.pos[1], c.pos[2] + c.dolly * smoothstep(local)], tgt: c.tgt };
  }

  function update(t) {
    const b = beatsAt(t);
    const at = b.at;

    /* ---- camera: settle inside a beat, reframe between beats ---------- */
    const beat = BEATS[b.index];
    const TRANS = 1.1;
    const cur = cameraFor(beat.key, b.local);
    if (b.index > 0 && t - beat.start < TRANS) {
      const from = cameraFor(BEATS[b.index - 1].key, 1);
      const k = smoothstep(clamp01((t - beat.start) / TRANS));
      camPos.set(
        THREE.MathUtils.lerp(from.pos[0], cur.pos[0], k),
        THREE.MathUtils.lerp(from.pos[1], cur.pos[1], k),
        THREE.MathUtils.lerp(from.pos[2], cur.pos[2], k),
      );
      camLook.set(
        THREE.MathUtils.lerp(from.tgt[0], cur.tgt[0], k),
        THREE.MathUtils.lerp(from.tgt[1], cur.tgt[1], k),
        THREE.MathUtils.lerp(from.tgt[2], cur.tgt[2], k),
      );
    } else {
      camPos.set(cur.pos[0], cur.pos[1], cur.pos[2]);
      camLook.set(cur.tgt[0], cur.tgt[1], cur.tgt[2]);
    }
    // Breath, not orbit: enough parallax to feel alive, never enough to
    // disorient. Amplitude is small and slow by design.
    camPos.x += Math.sin(t * 0.21) * 0.16;
    camPos.y += Math.cos(t * 0.17) * 0.1;
    camera.position.copy(camPos);
    camTarget.copy(camLook);
    camera.lookAt(camTarget);

    /* ---- core idle ---------------------------------------------------- */
    const alive = Math.max(at.core, at.process, at.decision, at.execute);
    innerCore.rotation.y = -t * 0.42;
    innerCore.rotation.x = Math.sin(t * 0.4) * 0.12;
    const breathe = 1 + Math.sin(t * 1.7) * 0.05;
    innerCore.scale.setScalar(breathe * (0.6 + 0.4 * ramp(t, 5.6, 8.0) + at.process * 0.12));
    halo.scale.setScalar(breathe * (1 + at.process * 0.1));
    m.halo.opacity = 0.1 + 0.2 * ramp(t, 5.6, 8.4) + at.execute * 0.12;
    m.core.emissiveIntensity = 0.9 + alive * 0.6 + pulse(t, 21.9, 22.2, 23.4, 24.6) * 1.2;
    cage[0].rotation.z = t * 0.12;
    cage[1].rotation.z = -t * 0.09;
    cage[2].rotation.x = Math.PI / 2 + Math.sin(t * 0.2) * 0.1;
    chamberEdge.rotation.y = t * 0.05;

    // The chamber only fully materialises as the story hands data to it.
    coreGroup.scale.setScalar(0.86 + ramp(t, 1.4, 5.4) * 0.14);
    intakeMat.opacity = (0.08 + ramp(t, 1.0, 4.0) * 0.3 + at.process * 0.25)
      * (1 - ramp(t, 15.0, 16.4));

    /* ---- 1. BUSINESS INPUT -------------------------------------------- */
    // Objects appear one at a time, ride their path, and are consumed at the
    // chamber. Consumption (not parking) is what says "the system took it in".
    const finale = ramp(t, 36.6, 38.4);
    inputs.forEach((item, i) => {
      if (finale > 0.02) {
        // COMPLETE: the same business objects return, now circling the core as
        // part of one connected system rather than queueing outside it.
        item.group.visible = true;
        const a = (i / inputs.length) * Math.PI * 2 + t * 0.16;
        const r = (variant === "mobile" ? 3.4 : 4.9) * finale;
        item.group.position.set(
          Math.cos(a) * r,
          Math.sin(a) * r * (variant === "mobile" ? 0.85 : 0.5) + 0.1,
          Math.sin(a) * 1.2 - 0.4,
        );
        item.group.rotation.set(0, a, 0);
        item.group.scale.setScalar((L.inputScale || 1) * 0.85 * finale);
        item.setState("success", 0.05);
        return;
      }
      const enter = ramp(t, 0.5 + i * 0.55, 1.4 + i * 0.55);
      const travel = ramp(t, 1.1 + i * 0.55, 5.3 + i * 0.18);
      const eaten = ramp(t, 5.0 + i * 0.16, 5.9 + i * 0.16);
      const vis = enter * (1 - eaten);
      item.group.visible = vis > 0.01;
      if (!item.group.visible) return;
      item.curve.getPoint(travel, tmp);
      item.group.position.copy(tmp);
      item.group.position.y += Math.sin(t * 0.9 + i) * 0.06 * (1 - travel);
      item.group.rotation.y = Math.sin(t * 0.45 + i) * 0.16;
      item.group.rotation.z = item.spin * 0.12 + Math.sin(t * 0.6 + i) * 0.05;
      item.group.scale.setScalar((L.inputScale || 1) * 1.35 * vis);
      item.setState(travel > 0.72 ? "input" : "neutral", 0.08);
    });

    /* ---- 2. RTH INTELLIGENCE ------------------------------------------
     * Nothing extra fires here: the beat is about the machine receiving, and
     * the chamber growing, the channels lighting and the core spinning up
     * already say that. Adding motion would only compete with it.
     */

    /* ---- 3. PROCESSING ------------------------------------------------- */
    // extract -> analyse -> form a workflow, in that order, visibly.
    const extract = pulse(t, 10.8, 11.8, 13.2, 14.0);
    const analyse = ramp(t, 12.4, 13.8) * (1 - ramp(t, 15.4, 16.4));
    scanMat.opacity = extract * 0.55;
    scanBar.position.y = -1.5 + ((t * 0.55) % 1) * 3.0;
    scanBar.scale.setScalar(0.8 + Math.sin(((t * 0.55) % 1) * Math.PI) * 0.35);
    dotMat.opacity = Math.max(extract, analyse) * 0.9;
    dots.forEach((d, i) => {
      const rise = Math.sin(t * 1.3 + d.userData.phase) * 0.5 + 0.5;
      const a = d.userData.a + t * 0.5;
      const r = d.userData.r * (0.7 + analyse * 0.5);
      d.position.set(Math.cos(a) * r, -0.8 + rise * 1.6 * (0.4 + analyse * 0.9), Math.sin(a) * r);
      d.scale.setScalar(0.6 + analyse * 0.7 + (i % 3) * 0.08);
    });

    /* ---- 4. DECISION ---------------------------------------------------- */
    // All routes appear, the system weighs them, exactly one commits.
    const routesIn = ramp(t, 16.1, 17.2);
    const weighing = pulse(t, 16.6, 17.2, 18.6, 19.2);
    const committed = ramp(t, 19.0, 20.0);
    const routesOut = ramp(t, 25.6, 27.0); // clears before the action lands
    routeIdle.opacity = routesIn * (0.5 - committed * 0.28) * (1 - routesOut);
    routes.forEach((r) => {
      if (!r.chosen) return;
      // The chosen route is dim while it is being evaluated, then locks to
      // full orange: that lock is the moment the decision reads as made.
      const scanning = weighing * (0.25 + 0.25 * (Math.sin(t * 3.2) * 0.5 + 0.5));
      r.mat.opacity = routesIn * Math.max(scanning, committed * 0.92) * (1 - routesOut);
      r.node.scale.setScalar((1 + committed * 0.5) * (1 - routesOut));
    });
    const ride = (t - 19.6) / 1.5;
    routeRider.material.opacity = pulse(t, 19.6, 19.9, 20.7, 21.1);
    if (ride >= 0 && ride <= 1.2) {
      chosenCurve.getPoint(clamp01(ride), tmp);
      routeRider.position.copy(tmp);
    }

    /* ---- 5. EXECUTE ------------------------------------------------------ */
    // ARMED -> hand approaches -> press -> button depresses -> pulse -> action.
    // The order matters: nothing downstream may show progress before the press.
    const armed = ramp(t, 20.2, 21.4);
    const approach = ramp(t, 21.2, 22.6);
    const press = pulse(t, 22.6, 22.85, 23.5, 24.0);
    const leave = ramp(t, 24.6, 26.0);
    const present = armed * (1 - leave);

    buttonMat.emissiveIntensity = 0.2 + armed * 1.4 + press * 1.2;
    ringMat.opacity = 0.1 + armed * 0.4 + press * 0.4;
    button.position.y = 0.1 - press * 0.06;

    waveMat.opacity = pulse(t, 22.8, 23.1, 24.6, 25.6) * 0.5;
    wave.scale.setScalar(1 + ramp(t, 22.8, 25.6) * 7);

    hand.root.visible = present > 0.02;
    if (hand.root.visible) {
      const ease = smoothstep(approach);
      // Aim the measured fingertip at the top face of the button itself, so
      // contact is contact - a hover of even a fifth of a unit reads as a miss.
      tmp.copy(handFromV).lerp(_v.copy(buttonV).add(new THREE.Vector3(0, 0.17, 0)), ease);
      tmp.y += (1 - ease) * 0.9 + (1 - press) * 0.09 * ease;
      // The wrist retreats only after the press. The hand never disappears at
      // the moment of contact - the contact IS the shot.
      tmp.lerp(handFromV, leave * 0.85);
      // Pose first, THEN place. The press flexes the index finger, which moves
      // the fingertip by roughly a button-radius - so a fingertip offset
      // measured once at build time puts the finger beside the control at the
      // exact frame it is supposed to be pressing it. Measuring the tip after
      // posing, every frame, is what makes contact actually land.
      hand.hand.rotation.x = -0.58 - press * 0.1;
      hand.hand.rotation.z = -0.16 + Math.sin(t * 0.5) * 0.03 * (1 - ease);
      hand.fingers.forEach((f, fi) => {
        f.rotation.x = fi === 0
          ? press * 0.34
          : Math.sin(t * 0.8 + f.userData.phase) * f.userData.amp * (1 - ease);
      });
      // Measure with the root at the origin and read the offset out BEFORE
      // assigning: getWorldPosition re-derives the root's matrix from its
      // current position, so measuring inside the assignment would fold the
      // new position back into the offset and cancel it out.
      hand.root.position.set(0, 0, 0);
      hand.root.updateMatrixWorld(true);
      tipNow.copy(hand.tipAnchor.getWorldPosition(_v));
      hand.root.position.copy(tmp).sub(tipNow);
      hand.palmNode.material.opacity = 0.3 + press * 0.6;
    }

    /* ---- 6. AUTOMATED ACTION --------------------------------------------- */
    // Every one of these begins AFTER the press. Real objects first, then the
    // check - so the viewer sees work being produced, not labels appearing.
    actions.forEach((a, i) => {
      const born = ramp(t, 23.2 + a.delay * 2.2, 24.4 + a.delay * 2.2);
      const settle = ramp(t, 23.4 + a.delay * 2.2, 25.6 + a.delay * 2.2);
      const ticked = ramp(t, 26.6 + a.delay * 2.6, 27.6 + a.delay * 2.6);
      const gone = ramp(t, 31.0, 32.2);
      const vis = born * (1 - gone);
      a.holder.visible = vis > 0.01;
      if (!a.holder.visible) return;
      tmp.copy(buttonV).lerp(a.to, smoothstep(settle));
      tmp.y += Math.sin(t * 0.8 + i) * 0.07 * settle;
      a.holder.position.copy(tmp);
      a.holder.rotation.y = Math.sin(t * 0.3 + i) * 0.22;
      a.holder.scale.setScalar((L.actionScale || 1) * vis);
      a.setState(ticked > 0.5 ? "success" : "active", 0.09);
      a.tick.group.scale.setScalar(0.42 * ticked);
    });

    /* ---- 7. SYSTEM UPDATE + 8. COMPLETE ---------------------------------- */
    // Orange travels core -> each system, then a small green confirmation. The
    // green is reserved for completion only, so it never becomes decoration.
    // In COMPLETE the same links keep carrying calm traffic: the closing frame
    // has to read as a system that keeps running, not one that stopped.
    const circulate = ramp(t, 36.6, 38.0);
    linkIdle.opacity = Math.max(ramp(t, 31.5, 33.0) * 0.4, circulate * 0.5);
    modules.forEach((mod, i) => {
      const grow = ramp(t, 31.5 + mod.delay * 1.4, 32.9 + mod.delay * 1.4);
      mod.group.visible = grow > 0.01;
      mod.group.scale.setScalar(L.moduleScale * grow);
      mod.group.rotation.y = Math.sin(t * 0.24 + i) * 0.28;
      mod.group.position.y = mod.at.y + Math.sin(t * 0.7 + i * 1.3) * 0.07;

      const sendAt = 32.6 + mod.delay * 1.6;
      const send = clamp01((t - sendAt) / 1.5);
      mod.pulseDot.material.opacity = pulse(t, sendAt, sendAt + 0.3, sendAt + 1.2, sendAt + 1.6);
      if (send > 0 && send < 1) {
        mod.curve.getPoint(smoothstep(send), tmp);
        mod.pulseDot.position.copy(tmp);
      }
      const done = ramp(t, sendAt + 1.5, sendAt + 2.4);
      mod.setState(done > 0.5 ? "success" : send > 0.05 ? "process" : "neutral", 0.09);
      mod.tick.group.scale.setScalar(0.75 * done * (1 - ramp(t, 39.4, 40.4)));

      if (circulate > 0) {
        const loop = ((t * 0.28) + i * 0.2) % 1;
        mod.curve.getPoint(loop, tmp);
        mod.pulseDot.position.copy(tmp);
        mod.pulseDot.material.opacity = Math.max(mod.pulseDot.material.opacity, circulate * 0.75);
      }
    });
  }

  function dispose() {
    geometries.forEach((g) => g.dispose());
    materials.forEach((x) => x.dispose());
    textures.forEach((x) => x.dispose());
    env.dispose();
  }

  return { scene, camera, update, dispose, layout: L };
}
