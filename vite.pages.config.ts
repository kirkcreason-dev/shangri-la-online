import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const project = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root: project + "github-pages",
  base: "/shangri-la-online/",
  publicDir: project + "public",
  plugins: [react()],
  resolve: {alias: {"@": project}},
  define: {
    __GAME_API_URL__: JSON.stringify("https://shangri-la-table.y9sph6ffvj.chatgpt.site"),
    __GAME_BASE_PATH__: JSON.stringify("/shangri-la-online/"),
  },
  build: {outDir: project + "dist-pages", emptyOutDir: true},
});
