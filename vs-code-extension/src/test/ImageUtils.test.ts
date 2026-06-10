import { describe, it, expect } from 'vitest';
import {
  parseImageSizeHint,
  analyzeStandaloneImage,
  computeRenderSize,
  mimeTypeForImagePath,
  wrapImageInSvg,
} from '../inline-editor/image-utils';

describe('parseImageSizeHint', () => {
  it('parses a width-only hint', () => {
    expect(parseImageSizeHint('photo|300')).toEqual({ pipeIndex: 5, width: 300 });
  });

  it('parses a width x height hint', () => {
    expect(parseImageSizeHint('photo|300x200')).toEqual({ pipeIndex: 5, width: 300, height: 200 });
  });

  it('accepts uppercase X', () => {
    expect(parseImageSizeHint('photo|300X200')).toEqual({ pipeIndex: 5, width: 300, height: 200 });
  });

  it('parses a hint on empty alt (Obsidian ![|300] form)', () => {
    expect(parseImageSizeHint('|300')).toEqual({ pipeIndex: 0, width: 300 });
  });

  it('uses only the last pipe segment', () => {
    expect(parseImageSizeHint('a|b|300')).toEqual({ pipeIndex: 3, width: 300 });
  });

  it('returns undefined when there is no hint', () => {
    expect(parseImageSizeHint('photo')).toBeUndefined();
    expect(parseImageSizeHint('')).toBeUndefined();
  });

  it('returns undefined for non-numeric or mid-text pipes', () => {
    expect(parseImageSizeHint('photo|big')).toBeUndefined();
    expect(parseImageSizeHint('photo|300 wide')).toBeUndefined();
  });

  it('returns undefined for zero width', () => {
    expect(parseImageSizeHint('photo|0')).toBeUndefined();
  });

  it('ignores an invalid zero height but keeps the width', () => {
    expect(parseImageSizeHint('photo|300x0')).toEqual({ pipeIndex: 5, width: 300 });
  });
});

describe('analyzeStandaloneImage', () => {
  const tag = '![photo](img.png)';

  function doc(text: string): { text: string; start: number; end: number } {
    const start = text.indexOf(tag);
    return { text, start, end: start + tag.length };
  }

  it('detects a standalone image followed by one blank line', () => {
    const { text, start, end } = doc(`before\n\n${tag}\n\nafter\n`);
    const granted = analyzeStandaloneImage(text, start, end);
    expect(granted).toBeDefined();
    expect(granted!.blankLines).toBe(1);
    // Granted space ends at the end of the blank line between image and "after"
    expect(text.slice(granted!.spaceEndPos, granted!.spaceEndPos + 6)).toBe('\nafter');
  });

  it('counts multiple trailing blank lines', () => {
    const { text, start, end } = doc(`${tag}\n\n\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)!.blankLines).toBe(3);
  });

  it('treats whitespace-only lines as blank', () => {
    const { text, start, end } = doc(`${tag}\n   \n\t\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)!.blankLines).toBe(2);
  });

  it('returns undefined with no trailing blank line', () => {
    const { text, start, end } = doc(`${tag}\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)).toBeUndefined();
  });

  it('returns undefined for a mid-sentence image', () => {
    const { text, start, end } = doc(`some text ${tag}\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)).toBeUndefined();
  });

  it('returns undefined when other text follows on the same line', () => {
    const { text, start, end } = doc(`${tag} trailing\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)).toBeUndefined();
  });

  it('returns undefined inside a list item line', () => {
    const { text, start, end } = doc(`- ${tag}\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)).toBeUndefined();
  });

  it('allows leading whitespace indentation', () => {
    const { text, start, end } = doc(`   ${tag}\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)!.blankLines).toBe(1);
  });

  it('counts the empty final line at end of file', () => {
    const { text, start, end } = doc(`${tag}\n`);
    expect(analyzeStandaloneImage(text, start, end)!.blankLines).toBe(1);
  });

  it('returns undefined for an image at end of file with no newline', () => {
    const { text, start, end } = doc(`before\n\n${tag}`);
    expect(analyzeStandaloneImage(text, start, end)).toBeUndefined();
  });

  it('detects an image on the first line of the document', () => {
    const { text, start, end } = doc(`${tag}\n\nafter\n`);
    expect(analyzeStandaloneImage(text, start, end)!.blankLines).toBe(1);
  });
});

describe('computeRenderSize', () => {
  const lineHeight = 20;

  it('fills granted space minus the margin line when no hint is given (tall image)', () => {
    // 400x800 image, 5 granted lines: last line reserved as margin,
    // so 4 renderable lines = 80px. Height capped, width scaled.
    const size = computeRenderSize({ grantedLines: 5 }, { width: 400, height: 800 }, lineHeight, 20);
    expect(size).toEqual({ width: 40, height: 80 });
  });

  it('renders at natural size when it fits the granted space', () => {
    const size = computeRenderSize({ grantedLines: 5 }, { width: 120, height: 80 }, lineHeight, 20);
    expect(size).toEqual({ width: 120, height: 80 });
  });

  it('treats the hint width as a ceiling (shrink-to-fit)', () => {
    // |600 on a 600x400 image with 2 granted lines (1 renderable + 1 margin = 20px):
    // implied height 400 > 20 -> shrink to 20 high, 30 wide
    const size = computeRenderSize(
      { grantedLines: 2, hintWidth: 600 },
      { width: 600, height: 400 },
      lineHeight,
      20,
    );
    expect(size).toEqual({ width: 30, height: 20 });
  });

  it('fills the single granted line when no margin is possible', () => {
    const size = computeRenderSize({ grantedLines: 1 }, { width: 400, height: 800 }, lineHeight, 20);
    expect(size).toEqual({ width: 10, height: 20 });
  });

  it('honours the hint when the granted space allows it', () => {
    const size = computeRenderSize(
      { grantedLines: 20, hintWidth: 300 },
      { width: 600, height: 400 },
      lineHeight,
      20,
    );
    expect(size).toEqual({ width: 300, height: 200 });
  });

  it('uses an explicit width x height hint without aspect scaling', () => {
    const size = computeRenderSize(
      { grantedLines: 20, hintWidth: 300, hintHeight: 100 },
      { width: 600, height: 400 },
      lineHeight,
      20,
    );
    expect(size).toEqual({ width: 300, height: 100 });
  });

  it('caps granted space at maxHeightLines', () => {
    // 51 blank lines (50 renderable after margin) but cap of 10 lines = 200px
    const size = computeRenderSize({ grantedLines: 51 }, { width: 400, height: 800 }, lineHeight, 10);
    expect(size).toEqual({ width: 100, height: 200 });
  });

  it('allows explicit upscale beyond natural size via hint', () => {
    const size = computeRenderSize(
      { grantedLines: 20, hintWidth: 200 },
      { width: 100, height: 50 },
      lineHeight,
      20,
    );
    expect(size).toEqual({ width: 200, height: 100 });
  });
});

describe('mimeTypeForImagePath', () => {
  it('maps supported extensions case-insensitively', () => {
    expect(mimeTypeForImagePath('/a/b/photo.PNG')).toBe('image/png');
    expect(mimeTypeForImagePath('photo.jpeg')).toBe('image/jpeg');
    expect(mimeTypeForImagePath('photo.jpg')).toBe('image/jpeg');
    expect(mimeTypeForImagePath('anim.gif')).toBe('image/gif');
    expect(mimeTypeForImagePath('pic.webp')).toBe('image/webp');
    expect(mimeTypeForImagePath('icon.svg')).toBe('image/svg+xml');
  });

  it('returns undefined for unsupported or missing extensions', () => {
    expect(mimeTypeForImagePath('document.pdf')).toBeUndefined();
    expect(mimeTypeForImagePath('noextension')).toBeUndefined();
  });
});

describe('wrapImageInSvg', () => {
  it('produces an SVG whose intrinsic size is the target size', () => {
    const svg = wrapImageInSvg('QUJD', 'image/png', 300, 150);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150">');
    expect(svg).toContain('<image width="300" height="150" preserveAspectRatio="none" href="data:image/png;base64,QUJD"/>');
  });
});
