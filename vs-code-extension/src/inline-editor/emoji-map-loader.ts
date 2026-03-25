// Helper module to handle lazy loading of emoji map
// This allows the emoji map to be loaded only when needed, improving initial load time
// Works in both CommonJS (VS Code) and ESM (Jest) contexts

let emojiByShortcode: Record<string, string> | null = null;

/**
 * Lazily loads the emoji map when needed.
 * The emoji map is large (1917 entries), so we only load it when emoji shortcodes
 * are actually encountered in the document.
 *
 * Uses a pattern similar to parser-remark to handle both CommonJS (VS Code) and ESM (Jest) contexts.
 * In Jest with ts-jest, modules are transformed so require() works.
 *
 * @returns The emoji map (loaded and cached on first call)
 */
export function getEmojiMap(): Record<string, string> {
  if (emojiByShortcode === null) {
    // Use require - works in VS Code extension CommonJS context
    // For Jest, ts-jest transforms the module so require() works
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const emojiMapModule = require("./emoji-map");
    emojiByShortcode = emojiMapModule.emojiByShortcode;
  }
  // At this point, emojiByShortcode is guaranteed to be non-null
  return emojiByShortcode as Record<string, string>;
}
