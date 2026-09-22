# Changelog

## 2.1.0 — 2026-09-19

- Replaced the single click-only header dropdown with four hover, focus, and click accessible mega menus.
- Added a fully interactive hero dashboard: module, time-range, metrics, charts, resources, and evidence all update on selection.
- Added an interactive service topology and evidence workbench with resource inspection.
- Added professional perspective, layered shadows, elevation, and depth across public pages without a game-like theme.
- Converted capability cards and pricing controls into working navigation and data-changing interactions.
- Fixed local frontend-to-backend connectivity: start scripts now point the UI at port 8000 and CORS includes port 3002.
- Fixed status checks to use the configured or same-origin API instead of an incorrect hard-coded port.

## 2.0.0 — 2026-09-18

- Rebuilt the complete public website with an original enterprise observability design system.
- Added product, solution, pricing, integration, security, documentation, company, contact, status, and legal pages.
- Added premium sign-in, sign-up, password recovery, session rotation, account lockout, and secure cookie flows.
- Added organization membership, audit activity, subscription management, Stripe Checkout, customer portal, and signed webhook processing.
- Reworked the application navigation, command bar, workspace controls, billing, team, and audit pages.
- Added global security headers and authenticated API middleware.
- Fixed asynchronous Redis access in the alert engine.
- Added schema migration, platform tests, TypeScript checks, and production build validation.
