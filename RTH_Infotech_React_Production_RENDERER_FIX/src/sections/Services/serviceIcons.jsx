import { BrainCircuit, PanelsTopLeft, Smartphone, Network, CloudCog, ChartNoAxesCombined, Cable, Infinity, ShieldCheck, BadgeCheck, Workflow } from "lucide-react";
const map={BrainCircuit,PanelsTopLeft,Smartphone,Network,CloudCog,ChartNoAxesCombined,Cable,Infinity,ShieldCheck,BadgeCheck,Workflow};
export function ServiceIcon({name,size=28}){const Icon=map[name]||Workflow;return <Icon size={size} strokeWidth={1.5}/>}
