import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { WikilinkService, wikilinkPlugin } from 'as-notes-common';
import { FileResolver } from './FileResolver.js';

function parseArgs(argv: string[]): { input: string; output: string } {
    let input = '';
    let output = '';

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--input' && i + 1 < argv.length) {
            input = argv[++i];
        } else if (argv[i] === '--output' && i + 1 < argv.length) {
            output = argv[++i];
        }
    }

    if (!input || !output) {
        console.error('Usage: as-notes-convert --input <dir> --output <dir>');
        process.exit(1);
    }

    return { input: path.resolve(input), output: path.resolve(output) };
}

function scanMarkdownFiles(dir: string): string[] {
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))
        .sort();
}

function buildNav(resolver: FileResolver, currentPage: string): string {
    const pages = resolver.listPages();
    const items = pages.map(p => {
        const isCurrent = p.name === currentPage ? ' class="nav-current"' : '';
        const displayName = p.name === 'index' ? 'Home' : p.name;
        return `        <li${isCurrent}><a href="${p.href}">${displayName}</a></li>`;
    });

    return `    <nav class="site-nav">\n      <ul>\n${items.join('\n')}\n      </ul>\n    </nav>`;
}

function wrapHtml(title: string, nav: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
</head>
<body>
${nav}
    <main class="content">
${body}
    </main>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function main(): void {
    const { input, output } = parseArgs(process.argv);

    // Wipe output directory
    if (fs.existsSync(output)) {
        fs.rmSync(output, { recursive: true });
    }
    fs.mkdirSync(output, { recursive: true });

    // Scan input for markdown files
    const mdFiles = scanMarkdownFiles(input);
    if (mdFiles.length === 0) {
        console.error(`No .md files found in ${input}`);
        process.exit(1);
    }

    // Build resolver from filenames
    const resolver = new FileResolver(mdFiles);

    // Set up markdown-it with wikilink plugin
    const wikilinkService = new WikilinkService();
    const md = new MarkdownIt({ html: true });
    wikilinkPlugin(md, {
        wikilinkService,
        resolver: resolver.createResolverFn(),
    });

    // Convert each file
    for (const filename of mdFiles) {
        const pageName = filename.replace(/\.md$/i, '');
        const inputPath = path.join(input, filename);
        const outputPath = path.join(output, pageName + '.html');

        const markdown = fs.readFileSync(inputPath, 'utf-8');
        const htmlBody = md.render(markdown);

        const title = pageName === 'index' ? 'AS Notes Documentation' : pageName;
        const nav = buildNav(resolver, pageName);
        const html = wrapHtml(title, nav, htmlBody);

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`  ${filename} -> ${pageName}.html`);
    }

    // Generate placeholder pages for missing wikilink targets
    const missingTargets = resolver.getMissingTargets();
    for (const pageName of missingTargets) {
        const outputPath = path.join(output, pageName + '.html');
        const nav = buildNav(resolver, pageName);
        const body = '    <p class="missing-page">This page has not been created yet.</p>';
        const html = wrapHtml(pageName, nav, body);

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`  [missing] ${pageName}.html (placeholder)`);
    }

    const totalFiles = mdFiles.length + missingTargets.size;
    console.log(`\nConverted ${mdFiles.length} page(s), generated ${missingTargets.size} placeholder(s) -> ${output}`);
}

main();
