import { escapeHtml, formatMoneyInput, money, number, parseMoneyInput } from '../../modules/format.js';

export function formatDisplayPrice(displayPrice) {
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

export function normalizedCategoryName(category = '') {
    return String(category).trim().toLowerCase();
}

export function isTrailingPosMenuCategory(category = '') {
    return ['ăn vặt', 'đồ ăn'].includes(normalizedCategoryName(category));
}

export function orderedPosMenu(menu = []) {
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

export function posMenuCategories(menu = []) {
    return ['Tất cả', ...new Set(menu.map(item => item.category))];
}

export function isVariablePriceItem(menuItems, menuItemId) {
    const item = menuItems.find(item => item.id === Number(menuItemId));
    return Boolean(item) && Number(item.price) === 0;
}

export function hasMissingVariablePrice(cart, menuItems) {
    return cart.values().some(line => isVariablePriceItem(menuItems, line.menu_item_id) && Number(line.price) <= 0);
}

export function orderLineUnitPriceHtml(line, menuItems) {
    if (!isVariablePriceItem(menuItems, line.menu_item_id)) {
        return `<small class="order-line-price">${money(line.price)} / món</small>`;
    }

    return Number(line.price) > 0
        ? `<small class="order-line-price">${money(line.price)} / món</small>`
        : '<small class="order-line-missing-price">Chưa nhập giá</small>';
}

export function orderLineTotalHtml(line, quantity, menuItems) {
    const total = Number(line.price) * Number(quantity || 0);
    const text = total > 0 || !isVariablePriceItem(menuItems, line.menu_item_id) ? money(total) : 'Chưa có giá';

    return `<b class="order-line-total">${text}</b>`;
}

export function fishingSessionNameHtml(name) {
    return escapeHtml(name);
}

export function fishingSessionMetaHtml(unitPrice, hasFishTakeaway, paid = false) {
    const fishLabel = hasFishTakeaway ? 'Có lấy cá' : 'Không lấy cá';
    const fishClass = hasFishTakeaway ? 'has-fish' : 'no-fish';
    const paidChip = paid ? '<span class="paid-status-chip">✓ Đã trả</span>' : '';

    return `<small class="session-line-meta"><span>${money(unitPrice)} / phiên</span><span class="session-fish-note ${fishClass}">${fishLabel}</span>${paidChip}</small>`;
}

export function fishingSessionMetricDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    const time = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
    const day = new Intl.DateTimeFormat('vi-VN', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
    }).format(date);

    return `${time} ${day}`;
}

export function fishingSessionLineTotalHtml(unitPrice, quantity, hasFishTakeaway, standardPrice, color = '#785943') {
    const qty = Number(quantity || 0);
    const currentTotal = Number(unitPrice) * qty;
    const standardTotal = Number(standardPrice || unitPrice) * qty;

    if (!hasFishTakeaway && standardTotal > currentTotal) {
        return `<b class="session-price-stack is-adjusted" style="align-self: center; color: ${color}; text-align:right;">
            <span class="session-price-original">${money(standardTotal)}</span>
            <span class="session-price-current">${money(currentTotal)}</span>
        </b>`;
    }

    return `<b class="session-price-stack" style="align-self: center; color: ${color}; text-align:right;">
        <span class="session-price-current">${money(currentTotal)}</span>
    </b>`;
}

export function orderShortCode(order) {
    return order ? `#${escapeHtml(order.order_number.split('-').slice(-1)[0])}` : 'Đơn mới';
}

export function orderBadgeHtml(order) {
    return `<span class="order-number-chip">${orderShortCode(order)}</span>`;
}

export function orderStackIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 16 9 5 9-5"></path></svg>';
}

export function orderCompletedPaymentTotal(order) {
    return order?.payments
        ?.filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
}

export function orderRemainingDue(order, total = null) {
    const billTotal = Number(total ?? order?.total ?? 0);

    return Math.max(0, billTotal - orderCompletedPaymentTotal(order));
}

export function matchingOrderItems(order, menuItemId, unitPrice) {
    return (order?.items || []).filter(item => item.menu_item_id === menuItemId && Number(item.unit_price) === Number(unitPrice));
}

export function paidQuantityForLine(order, menuItemId, unitPrice) {
    return matchingOrderItems(order, menuItemId, unitPrice).reduce((sum, item) => sum + Number(item.paid_quantity || 0), 0);
}

export function orderPaymentItemCountLabel(unpaidQuantity, totalQuantity) {
    const unpaid = Math.max(0, Number(unpaidQuantity) || 0);
    const total = Math.max(unpaid, Number(totalQuantity) || 0);
    return `(${number(unpaid)}/${number(total)} món)`;
}

export function fishingMergeTargetChipHtml(spot, isSelected = false) {
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

export function suggestedVariablePrice(item) {
    const firstPrice = String(item.display_price || '').split('-')[0]?.trim() || '';
    const price = parseMoneyInput(firstPrice);

    return price > 0 ? price : 0;
}

export function requestVariablePrice(modal, item) {
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

export function productMedia(item, index = 0) {
    if (item.image_url) {
        return `<span class="product-art has-image"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy"></span>`;
    }

    return `<span class="product-art art-${index % 4}"><i><svg viewBox="0 0 64 64" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="15" width="34" height="34" rx="7"></rect><path d="m17 42 9-10 7 7 5-5 8 8"></path><circle cx="37" cy="25" r="4"></circle></svg></i></span>`;
}

export function slotLegend(fishing = false) {
    return `<div class="legend"><span><i></i>Trống</span><span><i class="occupied"></i>Đang ${fishing ? 'câu' : 'phục vụ'}</span>${fishing ? '<span><i class="expired"></i>Hết giờ</span>' : ''}<span><i class="disabled"></i>Tạm nghỉ</span></div>`;
}
