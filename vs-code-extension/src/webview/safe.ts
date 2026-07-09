/**
 * safe.ts - the password-safe entry editor webview (browser side).
 *
 * Renders untrusted KDBX fields ONLY through the auto-escaping html`` helper
 * (ADR-0005). Text values are additionally written via `.value` (never string
 * attributes), so entry content never reaches an HTML parser. The raw TOTP
 * secret is never received here - codes are streamed from the host.
 */

import { html, setHtml } from './dom';
import { KDBX_ICON_NAMES, KDBX_ICON_CODICONS } from '../safeIcons';

interface TotpView {
    digits: number;
    period: number;
    algorithm: string;
}

interface HistoryVersion {
    index: number;
    title: string;
    username: string;
    modified: number | null;
}

interface GroupRef {
    uuid: string;
    path: string;
}

interface EntryView {
    uuid: string;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    customFields: Record<string, string>;
    tags: string[];
    attachmentNames: string[];
    totp: TotpView | null;
    authenticatorKey: string;
    historyCount: number;
    history: HistoryVersion[];
    expires: boolean;
    expiryTime: number | null;
    icon: number;
    groupUuid: string;
    groups: GroupRef[];
}

function toDateInputValue(ms: number | null): string {
    if (!ms) {
        return '';
    }
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

const app = document.getElementById('app')!;
let state: EntryView | null = null;
let passwordVisible = false;
let dirty = false;

function post(msg: unknown): void {
    vscode.postMessage(msg);
}

/** Reflect unsaved-changes state on the Save button (enabled + highlighted). */
function applySaveState(): void {
    const btn = document.getElementById('save') as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = !dirty;
        btn.classList.toggle('has-changes', dirty);
    }
    const status = document.getElementById('save-status');
    if (status && dirty) {
        status.textContent = 'Unsaved changes';
    }
}

/** Show a spinner on the Save button while a save is in flight. */
function setSaving(saving: boolean): void {
    const btn = document.getElementById('save') as HTMLButtonElement | null;
    if (!btn) {
        return;
    }
    if (saving) {
        btn.disabled = true;
        setHtml(btn, html`<i class="codicon codicon-loading codicon-modifier-spin"></i> Saving…`);
    } else {
        setHtml(btn, html`<i class="codicon codicon-save"></i> Save`);
        applySaveState();
    }
}

// ── Render ────────────────────────────────────────────────────────────────

function render(): void {
    if (!state) {
        setHtml(app, html`<div class="empty">Loading…</div>`);
        return;
    }
    const s = state;

    const customRows = Object.keys(s.customFields).map(
        (name) => html`
            <div class="field custom" data-custom="${name}">
                <div class="row">
                    <input type="text" class="custom-name" data-rename-custom="${name}" title="Field name" />
                    <input type="text" data-custom-input="${name}" title="Value" />
                    <button class="btn danger" data-remove-custom="${name}" title="Remove field">✕</button>
                </div>
            </div>`,
    );

    const iconButtons = KDBX_ICON_NAMES.map(
        (name, i) => html`
            <button
                class="icon-opt ${i === s.icon ? 'selected' : ''}"
                data-icon="${i}"
                title="${name}"
            ><i class="codicon codicon-${KDBX_ICON_CODICONS[i]}"></i></button>`,
    );

    const historyRows = s.history
        .slice()
        .reverse()
        .map(
            (h) => html`
            <div class="history-row" data-history="${h.index}">
                <span class="name">${h.title || '(no title)'}${h.username ? ' · ' + h.username : ''}</span>
                <button class="btn" data-restore="${h.index}">Restore</button>
            </div>`,
        );

    const attachmentRows = s.attachmentNames.map(
        (name) => html`
            <div class="attachment" data-attachment="${name}">
                <span class="name">${name}</span>
                <button class="btn" data-open-attachment="${name}">Open</button>
                <button class="btn" data-save-attachment="${name}">Save As…</button>
                <button class="btn danger" data-delete-attachment="${name}">Delete</button>
            </div>`,
    );

    const totpBlock = html`
            <div class="field">
                <label>Authenticator key</label>
                <div class="row">
                    <input type="text" id="authkey-input" placeholder="otpauth://… or a base32 key (Bitwarden format)" />
                    <button class="btn" id="set-totp">Save key</button>
                    ${s.totp ? html`<button class="btn danger" id="remove-totp">Remove</button>` : ''}
                </div>
                ${s.totp
            ? html`
                    <div class="row totp">
                        <span id="totp-code" class="totp-code">••••••</span>
                        <span id="totp-remaining" class="totp-remaining"></span>
                        <button class="btn" data-copy="totp" title="Copy one-time code"><i class="codicon codicon-copy"></i></button>
                    </div>`
            : ''}
            </div>`;

    const groupOptions = s.groups.map(
        (g) => html`<option value="${g.uuid}">${g.path}</option>`,
    );

    setHtml(
        app,
        html`
        <div class="editor">
            <div class="field">
                <label>Group (folder)</label>
                <select id="group-select">${groupOptions}</select>
            </div>
            <div class="field">
                <label>Title</label>
                <input type="text" data-field="title" />
            </div>
            <div class="field">
                <label>Username</label>
                <div class="row">
                    <input type="text" data-field="username" />
                    <button class="btn" data-copy="username" title="Copy username"><i class="codicon codicon-copy"></i></button>
                </div>
            </div>
            <div class="field">
                <label>Password</label>
                <div class="row">
                    <input type="password" data-field="password" id="password-input" />
                    <button class="btn" id="toggle-password" title="${passwordVisible ? 'Hide password' : 'Show password'}"><i class="codicon codicon-${passwordVisible ? 'eye-closed' : 'eye'}"></i></button>
                    <button class="btn" data-copy="password" title="Copy password"><i class="codicon codicon-copy"></i></button>
                </div>
            </div>
            <div class="field">
                <label>URL</label>
                <input type="text" data-field="url" />
            </div>
            <div class="field">
                <label>Notes</label>
                <textarea data-field="notes" rows="4"></textarea>
            </div>

            ${totpBlock}

            <div class="section">
                <div class="section-head">
                    <h3>Custom fields</h3>
                    <button class="btn" id="add-custom">Add field</button>
                </div>
                ${customRows}
            </div>

            <div class="field">
                <label>Tags (comma separated)</label>
                <input type="text" id="tags-input" />
            </div>

            <div class="row two">
                <div class="field">
                    <label>Icon</label>
                    <div class="icon-grid">${iconButtons}</div>
                </div>
                <div class="field">
                    <label>Expiry</label>
                    <div class="row">
                        <label class="inline"><input type="checkbox" id="expires-check" /> Expires</label>
                        <input type="date" id="expiry-date" />
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-head">
                    <h3>Attachments</h3>
                    <button class="btn" id="add-attachment">Add attachment</button>
                </div>
                ${attachmentRows.length ? attachmentRows : html`<div class="muted">No attachments.</div>`}
            </div>

            <div class="section">
                <h3>History (${s.history.length})</h3>
                ${historyRows.length ? historyRows : html`<div class="muted">No previous versions.</div>`}
            </div>

            <div class="actions">
                <button class="btn primary" id="save"><i class="codicon codicon-save"></i> Save</button>
                <span id="save-status" class="muted"></span>
            </div>
        </div>`,
    );

    populate();
}

/** Set input values via .value (never as HTML attributes). */
function populate(): void {
    if (!state) {
        return;
    }
    setValue('[data-field="title"]', state.title);
    setValue('[data-field="username"]', state.username);
    setValue('[data-field="password"]', state.password);
    setValue('[data-field="url"]', state.url);
    setValue('[data-field="notes"]', state.notes);
    setValue('#tags-input', state.tags.join(', '));
    (document.getElementById('password-input') as HTMLInputElement | null)?.setAttribute(
        'type',
        passwordVisible ? 'text' : 'password',
    );
    for (const [name, value] of Object.entries(state.customFields)) {
        const el = document.querySelector<HTMLInputElement>(`[data-custom-input="${cssEscape(name)}"]`);
        if (el) {
            el.value = value;
        }
        const nameEl = document.querySelector<HTMLInputElement>(`[data-rename-custom="${cssEscape(name)}"]`);
        if (nameEl) {
            nameEl.value = name;
        }
    }
    setValue('#authkey-input', state.authenticatorKey);
    const groupSel = document.getElementById('group-select') as HTMLSelectElement | null;
    if (groupSel) {
        groupSel.value = state.groupUuid;
    }
    const expiresCheck = document.getElementById('expires-check') as HTMLInputElement | null;
    if (expiresCheck) {
        expiresCheck.checked = state.expires;
    }
    setValue('#expiry-date', toDateInputValue(state.expiryTime));
    applySaveState();
}

function setValue(selector: string, value: string): void {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (el) {
        el.value = value;
    }
}

function cssEscape(value: string): string {
    return value.replace(/["\\]/g, '\\$&');
}

// ── Events (delegated; no inline handlers - CSP forbids them) ───────────────

app.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    const field = t.getAttribute('data-field');
    if (field) {
        post({ type: 'updateField', field, value: (t as HTMLInputElement).value });
        return;
    }
    const custom = t.getAttribute('data-custom-input');
    if (custom) {
        post({ type: 'updateCustom', name: custom, value: (t as HTMLInputElement).value });
    }
});

app.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'tags-input') {
        post({ type: 'setTags', tags: (t as HTMLInputElement).value.split(',') });
        return;
    }
    if (t.id === 'group-select') {
        post({ type: 'moveToGroup', groupUuid: (t as HTMLSelectElement).value });
        return;
    }
    if (t.id === 'expires-check' || t.id === 'expiry-date') {
        const checked = (document.getElementById('expires-check') as HTMLInputElement).checked;
        const dateVal = (document.getElementById('expiry-date') as HTMLInputElement).value;
        const time = checked && dateVal ? new Date(dateVal + 'T23:59:59').getTime() : null;
        post({ type: 'setExpiry', expires: checked, time });
        return;
    }
    // Renaming a custom field fires on blur/commit, not per keystroke.
    const rename = t.getAttribute('data-rename-custom');
    if (rename) {
        const newName = (t as HTMLInputElement).value.trim();
        if (newName && newName !== rename) {
            post({ type: 'renameCustom', oldName: rename, newName });
        }
    }
});

app.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t) {
        return;
    }
    const copy = t.getAttribute('data-copy');
    if (copy) {
        post({ type: 'copy', what: copy });
        return;
    }
    const removeCustom = t.getAttribute('data-remove-custom');
    if (removeCustom) {
        post({ type: 'removeCustom', name: removeCustom });
        return;
    }
    const openAtt = t.getAttribute('data-open-attachment');
    if (openAtt) {
        post({ type: 'openAttachment', name: openAtt });
        return;
    }
    const saveAtt = t.getAttribute('data-save-attachment');
    if (saveAtt) {
        post({ type: 'saveAttachment', name: saveAtt });
        return;
    }
    const delAtt = t.getAttribute('data-delete-attachment');
    if (delAtt) {
        post({ type: 'deleteAttachment', name: delAtt });
        return;
    }
    const restore = t.getAttribute('data-restore');
    if (restore) {
        post({ type: 'restoreHistory', index: Number(restore) });
        return;
    }
    const icon = t.getAttribute('data-icon');
    if (icon !== null) {
        post({ type: 'setIcon', icon: Number(icon) });
        return;
    }
    switch (t.id) {
        case 'add-attachment':
            post({ type: 'addAttachment' });
            break;
        case 'toggle-password': {
            // Toggle the field type in place — a full render() would repopulate
            // from the (stale) local state and wipe any unsaved typed value.
            passwordVisible = !passwordVisible;
            const pwInput = document.getElementById('password-input') as HTMLInputElement | null;
            if (pwInput) {
                pwInput.type = passwordVisible ? 'text' : 'password';
            }
            const toggleBtn = document.getElementById('toggle-password') as HTMLButtonElement | null;
            if (toggleBtn) {
                toggleBtn.title = passwordVisible ? 'Hide password' : 'Show password';
                setHtml(toggleBtn, html`<i class="codicon codicon-${passwordVisible ? 'eye-closed' : 'eye'}"></i>`);
            }
            break;
        }
        case 'add-custom':
            // window.prompt is unavailable in webviews - the host shows the input box.
            post({ type: 'addCustomPrompt' });
            break;
        case 'set-totp': {
            const value = (document.getElementById('authkey-input') as HTMLInputElement)?.value;
            if (value) {
                post({ type: 'setTotp', value });
            }
            break;
        }
        case 'remove-totp':
            post({ type: 'removeTotp' });
            break;
        case 'save':
            setSaving(true);
            post({ type: 'save' });
            break;
    }
});

// ── Host → webview ──────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'entry':
            state = msg.view as EntryView;
            dirty = Boolean(msg.dirty);
            render();
            break;
        case 'dirty':
            dirty = Boolean(msg.dirty);
            applySaveState();
            break;
        case 'saveDone':
            setSaving(false);
            break;
        case 'totp': {
            const code = document.getElementById('totp-code');
            const remaining = document.getElementById('totp-remaining');
            if (code) {
                code.textContent = String(msg.code);
            }
            if (remaining) {
                remaining.textContent = `${msg.remaining}s`;
            }
            break;
        }
        case 'saved': {
            dirty = false;
            applySaveState();
            const status = document.getElementById('save-status');
            if (status) {
                status.textContent = 'Saved.';
                setTimeout(() => {
                    if (status && !dirty) {
                        status.textContent = '';
                    }
                }, 2000);
            }
            break;
        }
    }
});

post({ type: 'ready' });
