---
title: AS Notes - A Static Site Generator in your Markdown Knowledgebase.md
description: AS Notes brings wikilink-style note-taking into VS Code. Capture ideas, link concepts, manage tasks, and now publish your notes as a static website.
date: 2026-03-24
author: Gareth Brown
order: 1
---

# AS Notes - A Static Site Generator in your Markdown Knowledgebase

**Write notes using markdown and wikilinks in VS Code, and publish your blog, docs and wiki from the same workspace. Push to Git to deploy.**

This repository ([blog.asnotes.io](https://blog.asnotes.io)) is a working example of [AS Notes](https://www.asnotes.io) as a publishing platform — a static site generator built into a VS Code extension. No framework, no build pipeline to maintain. Just a JSON config file and a folder of markdown. The same setup works with GitHub Pages, Netlify, Vercel, or any host that serves static files. This repo targets Cloudflare Pages.

**AS Notes** helps you to publish your notes to a static site in the same way that you might use **Jekyll**, **Hugo**, **Eleventy** or **Docusaurus**, but from your existing markdown notes knowledge base and from within VS Code.

> Download from [AS Notes - VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)

## How it works

[AS Notes](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) is a Personal Knowledge Management extension for VS Code. It adds `[[wikilinks]]`, backlinks, task management, journaling, kanban boards, and outliner mode to plain markdown files.

It also ships a built-in HTML converter. Point it at a folder in your AS Notes managed markdown and it produces clean, styled HTML with auto-resolved wikilinks, navigation, sitemaps, and RSS feeds.

This repo uses that converter to publish a blog. Based on the Cloudflare pages link to the Github repository, every push to `main` triggers a Cloudflare Pages build that converts the markdown in `blog/` to static HTML and deploys it. For full documentation on **AS Notes** static site publishing, see the [full docs](https://docs.asnotes.io/publishing-a-static-site.html).

![AS Notes Editor Screenshot Meta](../assets/images/as-notes-editor-screenshot-meta.png)

## Publishing configuration and repository structure

Setting up `asnotes-bublish.<sourcedir>.json` via the built in configuration wizard produces the following config file, which is set up once and controls publishing going forward.

```
{
    "inputDir": "./blog",
    "defaultPublic": true,
    "defaultAssets": true,
    "layout": "blog",
    "layouts": "./asnotes-publish.layouts.blog",
    "includes": "./asnotes-publish.includes.blog",
    "theme": "dark",
    "themes": "./asnotes-publish.themes.blog",
    "baseUrl": "",
    "retina": false,
    "includeDrafts": false,
    "stylesheets": [],
    "exclude": [],
    "outputDir": "./blog-publish"
}
```

The following directory / file structure is results from this configuration.

```
blog/                              ← Markdown source files
  introducing-as-notes.md

blog-publish/                      ← Generated HTML output
  index.html
  introducing-as-notes.html
  feed.xml
  sitemap.xml
  theme-dark.css
  assets/

asnotes-publish.blog.json          ← Publish configuration
asnotes-publish.layouts.blog/      ← Custom layout templates
asnotes-publish.includes.blog/     ← Header and footer partials
asnotes-publish.themes.blog/       ← Custom CSS themes
```

Blog posts are standard markdown files with YAML front matter:

```yaml
---
title: AS Notes - A Static Site Generator in your Markdown Knowledgebase.md
description: AS Notes brings wikilink-style note-taking into VS Code.
date: 2026-03-24
order: 1
---
```

With `defaultPublic: true` in the config, every page in `blog/` is published unless it opts out with `public: false` in its front matter. Without that flag, pages need `public: true` to be included. Encrypted `.enc.md` files are always excluded.

### Publishing configuration

What each field does:

| Field | Value | Purpose |
|---|---|---|
| `inputDir` | `./blog` | Folder of markdown source files |
| `outputDir` | `./blog-publish` | Where the generated HTML goes |
| `defaultPublic` | `true` | Publish all pages unless a page opts out with `public: false` |
| `defaultAssets` | `true` | Copy referenced images and files to output |
| `layout` | `blog` | Article-style layout with date display |
| `layouts` | `./asnotes-publish.layouts.blog` | Custom layout templates |
| `includes` | `./asnotes-publish.includes.blog` | Header and footer HTML partials |
| `theme` | `dark` | Dark colour scheme |
| `themes` | `./asnotes-publish.themes.blog` | Custom theme CSS directory |

### Layouts and theming

The blog layout wraps each post in an `<article class="blog-post">` element with date display, table of contents, and navigation. The layout template lives in [asnotes-publish.layouts.blog/blog.html](asnotes-publish.layouts.blog/blog.html) and uses template tokens like `{{content}}`, `{{nav}}`, `{{date}}`, and `{{header}}` that the converter replaces at build time.

Header and footer partials in [asnotes-publish.includes.blog/](asnotes-publish.includes.blog/) inject consistent branding across every page. The dark theme CSS in [asnotes-publish.themes.blog/dark.css](asnotes-publish.themes.blog/dark.css) provides all the styling.

All of these are plain, editable files. No abstractions, no config API — change the HTML and CSS directly.

## Cloudflare Pages deployment

This blog deploys automatically via Cloudflare Pages with Git integration. Every push to `main` triggers a build.

### Build settings

| Setting | Value |
|---|---|
| **Build command** | `npx @appsoftwareltd/asnotes-publish --config ./asnotes-publish.blog.json` |
| **Deploy command** | `npx wrangler deploy` |
| **Root directory** | `/` |
| **Production branch** | `main` |

The build command runs the AS Notes converter as an npm package. It reads the config file, converts markdown to HTML, and writes the output to `blog-publish/`. Cloudflare then deploys that directory.

No `--base-url` is needed — Cloudflare Pages serves from the domain root.

### Custom domain

The blog is served at **blog.asnotes.io** via a custom domain configured in Cloudflare Pages. Add your own in **Workers & Pages > your project > Custom domains**.

### Setting up your own

*These steps assume publishing from a directory `blog` with above configuration.*

1. Push your AS Notes workspace to a Git repository
2. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Compute (Workers & Pages)** and create an application
3. Connect your Git repository
4. Set the build command to `npx @appsoftwareltd/asnotes-publish --config ./asnotes-publish.blog.json`
5. Set the build output directory to match your `outputDir` (e.g. `blog-publish`)
6. Add `NODE_VERSION = 20` under **Variables and secrets** if needed
7. Deploy

That's the entire CI/CD pipeline. No workflow files, no build scripts, no dependencies to manage.

## Local preview

Run the converter locally from VS Code with **AS Notes: Publish to HTML** (Command Palette → `Ctrl+Shift+P`), or from the terminal:

```bash
npx @appsoftwareltd/asnotes-publish --config ./asnotes-publish.blog.json
```

Preview the output:

```bash
npx serve ./blog-publish
```

## Writing a new post

1. Create a markdown file in `blog/`
2. Add front matter with `title`, `description`, and `date`
3. Write your post
4. Publish locally to preview, or push to `main` and Cloudflare builds it

The converter auto-generates an index page (you can include your own `index.md` if you prefer) listing all posts, a`sitemap.xml`, and an RSS`feed.xml` sorted newest-first.

## Resources

- [AS Notes on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
- [AS Notes documentation](https://www.asnotes.io)
- [Publishing a Static Site docs](https://docs.asnotes.io/publishing-a-static-site.html)
- [AS Notes on GitHub](https://github.com/appsoftwareltd/as-notes)
