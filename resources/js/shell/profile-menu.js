import { $ } from '../templates/dom.js';

export function setupProfileMenu({ api, confirmModal, closeNotificationDrawer, lifecycle = null }) {
    const button = $('#profile-menu-button');
    const menu = $('#profile-menu');
    const logoutButton = $('#logout-button');
    const listen = (target, eventName, callback) => {
        if (lifecycle?.listen) return lifecycle.listen(target, eventName, callback);
        target?.addEventListener?.(eventName, callback);
        return () => target?.removeEventListener?.(eventName, callback);
    };

    const closeProfileMenu = () => {
        menu?.classList.add('hidden');
        button?.setAttribute('aria-expanded', 'false');
    };

    const toggleProfileMenu = event => {
        event.stopPropagation();
        if (!menu) return;
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !opening);
        button.setAttribute('aria-expanded', String(opening));
    };

    const logout = async () => {
        closeProfileMenu();
        const confirmed = await confirmModal(
            'Đăng xuất khỏi ca làm?',
            'Bạn có chắc muốn đăng xuất tài khoản hiện tại không? Các đơn đang mở vẫn được giữ nguyên trong hệ thống.',
            'Đăng xuất'
        );
        if (! confirmed) return;
        const result = await api('/api/v1/logout', { method:'POST' });
        window.location.href = result.redirect;
    };

    const closeFromOutside = event => {
        if (!event.target.closest('.profile-menu-wrap')) closeProfileMenu();
    };
    const closeFromKeyboard = event => {
        if (event.key === 'Escape') {
            closeProfileMenu();
            closeNotificationDrawer?.();
        }
    };

    listen(button, 'click', toggleProfileMenu);
    listen(logoutButton, 'click', logout);
    listen(document, 'click', closeFromOutside);
    listen(document, 'keydown', closeFromKeyboard);

    return { closeProfileMenu };
}
