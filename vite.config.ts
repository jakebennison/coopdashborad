import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiPlugin } from './server/apiPlugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiPlugin(() => ({
        anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
        openXblApiKey: env.OPENXBL_API_KEY ?? '',
      })),
    ],
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: ['coopdashborad-production.up.railway.app'],
    },
  }
})
