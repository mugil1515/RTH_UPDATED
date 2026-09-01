import { Link, useNavigate } from "react-router-dom";
import SEO from "@/components/common/SEO";
import SectionHeading from "@/components/common/SectionHeading";
import ServiceUniverse from "@/sections/Services/ServiceUniverse";
import { services } from "@/data/services";

export default function ServicesPage() {
  const navigate = useNavigate();
  const openCatalogueService = (event, route) => {
    event.preventDefault();
    navigate(route, { state: { returnTo: { pathname: "/services", scrollY: window.scrollY } } });
  };

  return (
    <>
      <SEO
        title="Services — RTH Infotech"
        description="Explore RTH Infotech AI, web, mobile, enterprise, cloud, data, cybersecurity and transformation services."
      />
      <section className="page-hero">
        <SectionHeading eyebrow="RTH Intelligence Layer">
          <h1 className="display-l">SYSTEMS ENGINEERED<br />AROUND YOUR BUSINESS</h1>
        </SectionHeading>
        <ServiceUniverse compact />
      </section>
      <section className="service-catalogue">
        {services.map((service, index) => (
          <Link
            className="catalogue-card glass-card"
            to={service.route}
            onClick={(event) => openCatalogueService(event, service.route)}
            key={service.id}
          >
            <span className="mono">{String(index + 1).padStart(2, "0")}</span>
            <h2>{service.title}</h2>
            <p>{service.description}</p>
            <b>{service.focus} →</b>
          </Link>
        ))}
      </section>
    </>
  );
}
