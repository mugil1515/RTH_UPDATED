# Renderer black-object fix

The original bundled site uses the legacy `WebGLRenderer.outputEncoding` color pipeline, which means it was built with a pre-r152 Three.js renderer.

The React migration had been using Three.js 0.170.0 (`outputColorSpace` + new color management). The same dark `MeshPhysicalMaterial` + `transmission` values therefore rendered significantly darker, creating the large black faceted objects visible during the billing transition.

Fix applied:

- pinned `three` to `0.151.3`
- restored legacy `renderer.outputEncoding = THREE.sRGBEncoding` behavior
- disabled the newer automatic color-management path when available
- disabled depth writes on transparent/transmission glass meshes to stop dark depth occlusion
- kept the original geometry, camera path, scroll timings, orbit motion, fog, lights and scene positions unchanged
