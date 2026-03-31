import { describe, expect, it } from 'vitest';
import type { PageRow } from '../IndexService.js';
import {
    getExistingExplorerMergeTargets,
    pickUniqueExplorerMergeTarget,
} from '../WikilinkExplorerMergeService.js';

function page(path: string): PageRow {
    const filename = path.split('/').pop() ?? 'Page.md';
    return {
        id: 1,
        path,
        filename,
        title: filename.replace(/\.md$/i, ''),
        mtime: 0,
        indexed_at: 0,
    };
}

describe('WikilinkExplorerMergeService', () => {
    it('returns the single pre-existing merge target when exactly one exists', () => {
        const pages = [
            page('source/NewName.md'),
            page('target/NewName.md'),
        ];

        expect(pickUniqueExplorerMergeTarget(pages, 'source/NewName.md')?.path).toBe('target/NewName.md');
    });

    it('returns no merge target when there is no pre-existing duplicate', () => {
        const pages = [page('source/NewName.md')];

        expect(pickUniqueExplorerMergeTarget(pages, 'source/NewName.md')).toBeUndefined();
    });

    it('returns no merge target when multiple pre-existing duplicates exist', () => {
        const pages = [
            page('source/NewName.md'),
            page('target-a/NewName.md'),
            page('target-b/NewName.md'),
        ];

        expect(getExistingExplorerMergeTargets(pages, 'source/NewName.md')).toHaveLength(2);
        expect(pickUniqueExplorerMergeTarget(pages, 'source/NewName.md')).toBeUndefined();
    });

    it('normalises path casing and slashes before comparing renamed path', () => {
        const pages = [
            page('Source/NewName.md'),
            page('target/NewName.md'),
        ];

        expect(pickUniqueExplorerMergeTarget(pages, 'source\\newname.md')?.path).toBe('target/NewName.md');
    });
});