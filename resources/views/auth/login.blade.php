<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Đăng nhập · Đồng lầy Fishing</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="login-page" data-view="login">

{{-- Background blobs (OUTSIDE main, pointer-events none, z-index 0) --}}
<div class="lp-bg" aria-hidden="true">
    <div class="lp-blob lp-blob-a"></div>
    <div class="lp-blob lp-blob-b"></div>
    <div class="lp-blob lp-blob-c"></div>
    <div class="lp-blob lp-blob-d"></div>
</div>

{{-- Shell sits on top (z-index 1) --}}
<main class="lp-shell">
    <section class="lp-card" aria-labelledby="login-title">

        {{-- ── Brand text ── --}}
        <div class="lp-brand lp-brand--text-only">
            <span class="lp-brand-text">
                <strong>Đồng lầy</strong>
                <small>FISHING</small>
            </span>
        </div>

        {{-- ── Role switch ── --}}
        <div class="lp-tabs" role="tablist" aria-label="Chọn vai trò">
            <button id="login-tab-employee" class="lp-tab lp-tab--active" type="button" role="tab"
                    aria-selected="true" aria-controls="employee-login" tabindex="0" data-login-tab="employee">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Nhân viên
            </button>
            <button id="login-tab-admin" class="lp-tab" type="button" role="tab"
                    aria-selected="false" aria-controls="admin-login" tabindex="-1" data-login-tab="admin">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                Quản trị viên
            </button>
        </div>

        {{-- ── EMPLOYEE FORM ── --}}
        <form id="employee-login" class="lp-form" role="tabpanel" aria-labelledby="login-tab-employee" novalidate>

            {{-- Bước 1 – Tên đăng nhập --}}
            <div id="employee-username-stage" class="lp-stage">
                <header class="lp-intro">
                    <h1 id="login-title">Chào mừng trở lại</h1>
                    <p>Nhập tên đăng nhập được cấp để bắt đầu ca làm việc.</p>
                </header>

                <div class="lp-field">
                    <label for="emp-username">Tên đăng nhập</label>
                    <input id="emp-username" name="username"
                           placeholder="Ví dụ: nhanvien01"
                           autocomplete="username" autocapitalize="none" spellcheck="false"
                           maxlength="80" required>
                </div>

                <button class="lp-btn" type="submit">
                    <span>Tiếp tục</span>
                </button>
            </div>

            {{-- Bước 2 – Mã xác minh --}}
            <div id="employee-otp-stage" class="lp-stage hidden">
                <header class="lp-intro">
                    <h1>Kiểm tra hộp thư</h1>
                    <p class="lp-copy-stack"><span>Mã xác minh vừa được gửi đến email liên kết với tài khoản.</span><span>Mã có hiệu lực trong 10 phút.</span></p>
                </header>

                {{-- Username summary box (floating label style) --}}
                <div class="lp-outlined">
                    <span class="lp-outlined-label">Tên đăng nhập</span>
                    <div class="lp-outlined-row">
                        <span id="otp-username-display" class="lp-outlined-val"></span>
                        <button id="edit-login-username" type="button" class="lp-amber-link">Sửa</button>
                    </div>
                </div>

                {{-- OTP input --}}
                <div class="lp-field">
                    <label for="emp-otp">Mã xác minh</label>
                    <input id="emp-otp" class="lp-code-input" type="text" name="code"
                           inputmode="numeric" pattern="[0-9]*" maxlength="6"
                           autocomplete="one-time-code"
                           placeholder="••••••">
                </div>

                <button class="lp-btn" type="submit">
                    <span>Xác nhận và đăng nhập</span>
                </button>

                <button id="resend-otp" type="button" class="lp-resend" disabled>
                    Gửi lại mã sau 60 giây
                </button>
            </div>

        </form>

        {{-- ── ADMIN FORM ── --}}
        <form id="admin-login" class="lp-form hidden" role="tabpanel" aria-labelledby="login-tab-admin" novalidate>
            <header class="lp-intro">
                <h1>Đăng nhập quản trị</h1>
                <p>Sử dụng tài khoản quản trị để tiếp tục.</p>
            </header>

            <div class="lp-field">
                <label for="admin-username">Tên đăng nhập</label>
                <input id="admin-username" name="username"
                       autocomplete="username"
                       placeholder="Tên đăng nhập" required>
            </div>

            <div class="lp-field">
                <label for="admin-password">Mật khẩu</label>
                <div class="lp-pw-wrap">
                    <input id="admin-password" type="password" name="password"
                           autocomplete="current-password"
                           placeholder="Nhập mật khẩu" required>
                    <button type="button" class="lp-eye" id="admin-pw-toggle"
                            aria-label="Hiện / Ẩn mật khẩu">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
            </div>

            <button class="lp-btn" type="submit">
                <span>Vào trang quản trị</span>
            </button>
        </form>

        <p id="login-message" class="lp-message" aria-live="polite"></p>
        <p class="lp-help"><span>Bạn gặp khó khăn khi đăng nhập?</span><span>Hãy liên hệ quản trị viên của quán.</span></p>

    </section>
</main>
</body>
</html>
