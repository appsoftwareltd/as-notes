import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readImageDimensions } from '../inline-editor/image-dimensions';

let tmpDir: string;

function write(name: string, data: Buffer | string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, data);
  return filePath;
}

/** 1x1 transparent PNG. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function makeGif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function makeJpeg(width: number, height: number): Buffer {
  // SOI + APP0 (minimal JFIF) + SOF0 + EOI
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2); // segment length
  sof0[4] = 8; // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 1; // one component
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])]);
}

function makeBmp(width: number, height: number): Buffer {
  const buf = Buffer.alloc(26);
  buf[0] = 0x42;
  buf[1] = 0x4d;
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  return buf;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asnotes-imgdim-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readImageDimensions', () => {
  it('reads PNG dimensions', () => {
    expect(readImageDimensions(write('a.png', PNG_1X1))).toEqual({ width: 1, height: 1 });
  });

  it('reads GIF dimensions', () => {
    expect(readImageDimensions(write('a.gif', makeGif(320, 240)))).toEqual({ width: 320, height: 240 });
  });

  it('reads JPEG dimensions from the SOF marker', () => {
    expect(readImageDimensions(write('a.jpg', makeJpeg(640, 480)))).toEqual({ width: 640, height: 480 });
  });

  it('reads BMP dimensions, including negative (top-down) height', () => {
    expect(readImageDimensions(write('a.bmp', makeBmp(100, 50)))).toEqual({ width: 100, height: 50 });
    expect(readImageDimensions(write('b.bmp', makeBmp(100, -50)))).toEqual({ width: 100, height: 50 });
  });

  it('reads SVG width/height attributes', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>';
    expect(readImageDimensions(write('a.svg', svg))).toEqual({ width: 200, height: 100 });
  });

  it('falls back to the SVG viewBox', () => {
    const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
    expect(readImageDimensions(write('b.svg', svg))).toEqual({ width: 300, height: 150 });
  });

  it('ignores SVG percentage lengths and uses the viewBox', () => {
    const svg = '<svg width="100%" height="100%" viewBox="0 0 64 32"></svg>';
    expect(readImageDimensions(write('c.svg', svg))).toEqual({ width: 64, height: 32 });
  });

  it('returns undefined for missing files', () => {
    expect(readImageDimensions(path.join(tmpDir, 'missing.png'))).toBeUndefined();
  });

  it('returns undefined for unrecognized content', () => {
    expect(readImageDimensions(write('a.bin', Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])))).toBeUndefined();
  });
});
