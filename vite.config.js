import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["fhevmjs"],
  },
  build: {
    target: "esnext",
  },
});
