/**
 * Represents a wikilink parsed from markdown text.
 *
 * A wikilink is text enclosed in double square brackets, e.g. `[[Page Name]]`.
 * Wikilinks can be nested: `[[Outer [[Inner]] Link]]` contains both an outer
 * and inner wikilink.
 *
 * Positions are relative to the input string passed to the parser.
 */
export class Wikilink {
    public linkText: string;
    public children: Wikilink[];
    public startPositionInText: number;
    public charactersConsumed: number;

    constructor(linkText: string, startPositionInText: number = 0) {
        this.linkText = linkText;
        this.children = [];
        this.startPositionInText = startPositionInText;
        this.charactersConsumed = 0;
    }

    /** The page name with outer `[[` and `]]` removed. Inner brackets are retained. */
    get pageName(): string {
        return this.linkText.substring(2, this.linkText.length - 2);
    }

    /**
     * The sanitised filename derived from `pageName`.
     * Characters invalid in filenames (`/ ? < > \ : * | "`) are replaced with `_`.
     */
    get pageFileName(): string {
        const invalids = /[\/\?<>\\:\*\|":]/g;
        return this.pageName.replace(invalids, '_');
    }

    /** Inclusive end position in the input text. */
    get endPositionInText(): number {
        return this.startPositionInText + this.linkText.length - 1;
    }

    /** Total character length of the wikilink text (including brackets). */
    get length(): number {
        return this.linkText.length;
    }

    /** Whether all characters in this wikilink have been consumed during processing. */
    get isFullyConsumed(): boolean {
        return this.charactersConsumed === this.length;
    }

    /** Start position offset by the number of characters already consumed. */
    get startPositionPlusCharactersConsumed(): number {
        return this.startPositionInText + this.charactersConsumed;
    }
}
