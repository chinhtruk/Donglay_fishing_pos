import { api } from '../../modules/api.js';
import { dateTime, escapeHtml, money, number, statusClass, statusLabel } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$, emptyState, pageHead } from '../../templates/dom.js';
import { bindPagination, paginationMarkup } from '../admin/pagination.js';
import { menuSearchIcon } from '../admin/search-icon.js';
import { paymentMethodDisplayLabel } from '../pos/payment-methods.js';
import { orderStackIcon } from '../pos/shared.js';
import { schedulePosOperationalReset, stopPosOperationalReset } from '../pos/operational-day.js';


let orderPollingTimer = null;
let orderPollingCleanup = null;
let orderPollSignature = '';
let isPollingOrders = false;
let adminOrdersPage = 1;
let employeeOrdersPage = 1;
let adminOrderFilters = { service_type: '', status: '', q: '' };
let adminOrderSearchTimer = null;
let ordersLifecycle = null;

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

export function shouldPollOrders() {
    return ['admin', 'employee'].includes(document.body.dataset.role) && location.pathname.endsWith('/orders');
}

function stopOrderPolling() {
    orderPollingCleanup?.();
    orderPollingCleanup = null;
    orderPollingTimer = null;
    orderPollSignature = '';
    isPollingOrders = false;
}


function startOrderPolling() {
    if (!shouldPollOrders() || orderPollingTimer) return;
    orderPollingTimer = true;
    orderPollingCleanup = ordersLifecycle.interval(() => pollOrders(), 3000);
    ordersLifecycle.add(() => {
        orderPollingTimer = null;
        orderPollSignature = '';
        isPollingOrders = false;
        orderPollingCleanup = null;
    });
}

export function orderServiceIcon(type = '') {
    if (type === 'coffee') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path></svg>';
    }
    if (type === 'fishing') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path></svg>';
    }

    return orderStackIcon();
}

export function adminOrderStatusOptions() {
    return [
        { value: '', label: 'Tất cả' },
        { value: 'open', label: 'Đang mở' },
        { value: 'partially_paid', label: 'Trả một phần' },
        { value: 'paid', label: 'Hoàn tất' },
    ];
}

function adminOrderFilterMarkup() {
    const statusOptions = adminOrderStatusOptions();

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
        adminOrderSearchTimer?.();
        adminOrderSearchTimer = ordersLifecycle.timeout(() => {
            adminOrderSearchTimer = null;
            applySearch(true);
        }, 260);
    });

    search.addEventListener('search', () => {
        adminOrderSearchTimer?.();
        adminOrderSearchTimer = null;
        applySearch(true);
    });

    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        adminOrderSearchTimer?.();
        adminOrderSearchTimer = null;
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

export async function pollOrders(force = false) {
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

export async function renderOrders(page = null, options = {}) {
    const admin = document.body.dataset.role === 'admin';
    const requestedPage = Number(page || (admin ? adminOrdersPage : employeeOrdersPage));
    const result = await api(ordersApiPath(requestedPage, admin));
    if (!admin) schedulePosOperationalReset(result, ordersLifecycle);
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
        return `<div class="data-table-wrap"><table class="data-table staff-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(employeeOrderDisplayTime(order))}</td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="5"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
    }
    return `<div class="data-table-wrap"><table class="data-table admin-order-table"><thead><tr><th>MÃ ĐƠN</th><th>MÔ HÌNH</th><th>VỊ TRÍ</th><th>THỜI GIAN</th><th>TỔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>${orders.length ? orders.map(order => `<tr class="order-row-clickable" data-view-order="${order.id}" tabindex="0" role="button" aria-label="Mở chi tiết đơn ${escapeHtml(order.order_number)}"><td data-label="Mã đơn"><strong>${order.order_number}</strong></td><td data-label="Mô hình"><span class="order-card-meta">${orderServiceIcon(order.service_type)}${order.service_type === 'coffee' ? 'Cà phê' : 'Câu cá'}</span></td><td data-label="Vị trí"><span class="order-card-meta">${pinIcon}${escapeHtml(order.resource?.label || 'Chưa xác định')}</span></td><td data-label="Thời gian">${dateTime(order.opened_at)}</td><td data-label="Tổng"><strong>${money(order.total)}</strong></td><td data-label="Trạng thái"><span class="pill ${statusClass(order.status)}">${statusLabel(order.status)}</span></td></tr>`).join('') : '<tr class="order-table-empty"><td colspan="6"><div class="empty-state">Chưa có đơn nào trong bộ lọc này.</div></td></tr>'}</tbody></table></div>`;
}

export function employeeOrderDisplayTime(order = {}) {
    if (order.status === 'paid') {
        const latestPaymentAt = (order.payments || []).reduce((latest, payment) => {
            const paidAt = payment?.paid_at || '';
            return paidAt > latest ? paidAt : latest;
        }, '');
        if (latestPaymentAt) return latestPaymentAt;
    }

    return order.activity_at || order.opened_at || null;
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

export function renderOrderPaymentRow(payment) {
    const paymentStatus = payment.status === 'completed'
        ? 'Hoàn tất'
        : payment.status === 'reversed'
            ? 'Đã đảo'
            : statusLabel(payment.status);

    return `<div class="pos-payment-row">
        <span class="pos-payment-status"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg></span>
        <div>
            <strong>${escapeHtml(payment.payment_number)}</strong>
            ${payment.lines && payment.lines.length ? `<div class="payment-row-items">
                ${payment.lines.map(line => `${escapeHtml(line.name)} <span class="payment-row-quantity">x${line.quantity}</span>`).join(', ')}
            </div>` : ''}
            <small>${dateTime(payment.paid_at)} · ${paymentMethodDisplayLabel(payment.method)} · ${paymentStatus}</small>
        </div>
        <div><strong>${money(payment.amount)}</strong></div>
    </div>`;
}

function bindOrderActions() {
    $$('[data-view-order]').forEach(trigger => {
        const openOrder = async () => {
            const { order } = await api(`/api/v1/orders/${trigger.dataset.viewOrder}`);
            const isAdmin = document.body.dataset.role === 'admin';
            const isCoffee = order.service_type === 'coffee';
            const serviceIcon = isCoffee
                ? '<svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path><path d="M3 22h16M8 2v3M12 2v3"></path></svg>'
                : '<svg viewBox="0 0 24 24"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path><circle cx="16.5" cy="11" r=".8" fill="currentColor" stroke="none"></circle></svg>';
            const completedPayments = order.payments.filter(payment => payment.status === 'completed');
            const paidAmount = completedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remainingAmount = Math.max(0, Number(order.total) - paidAmount);
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
                                ${item.note ? `<div class="order-item-note">* ${escapeHtml(item.note)}</div>` : ''}
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
                    ${order.payments.length ? order.payments.map(renderOrderPaymentRow).join('') : '<div class="pos-receipt-empty">Chưa phát sinh giao dịch thanh toán.</div>'}
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
            openModal({ title: 'Chi tiết đơn hàng', body: isAdmin ? receiptBody : staffReceiptBody, wide: isAdmin, onReady(modal) {
                modal.classList.add('order-detail-modal');
                modal.classList.add('pos-receipt-modal');
                if (!isAdmin) modal.classList.add('staff-order-detail-modal');
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
}

export const ordersPage = definePageModule({
    mount(context) {
        ordersLifecycle = context.lifecycle;
        return renderOrders();
    },
    unmount() {
        adminOrderSearchTimer?.();
        adminOrderSearchTimer = null;
        stopOrderPolling();
        stopPosOperationalReset();
        ordersLifecycle = null;
    },
});
