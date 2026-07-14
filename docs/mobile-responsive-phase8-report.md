# Báo cáo Phase 8 — Hồi quy và rollout responsive điện thoại

Ngày thực hiện: 2026-07-13  
Phạm vi: responsive điện thoại 320–767px, hồi quy iPad/desktop và các luồng vận hành cốt lõi.  
Trạng thái: **local gate đã đạt; external rollout gate đang chờ staging và thiết bị thật/cloud device**.

## 1. Local quality gate

### Automated

- `composer test`: 65 tests, 479 assertions, đạt.
- `npm test`: 40 tests, đạt.
- `npm run build`: production build thành công.
- `git diff --check`: không có whitespace error.
- Dữ liệu QA chạy trên SQLite cô lập trong `/tmp`; không dùng hoặc thay đổi database phát triển hiện có.

### Viewport regression

- 56 lượt kiểm tra admin: 7 route tại `320x568`, `360x800`, `375x667`, `390x844`, `393x852`, `412x915`, `430x932` và `844x390`.
- Route admin đã kiểm: Dashboard, Orders, Menu, Map, Users, Settings và Data.
- 12 lượt so sánh POS Coffee/Fishing tại phone, landscape, iPad dọc/ngang và desktop.
- Không có document-level horizontal overflow ở các viewport bắt buộc.
- Input trên điện thoại giữ cỡ chữ tối thiểu 16px; touch target phone đạt 44px sau khi bổ sung guard cho sidebar và notification drawer ở landscape thấp.
- Bảng Menu, Orders, Users và Settings trở về table layout trên iPad/desktop; điện thoại giữ card-list.

## 2. Manual flow đã xác minh

### P0 — vận hành

- Admin login/logout và employee username + OTP.
- Coffee: mở bàn, thêm món, tăng/giảm số lượng, ghi chú, lưu đơn.
- Coffee: thanh toán một phần, giữ bàn; thanh toán phần còn lại và giải phóng bàn.
- Coffee: tạo hai đơn và gộp vào một bàn đích.
- Fishing: bắt đầu phiên, giảm 50.000đ, gia hạn 1 giờ, thanh toán toàn bộ và giải phóng chòi.
- Các bước trên được chạy qua UI thật ở khung mobile `390x568`; `scrollWidth` luôn bằng 390px.

### P1 — quản trị

- Dashboard đổi preset 7 ngày.
- Menu batch add, edit và archive một món QA.
- User add và lock một tài khoản QA.
- Payment method: xác minh validation ảnh QR khi bật, sau đó add ở trạng thái tắt và edit.
- Admin Map: add, edit và delete một bàn QA; modal edit đã kiểm ở phone, CRUD được xác minh trực tiếp trên trang.
- Data: mở confirm “Sao lưu & xóa dữ liệu” rồi hủy; không chạy thao tác phá hủy.

## 3. Thay đổi chốt trong Phase 8

- Tăng touch target cho control trong sidebar và notification drawer ở phone landscape thấp.
- Đặt `type="button"` rõ ràng cho nút thêm tài nguyên trên Admin Map để không phụ thuộc default submit behavior.
- Không thay route, API, payload, phép tính đơn hàng hay dữ liệu production.

## 4. External rollout gate — chưa thực hiện

Repository hiện không có URL staging, pipeline deploy, device-cloud project hoặc cấu hình production có thể dùng an toàn. Vì vậy các mục sau phải hoàn tất trước khi xem Phase 8 là production-complete:

- Safari iOS trên thiết bị thật hoặc cloud device: ít nhất iPhone SE-class và iPhone hiện đại.
- Chrome Android trên thiết bị thật hoặc cloud device: ít nhất Android nhỏ và Android lớn.
- Chạy lại P0 trên staging có cấu hình mail/OTP, storage và payment QR tương đương production.
- So sánh screenshot staging tại toàn bộ viewport bắt buộc.
- Theo dõi ít nhất một ca vận hành và ghi nhận console error, API 4xx/5xx, double-submit, phản hồi nhân viên.

## 5. Checklist rollout

### Trước staging

- [ ] Backup database staging và xác nhận restore được.
- [ ] Cấu hình mail/OTP, queue, scheduler, storage và QR test.
- [ ] Chạy `composer test`, `npm test`, `npm run build` trên commit triển khai.
- [ ] Ghi lại asset manifest và commit SHA để rollback.

### Staging

- [ ] Safari iOS và Chrome Android hoàn tất P0.
- [ ] Admin hoàn tất P1; riêng backup-and-clear chỉ xác minh confirm/cancel trên dữ liệu mẫu.
- [ ] Không có horizontal overflow, action bị cắt hoặc keyboard che CTA.
- [ ] Không có console error mới hoặc API 5xx.
- [ ] Admin/nhân viên vận hành ký xác nhận.

### Production

- [ ] Triển khai trong khung giờ ít khách và có người trực rollback.
- [ ] Smoke admin login, employee OTP, Coffee, Fishing và một payment test có kiểm soát.
- [ ] Theo dõi một ca: error log, response time, failed request, duplicate order/payment và phản hồi thao tác.

### Rollback ngay khi

- Có sai tiền, trùng thanh toán, mất/gộp nhầm đơn hoặc không release được bàn/chòi.
- OTP/login làm nhân viên không thể vào ca.
- CTA quan trọng bị che/cắt trên thiết bị mục tiêu.
- API 5xx tăng rõ rệt hoặc console error lặp lại trên luồng P0.

Rollback dùng release/asset manifest trước Phase 8 và restore database chỉ khi migration hoặc dữ liệu thật sự bị ảnh hưởng. Các thay đổi responsive hiện tại không thêm migration.
