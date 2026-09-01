# RTH Content Editing Guide

The migration uses centralized data so normal content changes do not require editing animation code.

## Change the hero
Edit `src/data/siteConfig.js` → `siteConfig.hero`.

## Change navigation
Edit `src/data/navigation.js`.

## Add/remove/edit a service
Edit only `src/data/services.js`. Every home node, catalogue card and dynamic `/services/:slug` page reads from this array.

Required fields for a new service: `id`, `key`, `slug`, `title`, `shortTitle`, `labelBreak`, `tag`, `description`, `features`, `primaryFeatures`, `moreFeatures`, `focus`, `metrics`, `tools`, `process`, `phases`, `visual`, `route`, `icon`.

The orbit position and connector are calculated automatically from array length/index. You do not manually set top/left coordinates.

## Change industries
Edit `src/data/industries.js`.

## Change company information
Edit `src/data/company.js`.

## Change problem cards
Edit `src/data/problems.js`.

## Change billing/analyzer/agent copy
- Billing: `src/data/billing.js`
- Analyzer: `src/data/analyzer.js`
- Agent: `src/data/agent.js`

## Replace logo/images
Replace `src/assets/logos/rth-logo.png` or import new files from `src/assets/images/`. Do not use local disk paths such as `D:/...`.

## Add a page
1. Create `src/pages/MyPage.jsx`.
2. Add a `<Route>` in `src/routes/AppRoutes.jsx`.
3. Add the navigation item in `src/data/navigation.js` if it should be in the menu.
4. Add `<SEO>` metadata in the page.

## Change animation behavior
Only edit files under `src/animations/` or dedicated custom CSS in `src/styles/animations.css` / `src/styles/effects.css`. Content changes should not be made there.
