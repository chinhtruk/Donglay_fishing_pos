export function openModal({ title, body, footer = '', wide = false, className = '', onReady, onClose }) {
    const root = document.querySelector('#modal-root');
    document.body.classList.add('modal-open');
    const shell = cloneTemplate('tpl-modal-shell');
    if (shell) {
        root.replaceChildren(shell);
        const modalTitle = root.querySelector('[data-modal-title]');
        const modalBody = root.querySelector('[data-modal-body]');
        const modalFooter = root.querySelector('[data-modal-footer]');
        modalTitle.innerHTML = title;
        root.querySelector('.modal').setAttribute('aria-label', modalTitle.textContent || title);
        modalBody.innerHTML = body;
        if (footer) modalFooter.innerHTML = footer;
        else modalFooter.remove();
    } else {
        root.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}"><header class="modal-head"><h2>${title}</h2><button class="modal-close" aria-label="Đóng"><svg class="modal-close-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}</section></div>`;
    }
    const modal = root.querySelector('.modal');
    const backdrop = root.querySelector('.modal-backdrop');
    modal.classList.toggle('wide', Boolean(wide));
    if (modal.querySelector('.modal-pos-layout')) modal.classList.add('pos-order-modal');
    if (className) modal.classList.add(...className.split(/\s+/).filter(Boolean));
    const removeKeyboardGuard = setupModalKeyboardGuard(backdrop);
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        removeKeyboardGuard();
        root.innerHTML = '';
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', escape);
        onClose?.();
    };
    const escape = event => { if (event.key === 'Escape') close(); };
    root.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === event.currentTarget) close(); });
    document.addEventListener('keydown', escape);
    onReady?.(modal, close);
    return close;
}

export function confirmModal(title, message, confirmText = 'Xác nhận') {
    const bodyTemplate = cloneTemplate('tpl-confirm-body');
    const footerTemplate = document.getElementById('tpl-confirm-footer');
    if (bodyTemplate) {
        findInSelfOrDescendant(bodyTemplate, '[data-confirm-message]').textContent = message;
    }
    const body = bodyTemplate
        ? bodyTemplate.outerHTML
        : `<p class="muted modal-confirm-message">${message}</p>`;
    const footer = confirmFooterHtml(confirmText, footerTemplate);
    return new Promise(resolve => {
        const settle = once(resolve);

        openModal({
            title,
            body,
            footer,
            onClose() {
                settle(false);
            },
            onReady(modal, close) {
                modal.querySelector('[data-cancel]')?.addEventListener('click', () => {
                    settle(false);
                    close();
                });
                modal.querySelector('[data-confirm]')?.addEventListener('click', () => {
                    settle(true);
                    close();
                });
            }
        });
    });
}

function cloneTemplate(id) {
    const template = document.getElementById(id);
    return template ? template.content.firstElementChild.cloneNode(true) : null;
}

export function findInSelfOrDescendant(element, selector) {
    return element.matches(selector) ? element : element.querySelector(selector);
}

export function once(callback) {
    let settled = false;

    return value => {
        if (settled) return;
        settled = true;
        callback(value);
    };
}

export function prepareConfirmFooter(fragment, confirmText) {
    fragment.querySelectorAll('button').forEach(button => {
        button.type = 'button';
    });
    fragment.querySelector('[data-confirm]').textContent = confirmText;

    return fragment;
}

export function fallbackConfirmFooterHtml(confirmText) {
    return `<span></span><div><button type="button" class="button secondary" data-cancel>Để sau</button><button type="button" class="button primary" data-confirm>${confirmText}</button></div>`;
}

function confirmFooterHtml(confirmText, footerTemplate) {
    if (!footerTemplate) return fallbackConfirmFooterHtml(confirmText);

    const wrap = document.createElement('div');
    wrap.append(prepareConfirmFooter(footerTemplate.content.cloneNode(true), confirmText));

    return wrap.innerHTML;
}

function setupModalKeyboardGuard(backdrop) {
    if (!backdrop) return () => {};

    const viewport = window.visualViewport;
    let scrollTimer = null;

    const focusedModalField = () => {
        const active = document.activeElement;
        if (!active || !backdrop.contains(active)) return null;

        return active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]')
            ? active
            : null;
    };

    const updateKeyboardOffset = () => {
        const keyboardOffset = viewport
            ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
            : 0;

        backdrop.style.setProperty('--modal-keyboard-offset', `${Math.round(keyboardOffset)}px`);
        backdrop.classList.toggle('modal-keyboard-active', keyboardOffset > 80 && Boolean(focusedModalField()));
    };

    const scrollFocusedFieldIntoView = () => {
        const field = focusedModalField();
        if (!field) return;

        const visibleTop = viewport ? viewport.offsetTop : 0;
        const visibleBottom = viewport
            ? viewport.offsetTop + viewport.height
            : window.innerHeight;
        const rect = field.getBoundingClientRect();
        const safeTop = visibleTop + 24;
        const safeBottom = visibleBottom - 28;

        if (rect.top < safeTop || rect.bottom > safeBottom) {
            field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        }
    };

    const queueScrollFocusedField = () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
            updateKeyboardOffset();
            scrollFocusedFieldIntoView();
        }, 90);
    };

    const onFocusIn = event => {
        if (!backdrop.contains(event.target)) return;
        queueScrollFocusedField();
    };
    const onFocusOut = () => {
        window.setTimeout(() => {
            updateKeyboardOffset();
            if (!focusedModalField()) backdrop.classList.remove('modal-keyboard-active');
        }, 120);
    };

    backdrop.addEventListener('focusin', onFocusIn);
    backdrop.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', queueScrollFocusedField);
    viewport?.addEventListener('scroll', queueScrollFocusedField);
    window.addEventListener('resize', queueScrollFocusedField);
    updateKeyboardOffset();

    return () => {
        window.clearTimeout(scrollTimer);
        backdrop.removeEventListener('focusin', onFocusIn);
        backdrop.removeEventListener('focusout', onFocusOut);
        viewport?.removeEventListener('resize', queueScrollFocusedField);
        viewport?.removeEventListener('scroll', queueScrollFocusedField);
        window.removeEventListener('resize', queueScrollFocusedField);
        backdrop.style.removeProperty('--modal-keyboard-offset');
        backdrop.classList.remove('modal-keyboard-active');
    };
}
