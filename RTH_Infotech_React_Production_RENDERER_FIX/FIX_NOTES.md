# Visual parity fix

This patch corrects two migration regressions reported after running the React version:

1. The full Home/Services/About/Contact navigation header was removed from the global layout. The original rendered single-file website used the standalone RTH logo in the upper-left rather than that new navigation pill.
2. The simplified Three.js background was replaced with a much closer reconstruction of the original animated intelligence scene: central glass core, orbital rings/nodes, floating systems, particles, perspective grid, pointer parallax and scroll-driven camera/depth movement.
3. Background code streams now continuously type, fade and rotate through live-data payloads instead of typing only once.
4. Background layer ordering was restored to mirror the original: Three.js -> focus layer -> live code -> vignette -> grain.
5. The extra top scroll-progress line introduced by the React migration is no longer rendered.

The React routes and production folder architecture remain intact.
