import { api } from './modules/api.js';
import { confirmModal } from './modules/modal.js';
import { toast } from './modules/toast.js';
import { setupKeyboardViewportGuard } from './modules/keyboard.js';
import { dashboardPage } from './pages/admin/dashboard.js';
import { dataPage } from './pages/admin/data.js';
import { mapPage } from './pages/admin/map.js';
import { menuPage } from './pages/admin/menu.js';
import { settingsPage } from './pages/admin/settings.js';
import { configureAdminUsers, usersPage } from './pages/admin/users.js';
import { setupLogin } from './pages/auth/login.js';
import { closeNotificationDrawer, pollNotificationToasts, setupNotificationDrawer } from './pages/notifications/index.js';
import { ordersPage } from './pages/orders/list.js';
import { configureCheckout } from './pages/pos/checkout.js';
import { coffeePage } from './pages/pos/coffee.js';
import { fishingPage } from './pages/pos/fishing.js';
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
const pageModules = {
    coffee: coffeePage,
    fishing: fishingPage,
    orders: ordersPage,
    dashboard: dashboardPage,
    data: dataPage,
    menu: menuPage,
    map: mapPage,
    settings: settingsPage,
    users: usersPage,
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
        await renderRoutedPage(page, {
            modules: pageModules,
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
