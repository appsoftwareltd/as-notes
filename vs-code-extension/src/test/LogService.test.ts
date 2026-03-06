import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogService, NO_OP_LOGGER } from '../LogService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'logservice-test-'));
}

function logFile(dir: string): string {
    return path.join(dir, 'as-notes.log');
}

function rolledFile(dir: string, n: number): string {
    return path.join(dir, `as-notes.${n}.log`);
}

function readLog(dir: string): string {
    return fs.readFileSync(logFile(dir), 'utf-8');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LogService', () => {
    let dir: string;

    beforeEach(() => {
        dir = tmpDir();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    // ── Construction ───────────────────────────────────────────────────

    it('creates the log directory if it does not exist', () => {
        const nested = path.join(dir, 'sub', 'logs');
        const _logger = new LogService(nested, { enabled: true });
        expect(fs.existsSync(nested)).toBe(true);
    });

    it('does not create anything when disabled', () => {
        const nested = path.join(dir, 'should-not-exist');
        const _logger = new LogService(nested, { enabled: false });
        expect(fs.existsSync(nested)).toBe(false);
    });

    // ── Writing ────────────────────────────────────────────────────────

    it('writes an INFO line with timestamp and tag', () => {
        const logger = new LogService(dir, { enabled: true });
        logger.info('TestTag', 'hello world');
        const content = readLog(dir);
        expect(content).toMatch(/^\[.+\] \[INFO\] TestTag: hello world\n$/);
    });

    it('writes WARN and ERROR levels', () => {
        const logger = new LogService(dir, { enabled: true });
        logger.warn('W', 'warning msg');
        logger.error('E', 'error msg');
        const content = readLog(dir);
        expect(content).toContain('[WARN] W: warning msg');
        expect(content).toContain('[ERROR] E: error msg');
    });

    it('does not write when disabled', () => {
        const logger = new LogService(dir, { enabled: true }); // create dir first
        const disabled = new LogService(dir, { enabled: false });
        disabled.info('nope', 'should not appear');
        expect(fs.existsSync(logFile(dir))).toBe(false);
    });

    it('appends multiple lines to the same file', () => {
        const logger = new LogService(dir, { enabled: true });
        logger.info('A', 'first');
        logger.info('B', 'second');
        logger.info('C', 'third');
        const lines = readLog(dir).trim().split('\n');
        expect(lines).toHaveLength(3);
    });

    // ── isEnabled ──────────────────────────────────────────────────────

    it('returns true when enabled', () => {
        const logger = new LogService(dir, { enabled: true });
        expect(logger.isEnabled).toBe(true);
    });

    it('returns false when disabled', () => {
        const logger = new LogService(dir, { enabled: false });
        expect(logger.isEnabled).toBe(false);
    });

    // ── time() ─────────────────────────────────────────────────────────

    it('time() logs elapsed milliseconds', () => {
        const logger = new LogService(dir, { enabled: true });
        const end = logger.time('perf', 'operation');
        // Simulate a tiny delay
        const start = performance.now();
        while (performance.now() - start < 5) { /* spin */ }
        end();
        const content = readLog(dir);
        expect(content).toMatch(/\[INFO\] perf: operation: \d+\.\d+ms/);
    });

    it('time() returns a no-op when disabled', () => {
        const logger = new LogService(dir, { enabled: false });
        const end = logger.time('x', 'y');
        end(); // should not throw or write
        expect(fs.existsSync(logFile(dir))).toBe(false);
    });

    // ── Rotation ───────────────────────────────────────────────────────

    it('rotates the log file when it exceeds maxFileSize', () => {
        // Use a tiny max size to force rotation quickly
        const logger = new LogService(dir, { enabled: true, maxFileSize: 100, maxFiles: 3 });

        // Write enough to exceed 100 bytes
        for (let i = 0; i < 5; i++) {
            logger.info('rot', 'A message that is long enough to fill the log quickly');
        }

        // The original file should have been rotated — .1.log should exist
        expect(fs.existsSync(rolledFile(dir, 1))).toBe(true);
        // The current log file should still exist (new writes after rotation)
        expect(fs.existsSync(logFile(dir))).toBe(true);
    });

    it('rotates through the full chain and deletes the oldest', () => {
        const logger = new LogService(dir, { enabled: true, maxFileSize: 50, maxFiles: 3 });

        // Write many messages to force multiple rotations
        for (let i = 0; i < 30; i++) {
            logger.info('chain', `Message number ${i} with enough padding to exceed the limit`);
        }

        // maxFiles = 3 → files: as-notes.log, as-notes.1.log, as-notes.2.log
        expect(fs.existsSync(logFile(dir))).toBe(true);
        expect(fs.existsSync(rolledFile(dir, 1))).toBe(true);
        expect(fs.existsSync(rolledFile(dir, 2))).toBe(true);
        // .3.log should NOT exist (maxFiles - 1 = 2 is the highest rolled index)
        expect(fs.existsSync(rolledFile(dir, 3))).toBe(false);
    });

    it('keeps only the configured number of rolled files', () => {
        const logger = new LogService(dir, { enabled: true, maxFileSize: 50, maxFiles: 2 });

        for (let i = 0; i < 20; i++) {
            logger.info('limit', `Fill message ${i} with padding for rotation trigger`);
        }

        // maxFiles = 2 → as-notes.log + as-notes.1.log
        expect(fs.existsSync(logFile(dir))).toBe(true);
        expect(fs.existsSync(rolledFile(dir, 1))).toBe(true);
        expect(fs.existsSync(rolledFile(dir, 2))).toBe(false);
    });

    // ── NO_OP_LOGGER ───────────────────────────────────────────────────

    it('NO_OP_LOGGER is disabled', () => {
        expect(NO_OP_LOGGER.isEnabled).toBe(false);
    });

    it('NO_OP_LOGGER methods do not throw', () => {
        expect(() => {
            NO_OP_LOGGER.info('x', 'y');
            NO_OP_LOGGER.warn('x', 'y');
            NO_OP_LOGGER.error('x', 'y');
            NO_OP_LOGGER.time('x', 'y')();
        }).not.toThrow();
    });

    // ── Resilience ─────────────────────────────────────────────────────

    it('does not throw when the log directory is deleted mid-session', () => {
        const logger = new LogService(dir, { enabled: true });
        logger.info('before', 'created');
        // Simulate directory removal
        fs.rmSync(dir, { recursive: true, force: true });
        // Should not throw — I/O errors are swallowed
        expect(() => logger.info('after', 'gone')).not.toThrow();
    });
});
