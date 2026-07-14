import { escapeHtml } from './format.js';
import { $, cloneTemplate } from '../templates/dom.js';

function toastIcon(type) {
    return {
        success: '✓',
        payment: '₫',
        coffee: 'CF',
        fishing: 'Câu',
        info: 'i',
        warning: '!',
        alert: '!',
        error: '!'
    }[type] || 'i';
}

export function shouldRenderToast({ role = '', pathname = '', allowOnEmployeePos = false } = {}) {
    const isEmployeePos = role === 'employee' && pathname.startsWith('/pos/');

    return !isEmployeePos || allowOnEmployeePos;
}

export function toast(message, type = 'success', options = {}) {
    if (!shouldRenderToast({
        role: document.body?.dataset.role || '',
        pathname: globalThis.location?.pathname || '',
        allowOnEmployeePos: options.allowOnEmployeePos === true,
    })) return;

    const root = $('#toast-root');
    if (!root) return;
    const payload = typeof message === 'object' ? message : { message };
    const toastId = options.id || payload.id || '';
    if (toastId && [...root.children].some(child => child.dataset.toastId === String(toastId))) return;

    const node = cloneTemplate('tpl-toast') || document.createElement('div');
    node.className = `toast ${type}${options.sticky ? ' is-sticky' : ''}`;
    node.setAttribute('role', ['error', 'alert'].includes(type) ? 'alert' : 'status');
    if (toastId) node.dataset.toastId = String(toastId);
    if (node.querySelector('[data-toast-icon]')) {
        const title = $('[data-toast-title]', node);
        const closeButton = $('.toast-close', node);
        $('[data-toast-icon]', node).textContent = payload.icon || toastIcon(type);
        $('[data-toast-message]', node).textContent = payload.message || '';
        if (payload.title) title.textContent = payload.title;
        else title.remove();
        if (!options.dismissible) closeButton.remove();
    } else {
        node.innerHTML = `
            <span class="toast-icon" aria-hidden="true">${escapeHtml(payload.icon || toastIcon(type))}</span>
            <span class="toast-copy">
                ${payload.title ? `<strong>${escapeHtml(payload.title)}</strong>` : ''}
                <span>${escapeHtml(payload.message || '')}</span>
            </span>
            ${options.dismissible ? '<button class="toast-close" type="button" aria-label="Tắt thông báo">×</button>' : ''}
        `;
    }

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        node.remove();
        if (typeof options.onClose === 'function') options.onClose();
    };
    node.querySelector('.toast-close')?.addEventListener('click', close);
    if (options.sticky) {
        root.prepend(node);
        return;
    }

    root.append(node);
    setTimeout(close, options.duration || 5200);
}
