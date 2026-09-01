import { useLayoutEffect, useRef } from "react";
import { agentConfig } from "@/data/agent";
import SectionHeading from "@/components/common/SectionHeading";
import { mountAgentAnimation } from "@/animations/agentAnimations";
export default function Agent(){const ref=useRef(null);useLayoutEffect(()=>mountAgentAnimation(ref.current),[]);return <section ref={ref} id="agent" className="scene agent-section"><div className="section-inner"><SectionHeading eyebrow="Autonomous Execution"><h2 className="display-l">DON&apos;T JUST ANSWER.<br/>ACT.</h2></SectionHeading><div className="agent-flow mono">{agentConfig.flow.map((x,i)=><span key={x}>{i>0&&<em>→</em>}<b>{x}</b></span>)}</div><div className="agent-log glass-card mono">{agentConfig.logs.map(([line,type])=><div className={`agent-log-line ${type}`} key={line}>&gt; {line}</div>)}</div></div></section>}
