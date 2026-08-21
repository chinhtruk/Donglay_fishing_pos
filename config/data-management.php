<?php

return [
    'mysqldump_binary' => env('MYSQLDUMP_BINARY', 'mysqldump'),
    // Thứ tự xóa: bảng con trước, bảng cha sau để tránh lỗi FK
    'operational_tables' => [
        'notifications',
        'audit_logs',
        'otp_challenges',
        'payment_lines',
        'payment_adjustments',
        'payments',
        'order_items',
        'fishing_sessions',
        'orders',
    ],
];
