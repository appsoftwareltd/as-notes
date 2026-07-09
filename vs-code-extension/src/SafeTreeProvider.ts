/**
 * SafeTreeProvider - the sidebar tree of groups and entries for an unlocked
 * safe. Mirrors the KDBX group hierarchy; supports a flat filtered view for
 * search. Reads the live db through SafeSessionService and never caches
 * decrypted state - when the safe locks, the tree renders empty.
 */

import * as vscode from 'vscode';
import type * as kdbxweb from 'kdbxweb';
import { SafeSessionService } from './SafeSessionService';
import { fieldTextOf, readTotp } from './SafeService';
import { codiconForIcon } from './safeIcons';

export type SafeNode =
    | { kind: 'group'; group: kdbxweb.KdbxGroup }
    | { kind: 'entry'; entry: kdbxweb.KdbxEntry };

export class SafeTreeProvider implements vscode.TreeDataProvider<SafeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private filter = '';

    constructor(private readonly session: SafeSessionService) {
        session.onDidChangeState(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setFilter(text: string): void {
        this.filter = text.trim().toLowerCase();
        this.refresh();
    }

    get filterText(): string {
        return this.filter;
    }

    getTreeItem(node: SafeNode): vscode.TreeItem {
        if (node.kind === 'group') {
            const item = new vscode.TreeItem(
                node.group.name || '(unnamed group)',
                vscode.TreeItemCollapsibleState.Collapsed,
            );
            item.contextValue = 'safeGroup';
            item.iconPath = new vscode.ThemeIcon('folder');
            return item;
        }

        const title = fieldTextOf(node.entry.fields.get('Title')) || '(no title)';
        const username = fieldTextOf(node.entry.fields.get('UserName'));
        const item = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
        item.description = username;
        // Entries with an authenticator key get a distinct context value so the
        // inline "copy code" action only shows where it applies.
        item.contextValue = readTotp(node.entry) ? 'safeEntryTotp' : 'safeEntry';
        item.iconPath = new vscode.ThemeIcon(codiconForIcon(node.entry.icon ?? 0));
        item.tooltip = fieldTextOf(node.entry.fields.get('URL')) || title;
        item.command = {
            command: 'as-notes.safe.openEntry',
            title: 'Open Entry',
            arguments: [node],
        };
        return item;
    }

    getChildren(element?: SafeNode): SafeNode[] {
        if (!this.session.isUnlocked) {
            return [];
        }
        this.session.touch(); // browsing counts as activity - defer idle auto-lock
        const root = this.session.db.getDefaultGroup();

        // Filtered: a flat list of matching entries across the whole tree.
        if (this.filter && !element) {
            return this.matchingEntries(root).map((entry) => ({ kind: 'entry', entry }));
        }

        const group = element?.kind === 'group' ? element.group : element ? undefined : root;
        if (!group) {
            return []; // entries have no children
        }

        const recycleBinUuid = this.session.db.meta.recycleBinUuid?.id;
        const groups: SafeNode[] = group.groups
            .filter((g) => g.uuid.id !== recycleBinUuid)
            .map((g) => ({ kind: 'group', group: g }));
        const entries: SafeNode[] = group.entries.map((entry) => ({ kind: 'entry', entry }));
        return [...groups, ...entries];
    }

    /** All entries under a group whose title/username/url matches the filter. */
    private matchingEntries(group: kdbxweb.KdbxGroup): kdbxweb.KdbxEntry[] {
        const out: kdbxweb.KdbxEntry[] = [];
        const recycleBinUuid = this.session.db.meta.recycleBinUuid?.id;
        const walk = (g: kdbxweb.KdbxGroup) => {
            for (const entry of g.entries) {
                const haystack = [
                    fieldTextOf(entry.fields.get('Title')),
                    fieldTextOf(entry.fields.get('UserName')),
                    fieldTextOf(entry.fields.get('URL')),
                ]
                    .join(' ')
                    .toLowerCase();
                if (haystack.includes(this.filter)) {
                    out.push(entry);
                }
            }
            for (const sub of g.groups) {
                if (sub.uuid.id !== recycleBinUuid) {
                    walk(sub);
                }
            }
        };
        walk(group);
        return out;
    }
}

const SAFE_DND_MIME = 'application/vnd.code.tree.asnotessafe';

/** Drag entries and groups between groups within the safe tree. */
export class SafeDragAndDropController implements vscode.TreeDragAndDropController<SafeNode> {
    readonly dropMimeTypes = [SAFE_DND_MIME];
    readonly dragMimeTypes = [SAFE_DND_MIME];

    private dragged: SafeNode[] = [];

    constructor(
        private readonly session: SafeSessionService,
        private readonly onChanged: () => void,
    ) {}

    handleDrag(source: readonly SafeNode[], data: vscode.DataTransfer): void {
        this.dragged = [...source];
        data.set(SAFE_DND_MIME, new vscode.DataTransferItem('safe'));
    }

    handleDrop(target: SafeNode | undefined): void {
        if (!this.session.isUnlocked || this.dragged.length === 0) {
            return;
        }
        const db = this.session.db;
        const root = db.getDefaultGroup();
        const toGroup =
            target?.kind === 'group'
                ? target.group
                : target?.kind === 'entry'
                    ? target.entry.parentGroup ?? root
                    : root;

        let moved = false;
        for (const node of this.dragged) {
            if (node.kind === 'entry') {
                db.move(node.entry, toGroup);
                moved = true;
            } else if (
                node.group.uuid.id !== root.uuid.id && // can't move the root
                !isSameOrDescendant(node.group, toGroup) // avoid creating a cycle
            ) {
                db.move(node.group, toGroup);
                moved = true;
            }
        }
        this.dragged = [];
        if (moved) {
            this.session.markDirty();
            this.onChanged();
        }
    }
}

/** True if `candidate` is `group` itself or nested anywhere beneath it. */
function isSameOrDescendant(group: kdbxweb.KdbxGroup, candidate: kdbxweb.KdbxGroup): boolean {
    let g: kdbxweb.KdbxGroup | undefined = candidate;
    while (g) {
        if (g.uuid.id === group.uuid.id) {
            return true;
        }
        g = g.parentGroup;
    }
    return false;
}
