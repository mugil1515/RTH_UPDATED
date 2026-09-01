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

export default function PageLayout() {
  useLenis();
  useScrollTriggerRefresh();
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

    window.addEventListener("scroll", saveHomePosition, { passive: true });
    window.__rthLenis?.on("scroll", saveHomePosition);
    return () => {
      saveHomePosition();
      window.removeEventListener("scroll", saveHomePosition);
      window.__rthLenis?.off("scroll", saveHomePosition);
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
      <AppBackground />
      <SiteLogo />
      <InnerBackButton />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
      <ScrollTop />
      <Chatbot />
    </>
  );
}
