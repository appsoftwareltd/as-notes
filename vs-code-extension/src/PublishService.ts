import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FrontMatterService } from 'as-notes-common';

const frontMatterService = new FrontMatterService();

const CONFIG_FILENAME = 'asnotes-publish.json';

interface PublishConfig {
    inputDir?: string;
    defaultPublic?: boolean;
    defaultAssets?: boolean;
    layout?: string;
    layouts?: string;
    includes?: string;
    theme?: string;
    baseUrl?: string;
    retina?: boolean;
    includeDrafts?: boolean;
    stylesheets?: string[];
    exclude?: string[];
    outputDir?: string;
}

/**
 * Toggle or set a front matter field in the current document.
 * Creates a front matter block if one does not exist.
 */
export async function toggleFrontMatterField(
    editor: vscode.TextEditor,
    field: string,
    value: string | boolean,
): Promise<void> {
    const document = editor.document;
    const content = document.getText();
    const lines = content.split(/\r?\n/);

    const hasFrontMatter = lines.length > 0 && lines[0].trim() === '---';

    await editor.edit(editBuilder => {
        if (!hasFrontMatter) {
            // Insert new front matter at the top
            const yaml = `---\n${field}: ${formatYamlValue(value)}\n---\n`;
            editBuilder.insert(new vscode.Position(0, 0), yaml);
            return;
        }

        // Find closing ---
        let closingIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                closingIndex = i;
                break;
            }
        }

        if (closingIndex === -1) {
            // Malformed front matter - insert at line 1
            const lineEnd = new vscode.Position(0, lines[0].length);
            editBuilder.insert(lineEnd, `\n${field}: ${formatYamlValue(value)}`);
            return;
        }

        // Check if field already exists
        const fieldRegex = new RegExp(`^${escapeRegExp(field)}\\s*:`, 'i');
        let fieldLine = -1;
        for (let i = 1; i < closingIndex; i++) {
            if (fieldRegex.test(lines[i])) {
                fieldLine = i;
                break;
            }
        }

        if (fieldLine !== -1) {
            // Field exists - toggle or update
            const currentLine = lines[fieldLine];
            if (typeof value === 'boolean') {
                // Toggle boolean
                const currentValue = /:\s*true\s*$/i.test(currentLine);
                const newLine = `${field}: ${!currentValue}`;
                const range = new vscode.Range(fieldLine, 0, fieldLine, currentLine.length);
                editBuilder.replace(range, newLine);
            } else {
                // Update string value
                const newLine = `${field}: ${formatYamlValue(value)}`;
                const range = new vscode.Range(fieldLine, 0, fieldLine, currentLine.length);
                editBuilder.replace(range, newLine);
            }
        } else {
            // Field doesn't exist - insert before closing ---
            const insertPos = new vscode.Position(closingIndex, 0);
            editBuilder.insert(insertPos, `${field}: ${formatYamlValue(value)}\n`);
        }
    });
}

/**
 * Cycle a front matter field through a set of values.
 * If the current value is the last in the list, wraps to the first.
 */
export async function cycleFrontMatterField(
    editor: vscode.TextEditor,
    field: string,
    values: string[],
): Promise<void> {
    const content = editor.document.getText();
    const fields = frontMatterService.parseFrontMatterFields(content);
    const currentValue = (fields as Record<string, unknown>)[field] as string | undefined;
    const currentIndex = currentValue ? values.indexOf(currentValue) : -1;
    const nextIndex = (currentIndex + 1) % values.length;
    await toggleFrontMatterField(editor, field, values[nextIndex]);
}

function formatYamlValue(value: string | boolean): string {
    if (typeof value === 'boolean') return value.toString();
    // Quote strings that contain special YAML characters
    if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes("'") || value.includes('"')) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read the publish config file from the notes root.
 * Returns undefined if the file does not exist.
 */
function readPublishConfig(notesRoot: string): PublishConfig | undefined {
    const configPath = path.join(notesRoot, CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return undefined;
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as PublishConfig;
        }
    } catch {
        // Corrupt config - treat as missing
    }
    return undefined;
}

/**
 * Ensure all config fields are present with sensible defaults.
 * This lets users discover available options by reading the config file.
 */
function withDefaults(config: PublishConfig): Required<PublishConfig> {
    return {
        inputDir: config.inputDir ?? '',
        defaultPublic: config.defaultPublic ?? false,
        defaultAssets: config.defaultAssets ?? false,
        layout: config.layout ?? 'docs',
        layouts: config.layouts ?? '',
        includes: config.includes ?? '',
        theme: config.theme ?? 'default',
        baseUrl: config.baseUrl ?? '',
        retina: config.retina ?? false,
        includeDrafts: config.includeDrafts ?? false,
        stylesheets: config.stylesheets ?? [],
        exclude: config.exclude ?? [],
        outputDir: config.outputDir ?? '',
    };
}

/**
 * Write the publish config to the notes root.
 * All fields are included with defaults so users can discover available options.
 */
function writePublishConfig(notesRoot: string, config: PublishConfig, configFilename?: string): void {
    const filename = configFilename ?? CONFIG_FILENAME;
    const configPath = path.join(notesRoot, filename);
    fs.writeFileSync(configPath, JSON.stringify(withDefaults(config), null, 4) + '\n', 'utf-8');
}

/**
 * Discover all publish config files in the notes root.
 * Returns an array of { filename, config } sorted by filename.
 */
function discoverConfigFiles(notesRoot: string): { filename: string; config: PublishConfig }[] {
    const results: { filename: string; config: PublishConfig }[] = [];
    try {
        const files = fs.readdirSync(notesRoot);
        for (const file of files) {
            if (/^asnotes-publish(\.[^.]+)?\.json$/i.test(file)) {
                try {
                    const raw = fs.readFileSync(path.join(notesRoot, file), 'utf-8');
                    const parsed = JSON.parse(raw);
                    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                        results.push({ filename: file, config: parsed as PublishConfig });
                    }
                } catch {
                    // Skip corrupt configs
                }
            }
        }
    } catch {
        // Directory not readable
    }
    return results.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Derive the config filename from the input directory.
 * Notes root -> asnotes-publish.json
 * Subdirectory -> asnotes-publish.<dirname>.json
 */
function configFilenameForInputDir(notesRoot: string, inputDir: string): string {
    if (!inputDir) return CONFIG_FILENAME;
    const resolved = path.isAbsolute(inputDir) ? inputDir : path.resolve(notesRoot, inputDir);
    const resolvedRoot = path.resolve(notesRoot);
    if (resolved === resolvedRoot) return CONFIG_FILENAME;
    const dirName = path.basename(resolved);
    return `asnotes-publish.${dirName}.json`;
}

/**
 * Convert a chosen filesystem path to a relative path if inside the workspace, otherwise keep absolute.
 */
function toRelativePath(notesRoot: string, chosenPath: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot && chosenPath.startsWith(workspaceRoot)) {
        const rel = path.relative(notesRoot, chosenPath);
        return rel.startsWith('..') ? chosenPath : './' + rel.replace(/\\/g, '/');
    }
    return chosenPath;
}

const DEFAULT_HEADER_HTML = `<div class="site-header">
    <a class="site-title" href="{{base-url}}/">
        <svg class="site-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.82 166.13" width="24" height="21"><path fill="currentColor" fill-rule="evenodd" d="M67.09,132.92,47.93,166.13H9.59L0,149.52,86.33,0H105.5L19.17,149.52H38.34l19.17-33.2h76.8l9.59,16.6Zm48-83.12,9.65,16.71H143.9L115.08,16.6q-24,41.57-48,83.12H143.9q14.37,24.9,28.76,49.8h-96l-9.59,16.61H182.24l9.58-16.61-38.34-66.4H96C95.85,82.9,113.39,52.73,115.08,49.8Z"/></svg>
        Home
    </a>
</div>
`;

const DEFAULT_FOOTER_HTML = `<div class="site-footer">
    <p>&copy; ${new Date().getFullYear()} Built with <a href="https://www.asnotes.io">AS Notes</a> by <a href="https://www.appsoftware.com">App Software Ltd</a></p>
</div>
`;

/**
 * Create default header.html and footer.html in the includes directory if they do not already exist.
 */
async function createDefaultPartials(includesDirPath: string): Promise<void> {
    if (!fs.existsSync(includesDirPath)) {
        fs.mkdirSync(includesDirPath, { recursive: true });
    }

    const headerPath = path.join(includesDirPath, 'header.html');
    if (!fs.existsSync(headerPath)) {
        fs.writeFileSync(headerPath, DEFAULT_HEADER_HTML, 'utf-8');
    }

    const footerPath = path.join(includesDirPath, 'footer.html');
    if (!fs.existsSync(footerPath)) {
        fs.writeFileSync(footerPath, DEFAULT_FOOTER_HTML, 'utf-8');
    }
}

const LAYOUT_DOCS = `<!DOCTYPE html>
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

const LAYOUT_BLOG = `<!DOCTYPE html>
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

const LAYOUT_MINIMAL = `<!DOCTYPE html>
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

const LAYOUT_TEMPLATES: Record<string, string> = {
    docs: LAYOUT_DOCS,
    blog: LAYOUT_BLOG,
    minimal: LAYOUT_MINIMAL,
};

/**
 * Create default layout template files in the layouts directory if they do not already exist.
 */
async function createDefaultLayouts(layoutsDirPath: string): Promise<void> {
    if (!fs.existsSync(layoutsDirPath)) {
        fs.mkdirSync(layoutsDirPath, { recursive: true });
    }

    for (const [name, template] of Object.entries(LAYOUT_TEMPLATES)) {
        const layoutPath = path.join(layoutsDirPath, `${name}.html`);
        if (!fs.existsSync(layoutPath)) {
            fs.writeFileSync(layoutPath, template, 'utf-8');
        }
    }
}

/**
 * Interactive wizard to configure publish settings.
 * Returns undefined if the user cancels at any step.
 */
async function runPublishWizard(notesRoot: string, existing?: PublishConfig): Promise<PublishConfig | undefined> {
    const config: PublishConfig = { ...existing };

    // Step 1: Input Directory
    const inputDirPick = await vscode.window.showQuickPick(
        [
            { label: '$(root-folder) Notes root', description: `Use ${notesRoot} as the input directory`, value: 'root' },
            { label: '$(folder-opened) Choose a subdirectory...', description: 'Pick a specific folder to publish', value: 'pick' },
        ],
        { placeHolder: 'Input directory', title: 'Publish Settings (1/9)' },
    );
    if (!inputDirPick) return undefined;

    if (inputDirPick.value === 'pick') {
        const chosen = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(notesRoot),
            openLabel: 'Select Input Directory',
            title: 'Publish Settings (1/9): Input Directory',
        });
        if (!chosen || chosen.length === 0) return undefined;
        config.inputDir = toRelativePath(notesRoot, chosen[0].fsPath);
    } else {
        config.inputDir = '';
    }

    // Step 2: Default Public
    const publicPick = await vscode.window.showQuickPick(
        [
            { label: 'Yes', description: 'All pages are published unless public: false', value: true },
            { label: 'No', description: 'Only pages with public: true are published', value: false },
        ],
        { placeHolder: 'Publish all pages by default?', title: 'Publish Settings (2/9)' },
    );
    if (!publicPick) return undefined;
    config.defaultPublic = publicPick.value;

    // Step 3: Default Assets
    const assetsPick = await vscode.window.showQuickPick(
        [
            { label: 'Yes', description: 'Copy referenced images and files', value: true },
            { label: 'No', description: 'Only copy assets for pages with assets: true', value: false },
        ],
        { placeHolder: 'Copy referenced assets by default?', title: 'Publish Settings (3/9)' },
    );
    if (!assetsPick) return undefined;
    config.defaultAssets = assetsPick.value;

    // Step 4: Layout
    const layoutPick = await vscode.window.showQuickPick(
        [
            { label: 'docs', description: 'Navigation sidebar + content area (default)' },
            { label: 'blog', description: 'Navigation + blog-style article with date' },
            { label: 'minimal', description: 'Content only, no navigation' },
        ],
        { placeHolder: 'Choose a layout', title: 'Publish Settings (4/9)' },
    );
    if (!layoutPick) return undefined;
    config.layout = layoutPick.label;

    // Step 5: Theme
    const themePick = await vscode.window.showQuickPick(
        [
            { label: 'default', description: 'Light theme with GitHub-inspired typography' },
            { label: 'dark', description: 'Dark theme' },
            { label: 'none', description: 'No built-in theme (use custom stylesheets)' },
        ],
        { placeHolder: 'Choose a theme', title: 'Publish Settings (5/9)' },
    );
    if (!themePick) return undefined;
    config.theme = themePick.label === 'none' ? '' : themePick.label;

    // Step 6: Base URL
    const baseUrlInput = await vscode.window.showInputBox({
        prompt: 'URL path prefix for deployed site (leave empty for root)',
        title: 'Publish Settings (6/9)',
        value: config.baseUrl ?? '',
        placeHolder: '/my-repo',
    });
    if (baseUrlInput === undefined) return undefined;
    config.baseUrl = baseUrlInput.replace(/\/+$/, '');

    // Step 7: Output Directory
    const outputDir = await pickOutputDirectory(notesRoot, config.inputDir, config.outputDir);
    if (!outputDir) return undefined;
    config.outputDir = outputDir;

    // Step 8: Layouts Directory
    const layoutsDirPick = await vscode.window.showQuickPick(
        [
            { label: '$(new-folder) Create default layouts', description: 'Create a layouts directory with editable layout templates (docs, blog, minimal)', value: 'create' },
            { label: '$(folder-opened) Browse...', description: 'Choose an existing layouts directory', value: 'pick' },
            { label: 'Skip', description: 'Use built-in layouts only', value: 'skip' },
        ],
        { placeHolder: 'Layouts directory?', title: 'Publish Settings (8/9)' },
    );
    if (!layoutsDirPick) return undefined;

    if (layoutsDirPick.value === 'create') {
        const inputDirName = config.inputDir ? path.basename(path.resolve(notesRoot, config.inputDir)) : '';
        const layoutsFolderName = inputDirName ? `asnotes-publish.layouts.${inputDirName}` : 'asnotes-publish.layouts';
        const defaultLayoutsPath = path.join(notesRoot, layoutsFolderName);
        await createDefaultLayouts(defaultLayoutsPath);
        config.layouts = './' + layoutsFolderName;
    } else if (layoutsDirPick.value === 'pick') {
        const chosen = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(notesRoot),
            openLabel: 'Select Layouts Directory',
            title: 'Publish Settings (8/9): Layouts Directory',
        });
        if (chosen && chosen.length > 0) {
            config.layouts = toRelativePath(notesRoot, chosen[0].fsPath);
        }
    }

    // Step 9: Includes Directory
    const includesDirPick = await vscode.window.showQuickPick(
        [
            { label: '$(new-folder) Create default includes', description: 'Create an includes directory with default header and footer templates', value: 'create' },
            { label: '$(folder-opened) Browse...', description: 'Choose an existing includes directory', value: 'pick' },
            { label: 'Skip', description: 'Use built-in header and footer only', value: 'skip' },
        ],
        { placeHolder: 'Includes directory?', title: 'Publish Settings (9/9)' },
    );
    if (!includesDirPick) return undefined;

    if (includesDirPick.value === 'create') {
        const inputDirName = config.inputDir ? path.basename(path.resolve(notesRoot, config.inputDir)) : '';
        const includesFolderName = inputDirName ? `asnotes-publish.includes.${inputDirName}` : 'asnotes-publish.includes';
        const defaultIncludesPath = path.join(notesRoot, includesFolderName);
        await createDefaultPartials(defaultIncludesPath);
        config.includes = './' + includesFolderName;
    } else if (includesDirPick.value === 'pick') {
        const chosen = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.Uri.file(notesRoot),
            openLabel: 'Select Includes Directory',
            title: 'Publish Settings (9/9): Includes Directory',
        });
        if (chosen && chosen.length > 0) {
            config.includes = toRelativePath(notesRoot, chosen[0].fsPath);
        }
    }

    return config;
}

/**
 * Pick an output directory. Shows a QuickPick with a sensible default and browse option.
 * Returns the chosen path (relative to notesRoot if inside it, otherwise absolute), or undefined if cancelled.
 */
async function pickOutputDirectory(notesRoot: string, inputDir?: string, savedDir?: string): Promise<string | undefined> {
    // Derive a sensible default: <inputDirName>-publish, or just "publish"
    const inputDirName = inputDir ? path.basename(path.resolve(notesRoot, inputDir)) : '';
    const defaultDirName = inputDirName ? `./${inputDirName}-publish` : './publish';

    if (savedDir) {
        const resolvedSaved = path.isAbsolute(savedDir) ? savedDir : path.resolve(notesRoot, savedDir);
        const pick = await vscode.window.showQuickPick(
            [
                { label: `$(folder) ${resolvedSaved}`, description: 'Use saved output directory', value: 'reuse' },
                { label: '$(folder-opened) Choose a different directory...', description: 'Browse for a folder', value: 'pick' },
            ],
            { placeHolder: 'Output directory', title: 'Publish Settings (7/8)' },
        );
        if (!pick) return undefined;
        if (pick.value === 'reuse') return savedDir;
    } else {
        const pick = await vscode.window.showQuickPick(
            [
                { label: `$(folder) ${defaultDirName}`, description: `Create ${defaultDirName} relative to notes root`, value: 'default' },
                { label: '$(folder-opened) Browse...', description: 'Choose an existing directory', value: 'pick' },
            ],
            { placeHolder: 'Where should the HTML output be written?', title: 'Publish Settings (7/8)' },
        );
        if (!pick) return undefined;
        if (pick.value === 'default') return defaultDirName;
    }

    const chosen = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.Uri.file(notesRoot),
        openLabel: 'Select Output Directory',
        title: 'Publish Settings (7/8): Output Directory',
    });
    if (!chosen || chosen.length === 0) return undefined;
    return toRelativePath(notesRoot, chosen[0].fsPath);
}

/**
 * Run the HTML conversion CLI for a specific config file.
 */
function runConvertForConfig(notesRoot: string, configFilename: string, config: PublishConfig): void {
    const extensionPath = vscode.extensions.getExtension('appsoftwareltd.as-notes')?.extensionPath
        ?? path.dirname(path.dirname(__filename));
    const convertScript = path.join(extensionPath, 'dist', 'convert.js');
    const configPath = path.join(notesRoot, configFilename);

    // The CLI reads inputDir, outputDir, and all settings from the config file
    const args: string[] = ['--config', configPath];

    const terminal = vscode.window.createTerminal(`AS Notes: Publish (${configFilename})`);
    terminal.show();
    terminal.sendText(`node "${convertScript}" ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);

    const outputDir = config.outputDir || 'output';
    const resolvedOutput = path.isAbsolute(outputDir) ? outputDir : path.resolve(notesRoot, outputDir);
    vscode.window.showInformationMessage(`Publishing to ${resolvedOutput}...`);
}

/**
 * Run the HTML conversion CLI as a VS Code task.
 * Discovers publish configs, lets the user pick one (or create new), then publishes.
 */
export async function publishToHtml(notesRoot: string): Promise<void> {
    if (!notesRoot) {
        vscode.window.showErrorMessage('AS Notes is not initialised. Please initialise a workspace first.');
        return;
    }

    const configs = discoverConfigFiles(notesRoot);

    if (configs.length === 0) {
        // No configs - run wizard to create one
        const result = await runPublishWizard(notesRoot);
        if (!result) return;
        const filename = configFilenameForInputDir(notesRoot, result.inputDir ?? '');
        writePublishConfig(notesRoot, result, filename);
        vscode.window.showInformationMessage(`Publish settings saved to ${filename}`);

        // Check output dir is set
        if (!result.outputDir) {
            const outputDir = await pickOutputDirectory(notesRoot);
            if (!outputDir) return;
            result.outputDir = outputDir;
            writePublishConfig(notesRoot, result, filename);
        }

        runConvertForConfig(notesRoot, filename, result);
        return;
    }

    // One or more configs - always show a picker
    const items: { label: string; description: string; value: string }[] = configs.map(c => ({
        label: `$(file) ${c.filename}`,
        description: c.config.inputDir ? `Input: ${c.config.inputDir}` : 'Input: notes root',
        value: c.filename,
    }));
    if (configs.length > 1) {
        items.push({ label: '$(run-all) Publish All', description: 'Publish all configured sites', value: '__all__' });
    }
    items.push({ label: '$(add) Create new site config...', description: 'Set up a new publish configuration', value: '__create__' });

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a publish configuration',
        title: 'Publish Site',
    });
    if (!pick) return;

    if (pick.value === '__create__') {
        const result = await runPublishWizard(notesRoot);
        if (!result) return;
        const filename = configFilenameForInputDir(notesRoot, result.inputDir ?? '');
        writePublishConfig(notesRoot, result, filename);
        vscode.window.showInformationMessage(`Publish settings saved to ${filename}`);

        if (!result.outputDir) {
            const outputDir = await pickOutputDirectory(notesRoot);
            if (!outputDir) return;
            result.outputDir = outputDir;
            writePublishConfig(notesRoot, result, filename);
        }

        runConvertForConfig(notesRoot, filename, result);
        return;
    }

    if (pick.value === '__all__') {
        for (const { filename, config } of configs) {
            if (!config.outputDir) {
                const outputDir = await pickOutputDirectory(notesRoot, config.outputDir);
                if (!outputDir) continue;
                config.outputDir = outputDir;
                writePublishConfig(notesRoot, config, filename);
            }
            runConvertForConfig(notesRoot, filename, config);
        }
        return;
    }

    const selected = configs.find(c => c.filename === pick.value);
    if (!selected) return;

    if (!selected.config.outputDir) {
        const outputDir = await pickOutputDirectory(notesRoot, selected.config.outputDir);
        if (!outputDir) return;
        selected.config.outputDir = outputDir;
        writePublishConfig(notesRoot, selected.config, selected.filename);
    }

    runConvertForConfig(notesRoot, selected.filename, selected.config);
}

/**
 * Run the publish settings wizard without building.
 * Discovers existing configs and lets the user edit one or create new.
 */
export async function configurePublish(notesRoot: string): Promise<void> {
    if (!notesRoot) {
        vscode.window.showErrorMessage('AS Notes is not initialised. Please initialise a workspace first.');
        return;
    }

    const configs = discoverConfigFiles(notesRoot);

    if (configs.length === 0) {
        // No configs - create new
        const result = await runPublishWizard(notesRoot);
        if (!result) return;
        const filename = configFilenameForInputDir(notesRoot, result.inputDir ?? '');
        writePublishConfig(notesRoot, result, filename);
        vscode.window.showInformationMessage(`Publish settings saved to ${filename}`);
        return;
    }

    // Show picker: edit existing or create new
    const items: { label: string; description: string; value: string }[] = configs.map(c => ({
        label: `$(edit) ${c.filename}`,
        description: c.config.inputDir ? `Input: ${c.config.inputDir}` : 'Input: notes root',
        value: c.filename,
    }));
    items.push({ label: '$(add) Create new site config...', description: 'Set up a new publish configuration', value: '__create__' });

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a configuration to edit',
        title: 'Configure Publish Settings',
    });
    if (!pick) return;

    if (pick.value === '__create__') {
        const result = await runPublishWizard(notesRoot);
        if (!result) return;
        const filename = configFilenameForInputDir(notesRoot, result.inputDir ?? '');
        writePublishConfig(notesRoot, result, filename);
        vscode.window.showInformationMessage(`Publish settings saved to ${filename}`);
        return;
    }

    const selected = configs.find(c => c.filename === pick.value);
    if (!selected) return;

    const result = await runPublishWizard(notesRoot, selected.config);
    if (!result) return;

    // If inputDir changed, the filename may need to change too
    const newFilename = configFilenameForInputDir(notesRoot, result.inputDir ?? '');
    if (newFilename !== selected.filename) {
        // Delete old config file and write new one
        const oldPath = path.join(notesRoot, selected.filename);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }

    writePublishConfig(notesRoot, result, newFilename);
    vscode.window.showInformationMessage(`Publish settings saved to ${newFilename}`);
}
