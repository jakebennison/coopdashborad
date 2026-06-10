import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiPlugin } from './server/apiPlugin'

const readEnvValue = (key: string, env: Record<string, string>) =>
  (process.env[key] ?? env[key] ?? '').trim()

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiPlugin(() => ({
        anthropicApiKey: readEnvValue('ANTHROPIC_API_KEY', env),
        openXblApiKey: readEnvValue('OPENXBL_API_KEY', env),
      })),
    ],
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 4173,
      strictPort: false,
      allowedHosts: ['.up.railway.app'],
    },
  }
})
