import { gsap, ScrollTrigger } from "@/animations/gsapConfig";
import { getServicePosition } from "@/utils/servicePosition";

const RADIUS = 37; // must match the radius used in ServiceUniverse's getOrbitPoint/getSvgOrbitPoint calls

export function mountServiceOrbit(root, hintEl, { compact = false } = {}) {
  const onEnter=()=>{gsap.to(speed,{value:.28,duration:.5,ease:"power2.out",overwrite:true,onUpdate:applySpeed})};
  const onLeave=()=>{gsap.to(speed,{value:1,duration:.5,ease:"power2.out",overwrite:true,onUpdate:applySpeed})};
  const speed={value:1};
  const applySpeed=()=>{spin?.timeScale(speed.value);counter?.timeScale(speed.value)};
  let spin; let counter;
  // Assigned inside the context below; torn down in the outer cleanup because
  // ctx.revert() reverts GSAP state, not a ResizeObserver subscription.
  let removeRefreshListener;

  const ctx = gsap.context(() => {
    const rotor = root.querySelector(".service-rotor");
    const orbitNodes = gsap.utils.toArray(".service-node", root);
    const nodeCount = orbitNodes.length;
    // Per frame, this writes only the outward DIRECTION for each label; the
    // distance is derived in CSS from that direction and the label's own box
    // (see `--label-push` in animations.css). Splitting it that way is what
    // makes the spacing correct at every angle: the ring turns continuously,
    // so a single flat push distance is either too short where the label's
    // full width faces the icon (sideways) or far too long where only its
    // height does (top and bottom) — and the too-long case is what let a
    // label climb out of the orbit box and collide with the CLICK / TAP hint
    // sitting above it.
    const updateLabelDirections = () => {
      const rotation = Number(gsap.getProperty(rotor, "rotation")) || 0;
      orbitNodes.forEach((node) => {
        const index = Number(node.dataset.index);
        const base = getServicePosition(index, nodeCount, RADIUS);
        const radians = ((base.angle + rotation) * Math.PI) / 180;
        const label = node.querySelector(".service-label");
        if (!label) return;
        const ux = Math.cos(radians);
        const uy = Math.sin(radians);
        label.style.setProperty("--ux", ux.toFixed(4));
        label.style.setProperty("--uy", uy.toFixed(4));
        label.style.setProperty("--ax", Math.abs(ux).toFixed(4));
        label.style.setProperty("--ay", Math.abs(uy).toFixed(4));
      });
    };

    // The push needs each label's real rendered height, and a label is one,
    // two or three lines depending on its text and how wide the container has
    // made it. That is a layout read, so it must not happen per frame — but it
    // also must not go stale, because a push computed from a stale height is
    // exactly a label sitting in the wrong place.
    //
    // A ResizeObserver is the right instrument: it fires only when a label's
    // box actually changes, which is precisely when the number is wrong, and
    // it does not depend on some other system remembering to refresh. There is
    // no feedback loop — --label-h feeds --label-push, which feeds `transform`
    // only, and a transform does not change the observed box.
    const labelObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const height = entry.target.offsetHeight;
        if (height) entry.target.style.setProperty("--label-h", `${height}px`);
      });
    });
    orbitNodes.forEach((node) => {
      const label = node.querySelector(".service-label");
      if (!label) return;
      if (label.offsetHeight) label.style.setProperty("--label-h", `${label.offsetHeight}px`);
      labelObserver.observe(label);
    });

    updateLabelDirections();
    removeRefreshListener = () => labelObserver.disconnect();
    // The endless orbit rotation is decorative, and it is the one piece of
    // motion on this page that never stops on its own — the CSS
    // prefers-reduced-motion block can't reach it because it is driven by GSAP.
    // Under a reduced-motion preference the orbit is simply laid out and left
    // still; every node, label and connector stays exactly where it is, so the
    // section reads and behaves identically.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      spin = gsap.to(".service-rotor", { rotation: 360, duration: 90, repeat: -1, ease: "none", transformOrigin: "50% 50%", onUpdate: updateLabelDirections });
      counter = gsap.to(".service-node-content", { rotation: -360, duration: 90, repeat: -1, ease: "none", transformOrigin: "50% 50%" });
    }

    if (compact || !hintEl) {
      // Compact usage (e.g. the standalone /services page hero) keeps a simple
      // scroll-triggered reveal -- no scroll-scrubbed emergence sequence.
      gsap.fromTo(".service-core", { opacity: 0, scale: .82 }, { opacity: 1, scale: 1, duration: .7, ease: "power3.out", scrollTrigger: { trigger: root, start: "top 75%" } });
      gsap.fromTo(".service-node", { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .55, stagger: .05, ease: "power3.out", scrollTrigger: { trigger: root, start: "top 72%" } });
      gsap.fromTo(".service-connector", { opacity: 0 }, { opacity: .28, duration: .7, stagger: .04, scrollTrigger: { trigger: root, start: "top 72%" } });
      root.classList.add("orbit-stable");
      return;
    }

    const orbitEl = root.querySelector(".service-orbit");
    const nodes = gsap.utils.toArray(".service-node", root);
    const count = nodes.length;
    const nodeByIndex = {};
    nodes.forEach((node) => { nodeByIndex[node.dataset.index] = node; });
    const lineByIndex = {};
    gsap.utils.toArray(".service-connector", root).forEach((line) => { lineByIndex[line.dataset.index] = line; });

    // Each node's outward travel offset (in px, from the core center to its
    // orbit slot) is derived live from the orbit's *current* rendered box, so
    // it stays correct across resize/orientation change (invalidateOnRefresh).
    const nodeOffset = (index) => {
      const rect = orbitEl.getBoundingClientRect();
      const p = getServicePosition(index, count, RADIUS);
      return { x: (p.ux * RADIUS) / 100 * rect.width, y: (p.uy * RADIUS) / 100 * rect.height };
    };

    gsap.set(".service-core", { opacity: 0, scale: .82 });
    gsap.set(hintEl, { opacity: 0 });

    // The Core's entrance is a normal scrub tween tied to the section's own
    // natural scroll-in -- nothing is pinned. Finish the entrance slightly
    // before the orbit reaches the viewport centre so the section never
    // looks empty to someone scrolling at a normal pace.
    gsap.fromTo(".service-core",
      { opacity: 0, scale: .82 },
      {
        opacity: 1, scale: 1, ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top bottom", end: "center 62%", scrub: .55 },
      });

    // Reveal timeline: fully TIME-based, not scroll-scrubbed. Built once
    // here (paused), then played exactly once the moment the Core reaches
    // center (see the trigger below) -- from that point on it runs on its
    // own regardless of further scroll.
    //   node travels center -> orbit slot (scale .28/opacity 0 -> 1/1)
    //   connector grows alongside it (same start time, same duration)
    //   label fades in only once the node is ~85% of the way to its slot
    //   each service starts STAGGER seconds after the previous one
    //   hint fades in only after the very last label has settled
    const NODE_DURATION = .55;
    const STAGGER = .07;
    const revealTl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
      onComplete: () => root.classList.add("orbit-stable"),
    });

    for (let i = 0; i < count; i += 1) {
      const node = nodeByIndex[i];
      if (!node) continue;
      const label = node.querySelector(".service-label");
      const line = lineByIndex[i];
      const start = i * STAGGER;

      revealTl.fromTo(node,
        { x: () => -nodeOffset(i).x, y: () => -nodeOffset(i).y, scale: .28, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: NODE_DURATION },
        start);

      if (line) {
        const len = line.getTotalLength();
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len, opacity: .28 });
        revealTl.fromTo(line, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: NODE_DURATION }, start);
      }

      if (label) revealTl.fromTo(label, { opacity: 0 }, { opacity: 1, duration: NODE_DURATION * .3, ease: "power1.out" }, start + NODE_DURATION * .85);
    }

    revealTl.fromTo(hintEl, { opacity: 0 }, { opacity: 1, duration: .3, ease: "power1.out" });

    // Explicitly force every node/label/connector back to its hidden,
    // at-Core state -- NOT the same as revealTl.pause(0), which would only
    // reset whichever child tweens happen to already have their start time
    // at/after 0 and leave the rest sitting at their finished ("to") state.
    const resetReveal = () => {
      gsap.ticker.remove(driveReveal);
      for (let i = 0; i < count; i += 1) {
        const node = nodeByIndex[i];
        if (!node) continue;
        const label = node.querySelector(".service-label");
        const line = lineByIndex[i];
        const offset = nodeOffset(i);
        gsap.set(node, { x: -offset.x, y: -offset.y, scale: .28, opacity: 0 });
        if (label) gsap.set(label, { opacity: 0 });
        if (line) gsap.set(line, { strokeDashoffset: line.getTotalLength(), opacity: .28 });
      }
      gsap.set(hintEl, { opacity: 0 });
      root.classList.remove("orbit-stable");
      revealTl.pause();
    };

    // Drive the reveal manually, with a capped per-frame delta, instead of
    // letting GSAP's own ticker advance it natively. The app's global
    // gsap.ticker.lagSmoothing(0) (set in useLenis.js, needed so Lenis-driven
    // scrub tweens elsewhere don't visibly "catch up" after a stall) means
    // any NORMALLY-playing timeline can jump straight to completion in one
    // frame if the tab stalls/backgrounds right as it starts -- verified this
    // actually happens with GSAP's native .restart(). A time-based reveal
    // like this one has no scroll position to fall back on, so it can't be
    // allowed to skip; capping each frame's advance guarantees it always
    // plays through every step even after a real stall (it just catches up
    // at a bounded rate rather than teleporting to the end).
    //
    // The cap has a cost, though, and it is the reason for the wall-clock
    // guard below. Because each frame may only advance the timeline by
    // MAX_FRAME_DELTA, a device rendering at 12fps advances it at ~40% of real
    // time — and the 12 service nodes are `pointer-events: none` until this
    // timeline finishes (`.orbit-stable`). On a slow device that turned the
    // site's primary navigation into a dead zone for several seconds. So the
    // reveal is capped in wall-clock time too: however slowly the frames
    // arrive, the orbit is interactive within REVEAL_MAX_WALL_MS.
    const MAX_FRAME_DELTA = 1 / 30;
    const REVEAL_MAX_WALL_MS = 2600;
    let revealStartedAt = 0;

    // Finishing is asserted here rather than left to the timeline's own
    // onComplete: this timeline is paused and scrubbed with .time(), and
    // completion callbacks on a paused animation are not a contract worth
    // resting the whole section's interactivity on. onComplete stays as well —
    // adding the class twice is harmless.
    const finishReveal = () => {
      revealTl.time(revealTl.duration());
      gsap.ticker.remove(driveReveal);
      root.classList.add("orbit-stable");
    };

    function driveReveal(_time, deltaMs) {
      if (performance.now() - revealStartedAt > REVEAL_MAX_WALL_MS) {
        finishReveal();
        return;
      }
      const next = revealTl.time() + Math.min(deltaMs / 1000, MAX_FRAME_DELTA);
      if (next >= revealTl.duration()) finishReveal();
      else revealTl.time(next);
    }

    // No pin: the Core is never locked in place, so there is nothing that
    // can suddenly grab the page and snap it back -- scrolling stays
    // completely natural the whole time, in both directions. "Reached
    // 62%" is the exact same crossing the entrance tween above already
    // uses ("top bottom" -> "center 62%" on this same root element), so
    // this is a second, independent trigger over that identical range:
    // onLeave fires just before the Core's own center reaches the viewport's
    // center on the way down, giving the services time to become visible
    // before a fast-scrolling visitor moves past the section.
    let hasPlayed = false;
    const playOnce = () => {
      if (hasPlayed) return;
      hasPlayed = true;
      // Under a reduced-motion preference the orbit arrives assembled. The
      // twelve nodes flying out from the core is decorative travel, and it is
      // also the slowest thing on the page to become interactive.
      if (reducedMotion) {
        finishReveal();
        return;
      }
      revealTl.time(0);
      revealStartedAt = performance.now();
      gsap.ticker.add(driveReveal);
    };
    ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "center 62%",
      onLeave: playOnce,
      onEnterBack: playOnce,
      // Only a genuine backward exit (scrolled up and out above the section)
      // resets -- never fires from a small in-place wheel wiggle, since
      // ScrollTrigger only calls this when its own start boundary is
      // actually crossed going back upward.
      onLeaveBack: () => {
        hasPlayed = false;
        resetReveal();
      },
    });

    return () => {
      gsap.ticker.remove(driveReveal);
      revealTl.kill();
    };
  }, root);

  root.addEventListener("mouseenter",onEnter); root.addEventListener("mouseleave",onLeave);
  return () => {
    root.removeEventListener("mouseenter",onEnter);root.removeEventListener("mouseleave",onLeave);
    root.classList.remove("orbit-stable");
    gsap.killTweensOf(speed);
    removeRefreshListener?.();
    ctx.revert();
  };
}
// Icon-origin transition: the panel launches from (and returns to) the exact clicked
// service node's screen position, restored from the original build's requestOpenService
// flow (K.querySelector(".sv-icon").getBoundingClientRect()) via the same FLIP technique
// (invert panel<->icon delta, then animate the invert away) rather than a fixed pop.
function originDelta(panel, originRect) {
  const panelRect = panel.getBoundingClientRect();
  const originCenterX = originRect.left + originRect.width / 2;
  const originCenterY = originRect.top + originRect.height / 2;
  const panelCenterX = panelRect.left + panelRect.width / 2;
  const panelCenterY = panelRect.top + panelRect.height / 2;
  return {
    x: originCenterX - panelCenterX,
    y: originCenterY - panelCenterY,
    scale: Math.min(1, Math.max(originRect.width / panelRect.width, 0.05)),
  };
}

export function animateServiceModal(panel, originRect) {
  if (originRect) {
    const { x, y, scale } = originDelta(panel, originRect);
    return gsap.fromTo(
      panel,
      { x, y, scale, opacity: 0, filter: "blur(6px)" },
      { x: 0, y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.62, ease: "power4.out" },
    );
  }
  return gsap.fromTo(panel, { opacity: 0, scale: .84, y: 30, filter: "blur(16px)" }, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: .55, ease: "power4.out" });
}
export function closeServiceModal(panel, scrim, onDone, originRect) {
  const tl = gsap.timeline({ onComplete: onDone });
  if (originRect) {
    const { x, y, scale } = originDelta(panel, originRect);
    tl.to(panel, { x, y, scale, opacity: 0, filter: "blur(8px)", duration: .42, ease: "power2.in" }, 0);
  } else {
    tl.to(panel, { opacity: 0, scale: .9, y: 18, filter: "blur(10px)", duration: .32, ease: "power2.in" }, 0);
  }
  if (scrim) tl.to(scrim, { opacity: 0, duration: .28, ease: "power2.in" }, 0);
  return tl;
}
