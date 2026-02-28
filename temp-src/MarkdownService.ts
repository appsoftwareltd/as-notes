import type { Wikilink } from './Wikilink';
import type { IWikilinkService } from './WikilinkService';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

export interface IMarkdownService {
	convertMarkdownToHtml(markdown: string, parseInline: boolean): string;
}

export class MarkdownService {
	private readonly wikilinkService: IWikilinkService;

	constructor(wikilinkService: IWikilinkService) {
		this.wikilinkService = wikilinkService;
	}

	public convertMarkdownToHtml(markdown: string, parseInline: boolean = false): string {
		if (!markdown || markdown.trim() === '') {
			return '';
		}

		// Convert wikilinks to HTML first

		const wikilinkConvertedHtml = this.convertWikiLinksToHtml(markdown);

		// Convert the markdown (with wikilinks converted) to HTML

		// parseInline avoids surrounding <p> tags. If async is true, it will return a promise.

		const createMarked = function () {
			const marked = new Marked(
				// Use the marked-highlight plugin to highlight code blocks.

				// Docs: https://marked.js.org/using_advanced#highlight
				// Docs: https://highlightjs.org/

				// The stylesheets for the highlight.js themes are included in the npm package. More styles
				// can be found under node_modules/highlight.js/styles. THis is imported in +layout.svelte

				markedHighlight({
					langPrefix: 'hljs language-',
					highlight(code, lang, info) {
						const language = hljs.getLanguage(lang) ? lang : 'plaintext';

						console.log('###language:', language, lang);
						return hljs.highlight(code, { language }).value;
					}
				})
			);

			return marked;
		};

		let html: string | null = null;

		if (parseInline) {
			// Parsing inline uses marked.parseInline which does not support headings and will not wrap the output in a <p> tag.

			// Check if the wikilinkConvertedHtml is a heading, and if so simpy wrap the wikilinkConvertedHtml without further processing

			if (wikilinkConvertedHtml.startsWith('#')) {
				// Count the number of leading hashes to determine the heading level

				let headingLevel = 0;

				while (wikilinkConvertedHtml[headingLevel] === '#') {
					headingLevel++;
				}

				// Only convert to a heading if heading level is less than 6 and the next character is a space

				if (headingLevel <= 6 && wikilinkConvertedHtml[headingLevel] === ' ') {
					// Skip the space character and wrap the heading text in the appropriate heading tag

					html = `<h${headingLevel}>${wikilinkConvertedHtml.substring(headingLevel + 1)}</h${headingLevel}>`;
				}
			}

			// If no heading was created, convert the markdown to HTML

			if (!html) {
				const markedInstance = createMarked();

				html = markedInstance.parseInline(wikilinkConvertedHtml, { async: false, gfm: true, breaks: true });
			}
		} else {
			const markedInstance = createMarked();

			html = markedInstance.parse(wikilinkConvertedHtml, { async: false, gfm: true, breaks: true });
		}

		return html;
	}

	public convertWikiLinksToHtml(markdown: string): string {
		if (!markdown || markdown.trim() === '') {
			return '';
		}

		// Extract wikilinks from the markdown
		let wikiLinks = this.wikilinkService.extractWikilinks(markdown, false, false);

		// Loop through the links consuming characters up until the boundary of the next link,
		// repeating and skipping consumed characters each time until all are consumed

		if (wikiLinks.length === 0) {
			// No wikilinks found, return the markdown as is
			return markdown;
		}

		const htmlStringBuilder: string[] = [];

		// Order by their start position as this is going to be the order in which we process
		wikiLinks = wikiLinks.sort((a: Wikilink, b: Wikilink) => a.startPositionInText - b.startPositionInText);

		let markdownIndex = 0;

		while (markdownIndex < markdown.length) {
			// Test if the current index represents a position outside of any wikilink start / end position
			// (and so is just plain markdown)

			if (
				wikiLinks.every(
					(x: Wikilink) =>
						(x.startPositionInText < markdownIndex && x.endPositionInText < markdownIndex) || (x.startPositionInText > markdownIndex && x.endPositionInText > markdownIndex)
				)
			) {
				htmlStringBuilder.push(markdown[markdownIndex]);
				markdownIndex++;
			} else {
				while (wikiLinks.some((x: Wikilink) => !x.isFullyConsumed && x.startPositionInText >= markdownIndex)) {
					// Reassign to remove any fully processed wikilinks for efficiency
					wikiLinks = wikiLinks.filter((x: Wikilink) => !x.isFullyConsumed && x.startPositionInText >= markdownIndex);

					for (let wikiLinkIndex = 0; wikiLinkIndex < wikiLinks.length; wikiLinkIndex++) {
						const currentWikilink = wikiLinks[wikiLinkIndex];

						if (!currentWikilink.isFullyConsumed) {
							// Identify the next wikilink accounting for any characters already consumed in the current wikilink
							const nextWikilink = wikiLinks.find((x: Wikilink) => x.startPositionInText > currentWikilink.startPositionInText && !x.isFullyConsumed);

							let hyperlinkHtml: string;
							let resetLoop = false;

							if (nextWikilink && nextWikilink.startPositionInText < currentWikilink.endPositionInText) {
								// We have a sub-wikilink within the current one, consume characters up to the start of the
								// sub-wikilink (nextWikilink)

								const parseLength = nextWikilink.startPositionInText - currentWikilink.startPositionPlusCharactersConsumed;

								// Check that next wikilink follows the currentWikilink.StartPositionPlusCharactersConsumed. If it does not
								// this indicates that we need to process unconsumed text from a wikilink later in the order (but within this wikilink)
								// Example: The quick brown fox [[[[[[Mount]] Escape]] [[[[BJJ]] Systems]]]] jumped over the lazy sleeping dog

								if (parseLength > 0) {
									hyperlinkHtml = markdown.substring(currentWikilink.startPositionPlusCharactersConsumed, nextWikilink.startPositionInText);
								} else {
									// Skip to next item
									continue;
								}
							} else {
								// There are no sub-wikilinks, consume the full wikilink text.
								hyperlinkHtml = markdown.substring(
									currentWikilink.startPositionPlusCharactersConsumed,
									currentWikilink.startPositionPlusCharactersConsumed + currentWikilink.length - currentWikilink.charactersConsumed
								);

								// Reset loop so that any outer links can be checked for remaining character consumption
								// (that may appear before the next link). We're going to go back over links that have not been fully consumed
								// to check for link text between sub-wikilinks.
								resetLoop = true;
							}

							// Wikilinks that cover the current text portion (including currentWikilink) need character consumption incrementing
							// so we know not to append the next again
							const wikiLinksCoveringThisLink = wikiLinks.filter(
								(x: Wikilink) => x.startPositionInText <= currentWikilink.startPositionInText && x.endPositionInText >= currentWikilink.endPositionInText
							);

							for (const link of wikiLinksCoveringThisLink) {
								link.charactersConsumed += hyperlinkHtml.length;
							}

							// Move markdownIndex on to account for length of hyperlinkHtml.
							markdownIndex += hyperlinkHtml.length;

							htmlStringBuilder.push(`<a href="#${currentWikilink.pageName}">${hyperlinkHtml}</a>`);

							// There are more links to append, but before we get to them there is plain markdown
							// as all links covering this position are fully consumed

							// Test if we have a next wikilink (if not the text will be completed by simple character appending at
							// the top).
							if (nextWikilink && wikiLinksCoveringThisLink.every((x: Wikilink) => x.charactersConsumed === x.length)) {
								const nextCharacterIndex = markdownIndex;

								const markdownFollowingLink = markdown.substring(nextCharacterIndex, nextWikilink.startPositionInText);

								htmlStringBuilder.push(markdownFollowingLink);

								markdownIndex += markdownFollowingLink.length;
							}

							if (resetLoop) {
								wikiLinkIndex = -1;
							}
						}
					}
				}
			}
		}

		return htmlStringBuilder.join('');
	}
}