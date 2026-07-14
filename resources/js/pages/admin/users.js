import { api } from '../../modules/api.js';
import { runButtonAction } from '../../modules/action.js';
import { escapeHtml } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$, pageHead } from '../../templates/dom.js';
import {
    renderUserForm,
    userFormFooter,
    userFormTitle,
    userInitialRole,
} from './forms.js';

let toast = () => {};

export function configureAdminUsers(options = {}) {
    toast = options.toast || toast;
}

export async function renderUsers() {
    const data = await api('/api/v1/admin/users');
    $('#page-content').classList.add('owner-users-page');
    $('#page-content').innerHTML = pageHead('NHÂN SỰ', 'Quản lý User', '', '<button class="button primary" id="add-user"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm tài khoản</button>') + `<div class="data-table-wrap is-mobile-card-list user-admin-table-wrap"><table class="data-table user-admin-table"><thead><tr><th>THÀNH VIÊN</th><th>ĐĂNG NHẬP</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th></tr></thead><tbody>${data.users.map(user => {
        const initial = (user.name || '?').trim().charAt(0).toLocaleUpperCase('vi-VN') || '?';
        return `<tr class="user-row-clickable" data-edit-user-row="${user.id}" tabindex="0" role="button" aria-label="Chỉnh sửa tài khoản ${escapeHtml(user.name)}"><td class="user-cell-name" data-label="Thành viên"><span class="user-card-avatar" aria-hidden="true">${escapeHtml(initial)}</span><span class="user-card-heading"><strong>${escapeHtml(user.name)}</strong><span class="user-card-open" aria-hidden="true">Chạm để chỉnh sửa</span></span></td><td class="user-cell-login" data-label="Đăng nhập"><span class="user-login-identity"><strong>${escapeHtml(user.username || 'Chưa có username')}</strong><small>${escapeHtml(user.email || 'Chưa liên kết email')}</small></span></td><td class="user-cell-role" data-label="Vai trò"><span class="user-role-value">${user.role === 'admin' ? 'Admin' : 'Nhân viên'}</span></td><td class="user-cell-status" data-label="Trạng thái"><span class="pill ${user.is_active ? '' : 'gray'}">${user.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
    $('#add-user').onclick = () => userForm();
    $$('[data-edit-user-row]').forEach(row => {
        const openUser = () => userForm(data.users.find(user => user.id === Number(row.dataset.editUserRow)));
        row.onclick = event => {
            if (event.target.closest('button, a, input, select, textarea, label')) return;
            openUser();
        };
        row.onkeydown = event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openUser();
        };
    });
}

export const usersPage = definePageModule({
    mount: () => renderUsers(),
});

function userForm(user = null) {
    const initialRole = userInitialRole(user);
    openModal({
        title: userFormTitle(user),
        body: renderUserForm(user),
        footer: userFormFooter(),
        onReady(modal, close) {
            modal.classList.add('user-account-modal');
            const roleValue = $('#user-role-value', modal);
            const syncRole = role => {
                roleValue.value = role;
                $$('[data-user-role]', modal).forEach(button => {
                    const active = button.dataset.userRole === role;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                $$('[data-role-fields]', modal).forEach(section => {
                    const active = section.dataset.roleFields === role;
                    section.classList.toggle('hidden', !active);
                    $$('input', section).forEach(input => input.disabled = !active);
                });
            };
            $$('[data-user-role]', modal).forEach(button => button.onclick = () => syncRole(button.dataset.userRole));
            syncRole(initialRole);
            $('#save-user', modal).onclick = async () => {
                const saveButton = $('#save-user', modal);
                const formData = new FormData($('#user-form', modal));
                const values = Object.fromEntries(formData);
                values.is_active = $('#user-is-active', modal).checked;
                values.email_verified = values.role === 'employee' && $('#user-email-verified', modal).checked;
                if (values.role === 'employee') {
                    delete values.password;
                } else {
                    if (!values.password) delete values.password;
                }
                await runButtonAction(saveButton, async () => {
                    try {
                        const result = await api(user ? `/api/v1/admin/users/${user.id}` : '/api/v1/admin/users', { method: user ? 'PUT' : 'POST', body: values });
                        toast(result.message);
                        close();
                        renderUsers();
                    } catch (error) {
                        toast(error.message, 'error');
                    }
                }, { busyText: 'Đang lưu…' });
            };
        }
    });
}
