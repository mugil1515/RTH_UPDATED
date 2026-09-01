# Migration Audit

## 1. Current project architecture
The supplied website is a single large HTML document containing generated Tailwind CSS, an inline/minified JavaScript application bundle, embedded image data, animation libraries, service UI, Three.js/canvas rendering and page content.

## 2. Source vs compiled bundle
The HTML is **not clean source React**. It contains a compiled production React 18 bundle (including React/ReactDOM/Scheduler runtime internals) plus application code. The new project therefore reconstructs maintainable source components instead of copying the runtime bundle.

## 3. Main libraries detected
- React 18.3.1 runtime in the generated bundle
- GSAP 3.12.5 + ScrollTrigger
- Three.js/WebGL canvas background logic
- Lenis-style smooth-scroll integration in the final experience
- Tailwind-generated utility CSS plus extensive custom CSS

## 4. Main sections detected
Hero, manual-work problems, Intelligence Core/services ecosystem, automatic bill generation, autonomous AI agent, industries, process analyzer, company, contact, loader/background overlays, code streams, progress UI and service detail experience.

## 5. Animation systems detected
GSAP timelines, ScrollTrigger sequences, continuous requestAnimationFrame/WebGL rendering, CSS keyframes, orbital transforms, code typing, scroll progress, loader transitions and service-detail transition sequences.

## 6. Duplicated/conflicting code detected
The final HTML contains generated framework runtime code, historical/duplicate service-system CSS, repeated responsive overrides, multiple selectors affecting the same service detail visual, and transform-heavy layers where CSS and GSAP can compete. The migration keeps the final visible intent while removing runtime internals and consolidating the active rules.

## 7. Migration approach
- Preserve original HTML untouched under `existing-original/`.
- Reconstruct readable React source.
- Centralize content in `src/data/`.
- Separate high-frequency animation from React state.
- Keep GSAP/ScrollTrigger in `src/animations/` and Three.js in a single effect component.
- Use mathematical service orbit positioning from one geometry helper.
- Use React Router for pages and dynamic service routes.
- Keep complex visual CSS in dedicated effect/animation styles while Tailwind handles structural layout utilities.

## 8. Proposed/implemented structure
See `README.md` and the actual `src/` tree. The main split is `assets / components / sections / pages / data / hooks / animations / utils / styles / routes`.
