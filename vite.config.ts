import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/_supabase": {
        target: "http://127.0.0.1:55431",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/_supabase/, ""),
      },
    },
  },
});
