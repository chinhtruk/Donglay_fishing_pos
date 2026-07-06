# Backend Services Map

Date: 2026-07-01

## OrderNumberGenerator

Generates human-readable order/payment numbers. It centralizes the random code patterns that were previously duplicated in workflow services.

Current consumers:

- `CoffeeOrderService`
- `FishingService`
- `OrderPaymentService`

## OrderLineReconciler

Replaces menu lines while protecting already-paid quantities.

Responsibilities:

- Validate menu item availability and quantity range.
- Preserve paid quantities.
- Split new unpaid quantities into fresh order item rows when needed.
- Keep menu line notes aligned with the requested line.

Do not use this service for fishing session base lines or extension lines. Those are not normal menu lines.

## OrderTotalsCalculator

Recomputes order totals from persisted order items.

Use it after creating, replacing, deleting, or merging order items. Avoid recalculating totals in controllers.

## OrderStatusResolver

Answers whether an order still has unpaid items and resolves paid/partially-paid state.

Use it after checkout and line reconciliation instead of comparing order totals manually.

## OrderPaymentService

Creates payments and payment lines, increments paid quantities, validates selected payable quantities, and updates order status/version.

Important behavior:

- Empty checkout selections mean pay all remaining quantities.
- Non-cash methods set `cash_received` to the selected payment amount.
- Cash checkout rejects insufficient received amount.
- Payment line quantity cannot exceed unpaid quantity.

## AdminDashboardService

Builds the `/api/v1/admin/dashboard` report payload from validated date range input.

Responsibilities:

- Normalize current and comparison date ranges.
- Calculate collected revenue, outstanding balances, paid/attention order counts, void metrics, and service split.
- Build daily revenue rows, top paid items, peak hours, cashier rankings, and alert rows.
- Keep dashboard response formatting stable while `AdminController` stays thin.

Do not add admin UI rendering concerns here. This service should only return the existing API payload shape.

Controller boundary:

- `AdminController::dashboard()` should stay as a thin call to this service.
- Date parsing and validation should stay in `DashboardRangeRequest`.
- Frontend chart/card layout belongs in `resources/js/pages/admin/dashboard.js`, not in this service.

## AdminMenuService

Owns admin menu management workflow.

Responsibilities:

- Build the `/api/v1/admin/menu` list payload with category and search filters.
- Resolve existing or newly typed menu categories.
- Create a single menu item, including image upload/removal.
- Create menu items in batch inside one transaction.
- Clean up uploaded images if batch creation fails.
- Update an existing menu item while preserving image cleanup behavior.
- Archive a menu item only when it is not attached to an active order.
- Write menu audit entries through `AdminAuditLogger`.

Controller boundary:

- `AdminController` should keep only request/response messages and status codes for menu endpoints.
- Menu category resolution and menu image storage should stay inside this service.

## AdminPaymentMethodService

Owns admin payment settings and payment-method workflow.

Responsibilities:

- Build payment settings payloads for admin.
- Update the primary QR payment settings.
- Create additional QR/cash payment methods.
- Update existing payment methods.
- Enforce one cash method.
- Validate QR readiness before enabling QR methods.
- Clean up uploaded QR images on failed writes or image replacement/removal.
- Write payment audit entries through `AdminAuditLogger`.

Controller boundary:

- `AdminController` should not know QR upload paths, cash uniqueness rules, or readiness validation.
- `PaymentQrSetting` still owns persisted payload helpers such as `payload()`, `adminPayload()`, and `methodsPayload()`.

## AdminMapService

Owns admin coffee/fishing map management workflow.

Responsibilities:

- Build admin map payloads for coffee tables and fishing spots.
- Preserve occupied/expired/available/disabled state calculation.
- Update slots inside a transaction with row locks.
- Create coffee/fishing slots at default center coordinates.
- Delete slots only when there are no active orders.
- Write map audit entries through `AdminAuditLogger`.

Controller boundary:

- `AdminController` should not select map models directly or build table/spot payloads.
- Order presentation remains delegated to `OrderPresenter`.

## AdminAuditLogger

Centralizes writes to the `audit_logs` table for admin workflows.

Use it from admin services instead of duplicating raw `DB::table('audit_logs')->insert(...)` blocks.

## PosNotificationMessageFactory

Owns POS notification titles, messages, URLs, types, and event metadata.

Responsibilities:

- Build coffee order created/assigned/updated/payment/merge/release notification payloads.
- Build fishing session started/extended/takeaway/update/payment/merge/release notification payloads.
- Keep POS notification URL construction in one place.
- Keep resource labels, item counts, and money text out of `PosController`.

Controller boundary:

- `PosController` still triggers `Notification::send()` close to the workflow endpoint.
- The text/type/url contract should stay in this factory so endpoint methods do not rebuild notification copy inline.

## CoffeeOrderService

Owns coffee-specific workflow:

- Create counter/table orders.
- Assign a table.
- Update menu lines.
- Checkout.
- Merge into another table.
- Release table after payment.

Shared order behavior should move downward into the shared services, not upward into `PosController`.

Controller boundary:

- `PosController` may format user-facing notification messages after service calls.
- Table assignment, checkout, merge, and release rules should stay in this service or shared order services.

## FishingService

Owns fishing-specific workflow:

- Start session.
- Extend session by configured blocks or custom hour-based extension.
- Toggle fish takeaway pricing.
- Update menu lines.
- Checkout.
- Merge into another fishing spot.
- Release spot after payment.

Fishing session and extension lines are domain-specific and should stay in this service unless a dedicated fishing session service is introduced later.

Controller boundary:

- `PosController` may choose the user-facing notification title/body.
- Session duration, extension price, line creation, checkout, merge, and release rules should stay here or in shared order services.
