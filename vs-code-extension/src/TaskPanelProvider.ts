import * as vscode from 'vscode';
import { IndexService, type PageRow, type TaskRow } from './IndexService.js';

// ── Tree item types ────────────────────────────────────────────────────────

/**
 * Discriminated union for tree items. Pages are collapsible group headers;
 * tasks are leaf items underneath.
 */
export type TaskTreeItem = PageGroupItem | TaskItem;

export interface PageGroupItem {
    kind: 'page';
    page: PageRow;
    taskCount: number;
}

export interface TaskItem {
    kind: 'task';
    task: TaskRow;
    pagePath: string;
}

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * VS Code TreeDataProvider that displays tasks grouped by page.
 *
 * Features:
 * - "Show TODO only" toggle (default: true) — filters out done tasks
 * - Click-to-navigate — opening the source file at the task's line
 * - Refresh on demand via `refresh()`
 */
export class TaskPanelProvider implements vscode.TreeDataProvider<TaskTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _showTodoOnly = true;

    constructor(private indexService: IndexService) { }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Signal the tree view to re-render all items. */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /** Whether only undone tasks are shown. */
    get showTodoOnly(): boolean {
        return this._showTodoOnly;
    }

    /** Toggle the "Show TODO only" filter and refresh. */
    toggleShowTodoOnly(): void {
        this._showTodoOnly = !this._showTodoOnly;
        this.refresh();
    }

    // ── TreeDataProvider ───────────────────────────────────────────────────

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        if (element.kind === 'page') {
            return this.buildPageTreeItem(element);
        }
        return this.buildTaskTreeItem(element);
    }

    getChildren(element?: TaskTreeItem): TaskTreeItem[] {
        if (!this.indexService.isOpen) { return []; }

        // Root level — return page groups
        if (!element) {
            return this.indexService
                .getPagesWithTasks(this._showTodoOnly)
                .map(({ page, taskCount }) => ({
                    kind: 'page' as const,
                    page,
                    taskCount,
                }));
        }

        // Child level — return tasks for the page
        if (element.kind === 'page') {
            return this.indexService
                .getTasksForPage(element.page.id, this._showTodoOnly)
                .map(task => ({
                    kind: 'task' as const,
                    task,
                    pagePath: element.page.path,
                }));
        }

        return [];
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private buildPageTreeItem(item: PageGroupItem): vscode.TreeItem {
        const label = item.page.title || item.page.filename.replace(/\.md$/, '');
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.description = `${item.taskCount}`;
        treeItem.iconPath = new vscode.ThemeIcon('file-text');
        treeItem.contextValue = 'taskPage';
        return treeItem;
    }

    private buildTaskTreeItem(item: TaskItem): vscode.TreeItem {
        const label = item.task.text || '(empty task)';
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

        if (item.task.done) {
            treeItem.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('terminal.ansiGreen'));
            treeItem.description = 'done';
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('circle-large-outline');
        }

        treeItem.contextValue = 'taskItem';

        // Click-to-navigate: open the file at the task's line
        treeItem.command = {
            command: 'as-notes.navigateToTask',
            title: 'Go to Task',
            arguments: [item.pagePath, item.task.line],
        };

        return treeItem;
    }
}
