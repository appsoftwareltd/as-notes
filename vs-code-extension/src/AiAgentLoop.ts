/**
 * AI Agent Loop -- multi-pass orchestrator that drives the knowledge
 * assistant through gather/scan/expand/synthesise passes.
 *
 * Emits AgentEvent progress events for the UI via a callback.
 * Supports cancellation via AbortSignal.
 */

import type {
    AgentEvent,
    AgentLoopResult,
    AiProviderConfig,
    ChatMessage,
    GatheredPage,
    PageSummary,
    SectionName,
} from './AiKnowledgeTypes';
import { streamChatCompletion } from './AiProviderService';
import {
    gatherFirstOrderContext,
    gatherExpansionContext,
    countTokens,
    type AiContextGathererDeps,
} from './AiContextGatherer';

// ── Public API ───────────────────────────────────────────────────────────

export interface AgentLoopOptions {
    topic: string;
    providerConfig: AiProviderConfig;
    gathererDeps: AiContextGathererDeps;
    tokenBudget: number;
    onEvent: (event: AgentEvent) => void;
    signal?: AbortSignal;
}

/**
 * Run the full multi-pass agent loop:
 * 1. GATHER first-order context from the wikilink graph
 * 2. SCAN & SUMMARISE first-order pages (LLM call per batch)
 * 3. EXPAND to second/third-order via LLM-suggested topics
 * 4. SYNTHESISE all gathered knowledge into a final summary
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const { topic, providerConfig, gathererDeps, tokenBudget, onEvent, signal } = options;

    const sections: Record<SectionName, string> = {
        'first-order': '',
        'connections': '',
        'relationship-map': '',
        'gaps': '',
        'synthesis': '',
    };
    const allPages: PageSummary[] = [];

    try {
        // ── Pass 1: GATHER first-order context ───────────────────────────
        onEvent({ type: 'status', message: `Gathering notes related to "${topic}"...` });

        const gatherResult = await gatherFirstOrderContext(topic, gathererDeps, tokenBudget);

        if (gatherResult.pages.length === 0) {
            onEvent({ type: 'status', message: `No notes found related to "${topic}".` });
            onEvent({ type: 'complete' });
            return { topic, sections, pages: [], cancelled: false };
        }

        for (const page of gatherResult.pages) {
            const summary: PageSummary = {
                title: page.title,
                path: page.path,
                hopDistance: page.hopDistance,
                relation: page.relation,
            };
            allPages.push(summary);
            onEvent({ type: 'page-gathered', page: summary });
        }

        onEvent({
            type: 'status',
            message: `Found ${gatherResult.pages.length} related notes (${gatherResult.totalTokens} tokens). Analysing...`,
        });

        checkCancelled(signal);

        // ── Pass 2: SCAN & SUMMARISE first-order ─────────────────────────
        onEvent({ type: 'section-start', section: 'first-order', title: 'First-Order Summary' });

        const { summary: firstOrderSummary, suggestedTopics } = await scanAndSummarise(
            topic,
            gatherResult.pages,
            providerConfig,
            (text) => {
                sections['first-order'] += text;
                onEvent({ type: 'token', section: 'first-order', text });
            },
            signal,
        );

        sections['first-order'] = firstOrderSummary;
        onEvent({ type: 'section-end', section: 'first-order' });

        checkCancelled(signal);

        // ── Pass 3: EXPAND to second/third-order ─────────────────────────
        let expansionPages: GatheredPage[] = [];
        if (suggestedTopics.length > 0) {
            onEvent({
                type: 'status',
                message: `Exploring ${suggestedTopics.length} related topics: ${suggestedTopics.join(', ')}`,
            });

            for (const t of suggestedTopics) {
                onEvent({ type: 'expansion-topic', topic: t });
            }

            const existingPageIds = new Set(gatherResult.pages.map(p => p.pageId));
            expansionPages = await gatherExpansionContext(
                suggestedTopics,
                gathererDeps,
                Math.floor(tokenBudget / 2), // Use half budget for expansion
                existingPageIds,
            );

            for (const page of expansionPages) {
                const summary: PageSummary = {
                    title: page.title,
                    path: page.path,
                    hopDistance: page.hopDistance,
                    relation: page.relation,
                };
                allPages.push(summary);
                onEvent({ type: 'page-gathered', page: summary });
            }

            checkCancelled(signal);

            if (expansionPages.length > 0) {
                onEvent({ type: 'section-start', section: 'connections', title: 'Discovered Connections' });

                const connectionsSummary = await summariseExpansions(
                    topic,
                    expansionPages,
                    suggestedTopics,
                    providerConfig,
                    (text) => {
                        sections['connections'] += text;
                        onEvent({ type: 'token', section: 'connections', text });
                    },
                    signal,
                );

                sections['connections'] = connectionsSummary;
                onEvent({ type: 'section-end', section: 'connections' });
            }
        }

        checkCancelled(signal);

        // ── Pass 4: SYNTHESISE ───────────────────────────────────────────
        onEvent({ type: 'section-start', section: 'synthesis', title: 'Synthesis' });

        const allGathered = [...gatherResult.pages, ...expansionPages];
        const synthesisResult = await synthesise(
            topic,
            allGathered,
            sections['first-order'],
            sections['connections'],
            providerConfig,
            (text) => {
                sections['synthesis'] += text;
                onEvent({ type: 'token', section: 'synthesis', text });
            },
            signal,
        );

        sections['synthesis'] = synthesisResult.synthesis;
        sections['relationship-map'] = synthesisResult.relationshipMap;
        sections['gaps'] = synthesisResult.gaps;

        onEvent({ type: 'section-end', section: 'synthesis' });

        // Emit relationship map and gaps as separate sections
        if (sections['relationship-map']) {
            onEvent({ type: 'section-start', section: 'relationship-map', title: 'Relationship Map' });
            onEvent({ type: 'token', section: 'relationship-map', text: sections['relationship-map'] });
            onEvent({ type: 'section-end', section: 'relationship-map' });
        }

        if (sections['gaps']) {
            onEvent({ type: 'section-start', section: 'gaps', title: 'Knowledge Gaps' });
            onEvent({ type: 'token', section: 'gaps', text: sections['gaps'] });
            onEvent({ type: 'section-end', section: 'gaps' });
        }

        onEvent({ type: 'complete' });
        return { topic, sections, pages: allPages, cancelled: false };

    } catch (err: unknown) {
        if (err instanceof CancellationError) {
            onEvent({ type: 'cancelled' });
            return { topic, sections, pages: allPages, cancelled: true };
        }
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: 'error', message });
        return { topic, sections, pages: allPages, cancelled: false };
    }
}

// ── LLM Call: Scan & Summarise ───────────────────────────────────────────

async function scanAndSummarise(
    topic: string,
    pages: GatheredPage[],
    config: AiProviderConfig,
    onToken: (text: string) => void,
    signal?: AbortSignal,
): Promise<{ summary: string; suggestedTopics: string[] }> {
    const pageContext = pages.map(p =>
        `## ${p.title} (${p.relation}, ${p.hopDistance} hop${p.hopDistance !== 1 ? 's' : ''})\n\n${p.content}`,
    ).join('\n\n---\n\n');

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: SCAN_SYSTEM_PROMPT,
        },
        {
            role: 'user',
            content: `Topic: "${topic}"\n\nHere are the user's notes related to this topic:\n\n${pageContext}`,
        },
    ];

    let fullResponse = '';
    for await (const chunk of streamChatCompletion(config, messages, signal)) {
        if (chunk.done) { break; }
        fullResponse += chunk.text;
        onToken(chunk.text);
    }

    // Parse suggested topics from the response
    const suggestedTopics = parseTopicSuggestions(fullResponse);

    return { summary: fullResponse, suggestedTopics };
}

// ── LLM Call: Summarise Expansions ───────────────────────────────────────

async function summariseExpansions(
    topic: string,
    expansionPages: GatheredPage[],
    suggestedTopics: string[],
    config: AiProviderConfig,
    onToken: (text: string) => void,
    signal?: AbortSignal,
): Promise<string> {
    const pageContext = expansionPages.map(p =>
        `## ${p.title} (${p.relation}, ${p.hopDistance} hops)\n\n${p.content}`,
    ).join('\n\n---\n\n');

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: EXPANSION_SYSTEM_PROMPT,
        },
        {
            role: 'user',
            content: `Original topic: "${topic}"\nExpanded topics: ${suggestedTopics.join(', ')}\n\nHere are the expanded notes:\n\n${pageContext}`,
        },
    ];

    let fullResponse = '';
    for await (const chunk of streamChatCompletion(config, messages, signal)) {
        if (chunk.done) { break; }
        fullResponse += chunk.text;
        onToken(chunk.text);
    }

    return fullResponse;
}

// ── LLM Call: Synthesise ─────────────────────────────────────────────────

async function synthesise(
    topic: string,
    allPages: GatheredPage[],
    firstOrderSummary: string,
    connectionsSummary: string,
    config: AiProviderConfig,
    onToken: (text: string) => void,
    signal?: AbortSignal,
): Promise<{ synthesis: string; relationshipMap: string; gaps: string }> {
    const pageList = allPages.map(p =>
        `- ${p.title} (${p.relation}, ${p.hopDistance} hop${p.hopDistance !== 1 ? 's' : ''})`,
    ).join('\n');

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: SYNTHESIS_SYSTEM_PROMPT,
        },
        {
            role: 'user',
            content: [
                `Topic: "${topic}"`,
                '',
                `Pages analysed:\n${pageList}`,
                '',
                `First-order summary:\n${firstOrderSummary}`,
                connectionsSummary ? `\nDiscovered connections:\n${connectionsSummary}` : '',
            ].join('\n'),
        },
    ];

    let fullResponse = '';
    for await (const chunk of streamChatCompletion(config, messages, signal)) {
        if (chunk.done) { break; }
        fullResponse += chunk.text;
        onToken(chunk.text);
    }

    // Parse structured sections from the synthesis response
    const relationshipMap = extractSection(fullResponse, 'RELATIONSHIP MAP');
    const gaps = extractSection(fullResponse, 'KNOWLEDGE GAPS');

    return { synthesis: fullResponse, relationshipMap, gaps };
}

// ── System Prompts ───────────────────────────────────────────────────────

const SCAN_SYSTEM_PROMPT = `You are a knowledge assistant analysing a user's personal notes. Your job is to synthesise what the user knows about a given topic based on their notes.

Instructions:
1. Read all the provided notes carefully.
2. Produce a clear, well-structured summary of what the user knows about the topic. Group by themes where appropriate.
3. For each key point, note which page(s) it comes from.
4. At the end, include a section called "RELATED TOPICS" with a bullet list of other topics the user might want to explore. These should be topics mentioned or strongly implied in the notes but not the main topic itself. Format each as a wikilink: [[Topic Name]].
5. Be concise but thorough. Preserve the user's own terminology and phrasing where possible.
6. Do not invent information that isn't in the notes.`;

const EXPANSION_SYSTEM_PROMPT = `You are a knowledge assistant examining second and third-order connections in a user's personal notes.

Instructions:
1. Analyse the expanded notes and explain how they connect to the original topic.
2. Highlight any surprising or non-obvious connections between topics.
3. Explain the chain of connections: "Topic A connects to Topic B through [shared concept/reference]."
4. Focus on insights the user might not have realised from reading their notes individually.
5. Do not invent connections that aren't supported by the note content.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge assistant producing a final synthesis of everything a user knows about a topic, based on analysis of their personal notes.

Instructions:
1. Produce a comprehensive synthesis of the user's knowledge, integrating first-order and expanded content.
2. Include a section titled "## RELATIONSHIP MAP" showing how topics connect, formatted as an indented list:
   - Main Topic
     - Direct Connection 1
       - Sub-connection
     - Direct Connection 2
3. Include a section titled "## KNOWLEDGE GAPS" listing areas where the user's notes are thin or could benefit from more exploration.
4. Be direct and useful. This should help the user see their knowledge from a higher vantage point.
5. Preserve the user's own terminology. Do not add information not present in the notes.`;

// ── Helpers ──────────────────────────────────────────────────────────────

function parseTopicSuggestions(response: string): string[] {
    const topics: string[] = [];
    // Look for [[wikilink]] style references in the RELATED TOPICS section
    const relatedSection = extractSection(response, 'RELATED TOPICS');
    const wikilinkPattern = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikilinkPattern.exec(relatedSection)) !== null) {
        const topic = match[1].trim();
        if (topic) { topics.push(topic); }
    }
    // Cap at 5 expansion topics to avoid runaway API calls
    return topics.slice(0, 5);
}

function extractSection(text: string, heading: string): string {
    const pattern = new RegExp(`#{1,3}\\s*${escapeRegex(heading)}\\s*\\n`, 'i');
    const match = pattern.exec(text);
    if (!match) { return ''; }

    const startIdx = match.index + match[0].length;
    // Find the next heading at the same or higher level
    const nextHeading = /^#{1,3}\s+/m.exec(text.slice(startIdx));
    const endIdx = nextHeading ? startIdx + nextHeading.index : text.length;

    return text.slice(startIdx, endIdx).trim();
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkCancelled(signal?: AbortSignal): void {
    if (signal?.aborted) { throw new CancellationError(); }
}

class CancellationError extends Error {
    constructor() { super('Cancelled'); this.name = 'CancellationError'; }
}
