import * as esbuild from 'esbuild';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['./src/convert.ts'],
    bundle: true,
    outfile: 'dist/convert.js',
    format: 'esm',
    platform: 'node',
    sourcemap: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Build complete.');
}
