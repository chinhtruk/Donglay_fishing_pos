# Frontend Architecture

Date: 2026-07-10
Scope: Current frontend structure after Phase 6C CSS ownership cleanup.

## Entry Points

- `resources/views/app.blade.php` owns the authenticated app shell.
- `resources/css/app.css` is the Vite CSS entry and imports layer files.
- `resources/js/app.js` is the 80-line bootstrap that wires shell setup, routing, lifecycle cleanup, and page renderers.

Page-scale rendering and orchestration now live under `resources/js/pages/`. The bootstrap does not contain page HTML or feature-specific polling logic.

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
3. Shared components such as tables, pagination, modal shell, receipts, checkout, and notifications.
4. Base page files for admin, Admin Map, POS, and POS orders.
5. `legacy-overrides.css` for unclassified rules that still need visual QA.
6. Late feature files for POS Orders, Admin Map, Admin Menu, Admin Users, and Admin Settings that still depend on broad legacy rules.
7. Responsive files for mobile and iPad, followed by canonical checkout/notification component rules.

Do not move checkout, staff order modal, iPad, or table rules without screenshot/browser smoke at the affected viewport. Checkout and notification component rules still load late because previous fixes depended on final cascade priority.

Admin Map intentionally has two files: `pages/admin-map.css` stays at the normal page layer, while `pages/admin-map-overrides.css` loads immediately after legacy. Do not merge them until the broad admin/POS selectors they override have also left `legacy-overrides.css`.

Admin Menu uses four owned files after legacy because its original form/list and batch-create rules lived inside the legacy cascade. `pages/admin-menu.css` and `pages/admin-menu-overrides.css` own the list and single-item editor. `pages/admin-menu-batch.css` and `pages/admin-menu-batch-overrides.css` own the batch-create modal, including desktop, iPad, and mobile row layouts. No Admin Menu batch-create selector remains in legacy.

Pagination has one shared base owner in `components/pagination.css`. It defines the fixed-height paginated workspace above 768px, internal data scrolling, sticky table headers, and paginator controls. Staff Orders keeps its page-specific table and metadata rules in `pages/pos-orders.css`; `pages/pos-orders-overrides.css` loads after legacy for the late bordered scroll container and sticky-header treatment.

Tablet table sizing is feature-scoped. `pages/admin-users.css`, `pages/admin-settings.css`, and `pages/pos-orders-overrides.css` own the 768-1024px rules for their tables. Do not restore a broad `:not(.owner-orders-page):not(.owner-menu-page)` selector. Staff Orders tablet selectors must stay less specific than the final portrait rules in `responsive/ipad.css`.

## JavaScript Modules

Stable shared helpers live under `resources/js/modules/`:

- `api.js` - CSRF-aware API wrapper.
- `cart.js` - cart quantity and total logic.
- `format.js` - money, date, text escaping, status labels.
- `keyboard.js` - mobile keyboard viewport guard.
- `modal.js` - modal shell and confirm helpers.
- `timers.js` - server clock and countdown helpers.
- `toast.js` - shared toast rendering and dismissal behavior.

Modal contract coverage:

- `confirmModal()` must keep working when the confirm body target is the root node of a cloned Blade template.
- Confirm footer buttons must stay explicit `type="button"` whether they come from Blade templates or the fallback string.
- Cancel, backdrop, close button, Escape, and confirm paths must settle the confirm promise once.
- `resources/js/tests/modules.test.js` covers these helper contracts; any modal-adjacent refactor still needs browser smoke because event wiring and CSS are runtime concerns.

Feature modules created so far:

- `resources/js/templates/dom.js` - DOM selectors, template clone helpers, page head, empty state, and loading rendering.
- `resources/js/shell/router.js` - path-to-page resolution, POS/admin body flags, and routed page render wrapper.
- `resources/js/shell/lifecycle.js` - cleanup scope for timers and DOM event listeners.
- `resources/js/shell/page-runtime.js` - page-module contract, active page ownership, and per-mount lifecycle creation/cleanup.
- `resources/js/shell/sidebar.js` - active nav state, sidebar open/close, collapse state, and resize cleanup.
- `resources/js/shell/profile-menu.js` - profile menu toggle, logout confirm workflow, outside-click close, and Escape close behavior.
- `resources/js/shell/page-head.js` - live clock formatting and update setup.
- `resources/js/pages/pos/shared.js` - POS shared menu/order/payment display helpers.
- `resources/js/pages/pos/coffee.js` - coffee map, order modal orchestration, merge mode, and table/counter actions.
- `resources/js/pages/pos/fishing.js` - fishing map, countdown, merge mode, session detail, and fishing order actions.
- `resources/js/pages/pos/checkout.js` - shared coffee/fishing checkout modal and payment submission flow.
- `resources/js/pages/pos/order-modal.js` - extracted POS order modal render fragments.
- `resources/js/pages/pos/operational-day.js` - schedules the 23:59 POS refresh after backend automatic day close.
- `resources/js/pages/pos/payment-methods.js` - payment method labels and icons shared by checkout, settings, notifications, and orders.
- `resources/js/pages/notifications/index.js` - notification drawer, unread badge, polling, toast dispatch, and notification order detail.
- `resources/js/pages/orders/list.js` - admin/employee order list, filters, polling, and order detail modal.
- `resources/js/pages/admin/dashboard.js` - admin dashboard API load, KPI/chart rendering, date presets, and chart tooltip behavior.
- `resources/js/pages/admin/forms.js` - admin payment/user form renderers.
- `resources/js/pages/admin/menu.js` - menu filtering, pagination, batch create, edit, and archive workflows.
- `resources/js/pages/admin/settings.js` - payment method list and edit workflow.
- `resources/js/pages/admin/data.js` - database backup and operational-data reset workflow.
- `resources/js/pages/admin/map.js` - coffee/fishing resource map, polling, and resource modal workflow.
- `resources/js/pages/admin/pagination.js` and `search-icon.js` - small admin list primitives shared by menu and orders.
- `resources/js/pages/admin/users.js` - admin user list rendering and user account modal workflow.
- `resources/js/pages/auth/login.js` - employee username-to-email OTP and admin login interactions.

Coffee and Fishing both compose their ordering modal with `renderOrderModalBody()` from `pages/pos/order-modal.js`. Fishing routes that composition through the tested `fishingOrderModalCatalog()` helper; removing the shared renderer import breaks occupied-spot clicks before `openModal()` runs.

## Dynamic Style Exceptions

Generated markup must use semantic classes for static presentation. The only accepted `style=` attributes under `resources/js/` are values calculated from runtime data:

- `pages/pos/fishing.js`: `grid-column` and `grid-row` for each fishing slot.
- `pages/admin/map.js`: `grid-column` and `grid-row` for each admin fishing slot.
- `pages/admin/dashboard.js`: three `width` values for revenue share, coffee share, and fishing occupancy bars.

Checkout, POS session rows, order receipts, admin menu forms, and admin map actions now use classes owned by their page/component CSS. Add a new inline style only when a class cannot represent the runtime value, and record the exception in this section.

## Remaining Hotspots

- Some feature modules remain large, especially `pages/pos/fishing.js`, `pages/admin/menu.js`, and `pages/pos/coffee.js`; their ownership is now explicit, so future template extraction can stay feature-local.
- Large HTML strings still exist inside feature modules and should move gradually to Blade templates without changing event/state logic in the same batch.
- Inline styles are limited to the five documented runtime-data exceptions above.
- Every routed page exports a module with `mount(context)` and `unmount()`. The router unmounts the active module before mounting the next one, and each mount receives a fresh lifecycle scope.
- Notification polling, notification drawer refresh, fishing countdown, Orders polling, Admin Map polling, POS operational reset, search debounce, live clock, and shell listeners now register cleanup through their owning lifecycle scope.
- CSS legacy cleanup is only partially complete. `legacy-overrides.css` remains the holding area until rules are grouped and visually checked.

## Safe Refactor Order

1. Keep future renderer/template cleanup inside the owning page module.
2. Add or update a JS node test when the renderer has branching logic.
3. Keep API payloads and route URLs unchanged.
4. For CSS movement, keep import order stable unless a browser check proves the cascade change is safe.
5. Run `npm test`, `npm run build`, `git diff --check`, and the affected manual POS/admin flow.
