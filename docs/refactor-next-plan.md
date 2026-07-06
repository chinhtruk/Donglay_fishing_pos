# Refactor Next Plan Baseline

Date: 2026-06-30
Author: Antigravity

## Phase 0: Baseline Verification

Trạng thái hệ thống trước khi thực hiện lượt refactor tiếp theo (dọn nợ lớn).

### 1. Git Status Snapshot
```text
 M .gitignore
 M app/Http/Controllers/Api/AdminController.php
 M app/Http/Controllers/Api/PosController.php
 M app/Services/CoffeeOrderService.php
 M app/Services/FishingService.php
 M resources/css/app.css
 M resources/js/app.js
 M resources/js/modules/modal.js
 M resources/js/tests/modules.test.js
 M resources/views/app.blade.php
 M tests/Feature/AdminDashboardTest.php
?? app/Http/Requests/
?? app/Services/AdminDashboardService.php
?? app/Services/OrderLineReconciler.php
?? app/Services/OrderNumberGenerator.php
?? app/Services/OrderPaymentService.php
?? app/Services/OrderStatusResolver.php
?? app/Services/OrderTotalsCalculator.php
?? docs/
?? resources/css/base.css
?? resources/css/components/
?? resources/css/layout/
?? resources/css/legacy-overrides.css
?? resources/css/pages/
?? resources/css/responsive/
?? resources/css/tokens.css
?? resources/js/pages/
?? resources/js/templates/
?? resources/views/app/
```

### 2. php artisan test (vendor/bin/phpunit)
- **Kết quả**: PASSED
- **Số lượng tests**: 53 tests, 351 assertions.

### 3. npm test
- **Kết quả**: PASSED (10 tests passed).
- **Chi tiết**:
  - cart tracks quantities and totals independently of the UI
  - cart can update an inline variable menu price
  - metrics render without decimal places
  - cash input formats Vietnamese thousands while preserving numeric value
  - countdown never becomes negative
  - POS menu helpers keep drink categories before food categories
  - POS billing helpers format ranges and remaining due
  - POS order modal renderer keeps unpaid and paid lines distinct
  - admin payment form renderer preserves editable QR fields
  - admin user form renderer keeps role-specific credential sections

### 4. npm run build
- **Kết quả**: PASSED (Vite build thành công).
- **Assets sinh ra**:
  - CSS: `public/build/assets/app-Oy-STMOu.css` (352.12 kB)
  - JS: `public/build/assets/app-msOGt0pd.js` (169.54 kB)

### 5. git diff --check
- **Kết quả**: Sạch (Không có lỗi khoảng trắng thừa hoặc conflict marker).
