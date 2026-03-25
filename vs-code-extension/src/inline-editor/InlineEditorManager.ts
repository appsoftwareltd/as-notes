import * as vscode from 'vscode';
import { Decorator } from './decorator';
import { MarkdownLinkProvider } from './link-provider';
import { MarkdownImageHoverProvider } from './image-hover-provider';
import { MarkdownLinkHoverProvider } from './link-hover-provider';
import { CodeBlockHoverProvider } from './code-block-hover-provider';
import { LinkClickHandler } from './link-click-handler';
import { normalizeAnchorText } from './position-mapping';
import { config } from './config';
import { MarkdownParser } from './parser';
import { MarkdownParseCache } from './markdown-parse-cache';
import { initMermaidRenderer, disposeMermaidRenderer } from './mermaid/mermaid-renderer';

/**
 * Manages the inline Markdown editor (Typora-like syntax shadowing).
 *
 * Derived from markdown-inline-editor-vscode by SeardnaSchmid,
 * based on markdown-inline-preview-vscode by Adam Jones (domdomegg).
 * Both licensed under MIT. See LICENCE-THIRD-PARTY.md for details.
 */
export class InlineEditorManager implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly decorator: Decorator;
    private readonly parseCache: MarkdownParseCache;
    private readonly linkClickHandler: LinkClickHandler;

    constructor(
        context: vscode.ExtensionContext,
        markdownSelector: vscode.DocumentSelector,
    ) {
        // Mermaid renderer needs context for webview
        initMermaidRenderer(context);

        // Detect conflicting extensions
        InlineEditorManager.warnConflictingExtensions();

        const parser = new MarkdownParser();
        this.parseCache = new MarkdownParseCache(parser);
        this.decorator = new Decorator(this.parseCache);

        const diffViewApplyDecorations = config.diffView.applyDecorations();
        this.decorator.updateDiffViewDecorationSetting(!diffViewApplyDecorations);
        this.decorator.setActiveEditor(vscode.window.activeTextEditor);

        // Check if inline editor is enabled
        const inlineEditorEnabled = vscode.workspace
            .getConfiguration('as-notes.inlineEditor')
            .get<boolean>('enabled', true);
        if (!inlineEditorEnabled) {
            this.decorator.toggleDecorations(); // starts enabled, so toggle to disable
        }

        // Link provider
        const linkProvider = new MarkdownLinkProvider(this.parseCache);
        this.disposables.push(
            vscode.languages.registerDocumentLinkProvider(markdownSelector, linkProvider),
        );

        // Hover providers
        this.disposables.push(
            vscode.languages.registerHoverProvider(
                markdownSelector,
                new MarkdownImageHoverProvider(this.parseCache),
            ),
            vscode.languages.registerHoverProvider(
                markdownSelector,
                new MarkdownLinkHoverProvider(this.parseCache),
            ),
            vscode.languages.registerHoverProvider(
                markdownSelector,
                new CodeBlockHoverProvider(this.parseCache),
            ),
        );

        // Link click handler
        this.linkClickHandler = new LinkClickHandler(this.parseCache);
        this.linkClickHandler.setEnabled(config.links.singleClickOpen());

        // Toggle command
        this.disposables.push(
            vscode.commands.registerCommand('as-notes.toggleInlineEditor', () => {
                const enabled = this.decorator.toggleDecorations();
                vscode.window.showInformationMessage(
                    `AS Notes: Inline editor ${enabled ? 'enabled' : 'disabled'}`,
                );
            }),
        );

        // Navigate to anchor command
        this.disposables.push(
            vscode.commands.registerCommand(
                'as-notes.navigateToAnchor',
                async (anchor: string, documentUri: string) => {
                    const uri = vscode.Uri.parse(documentUri);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(document);
                    const text = document.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const headingMatch = lines[i].match(/^#+\s+(.+)$/);
                        if (headingMatch) {
                            const headingText = normalizeAnchorText(headingMatch[1]);
                            if (headingText === anchor) {
                                const position = new vscode.Position(i, 0);
                                editor.revealRange(
                                    new vscode.Range(position, position),
                                    vscode.TextEditorRevealType.InCenter,
                                );
                                editor.selection = new vscode.Selection(position, position);
                                return;
                            }
                        }
                    }

                    vscode.window.showInformationMessage(`Anchor "${anchor}" not found`);
                },
            ),
        );

        // Event listeners
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                this.decorator.setActiveEditor(editor);
            }),
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.decorator.updateDecorationsForSelection(event.kind);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    this.decorator.updateDecorationsFromChange(event);
                }
            }),
            vscode.window.onDidChangeActiveColorTheme(() => {
                this.decorator.recreateColorDependentTypes();
            }),
        );

        // Configuration change listener
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('as-notes.inlineEditor.enabled')) {
                    const enabled = vscode.workspace
                        .getConfiguration('as-notes.inlineEditor')
                        .get<boolean>('enabled', true);
                    const currentlyEnabled = this.decorator.isEnabled();
                    if (enabled !== currentlyEnabled) {
                        this.decorator.toggleDecorations();
                    }
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.defaultBehaviors.diffView.applyDecorations')) {
                    const apply = config.diffView.applyDecorations();
                    this.decorator.updateDiffViewDecorationSetting(!apply);
                    this.decorator.updateDecorationsForSelection();
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.decorations.ghostFaintOpacity')) {
                    this.decorator.recreateGhostFaintDecorationType();
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.decorations.frontmatterDelimiterOpacity')) {
                    this.decorator.recreateFrontmatterDelimiterDecorationType();
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.decorations.codeBlockLanguageOpacity')) {
                    this.decorator.recreateCodeBlockLanguageDecorationType();
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.links.singleClickOpen')) {
                    this.linkClickHandler.setEnabled(config.links.singleClickOpen());
                }
                if (e.affectsConfiguration('as-notes.inlineEditor.colors')) {
                    this.decorator.recreateColorDependentTypes();
                }
                if (e.affectsConfiguration('editor.fontSize') || e.affectsConfiguration('editor.lineHeight')) {
                    this.decorator.clearMathDecorationCache();
                }
                if (e.affectsConfiguration('as-notes.outlinerMode')) {
                    this.decorator.updateDecorationsForSelection();
                }
            }),
        );
    }

    private static readonly CONFLICTING_EXTENSIONS = [
        'SeardnaSchmid.markdown-inline-editor-vscode',
        'CodeSmith.markdown-inline-editor-vscode',
    ];

    private static warnConflictingExtensions(): void {
        for (const id of InlineEditorManager.CONFLICTING_EXTENSIONS) {
            const ext = vscode.extensions.getExtension(id);
            if (ext) {
                vscode.window.showWarningMessage(
                    `AS Notes includes built-in inline Markdown rendering. The "${ext.packageJSON?.displayName ?? id}" extension may cause conflicts (duplicate decorations, double checkbox toggles). Consider disabling it.`,
                    'Disable Extension',
                ).then(action => {
                    if (action === 'Disable Extension') {
                        vscode.commands.executeCommand(
                            'workbench.extensions.disableExtension',
                            id,
                        );
                    }
                });
                break; // only warn once
            }
        }
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.decorator.dispose();
        this.linkClickHandler.dispose();
        disposeMermaidRenderer();
    }
}
