import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

function getCommitHash(): string {
  const rootDir = path.dirname(fileURLToPath(import.meta.url))
  const gitDir = path.join(rootDir, '.git')

  try {
    const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim()

    if (!head.startsWith('ref: ')) {
      return head.slice(0, 7)
    }

    const refPath = head.slice(5)
    const refFile = path.join(gitDir, refPath)

    if (existsSync(refFile)) {
      return readFileSync(refFile, 'utf8').trim().slice(0, 7)
    }

    const packedRefs = path.join(gitDir, 'packed-refs')
    if (existsSync(packedRefs)) {
      const refLine = readFileSync(packedRefs, 'utf8')
        .split('\n')
        .find((line) => line.endsWith(` ${refPath}`))

      if (refLine) {
        return refLine.split(' ')[0].slice(0, 7)
      }
    }
  } catch {
    return 'unknown'
  }

  return 'unknown'
}

const commitHash = getCommitHash()

// https://vite.dev/config/
export default defineConfig({
  base: '/kintore/',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kintore',
        short_name: 'Kintore',
        description: '筋トレの記録を管理するアプリ',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
      },
    }),
  ],
})
