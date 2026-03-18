import type { Priority } from '../KanbanTypes';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = acquireVsCodeApi();

// ── Types ────────────────────────────────────────────────────────────────────

interface CardEntryDisplay { date?: string; title?: string; body: string }
interface AssetMeta { filename: string; added: string; addedBy?: string }

interface Card {
    id: string; title: string; lane: string; created: string; updated: string;
    description?: string; priority?: Priority; assignee?: string; labels?: string[];
    dueDate?: string; sortOrder?: number; slug: string; waiting?: boolean;
    parsedEntries?: CardEntryDisplay[]; assets?: AssetMeta[];
}

interface BoardConfig {
    name: string; lanes: string[]; users?: string[]; labels?: string[];
}

interface BoardState {
    cards: Card[]; config: BoardConfig; boardSlug: string; assetBaseUri: string;
}

// ── State ────────────────────────────────────────────────────────────────────

let state: BoardState = { cards: [], config: { name: '', lanes: [] }, boardSlug: '', assetBaseUri: '' };
let draggedCardId: string | null = null;
let draggedLaneId: string | null = null;
let isDragging = false;
let pendingState: BoardState | null = null;

let modalCardId: string | null = null;
let modalLabels: string[] = [];
let modalMode: 'create' | 'edit' = 'edit';

interface ModalSnapshot {
    title: string; description: string; lane: string; priority: string;
    assignee: string; dueDate: string; labels: string[]; waiting: boolean;
}
let modalSnapshot: ModalSnapshot | null = null;

// ── Image extensions ─────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif']);
function isImageFile(filename: string): boolean {
    const ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
    return IMAGE_EXTENSIONS.has(ext);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function formatIsoToDate(iso: string): string { return iso.slice(0, 10); }

const ICON_CLOCK = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.5V8l2.5 1.5"/></svg>';
const ICON_ARCHIVE = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12v2H2z"/><path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6"/><path d="M6.5 9h3"/></svg>';
const ICON_CALENDAR = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>';
const ICON_ATTACH = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 7.5l-5.8 5.8a3.2 3.2 0 01-4.5-4.5L9 3a2 2 0 012.8 2.8l-5.5 5.5a.8.8 0 01-1.1-1.1L10.5 5"/></svg>';
const ICON_FILE = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/><path d="M9 1v4h4"/></svg>';
const ICON_ENTRY = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h12v8H5l-3 3V3z"/></svg>';

function isOverdue(isoDate: string): boolean {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(isoDate + 'T00:00:00') < today;
}

function displayLane(slug: string): string {
    return slug.replace(/-/g, ' ').toUpperCase();
}

function isProtectedLane(slug: string): boolean {
    return ['todo', 'done'].includes(slug);
}

const PRIORITY_LABELS: Record<string, string> = {
    p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', none: 'None',
};

// ── Message Handling ─────────────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; state?: BoardState };
    if (msg.type === 'stateUpdate' && msg.state) {
        if (isDragging) { pendingState = msg.state; }
        else { state = msg.state; renderBoard(); }
    }
    if (msg.type === 'openCreateModal') { openCreateModal(); }
});

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    vscode.postMessage({ type: 'ready' });
});

// ── Rendering ────────────────────────────────────────────────────────────────

function renderBoard(): void {
    const app = document.getElementById('app');
    if (!app) return;

    if (!state.boardSlug) {
        app.innerHTML = `
            <div class="uninit-panel">
                <div class="uninit-title">Kanban Board</div>
                <div class="uninit-desc">No board is selected. Create or select a board to get started.</div>
                <button class="uninit-btn" id="btn-select-board">Select Board</button>
            </div>`;
        document.getElementById('btn-select-board')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'selectBoard' });
        });
        return;
    }

    const openModalId = modalCardId;
    const savedLabels = [...modalLabels];
    const savedMode = modalMode;
    const pendingLabelInput = (document.getElementById('modal-label-input') as HTMLInputElement | null)?.value ?? '';
    const savedAssignee = (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '';
    const savedPriority = (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '';
    const savedDueDate = (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '';
    const savedLane = (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '';
    const savedTitleInput = (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '';
    const savedDescription = (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '';
    const savedWaiting = (document.getElementById('modal-waiting') as HTMLInputElement | null)?.checked ?? false;

    app.innerHTML = buildBoardHtml();

    if (openModalId || savedMode === 'create') {
        if (savedMode === 'create') {
            modalMode = 'create';
            modalLabels = savedLabels;
            document.getElementById('modal-backdrop')?.removeAttribute('hidden');
            configureModalMode();
            restoreCreateInputs(savedTitleInput, savedDescription, savedLane, savedPriority, savedAssignee, savedDueDate, pendingLabelInput, savedWaiting);
            renderTags();
        } else if (openModalId) {
            const card = state.cards.find(c => c.id === openModalId);
            if (card) {
                modalCardId = openModalId;
                modalLabels = savedLabels;
                modalMode = 'edit';
                document.getElementById('modal-backdrop')?.removeAttribute('hidden');
                configureModalMode();
                populateModal(card);
                restoreEditInputs(savedAssignee, savedPriority, savedDueDate, savedLane, pendingLabelInput, savedWaiting);
            } else {
                modalCardId = null; modalLabels = [];
            }
        }
    }
}

function restoreCreateInputs(title: string, desc: string, lane: string, priority: string, assignee: string, dueDate: string, labelInput: string, waiting: boolean): void {
    const titleEl = document.getElementById('modal-title-input') as HTMLInputElement | null;
    if (titleEl) titleEl.value = title;
    const descEl = document.getElementById('modal-description') as HTMLTextAreaElement | null;
    if (descEl) descEl.value = desc;
    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl && lane) laneEl.value = lane;
    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl && priority) priorityEl.value = priority;
    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl) assigneeEl.value = assignee;
    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl) dueDateEl.value = dueDate;
    const labelInputEl = document.getElementById('modal-label-input') as HTMLInputElement | null;
    if (labelInputEl && labelInput) labelInputEl.value = labelInput;
    const waitingEl = document.getElementById('modal-waiting') as HTMLInputElement | null;
    if (waitingEl) waitingEl.checked = waiting;
}

function restoreEditInputs(assignee: string, priority: string, dueDate: string, lane: string, labelInput: string, waiting: boolean): void {
    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl && assignee) assigneeEl.value = assignee;
    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl && priority) priorityEl.value = priority;
    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl && dueDate) dueDateEl.value = dueDate;
    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl && lane) laneEl.value = lane;
    const labelInputEl = document.getElementById('modal-label-input') as HTMLInputElement | null;
    if (labelInputEl && labelInput) labelInputEl.value = labelInput;
    const waitingEl = document.getElementById('modal-waiting') as HTMLInputElement | null;
    if (waitingEl) waitingEl.checked = waiting;
}

function buildBoardHtml(): string {
    const { lanes } = state.config;
    return `
        <div class="toolbar">
            <span class="toolbar-board-name">${esc(state.config.name || state.boardSlug)}</span>
            <button id="btn-new-card" class="btn-primary">+ New Card</button>
            <button id="btn-add-lane" class="btn-secondary">+ Add Lane</button>
        </div>
        <div class="board" id="board">
            ${lanes.map(lane => buildLaneHtml(lane, state.cards.filter(c => c.lane === lane))).join('')}
        </div>
        ${buildModalHtml()}
        ${buildDiscardConfirmHtml()}
        ${buildConfirmDialogHtml()}
    `;
}

function buildLaneHtml(lane: string, cards: Card[]): string {
    const prot = isProtectedLane(lane);
    return `
        <div class="lane" data-lane-id="${esc(lane)}">
            <div class="lane-header" draggable="true" data-drag-lane-id="${esc(lane)}">
                <span class="lane-grip" title="Drag to reorder">&#x2630;</span>
                <span class="lane-title${prot ? '' : ' lane-title-renameable'}"
                      ${prot ? '' : `data-rename-lane-id="${esc(lane)}"`}>${esc(displayLane(lane))}</span>
                <span class="lane-count">${cards.length}</span>
                ${prot ? '' : `<button class="icon-btn lane-remove" data-remove-lane-id="${esc(lane)}" title="Remove lane">&times;</button>`}
            </div>
            <div class="lane-cards" data-lane-id="${esc(lane)}">
                ${cards.map(buildCardHtml).join('')}
            </div>
        </div>`;
}

function buildCardHtml(card: Card): string {
    const p = card.priority && card.priority !== 'none' ? card.priority : null;
    const priorityBadge = p
        ? `<span class="priority-badge priority-${esc(p)}">${esc(PRIORITY_LABELS[p] ?? p)}</span>`
        : '<span class="priority-badge priority-none">No Priority</span>';
    const waitingBadge = card.waiting ? '<span class="waiting-badge">Waiting</span>' : '';
    const hasMeta = card.assignee || card.dueDate || (card.labels && card.labels.length > 0);
    const assetCount = card.assets?.length ?? 0;
    const entryCount = card.parsedEntries?.length ?? 0;

    return `
        <div class="card" draggable="true" data-card-id="${esc(card.id)}">
            <div class="card-header">
                ${priorityBadge}
                ${waitingBadge}
                <button class="icon-btn card-delete" data-delete-card-id="${esc(card.id)}" title="Delete card">&times;</button>
            </div>
            <div class="card-title">${esc(card.title)}</div>
            ${hasMeta ? `<div class="card-meta">
                <div class="card-meta-row">
                    ${card.assignee ? `<span class="assignee-badge" title="${esc(card.assignee)}">${esc(getInitials(card.assignee))}</span>` : ''}
                    ${card.dueDate ? `<span class="due-chip${isOverdue(card.dueDate) ? ' due-overdue' : ''}">${ICON_CLOCK} ${esc(card.dueDate)}</span>` : ''}
                </div>
                ${(card.labels?.length ?? 0) > 0 ? `<div class="card-labels">${(card.labels ?? []).map(l => `<span class="label-pill">${esc(l)}</span>`).join('')}</div>` : ''}
            </div>` : ''}
            <div class="card-footer">
                <div class="card-date">${formatIsoToDate(card.updated)}</div>
                <div class="card-footer-actions">
                    ${entryCount > 0 ? `<span class="card-badge" title="${entryCount} entries">${ICON_ENTRY}${entryCount}</span>` : ''}
                    ${assetCount > 0 ? `<span class="card-badge" title="${assetCount} assets">${ICON_ATTACH}${assetCount}</span>` : ''}
                    <button class="icon-btn card-archive" data-archive-card-id="${esc(card.id)}" title="Archive card">${ICON_ARCHIVE}</button>
                </div>
            </div>
        </div>`;
}

function buildModalHtml(): string {
    const laneOptions = state.config.lanes
        .map(l => `<option value="${esc(l)}">${esc(displayLane(l))}</option>`).join('');
    return `
        <div class="modal-backdrop" id="modal-backdrop" hidden>
            <div class="modal" id="modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-card-title"></h3>
                    <input class="form-control modal-title-input" id="modal-title-input" type="text" placeholder="Card title" hidden>
                    <button class="icon-btn" id="modal-close" title="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row" id="modal-description-row" hidden>
                        <label class="form-label" for="modal-description">Description</label>
                        <textarea class="form-control" id="modal-description" rows="3" placeholder="Describe the card…"></textarea>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-lane">Lane</label>
                        <select class="form-control" id="modal-lane">${laneOptions}</select>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-priority">Priority</label>
                        <select class="form-control" id="modal-priority">
                            <option value="none">None</option>
                            <option value="p1">P1</option>
                            <option value="p2">P2</option>
                            <option value="p3">P3</option>
                            <option value="p4">P4</option>
                            <option value="p5">P5</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-assignee">Assignee</label>
                        <div class="autocomplete-wrapper" id="assignee-ac-wrapper">
                            <input class="form-control" id="modal-assignee" type="text" placeholder="Unassigned" autocomplete="off">
                            <div class="autocomplete-dropdown" id="assignee-ac-dropdown" hidden></div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Labels</label>
                        <div class="tag-field">
                            <div class="tags-row" id="tags-row"></div>
                            <div class="tag-add-row">
                                <div class="autocomplete-wrapper" id="label-ac-wrapper">
                                    <input class="form-control tag-add-input" id="modal-label-input" type="text" placeholder="Add label\u2026" autocomplete="off">
                                    <div class="autocomplete-dropdown" id="label-ac-dropdown" hidden></div>
                                </div>
                                <button class="btn-tag-add" id="btn-add-label-tag" type="button">Add</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Due Date</label>
                        <div class="datepicker-wrapper" id="datepicker-wrapper">
                            <div class="datepicker-input-row">
                                <input class="form-control" id="modal-duedate" type="text" placeholder="YYYY-MM-DD">
                                <button class="icon-btn datepicker-toggle" id="datepicker-toggle" type="button" title="Pick date">${ICON_CALENDAR}</button>
                                <button class="icon-btn datepicker-clear" id="datepicker-clear" type="button" title="Clear date">&times;</button>
                            </div>
                            <div class="datepicker-help" id="datepicker-help" hidden></div>
                        </div>
                    </div>

                    <div class="form-row form-row-check">
                        <label class="form-check-label" for="modal-waiting">Waiting</label>
                        <input class="form-check" id="modal-waiting" type="checkbox">
                    </div>

                    <!-- Entries section (edit mode only, read-only) -->
                    <div class="form-row" id="modal-entries-section" hidden>
                        <label class="form-label">Entries</label>
                        <div class="entries-list" id="entries-list"></div>
                        <div class="entries-edit-hint">Open the card file to add or edit entries.</div>
                    </div>

                    <!-- Assets section (edit mode only) -->
                    <div class="form-row" id="modal-assets-section" hidden>
                        <label class="form-label">Assets</label>
                        <div class="assets-grid" id="assets-grid"></div>
                        <button class="btn-secondary btn-sm" id="btn-add-asset" type="button">${ICON_ATTACH} Add File</button>
                    </div>
                </div>
                <div class="datepicker-overlay" id="datepicker-overlay" hidden>
                    <div class="datepicker-overlay-backdrop" id="datepicker-overlay-backdrop"></div>
                    <div class="datepicker-popup" id="datepicker-popup"></div>
                </div>
                <div class="modal-footer">
                    <div class="modal-footer-left" id="modal-footer-left">
                        <button class="btn-primary" id="btn-open-card-file">${ICON_FILE} Open File</button>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" id="modal-cancel">Cancel</button>
                        <button class="btn-primary" id="modal-save">Save</button>
                    </div>
                </div>
            </div>
        </div>`;
}

// ── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners(): void {
    document.addEventListener('click', handleClick);
    document.addEventListener('dblclick', handleDblClick);
    document.addEventListener('dragstart', handleDragStart as EventListener);
    document.addEventListener('dragend', handleDragEnd as EventListener);
    document.addEventListener('dragover', handleDragOver as EventListener);
    document.addEventListener('dragleave', handleDragLeave as EventListener);
    document.addEventListener('drop', handleDrop as EventListener);
    document.addEventListener('keydown', handleKeydown as EventListener);
    document.addEventListener('focusout', (e: FocusEvent) => {
        if ((e.target as HTMLElement)?.id === 'modal-duedate') validateDateInput();
    });
    document.addEventListener('input', (e: Event) => {
        if ((e.target as HTMLElement)?.id === 'modal-duedate') clearDateError();
    });
}

function handleClick(e: MouseEvent): void {
    const t = e.target as Element;

    if ((t as HTMLElement).id === 'btn-new-card') { openCreateModal(); return; }
    if ((t as HTMLElement).id === 'btn-add-lane') { vscode.postMessage({ type: 'addLane' }); return; }
    if ((t as HTMLElement).id === 'btn-select-board') { vscode.postMessage({ type: 'selectBoard' }); return; }
    if ((t as HTMLElement).id === 'modal-close') { tryCloseModal(); return; }
    if ((t as HTMLElement).id === 'modal-cancel') { closeModal(); return; }
    if ((t as HTMLElement).id === 'modal-discard-keep') { hideDiscardConfirm(); return; }
    if ((t as HTMLElement).id === 'modal-discard-confirm') { hideDiscardConfirm(); closeModal(); return; }
    if ((t as HTMLElement).id === 'modal-save') { saveModal(); return; }
    if ((t as HTMLElement).id === 'btn-open-card-file') {
        if (modalCardId) { vscode.postMessage({ type: 'openCardFile', cardId: modalCardId }); closeModal(); }
        return;
    }
    if ((t as HTMLElement).id === 'btn-add-label-tag') { addLabelTag(); return; }
    if ((t as HTMLElement).id === 'btn-add-asset') {
        if (modalCardId) { vscode.postMessage({ type: 'addAsset', cardId: modalCardId }); }
        return;
    }

    if (t.closest('#datepicker-toggle')) { toggleDatepicker(); return; }
    if (t.closest('#datepicker-clear')) { clearDatepicker(); return; }
    if ((t as HTMLElement).id === 'datepicker-overlay-backdrop') {
        document.getElementById('datepicker-overlay')?.setAttribute('hidden', ''); return;
    }
    if (t.closest('#dp-prev')) { dpNavigate(-1); return; }
    if (t.closest('#dp-next')) { dpNavigate(1); return; }
    const dayBtn = t.closest('[data-dp-day]') as HTMLElement | null;
    if (dayBtn) { dpSelectDay(dayBtn.dataset.dpDay!); return; }
    if ((t as HTMLElement).id === 'confirm-cancel') { hideArchiveConfirm(); return; }
    if ((t as HTMLElement).id === 'confirm-archive') { confirmArchive(); return; }
    if ((t as HTMLElement).id === 'confirm-backdrop') { hideArchiveConfirm(); return; }

    const archiveBtn = t.closest('[data-archive-card-id]') as HTMLElement | null;
    if (archiveBtn) { e.stopPropagation(); showArchiveConfirm(archiveBtn.dataset.archiveCardId!); return; }

    const deleteBtn = t.closest('[data-delete-card-id]') as HTMLElement | null;
    if (deleteBtn) { e.stopPropagation(); vscode.postMessage({ type: 'deleteCard', cardId: deleteBtn.dataset.deleteCardId }); return; }

    const removeBtn = t.closest('[data-remove-lane-id]') as HTMLElement | null;
    if (removeBtn) { e.stopPropagation(); vscode.postMessage({ type: 'removeLane', laneId: removeBtn.dataset.removeLaneId }); return; }

    const tagRemoveBtn = t.closest('[data-remove-tag]') as HTMLElement | null;
    if (tagRemoveBtn) { removeTag(tagRemoveBtn.getAttribute('data-remove-tag')!); return; }

    const removeAssetBtn = t.closest('[data-remove-asset]') as HTMLElement | null;
    if (removeAssetBtn) {
        if (modalCardId) {
            vscode.postMessage({ type: 'removeAsset', cardId: modalCardId, filename: removeAssetBtn.dataset.removeAsset });
        }
        return;
    }

    const openAssetBtn = t.closest('[data-open-asset]') as HTMLElement | null;
    if (openAssetBtn) {
        if (modalCardId) {
            vscode.postMessage({ type: 'openAsset', cardId: modalCardId, filename: openAssetBtn.dataset.openAsset });
        }
        return;
    }

    // Lightbox close
    if ((t as HTMLElement).classList.contains('lightbox-backdrop')) {
        t.remove(); return;
    }

    // Lightbox open — click on asset thumbnail
    const thumb = t.closest('.asset-thumb') as HTMLElement | null;
    if (thumb) { openLightbox(thumb.dataset.assetSrc!); return; }

    const card = t.closest('.card[data-card-id]') as HTMLElement | null;
    if (card && !t.closest('[data-delete-card-id]') && !t.closest('[data-archive-card-id]')) {
        openModal(card.dataset.cardId!); return;
    }
}

function handleDblClick(e: MouseEvent): void {
    const renameEl = (e.target as Element).closest('[data-rename-lane-id]') as HTMLElement | null;
    if (renameEl) { vscode.postMessage({ type: 'renameLane', laneId: renameEl.dataset.renameLaneId }); }
}

function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('datepicker-overlay');
        if (overlay && !overlay.hasAttribute('hidden')) { overlay.setAttribute('hidden', ''); return; }
        const lightbox = document.querySelector('.lightbox-backdrop');
        if (lightbox) { lightbox.remove(); return; }
        if (confirmCardId) { hideArchiveConfirm(); } else { closeModal(); }
        return;
    }
    if (e.key === 'Enter' && (e.target as Element).id === 'modal-label-input') { e.preventDefault(); addLabelTag(); return; }
    if (e.key === 'Enter' && (e.target as Element).id === 'modal-duedate') { e.preventDefault(); if (validateDateInput()) document.getElementById('datepicker-overlay')?.setAttribute('hidden', ''); return; }
}

// ── Drag and Drop ────────────────────────────────────────────────────────────

function handleDragStart(e: DragEvent): void {
    const t = e.target as Element;
    const laneHeader = t.closest('[data-drag-lane-id]') as HTMLElement | null;
    if (laneHeader) {
        draggedLaneId = laneHeader.dataset.dragLaneId!;
        e.dataTransfer!.effectAllowed = 'move';
        laneHeader.closest('.lane')?.classList.add('lane-dragging');
        isDragging = true;
        return;
    }
    const card = t.closest('.card[data-card-id]') as HTMLElement | null;
    if (card) {
        draggedCardId = card.dataset.cardId!;
        card.classList.add('card-dragging');
        e.dataTransfer!.effectAllowed = 'move';
        isDragging = true;
    }
}

function handleDragEnd(e: DragEvent): void {
    document.querySelectorAll('.lane').forEach(el => el.classList.remove('lane-dragging', 'lane-drag-over'));
    document.querySelectorAll('.lane-cards').forEach(el => el.classList.remove('cards-drag-over'));
    document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
    (e.target as Element).closest('.card')?.classList.remove('card-dragging');
    draggedCardId = null; draggedLaneId = null; isDragging = false;
    if (pendingState) { state = pendingState; pendingState = null; renderBoard(); }
}

function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    const t = e.target as Element;
    if (draggedLaneId) {
        const lane = t.closest('.lane') as HTMLElement | null;
        if (lane && lane.dataset.laneId !== draggedLaneId) {
            document.querySelectorAll('.lane').forEach(el => el.classList.remove('lane-drag-over'));
            lane.classList.add('lane-drag-over');
        }
        return;
    }
    if (!draggedCardId) return;
    const laneCards = t.closest('.lane-cards') as HTMLElement | null;
    if (!laneCards) return;
    laneCards.classList.add('cards-drag-over');
    document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
    const cards = Array.from(laneCards.querySelectorAll('.card[data-card-id]')) as HTMLElement[];
    const hoveredCard = t.closest('.card[data-card-id]') as HTMLElement | null;
    if (hoveredCard && hoveredCard.dataset.cardId !== draggedCardId) {
        const rect = hoveredCard.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const indicator = document.createElement('div');
        indicator.className = 'card-drop-indicator';
        if (e.clientY < midY) hoveredCard.parentNode!.insertBefore(indicator, hoveredCard);
        else hoveredCard.parentNode!.insertBefore(indicator, hoveredCard.nextSibling);
    } else if (!hoveredCard && cards.length === 0) {
        const indicator = document.createElement('div');
        indicator.className = 'card-drop-indicator';
        laneCards.appendChild(indicator);
    }
}

function handleDragLeave(e: DragEvent): void {
    const t = e.target as Element;
    const related = e.relatedTarget as Element | null;
    if (draggedLaneId) {
        const lane = t.closest('.lane');
        if (lane && !lane.contains(related)) lane.classList.remove('lane-drag-over');
        return;
    }
    const cards = t.closest('.lane-cards');
    if (cards && !cards.contains(related)) {
        cards.classList.remove('cards-drag-over');
        cards.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
    }
}

function getCardSortOrder(cardId: string): number {
    const card = state.cards.find(c => c.id === cardId);
    return card ? (card.sortOrder ?? Date.parse(card.created)) : 0;
}

function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const t = e.target as Element;
    document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());

    if (draggedLaneId) {
        const targetLane = t.closest('.lane') as HTMLElement | null;
        if (targetLane && targetLane.dataset.laneId !== draggedLaneId) {
            vscode.postMessage({ type: 'moveLane', sourceLaneId: draggedLaneId, targetLaneId: targetLane.dataset.laneId });
        }
        document.querySelectorAll('.lane').forEach(el => el.classList.remove('lane-dragging', 'lane-drag-over'));
        draggedLaneId = null;
        return;
    }

    const laneCards = t.closest('.lane-cards') as HTMLElement | null;
    if (!laneCards || !draggedCardId) {
        document.querySelectorAll('.lane-cards').forEach(el => el.classList.remove('cards-drag-over'));
        return;
    }

    const targetLaneId = laneCards.dataset.laneId!;
    const cards = Array.from(laneCards.querySelectorAll('.card[data-card-id]')) as HTMLElement[];
    const cardIds = cards.map(c => c.dataset.cardId!).filter(id => id !== draggedCardId);
    const hoveredCard = t.closest('.card[data-card-id]') as HTMLElement | null;
    let insertIndex = cardIds.length;
    if (hoveredCard && hoveredCard.dataset.cardId !== draggedCardId) {
        const idx = cardIds.indexOf(hoveredCard.dataset.cardId!);
        if (idx !== -1) {
            const rect = hoveredCard.getBoundingClientRect();
            insertIndex = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
        }
    }

    let newSortOrder: number;
    if (cardIds.length === 0) newSortOrder = 1;
    else if (insertIndex === 0) newSortOrder = getCardSortOrder(cardIds[0]) - 1;
    else if (insertIndex >= cardIds.length) newSortOrder = getCardSortOrder(cardIds[cardIds.length - 1]) + 1;
    else newSortOrder = (getCardSortOrder(cardIds[insertIndex - 1]) + getCardSortOrder(cardIds[insertIndex])) / 2;

    vscode.postMessage({ type: 'moveCard', cardId: draggedCardId, lane: targetLaneId, sortOrder: newSortOrder });
    document.querySelectorAll('.lane-cards').forEach(el => el.classList.remove('cards-drag-over'));
}

// ── Modal ────────────────────────────────────────────────────────────────────

function openModal(cardId: string): void {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    modalMode = 'edit'; modalCardId = cardId; modalLabels = [...(card.labels ?? [])];
    document.getElementById('modal-backdrop')?.removeAttribute('hidden');
    configureModalMode();
    populateModal(card);
    captureModalSnapshot();
}

function openCreateModal(): void {
    modalMode = 'create'; modalCardId = null; modalLabels = [];
    document.getElementById('modal-backdrop')?.removeAttribute('hidden');
    configureModalMode();
    const titleInput = document.getElementById('modal-title-input') as HTMLInputElement | null;
    if (titleInput) titleInput.value = '';
    const descEl = document.getElementById('modal-description') as HTMLTextAreaElement | null;
    if (descEl) descEl.value = '';
    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl && state.config.lanes.length > 0) laneEl.value = state.config.lanes[0];
    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl) priorityEl.value = 'none';
    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl) assigneeEl.value = '';
    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl) dueDateEl.value = '';
    const waitingEl = document.getElementById('modal-waiting') as HTMLInputElement | null;
    if (waitingEl) waitingEl.checked = false;
    initAutocomplete('modal-assignee', 'assignee-ac-dropdown', () => state.config.users ?? [], 'select');
    initAutocomplete('modal-label-input', 'label-ac-dropdown', () => state.config.labels ?? [], 'add-tag');
    renderTags();
    captureModalSnapshot();
    titleInput?.focus();
}

function configureModalMode(): void {
    const titleH3 = document.getElementById('modal-card-title');
    const titleInput = document.getElementById('modal-title-input');
    const descRow = document.getElementById('modal-description-row');
    const footerLeft = document.getElementById('modal-footer-left');
    const saveBtn = document.getElementById('modal-save');
    const entriesSection = document.getElementById('modal-entries-section');
    const assetsSection = document.getElementById('modal-assets-section');

    if (modalMode === 'create') {
        titleH3?.setAttribute('hidden', '');
        titleInput?.removeAttribute('hidden');
        descRow?.removeAttribute('hidden');
        if (footerLeft) footerLeft.style.visibility = 'hidden';
        if (saveBtn) saveBtn.textContent = 'Create';
        entriesSection?.setAttribute('hidden', '');
        assetsSection?.setAttribute('hidden', '');
    } else {
        titleH3?.removeAttribute('hidden');
        titleInput?.setAttribute('hidden', '');
        descRow?.removeAttribute('hidden');
        if (footerLeft) footerLeft.style.visibility = 'visible';
        if (saveBtn) saveBtn.textContent = 'Save';
        entriesSection?.removeAttribute('hidden');
        assetsSection?.removeAttribute('hidden');
    }
}

function populateModal(card: Card): void {
    const titleEl = document.getElementById('modal-card-title');
    if (titleEl) titleEl.textContent = card.title;
    const descEl = document.getElementById('modal-description') as HTMLTextAreaElement | null;
    if (descEl) descEl.value = card.description ?? '';
    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl) laneEl.value = card.lane;
    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl) priorityEl.value = card.priority ?? 'none';
    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl) assigneeEl.value = card.assignee ?? '';
    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl) dueDateEl.value = card.dueDate ?? '';
    const waitingEl = document.getElementById('modal-waiting') as HTMLInputElement | null;
    if (waitingEl) waitingEl.checked = card.waiting ?? false;
    initAutocomplete('modal-assignee', 'assignee-ac-dropdown', () => state.config.users ?? [], 'select');
    initAutocomplete('modal-label-input', 'label-ac-dropdown', () => state.config.labels ?? [], 'add-tag');
    renderTags();
    renderEntries(card);
    renderAssets(card);
}

function closeModal(): void {
    document.getElementById('modal-backdrop')?.setAttribute('hidden', '');
    hideDiscardConfirm();
    modalCardId = null; modalLabels = []; modalMode = 'edit'; modalSnapshot = null;
}

function captureModalSnapshot(): void {
    modalSnapshot = {
        title: (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '',
        description: (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '',
        lane: (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '',
        priority: (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '',
        assignee: (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '',
        dueDate: (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '',
        labels: [...modalLabels],
        waiting: (document.getElementById('modal-waiting') as HTMLInputElement | null)?.checked ?? false,
    };
}

function isModalDirty(): boolean {
    if (!modalSnapshot) return false;
    const lane = (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '';
    const priority = (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '';
    const assignee = (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '';
    const dueDate = (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '';
    const title = (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '';
    const description = (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '';
    const waiting = (document.getElementById('modal-waiting') as HTMLInputElement | null)?.checked ?? false;
    return title !== modalSnapshot.title || description !== modalSnapshot.description ||
        lane !== modalSnapshot.lane || priority !== modalSnapshot.priority ||
        assignee !== modalSnapshot.assignee || dueDate !== modalSnapshot.dueDate ||
        waiting !== (modalSnapshot.waiting ?? false) ||
        JSON.stringify([...modalLabels].sort()) !== JSON.stringify([...modalSnapshot.labels].sort());
}

function tryCloseModal(): void { isModalDirty() ? showDiscardConfirm() : closeModal(); }
function showDiscardConfirm(): void { document.getElementById('modal-discard-backdrop')?.removeAttribute('hidden'); }
function hideDiscardConfirm(): void { document.getElementById('modal-discard-backdrop')?.setAttribute('hidden', ''); }

function saveModal(): void {
    const priority = (document.getElementById('modal-priority') as HTMLSelectElement).value as Priority;
    const assigneeRaw = ((document.getElementById('modal-assignee') as HTMLInputElement).value ?? '').trim();
    const dueDateRaw = ((document.getElementById('modal-duedate') as HTMLInputElement).value ?? '').trim();
    if (dueDateRaw && !isValidDate(dueDateRaw)) { showDateError('Please enter a valid date in YYYY-MM-DD format'); return; }
    clearDateError();
    const dueDate = dueDateRaw || undefined;
    const assignee = assigneeRaw || undefined;
    const labels = modalLabels.length > 0 ? [...modalLabels] : undefined;
    const lane = (document.getElementById('modal-lane') as HTMLSelectElement).value;

    const waiting = (document.getElementById('modal-waiting') as HTMLInputElement | null)?.checked || undefined;
    if (modalMode === 'create') {
        const titleRaw = ((document.getElementById('modal-title-input') as HTMLInputElement).value ?? '').trim();
        if (!titleRaw) { (document.getElementById('modal-title-input') as HTMLInputElement)?.focus(); return; }
        const description = ((document.getElementById('modal-description') as HTMLTextAreaElement).value ?? '').trim();
        vscode.postMessage({
            type: 'createCard', title: titleRaw, description, lane,
            priority: priority === 'none' ? undefined : priority, assignee, labels, dueDate, waiting,
        });
    } else {
        if (!modalCardId) return;
        const description = ((document.getElementById('modal-description') as HTMLTextAreaElement).value ?? '').trim();
        vscode.postMessage({
            type: 'updateCardMeta', cardId: modalCardId, lane, description,
            priority: priority === 'none' ? undefined : priority, assignee, labels, dueDate, waiting,
        });
    }

    if (assignee && !(state.config.users ?? []).includes(assignee)) vscode.postMessage({ type: 'addUser', name: assignee });
    for (const label of modalLabels) {
        if (!(state.config.labels ?? []).includes(label)) vscode.postMessage({ type: 'addLabel', name: label });
    }
    closeModal();
}

// ── Entries (read-only) ─────────────────────────────────────────────────────

function renderEntries(card: Card): void {
    const list = document.getElementById('entries-list');
    if (!list) return;
    const entries = card.parsedEntries ?? [];
    if (entries.length === 0) { list.innerHTML = '<div class="entries-empty">No entries yet. Open the card file and use <code>/Entry Date</code> to add one.</div>'; return; }
    list.innerHTML = entries.map(e => `
        <div class="entry-item">
            <div class="entry-header">
                ${e.date ? `<span class="entry-date">${esc(e.date)}</span>` : ''}
                ${e.title ? `<span class="entry-title">${esc(e.title)}</span>` : ''}
            </div>
            <div class="entry-text">${esc(e.body)}</div>
        </div>`).join('');
}

// ── Assets ───────────────────────────────────────────────────────────────────

function renderAssets(card: Card): void {
    const grid = document.getElementById('assets-grid');
    if (!grid) return;
    const assets = card.assets ?? [];
    if (assets.length === 0) { grid.innerHTML = '<div class="assets-empty">No assets attached.</div>'; return; }
    grid.innerHTML = assets.map(a => {
        const src = `${state.assetBaseUri}/${encodeURIComponent(card.id)}/${encodeURIComponent(a.filename)}`;
        if (isImageFile(a.filename)) {
            return `<div class="asset-item">
                <img class="asset-thumb" src="${esc(src)}" data-asset-src="${esc(src)}" alt="${esc(a.filename)}" title="${esc(a.filename)}">
                <div class="asset-actions">
                    <button class="icon-btn" data-open-asset="${esc(a.filename)}" title="Open">${ICON_FILE}</button>
                    <button class="icon-btn" data-remove-asset="${esc(a.filename)}" title="Remove">&times;</button>
                </div>
            </div>`;
        }
        return `<div class="asset-item asset-file">
            <div class="asset-file-icon">${ICON_FILE}</div>
            <span class="asset-filename" title="${esc(a.filename)}">${esc(a.filename)}</span>
            <div class="asset-actions">
                <button class="icon-btn" data-open-asset="${esc(a.filename)}" title="Open">${ICON_FILE}</button>
                <button class="icon-btn" data-remove-asset="${esc(a.filename)}" title="Remove">&times;</button>
            </div>
        </div>`;
    }).join('');
}

function openLightbox(src: string): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'lightbox-backdrop';
    backdrop.innerHTML = `<img class="lightbox-img" src="${esc(src)}">`;
    document.body.appendChild(backdrop);
}



// ── Labels ───────────────────────────────────────────────────────────────────

function addLabelTag(): void {
    const input = document.getElementById('modal-label-input') as HTMLInputElement | null;
    if (!input) return;
    const value = sanitiseLabel(input.value);
    if (value && !modalLabels.includes(value)) { modalLabels.push(value); renderTags(); }
    input.value = ''; input.focus();
}

function sanitiseLabel(raw: string): string {
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function removeTag(label: string): void { modalLabels = modalLabels.filter(l => l !== label); renderTags(); }

function renderTags(): void {
    const row = document.getElementById('tags-row');
    if (!row) return;
    row.innerHTML = modalLabels.map(l =>
        `<span class="tag-chip">${esc(l)}<button class="tag-remove" data-remove-tag="${esc(l)}" type="button">&times;</button></span>`
    ).join('');
}

// ── Discard / Confirm Dialogs ────────────────────────────────────────────────

function buildDiscardConfirmHtml(): string {
    return `<div class="confirm-backdrop" id="modal-discard-backdrop" hidden>
        <div class="confirm-dialog">
            <p class="confirm-message">You have unsaved changes. Discard them?</p>
            <div class="confirm-actions">
                <button class="btn-secondary" id="modal-discard-keep">Keep editing</button>
                <button class="btn-primary" id="modal-discard-confirm">Discard</button>
            </div>
        </div>
    </div>`;
}

let confirmCardId: string | null = null;

function buildConfirmDialogHtml(): string {
    return `<div class="confirm-backdrop" id="confirm-backdrop" hidden>
        <div class="confirm-dialog">
            <p class="confirm-message">Archive this card? It will be hidden from all lanes.</p>
            <div class="confirm-actions">
                <button class="btn-secondary" id="confirm-cancel">Cancel</button>
                <button class="btn-primary confirm-archive-btn" id="confirm-archive">Archive</button>
            </div>
        </div>
    </div>`;
}

function showArchiveConfirm(cardId: string): void { confirmCardId = cardId; document.getElementById('confirm-backdrop')?.removeAttribute('hidden'); }
function hideArchiveConfirm(): void { confirmCardId = null; document.getElementById('confirm-backdrop')?.setAttribute('hidden', ''); }
function confirmArchive(): void { if (confirmCardId) vscode.postMessage({ type: 'archiveCard', cardId: confirmCardId }); hideArchiveConfirm(); }

// ── Autocomplete ─────────────────────────────────────────────────────────────

type AutocompleteMode = 'select' | 'add-tag';
const acCleanups: Array<() => void> = [];

function initAutocomplete(inputId: string, dropdownId: string, getItems: () => string[], mode: AutocompleteMode): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const dropdown = document.getElementById(dropdownId) as HTMLElement | null;
    if (!input || !dropdown) return;
    let acIndex = -1;

    function showDropdown(filter: string): void {
        const items = getItems().filter(item => item.toLowerCase().includes(filter.toLowerCase()));
        if (items.length === 0 || (items.length === 1 && items[0].toLowerCase() === filter.toLowerCase())) { dropdown!.setAttribute('hidden', ''); return; }
        acIndex = -1;
        dropdown!.innerHTML = items.map((item, i) =>
            `<div class="autocomplete-option" data-ac-index="${i}" data-ac-value="${esc(item)}">${esc(item)}</div>`
        ).join('');
        dropdown!.removeAttribute('hidden');
    }

    function hideDropdown(): void { dropdown!.setAttribute('hidden', ''); acIndex = -1; }

    function selectItem(value: string): void {
        if (mode === 'select') { input!.value = value; hideDropdown(); }
        else { input!.value = ''; hideDropdown(); const s = sanitiseLabel(value); if (s && !modalLabels.includes(s)) { modalLabels.push(s); renderTags(); } }
    }

    function handleInput(): void { showDropdown(input!.value); }
    function handleFocus(): void { if (input!.value || getItems().length > 0) showDropdown(input!.value); }
    function handleKeydown(e: KeyboardEvent): void {
        if (dropdown!.hasAttribute('hidden')) return;
        const options = dropdown!.querySelectorAll('.autocomplete-option');
        if (e.key === 'ArrowDown') { e.preventDefault(); acIndex = Math.min(acIndex + 1, options.length - 1); updateActive(options); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); updateActive(options); }
        else if (e.key === 'Enter' && acIndex >= 0) { e.preventDefault(); e.stopPropagation(); const opt = options[acIndex] as HTMLElement | undefined; if (opt) selectItem(opt.dataset.acValue!); }
        else if (e.key === 'Escape') hideDropdown();
    }
    function updateActive(options: NodeListOf<Element>): void { options.forEach((el, i) => el.classList.toggle('autocomplete-option-active', i === acIndex)); }
    function handleDropdownClick(e: MouseEvent): void { const opt = (e.target as Element).closest('.autocomplete-option') as HTMLElement | null; if (opt) selectItem(opt.dataset.acValue!); }
    function handleBlur(): void { setTimeout(() => hideDropdown(), 150); }

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
    dropdown.addEventListener('mousedown', handleDropdownClick);
    acCleanups.push(() => { input.removeEventListener('input', handleInput); input.removeEventListener('focus', handleFocus); input.removeEventListener('blur', handleBlur); input.removeEventListener('keydown', handleKeydown); dropdown.removeEventListener('mousedown', handleDropdownClick); });
}

// ── Datepicker ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(v: string): boolean {
    if (!DATE_RE.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function showDateError(msg: string): void {
    const input = document.getElementById('modal-duedate');
    const help = document.getElementById('datepicker-help');
    input?.classList.add('datepicker-error');
    if (help) { help.textContent = msg; help.removeAttribute('hidden'); }
}

function clearDateError(): void {
    const input = document.getElementById('modal-duedate');
    const help = document.getElementById('datepicker-help');
    input?.classList.remove('datepicker-error');
    if (help) { help.textContent = ''; help.setAttribute('hidden', ''); }
}

function validateDateInput(): boolean {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (!input) return true;
    const v = input.value.trim();
    if (!v) { clearDateError(); return true; }
    if (!isValidDate(v)) { showDateError('Please enter a valid date in YYYY-MM-DD format'); return false; }
    clearDateError(); return true;
}

let dpViewYear = new Date().getFullYear();
let dpViewMonth = new Date().getMonth();

function toggleDatepicker(): void {
    const overlay = document.getElementById('datepicker-overlay');
    if (!overlay) return;
    if (overlay.hasAttribute('hidden')) {
        const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
        if (input?.value && isValidDate(input.value)) { const d = new Date(input.value + 'T00:00:00'); dpViewYear = d.getFullYear(); dpViewMonth = d.getMonth(); }
        else { const now = new Date(); dpViewYear = now.getFullYear(); dpViewMonth = now.getMonth(); }
        renderCalendar(); overlay.removeAttribute('hidden');
    } else overlay.setAttribute('hidden', '');
}

function clearDatepicker(): void {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (input) input.value = '';
    clearDateError();
    document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
}

function dpNavigate(delta: number): void {
    dpViewMonth += delta;
    if (dpViewMonth < 0) { dpViewMonth = 11; dpViewYear--; }
    else if (dpViewMonth > 11) { dpViewMonth = 0; dpViewYear++; }
    renderCalendar();
}

function dpSelectDay(dateStr: string): void {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (input) input.value = dateStr;
    clearDateError();
    document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
}

function renderCalendar(): void {
    const popup = document.getElementById('datepicker-popup');
    if (!popup) return;
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    const selectedDate = input?.value ?? '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const firstDay = new Date(dpViewYear, dpViewMonth, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(dpViewYear, dpViewMonth + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="dp-cell dp-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${dpViewYear}-${String(dpViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let cls = 'dp-cell dp-day';
        if (ds === selectedDate) cls += ' dp-selected';
        if (ds === todayStr) cls += ' dp-today';
        cells += `<div class="${cls}" data-dp-day="${ds}">${d}</div>`;
    }

    popup.innerHTML = `
        <div class="dp-header">
            <button class="icon-btn dp-nav" id="dp-prev" type="button">&lsaquo;</button>
            <span class="dp-month-label">${monthNames[dpViewMonth]} ${dpViewYear}</span>
            <button class="icon-btn dp-nav" id="dp-next" type="button">&rsaquo;</button>
        </div>
        <div class="dp-weekdays"><div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div></div>
        <div class="dp-grid">${cells}</div>`;
}
