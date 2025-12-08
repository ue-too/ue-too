import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, join } from 'path';

export default defineConfig({
    plugins: [react()],
    root: resolve(__dirname, "./src"),
    publicDir: resolve(__dirname, "public"),
    build: {
        outDir: resolve(join(__dirname, "../../"), "dist"),
        emptyOutDir: true,
        sourcemap: true,
        assetsDir: "assets",
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/index.html"),
            },
        },
    },
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.webp'],
    server: {
        host: true,
        strictPort: false,
    },
});

