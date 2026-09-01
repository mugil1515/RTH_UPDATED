import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { sourcemap: true, target: "es2022" },
});
