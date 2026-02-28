import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
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

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Build complete. WASM binary copied to dist/.');
}
