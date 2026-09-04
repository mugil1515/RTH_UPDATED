# RTH Automation Story — standalone explainer video

> **Note:** the site's "Watch the system work" viewer now plays the recorded
> homepage background animation instead — see [BACKGROUND_VIDEO.md](BACKGROUND_VIDEO.md).
> The authored explainer below is still built, rendered and kept in
> `public/videos/rth-automation-story-*.mp4`; point `SOURCES` in
> `src/components/story/StoryVideo.jsx` back at those files to ship it instead.

Two MP4s that explain the RTH automation concept end to end with no voiceover
and no website foreground content — just the 3D world and eight stage labels.

| | file | size | frame |
|---|---|---|---|
| Desktop / web | `public/videos/rth-automation-story-desktop.mp4` | 1920×1080 (16:9) | 41s @ 30fps, H.264 |
| Mobile | `public/videos/rth-automation-story-mobile.mp4` | 1080×1920 (9:16) | 41s @ 30fps, H.264 |

Both cuts tell the **same complete story on the same clock**. The mobile file is
not a crop, a zoom or a reduction of the desktop file — it is a separately
composed vertical staging of the same world, rendered with its own camera.

## The eight beats

| # | label | what the picture says | t |
|---|---|---|---|
| 1 | BUSINESS INPUT | invoice, email, customer, transaction, database ride into the machine and are consumed | 0.0–5.6 |
| 2 | RTH INTELLIGENCE | the glass/titanium chamber materialises and takes the data in | 5.6–10.6 |
| 3 | PROCESSING | scan sweep → data points extracted → analysis settles | 10.6–16.0 |
| 4 | DECISION | three routes appear, are weighed, exactly one locks to orange | 16.0–21.0 |
| 5 | EXECUTE | control arms → robotic hand approaches → **press** → button depresses → activation pulse | 21.0–26.2 |
| 6 | AUTOMATED ACTION | invoice, email, reminder, workflow are produced, then checked | 26.2–31.4 |
| 7 | SYSTEM UPDATE | orange pulses travel core → CRM, Email, Accounting, Analytics, Follow-up; small green confirmations | 31.4–36.6 |
| 8 | COMPLETE | the whole connected ecosystem circulating calmly | 36.6–41.0 |

Nothing downstream of the press shows progress before it: the click is what
starts execution, which is the point of the shot.

## Where the pieces live

```
src/story/timeline.js     the beat table + ramp/pulse helpers (one clock, three consumers)
src/story/layout.js       the two compositions — positions and per-beat cameras
src/story/storyScene.js   the 3D world; update(t) is a pure function of t
src/story/storyOverlay.js the stage labels, drawn in 2D over the frame
src/story/main.js         /story.html entry: live preview, or headless frame source
story.html                render source page (dev-only; not part of the site build)
scripts/render-story.mjs  headless Chrome frame-stepper + ffmpeg encode
```

The scene imports the site's own `businessObjects.js` and `studioEnvironment.js`,
so the video and the live page share one visual language by construction.

## Re-rendering

```bash
npm run render:story              # both cuts (~10 min)
node scripts/render-story.mjs mobile
node scripts/render-story.mjs desktop --frames=42 --every=30   # fast probe: one frame per second
node scripts/render-story.mjs desktop --frames=4 --every=9 --start=22.4   # probe one beat
```

Needs a system Chrome (set `CHROME_PATH` if it is somewhere unusual);
`ffmpeg-static` and `puppeteer-core` are dev dependencies. Frames are stepped at
exact `t = i / 30` rather than screen-recorded, so pacing is independent of how
fast the render machine happened to be.

Preview without encoding: `npm run dev`, then
`http://localhost:5173/story.html?variant=mobile`.

## Site integration

`src/components/story/StoryVideo.jsx` adds a **Watch the system work** control
to the hero CTA row and owns the full-screen viewer.

- The viewer is **portalled to `<body>`**. The hero's GSAP entrance leaves
  transforms on its ancestors, and a transformed ancestor becomes the containing
  block for `position: fixed` — rendered in place, the overlay pinned itself to
  the hero's box instead of the viewport.
- Covers the whole viewport (`inset: 0`, `100dvh`, `z-index: 1000` — above the
  site's highest layer, `--z-loader: 100`), opaque `#fbfaf8`. No page content
  shows through: no hero, cards, chatbot or footer.
- `≥768px` plays the desktop cut, `<768px` the mobile cut (re-picked on
  breakpoint change, but never mid-playback).
- Video is `width/height: 100%` + `object-fit: contain` — letterboxed, never
  cropped or stretched, in either aspect.
- **HOME** (top-left) always ends on `/`: it stops playback, drops the source,
  closes the viewer, and router-navigates only if the user was on another route.
  **X** (top-right) and ESC just close and leave the page where it was.
- `preload="metadata"` — neither file is fetched in full until the viewer opens;
  closing removes the source so no download or playback survives it.
- Exits and controls clear the notch and home indicator via
  `env(safe-area-inset-*)`; every control is a ≥44px target.
- Closing restores scroll (including Lenis) to the exact previous position,
  clears the body lock, and reloads nothing.
- The viewer renders **no** three.js — the page's existing scroll-driven
  background scene is untouched and keeps running exactly as before.

Verified in headless Chrome at 1920×1080, 1440×900, 1366×768, 1024×768,
768×1024, 440×956, 390×844 and 360×800: full-viewport overlay, correct source
per breakpoint, autoplay running, HOME on-screen at ≥44px, no horizontal
overflow, and after HOME no viewer, no video element, body unlocked, scroll
restored, zero console errors.
