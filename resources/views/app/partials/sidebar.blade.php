<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand-row">
        <a class="brand" href="{{ auth()->user()->isAdmin() ? '/admin/dashboard' : '/pos/coffee' }}">
            <span class="brand-mark" aria-hidden="true">
                <svg class="brand-mark-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7.5 4v16h9"></path>
                    <path d="M7.5 4h4.5a5 5 0 0 1 0 10H7.5"></path>
                </svg>
            </span>
            <span class="brand-copy"><strong>Đồng lầy</strong><small>Fishing</small></span>
        </a>
    </div>
    <nav>
        @if(auth()->user()->isAdmin())
            <p>QUẢN LÝ</p>
            <a href="/admin/dashboard" data-nav="dashboard" title="Tổng quan"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg></span><span class="nav-label">Tổng quan</span></a>
            <a href="/admin/orders" data-nav="orders" title="Quản lý Đơn hàng"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span><span class="nav-label">Đơn hàng</span></a>
            <p>THIẾT LẬP</p>
            <a href="/admin/menu" data-nav="menu" title="Quản lý Menu"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></span><span class="nav-label">Quản lý Menu</span></a>
            <a href="/admin/map" data-nav="map" title="Quản lý Sơ đồ"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg></span><span class="nav-label">Quản lý Sơ đồ</span></a>
            <a href="/admin/users" data-nav="users" title="Quản lý User"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></span><span class="nav-label">Quản lý User</span></a>
            <a href="/admin/settings" data-nav="settings" title="Quản lý thanh toán"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 9h18"></path><path d="M7 15h4"></path><path d="M16 13.5h2"></path><path d="M16 16.5h2"></path></svg></span><span class="nav-label">Quản lý thanh toán</span></a>
        @else
            <p>VẬN HÀNH</p>
            <a href="/pos/coffee" data-nav="coffee" title="Cà phê"><span class="nav-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"></path><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"></path><path d="M3 22h16"></path><path d="M8 2v3M12 2v3"></path></svg></span><span class="nav-label">Cà phê</span></a>
            <a href="/pos/fishing" data-nav="fishing" title="Câu cá"><span class="nav-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12c2.4-3.2 5.2-4.8 8.4-4.8 3.3 0 6.1 1.6 8.6 4.8-2.5 3.2-5.3 4.8-8.6 4.8C9.2 16.8 6.4 15.2 4 12Z"></path><path d="m4 12-3-3v6l3-3Z"></path><circle cx="16.5" cy="11" r=".8" fill="currentColor" stroke="none"></circle><path d="M11 8.2c.5 1.2.5 2.5 0 3.8s-.5 2.6 0 3.8"></path></svg></span><span class="nav-label">Câu cá</span></a>
            <a href="/pos/orders" data-nav="orders" title="Đơn hàng"><span class="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span><span class="nav-label">Đơn hàng</span></a>
        @endif
    </nav>
    <button id="sidebar-collapse-toggle" class="sidebar-collapse-toggle" type="button" aria-label="Thu gọn thanh điều hướng" title="Thu gọn thanh điều hướng">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
</aside>
<button id="sidebar-scrim" class="sidebar-scrim" type="button" aria-label="Đóng menu"></button>
