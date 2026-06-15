import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        id: 'scoreforge-coach',
        name: 'ScoreForge',
        short_name: 'ScoreForge',
        description: 'AI-powered SAT prep platform',
        start_url: '/',
        theme_color: '#2563EB',
        background_color: '#F8F9FB',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'Practice Quiz', short_name: 'Quiz', url: '/student/quiz', description: 'Start a practice quiz' },
          { name: 'Flashcards', short_name: 'Cards', url: '/student/flashcards', description: 'Study flashcards' },
          { name: 'Mock Test', short_name: 'Mock', url: '/student/mock-test', description: 'Take a mock SAT test' },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
