import { defineConfig } from "vite";
import { resolve } from 'path';

export default defineConfig({
    root: resolve(__dirname, "./docs-staging"),
    server: {
        host: true,
        strictPort: false,
    }
});
