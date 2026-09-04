// Two compositions of ONE story.
//
// The brief's hardest rule is that mobile must not be a crop or a zoom of
// desktop, and must not drop a single stage. So the world itself is authored
// twice — same objects, same beats, same order, different placement and camera.
// Desktop spreads the story left -> centre -> right across 16:9; mobile stacks
// it top -> centre -> bottom down 9:16 and reframes per beat so each stage is
// large enough to read without anything leaving the safe area.

const DESKTOP = {
  variant: "desktop",
  width: 1920,
  height: 1080,
  fov: 34,
  labelScale: 1,

  // Where incoming business data is born, and the point it aims for.
  coreEntry: [-1.35, 0.05, 0],
  inputs: [
    { kind: "invoice",  from: [-9.6, 3.5, 1.2],  bend: [-5.2, 2.6, 2.0] },
    { kind: "email",    from: [-9.9, 1.3, -0.8], bend: [-5.0, 1.0, 0.4] },
    { kind: "customer", from: [-10.2, -0.9, 1.6], bend: [-5.4, -0.6, 1.4] },
    { kind: "payment",  from: [-9.4, -2.9, -0.4], bend: [-4.9, -1.9, 0.2] },
    { kind: "database", from: [-10.4, -4.6, 0.9], bend: [-5.6, -3.1, 1.0] },
  ],
  inputScale: 1.25,

  routeStart: [1.6, 0.05, 0],
  // Decision routes leave the core and spread horizontally.
  routes: [
    { to: [7.2, 3.4, -0.6], bend: [3.6, 2.8, 0.6] },
    { to: [7.8, 0.1, 0.2],  bend: [3.9, 1.0, 0.8] },
    { to: [7.2, -3.2, -0.6], bend: [3.6, -2.6, 0.6] },
  ],
  chosenRoute: 1,

  // The control the hand presses, and where the hand comes in from.
  button: [2.35, -2.05, 1.35],
  // The hand descends from above right rather than sliding in flat: from a
  // low side angle the palm hides the fingers, and the forearm reads as a rod.
  handFrom: [8.4, 3.6, 5.6],

  // Executed work lands in the right zone.
  actions: [
    { kind: "invoice",  to: [3.9, 2.4, 0.8] },
    { kind: "envelope", to: [7.3, 1.2, 0.2] },
    { kind: "calendar", to: [3.8, -1.8, 1.0] },
    { kind: "workflow", to: [7.4, -2.4, 0.3] },
  ],
  actionScale: 1.5,

  // Connected systems, spread wide enough to stay individually readable.
  modules: [
    { kind: "crm",        at: [-6.4, 3.3, -1.2] },
    { kind: "email",      at: [-7.8, -0.6, -0.6] },
    { kind: "accounting", at: [-7.4, -2.9, -1.0] },
    { kind: "calendar",   at: [6.2, -3.9, -1.0] },
    { kind: "analytics",  at: [7.6, 2.0, -0.8] },
  ],
  moduleScale: 2.3,

  // pos / target per beat. Movement stays to slight dolly + small lateral
  // shifts: the viewer must never lose where the core is.
  camera: {
    input:    { pos: [-2.6, 1.1, 15.4], tgt: [-3.0, 0.3, 0], dolly: -1.2 },
    core:     { pos: [0.7, 1.0, 11.6],  tgt: [0.0, 0.2, 0],  dolly: -1.0 },
    process:  { pos: [0.2, 0.5, 9.4],   tgt: [0.0, 0.1, 0],  dolly: -0.5 },
    decision: { pos: [2.4, 0.7, 13.6],  tgt: [2.6, 0.2, 0],  dolly: -0.8 },
    execute:  { pos: [3.9, 1.5, 9.8],   tgt: [2.7, -1.4, 0.9], dolly: -0.8 },
    action:   { pos: [3.6, 0.3, 13.0],  tgt: [3.6, 0.0, 0],  dolly: -0.7 },
    update:   { pos: [0.3, 0.2, 16.6],  tgt: [0.0, 0.1, 0],  dolly: -0.6 },
    complete: { pos: [0.0, 0.4, 17.4],  tgt: [0.0, 0.0, 0],  dolly: -0.9 },
  },
};

const MOBILE = {
  variant: "mobile",
  width: 1080,
  height: 1920,
  fov: 44,
  labelScale: 1.5,

  coreEntry: [0, 1.5, 0],
  // Vertical staging: invoice -> email -> customer -> transaction -> database,
  // falling into the core from above. Nothing starts off-frame sideways.
  inputs: [
    { kind: "invoice",  from: [-1.7, 6.2, 0.6],  bend: [-1.1, 4.2, 0.8] },
    { kind: "email",    from: [1.7, 7.4, -0.4],  bend: [1.0, 4.6, 0.2] },
    { kind: "customer", from: [-0.4, 8.6, 1.0],  bend: [-0.3, 5.2, 1.0] },
    { kind: "payment",  from: [1.8, 9.8, 0.2],   bend: [1.2, 5.8, 0.4] },
    { kind: "database", from: [-1.9, 11.0, -0.6], bend: [-1.3, 6.4, 0.0] },
  ],
  inputScale: 1.3,

  routeStart: [0, -1.6, -0.2],
  // Routes fan downward so all three stay inside 9:16, and run BEHIND the deck
  // rather than through it and across the control the hand is about to press.
  routes: [
    { to: [-2.0, -5.6, -1.1], bend: [-1.4, -3.0, -0.7] },
    { to: [0.0, -6.3, -1.1],  bend: [0.0, -3.4, -0.7] },
    { to: [2.0, -5.6, -1.1],  bend: [1.4, -3.0, -0.7] },
  ],
  chosenRoute: 1,

  button: [0, -2.55, 1.35],
  handFrom: [3.4, 2.6, 4.8],

  actions: [
    { kind: "invoice",  to: [-1.7, -4.2, 0.6] },
    { kind: "envelope", to: [1.7, -4.2, 0.6] },
    { kind: "calendar", to: [-1.7, -6.5, 0.4] },
    { kind: "workflow", to: [1.7, -6.5, 0.4] },
  ],
  actionScale: 1.55,

  //       CRM
  //        |
  // Email—RTH—Accounting
  //        |
  //   Analytics / Follow-up
  modules: [
    { kind: "crm",        at: [0.0, 4.5, -0.8] },
    { kind: "email",      at: [-2.9, 1.7, -0.6] },
    { kind: "accounting", at: [2.9, 1.7, -0.6] },
    { kind: "analytics",  at: [-2.6, -4.3, -0.8] },
    { kind: "calendar",   at: [2.6, -4.3, -0.8] },
  ],
  moduleScale: 2.0,

  camera: {
    input:    { pos: [0.0, 3.6, 14.4],  tgt: [0.0, 3.0, 0],  dolly: -1.4 },
    core:     { pos: [0.0, 0.9, 10.4],  tgt: [0.0, 0.3, 0],  dolly: -0.9 },
    process:  { pos: [0.0, 0.3, 8.8],   tgt: [0.0, 0.1, 0],  dolly: -0.5 },
    decision: { pos: [0.0, -2.1, 12.4], tgt: [0.0, -2.4, 0], dolly: -0.7 },
    execute:  { pos: [1.3, -0.9, 13.0], tgt: [0.9, -2.7, 0.4], dolly: -0.6 },
    action:   { pos: [0.0, -4.2, 12.0], tgt: [0.0, -4.4, 0], dolly: -0.7 },
    update:   { pos: [0.0, 0.3, 17.2],  tgt: [0.0, 0.2, 0],  dolly: -0.6 },
    complete: { pos: [0.0, 0.3, 18.2],  tgt: [0.0, 0.1, 0],  dolly: -0.8 },
  },
};

export function getLayout(variant) {
  return variant === "mobile" ? MOBILE : DESKTOP;
}
