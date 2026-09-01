import { useState } from "react";
import { industries } from "@/data/industries";
import SectionHeading from "@/components/common/SectionHeading";
import IndustryPanel from "@/sections/Industries/IndustryPanel";
export default function Industries(){const [active,setActive]=useState(industries[0].id);const current=industries.find(x=>x.id===active);return <section id="industries" className="scene industries-section"><div className="section-inner wide"><SectionHeading eyebrow="Built For Your Industry"><h2 className="display-l">SYSTEMS THAT FIT<br/>HOW YOU WORK</h2></SectionHeading><div className="industries-layout"><div className="industry-nav">{industries.map((x,i)=><button className={active===x.id?'active':''} onClick={()=>setActive(x.id)} key={x.id}><span className="mono">{String(i+1).padStart(2,'0')}</span><b>{x.label}</b><i>→</i></button>)}</div><IndustryPanel key={active} industry={current}/></div></div></section>}
