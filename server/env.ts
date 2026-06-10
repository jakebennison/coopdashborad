import { readFileSync } from 'node:fs'
import path from 'node:path'

const API_ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENXBL_API_KEY'] as const

export type ApiEnv = {
  anthropicApiKey: string
  openXblApiKey: string
}

export const loadLocalEnvFile = () => {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env'), 'utf8')

    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separator = trimmed.indexOf('=')
      if (separator === -1) continue

      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      if (!process.env[key]?.trim() && value) {
        process.env[key] = value
      }
    }
  } catch {
    // No local .env file — Railway and other hosts inject process.env directly.
  }
}

export const hydrateApiEnvFromFiles = (fileEnv: Record<string, string>) => {
  for (const key of API_ENV_KEYS) {
    if (!process.env[key]?.trim() && fileEnv[key]?.trim()) {
      process.env[key] = fileEnv[key].trim()
    }
  }
}

export const readApiEnv = (): ApiEnv => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
  openXblApiKey: process.env.OPENXBL_API_KEY?.trim() ?? '',
})
