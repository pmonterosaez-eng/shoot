import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const rootDir = process.cwd();
const extSrcDir = path.join(rootDir, 'extension-src');
const extIconsDir = path.join(extSrcDir, 'icons');
const distExtDir = path.join(rootDir, 'dist-extension');
const outputZipPath = path.join(rootDir, 'public', 'averno93-chrome-brave-extension.zip');

// Standard IEEE 802.3 CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateEmblemPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const nx = (x + 0.5 - half) / half;
      const ny = (y + 0.5 - half) / half;
      const boxDist = Math.max(Math.abs(nx), Math.abs(ny));
      const diamond = Math.abs(nx) * 1.15 + Math.abs(ny) * 0.9;

      let r = 14;
      let g = 10;
      let b = 15;
      const a = 255;

      if (boxDist > 0.86) {
        // Brushed steel/amber outer border
        r = 217;
        g = 119;
        b = 6;
      } else if (boxDist > 0.78) {
        r = 35;
        g = 22;
        b = 26;
      } else if (diamond < 0.28) {
        // Glowing golden core
        r = 255;
        g = 212;
        b = 72;
      } else if (diamond < 0.62) {
        // Hell-crimson sigil diamond
        r = Math.round(235 - diamond * 110);
        g = Math.round(52 - diamond * 30);
        b = 20;
      } else {
        // Radial dark crimson vignette background
        const rad = Math.min(1, Math.hypot(nx, ny));
        r = Math.round(46 * (1 - rad * 0.65));
        g = Math.round(14 * (1 - rad * 0.65));
        b = Math.round(20 * (1 - rad * 0.65));
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function walkFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkFiles(full, base));
    } else {
      const rel = path.relative(base, full).split(path.sep).join('/');
      files.push({ full, rel });
    }
  }
  return files;
}

function createZip(sourceDir, destZip) {
  const files = walkFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const file of files) {
    const data = fs.readFileSync(file.full);
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    const nameBuf = Buffer.from(file.rel, 'utf8');
    const fileCrc = crc32(data);

    // Local File Header (30 bytes + name)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32BE(0x504b0304, 0); // PK\x03\x04 (writeLE below)
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lfh.writeUInt16LE(8, 8); // deflate
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(fileCrc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    localParts.push(lfh, nameBuf, compressed);

    // Central Directory Header (46 bytes + name)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(dosTime, 12);
    cdh.writeUInt16LE(dosDate, 14);
    cdh.writeUInt32LE(fileCrc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);

    centralParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + compressed.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(destZip, Buffer.concat([...localParts, ...centralParts, eocd]));
}

// 1. Ensure crisp PNG icons exist for Manifest V3
fs.mkdirSync(extIconsDir, { recursive: true });
for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(extIconsDir, `icon-${size}.png`), generateEmblemPng(size));
}

// 2. Remove stale zip from public/ temporarily if present so dist-extension doesn't copy it
if (fs.existsSync(outputZipPath)) {
  fs.unlinkSync(outputZipPath);
}

// 3. Build standalone Vite extension bundle
console.log('Compilando extensión Chrome/Brave (Manifest V3)...');
execSync('npx vite build --mode extension', { stdio: 'inherit' });

// 4. Verify MV3 files and zero inline scripts
const indexHtml = fs.readFileSync(path.join(distExtDir, 'index.html'), 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml)) {
  throw new Error('Se detectó un <script> inline en dist-extension/index.html (prohibido en MV3).');
}

// 5. Package ZIP for direct 1-click download from the app
createZip(distExtDir, outputZipPath);
const zipSizeMb = (fs.statSync(outputZipPath).size / (1024 * 1024)).toFixed(2);
console.log(`Extensión lista en dist-extension/ y paquete ZIP en public/averno93-chrome-brave-extension.zip (${zipSizeMb} MB)`);
