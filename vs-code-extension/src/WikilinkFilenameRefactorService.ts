import * as path from 'path';
import * as vscode from 'vscode';

export interface FilenameRefactorRename {
    oldPageName: string;
    newPageName: string;
}

export interface FilenameRefactorPage {
    path: string;
    filename: string;
}

export interface FilenameRefactorOperation {
    oldUri: vscode.Uri;
    newUri: vscode.Uri;
    label: string;
}

export interface FilenameRefactorPlan {
    fileRenames: FilenameRefactorOperation[];
    fileMerges: FilenameRefactorOperation[];
}

export function collectFilenameRefactorOperations(
    renames: FilenameRefactorRename[],
    pages: FilenameRefactorPage[],
    rootUri: vscode.Uri,
    options?: { excludePaths?: string[] },
): FilenameRefactorPlan {
    const excludePaths = new Set((options?.excludePaths ?? []).map(normaliseRelativePathLower));
    const orderedRenames = [...renames].sort(
        (a, b) => wikilinkToken(b.oldPageName).length - wikilinkToken(a.oldPageName).length,
    );

    const desiredPathByCurrentPath = new Map<string, string>();
    const pagesByPath = new Map<string, FilenameRefactorPage>();

    for (const page of pages) {
        const currentPath = normaliseRelativePath(page.path);
        pagesByPath.set(normaliseRelativePathLower(currentPath), page);

        if (excludePaths.has(normaliseRelativePathLower(currentPath))) {
            continue;
        }

        const nextFilename = rewriteFilename(page.filename, orderedRenames);
        if (nextFilename === page.filename) {
            continue;
        }

        const currentDir = path.posix.dirname(currentPath);
        const nextPath = currentDir === '.' ? nextFilename : `${currentDir}/${nextFilename}`;
        if (nextPath !== currentPath) {
            desiredPathByCurrentPath.set(currentPath, nextPath);
        }
    }

    const fileRenames: FilenameRefactorOperation[] = [];
    const fileMerges: FilenameRefactorOperation[] = [];

    for (const [currentPath, desiredPath] of desiredPathByCurrentPath) {
        const targetPage = pagesByPath.get(normaliseRelativePathLower(desiredPath));

        if (targetPage && normaliseRelativePathLower(targetPage.path) !== normaliseRelativePathLower(currentPath)) {
            const targetCurrentPath = normaliseRelativePath(targetPage.path);
            const targetDesiredPath = desiredPathByCurrentPath.get(targetCurrentPath) ?? targetCurrentPath;
            if (normaliseRelativePathLower(targetDesiredPath) === normaliseRelativePathLower(desiredPath)) {
                fileMerges.push(makeOperation(rootUri, currentPath, targetCurrentPath));
                continue;
            }
        }

        fileRenames.push(makeOperation(rootUri, currentPath, desiredPath));
    }

    return {
        fileRenames: orderFileRenameOperations(fileRenames),
        fileMerges,
    };
}

export function orderFileRenameOperations(
    fileRenames: FilenameRefactorOperation[],
): FilenameRefactorOperation[] {
    const remaining = [...fileRenames];
    const ordered: FilenameRefactorOperation[] = [];

    while (remaining.length > 0) {
        let progress = false;

        for (let index = 0; index < remaining.length; index++) {
            const candidate = remaining[index];
            const dependsOnRemaining = remaining.some((other, otherIndex) =>
                otherIndex !== index && sameUri(other.oldUri, candidate.newUri),
            );

            if (!dependsOnRemaining) {
                ordered.push(candidate);
                remaining.splice(index, 1);
                progress = true;
                break;
            }
        }

        if (!progress) {
            ordered.push(...remaining);
            break;
        }
    }

    return ordered;
}

export function remapUrisForFileOperations(
    candidateUris: vscode.Uri[],
    fileRenames: FilenameRefactorOperation[],
    fileMerges: FilenameRefactorOperation[],
): vscode.Uri[] {
    const replacements = new Map<string, vscode.Uri>();
    for (const rename of fileRenames) {
        replacements.set(rename.oldUri.toString().toLowerCase(), rename.newUri);
    }
    for (const merge of fileMerges) {
        replacements.set(merge.oldUri.toString().toLowerCase(), merge.newUri);
    }

    const unique = new Map<string, vscode.Uri>();
    for (const uri of candidateUris) {
        const replacement = replacements.get(uri.toString().toLowerCase()) ?? uri;
        unique.set(replacement.toString().toLowerCase(), replacement);
    }
    return [...unique.values()];
}

function rewriteFilename(
    filename: string,
    renames: FilenameRefactorRename[],
): string {
    const extension = path.extname(filename);
    const basename = extension ? filename.slice(0, -extension.length) : filename;

    let updated = basename;
    for (const rename of renames) {
        updated = updated.split(wikilinkToken(rename.oldPageName)).join(wikilinkToken(rename.newPageName));
    }

    return `${updated}${extension}`;
}

function wikilinkToken(pageName: string): string {
    return `[[${pageName}]]`;
}

function makeOperation(
    rootUri: vscode.Uri,
    oldPath: string,
    newPath: string,
): FilenameRefactorOperation {
    return {
        oldUri: vscode.Uri.joinPath(rootUri, oldPath),
        newUri: vscode.Uri.joinPath(rootUri, newPath),
        label: `${path.posix.basename(oldPath)} → ${path.posix.basename(newPath)}`,
    };
}

function normaliseRelativePath(value: string): string {
    return value.replace(/\\/g, '/');
}

function normaliseRelativePathLower(value: string): string {
    return normaliseRelativePath(value).toLowerCase();
}

function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
    return left.toString().toLowerCase() === right.toString().toLowerCase();
}