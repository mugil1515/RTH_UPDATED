// The RTH automation story, as a fixed timeline.
//
// WHY A TIMELINE MODULE
// The same eight beats have to drive three different consumers: the 3D scene,
// the 2D label overlay, and the offline frame renderer. Keeping the beat table
// in one place is what guarantees the desktop and mobile cuts tell the story on
// the same clock — the brief's requirement that both versions match in order
// and timing.
//
// Each beat carries its own ESTABLISH -> ACTION -> RESULT -> HOLD shape; the
// scene reads `local` (0..1 within the beat) and ramps sub-phases off it, so no
// stage ever animates everything at once.

export const BEATS = [
  { key: "input",    label: "BUSINESS INPUT",   start: 0.0,  end: 5.6 },
  { key: "core",     label: "RTH INTELLIGENCE", start: 5.6,  end: 10.6 },
  { key: "process",  label: "PROCESSING",       start: 10.6, end: 16.0 },
  { key: "decision", label: "DECISION",         start: 16.0, end: 21.0 },
  { key: "execute",  label: "EXECUTE",          start: 21.0, end: 26.2 },
  { key: "action",   label: "AUTOMATED ACTION", start: 26.2, end: 31.4 },
  { key: "update",   label: "SYSTEM UPDATE",    start: 31.4, end: 36.6 },
  { key: "complete", label: "COMPLETE",         start: 36.6, end: 41.0 },
];

export const DURATION = BEATS[BEATS.length - 1].end;
export const FPS = 30;

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (x) => x * x * (3 - 2 * x);
/** Eased 0..1 ramp as `x` crosses [a, b]. The scene's only timing primitive. */
export const ramp = (x, a, b) => smoothstep(clamp01((x - a) / (b - a || 1)));
/** Rises over [a,b], holds, falls over [c,d]. Used for anything transient. */
export const pulse = (x, a, b, c, d) => ramp(x, a, b) * (1 - ramp(x, c, d));

/**
 * Beat state at time `t`.
 * `local` is progress inside the active beat; `at(key)` gives any beat's own
 * progress so a stage can start settling while the next one establishes.
 */
export function beatsAt(t) {
  const out = { t, index: 0, key: BEATS[0].key, local: 0 };
  const at = {};
  BEATS.forEach((b, i) => {
    const p = clamp01((t - b.start) / (b.end - b.start));
    at[b.key] = p;
    if (t >= b.start && (t < b.end || i === BEATS.length - 1)) {
      out.index = i;
      out.key = b.key;
      out.local = p;
    }
  });
  out.at = at;
  return out;
}
