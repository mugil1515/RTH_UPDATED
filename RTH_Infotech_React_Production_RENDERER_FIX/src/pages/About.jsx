import SEO from "@/components/common/SEO";
import Company from "@/sections/Company/Company";
import { company } from "@/data/company";
export default function About(){return <><SEO title="About — RTH Infotech" description={company.description}/><div className="page-spacer"/><Company/><section className="about-stack glass-card"><span className="eyebrow">Engineering Stack</span><h2>THE LAYER BEHIND THE INTELLIGENCE.</h2><p>{company.engineeringStack.join(' · ')}</p></section></>}
