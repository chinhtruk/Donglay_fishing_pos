import { api } from './modules/api.js';
import { Cart } from './modules/cart.js';
import { dateTime, escapeHtml, formatMoneyInput, formatStoredMoneyInput, money, number, parseMoneyInput, statusClass, statusLabel } from './modules/format.js';
import { setupKeyboardViewportGuard } from './modules/keyboard.js';
import { confirmModal, openModal } from './modules/modal.js';
import { duration, remaining, ServerClock } from './modules/timers.js';
import { renderDashboard } from './pages/admin/dashboard.js';
import { configureAdminUsers, renderUsers } from './pages/admin/users.js';
import {
    paymentMethodFormFooter,
    paymentMethodFormTitle,
    renderPaymentMethodForm,
} from './pages/admin/forms.js';
import { configurePosOperationalReset, schedulePosOperationalReset } from './pages/pos/operational-day.js';
import {
    renderCoffeeOrderLines,
    renderCoffeeOrderPanel,
    renderEditableOrderLine,
    renderLineSectionHeader,
    renderOrderEmpty,
    renderOrderModalBody,
    renderPaidOrderLine,
} from './pages/pos/order-modal.js';
import {
    fishingMergeTargetChipHtml,
    fishingSessionLineTotalHtml,
    fishingSessionMetaHtml,
    fishingSessionMetricDateTime,
    fishingSessionNameHtml,
    formatDisplayPrice,
    hasMissingVariablePrice,
    orderBadgeHtml,
    orderCompletedPaymentTotal,
    orderedPosMenu,
    orderPaymentItemCountLabel,
    orderRemainingDue,
    orderStackIcon,
    paidQuantityForLine,
    posMenuCategories,
    requestVariablePrice,
    slotLegend,
} from './pages/pos/shared.js';
import { setupLiveClock } from './shell/page-head.js';
import { setupProfileMenu } from './shell/profile-menu.js';
import { createLifecycleScope } from './shell/lifecycle.js';
import { pageFromPath, renderRoutedPage } from './shell/router.js';
import { setupSidebar } from './shell/sidebar.js';
import { $, $$, cloneTemplate, emptyState, pageHead, setLoading } from './templates/dom.js';

setupKeyboardViewportGuard();
configurePosOperationalReset({ closeOpenModal, renderPage, toast });
const appLifecycle = createLifecycleScope();
const pageLifecycle = createLifecycleScope();
let notificationToastBootstrapped = false;
let notificationToastSeen = new Set();
let notificationDrawerOpen = false;
let notificationDrawerPage = 1;
let notificationDrawerMeta = null;
let notificationDrawerItems = [];
const notificationDrawerLifecycle = createLifecycleScope();
let notificationDrawerFilters = { read: 'all', category: '' };
let orderPollingTimer = null;
let orderPollingCleanup = null;
let orderPollSignature = '';
let isPollingOrders = false;
let adminMapPollingTimer = null;
let adminMapPollingCleanup = null;
let adminMapPollSignature = '';
let isPollingAdminMap = false;
let adminMapUpdateHandler = null;
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

    const node = cloneTemplate('tpl-toast') || document.createElement('div');
    node.className = `toast ${type}${options.sticky ? ' is-sticky' : ''}`;
    if (toastId) node.dataset.toastId = String(toastId);
    if (node.querySelector('[data-toast-icon]')) {
        const title = $('[data-toast-title]', node);
        const closeButton = $('.toast-close', node);
        $('[data-toast-icon]', node).textContent = payload.icon || toastIcon(type);
        $('[data-toast-message]', node).textContent = payload.message || '';
        if (payload.title) title.textContent = payload.title;
        else title.remove();
        if (!options.dismissible) closeButton.remove();
    } else {
        node.innerHTML = `
            <span class="toast-icon" aria-hidden="true">${escapeHtml(payload.icon || toastIcon(type))}</span>
            <span class="toast-copy">
                ${payload.title ? `<strong>${escapeHtml(payload.title)}</strong>` : ''}
                <span>${escapeHtml(payload.message || '')}</span>
            </span>
            ${options.dismissible ? '<button class="toast-close" type="button" aria-label="Tắt thông báo">×</button>' : ''}
        `;
    }

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

configureAdminUsers({ toast });

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

function setNotificationBadge(count = 0) {
    const badge = $('#notification-badge');
    if (!badge) return;
    const value = Number(count) || 0;
    badge.textContent = value > 99 ? '99+' : String(value);
    badge.classList.toggle('hidden', value <= 0);
    $('#notification-bell')?.classList.toggle('has-unread', value > 0);
}

function notificationCategory(notification) {
    const type = notification.data?.type || '';
    if (type.includes('payment')) return 'payments';
    if (type.includes('released') || type.includes('assigned') || type.includes('started') || type.includes('extended') || type.includes('expired')) return 'map';
    if (type.includes('order') || type.startsWith('counter')) return 'orders';
    return 'system';
}

function notificationCategoryLabel(category) {
    return {
        orders: 'Đơn hàng',
        payments: 'Thanh toán',
        map: 'Sơ đồ',
        system: 'Hệ thống'
    }[category] || 'Thông báo';
}

function notificationDayGroup(value) {
    const date = value ? new Date(value) : new Date();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const stamp = date.toLocaleDateString('vi-VN');
    if (stamp === today.toLocaleDateString('vi-VN')) return 'Hôm nay';
    if (stamp === yesterday.toLocaleDateString('vi-VN')) return 'Hôm qua';
    return 'Cũ hơn';
}

function notificationListPath(page = notificationDrawerPage) {
    const params = new URLSearchParams({
        page: String(page),
        per_page: '20'
    });
    if (notificationDrawerFilters.read === 'unread') params.set('unread', '1');
    if (notificationDrawerFilters.category) params.set('category', notificationDrawerFilters.category);

    return `/api/v1/notifications?${params.toString()}`;
}

function notificationRow(notification) {
    const category = notificationCategory(notification);
    const unread = !notification.read_at;
    const data = notification.data || {};

    return `<button type="button" class="notification-item ${unread ? 'is-unread' : ''}" data-notification-id="${escapeHtml(notification.id)}">
        <span class="notification-item-icon ${category}">${escapeHtml(notificationToastOptions(notification).icon || 'i')}</span>
        <span class="notification-item-copy">
            <span><strong>${escapeHtml(data.title || 'Thông báo mới')}</strong><small>${escapeHtml(notificationCategoryLabel(category))}</small></span>
            <em>${escapeHtml(data.message || 'Có cập nhật mới trong hệ thống.')}</em>
            <time>${escapeHtml(dateTime(notification.created_at))}</time>
        </span>
        ${unread ? '<i class="notification-unread-dot" aria-label="Chưa đọc"></i>' : ''}
    </button>`;
}

function renderNotificationDrawer() {
    const list = $('#notification-drawer-list');
    if (!list) return;
    if (!notificationDrawerItems.length) {
        list.innerHTML = '<div class="notification-empty">Chưa có thông báo nào trong bộ lọc này.</div>';
        return;
    }

    let currentGroup = '';
    const rows = notificationDrawerItems.map(notification => {
        const group = notificationDayGroup(notification.created_at);
        const groupHead = group !== currentGroup ? `<h3>${escapeHtml(group)}</h3>` : '';
        currentGroup = group;

        return `${groupHead}${notificationRow(notification)}`;
    }).join('');
    const canLoadMore = notificationDrawerMeta && notificationDrawerMeta.current_page < notificationDrawerMeta.last_page;
    list.innerHTML = `${rows}${canLoadMore ? '<button type="button" class="notification-load-more" data-notification-load-more>Xem thêm</button>' : ''}`;
}

async function loadNotificationDrawer(page = 1, options = {}) {
    const list = $('#notification-drawer-list');
    if (!list) return;
    if (!options.append) {
        list.innerHTML = '<div class="notification-empty">Đang tải thông báo...</div>';
    }

    const result = await api(notificationListPath(page));
    setNotificationBadge(result.unread_count);
    notificationDrawerMeta = result.meta || null;
    notificationDrawerPage = Number(notificationDrawerMeta?.current_page || page);
    notificationDrawerItems = options.append
        ? [...notificationDrawerItems, ...(result.notifications || [])]
        : (result.notifications || []);
    renderNotificationDrawer();
}

function closeNotificationDrawer() {
    const drawer = $('#notification-drawer');
    if (!drawer) return;
    notificationDrawerOpen = false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    $('#notification-drawer-scrim')?.classList.add('hidden');
    $('#notification-bell')?.setAttribute('aria-expanded', 'false');
    notificationDrawerLifecycle.unmount();
}

async function openNotificationDrawer() {
    const drawer = $('#notification-drawer');
    if (!drawer) return;
    notificationDrawerOpen = true;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('#notification-drawer-scrim')?.classList.remove('hidden');
    $('#notification-bell')?.setAttribute('aria-expanded', 'true');
    await loadNotificationDrawer(1);
    notificationDrawerLifecycle.unmount();
    notificationDrawerLifecycle.interval(() => {
        if (notificationDrawerOpen) loadNotificationDrawer(1).catch(() => {});
    }, 8000);
}

async function openNotificationOrderDetail(orderId) {
    const { order } = await api(`/api/v1/orders/${orderId}`);
    const completedPayments = order.payments.filter(payment => payment.status === 'completed');
    const paidAmount = completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remainingAmount = Math.max(0, Number(order.total) - paidAmount);
    const isCoffee = order.service_type === 'coffee';

    openModal({
        title: `Thông báo · ${order.order_number}`,
        wide: true,
        body: `<article class="notification-order-summary">
            <header>
                <span class="notification-order-icon">${orderServiceIcon(order.service_type)}</span>
                <div>
                    <small>${isCoffee ? 'CÀ PHÊ' : 'CÂU CÁ'} · ${escapeHtml(order.resource?.label || 'Chưa xác định')}</small>
                    <strong>${escapeHtml(order.order_number)}</strong>
                </div>
                <span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span>
            </header>
            <div class="notification-order-stats">
                <span><small>Tổng đơn</small><strong>${money(order.total)}</strong></span>
                <span><small>Đã thanh toán</small><strong>${money(paidAmount)}</strong></span>
                <span><small>Còn lại</small><strong>${money(remainingAmount)}</strong></span>
            </div>
            <section>
                <h4>Món trong đơn</h4>
                ${order.items.length ? order.items.map(item => `<div class="notification-order-line">
                    <span>x${number(item.quantity)}</span>
                    <div><strong>${escapeHtml(item.name)}</strong>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div>
                    <b>${money(item.line_total)}</b>
                </div>`).join('') : '<p class="notification-order-empty">Chưa có món trong đơn.</p>'}
            </section>
            <section>
                <h4>Thanh toán</h4>
                ${order.payments.length ? order.payments.map(payment => `<div class="notification-payment-line">
                    <div><strong>${escapeHtml(payment.payment_number)}</strong><small>${dateTime(payment.paid_at)} · ${paymentMethodDisplayLabel(payment.method)}</small></div>
                    <b>${money(payment.amount)}</b>
                </div>`).join('') : '<p class="notification-order-empty">Chưa phát sinh thanh toán.</p>'}
            </section>
        </article>`
    });
}

async function handleNotificationClick(notificationId) {
    const notification = notificationDrawerItems.find(item => String(item.id) === String(notificationId));
    if (!notification) return;
    try {
        await api(`/api/v1/notifications/${notification.id}/read`, { method: 'POST' });
        notification.read_at = new Date().toISOString();
        if (notificationDrawerFilters.read === 'unread') {
            await loadNotificationDrawer(1);
        } else {
            renderNotificationDrawer();
            const countResult = await api('/api/v1/notifications?unread=1&per_page=1');
            setNotificationBadge(countResult.unread_count);
        }
    } catch {
        /* keep navigation available even if read marking races */
    }

    const data = notification.data || {};
    if (data.order_id) {
        closeNotificationDrawer();
        await openNotificationOrderDetail(data.order_id);
        return;
    }

    if (data.url) {
        window.location.href = data.url;
    }
}

function setupNotificationDrawer() {
    if (!$('#notification-bell')) return;
    $('#notification-bell').addEventListener('click', event => {
        event.stopPropagation();
        if (notificationDrawerOpen) closeNotificationDrawer();
        else openNotificationDrawer().catch(error => toast(error.message, 'error'));
    });
    $('#notification-drawer-close')?.addEventListener('click', closeNotificationDrawer);
    $('#notification-drawer-scrim')?.addEventListener('click', closeNotificationDrawer);
    $('#notification-read-all')?.addEventListener('click', async () => {
        await api('/api/v1/notifications/read-all', { method: 'POST' });
        setNotificationBadge(0);
        await loadNotificationDrawer(1);
    });
    $$('#notification-drawer [data-notification-read-filter]').forEach(button => {
        button.addEventListener('click', () => {
            notificationDrawerFilters.read = button.dataset.notificationReadFilter;
            $$('#notification-drawer [data-notification-read-filter]').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            loadNotificationDrawer(1).catch(error => toast(error.message, 'error'));
        });
    });
    $$('#notification-drawer [data-notification-category]').forEach(button => {
        button.addEventListener('click', () => {
            notificationDrawerFilters.category = button.dataset.notificationCategory;
            $$('#notification-drawer [data-notification-category]').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            loadNotificationDrawer(1).catch(error => toast(error.message, 'error'));
        });
    });
    $('#notification-drawer-list')?.addEventListener('click', event => {
        const more = event.target.closest('[data-notification-load-more]');
        if (more) {
            loadNotificationDrawer(notificationDrawerPage + 1, { append: true }).catch(error => toast(error.message, 'error'));
            return;
        }
        const row = event.target.closest('[data-notification-id]');
        if (row) handleNotificationClick(row.dataset.notificationId).catch(error => toast(error.message, 'error'));
    });
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
    setupLiveClock();
    const page = pageFromPath(location.pathname);
    setupSidebar({ page });
    setupNotificationDrawer();
    setupProfileMenu({ api, confirmModal, closeNotificationDrawer });
    pollNotificationToasts();
    appLifecycle.interval(pollNotificationToasts, 3000);
    renderPage(page);
}

function closeOpenModal() {
    const root = $('#modal-root');
    if (!root) return;
    const closeButton = root.querySelector('.modal-close');
    if (closeButton) {
        closeButton.click();
        return;
    }
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
}

async function pollNotificationToasts() {
    try {
        const result = await api('/api/v1/notifications?unread=1&per_page=10');
        setNotificationBadge(result.unread_count);
        const unread = (result.notifications || []).filter(item => !item.read_at);
        if (!notificationToastBootstrapped) {
            unread.forEach(item => notificationToastSeen.add(String(item.id)));
            notificationToastBootstrapped = true;
            return;
        }

        const newUnread = unread.filter(item => !notificationToastSeen.has(String(item.id)));
        if (!newUnread.length) return;

        newUnread.reverse().forEach(item => {
            notificationToastSeen.add(String(item.id));
            const options = notificationToastOptions(item);

            toast({
                id: item.id,
                title: item.data?.title || 'Thông báo mới',
                message: item.data?.message || 'Có cập nhật mới trong hệ thống.',
                icon: options.icon
            }, options.variant, options);
        });

        if (notificationDrawerOpen) {
            loadNotificationDrawer(1).catch(() => {});
        }
        if (shouldPollOrders()) {
            await pollOrders(true);
        }
        if (shouldPollAdminMap()) {
            await pollAdminMap(true);
        }
    } catch { /* transient polling failures should stay quiet */ }
}

async function renderPage(page) {
    await renderRoutedPage(page, {
        renderers: {
            coffee: renderCoffee,
            fishing: renderFishing,
            orders: renderOrders,
            dashboard: renderDashboard,
            menu: renderMenuAdmin,
            map: renderMapAdmin,
            settings: renderSettingsAdmin,
            users: renderUsers,
        },
        beforeRender() {
            pageLifecycle.unmount();
            setLoading();
        },
        onError(error) {
            $('#page-content').innerHTML = emptyState('Mình chưa tải được khu vực này', error.message);
        },
    });
}

async function renderCoffee() {
    const data = await api('/api/v1/coffee/map');
    schedulePosOperationalReset(data);
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
        const makeCoffeeCartFromOrder = order => new Cart(order.items.filter(item => item.menu_item_id).map(item => ({ menu_item_id:item.menu_item_id, name:item.name, price:Number(item.unit_price), quantity:item.quantity, note:item.note || '' })));
        let cart = order ? makeCoffeeCartFromOrder(order) : new Cart();
        const refreshCurrentCoffeeOrder = async ({ syncCart = false } = {}) => {
            if (!currentOrder) return null;
            const result = await api(`/api/v1/orders/${currentOrder.id}`);
            currentOrder = result.order;
            if (syncCart) cart = makeCoffeeCartFromOrder(currentOrder);
            return currentOrder;
        };
        let activeCategory = 'Tất cả';

        const modalBody = renderOrderModalBody({ categories, menu: orderedMenu, activeCategory });

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
                        const paidQty = paidQuantityForLine(currentOrder, line.menu_item_id, line.price);
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
                    const totalItemCount = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
                    const unpaidItemCount = unpaidLines.reduce((sum, line) => sum + Number(line.unpaidQty || 0), 0);
                    const paymentCountLabel = orderPaymentItemCountLabel(unpaidItemCount, totalItemCount);

                    const linesHtml = renderCoffeeOrderLines({ unpaidLines, paidLines, menuItems: data.menu });
                    panel.innerHTML = renderCoffeeOrderPanel({
                        currentOrder,
                        linesHtml,
                        cartTotal: cart.total(),
                        totalPaid,
                        remainingDue,
                        paymentCountLabel,
                        canReleaseOnly,
                        hasLines: Boolean(lines.length),
                    });

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
                                const releaseTable = () => api(`/api/v1/coffee/orders/${currentOrder.id}/release`, {
                                    method: 'POST',
                                    body: { version: currentOrder.version }
                                });
                                try {
                                    await releaseTable();
                                } catch (error) {
                                    if (error.status !== 409) throw error;
                                    await refreshCurrentCoffeeOrder();
                                    await releaseTable();
                                }
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
                    const paidQty = paidQuantityForLine(currentOrder, id, price);
                    const newQty = Math.max(paidQty, cart.quantity(id, price) + delta);
                    cart.set({ id, name:item.name, price:price }, newQty, price);
                    renderModalBill();
                };

                const persistOrder = async () => {
                    if (!cart.values().length) throw new Error('Bạn chọn ít nhất một món để mở đơn nhé.');
                    if (hasMissingVariablePrice(cart, data.menu)) throw new Error('Bạn nhập giá cho món giá biến động trước khi lưu đơn nhé.');
                    const submit = async () => {
                        let orderObj = currentOrder;
                        if (!orderObj) {
                            const path = selectedTableId ? `/api/v1/coffee/tables/${selectedTableId}/orders` : '/api/v1/coffee/orders';
                            currentOrder = (await api(path, { method:'POST', body:{ items:cart.payload() } })).order;
                            return currentOrder;
                        }
                        const assignedId = orderObj.resource?.id || null;
                        if (assignedId !== selectedTableId) {
                            orderObj = (await api(`/api/v1/coffee/orders/${orderObj.id}/table`, { method:'PUT', body:{ version:orderObj.version, coffee_table_id:selectedTableId } })).order;
                        }
                        currentOrder = (await api(`/api/v1/coffee/orders/${orderObj.id}`, { method:'PUT', body:{ version:orderObj.version, items:cart.payload() } })).order;
                        return currentOrder;
                    };

                    try {
                        return await submit();
                    } catch (error) {
                        if (error.status !== 409 || !currentOrder) throw error;
                        await refreshCurrentCoffeeOrder();
                        return submit();
                    }
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
                        const mergeSourceOrder = async sourceOrder => {
                            const fetchLatestOrder = async () => (await api(`/api/v1/orders/${sourceOrder.id}`)).order;
                            const mergeOrder = orderToMerge => api(`/api/v1/coffee/orders/${orderToMerge.id}/merge`, {
                                method: 'POST',
                                body: { version: orderToMerge.version, target_table_id: targetTableId }
                            });
                            let latestOrder = await fetchLatestOrder();
                            try {
                                await mergeOrder(latestOrder);
                            } catch (error) {
                                if (error.status !== 409) throw error;
                                latestOrder = await fetchLatestOrder();
                                await mergeOrder(latestOrder);
                            }
                        };

                        for (const sourceOrder of sourceOrders) {
                            await mergeSourceOrder(sourceOrder);
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
    const paymentAccountInfo = method => `
        <div class="checkout-qr-account">
            ${method.account_name ? `<strong>${escapeHtml(method.account_name)}</strong>` : ''}
            ${method.account_number ? `<b>${escapeHtml(method.account_number)}</b>` : ''}
        </div>
    `;
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
    const checkoutItemQuantity = item => Number((item.quantity ?? (Number(item.paid_quantity || 0) + Number(item.unpaid_quantity || 0))) || 0);
    const checkoutBillTotal = order.items.reduce((sum, item) => sum + Number(item.unit_price) * checkoutItemQuantity(item), 0) || Number(order.total || 0);
    const checkoutPaidTotal = paid.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.paid_quantity || 0), 0);
    const checkoutTotalQuantity = order.items.reduce((sum, item) => sum + checkoutItemQuantity(item), 0);
    const checkoutUnpaidQuantity = unpaid.reduce((sum, item) => sum + Number(item.unpaid_quantity || 0), 0);
    const resourceLabel = order.resource?.label || (type === 'coffee' ? 'Đơn tại quầy' : 'Phiên câu');

    const body = `
        <div class="checkout-modal-layout">
            <section class="checkout-payment-section checkout-left-column">
                <div class="checkout-payment-heading">
                    <p class="eyebrow">THANH TOÁN</p>
                    <div class="checkout-heading-row">
                        <h3>Phương thức thanh toán</h3>
                        <small id="checkout-method-hint" class="checkout-method-chip">${escapeHtml(paymentMethodHint(initialPaymentMethod))}</small>
                    </div>
                </div>
                ${paymentMethods.length > 1 || transferMethods.length ? `
                    <div class="checkout-method-tabs" role="tablist" aria-label="Chọn phương thức thanh toán">
                        ${paymentMethods.map((method, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-payment-method="${escapeHtml(method.code)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(method.name)}</button>`).join('')}
                    </div>
                ` : ''}
                <div class="checkout-cash-panel checkout-payment-panel" data-payment-panel="cash">
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
                    <section class="checkout-qr-panel checkout-payment-panel hidden" data-payment-panel="${escapeHtml(method.code)}">
                        <div class="checkout-qr-image"><img src="${escapeHtml(method.qr_image_url)}" alt="Mã QR thanh toán"></div>
                        ${paymentAccountInfo(method)}
                    </section>
                `).join('')}
                <div class="summary-row checkout-change-row" style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; font-weight: 600;">
                    <span style="color: var(--muted);">Tiền thừa trả khách</span>
                    <span id="change-due" style="font-weight: 700; color: var(--moss);">0</span>
                </div>
                
                ${releaseHtml}
            </section>
            <aside class="modal-order-dock-aside checkout-receipt-aside">
                <div class="checkout-order-panel">
                    <div class="order-dock-head">
                        <div class="order-head-main">
                            <div class="order-title-block">
                                <p class="eyebrow">PHIẾU THANH TOÁN</p>
                                <h2>Đơn hiện tại - ${escapeHtml(resourceLabel)}</h2>
                            </div>
                            <div class="order-head-actions">
                                ${orderBadgeHtml(order)}
                            </div>
                        </div>
                    </div>
                    <div class="order-lines checkout-order-lines">
                        ${unpaid.length ? `
                            <div class="modal-lines-section-header unpaid-header">MÓN CẦN THANH TOÁN</div>
                            ${unpaid.map(item => `
                                <div class="order-line unpaid-item checkout-pay-line" data-bill-row="${item.id}">
                                    <label class="checkout-pay-check" aria-label="Chọn ${escapeHtml(item.name)} để thanh toán">
                                        <input type="checkbox" data-pay-check="${item.id}" checked>
                                        <span aria-hidden="true"></span>
                                    </label>
                                    <div class="order-line-title">
                                        <strong>${escapeHtml(item.name)}</strong>
                                        <small>${money(item.unit_price)} / món · còn ${number(item.unpaid_quantity)}</small>
                                        ${item.note ? `<em class="checkout-line-note">${escapeHtml(item.note)}</em>` : ''}
                                    </div>
                                    <input type="hidden" data-pay-qty="${item.id}" value="${item.unpaid_quantity}">
                                    <b id="pay-line-total-${item.id}">${money(item.unit_price * item.unpaid_quantity)}</b>
                                </div>
                            `).join('')}
                        ` : ''}
                        ${paid.length ? `
                            <div class="modal-lines-section-header paid-header">MÓN ĐÃ THANH TOÁN</div>
                            ${paid.map(item => `
                                <div class="order-line paid-item checkout-paid-line">
                                    <div class="order-line-title">
                                        <strong>${escapeHtml(item.name)}</strong>
                                        <small>${money(item.unit_price)} / món</small>
                                    </div>
                                    <div class="order-line-paid-row">
                                        <span class="order-line-paid-note ${item.note ? '' : 'is-empty'}">${item.note ? escapeHtml(item.note) : ''}</span>
                                        <div class="quantity"><b>× ${number(item.paid_quantity)}</b></div>
                                        <b>${money(item.unit_price * item.paid_quantity)}</b>
                                    </div>
                                </div>
                            `).join('')}
                        ` : ''}
                    </div>
                    <div class="order-dock-footer">
                        <div class="order-total-breakdown" aria-label="Chi tiết thanh toán">
                            <span>Tạm tính <b>${money(checkoutBillTotal)}</b></span>
                            ${checkoutPaidTotal > 0 ? `<span class="is-paid">Đã trả <b>${money(checkoutPaidTotal)}</b></span>` : ''}
                        </div>
                        <div class="summary-row total" style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 6px; padding-top: 10px; font-family: Georgia, serif; font-size: 16px; font-weight: 700;">
                            <span>Cần thanh toán <small class="order-total-count" id="checkout-selected-count">${orderPaymentItemCountLabel(checkoutUnpaidQuantity, checkoutTotalQuantity)}</small></span>
                            <strong id="checkout-total">0</strong>
                        </div>
                        <div class="order-actions checkout-actions" style="grid-template-columns: 1fr; margin-top: 10px;">
                            <button class="button primary" id="confirm-checkout">Hoàn tất thanh toán</button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    `;

    openModal({ title:`Thanh toán · ${order.order_number}`, body, wide: true, className: 'pos-checkout-modal pos-order-modal', onReady(modal, close) {
        let paymentMethod = initialPaymentMethod;
        const calculate = () => {
            let total = 0;
            let selectedQuantity = 0;
            let isFullPayment = true;
            unpaid.forEach(item => {
                const isChecked = $(`[data-pay-check="${item.id}"]`, modal).checked;
                const qtyVal = Number($(`input[data-pay-qty="${item.id}"]`, modal).value || 0);
                if (isChecked) {
                    total += Number(item.unit_price) * qtyVal;
                    selectedQuantity += qtyVal;
                    if (qtyVal < item.unpaid_quantity) {
                        isFullPayment = false;
                    }
                } else {
                    isFullPayment = false;
                }
            });
            $('#checkout-total', modal).textContent = money(total);
            $('#change-due', modal).textContent = paymentMethod !== 'cash' ? money(0) : money(Math.max(0, parseMoneyInput($('#cash-received', modal).value) - total));
            const selectedCountEl = $('#checkout-selected-count', modal);
            if (selectedCountEl) selectedCountEl.textContent = orderPaymentItemCountLabel(selectedQuantity, checkoutTotalQuantity);
            
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

        const handleCheckboxChange = (itemId, isChecked) => {
            const row = $(`input[data-pay-check="${itemId}"]`, modal).closest('[data-bill-row]');
            const lineTotal = $(`#pay-line-total-${itemId}`, row);
            row.classList.toggle('is-unselected', !isChecked);
            
            if (isChecked) {
                lineTotal.style.opacity = '1';
            } else {
                lineTotal.style.opacity = '0.4';
            }
        };

        modal.querySelectorAll('[data-pay-check]').forEach(cb => {
            cb.onchange = () => {
                const itemId = Number(cb.dataset.payCheck);
                handleCheckboxChange(itemId, cb.checked);
                calculate();
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
                if (error.status === 409) {
                    try {
                        const latestOrder = (await api(`/api/v1/orders/${order.id}`)).order;
                        toast('Hóa đơn vừa được làm mới. Bạn kiểm tra lại rồi xác nhận thanh toán nhé.', 'info');
                        close();
                        openCheckout(latestOrder, type, paymentSettings);
                    } catch {
                        toast(error.message, 'error');
                        close();
                        renderPage(type);
                    }
                    return;
                }
                toast(error.message, 'error');
            }
        };
    }});
}

async function renderFishing() {
    const data = await api('/api/v1/fishing/map'); const clock = new ServerClock(data.server_time);
    schedulePosOperationalReset(data);
    const mid = Math.ceil(data.spots.length / 2);
    const leftSpots = data.spots.slice(0, mid);
    const rightSpots = data.spots.slice(mid);
    const spotButton = (spot, side, row) => {
        const isPaid = spot.order && spot.order.status === 'paid';
        const stateClass = spot.state + (isPaid ? ' paid-ready' : '');
        const stateLabel = isPaid ? 'Đã thanh toán' : (spot.state === 'available' ? 'Sẵn sàng' : spot.state === 'disabled' ? 'Tạm nghỉ' : spot.state === 'expired' ? 'Hết giờ' : 'Đang câu');
        return `<button class="fishing-slot ${stateClass} side-${side}" style="grid-column:${side === 'left' ? 1 : 3};grid-row:${row}" data-spot="${spot.id}" ${spot.state === 'disabled' ? 'disabled' : ''}><span class="fishing-slot-number">${escapeHtml(spot.label)}</span><span><strong>${stateLabel}</strong><small ${spot.order ? `data-ends="${spot.order.fishing_session.ends_at}"` : ''}>${spot.state === 'available' ? 'Chạm để mở phiên' : spot.state === 'disabled' ? 'Chưa nhận khách' : duration(remaining(spot.order.fishing_session.ends_at, clock.now()))}</small></span><i></i></button>`;
    };
    $('#page-content').innerHTML = `<section class="fishing-map-shell"><div class="fishing-map-header"><span class="fishing-header-tip muted">Chạm chòi để mở hoặc xem phiên câu</span><div class="fishing-header-actions"><button class="button secondary small" id="btn-merge-mode">Gộp hóa đơn</button><button class="button primary small hidden" id="btn-merge-confirm" disabled>Xác nhận gộp (0)</button></div>${slotLegend(true)}</div><div class="fishing-lake-plan"><div class="lake-water"><div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU</strong></div><svg class="fish-swim fish-1" viewBox="0 0 50 30" style="position:absolute; width:46px; height:28px; fill:rgba(255,255,255,0.15); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-2" viewBox="0 0 50 30" style="position:absolute; width:38px; height:23px; fill:rgba(255,255,255,0.12); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-3" viewBox="0 0 50 30" style="position:absolute; width:32px; height:19px; fill:rgba(255,255,255,0.14); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><svg class="fish-swim fish-4" viewBox="0 0 50 30" style="position:absolute; width:26px; height:16px; fill:rgba(255,255,255,0.1); pointer-events:none;"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg><div class="water-flora group-top-right" style="position:absolute; right:15%; top:15%; display:flex; gap:4px; pointer-events:none;"><svg viewBox="0 0 30 30" width="30" height="30" style="transform:rotate(15deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg><svg viewBox="0 0 30 30" width="20" height="20" style="transform:rotate(-45deg); margin-left:-10px;"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-bottom-left" style="position:absolute; left:12%; bottom:12%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="26" height="26" style="transform:rotate(-110deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg><svg viewBox="0 0 30 30" width="18" height="18" style="transform:rotate(30deg); margin-left:-8px;"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-top-left" style="position:absolute; left:16%; top:18%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="22" height="22" style="transform:rotate(65deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div><div class="water-flora group-bottom-right" style="position:absolute; right:18%; bottom:16%; display:flex; pointer-events:none;"><svg viewBox="0 0 30 30" width="24" height="24" style="transform:rotate(-140deg);"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg></div></div>${leftSpots.map((spot, index) => spotButton(spot, 'left', index + 1)).join('')}${rightSpots.map((spot, index) => spotButton(spot, 'right', rightSpots.length - index)).join('')}</div></section>`;
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

    const tick = () => $$('[data-ends]').forEach(node => { const ms = remaining(node.dataset.ends, clock.now()); node.textContent = ms ? duration(ms) : 'Đã hết giờ'; node.closest('.fishing-slot')?.classList.toggle('expired', ms === 0); });
    tick();
    pageLifecycle.interval(tick, 1000);
    
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
    const takeawaySessionPrice = Number(fishingConfig.session_price || 200000);
    const withoutFishSessionPrice = Number(fishingConfig.session_without_fish_price || 150000);

    if (!spot.order) {
        if (!await confirmModal(`Bắt đầu · ${escapeHtml(spot.label)}`, `Mở phiên câu 4 giờ với giá ${money(takeawaySessionPrice)}? Đồng hồ sẽ bắt đầu ngay sau khi xác nhận.`, 'Bắt đầu phiên')) return;
        try { const result = await api(`/api/v1/fishing/spots/${spot.id}/start`, { method:'POST' }); toast(result.message); renderFishing(); } catch(error) { toast(error.message, 'error'); }
        return;
    }

    let currentOrder = spot.order;
    const initialSession = currentOrder.fishing_session;
    const sessionDefaults = currentOrder.items.find(item => item.line_type === 'fishing_session');
    const configuredSessionMinutes = Number(fishingConfig.session_minutes || 240);
    const configuredSessionPrice = Number(fishingConfig.session_price || sessionDefaults?.unit_price || takeawaySessionPrice);
    const paymentSettings = fishingConfig.payment_settings || {};
    const availableSpots = Array.isArray(fishingConfig.spots) ? fishingConfig.spots : [];
    const makeFishingCartFromOrder = order => new Cart(order.items.filter(item => item.menu_item_id).map(item => ({ menu_item_id:item.menu_item_id, name:item.name, price:Number(item.unit_price), quantity:item.quantity, note:item.note || '' })));
    let cart = makeFishingCartFromOrder(currentOrder);
    const refreshCurrentFishingOrder = async ({ syncCart = false } = {}) => {
        const result = await api(`/api/v1/orders/${currentOrder.id}`);
        currentOrder = result.order;
        if (syncCart) cart = makeFishingCartFromOrder(currentOrder);
        return currentOrder;
    };
    let activeCategory = 'Tất cả';
    const orderedMenu = orderedPosMenu(menu);
    const categories = posMenuCategories(orderedMenu);

    const modalBody = renderOrderModalBody({ categories, menu: orderedMenu, activeCategory });

    openModal({
        title: `${escapeHtml(spot.label)} · ${initialSession.status === 'expired' ? 'Đã hết giờ' : 'Đang câu'}`,
        body: modalBody,
        wide: true,
        onReady(modal, closeModal) {
            const renderModalBill = () => {
                const panel = modal.querySelector('#modal-order-panel');
                const lines = cart.values();
                const session = currentOrder.fishing_session;
                
                const sessionItem = currentOrder.items.find(item => item.line_type === 'fishing_session');
                const sessionPrice = sessionItem ? Number(sessionItem.unit_price) : takeawaySessionPrice;
                const sessionQty = sessionItem ? Number(sessionItem.quantity) : Number(session.blocks_count);
                const mainSessionTotal = sessionPrice * sessionQty;
                const mainSessionPaid = sessionItem ? Number(sessionItem.paid_quantity) : 0;
                const mainSessionUnpaid = sessionQty - mainSessionPaid;
                const fishTakeawayChecked = sessionPrice !== withoutFishSessionPrice;
                const fishTakeawayLocked = mainSessionPaid > 0;

                const mergedSessionItems = currentOrder.items.filter(item => item.line_type === 'merged_session');
                const mergedSessionsTotal = mergedSessionItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
                const hourlyExtensionItems = currentOrder.items.filter(item => item.line_type === 'hourly_extension');
                const hourlyExtensionTotal = hourlyExtensionItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);

                const sessionTotal = mainSessionTotal + mergedSessionsTotal + hourlyExtensionTotal;
                const totalBill = sessionTotal + cart.total();
                const totalPaid = orderCompletedPaymentTotal(currentOrder);
                let unpaidItemCount = Math.max(0, mainSessionUnpaid);
                let totalItemCount = sessionQty;

                const unpaidHtmls = [];
                const paidHtmls = [];

                if (mainSessionUnpaid > 0) {
                    unpaidHtmls.push(`
                        <div class="order-line unpaid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                            <div>
                                <strong style="font-family: Georgia, serif; font-size: 13px;">${fishingSessionNameHtml(sessionItem?.name || 'Phiên câu 4 giờ')}</strong>
                                ${fishingSessionMetaHtml(sessionPrice, fishTakeawayChecked)}
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionUnpaid}</b></div>
                            ${fishingSessionLineTotalHtml(sessionPrice, mainSessionUnpaid, fishTakeawayChecked, takeawaySessionPrice)}
                        </div>
                    `);
                }
                if (mainSessionPaid > 0) {
                    paidHtmls.push(`
                        <div class="order-line paid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                            <div>
                                <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${fishingSessionNameHtml(sessionItem?.name || 'Phiên câu 4 giờ')}</strong>
                                ${fishingSessionMetaHtml(sessionPrice, fishTakeawayChecked, true)}
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionPaid}</b></div>
                            ${fishingSessionLineTotalHtml(sessionPrice, mainSessionPaid, fishTakeawayChecked, takeawaySessionPrice, '#2e5a32')}
                        </div>
                    `);
                }

                mergedSessionItems.forEach(mSession => {
                    const mPaid = Number(mSession.paid_quantity) || 0;
                    const mUnpaid = Number(mSession.quantity) - mPaid;
                    totalItemCount += Number(mSession.quantity) || 0;
                    unpaidItemCount += Math.max(0, mUnpaid);
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

                hourlyExtensionItems.forEach(extensionItem => {
                    const paidQty = Number(extensionItem.paid_quantity) || 0;
                    const unpaidQty = Number(extensionItem.quantity) - paidQty;
                    totalItemCount += Number(extensionItem.quantity) || 0;
                    unpaidItemCount += Math.max(0, unpaidQty);
                    if (unpaidQty > 0) {
                        unpaidHtmls.push(`
                            <div class="order-line unpaid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line);">
                                <div>
                                    <strong style="font-family: Georgia, serif; font-size: 13px;">${escapeHtml(extensionItem.name)}</strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(extensionItem.unit_price)} / lượt</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${unpaidQty}</b></div>
                                <b style="align-self: center; font-size: 10px; color: #785943; text-align:right;">${money(Number(extensionItem.unit_price) * unpaidQty)}</b>
                            </div>
                        `);
                    }
                    if (paidQty > 0) {
                        paidHtmls.push(`
                            <div class="order-line paid-item session-item" style="display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); background: #f4faf6; border-left: 3px solid #28a745; padding-left: 8px; border-radius: 4px;">
                                <div>
                                    <strong style="font-family: Georgia, serif; font-size: 13px; color: #1e4620;">${escapeHtml(extensionItem.name)} <span style="font-size:9px; background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; margin-left:4px; font-family:var(--font-sans); font-weight:600;">✓ Đã trả</span></strong>
                                    <small style="color: var(--muted); font-size: 8px; display: block; margin-top: 4px;">${money(extensionItem.unit_price)} / lượt</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${paidQty}</b></div>
                                <b style="align-self: center; font-size: 10px; color: #2e5a32; text-align:right;">${money(Number(extensionItem.unit_price) * paidQty)}</b>
                            </div>
                        `);
                    }
                });

                lines.forEach(line => {
                    const paidQty = paidQuantityForLine(currentOrder, line.menu_item_id, line.price);
                    const unpaidQty = line.quantity - paidQty;
                    totalItemCount += Number(line.quantity || 0);
                    unpaidItemCount += Math.max(0, unpaidQty);
                    if (unpaidQty > 0) {
                        unpaidHtmls.push(renderEditableOrderLine(line, unpaidQty, menu));
                    }
                    if (paidQty > 0) {
                        paidHtmls.push(renderPaidOrderLine(line, paidQty));
                    }
                });

                let linesHtml = '';
                if (unpaidHtmls.length) {
                    linesHtml += renderLineSectionHeader('MÓN CHƯA THANH TOÁN', 'unpaid-header');
                    linesHtml += unpaidHtmls.join('');
                }
                if (paidHtmls.length) {
                    linesHtml += renderLineSectionHeader('MÓN ĐÃ THANH TOÁN', 'paid-header');
                    linesHtml += paidHtmls.join('');
                }
                if (!unpaidHtmls.length && !paidHtmls.length) {
                    linesHtml = renderOrderEmpty();
                }
                const paymentCountLabel = orderPaymentItemCountLabel(unpaidItemCount, totalItemCount);

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
                            <span class="order-session-metrics">
                                <span><small>Bắt đầu</small><strong>${fishingSessionMetricDateTime(session.started_at)}</strong></span>
                                <span><small>Kết thúc</small><strong>${fishingSessionMetricDateTime(session.ends_at)}</strong></span>
                                <span><small>Số phiên</small><strong>${number(sessionQty)} phiên</strong></span>
                            </span>
                            <label class="fish-takeaway-toggle ${fishTakeawayLocked ? 'is-locked' : ''}" for="fish-takeaway-toggle">
                                <input id="fish-takeaway-toggle" type="checkbox" ${fishTakeawayChecked ? 'checked' : ''} ${fishTakeawayLocked ? 'disabled' : ''}>
                                <span class="fish-takeaway-switch" aria-hidden="true"></span>
                                <span class="fish-takeaway-copy">
                                    <strong>Khách lấy cá mang về</strong>
                                    <small>${fishTakeawayLocked ? 'Phiên câu đã thanh toán nên không thể đổi' : fishTakeawayChecked ? `Giữ giá phiên câu ${money(takeawaySessionPrice)}` : `Không lấy cá, phiên câu còn ${money(withoutFishSessionPrice)}`}</small>
                                </span>
                                <b>${money(sessionPrice)}</b>
                            </label>
                        </div>
                    </div>

                    <div class="order-lines">
                        ${linesHtml}
                    </div>
                    
                    <div class="order-dock-footer">
	                        <div class="order-total-breakdown" aria-label="Chi tiết tạm tính">
	                            <span>Nước <b>${money(cart.total())}</b></span>
	                            <span>Giờ câu <b>${money(sessionTotal)}</b></span>
	                            ${totalPaid > 0 ? `<span class="is-paid">Đã trả <b>${money(totalPaid)}</b></span>` : ''}
	                        </div>
	                        <div class="summary-row total order-total-row">
                            <span>${totalPaid > 0 ? 'Còn lại cần trả' : 'Khách cần trả'} <small class="order-total-count">${paymentCountLabel}</small></span>
                            <strong>${money(Math.max(0, totalBill - totalPaid))}</strong>
                        </div>
                        <div class="order-actions ${currentOrder && currentOrder.status === 'paid' ? 'fishing-paid' : 'fishing-open'}">
                            ${currentOrder && currentOrder.status === 'paid' ? `
                                <button class="button secondary" id="extend-session">
                                    Gia hạn
                                </button>
                                <button class="button primary order-action-stacked" id="modal-release-spot">
                                    <span>Trả chòi & Giải phóng</span>
                                    <small>Khách rời đi</small>
                                </button>
                            ` : `
                                <button class="button secondary" id="extend-session">
                                    Gia hạn
                                </button>
                                <button class="button secondary" id="modal-save-order">
                                    Lưu lại
                                </button>
                                <button class="button primary" id="modal-checkout-order">
                                    Thanh toán
                                </button>
                            `}
                        </div>
                    </div>`;

                modal.querySelectorAll('[data-modal-minus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalMinus), Number(button.dataset.modalPrice), -1));
                modal.querySelectorAll('[data-modal-plus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalPlus), Number(button.dataset.modalPrice), 1));

                const fishTakeawayToggle = modal.querySelector('#fish-takeaway-toggle');
                if (fishTakeawayToggle) {
                    fishTakeawayToggle.onchange = async () => {
                        const enabled = fishTakeawayToggle.checked;
                        fishTakeawayToggle.disabled = true;
                        try {
                            const updateTakeaway = () => api(`/api/v1/fishing/orders/${currentOrder.id}/fish-takeaway`, {
                                method: 'POST',
                                body: { version: currentOrder.version, enabled },
                            });
                            let result;
                            try {
                                result = await updateTakeaway();
                            } catch (error) {
                                if (error.status !== 409) throw error;
                                await refreshCurrentFishingOrder();
                                result = await updateTakeaway();
                            }
                            currentOrder = result.order;
                            toast(result.message);
                            renderModalBill();
                        } catch (error) {
                            toast(error.message, 'error');
                            if (error.status === 409) {
                                closeModal();
                                await renderFishing();
                            } else {
                                renderModalBill();
                            }
                        }
                    };
                }

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
                            const hourlyPrice = Number(fishingConfig.hourly_extension_price || 50000);
                            const durationText = blocks => {
                                const minutes = sessionMinutes * blocks;
                                return minutes % 60 === 0 ? `${number(minutes / 60)} giờ` : `${number(minutes)} phút`;
                            };
                            const extendChoices = [
                                { mode: 'session', blocks: 1, label: 'Gia hạn 1 phiên câu', detail: durationText(1), price: sessionPrice },
                                { mode: 'hour', hours: 1, label: 'Gia hạn 1 giờ', detail: '1 giờ', price: hourlyPrice },
                                { mode: 'hour', hours: 2, label: 'Gia hạn 2 giờ', detail: '2 giờ', price: hourlyPrice * 2 },
                                { mode: 'hour', hours: 3, label: 'Gia hạn 3 giờ', detail: '3 giờ', price: hourlyPrice * 3 },
                            ];
                            const extendOptions = extendChoices.map((choice, index) => `
                                <button type="button" class="merge-target-chip extend-session-chip ${index === 0 ? 'is-selected' : ''}" data-extend-choice="${index}" aria-pressed="${index === 0 ? 'true' : 'false'}">
                                    <span class="merge-target-main"><strong>${escapeHtml(choice.label)}</strong><em>${escapeHtml(choice.detail)}</em></span>
                                    <small>${money(choice.price)}</small>
                                </button>
                            `).join('');
                            const choice = await new Promise((resolve) => {
                                let selectedChoice = extendChoices[0];
                                openModal({
                                    title: 'Gia hạn phiên câu',
                                    body: `<div class="merge-target-panel extend-session-panel"><div class="merge-target-label">Chọn thời lượng gia hạn</div><div class="merge-target-grid extend-session-grid">${extendOptions}</div></div><p class="merge-target-note extend-session-note">Có thể gia hạn trọn ${durationText(1)} hoặc theo giờ với giá ${money(hourlyPrice)} / giờ. Tiền gia hạn sẽ được cộng vào phiếu bán hàng hiện tại.</p>`,
                                    footer: `<span></span><div><button class="button primary" id="confirm-extend-btn">Xác nhận</button></div>`,
                                    onReady(subModal, subClose) {
                                        subModal.querySelectorAll('[data-extend-choice]').forEach(button => {
                                            button.onclick = () => {
                                                selectedChoice = extendChoices[Number(button.dataset.extendChoice)] || extendChoices[0];
                                                subModal.querySelectorAll('[data-extend-choice]').forEach(item => {
                                                    const isSelected = item === button;
                                                    item.classList.toggle('is-selected', isSelected);
                                                    item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                                                });
                                            };
                                        });
                                        subModal.querySelector('#confirm-extend-btn').onclick = () => {
                                            subClose();
                                            resolve(selectedChoice);
                                        };
                                    }
                                });
                            });
                            if (!choice) return;
                            const result = await api(`/api/v1/fishing/orders/${currentOrder.id}/extend`, {
                                method: 'POST',
                                body: choice.mode === 'hour'
                                    ? { version: currentOrder.version, mode: 'hour', hours: choice.hours }
                                    : { version: currentOrder.version, mode: 'session', blocks: choice.blocks }
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
                const paidQty = paidQuantityForLine(currentOrder, id, price);
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
            order.activity_at || '',
            order.completed_at || ''
        ])
    });
}

function shouldPollOrders() {
    return ['admin', 'employee'].includes(document.body.dataset.role) && location.pathname.endsWith('/orders');
}

function stopOrderPolling() {
    orderPollingCleanup?.();
    orderPollingCleanup = null;
    orderPollingTimer = null;
    orderPollSignature = '';
    isPollingOrders = false;
}

function adminMapSlotSignature(slot) {
    return [
        slot.id,
        slot.label,
        slot.is_enabled ? 1 : 0,
        slot.state || '',
        slot.order?.id || '',
        slot.order?.status || '',
        slot.order?.version || '',
        slot.order?.total || '',
        slot.order?.completed_at || '',
        slot.order?.fishing_session?.status || '',
        slot.order?.fishing_session?.ends_at || ''
    ];
}

function adminMapSignature(data) {
    return JSON.stringify({
        tables: (data.tables || []).map(adminMapSlotSignature),
        spots: (data.spots || []).map(adminMapSlotSignature)
    });
}

function shouldPollAdminMap() {
    return document.body.dataset.role === 'admin' && location.pathname.endsWith('/map');
}

function stopAdminMapPolling() {
    adminMapPollingCleanup?.();
    adminMapPollingCleanup = null;
    adminMapPollingTimer = null;
    adminMapPollSignature = '';
    isPollingAdminMap = false;
    adminMapUpdateHandler = null;
}

function startAdminMapPolling() {
    if (!shouldPollAdminMap() || adminMapPollingTimer) return;
    adminMapPollingTimer = window.setInterval(() => pollAdminMap(), 3000);
    adminMapPollingCleanup = pageLifecycle.add(() => {
        window.clearInterval(adminMapPollingTimer);
        adminMapPollingTimer = null;
        adminMapPollSignature = '';
        isPollingAdminMap = false;
        adminMapUpdateHandler = null;
        adminMapPollingCleanup = null;
    });
}

async function pollAdminMap(force = false) {
    if (isPollingAdminMap || !shouldPollAdminMap() || typeof adminMapUpdateHandler !== 'function') return;
    isPollingAdminMap = true;
    try {
        const result = await api('/api/v1/admin/map');
        const signature = adminMapSignature(result);
        if (force || (adminMapPollSignature && signature !== adminMapPollSignature)) {
            adminMapUpdateHandler(result);
        }
        adminMapPollSignature = signature;
    } catch {
        /* keep polling quiet; the next interval can recover */
    } finally {
        isPollingAdminMap = false;
    }
}

function startOrderPolling() {
    if (!shouldPollOrders() || orderPollingTimer) return;
    orderPollingTimer = window.setInterval(() => pollOrders(), 3000);
    orderPollingCleanup = pageLifecycle.add(() => {
        window.clearInterval(orderPollingTimer);
        orderPollingTimer = null;
        orderPollSignature = '';
        isPollingOrders = false;
        orderPollingCleanup = null;
    });
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

async function pollOrders(force = false) {
    if (isPollingOrders || !shouldPollOrders()) return;
    const admin = document.body.dataset.role === 'admin';
    const page = admin ? adminOrdersPage : employeeOrdersPage;
    isPollingOrders = true;
    try {
        const result = await api(ordersApiPath(page, admin));
        if (!admin) schedulePosOperationalReset(result);
        const signature = ordersSignature(result);
        if (force || (orderPollSignature && signature !== orderPollSignature)) {
            if (admin) adminOrdersPage = Number(result.meta?.current_page || page);
            else employeeOrdersPage = Number(result.meta?.current_page || page);
            renderOrdersResult(result, admin);
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
    if (!admin) schedulePosOperationalReset(result);
    if (requestedPage > Number(result.meta?.last_page || 1)) return renderOrders(Number(result.meta?.last_page || 1));
    if (admin) adminOrdersPage = Number(result.meta?.current_page || requestedPage);
    else employeeOrdersPage = Number(result.meta?.current_page || requestedPage);
    renderOrdersResult(result, admin);
    if (admin && options.focusSearch) {
        const search = $('#admin-order-search');
        search?.focus({ preventScroll: true });
        search?.setSelectionRange(search.value.length, search.value.length);
    }
    orderPollSignature = ordersSignature(result);
    startOrderPolling();
}

function orderTable(orders, admin) {
    const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    if (!admin) {
        return `<div class="data-table-wrap"><table class="data-table staff-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(order.activity_at || order.opened_at)}</td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="5"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
    }
    return `<div class="data-table-wrap"><table class="data-table admin-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TỔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(order.opened_at)}</td><td data-label="Tổng"><strong>${money(order.total)}</strong></td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="6"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
}

function orderTimeKey(value) {
    const date = value ? new Date(value) : new Date(0);
    if (Number.isNaN(date.getTime())) return '';
    date.setMilliseconds(0);
    return date.toISOString();
}

function orderTimeLabel(value) {
    if (!value) return 'Chưa rõ thời gian';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa rõ thời gian';

    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(date);
}

function groupOrderItemsByTime(items) {
    const groups = new Map();
    [...items]
        .sort((a, b) => new Date(a.ordered_at || a.created_at || 0) - new Date(b.ordered_at || b.created_at || 0) || Number(a.id) - Number(b.id))
        .forEach(item => {
            const key = orderTimeKey(item.ordered_at || item.created_at);
            if (!groups.has(key)) {
                groups.set(key, {
                    ordered_at: item.ordered_at || item.created_at,
                    items: [],
                });
            }
            groups.get(key).items.push(item);
        });

    return [...groups.values()];
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
            const staffItemGroups = groupOrderItemsByTime(order.items);
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
                        ${staffItemGroups.map((group, index) => `<section class="staff-order-time-group">
                            <header class="staff-order-time-head">
                                <span>Lần ${number(index + 1)}</span>
                                <strong>${escapeHtml(`Gọi lúc ${orderTimeLabel(group.ordered_at)}`)}</strong>
                            </header>
                            <div class="staff-order-time-lines">
                                ${group.items.map(item => `<div class="pos-receipt-line">
                                    <span class="receipt-quantity staff-item-quantity" aria-label="Số lượng ${number(item.quantity)}">x${number(item.quantity)}</span>
                                    <div>
                                        <strong>${escapeHtml(item.name)}</strong>
                                        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
                                    </div>
                                </div>`).join('')}
                            </div>
                        </section>`).join('')}
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
                <div class="lake-water"><div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU</strong></div><span class="admin-fish fish-a" style="color:rgba(55,85,80,.15)">${fish}</span><span class="admin-fish fish-b" style="color:rgba(55,85,80,.15)">${fish}</span><span class="admin-fish fish-c" style="color:rgba(55,85,80,.15)">${fish}</span></div>
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

    const syncMapData = freshData => {
        data.tables = freshData.tables || [];
        data.spots = freshData.spots || [];
        slots = (type === 'coffee' ? data.tables : data.spots).map(item => ({ ...item }));
        render();
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
    adminMapUpdateHandler = syncMapData;
    adminMapPollSignature = adminMapSignature(data);
    startAdminMapPolling();
}

function reasonAction(title,label,path,after){openModal({title,body:`<label>${label}<textarea id="reason" minlength="5" required placeholder="Ghi lại lý do để đội ngũ dễ đối soát…"></textarea></label>`,footer:`<span></span><div><button class="button danger" id="reason-confirm">Xác nhận</button></div>`,onReady(modal,close){$('#reason-confirm',modal).onclick=async()=>{try{const result=await api(path,{method:'POST',body:{reason:$('#reason',modal).value}});toast(result.message);close();after();}catch(error){toast(error.message,'error');}};}});}

if (document.body.dataset.view === 'login') setupLogin();
if (document.body.dataset.view === 'app') setupShell();
