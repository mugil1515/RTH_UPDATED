export default function ServiceConnector({ x, y, index }) {
  return <line className="service-connector" data-index={index} x1="500" y1="500" x2={x} y2={y} />;
}
