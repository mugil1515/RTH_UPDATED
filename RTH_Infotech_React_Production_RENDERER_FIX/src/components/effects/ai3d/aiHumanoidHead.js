// Procedural cybernetic AI humanoid head.
//
// Built as ONE lofted surface: a stack of independent closed contours r(theta)
// sampled at ~126 vertical levels. Because every level is its own contour, the
// surface supports vertical overhangs — which is what gives the nose its real
// undercut and the chin its real jaw line, instead of the blob a plain displaced
// sphere produces.
//
// The silhouette comes from four anatomical profile tables (front/back width,
// front/back depth) interpolated with monotone cubic Hermite splines, so the
// forms never overshoot into bulges. Facial structure on top of that silhouette
// is a set of explicit, hand-placed anatomical deformers — brow ridge, eye
// sockets, cheekbones, cheek hollows, nasolabial folds, philtrum, lips, chin,
// temple hollows, mandible angle. There is no noise anywhere on the face.
//
// Everything is real-time code-based geometry. No images, no models.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Light theme: alpha blending, not additive (see aiIntelligenceScene.js).
const GLOW = THREE.NormalBlending;
const TAU = Math.PI * 2;
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

/* ---------------------------------------------------------------------------
 * Monotone cubic Hermite (Fritsch–Carlson). Shape preserving: the profile never
 * overshoots between anatomical key points, and handles the very uneven key
 * spacing these tables use (0.02 around the lips, 0.30 along the neck).
 * ------------------------------------------------------------------------ */
function profile(keys) {
  const n = keys.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i += 1) { xs[i] = keys[i][0]; ys[i] = keys[i][1]; }
  const dx = new Float64Array(n - 1);
  const m = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = xs[i + 1] - xs[i];
    m[i] = (ys[i + 1] - ys[i]) / dx[i];
  }
  const c = new Float64Array(n);
  c[0] = m[0];
  c[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (m[i - 1] * m[i] <= 0) c[i] = 0;
    else {
      const w = dx[i - 1] + dx[i];
      c[i] = (3 * w) / ((w + dx[i]) / m[i - 1] + (w + dx[i - 1]) / m[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i += 1;
    const h = dx[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * c[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * c[i + 1];
  };
}

/* Canonical head proportions, in units of head height (chin y=-0.5, crown y=+0.5).
   Head width ~0.67, head depth ~0.80, eye line at mid-height, nose base at -0.24,
   mouth at -0.335, jaw angle at -0.335, neck runs down to -0.98. */

// half-width of the FRONT of the section (the face / chin)
const P_WF = profile([
  [-0.98, 0.076], [-0.80, 0.090], [-0.66, 0.106], [-0.575, 0.088], [-0.52, 0.075],
  [-0.50, 0.079], [-0.46, 0.106], [-0.40, 0.151], [-0.34, 0.191], [-0.26, 0.236],
  [-0.16, 0.281], [-0.08, 0.312], [0.00, 0.325], [0.10, 0.330], [0.22, 0.318],
  [0.32, 0.290], [0.40, 0.245], [0.44, 0.196], [0.475, 0.126], [0.50, 0.042],
]);
// half-width of the BACK of the section (the skull / neck)
const P_WB = profile([
  [-0.98, 0.185], [-0.80, 0.190], [-0.66, 0.188], [-0.575, 0.183], [-0.50, 0.180],
  [-0.40, 0.190], [-0.34, 0.212], [-0.26, 0.250], [-0.16, 0.290], [-0.08, 0.320],
  [0.00, 0.334], [0.10, 0.338], [0.22, 0.324], [0.32, 0.294], [0.40, 0.248],
  [0.44, 0.198], [0.475, 0.128], [0.50, 0.042],
]);
// distance from the vertical axis forward to the face plane (smooth mask only —
// brow / lips / chin relief is added by the deformers)
const P_F = profile([
  [-0.98, 0.135], [-0.86, 0.132], [-0.74, 0.140], [-0.655, 0.155], [-0.60, 0.175],
  [-0.555, 0.212], [-0.52, 0.252], [-0.50, 0.280], [-0.47, 0.310], [-0.44, 0.318],
  [-0.40, 0.320], [-0.35, 0.325], [-0.30, 0.332], [-0.25, 0.342], [-0.20, 0.342],
  [-0.14, 0.335], [-0.05, 0.328], [0.02, 0.325], [0.10, 0.334], [0.18, 0.344],
  [0.26, 0.334], [0.34, 0.302], [0.40, 0.256], [0.44, 0.192], [0.475, 0.122],
  [0.50, 0.038],
]);
// distance from the axis back to the occiput
const P_B = profile([
  [-0.98, 0.190], [-0.86, 0.188], [-0.74, 0.183], [-0.62, 0.180], [-0.52, 0.190],
  [-0.44, 0.225], [-0.36, 0.272], [-0.28, 0.330], [-0.20, 0.392], [-0.12, 0.440],
  [-0.04, 0.468], [0.04, 0.476], [0.12, 0.472], [0.22, 0.450], [0.32, 0.404],
  [0.40, 0.330], [0.44, 0.262], [0.475, 0.164], [0.50, 0.060],
]);

// nose: forward projection, peaking at the tip (y=-0.20) then receding fast
// below it so the underside reads as a real overhang.
const P_NOSE = profile([
  [-0.300, 0.000], [-0.268, 0.005], [-0.248, 0.028], [-0.232, 0.058],
  [-0.212, 0.082], [-0.196, 0.088], [-0.160, 0.075], [-0.120, 0.055],
  [-0.060, 0.035], [0.000, 0.022], [0.050, 0.013], [0.100, 0.004], [0.160, 0.000],
]);
// nose half-angle: narrow at the bridge, wide at the wings
const P_NOSE_W = profile([
  [-0.30, 0.225], [-0.24, 0.200], [-0.20, 0.166], [-0.14, 0.136],
  [-0.05, 0.106], [0.05, 0.086], [0.16, 0.080],
]);
// alae (nose wings)
const P_ALA = profile([
  [-0.268, 0.000], [-0.246, 0.017], [-0.222, 0.027], [-0.200, 0.021],
  [-0.174, 0.007], [-0.148, 0.000],
]);

const gauss = (v, s) => Math.exp(-(v * v) / (s * s));
const smooth01 = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// 1 inside `inner`, easing to 0 by `inner + soft`
const win = (v, inner, soft) => 1 - smooth01(inner, inner + soft, v);

/* Anatomical relief added on top of the silhouette, as a displacement along the
   horizontal radial direction. Every term is deliberate — no noise. */
function relief(x, y, z, cz, cx, theta) {
  const ax = Math.abs(x);
  const front = Math.max(0, cz);
  const f2 = front * front;
  const side = Math.abs(cx);
  let d = 0;

  // nose ------------------------------------------------------------------
  const nose = P_NOSE(y);
  if (nose > 0.0004) d += nose * gauss(theta, P_NOSE_W(y)) * front;
  const ala = P_ALA(y);
  if (ala > 0.0004) d += ala * (gauss(theta - 0.29, 0.115) + gauss(theta + 0.29, 0.115)) * front;

  // brow ridge, with the slight glabella dip between the brows --------------
  d += 0.022 * gauss(y - 0.078, 0.052) * win(ax, 0.215, 0.075) * f2;
  d -= 0.006 * gauss(ax, 0.036) * gauss(y - 0.072, 0.042) * f2;

  // Eyes. The lids are sculpted into the surface itself rather than added as
  // separate shells — a shell big enough to hold the eyeball always pops out of
  // the socket as a ball. Four terms: the orbital recess, the rounded lid mass
  // filling it, the upper lid crease, and the palpebral fissure the eyeball
  // shows through (tilted slightly up toward the outer corner, as in a real eye).
  const ox = (ax - 0.118) / 0.105;
  const oy = (y - 0.004) / 0.058;
  d -= 0.046 * Math.exp(-(ox * ox + oy * oy) * 1.2) * f2;

  const lx = (ax - 0.118) / 0.088;
  const ly = (y - 0.006) / 0.050;
  d += 0.038 * Math.exp(-(lx * lx + ly * ly) * 1.25) * f2;

  const crx = (ax - 0.118) / 0.080;
  const cry = (y - 0.040) / 0.017;
  d -= 0.013 * Math.exp(-(crx * crx + cry * cry)) * f2;

  const fsx = (ax - 0.118) / 0.076;
  const fsy = ((y - 0.003) - (ax - 0.118) * 0.10) / 0.018;
  d -= 0.034 * Math.exp(-(fsx * fsx + fsy * fsy) * 1.15) * f2;

  // zygomatic (cheekbone) then the hollow under it -------------------------
  const kx = (ax - 0.238) / 0.095;
  const ky = (y + 0.072) / 0.062;
  d += 0.021 * Math.exp(-(kx * kx + ky * ky)) * front;
  const hx = (ax - 0.188) / 0.100;
  const hy = (y + 0.248) / 0.078;
  d -= 0.016 * Math.exp(-(hx * hx + hy * hy)) * f2;

  // nasolabial fold, running out and down from the nose wing ---------------
  const u = ax - 0.095;
  const v = y + 0.290;
  d -= 0.011 * gauss(u + 0.51 * v, 0.026) * gauss(v, 0.050) * f2;

  // philtrum ---------------------------------------------------------------
  d -= 0.006 * gauss(ax, 0.018) * gauss(y + 0.272, 0.026) * f2;

  // lips: upper, cupid's bow notch, mouth line, lower, mentolabial sulcus ---
  d += 0.016 * gauss(y + 0.298, 0.026) * win(ax, 0.098, 0.036) * f2;
  d -= 0.005 * gauss(y + 0.294, 0.022) * gauss(ax, 0.021) * f2;
  d -= 0.019 * gauss(y + 0.335, 0.012) * win(ax, 0.104, 0.030) * f2;
  d += 0.018 * gauss(y + 0.372, 0.025) * win(ax, 0.086, 0.036) * f2;
  d -= 0.013 * gauss(y + 0.418, 0.029) * win(ax, 0.100, 0.045) * f2;

  // mental protuberance (chin) ---------------------------------------------
  d += 0.015 * gauss(y + 0.462, 0.036) * win(ax, 0.072, 0.050) * f2;

  // temple hollow ----------------------------------------------------------
  const tx = (ax - 0.300) / 0.078;
  const ty = (y - 0.105) / 0.072;
  d -= 0.015 * Math.exp(-(tx * tx + ty * ty)) * side;

  // seat for the ear (brow height down to the nose base, as in a real head) --
  const rx = (ax - 0.310) / 0.070;
  const ry = (y + 0.072) / 0.150;
  const rz = (z + 0.098) / 0.115;
  d -= 0.016 * Math.exp(-(rx * rx + ry * ry + rz * rz)) * side;

  // mandible angle ---------------------------------------------------------
  const jx = (ax - 0.205) / 0.075;
  const jy = (y + 0.335) / 0.060;
  const jz = (z + 0.155) / 0.110;
  d += 0.010 * Math.exp(-(jx * jx + jy * jy + jz * jz));

  return d;
}

const SUPER = 2.25;   // slightly squared cross-section — heads are not ellipses

// Writes the surface point for (theta, y) into `out`, returns the relief amount.
function surface(theta, y, out) {
  const cz = Math.cos(theta);
  const cx = Math.sin(theta);
  const s = 0.5 + 0.5 * cz;                       // smooth front/back blend
  const d = P_B(y) + (P_F(y) - P_B(y)) * s;
  const w = P_WB(y) + (P_WF(y) - P_WB(y)) * s;
  const r = (Math.abs(cz) / d) ** SUPER + (Math.abs(cx) / w) ** SUPER;
  const rr = r > 0 ? r ** (-1 / SUPER) : 0;
  const x = rr * cx;
  const z = rr * cz;
  const disp = relief(x, y, z, cz, cx, theta);
  out.set(x + cx * disp, y, z + cz * disp);
  return disp;
}

// surface point pushed out (or in) along the radial by `off`
function offsetSurface(theta, y, off, out) {
  surface(theta, y, out);
  out.x += Math.sin(theta) * off;
  out.z += Math.cos(theta) * off;
  return out;
}

// theta that lands on a given x at height y (few damped Newton steps)
function thetaForX(x, y) {
  let th = Math.asin(THREE.MathUtils.clamp(x / 0.33, -1, 1));
  for (let i = 0; i < 5; i += 1) {
    surface(th, y, _q);
    th = THREE.MathUtils.clamp(th - (_q.x - x) * 2.4, -1.5, 1.5);
  }
  return th;
}

/* --------------------------------------------------------------------------
 * vertical level distribution — dense through the face, sparse on neck/crown
 * ----------------------------------------------------------------------- */
function levels(mobile) {
  const bands = [
    [-0.985, -0.620, mobile ? 8 : 12],
    [-0.620, -0.500, mobile ? 8 : 13],
    [-0.500, -0.240, mobile ? 22 : 34],   // chin, lips, nose base
    [-0.240, 0.130, mobile ? 26 : 40],   // nose, eyes, brow
    [0.130, 0.420, mobile ? 12 : 18],
    [0.420, 0.500, mobile ? 5 : 8],
  ];
  const ys = [];
  bands.forEach(([a, b, n], i) => {
    for (let k = i === 0 ? 0 : 1; k <= n; k += 1) ys.push(a + (b - a) * (k / n));
  });
  return ys;
}

function buildSkin(mobile) {
  const ys = levels(mobile);
  const A = mobile ? 64 : 100;
  const L = ys.length;

  const count = L * A + 2;                       // + crown apex + neck cap
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  const cDeep = new THREE.Color(0x97979a);
  const cMid = new THREE.Color(0xc8c8ca);
  const cHigh = new THREE.Color(0xf2f2f3);
  const tmp = new THREE.Color();
  const pt = new THREE.Vector3();

  for (let i = 0; i < L; i += 1) {
    const y = ys[i];
    for (let j = 0; j < A; j += 1) {
      const theta = -Math.PI + (j / A) * TAU;
      const disp = surface(theta, y, pt);
      const k = (i * A + j) * 3;
      pos[k] = pt.x; pos[k + 1] = pt.y; pos[k + 2] = pt.z;
      // recesses (sockets, mouth line, folds) bake dark, ridges bake light, so
      // the anatomy still reads with every light and every glow switched off
      const t = THREE.MathUtils.clamp(0.5 + disp * 9, 0, 1);
      if (t < 0.5) tmp.copy(cDeep).lerp(cMid, t * 2);
      else tmp.copy(cMid).lerp(cHigh, (t - 0.5) * 2);
      col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
    }
  }
  const apex = L * A;
  const capB = apex + 1;
  pos[apex * 3] = 0; pos[apex * 3 + 1] = 0.512; pos[apex * 3 + 2] = -0.015;
  pos[capB * 3] = 0; pos[capB * 3 + 1] = -0.992; pos[capB * 3 + 2] = -0.028;
  [apex, capB].forEach((idx) => {
    col[idx * 3] = cMid.r; col[idx * 3 + 1] = cMid.g; col[idx * 3 + 2] = cMid.b;
  });

  const index = [];
  for (let i = 0; i < L - 1; i += 1) {
    for (let j = 0; j < A; j += 1) {
      const j2 = (j + 1) % A;
      const a = i * A + j;
      const b = i * A + j2;
      const c = (i + 1) * A + j2;
      const d = (i + 1) * A + j;
      index.push(a, c, b, a, d, c);
    }
  }
  for (let j = 0; j < A; j += 1) {                       // crown fan
    const j2 = (j + 1) % A;
    index.push((L - 1) * A + j, apex, (L - 1) * A + j2);
  }
  for (let j = 0; j < A; j += 1) {                       // neck cap fan
    const j2 = (j + 1) % A;
    index.push(j2, capB, j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------------------------------
 * small solids
 * ----------------------------------------------------------------------- */
function cylBetween(a, b, r0, r1, seg) {
  const dv = _p.subVectors(b, a);
  const len = dv.length() || 1e-4;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.clone().normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// Mirror an indexed geometry across x, reversing winding so it stays outward
// facing. Lets the left ear / implant be the true mirror of the right one.
function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i];
    idx[i] = idx[i + 2];
    idx[i + 2] = t;
  }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// One ear, authored in a local frame where +X runs toward the back of the head,
// +Y up and +Z laterally outward — then given a quarter turn onto the skull.
// Ear top sits at brow height and the lobe at the nose base, as in a real head.
function earParts(mobile) {
  const out = [];
  const s = mobile ? 8 : 12;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // helix — the outer rim, an inverted U open toward the front and bottom
  const helix = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      V(-0.058, 0.062, 0.006), V(-0.046, 0.118, 0.018), V(-0.006, 0.150, 0.026),
      V(0.042, 0.126, 0.028), V(0.068, 0.062, 0.026), V(0.072, -0.012, 0.022),
      V(0.052, -0.082, 0.015), V(0.020, -0.124, 0.008),
    ]),
    mobile ? 20 : 30, 0.0125, mobile ? 5 : 7, false,
  );
  helix.scale(1, 1, 0.62);
  out.push(helix);

  // antihelix — the inner ridge running parallel inside the rim
  const antihelix = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      V(-0.004, -0.070, 0.014), V(0.010, -0.020, 0.020),
      V(0.020, 0.038, 0.023), V(0.006, 0.086, 0.021), V(-0.026, 0.100, 0.016),
    ]),
    mobile ? 12 : 18, 0.0095, mobile ? 5 : 6, false,
  );
  antihelix.scale(1, 1, 0.62);
  out.push(antihelix);

  // auricular plate — the sheet of tissue the rims sit on, without which the
  // helix and antihelix read as two loose arcs instead of one ear
  const plate = new THREE.SphereGeometry(1, s + 4, s + 2);
  plate.scale(0.060, 0.122, 0.013);
  plate.translate(0.006, 0.006, 0.008);
  out.push(plate);

  // concha — the shallow bowl at the centre of the ear
  const concha = new THREE.SphereGeometry(0.042, s + 2, s, 0, TAU, 0, Math.PI * 0.5);
  concha.rotateX(Math.PI / 2);
  concha.scale(0.85, 1.35, 0.50);
  concha.translate(-0.012, -0.014, 0.006);
  out.push(concha);

  // tragus — the small flap in front of the canal
  const tragus = new THREE.SphereGeometry(0.019, s, s - 2);
  tragus.scale(0.55, 1.15, 0.7);
  tragus.translate(-0.048, -0.030, 0.012);
  out.push(tragus);

  // lobe
  const lobe = new THREE.SphereGeometry(0.026, s, s - 2);
  lobe.scale(0.78, 0.95, 0.55);
  lobe.translate(0.004, -0.140, 0.006);
  out.push(lobe);

  const g = mergeGeometries(out, false);
  out.forEach((o) => o.dispose());
  g.rotateY(Math.PI * 0.5);          // +Z outward -> +X, +X back -> -Z
  g.rotateX(0.05);
  g.translate(0.292, -0.070, -0.098);
  return g;
}

// Temple processor housing — the cybernetic implant at the side of the skull.
function templeParts() {
  const out = [];
  const plate = new THREE.BoxGeometry(0.026, 0.062, 0.086);
  const rim = new THREE.TorusGeometry(0.030, 0.0075, 6, 18);
  rim.rotateY(Math.PI / 2);
  rim.translate(0.012, 0, 0);
  out.push(plate, rim);
  for (let i = 0; i < 3; i += 1) {
    const fin = new THREE.BoxGeometry(0.016, 0.010, 0.052);
    fin.translate(0.016, -0.034 - i * 0.017, -0.006);
    out.push(fin);
  }
  const g = mergeGeometries(out, false);
  out.forEach((o) => o.dispose());
  g.translate(0.288, 0.104, 0.052);
  return g;
}

/* --------------------------------------------------------------------------
 * assembly
 * ----------------------------------------------------------------------- */
export function buildAIHumanoidHead(mobile = false) {
  const root = new THREE.Group();
  const inner = new THREE.Group();          // everything animated lives here
  root.add(inner);

  const skinMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.62,
    roughness: 0.21,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    emissive: 0xf08a45,
    emissiveIntensity: 0.14,
  });
  const partMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8b7b4,
    metalness: 0.74,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const brightMat = new THREE.MeshPhysicalMaterial({
    color: 0xa7a6a3,
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: 0xeb6217,
    emissiveIntensity: 0.5,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xeb6217, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false,
  });

  inner.add(new THREE.Mesh(buildSkin(mobile), skinMat));

  // ---- static solid detail, merged into a single draw call ---------------
  const ear = earParts(mobile);
  const temple = templeParts();
  const solids = [ear, mirrorX(ear), temple, mirrorX(temple)];

  // collar + neck cables
  const collar = new THREE.TorusGeometry(0.203, 0.024, 8, mobile ? 20 : 30);
  collar.rotateX(Math.PI / 2);
  collar.translate(0, -0.862, -0.028);
  solids.push(collar);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  [2.15, 2.68, 3.60, 4.13].forEach((a) => {
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    solids.push(cylBetween(
      V(sx * 0.178, -0.845, sz * 0.178 - 0.028),
      V(sx * 0.152, -0.595, sz * 0.152 - 0.022),
      0.0155, 0.012, mobile ? 5 : 7,
    ));
  });
  const solidMesh = new THREE.Mesh(mergeGeometries(solids, false), partMat);
  solids.forEach((s) => s.dispose());
  inner.add(solidMesh);

  // ---- eyes: eyeball in the carved socket + upper / lower lid shells -----
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: 0xdedcd8, metalness: 0.1, roughness: 0.06, clearcoat: 1,
    transmission: 0.55, thickness: 0.1, ior: 1.45, transparent: true, opacity: 0.9,
  });
  const irisMat = new THREE.MeshBasicMaterial({
    color: 0xeb6217, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false,
  });
  const eyes = [];
  [1, -1].forEach((side) => {
    const eye = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.050, mobile ? 12 : 18, mobile ? 10 : 14), scleraMat);
    eye.add(ball);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0215, mobile ? 10 : 16, mobile ? 8 : 12), irisMat);
    iris.position.z = 0.036;
    iris.scale.set(1, 1, 0.5);
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0090, 8, 8), new THREE.MeshBasicMaterial({
      color: 0xb8480a, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false,
    }));
    pupil.position.z = 0.045;
    eye.add(pupil);

    // Seated so the cornea just clears the sculpted fissure — the lids in front
    // of it are part of the head surface, so nothing can bulge out of the socket.
    eye.position.set(side * 0.118, 0.004, 0.220);
    eye.rotation.y = side * 0.28;
    inner.add(eye);
    eyes.push({ group: eye, iris, pupil });
  });

  // ---- transparent skull panel over the upper occiput --------------------
  {
    const AU = mobile ? 16 : 24;
    const AV = mobile ? 10 : 15;
    const pts = [];
    const idx = [];
    for (let i = 0; i < AV; i += 1) {
      const y = 0.115 + (0.44 - 0.115) * (i / (AV - 1));
      for (let j = 0; j < AU; j += 1) {
        const th = Math.PI * (0.60 + 0.80 * (j / (AU - 1)));
        offsetSurface(th, y, 0.013, _p);
        pts.push(_p.x, _p.y, _p.z);
      }
    }
    for (let i = 0; i < AV - 1; i += 1) {
      for (let j = 0; j < AU - 1; j += 1) {
        const a = i * AU + j;
        idx.push(a, a + AU, a + 1, a + 1, a + AU, a + AU + 1);
      }
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    pg.setIndex(idx);
    pg.computeVertexNormals();
    inner.add(new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({
      color: 0xeb6217, transmission: 0.88, roughness: 0.09, metalness: 0, ior: 1.45,
      thickness: 0.7, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false,
    })));
  }

  // ---- glowing neural nodes visible under the panel ----------------------
  const nodeCount = mobile ? 10 : 16;
  const nodes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.011, 7, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: GLOW, depthWrite: false }),
    nodeCount,
  );
  const nodePts = [];
  const m4 = new THREE.Matrix4();
  const tc = new THREE.Color();
  const palette = [0xeb6217, 0xd2540e, 0xf7853f, 0xc2410c];
  for (let i = 0; i < nodeCount; i += 1) {
    const th = Math.PI * (0.66 + 0.68 * ((i * 0.3819) % 1));
    const y = 0.14 + 0.27 * ((i * 0.6180) % 1);
    offsetSurface(th, y, -0.022, _p);
    nodePts.push(_p.clone());
    nodes.setMatrixAt(i, m4.makeTranslation(_p.x, _p.y, _p.z));
    nodes.setColorAt(i, tc.setHex(palette[i % palette.length]));
  }
  nodes.instanceMatrix.needsUpdate = true;
  inner.add(nodes);

  const linkPts = [];
  for (let i = 0; i < nodePts.length - 1; i += 1) {
    if (nodePts[i].distanceTo(nodePts[i + 1]) < 0.24) linkPts.push(nodePts[i], nodePts[i + 1]);
  }
  const linkMat = new THREE.LineBasicMaterial({ color: 0xeb6217, transparent: true, opacity: 0.32, blending: GLOW, depthWrite: false });
  inner.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linkPts), linkMat));

  // ---- circuit seams traced directly on the face surface -----------------
  const seamPts = [];
  const trace = (samples) => {
    for (let i = 0; i < samples.length - 1; i += 1) seamPts.push(samples[i], samples[i + 1]);
  };
  const onFace = (x, y) => offsetSurface(thetaForX(x, y), y, 0.005, new THREE.Vector3());

  [1, -1].forEach((side) => {
    // ring around the orbit
    const ring = [];
    for (let i = 0; i <= 26; i += 1) {
      const a = (i / 26) * TAU;
      ring.push(onFace(side * (0.118 + 0.093 * Math.cos(a)), 0.004 + 0.062 * Math.sin(a)));
    }
    trace(ring);
    // cheek line, from beside the nose out over the zygomatic
    const cheek = [];
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      cheek.push(onFace(side * (0.115 + t * 0.145), -0.175 + t * 0.115));
    }
    trace(cheek);
    // jaw line, chin out to the mandible angle
    const jaw = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      jaw.push(onFace(side * (0.02 + t * 0.185), -0.487 + t * 0.152));
    }
    trace(jaw);
    // temple to crown
    const temple = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      temple.push(offsetSurface(side * (1.24 - t * 0.62), 0.14 + t * 0.27, 0.005, new THREE.Vector3()));
    }
    trace(temple);
  });
  // forehead centre line
  const mid = [];
  for (let i = 0; i <= 9; i += 1) mid.push(onFace(0, 0.135 + (i / 9) * 0.26));
  trace(mid);

  const seamMat = new THREE.LineBasicMaterial({ color: 0xd2540e, transparent: true, opacity: 0.42, blending: GLOW, depthWrite: false });
  inner.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seamPts), seamMat));

  // ---- temple processor rings + spine strip ------------------------------
  const rings = [];
  [1, -1].forEach((side) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0042, 6, 20), brightMat.clone());
    r.rotation.y = Math.PI / 2;
    r.position.set(side * 0.303, 0.104, 0.052);
    inner.add(r);
    rings.push(r);
  });
  const spine = [];
  for (let i = 0; i < 5; i += 1) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), glowMat.clone());
    s.position.set(0, -0.60 - i * 0.055, -0.168 - i * 0.004);
    inner.add(s);
    spine.push(s);
  }

  // ---- restrained local shading, so the facial structure always reads ----
  const key = new THREE.PointLight(0xffffff, 0.75, 4.6, 2);
  key.position.set(-1.05, 1.15, 1.05);
  inner.add(key);
  const rim = new THREE.PointLight(0xf7853f, 0.5, 4.0, 2);
  rim.position.set(1.15, 0.2, -1.05);
  inner.add(rim);

  // Placement: left of the composition, three-quarter profile turned inward
  // toward the central brain. The root stays static — the scroll scene owns
  // nothing here, but keeping it fixed matches how the hand behaves.
  const scale = mobile ? 1.05 : 1.28;
  root.scale.setScalar(scale);
  root.position.set(-3.12, 0.42, -1.55);
  root.rotation.set(0.05, 0.85, 0.03);

  const baseY = 0;
  return {
    group: root,
    update: (t, dt) => {
      // internal only — subtle float, a small head turn, a slow nod
      inner.position.y = baseY + Math.sin(t * 0.33) * 0.028;
      inner.rotation.y = Math.sin(t * 0.19) * 0.055;
      inner.rotation.x = Math.sin(t * 0.27 + 1.1) * 0.022;

      rings.forEach((r, i) => {
        r.rotation.x += dt * (0.6 + i * 0.15);
        r.material.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 1.6 + i)) * 0.5;
      });
      nodes.material.opacity = 0.45 + Math.abs(Math.sin(t * 1.15)) * 0.42;
      linkMat.opacity = 0.18 + Math.abs(Math.sin(t * 0.85)) * 0.16;
      seamMat.opacity = 0.26 + Math.abs(Math.sin(t * 0.6)) * 0.18;
      spine.forEach((s, i) => {
        s.material.opacity = 0.25 + Math.abs(Math.sin(t * 1.8 - i * 0.55)) * 0.65;
      });
      eyes.forEach((e, i) => {
        e.iris.material.opacity = 0.6 + Math.abs(Math.sin(t * 1.1 + i * 0.4)) * 0.35;
        e.pupil.material.opacity = 0.55 + Math.abs(Math.sin(t * 2.3 + i * 0.4)) * 0.4;
      });
      skinMat.emissiveIntensity = 0.11 + Math.sin(t * 0.55) * 0.045;
    },
  };
}
