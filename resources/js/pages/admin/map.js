import { api } from '../../modules/api.js';
import { toast } from '../../modules/toast.js';
import { escapeHtml, money, number } from '../../modules/format.js';
import { confirmModal, openModal } from '../../modules/modal.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$, pageHead } from '../../templates/dom.js';
import { orderRemainingDue, slotLegend } from '../pos/shared.js';


let adminMapPollingTimer = null;
let adminMapPollingCleanup = null;
let adminMapPollSignature = '';
let isPollingAdminMap = false;
let adminMapUpdateHandler = null;
let mapLifecycle = null;

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

export function shouldPollAdminMap() {
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
    adminMapPollingTimer = true;
    adminMapPollingCleanup = mapLifecycle.interval(() => pollAdminMap(), 3000);
    mapLifecycle.add(() => {
        adminMapPollingTimer = null;
        adminMapPollSignature = '';
        isPollingAdminMap = false;
        adminMapUpdateHandler = null;
        adminMapPollingCleanup = null;
    });
}

export async function pollAdminMap(force = false) {
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


export async function renderMapAdmin() {
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
                <div class="lake-water"><div class="lake-title"><small>ĐỒNG LẦY FISHING</small><strong>HỒ CÂU</strong></div><span class="admin-fish fish-a">${fish}</span><span class="admin-fish fish-b">${fish}</span><span class="admin-fish fish-c">${fish}</span></div>
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
            <div class="admin-resource-actions">
                <button class="button danger admin-resource-action" id="delete-admin-resource">Xóa</button>
                <button class="button primary admin-resource-action" id="save-admin-resource">Lưu thay đổi</button>
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

    const toolbar = `<div class="admin-map-head-actions">
        <div class="admin-map-toolbar" role="tablist" aria-label="Chọn khu vực quản lý">
            <button class="admin-map-tab active" type="button" role="tab" aria-selected="true" data-map-type="coffee">${mapIcons.coffee}<span>Cà phê</span></button>
            <button class="admin-map-tab" type="button" role="tab" aria-selected="false" data-map-type="fishing">${mapIcons.fishing}<span>Câu cá</span></button>
        </div>
        <button class="button primary small admin-add-resource-button" id="admin-add-resource-btn">
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

export const mapPage = definePageModule({
    mount(context) {
        mapLifecycle = context.lifecycle;
        return renderMapAdmin();
    },
    unmount() {
        stopAdminMapPolling();
        mapLifecycle = null;
    },
});
