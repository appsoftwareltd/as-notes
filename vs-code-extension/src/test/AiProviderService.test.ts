/**
 * Tests for AiProviderService -- provider abstraction, config resolution,
 * API key management, request formatting, and SSE stream parsing.
 *
 * Requirements tested:
 * R1. 5 providers: openai, anthropic, ollama, openai-compatible, openrouter
 * R2. OpenAI/compatible/OpenRouter/Ollama share ChatCompletions adapter
 * R3. Anthropic uses Messages API with separate adapter
 * R4. Ollama has no auth header
 * R5. OpenRouter adds HTTP-Referer + X-Title headers
 * R6. Anthropic uses x-api-key (not Bearer) and anthropic-version header
 * R7. API key stored/retrieved/cleared via SecretStorage interface
 * R8. resolveProviderConfig uses providerdefault base URLs when none given
 * R9. SSE stream parsing handles chunked data correctly
 * R10. Non-200 responses produce AiProviderError with status code
 * R11. Free-text model picker -- model string passed through as-is
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock vscode before any imports that transitively use it
vi.mock('vscode', () => ({}));

import type { AiProviderConfig, ChatMessage, StreamChunk } from '../AiKnowledgeTypes.js';
import {
    resolveProviderConfig,
    storeApiKey,
    clearApiKey,
    streamChatCompletion,
    AiProviderError,
    type AiProviderSecrets,
} from '../AiProviderService.js';

// ── Test Helpers ─────────────────────────────────────────────────────────

function fakeSecrets(stored: Record<string, string> = {}): AiProviderSecrets {
    const store = { ...stored };
    return {
        get: vi.fn((key: string) => Promise.resolve(store[key])),
        store: vi.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
        delete: vi.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
    };
}

function fakeMessages(): ChatMessage[] {
    return [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
    ];
}

/**
 * Build a ReadableStream from SSE text, simulating a server response body.
 */
function sseBody(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(text));
            controller.close();
        },
    });
}

/**
 * Collect all chunks from an AsyncGenerator.
 */
async function collectChunks(gen: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
    const chunks: StreamChunk[] = [];
    for await (const chunk of gen) {
        chunks.push(chunk);
    }
    return chunks;
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
    originalFetch = globalThis.fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('AiProviderService — resolveProviderConfig', () => {
    it('R8: uses default base URL for openai when none provided', async () => {
        const secrets = fakeSecrets({ 'as-notes.aiApiKey': 'sk-test' });
        const config = await resolveProviderConfig(secrets, 'openai', 'gpt-4o', '');

        expect(config.provider).toBe('openai');
        expect(config.model).toBe('gpt-4o');
        expect(config.baseUrl).toContain('api.openai.com');
        expect(config.apiKey).toBe('sk-test');
    });

    it('R8: uses default base URL for anthropic', async () => {
        const secrets = fakeSecrets({ 'as-notes.aiApiKey': 'sk-ant-test' });
        const config = await resolveProviderConfig(secrets, 'anthropic', 'claude-sonnet-4-20250514', '');

        expect(config.baseUrl).toContain('api.anthropic.com');
    });

    it('R8: uses default base URL for ollama (localhost)', async () => {
        const secrets = fakeSecrets();
        const config = await resolveProviderConfig(secrets, 'ollama', 'llama3', '');

        expect(config.baseUrl).toContain('localhost:11434');
    });

    it('R8: uses default base URL for openrouter', async () => {
        const secrets = fakeSecrets({ 'as-notes.aiApiKey': 'or-key' });
        const config = await resolveProviderConfig(secrets, 'openrouter', 'meta-llama/llama-3', '');

        expect(config.baseUrl).toContain('openrouter.ai');
    });

    it('R8: uses user-supplied base URL when provided', async () => {
        const secrets = fakeSecrets();
        const config = await resolveProviderConfig(secrets, 'openai-compatible', 'custom-model', 'https://my-llm.example.com/v1');

        expect(config.baseUrl).toBe('https://my-llm.example.com/v1');
    });

    it('R11: passes model string through as-is (free-text model picker)', async () => {
        const secrets = fakeSecrets();
        const config = await resolveProviderConfig(secrets, 'openai', 'my-fine-tuned-gpt-4o-2024', '');

        expect(config.model).toBe('my-fine-tuned-gpt-4o-2024');
    });

    it('returns empty string for apiKey when no key stored', async () => {
        const secrets = fakeSecrets();
        const config = await resolveProviderConfig(secrets, 'openai', 'gpt-4o', '');

        expect(config.apiKey).toBe('');
    });
});

describe('AiProviderService — storeApiKey / clearApiKey', () => {
    it('R7: storeApiKey stores key via SecretStorage', async () => {
        const secrets = fakeSecrets();
        await storeApiKey(secrets, 'sk-my-new-key');

        expect(secrets.store).toHaveBeenCalledWith('as-notes.aiApiKey', 'sk-my-new-key');
    });

    it('R7: clearApiKey deletes key via SecretStorage', async () => {
        const secrets = fakeSecrets({ 'as-notes.aiApiKey': 'sk-existing' });
        await clearApiKey(secrets);

        expect(secrets.delete).toHaveBeenCalledWith('as-notes.aiApiKey');
    });
});

describe('AiProviderService — streamChatCompletion request formatting', () => {
    function captureFetch(): { calls: Array<{ url: string; options: RequestInit }> } {
        const captured: Array<{ url: string; options: RequestInit }> = [];
        globalThis.fetch = vi.fn(async (url: any, options: any) => {
            captured.push({ url: String(url), options });
            return new Response(sseBody('data: [DONE]\n\n'), {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            });
        }) as any;
        return { calls: captured };
    }

    it('R2: OpenAI sends to /chat/completions with Bearer auth', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
        expect(calls[0].options.headers).toHaveProperty('Authorization', 'Bearer sk-test');
    });

    it('R4: Ollama sends to /chat/completions with NO auth header', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'ollama', model: 'llama3',
            baseUrl: 'http://localhost:11434/v1', apiKey: '',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
        const headers = calls[0].options.headers as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();
    });

    it('R5: OpenRouter adds HTTP-Referer and X-Title headers', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'openrouter', model: 'meta-llama/llama-3',
            baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'or-key',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        const headers = calls[0].options.headers as Record<string, string>;
        expect(headers['HTTP-Referer']).toBeDefined();
        expect(headers['X-Title']).toBe('AS Notes');
        expect(headers['Authorization']).toBe('Bearer or-key');
    });

    it('R3/R6: Anthropic sends to /messages with x-api-key and anthropic-version', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'anthropic', model: 'claude-sonnet-4-20250514',
            baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk-ant-test',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
        const headers = calls[0].options.headers as Record<string, string>;
        expect(headers['x-api-key']).toBe('sk-ant-test');
        expect(headers['anthropic-version']).toBeDefined();
        // Should NOT use Bearer auth
        expect(headers['Authorization']).toBeUndefined();
    });

    it('R3: Anthropic extracts system message into top-level body field', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'anthropic', model: 'claude-sonnet-4-20250514',
            baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk-ant-test',
        };

        const messages: ChatMessage[] = [
            { role: 'system', content: 'Be helpful.' },
            { role: 'user', content: 'Hi!' },
        ];

        await collectChunks(streamChatCompletion(config, messages));

        const body = JSON.parse(calls[0].options.body as string);
        expect(body.system).toBe('Be helpful.');
        // The messages array should not contain the system message
        expect(body.messages.every((m: any) => m.role !== 'system')).toBe(true);
    });

    it('R2: OpenAI-compatible sends to /chat/completions with Bearer auth', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'openai-compatible', model: 'local-model',
            baseUrl: 'https://my-llm.local/v1', apiKey: 'my-key',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        expect(calls[0].url).toBe('https://my-llm.local/v1/chat/completions');
        const headers = calls[0].options.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer my-key');
    });

    it('sends stream: true in the request body', async () => {
        const { calls } = captureFetch();
        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        await collectChunks(streamChatCompletion(config, fakeMessages()));

        const body = JSON.parse(calls[0].options.body as string);
        expect(body.stream).toBe(true);
        expect(body.model).toBe('gpt-4o');
    });
});

describe('AiProviderService — SSE stream parsing', () => {
    it('R9: parses ChatCompletions SSE chunks (OpenAI format)', async () => {
        const sseText = [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}',
            '',
            'data: {"choices":[{"delta":{"content":" world"}}]}',
            '',
            'data: [DONE]',
            '',
        ].join('\n');

        globalThis.fetch = vi.fn(async () =>
            new Response(sseBody(sseText), { status: 200 }),
        ) as any;

        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        const chunks = await collectChunks(streamChatCompletion(config, fakeMessages()));

        const textChunks = chunks.filter(c => !c.done);
        expect(textChunks).toHaveLength(2);
        expect(textChunks[0].text).toBe('Hello');
        expect(textChunks[1].text).toBe(' world');

        const doneChunks = chunks.filter(c => c.done);
        expect(doneChunks.length).toBeGreaterThanOrEqual(1);
    });

    it('R9: parses Anthropic SSE chunks (Messages API format)', async () => {
        const sseText = [
            'data: {"type":"content_block_start","index":0}',
            '',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
            '',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}',
            '',
            'data: [DONE]',
            '',
        ].join('\n');

        globalThis.fetch = vi.fn(async () =>
            new Response(sseBody(sseText), { status: 200 }),
        ) as any;

        const config: AiProviderConfig = {
            provider: 'anthropic', model: 'claude-sonnet-4-20250514',
            baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk-ant-test',
        };

        const chunks = await collectChunks(streamChatCompletion(config, fakeMessages()));

        const textChunks = chunks.filter(c => !c.done && c.text);
        expect(textChunks).toHaveLength(2);
        expect(textChunks[0].text).toBe('Hi');
        expect(textChunks[1].text).toBe(' there');
    });

    it('R9: ignores non-data SSE lines (comments, empty lines)', async () => {
        const sseText = [
            ': this is a comment',
            '',
            'data: {"choices":[{"delta":{"content":"only"}}]}',
            '',
            'data: [DONE]',
            '',
        ].join('\n');

        globalThis.fetch = vi.fn(async () =>
            new Response(sseBody(sseText), { status: 200 }),
        ) as any;

        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        const chunks = await collectChunks(streamChatCompletion(config, fakeMessages()));
        const textChunks = chunks.filter(c => !c.done);
        expect(textChunks).toHaveLength(1);
        expect(textChunks[0].text).toBe('only');
    });
});

describe('AiProviderService — error handling', () => {
    it('R10: throws AiProviderError with status code on non-200 response', async () => {
        globalThis.fetch = vi.fn(async () =>
            new Response('Rate limit exceeded', { status: 429 }),
        ) as any;

        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        await expect(async () => {
            await collectChunks(streamChatCompletion(config, fakeMessages()));
        }).rejects.toThrow(AiProviderError);

        try {
            await collectChunks(streamChatCompletion(config, fakeMessages()));
        } catch (err) {
            expect(err).toBeInstanceOf(AiProviderError);
            expect((err as AiProviderError).statusCode).toBe(429);
            expect((err as AiProviderError).message).toContain('429');
        }
    });

    it('R10: throws AiProviderError for Anthropic non-200 responses', async () => {
        globalThis.fetch = vi.fn(async () =>
            new Response('Unauthorized', { status: 401 }),
        ) as any;

        const config: AiProviderConfig = {
            provider: 'anthropic', model: 'claude-sonnet-4-20250514',
            baseUrl: 'https://api.anthropic.com/v1', apiKey: 'bad-key',
        };

        await expect(async () => {
            await collectChunks(streamChatCompletion(config, fakeMessages()));
        }).rejects.toThrow(AiProviderError);
    });

    it('throws when response body is null', async () => {
        globalThis.fetch = vi.fn(async () => {
            const response = new Response(null, { status: 200 });
            // Force body to be null
            Object.defineProperty(response, 'body', { value: null });
            return response;
        }) as any;

        const config: AiProviderConfig = {
            provider: 'openai', model: 'gpt-4o',
            baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
        };

        await expect(async () => {
            await collectChunks(streamChatCompletion(config, fakeMessages()));
        }).rejects.toThrow();
    });
});
