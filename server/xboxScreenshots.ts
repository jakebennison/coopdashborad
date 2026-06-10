import type { IncomingMessage, ServerResponse } from 'node:http'
import { extractMatchFromImage, readJsonBody } from './extractMatch'
import { normalizeImageMediaType } from './imageMedia'
import {
  getContinuationToken,
  normalizeScreenshotPage,
  toScreenshotRecord,
  type OpenXblScreenshotResponse,
  type XboxScreenshotRecord,
} from './xboxScreenshotNormalize'
import {
  mergeScreenshotLibraries,
  readScreenshotCache,
  writeScreenshotCache,
} from './xboxScreenshotCache'

const OPENXBL_BASE = 'https://xbl.io'
const ALLOWED_IMAGE_HOSTS = ['xboxlive.com', 'xbox.com', 'microsoft.com', 'windows.net']

export type XboxSyncStatus = 'live' | 'cached' | 'empty'

export type XboxScreenshotFetchResult = {
  screenshots: XboxScreenshotRecord[]
  syncStatus: XboxSyncStatus
  lastSyncedAt: string | null
}

export type { XboxScreenshotRecord } from './xboxScreenshotNormalize'

type XboxExtractBody = {
  contentId?: string
  downloadUrl?: string
}

const openXblRequest = async (path: string, apiKey: string) => {
  if (!apiKey) {
    throw new Error('Missing OPENXBL_API_KEY. Add it to your .env file and restart the dev server.')
  }

  const response = await fetch(`${OPENXBL_BASE}${path}`, {
    headers: {
      'X-Authorization': apiKey,
      Accept: 'application/json',
    },
  })

  if (response.status === 429) {
    throw new Error('OpenXBL rate limit reached. Wait a few minutes and try again.')
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`OpenXBL request failed (${response.status}): ${details}`)
  }

  return (await response.json()) as OpenXblScreenshotResponse
}

type OpenXblAccountResponse = {
  content?: {
    profileUsers?: Array<{
      settings?: Array<{ id?: string; value?: string }>
    }>
  }
}

export const fetchLinkedGamertag = async (apiKey: string) => {
  const data = (await openXblRequest('/api/v2/account', apiKey)) as OpenXblAccountResponse
  const settings = data.content?.profileUsers?.[0]?.settings ?? []
  return settings.find((setting) => setting.id === 'Gamertag')?.value ?? null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fetchXboxScreenshotLibrary = async (apiKey: string, limit = 36) => {
  const byId = new Map<string, XboxScreenshotRecord>()
  let continuationToken = ''

  while (byId.size < limit) {
    const path = continuationToken
      ? `/api/v2/dvr/screenshots?continuationToken=${encodeURIComponent(continuationToken)}`
      : '/api/v2/dvr/screenshots'
    const data = await openXblRequest(path, apiKey)
    const page = normalizeScreenshotPage(data)

    for (const screen of page) {
      byId.set(screen.contentId, toScreenshotRecord(screen))
      if (byId.size >= limit) break
    }

    continuationToken = getContinuationToken(data)
    if (!continuationToken || !page.length) break
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.captureDate).getTime() - new Date(a.captureDate).getTime(),
  )
}

const fetchLiveScreenshotLibrary = async (apiKey: string, limit = 36) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const screenshots = await fetchXboxScreenshotLibrary(apiKey, limit)
    if (screenshots.length) return screenshots
    if (attempt < 2) await sleep(900)
  }

  return []
}

export const fetchScreenshotsForImport = async (
  apiKey: string,
  limit = 36,
): Promise<XboxScreenshotFetchResult> => {
  const live = await fetchLiveScreenshotLibrary(apiKey, limit)
  const cache = await readScreenshotCache()
  const merged = mergeScreenshotLibraries(live, cache?.screenshots ?? []).slice(0, limit)

  if (live.length) {
    return {
      screenshots: merged,
      syncStatus: 'live',
      lastSyncedAt: new Date().toISOString(),
    }
  }

  if (merged.length) {
    return {
      screenshots: merged,
      syncStatus: 'cached',
      lastSyncedAt: cache?.fetchedAt ?? null,
    }
  }

  return {
    screenshots: [],
    syncStatus: 'empty',
    lastSyncedAt: null,
  }
}

export const findScreenshotByContentId = async (apiKey: string, contentId: string) => {
  const trimmed = contentId.trim()
  if (!trimmed) return null

  const live = await fetchLiveScreenshotLibrary(apiKey, 100)
  const cache = await readScreenshotCache()
  const library = mergeScreenshotLibraries(live, cache?.screenshots ?? [])
  return library.find((screen) => screen.contentId === trimmed) ?? null
}

export const isAllowedXboxImageUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return ALLOWED_IMAGE_HOSTS.some((host) => hostname.endsWith(host))
  } catch {
    return false
  }
}

export const downloadScreenshotAsBase64 = async (url: string) => {
  if (!isAllowedXboxImageUrl(url)) {
    throw new Error('Screenshot download URL is not from a trusted Xbox host.')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download Xbox screenshot (${response.status}).`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.length < 16) {
    throw new Error('Downloaded screenshot file was empty. Refresh the Xbox list and try again.')
  }

  const mediaType = normalizeImageMediaType(response.headers.get('content-type'), url, buffer)
  const base64 = buffer.toString('base64')

  return { base64, mediaType }
}

const parseImportedIds = (req: IncomingMessage) => {
  const url = new URL(req.url ?? '', 'http://localhost')
  const raw = url.searchParams.get('imported') ?? ''
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleXboxScreenshotsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string,
) {
  try {
    const imported = new Set(parseImportedIds(req))
    const [gamertag, fetchResult] = await Promise.all([
      fetchLinkedGamertag(apiKey),
      fetchScreenshotsForImport(apiKey),
    ])

    if (fetchResult.syncStatus === 'live') {
      await writeScreenshotCache(gamertag, fetchResult.screenshots)
    }

    sendJson(res, 200, {
      gamertag,
      screenshots: fetchResult.screenshots.map((screenshot) => ({
        ...screenshot,
        alreadyImported: imported.has(screenshot.contentId),
      })),
      syncStatus: fetchResult.syncStatus,
      lastSyncedAt: fetchResult.lastSyncedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load Xbox screenshots.'
    sendJson(res, 400, { error: message })
  }
}

export async function handleXboxExtractMatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  anthropicApiKey: string,
  openXblApiKey: string,
) {
  try {
    const body = await readJsonBody<XboxExtractBody>(req)
    const contentId = body.contentId?.trim()

    if (!contentId) {
      throw new Error('Screenshot content ID is required.')
    }

    const freshScreenshot = await findScreenshotByContentId(openXblApiKey, contentId)
    const downloadUrl = freshScreenshot?.downloadUrl ?? body.downloadUrl?.trim()

    if (!downloadUrl) {
      throw new Error('Could not find that Xbox screenshot. Refresh the list and try again.')
    }

    const { base64, mediaType } = await downloadScreenshotAsBase64(downloadUrl)
    const extraction = await extractMatchFromImage(base64, mediaType, anthropicApiKey)

    sendJson(res, 200, {
      extraction,
      contentId,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not extract match data from Xbox screenshot.'
    sendJson(res, 400, { error: message })
  }
}
