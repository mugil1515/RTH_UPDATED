import { useEffect, useRef } from "react";

export default function ScrollTop() {
  const ref = useRef(null);

  useEffect(() => {
    const button = ref.current;
    if (!button) return undefined;

    let framePending = false;

    const currentScrollY = () => {
      const lenisScroll = window.__rthLenis?.scroll;
      if (typeof lenisScroll === "number") return lenisScroll;
      return Math.max(window.scrollY, document.documentElement.scrollTop || 0);
    };

    const updateButton = () => {
      const y = currentScrollY();
      const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(y / range, 0), 1);
      const visible = y > 320;

      button.classList.toggle("is-visible", visible);
      button.setAttribute("aria-hidden", String(!visible));
      button.tabIndex = visible ? 0 : -1;
      button.style.setProperty("--scroll-progress", `${progress * 360}deg`);
      framePending = false;
    };

    const requestUpdate = () => {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(updateButton);
    };

    const goToTop = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (window.__rthLenis) {
        window.__rthLenis.scrollTo(0, { duration: reduced ? 0 : 0.92, immediate: reduced });
      } else {
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }
    };

    const onClick = (event) => {
      event.preventDefault();
      goToTop();
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    window.addEventListener("orientationchange", requestUpdate, { passive: true });
    window.__rthLenis?.on("scroll", requestUpdate);
    button.addEventListener("click", onClick);
    updateButton();

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("orientationchange", requestUpdate);
      window.__rthLenis?.off("scroll", requestUpdate);
      button.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <button ref={ref} id="scroll-top" type="button" className="scroll-top" aria-label="Back to top" title="Back to top" aria-hidden="true" tabIndex={-1}>
      <span className="scroll-top-content" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
        </svg>
        <span className="scroll-top-label">TOP</span>
      </span>
    </button>
  );
}
