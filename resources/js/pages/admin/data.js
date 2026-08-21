import { api } from '../../modules/api.js';
import { runButtonAction } from '../../modules/action.js';
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
        <section class="admin-data-console" aria-labelledby="admin-data-console-title">
            <header class="admin-data-console-head">
                <div class="admin-data-destination">
                    <span class="admin-data-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path></svg>
                    </span>
                    <span>
                        <small>EMAIL NHẬN SAO LƯU</small>
                        <strong class="admin-backup-email ${data.can_backup ? '' : 'is-missing'}">
                            ${data.can_backup ? escapeHtml(data.backup_email) : 'Chưa có email hợp lệ'}
                        </strong>
                    </span>
                </div>
                <dl class="admin-data-status-list">
                    <div><dt>Định dạng</dt><dd>SQL</dd></div>
                    <div><dt>Lưu trên server</dt><dd>Không lưu</dd></div>
                    <div><dt>Quyền thao tác</dt><dd>Quản trị viên</dd></div>
                </dl>
            </header>

            <div class="admin-data-action-row">
                <div class="admin-data-action-copy">
                    <span class="admin-data-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14a2 2 0 0 0 2-2v-3"></path><path d="M3 16v3a2 2 0 0 0 2 2"></path></svg>
                    </span>
                    <span>
                        <strong id="admin-data-console-title">Sao lưu database</strong>
                        <small>Tạo bản sao đầy đủ và gửi trực tiếp đến email liên kết.</small>
                    </span>
                </div>
                <button class="button secondary" id="backup-database" ${data.can_backup ? '' : 'disabled'}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14a2 2 0 0 0 2-2v-3"></path><path d="M3 16v3a2 2 0 0 0 2 2"></path></svg>
                    Sao lưu qua email
                </button>
            </div>

            <section class="admin-data-danger-zone" aria-labelledby="admin-data-danger-title">
                <div class="admin-data-danger-head">
                    <span class="admin-data-danger-label">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                        VÙNG NGUY HIỂM
                    </span>
                    <h2 id="admin-data-danger-title">Làm sạch dữ liệu vận hành</h2>
                    <p>Hệ thống luôn gửi một bản sao lưu trước khi bắt đầu xóa.</p>
                </div>
                <div class="admin-data-impact-grid">
                    <div class="admin-data-impact is-deleted">
                        <strong>Sẽ xóa vĩnh viễn</strong>
                        <p>Đơn hàng, thanh toán, phiên câu, OTP, thông báo và nhật ký vận hành.</p>
                    </div>
                    <div class="admin-data-impact is-kept">
                        <strong>Được giữ lại</strong>
                        <p>Tài khoản, menu, sơ đồ bàn/chòi và cấu hình thanh toán.</p>
                    </div>
                </div>
                <div class="admin-data-danger-action">
                    <span><strong>Quy trình an toàn</strong><small>Xác nhận thao tác → gửi SQL thành công → xóa dữ liệu</small></span>
                    <button class="button danger" id="backup-clear-database" ${data.can_backup ? '' : 'disabled'}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
                        Sao lưu & xóa dữ liệu
                    </button>
                </div>
            </section>
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
            'Tiếp tục',
        );
        if (!confirmed) return;

        const password = window.prompt('Để xác nhận lần 2, vui lòng nhập mật khẩu của bạn:');
        if (!password) return;

        const completed = await runDataAction(
            button,
            '/api/v1/admin/data/backup-and-clear',
            'Đang sao lưu & xóa…',
            { confirmation: 'BACKUP_AND_CLEAR', password },
        );
        if (completed) window.location.assign('/admin/dashboard');
    });
}

async function runDataAction(button, path, loadingText, body = undefined) {
    return runButtonAction(button, async () => {
        try {
            const result = await api(path, { method: 'POST', ...(body ? { body } : {}) });
            toast(result.message);
            return true;
        } catch (error) {
            toast(error.message, 'error');
            return false;
        }
    }, { busyText: loadingText });
}

export const dataPage = definePageModule({
    mount: () => renderDataAdmin(),
});
