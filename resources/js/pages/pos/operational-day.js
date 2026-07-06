let posOperationalResetTimer = null;
let isResettingPosOperationalUi = false;
let resetHooks = {
    closeOpenModal: () => {},
    renderPage: async () => {},
    toast: () => {},
};

export function configurePosOperationalReset(hooks = {}) {
    resetHooks = { ...resetHooks, ...hooks };
}

export function currentPosPage() {
    if (!location.pathname.startsWith('/pos/')) return null;
    const section = location.pathname.split('/').filter(Boolean).pop() || 'coffee';

    return ['coffee', 'fishing', 'orders'].includes(section) ? section : null;
}

export function schedulePosOperationalReset(payload = {}) {
    const page = currentPosPage();
    if (!page) return;

    const serverTime = payload.server_time;
    const resetAt = payload.operational_day?.resets_at;
    if (!serverTime || !resetAt) return;

    const delay = new Date(resetAt).getTime() - new Date(serverTime).getTime();
    if (!Number.isFinite(delay)) return;

    if (posOperationalResetTimer) window.clearTimeout(posOperationalResetTimer);
    posOperationalResetTimer = window.setTimeout(async () => {
        const activePage = currentPosPage();
        if (!activePage) return;
        if (isResettingPosOperationalUi) return;
        isResettingPosOperationalUi = true;
        try {
            resetHooks.closeOpenModal();
            resetHooks.toast('POS đã sang ngày vận hành mới. Màn hình đã được làm mới.', 'info');
            await resetHooks.renderPage(activePage);
        } finally {
            isResettingPosOperationalUi = false;
        }
    }, Math.max(0, delay + 250));
}

export function stopPosOperationalReset() {
    if (posOperationalResetTimer) window.clearTimeout(posOperationalResetTimer);
    posOperationalResetTimer = null;
    isResettingPosOperationalUi = false;
}
