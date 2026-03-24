import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { WikilinkService, wikilinkPlugin, FrontMatterService, type FrontMatterFields } from 'as-notes-common';
import { FileResolver, slugify, type PageEntry } from './FileResolver.js';
import { taskTagPlugin } from './TaskTagPlugin.js';

interface PublishConfig {
    inputDir?: string;
    defaultPublic?: boolean;
    defaultAssets?: boolean;
    layout?: string;
    layouts?: string;
    includes?: string;
    theme?: string;
    themes?: string;
    baseUrl?: string;
    retina?: boolean;
    includeDrafts?: boolean;
    stylesheets?: string[];
    exclude?: string[];
    outputDir?: string;
}

interface CliArgs {
    input: string;
    output: string;
    config: string;
    stylesheets: string[];
    assets: string[];
    exclude: string[];
    defaultPublic: boolean;
    defaultAssets: boolean;
    layout: string;
    layouts: string;
    includes: string;
    theme: string;
    themes: string;
    retina: boolean;
    baseUrl: string;
    includeDrafts: boolean;
}

const DEFAULT_EXCLUDES = ['templates', 'node_modules'];

function loadConfigFile(configPath: string): PublishConfig {
    const resolved = path.resolve(configPath);
    if (!fs.existsSync(resolved)) {
        console.error(`Config file not found: ${resolved}`);
        process.exit(1);
    }
    const raw = fs.readFileSync(resolved, 'utf-8');
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            console.error(`Config file must contain a JSON object: ${resolved}`);
            process.exit(1);
        }
        return parsed as PublishConfig;
    } catch {
        console.error(`Invalid JSON in config file: ${resolved}`);
        process.exit(1);
    }
}

function parseArgs(argv: string[]): CliArgs {
    let input = '';
    let output = '';
    let config = '';
    const stylesheets: string[] = [];
    const assets: string[] = [];
    const exclude: string[] = [];
    let defaultPublic = false;
    let defaultAssets = false;
    let layout = '';
    let layouts = '';
    let includes = '';
    let theme = '';
    let themes = '';
    let retina = false;
    let baseUrl = '';
    let includeDrafts = false;

    // Track which flags were explicitly set on the CLI
    const cliSet = new Set<string>();

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--input' && i + 1 < argv.length) {
            input = argv[++i]; cliSet.add('input');
        } else if (argv[i] === '--output' && i + 1 < argv.length) {
            output = argv[++i]; cliSet.add('output');
        } else if (argv[i] === '--config' && i + 1 < argv.length) {
            config = argv[++i];
        } else if (argv[i] === '--stylesheet' && i + 1 < argv.length) {
            stylesheets.push(argv[++i]); cliSet.add('stylesheets');
        } else if (argv[i] === '--asset' && i + 1 < argv.length) {
            assets.push(argv[++i]);
        } else if (argv[i] === '--default-public') {
            defaultPublic = true; cliSet.add('defaultPublic');
        } else if (argv[i] === '--default-assets') {
            defaultAssets = true; cliSet.add('defaultAssets');
        } else if (argv[i] === '--layout' && i + 1 < argv.length) {
            layout = argv[++i]; cliSet.add('layout');
        } else if (argv[i] === '--layouts' && i + 1 < argv.length) {
            layouts = argv[++i]; cliSet.add('layouts');
        } else if (argv[i] === '--includes' && i + 1 < argv.length) {
            includes = argv[++i]; cliSet.add('includes');
        } else if (argv[i] === '--themes' && i + 1 < argv.length) {
            themes = argv[++i]; cliSet.add('themes');
        } else if (argv[i] === '--theme' && i + 1 < argv.length) {
            theme = argv[++i]; cliSet.add('theme');
        } else if (argv[i] === '--retina') {
            retina = true; cliSet.add('retina');
        } else if (argv[i] === '--base-url' && i + 1 < argv.length) {
            baseUrl = argv[++i].replace(/\/+$/, ''); cliSet.add('baseUrl');
        } else if (argv[i] === '--include-drafts') {
            includeDrafts = true; cliSet.add('includeDrafts');
        } else if (argv[i] === '--exclude' && i + 1 < argv.length) {
            exclude.push(argv[++i]); cliSet.add('exclude');
        }
    }

    // Merge config file values (CLI flags take precedence)
    if (config) {
        const configDir = path.dirname(path.resolve(config));
        const cfg = loadConfigFile(config);

        if (!cliSet.has('defaultPublic') && cfg.defaultPublic != null) defaultPublic = cfg.defaultPublic;
        if (!cliSet.has('defaultAssets') && cfg.defaultAssets != null) defaultAssets = cfg.defaultAssets;
        if (!cliSet.has('layout') && cfg.layout) layout = cfg.layout;
        if (!cliSet.has('theme') && cfg.theme) theme = cfg.theme;
        if (!cliSet.has('baseUrl') && cfg.baseUrl != null) baseUrl = String(cfg.baseUrl).replace(/\/+$/, '');
        if (!cliSet.has('retina') && cfg.retina != null) retina = cfg.retina;
        if (!cliSet.has('includeDrafts') && cfg.includeDrafts != null) includeDrafts = cfg.includeDrafts;
        if (!cliSet.has('stylesheets') && Array.isArray(cfg.stylesheets)) {
            for (const s of cfg.stylesheets) { if (typeof s === 'string') stylesheets.push(s); }
        }
        if (!cliSet.has('exclude') && Array.isArray(cfg.exclude)) {
            for (const e of cfg.exclude) { if (typeof e === 'string') exclude.push(e); }
        }
        if (!cliSet.has('layouts') && cfg.layouts) layouts = path.resolve(configDir, cfg.layouts);
        if (!cliSet.has('themes') && cfg.themes) themes = path.resolve(configDir, cfg.themes);
        if (!cliSet.has('includes') && cfg.includes) includes = path.resolve(configDir, cfg.includes);

        // Default --input to config's inputDir (resolved relative to config dir), then config file's parent directory
        if (!input && cfg.inputDir) input = path.resolve(configDir, cfg.inputDir);
        if (!input) input = configDir;
        // Default --output from config outputDir (resolved relative to config dir)
        if (!output && cfg.outputDir) output = path.resolve(configDir, cfg.outputDir);
    }

    // Apply default layout when neither CLI nor config set it
    if (!layout) layout = 'docs';

    if (!input || !output) {
        console.error('Usage: asnotes-publish --input <dir> --output <dir> [options]');
        console.error('       asnotes-publish --config <file> [options]');
        console.error('');
        console.error('Options:');
        console.error('  --config <file>           Load settings from a JSON config file');
        console.error('  --stylesheet <url|file>   Add a stylesheet (repeatable)');
        console.error('  --asset <file>            Copy an asset file to output (repeatable)');
        console.error('  --default-public          Treat pages as public unless public: false');
        console.error('  --default-assets          Copy referenced assets unless assets: false');
        console.error('  --layout <name>           Layout template: docs, blog, minimal (default: docs)');
        console.error('  --layouts <path>          Directory containing layout template files');
        console.error('  --includes <path>         Directory for custom headers and footers');
        console.error('  --theme <name>            Built-in CSS theme name');
        console.error('  --themes <path>           Directory containing custom theme CSS files');
        console.error('  --retina                  Enable retina image sizing globally');
        console.error('  --base-url <prefix>       URL path prefix for links/assets');
        console.error('  --include-drafts          Include pages with draft: true');
        console.error('  --exclude <dirname>       Exclude a directory from scanning (repeatable)');
        console.error('');
        console.error('When --config is used, --input defaults to the config file\'s directory.');
        console.error('CLI flags override config file values.');
        console.error('');
        console.error('Default excluded directories: ' + DEFAULT_EXCLUDES.join(', '));
        process.exit(1);
    }

    return { input: path.resolve(input), output: path.resolve(output), config, stylesheets, assets, exclude, defaultPublic, defaultAssets, layout, layouts, includes, theme, themes, retina, baseUrl, includeDrafts };
}

interface ScannedFile {
    /** Path relative to the input root (e.g. 'notes/My Page.md') */
    relativePath: string;
    /** Filename only (e.g. 'My Page.md') */
    filename: string;
}

function scanMarkdownFiles(dir: string, excludeDirs: string[] = []): ScannedFile[] {
    const allExcludes = new Set([...DEFAULT_EXCLUDES, ...excludeDirs].map(d => d.toLowerCase()));
    const results: ScannedFile[] = [];

    function walk(currentDir: string, relativePrefix: string): void {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!allExcludes.has(entry.name.toLowerCase())) {
                    walk(path.join(currentDir, entry.name), relativePrefix ? relativePrefix + '/' + entry.name : entry.name);
                }
            } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('.enc.md')) {
                results.push({
                    relativePath: relativePrefix ? relativePrefix + '/' + entry.name : entry.name,
                    filename: entry.name,
                });
            }
        }
    }

    walk(dir, '');
    results.sort((a, b) => a.filename.localeCompare(b.filename));
    return results;
}

function stripBrackets(text: string): string {
    return text.replace(/\[\[|\]\]/g, '');
}

/** Render a page name as wikilink-aware HTML. Names containing [[ ]] are
 *  rendered through markdown-it so nested wikilinks produce separate <a> tags. */
function renderPageName(md: MarkdownIt, name: string, baseUrl: string): string {
    if (!name.includes('[[')) {
        return escapeHtml(name);
    }
    const wikilinkText = `[[${name}]]`;
    let html = md.renderInline(wikilinkText);
    if (baseUrl) {
        html = html.replace(/href="([^"]*\.html(?:#[^"]*)?)"/g, (match, href) => {
            if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')) {
                return match;
            }
            return `href="${baseUrl}/${href}"`;
        });
    }
    return html;
}

function buildNav(pages: PageEntry[], currentPage: string, baseUrl: string, md?: MarkdownIt): string {
    const items = pages.map(p => {
        const isCurrent = p.name === currentPage ? ' class="nav-current"' : '';
        const rawName = p.name === 'index' ? 'Home' : (p.title || p.name);
        if (md && rawName.includes('[[')) {
            const rendered = renderPageName(md, rawName, baseUrl);
            return `        <li${isCurrent}>${rendered}</li>`;
        }
        const href = baseUrl ? baseUrl + '/' + p.href : p.href;
        return `        <li${isCurrent}><a href="${href}">${escapeHtml(stripBrackets(rawName))}</a></li>`;
    });

    return `    <nav class="site-nav">\n      <ul>\n${items.join('\n')}\n      </ul>\n    </nav>`;
}

/**
 * Load an HTML partial file from the includes directory.
 * Returns undefined if includesDir is not set or the file does not exist.
 */
function loadPartial(includesDir: string | undefined, filename: string): string | undefined {
    if (!includesDir) return undefined;
    const partialPath = path.join(includesDir, filename);
    if (!fs.existsSync(partialPath)) return undefined;
    return fs.readFileSync(partialPath, 'utf-8');
}

function wrapHtml(title: string, nav: string, body: string, options: {
    stylesheets?: string[];
    description?: string;
    date?: string;
    toc?: string;
    layout?: string;
    layoutsDir?: string;
    includesDir?: string;
    baseUrl?: string;
} = {}): string {
    const { stylesheets = [], description, date, toc, layout = 'docs', layoutsDir, includesDir, baseUrl = '' } = options;

    const escapedTitle = escapeHtml(title);
    const headerPartial = loadPartial(includesDir, 'header.html');
    const footerPartial = loadPartial(includesDir, 'footer.html');

    const templateVars = {
        title: escapedTitle, nav, content: body, stylesheets, description, date, toc, baseUrl,
        header: headerPartial, footer: footerPartial,
    };

    // Try user-defined layout: layoutsDir first, then includesDir (backwards compat), then built-in
    if (layoutsDir) {
        const layoutPath = path.join(layoutsDir, layout + '.html');
        if (fs.existsSync(layoutPath)) {
            return applyTemplate(fs.readFileSync(layoutPath, 'utf-8'), templateVars);
        }
    }
    if (includesDir) {
        const customLayoutPath = path.join(includesDir, layout + '.html');
        if (fs.existsSync(customLayoutPath)) {
            return applyTemplate(fs.readFileSync(customLayoutPath, 'utf-8'), templateVars);
        }
    }

    // Built-in layouts
    const builtIn = getBuiltInLayout(layout);
    return applyTemplate(builtIn, templateVars);
}

function applyTemplate(template: string, vars: {
    title: string; nav: string; content: string; stylesheets: string[];
    description?: string; date?: string; toc?: string; baseUrl: string;
    header?: string; footer?: string;
}): string {
    const linkTags = vars.stylesheets.length > 0
        ? '\n' + vars.stylesheets.map(s => `    <link rel="stylesheet" href="${escapeHtml(s)}">`).join('\n')
        : '';
    const metaDesc = vars.description
        ? `\n    <meta name="description" content="${escapeHtml(vars.description)}">`
        : '';
    const dateHtml = vars.date
        ? `    <time class="page-date" datetime="${escapeHtml(vars.date)}">${escapeHtml(vars.date)}</time>\n`
        : '';
    const tocHtml = vars.toc || '';

    // Process header/footer partials: wrap in semantic elements if content exists, otherwise emit HTML comments
    let headerHtml: string;
    if (vars.header) {
        // Apply token replacement within the partial itself
        const processedHeader = vars.header
            .replace(/\{\{base-url\}\}/g, vars.baseUrl)
            .replace(/\{\{title\}\}/g, vars.title);
        headerHtml = `<header>\n${processedHeader}\n</header>\n`;
    } else {
        headerHtml = '<!-- header -->\n';
    }

    let footerHtml: string;
    if (vars.footer) {
        const processedFooter = vars.footer
            .replace(/\{\{base-url\}\}/g, vars.baseUrl)
            .replace(/\{\{title\}\}/g, vars.title);
        footerHtml = `<footer>\n${processedFooter}\n</footer>\n`;
    } else {
        footerHtml = '<!-- footer -->\n';
    }

    return template
        .replace(/\{\{title\}\}/g, vars.title)
        .replace(/\{\{header\}\}/g, headerHtml)
        .replace(/\{\{nav\}\}/g, vars.nav)
        .replace(/\{\{content\}\}/g, vars.content)
        .replace(/\{\{stylesheets\}\}/g, linkTags)
        .replace(/\{\{meta\}\}/g, metaDesc)
        .replace(/\{\{date\}\}/g, dateHtml)
        .replace(/\{\{toc\}\}/g, tocHtml)
        .replace(/\{\{footer\}\}/g, footerHtml)
        .replace(/\{\{base-url\}\}/g, vars.baseUrl);
}

function getBuiltInLayout(name: string): string {
    switch (name) {
        case 'blog':
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>{{stylesheets}}{{meta}}
</head>
<body data-layout="blog">
{{header}}    <article class="blog-post">
{{date}}{{toc}}
{{content}}
    </article>
{{nav}}{{footer}}</body>
</html>
`;
        case 'minimal':
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>{{stylesheets}}{{meta}}
</head>
<body data-layout="minimal">
{{header}}    <article>
{{content}}
    </article>
{{footer}}</body>
</html>
`;
        case 'docs':
        default:
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>{{stylesheets}}{{meta}}
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
`;
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

interface AssetRef {
    /** Original src attribute value from HTML */
    originalRef: string;
    /** Resolved path relative to output root (used for both HTML rewriting and copy destination) */
    outputRelPath: string;
    /** Absolute source path on disk */
    absSource: string;
}

/**
 * Extract image/asset references from rendered HTML, resolving paths relative to
 * the page's source location. Returns resolved refs suitable for path rewriting and copying.
 */
function discoverAssetRefs(html: string, pageRelativePath: string, inputDir: string): AssetRef[] {
    const refs: AssetRef[] = [];
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(html)) !== null) {
        const src = decodeURIComponent(match[1]);
        // Skip absolute URLs and data URIs
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
            continue;
        }

        // Resolve absolute source path from the page's directory within the input dir
        const pageDir = path.dirname(path.join(inputDir, pageRelativePath));
        const absSource = path.resolve(pageDir, src);

        // Compute output-relative path
        const relToInput = path.relative(inputDir, absSource);
        let outputRelPath: string;
        if (!relToInput.startsWith('..')) {
            // Asset is within the input directory
            outputRelPath = relToInput.split(path.sep).join('/');
        } else {
            // Asset is outside the input directory: strip leading ../ segments
            const normalized = relToInput.split(path.sep).join('/');
            outputRelPath = normalized.replace(/^(\.\.\/)+/, '');
        }

        refs.push({ originalRef: match[1], outputRelPath, absSource });
    }
    return refs;
}

/** Rewrite asset src attributes in HTML to use resolved output-relative paths. */
function rewriteAssetPaths(html: string, refs: AssetRef[], baseUrl: string): string {
    let result = html;
    for (const ref of refs) {
        const prefix = baseUrl ? baseUrl + '/' : '';
        result = result.split(`src="${ref.originalRef}"`).join(`src="${prefix}${ref.outputRelPath}"`);
    }
    return result;
}

/** Copy asset files to output using pre-resolved paths. */
function copyAssets(assetRefs: AssetRef[], outputDir: string): { copied: number; warnings: string[] } {
    const warnings: string[] = [];
    let copied = 0;
    const seen = new Set<string>();

    for (const ref of assetRefs) {
        // Dedup by absolute source path
        if (seen.has(ref.absSource)) continue;
        seen.add(ref.absSource);

        if (!fs.existsSync(ref.absSource)) {
            warnings.push(`Referenced asset not found: ${ref.originalRef}`);
            continue;
        }

        const destPath = path.join(outputDir, ref.outputRelPath);

        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(ref.absSource, destPath);
        copied++;
        console.log(`  [asset] ${ref.outputRelPath}`);
    }

    return { copied, warnings };
}

/** Generate a table of contents from headings in HTML. */
function generateToc(html: string): string {
    const headingRegex = /<h([2-4])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[2-4]>/gi;
    const items: { level: number; id: string; text: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(html)) !== null) {
        items.push({ level: parseInt(match[1]), id: match[2], text: match[3].replace(/<[^>]+>/g, '') });
    }

    if (items.length === 0) return '';

    const lines = ['    <nav class="toc">', '      <details open>', '        <summary>Contents</summary>', '        <ul>'];
    for (const item of items) {
        const indent = '          '.repeat(item.level - 1);
        lines.push(`${indent}<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`);
    }
    lines.push('        </ul>', '      </details>', '    </nav>');
    return lines.join('\n');
}

/** Auto-add heading IDs for TOC linking. */
function addHeadingIds(md: MarkdownIt): void {
    const originalHeadingOpen = md.renderer.rules.heading_open;
    md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        // Get the text content from the next inline token
        const inlineToken = tokens[idx + 1];
        if (inlineToken && inlineToken.children) {
            const text = inlineToken.children
                .filter(t => t.type === 'text' || t.type === 'code_inline')
                .map(t => t.content)
                .join('');
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            if (id) {
                token.attrSet('id', id);
            }
        }
        if (originalHeadingOpen) {
            return originalHeadingOpen(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
    };
}

/** Read the width of an image from its file header (PNG, JPEG, GIF, WebP, BMP). */
function getImageWidth(filePath: string): number | undefined {
    try {
        const fd = fs.openSync(filePath, 'r');
        try {
            const header = Buffer.alloc(30);
            fs.readSync(fd, header, 0, 30, 0);

            // PNG: bytes 0-7 signature, IHDR chunk at byte 16 has width (4 bytes big-endian)
            if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
                return header.readUInt32BE(16);
            }

            // GIF: 'GIF8' signature, width at byte 6 (little-endian 16-bit)
            if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
                return header.readUInt16LE(6);
            }

            // BMP: 'BM' signature, width at byte 18 (little-endian 32-bit)
            if (header[0] === 0x42 && header[1] === 0x4D) {
                return header.readInt32LE(18);
            }

            // WebP: 'RIFF' + size + 'WEBP', then VP8 chunk
            if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
                // Read more bytes for VP8 header parsing
                const webpBuf = Buffer.alloc(64);
                fs.readSync(fd, webpBuf, 0, 64, 0);
                const chunkType = webpBuf.toString('ascii', 12, 16);
                if (chunkType === 'VP8 ') {
                    // Lossy: width at byte 26-27 (little-endian, 14-bit)
                    return webpBuf.readUInt16LE(26) & 0x3FFF;
                } else if (chunkType === 'VP8L') {
                    // Lossless: 1 byte signature at 21, then 14-bit width at bits 0-13
                    const bits = webpBuf.readUInt32LE(21);
                    return (bits & 0x3FFF) + 1;
                } else if (chunkType === 'VP8X') {
                    // Extended: canvas width at bytes 24-26 (24-bit little-endian + 1)
                    return (webpBuf[24] | (webpBuf[25] << 8) | (webpBuf[26] << 16)) + 1;
                }
                return undefined;
            }

            // JPEG: 0xFFD8 signature, scan for SOF markers
            if (header[0] === 0xFF && header[1] === 0xD8) {
                const stat = fs.fstatSync(fd);
                const size = Math.min(stat.size, 65536);
                const buf = Buffer.alloc(size);
                fs.readSync(fd, buf, 0, size, 0);
                let offset = 2;
                while (offset + 9 < size) {
                    if (buf[offset] !== 0xFF) break;
                    const marker = buf[offset + 1];
                    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
                    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
                        (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
                        return buf.readUInt16BE(offset + 7);
                    }
                    const segLen = buf.readUInt16BE(offset + 2);
                    offset += 2 + segLen;
                }
            }
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        // File not found or unreadable - return undefined
    }
    return undefined;
}

/** Retina markdown-it plugin: transforms {.retina} attribute on images. */
function retinaPlugin(md: MarkdownIt, opts: { globalRetina: boolean; pageRetina: boolean; pageDir: string; inputDir: string }): void {
    const defaultRender = md.renderer.rules.image || function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const srcAttr = token.attrGet('src') || '';
        const altText = token.content || '';

        // Check if the alt text or surrounding content contains {.retina}
        let isRetina = opts.globalRetina || opts.pageRetina;

        // Check for {.retina} marker in alt text
        if (altText.includes('{.retina}')) {
            isRetina = true;
            const cleaned = altText.replace(/\s*\{\.retina\}\s*/g, '').trim();
            token.content = cleaned;
            // Also strip from children (markdown-it builds alt from children)
            if (token.children) {
                for (const child of token.children) {
                    if (child.content.includes('{.retina}')) {
                        child.content = child.content.replace(/\s*\{\.retina\}\s*/g, '').trim();
                    }
                }
            }
        }

        if (isRetina && isImageFile(srcAttr)) {
            token.attrSet('class', ((token.attrGet('class') || '') + ' retina').trim());

            // Auto-set width to half intrinsic width for retina display
            if (!token.attrGet('width') && !srcAttr.startsWith('http://') && !srcAttr.startsWith('https://') && !srcAttr.startsWith('data:')) {
                const absPath = path.resolve(opts.pageDir, decodeURIComponent(srcAttr));
                const intrinsicWidth = getImageWidth(absPath);
                if (intrinsicWidth && intrinsicWidth > 1) {
                    token.attrSet('width', String(Math.round(intrinsicWidth / 2)));
                }
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.bmp', '.tiff', '.ico']);

function isImageFile(src: string): boolean {
    const ext = path.extname(src).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
}

/** Generate CSS for retina images. */
function getRetinaCss(): string {
    return `
    img.retina {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
    }
    img.retina[width] {
        /* When width attribute is present, retina images render at that explicit size */
    }`;
}

function generateSitemap(pages: PageEntry[], baseUrl: string): string {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
    for (const page of pages) {
        const loc = baseUrl ? `${baseUrl}/${page.href}` : page.href;
        lines.push('  <url>');
        lines.push(`    <loc>${escapeXml(loc)}</loc>`);
        if (page.date) {
            lines.push(`    <lastmod>${escapeXml(page.date)}</lastmod>`);
        }
        lines.push('  </url>');
    }
    lines.push('</urlset>');
    return lines.join('\n');
}

function generateRssFeed(pages: PageEntry[], baseUrl: string, siteTitle: string): string {
    const pagesWithDates = pages
        .filter(p => p.date)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const items = pagesWithDates.map(p => {
        const link = baseUrl ? `${baseUrl}/${p.href}` : p.href;
        return `    <item>
      <title>${escapeXml(p.title || p.name)}</title>
      <link>${escapeXml(link)}</link>
      ${p.description ? `<description>${escapeXml(p.description)}</description>` : ''}
      <pubDate>${escapeXml(p.date || '')}</pubDate>
    </item>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(baseUrl || '/')}</link>
    <description>${escapeXml(siteTitle)} RSS Feed</description>
    ${items.join('\n')}
  </channel>
</rss>`;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function main(): void {
    const args = parseArgs(process.argv);
    const { input, output, stylesheets, assets, exclude, defaultPublic, defaultAssets, layout, layouts, includes, theme, themes, retina, baseUrl, includeDrafts } = args;
    const frontMatterService = new FrontMatterService();
    const resolvedLayoutsDir = layouts ? path.resolve(layouts) : undefined;
    const resolvedThemesDir = themes ? path.resolve(themes) : undefined;
    const resolvedIncludesDir = includes ? path.resolve(includes) : undefined;

    // Wipe output directory
    if (fs.existsSync(output)) {
        fs.rmSync(output, { recursive: true, force: true });
    }
    fs.mkdirSync(output, { recursive: true });

    // Copy explicit --asset files into output directory
    for (const assetPath of assets) {
        const resolvedAsset = path.resolve(assetPath);
        const assetFilename = path.basename(resolvedAsset);
        fs.copyFileSync(resolvedAsset, path.join(output, assetFilename));
        console.log(`  [asset] ${assetFilename}`);
    }

    // Auto-copy local stylesheets to output (Iteration 4E)
    const resolvedStylesheets: string[] = [];
    for (const s of stylesheets) {
        if (s.startsWith('http://') || s.startsWith('https://')) {
            resolvedStylesheets.push(s);
        } else {
            // Local file - copy to output and reference by filename
            const resolvedPath = path.resolve(s);
            if (fs.existsSync(resolvedPath)) {
                const filename = path.basename(resolvedPath);
                fs.copyFileSync(resolvedPath, path.join(output, filename));
                resolvedStylesheets.push((baseUrl ? baseUrl + '/' : '') + filename);
                console.log(`  [stylesheet] ${filename}`);
            } else {
                console.warn(`  [warning] Stylesheet not found: ${s}`);
                resolvedStylesheets.push(s);
            }
        }
    }

    // Add theme CSS if specified: custom themes directory takes precedence over built-in
    if (theme) {
        let themeCss: string | null = null;
        const themeFile = `theme-${theme}.css`;
        if (resolvedThemesDir) {
            const customThemePath = path.join(resolvedThemesDir, `${theme}.css`);
            if (fs.existsSync(customThemePath)) {
                themeCss = fs.readFileSync(customThemePath, 'utf-8');
                console.log(`  [theme] ${themeFile} (custom)`);
            }
        }
        if (!themeCss) {
            themeCss = getBuiltInThemeCss(theme);
            if (themeCss) {
                console.log(`  [theme] ${themeFile}`);
            }
        }
        if (themeCss) {
            fs.writeFileSync(path.join(output, themeFile), themeCss, 'utf-8');
            resolvedStylesheets.unshift((baseUrl ? baseUrl + '/' : '') + themeFile);
        } else {
            console.log(`  [warning] Unknown theme: ${theme}`);
        }
    }

    // Add retina CSS if needed
    if (retina) {
        const retinaFile = 'retina.css';
        fs.writeFileSync(path.join(output, retinaFile), getRetinaCss(), 'utf-8');
        resolvedStylesheets.push((baseUrl ? baseUrl + '/' : '') + retinaFile);
    }

    // Scan input for markdown files (recursive, with directory exclusion)
    const scannedFiles = scanMarkdownFiles(input, exclude)
        .filter(f => f.filename.toLowerCase() !== 'nav.md'); // nav.md is consumed for navigation, not published
    if (scannedFiles.length === 0) {
        console.error(`No .md files found in ${input}`);
        process.exit(1);
    }

    // Detect filename collisions from different subdirectories
    const seenFilenames = new Map<string, string>();
    for (const f of scannedFiles) {
        const key = f.filename.toLowerCase();
        const prev = seenFilenames.get(key);
        if (prev && prev !== f.relativePath) {
            console.warn(`  [warning] Filename collision: "${f.relativePath}" and "${prev}" share the same name. The later file will overwrite.`);
        }
        seenFilenames.set(key, f.relativePath);
    }

    // Build a map from page name (filename without .md) to relative path for reading
    const pageSourcePath = new Map<string, string>();
    // Flat filenames for FileResolver
    const flatFilenames: string[] = [];

    // Read front matter for each file and determine public/draft status
    const pageMetadata = new Map<string, { fields: FrontMatterFields; content: string }>();
    const publicPages = new Set<string>();
    const nonPublicPages = new Set<string>();

    for (const scanned of scannedFiles) {
        const pageName = scanned.filename.replace(/\.md$/i, '');
        const inputPath = path.join(input, scanned.relativePath);
        const content = fs.readFileSync(inputPath, 'utf-8');
        const fields = frontMatterService.parseFrontMatterFields(content);

        pageMetadata.set(pageName, { fields, content });
        pageSourcePath.set(pageName, scanned.relativePath);

        // Only add to flat filenames if not already present (collision case: last wins)
        if (!flatFilenames.includes(scanned.filename)) {
            flatFilenames.push(scanned.filename);
        }

        // Draft filtering (Iteration 6E)
        if (fields.draft && !includeDrafts) {
            nonPublicPages.add(pageName);
            continue;
        }

        const isPublic = fields.public !== undefined ? fields.public : defaultPublic;
        if (isPublic) {
            publicPages.add(pageName);
        } else {
            nonPublicPages.add(pageName);
        }
    }

    if (publicPages.size === 0) {
        console.error('No public pages found. Use front matter `public: true` or pass --default-public.');
        process.exit(1);
    }

    // Build resolver from ALL flat filenames (so wikilinks resolve even to non-public pages)
    const resolver = new FileResolver(flatFilenames);

    // Build navigation from public pages with metadata (Iteration 3)
    const navPages: PageEntry[] = resolver.listPages()
        .filter(p => publicPages.has(p.name))
        .map(p => {
            const meta = pageMetadata.get(p.name);
            return {
                ...p,
                title: meta?.fields.title,
                order: meta?.fields.order,
                date: meta?.fields.date,
                description: meta?.fields.description,
            };
        });

    // Sort nav: ordered pages first (by order value), then unordered alphabetically (Iteration 3B)
    navPages.sort((a, b) => {
        // index always first
        if (a.name === 'index') return -1;
        if (b.name === 'index') return 1;

        const aHasOrder = a.order !== undefined;
        const bHasOrder = b.order !== undefined;

        if (aHasOrder && bHasOrder) return a.order! - b.order!;
        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;

        // Both unordered: alphabetical by display name
        const aName = a.title || a.name;
        const bName = b.title || b.name;
        return aName.localeCompare(bName);
    });

    // Auto-generate index page if no index.md exists among public pages (Iteration 11B)
    const needsAutoIndex = !publicPages.has('index');
    if (needsAutoIndex) {
        navPages.unshift({ name: 'index', href: 'index.html', title: 'Home' });
    }

    // Set up markdown-it with plugins
    const wikilinkService = new WikilinkService();
    const md = new MarkdownIt({ html: true });
    wikilinkPlugin(md, {
        wikilinkService,
        resolver: resolver.createResolverFn(),
    });
    md.use(taskTagPlugin);

    // Add heading IDs for TOC support (Iteration 6D)
    addHeadingIds(md);

    // Markdown-it instance for nav rendering (wikilink-aware page names)
    const navMd = new MarkdownIt({ html: true });
    wikilinkPlugin(navMd, {
        wikilinkService,
        resolver: resolver.createResolverFn(),
    });

    // Custom navigation from nav.md (Iteration 12J)
    let customNav: string | undefined;
    const navMdPath = path.join(input, 'nav.md');
    if (fs.existsSync(navMdPath)) {
        const navContent = fs.readFileSync(navMdPath, 'utf-8');
        let navHtml = navMd.render(frontMatterService.stripFrontMatter(navContent));
        // Prepend baseUrl to resolved wikilink hrefs (they come out as e.g. "my-page.html")
        if (baseUrl) {
            navHtml = navHtml.replace(/href="([^"]*\.html(?:#[^"]*)?)"/g, (match, href) => {
                // Only rewrite relative hrefs (not absolute URLs)
                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')) {
                    return match;
                }
                return `href="${baseUrl}/${href}"`;
            });
        }
        customNav = `    <nav class="site-nav">\n${navHtml}    </nav>`;
        console.log('  [nav] Using custom navigation from nav.md');
    }

    // Convert only public pages
    let warningCount = 0;
    let assetsCopied = 0;
    const allAssetRefs: AssetRef[] = [];

    for (const pageName of publicPages) {
        const meta = pageMetadata.get(pageName)!;
        const outputPath = path.join(output, slugify(pageName) + '.html');

        // Retina: page-level or global (Iteration 5)
        const pageRetina = meta.fields.retina === true;
        const effectiveRetina = retina || pageRetina;

        // Apply retina plugin per-page
        const pageMd = new MarkdownIt({ html: true });
        wikilinkPlugin(pageMd, {
            wikilinkService,
            resolver: resolver.createResolverFn(),
        });
        pageMd.use(taskTagPlugin);
        addHeadingIds(pageMd);
        const pageRelPath = pageSourcePath.get(pageName) || pageName + '.md';
        const pageDir = path.dirname(path.join(input, pageRelPath));
        retinaPlugin(pageMd, { globalRetina: retina, pageRetina, pageDir, inputDir: input });

        // Strip front matter before rendering
        const strippedMarkdown = frontMatterService.stripFrontMatter(meta.content);
        let htmlBody = pageMd.render(strippedMarkdown);

        // Asset discovery, path rewriting, and copying (Iteration 2, 12J)
        const assetsEnabled = meta.fields.assets !== undefined ? meta.fields.assets : defaultAssets;
        if (assetsEnabled) {
            const refs = discoverAssetRefs(htmlBody, pageRelPath, input);
            htmlBody = rewriteAssetPaths(htmlBody, refs, baseUrl);
            allAssetRefs.push(...refs);
        }

        // Prepend baseUrl to wikilink hrefs in article body (Iteration 12O)
        if (baseUrl) {
            htmlBody = htmlBody.replace(/href="([^"]*\.html(?:#[^"]*)?)"/g, (match, href) => {
                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')) {
                    return match;
                }
                return `href="${baseUrl}/${href}"`;
            });
        }

        // Check for links to non-public pages and log warnings
        for (const npPage of nonPublicPages) {
            const href = resolver.resolve(npPage);
            if (htmlBody.includes(`href="${href}"`)) {
                console.warn(`  [warning] ${pageName} links to non-public page "${npPage}" (dead link)`);
                warningCount++;
            }
        }

        // Title from front matter or filename (Iteration 3A, 12F: strip brackets)
        const title = meta.fields.title
            ? stripBrackets(meta.fields.title)
            : (pageName === 'index' ? 'Home' : stripBrackets(pageName));

        // Per-page layout override (Iteration 4C)
        const pageLayout = meta.fields.layout || layout;

        // Generate TOC (Iteration 6D)
        const toc = generateToc(htmlBody);

        const nav = customNav ?? buildNav(navPages, pageName, baseUrl, navMd);
        const html = wrapHtml(title, nav, htmlBody, {
            stylesheets: resolvedStylesheets,
            description: meta.fields.description,
            date: meta.fields.date,
            toc,
            layout: pageLayout,
            layoutsDir: resolvedLayoutsDir,
            includesDir: resolvedIncludesDir,
            baseUrl,
        });

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`  ${pageName}.md -> ${slugify(pageName)}.html`);
    }

    // Copy discovered assets (Iteration 2, 12J: resolved paths)
    if (allAssetRefs.length > 0) {
        const result = copyAssets(allAssetRefs, output);
        assetsCopied = result.copied;
        for (const w of result.warnings) {
            console.log(`  [warning] ${w}`);
            warningCount++;
        }
    }

    // Generate placeholder pages for missing wikilink targets (excluding non-public pages)
    const missingTargets = resolver.getMissingTargets();

    // Auto-generate index.html if no index.md was found (Iteration 11B)
    // Generate as direct HTML to handle page names with brackets cleanly (Iteration 12F)
    if (needsAutoIndex) {
        const indexItems = navPages
            .filter(p => p.name !== 'index')
            .map(p => {
                const rawName = p.title || p.name;
                if (rawName.includes('[[')) {
                    const rendered = renderPageName(navMd, rawName, baseUrl);
                    return `<li>${rendered}</li>`;
                }
                const href = baseUrl ? baseUrl + '/' + p.href : p.href;
                return `<li><a href="${href}">${escapeHtml(stripBrackets(rawName))}</a></li>`;
            });
        const indexBody = `<h1 id="home">Home</h1>\n<ul>\n${indexItems.join('\n')}\n</ul>`;
        const indexToc = generateToc(indexBody);

        const nav = customNav ?? buildNav(navPages, 'index', baseUrl, navMd);
        const indexHtml = wrapHtml('Home', nav, indexBody, {
            stylesheets: resolvedStylesheets,
            toc: indexToc,
            layout,
            layoutsDir: resolvedLayoutsDir,
            includesDir: resolvedIncludesDir,
            baseUrl,
        });
        fs.writeFileSync(path.join(output, 'index.html'), indexHtml, 'utf-8');
        console.log('  [info] No index.md found - generating page index');
    }
    for (const pageName of missingTargets) {
        if (nonPublicPages.has(pageName) || flatFilenames.some(f => f.replace(/\.md$/i, '').toLowerCase() === pageName.toLowerCase() && nonPublicPages.has(f.replace(/\.md$/i, '')))) {
            continue;
        }

        const outputPath = path.join(output, slugify(pageName) + '.html');
        const nav = customNav ?? buildNav(navPages, pageName, baseUrl, navMd);
        const body = '    <p class="missing-page">This page has not been created yet.</p>';
        const html = wrapHtml(stripBrackets(pageName), nav, body, { stylesheets: resolvedStylesheets, layout, layoutsDir: resolvedLayoutsDir, includesDir: resolvedIncludesDir, baseUrl });

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`  [missing] ${slugify(pageName)}.html (placeholder)`);
    }

    // Generate sitemap.xml (Iteration 6B)
    const sitemapXml = generateSitemap(navPages, baseUrl);
    fs.writeFileSync(path.join(output, 'sitemap.xml'), sitemapXml, 'utf-8');
    console.log('  [sitemap] sitemap.xml');

    // Generate RSS feed (Iteration 6C)
    const rssFeed = generateRssFeed(navPages, baseUrl, 'AS Notes Site');
    fs.writeFileSync(path.join(output, 'feed.xml'), rssFeed, 'utf-8');
    console.log('  [rss] feed.xml');

    const totalFiles = publicPages.size;
    const placeholders = [...missingTargets].filter(t => !nonPublicPages.has(t)).length;
    console.log(`\nConverted ${totalFiles} page(s), generated ${placeholders} placeholder(s) -> ${output}`);
    if (assetsCopied > 0) {
        console.log(`Copied ${assetsCopied} asset(s)`);
    }
    if (nonPublicPages.size > 0) {
        console.log(`Skipped ${nonPublicPages.size} non-public page(s)`);
    }
    if (warningCount > 0) {
        console.log(`${warningCount} warning(s)`);
    }
}

function getBuiltInThemeCss(name: string): string | null {
    switch (name) {
        case 'default':
            return `/* AS Notes default theme */

*,
*::before,
*::after {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
}

/* -- Layout grid -------------------------------------------------- */

body {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #24292e;
    background: #ffffff;
}

/* -- Header / footer ---------------------------------------------- */

header {
    grid-column: 1 / -1;
    grid-row: 1;
}

footer {
    grid-column: 1 / -1;
    grid-row: 3;
}

.site-header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: #f6f8fa;
    border-bottom: 1px solid #d0d7de;
}

.site-header .site-title {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    color: #24292e;
    text-decoration: none;
}

.site-header .site-title:hover {
    color: #0366d6;
}

.site-header .site-logo {
    flex-shrink: 0;
}

.site-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #d0d7de;
    background: #f6f8fa;
    font-size: 0.85rem;
    color: #586069;
    text-align: center;
}

.site-footer a {
    color: #0366d6;
}

/* -- Nav toggle --------------------------------------------------- */

.nav-toggle {
    position: fixed;
    top: 0.6rem;
    right: 1.5rem;
    z-index: 1001;
    background: none;
    border: 1px solid #d0d7de;
    color: #24292e;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    line-height: 1;
}

.nav-toggle:hover {
    background: #eaeef2;
}

/* -- Nav backdrop ------------------------------------------------- */

.nav-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
}

body.nav-open .nav-backdrop {
    display: block;
}

/* -- Flyout sidebar nav ------------------------------------------- */

.site-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    background: #f6f8fa;
    border-right: 1px solid #d0d7de;
    padding: 1.5rem 1rem;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 1000;
    overflow-y: auto;
}

body.nav-open .site-nav {
    transform: translateX(0);
}

.site-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.site-nav ul li {
    margin: 0.2rem 0;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.875rem;
    line-height: 1.4;
    cursor: pointer;
}

.site-nav ul li a {
    text-decoration: none;
    color: #24292f;
}

.site-nav ul li a:hover {
    text-decoration: underline;
}

.site-nav ul li:hover {
    background: #eaeef2;
}

.site-nav ul li:hover a {
    color: #0550ae;
}

.site-nav ul li.nav-current {
    background: #ddf4ff;
    font-weight: 600;
}

.site-nav ul li.nav-current a {
    color: #0550ae;
}

/* -- Content ------------------------------------------------------ */

article {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.markdown-body {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.blog-post {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 1000px;
    margin: 0 auto;
}

/* -- Typography --------------------------------------------------- */

h1, h2, h3, h4 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
}

a {
    color: #0366d6;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/* -- Code --------------------------------------------------------- */

code {
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 85%;
}

pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
}

pre code {
    background: none;
    padding: 0;
}

/* -- Images ------------------------------------------------------- */

img {
    max-width: 100%;
    height: auto;
}

/* -- Table of contents -------------------------------------------- */

.toc {
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    padding: 12px 20px;
    margin-bottom: 24px;
}

.toc summary {
    font-weight: 600;
    cursor: pointer;
}

.toc ul {
    margin: 8px 0 0 0;
}

.toc li {
    margin: 4px 0;
}

/* -- Blog date ---------------------------------------------------- */

.page-date {
    display: block;
    color: #586069;
    font-size: 0.9em;
    margin-bottom: 16px;
}

/* -- Missing page ------------------------------------------------- */

.missing-page {
    color: #cb2431;
    font-style: italic;
}

/* -- Blog layout (single column, nav below content) --------------- */

body[data-layout="blog"] {
    display: block;
}

body[data-layout="blog"] article.blog-post {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem 3rem;
}

body[data-layout="blog"] .nav-toggle,
body[data-layout="blog"] .nav-backdrop {
    display: none;
}

body[data-layout="blog"] .site-nav {
    position: static;
    width: auto;
    transform: none;
    transition: none;
    border-right: none;
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
}

body[data-layout="blog"] .site-nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
}

/* -- Desktop: static sidebar -------------------------------------- */

@media (min-width: 701px) {
    body {
        grid-template-columns: 260px 1fr;
    }

    .nav-toggle,
    .nav-backdrop {
        display: none;
    }

    .site-nav {
        position: static;
        transform: none;
        transition: none;
        z-index: auto;
        grid-column: 1;
        grid-row: 2;
    }

    article,
    article.markdown-body {
        grid-column: 2;
    }

    article.blog-post {
        grid-column: 2;
    }
}

/* -- Mobile ------------------------------------------------------- */

@media (max-width: 700px) {
    article,
    article.markdown-body,
    article.blog-post {
        padding: 1.5rem;
    }
}
`;
        case 'dark':
            return `/* AS Notes dark theme */

*,
*::before,
*::after {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
}

/* -- Layout grid -------------------------------------------------- */

body {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #c9d1d9;
    background: #0d1117;
}

/* -- Header / footer ---------------------------------------------- */

header {
    grid-column: 1 / -1;
    grid-row: 1;
}

footer {
    grid-column: 1 / -1;
    grid-row: 3;
}

.site-header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: #161b22;
    border-bottom: 1px solid #30363d;
}

.site-header .site-title {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    color: #c9d1d9;
    text-decoration: none;
}

.site-header .site-title:hover {
    color: #58a6ff;
}

.site-header .site-logo {
    flex-shrink: 0;
}

.site-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #30363d;
    background: #161b22;
    font-size: 0.85rem;
    color: #8b949e;
    text-align: center;
}

.site-footer a {
    color: #58a6ff;
}

/* -- Nav toggle --------------------------------------------------- */

.nav-toggle {
    position: fixed;
    top: 0.6rem;
    right: 1.5rem;
    z-index: 1001;
    background: none;
    border: 1px solid #30363d;
    color: #c9d1d9;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    line-height: 1;
}

.nav-toggle:hover {
    background: #1f2937;
}

/* -- Nav backdrop ------------------------------------------------- */

.nav-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

body.nav-open .nav-backdrop {
    display: block;
}

/* -- Flyout sidebar nav ------------------------------------------- */

.site-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    background: #161b22;
    border-right: 1px solid #30363d;
    padding: 1.5rem 1rem;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 1000;
    overflow-y: auto;
}

body.nav-open .site-nav {
    transform: translateX(0);
}

.site-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.site-nav ul li {
    margin: 0.2rem 0;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.875rem;
    line-height: 1.4;
    cursor: pointer;
}

.site-nav ul li a {
    text-decoration: none;
    color: #c9d1d9;
}

.site-nav ul li a:hover {
    text-decoration: underline;
}

.site-nav ul li:hover {
    background: #1f2937;
}

.site-nav ul li:hover a {
    color: #58a6ff;
}

.site-nav ul li.nav-current {
    background: #1f2937;
    font-weight: 600;
}

.site-nav ul li.nav-current a {
    color: #58a6ff;
}

/* -- Content ------------------------------------------------------ */

article {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.markdown-body {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.blog-post {
    grid-column: 1;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 1000px;
    margin: 0 auto;
}

/* -- Typography --------------------------------------------------- */

h1, h2, h3, h4 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    color: #f0f6fc;
}

a {
    color: #58a6ff;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/* -- Code --------------------------------------------------------- */

code {
    background: #161b22;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 85%;
}

pre {
    background: #161b22;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
}

pre code {
    background: none;
    padding: 0;
}

/* -- Images ------------------------------------------------------- */

img {
    max-width: 100%;
    height: auto;
}

/* -- Table of contents -------------------------------------------- */

.toc {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px 20px;
    margin-bottom: 24px;
}

.toc summary {
    font-weight: 600;
    cursor: pointer;
    color: #f0f6fc;
}

.toc ul {
    margin: 8px 0 0 0;
}

.toc li {
    margin: 4px 0;
}

/* -- Blog date ---------------------------------------------------- */

.page-date {
    display: block;
    color: #8b949e;
    font-size: 0.9em;
    margin-bottom: 16px;
}

/* -- Missing page ------------------------------------------------- */

.missing-page {
    color: #f85149;
    font-style: italic;
}

/* -- Blog layout (single column, nav below content) --------------- */

body[data-layout="blog"] {
    display: block;
}

body[data-layout="blog"] article.blog-post {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem 3rem;
}

body[data-layout="blog"] .nav-toggle,
body[data-layout="blog"] .nav-backdrop {
    display: none;
}

body[data-layout="blog"] .site-nav {
    position: static;
    width: auto;
    transform: none;
    transition: none;
    border-right: none;
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
}

body[data-layout="blog"] .site-nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
}

/* -- Desktop: static sidebar -------------------------------------- */

@media (min-width: 701px) {
    body {
        grid-template-columns: 260px 1fr;
    }

    .nav-toggle,
    .nav-backdrop {
        display: none;
    }

    .site-nav {
        position: static;
        transform: none;
        transition: none;
        z-index: auto;
        grid-column: 1;
        grid-row: 2;
    }

    article,
    article.markdown-body {
        grid-column: 2;
    }

    article.blog-post {
        grid-column: 2;
    }
}

/* -- Mobile ------------------------------------------------------- */

@media (max-width: 700px) {
    article,
    article.markdown-body,
    article.blog-post {
        padding: 1.5rem;
    }
}
`;
        default:
            return null;
    }
}

main();
