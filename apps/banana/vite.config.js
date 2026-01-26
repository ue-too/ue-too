import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, join } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        tailwindcss(), 
        react()
    ],
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
                react: resolve(__dirname, "src/react.html"),
            },
        },
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.webp'],
    server: {
        host: true,
        strictPort: false,
    },
});
