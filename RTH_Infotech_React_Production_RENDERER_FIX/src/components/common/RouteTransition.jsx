import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { gsap } from "@/animations/gsapConfig";

export default function RouteTransition() {
  const { pathname } = useLocation();
  const overlay = useRef(null);
  const burst = useRef(null);
  const transitionIcon = useRef(null);
  const mounted = useRef(false);
  const iconTransition = useRef(false);
  const active = useRef(false);
  const navigationTimer = useRef(null);

  useLayoutEffect(() => {
    const el = overlay.current;
    const orb = burst.current;
    const glyph = transitionIcon.current;
    if (!el || !orb || !glyph) return undefined;

    window.__rthNavigateFromServiceIcon = ({ originEl, navigate }) => {
      if (active.current || typeof navigate !== "function") return false;

      const icon = originEl?.querySelector?.(".service-icon") || originEl;
      const rect = icon?.getBoundingClientRect?.();
      if (!rect || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navigate();
        return true;
      }

      active.current = true;
      iconTransition.current = true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rippleSize = Math.max(rect.width * 2.7, 150);

      glyph.replaceChildren(icon.cloneNode(true));
      gsap.killTweensOf([el, orb, glyph, icon]);
      el.classList.add("is-icon-origin");
      gsap.set(el, {
        opacity: 1,
        pointerEvents: "none",
        backdropFilter: "blur(0px)",
      });
      gsap.set(orb, {
        left: centerX,
        top: centerY,
        width: rect.width,
        height: rect.height,
        xPercent: -50,
        yPercent: -50,
        scale: 1,
        opacity: 1,
      });
      gsap.set(glyph, {
        left: centerX,
        top: centerY,
        width: rect.width,
        height: rect.height,
        xPercent: -50,
        yPercent: -50,
        scale: 1,
        rotate: 0,
        opacity: 1,
        filter: "brightness(1)",
      });

      window.clearTimeout(navigationTimer.current);
      navigationTimer.current = window.setTimeout(navigate, 500);

      gsap.timeline()
        .to(icon, {
          scale: 1.2,
          filter: "brightness(1.55)",
          duration: 0.2,
          ease: "power2.out",
        }, 0)
        .to(orb, {
          width: rippleSize,
          height: rippleSize,
          opacity: 0.58,
          duration: 0.5,
          ease: "power3.out",
        }, 0)
        .to(glyph, {
          scale: 1.38,
          rotate: 5,
          filter: "brightness(1.8)",
          duration: 0.34,
          ease: "power3.out",
        }, 0)
        .to(glyph, {
          opacity: 0.16,
          scale: 1.62,
          duration: 0.18,
          ease: "power2.in",
        }, 0.32)
        .to(icon, {
          opacity: 0.28,
          scale: 1.22,
          duration: 0.16,
          ease: "power2.in",
        }, 0.34);

      return true;
    };

    return () => {
      delete window.__rthNavigateFromServiceIcon;
      window.clearTimeout(navigationTimer.current);
      gsap.killTweensOf([el, orb, glyph]);
      glyph.replaceChildren();
    };
  }, []);

  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const el = overlay.current;
    const orb = burst.current;
    const glyph = transitionIcon.current;
    if (!el || !orb || !glyph) return;

    if (iconTransition.current) {
      iconTransition.current = false;
      window.clearTimeout(navigationTimer.current);
      navigationTimer.current = null;
      gsap.killTweensOf([el, orb, glyph]);
      gsap.to(orb, {
        opacity: 0,
        scale: 1.04,
        duration: 0.22,
        ease: "power3.out",
      });
      gsap.to(glyph, { opacity: 0, duration: 0.14, ease: "power2.out" });
      gsap.to(el, {
        opacity: 0,
        duration: 0.22,
        ease: "power2.out",
        onComplete: () => {
          active.current = false;
          el.classList.remove("is-icon-origin");
          gsap.set(el, { pointerEvents: "none", clearProps: "backgroundColor,backdropFilter" });
          gsap.set(orb, { clearProps: "all" });
          gsap.set(glyph, { clearProps: "all" });
          glyph.replaceChildren();
        },
      });
      return;
    }

    gsap.killTweensOf([el, orb, glyph]);
    el.classList.remove("is-icon-origin");
    glyph.replaceChildren();
    gsap.set(el, { opacity: 1, pointerEvents: "auto" });
    gsap.to(el, { opacity: 0, duration: .6, delay: .08, ease: "power2.out", pointerEvents: "none" });
  }, [pathname]);

  return (
    <div ref={overlay} className="route-transition" aria-hidden="true">
      <div ref={burst} className="route-transition-burst" />
      <div ref={transitionIcon} className="route-transition-glyph" />
    </div>
  );
}
