import { $ } from '../templates/dom.js';

export function setupProfileMenu({ api, confirmModal, closeNotificationDrawer }) {
    const button = $('#profile-menu-button');
    const menu = $('#profile-menu');
    const logoutButton = $('#logout-button');

    const closeProfileMenu = () => {
        menu?.classList.add('hidden');
        button?.setAttribute('aria-expanded', 'false');
    };

    button?.addEventListener('click', event => {
        event.stopPropagation();
        if (!menu) return;
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !opening);
        button.setAttribute('aria-expanded', String(opening));
    });

    logoutButton?.addEventListener('click', async () => {
        closeProfileMenu();
        const confirmed = await confirmModal(
            'Đăng xuất khỏi ca làm?',
            'Bạn có chắc muốn đăng xuất tài khoản hiện tại không? Các đơn đang mở vẫn được giữ nguyên trong hệ thống.',
            'Đăng xuất'
        );
        if (! confirmed) return;
        const result = await api('/api/v1/logout', { method:'POST' });
        window.location.href = result.redirect;
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.profile-menu-wrap')) closeProfileMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeProfileMenu();
            closeNotificationDrawer?.();
        }
    });

    return { closeProfileMenu };
}
