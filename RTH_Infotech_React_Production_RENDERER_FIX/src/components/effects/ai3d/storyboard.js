// Scroll storyboard for the RTH automation background.
//
// Split out of ThreeBackground.jsx so the narrative mapping -- which section
// shows which beat -- is plain data and pure functions that can be verified
// on their own, rather than being buried in a component that needs React,
// WebGL and a live DOM to run.
//
// Nothing here touches the renderer, the scroll system or the DOM beyond
// reading section geometry.

import { STAGE_A_Y, STAGE_B_Y, STAGE_C_Y } from "@/components/effects/ai3d/automationScene";

// The camera descends through the automation environment as the page scrolls:
// Stage A (y 0) -> Stage B (y -12) -> Stage C (y -24).
//
// WHY THESE ANCHOR TO SECTIONS RATHER THAN SCROLL PERCENTAGES
// Keyframes used to be pinned to fixed fractions of total document scroll
// (p: 0.52 and so on). That only lines up with the content by coincidence:
// the sections have very different heights, #services is pinned and long, and
// every one of those numbers shifts with viewport height, content changes and
// pin length. The result was a story that drifted out of sync with the copy it
// was supposed to be illustrating.
//
// Each key now names the section it belongs to plus where within it the shot
// should land, and the real progress values are measured at ScrollTrigger
// refresh. So the billing engine runs during #billing, by construction.
//
// This reads section geometry only. It adds no pin, no scrub and no scroll
// length -- scroll speed and pinned sections are untouched.
// Framing rule for every key below: the machine that the section is about must
// be whole in shot and roughly half the frame width, so its silhouette can be
// read, with the other half left clear for the copy. No key spins the scene;
// the camera only dollies, rises and settles (brief §18).
export const CAMERA_KEYS = [
  // A: the automation core, whole and square on, so INPUT -> PROCESS -> OUTPUT
  // is legible from the very first frame
  { at: "hero", align: 0.35, pos: [0, STAGE_A_Y + 3.6, 14.4], look: [0, STAGE_A_Y + 0.5, 0] },
  // back and up to take in the manual hand-off lanes behind the machine
  { at: "problems", align: 0.5, pos: [-1.4, STAGE_A_Y + 4.4, 16.2], look: [0, STAGE_A_Y + 1.6, -1.8] },
  // in closer and level: the connected systems and their rails into the core
  { at: "services", align: 0.5, pos: [0.4, STAGE_A_Y + 2.6, 13.4], look: [0, STAGE_A_Y + 0.5, 0] },
  // descend to the processing hub, framed on the billing line in front of it
  { at: "billing", align: 0.5, pos: [0.5, STAGE_B_Y + 2.6, 12.8], look: [0.4, STAGE_B_Y - 0.5, 1.6] },
  // the execution shot: trigger, control and the systems it updates
  { at: "agent", align: 0.5, pos: [1.3, STAGE_B_Y + 2.4, 13.0], look: [1.0, STAGE_B_Y + 0.1, 1.8] },
  // drop to the business network and widen for the industry ring
  { at: "industries", align: 0.5, pos: [-1.0, STAGE_C_Y + 2.8, 13.8], look: [0, STAGE_C_Y + 0.1, 0] },
  // lower, so the described pipeline sits under the form rather than behind it
  { at: "analyzer", align: 0.5, pos: [0.6, STAGE_C_Y + 2.0, 13.8], look: [0, STAGE_C_Y - 1.4, 2.0] },
  // settled and stable
  { at: "company", align: 0.5, pos: [-0.7, STAGE_C_Y + 2.9, 14.6], look: [0, STAGE_C_Y - 0.1, 0] },
  // final wide: the whole connected system, form kept clear
  { at: "contact", align: 0.5, pos: [0, STAGE_C_Y + 3.2, 15.8], look: [0, STAGE_C_Y - 0.1, 0] },
];

// Story beats, expressed as "rise between these two section points, and
// optionally fall again between these two". Same reasoning as the camera: the
// billing engine should run during the billing copy, not at 42% of the page.
// These are now only the CONNECTIVE beats — the things that span sections
// rather than belonging to one. Everything that tells a story inside a single
// section is driven by that section's own weight instead, which is what lets
// each sequence finish before the next one starts (brief §16).
export const BEAT_KEYS = [
  // Business data is already flowing when the page opens, so this beat has a
  // base level rather than ramping from zero. The hero is the first section,
  // so its centre resolves to progress 0 - without a base the intake funnel
  // would be invisible at exactly the moment the hero is on screen, and the
  // opening beat of the whole narrative would never be seen.
  { key: "intake", base: 0.55, rise: [["hero", 0.4], ["problems", 0.4]] },
  { key: "nodes", rise: [["hero", 0.6], ["problems", 0.6]] },
  // the A -> B -> C conduit, which exists between the stages by definition
  { key: "stream", rise: [["problems", 0.8], ["billing", 0.3]] },
];

// Per-section character for the same continuous system, blended with a GSAP
// tween on entry so the scene eases between states rather than switching.
//   energy - how lit and active the cores and accents are
//   spread - orbit ring radius: tight core vs. wide distributed network
//   calm   - damping on all idle motion
//   veil   - how far the fine supporting detail (tracks, threads, outlines,
//            particles) is pulled back. Highest where the section's own copy
//            or form is the subject and the background must not compete
//            with it (brief §22); lowest where the 3D IS the demonstration.
export const SECTION_MOODS = [
  { id: 'hero', energy: 1, spread: 0.95, calm: 0.12, veil: 0.18 },
  { id: 'problems', energy: 0.72, spread: 1.15, calm: 0.4, veil: 0.22 },
  { id: 'services', energy: 1, spread: 1.05, calm: 0.08, veil: 0.2 },
  { id: 'billing', energy: 0.95, spread: 0.88, calm: 0.15, veil: 0.35 },
  { id: 'agent', energy: 1, spread: 0.92, calm: 0.04, veil: 0.28 },
  { id: 'industries', energy: 0.75, spread: 1.2, calm: 0.3, veil: 0.45 },
  // the form is the subject here, so the scene goes quietest of all
  { id: 'analyzer', energy: 0.55, spread: 0.8, calm: 0.6, veil: 0.62 },
  { id: 'company', energy: 0.6, spread: 0.82, calm: 0.85, veil: 0.5 },
  { id: 'contact', energy: 0.9, spread: 0.95, calm: 0.5, veil: 0.4 },
];

const mix = (a, b, t) => a + (b - a) * t;
const mixVec = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);
// Clamped variant for the beat gates, whose inputs run past both ends.
export const ramp01 = (x, a, b) => smoothstep(clamp01((x - a) / (b - a || 1)));
export const smootherstep = (t) => {
  const p = clamp01(t);
  return p * p * p * (p * (p * 6 - 15) + 10);
};

/**
 * Progress value at which `align` through the given section sits at the middle
 * of the viewport, in the same 0..1 space as the document ScrollTrigger.
 * Returns null when the section is not on this page.
 */
export function sectionProgress(id, align, maxScroll) {
  const element = document.getElementById(id);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const top = rect.top + (window.scrollY || window.pageYOffset || 0);
  return clamp01((top + rect.height * align - window.innerHeight / 2) / (maxScroll || 1));
}

/** Resolve the section-anchored keys into concrete progress values. */
export function resolveCameraPath(maxScroll) {
  const path = [];
  CAMERA_KEYS.forEach((key) => {
    const p = sectionProgress(key.at, key.align, maxScroll);
    if (p === null) return;
    path.push({ p, pos: key.pos, look: key.look });
  });
  if (path.length < 2) return null;
  path.sort((a, b) => a.p - b.p);
  // Extend to the full range so the ends of the page are never extrapolated.
  path[0] = { ...path[0], p: 0 };
  path[path.length - 1] = { ...path[path.length - 1], p: 1 };
  return path;
}

export function resolveBeats(maxScroll) {
  const resolved = [];
  BEAT_KEYS.forEach((beat) => {
    const r0 = sectionProgress(beat.rise[0][0], beat.rise[0][1], maxScroll);
    const r1 = sectionProgress(beat.rise[1][0], beat.rise[1][1], maxScroll);
    if (r0 === null || r1 === null) return;
    const entry = { key: beat.key, r0, r1, base: beat.base || 0 };
    if (beat.fall) {
      const f0 = sectionProgress(beat.fall[0][0], beat.fall[0][1], maxScroll);
      const f1 = sectionProgress(beat.fall[1][0], beat.fall[1][1], maxScroll);
      if (f0 !== null && f1 !== null) { entry.f0 = f0; entry.f1 = f1; }
    }
    resolved.push(entry);
  });
  return resolved;
}

/**
 * Evaluate every resolved beat at a given scroll progress into `out`.
 * Kept here rather than in the render loop so the storyboard stays verifiable
 * as pure data in / data out.
 */
export function evaluateBeats(beatPath, progress, out = {}) {
  for (let i = 0; i < beatPath.length; i += 1) {
    const bt = beatPath[i];
    let value = bt.base + (1 - bt.base) * ramp01(progress, bt.r0, bt.r1);
    if (bt.f0 !== undefined) value *= 1 - ramp01(progress, bt.f0, bt.f1);
    out[bt.key] = value;
  }
  return out;
}

export function sampleCamera(path, progress) {
  const p = clamp01(progress);
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    if (p >= start.p && p <= end.p) {
      const local = smoothstep(clamp01((p - start.p) / (end.p - start.p || 1)));
      return { pos: mixVec(start.pos, end.pos, local), look: mixVec(start.look, end.look, local) };
    }
  }
  const last = path[path.length - 1];
  return { pos: last.pos, look: last.look };
}

// Used until the first measurement lands, and on pages with no known sections.
export const FALLBACK_PATH = [
  { p: 0, pos: CAMERA_KEYS[0].pos, look: CAMERA_KEYS[0].look },
  { p: 1, pos: CAMERA_KEYS[CAMERA_KEYS.length - 1].pos, look: CAMERA_KEYS[CAMERA_KEYS.length - 1].look },
];


/* ===========================================================================
 * SERVICE DETAIL ROUTES  (/services/:slug)
 *
 * These pages render none of Home's sections, so everything above resolves to
 * nothing on them: resolveCameraPath() finds no anchors and falls back to
 * FALLBACK_PATH, which runs the hero key -> the contact key, i.e. it walks the
 * camera from Stage A (y 0) down to Stage C (y -24) as the visitor scrolls.
 * At the same time the section weights never move, because the triggers that
 * move them are bound to elements that only exist on Home — so `hero` stays at
 * 1 and only Stage A is ever switched on.
 *
 * The two together are why the lower half of a service page rendered as a
 * plain white sheet: measured live, the camera sat at y = -20.7 while the only
 * lit geometry was twenty world units above it. Nothing was faint; there was
 * nothing in frame at all.
 *
 * So service pages get their own short storyboard. It stays inside Stage A —
 * the stage that already holds the legacy -> transform -> connected story —
 * and dollies and rises instead of descending.
 * ======================================================================== */

// No yaw in any key: the composition is placed by translating the scene group
// into the empty half of the page (see `framing.serviceX` in
// ThreeBackground.jsx), which is deterministic, rather than by aiming the
// camera off-centre, which drags the far modules out of frame with it.
// Every key obeys the same framing rule as CAMERA_KEYS above: the machine is
// whole in shot and about half the frame wide, with the other half left clear
// for the copy. Distances are further out than they first appear they need to
// be, because the manual/legacy lanes are 15 world units across — pulling in
// far enough to make the core large cropped the legacy half of the very story
// the hero is supposed to be telling (brief §3).
export const SERVICE_CAMERA_PATH = [
  // hero — closest of the three, the whole legacy -> connected span in frame
  { p: 0, pos: [0, STAGE_A_Y + 2.8, 15.2], look: [0, STAGE_A_Y + 0.7, 0] },
  // capabilities / engineering tools — up and back, the connected network
  // spread around the edges of the card band
  { p: 0.45, pos: [0, STAGE_A_Y + 3.6, 16.6], look: [0, STAGE_A_Y + 0.8, 0] },
  // delivery process / footer — settle lower and closer again
  { p: 1, pos: [0, STAGE_A_Y + 1.7, 15.0], look: [0, STAGE_A_Y - 0.3, 0.4] },
];

// Bright and barely veiled: a service page has no competing 3D story, and the
// content-safe scrim in AppBackground.jsx does the readability work locally
// rather than by dimming the whole scene (brief §1).
export const SERVICE_MOOD = { energy: 1, spread: 1.02, calm: 0.1, veil: 0.06 };

/**
 * Section weights and beat gates for a service detail page, from its own
 * scroll progress. Pure data in / data out, like everything else here.
 *
 * The blend is the point. Stage A holds all three halves of the story at once
 * — the stalled manual lanes, the machine, and the connected systems — and
 * which of them you see is decided by these weights, so the page can open on
 * "fragmented" and resolve to "connected" without a second scene:
 *
 *   top     problems high, services low   legacy lanes stalled at their
 *                                         hand-offs, systems scattered
 *   middle  crossfade                     the lanes bend into the core
 *   bottom  services high                 the connected ecosystem, lighting
 *                                         one module at a time
 *
 * `hero` stays part-on throughout so the core itself never stops running.
 * billing/agent/industries/analyzer/company/contact are pinned to 0: they
 * belong to Stages B and C, which have no place on this route and whose
 * being switched on is what would put the camera back over empty space.
 */
export function serviceStage(progress, sections = {}, beats = {}) {
  const p = clamp01(progress);
  // The transformation itself, as one eased crossfade across the page.
  const connect = smoothstep(clamp01((p - 0.1) / 0.55));

  sections.hero = 0.9 - connect * 0.32;
  sections.problems = 0.58 * (1 - connect * 0.8);
  // Kept below 0.2 at the top on purpose: `converge` in automationScene is
  // services * 1.4, and anything higher would bend the legacy lanes into the
  // core while the hero is still claiming they are fragmented.
  sections.services = 0.18 + connect * 0.82;
  sections.billing = 0;
  sections.agent = 0;
  sections.industries = 0;
  sections.analyzer = 0;
  sections.company = 0;
  sections.contact = 0;

  beats.intake = 0.72 + connect * 0.28;
  beats.nodes = 0.36 + connect * 0.54;
  // The A -> B -> C conduit leads to two stages that are switched off here, so
  // running it would draw a bright ribbon into nothing.
  beats.stream = 0;

  return { sections, beats };
}
