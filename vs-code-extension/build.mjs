import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, watch } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');

const isWatch = process.argv.includes('--watch');

// Ensure dist/ and dist/webview/ exist
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
mkdirSync(resolve(__dirname, 'dist', 'webview'), { recursive: true });

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

/** @type {import('esbuild').BuildOptions} */
const webviewBuildOptions = {
    entryPoints: ['./src/webview/tasks.ts'],
    bundle: true,
    outfile: 'dist/webview/tasks.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

/** @type {import('esbuild').BuildOptions} */
const searchWebviewBuildOptions = {
    entryPoints: ['./src/webview/search.ts'],
    bundle: true,
    outfile: 'dist/webview/search.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

/** @type {import('esbuild').BuildOptions} */
const kanbanWebviewBuildOptions = {
    entryPoints: ['./src/webview/kanban.ts'],
    bundle: true,
    outfile: 'dist/webview/kanban.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

/** @type {import('esbuild').BuildOptions} */
const kanbanSidebarWebviewBuildOptions = {
    entryPoints: ['./src/webview/kanban-sidebar.ts'],
    bundle: true,
    outfile: 'dist/webview/kanban-sidebar.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

/** @type {import('esbuild').BuildOptions} */
const calendarWebviewBuildOptions = {
    entryPoints: ['./src/webview/calendar.ts'],
    bundle: true,
    outfile: 'dist/webview/calendar.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

/** @type {import('esbuild').BuildOptions} */
const aiKnowledgeWebviewBuildOptions = {
    entryPoints: ['./src/webview/ai-knowledge.ts'],
    bundle: true,
    outfile: 'dist/webview/ai-knowledge.js',
    format: 'iife',
    platform: 'browser',
    sourcemap: true,
    target: ['es2022'],
};

async function buildCss() {
    const tasksCss = readFileSync('./src/webview/tasks.css', 'utf8');
    const tasksResult = await postcss([tailwindcss]).process(tasksCss, {
        from: './src/webview/tasks.css',
        to: './dist/webview/tasks.css',
    });
    writeFileSync('./dist/webview/tasks.css', tasksResult.css);
    if (tasksResult.map) {
        writeFileSync('./dist/webview/tasks.css.map', tasksResult.map.toString());
    }

    const searchCss = readFileSync('./src/webview/search.css', 'utf8');
    const searchResult = await postcss([tailwindcss]).process(searchCss, {
        from: './src/webview/search.css',
        to: './dist/webview/search.css',
    });
    writeFileSync('./dist/webview/search.css', searchResult.css);
    if (searchResult.map) {
        writeFileSync('./dist/webview/search.css.map', searchResult.map.toString());
    }

    const kanbanCss = readFileSync('./src/webview/kanban.css', 'utf8');
    const kanbanResult = await postcss([tailwindcss]).process(kanbanCss, {
        from: './src/webview/kanban.css',
        to: './dist/webview/kanban.css',
    });
    writeFileSync('./dist/webview/kanban.css', kanbanResult.css);
    if (kanbanResult.map) {
        writeFileSync('./dist/webview/kanban.css.map', kanbanResult.map.toString());
    }

    const calendarCss = readFileSync('./src/webview/calendar.css', 'utf8');
    const calendarResult = await postcss([tailwindcss]).process(calendarCss, {
        from: './src/webview/calendar.css',
        to: './dist/webview/calendar.css',
    });
    writeFileSync('./dist/webview/calendar.css', calendarResult.css);
    if (calendarResult.map) {
        writeFileSync('./dist/webview/calendar.css.map', calendarResult.map.toString());
    }

    const aiKnowledgeCss = readFileSync('./src/webview/ai-knowledge.css', 'utf8');
    const aiKnowledgeResult = await postcss([tailwindcss]).process(aiKnowledgeCss, {
        from: './src/webview/ai-knowledge.css',
        to: './dist/webview/ai-knowledge.css',
    });
    writeFileSync('./dist/webview/ai-knowledge.css', aiKnowledgeResult.css);
    if (aiKnowledgeResult.map) {
        writeFileSync('./dist/webview/ai-knowledge.css.map', aiKnowledgeResult.map.toString());
    }
}

if (isWatch) {
    await buildCss();
    console.log('CSS built.');

    // Re-build CSS when webview source files change
    watch('./src/webview', { recursive: true }, async (_event, filename) => {
        if (filename?.endsWith('.css')) {
            try {
                await buildCss();
                console.log('CSS rebuilt.');
            } catch (err) {
                console.error('CSS build error:', err.message);
            }
        }
    });

    const extCtx = await esbuild.context(buildOptions);
    const webCtx = await esbuild.context(webviewBuildOptions);
    const searchCtx = await esbuild.context(searchWebviewBuildOptions);
    const kanbanCtx = await esbuild.context(kanbanWebviewBuildOptions);
    const kanbanSidebarCtx = await esbuild.context(kanbanSidebarWebviewBuildOptions);
    const calendarCtx = await esbuild.context(calendarWebviewBuildOptions);
    const aiKnowledgeCtx = await esbuild.context(aiKnowledgeWebviewBuildOptions);
    await extCtx.watch();
    await webCtx.watch();
    await searchCtx.watch();
    await kanbanCtx.watch();
    await kanbanSidebarCtx.watch();
    await calendarCtx.watch();
    await aiKnowledgeCtx.watch();
    console.log('Watching for changes...');
} else {
    await buildCss();
    await esbuild.build(buildOptions);
    await esbuild.build(webviewBuildOptions);
    await esbuild.build(searchWebviewBuildOptions);
    await esbuild.build(kanbanWebviewBuildOptions);
    await esbuild.build(kanbanSidebarWebviewBuildOptions);
    await esbuild.build(calendarWebviewBuildOptions);
    await esbuild.build(aiKnowledgeWebviewBuildOptions);
    console.log('Build complete. WASM binary copied to dist/.');
}
