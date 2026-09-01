// Procedural "AI Intelligence Layer" visual set for the existing WebGL background.
//
// This module ONLY builds the visual children that sit inside the site's existing
// animated scene (the `core` group, the `rings` group and the loose `scene`
// space that the old floating props occupied). It never creates a renderer,
// camera, scroll trigger, Lenis hook or render loop of its own — ThreeBackground
// stays the single owner of all parent transforms, scroll progress, camera path,
// service/billing transitions and disposal.
//
// Everything here is real-time code-based: procedural geometry, lines, points,
// InstancedMesh, MeshPhysicalMaterial / MeshStandardMaterial and CanvasTexture
// HUD panels. No images, video, GLB/GLTF or post-processing.
//
// Consumption (in ThreeBackground.jsx):
//   const ai = createAIIntelligenceScene({ mobile });
//   core.add(ai.brainGroup);          // inherits core rotation / scroll scale / z push
//   rings.add(ai.ringGroup);          // inherits the orbit-ring rotation
//   ai.sceneGroups.forEach(g => scene.add(g));
//   ai.floating.forEach(f => { scene.add(f.mesh); floating.push(f); }); // reuse loop
//   ...in render loop, after the hidden guard:  ai.update(elapsed, delta);
//   ...in cleanup:  ai.dispose();

import * as THREE from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildAIHumanoidHead } from "@/components/effects/ai3d/aiHumanoidHead";
import {
  buildSecurityNode,
  buildPredictionNode,
  buildCoreLinks,
  buildMicroField,
} from "@/components/effects/ai3d/aiModules";

// Light-theme inks. On a bright studio ground every "glow" has to be DARKER
// than the background to be visible at all, so the old near-white highlights
// became orange inks and the shells became white ceramic / polished titanium.
const COL = {
  ceramic: 0xe8e7e5,
  titanium: 0x9fa0a2,
  orange: 0xeb6217,        // exact RTH logo orange
  ember: 0xf7853f,         // lighter energy
  deepOrange: 0xc2410c,    // denser accent
  amber: 0xd2540e,
  glow: 0xb8480a,          // brightest ink; must read against white
};
// Additive blending is invisible against white (light + white = white), so the
// glow layers now composite with ordinary alpha blending.
const GLOW = THREE.NormalBlending;
const _v3 = new THREE.Vector3();

/* ----------------------------------------------------------------------------
 * small procedural helpers
 * ------------------------------------------------------------------------- */

function makeCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  return { canvas, ctx, tex };
}

function labelSprite(text, { size = 30, color = "#eb6217", opacity = 0.5 } = {}) {
  const { canvas, ctx, tex } = makeCanvas(256, 64);
  ctx.font = `600 ${size}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: GLOW,
  }));
  sprite.scale.set(0.9, 0.225, 1);
  return sprite;
}

/* ----------------------------------------------------------------------------
 * 1. Central object — procedural realistic 3D AI BRAIN
 *    Layered build:
 *      L1  one smooth anatomical base volume — wider than tall, frontal
 *          fullness, temporal lobes, occipital taper, carved longitudinal
 *          fissure; the two hemispheres are one connected surface.
 *      L2/3 dense gyrification (domain-warped ridged simplex noise) displacing
 *          that surface into gyri + sulci, offset per hemisphere for asymmetry;
 *          baked vertex colours run mid-grey in the sulci to near-white
 *          on the gyral crowns, so the anatomy reads with every light
 *          and glow turned off.
 *      L4  a light neural layer — nodes on gyral crowns, thin paths, a few
 *          travelling signals — plus cerebellum, brain stem and the energy disc.
 *    Replaces the centre object only; ThreeBackground adds `group` to `core`, so
 *    it still inherits the exact same orbit rotation, scroll scale, z-push,
 *    parallax and section timing.
 * ------------------------------------------------------------------------- */

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth01 = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Anatomical base shape + gyrification for a unit direction `d`; writes the
// displaced local-space point into `out` and returns the gyrus factor
// g (~0 sulcus .. ~1 gyral crown).
function makeBrainField(simplex, mobile) {
  const nz = (x, y, z) => simplex.noise3d(x, y, z);
  const fbm = (x, y, z, oct) => {
    let a = 0; let amp = 0.5; let f = 1;
    for (let i = 0; i < oct; i += 1) { a += amp * nz(x * f, y * f, z * f); amp *= 0.5; f *= 2; }
    return a;
  };
  const ridged = (x, y, z, oct) => {
    let a = 0; let amp = 0.6; let tot = 0; let f = 1;
    for (let i = 0; i < oct; i += 1) {
      let n = 1 - Math.abs(nz(x * f, y * f, z * f));
      n *= n;
      a += amp * n; tot += amp; amp *= 0.5; f *= 2;
    }
    return a / tot;
  };
  const gyrusFreq = mobile ? 3.8 : 4.8;
  const foldAmp = mobile ? 0.06 : 0.078;
  const SCALE = 1.34;

  return (d, out) => {
    const rx = 0.7; const ry = 0.52; const rz = 0.56;
    const side = d.x >= 0 ? 1 : -1;
    const p = out.set(d.x * rx, d.y * ry, d.z * rz);

    p.multiplyScalar(1 + Math.max(0, d.z) * 0.05);             // frontal fullness
    const back = Math.max(0, -d.z - 0.32);                     // occipital taper
    p.x *= 1 - back * 0.38;
    p.y *= 1 - back * 0.22;

    const temporal = smooth01(-0.78, -0.05, d.y)               // temporal lobes
      * smooth01(0.26, 0.72, Math.abs(d.x))
      * smooth01(-0.42, 0.25, d.z);
    p.x += side * temporal * 0.14;
    p.y -= temporal * 0.06;

    if (d.y < -0.22) p.y = -0.22 * ry + (d.y * ry + 0.22 * ry) * 0.5;   // flat base

    p.z += side * 0.018 + (side > 0 ? Math.max(0, d.z) : Math.max(0, -d.z)) * 0.03 * side;  // petalia

    const topness = smooth01(-0.2, 0.5, d.y);                  // longitudinal fissure
    const fissure = Math.max(0, 1 - Math.abs(d.x) / 0.13) * topness;
    p.y -= fissure * 0.17;
    p.x += side * (1 - fissure) * 0.014;

    const so = side > 0 ? 12.4 : -6.1;                         // per-hemisphere offset
    const wx = fbm(d.x * 1.6 + so, d.y * 1.6, d.z * 1.6, 2) * 0.44;
    const wy = fbm(d.x * 1.6, d.y * 1.6 + so, d.z * 1.6 + 4, 2) * 0.44;
    const wz = fbm(d.x * 1.6 + 8, d.y * 1.6, d.z * 1.6 + so, 2) * 0.44;
    // anisotropic frequency -> gyri elongate/curve instead of reading as coral
    const fY = gyrusFreq * 1.75;
    let g = ridged((d.x + wx) * gyrusFreq, (d.y + wy) * fY, (d.z + wz) * gyrusFreq, 3);
    g = g * 0.84 + ridged((d.x + wx) * gyrusFreq * 2.1 + 3, (d.y + wy) * fY * 2.1, (d.z + wz) * gyrusFreq * 2.1, 2) * 0.16;

    _v3.copy(p).normalize();
    p.addScaledVector(_v3, (g - 0.5) * foldAmp * (1 - fissure * 0.9));

    p.multiplyScalar(SCALE);
    p.y += 0.05;
    return g;
  };
}

function buildBrain(mobile) {
  const group = new THREE.Group();
  const inner = new THREE.Group();       // holds the brain sculpture (slow spin / breathing)
  group.add(inner);

  const rand = makeRng(0x1a2b3c4d);
  const simplex = new SimplexNoise({ random: rand });
  const field = makeBrainField(simplex, mobile);

  const cDeep = new THREE.Color(0x9a9793);
  const cMid = new THREE.Color(0xcdcac6);
  const cGyrus = new THREE.Color(0xf7f6f4);
  const tmpC = new THREE.Color();

  // shared brain material — semi-solid, sculptural, faint internal glow
  const brainMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.33,
    metalness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.18,
    transmission: 0.15,
    thickness: 0.5,
    ior: 1.4,
    emissive: 0xf08a45,
    emissiveIntensity: 0.16,
  });

  // ---- L1-L3: cerebrum — one connected, displaced, vertex-coloured surface --
  const wSeg = mobile ? 130 : 220;
  const hSeg = mobile ? 92 : 156;
  const geo = new THREE.SphereGeometry(1, wSeg, hSeg);
  geo.deleteAttribute("uv");
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dir = new THREE.Vector3();
  const pt = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    dir.fromBufferAttribute(pos, i);
    const g = field(dir, pt);
    pos.setXYZ(i, pt.x, pt.y, pt.z);
    const tg = THREE.MathUtils.clamp((g - 0.3) / 0.45, 0, 1);
    if (tg < 0.55) tmpC.copy(cDeep).lerp(cMid, tg / 0.55);
    else tmpC.copy(cMid).lerp(cGyrus, (tg - 0.55) / 0.45);
    colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  inner.add(new THREE.Mesh(geo, brainMat));

  // ---- cerebellum — smaller, darker, tight parallel folia -----------------
  const cSeg = mobile ? 54 : 92;
  const cgeo = new THREE.SphereGeometry(1, cSeg, Math.round(cSeg * 0.66));
  cgeo.deleteAttribute("uv");
  const cpos = cgeo.attributes.position;
  const ccol = new Float32Array(cpos.count * 3);
  const cd = new THREE.Vector3();
  for (let i = 0; i < cpos.count; i += 1) {
    cd.fromBufferAttribute(cpos, i);
    const q = pt.set(cd.x * 0.42, cd.y * 0.3, cd.z * 0.36);
    const folia = Math.sin(cd.y * 15 + cd.z * 2.5 + simplex.noise3d(cd.x * 4, cd.y * 4, cd.z * 4) * 1.2);
    const rg = 1 - Math.abs(folia);
    _v3.copy(q).normalize();
    q.addScaledVector(_v3, (rg - 0.5) * 0.03);
    cpos.setXYZ(i, q.x, q.y, q.z);
    tmpC.copy(cDeep).lerp(cMid, rg * 0.45);
    ccol[i * 3] = tmpC.r; ccol[i * 3 + 1] = tmpC.g; ccol[i * 3 + 2] = tmpC.b;
  }
  cgeo.setAttribute("color", new THREE.BufferAttribute(ccol, 3));
  cgeo.computeVertexNormals();
  const cereb = new THREE.Mesh(cgeo, brainMat);
  cereb.position.set(0, -0.44, -0.44);
  cereb.rotation.x = 0.42;
  inner.add(cereb);

  // ---- brain stem — subtle curved tapered capsule ------------------------
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.11, 0.48, 14, 6);
  const sp = stemGeo.attributes.position;
  for (let i = 0; i < sp.count; i += 1) {
    const yy = sp.getY(i);
    sp.setZ(i, sp.getZ(i) + (0.24 - yy) * 0.16);
  }
  stemGeo.computeVertexNormals();
  const stemMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0bcb7, roughness: 0.42, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.3,
    emissive: 0xf08a45, emissiveIntensity: 0.12,
  });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.set(0, -0.52, -0.06);
  stem.rotation.x = 0.26;
  inner.add(stem);

  // ---- L4: neural nodes on gyral crowns ---------------------------------
  const palette = [0xeb6217, 0xd2540e, 0xf7853f, 0xc2410c];
  const nodePts = [];
  for (let tries = 0; tries < 400 && nodePts.length < (mobile ? 16 : 22); tries += 1) {
    dir.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (dir.lengthSq() < 0.05) continue;
    dir.normalize();
    const g = field(dir, pt);
    if (g > 0.62 && dir.y > -0.35) nodePts.push(pt.clone().multiplyScalar(1.008));
  }
  const nodeGeo = new THREE.SphereGeometry(0.018, 7, 7);
  const nodeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false });
  const dimNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, nodePts.length);
  const m4 = new THREE.Matrix4();
  nodePts.forEach((p, i) => {
    dimNodes.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    dimNodes.setColorAt(i, tmpC.setHex(palette[i % palette.length]));
  });
  dimNodes.instanceMatrix.needsUpdate = true;
  inner.add(dimNodes);

  // brighter pulsing nodes
  const brightNodes = [];
  for (let i = 0; i < (mobile ? 4 : 6) && nodePts.length; i += 1) {
    const p = nodePts[(rand() * nodePts.length) | 0];
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false }),
    );
    n.position.copy(p);
    brightNodes.push(n);
    inner.add(n);
  }

  // ---- L4: thin glowing neural paths + travelling signals ----------------
  const pathMat = new THREE.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.28, blending: GLOW, depthWrite: false });
  const pathSegs = [];
  const paths = [];
  for (let i = 0; i < (mobile ? 4 : 7) && nodePts.length > 3; i += 1) {
    const a = nodePts[(rand() * nodePts.length) | 0];
    let b = nodePts[(rand() * nodePts.length) | 0];
    if (a === b) b = nodePts[(nodePts.indexOf(a) + 1) % nodePts.length];
    const mid = a.clone().add(b).multiplyScalar(0.5).multiplyScalar(1.12);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const cp = curve.getPoints(14);
    for (let k = 0; k < cp.length - 1; k += 1) pathSegs.push(cp[k], cp[k + 1]);
    paths.push(cp);
  }
  inner.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pathSegs), pathMat));

  const signals = [];
  for (let i = 0; i < (mobile ? 3 : 5) && paths.length; i += 1) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshBasicMaterial({ color: COL.glow, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false }),
    );
    s.userData = { path: paths[i % paths.length], t: rand(), speed: 0.3 + rand() * 0.35 };
    signals.push(s);
    inner.add(s);
  }

  // ---- energy disc beneath the brain (unchanged) ------------------------
  const disc = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const rr = 0.5 + i * 0.3;
    const curve = new THREE.EllipseCurve(0, 0, rr, rr, 0, Math.PI * 2);
    const dg = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80).map((p) => new THREE.Vector3(p.x, 0, p.y)));
    disc.add(new THREE.LineLoop(dg, new THREE.LineBasicMaterial({
      color: COL.ember, transparent: true, opacity: 0.32 - i * 0.045, blending: GLOW, depthWrite: false,
    })));
  }
  const discGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 28),
    new THREE.MeshBasicMaterial({ color: COL.ember, transparent: true, opacity: 0.2, blending: GLOW, depthWrite: false }),
  );
  discGlow.rotation.x = -Math.PI / 2;
  disc.add(discGlow);
  disc.position.y = -1.0;
  group.add(disc);

  // ---- brain-local shading: soft key from upper-front-left + warm rim ----
  const keyLight = new THREE.PointLight(0xffffff, 0.8, 10, 2);
  keyLight.position.set(-1.7, 1.9, 2.1);
  group.add(keyLight);
  const rimLight = new THREE.PointLight(0xf7853f, 0.55, 8, 2);
  rimLight.position.set(0.8, 0.5, -2.4);
  group.add(rimLight);

  return { group, inner, brainMat, pathMat, brightNodes, signals, disc, discGlow };
}

function updateBrain(b, t, dt) {
  // internal-only motion — never touches the parent `core` transform
  b.inner.rotation.y += dt * 0.04;                          // very slow spin
  b.inner.scale.setScalar(1 + Math.sin(t * 0.45) * 0.005);  // 0.995 -> 1.005 breathing
  b.brainMat.emissiveIntensity = 0.14 + Math.sin(t * 0.7) * 0.05;   // subtle internal pulse
  b.pathMat.opacity = 0.14 + Math.abs(Math.sin(t * 0.9)) * 0.1;

  b.brightNodes.forEach((n, i) => {
    n.material.opacity = 0.4 + Math.abs(Math.sin(t * 1.3 + i * 1.7)) * 0.55;
    n.scale.setScalar(0.7 + Math.abs(Math.sin(t * 1.3 + i)) * 0.7);
  });

  b.signals.forEach((s) => {
    const u = s.userData;
    u.t = (u.t + dt * u.speed) % 1;
    const f = u.t * (u.path.length - 1);
    const idx = Math.floor(f);
    s.position.lerpVectors(u.path[idx], u.path[Math.min(idx + 1, u.path.length - 1)], f - idx);
    s.material.opacity = 0.4 + Math.sin(u.t * Math.PI) * 0.55;
  });

  b.disc.rotation.y += dt * 0.14;
  b.discGlow.material.opacity = 0.12 + Math.abs(Math.sin(t * 1.3)) * 0.12;
}

/* ----------------------------------------------------------------------------
 * 2. Extra orbital rings + light points travelling along the orbit lines
 * ------------------------------------------------------------------------- */

function buildRingExtras(mobile) {
  const group = new THREE.Group();

  const extra = [];
  [[2.9, 0.9, 0.2], [3.35, -0.5, 1.1]].forEach(([rad, rx, ry]) => {
    const curve = new THREE.EllipseCurve(0, 0, rad, rad, 0, Math.PI * 2);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(140).map((p) => new THREE.Vector3(p.x, p.y, 0)));
    const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.22, blending: GLOW, depthWrite: false }));
    line.rotation.set(rx, ry, 0);
    extra.push(line);
    group.add(line);
  });

  const planes = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(0.52, 0.5, 0),
    new THREE.Euler(1.05, 1.0, 0),
    new THREE.Euler(0.9, 0, 0.2),
    new THREE.Euler(-0.5, 1.1, 0),
  ];
  const radii = [2.6, 2.88, 3.16, 2.9, 3.35];
  const lightGeo = new THREE.SphereGeometry(0.033, 8, 8);
  const lights = [];
  for (let i = 0; i < (mobile ? 4 : 8); i += 1) {
    const idx = i % planes.length;
    const s = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({
      color: i % 2 ? COL.deepOrange : COL.ember, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false,
    }));
    s.userData = {
      r: radii[idx],
      q: new THREE.Quaternion().setFromEuler(planes[idx]),
      ang: Math.random() * Math.PI * 2,
      speed: (0.18 + Math.random() * 0.22) * (i % 2 ? -1 : 1),
      phase: Math.random() * 7,
    };
    lights.push(s);
    group.add(s);
  }

  return { group, extra, lights };
}

function updateRingExtras(r, t, dt, orbitRotation) {
  // Track the site's existing orbit-ring group orientation so the highlights and
  // travelling light points ride on the same planes as the rendered torus rings.
  if (orbitRotation) r.group.rotation.copy(orbitRotation);
  r.extra[0].rotation.z += dt * 0.05;
  r.extra[1].rotation.z -= dt * 0.04;
  r.lights.forEach((s) => {
    const u = s.userData;
    u.ang += dt * u.speed;
    _v3.set(Math.cos(u.ang) * u.r, Math.sin(u.ang) * u.r, 0).applyQuaternion(u.q);
    s.position.copy(_v3);
    s.material.opacity = 0.5 + Math.abs(Math.sin(t * 2 + u.phase)) * 0.5;
  });
}

/* ----------------------------------------------------------------------------
 * 3. Surrounding AI props  — returned as { mesh, speed, axis, update }
 *    They plug into the existing `floating` loop (rotation + service-fade),
 *    and only animate their own internal parts here.
 * ------------------------------------------------------------------------- */

function buildChip() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.12),
    new THREE.MeshPhysicalMaterial({ color: 0xe0dedb, metalness: 0.25, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12 }),
  ));
  const die = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.26, 0.13),
    new THREE.MeshStandardMaterial({ color: 0xfff1e7, emissive: COL.orange, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.4 }),
  );
  g.add(die);

  const pins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.09, 0.03),
    new THREE.MeshStandardMaterial({ color: COL.titanium, metalness: 0.9, roughness: 0.3, emissive: COL.ember, emissiveIntensity: 0.12 }),
    24,
  );
  const mm = new THREE.Matrix4();
  const rot = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  let k = 0;
  for (let i = 0; i < 6; i += 1) {
    const o = -0.2 + i * 0.08;
    pins.setMatrixAt(k++, mm.makeTranslation(-0.3, o, 0));
    pins.setMatrixAt(k++, mm.makeTranslation(0.3, o, 0));
  }
  for (let i = 0; i < 6; i += 1) {
    const o = -0.2 + i * 0.08;
    pins.setMatrixAt(k++, mm.makeTranslation(o, -0.3, 0).multiply(rot));
    pins.setMatrixAt(k++, mm.makeTranslation(o, 0.3, 0).multiply(rot));
  }
  pins.instanceMatrix.needsUpdate = true;
  g.add(pins);

  const label = labelSprite("AI", { size: 46, color: "#b8480a", opacity: 0.85 });
  label.scale.set(0.32, 0.16, 1);
  label.position.set(0, 0, 0.12);
  g.add(label);

  g.position.set(-3.9, -1.5, -2.2);
  return {
    mesh: g,
    speed: 0.12,
    axis: "y",
    update: (t) => {
      die.material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.3;
      g.position.y = -1.5 + Math.sin(t * 0.5) * 0.12;
    },
  };
}

function buildDataCube() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshPhysicalMaterial({ color: COL.orange, metalness: 0, roughness: 0.1, transmission: 0.9, thickness: 1, ior: 1.45, transparent: true, opacity: 0.3, depthWrite: false }),
  ));
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.34, 0.34, 0.34)),
    new THREE.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.55, blending: GLOW, depthWrite: false }),
  );
  g.add(wire);

  const n = 18;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < arr.length; i += 1) arr[i] = (Math.random() - 0.5) * 0.5;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: COL.glow, size: 0.03, transparent: true, opacity: 0.8, blending: GLOW, depthWrite: false })));

  g.position.set(4.3, 0.5, -4);
  return {
    mesh: g,
    speed: 0.1,
    axis: "x",
    update: (t, dt) => {
      wire.rotation.x += dt * 0.3;
      wire.rotation.y -= dt * 0.2;
      const a = pg.attributes.position.array;
      for (let i = 1; i < a.length; i += 3) a[i] += Math.sin(t * 1.5 + i) * 0.0008;
      pg.attributes.position.needsUpdate = true;
    },
  };
}

function buildAgentNode() {
  const g = new THREE.Group();
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshBasicMaterial({ color: COL.deepOrange, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false }),
  );
  g.add(dot);
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(0.16 + i * 0.09, 0.006, 8, 64),
      new THREE.MeshBasicMaterial({ color: i === 1 ? COL.amber : COL.ember, transparent: true, opacity: 0.5, blending: GLOW, depthWrite: false }),
    );
    r.rotation.set(Math.PI / 2 + i * 0.3, i * 0.4, 0);
    rings.push(r);
    g.add(r);
  }
  const label = labelSprite("AGENT", { size: 26, color: "#eb6217", opacity: 0.55 });
  label.scale.set(0.5, 0.125, 1);
  label.position.set(0, 0.5, 0);
  g.add(label);

  g.position.set(-3.3, 1.7, -3);
  return {
    mesh: g,
    speed: 0.05,
    axis: "y",
    update: (t, dt) => {
      rings[0].rotation.z += dt * 0.5;
      rings[1].rotation.z -= dt * 0.35;
      rings[2].rotation.z += dt * 0.22;
      dot.material.opacity = 0.5 + Math.sin(t * 3) * 0.45;
    },
  };
}

function buildProcessPanel() {
  const g = new THREE.Group();
  const steps = ["THINK", "ANALYZE", "PLAN", "EXECUTE"];
  const { canvas, ctx, tex } = makeCanvas(256, 320);
  const draw = (active) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(235,98,23,0.32)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.textBaseline = "middle";
    ctx.font = '600 20px "Courier New", monospace';
    ctx.fillStyle = "#eb6217";
    ctx.fillText("AI PROCESS", 24, 36);
    steps.forEach((s, i) => {
      const y = 100 + i * 52;
      if (i === active) {
        ctx.fillStyle = "rgba(255,241,231,0.95)";
        ctx.fillRect(16, y - 20, w - 32, 40);
      }
      ctx.beginPath();
      ctx.arc(36, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = i <= active ? "#eb6217" : "#c7c7cc";
      ctx.fill();
      ctx.fillStyle = i === active ? "#111111" : "#8a8a8e";
      ctx.font = '600 22px "Courier New", monospace';
      ctx.fillText(s, 58, y);
    });
    tex.needsUpdate = true;
  };
  draw(0);

  g.add(new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.06),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  ));
  g.position.set(4.0, 1.7, -3.4);
  g.rotation.y = -0.3;

  let last = -1;
  return {
    mesh: g,
    speed: 0,
    axis: "y",
    update: (t) => {
      const a = Math.floor(t / 1.2) % 4;
      if (a !== last) { last = a; draw(a); }
      g.position.y = 1.7 + Math.sin(t * 0.4) * 0.09;
      g.rotation.z = Math.sin(t * 0.3) * 0.03;
    },
  };
}

function buildAnalyticsPanel() {
  const g = new THREE.Group();
  const { canvas, ctx, tex } = makeCanvas(320, 220);
  const draw = (t) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(235,98,23,0.32)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = "#eb6217";
    ctx.font = '600 18px "Courier New", monospace';
    ctx.textBaseline = "middle";
    ctx.fillText("DATA INSIGHT", 20, 28);
    const bars = 6;
    for (let i = 0; i < bars; i += 1) {
      const bh = 26 + (Math.sin(t * 0.8 + i) * 0.5 + 0.5) * 92;
      ctx.fillStyle = i === bars - 1 ? "#eb6217" : "rgba(247,133,63,0.6)";
      ctx.fillRect(24 + i * 30, h - 24 - bh, 18, bh);
    }
    ctx.strokeStyle = "#b8480a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const x = 210 + i * 5;
      const y = 120 + Math.sin(t * 1.2 + i * 0.5) * 20 - i * 1.4;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    tex.needsUpdate = true;
  };
  draw(0);

  g.add(new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  ));
  g.position.set(3.6, -1.9, -3.2);
  g.rotation.y = -0.35;

  let last = 0;
  return {
    mesh: g,
    speed: 0,
    axis: "y",
    update: (t) => {
      if (t - last > 0.15) { last = t; draw(t); }
      g.position.y = -1.9 + Math.sin(t * 0.35) * 0.08;
    },
  };
}

function buildNeuralCluster(mobile) {
  const g = new THREE.Group();
  const n = mobile ? 6 : 9;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    pts.push(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.5));
  }
  const nodes = pts.map((p) => {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false }),
    );
    s.position.copy(p);
    s.userData.ph = Math.random() * 7;
    g.add(s);
    return s;
  });
  const link = [];
  pts.forEach((p, i) => pts.forEach((q, j) => { if (j > i && p.distanceTo(q) < 0.7) link.push(p, q); }));
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(link),
    new THREE.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.3, blending: GLOW, depthWrite: false }),
  );
  g.add(lines);

  g.position.set(-3.7, -2.1, -4.6);
  return {
    mesh: g,
    speed: 0.16,
    axis: "z",
    update: (t) => {
      nodes.forEach((s) => { s.material.opacity = 0.32 + Math.abs(Math.sin(t * 2 + s.userData.ph)) * 0.6; });
      lines.material.opacity = 0.18 + Math.sin(t * 1.3) * 0.1;
    },
  };
}

function buildDataStream(position, speed) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.7, -0.5, 0),
    new THREE.Vector3(-0.2, 0.25, 0.3),
    new THREE.Vector3(0.3, -0.1, -0.25),
    new THREE.Vector3(0.8, 0.55, 0.1),
  ]);
  g.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)),
    new THREE.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.32, blending: GLOW, depthWrite: false }),
  ));
  const packMat = new THREE.MeshBasicMaterial({ color: COL.glow, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false });
  const packs = [];
  for (let i = 0; i < 6; i += 1) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), packMat);
    s.userData.u = i / 6;
    packs.push(s);
    g.add(s);
  }
  g.position.fromArray(position);
  return {
    mesh: g,
    speed: 0.04,
    axis: "x",
    update: (t, dt) => {
      packs.forEach((s) => {
        s.userData.u = (s.userData.u + dt * speed) % 1;
        curve.getPoint(s.userData.u, s.position);
      });
    },
  };
}

function buildWireNode(geo, position, coreSize) {
  const g = new THREE.Group();
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: COL.ember, transparent: true, opacity: 0.4, blending: GLOW, depthWrite: false }),
  ));
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(coreSize, 8, 8),
    new THREE.MeshBasicMaterial({ color: COL.deepOrange, transparent: true, opacity: 0.85, blending: GLOW, depthWrite: false }),
  );
  g.add(inner);
  g.position.fromArray(position);
  return {
    mesh: g,
    speed: 0.08,
    axis: "y",
    update: (t) => { inner.material.opacity = 0.35 + Math.abs(Math.sin(t * 2.5 + position[0])) * 0.45; },
  };
}

/* ----------------------------------------------------------------------------
 * 4. Faint drifting code fragments + tiny HUD text (own groups on `scene`)
 * ------------------------------------------------------------------------- */

function buildCodeField(mobile) {
  const group = new THREE.Group();
  const words = ["AI", "01", "NODE", "RUN", "AGENT", "DATA", "SYNC", "0xF3", "MODEL", "TRUE"];
  const items = [];
  for (let i = 0; i < (mobile ? 5 : 10); i += 1) {
    const sp = labelSprite(words[i % words.length], { size: 30, color: i % 3 ? "#eb6217" : "#f7853f", opacity: 0.28 });
    const s = 0.34 + Math.random() * 0.14;
    sp.scale.set(s, s * 0.28, 1);
    sp.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 7, -4 - Math.random() * 5);
    sp.userData = { baseY: sp.position.y, ph: Math.random() * 7 };
    items.push(sp);
    group.add(sp);
  }
  return { group, items };
}

function buildHud() {
  const group = new THREE.Group();
  const a = labelSprite("MODEL  ONLINE", { size: 22, color: "#eb6217", opacity: 0.4 });
  a.scale.set(0.72, 0.11, 1);
  a.position.set(-1.75, 1.95, 0.6);
  const b = labelSprite("NEURAL  SYNC", { size: 22, color: "#b8480a", opacity: 0.4 });
  b.scale.set(0.72, 0.11, 1);
  b.position.set(1.85, -1.95, 0.6);
  group.add(a, b);
  return { group, items: [a, b] };
}

/* ----------------------------------------------------------------------------
 * 5. AI energy orb — central sphere + glass shells + orbit rings + particles
 * ------------------------------------------------------------------------- */

function buildAIEnergyOrb(s = 1) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.09 * s, 16, 14),
    new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false }),
  );
  group.add(core);
  [0.14, 0.185].forEach((r, i) => {
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(r * s, 20, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xeb6217, transmission: 0.9, transparent: true, opacity: 0.2 - i * 0.05,
        roughness: 0.08, metalness: 0, ior: 1.45, depthWrite: false,
      }),
    ));
  });
  const rings = [];
  for (let i = 0; i < 2; i += 1) {
    const rg = new THREE.Mesh(
      new THREE.TorusGeometry(0.2 * s, 0.005 * s, 6, 44),
      new THREE.MeshBasicMaterial({ color: i ? COL.deepOrange : COL.orange, transparent: true, opacity: 0.55, blending: GLOW, depthWrite: false }),
    );
    rg.rotation.set(Math.PI / 2 + i * 0.7, i * 0.5, 0);
    rings.push(rg);
    group.add(rg);
  }
  const n = 12;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 1) arr[i] = (Math.random() - 0.5) * 0.22 * s;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const parts = new THREE.Points(pg, new THREE.PointsMaterial({
    color: COL.amber, size: 0.016 * s, transparent: true, opacity: 0.8, blending: GLOW, depthWrite: false,
  }));
  group.add(parts);
  return { group, core, rings, parts };
}

function updateOrb(o, t, dt) {
  const k = 1 + Math.sin(t * 2) * 0.12;
  o.core.scale.setScalar(k);
  o.core.material.opacity = 0.7 + Math.sin(t * 2) * 0.25;
  o.rings[0].rotation.z += dt * 0.5;
  o.rings[1].rotation.x -= dt * 0.4;
  o.parts.rotation.y += dt * 0.3;
}

/* ----------------------------------------------------------------------------
 * 7. AI ROBOTIC HAND — palm + wrist + articulated thumb & four fingers
 *    (tapered segments, sphere joints), circuit strip along the index, wrist
 *    processor ring, palm energy node, holding a glowing AI energy orb.
 *    Static metal / glass / tip geometry is merged to 3 meshes for cost.
 * ------------------------------------------------------------------------- */

function buildAIHand(mobile) {
  const g = new THREE.Group();
  const hand = new THREE.Group();
  g.add(hand);

  const seg = mobile ? 6 : 9;
  const jointBase = new THREE.SphereGeometry(1, mobile ? 8 : 12, mobile ? 6 : 10);
  const metal = []; const glass = []; const tips = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const cylBetween = (a, b, r0, r1) => {
    const dv = _v3.subVectors(b, a);
    const len = dv.length() || 1e-4;
    const gg = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
    gg.translate(0, len / 2, 0);
    gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dv.clone().normalize()));
    gg.translate(a.x, a.y, a.z);
    return gg;
  };
  const jointAt = (q, r) => jointBase.clone().scale(r, r, r).translate(q.x, q.y, q.z);

  metal.push(new THREE.BoxGeometry(0.34, 0.085, 0.34).translate(0, 0, 0.02));
  metal.push(new THREE.BoxGeometry(0.34, 0.07, 0.06).translate(0, 0.012, 0.19));
  metal.push(cylBetween(V(0, 0, -0.14), V(0, -0.03, -0.44), 0.13, 0.115));

  const fingers = [
    { x: -0.115, len: [0.13, 0.1, 0.075], curl: [0.12, 0.18, 0.14] },
    { x: -0.038, len: [0.145, 0.11, 0.085], curl: [0.3, 0.45, 0.4] },
    { x: 0.04, len: [0.13, 0.1, 0.078], curl: [0.34, 0.5, 0.42] },
    { x: 0.115, len: [0.1, 0.082, 0.062], curl: [0.4, 0.56, 0.46] },
  ];
  const fr = [0.043, 0.038, 0.032, 0.024];
  const xAxis = V(1, 0, 0);
  fingers.forEach((f) => {
    let pp = V(f.x, 0.02, 0.2);
    let dv = V(0, 0.35, 1).normalize();
    f.len.forEach((L, i) => {
      dv = dv.clone().applyAxisAngle(xAxis, f.curl[i]);
      const nx = pp.clone().addScaledVector(dv, L);
      (i === f.len.length - 1 ? tips : metal).push(cylBetween(pp, nx, fr[i], fr[i + 1]));
      glass.push(jointAt(pp, fr[i] * 1.2));
      pp = nx;
    });
    tips.push(jointAt(pp, fr[3] * 1.1));
  });

  {
    let pp = V(-0.16, -0.01, 0.0);
    let dv = V(-0.55, 0.35, 0.5).normalize();
    const tl = [0.11, 0.09];
    const tr = [0.052, 0.042, 0.032];
    const tc = [0.25, 0.5];
    const tAxis = V(0.3, 0.2, 0.9).normalize();
    tl.forEach((L, i) => {
      dv = dv.clone().applyAxisAngle(tAxis, tc[i]);
      const nx = pp.clone().addScaledVector(dv, L);
      (i === tl.length - 1 ? tips : metal).push(cylBetween(pp, nx, tr[i], tr[i + 1]));
      glass.push(jointAt(pp, tr[i] * 1.2));
      pp = nx;
    });
    tips.push(jointAt(pp, tr[2] * 1.1));
  }

  const metalMat = new THREE.MeshPhysicalMaterial({ color: 0xdedcd8, metalness: 0.28, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xeb6217, transmission: 0.7, roughness: 0.1, ior: 1.45, transparent: true, opacity: 0.5, depthWrite: false });
  const tipMat = new THREE.MeshPhysicalMaterial({ color: 0xaeaeac, metalness: 0.92, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05 });
  hand.add(new THREE.Mesh(mergeGeometries(metal, false), metalMat));
  hand.add(new THREE.Mesh(mergeGeometries(glass, false), glassMat));
  hand.add(new THREE.Mesh(mergeGeometries(tips, false), tipMat));
  metal.forEach((x) => x.dispose());
  glass.forEach((x) => x.dispose());
  tips.forEach((x) => x.dispose());
  jointBase.dispose();

  const strip = [];
  [V(-0.115, 0.06, 0.2), V(-0.12, 0.12, 0.31), V(-0.115, 0.17, 0.4), V(-0.11, 0.2, 0.47)].forEach((v, k, arr) => { if (k) strip.push(arr[k - 1], v); });
  [V(-0.13, 0.05, 0.0), V(0.0, 0.05, -0.05), V(0.12, 0.05, 0.02)].forEach((v, k, arr) => { if (k) strip.push(arr[k - 1], v); });
  hand.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(strip),
    new THREE.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.5, blending: GLOW, depthWrite: false }),
  ));

  const wristRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.012, 8, 28),
    new THREE.MeshPhysicalMaterial({ color: 0xaeaeac, metalness: 0.9, roughness: 0.15, clearcoat: 1, emissive: 0xeb6217, emissiveIntensity: 0.35 }),
  );
  wristRing.position.set(0, -0.02, -0.3);
  wristRing.rotation.x = Math.PI / 2 + 0.1;
  hand.add(wristRing);

  const palmNode = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 10, 10),
    new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false }),
  );
  palmNode.position.set(-0.02, 0.06, 0.03);
  hand.add(palmNode);

  const orb = buildAIEnergyOrb(mobile ? 0.85 : 1);
  orb.group.position.set(-0.03, 0.3, 0.08);
  hand.add(orb.group);

  // Lower-right of the composition, mirrored from its original lower-left seat
  // so the humanoid head can take the left side and the two hero props balance
  // across the centre. Same depth layer, so the camera path clears it exactly
  // as before.
  hand.rotation.set(-0.5, -0.72, -0.05);
  hand.scale.setScalar(mobile ? 1.05 : 1.3);
  const baseY = -1.95;
  g.position.set(2.0, baseY, -1.3);

  return {
    group: g,
    update: (t, dt) => {
      g.position.y = baseY + Math.sin(t * 0.35) * 0.045;
      g.rotation.z = Math.sin(t * 0.25) * 0.03;
      wristRing.rotation.z += dt * 0.15;
      palmNode.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.35;
      updateOrb(orb, t, dt);
    },
  };
}

/* ----------------------------------------------------------------------------
 * assembly
 * ------------------------------------------------------------------------- */

export function createAIIntelligenceScene({ mobile = false } = {}) {
  const brain = buildBrain(mobile);
  const ringExtras = buildRingExtras(mobile);
  const codeField = buildCodeField(mobile);
  const hud = buildHud();
  const hand = buildAIHand(mobile);
  const head = buildAIHumanoidHead(mobile);        // left hero — cybernetic face
  const links = buildCoreLinks(mobile);            // module -> core data streams
  const micro = buildMicroField(mobile);           // background AI micro objects

  // Mid-ground intelligence modules. These plug into ThreeBackground's existing
  // `floating` list, so the parent keeps owning their rotation and service-fade.
  const props = [
    buildChip(),
    buildDataCube(),
    buildAgentNode(),
    buildProcessPanel(),
    buildAnalyticsPanel(),
    buildNeuralCluster(mobile),
    buildPredictionNode([3.5, 2.5, -5.6]),
    buildDataStream([-4.3, 0.5, -5.4], 0.12),
    buildWireNode(new THREE.IcosahedronGeometry(0.24, 0), [2.7, 2.3, -6], 0.05),
    buildWireNode(new THREE.BoxGeometry(0.26, 0.26, 0.26), [1.4, -2.6, -5.2], 0.04),
  ];
  if (!mobile) {
    props.push(
      buildSecurityNode([-4.6, 1.85, -5.2]),
      buildDataStream([4.6, 1.9, -6], 0.1),
      buildWireNode(new THREE.OctahedronGeometry(0.24, 0), [-2.5, 2.5, -6.5], 0.045),
      buildWireNode(new THREE.IcosahedronGeometry(0.18, 0), [-1.7, 2.7, -5.4], 0.035),
    );
  }

  const propUpdates = props.map((p) => p.update).filter(Boolean);
  const roots = [
    brain.group, ringExtras.group, codeField.group, hud.group,
    hand.group, head.group, links.group, micro.group,
    ...props.map((p) => p.mesh),
  ];

  return {
    brainGroup: brain.group,
    ringGroup: ringExtras.group,
    sceneGroups: [codeField.group, hud.group, hand.group, head.group, links.group, micro.group],
    floating: props.map((p) => ({ mesh: p.mesh, speed: p.speed, axis: p.axis })),

    update(elapsed, delta, orbitRotation) {
      updateBrain(brain, elapsed, delta);
      updateRingExtras(ringExtras, elapsed, delta, orbitRotation);
      hand.update(elapsed, delta);
      head.update(elapsed, delta);
      links.update(elapsed, delta);
      micro.update(elapsed, delta);
      for (let i = 0; i < propUpdates.length; i += 1) propUpdates[i](elapsed, delta);
      codeField.items.forEach((s) => {
        s.position.y = s.userData.baseY + Math.sin(elapsed * 0.15 + s.userData.ph) * 0.3;
        s.material.opacity = 0.15 + Math.abs(Math.sin(elapsed * 0.4 + s.userData.ph)) * 0.16;
      });
      hud.items.forEach((s, i) => {
        s.material.opacity = 0.28 + Math.abs(Math.sin(elapsed * 0.8 + i * 2)) * 0.18;
      });
    },

    dispose() {
      roots.forEach((root) => {
        root.traverse((o) => {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
          mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
        });
        root.parent?.remove(root);
      });
    },
  };
}
