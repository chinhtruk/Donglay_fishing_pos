# Frontend Architecture

Date: 2026-07-01
Scope: Current frontend structure after Phase 3 shell module extraction.

## Entry Points

- `resources/views/app.blade.php` owns the authenticated app shell.
- `resources/css/app.css` is the Vite CSS entry and imports layer files.
- `resources/js/app.js` is still the main app runtime and router, but page-scale render work is being moved out in small slices.

The frontend is intentionally in a transitional modular state. The current refactor has moved stable helpers, shell routing/setup, admin dashboard/users rendering, admin form templates, and POS order-modal render fragments out of `app.js`. `app.js` still owns global notification polling, checkout orchestration, and several page flows.

## Blade Shell

`app.blade.php` includes partials from `resources/views/app/partials/`:

- `sidebar.blade.php`
- `topbar.blade.php`
- `profile-menu.blade.php`
- `notification-drawer.blade.php`
- `loading-state.blade.php`
- `roots.blade.php`
- `templates.blade.php`

Blade should keep static shell and reusable template markup. JavaScript should clone and fill templates when content is data-driven.

## CSS Layers

`resources/css/app.css` is import-only. The order is part of behavior because later layers intentionally override earlier layers:

1. Tokens and base primitives.
2. Shell layout.
3. Shared components such as tables, modal shell, receipts, checkout, and notifications.
4. Page files for admin, POS, POS orders, and admin users.
5. `legacy-overrides.css` for unclassified rules that still need visual QA.
6. Responsive files for mobile and iPad.

Do not move checkout, staff order modal, iPad, or table rules without screenshot/browser smoke at the affected viewport. Checkout and notification component rules still load late because previous fixes depended on final cascade priority.

## JavaScript Modules

Stable shared helpers live under `resources/js/modules/`:

- `api.js` - CSRF-aware API wrapper.
- `cart.js` - cart quantity and total logic.
- `format.js` - money, date, text escaping, status labels.
- `keyboard.js` - mobile keyboard viewport guard.
- `modal.js` - modal shell and confirm helpers.
- `timers.js` - server clock and countdown helpers.

Modal contract coverage:

- `confirmModal()` must keep working when the confirm body target is the root node of a cloned Blade template.
- Confirm footer buttons must stay explicit `type="button"` whether they come from Blade templates or the fallback string.
- Cancel, backdrop, close button, Escape, and confirm paths must settle the confirm promise once.
- `resources/js/tests/modules.test.js` covers these helper contracts; any modal-adjacent refactor still needs browser smoke because event wiring and CSS are runtime concerns.

Feature modules created so far:

- `resources/js/templates/dom.js` - DOM selectors, template clone helpers, page head, empty state, and loading rendering.
- `resources/js/shell/router.js` - path-to-page resolution, POS/admin body flags, and routed page render wrapper.
- `resources/js/shell/lifecycle.js` - page-level cleanup scope for timers and future module unmount hooks.
- `resources/js/shell/sidebar.js` - active nav state, sidebar open/close, collapse state, and resize cleanup.
- `resources/js/shell/profile-menu.js` - profile menu toggle, logout confirm workflow, outside-click close, and Escape close behavior.
- `resources/js/shell/page-head.js` - live clock formatting and update setup.
- `resources/js/pages/pos/shared.js` - POS shared menu/order/payment display helpers.
- `resources/js/pages/pos/order-modal.js` - extracted POS order modal render fragments.
- `resources/js/pages/pos/operational-day.js` - POS operational reset scheduling.
- `resources/js/pages/admin/dashboard.js` - admin dashboard API load, KPI/chart rendering, date presets, and chart tooltip behavior.
- `resources/js/pages/admin/forms.js` - admin payment/user form renderers.
- `resources/js/pages/admin/users.js` - admin user list rendering and user account modal workflow.

## Remaining Hotspots

- `resources/js/app.js` still contains large coffee, fishing, orders, menu, settings, map, checkout, and notification flows.
- Notification rendering and API orchestration are still in `app.js`; they are the next safest extraction target now that shell setup and timer cleanup are separated.
- Large HTML strings still exist in POS/admin pages and should be moved gradually to Blade templates or feature modules.
- Inline styles still exist in a few admin map/POS modal paths. Keep dynamic map coordinates inline; move layout/button styling to CSS.
- Notification polling, notification drawer refresh, fishing countdown, Orders polling, and Admin Map polling now register cleanup through `resources/js/shell/lifecycle.js`. Future page modules should expose `mount(context)` and optional `unmount()` or register their timers/listeners in the same lifecycle scope.
- CSS legacy cleanup is only partially complete. `legacy-overrides.css` remains the holding area until rules are grouped and visually checked.

## Safe Refactor Order

1. Move one small renderer at a time from `app.js` to a page/template module.
2. Add or update a JS node test when the renderer has branching logic.
3. Keep API payloads and route URLs unchanged.
4. For CSS movement, keep import order stable unless a browser check proves the cascade change is safe.
5. Run `npm test`, `npm run build`, `git diff --check`, and the affected manual POS/admin flow.
