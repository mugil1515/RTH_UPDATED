// Additional procedural AI modules for the intelligence composition:
// a security node, a predictive-modelling node, the module -> core data links
// and the AI-themed micro-object field that fills the background layer.
//
// Every builder returns either a floating prop ({ mesh, speed, axis, update })
// that plugs into ThreeBackground's existing `floating` list, or a plain group
// with its own update. Nothing here creates lights, cameras or scroll state.

import * as THREE from "three";

// Light theme: alpha blending, not additive (see aiIntelligenceScene.js).
const GLOW = THREE.NormalBlending;
const COL = {
  orange: 0xeb6217,
  ember: 0xf7853f,
  deepOrange: 0xc2410c,
  amber: 0xd2540e,
  glow: 0xb8480a,
};

/* --------------------------------------------------------------------------
 * Security node — an extruded shield with a scanning ring and a radial pulse
 * ----------------------------------------------------------------------- */
export function buildSecurityNode(position = [-4.5, 1.9, -5.2]) {
  const g = new THREE.Group();

  const s = new THREE.Shape();
  s.moveTo(0, 0.30);
  s.bezierCurveTo(0.10, 0.30, 0.20, 0.26, 0.22, 0.20);
  s.lineTo(0.22, -0.02);
  s.bezierCurveTo(0.22, -0.19, 0.12, -0.28, 0, -0.34);
  s.bezierCurveTo(-0.12, -0.28, -0.22, -0.19, -0.22, -0.02);
  s.lineTo(-0.22, 0.20);
  s.bezierCurveTo(-0.20, 0.26, -0.10, 0.30, 0, 0.30);

  const shield = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, {
      depth: 0.055, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016,
      bevelSegments: 2, curveSegments: 10,
    }),
    new THREE.MeshPhysicalMaterial({
      color: 0xdedcd8, metalness: 0.3, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.09,
    }),
  );
  shield.position.z = -0.03;
  g.add(shield);

  // inner emblem + core
  const emblem = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.009, 6, 26),
    new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.7, blending: GLOW, depthWrite: false }),
  );
  emblem.position.z = 0.045;
  g.add(emblem);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 12, 12),
    new THREE.MeshBasicMaterial({ color: COL.deepOrange, transparent: true, opacity: 0.95, blending: GLOW, depthWrite: false }),
  );
  core.position.z = 0.05;
  g.add(core);

  // scanning ring — sweeps down the face of the shield
  const scan = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.005, 6, 30),
    new THREE.MeshBasicMaterial({ color: COL.ember, transparent: true, opacity: 0.6, blending: GLOW, depthWrite: false }),
  );
  scan.position.z = 0.07;
  g.add(scan);

  // radial pulse rings
  const pulses = [];
  for (let i = 0; i < 2; i += 1) {
    const p = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.0035, 5, 26),
      new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.5, blending: GLOW, depthWrite: false }),
    );
    p.position.z = 0.06;
    p.userData.ph = i * 0.5;
    pulses.push(p);
    g.add(p);
  }

  g.position.fromArray(position);
  g.rotation.y = 0.35;
  return {
    mesh: g,
    speed: 0.05,
    axis: "y",
    update: (t) => {
      core.material.opacity = 0.5 + Math.abs(Math.sin(t * 2.1)) * 0.45;
      emblem.material.opacity = 0.4 + Math.abs(Math.sin(t * 1.4)) * 0.35;
      const sw = (t * 0.5) % 1;
      scan.position.y = 0.30 - sw * 0.62;
      scan.scale.setScalar(0.35 + Math.sin(sw * Math.PI) * 0.75);
      scan.material.opacity = Math.sin(sw * Math.PI) * 0.55;
      pulses.forEach((p) => {
        const u = ((t * 0.42 + p.userData.ph) % 1);
        p.scale.setScalar(0.4 + u * 2.1);
        p.material.opacity = (1 - u) * 0.45;
      });
    },
  };
}

/* --------------------------------------------------------------------------
 * Predictive modelling node — wireframe icosahedron shell, glowing octahedral
 * core, and three sampled points orbiting on their own planes
 * ----------------------------------------------------------------------- */
export function buildPredictionNode(position = [3.5, 2.55, -5.6]) {
  const g = new THREE.Group();

  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.30, 0)),
    new THREE.LineBasicMaterial({ color: COL.ember, transparent: true, opacity: 0.45, blending: GLOW, depthWrite: false }),
  );
  g.add(shell);

  const inner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.135, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xf6c9a4, metalness: 0.35, roughness: 0.12, clearcoat: 1,
      transmission: 0.6, thickness: 0.4, ior: 1.45, transparent: true, opacity: 0.7,
      emissive: 0xeb6217, emissiveIntensity: 0.7,
    }),
  );
  g.add(inner);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 12),
    new THREE.MeshBasicMaterial({ color: COL.glow, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false }),
  );
  g.add(core);

  const orbitMat = new THREE.MeshBasicMaterial({ color: COL.deepOrange, transparent: true, opacity: 0.9, blending: GLOW, depthWrite: false });
  const sats = [];
  const planes = [new THREE.Euler(0, 0, 0), new THREE.Euler(1.1, 0.4, 0), new THREE.Euler(-0.6, 1.2, 0)];
  for (let i = 0; i < 3; i += 1) {
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), orbitMat);
    sat.userData = {
      r: 0.38 + i * 0.05,
      q: new THREE.Quaternion().setFromEuler(planes[i]),
      ang: i * 2.1,
      speed: 0.5 + i * 0.18,
    };
    sats.push(sat);
    g.add(sat);
  }

  const v = new THREE.Vector3();
  g.position.fromArray(position);
  return {
    mesh: g,
    speed: 0.09,
    axis: "y",
    update: (t, dt) => {
      inner.rotation.x += dt * 0.35;
      inner.rotation.z -= dt * 0.22;
      inner.material.emissiveIntensity = 0.45 + Math.abs(Math.sin(t * 1.3)) * 0.5;
      core.material.opacity = 0.45 + Math.abs(Math.sin(t * 1.9)) * 0.45;
      sats.forEach((s) => {
        const u = s.userData;
        u.ang += dt * u.speed;
        v.set(Math.cos(u.ang) * u.r, Math.sin(u.ang) * u.r, 0).applyQuaternion(u.q);
        s.position.copy(v);
      });
    },
  };
}

/* --------------------------------------------------------------------------
 * Module -> core data links. Arcs converge on the intelligence core but stop
 * well short of it (radius ~2.7), so they read as one connected system without
 * ever intersecting the shell — and stay correct while the scroll pushes the
 * core back in z, because the core only ever moves along that axis.
 * ----------------------------------------------------------------------- */
export function buildCoreLinks(mobile) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({
    color: COL.amber, transparent: true, opacity: 0.2, blending: GLOW, depthWrite: false,
  });
  const packMat = new THREE.MeshBasicMaterial({
    color: COL.glow, transparent: true, opacity: 0.85, blending: GLOW, depthWrite: false,
  });
  const packGeo = new THREE.SphereGeometry(0.021, 6, 6);

  // from: humanoid head, robotic hand orb, analytics, automation, knowledge cube
  const sources = [
    [-2.55, 0.55, -1.5],
    [1.75, -1.5, -1.35],
    [3.15, -1.7, -3.0],
    [3.5, 1.55, -3.2],
    [3.75, 0.5, -3.8],
    [-3.15, 1.55, -2.9],
  ];
  const use = mobile ? sources.slice(0, 3) : sources;

  const channels = [];
  use.forEach((from, i) => {
    const a = new THREE.Vector3().fromArray(from);
    const b = a.clone().setLength(2.72);            // stop outside the orbit shell
    const mid = a.clone().lerp(b, 0.5).multiplyScalar(1.16);
    mid.y += (i % 2 ? 0.28 : -0.24);
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(26)), lineMat));

    const packs = [];
    for (let k = 0; k < 2; k += 1) {
      const s = new THREE.Mesh(packGeo, packMat);
      s.userData.u = (k / 2 + i * 0.17) % 1;
      packs.push(s);
      group.add(s);
    }
    channels.push({ curve, packs, speed: 0.16 + (i % 3) * 0.04 });
  });

  return {
    group,
    update: (t, dt) => {
      lineMat.opacity = 0.13 + Math.abs(Math.sin(t * 0.5)) * 0.1;
      channels.forEach((c) => {
        c.packs.forEach((s) => {
          s.userData.u = (s.userData.u + dt * c.speed) % 1;
          c.curve.getPoint(s.userData.u, s.position);
          s.scale.setScalar(0.6 + Math.sin(s.userData.u * Math.PI) * 0.8);
        });
      });
    },
  };
}

/* --------------------------------------------------------------------------
 * AI micro-object field — the background layer. Four InstancedMeshes so a few
 * dozen AI-flavoured objects (chips, micro cubes, neural nodes, agent rings)
 * cost four draw calls instead of fifty.
 * ----------------------------------------------------------------------- */
export function buildMicroField(mobile) {
  const group = new THREE.Group();
  const per = mobile ? 7 : 14;

  const kinds = [
    {   // micro chips
      geo: new THREE.BoxGeometry(0.11, 0.11, 0.028),
      mat: new THREE.MeshStandardMaterial({
        color: 0xb8b7b4, metalness: 0.8, roughness: 0.25,
        emissive: COL.orange, emissiveIntensity: 0.35,
      }),
    },
    {   // wireframe-reading polyhedra
      geo: new THREE.OctahedronGeometry(0.075, 0),
      mat: new THREE.MeshStandardMaterial({
        color: 0xa7a6a3, metalness: 0.85, roughness: 0.3,
        emissive: COL.ember, emissiveIntensity: 0.3, flatShading: true,
      }),
    },
    {   // neural / data nodes
      geo: new THREE.SphereGeometry(0.032, 7, 6),
      mat: new THREE.MeshBasicMaterial({
        color: COL.amber, transparent: true, opacity: 0.65, blending: GLOW, depthWrite: false,
      }),
    },
    {   // mini agent rings
      geo: new THREE.TorusGeometry(0.07, 0.008, 5, 16),
      mat: new THREE.MeshBasicMaterial({
        color: COL.deepOrange, transparent: true, opacity: 0.5, blending: GLOW, depthWrite: false,
      }),
    },
  ];

  const items = [];
  const meshes = kinds.map(({ geo, mat }, ki) => {
    const im = new THREE.InstancedMesh(geo, mat, per);
    im.frustumCulled = false;
    for (let i = 0; i < per; i += 1) {
      const a = (i / per) * Math.PI * 2 + ki * 0.9;
      const rad = 4.4 + ((i * 0.618 + ki * 0.31) % 1) * 4.6;
      items.push({
        mi: ki,
        ii: i,
        base: new THREE.Vector3(
          Math.cos(a) * rad * 1.25,
          Math.sin(a * 1.7 + ki) * 3.1,
          -5.5 - ((i * 0.37 + ki * 0.53) % 1) * 8.5,
        ),
        rot: new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28),
        spin: 0.06 + Math.random() * 0.16,
        amp: 0.14 + Math.random() * 0.26,
        ph: Math.random() * 6.28,
        scale: 0.65 + Math.random() * 0.6,
      });
    }
    group.add(im);
    return im;
  });

  const m4 = new THREE.Matrix4();
  const qt = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  return {
    group,
    update: (t) => {
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        pos.set(it.base.x, it.base.y + Math.sin(t * 0.22 + it.ph) * it.amp, it.base.z);
        it.rot.y += it.spin * 0.016;
        it.rot.x += it.spin * 0.009;
        qt.setFromEuler(it.rot);
        scl.setScalar(it.scale);
        meshes[it.mi].setMatrixAt(it.ii, m4.compose(pos, qt, scl));
      }
      meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    },
  };
}
