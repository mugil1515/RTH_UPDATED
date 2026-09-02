// Recognizable business objects, built as real 3D silhouettes.
//
// WHY SILHOUETTES AND NOT ICONS ON CARDS
// The previous scene put flat 128px icon textures on little glass boxes. At
// background scale, behind text, at 0.66 opacity, that reads as "a box" — the
// icon is too small and too low-contrast to register, so the object
// communicated nothing. What actually survives at distance is the OUTLINE. So
// every object here is modelled so its profile alone is identifiable: an
// envelope is a slab with a V flap, a database is three stacked discs, a chart
// is bars of different heights. You should be able to name each one as a black
// shape.
//
// Each object also carries a thin ink outline on its solid parts. On a white
// page that edge is what stops a white ceramic object dissolving into the
// background — it is worth far more than extra lights, which only blow the
// page out further.
//
// STATE
// Each instance owns exactly one "mark" material (the ruled lines, the bars,
// the checkmark, the flap seam). That is the part that carries colour, so an
// object's state is legible without changing its form. Shells, outlines and
// geometry are shared across every instance to keep draw setup cheap.

import * as THREE from "three";

/* ---------------------------------------------------------------------------
 * state colours — the scene's vocabulary, not decoration.
 * Everything the viewer needs to infer about progress is carried here.
 * ------------------------------------------------------------------------ */
export const STATE = {
  neutral: 0xd4d0ca, // idle, untouched
  input: 0xb9b2a8,   // queued, entering the system (warm grey)
  process: 0xf6a86b, // being worked on (soft orange)
  active: 0xeb6217,  // executing right now (RTH orange)
  success: 0x3f9169, // completed — used only on real completion
  alert: 0xd08a1f,   // bottleneck / overdue / waiting — amber, only where earned
};

// Slightly off pure white: a pure-white object on a near-white page has no
// tonal separation left to give, whatever the lighting does.
const SHELL_WHITE = 0xdedad3;
const INK = 0x6b655d;

/**
 * Factory for business objects.
 *
 * @param geo tracking helper from the scene ({ track, trackMaterial, trackTexture })
 * @returns { build(kind), shell, pane, ink, kinds }
 */
export function createBusinessObjects(geo) {
  // ---- shared geometry cache ------------------------------------------
  const cache = {};
  const G = (key, make) => {
    if (!cache[key]) cache[key] = geo.track(make());
    return cache[key];
  };

  // One shell material for every object: white ceramic. Objects are told
  // apart by shape, not by body colour.
  const shell = new THREE.MeshPhysicalMaterial({
    color: SHELL_WHITE, metalness: 0.03, roughness: 0.34,
    clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.05,
  });
  geo.trackMaterial(shell);

  // Frosted variant for parts that should read as glass panes.
  const pane = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3,
    transparent: true, opacity: 0.55, depthWrite: false,
  });
  geo.trackMaterial(pane);

  // The silhouette line. Shared by every object in the scene.
  const ink = new THREE.LineBasicMaterial({
    color: INK, transparent: true, opacity: 0.9, depthWrite: false,
  });
  geo.trackMaterial(ink);

  const makeMark = () => {
    const m = new THREE.MeshStandardMaterial({
      color: STATE.neutral, emissive: STATE.neutral,
      emissiveIntensity: 0.2, roughness: 0.34, metalness: 0.05,
    });
    geo.trackMaterial(m);
    return m;
  };

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (w, h, d) => G("b" + w + "_" + h + "_" + d, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r, h, s = 16) => G("c" + r + "_" + h + "_" + s, () => new THREE.CylinderGeometry(r, r, h, s));
  const sph = (r, s = 12) => G("s" + r + "_" + s, () => new THREE.SphereGeometry(r, s, s));

  /* ---------------------------------------------------------------------
   * outlines — cached per source geometry, so a hundred invoices share one
   * edge buffer. Only hard-surface geometry gets an outline; a sphere or a
   * cone edge-extracts into noise rather than a silhouette.
   * ------------------------------------------------------------------ */
  const edgeCache = new WeakMap();
  const OUTLINEABLE = /Box|Cylinder|Plane/;
  const edgesFor = (g) => {
    let e = edgeCache.get(g);
    if (!e) {
      e = geo.track(new THREE.EdgesGeometry(g, 26));
      edgeCache.set(g, e);
    }
    return e;
  };

  /* ---------------------------------------------------------------------
   * glyph plates — currency and percent only. These are symbols, not labels:
   * one character each, carrying meaning the geometry genuinely cannot
   * (a money amount, a tax rate).
   * ------------------------------------------------------------------ */
  const glyphCache = {};
  const glyphMat = (char) => {
    if (glyphCache[char]) return glyphCache[char];
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#5f5a53";
    ctx.font = "700 " + Math.round(size * 0.78) + "px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, size / 2, size * 0.54);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    geo.trackTexture(tex);
    const m = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.92, depthWrite: false,
    });
    geo.trackMaterial(m);
    glyphCache[char] = m;
    return m;
  };
  const RUPEE = "₹";
  const glyph = (char, size) => new THREE.Mesh(
    G("gp" + size, () => new THREE.PlaneGeometry(size, size)),
    glyphMat(char),
  );

  /* ---------------------------------------------------------------------
   * builders — one per recognizable object
   * ------------------------------------------------------------------ */

  // A sheet of paper with ruled line items and a total bar. Portrait slab
  // with a folded corner, which is what makes it read as "document".
  // The line items are exposed as `rows` so an invoice can be seen to
  // ASSEMBLE line by line rather than simply appear whole.
  function document_(mark, { total = true, amount = false } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.5, 0.66, 0.028), shell));

    const fold = new THREE.Mesh(G("fold", () => new THREE.BoxGeometry(0.15, 0.15, 0.03)), pane);
    fold.position.set(0.175, 0.255, 0.008);
    fold.rotation.z = Math.PI / 4;
    g.add(fold);

    const rows = [];
    for (let i = 0; i < 4; i += 1) {
      const w = i === 3 ? 0.16 : 0.28 - (i % 2) * 0.05;
      const line = new THREE.Mesh(box(0.3, 0.028, 0.014), mark);
      line.scale.x = w / 0.3;
      line.position.set((0.3 - w) * -0.5 + 0.075 - 0.075, 0.11 - i * 0.1, 0.021);
      g.add(line);
      rows.push(line);
    }
    if (total) {
      const bar = new THREE.Mesh(box(0.24, 0.06, 0.016), mark);
      bar.position.set(0.09, -0.235, 0.022);
      g.add(bar);
      rows.push(bar);
    }
    if (amount) {
      const rupee = glyph(RUPEE, 0.17);
      rupee.position.set(-0.13, -0.235, 0.032);
      g.add(rupee);
    }
    g.userData.rows = rows;
    return g;
  }

  // Envelope: slab plus a V flap. The V is the whole recognition cue.
  function envelope(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.56, 0.38, 0.03), shell));
    [-1, 1].forEach((side) => {
      const flap = new THREE.Mesh(G("flap", () => new THREE.BoxGeometry(0.335, 0.026, 0.018)), mark);
      flap.position.set(side * 0.14, 0.055, 0.025);
      flap.rotation.z = side * -0.56;
      g.add(flap);
    });
    return g;
  }

  // Database / ledger: three stacked discs with visible gaps.
  function database(mark) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const disc = new THREE.Mesh(cyl(0.24, 0.11, 20), shell);
      disc.position.y = 0.16 - i * 0.15;
      g.add(disc);
      const band = new THREE.Mesh(cyl(0.246, 0.02, 20), mark);
      band.position.y = 0.16 - i * 0.15 - 0.058;
      g.add(band);
    }
    return g;
  }

  // Analytics: a base plate with bars of increasing height. Reads as a chart
  // from any angle, which a flat chart texture would not.
  function analytics(mark) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(box(0.56, 0.035, 0.34), shell);
    plate.position.y = -0.22;
    g.add(plate);
    [0.16, 0.3, 0.22, 0.44].forEach((h, i) => {
      const bar = new THREE.Mesh(box(0.09, 1, 0.09), i === 3 ? mark : shell);
      bar.scale.y = h;
      bar.position.set(-0.19 + i * 0.13, -0.2 + h / 2, 0);
      g.add(bar);
    });
    return g;
  }

  // Customer / CRM record: a card with a head-and-shoulders bust on it.
  function customer(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.46, 0.58, 0.028), shell));
    const head = new THREE.Mesh(sph(0.088, 14), mark);
    head.position.set(0, 0.13, 0.03);
    g.add(head);
    const torso = new THREE.Mesh(
      G("torso", () => new THREE.CylinderGeometry(0.15, 0.1, 0.16, 16, 1, false, 0, Math.PI)),
      mark,
    );
    torso.position.set(0, -0.045, 0.03);
    torso.rotation.x = -Math.PI / 2;
    g.add(torso);
    const line = new THREE.Mesh(box(0.26, 0.026, 0.014), shell);
    line.position.set(0, -0.2, 0.022);
    g.add(line);
    return g;
  }

  // Cloud: overlapping spheres with a flat underside.
  function cloud(mark) {
    const g = new THREE.Group();
    [[-0.16, -0.02, 0.13], [0.02, 0.06, 0.17], [0.19, -0.01, 0.12]].forEach(([x, y, r]) => {
      const puff = new THREE.Mesh(sph(r, 14), shell);
      puff.position.set(x, y, 0);
      g.add(puff);
    });
    const base = new THREE.Mesh(box(0.44, 0.08, 0.2), mark);
    base.position.y = -0.078;
    g.add(base);
    return g;
  }

  // Checkmark: two extruded strokes. Pure success signal.
  function check(mark) {
    const g = new THREE.Group();
    const short = new THREE.Mesh(box(0.17, 0.08, 0.08), mark);
    short.position.set(-0.09, -0.05, 0);
    short.rotation.z = -0.85;
    g.add(short);
    const long = new THREE.Mesh(box(0.36, 0.08, 0.08), mark);
    long.position.set(0.06, 0.03, 0);
    long.rotation.z = 0.72;
    g.add(long);
    return g;
  }

  // Calendar: page with a bound top edge and two rings.
  function calendar(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.46, 0.44, 0.03), shell));
    const header = new THREE.Mesh(box(0.46, 0.1, 0.036), mark);
    header.position.y = 0.17;
    g.add(header);
    [-0.13, 0.13].forEach((x) => {
      const ring = new THREE.Mesh(G("calring", () => new THREE.TorusGeometry(0.03, 0.012, 6, 12)), shell);
      ring.position.set(x, 0.235, 0);
      g.add(ring);
    });
    return g;
  }

  // Message bubble: rounded slab with a tail. Distinct from the envelope so
  // "email" and "message/WhatsApp" read as two different delivery routes.
  function message(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.5, 0.36, 0.03), shell));
    const tail = new THREE.Mesh(G("tail", () => new THREE.ConeGeometry(0.08, 0.15, 3)), shell);
    tail.position.set(-0.14, -0.23, 0);
    tail.rotation.z = 0.35;
    g.add(tail);
    for (let i = 0; i < 2; i += 1) {
      const line = new THREE.Mesh(box(0.3, 0.028, 0.014), mark);
      line.scale.x = i ? 0.62 : 1;
      line.position.set(i ? -0.06 : 0, 0.05 - i * 0.09, 0.022);
      g.add(line);
    }
    return g;
  }

  // Workflow: three linked nodes. Reads as "a process" rather than an object.
  function workflow(mark) {
    const g = new THREE.Group();
    const pts = [V(-0.19, 0.11, 0), V(0.17, 0.15, 0), V(0.02, -0.16, 0)];
    pts.forEach((p, i) => {
      const node = new THREE.Mesh(sph(0.07, 12), i === 0 ? mark : shell);
      node.position.copy(p);
      g.add(node);
    });
    [[0, 1], [1, 2]].forEach(([a, b]) => {
      const dir = pts[b].clone().sub(pts[a]);
      const link = new THREE.Mesh(G("link", () => new THREE.CylinderGeometry(0.018, 0.018, 1, 8)), mark);
      link.scale.y = dir.length();
      link.position.copy(pts[a]).addScaledVector(dir, 0.5);
      link.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
      g.add(link);
    });
    return g;
  }

  // Payment / transaction / order card, with a stripe and an amount block.
  function payment(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.62, 0.4, 0.028), shell));
    const stripe = new THREE.Mesh(box(0.62, 0.085, 0.034), mark);
    stripe.position.y = 0.105;
    g.add(stripe);
    const amount = new THREE.Mesh(box(0.22, 0.07, 0.016), mark);
    amount.position.set(-0.14, -0.11, 0.022);
    g.add(amount);
    const rupee = glyph(RUPEE, 0.16);
    rupee.position.set(0.15, -0.1, 0.032);
    g.add(rupee);
    return g;
  }

  // Approval / compliance gate: an upright frame the work must pass through,
  // with a status light on the lintel.
  function approval(mark) {
    const g = new THREE.Group();
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(box(0.055, 0.46, 0.055), shell);
      post.position.x = side * 0.21;
      g.add(post);
    });
    const lintel = new THREE.Mesh(box(0.47, 0.055, 0.055), shell);
    lintel.position.y = 0.205;
    g.add(lintel);
    const light = new THREE.Mesh(sph(0.06, 12), mark);
    light.position.y = 0.205;
    g.add(light);
    return g;
  }

  // Clock: the waiting signal. Only ever shown where work is stalled, so a
  // clock on screen always means "this step is costing time".
  function clock(mark) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(cyl(0.2, 0.055, 22), shell);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const bezel = new THREE.Mesh(G("bezel", () => new THREE.TorusGeometry(0.205, 0.022, 8, 24)), mark);
    g.add(bezel);
    const hour = new THREE.Mesh(box(0.022, 0.11, 0.022), mark);
    hour.position.set(0, 0.055, 0.035);
    g.add(hour);
    const minute = new THREE.Mesh(box(0.022, 0.16, 0.022), mark);
    minute.position.set(0.055, 0.02, 0.035);
    minute.rotation.z = -1.15;
    g.add(minute);
    g.userData.hands = [hour, minute];
    return g;
  }

  // Tax / GST plate. Used for exactly one step of the billing sequence, so
  // the symbol never has to compete for attention.
  function percent(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.42, 0.42, 0.05), shell));
    const edge = new THREE.Mesh(box(0.42, 0.06, 0.056), mark);
    edge.position.y = -0.18;
    g.add(edge);
    const sign = glyph("%", 0.3);
    sign.position.z = 0.032;
    g.add(sign);
    return g;
  }

  // Property: house profile. Box body with a four-sided pyramid roof — the
  // roof triangle is the recognition cue at any distance.
  function property(mark) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(0.42, 0.3, 0.34), shell);
    body.position.y = -0.09;
    g.add(body);
    const roof = new THREE.Mesh(G("roof", () => new THREE.ConeGeometry(0.34, 0.24, 4)), mark);
    roof.position.y = 0.18;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = new THREE.Mesh(box(0.12, 0.16, 0.02), mark);
    door.position.set(0, -0.16, 0.175);
    g.add(door);
    return g;
  }

  // Spreadsheet: a plate ruled into a grid. Distinct from `document` so
  // "manual spreadsheet work" and "a generated document" never look alike.
  function spreadsheet(mark) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(0.62, 0.46, 0.026), shell));
    const head = new THREE.Mesh(box(0.62, 0.09, 0.032), mark);
    head.position.y = 0.185;
    g.add(head);
    for (let i = 0; i < 2; i += 1) {
      const row = new THREE.Mesh(box(0.58, 0.014, 0.03), mark);
      row.position.set(0, 0.055 - i * 0.11, 0.014);
      g.add(row);
    }
    for (let i = 0; i < 2; i += 1) {
      const col = new THREE.Mesh(box(0.014, 0.3, 0.03), mark);
      col.position.set(-0.1 + i * 0.2, -0.03, 0.014);
      g.add(col);
    }
    return g;
  }

  // Inventory / stock: three crates. Reads as physical goods, not data.
  function inventory(mark) {
    const g = new THREE.Group();
    [[-0.14, -0.13], [0.14, -0.13], [0, 0.11]].forEach(([x, y], i) => {
      const crate = new THREE.Mesh(box(0.24, 0.22, 0.24), shell);
      crate.position.set(x, y, 0);
      g.add(crate);
      const strap = new THREE.Mesh(box(0.25, 0.03, 0.25), i === 2 ? mark : shell);
      strap.position.set(x, y + 0.02, 0);
      g.add(strap);
    });
    return g;
  }

  const BUILDERS = {
    invoice: (m) => document_(m, { total: true, amount: true }),
    document: (m) => document_(m, { total: false }),
    envelope,
    email: envelope,
    database,
    accounting: database,
    ledger: database,
    analytics,
    report: analytics,
    customer,
    crm: customer,
    lead: customer,
    cloud,
    check,
    calendar,
    schedule: calendar,
    message,
    whatsapp: message,
    workflow,
    automation: workflow,
    payment,
    transaction: payment,
    order: payment,
    pos: payment,
    approval,
    security: approval,
    compliance: approval,
    clock,
    percent,
    tax: percent,
    property,
    spreadsheet,
    inventory,
  };

  /**
   * Build one business object.
   * The returned setState drives colour only — never geometry — so an object
   * never changes identity, only status.
   */
  function build(kind) {
    const mark = makeMark();
    const make = BUILDERS[kind] || BUILDERS.workflow;
    const group = make(mark);
    group.userData.kind = kind;

    // Silhouette pass. Solid ceramic parts get an ink edge; mark parts do not
    // (they are already the high-contrast element), and curved parts are
    // skipped because their edge extraction is noise rather than a profile.
    const solids = [];
    group.traverse((child) => {
      if (child.isMesh && child.material === shell && OUTLINEABLE.test(child.geometry.type)) {
        solids.push(child);
      }
    });
    solids.forEach((mesh) => mesh.add(new THREE.LineSegments(edgesFor(mesh.geometry), ink)));

    const colour = new THREE.Color();
    let current = "neutral";

    const setState = (name, amount = 1) => {
      const target = STATE[name] ?? STATE.neutral;
      colour.setHex(target);
      mark.color.lerp(colour, amount);
      mark.emissive.lerp(colour, amount);
      // Only working and completed states actually emit; waiting objects stay
      // inert, so a lit object always means something is happening to it.
      const lit = name === "active" ? 1.05 : name === "process" ? 0.62
        : name === "success" ? 0.55 : name === "alert" ? 0.5 : 0.1;
      mark.emissiveIntensity += (lit - mark.emissiveIntensity) * amount;
      current = name;
    };

    setState("neutral", 1);
    return {
      group, setState, kind, mark,
      rows: group.userData.rows || null,
      hands: group.userData.hands || null,
      get state() { return current; },
    };
  }

  return { build, shell, pane, ink, kinds: Object.keys(BUILDERS) };
}
