/**
 * Constants for Mermaid rendering
 */
export const MERMAID_CONSTANTS = {
  /** Maximum number of cached decoration entries (LRU cache) */
  DECORATION_CACHE_MAX_ENTRIES: 250,
  /** Request timeout in milliseconds (30 seconds) */
  REQUEST_TIMEOUT_MS: 30000,
  /** Hover request timeout in milliseconds (5 seconds - matches VS Code hover timeout) */
  HOVER_REQUEST_TIMEOUT_MS: 5000,
} as const;
