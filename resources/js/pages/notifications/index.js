import { api } from '../../modules/api.js';
import { toast } from '../../modules/toast.js';
import { dateTime, escapeHtml, money, number, statusClass, statusLabel } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { createLifecycleScope } from '../../shell/lifecycle.js';
import { $, $$ } from '../../templates/dom.js';
import { orderServiceIcon, pollOrders, shouldPollOrders } from '../orders/list.js';
import { pollAdminMap, shouldPollAdminMap } from '../admin/map.js';
import { paymentMethodDisplayLabel } from '../pos/payment-methods.js';


let notificationToastBootstrapped = false;
let notificationToastSeen = new Set();
let notificationDrawerOpen = false;
let notificationDrawerPage = 1;
let notificationDrawerMeta = null;
let notificationDrawerItems = [];
const notificationDrawerLifecycle = createLifecycleScope();
let notificationDrawerFilters = { read: 'all', category: '' };

export function notificationToastOptions(notification) {
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

export function notificationCategory(notification) {
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

export function notificationDayGroup(value) {
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

export function closeNotificationDrawer() {
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

export function setupNotificationDrawer({ lifecycle = null } = {}) {
    if (!$('#notification-bell')) return;
    const listen = (target, eventName, callback) => {
        if (lifecycle?.listen) return lifecycle.listen(target, eventName, callback);
        target?.addEventListener?.(eventName, callback);
        return () => target?.removeEventListener?.(eventName, callback);
    };

    listen($('#notification-bell'), 'click', event => {
        event.stopPropagation();
        if (notificationDrawerOpen) closeNotificationDrawer();
        else openNotificationDrawer().catch(error => toast(error.message, 'error'));
    });
    listen($('#notification-drawer-close'), 'click', closeNotificationDrawer);
    listen($('#notification-drawer-scrim'), 'click', closeNotificationDrawer);
    listen($('#notification-read-all'), 'click', async () => {
        await api('/api/v1/notifications/read-all', { method: 'POST' });
        setNotificationBadge(0);
        await loadNotificationDrawer(1);
    });
    $$('#notification-drawer [data-notification-read-filter]').forEach(button => {
        listen(button, 'click', () => {
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
        listen(button, 'click', () => {
            notificationDrawerFilters.category = button.dataset.notificationCategory;
            $$('#notification-drawer [data-notification-category]').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            loadNotificationDrawer(1).catch(error => toast(error.message, 'error'));
        });
    });
    listen($('#notification-drawer-list'), 'click', event => {
        const more = event.target.closest('[data-notification-load-more]');
        if (more) {
            loadNotificationDrawer(notificationDrawerPage + 1, { append: true }).catch(error => toast(error.message, 'error'));
            return;
        }
        const row = event.target.closest('[data-notification-id]');
        if (row) handleNotificationClick(row.dataset.notificationId).catch(error => toast(error.message, 'error'));
    });
}


export async function pollNotificationToasts() {
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
