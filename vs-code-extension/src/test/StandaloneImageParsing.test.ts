import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    }),
  },
}));

import { MarkdownParser } from '../inline-editor/parser';

let parser: MarkdownParser;

beforeAll(async () => {
  parser = await MarkdownParser.create();
});

describe('standalone image parsing', () => {
  it('emits a StandaloneImage for an image alone on its line with a blank line below', () => {
    const text = 'before\n\n![photo](img.png)\n\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(1);
    const image = result.standaloneImages[0];
    expect(image.url).toBe('img.png');
    expect(image.grantedLines).toBe(1);
    expect(text.slice(image.startPos, image.endPos)).toBe('![photo](img.png)');
    expect(image.hintWidth).toBeUndefined();
  });

  it('parses the size hint into the StandaloneImage', () => {
    const text = '![photo|300x200](img.png)\n\n\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(1);
    const image = result.standaloneImages[0];
    expect(image.hintWidth).toBe(300);
    expect(image.hintHeight).toBe(200);
    expect(image.grantedLines).toBe(2);
  });

  it('emits a hide decoration covering the pipe suffix', () => {
    const text = '![photo|300](img.png)\n\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    const pipeStart = text.indexOf('|300');
    const hide = result.decorations.find(
      (d) => d.type === 'hide' && d.startPos === pipeStart && d.endPos === pipeStart + 4,
    );
    expect(hide).toBeDefined();
  });

  it('hides the pipe suffix on mid-sentence images too', () => {
    const text = 'text ![icon|24](icon.png) more\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(0);
    const pipeStart = text.indexOf('|24');
    const hide = result.decorations.find(
      (d) => d.type === 'hide' && d.startPos === pipeStart && d.endPos === pipeStart + 3,
    );
    expect(hide).toBeDefined();
  });

  it('does not emit a StandaloneImage without a trailing blank line', () => {
    const text = '![photo](img.png)\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(0);
  });

  it('does not emit a StandaloneImage for images inside code blocks', () => {
    const text = '```\n![photo](img.png)\n\n```\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(0);
  });

  it('keeps the normal image alt decoration alongside the StandaloneImage', () => {
    const text = '![photo](img.png)\n\nafter\n';
    const result = parser.extractDecorationsWithScopes(text);
    const altDecoration = result.decorations.find((d) => d.type === 'image');
    expect(altDecoration).toBeDefined();
    expect(altDecoration!.url).toBe('img.png');
  });

  it('handles CRLF documents using normalized offsets', () => {
    const text = 'before\r\n\r\n![photo](img.png)\r\n\r\nafter\r\n';
    const result = parser.extractDecorationsWithScopes(text);
    expect(result.standaloneImages).toHaveLength(1);
    expect(result.standaloneImages[0].grantedLines).toBe(1);
  });
});
