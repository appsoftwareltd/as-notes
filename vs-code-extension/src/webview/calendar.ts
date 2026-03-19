declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────

let currentYear: number;
let currentMonth: number; // 0-indexed
let journalDates = new Set<string>();

const today = new Date();
currentYear = today.getFullYear();
currentMonth = today.getMonth();

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ── Helpers ───────────────────────────────────────────────────────────────

function pad2(n: number): string {
    return n < 10 ? '0' + n : '' + n;
}

function toDateStr(y: number, m: number, d: number): string {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function todayStr(): string {
    const t = new Date();
    return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Render ────────────────────────────────────────────────────────────────

function render(): void {
    const app = document.getElementById('app');
    if (!app) { return; }

    const todayDate = todayStr();

    // First day of month and day count
    const firstDay = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Day of week for the 1st (0=Sun, convert to Mon-start: Mon=0..Sun=6)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) { startDow = 6; }

    // Build header
    let html = `<div class="cal-header">
        <button class="cal-nav" id="btn-prev" title="Previous month">&#9664;</button>
        <span class="cal-title">${esc(MONTH_NAMES[currentMonth])} ${currentYear}</span>
        <button class="cal-nav" id="btn-next" title="Next month">&#9654;</button>
    </div>`;

    // Day-of-week headers
    html += '<div class="cal-grid">';
    for (const dh of DAY_HEADERS) {
        html += `<div class="cal-dow">${dh}</div>`;
    }

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
        html += '<div class="cal-blank"></div>';
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = toDateStr(currentYear, currentMonth, d);
        const isToday = dateStr === todayDate;
        const hasJournal = journalDates.has(dateStr);

        const classes = ['cal-day'];
        if (isToday) { classes.push('cal-today'); }
        if (hasJournal) { classes.push('cal-has-journal'); }

        html += `<button class="${classes.join(' ')}" data-date="${esc(dateStr)}" title="${esc(dateStr)}">
            <span class="cal-day-num">${d}</span>
            ${hasJournal ? '<span class="cal-dot"></span>' : ''}
        </button>`;
    }

    html += '</div>';
    app.innerHTML = html;
}

// ── Event Handling ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', handleClick);
    vscode.postMessage({ type: 'ready' });
});

function handleClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;

    // Nav buttons
    if (t.id === 'btn-prev' || t.closest('#btn-prev')) {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        render();
        return;
    }
    if (t.id === 'btn-next' || t.closest('#btn-next')) {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        render();
        return;
    }

    // Day click
    const dayBtn = t.closest('.cal-day') as HTMLElement | null;
    if (dayBtn?.dataset.date) {
        vscode.postMessage({ type: 'openJournal', date: dayBtn.dataset.date });
    }
}

// ── Messages from extension ───────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; dates?: string[] };
    if (msg.type === 'journalDates' && msg.dates) {
        journalDates = new Set(msg.dates);
        render();
    }
});
