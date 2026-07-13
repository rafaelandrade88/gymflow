import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: { target: 'es2020' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-72.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'GymFlow',
        short_name: 'GymFlow',
        description: 'Seu app de treino na academia — fichas, séries, progresso e timer.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        navigateFallback: '/index.html',
        // Firebase/Cloudinary/Anthropic nunca devem passar pelo cache do SW
        navigateFallbackDenylist: [/^\/\.netlify\//],
        runtimeCaching: []
      }
    })
  ]
});
