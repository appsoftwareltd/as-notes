# Publishing a Static Site

AS Notes includes a built-in HTML conversion tool that turns your markdown notes into a static website. You can use this to publish your knowledge base as a standalone site or deploy it to GitHub Pages.

## How It Works

The `html-conversion` package scans a folder of markdown files and converts them to HTML. [[Wikilinks]] between pages are automatically resolved to the correct HTML links.

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

The output folder will be wiped and regenerated on each run. Point any static file server at the output folder to preview the result.

### Local preview

You can serve the output locally using any static file server, for example:

```bash
npx serve /path/to/output
```

## Publishing to GitHub Pages

### 1. Add a CI workflow

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
      - run: npm run convert -- --input ../notes --output ../site
        working-directory: html-conversion
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

Adjust the `--input` path to match the folder containing your notes.

### 2. Enable GitHub Pages

In your repository go to **Settings → Pages** and set the source to **GitHub Actions**.

### Custom Domain

If you want to serve from a custom domain (e.g. `docs.example.com`):

1. Add a DNS `CNAME` record (non-proxied if using Cloudflare):
   ```
   docs.example.com  CNAME  <your-github-username>.github.io
   ```
2. Add a step to your workflow to write the `CNAME` file into the output folder (the converter wipes the output on each run, so this must be done after conversion):
   ```yaml
   - run: echo "docs.example.com" > ../site/CNAME
     working-directory: html-conversion
   ```
3. Enter the domain in **Settings → Pages → Custom domain** and wait for DNS verification.
4. Once verified, enable **Enforce HTTPS**.

> **Note:** If your repository belongs to a GitHub organisation that has a custom domain configured at the org level, GitHub will apply that domain automatically to all repos. In that case you either configure a per-repo custom domain as above, or complete the org-level DNS setup to make the org domain work.
