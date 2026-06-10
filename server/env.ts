import { readFileSync } from 'node:fs'
import path from 'node:path'

const API_ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENXBL_API_KEY'] as const
const ANTHROPIC_ENV_KEYS = ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY'] as const

export type ApiEnv = {
  anthropicApiKey: string
  openXblApiKey: string
}

export const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return ''

  let normalized = value.trim().replace(/^\uFEFF/, '')

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  return normalized
}

const readEnvValue = (keys: readonly string[]) => {
  for (const key of keys) {
    const value = normalizeEnvValue(process.env[key])
    if (value) return value
  }

  return ''
}

const assignEnvValue = (key: string, value: string) => {
  const normalized = normalizeEnvValue(value)
  if (!normalized) return
  if (!normalizeEnvValue(process.env[key])) {
    process.env[key] = normalized
  }
}

export const loadLocalEnvFile = () => {
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env'), 'utf8')

    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
      const separator = withoutExport.indexOf('=')
      if (separator === -1) continue

      const key = withoutExport.slice(0, separator).trim()
      const value = withoutExport.slice(separator + 1).trim()
      assignEnvValue(key, value)
    }
  } catch {
    // No local .env file — Railway and other hosts inject process.env directly.
  }
}

export const hydrateApiEnvFromFiles = (fileEnv: Record<string, string>) => {
  for (const key of API_ENV_KEYS) {
    if (fileEnv[key]) {
      assignEnvValue(key, fileEnv[key])
    }
  }

  if (fileEnv.VITE_ANTHROPIC_API_KEY) {
    assignEnvValue('VITE_ANTHROPIC_API_KEY', fileEnv.VITE_ANTHROPIC_API_KEY)
  }
}

export const readApiEnv = (): ApiEnv => ({
  anthropicApiKey: readEnvValue(ANTHROPIC_ENV_KEYS),
  openXblApiKey: readEnvValue(['OPENXBL_API_KEY']),
})
