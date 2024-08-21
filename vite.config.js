import { defineConfig } from "vite";
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            "src": resolve(__dirname, "./src"),
            "@": resolve(__dirname, "../"),
            "@server": resolve(__dirname, "../server/src"),
        },
    },
});
