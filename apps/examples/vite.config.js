import { defineConfig } from "vite";
import { resolve } from 'path';

export default defineConfig({
    root: resolve(__dirname, "./src"),
    server: {
        host: true,
        strictPort: false,
    }
});
