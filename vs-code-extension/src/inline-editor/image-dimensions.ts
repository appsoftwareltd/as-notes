import * as fs from 'fs';

/**
 * Reads intrinsic pixel dimensions from a local image file by parsing the
 * file header. Supports PNG, JPEG, GIF, WebP, BMP and SVG. Returns undefined
 * for unreadable files or unsupported formats — callers should fall back to
 * not rendering inline.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** JPEG SOF scan reads at most this many bytes (covers large EXIF blocks). */
const JPEG_SCAN_LIMIT = 256 * 1024;
/** SVG attribute scan reads at most this many bytes. */
const SVG_SCAN_LIMIT = 4096;

export function readImageDimensions(filePath: string): ImageDimensions | undefined {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(32);
      const bytesRead = fs.readSync(fd, header, 0, 32, 0);
      if (bytesRead < 12) {
        return undefined;
      }

      // PNG: 8-byte signature, IHDR width/height at offsets 16/20 (big-endian)
      if (header.readUInt32BE(0) === 0x89504e47 && bytesRead >= 24) {
        return validate(header.readUInt32BE(16), header.readUInt32BE(20));
      }

      // GIF: "GIF87a"/"GIF89a", logical screen size at 6/8 (little-endian)
      if (header.toString('ascii', 0, 3) === 'GIF') {
        return validate(header.readUInt16LE(6), header.readUInt16LE(8));
      }

      // BMP: "BM", width/height at 18/22 (little-endian, height may be negative)
      if (header[0] === 0x42 && header[1] === 0x4d && bytesRead >= 26) {
        return validate(header.readInt32LE(18), Math.abs(header.readInt32LE(22)));
      }

      // WebP: RIFF....WEBP
      if (
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP'
      ) {
        return readWebpDimensions(fd);
      }

      // JPEG: 0xFFD8 signature, scan for SOF markers
      if (header[0] === 0xff && header[1] === 0xd8) {
        return readJpegDimensions(fd);
      }

      // SVG: text file starting with optional BOM/xml prolog, contains <svg
      const asText = header.toString('utf8');
      if (asText.includes('<svg') || asText.includes('<?xml') || asText.trimStart().startsWith('<')) {
        return readSvgDimensions(fd);
      }

      return undefined;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

function validate(width: number, height: number): ImageDimensions | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return undefined;
  }
  return { width, height };
}

function readWebpDimensions(fd: number): ImageDimensions | undefined {
  const buf = Buffer.alloc(64);
  const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
  if (bytesRead < 30) {
    return undefined;
  }
  const chunkType = buf.toString('ascii', 12, 16);
  if (chunkType === 'VP8 ') {
    // Lossy: 14-bit width/height at bytes 26-29 (little-endian)
    return validate(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
  }
  if (chunkType === 'VP8L') {
    // Lossless: 14-bit width and height packed after the 1-byte signature at 20
    const bits = buf.readUInt32LE(21);
    return validate((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunkType === 'VP8X') {
    // Extended: 24-bit canvas width/height at 24/27 (little-endian, minus one)
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return validate(width, height);
  }
  return undefined;
}

function readJpegDimensions(fd: number): ImageDimensions | undefined {
  const stat = fs.fstatSync(fd);
  const size = Math.min(stat.size, JPEG_SCAN_LIMIT);
  const buf = Buffer.alloc(size);
  fs.readSync(fd, buf, 0, size, 0);
  let offset = 2;
  while (offset + 9 < size) {
    if (buf[offset] !== 0xff) {
      break;
    }
    const marker = buf[offset + 1];
    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 carry frame dimensions
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return validate(buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5));
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) {
      break;
    }
    offset += 2 + segLen;
  }
  return undefined;
}

function readSvgDimensions(fd: number): ImageDimensions | undefined {
  const buf = Buffer.alloc(SVG_SCAN_LIMIT);
  const bytesRead = fs.readSync(fd, buf, 0, SVG_SCAN_LIMIT, 0);
  const content = buf.toString('utf8', 0, bytesRead);
  const svgTag = /<svg[^>]*>/i.exec(content);
  if (!svgTag) {
    return undefined;
  }
  const tag = svgTag[0];
  const width = parseSvgLength(/\bwidth\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]);
  const height = parseSvgLength(/\bheight\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]);
  if (width !== undefined && height !== undefined) {
    return validate(Math.round(width), Math.round(height));
  }
  const viewBox = /\bviewBox\s*=\s*["']\s*([\d.eE+-]+)[\s,]+([\d.eE+-]+)[\s,]+([\d.eE+-]+)[\s,]+([\d.eE+-]+)\s*["']/i.exec(tag);
  if (viewBox) {
    return validate(Math.round(parseFloat(viewBox[3])), Math.round(parseFloat(viewBox[4])));
  }
  return undefined;
}

/** Parses an SVG length, accepting plain numbers and px units only. */
function parseSvgLength(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = /^\s*([\d.eE+-]+)\s*(px)?\s*$/.exec(value);
  if (!match) {
    return undefined;
  }
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
