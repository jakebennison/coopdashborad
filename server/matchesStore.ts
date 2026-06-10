import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Match } from '../src/types'
import { initDatabase, isDatabaseConfigured, withDbClient } from './db'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'matches.json')

let initPromise: Promise<void> | null = null
let storageMode: 'postgres' | 'file' | null = null

const sortMatchesNewestFirst = (matches: Match[]) =>
  [...matches].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    return dateDiff || b.id - a.id
  })

const normalizeMatch = (match: Match): Match => {
  if (match.comments?.length) {
    return { ...match, comments: match.comments }
  }

  const legacyComment = match.comment?.trim()
  if (legacyComment) {
    return {
      ...match,
      comments: [
        {
          id: `legacy-${match.id}`,
          author: 'Co-op player',
          body: legacyComment,
          createdAt: `${match.date}T12:00:00.000Z`,
          likes: 0,
          likedByMe: false,
          replies: [],
        },
      ],
    }
  }

  return { ...match, comments: [] }
}

const readFileStore = async () => {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return sortMatchesNewestFirst(parsed.map((match) => normalizeMatch(match as Match)))
  } catch {
    return []
  }
}

const writeFileStore = async (matches: Match[]) => {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(matches, null, 2), 'utf8')
}

export const ensureMatchesStore = async () => {
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (isDatabaseConfigured()) {
      await initDatabase()
      storageMode = 'postgres'
      console.log('[matches] Using Postgres storage')
      return
    }

    storageMode = 'file'
    await mkdir(DATA_DIR, { recursive: true })
    try {
      await readFile(DATA_FILE, 'utf8')
    } catch {
      await writeFile(DATA_FILE, '[]', 'utf8')
    }
    console.log('[matches] DATABASE_URL not set — using .data/matches.json')
  })()

  return initPromise
}

export const listMatches = async (): Promise<Match[]> => {
  await ensureMatchesStore()

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT payload
         FROM matches
         ORDER BY (payload->>'date') DESC, id DESC`,
      ),
    )
    return result.rows.map((row) => normalizeMatch(row.payload as Match))
  }

  return readFileStore()
}

export const createMatch = async (match: Match): Promise<Match> => {
  await ensureMatchesStore()
  const normalized = normalizeMatch(match)

  if (storageMode === 'postgres') {
    await withDbClient((client) =>
      client.query(
        `INSERT INTO matches (id, payload)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload,
             updated_at = NOW()`,
        [normalized.id, normalized],
      ),
    )
    return normalized
  }

  const matches = await readFileStore()
  const next = sortMatchesNewestFirst([
    normalized,
    ...matches.filter((entry) => entry.id !== normalized.id),
  ])
  await writeFileStore(next)
  return normalized
}

export const updateMatch = async (match: Match): Promise<Match | null> => {
  await ensureMatchesStore()
  const normalized = normalizeMatch(match)

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query(
        `UPDATE matches
         SET payload = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING payload`,
        [normalized.id, normalized],
      ),
    )
    if (!result.rowCount) return null
    return normalizeMatch(result.rows[0].payload as Match)
  }

  const matches = await readFileStore()
  const index = matches.findIndex((entry) => entry.id === normalized.id)
  if (index === -1) return null

  const next = [...matches]
  next[index] = normalized
  await writeFileStore(sortMatchesNewestFirst(next))
  return normalized
}

export const deleteMatch = async (id: number): Promise<boolean> => {
  await ensureMatchesStore()

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query('DELETE FROM matches WHERE id = $1', [id]),
    )
    return (result.rowCount ?? 0) > 0
  }

  const matches = await readFileStore()
  const next = matches.filter((entry) => entry.id !== id)
  if (next.length === matches.length) return false
  await writeFileStore(next)
  return true
}

export const deleteAllMatches = async (): Promise<void> => {
  await ensureMatchesStore()

  if (storageMode === 'postgres') {
    await withDbClient((client) => client.query('DELETE FROM matches'))
    return
  }

  await writeFileStore([])
}
