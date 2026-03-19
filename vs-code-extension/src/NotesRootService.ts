import * as path from 'path';

/**
 * Centralised service for computing all AS Notes paths relative to the
 * configured root directory. When `rootDirectory` is empty the workspace
 * root is used directly (backward-compatible default).
 *
 * Pure logic -- no VS Code imports. Consumers pass workspace root and
 * setting values; this module returns absolute paths.
 */

const ASNOTES_DIR = '.asnotes';
const INDEX_DB = 'index.db';
const IGNORE_FILE = '.asnotesignore';

export interface NotesRootPaths {
    /** Absolute path to the AS Notes root (workspaceRoot or workspaceRoot/rootDirectory) */
    readonly root: string;
    /** Absolute URI-style path to the AS Notes root (forward slashes) */
    readonly rootUri: string;
    /** Absolute path to the `.asnotes/` directory */
    readonly asnotesDir: string;
    /** Absolute path to the SQLite index database */
    readonly databasePath: string;
    /** Absolute path to the log directory */
    readonly logDir: string;
    /** Absolute path to `.asnotesignore` */
    readonly ignoreFilePath: string;
}

/**
 * Normalise a rootDirectory setting value: trim whitespace, strip
 * leading/trailing slashes, and handle empty/blank values.
 */
export function normaliseRootDirectory(dir: string): string {
    return dir.trim().replace(/^[/\\]+|[/\\]+$/g, '');
}

/**
 * Compute the absolute AS Notes root path from the workspace root and the
 * `rootDirectory` setting value.
 */
export function computeNotesRoot(workspaceRoot: string, rootDirectory: string): string {
    const normalised = normaliseRootDirectory(rootDirectory);
    if (!normalised) {
        return workspaceRoot;
    }
    return path.join(workspaceRoot, normalised);
}

/**
 * Compute all standard AS Notes paths given a workspace root and the
 * configured rootDirectory value.
 */
export function computeNotesRootPaths(workspaceRoot: string, rootDirectory: string): NotesRootPaths {
    const root = computeNotesRoot(workspaceRoot, rootDirectory);
    const asnotesDir = path.join(root, ASNOTES_DIR);
    return {
        root,
        rootUri: root.replace(/\\/g, '/'),
        asnotesDir,
        databasePath: path.join(asnotesDir, INDEX_DB),
        logDir: path.join(asnotesDir, 'logs'),
        ignoreFilePath: path.join(root, IGNORE_FILE),
    };
}

/**
 * Compute a workspace-relative path from an absolute file path, relative
 * to the AS Notes root (not the VS Code workspace root).
 *
 * Returns forward-slashed paths for consistency with the index.
 */
export function toNotesRelativePath(notesRoot: string, absolutePath: string): string {
    const normRoot = notesRoot.replace(/\\/g, '/');
    const normPath = absolutePath.replace(/\\/g, '/');
    if (normPath.startsWith(normRoot + '/')) {
        return normPath.slice(normRoot.length + 1);
    }
    if (normPath === normRoot) {
        return '';
    }
    // Fallback: return the path as-is (should not happen in practice)
    return normPath;
}

/**
 * Check whether an absolute file path is inside the AS Notes root directory.
 */
export function isInsideNotesRoot(notesRoot: string, absolutePath: string): boolean {
    const normRoot = notesRoot.replace(/\\/g, '/').toLowerCase();
    const normPath = absolutePath.replace(/\\/g, '/').toLowerCase();
    return normPath === normRoot || normPath.startsWith(normRoot + '/');
}
