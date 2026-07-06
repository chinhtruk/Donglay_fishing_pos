import { api } from '../../modules/api.js';
import { escapeHtml } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
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
    $('#page-content').innerHTML = pageHead('NHÂN SỰ', 'Quản lý User', '', '<button class="button primary" id="add-user"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm tài khoản</button>') + `<div class="data-table-wrap"><table class="data-table user-admin-table"><thead><tr><th>THÀNH VIÊN</th><th>ĐĂNG NHẬP</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th></tr></thead><tbody>${data.users.map(user => `<tr class="user-row-clickable" data-edit-user-row="${user.id}" tabindex="0" aria-label="Chỉnh sửa tài khoản ${escapeHtml(user.name)}"><td data-label="Thành viên"><strong>${escapeHtml(user.name)}</strong></td><td data-label="Đăng nhập">${escapeHtml(user.role === 'admin' ? user.username : user.email)}</td><td data-label="Vai trò">${user.role === 'admin' ? 'Admin' : 'Nhân viên'}</td><td data-label="Trạng thái"><span class="pill ${user.is_active ? '' : 'gray'}">${user.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td></tr>`).join('')}</tbody></table></div>`;
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
                const formData = new FormData($('#user-form', modal));
                const values = Object.fromEntries(formData);
                values.is_active = $('#user-is-active', modal).checked;
                values.email_verified = values.role === 'employee' && $('#user-email-verified', modal).checked;
                if (values.role === 'employee') {
                    values.username = null;
                    delete values.password;
                } else {
                    values.email = null;
                    if (!values.password) delete values.password;
                }
                try {
                    const result = await api(user ? `/api/v1/admin/users/${user.id}` : '/api/v1/admin/users', { method: user ? 'PUT' : 'POST', body: values });
                    toast(result.message);
                    close();
                    renderUsers();
                } catch (error) {
                    toast(error.message, 'error');
                }
            };
        }
    });
}
