# RTH background animation — recorded top to bottom

The homepage's own scroll-driven background scene, played automatically as a
standalone video. This is **not** a second animation: the frames come from the
real site, running its real GSAP/ScrollTrigger/three.js code, with the
foreground turned off.

| | file | frame |
|---|---|---|
| Desktop / web | `public/videos/rth-background-animation-desktop.mp4` | 1920×1080 (16:9), 50s @ 30fps, H.264 |
| Mobile | `public/videos/rth-background-animation-mobile.mp4` | 1080×1920 (9:16), 50s @ 30fps, H.264 |

These are the two files the site's **Watch the system work** viewer plays.

## How it works

```
/?animationStory=1     export mode: foreground hidden, layout untouched
scripts/render-background.mjs   walks scroll 0 → max, one screenshot per frame
```

**Export mode** (`src/hooks/useExportMode.js` + `src/styles/export.css`) adds one
class to `<html>` and hides everything React renders under `#root` except the
background layer, with `visibility: hidden`.

> Why `visibility` and not `display`: the whole storyboard is anchored to the
> *measured* positions of the real sections — `storyboard.js` resolves camera
> keyframes and story beats from live `getBoundingClientRect` plus
> `ScrollTrigger.maxScroll`. `display: none` would change every section height
> and the document's scroll length, moving every anchor and producing a
> different animation. `visibility: hidden` keeps the layout, the scroll height
> and every trigger boundary identical, and only stops the paint.

The content scrim and focus veil are switched off (they exist to protect copy
that is no longer on screen), the **JSON / LIVE DATA streams are removed
entirely** (`display: none`, so nothing can survive as a faint ghost — the live
site keeps them exactly as they are), and the canvas gets a marginal contrast
lift. No geometry, order, beat or timing is touched.

**The recorder** replaces `performance.now`, `Date.now` and
`requestAnimationFrame` *before the app boots* with a virtual clock it pumps by
exactly 1/30s per captured frame. The page cannot tell the difference from
real-time playback, so idle motion, camera damping, GSAP tweens and the scrubbed
hand phase all land exactly where a visitor sees them — and the output is
frame-exact no matter how slow the capture machine is.

Scroll maps to time proportionally (constant px/second), so every section keeps
the relative length the page gives it — no section is stretched or compressed.

## Stage captions

`src/story/captions.js` + `src/story/StoryCaptions.jsx` lay a short title and one
sentence over the animation — mounted only in export mode, never on the live
site. Twelve stages: Business Input, RTH Intelligence, Processing, Connected
Intelligence, Automatic Bill Generation, Ready to Execute, Execute, Automated
Action, System Update, Built Around Your Workflow, Process Discovery, Connected
Business (closing on "AI that runs your business.").

Each caption's window is **measured, never a guessed fraction of the page**:

- section stages resolve through `storyboard.sectionProgress()` — the same
  function that places the camera keyframes;
- the four stages inside `#agent` resolve through that section's own scroll
  window ("top 62%" … "bottom 38%") and `actionSequence.js`'s phase constants,
  so EXECUTE lands on the press (T_CLICK 0.36) and AUTOMATED ACTION lands on
  what the press started.

Placement is per format: desktop bottom-left (the camera keeps the machine
centre/right for the whole storyboard, so that corner never carries the core,
the control or the hand); mobile in the top safe area with larger type and a
shorter measure — not the desktop coordinates re-used. Opacity is computed in JS
from scroll position rather than by a CSS transition, because the recorder's
virtual clock would collapse a CSS fade into a single frame.

## Two export-only adjustments

Both are guarded by `isExportMode()` and are inert on a normal visit:

1. **Pixel ratio** (`ThreeBackground.jsx`): the live cap is a per-frame budget
   guard (1.1× on phones). Offline there is no frame budget, and a phone-width
   capture upscaled from a 1.1× buffer lands in the MP4 visibly soft, so the
   export renders at full ratio.
2. **Mobile framing** (`__rthExportDolly` / `__rthExportLift`): on the live site
   the phone framing pulls in and drops the scene low so it sits under the copy
   column — which lets the robotic hand and the outer system modules run past
   the 9:16 edge. That is fine when the copy is the subject; it is not fine in a
   video whose subject *is* the scene. The export moves the camera back (×1.5)
   and keeps only 15% of the vertical lift. Camera only: no object, order, beat
   or timing changes.

## Re-recording

```bash
npm run render:background                       # both cuts (~25 min)
node scripts/render-background.mjs mobile
node scripts/render-background.mjs desktop --seconds=60
node scripts/render-background.mjs desktop --probe=9 --keep-frames   # 9 frames, 0…100%
```

`--probe=N` captures N evenly spaced frames across the whole page — the fast way
to check coverage and composition. `--keep-frames` leaves the PNGs in
`.story-frames/` for inspection. Needs a system Chrome (`CHROME_PATH` if it is
somewhere unusual); `puppeteer-core` and `ffmpeg-static` are dev dependencies.

To watch export mode live in a browser: `npm run dev`, then
`http://localhost:5173/?animationStory=1` and scroll — that is exactly what gets
recorded.

## What it does not change

Normal site mode is untouched: without `?animationStory=1` the export class is
never set, both export globals are undefined, and the pixel-ratio cap is the
value it always was. Scroll animation, layout, CTAs, forms, service pages,
chatbot, logo, colours and routes are all unmodified.
