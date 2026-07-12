export function paymentMethodIcon(type = 'qr') {
    if (type === 'cash') {
        return '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 9h1.5M16.5 15H18"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"></path></svg>';
}

export function paymentMethodTypeLabel(type = 'qr') {
    return type === 'cash' ? 'Tiền mặt' : 'QR / chuyển khoản';
}

export function paymentMethodDisplayLabel(method = 'cash') {
    if (method === 'cash') return 'Tiền mặt';
    if (method === 'auto_close') return 'Tự động chốt ngày';
    if (String(method).startsWith('qr')) return 'QR / chuyển khoản';
    return method || 'Khác';
}
