# Map Tile Data

The banana app overlays a board canvas on top of a map tile layer. Tiles are vector data in the [PMTiles](https://protomaps.com/docs/pmtiles) format, rendered client-side via MapLibre GL (WebGL).

## Architecture

```
┌──────────────────────────────────────┐
│  Cloudflare R2 (or any static host)  │
│  taipei.pmtiles  (34 MB)             │
└──────────────┬───────────────────────┘
               │ HTTP Range requests
               ▼
┌──────────────────────────────────────┐
│  Browser                             │
│  pmtiles Protocol ─► MapLibre GL     │
│  @protomaps/basemaps (LIGHT theme)   │
└──────────────────────────────────────┘
```

- **PMTiles** — single-file archive of vector tiles; supports random access via HTTP Range requests, so no tile server is needed.
- **MapLibre GL** — renders vector tiles on the GPU via WebGL.
- **@protomaps/basemaps** — provides the visual style (colors, labels, fonts).
- **Protomaps planet builds** — pre-built OpenStreetMap vector tiles covering the entire world, published at `build.protomaps.com`.

## Prerequisites

Install the `pmtiles` CLI:

```bash
brew install pmtiles
```

## Extracting tile data

Use `pmtiles extract` to cut a regional subset from a Protomaps planet build. The bbox format is `west,south,east,north` (longitude, latitude).

```bash
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  <output-file>.pmtiles \
  --bbox=<west>,<south>,<east>,<north>
```

### Examples

```bash
# Taipei metro area (~34 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  taipei.pmtiles --bbox=121.4,24.9,121.7,25.2

# All of Taiwan (~200 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  taiwan.pmtiles --bbox=119.3,21.8,122.1,25.4

# Tokyo (~50 MB)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  tokyo.pmtiles --bbox=139.5,35.5,139.9,35.85

# San Francisco Bay Area
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  sf.pmtiles --bbox=-122.6,37.6,-122.2,37.85

# London
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  london.pmtiles --bbox=-0.5,51.3,0.3,51.7
```

To find the bbox for any area, draw a rectangle on [bboxfinder.com](http://bboxfinder.com) and copy the coordinates.

### Finding available planet builds

Planet builds are published at `build.protomaps.com/<date>.pmtiles`. Not every date has a build. If a date returns a 404, try nearby dates:

```bash
# Test if a build exists (dry run)
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  /dev/null --bbox=121.5,25.0,121.51,25.01 --dry-run
```

## Hosting

The `.pmtiles` file must be hosted on a server that supports **HTTP Range requests**. Any static file host works.

### Cloudflare R2 (recommended)

R2 has free egress (no cost for downloads).

1. Create an R2 bucket in the Cloudflare dashboard
2. Enable public access (Settings → Public access)
3. Configure CORS (Settings → CORS policy):
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Length", "Content-Range"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
4. Upload the file:
   ```bash
   npx wrangler r2 object put <bucket-name>/tiles/taipei.pmtiles \
     --file taipei.pmtiles
   ```

### Other options

| Service | Range requests | Egress cost |
|---------|---------------|-------------|
| Cloudflare R2 | Yes | Free |
| AWS S3 | Yes | ~$0.09/GB |
| Vercel Blob | Yes | Included in plan |
| GitHub Releases | Yes | Free (up to 2GB/file) |

## Configuration

The app reads the PMTiles URL from the `VITE_PMTILES_URL` environment variable. If not set, it defaults to the R2-hosted Taipei extract.

```bash
# Override the tile source
VITE_PMTILES_URL=https://your-bucket.example.com/tiles/tokyo.pmtiles bun run dev
```

## Local development

For offline development, place the `.pmtiles` file in `public/tiles/` and point to it locally:

```bash
# Extract tiles
pmtiles extract https://build.protomaps.com/20250310.pmtiles \
  apps/banana/public/tiles/taipei.pmtiles \
  --bbox=121.4,24.9,121.7,25.2

# Use local file
VITE_PMTILES_URL=http://localhost:5173/tiles/taipei.pmtiles bun run dev
```

The `public/tiles/` directory and `*.pmtiles` files are gitignored.

## Rasterize script (optional)

A build script is available to pre-render vector tiles into raster PNGs. This is only needed if you want to serve tiles as static images (e.g. for the Leaflet raster fallback).

```bash
cd apps/banana
bun run scripts/rasterize-tiles.ts
```

This reads `public/tiles/taipei.pmtiles` and writes PNG files to `public/tiles/{z}/{x}/{y}.png`. Requires `@napi-rs/canvas` and `protomaps-leaflet` (both devDependencies).

## Changing the map origin

The map is centered on Taipei 101 (25.0330°N, 121.5654°E). To change the origin, update the constants in `src/components/map-tile-layer.tsx`:

```ts
const ORIGIN_LNG = 121.5654;  // longitude
const ORIGIN_LAT = 25.0330;   // latitude
```

Then extract a PMTiles file covering the new area and update the hosted file.
