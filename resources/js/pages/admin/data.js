import { api } from '../../modules/api.js';
import { escapeHtml } from '../../modules/format.js';
import { confirmModal } from '../../modules/modal.js';
import { toast } from '../../modules/toast.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, pageHead } from '../../templates/dom.js';

export async function renderDataAdmin() {
    const data = await api('/api/v1/admin/data');

    $('#page-content').classList.add('owner-data-page');
    $('#page-content').innerHTML = pageHead(
        'DỮ LIỆU HỆ THỐNG',
        'Dữ liệu & sao lưu',
        '',
    ) + `
        <section class="admin-data-management" aria-labelledby="admin-data-management-title">
            <div class="admin-data-management-copy">
                <h2 id="admin-data-management-title">Sao lưu database</h2>
                <p>File SQL được gửi đến email của admin đang đăng nhập và không được lưu lại trên server.</p>
                <span class="admin-backup-email ${data.can_backup ? '' : 'is-missing'}">
                    ${data.can_backup ? `Email nhận: <strong>${escapeHtml(data.backup_email)}</strong>` : 'Tài khoản này chưa có email nhận sao lưu.'}
                </span>
            </div>
            <div class="admin-data-management-actions">
                <button class="button secondary" id="backup-database" ${data.can_backup ? '' : 'disabled'}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14a2 2 0 0 0 2-2v-3"></path><path d="M3 16v3a2 2 0 0 0 2 2"></path></svg>
                    Sao lưu qua email
                </button>
                <button class="button danger" id="backup-clear-database" ${data.can_backup ? '' : 'disabled'}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
                    Sao lưu & xóa dữ liệu
                </button>
            </div>
        </section>
    `;

    $('#backup-database')?.addEventListener('click', async event => {
        await runDataAction(event.currentTarget, '/api/v1/admin/data/backup', 'Đang gửi sao lưu…');
    });

    $('#backup-clear-database')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const confirmed = await confirmModal(
            'Sao lưu & xóa dữ liệu vận hành',
            `Hệ thống sẽ gửi toàn bộ database đến ${data.backup_email}, sau đó xóa vĩnh viễn đơn hàng, thanh toán, phiên câu, OTP, thông báo và nhật ký vận hành. Tài khoản, menu, sơ đồ và cấu hình thanh toán được giữ nguyên.`,
            'Sao lưu & xóa',
        );
        if (!confirmed) return;

        const completed = await runDataAction(
            button,
            '/api/v1/admin/data/backup-and-clear',
            'Đang sao lưu & xóa…',
            { confirmation: 'BACKUP_AND_CLEAR' },
        );
        if (completed) window.location.assign('/admin/dashboard');
    });
}

async function runDataAction(button, path, loadingText, body = undefined) {
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = loadingText;
    try {
        const result = await api(path, { method: 'POST', ...(body ? { body } : {}) });
        toast(result.message);
        return true;
    } catch (error) {
        toast(error.message, 'error');
        return false;
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

export const dataPage = definePageModule({
    mount: () => renderDataAdmin(),
});
