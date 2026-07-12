# CSS Refactor Map

Date: 2026-07-10
Status: Phase 6E feature-scoped tablet table ownership completed.

## Entry Point

`resources/css/app.css` is now an import-only Vite entry:

1. `tokens.css`
2. `base.css`
3. `layout/shell.css`
4. `components/table.css`
5. `components/modal-shell.css`
6. `components/receipt.css`
7. `components/pagination.css`
8. `pages/admin-map.css`
9. `pages/pos.css`
10. `pages/pos-orders.css`
11. `legacy-overrides.css`
12. `pages/pos-orders-overrides.css`
13. `pages/admin-map-overrides.css`
14. `pages/admin-menu.css`
15. `pages/admin-menu-batch.css`
16. `pages/admin-menu-overrides.css`
17. `pages/admin-menu-batch-overrides.css`
18. `pages/admin-users.css`
19. `pages/admin-settings.css`
20. `responsive/mobile.css`
21. `responsive/ipad.css`
22. `components/checkout-modal.css`
23. `components/notifications.css`

The import order is part of the behavior. Later files intentionally win over earlier files.

## Layer Ownership

- `tokens.css` - font import, color/shadow/radius/font variables.
- `base.css` - reset, body, anchors, buttons, inputs, generic form primitives, auth/login primitives.
- `layout/shell.css` - app shell, sidebar, topbar, workspace, page content.
- `components/table.css` - base data table and pill primitives.
- `components/modal-shell.css` - shared modal backdrop, shell, header/body/footer, close button, and base modal animations.
- `components/receipt.css` - order detail, receipt, slip, payment composition.
- `components/pagination.css` - shared paginated workspace sizing, internal data scroll, sticky table header, paginator controls, and states.
- `pages/admin-map.css` - Admin Map toolbar, coffee/fishing previews, resource form base controls, and Phase 5 presentation hooks.
- `pages/admin-map-overrides.css` - late Admin Map compatibility rules that intentionally retain priority over broad legacy admin/POS rules.
- `pages/admin-menu.css` - Admin Menu table media, empty state, single-item form, and static price-range presentation extracted from legacy/Phase 5.
- `pages/admin-menu-batch.css` - Admin Menu batch-create modal, category picker, item rows, image picker, price-range controls, and base iPad layout.
- `pages/admin-menu-overrides.css` - late Admin Menu list, toolbar, pagination, single-item modal, and mobile editor rules.
- `pages/admin-menu-batch-overrides.css` - late scoped batch-create compatibility rules, including desktop, iPad, and mobile row layouts.
- `pages/admin-users.css` - admin users table, row-click affordance, and user account modal rules moved out of legacy while preserving override order.
- `pages/admin-settings.css` - feature-scoped Admin Payment Settings table rules, starting with tablet sizing and typography.
- `pages/pos.css` - POS order modal shell plus independent menu/bill scroll rules already classified.
- `pages/pos-orders.css` - staff orders table/detail modal and fishing session line presentation.
- `pages/pos-orders-overrides.css` - late staff order table scroll container, border treatment, and sticky header compatibility rules.
- `responsive/mobile.css` - phone-width shell rail and scroll containment.
- `responsive/ipad.css` - tablet/iPad final responsive layer.
- `components/checkout-modal.css` - checkout modal final/canonical rules.
- `components/notifications.css` - notification drawer/detail rules.
- `legacy-overrides.css` - unclassified rules preserved until screenshot-backed cleanup.

## Cleanup Rules

- Do not delete checkout, table, staff order modal, or iPad rules without desktop, iPad portrait, iPad landscape, and mobile screenshots.
- Move rules out of `legacy-overrides.css` in small groups by feature.
- Preserve source comments when moving a block for the first time.
- Keep checkout and notifications after legacy unless a screenshot proves the cascade can be changed.
- Prefer adding clear page/component classes over selectors like `:not(.owner-orders-page):not(.owner-menu-page)`.

## Current Debt

- `legacy-overrides.css` is still intentionally large.
- The first Phase 3 cleanup moved admin users CSS out of `legacy-overrides.css`; keep future feature CSS after legacy when it depends on overriding older broad admin rules.
- Phase 4 moved the shared modal shell into `components/modal-shell.css` and the base POS order modal shell into `pages/pos.css`. Checkout/iPad parity rules remain later in `components/checkout-modal.css`.
- Phase 5 moved static checkout, POS coffee/fishing, order receipt, admin menu, and admin map presentation from generated markup into owned CSS classes.
- Phase 6A reduced `legacy-overrides.css` from 13,868 to 13,632 lines by moving 236 lines of Admin Map compatibility rules into an owned late layer. Shared selectors used by Orders or POS remain in legacy until those features are extracted together.
- Phase 6B reduced `legacy-overrides.css` from 13,632 to 12,856 lines by moving the Admin Menu list, empty state, toolbar, pagination, and single-item editor into owned late layers.
- Phase 6C reduced `legacy-overrides.css` from 12,856 to 12,250 lines by moving all Admin Menu batch-create selectors into owned base and late layers. No batch-create selector remains in legacy.
- Phase 6D reduced `legacy-overrides.css` from 12,250 to 12,061 lines by extracting the shared paginated workspace/paginator and late staff order table scroll rules. Shared table icon and order metadata presentation now live in their base owners.
- Phase 6E reduced `legacy-overrides.css` from 12,061 to 12,021 lines by replacing the broad iPad table selector with explicit Users, Payment Settings, and Staff Orders owners. Its unused responsive `.table-actions` branch was deleted.
- Staff Orders tablet selectors intentionally omit `#order-results`; lower specificity allows the final iPad portrait layer to retain its 14px by 12px cell padding.
- Five dynamic inline declarations remain by design: two fishing slot coordinate declarations and three dashboard percentage widths.
- CSS visual regression is still manual. Automated screenshots were not reliable in the baseline environment.
