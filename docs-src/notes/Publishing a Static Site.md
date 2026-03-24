# Publishing a Static Site

AS Notes includes a built-in HTML conversion tool that turns your markdown notes into a static website. It supports filtering, layouts, themes, asset pipelines, retina images, SEO metadata, sitemaps, and RSS feeds. You can deploy to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static hosting.

This documentation is itself a working example -- it was written in AS Notes and published using the same tool.

## How It Works

The `publish` package recursively scans a folder of markdown files and converts them to HTML. Subdirectories are walked automatically, so notes organised in folders like `notes/`, `journals/`, and `pages/` are all discovered. The `templates` and `node_modules` directories are excluded by default.

[[Wikilinks]] between pages are automatically resolved to the correct HTML links. A navigation sidebar is generated from all public pages. Only pages you mark as public are published.

Output is flat: all HTML files are written to the output root regardless of source subdirectory depth. Filenames are slugified to clean, URL-friendly kebab-case: `notes/My Page.md` becomes `my-page.html`. This matches how wikilinks work in AS Notes where filenames are globally unique.

Each page is wrapped in a layout template with class names you can style any way you like. Unstyled output is clean, readable HTML with zero dependencies.

## Prerequisites

- [Node.js](https://nodejs.org) 20 or later
- Your notes in a folder of `.md` files

## Installation

There are two ways to run the converter:

### npm (recommended for CI/CD)

Install the CLI globally or use npx:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

Or install globally:

```bash
npm install -g asnotes-publish
asnotes-publish --config ./asnotes-publish.json
```

This is the recommended approach for CI/CD pipelines (GitHub Actions, Netlify, Vercel, Cloudflare Pages).

### Build from source

Alternatively, the `publish` package in the AS Notes repository can be built from source:

```bash
cd publish
npm install
npm run build
node dist/convert.js --config ../asnotes-publish.json
```

### VS Code Extension

The converter is also bundled into the AS Notes VS Code extension. Use the command palette (`Ctrl+Shift+P`) and run **AS Notes: Publish to HTML**. This prompts for an output directory and runs the conversion with your configured settings. No separate installation required.

## Quick Start

```bash
npm run convert -- --input /path/to/notes --output /path/to/site --default-public
```

This converts all markdown files to HTML. The output folder is wiped and regenerated on every run.

Preview locally:

```bash
npx serve /path/to/site
```

## Front Matter

Control publishing behaviour per-page using YAML front matter at the top of any markdown file:

```yaml
---
public: true
title: My Page Title
order: 1
description: A short description for SEO
layout: docs
assets: true
retina: true
draft: false
date: 2025-03-23
---
```

All fields are optional. Here is what each field does:

| Field | Type | Description |
|---|---|---|
| `public` | boolean | Page is included in output. Required unless `--default-public` is used |
| `title` | string | Page title for `<title>` tag and nav. Defaults to filename |
| `order` | number | Nav sort order. Lower numbers appear first. Unordered pages sort alphabetically after ordered ones |
| `description` | string | Injected as `<meta name="description">` for SEO |
| `layout` | string | Per-page layout override (`docs`, `blog`, `minimal`, or custom) |
| `assets` | boolean | Enable asset copying for this page. Required unless `--default-assets` is used |
| `retina` | boolean | Apply retina styling to all images on this page |
| `draft` | boolean | Exclude from output unless `--include-drafts` is passed |
| `date` | string | Date for blog-style display and RSS feed ordering |

### Slash Commands for Front Matter

In VS Code, type `/` in any markdown file to access these slash commands:

- **/Public** -- toggle `public: true/false` in front matter
- **/Layout** -- cycle through `docs`, `blog`, `minimal` layouts
- **/Retina** -- toggle `retina: true/false`
- **/Assets** -- toggle `assets: true/false`

These commands create a front matter block if one doesn't exist, or update existing fields.

## Public / Private Filtering

By default, only pages with `public: true` in their front matter are converted. All other pages are skipped.

```yaml
---
public: true
---
# This page will be published
```

Pages without front matter or without `public: true` are skipped silently.

### Encrypted Files

Files ending in `.enc.md` (AS Notes encrypted files) are always excluded from publishing. This is a hardcoded safety measure -- encrypted notes are never included in the output regardless of `--default-public` or per-file front matter settings.

### Excluding Directories

The converter recursively scans all subdirectories. The `templates` and `node_modules` directories are excluded by default. To exclude additional directories, use `--exclude`:

```bash
npm run convert -- --input ./notes --output ./site --default-public --exclude drafts --exclude archive
```

Exclude matches directory names at any depth in the tree.

### Default Public Mode

Pass `--default-public` to invert the behaviour: all pages are published unless they have `public: false`:

```bash
npm run convert -- --input ./notes --output ./site --default-public
```

### Dead Links

When a public page links to a non-public page via [[wikilink]], the link is rendered as a dead link (the href is still present but points nowhere). The converter logs a warning for each dead link so you can fix them.

### Drafts

Pages with `draft: true` are excluded from the output. To include them (e.g. for a preview build), pass `--include-drafts`:

```bash
npm run convert -- --input ./notes --output ./site --default-public --include-drafts
```

### Home Page (Index)

Every site needs a page at `/`. If your notes include a file called `index.md`, it becomes the home page automatically. The index page appears first in navigation and displays as "Home".

If no `index.md` exists among your public pages, the converter auto-generates a simple index page that lists links to all published pages. The console will show:

```
[info] No index.md found - generating page index
```

To create a custom home page, add `index.md` to your notes root with `public: true`:

```yaml
---
public: true
title: Welcome
---
# Welcome to my site

This is my home page.
```

## Asset Pipeline

Images and files referenced in your markdown are automatically discovered and copied to the output directory.

### Enabling Asset Copying

Asset copying is opt-in for safety. You have two options:

**Per-page:** Add `assets: true` to the page's front matter:

```yaml
---
public: true
assets: true
---
![screenshot](../assets/images/screenshot.png)
```

**Global:** Pass `--default-assets` to enable asset copying for all public pages:

```bash
npm run convert -- --input ./notes --output ./site --default-public --default-assets
```

With `--default-assets`, pages can opt out with `assets: false`.

### How It Works

The converter scans rendered HTML for local `<img src="...">` references. Each reference is resolved relative to the page's source location within the input directory. Since all HTML pages are output to a flat directory, the converter rewrites `src` attributes so that asset paths resolve correctly in the published output.

For example, if `pages/My Page.md` references `../assets/images/photo.png`, the converter:

1. Resolves the path relative to the page's source directory (`pages/`)
2. Copies the file to the output directory as `assets/images/photo.png`
3. Rewrites the `<img src>` in the HTML to `assets/images/photo.png`

Absolute URLs (`http://`, `https://`) and data URIs are ignored.

If a referenced file is missing, a warning is logged.

### Manual Assets

You can also copy specific files with `--asset`:

```bash
npm run convert -- --input ./notes --output ./site --asset /path/to/favicon.ico
```

## Stylesheets

### CDN Stylesheets

Pass `--stylesheet` with a URL:

```bash
npm run convert -- \
  --input ./notes --output ./site \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css
```

### Local Stylesheets

Local file paths passed to `--stylesheet` are automatically copied to the output directory. No separate `--asset` flag is needed:

```bash
npm run convert -- \
  --input ./notes --output ./site \
  --stylesheet /path/to/my-styles.css
```

The file is copied to the output and referenced by filename in each page's `<head>`.

### Combining Stylesheets

Pass `--stylesheet` multiple times. Tags are injected in the order specified:

```bash
npm run convert -- \
  --input ./notes --output ./site \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css \
  --stylesheet /path/to/layout.css
```

## Layouts

Layouts control the HTML structure of each page. Three built-in layouts are available, and you can define your own.

### Built-in Layouts

Select a layout with `--layout`:

| Layout | Description |
|---|---|
| `docs` | Navigation sidebar + content area with `markdown-body` class (default) |
| `blog` | Navigation + blog-style article with date display |
| `minimal` | Content only, no navigation |

```bash
npm run convert -- --input ./notes --output ./site --layout blog
```

### Per-page Layout Override

Set `layout:` in front matter to override the global layout for a specific page:

```yaml
---
public: true
layout: minimal
---
```

### Custom Layouts

The setup wizard (Step 8) offers to create a **layouts directory** containing editable copies of all three built-in layouts. You can modify these files to customise the HTML structure of your site.

Point the converter at your layouts directory with `--layouts`:

```bash
npm run convert -- --input ./notes --output ./site --layouts ./layouts --layout my-layout
```

The converter looks for `my-layout.html` in the layouts directory first, then falls back to the includes directory, then to built-in layouts.

You can also create entirely new layout files in the layouts directory and reference them by name (without the `.html` extension) in `--layout` or per-page `layout:` front matter.

Template tokens:

| Token | Replaced with |
|---|---|
| `{{title}}` | Page title (escaped) |
| `{{header}}` | Header partial HTML (from `header.html` in includes dir) |
| `{{nav}}` | Navigation HTML |
| `{{content}}` | Rendered markdown body |
| `{{stylesheets}}` | `<link>` tags for stylesheets |
| `{{meta}}` | `<meta name="description">` tag |
| `{{date}}` | `<time>` element (if page has `date:` front matter) |
| `{{toc}}` | Table of contents HTML |
| `{{footer}}` | Footer partial HTML (from `footer.html` in includes dir) |
| `{{base-url}}` | Base URL path prefix |

Example custom layout:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>{{stylesheets}}{{meta}}
</head>
<body>
{{header}}
    <header>{{nav}}</header>
    <main>
        {{toc}}
        {{date}}
        {{content}}
    </main>
{{footer}}
</body>
</html>
```

### Header and Footer Partials

Add a consistent header and footer across all pages by creating `header.html` and `footer.html` in your includes directory.

The converter looks for these files when `--includes` is set (or `includes` is set in the config file). If a partial exists, its contents are wrapped in a `<header>` or `<footer>` element and injected into the page. If a partial does not exist, an HTML comment (`<!-- header -->` or `<!-- footer -->`) is emitted as a placeholder.

Partials support `{{base-url}}` and `{{title}}` tokens so you can create dynamic links.

Example `header.html`:

```html
<div class="site-header">
    <a class="site-title" href="{{base-url}}/">My Notes</a>
    <span class="header-sep">|</span>
    <a href="https://github.com/me">GitHub</a>
    <a href="mailto:me@example.com">Contact</a>
</div>
```

Example `footer.html`:

```html
<div class="site-footer">
    <p>&copy; 2026 My Name. Built with <a href="https://www.asnotes.io">AS Notes</a>.</p>
</div>
```

Both built-in and custom layouts include `{{header}}` and `{{footer}}` tokens, so partials work with any layout.

When using the VS Code publish wizard, the includes directory step (step 8) offers three options: create default `header.html` and `footer.html` files, browse for an existing includes directory, or skip. Edit the generated files to add your own navigation, branding, and contact information.

### Custom Navigation

By default, the converter auto-generates a sidebar navigation listing all published pages in order. To take full control of navigation content and structure, create a `nav.md` file at the root of your input directory.

`nav.md` is rendered as markdown with full wikilink support, so you can use headings, horizontal rules, lists, and links to organise your navigation however you like:

```markdown
## Guides

- [[Getting Started]]
- [[Publishing a Static Site]]

---

## Reference

- [[Settings]]
- [[Wikilinks]]
```

The rendered HTML replaces the auto-generated `<nav class="site-nav">` element on every page.

**How it works:**

- If `nav.md` exists in the input directory root, it is used as the navigation for all pages
- If `nav.md` does not exist, the auto-generated navigation is used (with `nav-current` highlighting)
- `nav.md` is not published as a standalone page and does not appear in the sitemap
- Wikilinks in `nav.md` are resolved to their HTML page slugs, with `--base-url` applied if set
- The `nav-current` CSS class is not applied when using custom navigation (since the content is user-controlled)

**Multi-site support:** Since `nav.md` lives in the input directory, each site configuration can have its own navigation when using multi-site publishing.

## Themes

Built-in CSS themes provide ready-made styling without writing CSS:

```bash
npm run convert -- --input ./notes --output ./site --theme default
```

Available themes:

| Theme | Description |
|---|---|
| `default` | Light theme with GitHub-inspired typography |
| `dark` | Dark theme with dark background |

Themes are injected as the first stylesheet, so you can override them with additional `--stylesheet` flags.

## Retina Images

Display high-resolution images at half their natural dimensions for crisp rendering on retina displays.

### Three Levels of Control

**Per-image:** Append `{.retina}` to the image alt text in markdown:

```markdown
![screenshot {.retina}](assets/images/screenshot@2x.png)
```

**Per-page:** Add `retina: true` to the page's front matter. All images on that page get the retina class:

```yaml
---
public: true
retina: true
---
```

**Global:** Pass `--retina` to apply retina styling to all images across the site:

```bash
npm run convert -- --input ./notes --output ./site --retina
```

All three levels add a `retina` CSS class to the `<img>` tag. Style it in your CSS to control rendering size via `width` and `height` attributes.

## SEO Features

### Page Descriptions

Add `description:` to front matter for SEO metadata:

```yaml
---
public: true
description: Learn how to publish AS Notes as a static website
---
```

This injects `<meta name="description" content="...">` in the page `<head>`.

### Slug URLs

Output filenames are automatically slugified to clean, URL-friendly kebab-case. This produces shorter, more readable URLs that are better for SEO and sharing:

| Source file | Output file |
|---|---|
| `Getting Started.md` | `getting-started.html` |
| `My Cool Page.md` | `my-cool-page.html` |
| `Page & Notes.md` | `page-notes.html` |
| `index.md` | `index.html` |

All wikilinks, navigation, sitemap, and RSS feed hrefs use the slugified filenames automatically.

### Base URL

When deploying to a subdirectory (e.g. `https://example.com/docs/`), set the base URL prefix:

```bash
npm run convert -- --input ./notes --output ./site --base-url /docs
```

This prefixes all navigation links and asset references with `/docs/`.

### Sitemap

A `sitemap.xml` is automatically generated in the output directory containing all public pages. If pages have a `date:` field, it is included as `<lastmod>`.

### RSS / Atom Feed

An RSS feed (`feed.xml`) is generated for pages with a `date:` field, sorted newest-first. This enables blog-style subscriptions.

## Table of Contents

Every page automatically gets a table of contents generated from its `h2`, `h3`, and `h4` headings. The TOC is rendered as a collapsible `<details>` element at the top of the content area.

Headings automatically receive `id` attributes for deep linking.

## HTML Structure Reference

Here is the HTML structure the `docs` layout produces:

```html
<body>
  <header>
    <!-- contents of header.html, or an HTML comment if not set -->
  </header>
  <nav class="site-nav">
    <ul>
      <li><a href="index.html">Home</a></li>
      <li class="nav-current"><a href="my-page.html">My Page</a></li>
    </ul>
  </nav>
  <article class="markdown-body">
    <nav class="toc">
      <details open>
        <summary>Contents</summary>
        <ul>
          <li><a href="#section">Section</a></li>
        </ul>
      </details>
    </nav>
    <!-- rendered markdown -->
  </article>
  <footer>
    <!-- contents of footer.html, or an HTML comment if not set -->
  </footer>
</body>
```

Key classes:

| Class | Element | Notes |
|---|---|---|
| `site-header` | `<div>` | Default header partial wrapper (customise in `header.html`) |
| `site-footer` | `<div>` | Default footer partial wrapper (customise in `footer.html`) |
| `site-nav` | `<nav>` | Sidebar navigation (auto-generated or from `nav.md`) |
| `nav-current` | `<li>` | Currently active page |
| `markdown-body` | `<article>` | Content area (docs layout) -- compatible with github-markdown-css |
| `blog-post` | `<article>` | Content area (blog layout) |
| `toc` | `<nav>` | Table of contents |
| `page-date` | `<time>` | Date display (blog layout) |
| `retina` | `<img>` | Retina-sized image |
| `missing-page` | `<p>` | Placeholder page for unresolved wikilinks |

## CLI Reference

```
asnotes-publish --input <dir> --output <dir> [options]
asnotes-publish --config <file> [options]

Options:
  --config <file>           Load settings from a JSON config file
  --stylesheet <url|file>   Add a stylesheet (repeatable)
  --asset <file>            Copy a file to output (repeatable)
  --default-public          Treat all pages as public unless public: false
  --default-assets          Copy referenced assets unless assets: false
  --layout <name>           Layout template: docs, blog, minimal (default: docs)
  --layouts <path>          Directory containing editable layout templates
  --includes <path>         Directory for custom headers and footers
  --theme <name>            Built-in CSS theme: default, dark
  --retina                  Enable retina image sizing globally
  --base-url <prefix>       URL path prefix for links and assets
  --include-drafts          Include pages with draft: true
  --exclude <dirname>       Exclude a directory from scanning (repeatable)

When --config is used, --input defaults to the config file's directory.
CLI flags override config file values.

Default excluded directories: templates, node_modules
```

## Config File

Publish settings are stored in a JSON config file at the root of your notes directory (next to `.asnotes/`). Both the VS Code extension and the CLI read from this file.

The default filename is `asnotes-publish.json`. When publishing from a subdirectory, the filename includes the directory name: `asnotes-publish.<dirname>.json` (e.g. `asnotes-publish.docs-src.json`). See [Multi-Site Publishing](#multi-site-publishing) below.

### Schema

```json
{
    "inputDir": "",
    "defaultPublic": true,
    "defaultAssets": true,
    "layout": "docs",
    "layouts": "./layouts",
    "includes": "./includes",
    "theme": "default",
    "baseUrl": "/my-repo",
    "retina": false,
    "includeDrafts": false,
    "stylesheets": [
        "https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css"
    ],
    "exclude": ["drafts", "archive"],
    "outputDir": "./site"
}
```

The wizard writes all fields with their defaults so you can discover every available option by reading the file.

| Field | Type | Default | Description |
|---|---|---|---|
| `inputDir` | string | `""` | Input directory relative to config file. Empty string means notes root |
| `defaultPublic` | boolean | `false` | Publish all pages unless `public: false` |
| `defaultAssets` | boolean | `false` | Copy referenced assets unless `assets: false` |
| `layout` | string | `"docs"` | Layout template: `docs`, `blog`, `minimal` |
| `layouts` | string | `""` | Directory containing editable layout templates |
| `includes` | string | `""` | Directory for custom headers and footers |
| `theme` | string | `""` | Built-in CSS theme: `default`, `dark` |
| `baseUrl` | string | `""` | URL path prefix for links and assets |
| `retina` | boolean | `false` | Enable retina image sizing globally |
| `includeDrafts` | boolean | `false` | Include pages with `draft: true` |
| `stylesheets` | string[] | `[]` | Stylesheet URLs or local file paths |
| `exclude` | string[] | `[]` | Additional directory names to exclude |
| `outputDir` | string | `""` | Output directory (relative to config file or absolute) |

### Using --config

Pass `--config` to the CLI to load settings from the file:

```bash
asnotes-publish --config ./asnotes-publish.json
```

When `--config` is used:

- `--input` defaults to `inputDir` from the config (resolved relative to the config file), then falls back to the config file's parent directory
- `--output` defaults to the `outputDir` value in the config (resolved relative to the config file)
- CLI flags override any config file values

This means a minimal CI/CD invocation with a config file is:

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

You can override individual settings:

```bash
npx asnotes-publish --config ./asnotes-publish.json --include-drafts --output ./preview
```

### Multi-Site Publishing

You can publish multiple sites from the same workspace by creating separate config files. Each config file targets a different input directory.

The config filename is derived from the input directory name:

| Input directory | Config filename |
|---|---|
| Notes root | `asnotes-publish.json` |
| `./docs-src` | `asnotes-publish.docs-src.json` |
| `./blog` | `asnotes-publish.blog.json` |
| `./pages` | `asnotes-publish.pages.json` |

For example, a workspace with both documentation and a blog might have:

```
my-notes/
  .asnotes/
  asnotes-publish.docs-src.json    # publishes docs-src/ to site/
  asnotes-publish.blog.json        # publishes blog/ to blog-site/
  docs-src/
    pages/
      Getting Started.md
      ...
  blog/
    2025-01-01 First Post.md
    ...
```

Build each site separately:

```bash
npx asnotes-publish --config ./asnotes-publish.docs-src.json
npx asnotes-publish --config ./asnotes-publish.blog.json
```

The VS Code extension discovers all config files automatically and shows a picker when multiple exist.

### Settings to CLI Flag Mapping

If you prefer CLI flags over a config file, here is the mapping:

| Config field | CLI flag |
|---|---|
| `inputDir` | `--input <dir>` |
| `defaultPublic` | `--default-public` |
| `defaultAssets` | `--default-assets` |
| `layout` | `--layout <name>` |
| `layouts` | `--layouts <path>` |
| `includes` | `--includes <path>` |
| `theme` | `--theme <name>` |
| `baseUrl` | `--base-url <prefix>` |
| `retina` | `--retina` |
| `includeDrafts` | `--include-drafts` |
| `stylesheets` | `--stylesheet <url>` (repeatable) |
| `exclude` | `--exclude <dirname>` (repeatable) |
| `outputDir` | `--output <dir>` |

## VS Code Integration

### Publish Command

Use the command palette (`Ctrl+Shift+P`) and run **AS Notes: Publish to HTML**.

If no publish config exists, a setup wizard walks you through:

1. **Input directory** -- notes root or a subdirectory
2. **Default public** -- publish all pages by default?
3. **Default assets** -- copy referenced images and files?
4. **Layout** -- docs, blog, or minimal
5. **Theme** -- default, dark, or none
6. **Base URL** -- path prefix for deployed site
7. **Output directory** -- where to write the HTML
8. **Layouts directory** -- create default editable layouts, browse for an existing directory, or skip
9. **Includes directory** -- create default includes, browse for an existing directory, or skip

The wizard saves your choices to the appropriate config file (e.g. `asnotes-publish.json` or `asnotes-publish.docs-src.json`). All fields are written with defaults so you can discover every option by reading the JSON file.

On subsequent runs with a single config, the converter uses the saved settings immediately -- no wizard, no prompts. With multiple config files, a picker lets you choose which site to publish or create a new configuration.

### Configure Publish Settings

To change your publish settings without building, run **AS Notes: Configure Publish Settings** from the command palette. This shows a picker of existing configs to edit or creates a new one. If you change the input directory, the config file is renamed automatically to match.

You can also edit config files directly -- they are standard JSON.

```

## Publishing to GitHub Pages

### 1. Enable GitHub Pages

In your repository, go to **Settings > Pages** and set the source to **GitHub Actions**.

### 2. Add a CI Workflow

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx asnotes-publish --config ./asnotes-publish.json --base-url /${{ github.event.repository.name }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

Adjust `--config` path and any flag overrides to match your repository layout. The `--base-url` override is needed for GitHub Pages subdirectory deployment. All other settings come from `asnotes-publish.json`.

Alternatively, you can use explicit flags instead of a config file:

```yaml
      - run: >
          npx asnotes-publish
          --input ./notes
          --output ./site
          --default-public
          --default-assets
          --theme default
          --base-url /${{ github.event.repository.name }}
```

### Custom Domain

To serve from a custom domain (e.g. `docs.example.com`):

1. Add a DNS `CNAME` record pointing to `<your-github-username>.github.io`
2. Add a step after the convert step to write the `CNAME` file (the converter wipes output on each run):

   ```yaml
   - run: echo "docs.example.com" > ./site/CNAME
   ```

3. Enter the domain in **Settings > Pages > Custom domain** and enable **Enforce HTTPS**
4. Remove `--base-url` since you're serving from the domain root

## Publishing to Netlify

### 1. Create a `netlify.toml`

Add this to your repository root:

```toml
[build]
  command = "npx asnotes-publish --config ./asnotes-publish.json"
  publish = "site"

[build.environment]
  NODE_VERSION = "20"
```

### 2. Connect Your Repository

1. Log in to [Netlify](https://www.netlify.com) and click **Add new site > Import an existing project**
2. Connect your Git provider and select your repository
3. Netlify auto-detects the `netlify.toml` settings
4. Click **Deploy site**

Netlify automatically builds and deploys on every push. No `--base-url` is needed since Netlify serves from the domain root.

### Custom Domain

In **Site settings > Domain management**, add your custom domain and follow Netlify's DNS instructions.

## Publishing to Vercel

### 1. Configure Vercel

Create `vercel.json` in your repository root:

```json
{
    "buildCommand": "npx asnotes-publish --config ./asnotes-publish.json",
    "outputDirectory": "site",
    "framework": null
}
```

### 2. Connect Your Repository

1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**
2. Import your Git repository
3. Vercel reads `vercel.json` for build settings
4. Click **Deploy**

Vercel deploys on every push and provides a preview URL for each branch.

## Publishing to Cloudflare Pages

### 1. Connect Your Repository

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com) and go to **Compute** > **Workers & Pages**
2. Click **Create application > Pages > Connect to Git**
3. Select your repository

### 2. Configure Build Settings

| Setting | Value |
|---|---|
| Build command | `npx asnotes-publish --config ./asnotes-publish.json` |
| Build output directory | `site` |
| Node.js version | `20` (set as environment variable `NODE_VERSION`) |

Click **Save and Deploy**. Cloudflare Pages deploys on every push with automatic preview deployments for branches.

## Writing a Custom Layout CSS

This documentation site uses a two-column grid layout. Save this as `layout.css`:

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

nav.site-nav {
  background: #f6f8fa;
  border-right: 1px solid #d0d7de;
  padding: 1.5rem 1rem;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

nav.site-nav ul { list-style: none; margin: 0; padding: 0; }

nav.site-nav a {
  display: block;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  text-decoration: none;
  color: #24292f;
  font-size: 0.875rem;
}

nav.site-nav a:hover { background: #eaeef2; color: #0550ae; }
nav.site-nav .nav-current a { background: #ddf4ff; color: #0550ae; font-weight: 600; }

article.markdown-body { padding: 2rem 3rem; max-width: 900px; }

@media (max-width: 700px) {
  body { grid-template-columns: 1fr; }
  nav.site-nav { position: relative; height: auto; border-right: none; border-bottom: 1px solid #d0d7de; }
  article.markdown-body { padding: 1.5rem; }
}
```

Then convert:

```bash
npm run convert -- \
  --input ./notes --output ./site \
  --default-public --default-assets \
  --stylesheet /path/to/layout.css
```
