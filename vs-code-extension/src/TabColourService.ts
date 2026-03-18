/**
 * Tab Colour Service
 *
 * Drives VS Code's `tab.activeBorderTop` / `tab.unfocusedActiveBorderTop`
 * colour customisation from two sources (highest priority first):
 *
 * 1. YAML front matter `tab-colour` key in the active markdown file.
 * 2. The `as-notes.tabColourRules` workspace/user setting — an ordered list
 *    of `{ pattern, colour }` pairs where `pattern` is a regex tested against
 *    the workspace-relative file path and `colour` is a hex code.
 *
 * Pure logic functions (`isValidHex`, `resolveTabColour`) are kept free of
 * `vscode` imports so they can be unit-tested without the VS Code environment.
 * The `TabColourService` class handles all VS Code API interactions.
 */

import * as vscode from 'vscode';
import { FrontMatterService } from './FrontMatterService.js';

// ── Pure / testable logic ───────────────────────────────────────────────────

/**
 * Tab colour rules from the `as-notes.tabColourRules` configuration setting.
 * Keys are JavaScript regex strings tested against the workspace-relative file
 * path; values are hex colour strings (e.g. `#ff6600`).
 * Rules are evaluated in insertion order — the first match wins.
 */
export type TabColourRules = Record<string, string>;

/** Returns true if `hex` is a valid CSS hex colour (#RGB, #RRGGBB, or #RRGGBBAA). */
export function isValidHex(hex: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex);
}

/**
 * Resolve the tab colour to apply for the given file.
 *
 * Priority:
 * 1. Valid `tab-colour` hex value in YAML front matter.
 * 2. First `rules` entry whose regex pattern matches `filePath` and whose
 *    value is a valid hex code.
 *
 * @param filePath  - Workspace-relative path (used for pattern matching).
 * @param content   - Raw file content, or `null` if not yet available.
 * @param rules     - Pattern→colour map from VS Code config (insertion-ordered).
 * @returns The resolved hex colour string, or `undefined` if no rule matches.
 */
export function resolveTabColour(
    filePath: string,
    content: string | null,
    rules: TabColourRules,
): string | undefined {
    const fms = new FrontMatterService();

    // Priority 1: frontmatter `tab-colour`
    if (content !== null) {
        const frontmatterColour = fms.parseScalarString(content, 'tab-colour');
        if (frontmatterColour && isValidHex(frontmatterColour)) {
            return frontmatterColour;
        }
    }

    // Priority 2: first matching config rule
    for (const [pattern, colour] of Object.entries(rules)) {
        try {
            if (new RegExp(pattern).test(filePath) && isValidHex(colour)) {
                return colour;
            }
        } catch {
            // Swallow invalid regex — skip this rule
        }
    }

    return undefined;
}

// ── VS Code service ─────────────────────────────────────────────────────────

/**
 * Derive a semi-transparent background tint from a hex colour.
 *
 * Takes the RGB portion of any valid hex colour (#RGB, #RRGGBB, #RRGGBBAA)
 * and appends `33` (~20% opacity) so the tab background shows a subtle wash
 * alongside the solid border line.
 */
export function toBackgroundTint(hex: string): string {
    const raw = hex.slice(1);
    let r: string, g: string, b: string;

    if (raw.length === 3) {
        r = raw[0] + raw[0];
        g = raw[1] + raw[1];
        b = raw[2] + raw[2];
    } else {
        // Use first 6 chars (ignore any existing alpha)
        r = raw.slice(0, 2);
        g = raw.slice(2, 4);
        b = raw.slice(4, 6);
    }

    return `#${r}${g}${b}33`;
}

/**
 * The `workbench.colorCustomizations` keys managed by this service.
 * All four are written/cleared together.
 */
const OWNED_KEYS = [
    'tab.activeBorderTop',
    'tab.unfocusedActiveBorderTop',
    'tab.activeBackground',
    'tab.unfocusedActiveBackground',
] as const;

type OwnedKey = typeof OWNED_KEYS[number];

/**
 * Manages tab colour entries inside `workbench.colorCustomizations` at
 * workspace scope.
 *
 * Sets a solid border line (`tab.activeBorderTop`) plus a subtle background
 * tint (`tab.activeBackground`, ~20% opacity) so the colour is clearly visible
 * on the active tab. Only touches the four keys it owns — all other user
 * colour customisations are preserved unchanged.
 */
export class TabColourService {
    /**
     * Apply `colour` as the active tab colour, or remove all managed keys
     * from `workbench.colorCustomizations` when `colour` is `undefined`.
     *
     * No-ops if the current values already match to avoid spurious writes.
     */
    apply(colour: string | undefined): void {
        const config = vscode.workspace.getConfiguration('workbench');
        const current = config.get<Record<string, string>>('colorCustomizations') ?? {};

        if (colour) {
            const tint = toBackgroundTint(colour);
            const desired: Record<OwnedKey, string> = {
                'tab.activeBorderTop': colour,
                'tab.unfocusedActiveBorderTop': colour,
                'tab.activeBackground': tint,
                'tab.unfocusedActiveBackground': tint,
            };
            if (OWNED_KEYS.every(k => current[k] === desired[k])) {
                return; // Already set — nothing to do
            }
            config.update(
                'colorCustomizations',
                { ...current, ...desired },
                vscode.ConfigurationTarget.Workspace,
            ).then(undefined, (err) => {
                console.warn('as-notes: failed to update tab colour:', err);
            });
        } else {
            if (OWNED_KEYS.every(k => !(k in current))) {
                return; // Nothing to remove
            }
            const updated = { ...current };
            for (const k of OWNED_KEYS) {
                delete updated[k];
            }
            config.update(
                'colorCustomizations',
                updated,
                vscode.ConfigurationTarget.Workspace,
            ).then(undefined, (err) => {
                console.warn('as-notes: failed to clear tab colour:', err);
            });
        }
    }

    /**
     * Convenience: resolve and apply the colour for the given editor.
     * Reads `as-notes.tabColourRules` from VS Code configuration.
     */
    applyForEditor(editor: vscode.TextEditor | undefined): void {
        if (!editor || editor.document.languageId !== 'markdown') {
            this.apply(undefined);
            return;
        }

        const rules = vscode.workspace.getConfiguration('as-notes')
            .get<TabColourRules>('tabColourRules', {});

        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        const content = editor.document.getText();

        const colour = resolveTabColour(filePath, content, rules);
        this.apply(colour);
    }
}
