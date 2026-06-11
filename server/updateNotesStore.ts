import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { UpdateNote } from '../src/types'
import { initDatabase, isDatabaseConfigured, withDbClient } from './db'
import { seedUpdateNoteEntry, UPDATE_NOTES_SEED } from './updateNotesSeed'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'update-notes.json')

let initPromise: Promise<void> | null = null
let storageMode: 'postgres' | 'file' | null = null

const sortUpdatesNewestFirst = (updates: UpdateNote[]) =>
  [...updates].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    return dateDiff || b.id - a.id
  })

const readFileStore = async () => {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return sortUpdatesNewestFirst(parsed as UpdateNote[])
  } catch {
    return []
  }
}

const writeFileStore = async (updates: UpdateNote[]) => {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(updates, null, 2), 'utf8')
}

const initUpdateNotesTables = async () => {
  if (!isDatabaseConfigured()) return

  await withDbClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS update_notes (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        entry_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `),
  )
}

export const ensureUpdateNotesStore = async () => {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await initUpdateNotesTables()

    if (isDatabaseConfigured()) {
      storageMode = 'postgres'
      console.log('[updates] Using Postgres storage')
      return
    }

    storageMode = 'file'
    await mkdir(DATA_DIR, { recursive: true })
    try {
      await readFile(DATA_FILE, 'utf8')
    } catch {
      await writeFile(DATA_FILE, '[]', 'utf8')
    }
    console.log('[updates] DATABASE_URL not set — using .data/update-notes.json')
  })()

  return initPromise
}

const rowToUpdateNote = (row: {
  id: string | number
  title: string
  body: string
  entry_date: string | Date
  created_at: string | Date
}): UpdateNote => ({
  id: Number(row.id),
  title: row.title,
  body: row.body,
  date:
    row.entry_date instanceof Date
      ? row.entry_date.toISOString().slice(0, 10)
      : String(row.entry_date).slice(0, 10),
  createdAt:
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
})

export const listUpdateNotes = async (): Promise<UpdateNote[]> => {
  await ensureUpdateNotesStore()
  await seedUpdateNotesIfMissing()

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, title, body, entry_date, created_at
         FROM update_notes
         ORDER BY entry_date DESC, id DESC`,
      ),
    )
    return result.rows.map((row) => rowToUpdateNote(row))
  }

  return readFileStore()
}

const seedUpdateNotesIfMissing = async () => {
  const existingIds =
    storageMode === 'postgres'
      ? await withDbClient(async (client) => {
          const result = await client.query('SELECT id FROM update_notes')
          return new Set(result.rows.map((row) => Number(row.id)))
        })
      : new Set((await readFileStore()).map((entry) => entry.id))

  const missing = UPDATE_NOTES_SEED.filter((entry) => !existingIds.has(entry.id))
  if (!missing.length) return

  for (const entry of missing) {
    await createUpdateNote(seedUpdateNoteEntry(entry))
  }

  console.log(`[updates] Seeded ${missing.length} missing changelog ${missing.length === 1 ? 'entry' : 'entries'}`)
}

export const createUpdateNote = async (note: UpdateNote): Promise<UpdateNote> => {
  await ensureUpdateNotesStore()

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO update_notes (id, title, body, entry_date)
         VALUES ($1, $2, $3, $4::date)
         RETURNING id, title, body, entry_date, created_at`,
        [note.id, note.title.trim(), note.body.trim(), note.date],
      ),
    )
    return rowToUpdateNote(result.rows[0])
  }

  const updates = await readFileStore()
  const next = sortUpdatesNewestFirst([note, ...updates.filter((entry) => entry.id !== note.id)])
  await writeFileStore(next)
  return note
}

export const deleteUpdateNote = async (id: number): Promise<boolean> => {
  await ensureUpdateNotesStore()

  if (storageMode === 'postgres') {
    const result = await withDbClient((client) =>
      client.query('DELETE FROM update_notes WHERE id = $1', [id]),
    )
    return (result.rowCount ?? 0) > 0
  }

  const updates = await readFileStore()
  const next = updates.filter((entry) => entry.id !== id)
  if (next.length === updates.length) return false
  await writeFileStore(next)
  return true
}
