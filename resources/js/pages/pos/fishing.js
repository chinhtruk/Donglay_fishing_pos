import { api } from '../../modules/api.js';
import { Cart } from '../../modules/cart.js';
import { toast } from '../../modules/toast.js';
import { dateTime, escapeHtml, money, number } from '../../modules/format.js';
import { confirmModal, openModal } from '../../modules/modal.js';
import { duration, remaining, ServerClock } from '../../modules/timers.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$ } from '../../templates/dom.js';
import { schedulePosOperationalReset, stopPosOperationalReset } from './operational-day.js';
import { openCheckout } from './checkout.js';
import {
    renderEditableOrderLine,
    renderLineSectionHeader,
    renderOrderEmpty,
    renderOrderModalBody,
    renderPaidOrderLine,
} from './order-modal.js';
import {
    fishingMergeTargetChipHtml,
    fishingSessionLineTotalHtml,
    fishingSessionMetaHtml,
    fishingSessionMetricDateTime,
    fishingSessionNameHtml,
    hasMissingVariablePrice,
    orderBadgeHtml,
    orderCompletedPaymentTotal,
    orderedPosMenu,
    orderPaymentItemCountLabel,
    orderRemainingDue,
    paidQuantityForLine,
    posMenuCategories,
    requestVariablePrice,
    slotLegend,
} from './shared.js';

let fishingLifecycle = null;

export function fishingOrderModalCatalog(menu = [], activeCategory = 'Tất cả') {
    const orderedMenu = orderedPosMenu(menu);
    const categories = posMenuCategories(orderedMenu);

    return {
        orderedMenu,
        categories,
        modalBody: renderOrderModalBody({ categories, menu: orderedMenu, activeCategory }),
    };
}

export function fishingOrderActionMode(remainingDue) {
    return Number(remainingDue) > 0 ? 'outstanding' : 'paid';
}

export async function renderFishing() {
    const data = await api('/api/v1/fishing/map'); const clock = new ServerClock(data.server_time);
    schedulePosOperationalReset(data, fishingLifecycle);
    const mid = Math.ceil(data.spots.length / 2);
    const leftSpots = data.spots.slice(0, mid);
    const rightSpots = data.spots.slice(mid);
    const spotButton = (spot, side, row) => {
        const isPaid = spot.order && spot.order.status === 'paid';
        const stateClass = spot.state + (isPaid ? ' paid-ready' : '');
        const stateLabel = isPaid ? 'Đã thanh toán' : (spot.state === 'available' ? 'Sẵn sàng' : spot.state === 'disabled' ? 'Tạm nghỉ' : spot.state === 'expired' ? 'Hết giờ' : 'Đang câu');
        return `<button class="fishing-slot ${stateClass} side-${side}" style="grid-column:${side === 'left' ? 1 : 3};grid-row:${row}" data-spot="${spot.id}" ${spot.state === 'disabled' ? 'disabled' : ''}><span class="fishing-slot-number">${escapeHtml(spot.label)}</span><span><strong>${stateLabel}</strong><small ${spot.order ? `data-ends="${spot.order.fishing_session.ends_at}"` : ''}>${spot.state === 'available' ? 'Chạm để mở phiên' : spot.state === 'disabled' ? 'Chưa nhận khách' : duration(remaining(spot.order.fishing_session.ends_at, clock.now()))}</small></span><i></i></button>`;
    };
    $('#page-content').innerHTML = `
        <section class="fishing-map-shell">
            <div class="fishing-map-header">
                <span class="fishing-header-tip muted">Chạm chòi để mở hoặc xem phiên câu</span>
                <div class="fishing-header-actions">
                    <button class="button secondary small" id="btn-merge-mode">Gộp hóa đơn</button>
                    <button class="button primary small hidden" id="btn-merge-confirm" disabled>Xác nhận gộp (0)</button>
                </div>
                ${slotLegend(true)}
            </div>
            <div class="fishing-lake-plan">
                <div class="lake-water">
                    <div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU</strong></div>
                    <svg class="fish-swim fish-1" viewBox="0 0 50 30"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg>
                    <svg class="fish-swim fish-2" viewBox="0 0 50 30"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg>
                    <svg class="fish-swim fish-3" viewBox="0 0 50 30"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg>
                    <svg class="fish-swim fish-4" viewBox="0 0 50 30"><path d="M5 15 C15 5, 30 7, 40 15 C30 23, 15 25, 5 15 Z M40 15 L48 10 L46 15 L48 20 Z M25 10 C27 4, 32 6, 30 11 Z M25 20 C27 26, 32 24, 30 19 Z"/></svg>
                    <div class="water-flora group-top-right">
                        <svg class="flora-leaf flora-leaf-top-primary" viewBox="0 0 30 30" width="30" height="30"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                        <svg class="flora-leaf flora-leaf-top-secondary" viewBox="0 0 30 30" width="20" height="20"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                    </div>
                    <div class="water-flora group-bottom-left">
                        <svg class="flora-leaf flora-leaf-bottom-primary" viewBox="0 0 30 30" width="26" height="26"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                        <svg class="flora-leaf flora-leaf-bottom-secondary" viewBox="0 0 30 30" width="18" height="18"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                    </div>
                    <div class="water-flora group-top-left">
                        <svg class="flora-leaf flora-leaf-left" viewBox="0 0 30 30" width="22" height="22"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                    </div>
                    <div class="water-flora group-bottom-right">
                        <svg class="flora-leaf flora-leaf-right" viewBox="0 0 30 30" width="24" height="24"><path d="M15 2 C22.18 2, 28 7.82, 28 15 C28 22.18, 22.18 28, 15 28 C7.82 28, 2 22.18, 2 15 C2 9.5 5.5 5 10.5 3 Z" fill="#1b3427"></path></svg>
                    </div>
                </div>
                ${leftSpots.map((spot, index) => spotButton(spot, 'left', index + 1)).join('')}
                ${rightSpots.map((spot, index) => spotButton(spot, 'right', rightSpots.length - index)).join('')}
            </div>
        </section>`;
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
    fishingLifecycle.interval(tick, 1000);

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

export const fishingPage = definePageModule({
    mount(context) {
        fishingLifecycle = context.lifecycle;
        return renderFishing();
    },
    unmount() {
        stopPosOperationalReset();
        fishingLifecycle = null;
    },
});


async function openFishing(spot, menu, fishingConfig = {}) {
    const standardSessionPrice = Number(fishingConfig.session_price || 200000);
    const discountOptions = [...new Set(
        (fishingConfig.discount_options || [0, 50000, 100000, 150000, 200000])
            .map(Number)
            .filter(amount => Number.isFinite(amount) && amount >= 0),
    )].sort((left, right) => left - right);

    if (!spot.order) {
        if (!await confirmModal(`Bắt đầu · ${escapeHtml(spot.label)}`, `Mở phiên câu 4 giờ với giá ${money(standardSessionPrice)}? Đồng hồ sẽ bắt đầu ngay sau khi xác nhận.`, 'Bắt đầu phiên')) return;
        try { const result = await api(`/api/v1/fishing/spots/${spot.id}/start`, { method:'POST' }); toast(result.message); renderFishing(); } catch(error) { toast(error.message, 'error'); }
        return;
    }

    let currentOrder = spot.order;
    const initialSession = currentOrder.fishing_session;
    const sessionDefaults = currentOrder.items.find(item => item.line_type === 'fishing_session');
    const configuredSessionMinutes = Number(fishingConfig.session_minutes || 240);
    const configuredSessionPrice = Number(fishingConfig.session_price || sessionDefaults?.unit_price || standardSessionPrice);
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
    const { orderedMenu, categories, modalBody } = fishingOrderModalCatalog(menu, activeCategory);

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
                const sessionPrice = sessionItem ? Number(sessionItem.unit_price) : standardSessionPrice;
                const sessionQty = sessionItem ? Number(sessionItem.quantity) : Number(session.blocks_count);
                const mainSessionTotal = sessionPrice * sessionQty;
                const mainSessionPaid = sessionItem ? Number(sessionItem.paid_quantity) : 0;
                const mainSessionUnpaid = sessionQty - mainSessionPaid;
                const sessionDiscount = Math.max(0, standardSessionPrice - sessionPrice);
                const sessionDiscountLocked = mainSessionPaid > 0;

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
                        <div class="order-line unpaid-item session-item">
                            <div>
                                <strong class="session-line-title">${fishingSessionNameHtml(sessionItem?.name || 'Phiên câu 4 giờ')}</strong>
                                ${fishingSessionMetaHtml(sessionPrice, sessionDiscount)}
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionUnpaid}</b></div>
                            ${fishingSessionLineTotalHtml(sessionPrice, mainSessionUnpaid, sessionDiscount, standardSessionPrice)}
                        </div>
                    `);
                }
                if (mainSessionPaid > 0) {
                    paidHtmls.push(`
                        <div class="order-line paid-item session-item">
                            <div>
                                <strong class="session-line-title is-paid">${fishingSessionNameHtml(sessionItem?.name || 'Phiên câu 4 giờ')}</strong>
                                ${fishingSessionMetaHtml(sessionPrice, sessionDiscount)}
                            </div>
                            <div class="quantity session-quantity"><b>× ${mainSessionPaid}</b></div>
                            ${fishingSessionLineTotalHtml(sessionPrice, mainSessionPaid, sessionDiscount, standardSessionPrice, 'paid')}
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
                            <div class="order-line unpaid-item session-item">
                                <div>
                                    <strong class="session-line-title">${escapeHtml(mSession.name)}</strong>
                                    <small class="session-line-meta">${money(mSession.unit_price)} / phiên</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${mUnpaid}</b></div>
                                <b class="order-line-total">${money(Number(mSession.unit_price) * mUnpaid)}</b>
                            </div>
                        `);
                    }
                    if (mPaid > 0) {
                        paidHtmls.push(`
                            <div class="order-line paid-item session-item">
                                <div>
                                    <strong class="session-line-title is-paid">${escapeHtml(mSession.name)}</strong>
                                    <small class="session-line-meta">${money(mSession.unit_price)} / phiên</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${mPaid}</b></div>
                                <b class="order-line-total is-paid">${money(Number(mSession.unit_price) * mPaid)}</b>
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
                            <div class="order-line unpaid-item session-item">
                                <div>
                                    <strong class="session-line-title">${escapeHtml(extensionItem.name)}</strong>
                                    <small class="session-line-meta">${money(extensionItem.unit_price)} / lượt</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${unpaidQty}</b></div>
                                <b class="order-line-total">${money(Number(extensionItem.unit_price) * unpaidQty)}</b>
                            </div>
                        `);
                    }
                    if (paidQty > 0) {
                        paidHtmls.push(`
                            <div class="order-line paid-item session-item">
                                <div>
                                    <strong class="session-line-title is-paid">${escapeHtml(extensionItem.name)}</strong>
                                    <small class="session-line-meta">${money(extensionItem.unit_price)} / lượt</small>
                                </div>
                                <div class="quantity session-quantity"><b>× ${paidQty}</b></div>
                                <b class="order-line-total is-paid">${money(Number(extensionItem.unit_price) * paidQty)}</b>
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
                const remainingDue = Math.max(0, totalBill - totalPaid);
                const actionMode = fishingOrderActionMode(remainingDue);

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
                            <div class="fishing-discount-control ${sessionDiscountLocked ? 'is-locked' : ''}">
                                <span class="fishing-discount-copy">
                                    <strong>Giảm giá phiên câu</strong>
                                    <small>${sessionDiscountLocked ? 'Phiên câu đã thanh toán nên không thể đổi' : 'Áp dụng cho mỗi phiên câu 4 giờ'}</small>
                                </span>
                                <select id="fishing-discount-select" aria-label="Mức giảm giá phiên câu" ${sessionDiscountLocked ? 'disabled' : ''}>
                                    ${discountOptions.map(amount => `<option value="${amount}" ${amount === sessionDiscount ? 'selected' : ''}>${amount > 0 ? `Giảm ${money(amount)}` : 'Không giảm'}</option>`).join('')}
                                </select>
                            </div>
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
                            <strong>${money(remainingDue)}</strong>
                        </div>
                        <div class="order-actions ${actionMode === 'paid' ? 'fishing-paid' : 'fishing-open'}">
                            ${actionMode === 'paid' ? `
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
                                    Lưu thay đổi
                                </button>
                                <button class="button primary" id="modal-checkout-order">
                                    Thanh toán
                                </button>
                            `}
                        </div>
                    </div>`;

                modal.querySelectorAll('[data-modal-minus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalMinus), Number(button.dataset.modalPrice), -1));
                modal.querySelectorAll('[data-modal-plus]').forEach(button => button.onclick = () => changeQuantity(Number(button.dataset.modalPlus), Number(button.dataset.modalPrice), 1));

                const discountSelect = modal.querySelector('#fishing-discount-select');
                if (discountSelect) {
                    discountSelect.onchange = async () => {
                        const discountAmount = Number(discountSelect.value);
                        discountSelect.disabled = true;
                        try {
                            const updateDiscount = () => api(`/api/v1/fishing/orders/${currentOrder.id}/discount`, {
                                method: 'POST',
                                body: { version: currentOrder.version, discount_amount: discountAmount },
                            });
                            let result;
                            try {
                                result = await updateDiscount();
                            } catch (error) {
                                if (error.status !== 409) throw error;
                                await refreshCurrentFishingOrder();
                                result = await updateDiscount();
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
