import * as fs from 'fs';
import ignore, { type Ignore } from 'ignore';

/**
 * Reads and parses an `.asnotesignore` file (`.gitignore` syntax) and exposes
 * an `isIgnored()` check for use during index scanning.
 *
 * Designed to be VS Code-free so it can be unit tested without a running extension host.
 */
export class IgnoreService {
    private ig: Ignore;

    /**
     * @param ignoreFilePath Absolute path to the `.asnotesignore` file.
     */
    constructor(private readonly ignoreFilePath: string) {
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
            return instance;
        }
        try {
            const content = fs.readFileSync(this.ignoreFilePath, 'utf-8');
            instance.add(content);
        } catch (err) {
            console.warn(`as-notes: could not read ${this.ignoreFilePath}:`, err);
        }
        return instance;
    }
}
