import { api } from '../../modules/api.js';
import { runButtonAction } from '../../modules/action.js';
import { toast } from '../../modules/toast.js';
import { escapeHtml, formatMoneyInput, formatStoredMoneyInput, money, number, parseMoneyInput } from '../../modules/format.js';
import { confirmModal, openModal } from '../../modules/modal.js';
import { definePageModule } from '../../shell/page-runtime.js';
import { $, $$, emptyState, pageHead } from '../../templates/dom.js';
import { bindPagination, paginationMarkup } from './pagination.js';
import { menuSearchIcon } from './search-icon.js';
import { formatDisplayPrice } from '../pos/shared.js';


let adminMenuPage = 1;
let adminMenuFilters = { category: '', q: '' };
let adminMenuSearchTimer = null;
let menuLifecycle = null;

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
        if (window.matchMedia?.('(max-width: 767px)').matches) {
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            button.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
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
        adminMenuSearchTimer?.();
        adminMenuSearchTimer = menuLifecycle.timeout(() => {
            adminMenuSearchTimer = null;
            applySearch(true);
        }, 260);
    });

    search.addEventListener('search', () => {
        adminMenuSearchTimer?.();
        adminMenuSearchTimer = null;
        applySearch(true);
    });

    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        adminMenuSearchTimer?.();
        adminMenuSearchTimer = null;
        applySearch(true);
    });
}

export const menuPage = definePageModule({
    mount(context) {
        menuLifecycle = context.lifecycle;
        return renderMenuAdmin();
    },
    unmount() {
        adminMenuSearchTimer?.();
        adminMenuSearchTimer = null;
        menuLifecycle = null;
    },
});


export async function renderMenuAdmin(page = adminMenuPage, options = {}) {
    const data = await api(menuApiPath(page));
    if (Number(page) > Number(data.meta?.last_page || 1)) return renderMenuAdmin(Number(data.meta?.last_page || 1), options);
    adminMenuPage = Number(data.meta?.current_page || page);
    $('#page-content').classList.add('owner-menu-page', 'paginated-page');
    const addButton = '<button class="button primary" id="add-menu"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Thêm món</button>';
    const imagePlaceholder = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="15.5" cy="9" r="2"></circle><path d="m5 17 5-5 3 3 2-2 4 4"></path></svg>';
    const deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m7 7 1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';
    const hasActiveMenuFilters = Boolean(adminMenuFilters.category || adminMenuFilters.q);
    const menuContent = data.items.length
        ? `<div class="data-table-wrap is-mobile-card-list menu-admin-table-wrap"><table class="data-table menu-admin-table"><thead><tr><th>HÌNH</th><th>TÊN MÓN</th><th>NHÓM</th><th>GIÁ</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>${data.items.map(item=>`<tr class="menu-row-clickable" data-edit-menu-row="${item.id}" tabindex="0" role="button" aria-label="Chỉnh sửa món ${escapeHtml(item.name)}"><td class="menu-cell-image" data-label="Hình"><span class="menu-table-image">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">` : imagePlaceholder}</span></td><td class="menu-cell-name" data-label="Tên món"><strong>${escapeHtml(item.name)}</strong><span class="menu-card-open" aria-hidden="true">Chạm để chỉnh sửa</span></td><td class="menu-cell-category" data-label="Nhóm">${escapeHtml(item.category)}</td><td class="menu-cell-price" data-label="Giá"><strong>${escapeHtml(formatDisplayPrice(item.display_price) || money(item.price))}</strong></td><td class="menu-cell-status" data-label="Trạng thái"><span class="pill ${item.deleted_at ? 'gray' : item.is_available ? '' : 'warn'}">${item.deleted_at ? 'Đã lưu trữ' : item.is_available ? 'Đang bán' : 'Tạm ẩn'}</span></td><td class="menu-cell-actions" data-label="Thao tác"><div class="table-actions">${!item.deleted_at ? `<button class="button small danger menu-delete-button" data-delete-menu="${item.id}" aria-label="Lưu trữ món ${escapeHtml(item.name)}">${deleteIcon}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
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
    if (window.matchMedia?.('(max-width: 767px)').matches) {
        const activeCategory = $('.admin-menu-category-tabs [aria-pressed="true"]');
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        activeCategory?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
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
                        <span class="menu-batch-range-label">Khoảng giá POS</span>
                        <div class="menu-batch-range-fields">
                            <input class="menu-batch-range-input" type="text" inputmode="numeric" data-batch-display-price-from placeholder="Từ">
                            <span class="menu-range-separator">-</span>
                            <input class="menu-batch-range-input" type="text" inputmode="numeric" data-batch-display-price-to placeholder="Đến">
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
                        $('[data-batch-image-preview]', row).innerHTML = `<img src="${url}" alt="Xem trước ảnh món" decoding="async">`;
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
        ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" decoding="async">`
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
                <label class="menu-availability-card menu-flexible-toggle" for="menu-is-flexible-price"><span><strong>Giá biến động / Khoảng giá</strong><small>Cho phép nhân viên nhập giá tùy chỉnh tại POS, hiển thị khoảng giá trên menu.</small></span><input id="menu-is-flexible-price" type="checkbox" ${item && Number(item.price) === 0 ? 'checked' : ''}><i></i></label>
                <label id="menu-price-label">Giá bán<div class="menu-price-field"><input id="menu-price-input" name="price" type="text" inputmode="numeric" value="${item?.price !== undefined && item?.price !== null && Number(item.price) !== 0 ? formatStoredMoneyInput(item.price) : ''}" placeholder="0" required><span>đ</span></div></label>
                <label id="menu-display-price-label" class="hidden">
                    Khoảng giá hiển thị POS
                    <div class="menu-display-price-fields">
                        <div class="menu-price-field menu-price-field-flex"><input id="menu-display-price-from" type="text" inputmode="numeric" placeholder="Giá từ"><span>đ</span></div>
                        <span class="menu-range-separator">-</span>
                        <div class="menu-price-field menu-price-field-flex"><input id="menu-display-price-to" type="text" inputmode="numeric" placeholder="Đến giá"><span>đ</span></div>
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
                    preview.innerHTML = `<img src="${candidateUrl}" alt="Xem trước ảnh món" decoding="async">`;
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
            $('#save-menu', modal).onclick = async event => {
                const saveButton = event.currentTarget;
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
                await runButtonAction(saveButton, async () => {
                    try {
                        const result = await api(item ? `/api/v1/admin/menu/${item.id}` : '/api/v1/admin/menu', { method:'POST', body:formData });
                        toast(result.message); close(); renderMenuAdmin();
                    } catch (error) { toast(error.message, 'error'); }
                }, { busyText: 'Đang lưu…' });
            };
        }
    });
}
