import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.DEV_API_TARGET || `http://localhost:${env.PORT || 3001}`

  return {
    plugins: [react()],
    // Dev only: forward /api to the local Express server. Not used in production builds.
    server: {
      proxy: { '/api': apiTarget },
    },
  }
})
