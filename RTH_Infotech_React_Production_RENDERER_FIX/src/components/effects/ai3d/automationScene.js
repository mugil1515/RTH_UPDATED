// RTH automation environment — the scroll-driven 3D world behind the site.
//
// SAME CONCEPT AS BEFORE, RAISED IN FIDELITY. The three-stage descent is
// unchanged in structure:
//   Stage A   the orange/white automation core on its layered platform, orbit
//             network, connected business systems
//   Stage B   the processing hub: automatic bill generation and execution
//   Stage C   the business network: industry systems and the finished,
//             connected ecosystem
// a flowing conduit threads A -> B -> C, exactly as it did.
//
// WHAT CHANGED, AND WHY
// The old scene was legible as *motion* but not as *meaning*: glass cards with
// 128px icon textures at 0.66 opacity read as small boxes, the central cube had
// no input or output, the robotic hand never touched anything, and the billing
// beat was five sheets sliding down a curve. A viewer could see that something
// was happening and could not tell what.
//
// So every element now states a business fact:
//   * the central core is a machine with an INPUT bay, a PROCESSING chamber
//     and an OUTPUT bay, and work visibly crosses it left to right
//   * modules are recognizable objects (invoice, envelope, database, chart,
//     customer record) built to be identifiable from their silhouette alone
//   * every object carries a state colour: idle / input / processing / active
//     / complete, so progress is readable at a glance
//   * each section runs ONE sequence with a cause and a result, rather than
//     several decorative loops at once
//
// This module owns NOTHING outside its own group: no renderer, camera, clock,
// ScrollTrigger, Lenis hook or render loop. ThreeBackground stays the single
// owner of all of that and simply calls update(...).
//
// Performance notes:
//   * true `transmission` forces an extra render pass, so only the two hero
//     chambers use it; everything else is opaque ceramic or cheap frosted glass
//   * geometry and materials are shared across instances wherever possible,
//     and business objects come from one cached factory
//   * whole stages are switched off when their sections are nowhere near the
//     viewport, so roughly a third of the scene is drawn at any time

import * as THREE from "three";
import { createContactShadowTexture } from "@/components/effects/ai3d/studioEnvironment";
import { createBusinessObjects } from "@/components/effects/ai3d/businessObjects";
import { createAutomationCore } from "@/components/effects/ai3d/automationEngine";
import { createBillingLine } from "@/components/effects/ai3d/billingLine";
import { createActionSequence } from "@/components/effects/ai3d/actionSequence";
import { createManualFlow } from "@/components/effects/ai3d/manualFlow";

/* ---------------------------------------------------------------------------
 * palette — light theme, RTH orange (#EB6217) as the only accent
 * ------------------------------------------------------------------------ */
const ORANGE = 0xeb6217;
const EMBER = 0xf7853f;
const CERAMIC = 0xdedad3;
const TITANIUM = 0xbfbdb8;
const LIGHT_GRAY = 0xc7c3bb;
// Lifted well above the old 0xb9b7b3: tracks at that value simply vanished
// into the page, which is most of why the scene read as "faint".
const TRACK_GRAY = 0x928e88;
const INK = 0x6b655d;

/* stage centres, in world units, descending. Spaced wider than before because
 * every stage now holds a real machine rather than a small tableau. */
export const STAGE_A_Y = 0;
export const STAGE_B_Y = -12;
export const STAGE_C_Y = -24;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
};
/** ramp(x, a, b) -> 0 before a, 1 after b, smooth between. */
const ramp = (x, a, b) => smoothstep((x - a) / (b - a || 1));

const _v = new THREE.Vector3();

// Per-section character, blended by ThreeBackground and passed into update().
//   energy — how lit and active the cores/accents are
//   spread — how far the modules sit out (tight core vs. wide network)
//   calm   — damps every idle motion, for the "trust" sections
//   veil   — how far the fine supporting detail is pulled back so that body
//            copy over the canvas always wins (brief §22)
export const DEFAULT_MOOD = { energy: 1, spread: 1, calm: 0, veil: 0, still: 0 };

// Kept for the storyboard's connective beats (data conduit, intake flow).
// The storytelling itself is driven by per-section weights, which is what
// makes "one sequence at a time" possible.
export const BEAT_KEYS = ["intake", "nodes", "hand", "stream", "docs", "hub", "network"];

export const SECTION_KEYS = [
  "hero", "problems", "services", "billing",
  "agent", "industries", "analyzer", "company", "contact",
];
export const DEFAULT_SECTIONS = SECTION_KEYS.reduce((acc, k) => {
  acc[k] = k === "hero" ? 1 : 0;
  return acc;
}, {});

/* ---------------------------------------------------------------------------
 * The business systems around the Stage A core — "RTH core powers all
 * services". Deliberately placed to the sides and rear so they occupy the
 * screen edges rather than sitting behind the headline.
 * ------------------------------------------------------------------------ */
const SERVICE_MODULES = [
  { kind: "cloud", angle: -1.60, y: 2.4 },
  { kind: "security", angle: -2.10, y: 3.4 },
  { kind: "analytics", angle: -2.60, y: 2.0 },
  { kind: "database", angle: 1.60, y: 2.4 },
  { kind: "automation", angle: 2.10, y: 3.4 },
  { kind: "message", angle: 2.60, y: 2.0 },
];

/* ---------------------------------------------------------------------------
 * Industry configurations. The core never changes; only the modules around it
 * do. That contrast is the whole message of "systems that fit how you work",
 * so the sets are chosen to look visibly different from one another.
 *
 * Keys are the ids in src/data/industries.js.
 * ------------------------------------------------------------------------ */
const INDUSTRY_POOL = [
  "invoice", "inventory", "customer", "analytics", "message",
  "database", "calendar", "document", "property", "approval",
];
const INDUSTRY_SETS = {
  retail: ["invoice", "inventory", "customer", "message", "analytics", "database"],
  realestate: ["property", "customer", "document", "calendar", "message", "analytics"],
  finance: ["invoice", "approval", "analytics", "database", "document", "customer"],
  healthcare: ["customer", "calendar", "document", "approval", "database", "message"],
  education: ["customer", "calendar", "analytics", "document", "invoice", "message"],
  manufacturing: ["inventory", "approval", "analytics", "invoice", "calendar", "database"],
};
const INDUSTRY_ORDER = Object.keys(INDUSTRY_SETS);

/* The automation pipeline the analyzer section describes, as objects. */
const PIPELINE_STEPS = ["customer", "approval", "percent", "invoice", "envelope", "database"];

/* ---------------------------------------------------------------------------
 * shared material set
 * ------------------------------------------------------------------------ */
function createMaterials({ cheapGlass = false } = {}) {
  const m = {};

  // Every physical material below reads `scene.environment` (the baked studio
  // in studioEnvironment.js). envMapIntensity is therefore the main dial for
  // how present a surface feels: past ~1.7 the whites bloom out against the
  // page, below ~0.8 the forms go flat again.

  // --- hero glass -------------------------------------------------------
  // Real glass lets *transmission* drive its transparency. Opacity stays at 1
  // so the specular highlights and refraction that make glass read as glass
  // are not blended away into a faint ghost.
  m.heroGlass = cheapGlass
    ? new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.13,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.35,
      transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.03,
      transmission: 0.94, thickness: 1.3, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
      transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
    });

  m.heroGlassWarm = cheapGlass
    ? new THREE.MeshPhysicalMaterial({
      color: 0xffdcc4, metalness: 0, roughness: 0.16,
      clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2,
      transparent: true, opacity: 0.46, depthWrite: false, side: THREE.DoubleSide,
    })
    : new THREE.MeshPhysicalMaterial({
      color: 0xffd9bd, metalness: 0, roughness: 0.06,
      transmission: 0.88, thickness: 0.9, ior: 1.48,
      clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.45,
      transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
    });

  // --- opaque structure -------------------------------------------------
  // These carry the silhouettes, so they are the only fully opaque surfaces.
  m.ceramic = new THREE.MeshPhysicalMaterial({
    color: CERAMIC, metalness: 0.02, roughness: 0.28,
    clearcoat: 0.85, clearcoatRoughness: 0.15, envMapIntensity: 1.1,
  });
  m.ceramicSoft = new THREE.MeshPhysicalMaterial({
    color: LIGHT_GRAY, metalness: 0.02, roughness: 0.54, envMapIntensity: 0.85,
  });
  m.titanium = new THREE.MeshPhysicalMaterial({
    color: TITANIUM, metalness: 0.92, roughness: 0.29,
    clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 1.55,
  });

  // --- emissive cores ---------------------------------------------------
  m.core = new THREE.MeshStandardMaterial({
    color: ORANGE, emissive: ORANGE, emissiveIntensity: 1.35,
    roughness: 0.28, metalness: 0.05, envMapIntensity: 0.7,
  });
  m.coreHalo = new THREE.MeshBasicMaterial({
    color: EMBER, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  });
  m.glowRing = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide,
  });

  // --- lines, tracks, conduits ------------------------------------------
  // The ink line is the single most valuable material in the scene: on a white
  // page it is what gives every white object a readable edge.
  m.ink = new THREE.LineBasicMaterial({
    color: INK, transparent: true, opacity: 0.9, depthWrite: false,
  });
  m.track = new THREE.MeshBasicMaterial({
    color: TRACK_GRAY, transparent: true, opacity: 0.62, depthWrite: false,
  });
  m.trackActive = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.75, depthWrite: false,
  });
  m.thread = new THREE.LineBasicMaterial({
    color: 0x9c9a95, transparent: true, opacity: 0.55, depthWrite: false,
  });
  m.threadWarm = new THREE.LineBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.62, depthWrite: false,
  });

  m.nodeWarm = new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.95, depthWrite: false });
  m.nodePale = new THREE.MeshBasicMaterial({ color: 0x8e8c88, transparent: true, opacity: 0.8, depthWrite: false });
  m.nodeDone = new THREE.MeshBasicMaterial({ color: 0x3f9169, transparent: true, opacity: 0.9, depthWrite: false });

  // --- the A -> B -> C data conduit -------------------------------------
  m.ribbon = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4,
    transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
  });
  m.ribbonCore = new THREE.MeshBasicMaterial({
    color: ORANGE, transparent: true, opacity: 0.55, depthWrite: false,
  });

  // --- grounding --------------------------------------------------------
  // Soft contact shadow blobs. Nothing else in the scene tells the eye that
  // these objects sit in space rather than float in a void.
  m.contactShadow = new THREE.MeshBasicMaterial({
    map: null, transparent: true, opacity: 0.95,
    depthWrite: false, side: THREE.DoubleSide,
  });

  return m;
}

/* ---------------------------------------------------------------------------
 * layered platform — concentric discs, illuminated ring, contact shadow
 * ------------------------------------------------------------------------ */
function buildPlatform(mat, geo, { radius = 5.6, tiers = 3, seg = 64 } = {}) {
  const group = new THREE.Group();
  const rings = [];

  for (let i = 0; i < tiers; i += 1) {
    const r = radius * (1 - i * 0.17);
    const h = 0.2 - i * 0.02;
    const g = geo.track(new THREE.CylinderGeometry(r, r * 0.985, h, seg, 1));
    const disc = new THREE.Mesh(g, i === tiers - 1 ? mat.ceramic : mat.ceramicSoft);
    disc.position.y = -0.34 - i * 0.3;
    group.add(disc);

    // thin outer lip, alternating spin direction
    const lip = new THREE.Mesh(
      geo.track(new THREE.TorusGeometry(r * 1.01, 0.022, 6, seg)),
      mat.titanium,
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = disc.position.y + h / 2;
    lip.userData.dir = i % 2 ? -1 : 1;
    rings.push(lip);
    group.add(lip);
  }

  // Soft contact shadow. This is what stops the stack reading as cut-out
  // shapes hovering in a void — the eye needs an occlusion cue to place an
  // object on a surface, and there is no other grounding in the scene.
  const shadow = new THREE.Mesh(
    geo.track(new THREE.PlaneGeometry(radius * 3.2, radius * 3.2)),
    mat.contactShadow,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.42 - tiers * 0.3;
  group.add(shadow);

  // illuminated ring directly under the core
  const glow = new THREE.Mesh(
    geo.track(new THREE.RingGeometry(radius * 0.3, radius * 0.52, seg)),
    mat.glowRing,
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.22;
  group.add(glow);

  return { group, rings, glow };
}

/* ---------------------------------------------------------------------------
 * orbit network — tube tracks with nodes travelling along them.
 * Kept from the original composition, but reduced in count and thickened, so
 * it supports the machine instead of competing with it (brief §19/§20).
 * ------------------------------------------------------------------------ */
function buildOrbitNetwork(mat, geo, { count, radius, y = 0, tubular = 96 }) {
  const group = new THREE.Group();
  const tracks = [];
  const nodes = [];
  const nodeGeo = geo.track(new THREE.SphereGeometry(0.08, 8, 8));

  for (let i = 0; i < count; i += 1) {
    const r = radius * (0.78 + (i / count) * 0.5);
    const tilt = (i % 2 ? 1 : -1) * (0.14 + (i / count) * 0.42);
    const yaw = (i / count) * Math.PI;

    const pts = [];
    for (let s = 0; s <= 72; s += 1) {
      const a = (s / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 0.16, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.3);
    const tube = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, tubular, 0.017, 5, true)),
      mat.track,
    );
    tube.rotation.set(tilt, yaw, 0);
    group.add(tube);
    tracks.push(tube);

    const node = new THREE.Mesh(nodeGeo, i % 2 ? mat.nodePale : mat.nodeWarm);
    node.userData = { curve, t: i * 0.19, speed: 0.035 + (i % 4) * 0.012 };
    tube.add(node);
    nodes.push(node);
  }

  group.position.y = y;
  return { group, tracks, nodes };
}

/* ---------------------------------------------------------------------------
 * connected business systems — an object, a rail into the core, and a signal
 * that travels it. The rail is the claim "RTH connects this system"; the
 * signal is the proof that the link is live.
 * ------------------------------------------------------------------------ */
function buildSystemArc(objects, mat, geo, specs, { radius, tubular, to = new THREE.Vector3() }) {
  const group = new THREE.Group();
  const items = [];
  const signalGeo = geo.track(new THREE.SphereGeometry(0.085, 8, 8));

  specs.forEach((spec, i) => {
    const base = new THREE.Vector3(
      Math.sin(spec.angle) * radius,
      spec.y,
      Math.cos(spec.angle) * radius,
    );

    const item = objects.build(spec.kind);
    item.group.position.copy(base);
    item.group.scale.setScalar(2.4);
    group.add(item.group);

    // Rail from the system down into the core, bowed so it reads as a route
    // rather than as a wire.
    const midPoint = base.clone().multiplyScalar(0.5).add(to.clone().multiplyScalar(0.5));
    midPoint.y -= 0.6;
    const curve = new THREE.CatmullRomCurve3([base.clone(), midPoint, to.clone()], false, "catmullrom", 0.4);
    const rail = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, Math.round(tubular * 0.4), 0.018, 5, false)),
      mat.track,
    );
    group.add(rail);

    const signal = new THREE.Mesh(signalGeo, mat.nodeWarm);
    group.add(signal);

    items.push({ item, base, curve, rail, signal, phase: i * 0.77, index: i });
  });

  return { group, items };
}

/* ---------------------------------------------------------------------------
 * data particles — decoration only, and treated as such: sparse, small and
 * faint, so they never compete with the objects that carry meaning.
 * ------------------------------------------------------------------------ */
function buildParticles(geo, count, curves, spreadY) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const riders = [];
  const warm = new THREE.Color(ORANGE);
  const pale = new THREE.Color(0xb8b4ae);

  for (let i = 0; i < count; i += 1) {
    const onCurve = curves.length && i % 3 !== 2;
    const c = i % 4 === 0 ? warm : pale;
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    if (onCurve) {
      riders.push({ i, curve: curves[i % curves.length], t: Math.random(), speed: 0.02 + Math.random() * 0.05 });
    } else {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = spreadY[0] + Math.random() * (spreadY[1] - spreadY[0]);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      riders.push(null);
    }
  }

  const g = geo.track(new THREE.BufferGeometry());
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.045, vertexColors: true, transparent: true, opacity: 0.4,
    depthWrite: false, sizeAttenuation: true,
  });
  geo.trackMaterial(mat);
  const points = new THREE.Points(g, mat);
  return { points, riders, positions, attr: g.attributes.position };
}

/* ---------------------------------------------------------------------------
 * robotic hand — white ceramic shell, titanium joints, orange inner light.
 * Each finger is its own group so it can actually flex. Unchanged in build
 * from the original; what changed is that it now has somewhere to go and
 * something to do when it gets there.
 * ------------------------------------------------------------------------ */
function buildRoboticHand(mat, geo, { segments }) {
  const root = new THREE.Group();
  const hand = new THREE.Group();
  root.add(hand);

  const jointGeo = geo.track(new THREE.SphereGeometry(1, segments, Math.max(4, segments - 2)));

  // Real tapered segments: a shared unit cylinder can't taper under scale, and
  // the taper is most of what makes a finger read as a finger.
  const bone = (from, to, r0, r1, material) => {
    const dir = _v.subVectors(to, from);
    const len = dir.length() || 1e-4;
    const mesh = new THREE.Mesh(
      geo.track(new THREE.CylinderGeometry(r1, r0, len, segments, 1)),
      material,
    );
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  };
  const joint = (at, r, material) => {
    const mesh = new THREE.Mesh(jointGeo, material);
    mesh.scale.setScalar(r);
    mesh.position.copy(at);
    return mesh;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // forearm + palm
  hand.add(bone(V(0, 0, -1.5), V(0, 0, -0.42), 0.15, 0.15, mat.ceramic));
  const cuff = new THREE.Mesh(geo.track(new THREE.TorusGeometry(0.17, 0.022, 8, 24)), mat.titanium);
  cuff.position.set(0, 0, -0.46);
  hand.add(cuff);

  const palm = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.34, 0.1, 0.4)), mat.ceramic);
  palm.position.set(0, 0, -0.16);
  hand.add(palm);
  const palmNode = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.045, 10, 10)), mat.nodeWarm);
  palmNode.position.set(0, 0.06, -0.14);
  hand.add(palmNode);

  // fingers: index is extended (the pressing digit), the rest are curled
  const FINGERS = [
    { x: -0.115, lens: [0.17, 0.12, 0.085], curl: [0.02, 0.05, 0.05], r: [0.042, 0.037, 0.031, 0.024] },
    { x: -0.038, lens: [0.15, 0.115, 0.085], curl: [0.55, 0.75, 0.6], r: [0.04, 0.035, 0.03, 0.023] },
    { x: 0.04, lens: [0.14, 0.108, 0.08], curl: [0.6, 0.8, 0.62], r: [0.038, 0.033, 0.028, 0.022] },
    { x: 0.112, lens: [0.115, 0.09, 0.068], curl: [0.66, 0.85, 0.66], r: [0.034, 0.03, 0.025, 0.02] },
  ];
  const fingers = [];
  const xAxis = V(1, 0, 0);
  // Marks the index fingertip. The hand is positioned by putting THIS point on
  // the control it presses, rather than by hand-tuning root offsets: the wrist
  // pose, the finger lengths and the root scale all feed into where the tip
  // actually ends up, and guessing that offset is how the hand ends up hovering
  // two units above the button it is supposed to be pressing.
  const tipAnchor = new THREE.Object3D();

  FINGERS.forEach((f, fi) => {
    const g = new THREE.Group();
    g.position.set(f.x, 0.02, 0.04);
    let p = V(0, 0, 0);
    let dir = V(0, 0.12, 1).normalize();
    f.lens.forEach((len, i) => {
      dir = dir.clone().applyAxisAngle(xAxis, f.curl[i]);
      const next = p.clone().addScaledVector(dir, len);
      g.add(bone(p, next, f.r[i], f.r[i + 1], i === f.lens.length - 1 ? mat.titanium : mat.ceramic));
      g.add(joint(p, f.r[i] * 1.15, mat.titanium));
      p = next;
    });
    g.add(joint(p, f.r[3] * 1.1, mat.titanium));
    if (fi === 0) {
      tipAnchor.position.copy(p);
      g.add(tipAnchor);
    }
    g.userData = { rest: 0, amp: fi === 0 ? 0.04 : 0.09, phase: fi * 1.3 };
    fingers.push(g);
    hand.add(g);
  });

  // thumb
  const thumb = new THREE.Group();
  thumb.position.set(-0.17, -0.01, -0.06);
  {
    let p = V(0, 0, 0);
    let dir = V(-0.5, 0.25, 0.6).normalize();
    const lens = [0.12, 0.095];
    const rr = [0.05, 0.04, 0.031];
    [0.3, 0.5].forEach((curl, i) => {
      dir = dir.clone().applyAxisAngle(V(0.3, 0.2, 0.9).normalize(), curl);
      const next = p.clone().addScaledVector(dir, lens[i]);
      thumb.add(bone(p, next, rr[i], rr[i + 1], i === 1 ? mat.titanium : mat.ceramic));
      thumb.add(joint(p, rr[i] * 1.15, mat.titanium));
      p = next;
    });
    thumb.add(joint(p, rr[2] * 1.1, mat.titanium));
  }
  thumb.userData = { rest: 0, amp: 0.05, phase: 2.4 };
  fingers.push(thumb);
  hand.add(thumb);

  // Enters from the right and slightly in front, index finger angled down-left
  // onto the control. Kept forward of the hub so the forearm never crosses it.
  hand.rotation.set(-0.62, -1.38, -0.16);
  root.scale.setScalar(1.9);

  // Where the fingertip sits relative to the root, in root-parent space, for
  // the current pose. Measured once rather than assumed.
  root.updateMatrixWorld(true);
  const tipOffset = tipAnchor.getWorldPosition(new THREE.Vector3()).sub(root.position);

  return { root, hand, fingers, palmNode, tipOffset };
}

/* ---------------------------------------------------------------------------
 * flowing data path — wide glass ribbon + emissive filament + travellers
 * ------------------------------------------------------------------------ */
function buildRibbon(mat, geo, points, { tubular, radius = 0.32 }) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);

  const shell = new THREE.Mesh(
    geo.track(new THREE.TubeGeometry(curve, tubular, radius, 12, false)),
    mat.ribbon,
  );
  group.add(shell);

  const filament = new THREE.Mesh(
    geo.track(new THREE.TubeGeometry(curve, tubular, 0.03, 6, false)),
    mat.ribbonCore,
  );
  group.add(filament);

  const travellers = [];
  const tGeo = geo.track(new THREE.SphereGeometry(0.08, 8, 8));
  for (let i = 0; i < 7; i += 1) {
    const s = new THREE.Mesh(tGeo, i % 2 ? mat.nodeWarm : mat.nodePale);
    s.userData = { t: i / 7, speed: 0.05 + (i % 3) * 0.012 };
    travellers.push(s);
    group.add(s);
  }

  return { group, curve, shell, filament, travellers };
}

/* ---------------------------------------------------------------------------
 * intake funnel — "business data arrives", the opening beat of the narrative.
 * Retargeted from the old version: the feeds now converge on the INPUT bay of
 * the machine rather than on the middle of the core, so the direction of the
 * whole page is established before the first scroll.
 * ------------------------------------------------------------------------ */
function buildIntake(mat, geo, { count, tubular, to }) {
  const group = new THREE.Group();
  const packets = [];
  const packetGeo = geo.track(new THREE.SphereGeometry(0.07, 8, 8));
  const capGeo = geo.track(new THREE.BoxGeometry(0.34, 0.34, 0.34));
  const capEdgeGeo = geo.track(new THREE.EdgesGeometry(capGeo));
  const radius = 4.6;

  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 1.1 + 2.5;
    const start = new THREE.Vector3(
      to.x + Math.cos(a) * radius * 0.5,
      to.y + 4.2,
      Math.sin(a) * radius,
    );
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().lerp(to, 0.42).add(new THREE.Vector3(0, 0.8, 0)),
      start.clone().lerp(to, 0.78).add(new THREE.Vector3(0, 0.25, 0)),
      to.clone(),
    ], false, "catmullrom", 0.42);

    group.add(new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, tubular, 0.014, 5, false)),
      mat.track,
    ));

    // A small glass source block at the mouth of each feed: the business data
    // being drawn in, given a physical origin.
    const cap = new THREE.Mesh(capGeo, mat.ceramic);
    cap.position.copy(start);
    cap.rotation.set(0.4, a, 0.2);
    group.add(cap);
    // Object3D.add() returns the parent, not the child, so the outline has to
    // be positioned before it is added.
    const capEdges = new THREE.LineSegments(capEdgeGeo, mat.ink);
    capEdges.position.copy(cap.position);
    capEdges.rotation.copy(cap.rotation);
    group.add(capEdges);

    for (let n = 0; n < 2; n += 1) {
      const packet = new THREE.Mesh(packetGeo, n ? mat.nodePale : mat.nodeWarm);
      packet.userData = { curve, t: (i / count + n * 0.5) % 1, speed: 0.1 + (i % 3) * 0.018 };
      group.add(packet);
      packets.push(packet);
    }
  }

  return { group, packets };
}

/* ---------------------------------------------------------------------------
 * the automation pipeline of the analyzer section — a described process,
 * assembled into a chain of steps in front of the viewer.
 * ------------------------------------------------------------------------ */
function buildPipeline(objects, mat, geo, { steps, y, z, span = 11 }) {
  const group = new THREE.Group();
  const kinds = PIPELINE_STEPS.slice(0, steps);
  const nodes = kinds.map((kind, i) => {
    const x = -span / 2 + (span / (kinds.length - 1)) * i;
    const item = objects.build(kind);
    item.group.position.set(x, y, z);
    item.group.scale.setScalar(0.001);
    group.add(item.group);
    return { item, x, index: i };
  });

  // Connectors between consecutive steps, revealed with the step they lead to.
  const linkGeo = geo.track(new THREE.BoxGeometry(1, 0.05, 0.05));
  const links = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const link = new THREE.Mesh(linkGeo, mat.track);
    const gap = nodes[i + 1].x - nodes[i].x;
    link.position.set(nodes[i].x + gap / 2, y, z);
    link.scale.x = gap * 0.62;
    link.userData.fullX = link.scale.x;
    group.add(link);
    links.push(link);
  }

  return { group, nodes, links };
}

/* ---------------------------------------------------------------------------
 * assembly
 * ------------------------------------------------------------------------ */
export function createAutomationScene({ mobile = false, tablet = false } = {}) {
  // One place to size the whole scene down. Mobile keeps every storytelling
  // element and drops only supporting detail, per brief §23.
  const tier = mobile
    ? {
      services: 4, orbits: 1, particles: 10, seg: 24, tubular: 40,
      hand: false, intake: 3, manual: 3, queue: 3, outputs: 3,
      billing: 5, pipeline: 5, customers: 2, labels: false, industry: 4,
    }
    : tablet
      ? {
        services: 5, orbits: 3, particles: 40, seg: 36, tubular: 72,
        hand: true, intake: 4, manual: 4, queue: 4, outputs: 4,
        billing: 6, pipeline: 6, customers: 3, labels: true, industry: 6,
      }
      : {
        services: 6, orbits: 4, particles: 70, seg: 56, tubular: 104,
        hand: true, intake: 4, manual: 5, queue: 5, outputs: 5,
        billing: 6, pipeline: 6, customers: 3, labels: true, industry: 6,
      };

  // disposal bookkeeping
  const geometries = [];
  const materialsExtra = [];
  const textures = [];
  const geo = {
    track: (g) => { geometries.push(g); return g; },
    trackMaterial: (m) => { materialsExtra.push(m); return m; },
    trackTexture: (t) => { textures.push(t); return t; },
  };
  const mat = createMaterials({ cheapGlass: mobile });
  const shadowTexture = createContactShadowTexture();
  geo.trackTexture(shadowTexture);
  mat.contactShadow.map = shadowTexture;

  const objects = createBusinessObjects(geo);
  const root = new THREE.Group();

  /* ======================================================================
   * Stage A — the RTH Automation Core
   * =================================================================== */
  const stageA = new THREE.Group();
  stageA.position.y = STAGE_A_Y;
  root.add(stageA);

  const platformA = buildPlatform(mat, geo, { radius: 6.4, tiers: 3, seg: tier.seg });
  platformA.group.position.y = -2.1;
  stageA.add(platformA.group);

  const core = createAutomationCore(mat, geo, { seg: tier.seg, labels: tier.labels });
  stageA.add(core.root);

  const orbitA = buildOrbitNetwork(mat, geo, {
    count: tier.orbits, radius: 6.0, y: 0.2, tubular: tier.tubular,
  });
  stageA.add(orbitA.group);

  const systems = buildSystemArc(objects, mat, geo, SERVICE_MODULES.slice(0, tier.services), {
    radius: 6.9, tubular: tier.tubular, to: core.anchors.centre.clone(),
  });
  stageA.add(systems.group);

  const intake = buildIntake(mat, geo, {
    count: tier.intake, tubular: tier.tubular, to: core.anchors.approach.clone(),
  });
  stageA.add(intake.group);

  /* ---- work arriving on the conveyor ------------------------------------
   * Real, named work: invoices, orders, documents, customer records. They ride
   * in from the left, get read inside the chamber, and are consumed there —
   * transformed, not merely relocated.
   */
  const QUEUE_KINDS = ["invoice", "order", "document", "customer", "spreadsheet"];
  const queue = [];
  for (let i = 0; i < tier.queue; i += 1) {
    const item = objects.build(QUEUE_KINDS[i % QUEUE_KINDS.length]);
    item.group.scale.setScalar(0.001);
    stageA.add(item.group);
    queue.push({ ...item, t: i / tier.queue });
  }

  /* ---- finished work leaving --------------------------------------------
   * Each carries a checkmark. The check is what turns "an object moved" into
   * "a job finished", which is the entire difference between this and the
   * previous drifting-cards version.
   */
  const OUTPUT_KINDS = ["invoice", "envelope", "message", "database", "calendar"];
  const outputs = [];
  for (let i = 0; i < tier.outputs; i += 1) {
    const holder = new THREE.Group();
    const item = objects.build(OUTPUT_KINDS[i % OUTPUT_KINDS.length]);
    holder.add(item.group);
    const tick = objects.build("check");
    tick.group.scale.setScalar(0.001);
    tick.group.position.set(0.34, 0.34, 0.16);
    tick.setState("success", 1);
    holder.add(tick.group);
    stageA.add(holder);
    outputs.push({ holder, item, tick, t: i / tier.outputs, lane: i });
  }

  const manual = createManualFlow(objects, mat, geo, {
    lanes: tier.manual, tubular: Math.round(tier.tubular * 0.6),
    target: core.anchors.approach.clone(),
  });
  stageA.add(manual.root);

  /* ======================================================================
   * Stage B — processing hub: bill generation and execution
   * =================================================================== */
  const stageB = new THREE.Group();
  stageB.position.y = STAGE_B_Y;
  root.add(stageB);

  const platformB = buildPlatform(mat, geo, { radius: 6.0, tiers: 3, seg: tier.seg });
  platformB.group.position.y = -2.3;
  stageB.add(platformB.group);

  // The reference composition's middle "reactor".
  //
  // A transmissive cylinder wrapped around an emissive one has no hard edge
  // anywhere: it refracts the page behind it and blurs its own core, so at
  // background scale it resolves to an orange smudge rather than a machine.
  // The collars, base and rim outlines below are what give it a silhouette —
  // the same thing the corner posts do for the Stage A chamber.
  const hubGlass = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(1.15, 1.15, 1.9, tier.seg, 1, true)),
    mat.heroGlass,
  );
  hubGlass.position.y = -0.2;
  stageB.add(hubGlass);

  const collarGeo = geo.track(new THREE.TorusGeometry(1.16, 0.055, 8, tier.seg));
  [0.75, -1.15].forEach((y) => {
    const collar = new THREE.Mesh(collarGeo, mat.titanium);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    stageB.add(collar);
  });
  // Four uprights, so the glass reads as contained rather than as vapour.
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(geo.track(new THREE.BoxGeometry(0.075, 1.95, 0.075)), mat.titanium);
    post.position.set(Math.cos(a) * 1.16, -0.2, Math.sin(a) * 1.16);
    stageB.add(post);
  }

  const hubCap = new THREE.Mesh(
    geo.track(new THREE.SphereGeometry(1.15, tier.seg, 16, 0, Math.PI * 2, 0, Math.PI / 2)),
    mat.heroGlass,
  );
  hubCap.position.y = 0.75;
  stageB.add(hubCap);
  const hubCore = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 20)), mat.core);
  hubCore.position.y = -0.3;
  stageB.add(hubCore);
  const hubHalo = new THREE.Mesh(
    geo.track(new THREE.CylinderGeometry(0.72, 0.72, 1.45, 20, 1, true)),
    mat.coreHalo,
  );
  hubHalo.position.y = -0.28;
  stageB.add(hubHalo);
  const hubBase = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(1.45, 1.62, 0.3, tier.seg)), mat.titanium);
  hubBase.position.y = -1.34;
  stageB.add(hubBase);
  const hubBaseEdges = new THREE.LineSegments(
    geo.track(new THREE.EdgesGeometry(hubBase.geometry)),
    mat.ink,
  );
  hubBaseEdges.position.y = -1.34;
  stageB.add(hubBaseEdges);

  const orbitB = buildOrbitNetwork(mat, geo, {
    count: Math.max(2, tier.orbits - 1), radius: 5.8, y: -0.4, tubular: tier.tubular,
  });
  stageB.add(orbitB.group);

  const billing = createBillingLine(objects, mat, geo, { seg: tier.seg, count: tier.billing });
  stageB.add(billing.root);

  const action = createActionSequence(objects, mat, geo, { seg: tier.seg, customers: tier.customers });
  stageB.add(action.root);

  let hand = null;
  if (tier.hand) {
    hand = buildRoboticHand(mat, geo, { segments: mobile ? 5 : 8 });
    stageB.add(hand.root);
  }

  /* ======================================================================
   * Stage C — industry systems and the finished connected ecosystem
   * =================================================================== */
  const stageC = new THREE.Group();
  stageC.position.y = STAGE_C_Y;
  root.add(stageC);

  const platformC = buildPlatform(mat, geo, { radius: 5.6, tiers: 3, seg: tier.seg });
  platformC.group.position.y = -2.0;
  stageC.add(platformC.group);

  // Same lesson as the Stage B reactor: a transmissive dome over an emissive
  // core has no hard edge of its own, so without a rim, a base and an outline
  // it resolves to a soft orange patch instead of a machine.
  const dome = new THREE.Mesh(
    geo.track(new THREE.SphereGeometry(1.7, tier.seg, 20, 0, Math.PI * 2, 0, Math.PI * 0.62)),
    mat.heroGlass,
  );
  dome.position.y = -0.6;
  stageC.add(dome);
  const domeRim = new THREE.Mesh(
    geo.track(new THREE.TorusGeometry(1.68, 0.06, 8, tier.seg)),
    mat.titanium,
  );
  domeRim.rotation.x = Math.PI / 2;
  domeRim.position.y = -0.58;
  stageC.add(domeRim);
  const domeCore = new THREE.Mesh(geo.track(new THREE.IcosahedronGeometry(0.55, 1)), mat.core);
  domeCore.position.y = -0.25;
  stageC.add(domeCore);
  const domeHalo = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.8, 20, 16)), mat.coreHalo);
  domeHalo.position.y = -0.25;
  stageC.add(domeHalo);
  const domeBase = new THREE.Mesh(geo.track(new THREE.CylinderGeometry(1.9, 2.05, 0.3, tier.seg)), mat.titanium);
  domeBase.position.y = -0.78;
  stageC.add(domeBase);
  const domeBaseEdges = new THREE.LineSegments(
    geo.track(new THREE.EdgesGeometry(domeBase.geometry)),
    mat.ink,
  );
  domeBaseEdges.position.y = -0.78;
  stageC.add(domeBaseEdges);

  const orbitC = buildOrbitNetwork(mat, geo, {
    count: Math.max(2, tier.orbits - 1), radius: 5.4, y: -0.4, tubular: tier.tubular,
  });
  stageC.add(orbitC.group);

  /* ---- the industry ring ------------------------------------------------
   * A fixed set of slots around the dome. The dome — the intelligence — never
   * changes; only which modules occupy the slots does. A single shared pool of
   * objects moves between slots, so switching industry costs no new geometry.
   */
  const SLOTS = tier.industry;
  const slotPositions = [];
  for (let i = 0; i < SLOTS; i += 1) {
    const a = (i / SLOTS) * Math.PI * 2 + 0.5;
    slotPositions.push(new THREE.Vector3(
      Math.sin(a) * 5.9,
      0.5 + Math.sin(i * 1.7) * 0.9,
      Math.cos(a) * 5.9,
    ));
  }

  const ringRailGeo = geo.track(new THREE.CylinderGeometry(0.018, 0.018, 1, 6));
  const slots = slotPositions.map((at, i) => {
    const rail = new THREE.Mesh(ringRailGeo, mat.track);
    const dir = at.clone().sub(_v.set(0, -0.25, 0));
    rail.scale.y = dir.length();
    rail.position.copy(at).multiplyScalar(0.5).add(_v.set(0, -0.125, 0));
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    stageC.add(rail);

    const signal = new THREE.Mesh(geo.track(new THREE.SphereGeometry(0.08, 8, 8)), mat.nodeWarm);
    stageC.add(signal);

    const tick = objects.build("check");
    tick.setState("success", 1);
    tick.group.scale.setScalar(0.001);
    stageC.add(tick.group);

    return { at, rail, signal, tick, phase: i * 0.9, index: i };
  });

  const industryPool = INDUSTRY_POOL.map((kind) => {
    const item = objects.build(kind);
    item.group.scale.setScalar(0.001);
    stageC.add(item.group);
    return { item, kind, slot: -1, present: 0 };
  });

  const pipeline = buildPipeline(objects, mat, geo, {
    steps: tier.pipeline, y: -2.7, z: 4.6, span: mobile ? 8 : 11.5,
  });
  stageC.add(pipeline.group);

  /* ---- flowing data path A -> B -> C ------------------------------------
   * Routed off-centre and to the rear. The previous path ran straight down
   * x = 0, which put a thick orange tube through the middle of every core on
   * the page - from the front it read as a stray line skewering the machine
   * rather than as a conduit between stages.
   */
  const ribbon = buildRibbon(mat, geo, [
    new THREE.Vector3(2.6, STAGE_A_Y - 2.8, -1.2),
    new THREE.Vector3(3.8, STAGE_A_Y - 6.2, -3.6),
    new THREE.Vector3(3.4, STAGE_B_Y + 4.4, -5.0),
    new THREE.Vector3(3.9, STAGE_B_Y - 1.2, -5.4),
    new THREE.Vector3(3.2, STAGE_B_Y - 6.2, -4.6),
    new THREE.Vector3(3.6, STAGE_C_Y + 5.0, -4.4),
    new THREE.Vector3(2.4, STAGE_C_Y + 1.4, -2.2),
  ], { tubular: tier.tubular * 2, radius: mobile ? 0.24 : 0.34 });
  root.add(ribbon.group);

  /* ---- particles -------------------------------------------------------- */
  const particleCurves = [ribbon.curve];
  [[STAGE_A_Y + 0.4, 7.0], [STAGE_B_Y - 0.3, 6.4], [STAGE_C_Y - 0.2, 5.8]].forEach(([cy, r], i) => {
    const pts = [];
    for (let s = 0; s <= 64; s += 1) {
      const a = (s / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(a) * r,
        cy + Math.sin(a * 2 + i) * 0.6,
        Math.sin(a) * r * 0.82,
      ));
    }
    particleCurves.push(new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.3));
  });
  const particles = buildParticles(geo, tier.particles, particleCurves, [STAGE_C_Y - 2, STAGE_A_Y + 5]);
  root.add(particles.points);

  /* ---- soft accent lights at each core ---------------------------------- */
  const accentA = new THREE.PointLight(EMBER, 1.0, 14, 2);
  accentA.position.set(0, STAGE_A_Y + 0.4, 1.2);
  root.add(accentA);
  const accentB = new THREE.PointLight(EMBER, 0.9, 13, 2);
  accentB.position.set(0, STAGE_B_Y, 1.2);
  root.add(accentB);
  const accentC = new THREE.PointLight(EMBER, 0.8, 12, 2);
  accentC.position.set(0, STAGE_C_Y, 1.2);
  root.add(accentC);

  /* =======================================================================
   * update
   * ==================================================================== */
  const orbitSets = [orbitA, orbitB, orbitC];
  const platforms = [platformA, platformB, platformC];
  const tmp = new THREE.Vector3();
  let industryMorph = 1;
  let industryShown = INDUSTRY_ORDER[0];
  let industryTarget = INDUSTRY_ORDER[0];

  function update(progress, elapsed, delta, mood = DEFAULT_MOOD, beats = null, sections = null, industry = null) {
    const p = clamp01(progress);
    const energy = mood.energy ?? 1;
    const spread = mood.spread ?? 1;
    const veil = mood.veil ?? 0;
    // Set by ThreeBackground when the visitor prefers reduced motion.
    const still = (mood.still ?? 0) > 0.5;
    // Calm sections slow every idle motion rather than stopping it, so the
    // transition in and out of them stays continuous.
    const dm = delta * (1 - (mood.calm ?? 0) * 0.62);
    const mix = Math.min(1, delta * 2.6);

    /* -- section weights, with a progress fallback for pages that have none */
    const w = sections || {
      hero: 1 - ramp(p, 0.02, 0.12),
      problems: ramp(p, 0.04, 0.13) * (1 - ramp(p, 0.16, 0.25)),
      services: ramp(p, 0.18, 0.27) * (1 - ramp(p, 0.34, 0.43)),
      billing: ramp(p, 0.36, 0.45) * (1 - ramp(p, 0.5, 0.58)),
      agent: ramp(p, 0.52, 0.6) * (1 - ramp(p, 0.64, 0.72)),
      industries: ramp(p, 0.66, 0.73) * (1 - ramp(p, 0.77, 0.83)),
      analyzer: ramp(p, 0.78, 0.84) * (1 - ramp(p, 0.86, 0.9)),
      company: ramp(p, 0.87, 0.91) * (1 - ramp(p, 0.93, 0.96)),
      contact: ramp(p, 0.94, 0.98),
    };
    const hero = w.hero ?? 0;
    const problems = w.problems ?? 0;
    const services = w.services ?? 0;
    const billingW = w.billing ?? 0;
    const agent = w.agent ?? 0;
    const industriesW = w.industries ?? 0;
    const analyzer = w.analyzer ?? 0;
    const company = w.company ?? 0;
    const contact = w.contact ?? 0;

    // Beat gates, still anchored to the real sections by the storyboard. They
    // carry the connective tissue (arriving data, the A->B->C conduit) that
    // spans sections rather than belonging to any one of them.
    const b = beats || {};
    const intakeOn = b.intake ?? (0.55 + 0.45 * ramp(p, 0.01, 0.14));
    const nodesOn = b.nodes ?? ramp(p, 0.14, 0.3);
    const streamOn = b.stream ?? ramp(p, 0.5, 0.66);

    /* -- stage gating ---------------------------------------------------
     * A stage that is nowhere near the viewport is switched off entirely.
     * This is what keeps a scene of this density affordable: at any moment
     * roughly one stage is drawn instead of three.
     */
    const liveA = hero + problems + services;
    const liveB = billingW + agent;
    const liveC = industriesW + analyzer + company + contact;
    stageA.visible = liveA > 0.02;
    stageB.visible = liveB > 0.02;
    stageC.visible = liveC > 0.02;

    /* =================================================================
     * Stage A
     * ============================================================== */
    if (stageA.visible) {
      // The machine runs on its own whenever it is on screen — this is the
      // idle signal that the concept is legible without scrolling (§17).
      const feeding = clamp01(hero * 0.9 + services * 0.8 + problems * 0.2);
      const producing = clamp01(hero * 0.75 + services * 0.85);
      core.update(elapsed, delta, {
        scan: clamp01(hero * 0.8 + services),
        analyze: clamp01(hero * 0.6 + services * 0.9),
        decide: clamp01(services * 0.7),
        execute: clamp01(services * 0.5 + hero * 0.3),
        pressed: 0,
        done: producing,
      });
      // The core stays visible through #problems: the stalled manual work has
      // to be seen converging INTO something.
      // The heart of the machine has to out-punch a near-white page, so it is
      // driven well past 1: under ACES this is what makes it read as light
      // rather than as an orange block.
      mat.core.emissiveIntensity = (2.0 + Math.sin(elapsed * 1.6) * 0.35) * (0.5 + energy * 0.62);
      platformA.glow.material.opacity = (0.3 + Math.sin(elapsed * 1.3) * 0.12) * (0.42 + energy * 0.72);

      /* -- work arriving --------------------------------------------- */
      queue.forEach((item, i) => {
        const on = feeding > 0.08;
        item.group.visible = on;
        if (!on) return;
        item.t = (item.t + delta * 0.075 * (0.4 + feeding * 0.9)) % 1;
        const u = item.t;
        if (u < 0.55) {
          const k = u / 0.55;
          tmp.lerpVectors(core.anchors.approach, core.anchors.mouth, k);
          tmp.x -= (1 - k) * 3.0;
          item.setState("input", mix);
        } else {
          const k = (u - 0.55) / 0.45;
          tmp.lerpVectors(core.anchors.mouth, core.anchors.centre, k);
          tmp.y += Math.sin(k * Math.PI) * 0.45;
          item.setState("process", mix);
        }
        item.group.position.copy(tmp);
        item.group.rotation.y = 0.3 + u * 1.1;
        item.group.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.05;
        // consumed at the centre: the input object is transformed, not moved
        const consumed = smoothstep((u - 0.85) / 0.15);
        item.group.scale.setScalar(1.55 * (1 - consumed) * (0.55 + feeding * 0.45));
      });

      /* -- finished work leaving -------------------------------------- */
      outputs.forEach((out, i) => {
        const on = producing > 0.08;
        out.holder.visible = on;
        if (!on) return;
        out.t = (out.t + delta * 0.085 * (0.35 + producing)) % 1;
        const u = out.t;
        const lane = (i - (outputs.length - 1) / 2) * 0.62;

        tmp.lerpVectors(core.anchors.exit, core.anchors.away, u);
        tmp.y += lane * 0.4 + Math.sin(elapsed * 0.6 + i) * 0.07;
        tmp.z += lane * 0.55;
        out.holder.position.copy(tmp);
        out.holder.rotation.y = -0.3 - u * 0.5;

        const appear = smoothstep(u / 0.16);
        out.holder.scale.setScalar(1.5 * appear * (1 - smoothstep((u - 0.84) / 0.16)));
        // the mark lands only after the object has cleared the machine
        const confirmed = smoothstep((u - 0.3) / 0.2);
        out.tick.group.scale.setScalar(0.001 + confirmed * 0.72);
        out.item.setState(confirmed > 0.5 ? "success" : "active", mix);
      });

      /* -- connected business systems ---------------------------------
       * "RTH core powers all services": a pulse leaves the core, travels the
       * rail, and the system it reaches lights up. One at a time, in order,
       * slow enough to follow.
       */
      const wave = (elapsed * 0.28) % (systems.items.length + 1.4);
      const connected = clamp01(hero * 0.7 + services + industriesW * 0.3 + contact * 0.8);
      systems.items.forEach((sys, i) => {
        const scatter = problems;
        sys.item.group.position.set(
          sys.base.x * (1 + scatter * 0.3),
          sys.base.y + Math.sin(elapsed * 0.45 + sys.phase) * 0.12 + scatter * 0.8,
          sys.base.z - scatter * 1.4,
        );
        sys.item.group.rotation.y = -Math.atan2(sys.base.x, sys.base.z) + Math.PI
          + Math.sin(elapsed * 0.25 + sys.phase) * 0.14;
        sys.item.group.scale.setScalar(2.4 * (0.5 + connected * 0.5) * (1 - problems * 0.25));
        // Rails stay neutral. Orange in this scene means data in motion, never
        // wiring - so the rail is the claim and only the travelling signal on it
        // is lit. Painting the rails orange was most of the visual noise.
        sys.rail.material = mat.track;

        // the pulse: core -> system, one system at a time
        const local = wave - i;
        const travelling = local > 0 && local < 1.2;
        sys.signal.visible = travelling && connected > 0.25;
        if (sys.signal.visible) {
          sys.curve.getPointAt(clamp01(1 - local / 1.2), tmp);
          sys.signal.position.copy(tmp);
        }
        // it activates once the pulse has actually reached it, and stays warm
        const reached = local > 1.0 && local < systems.items.length;
        sys.item.setState(
          contact > 0.5 ? "success" : reached ? "active" : connected > 0.3 ? "process" : "neutral",
          mix,
        );
      });

      /* -- the manual, pre-automation state ---------------------------- */
      // Converge once the problems section is on its way out: the stalled
      // work starts heading for the core, which is the hand-off into the
      // rest of the page.
      const converge = clamp01(services * 1.4);
      manual.update(elapsed, delta, problems, converge);

      /* -- intake ------------------------------------------------------ */
      intake.group.visible = intakeOn > 0.02 && problems < 0.7;
      if (intake.group.visible) {
        intake.packets.forEach((packet) => {
          const u = packet.userData;
          u.t = (u.t + dm * u.speed * (0.35 + intakeOn * 0.65)) % 1;
          u.curve.getPointAt(u.t, tmp);
          packet.position.copy(tmp);
          packet.scale.setScalar(0.7 + u.t * 0.6);
        });
      }
    }

    /* =================================================================
     * Stage B — billing, then execution. Never both at once.
     * ============================================================== */
    if (stageB.visible) {
      hubCore.rotation.y += dm * 0.5;
      hubGlass.rotation.y -= dm * 0.12;
      hubCap.position.y = 0.75 + Math.sin(elapsed * 0.6) * 0.04;
      mat.coreHalo.opacity = 0.12 + 0.09 * (0.4 + streamOn * 0.6) + Math.sin(elapsed * 1.1) * 0.025;

      // Under reduced motion the caller sends delta 0, which would park both
      // sequences at phase 0 — an empty billing line and an execution chain
      // that never starts. Holding them late instead keeps the meaning
      // readable as a still frame, which is the whole point of the section.
      billing.update(elapsed, delta, billingW, still ? 0.93 : null);
      const act = action.update(elapsed, delta, agent, still ? 0.82 : null);

      /* -- robotic hand: approach the control, press it, withdraw ------
       * Its position is derived from the action sequence's own phase, so the
       * press is the cause of the send rather than something happening
       * alongside it.
       */
      if (hand) {
        const reach = act.reach * agent;
        hand.root.visible = reach > 0.02;
        if (hand.root.visible) {
          const ease = smoothstep(reach);
          // Where the FINGERTIP should be: parked above the control while
          // approaching, on it at the moment of the press.
          tmp.copy(action.anchors.approach).lerp(action.anchors.button, ease);
          tmp.y += (1 - ease) * 0.9 + 0.16 - act.pressed * 0.16
            + Math.sin(elapsed * 0.7) * 0.03 * (1 - ease);
          // Place the root so the tip lands exactly there.
          hand.root.position.copy(tmp).sub(hand.tipOffset);
          hand.hand.rotation.z = -0.16 + Math.sin(elapsed * 0.5) * 0.03 * (1 - ease);
          hand.hand.rotation.x = -0.62 - act.pressed * 0.09;
          // the index finger straightens into the press; the others hold
          hand.fingers.forEach((f, fi) => {
            const idle = Math.sin(elapsed * 0.9 + f.userData.phase) * f.userData.amp * (1 - ease);
            f.rotation.x = f.userData.rest + idle - (fi === 0 ? act.pressed * 0.12 : 0);
          });
          hand.palmNode.material.opacity = 0.4 + act.pressed * 0.55;
        }
      }
    }

    /* =================================================================
     * Stage C — industry systems, the described pipeline, the finished
     * connected ecosystem.
     * ============================================================== */
    if (stageC.visible) {
      domeCore.rotation.y += dm * 0.34;
      domeCore.rotation.x += dm * 0.12;
      domeCore.scale.setScalar(0.9 + liveC * 0.12 + Math.sin(elapsed * 1.4) * 0.03);
      dome.rotation.y += dm * 0.05;

      /* -- industry reconfiguration -----------------------------------
       * When the visitor picks an industry the ring visibly rebuilds: the
       * current modules retract, the new set extends. Same core, different
       * modules — which is the claim the section makes in words.
       */
      const requested = industry && INDUSTRY_SETS[industry] ? industry : industryTarget;
      if (requested !== industryTarget) {
        industryTarget = requested;
        industryMorph = 0;
      }
      if (industryMorph < 1) {
        industryMorph = Math.min(1, industryMorph + delta * 0.9);
        if (industryMorph >= 0.5) industryShown = industryTarget;
      }
      // 1 while settled, dipping to 0 at the halfway point of a change
      const extend = industryMorph < 0.5
        ? 1 - smoothstep(industryMorph / 0.5)
        : smoothstep((industryMorph - 0.5) / 0.5);

      const set = INDUSTRY_SETS[industryShown] || INDUSTRY_SETS[INDUSTRY_ORDER[0]];
      const ringPresence = clamp01(industriesW + analyzer * 0.3 + company * 0.75 + contact);
      industryPool.forEach((entry) => {
        const slotIndex = set.indexOf(entry.kind);
        const wanted = slotIndex >= 0 && slotIndex < slots.length ? slotIndex : -1;
        entry.slot = wanted;
        const target = wanted >= 0 ? 1 : 0;
        entry.present += (target - entry.present) * Math.min(1, delta * 6);
        const shown = entry.present * extend * ringPresence;
        entry.item.group.visible = shown > 0.02;
        if (!entry.item.group.visible) return;
        const at = slots[Math.max(0, wanted)].at;
        // No mood `spread` here: the ring's rails are built at fixed radii, so
        // moving the modules would pull them off the ends of their own links.
        entry.item.group.position.set(
          at.x,
          at.y + Math.sin(elapsed * 0.4 + wanted) * 0.1,
          at.z,
        );
        entry.item.group.rotation.y = -Math.atan2(at.x, at.z) + Math.PI
          + Math.sin(elapsed * 0.2 + wanted) * 0.1;
        entry.item.group.scale.setScalar(2.0 * shown);
        entry.item.setState(
          contact > 0.45 ? "success" : company > 0.4 ? "process" : industriesW > 0.3 ? "active" : "process",
          mix,
        );
      });

      /* -- the ring's own links and completion marks ------------------- */
      const calm = clamp01(company + contact);
      const pulseSpeed = 0.24 * (1 - calm * 0.45);
      slots.forEach((slot, i) => {
        const t = ((elapsed * pulseSpeed + i * 0.14) % 1);
        slot.signal.position.copy(slot.at).multiplyScalar(t);
        slot.signal.position.y = -0.25 + (slot.at.y + 0.25) * t;
        slot.signal.visible = ringPresence > 0.2;
        slot.signal.material = contact > 0.5 ? mat.nodeDone : mat.nodeWarm;
        slot.rail.material = mat.track;
        // Completion ticks only in the closing section, where the claim is
        // that the whole business now runs as one finished system.
        const done = smoothstep((contact - 0.3) / 0.5);
        slot.tick.group.position.copy(slot.at).add(_v.set(0.6, 0.62, 0.2));
        slot.tick.group.scale.setScalar(0.001 + done * 0.8);
      });

      /* -- the described automation pipeline --------------------------- */
      // Steps appear one after another, left to right, then a run passes
      // through the finished chain. Kept low and small: the form above it is
      // the focus of this section.
      const forming = clamp01(analyzer * 1.15);
      pipeline.group.visible = forming > 0.03;
      if (pipeline.group.visible) {
        const cursor = ((elapsed * 0.16) % 1.4) * pipeline.nodes.length;
        pipeline.nodes.forEach((node, i) => {
          const appear = smoothstep((forming * (pipeline.nodes.length + 1) - i) / 1.2);
          node.item.group.scale.setScalar(0.001 + appear * 0.95);
          node.item.group.rotation.y = Math.sin(elapsed * 0.3 + i) * 0.2;
          const running = cursor > i && cursor < i + 1.1;
          node.item.setState(running ? "active" : appear > 0.6 ? "process" : "neutral", mix);
        });
        pipeline.links.forEach((link, i) => {
          const appear = smoothstep((forming * (pipeline.nodes.length + 1) - i - 0.5) / 1.2);
          link.scale.x = Math.max(0.001, link.userData.fullX * appear);
          link.material = cursor > i + 0.5 && cursor < i + 1.5 ? mat.trackActive : mat.track;
        });
      }
    }

    /* =================================================================
     * shared: platforms, orbits, conduit, particles, accents
     * ============================================================== */
    platforms.forEach((plat, i) => {
      if (!plat.group.parent?.visible) return;
      plat.rings.forEach((ring, r) => {
        ring.rotation.z += dm * 0.16 * ring.userData.dir * (1 + r * 0.35);
      });
      plat.group.position.y = plat.group.userData.baseY + Math.sin(elapsed * 0.42 + i * 1.4) * 0.06;
    });

    orbitSets.forEach((set, si) => {
      if (!set.group.parent?.visible) return;
      set.group.rotation.y += dm * (si % 2 ? -0.045 : 0.06);
      // `spread` lives here rather than on the modules: the orbit rings are
      // the one part of the network with nothing physically joined to them, so
      // they can widen and tighten without pulling a rail off its endpoint.
      set.group.scale.set(spread, 1, spread);
      set.nodes.forEach((node) => {
        const u = node.userData;
        u.t = (u.t + dm * u.speed * (0.25 + nodesOn * 0.75)) % 1;
        u.curve.getPointAt(u.t, tmp);
        node.position.copy(tmp);
      });
    });

    // Supporting detail is pulled back where copy sits over the canvas.
    const detail = 1 - veil * 0.55;
    mat.track.opacity = (0.34 + Math.max(nodesOn, 0.35) * 0.3) * detail;
    mat.thread.opacity = 0.5 * detail;
    // The ink outline is the readability tool on a white page, so the veil
    // barely touches it - dimming the edges is what made the old scene vanish.
    mat.ink.opacity = 0.9 * (1 - veil * 0.2);
    particles.points.material.opacity = 0.26 * detail * (1 - veil * 0.45);

    /* -- the A -> B -> C conduit ------------------------------------- */
    ribbon.filament.material.opacity = (0.14 + streamOn * 0.38) * detail;
    ribbon.shell.material.opacity = (0.14 + streamOn * 0.16) * detail;
    ribbon.travellers.forEach((s) => {
      const u = s.userData;
      u.t = (u.t + dm * u.speed * (0.2 + streamOn * 0.8)) % 1;
      ribbon.curve.getPointAt(u.t, tmp);
      s.position.copy(tmp);
      s.visible = streamOn > 0.05;
    });

    const pos = particles.positions;
    particles.riders.forEach((rider, i) => {
      if (!rider) {
        pos[i * 3 + 1] += Math.sin(elapsed * 0.5 + i) * 0.0012;
        return;
      }
      rider.t = (rider.t + delta * rider.speed) % 1;
      rider.curve.getPointAt(rider.t, tmp);
      pos[rider.i * 3] = tmp.x;
      pos[rider.i * 3 + 1] = tmp.y;
      pos[rider.i * 3 + 2] = tmp.z;
    });
    particles.attr.needsUpdate = true;

    // The warm accents are what put an orange haze behind copy, so they are
    // pulled down by the same veil that governs the fine detail.
    const glow = (0.5 + energy * 0.7) * (1 - veil * 0.5);
    accentA.intensity = liveA * glow;
    accentB.intensity = liveB * glow;
    accentC.intensity = liveC * glow;
  }

  // remember platform rest heights for the hover damping above
  platforms.forEach((plat) => { plat.group.userData.baseY = plat.group.position.y; });

  function dispose() {
    geometries.forEach((g) => g.dispose?.());
    Object.values(mat).forEach((m) => m.dispose?.());
    materialsExtra.forEach((m) => m.dispose?.());
    textures.forEach((t) => t.dispose?.());
    root.parent?.remove(root);
  }

  return {
    root, update, dispose,
    stages: { stageA, stageB, stageC },
    industries: INDUSTRY_ORDER,
    // Exposed for inspection only (ThreeBackground hangs the scene off
    // window.__rth): lets the execution beat be checked at a chosen phase
    // instead of whatever frame a screenshot happens to land on.
    parts: { core, billing, action, hand, manual },
  };
}
