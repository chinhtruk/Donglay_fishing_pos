# Kế hoạch responsive điện thoại cho Đồng lầy Fishing

Ngày lập: 2026-07-13  
Phạm vi: điện thoại từ 320px đến 767px, ưu tiên màn hình dọc; đồng thời bảo toàn desktop và iPad hiện có.  
Trạng thái: Phase 1 đến Phase 7 đã triển khai; local gate Phase 8 đã đạt, external rollout gate đang chờ staging và thiết bị thật/cloud device; chưa thay đổi nghiệp vụ, route hoặc API.

## 0. Tiến độ triển khai

| Phase | Trạng thái | Kết quả |
| --- | --- | --- |
| Phase 0 — Baseline | Hoàn tất ngày 2026-07-13 | Xác nhận shell 72px, bảng 720px và CSS legacy là các rủi ro chính; giữ nguyên dữ liệu/tài khoản local |
| Phase 1 — Foundation | Hoàn tất ngày 2026-07-13 | Mobile token, viewport safe area, workspace full-width, drawer, scrim, focus/ARIA, profile compact và hồi quy collapse desktop |
| Phase 2 — Component dùng chung | Hoàn tất ngày 2026-07-13 | Modal/form keyboard-safe, card-list opt-in, pagination 44px và notification drawer/toast mobile |
| Phase 3 — POS map Coffee/Fishing | Hoàn tất ngày 2026-07-13 | Coffee card grid, hồ câu ba cột, stat/action mobile và merge indicator; giữ polling/countdown/tọa độ |
| Phase 4 — Order modal và Checkout | Hoàn tất ngày 2026-07-13 | Tab Menu/Phiếu, modal giao dịch full-screen, checkout một cột, copy QR, partial/release guard và khóa double-submit |
| Phase 5 — Orders và receipt | Hoàn tất ngày 2026-07-13 | Employee/admin card list, filter/search phone, receipt full-screen và paid/unpaid rõ ràng |
| Phase 6 — Admin pages | Hoàn tất ngày 2026-07-13 | Dashboard, Menu, Batch, Users, Payment, Map và Data/Backup responsive phone |
| Phase 7 — Accessibility, polish, performance | Hoàn tất ngày 2026-07-13 | Focus/ARIA/contrast/reduced-motion, single-flight action, layout stability, nội dung dài, safe area, landscape thấp và zoom 200% |
| Phase 8 — Hồi quy và rollout | Local gate đạt ngày 2026-07-13; external gate đang chờ | Automated suite, phone matrix, P0/P1 UI và iPad/desktop regression đã đạt; còn Safari iOS/Chrome Android thật hoặc cloud, staging và theo dõi một ca vận hành |

Kết quả xác minh Phase 1:

- `php artisan test`: 65 tests, 479 assertions, tất cả đều qua.
- `npm test`: 31 tests, tất cả đều qua.
- `npm run build`: build production thành công.
- Browser smoke: `320x568`, `390x844`, `768x1024`, `1440x900`.
- Điện thoại không còn rail 72px; workspace rộng 100%; `scrollWidth` bằng `innerWidth` ở 320px và 390px.
- Drawer hỗ trợ nút mở/đóng, scrim, Escape, focus return, focus containment và ARIA.
- Preference `sidebar-collapsed` của desktop không làm mất nhãn khi mở drawer mobile.

Kết quả xác minh Phase 2:

- Form điện thoại về một cột; input/select/textarea dùng cỡ chữ 16px và target tối thiểu 44px.
- Modal thông thường thành full-screen ở dưới 768px; confirm vẫn là dialog giữa màn hình. Header/footer, safe area, focus trap, Escape và focus return giữ nguyên hợp đồng dùng chung.
- Keyboard guard dùng `visualViewport`, chỉ coi bàn phím mở khi phần chênh vượt 120px để tránh nhận nhầm chrome của trình duyệt; helper đã có unit test.
- Card-list là primitive opt-in qua `.is-mobile-card-list`; chưa tự động đổi bảng của từng page trước khi field order và action được duyệt ở phase tương ứng.
- Pagination điện thoại có vùng cuộn riêng và toàn bộ control đạt `44x44px`; tablet/desktop giữ bảng và kích thước hiện hành.
- Notification drawer điện thoại chiếm `100vw x 100dvh`, khóa nền, trap/return focus, đóng bằng Escape và loại trừ lẫn nhau với sidebar. Toast không tràn viewport, nút đóng 44px và nội dung dài giới hạn ba dòng.
- Browser QA đạt ở `320x568`, `390x844` và breakpoint `768x900`; không có cuộn ngang cấp trang trong fixture component.
- `npm test`: 32 tests qua; `php artisan test`: 65 tests/479 assertions qua; `npm run build` và `git diff --check` thành công.
- POS order modal và checkout được chủ động loại khỏi full-screen contract tổng quát; hai luồng giao dịch này tiếp tục được xử lý ở Phase 4.

Kết quả xác minh Phase 3:

- POS Cà phê dùng ba stat compact ở 360–430px; compact phone dùng bố cục 2+1. Nút “Tạo đơn quầy” tách thành hành động full-width 44px.
- Grid bàn dùng hai cột từ 360px và một cột ở 320–359px. Card giữ đủ tên bàn, trạng thái, mã đơn/tổng còn lại hoặc hướng dẫn mở bàn; bàn tạm nghỉ không còn hiển thị nhầm “sẵn sàng nhận khách”.
- POS Câu cá vẫn giữ ba cột logic bờ trái–hồ–bờ phải và giữ nguyên `grid-column`/`grid-row` runtime. Dải hồ được thu hẹp, decoration được ẩn trên phone nhưng thứ tự chòi hai bờ không đổi.
- Chòi phone cao tối thiểu 80px, hiển thị số chòi, trạng thái và countdown bằng chữ số tabular. Khi countdown về 0, cả class trạng thái và nhãn “Hết giờ” được đồng bộ.
- Coffee/Fishing merge mode có thông báo `aria-live`, trạng thái `aria-pressed`, vùng action sticky và reset sạch khi hủy. Mở bàn/chòi vẫn đi vào modal hiện hữu; order modal/checkout chưa bị redesign trong phase này.
- Browser QA đạt ở `320x568`, `390x844` và `768x1024`; `document.body.scrollWidth` bằng viewport ở cả ba mốc. Tablet giữ layout bốn cột Coffee và hồ ba cột hiện tại.
- `npm test`: 33 tests qua; `php artisan test`: 65 tests/479 assertions qua; `npm run build`, `git diff --check` và giới hạn năm inline style runtime đều đạt.

Kết quả xác minh Phase 4:

- Order modal phone là workspace full-screen có hai tab “Menu/Phiếu”; đơn mới mở Menu, đơn đang hoạt động mở Phiếu. Thêm món không tự chuyển tab, badge/CTA “Xem phiếu” cập nhật tại chỗ và search/category/cart state không bị dựng lại khi đổi tab.
- Menu dùng hai cột từ 360px và một cột ở 320–359px. Search, category, add, note, quantity và action đạt target 44px; category đang chọn được đưa về giữa vùng cuộn.
- Phiếu giữ riêng món chưa trả/đã trả, note và quantity chỉ sửa phần chưa trả. Footer tổng/action sticky, safe-area aware; session/discount/extend của Fishing tiếp tục dùng renderer và điều kiện nghiệp vụ hiện có.
- Checkout phone dùng một cột theo thứ tự phiếu món → phương thức → tiền mặt/QR → tiền thừa/giải phóng → tổng và xác nhận. Tiền mặt thiếu hoặc không chọn món sẽ khóa xác nhận; partial checkout khóa release và hiển thị lý do.
- QR có nút sao chép số tài khoản cùng phản hồi `aria-live`. Submit đổi sang trạng thái “Đang xử lý…”, khóa gửi lặp trong khi request chạy; xử lý 409, payload, route và version contract giữ nguyên.
- Browser QA đạt ở `320x700`, `390x700/844`, `768x1024` và desktop `1100x760`: phone full-width, order grid 1/2 cột đúng breakpoint, vùng chạm 44–52px, iPad/desktop giữ hai cột.
- `npm test`: 36 tests qua; `npm run build` thành công. Full PHP regression và diff check được chạy ở gate cuối của phase.

Kết quả xác minh Phase 5:

- Employee và admin Orders đổi sang card list ở dưới 768px; mã/trạng thái ở đầu, mô hình/vị trí/thời gian theo thứ tự đọc và admin giữ tổng tiền rõ ràng. Toàn card mở chi tiết bằng click, Enter hoặc Space.
- Search và trạng thái của employee dùng cùng API/filter/pagination hiện có; search admin và hai tầng filter mô hình/trạng thái được xếp lại cho phone. Input 16px, tab/filter và nút chi tiết đạt tối thiểu 44px.
- Receipt phone là full-screen workspace có một vùng cuộn chính, header/nút đóng cố định và safe-area aware. Món trả một phần được tách đúng số lượng sang hai khu “chưa thanh toán” và “đã thanh toán”, kèm chữ/ký hiệu nên không phụ thuộc màu.
- Receipt admin giữ tổng tiền sticky ở đáy và lịch sử thanh toán có disclosure 44px. Theo hợp đồng hiện hành, UI Orders không khôi phục thao tác đảo thanh toán/hủy đơn; route, payload, polling và nghiệp vụ backend không đổi.
- Browser QA đạt ở `320x700`, `390x844`, `768x1024` và desktop `1100x760`; không có cuộn ngang cấp trang. iPad/desktop giữ bảng và dialog hiện hành.
- `npm test`: 39 tests qua; `php artisan test`: 65 tests/479 assertions qua; `npm run build` và `git diff --check` thành công.

Kết quả xác minh Phase 6:

- Dashboard phone xếp range → KPI → chart → mô hình → danh sách vận hành đúng ưu tiên. Preset và custom date đạt 44px/16px; KPI dùng 2 cột ở 360px và một cột ở compact phone. Chart chỉ cuộn trong container riêng, tooltip tap không vượt viewport.
- Menu, Users và Payment Settings chuyển thành card list có thứ tự thông tin riêng; search/category của Menu thành hai hàng, action lưu trữ tách khỏi vùng mở editor. Từ 768px trở lên cả ba trang trở lại bảng.
- Single Menu editor, Batch Menu, User editor và Payment editor là full-screen workspace trên phone. Form một cột, QR không vượt viewport, input text 16px, footer/action tối thiểu 44px và modal body là vùng cuộn chính.
- Admin Map giữ hai tab Cà phê/Câu cá và nút thêm rõ ràng. Coffee dùng 2 cột từ 360px, 1 cột ở compact; Fishing giữ ba trục bờ trái–hồ–bờ phải, tọa độ runtime không đổi và card chòi được xếp nội dung dọc để đọc tốt ở 320px.
- Resource editor tách Xóa/Lưu thành hai action full-width; xóa dùng confirm dùng chung với mô tả trường hợp đơn active thay cho confirm native. Polling, payload tọa độ và API Map không đổi.
- Data/Backup tách backup an toàn khỏi danger zone, hai nút full-width 44px, email dài wrap và confirm nguy hiểm liệt kê rõ dữ liệu xóa/giữ. Loading/double-submit guard hiện hữu được bảo toàn.
- Browser QA đạt cho toàn bộ bảy batch ở `320x700`, `390x844`, `768x1024`, `1100x760` và Dashboard desktop `1440x900`; `scrollWidth` bằng viewport ở mọi route đã kiểm tra.
- `npm test`: 39 tests qua; `php artisan test`: 65 tests/479 assertions qua; `npm run build` và `git diff --check` thành công.

Kết quả xác minh Phase 7:

- Focus ring dùng chung hiển thị cho button/link/row/tab; navigation hiện tại có `aria-current="page"`. Profile mobile có accessible name đầy đủ thay vì chỉ đọc ký tự avatar.
- Modal dùng `aria-labelledby` trỏ đến tiêu đề thật, tiếp tục giữ focus trap/Escape/focus return. Login chuyển vai trò theo tab semantics, roving `tabindex` và Arrow Left/Right/Home/End.
- Loading/page/notification có `aria-busy`; toast lỗi dùng `role="alert"`, badge thông báo cập nhật accessible name. Trạng thái động không tạo live-region polling lặp gây nhiễu trình đọc màn hình.
- Màu amber, helper text và focus ring đạt contrast tối thiểu 4.5:1 trên nền sử dụng. Toàn hệ thống có reduced-motion contract; forced-colors giữ viền trạng thái/focus.
- `runButtonAction()` khóa tap lặp và công bố busy/disabled cho lưu User, Payment, Menu, tài nguyên Map và Data/Backup; checkout single-flight hiện hữu không đổi. Helper có unit test chặn lần gọi thứ hai.
- Ảnh món/QR có vùng kích thước ổn định, containment và `decoding="async"`; font giữ `display=swap` cùng fallback hệ thống. Polling Orders/Map/Notification và countdown Fishing bỏ network/DOM work khi tab bị ẩn.
- Browser QA đạt ở `320x568`, `390x844`, `844x390` và viewport `195x422` mô phỏng phone 390px tại zoom 200%. Nội dung tên/email dài không tràn, input 16px, target chính 44px, modal confirm nằm trong viewport và `scrollWidth` bằng viewport.
- `npm test`: 40 tests qua; full PHP regression, production build và `git diff --check` được chạy ở gate cuối Phase 7.

## 1. Mục tiêu

Xây dựng trải nghiệm điện thoại chuẩn, đẹp và dễ thao tác cho toàn bộ hệ thống Đồng lầy Fishing mà vẫn giữ nguyên bản chất hiện tại:

- Đây vẫn là ứng dụng POS kết hợp quản trị cho quán cà phê và hồ câu, không biến thành một giao diện web marketing hoặc một ứng dụng mobile khác biệt hoàn toàn.
- Giữ nguyên luồng nghiệp vụ, route, API, payload, phân quyền, cách tính tiền, vòng đời đơn, cơ chế polling và trạng thái bàn/chòi.
- Giữ ngôn ngữ thị giác hiện có: tông nâu, giấy sáng, màu hồ, bo góc, icon nét, typography Be Vietnam Pro và cách phân biệt cà phê/câu cá.
- Tối ưu cho thao tác bằng một tay, ngón tay, màn hình hẹp, bàn phím ảo, safe area và mạng không ổn định.
- Không tạo cuộn ngang ở cấp trang. Chỉ cho phép cuộn ngang trong các vùng có chủ đích như tab hoặc bảng chưa thể chuyển đổi ngay.
- Không làm giảm chất lượng desktop `1440x900`, iPad dọc `768x1024` và iPad ngang `1024x768`.

## 2. Tiêu chí thành công có thể đo được

Một màn hình chỉ được xem là hoàn tất responsive khi đạt đủ các điều kiện sau:

1. Không có phần tử làm `documentElement.scrollWidth` lớn hơn `window.innerWidth` ở các viewport kiểm thử.
2. Không có nút nghiệp vụ chính, tổng tiền, trạng thái hoặc nút đóng modal bị cắt khỏi viewport.
3. Mục tiêu chạm chính có kích thước tối thiểu `44x44px`; khoảng cách giữa hai hành động nguy hiểm hoặc đối nghịch tối thiểu 8px.
4. Input trên điện thoại có cỡ chữ render tối thiểu 16px để tránh Safari tự zoom khi focus.
5. Nội dung cốt lõi vẫn đọc được ở 320px mà không cần zoom trình duyệt.
6. Bàn phím ảo không che input đang nhập, nút xác nhận hoặc tổng tiền.
7. Modal dài có đúng một vùng cuộn chính; header và vùng hành động quan trọng luôn tiếp cận được.
8. Backdrop, nút đóng, Escape trên bàn phím ngoài và thao tác hủy vẫn giữ nguyên hợp đồng modal hiện tại.
9. Trạng thái focus, disabled, loading, lỗi và thành công vẫn rõ ràng; không chỉ dựa vào màu sắc.
10. Các luồng POS quan trọng hoàn thành được bằng một tay, không yêu cầu hover.
11. Build, test JS, test PHP và các viewport hồi quy hiện tại đều qua.
12. Không thay đổi kết quả tính tổng, thanh toán từng phần, gộp đơn, giải phóng bàn/chòi hoặc chốt ngày.

## 3. Hiện trạng đã rà soát

### 3.1 Kiến trúc liên quan

- Shell đăng nhập và shell sau đăng nhập được render bằng Blade.
- Nội dung từng trang được render bằng Vanilla JavaScript theo module và route.
- CSS được import theo cascade có chủ đích từ `resources/css/app.css`; thứ tự import là một phần hành vi.
- `resources/css/responsive/mobile.css` hiện có khoảng 180 dòng và chủ yếu xử lý shell, ẩn nhãn sidebar, xếp page header, giới hạn overflow và cho bảng cuộn ngang.
- `resources/css/responsive/ipad.css` đã được tách riêng và có phạm vi lớn hơn nhiều; không được để rule điện thoại thắng nhầm rule iPad.
- `resources/css/legacy-overrides.css` còn gần 12.000 dòng, chứa nhiều rule của POS, dashboard, form, map và modal. Đây là nguồn rủi ro cascade lớn nhất.
- Checkout và notification được import sau responsive, do đó mọi sửa mobile liên quan hai component này phải đặt trong chính file sở hữu hoặc dùng specificity có kiểm soát.

### 3.2 Vấn đề nền tảng hiện tại

1. Sidebar điện thoại luôn chiếm 72px. Trên máy rộng 390px, nội dung còn khoảng 318px trước khi trừ padding; trên máy 320px, nội dung thực tế còn quá hẹp cho POS và admin.
2. Nút hamburger tồn tại trong Blade nhưng `.mobile-only` đang bị ẩn và shell mobile vẫn dùng rail cố định, nên chưa hình thành mô hình drawer hoàn chỉnh.
3. Profile bị ẩn trên điện thoại, làm giảm khả năng nhận biết tài khoản và tiếp cận đăng xuất.
4. Bảng admin/orders đặt `min-width: 720px` rồi cuộn ngang. Cách này tránh vỡ layout nhưng đọc chậm, khó so sánh và khó bấm đúng hàng trên điện thoại.
5. Nhiều modal POS được thiết kế hai cột với vùng menu và phiếu bán hàng độc lập. Chưa có hợp đồng mobile rõ ràng cho việc chuyển giữa chọn món và xem phiếu.
6. POS Fishing giữ tọa độ chòi bằng `grid-column` và `grid-row` runtime. Responsive phải bảo toàn ý nghĩa hai bờ hồ, không được thay đổi dữ liệu vị trí.
7. Một số nút đang tối ưu theo iPad bằng chiều cao 40–42px; điện thoại cần chuẩn chạm tối thiểu 44px.
8. Nhiều toolbar dùng cuộn ngang nhưng chưa có affordance báo còn nội dung ở bên phải, chưa bảo đảm tab đang chọn tự hiện trong viewport.
9. CSS mobile hiện tại tập trung vào “không tràn” hơn là “thao tác tốt”; chưa có hệ thống card/list, bottom action, full-screen modal và keyboard-safe dùng chung.
10. Login tại `390x844` hiện không tràn ngang và card cân đối. Phần này cần giữ phong cách, chỉ bổ sung kiểm thử màn hình thấp, bàn phím và safe area.

## 4. Nguyên tắc thiết kế để giữ bản chất web

### 4.1 Những phần bắt buộc giữ nguyên

- Tên trang, thuật ngữ và thứ tự nghiệp vụ chính.
- Màu biểu thị trạng thái bàn/chòi, đơn đã trả, hết giờ, tạm nghỉ và lỗi thanh toán.
- Cấu trúc route `/pos/*`, `/admin/*` và API `/api/v1/*`.
- Page module contract `mount(context)` / `unmount()` và lifecycle cleanup.
- Dữ liệu bảng, trạng thái filter, phân trang, polling và thứ tự đơn.
- Hai khái niệm khác nhau: `paid` và “đã giải phóng vị trí”.
- Khu vực menu và phiếu bán hàng vẫn là hai phần rõ ràng của luồng gọi món.
- Sơ đồ cà phê và hồ câu vẫn là hình thức điều hướng chính của POS.

### 4.2 Những phần được phép thay đổi trên điện thoại

- Sidebar cố định chuyển thành drawer trượt từ trái.
- Bảng dữ liệu chuyển thành card list bằng CSS hoặc renderer mobile, nhưng dùng cùng dữ liệu và hành động.
- Modal desktop chuyển thành full-screen dialog/mobile sheet.
- Hai cột trong modal gọi món chuyển thành hai chế độ “Menu” và “Phiếu” trong cùng modal.
- Nút hành động chính có thể sticky ở đáy nếu vẫn giữ đúng thứ tự và điều kiện enable/disable.
- Thông tin phụ có thể thu gọn bằng disclosure, nhưng tổng tiền, trạng thái và hành động chính không được giấu.
- Trang dashboard có thể xếp lại thứ tự card để ưu tiên số liệu quan trọng.

## 5. Hệ breakpoint đề xuất

Không tạo CSS riêng theo tên thiết bị. Breakpoint dựa vào không gian và khả năng thao tác:

| Nhóm | Điều kiện | Mục đích |
| --- | --- | --- |
| Compact phone | `max-width: 359px` | Máy 320–359px, giảm padding/gap, một số grid từ 2 cột xuống 1 cột |
| Standard phone | `360px–430px` | Mốc thiết kế chính, ưu tiên `390x844` |
| Large phone | `431px–767px` | Tận dụng thêm chiều ngang nhưng vẫn dùng mobile navigation/modal |
| Short landscape | `max-width: 767px` và `max-height: 500px` | Giảm chrome, giữ action và input không bị bàn phím/chiều cao thấp che |
| Touch-specific | `(hover: none) and (pointer: coarse)` | Loại bỏ phụ thuộc hover, tăng target chạm |
| Reduced motion | `prefers-reduced-motion: reduce` | Tắt animation drawer/sheet không cần thiết |
| iPad trở lên | `min-width: 768px` | Giữ nguyên hợp đồng responsive iPad hiện tại |

Quy tắc implementation:

- Breakpoint chính vẫn là `767px` để phù hợp kiến trúc hiện tại.
- Chỉ thêm breakpoint nhỏ `359px` và breakpoint theo chiều cao khi có lỗi thật.
- Dùng `clamp()`, `min()`, `max()`, `minmax(0, 1fr)` trước khi thêm breakpoint mới.
- Không dùng user-agent hoặc class theo iPhone/Android.
- Ưu tiên `100dvh`, có fallback `100vh` khi cần.

## 6. Mobile foundation dùng chung

### 6.1 Token responsive

Bổ sung token vào `resources/css/tokens.css`:

- `--mobile-page-x: 16px`; compact phone dùng 12px.
- `--mobile-page-y: 20px`.
- `--mobile-topbar-height: 60px`.
- `--mobile-touch-target: 44px`.
- `--mobile-sticky-bottom-gap: max(12px, env(safe-area-inset-bottom))`.
- `--mobile-dialog-radius: 18px` cho sheet; full-screen tại 320–430px có thể bỏ bo góc ngoài.
- `--mobile-section-gap: 16px`.
- `--mobile-card-padding: 14px`.

Không thay token màu desktop. Chỉ tạo token kích thước để giảm rule rải rác.

### 6.2 Shell và navigation

Mục tiêu: trả lại toàn bộ chiều rộng cho workspace mà vẫn giữ sidebar làm hệ điều hướng chính.

Thực hiện:

1. Ở dưới 768px, `.app-shell` chỉ còn một cột `minmax(0, 1fr)`.
2. `.workspace` về `grid-column: 1` và rộng 100%.
3. `.sidebar` chuyển thành drawer fixed, rộng `min(286px, 86vw)`, mặc định `transform: translateX(-105%)`.
4. `body.sidebar-open .sidebar` đưa drawer vào viewport; bật `.sidebar-scrim` và khóa body scroll.
5. Hiển thị lại nhãn menu, tên thương hiệu và thông tin tài khoản trong drawer để không mất ngữ cảnh.
6. Ẩn nút collapse desktop trong drawer mobile; không ghi đè preference collapsed của desktop.
7. Hiển thị `#menu-toggle`, đặt target 44px và cập nhật `aria-expanded` trong `resources/js/shell/sidebar.js`.
8. Drawer đóng sau khi chọn route, chạm scrim, nhấn Escape hoặc viewport chuyển lên 768px.
9. Focus chuyển vào drawer khi mở và trả về nút menu khi đóng; tối thiểu phải giữ focus không rơi vào nền.
10. Topbar cao khoảng 60px cộng safe area top, sticky, không che nội dung khi anchor/focus.
11. Đồng hồ hiển thị gọn; notification và avatar nhỏ vẫn truy cập được.
12. Đưa thao tác profile/đăng xuất vào cuối drawer; không chỉ ẩn `.profile` như hiện tại.

Tiêu chí nghiệm thu:

- Workspace rộng đủ 320px, không còn rail 72px.
- Admin có thể tiếp cận đủ 7 mục mà không nhầm icon.
- Nhân viên tiếp cận được Cà phê, Câu cá và Đơn hàng trong tối đa hai thao tác.
- Drawer có trạng thái active giống desktop.

### 6.3 Page header và toolbar

- Eyebrow, tiêu đề và mô tả nằm trên cùng; hành động chính nằm dưới hoặc bên phải tùy bề rộng.
- Tiêu đề dùng `clamp(24px, 7vw, 30px)`, không ép `white-space: nowrap`.
- Một nút chính duy nhất được phép full-width. Nút phụ xếp hàng hoặc đưa vào menu overflow khi thật sự cần.
- `.head-actions` không cuộn ngang nếu chỉ có 1–2 nút; chỉ tab/filter chip mới được cuộn ngang.
- Tab có padding chạm đủ 44px, active rõ, scrollbar ẩn nhưng có gradient/fade báo còn nội dung.
- Khi chọn filter, gọi `scrollIntoView({ inline: 'center', block: 'nearest' })` nếu tab bị khuất.
- Thanh search full-width, đặt trên tab hoặc dưới tab theo tần suất sử dụng; không giữ chiều rộng 280px cứng.

### 6.4 Bảng và danh sách dữ liệu

Chiến lược hai tầng:

1. Không đổi markup/renderer nếu bảng đã có `data-label` đầy đủ: dùng CSS chuyển `tbody` thành card list, ẩn `thead`, mỗi `tr` là một card.
2. Chỉ thêm renderer mobile khi cấu trúc bảng quá phức tạp hoặc cần thay thứ tự thông tin; renderer phải dùng cùng source data và handler.

Chuẩn card list:

- Dòng đầu: khóa nhận diện chính như mã đơn/tên món/tên user.
- Dòng thứ hai: trạng thái và giá/tổng tiền.
- Metadata còn lại dùng lưới hai cột label/value.
- Toàn card là target chạm khi hành động chính là mở chi tiết.
- Nút xóa/nguy hiểm có vùng riêng, không để click bubble mở editor.
- Không ẩn dữ liệu nghiệp vụ; chỉ thay thứ tự hiển thị.
- Paginator nằm ngoài vùng card scroll, đủ target 44px và không bị cắt.

Chỉ giữ cuộn ngang như phương án dự phòng tạm thời trong phase đầu. Mục tiêu cuối không còn bảng chính nào bắt người dùng kéo ngang để đọc một hàng.

### 6.5 Modal, sheet và bàn phím ảo

Tạo hợp đồng mobile chung cho `#modal-root`:

- Modal thông thường dưới 768px rộng 100vw, cao `100dvh`, max-height `100dvh`, bo góc 0 trên compact/standard phone.
- Modal confirm ngắn vẫn là dialog ở giữa, rộng `calc(100vw - 24px)`; không cần full-screen.
- Header sticky top, target đóng 44px, tiêu đề cho phép hai dòng.
- Footer sticky bottom, padding gồm `env(safe-area-inset-bottom)`.
- Body có đúng một vùng cuộn; tránh body scroll lồng nhiều cấp.
- Khi keyboard mở, dùng cơ chế `--modal-keyboard-offset` hiện có, cuộn input vào vùng nhìn thấy và giữ nút hành động tiếp cận được.
- Nút chính đặt cuối theo thứ tự đọc; ở màn hình rất hẹp, action xếp dọc với nút chính ở vị trí dễ bấm.
- Không dùng `:has()` làm điều kiện duy nhất cho hành vi cốt lõi nếu cần hỗ trợ trình duyệt cũ; thêm class owner trên modal/backdrop khi cần.

### 6.6 Form

- `.form-grid` về một cột dưới 768px.
- Label luôn nằm trên input; helper/error nằm ngay dưới control.
- Input, select, textarea tối thiểu 44px; font-size 16px trên mobile.
- Trường tiền dùng `inputmode="numeric"`; OTP dùng `one-time-code` như hiện tại.
- Checkbox/switch cho phép bấm toàn label, không chỉ input nhỏ.
- Trường upload ảnh có preview kích thước vừa viewport, nút thay/xóa tách rõ.
- Footer form sticky chỉ dùng khi form dài; không dùng nếu gây che nội dung.
- Khi submit lỗi, focus/scroll tới lỗi đầu tiên và giữ dữ liệu đã nhập.

### 6.7 Thông báo, toast và trạng thái hệ thống

- Notification drawer mobile rộng 100vw, cao 100dvh, không chừa khoảng chết.
- Filter chip cuộn trong một vùng riêng; danh sách notification là vùng cuộn chính.
- Nút đọc tất cả/xóa tất cả không bị đẩy khỏi màn hình; hành động xóa phải giữ confirm.
- Toast rộng `calc(100vw - 24px)`, nằm dưới top safe area, tối đa 2–3 toast hiển thị đồng thời.
- Nội dung toast dài tối đa 3 dòng trước khi ellipsis; hành động cần thiết vẫn thấy.
- Trạng thái offline/API lỗi cần thông báo rõ và không che nút POS.

## 7. Kế hoạch chi tiết theo màn hình

### 7.1 Đăng nhập

Giữ nguyên card và background hiện tại vì baseline `390x844` đã cân đối.

Việc cần làm:

- Kiểm tra `320x568`, `360x640` và landscape thấp; card chuyển từ căn giữa sang căn đầu trang khi chiều cao không đủ.
- Padding top/bottom bao gồm safe area.
- Khi keyboard mở, không giữ vertical centering khiến input bị đẩy khỏi viewport.
- Tab Nhân viên/Quản trị viên đạt 44px, text không xuống dòng ở 320px.
- OTP sáu số dễ đọc, paste/autofill hoạt động, nút gửi lại không quá sát footer.
- Nút hiện/ẩn mật khẩu đạt 44px và không che text input.
- Message lỗi dùng `aria-live`, không làm card nhảy layout quá mạnh.

### 7.2 POS Cà phê

Mục tiêu: nhìn nhanh trạng thái bàn, mở bàn hoặc tạo đơn quầy trong ít thao tác.

- Header rút gọn; nút “Tạo đơn quầy” là hành động chính, có thể sticky dưới topbar khi scroll dài.
- Ba stat card chuyển thành lưới 3 cột compact nếu đủ rộng; ở 320px dùng horizontal snap hoặc 2+1 có chủ đích, không nén text khó đọc.
- Grid bàn dùng 2 cột từ 360px trở lên, 1 cột ở 320–359px nếu card không đạt target chạm.
- Card bàn hiển thị theo thứ tự: tên bàn, trạng thái, mã đơn/tổng hoặc gợi ý mở bàn.
- Toàn card bấm được; trạng thái disabled thật sự disabled và có mô tả.
- Merge mode giữ indicator rõ, thanh xác nhận sticky và có nút hủy.
- Không dùng hover để truyền tải trạng thái.
- Khi polling cập nhật, không làm card đang focus/đang chọn nhảy vị trí ngoài ý muốn.

### 7.3 POS Câu cá

Mục tiêu: giữ “bản đồ hồ câu” thay vì biến thành danh sách vô danh.

- Giữ ba cột logic hiện tại: bờ trái, dải hồ, bờ phải; JS vẫn xuất `grid-column` và `grid-row` như hiện tại.
- Trên mobile, thu dải hồ thành một trục thị giác hẹp, giảm/bỏ cá và flora trang trí nếu ảnh hưởng đọc.
- Hai cột chòi đủ rộng để hiển thị số chòi, trạng thái và thời gian còn lại; không ép toàn câu vào một dòng.
- Chiều cao mỗi row tối thiểu 64px; scroll dọc tự nhiên qua toàn hồ.
- Header và action merge nằm ngoài map scroll, không phủ chòi đầu tiên.
- Legend trạng thái có thể là hàng chip cuộn ngang.
- Countdown cập nhật text mà không đổi chiều rộng card liên tục; dùng chữ số tabular nếu phù hợp.
- Chòi hết giờ/đã trả/disabled có icon hoặc text bổ trợ, không chỉ màu.
- Màn hình 320px được phép giảm decorative lake nhưng không đổi vị trí trái/phải của chòi.

### 7.4 Modal gọi món POS

Đây là phần có rủi ro cao nhất và phải triển khai sau foundation/modal contract.

Mô hình mobile đề xuất:

- Modal full-screen với segmented control “Menu” và “Phiếu” ngay dưới header.
- Mở modal mặc định ở “Menu” khi đơn trống; mở ở “Phiếu” khi người dùng vào một đơn đã có nội dung cần xử lý.
- Badge trên tab Phiếu hiển thị số dòng hoặc số lượng món chưa trả.
- Chọn sản phẩm không tự chuyển tab; hiển thị feedback ngắn và cập nhật badge.
- Có nút “Xem phiếu” sticky khi đã có món, tránh buộc người dùng kéo lên.
- State menu/filter/search/cart tồn tại nguyên khi chuyển tab.

Tab Menu:

- Search sticky dưới segmented control.
- Category chip cuộn ngang; active tự cuộn vào giữa.
- Product grid 2 cột từ 360px, 1 cột ở 320px nếu ảnh/tên/giá không còn rõ.
- Card có ảnh tỉ lệ ổn định, tên tối đa 2 dòng, giá và nút thêm luôn thấy.
- Item giá nhập tay mở sheet nhỏ hoặc inline input không bị keyboard che.

Tab Phiếu:

- Header đơn và resource selector ở đầu.
- Dòng chưa trả ưu tiên trước, dòng đã trả tách section rõ như hiện tại.
- Quantity control có ba target trừ/số/cộng đủ lớn.
- Note input không làm footer nhảy; focus phải cuộn đúng dòng vào view.
- Footer tổng tiền và action sticky dưới cùng.
- Trạng thái “Lưu thay đổi”, “Thanh toán”, “Giải phóng” giữ đúng điều kiện enable hiện tại.
- Với phiên câu, card phiên, giảm giá và gia hạn nằm trước món; mức giảm bị khóa vẫn phải giải thích vì sao.

Tiêu chí nghiệp vụ:

- Chuyển tab không mount lại page hoặc mất cart.
- Đóng rồi mở lại tuân theo dữ liệu server/current order như hiện tại.
- Dòng đã thanh toán không thể giảm/xóa.
- Version conflict 409 vẫn hiển thị và phục hồi hợp lý.

### 7.5 Checkout

- Full-screen trên điện thoại; một flow dọc duy nhất.
- Thứ tự: món chọn thanh toán → phương thức → QR/tiền khách đưa → tiền thừa → release checkbox → tổng và nút xác nhận.
- Có summary thu gọn sticky để luôn thấy số tiền cần trả.
- Dòng chọn thanh toán có checkbox 44px, tên món co giãn, số tiền không bị cắt.
- Quick cash button tối thiểu 44px, lưới 2 hoặc 3 cột theo bề rộng.
- QR dùng `min(252px, 70vw, 34dvh)` hoặc tương đương để vừa cả chiều ngang lẫn chiều cao.
- Thông tin ngân hàng có nút copy rõ, feedback sau copy, text số tài khoản không bị xuống dòng khó hiểu.
- Cash input font lớn, format nghìn không làm caret nhảy bất thường.
- Release checkbox toàn label bấm được; disabled state có lý do.
- Nút thanh toán sticky, chống double submit và thể hiện loading.
- Kiểm tra bàn phím số, QR, thanh toán một phần, toàn phần và lỗi mạng.

### 7.6 Danh sách đơn nhân viên

- Chuyển bảng 5 cột thành card list; không bắt kéo ngang.
- Mã đơn + trạng thái ở hàng đầu; mô hình/vị trí/thời gian ở metadata.
- Toàn card mở chi tiết; focus-visible và Enter/Space vẫn hoạt động.
- Filter trạng thái và search full-width, giữ polling và thứ tự hiện tại.
- Detail modal full-screen, header và footer cố định, dòng món là vùng cuộn.
- Phân biệt đã trả/chưa trả bằng section, icon/text và màu.

### 7.7 Đơn hàng admin

- Card list tương tự nhân viên nhưng thêm tổng tiền.
- Filter mô hình, trạng thái và search chia thành 2 hàng thay vì một toolbar dài.
- Nút void/reverse chỉ xuất hiện trong detail đúng điều kiện; không đặt sát nút đóng.
- Modal lịch sử payment dùng section collapse nếu dài nhưng mặc định mở phần gần nhất.
- Form nhập lý do reverse/void có input 16px, nút nguy hiểm rõ và confirm giữ nguyên.

### 7.8 Dashboard admin

Thứ tự mobile đề xuất:

1. Range filter.
2. KPI doanh thu thực thu.
3. Số đơn, giá trị trung bình, còn phải thu.
4. Chart doanh thu.
5. So sánh cà phê/câu cá.
6. Món bán chạy, giờ cao điểm, thu ngân, tình trạng chòi.

Chi tiết:

- Range badge cuộn ngang hoặc wrap tối đa hai hàng; custom date xếp dọc.
- KPI dùng 2 cột, card quan trọng có thể full-width.
- SVG chart giữ viewBox, container cuộn ngang chỉ khi số ngày quá nhiều; ưu tiên giảm label thay vì bóp chart.
- Tooltip kích hoạt bằng tap, đóng khi tap ngoài và không tràn cạnh màn hình.
- Danh sách top item/cashier dùng row compact, không tạo bảng ngang.
- Bar percentage runtime vẫn dùng inline width được ghi nhận; chỉ sửa container responsive.
- Skeleton/loading có chiều cao ổn định để tránh layout shift lớn.

### 7.9 Quản lý Menu

- Search full-width, category chip ở hàng kế tiếp, nút thêm món ở vị trí rõ.
- Bảng món chuyển card: ảnh 72–88px, tên/nhóm/giá/trạng thái; nút xóa tách khỏi vùng mở editor.
- Pagination tự nhiên theo document trên mobile, đúng hợp đồng hiện tại.
- Single-item editor một cột; preview ảnh phía trên fields.
- Toggle giá cố định/khoảng giá có label rõ, trường ẩn không giữ focus.
- Batch-create modal full-screen.
- Batch row mobile giữ image 82px theo CSS hiện có, fields xếp dọc, remove là hàng riêng.
- Nút thêm dòng và footer save sticky nhưng không che row cuối.
- Với 20 dòng, chỉ modal body cuộn; focus lỗi đầu tiên và giữ dữ liệu các dòng khác.

### 7.10 Quản lý Sơ đồ

- Tab Cà phê/Câu cá đủ 44px và sticky dưới header nếu trang dài.
- Preview map giữ cùng mô hình visual với POS nhưng card chỉnh sửa có affordance riêng.
- Add/edit resource mở full-screen form hoặc sheet; không overlay quá nhỏ.
- Trường tọa độ/vị trí nếu không dành cho người dùng trực tiếp thì không đưa thành thao tác drag chính trên mobile.
- Delete tách khỏi Save, yêu cầu confirm và mô tả trường hợp không thể xóa do đơn active.
- Polling không đóng modal đang chỉnh sửa hoặc ghi đè form chưa lưu.

### 7.11 Quản lý User

- Bảng chuyển card: tên + trạng thái; username/email; role.
- Toàn card mở editor; trạng thái khóa có text rõ.
- Form user một cột, chia section “Danh tính”, “Đăng nhập”, “Phân quyền”.
- Password chỉ hiển thị theo role/flow hiện tại; email verification và active switch có mô tả.
- Nút lưu sticky khi form dài; không vô tình submit khi bấm switch.

### 7.12 Quản lý thanh toán

- Bảng phương thức chuyển card: icon + tên + code, trạng thái, thông tin tài khoản.
- Card có trạng thái “Đang bật”, “Đang tắt”, “Thiếu QR” nổi bật.
- Form QR một cột; preview không vượt viewport.
- Số tài khoản, chủ tài khoản, nội dung chuyển khoản không bị cắt.
- Toggle bật/tắt có label toàn vùng chạm.
- Validate đủ thông tin trước khi bật phương thức, giữ message gần field.

### 7.13 Dữ liệu và sao lưu

- Giữ panel full-width nhưng xếp từng khối theo chiều dọc.
- Tách rõ khu vực backup bình thường và danger zone bằng khoảng cách, border và nền.
- Nút backup full-width; nút backup-and-clear đặt riêng, không sát thao tác an toàn.
- Text cảnh báo không dùng cỡ chữ quá nhỏ.
- Confirm nguy hiểm hiển thị danh sách dữ liệu xóa/giữ ở dạng đọc dễ trên mobile.
- Loading dài không cho double submit; trạng thái gửi email và kết quả rõ ràng.

## 8. Lộ trình triển khai theo phase

### Phase 0 — Baseline và test harness (1–2 ngày)

Việc làm:

- Chụp baseline desktop, iPad dọc/ngang và mobile cho tất cả route.
- Chuẩn bị data fixture gồm bàn/chòi trống, đang phục vụ, đã trả, hết giờ, disabled; đơn partial/full; menu có tên dài; user/payment đủ biến thể.
- Ghi lại overflow, vùng cuộn, console error và thời gian hoàn thành các flow chính.
- Tạo checklist screenshot theo route + viewport.
- Chốt browser support: Safari iOS phiên bản mục tiêu và Chrome Android phiên bản mục tiêu.

Gate:

- Có baseline đủ màn hình protected bằng tài khoản test không dùng dữ liệu production.
- Có cách phục hồi database fixture.
- Không bắt đầu dọn cascade lớn khi chưa có ảnh so sánh.

### Phase 1 — Token, shell, navigation, safe area (1–2 ngày)

Files chính:

- `resources/css/tokens.css`
- `resources/css/layout/shell.css`
- `resources/css/responsive/mobile.css`
- `resources/js/shell/sidebar.js`
- `resources/views/app/partials/sidebar.blade.php`
- `resources/views/app/partials/topbar.blade.php`

Kết quả:

- Workspace full-width.
- Drawer mobile hoàn chỉnh.
- Profile/đăng xuất và notification truy cập được.
- Page header và spacing chuẩn hóa.

Gate: login + tất cả route load được ở 320/390/430px, không tràn cấp trang.

### Phase 2 — Component dùng chung (2–3 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

Files chính:

- `resources/css/base.css`
- `resources/css/components/modal-shell.css`
- `resources/css/components/table.css`
- `resources/css/components/pagination.css`
- `resources/css/components/notifications.css`
- `resources/js/modules/keyboard.js`
- `resources/js/modules/modal.js` nếu cần class/ARIA, không đổi hợp đồng promise.

Kết quả:

- Touch target, form, card-list table, full-screen modal, notification và pagination có contract chung.

Gate: confirm regression đầy đủ; keyboard test trên input dài; không có nested scroll ngoài thiết kế.

Gate đã đạt:

- Confirm resolve đúng một lần và các đường cancel/backdrop/close/Escape vẫn hoạt động.
- Generic modal có một vùng body scroll; header/footer cố định trong dialog và bù bàn phím bằng `visualViewport`.
- Focus trap/return đã được browser QA cho modal và notification drawer.
- Card-list, paginator, toast và drawer đã được đo ở 320/390px; breakpoint 768px giữ nguyên table/dialog desktop.

### Phase 3 — POS map Coffee/Fishing (2–3 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

Files chính:

- `resources/css/pages/pos.css`
- Các block POS liên quan trong `resources/css/legacy-overrides.css`, di chuyển theo nhóm nhỏ nếu đủ screenshot.
- `resources/js/pages/pos/coffee.js`
- `resources/js/pages/pos/fishing.js`

Kết quả:

- Hai map dùng tốt trên 320–430px.
- Preserve trạng thái, polling, merge mode và tọa độ chòi.

Gate: mở bàn/chòi, merge chọn/hủy, countdown và route switching hoạt động.

Gate đã đạt:

- Card bàn trống mở đúng order modal hiện hành; chòi trống mở đúng confirm bắt đầu phiên.
- Coffee và Fishing chọn/hủy merge không làm mất trạng thái card, confirm chỉ bật khi đủ nguồn hợp lệ và số lượng chọn được phản ánh ngay.
- Countdown chạy qua lifecycle hiện có, hết giờ cập nhật cả text lẫn state; chuyển Coffee/Fishing unmount interval trước khi mount page mới.
- Tọa độ inline của chòi trái/phải không bị thay đổi; CSS phone chỉ thu kích thước ba cột và không biến hồ thành danh sách vô danh.

### Phase 4 — Order modal và Checkout (3–4 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

Files chính:

- `resources/css/pages/pos.css`
- `resources/css/pages/pos-orders.css`
- `resources/css/pages/pos-orders-overrides.css`
- `resources/css/components/checkout-modal.css`
- `resources/js/pages/pos/order-modal.js`
- `resources/js/pages/pos/checkout.js`
- `resources/js/pages/pos/coffee.js`
- `resources/js/pages/pos/fishing.js`

Kết quả:

- Menu/Phiếu chuyển tab trên mobile.
- Checkout một cột, keyboard-safe, action sticky.

Gate: toàn bộ flow gọi món, note, variable price, partial/full checkout, cash/QR, add-after-paid và release qua trên phone + desktop/iPad hồi quy.

Gate đã đạt:

- Luồng gọi món giữ cart/search/category khi chuyển Menu/Phiếu; helper variable-price và add-after-paid hiện có tiếp tục đi qua cart/order action contract, không đổi payload.
- Note và quantity có control 44px; paid lines không sinh control chỉnh sửa.
- Cash/QR, partial/full selection, tiền thừa, copy tài khoản, release guard và trạng thái đang submit đã được kiểm tra trên phone fixture dùng module thật.
- iPad order/checkout vẫn là hai cột ở 768px; desktop checkout vẫn là payment + receipt dock, không nhận rule phone.

### Phase 5 — Orders và receipt (1–2 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

Files chính:

- `resources/css/pages/pos-orders.css`
- `resources/css/components/receipt.css`
- `resources/js/pages/orders/list.js`

Kết quả:

- Employee/admin orders thành card list mobile.
- Detail receipt full-screen, phân biệt paid/unpaid rõ.

Gate: filter/search/pagination/polling/order-detail/reverse/void qua.

Gate đã đạt:

- Filter/search dùng state và endpoint Orders hiện có; đổi filter reset về trang 1, polling signature được làm mới và pagination giữ nguyên handler. Polling/version/order sort không bị thay đổi.
- Employee/admin card không còn cần kéo ngang ở phone; keyboard activation và focus-visible được giữ. Từ 768px trở lên renderer tiếp tục là bảng.
- Detail dùng cùng API `/api/v1/orders/{id}`; quantity trả một phần được tách ở renderer mà không sửa dữ liệu hay phép tính backend.
- Lịch sử thanh toán admin có thể thu gọn; tổng và phần còn lại luôn đọc được. Các adjustment action tiếp tục bị ẩn theo regression contract hiện tại, nên đóng receipt không thể vô tình tạo void/reverse.

### Phase 6 — Admin pages (3–5 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

Thứ tự:

1. Dashboard.
2. Menu list + single editor.
3. Batch menu.
4. Users.
5. Payment settings.
6. Admin Map.
7. Data/backup.

Mỗi page là một batch độc lập, build + screenshot trước khi sang page tiếp theo.

Gate: toàn bộ Admin checklist hiện tại chạy được ở 390px và không hồi quy iPad/desktop.

Gate đã đạt:

- Dashboard, Menu list/editor/batch, Users, Payment Settings, Admin Map và Data/Backup hoàn thành flow đọc/mở form/filter/tab/confirm ở 390px mà không có cuộn ngang cấp trang.
- Compact phone 320px giữ nội dung cốt lõi, target chạm và sơ đồ hai bờ; tên món, email, tài khoản và trạng thái dài đều wrap trong card.
- iPad 768px và desktop giữ table/grid/dialog hiện hành; Dashboard 1440px giữ bốn KPI và hai cột business/bottom panels.
- API, payload, polling, pagination, inline tọa độ Map và năm dynamic style exception không thay đổi.

### Phase 7 — Accessibility, polish, performance (1–2 ngày)

Trạng thái: Hoàn tất ngày 2026-07-13.

- Rà focus order, accessible name, aria-expanded/pressed/live.
- Kiểm contrast trạng thái.
- Kiểm reduced motion.
- Kiểm tap delay/double submit.
- Giảm layout shift do image/skeleton/polling.
- Kiểm font load fallback và tên món/user rất dài.
- Kiểm safe area, landscape thấp, zoom 200% và text size tăng.

Gate đã đạt:

- Focus, accessible name, current/expanded/pressed/busy/live state đã được rà ở shell, login, modal, notification và các card/action chính.
- Contrast token, reduced-motion, forced-colors và touch target được gom thành contract cuối cascade thay vì vá riêng từng màn hình.
- Action quản trị có single-flight guard dùng chung; polling nền dừng làm việc khi document bị ẩn. Route, API, payload, phép tính và chu kỳ polling khi tab hiển thị không đổi.
- QA nội dung dài, compact phone, standard phone, landscape thấp và zoom 200% không phát sinh cuộn ngang hoặc action bị cắt.

### Phase 8 — Hồi quy và rollout (1–2 ngày)

- Chạy full automated suite.
- Chạy full manual flow trên Safari iOS và Chrome Android thật hoặc cloud device.
- So sánh desktop/iPad baseline.
- Rollout theo môi trường staging trước production.
- Theo dõi console/API error và phản hồi nhân viên trong ít nhất một ca vận hành.

Kết quả local gate ngày 2026-07-13:

- `composer test`: 65 tests, 479 assertions; `npm test`: 40 tests; production build và `git diff --check` đều đạt.
- 56 lượt kiểm tra trên 7 admin route ở toàn bộ 8 phone viewport bắt buộc không phát sinh horizontal overflow, input nhỏ hơn 16px hoặc touch target phone nhỏ hơn 44px.
- Coffee/Fishing đã so sánh tại phone, landscape, iPad dọc/ngang và desktop.
- P0 đã chạy qua UI mobile: OTP, tạo/sửa đơn, ghi chú/số lượng, partial/full payment, release, fishing start/discount/extend/checkout và merge Coffee.
- P1 đã chạy qua UI: dashboard, menu, user, payment setting, map CRUD và confirm/cancel backup-and-clear.
- Báo cáo và checklist rollout: `docs/mobile-responsive-phase8-report.md`.
- Chưa đánh dấu production-complete vì repository không có staging/device-cloud target; Safari iOS, Chrome Android và theo dõi một ca vận hành vẫn là external gate bắt buộc.

Ước lượng tổng: 14–23 ngày công tùy mức độ tách CSS legacy và số vòng sửa visual. Không nên gộp Phase 3–6 thành một pull request lớn.

## 9. Ma trận kiểm thử viewport

### 9.1 Viewport bắt buộc

| Viewport | Đại diện | Mục đích |
| --- | --- | --- |
| `320x568` | điện thoại compact | giới hạn nhỏ nhất |
| `360x800` | Android nhỏ | baseline Android |
| `375x667` | iPhone cũ/chiều cao thấp | kiểm tra footer và modal |
| `390x844` | iPhone chuẩn hiện đại | viewport chính của dự án |
| `393x852` | Android/iPhone phổ biến | kiểm tra sai số nhỏ quanh baseline |
| `412x915` | Android lớn | tận dụng large phone |
| `430x932` | iPhone lớn | giới hạn phone lớn |
| `844x390` | landscape phone | kiểm tra chiều cao thấp |
| `768x1024` | iPad dọc | hồi quy bắt buộc |
| `1024x768` | iPad ngang | hồi quy bắt buộc |
| `1440x900` | desktop | hồi quy bắt buộc |

### 9.2 Nội dung biên phải kiểm thử

- Tên món 60–100 ký tự.
- Tên user/email dài.
- Số tiền hàng trăm triệu.
- 20 bàn, 20 chòi, 20 dòng batch menu.
- Đơn có nhiều dòng paid/unpaid và nhiều payment.
- Notification dài.
- Filter không có kết quả, empty state, loading và API error.
- Keyboard mở ở input đầu trang, giữa modal và gần footer.
- Safe area có notch/home indicator.
- Text size hệ điều hành tăng.

## 10. Kịch bản kiểm thử nghiệp vụ ưu tiên

### P0 — Không được lỗi

- Admin login, employee OTP và logout.
- Tạo đơn cà phê tại bàn/quầy.
- Thêm món, sửa số lượng, ghi chú, món giá nhập tay.
- Bắt đầu/gia hạn/giảm giá phiên câu.
- Thanh toán một phần và toàn phần bằng cash/QR.
- Gọi thêm món sau khi đã thanh toán nhưng chưa release.
- Release bàn/chòi.
- Merge coffee/fishing.
- Xem danh sách và chi tiết đơn.
- Không double submit khi tap nhanh.

### P1 — Quản trị cốt lõi

- Dashboard đổi range.
- Menu filter/search/add/edit/archive/batch.
- User add/edit/lock.
- Payment method add/edit/toggle/QR.
- Admin map add/edit/delete.
- Backup và backup-and-clear confirm.

### P2 — Chất lượng trải nghiệm

- Drawer/focus/scroll restoration.
- Notification filter/pagination/detail.
- Offline/error/retry.
- Reduced motion, landscape và keyboard.
- Back/forward browser không để polling/listener trùng.

## 11. Kiểm thử tự động và visual regression

Giữ các lệnh bắt buộc hiện tại:

```bash
php artisan test
npm test
npm run build
git diff --check
```

Bổ sung theo lộ trình:

- Test JS cho state chuyển Menu/Phiếu trong order modal.
- Test helper xác định mobile presentation nếu có, tránh test trực tiếp `window.innerWidth` rải rác.
- Test sidebar aria-expanded, close-on-route và resize cleanup.
- Test renderer/card list giữ đủ data và action.
- Screenshot route ở viewport chuẩn với fixture ổn định.
- Assertion tự động `scrollWidth <= innerWidth` cho page root và modal root.
- Assertion không có console error khi mount/unmount và chuyển route.
- Không snapshot toàn HTML lớn; ưu tiên component và trạng thái quan trọng.

## 12. Chiến lược CSS và kiểm soát cascade

1. Không thêm toàn bộ responsive mới vào cuối một file khổng lồ.
2. Rule của component/page nằm trong file owner tương ứng; `responsive/mobile.css` chỉ giữ shell và primitive thật sự dùng chung.
3. Checkout mobile nằm trong `components/checkout-modal.css` vì file này import sau responsive.
4. Notification mobile nằm trong `components/notifications.css` vì lý do tương tự.
5. Khi gặp rule legacy thắng, xác định owner rồi di chuyển theo nhóm nhỏ; không tăng specificity bằng chuỗi selector dài nếu có thể thêm class owner.
6. Không dùng `!important` mới trừ khi đang bắc cầu qua legacy và có comment + kế hoạch gỡ.
7. Không thay thứ tự import trong cùng batch với redesign responsive.
8. Mỗi lần di chuyển CSS phải so desktop/iPad/mobile trước khi di chuyển nhóm tiếp theo.
9. Giữ năm inline style runtime đã được ghi nhận; responsive không biến dữ liệu runtime thành class giả.
10. Bổ sung comment cho breakpoint theo “lý do layout”, không theo tên thiết bị.

## 13. Bản đồ file thay đổi dự kiến

| File/nhóm file | Vai trò thay đổi |
| --- | --- |
| `resources/css/tokens.css` | token spacing, touch target, safe area |
| `resources/css/base.css` | input mobile, login short viewport, primitive form |
| `resources/css/layout/shell.css` | drawer/topbar/workspace foundation |
| `resources/css/responsive/mobile.css` | breakpoint phone dùng chung, không chứa toàn bộ page CSS |
| `resources/css/pages/pos.css` | Coffee/Fishing map và order modal mobile |
| `resources/css/pages/pos-orders*.css` | order list/detail/receipt mobile |
| `resources/css/components/modal-shell.css` | dialog/sheet contract |
| `resources/css/components/checkout-modal.css` | checkout mobile canonical |
| `resources/css/components/notifications.css` | drawer/toast mobile canonical |
| `resources/css/components/table.css` | card-list primitive hoặc base mobile table |
| `resources/css/components/pagination.css` | paginator phone |
| `resources/css/pages/admin-*.css` | responsive theo từng admin feature |
| `resources/css/legacy-overrides.css` | giảm dần theo feature, không rewrite một lần |
| `resources/js/shell/sidebar.js` | drawer state, ARIA, focus, resize cleanup |
| `resources/js/modules/keyboard.js` | VisualViewport/keyboard guard |
| `resources/js/pages/pos/order-modal.js` | Menu/Phiếu mobile state |
| `resources/js/pages/pos/checkout.js` | focus/section state nếu cần, không đổi payload |
| `resources/js/pages/orders/list.js` | card renderer chỉ khi CSS không đủ |
| `resources/views/app/partials/*` | semantic wrapper/ARIA/profile trong drawer |
| `docs/regression-checklist.md` | bổ sung phone flows và viewport |
| `docs/frontend-architecture.md` | ghi lại mobile contracts sau khi hoàn tất |

## 14. Rủi ro và cách giảm thiểu

### Rủi ro 1: Cascade legacy gây sửa một nơi vỡ nơi khác

- Giảm thiểu: batch theo feature, screenshot 4 viewport, không đổi import order và responsive cùng lúc.

### Rủi ro 2: Modal mobile làm mất state cart/order

- Giảm thiểu: chỉ đổi presentation state; một DOM/source of truth, không tạo cart thứ hai.

### Rủi ro 3: Scroll lồng nhau gây kẹt trên Safari

- Giảm thiểu: mỗi screen/modal chọn một scroll owner; dùng `overscroll-behavior` có kiểm soát và test thiết bị thật.

### Rủi ro 4: Bàn phím ảo che thanh toán

- Giảm thiểu: dùng VisualViewport/keyboard offset hiện có, sticky footer và test input ở nhiều vị trí.

### Rủi ro 5: Card list làm thiếu dữ liệu bảng

- Giảm thiểu: mapping cột → field rõ ràng, test đủ label/value/action, desktop vẫn dùng table.

### Rủi ro 6: Fishing map mất ý nghĩa không gian

- Giảm thiểu: giữ grid row/column runtime và hai bờ hồ; chỉ giảm trang trí, không chuyển mặc định thành list.

### Rủi ro 7: Touch action gây double submit

- Giảm thiểu: disable khi pending, idempotency/backend transaction hiện có, test tap nhanh.

### Rủi ro 8: Desktop/iPad hồi quy

- Giảm thiểu: mọi rule phone nằm dưới 768px hoặc scoped; chạy viewport gate sau từng page.

## 15. Definition of Done cho từng page

Một page được đánh dấu Done khi:

- Đã qua 320, 390, 430, landscape phone, iPad dọc/ngang và desktop.
- Không tràn ngang document.
- Không có text/action bị cắt.
- Touch target và input font đạt chuẩn.
- Loading, empty, error, long text và maximum-data state đều được kiểm tra.
- Keyboard/safe area được kiểm tra nếu page có form.
- Route rời/đi lại không để listener, timer hoặc polling trùng.
- Console không có error mới.
- Flow nghiệp vụ liên quan qua đầy đủ.
- Screenshot trước/sau được review.
- `npm run build`, `npm test`, test PHP liên quan và `git diff --check` qua.
- Tài liệu regression/architecture được cập nhật nếu contract thay đổi.

## 16. Thứ tự ưu tiên nếu cần ra mắt sớm

### Must have

- Shell/drawer full-width.
- POS Coffee/Fishing map.
- Order modal và Checkout.
- Employee Orders.
- Modal/keyboard/safe area.
- Không tràn ngang, target chạm và hồi quy desktop/iPad.

### Should have

- Admin Orders, Dashboard, Menu, Users, Payment.
- Card-list thay toàn bộ cuộn ngang.
- Notification mobile hoàn chỉnh.
- Visual regression tự động.

### Could have

- Micro-animation tinh chỉnh.
- Haptic-like visual feedback nâng cao.
- Dashboard chart interaction nâng cao.
- Tối ưu riêng cho landscape ngoài các flow bắt buộc.

## 17. Kết luận triển khai

Hướng đi phù hợp nhất với codebase hiện tại là **mobile presentation layer có kiểm soát**, không viết lại frontend và không tách một ứng dụng mobile riêng. Ba quyết định kiến trúc quan trọng nhất là:

1. Thay rail 72px bằng drawer để trả toàn bộ chiều rộng cho nội dung.
2. Chuyển modal gọi món hai cột thành hai chế độ Menu/Phiếu trong cùng modal và cùng state.
3. Chuyển bảng thành card list mobile thay vì duy trì trải nghiệm kéo ngang 720px.

Thực hiện theo các phase nhỏ, giữ file owner rõ và dùng screenshot hồi quy sẽ giúp giao diện điện thoại tiến bộ mạnh mà không làm biến dạng POS, hồ câu hoặc hệ thống quản trị vốn có.
