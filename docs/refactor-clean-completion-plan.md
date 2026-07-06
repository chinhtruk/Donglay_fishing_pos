# Refactor Clean Completion Plan

Date: 2026-07-01
Scope: Phase 0 baseline after the `confirmModal` regression fix.

## Purpose

This document is the checkpoint for the next cleanup pass. Treat the current working tree as the baseline for the upcoming refactor phases. The goal is to continue reducing structural debt without changing route URLs, API response shapes, POS/admin workflows, or important selectors.

## Phase 0 Status

Phase 0 is a baseline and regression-hardening phase. It does not move more production code. It records the current source shape, confirms the shared modal contract after the bug fix, and defines the gates required before Phase 1 starts.

## Working Tree Snapshot

The repository already contains previous refactor work as unstaged and untracked changes. Do not revert these files while continuing the plan.

Tracked files currently modified:

```text
.gitignore
README.md
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
app/Services/AdminDashboardService.php
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

## Current Size Hotspots

```text
 3485 resources/js/app.js
13868 resources/css/legacy-overrides.css
  546 app/Http/Controllers/Api/AdminController.php
  362 app/Http/Controllers/Api/PosController.php
  177 resources/js/modules/modal.js
```

## Modal Regression Fix Baseline

The recent confirm modal issue was caused by the confirm body template having the target element as the root node. `querySelector()` does not match the root element itself, so `confirmModal()` threw before rendering the modal.

The current modal contract is:

- `confirmModal()` must work when the fill target is the root node of a cloned template.
- Closing by the close button, backdrop click, or Escape resolves the confirm promise as `false`.
- Confirm and cancel buttons are explicit `type="button"`.
- Confirm/cancel event handlers settle the promise once, even though `close()` also triggers `onClose`.
- `openModal()` remains the shared path for confirm, order, checkout, and admin modal shells.

Any future change to `resources/js/modules/modal.js`, modal Blade templates, or modal shell CSS requires browser smoke before moving to the next batch.

## Modal Regression Checklist

Required before Phase 1 and after every modal-adjacent refactor:

- Logout click shows the confirm modal.
- Logout cancel closes the modal and keeps the user on the app page.
- Fishing available spot click shows the `Bắt đầu phiên` confirm modal.
- Fishing start cancel closes the modal without creating a fishing session.
- At least one admin destructive action confirm still renders.
- The active build asset has no new console error after these clicks.

## Browser Smoke Baseline

Browser smoke was run against `http://127.0.0.1:8000` using the built asset `public/build/assets/app-B8zz-14o.js`.

Results:

- Login as local admin succeeded and loaded `/admin/dashboard`.
- Logout confirm rendered with `Để sau` and `Đăng xuất` buttons.
- Logout cancel closed the modal and kept the user in the app.
- Fishing page loaded 20 spots.
- Available spot `Chòi 1` rendered the `Bắt đầu phiên` confirm modal.
- Fishing start cancel closed the modal without starting a session.
- Admin menu destructive confirm rendered for `Lưu trữ món`.
- Admin destructive cancel closed the modal without archiving the menu item.
- Close button, Escape, and backdrop click all closed the confirm modal cleanly.
- No new console error or warning was reported for `app-B8zz-14o.js` during these smoke checks.

## Automated Baseline

Commands run on 2026-07-01:

```bash
php artisan test
npm test
npm run build
git diff --check
```

Results:

- PHP: passed, 53 tests, 351 assertions.
- JS: passed, 10 tests.
- Vite build: passed.
- Whitespace check: clean.

Latest build assets:

- CSS: `public/build/assets/app-BmcCRcE3.css`, 352.12 kB, gzip 53.21 kB.
- JS: `public/build/assets/app-B8zz-14o.js`, 169.88 kB, gzip 43.46 kB.

## Next Phase Entry Criteria

Phase 1 may start only after:

- This baseline document remains accurate.
- `docs/regression-checklist.md` includes modal confirm regression checks.
- Browser smoke confirms logout, fishing start, admin destructive confirm, and shared close paths on the current build asset.
- No unrelated route, payload, selector, or workflow changes are introduced during Phase 0.

## Phase 1 Target

Start with backend controller thinning:

1. Extract `AdminMenuService`.
2. Extract `AdminPaymentMethodService`.
3. Extract `AdminMapService`.
4. Extract a small POS notification message factory only after controller/service behavior is stable.

Keep Phase 1 backend-focused. Do not begin large `app.js` or CSS movement in the same batch.

## Phase 1 Progress

Completed on 2026-07-01:

- Added `app/Services/AdminAuditLogger.php`.
- Added `app/Services/AdminMenuService.php`.
- Added `app/Services/AdminPaymentMethodService.php`.
- Added `app/Services/AdminMapService.php`.
- Added `app/Services/PosNotificationMessageFactory.php`.
- Moved admin menu list/create/batch/update/archive workflow out of `AdminController`.
- Moved payment settings and payment method create/update workflow out of `AdminController`.
- Moved admin coffee/fishing map payload/update/create/delete workflow out of `AdminController`.
- Moved POS notification title/message/type/url construction out of `PosController`.
- Kept route URLs, response messages, status codes, and payload shapes stable.
- Reduced `app/Http/Controllers/Api/AdminController.php` from 546 lines to 209 lines.
- Reduced `app/Http/Controllers/Api/PosController.php` from 362 lines to 324 lines.

Phase 1 verification:

- PHP syntax checks passed for the new services, `AdminController`, and `PosController`.
- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 10 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-B8zz-14o.js`.
- `git diff --check`: clean.

Note:

- A parallel `php artisan test` run failed while `npm run build` was rewriting `public/build/manifest.json`. Re-running PHP tests after the build completed passed. Do not run PHP feature tests that render Vite-backed views concurrently with Vite build.

Recommended next target:

1. Keep Phase 2 focused on shared frontend contracts and modal helper tests.
2. Do not start broad `app.js` splitting until the modal helper contract has direct test coverage for root-node template targets, close paths, and button types.

## Phase 2 Progress

Completed on 2026-07-01:

- Kept the confirm modal on the shared `confirmModal()` path; no page workflow was moved or reworked.
- Promoted the root-or-descendant selector lookup in `resources/js/modules/modal.js` to a named helper so the root-node template bug has direct test coverage.
- Promoted the confirm footer preparation to a named helper so both Blade-template and fallback confirm buttons remain explicit `type="button"`.
- Promoted the one-shot settle guard to a named helper so close/cancel/confirm paths cannot resolve the confirm promise more than once.
- Added JS tests for:
  - confirm body target as the root node of the cloned template;
  - confirm footer button type normalization and confirm copy fill;
  - one-shot modal settle behavior.

Phase 2 verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 13 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-BzEN1rv3.js`.
- `git diff --check`: clean.
- Browser smoke passed against `http://127.0.0.1:8000` using built asset `public/build/assets/app-BzEN1rv3.js`.

Phase 2 browser smoke results:

- Local admin login succeeded with the current dev database account and loaded `/admin/dashboard`.
- Logout confirm rendered with the expected message and `Để sau` / `Đăng xuất` buttons.
- Logout cancel closed the modal and kept the browser on `/admin/dashboard`.
- Fishing `Chòi 1` start confirm rendered with `Bắt đầu phiên`; cancel kept the spot available.
- Close button, Escape, and backdrop click all closed the fishing confirm without leaving `body.modal-open`.
- Admin menu destructive confirm rendered for `Lưu trữ món`; cancel left the menu item available in the table.
- Confirm and cancel buttons rendered as `type="button"` in all inspected confirm modals.
- Browser console had no error or warning logs after the smoke flow.

Remaining Phase 2 gates before starting broad Phase 3 page splitting:

- Keep the modal helper tests in place before moving page-scale modal markup.
- Do not move checkout/order/admin modal markup unless the affected browser smoke remains green on the built asset.

## Phase 3 Progress

Started on 2026-07-01 with the shell/global setup slice.

Completed in this slice:

- Added `resources/js/shell/router.js` for page resolution, POS/admin body flags, and a shared routed-page render wrapper.
- Added `resources/js/shell/sidebar.js` for active nav state, mobile sidebar open/close, desktop collapse state, and sidebar resize cleanup.
- Added `resources/js/shell/profile-menu.js` for profile menu toggle, logout confirm, logout API call, outside-click close, and Escape handling.
- Added `resources/js/shell/page-head.js` for live clock update/setup.
- Updated `resources/js/app.js` to delegate shell setup and routed page rendering to those modules while keeping the existing page renderers in place.
- Added JS tests for `pageFromPath()` and POS/admin page flag behavior.
- Reduced `resources/js/app.js` from 3485 lines at the Phase 0 baseline to 3436 lines.

Phase 3 shell-slice verification so far:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 15 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-B5gxtHzW.js`.
- `git diff --check`: clean.
- Browser smoke passed against `http://127.0.0.1:8000` using built asset `public/build/assets/app-B5gxtHzW.js`.

Phase 3 shell-slice browser smoke results:

- Admin dashboard loaded with `dashboard` as the active nav item and no POS body flags.
- Live clock rendered in the shell header after reload.
- Sidebar collapse toggle changed `sidebar-collapsed` and synced `aria-expanded`.
- Profile menu opened; logout confirm rendered; cancel closed the modal and kept the browser on `/admin/dashboard`.
- Fishing page loaded with POS/fishing body flags.
- Fishing `Chòi 1` start confirm rendered; cancel closed the modal and kept the spot available.
- Browser console had no error or warning logs after the smoke flow.

Recommended next Phase 3 target:

1. Extract notifications into `resources/js/pages/notifications/drawer.js` and `resources/js/pages/notifications/toasts.js`.
2. Keep notification polling and drawer tests focused before moving checkout or POS page bodies.
3. Browser smoke logout confirm, notification drawer, fishing confirm, and one normal page navigation after the next slice.

## Phase 4 Progress

Started on 2026-07-01 with the page lifecycle/timer cleanup slice.

Completed in this slice:

- Added `resources/js/shell/lifecycle.js` as a small cleanup scope for page-level effects.
- Added an app-level lifecycle scope for long-lived shell effects.
- Updated `renderPage()` so `pageLifecycle.unmount()` runs before each page render.
- Registered app-wide notification toast polling with the app lifecycle scope.
- Registered notification drawer refresh polling with its own drawer lifecycle scope, cleared whenever the drawer closes or reopens.
- Moved the fishing countdown interval onto `pageLifecycle.interval()` instead of a free `activeTimer` global.
- Registered Orders polling cleanup with the page lifecycle so switching away from `/orders` clears its interval and in-flight flag state.
- Registered Admin Map polling cleanup with the page lifecycle so switching away from `/admin/map` clears its interval, signature, in-flight flag, and update handler.
- Removed the old `activeTimer` global.
- Added JS tests for lifecycle cleanup order, one-shot cleanup behavior, and interval clearing.

Phase 4 lifecycle-slice verification so far:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 17 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-DLI94gTt.js`.
- `git diff --check`: clean.
- Browser smoke passed against `http://127.0.0.1:8000` using built asset `public/build/assets/app-DLI94gTt.js`.

Phase 4 lifecycle-slice browser smoke results:

- Admin dashboard loaded with `dashboard` active and no POS body flags.
- Notification drawer opened with rows loaded, then closed and restored the hidden scrim state.
- Admin orders loaded with `orders` active and rendered order rows.
- Admin map loaded with `map` active and rendered `#map-editor`.
- POS fishing loaded with POS/fishing body flags.
- Returning to admin dashboard cleared POS body flags again.
- Browser console had no error or warning logs after the page-switch sequence.

Remaining Phase 4 work:

- Notification rendering and API orchestration still live in `app.js`; keep module extraction for the notifications slice rather than mixing it into this timer cleanup batch.
- Future page modules should return `mount(context)` / optional `unmount()` or register their effects through this lifecycle scope.
