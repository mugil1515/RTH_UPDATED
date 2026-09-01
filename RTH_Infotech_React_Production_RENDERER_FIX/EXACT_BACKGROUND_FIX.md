# Exact Background / Scroll Indicator Fix

This revision replaces the approximate React background reconstruction with a direct clean-source translation of the visible Three.js logic from the preserved original single-file build.

Restored from the original implementation:
- exact camera path, including the 0.38 / 0.46 / 0.55 transition points
- exact Three.js geometry, colors, material settings and light values
- central intelligence core idle animation
- service-transition depth/fade behavior
- billing-specific camera and core transformation behavior
- floating side systems and their rotation/scale behavior
- star field and floor grid values
- section-driven focus layer intensity/size changes
- original JSON code stream typing timings

The floating TOP button now uses the original conic-gradient progress ring. `--scroll-progress` updates from 0deg to 360deg based on actual page scroll progress.
