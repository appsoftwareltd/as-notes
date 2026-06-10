import {
  type TextEditor,
  type TextEditorDecorationType,
  type Range,
  window,
  Uri,
} from 'vscode';
import * as fs from 'fs';
import type { StandaloneImage } from '../parser';
import { readImageDimensions, type ImageDimensions } from '../image-dimensions';
import { computeRenderSize, mimeTypeForImagePath, wrapImageInSvg } from '../image-utils';
import { svgToDataUriBase64 } from '../mermaid/svg-processor';
import { getEditorHeights } from '../math/math-decorations';
import { config } from '../config';

type ImageDecorationEntry = {
  decorationType: TextEditorDecorationType;
  lastUsed: number;
};

type DimensionsCacheEntry = {
  mtimeMs: number;
  dimensions: ImageDimensions | undefined;
  lastUsed: number;
};

/** Files larger than this are not embedded (decoration CSS holds the base64 data). */
const MAX_EMBED_BYTES = 20 * 1024 * 1024;

/**
 * Renders standalone images inline using the same decoration pattern as
 * Mermaid/math: the picture is a `before` attachment anchored to the first
 * blank line below the image tag, sized shrink-to-fit within the granted
 * space (the trailing blank lines). The tag line's rendered alt link stays
 * visible above the picture. See CONTEXT.md and ADR 0001.
 */
export class ImageInlineDecorations {
  private cache = new Map<string, ImageDecorationEntry>();
  private dimensionsCache = new Map<string, DimensionsCacheEntry>();
  private usageCounter = 0;

  constructor(
    private maxEntries: number = 50,
    private maxDimensionEntries: number = 200,
  ) {}

  /**
   * Applies inline image decorations. Items whose range is null (cursor or
   * selection inside the image or its granted space) are skipped, matching
   * the Mermaid hide-while-inside behaviour.
   */
  apply(
    editor: TextEditor,
    items: Array<{ image: StandaloneImage; range: Range | null }>,
  ): void {
    const usedKeys = new Set<string>();
    const { lineHeight } = getEditorHeights();
    const maxHeightLines = config.images.maxHeightLines();

    const rangesByKey = new Map<string, { ranges: Range[]; create: () => TextEditorDecorationType | undefined }>();

    for (const { image, range } of items) {
      if (!range) {
        continue;
      }

      const filePath = resolveLocalImagePath(image.url, editor.document.uri);
      if (!filePath) {
        continue;
      }

      let mtimeMs: number;
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_EMBED_BYTES) {
          continue;
        }
        mtimeMs = stat.mtimeMs;
      } catch {
        continue; // missing or unreadable file: keep hover-only behaviour
      }

      const dimensions = this.getDimensions(filePath, mtimeMs);
      if (!dimensions) {
        continue;
      }

      const size = computeRenderSize(image, dimensions, lineHeight, maxHeightLines);
      if (!size) {
        continue;
      }

      const key = `${filePath}:${mtimeMs}:${size.width}x${size.height}`;
      const existing = rangesByKey.get(key);
      if (existing) {
        existing.ranges.push(range);
      } else {
        rangesByKey.set(key, {
          ranges: [range],
          create: () => createImageDecorationType(filePath, size.width, size.height),
        });
      }
    }

    for (const [key, { ranges, create }] of rangesByKey.entries()) {
      const entry = this.getOrCreateEntry(key, create);
      if (!entry) {
        continue;
      }
      usedKeys.add(key);
      editor.setDecorations(entry.decorationType, ranges);
    }

    this.disposeUnused(editor, usedKeys);
  }

  clear(editor: TextEditor): void {
    for (const entry of this.cache.values()) {
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
    }
    this.cache.clear();
  }

  private getDimensions(filePath: string, mtimeMs: number): ImageDimensions | undefined {
    const cached = this.dimensionsCache.get(filePath);
    if (cached && cached.mtimeMs === mtimeMs) {
      cached.lastUsed = ++this.usageCounter;
      return cached.dimensions;
    }
    const dimensions = readImageDimensions(filePath);
    this.dimensionsCache.set(filePath, {
      mtimeMs,
      dimensions,
      lastUsed: ++this.usageCounter,
    });
    if (this.dimensionsCache.size > this.maxDimensionEntries) {
      evictLru(this.dimensionsCache);
    }
    return dimensions;
  }

  private getOrCreateEntry(key: string, create: () => TextEditorDecorationType | undefined): ImageDecorationEntry | undefined {
    const existing = this.cache.get(key);
    if (existing) {
      existing.lastUsed = ++this.usageCounter;
      return existing;
    }
    const decorationType = create();
    if (!decorationType) {
      return undefined;
    }
    const entry: ImageDecorationEntry = {
      decorationType,
      lastUsed: ++this.usageCounter,
    };
    this.cache.set(key, entry);
    if (this.cache.size > this.maxEntries) {
      const evicted = evictLru(this.cache);
      evicted?.decorationType.dispose();
    }
    return entry;
  }

  private disposeUnused(editor: TextEditor, usedKeys: Set<string>): void {
    for (const [key, entry] of this.cache.entries()) {
      if (usedKeys.has(key)) {
        continue;
      }
      editor.setDecorations(entry.decorationType, []);
      entry.decorationType.dispose();
      this.cache.delete(key);
    }
  }
}

/** Removes and returns the least-recently-used entry of an LRU map. */
function evictLru<V extends { lastUsed: number }>(map: Map<string, V>): V | undefined {
  let lruKey: string | undefined;
  let lruAccess = Infinity;
  for (const [key, entry] of map.entries()) {
    if (entry.lastUsed < lruAccess) {
      lruAccess = entry.lastUsed;
      lruKey = key;
    }
  }
  if (lruKey === undefined) {
    return undefined;
  }
  const entry = map.get(lruKey);
  map.delete(lruKey);
  return entry;
}

function createImageDecorationType(
  filePath: string,
  width: number,
  height: number,
): TextEditorDecorationType | undefined {
  // VS Code renders the attachment via CSS `content: url(...)`, which always
  // draws at the image's intrinsic size — width/height cannot scale it. So,
  // like Mermaid/math, the target size must be intrinsic: wrap the file
  // (base64) in an SVG envelope sized to the computed render size.
  const mime = mimeTypeForImagePath(filePath);
  if (!mime) {
    return undefined;
  }
  let base64: string;
  try {
    base64 = fs.readFileSync(filePath).toString('base64');
  } catch {
    return undefined;
  }
  // The decoration is anchored to a zero-length range at the start of the
  // first blank line below the tag, so there is no tag text to restyle —
  // the rendered alt link above stays visible and hoverable.
  const svg = wrapImageInSvg(base64, mime, width, height);
  return window.createTextEditorDecorationType({
    before: {
      contentIconPath: Uri.parse(svgToDataUriBase64(svg)),
      textDecoration: 'none;',
    },
    rangeBehavior: 1 as const /* TrackedRangeStickiness.NeverGrowWhenTypingAtEdges */,
  });
}

/**
 * Resolves a markdown image URL to a local filesystem path. Remote and data
 * URLs return undefined — inline rendering is local-files-only (ADR 0001).
 */
export function resolveLocalImagePath(url: string, documentUri: Uri): string | undefined {
  let trimmed = url.trim();
  if (!trimmed || /^(https?|data|vscode|untitled|mailto):/i.test(trimmed)) {
    return undefined;
  }
  if (trimmed.startsWith('file:')) {
    try {
      return Uri.parse(trimmed).fsPath;
    } catch {
      return undefined;
    }
  }
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Keep the raw string when percent-decoding fails.
  }
  if (trimmed.startsWith('/')) {
    return Uri.file(trimmed).fsPath;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed;
  }
  return Uri.joinPath(documentUri, '..', trimmed).fsPath;
}
