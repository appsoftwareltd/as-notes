/**
 * Mermaid rendering module
 * 
 * Provides functionality for rendering Mermaid diagrams in VS Code markdown files.
 * Supports both inline decorations and hover previews.
 */

// Public API
export {
  initMermaidRenderer,
  disposeMermaidRenderer,
  renderMermaidSvg,
  renderMermaidSvgNatural,
  svgToDataUri,
  createErrorSvg,
  ensureSvgDimensions,
} from './mermaid-renderer';

// Types
export type { MermaidRenderOptions } from './types';

// Constants (for testing/debugging if needed)
export { MERMAID_CONSTANTS } from './constants';
