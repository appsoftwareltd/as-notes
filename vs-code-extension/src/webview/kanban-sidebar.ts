declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = acquireVsCodeApi();

interface LaneSummary { slug: string; display: string; count: number }
interface BoardListItem { slug: string; name: string }
interface SidebarState { boardSlug: string; boardName: string; laneSummary: LaneSummary[]; boardCount: number; boardList: BoardListItem[] }

let state: SidebarState = { boardSlug: '', boardName: '', laneSummary: [], boardCount: 0, boardList: [] };

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; state?: SidebarState };
    if (msg.type === 'stateUpdate' && msg.state) { state = msg.state; render(); }
});

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('focus', handleFocusCapture, true);
    document.addEventListener('blur', handleBlurCapture, true);
    document.addEventListener('keydown', handleKeydown);
    vscode.postMessage({ type: 'ready' });
});

function handleClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.id === 'btn-open-board' || t.closest('#btn-open-board')) { vscode.postMessage({ type: 'openBoard' }); return; }
    if (t.id === 'btn-new-card' || t.closest('#btn-new-card')) { vscode.postMessage({ type: 'newCard' }); return; }
    if (t.id === 'btn-select-board' || t.closest('#btn-select-board') || t.classList.contains('board-name')) { vscode.postMessage({ type: 'selectBoard' }); return; }
    if (t.id === 'btn-create-board' || t.closest('#btn-create-board')) { vscode.postMessage({ type: 'createBoard' }); return; }
    if (t.id === 'btn-delete-board' || t.closest('#btn-delete-board')) { vscode.postMessage({ type: 'deleteBoard' }); return; }
    if (t.id === 'btn-rename-board' || t.closest('#btn-rename-board')) { vscode.postMessage({ type: 'renameBoard' }); return; }
    const acOption = t.closest('.board-ac-option') as HTMLElement | null;
    if (acOption) { selectBoardFromAc(acOption.dataset.slug!); return; }
}

function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.id === 'board-switcher-input') showBoardDropdown((t as HTMLInputElement).value);
}

function handleFocusCapture(e: FocusEvent): void {
    const t = e.target as HTMLElement;
    if (t.id === 'board-switcher-input') showBoardDropdown((t as HTMLInputElement).value);
}

function handleBlurCapture(e: FocusEvent): void {
    const t = e.target as HTMLElement;
    if (t.id === 'board-switcher-input') setTimeout(hideBoardDropdown, 150);
}

let acIndex = -1;

function handleKeydown(e: KeyboardEvent): void {
    const dropdown = document.getElementById('board-ac-dropdown');
    if (!dropdown || dropdown.hasAttribute('hidden')) return;
    const target = e.target as HTMLElement;
    if (target.id !== 'board-switcher-input') return;
    const options = dropdown.querySelectorAll('.board-ac-option');
    if (e.key === 'ArrowDown') { e.preventDefault(); acIndex = Math.min(acIndex + 1, options.length - 1); updateAcActive(options); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); updateAcActive(options); }
    else if (e.key === 'Enter' && acIndex >= 0) { e.preventDefault(); const opt = options[acIndex] as HTMLElement | undefined; if (opt) selectBoardFromAc(opt.dataset.slug!); }
    else if (e.key === 'Escape') hideBoardDropdown();
}

function updateAcActive(options: NodeListOf<Element>): void {
    options.forEach((el, i) => el.classList.toggle('board-ac-option-active', i === acIndex));
}

function showBoardDropdown(filter: string): void {
    const dropdown = document.getElementById('board-ac-dropdown');
    if (!dropdown) return;
    const lc = filter.toLowerCase();
    const items = state.boardList.filter(b => b.slug !== state.boardSlug && (b.name.toLowerCase().includes(lc) || b.slug.toLowerCase().includes(lc)));
    if (items.length === 0) { dropdown.setAttribute('hidden', ''); return; }
    acIndex = -1;
    dropdown.innerHTML = items.map(b => `<div class="board-ac-option" data-slug="${esc(b.slug)}">${esc(b.name)}</div>`).join('');
    dropdown.removeAttribute('hidden');
}

function hideBoardDropdown(): void {
    const dropdown = document.getElementById('board-ac-dropdown');
    if (dropdown) dropdown.setAttribute('hidden', '');
    acIndex = -1;
}

function selectBoardFromAc(slug: string): void {
    hideBoardDropdown();
    const input = document.getElementById('board-switcher-input') as HTMLInputElement | null;
    if (input) input.value = '';
    vscode.postMessage({ type: 'switchBoard', slug });
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    if (!state.boardSlug) {
        const hasBoards = state.boardCount > 0;
        app.innerHTML = `<div class="no-board">No board selected</div>
            <div class="actions no-board-actions">
                ${hasBoards ? '<button id="btn-select-board">Select Board</button>' : ''}
                <button id="btn-create-board">+ New Board</button>
            </div>`;
        return;
    }

    app.innerHTML = `
        <div class="board-header">
            <span class="board-name" title="Click to switch board">${esc(state.boardName || state.boardSlug)}</span>
            <button id="btn-rename-board" class="btn-sm-secondary">Rename</button>
            <button id="btn-delete-board" class="btn-sm-secondary">Delete</button>
        </div>
        ${state.boardList.length > 1 ? `<div class="board-switcher">
            <div class="board-switcher-wrapper">
                <input class="board-switcher-input" id="board-switcher-input" type="text" placeholder="Switch board\u2026" autocomplete="off">
                <div class="board-ac-dropdown" id="board-ac-dropdown" hidden></div>
            </div>
        </div>` : ''}
        <div class="actions">
            <button id="btn-open-board">Open Board</button>
            <button id="btn-new-card">+ New Card</button>
            <button id="btn-create-board" class="btn-sm-secondary">+ New Board</button>
        </div>`;
}
