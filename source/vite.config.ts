import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { fixReactDoodleSvgProps } from './scripts/vite/fixReactDoodleSvgProps';
import { prodIndexHtmlPlugin } from './scripts/vite/prodIndexHtmlPlugin';
import { readViteDevSettings } from './src/server/config/settingsFile';
import { resolvePreferredHmrPort } from './src/server/utils/devHmr';

export default defineConfig(() => {
  const { enableHmr, serverPort, hmrPort } = readViteDevSettings();
  const resolvedHmrPort = resolvePreferredHmrPort(serverPort, hmrPort);
  const expressDevTarget = process.env.APPEND_O_VITE_CHILD === '1'
    ? `http://127.0.0.1:${Number(process.env.APPEND_O_DEV_CLIENT_PORT) || serverPort}`
    : null;

  return {
    plugins: [
      fixReactDoodleSvgProps(),
      prodIndexHtmlPlugin(),
      react(),
      tailwindcss(),
      // `ANALYZE=1 npm run build` emits dist/stats.html — a real chunk-graph treemap (source,
      // gzip/brotli size, which chunk pulls in what) instead of guessing from grep. Off by
      // default so normal builds don't pay the analysis cost or ship the report.
      ...(process.env.ANALYZE ? [visualizer({
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      })] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'pwa-source.svg',
          'apple-touch-icon-180x180.png',
          'fonts/dancing-script-latin-700-normal.woff2',
        ],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
          // Dev serves assets from Vite memory, not dev-dist — suppress harmless workbox glob warnings.
          suppressWarnings: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      // Chart host registers renderers via `echarts/core` `use()`. Duplicated copies
      // leave init() without CanvasRenderer and the plot box stays blank.
      dedupe: ['echarts', 'react', 'react-dom'],
    },
    optimizeDeps: {
      // Never let Vite pull the local embeddings stack into dep optimization — it can
      // pin multi‑GB RAM inside the same Node process that serves the SPA and freeze /api/boot.
      exclude: [
        '@huggingface/transformers',
        'onnxruntime-node',
        'onnxruntime-web',
      ],
      include: [
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/features',
        'echarts/renderers',
        '@fortune-sheet/react',
      ],
      // This app pre-bundles ~380 client dependencies (monaco-editor, mermaid, xyflow, tiptap,
      // heroui, multiple icon packs...). Any vite.config.ts/lockfile change invalidates
      // node_modules/.vite/deps and forces a full cold re-optimization on the next dev start,
      // which can take minutes — during which every request silently hangs with zero server log
      // output, looking exactly like a broken/hung server. These hooks make that wait visible.
      esbuildOptions: {
        plugins: [{
          name: 'appendo-optimize-deps-progress-log',
          setup(build) {
            build.onStart(() => {
              console.log('[AppEndO] Vite is (re)optimizing dependencies — first load may take a few minutes on a cold cache…');
            });
            build.onEnd(() => {
              console.log('[AppEndO] Vite dependency optimization finished.');
            });
          },
        }],
      },
    },
    server: {
      // Vite child (:port+200) is for HMR/modules only. Browsers that land on it still
      // call same-origin `/api/*`; proxy those to Express on the public dev port.
      ...(expressDevTarget
        ? {
            proxy: {
              '/api': { target: expressDevTarget, changeOrigin: true },
              '/manifest.webmanifest': { target: expressDevTarget, changeOrigin: true },
              '/assets/workspace': { target: expressDevTarget, changeOrigin: true },
              '/assets/platform/pwa': { target: expressDevTarget, changeOrigin: true },
              '/assets/platform/fonts': { target: expressDevTarget, changeOrigin: true },
            },
          }
        : {}),
      // Keep HMR enabled by default for instant UI feedback in development.
      // Child-process Vite (APPEND_O_VITE_CHILD): browser loads modules via Express
      // proxy (:3000) but HMR WebSocket connects directly to the Vite child port
      // (APPEND_O_VITE_HMR_CLIENT_PORT). Proxying WS through Express corrupted frames
      // ("MASK must be set") and left the SPA stuck on the splash.
      // In-process / legacy: separate HMR websocket port near serverPort+100.
      hmr: enableHmr
        ? (process.env.APPEND_O_VITE_CHILD === '1'
          ? {
              host: '127.0.0.1',
              protocol: 'ws',
              clientPort: Number(process.env.APPEND_O_VITE_HMR_CLIENT_PORT)
                || Number(process.env.APPEND_O_DEV_CLIENT_PORT)
                || serverPort,
            }
          : { port: resolvedHmrPort })
        : false,
      // Transform the entry module graph while the API finishes DB/route init so the
      // first browser import() does not pay a cold transform tax on splash.
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/App.tsx',
        ],
      },
      // Ignore server-side runtime artifacts (server functions, designer drafts, plugin storage),
      // generated Prisma client output, install-time settings writes, and SQLite files.
      watch: {
        ignored: [
          '**/*.sqlite',
          '**/*.sqlite-*',
          '**/database.sqlite*',
          '**/runtime/**',
          '**/workspace/**',
          '**/packages-storage/**',
          '**/src/generated/prisma/**',
          '**/prisma/**',
          '**/docs/**',
          '**/plans/**',
          '**/logs/**',
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.test.tsx',
          // Server-only trees — watching them caused full client page reloads and thrash.
          '**/src/server/**',
          'settings.json',
        ],
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
              return 'monaco';
            }
            if (id.includes('@tabler/icons-react')) {
              return 'tabler-icons';
            }
            if (id.includes('@solar-icons/react')) {
              return 'solar-icons';
            }
            if (id.includes('@phosphor-icons/react')) {
              return 'phosphor-icons';
            }
            // Do not force lucide / HeroUI into one shared chunk. That made the first
            // Studio route download every icon and every HeroUI widget used anywhere
            // in the app. Let Rollup keep entry-used modules in the entry (or a small
            // common chunk) and leave the rest on lazy routes / package UI.
            if (id.includes('@tanstack/react-query')) {
              return 'tanstack-query';
            }
            if (id.includes('@tanstack/react-virtual')) {
              return 'tanstack-virtual';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('/node_modules/three/') || id.includes('\\node_modules\\three\\')) {
              return 'three';
            }
            if (id.includes('@iconify')) {
              return 'iconify';
            }
            if (id.includes('@google/genai')) {
              return 'google-genai';
            }
            if (
              id.includes('/node_modules/react-dom/')
              || id.includes('/node_modules/react/')
              || id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
