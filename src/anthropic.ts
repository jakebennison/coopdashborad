import { readApiError } from './apiClient'
import type { VisionExtraction } from './types'

type ExtractMatchResponse = {
  extraction: VisionExtraction
  screenshotArchiveKey?: string | null
  error?: string
}

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Could not read screenshot file.'))
    reader.readAsDataURL(file)
  })

export const extractMatchFromScreenshot = async (
  file: File,
  selectedTeam = 'PSG',
): Promise<{ extraction: VisionExtraction; screenshotArchiveKey: string | null }> => {
  const base64 = await fileToBase64(file)
  const response = await fetch('/api/extract-match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64,
      mediaType: file.type || 'image/png',
      selectedTeam,
    }),
  })

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Could not extract match data from screenshot.'),
    )
  }

  const data = (await response.json()) as ExtractMatchResponse | VisionExtraction

  if ('extraction' in data && data.extraction) {
    return {
      extraction: data.extraction,
      screenshotArchiveKey: data.screenshotArchiveKey ?? null,
    }
  }

  return {
    extraction: data as VisionExtraction,
    screenshotArchiveKey: null,
  }
}
