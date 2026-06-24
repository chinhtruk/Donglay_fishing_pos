const KEYBOARD_FIELD_SELECTOR = [
    'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])',
    'textarea',
    'select',
    '[contenteditable="true"]'
].join(', ');

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
        field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
}

export function setupKeyboardViewportGuard() {
    const viewport = window.visualViewport;
    let scrollTimer = null;

    const queueScroll = () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
            const field = activeKeyboardField();
            if (field) scrollFieldIntoVisualViewport(field);
        }, 90);
    };

    document.addEventListener('focusin', event => {
        if (event.target?.matches?.(KEYBOARD_FIELD_SELECTOR)) queueScroll();
    });
    document.addEventListener('input', event => {
        if (event.target === activeKeyboardField()) queueScroll();
    });
    viewport?.addEventListener('resize', queueScroll);
    viewport?.addEventListener('scroll', queueScroll);
    window.addEventListener('resize', queueScroll);
}
