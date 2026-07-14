import { $, $$ } from '../templates/dom.js';

export const isMobileSidebarViewport = (width = window.innerWidth) => Number(width) <= 767;

export function setupSidebar({ page, lifecycle = null }) {
    $$('#sidebar [data-nav]').forEach(link => {
        const active = link.dataset.nav === page;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    const sidebar = $('#sidebar');
    const menuToggle = $('#menu-toggle');
    const mobileCloseButton = $('#sidebar-mobile-close');
    const scrim = $('#sidebar-scrim');
    const collapseButton = $('#sidebar-collapse-toggle');
    const mobileQuery = window.matchMedia?.('(max-width: 767px)');
    let lastFocusedElement = null;
    let wasMobile = mobileQuery?.matches ?? isMobileSidebarViewport();
    const listen = (target, eventName, callback) => {
        if (lifecycle?.listen) return lifecycle.listen(target, eventName, callback);
        target?.addEventListener?.(eventName, callback);
        return () => target?.removeEventListener?.(eventName, callback);
    };

    const isMobile = () => mobileQuery?.matches ?? isMobileSidebarViewport();
    const drawerIsOpen = () => Boolean(isMobile() && sidebar?.classList.contains('open'));
    const drawerFocusables = () => sidebar
        ? Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
        : [];

    const syncDrawerAccessibility = () => {
        const mobile = isMobile();
        const open = drawerIsOpen();

        menuToggle?.setAttribute('aria-expanded', String(open));
        menuToggle?.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
        scrim?.setAttribute('aria-hidden', String(!open));
        if (scrim) scrim.tabIndex = open ? 0 : -1;

        if (sidebar) {
            if (mobile) sidebar.setAttribute('aria-hidden', String(!open));
            else sidebar.removeAttribute('aria-hidden');
            if ('inert' in sidebar) sidebar.inert = mobile && !open;
        }
    };

    const closeSidebar = ({ restoreFocus = false } = {}) => {
        const wasOpen = drawerIsOpen();
        sidebar?.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        syncDrawerAccessibility();

        if (restoreFocus && wasOpen) {
            const focusTarget = lastFocusedElement?.isConnected ? lastFocusedElement : menuToggle;
            focusTarget?.focus?.();
        }
        lastFocusedElement = null;
    };

    const openSidebar = () => {
        if (!sidebar || !menuToggle || !isMobile()) return;
        lastFocusedElement = document.activeElement;
        sidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
        syncDrawerAccessibility();
        document.dispatchEvent(new CustomEvent('donglay:sidebar-open'));

        window.requestAnimationFrame(() => {
            const preferredTarget = sidebar.querySelector('[data-nav].active') || drawerFocusables()[0];
            preferredTarget?.focus?.();
        });
    };

    const toggleSidebar = () => {
        if (drawerIsOpen()) closeSidebar({ restoreFocus: true });
        else openSidebar();
    };

    const syncCollapseButton = () => {
        if (!collapseButton) return;
        const collapsed = document.documentElement.classList.contains('sidebar-collapsed');
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng');
        collapseButton.title = collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';
    };

    const toggleCollapsed = () => {
        if (isMobile()) return;
        const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
        try { localStorage.setItem('donglay.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (_) {}
        syncCollapseButton();
    };
    const handleViewportChange = () => {
        const mobile = isMobile();
        if (mobile !== wasMobile) closeSidebar();
        wasMobile = mobile;
        syncDrawerAccessibility();
    };
    const handleKeyboard = event => {
        if (!drawerIsOpen()) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeSidebar({ restoreFocus: true });
            return;
        }
        if (event.key !== 'Tab') return;

        const focusables = drawerFocusables();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
        }
    };

    syncCollapseButton();
    closeSidebar();
    listen(collapseButton, 'click', toggleCollapsed);
    listen(menuToggle, 'click', toggleSidebar);
    listen(mobileCloseButton, 'click', () => closeSidebar({ restoreFocus: true }));
    listen(scrim, 'click', () => closeSidebar({ restoreFocus: true }));
    $$('#sidebar nav a').forEach(link => listen(link, 'click', closeSidebar));
    listen(document, 'keydown', handleKeyboard);
    listen(document, 'donglay:notification-drawer-open', () => closeSidebar());
    if (mobileQuery) listen(mobileQuery, 'change', handleViewportChange);
    else listen(window, 'resize', handleViewportChange);

    return { closeSidebar };
}
