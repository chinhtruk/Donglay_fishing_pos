import { api } from '../../modules/api.js';
import { escapeHtml, money, number } from '../../modules/format.js';
import { $, $$ } from '../../templates/dom.js';
import { definePageModule } from '../../shell/page-runtime.js';

function localDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function dashboardDatePresets(referenceDate = new Date()) {
    const today = new Date(referenceDate);
    const yesterday = new Date(referenceDate);
    const weekStart = new Date(referenceDate);
    const monthStart = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    weekStart.setDate(weekStart.getDate() - 6);
    monthStart.setDate(monthStart.getDate() - 29);

    return [
        { key: 'today', label: 'Hôm nay', from: localDateStr(today), to: localDateStr(today) },
        { key: 'yesterday', label: 'Hôm qua', from: localDateStr(yesterday), to: localDateStr(yesterday) },
        { key: '7d', label: '7 ngày', from: localDateStr(weekStart), to: localDateStr(today) },
        { key: '30d', label: '30 ngày', from: localDateStr(monthStart), to: localDateStr(today) },
    ];
}

export async function renderDashboard() {
    $('#page-content').classList.add('owner-dashboard-page');
    const today = localDateStr(new Date());
    const from = localDateStr(new Date(Date.now() - 29 * 86400000));
    const data = await api(`/api/v1/admin/dashboard?from=${from}&to=${today}`);
    drawDashboard(data);
}

export const dashboardPage = definePageModule({
    mount: () => renderDashboard(),
});

function drawDashboard(data) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const collected = Number(data.metrics.collected_revenue) || 0;
    const coffeeRev = Number(data.metrics.coffee_revenue) || 0;
    const fishingRev = Number(data.metrics.fishing_revenue) || 0;
    const coffeeShare = collected ? Math.round(coffeeRev / collected * 100) : 0;
    const fishingShare = collected ? Math.max(0, 100 - coffeeShare) : 0;
    const coffeeItems = (data.top_items || []).filter(item => item.line_type === 'menu').slice(0, 5);
    const svg = (path, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" aria-hidden="true">${path}</svg>`;
    const icons = {
        revenue: svg('<rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M7 9h10M7 15h5"></path>'),
        orders: svg('<path d="M7 3h10v18H7zM9.5 8h5M9.5 12h5M9.5 16h3"></path>'),
        ticket: svg('<path d="M4 5h16v14H4zM8 9h8M8 13h5"></path>'),
        outstanding: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'),
        coffee: svg('<path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM17 11h2a2 2 0 0 1 0 4h-2M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2"></path>'),
        fishing: svg('<path d="M3 12s4-5 9-5c4 0 7 3 9 5-2 2-5 5-9 5-5 0-9-5-9-5zM3 12l-2-3v6z"></path><circle cx="15.5" cy="11" r=".8"></circle>'),
        clock: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'),
        user: svg('<circle cx="12" cy="8" r="3"></circle><path d="M5 20c.8-4 3-6 7-6s6.2 2 7 6"></path>')
    };
    const renderTopItems = items => items.length ? items.map((item, index) => {
        const max = Number(items[0]?.revenue) || 1;
        return `<div class="dash-product-row">
            <span class="dash-rank">${index + 1}</span>
            <span class="dash-product-copy"><strong>${escapeHtml(item.name)}</strong><small>${number(item.quantity)} phần</small><i><b style="width:${Math.max(8, Number(item.revenue) / max * 100)}%"></b></i></span>
            <strong>${money(item.revenue)}</strong>
        </div>`;
    }).join('') : '<div class="dash-empty-compact">Chưa có món được thanh toán trong kỳ.</div>';
    const renderPeakHours = hours => hours?.length ? hours.map((hour, index) => `<div class="dash-mini-row"><span><b>${index + 1}</b>${escapeHtml(hour.hour)}</span><small>${number(hour.transactions)} giao dịch</small><strong>${money(hour.revenue)}</strong></div>`).join('') : '<div class="dash-empty-compact">Chưa có dữ liệu theo giờ.</div>';
    const renderCashiers = cashiers => cashiers?.length ? cashiers.map((cashier, index) => `<div class="dash-mini-row"><span><b>${index + 1}</b>${escapeHtml(cashier.name)}</span><small>${number(cashier.transactions)} giao dịch</small><strong>${money(cashier.revenue)}</strong></div>`).join('') : '<div class="dash-empty-compact">Chưa phát sinh giao dịch.</div>';
    const rangePresets = dashboardDatePresets();
    const presetHtml = rangePresets.map(preset => {
        const active = preset.from === data.range.from && preset.to === data.range.to ? ' active' : '';
        return `<button class="button${active}" type="button" data-dashboard-preset="${preset.key}" data-from="${preset.from}" data-to="${preset.to}">${preset.label}</button>`;
    }).join('');

    const filterHtml = `<div class="dashboard-filter-bar" aria-label="Bộ lọc thời gian">
        <div class="dashboard-presets dashboard-range-badges" aria-label="Chọn nhanh doanh thu theo ngày">
            ${presetHtml}
        </div>
        <div class="dashboard-filter">
            <input type="date" id="dashboard-from" value="${data.range.from}" aria-label="Từ ngày">
            <span class="filter-separator">—</span>
            <input type="date" id="dashboard-to" value="${data.range.to}" aria-label="Đến ngày">
            <button class="button primary" id="dashboard-filter">Xem</button>
        </div>
    </div>`;

    const dashboardHead = `<header class="page-head owner-dashboard-head">
        <div class="owner-dashboard-title"><p class="eyebrow">BÁO CÁO QUẢN LÝ</p><h1>Tổng quan kinh doanh</h1></div>
        ${filterHtml}
    </header>`;

    $('#page-content').innerHTML = dashboardHead + `
        <section class="owner-kpis">
            <article class="owner-kpi primary"><span class="owner-kpi-icon">${icons.revenue}</span><div><small>DOANH THU ĐÃ THU</small><strong>${money(data.metrics.collected_revenue)}</strong></div></article>
            <article class="owner-kpi"><span class="owner-kpi-icon">${icons.orders}</span><div><small>ĐƠN HOÀN TẤT</small><strong>${number(data.metrics.paid_order_count)} <em>đơn</em></strong></div></article>
            <article class="owner-kpi"><span class="owner-kpi-icon">${icons.ticket}</span><div><small>GIÁ TRỊ TRUNG BÌNH</small><strong>${money(data.metrics.average_ticket)}</strong></div></article>
            <article class="owner-kpi warning"><span class="owner-kpi-icon">${icons.outstanding}</span><div><small>CÒN PHẢI THU</small><strong>${money(data.metrics.outstanding_amount)}</strong><span class="dash-trend neutral">${number(data.metrics.attention_order_count)} đơn chưa tất toán</span></div></article>
        </section>

        <article class="owner-panel revenue-overview">
            <header class="owner-panel-head"><div><span>DÒNG TIỀN</span><h3>Doanh thu theo thời gian</h3></div><div class="chart-legend"><span class="coffee">Cà phê</span><span class="fishing">Câu cá</span></div></header>
            ${chartSvg(data.daily)}
        </article>

        <section class="owner-main-grid">
            <article class="owner-panel business-card coffee-business">
                <header class="owner-panel-head"><div><span>MÔ HÌNH CÀ PHÊ</span><h3>Hiệu quả bán hàng</h3></div><i>${icons.coffee}</i></header>
                <div class="business-total"><strong>${money(data.coffee_summary.revenue)}</strong><span>${coffeeShare}% tổng doanh thu</span></div>
                <div class="business-stat-grid"><div><small>Đơn hoàn tất</small><strong>${number(data.coffee_summary.paid_orders)}</strong></div><div><small>Sản phẩm đã bán</small><strong>${number(data.coffee_summary.items_sold)}</strong></div></div>
                <div class="business-share"><i style="width:${coffeeShare}%"></i></div>
                <h4>Món đóng góp nhiều nhất</h4>${renderTopItems(coffeeItems)}
            </article>
            <article class="owner-panel business-card fishing-business">
                <header class="owner-panel-head"><div><span>MÔ HÌNH CÂU CÁ</span><h3>Hiệu quả hồ câu</h3></div><i>${icons.fishing}</i></header>
                <div class="business-total"><strong>${money(data.fishing_summary.revenue)}</strong><span>${fishingShare}% tổng doanh thu</span></div>
                <div class="business-stat-grid"><div><small>Phiên bắt đầu</small><strong>${number(data.fishing_summary.sessions_started)}</strong></div><div><small>Lượt gia hạn</small><strong>${number(data.fishing_summary.extensions)}</strong></div></div>
                <div class="fishing-income"><div><span>Tiền phiên câu</span><strong>${money(data.fishing_summary.session_revenue)}</strong></div><div><span>Gọi món tại chòi</span><strong>${money(data.fishing_summary.menu_revenue)}</strong></div></div>
                <div class="occupancy-row"><span>Chòi đang có khách <b>${number(data.metrics.occupied_spots)}/${number(data.metrics.enabled_spots)}</b></span><strong>${number(data.metrics.spot_occupancy_rate)}%</strong></div>
                <div class="business-share"><i style="width:${data.metrics.spot_occupancy_rate}%"></i></div>
            </article>
        </section>

        <section class="owner-bottom-grid">
            <article class="owner-panel"><header class="owner-panel-head"><div><span>NHỊP BÁN HÀNG</span><h3>Khung giờ doanh thu cao</h3></div><i>${icons.clock}</i></header>${renderPeakHours(data.peak_hours)}</article>
            <article class="owner-panel"><header class="owner-panel-head"><div><span>THANH TOÁN</span><h3>Giao dịch theo nhân viên</h3></div><i>${icons.user}</i></header>${renderCashiers(data.cashiers)}</article>
        </section>`;

    const chartWrap = $('.owner-chart-wrap');
    const chartTooltip = $('.owner-chart-tooltip', chartWrap);
    const hideChartTooltip = () => {
        chartTooltip.classList.remove('open');
        $$('[data-chart-stack]', chartWrap).forEach(stack => stack.classList.remove('selected'));
    };
    const showChartTooltip = stack => {
        const date = new Date(`${stack.dataset.day}T00:00:00`).toLocaleDateString('vi-VN', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' });
        chartTooltip.innerHTML = `<strong>${date}</strong><div><span><i class="coffee"></i>Cà phê</span><b>${money(stack.dataset.coffee)}</b></div><div><span><i class="fishing"></i>Câu cá</span><b>${money(stack.dataset.fishing)}</b></div><div class="total"><span>Tổng doanh thu</span><b>${money(stack.dataset.total)}</b></div>`;
        $$('[data-chart-stack]', chartWrap).forEach(item => item.classList.toggle('selected', item === stack));
        chartTooltip.classList.add('open');
        const wrapRect = chartWrap.getBoundingClientRect();
        const stackRect = stack.getBoundingClientRect();
        const tooltipWidth = chartTooltip.offsetWidth;
        const center = stackRect.left - wrapRect.left + stackRect.width / 2;
        const left = Math.max(8, Math.min(center - tooltipWidth / 2, chartWrap.clientWidth - tooltipWidth - 8));
        chartTooltip.style.left = `${left}px`;
        chartTooltip.style.top = `${Math.max(8, stackRect.top - wrapRect.top - chartTooltip.offsetHeight - 12)}px`;
    };
    $$('[data-chart-stack]', chartWrap).forEach(stack => {
        stack.onclick = event => {
            event.stopPropagation();
            if (stack.classList.contains('selected')) hideChartTooltip();
            else showChartTooltip(stack);
        };
        stack.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showChartTooltip(stack);
            }
        };
    });
    chartWrap.onclick = event => {
        if (!event.target.closest('[data-chart-stack]') && !event.target.closest('.owner-chart-tooltip')) hideChartTooltip();
    };

    const filterBtn = $('#dashboard-filter');
    const syncDashboardPresetState = () => {
        const fromValue = $('#dashboard-from')?.value;
        const toValue = $('#dashboard-to')?.value;
        $$('[data-dashboard-preset]').forEach(button => {
            button.classList.toggle('active', button.dataset.from === fromValue && button.dataset.to === toValue);
        });
    };
    filterBtn.onclick = async () => {
        const result = await api(`/api/v1/admin/dashboard?from=${$('#dashboard-from').value}&to=${$('#dashboard-to').value}`);
        drawDashboard(result);
    };
    $('#dashboard-from').oninput = syncDashboardPresetState;
    $('#dashboard-to').oninput = syncDashboardPresetState;
    $$('[data-dashboard-preset]').forEach(button => {
        button.onclick = () => {
            $('#dashboard-from').value = button.dataset.from;
            $('#dashboard-to').value = button.dataset.to;
            syncDashboardPresetState();
            filterBtn.click();
        };
    });

    const sidebarTotal = $('#sidebar-total');
    if (sidebarTotal) sidebarTotal.textContent = money(data.metrics.collected_revenue);
}

function chartSvg(rows) {
    if (!rows.length) return '<div class="empty-state">Chưa có doanh thu trong khoảng này.</div>';
    const compact = window.matchMedia?.('(max-width: 767px)').matches ?? false;
    const width = compact ? 360 : 960;
    const height = compact ? 238 : 300;
    const left = compact ? 48 : 68;
    const right = compact ? 8 : 22;
    const top = compact ? 14 : 18;
    const bottom = compact ? 38 : 42;
    const max = Math.max(...rows.map(row => Number(row.revenue)), 1);
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const slot = plotWidth / rows.length;
    const barWidth = Math.max(compact ? 3 : 5, Math.min(compact ? 14 : 32, slot * .58));

    const grid = [0, .5, 1].map(ratio => {
        const y = top + plotHeight * (1 - ratio);
        return `<line x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text x="${left - 12}" y="${y + 4}">${ratio ? `${Math.round(max * ratio / 1000)}k` : '0'}</text>`;
    }).join('');

    const bars = rows.map((row, index) => {
        const coffee = Number(row.coffee || 0);
        const fishing = Number(row.fishing || 0);
        const coffeeHeight = (coffee / max) * plotHeight;
        const fishingHeight = (fishing / max) * plotHeight;
        const x = left + index * slot + (slot - barWidth) / 2;
        const coffeeY = top + plotHeight - coffeeHeight;
        const fishingY = coffeeY - fishingHeight;
        return `<g class="revenue-stack" role="button" tabindex="0" data-chart-stack data-day="${row.day}" data-coffee="${coffee}" data-fishing="${fishing}" data-total="${coffee + fishing}" aria-label="Xem doanh thu ngày ${row.day}"><rect class="chart-hit-area" x="${left + index * slot}" y="${top}" width="${slot}" height="${plotHeight}"></rect><rect class="coffee-bar" x="${x}" y="${coffeeY}" width="${barWidth}" height="${Math.max(coffeeHeight, coffee ? 2 : 0)}" rx="4"></rect><rect class="fishing-bar" x="${x}" y="${fishingY}" width="${barWidth}" height="${Math.max(fishingHeight, fishing ? 2 : 0)}" rx="4"></rect></g>`;
    }).join('');

    const targetLabelCount = compact ? 4 : 7;
    const labelStep = Math.max(1, Math.ceil((rows.length - 1) / (targetLabelCount - 1)));
    const labels = rows.map((row, index) => index % labelStep === 0 || index === rows.length - 1 ? `<text class="chart-date" x="${left + index * slot + slot / 2}" y="${height - 10}">${new Date(`${row.day}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</text>` : '').join('');

    return `<div class="owner-chart-wrap"><svg class="chart owner-revenue-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <g class="chart-grid">${grid}</g>
            <g class="chart-bars">${bars}</g>
            <g class="chart-labels">${labels}</g>
        </svg><div class="owner-chart-tooltip" role="status" aria-live="polite"></div></div>`;
}
