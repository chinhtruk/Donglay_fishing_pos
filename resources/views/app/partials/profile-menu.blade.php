<div class="profile-menu-wrap">
    <button id="profile-menu-button" class="profile" type="button" aria-haspopup="menu" aria-controls="profile-menu" aria-expanded="false" aria-label="Mở menu tài khoản của {{ auth()->user()->name }}">
        <span class="avatar">{{ mb_strtoupper(mb_substr(auth()->user()->name, 0, 1)) }}</span>
        <span class="profile-copy"><strong>{{ auth()->user()->name }}</strong><small>{{ auth()->user()->isAdmin() ? 'Quản trị viên' : 'Nhân viên' }}</small></span>
        <svg class="profile-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
    <div id="profile-menu" class="profile-menu hidden" role="menu">
        <div class="profile-menu-head">
            <span class="avatar">{{ mb_strtoupper(mb_substr(auth()->user()->name, 0, 1)) }}</span>
            <span><strong>{{ auth()->user()->name }}</strong><small>{{ auth()->user()->isAdmin() ? 'Quản trị viên' : 'Nhân viên' }}</small></span>
        </div>
        <button id="logout-button" class="profile-menu-item danger" type="button" role="menuitem">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Đăng xuất
        </button>
    </div>
</div>
