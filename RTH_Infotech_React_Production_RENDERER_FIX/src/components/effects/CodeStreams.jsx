import { useEffect, useRef } from "react";
import { gsap } from "@/animations/gsapConfig";

const payloads = [
  { rth_ai: { status: "online", mode: "business_automation", confidence: 0.98, realtime: true } },
  { agent: { id: "RTH-AGENT-07", connected: ["CRM", "Billing", "Email"], tasks_pending: 13, autonomous: true } },
  { invoice_automation: { order: "RTH-2084", subtotal: 18500, gst: 3330, total: 21830, delivery: ["email", "whatsapp"] } },
  { analytics: { forecast: "revenue_growth", confidence: 0.87, signal: "deploy_automation", latency_ms: 42 } },
  { document_intelligence: { extract: true, classify: true, validate: true, sync: "enterprise_core" } },
  { support_ai: { channel: "omnichannel", intent: "customer_resolution", reasoning: "active", resolved: true } },
  { system: { company: "RTH INFOTECH", intelligence: "adaptive", automation: true, services_online: 12 } },
].map((value) => JSON.stringify(value, null, 2));

export default function CodeStreams() {
  const ref = useRef(null);

  useEffect(() => {
    const nodes = Array.from(ref.current?.querySelectorAll(".code-text") || []);
    if (!nodes.length) return undefined;

    const timers = new Set();
    const tweens = new Set();
    let cancelled = false;

    const timeout = (fn, ms) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const typeText = (node, text, done) => {
      let position = 0;
      node.parentElement?.classList.add("is-typing");
      node.textContent = "";
      const textNode = document.createTextNode("");
      node.appendChild(textNode);

      const type = () => {
        if (cancelled) return;
        if (document.hidden) {
          timeout(type, 180);
          return;
        }
        if (position < text.length) {
          const chunkSize = text.charAt(position) === "\n" ? 1 : 3 + Math.floor(Math.random() * 3);
          const next = Math.min(text.length, position + chunkSize);
          textNode.data += text.slice(position, next);
          const hasNewline = text.slice(position, next).includes("\n");
          position = next;
          timeout(type, hasNewline ? 68 : 34);
        } else {
          node.parentElement?.classList.remove("is-typing");
          timeout(done, 1800 + Math.random() * 1600);
        }
      };
      type();
    };

    nodes.forEach((node, streamIndex) => {
      let payloadIndex = streamIndex % payloads.length;
      const cycle = () => {
        const root = node.parentElement;
        const fadeOut = gsap.to(root, {
          opacity: 0.55,
          duration: 0.45,
          ease: "power2.out",
          onComplete: () => {
            tweens.delete(fadeOut);
            typeText(node, payloads[payloadIndex], () => {
              payloadIndex = (payloadIndex + 1 + streamIndex) % payloads.length;
              const fadeIn = gsap.to(root, {
                opacity: 0.92,
                duration: 0.65,
                ease: "power2.out",
                onComplete: () => tweens.delete(fadeIn),
              });
              tweens.add(fadeIn);
              timeout(cycle, 1200 + Math.random() * 1600);
            });
          },
        });
        tweens.add(fadeOut);
      };

      timeout(() => {
        typeText(node, payloads[payloadIndex], () => {
          payloadIndex = (payloadIndex + 1 + streamIndex) % payloads.length;
          timeout(cycle, 1400 + streamIndex * 380);
        });
      }, 500 + streamIndex * 900);
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      tweens.forEach((tween) => tween.kill());
    };
  }, []);

  return (
    <div ref={ref} id="code-bg" className="code-streams" aria-hidden="true">
      {[1, 2, 3, 4].map((index) => (
        <pre key={index} className={`code-stream code-stream-${index} s${index}`}>
          <span className="code-heading">JSON • LIVE DATA</span>
          <code className="code-text" />
        </pre>
      ))}
    </div>
  );
}
