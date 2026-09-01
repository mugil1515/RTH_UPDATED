// Single source of geometry for the service orbit: node slots, connector
// endpoints and the pop-out travel direction are all derived from this.
export function getServicePosition(index, count, radius = 37, startAngle = -90) {
  const angle = startAngle + (360 / count) * index;
  const radians = (angle * Math.PI) / 180;
  const ux = Math.cos(radians);
  const uy = Math.sin(radians);
  return { angle, ux, uy, xPct: 50 + ux * radius, yPct: 50 + uy * radius };
}

export function getOrbitPoint(index, count, radius = 37, startAngle = -90) {
  const p = getServicePosition(index, count, radius, startAngle);
  return { angle: p.angle, x: p.xPct, y: p.yPct, ux: p.ux, uy: p.uy };
}

// SVG connector layer shares a 1000x1000 viewBox centered at (500,500) --
// 1% of the orbit box equals 10 SVG units, so this reuses the exact same
// percentage radius instead of a separately-tuned constant.
export function getSvgOrbitPoint(index, count, radius = 37, startAngle = -90) {
  const p = getServicePosition(index, count, radius, startAngle);
  return { x: 500 + p.ux * radius * 10, y: 500 + p.uy * radius * 10 };
}
