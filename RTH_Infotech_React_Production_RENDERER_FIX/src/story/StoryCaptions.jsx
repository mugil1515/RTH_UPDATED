import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/animations/gsapConfig";
import { captionAt, resolveCaptions } from "./captions";

// The stage captions drawn over the recorded background animation.
//
// Rendered ONLY in export mode (PageLayout gates it on isExportMode), so the
// live site never mounts it.
//
// WHY THE DOM IS WRITTEN DIRECTLY AND NOT THROUGH STATE
// This updates every animation frame against the scroll position. Routing that
// through React state would re-render the tree 30 times a second for a two-line
// label. Writing textContent and opacity onto three refs does the same job with
// no reconciliation, and it stays exact under the recorder's virtual clock.
export default function StoryCaptions() {
  const boxRef = useRef(null);
  const titleRef = useRef(null);
  const lineRef = useRef(null);
  const tagRef = useRef(null);

  useEffect(() => {
    let resolved = resolveCaptions();
    let raf = 0;
    let shown = null;

    const measure = () => { resolved = resolveCaptions(); };
    ScrollTrigger.addEventListener("refresh", measure);
    window.addEventListener("resize", measure);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      const { caption, opacity, local } = captionAt(resolved, progress);
      const box = boxRef.current;
      if (!box) return;

      if (!caption) { box.style.opacity = "0"; return; }
      if (caption.id !== shown) {
        shown = caption.id;
        titleRef.current.textContent = caption.title;
        lineRef.current.textContent = caption.line;
        tagRef.current.textContent = caption.tagline || "";
        tagRef.current.style.display = caption.tagline ? "block" : "none";
      }
      // The closing tagline arrives only once the final state has settled, so
      // it reads as a sign-off rather than as part of the label.
      if (caption.tagline) tagRef.current.style.opacity = String(Math.min(1, Math.max(0, (local - 0.55) / 0.2)));
      box.style.opacity = String(opacity);
      // A 6px settle on entry - the only motion the type ever makes.
      box.style.transform = `translateY(${((1 - opacity) * 6).toFixed(2)}px)`;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ScrollTrigger.removeEventListener("refresh", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="story-captions" aria-hidden="true">
      <div className="story-caption" ref={boxRef}>
        <p className="story-caption-title" ref={titleRef} />
        <p className="story-caption-line" ref={lineRef} />
        <p className="story-caption-tag" ref={tagRef} />
      </div>
    </div>
  );
}
