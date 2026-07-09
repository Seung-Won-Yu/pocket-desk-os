import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "public", "brand");

const sizes = [192, 512];
const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function roundedRectDistance(x, y, left, top, width, height, radius) {
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const qx = Math.abs(x - centerX) - width / 2 + radius;
  const qy = Math.abs(y - centerY) - height / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function mix(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function blend(over, under) {
  const alpha = over[3] / 255;
  return [
    mix(under[0], over[0], alpha),
    mix(under[1], over[1], alpha),
    mix(under[2], over[2], alpha),
    255,
  ];
}

function tileColor(x, y, size) {
  const t = Math.min(1, Math.max(0, (x * 0.45 + y * 0.55) / size));
  if (t < 0.52) {
    const amount = t / 0.52;
    return [mix(110, 46, amount), mix(215, 143, amount), mix(255, 206, amount), 255];
  }
  const amount = (t - 0.52) / 0.48;
  return [mix(46, 16, amount), mix(143, 42, amount), mix(206, 67, amount), 255];
}

function setPixel(buffer, width, x, y, rgba) {
  const offset = (y * width + x) * 4;
  buffer[offset] = rgba[0];
  buffer[offset + 1] = rgba[1];
  buffer[offset + 2] = rgba[2];
  buffer[offset + 3] = rgba[3];
}

function getPixel(buffer, width, x, y) {
  const offset = (y * width + x) * 4;
  return [buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]];
}

function fillRoundedRect(buffer, width, height, rect, color, opacity = 1) {
  const left = Math.round(rect.x);
  const top = Math.round(rect.y);
  const right = Math.round(rect.x + rect.width);
  const bottom = Math.round(rect.y + rect.height);
  const alphaColor = [color[0], color[1], color[2], Math.round(255 * opacity)];

  for (let y = Math.max(0, top); y < Math.min(height, bottom); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(width, right); x += 1) {
      if (roundedRectDistance(x + 0.5, y + 0.5, rect.x, rect.y, rect.width, rect.height, rect.radius) <= 0) {
        setPixel(buffer, width, x, y, blend(alphaColor, getPixel(buffer, width, x, y)));
      }
    }
  }
}

function createIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 512;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(pixels, size, x, y, [13, 34, 55, 255]);
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = x / scale;
      const sy = y / scale;
      if (roundedRectDistance(sx, sy, 36, 36, 440, 440, 96) <= 0) {
        setPixel(pixels, size, x, y, tileColor(sx, sy, 512));
      }
    }
  }

  fillRoundedRect(pixels, size, size, { x: 126 * scale, y: 136 * scale, width: 260 * scale, height: 176 * scale, radius: 26 * scale }, [11, 37, 54]);
  fillRoundedRect(pixels, size, size, { x: 146 * scale, y: 156 * scale, width: 220 * scale, height: 126 * scale, radius: 18 * scale }, [123, 226, 255]);
  fillRoundedRect(pixels, size, size, { x: 158 * scale, y: 179 * scale, width: 84 * scale, height: 80 * scale, radius: 4 * scale }, [234, 255, 255], 0.3);
  fillRoundedRect(pixels, size, size, { x: 270 * scale, y: 179 * scale, width: 84 * scale, height: 80 * scale, radius: 4 * scale }, [234, 255, 255], 0.3);
  fillRoundedRect(pixels, size, size, { x: 202 * scale, y: 326 * scale, width: 108 * scale, height: 47 * scale, radius: 7 * scale }, [11, 37, 54]);
  fillRoundedRect(pixels, size, size, { x: 166 * scale, y: 369 * scale, width: 180 * scale, height: 30 * scale, radius: 15 * scale }, [247, 200, 115]);

  const rawRows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    rawRows[rowOffset] = 0;
    pixels.copy(rawRows, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rawRows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDir, { recursive: true });

for (const size of sizes) {
  writeFileSync(join(outputDir, `pocketdesk-icon-${size}.png`), createIcon(size));
}
