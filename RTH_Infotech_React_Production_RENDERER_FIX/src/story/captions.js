// Stage captions for the recorded background animation.
//
// The animation itself is untouched: these are labels laid over it, and they
// are anchored to the SAME things the scene is anchored to, so a caption can
// never describe a stage the picture is not showing.
//
//   section anchors  -> storyboard.sectionProgress(), the exact function that
//                       places the camera keyframes
//   agent anchors    -> the #agent scroll window ("top 62%" .. "bottom 38%")
//                       and actionSequence.js's own phase constants, so
//                       "EXECUTE" lands on the press and "AUTOMATED ACTION"
//                       lands on what the press started
//
// Guessing fractions of total scroll would drift the moment a section's height
// or the viewport changed. Nothing here is guessed.

import { sectionProgress } from "@/components/effects/ai3d/storyboard";

// From actionSequence.js. Mirrored rather than imported because that module
// keeps them private, and because a caption boundary is a different decision
// from an animation boundary even when the numbers agree.
const T_APPROACH = 0.15; // hand starts moving toward the control
const T_CLICK = 0.36;    // button bottoms out - the process starts HERE
const T_ACT = 0.80;      // the messages have arrived

// One sentence each, plain language, no engineering vocabulary.
// `at` is either ["section", id, align] or ["agent", phase].
export const CAPTIONS = [
  {
    id: "input",
    title: "Business Input",
    line: "Business data and manual tasks enter the automation system.",
    from: ["section", "hero", 0.0], to: ["section", "problems", 0.01],
  },
  {
    id: "intelligence",
    title: "RTH Intelligence",
    line: "RTH brings business data into one intelligent processing layer.",
    from: ["section", "problems", 0.05], to: ["section", "problems", 0.50],
  },
  {
    id: "processing",
    title: "Processing",
    line: "The system analyses data, identifies the workflow and prepares the next step.",
    from: ["section", "problems", 0.54], to: ["section", "problems", 1.0],
  },
  {
    id: "connected",
    title: "Connected Intelligence",
    line: "One intelligence core connects automation, software, cloud, APIs, analytics and business systems.",
    from: ["section", "services", 0.06], to: ["section", "services", 0.96],
  },
  {
    id: "billing",
    title: "Automatic Bill Generation",
    line: "Transaction data is analysed, tax is calculated, the invoice is generated, emailed, confirmed on WhatsApp and synced with accounting — automatically.",
    from: ["section", "billing", 0.06], to: ["section", "billing", 0.95],
  },
  {
    id: "ready",
    title: "Ready to Execute",
    line: "The workflow is prepared and waiting for execution.",
    from: ["agent", 0.0], to: ["agent", T_APPROACH - 0.02],
  },
  {
    id: "execute",
    title: "Execute",
    line: "The trigger starts the automated business process.",
    from: ["agent", T_APPROACH], to: ["agent", T_CLICK + 0.10],
  },
  {
    id: "action",
    title: "Automated Action",
    line: "RTH carries out the required actions instead of only providing an answer.",
    from: ["agent", T_CLICK + 0.13], to: ["agent", T_ACT - 0.02],
  },
  {
    id: "update",
    title: "System Update",
    line: "Connected business systems update automatically as the workflow completes.",
    from: ["agent", T_ACT], to: ["agent", 1.0],
  },
  {
    id: "industries",
    title: "Built Around Your Workflow",
    line: "The same intelligence adapts to different industries and business processes.",
    from: ["section", "industries", 0.12], to: ["section", "industries", 0.98],
  },
  {
    id: "discovery",
    title: "Process Discovery",
    line: "RTH turns repeatable manual processes into automated workflows.",
    from: ["section", "analyzer", 0.06], to: ["section", "analyzer", 0.96],
  },
  {
    id: "final",
    title: "Connected Business",
    line: "RTH connects data, decisions, actions and systems into one automated business ecosystem.",
    tagline: "AI that runs your business.",
    from: ["section", "company", 0.05], to: ["end"],
  },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Turn the anchors above into concrete progress windows for the page as it is
 * laid out right now. Re-run this on resize or after a ScrollTrigger refresh.
 */
export function resolveCaptions() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const vh = window.innerHeight;

  // The #agent section's own scroll window, matching the ScrollTrigger that
  // drives the hand exactly ("top 62%" to "bottom 38%").
  const agent = document.getElementById("agent");
  let agentAt = null;
  if (agent) {
    const rect = agent.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const start = top - vh * 0.62;
    const end = top + rect.height - vh * 0.38;
    agentAt = (phase) => clamp01((start + phase * (end - start)) / maxScroll);
  }

  const at = (anchor) => {
    if (!anchor) return null;
    const [kind, a, b] = anchor;
    if (kind === "end") return 1;
    if (kind === "agent") return agentAt ? agentAt(a) : null;
    const p = sectionProgress(a, b, maxScroll);
    return p === null ? null : clamp01(p);
  };

  return CAPTIONS
    .map((c) => {
      const from = at(c.from);
      const to = at(c.to);
      if (from === null || to === null || to <= from) return null;
      return { ...c, from, to };
    })
    .filter(Boolean)
    .sort((a, b) => a.from - b.from);
}

/**
 * Which caption is showing at `progress`, and how opaque it is.
 *
 * Opacity is computed here rather than left to a CSS transition on purpose:
 * the offline recorder drives the page on a virtual clock, and CSS transitions
 * run on the browser's own real-time timeline - they would resolve within a
 * single captured frame and turn every fade into a hard cut.
 */
export function captionAt(resolved, progress) {
  for (let i = 0; i < resolved.length; i += 1) {
    const c = resolved[i];
    if (progress < c.from || progress > c.to) continue;
    const span = c.to - c.from || 1;
    const local = (progress - c.from) / span;
    // Fade proportionally to the window's length, capped so a long section
    // does not spend four seconds fading in.
    const edge = Math.min(0.14, 0.9 / (span * 100 || 1));
    // The first caption is already on screen at frame 0 - there is nothing
    // before it to fade from, and a fade-in there just opens the video blank.
    const rise = c.from <= 0 ? 1 : local / edge;
    // ...and the closing caption holds to the last frame rather than fading out
    // into an unlabelled final state, which is the shot the whole video builds to.
    const fall = c.to >= 1 ? 1 : (1 - local) / edge;
    const opacity = Math.min(rise, fall, 1);
    return { caption: c, opacity: clamp01(opacity), local };
  }
  return { caption: null, opacity: 0, local: 0 };
}
