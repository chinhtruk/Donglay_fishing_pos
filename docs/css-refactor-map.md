# CSS Refactor Map

Date: 2026-07-01
Status: Phase 5 docs sync after modal shell and POS order modal extraction.

## Entry Point

`resources/css/app.css` is now an import-only Vite entry:

1. `tokens.css`
2. `base.css`
3. `layout/shell.css`
4. `components/table.css`
5. `components/modal-shell.css`
6. `components/receipt.css`
7. `pages/admin.css`
8. `pages/pos.css`
9. `pages/pos-orders.css`
10. `legacy-overrides.css`
11. `pages/admin-users.css`
12. `responsive/mobile.css`
13. `responsive/ipad.css`
14. `components/checkout-modal.css`
15. `components/notifications.css`

The import order is part of the behavior. Later files intentionally win over earlier files.

## Layer Ownership

- `tokens.css` - font import, color/shadow/radius/font variables.
- `base.css` - reset, body, anchors, buttons, inputs, generic form primitives, auth/login primitives.
- `layout/shell.css` - app shell, sidebar, topbar, workspace, page content.
- `components/table.css` - base data table and pill primitives.
- `components/modal-shell.css` - shared modal backdrop, shell, header/body/footer, close button, and base modal animations.
- `components/receipt.css` - order detail, receipt, slip, payment composition.
- `pages/admin.css` - admin map/resource controls and admin-specific page rules already classified.
- `pages/admin-users.css` - admin users table, row-click affordance, and user account modal rules moved out of legacy while preserving override order.
- `pages/pos.css` - POS order modal shell plus independent menu/bill scroll rules already classified.
- `pages/pos-orders.css` - staff orders table/detail modal rules.
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
- Phase 5 documented the current cascade contract. No additional CSS selectors were moved in that phase.
- Some JS-rendered markup still uses inline styles, especially admin map action buttons and dynamic fishing map elements.
- CSS visual regression is still manual. Automated screenshots were not reliable in the baseline environment.
