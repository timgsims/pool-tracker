import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync } from 'fs'

// Dev builds (--mode development, VITE_ENV_NAME=test) get the orange icons from
// public-dev/ in place of the green ones, so the two installed apps look different.
const devIcons = (isTest) => ({
  name: 'dev-icons',
  closeBundle() {
    if (isTest) cpSync('public-dev', 'dist', { recursive: true })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    server: { host: true },
    plugins: [
      react(),
      devIcons(env.VITE_ENV_NAME === 'test'),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        },
        manifest: {
          name: '8-Ball Pool Tracker',
          short_name: 'Pool Tracker',
          description: 'Track 8-ball pool matches with friends',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
  }
})
