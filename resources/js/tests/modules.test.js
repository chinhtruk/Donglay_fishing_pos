import test from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../modules/cart.js';
import { runButtonAction } from '../modules/action.js';
import { formatMoneyInput, formatStoredMoneyInput, number, parseMoneyInput, parseThousandsMoneyInput } from '../modules/format.js';
import { fallbackConfirmFooterHtml, findInSelfOrDescendant, once, prepareConfirmFooter } from '../modules/modal.js';
import { keyboardViewportIsOpen, keyboardViewportOffset } from '../modules/keyboard.js';
import { duration, remaining } from '../modules/timers.js';
import { shouldRenderToast } from '../modules/toast.js';
import { paymentMethodFormTitle, renderPaymentMethodForm, renderUserForm, userFormTitle } from '../pages/admin/forms.js';
import { orderMobileInitialView, orderMobileNavigationHtml, renderCoffeeOrderLines, renderCoffeeOrderPanel } from '../pages/pos/order-modal.js';
import { checkoutCanSubmit, copyCheckoutText } from '../pages/pos/checkout.js';
import { coffeeTableCardView } from '../pages/pos/coffee.js';
import { fishingOrderActionMode, fishingOrderModalCatalog, fishingSpotCardView } from '../pages/pos/fishing.js';
import { adminOrderStatusOptions, employeeOrderDisplayTime, orderItemPaymentParts, orderTable, renderOrderPaymentRow, renderOrderReceipt } from '../pages/orders/list.js';
import { fishingSessionLineTotalHtml, fishingSessionMetaHtml, formatDisplayPrice, orderPaymentItemCountLabel, orderedPosMenu, orderRemainingDue, paidQuantityForLine, posMenuCategories } from '../pages/pos/shared.js';
import { createLifecycleScope } from '../shell/lifecycle.js';
import { createPageRuntime, definePageModule } from '../shell/page-runtime.js';
import { isMobileSidebarViewport } from '../shell/sidebar.js';
import {
    notificationCategory,
    notificationDayGroup,
    notificationToastOptions,
} from '../pages/notifications/index.js';
import {
    paymentMethodDisplayLabel,
    paymentMethodTypeLabel,
} from '../pages/pos/payment-methods.js';
import { pageFromPath, pageShellFlags, renderRoutedPage } from '../shell/router.js';

test('cart tracks quantities and totals independently of the UI', () => {
    const cart = new Cart(); cart.add({ id:1, name:'Cà phê', price:30000 }).add({ id:1, name:'Cà phê', price:30000 });
    assert.equal(cart.quantity(1), 2); assert.equal(cart.total(), 60000); assert.deepEqual(cart.payload(), [{ menu_item_id:1, quantity:2, unit_price: 30000, note: '' }]);
});

test('cart can update an inline variable menu price', () => {
    const cart = new Cart();
    cart.add({ id: 2, name: 'Khoai tây chiên', price: 0 });
    assert.equal(cart.total(), 0);

    cart.updatePrice(2, 0, 30000);
    assert.equal(cart.quantity(2, 30000), 1);
    assert.equal(cart.total(), 30000);
    assert.deepEqual(cart.payload(), [{ menu_item_id: 2, quantity: 1, unit_price: 30000, note: '' }]);
});

test('metrics render without decimal places', () => {
    assert.equal(number(12), '12'); assert.equal(number(12.6), '13');
});

test('cash input formats Vietnamese thousands while preserving numeric value', () => {
    assert.equal(formatMoneyInput('1'), '1');
    assert.equal(formatMoneyInput('1000'), '1.000');
    assert.equal(formatMoneyInput('1.000.000'), '1.000.000');
    assert.equal(formatMoneyInput('1a00 000đ'), '100.000');
    assert.equal(formatStoredMoneyInput('15000.00'), '15.000');
    assert.equal(formatStoredMoneyInput(15000), '15.000');
    assert.equal(parseMoneyInput('1.000.000'), 1000000);
    assert.equal(parseMoneyInput(''), 0);
    assert.equal(parseThousandsMoneyInput('40'), 40000);
    assert.equal(parseThousandsMoneyInput('1.000'), 1000000);
    assert.equal(parseThousandsMoneyInput(''), 0);
});

test('countdown never becomes negative', () => {
    assert.equal(duration(3661000), '01:01:01'); assert.equal(remaining('2020-01-01T00:00:00Z', Date.now()), 0);
});

test('modal selector helper can match the root template node', () => {
    let queriedDescendants = false;
    const root = {
        matches: selector => selector === '[data-confirm-message]',
        querySelector: () => {
            queriedDescendants = true;
            return null;
        },
    };

    assert.equal(findInSelfOrDescendant(root, '[data-confirm-message]'), root);
    assert.equal(queriedDescendants, false);
});

test('confirm footer helper forces button types and fills confirm copy', () => {
    const cancelButton = { type: 'submit' };
    const confirmButton = { type: '', textContent: '' };
    const fragment = {
        querySelectorAll: selector => selector === 'button' ? [cancelButton, confirmButton] : [],
        querySelector: selector => selector === '[data-confirm]' ? confirmButton : null,
    };

    assert.equal(prepareConfirmFooter(fragment, 'Đăng xuất'), fragment);
    assert.equal(cancelButton.type, 'button');
    assert.equal(confirmButton.type, 'button');
    assert.equal(confirmButton.textContent, 'Đăng xuất');
    assert.match(fallbackConfirmFooterHtml('Xác nhận'), /type="button"[^>]*data-confirm/);
});

test('modal settle helper resolves a close or confirm path only once', () => {
    const resolved = [];
    const settle = once(value => resolved.push(value));

    settle(false);
    settle(true);
    settle(false);

    assert.deepEqual(resolved, [false]);
});

test('button action guard blocks a second tap and restores accessible state', async () => {
    let release;
    let calls = 0;
    const attributes = new Map();
    const button = {
        dataset: {},
        disabled: false,
        innerHTML: '<span>Lưu</span>',
        textContent: '',
        isConnected: true,
        setAttribute(name, value) { attributes.set(name, String(value)); },
        removeAttribute(name) { attributes.delete(name); },
    };
    const task = () => {
        calls += 1;
        return new Promise(resolve => { release = resolve; });
    };

    const first = runButtonAction(button, task, { busyText: 'Đang lưu…' });
    const second = runButtonAction(button, task, { busyText: 'Đang lưu…' });
    assert.equal(calls, 1);
    assert.equal(button.disabled, true);
    assert.equal(attributes.get('aria-busy'), 'true');
    assert.equal(await second, undefined);
    release('done');
    assert.equal(await first, 'done');
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, '<span>Lưu</span>');
    assert.equal(attributes.has('aria-busy'), false);
    assert.equal(attributes.has('aria-disabled'), false);
});

test('keyboard viewport helpers calculate mobile keyboard state consistently', () => {
    assert.equal(keyboardViewportOffset(844, 544), 300);
    assert.equal(keyboardViewportOffset(844, 600, 44), 200);
    assert.equal(keyboardViewportOffset(600, 844), 0);
    assert.equal(keyboardViewportIsOpen(120), false);
    assert.equal(keyboardViewportIsOpen(121), true);
    assert.equal(keyboardViewportIsOpen(121, 120), true);
});

test('shell router resolves page names from app paths', () => {
    assert.equal(pageFromPath('/pos/coffee'), 'coffee');
    assert.equal(pageFromPath('/admin/settings'), 'settings');
    assert.equal(pageFromPath('/admin/data'), 'data');
    assert.equal(pageFromPath('/'), 'coffee');
});

test('shell router applies POS page flags by role', () => {
    assert.deepEqual(pageShellFlags('orders', 'employee'), {
        isPOSPage: true,
        isFishingPage: false,
        isOrdersPage: true,
    });
    assert.deepEqual(pageShellFlags('orders', 'admin'), {
        isPOSPage: false,
        isFishingPage: false,
        isOrdersPage: false,
    });
    assert.equal(pageShellFlags('fishing', 'admin').isFishingPage, true);
});

test('mobile sidebar breakpoint ends before the existing iPad layer', () => {
    assert.equal(isMobileSidebarViewport(320), true);
    assert.equal(isMobileSidebarViewport(767), true);
    assert.equal(isMobileSidebarViewport(768), false);
    assert.equal(isMobileSidebarViewport(1024), false);
});

test('lifecycle scope unmounts cleanups once in reverse order', () => {
    const calls = [];
    const lifecycle = createLifecycleScope();
    const disposeA = lifecycle.add(() => calls.push('a'));
    lifecycle.add(() => calls.push('b'));

    disposeA();
    lifecycle.unmount();
    lifecycle.unmount();

    assert.deepEqual(calls, ['a', 'b']);
    assert.equal(lifecycle.count(), 0);
});

test('lifecycle scope clears registered intervals on unmount', () => {
    const cleared = [];
    const timers = {
        setInterval(callback, delay) {
            assert.equal(delay, 3000);
            assert.equal(typeof callback, 'function');
            return 42;
        },
        clearInterval(id) {
            cleared.push(id);
        },
    };
    const lifecycle = createLifecycleScope(timers);

    lifecycle.interval(() => {}, 3000);
    assert.equal(lifecycle.count(), 1);
    lifecycle.unmount();

    assert.deepEqual(cleared, [42]);
});

test('lifecycle scope removes registered event listeners on unmount', () => {
    const calls = [];
    const target = {
        addEventListener(eventName, callback) {
            calls.push(['add', eventName, callback]);
        },
        removeEventListener(eventName, callback) {
            calls.push(['remove', eventName, callback]);
        },
    };
    const lifecycle = createLifecycleScope();
    const handler = () => {};

    lifecycle.listen(target, 'click', handler);
    lifecycle.unmount();
    lifecycle.unmount();

    assert.deepEqual(calls, [
        ['add', 'click', handler],
        ['remove', 'click', handler],
    ]);
});

test('page runtime unmounts the active module and its effects before switching', async () => {
    const calls = [];
    const runtime = createPageRuntime();
    const first = definePageModule({
        mount({ lifecycle }) {
            calls.push('mount:first');
            lifecycle.add(() => calls.push('cleanup:first'));
        },
        unmount() {
            calls.push('unmount:first');
        },
    });
    const second = definePageModule({
        mount({ lifecycle }) {
            calls.push('mount:second');
            lifecycle.add(() => calls.push('cleanup:second'));
        },
        unmount() {
            calls.push('unmount:second');
        },
    });

    await runtime.mount('first', first);
    await runtime.mount('second', second);
    assert.equal(runtime.activePage(), 'second');
    await runtime.unmount();

    assert.deepEqual(calls, [
        'mount:first',
        'unmount:first',
        'cleanup:first',
        'mount:second',
        'unmount:second',
        'cleanup:second',
    ]);
    assert.equal(runtime.activePage(), null);
});

test('page runtime cleans a failed mount before surfacing the error', async () => {
    const calls = [];
    const runtime = createPageRuntime();
    const failing = definePageModule({
        mount({ lifecycle }) {
            lifecycle.add(() => calls.push('cleanup'));
            throw new Error('mount failed');
        },
        unmount() {
            calls.push('unmount');
        },
    });

    await assert.rejects(runtime.mount('broken', failing), /mount failed/);
    assert.deepEqual(calls, ['unmount', 'cleanup']);
    assert.equal(runtime.activePage(), null);
});

test('routed rendering unmounts the previous page before mounting the next page', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const calls = [];
    globalThis.window = { scrollTo: () => calls.push('scroll') };
    globalThis.document = {
        body: {
            dataset: { role: 'admin' },
            classList: { toggle: () => {} },
        },
    };

    try {
        await renderRoutedPage('dashboard', {
            modules: { dashboard: { mount() {}, unmount() {} } },
            runtime: {
                async unmount() { calls.push('unmount'); },
                async mount(page) { calls.push(`mount:${page}`); },
            },
            beforeRender: () => calls.push('before'),
            afterRender: () => calls.push('after'),
        });
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
    }

    assert.deepEqual(calls, ['unmount', 'before', 'mount:dashboard', 'scroll', 'after']);
});

test('notification helpers classify POS events for drawer and toast rendering', () => {
    const payment = { id: 11, data: { type: 'coffee_payment_completed' } };
    const expired = { id: 12, data: { type: 'fishing_session_expired', session_id: 99 } };

    assert.equal(notificationCategory(payment), 'payments');
    assert.equal(notificationToastOptions(payment).variant, 'payment');
    assert.deepEqual(notificationToastOptions(expired), {
        variant: 'alert',
        icon: '!',
        sticky: true,
        dismissible: true,
        allowOnEmployeePos: true,
        id: 'fishing-expired-99',
    });
    assert.ok(['Hôm nay', 'Hôm qua', 'Cũ hơn'].includes(notificationDayGroup(new Date().toISOString())));
});

test('employee POS only renders explicitly allowed fishing expiration toasts', () => {
    assert.equal(shouldRenderToast({ role: 'employee', pathname: '/pos/coffee' }), false);
    assert.equal(shouldRenderToast({ role: 'employee', pathname: '/pos/fishing', allowOnEmployeePos: true }), true);
    assert.equal(shouldRenderToast({ role: 'admin', pathname: '/pos/fishing' }), true);
    assert.equal(shouldRenderToast({ role: 'employee', pathname: '/login' }), true);
});

test('payment method labels keep cash and transfer copy stable', () => {
    assert.equal(paymentMethodTypeLabel('cash'), 'Tiền mặt');
    assert.equal(paymentMethodTypeLabel('qr'), 'QR / chuyển khoản');
    assert.equal(paymentMethodDisplayLabel('qr-vcb'), 'QR / chuyển khoản');
    assert.equal(paymentMethodDisplayLabel('auto_close'), 'Tự động chốt ngày');
});

test('employee order time uses latest payment without changing list order', () => {
    assert.equal(employeeOrderDisplayTime({
        status: 'paid',
        opened_at: '2026-07-11T09:00:00+07:00',
        activity_at: '2026-07-11T10:00:00+07:00',
        payments: [
            { paid_at: '2026-07-11T10:30:00+07:00' },
            { paid_at: '2026-07-11T11:00:00+07:00' },
        ],
    }), '2026-07-11T11:00:00+07:00');
    assert.equal(employeeOrderDisplayTime({
        status: 'open',
        opened_at: '2026-07-11T09:00:00+07:00',
        activity_at: '2026-07-11T10:00:00+07:00',
    }), '2026-07-11T10:00:00+07:00');
});

test('admin orders hide reconciliation filters and payment adjustment actions', () => {
    assert.deepEqual(adminOrderStatusOptions().map(option => option.value), ['', 'open', 'partially_paid', 'paid']);

    const paymentHtml = renderOrderPaymentRow({
        payment_number: 'PAY-001',
        amount: 20000,
        paid_at: '2026-07-12T22:30:00+07:00',
        method: 'cash',
        status: 'completed',
        lines: [{ name: 'Bạc xỉu đá', quantity: 1 }],
    });

    assert.match(paymentHtml, /PAY-001/);
    assert.doesNotMatch(paymentHtml, /Điều chỉnh|data-reverse-payment/);
});

test('orders opt into the reviewed mobile card list without changing desktop columns', () => {
    const order = {
        id: 17,
        order_number: 'ORD-&17',
        service_type: 'coffee',
        resource: { label: 'Bàn 03' },
        opened_at: '2026-07-13T08:30:00+07:00',
        activity_at: '2026-07-13T08:45:00+07:00',
        total: 78000,
        status: 'partially_paid',
    };
    const employeeHtml = orderTable([order], false);
    const adminHtml = orderTable([order], true);

    assert.match(employeeHtml, /is-mobile-card-list order-card-list/);
    assert.match(employeeHtml, /class="order-cell-number" data-label="Mã đơn"/);
    assert.match(employeeHtml, /tabindex="0" role="button"/);
    assert.match(employeeHtml, /ORD-&amp;17/);
    assert.doesNotMatch(employeeHtml, /order-cell-total/);
    assert.match(adminHtml, /class="order-cell-total" data-label="Tổng"/);
});

test('order receipt splits partially paid quantities into explicit paid and unpaid sections', () => {
    const order = {
        order_number: 'ORD-017',
        service_type: 'coffee',
        resource: { label: 'Bàn 03' },
        opened_at: '2026-07-13T08:30:00+07:00',
        status: 'partially_paid',
        subtotal: 78000,
        total: 78000,
        items: [
            { id: 1, name: 'Bạc xỉu đá', quantity: 3, paid_quantity: 1, unpaid_quantity: 2, unit_price: 26000, note: 'Ít đá', ordered_at: '2026-07-13T08:31:00+07:00' },
        ],
        payments: [
            { payment_number: 'PAY-017', amount: 26000, paid_at: '2026-07-13T08:40:00+07:00', method: 'cash', status: 'completed', lines: [] },
        ],
    };
    const adminHtml = renderOrderReceipt(order, { admin: true });
    const employeeHtml = renderOrderReceipt(order);

    assert.deepEqual(orderItemPaymentParts(order.items[0]), { quantity: 3, paid: 1, unpaid: 2 });
    assert.match(adminHtml, /pos-receipt-unpaid[\s\S]*Món chưa thanh toán[\s\S]*>2</);
    assert.match(adminHtml, /pos-receipt-paid[\s\S]*Món đã thanh toán[\s\S]*>1</);
    assert.match(adminHtml, /data-payment-history-toggle/);
    assert.doesNotMatch(adminHtml, /data-reverse-payment|data-void-order/);
    assert.match(employeeHtml, /Món cần xử lý/);
    assert.match(employeeHtml, /! Chưa thanh toán/);
    assert.match(employeeHtml, /✓ Đã thanh toán/);
});

test('order receipt tolerates legacy details without item or payment arrays', () => {
    const html = renderOrderReceipt({
        order_number: 'ORD-EMPTY',
        service_type: 'fishing',
        resource: null,
        opened_at: null,
        status: 'open',
        total: 0,
    }, { admin: true });

    assert.match(html, /Đơn chưa có món/);
    assert.match(html, /0 giao dịch/);
});

test('POS menu helpers keep drink categories before food categories', () => {
    const menu = [
        { id: 1, name: 'Khoai chiên', category: 'Đồ ăn' },
        { id: 2, name: 'Bạc xỉu', category: 'Cà phê' },
        { id: 3, name: 'Trà đào', category: 'Trà' },
        { id: 4, name: 'Mì trứng', category: 'Ăn vặt' },
    ];
    const ordered = orderedPosMenu(menu);

    assert.deepEqual(ordered.map(item => item.name), ['Bạc xỉu', 'Trà đào', 'Khoai chiên', 'Mì trứng']);
    assert.deepEqual(posMenuCategories(ordered), ['Tất cả', 'Cà phê', 'Trà', 'Đồ ăn', 'Ăn vặt']);
});

test('POS billing helpers format ranges and remaining due', () => {
    const order = {
        total: 120000,
        payments: [
            { amount: 50000, status: 'completed' },
            { amount: 20000, status: 'pending' },
        ],
    };

    assert.equal(formatDisplayPrice('15000 - 25000'), '15.000 - 25.000 ₫');
    assert.equal(orderRemainingDue(order), 70000);
    assert.equal(orderPaymentItemCountLabel(2, 5), '(2/5 món)');
    assert.equal(paidQuantityForLine({ items: [{ menu_item_id: 1, unit_price: 20000, paid_quantity: 2 }] }, 1, 20000), 2);
});

test('fishing session totals use semantic tone classes without inline styles', () => {
    const unpaidHtml = fishingSessionLineTotalHtml(80000, 1, 0, 100000);
    const paidHtml = fishingSessionLineTotalHtml(80000, 1, 20000, 100000, 'paid');

    assert.match(unpaidHtml, /class="session-price-stack"/);
    assert.match(paidHtml, /class="session-price-stack is-adjusted is-paid"/);
    assert.doesNotMatch(unpaidHtml, /style\s*=/);
    assert.doesNotMatch(paidHtml, /style\s*=/);
});

test('fishing session metadata shows the selected discount', () => {
    assert.match(fishingSessionMetaHtml(150000, 50000), /Giảm 50\.000 ₫/);
    assert.doesNotMatch(fishingSessionMetaHtml(200000, 0), /session-discount-note/);
    assert.doesNotMatch(fishingSessionMetaHtml(200000, 0), /Không giảm/);
    assert.doesNotMatch(fishingSessionMetaHtml(200000, 0), /Đã trả/);
});

test('fishing order actions reopen after adding unpaid items to a paid session', () => {
    assert.equal(fishingOrderActionMode(0), 'paid');
    assert.equal(fishingOrderActionMode(20000), 'outstanding');
});

test('POS map card copy preserves operational states on mobile', () => {
    assert.deepEqual(coffeeTableCardView({ state: 'disabled' }), {
        isPaid: false,
        stateClass: 'disabled',
        stateLabel: 'Tạm nghỉ',
        detail: 'Chưa nhận khách',
    });
    assert.match(coffeeTableCardView({
        state: 'occupied',
        order: { status: 'open', order_number: 'DL-1042', total: 75000, payments: [] },
    }).detail, /DL-1042.*75\.000/);
    assert.equal(fishingSpotCardView({ state: 'expired' }).stateLabel, 'Hết giờ');
    assert.equal(fishingSpotCardView({ state: 'occupied', order: { status: 'paid' } }).stateLabel, 'Đã thanh toán');
});

test('mobile order navigation opens new orders on menu and existing orders on receipt', () => {
    assert.equal(orderMobileInitialView(false), 'menu');
    assert.equal(orderMobileInitialView(true), 'receipt');
    assert.match(orderMobileNavigationHtml('menu'), /data-order-mobile-tab="menu"[^>]*aria-controls="mobile-order-menu-panel"[^>]*aria-selected="true"/);
    assert.match(orderMobileNavigationHtml('receipt'), /data-order-mobile-tab="receipt"[^>]*aria-controls="mobile-order-receipt-panel"[^>]*aria-selected="true"/);
});

test('checkout submit guard requires a payable selection and enough cash', () => {
    assert.equal(checkoutCanSubmit({ total: 0, cashReceived: 100000 }), false);
    assert.equal(checkoutCanSubmit({ total: 50000, cashReceived: 49999 }), false);
    assert.equal(checkoutCanSubmit({ total: 50000, cashReceived: 50000 }), true);
    assert.equal(checkoutCanSubmit({ total: 50000, paymentMethod: 'qr', cashReceived: 0 }), true);
    assert.equal(checkoutCanSubmit({ total: 50000, paymentMethod: 'qr', isSubmitting: true }), false);
});

test('checkout account copy uses the provided clipboard contract', async () => {
    let copied = '';
    const value = await copyCheckoutText('0123456789', { writeText: async text => { copied = text; } });
    assert.equal(value, '0123456789');
    assert.equal(copied, '0123456789');
});

test('POS order modal renderer keeps unpaid and paid lines distinct', () => {
    const menuItems = [{ id: 1, price: 25000 }];
    const linesHtml = renderCoffeeOrderLines({
        unpaidLines: [{ menu_item_id: 1, name: 'Cà phê', price: 25000, note: 'ít đá', unpaidQty: 1 }],
        paidLines: [{ menu_item_id: 1, name: 'Bạc xỉu', price: 30000, note: '', paidQty: 2 }],
        menuItems,
    });
    const panelHtml = renderCoffeeOrderPanel({
        currentOrder: { order_number: 'CF-TEST01' },
        linesHtml,
        cartTotal: 85000,
        totalPaid: 60000,
        remainingDue: 25000,
        paymentCountLabel: '(1/3 món)',
        canReleaseOnly: false,
        hasLines: true,
    });

    assert.match(panelHtml, /MÓN CHƯA THANH TOÁN/);
    assert.match(panelHtml, /MÓN ĐÃ THANH TOÁN/);
    assert.match(panelHtml, /data-modal-note="1"/);
    assert.match(panelHtml, /modal-checkout-order/);
    assert.match(panelHtml, /Còn lại cần trả/);
});

test('fishing order modal catalog renders the shared order modal body', () => {
    const catalog = fishingOrderModalCatalog([
        { id: 1, name: 'Cà phê sữa', category: 'Cà phê', price: 30000 },
    ]);

    assert.deepEqual(catalog.categories, ['Tất cả', 'Cà phê']);
    assert.match(catalog.modalBody, /modal-pos-layout/);
    assert.match(catalog.modalBody, /data-modal-product="1"/);
    assert.ok(catalog.modalBody.indexOf('modal-product-search') < catalog.modalBody.indexOf('data-modal-category'));
});

test('admin payment form renderer preserves editable QR fields', () => {
    const method = {
        id: 7,
        type: 'qr',
        name: 'Vietcombank QR',
        is_enabled: true,
        qr_image_url: '/storage/qr.png',
        bank_name: 'VCB',
        account_name: 'DONG LAY',
        account_number: '123456',
        transfer_note: 'DONG LAY',
        extra_info: 'Đưa biên lai cho nhân viên',
    };
    const html = renderPaymentMethodForm(method);

    assert.equal(paymentMethodFormTitle(method), 'Chỉnh sửa phương thức');
    assert.match(html, /id="payment-method-form"/);
    assert.match(html, /name="remove_qr_image"/);
    assert.match(html, /Vietcombank QR/);
    assert.match(html, /DONG LAY/);
});

test('admin user form renderer keeps role-specific credential sections', () => {
    const user = {
        id: 3,
        role: 'admin',
        name: 'Quản lý hồ',
        username: 'quanly',
        email: 'manager@example.com',
        is_active: true,
    };
    const html = renderUserForm(user);

    assert.equal(userFormTitle(user), 'Chỉnh sửa quản trị viên');
    assert.match(html, /id="user-form"/);
    assert.match(html, /data-user-role="admin"/);
    assert.match(html, /data-role-fields="employee"/);
    assert.match(html, /name="username" value="quanly"/);
    assert.match(html, /name="email" value="manager@example.com"/);
    assert.match(html, /Email nhận sao lưu/);
    assert.match(html, /Mật khẩu mới/);
});

test('employee user form keeps username and linked email credentials', () => {
    const employee = {
        id: 4,
        role: 'employee',
        name: 'Nhân viên hồ',
        username: 'nhanvien01',
        email: 'staff@example.com',
        email_verified_at: '2026-07-11T00:00:00Z',
        is_active: true,
    };
    const html = renderUserForm(employee);

    assert.equal(userFormTitle(employee), 'Chỉnh sửa nhân viên');
    assert.match(html, /name="username" value="nhanvien01"/);
    assert.match(html, /name="email" value="staff@example.com"/);
    assert.match(html, /OTP được gửi đến email liên kết/);
    assert.match(html, /id="user-email-verified"[^>]*checked/);
});
