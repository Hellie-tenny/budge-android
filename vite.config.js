import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(
    {
        plugins: [
            react(), tailwindcss(),
            VitePWA({
                registerType: 'prompt', // the app shows an "Update" banner instead of updating by itself
                manifest: {
                    name: 'Budgie',
                    short_name: 'Budgie',
                    description: 'Your personal budget assistant',
                    start_url: '/',
                    scope: '/',
                    display: 'standalone',
                    orientation: 'portrait',
                    background_color: '#f3f4f8',
                    theme_color: '#3d7ddd',
                    icons: [
                        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    ],
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
                    navigateFallback: '/index.html',
                    cleanupOutdatedCaches: true,
                },
            }),
        ]
    }
)
