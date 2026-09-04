// Records the REAL homepage background animation, top to bottom, as video.
//
//   node scripts/render-background.mjs            both cuts
//   node scripts/render-background.mjs mobile     one cut
//   node scripts/render-background.mjs desktop --seconds=50
//   node scripts/render-background.mjs desktop --probe=9      9 frames, evenly spaced
//
// WHAT THIS IS
// Not a re-implementation of the scene. It loads the actual site at
// /?animationStory=1 (export mode: foreground hidden, layout and scroll height
// untouched), then walks the page's own scroll position from 0 to max and
// screenshots each frame. Every camera keyframe, mood tween, story beat, the
// hand's approach and press, the billing and service staging - all of it comes
// from the site's own GSAP/ScrollTrigger/three.js code, unmodified.
//
// WHY A VIRTUAL CLOCK
// The scene's idle motion, damping and GSAP tweens all read wall-clock time. A
// capture that takes 300ms per frame would therefore advance the idle
// animation ten times too fast and land the tweens somewhere different from
// where a real visitor sees them. So performance.now/Date.now and
// requestAnimationFrame are replaced before the app boots with a clock this
// script pumps by exactly 1/fps per captured frame. The page cannot tell the
// difference from real-time playback, and the output is frame-exact and
// judder-free no matter how slow the machine is.

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import ffmpegPath from "ffmpeg-static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "videos");
const TMP = path.join(ROOT, ".story-frames");
const PORT = 5198;
const FPS = 30;

const argv = process.argv.slice(2);
const num = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const VARIANTS = argv.filter((a) => !a.startsWith("-")).length
  ? argv.filter((a) => !a.startsWith("-"))
  : ["desktop", "mobile"];
const SECONDS = num("--seconds", 50);
// A probe renders N evenly spaced frames across the whole scroll instead of the
// full cut - the fast way to check composition and coverage.
const PROBE = num("--probe", 0);
const KEEP_FRAMES = argv.includes("--keep-frames");

// CSS viewport x deviceScaleFactor = the captured pixel size. Mobile is
// driven at a 540px CSS width ON PURPOSE: the site switches to its mobile
// scene tier and mobile framing at < 760px, so capturing at a literal 1080px
// CSS width would have recorded the DESKTOP composition at phone proportions.
// 540 x 960 at dsf 2 gives the mobile composition and an exact 1080 x 1920 file.
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  mobile: { width: 540, height: 960, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Camera pull-back applied ONLY to the export (brief §12: fix mobile clipping
// just enough that every stage stays visible). At the live mobile framing the
// robotic hand and the outer system modules sit past the 9:16 edge, because on
// a phone the scene is behind the copy rather than being the subject.
const EXPORT_DOLLY = { desktop: 1, mobile: 1.5 };
// Share of the live vertical lift to keep. Mobile drops the scene low to sit
// under the copy column; with no copy on screen that only wastes the top of
// the frame, so the export re-centres it.
const EXPORT_LIFT = { desktop: 1, mobile: 0.15 };

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.");
  process.exit(1);
}

/* ---- dev server --------------------------------------------------------- */
function startVite() {
  return new Promise((resolve, reject) => {
    // Direct node child, not npx: on Windows the shell wrapper survives kill()
    // and leaves vite holding the port.
    const proc = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
        "--port", String(PORT), "--strictPort"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
    proc.stdout.on("data", (d) => { if (/Local:.*http/i.test(String(d))) done(resolve, proc); });
    proc.stderr.on("data", (d) => process.stderr.write(`[vite] ${d}`));
    proc.on("exit", (code) => done(reject, new Error(`vite exited early (${code})`)));
    setTimeout(() => done(resolve, proc), 20000);
  });
}

/* ---- virtual clock, installed before any page script runs --------------- */
const VIRTUAL_CLOCK = `(() => {
  let now = 0;
  const queue = new Map();
  let nextId = 1;
  const realNow = performance.now.bind(performance);
  const epoch = Date.now();

  performance.now = () => now;
  Date.now = () => epoch + now;
  const RealDate = Date;
  window.Date = new Proxy(RealDate, {
    construct(target, args) {
      return args.length ? new target(...args) : new target(epoch + now);
    },
  });
  window.Date.now = () => epoch + now;

  window.requestAnimationFrame = (cb) => { const id = nextId++; queue.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };

  // One tick = one video frame. Callbacks registered during a tick run on the
  // NEXT tick, exactly as a real rAF loop behaves.
  window.__vtick = (ms) => {
    now += ms;
    const due = [...queue.entries()];
    queue.clear();
    due.forEach(([, cb]) => { try { cb(now); } catch (e) { console.error(e); } });
    return now;
  };
  window.__vnow = () => now;
  // setTimeout(0)-style work still needs to drain; leave timers on real time,
  // they are only used for one-shot setup in this app.
  window.__realNow = realNow;
})();`;

async function renderVariant(browser, variant) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

  await page.setViewport(VIEWPORTS[variant]);
  await page.evaluateOnNewDocument(VIRTUAL_CLOCK);
  await page.goto(`http://localhost:${PORT}/?animationStory=1`, {
    waitUntil: "networkidle2", timeout: 120000,
  });

  // Boot: pump frames until the scene exists, the fonts are in and
  // ScrollTrigger has measured the real section anchors.
  await page.evaluate(async (fps) => {
    const step = 1000 / fps;
    for (let i = 0; i < 240; i += 1) {
      window.__vtick(step);
      // Yield to the event loop so module loading, layout and the WebGL
      // context creation can actually proceed between ticks.
       
      await new Promise((r) => setTimeout(r, 0));
      if (document.querySelector("#three-canvas") && document.fonts?.status === "loaded") break;
    }
  }, FPS);

  await page.waitForFunction(
    "document.documentElement.classList.contains('rth-export') && !!document.querySelector('#three-canvas')",
    { timeout: 60000 },
  );

  const info = await page.evaluate(async (fps, dollyMultiplier, liftMultiplier) => {
    const step = 1000 / fps;
    // Let every section trigger, pin and spacer settle, then re-measure - this
    // is the same refresh the site does, and it is what anchors the storyboard.
    for (let i = 0; i < 90; i += 1) {
      window.__vtick(step);
       
      await new Promise((r) => setTimeout(r, 0));
    }
    window.__rthExportDolly = dollyMultiplier;
    window.__rthExportLift = liftMultiplier;
    window.__rthLenis?.scrollTo(0, { immediate: true });
    const st = window.ScrollTrigger || window.__rth?.ScrollTrigger;
    return {
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      hasLenis: !!window.__rthLenis,
      hasScene: !!window.__rth,
      st: !!st,
    };
  }, FPS, EXPORT_DOLLY[variant] ?? 1, EXPORT_LIFT[variant] ?? 1);

  const total = PROBE || Math.round(SECONDS * FPS);
  const frameDir = path.join(TMP, `bg-${variant}`);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  console.log(`\n${variant}: ${VIEWPORTS[variant].width}x${VIEWPORTS[variant].height}, ` +
    `${total} frames, scroll 0..${info.maxScroll}px${PROBE ? " (probe)" : ""}`);

  for (let i = 0; i < total; i += 1) {
    // Scroll distance maps proportionally to time: the video advances through
    // the page at a constant rate, which is what preserves the relative length
    // of every section exactly as the page lays them out.
    const progress = total === 1 ? 0 : i / (total - 1);
     
    await page.evaluate(async (p, fps, probe) => {
      const step = 1000 / fps;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.round(p * max);
      if (window.__rthLenis) window.__rthLenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
      // A probe jumps across the page, so the damped camera and the scrubbed
      // hand phase need a moment to converge on the new position; a real run
      // advances one frame, exactly like playback.
      const ticks = probe ? 40 : 1;
      for (let k = 0; k < ticks; k += 1) {
        window.__vtick(step);
         
        if (probe) await new Promise((r) => setTimeout(r, 0));
      }
      await new Promise((r) => setTimeout(r, 0));
    }, progress, FPS, PROBE > 0);

     
    const buf = await page.screenshot({ type: "png", optimizeForSpeed: true });
     
    await writeFile(path.join(frameDir, `f${String(i).padStart(5, "0")}.png`), buf);
    if (i % 30 === 0 || i === total - 1) process.stdout.write(`\r  frame ${i + 1}/${total}`);
  }
  process.stdout.write("\n");
  if (errors.length) console.log(`  page errors: ${[...new Set(errors)].slice(0, 4).join(" | ")}`);
  await page.close();

  await mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `rth-background-animation-${variant}.mp4`);
  await encode(frameDir, outFile, variant);
  // The viewer's poster, so opening it shows the first frame instead of an
  // empty letterbox while the decoder starts. Half-size and JPEG: it is only
  // ever seen for the fraction of a second before real frames arrive.
  await poster(frameDir, outFile.replace(/\.mp4$/, ".jpg"));
  if (!KEEP_FRAMES) await rm(frameDir, { recursive: true, force: true });
  console.log(`  -> ${path.relative(ROOT, outFile)}`);
  return frameDir;
}

function encode(frameDir, outFile, variant) {
  // The 9:16 cut is twice the pixel height and the one most likely to be opened
  // on cellular, so it trades one CRF step for a smaller file.
  const crf = variant === "mobile" ? "23" : "20";
  const args = [
    "-y", "-framerate", String(FPS),
    "-i", path.join(frameDir, "f%05d.png"),
    "-c:v", "libx264", "-preset", "slow", "-crf", crf,
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
    "-movflags", "+faststart", "-an",
    outFile,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-2000)))));
  });
}

function poster(frameDir, outFile) {
  const args = [
    "-y", "-i", path.join(frameDir, "f00001.png"),
    "-frames:v", "1", "-vf", "scale=iw/2:-2", "-q:v", "6",
    outFile,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-2000)))));
  });
}

const vite = await startVite();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-gpu",
    "--use-angle=default",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1",
  ],
});

try {
  for (const variant of VARIANTS) {
     
    await renderVariant(browser, variant);
  }
} finally {
  await browser.close();
  vite.kill();
  if (!KEEP_FRAMES) await rm(TMP, { recursive: true, force: true });
}
console.log("\ndone");
process.exit(0);
