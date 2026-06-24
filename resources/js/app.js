import { api } from './modules/api.js';
import { Cart } from './modules/cart.js';
import { dateTime, escapeHtml, formatMoneyInput, formatStoredMoneyInput, money, number, parseMoneyInput, statusClass, statusLabel } from './modules/format.js';
import { confirmModal, openModal } from './modules/modal.js';
import { duration, remaining, ServerClock } from './modules/timers.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let activeTimer = null;
let notificationPollingTimer = null;
let orderPollingTimer = null;
let orderPollSignature = '';
let isPollingOrders = false;
let adminOrdersPage = 1;
let employeeOrdersPage = 1;
let adminMenuPage = 1;
let adminOrderFilters = { service_type: '', status: '', q: '' };
let adminMenuFilters = { category: '', q: '' };
let adminOrderSearchTimer = null;
let adminMenuSearchTimer = null;

function toastIcon(type) {
    return {
        success: '✓',
        payment: '₫',
        coffee: 'CF',
        fishing: 'Câu',
        info: 'i',
        warning: '!',
        alert: '!',
        error: '!'
    }[type] || 'i';
}

function toast(message, type = 'success', options = {}) {
    const root = $('#toast-root');
    if (!root) return;
    const payload = typeof message === 'object' ? message : { message };
    const toastId = options.id || payload.id || '';
    if (toastId && [...root.children].some(child => child.dataset.toastId === String(toastId))) return;

    const node = document.createElement('div');
    node.className = `toast ${type}${options.sticky ? ' is-sticky' : ''}`;
    if (toastId) node.dataset.toastId = String(toastId);
    node.innerHTML = `
        <span class="toast-icon" aria-hidden="true">${escapeHtml(payload.icon || toastIcon(type))}</span>
        <span class="toast-copy">
            ${payload.title ? `<strong>${escapeHtml(payload.title)}</strong>` : ''}
            <span>${escapeHtml(payload.message || '')}</span>
        </span>
        ${options.dismissible ? '<button class="toast-close" type="button" aria-label="Tắt thông báo">×</button>' : ''}
    `;

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        node.remove();
        if (typeof options.onClose === 'function') options.onClose();
    };
    node.querySelector('.toast-close')?.addEventListener('click', close);
    if (options.sticky) {
        root.prepend(node);
        return;
    }

    root.append(node);
    setTimeout(close, options.duration || 5200);
}

function notificationToastOptions(notification) {
    const type = notification.data?.type || '';
    if (type === 'fishing_session_expired') {
        return {
            variant: 'alert',
            icon: '!',
            sticky: true,
            dismissible: true,
            id: `fishing-expired-${notification.data?.session_id || notification.id}`
        };
    }
    if (type.includes('payment_completed')) return { variant: 'payment', icon: '₫' };
    if (type.includes('released')) return { variant: 'success', icon: '✓' };
    if (type.includes('merged') || type.includes('assigned') || type.includes('extended')) return { variant: 'info', icon: '↔' };
    if (type.startsWith('fishing')) return { variant: 'fishing', icon: 'Câu' };
    if (type.startsWith('coffee') || type.startsWith('counter')) return { variant: 'coffee', icon: 'CF' };

    return { variant: 'info', icon: 'i' };
}

function setLoading() {
    const page = $('#page-content');
    page.className = 'page-content';
    page.innerHTML = '<div class="loading-state"><span></span><p>Đang sắp xếp không gian…</p></div>';
}

function pageHead(eyebrow, title, description, actions = '') {
    const eyebrowHtml = eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : '';
    const titleHtml = title ? `<h1>${title}</h1>` : '';
    const descHtml = description ? `<p>${description}</p>` : '';
    return `<header class="page-head"><div>${eyebrowHtml}${titleHtml}${descHtml}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
}

function formatDisplayPrice(displayPrice) {
    if (!displayPrice) return '';
    const parts = displayPrice.split('-').map(x => x.trim());
    if (parts.length === 2) {
        const fromVal = Number(parts[0]);
        const toVal = Number(parts[1]);
        if (!isNaN(fromVal) && !isNaN(toVal) && fromVal > 0 && toVal > 0) {
            return `${number(fromVal)} - ${money(toVal)}`;
        }
    }
    return displayPrice;
}

function paymentMethodIcon(type = 'qr') {
    if (type === 'cash') {
        return '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 9h1.5M16.5 15H18"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"></path></svg>';
}

function paymentMethodTypeLabel(type = 'qr') {
    return type === 'cash' ? 'Tiền mặt' : 'QR / chuyển khoản';
}

function paymentMethodDisplayLabel(method = 'cash') {
    if (method === 'cash') return 'Tiền mặt';
    if (String(method).startsWith('qr')) return 'QR / chuyển khoản';
    return method || 'Khác';
}

function normalizedCategoryName(category = '') {
    return String(category).trim().toLowerCase();
}

function isTrailingPosMenuCategory(category = '') {
    return ['ăn vặt', 'đồ ăn'].includes(normalizedCategoryName(category));
}

function orderedPosMenu(menu = []) {
    const categoryIndexes = new Map();
    menu.forEach(item => {
        if (!categoryIndexes.has(item.category)) categoryIndexes.set(item.category, categoryIndexes.size);
    });

    return [...menu].sort((a, b) => {
        const trailingDiff = Number(isTrailingPosMenuCategory(a.category)) - Number(isTrailingPosMenuCategory(b.category));
        if (trailingDiff !== 0) return trailingDiff;

        const categoryDiff = (categoryIndexes.get(a.category) ?? 0) - (categoryIndexes.get(b.category) ?? 0);
        if (categoryDiff !== 0) return categoryDiff;

        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    });
}

function posMenuCategories(menu = []) {
    return ['Tất cả', ...new Set(menu.map(item => item.category))];
}

function isVariablePriceItem(menuItems, menuItemId) {
    const item = menuItems.find(item => item.id === Number(menuItemId));
    return Boolean(item) && Number(item.price) === 0;
}

function hasMissingVariablePrice(cart, menuItems) {
    return cart.values().some(line => isVariablePriceItem(menuItems, line.menu_item_id) && Number(line.price) <= 0);
}

function orderLineUnitPriceHtml(line, menuItems) {
    if (!isVariablePriceItem(menuItems, line.menu_item_id)) {
        return `<small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(line.price)} / món</small>`;
    }

    return Number(line.price) > 0
        ? `<small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(line.price)} / món</small>`
        : '<small style="color: #b95e55; font-size: 8px; display: block; margin-top: 4px;">Chưa nhập giá</small>';
}

function orderLineTotalHtml(line, quantity, menuItems) {
    const total = Number(line.price) * Number(quantity || 0);
    const text = total > 0 || !isVariablePriceItem(menuItems, line.menu_item_id) ? money(total) : 'Chưa có giá';

    return `<b style="align-self: center; font-size: 10px; color: #785943; text-align:right;">${text}</b>`;
}

function orderShortCode(order) {
    return order ? `#${escapeHtml(order.order_number.split('-').slice(-1)[0])}` : 'Đơn mới';
}

function orderBadgeHtml(order) {
    return `<span class="order-number-chip">${orderShortCode(order)}</span>`;
}

function orderStackIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 16 9 5 9-5"></path></svg>';
}

function orderCompletedPaymentTotal(order) {
    return order?.payments
        ?.filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
}

function orderRemainingDue(order, total = null) {
    const billTotal = Number(total ?? order?.total ?? 0);

    return Math.max(0, billTotal - orderCompletedPaymentTotal(order));
}

function fishingMergeTargetChipHtml(spot, isSelected = false) {
    const isPaid = spot.order && spot.order.status === 'paid';
    const stateText = isPaid
        ? 'Đã trả'
        : (spot.state === 'expired' ? 'Hết giờ' : 'Đang câu');
    const stateClass = isPaid ? 'is-paid' : (spot.state === 'expired' ? 'is-expired' : 'is-occupied');
    const totalText = spot.order ? money(spot.order.total) : 'Chưa có hóa đơn';

    return `<button type="button" class="merge-target-chip ${stateClass} ${isSelected ? 'is-selected' : ''}" data-merge-target="${spot.id}" aria-pressed="${isSelected ? 'true' : 'false'}">
        <span class="merge-target-main"><strong>${escapeHtml(spot.label)}</strong><em>${stateText}</em></span>
        <small>${totalText}</small>
    </button>`;
}

function suggestedVariablePrice(item) {
    const firstPrice = String(item.display_price || '').split('-')[0]?.trim() || '';
    const price = parseMoneyInput(firstPrice);

    return price > 0 ? price : 0;
}

function requestVariablePrice(modal, item) {
    const host = modal.closest('.modal-backdrop') || modal;
    host.querySelector('.variable-price-dialog-layer')?.remove();

    return new Promise(resolve => {
        const suggestion = suggestedVariablePrice(item);
        const displayPrice = formatDisplayPrice(item.display_price);
        const layer = document.createElement('div');
        layer.className = 'variable-price-dialog-layer';
        layer.innerHTML = `
            <form class="variable-price-dialog" role="dialog" aria-modal="true" aria-labelledby="variable-price-title">
                <div class="variable-price-dialog-head">
                    <span class="variable-price-dialog-icon" aria-hidden="true">₫</span>
                    <div>
                        <h3 id="variable-price-title">Nhập giá món</h3>
                        <p>${escapeHtml(item.name)}</p>
                    </div>
                </div>
                ${displayPrice ? `<div class="variable-price-range">Khoảng giá: <strong>${escapeHtml(displayPrice)}</strong></div>` : ''}
                <label class="variable-price-input-label">
                    <span>Giá bán thực tế</span>
                    <div class="variable-price-input-wrap">
                        <input type="text" inputmode="numeric" autocomplete="off" data-variable-price-input value="${suggestion ? escapeHtml(formatMoneyInput(String(suggestion))) : ''}" placeholder="Nhập giá">
                        <em>₫</em>
                    </div>
                </label>
                <p class="variable-price-error" data-variable-price-error aria-live="polite"></p>
                <div class="variable-price-dialog-actions">
                    <button type="button" class="button ghost" data-variable-price-cancel>Hủy</button>
                    <button type="submit" class="button primary">Thêm món</button>
                </div>
            </form>
        `;

        host.append(layer);

        const input = layer.querySelector('[data-variable-price-input]');
        const error = layer.querySelector('[data-variable-price-error]');
        let settled = false;
        const close = value => {
            if (settled) return;
            settled = true;
            layer.remove();
            resolve(value);
        };
        const submit = () => {
            const price = parseMoneyInput(input.value);
            if (price <= 0) {
                error.textContent = 'Bạn nhập giá hợp lệ trước khi thêm món nhé.';
                input.focus();
                return;
            }
            close(price);
        };

        input.addEventListener('input', () => {
            input.value = formatMoneyInput(input.value);
            error.textContent = '';
        });
        layer.querySelector('[data-variable-price-cancel]').addEventListener('click', () => close(null));
        layer.addEventListener('click', event => {
            if (event.target === layer) close(null);
        });
        layer.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(null);
            }
        });
        layer.querySelector('form').addEventListener('submit', event => {
            event.preventDefault();
            submit();
        });

        window.setTimeout(() => {
            input.focus();
            input.select();
        }, 30);
    });
}

function productMedia(item, index = 0) {
    if (item.image_url) {
        return `<span class="product-art has-image"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy"></span>`;
    }

    return `<span class="product-art art-${index % 4}"><i><svg viewBox="0 0 64 64" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="15" width="34" height="34" rx="7"></rect><path d="m17 42 9-10 7 7 5-5 8 8"></path><circle cx="37" cy="25" r="4"></circle></svg></i></span>`;
}

function setupLogin() {
    const employeeForm = $('#employee-login');
    const adminForm = $('#admin-login');
    const messageNode = $('#login-message');
    if (! employeeForm || ! adminForm) return;

    const emailStage = $('#employee-email-stage');
    const otpStage = $('#employee-otp-stage');
    const emailInput = $('#emp-email');
    const codeInput = $('#emp-otp');
    const otpEmailDisplay = $('#otp-email-display');
    const resendButton = $('#resend-otp');
    const editEmailButton = $('#edit-login-email');
    const adminPassword = $('#admin-password');
    const adminToggle = $('#admin-pw-toggle');
    let employeeStep = 'email';
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
        emailStage.classList.toggle('hidden', step !== 'email');
        otpStage.classList.toggle('hidden', step !== 'otp');
        emailInput.readOnly = step === 'otp';
        if (codeInput) {
            codeInput.required = step === 'otp';
            if (step !== 'otp') codeInput.value = '';
        }
        setMsg('');
        focusSoon(step === 'otp' ? codeInput : emailInput);
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

    const requestOtp = async email => {
        const result = await api('/api/v1/auth/otp/request', { method: 'POST', body: { email } });
        otpEmailDisplay.textContent = email;
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
            focusSoon(role === 'admin' ? $('#admin-username') : (employeeStep === 'otp' ? codeInput : emailInput));
        };
    });

    employeeForm.onsubmit = async event => {
        event.preventDefault();
        const email = (emailInput.value || '').trim().toLowerCase();
        setMsg('');

        if (! email || ! email.includes('@')) {
            setMsg('Bạn nhập email giúp mình nhé, để hệ thống gửi mã đăng nhập đúng hộp thư.', true);
            focusSoon(emailInput);
            return;
        }

        setBusy(employeeForm, true);
        try {
            if (employeeStep === 'email') {
                await requestOtp(email);
                return;
            }

            const code = (codeInput.value || '').replace(/\D/g, '').slice(0, 6);
            codeInput.value = code;
            if (code.length !== 6) {
                setMsg('Mã xác minh gồm 6 chữ số. Bạn kiểm tra lại một chút nhé.', true);
                focusSoon(codeInput);
                return;
            }

            const result = await api('/api/v1/auth/otp/verify', { method: 'POST', body: { email, code } });
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

    editEmailButton?.addEventListener('click', () => {
        stopResendTimer();
        setEmployeeStep('email');
    });

    resendButton?.addEventListener('click', async () => {
        const email = (emailInput.value || '').trim().toLowerCase();
        if (! email) return setEmployeeStep('email');
        resendButton.disabled = true;
        try {
            await requestOtp(email);
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

    setEmployeeStep('email');
}

function setupShell() {
    updateClock(); setInterval(updateClock, 1000);
    const page = location.pathname.split('/').filter(Boolean).pop() || 'coffee';
    $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === page));
    const closeSidebar = () => { $('#sidebar').classList.remove('open'); document.body.classList.remove('sidebar-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); };
    const toggleSidebar = () => { const opening = !$('#sidebar').classList.contains('open'); $('#sidebar').classList.toggle('open', opening); document.body.classList.toggle('sidebar-open', opening); $('#menu-toggle').setAttribute('aria-expanded', String(opening)); };
    const collapseButton = $('#sidebar-collapse-toggle');
    const syncCollapseButton = () => {
        const collapsed = document.documentElement.classList.contains('sidebar-collapsed');
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng');
        collapseButton.title = collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';
    };
    collapseButton.onclick = () => {
        const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
        try { localStorage.setItem('donglay.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (_) {}
        syncCollapseButton();
    };
    syncCollapseButton();
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    $('#menu-toggle').onclick = toggleSidebar;
    $('#sidebar-scrim').onclick = closeSidebar;
    $$('#sidebar nav a').forEach(link => link.addEventListener('click', closeSidebar));
    window.addEventListener('resize', () => { if (window.innerWidth > 820) closeSidebar(); });
    const closeProfileMenu = () => {
        $('#profile-menu')?.classList.add('hidden');
        $('#profile-menu-button')?.setAttribute('aria-expanded', 'false');
    };
    $('#profile-menu-button')?.addEventListener('click', event => {
        event.stopPropagation();
        const menu = $('#profile-menu');
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !opening);
        $('#profile-menu-button').setAttribute('aria-expanded', String(opening));
    });
    $('#logout-button')?.addEventListener('click', async () => {
        closeProfileMenu();
        const confirmed = await confirmModal(
            'Đăng xuất khỏi ca làm?',
            'Bạn có chắc muốn đăng xuất tài khoản hiện tại không? Các đơn đang mở vẫn được giữ nguyên trong hệ thống.',
            'Đăng xuất'
        );
        if (! confirmed) return;
        const result = await api('/api/v1/logout', { method:'POST' });
        window.location.href = result.redirect;
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.profile-menu-wrap')) closeProfileMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeProfileMenu();
        }
    });
    pollNotificationToasts();
    notificationPollingTimer = window.setInterval(pollNotificationToasts, 3000);
    renderPage(page);
}

function updateClock() {
    const now = new Date(); if (!$('#live-time')) return;
    $('#live-time').textContent = now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    $('#live-date').textContent = now.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' });
}

async function pollNotificationToasts() {
    try {
        const result = await api('/api/v1/notifications?unread=1');
        const unread = (result.notifications || []).filter(item => !item.read_at);
        if (!unread.length) return;

        const notificationsToMarkRead = [];

        unread.reverse().forEach(item => {
            const options = notificationToastOptions(item);
            if (options.sticky) {
                options.onClose = () => {
                    api(`/api/v1/notifications/${item.id}/read`, { method:'POST' }).catch(() => {});
                };
            } else {
                notificationsToMarkRead.push(item.id);
            }

            toast({
                id: item.id,
                title: item.data?.title || 'Thông báo mới',
                message: item.data?.message || 'Có cập nhật mới trong hệ thống.',
                icon: options.icon
            }, options.variant, options);
        });

        await Promise.all(notificationsToMarkRead.map(id => (
            api(`/api/v1/notifications/${id}/read`, { method:'POST' }).catch(() => {})
        )));
        if (document.body.dataset.role === 'admin' && location.pathname.endsWith('/orders')) {
            await pollAdminOrders(true);
        }
    } catch { /* transient polling failures should stay quiet */ }
}

async function renderPage(page) {
    clearInterval(activeTimer); setLoading();
    stopOrderPolling();
    const isPOSPage = ['coffee', 'fishing'].includes(page) || (page === 'orders' && document.body.dataset.role !== 'admin');
    document.body.classList.toggle('pos-coffee-page', isPOSPage);
    document.body.classList.toggle('pos-fishing-page', isPOSPage && page === 'fishing');
    document.body.classList.toggle('pos-orders-page', isPOSPage && page === 'orders');
    try {
        if (page === 'coffee') await renderCoffee();
        else if (page === 'fishing') await renderFishing();
        else if (page === 'orders') await renderOrders();
        else if (page === 'dashboard') await renderDashboard();
        else if (page === 'menu') await renderMenuAdmin();
        else if (page === 'map') await renderMapAdmin();
        else if (page === 'settings') await renderSettingsAdmin();
        else if (page === 'users') await renderUsers();
    } catch (error) { $('#page-content').innerHTML = `<div class="empty-state"><strong>Mình chưa tải được khu vực này</strong>${escapeHtml(error.message)}</div>`; }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function slotLegend(fishing = false) { return `<div class="legend"><span><i></i>Trống</span><span><i class="occupied"></i>Đang ${fishing ? 'câu' : 'phục vụ'}</span>${fishing ? '<span><i class="expired"></i>Hết giờ</span>' : ''}<span><i class="disabled"></i>Tạm nghỉ</span></div>`; }

async function renderCoffee() {
    const data = await api('/api/v1/coffee/map');
    const orderedMenu = orderedPosMenu(data.menu);
    const categories = posMenuCategories(orderedMenu);

    $('#page-content').innerHTML = `
        <section class="pos-stats">
            <article class="pos-stat">
                <span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                </span>
                <div><small>Đang phục vụ</small><strong>${number(data.stats.active_tables)} bàn</strong></div>
            </article>
            <article class="pos-stat">
                <span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                </span>
                <div><small>Chưa xác định bàn</small><strong>${number(data.stats.counter_orders)} đơn</strong></div>
            </article>
            <article class="pos-stat">
                <span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <div><small>Hoàn tất hôm nay</small><strong>${number(data.stats.completed_today)} đơn</strong></div>
            </article>
            <button class="button primary pos-new-order-btn pos-new-order">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Đơn mới
            </button>
        </section>
        <div class="coffee-pos-layout" style="grid-template-columns: 1fr;">
            <main class="coffee-pos-main">
                <section class="pos-section">
                    <div class="pos-section-head">
                        <div class="header-actions" style="display: flex; gap: 8px; align-items: center; margin-right: 15px;">
                            <button class="button secondary small" id="btn-merge-mode" style="padding: 6px 12px; font-size: 11px; min-height: auto; border-radius: 8px;">Gộp hóa đơn</button>
                            <button class="button primary small hidden" id="btn-merge-confirm" style="padding: 6px 12px; font-size: 11px; min-height: auto; border-radius: 8px;" disabled>Xác nhận gộp (0)</button>
                        </div>
                        ${slotLegend()}
                    </div>
                    <div class="pos-table-grid">${data.tables.map(table => {
                        const isPaid = table.order && table.order.status === 'paid';
                        const stateClass = table.state + (isPaid ? ' paid-ready' : '');
                        const stateLabel = table.state === 'available' ? 'Trống' : (table.state === 'occupied' ? (isPaid ? 'Đã thanh toán' : 'Đang dùng') : 'Tạm nghỉ');
                        return `<button class="pos-table-card ${stateClass}" data-pos-table="${table.id}" ${table.state === 'disabled' ? 'disabled' : ''}><span class="table-state">${stateLabel}</span><strong>${escapeHtml(table.label)}</strong><small>${table.state === 'occupied' ? money(orderRemainingDue(table.order)) : 'Sẵn sàng nhận khách'}</small></button>`;
                    }).join('')}</div>
                    <div class="counter-order-strip ${data.counter_orders.length ? '' : 'is-empty'}"><div><strong>Đơn tại quầy</strong><small>Chưa xác định được bàn</small></div><div class="counter-order-list">${data.counter_orders.map(order => `<button class="counter-order-chip" data-counter-order="${order.id}"><strong>${escapeHtml(order.order_number)}</strong><span>${number(order.items.reduce((sum, item) => sum + item.quantity, 0))} món · ${money(order.total)}</span></button>`).join('')}</div></div>
                </section>
            </main>
        </div>`;

    const openOrderModal = (tableId, order) => {
        let currentOrder = order;
        let selectedTableId = order ? (order.resource?.id || null) : tableId;
        let cart = order ? new Cart(order.items.filter(item => item.menu_item_id).map(item => ({ menu_item_id:item.menu_item_id, name:item.name, price:Number(item.unit_price), quantity:item.quantity, note:item.note || '' }))) : new Cart();
        let activeCategory = 'Tất cả';

        const modalBody = `
            <div class="modal-pos-layout" style="display:grid; grid-template-columns: 1.25fr 0.75fr; gap: 16px; margin: -23px; height: 80vh; min-height: 550px; background: var(--paper);">
                <main class="pos-menu-section" style="padding: 20px; overflow-y: auto; background: var(--white); border-radius: 22px 0 0 22px; display: flex; flex-direction: column; height: 100%;">
                    <div class="pos-section-head" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;">
                        <div class="category-tabs" style="margin-bottom: 0; display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; flex: 1; min-width: 0;">
                            ${categories.map(category => `<button class="${category === activeCategory ? 'active' : ''}" data-modal-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}
                        </div>
                        <label class="pos-search" style="width: 240px; position: relative; flex-shrink: 0;">
                            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); z-index: 1; display: flex; align-items: center;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input id="modal-product-search" type="search" placeholder="Tìm tên món…" style="height: 38px; padding: 8px 12px 8px 34px; border-radius: 10px; font-size: 11px; width: 100%; border: 1px solid var(--line); outline: none;">
                        </label>
                    </div>
                    <div class="pos-product-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-content: start;">
                        ${orderedMenu.map((item, index) => `
                            <article class="pos-product-card" data-modal-product-card data-name="${escapeHtml(item.name.toLowerCase())}" data-category="${escapeHtml(item.category)}">
                                <button class="product-main" data-modal-product="${item.id}">
                                    ${productMedia(item, index)}
                                    <small>${escapeHtml(item.category)}</small>
                                    <strong>${escapeHtml(item.name)}</strong>
                                    <b>${escapeHtml(formatDisplayPrice(item.display_price) || money(item.price))}</b>
                                    <em>
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </em>
                                </button>
                            </article>`).join('')}
                    </div>
                  </main>
                <aside class="modal-order-dock-aside" style="border: 0; border-radius: 0 22px 22px 0; height: 100%; box-shadow: none; background: #fffdf9; display: flex; flex-direction: column;">
                    <div id="modal-order-panel" style="height: 100%; display: flex; flex-direction: column;"></div>
                </aside>
            </div>
        `;

        openModal({
            title: selectedTableId ? `Đặt món · ${(() => {
                const label = data.tables.find(t => t.id === Number(selectedTableId))?.label || selectedTableId;
                return String(label).toLowerCase().startsWith('bàn') ? label : `Bàn ${label}`;
            })()}` : 'Đặt món · Đơn tại quầy',
            body: modalBody,
            wide: true,
            onReady(modal, closeModal) {
                const renderModalBill = () => {
                    const panel = modal.querySelector('#modal-order-panel');
                    const lines = cart.values();
                    const totalPaid = orderCompletedPaymentTotal(currentOrder);

                    const unpaidLines = [];
                    const paidLines = [];
                    lines.forEach(line => {
                        const paidQty = currentOrder?.items.find(item => item.menu_item_id === line.menu_item_id && Number(item.unit_price) === Number(line.price))?.paid_quantity || 0;
                        const unpaidQty = line.quantity - paidQty;
                        if (unpaidQty > 0) {
                            unpaidLines.push({ ...line, unpaidQty, paidQty });
                        }
                        if (paidQty > 0) {
                            paidLines.push({ ...line, paidQty });
                        }
                    });
                    const remainingDue = orderRemainingDue(currentOrder, cart.total());
                    const canReleaseOnly = currentOrder && currentOrder.status === 'paid' && !unpaidLines.length && remainingDue <= 0;

                    let linesHtml = '';
                    if (unpaidLines.length) {
                        linesHtml += `<div class="modal-lines-section-header unpaid-header" style="font-size: 9px; font-weight: 750; color: #856404; background: #fff3cd; padding: 4px 8px; border-radius: 6px; margin: 4px 0 8px; letter-spacing: 0.05em;">MÓN CHƯA THANH TOÁN</div>`;
                        linesHtml += unpaidLines.map(line => `
                            <div class="order-line unpaid-item" style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                                <div class="order-line-title" style="grid-column: 1 / -1;">
                                    <strong style="font-family: Georgia, serif; font-size: 13px;">${escapeHtml(line.name)}</strong>
                                    ${orderLineUnitPriceHtml(line, data.menu)}
                                </div>
                                <div class="order-line-note-row">
                                    <input type="text" data-modal-note="${line.menu_item_id}" data-modal-price="${line.price}" value="${escapeHtml(line.note || '')}" placeholder="Ghi chú (ít đá, ngọt vừa...)" style="height: 28px; padding: 4px 8px; border-radius: 8px; font-size: 10px; border: 1px solid var(--line); background: #fafaf9; width: 100%; outline: none; margin-top: 2px;">
                                    <div class="quantity" style="display: flex; align-items: center; gap: 4px;">
                                        <button data-modal-minus="${line.menu_item_id}" data-modal-price="${line.price}" style="width: 30px; height: 30px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                        <b style="font-size: 12px; min-width: 16px; text-align: center;">${line.unpaidQty}</b>
                                        <button data-modal-plus="${line.menu_item_id}" data-modal-price="${line.price}" style="width: 30px; height: 30px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                    ${orderLineTotalHtml(line, line.unpaidQty, data.menu)}
                                </div>
                            </div>
                        `).join('');
                    }

                    if (paidLines.length) {
                        linesHtml += `<div class="modal-lines-section-header paid-header" style="font-size: 9px; font-weight: 750; color: #155724; background: #d4edda; padding: 4px 8px; border-radius: 6px; margin: 12px 0 8px; letter-spacing: 0.05em;">MÓN ĐÃ THANH TOÁN</div>`;
                        linesHtml += paidLines.map(line => `
                            <div class="order-line paid-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                                <div class="order-line-title" style="grid-column: 1 / -1;">
                                    <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${escapeHtml(line.name)} <span style="font-size:9px; background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; margin-left:4px; font-family:var(--font-sans); font-weight:600;">✓ Đã trả</span></strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(line.price)} / món</small>
                                </div>
                                <div class="order-line-paid-row">
                                    <span class="order-line-paid-note ${line.note ? '' : 'is-empty'}">${line.note ? escapeHtml(line.note) : ''}</span>
                                    <div class="quantity" style="display: flex; align-items: center; gap: 4px;">
                                        <b style="font-size: 12px; min-width: 16px; text-align: center; color: #155724;">× ${line.paidQty}</b>
                                    </div>
                                    <b style="align-self: center; font-size: 10px; color: #2e5a32; text-align:right;">${money(line.price * line.paidQty)}</b>
                                </div>
                            </div>
                        `).join('');
                    }

                    if (!unpaidLines.length && !paidLines.length) {
                        linesHtml = `
                            <div class="order-empty" style="height: 100%; min-height: 240px; display: grid; place-content: center; text-align: center; color: var(--muted);">
                                <span style="font-size: 28px; display: block; margin-bottom: 8px;">
                                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 10px; opacity: 0.6;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                                </span>
                                <strong style="color: var(--ink); font-family: Georgia, serif; font-size: 15px; display: block; margin-top: 8px;">Đơn hàng đang trống</strong>
                                <p style="font-size: 9px; margin: 4px 0;">Chạm vào món ở bên trái để bắt đầu.</p>
                            </div>`;
                    }

                    panel.innerHTML = `
                        <div class="order-dock-head">
                            <div class="order-head-main">
                                <div class="order-title-block">
                                    <p class="eyebrow">PHIẾU BÁN HÀNG</p>
                                    <h2>Đơn hiện tại</h2>
                                </div>
                                <div class="order-head-actions">
                                    ${orderBadgeHtml(currentOrder)}
                                </div>
                            </div>
                        </div>
                        <div class="order-lines" style="flex: 1; min-height: 160px; max-height: none !important; overflow-y: auto; padding: 6px 14px;">
                            ${linesHtml}
                        </div>
                        <div class="order-dock-footer" style="padding: 13px 14px 14px; border-top: 1px solid var(--line); background: #fff;">
                            <div class="summary-row" style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                                <span>Tạm tính</span>
                                <strong>${money(cart.total())}</strong>
                            </div>
                            ${totalPaid > 0 ? `
                            <div class="summary-row" style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px; color: var(--moss);">
                                <span>Đã trả trước</span>
                                <strong>${money(totalPaid)}</strong>
                            </div>
                            ` : ''}
                            <div class="summary-row total" style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 6px; padding-top: 10px; font-family: Georgia, serif; font-size: 16px; font-weight: 700;">
                                <span>${totalPaid > 0 ? 'Còn lại cần trả' : 'Khách cần trả'}</span>
                                <strong>${money(remainingDue)}</strong>
                            </div>
                            <div class="order-actions" style="display: grid; ${canReleaseOnly ? 'grid-template-columns: 1fr;' : 'grid-template-columns: 1fr 1.35fr;'} gap: 7px; margin-top: 10px;">
                                ${canReleaseOnly ? `
                                    <button class="button primary" id="modal-release-table" style="grid-column: 1 / -1; padding: 11px 8px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                        Giải phóng bàn (Khách rời đi)
                                    </button>
                                ` : `
                                    <button class="button secondary" id="modal-save-order" ${lines.length ? '' : 'disabled'} style="padding: 11px 8px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                        ${currentOrder ? 'Lưu thay đổi' : 'Lưu đơn'}
                                    </button>
                                    <button class="button primary" id="modal-checkout-order" ${lines.length ? '' : 'disabled'} style="padding: 11px 8px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                        Thanh toán
                                    </button>
                                `}
                            </div>
                        </div>`;

                    modal.querySelectorAll('[data-modal-minus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalMinus), Number(button.dataset.modalPrice), -1));
                    modal.querySelectorAll('[data-modal-plus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalPlus), Number(button.dataset.modalPrice), 1));

                    const saveBtn = modal.querySelector('#modal-save-order');
                    if (saveBtn) {
                        saveBtn.onclick = async () => {
                            try {
                                const orderRes = await persistOrder();
                                toast(currentOrder ? 'Hóa đơn đã được cập nhật.' : 'Đơn mới đã được lưu.');
                                closeModal();
                                await renderCoffee();
                            } catch (error) {
                                toast(error.message, 'error');
                                if (error.status === 409) {
                                    closeModal();
                                    await renderCoffee();
                                }
                            }
                        };
                    }

                    const checkoutBtn = modal.querySelector('#modal-checkout-order');
                    if (checkoutBtn) {
                        checkoutBtn.onclick = async () => {
                            try {
                                const orderRes = await persistOrder();
                                closeModal();
                                openCheckout(orderRes, 'coffee', data.payment_settings);
                            } catch (error) {
                                toast(error.message, 'error');
                                if (error.status === 409) {
                                    closeModal();
                                    await renderCoffee();
                                }
                            }
                        };
                    }

                    const releaseBtn = modal.querySelector('#modal-release-table');
                    if (releaseBtn) {
                        releaseBtn.onclick = async () => {
                            try {
                                await api(`/api/v1/coffee/orders/${currentOrder.id}/release`, {
                                    method: 'POST',
                                    body: { version: currentOrder.version }
                                });
                                toast('Đã giải phóng bàn thành công.');
                                closeModal();
                                await renderCoffee();
                            } catch (error) {
                                toast(error.message, 'error');
                                if (error.status === 409) {
                                    closeModal();
                                    await renderCoffee();
                                }
                            }
                        };
                    }
                };

                const changeQuantity = (id, price, delta) => {
                    const item = data.menu.find(product => product.id === id) || cart.values().find(product => product.menu_item_id === id && Number(product.price) === price);
                    const paidQty = currentOrder?.items.find(i => i.menu_item_id === id && Number(i.unit_price) === price)?.paid_quantity || 0;
                    const newQty = Math.max(paidQty, cart.quantity(id, price) + delta);
                    cart.set({ id, name:item.name, price:price }, newQty, price);
                    renderModalBill();
                };

                const persistOrder = async () => {
                    if (!cart.values().length) throw new Error('Bạn chọn ít nhất một món để mở đơn nhé.');
                    if (hasMissingVariablePrice(cart, data.menu)) throw new Error('Bạn nhập giá cho món giá biến động trước khi lưu đơn nhé.');
                    let orderObj = currentOrder;
                    if (!orderObj) {
                        const path = selectedTableId ? `/api/v1/coffee/tables/${selectedTableId}/orders` : '/api/v1/coffee/orders';
                        return (await api(path, { method:'POST', body:{ items:cart.payload() } })).order;
                    }
                    const assignedId = orderObj.resource?.id || null;
                    if (assignedId !== selectedTableId) {
                        orderObj = (await api(`/api/v1/coffee/orders/${orderObj.id}/table`, { method:'PUT', body:{ version:orderObj.version, coffee_table_id:selectedTableId } })).order;
                    }
                    return (await api(`/api/v1/coffee/orders/${orderObj.id}`, { method:'PUT', body:{ version:orderObj.version, items:cart.payload() } })).order;
                };

                modal.querySelectorAll('[data-modal-product]').forEach(button => button.onclick = async () => {
                    const prodId = Number(button.dataset.modalProduct);
                    const matchedItem = data.menu.find(item => item.id === prodId);
                    if (matchedItem) {
                        if (Number(matchedItem.price) === 0) {
                            const customPrice = await requestVariablePrice(modal, matchedItem);
                            if (!customPrice) return;
                            cart.add(matchedItem, customPrice);
                        } else {
                            cart.add(matchedItem);
                        }
                        renderModalBill();
                    }
                });

                const filterModalProducts = () => {
                    const query = modal.querySelector('#modal-product-search').value.trim().toLowerCase();
                    modal.querySelectorAll('[data-modal-product-card]').forEach(card => {
                        const isHidden = !card.dataset.name.includes(query) || (activeCategory !== 'Tất cả' && card.dataset.category !== activeCategory);
                        card.hidden = isHidden;
                        card.classList.toggle('hidden', isHidden);
                    });
                };

                modal.querySelectorAll('[data-modal-category]').forEach(button => button.onclick = () => {
                    activeCategory = button.dataset.modalCategory;
                    modal.querySelectorAll('[data-modal-category]').forEach(item => item.classList.toggle('active', item === button));
                    filterModalProducts();
                });

                modal.querySelector('#modal-product-search').oninput = filterModalProducts;

                modal.addEventListener('input', event => {
                    const noteInput = event.target.closest('[data-modal-note]');
                    if (noteInput) {
                        const menuId = Number(noteInput.dataset.modalNote);
                        const price = Number(noteInput.dataset.modalPrice);
                        cart.setNote(menuId, noteInput.value, price);
                    }
                });

                renderModalBill();
            }
        });
    };

    $$('.pos-new-order').forEach(button => button.onclick = () => openOrderModal(null, null));
    let isMergeMode = false;
    let selectedTableIds = new Set();
    let selectedCounterOrderIds = new Set();

    const mergeModeBtn = $('#btn-merge-mode');
    const mergeConfirmBtn = $('#btn-merge-confirm');
    const updateMergeConfirmState = () => {
        const sourceCount = selectedTableIds.size + selectedCounterOrderIds.size;
        const hasCounterSource = selectedCounterOrderIds.size > 0;
        const hasTarget = hasCounterSource
            ? data.tables.some(table => table.is_enabled)
            : selectedTableIds.size >= 2;
        mergeConfirmBtn.disabled = sourceCount < 1 || !hasTarget;
        mergeConfirmBtn.textContent = `Xác nhận gộp (${sourceCount})`;
    };

    mergeModeBtn.onclick = () => {
        isMergeMode = !isMergeMode;
        selectedTableIds.clear();
        selectedCounterOrderIds.clear();
        mergeModeBtn.classList.toggle('danger', isMergeMode);
        mergeModeBtn.textContent = isMergeMode ? 'Hủy gộp' : 'Gộp hóa đơn';
        mergeConfirmBtn.classList.toggle('hidden', !isMergeMode);
        mergeConfirmBtn.disabled = true;
        mergeConfirmBtn.textContent = 'Xác nhận gộp (0)';
        
        $$('[data-pos-table]').forEach(node => {
            node.classList.remove('selected-for-merge');
        });
        $$('[data-counter-order]').forEach(node => {
            node.classList.remove('selected-for-merge');
        });
    };

    mergeConfirmBtn.onclick = () => {
        const selectedTables = data.tables.filter(t => selectedTableIds.has(t.id));
        const selectedCounterOrders = data.counter_orders.filter(order => selectedCounterOrderIds.has(order.id));
        const targetTables = data.tables.filter(table => table.is_enabled);
        const defaultTarget = targetTables.find(table => table.state === 'available') || targetTables.find(table => !selectedTableIds.has(table.id)) || targetTables[0] || null;
        const targetButtons = targetTables
            .map(table => {
                const stateText = table.state === 'occupied' ? 'Đang phục vụ' : 'Trống';
                const totalText = table.order ? money(orderRemainingDue(table.order)) : 'Bàn trống';
                const isSelected = defaultTarget?.id === table.id;
                return `<button type="button" class="merge-target-chip ${table.state === 'occupied' ? 'is-occupied' : 'is-available'} ${isSelected ? 'is-selected' : ''}" data-merge-target="${table.id}" aria-pressed="${isSelected ? 'true' : 'false'}">
                    <span class="merge-target-main"><strong>${escapeHtml(table.label)}</strong><em>${stateText}</em></span>
                    <small>${totalText}</small>
                </button>`;
            })
            .join('');
        let targetTableId = defaultTarget?.id || null;
        openModal({
            title: 'Gộp nhiều bàn cà phê',
            body: `<div class="merge-target-panel"><div class="merge-target-label">Chọn bàn nhận hóa đơn</div><div class="merge-target-grid">${targetButtons}</div></div><p class="merge-target-note">Có thể chuyển đơn tại quầy vào bất kỳ bàn đang bật. Nếu bàn nhận đang phục vụ, món và thanh toán sẽ được gộp vào hóa đơn hiện có.</p>`,
            footer: `<span></span><div><button class="button primary" id="btn-bulk-merge-confirm" ${targetTableId ? '' : 'disabled'}>Xác nhận</button></div>`,
            onReady(subModal, subClose) {
                subModal.querySelectorAll('[data-merge-target]').forEach(button => {
                    button.onclick = () => {
                        targetTableId = Number(button.dataset.mergeTarget);
                        subModal.querySelectorAll('[data-merge-target]').forEach(item => {
                            const isSelected = item === button;
                            item.classList.toggle('is-selected', isSelected);
                            item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                        });
                        subModal.querySelector('#btn-bulk-merge-confirm').disabled = false;
                    };
                });
                subModal.querySelector('#btn-bulk-merge-confirm').onclick = async () => {
                    if (!targetTableId) {
                        toast('Bạn chọn một bàn nhận hóa đơn nhé.', 'error');
                        return;
                    }
                    const sourceTables = selectedTables.filter(table => table.id !== targetTableId && table.order);
                    const sourceCounterOrders = selectedCounterOrders;
                    const sourceOrders = [
                        ...sourceCounterOrders,
                        ...sourceTables.map(table => table.order),
                    ];
                    if (!sourceOrders.length) {
                        toast('Bạn chọn thêm hóa đơn nguồn khác với bàn nhận nhé.', 'error');
                        return;
                    }
                    
                    subModal.querySelector('#btn-bulk-merge-confirm').disabled = true;
                    subModal.querySelector('#btn-bulk-merge-confirm').textContent = 'Đang gộp…';

                    try {
                        for (const sourceOrder of sourceOrders) {
                            await api(`/api/v1/coffee/orders/${sourceOrder.id}/merge`, {
                                method: 'POST',
                                body: { version: sourceOrder.version, target_table_id: targetTableId }
                            });
                        }
                        toast('Đã gộp hóa đơn thành công.');
                        subClose();
                        
                        const newData = await api('/api/v1/coffee/map');
                        await renderCoffee();
                        
                        const updatedTargetTable = newData.tables.find(t => t.id === targetTableId);
                        if (updatedTargetTable) {
                            openOrderModal(updatedTargetTable.id, updatedTargetTable.order);
                        }
                    } catch (error) {
                        toast(error.message, 'error');
                        subModal.querySelector('#btn-bulk-merge-confirm').disabled = false;
                        subModal.querySelector('#btn-bulk-merge-confirm').textContent = 'Xác nhận';
                        if (error.status === 409) {
                            subClose();
                            await renderCoffee();
                        }
                    }
                };
            }
        });
    };

    $$('[data-pos-table]').forEach(node => {
        node.onclick = () => {
            const tableId = Number(node.dataset.posTable);
            const table = data.tables.find(item => item.id === tableId);
            
            if (isMergeMode) {
                if (table.state !== 'occupied') {
                    toast('Bàn trống có thể làm bàn nhận, không cần chọn làm nguồn gộp.', 'error');
                    return;
                }
                if (selectedTableIds.has(tableId)) {
                    selectedTableIds.delete(tableId);
                    node.classList.remove('selected-for-merge');
                } else {
                    selectedTableIds.add(tableId);
                    node.classList.add('selected-for-merge');
                }
                updateMergeConfirmState();
            } else {
                openOrderModal(table.id, table.order);
            }
        };
    });
    $$('[data-counter-order]').forEach(node => {
        node.onclick = () => {
            const orderId = Number(node.dataset.counterOrder);
            if (isMergeMode) {
                if (selectedCounterOrderIds.has(orderId)) {
                    selectedCounterOrderIds.delete(orderId);
                    node.classList.remove('selected-for-merge');
                } else {
                    selectedCounterOrderIds.add(orderId);
                    node.classList.add('selected-for-merge');
                }
                updateMergeConfirmState();
                return;
            }
            openOrderModal(null, data.counter_orders.find(order => order.id === orderId));
        };
    });

    const sidebarTotal = $('#sidebar-total');
    if (sidebarTotal) sidebarTotal.textContent = `${number(data.tables.filter(item => item.state === 'occupied').length)} bàn đang phục vụ`;
}

function openCheckout(order, type, paymentSettings = {}) {
    const unpaid = order.items.filter(item => item.unpaid_quantity > 0);
    const paid = order.items.filter(item => item.paid_quantity > 0);
    const hasResource = !!order.resource;
    const legacyQrSettings = paymentSettings?.qr || {};
    const rawPaymentMethods = Array.isArray(paymentSettings?.methods) && paymentSettings.methods.length
        ? paymentSettings.methods
        : [
            { code: 'cash', name: 'Tiền mặt', type: 'cash', is_enabled: true },
            ...(legacyQrSettings.is_enabled && legacyQrSettings.qr_image_url ? [{ code: 'qr', name: 'QR chuyển khoản', type: 'qr', ...legacyQrSettings }] : []),
        ];
    const readyPaymentMethods = rawPaymentMethods
        .map(method => ({
            ...method,
            code: method.code || method.type || 'cash',
            name: method.name || paymentMethodTypeLabel(method.type || method.code),
            type: method.type || (method.code === 'cash' ? 'cash' : 'qr'),
        }))
        .filter(method => method.type === 'cash' ? method.is_enabled !== false : method.is_enabled && method.qr_image_url);
    const paymentMethods = readyPaymentMethods.length ? readyPaymentMethods : [{ code: 'cash', name: 'Tiền mặt', type: 'cash', is_enabled: true }];
    const initialPaymentMethod = paymentMethods[0]?.code || 'cash';
    const methodByCode = new Map(paymentMethods.map(method => [method.code, method]));
    const transferMethods = paymentMethods.filter(method => method.type !== 'cash');
    const paymentQrInfoRows = method => [
        ['Ngân hàng', method.bank_name],
        ['Tên chủ TK', method.account_name],
        ['Số tài khoản', method.account_number],
        ['Nội dung CK', method.transfer_note],
    ].filter(([, value]) => value);
    const paymentMethodHint = method => method === 'cash'
        ? 'Thanh toán tiền mặt'
        : `Thanh toán ${methodByCode.get(method)?.name || 'chuyển khoản'}`;
    const releaseHtml = hasResource ? `
        <div style="margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 12px;">
            <label style="display: flex; flex-direction: row; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #526159; cursor: pointer; user-select: none; margin: 0; width: auto; justify-content: flex-start;">
                <input type="checkbox" id="checkout-release" checked style="width: 18px; height: 18px; margin: 0; padding: 0; cursor: pointer; display: inline-block;">
                <span>${type === 'coffee' ? 'Giải phóng bàn khi thanh toán xong' : 'Trả chòi & Giải phóng khi thanh toán xong'}</span>
            </label>
        </div>
    ` : '';

    const body = `
        <div class="checkout-modal-layout" style="display: flex; flex-direction: column; gap: 16px; margin: -23px -23px 0; padding: 24px; background: var(--paper); border-radius: 22px 22px 0 0;">
            <!-- Bill Header/Notice -->
            <div class="checkout-detail-section" style="background: var(--white); border: 1px solid var(--line); border-radius: 16px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                <p class="eyebrow" style="font-size: 8px; margin: 0 0 6px; font-weight: 700; color: var(--moss-2); text-transform: uppercase; letter-spacing: 0.05em;">CHI TIẾT THANH TOÁN</p>
                
                ${unpaid.length ? `
                    <div style="font-weight: 700; font-size: 10px; margin-bottom: 6px; color: var(--muted); letter-spacing:0.04em; text-transform: uppercase;">Món cần thanh toán:</div>
                    <div class="bill-list" style="display: flex; flex-direction: column; max-height: 180px; overflow-y: auto; margin-bottom: 12px;">
                        ${unpaid.map(item => `
                            <div class="bill-line" data-bill-row="${item.id}" style="display: grid; grid-template-columns: auto 1fr auto auto; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); align-items: center;">
                                <div style="display: flex; align-items: center;">
                                    <input type="checkbox" data-pay-check="${item.id}" checked style="width: 18px; height: 18px; margin: 0; cursor: pointer; display: inline-block;">
                                </div>
                                <div style="min-width: 0; text-align: left;">
                                    <strong style="font-family: Georgia, serif; font-size: 13px; color: var(--ink);">${escapeHtml(item.name)}</strong>
                                    <small style="color: var(--muted); font-size: 10px; display: block; margin-top: 3px;">
                                        ${money(item.unit_price)} · còn ${item.unpaid_quantity}
                                    </small>
                                    ${item.note ? `<div style="font-size: 10px; color: #a6534e; margin-top: 2px; font-style: italic;">* ${escapeHtml(item.note)}</div>` : ''}
                                </div>
                                <div class="quantity" style="display: flex; align-items: center; gap: 4px;">
                                    <button type="button" data-pay-minus="${item.id}" style="width: 28px; height: 28px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0; outline: none; transition: all 0.2s;">
                                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                    <span id="pay-qty-val-${item.id}" style="font-size: 12px; font-weight: 600; min-width: 20px; text-align: center; user-select: none;">${item.unpaid_quantity}</span>
                                    <input type="hidden" data-pay-qty="${item.id}" value="${item.unpaid_quantity}">
                                    <button type="button" data-pay-plus="${item.id}" style="width: 28px; height: 28px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0; outline: none; transition: all 0.2s;">
                                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                </div>
                                <b id="pay-line-total-${item.id}" style="font-size: 11px; color: #785943; text-align: right; min-width: 70px;">${money(item.unit_price * item.unpaid_quantity)}</b>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${paid.length ? `
                    <div style="font-weight: 700; font-size: 10px; margin-top: 14px; margin-bottom: 6px; color: var(--moss-2); letter-spacing:0.04em; text-transform: uppercase;">Món đã thanh toán trước đó:</div>
                    <div class="bill-list" style="display: flex; flex-direction: column; max-height: 150px; overflow-y: auto;">
                        ${paid.map(item => `
                            <div class="bill-line paid-item" style="display: grid; grid-template-columns: 1fr auto auto; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); align-items: center; background:#f4faf6; padding-left: 8px; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid #28a745;">
                                <div style="min-width: 0; text-align: left;">
                                    <strong style="font-family: Georgia, serif; font-size: 12px; color: #1e4620;">${escapeHtml(item.name)} <span style="font-size:8px; background:#d4edda; color:#155724; padding:1px 4px; border-radius:3px; font-weight:600; font-family:var(--font-sans);">Đã trả</span></strong>
                                    <small style="color: var(--muted); font-size: 9px; display: block; margin-top: 2px;">
                                        ${money(item.unit_price)} · đã trả ${item.paid_quantity}
                                    </small>
                                </div>
                                <div style="font-size: 12px; color: #155724; font-weight:600; text-align: center; min-width: 40px;">
                                    × ${item.paid_quantity}
                                </div>
                                <b style="font-size: 11px; color: #2e5a32; text-align: right; min-width: 70px; padding-right:8px;">${money(item.unit_price * item.paid_quantity)}</b>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <!-- Payment section -->
            <div class="checkout-payment-section" style="background: #fffdf9; border: 1px solid var(--line); border-radius: 16px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                ${paymentMethods.length > 1 || transferMethods.length ? `
                    <div class="checkout-method-tabs" role="tablist" aria-label="Chọn phương thức thanh toán">
                        ${paymentMethods.map((method, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-payment-method="${escapeHtml(method.code)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(method.name)}</button>`).join('')}
                    </div>
                ` : ''}
                <div class="checkout-cash-panel" data-payment-panel="cash">
                    <label style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
                        Tiền khách đưa
                        <input id="cash-received" inputmode="numeric" type="text" autocomplete="off" placeholder="Nhập số tiền..." aria-label="Số tiền khách đưa" style="font-size: 16px; font-weight: 600; height: 46px; border-radius: 10px; border: 1px solid var(--line); background: var(--white); outline: none; padding: 0 14px; margin-top: 4px; width: 100%; box-sizing: border-box;">
                    </label>
                    <div class="quick-cash-list" style="display: flex; gap: 6px; margin-top: 8px;">
                        <button type="button" class="quick-cash-btn" data-value="50000" style="flex: 1; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--white); font-size: 11px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.2s; outline: none; text-align: center; display: grid; place-items: center; padding: 0;">50.000</button>
                        <button type="button" class="quick-cash-btn" data-value="100000" style="flex: 1; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--white); font-size: 11px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.2s; outline: none; text-align: center; display: grid; place-items: center; padding: 0;">100.000</button>
                        <button type="button" class="quick-cash-btn" data-value="200000" style="flex: 1; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--white); font-size: 11px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.2s; outline: none; text-align: center; display: grid; place-items: center; padding: 0;">200.000</button>
                        <button type="button" class="quick-cash-btn" data-value="500000" style="flex: 1; height: 32px; border-radius: 8px; border: 1px solid var(--line); background: var(--white); font-size: 11px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.2s; outline: none; text-align: center; display: grid; place-items: center; padding: 0;">500.000</button>
                    </div>
                </div>
                ${transferMethods.map(method => `
                    <section class="checkout-qr-panel hidden" data-payment-panel="${escapeHtml(method.code)}">
	                        <div class="checkout-qr-image"><img src="${escapeHtml(method.qr_image_url)}" alt="Mã QR thanh toán"></div>
	                        <div class="checkout-qr-copy">
	                            <strong>${escapeHtml(method.name)}</strong>
	                            ${paymentQrInfoRows(method).length ? `<dl>${paymentQrInfoRows(method).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
                            ${method.extra_info ? `<p class="checkout-qr-note">${escapeHtml(method.extra_info)}</p>` : ''}
                        </div>
                    </section>
                `).join('')}
                
                <div class="summary-row total" style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 14px; padding-top: 12px; font-family: Georgia, serif; font-size: 18px; font-weight: 700;">
                    <span>Cần thanh toán</span>
                    <span id="checkout-total" style="color: #785943;">0</span>
                </div>
                
                <div class="summary-row" style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; font-weight: 600;">
                    <span style="color: var(--muted);">Tiền thừa trả khách</span>
                    <span id="change-due" style="font-weight: 700; color: var(--moss);">0</span>
                </div>
                
                ${releaseHtml}
            </div>
        </div>
    `;

    openModal({ title:`Thanh toán · ${order.order_number}`, body, footer:`<span class="muted" id="checkout-method-hint">${escapeHtml(paymentMethodHint(initialPaymentMethod))}</span><div><button class="button primary" id="confirm-checkout">Hoàn tất thanh toán</button></div>`, onReady(modal, close) {
        let paymentMethod = initialPaymentMethod;
        const calculate = () => {
            let total = 0;
            let isFullPayment = true;
            unpaid.forEach(item => {
                const isChecked = $(`[data-pay-check="${item.id}"]`, modal).checked;
                const qtyVal = Number($(`input[data-pay-qty="${item.id}"]`, modal).value || 0);
                if (isChecked) {
                    total += Number(item.unit_price) * qtyVal;
                    if (qtyVal < item.unpaid_quantity) {
                        isFullPayment = false;
                    }
                } else {
                    isFullPayment = false;
                }
            });
            $('#checkout-total', modal).textContent = money(total);
            $('#change-due', modal).textContent = paymentMethod !== 'cash' ? money(0) : money(Math.max(0, parseMoneyInput($('#cash-received', modal).value) - total));
            
            const releaseEl = $('#checkout-release', modal);
            if (releaseEl) {
                if (!isFullPayment) {
                    releaseEl.checked = false;
                    releaseEl.disabled = true;
                    releaseEl.parentElement.style.opacity = '0.5';
                    releaseEl.parentElement.style.cursor = 'not-allowed';
                } else {
                    releaseEl.disabled = false;
                    releaseEl.parentElement.style.opacity = '1';
                    releaseEl.parentElement.style.cursor = 'pointer';
                    if (releaseEl.dataset.wasDisabled === 'true') {
                        releaseEl.checked = true;
                    }
                }
                releaseEl.dataset.wasDisabled = !isFullPayment;
            }
            return total;
        };

        const updateLineTotal = (itemId, qty) => {
            const item = unpaid.find(x => x.id === itemId);
            if (item) {
                const total = Number(item.unit_price) * qty;
                $(`#pay-line-total-${itemId}`, modal).textContent = money(total);
            }
        };

        const handleCheckboxChange = (itemId, isChecked) => {
            const row = $(`input[data-pay-check="${itemId}"]`, modal).closest('.bill-line');
            const minusBtn = $(`[data-pay-minus="${itemId}"]`, row);
            const plusBtn = $(`[data-pay-plus="${itemId}"]`, row);
            const qtyVal = $(`#pay-qty-val-${itemId}`, row);
            const lineTotal = $(`#pay-line-total-${itemId}`, row);
            
            if (isChecked) {
                minusBtn.disabled = false;
                plusBtn.disabled = false;
                qtyVal.style.opacity = '1';
                lineTotal.style.opacity = '1';
                minusBtn.style.opacity = '1';
                plusBtn.style.opacity = '1';
            } else {
                minusBtn.disabled = true;
                plusBtn.disabled = true;
                qtyVal.style.opacity = '0.4';
                lineTotal.style.opacity = '0.4';
                minusBtn.style.opacity = '0.4';
                plusBtn.style.opacity = '0.4';
            }
        };

        modal.querySelectorAll('[data-pay-check]').forEach(cb => {
            cb.onchange = () => {
                const itemId = Number(cb.dataset.payCheck);
                handleCheckboxChange(itemId, cb.checked);
                calculate();
            };
        });

        modal.querySelectorAll('[data-pay-minus]').forEach(btn => {
            btn.onclick = () => {
                const itemId = Number(btn.dataset.payMinus);
                const input = $(`input[data-pay-qty="${itemId}"]`, modal);
                const span = $(`#pay-qty-val-${itemId}`, modal);
                const currentVal = Number(input.value);
                if (currentVal > 1) {
                    const newVal = currentVal - 1;
                    input.value = newVal;
                    span.textContent = newVal;
                    updateLineTotal(itemId, newVal);
                    calculate();
                }
            };
        });

        modal.querySelectorAll('[data-pay-plus]').forEach(btn => {
            btn.onclick = () => {
                const itemId = Number(btn.dataset.payPlus);
                const item = unpaid.find(x => x.id === itemId);
                const input = $(`input[data-pay-qty="${itemId}"]`, modal);
                const span = $(`#pay-qty-val-${itemId}`, modal);
                const currentVal = Number(input.value);
                if (currentVal < item.unpaid_quantity) {
                    const newVal = currentVal + 1;
                    input.value = newVal;
                    span.textContent = newVal;
                    updateLineTotal(itemId, newVal);
                    calculate();
                }
            };
        });

        const cashInput = $('#cash-received', modal);

        const syncPaymentMethod = method => {
            paymentMethod = method;
            modal.querySelectorAll('[data-payment-method]').forEach(button => {
                const active = button.dataset.paymentMethod === method;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            modal.querySelectorAll('[data-payment-panel]').forEach(panel => {
                panel.classList.toggle('hidden', panel.dataset.paymentPanel !== method);
            });
            const hint = $('#checkout-method-hint', modal);
            if (hint) hint.textContent = paymentMethodHint(method);
            calculate();
        };

        modal.querySelectorAll('[data-payment-method]').forEach(button => {
            button.onclick = () => syncPaymentMethod(button.dataset.paymentMethod);
        });

        modal.querySelectorAll('.quick-cash-btn').forEach(btn => {
            btn.onclick = () => {
                cashInput.value = formatMoneyInput(btn.dataset.value);
                calculate();
            };
        });

        cashInput.oninput = () => {
            cashInput.value = formatMoneyInput(cashInput.value);
            calculate();
        };
        syncPaymentMethod(paymentMethod);

        $('#confirm-checkout', modal).onclick = async () => {
            const items = unpaid.filter(item => $(`[data-pay-check="${item.id}"]`, modal).checked).map(item => ({ order_item_id:item.id, quantity:Number($(`input[data-pay-qty="${item.id}"]`, modal).value) }));
            const releaseEl = $('#checkout-release', modal);
            const release = releaseEl ? releaseEl.checked : false;
            try {
                const path = type === 'coffee' ? `/api/v1/coffee/orders/${order.id}/checkout` : `/api/v1/fishing/orders/${order.id}/checkout`;
                const result = await api(path, {
                    method:'POST',
                    body:{
                        version:order.version,
                        payment_method: paymentMethod,
                        ...(paymentMethod === 'cash' ? { cash_received:parseMoneyInput(cashInput.value) } : {}),
                        items,
                        release
                    }
                });
                toast(paymentMethod !== 'cash' ? `${result.message} Đã ghi nhận ${methodByCode.get(paymentMethod)?.name || 'chuyển khoản'}.` : `${result.message} Tiền thừa: ${money(result.payment.change_due)}`);
                close();
                renderPage(type);
            } catch(error) {
                toast(error.message, 'error');
                if (error.status === 409) {
                    close();
                    renderPage(type);
                }
            }
        };
    }});
}

async function renderFishing() {
    const data = await api('/api/v1/fishing/map'); const clock = new ServerClock(data.server_time);
    const mid = Math.ceil(data.spots.length / 2);
    const leftSpots = data.spots.slice(0, mid);
    const rightSpots = data.spots.slice(mid);
    const spotButton = (spot, side, row) => {
        const isPaid = spot.order && spot.order.status === 'paid';
        const stateClass = spot.state + (isPaid ? ' paid-ready' : '');
        const stateLabel = isPaid ? 'Đã thanh toán' : (spot.state === 'available' ? 'Sẵn sàng' : spot.state === 'disabled' ? 'Tạm nghỉ' : spot.state === 'expired' ? 'Hết giờ' : 'Đang câu');
        return `<button class="fishing-slot ${stateClass} side-${side}" style="grid-column:${side === 'left' ? 1 : 3};grid-row:${row}" data-spot="${spot.id}" ${spot.state === 'disabled' ? 'disabled' : ''}><span class="fishing-slot-number">${escapeHtml(spot.label)}</span><span><strong>${stateLabel}</strong><small ${spot.order ? `data-ends="${spot.order.fishing_session.ends_at}"` : ''}>${spot.state === 'available' ? 'Chạm để mở phiên' : spot.state === 'disabled' ? 'Chưa nhận khách' : duration(remaining(spot.order.fishing_session.ends_at, clock.now()))}</small></span><i></i></button>`;
    };
    $('#page-content').innerHTML = `<section class="fishing-map-shell"><div class="fishing-map-header"><span class="fishing-header-tip muted">Chạm chòi để mở hoặc xem phiên câu</span><div class="fishing-header-actions"><button class="button secondary small" id="btn-merge-mode">Gộp hóa đơn</button><button class="button primary small hidden" id="btn-merge-confirm" disabled>Xác nhận gộp (0)</button></div>${slotLegend(true)}</div><div class="fishing-lake-plan"><div class="lake-water"><div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU TRUNG TÂM</strong></div><svg class="fish-swim fish-1" viewBox="0 0 50 30" style="position:absolute; width:46px; height:28px; fill:rgba(255,255,255,0.15); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-2" viewBox="0 0 50 30" style="position:absolute; width:38px; height:23px; fill:rgba(255,255,255,0.12); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-3" viewBox="0 0 50 30" style="position:absolute; width:32px; height:19px; fill:rgba(255,255,255,0.14); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-4" viewBox="0 0 50 30" style="position:absolute; width:26px; height:16px; fill:rgba(255,255,255,0.1); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><div class="water-flora group-top-right" style="position:absolute; right:15%; top:15%; display:flex; gap:4px; pointer-events:none;"><svg viewBox="0 0 30 30" width="30" height="30" style="transform:rotate(15deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg><svg viewBox="0 0 30 30" width="20" height="20" style="transform:rotate(-45deg); margin-left:-10px;"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-bottom-left" style="position:absolute; left:12%; bottom:12%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="26" height="26" style="transform:rotate(-110deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg><svg viewBox="0 0 30 30" width="18" height="18" style="transform:rotate(30deg); margin-left:-8px;"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-top-left" style="position:absolute; left:16%; top:18%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="22" height="22" style="transform:rotate(65deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-bottom-right" style="position:absolute; right:18%; bottom:16%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="24" height="24" style="transform:rotate(-140deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div></div>${leftSpots.map((spot, index) => spotButton(spot, 'left', index + 1)).join('')}${rightSpots.map((spot, index) => spotButton(spot, 'right', rightSpots.length - index)).join('')}</div></section>`;
    $('#page-content').insertAdjacentHTML('afterbegin', `
        <section class="pos-stats fishing-pos-stats">
            <article class="pos-stat">
                <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M6 8c2-3 10-3 12 0M7 16h10M9 20h6"></path></svg></span>
                <div><small>Đang câu</small><strong>${number(data.stats.active_spots)} chòi</strong></div>
            </article>
            <article class="pos-stat">
                <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span>
                <div><small>Đã hết giờ</small><strong>${number(data.stats.expired_spots)} chòi</strong></div>
            </article>
            <article class="pos-stat">
                <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                <div><small>Hoàn tất hôm nay</small><strong>${number(data.stats.completed_today)} phiên</strong></div>
            </article>
        </section>`);
    $('.fishing-header-tip')?.remove();
    let isMergeMode = false;
    let selectedSpotIds = new Set();

    const mergeModeBtn = $('#btn-merge-mode');
    const mergeConfirmBtn = $('#btn-merge-confirm');

    mergeModeBtn.onclick = () => {
        isMergeMode = !isMergeMode;
        selectedSpotIds.clear();
        mergeModeBtn.classList.toggle('danger', isMergeMode);
        mergeModeBtn.textContent = isMergeMode ? 'Hủy gộp' : 'Gộp hóa đơn';
        mergeConfirmBtn.classList.toggle('hidden', !isMergeMode);
        mergeConfirmBtn.disabled = true;
        mergeConfirmBtn.textContent = 'Xác nhận gộp (0)';
        
        $$('[data-spot]').forEach(node => {
            node.classList.remove('selected-for-merge');
        });
    };

    mergeConfirmBtn.onclick = () => {
        const selectedSpots = data.spots.filter(s => selectedSpotIds.has(s.id));
        const defaultTarget = selectedSpots.find(s => s.state === 'occupied') || selectedSpots[0] || null;
        const targetButtons = selectedSpots.map(spot => fishingMergeTargetChipHtml(spot, defaultTarget?.id === spot.id)).join('');
        let targetSpotId = defaultTarget?.id || null;
        openModal({
            title: 'Gộp nhiều chòi câu',
            body: `<div class="merge-target-panel"><div class="merge-target-label">Chọn chòi chính nhận hóa đơn</div><div class="merge-target-grid">${targetButtons}</div></div><p class="merge-target-note">Toàn bộ tiền giờ câu và món nước của các chòi còn lại sẽ được gộp vào chòi chính. Các chòi nguồn sẽ kết thúc phiên câu và chuyển thành trống.</p>`,
            footer: `<span></span><div><button class="button primary" id="btn-bulk-merge-confirm" ${targetSpotId ? '' : 'disabled'}>Xác nhận</button></div>`,
            onReady(subModal, subClose) {
                subModal.querySelectorAll('[data-merge-target]').forEach(button => {
                    button.onclick = () => {
                        targetSpotId = Number(button.dataset.mergeTarget);
                        subModal.querySelectorAll('[data-merge-target]').forEach(item => {
                            const isSelected = item === button;
                            item.classList.toggle('is-selected', isSelected);
                            item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                        });
                        subModal.querySelector('#btn-bulk-merge-confirm').disabled = false;
                    };
                });
                subModal.querySelector('#btn-bulk-merge-confirm').onclick = async () => {
                    if (!targetSpotId) {
                        toast('Bạn chọn một chòi chính nhận hóa đơn nhé.', 'error');
                        return;
                    }
                    const sourceSpotIds = [...selectedSpotIds].filter(id => id !== targetSpotId);
                    if (!sourceSpotIds.length) {
                        toast('Bạn chọn thêm chòi nguồn khác với chòi chính nhé.', 'error');
                        return;
                    }
                    
                    subModal.querySelector('#btn-bulk-merge-confirm').disabled = true;
                    subModal.querySelector('#btn-bulk-merge-confirm').textContent = 'Đang gộp…';

                    try {
                        for (const srcId of sourceSpotIds) {
                            const srcSpot = data.spots.find(s => s.id === srcId);
                            if (srcSpot && srcSpot.order) {
                                await api(`/api/v1/fishing/orders/${srcSpot.order.id}/merge`, {
                                    method: 'POST',
                                    body: { version: srcSpot.order.version, target_spot_id: targetSpotId }
                                });
                            }
                        }
                        toast('Đã gộp hóa đơn thành công.');
                        subClose();
                        
                        const newData = await api('/api/v1/fishing/map');
                        await renderFishing();
                        
                        const updatedTargetSpot = newData.spots.find(s => s.id === targetSpotId);
                        if (updatedTargetSpot) {
                            openFishing(updatedTargetSpot, newData.menu, newData);
                        }
                    } catch (error) {
                        toast(error.message, 'error');
                        subModal.querySelector('#btn-bulk-merge-confirm').disabled = false;
                        subModal.querySelector('#btn-bulk-merge-confirm').textContent = 'Xác nhận';
                    }
                };
            }
        });
    };

    const tick = () => $$('[data-ends]').forEach(node => { const ms = remaining(node.dataset.ends, clock.now()); node.textContent = ms ? duration(ms) : 'Đã hết giờ'; node.closest('.fishing-slot')?.classList.toggle('expired', ms === 0); }); activeTimer = setInterval(tick, 1000);
    
    $$('[data-spot]').forEach(node => node.onclick = () => {
        const spotId = Number(node.dataset.spot);
        const spot = data.spots.find(s => s.id === spotId);
        
        if (isMergeMode) {
            if (!['occupied', 'expired'].includes(spot.state)) {
                toast('Chỉ gộp được các chòi đang có khách hoặc hết giờ.', 'error');
                return;
            }
            if (selectedSpotIds.has(spotId)) {
                selectedSpotIds.delete(spotId);
                node.classList.remove('selected-for-merge');
            } else {
                selectedSpotIds.add(spotId);
                node.classList.add('selected-for-merge');
            }
            mergeConfirmBtn.disabled = selectedSpotIds.size < 2;
            mergeConfirmBtn.textContent = `Xác nhận gộp (${selectedSpotIds.size})`;
        } else {
            openFishing(spot, data.menu, data);
        }
    });
    const sidebarTotal = $('#sidebar-total');
    if (sidebarTotal) sidebarTotal.textContent = `${number(data.spots.filter(item => ['occupied','expired'].includes(item.state)).length)} vị trí đang dùng`;
    tick();
}

async function openFishing(spot, menu, fishingConfig = {}) {
    if (!spot.order) {
        if (!await confirmModal(`Bắt đầu · ${escapeHtml(spot.label)}`, `Mở phiên câu 4 giờ với giá ${money(200000)}? Đồng hồ sẽ bắt đầu ngay sau khi xác nhận.`, 'Bắt đầu phiên')) return;
        try { const result = await api(`/api/v1/fishing/spots/${spot.id}/start`, { method:'POST' }); toast(result.message); renderFishing(); } catch(error) { toast(error.message, 'error'); }
        return;
    }

    let currentOrder = spot.order;
    const session = currentOrder.fishing_session;
    const sessionDefaults = currentOrder.items.find(item => item.line_type === 'fishing_session');
    const configuredSessionMinutes = Number(fishingConfig.session_minutes || 240);
    const configuredSessionPrice = Number(fishingConfig.session_price || sessionDefaults?.unit_price || 200000);
    const paymentSettings = fishingConfig.payment_settings || {};
    const availableSpots = Array.isArray(fishingConfig.spots) ? fishingConfig.spots : [];
    let cart = new Cart(currentOrder.items.filter(item => item.menu_item_id).map(item => ({ menu_item_id:item.menu_item_id, name:item.name, price:Number(item.unit_price), quantity:item.quantity, note:item.note || '' })));
    let activeCategory = 'Tất cả';
    const orderedMenu = orderedPosMenu(menu);
    const categories = posMenuCategories(orderedMenu);

    const modalBody = `
        <div class="modal-pos-layout" style="display:grid; grid-template-columns: 1.25fr 0.75fr; gap: 16px; margin: -23px; height: 80vh; min-height: 550px; background: var(--paper);">
            <main class="pos-menu-section" style="padding: 20px; overflow-y: auto; background: var(--white); border-radius: 22px 0 0 22px; display: flex; flex-direction: column; height: 100%;">
                <div class="pos-section-head" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;">
                    <div class="category-tabs" style="margin-bottom: 0; display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; flex: 1; min-width: 0;">
                        ${categories.map(category => `<button class="${category === activeCategory ? 'active' : ''}" data-modal-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}
                    </div>
                    <label class="pos-search" style="width: 240px; position: relative; flex-shrink: 0;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); z-index: 1; display: flex; align-items: center;">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input id="modal-product-search" type="search" placeholder="Tìm tên món…" style="height: 38px; padding: 8px 12px 8px 34px; border-radius: 10px; font-size: 11px; width: 100%; border: 1px solid var(--line); outline: none;">
                    </label>
                </div>
                <div class="pos-product-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-content: start;">
                    ${orderedMenu.map((item, index) => `
                        <article class="pos-product-card" data-modal-product-card data-name="${escapeHtml(item.name.toLowerCase())}" data-category="${escapeHtml(item.category)}">
                            <button class="product-main" data-modal-product="${item.id}">
                                ${productMedia(item, index)}
                                <small>${escapeHtml(item.category)}</small>
                                <strong>${escapeHtml(item.name)}</strong>
                                <b>${escapeHtml(formatDisplayPrice(item.display_price) || money(item.price))}</b>
                                <em>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </em>
                            </button>
                        </article>`).join('')}
                </div>
            </main>
            <aside class="modal-order-dock-aside" style="border: 0; border-radius: 0 22px 22px 0; height: 100%; box-shadow: none; background: #fffdf9; display: flex; flex-direction: column;">
                <div id="modal-order-panel" style="height: 100%; display: flex; flex-direction: column;"></div>
            </aside>
        </div>
    `;

    openModal({
        title: `${escapeHtml(spot.label)} · ${session.status === 'expired' ? 'Đã hết giờ' : 'Đang câu'}`,
        body: modalBody,
        wide: true,
        onReady(modal, closeModal) {
            const renderModalBill = () => {
                const panel = modal.querySelector('#modal-order-panel');
                const lines = cart.values();
                
                const sessionItem = currentOrder.items.find(item => item.line_type === 'fishing_session');
                const sessionPrice = sessionItem ? Number(sessionItem.unit_price) : 200000;
                const sessionQty = sessionItem ? Number(sessionItem.quantity) : Number(session.blocks_count);
                const mainSessionTotal = sessionPrice * sessionQty;
                const mainSessionPaid = sessionItem ? Number(sessionItem.paid_quantity) : 0;
                const mainSessionUnpaid = sessionQty - mainSessionPaid;

                const mergedSessionItems = currentOrder.items.filter(item => item.line_type === 'merged_session');
                const mergedSessionsTotal = mergedSessionItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);

                const sessionTotal = mainSessionTotal + mergedSessionsTotal;
                const totalBill = sessionTotal + cart.total();
                const totalPaid = orderCompletedPaymentTotal(currentOrder);

                const unpaidHtmls = [];
                const paidHtmls = [];

                if (mainSessionUnpaid > 0) {
                    unpaidHtmls.push(`
                        <div class="order-line unpaid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                            <div>
                                <strong style="font-family: Georgia, serif; font-size: 13px;">${escapeHtml(sessionItem?.name || 'Phiên câu 4 giờ')}</strong>
                                <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(sessionPrice)} / phiên</small>
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionUnpaid}</b></div>
                            <b style="align-self: center; font-size: 10px; color: #785943; text-align:right;">${money(sessionPrice * mainSessionUnpaid)}</b>
                        </div>
                    `);
                }
                if (mainSessionPaid > 0) {
                    paidHtmls.push(`
                        <div class="order-line paid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                            <div>
                                <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${escapeHtml(sessionItem?.name || 'Phiên câu 4 giờ')} <span style="font-size:9px; background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; margin-left:4px; font-family:var(--font-sans); font-weight:600;">✓ Đã trả</span></strong>
                                <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(sessionPrice)} / phiên</small>
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionPaid}</b></div>
                            <b style="align-self: center; font-size: 10px; color: #2e5a32; text-align:right;">${money(sessionPrice * mainSessionPaid)}</b>
                        </div>
                    `);
                }

                mergedSessionItems.forEach(mSession => {
                    const mPaid = Number(mSession.paid_quantity) || 0;
                    const mUnpaid = Number(mSession.quantity) - mPaid;
                    if (mUnpaid > 0) {
                        unpaidHtmls.push(`
                            <div class="order-line unpaid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                                <div>
                                    <strong style="font-family: Georgia, serif; font-size: 13px;">${escapeHtml(mSession.name)}</strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(mSession.unit_price)} / phiên</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${mUnpaid}</b></div>
                                <b style="align-self: center; font-size: 10px; color: #785943; text-align:right;">${money(Number(mSession.unit_price) * mUnpaid)}</b>
                            </div>
                        `);
                    }
                    if (mPaid > 0) {
                        paidHtmls.push(`
                            <div class="order-line paid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                                <div>
                                    <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${escapeHtml(mSession.name)} <span style="font-size:9px; background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; margin-left:4px; font-family:var(--font-sans); font-weight:600;">✓ Đã trả</span></strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(mSession.unit_price)} / phiên</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${mPaid}</b></div>
                                <b style="align-self: center; font-size: 10px; color: #2e5a32; text-align:right;">${money(Number(mSession.unit_price) * mPaid)}</b>
                            </div>
                        `);
                    }
                });

                lines.forEach(line => {
                    const paidQty = currentOrder.items.find(item => item.menu_item_id === line.menu_item_id && Number(item.unit_price) === line.price)?.paid_quantity || 0;
                    const unpaidQty = line.quantity - paidQty;
                    if (unpaidQty > 0) {
                        unpaidHtmls.push(`
                            <div class="order-line unpaid-item" style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                                <div class="order-line-title" style="grid-column: 1 / -1;">
                                    <strong style="font-family: Georgia, serif; font-size: 13px;">${escapeHtml(line.name)}</strong>
                                    ${orderLineUnitPriceHtml(line, menu)}
                                </div>
                                <div class="order-line-note-row">
                                    <input type="text" data-modal-note="${line.menu_item_id}" data-modal-price="${line.price}" value="${escapeHtml(line.note || '')}" placeholder="Ghi chú (ít đá, ngọt vừa...)" style="height: 28px; padding: 4px 8px; border-radius: 8px; font-size: 10px; border: 1px solid var(--line); background: #fafaf9; width: 100%; outline: none; margin-top: 2px;">
                                    <div class="quantity" style="display: flex; align-items: center; gap: 4px;">
                                        <button data-modal-minus="${line.menu_item_id}" data-modal-price="${line.price}" style="width: 30px; height: 30px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                        <b style="font-size: 12px; min-width: 16px; text-align: center;">${unpaidQty}</b>
                                        <button data-modal-plus="${line.menu_item_id}" data-modal-price="${line.price}" style="width: 30px; height: 30px; border: 0; border-radius: 7px; background: var(--paper); cursor: pointer; display: grid; place-items: center; padding:0;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                    ${orderLineTotalHtml(line, unpaidQty, menu)}
                                </div>
                            </div>
                        `);
                    }
                    if (paidQty > 0) {
                        paidHtmls.push(`
                            <div class="order-line paid-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                                <div class="order-line-title" style="grid-column: 1 / -1;">
                                    <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${escapeHtml(line.name)} <span style="font-size:9px; background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; margin-left:4px; font-family:var(--font-sans); font-weight:600;">✓ Đã trả</span></strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(line.price)} / món</small>
                                </div>
                                <div class="order-line-paid-row">
                                    <span class="order-line-paid-note ${line.note ? '' : 'is-empty'}">${line.note ? escapeHtml(line.note) : ''}</span>
                                    <div class="quantity" style="display: flex; align-items: center; gap: 4px;">
                                        <b style="font-size: 12px; min-width: 16px; text-align: center; color: #155724;">× ${paidQty}</b>
                                    </div>
                                    <b style="align-self: center; font-size: 10px; color: #2e5a32; text-align:right;">${money(line.price * paidQty)}</b>
                                </div>
                            </div>
                        `);
                    }
                });

                let linesHtml = '';
                if (unpaidHtmls.length) {
                    linesHtml += `<div class="modal-lines-section-header unpaid-header" style="font-size: 9px; font-weight: 750; color: #856404; background: #fff3cd; padding: 4px 8px; border-radius: 6px; margin: 4px 0 8px; letter-spacing: 0.05em;">MÓN CHƯA THANH TOÁN</div>`;
                    linesHtml += unpaidHtmls.join('');
                }
                if (paidHtmls.length) {
                    linesHtml += `<div class="modal-lines-section-header paid-header" style="font-size: 9px; font-weight: 750; color: #155724; background: #d4edda; padding: 4px 8px; border-radius: 6px; margin: 12px 0 8px; letter-spacing: 0.05em;">MÓN ĐÃ THANH TOÁN</div>`;
                    linesHtml += paidHtmls.join('');
                }
                if (!unpaidHtmls.length && !paidHtmls.length) {
                    linesHtml = `
                        <div class="order-empty" style="height: 100%; min-height: 240px; display: grid; place-content: center; text-align: center; color: var(--muted);">
                            <span style="font-size: 28px; display: block; margin-bottom: 8px;">
                                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 10px; opacity: 0.6;"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                            </span>
                            <strong style="color: var(--ink); font-family: Georgia, serif; font-size: 15px; display: block; margin-top: 8px;">Đơn hàng đang trống</strong>
                            <p style="font-size: 9px; margin: 4px 0;">Chạm vào món ở bên trái để bắt đầu.</p>
                        </div>`;
                }

                panel.innerHTML = `
                    <div class="order-dock-head">
                        <div class="order-head-main">
                            <div class="order-title-block">
                                <p class="eyebrow">PHIẾU BÁN HÀNG</p>
                                <h2>Đơn hiện tại</h2>
                            </div>
                            <div class="order-head-actions">
                                ${orderBadgeHtml(currentOrder)}
                            </div>
                        </div>
                        <div class="order-session-card" aria-label="Thông tin phiên câu">
                            <span class="order-session-icon">${orderStackIcon()}</span>
                            <span class="order-session-title"><small>Phiên câu</small><strong>${escapeHtml(spot.label)}</strong></span>
                            <span class="order-session-state ${session.status === 'expired' ? 'is-expired' : ''}">${session.status === 'expired' ? 'Hết giờ' : 'Đang câu'}</span>
                            <span class="order-session-metrics">
                                <span><small>Bắt đầu</small><strong>${dateTime(session.started_at)}</strong></span>
                                <span><small>Kết thúc</small><strong>${dateTime(session.ends_at)}</strong></span>
                                <span><small>Số phiên</small><strong>${number(sessionQty)} phiên</strong></span>
                            </span>
                        </div>
                    </div>

                    <div class="order-lines" style="flex: 1; min-height: 160px; max-height: none !important; overflow-y: auto; padding: 6px 14px;">
                        ${linesHtml}
                    </div>
                    
                    <div class="order-dock-footer" style="padding: 13px 14px 14px; border-top: 1px solid var(--line); background: #fff;">
                        <div class="summary-row" style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                            <span>Tạm tính nước</span>
                            <strong>${money(cart.total())}</strong>
                        </div>
                        <div class="summary-row" style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                            <span>Tiền giờ câu</span>
                            <strong>${money(sessionTotal)}</strong>
                        </div>
                        <div class="summary-row" style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 4px; padding: 6px 0 2px; font-size: 10px; font-weight: 600;">
                            <span>Tổng cộng</span>
                            <strong>${money(totalBill)}</strong>
                        </div>
                        ${totalPaid > 0 ? `
                        <div class="summary-row" style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px; color: var(--moss);">
                            <span>Đã trả trước</span>
                            <strong>${money(totalPaid)}</strong>
                        </div>
                        ` : ''}
                        <div class="summary-row total" style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 6px; padding-top: 10px; font-family: Georgia, serif; font-size: 16px; font-weight: 700;">
                            <span>${totalPaid > 0 ? 'Còn lại cần trả' : 'Khách cần trả'}</span>
                            <strong>${money(Math.max(0, totalBill - totalPaid))}</strong>
                        </div>
                        <div class="order-actions" style="display: grid; ${currentOrder && currentOrder.status === 'paid' ? 'grid-template-columns: 1fr 1.35fr;' : 'grid-template-columns: 0.85fr 1fr 1fr;'} gap: 7px; margin-top: 10px;">
                            ${currentOrder && currentOrder.status === 'paid' ? `
                                <button class="button secondary" id="extend-session" style="padding: 11px 5px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                    Gia hạn
                                </button>
                                <button class="button primary" id="modal-release-spot" style="display: grid; place-items: center; gap: 2px; padding: 9px 8px; font-size: 10px; line-height: 1.15; border-radius: 10px; min-height: auto;">
                                    <span>Trả chòi & Giải phóng</span>
                                    <small style="font-size: 8px; font-weight: 750; line-height: 1.1; opacity: .86;">Khách rời đi</small>
                                </button>
                            ` : `
                                <button class="button secondary" id="extend-session" style="padding: 11px 5px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                    Gia hạn
                                </button>
                                <button class="button secondary" id="modal-save-order" style="padding: 11px 5px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                    Lưu lại
                                </button>
                                <button class="button primary" id="modal-checkout-order" style="padding: 11px 5px; font-size: 10px; border-radius: 10px; min-height: auto;">
                                    Thanh toán
                                </button>
                            `}
                        </div>
                    </div>`;

                modal.querySelectorAll('[data-modal-minus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalMinus), Number(button.dataset.modalPrice), -1));
                modal.querySelectorAll('[data-modal-plus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalPlus), Number(button.dataset.modalPrice), 1));

                const saveBtn = modal.querySelector('#modal-save-order');
                if (saveBtn) {
                    saveBtn.onclick = async () => {
                        try {
                            const orderRes = await persistOrder();
                            toast('Hóa đơn đã được cập nhật.');
                            closeModal();
                            await renderFishing();
                        } catch (error) {
                            toast(error.message, 'error');
                            if (error.status === 409) {
                                closeModal();
                                await renderFishing();
                            }
                        }
                    };
                }

                const extendBtn = modal.querySelector('#extend-session');
                if (extendBtn) {
                    extendBtn.onclick = async () => {
                        try {
                            const sessionMinutes = configuredSessionMinutes;
                            const sessionPrice = configuredSessionPrice;
                            const durationText = blocks => {
                                const minutes = sessionMinutes * blocks;
                                return minutes % 60 === 0 ? `${number(minutes / 60)} giờ` : `${number(minutes)} phút`;
                            };
                            const extendOptions = [1, 2, 3, 4].map(blocks => `
                                <button type="button" class="merge-target-chip extend-session-chip ${blocks === 1 ? 'is-selected' : ''}" data-extend-blocks="${blocks}" aria-pressed="${blocks === 1 ? 'true' : 'false'}">
                                    <span class="merge-target-main"><strong>Thêm ${number(blocks)} phiên</strong><em>${durationText(blocks)}</em></span>
                                    <small>${money(sessionPrice * blocks)}</small>
                                </button>
                            `).join('');
                            const blocks = Number(await new Promise((resolve) => {
                                let selectedBlocks = 1;
                                openModal({
                                    title: 'Gia hạn phiên câu',
                                    body: `<div class="merge-target-panel extend-session-panel"><div class="merge-target-label">Chọn số phiên gia hạn</div><div class="merge-target-grid extend-session-grid">${extendOptions}</div></div><p class="merge-target-note extend-session-note">Mỗi phiên câu gồm ${durationText(1)}. Tiền phiên sẽ được cộng vào phiếu bán hàng hiện tại.</p>`,
                                    footer: `<span></span><div><button class="button primary" id="confirm-extend-btn">Xác nhận</button></div>`,
                                    onReady(subModal, subClose) {
                                        subModal.querySelectorAll('[data-extend-blocks]').forEach(button => {
                                            button.onclick = () => {
                                                selectedBlocks = Number(button.dataset.extendBlocks);
                                                subModal.querySelectorAll('[data-extend-blocks]').forEach(item => {
                                                    const isSelected = item === button;
                                                    item.classList.toggle('is-selected', isSelected);
                                                    item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                                                });
                                            };
                                        });
                                        subModal.querySelector('#confirm-extend-btn').onclick = () => {
                                            subClose();
                                            resolve(selectedBlocks);
                                        };
                                    }
                                });
                            }));
                            if (!blocks) return;
                            const result = await api(`/api/v1/fishing/orders/${currentOrder.id}/extend`, {
                                method: 'POST',
                                body: { version: currentOrder.version, blocks }
                            });
                            toast(result.message);
                            closeModal();
                            await renderFishing();
                        } catch (error) {
                            toast(error.message, 'error');
                            if (error.status === 409) {
                                closeModal();
                                await renderFishing();
                            }
                        }
                    };
                }

                const checkoutBtn = modal.querySelector('#modal-checkout-order');
                if (checkoutBtn) {
                    checkoutBtn.onclick = async () => {
                        try {
                            const orderRes = await persistOrder();
                            closeModal();
                            openCheckout(orderRes, 'fishing', paymentSettings);
                        } catch (error) {
                            toast(error.message, 'error');
                            if (error.status === 409) {
                                closeModal();
                                await renderFishing();
                            }
                        }
                    };
                }

                const releaseBtn = modal.querySelector('#modal-release-spot');
                if (releaseBtn) {
                    releaseBtn.onclick = async () => {
                        try {
                            await api(`/api/v1/fishing/orders/${currentOrder.id}/release`, {
                                method: 'POST',
                                body: { version: currentOrder.version }
                            });
                            toast('Vị trí đã được giải phóng.');
                            closeModal();
                            await renderFishing();
                        } catch (error) {
                            toast(error.message, 'error');
                            if (error.status === 409) {
                                closeModal();
                                await renderFishing();
                            }
                        }
                    };
                }

                if (currentOrder) {
                    const mergeBtn = modal.querySelector('#modal-merge-order');
                    if (mergeBtn) {
                        mergeBtn.onclick = () => {
                            const otherOccupiedSpots = availableSpots.filter(s => ['occupied', 'expired'].includes(s.state) && s.id !== spot.id);
                            const defaultTarget = otherOccupiedSpots.find(s => s.state === 'occupied') || otherOccupiedSpots[0] || null;
                            const targetButtons = otherOccupiedSpots.map(targetSpot => fishingMergeTargetChipHtml(targetSpot, defaultTarget?.id === targetSpot.id)).join('');
                            if (!defaultTarget) {
                                toast('Không có chòi nào khác đang hoạt động để gộp.', 'error');
                                return;
                            }
                            let targetId = defaultTarget.id;
                            openModal({
                                title: 'Gộp hóa đơn',
                                body: `<div class="merge-target-panel"><div class="merge-target-label">Chọn chòi mục tiêu để nhận hóa đơn</div><div class="merge-target-grid">${targetButtons}</div></div><p class="merge-target-note">Phiên câu của chòi hiện tại sẽ kết thúc. Toàn bộ tiền giờ và món nước sẽ gộp vào chòi mục tiêu.</p>`,
                                footer: `<span></span><div><button class="button primary" id="confirm-merge-btn">Xác nhận gộp</button></div>`,
                                onReady(subModal, subClose) {
                                    subModal.querySelectorAll('[data-merge-target]').forEach(button => {
                                        button.onclick = () => {
                                            targetId = Number(button.dataset.mergeTarget);
                                            subModal.querySelectorAll('[data-merge-target]').forEach(item => {
                                                const isSelected = item === button;
                                                item.classList.toggle('is-selected', isSelected);
                                                item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                                            });
                                        };
                                    });
                                    subModal.querySelector('#confirm-merge-btn').onclick = async () => {
                                        try {
                                            const result = await api(`/api/v1/fishing/orders/${currentOrder.id}/merge`, {
                                                method: 'POST',
                                                body: { version: currentOrder.version, target_spot_id: targetId }
                                            });
                                            toast(result.message);
                                            subClose();
                                            closeModal();
                                            await renderFishing();
                                        } catch (error) {
                                            toast(error.message, 'error');
                                            if (error.status === 409) {
                                                subClose();
                                                closeModal();
                                                await renderFishing();
                                            }
                                        }
                                    };
                                }
                            });
                        };
                    }
                }
            };

            const changeQuantity = (id, price, delta) => {
                const item = menu.find(product => product.id === id) || cart.values().find(product => product.menu_item_id === id && Number(product.price) === price);
                const paidQty = currentOrder.items.find(item => item.menu_item_id === id && Number(item.unit_price) === price)?.paid_quantity || 0;
                const newQty = Math.max(paidQty, cart.quantity(id, price) + delta);
                cart.set({ id, name:item.name, price:price }, newQty, price);
                renderModalBill();
            };

            const persistOrder = async () => {
                if (hasMissingVariablePrice(cart, menu)) throw new Error('Bạn nhập giá cho món giá biến động trước khi lưu đơn nhé.');
                return (await api(`/api/v1/fishing/orders/${currentOrder.id}`, { method:'PUT', body:{ version:currentOrder.version, items:cart.payload() } })).order;
            };

            modal.querySelectorAll('[data-modal-product]').forEach(button => button.onclick = async () => {
                const prodId = Number(button.dataset.modalProduct);
                const matchedItem = menu.find(item => item.id === prodId);
                if (matchedItem) {
                    if (Number(matchedItem.price) === 0) {
                        const customPrice = await requestVariablePrice(modal, matchedItem);
                        if (!customPrice) return;
                        cart.add(matchedItem, customPrice);
                    } else {
                        cart.add(matchedItem);
                    }
                    renderModalBill();
                }
            });

            const filterModalProducts = () => {
                const query = modal.querySelector('#modal-product-search').value.trim().toLowerCase();
                modal.querySelectorAll('[data-modal-product-card]').forEach(card => {
                    const isHidden = !card.dataset.name.includes(query) || (activeCategory !== 'Tất cả' && card.dataset.category !== activeCategory);
                    card.hidden = isHidden;
                    card.classList.toggle('hidden', isHidden);
                });
            };

            modal.querySelectorAll('[data-modal-category]').forEach(button => button.onclick = () => {
                activeCategory = button.dataset.modalCategory;
                modal.querySelectorAll('[data-modal-category]').forEach(item => item.classList.toggle('active', item === button));
                filterModalProducts();
            });

            modal.querySelector('#modal-product-search').oninput = filterModalProducts;

            modal.addEventListener('input', event => {
                const noteInput = event.target.closest('[data-modal-note]');
                if (noteInput) {
                    const menuId = Number(noteInput.dataset.modalNote);
                    const price = Number(noteInput.dataset.modalPrice);
                    cart.setNote(menuId, noteInput.value, price);
                }
            });

            renderModalBill();
        }
    });
}

function paginationMarkup(meta, label = 'dữ liệu') {
    const current = Number(meta?.current_page || 1);
    const last = Number(meta?.last_page || 1);
    const total = Number(meta?.total || 0);
    const perPage = Number(meta?.per_page || total || 1);
    if (total <= 0) return '';

    let startPage, endPage;
    if (last <= 3) {
        startPage = 1;
        endPage = last;
    } else {
        if (current === 1) {
            startPage = 1;
            endPage = 3;
        } else if (current === last) {
            startPage = last - 2;
            endPage = last;
        } else {
            startPage = current - 1;
            endPage = current + 1;
        }
    }

    let pageButtons = '';
    for (let i = startPage; i <= endPage; i++) {
        pageButtons += `<button type="button" class="pagination-page ${i === current ? 'active' : ''}" data-pagination-page="${i}" ${i === current ? 'aria-current="page"' : ''}>${i}</button>`;
    }

    const from = total ? (current - 1) * perPage + 1 : 0;
    const to = Math.min(current * perPage, total);

    return `<nav class="admin-pagination" aria-label="Phân trang ${escapeHtml(label)}">
        <span class="pagination-summary">${number(from)}–${number(to)} / ${number(total)}</span>
        <div class="pagination-controls">
            <button type="button" class="pagination-nav" data-pagination-page="1" ${current <= 1 ? 'disabled' : ''} aria-label="Trang đầu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 18-6-6 6-6M11 18l-6-6 6-6"></path></svg></button>
            <button type="button" class="pagination-nav" data-pagination-page="${current - 1}" ${current <= 1 ? 'disabled' : ''} aria-label="Trang trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg></button>
            ${pageButtons}
            <button type="button" class="pagination-nav" data-pagination-page="${current + 1}" ${current >= last ? 'disabled' : ''} aria-label="Trang sau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>
            <button type="button" class="pagination-nav" data-pagination-page="${last}" ${current >= last ? 'disabled' : ''} aria-label="Trang cuối"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 18 6-6-6-6M13 18l6-6-6-6"></path></svg></button>
        </div>
    </nav>`;
}

function bindPagination(root, callback) {
    $$('[data-pagination-page]', root).forEach(button => button.onclick = () => {
        if (!button.disabled) callback(Number(button.dataset.paginationPage));
    });
}

function menuSearchIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg>';
}

function adminMenuFilterMarkup(categories = []) {
    const categoryOptions = [
        { value: '', label: 'Tất cả' },
        ...categories.map(category => ({ value: category.name, label: category.name }))
    ];

    return `<div class="pos-section-head admin-menu-toolbar">
        <div class="category-tabs admin-menu-category-tabs" aria-label="Nhóm món">
            ${categoryOptions.map(option => {
                const active = adminMenuFilters.category === option.value;
                return `<button type="button" class="${active ? 'active' : ''}" data-menu-category-filter="${escapeHtml(option.value)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(option.label)}</button>`;
            }).join('')}
        </div>
        <label class="pos-search admin-menu-search" aria-label="Tìm tên món">
            <span>
                ${menuSearchIcon()}
            </span>
            <input id="admin-menu-search" type="search" value="${escapeHtml(adminMenuFilters.q)}" placeholder="Tìm tên món..." autocomplete="off">
        </label>
    </div>`;
}

function menuApiPath(page) {
    const params = new URLSearchParams({ page: String(page) });
    if (adminMenuFilters.category) params.set('category', adminMenuFilters.category);
    if (adminMenuFilters.q) params.set('q', adminMenuFilters.q);

    return `/api/v1/admin/menu?${params.toString()}`;
}

function bindAdminMenuFilters() {
    $$('[data-menu-category-filter]').forEach(button => button.onclick = () => {
        const category = button.dataset.menuCategoryFilter || '';
        if (adminMenuFilters.category === category) return;
        adminMenuFilters = { ...adminMenuFilters, category };
        adminMenuPage = 1;
        renderMenuAdmin(1);
    });

    const search = $('#admin-menu-search');
    if (!search) return;

    const applySearch = (focusSearch = true) => {
        const query = search.value.trim();
        if (adminMenuFilters.q === query) return;
        adminMenuFilters = { ...adminMenuFilters, q: query };
        adminMenuPage = 1;
        renderMenuAdmin(1, { focusSearch });
    };

    search.addEventListener('input', () => {
        window.clearTimeout(adminMenuSearchTimer);
        adminMenuSearchTimer = window.setTimeout(() => applySearch(true), 260);
    });

    search.addEventListener('search', () => {
        window.clearTimeout(adminMenuSearchTimer);
        applySearch(true);
    });

    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        window.clearTimeout(adminMenuSearchTimer);
        applySearch(true);
    });
}

function ordersSignature(result) {
    return JSON.stringify({
        meta: result.meta,
        rows: (result.data || []).map(order => [
            order.id,
            order.order_number,
            order.service_type,
            order.status,
            order.version,
            order.total,
            order.resource?.label || '',
            order.opened_at,
            order.completed_at || ''
        ])
    });
}

function stopOrderPolling() {
    if (orderPollingTimer) window.clearInterval(orderPollingTimer);
    orderPollingTimer = null;
    orderPollSignature = '';
    isPollingOrders = false;
}

function orderServiceIcon(type = '') {
    if (type === 'coffee') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path></svg>';
    }
    if (type === 'fishing') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path></svg>';
    }

    return orderStackIcon();
}

function orderStatusFilterIcon(status = '') {
    const paths = {
        open: '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path>',
        partially_paid: '<path d="M5 12a7 7 0 1 1 7 7"></path><path d="M12 5v14"></path><path d="M8 10h8M8 14h5"></path>',
        paid: '<circle cx="12" cy="12" r="8"></circle><path d="m8.5 12.5 2.3 2.3 4.8-5.3"></path>',
        payment_exception: '<path d="M12 4 21 20H3L12 4Z"></path><path d="M12 9v5M12 17h.01"></path>'
    };

    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[status] || '<path d="M5 7h14M5 12h14M5 17h14"></path>'}</svg>`;
}

function adminOrderFilterMarkup() {
    const statusOptions = [
        { value: '', label: 'Tất cả' },
        { value: 'open', label: 'Đang mở' },
        { value: 'partially_paid', label: 'Trả một phần' },
        { value: 'paid', label: 'Hoàn tất' },
        { value: 'payment_exception', label: 'Cần đối soát' }
    ];

    return `<div class="pos-section-head admin-order-filter-bar">
        <div class="category-tabs admin-order-status-tabs" aria-label="Trạng thái đơn">
            ${statusOptions.map(option => {
                const active = adminOrderFilters.status === option.value;
                return `<button type="button" class="${active ? 'active' : ''}" data-order-filter="status" data-order-filter-value="${escapeHtml(option.value)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(option.label)}</button>`;
            }).join('')}
        </div>
        <label class="pos-search admin-menu-search admin-order-search" aria-label="Tìm đơn hàng">
            <span>${menuSearchIcon()}</span>
            <input id="admin-order-search" type="search" value="${escapeHtml(adminOrderFilters.q)}" placeholder="Tìm mã đơn, vị trí..." autocomplete="off">
        </label>
    </div>`;
}

function adminOrderServiceFilterMarkup() {
    const serviceOptions = [
        { value: '', label: 'Tất cả', icon: orderServiceIcon() },
        { value: 'coffee', label: 'Cà phê', icon: orderServiceIcon('coffee') },
        { value: 'fishing', label: 'Câu cá', icon: orderServiceIcon('fishing') }
    ];

    return `<div class="admin-map-toolbar admin-order-service-tabs" role="tablist" aria-label="Mô hình đơn hàng">
        ${serviceOptions.map(option => {
            const active = adminOrderFilters.service_type === option.value;
            return `<button type="button" class="admin-map-tab ${active ? 'active' : ''}" data-order-filter="service_type" data-order-filter-value="${escapeHtml(option.value)}" aria-pressed="${active ? 'true' : 'false'}">${option.icon}<span>${escapeHtml(option.label)}</span></button>`;
        }).join('')}
    </div>`;
}

function bindAdminOrderFilters() {
    $$('[data-order-filter]').forEach(button => button.onclick = () => {
        const field = button.dataset.orderFilter;
        const value = button.dataset.orderFilterValue || '';
        if (!Object.prototype.hasOwnProperty.call(adminOrderFilters, field) || adminOrderFilters[field] === value) return;
        adminOrderFilters = { ...adminOrderFilters, [field]: value };
        adminOrdersPage = 1;
        orderPollSignature = '';
        renderOrders(1);
    });

    const search = $('#admin-order-search');
    if (!search) return;

    const applySearch = (focusSearch = true) => {
        const query = search.value.trim();
        if (adminOrderFilters.q === query) return;
        adminOrderFilters = { ...adminOrderFilters, q: query };
        adminOrdersPage = 1;
        orderPollSignature = '';
        renderOrders(1, { focusSearch });
    };

    search.addEventListener('input', () => {
        window.clearTimeout(adminOrderSearchTimer);
        adminOrderSearchTimer = window.setTimeout(() => applySearch(true), 260);
    });

    search.addEventListener('search', () => {
        window.clearTimeout(adminOrderSearchTimer);
        applySearch(true);
    });

    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        window.clearTimeout(adminOrderSearchTimer);
        applySearch(true);
    });
}

function ordersApiPath(page, admin) {
    const params = new URLSearchParams({ page: String(page) });
    if (admin) {
        Object.entries(adminOrderFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
    }

    return `/api/v1/orders?${params.toString()}`;
}

function renderOrdersResult(result, admin) {
    $('#page-content').classList.add('paginated-page', 'orders-page');
    if (admin) $('#page-content').classList.add('owner-orders-page');
    $('#page-content').innerHTML = (admin ? pageHead('ĐƠN HÀNG', 'Quản lý Đơn hàng', '', adminOrderServiceFilterMarkup()) : '') + `
        ${admin ? adminOrderFilterMarkup() : ''}
        <div id="order-results" class="paginated-results">
            <div class="paginated-scroll">${orderTable(result.data, admin)}</div>
            ${paginationMarkup(result.meta, 'đơn hàng')}
        </div>`;
    bindOrderActions();
    if (admin) bindAdminOrderFilters();
    bindPagination($('#order-results'), nextPage => renderOrders(nextPage));
}

async function pollAdminOrders(force = false) {
    if (isPollingOrders || document.body.dataset.role !== 'admin' || !location.pathname.endsWith('/orders')) return;
    isPollingOrders = true;
    try {
        const result = await api(ordersApiPath(adminOrdersPage, true));
        const signature = ordersSignature(result);
        if (force || (orderPollSignature && signature !== orderPollSignature)) {
            renderOrdersResult(result, true);
        }
        orderPollSignature = signature;
    } catch {
        /* keep polling quiet; the next interval can recover */
    } finally {
        isPollingOrders = false;
    }
}

async function renderOrders(page = null, options = {}) {
    const admin = document.body.dataset.role === 'admin';
    const requestedPage = Number(page || (admin ? adminOrdersPage : employeeOrdersPage));
    const result = await api(ordersApiPath(requestedPage, admin));
    if (requestedPage > Number(result.meta?.last_page || 1)) return renderOrders(Number(result.meta?.last_page || 1));
    if (admin) adminOrdersPage = Number(result.meta?.current_page || requestedPage);
    else employeeOrdersPage = Number(result.meta?.current_page || requestedPage);
    renderOrdersResult(result, admin);
    if (admin && options.focusSearch) {
        const search = $('#admin-order-search');
        search?.focus({ preventScroll: true });
        search?.setSelectionRange(search.value.length, search.value.length);
    }
    if (admin) {
        orderPollSignature = ordersSignature(result);
        if (!orderPollingTimer) orderPollingTimer = window.setInterval(() => pollAdminOrders(), 3000);
    }
}

function orderTable(orders, admin) {
    const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    if (!admin) {
        return `<div class="data-table-wrap"><table class="data-table staff-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(order.activity_at || order.opened_at)}</td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="5"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
    }
    return `<div class="data-table-wrap"><table class="data-table admin-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TỔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(order.opened_at)}</td><td data-label="Tổng"><strong>${money(order.total)}</strong></td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="6"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
}

function bindOrderActions() {
    $$('[data-view-order]').forEach(trigger => {
        const openOrder = async () => {
            const { order } = await api(`/api/v1/orders/${trigger.dataset.viewOrder}`);
            const canReverse = document.body.dataset.role === 'admin';
            const isCoffee = order.service_type === 'coffee';
            const serviceIcon = isCoffee
                ? '<svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path><path d="M3 22h16M8 2v3M12 2v3"></path></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path><circle cx="16.5" cy="11" r=".8" fill="currentColor" stroke="none"></circle></svg>';
            const completedPayments = order.payments.filter(payment => payment.status === 'completed');
            const paidAmount = completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remainingAmount = Math.max(0, Number(order.total) - paidAmount);
            const paymentStatus = status => status === 'completed' ? 'Hoàn tất' : status === 'reversed' ? 'Đã đảo' : statusLabel(status);
            const receiptBody = `
            <article class="pos-receipt ${isCoffee ? 'receipt-coffee' : 'receipt-fishing'}">
                <header class="pos-receipt-head">
                    <span class="pos-receipt-icon">${serviceIcon}</span>
                    <div class="pos-receipt-title"><small>${isCoffee ? 'CÀ PHÊ' : 'CÂU CÁ'} · ${escapeHtml(order.resource?.label || 'Chưa xác định')}</small><strong>${escapeHtml(order.order_number)}</strong></div>
                    <span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span>
                </header>
                <div class="pos-receipt-meta">
                    <span><small>Mở lúc</small><strong>${dateTime(order.opened_at)}</strong></span>
                    <span><small>Số lượng</small><strong>${number(order.items.reduce((sum, item) => sum + Number(item.quantity), 0))} món</strong></span>
                    <span><small>Thanh toán</small><strong>${remainingAmount > 0 ? `Còn ${money(remainingAmount)}` : 'Đã hoàn tất'}</strong></span>
                </div>
                <section class="pos-receipt-section">
                    <header><strong>Món trong đơn</strong><span>${number(order.items.length)} dòng</span></header>
                    <div class="pos-receipt-lines">
                        ${order.items.map(item => `<div class="pos-receipt-line">
                            <span class="receipt-quantity">${number(item.quantity)}</span>
                            <div>
                                <strong>${escapeHtml(item.name)}</strong>
                                <small>${money(item.unit_price)} / món${Number(item.paid_quantity || 0) ? ` · Đã trả ${number(item.paid_quantity)}` : ''}</small>
                                ${item.note ? `<div style="font-size: 10px; color: #a6534e; margin-top: 2px; font-style: italic;">* ${escapeHtml(item.note)}</div>` : ''}
                            </div>
                            <strong>${money(item.line_total)}</strong>
                        </div>`).join('')}
                    </div>
                </section>
                <section class="pos-receipt-totals">
                    <div><span>Tạm tính</span><strong>${money(order.subtotal ?? order.total)}</strong></div>
                    <div><span>Đã thanh toán</span><strong>${money(paidAmount)}</strong></div>
                    ${remainingAmount > 0 ? `<div><span>Còn lại</span><strong>${money(remainingAmount)}</strong></div>` : ''}
                    <div class="receipt-grand-total"><span>Tổng cộng</span><strong>${money(order.total)}</strong></div>
                </section>
                <section class="pos-receipt-payments">
                    <header><strong>Lịch sử thanh toán</strong><span>${number(order.payments.length)} giao dịch</span></header>
                    ${order.payments.length ? order.payments.map(payment => `<div class="pos-payment-row">
                        <span class="pos-payment-status"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg></span>
                        <div>
                            <strong>${escapeHtml(payment.payment_number)}</strong>
                            ${payment.lines && payment.lines.length ? `<div class="payment-row-items" style="font-size: 10px; color: var(--muted); margin-top: 2px; font-weight: 500; line-height: 1.3;">
                                ${payment.lines.map(line => `${escapeHtml(line.name)} <span style="color:var(--ink); font-weight:600;">x${line.quantity}</span>`).join(', ')}
                            </div>` : ''}
                            <small>${dateTime(payment.paid_at)} · ${paymentMethodDisplayLabel(payment.method)} · ${paymentStatus(payment.status)}</small>
                        </div>
                        <div><strong>${money(payment.amount)}</strong>${canReverse && payment.status === 'completed' ? `<button type="button" data-reverse-payment="${payment.id}">Điều chỉnh</button>` : ''}</div>
                    </div>`).join('') : '<div class="pos-receipt-empty">Chưa phát sinh giao dịch thanh toán.</div>'}
                </section>
            </article>`;
            const staffReceiptBody = `
            <article class="pos-receipt staff-receipt ${isCoffee ? 'receipt-coffee' : 'receipt-fishing'}">
                <header class="pos-receipt-head">
                    <span class="pos-receipt-icon">${serviceIcon}</span>
                    <div class="pos-receipt-title"><small>${isCoffee ? 'CÀ PHÊ' : 'CÂU CÁ'} · ${escapeHtml(order.resource?.label || 'Chưa xác định')}</small><strong>${escapeHtml(order.order_number)}</strong></div>
                    <span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span>
                </header>
                <div class="pos-receipt-meta">
                    <span><small>Mở lúc</small><strong>${dateTime(order.opened_at)}</strong></span>
                    <span><small>Số lượng</small><strong>${number(order.items.reduce((sum, item) => sum + Number(item.quantity), 0))} món</strong></span>
                </div>
                <section class="pos-receipt-section">
                    <header><strong>Món cần xử lý</strong><span>${number(order.items.length)} dòng</span></header>
                    <div class="pos-receipt-lines">
                        ${order.items.map(item => `<div class="pos-receipt-line">
                            <span class="receipt-quantity staff-item-quantity" aria-label="Số lượng ${number(item.quantity)}">x${number(item.quantity)}</span>
                            <div>
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
                            </div>
                        </div>`).join('')}
                    </div>
                </section>
            </article>`;
            openModal({ title: canReverse ? 'Chi tiết giao dịch' : 'Chi tiết đơn hàng', body: canReverse ? receiptBody : staffReceiptBody, wide: canReverse, onReady(modal, close) {
                modal.classList.add('order-detail-modal');
                modal.classList.add('pos-receipt-modal');
                if (!canReverse) modal.classList.add('staff-order-detail-modal');
                $$('[data-reverse-payment]', modal).forEach(reverse => reverse.onclick = () => {
                    close();
                    reasonAction('Điều chỉnh thanh toán', 'Lý do điều chỉnh', `/api/v1/admin/payments/${reverse.dataset.reversePayment}/reverse`, () => renderOrders());
                });
            } });
        };
        trigger.onclick = openOrder;
        trigger.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openOrder();
            }
        };
    });
    $$('[data-void-order]').forEach(button => button.onclick = () => reasonAction('Hủy đơn', 'Lý do hủy đơn', `/api/v1/admin/orders/${button.dataset.voidOrder}/void`, () => renderOrders()));
}

function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
}

async function renderDashboard() {
    $('#page-content').classList.add('owner-dashboard-page');
    const today = localDateStr(new Date());
    const from = localDateStr(new Date(Date.now() - 29 * 86400000));
    const data = await api(`/api/v1/admin/dashboard?from=${from}&to=${today}`);
    drawDashboard(data);
}


function drawDashboard(data) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const collected = Number(data.metrics.collected_revenue) || 0;
    const coffeeRev = Number(data.metrics.coffee_revenue) || 0;
    const fishingRev = Number(data.metrics.fishing_revenue) || 0;
    const coffeeShare = collected ? Math.round(coffeeRev / collected * 100) : 0;
    const fishingShare = collected ? Math.max(0, 100 - coffeeShare) : 0;
    const coffeeItems = (data.top_items || []).filter(item => item.line_type === 'menu').slice(0, 5);
    const svg = (path, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" aria-hidden="true">${path}</svg>`;
    const icons = {
        revenue: svg('<rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M7 9h10M7 15h5"></path>'),
        orders: svg('<path d="M7 3h10v18H7zM9.5 8h5M9.5 12h5M9.5 16h3"></path>'),
        ticket: svg('<path d="M4 5h16v14H4zM8 9h8M8 13h5"></path>'),
        outstanding: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'),
        coffee: svg('<path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM17 11h2a2 2 0 0 1 0 4h-2M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2"></path>'),
        fishing: svg('<path d="M3 12s4-5 9-5c4 0 7 3 9 5-2 2-5 5-9 5-5 0-9-5-9-5zM3 12l-2-3v6z"></path><circle cx="15.5" cy="11" r=".8"></circle>'),
        clock: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'),
        user: svg('<circle cx="12" cy="8" r="3"></circle><path d="M5 20c.8-4 3-6 7-6s6.2 2 7 6"></path>')
    };
    const trend = (value, label = 'so với kỳ trước') => {
        if (value === null || value === undefined) return '<span class="dash-trend neutral">Kỳ trước chưa có dữ liệu</span>';
        const numeric = Number(value);
        const direction = numeric > 0 ? 'up' : numeric < 0 ? 'down' : 'neutral';
        const arrow = numeric > 0 ? '↗' : numeric < 0 ? '↘' : '–';
        return `<span class="dash-trend ${direction}">${arrow} ${Math.abs(numeric).toLocaleString('vi-VN')}% ${label}</span>`;
    };
    const renderTopItems = items => items.length ? items.map((item, index) => {
        const max = Number(items[0]?.revenue) || 1;
        return `<div class="dash-product-row">
            <span class="dash-rank">${index + 1}</span>
            <span class="dash-product-copy"><strong>${escapeHtml(item.name)}</strong><small>${number(item.quantity)} phần</small><i><b style="width:${Math.max(8, Number(item.revenue) / max * 100)}%"></b></i></span>
            <strong>${money(item.revenue)}</strong>
        </div>`;
    }).join('') : '<div class="dash-empty-compact">Chưa có món được thanh toán trong kỳ.</div>';
    const renderPeakHours = hours => hours?.length ? hours.map((hour, index) => `<div class="dash-mini-row"><span><b>${index + 1}</b>${escapeHtml(hour.hour)}</span><small>${number(hour.transactions)} giao dịch</small><strong>${money(hour.revenue)}</strong></div>`).join('') : '<div class="dash-empty-compact">Chưa có dữ liệu theo giờ.</div>';
    const renderCashiers = cashiers => cashiers?.length ? cashiers.map((cashier, index) => `<div class="dash-mini-row"><span><b>${index + 1}</b>${escapeHtml(cashier.name)}</span><small>${number(cashier.transactions)} giao dịch</small><strong>${money(cashier.revenue)}</strong></div>`).join('') : '<div class="dash-empty-compact">Chưa phát sinh giao dịch.</div>';

    const filterHtml = `<div class="dashboard-filter-bar" aria-label="Bộ lọc thời gian">
        <div class="dashboard-filter">
            <input type="date" id="dashboard-from" value="${data.range.from}" aria-label="Từ ngày">
            <span class="filter-separator">—</span>
            <input type="date" id="dashboard-to" value="${data.range.to}" aria-label="Đến ngày">
            <button class="button primary" id="dashboard-filter">Xem</button>
        </div>
    </div>`;

    const dashboardHead = `<header class="page-head owner-dashboard-head">
        <div><p class="eyebrow">BÁO CÁO QUẢN LÝ</p><h1>Tổng quan kinh doanh</h1></div>
        ${filterHtml}
    </header>`;


    $('#page-content').innerHTML = dashboardHead + `
        <section class="owner-kpis">
            <article class="owner-kpi primary"><span class="owner-kpi-icon">${icons.revenue}</span><div><small>DOANH THU ĐÃ THU</small><strong>${money(data.metrics.collected_revenue)}</strong>${trend(data.comparison?.revenue_change)}</div></article>
            <article class="owner-kpi"><span class="owner-kpi-icon">${icons.orders}</span><div><small>ĐƠN HOÀN TẤT</small><strong>${number(data.metrics.paid_order_count)} <em>đơn</em></strong>${trend(data.comparison?.orders_change)}</div></article>
            <article class="owner-kpi"><span class="owner-kpi-icon">${icons.ticket}</span><div><small>GIÁ TRỊ TRUNG BÌNH</small><strong>${money(data.metrics.average_ticket)}</strong>${trend(data.comparison?.average_ticket_change)}</div></article>
            <article class="owner-kpi warning"><span class="owner-kpi-icon">${icons.outstanding}</span><div><small>CÒN PHẢI THU</small><strong>${money(data.metrics.outstanding_amount)}</strong><span class="dash-trend neutral">${number(data.metrics.attention_order_count)} đơn chưa tất toán</span></div></article>
        </section>

        <article class="owner-panel revenue-overview">
            <header class="owner-panel-head"><div><span>DÒNG TIỀN</span><h3>Doanh thu theo thời gian</h3></div><div class="chart-legend"><span class="coffee">Cà phê</span><span class="fishing">Câu cá</span></div></header>
            ${chartSvg(data.daily)}
        </article>

        <section class="owner-main-grid">
            <article class="owner-panel business-card coffee-business">
                <header class="owner-panel-head"><div><span>MÔ HÌNH CÀ PHÊ</span><h3>Hiệu quả bán hàng</h3></div><i>${icons.coffee}</i></header>
                <div class="business-total"><strong>${money(data.coffee_summary.revenue)}</strong><span>${coffeeShare}% tổng doanh thu</span></div>
                <div class="business-stat-grid"><div><small>Đơn hoàn tất</small><strong>${number(data.coffee_summary.paid_orders)}</strong></div><div><small>Sản phẩm đã bán</small><strong>${number(data.coffee_summary.items_sold)}</strong></div></div>
                <div class="business-share"><i style="width:${coffeeShare}%"></i></div>
                <h4>Món đóng góp nhiều nhất</h4>${renderTopItems(coffeeItems)}
            </article>
            <article class="owner-panel business-card fishing-business">
                <header class="owner-panel-head"><div><span>MÔ HÌNH CÂU CÁ</span><h3>Hiệu quả hồ câu</h3></div><i>${icons.fishing}</i></header>
                <div class="business-total"><strong>${money(data.fishing_summary.revenue)}</strong><span>${fishingShare}% tổng doanh thu</span></div>
                <div class="business-stat-grid"><div><small>Phiên bắt đầu</small><strong>${number(data.fishing_summary.sessions_started)}</strong></div><div><small>Lượt gia hạn</small><strong>${number(data.fishing_summary.extensions)}</strong></div></div>
                <div class="fishing-income"><div><span>Tiền phiên câu</span><strong>${money(data.fishing_summary.session_revenue)}</strong></div><div><span>Gọi món tại chòi</span><strong>${money(data.fishing_summary.menu_revenue)}</strong></div></div>
                <div class="occupancy-row"><span>Chòi đang có khách <b>${number(data.metrics.occupied_spots)}/${number(data.metrics.enabled_spots)}</b></span><strong>${number(data.metrics.spot_occupancy_rate)}%</strong></div>
                <div class="business-share"><i style="width:${data.metrics.spot_occupancy_rate}%"></i></div>
            </article>
        </section>

        <section class="owner-bottom-grid">
            <article class="owner-panel"><header class="owner-panel-head"><div><span>NHỊP BÁN HÀNG</span><h3>Khung giờ doanh thu cao</h3></div><i>${icons.clock}</i></header>${renderPeakHours(data.peak_hours)}</article>
            <article class="owner-panel"><header class="owner-panel-head"><div><span>THANH TOÁN</span><h3>Giao dịch theo nhân viên</h3></div><i>${icons.user}</i></header>${renderCashiers(data.cashiers)}</article>
        </section>`;

    const chartWrap = $('.owner-chart-wrap');
    const chartTooltip = $('.owner-chart-tooltip', chartWrap);
    const hideChartTooltip = () => {
        chartTooltip.classList.remove('open');
        $$('[data-chart-stack]', chartWrap).forEach(stack => stack.classList.remove('selected'));
    };
    const showChartTooltip = stack => {
        const date = new Date(`${stack.dataset.day}T00:00:00`).toLocaleDateString('vi-VN', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' });
        chartTooltip.innerHTML = `<strong>${date}</strong><div><span><i class="coffee"></i>Cà phê</span><b>${money(stack.dataset.coffee)}</b></div><div><span><i class="fishing"></i>Câu cá</span><b>${money(stack.dataset.fishing)}</b></div><div class="total"><span>Tổng doanh thu</span><b>${money(stack.dataset.total)}</b></div>`;
        $$('[data-chart-stack]', chartWrap).forEach(item => item.classList.toggle('selected', item === stack));
        chartTooltip.classList.add('open');
        const wrapRect = chartWrap.getBoundingClientRect();
        const stackRect = stack.getBoundingClientRect();
        const tooltipWidth = chartTooltip.offsetWidth;
        const center = stackRect.left - wrapRect.left + stackRect.width / 2;
        const left = Math.max(8, Math.min(center - tooltipWidth / 2, chartWrap.clientWidth - tooltipWidth - 8));
        chartTooltip.style.left = `${left}px`;
        chartTooltip.style.top = `${Math.max(8, stackRect.top - wrapRect.top - chartTooltip.offsetHeight - 12)}px`;
    };
    $$('[data-chart-stack]', chartWrap).forEach(stack => {
        stack.onclick = event => {
            event.stopPropagation();
            if (stack.classList.contains('selected')) hideChartTooltip();
            else showChartTooltip(stack);
        };
        stack.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showChartTooltip(stack);
            }
        };
    });
    chartWrap.onclick = event => {
        if (!event.target.closest('[data-chart-stack]') && !event.target.closest('.owner-chart-tooltip')) hideChartTooltip();
    };

    const filterBtn = $('#dashboard-filter');
    filterBtn.onclick = async () => {
        const result = await api(`/api/v1/admin/dashboard?from=${$('#dashboard-from').value}&to=${$('#dashboard-to').value}`);
        drawDashboard(result);
    };


    const sidebarTotal = $('#sidebar-total');
    if (sidebarTotal) sidebarTotal.textContent = money(data.metrics.collected_revenue);
}

function chartSvg(rows) {
    if (!rows.length) return '<div class="empty-state">Chưa có doanh thu trong khoảng này.</div>';
    const width = 960, height = 300, left = 68, right = 22, top = 18, bottom = 42;
    const max = Math.max(...rows.map(row => Number(row.revenue)), 1);
    const plotWidth = width - left - right, plotHeight = height - top - bottom, slot = plotWidth / rows.length, barWidth = Math.max(5, Math.min(32, slot * .58));
    
    const grid = [0, .5, 1].map(ratio => {
        const y = top + plotHeight * (1 - ratio);
        return `<line x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text x="${left - 12}" y="${y + 4}">${ratio ? `${Math.round(max * ratio / 1000)}k` : '0'}</text>`;
    }).join('');

    const bars = rows.map((row, index) => {
        const coffee = Number(row.coffee || 0);
        const fishing = Number(row.fishing || 0);
        const coffeeHeight = (coffee / max) * plotHeight;
        const fishingHeight = (fishing / max) * plotHeight;
        const x = left + index * slot + (slot - barWidth) / 2;
        const coffeeY = top + plotHeight - coffeeHeight;
        const fishingY = coffeeY - fishingHeight;
        return `<g class="revenue-stack" role="button" tabindex="0" data-chart-stack data-day="${row.day}" data-coffee="${coffee}" data-fishing="${fishing}" data-total="${coffee + fishing}" aria-label="Xem doanh thu ngày ${row.day}"><rect class="chart-hit-area" x="${left + index * slot}" y="${top}" width="${slot}" height="${plotHeight}"></rect><rect class="coffee-bar" x="${x}" y="${coffeeY}" width="${barWidth}" height="${Math.max(coffeeHeight, coffee ? 2 : 0)}" rx="4"></rect><rect class="fishing-bar" x="${x}" y="${fishingY}" width="${barWidth}" height="${Math.max(fishingHeight, fishing ? 2 : 0)}" rx="4"></rect></g>`;
    }).join('');

    const labelStep = Math.max(1, Math.ceil(rows.length / 6));
    const labels = rows.map((row, index) => index % labelStep === 0 || index === rows.length - 1 ? `<text class="chart-date" x="${left + index * slot + slot / 2}" y="${height - 10}">${new Date(`${row.day}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</text>` : '').join('');

    return `<div class="owner-chart-wrap"><svg class="chart owner-revenue-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <g class="chart-grid">${grid}</g>
            <g class="chart-bars">${bars}</g>
            <g class="chart-labels">${labels}</g>
        </svg><div class="owner-chart-tooltip" role="status" aria-live="polite"></div></div>`;
}

async function renderMenuAdmin(page = adminMenuPage, options = {}) {
    const data = await api(menuApiPath(page));
    if (Number(page) > Number(data.meta?.last_page || 1)) return renderMenuAdmin(Number(data.meta?.last_page || 1), options);
    adminMenuPage = Number(data.meta?.current_page || page);
    $('#page-content').classList.add('owner-menu-page', 'paginated-page');
    const addButton = '<button class="button primary" id="add-menu"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm món</button>';
    const imagePlaceholder = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="15.5" cy="9" r="2"></circle><path d="m5 17 5-5 3 3 2-2 4 4"></path></svg>';
    const deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m7 7 1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';
    const hasActiveMenuFilters = Boolean(adminMenuFilters.category || adminMenuFilters.q);
    const menuContent = data.items.length
        ? `<div class="data-table-wrap menu-admin-table-wrap"><table class="data-table menu-admin-table"><thead><tr><th>HÌNH</th><th>TÊN MÓN</th><th>NHÓM</th><th>GIÁ</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>${data.items.map(item=>`<tr class="menu-row-clickable" data-edit-menu-row="${item.id}" tabindex="0" aria-label="Chỉnh sửa món ${escapeHtml(item.name)}"><td data-label="Hình"><span class="menu-table-image">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy">` : imagePlaceholder}</span></td><td data-label="Tên món"><strong>${escapeHtml(item.name)}</strong></td><td data-label="Nhóm">${escapeHtml(item.category)}</td><td data-label="Giá"><strong>${escapeHtml(formatDisplayPrice(item.display_price) || money(item.price))}</strong></td><td data-label="Trạng thái"><span class="pill ${item.deleted_at ? 'gray' : item.is_available ? '' : 'warn'}">${item.deleted_at ? 'Đã lưu trữ' : item.is_available ? 'Đang bán' : 'Tạm ẩn'}</span></td><td data-label="Thao tác"><div class="table-actions">${!item.deleted_at ? `<button class="button small danger menu-delete-button" data-delete-menu="${item.id}" aria-label="Xóa món ${escapeHtml(item.name)}">${deleteIcon}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
        : hasActiveMenuFilters
            ? `<section class="menu-admin-empty filtered"><span>${menuSearchIcon()}</span><div><h3>Không thấy món phù hợp</h3><p>Thử đổi nhóm món hoặc từ khóa khác.</p></div><button class="button secondary" id="clear-menu-filters">Xóa lọc</button></section>`
            : `<section class="menu-admin-empty"><span>${imagePlaceholder}</span><div><h3>Menu chưa có món</h3><p>Thêm món đầu tiên để nhân viên có thể bắt đầu nhận order tại POS.</p></div><button class="button secondary" id="empty-add-menu"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm món đầu tiên</button></section>`;
    $('#page-content').innerHTML = pageHead('THIẾT LẬP', 'Quản lý Menu', '', addButton) + `
        ${adminMenuFilterMarkup(data.categories || [])}
        <div id="menu-results" class="paginated-results">
            <div class="paginated-scroll">${menuContent}</div>
            ${paginationMarkup(data.meta, 'menu')}
        </div>`;
    $('#add-menu').onclick = () => menuBatchForm(data.categories || []);
    $('#empty-add-menu')?.addEventListener('click', () => menuBatchForm(data.categories || []));
    $('#clear-menu-filters')?.addEventListener('click', () => {
        adminMenuFilters = { category: '', q: '' };
        adminMenuPage = 1;
        renderMenuAdmin(1);
    });
    $$('[data-edit-menu-row]').forEach(row => {
        const openMenuItem = () => menuForm(data.items.find(item => item.id === Number(row.dataset.editMenuRow)), data.categories || []);
        row.onclick = event => {
            if (event.target.closest('button, a, input, select, textarea, label')) return;
            openMenuItem();
        };
        row.onkeydown = event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openMenuItem();
        };
    });
    $$('[data-delete-menu]').forEach(button=>button.onclick=async(event)=>{ event.stopPropagation(); if(!await confirmModal('Lưu trữ món','Món sẽ không còn xuất hiện trong POS. Dữ liệu đơn cũ vẫn được giữ nguyên.','Lưu trữ'))return; try{const result=await api(`/api/v1/admin/menu/${button.dataset.deleteMenu}`,{method:'DELETE'});toast(result.message);renderMenuAdmin();}catch(error){toast(error.message,'error');}});
    bindAdminMenuFilters();
    bindPagination($('#menu-results'), nextPage => renderMenuAdmin(nextPage));
    if (options.focusSearch) {
        const search = $('#admin-menu-search');
        search?.focus({ preventScroll: true });
        search?.setSelectionRange(search.value.length, search.value.length);
    }
}

function menuBatchForm(categories = []) {
    let rowSequence = 0;
    let selectedCategoryId = categories[0]?.id ? String(categories[0].id) : '';
    let creatingCategory = categories.length === 0;

    const rowMarkup = () => {
        const rowId = ++rowSequence;
        return `<article class="menu-batch-row" data-menu-batch-row="${rowId}">
            <label class="menu-batch-image" aria-label="Chọn ảnh cho món">
                <span data-batch-image-preview><svg viewBox="0 0 48 48"><rect x="5" y="7" width="38" height="34" rx="7"></rect><circle cx="32" cy="18" r="4"></circle><path d="m9 35 10-11 8 8 5-5 7 8"></path></svg></span>
                <small><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"></path></svg>Chọn ảnh</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" data-batch-image>
            </label>
            <div class="menu-batch-fields">
                <label>Tên món<input type="text" data-batch-name placeholder="Ví dụ: Cà phê sữa" maxlength="120" required></label>
                <div class="menu-batch-price-container">
                    <label data-batch-price-label>Giá bán<div class="menu-price-field"><input type="text" inputmode="numeric" data-batch-price placeholder="0" required><span>đ</span></div></label>
                    <div data-batch-display-price-label class="hidden">
                        <span style="display:block; font-size:10px; font-weight:700; color:#6b5b50; margin-bottom:5px;">Khoảng giá POS</span>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <input type="text" inputmode="numeric" data-batch-display-price-from placeholder="Từ" style="flex:1; height:42px; font-size:11px; padding:0 6px; text-align:center;">
                            <span style="color:#cbb6a2; font-weight:600;">-</span>
                            <input type="text" inputmode="numeric" data-batch-display-price-to placeholder="Đến" style="flex:1; height:42px; font-size:11px; padding:0 6px; text-align:center;">
                        </div>
                    </div>
                </div>
            </div>
            <div class="menu-batch-row-actions">
                <label class="menu-batch-availability"><input type="checkbox" data-batch-available checked><i></i><span>Đang bán</span></label>
                <label class="menu-batch-availability"><input type="checkbox" data-batch-flexible><i></i><span>Giá biến động</span></label>
                <button type="button" class="menu-batch-remove" data-remove-batch-row aria-label="Xóa dòng món"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path></svg></button>
            </div>
        </article>`;
    };

    const categoryButtons = categories.map((category, index) => `<button type="button" class="menu-category-choice ${index === 0 ? 'active' : ''}" data-category-choice="${category.id}">${escapeHtml(category.name)}</button>`).join('');

    openModal({
        title: 'Thêm món',
        body: `<form id="menu-batch-form" class="menu-batch-form">
            <section class="menu-batch-category">
                <div class="menu-batch-section-head"><div><strong>Chọn nhóm món</strong><small>Tất cả món bên dưới sẽ được thêm vào cùng nhóm.</small></div></div>
                <div class="menu-category-choices">
                    ${categoryButtons}
                    <div class="menu-category-new-wrapper ${creatingCategory ? 'active' : ''}" data-new-category-wrapper>
                        <button type="button" class="menu-category-choice new ${creatingCategory ? 'active' : ''}" data-new-category><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>Nhóm mới</button>
                        <input type="text" class="menu-category-inline-input" maxlength="80" placeholder="Ví dụ: Sinh tố" data-category-name>
                    </div>
                </div>
            </section>
            <section class="menu-batch-items">
                <div class="menu-batch-section-head"><div><strong>Danh sách món</strong><small>Ảnh JPG, PNG hoặc WebP, mọi tỷ lệ và tối đa 30 MB.</small></div></div>
                <div class="menu-batch-rows" data-batch-rows>${rowMarkup()}</div>
                <div class="menu-batch-add-row-wrap"><button type="button" class="button secondary small" data-add-batch-row><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14"></path></svg>Thêm món cùng nhóm</button></div>
            </section>
        </form>`,
        footer: '<span class="muted menu-batch-count">1 món sẽ được thêm</span><div><button class="button primary" id="save-menu-batch">Lưu tất cả</button></div>',
        onReady(modal, close) {
            modal.classList.add('menu-batch-modal');
            const rowsContainer = $('[data-batch-rows]', modal);
            const countLabel = $('.menu-batch-count', modal);
            const newCategoryWrapper = $('[data-new-category-wrapper]', modal);
            const categoryNameInput = $('[data-category-name]', modal);

            const syncCount = () => {
                const count = $$('[data-menu-batch-row]', modal).length;
                countLabel.textContent = `${count} món sẽ được thêm`;
                $$('[data-remove-batch-row]', modal).forEach(button => button.disabled = count === 1);
            };

            const validateImage = file => new Promise((resolve, reject) => {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    reject(new Error('Bạn vui lòng chọn ảnh JPG, PNG hoặc WebP nhé.'));
                    return;
                }
                if (file.size > 30 * 1024 * 1024) {
                    reject(new Error('Mỗi ảnh món không được lớn hơn 30 MB nhé.'));
                    return;
                }
                const url = URL.createObjectURL(file);
                const image = new Image();
                image.onload = () => {
                    resolve(url);
                };
                image.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Ảnh này chưa thể đọc được. Bạn thử chọn ảnh khác nhé.'));
                };
                image.src = url;
            });

            const bindRow = row => {
                const priceInput = $('[data-batch-price]', row);
                const imageInput = $('[data-batch-image]', row);
                priceInput.oninput = () => { priceInput.value = formatMoneyInput(priceInput.value); };

                const flexibleToggle = $('[data-batch-flexible]', row);
                const priceLabel = $('[data-batch-price-label]', row);
                const displayPriceLabel = $('[data-batch-display-price-label]', row);
                const displayPriceFrom = $('[data-batch-display-price-from]', row);
                const displayPriceTo = $('[data-batch-display-price-to]', row);

                const syncFlexible = () => {
                    if (flexibleToggle.checked) {
                        priceLabel.classList.add('hidden');
                        priceInput.value = '0';
                        priceInput.required = false;
                        displayPriceLabel.classList.remove('hidden');
                        displayPriceFrom.required = true;
                        displayPriceTo.required = true;
                    } else {
                        priceLabel.classList.remove('hidden');
                        if (priceInput.value === '0') priceInput.value = '';
                        priceInput.required = true;
                        displayPriceLabel.classList.add('hidden');
                        displayPriceFrom.required = false;
                        displayPriceTo.required = false;
                    }
                };
                flexibleToggle.onchange = syncFlexible;
                syncFlexible();

                displayPriceFrom.oninput = () => { displayPriceFrom.value = formatMoneyInput(displayPriceFrom.value); };
                displayPriceTo.oninput = () => { displayPriceTo.value = formatMoneyInput(displayPriceTo.value); };

                imageInput.onchange = async () => {
                    const file = imageInput.files?.[0];
                    if (!file) return;
                    try {
                        const url = await validateImage(file);
                        if (row.dataset.previewUrl) URL.revokeObjectURL(row.dataset.previewUrl);
                        row.dataset.previewUrl = url;
                        $('[data-batch-image-preview]', row).innerHTML = `<img src="${url}" alt="Xem trước ảnh món">`;
                        $('.menu-batch-image', row).classList.add('has-image');
                    } catch (error) {
                        imageInput.value = '';
                        toast(error.message, 'error');
                    }
                };
                $('[data-remove-batch-row]', row).onclick = () => {
                    if ($$('[data-menu-batch-row]', modal).length === 1) return;
                    if (row.dataset.previewUrl) URL.revokeObjectURL(row.dataset.previewUrl);
                    row.remove();
                    syncCount();
                };
            };

            $$('[data-menu-batch-row]', modal).forEach(bindRow);
            $('[data-add-batch-row]', modal).onclick = () => {
                if ($$('[data-menu-batch-row]', modal).length >= 20) {
                    toast('Mỗi lần bạn có thể thêm tối đa 20 món nhé.', 'error');
                    return;
                }
                rowsContainer.insertAdjacentHTML('beforeend', rowMarkup());
                bindRow(rowsContainer.lastElementChild);
                rowsContainer.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                syncCount();
            };

            $$('[data-category-choice]', modal).forEach(button => button.onclick = () => {
                selectedCategoryId = button.dataset.categoryChoice;
                creatingCategory = false;
                newCategoryWrapper.classList.remove('active');
                $$('.menu-category-choice', modal).forEach(choice => choice.classList.toggle('active', choice === button));
            });
            $('[data-new-category]', modal).onclick = event => {
                selectedCategoryId = '';
                creatingCategory = true;
                newCategoryWrapper.classList.add('active');
                $$('.menu-category-choice', modal).forEach(choice => choice.classList.toggle('active', choice === event.currentTarget));
                categoryNameInput.focus();
            };

            $('#save-menu-batch', modal).onclick = async event => {
                const saveButton = event.currentTarget;
                const rows = $$('[data-menu-batch-row]', modal);
                const categoryName = categoryNameInput.value.trim();
                if (creatingCategory && !categoryName) {
                    categoryNameInput.focus();
                    toast('Bạn hãy nhập tên nhóm món mới nhé.', 'error');
                    return;
                }
                if (!creatingCategory && !selectedCategoryId) {
                    toast('Bạn hãy chọn một nhóm món nhé.', 'error');
                    return;
                }

                const formData = new FormData();
                let totalImageBytes = 0;
                if (creatingCategory) formData.append('category_name', categoryName);
                else formData.append('category_id', selectedCategoryId);

                for (let index = 0; index < rows.length; index += 1) {
                    const row = rows[index];
                    const nameInput = $('[data-batch-name]', row);
                    const priceInput = $('[data-batch-price]', row);
                    const displayPriceFrom = $('[data-batch-display-price-from]', row);
                    const displayPriceTo = $('[data-batch-display-price-to]', row);
                    const flexibleToggle = $('[data-batch-flexible]', row);
                    const name = nameInput.value.trim();
                    if (!name) {
                        nameInput.focus();
                        toast(`Bạn hãy nhập tên cho món thứ ${index + 1} nhé.`, 'error');
                        return;
                    }
                    
                    let price = 0;
                    let displayPrice = '';

                    if (flexibleToggle.checked) {
                        price = 0;
                        const fromVal = parseMoneyInput(displayPriceFrom.value);
                        const toVal = parseMoneyInput(displayPriceTo.value);
                        if (!fromVal) {
                            displayPriceFrom.focus();
                            toast(`Bạn hãy nhập giá từ cho món “${name}” nhé.`, 'error');
                            return;
                        }
                        if (!toVal) {
                            displayPriceTo.focus();
                            toast(`Bạn hãy nhập giá đến cho món “${name}” nhé.`, 'error');
                            return;
                        }
                        if (toVal <= fromVal) {
                            displayPriceTo.focus();
                            toast(`Giá đến phải lớn hơn giá từ cho món “${name}” nhé.`, 'error');
                            return;
                        }
                        displayPrice = `${fromVal}-${toVal}`;
                    } else {
                        const priceVal = priceInput.value.trim();
                        if (priceVal === '') {
                            priceInput.focus();
                            toast(`Bạn hãy nhập giá bán cho món “${name}” nhé.`, 'error');
                            return;
                        }
                        price = parseMoneyInput(priceVal);
                    }

                    formData.append(`items[${index}][name]`, name);
                    formData.append(`items[${index}][price]`, String(price));
                    formData.append(`items[${index}][description]`, '');
                    formData.append(`items[${index}][display_price]`, displayPrice);
                    formData.append(`items[${index}][is_available]`, $('[data-batch-available]', row).checked ? '1' : '0');
                    const image = $('[data-batch-image]', row).files?.[0];
                    if (image) {
                        totalImageBytes += image.size;
                        formData.append(`items[${index}][image]`, image);
                    }
                }

                if (totalImageBytes > 120 * 1024 * 1024) {
                    toast('Tổng dung lượng ảnh trong một lần lưu tối đa là 120 MB. Bạn hãy chia thành hai lần thêm món nhé.', 'error');
                    return;
                }

                saveButton.disabled = true;
                saveButton.textContent = 'Đang lưu…';
                try {
                    const result = await api('/api/v1/admin/menu/batch', { method: 'POST', body: formData });
                    toast(result.message);
                    close();
                    renderMenuAdmin();
                } catch (error) {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Lưu tất cả';
                    toast(error.message, 'error');
                }
            };

            syncCount();
        }
    });
}

function menuForm(item = null, categories = []) {
    const imagePreview = item?.image_url
        ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}">`
        : '<svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="7" width="38" height="34" rx="7"></rect><circle cx="32" cy="18" r="4"></circle><path d="m9 35 10-11 8 8 5-5 7 8"></path></svg>';
    openModal({
        title: item ? 'Chỉnh sửa món' : 'Thêm món mới',
        body: `<form id="menu-form" class="menu-item-form" enctype="multipart/form-data">
            <aside class="menu-media-column">
                <div class="menu-form-section-title"><strong>Hình ảnh món</strong><small>Hiển thị trên menu gọi món</small></div>
                <label class="menu-image-drop">
                    <span class="menu-image-preview" id="menu-image-preview">${imagePreview}</span>
                    <span class="menu-image-overlay"><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"></path></svg><strong>${item?.image_url ? 'Thay ảnh' : 'Chọn ảnh món'}</strong></span>
                    <input id="menu-image-input" name="image" type="file" accept="image/jpeg,image/png,image/webp">
                </label>
                <small class="menu-image-help">JPG, PNG hoặc WebP · Tối đa 30 MB<br>Chấp nhận ảnh ngang, dọc hoặc vuông.</small>
                ${item?.image_url ? '<label class="menu-image-remove"><input type="checkbox" name="remove_image" value="1"><span>Xóa ảnh hiện tại</span></label>' : ''}
            </aside>
            <section class="menu-info-column">
                <div class="menu-form-section-title"><strong>Thông tin món</strong><small>Tên, nhóm món và giá bán tại POS</small></div>
                <div class="menu-form-grid"><label>Tên món<input name="name" value="${escapeHtml(item?.name || '')}" placeholder="Ví dụ: Cà phê sữa" required></label><label>Nhóm món${categories.length ? `<select name="category_id" required>${categories.map(category => `<option value="${category.id}" ${Number(item?.category_id) === Number(category.id) || item?.category === category.name ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select>` : `<input name="category" value="${escapeHtml(item?.category || 'Cà phê')}" required>`}</label></div>
                <label class="menu-availability-card" for="menu-is-flexible-price" style="margin-top: 4px; margin-bottom: 4px;"><span><strong>Giá biến động / Khoảng giá</strong><small>Cho phép nhân viên nhập giá tùy chỉnh tại POS, hiển thị khoảng giá trên menu.</small></span><input id="menu-is-flexible-price" type="checkbox" ${item && Number(item.price) === 0 ? 'checked' : ''}><i></i></label>
                <label id="menu-price-label">Giá bán<div class="menu-price-field"><input id="menu-price-input" name="price" type="text" inputmode="numeric" value="${item?.price !== undefined && item?.price !== null && Number(item.price) !== 0 ? formatStoredMoneyInput(item.price) : ''}" placeholder="0" required><span>đ</span></div></label>
                <label id="menu-display-price-label" class="hidden">
                    Khoảng giá hiển thị POS
                    <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                        <div class="menu-price-field" style="flex:1;"><input id="menu-display-price-from" type="text" inputmode="numeric" placeholder="Giá từ"><span>đ</span></div>
                        <span style="color:var(--muted); font-weight:600;">-</span>
                        <div class="menu-price-field" style="flex:1;"><input id="menu-display-price-to" type="text" inputmode="numeric" placeholder="Đến giá"><span>đ</span></div>
                    </div>
                </label>
                <label class="menu-availability-card" for="menu-is-available"><span><strong>Đang bán trên POS</strong><small>Tắt trạng thái để tạm ẩn món khỏi menu nhân viên.</small></span><input id="menu-is-available" name="is_available" type="checkbox" ${item?.is_available !== false ? 'checked' : ''}><i></i></label>
            </section>
        </form>`,
        footer: '<span class="muted menu-form-footnote">Thông tin sẽ cập nhật ngay trên menu POS.</span><div><button class="button primary" id="save-menu">Lưu món</button></div>',
        onReady(modal, close) {
            modal.classList.add('menu-item-modal');
            const input = $('#menu-image-input', modal);
            const priceInput = $('#menu-price-input', modal);
            const preview = $('#menu-image-preview', modal);
            const overlayLabel = $('.menu-image-overlay strong', modal);
            const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
            const maximumImageBytes = 30 * 1024 * 1024;
            let imageIsChecking = false;
            let imageIsValid = true;
            let previewUrl = null;

            const flexibleToggle = $('#menu-is-flexible-price', modal);
            const priceLabel = $('#menu-price-label', modal);
            const displayPriceLabel = $('#menu-display-price-label', modal);
            const fromInput = $('#menu-display-price-from', modal);
            const toInput = $('#menu-display-price-to', modal);

            const syncFlexiblePrice = () => {
                if (flexibleToggle.checked) {
                    priceLabel.classList.add('hidden');
                    priceInput.value = '0';
                    priceInput.required = false;
                    displayPriceLabel.classList.remove('hidden');
                    fromInput.required = true;
                    toInput.required = true;
                } else {
                    priceLabel.classList.remove('hidden');
                    if (priceInput.value === '0') priceInput.value = '';
                    priceInput.required = true;
                    displayPriceLabel.classList.add('hidden');
                    fromInput.required = false;
                    toInput.required = false;
                }
            };
            flexibleToggle.onchange = syncFlexiblePrice;
            syncFlexiblePrice();

            fromInput.oninput = () => { fromInput.value = formatMoneyInput(fromInput.value); };
            toInput.oninput = () => { toInput.value = formatMoneyInput(toInput.value); };

            if (item?.display_price) {
                const parts = item.display_price.split('-').map(x => x.trim());
                if (parts.length === 2) {
                    const fromNum = Number(parts[0].replace(/\D/g, ''));
                    const toNum = Number(parts[1].replace(/\D/g, ''));
                    if (!isNaN(fromNum) && fromNum > 0) fromInput.value = formatMoneyInput(String(fromNum));
                    if (!isNaN(toNum) && toNum > 0) toInput.value = formatMoneyInput(String(toNum));
                }
            }

            priceInput.oninput = () => { priceInput.value = formatMoneyInput(priceInput.value); };
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                imageIsValid = false;

                const rejectImage = message => {
                    input.value = '';
                    imageIsChecking = false;
                    imageIsValid = true;
                    preview.innerHTML = imagePreview;
                    overlayLabel.textContent = item?.image_url ? 'Thay ảnh' : 'Chọn ảnh món';
                    toast(message, 'error');
                };

                if (!allowedImageTypes.has(file.type)) {
                    rejectImage('Bạn vui lòng chọn ảnh JPG, PNG hoặc WebP nhé.');
                    return;
                }
                if (file.size > maximumImageBytes) {
                    rejectImage('Ảnh món hơi lớn một chút. Bạn vui lòng chọn ảnh không quá 30 MB nhé.');
                    return;
                }

                imageIsChecking = true;
                const candidateUrl = URL.createObjectURL(file);
                const candidateImage = new Image();
                candidateImage.onload = () => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    previewUrl = candidateUrl;
                    preview.innerHTML = `<img src="${candidateUrl}" alt="Xem trước ảnh món">`;
                    overlayLabel.textContent = 'Đổi ảnh khác';
                    imageIsChecking = false;
                    imageIsValid = true;
                };
                candidateImage.onerror = () => {
                    URL.revokeObjectURL(candidateUrl);
                    rejectImage('Ảnh này chưa thể đọc được. Bạn thử chọn một ảnh khác nhé.');
                };
                candidateImage.src = candidateUrl;
            };
            $('#save-menu', modal).onclick = async () => {
                if (imageIsChecking) {
                    toast('Mình đang kiểm tra ảnh, bạn chờ một chút nhé.', 'error');
                    return;
                }
                if (!imageIsValid) return;
                const formData = new FormData($('#menu-form', modal));
                const image = formData.get('image');
                if (image instanceof File && image.size === 0) formData.delete('image');
                
                if (flexibleToggle.checked) {
                    formData.set('price', '0');
                    const fromVal = parseMoneyInput(fromInput.value);
                    const toVal = parseMoneyInput(toInput.value);
                    if (!fromVal) {
                        fromInput.focus();
                        toast('Bạn hãy nhập giá từ nhé.', 'error');
                        return;
                    }
                    if (!toVal) {
                        toInput.focus();
                        toast('Bạn hãy nhập giá đến nhé.', 'error');
                        return;
                    }
                    if (toVal <= fromVal) {
                        toInput.focus();
                        toast('Giá đến phải lớn hơn giá từ nhé.', 'error');
                        return;
                    }
                    formData.set('display_price', `${fromVal}-${toVal}`);
                } else {
                    formData.set('price', String(parseMoneyInput(priceInput.value)));
                    formData.set('display_price', '');
                }

                formData.set('is_available', $('#menu-is-available', modal).checked ? '1' : '0');
                if (item) formData.set('_method', 'PUT');
                try {
                    const result = await api(item ? `/api/v1/admin/menu/${item.id}` : '/api/v1/admin/menu', { method:'POST', body:formData });
                    toast(result.message); close(); renderMenuAdmin();
                } catch (error) { toast(error.message, 'error'); }
            };
        }
    });
}

async function renderSettingsAdmin() {
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

function paymentMethodForm(method = null) {
    const qrPlaceholder = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect><rect x="30" y="6" width="12" height="12" rx="2"></rect><rect x="6" y="30" width="12" height="12" rx="2"></rect><path d="M24 8h2M24 14h2M22 22h5v5h-5zM31 24h4v4M38 24h4M24 33h3M31 32h3v8M39 32h3v3M22 39h5M39 40h3"></path></svg>';
    const imagePreview = method?.qr_image_url
        ? `<img src="${escapeHtml(method.qr_image_url)}" alt="Mã QR thanh toán">`
        : qrPlaceholder;
    const initialType = method?.type || 'qr';

    openModal({
        title: method ? 'Chỉnh sửa phương thức' : 'Thêm phương thức',
        body: `<form id="payment-method-form" class="payment-method-form" enctype="multipart/form-data">
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
                            <span class="payment-qr-preview" id="payment-method-qr-preview">${imagePreview}</span>
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
        </form>`,
        footer: '<span class="muted payment-method-footnote">POS sẽ chỉ hiển thị phương thức đang bật và đủ thông tin cần thiết.</span><div><button class="button primary" id="save-payment-method">Lưu phương thức</button></div>',
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

async function renderUsers() {
    const data=await api('/api/v1/admin/users');
    $('#page-content').classList.add('owner-users-page');
    $('#page-content').innerHTML=pageHead('NHÂN SỰ','Quản lý User','','<button class="button primary" id="add-user"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm tài khoản</button>')+`<div class="data-table-wrap"><table class="data-table user-admin-table"><thead><tr><th>THÀNH VIÊN</th><th>ĐĂNG NHẬP</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th></tr></thead><tbody>${data.users.map(user=>`<tr class="user-row-clickable" data-edit-user-row="${user.id}" tabindex="0" aria-label="Chỉnh sửa tài khoản ${escapeHtml(user.name)}"><td data-label="Thành viên"><strong>${escapeHtml(user.name)}</strong></td><td data-label="Đăng nhập">${escapeHtml(user.role==='admin'?user.username:user.email)}</td><td data-label="Vai trò">${user.role==='admin'?'Admin':'Nhân viên'}</td><td data-label="Trạng thái"><span class="pill ${user.is_active?'':'gray'}">${user.is_active?'Hoạt động':'Đã khóa'}</span></td></tr>`).join('')}</tbody></table></div>`;
    $('#add-user').onclick=()=>userForm();
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
    const initialRole = user?.role === 'admin' ? 'admin' : 'employee';
    const initial = (user?.name || 'T').trim().charAt(0).toUpperCase();
    const title = user ? `Chỉnh sửa ${initialRole === 'admin' ? 'quản trị viên' : 'nhân viên'}` : 'Thêm thành viên';
    openModal({
        title,
        body: `<form id="user-form" class="user-account-form">
            <div class="user-form-intro">
                <span class="user-form-avatar">${escapeHtml(initial)}</span>
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
        </form>`,
        footer: '<span class="muted user-form-footnote">Các thay đổi sẽ áp dụng ở lần đăng nhập tiếp theo.</span><div><button class="button primary" id="save-user">Lưu tài khoản</button></div>',
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
                    const result = await api(user ? `/api/v1/admin/users/${user.id}` : '/api/v1/admin/users', { method:user ? 'PUT' : 'POST', body:values });
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

async function renderMapAdmin() {
    const data = await api('/api/v1/admin/map');
    let type = 'coffee';
    let slots = data.tables.map(item => ({ ...item }));
    const mapIcons = {
        coffee: '<svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path><path d="M8 3v3M12 3v3"></path></svg>',
        fishing: '<svg viewBox="0 0 24 24"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path><circle cx="16.5" cy="11" r=".8" fill="currentColor" stroke="none"></circle></svg>',
    };
    const slotState = slot => !slot.is_enabled ? 'disabled' : (slot.state || 'available');
    const slotIsPaidReady = slot => slot.order?.status === 'paid';
    const slotStateClass = slot => `${slotState(slot)}${slotIsPaidReady(slot) ? ' paid-ready' : ''}`;
    const coffeeSlotStateLabel = slot => {
        const state = slotState(slot);
        if (state === 'disabled') return 'Tạm nghỉ';
        if (slotIsPaidReady(slot)) return 'Đã thanh toán';
        if (state === 'occupied') return 'Đang dùng';
        return 'Trống';
    };
    const coffeeSlotSubtitle = slot => {
        const state = slotState(slot);
        if (state === 'disabled') return 'Đang tạm khóa';
        if (state === 'occupied') return slot.order ? money(orderRemainingDue(slot.order)) : 'Đang phục vụ';
        return 'Sẵn sàng nhận khách';
    };
    const fishingSlotStatus = slot => {
        const state = slotState(slot);
        if (state === 'disabled') return { label: 'Tạm nghỉ', detail: 'Không nhận khách' };
        if (slotIsPaidReady(slot)) return { label: 'Đã thanh toán', detail: money(orderRemainingDue(slot.order)) };
        if (state === 'expired') return { label: 'Hết giờ', detail: slot.order ? money(slot.order.total) : 'Cần xử lý' };
        if (state === 'occupied') return { label: 'Đang câu', detail: slot.order ? money(slot.order.total) : 'Đang phục vụ' };
        return { label: 'Sẵn sàng', detail: 'Đang nhận khách' };
    };

    const coffeePreview = () => `<section class="pos-section admin-map-pos-preview">
        <div class="pos-section-head"><span class="muted">Chạm vào bàn để xem và chỉnh sửa thông tin</span>${slotLegend()}</div>
        <div class="pos-table-grid">${slots.map(slot => `<button type="button" class="pos-table-card ${slotStateClass(slot)}" data-admin-slot="${slot.id}"><span class="table-state">${coffeeSlotStateLabel(slot)}</span><strong>${escapeHtml(slot.label)}</strong><small>${escapeHtml(coffeeSlotSubtitle(slot))}</small></button>`).join('')}</div>
    </section>`;

    const fishingSlot = (slot, side, row) => {
        const status = fishingSlotStatus(slot);
        return `<button type="button" class="fishing-slot ${slotStateClass(slot)} side-${side}" style="grid-column:${side === 'left' ? 1 : 3};grid-row:${row}" data-admin-slot="${slot.id}">
        <span class="fishing-slot-number" data-admin-slot-label="${slot.id}">${escapeHtml(slot.label)}</span>
        <span><strong>${escapeHtml(status.label)}</strong><small>${escapeHtml(status.detail)}</small></span><i></i>
    </button>`;
    };

    const fishingPreview = () => {
        const mid = Math.ceil(slots.length / 2);
        const left = slots.slice(0, mid);
        const right = slots.slice(mid);
        const fish = '<svg viewBox="0 0 50 30"><path d="M5 15C15 5 30 7 40 15c-10 8-25 10-35 0Zm35 0 8-5-2 5 2 5-8-5Z"/></svg>';
        return `<section class="fishing-map-shell admin-fishing-preview">
            <div class="admin-fishing-note"><span>Sơ đồ cố định theo hai bờ, đồng bộ với màn hình POS</span>${slotLegend(true)}</div>
            <div class="fishing-lake-plan">
                <div class="lake-water"><div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU TRUNG TÂM</strong></div><span class="admin-fish fish-a" style="color:rgba(55,85,80,.15)">${fish}</span><span class="admin-fish fish-b" style="color:rgba(55,85,80,.15)">${fish}</span><span class="admin-fish fish-c" style="color:rgba(55,85,80,.15)">${fish}</span></div>
                ${left.map((slot, index) => fishingSlot(slot, 'left', index + 1)).join('')}
                ${right.map((slot, index) => fishingSlot(slot, 'right', right.length - index)).join('')}
            </div>
        </section>`;
    };

    const openResourceModal = slot => {
        const resourceName = type === 'coffee' ? 'bàn' : 'chòi';
        openModal({
            title: `Thông tin ${resourceName}`,
            body: `<form id="admin-resource-form" class="admin-resource-form">
                <div class="admin-resource-summary"><span>${type === 'coffee' ? mapIcons.coffee : mapIcons.fishing}</span><div><small>${type === 'coffee' ? 'KHU VỰC CÀ PHÊ' : 'KHU VỰC CÂU CÁ'}</small><strong>${escapeHtml(slot.label)}</strong></div><em class="${slot.is_enabled ? 'active' : ''}">${slot.is_enabled ? 'Đang hoạt động' : 'Tạm nghỉ'}</em></div>
                <label class="admin-resource-field">Tên ${resourceName}<input id="admin-resource-label" value="${escapeHtml(slot.label)}" maxlength="50" required></label>
                <label class="admin-resource-toggle-row" for="admin-resource-enabled"><span><strong>Cho phép sử dụng ${resourceName}</strong><small>${slot.is_enabled ? `Nhân viên có thể phục vụ tại ${resourceName} này.` : `${resourceName[0].toUpperCase() + resourceName.slice(1)} đang được ẩn khỏi thao tác phục vụ.`}</small></span><input id="admin-resource-enabled" type="checkbox" ${slot.is_enabled ? 'checked' : ''}><i aria-hidden="true"></i></label>
            </form>`,
            footer: `<span class="muted">Thay đổi sẽ áp dụng ngay trên POS.</span>
            <div style="display:flex; gap:8px;">
                <button class="button danger" id="delete-admin-resource" style="background:#e06666; color:white; border-radius:10px; min-height:36px; padding:6px 12px; font-size:11px;">Xóa</button>
                <button class="button primary" id="save-admin-resource" style="border-radius:10px; min-height:36px; padding:6px 12px; font-size:11px;">Lưu thay đổi</button>
            </div>`,
            onReady(modal, close) {
                $('#save-admin-resource', modal).onclick = async () => {
                    const label = $('#admin-resource-label', modal).value.trim();
                    const is_enabled = $('#admin-resource-enabled', modal).checked;
                    if (!label) {
                        toast(`Bạn vui lòng nhập tên ${resourceName} nhé.`, 'error');
                        return;
                    }
                    const updatedSlots = slots.map(item => item.id === slot.id ? { ...item, label, is_enabled } : item);
                    try {
                        const result = await api('/api/v1/admin/map', { method: 'PUT', body: { type, slots: updatedSlots.map(({ id, label, position_x, position_y, is_enabled }) => ({ id, label, position_x, position_y, is_enabled })) } });
                        slots = updatedSlots;
                        const source = type === 'coffee' ? data.tables : data.spots;
                        const original = source.find(item => item.id === slot.id);
                        if (original) Object.assign(original, { label, is_enabled });
                        toast(result.message);
                        close();
                        render();
                    } catch (error) {
                        toast(error.message, 'error');
                    }
                };

                const deleteBtn = modal.querySelector('#delete-admin-resource');
                if (deleteBtn) {
                    deleteBtn.onclick = async () => {
                        if (!confirm(`Bạn có chắc chắn muốn xóa ${resourceName} này?`)) return;
                        try {
                            const res = await api(`/api/v1/admin/map/${type}/${slot.id}`, { method: 'DELETE' });
                            toast(res.message || `Đã xóa ${resourceName} thành công.`);
                            close();
                            const freshData = await api('/api/v1/admin/map');
                            data.tables = freshData.tables;
                            data.spots = freshData.spots;
                            slots = (type === 'coffee' ? data.tables : data.spots).map(item => ({ ...item }));
                            render();
                        } catch (error) {
                            toast(error.message, 'error');
                        }
                    };
                }
            }
        });
    };

    const bind = () => $$('[data-admin-slot]').forEach(node => node.onclick = () => openResourceModal(slots.find(item => item.id === Number(node.dataset.adminSlot))));

    const render = () => {
        $('#map-editor').innerHTML = `<div class="admin-pos-map-view ${type === 'fishing' ? 'is-fishing' : 'is-coffee'}">${type === 'coffee' ? coffeePreview() : fishingPreview()}</div>`;
        bind();
    };

    const setupAddBtn = () => {
        const btn = $('#admin-add-resource-btn');
        if (btn) {
            btn.onclick = () => {
                const resourceName = type === 'coffee' ? 'bàn' : 'chòi';
                openModal({
                    title: `Thêm ${resourceName} mới`,
                    body: `<form id="admin-add-resource-form" class="admin-resource-form">
                        <div class="admin-resource-summary"><span>${type === 'coffee' ? mapIcons.coffee : mapIcons.fishing}</span><div><small>${type === 'coffee' ? 'KHU VỰC CÀ PHÊ' : 'KHU VỰC CÂU CÁ'}</small><strong>${type === 'coffee' ? 'Bàn mới' : 'Chòi mới'}</strong></div><em class="active">Đang hoạt động</em></div>
                        <label class="admin-resource-field">Tên ${resourceName}<input id="admin-add-resource-label" placeholder="Nhập tên..." maxlength="50" required></label>
                        <label class="admin-resource-toggle-row" for="admin-add-resource-enabled">
                            <span><strong>Cho phép sử dụng ${resourceName}</strong><small>Nhân viên có thể phục vụ tại ${resourceName} này.</small></span>
                            <input id="admin-add-resource-enabled" type="checkbox" checked>
                            <i aria-hidden="true"></i>
                        </label>
                    </form>`,
                    footer: `<span></span><div><button class="button primary" id="confirm-add-admin-resource">Thêm mới</button></div>`,
                    onReady(subModal, subClose) {
                        $('#confirm-add-admin-resource', subModal).onclick = async () => {
                            const label = $('#admin-add-resource-label', subModal).value.trim();
                            const is_enabled = $('#admin-add-resource-enabled', subModal).checked;
                            if (!label) {
                                toast(`Bạn vui lòng nhập tên ${resourceName} nhé.`, 'error');
                                return;
                            }
                            try {
                                const res = await api('/api/v1/admin/map', {
                                    method: 'POST',
                                    body: { type, label, is_enabled }
                                });
                                toast(res.message || `Đã thêm ${resourceName} mới thành công.`);
                                subClose();
                                const freshData = await api('/api/v1/admin/map');
                                data.tables = freshData.tables;
                                data.spots = freshData.spots;
                                slots = (type === 'coffee' ? data.tables : data.spots).map(item => ({ ...item }));
                                render();
                            } catch (error) {
                                toast(error.message, 'error');
                            }
                        };
                    }
                });
            };
        }
    };

    const toolbar = `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; width:100%;">
        <div class="admin-map-toolbar" role="tablist" aria-label="Chọn khu vực quản lý" style="margin-bottom:0;">
            <button class="admin-map-tab active" type="button" role="tab" aria-selected="true" data-map-type="coffee">${mapIcons.coffee}<span>Cà phê</span></button>
            <button class="admin-map-tab" type="button" role="tab" aria-selected="false" data-map-type="fishing">${mapIcons.fishing}<span>Câu cá</span></button>
        </div>
        <button class="button primary small" id="admin-add-resource-btn" style="padding: 8px 16px; font-size: 11px; display: inline-flex; align-items:center; gap:6px; min-height:40px; border-radius:12px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span id="add-resource-text">Thêm bàn</span>
        </button>
    </div>`;

    $('#page-content').innerHTML = pageHead('THIẾT LẬP', 'Quản lý Sơ đồ', '', toolbar) + `<div id="map-editor"></div>`;

    $$('[data-map-type]').forEach(button => button.onclick = () => {
        type = button.dataset.mapType;
        slots = (type === 'coffee' ? data.tables : data.spots).map(item => ({ ...item }));
        $$('[data-map-type]').forEach(item => {
            const active = item === button;
            item.classList.toggle('active', active);
            item.setAttribute('aria-selected', String(active));
        });
        const addBtnText = $('#add-resource-text');
        if (addBtnText) {
            addBtnText.textContent = type === 'coffee' ? 'Thêm bàn' : 'Thêm chòi';
        }
        render();
    });

    render();
    setupAddBtn();
}

function reasonAction(title,label,path,after){openModal({title,body:`<label>${label}<textarea id="reason" minlength="5" required placeholder="Ghi lại lý do để đội ngũ dễ đối soát…"></textarea></label>`,footer:`<span></span><div><button class="button danger" id="reason-confirm">Xác nhận</button></div>`,onReady(modal,close){$('#reason-confirm',modal).onclick=async()=>{try{const result=await api(path,{method:'POST',body:{reason:$('#reason',modal).value}});toast(result.message);close();after();}catch(error){toast(error.message,'error');}};}});}

if (document.body.dataset.view === 'login') setupLogin();
if (document.body.dataset.view === 'app') setupShell();
