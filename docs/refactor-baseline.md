# Dong Lay Fishing Refactor Baseline

Date: 2026-06-30
Scope: Day 1 of the 10-day refactor roadmap. This document records the current working baseline before any structural refactor begins.

## Rule For Day 1

- No behavior changes.
- No UI changes.
- No CSS cleanup yet.
- Preserve the current production behavior while creating a reliable map for the next refactor days.

## Repository State

Current `git status --short` before this document:

```text
?? database/exports/
```

The `database/exports/` directory already exists as an untracked local artifact. It should not be mixed with refactor commits unless the team decides to version database export files.

## Verification Baseline

Commands run successfully:

```bash
php artisan test
npm test
npm run build
```

Results:

- PHP feature/unit suite: 52 tests passed, 344 assertions.
- JS node tests: 5 tests passed.
- Vite production build: passed.
- Built asset size snapshot:
  - CSS: `public/build/assets/app-*.css` about 346.24 kB, gzip about 51.58 kB.
  - JS: `public/build/assets/app-*.js` about 180.27 kB, gzip about 43.93 kB.

Known tooling limitation:

- Automatic browser screenshot capture was attempted through the in-app browser runtime.
- It failed during browser runtime startup with `Model provider openai-web-session not found`.
- Because of that, no automated screenshot files were captured in Day 1.
- Before removing CSS overrides, create screenshots manually or retry automated capture when browser runtime is available.

## Source Size Snapshot

Largest frontend/backend files:

```text
19493 resources/css/app.css
 4292 resources/js/app.js
 1097 tests/Feature/PosWorkflowTest.php
  828 app/Http/Controllers/Api/AdminController.php
  452 app/Services/FishingService.php
  417 app/Http/Controllers/Api/PosController.php
  354 app/Services/CoffeeOrderService.php
```

Existing smaller frontend modules:

```text
resources/js/modules/api.js       25 lines
resources/js/modules/cart.js     109 lines
resources/js/modules/format.js    20 lines
resources/js/modules/keyboard.js  51 lines
resources/js/modules/modal.js    105 lines
resources/js/modules/timers.js    10 lines
```

Conclusion:

- `resources/js/app.js` is still the main orchestration and rendering hotspot.
- `resources/css/app.css` is the largest refactor risk because later CSS blocks intentionally override earlier blocks.
- Backend domain tests are strong enough to support service/controller refactors, but frontend/visual tests are thin.

## Route Baseline

API routes under `/api/v1`: 47 routes.

Major groups:

- Auth:
  - `POST /api/v1/auth/admin`
  - `POST /api/v1/auth/otp/request`
  - `POST /api/v1/auth/otp/verify`
  - `POST /api/v1/logout`
  - `GET /api/v1/profile`
- POS coffee:
  - `GET /api/v1/coffee/map`
  - `POST /api/v1/coffee/orders`
  - `POST /api/v1/coffee/tables/{coffeeTable}/orders`
  - `PUT /api/v1/coffee/orders/{order}`
  - `PUT /api/v1/coffee/orders/{order}/table`
  - `POST /api/v1/coffee/orders/{order}/checkout`
  - `POST /api/v1/coffee/orders/{order}/merge`
  - `POST /api/v1/coffee/orders/{order}/release`
- POS fishing:
  - `GET /api/v1/fishing/map`
  - `POST /api/v1/fishing/spots/{fishingSpot}/start`
  - `POST /api/v1/fishing/orders/{order}/extend`
  - `POST /api/v1/fishing/orders/{order}/fish-takeaway`
  - `PUT /api/v1/fishing/orders/{order}`
  - `POST /api/v1/fishing/orders/{order}/checkout`
  - `POST /api/v1/fishing/orders/{order}/merge`
  - `POST /api/v1/fishing/orders/{order}/release`
- Orders and notifications:
  - `GET /api/v1/orders`
  - `GET /api/v1/orders/{order}`
  - `GET /api/v1/notifications`
  - `POST /api/v1/notifications/read-all`
  - `POST /api/v1/notifications/delete-all`
  - `POST /api/v1/notifications/{id}/read`
- Admin:
  - `GET /api/v1/admin/dashboard`
  - `GET|POST|PUT|DELETE /api/v1/admin/menu...`
  - `GET|POST|PUT|DELETE /api/v1/admin/map...`
  - `GET|POST|PUT /api/v1/admin/users...`
  - `GET|POST /api/v1/admin/payment-settings`
  - `POST|PUT /api/v1/admin/payment-methods...`
  - `POST /api/v1/admin/orders/{order}/void`
  - `POST /api/v1/admin/payments/{payment}/reverse`

Constraint:

- Keep all route URLs and response shapes stable until frontend templates and services are fully split.

## Backend Hotspots

### AdminController

File: `app/Http/Controllers/Api/AdminController.php`

Responsibilities currently mixed:

- Dashboard metrics and date range reporting.
- Menu listing, single item create/update/delete.
- Batch menu creation.
- Payment method and QR settings.
- Coffee/fishing map admin.
- User management.
- Order void and payment reversal.

Risk:

- Refactoring this file without request tests can accidentally change validation messages or payload shape.

Day 7 or 8 direction:

- Extract FormRequests first.
- Then split controllers by feature.
- Then move dashboard metrics to a query/service class.

### PosController

File: `app/Http/Controllers/Api/PosController.php`

Responsibilities currently mixed:

- Coffee map, create, update, checkout, merge, release, assign table.
- Fishing map, start, extend, fish takeaway toggle, update, checkout, merge, release.
- Payment method availability guard.
- Event notification formatting.
- Order detail endpoint.

Risk:

- Notification side effects are close to workflow endpoints; preserve them during controller split.

Day 7 or 8 direction:

- Extract request classes first.
- Extract notification helper after service behavior is unchanged.
- Split coffee/fishing endpoints only after tests remain green.

### CoffeeOrderService And FishingService

Files:

- `app/Services/CoffeeOrderService.php`
- `app/Services/FishingService.php`

Shared domain logic currently duplicated:

- Order version guard.
- Menu line reconciliation.
- Paid quantity protection.
- Paid/unpaid status resolution.
- Total recalculation.
- Payment creation and payment lines.
- Merge bookkeeping.
- Release behavior.

Day 8 direction:

- Create shared `OrderLineReconciler`.
- Create shared `OrderStatusResolver`.
- Create shared `OrderPaymentService`.
- Create shared `OrderNumberGenerator`.
- Refactor one service at a time, starting with coffee because it has fewer fishing-specific concepts.

## Frontend Hotspots

### Main App File

File: `resources/js/app.js`

High-risk areas:

- Global mutable state and timers near the top of the file.
- Notification rendering and polling.
- Coffee POS rendering and modal ordering.
- Fishing POS rendering and modal ordering.
- Checkout modal rendering.
- Orders table and order detail modal.
- Admin dashboard/menu/users/settings/map.

Current string-rendering hotspots:

- Toast HTML: around `toast()`.
- Coffee page and modal ordering.
- Fishing lake map and modal ordering.
- Checkout modal.
- Order detail receipt modal.
- Admin payment method form.
- Admin user form.
- Admin menu item and batch menu form.
- Admin map resource forms.

Day 2-6 direction:

- Move stable shell and templates into Blade first.
- Split JS after templates exist.
- Do not split all logic and all HTML at the same time.

### Blade Shell

File: `resources/views/app.blade.php`

Currently contains:

- App shell.
- Sidebar.
- Topbar.
- Profile menu.
- Admin notification drawer.
- Modal root.
- Toast root.
- Page content root.

Should remain in Blade:

- Shell structure.
- Role-aware navigation.
- Static notification drawer shell.
- Root containers.
- New `<template>` blocks for reusable page/modal HTML.

Should move out of JS into Blade templates:

- Loading state.
- Empty state.
- Page head.
- Product cards.
- Order line rows.
- Receipt sections.
- Checkout panels.
- Admin forms.
- User/payment/menu/map modal forms.

## CSS Baseline And Refactor Map

File: `resources/css/app.css`

Critical fact:

- This file is not just a stylesheet; it is also a history of many later overrides.
- Deleting earlier-looking blocks can break current iPad/POS behavior if a later block relies on the cascade.

### Keep Immediately

These blocks should remain behaviorally intact until visual screenshots pass:

- Root tokens and base primitives near the top of the file.
- Login shell and app shell styles.
- POS coffee and fishing base styles.
- POS order modal independent scroll block around the `POS order modal` comment.
- Receipt styles around `Rich order-detail receipt`, `POS receipt detail`, and `iPad-first receipt palette`.
- Staff order table and staff detail modal block around the `Staff POS orders` comment.
- Final iPad responsive layer around the `iPad responsive layer` comment.
- Final checkout modal refinement around the `Checkout modal refinement` comment.
- Admin notification center around the `Admin notification center` comment.

### Move Into Named Files Later

Suggested destination map:

- `tokens.css`: `:root`, color tokens, base radius/shadow/font variables.
- `base.css`: reset, base body/button/input/select/textarea styles, `.hidden`, `.muted`, `.button`, `.pill`.
- `layout/shell.css`: `.app-shell`, `.sidebar`, `.topbar`, profile menu, sidebar collapse.
- `components/modal.css`: generic modal shell, modal head/body/footer, confirm modal.
- `components/table.css`: `.data-table`, `.data-table-wrap`, pagination.
- `components/receipt.css`: `.pos-receipt-*`, receipt sections, totals, payment rows.
- `components/order-slip.css`: `.order-dock-*`, `.order-line`, paid/unpaid section headers.
- `components/checkout-modal.css`: `.pos-checkout-modal`, checkout payment panel, QR panel, change row.
- `components/notifications.css`: toast and notification drawer.
- `pages/pos-coffee.css`: coffee stats, table grid, counter order strip.
- `pages/pos-fishing.css`: fishing lake, fishing slots, fishing session controls.
- `pages/pos-orders.css`: employee order table and staff order detail modal.
- `pages/admin-dashboard.css`: dashboard cards, charts, metrics.
- `pages/admin-tables.css`: admin orders/menu/users/payment method tables.
- `pages/admin-forms.css`: admin menu/user/payment/map modals.
- `responsive/ipad.css`: all iPad portrait/landscape contract rules.
- `legacy-overrides.css`: temporary parking lot for unclear cascade-sensitive rules.

### Delete Only After Screenshots Pass

Candidate blocks to remove or merge after component CSS exists:

- Older checkout width/grid blocks that are superseded by the later final checkout refinement.
- Duplicate paid/unpaid modal line styles after order line templates stop using inline styles.
- Broad tablet table selectors using `:not(.owner-orders-page):not(.owner-menu-page)` after every table has explicit page/component classes.
- Inline style compensation blocks after JS markup no longer emits inline layout styles.
- Earlier receipt composition blocks once the current final receipt component has been verified.

Do not delete yet:

- Staff order modal sizing and independent scroll.
- iPad responsive layer.
- Checkout iPad two-column dock rules.
- POS order modal independent menu/bill scroll.
- Notification drawer role-scoped rules.

## Manual Visual Baseline Checklist

Capture these before Day 2 changes are merged.

Viewports:

- Desktop: 1440 x 900.
- iPad portrait: 768 x 1024.
- iPad landscape: 1024 x 768.
- Mobile: 390 x 844.

Admin screens:

- `/admin/dashboard`
- `/admin/orders`
- `/admin/menu`
- `/admin/map`
- `/admin/users`
- `/admin/settings`
- Admin notification drawer open.
- Admin order transaction detail modal.
- Admin menu item modal.
- Admin payment method modal.
- Admin user modal.
- Admin map resource modal.

Employee screens:

- `/pos/coffee`
- `/pos/fishing`
- `/pos/orders`
- Coffee order modal with empty cart.
- Coffee order modal with unpaid items.
- Coffee order modal with paid and unpaid items.
- Fishing order modal with active session.
- Fishing order modal with extension choices.
- Checkout modal cash method.
- Checkout modal QR method.
- Staff order detail modal with `x1` quantity badge and independent line scroll.

Critical interactions to verify:

- Login admin with seeded account if local database is seeded.
- Request and verify employee OTP if mail driver allows inspection.
- Create counter coffee order.
- Assign counter order to table.
- Create table coffee order.
- Update note and quantity.
- Partial checkout.
- Final checkout.
- Release paid table.
- Start fishing session.
- Add menu item to fishing order.
- Extend fishing session.
- Toggle fish takeaway.
- Checkout fishing order.
- Release fishing spot.
- Merge coffee orders.
- Merge fishing orders.
- Admin add/edit menu item.
- Admin batch menu creation.
- Admin add/edit payment method.
- Admin add/edit user.
- Admin enable/disable map resource.

## Test Coverage Baseline

Existing coverage is strongest in backend feature flows.

Covered by current tests:

- Admin login and employee OTP login.
- Disabled user login rejection.
- Dashboard revenue/outstanding metrics.
- Dashboard void metrics by void date.
- Admin order filtering.
- Admin menu filtering.
- Coffee split payment and final payment.
- Stale order version rejection.
- Counter order assignment.
- Fishing session start/extend/checkout.
- Expired fishing session notification.
- QR payment method configuration and checkout.
- Menu image upload validation.
- Batch menu creation.
- Coffee/fishing merge flows.
- Paid orders remaining active until release.
- Order item notes.
- Notification pagination/filter/read/delete.
- POS operational day visibility behavior.

Missing or thin coverage:

- Browser DOM tests for Blade templates.
- Visual regression tests for iPad layout.
- Modal scroll behavior tests.
- CSS cascade tests.
- Admin frontend form binding tests.
- Notification drawer frontend behavior tests.

## Day 2 Entry Conditions

Before starting Day 2:

- Confirm `php artisan test`, `npm test`, and `npm run build` are still green.
- Decide whether `database/exports/` should be ignored or versioned.
- Capture visual screenshots if browser tooling is available.
- Start with Blade partial extraction only; avoid JS module split until the shell partials are stable.

