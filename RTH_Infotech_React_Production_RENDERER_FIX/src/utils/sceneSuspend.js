// Refcounted "the page's live visuals are not being looked at" switch.
//
// WHY THIS EXISTS
// The site runs one three.js render loop and one Lenis RAF pump, both at
// display rate, both permanently. That is the right cost while someone is
// reading the page. It is pure waste the moment an opaque full-screen overlay
// covers it — and worse than waste, because the thing on top (a 1080p video)
// then competes with them for the same frame budget and the same GPU. The
// stutter in the story viewer is that competition.
//
// Suspending, not tearing down: the scene keeps its context, its baked
// environment and its scroll-mapped state, so resuming costs one frame rather
// than a rebuild. Refcounted because more than one overlay may hold it and
// they must not un-suspend each other.

const EVENT = "rth:scene-suspend-change";
let depth = 0;

/** True while at least one caller holds a suspension. */
export function isSceneSuspended() {
  return depth > 0;
}

function emit() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { suspended: depth > 0 } }));
}

/** Take a suspension. Returns the matching release; safe to call twice. */
export function suspendScene() {
  depth += 1;
  if (depth === 1) emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0) emit();
  };
}

/** Subscribe to changes. Returns an unsubscribe. */
export function onSceneSuspendChange(handler) {
  const listener = (e) => handler(e.detail.suspended);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
