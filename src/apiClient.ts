export const readApiError = async (response: Response, fallback: string) => {
  const text = await response.text()

  if (!text.trim()) {
    if (response.status === 502 || response.status === 504) {
      return 'The server timed out while analysing the screenshot. Please try again.'
    }

    return fallback
  }

  try {
    const data = JSON.parse(text) as { error?: string }
    if (data.error) return data.error
  } catch {
    if (response.status === 502 || response.status === 504) {
      return 'The server timed out while analysing the screenshot. Please try again.'
    }

    return `${fallback} (HTTP ${response.status})`
  }

  return fallback
}
