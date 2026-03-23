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
    includes?: string;
    theme?: string;
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
    includes: string;
    theme: string;
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
    let includes = '';
    let theme = '';
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
        } else if (argv[i] === '--includes' && i + 1 < argv.length) {
            includes = argv[++i]; cliSet.add('includes');
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
        console.error('Usage: as-notes-convert --input <dir> --output <dir> [options]');
        console.error('       as-notes-convert --config <file> [options]');
        console.error('');
        console.error('Options:');
        console.error('  --config <file>           Load settings from a JSON config file');
        console.error('  --stylesheet <url|file>   Add a stylesheet (repeatable)');
        console.error('  --asset <file>            Copy an asset file to output (repeatable)');
        console.error('  --default-public          Treat pages as public unless public: false');
        console.error('  --default-assets          Copy referenced assets unless assets: false');
        console.error('  --layout <name>           Layout template: docs, blog, minimal (default: docs)');
        console.error('  --includes <path>         Directory for custom layouts, headers, and footers');
        console.error('  --theme <name>            Built-in CSS theme name');
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

    return { input: path.resolve(input), output: path.resolve(output), config, stylesheets, assets, exclude, defaultPublic, defaultAssets, layout, includes, theme, retina, baseUrl, includeDrafts };
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
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
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

function buildNav(pages: PageEntry[], currentPage: string, baseUrl: string): string {
    const items = pages.map(p => {
        const isCurrent = p.name === currentPage ? ' class="nav-current"' : '';
        const displayName = p.name === 'index' ? 'Home' : stripBrackets(p.title || p.name);
        const href = baseUrl ? baseUrl + '/' + p.href : p.href;
        return `        <li${isCurrent}><a href="${href}">${escapeHtml(displayName)}</a></li>`;
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
    includesDir?: string;
    baseUrl?: string;
} = {}): string {
    const { stylesheets = [], description, date, toc, layout = 'docs', includesDir, baseUrl = '' } = options;

    const escapedTitle = escapeHtml(title);
    const headerPartial = loadPartial(includesDir, 'header.html');
    const footerPartial = loadPartial(includesDir, 'footer.html');

    const templateVars = {
        title: escapedTitle, nav, content: body, stylesheets, description, date, toc, baseUrl,
        header: headerPartial, footer: footerPartial,
    };

    // Try user-defined layout first, then built-in
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
<body>
{{header}}{{nav}}
    <article class="blog-post">
{{date}}{{toc}}
{{content}}
    </article>
{{footer}}</body>
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
<body>
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
<body>
{{header}}{{nav}}
    <article class="markdown-body">
{{toc}}
{{content}}
    </article>
{{footer}}</body>
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

/** Extract image/asset references from rendered HTML. */
function discoverAssetRefs(html: string): string[] {
    const refs: string[] = [];
    // Match src="..." in img tags
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(html)) !== null) {
        const src = decodeURIComponent(match[1]);
        // Skip absolute URLs and data URIs
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
            refs.push(src);
        }
    }
    return refs;
}

/** Copy asset files to output, preserving relative directory structure. */
function copyAssets(assetRefs: string[], inputDir: string, outputDir: string): { copied: number; warnings: string[] } {
    const warnings: string[] = [];
    let copied = 0;
    const seen = new Set<string>();

    for (const ref of assetRefs) {
        // Normalise path separators
        const normalizedRef = ref.replace(/\//g, path.sep);
        const srcPath = path.resolve(inputDir, normalizedRef);
        const destPath = path.resolve(outputDir, normalizedRef);

        // Dedup
        if (seen.has(srcPath)) continue;
        seen.add(srcPath);

        if (!fs.existsSync(srcPath)) {
            warnings.push(`Referenced asset not found: ${ref}`);
            continue;
        }

        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(srcPath, destPath);
        copied++;
        console.log(`  [asset] ${ref}`);
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

/** Retina markdown-it plugin: transforms {.retina} attribute on images. */
function retinaPlugin(md: MarkdownIt, opts: { globalRetina: boolean; pageRetina: boolean }): void {
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
            token.content = altText.replace(/\s*\{\.retina\}\s*/g, '').trim();
        }

        if (isRetina && isImageFile(srcAttr)) {
            token.attrSet('class', ((token.attrGet('class') || '') + ' retina').trim());
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
    const { input, output, stylesheets, assets, exclude, defaultPublic, defaultAssets, layout, includes, theme, retina, baseUrl, includeDrafts } = args;
    const frontMatterService = new FrontMatterService();

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

    // Add built-in theme CSS if specified (Iteration 4D)
    if (theme) {
        const themeCss = getBuiltInThemeCss(theme);
        if (themeCss) {
            const themeFile = `theme-${theme}.css`;
            fs.writeFileSync(path.join(output, themeFile), themeCss, 'utf-8');
            resolvedStylesheets.unshift((baseUrl ? baseUrl + '/' : '') + themeFile);
            console.log(`  [theme] ${themeFile}`);
        } else {
            console.warn(`  [warning] Unknown theme: ${theme}`);
        }
    }

    // Add retina CSS if needed
    if (retina) {
        const retinaFile = 'retina.css';
        fs.writeFileSync(path.join(output, retinaFile), getRetinaCss(), 'utf-8');
        resolvedStylesheets.push((baseUrl ? baseUrl + '/' : '') + retinaFile);
    }

    // Scan input for markdown files (recursive, with directory exclusion)
    const scannedFiles = scanMarkdownFiles(input, exclude);
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

    // Convert only public pages
    let warningCount = 0;
    let assetsCopied = 0;
    const allAssetRefs: string[] = [];

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
        retinaPlugin(pageMd, { globalRetina: retina, pageRetina });

        // Strip front matter before rendering
        const strippedMarkdown = frontMatterService.stripFrontMatter(meta.content);
        const htmlBody = pageMd.render(strippedMarkdown);

        // Asset discovery and copying (Iteration 2)
        const assetsEnabled = meta.fields.assets !== undefined ? meta.fields.assets : defaultAssets;
        if (assetsEnabled) {
            const refs = discoverAssetRefs(htmlBody);
            allAssetRefs.push(...refs);
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

        const nav = buildNav(navPages, pageName, baseUrl);
        const html = wrapHtml(title, nav, htmlBody, {
            stylesheets: resolvedStylesheets,
            description: meta.fields.description,
            date: meta.fields.date,
            toc,
            layout: pageLayout,
            includesDir: includes ? path.resolve(includes) : undefined,
            baseUrl,
        });

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`  ${pageName}.md -> ${slugify(pageName)}.html`);
    }

    // Copy discovered assets (Iteration 2)
    if (allAssetRefs.length > 0) {
        const result = copyAssets(allAssetRefs, input, output);
        assetsCopied = result.copied;
        for (const w of result.warnings) {
            console.warn(`  [warning] ${w}`);
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
                const displayName = escapeHtml(stripBrackets(p.title || p.name));
                const href = baseUrl ? baseUrl + '/' + p.href : p.href;
                return `<li><a href="${href}">${displayName}</a></li>`;
            });
        const indexBody = `<h1 id="home">Home</h1>\n<ul>\n${indexItems.join('\n')}\n</ul>`;
        const indexToc = generateToc(indexBody);

        const nav = buildNav(navPages, 'index', baseUrl);
        const indexHtml = wrapHtml('Home', nav, indexBody, {
            stylesheets: resolvedStylesheets,
            toc: indexToc,
            layout,
            includesDir: includes ? path.resolve(includes) : undefined,
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
        const nav = buildNav(navPages, pageName, baseUrl);
        const body = '    <p class="missing-page">This page has not been created yet.</p>';
        const html = wrapHtml(stripBrackets(pageName), nav, body, { stylesheets: resolvedStylesheets, layout, includesDir: includes ? path.resolve(includes) : undefined, baseUrl });

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
    grid-template-columns: 220px 1fr;
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

/* -- Sidebar nav -------------------------------------------------- */

.site-nav {
    grid-column: 1;
    grid-row: 2;
    background: #f6f8fa;
    border-right: 1px solid #d0d7de;
    padding: 1.5rem 1rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
}

.site-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.site-nav ul li {
    margin: 0.2rem 0;
}

.site-nav ul li a {
    display: block;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    text-decoration: none;
    color: #24292f;
    font-size: 0.875rem;
    line-height: 1.4;
}

.site-nav ul li a:hover {
    background: #eaeef2;
    color: #0550ae;
}

.site-nav ul li.nav-current a {
    background: #ddf4ff;
    color: #0550ae;
    font-weight: 600;
}

/* -- Content ------------------------------------------------------ */

article {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.markdown-body {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.blog-post {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 720px;
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

/* -- Responsive --------------------------------------------------- */

@media (max-width: 700px) {
    body {
        grid-template-columns: 1fr;
    }

    .site-nav {
        position: relative;
        height: auto;
        border-right: none;
        border-bottom: 1px solid #d0d7de;
    }

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
    grid-template-columns: 220px 1fr;
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

/* -- Sidebar nav -------------------------------------------------- */

.site-nav {
    grid-column: 1;
    grid-row: 2;
    background: #161b22;
    border-right: 1px solid #30363d;
    padding: 1.5rem 1rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
}

.site-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.site-nav ul li {
    margin: 0.2rem 0;
}

.site-nav ul li a {
    display: block;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    text-decoration: none;
    color: #c9d1d9;
    font-size: 0.875rem;
    line-height: 1.4;
}

.site-nav ul li a:hover {
    background: #1f2937;
    color: #58a6ff;
}

.site-nav ul li.nav-current a {
    background: #1f2937;
    color: #58a6ff;
    font-weight: 600;
}

/* -- Content ------------------------------------------------------ */

article {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.markdown-body {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 900px;
    overflow-x: auto;
}

article.blog-post {
    grid-column: 2;
    grid-row: 2;
    padding: 2rem 3rem;
    max-width: 720px;
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

/* -- Responsive --------------------------------------------------- */

@media (max-width: 700px) {
    body {
        grid-template-columns: 1fr;
    }

    .site-nav {
        position: relative;
        height: auto;
        border-right: none;
        border-bottom: 1px solid #30363d;
    }

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
