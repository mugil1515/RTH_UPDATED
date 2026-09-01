import { ServiceIcon } from "@/sections/Services/serviceIcons";

export default function ServiceNode({ service, point, onOpen, index, isActive }) {
  // True radial label placement: each label is pushed straight out along its
  // own node's angle (not just up/down), so it lands in that node's own
  // empty outward wedge instead of drifting into a neighbouring circle.
  // Push distance (15cqw) is sized against the label box's own half-width
  // (max(58px,12.5cqw)/2 = 6.25cqw) plus the node icon's radius (5cqw), so
  // even a purely horizontal push (the tightest case -- the box's full
  // width sits perpendicular to the gap) still clears the circle edge by a
  // few cqw rather than nearly touching it.
  const labelDx = `${(point.ux * 15).toFixed(2)}cqw`;
  const labelDy = `${(point.uy * 15).toFixed(2)}cqw`;

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
              "--label-x": labelDx,
              "--label-y": labelDy,
              transform: "translate(-50%, -50%) translate(var(--label-x), var(--label-y))",
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
