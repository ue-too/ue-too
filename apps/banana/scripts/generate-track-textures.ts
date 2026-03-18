/**
 * Generates track strip textures (ballasted & slab) matching the procedural
 * drawing logic in render-system.ts and saves them as PNG files.
 *
 * Uses a raw pixel buffer + minimal PNG encoder (no native canvas dependency).
 *
 * Usage:  bun run apps/banana/scripts/generate-track-textures.ts
 */

import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// =====================================================================
// Minimal software rasteriser
// =====================================================================

class SoftCanvas {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;

    constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
    }

    private _blend(idx: number, r: number, g: number, b: number, a: number) {
        const dst = this.data;
        if (a >= 255) {
            dst[idx] = r; dst[idx + 1] = g; dst[idx + 2] = b; dst[idx + 3] = 255;
            return;
        }
        const srcA = a / 255;
        const invA = 1 - srcA;
        dst[idx] = Math.round(r * srcA + dst[idx] * invA);
        dst[idx + 1] = Math.round(g * srcA + dst[idx + 1] * invA);
        dst[idx + 2] = Math.round(b * srcA + dst[idx + 2] * invA);
        dst[idx + 3] = Math.min(255, Math.round(a + dst[idx + 3] * invA));
    }

    setPixel(x: number, y: number, r: number, g: number, b: number, a: number = 255) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
        this._blend((iy * this.width + ix) * 4, r, g, b, a);
    }

    fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number = 255) {
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(this.width, Math.round(x + w));
        const y1 = Math.min(this.height, Math.round(y + h));
        for (let py = y0; py < y1; py++) {
            const rowOff = py * this.width;
            for (let px = x0; px < x1; px++) {
                this._blend((rowOff + px) * 4, r, g, b, a);
            }
        }
    }

    fillEllipse(cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a: number = 255) {
        const x0 = Math.max(0, Math.floor(cx - rx));
        const y0 = Math.max(0, Math.floor(cy - ry));
        const x1 = Math.min(this.width - 1, Math.ceil(cx + rx));
        const y1 = Math.min(this.height - 1, Math.ceil(cy + ry));
        const rxSq = rx * rx;
        const rySq = ry * ry;
        for (let py = y0; py <= y1; py++) {
            const dy = py - cy;
            const dySq = dy * dy;
            const rowOff = py * this.width;
            for (let px = x0; px <= x1; px++) {
                const dx = px - cx;
                if (dx * dx * rySq + dySq * rxSq <= rxSq * rySq) {
                    this._blend((rowOff + px) * 4, r, g, b, a);
                }
            }
        }
    }

    drawLine(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number = 255) {
        let ix0 = Math.round(x0), iy0 = Math.round(y0);
        const ix1 = Math.round(x1), iy1 = Math.round(y1);
        const dx = Math.abs(ix1 - ix0);
        const dy = -Math.abs(iy1 - iy0);
        const sx = ix0 < ix1 ? 1 : -1;
        const sy = iy0 < iy1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.setPixel(ix0, iy0, r, g, b, a);
            if (ix0 === ix1 && iy0 === iy1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; ix0 += sx; }
            if (e2 <= dx) { err += dx; iy0 += sy; }
        }
    }

    strokeRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number = 255) {
        const x0 = Math.round(x), y0 = Math.round(y);
        const x1 = Math.round(x + w), y1 = Math.round(y + h);
        this.drawLine(x0, y0, x1, y0, r, g, b, a);
        this.drawLine(x1, y0, x1, y1, r, g, b, a);
        this.drawLine(x1, y1, x0, y1, r, g, b, a);
        this.drawLine(x0, y1, x0, y0, r, g, b, a);
    }

    toPNG(): Buffer {
        return encodePNG(this.width, this.height, this.data);
    }
}

// =====================================================================
// Minimal PNG encoder
// =====================================================================
function encodePNG(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
    const rowLen = 1 + w * 4;
    const raw = Buffer.alloc(h * rowLen);
    for (let y = 0; y < h; y++) {
        const rowOff = y * rowLen;
        raw[rowOff] = 0;
        for (let x = 0; x < w; x++) {
            const src = (y * w + x) * 4;
            const dst = rowOff + 1 + x * 4;
            raw[dst] = rgba[src];
            raw[dst + 1] = rgba[src + 1];
            raw[dst + 2] = rgba[src + 2];
            raw[dst + 3] = rgba[src + 3];
        }
    }
    const compressed = deflateSync(raw);
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    function writeChunk(type: string, data: Buffer) {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const typeB = Buffer.from(type, 'ascii');
        const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])) >>> 0);
        chunks.push(len, typeB, data, crcB);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    writeChunk('IHDR', ihdr);
    writeChunk('IDAT', compressed);
    writeChunk('IEND', Buffer.alloc(0));
    return Buffer.concat(chunks);
}

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
}
function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

// =====================================================================
// Seeded RNG (identical to render-system.ts)
// =====================================================================
function seededRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hexRgb(hex: number): [number, number, number] {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

// =====================================================================
// Constants
// =====================================================================
const TRACK_TEX_SIZE = 64;

// =====================================================================
// Draw bed directly on the strip canvas (no 256×256 intermediate tile)
// =====================================================================

/** Draw ballast gravel directly on the canvas area. */
function drawBallastBed(c: SoftCanvas) {
    const [br, bg, bb] = hexRgb(0x706860);
    c.fillRect(0, 0, c.width, c.height, br, bg, bb);

    const rng = seededRng(73);
    const rockColors = [0x585048, 0x4a4238, 0x665e54, 0x3e3830, 0x7a726a];
    const highlightColors = [0x9a9288, 0xa8a098, 0x8e8680];

    // Scale rock count to canvas area (original: 300 per 256×256 = 65536 px²)
    const area = c.width * c.height;
    const count = Math.round(300 * area / 65536);

    for (let r = 0; r < count; r++) {
        const rw = 3 + rng() * 6;
        const rh = 3 + rng() * 5;
        const pad = Math.max(rw, rh) + 1;
        const rx = pad + rng() * (c.width - pad * 2);
        const ry = pad + rng() * (c.height - pad * 2);
        const col = rockColors[Math.floor(rng() * rockColors.length)];
        const [cr, cg, cb] = hexRgb(col);

        const [or_, og, ob] = hexRgb(0x3a3020);
        c.fillEllipse(rx, ry, rw + 1, rh + 1, or_, og, ob, 102);
        c.fillEllipse(rx, ry, rw, rh, cr, cg, cb);
        if (rng() > 0.3) {
            const hc = highlightColors[Math.floor(rng() * highlightColors.length)];
            const [hr, hg, hb] = hexRgb(hc);
            c.fillEllipse(rx - rw * 0.2, ry - rh * 0.25, rw * 0.5, rh * 0.4, hr, hg, hb, 128);
        }
    }
}

/** Draw slab concrete directly on the canvas area. */
function drawSlabBed(c: SoftCanvas) {
    const [br, bg, bb] = hexRgb(0xc0bab0);
    c.fillRect(0, 0, c.width, c.height, br, bg, bb);

    const rng = seededRng(91);
    const speckleColors = [0xb5afa5, 0xccc6bc, 0xada79d, 0xd1cbc3];
    const area = c.width * c.height;
    const count = Math.round(200 * area / 65536);
    for (let s = 0; s < count; s++) {
        const sx = 2 + rng() * (c.width - 4);
        const sy = 2 + rng() * (c.height - 4);
        const sw = 1 + rng() * 3;
        const sh = 1 + rng() * 2;
        const col = speckleColors[Math.floor(rng() * speckleColors.length)];
        const [sr, sg, sb] = hexRgb(col);
        c.fillEllipse(sx, sy, sw, sh, sr, sg, sb, 102);
    }
    const [lr, lg, lb] = hexRgb(0x8a847a);
    for (let i = 0; i < 3; i++) {
        const cx = 10 + rng() * (c.width - 20);
        const cy = rng() * c.height;
        const ex = cx + (rng() - 0.5) * 30;
        const ey = cy + 20 + rng() * 40;
        c.drawLine(cx, cy, ex, ey, lr, lg, lb, 77);
    }
}

// =====================================================================
// Rail overlays
// =====================================================================

function drawRails(c: SoftCanvas, ox: number, oy: number, railL: number, railR: number, railW: number) {
    const [rr, rg, rb] = hexRgb(0x6b3a1f);
    const [er, eg, eb] = hexRgb(0x4a2810);
    const [sr, sg, sb] = hexRgb(0xd0d0d0);
    for (const rx of [railL, railR]) {
        c.fillRect(ox + rx - railW / 2, oy, railW, TRACK_TEX_SIZE, rr, rg, rb);
        c.fillRect(ox + rx - railW / 2, oy, 1, TRACK_TEX_SIZE, er, eg, eb, 153);
        c.fillRect(ox + rx + railW / 2 - 1, oy, 1, TRACK_TEX_SIZE, er, eg, eb, 153);
        c.fillRect(ox + rx - 0.5, oy, 1, TRACK_TEX_SIZE, sr, sg, sb, 204);
    }
}

function drawBallastRailTile(c: SoftCanvas, ox: number, oy: number) {
    const rng = seededRng(42);
    const tieOverhang = 4;
    const tieY = oy + TRACK_TEX_SIZE * 0.5 - 6;

    const [tr, tg, tb] = hexRgb(0xa8a8a0);
    c.fillRect(ox - tieOverhang, tieY, TRACK_TEX_SIZE + tieOverhang * 2, 12, tr, tg, tb);

    const [tlr, tlg, tlb] = hexRgb(0x8a8a82);
    for (let i = 0; i < 5; i++) {
        const gy = tieY + 2 + rng() * 8;
        const endY = gy + rng() * 2 - 1;
        c.drawLine(ox - tieOverhang, gy, ox + TRACK_TEX_SIZE + tieOverhang, endY, tlr, tlg, tlb, 102);
    }

    const railW = 5;
    drawRails(c, ox, oy, railW / 2, TRACK_TEX_SIZE - railW / 2, railW);
}

function drawSlabRailTile(c: SoftCanvas, ox: number, oy: number) {
    const railW = 5;
    const railL = railW / 2;
    const railR = TRACK_TEX_SIZE - railW / 2;
    const tieBlockW = 14, tieBlockH = 8;
    const tieY = oy + TRACK_TEX_SIZE * 0.5 - tieBlockH / 2;

    const [tbr, tbg, tbb] = hexRgb(0xa09a90);
    const [tsr, tsg, tsb] = hexRgb(0x888278);

    c.fillRect(ox + railL - tieBlockW / 2, tieY, tieBlockW, tieBlockH, tbr, tbg, tbb);
    c.strokeRect(ox + railL - tieBlockW / 2, tieY, tieBlockW, tieBlockH, tsr, tsg, tsb);
    c.fillRect(ox + railR - tieBlockW / 2, tieY, tieBlockW, tieBlockH, tbr, tbg, tbb);
    c.strokeRect(ox + railR - tieBlockW / 2, tieY, tieBlockW, tieBlockH, tsr, tsg, tsb);

    drawRails(c, ox, oy, railL, railR, railW);
}

// =====================================================================
// Generate strip
// =====================================================================
function generateStrip(type: 'ballasted' | 'slab', outPath: string) {
    const tileH = TRACK_TEX_SIZE;
    const repeats = 8;
    const stripH = tileH * repeats;

    const tieOverhang = type === 'ballasted' ? 4 : 0;
    const margin = type === 'ballasted' ? tieOverhang + 8 : 16;
    const stripW = TRACK_TEX_SIZE + margin * 2;

    const canvas = new SoftCanvas(stripW, stripH);

    // 1. Bed background (drawn directly at canvas dimensions)
    if (type === 'ballasted') {
        drawBallastBed(canvas);
    } else {
        drawSlabBed(canvas);
    }

    // 2. Rail tiles
    for (let r = 0; r < repeats; r++) {
        if (type === 'ballasted') {
            drawBallastRailTile(canvas, margin, r * tileH);
        } else {
            drawSlabRailTile(canvas, margin, r * tileH);
        }
    }

    const png = canvas.toPNG();
    writeFileSync(outPath, png);
    console.log(`Saved ${outPath} (${stripW}×${stripH})`);
}

// =====================================================================
// Main
// =====================================================================
const outDir = resolve(import.meta.dir, '../src/assets/textures');

generateStrip('ballasted', resolve(outDir, 'track-ballasted.png'));
generateStrip('slab', resolve(outDir, 'track-slab.png'));

console.log('Done.');
