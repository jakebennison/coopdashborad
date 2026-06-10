import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UpdateNote } from '../src/types'
import { readJsonBody } from './extractMatch'
import { createUpdateNote, deleteUpdateNote, listUpdateNotes } from './updateNotesStore'

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const parseUpdateId = (pathname: string) => {
  const match = pathname.match(/^\/api\/updates\/(\d+)$/)
  return match ? Number(match[1]) : null
}

export async function handleListUpdateNotesRequest(_req: IncomingMessage, res: ServerResponse) {
  try {
    const updates = await listUpdateNotes()
    sendJson(res, 200, { updates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load updates.'
    sendJson(res, 500, { error: message })
  }
}

export async function handleCreateUpdateNoteRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJsonBody<UpdateNote>(req)
    if (!body?.title?.trim() || !body?.body?.trim() || !body?.date) {
      throw new Error('Update title, date, and notes are required.')
    }

    const saved = await createUpdateNote({
      id: body.id || Date.now(),
      title: body.title.trim(),
      body: body.body.trim(),
      date: body.date,
      createdAt: body.createdAt || new Date().toISOString(),
    })

    sendJson(res, 201, { update: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save update.'
    sendJson(res, 400, { error: message })
  }
}

export async function handleDeleteUpdateNoteRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  id: number,
) {
  try {
    const deleted = await deleteUpdateNote(id)
    if (!deleted) {
      sendJson(res, 404, { error: 'Update not found.' })
      return
    }

    sendJson(res, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete update.'
    sendJson(res, 500, { error: message })
  }
}

export const handleUpdateNotesRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (pathname === '/api/updates' && req.method === 'GET') {
    await handleListUpdateNotesRequest(req, res)
    return true
  }

  if (pathname === '/api/updates' && req.method === 'POST') {
    await handleCreateUpdateNoteRequest(req, res)
    return true
  }

  const updateId = parseUpdateId(pathname)
  if (updateId != null && req.method === 'DELETE') {
    await handleDeleteUpdateNoteRequest(req, res, updateId)
    return true
  }

  return false
}
