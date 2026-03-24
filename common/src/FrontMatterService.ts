/**
 * Lightweight YAML front matter parser for extracting metadata from markdown files.
 *
 * Supports the standard YAML front matter format delimited by `---` fences at
 * the start of the file. Extracts the `aliases` field and general front matter
 * fields used for publishing (public, title, order, description, layout, assets,
 * retina, draft, date).
 *
 * Supports two alias formats:
 *
 * List style:
 * ```yaml
 * ---
 * aliases:
 *   - Alias One
 *   - Alias Two
 * ---
 * ```
 *
 * Inline array style:
 * ```yaml
 * ---
 * aliases: [Alias One, Alias Two]
 * ---
 * ```
 *
 * Alias values are plain strings -- any accidental `[[` or `]]` bracket syntax
 * is stripped automatically.
 */

/** Typed front matter fields for publishing and metadata. */
export interface FrontMatterFields {
    public?: boolean;
    title?: string;
    order?: number;
    description?: string;
    layout?: string;
    assets?: boolean;
    retina?: boolean;
    draft?: boolean;
    date?: string;
    aliases?: string[];
}

export class FrontMatterService {

    /**
     * Extract the raw front matter block from markdown content.
     * Returns the text between the first two `---` lines, or null if
     * no valid front matter block is found.
     *
     * Front matter must start at the very beginning of the file (line 0).
     */
    extractFrontMatter(content: string): string | null {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== '---') {
            return null;
        }

        // Find the closing ---
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                // Return the block between the fences (exclusive of the --- lines)
                return lines.slice(1, i).join('\n');
            }
        }

        return null; // No closing fence found
    }

    /**
     * Strip the front matter block from markdown content.
     * Returns the content after the closing `---` fence.
     * If no front matter exists, returns the original content unchanged.
     */
    stripFrontMatter(content: string): string {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== '---') {
            return content;
        }

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                // Return everything after the closing fence
                return lines.slice(i + 1).join('\n');
            }
        }

        return content; // No closing fence found, return as-is
    }

    /**
     * Parse general front matter fields from markdown content.
     * Returns a typed object with known publishing/metadata fields.
     * Unknown fields are ignored.
     */
    parseFrontMatterFields(content: string): FrontMatterFields {
        const frontMatter = this.extractFrontMatter(content);
        if (!frontMatter) {
            return {};
        }

        const fields: FrontMatterFields = {};
        const lines = frontMatter.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match top-level key: value pairs (not indented list items)
            const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
            if (!kvMatch) {
                continue;
            }

            const key = kvMatch[1].toLowerCase();
            const rawValue = kvMatch[2].trim();

            switch (key) {
                case 'public':
                    fields.public = this.parseBooleanValue(rawValue);
                    break;
                case 'title':
                    fields.title = this.parseStringValue(rawValue);
                    break;
                case 'order':
                    fields.order = this.parseNumberValue(rawValue);
                    break;
                case 'description':
                    fields.description = this.parseStringValue(rawValue);
                    break;
                case 'layout':
                    fields.layout = this.parseStringValue(rawValue);
                    break;
                case 'assets':
                    fields.assets = this.parseBooleanValue(rawValue);
                    break;
                case 'retina':
                    fields.retina = this.parseBooleanValue(rawValue);
                    break;
                case 'draft':
                    fields.draft = this.parseBooleanValue(rawValue);
                    break;
                case 'date':
                    fields.date = this.parseStringValue(rawValue);
                    break;
                case 'aliases':
                    fields.aliases = this.parseAliasesFromLine(rawValue, lines, i);
                    break;
            }
        }

        return fields;
    }

    /**
     * Parse aliases from markdown file content.
     *
     * Extracts the `aliases:` field from the YAML front matter and returns
     * an array of alias name strings. Returns an empty array if no front
     * matter exists or no aliases are defined.
     *
     * Strips any accidental `[[` / `]]` wikilink brackets from alias values.
     */
    parseAliases(content: string): string[] {
        const frontMatter = this.extractFrontMatter(content);
        if (!frontMatter) {
            return [];
        }

        return this.parseAliasesFromFrontMatter(frontMatter);
    }

    /**
     * Parse the aliases field from a front matter block (without the --- fences).
     */
    private parseAliasesFromFrontMatter(frontMatter: string): string[] {
        const lines = frontMatter.split(/\r?\n/);

        // Find the aliases: line
        let aliasLineIndex = -1;
        let aliasLineContent = '';
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/^aliases\s*:\s*(.*)/);
            if (match) {
                aliasLineIndex = i;
                aliasLineContent = match[1].trim();
                break;
            }
        }

        if (aliasLineIndex === -1) {
            return [];
        }

        return this.parseAliasesFromLine(aliasLineContent, lines, aliasLineIndex);
    }

    /**
     * Parse aliases from the value portion of an aliases: line + subsequent lines.
     */
    private parseAliasesFromLine(value: string, lines: string[], lineIndex: number): string[] {
        // Check for inline array: aliases: [Alias One, Alias Two]
        if (value.startsWith('[')) {
            return this.parseInlineArray(value);
        }

        // Check for a single inline value: aliases: Some Alias
        if (value.length > 0) {
            const cleaned = this.cleanAliasValue(value);
            return cleaned ? [cleaned] : [];
        }

        // List style: collect subsequent indented `- item` lines
        return this.parseListItems(lines, lineIndex + 1);
    }

    /**
     * Parse an inline array like `[Alias One, Alias Two]`.
     */
    private parseInlineArray(value: string): string[] {
        // Remove surrounding brackets
        const inner = value.replace(/^\[/, '').replace(/\]$/, '');
        if (inner.trim().length === 0) {
            return [];
        }

        return inner
            .split(',')
            .map(item => this.cleanAliasValue(item.trim()))
            .filter((item): item is string => item !== null && item.length > 0);
    }

    /**
     * Parse list-style items starting from the given line index.
     * Collects lines matching `  - value` until a non-list line is hit.
     */
    private parseListItems(lines: string[], startIndex: number): string[] {
        const aliases: string[] = [];

        for (let i = startIndex; i < lines.length; i++) {
            const match = lines[i].match(/^\s+-\s+(.*)/);
            if (!match) {
                break; // End of list
            }
            const cleaned = this.cleanAliasValue(match[1].trim());
            if (cleaned && cleaned.length > 0) {
                aliases.push(cleaned);
            }
        }

        return aliases;
    }

    /**
     * Clean an alias value by stripping accidental wikilink brackets and
     * surrounding quotes.
     *
     * @returns The cleaned string, or null if the result is empty.
     */
    private cleanAliasValue(value: string): string | null {
        // Strip surrounding quotes (single or double)
        let cleaned = value.replace(/^["']|["']$/g, '');
        // Strip any [[ or ]] bracket syntax
        cleaned = cleaned.replace(/\[\[|\]\]/g, '');
        cleaned = cleaned.trim();
        return cleaned.length > 0 ? cleaned : null;
    }

    /**
     * Parse a boolean value from a YAML string.
     * Recognises `true`, `false`, `yes`, `no` (case-insensitive).
     */
    private parseBooleanValue(value: string): boolean | undefined {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === 'yes') {
            return true;
        }
        if (lower === 'false' || lower === 'no') {
            return false;
        }
        return undefined;
    }

    /**
     * Parse a string value, stripping surrounding quotes.
     */
    private parseStringValue(value: string): string | undefined {
        if (value.length === 0) {
            return undefined;
        }
        // Strip surrounding quotes (single or double)
        return value.replace(/^["']|["']$/g, '').trim() || undefined;
    }

    /**
     * Parse a numeric value.
     */
    private parseNumberValue(value: string): number | undefined {
        const num = Number(value);
        return Number.isFinite(num) ? num : undefined;
    }

    /**
     * Update a specific alias in the front matter of a markdown file.
     * Returns the modified file content, or null if the alias was not found.
     *
     * Handles both list-style and inline array formats.
     */
    updateAlias(content: string, oldAlias: string, newAlias: string): string | null {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== '---') {
            return null;
        }

        // Find closing fence
        let closingIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                closingIndex = i;
                break;
            }
        }
        if (closingIndex === -1) {
            return null;
        }

        // Find the aliases: line within the front matter
        let aliasLineIndex = -1;
        for (let i = 1; i < closingIndex; i++) {
            if (lines[i].match(/^aliases\s*:/)) {
                aliasLineIndex = i;
                break;
            }
        }
        if (aliasLineIndex === -1) {
            return null;
        }

        const aliasLine = lines[aliasLineIndex];
        const afterColon = aliasLine.replace(/^aliases\s*:\s*/, '').trim();

        // Inline array format: aliases: [Alias One, Alias Two]
        if (afterColon.startsWith('[')) {
            const updated = aliasLine.replace(oldAlias, newAlias);
            if (updated === aliasLine) {
                return null; // oldAlias not found
            }
            lines[aliasLineIndex] = updated;
            return lines.join('\n');
        }

        // Single inline value: aliases: Some Alias
        if (afterColon.length > 0 && this.cleanAliasValue(afterColon) === oldAlias) {
            lines[aliasLineIndex] = aliasLine.replace(oldAlias, newAlias);
            return lines.join('\n');
        }

        // List style: find the matching `- oldAlias` line
        for (let i = aliasLineIndex + 1; i < closingIndex; i++) {
            const match = lines[i].match(/^(\s+-\s+)(.*)/);
            if (!match) {
                break;
            }
            const cleaned = this.cleanAliasValue(match[2].trim());
            if (cleaned === oldAlias) {
                lines[i] = match[1] + newAlias;
                return lines.join('\n');
            }
        }

        return null; // alias not found
    }
}
