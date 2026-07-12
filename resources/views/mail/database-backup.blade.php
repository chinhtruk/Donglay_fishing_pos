<p>Xin chào {{ $beforeReset ? 'quản trị viên' : 'Admin' }},</p>

<p>File đính kèm là bản sao lưu database Đồng lầy Fishing được tạo lúc {{ now()->format('H:i d/m/Y') }}.</p>

@if ($beforeReset)
    <p>Bản sao lưu này được gửi tự động trước khi dữ liệu vận hành trên hệ thống được xóa.</p>
@endif

<p>Hãy lưu file ở nơi an toàn. Hệ thống không giữ bản sao của file này trên server.</p>
