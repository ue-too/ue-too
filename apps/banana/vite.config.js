import { createReadStream, statSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { join, resolve } from 'path';
import { defineConfig } from 'vite';

/**
 * Vite plugin that serves .pmtiles files with HTTP Range request support.
 * PMTiles relies on Range requests to read tile data without downloading the
 * entire archive. Vite's built-in static file server does not handle Range
 * requests correctly for binary archives, so this middleware intercepts
 * requests for .pmtiles files and streams the correct byte ranges.
 */
function pmtilesRangeServer() {
    const publicDir = resolve(__dirname, 'public');
    return {
        name: 'pmtiles-range-server',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Strip query string before matching extension
                const pathname = new URL(req.url, 'http://localhost').pathname;
                if (!pathname.endsWith('.pmtiles')) return next();

                const filePath = join(publicDir, pathname);
                let stat;
                try {
                    stat = statSync(filePath);
                } catch {
                    return next();
                }

                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Content-Type', 'application/octet-stream');

                const range = req.headers.range;
                if (!range) {
                    res.setHeader('Content-Length', stat.size);
                    createReadStream(filePath).pipe(res);
                    return;
                }

                const [startStr, endStr] = range
                    .replace('bytes=', '')
                    .split('-');
                const start = Number.parseInt(startStr, 10);
                const end = endStr
                    ? Number.parseInt(endStr, 10)
                    : stat.size - 1;

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Content-Length': end - start + 1,
                    'Content-Type': 'application/octet-stream',
                });
                createReadStream(filePath, { start, end }).pipe(res);
            });
        },
    };
}

export default defineConfig({
    plugins: [pmtilesRangeServer(), tailwindcss(), react()],
    root: resolve(__dirname, './src'),
    publicDir: resolve(__dirname, 'public'),
    build: {
        outDir: resolve(join(__dirname, '../../'), 'dist'),
        emptyOutDir: true,
        sourcemap: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    assetsInclude: [
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif',
        '**/*.svg',
        '**/*.webp',
    ],
    server: {
        strictPort: false,
    },
});
