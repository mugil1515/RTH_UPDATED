// Entry point for /story.html.
//
// Two modes, one code path:
//   preview  - plays in real time in a browser, for reviewing the cut
//   headless - exposes window.rthStory so scripts/render-story.mjs can step the
//              clock frame by frame and read exact PNGs off the canvas
//
// The composite canvas is the single source of output: three.js draws into an
// offscreen WebGL canvas, that gets blitted here, then the labels are drawn on
// top. Preview and MP4 therefore cannot drift apart.

import * as THREE from "three";
import { createStoryScene } from "./storyScene";
import { drawOverlay } from "./storyOverlay";
import { DURATION, FPS } from "./timeline";
import { getLayout } from "./layout";

const params = new URLSearchParams(location.search);
const variant = params.get("variant") === "mobile" ? "mobile" : "desktop";
const headless = params.get("headless") === "1";
const L = getLayout(variant);

const gl = document.createElement("canvas");
gl.width = L.width;
gl.height = L.height;

const renderer = new THREE.WebGLRenderer({
  canvas: gl,
  antialias: true,
  alpha: false,
  // Frames are read back with toDataURL, which requires the drawing buffer to
  // still hold the last frame after present.
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(L.width, L.height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Slightly under 1.0: the palette is near-white already, and anything above
// this blows the ceramic and glass out into flat paper.
renderer.toneMappingExposure = 0.96;

const story = createStoryScene(renderer, { variant });

const out = document.getElementById("out");
out.width = L.width;
out.height = L.height;
const ctx = out.getContext("2d", { alpha: false });

function renderAt(t) {
  story.update(t);
  renderer.render(story.scene, story.camera);
  ctx.drawImage(gl, 0, 0);
  drawOverlay(ctx, t, { variant, width: L.width, height: L.height });
}

if (headless) {
  // Fonts must be resolved before the first label is drawn, or the renderer
  // captures a fallback face on early frames and the type jumps mid-video.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();
  window.rthStory = {
    variant, width: L.width, height: L.height, duration: DURATION, fps: FPS,
    ready: ready.then(() => { renderAt(0); return true; }),
    frame(t) {
      renderAt(t);
      return out.toDataURL("image/png");
    },
  };
} else {
  const start = performance.now();
  const loop = () => {
    const t = ((performance.now() - start) / 1000) % DURATION;
    renderAt(t);
    requestAnimationFrame(loop);
  };
  loop();
}
