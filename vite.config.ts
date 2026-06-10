import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiPlugin } from './server/apiPlugin'
import { hydrateApiEnvFromFiles } from './server/env'

export default defineConfig(({ mode }) => {
  hydrateApiEnvFromFiles(loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 4173,
      strictPort: false,
      allowedHosts: ['.up.railway.app'],
    },
  }
})
