// "What's slowing your business down?" — the pre-automation state.
//
// The problems section previously showed the same ecosystem as everywhere
// else, only dimmer. Dimmer is not a message. A viewer cannot infer "manual
// work is slow" from lower opacity.
//
// So this shows the actual failure mode, using the same recognizable objects
// the rest of the page uses:
//
//   * long kinked routes that cover very little ground for their length
//   * a hand-off marker at each kink, where the work physically STOPS
//   * a clock that appears only while something is stalled
//   * a duplicate that splits off at the middle hand-off and is re-keyed,
//     then merges back — the same record entered twice
//
// Nothing here is abstract and nothing is noise: every element is either a
// piece of work, a place work waits, or the time that waiting costs.
//
// At the end of the section the lanes bend toward the automation core and the
// stalled work starts moving into it, which is the hand-off into the rest of
// the story.

import * as THREE from "three";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => {
  const p = clamp01(t);
  return p * p * (3 - 2 * p);
};

// Where the work stops. Three hand-offs per lane: enough to read as "too many
// steps", few enough to stay countable.
const STOPS = [0.24, 0.5, 0.76];
const STOP_WIDTH = 0.075;
// How much of each stall is spent completely still.
const STALL_HOLD = 0.22;

const KINDS = ["invoice", "spreadsheet", "envelope", "document", "customer"];

export function createManualFlow(objects, mat, geo, { lanes = 5, tubular = 60, target } = {}) {
  const root = new THREE.Group();
  root.visible = false;

  const dest = target ? target.clone() : new THREE.Vector3(-3.5, -0.8, 0);

  const markerGeo = geo.track(new THREE.TorusGeometry(0.3, 0.045, 8, 18));
  const items = [];

  for (let i = 0; i < lanes; i += 1) {
    const y = 4.5 - i * 0.62;
    const z = -1.6 - (i % 2) * 0.9;
    // Deliberately wasteful: six control points to travel one screen width,
    // with vertical detours. The length of the path is the point.
    const pts = [
      new THREE.Vector3(-7.4, y, z + 0.5),
      new THREE.Vector3(-4.5, y + 0.5, z - 0.7),
      new THREE.Vector3(-1.8, y - 0.45, z + 0.9),
      new THREE.Vector3(1.2, y + 0.42, z - 0.5),
      new THREE.Vector3(4.2, y - 0.32, z + 0.7),
      new THREE.Vector3(7.3, y + 0.26, z - 0.2),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);

    const tube = new THREE.Mesh(
      geo.track(new THREE.TubeGeometry(curve, tubular, 0.012, 5, false)),
      mat.track,
    );
    root.add(tube);

    const markers = STOPS.map((u) => {
      const marker = new THREE.Mesh(markerGeo, mat.track);
      marker.position.copy(curve.getPointAt(u));
      marker.rotation.x = Math.PI / 2;
      root.add(marker);
      return marker;
    });

    const item = objects.build(KINDS[i % KINDS.length]);
    item.group.scale.setScalar(1.55);
    root.add(item.group);

    // The duplicate: the same record, keyed a second time at the middle
    // hand-off. Visible only across that hand-off, so it reads as rework
    // rather than as a second job.
    const dupe = objects.build(KINDS[i % KINDS.length]);
    dupe.group.visible = false;
    root.add(dupe.group);

    // One clock per lane, shown only while that lane's work is stopped.
    const clock = objects.build("clock");
    clock.group.scale.setScalar(0.001);
    clock.setState("alert", 1);
    root.add(clock.group);

    items.push({
      item, dupe, clock, curve, markers,
      t: (i * 0.19) % 1,
      speed: 0.028 + (i % 3) * 0.004,
      phase: i * 1.1,
      lane: i,
    });
  }

  const _p = new THREE.Vector3();
  const _q = new THREE.Vector3();

  /**
   * @param weight   0..1 how present the manual state is (the section weight)
   * @param converge 0..1 how far through "…and then RTH takes it over"
   */
  function update(elapsed, delta, weight, converge = 0) {
    root.visible = weight > 0.02;
    if (!root.visible) return;

    const mix = Math.min(1, delta * 2.4);
    const pull = smoothstep(converge);

    items.forEach((lane) => {
      // Progress crawls, and flattens almost to a stop at each hand-off. The
      // stall is produced by the motion itself, not by a colour change.
      let stalled = 0;
      STOPS.forEach((stop) => {
        const d = Math.abs(lane.t - stop);
        if (d < STOP_WIDTH) stalled = Math.max(stalled, 1 - d / STOP_WIDTH);
      });
      const crawl = 1 - stalled * (1 - STALL_HOLD);
      lane.t = (lane.t + delta * lane.speed * crawl * (1 - pull * 0.7)) % 1;

      lane.curve.getPointAt(clamp01(lane.t), _p);
      // Once RTH takes over, the whole lane bends toward the intake.
      _p.lerp(dest, pull * 0.85);

      lane.item.group.position.copy(_p);
      lane.item.group.rotation.y = -0.4 + Math.sin(elapsed * 0.3 + lane.phase) * 0.18;
      lane.item.group.rotation.z = Math.sin(elapsed * 0.4 + lane.phase) * 0.05;
      lane.item.group.scale.setScalar(1.55 * weight * (1 - pull * 0.45));
      // Amber only while actually stopped: the bottleneck marks itself, and
      // the same object goes cool again as soon as it moves.
      lane.item.setState(stalled > 0.35 ? "alert" : "input", mix);

      // The clock exists only while the work is waiting.
      const showClock = stalled * (1 - pull);
      lane.clock.group.position.copy(_p).add(_q.set(0.95, 0.8, 0.15));
      lane.clock.group.scale.setScalar(0.001 + showClock * 1.5);
      lane.clock.group.visible = showClock > 0.05;
      if (lane.clock.hands) {
        // hands sweep while the job sits there: time passing, nothing done
        lane.clock.hands[0].rotation.z = -elapsed * 0.5;
        lane.clock.hands[1].rotation.z = -elapsed * 2.4;
      }

      // The duplicate, across the middle hand-off only.
      const dupWindow = 1 - clamp01(Math.abs(lane.t - STOPS[1]) / 0.16);
      const showDupe = dupWindow * weight * (1 - pull);
      lane.dupe.group.visible = showDupe > 0.06;
      if (lane.dupe.group.visible) {
        lane.dupe.group.position.copy(_p).add(_q.set(-0.2, -1.0, 0.4));
        lane.dupe.group.rotation.y = 0.5;
        lane.dupe.group.scale.setScalar(1.55 * showDupe * 0.8);
        lane.dupe.setState("alert", mix);
      }

      // The hand-off markers brighten as work sits in them.
      lane.markers.forEach((marker, m) => {
        const near = 1 - clamp01(Math.abs(lane.t - STOPS[m]) / 0.12);
        marker.scale.setScalar(1 + near * 0.5);
        marker.visible = weight > 0.1 && pull < 0.85;
      });
    });
  }

  return { root, update, items };
}
