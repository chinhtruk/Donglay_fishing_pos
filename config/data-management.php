<?php

return [
    'mysqldump_binary' => env('MYSQLDUMP_BINARY', 'mysqldump'),
    'operational_tables' => [
        'notifications',
        'audit_logs',
        'payment_adjustments',
        'payment_lines',
        'payments',
        'fishing_sessions',
        'order_items',
        'orders',
        'otp_challenges',
    ],
];
