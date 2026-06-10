/**
 * Pure helpers for inline image rendering: size-hint parsing and
 * granted-space analysis. No vscode imports so these are unit-testable.
 *
 * Terminology (see CONTEXT.md):
 * - Standalone image: an image tag that is the only content on its line.
 * - Granted space: the image's own line plus the run of blank lines below it.
 * - Size hint: Obsidian-style pipe suffix in the alt text (`![alt|300](p)`,
 *   `![alt|300x200](p)`) expressing the maximum display size.
 */

/** Matches an Obsidian-style size hint at the end of alt text: `|300` or `|300x200`. */
const SIZE_HINT_REGEX = /\|(\d{1,5})(?:[xX](\d{1,5}))?\s*$/;

export interface ImageSizeHint {
  /** Offset of the `|` within the alt text. */
  pipeIndex: number;
  width: number;
  height?: number;
}

/**
 * Parses a size hint from raw alt text. Returns undefined when no valid
 * hint is present or the width is zero.
 */
export function parseImageSizeHint(alt: string): ImageSizeHint | undefined {
  const match = SIZE_HINT_REGEX.exec(alt);
  if (!match || match.index === undefined) {
    return undefined;
  }
  const width = parseInt(match[1], 10);
  if (!Number.isFinite(width) || width < 1) {
    return undefined;
  }
  const hint: ImageSizeHint = { pipeIndex: match.index, width };
  if (match[2] !== undefined) {
    const height = parseInt(match[2], 10);
    if (Number.isFinite(height) && height >= 1) {
      hint.height = height;
    }
  }
  return hint;
}

export interface GrantedSpace {
  /** Number of blank lines below the image line (>= 1). */
  blankLines: number;
  /** Offset (in the same text) of the end of the last blank line's content. */
  spaceEndPos: number;
}

/**
 * Determines whether the image tag at [tagStart, tagEnd) is a standalone
 * image with granted space: alone on its line (whitespace allowed around it)
 * and followed by at least one blank line.
 *
 * Returns undefined when the image is mid-sentence, shares its line with
 * other content, or has no trailing blank line.
 *
 * @param text Normalized (LF) document text — the same text remark parsed.
 */
export function analyzeStandaloneImage(
  text: string,
  tagStart: number,
  tagEnd: number,
): GrantedSpace | undefined {
  const lineStart = text.lastIndexOf('\n', tagStart - 1) + 1;
  if (text.slice(lineStart, tagStart).trim() !== '') {
    return undefined;
  }

  let lineEnd = text.indexOf('\n', tagEnd);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }
  if (text.slice(tagEnd, lineEnd).trim() !== '') {
    return undefined;
  }

  let blankLines = 0;
  let spaceEndPos = lineEnd;
  let pos = lineEnd;
  while (pos < text.length) {
    const nextNewline = text.indexOf('\n', pos + 1);
    const nextLineEnd = nextNewline === -1 ? text.length : nextNewline;
    if (text.slice(pos + 1, nextLineEnd).trim() !== '') {
      break;
    }
    blankLines++;
    spaceEndPos = nextLineEnd;
    pos = nextLineEnd;
  }

  if (blankLines === 0) {
    return undefined;
  }
  return { blankLines, spaceEndPos };
}

/** MIME types for the image formats the inline renderer supports. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

export function mimeTypeForImagePath(filePath: string): string | undefined {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) {
    return undefined;
  }
  return MIME_BY_EXTENSION[filePath.slice(dot).toLowerCase()];
}

/**
 * Wraps base64 image data in an SVG envelope whose intrinsic size is the
 * target display size. VS Code renders decoration attachments via CSS
 * `content: url(...)`, which always draws at intrinsic size — CSS
 * width/height cannot scale it — so the scaling must live inside the
 * image itself, exactly as the Mermaid/math SVGs do.
 */
export function wrapImageInSvg(base64Data: string, mime: string, width: number, height: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image width="${width}" height="${height}" preserveAspectRatio="none" href="data:${mime};base64,${base64Data}"/>` +
    `</svg>`
  );
}

/**
 * Shrink-to-fit sizing: the size hint (or natural size) is a ceiling, the
 * granted space is a hard cap; width always follows the aspect ratio.
 *
 * The last blank line of the granted space is reserved as a margin so the
 * picture does not touch the following text. With a single blank line there
 * is no room for a margin and the picture fills that one line.
 */
export function computeRenderSize(
  image: { grantedLines: number; hintWidth?: number; hintHeight?: number },
  dimensions: { width: number; height: number },
  lineHeight: number,
  maxHeightLines: number,
): { width: number; height: number } | undefined {
  const renderableLines = Math.max(1, image.grantedLines - 1);
  const grantedPx = Math.max(1, Math.min(renderableLines, maxHeightLines)) * lineHeight;

  let width: number;
  let height: number;
  if (image.hintWidth !== undefined) {
    width = image.hintWidth;
    height = image.hintHeight ?? Math.max(1, Math.round((dimensions.height * image.hintWidth) / dimensions.width));
  } else {
    width = dimensions.width;
    height = dimensions.height;
  }

  if (height > grantedPx) {
    width = Math.round((width * grantedPx) / height);
    height = grantedPx;
  }

  if (width < 1 || height < 1) {
    return undefined;
  }
  return { width, height };
}
