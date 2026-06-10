import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { XboxScreenshotRecord } from './xboxScreenshotNormalize'

type CachedLibrary = {
  gamertag: string | null
  screenshots: XboxScreenshotRecord[]
  fetchedAt: string
}

const CACHE_DIR = path.join(process.cwd(), '.xbox-cache')
const CACHE_FILE = path.join(CACHE_DIR, 'screenshots.json')

const readCacheFile = async (): Promise<CachedLibrary | null> => {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as CachedLibrary
    if (!Array.isArray(parsed.screenshots)) return null
    return parsed
  } catch {
    return null
  }
}

export const readScreenshotCache = async () => readCacheFile()

export const writeScreenshotCache = async (
  gamertag: string | null,
  screenshots: XboxScreenshotRecord[],
) => {
  if (!screenshots.length) return

  const existing = await readCacheFile()
  const merged = mergeScreenshotLibraries(screenshots, existing?.screenshots ?? [])

  await mkdir(CACHE_DIR, { recursive: true })
  const payload: CachedLibrary = {
    gamertag: gamertag ?? existing?.gamertag ?? null,
    screenshots: merged,
    fetchedAt: new Date().toISOString(),
  }
  await writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8')
}

export const mergeScreenshotLibraries = (
  primary: XboxScreenshotRecord[],
  secondary: XboxScreenshotRecord[],
) => {
  const byId = new Map<string, XboxScreenshotRecord>()

  for (const screenshot of [...secondary, ...primary]) {
    byId.set(screenshot.contentId, screenshot)
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.captureDate).getTime() - new Date(a.captureDate).getTime(),
  )
}
