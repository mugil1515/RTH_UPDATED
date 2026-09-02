import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap, ScrollTrigger } from "@/animations/gsapConfig";
import {
  createAutomationScene,
  DEFAULT_MOOD,
  DEFAULT_SECTIONS,
  SECTION_KEYS,
  STAGE_A_Y,
} from "@/components/effects/ai3d/automationScene";
import { createStudioEnvironment } from "@/components/effects/ai3d/studioEnvironment";
import {
  FALLBACK_PATH,
  SECTION_MOODS,
  evaluateBeats,
  resolveBeats,
  resolveCameraPath,
  sampleCamera,
  smootherstep,
} from "@/components/effects/ai3d/storyboard";

// The camera descends through the automation environment as the page scrolls:
// Stage A (y 0) -> Stage B (y -12) -> Stage C (y -24).
//
// The keyframes and story beats live in storyboard.js, anchored to the real
// measured position of each section rather than to fractions of total scroll,
// so the beats stay locked to the copy they illustrate regardless of section
// heights, pin length or viewport size.
//
// This component owns the renderer, camera, clock, lights and render loop.
// It adds no pin, no scrub and no scroll length -- scroll speed and pinned
// sections are untouched.
export default function ThreeBackground({ routePath = "" }) {
  const ref = useRef(null);
  // Populated by the mount-once effect below, called by the per-route effect
  // after it. Effects run in declaration order, so it is always set in time.
  const bindSectionTriggersRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const mobile = window.innerWidth < 760;
    const tablet = !mobile && window.innerWidth < 1200;
    const cpu = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    const lowPower = mobile || cpu <= 4 || memory <= 4;

    // Matches the rest of the site's reduced-motion convention (see
    // effects.css): the composition stays fully visible, only the idle
    // motion stops. Scroll-driven staging is user-driven, so it stays live.
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    const onMotionPreference = () => {
      reducedMotion = reducedMotionQuery.matches;
      // `mood` is declared below; it exists by the time this can ever fire.
      mood.still = reducedMotion ? 1 : 0;
    };
    reducedMotionQuery.addEventListener("change", onMotionPreference);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !lowPower,
        alpha: true,
        powerPreference: "high-performance",
        precision: "highp",
      });
    } catch {
      canvas.style.display = "none";
      return undefined;
    }

    const pixelRatioCap = lowPower ? 1.1 : 1.45;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));

    // Size from the canvas's own laid-out box, not from window.innerWidth.
    // innerWidth includes the classic scrollbar gutter, so on any desktop that
    // shows one the drawing buffer and the camera aspect described a viewport a
    // few pixels wider than the element actually occupies, and CSS then
    // stretched the render to fit.
    const viewport = () => ({
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    });
    const initialViewport = viewport();
    renderer.setSize(initialViewport.width, initialViewport.height, false);

    // Colour management is ON. It was previously disabled because the
    // transmitted physical meshes rendered almost black under it -- but that
    // was the *symptom* of having no environment map, not a colour bug: a
    // metal or a transmissive surface with nothing to reflect resolves to
    // near-black regardless of the colour pipeline. With the baked studio
    // environment below supplying reflections, the correct linear workflow is
    // what actually makes the glass and titanium read as real materials.
    if (THREE.ColorManagement && "enabled" in THREE.ColorManagement) {
      THREE.ColorManagement.enabled = true;
    }
    if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    } else if ("outputColorSpace" in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Pulled back from 1.05: on a near-white page the problem is never that the
    // scene is too dark, it is that the whites have nowhere left to go. A
    // slightly lower exposure keeps tonal room between an object and the page
    // behind it, which is what makes the forms read at all.
    renderer.toneMappingExposure = 0.97;

    const scene = new THREE.Scene();
    // Transparent canvas over the light page; distance fades to the page ground.
    scene.fog = new THREE.FogExp2(0xf8f6f3, mobile ? 0.019 : 0.0125);

    // Baked once at startup. Assigning it to scene.environment gives every
    // physical material in the scene real reflections, refraction detail and
    // specular rolloff -- the single largest contributor to the surfaces
    // reading as glass/ceramic/metal instead of flat translucent shapes.
    const studio = createStudioEnvironment(renderer);
    scene.environment = studio.texture;

    const camera = new THREE.PerspectiveCamera(45, initialViewport.width / initialViewport.height, 0.1, 240);
    camera.position.set(0, STAGE_A_Y + 3.6, 14.4);
    const clock = new THREE.Clock();

    // The studio environment now supplies the ambient and the reflections, so
    // these lights are only here to shape form: a key for modelling, a rim to
    // separate silhouettes from the white page, and a warm bounce.
    const key = new THREE.DirectionalLight(0xfff7f0, 1.25);
    key.position.set(7, 10, 8);
    scene.add(key);

    // Back-right rim. This is what draws the bright edge along the cube and
    // hand so they do not dissolve into the background.
    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(-7, 4, -9);
    scene.add(rim);

    const warm = new THREE.PointLight(0xf7853f, 0.5, 44, 2);
    warm.position.set(-6, 2, 5);
    scene.add(warm);

    const fill = new THREE.PointLight(0xffffff, 0.32, 34, 2);
    fill.position.set(5, -6, -5);
    scene.add(fill);
    // Kept low deliberately: the environment already lifts the shadows, and
    // more ambient here only flattens the forms back out.
    scene.add(new THREE.AmbientLight(0xf2f0ec, 0.12));

    // The whole reference composition, rebuilt as geometry.
    const automation = createAutomationScene({ mobile, tablet });
    scene.add(automation.root);

    // Live blended mood. GSAP tweens this on section entry so the scene eases
    // between states - no cuts, and it reuses the existing timeline system.
    const mood = { ...DEFAULT_MOOD, still: reducedMotion ? 1 : 0 };
    let moodTween = null;

    // Live blended section weights. Exactly one section is ~1 at a time and
    // the rest ease to 0, which is what lets the scene run ONE story sequence
    // at a time and let it finish before the next begins. Same triggers, same
    // easing convention as the mood above - no new scroll system.
    const sections = { ...DEFAULT_SECTIONS };
    const sectionTarget = {};
    let sectionTween = null;
    const setSection = (id) => {
      SECTION_KEYS.forEach((key) => { sectionTarget[key] = key === id ? 1 : 0; });
      sectionTween?.kill();
      sectionTween = gsap.to(sections, {
        ...sectionTarget,
        duration: 0.9,
        ease: "power2.out",
        overwrite: true,
      });
    };

    // Which industry the visitor has selected, read from the existing nav
    // rather than by changing the Industries component: the button that owns
    // the `active` class is the source of truth the page already maintains.
    let industry = null;
    let industryNav = null;
    let industryObserver = null;
    const readIndustry = () => {
      if (!industryNav) return;
      const buttons = industryNav.querySelectorAll("button");
      for (let i = 0; i < buttons.length; i += 1) {
        if (buttons[i].classList.contains("active")) {
          industry = automation.industries[i % automation.industries.length];
          return;
        }
      }
    };
    const bindIndustryNav = () => {
      if (industryNav) return;
      const nav = document.querySelector("#industries .industry-nav");
      if (!nav) return;
      industryNav = nav;
      industryObserver = new MutationObserver(readIndustry);
      industryObserver.observe(nav, {
        attributes: true, attributeFilter: ["class"], subtree: true,
      });
      readIndustry();
    };

    // Re-measured on every ScrollTrigger refresh, which is exactly when
    // section geometry can have changed (resize, pin spacers, route content).
    let cameraPath = FALLBACK_PATH;
    let beatPath = [];
    const beats = {};
    const measure = () => {
      const maxScroll = ScrollTrigger.maxScroll(window);
      cameraPath = resolveCameraPath(maxScroll) || FALLBACK_PATH;
      beatPath = resolveBeats(maxScroll);
      // Refresh is also the reliable point at which route content is known to
      // be in the DOM, so the industry nav is bound here rather than guessed
      // at mount time.
      bindIndustryNav();
    };

    // Viewport-dependent framing, recomputed on resize so rotating a phone or
    // dragging a desktop window narrow lands on the right composition.
    //   dolly  multiplies the camera distance — further back, smaller objects
    //   lift   raises camera and look target together, dropping the scene
    //          lower in frame so stacked content sits above it
    const framing = { dolly: 1, lift: 0 };
    const measureFraming = () => {
      const w = window.innerWidth;
      if (w < 760) {
        framing.dolly = 1.26;
        framing.lift = 1.5;
      } else if (w < 1200) {
        framing.dolly = 1.12;
        framing.lift = 0.7;
      } else {
        framing.dolly = 1;
        framing.lift = 0;
      }
    };
    measureFraming();

    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pageProgress = 0;
    let serviceTransition = 0;
    let billingMode = false;
    let billingProgress = 0;
    let transitionTween = null;
    let resizeRaf = 0;
    let raf = 0;

    const currentPosition = new THREE.Vector3(0, STAGE_A_Y + 4.2, 15.5);
    const currentLook = new THREE.Vector3(0, STAGE_A_Y - 0.6, 0);
    const desiredPosition = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();

    const setServiceTransition = (target) => {
      transitionTween?.kill();
      const state = { value: serviceTransition };
      transitionTween = gsap.to(state, {
        value: target,
        duration: 0.85,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => { serviceTransition = state.value; },
        onComplete: () => {
          serviceTransition = target;
          transitionTween = null;
        },
      });
    };

    // Unchanged trigger set: one global progress reader plus the existing
    // #services and #billing hooks. No new animation system, no new triggers.
    const triggers = [];
    triggers.push(ScrollTrigger.create({
      trigger: document.documentElement,
      start: 0,
      end: "max",
      onUpdate: (self) => { pageProgress = self.progress; },
    }));

    // The section triggers below are bound to elements that exist only on the
    // route that renders them — every one of them lives on Home. This component
    // is mounted once by PageLayout and deliberately survives navigation (a
    // WebGL context is far too expensive to rebuild per route), so binding them
    // in this mount-once effect meant that entering the site on /about, /contact
    // or a service page and then navigating Home left the scene with no section
    // triggers at all: the mood never changed, the story beats never staged, and
    // the whole scroll narrative silently did nothing for the rest of the visit.
    //
    // So trigger binding is exposed here and re-run per route by the effect
    // below, while the renderer, scene and loop stay untouched.
    bindSectionTriggersRef.current = () => {
      const routeTriggers = [];

      // One trigger per section, purely as a read of which section is on screen.
      // These add no pinning, no scrub and no scroll length - they only decide
      // what the background looks like at a given point.
      SECTION_MOODS.forEach(({ id, energy, spread, calm, veil }) => {
        const element = document.getElementById(id);
        if (!element) return;
        const apply = () => {
          moodTween?.kill();
          moodTween = gsap.to(mood, {
            energy, spread, calm, veil,
            duration: 1.1,
            ease: "power2.out",
            overwrite: true,
          });
          setSection(id);
        };
        routeTriggers.push(ScrollTrigger.create({
          trigger: element,
          start: "top 62%",
          end: "bottom 38%",
          onEnter: apply,
          onEnterBack: apply,
        }));
      });

      const serviceSection = document.querySelector("#services");
      if (serviceSection) {
        routeTriggers.push(ScrollTrigger.create({
          trigger: serviceSection,
          start: "top bottom",
          end: "bottom top",
          onEnter: () => setServiceTransition(1),
          onEnterBack: () => setServiceTransition(1),
          onLeave: () => {},
          onLeaveBack: () => setServiceTransition(0),
        }));
      }

      const billingSection = document.querySelector("#billing");
      if (billingSection) {
        routeTriggers.push(ScrollTrigger.create({
          trigger: billingSection,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          onEnter: () => { billingMode = true; },
          onEnterBack: () => { billingMode = true; },
          onLeave: () => {
            billingMode = false;
            billingProgress = 1;
          },
          onLeaveBack: () => {
            billingMode = false;
            billingProgress = 0;
          },
          onUpdate: (self) => {
            billingProgress = self.progress;
            const early = smootherstep(Math.min(1, self.progress / 0.24));
            serviceTransition = 1 - early;
          },
        }));
      }

      return () => routeTriggers.forEach((trigger) => trigger.kill());
    };

    const onPointer = (event) => {
      pointerTargetX = event.clientX / window.innerWidth - 0.5;
      pointerTargetY = event.clientY / window.innerHeight - 0.5;
    };
    const onTouch = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      pointerTargetX = touch.clientX / window.innerWidth - 0.5;
      pointerTargetY = touch.clientY / window.innerHeight - 0.5;
    };
    // The last viewport this actually re-laid the scene for. Mobile browsers
    // fire `resize` every time the URL bar collapses or expands, i.e. on
    // ordinary scrolling — and ScrollTrigger.refresh() re-measures every
    // trigger on the page, which is the single most expensive thing this
    // component can ask for. Resizing the renderer and camera on every event is
    // cheap and must still happen; the refresh is reserved for a change that
    // can genuinely have moved trigger boundaries.
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const URL_BAR_TOLERANCE = 140;

    const resize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        const { width, height } = viewport();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        measureFraming();

        const layoutChanged = width !== lastWidth || Math.abs(height - lastHeight) > URL_BAR_TOLERANCE;
        lastWidth = width;
        lastHeight = height;
        if (layoutChanged) ScrollTrigger.refresh();
      });
    };

    const render = () => {
      raf = requestAnimationFrame(render);
      if (document.hidden || !renderer) return;

      const rawDelta = Math.min(clock.getDelta(), 0.05);
      // delta drives every idle animation, so zeroing it holds the scene on a
      // still frame while the scroll-mapped camera and staging keep working.
      const delta = reducedMotion ? 0 : rawDelta;
      const elapsed = reducedMotion ? 0 : clock.elapsedTime;
      const parallax = reducedMotion || mobile ? 0 : 1;
      pointerX += (pointerTargetX - pointerX) * 0.055;
      pointerY += (pointerTargetY - pointerY) * 0.055;

      const state = sampleCamera(cameraPath, pageProgress);

      // Beat gates for this frame, from the measured section anchors.
      evaluateBeats(beatPath, pageProgress, beats);

      // Gentle parallax + a slow dolly; never a spin. The billing section adds
      // a small extra push-in rather than relocating the camera, so it layers
      // onto the scroll story instead of fighting it.
      const billingPush = billingMode ? smootherstep(billingProgress) * 0.9 : 0;
      const drift = Math.sin(elapsed * 0.16) * 0.16 * parallax;

      // Narrow-viewport framing. On phones and small tablets the content
      // column is the full width of the screen, so there is no open space
      // beside it for the scene to occupy and no composition that can move the
      // geometry "around" the copy. The only honest levers are distance and
      // height: pull back so every object is smaller and further from the
      // type, and drop the whole scene lower in frame so the stacked heading
      // and card block sits above it rather than on top of it (brief §13).
      const desiredPosZ = state.pos[2] * framing.dolly - billingPush;

      desiredPosition.set(
        state.pos[0] + pointerX * 0.5 * parallax + drift,
        state.pos[1] - pointerY * 0.32 * parallax
          + Math.cos(elapsed * 0.13) * 0.1 * parallax + framing.lift,
        desiredPosZ,
      );
      desiredLook.set(
        state.look[0] + pointerX * 0.18 * parallax,
        state.look[1] - pointerY * 0.12 * parallax + framing.lift,
        state.look[2],
      );

      // One damped follow keeps every state change smooth - no abrupt cuts.
      const damping = 1 - Math.exp(-3.8 * rawDelta);
      currentPosition.lerp(desiredPosition, damping);
      currentLook.lerp(desiredLook, damping);
      camera.position.copy(currentPosition);
      camera.lookAt(currentLook);

      automation.update(
        pageProgress, elapsed, delta, mood,
        beatPath.length ? beats : null,
        sections,
        industry,
      );

      // While the DOM service orbit is on screen, ease the environment back so
      // the foreground UI stays clean. Softened from the previous -3.6 / 0.88:
      // the scene now carries real content at that moment (the connected
      // systems lighting one by one), and pushing it that far back was a large
      // part of why the background read as washed out.
      // Give the hero headline a clear central lane: the primary object stays
      // visible around it, but sits lower and deeper while the hero is active.
      const heroWeight = sections.hero || 0;
      automation.root.position.y = -heroWeight * (mobile ? 1.8 : 1.15);
      automation.root.position.z = -serviceTransition * 2.4 - heroWeight * (mobile ? 2.1 : 1.35);
      automation.root.scale.setScalar(1 - serviceTransition * 0.06 - heroWeight * (mobile ? 0.08 : 0.035));

      renderer.render(scene, camera);
    };

    // Dev-only inspection handle. Shipping it kept the entire scene graph,
    // renderer and three namespace reachable from the console (and pinned in
    // memory) on the production site for no benefit.
    if (import.meta.env.DEV) {
      window.__rth = { scene, camera, renderer, automation, render, THREE, mood, sections };
    }
    window.addEventListener("resize", resize);
    if (!mobile) {
      window.addEventListener("mousemove", onPointer, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
    }

    // Measure once now, then track every refresh. The refresh below fires the
    // listener, so a single up-front measure() is enough — the extra
    // measure()/refresh() pair that used to sit here re-walked every trigger on
    // the page a second time during mount for an identical result.
    ScrollTrigger.addEventListener("refresh", measure);
    measure();
    ScrollTrigger.refresh();
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      reducedMotionQuery.removeEventListener("change", onMotionPreference);
      ScrollTrigger.removeEventListener("refresh", measure);
      bindSectionTriggersRef.current = null;
      delete window.__rth;
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      transitionTween?.kill();
      moodTween?.kill();
      sectionTween?.kill();
      industryObserver?.disconnect();
      gsap.killTweensOf(mood);
      gsap.killTweensOf(sections);
      triggers.forEach((trigger) => trigger.kill());
      automation.dispose();
      scene.environment = null;
      studio.dispose();
      window.removeEventListener("resize", resize);
      if (!mobile) {
        window.removeEventListener("mousemove", onPointer);
        window.removeEventListener("touchmove", onTouch);
      }

      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose?.());
      });
      renderer.dispose();
    };
  }, []);

  // Re-bind the section triggers for whichever route is now mounted. The scene,
  // renderer and render loop above are untouched by this — only the reads of
  // "which section is on screen" are rebuilt, against the elements that
  // actually exist right now.
  useEffect(() => {
    const unbind = bindSectionTriggersRef.current?.();
    ScrollTrigger.refresh();
    return () => unbind?.();
  }, [routePath]);

  return <canvas ref={ref} id="three-canvas" className="three-background" aria-hidden="true" />;
}
