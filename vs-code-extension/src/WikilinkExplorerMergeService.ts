import type { PageRow } from './IndexService.js';

function normalisePath(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase();
}

export function getExistingExplorerMergeTargets(
    pages: PageRow[],
    renamedPath: string,
): PageRow[] {
    const renamed = normalisePath(renamedPath);
    return pages.filter((page) => normalisePath(page.path) !== renamed);
}

export function pickUniqueExplorerMergeTarget(
    pages: PageRow[],
    renamedPath: string,
): PageRow | undefined {
    const candidates = getExistingExplorerMergeTargets(pages, renamedPath);
    return candidates.length === 1 ? candidates[0] : undefined;
}