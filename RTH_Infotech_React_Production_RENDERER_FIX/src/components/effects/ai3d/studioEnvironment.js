// Studio environment + grounding helpers for the RTH automation background.
//
// WHY THIS EXISTS
// The scene is built almost entirely from glass, clearcoat acrylic, ceramic and
// brushed titanium. Every one of those materials derives most of its appearance
// from what it *reflects*, not from direct lights:
//
//   * a metal (metalness ~0.8+) has no diffuse response at all. With nothing in
//     the environment to reflect, it renders as a dead flat shape — which is
//     exactly why the titanium joints and ring lips read as lifeless.
//   * transmission/refraction needs surroundings to bend, or the glass looks
//     like plain low-opacity plastic.
//   * clearcoat is a pure specular layer — no environment, no highlight.
//
// So instead of adding more lights (which only blows out the whites on an
// already-bright page), we render a small physical studio ONCE into a PMREM
// cubemap and hand it to the scene. Cost is a single one-off render at startup;
// the payoff is real reflections, real refraction and real specular rolloff on
// every surface, every frame.
//
// The room is deliberately built to match the site: a white cyclorama, large
// soft overhead and side softboxes, a warm RTH-orange bounce card low on the
// left, and a faint grey floor so verticals pick up a subtle gradient rather
// than a uniform wash.

import * as THREE from "three";

const ORANGE = 0xeb6217;

/** A flat emissive panel — stands in for a softbox in the reflected room. */
function panel(width, height, color, intensity, position, lookAt) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
  mesh.material.color.multiplyScalar(intensity);
  mesh.position.set(...position);
  if (lookAt) mesh.lookAt(...lookAt);
  return mesh;
}

/**
 * Build the studio and bake it to a PMREM cube.
 * Returns the texture plus a disposer — the caller assigns it to
 * `scene.environment` so every physical material picks it up automatically.
 */
export function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const room = new THREE.Scene();
  const parts = [];
  const add = (mesh) => { room.add(mesh); parts.push(mesh); return mesh; };

  // Cyclorama: a large inverted box so there is always something to reflect.
  // Kept below pure white so the glass keeps tonal separation from the page.
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(24, 16, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f0ed, side: THREE.BackSide }),
  );
  add(shell);

  // Slightly darker floor. This is what gives the glass and ceramic a gradient
  // from bright top to soft bottom instead of a uniform flat tone.
  add(panel(24, 24, 0xd8d5d0, 1, [0, -7.9, 0], [0, 10, 0]));

  // Key softbox, large and overhead-front.
  add(panel(14, 9, 0xffffff, 3.1, [0, 7.6, 3], [0, -10, 0]));
  // Fill from camera left, cooler and much softer.
  add(panel(10, 10, 0xf4f6f8, 1.35, [-9, 1.5, 4], [10, 0, 0]));
  // Rim/kicker from behind right — this is what draws the bright edge line
  // along the cube and hand silhouettes.
  add(panel(7, 9, 0xffffff, 2.4, [8.5, 2.5, -6], [-10, 0, 6]));

  // Warm RTH bounce card, low and left. Reads as the orange energy of the core
  // spilling onto surrounding surfaces rather than as a coloured light.
  add(panel(8, 4, ORANGE, 1.5, [-6, -3, 4.5], [6, 2, 0]));
  // A second, weaker warm accent opposite it keeps the orange from looking
  // like it only comes from one side.
  add(panel(5, 3, 0xf7853f, 0.75, [6.5, -2.5, 3], [-6, 1, 0]));

  const target = pmrem.fromScene(room, 0.035);

  parts.forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  pmrem.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/**
 * Soft contact shadow texture — a radial falloff drawn on a canvas.
 *
 * Real shadow maps are the wrong tool here: the casters are transparent glass
 * (which produces a wrong, hard silhouette), and a light bright enough to cast
 * on a white page produces an ugly hard edge. A blurred blob under each
 * platform is both cheaper and closer to how a soft studio actually grounds an
 * object — and grounding is most of what "sitting in real space" reads as.
 */
export function createContactShadowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Warm grey rather than neutral black: a neutral shadow on a warm white page
  // reads as dirt, a warm one reads as depth.
  gradient.addColorStop(0, "rgba(110, 97, 85, 0.6)");
  gradient.addColorStop(0.42, "rgba(110, 97, 85, 0.28)");
  gradient.addColorStop(0.72, "rgba(110, 97, 85, 0.08)");
  gradient.addColorStop(1, "rgba(110, 97, 85, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
