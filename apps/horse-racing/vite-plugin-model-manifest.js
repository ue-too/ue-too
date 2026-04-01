import { readdirSync, writeFileSync, watch } from 'fs';
import { join, resolve } from 'path';

function filenameToLabel(filename) {
    return filename
        .replace(/\.onnx$/, '')
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function generateManifest(modelsDir) {
    const files = readdirSync(modelsDir).filter((f) => f.endsWith('.onnx')).sort();
    const manifest = files.map((f) => ({
        label: filenameToLabel(f),
        url: `/models/${f}`,
    }));
    writeFileSync(join(modelsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
}

export default function modelManifestPlugin() {
    let modelsDir;

    return {
        name: 'model-manifest',
        configResolved(config) {
            modelsDir = resolve(config.publicDir, 'models');
            generateManifest(modelsDir);
        },
        configureServer() {
            // Watch for .onnx file changes in dev mode
            const watcher = watch(modelsDir, (_, filename) => {
                if (filename && filename.endsWith('.onnx')) {
                    generateManifest(modelsDir);
                }
            });
            return () => {
                watcher.close();
            };
        },
    };
}
