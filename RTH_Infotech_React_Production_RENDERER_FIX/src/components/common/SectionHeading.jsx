export default function SectionHeading({ eyebrow, children, description, align="center" }) {
  return <div className={`section-heading ${align === "left" ? "text-left" : "text-center"}`}><span className="eyebrow">{eyebrow}</span>{children}{description && <p className="section-description">{description}</p>}</div>;
}
