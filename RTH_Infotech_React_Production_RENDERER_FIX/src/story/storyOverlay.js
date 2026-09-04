// Stage labels, drawn in 2D over the rendered frame.
//
// WHY 2D AND NOT IN-SCENE TEXT
// The labels are the only words in the whole piece, so they have to be
// pixel-crisp at both 1920x1080 and 1080x1920. Canvas text is exact at any
// output size and costs nothing; a textured plane in the 3D scene would be
// resampled, would pick up the camera's parallax, and would drift out of the
// mobile safe area the moment the camera reframes.
//
// The overlay is composited into the SAME canvas that the encoder reads, so
// what you see in the browser preview is bit-for-bit what lands in the MP4.

import { BEATS, beatsAt, ramp, clamp01 } from "./timeline";

const ORANGE = "#eb6217";
const INK = "#3d3934";
const MUTED = "rgba(61, 57, 52, 0.28)";

/** Mobile safe area, per the brief: 8% top/bottom, 6% left/right. */
export const SAFE = { mobile: { x: 0.06, y: 0.08 }, desktop: { x: 0.05, y: 0.06 } };

export function drawOverlay(ctx, t, { variant, width, height }) {
  const mobile = variant === "mobile";
  const safe = mobile ? SAFE.mobile : SAFE.desktop;
  const padX = width * safe.x;
  const padY = height * safe.y;
  // One scale factor drives every size below, so the two cuts are typographic
  // siblings rather than one being a shrunken copy of the other.
  const u = mobile ? width / 1080 * 1.18 : width / 1920;

  const b = beatsAt(t);
  const beat = BEATS[b.index];

  // Each label fades in as its beat starts and out as it ends, so the words
  // never linger over the next stage's action.
  const dur = beat.end - beat.start;
  const local = clamp01((t - beat.start) / dur);
  const alpha = ramp(local, 0, 0.10) * (1 - ramp(local, 0.90, 1));
  // Small upward settle on entry - the only motion the type ever makes.
  const rise = (1 - ramp(local, 0, 0.16)) * 10 * u;

  ctx.save();
  ctx.textBaseline = "alphabetic";

  /* ---- stage label ----------------------------------------------------
   * Desktop labels sit bottom-left, out of the way of a story that runs left
   * to right. Mobile puts them at the TOP instead: the vertical composition
   * drives the action down the frame, so the bottom is exactly where the
   * routes, the button and the executed work live - a label there sat on top
   * of the thing it was naming.
   */
  const x = mobile ? width / 2 : padX;
  const y = mobile ? padY + 108 * u : height - padY - 40 * u;
  ctx.textAlign = mobile ? "center" : "left";
  ctx.globalAlpha = alpha;

  // Index: gives the viewer a sense of "how far through the explanation am I"
  // without a paragraph of narration.
  ctx.fillStyle = ORANGE;
  ctx.font = `600 ${22 * u}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillText(`0${b.index + 1} / 0${BEATS.length}`, x, y - 46 * u + rise);

  ctx.fillStyle = INK;
  ctx.font = `600 ${54 * u}px "Space Grotesk", Inter, system-ui, sans-serif`;
  const prevLetter = ctx.letterSpacing;
  try { ctx.letterSpacing = `${5 * u}px`; } catch { /* non-Chromium: fine without */ }
  ctx.fillText(beat.label, x, y + rise);
  try { ctx.letterSpacing = prevLetter ?? "0px"; } catch { /* ignore */ }

  /* ---- progress rail --------------------------------------------------- */
  // Eight ticks, one per stage. Filled ticks are the stages already explained.
  ctx.globalAlpha = 1;
  const railW = mobile ? width - padX * 2 : Math.min(520 * u, width * 0.3);
  const railX = padX;
  const railY = mobile ? padY + 132 * u : height - padY - 4 * u;
  const gap = 6 * u;
  const seg = (railW - gap * (BEATS.length - 1)) / BEATS.length;
  BEATS.forEach((s, i) => {
    const done = i < b.index ? 1 : i === b.index ? clamp01((t - s.start) / (s.end - s.start)) : 0;
    const sx = railX + i * (seg + gap);
    ctx.fillStyle = MUTED;
    ctx.fillRect(sx, railY, seg, 3 * u);
    if (done > 0) {
      ctx.fillStyle = ORANGE;
      ctx.fillRect(sx, railY, seg * done, 3 * u);
    }
  });

  /* ---- corner mark ----------------------------------------------------- */
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = INK;
  ctx.textAlign = mobile ? "center" : "right";
  ctx.font = `600 ${20 * u}px "JetBrains Mono", ui-monospace, monospace`;
  try { ctx.letterSpacing = `${4 * u}px`; } catch { /* ignore */ }
  ctx.fillText(
    "RTH INFOTECH",
    mobile ? width / 2 : width - padX,
    mobile ? height - padY : padY,
  );
  try { ctx.letterSpacing = "0px"; } catch { /* ignore */ }

  ctx.restore();
}
