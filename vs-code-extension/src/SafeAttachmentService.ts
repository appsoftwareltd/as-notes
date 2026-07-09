/**
 * SafeAttachmentService - extraction of safe attachments with the full
 * hardening agreed for temp+auto-open:
 *   - a private per-session temp dir (0700 dir / 0600 files, random names);
 *   - every extracted path tracked and wiped on lock / window close;
 *   - a sweep of orphaned dirs from previous crashes on activation;
 *   - a first-use warning that a plaintext copy is written;
 *   - a setting (as-notes.safe.allowOpenAttachments) to force Save As only.
 *
 * Opening hands the file to an external app, after which its plaintext is
 * beyond our control - hence the warning and the best-effort wipe.
 */

import * as vscode from 'vscode';
import { tmpdir } from 'os';
import { join, extname, basename } from 'path';
import { randomUUID, randomBytes } from 'crypto';
import {
    mkdirSync,
    writeFileSync,
    rmSync,
    readdirSync,
    existsSync,
    statSync,
} from 'fs';
import { LogService } from './LogService';

const DIR_PREFIX = 'as-notes-safe-';

export class SafeAttachmentService {
    private sessionDir: string | undefined;
    private readonly extracted = new Set<string>();
    private warned = false;

    constructor(private readonly log: LogService) {}

    /** Delete leftover temp dirs from previous crashes. Call on activation. */
    sweepOrphans(): void {
        try {
            for (const name of readdirSync(tmpdir())) {
                if (name.startsWith(DIR_PREFIX)) {
                    rmSync(join(tmpdir(), name), { recursive: true, force: true });
                }
            }
        } catch (err) {
            this.log.warn('safe', `attachment orphan sweep failed: ${(err as Error).message}`);
        }
    }

    private ensureSessionDir(): string {
        if (!this.sessionDir) {
            const dir = join(tmpdir(), DIR_PREFIX + randomUUID());
            mkdirSync(dir, { recursive: true, mode: 0o700 });
            this.sessionDir = dir;
        }
        return this.sessionDir;
    }

    private allowOpen(): boolean {
        return vscode.workspace.getConfiguration('as-notes.safe').get<boolean>('allowOpenAttachments', true);
    }

    /**
     * Open an attachment in its default app (writing a hardened temp copy), or
     * fall back to Save As when opening is disabled by setting.
     */
    async open(name: string, bytes: Uint8Array): Promise<void> {
        if (!this.allowOpen()) {
            await this.saveAs(name, bytes);
            return;
        }

        if (!this.warned) {
            const choice = await vscode.window.showWarningMessage(
                'Opening this attachment writes an unencrypted copy to a temporary file. '
                + 'Other apps may copy or retain it; it is removed when the safe locks, but a crash can leave it behind.',
                { modal: true },
                'Open Anyway',
                'Save As Instead',
            );
            if (choice === 'Save As Instead') {
                await this.saveAs(name, bytes);
                return;
            }
            if (choice !== 'Open Anyway') {
                return;
            }
            this.warned = true;
        }

        const dir = this.ensureSessionDir();
        // Random filename, original extension preserved so the OS picks a handler.
        const tempName = randomBytes(8).toString('hex') + extname(name);
        const tempPath = join(dir, tempName);
        writeFileSync(tempPath, bytes, { mode: 0o600 });
        this.extracted.add(tempPath);
        await vscode.env.openExternal(vscode.Uri.file(tempPath));
        this.log.info('safe', `attachment opened to temp: ${basename(tempPath)}`);
    }

    /** Save an attachment to a user-chosen path - no temp file, nothing to wipe. */
    async saveAs(name: string, bytes: Uint8Array): Promise<void> {
        const target = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(join(tmpdir(), name)),
            saveLabel: 'Extract Attachment',
        });
        if (!target) {
            return;
        }
        await vscode.workspace.fs.writeFile(target, bytes);
    }

    /** Best-effort overwrite-then-delete of every extracted file. Call on lock. */
    wipe(): void {
        for (const path of this.extracted) {
            try {
                if (existsSync(path)) {
                    const { size } = statSync(path);
                    writeFileSync(path, randomBytes(Math.max(1, size)));
                    rmSync(path, { force: true });
                }
            } catch (err) {
                this.log.warn('safe', `attachment wipe failed: ${(err as Error).message}`);
            }
        }
        this.extracted.clear();
        if (this.sessionDir) {
            try {
                rmSync(this.sessionDir, { recursive: true, force: true });
            } catch {
                /* best effort */
            }
            this.sessionDir = undefined;
        }
    }

    dispose(): void {
        this.wipe();
    }
}
