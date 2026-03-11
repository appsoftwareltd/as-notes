// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchEntry {
    label: string;
    detail: string;
    pagePath: string;
    pageFileName: string;
    kind: 'page' | 'alias' | 'forward';
}

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────────

let allEntries: SearchEntry[] = [];
let filteredEntries: SearchEntry[] = [];
let activeIndex = -1;
let selectedEntry: SearchEntry | null = null;

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RESULTS = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const ICON_SEARCH = `<svg class="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4.75"/><path d="M10 10l3.5 3.5"/></svg>`;

const ICON_PAGE = `<svg class="entry-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h5.5L13 5.5V14H4V2z"/><path d="M9 2v4h4"/></svg>`;

const ICON_ALIAS = `<svg class="entry-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h8M4 10h5"/><path d="M12 9l2 2-2 2"/></svg>`;

const ICON_FORWARD = `<svg class="entry-icon entry-icon-new" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M3 8h10"/></svg>`;

const ICON_GO = `<svg class="goto-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;

// ── Filtering ─────────────────────────────────────────────────────────────────

function filterEntries(query: string): SearchEntry[] {
    if (!query) { return []; }
    const lc = query.toLowerCase();
    const results: SearchEntry[] = [];
    for (const entry of allEntries) {
        if (entry.label.toLowerCase().includes(lc)) {
            results.push(entry);
            if (results.length >= MAX_RESULTS) { break; }
        }
    }
    return results;
}

function entryIcon(kind: string): string {
    switch (kind) {
        case 'alias': return ICON_ALIAS;
        case 'forward': return ICON_FORWARD;
        default: return ICON_PAGE;
    }
}

// ── DOM rendering ─────────────────────────────────────────────────────────────

function buildDropdownItem(entry: SearchEntry, index: number): string {
    const active = index === activeIndex ? ' dropdown-item-active' : '';
    const badge = entry.kind === 'forward'
        ? '<span class="badge-new">New</span>'
        : '';
    const detail = entry.detail
        ? `<span class="entry-detail">${esc(entry.detail)}</span>`
        : '';

    return `<div class="dropdown-item${active}" data-index="${index}">
        ${entryIcon(entry.kind)}
        <div class="entry-content">
            <span class="entry-label">${esc(entry.label)}</span>
            ${detail}
        </div>
        ${badge}
    </div>`;
}

function render(): void {
    const app = document.getElementById('app')!;
    app.innerHTML = `
        <div class="search-container">
            <div class="search-bar">
                ${ICON_SEARCH}
                <input id="search-input"
                       type="text"
                       placeholder="Search wikilinks..."
                       autocomplete="off"
                       spellcheck="false" />
                <button id="goto-btn" class="goto-btn" title="Go to page" disabled>
                    ${ICON_GO}
                </button>
            </div>
            <div id="dropdown" class="dropdown hidden"></div>
        </div>`;

    attachHandlers();
}

function renderDropdown(): void {
    const dropdown = document.getElementById('dropdown')!;
    if (filteredEntries.length === 0) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
    }
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = filteredEntries
        .map((entry, i) => buildDropdownItem(entry, i))
        .join('');

    // Attach click handlers
    dropdown.querySelectorAll<HTMLDivElement>('.dropdown-item').forEach(item => {
        item.addEventListener('mousedown', e => {
            e.preventDefault(); // prevent blur
            const idx = parseInt(item.dataset.index!, 10);
            selectEntry(idx);
        });
    });
}

function updateGoButton(): void {
    const btn = document.getElementById('goto-btn') as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = !selectedEntry;
    }
}

function selectEntry(index: number): void {
    if (index < 0 || index >= filteredEntries.length) { return; }
    activeIndex = index;
    selectedEntry = filteredEntries[index];

    const input = document.getElementById('search-input') as HTMLInputElement;
    input.value = selectedEntry.label;

    // Close dropdown
    filteredEntries = [];
    renderDropdown();
    updateGoButton();
}

function navigateToSelected(): void {
    if (!selectedEntry) { return; }
    vscode.postMessage({
        type: 'navigateTo',
        pageFileName: selectedEntry.pageFileName,
        pagePath: selectedEntry.pagePath,
        kind: selectedEntry.kind,
    });
}

// ── Event handlers ────────────────────────────────────────────────────────────

function attachHandlers(): void {
    const input = document.getElementById('search-input') as HTMLInputElement;
    const gotoBtn = document.getElementById('goto-btn') as HTMLButtonElement;

    input.addEventListener('input', () => {
        const query = input.value.trim();
        selectedEntry = null;
        activeIndex = -1;
        filteredEntries = filterEntries(query);
        renderDropdown();
        updateGoButton();
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredEntries.length === 0) { return; }
            activeIndex = Math.min(activeIndex + 1, filteredEntries.length - 1);
            renderDropdown();
            scrollActiveIntoView();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredEntries.length === 0) { return; }
            activeIndex = Math.max(activeIndex - 1, 0);
            renderDropdown();
            scrollActiveIntoView();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filteredEntries.length) {
                selectEntry(activeIndex);
                navigateToSelected();
            } else if (selectedEntry) {
                navigateToSelected();
            }
        } else if (e.key === 'Escape') {
            filteredEntries = [];
            activeIndex = -1;
            renderDropdown();
        }
    });

    input.addEventListener('blur', () => {
        // Delay to allow mousedown on dropdown items to fire first
        setTimeout(() => {
            filteredEntries = [];
            activeIndex = -1;
            renderDropdown();
        }, 150);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query && filteredEntries.length === 0) {
            filteredEntries = filterEntries(query);
            renderDropdown();
        }
    });

    gotoBtn.addEventListener('click', () => {
        navigateToSelected();
    });
}

function scrollActiveIntoView(): void {
    const dropdown = document.getElementById('dropdown');
    if (!dropdown) { return; }
    const activeEl = dropdown.querySelector('.dropdown-item-active');
    if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
    }
}

// ── Message handler ───────────────────────────────────────────────────────────

window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'update') {
        allEntries = msg.entries as SearchEntry[];
        // Re-filter if input has text
        const input = document.getElementById('search-input') as HTMLInputElement | null;
        if (input) {
            const query = input.value.trim();
            if (query) {
                filteredEntries = filterEntries(query);
                renderDropdown();
            }
        }
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────

render();
