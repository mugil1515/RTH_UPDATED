import { useLayoutEffect, useRef } from "react";
import ThreeBackground from "@/components/effects/ThreeBackground";
import CodeStreams from "@/components/effects/CodeStreams";
import GrainOverlay from "@/components/effects/GrainOverlay";
import Vignette from "@/components/effects/Vignette";
import { gsap, ScrollTrigger } from "@/animations/gsapConfig";

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

export default function AppBackground() {
  const focusRef = useRef(null);

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
  }, []);

  return (
    <div className="app-background" aria-hidden="true">
      <ThreeBackground /> 
      <CodeStreams />
      <div ref={focusRef} id="focus-layer" className="focus-layer" />
      <Vignette />
      <GrainOverlay />
    </div>
  );
}
