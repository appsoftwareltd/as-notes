import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import type { Card, Priority, CardEntry, AssetMeta } from './KanbanTypes.js';
import { RESERVED_LANES, ASSETS_DIR } from './KanbanTypes.js';
import type { LogService } from './LogService.js';
import { NO_OP_LOGGER } from './LogService.js';

export class KanbanStore {
    private cards: Map<string, Card> = new Map();
    private readonly kanbanUri: vscode.Uri;
    private boardSlug: string = '';
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private readonly logger: LogService;

    constructor(kanbanRootUri: vscode.Uri, logger?: LogService) {
        this.kanbanUri = kanbanRootUri;
        this.logger = logger ?? NO_OP_LOGGER;
    }

    /** The root URI for the kanban directory. */
    get kanbanRootUri(): vscode.Uri {
        return this.kanbanUri;
    }

    /** The current board slug. */
    get currentBoard(): string {
        return this.boardSlug;
    }

    /** URI for the current board directory. */
    private get boardUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.kanbanUri, this.boardSlug);
    }

    /** URI for the assets directory in the current board. */
    private get assetsUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.boardUri, ASSETS_DIR);
    }

    /** Set the active board and reload cards. */
    async selectBoard(slug: string): Promise<void> {
        this.boardSlug = slug;
        await this.reload();
    }

    /** Load all cards for the current board from disk. */
    async reload(): Promise<void> {
        this.cards.clear();
        if (!this.boardSlug) {
            this._onDidChange.fire();
            return;
        }
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.boardUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory
                    && !RESERVED_LANES.includes(name)
                    && name !== ASSETS_DIR) {
                    await this.loadCardsFromDirectory(name);
                }
            }
            this.logger.info('kanbanStore', `Loaded ${this.cards.size} cards for board "${this.boardSlug}"`);
        } catch {
            // Board directory may not exist yet
        }
        this._onDidChange.fire();
    }

    private async loadCardsFromDirectory(lane: string): Promise<void> {
        const dirUri = vscode.Uri.joinPath(this.boardUri, lane);
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
            return;
        }
        for (const [name, type] of entries) {
            if (type === vscode.FileType.File && name.endsWith('.yaml') && name.startsWith('card_')) {
                const uri = vscode.Uri.joinPath(dirUri, name);
                try {
                    const content = await vscode.workspace.fs.readFile(uri);
                    const text = new TextDecoder().decode(content);
                    const card = KanbanStore.deserialise(text);
                    if (card) {
                        card.id = name.slice(0, -5); // strip .yaml
                        card.lane = lane;
                        if (!card.slug) {
                            card.slug = KanbanStore.extractSlugFromId(card.id);
                        }
                        this.cards.set(card.id, card);
                    }
                } catch {
                    // skip unreadable files
                }
            }
        }
    }

    /** List all board directory slugs under kanban/. */
    async listBoards(): Promise<string[]> {
        const boards: string[] = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.kanbanUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    boards.push(name);
                }
            }
        } catch {
            // kanban/ may not exist
        }
        return boards;
    }

    /** Return all lane directory names under the current board (excluding reserved/assets). */
    async getDirectories(): Promise<string[]> {
        const dirs: string[] = [];
        if (!this.boardSlug) { return dirs; }
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.boardUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory
                    && !RESERVED_LANES.includes(name)
                    && name !== ASSETS_DIR) {
                    dirs.push(name);
                }
            }
        } catch {
            // directory may not exist
        }
        return dirs;
    }

    getAll(): Card[] {
        return Array.from(this.cards.values());
    }

    get(id: string): Card | undefined {
        return this.cards.get(id);
    }

    getCardUri(id: string): vscode.Uri {
        const card = this.cards.get(id);
        if (card) {
            return vscode.Uri.joinPath(this.boardUri, card.lane, `${id}.yaml`);
        }
        return vscode.Uri.joinPath(this.boardUri, 'todo', `${id}.yaml`);
    }

    /** Get the asset directory URI for a card. */
    getCardAssetsUri(id: string): vscode.Uri {
        return vscode.Uri.joinPath(this.assetsUri, id);
    }

    async save(card: Card): Promise<void> {
        card.updated = new Date().toISOString();
        this.cards.set(card.id, card);
        const laneDir = vscode.Uri.joinPath(this.boardUri, card.lane);
        try {
            await vscode.workspace.fs.createDirectory(laneDir);
        } catch { /* exists */ }
        const uri = this.getCardUri(card.id);
        const content = new TextEncoder().encode(KanbanStore.serialise(card));
        await vscode.workspace.fs.writeFile(uri, content);
        this.logger.info('kanbanStore', `Saved card ${card.id}`);
        this._onDidChange.fire();
    }

    async moveCardToLane(id: string, newLane: string): Promise<void> {
        const card = this.cards.get(id);
        if (!card) { return; }

        const oldLane = card.lane;
        if (oldLane === newLane) {
            await this.save(card);
            return;
        }

        const oldUri = vscode.Uri.joinPath(this.boardUri, oldLane, `${id}.yaml`);
        const newDir = vscode.Uri.joinPath(this.boardUri, newLane);
        const newUri = vscode.Uri.joinPath(newDir, `${id}.yaml`);

        try { await vscode.workspace.fs.createDirectory(newDir); } catch { /* exists */ }

        card.lane = newLane;
        card.updated = new Date().toISOString();
        this.cards.set(id, card);

        const content = new TextEncoder().encode(KanbanStore.serialise(card));
        await vscode.workspace.fs.writeFile(newUri, content);

        try {
            await vscode.workspace.fs.delete(oldUri);
        } catch {
            // old file may not exist
        }

        this.logger.info('kanbanStore', `Moved card ${id} from ${oldLane} to ${newLane}`);
        this._onDidChange.fire();
    }

    async delete(id: string): Promise<void> {
        const card = this.cards.get(id);
        this.cards.delete(id);
        const cardUri = card
            ? vscode.Uri.joinPath(this.boardUri, card.lane, `${id}.yaml`)
            : this.getCardUri(id);
        try {
            await vscode.workspace.fs.delete(cardUri);
            this.logger.info('kanbanStore', `Deleted card ${id}`);
        } catch { /* file may not exist */ }

        // Delete associated assets directory
        try {
            await vscode.workspace.fs.delete(this.getCardAssetsUri(id), { recursive: true });
        } catch { /* may not have assets */ }

        this._onDidChange.fire();
    }

    createCard(title: string, lane: string): Card {
        const now = new Date();
        const id = KanbanStore.generateId(now, title);
        return {
            id,
            title,
            lane,
            created: now.toISOString(),
            updated: now.toISOString(),
            description: '',
            slug: KanbanStore.slugify(title),
        };
    }

    /** Copy a file into the card's asset directory and return metadata. */
    async addAsset(cardId: string, sourceUri: vscode.Uri, addedBy?: string): Promise<AssetMeta | null> {
        const card = this.cards.get(cardId);
        if (!card) { return null; }

        const filename = sourceUri.path.split('/').pop() ?? 'unnamed';
        const cardAssetsDir = this.getCardAssetsUri(cardId);
        try {
            await vscode.workspace.fs.createDirectory(cardAssetsDir);
        } catch { /* exists */ }

        const destUri = vscode.Uri.joinPath(cardAssetsDir, filename);
        await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: true });

        const meta: AssetMeta = {
            filename,
            added: new Date().toISOString(),
            addedBy,
        };

        if (!card.assets) { card.assets = []; }
        // Replace if same filename exists
        const idx = card.assets.findIndex((a) => a.filename === filename);
        if (idx >= 0) {
            card.assets[idx] = meta;
        } else {
            card.assets.push(meta);
        }

        await this.save(card);
        return meta;
    }

    /** Remove an asset file and its YAML reference. */
    async removeAsset(cardId: string, filename: string): Promise<void> {
        const card = this.cards.get(cardId);
        if (!card) { return; }

        const assetUri = vscode.Uri.joinPath(this.getCardAssetsUri(cardId), filename);
        try {
            await vscode.workspace.fs.delete(assetUri);
        } catch { /* file may not exist */ }

        if (card.assets) {
            card.assets = card.assets.filter((a) => a.filename !== filename);
            if (card.assets.length === 0) { card.assets = undefined; }
        }
        await this.save(card);
    }

    // ── Static helpers ─────────────────────────────────────────────────────

    static generateId(date: Date, title: string): string {
        const y = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        const ts = `${y}${mo}${d}_${h}${mi}${s}${ms}`;
        const uuid = Math.random().toString(36).slice(2, 8);
        const slug = KanbanStore.slugify(title);
        return `card_${ts}_${uuid}_${slug}`;
    }

    static extractSlugFromId(id: string): string {
        const parts = id.split('_');
        if (parts.length < 5 || parts[0] !== 'card') { return ''; }
        return parts.slice(4).join('_');
    }

    static slugify(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 50)
            .replace(/_+$/, '');
    }

    /** Serialise a card to pure YAML. */
    static serialise(card: Card): string {
        const data: Record<string, unknown> = {
            title: card.title,
            created: card.created,
            updated: card.updated,
        };
        if (card.description) { data.description = card.description; }
        if (card.priority && card.priority !== 'none') { data.priority = card.priority; }
        if (card.assignee) { data.assignee = card.assignee; }
        if (card.labels?.length) { data.labels = card.labels; }
        if (card.dueDate) { data.dueDate = card.dueDate; }
        if (card.sortOrder != null) { data.sortOrder = card.sortOrder; }
        if (card.slug) { data.slug = card.slug; }
        if (card.entries?.length) { data.entries = card.entries; }
        if (card.assets?.length) { data.assets = card.assets; }
        return stringify(data, { lineWidth: 0 });
    }

    /** Deserialise a YAML string into a Card. */
    static deserialise(text: string): Card | null {
        try {
            const data = parse(text) as Record<string, unknown>;
            if (!data || typeof data.title !== 'string') { return null; }
            return {
                id: '',
                title: data.title,
                lane: '',
                created: (data.created as string) ?? new Date().toISOString(),
                updated: (data.updated as string) ?? new Date().toISOString(),
                description: (data.description as string) ?? '',
                priority: (data.priority as Priority) || undefined,
                assignee: (data.assignee as string) || undefined,
                labels: Array.isArray(data.labels) ? (data.labels as string[]) : undefined,
                dueDate: (data.dueDate as string) || undefined,
                sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
                slug: typeof data.slug === 'string' ? data.slug : undefined,
                entries: Array.isArray(data.entries)
                    ? (data.entries as CardEntry[])
                    : undefined,
                assets: Array.isArray(data.assets)
                    ? (data.assets as AssetMeta[])
                    : undefined,
            };
        } catch {
            return null;
        }
    }
}
