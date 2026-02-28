// Direct imports from packages with minimal nesting to avoid instance checking issues
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, highlightActiveLine, lineNumbers, keymap, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, syntaxTree } from "@codemirror/language";
// @ts-ignore - typo-js doesn't have complete types
import Typo from "typo-js";

// Spell checker instance that will be initialized with en-GB dictionary
let typoInstance: any = null;
// Custom dictionary words (loaded separately)
let customDictionary: Set<string> = new Set();

// Initialize spell checker with en-GB dictionary and custom dictionary
async function initSpellChecker() {
    try {
        // Fetch en-GB dictionary files and custom dictionary from local server
        const [affData, dicData, customWords] = await Promise.all([
            fetch('/js/dictionaries/en_GB.aff.txt').then(r => {
                if (!r.ok) throw new Error(`Failed to fetch .aff: ${r.status}`);
                return r.text();
            }),
            fetch('/js/dictionaries/en_GB.dic.txt').then(r => {
                if (!r.ok) throw new Error(`Failed to fetch .dic: ${r.status}`);
                return r.text();
            }),
            fetch('/js/dictionaries/custom-dictionary.txt').then(r => {
                if (!r.ok) throw new Error(`Failed to fetch custom dictionary: ${r.status}`);
                return r.text();
            })
        ]);
        
        console.log('Dictionary files loaded, aff size:', affData.length, 'dic size:', dicData.length);
        
        // Typo.js constructor signature: new Typo(dictionary, affData, wordsData, settings)
        typoInstance = new Typo('en_GB', affData, dicData, { platform: 'any' });
        
        // Load custom dictionary words into a Set (case-insensitive)
        customDictionary = new Set(
            customWords
                .split('\n')
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0)
        );
        
        // Wait a bit for the dictionary to be parsed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const wordCount = typoInstance.dictionaryTable ? Object.keys(typoInstance.dictionaryTable).length : 0;
        console.log('en-GB spell checker initialized with', wordCount, 'words');
        console.log('Custom dictionary loaded with', customDictionary.size, 'words');
    } catch (error) {
        console.warn('Failed to initialize en-GB spell checker:', error);
    }
}

// Start loading dictionary
initSpellChecker();

// Create spell check decoration plugin with debouncing
const spellCheckPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    debounceTimeout: number | null = null;
    pendingUpdate: EditorView | null = null;
    
    constructor(view: EditorView) {
        this.decorations = Decoration.none;
        // Initial check with delay
        this.scheduleUpdate(view);
    }
    
    update(update: ViewUpdate) {
        if (update.docChanged) {
            // Clear decorations immediately when user types to prevent them from shifting
            this.decorations = Decoration.none;
            // Schedule a debounced update when document changes
            this.scheduleUpdate(update.view);
        } else if (update.viewportChanged) {
            // Update immediately for viewport changes (scrolling)
            this.decorations = this.buildDecorations(update.view);
        }
    }
    
    scheduleUpdate(view: EditorView) {
        // Clear any pending timeout
        if (this.debounceTimeout !== null) {
            clearTimeout(this.debounceTimeout);
        }
        
        // Schedule new update after 1000ms (1 second) of inactivity
        this.debounceTimeout = window.setTimeout(() => {
            this.decorations = this.buildDecorations(view);
            // Force a view update by dispatching an empty transaction
            view.dispatch({ effects: [] });
            this.debounceTimeout = null;
        }, 1000);
    }
    
    buildDecorations(view: EditorView): DecorationSet {
        if (!typoInstance) {
            return Decoration.none;
        }
        
        const decorations: any[] = [];
        const doc = view.state.doc;
        const text = doc.toString();
        
        // Simple word boundary regex
        const wordRegex = /\b[a-zA-Z]+\b/g;
        let match;
        
        while ((match = wordRegex.exec(text)) !== null) {
            const word = match[0];
            const from = match.index;
            const to = from + word.length;
            
            // Skip short words and words with capital letters (likely proper nouns)
            if (word.length < 3 || /^[A-Z]/.test(word)) {
                continue;
            }
            
            // Check if word is in custom dictionary first (case-insensitive)
            if (customDictionary.has(word.toLowerCase())) {
                continue;
            }
            
            // Check spelling with main dictionary
            if (!typoInstance.check(word)) {
                decorations.push(
                    Decoration.mark({
                        class: 'cm-spell-error'
                    }).range(from, to)
                );
            }
        }
        
        return Decoration.set(decorations, true);
    }
    
    destroy() {
        // Clean up timeout when plugin is destroyed
        if (this.debounceTimeout !== null) {
            clearTimeout(this.debounceTimeout);
        }
    }
}, {
    decorations: v => v.decorations
});

// Simple function to create a CodeMirror editor with the minimum required configuration
export function createEditor(options: { parent: HTMLElement; doc?: string; onChange?: (content: string) => void }) {
    // Define extensions array with basic setup
    const extensions = [
        // Basic display features
        lineNumbers(),
        highlightActiveLine(),
        EditorView.lineWrapping,

        // Enable syntax highlighting with default color scheme
        syntaxHighlighting(defaultHighlightStyle),

        // Enable history (undo/redo) functionality
        history(),

        // Keymaps for editing, including history commands
        keymap.of([
            ...historyKeymap, // Adds the standard history keybindings
            indentWithTab,
            ...defaultKeymap,
        ]),

        // Markdown language support with code block highlighting
        // The languages array provides syntax highlighting for code blocks
        markdown({
            base: markdownLanguage,
            codeLanguages: languages,
        }),
        
        // Spell checking with en-GB dictionary
        spellCheckPlugin,
        
        // CSS for spell check errors
        EditorView.baseTheme({
            ".cm-spell-error": {
                textDecoration: "underline wavy red",
                textDecorationSkipInk: "none"
            }
        }),

        // Global error handler for parser issues
        // This catches exceptions during parsing and prevents them from propagating
        EditorView.exceptionSink.of((exception) => {
            console.error("CodeMirror exception caught by sink:", exception);
            // The act of catching it here prevents the editor from crashing.
        }),
    ];

    // Add change listener if specified
    if (options.onChange) {
        extensions.push(
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const content = update.state.doc.toString();
                    options.onChange?.(content);
                }
            })
        );
    }

    // Create editor state
    const state = EditorState.create({
        doc: options.doc || "",
        extensions,
    });

    // Create and return the editor view
    return new EditorView({
        state,
        parent: options.parent,
    });
}

// Export minimal set of components for direct use
export { EditorState, EditorSelection };
