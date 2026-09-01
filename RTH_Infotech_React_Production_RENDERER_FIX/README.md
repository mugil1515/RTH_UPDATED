# RTH Infotech — Production React Migration

A clean React + Vite + Tailwind CSS reconstruction of the supplied single-file RTH Infotech website. The original HTML is preserved for visual/behavior comparison.

## Requirements
- Node.js 20.19+ or a current Node 22+ LTS release
- npm 10+

## Install
```bash
npm install
npm run dev
```

## Production
```bash
npm run build
npm run preview
```

## Content editing
- Hero / brand / SEO defaults: `src/data/siteConfig.js`
- Services: `src/data/services.js`
- Navigation: `src/data/navigation.js`
- Industries: `src/data/industries.js`
- Company/contact details: `src/data/company.js`
- Problems: `src/data/problems.js`
- Analyzer: `src/data/analyzer.js`
- Billing: `src/data/billing.js`
- Agent: `src/data/agent.js`
- Logo: `src/assets/logos/rth-logo.png`

Read `CONTENT_GUIDE.md` for step-by-step editing instructions.

## Architecture
- `src/components/common` — reusable controls, loader, SEO, progress
- `src/components/layout` — navbar, footer, background, page shell
- `src/components/effects` — Three.js, code streams, grain/vignette
- `src/sections` — home-page visual/interaction sections
- `src/pages` — route-level pages
- `src/data` — editable business content, one source of truth
- `src/animations` — GSAP/ScrollTrigger timelines
- `src/hooks` — Lenis, media query and motion helpers
- `src/utils` — geometry/helpers
- `src/styles` — global tokens and complex visual CSS
- `existing-original/index-original.html` — untouched supplied HTML reference

## Routes
- `/`
- `/services`
- `/services/:slug`
- `/about`
- `/contact`
- `*` 404

## Service architecture
The service ecosystem renders from `services.map(...)`. Orbit node locations and connector endpoints share the same mathematical circular geometry. Home service interactions open a viewport modal; the modal links to the dynamic service route.

## Animation architecture
GSAP and ScrollTrigger are registered once in `src/animations/gsapConfig.js`. Component timelines are created in layout effects and reverted on unmount. Lenis is instantiated once in `PageLayout`. Three.js owns one renderer and disposes renderer/geometry/material plus event listeners on unmount.

## Tailwind
Tailwind CSS v4 is integrated through `@tailwindcss/vite`. Tailwind is used for structural utilities in JSX; complex orbital, 3D, mask, pseudo-element and cinematic effect rules stay in dedicated CSS.

## Deployment
### Vercel
`vercel.json` rewrites client-side routes to `index.html`.

### Netlify
`public/_redirects` contains `/* /index.html 200`.

### Cloudflare Pages / static hosting
Build with `npm run build`, publish `dist`, and configure a SPA fallback to `/index.html` for unknown routes.

## Environment variables
Copy `.env.example` to `.env.local`. `VITE_CONTACT_ENDPOINT` is optional. If it is blank, the contact form keeps its verified UI/success state and does not invent a backend.

## Verification status
See `VERIFICATION_REPORT.md`. Structural and syntax checks pass in the provided environment; full dependency install/build is pending because this sandbox cannot resolve the npm registry.
