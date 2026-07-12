# Regression Checklist

Date: 2026-07-10

Use this checklist before deleting CSS overrides, splitting controllers further, or moving modal HTML between feature modules and Blade templates.

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
- Employee enters username, receives OTP at the linked verified email, and verifies the single-use code.
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
- Select no discount or a 50.000/100.000/150.000/200.000 fishing-session discount.
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
- Employee orders move to the top when a newer item is ordered; checkout only updates status/payment time and does not reorder the row.
- Paid and unpaid lines remain visually distinct.
- Reverse payment requires a reason.
- Void order requires a reason.
- At 23:59, open and partially paid orders receive one automatic payment for the remaining balance and disappear from the employee POS.
- At 23:59, paid but unreleased tables/spots and active fishing sessions are completed.
- Running the operational-day closer repeatedly does not duplicate automatic payments.

## Page Lifecycle

- Switching Orders → Admin Map → Coffee → Fishing → Dashboard does not leave stale page content.
- Orders polling stops after leaving Orders and starts once when Orders mounts again.
- Admin Map polling stops after leaving Admin Map and starts once when Admin Map mounts again.
- Fishing countdown stops after leaving Fishing and starts once when Fishing mounts again.
- Menu and Orders search debounce cannot render an old page after navigation.
- Notification drawer, live clock, sidebar, and profile listeners are bound once per app shell.

## Admin

- Dashboard date filter updates KPI cards and chart.
- Menu list filters by category and search.
- Add/edit/archive menu item.
- Batch create menu items.
- Payment settings list loads.
- Add/edit payment method with QR fields.
- User list loads.
- Add/edit admin user.
- Add/edit employee username, linked email, and email verification state.
- Coffee map add/edit/delete slot.
- Fishing map add/edit/delete spot.

## CSS-Specific Screens

- Staff order table scrolls independently and row click opens detail.
- Paginated desktop/iPad workspaces keep the page header and paginator fixed while only the data region scrolls; mobile returns to natural document scrolling.
- Paginated mobile tables contain horizontal scrolling inside the data region without widening the document or clipping paginator controls.
- Users, Payment Settings, and Staff Orders tables use only their feature-scoped tablet selectors; no broad `:not(.owner-orders-page):not(.owner-menu-page)` table rule returns.
- Staff Orders cells use 12px by 10px padding at iPad landscape and 14px by 12px at iPad portrait.
- Staff order detail modal keeps header/footer fixed and body scrollable.
- Checkout modal keeps method tabs, QR/cash panel, selected lines, footer, and release checkbox visible.
- POS order modal and checkout modal keep matching shell width/height at iPad portrait.
- POS order modal keeps menu and bill columns independently scrollable without clipping footer actions.
- Clicking an occupied Fishing spot opens the shared ordering modal without a `renderOrderModalBody` reference error; an available spot still opens the start confirmation.
- Notification drawer opens, filters, paginates, and does not cover unusable controls.
- Admin Menu keeps category tabs/search above an independently scrolling table with a fixed paginator.
- Admin Menu single-item editor stays two-column on desktop/iPad and stacks to one column below 768px.
- Admin Menu batch-create modal keeps category choices, image picker, fields, toggles, remove action, add-row action, and footer usable at desktop, iPad portrait/landscape, and mobile widths.
- Admin Menu batch rows use three columns on desktop, two columns plus a full-width action row on iPad portrait, and an 82px image column plus stacked fields and a full-width action row below 768px.
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
