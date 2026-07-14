import { api } from '../../modules/api.js';
import { toast } from '../../modules/toast.js';
import { escapeHtml, formatMoneyInput, money, number, parseThousandsMoneyInput } from '../../modules/format.js';
import { openModal } from '../../modules/modal.js';
import { $, } from '../../templates/dom.js';
import { orderBadgeHtml, orderPaymentItemCountLabel } from './shared.js';
import { paymentMethodTypeLabel } from './payment-methods.js';

let renderPage = null;

export function configureCheckout(dependencies) {
    renderPage = dependencies.renderPage;
}

export function checkoutCanSubmit({ total = 0, paymentMethod = 'cash', cashReceived = 0, isSubmitting = false } = {}) {
    return !isSubmitting && Number(total) > 0 && (paymentMethod !== 'cash' || Number(cashReceived) >= Number(total));
}

export async function copyCheckoutText(value, clipboard = globalThis.navigator?.clipboard) {
    if (!value || !clipboard?.writeText) throw new Error('Trình duyệt không hỗ trợ sao chép tự động.');
    await clipboard.writeText(String(value));
    return String(value);
}

export function openCheckout(order, type, paymentSettings = {}) {
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
            ${method.account_number ? `
                <div class="checkout-copy-row">
                    <button type="button" class="checkout-copy-button" data-copy-account="${escapeHtml(method.account_number)}">Sao chép số tài khoản</button>
                    <span class="checkout-copy-status" data-copy-status aria-live="polite"></span>
                </div>
            ` : ''}
        </div>
    `;
    const paymentMethodHint = method => method === 'cash'
        ? 'Thanh toán tiền mặt'
        : `Thanh toán ${methodByCode.get(method)?.name || 'chuyển khoản'}`;
    const releaseHtml = hasResource ? `
        <div class="checkout-release-block">
            <label class="checkout-release-label">
                <input class="checkout-release-input" type="checkbox" id="checkout-release" checked>
                <span class="checkout-release-copy">
                    <span>${type === 'coffee' ? 'Giải phóng bàn khi thanh toán xong' : 'Trả chòi & Giải phóng khi thanh toán xong'}</span>
                    <small class="checkout-release-reason hidden" id="checkout-release-reason">Chỉ có thể giải phóng khi thanh toán toàn bộ phần còn lại.</small>
                </span>
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
                    <label class="checkout-cash-label">
                        Tiền khách đưa
                        <span class="checkout-cash-input-shell is-empty">
                            <input class="checkout-cash-input" id="cash-received" inputmode="numeric" type="text" autocomplete="off" aria-label="Số tiền khách đưa, đơn vị nghìn đồng">
                            <span class="checkout-cash-thousands" aria-hidden="true">.000</span>
                        </span>
                    </label>
                    <div class="quick-cash-list">
                        <button type="button" class="quick-cash-btn" data-thousands="50">50.000</button>
                        <button type="button" class="quick-cash-btn" data-thousands="100">100.000</button>
                        <button type="button" class="quick-cash-btn" data-thousands="200">200.000</button>
                        <button type="button" class="quick-cash-btn" data-thousands="500">500.000</button>
                    </div>
                </div>
                ${transferMethods.map(method => `
                    <section class="checkout-qr-panel checkout-payment-panel hidden" data-payment-panel="${escapeHtml(method.code)}">
                        <div class="checkout-qr-image"><img src="${escapeHtml(method.qr_image_url)}" alt="Mã QR thanh toán" decoding="async"></div>
                        ${paymentAccountInfo(method)}
                    </section>
                `).join('')}
                <div class="summary-row checkout-change-row">
                    <span class="checkout-change-label">Tiền thừa trả khách</span>
                    <span class="checkout-change-value" id="change-due" aria-live="polite">0</span>
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
                        <div class="summary-row total checkout-total-row">
                            <span>Cần thanh toán <small class="order-total-count" id="checkout-selected-count">${orderPaymentItemCountLabel(checkoutUnpaidQuantity, checkoutTotalQuantity)}</small></span>
                            <strong id="checkout-total" aria-live="polite">0</strong>
                        </div>
                        <div class="order-actions checkout-actions">
                            <button type="button" class="button primary" id="confirm-checkout">Hoàn tất thanh toán</button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    `;

    openModal({ title:`Thanh toán · ${order.order_number}`, body, wide: true, className: 'pos-checkout-modal pos-order-modal', onReady(modal, close) {
        let paymentMethod = initialPaymentMethod;
        let isSubmitting = false;
        const confirmButton = $('#confirm-checkout', modal);
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
            const cashReceived = parseThousandsMoneyInput($('#cash-received', modal).value);
            $('#change-due', modal).textContent = paymentMethod !== 'cash' ? money(0) : money(Math.max(0, cashReceived - total));
            const selectedCountEl = $('#checkout-selected-count', modal);
            if (selectedCountEl) selectedCountEl.textContent = orderPaymentItemCountLabel(selectedQuantity, checkoutTotalQuantity);

            const releaseEl = $('#checkout-release', modal);
            if (releaseEl) {
                if (!isFullPayment) {
                    releaseEl.checked = false;
                    releaseEl.disabled = true;
                } else {
                    releaseEl.disabled = false;
                    if (releaseEl.dataset.wasDisabled === 'true') {
                        releaseEl.checked = true;
                    }
                }
                releaseEl.parentElement.classList.toggle('is-disabled', !isFullPayment);
                releaseEl.dataset.wasDisabled = !isFullPayment;
                $('#checkout-release-reason', modal)?.classList.toggle('hidden', isFullPayment);
            }
            confirmButton.disabled = !checkoutCanSubmit({ total, paymentMethod, cashReceived, isSubmitting });
            confirmButton.setAttribute('aria-disabled', confirmButton.disabled ? 'true' : 'false');
            return total;
        };

        const handleCheckboxChange = (itemId, isChecked) => {
            const row = $(`input[data-pay-check="${itemId}"]`, modal).closest('[data-bill-row]');
            const lineTotal = $(`#pay-line-total-${itemId}`, row);
            row.classList.toggle('is-unselected', !isChecked);
            lineTotal.classList.toggle('is-dimmed', !isChecked);
        };

        modal.querySelectorAll('[data-pay-check]').forEach(cb => {
            cb.onchange = () => {
                const itemId = Number(cb.dataset.payCheck);
                handleCheckboxChange(itemId, cb.checked);
                calculate();
            };
        });

        const cashInput = $('#cash-received', modal);
        const cashInputShell = cashInput.closest('.checkout-cash-input-shell');
        const syncCashInputShell = () => {
            cashInputShell?.classList.toggle('is-empty', !cashInput.value);
            cashInput.style.setProperty('--checkout-cash-input-width', '2px');
            const contentWidth = cashInput.value ? cashInput.scrollWidth : 0;
            cashInput.style.setProperty('--checkout-cash-input-width', `${Math.max(2, contentWidth + 5)}px`);
        };

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

        modal.querySelectorAll('[data-copy-account]').forEach(button => {
            button.onclick = async () => {
                const status = button.parentElement?.querySelector('[data-copy-status]');
                if (status) status.textContent = 'Đang sao chép…';
                try {
                    await copyCheckoutText(button.dataset.copyAccount);
                    if (status) status.textContent = 'Đã sao chép';
                } catch (error) {
                    if (status) status.textContent = error.message;
                }
            };
        });

        modal.querySelectorAll('.quick-cash-btn').forEach(btn => {
            btn.onclick = () => {
                cashInput.value = formatMoneyInput(btn.dataset.thousands);
                syncCashInputShell();
                calculate();
            };
        });

        cashInput.oninput = () => {
            cashInput.value = formatMoneyInput(cashInput.value);
            syncCashInputShell();
            calculate();
        };
        syncCashInputShell();
        syncPaymentMethod(paymentMethod);

        confirmButton.onclick = async () => {
            if (isSubmitting || confirmButton.disabled) return;
            isSubmitting = true;
            confirmButton.disabled = true;
            confirmButton.setAttribute('aria-disabled', 'true');
            const originalLabel = confirmButton.textContent;
            confirmButton.textContent = 'Đang xử lý…';
            modal.classList.add('checkout-submitting');
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
                        ...(paymentMethod === 'cash' ? { cash_received:parseThousandsMoneyInput(cashInput.value) } : {}),
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
            } finally {
                isSubmitting = false;
                if (modal.isConnected) {
                    modal.classList.remove('checkout-submitting');
                    confirmButton.textContent = originalLabel;
                    calculate();
                }
            }
        };
    }});
}
