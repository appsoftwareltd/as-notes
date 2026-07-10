/**
 * safe-locked.ts - the sidebar webview shown while the safe is locked (browser
 * side). Lays out which .kdbx will be opened and which key file (if any) it
 * needs, above the Unlock button.
 *
 * Receives paths only - no entry data, no master password, no key-file bytes.
 * Renders through the auto-escaping html`` helper and `setHtml` from dom.ts, as
 * every src/webview/safe*.ts file must (ADR-0005, enforced by a guard test).
 */

import { html, setHtml, type RawHtml } from './dom';

interface LockedViewState {
    pro: boolean;
    safePath: string | null;
    safeMissing: boolean;
    keyFilePath: string | null;
    keyFileMissing: boolean;
}

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

const app = document.getElementById('app')!;
let state: LockedViewState | null = null;

/** Split a path into its directory and final segment. Handles / and \. */
function splitPath(path: string): { dir: string; name: string } {
    const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return at < 0
        ? { dir: '', name: path }
        : { dir: path.slice(0, at) || '/', name: path.slice(at + 1) };
}

function icon(name: string): RawHtml {
    return html`<span class="codicon codicon-${name}"></span>`;
}

function warning(text: string): RawHtml {
    return html`<p class="warn">${icon('warning')} ${text}</p>`;
}

/** An action button. `action` is posted straight back to the host. */
function iconButton(action: string, codicon: string, label: string): RawHtml {
    return html`
        <button class="icon-button" data-action="${action}" title="${label}" aria-label="${label}">
            ${icon(codicon)}
        </button>`;
}

function safeRow(): RawHtml {
    const { dir, name } = splitPath(state!.safePath!);
    return html`
        <div class="row">
            <div class="row-icon">${icon('shield')}</div>
            <div class="row-text">
                <p class="row-label">Safe</p>
                <p class="row-name">${name}</p>
                <p class="row-path" title="${state!.safePath}">${dir}</p>
                ${state!.safeMissing ? warning('Not found on disk. It may have moved.') : ''}
            </div>
            <div class="row-actions">
                ${iconButton('selectSafe', 'edit', 'Open a different safe')}
            </div>
        </div>`;
}

function keyFileRow(): RawHtml {
    const path = state!.keyFilePath;
    if (!path) {
        return html`
            <div class="row">
                <div class="row-icon">${icon('key')}</div>
                <div class="row-text">
                    <p class="row-label">Key file</p>
                    <p class="row-name muted">None</p>
                    <p class="row-path">Unlocks with the master password alone.</p>
                </div>
                <div class="row-actions">
                    ${iconButton('selectKeyFile', 'add', 'Attach a key file')}
                </div>
            </div>`;
    }
    const { dir, name } = splitPath(path);
    return html`
        <div class="row">
            <div class="row-icon">${icon('key')}</div>
            <div class="row-text">
                <p class="row-label">Key file</p>
                <p class="row-name">${name}</p>
                <p class="row-path" title="${path}">${dir}</p>
                ${state!.keyFileMissing
            ? warning('Not found on disk. Unlocking will fail until it is available.')
            : ''}
            </div>
            <div class="row-actions">
                ${iconButton('selectKeyFile', 'edit', 'Use a different key file')}
                ${iconButton('clearKeyFile', 'clear-all', 'Stop using a key file')}
            </div>
        </div>`;
}

function lockedView(): RawHtml {
    return html`
        <div class="rows">
            ${safeRow()}
            ${keyFileRow()}
        </div>
        <button class="primary" data-action="unlock">${icon('unlock')} Unlock Safe</button>
        <p class="hint">You will be asked for the master password.</p>
        <div class="links">
            <button class="link" data-action="create">Create a new safe</button>
        </div>`;
}

function notConfiguredView(): RawHtml {
    return html`
        <div class="intro">
            <p>No password safe is set up for this workspace yet.</p>
            <p class="muted">
                A safe is a standard KeePass (.kdbx) file you can also open in other KeePass apps.
            </p>
        </div>
        <button class="primary" data-action="create">${icon('new-file')} Create New Safe</button>
        <button class="secondary" data-action="selectSafe">${icon('folder-opened')} Open Existing Safe</button>`;
}

function proView(): RawHtml {
    return html`
        <div class="intro">
            <p>The password safe is a Pro feature.</p>
            <p class="muted">
                Store and edit standard KeePass (.kdbx) files directly in VS Code -
                interoperable with KeePassXC and other KeePass apps.
            </p>
        </div>
        <button class="primary" data-action="licence">Enter Licence Key</button>`;
}

function render(): void {
    if (!state) {
        return;
    }
    const view = !state.pro ? proView() : !state.safePath ? notConfiguredView() : lockedView();
    setHtml(app, view);
}

// One delegated listener; CSP forbids inline handlers, and this survives re-render.
app.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest('[data-action]');
    const action = target?.getAttribute('data-action');
    if (action) {
        vscode.postMessage({ type: action });
    }
});

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; state: LockedViewState };
    if (msg.type === 'state') {
        state = msg.state;
        render();
    }
});
