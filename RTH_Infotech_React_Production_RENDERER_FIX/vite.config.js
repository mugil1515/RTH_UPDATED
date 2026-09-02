import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    // Production sourcemaps published alongside the bundle were 3.6 MB and
    // exposed the full unminified source to anyone opening devtools. Keep them
    // for local `--sourcemap` runs, not for the shipped build.
    sourcemap: false,
    target: "es2022",
    // The one intentionally large chunk is three.js, and it is now loaded as its
    // own lazy chunk (see AppBackground.jsx), so the default 500 kB warning
    // fires on a split that is already the desired shape.
    chunkSizeWarningLimit: 900,
  },
});
