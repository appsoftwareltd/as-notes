/**
 * Lightweight debug logger gated behind the AS_NOTES_DEBUG environment variable.
 * No VS Code dependencies — safe for unit testing.
 *
 * Enable by setting AS_NOTES_DEBUG=1 (e.g. in .vscode/launch.json env).
 * When disabled, all methods are no-ops with negligible overhead.
 */

const enabled = process.env.AS_NOTES_DEBUG === '1';

export function isDebugEnabled(): boolean {
    return enabled;
}

/**
 * Log a debug message with a millisecond timestamp.
 */
export function debugLog(tag: string, message: string): void {
    if (!enabled) { return; }
    console.log(`[as-notes:${tag}] ${message}`);
}

/**
 * Start a timer. Returns a function that, when called, logs the elapsed time.
 */
export function debugTime(tag: string, label: string): () => void {
    if (!enabled) { return () => { }; }
    const start = performance.now();
    return () => {
        const elapsed = (performance.now() - start).toFixed(2);
        console.log(`[as-notes:${tag}] ${label}: ${elapsed}ms`);
    };
}
