export const number = (value) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0));
export const money = (value) => `${number(value)} ₫`;
export const moneyInputDigits = (value = '') => String(value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
export const formatMoneyInput = (value = '') => {
    const digits = moneyInputDigits(value);
    return digits ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(digits)) : '';
};
// Prices returned by Laravel/MySQL DECIMAL columns can be strings such as
// "15000.00". Normalize that stored value before applying the input formatter,
// otherwise stripping non-digits would incorrectly turn it into 1,500,000.
export const formatStoredMoneyInput = (value = '') => {
    const amount = Number(value);
    return Number.isFinite(amount) ? formatMoneyInput(String(Math.round(amount))) : '';
};
export const parseMoneyInput = (value = '') => Number(moneyInputDigits(value) || 0);
export const dateTime = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
export const dateOnly = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : '—';
export const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' })[char]);
export const statusLabel = (status) => ({ open:'Đang mở', partially_paid:'Thanh toán một phần', paid:'Hoàn tất', void:'Đã hủy', payment_exception:'Cần đối soát', active:'Đang câu', expired:'Hết giờ' }[status] || status);
export const statusClass = (status) => ({ open:'warn', partially_paid:'warn', void:'danger', payment_exception:'danger', expired:'danger', paid:'', active:'' }[status] || 'gray');
