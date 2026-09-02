import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/animations/gsapConfig";

export default function useLenis() {
  useEffect(() => {
    // Smoothed scrolling is itself a motion effect: it decouples what the page
    // does from what the wheel did, which is exactly the class of movement
    // prefers-reduced-motion asks us to drop. The instance is still created —
    // ScrollTop, the hero CTAs and the chatbot all route through
    // window.__rthLenis and must keep working — it simply hands the scroll
    // straight through instead of easing it.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis(
      reduced
        ? { duration: 0, smoothWheel: false, smoothTouch: false, wheelMultiplier: 1, touchMultiplier: 1 }
        : { duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.05 },
    );
    const onScroll = () => ScrollTrigger.update();
    // Standard Lenis <-> ScrollTrigger wiring: whenever ScrollTrigger recalculates
    // trigger positions (window resize, content/layout changes, or -- the case
    // that first made this matter here -- a pin's spacer changing total document
    // height), Lenis must resync its own cached scroll-height/limit or its
    // scrollTo() targets and internal clamping drift out of sync with the real
    // (pin-inflated) document, causing scroll jumps/overshoot around the pin.
    const onRefresh = () => lenis.resize();
    const raf = (time) => lenis.raf(time * 1000);
    lenis.on("scroll", onScroll);
    ScrollTrigger.addEventListener("refresh", onRefresh);
    // Descendant layout effects (e.g. the services orbit's pin) have already run
    // by the time this passive effect fires, so a pin-spacer may already exist --
    // resize once up front rather than only reacting to the next refresh event.
    lenis.resize();
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    window.__rthLenis = lenis;
    return () => { gsap.ticker.remove(raf); lenis.off("scroll", onScroll); ScrollTrigger.removeEventListener("refresh", onRefresh); lenis.destroy(); delete window.__rthLenis; };
  }, []);
}
