import * as fs from 'fs';
import ignore, { type Ignore } from 'ignore';
import { formatLogError, getActiveLogger } from './LogService.js';

export interface IgnoreServiceOptions {
    /**
     * Additional ignore patterns layered after `.asnotesignore` so they
     * remain mandatory and cannot be un-ignored by user config.
     */
    readonly additionalPatterns?: readonly string[];
}

export interface RuntimeIgnoreConfig {
    readonly templateFolder?: string;
    readonly assetPath?: string;
}

function normaliseRelativeDirectoryPath(dir?: string): string {
    return (dir ?? '').trim().replace(/^[/\\]+|[/\\]+$/g, '').replace(/\\/g, '/');
}

function toDirectoryPattern(dir?: string): string | undefined {
    const normalised = normaliseRelativeDirectoryPath(dir);
    return normalised ? `${normalised}/` : undefined;
}

/**
 * Runtime exclusions that are part of AS Notes configuration/state rather
 * than user-owned `.asnotesignore` content.
 */
export function buildMandatoryIgnorePatterns(config: RuntimeIgnoreConfig = {}): string[] {
    const patterns = ['.asnotes/'];
    const templatePattern = toDirectoryPattern(config.templateFolder);
    if (templatePattern) {
        patterns.push(templatePattern);
    }
    const assetPattern = toDirectoryPattern(config.assetPath);
    if (assetPattern) {
        patterns.push(assetPattern);
    }
    return Array.from(new Set(patterns));
}

export function createConfiguredIgnoreService(
    ignoreFilePath: string,
    config: RuntimeIgnoreConfig = {},
): IgnoreService {
    return new IgnoreService(ignoreFilePath, {
        additionalPatterns: buildMandatoryIgnorePatterns(config),
    });
}

/**
 * Reads and parses an `.asnotesignore` file (`.gitignore` syntax) and exposes
 * an `isIgnored()` check for use during index scanning.
 *
 * Designed to be VS Code-free so it can be unit tested without a running extension host.
 */
export class IgnoreService {
    private ig: Ignore;
    private readonly additionalPatterns: readonly string[];

    /**
     * @param ignoreFilePath Absolute path to the `.asnotesignore` file.
     */
    constructor(
        private readonly ignoreFilePath: string,
        options: IgnoreServiceOptions = {},
    ) {
        this.additionalPatterns = options.additionalPatterns ?? [];
        this.ig = this.load();
    }

    /**
     * Returns true if the given workspace-relative path matches any pattern in
     * `.asnotesignore` and should be excluded from the index.
     *
     * @param relativePath Workspace-relative path using forward slashes, e.g. `logseq/pages/foo.md`
     */
    isIgnored(relativePath: string): boolean {
        // `ignore` requires forward slashes on all platforms.
        const normalised = relativePath.replace(/\\/g, '/');
        return this.ig.ignores(normalised);
    }

    /**
     * Re-reads the `.asnotesignore` file from disk.
     * Call this after the file has changed on disk.
     */
    reload(): void {
        this.ig = this.load();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private load(): Ignore {
        const instance = ignore();
        if (!fs.existsSync(this.ignoreFilePath)) {
            if (this.additionalPatterns.length > 0) {
                instance.add(this.additionalPatterns);
            }
            return instance;
        }
        try {
            const content = fs.readFileSync(this.ignoreFilePath, 'utf-8');
            instance.add(content);
        } catch (err) {
            getActiveLogger().warn('IgnoreService', `could not read ${this.ignoreFilePath}: ${formatLogError(err)}`);
        }
        if (this.additionalPatterns.length > 0) {
            instance.add(this.additionalPatterns);
        }
        return instance;
    }
}
