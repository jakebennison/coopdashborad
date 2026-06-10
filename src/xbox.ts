import type { VisionExtraction } from './types'
import { readApiError } from './apiClient'

export type XboxScreenshotItem = {
  contentId: string
  titleName: string
  titleId: string
  captureDate: string
  thumbnailUrl: string | null
  downloadUrl: string
  width: number | null
  height: number | null
  alreadyImported: boolean
}

export type XboxSyncStatus = 'live' | 'cached' | 'empty'

type XboxScreenshotsResponse = {
  screenshots: XboxScreenshotItem[]
  gamertag?: string | null
  syncStatus?: XboxSyncStatus
  lastSyncedAt?: string | null
  error?: string
}

type XboxExtractResponse = {
  extraction: VisionExtraction
  contentId?: string | null
  screenshotArchiveKey?: string | null
  error?: string
}

const XBOX_CACHE_KEY = 'psg-xbox-screenshot-cache'

type CachedXboxLibrary = {
  screenshots: XboxScreenshotItem[]
  gamertag: string | null
  lastSyncedAt: string | null
  syncStatus: XboxSyncStatus
}

const readLocalXboxCache = (): CachedXboxLibrary | null => {
  try {
    const raw = localStorage.getItem(XBOX_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedXboxLibrary
  } catch {
    return null
  }
}

const writeLocalXboxCache = (cache: CachedXboxLibrary) => {
  localStorage.setItem(XBOX_CACHE_KEY, JSON.stringify(cache))
}

const mergeScreenshotItems = (
  primary: XboxScreenshotItem[],
  secondary: XboxScreenshotItem[],
) => {
  const byId = new Map<string, XboxScreenshotItem>()

  for (const screenshot of [...secondary, ...primary]) {
    byId.set(screenshot.contentId, screenshot)
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.captureDate).getTime() - new Date(a.captureDate).getTime(),
  )
}

export const fetchXboxScreenshots = async (importedIds: string[] = []) => {
  const imported = importedIds.filter(Boolean).join(',')
  const query = imported ? `?imported=${encodeURIComponent(imported)}` : ''
  const response = await fetch(`/api/xbox/screenshots${query}`)

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not load Xbox screenshots.'))
  }

  const data = (await response.json()) as XboxScreenshotsResponse

  const localCache = readLocalXboxCache()
  const screenshots =
    data.screenshots.length || !localCache
      ? data.screenshots
      : mergeScreenshotItems(
          data.screenshots,
          localCache.screenshots.map((screenshot) => ({
            ...screenshot,
            alreadyImported: importedIds.includes(screenshot.contentId),
          })),
        )

  const syncStatus =
    data.screenshots.length > 0
      ? (data.syncStatus ?? 'live')
      : localCache?.screenshots.length
        ? 'cached'
        : (data.syncStatus ?? 'empty')

  const result = {
    screenshots,
    gamertag: data.gamertag ?? localCache?.gamertag ?? null,
    syncStatus,
    lastSyncedAt: data.lastSyncedAt ?? localCache?.lastSyncedAt ?? null,
  }

  if (screenshots.length) {
    writeLocalXboxCache({
      screenshots: screenshots.map(({ alreadyImported: _ignored, ...screenshot }) => ({
        ...screenshot,
        alreadyImported: false,
      })),
      gamertag: result.gamertag,
      lastSyncedAt: result.lastSyncedAt,
      syncStatus: result.syncStatus,
    })
  }

  return result
}

export const extractMatchFromXboxScreenshot = async (
  screenshot: Pick<XboxScreenshotItem, 'contentId' | 'downloadUrl'>,
) => {
  const response = await fetch('/api/xbox/extract-match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentId: screenshot.contentId,
      downloadUrl: screenshot.downloadUrl,
    }),
  })

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Could not extract match data from Xbox screenshot.'),
    )
  }

  const data = (await response.json()) as XboxExtractResponse

  return {
    extraction: data.extraction,
    contentId: data.contentId ?? screenshot.contentId,
    screenshotArchiveKey: data.screenshotArchiveKey ?? null,
  }
}

export const formatXboxCaptureDate = (isoDate: string) => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const formatXboxSyncTime = (isoDate: string | null | undefined) => {
  if (!isoDate) return null

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
