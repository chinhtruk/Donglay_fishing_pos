import { escapeHtml } from '../../modules/format.js';
import { cloneTemplate } from '../../templates/dom.js';

const qrPlaceholder = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect><rect x="30" y="6" width="12" height="12" rx="2"></rect><rect x="6" y="30" width="12" height="12" rx="2"></rect><path d="M24 8h2M24 14h2M22 22h5v5h-5zM31 24h4v4M38 24h4M24 33h3M31 32h3v8M39 32h3v3M22 39h5M39 40h3"></path></svg>';

export function paymentMethodFormTitle(method = null) {
    return method ? 'Chỉnh sửa phương thức' : 'Thêm phương thức';
}

export function renderPaymentMethodForm(method = null) {
    const form = cloneTemplate('tpl-payment-method-form');
    if (!form) return renderPaymentMethodFormFallback(method);

    const initialType = method?.type || 'qr';
    const existingCashOption = form.querySelector('[data-existing-payment-type]');
    if (!method) existingCashOption?.remove();

    form.querySelector('[name="name"]').value = method?.name || '';
    const typeSelect = form.querySelector('#payment-method-type');
    typeSelect.value = initialType;
    typeSelect.disabled = Boolean(method);
    form.querySelector('#payment-method-enabled').checked = method?.is_enabled !== false;
    form.querySelector('[data-payment-qr-preview]').innerHTML = paymentQrPreview(method);
    form.querySelector('[data-payment-qr-overlay]').textContent = method?.qr_image_url ? 'Thay QR' : 'Chọn QR';
    form.querySelector('[data-payment-qr-remove]')?.classList.toggle('hidden', !method?.qr_image_url);
    form.querySelector('[name="bank_name"]').value = method?.bank_name || '';
    form.querySelector('[name="account_name"]').value = method?.account_name || '';
    form.querySelector('[name="account_number"]').value = method?.account_number || '';
    form.querySelector('[name="transfer_note"]').value = method?.transfer_note || '';
    form.querySelector('[name="extra_info"]').value = method?.extra_info || '';

    return form.outerHTML;
}

export function paymentMethodFormFooter() {
    return '<span class="muted payment-method-footnote">POS sẽ chỉ hiển thị phương thức đang bật và đủ thông tin cần thiết.</span><div><button class="button primary" id="save-payment-method">Lưu phương thức</button></div>';
}

export function userFormTitle(user = null) {
    const initialRole = user?.role === 'admin' ? 'admin' : 'employee';
    return user ? `Chỉnh sửa ${initialRole === 'admin' ? 'quản trị viên' : 'nhân viên'}` : 'Thêm thành viên';
}

export function userInitialRole(user = null) {
    return user?.role === 'admin' ? 'admin' : 'employee';
}

export function renderUserForm(user = null) {
    const form = cloneTemplate('tpl-user-form');
    if (!form) return renderUserFormFallback(user);

    const initialRole = userInitialRole(user);
    const initial = userInitial(user);
    form.querySelector('[data-user-initial]').textContent = initial;
    form.querySelector('[data-user-heading]').textContent = user?.name || 'Thành viên mới';
    form.querySelector('[name="name"]').value = user?.name || '';
    form.querySelector('#user-role-value').value = initialRole;
    form.querySelectorAll('[data-user-role]').forEach(button => {
        const active = button.dataset.userRole === initialRole;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    form.querySelector('[name="email"]').value = user?.email || '';
    form.querySelector('#user-email-verified').checked = user ? Boolean(user.email_verified_at) : true;
    form.querySelector('[name="username"]').value = user?.username || '';
    form.querySelector('[data-user-password-label]').textContent = user ? 'Mật khẩu mới' : 'Mật khẩu';
    form.querySelector('[name="password"]').placeholder = user ? 'Để trống nếu giữ nguyên' : 'Tối thiểu 8 ký tự';
    form.querySelector('#user-is-active').checked = user?.is_active !== false;

    return form.outerHTML;
}

export function userFormFooter() {
    return '<span class="muted user-form-footnote">Các thay đổi sẽ áp dụng ở lần đăng nhập tiếp theo.</span><div><button class="button primary" id="save-user">Lưu tài khoản</button></div>';
}

function userInitial(user = null) {
    return (user?.name || 'T').trim().charAt(0).toUpperCase();
}

function paymentQrPreview(method = null) {
    return method?.qr_image_url
        ? `<img src="${escapeHtml(method.qr_image_url)}" alt="Mã QR thanh toán">`
        : qrPlaceholder;
}

function renderPaymentMethodFormFallback(method = null) {
    const initialType = method?.type || 'qr';
    return `<form id="payment-method-form" class="payment-method-form" enctype="multipart/form-data">
        <div class="payment-method-form-main">
            <div class="payment-method-form-grid">
                <label>Tên phương thức<input name="name" value="${escapeHtml(method?.name || '')}" maxlength="120" placeholder="Ví dụ: Vietcombank QR" required></label>
                <label>Loại thanh toán<select id="payment-method-type" name="type" ${method ? 'disabled' : ''}>
                    <option value="qr" ${initialType === 'qr' ? 'selected' : ''}>QR / chuyển khoản</option>
                    ${method ? `<option value="cash" ${initialType === 'cash' ? 'selected' : ''}>Tiền mặt</option>` : ''}
                </select></label>
            </div>
            <label class="payment-toggle-card payment-method-enabled" for="payment-method-enabled">
                <span><strong>Đang bật trên POS</strong><small>Chỉ phương thức đang bật mới xuất hiện khi thanh toán.</small></span>
                <input id="payment-method-enabled" name="is_enabled" type="checkbox" ${method?.is_enabled !== false ? 'checked' : ''}>
                <i aria-hidden="true"></i>
            </label>
            <section class="payment-method-qr-fields" data-payment-method-qr>
                <div class="payment-method-qr-media">
                    <label class="payment-qr-drop">
                        <span class="payment-qr-preview" id="payment-method-qr-preview">${paymentQrPreview(method)}</span>
                        <span class="payment-qr-overlay"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"></path></svg><strong>${method?.qr_image_url ? 'Thay QR' : 'Chọn QR'}</strong></span>
                        <input id="payment-method-qr-image" name="qr_image" type="file" accept="image/jpeg,image/png,image/webp">
                    </label>
                    ${method?.qr_image_url ? '<label class="payment-qr-remove"><input type="checkbox" name="remove_qr_image" value="1"><span>Xóa QR hiện tại</span></label>' : ''}
                </div>
                <div class="payment-method-qr-info">
                    <div class="payment-settings-grid">
                        <label>Ngân hàng / Ví điện tử<input name="bank_name" value="${escapeHtml(method?.bank_name || '')}" maxlength="120" placeholder="Ví dụ: Vietcombank"></label>
                        <label>Tên chủ tài khoản<input name="account_name" value="${escapeHtml(method?.account_name || '')}" maxlength="120" placeholder="Ví dụ: DONG LAY FISHING"></label>
                        <label>Số tài khoản<input name="account_number" value="${escapeHtml(method?.account_number || '')}" maxlength="80" placeholder="Nhập số tài khoản"></label>
                        <label>Nội dung chuyển khoản<input name="transfer_note" value="${escapeHtml(method?.transfer_note || '')}" maxlength="160" placeholder="Ví dụ: DONG LAY"></label>
                    </div>
                    <label>Ghi chú thêm<textarea name="extra_info" rows="3" maxlength="1000" placeholder="Ví dụ: Đưa màn hình chuyển khoản thành công cho nhân viên xác nhận.">${escapeHtml(method?.extra_info || '')}</textarea></label>
                </div>
            </section>
        </div>
    </form>`;
}

function renderUserFormFallback(user = null) {
    const initialRole = userInitialRole(user);
    return `<form id="user-form" class="user-account-form">
        <div class="user-form-intro">
            <span class="user-form-avatar">${escapeHtml(userInitial(user))}</span>
            <div><small>THÔNG TIN TÀI KHOẢN</small><strong>${escapeHtml(user?.name || 'Thành viên mới')}</strong></div>
        </div>
        <label class="user-form-field">Họ và tên<input name="name" value="${escapeHtml(user?.name || '')}" placeholder="Nhập họ tên thành viên" autocomplete="name" required></label>
        <fieldset class="user-role-fieldset"><legend>Vai trò</legend><input type="hidden" name="role" id="user-role-value" value="${initialRole}"><div class="user-role-tabs">
            <button type="button" class="user-role-tab ${initialRole === 'employee' ? 'active' : ''}" data-user-role="employee" aria-pressed="${initialRole === 'employee'}"><span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg></span><strong>Nhân viên</strong></button>
            <button type="button" class="user-role-tab ${initialRole === 'admin' ? 'active' : ''}" data-user-role="admin" aria-pressed="${initialRole === 'admin'}"><span><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Z"></path><path d="m9 12 2 2 4-4"></path></svg></span><strong>Quản trị viên</strong></button>
        </div></fieldset>
        <section class="user-credential-section" data-role-fields="employee">
            <div class="user-section-heading"><div><strong>Thông tin đăng nhập</strong><small>Mã OTP sẽ được gửi đến địa chỉ này.</small></div></div>
            <label class="user-form-field">Địa chỉ email<input type="email" name="email" value="${escapeHtml(user?.email || '')}" placeholder="tennhanvien@gmail.com" autocomplete="email"></label>
            <label class="user-toggle-card" for="user-email-verified"><span><strong>Email đã xác minh</strong><small>Cho phép tài khoản nhận OTP và đăng nhập.</small></span><input id="user-email-verified" name="email_verified" type="checkbox" ${user ? (user.email_verified_at ? 'checked' : '') : 'checked'}><i></i></label>
        </section>
        <section class="user-credential-section" data-role-fields="admin">
            <div class="user-section-heading"><div><strong>Thông tin đăng nhập</strong><small>Quản trị viên sử dụng tên đăng nhập và mật khẩu.</small></div></div>
            <div class="user-form-grid"><label class="user-form-field">Tên đăng nhập<input name="username" value="${escapeHtml(user?.username || '')}" placeholder="Ví dụ: quanly" autocomplete="username"></label><label class="user-form-field">${user ? 'Mật khẩu mới' : 'Mật khẩu'}<input type="password" name="password" placeholder="${user ? 'Để trống nếu giữ nguyên' : 'Tối thiểu 8 ký tự'}" autocomplete="new-password"></label></div>
        </section>
        <label class="user-toggle-card account-status" for="user-is-active"><span><strong>Tài khoản hoạt động</strong><small>Cho phép thành viên tiếp tục đăng nhập vào hệ thống.</small></span><input id="user-is-active" name="is_active" type="checkbox" ${user?.is_active !== false ? 'checked' : ''}><i></i></label>
    </form>`;
}
