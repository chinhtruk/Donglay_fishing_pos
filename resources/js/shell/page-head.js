import { $ } from '../templates/dom.js';

export function liveClockParts(now = new Date()) {
    return {
        time: now.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        date: now.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' }),
    };
}

export function updateLiveClock(now = new Date()) {
    const timeNode = $('#live-time');
    if (!timeNode) return;

    const parts = liveClockParts(now);
    timeNode.textContent = parts.time;
    $('#live-date').textContent = parts.date;
}

export function setupLiveClock() {
    updateLiveClock();

    return window.setInterval(updateLiveClock, 1000);
}
