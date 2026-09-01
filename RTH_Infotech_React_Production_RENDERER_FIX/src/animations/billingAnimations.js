import { gsap } from "@/animations/gsapConfig";
export function mountBillingAnimation(root) {
  const ctx=gsap.context(()=>{
    const steps=gsap.utils.toArray(".billing-step");
    const tl=gsap.timeline({ scrollTrigger:{ trigger:root, start:"top 55%", end:"bottom 55%", scrub:.7 } });
    tl.fromTo(".invoice-card",{opacity:0,x:-70,scale:.9},{opacity:1,x:0,scale:1,duration:1})
      .fromTo(".status-stack",{opacity:0,x:70},{opacity:1,x:0,duration:.7},.15);
    steps.forEach((step,i)=>{ tl.to(step,{opacity:1,color:"#d9a8ff",duration:.18},.55+i*.18).to(step.querySelector(".status-check"),{backgroundColor:"#c13eff",boxShadow:"0 0 15px rgba(193,62,255,.6)",duration:.15},.6+i*.18); });
  },root); return()=>ctx.revert();
}
