import { siteConfig } from "@/data/siteConfig";
import SectionHeading from "@/components/common/SectionHeading";
import ContactForm from "@/sections/Contact/ContactForm";
export default function Contact(){return <section id="contact" className="scene contact-section"><div className="section-inner"><SectionHeading eyebrow="Let's Build"><h2 className="display-l">READY TO AUTOMATE<br/>YOUR BUSINESS?</h2></SectionHeading><ContactForm/><div className="final-brand"><span className="mono">RTH INFOTECH PVT LTD</span><h3>{siteConfig.brand.tagline}</h3></div></div></section>}
