import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { suspendScene } from "@/utils/sceneSuspend";

// "Watch the system work" - the trigger plus its full-screen video viewer.
//
// WHY VIDEO AND NOT A SECOND LIVE SCENE
// The page already runs one scroll-driven three.js world. Opening a second one
// in a modal would mean two WebGL contexts, two PMREM bakes and two render
// loops competing on the same frame budget - on a phone that is the difference
// between a smooth page and a stuttering one. An MP4 costs a decode thread and
// nothing else, and it also guarantees every viewer sees the same explanation
// in the same order at the same pace.
//
// THE SAME ARGUMENT APPLIES WHILE THE VIEWER IS OPEN
// One scene is only one scene if the page's own scene stops. This overlay is
// opaque and covers the whole viewport, so every frame the background renderer
// and the Lenis pump produce underneath it is invisible work taken from the
// decoder - which is what the playback stutter actually was. suspendScene()
// parks both for as long as the viewer is up and hands back a release that
// restores them exactly; see utils/sceneSuspend.
//
// Nothing is destroyed: the viewer opens, plays a file, and restores the page
// exactly as it found it.

// The homepage background animation, recorded top to bottom by
// scripts/render-background.mjs from the site's own scene (see STORY_VIDEO.md).
const SOURCES = {
  desktop: "/videos/rth-background-animation-desktop.mp4",
  mobile: "/videos/rth-background-animation-mobile.mp4",
};

// First frame of each cut, so opening the viewer shows the picture instead of
// an empty letterbox while the decoder spins up.
const POSTERS = {
  desktop: "/videos/rth-background-animation-desktop.jpg",
  mobile: "/videos/rth-background-animation-mobile.jpg",
};

/** The 9:16 cut below 768px, the 16:9 cut at and above it - per the brief. */
function pickVariant() {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

export default function StoryVideo() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [variant, setVariant] = useState(pickVariant);
  const videoRef = useRef(null);
  // The progress fill is written straight to the DOM. Routing playback time
  // through React state re-rendered the entire viewer several times a second
  // to produce one style write - on the same main thread the decoder needs.
  const fillRef = useRef(null);
  const railRef = useRef(null);
  const progress = useRef(0);
  const scrollY = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  const setProgress = useCallback((ratio) => {
    progress.current = ratio;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
    railRef.current?.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  }, []);

  // Re-pick on resize/orientation change, but only while closed: swapping the
  // source mid-playback would restart the story from zero.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => { if (!open) setVariant(pickVariant()); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  /** Stop playback and tear the viewer down. Shared by X, ESC and HOME. */
  const teardown = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");   // stops the download too, not just playback
      video.load();
    }
    setOpen(false);
    setPlaying(false);
    setEnded(false);
    setBuffering(true);
    progress.current = 0;
  }, []);

  // X: leave the page exactly as it was.
  const close = teardown;

  // HOME: always end up on "/". From the homepage that is just the close path -
  // navigating to the route we are already on would be a no-op that also throws
  // away the scroll position the close handler is about to restore.
  const goHome = useCallback(() => {
    const wasElsewhere = location.pathname !== "/";
    teardown();
    if (wasElsewhere) {
      // Router navigation, not a reload: the app, the scene and the router
      // history all stay alive.
      scrollY.current = 0;
      navigate("/");
    }
  }, [teardown, navigate, location.pathname]);

  // Scene suspension and scroll lock live in one effect so their teardown
  // order is fixed.
  //
  // position:fixed on <body> is the only scroll lock that holds on iOS, and it
  // collapses the scroll position - so the offset is stashed and put back on
  // close, which is what "return the user to exactly where they were"
  // requires. The suspension is released BEFORE that restore: the scrollTo
  // below is what resyncs Lenis's smoothed value, and a still-stopped instance
  // would ignore it.
  useEffect(() => {
    if (!open) return undefined;
    const release = suspendScene();

    scrollY.current = window.scrollY;
    const { body } = document;
    const prev = body.style.cssText;
    body.style.position = "fixed";
    body.style.top = `-${scrollY.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      release();
      body.style.cssText = prev;
      window.scrollTo(0, scrollY.current);
      // Lenis keeps its own smoothed scroll value; without this it animates
      // back from wherever it thought it was.
      window.__rthLenis?.scrollTo(scrollY.current, { immediate: true });
    };
  }, [open]);

  // ESC closes (it does not go home - see the X/HOME split above).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // The user clicked play, so autoplay is the expected behaviour. If a
  // power-saving mode refuses it, the paused state is simply shown - the
  // rejection is caught and never surfaces as an error.
  //
  // Driven by canplay rather than by mount: calling play() before the decoder
  // holds a frame makes the browser start, stall and start again, which is
  // precisely the hitch this viewer should not have. The element is mounted
  // once per open with its src already on it, so there is no load() call here
  // and no remount.
  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => { setPlaying(true); setEnded(false); }).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setProgress(0);
    setEnded(false);
    video.play().then(() => setPlaying(true)).catch(() => {});
  };

  const seek = (e) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setProgress(ratio);
  };

  // Warm the container and its first bytes on intent rather than on page load,
  // so the click that opens the viewer usually finds them already there. One
  // link per source, and only after a deliberate hover/touch.
  const warm = () => {
    const href = SOURCES[variant];
    if (document.head.querySelector(`link[data-story-warm="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = href;
    link.dataset.storyWarm = href;
    document.head.appendChild(link);
  };

  return (
    <>
      <button
        type="button"
        className="story-trigger"
        onClick={() => setOpen(true)}
        onPointerEnter={warm}
        onFocus={warm}
      >
        <span className="story-trigger-icon" aria-hidden="true" />
        Watch the system work
      </button>

      {/* PORTALLED TO <body> ON PURPOSE.
        * The trigger lives inside the hero, and the hero's GSAP entrance
        * animation leaves transforms on its ancestors. A transformed ancestor
        * becomes the containing block for position: fixed, so rendering the
        * viewer in place pinned it to the hero's box instead of the viewport -
        * a "full-screen" overlay with the page still visible around it. From
        * <body> there is no such ancestor and inset: 0 means the viewport.
        */}
      {open && createPortal((
        <div
          className={`story-viewer story-viewer--${variant}`}
          role="dialog"
          aria-modal="true"
          aria-label="How RTH automation works"
        >
          {/* Home is the primary exit and sits top-left, where a back action is
              expected; the X keeps its conventional top-right corner. */}
          <button
            type="button"
            className="story-home"
            onClick={goHome}
            aria-label="Return to home"
          >
            <span className="story-home-arrow" aria-hidden="true">←</span>
            Home
          </button>

          <button
            type="button"
            className="story-close"
            onClick={close}
            aria-label="Close video"
          >
            ✕
          </button>

          <video
            ref={videoRef}
            className="story-video"
            // Only metadata up front: neither cut is fetched in full until
            // someone actually opens the viewer.
            preload="metadata"
            poster={POSTERS[variant]}
            playsInline
            muted
            onClick={toggle}
            onCanPlay={() => { setBuffering(false); start(); }}
            onPlaying={() => { setBuffering(false); setPlaying(true); }}
            // waiting/stalled only, never a plain pause: the loader is for a
            // genuinely empty buffer, and gating it on these two keeps it from
            // flashing during ordinary playback.
            onWaiting={() => setBuffering(true)}
            onStalled={() => setBuffering(true)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            onEnded={() => { setPlaying(false); setEnded(true); setProgress(1); }}
            src={SOURCES[variant]}
          />

          {buffering && <div className="story-loading" role="status" aria-label="Loading video" />}

          <div className="story-controls">
            <button
              type="button"
              className="story-ctl"
              onClick={ended ? replay : toggle}
              aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
            >
              {ended ? "↻" : playing ? "❚❚" : "▶"}
            </button>

            <div
              ref={railRef}
              className="story-progress"
              onClick={seek}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuenow={0}
              aria-valuemin={0}
              aria-valuemax={100}
              onKeyDown={(e) => {
                const video = videoRef.current;
                if (!video || !video.duration) return;
                if (e.key === "ArrowRight") video.currentTime += 2;
                if (e.key === "ArrowLeft") video.currentTime -= 2;
              }}
            >
              <i ref={fillRef} />
            </div>

            <button type="button" className="story-ctl" onClick={replay} aria-label="Replay">
              ↻
            </button>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
