export function openModal({ title, body, footer = '', wide = false, onReady }) {
    const root = document.querySelector('#modal-root');
    document.body.classList.add('modal-open');
    root.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}"><header class="modal-head"><h2>${title}</h2><button class="modal-close" aria-label="Đóng"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}</section></div>`;
    const modal = root.querySelector('.modal');
    const backdrop = root.querySelector('.modal-backdrop');
    if (modal.querySelector('.modal-pos-layout')) modal.classList.add('pos-order-modal');
    const removeKeyboardGuard = setupModalKeyboardGuard(backdrop);
    const close = () => {
        removeKeyboardGuard();
        root.innerHTML = '';
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', escape);
    };
    const escape = event => { if (event.key === 'Escape') close(); };
    root.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === event.currentTarget) close(); });
    document.addEventListener('keydown', escape);
    onReady?.(modal, close);
    return close;
}

export function confirmModal(title, message, confirmText = 'Xác nhận') {
    return new Promise(resolve => openModal({ title, body: `<p class="muted" style="line-height:1.7">${message}</p>`, footer: `<span></span><div><button class="button secondary" data-cancel>Để sau</button><button class="button primary" data-confirm>${confirmText}</button></div>`, onReady(modal, close) { modal.querySelector('[data-cancel]').onclick = () => { close(); resolve(false); }; modal.querySelector('[data-confirm]').onclick = () => { close(); resolve(true); }; } }));
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
