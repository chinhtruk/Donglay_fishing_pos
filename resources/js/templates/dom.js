import { escapeHtml } from '../modules/format.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const cloneTemplate = id => {
    if (typeof document === 'undefined') return null;
    const template = document.getElementById(id);
    return template ? template.content.firstElementChild.cloneNode(true) : null;
};

export function setLoading() {
    const page = $('#page-content');
    page.className = 'page-content';
    page.setAttribute('aria-busy', 'true');
    const loading = cloneTemplate('tpl-loading-state');
    const content = loading || document.createRange().createContextualFragment('<div class="loading-state"><span></span><p>Đang sắp xếp không gian…</p></div>');
    const status = content.matches?.('.loading-state') ? content : content.querySelector?.('.loading-state');
    status?.setAttribute('role', 'status');
    status?.setAttribute('aria-live', 'polite');
    page.replaceChildren(content);
}

export function pageHead(eyebrow, title, description, actions = '') {
    const head = cloneTemplate('tpl-page-head');
    if (!head) {
        const eyebrowHtml = eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : '';
        const titleHtml = title ? `<h1>${title}</h1>` : '';
        const descHtml = description ? `<p>${description}</p>` : '';
        return `<header class="page-head"><div>${eyebrowHtml}${titleHtml}${descHtml}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
    }

    const eyebrowEl = $('[data-page-eyebrow]', head);
    const titleEl = $('[data-page-title]', head);
    const descEl = $('[data-page-description]', head);
    const actionsEl = $('[data-page-actions]', head);

    if (eyebrow) eyebrowEl.innerHTML = eyebrow;
    else eyebrowEl.remove();
    if (title) titleEl.innerHTML = title;
    else titleEl.remove();
    if (description) descEl.innerHTML = description;
    else descEl.remove();
    if (actions) actionsEl.innerHTML = actions;
    else actionsEl.remove();

    return head.outerHTML;
}

export function emptyState(title, message = '') {
    const empty = cloneTemplate('tpl-empty-state');
    if (!empty) return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>`;
    $('[data-empty-title]', empty).textContent = title;
    const messageEl = $('[data-empty-message]', empty);
    if (message) messageEl.textContent = message;
    else messageEl.remove();
    return empty.outerHTML;
}
