import { defineConfig } from "vite";
import { resolve } from 'path';

export default defineConfig({
    root: resolve(__dirname, "./apps/examples"),
    resolve: {
        alias: {
            "src": resolve(__dirname, "./packages/core/src"),
            "@": resolve(__dirname, "../"),
            "@server": resolve(__dirname, "../server/src"),
            "@examples": resolve(__dirname, "./apps/examples"),
        },
    },
    server: {
        host: true,
        strictPort: false,
    }
});
