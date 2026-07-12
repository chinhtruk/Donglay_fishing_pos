import { api } from '../../modules/api.js';
import { Cart } from '../../modules/cart.js';
import { toast } from '../../modules/toast.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { escapeHtml, money, number } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { schedulePosOperationalReset, stopPosOperationalReset } from './operational-day.js';
import { openCheckout } from './checkout.js';
import {
    renderCoffeeOrderLines,
    renderCoffeeOrderPanel,
    renderOrderModalBody,
} from './order-modal.js';
import {
    hasMissingVariablePrice,
    orderCompletedPaymentTotal,
    orderedPosMenu,
    orderPaymentItemCountLabel,
    orderRemainingDue,
    paidQuantityForLine,
    posMenuCategories,
    requestVariablePrice,
    slotLegend,
} from './shared.js';
import { $, $$ } from '../../templates/dom.js';

let coffeeLifecycle = null;

export async function renderCoffee() {
    const data = await api('/api/v1/coffee/map');
    schedulePosOperationalReset(data, coffeeLifecycle);
    const orderedMenu = orderedPosMenu(data.menu);
    const categories = posMenuCategories(orderedMenu);

    $('#page-content').innerHTML = `
        <section class="pos-stats">
            <article class="pos-stat">
                <span>
                    <svg class="pos-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                </span>
                <div><small>Đang phục vụ</small><strong>${number(data.stats.active_tables)} bàn</strong></div>
            </article>
            <article class="pos-stat">
                <span>
                    <svg class="pos-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                </span>
                <div><small>Chưa xác định bàn</small><strong>${number(data.stats.counter_orders)} đơn</strong></div>
            </article>
            <article class="pos-stat">
                <span>
                    <svg class="pos-stat-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <div><small>Hoàn tất hôm nay</small><strong>${number(data.stats.completed_today)} đơn</strong></div>
            </article>
            <button class="button primary pos-new-order-btn pos-new-order">
                <svg class="pos-new-order-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Đơn mới
            </button>
        </section>
        <div class="coffee-pos-layout coffee-pos-layout-single">
            <main class="coffee-pos-main">
                <section class="pos-section">
                    <div class="pos-section-head">
                        <div class="header-actions coffee-header-actions">
                            <button class="button secondary small coffee-merge-button" id="btn-merge-mode">Gộp hóa đơn</button>
                            <button class="button primary small coffee-merge-button hidden" id="btn-merge-confirm" disabled>Xác nhận gộp (0)</button>
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

export const coffeePage = definePageModule({
    mount(context) {
        coffeeLifecycle = context.lifecycle;
        return renderCoffee();
    },
    unmount() {
        stopPosOperationalReset();
        coffeeLifecycle = null;
    },
});
