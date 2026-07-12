export function pageFromPath(pathname = window.location.pathname, fallback = 'coffee') {
    return pathname.split('/').filter(Boolean).pop() || fallback;
}

export function pageShellFlags(page, role = document.body.dataset.role || '') {
    const isPOSPage = ['coffee', 'fishing'].includes(page) || (page === 'orders' && role !== 'admin');

    return {
        isPOSPage,
        isFishingPage: isPOSPage && page === 'fishing',
        isOrdersPage: isPOSPage && page === 'orders',
    };
}

export function applyPageShellFlags(page, role = document.body.dataset.role || '') {
    const flags = pageShellFlags(page, role);

    document.body.classList.toggle('pos-coffee-page', flags.isPOSPage);
    document.body.classList.toggle('pos-fishing-page', flags.isFishingPage);
    document.body.classList.toggle('pos-orders-page', flags.isOrdersPage);

    return flags;
}

export async function renderRoutedPage(page, options) {
    const {
        modules,
        runtime,
        context,
        beforeRender,
        afterRender,
        onError,
        scrollToTop = true,
    } = options;

    await runtime.unmount();
    beforeRender?.(page);
    applyPageShellFlags(page);

    try {
        await runtime.mount(page, modules[page], context);
    } catch (error) {
        onError?.(error, page);
    }

    if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    afterRender?.(page);
}
