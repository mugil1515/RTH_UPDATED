import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import CodeStreams from "@/components/effects/CodeStreams";
import GrainOverlay from "@/components/effects/GrainOverlay";
import Vignette from "@/components/effects/Vignette";
import { gsap, ScrollTrigger } from "@/animations/gsapConfig";

// Three.js plus the whole automation scene is by far the largest thing the app
// ships, and none of it is needed to paint the hero. Loading it as its own
// chunk keeps it out of the critical bundle: the copy, the JSON panels and the
// buttons are interactive while the scene is still arriving, and the scene then
// fades in exactly where it always did (the canvas is fixed at --z-bg, so its
// late arrival shifts nothing). The fallback is deliberately null — an empty
// background layer is the correct "not yet" state here.
const ThreeBackground = lazy(() => import("@/components/effects/ThreeBackground"));

// Content safe zones — the foreground bounding boxes the 3D scene must not
// compete with, per section.
//
// WHY THIS IS MEASURED RATHER THAN AUTHORED
// Every alternative is a guess that goes stale. Fixed percentages drift the
// moment a section's height, the viewport or the copy changes; a single global
// dimmer either hides the animation everywhere or protects nothing. So the
// mask is driven from the live getBoundingClientRect() of the actual heading
// and panel elements, which is the only source that is correct by
// construction.
//
//   head  the heading band — big type, needs contrast but sits over open space
//   body  the panel/card/form band — the part that must be perfectly readable
//   a / b how strongly the scene is suppressed under each (brief §15).
//
// Values are tuned per section rather than shared: #analyzer and #contact are
// forms where the input is the whole point, #services is a full-screen DOM
// orbit that is itself the subject, and #hero should still feel alive.
//
// WHY `a` IS NOW THE STRONGER OF THE TWO
// It used to be the weaker one, on the reasoning that a heading carries its own
// contrast. That reasoning was wrong in one specific way: a heading is bare
// glyphs on open page with NOTHING behind them, whereas almost every `body`
// band is a glass card that already resolves to about a tenth of the scene
// showing through before the scrim contributes anything. So the band that
// needed the mask least was getting the most of it, and the letters — the one
// place a stray orbit line or an orange glow actually merges with type — were
// getting about half of what they needed.
//
// The cores below therefore sit near the "directly behind text" target, and the
// card bands sit lower and let their own glass finish the job. This stays local
// rather than global because the ellipse is measured from the content box and
// its gradient reaches zero at 1.25x that box: a strong core washes the words,
// not the page (brief §5, §6, §7).
// `edge` / `fx` / `fy` may be overridden per zone. Home's sections share one
// setting because they share one shape: a centred column over a full-bleed
// section. A service detail page does not — see the zone below.
const SAFE_ZONES = [
  // SERVICE DETAIL ROUTES.
  //
  // This zone used to run at a: 0.78 / b: 0.80 over `.detail-sections >
  // section`, which is a full-width band: the measured ellipse came out at
  // roughly 90% of the viewport and washed 80% white over the entire page.
  // That is the "lower sections look like plain white pages" half of the
  // problem, and raising the scene's own opacity underneath it could never
  // have fixed it (brief §1).
  //
  // What replaces it is the observation that these cards do not need a scrim
  // at all. `.detail-sections > section` is already rgba(255,255,255,0.82)
  // over backdrop-filter: blur(16px) — glass that resolves to ~0.15 of the
  // scene showing through, blurred, which is precisely the "directly behind
  // large white cards" target in brief §1. The scrim's remaining job is only
  // the band AROUND them, so `b` drops to a whisper and the card's own halo
  // (globals.css) feathers the last few pixels.
  //
  // `head` is the one place that still needs real protection: the hero copy
  // column has no surface of its own, just near-black type on open page. It
  // keeps a moderate core and a tight fit, so it calms the left column and
  // leaves the centre/right — where the scene now lives — untouched.
  {
    root: ".service-detail-page",
    head: ".back-link, .service-detail-grid > div:first-child",
    body: ".detail-sections > section",
    // Raised from 0.54 toward the heading target. It stops short of the 0.88
    // the Home headings get because this box is a whole COLUMN, not a line of
    // type — the display heading, the lead, the chips and the CTA with the gaps
    // between them — so the core covers a lot of open page as well as the
    // words. 0.70 is what protects the copy without whiting out the left half.
    a: 0.70,
    b: 0.15,
    edge: 1.06,
    fx: 26,
    fy: 26,
  },
  { id: "hero", head: ".hero-title", body: ".hero-lead, .hero-ctas", a: 0.90, b: 0.88 },
  { id: "problems", head: ".section-heading", body: ".problem-grid, .problem-transform", a: 0.88, b: 0.62 },
  { id: "services", head: ".section-heading", body: ".section-inner", a: 0.84, b: 0.40 },
  { id: "billing", head: ".section-heading", body: ".billing-layout", a: 0.88, b: 0.76 },
  // The execution sequence is now staged in this section's open margins rather
  // than behind its copy, so the mask no longer has to do the whole job alone.
  // .agent-log is a glass card at 0.88 white over blur(20px) — it already
  // resolves to about a tenth of the scene showing through, which is the
  // "directly behind a card" target — so 0.86 on top of it was suppressing the
  // ring AROUND the card for no readability gained (brief §6, §15).
  { id: "agent", head: ".section-heading", body: ".agent-flow, .agent-log", a: 0.88, b: 0.72 },
  { id: "industries", head: ".section-heading", body: ".industries-layout", a: 0.88, b: 0.78 },
  { id: "analyzer", head: ".section-heading", body: ".analyzer-box, .analyzer-result, .process-log", a: 0.88, b: 0.90 },
  { id: "company", head: ".section-heading", body: ".company-description, .company-location, .company-constellation", a: 0.86, b: 0.66 },
  { id: "contact", head: ".section-heading", body: ".contact-form, .final-brand", a: 0.88, b: 0.88 },
];

const FOCUS_STATES = [
  { selector: "#problems", x: "50%", y: "42%", strength: 0.5, size: "52%" },
  { selector: "#services", x: "50%", y: "44%", strength: 0.34, size: "62%" },
  { selector: "#billing", x: "50%", y: "55%", strength: 0.55, size: "46%" },
  { selector: "#agent", x: "50%", y: "50%", strength: 0.58, size: "42%" },
  { selector: "#industries", x: "50%", y: "42%", strength: 0.48, size: "50%" },
  { selector: "#analyzer", x: "50%", y: "48%", strength: 0.6, size: "42%" },
  { selector: "#company", x: "50%", y: "42%", strength: 0.45, size: "50%" },
  { selector: "#contact", x: "50%", y: "42%", strength: 0.62, size: "44%" },
];

export default function AppBackground({ routePath = "" }) {
  const focusRef = useRef(null);
  const scrimRef = useRef(null);

  // Content safe zones. Recomputed whenever the page scrolls or resizes, so
  // the mask tracks the copy instead of being pinned to fixed percentages.
  useLayoutEffect(() => {
    const layer = scrimRef.current;
    if (!layer) return undefined;

    const zones = SAFE_ZONES
      .map((zone) => ({
        ...zone,
        el: zone.root ? document.querySelector(zone.root) : document.getElementById(zone.id),
      }))
      .filter((zone) => zone.el);
    if (!zones.length) return undefined;

    // Union of every matching element, so a band made of several boxes (the
    // problem grid plus its transform row) is covered by one ellipse.
    const union = (root, selector) => {
      let box = null;
      root.querySelectorAll(selector).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom <= 0 || r.top >= window.innerHeight) return;
        box = box
          ? {
            left: Math.min(box.left, r.left),
            right: Math.max(box.right, r.right),
            top: Math.min(box.top, r.top),
            bottom: Math.max(box.bottom, r.bottom),
          }
          : { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
      return box;
    };

    const written = {};
    const write = (key, value) => {
      if (written[key] === value) return;
      layer.style.setProperty(key, value);
      written[key] = value;
    };

    let frame = 0;
    const apply = () => {
      frame = 0;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const middle = H / 2;
      // Mobile has no open space beside the content column, so the mask has to
      // work harder and feather wider (brief §13).
      const mobile = W < 760;
      const boost = mobile ? 1.15 : 1;
      // The gradient holds near-full strength out to its 80% stop, so a radius
      // of halfSize / 0.8 puts the box edge exactly where the falloff starts
      // and spends the remaining 20% feathering into the open page.
      //
      // This has to be a ratio plus a fixed margin, NOT a plain multiplier: the
      // panels here are close to the full width of the viewport, and any
      // multiplier large enough to protect a heading turns into an ellipse that
      // covers the whole screen and erases the scene everywhere.
      const defaultEdge = 1.25;
      const defaultFeatherX = mobile ? 34 : 44;
      const defaultFeatherY = mobile ? 30 : 38;

      const active = zones.find((zone) => {
        const r = zone.el.getBoundingClientRect();
        return r.top <= middle && r.bottom >= middle;
      });

      if (!active) {
        write("--scrim-a-core", "0");
        write("--scrim-b-core", "0");
        return;
      }

      const edge = active.edge ?? defaultEdge;
      const featherX = active.fx ?? defaultFeatherX;
      const featherY = active.fy ?? defaultFeatherY;

      [["a", active.head, active.a], ["b", active.body, active.b]].forEach(([slot, selector, strength]) => {
        const box = union(active.el, selector);
        if (!box) {
          write(`--scrim-${slot}-core`, "0");
          return;
        }
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        // How much of the band is actually on screen. Off-screen content needs
        // no protection, and leaving the mask on would wash the open areas the
        // scene is supposed to own.
        const visible = Math.max(0, Math.min(box.bottom, H) - Math.max(box.top, 0));
        const presence = Math.max(0, Math.min(1, visible / Math.max(1, Math.min(height, H * 0.75))));
        if (presence <= 0.01) {
          write(`--scrim-${slot}-core`, "0");
          return;
        }

        const cx = ((box.left + width / 2) / W) * 100;
        const cy = ((box.top + height / 2) / H) * 100;
        const rx = Math.min(72, Math.max(11, (((width / 2) * edge + featherX) / W) * 100));
        const ry = Math.min(46, Math.max(8, (((height / 2) * edge + featherY) / H) * 100));

        write(`--scrim-${slot}-x`, `${cx.toFixed(1)}%`);
        write(`--scrim-${slot}-y`, `${cy.toFixed(1)}%`);
        write(`--scrim-${slot}-w`, `${rx.toFixed(1)}%`);
        write(`--scrim-${slot}-h`, `${ry.toFixed(1)}%`);
        write(`--scrim-${slot}-core`, Math.min(0.95, strength * boost * presence).toFixed(3));
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    ScrollTrigger.addEventListener("refresh", apply);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ScrollTrigger.removeEventListener("refresh", apply);
    };
  }, [routePath]);

  useLayoutEffect(() => {
    const active = /^\/services\/[^/]+/.test(routePath);
    document.documentElement.classList.toggle("service-detail-route", active);

    // The focus veil is tweened by GSAP, which writes its values as INLINE
    // custom properties — so whatever Home last staged (down to
    // --focus-strength 0.62 over #contact) followed the visitor onto a service
    // page and stayed there for the rest of the visit, washing the scene the
    // service route is supposed to show. Clearing the inline values hands the
    // layer back to the stylesheet, where the service tier is declared.
    const layer = focusRef.current;
    if (active && layer) {
      gsap.killTweensOf(layer);
      ["--focus-x", "--focus-y", "--focus-strength", "--focus-size"]
        .forEach((prop) => layer.style.removeProperty(prop));
      // Same reasoning: bg-quiet is a class the Home triggers own, and a
      // service page has no trigger that would ever turn it back off.
      document.documentElement.classList.remove("bg-quiet");
      document.documentElement.classList.remove("services-depth");
    }

    return () => document.documentElement.classList.remove("service-detail-route");
  }, [routePath]);

  useLayoutEffect(() => {
    const layer = focusRef.current;
    if (!layer) return undefined;

    const triggers = [];
    const setFocus = ({ x, y, strength, size }) => {
      gsap.to(layer, {
        "--focus-x": x,
        "--focus-y": y,
        "--focus-strength": strength,
        "--focus-size": size,
        duration: 0.9,
        ease: "power2.out",
        overwrite: true,
      });
    };

    FOCUS_STATES.forEach((state) => {
      const target = document.querySelector(state.selector);
      if (!target) return;
      triggers.push(ScrollTrigger.create({
        trigger: target,
        start: "top 65%",
        end: "bottom 20%",
        onEnter: () => setFocus(state),
        onEnterBack: () => setFocus(state),
      }));
    });

    const quiet = new Set();
    ["industries", "company", "contact"].forEach((id) => {
      const target = document.getElementById(id);
      if (!target) return;
      const updateQuiet = (active) => {
        if (active) quiet.add(id); else quiet.delete(id);
        document.documentElement.classList.toggle("bg-quiet", quiet.size > 0);
      };
      triggers.push(ScrollTrigger.create({
        trigger: target,
        start: "top 70%",
        end: "bottom 30%",
        onEnter: () => updateQuiet(true),
        onEnterBack: () => updateQuiet(true),
        onLeave: () => updateQuiet(false),
        onLeaveBack: () => updateQuiet(false),
      }));
    });

    const services = document.getElementById("services");
    if (services) {
      const setServicesDepth = (active) => {
        document.documentElement.classList.toggle("services-depth", active);
      };
      triggers.push(ScrollTrigger.create({
        trigger: services,
        start: "top 78%",
        end: "bottom 22%",
        onEnter: () => setServicesDepth(true),
        onEnterBack: () => setServicesDepth(true),
        onLeave: () => setServicesDepth(false),
        onLeaveBack: () => setServicesDepth(false),
      }));

      const focusCurve = [
        { p: 0, strength: 0.36, size: 34 },
        { p: 0.38, strength: 0.36, size: 34 },
        { p: 0.58, strength: 0.28, size: 52 },
        { p: 1, strength: 0.22, size: 68 },
      ];
      let lastStrength = null;
      let lastSize = null;
      triggers.push(ScrollTrigger.create({
        trigger: services,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.48,
        onUpdate: (self) => {
          const progress = self.progress;
          let strength = focusCurve[focusCurve.length - 1].strength;
          let size = focusCurve[focusCurve.length - 1].size;
          for (let i = 0; i < focusCurve.length - 1; i += 1) {
            const start = focusCurve[i];
            const end = focusCurve[i + 1];
            if (progress >= start.p && progress <= end.p) {
              const local = (progress - start.p) / (end.p - start.p || 1);
              strength = start.strength + (end.strength - start.strength) * local;
              size = start.size + (end.size - start.size) * local;
              break;
            }
          }
          // Skip the style write entirely when the value hasn't meaningfully
          // moved -- this is a full-viewport background repaint, so avoid
          // triggering it on every scroll tick.
          if (lastStrength === null || Math.abs(strength - lastStrength) > 0.003) {
            layer.style.setProperty("--focus-strength", strength.toFixed(3));
            lastStrength = strength;
          }
          if (lastSize === null || Math.abs(size - lastSize) > 0.2) {
            layer.style.setProperty("--focus-size", `${size.toFixed(1)}%`);
            lastSize = size;
          }
        },
      }));
    }

    ScrollTrigger.refresh();
    return () => {
      triggers.forEach((trigger) => trigger.kill());
      gsap.killTweensOf(layer);
      document.documentElement.classList.remove("bg-quiet");
      document.documentElement.classList.remove("services-depth");
    };
    // Every selector above (#problems, #services, #billing, ...) belongs to Home
    // only, and this component is mounted once by PageLayout for the whole
    // session. Bound once at mount, the focus/quiet/depth staging was therefore
    // dead for anyone who entered the site on /about, /contact or a service page
    // and then navigated Home — and worse, a trigger bound to a section that
    // later unmounted (About renders its own #company) kept firing against a
    // detached element, leaving html.bg-quiet stuck on. Re-binding per route is
    // what makes the staging correct from any entry point.
  }, [routePath]);

  return (
    <div className="app-background" aria-hidden="true">
      <Suspense fallback={null}>
        <ThreeBackground routePath={routePath} />
      </Suspense>
      <CodeStreams />
      <div ref={focusRef} id="focus-layer" className="focus-layer" />
      <Vignette />
      {/* Above every other ambient layer: this is the mask that keeps the 3D
          story off the copy, so it has to govern the JSON panels too. */}
      <div ref={scrimRef} className="content-scrim" />
      <GrainOverlay />
    </div>
  );
}
