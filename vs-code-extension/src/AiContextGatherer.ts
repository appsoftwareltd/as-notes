/**
 * AI Context Gatherer -- traverses the wikilink/backlink graph to collect
 * pages related to a topic, reads their content, and chunks it within
 * token budgets.
 *
 * Uses IndexService for graph queries and vscode.workspace.fs for file reads.
 * Token counting uses js-tiktoken for accuracy.
 */

import * as vscode from 'vscode';
import { encodingForModel, type TiktokenEncoding } from 'js-tiktoken';
import type { IndexService, PageRow, BacklinkEntry, LinkRow } from './IndexService';
import type { GatheredPage, GatherResult, PageRelation } from './AiKnowledgeTypes';

// ── Public API ───────────────────────────────────────────────────────────

export interface AiContextGathererDeps {
    indexService: IndexService;
    notesRootUri: vscode.Uri;
}

/**
 * Gather first-order context for a topic: the direct page, its backlinks,
 * and its forward links. Reads file content and respects the token budget.
 */
export async function gatherFirstOrderContext(
    topic: string,
    deps: AiContextGathererDeps,
    tokenBudget: number,
): Promise<GatherResult> {
    const { indexService } = deps;
    const pages: GatheredPage[] = [];
    const seenPageIds = new Set<number>();

    // 1. Resolve the direct page (by filename or alias)
    const resolved = indexService.resolvePageByFilename(toFilename(topic));
    if (resolved) {
        const directPage = resolved.page;
        seenPageIds.add(directPage.id);

        const content = await readPageContent(directPage, deps);
        pages.push({
            pageId: directPage.id,
            path: directPage.path,
            filename: directPage.filename,
            title: directPage.title,
            content,
            hopDistance: 0,
            relation: resolved.viaAlias ? 'alias' : 'direct',
        });

        // 2. Backlinks (pages that link TO this page)
        const backlinks = indexService.getBacklinksIncludingAliases(directPage.id);
        for (const bl of backlinks) {
            if (seenPageIds.has(bl.sourcePage.id)) { continue; }
            seenPageIds.add(bl.sourcePage.id);

            const blContent = await readPageContent(bl.sourcePage, deps);
            pages.push({
                pageId: bl.sourcePage.id,
                path: bl.sourcePage.path,
                filename: bl.sourcePage.filename,
                title: bl.sourcePage.title,
                content: blContent,
                hopDistance: 1,
                relation: 'backlink',
            });
        }

        // 3. Forward links (pages that this page links to)
        const forwardLinks = indexService.getLinksForPage(directPage.id);
        for (const fl of forwardLinks) {
            const fResolved = indexService.resolvePageByFilename(fl.page_filename);
            if (!fResolved || seenPageIds.has(fResolved.page.id)) { continue; }
            seenPageIds.add(fResolved.page.id);

            const flContent = await readPageContent(fResolved.page, deps);
            pages.push({
                pageId: fResolved.page.id,
                path: fResolved.page.path,
                filename: fResolved.page.filename,
                title: fResolved.page.title,
                content: flContent,
                hopDistance: 1,
                relation: 'forward',
            });
        }
    }

    // Trim pages to fit token budget
    const trimmedPages = trimToTokenBudget(pages, tokenBudget);
    const totalTokens = trimmedPages.reduce((sum, p) => sum + countTokens(p.content), 0);

    return { topic, pages: trimmedPages, totalTokens };
}

/**
 * Expand context by gathering pages related to additional topics discovered
 * during the scan pass. Excludes pages already seen.
 */
export async function gatherExpansionContext(
    topics: string[],
    deps: AiContextGathererDeps,
    tokenBudget: number,
    excludePageIds: Set<number>,
): Promise<GatheredPage[]> {
    const { indexService } = deps;
    const pages: GatheredPage[] = [];
    const seenPageIds = new Set<number>(excludePageIds);

    for (const topic of topics) {
        const resolved = indexService.resolvePageByFilename(toFilename(topic));
        if (!resolved || seenPageIds.has(resolved.page.id)) { continue; }
        seenPageIds.add(resolved.page.id);

        const content = await readPageContent(resolved.page, deps);
        pages.push({
            pageId: resolved.page.id,
            path: resolved.page.path,
            filename: resolved.page.filename,
            title: resolved.page.title,
            content,
            hopDistance: 2,
            relation: 'expansion',
        });

        // Also gather backlinks for expanded topics (third-order)
        const backlinks = indexService.getBacklinksIncludingAliases(resolved.page.id);
        for (const bl of backlinks) {
            if (seenPageIds.has(bl.sourcePage.id)) { continue; }
            seenPageIds.add(bl.sourcePage.id);

            const blContent = await readPageContent(bl.sourcePage, deps);
            pages.push({
                pageId: bl.sourcePage.id,
                path: bl.sourcePage.path,
                filename: bl.sourcePage.filename,
                title: bl.sourcePage.title,
                content: blContent,
                hopDistance: 3,
                relation: 'expansion',
            });
        }
    }

    return trimToTokenBudget(pages, tokenBudget);
}

// ── Token Counting ───────────────────────────────────────────────────────

let _encoder: ReturnType<typeof encodingForModel> | undefined;

function getEncoder(): ReturnType<typeof encodingForModel> {
    if (!_encoder) {
        // cl100k_base covers GPT-4, GPT-4o, Claude, and most current models
        _encoder = encodingForModel('gpt-4o' as Parameters<typeof encodingForModel>[0]);
    }
    return _encoder;
}

export function countTokens(text: string): number {
    if (!text) { return 0; }
    try {
        return getEncoder().encode(text).length;
    } catch {
        // Fallback: rough heuristic if encoder fails
        return Math.ceil(text.length / 4);
    }
}

// ── Internal Helpers ─────────────────────────────────────────────────────

async function readPageContent(page: PageRow, deps: AiContextGathererDeps): Promise<string> {
    try {
        const fileUri = vscode.Uri.joinPath(deps.notesRootUri, page.path);
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        return new TextDecoder().decode(bytes);
    } catch {
        return '';
    }
}

function toFilename(topic: string): string {
    // If the topic doesn't have a .md extension, add it
    const trimmed = topic.trim();
    return trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
}

/**
 * Trim the list of pages to fit within a token budget.
 * Prioritises by hop distance (closer pages first), then by content length
 * (shorter pages first within the same distance to maximise coverage).
 */
function trimToTokenBudget(pages: GatheredPage[], budget: number): GatheredPage[] {
    // Sort: hop distance ascending, then content length ascending
    const sorted = [...pages].sort((a, b) => {
        if (a.hopDistance !== b.hopDistance) { return a.hopDistance - b.hopDistance; }
        return a.content.length - b.content.length;
    });

    const result: GatheredPage[] = [];
    let usedTokens = 0;

    for (const page of sorted) {
        const pageTokens = countTokens(page.content);
        if (usedTokens + pageTokens > budget) {
            if (page.hopDistance === 0) {
                // Always include the direct page, truncated if needed
                const truncated = truncateToTokens(page.content, budget - usedTokens);
                result.push({ ...page, content: truncated });
                usedTokens += countTokens(truncated);
            }
            continue;
        }
        result.push(page);
        usedTokens += pageTokens;
    }

    return result;
}

function truncateToTokens(text: string, maxTokens: number): string {
    if (maxTokens <= 0) { return ''; }
    try {
        const encoder = getEncoder();
        const tokens = encoder.encode(text);
        if (tokens.length <= maxTokens) { return text; }
        const truncated = tokens.slice(0, maxTokens);
        return encoder.decode(truncated);
    } catch {
        // Fallback: character-based truncation
        const maxChars = maxTokens * 4;
        return text.slice(0, maxChars) + '\n\n[...truncated]';
    }
}
