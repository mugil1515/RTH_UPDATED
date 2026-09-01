import { gsap } from "@/animations/gsapConfig";
export function createHeroAnimation(root) {
  const ctx = gsap.context(() => {
    const chars = root.querySelectorAll(".hero-char");
    gsap.set(chars, { opacity: 0, y: 70, rotateX: -72, rotateY: 18, transformOrigin: "50% 60%" });
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.to(".hero-brand", { opacity: 1, y: 0, duration: .55 }, .1)
      .to(chars, { opacity: 1, y: 0, rotateX: 0, rotateY: 0, duration: .9, stagger: .027 }, .2)
      .to(".hero-lead", { opacity: 1, y: 0, duration: .65 }, .62)
      .to(".hero-ctas", { opacity: 1, y: 0, duration: .65 }, .74)
      .to(".hero-capabilities", { opacity: .8, y: 0, duration: .5 }, .9)
      .to(".scroll-cue", { opacity: .8, duration: .5 }, 1.05);
    return tl;
  }, root);
  return () => ctx.revert();
}
