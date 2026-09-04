import { useEffect } from "react";

// Animation export mode: /?animationStory=1
//
// Adds one class to <html>. Everything it does is in styles/export.css - the
// foreground is hidden while the layout, the scroll height and every
// ScrollTrigger boundary stay exactly as they are, so the background scene
// plays the same animation it plays on the live homepage.
//
// This is the mode scripts/render-background.mjs records. It changes nothing
// for a normal visit: without the query parameter the class is never set.
export const EXPORT_PARAM = "animationStory";
export const EXPORT_CLASS = "rth-export";

export function isExportMode(search = window.location.search) {
  return new URLSearchParams(search).get(EXPORT_PARAM) === "1";
}

export default function useExportMode() {
  useEffect(() => {
    if (!isExportMode()) return undefined;
    const root = document.documentElement;
    root.classList.add(EXPORT_CLASS);
    return () => root.classList.remove(EXPORT_CLASS);
  }, []);
}
