import * as vscode from 'vscode';
import type { IndexService } from './IndexService.js';
import type { LogService } from './LogService.js';
import { NO_OP_LOGGER } from './LogService.js';
import { resolveProviderConfig, storeApiKey, clearApiKey } from './AiProviderService.js';
import { runAgentLoop } from './AiAgentLoop.js';
import type { AiContextGathererDeps } from './AiContextGatherer.js';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage, AgentEvent, AgentLoopResult } from './AiKnowledgeTypes.js';
import * as path from 'path';
import * as fs from 'fs';

export class AiKnowledgePanel {
    public static readonly VIEW_TYPE = 'as-notes.aiKnowledgePanel';
    public static currentPanel: AiKnowledgePanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _logger: LogService;
    private _disposables: vscode.Disposable[] = [];
    private _webviewReady = false;
    private _pendingMessages: unknown[] = [];
    private _abortController: AbortController | undefined;
    private _lastResult: AgentLoopResult | undefined;

    // ── Public API ───────────────────────────────────────────────────────

    public static createOrShow(
        extensionUri: vscode.Uri,
        indexService: IndexService,
        notesRootUri: vscode.Uri,
        context: vscode.ExtensionContext,
        logger?: LogService,
    ): AiKnowledgePanel {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (AiKnowledgePanel.currentPanel) {
            AiKnowledgePanel.currentPanel._panel.reveal(column);
            return AiKnowledgePanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            AiKnowledgePanel.VIEW_TYPE,
            'AI Knowledge',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                ],
            },
        );

        AiKnowledgePanel.currentPanel = new AiKnowledgePanel(
            panel, extensionUri, indexService, notesRootUri, context, logger,
        );
        return AiKnowledgePanel.currentPanel;
    }

    public static revive(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        indexService: IndexService,
        notesRootUri: vscode.Uri,
        context: vscode.ExtensionContext,
        logger?: LogService,
    ): void {
        AiKnowledgePanel.currentPanel = new AiKnowledgePanel(
            panel, extensionUri, indexService, notesRootUri, context, logger,
        );
    }

    /** Trigger a query programmatically (e.g. from context menu). */
    public startQuery(topic: string): void {
        const msg: ExtensionToWebviewMessage = { type: 'startQuery', topic };
        if (this._webviewReady) {
            this._panel.webview.postMessage(msg);
        } else {
            this._pendingMessages.push(msg);
        }
        // Also kick off the actual agent loop
        this._runQuery(topic);
    }

    // ── Constructor ──────────────────────────────────────────────────────

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly _extensionUri: vscode.Uri,
        private readonly _indexService: IndexService,
        private readonly _notesRootUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        logger?: LogService,
    ) {
        this._panel = panel;
        this._logger = logger ?? NO_OP_LOGGER;

        this._setWebviewHtml();

        this._panel.webview.onDidReceiveMessage(
            async (message: WebviewToExtensionMessage) => {
                this._logger.info('aiKnowledgePanel', `Message: ${message.type}`);
                await this._handleMessage(message);
            },
            undefined,
            this._disposables,
        );

        this._panel.onDidDispose(() => this._dispose(), undefined, this._disposables);
    }

    // ── Webview HTML ─────────────────────────────────────────────────────

    private _setWebviewHtml(): void {
        const webview = this._panel.webview;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'ai-knowledge.js'),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'ai-knowledge.css'),
        );

        this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${styleUri}">
    <title>AI Knowledge</title>
</head>
<body>
    <div id="app"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    // ── Message Handlers ─────────────────────────────────────────────────

    private async _handleMessage(message: WebviewToExtensionMessage): Promise<void> {
        switch (message.type) {
            case 'ready':
                this._webviewReady = true;
                for (const msg of this._pendingMessages) {
                    this._panel.webview.postMessage(msg);
                }
                this._pendingMessages = [];
                break;

            case 'query':
                await this._runQuery(message.topic);
                break;

            case 'cancel':
                this._abortController?.abort();
                break;

            case 'createNote':
                await this._createNote();
                break;

            case 'copyToClipboard':
                await this._copyToClipboard();
                break;
        }
    }

    // ── Agent Loop Execution ─────────────────────────────────────────────

    private async _runQuery(topic: string): Promise<void> {
        // Cancel any in-flight query
        this._abortController?.abort();
        this._abortController = new AbortController();

        const config = vscode.workspace.getConfiguration('as-notes');

        // Resolve provider config
        let providerConfig;
        try {
            const provider = config.get<string>('aiProvider', 'openai') as import('./AiKnowledgeTypes.js').AiProviderName;
            const model = config.get<string>('aiModel', 'gpt-4o-mini');
            const baseUrl = config.get<string>('aiBaseUrl', '');
            providerConfig = await resolveProviderConfig(this._context.secrets, provider, model, baseUrl);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this._postToWebview({ type: 'agentEvent', event: { type: 'error', message } });
            return;
        }

        const tokenBudget = config.get<number>('aiContextTokenLimit', 32000);

        const gathererDeps: AiContextGathererDeps = {
            indexService: this._indexService,
            notesRootUri: this._notesRootUri,
        };

        // Stream events to webview
        const onEvent = (event: AgentEvent): void => {
            this._postToWebview({ type: 'agentEvent', event });
        };

        try {
            this._lastResult = await runAgentLoop({
                topic,
                providerConfig,
                gathererDeps,
                tokenBudget,
                onEvent,
                signal: this._abortController.signal,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this._postToWebview({ type: 'agentEvent', event: { type: 'error', message } });
        }
    }

    // ── Create Note ──────────────────────────────────────────────────────

    private async _createNote(): Promise<void> {
        if (!this._lastResult) { return; }

        const config = vscode.workspace.getConfiguration('as-notes');
        const notesFolder = config.get<string>('notesFolder', 'notes');
        const aiSubfolder = config.get<string>('aiOutputSubfolder', 'ai-output');

        const outputDir = path.join(this._notesRootUri.fsPath, notesFolder, aiSubfolder);
        fs.mkdirSync(outputDir, { recursive: true });

        const sanitised = this._lastResult.topic
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `${sanitised} - ${timestamp}.md`;
        const filePath = path.join(outputDir, filename);

        const sections = this._lastResult.sections;
        const content = [
            `# What I Know About ${this._lastResult.topic}`,
            '',
            `*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}*`,
            '',
            sections['first-order'] ? `## Summary\n\n${sections['first-order']}` : '',
            sections['connections'] ? `\n## Connections\n\n${sections['connections']}` : '',
            sections['relationship-map'] ? `\n## Relationship Map\n\n${sections['relationship-map']}` : '',
            sections['gaps'] ? `\n## Knowledge Gaps\n\n${sections['gaps']}` : '',
            sections['synthesis'] ? `\n## Synthesis\n\n${sections['synthesis']}` : '',
            '',
            '---',
            '',
            '### Pages Analysed',
            '',
            ...this._lastResult.pages.map(p => `- [[${p.title}]] (${p.relation}, ${p.hopDistance} hops)`),
        ].filter(Boolean).join('\n');

        const fileUri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
        await vscode.window.showTextDocument(fileUri);

        this._postToWebview({
            type: 'agentEvent',
            event: { type: 'status', message: `Note created: ${filename}` },
        });
    }

    // ── Copy to Clipboard ────────────────────────────────────────────────

    private async _copyToClipboard(): Promise<void> {
        if (!this._lastResult) { return; }

        const sections = this._lastResult.sections;
        const text = [
            `# What I Know About ${this._lastResult.topic}`,
            '',
            sections['first-order'] || '',
            sections['connections'] ? `\n## Connections\n\n${sections['connections']}` : '',
            sections['synthesis'] ? `\n## Synthesis\n\n${sections['synthesis']}` : '',
        ].filter(Boolean).join('\n');

        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('AI Knowledge summary copied to clipboard.');
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private _postToWebview(message: ExtensionToWebviewMessage): void {
        if (this._webviewReady) {
            this._panel.webview.postMessage(message);
        } else {
            this._pendingMessages.push(message);
        }
    }

    // ── Dispose ──────────────────────────────────────────────────────────

    private _dispose(): void {
        this._abortController?.abort();
        AiKnowledgePanel.currentPanel = undefined;
        for (const d of this._disposables) { d.dispose(); }
        this._disposables = [];
    }
}
