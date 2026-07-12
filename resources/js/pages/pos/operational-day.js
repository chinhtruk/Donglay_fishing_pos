let posOperationalResetCleanup = null;
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

export function schedulePosOperationalReset(payload = {}, lifecycle = null) {
    const page = currentPosPage();
    if (!page) return;

    const serverTime = payload.server_time;
    const resetAt = payload.operational_day?.resets_at;
    if (!serverTime || !resetAt) return;

    const delay = new Date(resetAt).getTime() - new Date(serverTime).getTime();
    if (!Number.isFinite(delay)) return;

    posOperationalResetCleanup?.();
    const reset = async () => {
        posOperationalResetCleanup = null;
        const activePage = currentPosPage();
        if (!activePage) return;
        if (isResettingPosOperationalUi) return;
        isResettingPosOperationalUi = true;
        try {
            resetHooks.closeOpenModal();
            resetHooks.toast('Đã chốt ngày: các đơn còn mở được ghi nhận thanh toán và màn hình POS đã làm mới.', 'info');
            await resetHooks.renderPage(activePage);
        } finally {
            isResettingPosOperationalUi = false;
        }
    };
    const timeout = Math.max(0, delay + 250);
    if (lifecycle?.timeout) {
        posOperationalResetCleanup = lifecycle.timeout(reset, timeout);
        return;
    }

    const timer = window.setTimeout(reset, timeout);
    posOperationalResetCleanup = () => window.clearTimeout(timer);
}

export function stopPosOperationalReset() {
    posOperationalResetCleanup?.();
    posOperationalResetCleanup = null;
    isResettingPosOperationalUi = false;
}
