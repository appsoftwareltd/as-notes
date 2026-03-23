/**
 * AI Provider Service -- provider abstraction layer for LLM API calls.
 *
 * Two adapter implementations:
 * 1. ChatCompletionsAdapter -- OpenAI, OpenRouter, OpenAI-compatible, Ollama
 * 2. AnthropicAdapter -- Anthropic Messages API
 *
 * All providers expose a common streaming interface. API keys are managed
 * via VS Code SecretStorage.
 */

import type { AiProviderConfig, AiProviderName, ChatMessage, StreamChunk } from './AiKnowledgeTypes';

const SECRET_AI_API_KEY = 'as-notes.aiApiKey';

const DEFAULT_BASE_URLS: Record<AiProviderName, string> = {
    'openai': 'https://api.openai.com/v1',
    'anthropic': 'https://api.anthropic.com/v1',
    'ollama': 'http://localhost:11434/v1',
    'openai-compatible': '',
    'openrouter': 'https://openrouter.ai/api/v1',
};

// ── Public API ───────────────────────────────────────────────────────────

export interface AiProviderSecrets {
    get(key: string): Thenable<string | undefined>;
    store(key: string, value: string): Thenable<void>;
    delete(key: string): Thenable<void>;
}

/**
 * Resolve the full provider config from VS Code settings + stored secrets.
 */
export async function resolveProviderConfig(
    secrets: AiProviderSecrets,
    provider: AiProviderName,
    model: string,
    baseUrl: string,
): Promise<AiProviderConfig> {
    const apiKey = await secrets.get(SECRET_AI_API_KEY) ?? '';
    const effectiveBaseUrl = baseUrl || DEFAULT_BASE_URLS[provider] || '';
    return { provider, model, baseUrl: effectiveBaseUrl, apiKey };
}

export async function storeApiKey(secrets: AiProviderSecrets, key: string): Promise<void> {
    await secrets.store(SECRET_AI_API_KEY, key);
}

export async function clearApiKey(secrets: AiProviderSecrets): Promise<void> {
    await secrets.delete(SECRET_AI_API_KEY);
}

/**
 * Stream a chat completion from the configured provider.
 * Yields StreamChunk objects. The caller should watch for `done: true`.
 *
 * @param signal - AbortSignal for cancellation support.
 */
export async function* streamChatCompletion(
    config: AiProviderConfig,
    messages: ChatMessage[],
    signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
    if (config.provider === 'anthropic') {
        yield* streamAnthropic(config, messages, signal);
    } else {
        yield* streamChatCompletions(config, messages, signal);
    }
}

// ── Chat Completions Adapter (OpenAI, OpenRouter, OpenAI-compatible, Ollama) ─

async function* streamChatCompletions(
    config: AiProviderConfig,
    messages: ChatMessage[],
    signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Auth: Ollama needs none; OpenRouter adds HTTP-Referer; others use Bearer
    if (config.provider !== 'ollama' && config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    if (config.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://asnotes.io';
        headers['X-Title'] = 'AS Notes';
    }

    const body = JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AiProviderError(
            `${config.provider} API error (${response.status}): ${errorText}`,
            response.status,
        );
    }

    if (!response.body) {
        throw new AiProviderError(`${config.provider}: no response body`, 0);
    }

    yield* parseSseStream(response.body, parseChatCompletionChunk);
}

function parseChatCompletionChunk(data: string): string | null {
    if (data === '[DONE]') { return null; }
    try {
        const parsed = JSON.parse(data);
        return parsed.choices?.[0]?.delta?.content ?? null;
    } catch {
        return null;
    }
}

// ── Anthropic Adapter ────────────────────────────────────────────────────

async function* streamAnthropic(
    config: AiProviderConfig,
    messages: ChatMessage[],
    signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/messages`;

    // Extract system message (Anthropic uses a top-level 'system' field)
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
    };
    if (config.apiKey) {
        headers['x-api-key'] = config.apiKey;
    }

    const body: Record<string, unknown> = {
        model: config.model,
        messages: chatMessages,
        max_tokens: 4096,
        stream: true,
    };
    if (systemMsg) {
        body.system = systemMsg.content;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AiProviderError(
            `Anthropic API error (${response.status}): ${errorText}`,
            response.status,
        );
    }

    if (!response.body) {
        throw new AiProviderError('Anthropic: no response body', 0);
    }

    yield* parseSseStream(response.body, parseAnthropicChunk);
}

function parseAnthropicChunk(data: string): string | null {
    try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            return parsed.delta.text ?? null;
        }
        return null;
    } catch {
        return null;
    }
}

// ── SSE Stream Parser ────────────────────────────────────────────────────

async function* parseSseStream(
    body: ReadableStream<Uint8Array>,
    parseDataLine: (data: string) => string | null,
): AsyncGenerator<StreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep incomplete last line in buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) { continue; }

                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') {
                    yield { text: '', done: true };
                    return;
                }

                const text = parseDataLine(data);
                if (text) {
                    yield { text, done: false };
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    yield { text: '', done: true };
}

// ── Error Type ───────────────────────────────────────────────────────────

export class AiProviderError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = 'AiProviderError';
    }
}
