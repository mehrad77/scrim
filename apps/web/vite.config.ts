import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { bootstrapPrefs, PREFS_KEY } from './src/lib/prefs';

export default defineConfig({
  plugins: [
    {
      // Apply theme, contrast, motion and scale before first paint (src/lib/prefs.ts).
      name: 'scrim-prefs-bootstrap',
      transformIndexHtml: () => [
        {
          tag: 'script',
          children: `(${bootstrapPrefs.toString()})(${JSON.stringify(PREFS_KEY)});`,
          injectTo: 'head-prepend',
        },
      ],
    },
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Scrim',
        short_name: 'Scrim',
        description: 'Browser-native show control for interactive theater',
        theme_color: '#090705',
        background_color: '#090705',
        display: 'standalone',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/audience/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', audience: 'audience.html' } },
  },
  server: { port: 5173 },
});
