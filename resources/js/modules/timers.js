export function remaining(endsAt, now = Date.now()) { return Math.max(0, new Date(endsAt).getTime() - now); }
export function duration(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}
export class ServerClock {
    constructor(serverTime = new Date().toISOString()) { this.offset = new Date(serverTime).getTime() - Date.now(); }
    now() { return Date.now() + this.offset; }
}
