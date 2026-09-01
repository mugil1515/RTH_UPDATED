import { company } from "@/data/company";
export default function Footer(){return <footer className="site-footer"><span>© {company.year} {company.name}</span><span>{company.location}</span></footer>}
