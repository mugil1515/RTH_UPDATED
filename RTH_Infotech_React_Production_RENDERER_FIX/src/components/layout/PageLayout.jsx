import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Footer from "@/components/layout/Footer";
import AppBackground from "@/components/layout/AppBackground";
import SiteLogo from "@/components/layout/SiteLogo";
import Loader from "@/components/common/Loader";
import RouteTransition from "@/components/common/RouteTransition";
import ScrollTop from "@/components/common/ScrollTop";
import InnerBackButton from "@/components/common/InnerBackButton";
import Chatbot from "@/components/chatbot/Chatbot";
import useLenis from "@/hooks/useLenis";
import useScrollTriggerRefresh from "@/hooks/useScrollTriggerRefresh";
import useExportMode, { isExportMode } from "@/hooks/useExportMode";
import StoryCaptions from "@/story/StoryCaptions";

export default function PageLayout() {
  useLenis();
  useScrollTriggerRefresh();
  // No-op unless ?animationStory=1 is present (see hooks/useExportMode.js).
  useExportMode();
  const { pathname, state } = useLocation();

  // Remember the visitor's latest position on Home so top-level pages such
  // as /services can return to the exact point they left, not the hero.
  useEffect(() => {
    if (pathname !== "/") return undefined;

    const saveHomePosition = () => {
      const lenisScroll = window.__rthLenis?.scroll;
      const scrollY = typeof lenisScroll === "number" ? lenisScroll : window.scrollY;
      try {
        sessionStorage.setItem("rthHomeScrollY", String(Math.max(0, scrollY)));
      } catch {
        /* Ignore storage restrictions; navigation still falls back to top. */
      }
    };

    // sessionStorage.setItem is a synchronous write, and this listener is bound
    // to BOTH the native scroll event and Lenis' own — so writing directly from
    // the handler meant two storage writes per scroll frame on the longest page
    // of the site. Coalescing to one write per animation frame keeps the
    // restore-position feature exactly as accurate (the value only has to be
    // right at the moment of navigation) for a fraction of the cost.
    let frame = 0;
    const scheduleSave = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        saveHomePosition();
      });
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.__rthLenis?.on("scroll", scheduleSave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      saveHomePosition();
      window.removeEventListener("scroll", scheduleSave);
      window.__rthLenis?.off("scroll", scheduleSave);
    };
  }, [pathname]);

  useEffect(() => {
    const restoreY = Number(state?.restoreScrollY);
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const target = Number.isFinite(restoreY) ? restoreY : 0;
        if (window.__rthLenis) window.__rthLenis.scrollTo(target, { immediate: true });
        else window.scrollTo({ top: target, left: 0, behavior: "auto" });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [pathname, state?.restoreScrollY]);

  return (
    <>
      <Loader />
      <RouteTransition />
      <AppBackground routePath={pathname} />
      <SiteLogo />
      <InnerBackButton />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
      <ScrollTop />
      <Chatbot />
      {/* Stage captions for the recorded animation. Never mounted on a normal
          visit - isExportMode() is only true for /?animationStory=1. */}
      {isExportMode() && <StoryCaptions />}
    </>
  );
}
