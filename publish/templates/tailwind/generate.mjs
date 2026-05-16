// Helper script to generate vs-code-extension/src/templates/tailwind.ts
// Run: node publish/templates/tailwind/generate.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const css = readFileSync(resolve(__dirname, 'dist/default.css'), 'utf-8').trim();

const output = `/**
 * Tailwind-based template set for AS Notes publishing.
 * Zinc palette, Inter font, auto light/dark via prefers-color-scheme.
 *
 * Source: publish/templates/tailwind/src/theme.css
 * Build:  cd publish/templates/tailwind && pnpx @tailwindcss/cli -i ./src/theme.css -o ./dist/default.css --minify
 * Generate: node publish/templates/tailwind/generate.mjs
 */

export const DEFAULT_HEADER_HTML = \`<div class="site-header">
    <a class="site-title" href="{{base-url}}/">
        {{site-icon}}
        {{site-title}}
    </a>
</div>
\`;

export const DEFAULT_ICON_SVG = \`<svg class="site-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.82 166.13" width="24" height="21"><path fill="currentColor" fill-rule="evenodd" d="M67.09,132.92,47.93,166.13H9.59L0,149.52,86.33,0H105.5L19.17,149.52H38.34l19.17-33.2h76.8l9.59,16.6Zm48-83.12,9.65,16.71H143.9L115.08,16.6q-24,41.57-48,83.12H143.9q14.37,24.9,28.76,49.8h-96l-9.59,16.61H182.24l9.58-16.61-38.34-66.4H96C95.85,82.9,113.39,52.73,115.08,49.8Z"/></svg>
\`;

export const DEFAULT_FOOTER_HTML = \`<div class="site-footer">
    <p>&copy; \${new Date().getFullYear()} Built with <a href="https://www.asnotes.io">AS Notes</a> by <a href="https://www.appsoftware.com">App Software Ltd</a></p>
</div>
\`;

export const LAYOUT_DOCS = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&display=swap" rel="stylesheet">
    {{stylesheets}}{{meta}}
</head>
<body data-layout="docs">
{{header}}<button class="nav-toggle" aria-label="Toggle navigation">&#9776;</button>
<div class="nav-backdrop"></div>
{{nav}}
    <article class="markdown-body">
{{toc}}
{{content}}
    </article>
{{footer}}<script>
(function() {
    var btn = document.querySelector('.nav-toggle');
    var bd = document.querySelector('.nav-backdrop');
    function toggle() {
        document.body.classList.toggle('nav-open');
        btn.setAttribute('aria-expanded', document.body.classList.contains('nav-open'));
    }
    function close() {
        document.body.classList.remove('nav-open');
        btn.setAttribute('aria-expanded', 'false');
    }
    if (btn) btn.addEventListener('click', toggle);
    if (bd) bd.addEventListener('click', close);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
})();
</script>
</body>
</html>
\`;

export const LAYOUT_BLOG = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&display=swap" rel="stylesheet">
    {{stylesheets}}{{meta}}
</head>
<body data-layout="blog">
{{header}}    <article class="blog-post">
{{home-link}}{{heading}}{{image}}{{date}}{{author}}{{toc}}
{{content}}
    </article>
{{footer}}</body>
</html>
\`;

export const LAYOUT_MINIMAL = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&display=swap" rel="stylesheet">
    {{stylesheets}}{{meta}}
</head>
<body data-layout="minimal">
{{header}}    <article>
{{content}}
    </article>
{{footer}}</body>
</html>
\`;

export const LAYOUT_TEMPLATES: Record<string, string> = {
    docs: LAYOUT_DOCS,
    blog: LAYOUT_BLOG,
    minimal: LAYOUT_MINIMAL,
};

export const THEME_DEFAULT = \`${css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

export const THEME_TEMPLATES: Record<string, string> = {
    default: THEME_DEFAULT,
};
`;

const outPath = resolve(__dirname, '../../../vs-code-extension/src/templates/tailwind.ts');
writeFileSync(outPath, output, 'utf-8');
console.log(`Written ${outPath}`);
