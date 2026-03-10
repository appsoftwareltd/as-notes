// ── Types ─────────────────────────────────────────────────────────────────────

type GroupBy = 'page' | 'priority' | 'dueDate';

interface TaskViewItem {
    id: number;
    source_page_id: number;
    pagePath: string;
    pageTitle: string;
    line: number;
    text: string;
    done: boolean;
    priority: number | null;
    waiting: boolean;
    dueDate: string | null;
}

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────────

let allTasks: TaskViewItem[] = [];
let groupBy: GroupBy = 'page';
let showTodoOnly = true;
let waitingOnly = false;
let pageFilter = '';

// Tasks that have just been toggled: keep them visible for 1 s while the
// extension round-trip completes (so they don't vanish immediately).
const pendingToggle = new Set<string>(); // "pagePath:line"
const pendingToggleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET_ORDER = ['overdue', 'today', 'this-week', 'later', 'no-date'] as const;
type DueBucket = typeof BUCKET_ORDER[number];

const BUCKET_LABELS: Record<DueBucket, string> = {
    overdue: 'Overdue',
    today: 'Today',
    'this-week': 'This Week',
    later: 'Later',
    'no-date': 'No Due Date',
};

const PRIORITY_ORDER = [1, 2, 3, null] as const;
type PriorityKey = '1' | '2' | '3' | 'null';

const PRIORITY_LABELS: Record<PriorityKey, string> = {
    1: 'P1 — Critical',
    2: 'P2 — High',
    3: 'P3 — Normal',
    null: 'No Priority',
};

const GROUP_BY_LABELS: Record<GroupBy, string> = {
    page: 'Page',
    priority: 'Priority',
    dueDate: 'Due Date',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function daysDiff(isoDate: string): number {
    const d = new Date(isoDate + 'T00:00:00');
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function dueDateBucket(isoDate: string | null): DueBucket {
    if (!isoDate) { return 'no-date'; }
    const diff = daysDiff(isoDate);
    if (diff < 0) { return 'overdue'; }
    if (diff === 0) { return 'today'; }
    if (diff <= 7) { return 'this-week'; }
    return 'later';
}

function getFilteredTasks(): TaskViewItem[] {
    let tasks = allTasks;
    if (showTodoOnly) {
        // Keep pending-toggle tasks visible (they'll render as done) until the
        // 1-second grace period expires.
        tasks = tasks.filter(t => !t.done || pendingToggle.has(`${t.pagePath}:${t.line}`));
    }
    if (waitingOnly) { tasks = tasks.filter(t => t.waiting); }
    if (pageFilter) {
        const lc = pageFilter.toLowerCase();
        tasks = tasks.filter(t => t.pageTitle.toLowerCase().includes(lc));
    }
    return tasks;
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const ICON_CHECK_DONE = `<svg class="task-check done" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M5.5 8l2 2 3.5-3.5"/></svg>`;
const ICON_CHECK_UNDONE = `<svg class="task-check undone" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.25"/></svg>`;

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildPriorityBadge(priority: number | null): string {
    if (priority === null) { return ''; }
    const labels = ['', 'P1', 'P2', 'P3'] as const;
    const cls = ['', 'badge-p1', 'badge-p2', 'badge-p3'] as const;
    return `<span class="badge ${cls[priority]}">${labels[priority]}</span>`;
}

function buildWaitingBadge(waiting: boolean): string {
    if (!waiting) { return ''; }
    return `<span class="badge badge-waiting">Waiting</span>`;
}

function buildDueDateBadge(dueDate: string | null): string {
    if (!dueDate) { return ''; }
    const bucket = dueDateBucket(dueDate);
    const cls = bucket === 'overdue' ? 'badge-overdue'
        : bucket === 'today' ? 'badge-today'
            : 'badge-date';
    return `<span class="badge ${cls}">${esc(dueDate)}</span>`;
}

function buildTask(task: TaskViewItem, showPage = false): string {
    const isPending = pendingToggle.has(`${task.pagePath}:${task.line}`);
    const isDone = task.done || isPending;
    const checkIcon = isDone ? ICON_CHECK_DONE : ICON_CHECK_UNDONE;
    const pageLabel = showPage
        ? `<span class="task-page">${esc(task.pageTitle)}</span>`
        : '';
    const badges = buildPriorityBadge(task.priority)
        + buildWaitingBadge(task.waiting)
        + buildDueDateBadge(task.dueDate);

    return `<div class="task-row${isDone ? ' task-done' : ''}"
         data-page-path="${esc(task.pagePath)}"
         data-line="${task.line}">
        <button class="task-toggle"
                data-page-path="${esc(task.pagePath)}"
                data-line="${task.line}"
                title="Toggle task">
            ${checkIcon}
        </button>
        <div class="task-content">
            ${pageLabel}
            <span class="task-text">${esc(task.text)}</span>
            ${badges ? `<span class="task-badges">${badges}</span>` : ''}
        </div>
    </div>`;
}

function buildGroupHeader(label: string, count: number, extraClass = ''): string {
    return `<div class="group-header${extraClass ? ' ' + extraClass : ''}">
        <span class="group-label">${esc(label)}</span>
        <span class="group-count">${count}</span>
    </div>`;
}

function buildGroup(label: string, tasks: TaskViewItem[], showPage = false, extraClass = ''): string {
    return `<div class="group">
        ${buildGroupHeader(label, tasks.length, extraClass)}
        <div class="group-tasks">
            ${tasks.map(t => buildTask(t, showPage)).join('')}
        </div>
    </div>`;
}

// ── Grouping renderers ────────────────────────────────────────────────────────

function renderByPageImpl(tasks: TaskViewItem[]): string {
    const pages = new Map<string, { title: string; tasks: TaskViewItem[] }>();
    for (const t of tasks) {
        if (!pages.has(t.pagePath)) {
            pages.set(t.pagePath, { title: t.pageTitle, tasks: [] });
        }
        pages.get(t.pagePath)!.tasks.push(t);
    }
    const sorted = [...pages.entries()].sort((a, b) =>
        a[1].title.localeCompare(b[1].title, undefined, { sensitivity: 'base' }),
    );
    return sorted.map(([, { title, tasks: pageTasks }]) =>
        buildGroup(title, pageTasks),
    ).join('');
}

function renderByPriority(tasks: TaskViewItem[]): string {
    const groups = new Map<string, TaskViewItem[]>(
        PRIORITY_ORDER.map(p => [String(p), []]),
    );
    for (const t of tasks) {
        groups.get(String(t.priority))!.push(t);
    }
    return PRIORITY_ORDER.map(p => {
        const key = String(p) as PriorityKey;
        const groupTasks = groups.get(key)!;
        if (groupTasks.length === 0) { return ''; }
        groupTasks.sort((a, b) => {
            const da = a.dueDate ?? '9999-99-99';
            const db = b.dueDate ?? '9999-99-99';
            if (da !== db) { return da.localeCompare(db); }
            return a.pageTitle.localeCompare(b.pageTitle, undefined, { sensitivity: 'base' });
        });
        return buildGroup(PRIORITY_LABELS[key], groupTasks, true, p === null ? 'group-header-muted' : '');
    }).join('');
}

function renderByDueDate(tasks: TaskViewItem[]): string {
    const groups = new Map<DueBucket, TaskViewItem[]>(
        BUCKET_ORDER.map(b => [b, []]),
    );
    for (const t of tasks) {
        groups.get(dueDateBucket(t.dueDate))!.push(t);
    }
    return BUCKET_ORDER.map(bucket => {
        const groupTasks = groups.get(bucket)!;
        if (groupTasks.length === 0) { return ''; }
        groupTasks.sort((a, b) => {
            const da = a.dueDate ?? '9999-99-99';
            const db = b.dueDate ?? '9999-99-99';
            if (da !== db) { return da.localeCompare(db); }
            return a.pageTitle.localeCompare(b.pageTitle, undefined, { sensitivity: 'base' });
        });
        const extra = bucket === 'overdue' ? 'group-header-danger'
            : bucket === 'today' ? 'group-header-warning' : '';
        return buildGroup(BUCKET_LABELS[bucket], groupTasks, true, extra);
    }).join('');
}

// ── Task list helpers ─────────────────────────────────────────────────────────

function buildTaskListHtml(): string {
    const tasks = getFilteredTasks();
    if (tasks.length === 0) {
        return `<div class="empty-state">No tasks found</div>`;
    }
    switch (groupBy) {
        case 'priority': return renderByPriority(tasks);
        case 'dueDate': return renderByDueDate(tasks);
        default: return renderByPageImpl(tasks);
    }
}

function buildSummary(): string {
    const tasks = getFilteredTasks();
    const undoneCount = tasks.filter(t => !t.done).length;
    const doneCount = tasks.filter(t => t.done).length;
    return showTodoOnly
        ? `${undoneCount} task${undoneCount !== 1 ? 's' : ''}`
        : `${undoneCount} open · ${doneCount} done`;
}

function attachTaskHandlers(): void {
    const listEl = document.getElementById('task-list');
    if (!listEl) { return; }

    listEl.querySelectorAll<HTMLButtonElement>('.task-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const pagePath = btn.dataset.pagePath!;
            const line = parseInt(btn.dataset.line!, 10);
            const key = `${pagePath}:${line}`;
            const task = allTasks.find(t => t.pagePath === pagePath && t.line === line);

            // If "todo only" is active and the task is currently undone, keep it
            // visible for 1 s (shown as done) so the list doesn't jump immediately.
            if (showTodoOnly && task && !task.done && !pendingToggle.has(key)) {
                pendingToggle.add(key);
                clearTimeout(pendingToggleTimers.get(key));
                pendingToggleTimers.set(key, setTimeout(() => {
                    pendingToggle.delete(key);
                    pendingToggleTimers.delete(key);
                    refreshTaskList();
                }, 1000));
                refreshTaskList(); // show task as done immediately
            }

            vscode.postMessage({ type: 'toggleTask', pagePath, line });
        });
    });

    listEl.querySelectorAll<HTMLDivElement>('.task-row').forEach(row => {
        row.addEventListener('click', () => {
            vscode.postMessage({
                type: 'navigateTo',
                pagePath: row.dataset.pagePath!,
                line: parseInt(row.dataset.line!, 10),
            });
        });
    });
}

/** Refresh only the task list + summary, leaving toolbar DOM intact.
 *  This preserves input focus when typing in the page filter. */
function refreshTaskList(): void {
    const summaryEl = document.querySelector<HTMLElement>('.task-summary');
    if (summaryEl) { summaryEl.textContent = buildSummary(); }

    const listEl = document.getElementById('task-list');
    if (listEl) { listEl.innerHTML = buildTaskListHtml(); }

    // Update clear-button visibility without rebuilding toolbar
    const clearBtn = document.getElementById('btn-page-filter-clear') as HTMLButtonElement | null;
    if (clearBtn) { clearBtn.style.display = pageFilter ? '' : 'none'; }

    attachTaskHandlers();
}

// ── Main render (full rebuild — toolbar + task list) ──────────────────────────

function render(): void {
    const app = document.getElementById('app');
    if (!app) { return; }

    app.innerHTML = `
        <div id="toolbar">
            <div class="toolbar-section">
                <span class="sort-by-label">GROUP BY</span>
                <div class="group-by-pills">
                    ${(Object.keys(GROUP_BY_LABELS) as GroupBy[]).map(g => `
                        <button class="pill${groupBy === g ? ' pill-active' : ''}" data-groupby="${g}">
                            ${GROUP_BY_LABELS[g]}
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="toolbar-row toolbar-filters">
                <label class="toggle-switch">
                    <input type="checkbox" id="chk-todo-only"${showTodoOnly ? ' checked' : ''}>
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">TODO ONLY</span>
                </label>
                <label class="toggle-switch">
                    <input type="checkbox" id="chk-waiting-only"${waitingOnly ? ' checked' : ''}>
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">WAITING ONLY</span>
                </label>
            </div>
            <div class="toolbar-row toolbar-page-filter">
                <div class="page-filter-wrap">
                    <input type="text" id="page-filter" class="page-filter-input"
                           placeholder="Filter by page…">
                    <button class="page-filter-clear" id="btn-page-filter-clear"
                            title="Clear filter" style="display:none">&#x2715;</button>
                </div>
            </div>
        </div>
        <div class="task-summary"></div>
        <div id="task-list"></div>
    `;

    // Set input value imperatively (avoids HTML-escaping issues)
    const filterInput = document.getElementById('page-filter') as HTMLInputElement | null;
    if (filterInput) { filterInput.value = pageFilter; }

    // Group-by pill clicks
    app.querySelectorAll<HTMLButtonElement>('[data-groupby]').forEach(btn => {
        btn.addEventListener('click', () => {
            groupBy = btn.dataset.groupby as GroupBy;
            render();
        });
    });

    // Filter toggles — full render needed (pill active state may change)
    document.getElementById('chk-todo-only')?.addEventListener('change', e => {
        showTodoOnly = (e.target as HTMLInputElement).checked;
        refreshTaskList();
    });
    document.getElementById('chk-waiting-only')?.addEventListener('change', e => {
        waitingOnly = (e.target as HTMLInputElement).checked;
        refreshTaskList();
    });

    // Page filter — only refresh task list so the input keeps focus
    document.getElementById('page-filter')?.addEventListener('input', e => {
        pageFilter = (e.target as HTMLInputElement).value;
        refreshTaskList();
    });
    document.getElementById('btn-page-filter-clear')?.addEventListener('click', () => {
        pageFilter = '';
        const fi = document.getElementById('page-filter') as HTMLInputElement | null;
        if (fi) { fi.value = ''; fi.focus(); }
        refreshTaskList();
    });

    // Fill in task list
    refreshTaskList();
}

// ── Message handler ───────────────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; tasks?: TaskViewItem[] };
    if (msg.type === 'update' && msg.tasks !== undefined) {
        allTasks = msg.tasks;
        refreshTaskList();
    }
});

// Initial render (shows empty state until first update arrives)
render();
