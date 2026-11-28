import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const BUILD_TIMESTAMP = new Date().toISOString()
const COMMIT_SHORT = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 8)
const APP_BUILD_ID = COMMIT_SHORT
  ? `${COMMIT_SHORT}-${Date.now().toString(36)}`
  : `build-${Date.now().toString(36)}`

function tnpscBuildVersionPlugin(): Plugin {
  const versionPayload = JSON.stringify(
    {
      buildId: APP_BUILD_ID,
      buildTime: BUILD_TIMESTAMP,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
    },
    null,
    2
  )

  return {
    name: 'tnpsc-build-version-manifest',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.end(
          JSON.stringify({
            buildId: APP_BUILD_ID,
            buildTime: BUILD_TIMESTAMP,
            environment: 'development',
          })
        )
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tnpscBuildVersionPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIMESTAMP),
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-motion'
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
