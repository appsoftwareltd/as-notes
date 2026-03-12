import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import type { BoardConfig } from './KanbanTypes.js';
import { DEFAULT_BOARD_CONFIG, slugifyLane, slugifyBoard, RESERVED_LANES, ASSETS_DIR } from './KanbanTypes.js';
import type { LogService } from './LogService.js';
import { NO_OP_LOGGER } from './LogService.js';

const CONFIG_FILE = 'board.yaml';

export class KanbanBoardConfigStore {
    private config: BoardConfig = { ...DEFAULT_BOARD_CONFIG, lanes: [...DEFAULT_BOARD_CONFIG.lanes] };
    private boardSlug: string = '';
    private readonly kanbanUri: vscode.Uri;
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private readonly logger: LogService;

    constructor(kanbanRootUri: vscode.Uri, logger?: LogService) {
        this.kanbanUri = kanbanRootUri;
        this.logger = logger ?? NO_OP_LOGGER;
    }

    /** The current board slug. */
    get currentBoard(): string {
        return this.boardSlug;
    }

    /** URI for the current board directory. */
    private get boardUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.kanbanUri, this.boardSlug);
    }

    /** URI for board.yaml in the current board. */
    private get configUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.boardUri, CONFIG_FILE);
    }

    /** Select a board and load its config. */
    async selectBoard(slug: string): Promise<void> {
        this.boardSlug = slug;
        await this.loadConfig();
    }

    /** Load config from board.yaml. */
    private async loadConfig(): Promise<void> {
        this.config = { ...DEFAULT_BOARD_CONFIG, lanes: [...DEFAULT_BOARD_CONFIG.lanes], name: '' };
        if (!this.boardSlug) {
            this._onDidChange.fire();
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this.configUri);
            const text = new TextDecoder().decode(content);
            const loaded = parse(text) as BoardConfig | null;
            if (loaded?.lanes) {
                this.config = {
                    name: loaded.name || this.boardSlug,
                    lanes: loaded.lanes,
                    users: loaded.users,
                    labels: loaded.labels,
                };
                this.logger.info('kanbanConfig', `Loaded config for board "${this.boardSlug}" with ${this.config.lanes.length} lanes`);
            }
        } catch {
            this.logger.info('kanbanConfig', `No config found for board "${this.boardSlug}", using defaults`);
        }
        this._onDidChange.fire();
    }

    /**
     * Create a new board: directory, lane subdirectories, assets directory, and board.yaml.
     * Returns the slugified board name.
     */
    async createBoard(name: string): Promise<string> {
        const slug = slugifyBoard(name);
        if (!slug) { throw new Error('Invalid board name'); }

        const boardDir = vscode.Uri.joinPath(this.kanbanUri, slug);
        await vscode.workspace.fs.createDirectory(boardDir);

        // Create lane directories
        const lanes = [...DEFAULT_BOARD_CONFIG.lanes];
        for (const lane of lanes) {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(boardDir, lane));
        }

        // Create assets directory
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(boardDir, ASSETS_DIR));

        // Write board.yaml
        const config: BoardConfig = { name, lanes };
        const configUri = vscode.Uri.joinPath(boardDir, CONFIG_FILE);
        await vscode.workspace.fs.writeFile(
            configUri,
            new TextEncoder().encode(stringify(config, { lineWidth: 0 })),
        );

        this.logger.info('kanbanConfig', `Created board "${name}" (${slug})`);
        return slug;
    }

    /** Rename a board: rename directory and update board.yaml name. */
    async renameBoard(oldSlug: string, newName: string): Promise<string> {
        const newSlug = slugifyBoard(newName);
        if (!newSlug) { throw new Error('Invalid board name'); }
        if (newSlug === oldSlug) {
            // Just update the display name
            if (this.boardSlug === oldSlug) {
                this.config.name = newName;
                await this.save();
            }
            return oldSlug;
        }

        const oldDir = vscode.Uri.joinPath(this.kanbanUri, oldSlug);
        const newDir = vscode.Uri.joinPath(this.kanbanUri, newSlug);
        await vscode.workspace.fs.rename(oldDir, newDir, { overwrite: false });

        // Update board.yaml inside the renamed directory
        const configUri = vscode.Uri.joinPath(newDir, CONFIG_FILE);
        try {
            const content = await vscode.workspace.fs.readFile(configUri);
            const text = new TextDecoder().decode(content);
            const loaded = parse(text) as BoardConfig;
            loaded.name = newName;
            await vscode.workspace.fs.writeFile(
                configUri,
                new TextEncoder().encode(stringify(loaded, { lineWidth: 0 })),
            );
        } catch {
            // Config may not exist — create it
            const config: BoardConfig = { name: newName, lanes: [...DEFAULT_BOARD_CONFIG.lanes] };
            await vscode.workspace.fs.writeFile(
                configUri,
                new TextEncoder().encode(stringify(config, { lineWidth: 0 })),
            );
        }

        // If this was the active board, update the slug
        if (this.boardSlug === oldSlug) {
            this.boardSlug = newSlug;
            await this.loadConfig();
        }

        this.logger.info('kanbanConfig', `Renamed board "${oldSlug}" → "${newSlug}"`);
        return newSlug;
    }

    /** Delete a board and all its contents. */
    async deleteBoard(slug: string): Promise<void> {
        const boardDir = vscode.Uri.joinPath(this.kanbanUri, slug);
        await vscode.workspace.fs.delete(boardDir, { recursive: true });

        if (this.boardSlug === slug) {
            this.boardSlug = '';
            this.config = { ...DEFAULT_BOARD_CONFIG, lanes: [...DEFAULT_BOARD_CONFIG.lanes], name: '' };
            this._onDidChange.fire();
        }

        this.logger.info('kanbanConfig', `Deleted board "${slug}"`);
    }

    /** List all board slugs under kanban/. */
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

    /** List all boards with display names (reads each board.yaml). */
    async listBoardsWithNames(): Promise<{ slug: string; name: string }[]> {
        const slugs = await this.listBoards();
        const results: { slug: string; name: string }[] = [];
        for (const slug of slugs) {
            let displayName = slug;
            try {
                const configUri = vscode.Uri.joinPath(this.kanbanUri, slug, CONFIG_FILE);
                const content = await vscode.workspace.fs.readFile(configUri);
                const loaded = parse(new TextDecoder().decode(content)) as BoardConfig | null;
                if (loaded?.name) { displayName = loaded.name; }
            } catch { /* use slug as fallback */ }
            results.push({ slug, name: displayName });
        }
        return results;
    }

    get(): BoardConfig {
        return this.config;
    }

    async update(config: Partial<BoardConfig>): Promise<void> {
        if (config.lanes !== undefined) { this.config.lanes = config.lanes; }
        if (config.users !== undefined) { this.config.users = config.users; }
        if (config.labels !== undefined) { this.config.labels = config.labels; }
        if (config.name !== undefined) { this.config.name = config.name; }
        await this.save();
        this.logger.info('kanbanConfig', 'Board config updated');
        this._onDidChange.fire();
    }

    async addUser(name: string): Promise<void> {
        const users = this.config.users ?? [];
        if (!users.includes(name)) {
            this.config.users = [...users, name];
            await this.save();
            this._onDidChange.fire();
        }
    }

    async addLabel(name: string): Promise<void> {
        const labels = this.config.labels ?? [];
        if (!labels.includes(name)) {
            this.config.labels = [...labels, name];
            await this.save();
            this._onDidChange.fire();
        }
    }

    /** Reconcile board.yaml lanes with actual directories on disk. */
    async reconcileWithDirectories(dirs: string[]): Promise<void> {
        let changed = false;
        for (const dir of dirs) {
            if (RESERVED_LANES.includes(dir) || dir === ASSETS_DIR) { continue; }
            const slug = slugifyLane(dir);
            if (!slug) { continue; }
            if (!this.config.lanes.includes(slug)) {
                this.config.lanes.push(slug);
                changed = true;
                this.logger.info('kanbanConfig', `Added discovered lane: ${slug}`);
            }
        }
        if (changed) {
            await this.save();
            this._onDidChange.fire();
        }
    }

    /** Scan card metadata and add unknown assignees/labels to config. */
    async reconcileMetadata(cards: Array<{ assignee?: string; labels?: string[] }>): Promise<void> {
        let changed = false;
        const users = new Set(this.config.users ?? []);
        const labels = new Set(this.config.labels ?? []);
        for (const card of cards) {
            if (card.assignee && !users.has(card.assignee)) {
                users.add(card.assignee);
                changed = true;
            }
            if (card.labels) {
                for (const label of card.labels) {
                    if (!labels.has(label)) {
                        labels.add(label);
                        changed = true;
                    }
                }
            }
        }
        if (changed) {
            this.config.users = [...users];
            this.config.labels = [...labels];
            await this.save();
            this.logger.info('kanbanConfig', 'Reconciled metadata — added missing users/labels');
            this._onDidChange.fire();
        }
    }

    /** Ensure lane directories exist for all configured lanes. */
    async ensureLaneDirectories(): Promise<void> {
        if (!this.boardSlug) { return; }
        for (const lane of this.config.lanes) {
            const dirUri = vscode.Uri.joinPath(this.boardUri, lane);
            try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }
        }
    }

    /** Reset to empty state (no board selected). */
    clear(): void {
        this.boardSlug = '';
        this.config = { ...DEFAULT_BOARD_CONFIG, lanes: [...DEFAULT_BOARD_CONFIG.lanes], name: '' };
        this._onDidChange.fire();
    }

    private async save(): Promise<void> {
        if (!this.boardSlug) { return; }
        const content = new TextEncoder().encode(stringify(this.config, { lineWidth: 0 }));
        await vscode.workspace.fs.writeFile(this.configUri, content);
    }
}
