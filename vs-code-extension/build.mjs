import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Ensure dist/ exists
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

// Copy sql-wasm.wasm to dist/
copyFileSync(
    resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
    resolve(__dirname, 'dist/sql-wasm.wasm'),
);

// ── sql.js WASM cache-reset plugin ────────────────────────────────────────
// sql.js caches the very first initSqlJs() promise in a closure variable
// `initSqlJsPromise` and returns it for every subsequent call.  This means
// the WASM linear memory (which can only grow, never shrink) is reused
// forever.  After indexing ~18k files the heap is ~80 MB and fragmented;
// creating a new Database() on the same heap crashes at ~1618 files.
//
// This plugin injects a `resetCache()` function onto the exported
// `initSqlJs` function.  Because it's injected inside the same closure,
// it has direct access to `initSqlJsPromise` and can set it to `undefined`,
// allowing the next `initSqlJs()` call to load a truly fresh WASM instance
// with clean linear memory.
// ──────────────────────────────────────────────────────────────────────────
const SENTINEL = 'module.exports = initSqlJs;';
const PATCH = [
    'initSqlJs.resetCache = function() { initSqlJsPromise = undefined; };',
    SENTINEL,
].join('\n    ');

/** @type {import('esbuild').Plugin} */
const sqlJsCacheResetPlugin = {
    name: 'sql-js-cache-reset',
    setup(build) {
        build.onLoad(
            { filter: /sql-wasm\.js$/ },
            async (args) => {
                let src = readFileSync(args.path, 'utf8');
                if (!src.includes(SENTINEL)) {
                    throw new Error(
                        'sql-js-cache-reset plugin: could not find sentinel '
                        + `"${SENTINEL}" in ${args.path}. `
                        + 'Has the sql.js package changed its export format?',
                    );
                }
                src = src.replace(SENTINEL, PATCH);
                return { contents: src, loader: 'js' };
            },
        );
    },
};

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
    plugins: [sqlJsCacheResetPlugin],
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Build complete. WASM binary copied to dist/.');
}
