import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 3011,
  },
  ssr: {
    // Don't bundle bun — it's available at runtime when running under Bun
    external: ["bun", "bun:sqlite"],
    noExternal: [],
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.message?.includes("Error when using sourcemap for reporting an error")) return;
        defaultHandler(warning);
      },
    },
  },
});
