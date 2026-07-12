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

### Phase 3 Completion

Completed on 2026-07-10:

- Extracted notification drawer, unread badge, polling, toast dispatch, and notification order detail to `resources/js/pages/notifications/index.js`.
- Extracted employee/admin login interactions to `resources/js/pages/auth/login.js` and shared toast rendering to `resources/js/modules/toast.js`.
- Extracted shared checkout orchestration to `resources/js/pages/pos/checkout.js`.
- Extracted coffee map, order modal orchestration, merge workflow, and table/counter actions to `resources/js/pages/pos/coffee.js`.
- Extracted fishing map, countdown, merge workflow, session detail, and order actions to `resources/js/pages/pos/fishing.js`.
- Extracted admin/employee order lists, filters, polling, and order detail to `resources/js/pages/orders/list.js`.
- Extracted admin menu, payment settings, and map workflows to `resources/js/pages/admin/menu.js`, `settings.js`, and `map.js`.
- Added shared admin pagination/search primitives and shared POS payment-method display helpers.
- Moved the shared page lifecycle instance to `resources/js/shell/page-lifecycle.js` so page modules register cleanup without depending on the bootstrap.
- Reduced `resources/js/app.js` from 3436 lines after the shell slice to 78 lines. It now contains only imports, dependency wiring, shell bootstrap, router dispatch, modal fallback cleanup, and app entry selection.
- Increased JS tests from 17 to 19 with notification classification and payment-method label coverage.

Phase 3 completion verification:

- `npm test`: passed, 19 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-BENaVWVA.js`.
- Browser smoke passed on the built asset for admin dashboard, notification drawer, admin orders/menu/settings/map/users, coffee map/order modal, fishing map/start confirm, and logout confirm.
- Confirm cancel paths left no open dialog or `body.modal-open` state.
- Browser console had no warning or error logs after the smoke matrix.

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

### Phase 4 Completion

Completed on 2026-07-10:

- Added `resources/js/shell/page-runtime.js` with the shared `definePageModule()` contract and active page runtime.
- Every routed POS/admin page now exports `mount(context)` and `unmount()` through a page module object.
- Updated the router to unmount the current page before applying the next page shell and mounting its module.
- Each page mount receives a fresh lifecycle scope; failed mounts immediately run module cleanup and dispose the scope.
- Added lifecycle-managed DOM listeners for sidebar, profile menu, notification drawer, and live clock setup.
- Moved Orders/Admin Map polling, fishing countdown, menu/orders search debounce, and POS operational reset onto their owning lifecycle scopes.
- Removed the shared singleton `resources/js/shell/page-lifecycle.js`.
- Added tests for listener cleanup, page switch cleanup order, failed mount cleanup, and router unmount-before-mount behavior.

Phase 4 completion verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 23 tests.
- `npm run build`: passed with `public/build/assets/app-BmcCRcE3.css` and `public/build/assets/app-DmYUUbGq.js`.
- Browser smoke passed while cycling dashboard, Orders, Admin Map, Coffee, Fishing, and dashboard again across polling/countdown boundaries.
- Notification drawer, fishing confirm, and logout confirm remained functional and closed without stale modal/drawer state.
- Browser console had no warning or error logs after the lifecycle smoke matrix.

## Phase 5 Completion

Completed on 2026-07-10:

- Replaced static inline presentation in checkout, coffee POS, fishing POS, order receipts, admin menu forms, and admin map controls with semantic classes.
- Replaced checkout disabled/dimmed DOM style assignments with `is-disabled` and `is-dimmed` state classes.
- Replaced the fishing session total color argument with an explicit `paid` tone class.
- Kept only five data-driven inline declarations: two fishing slot grid coordinates and three dashboard percentage widths.
- Added a JS contract test proving fishing session total markup uses classes and contains no inline style.

Phase 5 acceptance checks:

- `rg -o 'style=' resources/js | wc -l` must return `5`.
- Every remaining match must be listed in `docs/frontend-architecture.md` under Dynamic Style Exceptions.
- `php artisan test`, `npm test`, `npm run build`, `git diff --check`, and desktop/iPad browser smoke must pass before Phase 6 begins.

Phase 5 verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 24 tests.
- `npm run build`: passed with `public/build/assets/app-BT5D9bj9.css` and `public/build/assets/app-xclCEor3.js`.
- `git diff --check`: clean; exactly five `style=` matches remain under `resources/js/`.
- Desktop 1280×720 and iPad portrait 768×1024 smoke checks passed against the built CSS using representative checkout, POS, order-session, admin menu, and admin map markup. No horizontal overflow or browser console warning/error was detected.
- The authenticated local app smoke could not be repeated because the stored admin password no longer matches the documented seed credential; no account or password data was changed for QA.

## Phase 6A: Admin Map CSS Ownership

Completed on 2026-07-10:

- Split Admin Map base rules from `pages/admin.css` into `pages/admin-map.css` without changing their page-layer position.
- Moved Admin Map preview, resource modal, toolbar, and occupancy compatibility rules from `legacy-overrides.css` into `pages/admin-map-overrides.css`.
- Imported the compatibility file immediately after legacy so responsive and late component layers retain their existing priority.
- Left shared legacy selectors in place when they also own Orders tabs, generic admin surfaces, or employee POS fishing behavior.
- Reduced `legacy-overrides.css` from 13,868 to 13,632 lines.

Phase 6A verification requirements:

- `php artisan test`, `npm test`, `npm run build`, and `git diff --check` pass.
- Admin Map toolbar, coffee states, fishing states, resource form, and action footer have no horizontal overflow at desktop, iPad portrait/landscape, and mobile widths.
- No Admin Map-only resource/modal/state block remains in `legacy-overrides.css`.

Phase 6A verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 24 tests.
- `npm run build`: passed with `public/build/assets/app-CzXdkx09.css` and `public/build/assets/app-xclCEor3.js`.
- `git diff --check`: clean.
- Built-asset smoke passed at desktop 1280×720, iPad portrait 768×1024, iPad landscape 1024×768, and mobile 390×844.
- Coffee available/occupied/paid/disabled states, the 20-slot fishing map, responsive toolbar, and resource modal stayed within their viewports with no horizontal document overflow.
- Browser console contained no warning or error. The temporary QA harness was removed after verification.

## Phase 6B: Admin Menu List And Editor CSS

Completed on 2026-07-10:

- Replaced `pages/admin.css` with the explicit `pages/admin-menu.css` ownership file.
- Moved Admin Menu table images, empty state, list toolbar, search, pagination, and single-item editor rules out of `legacy-overrides.css`.
- Added `pages/admin-menu-overrides.css` after legacy to preserve the original admin cascade.
- Kept iPad table rules and broad admin surface selectors in legacy because they still share ownership with generic table/responsive behavior.
- Kept all batch-create modal rules in legacy for a separate Phase 6C visual slice.
- Added the missing mobile single-item editor layout: one-column form, horizontal divider, and single-column field grid.
- Reduced `legacy-overrides.css` from 13,632 to 12,856 lines.

Phase 6B verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 24 tests.
- `npm run build`: passed with `public/build/assets/app-DzWK6jbm.css` and `public/build/assets/app-xclCEor3.js`.
- `git diff --check`: clean.
- Built-asset list/table/pagination smoke passed at desktop 1280×720, iPad portrait 768×1024, and mobile 390×844 with no document-level horizontal overflow.
- Single-item editor remained two-column at 1024px and switched to a 312px one-column form at 390px without internal horizontal overflow.
- Browser console contained no warning or error. The temporary QA harness was removed after verification.

## Phase 6C: Admin Menu Batch-Create CSS

Completed on 2026-07-10:

- Moved the batch-create modal, category picker, row editor, image picker, availability toggles, remove action, and price-range rules into `pages/admin-menu-batch.css`.
- Added `pages/admin-menu-batch-overrides.css` after the Admin Menu list/editor layers to preserve the former legacy priority without broadening selector scope.
- Moved the Phase 5 batch price-range presentation classes out of `pages/admin-menu.css` so each Admin Menu workflow has one explicit owner.
- Added a mobile layout below 768px: wider modal shell, image/content row, single-column fields, and a full-width action row.
- Removed every Admin Menu batch-create selector from `legacy-overrides.css`.
- Reduced `legacy-overrides.css` from 12,856 to 12,250 lines.

Phase 6C verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 24 tests.
- `npm run build`: passed with `public/build/assets/app-B_eQUGnT.css` and `public/build/assets/app-xclCEor3.js`.
- Desktop 1280×720, iPad portrait 768×1024, iPad landscape 1024×768, and mobile 390×844 batch-modal smoke checks passed without document or modal-body horizontal overflow.
- Mobile rows resolve to an 82px image column and a flexible 244px content column; their fields stack to one column and actions occupy a separate row.
- Browser console contained no warning or error. The temporary QA harness was removed after verification.

## Phase 6D: Pagination And Staff Order Table CSS

Completed on 2026-07-10:

- Added `components/pagination.css` for the shared paginated workspace, internal data scroll, sticky header, paginator controls, and paginator states.
- Added `pages/pos-orders-overrides.css` after legacy for the employee Orders bordered scroll container and late sticky-header treatment.
- Moved order metadata layout to `pages/pos-orders.css` and shared table action icon presentation to `components/table.css`.
- Preserved the later admin paginator and feature-specific table overrides in their current owners.
- Kept the broad iPad `:not(.owner-orders-page):not(.owner-menu-page)` selector in legacy for a separate feature-scoped replacement.
- Reduced `legacy-overrides.css` from 12,250 to 12,061 lines.

Phase 6D verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 24 tests.
- `npm run build`: passed with `public/build/assets/app-ChbAOJ39.css` and `public/build/assets/app-xclCEor3.js`.
- Staff Orders and Admin Orders pagination smoke passed at desktop 1280×720, iPad landscape 1024×768, iPad portrait 768×1024, and mobile 390×844.
- Desktop/iPad table bodies scroll internally, sticky headers remain fixed after a 160px scroll, and the paginator remains outside the scrolling data region.
- Mobile keeps natural document scrolling, contains horizontal table scrolling within `.paginated-scroll`, and keeps the paginator inside the viewport.
- Browser console contained no warning or error. The temporary QA harness was removed after verification.

## Phase 6E: Feature-Scoped Tablet Tables

Completed on 2026-07-10:

- Replaced the broad `:not(.owner-orders-page):not(.owner-menu-page)` tablet table selector with explicit Users, Payment Settings, and Staff Orders selectors.
- Added the first `pages/admin-settings.css` ownership file and imported it before the final mobile/iPad layers.
- Added Users tablet rules to `pages/admin-users.css` and Staff Orders tablet rules to `pages/pos-orders-overrides.css`.
- Removed the responsive `.table-actions` branch because none of the three matching table workflows renders table action buttons.
- Kept Staff Orders selectors below `#id` specificity so `responsive/ipad.css` still changes portrait cell padding from 12px by 10px to 14px by 12px.
- Reduced `legacy-overrides.css` from 12,061 to 12,021 lines.

Phase 6E verification:

- `php artisan test`: passed, 53 tests, 351 assertions.
- `npm test`: passed, 25 tests after adding the Fishing order-modal composition regression.
- `npm run build`: passed with `public/build/assets/app-Cam1b-Pq.css` and `public/build/assets/app-B6BPvgSD.js`.
- Users, Payment Settings, and Staff Orders table smoke passed at desktop 1280×720, iPad landscape 1024×768, iPad portrait 768×1024, and mobile 390×844.
- At 1024px all three owners resolve to 12px by 10px cell padding, 11px headers, 13px cells, and 10px pills. Staff Orders portrait correctly resolves to the later 14px by 12px iPad padding.
- Every checked viewport had zero document-level horizontal overflow; mobile overflow stayed inside each table region.
- Browser console contained no warning or error. The temporary QA harness was removed after verification.

### Post-Phase 6E Fishing Order Modal Fix

Fixed on 2026-07-11:

- Restored the missing `renderOrderModalBody` import in `pages/pos/fishing.js`; the missing binding caused occupied fishing spots to throw before `openModal()`.
- Added `fishingOrderModalCatalog()` as a tested composition boundary for ordered menu data, categories, and the shared order-modal body.
- Added a Node regression test that renders the Fishing modal catalog and verifies the shared modal/product markup.
- Runtime smoke with the production bundle confirmed an occupied fishing spot opens `Chòi 1 · Đang câu`, an available spot still opens the start confirmation, and an occupied Coffee table still opens its ordering modal.
- `npm test`: passed, 25 tests. `php artisan test`: passed, 53 tests and 351 assertions. The production build emitted `app-Cam1b-Pq.css` and `app-B6BPvgSD.js`.
