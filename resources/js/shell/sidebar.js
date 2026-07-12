import { $, $$ } from '../templates/dom.js';

export function setupSidebar({ page, lifecycle = null }) {
    $$('#sidebar [data-nav]').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === page);
    });

    const sidebar = $('#sidebar');
    const menuToggle = $('#menu-toggle');
    const scrim = $('#sidebar-scrim');
    const collapseButton = $('#sidebar-collapse-toggle');
    const listen = (target, eventName, callback) => {
        if (lifecycle?.listen) return lifecycle.listen(target, eventName, callback);
        target?.addEventListener?.(eventName, callback);
        return () => target?.removeEventListener?.(eventName, callback);
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        menuToggle?.setAttribute('aria-expanded', 'false');
    };

    const toggleSidebar = () => {
        if (!sidebar || !menuToggle) return;
        const opening = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', opening);
        document.body.classList.toggle('sidebar-open', opening);
        menuToggle.setAttribute('aria-expanded', String(opening));
    };

    const syncCollapseButton = () => {
        if (!collapseButton) return;
        const collapsed = document.documentElement.classList.contains('sidebar-collapsed');
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng');
        collapseButton.title = collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';
    };

    const toggleCollapsed = () => {
        const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
        try { localStorage.setItem('donglay.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (_) {}
        syncCollapseButton();
    };
    const handleResize = () => {
        if (window.innerWidth > 820) closeSidebar();
    };

    syncCollapseButton();
    menuToggle?.setAttribute('aria-expanded', 'false');
    listen(collapseButton, 'click', toggleCollapsed);
    listen(menuToggle, 'click', toggleSidebar);
    listen(scrim, 'click', closeSidebar);
    $$('#sidebar nav a').forEach(link => listen(link, 'click', closeSidebar));
    listen(window, 'resize', handleResize);

    return { closeSidebar };
}
