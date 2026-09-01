import { gsap } from "@/animations/gsapConfig";
export function mountBillingAnimation(root) {
  const ctx=gsap.context(()=>{
    const steps=gsap.utils.toArray(".billing-step");
    const tl=gsap.timeline({ scrollTrigger:{ trigger:root, start:"top 55%", end:"bottom 55%", scrub:.7 } });
    tl.fromTo(".invoice-card",{opacity:0,x:-70,scale:.9},{opacity:1,x:0,scale:1,duration:1})
      .fromTo(".status-stack",{opacity:0,x:70},{opacity:1,x:0,duration:.7},.15);
    steps.forEach((step,i)=>{ tl.to(step,{opacity:1,color:"#b8480a",duration:.18},.55+i*.18).to(step.querySelector(".status-check"),{backgroundColor:"#eb6217",borderColor:"#eb6217",boxShadow:"0 0 0 4px rgba(235,98,23,.12)",duration:.15},.6+i*.18); });
  },root); return()=>ctx.revert();
}
