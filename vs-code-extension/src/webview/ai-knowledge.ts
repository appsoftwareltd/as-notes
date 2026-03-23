/**
 * AI Knowledge webview client.
 * Runs as an IIFE inside the VS Code webview.
 */

import { marked } from 'marked';

// ── Types (mirror the extension-side message types) ──────────────────────────

interface PageSummary {
    title: string;
    path: string;
    hopDistance: number;
    relation: string;
}

type AgentEvent =
    | { type: 'status'; message: string }
    | { type: 'page-gathered'; page: PageSummary }
    | { type: 'expansion-topic'; topic: string }
    | { type: 'section-start'; section: string; title: string }
    | { type: 'token'; section: string; text: string }
    | { type: 'section-end'; section: string }
    | { type: 'error'; message: string }
    | { type: 'complete' }
    | { type: 'cancelled' };

type ExtensionMessage =
    | { type: 'agentEvent'; event: AgentEvent }
    | { type: 'startQuery'; topic: string };

// ── VS Code API ──────────────────────────────────────────────────────────────

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ── State ────────────────────────────────────────────────────────────────────

let isRunning = false;
const sectionContent: Record<string, string> = {};
const gatheredPages: PageSummary[] = [];
const expansionTopics: string[] = [];

// Configure marked for safe rendering
marked.setOptions({
    breaks: true,
    gfm: true,
});

// ── DOM Setup ────────────────────────────────────────────────────────────────

const app = document.getElementById('app')!;
app.innerHTML = `
    <div class="ai-header">
        <h1>AI Knowledge Assistant</h1>
        <div class="ai-search-row">
            <input id="topic-input" class="ai-search-input" type="text"
                   placeholder="What do you want to know about? e.g. Project Architecture" />
            <button id="search-btn" class="ai-btn">Search</button>
            <button id="cancel-btn" class="ai-btn ai-btn-secondary" style="display:none">Cancel</button>
        </div>
    </div>
    <div id="status-area" class="ai-status"></div>
    <div id="pages-area" class="ai-pages" style="display:none">
        <div class="ai-pages-header">Pages analysed:</div>
        <div id="pages-tags"></div>
    </div>
    <div id="expansion-area" class="ai-expansion-topics" style="display:none"></div>
    <div id="sections-area"></div>
    <div id="actions-area" class="ai-actions" style="display:none">
        <button id="create-note-btn" class="ai-btn">Create Note</button>
        <button id="copy-btn" class="ai-btn ai-btn-secondary">Copy to Clipboard</button>
    </div>
`;

const topicInput = document.getElementById('topic-input') as HTMLInputElement;
const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const statusArea = document.getElementById('status-area')!;
const pagesArea = document.getElementById('pages-area')!;
const pagesTags = document.getElementById('pages-tags')!;
const expansionArea = document.getElementById('expansion-area')!;
const sectionsArea = document.getElementById('sections-area')!;
const actionsArea = document.getElementById('actions-area')!;
const createNoteBtn = document.getElementById('create-note-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;

// ── Event Handlers ───────────────────────────────────────────────────────────

searchBtn.addEventListener('click', () => {
    const topic = topicInput.value.trim();
    if (!topic) { return; }
    startSearch(topic);
});

topicInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
        const topic = topicInput.value.trim();
        if (!topic) { return; }
        startSearch(topic);
    }
});

cancelBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
});

createNoteBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'createNote' });
});

copyBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'copyToClipboard' });
});

function startSearch(topic: string): void {
    // Reset UI
    resetOutput();
    setRunning(true);
    vscode.postMessage({ type: 'query', topic });
}

function resetOutput(): void {
    statusArea.textContent = '';
    statusArea.className = 'ai-status';
    pagesArea.style.display = 'none';
    pagesTags.innerHTML = '';
    expansionArea.style.display = 'none';
    expansionArea.innerHTML = '';
    sectionsArea.innerHTML = '';
    actionsArea.style.display = 'none';
    gatheredPages.length = 0;
    expansionTopics.length = 0;
    for (const key of Object.keys(sectionContent)) {
        delete sectionContent[key];
    }
}

function setRunning(running: boolean): void {
    isRunning = running;
    searchBtn.disabled = running;
    topicInput.disabled = running;
    cancelBtn.style.display = running ? '' : 'none';
}

// ── Message Handling ─────────────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
    const message = event.data;

    switch (message.type) {
        case 'startQuery':
            topicInput.value = message.topic;
            resetOutput();
            setRunning(true);
            break;

        case 'agentEvent':
            handleAgentEvent(message.event);
            break;
    }
});

function handleAgentEvent(event: AgentEvent): void {
    switch (event.type) {
        case 'status':
            statusArea.innerHTML = `<span class="ai-spinner"></span>${escapeHtml(event.message)}`;
            statusArea.className = 'ai-status';
            break;

        case 'page-gathered': {
            gatheredPages.push(event.page);
            pagesArea.style.display = '';
            const tag = document.createElement('span');
            tag.className = 'ai-page-tag';
            tag.textContent = event.page.title;
            tag.title = `${event.page.relation} (${event.page.hopDistance} hops) - ${event.page.path}`;
            pagesTags.appendChild(tag);
            break;
        }

        case 'expansion-topic': {
            expansionTopics.push(event.topic);
            expansionArea.style.display = '';
            const tag = document.createElement('span');
            tag.className = 'ai-expansion-tag';
            tag.textContent = `[[${event.topic}]]`;
            expansionArea.appendChild(tag);
            break;
        }

        case 'section-start': {
            const section = document.createElement('div');
            section.className = 'ai-section';
            section.id = `section-${event.section}`;

            const title = document.createElement('div');
            title.className = 'ai-section-title';
            title.textContent = event.title;

            const content = document.createElement('div');
            content.className = 'ai-section-content';
            content.id = `section-content-${event.section}`;

            section.appendChild(title);
            section.appendChild(content);
            sectionsArea.appendChild(section);

            sectionContent[event.section] = '';
            break;
        }

        case 'token': {
            sectionContent[event.section] = (sectionContent[event.section] || '') + event.text;
            const contentEl = document.getElementById(`section-content-${event.section}`);
            if (contentEl) {
                contentEl.innerHTML = marked.parse(sectionContent[event.section]) as string;
            }
            break;
        }

        case 'section-end':
            // Final render of the section
            if (sectionContent[event.section]) {
                const contentEl = document.getElementById(`section-content-${event.section}`);
                if (contentEl) {
                    contentEl.innerHTML = marked.parse(sectionContent[event.section]) as string;
                }
            }
            break;

        case 'error':
            statusArea.textContent = event.message;
            statusArea.className = 'ai-status error';
            setRunning(false);
            break;

        case 'complete':
            statusArea.innerHTML = `Completed - analysed ${gatheredPages.length} pages`;
            statusArea.className = 'ai-status';
            setRunning(false);
            actionsArea.style.display = '';
            break;

        case 'cancelled':
            statusArea.textContent = 'Query cancelled. Partial results shown above.';
            statusArea.className = 'ai-status';
            setRunning(false);
            // Still show actions if we have partial results
            if (Object.keys(sectionContent).some(k => sectionContent[k])) {
                actionsArea.style.display = '';
            }
            break;
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Init ─────────────────────────────────────────────────────────────────────

vscode.postMessage({ type: 'ready' });
