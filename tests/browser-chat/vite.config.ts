import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)), "next/link": fileURLToPath(new URL("./link.tsx", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});
