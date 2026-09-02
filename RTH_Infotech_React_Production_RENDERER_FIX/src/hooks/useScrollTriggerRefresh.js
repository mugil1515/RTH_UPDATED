import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ScrollTrigger } from "@/animations/gsapConfig";

export default function useScrollTriggerRefresh() {
  const { pathname } = useLocation();

  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // The three webfonts land after first paint, and swapping them in changes the
  // measured height of every heading and therefore of the sections that contain
  // them. Without this, triggers computed during the fallback-font layout stay
  // a few dozen pixels off for the rest of the session — the classic "the
  // animation fires slightly too late/early" bug. Runs once: fonts.ready
  // settles for good after the initial load.
  useEffect(() => {
    if (!document.fonts?.ready) return undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => { cancelled = true; };
  }, []);
}
