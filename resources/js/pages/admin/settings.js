import { api } from '../../modules/api.js';
import { toast } from '../../modules/toast.js';
import { escapeHtml } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$, pageHead } from '../../templates/dom.js';
import { paymentMethodFormFooter, paymentMethodFormTitle, renderPaymentMethodForm } from './forms.js';
import { paymentMethodIcon, paymentMethodTypeLabel } from '../pos/payment-methods.js';

export async function renderSettingsAdmin() {
    const data = await api('/api/v1/admin/payment-settings');
    const methods = data.methods || [];

    const statusPill = method => {
        if (!method.is_enabled) return '<span class="pill gray">Đang tắt</span>';
        if (!method.is_ready) return '<span class="pill warn">Thiếu QR</span>';
        return '<span class="pill success">Đang bật</span>';
    };

    const methodInfo = method => {
        if (method.type === 'cash') return 'Thu tiền mặt tại quầy';
        const rows = [method.bank_name, method.account_name, method.account_number].filter(Boolean);
        return rows.length ? rows.map(escapeHtml).join(' · ') : 'Chưa nhập thông tin tài khoản';
    };

    $('#page-content').classList.add('owner-settings-page', 'owner-payment-page');
    $('#page-content').innerHTML = pageHead('THANH TOÁN', 'Quản lý thanh toán', '', '<button class="button primary" id="add-payment-method"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm phương thức</button>') + `
        <div class="data-table-wrap payment-method-table-wrap">
            <table class="data-table payment-method-table">
                <thead><tr><th>PHƯƠNG THỨC</th><th>LOẠI</th><th>THÔNG TIN NHẬN TIỀN</th><th>TRẠNG THÁI</th></tr></thead>
                <tbody>
                    ${methods.length ? methods.map(method => `<tr class="payment-method-row" data-payment-method-row="${method.id}" tabindex="0" role="button" aria-label="Chỉnh sửa phương thức ${escapeHtml(method.name)}">
                        <td data-label="Phương thức"><span class="payment-method-name"><span class="payment-method-icon">${paymentMethodIcon(method.type)}</span><span><strong>${escapeHtml(method.name)}</strong><small>${escapeHtml(method.code)}</small></span></span></td>
                        <td data-label="Loại">${paymentMethodTypeLabel(method.type)}</td>
                        <td data-label="Thông tin"><span class="payment-method-info">${methodInfo(method)}</span></td>
                        <td data-label="Trạng thái">${statusPill(method)}</td>
                    </tr>`).join('') : '<tr><td colspan="4"><div class="empty-state">Chưa có phương thức thanh toán nào.</div></td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    $('#add-payment-method').onclick = () => paymentMethodForm();
    $$('[data-payment-method-row]').forEach(row => {
        const openPaymentMethod = () => paymentMethodForm(methods.find(method => Number(method.id) === Number(row.dataset.paymentMethodRow)));
        row.onclick = event => {
            if (event.target.closest('button, a, input, select, textarea, label')) return;
            openPaymentMethod();
        };
        row.onkeydown = event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openPaymentMethod();
        };
    });

}

export const settingsPage = definePageModule({
    mount: () => renderSettingsAdmin(),
});

function paymentMethodForm(method = null) {
    openModal({
        title: paymentMethodFormTitle(method),
        body: renderPaymentMethodForm(method),
        footer: paymentMethodFormFooter(),
        onReady(modal, close) {
            modal.classList.add('payment-method-modal');
            const form = $('#payment-method-form', modal);
            const typeSelect = $('#payment-method-type', modal);
            const qrFields = $('[data-payment-method-qr]', modal);
            const imageInput = $('#payment-method-qr-image', modal);
            const preview = $('#payment-method-qr-preview', modal);
            const overlayText = $('.payment-qr-overlay strong', modal);
            const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
            let previewUrl = null;

            const syncType = () => {
                const isQr = typeSelect.value === 'qr';
                qrFields.classList.toggle('hidden', !isQr);
                $$('input, textarea', qrFields).forEach(input => input.disabled = !isQr);
            };
            typeSelect.onchange = syncType;
            syncType();

            imageInput.onchange = () => {
                const file = imageInput.files?.[0];
                if (!file) return;
                if (!allowedTypes.has(file.type)) {
                    imageInput.value = '';
                    toast('Bạn vui lòng chọn ảnh QR dạng JPG, PNG hoặc WebP nhé.', 'error');
                    return;
                }
                if (file.size > 30 * 1024 * 1024) {
                    imageInput.value = '';
                    toast('Ảnh QR không được lớn hơn 30 MB nhé.', 'error');
                    return;
                }
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = URL.createObjectURL(file);
                preview.innerHTML = `<img src="${previewUrl}" alt="Xem trước mã QR">`;
                overlayText.textContent = 'Đổi QR';
                const removeInput = $('.payment-qr-remove', modal)?.querySelector('input');
                if (removeInput) removeInput.checked = false;
            };

            $('#save-payment-method', modal).onclick = async () => {
                const saveButton = $('#save-payment-method', modal);
                const formData = new FormData(form);
                const image = formData.get('qr_image');
                if (image instanceof File && image.size === 0) formData.delete('qr_image');
                formData.set('type', typeSelect.value);
                formData.set('is_enabled', $('#payment-method-enabled', modal).checked ? '1' : '0');
                if (method) formData.set('_method', 'PUT');

                saveButton.disabled = true;
                saveButton.textContent = 'Đang lưu…';
                try {
                    const result = await api(method ? `/api/v1/admin/payment-methods/${method.id}` : '/api/v1/admin/payment-methods', { method: 'POST', body: formData });
                    toast(result.message);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    close();
                    renderSettingsAdmin();
                } catch (error) {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Lưu phương thức';
                    toast(error.message, 'error');
                }
            };
        }
    });
}
