# Publishing a Static Site

AS Notes includes a built-in HTML conversion tool that turns your markdown notes into a static website. You can use this to publish your knowledge base as a standalone site or deploy it to GitHub Pages.

This documentation is itself a working example — it was written in AS Notes and published using the same tool.

## How It Works

The `html-conversion` package scans a folder of markdown files and converts them to HTML. [[Wikilinks]] between pages are automatically resolved to the correct HTML links. A navigation sidebar is generated automatically from the list of pages.

Each page is wrapped in semantic HTML with class names you can style any way you like — or not at all. Unstyled output is clean, readable HTML with zero dependencies.

## Prerequisites

- [Node.js](https://nodejs.org) 20 or later
- Your notes in a folder of `.md` files

## Standalone Usage

### 1. Install the converter

Clone or download the `html-conversion` package from the AS Notes repository, then install dependencies:

```bash
cd html-conversion
npm install
npm run build
```

### 2. Convert your notes

```bash
npm run convert -- --input /path/to/your/notes --output /path/to/output
```

The output folder is wiped and regenerated on every run. Open any `.html` file in a browser to preview, or serve the folder with a local file server:

```bash
npx serve /path/to/output
```

## Adding Styles

By default the output is unstyled HTML. You can inject any stylesheet — a CDN link, a local file, or both — without touching the converter itself.

### Using a CDN stylesheet

Pass `--stylesheet` with a URL. You can repeat the flag to add multiple stylesheets in order:

```bash
npm run convert -- \
  --input /path/to/notes \
  --output /path/to/output \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css
```

Every generated page will include that `<link>` tag in its `<head>`. The content area uses `<article class="markdown-body">`, which is the class expected by [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) — so the above just works.

### Using a local stylesheet

Use `--asset` to copy a local CSS file into the output folder, then reference it by filename with `--stylesheet`:

```bash
npm run convert -- \
  --input /path/to/notes \
  --output /path/to/output \
  --stylesheet my-styles.css \
  --asset /path/to/my-styles.css
```

`--asset` copies the file into the output directory. `--stylesheet` injects it as a relative `<link href="my-styles.css">`.

Because the output folder is wiped on each run, any CSS you want in the output **must** be passed via `--asset` — files placed there manually will be deleted.

### Combining CDN and local stylesheets

You can pass `--stylesheet` and `--asset` as many times as you need, in any order:

```bash
npm run convert -- \
  --input /path/to/notes \
  --output /path/to/output \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css \
  --stylesheet layout.css \
  --asset /path/to/layout.css
```

Stylesheet `<link>` tags are injected in the order you specify them.

## Writing a Custom Layout (like this site)

This documentation site uses a two-column grid layout with a styled sidebar nav. Here is the CSS pattern used — save it as `layout.css` alongside your notes:

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Sidebar */
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

nav.site-nav a:hover      { background: #eaeef2; color: #0550ae; }
nav.site-nav .nav-current a { background: #ddf4ff; color: #0550ae; font-weight: 600; }

/* Content */
article.markdown-body { padding: 2rem 3rem; max-width: 900px; }

/* Responsive */
@media (max-width: 700px) {
  body { grid-template-columns: 1fr; }
  nav.site-nav { position: relative; height: auto; border-right: none; border-bottom: 1px solid #d0d7de; }
  article.markdown-body { padding: 1.5rem; }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  body { background: #0d1117; color: #e6edf3; }
  nav.site-nav { background: #161b22; border-right-color: #30363d; }
  nav.site-nav a { color: #c9d1d9; }
  nav.site-nav a:hover { background: #21262d; color: #58a6ff; }
  nav.site-nav .nav-current a { background: #1c2d3e; color: #58a6ff; }
}
```

Then convert using both the markdown CSS and your layout file:

```bash
npm run convert -- \
  --input /path/to/notes \
  --output /path/to/output \
  --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css \
  --stylesheet layout.css \
  --asset /path/to/layout.css
```

### HTML structure reference

If you're writing your own stylesheet, here's what the converter outputs:

```html
<body>
  <nav class="site-nav">
    <ul>
      <li><a href="index.html">Home</a></li>
      <li class="nav-current"><a href="my-page.html">My Page</a></li>
      ...
    </ul>
  </nav>
  <article class="markdown-body">
    <!-- your converted markdown here -->
  </article>
</body>
```

Key classes:

| Class | Element | Notes |
|---|---|---|
| `site-nav` | `<nav>` | The sidebar navigation |
| `nav-current` | `<li>` | The currently active page |
| `markdown-body` | `<article>` | The content area — compatible with github-markdown-css |
| `missing-page` | `<p>` | Shown on auto-generated placeholder pages for unresolved wikilinks |

## Publishing to GitHub Pages

### 1. Enable GitHub Pages

In your repository go to **Settings → Pages** and set the source to **GitHub Actions**.

### 2. Add a CI workflow

Create `.github/workflows/pages.yml` in your repository:

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
      - run: npm ci
        working-directory: html-conversion
      - run: npm run build
        working-directory: html-conversion
      - run: >
          npm run convert --
          --input ../notes
          --output ../site
          --stylesheet https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.css
          --stylesheet layout.css
          --asset ../notes/layout.css
        working-directory: html-conversion
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

Adjust `--input`, `--output`, and `--asset` paths to match your repository layout. Remove the `--stylesheet` and `--asset` flags if you don't need custom styles.

### Custom Domain

If you want to serve from a custom domain (e.g. `docs.example.com`):

1. Add a DNS `CNAME` record pointing to `<your-github-username>.github.io`.
2. Add a step **after** the convert step to write the `CNAME` file (the converter wipes the output on each run, so this must happen after):
   ```yaml
   - run: echo "docs.example.com" > ../site/CNAME
     working-directory: html-conversion
   ```
3. Enter the domain in **Settings → Pages → Custom domain** and wait for DNS verification.
4. Once verified, enable **Enforce HTTPS**.

> **Note:** If your repository belongs to a GitHub organisation that has a custom domain configured at the org level, GitHub will apply that domain automatically to all repos. In that case you either configure a per-repo custom domain as above, or complete the org-level DNS setup to make the org domain work.
