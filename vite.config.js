import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["fhevmjs"],
  },
  build: {
    target: "esnext",
    outDir: "dist", // Vercel will serve from here
  },
  server: {
    headers: {
      // Required for fhevmjs WASM + SharedArrayBuffer
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
