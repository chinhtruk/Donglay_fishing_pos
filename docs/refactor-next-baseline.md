# Next Refactor Baseline

Date: 2026-06-30
Scope: Phase 0 for the next cleanup pass after the Day 10 refactor audit.

## Purpose

This document records the working baseline before the next refactor phase begins. The next phase should reduce remaining structural debt without changing route URLs, API response shapes, or core POS/admin workflows.

## Working Tree Snapshot

The repo already contains the previous refactor work as unstaged/untracked changes. Treat these as the current baseline, not as files to revert.

Current modified tracked files:

```text
.gitignore
app/Http/Controllers/Api/AdminController.php
app/Http/Controllers/Api/PosController.php
app/Services/CoffeeOrderService.php
app/Services/FishingService.php
resources/css/app.css
resources/js/app.js
resources/js/modules/modal.js
resources/js/tests/modules.test.js
resources/views/app.blade.php
tests/Feature/AdminDashboardTest.php
```

Current untracked refactor directories/files:

```text
app/Http/Requests/
app/Services/OrderLineReconciler.php
app/Services/OrderNumberGenerator.php
app/Services/OrderPaymentService.php
app/Services/OrderStatusResolver.php
app/Services/OrderTotalsCalculator.php
docs/
resources/css/base.css
resources/css/components/
resources/css/layout/
resources/css/legacy-overrides.css
resources/css/pages/
resources/css/responsive/
resources/css/tokens.css
resources/js/pages/
resources/js/templates/
resources/views/app/
```

## Automated Baseline

Commands passed:

```bash
php artisan test
npm test
npm run build
git diff --check
```

Results:

- PHP: 53 tests passed, 351 assertions.
- JS: 10 tests passed.
- Vite build: passed.
- Whitespace check: clean.

Latest build assets:

- CSS: `public/build/assets/app-Oy-STMOu.css`, 352.12 kB, gzip 52.87 kB.
- JS: `public/build/assets/app-msOGt0pd.js`, 169.54 kB, gzip 43.27 kB.

## Current Size Hotspots

```text
 3771 resources/js/app.js
14472 resources/css/legacy-overrides.css
   13 resources/css/app.css
  753 app/Http/Controllers/Api/AdminController.php
  362 app/Http/Controllers/Api/PosController.php
  223 app/Services/CoffeeOrderService.php
  271 app/Services/FishingService.php
```

## Phase 1 Starting Point

Recommended next implementation target:

1. Extract dashboard query/reporting logic from `AdminController` into `AdminDashboardService`.
2. Keep the `/api/v1/admin/dashboard` response shape stable.
3. Re-run `php artisan test` before touching frontend code.

Do not start the CSS legacy reduction until the backend service extraction and first JS page/template split are stable. The CSS layer still requires screenshot-backed validation because `legacy-overrides.css` contains many cascade fixes from earlier responsive work.

## Phase 2 Progress

Started: 2026-07-01

Completed module splits:

- `resources/js/pages/admin/dashboard.js` now owns admin dashboard loading, KPI/chart rendering, date presets, chart tooltip behavior, and sidebar revenue total sync.
- `resources/js/pages/admin/users.js` now owns admin user list rendering and the add/edit user modal workflow.

Current frontend size snapshot after these splits:

```text
 3485 resources/js/app.js
  219 resources/js/pages/admin/dashboard.js
   84 resources/js/pages/admin/users.js
```

Recommended next Phase 2 target:

1. Extract admin settings/payment-method page after moving shared payment-method display helpers out of `app.js`.
2. Then extract admin map as a separate batch, because it has local polling and inline map preview behavior.
3. Keep running `npm test`, `npm run build`, and an admin dashboard/users browser smoke after each page split.

## Phase 3 Progress

Started: 2026-07-01

Completed CSS classification batch:

- Moved admin users table and user account modal rules from `resources/css/legacy-overrides.css` to `resources/css/pages/admin-users.css`.
- Imported `pages/admin-users.css` after `legacy-overrides.css` to preserve the previous override behavior against broad admin legacy rules.

Current CSS size snapshot after this batch:

```text
14013 resources/css/legacy-overrides.css
  461 resources/css/pages/admin-users.css
```

Recommended next Phase 3 target:

1. Move a similarly scoped admin feature block, such as payment-method settings, only after verifying the settings page.
2. Avoid checkout, iPad, staff orders, and modal shell rules until browser screenshot QA is available for the affected breakpoints.

## Phase 4 Progress

Started: 2026-07-01

Completed modal/responsive hardening batch:

- Moved shared modal backdrop/shell/header/body/footer/close button styles from `resources/css/legacy-overrides.css` to `resources/css/components/modal-shell.css`.
- Moved the base POS order modal shell rules into `resources/css/pages/pos.css`, next to the existing POS order modal scroll rules.
- Kept checkout and iPad parity selectors in their later layers. In particular, the shared iPad lock for `.modal.pos-order-modal` and `.modal.pos-checkout-modal.pos-order-modal` remains in `components/checkout-modal.css`.

Current CSS size snapshot after this batch:

```text
13868 resources/css/legacy-overrides.css
  110 resources/css/components/modal-shell.css
  244 resources/css/pages/pos.css
```

Verification after this batch:

- PHP: 53 tests passed, 351 assertions.
- JS: 10 tests passed.
- Vite build: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-DjV9QPPG.js`.
- Whitespace check: clean.

Recommended next Phase 4 target:

1. Browser smoke order and checkout modals at iPad portrait before moving any more POS modal rules.
2. If visual parity is confirmed, continue by moving narrowly scoped non-checkout modal form blocks such as menu item or batch menu modal CSS.

## Phase 5 Progress

Started: 2026-07-01

Completed documentation batch:

- Updated frontend architecture notes with the current JS module split, CSS layer contract, and remaining app.js/CSS hotspots.
- Updated backend architecture and service map notes with the current FormRequest, controller, presenter, and service boundaries.
- Updated regression checklist with phase gates, modal/iPad checks, documentation checks, and the auth-block rule for protected browser smoke.
- Updated CSS refactor map to record that Phase 5 was documentation-only and did not move more selectors.

Commit status:

- No commit was created in this phase per request.

Verification after this batch:

- PHP: 53 tests passed, 351 assertions.
- JS: 10 tests passed.
- Vite build: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-DjV9QPPG.js`.
- Whitespace check: clean.

Recommended next target:

1. Authenticate locally, then browser smoke POS order and checkout modals at iPad portrait.
2. After visual parity is confirmed, continue the next CSS batch with narrowly scoped non-checkout modal form rules.
