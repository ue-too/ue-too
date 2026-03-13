/**
 * Pre-renders PMTiles vector tiles to raster PNGs for fast static serving.
 *
 * Usage:
 *   bun run scripts/rasterize-tiles.ts
 *
 * Reads:  public/tiles/taipei.pmtiles
 * Writes: public/tiles/{z}/{x}/{y}.png
 */
import { createCanvas } from '@napi-rs/canvas';
import { Static, paintRules, labelRules } from 'protomaps-leaflet';
import { LIGHT } from '@protomaps/basemaps';
import { PMTiles } from 'pmtiles';
import { open, mkdir, stat } from 'fs/promises';
import { writeFileSync } from 'fs';
import { resolve, join } from 'path';

const TILE_SIZE = 256;
/** Render 2 extra zoom levels beyond the vector data's max (overzoomed). */
const EXTRA_ZOOM = 2;
const INPUT = resolve(import.meta.dir, '../public/tiles/taipei.pmtiles');
const OUTPUT_DIR = resolve(import.meta.dir, '../public/tiles');

/** File-based source for PMTiles (no HTTP server needed). */
class FileSource {
    path: string;
    constructor(path: string) {
        this.path = path;
    }
    async getBytes(offset: number, length: number) {
        const fh = await open(this.path, 'r');
        const buf = Buffer.alloc(length);
        await fh.read(buf, 0, length, offset);
        await fh.close();
        return {
            data: buf.buffer.slice(
                buf.byteOffset,
                buf.byteOffset + buf.byteLength,
            ),
        };
    }
    getKey() {
        return this.path;
    }
}

/** Convert longitude to tile X at zoom z. */
function lng2tile(lng: number, z: number): number {
    return Math.floor(((lng + 180) / 360) * (1 << z));
}

/** Convert latitude to tile Y at zoom z. */
function lat2tile(lat: number, z: number): number {
    const latRad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
            2) *
        (1 << z),
    );
}

/** Convert tile X to longitude (west edge). */
function tile2lng(x: number, z: number): number {
    return (x / (1 << z)) * 360 - 180;
}

/** Convert tile Y to latitude (north edge). */
function tile2lat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / (1 << z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function main() {
    // Verify input exists
    await stat(INPUT);

    const pm = new PMTiles(new FileSource(INPUT) as never);
    const header = await pm.getHeader();
    const minZoom = header.minZoom;
    const maxDataZoom = header.maxZoom;
    const maxRenderZoom = maxDataZoom + EXTRA_ZOOM;
    const bbox = {
        minLon: header.minLon,
        minLat: header.minLat,
        maxLon: header.maxLon,
        maxLat: header.maxLat,
    };

    console.log(
        `Input: ${INPUT}\nData zoom: ${minZoom}–${maxDataZoom}, render zoom: ${minZoom}–${maxRenderZoom}\nBbox: ${bbox.minLon},${bbox.minLat} → ${bbox.maxLon},${bbox.maxLat}`,
    );

    const renderer = new Static({
        url: pm as never,
        maxDataZoom: maxDataZoom,
        paintRules: paintRules(LIGHT),
        labelRules: labelRules(LIGHT, 'en'),
        backgroundColor: LIGHT.background,
    });

    let totalTiles = 0;
    for (let z = minZoom; z <= maxRenderZoom; z++) {
        const xMin = lng2tile(bbox.minLon, z);
        const xMax = lng2tile(bbox.maxLon, z);
        const yMin = lat2tile(bbox.maxLat, z); // note: lat/y are inverted
        const yMax = lat2tile(bbox.minLat, z);
        totalTiles += (xMax - xMin + 1) * (yMax - yMin + 1);
    }
    console.log(`Total tiles to render: ${totalTiles}`);

    let rendered = 0;
    const startTime = Date.now();

    for (let z = minZoom; z <= maxRenderZoom; z++) {
        const xMin = lng2tile(bbox.minLon, z);
        const xMax = lng2tile(bbox.maxLon, z);
        const yMin = lat2tile(bbox.maxLat, z);
        const yMax = lat2tile(bbox.minLat, z);

        const zoomTiles = (xMax - xMin + 1) * (yMax - yMin + 1);
        console.log(
            `z${z}: ${zoomTiles} tiles (x: ${xMin}–${xMax}, y: ${yMin}–${yMax})`,
        );

        for (let x = xMin; x <= xMax; x++) {
            const dir = join(OUTPUT_DIR, `${z}`, `${x}`);
            await mkdir(dir, { recursive: true });

            for (let y = yMin; y <= yMax; y++) {
                // Tile center in lng/lat
                const centerLng =
                    (tile2lng(x, z) + tile2lng(x + 1, z)) / 2;
                const centerLat =
                    (tile2lat(y, z) + tile2lat(y + 1, z)) / 2;

                const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
                const ctx = canvas.getContext('2d');
                await renderer.drawContext(
                    ctx as unknown as CanvasRenderingContext2D,
                    TILE_SIZE,
                    TILE_SIZE,
                    { x: centerLng, y: centerLat },
                    z,
                );

                const outPath = join(dir, `${y}.png`);
                writeFileSync(outPath, canvas.toBuffer('image/png'));
                rendered++;
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
            `  z${z} done (${rendered}/${totalTiles}, ${elapsed}s elapsed)`,
        );
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nDone: ${rendered} tiles in ${totalElapsed}s`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
