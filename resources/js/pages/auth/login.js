import { api } from '../../modules/api.js';
import { $, $$ } from '../../templates/dom.js';

export function setupLogin() {
    const employeeForm = $('#employee-login');
    const adminForm = $('#admin-login');
    const messageNode = $('#login-message');
    if (! employeeForm || ! adminForm) return;

    const usernameStage = $('#employee-username-stage');
    const otpStage = $('#employee-otp-stage');
    const usernameInput = $('#emp-username');
    const codeInput = $('#emp-otp');
    const otpUsernameDisplay = $('#otp-username-display');
    const resendButton = $('#resend-otp');
    const editUsernameButton = $('#edit-login-username');
    const adminPassword = $('#admin-password');
    const adminToggle = $('#admin-pw-toggle');
    let employeeStep = 'username';
    let resendTicker = null;

    const setMsg = (msg = '', error = false) => {
        if (! messageNode) return;
        messageNode.textContent = msg;
        messageNode.classList.toggle('error', error);
    };

    const setBusy = (form, busy) => {
        form.classList.toggle('is-busy', busy);
        form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = busy; });
    };

    const focusSoon = node => window.setTimeout(() => node?.focus(), 30);

    const setEmployeeStep = step => {
        employeeStep = step;
        usernameStage.classList.toggle('hidden', step !== 'username');
        otpStage.classList.toggle('hidden', step !== 'otp');
        usernameInput.readOnly = step === 'otp';
        if (codeInput) {
            codeInput.required = step === 'otp';
            if (step !== 'otp') codeInput.value = '';
        }
        setMsg('');
        focusSoon(step === 'otp' ? codeInput : usernameInput);
    };

    const stopResendTimer = () => {
        if (resendTicker) window.clearInterval(resendTicker);
        resendTicker = null;
    };

    const startResendTimer = (seconds = 60) => {
        if (! resendButton) return;
        stopResendTimer();
        let remaining = seconds;
        resendButton.disabled = true;
        resendButton.textContent = `Gửi lại mã sau ${remaining} giây`;
        resendTicker = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                stopResendTimer();
                resendButton.disabled = false;
                resendButton.textContent = 'Gửi lại mã xác minh';
                return;
            }
            resendButton.textContent = `Gửi lại mã sau ${remaining} giây`;
        }, 1000);
    };

    const requestOtp = async username => {
        const result = await api('/api/v1/auth/otp/request', { method: 'POST', body: { username } });
        otpUsernameDisplay.textContent = username;
        setEmployeeStep('otp');
        startResendTimer(60);
        setMsg(result.message || 'Mã xác minh đang được gửi đến email của bạn.');
    };

    $$('[data-login-tab]').forEach(button => {
        button.onclick = () => {
            const role = button.dataset.loginTab;
            $$('[data-login-tab]').forEach(tab => {
                const active = tab === button;
                tab.classList.toggle('lp-tab--active', active);
                tab.setAttribute('aria-selected', String(active));
            });
            employeeForm.classList.toggle('hidden', role !== 'employee');
            adminForm.classList.toggle('hidden', role !== 'admin');
            setMsg('');
            focusSoon(role === 'admin' ? $('#admin-username') : (employeeStep === 'otp' ? codeInput : usernameInput));
        };
    });

    employeeForm.onsubmit = async event => {
        event.preventDefault();
        const username = (usernameInput.value || '').trim().toLowerCase();
        setMsg('');

        if (! username || ! /^[a-z0-9._-]+$/.test(username)) {
            setMsg('Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.', true);
            focusSoon(usernameInput);
            return;
        }

        setBusy(employeeForm, true);
        try {
            if (employeeStep === 'username') {
                await requestOtp(username);
                return;
            }

            const code = (codeInput.value || '').replace(/\D/g, '').slice(0, 6);
            codeInput.value = code;
            if (code.length !== 6) {
                setMsg('Mã xác minh gồm 6 chữ số. Bạn kiểm tra lại một chút nhé.', true);
                focusSoon(codeInput);
                return;
            }

            const result = await api('/api/v1/auth/otp/verify', { method: 'POST', body: { username, code } });
            window.location.href = result.redirect;
        } catch (err) {
            setMsg(err.message, true);
        } finally {
            setBusy(employeeForm, false);
        }
    };

    codeInput?.addEventListener('input', () => {
        codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    });

    editUsernameButton?.addEventListener('click', () => {
        stopResendTimer();
        setEmployeeStep('username');
    });

    resendButton?.addEventListener('click', async () => {
        const username = (usernameInput.value || '').trim().toLowerCase();
        if (! username) return setEmployeeStep('username');
        resendButton.disabled = true;
        try {
            await requestOtp(username);
        } catch (err) {
            resendButton.disabled = false;
            setMsg(err.message, true);
        }
    });

    adminForm.onsubmit = async event => {
        event.preventDefault();
        setBusy(adminForm, true);
        setMsg('');
        try {
            const result = await api('/api/v1/auth/admin', {
                method: 'POST',
                body: Object.fromEntries(new FormData(adminForm))
            });
            window.location.href = result.redirect;
        } catch (err) {
            setMsg(err.message, true);
        } finally {
            setBusy(adminForm, false);
        }
    };

    adminToggle?.addEventListener('click', () => {
        const visible = adminPassword.type === 'text';
        adminPassword.type = visible ? 'password' : 'text';
        adminToggle.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
    });

    setEmployeeStep('username');
}
