import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'assets/favicon.svg',
        'assets/logo-icon.svg',
        'assets/logo-brand.svg',
        'assets/logo.png',
        'assets/logo.svg'
      ],
      manifest: {
        name: 'OmniQuiz PRO - Nền tảng khảo thí CBT chuẩn hóa',
        short_name: 'OmniQuiz',
        description: 'Nền tảng thi và ôn tập trắc nghiệm trực tuyến đa môn học chuẩn CBT với AI Tutor, KaTeX và tự động sao lưu ngoại tuyến',
        theme_color: '#090D16',
        background_color: '#090D16',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'assets/logo-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'assets/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'katex-cdn-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/fixtures\/.*\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exam-fixtures-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/dexie')) return 'dexie';
          if (id.includes('node_modules/katex')) return 'katex';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/chart.js')) return 'chart';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
