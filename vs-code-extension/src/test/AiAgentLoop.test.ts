/**
 * Tests for AiAgentLoop -- multi-pass orchestrator.
 *
 * Requirements tested:
 * R1. 4-pass architecture: gather -> scan/summarise -> expand -> synthesise
 * R2. Emits correct AgentEvent sequence for UI rendering
 * R3. Automatic expansion without user confirmation (locked decision)
 * R4. Cancellation via AbortSignal preserves partial output
 * R5. Caps expansion topics at 5 to prevent runaway API costs
 * R6. Extracts [[wikilink]] suggestions from RELATED TOPICS section
 * R7. Section extraction parses markdown headings correctly
 * R8. Empty knowledge base completes immediately with 'complete' event
 * R9. Error events emitted on failure; partial results still returned
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode (not imported directly by AiAgentLoop, but by its deps)
vi.mock('vscode', () => ({
    Uri: {
        joinPath: (...args: unknown[]) => {
            const base = args[0] as { fsPath: string };
            const rest = (args.slice(1) as string[]).join('/');
            return { fsPath: `${base.fsPath}/${rest}` };
        },
    },
    workspace: { fs: { readFile: vi.fn() } },
}));

// Mock the context gatherer
vi.mock('../AiContextGatherer.js', () => ({
    gatherFirstOrderContext: vi.fn(),
    gatherExpansionContext: vi.fn(),
    countTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

// Mock the provider service
vi.mock('../AiProviderService.js', () => ({
    streamChatCompletion: vi.fn(),
}));

import type { AgentEvent, AgentLoopResult, AiProviderConfig, GatheredPage, GatherResult, SectionName } from '../AiKnowledgeTypes.js';
import type { AiContextGathererDeps } from '../AiContextGatherer.js';
import { gatherFirstOrderContext, gatherExpansionContext } from '../AiContextGatherer.js';
import { streamChatCompletion } from '../AiProviderService.js';
import { runAgentLoop, type AgentLoopOptions } from '../AiAgentLoop.js';

// ── Test Helpers ─────────────────────────────────────────────────────────

const mockGatherFirst = gatherFirstOrderContext as ReturnType<typeof vi.fn>;
const mockGatherExpansion = gatherExpansionContext as ReturnType<typeof vi.fn>;
const mockStreamChat = streamChatCompletion as ReturnType<typeof vi.fn>;

function fakeProviderConfig(): AiProviderConfig {
    return { provider: 'openai', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key' };
}

function fakeDeps(): AiContextGathererDeps {
    return {
        indexService: {} as AiContextGathererDeps['indexService'],
        notesRootUri: { fsPath: '/workspace' } as any,
    };
}

function makePage(id: number, filename: string, hopDistance: number, relation: GatheredPage['relation']): GatheredPage {
    return {
        pageId: id,
        path: `notes/${filename}`,
        filename,
        title: filename.replace('.md', ''),
        content: `Content of ${filename.replace('.md', '')}`,
        hopDistance,
        relation,
    };
}

function defaultOptions(events: AgentEvent[], signal?: AbortSignal): AgentLoopOptions {
    return {
        topic: 'TypeScript',
        providerConfig: fakeProviderConfig(),
        gathererDeps: fakeDeps(),
        tokenBudget: 100_000,
        onEvent: (e) => events.push(e),
        signal,
    };
}

/**
 * Mock streamChatCompletion to yield text chunks, then done.
 * Takes a full response string and yields it as a single chunk then done.
 */
function mockStreamResponse(response: string): void {
    mockStreamChat.mockImplementation(async function* () {
        yield { text: response, done: false };
        yield { text: '', done: true };
    });
}

/**
 * Mock streamChatCompletion with a sequence of responses for each LLM call.
 * The nth call to streamChatCompletion gets the nth response.
 */
function mockStreamResponses(responses: string[]): void {
    let callIndex = 0;
    mockStreamChat.mockImplementation(async function* () {
        const response = responses[callIndex++] ?? '';
        yield { text: response, done: false };
        yield { text: '', done: true };
    });
}

function emptyGatherResult(topic: string): GatherResult {
    return { topic, pages: [], totalTokens: 0 };
}

function gatherResultWithPages(topic: string, pages: GatheredPage[]): GatherResult {
    const totalTokens = pages.reduce((sum, p) => sum + Math.ceil(p.content.length / 4), 0);
    return { topic, pages, totalTokens };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('AiAgentLoop — runAgentLoop', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGatherExpansion.mockResolvedValue([]);
    });

    describe('R8: Empty knowledge base', () => {
        it('completes immediately when no pages found, emitting status + complete', async () => {
            mockGatherFirst.mockResolvedValue(emptyGatherResult('TypeScript'));
            const events: AgentEvent[] = [];

            const result = await runAgentLoop(defaultOptions(events));

            expect(result.cancelled).toBe(false);
            expect(result.pages).toHaveLength(0);

            // Must emit a complete event
            expect(events.some(e => e.type === 'complete')).toBe(true);
            // Should include a "no notes found" status
            expect(events.some(e => e.type === 'status' && e.message.includes('No notes found'))).toBe(true);
        });
    });

    describe('R1/R2: 4-pass architecture and event flow', () => {
        it('runs gather -> scan -> synthesise for a topic with only first-order pages', async () => {
            const directPage = makePage(1, 'TypeScript.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('TypeScript', [directPage]));

            // Scan response with no RELATED TOPICS (so no expansion)
            const scanResponse = 'TypeScript is a typed JS superset. The user knows about strict mode and generics.';
            // Synthesis response
            const synthesisResponse = '## SYNTHESIS\nComprehensive analysis.\n\n## RELATIONSHIP MAP\n- TypeScript\n\n## KNOWLEDGE GAPS\n- No notes on decorators';

            mockStreamResponses([scanResponse, synthesisResponse]);

            const events: AgentEvent[] = [];
            const result = await runAgentLoop(defaultOptions(events));

            // Verify 4-pass sequence by event types
            const eventTypes = events.map(e => e.type);

            // Pass 1: gather -- should emit status, page-gathered, status
            expect(eventTypes.includes('page-gathered')).toBe(true);

            // Pass 2: scan -- should emit section-start(first-order), tokens, section-end
            expect(events.some(e => e.type === 'section-start' && e.section === 'first-order')).toBe(true);
            expect(events.some(e => e.type === 'section-end' && e.section === 'first-order')).toBe(true);

            // Pass 4: synthesise -- should emit section-start(synthesis), tokens, section-end
            expect(events.some(e => e.type === 'section-start' && e.section === 'synthesis')).toBe(true);
            expect(events.some(e => e.type === 'section-end' && e.section === 'synthesis')).toBe(true);

            // Complete
            expect(events[events.length - 1].type).toBe('complete');

            // Result contains sections
            expect(result.sections['first-order']).toBe(scanResponse);
            expect(result.sections['synthesis']).toBe(synthesisResponse);
            expect(result.cancelled).toBe(false);
        });

        it('runs all 4 passes when scan suggests expansion topics', async () => {
            const directPage = makePage(1, 'TypeScript.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('TypeScript', [directPage]));

            const expansionPage = makePage(5, 'React.md', 2, 'expansion');
            mockGatherExpansion.mockResolvedValue([expansionPage]);

            // Pass 2: scan with RELATED TOPICS containing [[React]]
            const scanResponse = 'Summary of TypeScript.\n\n## RELATED TOPICS\n- [[React]]\n- [[Node.js]]';
            // Pass 3: expansion summary
            const expansionResponse = 'React connects to TypeScript via JSX type checking.';
            // Pass 4: synthesis
            const synthesisResponse = '## SYNTHESIS\nFull analysis.\n\n## RELATIONSHIP MAP\n- TypeScript\n  - React\n\n## KNOWLEDGE GAPS\n- Missing info on Deno';

            mockStreamResponses([scanResponse, expansionResponse, synthesisResponse]);

            const events: AgentEvent[] = [];
            const result = await runAgentLoop(defaultOptions(events));

            // Pass 3 should emit expansion-topic events
            expect(events.some(e => e.type === 'expansion-topic' && e.topic === 'React')).toBe(true);
            expect(events.some(e => e.type === 'expansion-topic' && e.topic === 'Node.js')).toBe(true);

            // Pass 3 should emit connections section
            expect(events.some(e => e.type === 'section-start' && e.section === 'connections')).toBe(true);

            // Result should include expansion page
            expect(result.pages.some(p => p.title === 'React')).toBe(true);
            expect(result.pages.some(p => p.relation === 'expansion')).toBe(true);

            // Relationship map should be extracted
            expect(result.sections['relationship-map']).toContain('TypeScript');
            expect(result.sections['gaps']).toContain('Deno');
        });
    });

    describe('R3: Automatic expansion', () => {
        it('expands automatically without requiring user confirmation', async () => {
            const directPage = makePage(1, 'Topic.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('Topic', [directPage]));
            mockGatherExpansion.mockResolvedValue([]);

            // Scan suggests a topic -- expansion should happen automatically
            const scanResponse = '## RELATED TOPICS\n- [[SubTopic]]';
            mockStreamResponses([scanResponse, 'synthesis']);

            const events: AgentEvent[] = [];
            await runAgentLoop(defaultOptions(events));

            // gatherExpansionContext should have been called (auto-expand)
            expect(mockGatherExpansion).toHaveBeenCalled();
            // No "ask user" style events should exist
            expect(events.every(e => e.type !== 'error')).toBe(true);
        });
    });

    describe('R4: Cancellation preserves partial output', () => {
        it('returns partial sections and cancelled=true when aborted during scan', async () => {
            const directPage = makePage(1, 'Topic.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('Topic', [directPage]));

            const controller = new AbortController();

            // Stream some text then abort
            mockStreamChat.mockImplementation(async function* () {
                yield { text: 'Partial scan output', done: false };
                controller.abort();
                // The next yield simulates the generator being consumed after abort
                // The loop should check cancellation between passes
                yield { text: '', done: true };
            });

            const events: AgentEvent[] = [];
            const result = await runAgentLoop(defaultOptions(events, controller.signal));

            expect(result.cancelled).toBe(true);
            // The partial first-order content should be preserved
            expect(result.sections['first-order']).toContain('Partial scan output');
            // A cancelled event should be emitted
            expect(events.some(e => e.type === 'cancelled')).toBe(true);
        });
    });

    describe('R5: Cap expansion topics at 5', () => {
        it('limits expansion to at most 5 topics even when more are suggested', async () => {
            const directPage = makePage(1, 'BigTopic.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('BigTopic', [directPage]));
            mockGatherExpansion.mockResolvedValue([]);

            // LLM suggests 8 topics
            const scanResponse = `Summary.\n\n## RELATED TOPICS\n- [[A]]\n- [[B]]\n- [[C]]\n- [[D]]\n- [[E]]\n- [[F]]\n- [[G]]\n- [[H]]`;
            mockStreamResponses([scanResponse, 'synthesis']);

            const events: AgentEvent[] = [];
            await runAgentLoop(defaultOptions(events));

            // Check the expansion topics emitted -- should be at most 5
            const expansionTopicEvents = events.filter(e => e.type === 'expansion-topic');
            expect(expansionTopicEvents.length).toBeLessThanOrEqual(5);

            // gatherExpansionContext should be called with at most 5 topics
            if (mockGatherExpansion.mock.calls.length > 0) {
                const topicsArg = mockGatherExpansion.mock.calls[0][0] as string[];
                expect(topicsArg.length).toBeLessThanOrEqual(5);
            }
        });
    });

    describe('R9: Error handling', () => {
        it('emits an error event when LLM call fails, returns partial results', async () => {
            const directPage = makePage(1, 'Topic.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('Topic', [directPage]));

            mockStreamChat.mockImplementation(async function* () {
                throw new Error('API rate limit exceeded');
            });

            const events: AgentEvent[] = [];
            const result = await runAgentLoop(defaultOptions(events));

            // An error event should be emitted
            expect(events.some(e => e.type === 'error' && e.message.includes('rate limit'))).toBe(true);
            // Partial results preserved (pages gathered before error)
            expect(result.pages).toHaveLength(1);
            expect(result.cancelled).toBe(false);
        });

        it('emits an error event when context gathering fails', async () => {
            mockGatherFirst.mockRejectedValue(new Error('Database corrupted'));

            const events: AgentEvent[] = [];
            const result = await runAgentLoop(defaultOptions(events));

            expect(events.some(e => e.type === 'error' && e.message.includes('Database corrupted'))).toBe(true);
            expect(result.cancelled).toBe(false);
        });
    });

    describe('R2: Event ordering', () => {
        it('emits page-gathered for each discovered page', async () => {
            const directPage = makePage(1, 'Main.md', 0, 'direct');
            const backlinkPage = makePage(2, 'Related.md', 1, 'backlink');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('Main', [directPage, backlinkPage]));

            mockStreamResponse('Simple summary. No expansion.');

            // Need a synthesis response too
            mockStreamResponses(['Simple summary.', 'Synthesis.']);

            const events: AgentEvent[] = [];
            await runAgentLoop(defaultOptions(events));

            const pageEvents = events.filter(e => e.type === 'page-gathered');
            expect(pageEvents).toHaveLength(2);
            expect((pageEvents[0] as any).page.title).toBe('Main');
            expect((pageEvents[1] as any).page.title).toBe('Related');
        });

        it('emits events in correct order: status -> page-gathered -> section-start -> tokens -> section-end -> complete', async () => {
            const directPage = makePage(1, 'Topic.md', 0, 'direct');
            mockGatherFirst.mockResolvedValue(gatherResultWithPages('Topic', [directPage]));

            mockStreamResponses(['Summary.', '## SYNTHESIS\nDone.\n\n## RELATIONSHIP MAP\n- Topic\n\n## KNOWLEDGE GAPS\n- None']);

            const events: AgentEvent[] = [];
            await runAgentLoop(defaultOptions(events));

            const types = events.map(e => e.type);

            // Status must come first
            expect(types[0]).toBe('status');

            // Complete must come last
            expect(types[types.length - 1]).toBe('complete');

            // section-start must come before its section-end
            const firstOrderStart = types.indexOf('section-start');
            const firstSectionEnd = types.indexOf('section-end');
            expect(firstOrderStart).toBeLessThan(firstSectionEnd);
        });
    });
});

describe('AiAgentLoop — parseTopicSuggestions (integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGatherExpansion.mockResolvedValue([]);
    });

    it('R6: extracts [[wikilink]] suggestions from RELATED TOPICS section', async () => {
        const directPage = makePage(1, 'AI.md', 0, 'direct');
        mockGatherFirst.mockResolvedValue(gatherResultWithPages('AI', [directPage]));

        const scanResponse = `Good summary of AI knowledge.

## RELATED TOPICS
- [[Machine Learning]]
- [[Neural Networks]]
- [[GPT Architecture]]
`;
        mockStreamResponses([scanResponse, 'Synthesis.']);

        const events: AgentEvent[] = [];
        await runAgentLoop(defaultOptions(events));

        const topicEvents = events.filter(e => e.type === 'expansion-topic');
        const topicNames = topicEvents.map(e => (e as { type: 'expansion-topic'; topic: string }).topic);
        expect(topicNames).toContain('Machine Learning');
        expect(topicNames).toContain('Neural Networks');
        expect(topicNames).toContain('GPT Architecture');
    });

    it('R6: handles responses with no RELATED TOPICS section gracefully', async () => {
        const directPage = makePage(1, 'Simple.md', 0, 'direct');
        mockGatherFirst.mockResolvedValue(gatherResultWithPages('Simple', [directPage]));

        const scanResponse = 'Just a plain summary. No wikilinks here.';
        mockStreamResponses([scanResponse, 'Synthesis.']);

        const events: AgentEvent[] = [];
        const result = await runAgentLoop(defaultOptions(events));

        // No expansion should happen
        const topicEvents = events.filter(e => e.type === 'expansion-topic');
        expect(topicEvents).toHaveLength(0);
        expect(result.cancelled).toBe(false);
    });
});
