import { Navigate, Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/common/SEO";
import { getServiceBySlug } from "@/data/services";
import ServiceVisual from "@/sections/Services/ServiceVisual";
import Button from "@/components/common/Button";

export default function ServiceDetails() {
  const { slug } = useParams();
  const service = getServiceBySlug(slug);

  if (!service) return <Navigate to="/404" replace />;

  return (
    <>
      <SEO title={`${service.title} — RTH Infotech`} description={service.description} />
      <article className="service-detail-page">
        <Link className="back-link" to="/services">
          <ArrowLeft size={16} /> ALL SERVICES
        </Link>
        <div className="service-detail-grid">
          <div>
            <span className="eyebrow">{service.tag}</span>
            <h1 className="display-l">{service.title}</h1>
            <p className="lead-copy">{service.description}</p>
            <div className="metric-row">{service.metrics.map((x) => <span key={x}>{x}</span>)}</div>
            <Button to="/contact">BUILD WITH RTH</Button>
          </div>
          <ServiceVisual service={service} />
        </div>
        <div className="detail-sections">
          <section>
            <h2>Capabilities</h2>
            <div className="capability-grid">{service.features.map((x) => <span key={x}>{x}</span>)}</div>
          </section>
          <section>
            <h2>Engineering tools</h2>
            <div className="tool-cloud">{service.tools.map((x) => <span key={x}>{x}</span>)}</div>
          </section>
          <section>
            <h2>Delivery process</h2>
            <div className="process-row">
              {service.process.map((x, i) => <span key={x}><b>{String(i + 1).padStart(2, "0")}</b>{x}</span>)}
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
