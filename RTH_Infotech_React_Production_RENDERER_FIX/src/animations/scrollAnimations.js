import { gsap, ScrollTrigger } from "@/animations/gsapConfig";
export function revealOnScroll(root, selector, options = {}) {
  const items = root.querySelectorAll(selector);
  if (!items.length) return null;
  return gsap.fromTo(items, { opacity: 0, y: options.y ?? 42, filter: "blur(7px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: .72, stagger: options.stagger ?? .08, ease: "power3.out", scrollTrigger: { trigger: root, start: options.start ?? "top 72%", once: options.once ?? true } });
}
export { ScrollTrigger };
