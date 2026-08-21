import { api } from './modules/api.js';
import { confirmModal } from './modules/modal.js';
import { toast } from './modules/toast.js';
import { setupKeyboardViewportGuard } from './modules/keyboard.js';
import { configureAdminUsers } from './pages/admin/users.js';
import { setupLogin } from './pages/auth/login.js';
import { closeNotificationDrawer, pollNotificationToasts, setupNotificationDrawer } from './pages/notifications/index.js';
import { configureCheckout } from './pages/pos/checkout.js';
import { configurePosOperationalReset } from './pages/pos/operational-day.js';
import { createLifecycleScope } from './shell/lifecycle.js';
import { createPageRuntime } from './shell/page-runtime.js';
import { setupLiveClock } from './shell/page-head.js';
import { setupProfileMenu } from './shell/profile-menu.js';
import { pageFromPath, renderRoutedPage } from './shell/router.js';
import { setupSidebar } from './shell/sidebar.js';
import { $, emptyState, setLoading } from './templates/dom.js';

const appLifecycle = createLifecycleScope();
const pageRuntime = createPageRuntime();

// Lazy-loaded page modules — Vite will code-split each dynamic import into its own chunk
const pageLoaders = {
    coffee: () => import('./pages/pos/coffee.js').then(m => m.coffeePage),
    fishing: () => import('./pages/pos/fishing.js').then(m => m.fishingPage),
    orders: () => import('./pages/orders/list.js').then(m => m.ordersPage),
    dashboard: () => import('./pages/admin/dashboard.js').then(m => m.dashboardPage),
    data: () => import('./pages/admin/data.js').then(m => m.dataPage),
    menu: () => import('./pages/admin/menu.js').then(m => m.menuPage),
    map: () => import('./pages/admin/map.js').then(m => m.mapPage),
    settings: () => import('./pages/admin/settings.js').then(m => m.settingsPage),
    users: () => import('./pages/admin/users.js').then(m => m.usersPage),
};

setupKeyboardViewportGuard();
configureAdminUsers({ toast });
configureCheckout({ renderPage });
configurePosOperationalReset({ closeOpenModal, renderPage, toast });

function setupShell() {
    setupLiveClock(appLifecycle);
    const page = pageFromPath(location.pathname);
    setupSidebar({ page, lifecycle: appLifecycle });
    setupNotificationDrawer({ lifecycle: appLifecycle });
    setupProfileMenu({ api, confirmModal, closeNotificationDrawer, lifecycle: appLifecycle });
    pollNotificationToasts();
    appLifecycle.interval(pollNotificationToasts, 3000);
    renderPage(page);
}

function closeOpenModal() {
    const root = $('#modal-root');
    if (!root) return;
    const closeButton = root.querySelector('.modal-close');
    if (closeButton) {
        closeButton.click();
        return;
    }
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
}

async function renderPage(page) {
    try {
        const loader = pageLoaders[page];
        if (!loader) throw new Error(`No page module registered for "${page}".`);
        const module = await loader();
        await renderRoutedPage(page, {
            modules: { [page]: module },
            runtime: pageRuntime,
            beforeRender() {
                setLoading();
            },
            onError(error) {
                $('#page-content').innerHTML = emptyState('Mình chưa tải được khu vực này', error.message);
            },
        });
    } finally {
        $('#page-content')?.setAttribute('aria-busy', 'false');
    }
}

if (document.body.dataset.view === 'login') setupLogin();
if (document.body.dataset.view === 'app') setupShell();
