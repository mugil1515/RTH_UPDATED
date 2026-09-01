import { Link } from "react-router-dom";
import SEO from "@/components/common/SEO";
export default function NotFound(){return <section className="not-found"><SEO title="404 — RTH Infotech"/><span className="eyebrow">404 / Signal Lost</span><h1>THIS SYSTEM<br/>DOESN&apos;T EXIST.</h1><Link to="/">RETURN TO RTH CORE →</Link></section>}
