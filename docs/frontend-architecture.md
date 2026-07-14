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

### Phone Shell Contract

- Below 768px, the app shell is a single-column workspace; the desktop sidebar collapse preference does not consume phone width.
- The existing sidebar becomes an off-canvas drawer controlled by `#menu-toggle`, `#sidebar-mobile-close`, and `#sidebar-scrim`.
- Drawer state is reflected through `body.sidebar-open`, `.sidebar.open`, `aria-expanded`, `aria-hidden`, and `inert` when supported.
- Opening the drawer moves focus to the active navigation item. Close button, scrim, and Escape return focus to the menu toggle; Tab remains inside the open drawer.
- Crossing the 768px boundary closes transient drawer state without overwriting the stored desktop collapsed/expanded preference.
- The authenticated app viewport uses `viewport-fit=cover`; phone topbar/sidebar spacing accounts for safe-area insets.
- Phone shell sizing uses the mobile tokens in `tokens.css`. Feature-specific phone layouts remain in their owning page/component files.

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

Admin Dashboard phone rules live in `pages/admin-dashboard.css`, immediately after legacy. This owner exists because the dashboard geometry still has multiple high-specificity desktop/tablet generations in legacy; phone changes must remain feature-scoped until those rules are consolidated.

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

### Phone Shared Component Contract

- At widths below 768px, ordinary `#modal-root` dialogs are full-screen and safe-area aware. Short confirms use `.modal-confirm` plus `.modal-confirm-backdrop` and remain centered. `.pos-order-modal` and `.pos-checkout-modal` are excluded from this generic rule because their dedicated transaction contract owns them.
- Modal and notification drawer code own focus containment, Escape handling, initial focus, and focus restoration. Opening the notification drawer closes the sidebar and vice versa so two body-locking surfaces cannot remain open together.
- `keyboard.js` and the modal keyboard guard share `keyboardViewportOffset()` and `keyboardViewportIsOpen()`. The 120px threshold filters browser chrome changes while `visualViewport` still supplies the actual keyboard offset.
- Phone form controls keep a 44px minimum target and 16px rendered font size. Feature CSS may rearrange a form but must not shrink those interaction primitives.
- Table-to-card behavior is opt-in through `.data-table-wrap.is-mobile-card-list` and requires `data-label` on each data cell. Page owners must review field order and actions before enabling it; tables remain unchanged from 768px upward.
- Pagination keeps summary and controls separate on phones; the control strip may scroll horizontally but each button remains 44px. Notification drawer/toast phone rules stay in `components/notifications.css` because that file loads after the general responsive layer.

### Phone POS Map Contract

- `pages/pos.css` owns the Phase 3 phone rules for Coffee and Fishing. They are scoped to authenticated employee POS body flags and stop at 767px; the same owner now also contains Phase 4 order-dialog rules, while checkout remains in its late-loading component owner.
- Coffee exposes `coffeeTableCardView()` as the tested state-to-copy adapter. The phone renderer keeps the same table/order data and click handlers, while presenting two columns from 360px and one column on compact phones.
- Fishing exposes `fishingSpotCardView()` for stable operational labels. Runtime `grid-column` and `grid-row` declarations remain the source of truth: phone CSS preserves left bank, narrow lake axis, and right bank rather than resetting slots to document order.
- Merge mode adds `.is-merge-mode`, `aria-live` guidance, and per-source `aria-pressed` state. Cancel removes both visual and accessibility selection state; existing API/version-conflict behavior is unchanged.
- Fishing countdown remains lifecycle-owned and updates once per second. When the remaining duration reaches zero, the slot receives the expired state and visible “Hết giờ” label together; tabular numerals prevent width jitter.
- Phone map decoration is non-essential: fish/flora may be hidden below 768px, but operational colors, textual state, slot side, label, and countdown must remain visible. From 768px upward the pre-existing iPad/desktop contracts win unchanged.

### Phone POS Transaction Contract

- `pages/pos/order-modal.js` owns the phone Menu/Phiếu navigation state. A new order starts on Menu; an existing Coffee/Fishing order starts on Phiếu. Switching modes only changes presentation classes and never rebuilds the catalog, search input, category selection, or cart.
- `pages/pos.css` owns order-modal rules below 768px. The dialog/backdrop is full-screen, product grids use two columns from 360px and one column below 360px, and the receipt CTA/footer account for safe-area insets. The selectors explicitly exclude `.pos-checkout-modal`.
- Coffee and Fishing update the shared badge/CTA after each bill render and announce additions through an `aria-live` region. Category selection centers the active chip only on phone. Business state, payloads, variable pricing, paid-line locks, session discount rules, and 409 handling remain in their existing modules.
- `components/checkout-modal.css` is the final cascade owner for checkout phone layout. It flattens the receipt wrapper into a single reading order: items, payment method, payment panel, change/release, then sticky total/action. At 768px and above the existing grid contract remains active.
- `pages/pos/checkout.js` keeps cash/QR and partial/full calculations unchanged while exposing a tested submit guard. A cash payment requires enough received cash; QR requires a non-zero selected total. Partial selection disables resource release and provides a visible reason.
- Checkout submission is single-flight: the confirm button becomes disabled and shows “Đang xử lý…” until completion. Version-conflict refresh behavior and API routes/payloads are unchanged. QR account copy provides immediate live feedback and uses the browser clipboard contract.

### Phone Orders and Receipt Contract

- `pages/orders/list.js` remains the single data owner for employee/admin Orders. Both roles use the existing `/api/v1/orders` pagination and polling contract; phone search/status filters only add existing query parameters and reset the current page/signature before rendering.
- Orders opt into `.is-mobile-card-list` below 768px. Semantic cell classes define the reviewed reading order: order/status, service, resource, time, and admin total. Rows remain keyboard buttons and the desktop/iPad table structure returns unchanged from 768px.
- Receipt rendering normalizes missing legacy arrays and splits each item by `paid_quantity`/`unpaid_quantity`. A partially paid line may therefore appear in both sections with its exact portion; employee receipts retain time groups while admin receipts retain price, totals, and payment history.
- Phone receipt dialogs use one full-screen scroll surface with a fixed modal header. Admin totals are sticky at the bottom, payment history is an accessible disclosure, and paid/unpaid states always include visible text or symbols in addition to color.
- Orders intentionally expose no void/reverse controls under the current regression contract. Closing a receipt is presentation-only; no payment adjustment request is emitted. API routes, payment math, resource release, and version handling remain outside this renderer.

### Phone Admin Management Contract

- `pages/admin-dashboard.css` owns the Phase 6 Dashboard phone order and stops at 767px. Date inputs render at 16px, range/KPI controls meet 44px, chart overflow stays inside `.owner-chart-wrap`, and desktop SVG/viewBox/data remain unchanged.
- Menu, Users, and Payment Settings opt into `.is-mobile-card-list` with semantic feature cell classes. Their renderers keep one table DOM and the same row handlers; CSS restores normal table layout from 768px. Destructive Menu action remains a separate 44px control and does not bubble into edit.
- Menu item, Menu batch, User account, and Payment method dialogs use the shared full-screen modal contract on phone. Each feature owner only controls internal field order/media sizing; modal focus, Escape, keyboard offset, footer, and focus return remain shared-module responsibilities.
- Admin Map adds `.owner-map-page` for strict scoping. Phone Coffee uses a 1/2-column card grid; Fishing retains runtime `grid-column`/`grid-row` and the three-axis lake model. Resource delete now uses `confirmModal()` and still relies on backend active-order protection.
- Data/Backup stays in `pages/admin-settings.css`. Phone cards separate backup and danger operations, while `runDataAction()` remains the single-flight owner and backend confirmation text/payload remain unchanged.
- `responsive/mobile.css` is the final phone guard for shared confirm targets. Feature rules must not reduce confirm actions below 44px, even when a legacy `.button` height has greater specificity earlier in the cascade.

### Accessibility and Resilient Presentation Contract

- `components/accessibility.css` is imported last and owns shared focus-visible, reduced-motion, forced-colors, safe-area, short-landscape, long-copy, and 200%-zoom resilience. It does not change business layout above those boundary conditions.
- Modal accessible names come from unique `aria-labelledby` title IDs. Sidebar navigation exposes `aria-current="page"`; the profile trigger keeps a complete name when visual copy is hidden; login tabs use roving tabindex and arrow-key navigation.
- `modules/action.js` owns single-flight admin buttons. While a request runs it sets native disabled plus `aria-busy`/`aria-disabled`, blocks a second invocation, and restores the original control when the action remains mounted.
- Toast errors are assertive alerts; page, notification list, forms, and guarded buttons expose busy state without turning frequently-polled lists into noisy live regions.
- Product/menu/QR images reserve painted layout space and decode asynchronously. Remote Be Vietnam Pro keeps swap loading with a system-font fallback chain; long names and emails may wrap anywhere inside reviewed content regions.
- Background polling checks `document.hidden` before network or DOM work. Visible-tab polling cadence, route signatures, API requests, countdown meaning, and operational behavior remain unchanged.

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
