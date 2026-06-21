const token = () => document.querySelector('meta[name="csrf-token"]')?.content;

export async function api(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json', ...(!isFormData ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-TOKEN': token(), ...(options.headers || {}) },
        ...options,
        body: options.body && typeof options.body !== 'string' && !isFormData ? JSON.stringify(options.body) : options.body,
    });
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) {
        if (response.status === 401 || response.status === 419) window.location.href = '/login';
        const validation = payload.errors ? Object.values(payload.errors).flat()[0] : null;
        const fallback = response.status === 413
            ? 'Tổng dung lượng ảnh trong lần lưu này hơi lớn. Bạn hãy giảm số ảnh hoặc dung lượng ảnh rồi thử lại nhé.'
            : 'Có một nhịp nhỏ chưa khớp. Bạn thử lại giúp mình nhé.';
        const error = new Error(validation || payload.message || fallback);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}
