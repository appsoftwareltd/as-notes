// Barrel file for all services

// ============================================================================
// SYNTAX HIGHLIGHTING SETUP (highlight.js)
// ============================================================================
// This application uses highlight.js for syntax highlighting in rendered markdown code blocks.
//
// CLIENT-SIDE APPROACH:
// 1. CSS: Import the GitHub theme CSS which gets bundled into bundle.css by esbuild
// 2. JavaScript: Export hljs as App.hljs for client-side highlighting of code blocks
//
// WHY THIS APPROACH:
// - Server-side rendered HTML (blog posts, content pages) contains raw code blocks with language classes
// - Client-side JavaScript (hljs.highlightElement()) tokenizes the code and adds color classes
// - This keeps server-side HTML clean and allows dynamic re-highlighting (e.g., admin editor preview)
//
// IMPLEMENTATION:
// - Server-side (C#): MarkdownService adds 'hljs language-{lang}' classes to <code> tags
// - Client-side (JS): hljs.highlightElement() adds token classes (.hljs-keyword, .hljs-string, etc.)
// - CSS (bundle.css): Applies colors to the token classes
//
// See _HighlightJsInit.cshtml for the script that runs highlightElement() on page load

import "highlight.js/styles/github.css";
export { default as hljs } from "highlight.js";

export * from "./Wikilink";
export * from "./WikilinkService";
export * from "./MarkdownService";
export * from "./CodeMirrorService";
export * from "./AbTesting";
