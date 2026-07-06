# Regression Checklist

Date: 2026-07-01

Use this checklist before deleting CSS overrides, splitting controllers further, or moving more modal HTML out of `app.js`.

## Automated Checks

Run:

```bash
php artisan test
npm test
npm run build
git diff --check
```

Record:

- PHP test count and assertion count.
- JS test count.
- Vite build success and asset size changes if CSS/JS changed heavily.
- Whitespace check result.

## Phase Gates

- Backend-only refactor: `php artisan test` is required before moving to frontend work.
- JS render/module split: `npm test`, `npm run build`, and the affected browser flow are required.
- CSS movement: `npm run build`, `git diff --check`, and viewport checks are required before moving another selector group.
- Documentation-only pass: `git diff --check` is the minimum, but keep the latest automated test results recorded in the refactor baseline.
- Modal-adjacent changes in `resources/js/modules/modal.js`, modal Blade templates, or modal shell CSS require a real browser smoke before the next batch.

## Modal Confirm Regression

Run after every modal-adjacent refactor and before starting a large page split:

- Logout click shows the confirm modal.
- Logout cancel closes the modal and keeps the user in the app.
- Fishing available spot click shows the `Bắt đầu phiên` confirm modal.
- Fishing start cancel closes the modal without creating a fishing session.
- At least one admin destructive action confirm renders, such as archiving a menu item.
- Close button, backdrop click, and Escape close confirm modals without leaving a pending promise.
- The active build asset has no new console error after the smoke clicks.

Automated helper coverage in `resources/js/tests/modules.test.js` must include:

- Root-node confirm body targets.
- Confirm footer buttons with `type="button"`.
- One-shot settle behavior for competing close/confirm paths.

## Viewports

Required visual sizes:

- Desktop: `1440x900`
- iPad portrait: `768x1024`
- iPad landscape: `1024x768`
- Mobile: `390x844`

Do not remove iPad, checkout, staff order modal, or table overrides until the affected screen is checked at the relevant sizes.

## Login

- Admin login with username/password.
- Employee OTP request and verify.
- Logout returns to login.
- Inactive or wrong-role users cannot access protected pages.

## POS Coffee

- Coffee map loads with available/occupied/disabled table states.
- Create table order.
- Create counter order.
- Edit quantities and notes.
- Add variable-price item.
- Assign counter order to table.
- Merge coffee order into another table.
- Partial checkout.
- Full checkout by cash.
- Full checkout by QR/transfer.
- Release table after payment.

## POS Fishing

- Fishing map loads with available/occupied/expired/disabled spot states.
- Start fishing session.
- Extend by session block.
- Extend by hour mode.
- Toggle fish takeaway pricing.
- Add/update menu items.
- Partial checkout.
- Full checkout.
- Merge fishing order.
- Release spot after payment.
- Expired session notification is visible and dismissible.

## Orders

- Employee orders page loads.
- Admin orders page loads.
- Filter by status and service type.
- Search by order number/resource.
- Open order detail modal.
- Paid and unpaid lines remain visually distinct.
- Reverse payment requires a reason.
- Void order requires a reason.

## Admin

- Dashboard date filter updates KPI cards and chart.
- Menu list filters by category and search.
- Add/edit/archive menu item.
- Batch create menu items.
- Payment settings list loads.
- Add/edit payment method with QR fields.
- User list loads.
- Add/edit admin user.
- Add/edit employee user and email verification state.
- Coffee map add/edit/delete slot.
- Fishing map add/edit/delete spot.

## CSS-Specific Screens

- Staff order table scrolls independently and row click opens detail.
- Staff order detail modal keeps header/footer fixed and body scrollable.
- Checkout modal keeps method tabs, QR/cash panel, selected lines, footer, and release checkbox visible.
- POS order modal and checkout modal keep matching shell width/height at iPad portrait.
- POS order modal keeps menu and bill columns independently scrollable without clipping footer actions.
- Notification drawer opens, filters, paginates, and does not cover unusable controls.
- iPad portrait keeps POS action controls reachable without horizontal page scroll.
- iPad landscape keeps map/order modal usable without clipped footer buttons.

## Documentation Checks

- `docs/frontend-architecture.md` reflects current JS modules, CSS import order, and known hotspots.
- `docs/backend-architecture.md` reflects current controller/service/FormRequest boundaries.
- `docs/css-refactor-map.md` reflects current CSS import order and ownership.
- `docs/refactor-next-baseline.md` records each completed phase and the latest verification result.
- README structure section matches the actual important directories after refactor.

## Known Manual Gap

Automated browser screenshots may be unavailable in this environment. If the browser runtime fails, record the failure in the day's notes and do not treat visual QA as completed.

If a protected route redirects to `/login`, record the auth block and do not mark the affected visual smoke as complete.
