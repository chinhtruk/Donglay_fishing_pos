export const KEYBOARD_FIELD_SELECTOR = [
    'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])',
    'textarea',
    'select',
    '[contenteditable="true"]'
].join(', ');

export function keyboardViewportOffset(layoutHeight, viewportHeight, offsetTop = 0) {
    return Math.max(0, Number(layoutHeight || 0) - Number(viewportHeight || 0) - Number(offsetTop || 0));
}

export function keyboardViewportIsOpen(offset, threshold = 120) {
    return Number(offset || 0) > Number(threshold || 0);
}

function activeKeyboardField() {
    const active = document.activeElement;
    if (!active || active.closest?.('.modal-backdrop')) return null;

    return active.matches?.(KEYBOARD_FIELD_SELECTOR) ? active : null;
}

function scrollFieldIntoVisualViewport(field) {
    const viewport = window.visualViewport;
    const visibleTop = viewport ? viewport.offsetTop : 0;
    const visibleBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
    const rect = field.getBoundingClientRect();
    const safeTop = visibleTop + 24;
    const safeBottom = visibleBottom - 28;

    if (rect.top < safeTop || rect.bottom > safeBottom) {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
}

export function setupKeyboardViewportGuard() {
    const viewport = window.visualViewport;
    let scrollTimer = null;
    let focusOutTimer = null;

    const updateKeyboardState = () => {
        const offset = viewport
            ? keyboardViewportOffset(window.innerHeight, viewport.height, viewport.offsetTop)
            : 0;
        const field = activeKeyboardField();
        const open = keyboardViewportIsOpen(offset) && Boolean(field);

        document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(offset)}px`);
        document.body.classList.toggle('keyboard-open', open);

        return field;
    };

    const queueScroll = () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
            const field = updateKeyboardState();
            if (field) scrollFieldIntoVisualViewport(field);
        }, 90);
    };

    const onFocusIn = event => {
        if (event.target?.matches?.(KEYBOARD_FIELD_SELECTOR)) queueScroll();
    };
    const onFocusOut = () => {
        window.clearTimeout(focusOutTimer);
        focusOutTimer = window.setTimeout(updateKeyboardState, 120);
    };
    const onInput = event => {
        if (event.target === activeKeyboardField()) queueScroll();
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onInput);
    viewport?.addEventListener('resize', queueScroll);
    viewport?.addEventListener('scroll', queueScroll);
    window.addEventListener('resize', queueScroll);
    updateKeyboardState();

    return () => {
        window.clearTimeout(scrollTimer);
        window.clearTimeout(focusOutTimer);
        document.removeEventListener('focusin', onFocusIn);
        document.removeEventListener('focusout', onFocusOut);
        document.removeEventListener('input', onInput);
        viewport?.removeEventListener('resize', queueScroll);
        viewport?.removeEventListener('scroll', queueScroll);
        window.removeEventListener('resize', queueScroll);
        document.documentElement.style.removeProperty('--keyboard-offset');
        document.body.classList.remove('keyboard-open');
    };
}
