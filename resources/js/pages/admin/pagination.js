import { escapeHtml, number } from '../../modules/format.js';
import { $$ } from '../../templates/dom.js';

export function paginationMarkup(meta, label = 'dữ liệu') {
    const current = Number(meta?.current_page || 1);
    const last = Number(meta?.last_page || 1);
    const total = Number(meta?.total || 0);
    const perPage = Number(meta?.per_page || total || 1);
    if (total <= 0) return '';

    let startPage, endPage;
    if (last <= 3) {
        startPage = 1;
        endPage = last;
    } else {
        if (current === 1) {
            startPage = 1;
            endPage = 3;
        } else if (current === last) {
            startPage = last - 2;
            endPage = last;
        } else {
            startPage = current - 1;
            endPage = current + 1;
        }
    }

    let pageButtons = '';
    for (let i = startPage; i <= endPage; i++) {
        pageButtons += `<button type="button" class="pagination-page ${i === current ? 'active' : ''}" data-pagination-page="${i}" ${i === current ? 'aria-current="page"' : ''}>${i}</button>`;
    }

    const from = total ? (current - 1) * perPage + 1 : 0;
    const to = Math.min(current * perPage, total);

    return `<nav class="admin-pagination" aria-label="Phân trang ${escapeHtml(label)}">
        <span class="pagination-summary">${number(from)}–${number(to)} / ${number(total)}</span>
        <div class="pagination-controls">
            <button type="button" class="pagination-nav" data-pagination-page="1" ${current <= 1 ? 'disabled' : ''} aria-label="Trang đầu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 18-6-6 6-6M11 18l-6-6 6-6"></path></svg></button>
            <button type="button" class="pagination-nav" data-pagination-page="${current - 1}" ${current <= 1 ? 'disabled' : ''} aria-label="Trang trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg></button>
            ${pageButtons}
            <button type="button" class="pagination-nav" data-pagination-page="${current + 1}" ${current >= last ? 'disabled' : ''} aria-label="Trang sau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>
            <button type="button" class="pagination-nav" data-pagination-page="${last}" ${current >= last ? 'disabled' : ''} aria-label="Trang cuối"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 18 6-6-6-6M13 18l6-6-6-6"></path></svg></button>
        </div>
    </nav>`;
}

export function bindPagination(root, callback) {
    $$('[data-pagination-page]', root).forEach(button => button.onclick = () => {
        if (!button.disabled) callback(Number(button.dataset.paginationPage));
    });
}
