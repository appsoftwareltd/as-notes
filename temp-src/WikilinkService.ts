// src/lib/WikilinkService.ts

// export interface Wikilink {
// 	LinkText: string;
// 	StartPositionInText: number;
// 	Children?: Wikilink[];
// }
import { Wikilink } from './Wikilink';

export interface IWikilinkService {
	extractWikilinks(input: string, recurseChildren: boolean, orderWikilinks: boolean): Wikilink[];
}

export class WikilinkService {
	extractWikilinks(input: string, recurseChildren: boolean = false, orderWikilinks: boolean = true): Wikilink[] {
		const wikilinkResults = new Set<Wikilink>();
		const stack: number[] = [];

		// Get "top level" wikilinks (Top level wikilinks can contain nested wikilinks)

		for (let i = 0; i < input.length; i++) {
			// stack.Count % 2 == 1 conditions ascertain that we are waiting
			// for a completing bracket ('[' or ']'). If we were not waiting for a completing bracket
			// we should not look behind (thus consuming this as completing bracket), but we can consume
			// if we look ahead and find this is part of a new pair.

			// i == 0                                   - at start of string
			// i > 0 && input[i - 1]                    - previous character (checking we are not at start of string)
			// i < input.Length - 1 && input[i + 1]     - next character (checking we are not at end of string)
			// stack.Count % 2                          - we have balancing bracket pairs (having skipped any lone brackets based on above

			// TODO: Think this is actually working and expected results were incorrect (how could we expect it to work backwards
			// to include additional brackets on non balanced

			// TODO: Consider exporting string positions also for linking process

			if (input[i] === '[' && (i === 0 || (i > 0 && input[i - 1] === '[' && stack.length % 2 === 1) || (i < input.length - 1 && input[i + 1] === '['))) {
				stack.push(i);
			} else if (
				stack.length > 0 &&
				input[i] === ']' &&
				(i === input.length - 1 || (i > 0 && input[i - 1] === ']' && stack.length % 2 === 1) || (i < input.length - 1 && input[i + 1] === ']'))
			) {
				const startIndex = stack.pop()!;

				if (startIndex + 1 < input.length && input[startIndex + 1] === '[' && input[i - 1] === ']') {
					const length = i - startIndex + 1;
					// Check is valid wiki link (stack is even showing (consumed push / pop) brackets balance) and
					// our string starts and ends with bracket pairs [[ ]].
					if (stack.length % 2 === 0 && input.substring(startIndex, startIndex + length).startsWith('[[') && input.substring(startIndex, startIndex + length).endsWith(']]')) {
						const wikilink = new Wikilink(input.substring(startIndex, startIndex + length), startIndex);

						if (recurseChildren) {
							const innerContent = wikilink.linkText.substring(2, wikilink.linkText.length - 2); // Previously 2 + wikilink.linkText.length - 4
							wikilink.children = this.extractWikilinks(innerContent);
						}

						wikilinkResults.add(wikilink);
					}
				}
			}
		}

		// Order by length descending to ease replacement in text for HTML, and then
		// in ascending alphabetical order for predictable, testable ordering

		let extractWikilinks: Wikilink[];

		if (orderWikilinks) {
			extractWikilinks = Array.from(wikilinkResults).sort((a, b) => b.linkText.length - a.linkText.length || a.linkText.localeCompare(b.linkText));
		} else {
			extractWikilinks = Array.from(wikilinkResults);
		}

		return extractWikilinks;
	}
}
