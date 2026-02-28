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

	get pageName(): string {
		// Remove leading and trailing '[[', ']]'
		const pageName = this.linkText.substring(2, this.linkText.length - 2); // Previously 2 + this.linkText.length - 4
		return pageName;
	}

	get pageFileName(): string {
		// Update so file name can be decoded from encoded / escaped characters
		// https://stackoverflow.com/questions/309485/c-sharp-sanitize-file-name
		const invalids = /[\/\?<>\\:\*\|":]/g;
		const pageFilename = this.pageName.replace(invalids, '_');
		return pageFilename;
	}

	get endPositionInText(): number {
		return this.startPositionInText + this.linkText.length - 1;
	}

	get length(): number {
		return this.linkText.length;
	}

	get isFullyConsumed(): boolean {
		return this.charactersConsumed === this.length;
	}

	get startPositionPlusCharactersConsumed(): number {
		return this.startPositionInText + this.charactersConsumed;
	}
}
