/**
 * Shared types for the AI Knowledge Assistant feature.
 *
 * Provider configuration, message protocols between extension and webview,
 * agent loop state, and gathered context shapes.
 */

// ── Provider Types ───────────────────────────────────────────────────────

export type AiProviderName = 'openai' | 'anthropic' | 'ollama' | 'openai-compatible' | 'openrouter';

export interface AiProviderConfig {
    provider: AiProviderName;
    model: string;
    baseUrl: string;
    apiKey: string;
}

/** Uniform chat message format used across all providers. */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** A streaming text chunk from the provider. */
export interface StreamChunk {
    text: string;
    done: boolean;
}

// ── Context Gathering Types ──────────────────────────────────────────────

export interface GatheredPage {
    pageId: number;
    path: string;
    filename: string;
    title: string;
    content: string;
    /** How many hops from the query page. 0 = the page itself, 1 = backlinks/forward links, etc. */
    hopDistance: number;
    /** 'direct' | 'backlink' | 'forward' | 'alias' | 'expansion' */
    relation: PageRelation;
}

export type PageRelation = 'direct' | 'backlink' | 'forward' | 'alias' | 'expansion';

export interface GatherResult {
    topic: string;
    pages: GatheredPage[];
    totalTokens: number;
}

// ── Agent Loop Types ─────────────────────────────────────────────────────

export type AgentPassType = 'gather' | 'scan' | 'expand' | 'synthesise';

/**
 * Events emitted by the agent loop to drive the UI.
 * The webview receives these via postMessage to render streaming output.
 */
export type AgentEvent =
    | { type: 'status'; message: string }
    | { type: 'section-start'; section: SectionName; title: string }
    | { type: 'token'; section: SectionName; text: string }
    | { type: 'section-end'; section: SectionName }
    | { type: 'page-gathered'; page: PageSummary }
    | { type: 'expansion-topic'; topic: string }
    | { type: 'complete' }
    | { type: 'error'; message: string }
    | { type: 'cancelled' };

export type SectionName = 'first-order' | 'connections' | 'relationship-map' | 'gaps' | 'synthesis';

export interface PageSummary {
    title: string;
    path: string;
    hopDistance: number;
    relation: PageRelation;
    /** Brief summary produced by that pass's LLM call. */
    summary?: string;
}

export interface AgentLoopResult {
    topic: string;
    sections: Record<SectionName, string>;
    pages: PageSummary[];
    cancelled: boolean;
}

// ── Webview Message Protocol ─────────────────────────────────────────────

/** Messages from the extension host to the webview. */
export type ExtensionToWebviewMessage =
    | { type: 'agentEvent'; event: AgentEvent }
    | { type: 'providerInfo'; provider: AiProviderName; model: string }
    | { type: 'setTopic'; topic: string }
    | { type: 'startQuery'; topic: string };

/** Messages from the webview back to the extension host. */
export type WebviewToExtensionMessage =
    | { type: 'query'; topic: string }
    | { type: 'cancel' }
    | { type: 'createNote' }
    | { type: 'copyToClipboard' }
    | { type: 'navigateTo'; pagePath: string }
    | { type: 'ready' };
