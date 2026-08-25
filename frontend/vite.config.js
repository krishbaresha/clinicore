import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUILD_VERSION = `v2.1.${Date.now()}`
const BUILD_TIME = new Date().toISOString()

function pwaVersionPlugin() {
  return {
    name: 'pwa-version-generator',
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
      __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      if (fs.existsSync(distDir)) {
        // 1. Generate dist/version.json
        const versionData = {
          version: BUILD_VERSION,
          builtAt: BUILD_TIME,
          app: 'CliniCore / ClinicFlow',
        }
        fs.writeFileSync(
          path.join(distDir, 'version.json'),
          JSON.stringify(versionData, null, 2),
          'utf-8'
        )

        // 2. Inject version into dist/sw.js
        const swDistPath = path.join(distDir, 'sw.js')
        if (fs.existsSync(swDistPath)) {
          let swContent = fs.readFileSync(swDistPath, 'utf-8')
          swContent = swContent.replace(/__SW_CACHE_VERSION__/g, BUILD_VERSION)
          swContent = swContent.replace(/__SW_BUILD_TIME__/g, BUILD_TIME)
          fs.writeFileSync(swDistPath, swContent, 'utf-8')
          console.log(`[PWA Plugin] Injected ${BUILD_VERSION} into dist/sw.js and dist/version.json`)
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    pwaVersionPlugin(),
  ],
})
