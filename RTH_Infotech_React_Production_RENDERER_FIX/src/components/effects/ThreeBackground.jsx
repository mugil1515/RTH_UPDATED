import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap, ScrollTrigger } from "@/animations/gsapConfig";
import { createAIIntelligenceScene } from "@/components/effects/aiIntelligenceScene";

const CAMERA_PATH = [
  { p: 0, pos: [0, 0, 14], look: [0, 0, 0] },
  { p: 0.12, pos: [1.2, 0.4, 11], look: [0, 0, -1] },
  { p: 0.24, pos: [-1, 0.2, 8], look: [0, 0, -2] },
  { p: 0.34, pos: [-0.15, 0.25, 5.8], look: [0, 0, -0.4] },
  { p: 0.38, pos: [0.1, 0.22, 5.25], look: [0, 0, -0.8] },
  { p: 0.42, pos: [0.18, 0.18, 4.75], look: [0, 0, -1.2] },
  { p: 0.46, pos: [0.08, 0.14, 4.25], look: [0, 0, -1.7] },
  { p: 0.5, pos: [-0.05, 0.1, 3.65], look: [0, 0, -2.3] },
  { p: 0.55, pos: [-0.35, 0.12, 2.45], look: [-0.2, 0, -3.5] },
  { p: 0.62, pos: [-1.6, 0.45, -2.4], look: [-1.4, 0, -7] },
  { p: 0.72, pos: [1.5, -0.3, -6], look: [2, 0, -10] },
  { p: 0.82, pos: [0, 0.6, -8], look: [0, 0, -14] },
  { p: 0.9, pos: [0, 0, -4], look: [0, 0, -8] },
  { p: 1, pos: [0, 0, 10], look: [0, 0, 0] },
];

const mix = (a, b, t) => a + (b - a) * t;
const mixVec = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smoothstep = (t) => t * t * (3 - 2 * t);
const smootherstep = (t) => {
  const p = Math.max(0, Math.min(1, t));
  return p * p * p * (p * (p * 6 - 15) + 10);
};

function sampleCamera(progress) {
  const p = Math.max(0, Math.min(1, progress));
  for (let index = 0; index < CAMERA_PATH.length - 1; index += 1) {
    const start = CAMERA_PATH[index];
    const end = CAMERA_PATH[index + 1];
    if (p >= start.p && p <= end.p) {
      const local = smoothstep((p - start.p) / (end.p - start.p || 1));
      return { pos: mixVec(start.pos, end.pos, local), look: mixVec(start.look, end.look, local) };
    }
  }
  const last = CAMERA_PATH[CAMERA_PATH.length - 1];
  return { pos: last.pos, look: last.look };
}

export default function ThreeBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const mobile = window.innerWidth < 760;
    const cpu = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    const lowPower = mobile || cpu <= 4 || memory <= 4;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !lowPower,
        alpha: true,
        powerPreference: "high-performance",
        precision: "highp",
      });
    } catch {
      canvas.style.display = "none";
      return undefined;
    }

    const pixelRatioCap = lowPower ? 1.1 : 1.45;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // The original single-file build was compiled against pre-r152 Three.js.
    // Keep its legacy color pipeline; newer r152+ color management makes the
    // transmitted physical meshes read much darker / almost black.
    if (THREE.ColorManagement && "enabled" in THREE.ColorManagement) {
      THREE.ColorManagement.enabled = false;
    }
    if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    } else if ("outputColorSpace" in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0610, mobile ? 0.018 : 0.012);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 14);
    const clock = new THREE.Clock();

    const key = new THREE.DirectionalLight(0xfff9ff, 1.4);
    key.position.set(6, 8, 10);
    scene.add(key);

    const violet = new THREE.PointLight(0x8f32e6, 6, 40, 2);
    violet.position.set(-6, -2, 4);
    scene.add(violet);

    const lavender = new THREE.PointLight(0xd9a8ff, 3, 30, 2);
    lavender.position.set(4, -4, -6);
    scene.add(lavender);
    scene.add(new THREE.AmbientLight(0x170b20, 1.2));

    // Exact central background object from the original single-file build.
    const core = new THREE.Group();
    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1d1026,
      metalness: 0.1,
      roughness: 0.15,
      transmission: 0.92,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      ior: 1.4,
      envMapIntensity: 1.2,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 2), shellMaterial);
    core.add(shell);

    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x281335, metalness: 0.9, roughness: 0.26 });
    const rings = new THREE.Group();
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6 + index * 0.28, 0.02, 10, 64), ringMaterial);
      ring.rotation.x = (Math.PI / 2) * (index / 3) + index * 0.5;
      ring.rotation.y = index * 0.8;
      rings.add(ring);
    }
    core.add(rings);

    const orbiters = [];
    const orbiterMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a1b4d,
      metalness: 0.85,
      roughness: 0.32,
      emissive: 0x8f32e6,
      emissiveIntensity: 0.06,
    });
    for (let index = 0; index < 5; index += 1) {
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), orbiterMaterial);
      node.userData = {
        radius: 3.1 + Math.random() * 0.6,
        angle: (index / 5) * Math.PI * 2,
        speed: 0.08 + Math.random() * 0.05,
        yFreq: 0.5 + Math.random(),
        yAmp: 0.4 + Math.random() * 0.5,
      };
      orbiters.push(node);
      core.add(node);
    }

    // Procedural "AI Intelligence Layer" visual set. Replaces the original centre
    // blob (4 cubes + translucent inner sphere) and the meaningless floating
    // props with an AI brain / intelligence core, extra orbital ring highlights
    // and a set of small AI objects. All of it is built in aiIntelligenceScene.js
    // and only plugged into the EXISTING scene graph + loop below — the shell,
    // the orbit `rings`, the `orbiters`, `pulse`, `stars`, the camera path and
    // every scroll / service / billing transform are left exactly as they were.
    const aiScene = createAIIntelligenceScene({ mobile });
    core.add(aiScene.brainGroup);   // inherits core rotation / scroll scale / z push
    core.add(aiScene.ringGroup);    // orbit-ring highlights; orientation synced to `rings` in update()

    const pulseMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff9ff,
      emissive: 0xd9a8ff,
      emissiveIntensity: 2.2,
    });
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), pulseMaterial);
    core.add(pulse);
    core.add(new THREE.PointLight(0xd9a8ff, 8, 12, 2));
    scene.add(core);

    // Floating props — the original generic panels / cubes / dot clusters are
    // replaced by the procedural AI objects from aiIntelligenceScene.js (AI chip,
    // data cube, agent node, process + analytics HUD panels, neural cluster,
    // data streams, wireframe data nodes). They plug into this same `floating`
    // list so the existing loop keeps owning their rotation + service-fade, and
    // their finer internal motion runs from aiScene.update(). Approximate count
    // and placement mirror what was here before.
    const floating = [];
    aiScene.sceneGroups.forEach((group) => scene.add(group));
    aiScene.floating.forEach((item) => {
      scene.add(item.mesh);
      floating.push(item);
    });

    const starCount = mobile ? 130 : 420;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 40;
      starPositions[index * 3 + 1] = (Math.random() - 0.5) * 40;
      starPositions[index * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xd9a8ff,
      size: 0.02,
      transparent: true,
      opacity: 0.32,
      sizeAttenuation: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const grid = new THREE.GridHelper(60, 40, 0x2a223b, 0x16111f);
    grid.position.y = -6;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.08;
    });
    scene.add(grid);

    // These values mirror S/T/M/x in the original animation bundle.
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pageProgress = 0;
    let serviceTransition = 0;
    let billingMode = false;
    let billingProgress = 0;
    let previousTransition = -1;
    let transitionTween = null;
    let resizeRaf = 0;
    let raf = 0;

    const currentPosition = new THREE.Vector3(0, 0, 14);
    const currentLook = new THREE.Vector3(0, 0, 0);
    const desiredPosition = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    let coreBaseScale = 1;

    const setServiceTransition = (target) => {
      transitionTween?.kill();
      const state = { value: serviceTransition };
      transitionTween = gsap.to(state, {
        value: target,
        duration: 0.85,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => { serviceTransition = state.value; },
        onComplete: () => {
          serviceTransition = target;
          transitionTween = null;
        },
      });
    };

    const triggers = [];
    const globalTrigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 0,
      end: "max",
      onUpdate: (self) => { pageProgress = self.progress; },
    });
    triggers.push(globalTrigger);

    const serviceSection = document.querySelector("#services");
    if (serviceSection) {
      triggers.push(ScrollTrigger.create({
        trigger: serviceSection,
        start: "top bottom",
        end: "bottom top",
        onEnter: () => setServiceTransition(1),
        onEnterBack: () => setServiceTransition(1),
        onLeave: () => {},
        onLeaveBack: () => setServiceTransition(0),
      }));
    }

    const billingSection = document.querySelector("#billing");
    if (billingSection) {
      triggers.push(ScrollTrigger.create({
        trigger: billingSection,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onEnter: () => { billingMode = true; },
        onEnterBack: () => { billingMode = true; },
        onLeave: () => {
          billingMode = false;
          billingProgress = 1;
        },
        onLeaveBack: () => {
          billingMode = false;
          billingProgress = 0;
        },
        onUpdate: (self) => {
          billingProgress = self.progress;
          const early = smootherstep(Math.min(1, self.progress / 0.24));
          serviceTransition = 1 - early;
        },
      }));
    }

    const onPointer = (event) => {
      pointerTargetX = event.clientX / window.innerWidth - 0.5;
      pointerTargetY = event.clientY / window.innerHeight - 0.5;
    };
    const onTouch = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      pointerTargetX = touch.clientX / window.innerWidth - 0.5;
      pointerTargetY = touch.clientY / window.innerHeight - 0.5;
    };
    const resize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        ScrollTrigger.refresh();
      });
    };

    const render = () => {
      raf = requestAnimationFrame(render);
      if (document.hidden || !renderer) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      pointerX += (pointerTargetX - pointerX) * 0.055;
      pointerY += (pointerTargetY - pointerY) * 0.055;

      let state;
      if (billingMode) {
        const p = smootherstep(billingProgress);
        state = {
          pos: mixVec([0.08, 0.22, 5.25], [-0.12, 0.1, 3.85], p),
          look: mixVec([0, 0, -0.8], [-0.1, 0, -2.15], p),
        };
      } else {
        state = sampleCamera(pageProgress);
      }

      desiredPosition.set(
        state.pos[0] + pointerX * (billingMode ? 0.16 : 0.35),
        state.pos[1] - pointerY * (billingMode ? 0.1 : 0.2),
        state.pos[2],
      );
      desiredLook.set(
        state.look[0] + pointerX * (billingMode ? 0.06 : 0.14),
        state.look[1] - pointerY * (billingMode ? 0.05 : 0.1),
        state.look[2],
      );

      // A single damped follow (rather than snapping straight to the target)
      // keeps the idle <-> billing state switch from popping the camera/core
      // to a new position in one frame.
      const damping = 1 - Math.exp(-3.8 * delta);
      currentPosition.lerp(desiredPosition, damping);
      currentLook.lerp(desiredLook, damping);
      camera.position.copy(currentPosition);
      camera.lookAt(currentLook);

      const rotDamping = 1 - Math.exp(-4.2 * delta);
      const p = smootherstep(billingProgress);

      const targetCoreY = billingMode ? p * 0.38 : elapsed * 0.05;
      const targetRingsY = billingMode ? -p * 0.58 : -elapsed * 0.08;
      const targetRingsX = billingMode ? p * 0.12 : elapsed * 0.02;
      const targetShellY = billingMode ? p * 0.24 : elapsed * 0.03;
      const targetPulseScale = billingMode ? 1 + p * 0.045 : 1 + Math.sin(elapsed * 1.5) * 0.08;

      core.rotation.y += (targetCoreY - core.rotation.y) * rotDamping;
      rings.rotation.y += (targetRingsY - rings.rotation.y) * rotDamping;
      rings.rotation.x += (targetRingsX - rings.rotation.x) * rotDamping;
      shell.rotation.y += (targetShellY - shell.rotation.y) * rotDamping;
      pulse.scale.setScalar(pulse.scale.x + (targetPulseScale - pulse.scale.x) * rotDamping);

      orbiters.forEach((node, index) => {
        let targetX;
        let targetY;
        let targetZ;
        if (billingMode) {
          const angle = node.userData.angle + p * (0.32 + index * 0.035);
          targetX = Math.cos(angle) * node.userData.radius;
          targetY = Math.sin(p * Math.PI * 1.2 + index) * node.userData.yAmp * 0.42;
          targetZ = Math.sin(angle) * node.userData.radius;
        } else {
          const angle = node.userData.angle + elapsed * node.userData.speed;
          targetX = Math.cos(angle) * node.userData.radius;
          targetY = Math.sin(elapsed * node.userData.yFreq) * node.userData.yAmp;
          targetZ = Math.sin(angle) * node.userData.radius;
        }
        node.position.x += (targetX - node.position.x) * rotDamping;
        node.position.y += (targetY - node.position.y) * rotDamping;
        node.position.z += (targetZ - node.position.z) * rotDamping;
        node.rotation.x += 0.01;
        node.rotation.y += 0.008;
      });

      // Internal-only micro-animation for the AI intelligence visuals (brain
      // core, orbit-ring light points, floating AI props, drifting code text).
      // Every parent transform — core rotation, scroll scale, camera, service /
      // billing transitions, orbit-ring rotation — is still driven by the code
      // above/below; this only breathes life into the replaced child objects.
      aiScene.update(elapsed, delta, rings.rotation);

      const grow1 = smootherstep((pageProgress - 0.3) / 0.24);
      const grow2 = smootherstep((pageProgress - 0.54) / 0.12);
      const targetBaseScale = billingMode ? 1.12 + p * 0.46 : 1 + grow1 * 0.72 + grow2 * 0.38;
      coreBaseScale += (targetBaseScale - coreBaseScale) * rotDamping;

      const shellFade = smootherstep((pageProgress - 0.57) / 0.16);
      shell.material.opacity = 0.55 * (1 - shellFade);

      // Keep the WebGL system visibly alive behind the service orbit. The
      // service transition still pushes it deeper and softens its energy, but
      // no longer reduces it to an almost invisible 3%.
      const visibleEnergy = 1 - serviceTransition * 0.58;
      if (Math.abs(previousTransition - serviceTransition) > 0.004) {
        rings.children.forEach((ring) => {
          ring.material.transparent = true;
          ring.material.opacity = visibleEnergy * 0.4;
        });
        pulse.material.emissiveIntensity = 2.2 * (1 - serviceTransition * 0.58);
        orbiters.forEach((node) => {
          node.material.transparent = true;
          node.material.opacity = visibleEnergy * 0.6;
        });
        previousTransition = serviceTransition;
      }

      core.position.z = -serviceTransition * 6;
      core.scale.setScalar(coreBaseScale * (1 - serviceTransition * 0.28));

      floating.forEach((item, index) => {
        if (billingMode) {
          if (item.baseRotation === undefined) item.baseRotation = item.mesh.rotation[item.axis];
          item.mesh.rotation[item.axis] = item.baseRotation + smootherstep(billingProgress) * (0.1 + index * 0.018);
        } else {
          item.baseRotation = undefined;
          item.mesh.rotation[item.axis] += delta * item.speed;
        }
        item.mesh.scale.setScalar(1 - serviceTransition * 0.48);
      });

      if (billingMode) {
        stars.rotation.y += (billingProgress * 0.075 - stars.rotation.y) * rotDamping;
        stars.material.opacity = 0.23 * (1 - serviceTransition * 0.65);
      } else {
        stars.rotation.y += delta * 0.01;
        stars.material.opacity = 0.32 * (1 - serviceTransition * 0.65);
      }

      renderer.render(scene, camera);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });

    ScrollTrigger.refresh();
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      transitionTween?.kill();
      triggers.forEach((trigger) => trigger.kill());
      aiScene.dispose();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onPointer);
      window.removeEventListener("touchmove", onTouch);

      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose?.());
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} id="three-canvas" className="three-background" aria-hidden="true" />;
}
