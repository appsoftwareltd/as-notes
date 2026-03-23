import type { WikilinkResolverFn } from 'as-notes-common';

export function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export interface PageEntry {
    name: string;
    href: string;
    title?: string;
    order?: number;
    date?: string;
    description?: string;
}

/**
 * Flat-file wikilink resolver for HTML conversion.
 *
 * Builds a case-insensitive lookup map from markdown filenames to HTML hrefs.
 * Resolves wikilink page names to relative `.html` links.
 * Tracks missing targets so placeholder pages can be generated.
 */
export class FileResolver {
    private readonly lookup: Map<string, string>;
    private readonly originalNames: Map<string, string>;
    private readonly missingTargets: Map<string, string>;

    constructor(filenames: string[]) {
        this.lookup = new Map();
        this.originalNames = new Map();
        this.missingTargets = new Map();

        for (const filename of filenames) {
            const name = filename.replace(/\.md$/i, '');
            const key = name.toLowerCase();
            this.lookup.set(key, name);
            this.originalNames.set(key, name);
        }
    }

    resolve(pageFileName: string): string {
        const key = pageFileName.toLowerCase();
        const originalName = this.lookup.get(key);

        if (originalName) {
            return slugify(originalName) + '.html';
        }

        // Track the missing target (deduplicate by lowercase key, keep first casing)
        if (!this.missingTargets.has(key)) {
            this.missingTargets.set(key, pageFileName);
        }

        return slugify(pageFileName) + '.html';
    }

    createResolverFn(): WikilinkResolverFn {
        return (pageFileName: string, _env: Record<string, any>): string => {
            return this.resolve(pageFileName);
        };
    }

    getMissingTargets(): Set<string> {
        return new Set(this.missingTargets.values());
    }

    listPages(): PageEntry[] {
        const entries: PageEntry[] = [];

        for (const [_key, name] of this.originalNames) {
            entries.push({
                name,
                href: slugify(name) + '.html',
            });
        }

        // index first, then alphabetical
        entries.sort((a, b) => {
            if (a.name === 'index') return -1;
            if (b.name === 'index') return 1;
            return a.name.localeCompare(b.name);
        });

        return entries;
    }
}
