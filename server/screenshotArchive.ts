import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ensureMatchesStore } from './matchesStore'
import { isDatabaseConfigured, withDbClient } from './db'

const DATA_DIR = path.join(process.cwd(), '.data', 'screenshots')
const PENDING_DIR = path.join(DATA_DIR, 'pending')
const MATCH_DIR = path.join(DATA_DIR, 'matches')

export type ScreenshotSource = 'upload' | 'xbox'

type StoredScreenshot = {
  buffer: Buffer
  mediaType: string
  source: ScreenshotSource
  xboxContentId: string | null
}

const safeArchiveKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, '_')

const pendingFilePaths = (archiveKey: string) => {
  const safe = safeArchiveKey(archiveKey)
  return {
    meta: path.join(PENDING_DIR, `${safe}.meta.json`),
    data: path.join(PENDING_DIR, `${safe}.bin`),
  }
}

const matchFilePaths = (matchId: number) => {
  const safe = String(matchId)
  return {
    meta: path.join(MATCH_DIR, `${safe}.meta.json`),
    data: path.join(MATCH_DIR, `${safe}.bin`),
  }
}

const ensureScreenshotDirs = async () => {
  await mkdir(PENDING_DIR, { recursive: true })
  await mkdir(MATCH_DIR, { recursive: true })
}

const initScreenshotTables = async () => {
  if (!isDatabaseConfigured()) return

  await withDbClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS pending_screenshot_archives (
        archive_key TEXT PRIMARY KEY,
        media_type TEXT NOT NULL,
        image_data BYTEA NOT NULL,
        source TEXT NOT NULL,
        xbox_content_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS match_screenshots (
        match_id BIGINT PRIMARY KEY,
        media_type TEXT NOT NULL,
        image_data BYTEA NOT NULL,
        source TEXT NOT NULL,
        xbox_content_id TEXT,
        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `),
  )
}

let initPromise: Promise<void> | null = null

export const ensureScreenshotArchive = async () => {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await ensureMatchesStore()
    await ensureScreenshotDirs()
    await initScreenshotTables()
  })()

  return initPromise
}

export const createUploadArchiveKey = () => randomUUID()

export const createXboxArchiveKey = (contentId: string) => `xbox:${contentId.trim()}`

export const savePendingScreenshot = async (
  archiveKey: string,
  buffer: Buffer,
  mediaType: string,
  source: ScreenshotSource,
  xboxContentId: string | null = null,
) => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    await withDbClient((client) =>
      client.query(
        `INSERT INTO pending_screenshot_archives (archive_key, media_type, image_data, source, xbox_content_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (archive_key) DO UPDATE
         SET media_type = EXCLUDED.media_type,
             image_data = EXCLUDED.image_data,
             source = EXCLUDED.source,
             xbox_content_id = EXCLUDED.xbox_content_id,
             created_at = NOW()`,
        [archiveKey, mediaType, buffer, source, xboxContentId],
      ),
    )
    return
  }

  const paths = pendingFilePaths(archiveKey)
  await writeFile(
    paths.meta,
    JSON.stringify({ mediaType, source, xboxContentId }),
    'utf8',
  )
  await writeFile(paths.data, buffer)
}

const readPendingScreenshot = async (archiveKey: string): Promise<StoredScreenshot | null> => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT media_type, image_data, source, xbox_content_id
         FROM pending_screenshot_archives
         WHERE archive_key = $1`,
        [archiveKey],
      ),
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      buffer: row.image_data as Buffer,
      mediaType: row.media_type as string,
      source: row.source as ScreenshotSource,
      xboxContentId: (row.xbox_content_id as string | null) ?? null,
    }
  }

  const paths = pendingFilePaths(archiveKey)
  try {
    const [metaRaw, buffer] = await Promise.all([
      readFile(paths.meta, 'utf8'),
      readFile(paths.data),
    ])
    const meta = JSON.parse(metaRaw) as {
      mediaType: string
      source: ScreenshotSource
      xboxContentId: string | null
    }
    return {
      buffer,
      mediaType: meta.mediaType,
      source: meta.source,
      xboxContentId: meta.xboxContentId ?? null,
    }
  } catch {
    return null
  }
}

const deletePendingScreenshot = async (archiveKey: string) => {
  if (isDatabaseConfigured()) {
    await withDbClient((client) =>
      client.query('DELETE FROM pending_screenshot_archives WHERE archive_key = $1', [archiveKey]),
    )
    return
  }

  const paths = pendingFilePaths(archiveKey)
  await Promise.all([rm(paths.meta, { force: true }), rm(paths.data, { force: true })])
}

const writeMatchScreenshot = async (matchId: number, screenshot: StoredScreenshot) => {
  if (isDatabaseConfigured()) {
    await withDbClient((client) =>
      client.query(
        `INSERT INTO match_screenshots (match_id, media_type, image_data, source, xbox_content_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id) DO UPDATE
         SET media_type = EXCLUDED.media_type,
             image_data = EXCLUDED.image_data,
             source = EXCLUDED.source,
             xbox_content_id = EXCLUDED.xbox_content_id,
             archived_at = NOW()`,
        [
          matchId,
          screenshot.mediaType,
          screenshot.buffer,
          screenshot.source,
          screenshot.xboxContentId,
        ],
      ),
    )
    return
  }

  const paths = matchFilePaths(matchId)
  await writeFile(
    paths.meta,
    JSON.stringify({
      mediaType: screenshot.mediaType,
      source: screenshot.source,
      xboxContentId: screenshot.xboxContentId,
    }),
    'utf8',
  )
  await writeFile(paths.data, screenshot.buffer)
}

export const attachPendingScreenshotToMatch = async (
  archiveKey: string,
  matchId: number,
): Promise<boolean> => {
  const pending = await readPendingScreenshot(archiveKey)
  if (!pending) return false

  await writeMatchScreenshot(matchId, pending)
  await deletePendingScreenshot(archiveKey)
  return true
}

export const attachScreenshotForMatch = async (
  matchId: number,
  archiveKey: string | null | undefined,
  xboxContentId: string | null | undefined,
) => {
  const keys = [
    archiveKey?.trim(),
    xboxContentId?.trim() ? createXboxArchiveKey(xboxContentId.trim()) : null,
  ].filter((value): value is string => Boolean(value))

  for (const key of keys) {
    if (await attachPendingScreenshotToMatch(key, matchId)) {
      return true
    }
  }

  return false
}

export const getMatchScreenshot = async (matchId: number): Promise<StoredScreenshot | null> => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT media_type, image_data, source, xbox_content_id
         FROM match_screenshots
         WHERE match_id = $1`,
        [matchId],
      ),
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      buffer: row.image_data as Buffer,
      mediaType: row.media_type as string,
      source: row.source as ScreenshotSource,
      xboxContentId: (row.xbox_content_id as string | null) ?? null,
    }
  }

  const paths = matchFilePaths(matchId)
  try {
    const [metaRaw, buffer] = await Promise.all([
      readFile(paths.meta, 'utf8'),
      readFile(paths.data),
    ])
    const meta = JSON.parse(metaRaw) as {
      mediaType: string
      source: ScreenshotSource
      xboxContentId: string | null
    }
    return {
      buffer,
      mediaType: meta.mediaType,
      source: meta.source,
      xboxContentId: meta.xboxContentId ?? null,
    }
  } catch {
    return null
  }
}

export const listMatchIdsWithScreenshots = async (): Promise<Set<number>> => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    const result = await withDbClient((client) =>
      client.query('SELECT match_id FROM match_screenshots'),
    )
    return new Set(result.rows.map((row) => Number(row.match_id)))
  }

  try {
    const files = await readdir(MATCH_DIR)
    return new Set(
      files
        .filter((file) => file.endsWith('.meta.json'))
        .map((file) => Number(file.replace('.meta.json', '')))
        .filter((id) => Number.isFinite(id)),
    )
  } catch {
    return new Set()
  }
}

export const deleteMatchScreenshot = async (matchId: number) => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    await withDbClient((client) =>
      client.query('DELETE FROM match_screenshots WHERE match_id = $1', [matchId]),
    )
    return
  }

  const paths = matchFilePaths(matchId)
  await Promise.all([rm(paths.meta, { force: true }), rm(paths.data, { force: true })])
}

export const deleteAllMatchScreenshots = async () => {
  await ensureScreenshotArchive()

  if (isDatabaseConfigured()) {
    await withDbClient((client) => client.query('DELETE FROM match_screenshots'))
    return
  }

  try {
    const files = await readdir(MATCH_DIR)
    await Promise.all(files.map((file) => rm(path.join(MATCH_DIR, file), { force: true })))
  } catch {
    // No screenshot directory yet.
  }
}
