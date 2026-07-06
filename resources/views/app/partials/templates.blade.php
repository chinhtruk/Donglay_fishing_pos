<template id="tpl-loading-state">
    @include('app.partials.loading-state')
</template>

<template id="tpl-empty-state">
    <div class="empty-state"><strong data-empty-title></strong><p data-empty-message></p></div>
</template>

<template id="tpl-page-head">
    <header class="page-head">
        <div>
            <p class="eyebrow" data-page-eyebrow></p>
            <h1 data-page-title></h1>
            <p data-page-description></p>
        </div>
        <div class="head-actions" data-page-actions></div>
    </header>
</template>

<template id="tpl-toast">
    <div class="toast">
        <span class="toast-icon" aria-hidden="true" data-toast-icon></span>
        <span class="toast-copy">
            <strong data-toast-title></strong>
            <span data-toast-message></span>
        </span>
        <button class="toast-close" type="button" aria-label="Tắt thông báo">×</button>
    </div>
</template>

<template id="tpl-modal-shell">
    <div class="modal-backdrop">
        <section class="modal" role="dialog" aria-modal="true">
            <header class="modal-head">
                <h2 data-modal-title></h2>
                <button class="modal-close" aria-label="Đóng">
                    <svg class="modal-close-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </header>
            <div class="modal-body" data-modal-body></div>
            <footer class="modal-foot" data-modal-footer></footer>
        </section>
    </div>
</template>

<template id="tpl-confirm-body">
    <p class="muted modal-confirm-message" data-confirm-message></p>
</template>

<template id="tpl-confirm-footer">
    <span></span>
    <div>
        <button type="button" class="button secondary" data-cancel>Để sau</button>
        <button type="button" class="button primary" data-confirm></button>
    </div>
</template>

<template id="tpl-pos-order-modal-body">
    <div class="modal-pos-layout">
        <main class="pos-menu-section">
            <div class="pos-section-head">
                <div class="category-tabs" data-pos-modal-categories></div>
                <label class="pos-search">
                    <span aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input id="modal-product-search" type="search" placeholder="Tìm tên món…">
                </label>
            </div>
            <div class="pos-product-grid" data-pos-modal-products></div>
        </main>
        <aside class="modal-order-dock-aside">
            <div id="modal-order-panel"></div>
        </aside>
    </div>
</template>

<template id="tpl-pos-product-card">
    <article class="pos-product-card" data-modal-product-card>
        <button class="product-main" data-modal-product>
            <span data-product-media></span>
            <small data-product-category></small>
            <strong data-product-name></strong>
            <b data-product-price></b>
            <em aria-hidden="true">
                <svg class="pos-product-add-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </em>
        </button>
    </article>
</template>

<template id="tpl-payment-method-form">
    <form id="payment-method-form" class="payment-method-form" enctype="multipart/form-data">
        <div class="payment-method-form-main">
            <div class="payment-method-form-grid">
                <label>Tên phương thức<input name="name" maxlength="120" placeholder="Ví dụ: Vietcombank QR" required></label>
                <label>Loại thanh toán<select id="payment-method-type" name="type">
                    <option value="qr">QR / chuyển khoản</option>
                    <option value="cash" data-existing-payment-type>Tiền mặt</option>
                </select></label>
            </div>
            <label class="payment-toggle-card payment-method-enabled" for="payment-method-enabled">
                <span><strong>Đang bật trên POS</strong><small>Chỉ phương thức đang bật mới xuất hiện khi thanh toán.</small></span>
                <input id="payment-method-enabled" name="is_enabled" type="checkbox">
                <i aria-hidden="true"></i>
            </label>
            <section class="payment-method-qr-fields" data-payment-method-qr>
                <div class="payment-method-qr-media">
                    <label class="payment-qr-drop">
                        <span class="payment-qr-preview" id="payment-method-qr-preview" data-payment-qr-preview></span>
                        <span class="payment-qr-overlay"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"></path></svg><strong data-payment-qr-overlay>Chọn QR</strong></span>
                        <input id="payment-method-qr-image" name="qr_image" type="file" accept="image/jpeg,image/png,image/webp">
                    </label>
                    <label class="payment-qr-remove hidden" data-payment-qr-remove><input type="checkbox" name="remove_qr_image" value="1"><span>Xóa QR hiện tại</span></label>
                </div>
                <div class="payment-method-qr-info">
                    <div class="payment-settings-grid">
                        <label>Ngân hàng / Ví điện tử<input name="bank_name" maxlength="120" placeholder="Ví dụ: Vietcombank"></label>
                        <label>Tên chủ tài khoản<input name="account_name" maxlength="120" placeholder="Ví dụ: DONG LAY FISHING"></label>
                        <label>Số tài khoản<input name="account_number" maxlength="80" placeholder="Nhập số tài khoản"></label>
                        <label>Nội dung chuyển khoản<input name="transfer_note" maxlength="160" placeholder="Ví dụ: DONG LAY"></label>
                    </div>
                    <label>Ghi chú thêm<textarea name="extra_info" rows="3" maxlength="1000" placeholder="Ví dụ: Đưa màn hình chuyển khoản thành công cho nhân viên xác nhận."></textarea></label>
                </div>
            </section>
        </div>
    </form>
</template>

<template id="tpl-user-form">
    <form id="user-form" class="user-account-form">
        <div class="user-form-intro">
            <span class="user-form-avatar" data-user-initial></span>
            <div><small>THÔNG TIN TÀI KHOẢN</small><strong data-user-heading></strong></div>
        </div>
        <label class="user-form-field">Họ và tên<input name="name" placeholder="Nhập họ tên thành viên" autocomplete="name" required></label>
        <fieldset class="user-role-fieldset"><legend>Vai trò</legend><input type="hidden" name="role" id="user-role-value"><div class="user-role-tabs">
            <button type="button" class="user-role-tab" data-user-role="employee" aria-pressed="false"><span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg></span><strong>Nhân viên</strong></button>
            <button type="button" class="user-role-tab" data-user-role="admin" aria-pressed="false"><span><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z"></path><path d="m9 12 2 2 4-4"></path></svg></span><strong>Quản trị viên</strong></button>
        </div></fieldset>
        <section class="user-credential-section" data-role-fields="employee">
            <div class="user-section-heading"><div><strong>Thông tin đăng nhập</strong><small>Mã OTP sẽ được gửi đến địa chỉ này.</small></div></div>
            <label class="user-form-field">Địa chỉ email<input type="email" name="email" placeholder="tennhanvien@gmail.com" autocomplete="email"></label>
            <label class="user-toggle-card" for="user-email-verified"><span><strong>Email đã xác minh</strong><small>Cho phép tài khoản nhận OTP và đăng nhập.</small></span><input id="user-email-verified" name="email_verified" type="checkbox"><i></i></label>
        </section>
        <section class="user-credential-section" data-role-fields="admin">
            <div class="user-section-heading"><div><strong>Thông tin đăng nhập</strong><small>Quản trị viên sử dụng tên đăng nhập và mật khẩu.</small></div></div>
            <div class="user-form-grid"><label class="user-form-field">Tên đăng nhập<input name="username" placeholder="Ví dụ: quanly" autocomplete="username"></label><label class="user-form-field"><span data-user-password-label>Mật khẩu</span><input type="password" name="password" autocomplete="new-password"></label></div>
        </section>
        <label class="user-toggle-card account-status" for="user-is-active"><span><strong>Tài khoản hoạt động</strong><small>Cho phép thành viên tiếp tục đăng nhập vào hệ thống.</small></span><input id="user-is-active" name="is_active" type="checkbox"><i></i></label>
    </form>
</template>
