<header class="topbar">
    <button id="menu-toggle" class="icon-button mobile-only" type="button" aria-label="Mở menu" aria-controls="sidebar" aria-expanded="false">
        <svg class="menu-toggle-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
    </button>
    <div class="clock"><strong id="live-time">--:--</strong><span id="live-date">--</span></div>
    <div class="top-actions">
        @if(auth()->user()->isAdmin())
            <button id="notification-bell" class="notification-bell" type="button" aria-label="Mở trung tâm thông báo" aria-controls="notification-drawer" aria-expanded="false">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>
                <span id="notification-badge" class="notification-badge hidden">0</span>
            </button>
        @endif
        @include('app.partials.profile-menu')
    </div>
</header>
