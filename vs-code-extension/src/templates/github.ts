/**
 * GitHub-inspired template set for AS Notes publishing.
 * Hand-written CSS with light and dark variants.
 */

export const DEFAULT_HEADER_HTML = `<div class="site-header">
    <a class="site-title" href="{{base-url}}/">
        {{site-icon}}
        {{site-title}}
    </a>
</div>
`;

export const DEFAULT_ICON_SVG = `<svg class="site-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191.82 166.13" width="24" height="21"><path fill="currentColor" fill-rule="evenodd" d="M67.09,132.92,47.93,166.13H9.59L0,149.52,86.33,0H105.5L19.17,149.52H38.34l19.17-33.2h76.8l9.59,16.6Zm48-83.12,9.65,16.71H143.9L115.08,16.6q-24,41.57-48,83.12H143.9q14.37,24.9,28.76,49.8h-96l-9.59,16.61H182.24l9.58-16.61-38.34-66.4H96C95.85,82.9,113.39,52.73,115.08,49.8Z"/></svg>
`;

export const DEFAULT_FOOTER_HTML = `<div class="site-footer">
    <p>&copy; ${new Date().getFullYear()} Built with <a href="https://www.asnotes.io">AS Notes</a> by <a href="https://www.appsoftware.com">App Software Ltd</a></p>
</div>
`;

export const LAYOUT_DOCS = `<!DOCTYPE html>
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

export const LAYOUT_BLOG = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>{{stylesheets}}{{meta}}
</head>
<body data-layout="blog">
{{header}}    <article class="blog-post">
{{home-link}}{{heading}}{{image}}{{date}}{{author}}{{toc}}
{{content}}
    </article>
{{footer}}</body>
</html>
`;

export const LAYOUT_MINIMAL = `<!DOCTYPE html>
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

export const LAYOUT_TEMPLATES: Record<string, string> = {
    docs: LAYOUT_DOCS,
    blog: LAYOUT_BLOG,
    minimal: LAYOUT_MINIMAL,
};

export const THEME_DEFAULT = `/* AS Notes default theme */

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
    width: 100%;
    max-width: 1024px;
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

body[data-layout="blog"] article.blog-post {
    width: 100%;
    max-width: 1024px;
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
    width: 100%;
    max-width: 1024px;
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

    header,
    footer {
        grid-column: 1 / -1;
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

    /* Blog: single column, no sidebar */
    body[data-layout="blog"] {
        grid-template-columns: 1fr;
    }

    body[data-layout="blog"] article.blog-post {
        grid-column: 1;
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

export const THEME_DARK = `/* AS Notes dark theme */

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
    width: 100%;
    max-width: 1024px;
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

body[data-layout="blog"] article.blog-post {
    width: 100%;
    max-width: 1024px;
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
    width: 100%;
    max-width: 1024px;
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

    header,
    footer {
        grid-column: 1 / -1;
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

    /* Blog: single column, no sidebar */
    body[data-layout="blog"] {
        grid-template-columns: 1fr;
    }

    body[data-layout="blog"] article.blog-post {
        grid-column: 1;
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

export const THEME_TEMPLATES: Record<string, string> = {
    default: THEME_DEFAULT,
    dark: THEME_DARK,
};
