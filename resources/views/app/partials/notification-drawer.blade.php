@if(auth()->user()->isAdmin())
    <button id="notification-drawer-scrim" class="notification-drawer-scrim hidden" type="button" aria-label="Đóng trung tâm thông báo"></button>
    <aside id="notification-drawer" class="notification-drawer" aria-hidden="true" aria-label="Trung tâm thông báo">
        <header class="notification-drawer-head">
            <div>
                <small>TRUNG TÂM</small>
                <strong>Thông báo</strong>
            </div>
            <button id="notification-drawer-close" class="icon-button" type="button" aria-label="Đóng trung tâm thông báo">×</button>
        </header>
        <div class="notification-drawer-controls">
            <div class="notification-tabs" role="tablist" aria-label="Trạng thái thông báo">
                <button type="button" class="active" data-notification-read-filter="all" aria-pressed="true">Tất cả</button>
                <button type="button" data-notification-read-filter="unread" aria-pressed="false">Chưa đọc</button>
            </div>
            <div class="notification-category-tabs" aria-label="Loại thông báo">
                <button type="button" class="active" data-notification-category="" aria-pressed="true">Tất cả</button>
                <button type="button" data-notification-category="orders" aria-pressed="false">Đơn hàng</button>
                <button type="button" data-notification-category="payments" aria-pressed="false">Thanh toán</button>
                <button type="button" data-notification-category="map" aria-pressed="false">Sơ đồ</button>
                <button type="button" data-notification-category="system" aria-pressed="false">Hệ thống</button>
            </div>
        </div>
        <div id="notification-drawer-list" class="notification-drawer-list">
            <div class="notification-empty">Đang tải thông báo...</div>
        </div>
        <footer class="notification-drawer-foot">
            <button id="notification-read-all" class="button secondary" type="button">Đánh dấu tất cả đã đọc</button>
        </footer>
    </aside>
@endif
