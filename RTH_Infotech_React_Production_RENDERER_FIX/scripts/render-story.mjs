// Offline renderer: turns /story.html into the two shipped MP4s.
//
//   node scripts/render-story.mjs            both cuts
//   node scripts/render-story.mjs mobile     one cut
//
// WHY FRAME-STEPPING AND NOT SCREEN RECORDING
// A real-time capture inherits every hitch of the machine that recorded it,
// and the brief explicitly asks for no visible stutter. Here the page's clock
// is driven by us: each frame is rendered at an exact t = i / FPS, read back
// as a PNG, and piped into ffmpeg. The result is perfectly paced regardless of
// how fast (or slow) the render itself ran.
//
// Requires headless Chrome (system install) and the bundled ffmpeg binary.

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
const PORT = 5199;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const wanted = argv.filter((a) => !a.startsWith("-"));
// --frames=N renders a short probe instead of the full cut, and --every=N
// samples the timeline rather than stepping it, so a probe can cover all
// eight beats without waiting on ~1230 frames.
const numArg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(name + "="));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const FRAME_LIMIT = numArg("--frames", 0);
const EVERY = numArg("--every", 1);
// --start=SECONDS offsets a probe onto the beat being tuned.
const START = numArg("--start", 0);
const VARIANTS = wanted.length ? wanted : ["desktop", "mobile"];

/* ---- dev server ---------------------------------------------------------
 * Vite serves story.html and resolves the "@/" alias exactly as the app does,
 * so the render uses the same module graph the site does. No build step, and
 * no second copy of the scene to keep in sync.
 */
function startVite() {
  return new Promise((resolve, reject) => {
    // Launched as a direct node child rather than through npx: on Windows the
    // shell wrapper survives kill() and leaves vite holding the port, so the
    // next run dies on --strictPort.
    const proc = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
        "--port", String(PORT), "--strictPort"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
    proc.stdout.on("data", (d) => {
      if (/Local:.*http/i.test(String(d))) done(resolve, proc);
    });
    proc.stderr.on("data", (d) => process.stderr.write(`[vite] ${d}`));
    proc.on("exit", (code) => done(reject, new Error(`vite exited early (${code})`)));
    setTimeout(() => done(resolve, proc), 15000);
  });
}

async function renderVariant(browser, variant) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(`  [page] ${e.message}`));
  const url = `http://localhost:${PORT}/story.html?variant=${variant}&headless=1`;
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForFunction("window.rthStory && window.rthStory.ready", { timeout: 120000 });
  await page.evaluate(() => window.rthStory.ready);

  const meta = await page.evaluate(() => ({
    width: window.rthStory.width,
    height: window.rthStory.height,
    duration: window.rthStory.duration,
    fps: window.rthStory.fps,
  }));

  const frameDir = path.join(TMP, variant);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const full = Math.round(meta.duration * meta.fps);
  const total = FRAME_LIMIT ? Math.min(FRAME_LIMIT, Math.ceil(full / EVERY)) : full;
  console.log(`\n${variant}: ${meta.width}x${meta.height}, ${total} frames @ ${meta.fps}fps`);

  for (let i = 0; i < total; i += 1) {
    const t = START + (i * EVERY) / meta.fps;
     
    const dataUrl = await page.evaluate((time) => window.rthStory.frame(time), t);
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
     
    await writeFile(path.join(frameDir, `f${String(i).padStart(5, "0")}.png`), buf);
    if (i % 30 === 0 || i === total - 1) {
      process.stdout.write(`\r  frame ${i + 1}/${total}`);
    }
  }
  process.stdout.write("\n");
  await page.close();

  await mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `rth-automation-story-${variant}.mp4`);
  await encode(frameDir, outFile, meta.fps, variant);
  await rm(frameDir, { recursive: true, force: true });
  console.log(`  -> ${path.relative(ROOT, outFile)}`);
}

function encode(frameDir, outFile, fps, variant) {
  // yuv420p + faststart: the combination every browser and phone will actually
  // play inline. CRF 20 keeps the near-white gradients clean - the palette is
  // mostly flat light tones, which is exactly where heavy compression bands.
  // The 9:16 cut carries twice the pixel height and is the one most likely to
  // be opened on cellular, so it trades one CRF step for a third off the file.
  const crf = variant === "mobile" ? "23" : "20";
  const args = [
    "-y", "-framerate", String(fps),
    "-i", path.join(frameDir, "f%05d.png"),
    "-c:v", "libx264", "-preset", "slow", "-crf", crf,
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
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

const vite = await startVite();
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: [
    "--no-sandbox",
    // Headless Chrome falls back to SwiftShader without these; the scene uses
    // transmission + PMREM, which software GL renders wrong and very slowly.
    "--enable-gpu",
    "--use-angle=default",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
  ],
});

try {
  for (const variant of VARIANTS) {
     
    await renderVariant(browser, variant);
  }
} finally {
  await browser.close();
  vite.kill();
  await rm(TMP, { recursive: true, force: true });
}
console.log("\ndone");
process.exit(0);
