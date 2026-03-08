import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from "rollup-plugin-visualizer";

const CLIENT_CONFIG_WINDOW_KEY = "__RIN_CLIENT_CONFIG__";

function escapeInlineScriptJson(value: string) {
  return value
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function inlineClientConfigPlugin(serverTarget: string) {
  return {
    name: "rin-inline-client-config",
    apply: "serve" as const,
    async transformIndexHtml(html: string) {
      try {
        const response = await fetch(`${serverTarget}/api/config/client`);
        if (!response.ok) {
          return html;
        }

        const config = await response.json() as Record<string, unknown>;
        const serialized = escapeInlineScriptJson(JSON.stringify(config));
        const script = `<script>window.${CLIENT_CONFIG_WINDOW_KEY}=${serialized};</script>`;
        return html.includes("</head>")
          ? html.replace("</head>", `${script}</head>`)
          : `${script}${html}`;
      } catch {
        return html;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const serverPort = Number(process.env.RIN_SERVER_PORT || "11499");
  const serverTarget = `http://127.0.0.1:${serverPort}`;
  const cacheDir = process.env.RIN_VITE_CACHE_DIR || "../.vite/client";
  
  return {
    cacheDir,
    // Note: Client configuration is fetched from server at runtime
    // No environment variables are injected at build time
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
    },
    plugins: [
      react(),
      inlineClientConfigPlugin(serverTarget),
      // Only open visualizer in build mode
      visualizer({ open: !isDev })
    ],
    server: {
      proxy: {
        "/api": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/rss.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/atom.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/rss.json": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/feed.json": {
          target: serverTarget,
          changeOrigin: false,
        },
        "/feed.xml": {
          target: serverTarget,
          changeOrigin: false,
        },
      },
    },
    // Vitest configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
