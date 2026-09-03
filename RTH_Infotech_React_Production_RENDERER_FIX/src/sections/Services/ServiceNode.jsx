import { ServiceIcon } from "@/sections/Services/serviceIcons";

export default function ServiceNode({ service, point, onOpen, index, isActive }) {
  // True radial label placement: each label is pushed straight out along its
  // own node's angle, so it lands in that node's own empty outward wedge
  // instead of drifting into a neighbouring circle.
  //
  // Only the DIRECTION is set here (and re-set every frame by
  // mountServiceOrbit as the ring turns). The DISTANCE is computed in CSS
  // from the label box's own extent along that direction — see
  // `--label-push` in animations.css. A single flat push distance cannot be
  // right at every angle: the label is a wide, short rectangle, so the same
  // number that clears the icon sideways throws the label far too high above
  // a node at the top of the ring, and the ring rotates continuously, so
  // every label passes through every angle.
  const abs = (n) => Math.abs(n).toFixed(4);

  return (
    <div className="service-node-slot" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
      <button
        type="button"
        data-service-id={service.id}
        data-index={index}
        className={`service-node${isActive ? " is-active" : ""}`}
        onClick={(e) => onOpen(service, e.currentTarget)}
        aria-label={`Explore ${service.title}`}
      >
        <span className="service-node-content">
          <span className="service-icon"><ServiceIcon name={service.icon} /></span>
          <span
            className="service-label"
            style={{
              "--ux": point.ux.toFixed(4),
              "--uy": point.uy.toFixed(4),
              "--ax": abs(point.ux),
              "--ay": abs(point.uy),
            }}
          >
            {service.labelBreak.map((x, i) => (
              <span key={x}>{x}{i < service.labelBreak.length - 1 && <br />}</span>
            ))}
          </span>
        </span>
      </button>
    </div>
  );
}
