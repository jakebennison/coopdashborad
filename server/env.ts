const API_ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENXBL_API_KEY'] as const

export type ApiEnv = {
  anthropicApiKey: string
  openXblApiKey: string
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
