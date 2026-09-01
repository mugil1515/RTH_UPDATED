import { useLayoutEffect, useRef } from "react";
import { problems } from "@/data/problems";
import SectionHeading from "@/components/common/SectionHeading";
import { revealOnScroll } from "@/animations/scrollAnimations";
export default function Problems(){ const ref=useRef(null); useLayoutEffect(()=>{const a=revealOnScroll(ref.current,'.problem-chip',{stagger:.07}); return()=>a?.kill();},[]); return <section ref={ref} id="problems" className="scene problems-section"><div className="section-inner"><SectionHeading eyebrow="The Cost of Manual Work"><h2 className="display-l">WHAT&apos;S SLOWING<br/>YOUR BUSINESS DOWN?</h2></SectionHeading><div className="problem-grid">{problems.map(p=><div className="problem-chip" key={p}><i/>{p}</div>)}</div><div className="problem-transform"><span/><b className="mono">RTH INTELLIGENCE LAYER</b></div></div></section> }
