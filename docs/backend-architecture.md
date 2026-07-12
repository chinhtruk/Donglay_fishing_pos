# Backend Architecture

Date: 2026-07-01
Scope: Current backend structure after FormRequest, domain-service, dashboard-service, and admin menu/payment/map service extraction.

## Routes

This app defines web and API routes in `routes/web.php`.

- Public pages: `/login` and root redirect.
- Authenticated app pages: `/pos/{section?}` and `/admin/{section?}`.
- API prefix: `/api/v1`.

The API URL surface is intentionally stable during the refactor. Controllers may be split later, but existing route paths and response shapes should not change without a deliberate migration.

## Controllers

Current API controllers:

- `AuthController` - admin login; employee login by username with OTP delivered to the linked verified email; profile; logout.
- `NotificationController` - notification list/read/delete actions.
- `OrderController` - paginated order list.
- `Api/PosController` - coffee/fishing POS endpoint orchestration, checkout, merge, release, order detail, and notification side effects.
- `Api/AdminController` - admin endpoint orchestration for dashboard, menu, map, users, payment methods, void/reverse actions.

`AdminController` is now thin for dashboard, menu, payment settings/methods, and admin map endpoints. Those areas delegate to `AdminDashboardService`, `AdminMenuService`, `AdminPaymentMethodService`, and `AdminMapService`. `PosController` still orchestrates POS workflows, but POS notification text and URLs are centralized in `PosNotificationMessageFactory`. User management plus void/reverse payment actions still live directly in the admin controller and remain candidates for a later service/controller split.

## Request Validation

API validation lives under `app/Http/Requests/Api`.

POS requests:

- Coffee: create, update, assign table, merge, release, checkout.
- Fishing: start, update, extend, toggle fish takeaway, merge, release, checkout.
- Shared line validation: `Concerns/ValidatesMenuLines`.

Admin requests:

- Dashboard date range.
- Menu create/batch create.
- Map slot create/update.
- User create/update.
- Payment settings and payment method create/update.
- Adjustment reason for void/reverse actions.

Controllers should depend on `validated()` data from these requests instead of duplicating validation arrays inline.

## Domain Services

Order workflow logic is split across:

- `CoffeeOrderService`
- `FishingService`
- `OrderLineReconciler`
- `OrderTotalsCalculator`
- `OrderStatusResolver`
- `OrderPaymentService`
- `OrderNumberGenerator`
- `OrderPresenter`
- `FishingSessionExpirationNotifier`
- `PosOperationalDayCloser`
- `AdminDashboardService`
- `AdminMenuService`
- `AdminPaymentMethodService`
- `AdminMapService`
- `AdminAuditLogger`
- `PosNotificationMessageFactory`

The shared order services remove the largest duplicated paid/unpaid, payment, number generation, and total/status behavior between coffee and fishing. `PosOperationalDayCloser` records remaining balances and releases POS resources at the 23:59 boundary. `AdminDashboardService` owns dashboard report queries, the admin menu/payment/map services own admin workflow details, and `PosNotificationMessageFactory` owns notification copy/URL construction so controllers do not carry storage, map payload, payment readiness, or notification text implementation.

## Current Boundaries

- Controllers translate HTTP input/output, trigger notifications, and call services.
- FormRequest classes own request validation and friendly validation messages.
- Workflow services own transactions, optimistic `version` checks, totals, payment status, and resource release rules.
- Presenter classes own API payload formatting for orders.
- Models still contain query scopes and payload helpers where they are naturally tied to persisted state.

Avoid moving UI concerns into backend services. Services should return domain models or stable API payloads that existing frontend modules already understand.

## Refactor Guardrails

- Keep database schema unchanged unless a separate migration task explicitly requires it.
- Keep notification side effects close to existing workflow endpoints until controller split has test coverage.
- Preserve optimistic `version` checks on order updates, checkout, merge, and release.
- Use feature tests for business behavior and JS tests for frontend helper/rendering logic.
- Keep route URLs and JSON response shapes stable unless a migration task explicitly allows a contract change.
