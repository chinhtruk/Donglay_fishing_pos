import { escapeHtml, money } from '../../modules/format.js';
import { cloneTemplate } from '../../templates/dom.js';
import {
    formatDisplayPrice,
    orderBadgeHtml,
    orderLineTotalHtml,
    orderLineUnitPriceHtml,
    productMedia,
} from './shared.js';

const minusIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
const plusIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
const emptyIcon = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>';

export function renderOrderModalBody({ categories, menu, activeCategory = 'Tất cả' }) {
    const body = cloneTemplate('tpl-pos-order-modal-body');
    if (!body) return renderOrderModalBodyFallback({ categories, menu, activeCategory });

    body.querySelector('[data-pos-modal-categories]').innerHTML = renderCategoryTabs(categories, activeCategory);
    body.querySelector('[data-pos-modal-products]').innerHTML = renderMenuProducts(menu);

    return body.outerHTML;
}

export function renderMenuProducts(menu = []) {
    return menu.map((item, index) => renderMenuProduct(item, index)).join('');
}

export function renderCoffeeOrderLines({ unpaidLines, paidLines, menuItems }) {
    let linesHtml = '';
    if (unpaidLines.length) {
        linesHtml += renderLineSectionHeader('MÓN CHƯA THANH TOÁN', 'unpaid-header');
        linesHtml += unpaidLines.map(line => renderEditableOrderLine(line, line.unpaidQty, menuItems)).join('');
    }

    if (paidLines.length) {
        linesHtml += renderLineSectionHeader('MÓN ĐÃ THANH TOÁN', 'paid-header');
        linesHtml += paidLines.map(line => renderPaidOrderLine(line, line.paidQty)).join('');
    }

    return linesHtml || renderOrderEmpty();
}

export function renderLineSectionHeader(label, className) {
    return `<div class="modal-lines-section-header ${className}">${escapeHtml(label)}</div>`;
}

export function renderEditableOrderLine(line, quantity, menuItems) {
    return `
        <div class="order-line unpaid-item">
            <div class="order-line-title">
                <strong>${escapeHtml(line.name)}</strong>
                ${orderLineUnitPriceHtml(line, menuItems)}
            </div>
            <div class="order-line-note-row">
                <input type="text" data-modal-note="${line.menu_item_id}" data-modal-price="${line.price}" value="${escapeHtml(line.note || '')}" placeholder="Ghi chú (ít đá, ngọt vừa...)">
                <div class="quantity">
                    <button data-modal-minus="${line.menu_item_id}" data-modal-price="${line.price}">${minusIcon}</button>
                    <b>${quantity}</b>
                    <button data-modal-plus="${line.menu_item_id}" data-modal-price="${line.price}">${plusIcon}</button>
                </div>
                ${orderLineTotalHtml(line, quantity, menuItems)}
            </div>
        </div>
    `;
}

export function renderPaidOrderLine(line, quantity) {
    return `
        <div class="order-line paid-item">
            <div class="order-line-title">
                <strong>${escapeHtml(line.name)} <span class="paid-status-chip">✓ Đã trả</span></strong>
                <small class="order-line-price">${money(line.price)} / món</small>
            </div>
            <div class="order-line-paid-row">
                <span class="order-line-paid-note ${line.note ? '' : 'is-empty'}">${line.note ? escapeHtml(line.note) : ''}</span>
                <div class="quantity"><b class="order-line-paid-quantity">× ${quantity}</b></div>
                <b class="order-line-total is-paid">${money(line.price * quantity)}</b>
            </div>
        </div>
    `;
}

export function renderOrderEmpty() {
    return `
        <div class="order-empty">
            <span>${emptyIcon}</span>
            <strong>Đơn hàng đang trống</strong>
            <p>Chạm vào món ở bên trái để bắt đầu.</p>
        </div>
    `;
}

export function renderCoffeeOrderPanel({ currentOrder, linesHtml, cartTotal, totalPaid, remainingDue, paymentCountLabel, canReleaseOnly, hasLines }) {
    return `
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
        <div class="order-lines">
            ${linesHtml}
        </div>
        <div class="order-dock-footer">
            <div class="order-total-breakdown" aria-label="Chi tiết tạm tính">
                <span>Tạm tính <b>${money(cartTotal)}</b></span>
                ${totalPaid > 0 ? `<span class="is-paid">Đã trả <b>${money(totalPaid)}</b></span>` : ''}
            </div>
            <div class="summary-row total order-total-row">
                <span>${totalPaid > 0 ? 'Còn lại cần trả' : 'Khách cần trả'} <small class="order-total-count">${paymentCountLabel}</small></span>
                <strong>${money(remainingDue)}</strong>
            </div>
            <div class="order-actions ${canReleaseOnly ? 'release-only' : ''}">
                ${canReleaseOnly ? `
                    <button class="button primary order-action-full" id="modal-release-table">
                        Giải phóng bàn (Khách rời đi)
                    </button>
                ` : `
                    <button class="button secondary" id="modal-save-order" ${hasLines ? '' : 'disabled'}>
                        ${currentOrder ? 'Lưu thay đổi' : 'Lưu đơn'}
                    </button>
                    <button class="button primary" id="modal-checkout-order" ${hasLines ? '' : 'disabled'}>
                        Thanh toán
                    </button>
                `}
            </div>
        </div>
    `;
}

function renderCategoryTabs(categories = [], activeCategory = 'Tất cả') {
    return categories
        .map(category => `<button class="${category === activeCategory ? 'active' : ''}" data-modal-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
        .join('');
}

function renderMenuProduct(item, index) {
    const card = cloneTemplate('tpl-pos-product-card');
    if (!card) return renderMenuProductFallback(item, index);

    card.dataset.name = String(item.name || '').toLowerCase();
    card.dataset.category = item.category || '';
    card.querySelector('[data-modal-product]').dataset.modalProduct = item.id;
    card.querySelector('[data-product-media]').outerHTML = productMedia(item, index);
    card.querySelector('[data-product-category]').textContent = item.category || '';
    card.querySelector('[data-product-name]').textContent = item.name || '';
    card.querySelector('[data-product-price]').textContent = formatDisplayPrice(item.display_price) || money(item.price);

    return card.outerHTML;
}

function renderMenuProductFallback(item, index) {
    return `
        <article class="pos-product-card" data-modal-product-card data-name="${escapeHtml(String(item.name || '').toLowerCase())}" data-category="${escapeHtml(item.category)}">
            <button class="product-main" data-modal-product="${item.id}">
                ${productMedia(item, index)}
                <small>${escapeHtml(item.category)}</small>
                <strong>${escapeHtml(item.name)}</strong>
                <b>${escapeHtml(formatDisplayPrice(item.display_price) || money(item.price))}</b>
                <em aria-hidden="true"><svg class="pos-product-add-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></em>
            </button>
        </article>
    `;
}

function renderOrderModalBodyFallback({ categories, menu, activeCategory }) {
    return `
        <div class="modal-pos-layout">
            <main class="pos-menu-section">
                <div class="pos-section-head">
                    <div class="category-tabs">${renderCategoryTabs(categories, activeCategory)}</div>
                    <label class="pos-search">
                        <span aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                        <input id="modal-product-search" type="search" placeholder="Tìm tên món…">
                    </label>
                </div>
                <div class="pos-product-grid">${renderMenuProducts(menu)}</div>
            </main>
            <aside class="modal-order-dock-aside">
                <div id="modal-order-panel"></div>
            </aside>
        </div>
    `;
}
